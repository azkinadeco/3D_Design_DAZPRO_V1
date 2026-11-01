// DAZPRO Signage Studio — aplikasi utama
import * as THREE from 'three';
import { Engine } from './engine.js';
import { buildCity, buildHero, placementInfo, buildConstruction, buildTotem, buildPole } from './environment.js';
import { buildSign, NEON_BOARDS } from './signage.js';
import { buildDims } from './dims.js';
import { loadFont, loadFontIndex, drawTextFit } from './fonts.js';
import { MAT_DEFAULT_COLOR } from './materials.js';
import { computePrice, formatRp, setRules, rulesActive, installTypeOf, powerEstimate } from './pricing.js';
import { ICONS } from './icons.js';
import { buildQuote } from './quote.js';
import { saveSubmission, getPriceRules, getSetting } from './firebase.js';
import { TEMPLATES } from './templates.js';
import { initGallery } from './gallery.js';
import {
  BRAND, PLACEMENTS, SIGN_TYPES, MATERIALS, SWATCHES, LED_COLORS, LED_MODES, LED_EFFECTS, LED_DENSITY, TIMES, BG_PRESETS,
  MAX_ITEMS, defaultState, defaultItem, INSTALL_TYPES, AREAS, ROOF_PLACEMENTS,
} from './config.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: d });
const clamp = THREE.MathUtils.clamp;
const UP = new THREE.Vector3(0, 1, 0);

// ---------- penyimpanan aman ----------
const store = {
  get(k, fb = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (_) { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } },
};

function deepMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(base)) {
    if (!(k in over)) continue;
    const b = base[k], o = over[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && o && typeof o === 'object' ? deepMerge(b, o) : o;
  }
  return out;
}

// ---------- state ----------
// state.items = daftar signage; state.sign / led / construction / pos = alias ke signage aktif
const ITEM_KEYS = ['sign', 'led', 'construction', 'pos'];
function attach(s) {
  for (const k of ITEM_KEYS) {
    Object.defineProperty(s, k, {
      get() { return s.items[s.active][k]; },
      set(v) { s.items[s.active][k] = v; },
      enumerable: false, configurable: true,
    });
  }
  return s;
}
/** Terima state lama (V1, satu signage) maupun baru, kembalikan state V2 yang lengkap. */
function normalize(raw) {
  let r = raw && typeof raw === 'object' ? { ...raw } : null;
  if (r && !Array.isArray(r.items) && r.sign) {
    r.items = [{ id: 1, sign: r.sign, led: r.led, construction: r.construction, pos: r.pos }];
    r.active = 0;
  }
  const s = deepMerge(defaultState(), r);
  const seen = new Set();
  s.items = (Array.isArray(s.items) ? s.items : []).slice(0, MAX_ITEMS).map((it, i) => {
    let id = Number(it && it.id) || i + 1;
    while (seen.has(id)) id++;
    seen.add(id);
    return deepMerge(defaultItem(id), { ...it, id });
  });
  if (!s.items.length) s.items = [defaultItem(1)];
  s.active = clamp(Number(s.active) || 0, 0, s.items.length - 1);
  s.v = 2;
  return attach(s);
}

let state = normalize(store.get('dazpro.current'));
const assets = { faceImgs: new Map(), logos: new Map(), wallTex: null, bgTex: null, wallAspect: null };
const logoCache = new Map();
let fontIndex = [];
let tab = 'lokasi';
let pricing = { lines: [], total: 0 };
const runtime = new Map(); // id -> { res, m }

const activeItem = () => state.items[state.active];
const itemName = (it, i = state.items.indexOf(it)) => (it.sign.text.split('\n')[0].trim() || SIGN_TYPES.find((t) => t.id === it.sign.type).name).slice(0, 18) || `Signage ${i + 1}`;
const viewOf = (it) => ({ placement: state.placement, sign: it.sign, led: it.led, construction: it.construction, pos: it.pos });

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
function setPath(obj, path, val) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys.at(-1)] = val;
}

// ---------- engine ----------
const viewport = $('#viewport');
const engine = new Engine(viewport, {
  onPick(id) {
    const i = state.items.findIndex((it) => it.id === id);
    if (i < 0) return null;
    if (i !== state.active) { state.active = i; onActiveChanged(); }
    const rt = runtime.get(id);
    return rt && rt.m ? { plane: rt.m.plane, origin: rt.m.origin } : null;
  },
  onDrag(id, p) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    const info = placementInfo(state);
    if (info.kind === 'wall') { it.pos.x = p.x; it.pos.y = p.y; } else { it.pos.x = p.x; it.pos.z = p.z; }
    mountItem(it, false);
    syncPosInputs();
  },
  onDragEnd() { autosave(); updateSummary(); commit(); },
  onModeChange(m) {
    $('#walk-ui').hidden = m !== 'walk';
    $('#vp-hint').hidden = m === 'walk';
    viewport.classList.toggle('walking', m === 'walk');
    if (m === 'walk') setSpin(false);
    $$('#cams button').forEach((b) => b.classList.toggle('active', m === 'walk' && b.dataset.cam === 'walk'));
  },
  onWalkView(v) { $('#walk-view').textContent = v === 'third' ? 'Orang pertama' : 'Orang ketiga'; },
});

// ---------- kualitas grafis ----------
const quality = { mode: store.get('dazpro.quality', 'auto') };
function weakDevice() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  return coarse && (mem <= 4 || cores <= 4);
}
function applyQuality() {
  const level = quality.mode === 'auto' ? (quality.autoLow || weakDevice() ? 'low' : 'high') : quality.mode;
  engine.setQuality(level);
  if (quality.mode === 'auto' && level === 'high') {
    engine.watchFps(() => { quality.autoLow = true; applyQuality(); toast('Grafis dialihkan ke mode ringan agar lebih lancar'); if (tab === 'lokasi') renderPanel(); });
  } else engine.watchFps(null);
}

// ---------- pipeline build ----------
let pending = {};
let scheduled = false;
let ready = false;
const tokens = new Map();
function invalidate(flags) {
  if (flags.signs && pending.signs === 'all') flags = { ...flags, signs: 'all' };
  Object.assign(pending, flags);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(flush);
}
async function flush() {
  scheduled = false;
  const f = pending; pending = {};
  if (f.time) applyTime();
  if (f.hero) rebuildHero();
  if (f.signs === 'all') await rebuildAll();
  else if (f.signs === 'active') await rebuildItem(activeItem());
  if ((f.mount || f.hero) && f.signs !== 'all') state.items.forEach((it) => mountItem(it, true));
  afterBuild();
}

function applyTime() {
  const indoor = state.placement === 'mall';
  engine.indoor = indoor;
  engine.camYMax = indoor ? 4.5 : 0;
  engine.camZMax = indoor ? 8.4 : 0;
  engine.setTime(state.time, state.bg, assets.bgTex);
  engine.setCityVisible(state.env.showCity !== false && state.placement !== 'mall');
}

function rebuildHero() {
  const ctx = { windowMats: [], lampMats: [], lampLights: [] };
  const { group } = buildHero(state, ctx, assets);
  engine.setHero(group, ctx);
}

async function rebuildAll() {
  const ids = new Set(state.items.map((it) => it.id));
  for (const id of [...runtime.keys()]) if (!ids.has(id)) { engine.removeItem(id); runtime.delete(id); }
  await Promise.all(state.items.map((it) => rebuildItem(it)));
}

async function rebuildItem(it) {
  if (!it) return;
  const token = (tokens.get(it.id) || 0) + 1;
  tokens.set(it.id, token);
  let font;
  try { font = await loadFont(it.sign.font); } catch (e) {
    toast('Font gagal dimuat, memakai Poppins');
    it.sign.font = 'poppins';
    font = await loadFont('poppins');
  }
  if (tokens.get(it.id) !== token || !state.items.includes(it)) return;
  const res = buildSign(viewOf(it), font, { logo: assets.logos.get(it.id) || null, faceImage: assets.faceImgs.get(it.id) || null });
  engine.setItemSign(it.id, res.group, {
    glow: res.glow, halo: res.halo, light: res.light, lightBase: res.lightBase || 0,
    effect: it.led.effect, ledColor: new THREE.Color(it.led.color),
  });
  runtime.set(it.id, { ...(runtime.get(it.id) || {}), res });
  mountItem(it, true);
}

/** Tempatkan satu signage & struktur pendukungnya sesuai lokasi. */
function mountItem(it, rebuildSupport) {
  const rt = runtime.get(it.id);
  if (!rt || !rt.res) return;
  const info = placementInfo(state);
  const size = rt.res.size;
  const p = it.pos;
  const rot = THREE.MathUtils.degToRad(p.rot || 0);
  let signPos, supportPos, signRot = rot, plane, origin, elevation = 0, elevLabel = 'dari tanah';
  const m = { consArea: 0, poleH: 0, totemH: 0 };

  if (info.kind === 'roof') {
    const hx = Math.max(0, (info.x[1] - info.x[0]) / 2 - size.w / 2 - (info.edge ?? 0.3));
    p.x = clamp(p.x, -hx, hx);
    const zr = info.zr || [info.z[0] + 2.6, info.z[1] - 0.4];
    p.z = clamp(p.z, zr[0], zr[1]);
    const consH = it.construction.on ? it.construction.height / 100 : 0;
    signPos = new THREE.Vector3(p.x, info.roofY + (it.construction.on ? consH : 0.02), p.z);
    supportPos = new THREE.Vector3(p.x, info.roofY, p.z);
    if (rebuildSupport) {
      const g = new THREE.Group();
      if (it.construction.on) {
        const c = buildConstruction(size, consH, it.construction.color);
        g.add(c);
        m.consArea = c.userData.frameArea;
      }
      engine.setItemSupport(it.id, g);
    } else if (rt.m) m.consArea = rt.m.consArea;
    elevation = consH; elevLabel = 'dari atap';
    plane = new THREE.Plane(UP, -info.roofY);
    origin = () => new THREE.Vector3(it.pos.x, info.roofY, it.pos.z);
  } else if (info.kind === 'ground') {
    p.x = clamp(p.x, info.x[0], info.x[1]);
    p.z = clamp(p.z, info.z[0], info.z[1]);
    supportPos = new THREE.Vector3(p.x, 0, p.z);
    let local;
    if (state.placement === 'totem') {
      const t = buildTotem(size, state.env.totemHeight, state.env.structColor);
      if (rebuildSupport) engine.setItemSupport(it.id, t.group);
      local = new THREE.Vector3(0, t.signY, t.frontZ);
      m.totemH = t.height;
    } else {
      const isBox = it.sign.type.startsWith('box_');
      const t = buildPole(size, state.env.poleHeight, state.env.structColor, isBox);
      if (rebuildSupport) engine.setItemSupport(it.id, t.group);
      local = new THREE.Vector3(0, t.signY, t.signZ);
      m.poleH = state.env.poleHeight + size.h * (isBox ? 0 : 0.85);
    }
    signPos = local.applyAxisAngle(UP, rot).add(supportPos);
    elevation = signPos.y;
    plane = new THREE.Plane(UP, 0);
    origin = () => new THREE.Vector3(it.pos.x, 0, it.pos.z);
  } else {
    const W = info.w, H = info.h;
    const hx = Math.max(0, W / 2 - size.w / 2);
    p.x = clamp(p.x, -hx, hx);
    const y0 = info.yMin ?? 0.05;
    p.y = clamp(p.y, y0, Math.max(y0, H - size.h));
    signPos = new THREE.Vector3(p.x, p.y, 0);
    supportPos = new THREE.Vector3();
    signRot = 0;
    if (rebuildSupport) engine.setItemSupport(it.id, null);
    elevation = p.y; elevLabel = 'dari lantai';
    plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    origin = () => new THREE.Vector3(it.pos.x, it.pos.y, 0);
  }
  engine.setItemTransform(it.id, signPos, signRot, supportPos, info.kind === 'wall' ? 0 : rot);
  const center = new THREE.Vector3(0, size.h / 2, size.d / 2).applyAxisAngle(UP, signRot).add(signPos);
  // garis ukuran (dibuat ulang hanya bila berubah)
  const showD = state.showDims && it === activeItem();
  const dimKey = showD ? `${size.w.toFixed(3)}|${size.h.toFixed(3)}|${size.d.toFixed(3)}|${elevation.toFixed(2)}|${elevLabel}` : '';
  if (!rt.m || rt.m.dimKey !== dimKey) engine.setItemDims(it.id, showD ? buildDims(size, elevation, elevLabel) : null);
  rt.m = { ...m, plane, origin, center, rot: signRot, size, elevation, elevLabel, dimKey };
  if (it === activeItem()) engine.focus(center, size, signRot);
}

function afterBuild() {
  engine.select(activeItem().id, state.items.length > 1);
  updateSummary();
  updateSpec();
  showWarnings();
  if (!ready && runtime.get(activeItem().id)?.m) {
    ready = true;
    engine.cameraPreset(state.placement === 'wall' || state.placement === 'mall' ? 'front' : state.placement === 'rooftop' ? 'street' : 'hero', true);
    $('#loader').classList.add('done');
  }
}

function onActiveChanged() {
  if (state.showDims) state.items.forEach((it) => mountItem(it, false));
  const rt = runtime.get(activeItem().id);
  if (rt && rt.m) engine.focus(rt.m.center, rt.m.size, rt.m.rot);
  engine.select(activeItem().id, state.items.length > 1);
  renderItems();
  renderPanel();
  updateSummary();
  updateSpec();
  showWarnings();
}

function showWarnings() {
  const w = $('#vp-warn');
  const rt = runtime.get(activeItem().id);
  const list = rt && rt.res ? rt.res.warnings : [];
  w.hidden = !list.length;
  w.textContent = list.join(' ');
}

// ---------- ringkasan & harga ----------
function metricsOf(it) {
  const rt = runtime.get(it.id) || {};
  const r = rt.res, m = rt.m || {};
  return {
    area: r ? r.area : 0, ledCount: r ? r.ledCount : 0, letters: r ? r.letters : 0, size: r ? r.size : null, neonLength: r ? r.neonLength || 0 : 0,
    consArea: m.consArea || 0, poleH: m.poleH || 0, totemH: m.totemH || 0,
  };
}

function describe(it) {
  const S = it.sign;
  const rt = runtime.get(it.id);
  const type = SIGN_TYPES.find((t) => t.id === S.type);
  const what = type.group === 'box' ? `${S.width}×${S.type === 'box_rect' ? S.height : S.width} cm` : `${rt && rt.res ? rt.res.letters : '?'} huruf × ${S.letterHeight} cm`;
  return `${type.name} · ${what}${it.led.on && type.lit ? ' · LED ' + (LED_COLORS.find((c) => c.hex === it.led.color)?.name || 'custom') : ''}`;
}

function updateSummary() {
  if (!state.items.every((it) => runtime.get(it.id)?.res)) return;
  pricing = computePrice(state.placement, state.items.map((it, i) => ({ id: it.id, name: itemName(it, i), view: viewOf(it), metrics: metricsOf(it) })), { floors: state.env.floors, install: state.install, area: state.area, skip: state.skipAdd || [] });
  $('#sum-price').textContent = formatRp(pricing.total);
  const pl = PLACEMENTS.find((p) => p.id === state.placement);
  const n = state.items.length;
  $('#sum-title').textContent = n > 1 ? `${n} signage · ${pl.name}` : itemName(activeItem());
  $('#sum-meta').textContent = n > 1 ? state.items.map((it, i) => itemName(it, i)).join(' · ') : `${describe(activeItem())} · ${pl.name}`;
  $('#vp-title').textContent = `${pl.name} · ${SIGN_TYPES.find((t) => t.id === state.sign.type).name}`;
}

function power() {
  return powerEstimate(state.items.map((it) => ({ view: viewOf(it), metrics: metricsOf(it) })), state.hours || 12);
}
const powerText = (p) => `±${formatRp(p.rpMonth)}/bulan · ${fmt(p.watt, 0)} W · ${fmt(p.kwhMonth, 0)} kWh (${p.hours} jam/hari)`;
function powerBlock() {
  const p = power();
  if (!p.watt) return '';
  return `<div class="read">${ICONS.bulb}<div><b>Listrik ±${formatRp(p.rpMonth)}/bulan</b><span>${fmt(p.watt, 0)} W × ${p.hours} jam/hari ≈ ${fmt(p.kwhMonth, 0)} kWh · tarif Rp${p.rate.toLocaleString('id-ID', { maximumFractionDigits: 2 })}/kWh</span></div></div>`;
}
function updateSpec() {
  const rt = runtime.get(activeItem().id);
  if (!rt || !rt.res) return;
  const s = rt.res.size;
  $('#vp-spec').textContent = `${state.items.length > 1 ? itemName(activeItem()) + ' · ' : ''}L ${fmt(s.w)} m × T ${fmt(s.h)} m × D ${fmt(s.d * 100, 0)} cm`;
  const out = $('#model-size');
  if (out) out.textContent = `Ukuran jadi ≈ ${fmt(s.w)} × ${fmt(s.h)} m`;
  const pb = $('#power-box');
  if (pb) pb.innerHTML = powerBlock();
  const rb = $('#read-box');
  if (rb) rb.innerHTML = readBlock(activeItem());
  const lc = $('#led-count');
  if (lc) lc.textContent = rt.res.ledCount ? `${rt.res.ledCount} modul LED terpasang` : '';
}

// ---------- autosave ----------
let saveTimer = 0;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set('dazpro.current', state), 400);
}

// ---------- riwayat (undo / redo) ----------
const hist = { stack: [], idx: -1, imgId: new Map(), imgs: [] };
function snap() {
  return JSON.stringify(state, (k, v) => {
    if (typeof v === 'string' && v.startsWith('data:')) {
      if (!hist.imgId.has(v)) { hist.imgId.set(v, '@img' + hist.imgs.length); hist.imgs.push(v); }
      return hist.imgId.get(v);
    }
    return v;
  });
}
const unsnap = (str) => JSON.parse(str, (k, v) => (typeof v === 'string' && v.startsWith('@img') ? hist.imgs[+v.slice(4)] ?? null : v));
function pushHistory() {
  const s = snap();
  if (s === hist.stack[hist.idx]) return;
  hist.stack = hist.stack.slice(0, hist.idx + 1);
  hist.stack.push(s);
  if (hist.stack.length > 80) hist.stack.shift();
  hist.idx = hist.stack.length - 1;
  updateHistoryButtons();
}
let commitT = 0;
function commit() { clearTimeout(commitT); commitT = setTimeout(pushHistory, 450); }
async function travel(dir) {
  clearTimeout(commitT);
  pushHistory(); // simpan perubahan yang belum tercatat
  const next = hist.idx + dir;
  if (next < 0 || next >= hist.stack.length) return;
  hist.idx = next;
  await restore(unsnap(hist.stack[next]));
  updateHistoryButtons();
  toast(dir < 0 ? 'Dibatalkan' : 'Diulang');
}
function updateHistoryButtons() {
  const u = $('#btn-undo'), r = $('#btn-redo');
  if (u) u.disabled = hist.idx <= 0;
  if (r) r.disabled = hist.idx >= hist.stack.length - 1;
}

// ================= UI PANEL =================
const TABS = [
  { id: 'lokasi', name: 'Lokasi', icon: 'pin' },
  { id: 'model', name: 'Model', icon: 'shapes' },
  { id: 'teks', name: 'Teks', icon: 'type' },
  { id: 'bahan', name: 'Bahan', icon: 'layers' },
  { id: 'lampu', name: 'Lampu', icon: 'bulb' },
  { id: 'struktur', name: 'Struktur', icon: 'frame' },
];

function renderTabs() {
  $('#tabs').innerHTML = TABS.map((t) => `<button class="step ${t.id === tab ? 'active' : ''}" data-tab="${t.id}" role="tab">${ICONS[t.icon]}${t.name}</button>`).join('');
}

const chip = (path, value, label, cur) => `<button class="chip ${cur === value ? 'active' : ''}" data-set="${path}" data-value="${esc(value)}">${esc(label)}</button>`;
const range = (path, label, min, max, step, unit = '', val = getPath(state, path)) => `
  <div class="group"><div class="lbl">${label}<span class="val" data-out="${path}">${fmt(val, 2)}${unit}</span></div>
  <input class="range" type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-bind="${path}" data-unit="${unit}" /></div>`;
const numIn = (path, label, min, max, step = 1) => `<label class="num-in">${label}<input class="input" type="number" min="${min}" max="${max}" step="${step}" value="${getPath(state, path)}" data-bind="${path}" data-num /></label>`;
const toggle = (path, title, sub) => `<label class="toggle"><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div><span class="switch"><input type="checkbox" data-bind="${path}" ${getPath(state, path) ? 'checked' : ''} /><i></i></span></label>`;
function swatches(path, list = SWATCHES) {
  const cur = String(getPath(state, path)).toLowerCase();
  return `<div class="swatches">${list.map((c) => `<button class="sw ${c.toLowerCase() === cur ? 'active' : ''}" style="background:${c}" data-set="${path}" data-value="${c}" title="${c}"></button>`).join('')}
    <label class="sw-custom" title="Warna custom"><input type="color" value="${cur}" data-bind="${path}" /></label></div>`;
}
function upload(key, title, has, thumb) {
  return `<div class="upload">${has ? `<img src="${thumb}" alt="" />` : `<div class="ph">${ICONS.upload}</div>`}
    <div class="grow"><b>${title}</b>${has ? 'Gambar terpasang' : 'JPG / PNG, maks ±8 MB'}</div>
    <label class="btn btn-sm btn-ghost">${has ? 'Ganti' : 'Upload'}<input type="file" accept="image/*" data-upload="${key}" /></label>
    ${has ? `<button class="btn btn-sm btn-ghost" data-action="clear" data-key="${key}">Hapus</button>` : ''}</div>`;
}

function panelLokasi() {
  const S = state, info = placementInfo(S);
  let specific = '';
  if (S.placement === 'rooftop') specific = range('env.floors', 'Jumlah lantai gedung', 2, 14, 1, ' lt');
  if (S.placement === 'totem') specific = range('env.totemHeight', 'Tinggi totem', 2.5, 12, 0.1, ' m') + `<div class="group"><div class="lbl">Warna badan totem</div>${swatches('env.structColor', ['#2a2f37', '#111318', '#ffffff', '#9ca3af', '#c8a24a', '#e11d2e', '#2563eb'])}</div>`;
  if (S.placement === 'pole') specific = range('env.poleHeight', 'Tinggi tiang (sampai bawah signage)', 2.5, 10, 0.1, ' m') + `<div class="group"><div class="lbl">Warna tiang</div>${swatches('env.structColor', ['#2a2f37', '#111318', '#ffffff', '#9ca3af', '#c8a24a'])}</div>`;
  if (S.placement === 'wall') {
    specific = `<div class="group"><div class="lbl">Foto tembok / fasad</div>${upload('wall.image', 'Foto lokasi pemasangan', !!S.wall.image, S.wall.image)}
      <p class="hint">Upload foto tembok/fasad Anda, lalu atur ukuran tembok sesuai lebar asli agar skala signage akurat. Seret signage ke posisi yang diinginkan.</p></div>
      <div class="row">${numIn('wall.width', 'Lebar tembok (m)', 2, 40, 0.1)}${numIn('wall.height', 'Tinggi tembok (m)', 1.5, 30, 0.1)}</div>
      <div class="group" style="margin-top:10px">${toggle('wall.lockRatio', 'Kunci rasio foto', 'Tinggi tembok mengikuti proporsi foto')}</div>
      ${S.wall.image ? '' : `<div class="group"><div class="lbl">Warna tembok</div>${swatches('wall.color', ['#d9d4cc', '#f2efe9', '#8f8a82', '#3b3f46', '#b65f3a', '#e8dcc4'])}</div>`}`;
  }
  if (S.placement === 'mall') specific = range('env.mallW', 'Lebar toko (fasad)', 3, 14, 0.1, ' m') + `<div class="group"><div class="lbl">Warna fasad / list plang</div>${swatches('env.mallFascia', ['#1f2329', '#ffffff', '#e8e4dc', '#2d4a3e', '#3b3f6b', '#8a1c1c', '#c8a24a'])}</div><p class="hint">Signage dipasang di list plang di atas etalase kaca toko.</p>`;
  if (S.placement === 'booth') specific = range('env.boothL', 'Panjang booth kontainer', 3, 12, 0.1, ' m') + range('env.boothW', 'Lebar booth kontainer', 2, 3.5, 0.05, ' m') + `<div class="group"><div class="lbl">Warna kontainer</div>${swatches('env.boothColor', ['#d9481f', '#1f5fa8', '#2f7d4a', '#f2c230', '#1d1f24', '#f4f1ea', '#8a1c1c', '#6b7280'])}</div>`;
  const posCtl = info.kind === 'wall'
    ? range('pos.x', 'Geser horizontal', -info.w / 2, info.w / 2, 0.01, ' m') + range('pos.y', 'Tinggi dari lantai', info.yMin ?? 0, info.h, 0.01, ' m')
    : range('pos.x', 'Geser kiri–kanan', info.x[0], info.x[1], 0.01, ' m') + range('pos.z', 'Maju–mundur', info.kind === 'roof' ? info.z[0] + 2.6 : info.z[0], info.kind === 'roof' ? info.z[1] - 0.4 : info.z[1], 0.01, ' m') + range('pos.rot', 'Rotasi', -180, 180, 1, '°');
  return `<h2 class="sec-title">Lokasi pemasangan</h2><p class="sec-sub">Pilih di mana signage akan dipasang.</p>
    <div class="group"><div class="cards">${PLACEMENTS.map((p) => `<button class="card ${S.placement === p.id ? 'active' : ''}" data-set="placement" data-value="${p.id}"><div class="ic">${ICONS[p.id]}</div><b>${p.name}</b><span>${p.desc}</span></button>`).join('')}</div></div>
    ${specific}
    ${rulesActive() ? `<div class="group"><div class="lbl">Jenis pemasangan</div><div class="seg-ctl">${chip('install', 'auto', 'Otomatis', S.install)}${INSTALL_TYPES.map((t) => chip('install', t.id, t.name, S.install)).join('')}</div>
      ${S.install === 'auto' ? `<p class="hint">Otomatis: ${esc(INSTALL_TYPES.find((t) => t.id === installTypeOf({ placement: S.placement, install: 'auto' })).name)}</p>` : ''}</div>
    <div class="group"><div class="lbl">Area pemasangan (transport)</div><div class="seg-ctl">${AREAS.map((a) => chip('area', a.id, a.name, S.area)).join('')}</div></div>` : ''}
    <div class="divider"></div>
    <div class="group"><div class="lbl">Posisi${state.items.length > 1 ? `<span class="val">${esc(itemName(activeItem()))}</span>` : ' signage'}</div><p class="hint" style="margin:-4px 0 10px">Tip: seret langsung signage di layar 3D.</p>${posCtl}
      <button class="btn btn-sm btn-ghost" data-action="center">Kembalikan ke posisi awal</button></div>
    <div class="divider"></div>
    <div class="group"><div class="lbl">Latar belakang</div><div class="seg-ctl">${BG_PRESETS.map((b) => chip('bg.mode', b.id, b.name, S.bg.mode)).join('')}</div></div>
    ${S.bg.mode === 'color' ? `<div class="group">${swatches('bg.color', ['#dfe4ea', '#ffffff', '#0f172a', '#1e293b', '#f5efe6', '#d1e7f5'])}</div>` : ''}
    ${S.bg.mode === 'image' ? `<div class="group">${upload('bg.image', 'Foto latar', !!S.bg.image, S.bg.image)}<p class="hint">Foto 360° (rasio 2:1) akan menjadi panorama; foto biasa jadi latar layar.</p></div>` : ''}
    <div class="group">${toggle('env.showCity', 'Tampilkan lingkungan kota', 'Matikan untuk tampilan bersih dengan foto latar')}</div>
    <div class="group"><div class="lbl">Kualitas grafis<span class="val">${quality.mode === 'auto' ? (engine.quality === 'low' ? 'otomatis: ringan' : 'otomatis: tinggi') : ''}</span></div>
      <div class="seg-ctl">${[['auto', 'Otomatis'], ['high', 'Tinggi'], ['low', 'Ringan']].map(([id, n]) => `<button class="chip ${quality.mode === id ? 'active' : ''}" data-quality="${id}">${n}</button>`).join('')}</div>
      <p class="hint">Pilih Ringan jika tampilan 3D terasa patah-patah di HP.</p></div>`;
}

function panelModel() {
  const S = state.sign;
  const t = SIGN_TYPES.find((x) => x.id === S.type);
  let dims;
  if (t.group === 'box') {
    dims = `<div class="row3">${numIn('sign.width', S.type === 'box_round' ? 'Diameter (cm)' : 'Lebar (cm)', 30, 1200)}${S.type === 'box_rect' ? numIn('sign.height', 'Tinggi (cm)', 20, 600) : '<span></span>'}${numIn('sign.depth', 'Tebal (cm)', 8, 60)}</div>`;
  } else if (t.group === 'neon') {
    dims = range('sign.letterHeight', 'Tinggi huruf kapital', 8, 120, 1, ' cm')
      + `<div class="group"><div class="lbl">Papan</div><div class="seg-ctl">${NEON_BOARDS.map((x) => chip('sign.board', x.id, x.name, S.board || 'clear')).join('')}</div></div>`;
  } else {
    dims = range('sign.letterHeight', 'Tinggi huruf kapital', 10, 300, 1, ' cm') + range('sign.letterDepth', 'Tebal huruf (return)', 2, 30, 0.5, ' cm');
  }
  return `<h2 class="sec-title">Model signage</h2><p class="sec-sub">Neon box, huruf timbul, atau neon flex.</p>
    <div class="group"><div class="cards">${SIGN_TYPES.map((x) => `<button class="card ${S.type === x.id ? 'active' : ''}" data-set="sign.type" data-value="${x.id}"><div class="ic">${ICONS[x.id]}</div><b>${x.name}</b><span>${x.desc}</span></button>`).join('')}</div></div>
    ${t.group === 'box' ? `<div class="group"><div class="lbl">Jumlah sisi</div><div class="seg-ctl">${chip('sign.sides', 1, '1 sisi', S.sides === 2 ? 2 : 1)}${chip('sign.sides', 2, '2 sisi (depan–belakang)', S.sides === 2 ? 2 : 1)}</div><p class="hint">2 sisi: tulisan terlihat dari depan dan belakang — cocok untuk tiang & papan yang tegak lurus jalan.</p></div>` : ''}
    <div class="group"><div class="lbl">Ukuran<span class="val" id="model-size"></span></div>${dims}<div id="read-box">${readBlock(activeItem())}</div></div>
    ${t.group === 'box' ? '' : `<p class="hint">Lebar total mengikuti panjang teks & font. Lihat ukuran jadi di pojok kanan bawah layar.</p>`}`;
}

function panelTeks() {
  const S = state.sign;
  const isBox = S.type.startsWith('box_');
  const cats = [...new Set(fontIndex.map((f) => f.cat))];
  return `<h2 class="sec-title">Teks & font</h2><p class="sec-sub">Tekan Enter untuk baris baru (maks. 4 baris).</p>
    <div class="group"><textarea class="input" rows="2" maxlength="80" data-bind="sign.text" placeholder="Nama usaha">${esc(S.text)}</textarea></div>
    <div class="group"><div class="lbl">Font<span class="val">${esc((fontIndex.find((f) => f.id === S.font) || {}).name || '')}</span></div>
      <div class="font-list">${cats.map((c) => fontIndex.filter((f) => f.cat === c).map((f) => `<button class="font-item ${S.font === f.id ? 'active' : ''}" data-set="sign.font" data-value="${f.id}"><canvas data-font="${f.id}" width="300" height="68"></canvas><span>${f.name} · ${c}</span></button>`).join('')).join('')}</div></div>
    ${range('sign.spacing', 'Jarak antar huruf', -5, 40, 0.5, '%')}
    <div class="group" id="read-box">${readBlock(activeItem())}</div>
    ${isBox ? `<div class="group"><div class="lbl">Desain muka custom (gambar)</div>${upload('sign.faceImage', 'Gambar desain neon box', !!S.faceImage, S.faceImage)}
      <p class="hint">Upload desain Anda (JPG/PNG). Gambar menutupi seluruh muka neon box dan ikut menyala. Untuk hasil terbaik, sesuaikan rasio gambar dengan ukuran box.</p>
      ${S.faceImage ? `<div style="margin-top:10px">${toggle('sign.faceText', 'Tampilkan teks di atas gambar', 'Teks & warna teks di bawah ikut tampil')}</div>` : ''}</div>
      <div class="group"><div class="lbl">Warna teks pada muka</div>${swatches('sign.textColor')}</div>
      ${range('sign.textScale', 'Ukuran teks pada muka', 25, 100, 1, '%')}
      <div class="group"><div class="lbl">Logo (opsional)</div>${upload('sign.logo', 'Logo usaha', !!S.logo, S.logo)}<p class="hint">PNG transparan paling bagus. Logo diletakkan di kiri teks.</p></div>`
    : S.type === 'neon_flex' ? `<p class="hint">Warna neon diatur di tab <b>Lampu</b>. Font script / tulisan tangan paling cocok untuk neon flex.</p>`
    : `<p class="hint">Warna huruf diatur di tab <b>Bahan</b> (muka depan & samping).</p>`}`;
}

function matBlock(path, title, sub) {
  const cur = getPath(state, path);
  return `<div class="subcard"><h4>${title}<small>${sub}</small></h4>
    <div class="mat-grid">${MATERIALS.map((m) => `<button class="mat ${cur.mat === m.id ? 'active' : ''}" data-mat="${path}" data-value="${m.id}" title="${m.desc}"><i class="m-${m.id}"></i>${m.name.replace('Stainless ', 'SS ')}</button>`).join('')}</div>
    <div class="lbl" style="margin-top:12px">Warna</div>${swatches(path + '.color', cur.mat === 'stainless' || cur.mat === 'mirror' ? ['#c9cdd3', '#e8eaee', '#d6b06a', '#b76e79', '#2b2d31', '#111318'] : SWATCHES)}</div>`;
}

function panelBahan() {
  const S = state.sign;
  if (S.type === 'neon_flex') {
    return `<h2 class="sec-title">Bahan & warna</h2><p class="sec-sub">Neon flex memakai selang LED silikon di atas papan acrylic.</p>
      <div class="group"><div class="lbl">Papan</div><div class="seg-ctl">${NEON_BOARDS.map((x) => chip('sign.board', x.id, x.name, S.board || 'clear')).join('')}</div>
      <p class="hint">Papan acrylic dipotong mengikuti kotak tulisan. Acrylic bening paling populer untuk dinding kafe & toko.</p></div>
      <div class="note">Warna neon diatur di tab <b>Lampu</b>.</div>`;
  }
  const isBox = S.type.startsWith('box_');
  return `<h2 class="sec-title">Bahan & warna</h2><p class="sec-sub">Atur bahan bagian depan (muka) dan sisi samping secara terpisah.</p>
    ${matBlock('sign.front', 'Depan (muka)', isBox ? 'panel muka neon box' : 'permukaan huruf')}
    ${matBlock('sign.side', 'Sisi samping', isBox ? 'rangka / list samping' : 'return / tebal huruf')}
    ${!isBox ? `<div class="group">${toggle('sign.backPanel.on', 'Panel latar (backing ACP)', 'Plat di belakang huruf, cocok untuk atas gedung & tiang')}</div>
      ${S.backPanel.on ? `<div class="group"><div class="lbl">Warna panel</div>${swatches('sign.backPanel.color')}</div>${range('sign.backPanel.padding', 'Jarak tepi panel', 5, 80, 1, ' cm')}` : ''}` : ''}
    <p class="hint">Acrylic bisa tembus cahaya LED. Stainless, gold, ACP, dan mirror tidak tembus — gunakan mode Halo agar cahaya memantul di belakang huruf.</p>`;
}

function panelLampu() {
  const S = state.sign, L = state.led;
  const t = SIGN_TYPES.find((x) => x.id === S.type);
  if (!t.lit) {
    return `<h2 class="sec-title">Lampu LED</h2><p class="sec-sub">Model saat ini tanpa lampu.</p>
      <div class="note">Huruf timbul non-lampu tidak memakai LED.</div>
      <button class="btn btn-primary btn-sm" style="margin-top:12px" data-set="sign.type" data-value="letters_lit">Ganti ke Huruf Timbul Menyala</button>`;
  }
  const isBox = t.group === 'box';
  if (t.group === 'neon') {
    return `<h2 class="sec-title">Lampu neon</h2><p class="sec-sub">Warna dan efek selang LED neon flex.</p>
      <div class="group">${toggle('led.on', 'Neon menyala', 'Matikan untuk melihat tampilan saat lampu padam')}</div>
      <div class="group"><div class="lbl">Warna neon<span class="val">${esc((LED_COLORS.find((c) => c.hex === L.color) || { name: 'Custom ' + L.color }).name)}</span></div>${swatches('led.color', LED_COLORS.map((c) => c.hex))}</div>
      ${range('led.brightness', 'Kecerahan', 5, 100, 1, '%')}
      <div class="group"><div class="lbl">Efek</div><div class="seg-ctl">${LED_EFFECTS.map((e) => chip('led.effect', e.id, e.name, L.effect)).join('')}</div></div>
      ${range('hours', 'Lampu menyala per hari', 1, 24, 1, ' jam')}<div class="group" id="power-box">${powerBlock()}</div>
      <div class="group"><div class="lbl">Waktu tampilan</div><div class="seg-ctl">${TIMES.map((x) => chip('time', x.id, x.name, state.time)).join('')}</div></div>`;
  }
  const modes = isBox ? LED_MODES.filter((m) => m.id === 'front' || m.id === 'side') : LED_MODES;
  const curMode = modes.find((m) => m.id === L.mode) ? L.mode : modes[0].id;
  return `<h2 class="sec-title">Lampu LED</h2><p class="sec-sub">Atur LED di dalam signage dan pencahayaan tulisan.</p>
    <div class="group">${toggle('led.on', 'LED menyala', 'Matikan untuk melihat tampilan saat lampu padam')}</div>
    <div class="group"><div class="lbl">Warna LED<span class="val">${esc((LED_COLORS.find((c) => c.hex === L.color) || { name: 'Custom ' + L.color }).name)}</span></div>${swatches('led.color', LED_COLORS.map((c) => c.hex))}</div>
    ${range('led.brightness', 'Kecerahan', 5, 100, 1, '%')}
    <div class="group"><div class="lbl">Arah pencahayaan</div><div class="seg-ctl">${modes.map((m) => chip('led.mode', m.id, m.name, curMode)).join('')}</div>
      <p class="hint">${modes.find((m) => m.id === curMode).desc}</p></div>
    <div class="group"><div class="lbl">Efek</div><div class="seg-ctl">${LED_EFFECTS.map((e) => chip('led.effect', e.id, e.name, L.effect)).join('')}</div></div>
    <div class="group"><div class="lbl">Kepadatan modul LED</div><div class="seg-ctl">${LED_DENSITY.map((d) => chip('led.density', d.id, `${d.name} (${d.perM2}/m²)`, L.density)).join('')}</div></div>
    <div class="group">${toggle('led.xray', 'Lihat LED di dalam', 'Muka dibuat transparan untuk melihat susunan modul')}<p class="hint" id="led-count"></p></div>
    ${range('hours', 'Lampu menyala per hari', 1, 24, 1, ' jam')}<div class="group" id="power-box">${powerBlock()}</div>
    <div class="group"><div class="lbl">Waktu tampilan</div><div class="seg-ctl">${TIMES.map((x) => chip('time', x.id, x.name, state.time)).join('')}</div></div>`;
}

function panelStruktur() {
  const S = state;
  if (ROOF_PLACEMENTS.includes(S.placement)) {
    return `<h2 class="sec-title">Konstruksi penyangga</h2><p class="sec-sub">Rangka besi hollow untuk signage di atas bangunan.</p>
      <div class="group">${toggle('construction.on', 'Pakai rangka besi', 'Kaki depan, kaki belakang, skur, dan base plate')}</div>
      ${S.construction.on ? range('construction.height', 'Tinggi kaki dari atap', 0, 400, 5, ' cm') + `<div class="group"><div class="lbl">Warna rangka</div>${swatches('construction.color', ['#2a2f37', '#111318', '#6b7280', '#ffffff', '#b91c1c'])}</div>` : ''}
      <p class="hint">Jumlah kaki menyesuaikan lebar signage (jarak ±1,5 m). Ukuran final ditentukan setelah survei struktur atap.</p>`;
  }
  const msg = {
    totem: 'Signage dipasang pada badan totem. Atur tinggi & warna totem di tab Lokasi.',
    pole: 'Signage dipasang di ujung tiang. Atur tinggi & warna tiang di tab Lokasi.',
    wall: 'Signage dipasang menempel di tembok dengan baut/standoff — tidak perlu rangka besi.',
    mall: 'Signage dipasang di list plang toko dengan baut/standoff — tidak perlu rangka besi.',
  }[S.placement];
  return `<h2 class="sec-title">Konstruksi penyangga</h2><p class="sec-sub">Rangka besi tersedia untuk lokasi Atas Gedung, Atas Kafe & Booth Kontainer.</p>
    <div class="note">${msg}</div>
    <div class="cards" style="margin-top:14px">${['rooftop', 'cafe'].map((id) => { const p = PLACEMENTS.find((x) => x.id === id); return `<button class="card" data-set="placement" data-value="${id}"><div class="ic">${ICONS[id]}</div><b>${p.name}</b><span>Pakai rangka besi</span></button>`; }).join('')}</div>`;
}

const PANELS = { lokasi: panelLokasi, model: panelModel, teks: panelTeks, bahan: panelBahan, lampu: panelLampu, struktur: panelStruktur };

function renderItems() {
  const n = state.items.length;
  const dot = (it) => (SIGN_TYPES.find((t) => t.id === it.sign.type).lit && it.led.on ? it.led.color : it.sign.front.color);
  $('#items').innerHTML = `<div class="items-row">${state.items.map((it, i) => `<button class="item-chip ${i === state.active ? 'active' : ''}" data-item="${i}" title="${esc(describe(it))}"><i style="background:${esc(dot(it))}"></i>${esc(itemName(it, i))}</button>`).join('')}
    ${n < MAX_ITEMS ? `<button class="item-chip add" data-item-act="add" title="Tambah signage" aria-label="Tambah signage">${ICONS.plus}</button>` : ''}</div>
    <div class="items-acts">${n < MAX_ITEMS ? `<button class="icon-btn sm" data-item-act="dup" title="Duplikat signage aktif" aria-label="Duplikat">${ICONS.copy}</button>` : ''}
    ${n > 1 ? `<button class="icon-btn sm" data-item-act="del" title="Hapus signage aktif" aria-label="Hapus">${ICONS.trash}</button>` : ''}</div>`;
}

function renderPanel() {
  renderTabs();
  const body = $('#panel-body');
  const scroll = body.scrollTop;
  body.innerHTML = PANELS[tab]();
  body.scrollTop = scroll;
  updateSpec();
  drawFontPreviews();
}

async function drawFontPreviews() {
  const sample = (state.sign.text.split('\n')[0] || 'Signage').slice(0, 14);
  for (const c of $$('canvas[data-font]')) {
    try {
      const f = await loadFont(c.dataset.font);
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      drawTextFit(g, f, sample, { x: 6, y: 10, w: c.width - 12, h: c.height - 20 }, { color: '#0f172a' });
    } catch (_) { /* abaikan */ }
  }
}

function syncPosInputs() {
  for (const k of ['x', 'y', 'z', 'rot']) {
    const el = $(`[data-bind="pos.${k}"]`);
    if (el) { el.value = state.pos[k]; const o = $(`[data-out="pos.${k}"]`); if (o) o.textContent = fmt(state.pos[k], 2) + (el.dataset.unit || ''); }
  }
}

// ---------- perubahan state ----------
function routeFlags(path) {
  if (path === 'install' || path === 'area' || path === 'hours') return {};
  if (path === 'time' || path.startsWith('bg.') || path === 'env.showCity') return { time: true };
  if (path === 'placement' || path.startsWith('env.') || path.startsWith('wall.')) return { hero: true, signs: 'all' };
  if (path.startsWith('sign.') || path.startsWith('led.')) return { signs: 'active' };
  if (path.startsWith('construction.') || path.startsWith('pos.') || path === 'showDims') return { mount: true };
  return { signs: 'active' };
}

const BOX_PRESET = { front: { mat: 'acrylic', color: '#ffffff' }, side: { mat: 'acp', color: '#15181e' }, textColor: '#d31d2a' };
const LETTER_PRESET = { front: { mat: 'acrylic', color: '#ffffff' }, side: { mat: 'stainless', color: '#c9cdd3' } };
const UNLIT_PRESET = { front: { mat: 'gold', color: '#d6b06a' }, side: { mat: 'gold', color: '#d6b06a' } };

/** Posisi awal signage ke-i di lokasi saat ini. */
function defaultPosFor(i, n) {
  const info = placementInfo(state);
  const spread = info.kind === 'wall' ? Math.min(3.2, info.w / Math.max(n, 1)) : info.kind === 'roof' ? Math.min(4.2, (info.x[1] - info.x[0]) / Math.max(n, 1)) : 4;
  return { ...info.defaultPos, x: info.defaultPos.x + (i - (n - 1) / 2) * spread, rot: 0 };
}

function change(path, value, { rerender = false } = {}) {
  const prev = getPath(state, path);
  if (path === 'placement' && prev !== value) {
    state.placement = value;
    const n = state.items.length;
    state.items.forEach((it, i) => {
      it.pos = defaultPosFor(i, n);
      if (value === 'cafe' && it.construction.height > 150) it.construction.height = 60;
      if (value === 'booth' && it.construction.height > 80) it.construction.height = 30;
      if (value === 'rooftop' && it.construction.height < 60) it.construction.height = 120;
    });
    invalidate({ hero: true, signs: 'all', time: true });
    ready = false;
    $('#loader').classList.remove('done');
    setTimeout(() => $('#loader').classList.add('done'), 600);
  } else if (path === 'sign.type' && prev !== value) {
    const g0 = prev.startsWith('box_') ? 'box' : 'letters';
    const g1 = value.startsWith('box_') ? 'box' : 'letters';
    state.sign.type = value;
    if (g0 !== g1) Object.assign(state.sign, structuredClone(g1 === 'box' ? BOX_PRESET : LETTER_PRESET));
    if (value === 'letters_unlit' && prev === 'letters_lit') Object.assign(state.sign, structuredClone(UNLIT_PRESET));
    if (value === 'letters_lit' && prev === 'letters_unlit') Object.assign(state.sign, structuredClone(LETTER_PRESET));
    if (g1 === 'box' && !['front', 'side'].includes(state.led.mode)) state.led.mode = 'front';
    if (value === 'neon_flex') {
      if (state.sign.letterHeight > 60) state.sign.letterHeight = 30;
      if (state.led.color === '#eef4ff') state.led.color = '#ff3fb4';
      state.led.on = true;
    }
    invalidate({ signs: 'active' });
  } else {
    setPath(state, path, value);
    if (path === 'wall.width' && state.wall.lockRatio && assets.wallAspect) state.wall.height = +(value / assets.wallAspect).toFixed(2);
    if (path === 'wall.lockRatio' && value && assets.wallAspect) state.wall.height = +(state.wall.width / assets.wallAspect).toFixed(2);
    invalidate(routeFlags(path));
    if (path === 'time') $$('#time-seg button').forEach((x) => x.classList.toggle('active', x.dataset.time === value));
  }
  if (path === 'sign.text' || path === 'sign.type' || path.startsWith('led.') || path === 'sign.front') setTimeout(renderItems, 0);
  if (rerender) renderPanel();
  autosave();
  commit();
}

// ---------- kelola signage ----------
function addItem(kind) {
  if (state.items.length >= MAX_ITEMS) return;
  const id = Math.max(...state.items.map((x) => x.id)) + 1;
  const cur = activeItem();
  let it;
  if (kind === 'dup') {
    it = structuredClone(cur);
    it.id = id;
  } else {
    it = defaultItem(id);
    Object.assign(it.sign, structuredClone(BOX_PRESET), { type: 'box_rect', text: 'OPEN', width: 140, height: 60, depth: 15, textScale: 75 });
    it.construction = structuredClone(cur.construction);
  }
  const rt = runtime.get(cur.id);
  const w0 = rt && rt.res ? rt.res.size.w : 2;
  const w1 = kind === 'dup' ? w0 : 1.4;
  const info = placementInfo(state);
  it.pos = { ...cur.pos };
  const step = info.kind === 'ground' ? Math.max(3.5, w0 / 2 + w1 / 2 + 1.2) : w0 / 2 + w1 / 2 + 0.4;
  // cari sisi yang masih ada ruang
  const lim = info.kind === 'wall' ? info.w / 2 - w1 / 2 : info.kind === 'roof' ? (info.x[1] - info.x[0]) / 2 - w1 / 2 - 0.3 : info.x[1];
  it.pos.x = cur.pos.x + step <= lim ? cur.pos.x + step : cur.pos.x - step;
  state.items.push(it);
  state.active = state.items.length - 1;
  invalidate({ signs: 'active' });
  onActiveChanged();
  autosave();
  commit();
  toast(kind === 'dup' ? 'Signage diduplikat' : 'Signage baru ditambahkan');
}

function deleteItem() {
  if (state.items.length <= 1) return;
  const it = activeItem();
  state.items.splice(state.active, 1);
  state.active = Math.max(0, state.active - 1);
  engine.removeItem(it.id);
  runtime.delete(it.id);
  onActiveChanged();
  autosave();
  commit();
  toast('Signage dihapus — tekan Urungkan untuk mengembalikan');
}

$('#items').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-item]');
  if (chip) {
    state.active = +chip.dataset.item;
    onActiveChanged();
    autosave();
    return;
  }
  const act = e.target.closest('[data-item-act]')?.dataset.itemAct;
  if (act === 'add' || act === 'dup') addItem(act);
  if (act === 'del') deleteItem();
});

// klik opsi (kartu, chip, swatch)
$('#panel-body').addEventListener('click', (e) => {
  const qb = e.target.closest('[data-quality]');
  if (qb) { quality.mode = qb.dataset.quality; quality.autoLow = false; store.set('dazpro.quality', quality.mode); applyQuality(); renderPanel(); return; }
  const set = e.target.closest('[data-set]');
  if (set) {
    const v = set.dataset.value;
    const cur = getPath(state, set.dataset.set);
    change(set.dataset.set, typeof cur === 'number' ? Number(v) : v, { rerender: true });
    return;
  }
  const mat = e.target.closest('[data-mat]');
  if (mat) {
    const path = mat.dataset.mat;
    const m = mat.dataset.value;
    const cur = getPath(state, path);
    const color = m === 'acrylic' && cur.mat !== 'acrylic' ? '#ffffff' : m === 'acp' && cur.mat !== 'acp' ? '#15181e' : MAT_DEFAULT_COLOR[m] && m !== 'acrylic' && m !== 'acp' ? MAT_DEFAULT_COLOR[m] : cur.color;
    change(path, { mat: m, color }, { rerender: true });
    return;
  }
  const act = e.target.closest('[data-action]');
  if (act) {
    if (act.dataset.action === 'center') {
      state.pos = defaultPosFor(state.active, state.items.length);
      invalidate({ mount: true });
      renderPanel();
      engine.cameraPreset('front');
      commit();
    }
    if (act.dataset.action === 'clear') {
      const key = act.dataset.key;
      setPath(state, key, null);
      applyAssets().then(() => { invalidate(key === 'bg.image' ? { time: true } : routeFlags(key)); renderPanel(); autosave(); commit(); });
    }
  }
});

// input teks / slider (tanpa render ulang supaya fokus tidak hilang)
$('#panel-body').addEventListener('input', (e) => {
  const el = e.target;
  const path = el.dataset.bind;
  if (!path || el.type === 'checkbox') return;
  let v = el.value;
  if (el.type === 'range' || el.dataset.num !== undefined) {
    v = Number(v);
    if (Number.isNaN(v)) return;
    if (el.min !== '' && el.type === 'number' && (v < +el.min || v > +el.max)) return; // tunggu sampai valid
  }
  change(path, v);
  const out = $(`[data-out="${path}"]`);
  if (out) out.textContent = fmt(v, 2) + (el.dataset.unit || '');
  if (path === 'sign.text') { clearTimeout(drawFontPreviews.t); drawFontPreviews.t = setTimeout(drawFontPreviews, 350); }
  if (el.type === 'color') $$('.sw', el.closest('.swatches')).forEach((s) => s.classList.remove('active'));
});
$('#panel-body').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.upload) { handleUpload(el); return; }
  const path = el.dataset.bind;
  if (!path) return;
  if (el.type === 'checkbox') { change(path, el.checked, { rerender: true }); return; }
  if (el.type === 'number') {
    const v = clamp(Number(el.value) || 0, +el.min, +el.max);
    el.value = v;
    change(path, v, { rerender: path.startsWith('wall.') });
  }
  if (el.type === 'color') renderPanel();
});

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  $('#panel-body').scrollTop = 0;
  renderPanel();
});

// ---------- upload gambar ----------
function readImage(file, maxSize, type = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(type, 0.86));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

async function handleUpload(el) {
  const file = el.files && el.files[0];
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) { toast('Ukuran gambar terlalu besar (maks ±12 MB)'); return; }
  const key = el.dataset.upload;
  try {
    const isLogo = key === 'sign.logo';
    const url = await readImage(file, isLogo ? 900 : key === 'sign.faceImage' ? 1800 : 2400, isLogo ? 'image/png' : 'image/jpeg');
    setPath(state, key, url);
    await applyAssets();
    if (key === 'wall.image' && assets.wallAspect) {
      state.wall.lockRatio = true;
      state.wall.height = +(state.wall.width / assets.wallAspect).toFixed(2);
      engine.cameraPreset('front');
    }
    invalidate(key === 'bg.image' ? { time: true } : routeFlags(key));
    renderPanel();
    if (!store.set('dazpro.current', state)) toast('Gambar terlalu besar untuk disimpan otomatis — gunakan Export .json');
    else toast('Gambar terpasang');
    commit();
  } catch (err) {
    toast('Gagal membaca gambar. Coba file JPG atau PNG lain.');
  }
}

function loadImg(src) {
  if (logoCache.has(src)) return Promise.resolve(logoCache.get(src));
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { logoCache.set(src, i); res(i); }; i.onerror = rej; i.src = src; });
}

async function applyAssets() {
  assets.logos = new Map();
  assets.faceImgs = new Map();
  for (const it of state.items) {
    if (it.sign.logo) { const img = await loadImg(it.sign.logo).catch(() => null); if (img) assets.logos.set(it.id, img); }
    if (it.sign.faceImage) { const img = await loadImg(it.sign.faceImage).catch(() => null); if (img) assets.faceImgs.set(it.id, img); }
  }
  if (assets.wallTex) { assets.wallTex.dispose(); assets.wallTex = null; }
  assets.wallAspect = null;
  if (state.wall.image) {
    const img = await loadImg(state.wall.image).catch(() => null);
    if (img) {
      const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
      t.userData.keep = true;
      assets.wallTex = t; assets.wallAspect = img.width / img.height;
    }
  }
  if (assets.bgTex) { assets.bgTex.dispose(); assets.bgTex = null; }
  if (state.bg.image) {
    const img = await loadImg(state.bg.image).catch(() => null);
    if (img) {
      const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      if (Math.abs(img.width / img.height - 2) < 0.08) t.mapping = THREE.EquirectangularReflectionMapping;
      t.userData.keep = true;
      assets.bgTex = t;
    }
  }
}

// ================= VIEWPORT UI =================
function renderViewportUI() {
  $('#time-seg').innerHTML = TIMES.map((t) => `<button data-time="${t.id}" class="${state.time === t.id ? 'active' : ''}">${ICONS[t.id === 'day' ? 'sun' : t.id === 'dusk' ? 'dusk' : 'moon']}<span>${t.name}</span></button>`).join('');
  const cams = [['front', 'Depan'], ['side', 'Samping'], ['top', 'Atas'], ['close', 'Dekat'], ['street', 'Pejalan']];
  $('#cams').innerHTML = cams.map(([id, n]) => `<button data-cam="${id}">${ICONS[id]}<span>${n}</span></button>`).join('') + `<button class="walk" data-cam="walk">${ICONS.walk}<span>Jalan 3D</span></button>`;
  $('#btn-shot').innerHTML = ICONS.camera;
  $('#btn-full').innerHTML = $('#studio').classList.contains('is-full') ? ICONS.shrink : ICONS.expand;
  $('#btn-spin').innerHTML = ICONS.spin;
  $('#btn-rec').innerHTML = ICONS.video;
  $('#panel-toggle').innerHTML = $('#studio').classList.contains('panel-off') ? ICONS.sidebarOff : ICONS.sidebar;
  $('#btn-zin').innerHTML = ICONS.zoomIn;
  $('#btn-zout').innerHTML = ICONS.zoomOut;
  $('#btn-undo').innerHTML = ICONS.undo;
  $('#btn-redo').innerHTML = ICONS.redo;
  $('#btn-dims').innerHTML = ICONS.ruler;
  $('#btn-dims').classList.toggle('on', !!state.showDims);
  updateHistoryButtons();
}

$('#time-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-time]');
  if (!b) return;
  change('time', b.dataset.time);
  if (tab === 'lampu') renderPanel();
});

$('#cams').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cam]');
  if (!b) return;
  if (b.dataset.cam === 'walk') {
    const zMin = { rooftop: 0.8, cafe: 0.8, wall: 0.6, totem: -4, pole: -1, mall: 0.5, booth: 0.6 }[state.placement] ?? 0.6;
    engine.enterWalk(state.placement === 'mall' ? { x: [-28, 28], z: [zMin, 8.2], startZ: 6 } : { x: [-45, 45], z: [zMin, 21] });
  } else engine.cameraPreset(b.dataset.cam);
});

$('#walk-exit').addEventListener('click', () => engine.exitWalk());
$('#walk-view').addEventListener('click', () => engine.toggleWalkView());
$('#walk-run').addEventListener('click', (e) => { const on = !engine.walk.sprint; engine.setSprint(on); e.currentTarget.classList.toggle('on', on); });

// joystick layar sentuh untuk Jalan 3D
(function joystick() {
  const pad = $('#joy'), knob = $('#joy-knob');
  let id = null;
  const set = (e) => {
    const r = pad.getBoundingClientRect();
    const R = r.width / 2;
    let x = e.clientX - (r.left + R), y = e.clientY - (r.top + R);
    const d = Math.hypot(x, y), max = R - 18;
    if (d > max) { x *= max / d; y *= max / d; }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
    engine.setJoystick(dz(x / max), dz(-y / max));
  };
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    engine.setJoystick(0, 0);
  };
  pad.addEventListener('pointerdown', (e) => { if (id !== null) return; id = e.pointerId; pad.setPointerCapture(id); set(e); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);
})();

$('#btn-zin').addEventListener('click', () => { setSpin(false); engine.zoom(0.78); });
$('#btn-zout').addEventListener('click', () => { setSpin(false); engine.zoom(1.28); });
$('#btn-undo').addEventListener('click', () => travel(-1));
$('#btn-redo').addEventListener('click', () => travel(1));
$('#btn-dims').addEventListener('click', () => {
  change('showDims', !state.showDims);
  $('#btn-dims').classList.toggle('on', state.showDims);
  toast(state.showDims ? 'Garis ukuran ditampilkan' : 'Garis ukuran disembunyikan');
});
window.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); travel(e.shiftKey ? 1 : -1); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); travel(1); }
  else if (!mod && e.key.toLowerCase() === 'p' && engine.mode === 'orbit') setPanel(studio.classList.contains('panel-off'));
  else if (e.key === 'Escape' && engine.mode !== 'walk' && studio.classList.contains('is-full') && !document.fullscreenElement && $$('.drawer').every((d) => d.hidden)) setFull(false);
  else if (e.key === 'Delete' && engine.mode === 'orbit' && state.items.length > 1 && document.activeElement === document.body) { deleteItem(); }
});

// ---------- layar penuh ----------
// Seluruh halaman dibuat fullscreen (agar jendela pengajuan dll. tetap tampil),
// lalu studio mengisi layar. Jika Fullscreen API tidak ada (iPhone), cukup mode CSS.
const studio = $('#studio');
let panelBeforeFull = null;
function setFull(on) {
  if (on && panelBeforeFull === null) { panelBeforeFull = !studio.classList.contains('panel-off'); setPanel(false, false); }
  if (!on && panelBeforeFull !== null) { setPanel(panelBeforeFull, false); panelBeforeFull = null; }
  studio.classList.toggle('is-full', on);
  document.body.classList.toggle('full-lock', on);
  $('#btn-full').innerHTML = on ? ICONS.shrink : ICONS.expand;
  $('#btn-full').title = on ? 'Keluar layar penuh' : 'Layar penuh';
  if (on) window.scrollTo(0, 0);
}
$('#btn-full').addEventListener('click', () => {
  const de = document.documentElement;
  if (studio.classList.contains('is-full')) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    setFull(false);
    if ((document.fullscreenElement || document.webkitFullscreenElement) && exit) { try { exit.call(document)?.catch?.(() => {}); } catch (_) { /* abaikan */ } }
    return;
  }
  setFull(true);
  const req = de.requestFullscreen || de.webkitRequestFullscreen;
  if (req) { try { req.call(de, { navigationUI: 'hide' })?.catch?.(() => {}); } catch (_) { /* tetap mode CSS */ } }
});
['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
  if (!(document.fullscreenElement || document.webkitFullscreenElement) && studio.classList.contains('is-full')) setFull(false);
}));

// ---------- panel edit bisa disembunyikan ----------
function setPanel(open, save = true) {
  studio.classList.toggle('panel-off', !open);
  $('#panel-toggle').innerHTML = open ? ICONS.sidebar : ICONS.sidebarOff;
  $('#panel-toggle').title = open ? 'Sembunyikan panel edit (P)' : 'Tampilkan panel edit (P)';
  if (save) store.set('dazpro.panel', open ? 1 : 0);
}
$('#panel-toggle').addEventListener('click', () => setPanel(studio.classList.contains('panel-off')));

// ---------- putar otomatis (presentasi) ----------
function setSpin(on) {
  engine.controls.autoRotate = on;
  engine.controls.autoRotateSpeed = 0.9;
  $('#btn-spin').classList.toggle('on', on);
}
$('#btn-spin').addEventListener('click', () => { const on = !engine.controls.autoRotate; if (on && engine.mode === 'walk') engine.exitWalk(); setSpin(on); toast(on ? 'Putar otomatis aktif' : 'Putar otomatis berhenti'); });

// ---------- rekam video 360° ----------
let recording = false;
$('#btn-rec').addEventListener('click', async () => {
  if (recording) return;
  const canvas = engine.renderer.domElement;
  if (!canvas.captureStream || !window.MediaRecorder) { toast('Browser ini belum mendukung rekam video — coba Chrome'); return; }
  // WebM didahulukan di Chrome/Android (paling andal); Safari/iPhone memakai MP4
  const types = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
  const type = types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) { toast('Format video tidak didukung browser ini'); return; }
  if (engine.mode === 'walk') engine.exitWalk();
  recording = true;
  const btn = $('#btn-rec'); btn.classList.add('recording');
  $('#rec-badge').hidden = false;
  const prevSpeed = engine.controls.autoRotateSpeed;
  engine.watchFps(null); // jangan ganti kualitas (ukuran kanvas) saat merekam
  engine.cameraPreset('hero');
  await new Promise((r) => setTimeout(r, 900));
  setSpin(true); engine.controls.autoRotateSpeed = 6; // satu putaran ±10 detik
  const recordOnce = async (secs) => {
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: type });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((r) => (rec.onstop = r));
    rec.start(250);
    for (let i = secs; i > 0; i--) { $('#rec-txt').textContent = `Merekam… ${i}`; await new Promise((r) => setTimeout(r, 1000)); }
    rec.stop(); await done;
    stream.getTracks().forEach((t) => t.stop());
    return new Blob(chunks, { type: type.split(';')[0] });
  };
  let blob = await recordOnce(8);
  if (blob.size < 2000) blob = await recordOnce(8); // encoder kadang belum siap di percobaan pertama
  setSpin(false); engine.controls.autoRotateSpeed = prevSpeed;
  applyQuality();
  btn.classList.remove('recording'); $('#rec-badge').hidden = true; recording = false;
  if (blob.size < 2000) { toast('Video gagal direkam di browser ini — coba Chrome versi terbaru'); return; }
  download(URL.createObjectURL(blob), `${slug()}-360.${type.includes('mp4') ? 'mp4' : 'webm'}`);
  toast('Video 360° tersimpan');
});

// petunjuk hilang setelah interaksi pertama / beberapa detik
const fadeHint = () => $('#vp-hint').classList.add('fade');
setTimeout(fadeHint, 9000);
viewport.addEventListener('pointerdown', fadeHint, { once: true });

function download(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
const slug = () => (itemName(state.items[0]) || 'signage').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'signage';

$('#btn-shot').addEventListener('click', () => { download(engine.screenshot(), `dazpro-${slug()}.png`); toast('Gambar disimpan'); });

// ---------- rincian harga ----------
function openModal(id) { $(id).hidden = false; }
$$('.drawer').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.hidden = true; }));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') $$('.drawer').forEach((d) => (d.hidden = true)); });

function linesTable() {
  let group = null;
  const rows = pricing.lines.map((l) => {
    let head = '';
    if (l.group && l.group !== group) { group = l.group; head = `<tr class="grp"><td colspan="2">${esc(l.group)}</td></tr>`; }
    const label = l.key
      ? `<label class="add-opt"><input type="checkbox" data-add="${esc(l.key)}" ${l.skipped ? '' : 'checked'} /><span>${esc(l.label)}${l.detail ? `<small>${esc(l.detail)}</small>` : ''}${l.skipped ? '<small class="skip">Tidak dipilih — disiapkan sendiri</small>' : ''}</span></label>`
      : `${esc(l.label)}${l.detail ? `<small>${esc(l.detail)}</small>` : ''}`;
    const amt = l.skipped ? `<s>${formatRp(l.full)}</s>` : formatRp(l.amount);
    return `${head}<tr class="${l.skipped ? 'off' : ''}"><td>${label}</td><td>${amt}</td></tr>`;
  }).join('');
  const hasAdd = pricing.lines.some((l) => l.key);
  return `${hasAdd ? '<p class="muted small" style="margin:0 0 6px">Centang biaya <b>additional</b> yang ingin disertakan. Hapus centang jika Anda menyiapkannya sendiri.</p>' : ''}
    <table class="lines">${rows}<tr class="total"><td>Total estimasi</td><td>${formatRp(pricing.total)}</td></tr></table>
    ${power().watt ? `<p class="small" style="margin:10px 0 0"><b>Estimasi listrik:</b> ${powerText(power())}</p>` : ''}
    <p class="muted small">Estimasi kasar berdasarkan ukuran, bahan, dan lokasi. Harga final dikonfirmasi setelah survei lokasi.</p>
    <div class="drawer-actions"><button class="btn btn-ghost btn-sm" data-open-quote>Cetak penawaran (PDF)</button><button class="btn btn-primary btn-sm" data-open-submit>Ajukan desain</button></div>`;
}
$('#drawer-body').addEventListener('change', (e) => {
  const cb = e.target.closest('[data-add]');
  if (!cb) return;
  const key = cb.dataset.add;
  const set = new Set(state.skipAdd || []);
  if (cb.checked) set.delete(key); else set.add(key);
  state.skipAdd = [...set];
  updateSummary();
  $('#drawer-body').innerHTML = linesTable();
  autosave(); commit();
});
$('#sum-total').addEventListener('click', () => { $('#drawer-body').innerHTML = linesTable(); openModal('#drawer'); });
$('#drawer-body').addEventListener('click', (e) => { if (e.target.closest('[data-open-quote], [data-open-submit]')) { $('#drawer').hidden = true; openSubmit(); } });

// ---------- spesifikasi teks ----------
const matName = (id) => (MATERIALS.find((m) => m.id === id) || {}).name;
function itemSpecs(it) {
  const S = it.sign, L = it.led;
  const rt = runtime.get(it.id);
  const size = rt && rt.res ? rt.res.size : { w: 0, h: 0, d: 0 };
  const type = SIGN_TYPES.find((t) => t.id === S.type);
  const isBox = type.group === 'box';
  if (type.group === 'neon') {
    return [
      ['Model', type.name],
      ['Teks', S.text.replace(/\n/g, ' / ') || '—'],
      ['Font', (fontIndex.find((f) => f.id === S.font) || {}).name || S.font],
      ['Ukuran jadi', `${fmt(size.w)} × ${fmt(size.h)} m`],
      ['Tinggi huruf', `${S.letterHeight} cm`],
      ['Panjang selang neon', `±${fmt(rt?.res?.neonLength || 0)} m`],
      ['Papan', (NEON_BOARDS.find((x) => x.id === (S.board || 'clear')) || {}).name],
      ['Warna neon', L.on ? `${LED_COLORS.find((c) => c.hex === L.color)?.name || L.color} · ${LED_EFFECTS.find((x) => x.id === L.effect)?.name}` : 'Mati'],
    ];
  }
  const rows = [
    ['Model', type.name],
    ['Teks', S.text.replace(/\n/g, ' / ') || '—'],
    ['Font', (fontIndex.find((f) => f.id === S.font) || {}).name || S.font],
    ['Ukuran jadi', `${fmt(size.w)} × ${fmt(size.h)} m, tebal ${fmt(size.d * 100, 0)} cm`],
    isBox ? ['Dimensi box', `${S.width} × ${S.type === 'box_rect' ? S.height : S.width} × ${S.depth} cm · ${S.sides === 2 ? '2 sisi' : '1 sisi'}`] : ['Tinggi huruf', `${S.letterHeight} cm, return ${S.letterDepth} cm`],
    ['Bahan depan', `${matName(S.front.mat)} · ${S.front.color}`],
    ['Bahan samping', `${matName(S.side.mat)} · ${S.side.color}`],
  ];
  if (!isBox && S.backPanel.on) rows.push(['Panel latar', `ACP ${S.backPanel.color}, tepi ${S.backPanel.padding} cm`]);
  if (isBox && S.faceImage) rows.push(['Desain muka', 'Gambar custom dari pelanggan (dilampirkan)']);
  if (isBox && (!S.faceImage || S.faceText)) rows.push(['Warna teks', S.textColor]);
  if (type.lit) {
    rows.push(['LED', L.on ? `${LED_COLORS.find((c) => c.hex === L.color)?.name || L.color} · ${LED_MODES.find((m) => m.id === (rt?.res?.effectiveMode || L.mode))?.name} · ${LED_EFFECTS.find((x) => x.id === L.effect)?.name} · ${rt?.res?.ledCount || 0} modul` : 'Mati']);
  }
  if (ROOF_PLACEMENTS.includes(state.placement)) rows.push(['Konstruksi', it.construction.on ? `Rangka besi hollow, kaki ${it.construction.height} cm` : 'Tanpa rangka']);
  if (state.placement === 'pole') rows.push(['Tiang', `${fmt(state.env.poleHeight)} m sampai bawah signage${it.sign.type.startsWith('box_') ? '' : ' · rangka besi horizontal di belakang huruf'}`]);
  if (state.placement === 'totem') rows.push(['Totem', `tinggi ${fmt(rt?.m?.totemH || state.env.totemHeight)} m`]);
  return rows;
}

// ---------- pengajuan & penawaran ----------
let lastShot = '';
function openSubmit() {
  lastShot = engine.screenshot();
  $('#submit-preview').src = lastShot;
  openModal('#submit-modal');
}
$('#btn-submit').addEventListener('click', openSubmit);

$('#submit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const pl = PLACEMENTS.find((p) => p.id === state.placement);
  const blocks = state.items.map((it, i) => [
    state.items.length > 1 ? `*Signage ${i + 1}: ${itemName(it, i)}*` : null,
    ...itemSpecs(it).map(([k, v]) => `• ${k}: ${v}`),
  ].filter(Boolean).join('\n'));
  const msg = [
    `Halo ${BRAND.name}, saya ingin penawaran signage:`,
    '',
    `Nama: ${fd.get('name')}`,
    fd.get('biz') ? `Usaha: ${fd.get('biz')}` : null,
    fd.get('phone') ? `No. WhatsApp: ${fd.get('phone')}` : null,
    fd.get('city') ? `Lokasi: ${fd.get('city')}` : null,
    `Penempatan: ${pl.name}`,
    '',
    blocks.join('\n\n'),
    '',
    'Rincian estimasi:',
    ...pricing.lines.map((l) => `- ${l.group ? l.group + ' · ' : ''}${l.label}: ${l.skipped ? 'tidak dipilih' : formatRp(l.amount)}`),
    `Total estimasi: ${formatRp(pricing.total)}`,
    power().watt ? `Estimasi listrik: ${powerText(power())}` : null,
    fd.get('note') ? `\nCatatan: ${fd.get('note')}` : null,
    '\n(Gambar desain 3D saya lampirkan.)',
  ].filter((x) => x !== null).join('\n');
  download(lastShot, `dazpro-${slug()}.png`);
  window.open(`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  $('#submit-modal').hidden = true;
  toast('Membuka WhatsApp…');
  recordSubmission(fd, pl); // simpan ke database (tidak menghalangi WhatsApp)
});

// kecilkan gambar jadi JPEG ringan agar muat di dokumen database
function thumbJpeg(dataUrl, w = 720, q = 0.72) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.round(w * im.height / im.width);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', q));
    };
    im.onerror = () => resolve('');
    im.src = dataUrl;
  });
}
async function recordSubmission(fd, pl) {
  try {
    const [preview, design] = await Promise.all([thumbJpeg(lastShot), encodeDesign()]);
    await saveSubmission({
      name: String(fd.get('name') || '').slice(0, 150),
      biz: String(fd.get('biz') || '').slice(0, 150),
      city: String(fd.get('city') || '').slice(0, 150),
      phone: String(fd.get('phone') || '').slice(0, 40),
      note: String(fd.get('note') || '').slice(0, 1500),
      placement: pl.name,
      time: TIMES.find((t) => t.id === state.time).name,
      total: Math.round(pricing.total),
      count: state.items.length,
      items: state.items.map((it, i) => ({ name: itemName(it, i), specs: itemSpecs(it).map(([k, v]) => ({ k, v: String(v) })) })),
      lines: pricing.lines.map((l) => ({ group: l.group || '', label: l.skipped ? `${l.label} (tidak dipilih)` : l.label, amount: Math.round(l.amount) })),
      design,
      preview,
    });
    toast('Pengajuan tersimpan di sistem DAZPRO');
  } catch (err) {
    console.warn('Pengajuan tidak tersimpan di database:', err);
  }
}

$('#btn-quote').addEventListener('click', async () => {
  const fd = new FormData($('#submit-form'));
  const btn = $('#btn-quote');
  btn.disabled = true; btn.textContent = 'Menyiapkan…';
  try {
    const shots = state.items.map((it) => {
      const m = runtime.get(it.id)?.m;
      return m ? engine.captureView(m.center, m.size, m.rot, 'front', 900, 560) : '';
    });
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const no = `DZP-${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const until = new Date(now.getTime() + 14 * 864e5);
    const dfmt = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    $('#quote').innerHTML = buildQuote({
      brand: BRAND, no, date: dfmt(now), until: dfmt(until),
      customer: { name: fd.get('name'), biz: fd.get('biz'), city: fd.get('city'), note: fd.get('note') },
      placement: PLACEMENTS.find((p) => p.id === state.placement).name,
      time: TIMES.find((t) => t.id === state.time).name,
      overview: lastShot || engine.screenshot(),
      items: state.items.map((it, i) => ({ name: itemName(it, i), shot: shots[i], specs: itemSpecs(it) })),
      lines: pricing.lines, total: pricing.total, formatRp, power: power().watt ? powerText(power()) : '',
    });
    await Promise.all($$('#quote img').map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    $('#submit-modal').hidden = true;
    const prevTitle = document.title;
    document.title = `Penawaran ${no}`;
    window.print();
    setTimeout(() => (document.title = prevTitle), 1000);
  } finally {
    btn.disabled = false; btn.textContent = 'Cetak penawaran (PDF)';
  }
});

// ---------- bagikan link ----------
const b64url = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (str) => {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
async function encodeDesign() {
  const json = JSON.stringify(state, (k, v) => (typeof v === 'string' && v.startsWith('data:') ? null : v));
  let bytes = new TextEncoder().encode(json);
  if (window.CompressionStream) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + b64url(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  return 'j' + b64url(bytes);
}
async function decodeDesign(code) {
  let bytes = unb64url(code.slice(1));
  if (code[0] === 'z') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function openShare() {
  const code = await encodeDesign();
  const url = `${location.origin}${location.pathname}#d=${code}`;
  $('#share-url').value = url;
  const hasImg = state.wall.image || state.bg.image || state.items.some((it) => it.sign.logo);
  $('#share-note').hidden = !hasImg;
  openModal('#share-modal');
  $('#share-url').select();
}
$('#share-copy').addEventListener('click', async () => {
  const inp = $('#share-url');
  try { await navigator.clipboard.writeText(inp.value); toast('Link disalin'); } catch (_) { inp.select(); toast('Tekan Ctrl+C untuk menyalin'); }
});
$('#share-wa').addEventListener('click', () => {
  window.open(`https://wa.me/?text=${encodeURIComponent('Desain signage saya di DAZPRO Signage Studio: ' + $('#share-url').value)}`, '_blank', 'noopener');
});

// ---------- menu proyek ----------
$('#btn-project').addEventListener('click', (e) => { e.stopPropagation(); $('#project-menu').hidden = !$('#project-menu').hidden; });
document.addEventListener('click', () => ($('#project-menu').hidden = true));
$('#project-menu').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'share') openShare();
  if (act === 'quote') openSubmit();
  if (act === 'save') {
    const list = store.get('dazpro.projects', []);
    const name = (state.items.length > 1 ? `${state.items.length} signage` : itemName(activeItem())) + ' — ' + PLACEMENTS.find((p) => p.id === state.placement).name;
    const c = document.createElement('canvas'); c.width = 240; c.height = 135;
    const img = new Image();
    img.onload = () => {
      c.getContext('2d').drawImage(img, 0, 0, 240, 135);
      list.unshift({ id: Date.now(), name, date: new Date().toLocaleString('id-ID'), thumb: c.toDataURL('image/jpeg', 0.7), state });
      if (store.set('dazpro.projects', list.slice(0, 12))) toast('Proyek disimpan di perangkat ini');
      else toast('Penyimpanan penuh — gunakan Export .json');
    };
    img.src = engine.screenshot();
  }
  if (act === 'load') {
    const list = store.get('dazpro.projects', []);
    $('#load-list').innerHTML = list.length ? list.map((p, i) => `<div class="load-item"><img src="${p.thumb}" width="96" height="54" style="border-radius:8px;object-fit:cover" alt="" /><div style="flex:1;min-width:0"><b>${esc(p.name)}</b><small>${esc(p.date)}</small></div><button class="btn btn-sm btn-ghost" data-load="${i}">Buka</button><button class="btn btn-sm btn-ghost" data-del="${i}">Hapus</button></div>`).join('') : '<p class="muted">Belum ada simpanan.</p>';
    openModal('#load-modal');
  }
  if (act === 'export') {
    const blob = new Blob([JSON.stringify({ app: 'dazpro-signage', ...state }, null, 1)], { type: 'application/json' });
    download(URL.createObjectURL(blob), `dazpro-${slug()}.json`);
  }
  if (act === 'import') $('#file-json').click();
  if (act === 'reset') { loadState(defaultState()); toast('Desain baru dimulai — tekan Urungkan untuk kembali'); }
});
$('#load-list').addEventListener('click', (e) => {
  const list = store.get('dazpro.projects', []);
  const l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
  if (l) { loadState(list[+l.dataset.load].state); $('#load-modal').hidden = true; }
  if (d) { list.splice(+d.dataset.del, 1); store.set('dazpro.projects', list); e.target.closest('.load-item').remove(); }
});
$('#file-json').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try { await loadState(JSON.parse(await f.text())); toast('Proyek dimuat'); } catch (_) { toast('File tidak valid — pilih file .json hasil Export'); }
  e.target.value = '';
});

/** Ganti seluruh desain (tanpa mencatat riwayat). */
async function restore(raw) {
  const placementChanged = raw.placement !== state.placement;
  state = normalize(raw);
  await applyAssets();
  if (placementChanged) ready = false;
  renderViewportUI();
  renderItems();
  renderPanel();
  invalidate({ time: true, hero: true, signs: 'all' });
  autosave();
}
async function loadState(raw) {
  clearTimeout(commitT);
  pushHistory();
  ready = false;
  await restore(raw);
  pushHistory();
}

// ---------- template desain ----------
async function drawTplPreview(c, p) {
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.fillStyle = p.bg; g.fillRect(0, 0, W, H);
  let f;
  try { f = await loadFont(p.font); } catch (_) { return; }
  if (p.box) {
    const bw = p.round ? H * 0.72 : W * 0.62, bh = p.round ? H * 0.72 : H * 0.5;
    const x = (W - bw) / 2, y = (H - bh) / 2;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18;
    g.fillStyle = '#ffffff';
    g.beginPath();
    if (p.round) g.arc(W / 2, H / 2, bw / 2, 0, Math.PI * 2); else g.roundRect(x, y, bw, bh, 8);
    g.fill(); g.restore();
    drawTextFit(g, f, p.text, { x: x + bw * 0.12, y: y + bh * 0.22, w: bw * 0.76, h: bh * 0.56 }, { color: p.fg });
    return;
  }
  const box = { x: W * 0.1, y: H * 0.28, w: W * 0.8, h: H * 0.44 };
  if (p.glow) { g.save(); g.shadowColor = p.glow; g.shadowBlur = 26; drawTextFit(g, f, p.text, box, { color: p.fg }); g.restore(); }
  drawTextFit(g, f, p.text, box, { color: p.fg });
}
function openTemplates() {
  $('#tpl-grid').innerHTML = TEMPLATES.map((t) => `<button class="tpl" data-tpl="${t.id}"><canvas width="480" height="300"></canvas><div><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></div></button>`).join('');
  openModal('#tpl-modal');
  $$('#tpl-grid canvas').forEach((c, i) => drawTplPreview(c, TEMPLATES[i].preview));
}
$('#btn-templates').addEventListener('click', openTemplates);
$$('[data-open-templates]').forEach((b) => b.addEventListener('click', () => { studio.scrollIntoView({ behavior: 'smooth' }); openTemplates(); }));
$('#tpl-grid').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-tpl]');
  if (!b) return;
  const t = TEMPLATES.find((x) => x.id === b.dataset.tpl);
  $('#tpl-modal').hidden = true;
  setSpin(false);
  await loadState(t.state());
  tab = 'teks'; renderPanel();
  toast(`Template "${t.name}" dipakai — ubah teks sesuai nama usaha Anda`);
});

// ---------- jarak keterbacaan ----------
// Patokan industri signage: ±1,2 m per cm tinggi huruf untuk dibaca nyaman,
// ±3,5 m per cm sebagai batas maksimal (kondisi terang, kontras baik).
function capHeightCm(it) {
  const S = it.sign;
  const lines = Math.max(1, S.text.split('\n').filter((l) => l.trim()).length);
  if (!S.type.startsWith('box_')) return S.letterHeight;
  const face = S.type === 'box_rect' ? S.height : S.width * (S.type === 'box_round' ? 0.62 : 0.8);
  return (face * (S.textScale / 100) * 0.62) / lines;
}
function readability(it) {
  const cm = capHeightCm(it);
  const r = (v) => (v >= 100 ? Math.round(v / 10) * 10 : Math.round(v));
  return { cm, ideal: r(cm * 1.2), max: r(cm * 3.5) };
}
const readBlock = (it) => {
  const r = readability(it);
  return `<div class="read">${ICONS.eye}<div><b>Nyaman dibaca hingga ±${fmt(r.ideal, 0)} m</b><span>Batas maksimal ±${fmt(r.max, 0)} m · tinggi huruf ≈ ${fmt(r.cm, 0)} cm</span></div></div>`;
};

// ---------- teks halaman utama dari admin ----------
function applyContent(c) {
  if (!c) return;
  for (const el of $$('[data-c]')) {
    const v = c[el.dataset.c];
    if (typeof v === 'string' && v.trim()) el.textContent = v.trim();
  }
  if (c.whatsapp && /^\d{8,15}$/.test(c.whatsapp)) BRAND.whatsapp = c.whatsapp;
  if (c.hours) BRAND.hours = c.hours;
  if (c.area) BRAND.area = c.area;
  $('#wa-top').href = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent('Halo DAZPRO, saya ingin konsultasi signage.')}`;
  $('#foot-info').textContent = `Konsultasi ${BRAND.hours} · ${BRAND.area}`;
}

// ---------- aplikasi (PWA) ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude|claudeusercontent/.test(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* abaikan */ }));
}
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#btn-install').hidden = false; });
$('#btn-install').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice.catch(() => null);
  installEvt = null; $('#btn-install').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#btn-install').hidden = true; toast('Aplikasi Dazpro 3D terpasang'); });

// ---------- toast ----------
let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- start ----------
(async function start() {
  const wa = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent('Halo DAZPRO, saya ingin konsultasi signage.')}`;
  $('#wa-top').href = wa;
  $('#foot-info').textContent = `Konsultasi ${BRAND.hours} · ${BRAND.area}`;
  let fromLink = false;
  const m = location.hash.match(/^#d=([A-Za-z0-9_-]+)$/);
  if (m) {
    try { state = normalize(await decodeDesign(m[1])); fromLink = true; } catch (_) { /* link rusak: pakai simpanan */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* abaikan */ }
  }
  initGallery();
  applyContent(store.get('dazpro.content'));
  getSetting('content').then((c) => { store.set('dazpro.content', c); applyContent(c); }).catch(() => { /* pakai teks bawaan */ });
  // pengaturan harga dari admin: pakai cache dulu, lalu ambil versi terbaru
  setRules(store.get('dazpro.priceRules'));
  getPriceRules().then((r) => {
    store.set('dazpro.priceRules', r);
    setRules(r);
    updateSummary();
    if (tab === 'lokasi') renderPanel();
  }).catch(() => { /* offline / belum diatur: pakai cache atau rumus lama */ });
  try { fontIndex = await loadFontIndex(); } catch (_) { fontIndex = [{ id: 'poppins', name: 'Poppins Bold', cat: 'Modern' }]; }
  for (const it of state.items) if (!fontIndex.find((f) => f.id === it.sign.font)) it.sign.font = fontIndex[0].id;
  const ctx = { windowMats: [], lampMats: [], lampLights: [] };
  engine.setCity(buildCity(ctx), ctx);
  applyQuality();
  await applyAssets();
  setPanel(store.get('dazpro.panel', 1) !== 0, false);
  renderViewportUI();
  renderItems();
  renderPanel();
  invalidate({ time: true, hero: true, signs: 'all' });
  pushHistory();
  if (fromLink) { toast('Desain dari link dibuka'); autosave(); }
  window.__dazpro = { engine, setPanel, setFull, openTemplates, get state() { return state; }, change, addItem, deleteItem, travel, openShare, get pricing() { return pricing; }, get history() { return hist; } };
})();
