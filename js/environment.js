// Lingkungan 3D: langit, jalan, gedung latar, dan struktur penempatan signage
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
const FACADES = {
  office: ['#8d949e', '#a3a9b1', '#7c8590', '#b4b0a8', '#6f7884'],
  res: ['#c9bba8', '#b9aa98', '#d6cfc2', '#a99c8c', '#c4b6a0', '#9fa7a0'],
};
function windowTextures(cols, rows, seed, style = 'office') {
  const key = `${cols}x${rows}:${seed}:${style}`;
  if (windowCache.has(key)) return windowCache.get(key);
  const W = 512, H = Math.round(512 * (rows / cols) * 0.9);
  const c = document.createElement('canvas'); c.width = W; c.height = Math.min(Math.max(H, 64), 2048);
  const e = document.createElement('canvas'); e.width = c.width; e.height = c.height;
  const g = c.getContext('2d'), ge = e.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pal = FACADES[style] || FACADES.office;
  const base = pal[Math.floor(rnd() * pal.length)];
  g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
  // butiran beton / plester
  for (let i = 0; i < c.width * c.height / 60; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.04})` : `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
    g.fillRect(rnd() * c.width, rnd() * c.height, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  ge.fillStyle = '#000'; ge.fillRect(0, 0, e.width, e.height);
  const cw = c.width / cols, rh = c.height / rows;
  const ribbon = style === 'office' && rnd() > 0.45; // jendela pita kaca menerus
  for (let r = 0; r < rows; r++) {
    // pelat lantai
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, r * rh + rh - 3, c.width, 3);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, r * rh, c.width, 2);
    const ground = r === rows - 1 && style === 'res';
    for (let k = 0; k < cols; k++) {
      const wx = ribbon ? k * cw : k * cw + cw * 0.16;
      const ww = ribbon ? cw : cw * 0.68;
      const wy = r * rh + rh * (ground ? 0.12 : 0.2), wh = rh * (ground ? 0.8 : 0.58);
      const t = rnd();
      const glass = style === 'office' ? [38 + t * 30, 56 + t * 34, 76 + t * 34] : [44 + t * 22, 52 + t * 22, 60 + t * 22];
      const grd = g.createLinearGradient(0, wy, 0, wy + wh);
      grd.addColorStop(0, `rgb(${glass[0] + 40},${glass[1] + 44},${glass[2] + 48})`);
      grd.addColorStop(0.45, `rgb(${glass[0]},${glass[1]},${glass[2]})`);
      grd.addColorStop(1, `rgb(${glass[0] - 12},${glass[1] - 12},${glass[2] - 8})`);
      g.fillStyle = grd; g.fillRect(wx, wy, ww, wh);
      // kusen & mullion
      g.strokeStyle = style === 'office' ? 'rgba(30,34,40,0.9)' : 'rgba(245,242,236,0.9)';
      g.lineWidth = 2; g.strokeRect(wx + 1, wy + 1, ww - 2, wh - 2);
      g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.stroke();
      if (!ribbon && !ground) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 2, wy + wh, ww + 4, 3); } // ambang jendela
      // tirai sebagian
      if (rnd() > 0.7) { g.fillStyle = `rgba(${200 + t * 40},${190 + t * 30},170,0.55)`; g.fillRect(wx + 2, wy + 2, ww - 4, wh * (0.2 + rnd() * 0.5)); }
      if (ground) { g.fillStyle = ['#7a2f2f', '#2f5a7a', '#3d6b3d', '#8a6a2a'][Math.floor(rnd() * 4)]; g.fillRect(wx - cw * 0.08, wy - rh * 0.1, ww + cw * 0.16, rh * 0.09); }
      if (rnd() > (ground ? 0.25 : 0.45)) {
        const warm = rnd() > 0.3;
        const a = 0.55 + rnd() * 0.45;
        ge.fillStyle = warm ? `rgba(255,${190 + rnd() * 40},${120 + rnd() * 50},${a})` : `rgba(200,225,255,${a})`;
        ge.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      }
    }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const emi = new THREE.CanvasTexture(e); emi.colorSpace = THREE.SRGBColorSpace;
  map.userData.shared = emi.userData.shared = true;
  const res = { map, emi, base };
  windowCache.set(key, res);
  return res;
}

// ---------- tekstur prosedural ----------
const texCache = new Map();
function cachedTex(key, make) {
  if (!texCache.has(key)) { const t = make(); t.userData.shared = true; texCache.set(key, t); }
  return texCache.get(key).clone();
}
function noiseCanvas(size, base, amt = 0.06, speck = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size / 14 * speck; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${Math.random() * amt})` : `rgba(0,0,0,${Math.random() * amt * 1.3})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  return [c, g];
}
function toTex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8;
  return t;
}
/** Plester / beton halus untuk dinding. */
export function plasterTexture(color) {
  const [c, g] = noiseCanvas(512, color, 0.05, 1.4);
  for (let i = 0; i < 40; i++) { // noda halus
    const x = Math.random() * 512, y = Math.random() * 512, r = 20 + Math.random() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(0,0,0,${Math.random() * 0.035})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return toTex(c);
}
function brickTexture(color = '#a4553f') {
  return cachedTex('brick' + color, () => {
    const [c, g] = noiseCanvas(512, '#cfc6b8', 0.04);
    const bw = 64, bh = 24;
    for (let r = 0; r < 512 / bh; r++) {
      for (let k = -1; k < 512 / bw + 1; k++) {
        const x = k * bw + (r % 2 ? bw / 2 : 0), y = r * bh;
        const col = new THREE.Color(color).offsetHSL(0, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.1);
        g.fillStyle = `#${col.getHexString()}`;
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 2, y + 2, bw - 4, 3);
      }
    }
    return toTex(c);
  });
}
function asphaltTexture() {
  return cachedTex('asphalt', () => {
    const [c] = noiseCanvas(256, '#33363b', 0.09, 2);
    return toTex(c);
  });
}
function grassTexture() {
  return cachedTex('grass', () => {
    const [c, g] = noiseCanvas(256, '#5d7a45', 0.1, 2);
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(${60 + Math.random() * 60},${100 + Math.random() * 60},${40 + Math.random() * 30},0.5)`; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 3); }
    return toTex(c);
  });
}

function building(w, h, d, { seed = 1, style = 'office', color, roof = true } = {}, ctx) {
  const floors = Math.max(1, Math.round(h / 3.4));
  const colsF = Math.max(2, Math.round(w / 2.4));
  const colsS = Math.max(2, Math.round(d / 2.4));
  const tf = windowTextures(colsF, floors, seed, style);
  const ts = windowTextures(colsS, floors, seed + 7, style);
  const side = new THREE.MeshStandardMaterial({ map: ts.map, emissiveMap: ts.emi, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.78 });
  const front = new THREE.MeshStandardMaterial({ map: tf.map, emissiveMap: tf.emi, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.55, metalness: 0.12 });
  const top = std(color || '#6e7177', 0.92);
  ctx.windowMats.push(side, front);
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, front, front]);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  if (roof) {
    const n0 = g.children.length;
    // parapet + peralatan atap
    const pm = std(new THREE.Color(tf.base).multiplyScalar(0.82), 0.9);
    const ph = 0.7;
    g.add(box(w + 0.1, ph, 0.18, pm, 0, h / 2 + ph / 2, d / 2 - 0.05));
    g.add(box(w + 0.1, ph, 0.18, pm, 0, h / 2 + ph / 2, -d / 2 + 0.05));
    g.add(box(0.18, ph, d, pm, w / 2 - 0.05, h / 2 + ph / 2, 0));
    g.add(box(0.18, ph, d, pm, -w / 2 + 0.05, h / 2 + ph / 2, 0));
    let r = seed;
    const rr = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const eq = std('#9ca2a9', 0.6, 0.4);
    const n = 1 + Math.floor(rr() * 3);
    for (let i = 0; i < n; i++) {
      const ew = 1 + rr() * 1.6, eh = 0.8 + rr() * 1.2, ed = 1 + rr() * 1.2;
      g.add(box(ew, eh, ed, eq, (rr() - 0.5) * (w - ew - 1), h / 2 + eh / 2, (rr() - 0.5) * (d - ed - 1)));
    }
    if (rr() > 0.5) { // tangki air
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 16), std('#d7d9dc', 0.5, 0.3));
      tank.position.set((rr() - 0.5) * (w - 3), h / 2 + 1.7, (rr() - 0.5) * (d - 3)); tank.castShadow = true;
      g.add(tank);
      g.add(box(1.6, 1, 1.6, std('#55595f', 0.6, 0.5), tank.position.x, h / 2 + 0.5, tank.position.z));
    }
    g.children.slice(n0 + 4).forEach((o) => { o.userData.detail = true; });
  }
  g.position.y = h / 2;
  return g;
}

const LEAF = ['#3f6b3c', '#4d7a40', '#36603a', '#5a8445'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
const BARK = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.95 });
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.13 * s, 1.9 * s, 7), BARK);
  trunk.position.y = 0.95 * s; trunk.castShadow = true;
  g.add(trunk);
  const blobs = [[0, 2.5, 0, 1.05], [0.6, 2.2, 0.2, 0.75], [-0.55, 2.25, -0.15, 0.8], [0.1, 3.05, -0.1, 0.75], [-0.2, 2.1, 0.55, 0.65]];
  for (const [bx, by, bz, br] of blobs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(br * s, 1), LEAF[Math.floor(rand() * LEAF.length)]);
    m.position.set(bx * s, by * s, bz * s); m.rotation.set(rand() * 3, rand() * 3, 0);
    m.castShadow = true;
    g.add(m);
  }
  // lubang pohon di trotoar
  g.add(box(1.0 * s, 0.04, 1.0 * s, std('#4a3b30', 1), 0, 0.17, 0, false));
  g.position.set(x, 0, z);
  g.rotation.y = rand() * Math.PI;
  return g;
}

const CAR_COLORS = ['#e9e9ea', '#1b1d22', '#9aa0a7', '#a3242b', '#2a4f86', '#d8d2c4', '#4a4f57'];
function car(x, z, rotY, ctx, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: color || CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)], metalness: 0.6, roughness: 0.32 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1a2129', metalness: 0.4, roughness: 0.1 });
  const dark = std('#15171a', 0.7);
  const body = new THREE.Mesh(new RoundedBoxGeometry(4.3, 0.75, 1.82, 3, 0.2), paint);
  body.position.y = 0.62; body.castShadow = true; body.receiveShadow = true;
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.62, 1.6, 3, 0.22), glass);
  cabin.position.set(-0.25, 1.22, 0); cabin.castShadow = true;
  const roofM = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.08, 1.5, 2, 0.04), paint);
  roofM.position.set(-0.3, 1.54, 0);
  g.add(body, cabin, roofM);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16); wheelGeo.rotateX(Math.PI / 2);
  const rimMat = std('#b8bcc2', 0.3, 0.8);
  for (const [wx, wz] of [[1.35, 0.82], [1.35, -0.82], [-1.35, 0.82], [-1.35, -0.82]]) {
    const w = new THREE.Mesh(wheelGeo, dark); w.position.set(wx, 0.34, wz); w.castShadow = true; g.add(w);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12).rotateX(Math.PI / 2), rimMat);
    rim.position.set(wx, 0.34, wz + Math.sign(wz) * 0.125); g.add(rim);
  }
  const head = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#fff2d6'), emissiveIntensity: 0 });
  const tail = new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: new THREE.Color('#ff2020'), emissiveIntensity: 0 });
  for (const sz of [0.6, -0.6]) {
    g.add(box(0.05, 0.14, 0.38, head, 2.14, 0.72, sz, false));
    g.add(box(0.05, 0.12, 0.34, tail, -2.14, 0.74, sz, false));
  }
  g.add(box(0.06, 0.16, 1.3, dark, 2.16, 0.42, 0, false));
  g.position.set(x, 0, z); g.rotation.y = rotY;
  g.userData.detail = true;
  return g;
}

function bench(x, z, rotY = 0) {
  const g = new THREE.Group();
  const wood = std('#8a6a4a', 0.8), metal = std('#2b2e33', 0.5, 0.6);
  for (let i = 0; i < 3; i++) g.add(box(1.6, 0.04, 0.12, wood, 0, 0.45, -0.15 + i * 0.15));
  for (let i = 0; i < 2; i++) g.add(box(1.6, 0.12, 0.04, wood, 0, 0.65 + i * 0.16, -0.24));
  for (const lx of [-0.7, 0.7]) { g.add(box(0.05, 0.45, 0.4, metal, lx, 0.225, -0.05)); g.add(box(0.05, 0.4, 0.05, metal, lx, 0.65, -0.24)); }
  g.position.set(x, 0.15, z); g.rotation.y = rotY;
  g.userData.detail = true;
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
  g.fillStyle = '#2f3237'; g.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 45; g.fillStyle = `rgba(${v},${v},${v + 4},${0.3 + Math.random() * 0.4})`; g.fillRect(Math.random() * 1024, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(Math.random() * 1024, 20 + Math.random() * 90, 30 + Math.random() * 80, 6 + Math.random() * 10); }
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
  for (let i = 0; i < 4000; i++) { g.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${Math.random() * 0.07})` : `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) { if (Math.random() > 0.7) { g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`; g.fillRect(k * 64 + 2, j * 64 + 2, 60, 60); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- langit ----------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#6fa8dc') }, bottom: { value: new THREE.Color('#e8eef3') }, glowCol: { value: new THREE.Color('#ffffff') }, glowAmt: { value: 0 },
      sunDir: { value: new THREE.Vector3(0.5, 0.6, 0.5).normalize() }, sunCol: { value: new THREE.Color('#fff4e2') }, sunAmt: { value: 1 },
      cloudCol: { value: new THREE.Color('#ffffff') }, cloudAmt: { value: 0.6 }, stars: { value: 0 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 glowCol; uniform float glowAmt;
      uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt; uniform vec3 cloudCol; uniform float cloudAmt; uniform float stars;
      varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y*1.6+0.08,0.0,1.0);
        vec3 c = mix(bottom, top, pow(h,0.75));
        float horizon = exp(-abs(d.y)*9.0); c += glowCol*horizon*glowAmt;
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(sd, 900.0)*3.0 + pow(sd, 12.0)*0.25) * sunAmt;
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12) * 1.3;
          float n = fbm(uv + vec2(3.1, 1.7));
          float cl = smoothstep(0.52, 0.78, n) * cloudAmt * smoothstep(0.0, 0.18, d.y);
          vec3 cc = mix(cloudCol, cloudCol*0.72, smoothstep(0.6, 0.9, n)) + sunCol*pow(sd,6.0)*0.25*sunAmt;
          c = mix(c, cc, cl);
          vec2 sp = d.xz / (d.y + 0.3) * 160.0;
          float st = step(0.9975, hash(floor(sp))) * smoothstep(0.05, 0.4, d.y) * (1.0 - cl);
          c += vec3(st) * stars;
        }
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  m.renderOrder = -10;
  return m;
}

// ---------- konteks kota ----------
export function buildCity(ctx) {
  const g = new THREE.Group();
  g.name = 'city';
  // tanah: rumput di kejauhan, paving di area utama
  const grass = grassTexture(); grass.repeat.set(70, 70);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true;
  ground.name = 'ground';
  g.add(ground);
  const lotTex = pavingTexture('#9d9890'); lotTex.repeat.set(40, 10);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(160, 40), new THREE.MeshStandardMaterial({ map: lotTex, roughness: 0.92 }));
  lot.rotation.x = -Math.PI / 2; lot.position.set(0, 0.001, -16); lot.receiveShadow = true;
  g.add(lot);
  const lot2 = lot.clone(); lot2.position.z = 30; g.add(lot2);
  // jalan (z 7..14)
  const road = new THREE.Mesh(new THREE.PlaneGeometry(320, 7), new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.88 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 10.5); road.receiveShadow = true;
  g.add(road);
  // zebra cross
  const zebra = std('#e9e6dc', 0.8);
  for (let i = 0; i < 9; i++) g.add(box(0.45, 0.012, 3, zebra, -26 + i * 0.85 - 3.4, 0.016, 10.5, false));
  // trotoar + kanstin (z 4..7 dan 14..17)
  const pav = pavingTexture('#b3aea5'); pav.repeat.set(160, 2);
  const walkMat = new THREE.MeshStandardMaterial({ map: pav, roughness: 0.9 });
  const curb = std('#cfccc6', 0.85);
  for (const [z, cz] of [[5.5, 6.95], [15.5, 14.05]]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(320, 0.15, 3), walkMat);
    w.position.set(0, 0.075, z); w.receiveShadow = true; g.add(w);
    const c = box(320, 0.18, 0.18, curb, 0, 0.09, cz, false); c.receiveShadow = true; g.add(c);
  }
  // tutup gorong-gorong
  const manMat = std('#3a3c40', 0.6, 0.5);
  for (const mx of [-18, 6, 30]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.02, 20), manMat); m.position.set(mx, 0.02, 9.2); g.add(m); }
  // gedung latar belakang
  let x = -75;
  while (x < 75) {
    const w = 8 + rand() * 10, h = 8 + rand() * 32, d = 10 + rand() * 8;
    const b = building(w, h, d, { seed: Math.floor(rand() * 1000), style: rand() > 0.4 ? 'office' : 'res' }, ctx);
    b.position.x = x + w / 2; b.position.z = -32 - rand() * 18;
    g.add(b);
    x += w + 2 + rand() * 4;
  }
  x = -75;
  while (x < 75) {
    const w = 7 + rand() * 9, h = 6 + rand() * 18, d = 9;
    const b = building(w, h, d, { seed: Math.floor(rand() * 1000), style: 'res' }, ctx);
    b.position.set(x + w / 2, h / 2, 23 + d / 2);
    b.rotation.y = Math.PI;
    g.add(b);
    x += w + 3 + rand() * 5;
  }
  for (const tx of [-21, -9, 10, 22, -33, 34]) g.add(tree(tx, 4.6, 0.9 + rand() * 0.3));
  for (const tx of [-24, -12, 12, 24, 36]) g.add(tree(tx, 16.4, 0.8 + rand() * 0.3));
  for (const lx of [-15, 15, -40, 40]) g.add(streetLight(lx, 6.6, ctx, 1));
  for (const lx of [-34, 34]) g.add(streetLight(lx, 16.6, ctx, -1));
  // mobil parkir & melintas
  for (const [cx, cz, r] of [[-12, 8.3, 0], [-31, 8.3, 0], [21, 8.3, Math.PI], [7, 12.6, Math.PI], [-44, 12.6, 0], [41, 8.3, 0]]) g.add(car(cx, cz, r, ctx));
  // bangku & bollard
  g.add(bench(-16.5, 4.5)); g.add(bench(17.5, 4.5));
  g.add(bench(-5, 16.6, Math.PI));
  const bol = std('#30343a', 0.5, 0.6);
  for (let bx = -7; bx <= 7; bx += 2.8) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.8, 10), bol); b.position.set(bx, 0.55, 6.75); b.castShadow = true; b.userData.detail = true; g.add(b); }
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
    const b = building(18, H, 14, { seed: 42, style: 'office', color: '#6f747c', roof: false }, ctx);
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
    const wt = plasterTexture('#d6cbbb'); wt.repeat.set(2, 1);
    const wallMat = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9 });
    g.add(box(13, H, 9, wallMat, 0, H / 2, -4.5));
    const bt = brickTexture('#9c4f3a'); bt.repeat.set(4, 0.6);
    const brick = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.92 });
    g.add(box(2.4, 2.9, 0.12, brick, 5.0 + 0.6, 1.45, 0.02));
    g.add(box(13.02, 0.45, 9.02, brick, 0, 0.225, -4.5));
    // pot tanaman
    const pot = std('#3a3632', 0.7);
    for (const px of [-5.6, 3.9]) {
      g.add(box(0.7, 0.6, 0.7, pot, px, 0.3, 0.75));
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), LEAF[1]); bush.position.set(px, 0.95, 0.75); bush.castShadow = true; g.add(bush);
    }
    // lampu gantung kanopi (ikut menyala malam)
    const warm = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#ffc98a'), emissiveIntensity: 0 });
    ctx.windowMats.push(warm);
    for (const lx of [-4, -1, 2]) g.add(box(0.2, 0.2, 0.2, warm, lx, 2.95, 1.1, false));
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
    const seat = std('#2a2a2a', 0.6, 0.4), top = std('#3b2f27', 0.6);
    for (const tx of [-4, -1, 2]) {
      const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 20), top); tbl.position.set(tx, 0.75, 2.3); tbl.castShadow = true; g.add(tbl);
      g.add(box(0.06, 0.75, 0.06, std('#222'), tx, 0.375, 2.3));
      for (const sx of [-0.65, 0.65]) {
        g.add(box(0.42, 0.04, 0.42, seat, tx + sx, 0.46, 2.3));
        g.add(box(0.04, 0.46, 0.04, seat, tx + sx, 0.23, 2.3));
        g.add(box(0.04, 0.42, 0.42, seat, tx + sx * 1.3, 0.68, 2.3));
      }
    }
    // payung
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.45, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.9, side: THREE.DoubleSide }));
    umb.position.set(-2.5, 2.45, 3.3); umb.castShadow = true; g.add(umb);
    g.add(box(0.05, 2.3, 0.05, std('#222'), -2.5, 1.15, 3.3));
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
      const t = plasterTexture(state.wall.color); t.repeat.set(Math.max(1, W / 4), Math.max(1, H / 4));
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
