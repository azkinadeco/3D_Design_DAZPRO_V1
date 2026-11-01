// Properti 3D pendukung suasana: orang, motor, perabot, butik, kafe, kontainer.
// Objek dengan userData.detail = true hanya tampil di kualitas grafis Tinggi.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- util ----------
let seed = 9001;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const matCache = new Map();
export function mat(color, rough = 0.7, metal = 0, extra = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  return matCache.get(key);
}
export function bx(w, h, d, m, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true;
  return o;
}
export function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  return o;
}
export const detail = (o) => { o.userData.detail = true; return o; };
const GOLD = () => mat('#c9a35a', 0.3, 0.9);
const CHROME = () => mat('#d5d8dc', 0.15, 1);

// ---------- tekstur ----------
export function marbleTexture(base = '#f1ede6', vein = 'rgba(120,110,100,', size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`; g.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
  for (let v = 0; v < 14; v++) {
    let x = Math.random() * size, y = Math.random() * size;
    const a = Math.random() * Math.PI;
    g.strokeStyle = `${vein}${0.08 + Math.random() * 0.22})`;
    g.lineWidth = 0.6 + Math.random() * 1.8;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 40; k++) { x += Math.cos(a) * 14 + (Math.random() - 0.5) * 14; y += Math.sin(a) * 14 + (Math.random() - 0.5) * 14; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
/** Papan nama butik fiktif (huruf emas / putih di fasad). */
export function brandTexture(name, { bg = '#111111', fg = '#d8b56a', font = 'Georgia, "Times New Roman", serif', spacing = 0.28, w = 1024, h = 192 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const letters = name.split('');
  let fs = h * 0.5;
  g.font = `400 ${fs}px ${font}`;
  const measure = () => letters.reduce((a, ch) => a + g.measureText(ch).width, 0) + fs * spacing * (letters.length - 1);
  while (measure() > w * 0.86 && fs > 10) { fs -= 2; g.font = `400 ${fs}px ${font}`; }
  let x = (w - measure()) / 2;
  g.fillStyle = fg; g.textBaseline = 'middle';
  for (const ch of letters) { g.fillText(ch, x, h / 2 + 2); x += g.measureText(ch).width + fs * spacing; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function textBoard(lines, { w = 512, h = 640, bg = '#1d1f22', fg = '#f4efe6', title = 'MENU' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = '700 64px Georgia, serif'; g.textAlign = 'center'; g.fillText(title, w / 2, 90);
  g.font = '28px Georgia, serif'; g.textAlign = 'left';
  lines.forEach((l, i) => { g.fillText(l[0], 40, 170 + i * 58); g.textAlign = 'right'; g.fillText(l[1], w - 40, 170 + i * 58); g.textAlign = 'left'; });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- orang ----------
const SKINS = ['#e0b48f', '#c99a72', '#a87656', '#f0c9a6', '#8d5b3d'];
const CLOTHES = ['#2f5bff', '#e11d2e', '#1f2937', '#f5f5f4', '#16a34a', '#f59e0b', '#7c3aed', '#64748b', '#be185d', '#0f766e', '#d6c7a8'];
/** pose: 'stand' | 'sit' | 'walk'. Opsi tas belanja untuk pengunjung mall. */
export function human({ pose = 'stand', shirt, pants, bag = false, apron = false } = {}) {
  const g = new THREE.Group();
  const sh = mat(shirt || CLOTHES[Math.floor(rnd() * CLOTHES.length)], 0.85);
  const pa = mat(pants || ['#1f2430', '#3b3f46', '#2a3550', '#5b4a3a', '#d8d2c4'][Math.floor(rnd() * 5)], 0.85);
  const skin = mat(SKINS[Math.floor(rnd() * SKINS.length)], 0.7);
  const hairM = mat(['#1d1a17', '#3b2a1e', '#0e0d0c', '#6b4a2b'][Math.floor(rnd() * 4)], 0.9);
  const sit = pose === 'sit';
  const hipY = sit ? 0.47 : 0.9;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 4, 10), sh); torso.position.y = hipY + 0.32;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), skin); head.position.y = hipY + 0.78;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), hairM); hair.position.y = hipY + 0.8;
  g.add(torso, head, hair);
  const legGeo = new THREE.CapsuleGeometry(0.068, 0.36, 4, 8);
  for (const sx of [-0.085, 0.085]) {
    const thigh = new THREE.Mesh(legGeo, pa);
    const shin = new THREE.Mesh(legGeo, pa);
    const shoe = bx(0.1, 0.07, 0.22, mat('#151515', 0.6), 0, 0, 0);
    if (sit) {
      thigh.rotation.x = Math.PI / 2; thigh.position.set(sx, hipY, 0.22);
      shin.position.set(sx, hipY - 0.24, 0.44);
      shoe.position.set(sx, 0.035, 0.5);
    } else {
      const sw = pose === 'walk' ? (sx > 0 ? 0.35 : -0.35) : 0;
      thigh.position.set(sx, hipY - 0.2, 0); thigh.rotation.x = sw;
      shin.position.set(sx, hipY - 0.62, -Math.sin(sw) * 0.4); shin.rotation.x = sw * 0.5;
      shoe.position.set(sx, 0.035, 0.05 - Math.sin(sw) * 0.55);
    }
    g.add(thigh, shin, shoe);
  }
  const armGeo = new THREE.CapsuleGeometry(0.05, 0.44, 4, 8);
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(armGeo, sh);
    a.position.set(sx * 0.235, hipY + 0.26, sit ? 0.12 : 0);
    a.rotation.x = sit ? -0.9 : pose === 'walk' ? sx * 0.3 : 0;
    a.rotation.z = sx * -0.08;
    g.add(a);
  }
  if (apron) g.add(bx(0.32, 0.5, 0.02, mat('#3b2a1e', 0.8), 0, hipY + 0.1, 0.17));
  if (bag) {
    const bm = mat(['#d8b56a', '#111111', '#f4efe6', '#8a1c1c'][Math.floor(rnd() * 4)], 0.5);
    const b = bx(0.3, 0.32, 0.1, bm, 0.32, hipY - 0.08, 0); g.add(b);
    g.add(bx(0.02, 0.14, 0.02, mat('#222'), 0.32, hipY + 0.12, 0));
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(0.94 + rnd() * 0.12);
  return detail(g);
}

// ---------- kendaraan & jalan ----------
export function motorbike(color) {
  const g = new THREE.Group();
  const paint = mat(color || ['#c81e1e', '#111111', '#1f4fa8', '#f4f4f4', '#2f7d4a'][Math.floor(rnd() * 5)], 0.35, 0.5);
  const dark = mat('#151515', 0.6), chrome = CHROME();
  const tg = new THREE.TorusGeometry(0.27, 0.07, 10, 20);
  for (const x of [-0.62, 0.62]) { const w = new THREE.Mesh(tg, dark); w.position.set(x, 0.3, 0); w.castShadow = true; g.add(w); g.add(cyl(0.08, 0.08, 0.1, chrome, x, 0.3, 0, 10).rotateX(Math.PI / 2)); }
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.32, 0.36, 2, 0.1), paint); body.position.set(0.05, 0.58, 0); body.castShadow = true; g.add(body);
  g.add(bx(0.62, 0.1, 0.3, mat('#1c1c1c', 0.7), -0.12, 0.8, 0));
  g.add(bx(0.06, 0.6, 0.06, chrome, 0.55, 0.75, 0));
  g.add(bx(0.06, 0.06, 0.62, dark, 0.55, 1.05, 0));
  g.add(bx(0.12, 0.14, 0.2, paint, 0.68, 0.9, 0));
  g.add(bx(0.03, 0.08, 0.12, mat('#fff', 0.3, 0, { emissive: new THREE.Color('#fff7dd'), emissiveIntensity: 0.4 }), 0.75, 0.9, 0));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.rotation.z = 0.04;
  return detail(g);
}
export function trafficSign(kind = 'P') {
  const g = new THREE.Group();
  g.add(cyl(0.035, 0.035, 2.5, mat('#9aa0a6', 0.4, 0.8), 0, 1.25, 0, 10));
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = kind === 'P' ? '#1f4fa8' : '#ffffff'; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  if (kind === 'P') { x.fillStyle = '#fff'; x.font = 'bold 84px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('P', 64, 68); }
  else { x.strokeStyle = '#d61f1f'; x.lineWidth = 16; x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(28, 100); x.lineTo(100, 28); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
  s.position.set(0, 2.35, 0.04); g.add(s);
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), mat('#9aa0a6', 0.5, 0.6)); back.rotation.y = Math.PI; back.position.set(0, 2.35, 0.035); g.add(back);
  return detail(g);
}
export function flagPole(color = '#e11d2e', h = 7) {
  const g = new THREE.Group();
  g.add(cyl(0.04, 0.06, h, mat('#e2e5e9', 0.25, 0.9), 0, h / 2, 0, 12));
  g.add(cyl(0.07, 0.07, 0.08, GOLD(), 0, h + 0.04, 0, 12));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9, 12, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
  const p = flag.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.7; p.setZ(i, Math.sin(x * 4) * 0.06 * x); }
  flag.geometry.computeVertexNormals();
  flag.position.set(0.72, h - 0.55, 0); flag.castShadow = true;
  g.add(flag);
  return g;
}
export function hedge(len, h = 0.7) {
  const g = new THREE.Group();
  g.add(bx(len, 0.35, 0.7, mat('#8f8a82', 0.9), 0, 0.175, 0));
  const leaf = mat('#3f6b3c', 0.95, 0, { flatShading: true });
  const n = Math.max(2, Math.round(len / 0.6));
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), leaf);
    b.position.set(-len / 2 + 0.3 + i * ((len - 0.6) / (n - 1)), 0.35 + h * 0.45, 0); b.scale.set(1, h / 0.8, 0.9); b.castShadow = true;
    g.add(b);
  }
  return g;
}
export function plantPot(h = 1.4, potColor = '#d8d4cc') {
  const g = new THREE.Group();
  g.add(cyl(0.28, 0.22, 0.55, mat(potColor, 0.5), 0, 0.275, 0, 20));
  const leaf = mat('#3d6f3a', 0.9, 0, { flatShading: true });
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.ConeGeometry(0.09, h * 0.75, 5), leaf);
    l.position.set(Math.cos(i) * 0.08, 0.55 + h * 0.36, Math.sin(i) * 0.08);
    l.rotation.set(Math.cos(i * 2.1) * 0.35, 0, Math.sin(i * 2.1) * 0.35); l.castShadow = true;
    g.add(l);
  }
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), leaf); top.position.y = 0.55 + h * 0.7; top.castShadow = true; g.add(top);
  return g;
}

// ---------- perabot ----------
export function cafeTable(withUmbrella = false, umbColor = '#efe6d6') {
  const g = new THREE.Group();
  const top = mat('#3b2f27', 0.6), metal = mat('#222', 0.5, 0.5);
  g.add(cyl(0.4, 0.4, 0.04, top, 0, 0.75, 0, 24));
  g.add(cyl(0.03, 0.03, 0.73, metal, 0, 0.37, 0, 8));
  g.add(cyl(0.22, 0.22, 0.03, metal, 0, 0.015, 0, 16));
  for (const a of [0, Math.PI]) {
    const ch = new THREE.Group();
    ch.add(bx(0.42, 0.04, 0.42, metal, 0, 0.46, 0));
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) ch.add(bx(0.03, 0.46, 0.03, metal, lx, 0.23, lz));
    ch.add(bx(0.42, 0.4, 0.03, metal, 0, 0.68, -0.2));
    ch.position.set(Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7); ch.rotation.y = a + Math.PI;
    g.add(ch);
  }
  // cangkir kecil
  g.add(detail(cyl(0.04, 0.035, 0.08, mat('#f4f1ea', 0.4), 0.12, 0.81, 0.05, 10)));
  if (withUmbrella) {
    g.add(cyl(0.025, 0.025, 2.3, metal, 0, 1.15, 0, 8));
    const u = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.42, 12, 1, true), new THREE.MeshStandardMaterial({ color: umbColor, roughness: 0.9, side: THREE.DoubleSide }));
    u.position.y = 2.42; u.castShadow = true; g.add(u);
  }
  return g;
}
/** Meja + pengunjung duduk (kursi menghadap meja). */
export function seatedGroup(n = 2) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? Math.PI : 0;
    const p = human({ pose: 'sit' });
    p.position.set(Math.sin(a) * 0.72, 0, Math.cos(a) * 0.72);
    p.rotation.y = a + Math.PI;
    g.add(p);
  }
  return detail(g);
}
export function aFrameMenu() {
  const g = new THREE.Group();
  const t = textBoard([['Kopi Susu', '18K'], ['Americano', '20K'], ['Matcha', '25K'], ['Croissant', '22K']], { title: 'MENU', w: 256, h: 360 });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  const wood = mat('#6b4a2e', 0.7);
  for (const s of [1, -1]) {
    const p = new THREE.Group();
    p.add(bx(0.5, 0.8, 0.03, wood, 0, 0.4, 0));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), m); face.position.set(0, 0.42, 0.017); p.add(face);
    p.rotation.x = s * 0.2; p.rotation.y = s > 0 ? 0 : Math.PI; p.position.z = s * 0.08;
    g.add(p);
  }
  return detail(g);
}
export function stringLights(points, ctx, color = '#ffcf8a') {
  const g = new THREE.Group();
  const bulb = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color(color), emissiveIntensity: 0 });
  ctx.windowMats.push(bulb);
  const curve = new THREE.CatmullRomCurve3(points);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.007, 4), mat('#111', 0.6)));
  const n = Math.round(curve.getLength() / 0.45);
  const geo = new THREE.SphereGeometry(0.045, 8, 6);
  for (let i = 1; i < n; i++) { const b = new THREE.Mesh(geo, bulb); b.position.copy(curve.getPoint(i / n)).add(new THREE.Vector3(0, -0.06, 0)); g.add(b); }
  return g;
}

// ---------- isi booth / bar kopi ----------
export function coffeeBar(width, ctx) {
  const g = new THREE.Group();
  const chrome = CHROME(), dark = mat('#1d1d1f', 0.5, 0.3);
  // mesin espresso
  const m = new THREE.Group();
  m.add(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.42, 0.45, 2, 0.04), chrome));
  m.children[0].position.y = 0.21;
  m.add(bx(0.62, 0.05, 0.47, dark, 0, 0.44, 0));
  for (const x of [-0.16, 0.16]) { m.add(cyl(0.04, 0.04, 0.12, dark, x, 0.1, 0.25, 10)); m.add(cyl(0.035, 0.03, 0.07, mat('#f4f1ea', 0.4), x, 0.04, 0.27, 10)); }
  m.position.set(-width * 0.18, 0, 0);
  g.add(m);
  // grinder
  const gr = new THREE.Group();
  gr.add(bx(0.18, 0.3, 0.22, dark, 0, 0.15, 0));
  gr.add(cyl(0.09, 0.05, 0.2, mat('#3b2a1e', 0.3, 0, { transparent: true, opacity: 0.85 }), 0, 0.4, 0, 12));
  gr.position.set(-width * 0.18 + 0.5, 0, 0);
  g.add(gr);
  // tumpukan cangkir & toples
  for (let i = 0; i < 4; i++) g.add(cyl(0.045, 0.04, 0.09, mat('#f4f1ea', 0.4), width * 0.1 + (i % 2) * 0.1, 0.045 + Math.floor(i / 2) * 0.09, 0.05, 10));
  for (let i = 0; i < 3; i++) g.add(cyl(0.07, 0.07, 0.2, mat('#d9cbb2', 0.2, 0, { transparent: true, opacity: 0.7 }), width * 0.25 + i * 0.17, 0.1, -0.05, 12));
  return g;
}
export function fridge(ctx) {
  const g = new THREE.Group();
  g.add(bx(0.7, 1.8, 0.65, mat('#e9e9ea', 0.4, 0.2), 0, 0.9, 0));
  const inner = new THREE.MeshStandardMaterial({ color: '#dff2ff', emissive: new THREE.Color('#e6f6ff'), emissiveIntensity: 0.5 });
  g.add(bx(0.6, 1.5, 0.02, inner, 0, 1.0, 0.33, false));
  const bottleCols = ['#c81e1e', '#16a34a', '#f59e0b', '#2563eb', '#f4f4f4'];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) g.add(cyl(0.035, 0.035, 0.22, mat(bottleCols[(r + k) % 5], 0.3), -0.22 + k * 0.11, 0.42 + r * 0.36, 0.22, 8));
  g.add(bx(0.62, 1.52, 0.02, new THREE.MeshPhysicalMaterial({ color: '#cfe3ee', roughness: 0.05, transparent: true, opacity: 0.25 }), 0, 1.0, 0.345, false));
  g.add(bx(0.7, 0.18, 0.66, mat('#1f5fa8', 0.4), 0, 1.71, 0));
  return detail(g);
}
export function menuBoard(w = 1.2, h = 0.7) {
  const t = textBoard([['Espresso', '15K'], ['Kopi Susu Aren', '20K'], ['Cappuccino', '24K'], ['Es Teh Lemon', '12K'], ['Roti Bakar', '18K']], { w: 640, h: 400, title: 'MENU' });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0.15 }));
  return m;
}
export function pendantLamp(ctx, drop = 0.6, color = '#ffd29a') {
  const g = new THREE.Group();
  g.add(cyl(0.004, 0.004, drop, mat('#111'), 0, -drop / 2, 0, 4));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.16, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
  shade.position.y = -drop - 0.05; g.add(shade);
  const bulb = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color(color), emissiveIntensity: 0 });
  ctx.windowMats.push(bulb);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), bulb); b.position.y = -drop - 0.1; g.add(b);
  return g;
}

// ---------- butik mewah (mall) ----------
export function mannequin(dress) {
  const g = new THREE.Group();
  const body = mat('#ece8e1', 0.35);
  const cloth = mat(dress || ['#111111', '#8a1c1c', '#d8c3a5', '#1e3a5f', '#f4efe6'][Math.floor(rnd() * 5)], 0.7);
  g.add(cyl(0.18, 0.2, 0.03, GOLD(), 0, 0.015, 0, 20));
  g.add(cyl(0.012, 0.012, 0.75, GOLD(), 0, 0.4, 0, 8));
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.42, 4, 12), cloth); torso.position.y = 1.18; g.add(torso);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 16, 1, true), cloth); skirt.position.y = 0.72; g.add(skirt);
  const neck = cyl(0.04, 0.05, 0.1, body, 0, 1.5, 0, 10); g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), body); head.scale.y = 1.2; head.position.y = 1.64; g.add(head);
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.45, 4, 8), body); a.position.set(s * 0.19, 1.15, 0); a.rotation.z = s * 0.12; g.add(a); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function handbag(color) {
  const g = new THREE.Group();
  const m = mat(color || ['#111111', '#8a5a2b', '#d8b56a', '#8a1c1c', '#f4efe6', '#2d4a3e'][Math.floor(rnd() * 6)], 0.45, 0.05);
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.22, 0.12, 2, 0.03), m); b.position.y = 0.11; g.add(b);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 6, 16, Math.PI), m); h.position.y = 0.22; g.add(h);
  g.add(bx(0.06, 0.03, 0.005, GOLD(), 0, 0.15, 0.062, false));
  return g;
}
/** Dinding display butik: rak backlit dengan tas / sepatu. */
export function displayWall(width, height, ctx) {
  const g = new THREE.Group();
  const panel = mat('#2a2622', 0.6);
  g.add(bx(width, height, 0.12, panel, 0, height / 2, 0));
  const cols = Math.max(2, Math.round(width / 0.9)), rows = 3;
  const glow = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#ffe6c2'), emissiveIntensity: 0.9 });
  const cw = width / cols;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = -width / 2 + cw * (c + 0.5), y = 0.55 + r * ((height - 0.8) / rows);
    g.add(bx(cw - 0.12, (height - 0.8) / rows - 0.12, 0.02, mat('#efe6d8', 0.6), x, y + ((height - 0.8) / rows) / 2 - 0.06, 0.07, false));
    g.add(bx(cw - 0.12, 0.02, 0.32, GOLD(), x, y, 0.2));
    g.add(bx(cw - 0.16, 0.012, 0.02, glow, x, y + ((height - 0.8) / rows) - 0.16, 0.12, false));
    const item = r === 0 ? shoePair() : handbag();
    item.position.set(x, y + 0.01, 0.2);
    g.add(detail(item));
  }
  return g;
}
function shoePair() {
  const g = new THREE.Group();
  const m = mat(['#111', '#8a1c1c', '#d8b56a', '#f4efe6'][Math.floor(rnd() * 4)], 0.35, 0.1);
  for (const x of [-0.07, 0.07]) { const s = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 0.26, 2, 0.03), m); s.position.set(x, 0.035, 0); g.add(s); }
  return g;
}
export function displayTable(ctx) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.08, 0.8, 2, 0.02), new THREE.MeshPhysicalMaterial({ map: marbleTexture('#f4f0ea'), roughness: 0.15, clearcoat: 0.6 }));
  top.position.y = 0.82; top.castShadow = true; g.add(top);
  g.add(bx(1.2, 0.78, 0.5, mat('#2a2622', 0.5), 0, 0.39, 0));
  g.add(bx(1.22, 0.03, 0.52, GOLD(), 0, 0.03, 0));
  for (let i = 0; i < 3; i++) { const b = handbag(); b.position.set(-0.5 + i * 0.5, 0.86, 0); b.rotation.y = (i - 1) * 0.4; g.add(detail(b)); }
  return g;
}
export function chandelier(ctx, r = 0.5) {
  const g = new THREE.Group();
  const gold = GOLD();
  g.add(cyl(0.006, 0.006, 0.5, gold, 0, -0.25, 0, 4));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 40), gold); ring.rotation.x = Math.PI / 2; ring.position.y = -0.5; g.add(ring);
  const crys = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#fff1d6'), emissiveIntensity: 1.1, roughness: 0.1 });
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), crys);
    d.position.set(Math.cos(a) * r, -0.58 - (i % 3) * 0.06, Math.sin(a) * r); g.add(d);
  }
  return detail(g);
}
export function spotLight3(ctx) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#fff4e0'), emissiveIntensity: 1.2 });
  for (const x of [-0.25, 0, 0.25]) { g.add(cyl(0.05, 0.05, 0.03, mat('#1d1d1f', 0.4, 0.6), x, 0, 0, 12)); g.add(cyl(0.035, 0.035, 0.005, m, x, -0.017, 0, 12)); }
  return g;
}
