// Dokumen penawaran (dicetak / disimpan sebagai PDF lewat dialog cetak browser)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function buildQuote(d) {
  const c = d.customer;
  let group = null;
  const rows = d.lines.map((l) => {
    let head = '';
    if (l.group && l.group !== group) { group = l.group; head = `<tr class="q-grp"><td colspan="2">${esc(l.group)}</td></tr>`; }
    return `${head}<tr><td>${esc(l.label)}${l.detail ? `<small>${esc(l.detail)}</small>` : ''}</td><td>${d.formatRp(l.amount)}</td></tr>`;
  }).join('');
  const items = d.items.map((it, i) => `
    <section class="q-item">
      ${it.shot ? `<img src="${it.shot}" alt="Tampak depan ${esc(it.name)}" />` : ''}
      <div>
        <h3>${d.items.length > 1 ? `${i + 1}. ` : ''}${esc(it.name)}</h3>
        <table class="q-spec">${it.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
      </div>
    </section>`).join('');
  return `
  <header class="q-head">
    <div class="q-brand">
      <span class="q-mark"><svg viewBox="0 0 32 32"><path d="M9 8h7a8 8 0 010 16H9z"/></svg></span>
      <div><b>${esc(d.brand.name)}</b><span>Signage &amp; Advertising</span></div>
    </div>
    <div class="q-meta">
      <h1>Penawaran Harga</h1>
      <table>
        <tr><th>No.</th><td>${esc(d.no)}</td></tr>
        <tr><th>Tanggal</th><td>${esc(d.date)}</td></tr>
        <tr><th>Berlaku s/d</th><td>${esc(d.until)}</td></tr>
      </table>
    </div>
  </header>

  <div class="q-to">
    <div><small>Kepada</small><b>${esc(c.name || '—')}</b>${c.biz ? `<span>${esc(c.biz)}</span>` : ''}${c.city ? `<span>${esc(c.city)}</span>` : ''}</div>
    <div><small>Lokasi pemasangan</small><b>${esc(d.placement)}</b><span>${d.items.length} signage · simulasi ${esc(d.time.toLowerCase())}</span></div>
  </div>

  <figure class="q-hero"><img src="${d.overview}" alt="Visual desain 3D" /><figcaption>Visual desain 3D (ilustrasi, ukuran mendekati skala asli)</figcaption></figure>

  <h2>Spesifikasi</h2>
  ${items}

  <h2>Rincian estimasi biaya</h2>
  <table class="q-lines">${rows}<tr class="q-total"><td>Total estimasi</td><td>${d.formatRp(d.total)}</td></tr></table>

  ${c.note ? `<h2>Catatan pelanggan</h2><p>${esc(c.note)}</p>` : ''}

  <h2>Ketentuan</h2>
  <ol class="q-terms">
    <li>Harga di atas adalah estimasi dari desain 3D. Harga final ditetapkan setelah survei lokasi dan pengecekan struktur.</li>
    <li>Warna bahan dan cahaya LED pada gambar dapat sedikit berbeda dengan hasil produksi.</li>
    <li>Jadwal produksi dan pemasangan dikonfirmasi setelah desain final disetujui.</li>
    <li>Perizinan reklame (bila diperlukan) dibahas terpisah.</li>
  </ol>

  <footer class="q-foot">${esc(d.brand.name)} · WhatsApp +${esc(d.brand.whatsapp)} · ${esc(d.brand.hours)} · ${esc(d.brand.area)}</footer>`;
}
