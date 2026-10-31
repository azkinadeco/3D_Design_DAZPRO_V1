// Halaman admin → Pengaturan harga (rumus biaya baru)
import { PRICE_RULES_DEFAULT, MATERIALS } from './config.js';
import { getPriceRules, savePriceRules } from './firebase.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const get = (o, p) => p.split('.').reduce((a, k) => (a ? a[k] : undefined), o);
const set = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k) => (a = a[k] ??= {})); a[ks.at(-1)] = v; };
const merge = (b, o) => { const r = structuredClone(b); for (const [k, v] of Object.entries(o || {})) r[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof b[k] === 'object' ? merge(b[k], v) : v; return r; };

// [path, label, keterangan, satuan] — satuan 'rp' | 'x' | 'm' | '%' | 'lt'
const SECTIONS = [
  ['Harga dasar rumus', 'Harga dasar dikalikan ukuran sesuai rumus di bawah.', [
    ['base.letters_lit', 'Huruf timbul menyala', 'harga dasar × tinggi huruf (cm) × jumlah huruf', 'rp'],
    ['base.letters_unlit', 'Huruf timbul non-lampu', 'harga dasar × tinggi huruf (cm) × jumlah huruf', 'rp'],
    ['base.neon_flex', 'Neon flex', 'harga dasar × tinggi huruf (cm) × jumlah huruf', 'rp'],
    ['base.box_round', 'Neon box bulat', 'harga dasar × diameter (cm) × pengali sisi', 'rp'],
    ['base.box_rect', 'Neon box kotak / persegi panjang', 'harga dasar × sisi terpanjang (cm) × pengali sisi', 'rp'],
  ]],
  ['Pengali', 'Angka pengali pada rumus.', [
    ['mult.box1', 'Neon box 1 sisi', '', 'x'],
    ['mult.box2', 'Neon box 2 sisi (depan–belakang)', '', 'x'],
    ['mult.letters', 'Huruf timbul', 'biarkan 1 jika tidak dipakai', 'x'],
  ]],
  ['Biaya pemasangan reguler', 'Dihitung per signage.', [
    ['install.indoor', 'Indoor / di tembok', '', 'rp'],
    ['install.indoorFreeM', 'Batas ukuran indoor tanpa tambahan', 'sisi terpanjang signage', 'm'],
    ['install.indoorPerM', 'Tambahan indoor per meter', 'untuk tiap meter di atas batas', 'rp'],
    ['install.listplang', 'Outdoor listplang', 'juga dipakai untuk totem & tiang (bisa diganti pelanggan)', 'rp'],
    ['install.rooftopPerFloor', 'Outdoor atas bangunan, per lantai', 'atas gedung: × jumlah lantai', 'rp'],
    ['install.cafeFloors', 'Jumlah lantai bangunan kafe / ruko', 'untuk lokasi "Atas Kafe"', 'lt'],
  ]],
  ['Biaya transport', 'Dihitung sekali per pengajuan.', [
    ['transport.malang', 'Dalam kota Malang', '', 'rp'],
    ['transport.jatim', 'Luar kota, area Jawa Timur', '', 'rp'],
    ['transport.jawa', 'Luar Jawa Timur, area Jawa', '', 'rp'],
    ['transport.luarjawa', 'Area luar Jawa', '', 'rp'],
  ]],
  ['Pajak', 'Dihitung dari total signage + pemasangan + transport + additional.', [
    ['taxPct', 'Pajak', '', '%'],
  ]],
  ['Biaya additional', 'Biaya di luar signage: kerangka, tiang, totem, dll.', [
    ['additional.constructionBase', 'Kerangka konstruksi — biaya dasar', 'atas gedung / atas kafe', 'rp'],
    ['additional.constructionPerM2', 'Kerangka konstruksi — per m² bidang', '', 'rp'],
    ['additional.poleBase', 'Tiang besi & pondasi — biaya dasar', '', 'rp'],
    ['additional.polePerM', 'Tiang besi — per meter tinggi', '', 'rp'],
    ['additional.totemPerM', 'Struktur totem — per meter tinggi', '', 'rp'],
    ['additional.backPanelPerM2', 'Panel latar ACP (list plang) — per m²', 'untuk huruf timbul dengan panel latar', 'rp'],
    ['additional.ledEffect', 'Controller efek LED (napas/kedip/RGB)', '', 'rp'],
  ]],
  ['Faktor bahan muka', 'Pengali harga signage berdasarkan bahan muka (1 = sama dengan harga dasar).', MATERIALS.map((m) => [`matFactor.${m.id}`, m.name, '', 'x'])],
];
const UNIT = { rp: 'Rp', x: '×', m: 'm', '%': '%', lt: 'lantai' };

let rules = structuredClone(PRICE_RULES_DEFAULT);
let toast = () => {};

function field([path, label, hint, unit]) {
  const v = get(rules, path) ?? 0;
  return `<label class="pf"><span class="pf-l"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
    <span class="pf-in"><i>${UNIT[unit]}</i><input class="input" type="number" min="0" step="${unit === 'rp' ? 1000 : unit === 'x' ? 0.05 : 0.5}" value="${v}" data-p="${path}" data-u="${unit}" />
    ${unit === 'rp' ? `<em data-show="${path}">${rp(v)}</em>` : ''}</span></label>`;
}

function examples() {
  const r = rules;
  const tax = (x) => x * (1 + r.taxPct / 100);
  const rows = [
    ['Huruf timbul menyala, 6 huruf × 50 cm, di tembok, Malang', r.base.letters_lit * 50 * 6 * r.mult.letters + r.install.indoor + Math.max(0, Math.ceil(2.8 - r.install.indoorFreeM)) * r.install.indoorPerM + r.transport.malang],
    ['Neon box bulat 1 sisi Ø 80 cm, listplang, Malang', r.base.box_round * 80 * r.mult.box1 + r.install.listplang + r.transport.malang],
    ['Neon box kotak 2 sisi 200 × 80 cm, listplang, Jawa Timur', r.base.box_rect * 200 * r.mult.box2 + r.install.listplang + r.transport.jatim],
    ['Huruf timbul menyala 8 huruf × 100 cm, atas gedung 4 lantai + kerangka 6 m², luar Jawa Timur', r.base.letters_lit * 100 * 8 * r.mult.letters + r.install.rooftopPerFloor * 4 + r.additional.constructionBase + 6 * r.additional.constructionPerM2 + r.transport.jawa],
  ];
  return `<table class="ex">${rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${rp(tax(v))}</td></tr>`).join('')}</table>`;
}

function render(box, meta = '') {
  const missing = Object.values(rules.base).some((v) => !Number(v));
  box.innerHTML = `
    <div class="pr-head">
      <div><h2>Pengaturan harga</h2><p class="muted">Ubah angka di bawah lalu klik Simpan. Estimasi di situs langsung memakai angka terbaru.</p></div>
      <div class="pr-actions">
        <label class="toggle pr-toggle"><div><b>Pakai rumus ini di situs</b><span>${rules.active ? 'Aktif' : 'Belum aktif — situs masih memakai rumus lama'}</span></div><span class="switch"><input type="checkbox" id="pr-active" ${rules.active ? 'checked' : ''} /><i></i></span></label>
        <button class="btn btn-primary" id="pr-save">Simpan</button>
      </div>
    </div>
    ${meta ? `<p class="muted small">${meta}</p>` : ''}
    ${missing ? '<p class="note">Isi semua <b>harga dasar rumus</b> terlebih dahulu — harga dasar yang masih 0 akan membuat estimasi produk tersebut Rp0.</p>' : ''}
    <div class="pr-grid">
      <div>${SECTIONS.map(([t, d, fs]) => `<section class="pr-sec"><h3>${esc(t)}</h3><p class="muted small">${esc(d)}</p>${fs.map(field).join('')}</section>`).join('')}</div>
      <aside class="pr-side"><section class="pr-sec"><h3>Contoh hasil</h3><p class="muted small">Termasuk pemasangan, transport, dan pajak ${esc(r0(rules.taxPct))}%.</p><div id="pr-ex">${examples()}</div></section>
        <section class="pr-sec"><h3>Rumus</h3><ul class="formula">
          <li><b>Huruf timbul / neon flex</b> = dasar × tinggi huruf (cm) × jumlah huruf</li>
          <li><b>Neon box bulat</b> = dasar × diameter (cm) × ${esc(rules.mult.box1)} (1 sisi) / ${esc(rules.mult.box2)} (2 sisi)</li>
          <li><b>Neon box kotak</b> = dasar × sisi terpanjang (cm) × ${esc(rules.mult.box1)} / ${esc(rules.mult.box2)}</li>
          <li><b>Total</b> = signage + pemasangan + transport + additional + pajak ${esc(r0(rules.taxPct))}%</li></ul></section></aside>
    </div>`;
}
const r0 = (v) => Number(v).toLocaleString('id-ID');

export async function mountPriceSettings(box, toastFn) {
  toast = toastFn;
  box.innerHTML = '<p class="muted">Memuat pengaturan…</p>';
  let meta = 'Belum pernah disimpan — angka di bawah adalah nilai awal.';
  try {
    const saved = await getPriceRules();
    if (saved) {
      rules = merge(PRICE_RULES_DEFAULT, saved);
      const d = saved.updatedAt && saved.updatedAt.toDate ? saved.updatedAt.toDate() : null;
      meta = d ? `Terakhir disimpan ${d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}${saved.updatedBy ? ' oleh ' + esc(saved.updatedBy) : ''}.` : '';
    }
  } catch (e) {
    meta = `Tidak bisa membaca pengaturan (${esc(e.code || e.message)}). Pastikan Rules Firestore terbaru sudah di-Publish.`;
  }
  render(box, meta);

  box.addEventListener('change', (e) => {
    if (e.target.id !== 'pr-active') return;
    const sp = e.target.closest('.pr-toggle').querySelector('span');
    sp.textContent = e.target.checked ? 'Akan aktif setelah Simpan' : 'Situs akan memakai rumus lama setelah Simpan';
  });
  box.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-p]');
    if (!inp) return;
    const v = inp.value === '' ? 0 : Number(inp.value);
    set(rules, inp.dataset.p, v);
    const show = box.querySelector(`[data-show="${inp.dataset.p}"]`);
    if (show) show.textContent = rp(v);
    $('#pr-ex', box).innerHTML = examples();
  });
  box.addEventListener('click', async (e) => {
    if (!e.target.closest('#pr-save')) return;
    const btn = $('#pr-save', box);
    rules.active = $('#pr-active', box).checked;
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
      await savePriceRules({ ...rules, updatedBy: window.__adminEmail || '' });
      toast(rules.active ? 'Tersimpan — situs memakai rumus baru' : 'Tersimpan — rumus baru belum diaktifkan');
      render(box, `Terakhir disimpan ${new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}.`);
    } catch (err) {
      toast(err.code === 'permission-denied' ? 'Ditolak: Rules Firestore terbaru belum di-Publish' : 'Gagal menyimpan: ' + (err.code || err.message));
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  });
}
