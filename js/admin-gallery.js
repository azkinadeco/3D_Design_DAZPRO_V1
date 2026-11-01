// Admin → Galeri proyek
import { PORTFOLIO_CATS } from './config.js';
import { listPortfolio, addPortfolio, updatePortfolio, deletePortfolio } from './firebase.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let list = [], box, toast;

/** Kecilkan foto agar muat di dokumen Firestore (< ±700 KB). */
function compress(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      let max = 1600, q = 0.82, out = '';
      for (let i = 0; i < 6; i++) {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length < 700000) return resolve(out);
        max *= 0.82; q = Math.max(0.6, q - 0.06);
      }
      resolve(out);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibaca')); };
    im.src = url;
  });
}

const catSelect = (cur, attr) => `<select class="input" ${attr}>${PORTFOLIO_CATS.map((c) => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`;

function render() {
  box.innerHTML = `
    <div class="pr-head"><div><h2>Galeri proyek</h2><p class="muted">Foto hasil pemasangan tampil di halaman utama (bagian "Hasil pemasangan kami"). Galeri disembunyikan otomatis jika kosong.</p></div></div>
    <form class="pr-sec gal-form" id="gal-form">
      <h3>Tambah foto</h3>
      <div class="gal-form-grid">
        <label class="gal-drop"><input type="file" accept="image/*" name="file" required /><span id="gal-drop-txt">Pilih foto (JPG / PNG)</span><img id="gal-prev" hidden alt="" /></label>
        <div class="gal-fields">
          <label>Judul<input class="input" name="title" required maxlength="80" placeholder="Contoh: Huruf timbul Kopi Senja" /></label>
          <label>Kota<input class="input" name="city" maxlength="60" placeholder="Contoh: Malang" /></label>
          <label>Kategori${catSelect('Huruf Timbul', 'name="category"')}</label>
          <button class="btn btn-primary" type="submit" id="gal-add">Unggah ke galeri</button>
        </div>
      </div>
    </form>
    <div class="gal-admin-list">${list.length ? list.map((x, i) => `
      <div class="gal-row ${x.visible === false ? 'off' : ''}" data-id="${esc(x.id)}">
        <img src="${esc(x.image)}" alt="" />
        <div class="gal-row-f">
          <input class="input" data-f="title" value="${esc(x.title)}" maxlength="80" />
          <div class="gal-row-2"><input class="input" data-f="city" value="${esc(x.city)}" placeholder="Kota" maxlength="60" />${catSelect(x.category, 'data-f="category"')}</div>
        </div>
        <div class="gal-row-a">
          <label class="toggle sm"><span>Tampil</span><span class="switch"><input type="checkbox" data-f="visible" ${x.visible === false ? '' : 'checked'} /><i></i></span></label>
          <div class="gal-row-btns">
            <button class="icon-btn sm" data-act="up" title="Naikkan" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn sm" data-act="down" title="Turunkan" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="icon-btn sm" data-act="del" title="Hapus" style="color:#b91c1c">✕</button>
          </div>
        </div>
      </div>`).join('') : '<p class="muted">Belum ada foto di galeri.</p>'}</div>`;
}

async function reload() {
  try { list = await listPortfolio(); } catch (e) {
    box.innerHTML = `<p class="note">Tidak bisa memuat galeri (${esc(e.code || e.message)}). Pastikan Rules Firestore terbaru sudah di-Publish.</p>`;
    return;
  }
  render();
}

export async function mountGallery(el, toastFn) {
  box = el; toast = toastFn;
  box.innerHTML = '<p class="muted">Memuat galeri…</p>';
  await reload();

  box.addEventListener('change', async (e) => {
    if (e.target.name === 'file' && e.target.files[0]) {
      const p = box.querySelector('#gal-prev');
      p.src = URL.createObjectURL(e.target.files[0]); p.hidden = false;
      box.querySelector('#gal-drop-txt').textContent = e.target.files[0].name;
      return;
    }
    const f = e.target.dataset.f;
    const row = e.target.closest('[data-id]');
    if (!f || !row) return;
    const v = f === 'visible' ? e.target.checked : e.target.value.trim();
    try { await updatePortfolio(row.dataset.id, { [f]: v }); toast('Tersimpan'); if (f === 'visible') row.classList.toggle('off', !v); }
    catch (err) { toast('Gagal menyimpan: ' + (err.code || err.message)); }
  });

  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = box.querySelector('#gal-add');
    btn.disabled = true; btn.textContent = 'Mengunggah…';
    try {
      const image = await compress(fd.get('file'));
      const order = list.length ? Math.max(...list.map((x) => x.order || 0)) + 1 : 1;
      await addPortfolio({ title: String(fd.get('title')).trim(), city: String(fd.get('city') || '').trim(), category: fd.get('category'), image, visible: true, order });
      toast('Foto ditambahkan ke galeri');
      await reload();
    } catch (err) {
      toast(err.code === 'permission-denied' ? 'Ditolak: Rules Firestore terbaru belum di-Publish' : 'Gagal mengunggah: ' + (err.code || err.message));
      btn.disabled = false; btn.textContent = 'Unggah ke galeri';
    }
  });

  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    const i = list.findIndex((x) => x.id === id);
    try {
      if (b.dataset.act === 'del') {
        if (!confirm('Hapus foto ini dari galeri?')) return;
        await deletePortfolio(id); toast('Foto dihapus');
      } else {
        const j = b.dataset.act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        const a = list[i], c = list[j];
        const oa = a.order ?? i, oc = c.order ?? j;
        await Promise.all([updatePortfolio(a.id, { order: oc === oa ? oc + (j > i ? 1 : -1) : oc }), updatePortfolio(c.id, { order: oa })]);
      }
      await reload();
    } catch (err) { toast('Gagal: ' + (err.code || err.message)); }
  });
}
