// ============================================================
//  DAZPRO Signage Studio — konfigurasi katalog & harga
//  Ubah nilai di file ini untuk menyesuaikan bisnis Anda.
// ============================================================

export const BRAND = {
  name: 'DAZPRO',
  tagline: 'Signage Studio 3D',
  // Nomor WhatsApp tujuan pengajuan desain (format internasional, tanpa +)
  whatsapp: '6285231346414',
  hours: '08.00–20.00 WIB',
  area: 'Malang & seluruh Indonesia',
};

// ---------- Firebase (kunci web ini memang publik; keamanan diatur di firestore.rules) ----------
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBrwDyUw3VCqaKnS4e1K20cUnTiVPhw57o',
  authDomain: 'dazpro-signage-f573f.firebaseapp.com',
  projectId: 'dazpro-signage-f573f',
  storageBucket: 'dazpro-signage-f573f.firebasestorage.app',
  messagingSenderId: '560527354108',
  appId: '1:560527354108:web:35bbc8019b58e6f4598f79',
};

// ---------- Lokasi penempatan ----------
export const PLACEMENTS = [
  { id: 'rooftop', name: 'Atas Gedung', desc: 'Signage di atap gedung bertingkat', icon: 'building' },
  { id: 'totem',   name: 'Totem / Pylon', desc: 'Tugu berdiri di area depan', icon: 'totem' },
  { id: 'cafe',    name: 'Atas Kafe', desc: 'Di atap bangunan kafe / ruko', icon: 'cafe' },
  { id: 'pole',    name: 'Tiang Jalan', desc: 'Tiang di pinggir jalan', icon: 'pole' },
  { id: 'wall',    name: 'Tempel Dinding', desc: 'Menempel di tembok (foto custom)', icon: 'wall' },
  { id: 'mall',    name: 'Outlet Mall / Ruko', desc: 'Fasad toko indoor di mall', icon: 'mall' },
  { id: 'booth',   name: 'Booth Kontainer', desc: 'Booth kontainer outdoor', icon: 'booth' },
];

// ---------- Model signage ----------
export const SIGN_TYPES = [
  { id: 'box_rect',     name: 'Neon Box Kotak',      desc: 'Persegi panjang', group: 'box', lit: true },
  { id: 'box_square',   name: 'Neon Box Persegi',    desc: 'Sisi sama (bujur sangkar)', group: 'box', lit: true },
  { id: 'box_round',    name: 'Neon Box Bulat',      desc: 'Lingkaran', group: 'box', lit: true },
  { id: 'letters_lit',  name: 'Huruf Timbul Menyala', desc: 'Huruf 3D dengan LED', group: 'letters', lit: true },
  { id: 'letters_unlit',name: 'Huruf Timbul Non-Lampu', desc: 'Huruf 3D tanpa LED', group: 'letters', lit: false },
  { id: 'neon_flex',    name: 'Neon Flex',           desc: 'Selang LED neon di papan acrylic', group: 'neon', lit: true },
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
  // Neon flex: per meter selang + papan acrylic per m²
  neonFlexPerM: 165_000,
  neonBoardPerM2: 950_000,
  neonMin: 450_000,
  install: { rooftop: 4_500_000, totem: 2_000_000, cafe: 1_500_000, pole: 1_750_000, wall: 650_000, mall: 850_000, booth: 1_200_000 },
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

export const MAX_ITEMS = 6;

export const PORTFOLIO_CATS = ['Huruf Timbul', 'Neon Box', 'Neon Flex', 'Konstruksi', 'Lainnya'];

// ============================================================
//  RUMUS BIAYA BARU (diatur dari halaman admin → Pengaturan harga)
//  Nilai di sini hanya nilai awal. Rumus baru dipakai setelah admin
//  menyimpan pengaturan (active: true); sebelum itu memakai PRICING lama.
// ============================================================
export const INSTALL_TYPES = [
  { id: 'indoor', name: 'Indoor / di tembok' },
  { id: 'listplang', name: 'Outdoor listplang' },
  { id: 'rooftop', name: 'Outdoor atas bangunan' },
];
export const AREAS = [
  { id: 'malang', name: 'Dalam kota Malang' },
  { id: 'jatim', name: 'Luar kota, Jawa Timur' },
  { id: 'jawa', name: 'Luar Jawa Timur, area Jawa' },
  { id: 'luarjawa', name: 'Luar Jawa' },
];
// lokasi 3D → jenis pemasangan bawaan
export const INSTALL_AUTO = { wall: 'indoor', cafe: 'rooftop', rooftop: 'rooftop', totem: 'listplang', pole: 'listplang', mall: 'indoor', booth: 'rooftop' };
// lokasi yang memakai rangka besi di atas bangunan
export const ROOF_PLACEMENTS = ['rooftop', 'cafe', 'booth'];

export const PRICE_RULES_DEFAULT = {
  active: false,
  // harga dasar rumus (Rp)
  base: {
    letters_lit: 0,     // huruf timbul menyala: × tinggi huruf (cm) × jumlah huruf
    letters_unlit: 0,   // huruf timbul non-lampu: × tinggi huruf (cm) × jumlah huruf
    neon_flex: 0,       // neon flex: × tinggi huruf (cm) × jumlah huruf
    box_round: 0,       // neon box bulat: × diameter (cm) × pengali sisi
    box_rect: 0,        // neon box kotak/persegi: × sisi terpanjang (cm) × pengali sisi
  },
  mult: { letters: 1, box1: 2, box2: 3 },
  // faktor bahan muka (1 = tanpa tambahan)
  matFactor: { acrylic: 1, acp: 1, stainless: 1, gold: 1, mirror: 1 },
  install: { indoor: 750000, indoorFreeM: 2, indoorPerM: 250000, listplang: 1250000, rooftopPerFloor: 750000, cafeFloors: 1 },
  transport: { malang: 500000, jatim: 1800000, jawa: 5000000, luarjawa: 15000000 },
  taxPct: 10,
  // biaya additional (di luar signage)
  additional: {
    constructionBase: 750000, constructionPerM2: 1150000,
    poleBase: 2400000, polePerM: 420000,
    totemPerM: 2350000,
    backPanelPerM2: 850000,
    ledEffect: 450000,
  },
};

/** Satu signage dalam desain. */
export function defaultItem(id = 1) {
  return {
    id,
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
      sides: 1,          // neon box: 1 sisi / 2 sisi (depan-belakang)
      board: 'clear',    // neon flex: papan acrylic (clear/black/white/none)
      logo: null,
      faceImage: null,   // neon box: gambar desain muka custom
      faceText: false,   // tampilkan teks di atas gambar
    },
    led: { on: true, color: '#eef4ff', brightness: 75, mode: 'front', effect: 'static', density: 'standard', xray: false },
    construction: { on: true, height: 60, color: '#2a2f37' },
    pos: { x: 0, y: 2.2, z: -0.8, rot: 0 },
  };
}

export function defaultState() {
  return {
    v: 2,
    placement: 'cafe',
    time: 'dusk',
    showDims: false,
    install: 'auto',   // jenis pemasangan (rumus biaya baru)
    area: 'malang',    // area pengiriman / transport
    skipAdd: [],       // biaya additional yang tidak dipilih pelanggan ('<itemId>:<jenis>')
    bg: { mode: 'sky', color: '#dfe4ea', image: null },
    wall: { image: null, width: 9, height: 5, color: '#d9d4cc', lockRatio: true },
    env: { floors: 4, poleHeight: 5.5, totemHeight: 6, structColor: '#2a2f37', showCity: true, mallW: 6, mallFascia: '#1f2329', boothL: 6, boothW: 2.4, boothColor: '#d9481f' },
    items: [defaultItem(1)],
    active: 0,
  };
}

// ---------- teks halaman utama (bisa diubah di admin → Konten beranda) ----------
export const CONTENT_GROUPS = [
  { title: "Bagian atas (hero)", fields: [
    { key: 'heroEyebrow', label: "Beranda — label kecil di atas judul", type: 'short', def: "Konfigurator signage 3D" },
    { key: 'heroTitle', label: "Beranda — judul utama", type: 'short', def: "Lihat signage usaha Anda" },
    { key: 'heroTitleMuted', label: "Beranda — lanjutan judul (warna abu)", type: 'short', def: "sebelum dipasang." },
    { key: 'heroSub', label: "Beranda — paragraf pembuka", type: 'long', def: "Pilih lokasi, model, font, bahan, dan lampu LED. Cek tampilan siang–malam, lalu kirim desainnya untuk penawaran." },
    { key: 'ctaPrimary', label: "Tombol utama", type: 'short', def: "Mulai desain" },
    { key: 'ctaSecondary', label: "Tombol kedua", type: 'short', def: "Pakai template" },
  ] },
  { title: "Cara kerja", fields: [
    { key: 'how1Num', label: "Langkah 1 — label", type: 'short', def: "01 / DESAIN" },
    { key: 'how1Title', label: "Langkah 1 — judul", type: 'short', def: "Atur signage Anda" },
    { key: 'how1Text', label: "Langkah 1 — teks", type: 'long', def: "Pilih lokasi pemasangan, model neon box atau huruf timbul, font, ukuran, bahan muka & samping, serta warna LED." },
    { key: 'how2Num', label: "Langkah 2 — label", type: 'short', def: "02 / LIHAT" },
    { key: 'how2Title', label: "Langkah 2 — judul", type: 'short', def: "Cek dalam 3D" },
    { key: 'how2Text', label: "Langkah 2 — teks", type: 'long', def: "Pindahkan posisi, bandingkan tampilan siang, senja, dan malam, atau jalan-jalan di sekitar lokasi dengan mode Jalan 3D." },
    { key: 'how3Num', label: "Langkah 3 — label", type: 'short', def: "03 / AJUKAN" },
    { key: 'how3Title', label: "Langkah 3 — judul", type: 'short', def: "Dapatkan penawaran" },
    { key: 'how3Text', label: "Langkah 3 — teks", type: 'long', def: "Kirim desain beserta rincian ke WhatsApp kami. Tim DAZPRO akan mengonfirmasi harga final & jadwal survei." },
  ] },
  { title: "Galeri & produk", fields: [
    { key: 'galleryEyebrow', label: "Galeri — label kecil", type: 'short', def: "Portofolio" },
    { key: 'galleryTitle', label: "Galeri — judul", type: 'short', def: "Hasil pemasangan kami" },
    { key: 'productsTitle', label: "Produk — judul", type: 'short', def: "Produk yang bisa Anda rancang" },
  ] },
  { title: "Footer", fields: [
    { key: 'footerNote', label: "Footer — catatan", type: 'long', def: "Tampilan 3D bersifat ilustrasi. Ukuran mendekati skala asli; harga final dikonfirmasi setelah survei." },
  ] },
  { title: 'Kontak & layanan', fields: [
    { key: 'whatsapp', label: 'Nomor WhatsApp admin (format 62…)', type: 'short', def: '6285231346414' },
    { key: 'hours', label: 'Jam layanan', type: 'short', def: '08.00–20.00 WIB' },
    { key: 'area', label: 'Area layanan', type: 'short', def: 'Malang & seluruh Indonesia' },
  ] },
];
