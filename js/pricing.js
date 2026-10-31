// Estimasi harga — aturan di config.js (PRICING)
import { PRICING as P, SIGN_TYPES, MATERIALS, PLACEMENTS, LED_EFFECTS } from './config.js';

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
export function computePrice(placement, list) {
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
