// Garis ukuran (dimensi) di sekitar signage — dalam koordinat lokal signage
import * as THREE from 'three';

const COLOR = '#ffd23f';
const fmtM = (v) => (v >= 1 ? `${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m` : `${Math.round(v * 100)} cm`);

function label(text, h) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const fs = 44;
  g.font = `700 ${fs}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 36;
  c.width = w; c.height = fs + 26;
  g.font = `700 ${fs}px "Plus Jakarta Sans", system-ui, sans-serif`;
  g.fillStyle = 'rgba(15,23,42,0.88)';
  const r = c.height / 2;
  g.beginPath();
  g.moveTo(r, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, c.height); g.arc(r, r, r, Math.PI / 2, Math.PI * 1.5);
  g.fill();
  g.fillStyle = COLOR;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(text, w / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false }));
  sp.scale.set(h * (w / c.height), h, 1);
  sp.renderOrder = 31;
  return sp;
}

/**
 * @param size  { w, h, d } meter
 * @param elevation  jarak bawah signage ke tanah/atap (meter), 0 = tanpa garis elevasi
 * @param elevLabel  keterangan garis elevasi
 */
export function buildDims(size, elevation = 0, elevLabel = 'dari tanah') {
  const g = new THREE.Group();
  g.userData.isDims = true;
  g.userData.noPick = true;
  const { w, h, d } = size;
  const off = Math.max(0.15, Math.max(w, h) * 0.06);
  const tick = off * 0.45;
  const lh = THREE.MathUtils.clamp(Math.max(w, h) * 0.07, 0.16, 0.55);
  const z = d + 0.02;
  const pts = [];
  const seg = (a, b) => pts.push(a, b);
  const V = (x, y, zz = z) => new THREE.Vector3(x, y, zz);
  // lebar (di atas)
  const yT = h + off;
  seg(V(-w / 2, yT), V(w / 2, yT));
  seg(V(-w / 2, yT - tick), V(-w / 2, yT + tick));
  seg(V(w / 2, yT - tick), V(w / 2, yT + tick));
  seg(V(-w / 2, h + 0.02), V(-w / 2, yT - tick)); seg(V(w / 2, h + 0.02), V(w / 2, yT - tick));
  // tinggi (kanan)
  const xR = w / 2 + off;
  seg(V(xR, 0), V(xR, h));
  seg(V(xR - tick, 0), V(xR + tick, 0));
  seg(V(xR - tick, h), V(xR + tick, h));
  // elevasi (kiri, ke bawah)
  const xL = -w / 2 - off;
  if (elevation > 0.05) {
    seg(V(xL, 0), V(xL, -elevation));
    seg(V(xL - tick, 0), V(xL + tick, 0));
    seg(V(xL - tick, -elevation), V(xL + tick, -elevation));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: COLOR, depthTest: false, transparent: true, toneMapped: false }));
  lines.renderOrder = 30;
  g.add(lines);

  const lw = label(`L ${fmtM(w)}`, lh); lw.position.set(0, yT + lh * 0.75, z); g.add(lw);
  const lhh = label(`T ${fmtM(h)}`, lh); lhh.position.set(xR + lhh.scale.x / 2 + tick, h / 2, z); g.add(lhh);
  if (elevation > 0.05) {
    const le = label(`${fmtM(elevation)} ${elevLabel}`, lh); le.position.set(xL - le.scale.x / 2 - tick, -elevation / 2, z); g.add(le);
  }
  g.traverse((o) => { o.userData.noPick = true; });
  return g;
}
