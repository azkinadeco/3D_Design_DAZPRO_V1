// Galeri proyek di beranda (data dari Firestore 'portfolio')
import { listPortfolio } from './firebase.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let items = [], shown = [], cat = 'Semua', idx = 0;

function render() {
  shown = cat === 'Semua' ? items : items.filter((x) => x.category === cat);
  const cats = ['Semua', ...new Set(items.map((x) => x.category).filter(Boolean))];
  $('#gal-filter').innerHTML = cats.length > 2 ? cats.map((c) => `<button class="chip ${c === cat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('') : '';
  $('#gal-grid').innerHTML = shown.map((x, i) => `<button class="gal-item" data-i="${i}">
      <img src="${esc(x.image)}" alt="${esc(x.title)}" loading="lazy" />
      <span><b>${esc(x.title)}</b>${[x.category, x.city].filter(Boolean).map(esc).join(' · ')}</span></button>`).join('');
}
function open(i) {
  idx = (i + shown.length) % shown.length;
  const x = shown[idx];
  $('#lb-img').src = x.image; $('#lb-img').alt = x.title;
  $('#lb-cap').innerHTML = `<b>${esc(x.title)}</b> ${[x.category, x.city].filter(Boolean).map(esc).join(' · ')}`;
  $('#lightbox').hidden = false;
}

export async function initGallery() {
  try {
    items = (await listPortfolio()).filter((x) => x.visible !== false && x.image);
  } catch (_) { return; }
  if (!items.length) return;
  $('#galeri').hidden = false;
  $('#nav-galeri').hidden = false;
  render();
  $('#gal-filter').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; render(); } });
  $('#gal-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) open(+b.dataset.i); });
  $('#lightbox').addEventListener('click', (e) => {
    const a = e.target.closest('[data-lb]')?.dataset.lb;
    if (a === 'prev') open(idx - 1);
    else if (a === 'next') open(idx + 1);
    else if (a === 'close' || e.target.id === 'lightbox') $('#lightbox').hidden = true;
  });
  window.addEventListener('keydown', (e) => {
    if ($('#lightbox').hidden) return;
    if (e.key === 'ArrowLeft') open(idx - 1);
    if (e.key === 'ArrowRight') open(idx + 1);
    if (e.key === 'Escape') $('#lightbox').hidden = true;
  });
}
