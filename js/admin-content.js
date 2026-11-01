// Admin → Konten beranda (teks halaman utama & kontak)
import { CONTENT_GROUPS } from './config.js';
import { getSetting, saveSetting } from './firebase.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function mountContent(box, toast) {
  box.innerHTML = '<p class="muted">Memuat konten…</p>';
  let saved = {};
  let note = '';
  try { saved = (await getSetting('content')) || {}; } catch (e) { note = `Tidak bisa membaca konten (${esc(e.code || e.message)}). Pastikan Rules Firestore sudah di-Publish.`; }
  const val = (f) => (typeof saved[f.key] === 'string' && saved[f.key].trim() ? saved[f.key] : f.def);
  box.innerHTML = `
    <div class="pr-head"><div><h2>Konten beranda</h2><p class="muted">Ubah tulisan di halaman utama, lalu klik Simpan. Kosongkan kolom untuk kembali ke teks bawaan.</p></div>
      <div class="pr-actions"><a class="btn btn-ghost" href="index.html" target="_blank" rel="noopener">Lihat beranda</a><button class="btn btn-primary" id="ct-save">Simpan</button></div></div>
    ${note ? `<p class="note">${note}</p>` : ''}
    <form id="ct-form">${CONTENT_GROUPS.map((g) => `<section class="pr-sec"><h3>${esc(g.title)}</h3>
      ${g.fields.map((f) => `<label class="ct-f"><span>${esc(f.label)}</span>${f.type === 'long'
        ? `<textarea class="input" rows="3" name="${f.key}" placeholder="${esc(f.def)}">${esc(val(f))}</textarea>`
        : `<input class="input" name="${f.key}" value="${esc(val(f))}" placeholder="${esc(f.def)}" />`}</label>`).join('')}</section>`).join('')}</form>`;
  box.querySelector('#ct-save').addEventListener('click', async () => {
    const btn = box.querySelector('#ct-save');
    const fd = new FormData(box.querySelector('#ct-form'));
    const data = {};
    for (const g of CONTENT_GROUPS) for (const f of g.fields) {
      const v = String(fd.get(f.key) || '').trim();
      if (v && v !== f.def) data[f.key] = v.slice(0, 600);
    }
    if (data.whatsapp && !/^\d{8,15}$/.test(data.whatsapp.replace(/^0/, '62'))) { toast('Nomor WhatsApp tidak valid — contoh: 6285231346414'); return; }
    if (data.whatsapp) data.whatsapp = data.whatsapp.replace(/^0/, '62');
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try { await saveSetting('content', data); toast('Konten beranda tersimpan'); }
    catch (err) { toast(err.code === 'permission-denied' ? 'Ditolak: Rules Firestore belum di-Publish' : 'Gagal menyimpan: ' + (err.code || err.message)); }
    btn.disabled = false; btn.textContent = 'Simpan';
  });
}
