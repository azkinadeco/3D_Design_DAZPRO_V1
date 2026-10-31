import { onAuth, signIn, signOutAdmin, watchSubmissions, updateSubmission, deleteSubmission, STATUSES } from './firebase.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
const stName = (id) => (STATUSES.find((s) => s.id === id) || {}).name || id;
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200); };

let rows = [], filter = 'semua', q = '', unsub = null;

function when(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
function waLink(phone) {
  let n = String(phone || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return `https://wa.me/${n}`;
}

function render() {
  const cnt = (id) => rows.filter((r) => r.status === id).length;
  const deal = rows.filter((r) => r.status === 'deal').reduce((a, r) => a + (r.total || 0), 0);
  $('#stats').innerHTML = [
    `<div class="stat"><b>${rows.length}</b><span>Total pengajuan</span></div>`,
    `<div class="stat"><b>${cnt('baru')}</b><span>Baru</span></div>`,
    `<div class="stat"><b>${cnt('deal')}</b><span>Deal</span></div>`,
    `<div class="stat"><b>${rp(deal)}</b><span>Nilai deal (estimasi)</span></div>`,
  ].join('');
  $('#filters').innerHTML = [{ id: 'semua', name: 'Semua' }, ...STATUSES].map((s) => `<button class="chip ${filter === s.id ? 'active' : ''}" data-f="${s.id}">${s.name}</button>`).join('');
  const term = q.trim().toLowerCase();
  const list = rows.filter((r) => (filter === 'semua' || r.status === filter) && (!term || [r.name, r.biz, r.city, r.phone].join(' ').toLowerCase().includes(term)));
  $('#empty').hidden = list.length > 0;
  $('#list').innerHTML = list.map((r) => `
    <button class="card-sub" data-id="${esc(r.id)}">
      <img src="${esc(r.preview)}" alt="" />
      <div><div class="t">${esc(r.name)}${r.biz ? ' · ' + esc(r.biz) : ''}</div>
        <div class="m">${esc(r.placement)} · ${r.count || 1} signage${r.city ? ' · ' + esc(r.city) : ''}</div>
        <div class="m">${when(r.createdAt)}</div></div>
      <div class="r"><b>${rp(r.total)}</b><span class="badge ${esc(r.status)}">${esc(stName(r.status))}</span></div>
    </button>`).join('');
}

function openDetail(id) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  $('#d-title').textContent = `${r.name}${r.biz ? ' · ' + r.biz : ''}`;
  const wa = waLink(r.phone);
  const designUrl = r.design ? `index.html#d=${r.design}` : '';
  $('#d-body').innerHTML = `
    <div class="d-grid">
      <div><img src="${esc(r.preview)}" alt="Pratinjau desain" />
        <div class="d-box"><h4>Pelanggan</h4><dl>
          <dt>Nama</dt><dd>${esc(r.name)}</dd><dt>Usaha</dt><dd>${esc(r.biz) || '—'}</dd>
          <dt>Kota</dt><dd>${esc(r.city) || '—'}</dd><dt>WhatsApp</dt><dd>${esc(r.phone) || '—'}</dd>
          <dt>Masuk</dt><dd>${when(r.createdAt)}</dd><dt>Catatan</dt><dd>${esc(r.note) || '—'}</dd></dl></div>
        <div class="d-box"><h4>Rincian estimasi</h4><dl>
          ${(r.lines || []).map((l) => `<dt>${esc(l.group)}</dt><dd>${esc(l.label)} — ${rp(l.amount)}</dd>`).join('')}
          <dt><b>Total</b></dt><dd><b>${rp(r.total)}</b></dd></dl></div></div>
      <div>
        <div class="d-box" style="margin-top:0"><h4>Penempatan</h4>${esc(r.placement)} · tampilan ${esc(r.time)}</div>
        ${(r.items || []).map((it) => `<div class="d-box"><h4>${esc(it.name)}</h4><dl>${(it.specs || []).map((s) => `<dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd>`).join('')}</dl></div>`).join('')}
      </div>
    </div>
    <div class="d-box"><h4>Status & catatan internal</h4>
      <div class="d-actions" style="margin-top:0">
        <select id="d-status" class="input" style="max-width:200px">${STATUSES.map((s) => `<option value="${s.id}" ${s.id === r.status ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
      </div>
      <textarea id="d-note" class="input" rows="3" style="margin-top:8px;width:100%" placeholder="Catatan internal (tidak terlihat pelanggan)">${esc(r.adminNote)}</textarea>
    </div>
    <div class="d-actions">
      <button class="btn btn-primary btn-sm" id="d-save">Simpan</button>
      ${wa ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${wa}">Chat WhatsApp</a>` : ''}
      ${designUrl ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${esc(designUrl)}">Buka desain di studio</a>` : ''}
      <button class="btn btn-ghost btn-sm" id="d-del" style="margin-left:auto;color:#b91c1c">Hapus</button>
    </div>`;
  $('#d-save').onclick = async () => {
    try { await updateSubmission(id, { status: $('#d-status').value, adminNote: $('#d-note').value.slice(0, 2000) }); toast('Tersimpan'); }
    catch (e) { toast('Gagal menyimpan: ' + (e.code || e.message)); }
  };
  $('#d-del').onclick = async () => {
    if (!confirm('Hapus pengajuan ini secara permanen?')) return;
    try { await deleteSubmission(id); $('#detail').hidden = true; toast('Dihapus'); }
    catch (e) { toast('Gagal menghapus: ' + (e.code || e.message)); }
  };
  $('#detail').hidden = false;
}

$('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } });
$('#search').addEventListener('input', (e) => { q = e.target.value; render(); });
$('#list').addEventListener('click', (e) => { const c = e.target.closest('[data-id]'); if (c) openDetail(c.dataset.id); });
$('#detail').addEventListener('click', (e) => { if (e.target.id === 'detail' || e.target.closest('[data-close]')) $('#detail').hidden = true; });
$('#btn-login').addEventListener('click', async () => {
  try { await signIn(); } catch (e) { const m = $('#login-msg'); m.hidden = false; m.textContent = 'Login gagal: ' + (e.code || e.message) + (e.code === 'auth/unauthorized-domain' ? ' — tambahkan domain situs ini di Firebase → Authentication → Settings → Authorized domains.' : ''); }
});
$('#logout').addEventListener('click', () => signOutAdmin());

function show(which, msg = '') {
  $('#login').hidden = which !== 'login';
  $('#board').hidden = which !== 'board';
  $('#state-msg').hidden = !msg; $('#state-msg').textContent = msg;
}

onAuth(async (user) => {
  if (unsub) { unsub(); unsub = null; }
  $('#logout').hidden = !user;
  $('#who').textContent = user ? user.email : '';
  if (!user) { show('login'); return; }
  show('board', 'Memuat pengajuan…');
  unsub = await watchSubmissions(
    (data) => { rows = data; show('board'); render(); },
    (err) => {
      show('login');
      const m = $('#login-msg'); m.hidden = false;
      m.textContent = err.code === 'permission-denied'
        ? `Akun ${user.email} bukan admin. Tambahkan email ini di firestore.rules, atau masuk dengan akun admin.`
        : 'Gagal memuat: ' + (err.code || err.message);
    },
  );
}).catch(() => show('', 'Tidak bisa memuat Firebase. Periksa koneksi internet.'));
