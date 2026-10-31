// Pembangun model signage 3D (neon box & huruf timbul)
// Sistem koordinat lokal: x tengah, y bawah = 0, punggung di z = 0, muka menghadap +z.
import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { textShapes, sampleInside, drawTextFit, drawPolys } from './fonts.js';
import { LED_DENSITY } from './config.js';

const isBox = (t) => t.startsWith('box_');

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = 0;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function circleShape(d) {
  const s = new THREE.Shape();
  s.absarc(0, d / 2, d / 2, 0, Math.PI * 2, false);
  return s;
}

function planarUV(geo, w, h, yOff = 0) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + w / 2) / w;
    uv[i * 2 + 1] = (pos.getY(i) - yOff) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function canvasTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function ledInstanced(points, z, color, size) {
  const geo = new THREE.BoxGeometry(size * 1.6, size * 0.6, size * 0.35);
  const mat = new THREE.MeshStandardMaterial({ color: '#202225', emissive: new THREE.Color(color), emissiveIntensity: 2.2, roughness: 0.5 });
  const inst = new THREE.InstancedMesh(geo, mat, Math.max(points.length, 1));
  const m4 = new THREE.Matrix4();
  points.forEach((p, i) => { m4.makeTranslation(p.x, p.y, z); inst.setMatrixAt(i, m4); });
  inst.count = points.length;
  inst.instanceMatrix.needsUpdate = true;
  inst.userData.noPick = true;
  return { inst, mat };
}

/**
 * @returns {{group, size, glow, halo, light, ledCount, letters, area, warnings, perimeter}}
 */
export function buildSign(state, font, assets = {}) {
  const S = state.sign;
  const L = state.led;
  const typeLit = S.type !== 'letters_unlit';
  const lit = typeLit && L.on;
  const b = L.brightness / 100;
  const ledColor = new THREE.Color(L.color);
  const group = new THREE.Group();
  group.name = 'signage';
  const glow = []; // { mat, base }
  const warnings = [];
  const doubleSided = S.sides === 2;
  const out = { group, glow, halo: null, light: null, ledCount: 0, letters: 0, area: 0, warnings, size: null };
  const density = (LED_DENSITY.find((d) => d.id === L.density) || LED_DENSITY[1]).perM2;

  if (isBox(S.type)) {
    const W = S.width / 100;
    const H = S.type === 'box_rect' ? S.height / 100 : W;
    const D = S.depth / 100;
    const shape = S.type === 'box_round' ? circleShape(W) : roundedRect(W, H, Math.min(0.05, W * 0.04));

    // --- kanvas muka ---
    const px = 1024;
    const cw = W >= H ? px : Math.round(px * (W / H));
    const ch = W >= H ? Math.round(px * (H / W)) : px;
    const face = document.createElement('canvas');
    face.width = Math.max(cw, 16); face.height = Math.max(ch, 16);
    const g = face.getContext('2d');
    g.fillStyle = S.front.color;
    g.fillRect(0, 0, face.width, face.height);
    const mask = document.createElement('canvas');
    mask.width = face.width; mask.height = face.height;
    const gm = mask.getContext('2d');
    gm.fillStyle = '#000';
    gm.fillRect(0, 0, mask.width, mask.height);

    const round = S.type === 'box_round';
    const inner = round
      ? { w: face.width * 0.7, h: face.height * 0.7 }
      : { w: face.width * 0.86, h: face.height * 0.8 };
    let area = { x: (face.width - inner.w) / 2, y: (face.height - inner.h) / 2, w: inner.w, h: inner.h };
    if (assets.logo) {
      const img = assets.logo;
      const lh = Math.min(area.h, area.w * 0.4);
      const lw = lh * (img.width / img.height);
      const hasText = S.text.trim().length > 0;
      const lx = hasText ? area.x : face.width / 2 - lw / 2;
      g.drawImage(img, lx, face.height / 2 - lh / 2, lw, lh);
      gm.globalAlpha = 0.85;
      gm.drawImage(img, lx, face.height / 2 - lh / 2, lw, lh);
      gm.globalAlpha = 1;
      if (hasText) area = { x: area.x + lw + area.w * 0.05, y: area.y, w: area.w - lw - area.w * 0.05, h: area.h };
    }
    if (S.text.trim()) {
      const th = area.h * (S.textScale / 100);
      const fit = { x: area.x, y: area.y + (area.h - th) / 2, w: area.w, h: th };
      drawTextFit(g, font, S.text, fit, { spacing: S.spacing, color: S.textColor });
      drawTextFit(gm, font, S.text, fit, { spacing: S.spacing, color: S.textColor });
    }
    const faceTex = canvasTex(face);
    const frontAcrylic = S.front.mat === 'acrylic';
    const glowFront = lit && L.mode !== 'side';
    if (lit && !frontAcrylic) warnings.push('Muka non-acrylic: hanya teks/logo yang menyala (acrylic inlay).');
    const emissiveMap = glowFront ? (frontAcrylic ? faceTex : canvasTex(mask)) : null;
    const faceMat = makeMaterial(S.front.mat, '#ffffff', { map: faceTex, glow: glowFront, emissiveMap, ledColor });
    faceMat.userData.face = true;
    const faceGeo = new THREE.ShapeGeometry(shape, 48);
    planarUV(faceGeo, W, H);
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = D + 0.002;
    faceMesh.castShadow = true;
    group.add(faceMesh);
    if (glowFront) glow.push({ mat: faceMat, base: 0.15 + 0.8 * b });

    if (doubleSided) {
      const back = new THREE.Mesh(faceGeo, faceMat);
      back.rotation.y = Math.PI;
      back.position.z = -0.002;
      group.add(back);
    }

    // --- rangka / sisi ---
    const sideGlow = lit && L.mode === 'side' && S.side.mat === 'acrylic';
    if (lit && L.mode === 'side' && S.side.mat !== 'acrylic') warnings.push('Mode samping butuh sisi berbahan acrylic.');
    const sideMat = makeMaterial(S.side.mat, S.side.color, { glow: sideGlow, ledColor });
    if (sideGlow) glow.push({ mat: sideMat, base: 0.25 + 1.4 * b });
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 40 });
    const body = new THREE.Mesh(bodyGeo, sideMat);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    // bibir depan (trim) tipis agar terlihat seperti frame aluminium
    const trimShape = round ? circleShape(W) : roundedRect(W, H, Math.min(0.05, W * 0.04));
    const holeInset = 0.025;
    const hole = round
      ? new THREE.Path().absarc(0, W / 2, W / 2 - holeInset, 0, Math.PI * 2, true)
      : (() => { const r = roundedRect(W - holeInset * 2, H - holeInset * 2, 0.03); const p = new THREE.Path(r.getPoints(8).map((v) => new THREE.Vector2(v.x, v.y + holeInset)).reverse()); return p; })();
    trimShape.holes.push(hole);
    const trim = new THREE.Mesh(new THREE.ExtrudeGeometry(trimShape, { depth: 0.012, bevelEnabled: false, curveSegments: 40 }), makeMaterial(S.side.mat, S.side.color));
    trim.position.z = D;
    group.add(trim);

    // --- modul LED di dalam ---
    if (typeLit) {
      const n = Math.max(4, Math.ceil(W * H * (round ? 0.785 : 1) * density));
      const pts = [];
      const cols = Math.max(2, Math.round(Math.sqrt((n * W) / H)));
      const rows = Math.max(1, Math.ceil(n / cols));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = -W / 2 + ((c + 0.5) / cols) * W;
          const y = ((r + 0.5) / rows) * H;
          if (round && Math.hypot(x, y - W / 2) > W / 2 - 0.04) continue;
          pts.push({ x, y });
        }
      }
      out.ledCount = pts.length;
      const { inst, mat } = ledInstanced(pts, 0.02, L.color, Math.min(0.04, Math.max(0.018, W / 60)));
      inst.visible = L.xray;
      if (!L.on) mat.emissiveIntensity = 0;
      group.add(inst);
      out.leds = inst;
      // papan dasar putih reflektor
      const back = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.9 }));
      back.position.z = 0.006;
      back.visible = L.xray;
      back.userData.noPick = true;
      group.add(back);
      out.ledBack = back;
    }
    if (L.xray) { faceMat.transparent = true; faceMat.opacity = 0.18; faceMat.depthWrite = false; }

    out.area = W * H * (round ? 0.785 : 1);
    out.size = { w: W, h: H, d: D };
    if (lit) {
      const light = new THREE.PointLight(ledColor, 1, Math.max(6, W * 3), 2);
      light.position.set(0, H / 2, D + Math.max(1.8, W * 0.6));
      group.add(light);
      out.light = light;
      out.lightBase = (0.8 + out.area * 1.6) * b;
    }
    out.textWidth = W; out.textHeight = H;
    return out;
  }

  if (S.type === 'neon_flex') return buildNeon(S, L, font, out, b, ledColor);

  // ================= HURUF TIMBUL =================
  const cap = Math.max(0.05, S.letterHeight / 100);
  const depth = Math.max(0.01, S.letterDepth / 100);
  const txt = textShapes(font, S.text || ' ', { capHeight: cap, spacing: S.spacing });
  const frontAcrylic = S.front.mat === 'acrylic';
  let mode = L.mode;
  if (lit && !frontAcrylic && (mode === 'front' || mode === 'front_halo')) {
    mode = 'halo';
    warnings.push('Muka huruf non-acrylic tidak tembus cahaya — otomatis memakai mode Halo (back-lit).');
  }
  if (lit && mode === 'side' && S.side.mat !== 'acrylic') {
    mode = 'halo';
    warnings.push('Mode samping butuh sisi acrylic — dialihkan ke Halo.');
  }
  const frontGlow = lit && (mode === 'front' || mode === 'front_halo');
  const sideGlow = lit && mode === 'side';
  const halo = lit && (mode === 'halo' || mode === 'front_halo');
  out.effectiveMode = lit ? mode : null;

  const panel = S.backPanel.on;
  const pad = panel ? S.backPanel.padding / 100 : 0;
  const standoff = halo ? Math.max(0.04, cap * 0.08) : 0.012;
  const panelT = 0.03;
  const zL = (panel ? panelT : 0) + standoff;
  const yOff = pad;

  const frontMat = makeMaterial(S.front.mat, S.front.color, { glow: frontGlow, ledColor });
  const sideMat = makeMaterial(S.side.mat, S.side.color, { glow: sideGlow, ledColor });
  if (frontGlow) glow.push({ mat: frontMat, base: 0.3 + 1.7 * b });
  if (sideGlow) glow.push({ mat: sideMat, base: 0.3 + 1.6 * b });

  if (txt.shapes.length) {
    const geo = new THREE.ExtrudeGeometry(txt.shapes, { depth, bevelEnabled: false, curveSegments: 6 });
    const mesh = new THREE.Mesh(geo, [frontMat, sideMat]);
    mesh.position.set(0, yOff, zL);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // tiang standoff kecil di belakang huruf
    if (standoff > 0.02) {
      const pinPts = sampleInside(txt.polys, Math.max(cap * 0.6, 0.15)).slice(0, 400);
      const pinGeo = new THREE.CylinderGeometry(0.006, 0.006, standoff, 6);
      pinGeo.rotateX(Math.PI / 2);
      const pins = new THREE.InstancedMesh(pinGeo, new THREE.MeshStandardMaterial({ color: '#777', metalness: 0.8, roughness: 0.4 }), Math.max(pinPts.length, 1));
      const m4 = new THREE.Matrix4();
      pinPts.forEach((p, i) => { m4.makeTranslation(p.x, p.y + yOff, zL - standoff / 2); pins.setMatrixAt(i, m4); });
      pins.count = pinPts.length;
      pins.userData.noPick = true;
      group.add(pins);
    }
  }
  const W = Math.max(txt.width, 0.05) + pad * 2;
  const H = Math.max(txt.height, 0.05) + pad * 2;

  if (panel) {
    const pm = makeMaterial('acp', S.backPanel.color);
    const pg = new THREE.ExtrudeGeometry(roundedRect(W, H, 0.03), { depth: panelT, bevelEnabled: false });
    const pmesh = new THREE.Mesh(pg, pm);
    pmesh.castShadow = true; pmesh.receiveShadow = true;
    group.add(pmesh);
  }

  // Modul LED dalam huruf
  if (typeLit) {
    const pts = sampleInside(txt.polys, Math.min(0.2, Math.max(0.045, cap / 3.2))).slice(0, 2500);
    out.ledCount = pts.length;
    const { inst, mat } = ledInstanced(pts, zL + depth * 0.25, L.color, Math.min(0.03, Math.max(0.012, cap / 14)));
    inst.position.y = yOff;
    inst.visible = L.xray;
    if (!L.on) mat.emissiveIntensity = 0;
    group.add(inst);
    out.leds = inst;
  }
  if (L.xray) {
    for (const m of [frontMat, sideMat]) { m.transparent = true; m.opacity = 0.22; m.depthWrite = false; }
  }

  // Halo glow (back-lit) — bayangan cahaya dari bentuk huruf yang di-blur
  if (halo && txt.polys.length) {
    const m = cap * 0.55;
    const bw = txt.width + m * 2;
    const bh = txt.height + m * 2;
    const res = 900;
    const cw = bw >= bh ? res : Math.round(res * (bw / bh));
    const chh = bw >= bh ? Math.round(res * (bh / bw)) : res;
    const c = document.createElement('canvas');
    c.width = Math.max(cw, 8); c.height = Math.max(chh, 8);
    const g = c.getContext('2d');
    const sx = c.width / bw;
    const toPx = (x, y) => [(x + bw / 2) * sx, c.height - (y + m) * sx];
    const blurBig = Math.max(4, cap * 0.32 * sx);
    const blurSmall = Math.max(2, cap * 0.1 * sx);
    g.fillStyle = '#ffffff';
    g.filter = `blur(${blurBig}px)`;
    drawPolys(g, txt.polys, toPx);
    g.globalAlpha = 0.9;
    g.filter = `blur(${blurSmall}px)`;
    drawPolys(g, txt.polys, toPx);
    g.filter = 'none';
    const tex = new THREE.CanvasTexture(c);
    const hm = new THREE.MeshBasicMaterial({ map: tex, color: ledColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 1 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), hm);
    plane.position.set(0, yOff + txt.height / 2, (panel ? panelT : 0) + 0.004);
    plane.userData.noPick = true;
    plane.renderOrder = 2;
    group.add(plane);
    out.halo = { mat: hm, base: 0.35 + 0.95 * b };
  }

  if (lit) {
    const light = new THREE.PointLight(ledColor, 1, Math.max(5, W * 2.2), 2);
    light.position.set(0, H / 2, zL + depth + Math.max(1.5, W * 0.45));
    group.add(light);
    out.light = light;
    out.lightBase = (0.6 + W * cap * 1.4) * b;
  }

  // bidang tak terlihat agar seluruh area huruf (termasuk celah) bisa diseret
  const pick = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ visible: false }));
  pick.position.set(0, H / 2, zL + depth);
  group.add(pick);

  out.letters = Array.from(S.text).filter((ch) => ch.trim()).length;
  out.area = W * H;
  out.size = { w: W, h: H, d: zL + depth };
  out.textWidth = txt.width; out.textHeight = txt.height;
  return out;
}

// ================= NEON FLEX =================
// Selang LED neon mengikuti garis tepi huruf, dipasang di papan acrylic.
export const NEON_BOARDS = [
  { id: 'clear', name: 'Acrylic bening' },
  { id: 'black', name: 'Acrylic hitam' },
  { id: 'white', name: 'Acrylic putih' },
  { id: 'none', name: 'Tanpa papan' },
];
function buildNeon(S, L, font, out, b, ledColor) {
  const { group, glow } = out;
  const lit = L.on;
  const cap = Math.max(0.05, S.letterHeight / 100);
  const txt = textShapes(font, S.text || ' ', { capHeight: cap, spacing: S.spacing });
  const r = THREE.MathUtils.clamp(cap * 0.03, 0.004, 0.011); // radius selang 8–22 mm
  const board = S.board || 'clear';
  const pad = Math.max(0.05, cap * 0.28);
  const boardT = board === 'none' ? 0 : 0.008;
  const W = Math.max(txt.width, 0.05) + pad * 2;
  const H = Math.max(txt.height, 0.05) + pad * 2;
  const zT = boardT + r + 0.004;

  // --- papan ---
  if (board !== 'none') {
    const mat = board === 'clear'
      ? new THREE.MeshStandardMaterial({ color: '#dfe9ef', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: board === 'black' ? '#121316' : '#f4f4f2', roughness: 0.25 });
    const geo = new THREE.ExtrudeGeometry(roundedRect(W, H, Math.min(0.03, W * 0.03)), { depth: boardT, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = board !== 'clear';
    group.add(mesh);
  }

  // --- selang neon ---
  const tubeMat = new THREE.MeshStandardMaterial({
    color: lit ? ledColor.clone().lerp(new THREE.Color('#ffffff'), 0.55) : '#e9e6e1',
    emissive: ledColor.clone(), emissiveIntensity: lit ? 1 : 0, roughness: 0.4,
  });
  tubeMat.userData.baseEmissive = ledColor.clone();
  if (lit) glow.push({ mat: tubeMat, base: 0.5 + 1.9 * b });
  let length = 0;
  const loops = [];
  for (const p of txt.polys) { loops.push(p.outer); for (const h of p.holes) loops.push(h); }
  for (const pts of loops) {
    if (pts.length < 3) continue;
    const v = pts.map((q) => new THREE.Vector3(q.x, q.y + pad, zT));
    if (v[0].distanceTo(v[v.length - 1]) < 1e-5) v.pop();
    const curve = new THREE.CatmullRomCurve3(v, true, 'centripetal');
    const len = curve.getLength();
    length += len;
    const seg = Math.min(600, Math.max(24, Math.round(len / (r * 1.6))));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 8, true), tubeMat);
    mesh.castShadow = true;
    group.add(mesh);
  }

  // --- pendar cahaya di papan / dinding ---
  if (lit && txt.polys.length) {
    const m = cap * 0.5;
    const bw = txt.width + m * 2, bh = txt.height + m * 2;
    const res = 1000;
    const c = document.createElement('canvas');
    c.width = Math.max(8, bw >= bh ? res : Math.round(res * bw / bh));
    c.height = Math.max(8, bw >= bh ? Math.round(res * bh / bw) : res);
    const g = c.getContext('2d');
    const sx = c.width / bw;
    const toPx = (x, y) => [(x + bw / 2) * sx, c.height - (y + m) * sx];
    g.strokeStyle = '#fff'; g.lineJoin = 'round';
    const stroke = (lw, blur, a) => {
      g.globalAlpha = a; g.filter = `blur(${blur}px)`; g.lineWidth = lw;
      for (const pts of loops) {
        g.beginPath();
        pts.forEach((q, i) => { const [x, y] = toPx(q.x, q.y); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.closePath(); g.stroke();
      }
    };
    stroke(r * 10 * sx, Math.max(4, cap * 0.22 * sx), 0.8);
    stroke(r * 4 * sx, Math.max(2, cap * 0.06 * sx), 0.9);
    g.filter = 'none'; g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    const hm = new THREE.MeshBasicMaterial({ map: tex, color: ledColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), hm);
    plane.position.set(0, pad + txt.height / 2, boardT + 0.002);
    plane.userData.noPick = true;
    plane.renderOrder = 2;
    group.add(plane);
    out.halo = { mat: hm, base: 0.45 + 0.9 * b };

    const light = new THREE.PointLight(ledColor, 1, Math.max(4, W * 2), 2);
    light.position.set(0, H / 2, Math.max(1.2, W * 0.4));
    group.add(light);
    out.light = light;
    out.lightBase = (0.5 + W * cap * 1.2) * b;
  }

  const pick = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ visible: false }));
  pick.position.set(0, H / 2, zT + r);
  group.add(pick);

  out.letters = Array.from(S.text).filter((ch) => ch.trim()).length;
  out.neonLength = length;
  out.area = W * H;
  out.size = { w: W, h: H, d: zT + r };
  out.textWidth = txt.width; out.textHeight = txt.height;
  out.effectiveMode = lit ? 'neon' : null;
  return out;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of ['map', 'emissiveMap']) if (m[k] && m[k].isCanvasTexture && !m[k].userData.shared) m[k].dispose();
      m.dispose();
    }
  });
}
