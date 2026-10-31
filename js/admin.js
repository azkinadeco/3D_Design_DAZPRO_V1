import { onAuth, signIn, signOutAdmin, redirectResult, watchSubmissions, updateSubmission, deleteSubmission, STATUSES } from './firebase.js';
import { BRAND } from './config.js';
import { mountPriceSettings } from './admin-price.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
const stName = (id) => (STATUSES.find((s) => s.id === id) || {}).name || id;
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200); };

let rows = [], filter = 'semua', q = '', unsub = null;
let known = null; // id pengajuan yang sudah dilihat (null = belum ada data awal)

// ---------- notifikasi pengajuan baru ----------
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      const t = ac.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.start(t); o.stop(t + 0.16);
    });
  } catch (_) { /* tanpa suara */ }
}
function notifyNew(list) {
  if (!list.length) return;
  beep();
  toast(list.length > 1 ? `${list.length} pengajuan baru masuk` : `Pengajuan baru: ${list[0].name}`);
  if ('Notification' in window && Notification.permission === 'granted') {
    const r = list[0];
    const n = new Notification(list.length > 1 ? `${list.length} pengajuan baru` : `Pengajuan baru — ${r.name}`, {
      body: `${r.biz ? r.biz + ' · ' : ''}${r.placement || ''} · ${rp(r.total)}`,
      tag: 'dazpro-pengajuan',
    });
    n.onclick = () => { window.focus(); openDetail(r.id); n.close(); };
  }
}
function updateTitle() {
  const n = rows.filter((r) => r.status === 'baru').length;
  document.title = `${n ? `(${n}) ` : ''}Admin — DAZPRO Signage Studio`;
}
function notifButton() {
  const b = $('#notif');
  if (!('Notification' in window)) { b.hidden = true; return; }
  b.hidden = Notification.permission === 'granted';
  b.textContent = Notification.permission === 'denied' ? 'Notifikasi diblokir browser' : 'Aktifkan notifikasi';
  b.disabled = Notification.permission === 'denied';
}

function when(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
function waLink(phone, text = '') {
  let n = String(phone || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}
function waText(r) {
  const what = (r.items || []).map((it) => it.name).join(', ');
  return `Halo ${r.name}, kami dari ${BRAND.name}. Terima kasih sudah mengajukan desain signage${what ? ` (${what})` : ''} untuk ${r.placement}. Estimasi awal ${rp(r.total)}. Boleh kami jadwalkan survei lokasi${r.city ? ' di ' + r.city : ''}?`;
}
function exportCsv(list) {
  const head = ['Tanggal', 'Status', 'Nama', 'Usaha', 'WhatsApp', 'Kota', 'Penempatan', 'Jumlah signage', 'Signage', 'Estimasi (Rp)', 'Catatan pelanggan', 'Catatan internal'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = list.map((r) => [when(r.createdAt), stName(r.status), r.name, r.biz, r.phone, r.city, r.placement, r.count || 1, (r.items || []).map((i) => i.name).join(' / '), Math.round(r.total || 0), r.note, r.adminNote].map(cell).join(','));
  const blob = new Blob(['\ufeff' + [head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pengajuan-dazpro-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}
const visible = () => {
  const term = q.trim().toLowerCase();
  return rows.filter((r) => (filter === 'semua' || r.status === filter) && (!term || [r.name, r.biz, r.city, r.phone].join(' ').toLowerCase().includes(term)));
};

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
  const list = visible();
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
  const wa = waLink(r.phone, waText(r));
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
const HOST = location.hostname;
const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|; wv\)|TikTok/i.test(navigator.userAgent);
function explain(code, email) {
  const steps = {
    'auth/unauthorized-domain': `Domain <b>${esc(HOST)}</b> belum diizinkan. Buka Firebase → <b>Authentication</b> → tab <b>Settings</b> → <b>Authorized domains</b> → <b>Add domain</b>, isi <code>${esc(HOST)}</code>, simpan, lalu coba lagi.`,
    'auth/operation-not-allowed': 'Login Google belum diaktifkan. Buka Firebase → <b>Authentication</b> → <b>Sign-in method</b> → <b>Google</b> → geser <b>Enable</b> → <b>Save</b>.',
    'auth/configuration-not-found': 'Authentication belum disiapkan. Buka Firebase → <b>Authentication</b> → <b>Get started</b>, lalu aktifkan <b>Google</b> di tab Sign-in method.',
    'auth/popup-closed-by-user': 'Jendela login ditutup sebelum selesai. Klik tombol lagi dan pilih akun Google Anda.',
    'auth/cancelled-popup-request': 'Login dibatalkan. Klik tombol sekali saja lalu tunggu jendela Google muncul.',
    'auth/network-request-failed': 'Koneksi internet bermasalah. Periksa koneksi lalu coba lagi.',
    'auth/internal-error': 'Terjadi kesalahan di Google. Coba lagi beberapa saat, atau buka di browser Chrome/Safari.',
    'permission-denied': `Akun <b>${esc(email || '')}</b> tidak punya akses. Pastikan email ini tertulis di Firestore → <b>Rules</b> lalu klik <b>Publish</b>, atau masuk dengan akun admin yang benar.`,
    'failed-precondition': 'Database Firestore belum dibuat. Buka Firebase → <b>Firestore Database</b> → <b>Create database</b>.',
    'not-found': 'Database Firestore belum dibuat. Buka Firebase → <b>Firestore Database</b> → <b>Create database</b>.',
  };
  return steps[code] || `Gagal (${esc(code || 'tidak diketahui')}). Coba lagi atau kirim tangkapan layar ini ke developer.`;
}
function loginError(code, email) {
  const m = $('#login-msg');
  m.hidden = false;
  m.innerHTML = explain(code, email);
}
$('#btn-login').addEventListener('click', async () => {
  const btn = $('#btn-login');
  btn.disabled = true; btn.textContent = 'Membuka Google…';
  $('#login-msg').hidden = true;
  try { await signIn(); } catch (e) { loginError(e.code); }
  finally { btn.disabled = false; btn.textContent = 'Masuk dengan Google'; }
});
if (inApp) { const w = $('#inapp'); if (w) w.hidden = false; }
redirectResult().catch((e) => loginError(e.code));
$('#logout').addEventListener('click', () => signOutAdmin());
$('#notif').addEventListener('click', async () => {
  try { await Notification.requestPermission(); } catch (_) { /* abaikan */ }
  notifButton();
  if (Notification.permission === 'granted') { toast('Notifikasi aktif — biarkan halaman admin tetap terbuka'); beep(); }
});
let priceMounted = false;
$('#adm-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  document.querySelectorAll('#adm-tabs button').forEach((x) => x.classList.toggle('active', x === b));
  $('#view-subs').hidden = b.dataset.view !== 'subs';
  $('#view-price').hidden = b.dataset.view !== 'price';
  if (b.dataset.view === 'price' && !priceMounted) { priceMounted = true; mountPriceSettings($('#view-price'), toast); }
});
$('#export').addEventListener('click', () => { const l = visible(); if (!l.length) return toast('Tidak ada data untuk diekspor'); exportCsv(l); toast(`${l.length} pengajuan diekspor`); });

function show(which, msg = '') {
  $('#login').hidden = which !== 'login';
  $('#board').hidden = which !== 'board';
  $('#state-msg').hidden = !msg; $('#state-msg').textContent = msg;
}

onAuth(async (user) => {
  if (unsub) { unsub(); unsub = null; }
  $('#logout').hidden = !user;
  $('#who').textContent = user ? user.email : '';
  window.__adminEmail = user ? user.email : '';
  known = null;
  if (user) notifButton(); else $('#notif').hidden = true;
  if (!user) { show('login'); return; }
  show('board', 'Memuat pengajuan…');
  unsub = await watchSubmissions(
    (data) => {
      if (known) notifyNew(data.filter((r) => !known.has(r.id)));
      known = new Set(data.map((r) => r.id));
      rows = data; show('board'); render(); updateTitle();
    },
    (err) => { show('login'); loginError(err.code, user.email); },
  );
}).catch(() => { show('login'); const m = $('#login-msg'); m.hidden = false; m.textContent = 'Tidak bisa memuat Firebase. Periksa koneksi internet lalu muat ulang halaman.'; });
