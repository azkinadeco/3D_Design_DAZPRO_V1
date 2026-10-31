// Lingkungan 3D: langit, jalan, gedung latar, dan struktur penempatan signage
import * as THREE from 'three';

// ---------- util ----------
const rand = (() => { let s = 1337; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

function std(color, rough = 0.8, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function box(w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

/** Balok di antara dua titik (untuk rangka besi). */
export function beam(a, b, size, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, len, size), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

// ---------- tekstur jendela ----------
const windowCache = new Map();
function windowTextures(cols, rows, seed, style = 'office') {
  const key = `${cols}x${rows}:${seed}:${style}`;
  if (windowCache.has(key)) return windowCache.get(key);
  const W = 512, H = Math.round(512 * (rows / cols) * 0.9);
  const c = document.createElement('canvas'); c.width = W; c.height = Math.min(Math.max(H, 64), 2048);
  const e = document.createElement('canvas'); e.width = c.width; e.height = c.height;
  const g = c.getContext('2d'), ge = e.getContext('2d');
  const base = style === 'office' ? '#8f96a0' : '#b8ada0';
  g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, e.width, e.height);
  const cw = c.width / cols, rh = c.height / rows;
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = k * cw + cw * 0.14, y = r * rh + rh * 0.18, w = cw * 0.72, h = rh * 0.62;
      const t = rnd();
      g.fillStyle = style === 'office' ? `rgb(${40 + t * 30},${55 + t * 30},${72 + t * 30})` : `rgb(${50 + t * 20},${58 + t * 20},${66 + t * 20})`;
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x, y, w, h * 0.35);
      if (rnd() > 0.45) {
        const warm = rnd() > 0.3;
        ge.fillStyle = warm ? `rgba(255,${190 + rnd() * 40},${120 + rnd() * 50},1)` : 'rgba(200,225,255,1)';
        ge.fillRect(x, y, w, h);
      }
    }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const emi = new THREE.CanvasTexture(e); emi.colorSpace = THREE.SRGBColorSpace;
  map.userData.shared = emi.userData.shared = true;
  const res = { map, emi };
  windowCache.set(key, res);
  return res;
}

function building(w, h, d, { seed = 1, style = 'office', color } = {}, ctx) {
  const floors = Math.max(1, Math.round(h / 3.4));
  const colsF = Math.max(2, Math.round(w / 2.4));
  const colsS = Math.max(2, Math.round(d / 2.4));
  const tf = windowTextures(colsF, floors, seed, style);
  const ts = windowTextures(colsS, floors, seed + 7, style);
  const side = new THREE.MeshStandardMaterial({ map: ts.map, emissiveMap: ts.emi, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.75 });
  const front = new THREE.MeshStandardMaterial({ map: tf.map, emissiveMap: tf.emi, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.6, metalness: 0.1 });
  const top = std(color || '#7d8189', 0.9);
  ctx.windowMats.push(side, front);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, front, front]);
  m.castShadow = true; m.receiveShadow = true;
  m.position.y = h / 2;
  return m;
}

function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 1.6 * s, 6), std('#5b4636'));
  trunk.position.y = 0.8 * s; trunk.castShadow = true;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 1), std('#3e6b45', 0.9));
  crown.position.y = 2.3 * s; crown.castShadow = true;
  crown.scale.y = 1.15;
  g.add(trunk, crown);
  g.position.set(x, 0, z);
  return g;
}

function streetLight(x, z, ctx, faceZ = -1) {
  const g = new THREE.Group();
  const mat = std('#3a3f47', 0.5, 0.6);
  g.add(box(0.18, 0.3, 0.18, std('#777', 0.9), 0, 0.15, 0));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7, 8), mat);
  pole.position.y = 3.5; pole.castShadow = true;
  const arm = box(0.06, 0.06, 1.6, mat, 0, 6.95, faceZ * 0.8);
  const head = box(0.35, 0.12, 0.6, mat, 0, 6.88, faceZ * 1.55);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
  ctx.lampMats.push(bulbMat);
  const bulb = box(0.28, 0.03, 0.5, bulbMat, 0, 6.8, faceZ * 1.55, false);
  g.add(pole, arm, head, bulb);
  const light = new THREE.PointLight('#ffcf8f', 0, 18, 2);
  light.position.set(0, 6.6, faceZ * 1.55);
  g.add(light);
  ctx.lampLights.push(light);
  g.position.set(x, 0, z);
  return g;
}

function roadTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2d3036'; g.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 3000; i++) { const v = 40 + Math.random() * 25; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(Math.random() * 1024, Math.random() * 128, 2, 2); }
  g.fillStyle = '#e8e2c8';
  for (let x = 0; x < 1024; x += 64) g.fillRect(x, 62, 36, 4);
  g.fillStyle = '#d9d9d9'; g.fillRect(0, 6, 1024, 3); g.fillRect(0, 119, 1024, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(12, 1); t.anisotropy = 8;
  return t;
}

function pavingTexture(color = '#bdb8b0') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- langit ----------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#6fa8dc') }, bottom: { value: new THREE.Color('#e8eef3') }, glowCol: { value: new THREE.Color('#ffffff') }, glowAmt: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 glowCol; uniform float glowAmt; varying vec3 vP;
      void main(){ float h = clamp(vP.y*1.6+0.08,0.0,1.0); vec3 c = mix(bottom, top, pow(h,0.75));
      float horizon = exp(-abs(vP.y)*9.0); c += glowCol*horizon*glowAmt; gl_FragColor = vec4(c,1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  m.renderOrder = -10;
  return m;
}

// ---------- konteks kota ----------
export function buildCity(ctx) {
  const g = new THREE.Group();
  g.name = 'city';
  // tanah
  const grassTex = pavingTexture('#8e8b85'); grassTex.repeat.set(60, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  ground.name = 'ground';
  g.add(ground);
  // jalan (z 7..14)
  const road = new THREE.Mesh(new THREE.PlaneGeometry(320, 7), new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 10.5); road.receiveShadow = true;
  g.add(road);
  // trotoar (z 4..7)
  const pav = pavingTexture('#aaa59c'); pav.repeat.set(160, 2);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(320, 0.15, 3), new THREE.MeshStandardMaterial({ map: pav, roughness: 0.9 }));
  walk.position.set(0, 0.075, 5.5); walk.receiveShadow = true;
  g.add(walk);
  const walk2 = walk.clone(); walk2.position.z = 15.5; g.add(walk2);
  // gedung latar belakang
  let x = -70;
  while (x < 70) {
    const w = 8 + rand() * 10, h = 8 + rand() * 30, d = 10 + rand() * 8;
    const b = building(w, h, d, { seed: Math.floor(rand() * 1000), style: rand() > 0.4 ? 'office' : 'res' }, ctx);
    b.position.x = x + w / 2; b.position.z = -32 - rand() * 18;
    g.add(b);
    x += w + 2 + rand() * 4;
  }
  x = -70;
  while (x < 70) {
    const w = 7 + rand() * 9, h = 6 + rand() * 18, d = 9;
    const b = building(w, h, d, { seed: Math.floor(rand() * 1000), style: 'res' }, ctx);
    b.position.set(x + w / 2, h / 2, 23 + d / 2);
    b.rotation.y = Math.PI;
    g.add(b);
    x += w + 3 + rand() * 5;
  }
  for (const tx of [-20, -8, 9, 21]) g.add(tree(tx, 4.6, 0.9 + rand() * 0.3));
  for (const tx of [-24, -12, 12, 24]) g.add(tree(tx, 16.4, 0.8 + rand() * 0.3));
  for (const lx of [-15, 15]) g.add(streetLight(lx, 6.6, ctx, 1));
  return g;
}

// ---------- dimensi struktur penempatan ----------
export function placementInfo(state) {
  const E = state.env;
  switch (state.placement) {
    case 'rooftop': {
      const H = 4.4 + Math.max(1, E.floors - 1) * 3.4;
      return { kind: 'roof', roofY: H, x: [-9, 9], z: [-14, 0], defaultPos: { x: 0, z: -1.0, y: 0 } };
    }
    case 'cafe':
      return { kind: 'roof', roofY: 4.4, x: [-6.5, 6.5], z: [-9, 0], defaultPos: { x: 0, z: -0.8, y: 0 } };
    case 'totem':
      return { kind: 'ground', x: [-14, 14], z: [-5, 6.5], defaultPos: { x: 4, z: 2.6, y: 0 } };
    case 'pole':
      return { kind: 'ground', x: [-14, 14], z: [4.3, 6.8], defaultPos: { x: 0, z: 5.6, y: 0 } };
    case 'wall':
    default: {
      return { kind: 'wall', w: state.wall.width, h: state.wall.height, defaultPos: { x: 0, y: Math.max(0.5, state.wall.height * 0.45), z: 0 } };
    }
  }
}

// ---------- struktur utama per penempatan ----------
export function buildHero(state, ctx, assets) {
  const g = new THREE.Group();
  g.name = 'hero';
  const info = placementInfo(state);
  if (state.placement === 'rooftop') {
    const H = info.roofY;
    const b = building(18, H, 14, { seed: 42, style: 'office', color: '#6f747c' }, ctx);
    b.position.set(0, H / 2, -7);
    g.add(b);
    // lobby kaca lantai dasar
    const glass = new THREE.MeshStandardMaterial({ color: '#1d2c3a', metalness: 0.6, roughness: 0.08 });
    g.add(box(10, 3.6, 0.1, glass, 0, 1.8, 0.03));
    g.add(box(12, 0.5, 2.2, std('#3a3f47', 0.6), 0, 4.0, 1.0));
    // parapet
    const pm = std('#8a8e95', 0.8);
    g.add(box(18.2, 0.9, 0.25, pm, 0, H + 0.45, 0.03));
    g.add(box(18.2, 0.9, 0.25, pm, 0, H + 0.45, -14.03));
    g.add(box(0.25, 0.9, 14, pm, -9.03, H + 0.45, -7));
    g.add(box(0.25, 0.9, 14, pm, 9.03, H + 0.45, -7));
    g.add(box(2.4, 1.2, 1.8, std('#9aa0a8'), 6, H + 0.6, -10));
    g.add(box(1.4, 1.6, 1.4, std('#9aa0a8'), -6, H + 0.8, -11));
  } else if (state.placement === 'cafe') {
    const H = info.roofY;
    const wallMat = std('#d6cbbb', 0.85);
    g.add(box(13, H, 9, wallMat, 0, H / 2, -4.5));
    const glass = new THREE.MeshStandardMaterial({ color: '#203040', metalness: 0.5, roughness: 0.05, emissive: new THREE.Color('#ffcf94'), emissiveIntensity: 0 });
    ctx.windowMats.push(glass);
    g.add(box(9, 2.7, 0.08, glass, -0.6, 1.55, 0.05));
    const frame = std('#2b2723', 0.5, 0.3);
    for (const fx of [-5.1, -2.1, 0.9, 3.9]) g.add(box(0.08, 2.8, 0.12, frame, fx, 1.5, 0.08));
    g.add(box(9.2, 0.08, 0.12, frame, -0.6, 2.9, 0.08));
    g.add(box(1.2, 2.4, 0.1, std('#4a3426', 0.6), 5.0, 1.2, 0.06));
    // kanopi
    const awn = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 1.6), std('#2d3b33', 0.7));
    awn.position.set(0, 3.25, 0.75); awn.rotation.x = 0.18; awn.castShadow = true;
    g.add(awn);
    g.add(box(13.2, 0.45, 0.2, std('#d9d1c4', 0.8), 0, H + 0.22, 0.02));
    // meja kursi
    for (const tx of [-4, -1, 2]) {
      g.add(box(0.7, 0.05, 0.7, std('#3b2f27', 0.6), tx, 0.75, 2.3));
      g.add(box(0.06, 0.75, 0.06, std('#222'), tx, 0.375, 2.3));
    }
    g.add(tree(-7.6, 2.2, 0.8));
  } else if (state.placement === 'totem') {
    const b = building(22, 9, 12, { seed: 9, style: 'res', color: '#7a7f86' }, ctx);
    b.position.set(-2, 4.5, -12);
    g.add(b);
    const plazaTex = pavingTexture('#cfc9bf'); plazaTex.repeat.set(12, 6);
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.9 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.012, -1.5); plaza.receiveShadow = true;
    g.add(plaza);
  } else if (state.placement === 'pole') {
    const b = building(16, 7.5, 10, { seed: 21, style: 'res', color: '#7a7f86' }, ctx);
    b.position.set(-6, 3.75, -6);
    g.add(b);
    const b2 = building(12, 11, 10, { seed: 77, style: 'office' }, ctx);
    b2.position.set(10, 5.5, -7);
    g.add(b2);
  } else if (state.placement === 'wall') {
    const W = state.wall.width, H = state.wall.height;
    let mat;
    if (assets.wallTex) {
      mat = new THREE.MeshStandardMaterial({ map: assets.wallTex, roughness: 0.9 });
    } else {
      const t = pavingTexture(state.wall.color); t.repeat.set(W / 2, H / 2);
      mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: t, roughness: 0.95 });
    }
    const edge = std('#8d8a85', 0.9);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.3), [edge, edge, edge, edge, mat, edge]);
    wall.position.set(0, H / 2, -0.15);
    wall.castShadow = true; wall.receiveShadow = true;
    wall.name = 'wall';
    g.add(wall);
    g.add(box(W + 0.1, 0.12, 0.4, std('#77736d'), 0, H + 0.06, -0.15));
  }
  return { group: g, info };
}

// ---------- rangka konstruksi besi ----------
export function buildConstruction(size, consH, color, frontZ = -0.05) {
  const g = new THREE.Group();
  g.name = 'construction';
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.5 });
  const t = 0.05;
  const W = size.w, H = size.h;
  const topY = consH + H * 0.92;
  const rearZ = frontZ - THREE.MathUtils.clamp(0.45 + (consH + H) * 0.35, 0.6, 2.4);
  const n = Math.max(2, Math.ceil(W / 1.5) + 1);
  const xs = Array.from({ length: n }, (_, i) => -W / 2 + 0.08 + (i / (n - 1)) * (W - 0.16));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const x of xs) {
    g.add(beam(V(x, 0, frontZ), V(x, topY, frontZ), t, mat));                   // kaki depan
    g.add(beam(V(x, 0, rearZ), V(x, consH + H * 0.45, rearZ), t, mat));       // kaki belakang
    g.add(beam(V(x, 0.06, frontZ), V(x, 0.06, rearZ), t, mat));                // balok dasar
    g.add(beam(V(x, consH + H * 0.45, rearZ), V(x, topY, frontZ), t * 0.85, mat)); // skur atas
    g.add(beam(V(x, 0.06, rearZ), V(x, consH + H * 0.2, frontZ), t * 0.85, mat));  // skur bawah
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.22), mat);
    plate.position.set(x, 0.008, frontZ); g.add(plate);
    const plate2 = plate.clone(); plate2.position.z = rearZ; g.add(plate2);
  }
  for (const y of [0.06, consH > 0.15 ? consH : null, consH + H * 0.5, topY - 0.02].filter((v) => v !== null)) {
    g.add(beam(V(-W / 2, y, frontZ), V(W / 2, y, frontZ), t, mat));
  }
  g.add(beam(V(-W / 2, 0.06, rearZ), V(W / 2, 0.06, rearZ), t, mat));
  g.add(beam(V(-W / 2, consH + H * 0.45, rearZ), V(W / 2, consH + H * 0.45, rearZ), t, mat));
  // silang belakang antar kaki
  for (let i = 0; i < xs.length - 1; i++) {
    g.add(beam(V(xs[i], 0.06, rearZ), V(xs[i + 1], consH + H * 0.45, rearZ), t * 0.7, mat));
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noPick = true; } });
  g.userData.frameArea = W * (consH + H);
  return g;
}

// ---------- totem & tiang ----------
export function buildTotem(size, height, color) {
  const g = new THREE.Group();
  const Wt = Math.max(size.w + 0.5, 1.2);
  const Ht = Math.max(height, size.h + 1.2);
  const Dt = Math.max(0.5, Math.min(1.2, size.w * 0.12 + 0.3));
  const body = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45 });
  g.add(box(Wt, Ht, Dt, body, 0, Ht / 2, 0));
  g.add(box(Wt + 0.3, 0.35, Dt + 0.3, std('#9a958e', 0.9), 0, 0.175, 0));
  const accent = new THREE.MeshStandardMaterial({ color: '#d6d9de', metalness: 0.9, roughness: 0.3 });
  g.add(box(Wt * 0.86, 0.04, 0.02, accent, 0, Ht - size.h - 0.6, Dt / 2 + 0.01));
  g.traverse((o) => { if (o.isMesh) o.userData.noPick = true; });
  return { group: g, signY: Ht - size.h - 0.35, frontZ: Dt / 2, height: Ht };
}

export function buildPole(size, height, color, isBox) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.45 });
  const r = THREE.MathUtils.clamp(size.w * 0.035, 0.08, 0.18);
  const topY = height + (isBox ? size.h * 0.5 : size.h * 0.25);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, topY, 16), mat);
  pole.position.y = topY / 2; pole.castShadow = true;
  g.add(pole);
  g.add(box(r * 5, 0.04, r * 5, mat, 0, 0.02, 0));
  g.add(box(r * 7, 0.2, r * 7, std('#9a958e', 0.9), 0, -0.05, 0));
  if (!isBox) {
    // lengan horizontal untuk huruf
    g.add(box(size.w * 0.9, 0.06, 0.06, mat, 0, height + 0.05, 0));
  }
  g.traverse((o) => { if (o.isMesh) o.userData.noPick = true; });
  return { group: g, signY: height };
}
