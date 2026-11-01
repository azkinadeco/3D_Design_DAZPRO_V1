// Lingkungan 3D: langit, jalan, gedung latar, dan struktur penempatan signage
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as P from './props.js';

// ---------- util ----------
const rnd = P.rnd;
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
  g.userData.wheels = [];
  for (const [wx, wz] of [[1.35, 0.82], [1.35, -0.82], [-1.35, 0.82], [-1.35, -0.82]]) {
    const w = new THREE.Mesh(wheelGeo, dark); w.position.set(wx, 0.34, wz); w.castShadow = true; g.add(w); g.userData.wheels.push(w);
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

const SKIN = ['#e0b48f', '#c99a72', '#a87656', '#f0c9a6'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
const CLOTH = ['#2f5bff', '#e11d2e', '#1f2937', '#f5f5f4', '#16a34a', '#f59e0b', '#7c3aed', '#64748b'];
function person(x, z, rotY = 0) {
  const g = new THREE.Group();
  const shirt = std(CLOTH[Math.floor(rand() * CLOTH.length)], 0.8), pants = std(['#1f2430', '#3b3f46', '#2a3550', '#5b4a3a'][Math.floor(rand() * 4)], 0.85);
  const s = 0.92 + rand() * 0.16;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), shirt); torso.position.y = 1.18;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), SKIN[Math.floor(rand() * SKIN.length)]); head.position.y = 1.62;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#1d1a17', 0.9)); hair.position.y = 1.64;
  const lL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.62, 4, 8), pants); lL.position.set(-0.08, 0.42, 0);
  const lR = lL.clone(); lR.position.x = 0.08;
  const aL = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.46, 4, 8), shirt); aL.position.set(-0.24, 1.12, 0); aL.rotation.z = 0.08;
  const aR = aL.clone(); aR.position.x = 0.24; aR.rotation.z = -0.08;
  g.add(torso, head, hair, lL, lR, aL, aR);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(s);
  g.position.set(x, 0.15, z); g.rotation.y = rotY;
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
  // mobil melintas (bergerak, hanya kualitas tinggi)
  const movers = [];
  for (const [cx, cz, r, sp] of [[-60, 9.7, 0, 7.5], [25, 11.4, Math.PI, -6.5], [70, 11.4, Math.PI, -8]]) {
    const c = car(cx, cz, r, ctx); c.userData.speed = sp; movers.push(c); g.add(c);
  }
  g.userData.movers = movers;
  // pejalan kaki
  for (const [px, pz, r] of [[-19, 5.2, 0.6], [-18.4, 5.6, -2.4], [13, 5.0, 1.2], [26, 5.6, -0.4], [-8, 15.8, 3.0], [19, 16.1, 2.5], [-29, 15.6, 0.3]]) g.add(person(px, pz, r));
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
    case 'mall': {
      const W = E.mallW || 6;
      return { kind: 'wall', w: W, h: 4.4, yMin: 2.95, mall: true, defaultPos: { x: 0, y: 3.2, z: 0 } };
    }
    case 'booth': {
      const L = E.boothL || 6, Wd = E.boothW || 2.4;
      return { kind: 'roof', roofY: 2.75, x: [-L / 2, L / 2], z: [-Wd, 0], zr: [-Wd + 0.35, -0.12], edge: 0.1, defaultPos: { x: 0, z: -0.3, y: 0 } };
    }
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
    // lobby kaca double-height + kanopi kantilever
    const glass = new THREE.MeshPhysicalMaterial({ color: '#7f97a8', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.35 });
    g.add(box(10, 3.6, 0.06, glass, 0, 1.8, 0.05, false));
    const mull = std('#2b2e33', 0.4, 0.7);
    for (let i = 0; i <= 8; i++) g.add(box(0.06, 3.6, 0.1, mull, -5 + i * 1.25, 1.8, 0.06));
    const lobbyWarm = new THREE.MeshStandardMaterial({ color: '#efe6d8', emissive: new THREE.Color('#ffe2b8'), emissiveIntensity: 0, roughness: 0.8 });
    ctx.windowMats.push(lobbyWarm);
    g.add(box(9.9, 3.5, 0.02, lobbyWarm, 0, 1.8, 0.015, false));
    const canopy = new THREE.Mesh(new RoundedBoxGeometry(12, 0.35, 3.2, 2, 0.08), std('#e9e6e1', 0.6)); canopy.position.set(0, 4.0, 1.5); canopy.castShadow = true; g.add(canopy);
    const strip = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#fff2dc'), emissiveIntensity: 0 });
    ctx.lampMats.push(strip);
    g.add(box(11.6, 0.03, 0.1, strip, 0, 3.82, 3.0, false));
    for (const x of [-5.4, 5.4]) g.add(P.cyl(0.14, 0.14, 3.85, std('#c8ccd2', 0.25, 0.9), x, 1.92, 2.8, 20));
    // pita kaca vertikal di fasad (curtain wall)
    const cw = new THREE.MeshPhysicalMaterial({ color: '#5d7a92', metalness: 0.5, roughness: 0.06 });
    for (const x of [-7.6, 7.6]) g.add(box(1.6, H - 4.6, 0.12, cw, x, 4.6 + (H - 4.6) / 2, 0.05));
    // parapet
    const pm = std('#8a8e95', 0.8);
    g.add(box(18.2, 0.9, 0.25, pm, 0, H + 0.45, 0.03));
    g.add(box(18.2, 0.9, 0.25, pm, 0, H + 0.45, -14.03));
    g.add(box(0.25, 0.9, 14, pm, -9.03, H + 0.45, -7));
    g.add(box(0.25, 0.9, 14, pm, 9.03, H + 0.45, -7));
    // peralatan atap: AC chiller, tangki air, antena, panel surya
    const eq = std('#9aa0a8', 0.6, 0.4);
    for (let i = 0; i < 3; i++) { g.add(box(1.6, 1.1, 1.2, eq, 4 + i * 1.8, H + 0.55, -11)); g.add(P.detail(P.cyl(0.45, 0.45, 0.05, std('#2b2e33', 0.5), 4 + i * 1.8, H + 1.13, -11, 16))); }
    const tank = P.cyl(0.9, 0.9, 1.8, std('#d7d9dc', 0.5, 0.3), -6, H + 1.3, -11, 20); g.add(tank);
    g.add(box(2.2, 0.4, 2.2, std('#55595f', 0.6, 0.5), -6, H + 0.2, -11));
    g.add(P.detail(P.cyl(0.04, 0.06, 5, std('#c8ccd2', 0.3, 0.8), -7.5, H + 2.5, -12.8, 8)));
    const solar = new THREE.MeshStandardMaterial({ color: '#1b2a4a', metalness: 0.6, roughness: 0.2 });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { const sp = box(1.6, 0.04, 1, solar, -6 + c * 1.8, H + 0.45, -7.5 - r * 1.3); sp.rotation.x = -0.35; g.add(P.detail(sp)); }
    // taman depan, tiang bendera, parkir
    for (const x of [-7, 7]) { const h = P.hedge(4.2); h.position.set(x, 0.15, 3.6); g.add(h); }
    [['#e11d2e', -9.5], ['#ffffff', -10.6], ['#1f4fa8', -11.7]].forEach(([c, x]) => { const f = P.flagPole(c, 7.5); f.position.set(x, 0.15, 3.4); g.add(f); });
    const ps = P.trafficSign('P'); ps.position.set(10.5, 0.15, 3.6); g.add(ps);
    const visitor = P.human({ pose: 'walk' }); visitor.position.set(-2.2, 0.15, 3.2); visitor.rotation.y = Math.PI; g.add(visitor);
    const v2 = P.human({ pose: 'stand', bag: true }); v2.position.set(2.8, 0.15, 2.4); v2.rotation.y = -2.6; g.add(v2);
  } else if (state.placement === 'cafe') {
    const H = info.roofY;
    const wt = plasterTexture('#d6cbbb'); wt.repeat.set(2, 1);
    const wallMat = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9 });
    // cangkang bangunan (depan berlubang untuk etalase kaca)
    g.add(box(13, H, 0.2, wallMat, 0, H / 2, -9 + 0.1));
    g.add(box(0.2, H, 9, wallMat, -6.4, H / 2, -4.5));
    g.add(box(0.2, H, 9, wallMat, 6.4, H / 2, -4.5));
    g.add(box(13, 0.25, 9, wallMat, 0, H - 0.125, -4.5));
    g.add(box(13, H - 2.95, 0.2, wallMat, 0, 2.95 + (H - 2.95) / 2, -0.1));
    g.add(box(1.25, 2.95, 0.2, wallMat, -5.775, 1.475, -0.1));
    g.add(box(2.5, 2.95, 0.2, wallMat, 5.15, 1.475, -0.1));
    g.add(box(12.6, 0.05, 4.6, std('#efe9df', 0.9), 0, 2.93, -2.4, false));
    g.add(box(12.6, 2.95, 0.15, wallMat, 0, 1.475, -4.25, false));
    const bt = brickTexture('#9c4f3a'); bt.repeat.set(4, 0.6);
    const brick = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.92 });
    g.add(box(2.4, 2.9, 0.12, brick, 5.0 + 0.6, 1.45, 0.02));
    g.add(box(13.02, 0.45, 0.3, brick, 0, 0.225, 0.02));
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
    const glass = new THREE.MeshPhysicalMaterial({ color: '#9fb6c2', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false });
    g.add(box(9, 2.7, 0.04, glass, -0.6, 1.55, 0.05, false));
    const frame = std('#2b2723', 0.5, 0.3);
    for (const fx of [-5.1, -2.1, 0.9, 3.9]) g.add(box(0.08, 2.8, 0.12, frame, fx, 1.5, 0.08));
    g.add(box(9.2, 0.08, 0.12, frame, -0.6, 2.9, 0.08));
    g.add(box(1.2, 2.4, 0.1, std('#4a3426', 0.6), 5.0, 1.2, 0.06));
    // kanopi
    const awn = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 1.6), std('#2d3b33', 0.7));
    awn.position.set(0, 3.25, 0.75); awn.rotation.x = 0.18; awn.castShadow = true;
    g.add(awn);
    g.add(box(13.2, 0.45, 0.2, std('#d9d1c4', 0.8), 0, H + 0.22, 0.02));
    // teras: meja, pengunjung, pelayan, menu, lampu gantung
    [[-4, 2.3, true], [-1, 2.3, false], [2, 2.3, true], [-2.6, 3.5, false]].forEach(([tx, tz, people], i) => {
      const t = P.cafeTable(i === 3, '#efe6d6'); t.position.set(tx, 0, tz); g.add(i === 3 ? P.detail(t) : t);
      if (people) { const sg = P.seatedGroup(2); sg.position.set(tx, 0, tz); g.add(sg); }
    });
    const waiter = P.human({ pose: 'stand', shirt: '#1d1d1f', pants: '#1d1d1f', apron: true }); waiter.position.set(3.6, 0, 1.6); waiter.rotation.y = -0.6; g.add(waiter);
    const menu = P.aFrameMenu(); menu.position.set(4.6, 0, 3.1); menu.rotation.y = -0.3; g.add(menu);
    const sl = []; for (let i = 0; i <= 10; i++) { const x = -5.4 + i * 1.08; sl.push(new THREE.Vector3(x, 3.02 - Math.sin((i % 2 ? 1 : 0) * Math.PI / 2) * 0.12 - (i % 2) * 0.1, 1.5)); }
    g.add(P.detail(P.stringLights(sl, ctx)));
    for (const [mx, mc] of [[6.6, '#c81e1e'], [7.5, '#111111'], [8.4, '#1f4fa8']]) { const m = P.motorbike(mc); m.position.set(mx, 0.15, 5.3); m.rotation.y = Math.PI / 2; g.add(m); }
    const pot2 = P.plantPot(1.3, '#3a3632'); pot2.position.set(-6.2, 0, 1.4); g.add(pot2);
    // interior kafe terlihat dari kaca
    g.add(box(11, 0.02, 4, std('#7a5a3e', 0.6), -0.5, 0.02, -2.1, false));
    const bar = new THREE.Group();
    bar.add(box(4.2, 1.05, 0.7, std('#2f2620', 0.5), 0, 0.525, 0));
    bar.add(box(4.3, 0.05, 0.8, std('#d8cfc2', 0.3), 0, 1.07, 0));
    const cb = P.coffeeBar(4, ctx); cb.position.set(0, 1.1, 0); bar.add(cb);
    bar.position.set(-1, 0, -3.2); g.add(bar);
    const mb = P.menuBoard(2.2, 1.1); mb.position.set(-1, 2.0, -4.0); g.add(mb);
    const backWarm = new THREE.MeshStandardMaterial({ color: '#d8c2a3', emissive: new THREE.Color('#ffcf94'), emissiveIntensity: 0, roughness: 0.9 });
    ctx.windowMats.push(backWarm);
    g.add(box(11, 2.9, 0.05, backWarm, -0.5, 1.45, -4.1, false));
    for (const lx of [-3.5, -1, 1.5]) { const pl = P.pendantLamp(ctx, 0.7); pl.position.set(lx, 2.9, -1.4); g.add(pl); }
    const barista = P.human({ pose: 'stand', shirt: '#f4efe6', apron: true }); barista.position.set(-1.6, 0, -3.8); g.add(barista);
    const guest = P.human({ pose: 'stand' }); guest.position.set(0.6, 0, -2.4); guest.rotation.y = Math.PI; g.add(guest);
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
    // deretan ruko 2 lantai khas Indonesia di belakang tiang
    const cols = ['#e9e1d3', '#d7e3e0', '#f1dcc4', '#dfe0ea', '#efe8d8'];
    const awn = ['#c81e1e', '#1f5fa8', '#2f7d4a', '#d97706', '#6b21a8'];
    const names = ['TOKO MAKMUR', 'APOTEK SEHAT', 'BENGKEL JAYA', 'BAKERY', 'LAUNDRY'];
    for (let i = 0; i < 5; i++) {
      const r = ruko(4.6, cols[i], awn[i], names[i], ctx);
      r.position.set(-11.5 + i * 4.8, 0, -1.6);
      g.add(r);
    }
    for (const [mx, mc] of [[-9.5, '#111111'], [-8.7, '#c81e1e'], [2.6, '#1f4fa8'], [3.4, '#f4f4f4'], [8.9, '#2f7d4a']]) { const m = P.motorbike(mc); m.position.set(mx, 0, 2.2); m.rotation.y = Math.PI / 2; g.add(m); }
    const sgn = P.trafficSign('X'); sgn.position.set(-13.6, 0.15, 6.6); g.add(sgn);
    for (const [px, pz, r, pose] of [[-6.2, 0.4, 0.3, 'stand'], [5.5, 0.6, -0.4, 'stand'], [-1.8, 3.0, 1.5, 'walk'], [10.2, 3.2, -1.6, 'walk']]) { const h = P.human({ pose, bag: rnd() > 0.5 }); h.position.set(px, 0, pz); h.rotation.y = r; g.add(h); }
    const b2 = building(12, 11, 10, { seed: 77, style: 'office' }, ctx);
    b2.position.set(18, 5.5, -9);
    g.add(b2);
  } else if (state.placement === 'mall') {
    buildMall(g, state, ctx);
  } else if (state.placement === 'booth') {
    buildBooth(g, state, ctx);
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

// ---------- ruko (rumah toko) ----------
function ruko(w, color, awnColor, name, ctx) {
  const g = new THREE.Group();
  const H = 7.6, d = 9;
  const wt = plasterTexture(color); wt.repeat.set(1, 1.5);
  const wall = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9 });
  g.add(box(w, H, 0.25, wall, 0, H / 2, -0.12));                       // fasad (lantai dasar dipotong oleh rolling door)
  g.add(box(w, H, d, std(new THREE.Color(color).multiplyScalar(0.85), 0.9), 0, H / 2, -d / 2 - 0.25));
  // rolling door setengah terbuka + toko di dalam
  const rd = document.createElement('canvas'); rd.width = 64; rd.height = 256;
  const x = rd.getContext('2d'); for (let y = 0; y < 256; y += 8) { x.fillStyle = y % 16 ? '#9aa0a6' : '#b8bdc3'; x.fillRect(0, y, 64, 8); }
  const rt = new THREE.CanvasTexture(rd); rt.colorSpace = THREE.SRGBColorSpace;
  g.add(box(w - 0.8, 1.1, 0.05, new THREE.MeshStandardMaterial({ map: rt, roughness: 0.5, metalness: 0.6 }), 0, 2.85, 0.04, false));
  const shop = new THREE.MeshStandardMaterial({ color: '#efe6d6', emissive: new THREE.Color('#ffe2b8'), emissiveIntensity: 0, roughness: 0.8 });
  ctx.windowMats.push(shop);
  g.add(box(w - 0.8, 2.3, 0.03, shop, 0, 1.15, 0.03, false));
  for (let i = 0; i < 3; i++) g.add(P.detail(box(0.7, 1.2 - i * 0.2, 0.3, std(['#c9b49a', '#8a6a4a', '#d8d2c4'][i], 0.7), -w / 3 + i * (w / 3), 0.6, 0.25)));
  // kanopi & papan nama toko
  const aw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 1.2), std(awnColor, 0.7)); aw.position.set(0, 3.55, 0.6); aw.rotation.x = 0.2; aw.castShadow = true; g.add(aw);
  const nb = new THREE.MeshStandardMaterial({ map: P.brandTexture(name, { bg: '#ffffff', fg: awnColor, font: 'bold Arial, sans-serif', spacing: 0.08, w: 512, h: 96 }), roughness: 0.6 });
  g.add(box(w * 0.8, 0.55, 0.06, nb, 0, 4.15, 0.05));
  // lantai 2: jendela + balkon
  const win = new THREE.MeshStandardMaterial({ color: '#2f3d4a', metalness: 0.3, roughness: 0.15, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
  ctx.windowMats.push(win);
  for (const wx of [-w / 4, w / 4]) { g.add(box(w * 0.32, 1.5, 0.05, win, wx, 5.6, 0.03)); g.add(box(w * 0.34, 0.08, 0.12, std('#f4f1ea', 0.6), wx, 4.82, 0.06)); }
  const rail = std('#2a2a2a', 0.5, 0.6);
  g.add(box(w - 0.3, 0.05, 0.05, rail, 0, 5.1, 0.6));
  for (let i = 0; i <= 8; i++) g.add(P.detail(box(0.025, 0.6, 0.025, rail, -w / 2 + 0.15 + i * ((w - 0.3) / 8), 4.8, 0.6)));
  g.add(box(w, 0.12, 0.7, std('#d9d4cc', 0.8), 0, 4.48, 0.3));
  g.add(box(w + 0.05, 0.4, 0.3, std(new THREE.Color(color).multiplyScalar(0.9), 0.8), 0, H - 0.2, 0.02));
  // pot & AC outdoor
  g.add(P.detail(box(0.7, 0.5, 0.3, std('#e9e9ea', 0.5, 0.2), w / 2 - 0.6, 6.7, 0.16)));
  return g;
}

// ---------- outlet mall / ruko (indoor) ----------
function tileTexture(base = '#e9e6e0', size = 8) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const n = size, t = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const col = new THREE.Color(base).offsetHSL(0, 0, (Math.random() - 0.5) * 0.03);
    g.fillStyle = `#${col.getHexString()}`; g.fillRect(i * t, j * t, t, t);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(i * t + Math.random() * t, j * t + Math.random() * t, 3 + Math.random() * 8, 1); }
  }
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(512, i * t); g.stroke(); }
  return toTex(c);
}
// Butik bergaya mall premium (nama brand fiktif)
const BOUTIQUES = [
  { name: 'AURELLE', clad: ['#141414', 'rgba(200,200,200,'], fg: '#d8b56a', inner: '#f3ece2' },
  { name: 'MAISON VÉRA', clad: ['#efe9df', 'rgba(150,130,110,'], fg: '#2a2622', inner: '#faf6f0' },
  { name: 'NOIRÉ', clad: ['#2b2b2d', 'rgba(220,220,220,'], fg: '#f4efe6', inner: '#ece6dc' },
  { name: 'LUMEN & CO', clad: ['#d9cdb8', 'rgba(120,100,80,'], fg: '#1d1d1f', inner: '#f6f1e8' },
  { name: 'ATELIER SIX', clad: ['#3a3229', 'rgba(210,190,160,'], fg: '#e7cf9a', inner: '#efe7da' },
  { name: 'VELOURA', clad: ['#f4f1ec', 'rgba(170,160,150,'], fg: '#8a6a3a', inner: '#fbf8f3' },
];
const cladCache = new Map();
function cladMat(c) {
  const k = c[0];
  if (!cladCache.has(k)) { const t = P.marbleTexture(c[0], c[1]); t.repeat.set(1, 2); t.userData.shared = true; cladCache.set(k, new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.18, clearcoat: 0.5, clearcoatRoughness: 0.2 })); }
  return cladCache.get(k);
}
const backdropCache = new Map();
function backdropMat(inner) {
  if (backdropCache.has(inner)) return backdropCache.get(inner);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#fff4e2'); grd.addColorStop(1, inner); g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#2a2622'; g.fillRect(40, 30, 432, 170);
  for (let cx = 0; cx < 4; cx++) for (let r = 0; r < 3; r++) {
    const x = 52 + cx * 106, y = 40 + r * 54;
    g.fillStyle = '#efe6d8'; g.fillRect(x, y, 94, 46);
    g.fillStyle = '#c9a35a'; g.fillRect(x, y + 44, 94, 3);
    g.fillStyle = ['#111', '#8a5a2b', '#d8b56a', '#8a1c1c', '#f4efe6'][(cx + r) % 5]; g.fillRect(x + 30, y + 18, 34, 24);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(150, 200, 212, 56);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0.25 });
  backdropCache.set(inner, m);
  return m;
}
function shopFront(W, opts, ctx) {
  const g = new THREE.Group();
  const H = 4.4, fasciaY = 2.95, depth = 6;
  const gold = std('#c9a35a', 0.3, 0.9);
  const clad = cladMat(opts.clad || ['#efe9df', 'rgba(150,130,110,']);
  const pier = Math.min(0.55, W * 0.09);
  // pilaster marmer kiri-kanan + list emas
  for (const s of [-1, 1]) {
    g.add(box(pier, fasciaY, 0.3, clad, s * (W / 2 - pier / 2), fasciaY / 2, -0.15));
    g.add(box(0.03, fasciaY, 0.32, gold, s * (W / 2 - pier), fasciaY / 2, -0.14, false));
  }
  // list plang (fasad atas)
  if (opts.brand) {
    const fm = new THREE.MeshStandardMaterial({ map: P.brandTexture(opts.brand, { bg: opts.clad[0], fg: opts.fg }), roughness: 0.35, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.06 });
    g.add(box(W, H - fasciaY, 0.3, [clad, clad, clad, clad, fm, clad], 0, fasciaY + (H - fasciaY) / 2, -0.15));
  } else {
    g.add(box(W, H - fasciaY, 0.3, std(opts.fascia || '#1f2329', 0.45, 0.25), 0, fasciaY + (H - fasciaY) / 2, -0.15));
  }
  g.add(box(W, 0.04, 0.34, gold, 0, fasciaY, -0.13, false));
  g.add(box(W, 0.04, 0.34, gold, 0, H - 0.02, -0.13, false));
  // etalase kaca + pintu kaca dengan handle emas
  const gw = W - pier * 2;
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d7e4ea', roughness: 0.03, transparent: true, opacity: 0.16, depthWrite: false });
  g.add(box(gw, fasciaY - 0.05, 0.025, glass, 0, (fasciaY - 0.05) / 2, -0.05, false));
  const fr = std('#1d1d1f', 0.35, 0.7);
  g.add(box(gw, 0.05, 0.06, fr, 0, 0.025, -0.05));
  for (const x of [-0.6, 0.6]) g.add(box(0.035, fasciaY - 0.1, 0.06, fr, x, (fasciaY - 0.1) / 2, -0.05));
  for (const x of [-0.08, 0.08]) g.add(box(0.025, 0.9, 0.05, gold, x, 1.1, 0.01));
  if (opts.simple) {
    // toko jauh: cukup fasad + interior bergambar (ringan)
    g.add(box(W - pier * 2, fasciaY - 0.08, 0.05, backdropMat(opts.inner || '#f3ece2'), 0, (fasciaY - 0.08) / 2 + 0.04, -1.6, false));
    g.add(box(W - pier * 2, 0.02, 1.6, std('#efe9df', 0.3), 0, 0.01, -0.8, false));
    for (const s of [-1, 1]) g.add(box(0.05, fasciaY, 1.6, std(opts.inner || '#f3ece2', 0.9), s * (W / 2 - pier), fasciaY / 2, -0.8, false));
    g.add(box(W - pier * 2, 0.05, 1.6, std('#f7f4ef', 0.95), 0, fasciaY - 0.02, -0.8, false));
    return g;
  }
  // interior
  const iw = W - 0.2;
  if (!shopFront.floor) { const t = P.marbleTexture('#f2ede5'); t.repeat.set(2, 2); t.userData.shared = true; shopFront.floor = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.15, clearcoat: 0.5 }); }
  const floorMat = shopFront.floor;
  g.add(box(iw, 0.02, depth, floorMat, 0, 0.01, -depth / 2 - 0.1, false));
  g.add(box(iw * 0.6, 0.005, depth * 0.5, std('#c9b8a0', 1), 0, 0.025, -depth / 2 - 0.3, false)); // karpet
  g.add(box(0.1, H, depth, std(opts.inner || '#f3ece2', 0.9), -iw / 2, H / 2, -depth / 2 - 0.1, false));
  g.add(box(0.1, H, depth, std(opts.inner || '#f3ece2', 0.9), iw / 2, H / 2, -depth / 2 - 0.1, false));
  g.add(box(iw, 0.05, depth, std('#f7f4ef', 0.95), 0, fasciaY + 0.2, -depth / 2 - 0.1, false));   // plafon toko
  const wall = P.displayWall(Math.min(iw - 0.4, 6), fasciaY, ctx); wall.position.z = -depth; g.add(wall);
  const tbl = P.displayTable(ctx); tbl.position.set(0, 0, -depth / 2 - 0.2); g.add(tbl);
  const cash = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.0, 0.55, 2, 0.04), std('#2a2622', 0.4, 0.2)); cash.position.set(iw / 2 - 1.0, 0.5, -depth + 1.2); g.add(cash);
  g.add(box(1.42, 0.03, 0.57, gold, iw / 2 - 1.0, 1.01, -depth + 1.2, false));
  // manekin di etalase
  const mq = Math.max(1, Math.min(3, Math.floor(gw / 1.6)));
  for (let i = 0; i < mq; i++) {
    const m = P.mannequin(); m.position.set(-gw / 2 + 0.7 + i * ((gw - 1.4) / Math.max(1, mq - 1 || 1)), 0.02, -0.7); m.rotation.y = (i - (mq - 1) / 2) * 0.3;
    if (mq === 1) m.position.x = -gw / 4;
    g.add(i === 0 ? m : P.detail(m));
  }
  // lampu sorot & chandelier
  for (const x of [-iw / 4, iw / 4]) { const sp = P.spotLight3(ctx); sp.position.set(x, fasciaY + 0.17, -1.2); g.add(sp); }
  const ch = P.chandelier(ctx, 0.45); ch.position.set(0, fasciaY + 0.17, -depth / 2 - 0.2); g.add(ch);
  const l = new THREE.PointLight('#ffe9cc', 4, 7, 1.6); l.position.set(0, fasciaY - 0.2, -depth / 2); g.add(l);
  // pengunjung di dalam toko
  if (W > 4.5) { const p1 = P.human({ pose: 'stand', bag: true }); p1.position.set(iw / 4, 0, -depth / 2 + 0.6); p1.rotation.y = 2.4; g.add(p1); }
  return g;
}
function buildMall(g, state, ctx) {
  const W = state.env.mallW || 6;
  const H = 4.4, ceilH = 5.2, corridor = 10;
  // lantai marmer dengan pola inlay
  const ft = P.marbleTexture('#efe9e0', 'rgba(140,125,110,'); ft.repeat.set(16, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), new THREE.MeshPhysicalMaterial({ map: ft, roughness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.02, 4); floor.receiveShadow = true;
  g.add(floor);
  const inlay = new THREE.MeshPhysicalMaterial({ map: (() => { const t = P.marbleTexture('#2a2622', 'rgba(200,180,150,'); t.repeat.set(20, 1); return t; })(), roughness: 0.12, clearcoat: 0.8 });
  for (const z of [1.3, corridor - 1.3]) g.add(box(60, 0.005, 0.35, inlay, 0, 0.025, z, false));
  for (let x = -24; x <= 24; x += 8) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), inlay); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.026, corridor / 2); g.add(d); const r = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.05, 48), std('#c9a35a', 0.3, 0.9)); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.027, corridor / 2); g.add(r); }
  // plafon dengan cove light & skylight
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), std('#e9e6e1', 0.95));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ceilH, 4); g.add(ceil);
  const cove = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#fff2dc'), emissiveIntensity: 1.0 });
  g.add(box(60, 0.04, 0.12, cove, 0, ceilH - 0.35, 0.5, false));
  g.add(box(60, 0.04, 0.12, cove, 0, ceilH - 0.35, corridor - 0.5, false));
  g.add(box(60, 0.3, 0.2, std('#f2efea', 0.9), 0, ceilH - 0.2, 0.4, false));
  const sky = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#eef4ff'), emissiveIntensity: 0.55 });
  g.add(box(56, 0.03, 2.4, sky, 0, ceilH - 0.01, corridor / 2, false));
  const down = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#fff6e8'), emissiveIntensity: 0.9 });
  { const pts = []; for (let x = -26; x <= 26; x += 3) for (const z of [2.2, corridor - 2.2]) pts.push([x, z]);
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 14), down, pts.length); const m4 = new THREE.Matrix4();
    pts.forEach(([x, z], i) => { m4.makeTranslation(x, ceilH - 0.01, z); im.setMatrixAt(i, m4); }); g.add(im); }
  for (const [lx, lz] of [[-7, 3], [7, 3], [0, 6.5], [-14, 6.5], [14, 6.5]]) { const l = new THREE.PointLight('#fff1dc', 5, 13, 1.8); l.position.set(lx, ceilH - 0.6, lz); g.add(l); }
  for (const x of [-5, 5]) { const c = P.chandelier(ctx, 0.9); c.position.set(x, ceilH, corridor / 2); g.add(c); }
  // deretan butik: toko utama (signage pelanggan) di tengah
  g.add(shopFront(W, { fascia: state.env.mallFascia }, ctx));
  let xr = W / 2 + 0.7, xl = -W / 2 - 0.7;
  const order = [0, 1, 2, 3, 4, 5];
  for (let i = 0; i < 3; i++) {
    const bR = BOUTIQUES[order[i * 2]], bL = BOUTIQUES[order[i * 2 + 1]];
    const wR = 5.5 + (i % 2), wL = 6 - (i % 2) * 0.5;
    const simple = i > 0; // hanya toko tepat di samping toko utama yang detail
    const r = shopFront(wR, { brand: bR.name, clad: bR.clad, fg: bR.fg, inner: bR.inner, simple }, ctx); r.position.x = xr + wR / 2; g.add(r); xr += wR + 0.7;
    const l = shopFront(wL, { brand: bL.name, clad: bL.clad, fg: bL.fg, inner: bL.inner, simple }, ctx); l.position.x = xl - wL / 2; g.add(l); xl -= wL + 0.7;
  }
  // kolom marmer + cincin emas di antara toko
  const colMat = cladMat(['#f2ede5', 'rgba(150,130,110,']);
  const gold = std('#c9a35a', 0.3, 0.9);
  const colXs = [W / 2 + 0.35, -W / 2 - 0.35];
  let cx = W / 2 + 0.7; for (let i = 0; i < 3; i++) { cx += 5.5 + (i % 2); colXs.push(cx + 0.35); cx += 0.7; }
  cx = -W / 2 - 0.7; for (let i = 0; i < 3; i++) { cx -= 6 - (i % 2) * 0.5; colXs.push(cx - 0.35); cx -= 0.7; }
  for (const x of colXs) {
    g.add(box(0.7, ceilH, 0.7, colMat, x, ceilH / 2, -0.15));
    for (const y of [0.15, 2.95, ceilH - 0.5]) g.add(box(0.74, 0.05, 0.74, gold, x, y, -0.15, false));
  }
  g.add(box(64, ceilH - H, 0.4, std('#f2efea', 0.9), 0, H + (ceilH - H) / 2, -0.35));
  // sisi seberang koridor
  const opp = new THREE.Group();
  let xo = -27;
  for (let i = 0; i < 6; i++) { const b = BOUTIQUES[(i + 3) % 6]; const w = 5.6; const sf = shopFront(w, { brand: b.name, clad: b.clad, fg: b.fg, inner: b.inner, simple: true }, ctx); sf.position.x = xo + w / 2; opp.add(sf); xo += w + 1.2; }
  opp.rotation.y = Math.PI; opp.position.z = corridor;
  g.add(opp);
  for (const x of [-31, 31]) g.add(box(0.3, ceilH, corridor + 2, std('#ece8e2', 0.9), x, ceilH / 2, corridor / 2));
  // perabot koridor: planter, bangku kulit, pengunjung
  for (const x of [-11, 11, -22, 22]) { const p = P.plantPot(1.6, '#e8e2d8'); p.position.set(x, 0, corridor / 2); g.add(p); }
  for (const x of [-5, 5]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.42, 0.6, 3, 0.1), std('#5b3a24', 0.55)); b.position.set(x, 0.21, corridor / 2); b.castShadow = true; g.add(b);
  }
  const shoppers = [[-3.2, 2.6, 0.4, 'walk'], [3.8, 3.4, -2.6, 'walk'], [-8.5, 6.8, 3.0, 'stand'], [8.2, 7.2, -0.6, 'walk'], [-5.4, 5.0, 0, 'sit'], [5.3, 5.0, Math.PI, 'sit']];
  for (const [x, z, r, pose] of shoppers) { const h = P.human({ pose, bag: pose !== 'sit' && rnd() > 0.35 }); h.position.set(x, pose === 'sit' ? -0.03 : 0, z); h.rotation.y = r; g.add(h); }
  g.traverse((o) => { if (o.isMesh) { if (!o.userData.keepShadow) o.castShadow = false; o.receiveShadow = true; } });
  g.userData.indoor = true;
}

// ---------- booth kontainer (outdoor) ----------
function corrugatedTexture(color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  for (let x = 0; x < 512; x++) {
    const k = 0.82 + 0.18 * Math.sin((x / 512) * Math.PI * 2 * 16);
    g.fillStyle = `#${base.clone().multiplyScalar(k).getHexString()}`; g.fillRect(x, 0, 1, 64);
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(80,50,30,${Math.random() * 0.08})`; g.fillRect(Math.random() * 512, Math.random() * 64, 2 + Math.random() * 6, 1 + Math.random() * 3); }
  return toTex(c);
}
function buildBooth(g, state, ctx) {
  const L = state.env.boothL || 6, Wd = state.env.boothW || 2.4, H = 2.6;
  const color = state.env.boothColor || '#d9481f';
  const tex = corrugatedTexture(color); tex.repeat.set(L / 2.5, 1);
  const texS = corrugatedTexture(color); texS.repeat.set(Wd / 2.5, 1);
  const wall = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.35 });
  const side = new THREE.MeshStandardMaterial({ map: texS, roughness: 0.55, metalness: 0.35 });
  const dark = std(new THREE.Color(color).multiplyScalar(0.55), 0.6, 0.4);
  const zc = -Wd / 2;
  // dinding belakang, samping, atap, lantai
  g.add(box(L, H, 0.06, wall, 0, H / 2 + 0.15, -Wd + 0.03));
  g.add(box(0.06, H, Wd, side, -L / 2 + 0.03, H / 2 + 0.15, zc));
  g.add(box(0.06, H, Wd, side, L / 2 - 0.03, H / 2 + 0.15, zc));
  g.add(box(L, 0.08, Wd, dark, 0, H + 0.15 - 0.04, zc));
  g.add(box(L, 0.12, Wd, std('#6b5a48', 0.8), 0, 0.15 + 0.06, zc));
  // sisi depan dengan bukaan jendela layanan
  const openW = Math.min(L * 0.6, L - 1.2), openY0 = 1.05, openY1 = 2.3;
  const sideW = (L - openW) / 2;
  g.add(box(sideW, H, 0.06, wall, -L / 2 + sideW / 2, H / 2 + 0.15, -0.03));
  g.add(box(sideW, H, 0.06, wall, L / 2 - sideW / 2, H / 2 + 0.15, -0.03));
  g.add(box(openW, openY0, 0.06, wall, 0, openY0 / 2 + 0.15, -0.03));
  g.add(box(openW, H - openY1, 0.06, wall, 0, openY1 + (H - openY1) / 2 + 0.15, -0.03));
  // flap jendela terangkat + penyangga
  const flap = new THREE.Mesh(new THREE.BoxGeometry(openW, 0.05, openY1 - openY0 + 0.1), wall);
  flap.geometry.translate(0, 0, (openY1 - openY0 + 0.1) / 2);
  flap.position.set(0, openY1 + 0.15, 0.0); flap.rotation.x = -0.35; flap.castShadow = true;
  g.add(flap);
  // meja counter kayu
  g.add(box(openW + 0.2, 0.05, 0.45, std('#8a6a4a', 0.6), 0, openY0 + 0.15 + 0.025, 0.12));
  // rangka sudut (corner post) & casting
  const post = std(new THREE.Color(color).multiplyScalar(0.7), 0.5, 0.5);
  for (const x of [-L / 2 + 0.06, L / 2 - 0.06]) for (const z of [-0.06, -Wd + 0.06]) {
    g.add(box(0.14, H, 0.14, post, x, H / 2 + 0.15, z));
    g.add(box(0.18, 0.12, 0.18, std('#2a2a2a', 0.6, 0.5), x, H + 0.11, z));
    g.add(box(0.18, 0.12, 0.18, std('#2a2a2a', 0.6, 0.5), x, 0.21, z));
  }
  // interior hangat: dinding dalam, bar kopi, kulkas, menu, lampu gantung, barista
  const warm = new THREE.MeshStandardMaterial({ color: '#f4ead8', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
  ctx.windowMats.push(warm);
  g.add(box(L - 0.3, 0.04, Wd - 0.3, warm, 0, H + 0.15 - 0.12, zc, false));
  const plank = std('#b08a5e', 0.7);
  g.add(box(L - 0.2, H - 0.1, 0.03, plank, 0, H / 2 + 0.2, -Wd + 0.09, false));
  const back = new THREE.Group();
  back.add(box(openW, 0.95, 0.55, std('#2f2620', 0.5), 0, 0.475, 0));
  back.add(box(openW + 0.05, 0.04, 0.6, std('#d8cfc2', 0.3), 0, 0.97, 0));
  const cb = P.coffeeBar(openW, ctx); cb.position.set(0, 0.99, 0); back.add(cb);
  back.position.set(0, 0.15, -Wd + 0.42); g.add(back);
  const mb = P.menuBoard(Math.min(1.6, openW * 0.5), 0.8); mb.position.set(0, 1.95, -Wd + 0.11); g.add(mb);
  for (const sx of [-1, 1]) {
    g.add(P.detail(box(0.9, 0.03, 0.25, plank, sx * openW * 0.38, 1.75, -Wd + 0.22)));
    for (let k = 0; k < 4; k++) g.add(P.detail(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), std(['#d9cbb2', '#3b2a1e', '#f4f1ea', '#8a6a4a'][k], 0.4)).translateX(sx * openW * 0.38 - 0.3 + k * 0.2).translateY(1.85).translateZ(-Wd + 0.22)));
  }
  const fr = P.fridge(ctx); fr.position.set(L / 2 - 0.55, 0.15, -Wd + 0.5); fr.rotation.y = -Math.PI / 2 + 0.2; g.add(fr);
  for (const lx of [-openW / 3, 0, openW / 3]) { const pl = P.pendantLamp(ctx, 0.45); pl.position.set(lx, H + 0.1, -Wd / 2); g.add(pl); }
  const barista = P.human({ pose: 'stand', shirt: '#1d1d1f', apron: true }); barista.position.set(-openW * 0.15, 0.15, -Wd + 1.05); barista.rotation.y = 0.15; g.add(barista);
  g.add(box(openW, 0.9, 0.4, std('#e9e4dc', 0.5), 0, openY0 - 0.3, -0.35));
  // fondasi blok beton
  for (const x of [-L / 2 + 0.3, 0, L / 2 - 0.3]) for (const z of [-0.3, -Wd + 0.3]) g.add(box(0.4, 0.15, 0.4, std('#9a958e', 0.9), x, 0.075, z));
  // area depan: paving, kursi bar, meja, lampu gantung
  const pt = pavingTexture('#c9c3b8'); pt.repeat.set(10, 4);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(L + 10, 9), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.012, 1.5); plaza.receiveShadow = true;
  g.add(plaza);
  const metal = std('#222', 0.5, 0.5);
  for (let i = 0; i < Math.max(2, Math.floor(openW / 0.8)); i++) {
    const x = -openW / 2 + 0.4 + i * 0.8;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16), std('#8a6a4a', 0.6)).translateX(x).translateY(0.75).translateZ(0.65));
    g.add(box(0.04, 0.75, 0.04, metal, x, 0.375, 0.65));
  }
  for (const x of [-L / 2 - 1.5, L / 2 + 1.6]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 20), std('#e8e2d6', 0.6)); t.position.set(x, 0.75, 2.2); t.castShadow = true; g.add(t);
    g.add(box(0.05, 0.75, 0.05, metal, x, 0.375, 2.2));
  }
  const bulb = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#ffcf8a'), emissiveIntensity: 0 });
  ctx.windowMats.push(bulb);
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const x = -L / 2 - 1.5 + i * ((L + 3) / 8);
    const y = 2.55 - Math.sin((i / 8) * Math.PI) * 0.35;
    pts.push(new THREE.Vector3(x, y + 0.07, 1.8));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bulb); b.position.set(x, y, 1.8); g.add(b);
  }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.008, 4), std('#111', 0.6));
  g.add(wire);
  for (const x of [-L / 2 - 1.5, L / 2 + 1.5]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.65, 10), metal); p.position.set(x, 1.32, 1.8); p.castShadow = true; g.add(p);
  }
  g.add(tree(L / 2 + 3.2, -1.2, 0.85));
  // suasana luar: pembeli, meja payung, menu, tanaman, motor
  const q1 = P.human({ pose: 'stand' }); q1.position.set(-openW * 0.2, 0, 1.0); q1.rotation.y = Math.PI; g.add(q1);
  const q2 = P.human({ pose: 'stand' }); q2.position.set(openW * 0.25, 0, 1.25); q2.rotation.y = Math.PI + 0.3; g.add(q2);
  const q3 = P.human({ pose: 'sit' }); q3.position.set(-openW / 2 + 0.4, 0.02, 1.05); q3.rotation.y = Math.PI; g.add(q3);
  for (const [tx, tz, uc] of [[-L / 2 - 2.6, 3.6, '#d9481f'], [L / 2 + 2.4, 3.8, '#1f5fa8']]) {
    const t = P.cafeTable(true, uc); t.position.set(tx, 0, tz); g.add(t);
    const sg = P.seatedGroup(2); sg.position.set(tx, 0, tz); g.add(sg);
  }
  const am = P.aFrameMenu(); am.position.set(L / 2 + 0.6, 0, 0.9); am.rotation.y = -0.5; g.add(am);
  for (const x of [-L / 2 - 0.5, L / 2 + 0.5]) { const pp = P.plantPot(1.1, '#3a3632'); pp.position.set(x, 0, -0.4); g.add(pp); }
  for (const [mx, mc] of [[-L / 2 - 4.2, '#111111'], [-L / 2 - 5.1, '#c81e1e']]) { const m = P.motorbike(mc); m.position.set(mx, 0, 1.2); m.rotation.y = Math.PI / 2 + 0.1; g.add(m); }
  const bin = P.detail(P.cyl(0.2, 0.18, 0.7, std('#2f7d4a', 0.5), L / 2 + 1.2, 0.35, -0.3, 14)); g.add(bin);
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
  const r = THREE.MathUtils.clamp(size.w * 0.035, 0.08, 0.16);
  const base = () => {
    g.add(box(r * 5, 0.04, r * 5, mat, 0, 0.02, 0));
    g.add(box(r * 7, 0.2, r * 7, std('#9a958e', 0.9), 0, -0.05, 0));
    for (const [bx, bz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(box(0.03, 0.06, 0.03, std('#777', 0.4, 0.8), bx * r * 2, 0.05, bz * r * 2));
  };
  if (isBox) {
    // tiang berhenti di bawah neon box + dudukan (box duduk di atas tiang, tidak tembus)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, height, 20), mat);
    pole.position.y = height / 2; pole.castShadow = true;
    g.add(pole);
    g.add(box(Math.min(size.w * 0.5, 0.9), 0.05, Math.max(size.d * 0.9, r * 3), mat, 0, height - 0.025, 0));
    g.add(box(r * 3, 0.18, r * 3, mat, 0, height - 0.12, 0));
    base();
    g.traverse((o) => { if (o.isMesh) o.userData.noPick = true; });
    return { group: g, signY: height, signZ: -size.d / 2 };
  }
  // huruf / neon flex: rangka besi horizontal di belakang huruf, tiang di belakang rangka
  const W = size.w, H = size.h;
  const t = 0.05;                 // hollow 5 cm
  const frameZ = -0.035;          // tepat di belakang punggung huruf (z = 0)
  const poleZ = frameZ - t / 2 - r - 0.03;
  const yB = height + H * 0.18, yT = height + H * 0.82;
  const topY = yT + 0.12;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, topY, 20), mat);
  pole.position.set(0, topY / 2, poleZ); pole.castShadow = true;
  g.add(pole);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.04, 20), mat).translateY(topY).translateZ(poleZ));
  const fw = Math.max(W * 0.94, 0.4);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const y of [yB, yT]) g.add(beam(V(-fw / 2, y, frameZ), V(fw / 2, y, frameZ), t, mat));        // rel horizontal
  const n = Math.max(2, Math.ceil(fw / 1.2) + 1);
  for (let i = 0; i < n; i++) {                                                                        // tegak penghubung
    const x = -fw / 2 + (i / (n - 1)) * fw;
    g.add(beam(V(x, yB - t / 2, frameZ), V(x, yT + t / 2, frameZ), t * 0.8, mat));
  }
  for (const y of [yB, yT]) g.add(beam(V(0, y, frameZ - t / 2), V(0, y, poleZ), t, mat));           // braket ke tiang
  g.add(beam(V(-fw * 0.3, yB, frameZ), V(0, height - 0.15, poleZ), t * 0.7, mat));                  // skur kiri
  g.add(beam(V(fw * 0.3, yB, frameZ), V(0, height - 0.15, poleZ), t * 0.7, mat));                   // skur kanan
  base();
  g.children.forEach((o) => { if (o.position && o.isMesh && o.geometry.type === 'BoxGeometry' && o.position.y < 0.2) o.position.z += poleZ; });
  g.traverse((o) => { if (o.isMesh) { o.userData.noPick = true; o.castShadow = true; } });
  g.userData.frameArea = fw * (yT - yB);
  return { group: g, signY: height, signZ: 0 };
}
