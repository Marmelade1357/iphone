// ============================================================================
// Telekom-Preise: Anzeige für alle, Bearbeiten nur nach Admin-Anmeldung
// (Server: api/server.js, Passwort aus ADMIN_PASSWORD auf dem Pi)
// ============================================================================
import { PHONES } from './data.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v) => (v == null ? '' : v.toLocaleString('de-DE', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }));
const parse = (s) => {
  s = String(s).trim().replace(/\s|€/g, '');
  if (!s) return null;
  s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const v = Number(s);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : NaN;
};

let data = { tariff: '', note: '', updated: null, items: {} };
let serverOk = false, adminOn = false, onChange = () => {};
const session = {
  get() { try { return sessionStorage.getItem('iphone.token') || ''; } catch { return ''; } },
  set(v) { try { v ? sessionStorage.setItem('iphone.token', v) : sessionStorage.removeItem('iphone.token'); } catch { /* egal */ } },
};

export function tkPrice(id, s) {
  const v = data.items?.[id]?.[s];
  return v && (v.once != null || v.monthly != null) ? v : null;
}
export function tkInfo() { return data; }

async function api(path, opts = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(path, { ...opts, signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally { clearTimeout(t); }
}

function count() { return Object.values(data.items || {}).reduce((a, v) => a + Object.keys(v).length, 0); }
function renderStatus() {
  const n = count();
  $('#tkStatus').textContent = !serverOk
    ? 'Server nicht erreichbar – es werden die Apple-UVP angezeigt.'
    : n ? `${n} Preis${n > 1 ? 'e' : ''} hinterlegt${data.tariff ? ' · ' + data.tariff : ''}${data.updated ? ' · Stand ' + new Date(data.updated).toLocaleDateString('de-DE') : ''}`
      : 'Noch keine Telekom-Preise hinterlegt – es werden die Apple-UVP angezeigt.';
  const logged = !!session.get();
  $('#loginForm').hidden = logged || !serverOk || !adminOn;
  $('#adminActions').hidden = !logged;
  $('#adminInfo').textContent = !serverOk ? 'Nur verfügbar, wenn die Seite über den Server (Pi / start.bat) läuft.'
    : !adminOn ? 'Auf dem Server ist noch kein Admin-Passwort eingerichtet (siehe README).'
      : logged ? 'Angemeldet – Preise können bearbeitet werden.' : 'Zum Bearbeiten der Telekom-Preise anmelden.';
}
function showErr(msg) { const e = $('#loginErr'); e.textContent = msg || ''; e.hidden = !msg; }

// ---------------------------------------------------------------- Editor
let buffer = null;
function openEditor() {
  buffer = JSON.parse(JSON.stringify(data.items || {}));
  $('#tkTariff').value = data.tariff || '';
  $('#tkNote').value = data.note || '';
  $('#edMsg').textContent = 'Leere Felder = kein Telekom-Preis (dann wird die Apple-UVP gezeigt).';
  $('#edMsg').className = 'note';
  renderEditor();
  $('#settings').hidden = true;
  $('#adminEditor').hidden = false;
}
function renderEditor() {
  const q = $('#edSearch').value.trim().toLowerCase().replace(/^iphone\s*/, '');
  const cur = $('#edCurrent').checked;
  const list = PHONES.filter((p) => (!cur || p.year >= 2024) && (!q || p.name.toLowerCase().includes(q) || String(p.year).includes(q)))
    .sort((a, b) => b.year - a.year || b.launch.localeCompare(a.launch));
  let html = '<thead><tr><th>Modell</th><th>Speicher</th><th>Apple-UVP</th><th>Einmalig (€)</th><th>Monatlich (€)</th></tr></thead><tbody>';
  for (const p of list) {
    p.prices.forEach(([label, uvp], k) => {
      const v = buffer[p.id]?.[k] || {};
      html += `<tr>${k === 0 ? `<th rowspan="${p.prices.length}">${esc(p.name)}<small>${p.year}</small></th>` : ''}<td>${esc(label)}</td><td class="dim">${uvp == null ? '–' : fmt(uvp) + ' €'}</td>
        <td><input inputmode="decimal" data-id="${p.id}" data-k="${k}" data-f="once" value="${fmt(v.once)}" placeholder="–"></td>
        <td><input inputmode="decimal" data-id="${p.id}" data-k="${k}" data-f="monthly" value="${fmt(v.monthly)}" placeholder="–"></td></tr>`;
    });
  }
  $('#edTable').innerHTML = html + '</tbody>';
}
function onEdit(e) {
  const inp = e.target.closest('input[data-id]'); if (!inp) return;
  const v = parse(inp.value);
  inp.classList.toggle('bad', Number.isNaN(v));
  if (Number.isNaN(v)) return;
  const { id, k, f } = inp.dataset;
  const row = ((buffer[id] ||= {})[k] ||= { once: null, monthly: null });
  row[f] = v;
  if (row.once == null && row.monthly == null) { delete buffer[id][k]; if (!Object.keys(buffer[id]).length) delete buffer[id]; }
}
async function save() {
  if (document.querySelector('#edTable input.bad')) { $('#edMsg').textContent = 'Bitte ungültige Eingaben (rot markiert) korrigieren.'; $('#edMsg').className = 'note err'; return; }
  const payload = { tariff: $('#tkTariff').value.trim(), note: $('#tkNote').value.trim(), items: buffer };
  $('#edSave').disabled = true;
  try {
    const r = await api('api/prices', { method: 'PUT', body: JSON.stringify(payload), headers: { Authorization: `Bearer ${session.get()}` } });
    if (r.status === 401) { session.set(''); renderStatus(); $('#edMsg').textContent = 'Sitzung abgelaufen – bitte in den Einstellungen neu anmelden.'; $('#edMsg').className = 'note err'; return; }
    if (!r.ok) { $('#edMsg').textContent = r.body.error || 'Speichern fehlgeschlagen.'; $('#edMsg').className = 'note err'; return; }
    data = r.body; renderStatus(); onChange();
    $('#adminEditor').hidden = true;
  } catch { $('#edMsg').textContent = 'Server nicht erreichbar.'; $('#edMsg').className = 'note err'; }
  finally { $('#edSave').disabled = false; }
}

// ---------------------------------------------------------------- Start
export async function initAdmin({ onChange: cb }) {
  onChange = cb || onChange;
  try {
    const [s, p] = await Promise.all([api('api/status'), api('api/prices')]);
    serverOk = s.ok && p.ok;
    adminOn = !!s.body.admin;
    if (p.ok) data = { tariff: '', note: '', items: {}, ...p.body };
  } catch { serverOk = false; }
  renderStatus();

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr('');
    const pw = $('#adminPw').value;
    if (!pw) return;
    try {
      const r = await api('api/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
      if (!r.ok) { showErr(r.body.error || 'Anmeldung fehlgeschlagen.'); return; }
      session.set(r.body.token); $('#adminPw').value = ''; renderStatus();
    } catch { showErr('Server nicht erreichbar.'); }
  });
  $('#logoutBtn').addEventListener('click', () => { session.set(''); renderStatus(); });
  $('#editPricesBtn').addEventListener('click', openEditor);
  $('#editorClose').addEventListener('click', () => { $('#adminEditor').hidden = true; });
  $('#edCancel').addEventListener('click', () => { $('#adminEditor').hidden = true; });
  $('#edSave').addEventListener('click', save);
  $('#edTable').addEventListener('input', onEdit);
  $('#edSearch').addEventListener('input', renderEditor);
  $('#edCurrent').addEventListener('change', renderEditor);
}
