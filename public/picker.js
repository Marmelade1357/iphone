// ============================================================================
// Geräteauswahl: Suche, nach Jahren gruppiert, Vorschaubilder, Farben
// ============================================================================
import { PHONES } from './data.js';
import { thumbFor } from './thumbs.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
let built = false, onPick = null, lastFocus = null;
const modal = $('#picker'), body = $('#pickerBody'), search = $('#pickerSearch');

function build() {
  const years = [...new Set(PHONES.map((p) => p.year))].sort((a, b) => b - a);
  body.innerHTML = years.map((y) => `
    <section data-year="${y}"><h3>${y}</h3><div class="tiles">${PHONES.filter((p) => p.year === y).map((p) => {
      const price = p.prices.find((x) => x[1] != null);
      return `<div class="tile" data-id="${p.id}" data-q="${esc((p.name + ' ' + p.year + ' ' + p.id).toLowerCase())}">
        <button class="tile-main" data-id="${p.id}"><img alt="" loading="lazy" data-thumb="${p.id}"><b>${esc(p.name)}</b>
          <small>${nf(p.foldable ? p.diagInner : p.diag, 1)}″ · ${price ? 'ab ' + nf(price[1]) + ' €' : 'nur Vertrag'}</small></button>
        <div class="dots">${p.colors.map((c, k) => `<button class="sw" data-id="${p.id}" data-k="${k}" title="${esc(c[0])}" style="background:${c[1]}"></button>`).join('')}</div>
      </div>`;
    }).join('')}</div></section>`).join('');
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const id = b.dataset.id, k = b.dataset.k != null ? +b.dataset.k : 0;
    const cb = onPick; closePicker(); cb && cb(id, k);
  });
  // Vorschaubilder erst laden, wenn sie sichtbar werden
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const img = en.target; io.unobserve(img);
    const p = PHONES.find((x) => x.id === img.dataset.thumb);
    thumbFor(p, 0).then((url) => { if (url) img.src = url; });
  }), { root: body, rootMargin: '200px' });
  body.querySelectorAll('img[data-thumb]').forEach((img) => io.observe(img));
  search.addEventListener('input', filter);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = body.querySelector('.tile:not([hidden]) .tile-main'); if (first) first.click(); }
  });
  $('#pickerClose').addEventListener('click', closePicker);
  modal.addEventListener('click', (e) => { if (e.target === modal) closePicker(); });
  built = true;
}
function filter() {
  const q = search.value.trim().toLowerCase().replace(/^iphone\s*/, '');
  const words = q.split(/\s+/).filter(Boolean);
  body.querySelectorAll('.tile').forEach((t) => { t.hidden = !words.every((w) => t.dataset.q.includes(w)); });
  body.querySelectorAll('section').forEach((s) => { s.hidden = !s.querySelector('.tile:not([hidden])'); });
}
export function openPicker({ title, selected, onPick: cb }) {
  if (!built) build();
  onPick = cb; lastFocus = document.activeElement;
  $('#pickerTitle').textContent = title || 'Gerät wählen';
  search.value = ''; filter();
  body.querySelectorAll('.tile').forEach((t) => t.classList.toggle('on', t.dataset.id === selected));
  modal.hidden = false;
  const sel = body.querySelector('.tile.on');
  if (sel) sel.scrollIntoView({ block: 'center' });
  setTimeout(() => search.focus(), 30);
}
export function closePicker() {
  modal.hidden = true; onPick = null;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
