// Estimasi harga — aturan di config.js (PRICING)
import { PRICING as P, SIGN_TYPES, MATERIALS, PLACEMENTS, LED_EFFECTS, PRICE_RULES_DEFAULT, INSTALL_TYPES, AREAS, INSTALL_AUTO } from './config.js';

// ---------- rumus baru (dari admin) ----------
let RULES = null;
function merge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? merge(base[k], v) : v;
  }
  return out;
}
/** Pasang pengaturan harga dari admin (null = pakai rumus lama). */
export function setRules(r) { RULES = r ? merge(PRICE_RULES_DEFAULT, r) : null; }
export const rulesActive = () => !!(RULES && RULES.active);
export const getRules = () => RULES || PRICE_RULES_DEFAULT;
export const installTypeOf = (ctx) => (ctx.install && ctx.install !== 'auto' ? ctx.install : INSTALL_AUTO[ctx.placement] || 'indoor');

export function formatRp(n) {
  const v = Math.max(0, Math.round(n / 1000) * 1000);
  return 'Rp' + v.toLocaleString('id-ID');
}
const matName = (id) => (MATERIALS.find((m) => m.id === id) || {}).name || id;
const m2 = (v) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/**
 * Rincian biaya satu signage (tanpa pemasangan).
 * @param state  tampilan item: { placement, sign, led, construction }
 * @param m      metrik hasil build { area, ledCount, letters, size, consArea, poleH, totemH }
 */
export function computeItemLines(state, m) {
  const S = state.sign, L = state.led;
  const type = SIGN_TYPES.find((t) => t.id === S.type);
  const lines = [];
  const lit = type.lit && L.on;

  if (type.group === 'box') {
    const ff = P.frontFactor[S.front.mat] ?? 1;
    const sf = P.sideFactor[S.side.mat] ?? 1;
    let v = m.area * P.boxPerM2 * (0.6 * ff + 0.4 * sf);
    if (S.type === 'box_round') v *= P.boxRoundFactor;
    v = Math.max(P.boxMin, v);
    lines.push({ label: `${type.name} ${S.width}×${S.type === 'box_rect' ? S.height : S.width}×${S.depth} cm`, detail: `${m2(m.area)} m² · muka ${matName(S.front.mat)}, sisi ${matName(S.side.mat)}`, amount: v });
  } else {
    const h = S.letterHeight;
    const per = (P.letterPerCm[S.front.mat] ?? 9000) + (P.letterSideAdd[S.side.mat] ?? 2000) + (lit ? P.letterLitPerCm : 0);
    // faktor tebal: return > 10 cm sedikit lebih mahal
    const depthF = 1 + Math.max(0, S.letterDepth - 10) * 0.02;
    const each = Math.max(P.letterMin, h * per * depthF);
    lines.push({ label: `${type.name} ${m.letters} huruf × ${h} cm`, detail: `muka ${matName(S.front.mat)}, samping ${matName(S.side.mat)}, tebal ${S.letterDepth} cm · ${formatRp(each)}/huruf`, amount: each * m.letters });
    if (S.backPanel.on) {
      lines.push({ label: 'Panel latar ACP', detail: `${m2(m.area)} m²`, amount: Math.max(350000, m.area * P.backPanelPerM2) });
    }
  }

  if (type.lit && L.on && m.ledCount) {
    const psu = Math.ceil(m.ledCount / 100) * P.powerSupplyPer100;
    lines.push({ label: 'LED modul & power supply', detail: `${m.ledCount} modul · ${Math.ceil(m.ledCount / 100)} PSU`, amount: m.ledCount * P.ledModule + psu });
    if (L.effect !== 'static') {
      lines.push({ label: `Controller efek ${(LED_EFFECTS.find((e) => e.id === L.effect) || {}).name}`, detail: '', amount: P.ledEffectController });
    }
  }

  if ((state.placement === 'rooftop' || state.placement === 'cafe') && state.construction.on && m.consArea) {
    lines.push({ label: 'Konstruksi besi hollow', detail: `tinggi kaki ${state.construction.height} cm · bidang ${m2(m.consArea)} m²`, amount: P.constructionBase + m.consArea * P.constructionPerM2 });
  }
  if (state.placement === 'pole' && m.poleH) {
    lines.push({ label: 'Tiang besi & pondasi', detail: `tinggi ${m2(m.poleH)} m`, amount: P.poleBase + m.poleH * P.polePerM });
  }
  if (state.placement === 'totem' && m.totemH) {
    lines.push({ label: 'Struktur totem ACP', detail: `tinggi ${m2(m.totemH)} m`, amount: m.totemH * P.totemPerM });
  }
  return lines;
}

/**
 * Total desain: semua signage + satu biaya pemasangan
 * (signage tambahan di lokasi yang sama +40% per unit).
 * @param list [{ name, view, metrics }]
 */
export function computePrice(placement, list, ctx = {}) {
  if (rulesActive()) return computePriceV2({ placement, floors: 4, install: 'auto', area: 'malang', ...ctx }, list);
  const lines = [];
  const multi = list.length > 1;
  list.forEach((it) => {
    for (const l of computeItemLines(it.view, it.metrics)) lines.push({ ...l, group: multi ? it.name : null });
  });
  const pl = PLACEMENTS.find((p) => p.id === placement);
  const base = P.install[placement] || 0;
  const extra = Math.max(0, list.length - 1);
  lines.push({
    label: `Pemasangan — ${pl.name}`,
    detail: extra ? `${list.length} signage · termasuk transport area kota` : 'termasuk transport area kota',
    amount: base * (1 + 0.4 * extra),
    group: multi ? 'Pemasangan' : null,
  });
  const total = lines.reduce((a, l) => a + l.amount, 0);
  return { lines, total };
}

// ================= RUMUS BARU =================
const cm = (v) => Math.round(v).toLocaleString('id-ID');
const rpx = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');

/** Harga produk signage + additional untuk satu item (rumus baru). */
function itemLinesV2(R, view, m) {
  const S = view.sign, L = view.led;
  const type = SIGN_TYPES.find((t) => t.id === S.type);
  const lines = [];
  const mf = R.matFactor[S.front.mat] ?? 1;
  const mfTxt = mf !== 1 ? ` · faktor ${matName(S.front.mat)} ×${mf}` : '';
  if (type.group === 'box') {
    const round = S.type === 'box_round';
    const sides = S.sides === 2 ? 2 : 1;
    const k = sides === 2 ? R.mult.box2 : R.mult.box1;
    const size = round || S.type === 'box_square' ? S.width : Math.max(S.width, S.height);
    const base = round ? R.base.box_round : R.base.box_rect;
    lines.push({
      label: `${type.name} ${sides} sisi`,
      detail: `${rpx(base)} × ${cm(size)} cm (${round ? 'diameter' : 'sisi terpanjang'}) × ${k}${mfTxt}`,
      amount: base * size * k * mf,
    });
  } else {
    const base = type.lit ? R.base.letters_lit : R.base.letters_unlit;
    const k = R.mult.letters;
    lines.push({
      label: `${type.name} ${m.letters} huruf × ${cm(S.letterHeight)} cm`,
      detail: `${rpx(base)} × ${cm(S.letterHeight)} cm × ${m.letters} huruf${k !== 1 ? ' × ' + k : ''}${mfTxt}`,
      amount: base * S.letterHeight * m.letters * k * mf,
    });
  }
  // ---- biaya additional ----
  const A = R.additional;
  if (type.group !== 'box' && S.backPanel.on) lines.push({ label: 'Additional · panel latar ACP', detail: `${m2(m.area)} m²`, amount: m.area * A.backPanelPerM2, add: true });
  if (type.lit && L.on && L.effect !== 'static') lines.push({ label: `Additional · controller efek ${(LED_EFFECTS.find((e) => e.id === L.effect) || {}).name}`, detail: '', amount: A.ledEffect, add: true });
  if ((view.placement === 'rooftop' || view.placement === 'cafe') && view.construction.on && m.consArea) {
    lines.push({ label: 'Additional · kerangka konstruksi besi', detail: `tinggi kaki ${view.construction.height} cm · bidang ${m2(m.consArea)} m²`, amount: A.constructionBase + m.consArea * A.constructionPerM2, add: true });
  }
  if (view.placement === 'pole' && m.poleH) lines.push({ label: 'Additional · tiang besi & pondasi', detail: `tinggi ${m2(m.poleH)} m`, amount: A.poleBase + m.poleH * A.polePerM, add: true });
  if (view.placement === 'totem' && m.totemH) lines.push({ label: 'Additional · struktur totem', detail: `tinggi ${m2(m.totemH)} m`, amount: m.totemH * A.totemPerM, add: true });
  return lines;
}

/** Biaya pemasangan reguler satu signage. */
function installLine(R, ctx, m) {
  const t = installTypeOf(ctx);
  const I = R.install;
  const name = (INSTALL_TYPES.find((x) => x.id === t) || {}).name;
  if (t === 'indoor') {
    const longest = m.size ? Math.max(m.size.w, m.size.h) : 0;
    const extra = Math.max(0, Math.ceil(longest - I.indoorFreeM - 1e-6));
    return { label: `Pemasangan · ${name}`, detail: extra ? `${rpx(I.indoor)} + ${extra} m × ${rpx(I.indoorPerM)} (lebih dari ${I.indoorFreeM} m)` : `ukuran ≤ ${I.indoorFreeM} m`, amount: I.indoor + extra * I.indoorPerM };
  }
  if (t === 'listplang') return { label: `Pemasangan · ${name}`, detail: '', amount: I.listplang };
  const floors = ctx.placement === 'rooftop' ? ctx.floors : I.cafeFloors;
  return { label: `Pemasangan · ${name}`, detail: `${floors} lantai × ${rpx(I.rooftopPerFloor)}`, amount: floors * I.rooftopPerFloor };
}

function computePriceV2(ctx, list) {
  const R = RULES;
  const lines = [];
  const multi = list.length > 1;
  list.forEach((it) => {
    const g = multi ? it.name : null;
    for (const l of itemLinesV2(R, it.view, it.metrics)) lines.push({ ...l, group: g });
    lines.push({ ...installLine(R, ctx, it.metrics), group: g });
  });
  const g = multi ? 'Transport & pajak' : null;
  const area = AREAS.find((a) => a.id === ctx.area) || AREAS[0];
  lines.push({ label: `Transport · ${area.name}`, detail: '', amount: R.transport[area.id] || 0, group: g });
  const sub = lines.reduce((a, l) => a + l.amount, 0);
  lines.push({ label: `Pajak ${R.taxPct}%`, detail: `dari ${formatRp(sub)}`, amount: sub * R.taxPct / 100, group: g });
  const total = lines.reduce((a, l) => a + l.amount, 0);
  const missing = Object.entries(R.base).filter(([, v]) => !v).map(([k]) => k);
  return { lines, total, rules: 'v2', missing };
}
