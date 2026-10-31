// Template desain siap pakai — titik awal cepat untuk pelanggan.
import { defaultState, defaultItem } from './config.js';

const item = (over) => {
  const it = defaultItem(1);
  for (const [k, v] of Object.entries(over)) it[k] = typeof v === 'object' && !Array.isArray(v) ? { ...it[k], ...v } : v;
  return it;
};
const make = (over, items) => ({ ...defaultState(), ...over, env: { ...defaultState().env, ...(over.env || {}) }, items, active: 0 });

export const TEMPLATES = [
  {
    id: 'kafe', name: 'Kafe senja', desc: 'Huruf script menyala hangat di atap kafe',
    preview: { bg: '#2a1d26', fg: '#ffd9a8', glow: '#ffb35c', font: 'chorus', text: 'Kopi Senja' },
    state: () => make({ placement: 'cafe', time: 'night' }, [item({
      sign: { type: 'letters_lit', text: 'Kopi Senja', font: 'chorus', letterHeight: 60, letterDepth: 8, front: { mat: 'acrylic', color: '#fff4e3' }, side: { mat: 'gold', color: '#d6b06a' } },
      led: { color: '#ffc37a', mode: 'front_halo', brightness: 80 },
      pos: { x: 0, y: 2.2, z: -0.8, rot: 0 },
    })]),
  },
  {
    id: 'butik', name: 'Butik elegan', desc: 'Huruf stainless gold tanpa lampu di tembok',
    preview: { bg: '#e9e4dc', fg: '#b08a3e', glow: null, font: 'italiana', text: 'MAISON' },
    state: () => make({ placement: 'wall', time: 'day', wall: { image: null, width: 8, height: 4.5, color: '#efe9e0', lockRatio: true } }, [item({
      sign: { type: 'letters_unlit', text: 'MAISON', font: 'italiana', letterHeight: 55, letterDepth: 4, spacing: 18, front: { mat: 'gold', color: '#d6b06a' }, side: { mat: 'gold', color: '#d6b06a' } },
      led: { on: false },
      pos: { x: 0, y: 2.4, z: 0, rot: 0 },
    })]),
  },
  {
    id: 'klinik', name: 'Klinik / apotek', desc: 'Neon box di totem, teks biru bersih',
    preview: { bg: '#f4f8ff', fg: '#0b5bd3', glow: null, font: 'outfit', text: 'KLINIK SEHAT', box: true },
    state: () => make({ placement: 'totem', time: 'dusk', env: { totemHeight: 6 } }, [item({
      sign: { type: 'box_rect', text: 'KLINIK\nSEHAT', font: 'outfit', width: 160, height: 120, depth: 25, textColor: '#0b5bd3', textScale: 80, front: { mat: 'acrylic', color: '#ffffff' }, side: { mat: 'acp', color: '#0b5bd3' } },
      led: { color: '#eef4ff', mode: 'front' },
    })]),
  },
  {
    id: 'kantor', name: 'Gedung kantor', desc: 'Huruf besar di rangka atap gedung',
    preview: { bg: '#0f172a', fg: '#ffffff', glow: '#9cc2ff', font: 'poppins', text: 'NUSANTARA' },
    state: () => make({ placement: 'rooftop', time: 'night', env: { floors: 8 } }, [item({
      sign: { type: 'letters_lit', text: 'NUSANTARA', font: 'poppins', letterHeight: 140, letterDepth: 15, front: { mat: 'acrylic', color: '#ffffff' }, side: { mat: 'stainless', color: '#c9cdd3' } },
      led: { color: '#eef4ff', mode: 'front', brightness: 85 },
      construction: { on: true, height: 90, color: '#2a2f37' },
    })]),
  },
  {
    id: 'barber', name: 'Barbershop', desc: 'Neon box bulat di tiang pinggir jalan',
    preview: { bg: '#141414', fg: '#e11d2e', glow: '#ffffff', font: 'tektur', text: 'BARBER', box: true, round: true },
    state: () => make({ placement: 'pole', time: 'dusk', env: { poleHeight: 4.5, structColor: '#111318' } }, [item({
      sign: { type: 'box_round', text: 'BARBER', font: 'tektur', width: 120, depth: 22, sides: 2, textColor: '#e11d2e', textScale: 70, front: { mat: 'acrylic', color: '#ffffff' }, side: { mat: 'acp', color: '#111318' } },
      led: { color: '#eef4ff', mode: 'front' },
    })]),
  },
  {
    id: 'bar', name: 'Night bar', desc: 'Huruf neon pink dengan efek napas',
    preview: { bg: '#12051a', fg: '#ffd1f0', glow: '#ff3fb4', font: 'bigshoulders', text: 'NIGHT BAR' },
    state: () => make({ placement: 'cafe', time: 'night' }, [item({
      sign: { type: 'letters_lit', text: 'NIGHT BAR', font: 'bigshoulders', letterHeight: 75, letterDepth: 8, spacing: 6, front: { mat: 'acrylic', color: '#ffe3f4' }, side: { mat: 'acp', color: '#15181e' } },
      led: { color: '#ff3fb4', mode: 'front_halo', effect: 'breath', brightness: 85 },
    })]),
  },
];
