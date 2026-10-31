// DAZPRO Signage Studio — aplikasi utama
import * as THREE from 'three';
import { Engine } from './engine.js';
import { buildCity, buildHero, placementInfo, buildConstruction, buildTotem, buildPole } from './environment.js';
import { buildSign } from './signage.js';
import { loadFont, loadFontIndex, drawTextFit } from './fonts.js';
import { MAT_DEFAULT_COLOR } from './materials.js';
import { computePrice, formatRp } from './pricing.js';
import { ICONS } from './icons.js';
import {
  BRAND, PLACEMENTS, SIGN_TYPES, MATERIALS, SWATCHES, LED_COLORS, LED_MODES, LED_EFFECTS, LED_DENSITY, TIMES, BG_PRESETS, defaultState,
} from './config.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: d });
const clamp = THREE.MathUtils.clamp;

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
let state = deepMerge(defaultState(), store.get('dazpro.current'));
const posMemory = {}; // posisi terakhir per lokasi
const assets = { logo: null, wallTex: null, bgTex: null };
let fontIndex = [];
let tab = 'lokasi';
let signRes = null;
let mountRes = null;
let pricing = { lines: [], total: 0 };

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
  onDrag(p) {
    const info = placementInfo(state);
    if (info.kind === 'wall') { state.pos.x = p.x; state.pos.y = p.y; } else { state.pos.x = p.x; state.pos.z = p.z; }
    mount(false);
    syncPosInputs();
  },
  onDragEnd() { autosave(); updateSummary(); },
  onModeChange(m) {
    $('#walk-ui').hidden = m !== 'walk';
    $('#vp-hint').hidden = m === 'walk';
    $$('#cams button').forEach((b) => b.classList.toggle('active', m === 'walk' && b.dataset.cam === 'walk'));
  },
  onWalkView(v) { $('#walk-view').textContent = v === 'third' ? 'Orang pertama' : 'Orang ketiga'; },
});

// ---------- pipeline build ----------
let pending = {};
let scheduled = false;
let signToken = 0;
function invalidate(flags) {
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
  if (f.sign) { await rebuildSign(); return; } // rebuildSign memanggil mount
  if (f.hero || f.mount) mount(true);
}

function applyTime() {
  engine.setTime(state.time, state.bg, assets.bgTex);
  engine.setCityVisible(state.env.showCity !== false);
  const ground = engine.roots.city.getObjectByName('ground');
  if (ground) ground.visible = true;
}

function rebuildHero() {
  const ctx = { windowMats: [], lampMats: [], lampLights: [] };
  const { group } = buildHero(state, ctx, assets);
  engine.setHero(group, ctx);
}

async function rebuildSign() {
  const token = ++signToken;
  let font;
  try { font = await loadFont(state.sign.font); } catch (e) {
    toast('Font gagal dimuat, memakai Poppins');
    state.sign.font = 'poppins';
    font = await loadFont('poppins');
  }
  if (token !== signToken) return;
  signRes = buildSign(state, font, assets);
  engine.setSign(signRes.group, {
    glow: signRes.glow, halo: signRes.halo, light: signRes.light, lightBase: signRes.lightBase || 0,
    effect: state.led.effect, ledColor: new THREE.Color(state.led.color),
  });
  mount(true);
  showWarnings();
}

/** Tempatkan signage & struktur pendukung sesuai lokasi. */
function mount(rebuildSupport) {
  if (!signRes) return;
  const info = placementInfo(state);
  const size = signRes.size;
  const p = state.pos;
  const rot = THREE.MathUtils.degToRad(state.pos.rot || 0);
  const up = new THREE.Vector3(0, 1, 0);
  let signPos, supportPos, signRot = rot, plane, origin;
  const res = { consArea: 0, poleH: 0, totemH: 0 };

  if (info.kind === 'roof') {
    const hx = Math.max(0, (info.x[1] - info.x[0]) / 2 - size.w / 2 - 0.3);
    p.x = clamp(p.x, -hx, hx);
    p.z = clamp(p.z, info.z[0] + 2.6, info.z[1] - 0.4);
    const consH = state.construction.on ? state.construction.height / 100 : 0;
    signPos = new THREE.Vector3(p.x, info.roofY + (state.construction.on ? consH : 0.02), p.z);
    supportPos = new THREE.Vector3(p.x, info.roofY, p.z);
    if (rebuildSupport) {
      const g = new THREE.Group();
      if (state.construction.on) {
        const c = buildConstruction(size, consH, state.construction.color);
        g.add(c);
        res.consArea = c.userData.frameArea;
      }
      engine.setSupport(g);
    } else if (mountRes) res.consArea = mountRes.consArea;
    plane = new THREE.Plane(up, -info.roofY);
    origin = () => new THREE.Vector3(state.pos.x, info.roofY, state.pos.z);
  } else if (info.kind === 'ground') {
    p.x = clamp(p.x, info.x[0], info.x[1]);
    p.z = clamp(p.z, info.z[0], info.z[1]);
    supportPos = new THREE.Vector3(p.x, 0, p.z);
    let local;
    if (state.placement === 'totem') {
      const t = buildTotem(size, state.env.totemHeight, state.env.structColor);
      if (rebuildSupport) engine.setSupport(t.group);
      local = new THREE.Vector3(0, t.signY, t.frontZ);
      res.totemH = t.height;
    } else {
      const isBox = state.sign.type.startsWith('box_');
      const t = buildPole(size, state.env.poleHeight, state.env.structColor, isBox);
      if (rebuildSupport) engine.setSupport(t.group);
      local = new THREE.Vector3(0, t.signY, -size.d / 2);
      res.poleH = state.env.poleHeight + size.h * 0.5;
    }
    signPos = local.applyAxisAngle(up, rot).add(supportPos);
    plane = new THREE.Plane(up, 0);
    origin = () => new THREE.Vector3(state.pos.x, 0, state.pos.z);
  } else {
    const W = state.wall.width, H = state.wall.height;
    const hx = Math.max(0, W / 2 - size.w / 2);
    p.x = clamp(p.x, -hx, hx);
    p.y = clamp(p.y, 0.05, Math.max(0.05, H - size.h));
    signPos = new THREE.Vector3(p.x, p.y, 0);
    supportPos = new THREE.Vector3();
    signRot = 0;
    if (rebuildSupport) engine.setSupport(null);
    plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    origin = () => new THREE.Vector3(state.pos.x, state.pos.y, 0);
  }
  engine.setSignTransform(signPos, signRot);
  engine.setSupportTransform(supportPos, info.kind === 'wall' ? 0 : rot);
  engine.setDragPlane(plane, origin);
  const center = new THREE.Vector3(0, size.h / 2, size.d / 2).applyAxisAngle(up, signRot).add(signPos);
  engine.focus(center, size);
  mountRes = res;
  updateSummary();
  updateSpec();
  if (!mount.ready) {
    mount.ready = true;
    engine.cameraPreset(state.placement === 'wall' ? 'front' : state.placement === 'rooftop' ? 'street' : 'hero', true);
    $('#loader').classList.add('done');
  }
}

function showWarnings() {
  const w = $('#vp-warn');
  const list = signRes ? signRes.warnings : [];
  w.hidden = !list.length;
  w.textContent = list.join(' ');
}

// ---------- ringkasan & harga ----------
function metrics() {
  return {
    area: signRes ? signRes.area : 0,
    ledCount: signRes ? signRes.ledCount : 0,
    letters: signRes ? signRes.letters : 0,
    size: signRes ? signRes.size : null,
    consArea: mountRes ? mountRes.consArea : 0,
    poleH: mountRes ? mountRes.poleH : 0,
    totemH: mountRes ? mountRes.totemH : 0,
  };
}

function updateSummary() {
  if (!signRes) return;
  pricing = computePrice(state, metrics());
  $('#sum-price').textContent = formatRp(pricing.total);
  const type = SIGN_TYPES.find((t) => t.id === state.sign.type);
  const pl = PLACEMENTS.find((p) => p.id === state.placement);
  $('#sum-title').textContent = state.sign.text.split('\n')[0] || type.name;
  const what = type.group === 'box' ? `${state.sign.width}×${state.sign.type === 'box_rect' ? state.sign.height : state.sign.width} cm` : `${signRes.letters} huruf × ${state.sign.letterHeight} cm`;
  $('#sum-meta').textContent = `${type.name} · ${what} · ${pl.name}${state.led.on && type.lit ? ' · LED ' + (LED_COLORS.find((c) => c.hex === state.led.color)?.name || 'custom') : ''}`;
  $('#vp-title').textContent = `${pl.name} · ${type.name}`;
}

function updateSpec() {
  if (!signRes) return;
  const s = signRes.size;
  $('#vp-spec').textContent = `L ${fmt(s.w)} m × T ${fmt(s.h)} m × D ${fmt(s.d * 100, 0)} cm`;
  const out = $('#model-size');
  if (out) out.textContent = `Ukuran jadi ≈ ${fmt(s.w)} × ${fmt(s.h)} m`;
  const lc = $('#led-count');
  if (lc) lc.textContent = signRes.ledCount ? `${signRes.ledCount} modul LED terpasang` : '';
}

// ---------- autosave ----------
let saveTimer = 0;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set('dazpro.current', state), 400);
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
  const posCtl = info.kind === 'wall'
    ? range('pos.x', 'Geser horizontal', -S.wall.width / 2, S.wall.width / 2, 0.01, ' m') + range('pos.y', 'Tinggi dari lantai', 0, S.wall.height, 0.01, ' m')
    : range('pos.x', 'Geser kiri–kanan', info.x[0], info.x[1], 0.01, ' m') + range('pos.z', 'Maju–mundur', info.kind === 'roof' ? info.z[0] + 2.6 : info.z[0], info.kind === 'roof' ? info.z[1] - 0.4 : info.z[1], 0.01, ' m') + range('pos.rot', 'Rotasi', -180, 180, 1, '°');
  return `<h2 class="sec-title">Lokasi pemasangan</h2><p class="sec-sub">Pilih di mana signage akan dipasang.</p>
    <div class="group"><div class="cards">${PLACEMENTS.map((p) => `<button class="card ${S.placement === p.id ? 'active' : ''}" data-set="placement" data-value="${p.id}"><div class="ic">${ICONS[p.id]}</div><b>${p.name}</b><span>${p.desc}</span></button>`).join('')}</div></div>
    ${specific}
    <div class="divider"></div>
    <div class="group"><div class="lbl">Posisi signage</div><p class="hint" style="margin:-4px 0 10px">Tip: seret langsung signage di layar 3D.</p>${posCtl}
      <button class="btn btn-sm btn-ghost" data-action="center">Kembalikan ke posisi awal</button></div>
    <div class="divider"></div>
    <div class="group"><div class="lbl">Latar belakang</div><div class="seg-ctl">${BG_PRESETS.map((b) => chip('bg.mode', b.id, b.name, S.bg.mode)).join('')}</div></div>
    ${S.bg.mode === 'color' ? `<div class="group">${swatches('bg.color', ['#dfe4ea', '#ffffff', '#0f172a', '#1e293b', '#f5efe6', '#d1e7f5'])}</div>` : ''}
    ${S.bg.mode === 'image' ? `<div class="group">${upload('bg.image', 'Foto latar', !!S.bg.image, S.bg.image)}<p class="hint">Foto 360° (rasio 2:1) akan menjadi panorama; foto biasa jadi latar layar.</p></div>` : ''}
    <div class="group">${toggle('env.showCity', 'Tampilkan lingkungan kota', 'Matikan untuk tampilan bersih dengan foto latar')}</div>`;
}

function panelModel() {
  const S = state.sign;
  const t = SIGN_TYPES.find((x) => x.id === S.type);
  let dims;
  if (t.group === 'box') {
    dims = `<div class="row3">${numIn('sign.width', S.type === 'box_round' ? 'Diameter (cm)' : 'Lebar (cm)', 30, 1200)}${S.type === 'box_rect' ? numIn('sign.height', 'Tinggi (cm)', 20, 600) : '<span></span>'}${numIn('sign.depth', 'Tebal (cm)', 8, 60)}</div>`;
  } else {
    dims = range('sign.letterHeight', 'Tinggi huruf kapital', 10, 300, 1, ' cm') + range('sign.letterDepth', 'Tebal huruf (return)', 2, 30, 0.5, ' cm');
  }
  return `<h2 class="sec-title">Model signage</h2><p class="sec-sub">Neon box atau huruf timbul — menyala maupun tidak.</p>
    <div class="group"><div class="cards">${SIGN_TYPES.map((x) => `<button class="card ${S.type === x.id ? 'active' : ''}" data-set="sign.type" data-value="${x.id}"><div class="ic">${ICONS[x.id]}</div><b>${x.name}</b><span>${x.desc}</span></button>`).join('')}</div></div>
    <div class="group"><div class="lbl">Ukuran<span class="val" id="model-size"></span></div>${dims}</div>
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
    ${isBox ? `<div class="group"><div class="lbl">Warna teks pada muka</div>${swatches('sign.textColor')}</div>
      ${range('sign.textScale', 'Ukuran teks pada muka', 25, 100, 1, '%')}
      <div class="group"><div class="lbl">Logo (opsional)</div>${upload('sign.logo', 'Logo usaha', !!S.logo, S.logo)}<p class="hint">PNG transparan paling bagus. Logo diletakkan di kiri teks.</p></div>`
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
    <div class="group"><div class="lbl">Waktu tampilan</div><div class="seg-ctl">${TIMES.map((x) => chip('time', x.id, x.name, state.time)).join('')}</div></div>`;
}

function panelStruktur() {
  const S = state;
  if (S.placement === 'rooftop' || S.placement === 'cafe') {
    return `<h2 class="sec-title">Konstruksi penyangga</h2><p class="sec-sub">Rangka besi hollow untuk signage di atas bangunan.</p>
      <div class="group">${toggle('construction.on', 'Pakai rangka besi', 'Kaki depan, kaki belakang, skur, dan base plate')}</div>
      ${S.construction.on ? range('construction.height', 'Tinggi kaki dari atap', 0, 400, 5, ' cm') + `<div class="group"><div class="lbl">Warna rangka</div>${swatches('construction.color', ['#2a2f37', '#111318', '#6b7280', '#ffffff', '#b91c1c'])}</div>` : ''}
      <p class="hint">Jumlah kaki menyesuaikan lebar signage (jarak ±1,5 m). Ukuran final ditentukan setelah survei struktur atap.</p>`;
  }
  const msg = {
    totem: 'Signage dipasang pada badan totem. Atur tinggi & warna totem di tab Lokasi.',
    pole: 'Signage dipasang di ujung tiang. Atur tinggi & warna tiang di tab Lokasi.',
    wall: 'Signage dipasang menempel di tembok dengan baut/standoff — tidak perlu rangka besi.',
  }[S.placement];
  return `<h2 class="sec-title">Konstruksi penyangga</h2><p class="sec-sub">Rangka besi tersedia untuk lokasi Atas Gedung & Atas Kafe.</p>
    <div class="note">${msg}</div>
    <div class="cards" style="margin-top:14px">${['rooftop', 'cafe'].map((id) => { const p = PLACEMENTS.find((x) => x.id === id); return `<button class="card" data-set="placement" data-value="${id}"><div class="ic">${ICONS[id]}</div><b>${p.name}</b><span>Pakai rangka besi</span></button>`; }).join('')}</div>`;
}

const PANELS = { lokasi: panelLokasi, model: panelModel, teks: panelTeks, bahan: panelBahan, lampu: panelLampu, struktur: panelStruktur };

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
  if (path === 'time' || path.startsWith('bg.') || path === 'env.showCity') return { time: true };
  if (path === 'placement' || path.startsWith('env.') || path.startsWith('wall.')) return { hero: true, sign: true };
  if (path.startsWith('sign.') || path.startsWith('led.')) return { sign: true };
  if (path.startsWith('construction.')) return { mount: true };
  if (path.startsWith('pos.')) return { mount: true };
  return { sign: true };
}

const BOX_PRESET = { front: { mat: 'acrylic', color: '#ffffff' }, side: { mat: 'acp', color: '#15181e' }, textColor: '#d31d2a' };
const LETTER_PRESET = { front: { mat: 'acrylic', color: '#ffffff' }, side: { mat: 'stainless', color: '#c9cdd3' } };
const UNLIT_PRESET = { front: { mat: 'gold', color: '#d6b06a' }, side: { mat: 'gold', color: '#d6b06a' } };

function change(path, value, { rerender = false } = {}) {
  const prev = getPath(state, path);
  if (path === 'placement' && prev !== value) {
    posMemory[prev] = { ...state.pos };
    state.placement = value;
    const info = placementInfo(state);
    state.pos = posMemory[value] ? { ...posMemory[value] } : { ...state.pos, ...info.defaultPos, rot: 0 };
    if (value === 'cafe' && state.construction.height > 150) state.construction.height = 60;
    if (value === 'rooftop' && state.construction.height < 60) state.construction.height = 120;
    state.sign.backPanel.on = state.sign.backPanel.on || false;
    invalidate({ hero: true, sign: true });
    mount.ready = false;
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
    invalidate({ sign: true });
  } else {
    setPath(state, path, value);
    if (path === 'wall.width' && state.wall.lockRatio && assets.wallAspect) state.wall.height = +(value / assets.wallAspect).toFixed(2);
    if (path === 'wall.lockRatio' && value && assets.wallAspect) state.wall.height = +(state.wall.width / assets.wallAspect).toFixed(2);
    invalidate(routeFlags(path));
    if (path === 'time') $$('#time-seg button').forEach((x) => x.classList.toggle('active', x.dataset.time === value));
  }
  if (rerender) renderPanel();
  autosave();
}

// klik opsi (kartu, chip, swatch)
$('#panel-body').addEventListener('click', (e) => {
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
      const info = placementInfo(state);
      Object.assign(state.pos, info.defaultPos, { rot: 0 });
      invalidate({ mount: true });
      renderPanel();
      engine.cameraPreset('front');
    }
    if (act.dataset.action === 'clear') {
      const key = act.dataset.key;
      setPath(state, key, null);
      applyAssets().then(() => { invalidate(routeFlags(key)); if (key === 'bg.image') invalidate({ time: true }); renderPanel(); autosave(); });
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
  if (el.type === 'color') {
    $$('.sw', el.closest('.swatches')).forEach((s) => s.classList.remove('active'));
  }
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
    const url = await readImage(file, isLogo ? 900 : 2400, isLogo ? 'image/png' : 'image/jpeg');
    setPath(state, key, url);
    await applyAssets();
    if (key === 'wall.image' && assets.wallAspect) {
      state.wall.lockRatio = true;
      state.wall.height = +(state.wall.width / assets.wallAspect).toFixed(2);
      state.pos.y = clamp(state.pos.y, 0, state.wall.height);
      engine.cameraPreset('front');
    }
    invalidate(key === 'bg.image' ? { time: true } : routeFlags(key));
    renderPanel();
    if (!store.set('dazpro.current', state)) toast('Gambar terlalu besar untuk disimpan otomatis — gunakan Export .json');
    toast('Gambar terpasang');
  } catch (err) {
    toast('Gagal membaca gambar');
  }
}

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function applyAssets() {
  // logo
  assets.logo = state.sign.logo ? await loadImg(state.sign.logo).catch(() => null) : null;
  // tembok
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
  // latar
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
  $('#btn-full').innerHTML = ICONS.expand;
}

$('#time-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-time]');
  if (!b) return;
  change('time', b.dataset.time);
  $$('#time-seg button').forEach((x) => x.classList.toggle('active', x === b));
  if (tab === 'lampu') renderPanel();
});

$('#cams').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cam]');
  if (!b) return;
  if (b.dataset.cam === 'walk') {
    const zMin = { rooftop: 0.8, cafe: 0.8, wall: 0.6, totem: -4, pole: -1 }[state.placement];
    engine.enterWalk({ x: [-45, 45], z: [zMin, 21] });
  } else engine.cameraPreset(b.dataset.cam);
});

$('#walk-exit').addEventListener('click', () => engine.exitWalk());
$('#walk-view').addEventListener('click', () => engine.toggleWalkView());
$('#walk-run').addEventListener('click', (e) => { const on = !engine.walk.sprint; engine.setSprint(on); e.currentTarget.classList.toggle('on', on); });

// joystick
(() => {
  const joy = $('#joy'), knob = $('#joy-knob');
  let id = null;
  const move = (e) => {
    const r = joy.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
    engine.setJoystick(x, -y);
  };
  joy.addEventListener('pointerdown', (e) => { id = e.pointerId; joy.setPointerCapture(id); move(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = () => { id = null; knob.style.transform = ''; engine.setJoystick(0, 0); };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
})();

$('#btn-full').addEventListener('click', () => {
  const el = viewport;
  if (document.fullscreenElement) document.exitFullscreen();
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => toast('Layar penuh tidak didukung'));
  else toast('Layar penuh tidak didukung di perangkat ini');
});

function download(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
const slug = () => (state.sign.text.split('\n')[0] || 'signage').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'signage';

$('#btn-shot').addEventListener('click', () => { download(engine.screenshot(), `dazpro-${slug()}.png`); toast('Gambar disimpan'); });

// ---------- rincian harga ----------
function openModal(id) { $(id).hidden = false; }
$$('.drawer').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.hidden = true; }));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') $$('.drawer').forEach((d) => (d.hidden = true)); });

function linesTable() {
  return `<table class="lines">${pricing.lines.map((l) => `<tr><td>${esc(l.label)}${l.detail ? `<small>${esc(l.detail)}</small>` : ''}</td><td>${formatRp(l.amount)}</td></tr>`).join('')}
    <tr class="total"><td>Total estimasi</td><td>${formatRp(pricing.total)}</td></tr></table>
    <p class="muted small">Estimasi kasar berdasarkan ukuran, bahan, LED, dan lokasi. Harga final dikonfirmasi setelah survei lokasi.</p>`;
}
$('#sum-total').addEventListener('click', () => { $('#drawer-body').innerHTML = linesTable(); openModal('#drawer'); });

// ---------- pengajuan ----------
let lastShot = '';
$('#btn-submit').addEventListener('click', () => {
  lastShot = engine.screenshot();
  $('#submit-preview').src = lastShot;
  openModal('#submit-modal');
});
$('#submit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const S = state.sign;
  const type = SIGN_TYPES.find((t) => t.id === S.type);
  const pl = PLACEMENTS.find((p) => p.id === state.placement);
  const mat = (id) => (MATERIALS.find((m) => m.id === id) || {}).name;
  const size = signRes.size;
  const msg = [
    `Halo ${BRAND.name}, saya ingin penawaran signage:`,
    '',
    `Nama: ${fd.get('name')}`,
    fd.get('biz') ? `Usaha: ${fd.get('biz')}` : null,
    fd.get('city') ? `Lokasi: ${fd.get('city')}` : null,
    '',
    `• Model: ${type.name}`,
    `• Teks: "${S.text.replace(/\n/g, ' / ')}" (font ${(fontIndex.find((f) => f.id === S.font) || {}).name})`,
    `• Ukuran jadi: ${fmt(size.w)} × ${fmt(size.h)} m, tebal ${fmt(size.d * 100, 0)} cm`,
    `• Bahan depan: ${mat(S.front.mat)} ${S.front.color} · samping: ${mat(S.side.mat)} ${S.side.color}`,
    type.lit ? `• LED: ${state.led.on ? `${LED_COLORS.find((c) => c.hex === state.led.color)?.name || state.led.color}, mode ${LED_MODES.find((m) => m.id === state.led.mode)?.name}, efek ${LED_EFFECTS.find((x) => x.id === state.led.effect)?.name}, ${signRes.ledCount} modul` : 'mati'}` : null,
    `• Penempatan: ${pl.name}${(state.placement === 'rooftop' || state.placement === 'cafe') && state.construction.on ? ` + rangka besi ${state.construction.height} cm` : ''}`,
    '',
    'Rincian estimasi:',
    ...pricing.lines.map((l) => `- ${l.label}: ${formatRp(l.amount)}`),
    `Total estimasi: ${formatRp(pricing.total)}`,
    fd.get('note') ? `\nCatatan: ${fd.get('note')}` : null,
    '\n(Gambar desain 3D saya lampirkan.)',
  ].filter((x) => x !== null).join('\n');
  download(lastShot, `dazpro-${slug()}.png`);
  window.open(`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  $('#submit-modal').hidden = true;
  toast('Membuka WhatsApp…');
});

// ---------- menu proyek ----------
$('#btn-project').addEventListener('click', (e) => { e.stopPropagation(); $('#project-menu').hidden = !$('#project-menu').hidden; });
document.addEventListener('click', () => ($('#project-menu').hidden = true));
$('#project-menu').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'save') {
    const list = store.get('dazpro.projects', []);
    const name = (state.sign.text.split('\n')[0] || 'Desain') + ' — ' + PLACEMENTS.find((p) => p.id === state.placement).name;
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
    $('#load-list').innerHTML = list.length ? list.map((p, i) => `<div class="load-item"><img src="${p.thumb}" width="96" height="54" style="border-radius:8px;object-fit:cover" alt="" /><div style="flex:1"><b>${esc(p.name)}</b><small>${esc(p.date)}</small></div><button class="btn btn-sm btn-ghost" data-load="${i}">Buka</button><button class="btn btn-sm btn-ghost" data-del="${i}">Hapus</button></div>`).join('') : '<p class="muted">Belum ada simpanan.</p>';
    openModal('#load-modal');
  }
  if (act === 'export') {
    const blob = new Blob([JSON.stringify({ app: 'dazpro-signage', ...state }, null, 1)], { type: 'application/json' });
    download(URL.createObjectURL(blob), `dazpro-${slug()}.json`);
  }
  if (act === 'import') $('#file-json').click();
  if (act === 'reset' && confirm('Mulai desain baru? Perubahan yang belum disimpan akan hilang.')) loadState(defaultState());
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
  try { loadState(JSON.parse(await f.text())); toast('Proyek dimuat'); } catch (_) { toast('File tidak valid'); }
  e.target.value = '';
});

async function loadState(s) {
  state = deepMerge(defaultState(), s);
  await applyAssets();
  mount.ready = false;
  renderViewportUI();
  renderPanel();
  invalidate({ time: true, hero: true, sign: true });
  autosave();
}

// ---------- toast ----------
let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2400);
}

// ---------- start ----------
(async function start() {
  const wa = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent('Halo DAZPRO, saya ingin konsultasi signage.')}`;
  $('#wa-top').href = wa;
  $('#foot-info').textContent = `Konsultasi ${BRAND.hours} · ${BRAND.area}`;
  try { fontIndex = await loadFontIndex(); } catch (_) { fontIndex = [{ id: 'poppins', name: 'Poppins Bold', cat: 'Modern' }]; }
  if (!fontIndex.find((f) => f.id === state.sign.font)) state.sign.font = fontIndex[0].id;
  const ctx = { windowMats: [], lampMats: [], lampLights: [] };
  engine.setCity(buildCity(ctx), ctx);
  await applyAssets();
  renderViewportUI();
  renderPanel();
  invalidate({ time: true, hero: true, sign: true });
  window.__dazpro = { engine, get state() { return state; }, change, get pricing() { return pricing; } };
})();
