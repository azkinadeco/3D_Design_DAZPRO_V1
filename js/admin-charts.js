// Dashboard ringkasan pengajuan (SVG ringan, satu warna, tooltip saat hover)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
const BAR = '#2f5bff';
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function columnChart(days, width = 640) {
  const W = Math.max(320, Math.round(width)), H = 210, padL = 28, padB = 24, padT = 10;
  const max = Math.max(1, ...days.map((d) => d.n));
  const step = max <= 4 ? 1 : Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  const bw = (W - padL) / days.length;
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  let grid = '';
  for (let v = 0; v <= top; v += step) grid += `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e7eb" stroke-width="1"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#64748b">${v}</text>`;
  const bars = days.map((d, i) => {
    const x = padL + i * bw + 1, w = Math.max(2, bw - 2), h = H - padB - y(d.n);
    const r = Math.min(4, w / 2, h);
    const path = d.n ? `<path d="M${x},${H - padB} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z" fill="${BAR}"/>` : '';
    const last = i === days.length - 1;
    const lbl = i % 5 === 0 || last ? `<text x="${last ? x + w : x + w / 2}" y="${H - 8}" text-anchor="${last ? 'end' : 'middle'}" font-size="11" fill="#64748b">${d.label}</text>` : '';
    return `${path}<rect x="${padL + i * bw}" y="${padT}" width="${bw}" height="${H - padT - padB}" fill="transparent" data-tip="${esc(d.full)}: ${d.n} pengajuan${d.v ? ' · ' + esc(rp(d.v)) : ''}"/>${lbl}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" role="img" aria-label="Pengajuan per hari, 30 hari terakhir">${grid}<line x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="#cbd5e1"/>${bars}</svg>`;
}
function hbars(items) {
  const max = Math.max(1, ...items.map((x) => x.n));
  return `<div class="hb">${items.map((x) => `<div class="hb-row" data-tip="${esc(x.label)}: ${x.n} pengajuan · ${esc(rp(x.v))}">
    <span class="hb-l">${esc(x.label)}</span><span class="hb-t"><i style="width:${(x.n / max) * 100}%"></i></span><span class="hb-n">${x.n}</span></div>`).join('')}</div>`;
}

export function renderCharts(box, rows, statuses) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 864e5);
    days.push({ k: dayKey(d), n: 0, v: 0, label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), full: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) });
  }
  const idx = new Map(days.map((d, i) => [d.k, i]));
  for (const r of rows) {
    const d = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : null;
    if (!d) continue;
    const i = idx.get(dayKey(d));
    if (i !== undefined) { days[i].n++; days[i].v += r.total || 0; }
  }
  const by = (key) => {
    const m = new Map();
    for (const r of rows) { const k = key(r) || '—'; const o = m.get(k) || { label: k, n: 0, v: 0 }; o.n++; o.v += r.total || 0; m.set(k, o); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  };
  const last30 = days.reduce((a, d) => a + d.n, 0);
  const open = rows.filter((r) => r.status !== 'batal' && r.status !== 'deal');
  const deal = rows.filter((r) => r.status === 'deal').length;
  const conv = rows.length ? Math.round((deal / rows.length) * 100) : 0;
  const avg = rows.length ? rows.reduce((a, r) => a + (r.total || 0), 0) / rows.length : 0;
  box.innerHTML = `
    <div class="dash-kpi">
      <div><b>${last30}</b><span>Pengajuan 30 hari</span></div>
      <div><b>${conv}%</b><span>Jadi deal</span></div>
      <div><b>${rp(avg)}</b><span>Rata-rata estimasi</span></div>
      <div><b>${rp(open.reduce((a, r) => a + (r.total || 0), 0))}</b><span>Nilai dalam proses</span></div>
    </div>
    <div class="dash-grid">
      <section class="dash-card wide"><h3>Pengajuan per hari</h3><p class="muted small">30 hari terakhir · arahkan kursor ke batang untuk detail</p>${columnChart(days, (box.clientWidth || 700) - 32)}</section>
      <section class="dash-card"><h3>Lokasi pemasangan</h3>${hbars(by((r) => r.placement).slice(0, 7))}</section>
      <section class="dash-card"><h3>Status</h3>${hbars(statuses.map((s) => ({ label: s.name, n: rows.filter((r) => r.status === s.id).length, v: rows.filter((r) => r.status === s.id).reduce((a, r) => a + (r.total || 0), 0) })))}</section>
      <section class="dash-card"><h3>Kota</h3>${hbars(by((r) => (r.city || '').trim()).slice(0, 7))}</section>
    </div>
    <div class="dash-tip" hidden></div>`;
  const tip = box.querySelector('.dash-tip');
  box.onpointermove = (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const b = box.getBoundingClientRect();
    tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 220)}px`; tip.style.top = `${e.clientY - b.top + 12}px`;
  };
  box.onpointerleave = () => { tip.hidden = true; };
}
