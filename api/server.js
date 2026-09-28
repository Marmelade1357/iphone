// ============================================================================
// iPhone-Vergleich – kleine API für die Telekom-Preise (ohne Abhängigkeiten)
//
//   GET  /api/prices   → gespeicherte Telekom-Preise (für alle sichtbar)
//   GET  /api/status   → { admin: true|false }  (ist ein Admin-Passwort gesetzt?)
//   POST /api/login    → { password }  →  { token }   (gültig 12 h)
//   PUT  /api/prices   → Preise speichern (nur mit gültigem Token)
//
// Das Admin-Passwort kommt aus der Umgebungsvariablen ADMIN_PASSWORD
// (auf dem Pi in der Datei .env neben docker-compose.yml, nicht im Git).
// Gespeichert wird in DATA_DIR/prices.json (Docker-Volume ./data).
// Für lokale Tests kann STATIC_DIR gesetzt werden – dann liefert der Server
// zusätzlich die Webseite aus.
// ============================================================================
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const FILE = path.join(DATA_DIR, 'prices.json');
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = crypto.randomBytes(32);          // Tokens gelten bis zum Neustart
const TOKEN_TTL = 12 * 3600 * 1000;
const STATIC_DIR = process.env.STATIC_DIR || '';

const EMPTY = { tariff: '', note: '', updated: null, items: {} };

// ---------------------------------------------------------------- Hilfen
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();
function checkPassword(pw) {
  if (!PASSWORD || typeof pw !== 'string') return false;
  return crypto.timingSafeEqual(sha(pw), sha(PASSWORD));
}
function makeToken() {
  const exp = Date.now() + TOKEN_TTL;
  const sig = crypto.createHmac('sha256', SECRET).update(String(exp)).digest('base64url');
  return `${exp}.${sig}`;
}
function validToken(req) {
  const m = /^Bearer (\d+)\.([\w-]+)$/.exec(req.headers.authorization || '');
  if (!m || +m[1] < Date.now()) return false;
  const want = crypto.createHmac('sha256', SECRET).update(m[1]).digest();
  const got = Buffer.from(m[2], 'base64url');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Fehlversuche begrenzen (je IP und insgesamt)
const fails = new Map(); let globalFails = [];
const WINDOW = 10 * 60 * 1000;
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function blocked(ip) {
  const now = Date.now();
  globalFails = globalFails.filter((t) => now - t < WINDOW);
  const list = (fails.get(ip) || []).filter((t) => now - t < WINDOW);
  fails.set(ip, list);
  return list.length >= 8 || globalFails.length >= 40;
}
function noteFail(ip) { const now = Date.now(); fails.get(ip)?.push(now); globalFails.push(now); }

function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------- Daten
async function load() {
  try { return { ...EMPTY, ...JSON.parse(await fs.readFile(FILE, 'utf8')) }; } catch { return { ...EMPTY }; }
}
const num = (v) => (v === null || v === '' || v === undefined ? null
  : (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 20000 ? Math.round(v * 100) / 100 : undefined));
function sanitize(input) {
  if (!input || typeof input !== 'object') throw new Error('Ungültige Daten');
  const out = { tariff: String(input.tariff || '').slice(0, 60), note: String(input.note || '').slice(0, 300), updated: new Date().toISOString(), items: {} };
  const items = input.items && typeof input.items === 'object' ? input.items : {};
  for (const [id, vars] of Object.entries(items)) {
    if (!/^[a-z0-9]{1,20}$/.test(id) || !vars || typeof vars !== 'object') continue;
    for (const [k, v] of Object.entries(vars)) {
      if (!/^\d$/.test(k) || !v || typeof v !== 'object') continue;
      const once = num(v.once), monthly = num(v.monthly);
      if (once === undefined || monthly === undefined) throw new Error(`Ungültiger Preis bei ${id}`);
      if (once === null && monthly === null) continue;
      (out.items[id] ||= {})[k] = { once, monthly };
    }
  }
  return out;
}
async function save(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 1));
  await fs.rename(tmp, FILE);
}

// ---------------------------------------------------------------- Statische Dateien (nur lokal)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
async function serveStatic(req, res) {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(STATIC_DIR, u.endsWith('/') ? u + 'index.html' : u));
  if (!file.startsWith(path.resolve(STATIC_DIR))) return send(res, 403, { error: 'forbidden' });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': (MIME[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { send(res, 404, { error: 'not found' }); }
}

// ---------------------------------------------------------------- Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = url.pathname.replace(/^.*\/api\//, '/api/');
  try {
    if (route === '/api/status' && req.method === 'GET') return send(res, 200, { admin: !!PASSWORD });
    if (route === '/api/prices' && req.method === 'GET') return send(res, 200, await load());
    if (route === '/api/login' && req.method === 'POST') {
      const ip = clientIp(req);
      if (!PASSWORD) return send(res, 503, { error: 'Auf dem Server ist kein Admin-Passwort eingerichtet.' });
      if (blocked(ip)) return send(res, 429, { error: 'Zu viele Fehlversuche – bitte in 10 Minuten erneut versuchen.' });
      const body = await readBody(req, 4096);
      if (!checkPassword(body.password)) { noteFail(ip); await new Promise((r) => setTimeout(r, 600)); return send(res, 401, { error: 'Passwort falsch.' }); }
      return send(res, 200, { token: makeToken(), ttl: TOKEN_TTL });
    }
    if (route === '/api/prices' && req.method === 'PUT') {
      if (!validToken(req)) return send(res, 401, { error: 'Nicht angemeldet oder Sitzung abgelaufen.' });
      const data = sanitize(await readBody(req));
      await save(data);
      return send(res, 200, data);
    }
    if (route.startsWith('/api/')) return send(res, 404, { error: 'Unbekannte Anfrage' });
    if (STATIC_DIR) return serveStatic(req, res);
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: e.message || 'Fehler' });
  }
});
server.listen(PORT, () => console.log(`iPhone-Vergleich API auf Port ${PORT}${PASSWORD ? '' : ' (kein ADMIN_PASSWORD gesetzt – Admin deaktiviert)'}`));
