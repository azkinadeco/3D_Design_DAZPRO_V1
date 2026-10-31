// Font loader & text geometry helpers (data glyph dari tools/build_fonts.py)
import * as THREE from 'three';

const cache = new Map();
let indexPromise = null;

export function loadFontIndex() {
  if (!indexPromise) indexPromise = fetch('fonts/index.json').then((r) => r.json());
  return indexPromise;
}

export function loadFont(id) {
  if (!cache.has(id)) {
    const p = fetch(`fonts/${id}.json`)
      .then((r) => { if (!r.ok) throw new Error('font ' + id); return r.json(); })
      .then((data) => { data._parsed = new Map(); return data; });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id);
}

/** Parse "M0 0L10 0Q..Z" menjadi daftar kontur berisi perintah. */
function parseGlyph(font, ch) {
  if (font._parsed.has(ch)) return font._parsed.get(ch);
  const g = font.glyphs[ch] || font.glyphs['?'];
  if (!g) { font._parsed.set(ch, null); return null; }
  const [adv, d] = g;
  const contours = [];
  let cur = null;
  const re = /([MLQCZ])([^MLQCZ]*)/g;
  let m;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const nums = m[2].trim() ? m[2].trim().split(/\s+/).map(Number) : [];
    if (cmd === 'M') { cur = [{ c: 'M', p: nums }]; contours.push(cur); }
    else if (cmd === 'Z') { cur = null; }
    else if (cur) cur.push({ c: cmd, p: nums });
  }
  const out = { adv, contours: contours.filter((c) => c.length > 2) };
  font._parsed.set(ch, out);
  return out;
}

/**
 * Tata letak teks multi-baris. Hasil dalam satuan font (Y ke atas).
 * spacing: tracking dalam % em.
 */
export function layoutText(font, text, spacing = 0) {
  const lines = String(text || ' ').replace(/\r/g, '').split('\n').slice(0, 4);
  const track = (spacing / 100) * font.upm;
  const lineH = (font.asc - font.desc) * 1.02;
  const out = [];
  lines.forEach((line, li) => {
    let x = 0;
    const glyphs = [];
    const chars = Array.from(line);
    chars.forEach((ch, i) => {
      const g = parseGlyph(font, ch);
      if (!g) { x += font.upm * 0.3; return; }
      glyphs.push({ g, x });
      const next = chars[i + 1];
      const k = next ? font.kern[ch + next] || 0 : 0;
      x += g.adv + k + track;
    });
    if (chars.length) x -= track;
    out.push({ glyphs, width: Math.max(x, 1), y: -li * lineH });
  });
  const width = Math.max(...out.map((l) => l.width));
  return { lines: out, width, lineH, count: lines.length };
}

function contourToPath(cmds, ox, oy, s, PathCtor) {
  const path = new PathCtor();
  for (const { c, p } of cmds) {
    if (c === 'M') path.moveTo(ox + p[0] * s, oy + p[1] * s);
    else if (c === 'L') path.lineTo(ox + p[0] * s, oy + p[1] * s);
    else if (c === 'Q') path.quadraticCurveTo(ox + p[0] * s, oy + p[1] * s, ox + p[2] * s, oy + p[3] * s);
    else if (c === 'C') path.bezierCurveTo(ox + p[0] * s, oy + p[1] * s, ox + p[2] * s, oy + p[3] * s, ox + p[4] * s, oy + p[5] * s);
  }
  return path;
}

function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Bangun THREE.Shape[] untuk teks.
 * capHeight: tinggi huruf kapital dalam meter. Hasil dipusatkan: x tengah, y bawah = 0.
 */
export function textShapes(font, text, { capHeight = 0.5, spacing = 0, align = 'center' } = {}) {
  const lay = layoutText(font, text, spacing);
  const s = capHeight / (font.cap || font.upm * 0.7);
  const shapes = [];
  const polys = []; // untuk sampling LED
  for (const line of lay.lines) {
    const lx = align === 'center' ? (lay.width - line.width) / 2 : 0;
    for (const { g, x } of line.glyphs) {
      const ox = (lx + x) * s;
      const oy = line.y * s;
      const items = g.contours.map((cmds) => {
        const path = contourToPath(cmds, ox, oy, s, THREE.Path);
        const pts = path.getPoints(4);
        return { cmds, pts, area: THREE.ShapeUtils.area(pts) };
      }).filter((it) => Math.abs(it.area) > 1e-9);
      if (!items.length) continue;
      const biggest = items.reduce((a, b) => (Math.abs(b.area) > Math.abs(a.area) ? b : a));
      const outerSign = Math.sign(biggest.area);
      const solids = items.filter((it) => Math.sign(it.area) === outerSign);
      const holes = items.filter((it) => Math.sign(it.area) !== outerSign);
      const shapeOf = new Map();
      for (const sd of solids) {
        const shape = contourToPath(sd.cmds, ox, oy, s, THREE.Shape);
        shapeOf.set(sd, shape);
        shapes.push(shape);
        polys.push({ outer: sd.pts, holes: [] });
        sd._poly = polys[polys.length - 1];
      }
      for (const h of holes) {
        // lubang masuk ke solid terkecil yang memuatnya
        let best = null;
        for (const sd of solids) {
          if (pointInPoly(h.pts[0], sd.pts) && (!best || Math.abs(sd.area) < Math.abs(best.area))) best = sd;
        }
        if (best) {
          shapeOf.get(best).holes.push(contourToPath(h.cmds, ox, oy, s, THREE.Path));
          best._poly.holes.push(h.pts);
        }
      }
    }
  }
  // Pusatkan
  const box = new THREE.Box2();
  for (const p of polys) for (const v of p.outer) box.expandByPoint(v);
  if (box.isEmpty()) box.set(new THREE.Vector2(-0.1, 0), new THREE.Vector2(0.1, 0.1));
  const cx = (box.min.x + box.max.x) / 2;
  const by = box.min.y;
  const shift = (path) => {
    for (const c of path.curves) {
      for (const k of ['v0', 'v1', 'v2', 'v3']) if (c[k]) { c[k].x -= cx; c[k].y -= by; }
    }
  };
  for (const sh of shapes) { shift(sh); sh.holes.forEach(shift); }
  for (const p of polys) {
    for (const v of p.outer) { v.x -= cx; v.y -= by; }
    for (const h of p.holes) for (const v of h) { v.x -= cx; v.y -= by; }
  }
  // currentPoint juga digeser agar konsisten (tidak dipakai lagi tapi rapi)
  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;
  return { shapes, polys, width, height, scale: s, layout: lay };
}

/** Titik-titik di dalam bentuk huruf untuk menempatkan modul LED. */
export function sampleInside(polys, spacing) {
  const pts = [];
  for (const p of polys) {
    const b = new THREE.Box2();
    p.outer.forEach((v) => b.expandByPoint(v));
    const sx = Math.max(spacing, 0.03);
    const before = pts.length;
    for (let y = b.min.y + sx / 2; y < b.max.y; y += sx) {
      for (let x = b.min.x + sx / 2; x < b.max.x; x += sx) {
        const v = { x, y };
        if (pointInPoly(v, p.outer) && !p.holes.some((h) => pointInPoly(v, h))) pts.push(v);
      }
    }
    if (pts.length === before) {
      // bentuk kecil/tipis: taruh satu LED di titik kontur tengah
      const v = p.outer[Math.floor(p.outer.length / 2)];
      if (v) pts.push({ x: v.x, y: v.y });
    }
  }
  return pts;
}

/**
 * Gambar teks ke canvas 2D memakai glyph yang sama.
 * fit: { x, y, w, h } kotak target (px). Teks diskalakan agar muat & dipusatkan.
 */
export function drawTextFit(ctx, font, text, fit, { spacing = 0, color = '#fff' } = {}) {
  const lay = layoutText(font, text, spacing);
  const blockH = (font.cap) + (lay.count - 1) * lay.lineH;
  const s = Math.min(fit.w / lay.width, fit.h / blockH);
  const totalW = lay.width * s;
  const totalH = blockH * s;
  const x0 = fit.x + (fit.w - totalW) / 2;
  const yTop = fit.y + (fit.h - totalH) / 2; // posisi puncak kapital baris pertama
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const line of lay.lines) {
    const lx = (lay.width - line.width) / 2;
    const baseY = yTop + font.cap * s - line.y * s; // line.y negatif untuk baris bawah
    for (const { g, x } of line.glyphs) {
      const ox = x0 + (lx + x) * s;
      for (const cmds of g.contours) {
        for (const { c, p } of cmds) {
          const X = (i) => ox + p[i] * s;
          const Y = (i) => baseY - p[i] * s;
          if (c === 'M') ctx.moveTo(X(0), Y(1));
          else if (c === 'L') ctx.lineTo(X(0), Y(1));
          else if (c === 'Q') ctx.quadraticCurveTo(X(0), Y(1), X(2), Y(3));
          else if (c === 'C') ctx.bezierCurveTo(X(0), Y(1), X(2), Y(3), X(4), Y(5));
        }
        ctx.closePath();
      }
    }
  }
  ctx.fill('nonzero');
  ctx.restore();
  return { w: totalW, h: totalH };
}

/** Gambar bentuk polygon (meter) ke canvas — untuk efek halo yang presisi. */
export function drawPolys(ctx, polys, toPx) {
  ctx.beginPath();
  for (const p of polys) {
    const all = [p.outer, ...p.holes];
    for (const ring of all) {
      ring.forEach((v, i) => {
        const [X, Y] = toPx(v.x, v.y);
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.closePath();
    }
  }
  ctx.fill('evenodd');
}
