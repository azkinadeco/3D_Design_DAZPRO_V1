// ============================================================
//  DAZPRO Signage Studio — konfigurasi katalog & harga
//  Ubah nilai di file ini untuk menyesuaikan bisnis Anda.
// ============================================================

export const BRAND = {
  name: 'DAZPRO',
  tagline: 'Signage Studio 3D',
  // Nomor WhatsApp tujuan pengajuan desain (format internasional, tanpa +)
  whatsapp: '6281234567890',
  hours: '08.00–20.00 WIB',
  area: 'Surabaya & seluruh Indonesia',
};

// ---------- Lokasi penempatan ----------
export const PLACEMENTS = [
  { id: 'rooftop', name: 'Atas Gedung', desc: 'Signage di atap gedung bertingkat', icon: 'building' },
  { id: 'totem',   name: 'Totem / Pylon', desc: 'Tugu berdiri di area depan', icon: 'totem' },
  { id: 'cafe',    name: 'Atas Kafe', desc: 'Di atap bangunan kafe / ruko', icon: 'cafe' },
  { id: 'pole',    name: 'Tiang Jalan', desc: 'Tiang di pinggir jalan', icon: 'pole' },
  { id: 'wall',    name: 'Tempel Dinding', desc: 'Menempel di tembok (foto custom)', icon: 'wall' },
];

// ---------- Model signage ----------
export const SIGN_TYPES = [
  { id: 'box_rect',     name: 'Neon Box Kotak',      desc: 'Persegi panjang', group: 'box', lit: true },
  { id: 'box_square',   name: 'Neon Box Persegi',    desc: 'Sisi sama (bujur sangkar)', group: 'box', lit: true },
  { id: 'box_round',    name: 'Neon Box Bulat',      desc: 'Lingkaran', group: 'box', lit: true },
  { id: 'letters_lit',  name: 'Huruf Timbul Menyala', desc: 'Huruf 3D dengan LED', group: 'letters', lit: true },
  { id: 'letters_unlit',name: 'Huruf Timbul Non-Lampu', desc: 'Huruf 3D tanpa LED', group: 'letters', lit: false },
];

// ---------- Bahan ----------
export const MATERIALS = [
  { id: 'acrylic',   name: 'Acrylic',    desc: 'Tembus cahaya, bisa menyala' },
  { id: 'stainless', name: 'Stainless',  desc: 'Hairline / brushed' },
  { id: 'gold',      name: 'Stainless Gold', desc: 'Titanium gold' },
  { id: 'acp',       name: 'ACP',        desc: 'Aluminium composite, cat solid' },
  { id: 'mirror',    name: 'Mirror',     desc: 'Stainless cermin' },
];

export const SWATCHES = ['#ffffff', '#111318', '#e11d2e', '#f97316', '#facc15', '#16a34a', '#0ea5e9', '#2563eb', '#7c3aed', '#ec4899', '#c8a24a', '#9ca3af'];

export const LED_COLORS = [
  { id: 'cool',  name: 'Putih 6500K', hex: '#eef4ff' },
  { id: 'warm',  name: 'Warm 3000K',  hex: '#ffc37a' },
  { id: 'red',   name: 'Merah',  hex: '#ff2a3d' },
  { id: 'green', name: 'Hijau',  hex: '#2bff7a' },
  { id: 'blue',  name: 'Biru',   hex: '#2f7bff' },
  { id: 'pink',  name: 'Pink',   hex: '#ff3fb4' },
  { id: 'ice',   name: 'Ice Blue', hex: '#5ff3ff' },
];

export const LED_MODES = [
  { id: 'front',      name: 'Depan',        desc: 'Muka huruf menyala (front-lit)' },
  { id: 'halo',       name: 'Halo',         desc: 'Cahaya memantul di belakang (back-lit)' },
  { id: 'front_halo', name: 'Depan + Halo', desc: 'Kombinasi' },
  { id: 'side',       name: 'Samping',      desc: 'Sisi acrylic menyala' },
];

export const LED_EFFECTS = [
  { id: 'static', name: 'Statis' },
  { id: 'breath', name: 'Napas' },
  { id: 'blink',  name: 'Kedip' },
  { id: 'rgb',    name: 'RGB' },
];

export const LED_DENSITY = [
  { id: 'eco',      name: 'Ekonomis', perM2: 28 },
  { id: 'standard', name: 'Standar',  perM2: 44 },
  { id: 'high',     name: 'Terang',   perM2: 64 },
];

// ---------- Harga (estimasi kasar, Rupiah) ----------
export const PRICING = {
  // Neon box: harga dasar per m² luas muka
  boxPerM2: 1_650_000,
  boxRoundFactor: 1.18,
  boxMin: 900_000,
  // Faktor bahan (muka / sisi)
  frontFactor: { acrylic: 1.0, acp: 0.85, stainless: 1.45, gold: 1.7, mirror: 1.6 },
  sideFactor:  { acrylic: 1.1, acp: 1.0,  stainless: 1.4,  gold: 1.65, mirror: 1.55 },
  // Huruf timbul: harga per cm tinggi per huruf
  letterPerCm: { acrylic: 9_000, acp: 6_500, stainless: 11_000, gold: 13_500, mirror: 13_000 },
  letterSideAdd: { acrylic: 2_500, acp: 1_500, stainless: 3_500, gold: 4_500, mirror: 4_500 },
  letterLitPerCm: 4_500,
  letterMin: 120_000,
  // LED & kelistrikan
  ledModule: 6_500,
  powerSupplyPer100: 285_000,
  ledEffectController: 450_000,
  // Panel latar huruf (ACP) per m²
  backPanelPerM2: 850_000,
  // Konstruksi besi hollow: per m² bidang (lebar × tinggi rangka)
  constructionPerM2: 1_150_000,
  constructionBase: 750_000,
  // Struktur pendukung lokasi
  polePerM: 420_000,
  poleBase: 2_400_000,
  totemPerM: 2_350_000,
  // Biaya pemasangan per lokasi
  install: { rooftop: 4_500_000, totem: 2_000_000, cafe: 1_500_000, pole: 1_750_000, wall: 650_000 },
};

export const TIMES = [
  { id: 'day', name: 'Siang' },
  { id: 'dusk', name: 'Senja' },
  { id: 'night', name: 'Malam' },
];

export const BG_PRESETS = [
  { id: 'sky', name: 'Langit (ikut waktu)' },
  { id: 'studio', name: 'Studio abu' },
  { id: 'color', name: 'Warna solid' },
  { id: 'image', name: 'Foto upload' },
];

export function defaultState() {
  return {
    v: 1,
    placement: 'cafe',
    time: 'dusk',
    bg: { mode: 'sky', color: '#dfe4ea', image: null },
    wall: { image: null, width: 9, height: 5, color: '#d9d4cc', lockRatio: true },
    env: { floors: 4, poleHeight: 5.5, totemHeight: 6, structColor: '#2a2f37', showCity: true },
    sign: {
      type: 'letters_lit',
      text: 'DAZPRO',
      font: 'poppins',
      letterHeight: 70,   // cm (tinggi huruf kapital)
      letterDepth: 10,    // cm (tebal / return)
      spacing: 0,         // tracking, % em
      width: 300, height: 100, depth: 20, // cm (neon box)
      textColor: '#ffffff',
      textScale: 70,      // % ukuran teks pada muka neon box
      front: { mat: 'acrylic', color: '#ffffff' },
      side: { mat: 'acp', color: '#15181e' },
      backPanel: { on: false, color: '#15181e', padding: 20 },
      logo: null,
    },
    led: { on: true, color: '#eef4ff', brightness: 75, mode: 'front', effect: 'static', density: 'standard', xray: false },
    construction: { on: true, height: 60, color: '#2a2f37' },
    pos: { x: 0, y: 2.2, z: -1.2, rot: 0 },
  };
}
