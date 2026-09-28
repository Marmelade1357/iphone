// ============================================================================
// Bildschirminhalt als 2D-Canvas – im Stil der iOS-Generation, mit der das
// jeweilige Gerät auf den Markt kam (iOS 1 … iOS 27).
//   skeuo  : iOS 1–6   (glänzende Icons, schwarze Leisten, "Entsperren"-Schieber)
//   flat   : iOS 7–10  (flache Icons, dünne Schrift, Punkte-Empfangsanzeige)
//   modern : iOS 11–15 (Face ID, schwebendes Dock, Widgets ab iOS 14)
//   bold   : iOS 16–18 (kräftige Sperrbildschirm-Uhr, Widgets, Suchen-Taste)
//   glass  : iOS 26+   (Liquid Glass)
// Icons sind neutrale Piktogramme, keine Nachbildungen der Apple-App-Symbole.
// ============================================================================
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WDS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MO = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const FONT = '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif';
const FONT_R = '"SF Pro Rounded", -apple-system, "SF Pro Display", "Segoe UI", Roboto, Arial, sans-serif';

// ------------------------------------------------------------------ iOS-Version
const MONTHS = { jan: 1, feb: 2, mär: 3, mar: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12 };
export function iosVersion(p) {
  const m = MONTHS[(p.launch || '').slice(0, 3).toLowerCase()] || 9;
  let v = m >= 6 ? p.year - 2006 : p.year - 2007;
  if (v < 1) v = 1;
  if (v >= 19) v += 7;                   // 2025: Sprung von iOS 18 auf iOS 26
  return v;
}
export function eraOf(p) {
  const v = iosVersion(p);
  return v <= 6 ? 'skeuo' : v <= 10 ? 'flat' : v <= 15 ? 'modern' : v <= 18 ? 'bold' : 'glass';
}
// logische Bildschirmbreite in Punkt (für realistische Größenverhältnisse)
function pointsWide(p, kind) {
  if (kind === 'duoOuter') return 360;
  const w = p.res ? p.res[0] : 390;
  if (w === 1080) return 414;            // Plus-Modelle (heruntergerechnet)
  return w / (p.ppi > 400 ? 3 : p.ppi >= 300 ? 2 : 1);
}

// ------------------------------------------------------------------ Hilfen
function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }
function hueOf(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx === 0 ? 0 : d / mx };
}
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// iOS-typische "Squircle"-Form (kontinuierliche Rundung)
function squircle(ctx, x, y, s, k = 0.225) {
  const r = s * k * 1.25, c = r * 0.45;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + s - r, y);
  ctx.bezierCurveTo(x + s - c, y, x + s, y + c, x + s, y + r); ctx.lineTo(x + s, y + s - r);
  ctx.bezierCurveTo(x + s, y + s - c, x + s - c, y + s, x + s - r, y + s); ctx.lineTo(x + r, y + s);
  ctx.bezierCurveTo(x + c, y + s, x, y + s - c, x, y + s - r); ctx.lineTo(x, y + r);
  ctx.bezierCurveTo(x, y + c, x + c, y, x + r, y); ctx.closePath();
}
function nowParts() {
  const d = new Date();
  return {
    h: d.getHours(), m: d.getMinutes(),
    time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`,
    date: `${WD[d.getDay()]}, ${d.getDate()}. ${MO[d.getMonth()]}`,
    dateShort: `${WDS[d.getDay()]}. ${d.getDate()}. ${MO[d.getMonth()]}`,
    day: d.getDate(), wd: WD[d.getDay()],
  };
}
function text(ctx, t, x, y, font, color, align = 'center', base = 'alphabetic') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(t, x, y);
}

// ------------------------------------------------------------------ Hintergrundbilder
function wallpaper(ctx, W, H, color, era, home = false) {
  let { h, s } = hueOf(color[1]);
  if (s < 0.18) h = 222;
  if (era === 'skeuo') {
    if (home && (color._v || 0) <= 3) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }   // iOS 1–3: schwarzer Home-Bildschirm
    // Wassertropfen auf blauem Grund (typisch iOS 4–6) bzw. Erdkugel-Stimmung
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b2a4f'); g.addColorStop(0.5, '#1d5d8f'); g.addColorStop(1, '#07182c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * H, r = (2 + rnd() * 16) * (W / 320);
      const rg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(0.6, 'rgba(160,210,255,.18)'); rg.addColorStop(1, 'rgba(0,20,40,.35)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  const base = ctx.createLinearGradient(0, 0, W * 0.4, H);
  const blob = (x, y, r, c) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  };
  if (era === 'flat') {
    // weich verlaufende Pastellfarben (iOS 7)
    base.addColorStop(0, hsl((h + 20) % 360, 75, 68)); base.addColorStop(0.5, hsl((h + 330) % 360, 60, 55)); base.addColorStop(1, hsl((h + 250) % 360, 55, 38));
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    blob(W * 0.2, H * 0.25, W * 0.9, hsl((h + 40) % 360, 95, 75, 0.55));
    blob(W * 0.9, H * 0.8, W * 1.0, hsl((h + 200) % 360, 70, 55, 0.5));
    return;
  }
  base.addColorStop(0, hsl(h, 70, era === 'glass' ? 58 : 50)); base.addColorStop(0.55, hsl((h + 35) % 360, 60, 30)); base.addColorStop(1, hsl((h + 60) % 360, 55, 12));
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  blob(W * 0.85, H * 0.18, Math.max(W, H) * 0.5, hsl((h + 330) % 360, 90, 65, 0.55));
  blob(W * 0.1, H * 0.75, Math.max(W, H) * 0.55, hsl((h + 80) % 360, 80, 50, 0.45));
  if (era === 'bold' || era === 'glass') {
    // große geschwungene Farbbänder
    ctx.save(); ctx.globalAlpha = era === 'glass' ? 0.5 : 0.35;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = hsl((h + k * 40) % 360, 85, 60 - k * 8);
      ctx.beginPath(); ctx.moveTo(0, H * (0.45 + k * 0.12));
      ctx.bezierCurveTo(W * 0.3, H * (0.3 + k * 0.1), W * 0.7, H * (0.75 + k * 0.05), W, H * (0.5 + k * 0.12));
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ Piktogramme
function glyph(ctx, name, cx, cy, s, fg) {
  ctx.save();
  ctx.fillStyle = fg; ctx.strokeStyle = fg; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const u = s / 100;               // Glyph-Raster 100 × 100 um den Mittelpunkt
  const P = (x, y) => [cx + (x - 50) * u, cy + (y - 50) * u];
  const circle = (x, y, r, fill = true) => { ctx.beginPath(); ctx.arc(...P(x, y), r * u, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); };
  const line = (pts, w) => { ctx.lineWidth = w * u; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(...P(x, y)) : ctx.moveTo(...P(x, y)))); ctx.stroke(); };
  const box = (x, y, w, h, r, fill = true) => { rr(ctx, ...P(x, y), w * u, h * u, r * u); fill ? ctx.fill() : ctx.stroke(); };
  switch (name) {
    case 'phone': { // Hörer
      ctx.translate(cx, cy); ctx.rotate(-0.7); ctx.translate(-cx, -cy);
      ctx.lineWidth = 13 * u; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(...P(50, 76), 34 * u, Math.PI * 1.16, Math.PI * 1.84); ctx.stroke();
      [1.16, 1.84].forEach((a) => {
        const [ex, ey] = P(50 + Math.cos(Math.PI * a) * 34, 76 + Math.sin(Math.PI * a) * 34);
        ctx.save(); ctx.translate(ex, ey + 5 * u); ctx.rotate(a < 1.5 ? 0.35 : -0.35);
        rr(ctx, -10 * u, -8 * u, 20 * u, 22 * u, 7 * u); ctx.fill(); ctx.restore();
      });
      break;
    }
    case 'message': {
      ctx.beginPath(); ctx.ellipse(...P(50, 46), 34 * u, 27 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(...P(28, 62)); ctx.quadraticCurveTo(...P(26, 76), ...P(16, 80)); ctx.quadraticCurveTo(...P(34, 80), ...P(42, 70)); ctx.fill(); break;
    }
    case 'sms': glyph(ctx, 'message', cx, cy, s, fg); ctx.fillStyle = '#2d9a37'; ctx.font = `700 ${18 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SMS', ...P(50, 47)); break;
    case 'mail': ctx.lineWidth = 6 * u; box(18, 28, 64, 44, 6, false); line([[20, 32], [50, 54], [80, 32]], 6); break;
    case 'globe': ctx.lineWidth = 5 * u; circle(50, 50, 32, false);
      ctx.beginPath(); ctx.ellipse(...P(50, 50), 14 * u, 32 * u, 0, 0, Math.PI * 2); ctx.stroke();
      line([[18, 50], [82, 50]], 5); line([[24, 34], [76, 34]], 4); line([[24, 66], [76, 66]], 4); break;
    case 'music': box(34, 24, 8, 44, 3); box(66, 18, 8, 44, 3); line([[38, 26], [70, 20]], 9); circle(30, 70, 11); circle(62, 64, 11); break;
    case 'camera': box(16, 32, 68, 46, 10); box(36, 24, 28, 12, 4); ctx.fillStyle = 'rgba(0,0,0,.55)'; circle(50, 55, 15); ctx.fillStyle = fg; circle(50, 55, 9); break;
    case 'photos': {
      ctx.lineWidth = 5 * u; box(16, 22, 68, 56, 8, false);
      ctx.beginPath(); ctx.moveTo(...P(20, 74)); ctx.lineTo(...P(42, 46)); ctx.lineTo(...P(56, 62)); ctx.lineTo(...P(64, 54)); ctx.lineTo(...P(80, 74)); ctx.closePath(); ctx.fill();
      circle(66, 36, 7); break;
    }
    case 'calendar': {
      const { day, wd } = nowParts();
      ctx.fillStyle = '#e8352b'; ctx.font = `600 ${15 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(wd, ...P(50, 24));
      ctx.fillStyle = '#1c1c1e'; ctx.font = `300 ${50 * u}px ${FONT}`; ctx.fillText(String(day), ...P(50, 62)); break;
    }
    case 'clock': {
      ctx.fillStyle = '#fff'; circle(50, 50, 36); ctx.strokeStyle = '#111';
      const { h, m } = nowParts();
      const hand = (a, len, w) => { ctx.lineWidth = w * u; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * len * u, cy - Math.cos(a) * len * u); ctx.stroke(); };
      hand(((h % 12) + m / 60) / 12 * Math.PI * 2, 18, 5); hand(m / 60 * Math.PI * 2, 27, 4);
      ctx.strokeStyle = '#ff9500'; hand(0.8, 30, 2); break;
    }
    case 'maps': {
      ctx.fillStyle = 'rgba(255,255,255,.55)'; line([[10, 70], [90, 30]], 10); ctx.strokeStyle = '#ffd24a'; line([[30, 10], [60, 90]], 8);
      ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(...P(56, 40), 13 * u, Math.PI, 0); ctx.lineTo(...P(56, 70)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; circle(56, 40, 5); break;
    }
    case 'weather': {
      ctx.fillStyle = '#ffd60a'; circle(38, 38, 16);
      ctx.fillStyle = '#fff'; circle(46, 64, 14); circle(62, 56, 18); circle(76, 66, 12); box(34, 62, 50, 16, 8); break;
    }
    case 'notes': ctx.fillStyle = '#ffd60a'; box(14, 14, 72, 20, 0); ctx.strokeStyle = '#c9c9ce'; [46, 60, 74].forEach((y) => line([[20, y], [80, y]], 3)); break;
    case 'settings': {
      ctx.fillStyle = fg;
      for (let k = 0; k < 12; k++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * Math.PI / 6); rr(ctx, -5 * u, -36 * u, 10 * u, 14 * u, 2 * u); ctx.fill(); ctx.restore(); }
      circle(50, 50, 26); ctx.fillStyle = 'rgba(0,0,0,.45)'; circle(50, 50, 16); ctx.fillStyle = fg; circle(50, 50, 8); break;
    }
    case 'calc': {
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j]) => { ctx.fillStyle = i + j === 2 ? '#ff9f0a' : 'rgba(255,255,255,.28)'; box(20 + i * 32, 20 + j * 32, 28, 28, 8); });
      ctx.fillStyle = '#fff'; ctx.font = `600 ${22 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', ...P(34, 35)); ctx.fillText('−', ...P(66, 35)); ctx.fillText('×', ...P(34, 67)); ctx.fillText('=', ...P(66, 67)); break;
    }
    case 'book': ctx.beginPath(); ctx.moveTo(...P(50, 30)); ctx.quadraticCurveTo(...P(32, 20), ...P(16, 26)); ctx.lineTo(...P(16, 74)); ctx.quadraticCurveTo(...P(32, 68), ...P(50, 78));
      ctx.quadraticCurveTo(...P(68, 68), ...P(84, 74)); ctx.lineTo(...P(84, 26)); ctx.quadraticCurveTo(...P(68, 20), ...P(50, 30)); ctx.fill(); break;
    case 'heart': ctx.beginPath(); ctx.moveTo(...P(50, 78)); ctx.bezierCurveTo(...P(10, 52), ...P(20, 18), ...P(50, 36)); ctx.bezierCurveTo(...P(80, 18), ...P(90, 52), ...P(50, 78)); ctx.fill(); break;
    case 'wallet': ['#34c759', '#ffcc00', '#ff9500', '#ff3b30'].forEach((c, k) => { ctx.fillStyle = c; box(16, 22 + k * 9, 68, 24, 6); });
      ctx.fillStyle = '#2c2c2e'; box(14, 52, 72, 30, 6); break;
    case 'folder': box(14, 30, 72, 48, 8); box(14, 24, 30, 14, 5); ctx.fillStyle = 'rgba(255,255,255,.35)'; box(14, 40, 72, 4, 0); break;
    case 'play': ctx.beginPath(); ctx.moveTo(...P(38, 28)); ctx.lineTo(...P(72, 50)); ctx.lineTo(...P(38, 72)); ctx.closePath(); ctx.fill(); break;
    case 'mic': box(40, 18, 20, 38, 10); ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(...P(50, 44), 20 * u, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); line([[50, 64], [50, 80]], 5); break;
    case 'check': [34, 52, 70].forEach((y, k) => { ctx.fillStyle = ['#ff3b30', '#ff9500', '#0a84ff'][k]; circle(24, y, 6); ctx.strokeStyle = '#c7c7cc'; line([[36, y], [80, y]], 3); }); break;
    case 'stocks': ctx.strokeStyle = '#34c759'; line([[16, 70], [34, 52], [48, 60], [64, 34], [84, 40]], 6); break;
    case 'bag': ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(...P(50, 34), 12 * u, Math.PI, 0); ctx.stroke(); box(22, 34, 56, 44, 8); break;
    case 'radar': ctx.lineWidth = 5 * u; circle(50, 50, 30, false); circle(50, 50, 18, false); circle(50, 50, 7); break;
    case 'house': ctx.beginPath(); ctx.moveTo(...P(50, 18)); ctx.lineTo(...P(84, 48)); ctx.lineTo(...P(74, 48)); ctx.lineTo(...P(74, 80)); ctx.lineTo(...P(26, 80)); ctx.lineTo(...P(26, 48)); ctx.lineTo(...P(16, 48)); ctx.closePath(); ctx.fill(); break;
    case 'bulb': circle(50, 42, 22); box(40, 60, 20, 16, 4); break;
    case 'translate': box(14, 22, 44, 36, 8); ctx.fillStyle = 'rgba(255,255,255,.7)'; box(42, 42, 44, 36, 8);
      ctx.fillStyle = '#0a84ff'; ctx.font = `700 ${22 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('A', ...P(36, 40)); ctx.fillText('文', ...P(64, 61)); break;
    case 'video': box(14, 32, 50, 36, 8); ctx.beginPath(); ctx.moveTo(...P(66, 50)); ctx.lineTo(...P(86, 34)); ctx.lineTo(...P(86, 66)); ctx.closePath(); ctx.fill(); break;
    case 'person': circle(50, 36, 14); ctx.beginPath(); ctx.ellipse(...P(50, 76), 26 * u, 16 * u, 0, Math.PI, 0); ctx.fill(); break;
    case 'compass': ctx.lineWidth = 4 * u; circle(50, 50, 32, false); ctx.fillStyle = '#ff3b30';
      ctx.beginPath(); ctx.moveTo(...P(50, 22)); ctx.lineTo(...P(57, 50)); ctx.lineTo(...P(43, 50)); ctx.fill(); ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(...P(50, 78)); ctx.lineTo(...P(57, 50)); ctx.lineTo(...P(43, 50)); ctx.fill(); break;
    case 'speaker': ctx.beginPath(); ctx.moveTo(...P(18, 40)); ctx.lineTo(...P(34, 40)); ctx.lineTo(...P(54, 22)); ctx.lineTo(...P(54, 78)); ctx.lineTo(...P(34, 60)); ctx.lineTo(...P(18, 60)); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.arc(...P(54, 50), 16 * u, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(...P(54, 50), 30 * u, -0.9, 0.9); ctx.stroke(); break;
    case 'bell': ctx.beginPath(); ctx.moveTo(...P(26, 68)); ctx.quadraticCurveTo(...P(30, 60), ...P(30, 46)); ctx.quadraticCurveTo(...P(30, 22), ...P(50, 22)); ctx.quadraticCurveTo(...P(70, 22), ...P(70, 46));
      ctx.quadraticCurveTo(...P(70, 60), ...P(74, 68)); ctx.closePath(); ctx.fill(); circle(50, 76, 7); break;
    case 'belloff': glyph(ctx, 'bell', cx, cy, s, fg); ctx.strokeStyle = fg; ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.moveTo(...P(18, 18)); ctx.lineTo(...P(82, 82)); ctx.stroke(); break;
    case 'torch': box(38, 40, 24, 44, 5); ctx.beginPath(); ctx.moveTo(...P(30, 18)); ctx.lineTo(...P(70, 18)); ctx.lineTo(...P(62, 40)); ctx.lineTo(...P(38, 40)); ctx.closePath(); ctx.fill(); break;
    case 'finger': ctx.lineWidth = 4 * u; for (let r = 8; r <= 32; r += 8) { ctx.beginPath(); ctx.arc(...P(50, 56), r * u, Math.PI * 1.05, Math.PI * 1.95 + (r > 16 ? 0.4 : 0)); ctx.stroke(); } break;
    case 'face': ctx.lineWidth = 5 * u;
      [[20, 20], [80, 20], [20, 80], [80, 80]].forEach(([x, y]) => { const dx = x < 50 ? 1 : -1, dy = y < 50 ? 1 : -1; line([[x, y + dy * 14], [x, y], [x + dx * 14, y]], 5); });
      circle(38, 42, 3.5); circle(62, 42, 3.5); line([[50, 42], [50, 56], [46, 56]], 4); ctx.beginPath(); ctx.arc(...P(50, 58), 12 * u, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); break;
    case 'lock': ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.arc(...P(50, 44), 14 * u, Math.PI, 0); ctx.lineTo(...P(64, 50)); ctx.moveTo(...P(36, 50)); ctx.lineTo(...P(36, 44)); ctx.stroke(); box(28, 48, 44, 34, 7); break;
    case 'search': ctx.lineWidth = 8 * u; circle(44, 44, 20, false); line([[59, 59], [78, 78]], 9); break;
    default: circle(50, 50, 24);
  }
  ctx.restore();
}

// App-Definitionen: [Name, Glyph, Hintergrund oben, unten, Glyph-Farbe]
const A = {
  phone: ['Telefon', 'phone', '#65e272', '#20b83a', '#fff'], msg: ['Nachrichten', 'message', '#65e272', '#20b83a', '#fff'],
  sms: ['SMS', 'sms', '#8ee07f', '#2d9a37', '#fff'], mail: ['Mail', 'mail', '#55b6ff', '#1a73e8', '#fff'],
  safari: ['Safari', 'globe', '#5ac8ff', '#0a6fe0', '#fff'], music: ['Musik', 'music', '#ff6179', '#f0233b', '#fff'],
  ipod: ['iPod', 'music', '#ffb44a', '#ef6b0f', '#fff'], cam: ['Kamera', 'camera', '#c7c7cc', '#6e6e73', '#1c1c1e'],
  photos: ['Fotos', 'photos', '#ffffff', '#f2f2f2', '#ff9f0a'], cal: ['Kalender', 'calendar', '#ffffff', '#f2f2f2', '#000'],
  clock: ['Uhr', 'clock', '#2c2c2e', '#000000', '#fff'], maps: ['Karten', 'maps', '#9be07a', '#4cb050', '#fff'],
  weather: ['Wetter', 'weather', '#5cb8ff', '#1f6fe0', '#fff'], notes: ['Notizen', 'notes', '#ffffff', '#f4f4f4', '#000'],
  settings: ['Einstellungen', 'settings', '#b8b8bd', '#76767b', '#e5e5ea'], calc: ['Rechner', 'calc', '#3a3a3c', '#111', '#fff'],
  books: ['Bücher', 'book', '#ffb340', '#ff7a00', '#fff'], health: ['Health', 'heart', '#ffffff', '#f4f4f4', '#ff2d55'],
  wallet: ['Wallet', 'wallet', '#1c1c1e', '#000', '#fff'], files: ['Dateien', 'folder', '#ffffff', '#f4f4f4', '#1a8cff'],
  tv: ['TV', 'play', '#2c2c2e', '#000', '#fff'], videos: ['Videos', 'play', '#48484a', '#1c1c1e', '#fff'],
  pod: ['Podcasts', 'mic', '#d67bff', '#8e2de2', '#fff'], remind: ['Erinnerungen', 'check', '#ffffff', '#f4f4f4', '#000'],
  stocks: ['Aktien', 'stocks', '#1c1c1e', '#000', '#fff'], store: ['App Store', 'bag', '#43b8ff', '#0a6fe0', '#fff'],
  find: ['Wo ist?', 'radar', '#65e272', '#20b83a', '#fff'], home: ['Home', 'house', '#ffb340', '#ff8a00', '#fff'],
  tips: ['Tipps', 'bulb', '#ffe066', '#ffc800', '#fff'], trans: ['Übersetzen', 'translate', '#2d8cff', '#0a5fd8', '#fff'],
  facetime: ['FaceTime', 'video', '#65e272', '#20b83a', '#fff'], contacts: ['Kontakte', 'person', '#d9d9de', '#a8a8ae', '#fff'],
  compass: ['Kompass', 'compass', '#2c2c2e', '#000', '#fff'], voice: ['Sprachmemos', 'mic', '#2c2c2e', '#000', '#ff3b30'],
};
const APPS = {
  1: ['sms', 'cal', 'photos', 'cam', 'stocks', 'maps', 'weather', 'clock', 'calc', 'notes', 'settings'],
  3: ['sms', 'cal', 'photos', 'cam', 'stocks', 'maps', 'weather', 'clock', 'calc', 'notes', 'settings', 'contacts', 'store', 'compass', 'voice'],
  6: ['msg', 'cal', 'photos', 'cam', 'videos', 'maps', 'weather', 'notes', 'remind', 'clock', 'stocks', 'store', 'books', 'settings', 'facetime', 'contacts', 'calc', 'compass', 'voice', 'pod'],
  7: ['msg', 'cal', 'photos', 'cam', 'weather', 'clock', 'maps', 'videos', 'notes', 'remind', 'stocks', 'books', 'store', 'health', 'wallet', 'settings', 'facetime', 'calc', 'compass', 'pod', 'tips', 'contacts', 'voice', 'home'],
  11: ['facetime', 'cal', 'photos', 'cam', 'mail', 'clock', 'maps', 'weather', 'remind', 'notes', 'stocks', 'books', 'store', 'pod', 'tv', 'health', 'home', 'wallet', 'settings', 'files', 'find', 'trans', 'calc', 'tips'],
};
const DOCK = { 1: ['phone', 'mail', 'safari', 'ipod'], 7: ['phone', 'mail', 'safari', 'music'], 11: ['phone', 'safari', 'msg', 'music'] };
const pickList = (tbl, v) => tbl[Object.keys(tbl).map(Number).filter((k) => k <= v).pop()];

function appIcon(ctx, x, y, s, pt, key, era, label = true) {
  const [name, gl, c1, c2, fg] = A[key];
  ctx.save();
  if (era !== 'glass') { ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 5 * pt; ctx.shadowOffsetY = 2 * pt; }
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  if (era === 'skeuo') rr(ctx, x, y, s, s, s * 0.17); else squircle(ctx, x, y, s);
  ctx.fill();
  ctx.restore();
  ctx.save();
  if (era === 'skeuo') rr(ctx, x, y, s, s, s * 0.17); else squircle(ctx, x, y, s);
  ctx.clip();
  glyph(ctx, gl, x + s / 2, y + s / 2, s * 0.8, fg);
  if (era === 'skeuo') {
    // typischer Glanz der frühen iOS-Icons
    const gl2 = ctx.createLinearGradient(0, y, 0, y + s * 0.5);
    gl2.addColorStop(0, 'rgba(255,255,255,.55)'); gl2.addColorStop(1, 'rgba(255,255,255,.08)');
    ctx.fillStyle = gl2; ctx.beginPath(); ctx.ellipse(x + s / 2, y - s * 0.18, s * 0.85, s * 0.66, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (era === 'glass') {
    // Liquid Glass: helle Kante oben links, dunklere unten rechts
    const e = ctx.createLinearGradient(x, y, x + s, y + s);
    e.addColorStop(0, 'rgba(255,255,255,.75)'); e.addColorStop(0.45, 'rgba(255,255,255,.05)'); e.addColorStop(1, 'rgba(255,255,255,.35)');
    ctx.strokeStyle = e; ctx.lineWidth = 2.2 * pt; squircle(ctx, x + 1 * pt, y + 1 * pt, s - 2 * pt); ctx.stroke();
    const sh = ctx.createRadialGradient(x + s * 0.3, y + s * 0.2, 0, x + s * 0.3, y + s * 0.2, s * 0.6);
    sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
  if (label) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 3 * pt; ctx.shadowOffsetY = era === 'skeuo' ? 1 * pt : 0;
    const f = era === 'skeuo' ? `700 ${11 * pt}px ${FONT}` : `${era === 'flat' ? 400 : 500} ${11.5 * pt}px ${FONT}`;
    text(ctx, name.length > 12 ? name.slice(0, 11) + '…' : name, x + s / 2, y + s + 13 * pt, f, '#fff');
    ctx.restore();
  }
}

// ------------------------------------------------------------------ Statusleiste
function battery(ctx, x, y, pt, color, pct = 0.82, withPct = false) {
  const bw = 25 * pt, bh = 12 * pt;
  ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2 * pt;
  rr(ctx, x, y - bh / 2, bw, bh, 3.8 * pt); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = color; rr(ctx, x + 2 * pt, y - bh / 2 + 2 * pt, (bw - 4 * pt) * pct, bh - 4 * pt, 2.2 * pt); ctx.fill();
  ctx.globalAlpha = 0.5; ctx.fillRect(x + bw + 1 * pt, y - 2.5 * pt, 1.6 * pt, 5 * pt); ctx.globalAlpha = 1;
  if (withPct) text(ctx, String(Math.round(pct * 100)), x + bw / 2, y + 0.5 * pt, `700 ${9 * pt}px ${FONT}`, '#000', 'center', 'middle');
}
function bars(ctx, x, y, pt, color, n = 4) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) { const h = (3.5 + i * 2.4) * pt; rr(ctx, x + i * 4.8 * pt, y + 5.5 * pt - h, 3 * pt, h, 0.9 * pt); ctx.fill(); }
}
function wifi(ctx, x, y, pt, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 2 * pt; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y + 5 * pt, (3 + k * 3.6) * pt, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke(); }
}

function statusBar(ctx, W, pt, p, era, lock) {
  const { time } = nowParts(), v = iosVersion(p);
  const net = /5G/.test(p.net) ? '5G' : /LTE|4G/.test(p.net) ? 'LTE' : /3G|UMTS/.test(p.net) ? '3G' : 'EDGE';
  if (era === 'skeuo') {
    const h = 20 * pt;
    ctx.fillStyle = lock ? 'rgba(0,0,0,.45)' : '#000'; ctx.fillRect(0, 0, W, h);
    const gl = ctx.createLinearGradient(0, 0, 0, h); gl.addColorStop(0, 'rgba(255,255,255,.14)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, h);
    bars(ctx, 5 * pt, h / 2 - 2 * pt, pt * 0.9, '#fff', 5);
    text(ctx, `Telekom.de  ${net === 'EDGE' ? 'E' : net}`, 30 * pt, h / 2 + 0.5 * pt, `700 ${12 * pt}px ${FONT}`, '#fff', 'left', 'middle');
    if (!lock) text(ctx, time, W / 2, h / 2 + 0.5 * pt, `700 ${13 * pt}px ${FONT}`, '#fff', 'center', 'middle');
    battery(ctx, W - 32 * pt, h / 2, pt * 0.95, '#fff');
    return;
  }
  const faceId = p.front !== 'home';
  if (!faceId) {
    // iOS 7–15 mit Home-Taste: Punkte/Balken links, Uhrzeit mittig, Akku rechts
    const y = 10 * pt, c = '#fff';
    if (v <= 10) {
      for (let i = 0; i < 5; i++) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(7 * pt + i * 6.5 * pt, y, 2.6 * pt, 0, Math.PI * 2); i < 4 ? ctx.fill() : (ctx.lineWidth = pt, ctx.strokeStyle = c, ctx.stroke()); }
      text(ctx, `Telekom.de ${net}`, 42 * pt, y + 0.5 * pt, `400 ${12 * pt}px ${FONT}`, c, 'left', 'middle');
    } else {
      bars(ctx, 6 * pt, y - 3 * pt, pt * 0.9, c);
      text(ctx, `Telekom.de ${net}`, 28 * pt, y + 0.5 * pt, `500 ${12 * pt}px ${FONT}`, c, 'left', 'middle');
    }
    if (!lock || v <= 6) text(ctx, time, W / 2, y + 0.5 * pt, `600 ${12 * pt}px ${FONT}`, c, 'center', 'middle');
    text(ctx, '82 %', W - 34 * pt, y + 0.5 * pt, `400 ${11.5 * pt}px ${FONT}`, c, 'right', 'middle');
    battery(ctx, W - 31 * pt, y, pt * 0.9, c);
    return;
  }
  // Face ID: Uhrzeit links (nicht auf dem Sperrbildschirm), rechts Empfang/Netz/Akku
  const y = (p.front === 'island' ? 26 : 22) * pt;
  if (!lock) text(ctx, time, 58 * pt, y + 0.5 * pt, `600 ${16.5 * pt}px ${FONT_R}`, '#fff', 'center', 'middle');
  else text(ctx, 'Telekom.de', (p.front === 'island' ? 30 : 16) * pt, y + 0.5 * pt, `600 ${(p.front === 'island' ? 14 : 12.5) * pt}px ${FONT}`, '#fff', 'left', 'middle');
  const bx = W - 42 * pt;
  bars(ctx, bx - 58 * pt, y - 3 * pt, pt, '#fff');
  if (net === '5G') text(ctx, '5G', bx - 26 * pt, y + 0.5 * pt, `600 ${13 * pt}px ${FONT}`, '#fff', 'center', 'middle');
  else wifi(ctx, bx - 26 * pt, y - 3 * pt, pt, '#fff');
  battery(ctx, bx, y, pt, '#fff', 0.82, v >= 16);
}

// ------------------------------------------------------------------ Sperrbildschirm
function lockScreen(ctx, W, H, pt, p, era) {
  const t = nowParts(), v = iosVersion(p), faceId = p.front !== 'home';
  if (era === 'skeuo') {
    // obere Leiste mit Uhrzeit, untere mit "Entsperren"-Schieber
    const top = 20 * pt, th = 76 * pt;
    const g = ctx.createLinearGradient(0, top, 0, top + th);
    g.addColorStop(0, 'rgba(40,40,44,.75)'); g.addColorStop(1, 'rgba(0,0,0,.72)');
    ctx.fillStyle = g; ctx.fillRect(0, top, W, th);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, top, W, 1 * pt);
    text(ctx, t.time, W / 2, top + 54 * pt, `200 ${56 * pt}px ${FONT}`, '#fff');
    text(ctx, t.date, W / 2, top + 70 * pt, `400 ${13 * pt}px ${FONT}`, '#fff');
    const bh = 96 * pt, by = H - bh;
    const g2 = ctx.createLinearGradient(0, by, 0, H);
    g2.addColorStop(0, 'rgba(40,40,44,.75)'); g2.addColorStop(1, 'rgba(0,0,0,.8)');
    ctx.fillStyle = g2; ctx.fillRect(0, by, W, bh);
    const tx = 20 * pt, tw = W - 40 * pt - (v >= 5 ? 40 * pt : 0), tyy = by + 26 * pt, thh = 44 * pt;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, tx, tyy, tw, thh, 10 * pt); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1 * pt; ctx.stroke();
    const kg = ctx.createLinearGradient(0, tyy, 0, tyy + thh);
    kg.addColorStop(0, '#fdfdfd'); kg.addColorStop(1, '#b9b9bd');
    ctx.fillStyle = kg; rr(ctx, tx + 3 * pt, tyy + 3 * pt, 62 * pt, thh - 6 * pt, 8 * pt); ctx.fill();
    ctx.fillStyle = '#8e8e93';
    ctx.beginPath(); const ax = tx + 34 * pt, ay = tyy + thh / 2;
    ctx.moveTo(ax - 12 * pt, ay - 4 * pt); ctx.lineTo(ax + 2 * pt, ay - 4 * pt); ctx.lineTo(ax + 2 * pt, ay - 10 * pt); ctx.lineTo(ax + 13 * pt, ay);
    ctx.lineTo(ax + 2 * pt, ay + 10 * pt); ctx.lineTo(ax + 2 * pt, ay + 4 * pt); ctx.lineTo(ax - 12 * pt, ay + 4 * pt); ctx.closePath(); ctx.fill();
    const sg = ctx.createLinearGradient(tx + 70 * pt, 0, tx + tw, 0);
    sg.addColorStop(0, 'rgba(255,255,255,.35)'); sg.addColorStop(0.45, '#fff'); sg.addColorStop(1, 'rgba(255,255,255,.35)');
    text(ctx, 'Entsperren', tx + 70 * pt + (tw - 70 * pt) / 2, tyy + thh / 2 + 1 * pt, `400 ${20 * pt}px ${FONT}`, sg, 'center', 'middle');
    if (v >= 5) glyph(ctx, 'camera', W - 30 * pt, tyy + thh / 2, 26 * pt, 'rgba(255,255,255,.85)');
    return;
  }
  if (era === 'flat') {
    text(ctx, t.time, W / 2, 128 * pt, `100 ${80 * pt}px ${FONT}`, '#fff');
    text(ctx, t.date, W / 2, 156 * pt, `300 ${17 * pt}px ${FONT}`, '#fff');
    if (v >= 10) {
      text(ctx, 'Home-Taste drücken zum Öffnen', W / 2, H - 22 * pt, `400 ${15 * pt}px ${FONT}`, 'rgba(255,255,255,.9)');
    } else {
      const g = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
      g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, 'rgba(255,255,255,.45)');
      text(ctx, '›  Entsperren', W / 2, H - 58 * pt, `300 ${21 * pt}px ${FONT}`, g);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(ctx, W / 2 - 18 * pt, H - 14 * pt, 36 * pt, 4 * pt, 2 * pt); ctx.fill();
      glyph(ctx, 'camera', W - 28 * pt, H - 22 * pt, 22 * pt, 'rgba(255,255,255,.85)');
    }
    return;
  }
  // Face-ID-/moderne Sperrbildschirme
  const topY = p.front === 'island' ? 70 * pt : 56 * pt;
  if (faceId) glyph(ctx, 'lock', W / 2, topY - 6 * pt, 26 * pt, '#fff');
  if (era === 'modern') {
    text(ctx, t.time, W / 2, topY + 88 * pt, `200 ${84 * pt}px ${FONT}`, '#fff');
    text(ctx, t.date, W / 2, topY + 116 * pt, `400 ${19 * pt}px ${FONT}`, '#fff');
    // Mitteilung
    notif(ctx, W, pt, topY + 150 * pt, era);
  } else if (era === 'bold') {
    text(ctx, t.date, W / 2, topY + 34 * pt, `600 ${19 * pt}px ${FONT}`, 'rgba(255,255,255,.92)');
    text(ctx, t.time, W / 2, topY + 124 * pt, `700 ${96 * pt}px ${FONT_R}`, 'rgba(255,255,255,.95)');
    // Widgets unter der Uhr
    const wy = topY + 158 * pt, wr = 22 * pt;
    [['82', 'Akku'], ['18°', 'Bonn'], ['5G', '']].forEach(([a], k) => {
      const x = W / 2 + (k - 1) * 58 * pt;
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x, wy, wr, 0, Math.PI * 2); ctx.fill();
      if (k === 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * pt; ctx.beginPath(); ctx.arc(x, wy, wr - 4 * pt, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.82); ctx.stroke(); }
      text(ctx, a, x, wy + 1 * pt, `700 ${14 * pt}px ${FONT_R}`, '#fff', 'center', 'middle');
    });
    notif(ctx, W, pt, H - 200 * pt, era);
  } else { // glass
    text(ctx, t.date, W / 2, topY + 32 * pt, `600 ${18 * pt}px ${FONT}`, 'rgba(255,255,255,.95)');
    // große Glas-Uhr
    const fs = 128 * pt, cy = topY + 158 * pt;
    ctx.save();
    ctx.font = `700 ${fs}px ${FONT_R}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 18 * pt; ctx.shadowOffsetY = 6 * pt;
    const gg = ctx.createLinearGradient(0, cy - fs * 0.75, 0, cy);
    gg.addColorStop(0, 'rgba(255,255,255,.92)'); gg.addColorStop(1, 'rgba(255,255,255,.55)');
    ctx.fillStyle = gg; ctx.fillText(t.time, W / 2, cy);
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.6 * pt; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(t.time, W / 2, cy);
    ctx.restore();
    notif(ctx, W, pt, H - 210 * pt, era);
  }
  // Taschenlampe & Kamera, Hinweis, Home-Balken
  const cy = H - 64 * pt;
  if (faceId) [[54 * pt, 'torch'], [W - 54 * pt, 'camera']].forEach(([x, gl]) => {
    ctx.fillStyle = era === 'glass' ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.arc(x, cy, 25 * pt, 0, Math.PI * 2); ctx.fill();
    if (era === 'glass') { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.2 * pt; ctx.stroke(); }
    glyph(ctx, gl, x, cy, 26 * pt, '#fff');
  });
  if (faceId) {
    text(ctx, 'Zum Öffnen nach oben streichen', W / 2, H - 26 * pt, `500 ${12.5 * pt}px ${FONT}`, 'rgba(255,255,255,.85)');
    homeIndicator(ctx, W, H, pt);
  } else text(ctx, 'Home-Taste drücken zum Öffnen', W / 2, H - 20 * pt, `400 ${14 * pt}px ${FONT}`, 'rgba(255,255,255,.9)');
}

function notif(ctx, W, pt, y, era, x0 = 0) {
  const x = x0 + 12 * pt, w = W - 24 * pt, h = 64 * pt;
  ctx.save();
  if (era === 'glass') {
    ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, x, y, w, h, 24 * pt); ctx.fill();
    const e = ctx.createLinearGradient(x, y, x + w, y + h); e.addColorStop(0, 'rgba(255,255,255,.8)'); e.addColorStop(0.5, 'rgba(255,255,255,.1)'); e.addColorStop(1, 'rgba(255,255,255,.45)');
    ctx.strokeStyle = e; ctx.lineWidth = 1.4 * pt; ctx.stroke();
  } else { ctx.fillStyle = era === 'bold' ? 'rgba(40,40,46,.55)' : 'rgba(245,245,250,.72)'; rr(ctx, x, y, w, h, 18 * pt); ctx.fill(); }
  ctx.restore();
  const dark = era === 'modern';
  appIconMini(ctx, x + 12 * pt, y + 14 * pt, 36 * pt, 'msg');
  text(ctx, 'Lena', x + 58 * pt, y + 27 * pt, `600 ${14 * pt}px ${FONT}`, dark ? '#000' : '#fff', 'left');
  text(ctx, 'jetzt', x + w - 12 * pt, y + 27 * pt, `400 ${12 * pt}px ${FONT}`, dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.7)', 'right');
  text(ctx, 'Treffen wir uns um 19 Uhr im Shop?', x + 58 * pt, y + 46 * pt, `400 ${13.5 * pt}px ${FONT}`, dark ? '#1c1c1e' : 'rgba(255,255,255,.95)', 'left');
}
function appIconMini(ctx, x, y, s, key) {
  const [, gl, c1, c2, fg] = A[key];
  const g = ctx.createLinearGradient(x, y, x, y + s); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; squircle(ctx, x, y, s); ctx.fill();
  glyph(ctx, gl, x + s / 2, y + s / 2, s * 0.8, fg);
}
function homeIndicator(ctx, W, H, pt, dark = false) {
  ctx.fillStyle = dark ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.92)';
  rr(ctx, W / 2 - 68 * pt, H - 12 * pt, 136 * pt, 5 * pt, 2.5 * pt); ctx.fill();
}

// ------------------------------------------------------------------ Home-Bildschirm
function glassPanel(ctx, x, y, w, h, r, pt, strong = 0.22) {
  ctx.fillStyle = `rgba(255,255,255,${strong})`; rr(ctx, x, y, w, h, r); ctx.fill();
  const e = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  e.addColorStop(0, 'rgba(255,255,255,.85)'); e.addColorStop(0.5, 'rgba(255,255,255,.08)'); e.addColorStop(1, 'rgba(255,255,255,.4)');
  ctx.strokeStyle = e; ctx.lineWidth = 1.4 * pt; rr(ctx, x + 0.7 * pt, y + 0.7 * pt, w - 1.4 * pt, h - 1.4 * pt, r); ctx.stroke();
}
function widgetWeather(ctx, x, y, w, h, pt, era) {
  if (era === 'glass') glassPanel(ctx, x, y, w, h, 22 * pt, pt, 0.18);
  else {
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#4a90e2'); g.addColorStop(1, '#2a64c0');
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 22 * pt); ctx.fill();
  }
  text(ctx, 'Bonn', x + 14 * pt, y + 24 * pt, `600 ${14 * pt}px ${FONT}`, '#fff', 'left');
  text(ctx, '18°', x + 14 * pt, y + 66 * pt, `300 ${42 * pt}px ${FONT}`, '#fff', 'left');
  glyph(ctx, 'weather', x + 26 * pt, y + h - 42 * pt, 26 * pt, '#fff');
  text(ctx, 'Überwiegend sonnig', x + 14 * pt, y + h - 22 * pt, `500 ${11.5 * pt}px ${FONT}`, '#fff', 'left');
  text(ctx, 'H:21° T:11°', x + 14 * pt, y + h - 8 * pt, `500 ${11.5 * pt}px ${FONT}`, 'rgba(255,255,255,.85)', 'left');
}
function widgetCalendar(ctx, x, y, w, h, pt, era) {
  const t = nowParts();
  if (era === 'glass') glassPanel(ctx, x, y, w, h, 22 * pt, pt, 0.18);
  else { ctx.fillStyle = '#fff'; rr(ctx, x, y, w, h, 22 * pt); ctx.fill(); }
  const dark = era !== 'glass';
  text(ctx, t.wd.toUpperCase(), x + 14 * pt, y + 24 * pt, `700 ${12 * pt}px ${FONT}`, '#ff3b30', 'left');
  text(ctx, String(t.day), x + 14 * pt, y + 66 * pt, `400 ${40 * pt}px ${FONT}`, dark ? '#000' : '#fff', 'left');
  ctx.fillStyle = '#e20074'; rr(ctx, x + 14 * pt, y + h - 46 * pt, 3 * pt, 34 * pt, 1.5 * pt); ctx.fill();
  text(ctx, 'Beratungstermin', x + 22 * pt, y + h - 32 * pt, `600 ${12 * pt}px ${FONT}`, dark ? '#000' : '#fff', 'left');
  text(ctx, '16:30–17:00', x + 22 * pt, y + h - 16 * pt, `400 ${11.5 * pt}px ${FONT}`, dark ? '#6e6e73' : 'rgba(255,255,255,.8)', 'left');
}

function homeScreen(ctx, W, H, pt, p, era) {
  const v = iosVersion(p), faceId = p.front !== 'home';
  const apps = pickList(APPS, v), dock = pickList(DOCK, v);
  const cols = 4, s = (era === 'skeuo' ? 57 : 60) * pt;
  const margin = (era === 'skeuo' ? 16 : 26) * pt;
  const gapX = (W - 2 * margin - cols * s) / (cols - 1);
  const rowH = (era === 'skeuo' ? 88 : 92) * pt;
  const dockH = (era === 'skeuo' ? 92 : 96) * pt;
  let top = era === 'skeuo' ? 30 * pt : faceId ? (p.front === 'island' ? 72 : 64) * pt : 30 * pt;
  const bottomLimit = H - dockH - (faceId ? 20 : 8) * pt - (era === 'bold' || era === 'glass' ? 34 * pt : 18 * pt);
  let list = apps.slice();
  // Widgets ab iOS 14
  if (v >= 14) {
    const ww = s * 2 + gapX, wh = s + rowH - s + s * 0.55 + 18 * pt;
    widgetWeather(ctx, margin, top, ww, wh, pt, era);
    widgetCalendar(ctx, margin + ww + gapX, top, ww, wh, pt, era);
    top += wh + 26 * pt;
  }
  let i = 0;
  for (let r = 0; top + r * rowH + s < bottomLimit; r++) {
    for (let c = 0; c < cols && i < list.length; c++) appIcon(ctx, margin + c * (s + gapX), top + r * rowH, s, pt, list[i++], era);
  }
  // Seitenpunkte bzw. Suchen-Taste
  const indY = H - dockH - (faceId ? 20 : 6) * pt - 14 * pt;
  if (era === 'bold' || era === 'glass') {
    const pw = 98 * pt, ph = 28 * pt, px = W / 2 - pw / 2, py = indY - 8 * pt;
    if (era === 'glass') glassPanel(ctx, px, py, pw, ph, ph / 2, pt, 0.2); else { ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(ctx, px, py, pw, ph, ph / 2); ctx.fill(); }
    glyph(ctx, 'search', px + 20 * pt, py + ph / 2, 15 * pt, '#fff');
    text(ctx, 'Suchen', px + 58 * pt, py + ph / 2 + 0.5 * pt, `600 ${13 * pt}px ${FONT}`, '#fff', 'center', 'middle');
  } else {
    for (let d = 0; d < 3; d++) {
      ctx.fillStyle = d === 0 ? '#fff' : 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.arc(W / 2 + (d - 1) * 14 * pt, indY + 6 * pt, 3.3 * pt, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Dock
  const dy = H - dockH - (faceId ? 12 * pt : 0);
  if (era === 'skeuo') {
    if (v >= 4) { // spiegelndes Glasregal
      const g = ctx.createLinearGradient(0, dy + 14 * pt, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.15, 'rgba(210,220,235,.35)'); g.addColorStop(1, 'rgba(120,130,150,.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(14 * pt, dy + 14 * pt); ctx.lineTo(W - 14 * pt, dy + 14 * pt); ctx.lineTo(W, H - 12 * pt); ctx.lineTo(0, H - 12 * pt); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(0, H - 12 * pt, W, 1.2 * pt);
    } else {
      const g = ctx.createLinearGradient(0, dy, 0, H);
      g.addColorStop(0, 'rgba(90,90,96,.85)'); g.addColorStop(0.5, 'rgba(40,40,44,.9)'); g.addColorStop(1, 'rgba(20,20,22,.95)');
      ctx.fillStyle = g; ctx.fillRect(0, dy, W, dockH);
    }
  } else if (era === 'flat' || !faceId) {
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, dy, W, dockH + 20 * pt);
  } else if (era === 'glass') {
    glassPanel(ctx, 10 * pt, dy, W - 20 * pt, dockH - 8 * pt, 36 * pt, pt, 0.2);
  } else { ctx.fillStyle = 'rgba(255,255,255,.26)'; rr(ctx, 10 * pt, dy, W - 20 * pt, dockH - 8 * pt, 32 * pt); ctx.fill(); }
  dock.forEach((a, k) => appIcon(ctx, margin + k * (s + gapX), dy + (dockH - s) / 2 - (era === 'skeuo' ? 8 : 4) * pt, s, pt, a, era, era === 'skeuo'));
  if (faceId) homeIndicator(ctx, W, H, pt);
}

// ------------------------------------------------------------------ Kamera
function drawCamera(ctx, W, H, pt, s, p, landscape = false) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const vx = landscape ? W * 0.08 : 0, vy = landscape ? 0 : H * 0.12;
  const vw = landscape ? W * 0.78 : W, vh = landscape ? H : H * 0.66;
  const sky = ctx.createLinearGradient(0, vy, 0, vy + vh);
  sky.addColorStop(0, '#6fb2ff'); sky.addColorStop(0.55, '#cfe6ff'); sky.addColorStop(0.56, '#6e9d4f'); sky.addColorStop(1, '#3a5f2b');
  ctx.fillStyle = sky; ctx.fillRect(vx, vy, vw, vh);
  ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(vx + vw * 0.75, vy + vh * 0.22, 26 * pt, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4f7f3a';
  ctx.beginPath(); ctx.moveTo(vx, vy + vh * 0.62);
  ctx.quadraticCurveTo(vx + vw * 0.3, vy + vh * 0.45, vx + vw * 0.6, vy + vh * 0.6);
  ctx.quadraticCurveTo(vx + vw * 0.85, vy + vh * 0.7, vx + vw, vy + vh * 0.55); ctx.lineTo(vx + vw, vy + vh); ctx.lineTo(vx, vy + vh); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1 * pt;
  for (let k = 1; k < 3; k++) {
    ctx.beginPath(); ctx.moveTo(vx + vw * k / 3, vy); ctx.lineTo(vx + vw * k / 3, vy + vh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vx, vy + vh * k / 3); ctx.lineTo(vx + vw, vy + vh * k / 3); ctx.stroke();
  }
  const era = eraOf(p);
  // Zoomstufen je nach Kamera-Ausstattung
  const zooms = p.camCount >= 3 ? ['0,5', '1×', '2', (/5×/.test(p.cam) ? '5' : /4×/.test(p.cam) || p.year >= 2025 ? '4' : /3×/.test(p.cam) ? '3' : '2')] : p.camCount === 2 ? ['0,5', '1×'] : [];
  const zy = landscape ? H / 2 : vy + vh - 26 * pt, zx = landscape ? vx + vw - 30 * pt : W / 2;
  zooms.forEach((z, k) => {
    const off = (k - (zooms.length - 1) / 2) * 38 * pt;
    const x = landscape ? zx : zx + off, y = landscape ? zy + off : zy;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(x, y, 15 * pt, 0, Math.PI * 2); ctx.fill();
    text(ctx, z, x, y, `600 ${11 * pt}px ${FONT}`, z === '1×' ? '#ffd60a' : '#fff', 'center', 'middle');
  });
  const sx = landscape ? W - (W - vx - vw) / 2 : W / 2, sy = landscape ? H / 2 : H - 70 * pt;
  if (era === 'skeuo') {
    // silberne Auslösetaste mit Kamerasymbol
    const g = ctx.createLinearGradient(0, sy - 22 * pt, 0, sy + 22 * pt); g.addColorStop(0, '#f2f2f4'); g.addColorStop(1, '#a4a4aa');
    ctx.fillStyle = g; rr(ctx, sx - 50 * pt, sy - 22 * pt, 100 * pt, 44 * pt, 22 * pt); ctx.fill();
    glyph(ctx, 'camera', sx, sy, 30 * pt, '#3a3a3c');
  } else {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * pt;
    ctx.beginPath(); ctx.arc(sx, sy, 34 * pt, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 28 * pt, 0, Math.PI * 2); ctx.fill();
  }
  if (!landscape) {
    const modes = era === 'skeuo' ? [] : ['ZEITLUPE', 'VIDEO', 'FOTO', 'PORTRÄT', 'PANO'];
    modes.forEach((m, k) => text(ctx, m, W / 2 + (k - 2) * 78 * pt, vy + vh + 22 * pt, `600 ${13 * pt}px ${FONT}`, m === 'FOTO' ? '#ffd60a' : '#fff'));
    if (era !== 'skeuo') { ctx.fillStyle = '#444'; rr(ctx, 30 * pt, sy - 22 * pt, 44 * pt, 44 * pt, 8 * pt); ctx.fill(); }
  }
  if (s.flashUntil) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------------ iPhone Duo innen
function drawDuoSplit(ctx, W, H, pt) {
  const half = W / 2, pad = 16 * pt, top = 58 * pt;
  glassPanel(ctx, pad, top, half - 1.5 * pad, H - top - pad, 26 * pt, pt, 0.12);
  ctx.fillStyle = 'rgba(20,20,24,.7)'; rr(ctx, pad, top, half - 1.5 * pad, H - top - pad, 26 * pt); ctx.fill();
  text(ctx, 'Nachrichten', pad + 20 * pt, top + 40 * pt, `700 ${22 * pt}px ${FONT}`, '#fff', 'left');
  const msgs = [['Treffen wir uns um 19 Uhr?', false], ['Klar! Ich bring das neue Duo mit', true], ['Aufgeklappt oder zu?', false], ['Aufgeklappt – Split-Screen!', true]];
  let y = top + 70 * pt;
  ctx.font = `400 ${15 * pt}px ${FONT}`;
  msgs.forEach(([t, me]) => {
    ctx.font = `400 ${15 * pt}px ${FONT}`;
    const tw = ctx.measureText(t).width + 26 * pt, bh = 34 * pt;
    const x = me ? pad + half - 1.5 * pad - tw - 16 * pt : pad + 16 * pt;
    ctx.fillStyle = me ? '#0a84ff' : '#3a3a3c'; rr(ctx, x, y, tw, bh, 17 * pt); ctx.fill();
    text(ctx, t, x + 13 * pt, y + 22 * pt, `400 ${15 * pt}px ${FONT}`, '#fff', 'left'); y += bh + 12 * pt;
  });
  const rx = half + pad / 2, rw = half - 1.5 * pad;
  ctx.save(); rr(ctx, rx, top, rw, H - top - pad, 26 * pt); ctx.clip();
  ctx.fillStyle = '#e8efe2'; ctx.fillRect(rx, top, rw, H);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10 * pt;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(rx, top + k * 70 * pt); ctx.lineTo(rx + rw, top + k * 70 * pt + 90 * pt); ctx.stroke(); }
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 14 * pt;
  ctx.beginPath(); ctx.moveTo(rx + rw * 0.2, top); ctx.bezierCurveTo(rx + rw * 0.4, top + 200 * pt, rx + rw * 0.7, top + 150 * pt, rx + rw * 0.8, H); ctx.stroke();
  ctx.fillStyle = '#a9d7a0'; rr(ctx, rx + rw * 0.55, top + 40 * pt, 120 * pt, 80 * pt, 20 * pt); ctx.fill();
  ctx.fillStyle = '#0a84ff'; ctx.beginPath(); ctx.arc(rx + rw * 0.45, top + 190 * pt, 11 * pt, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * pt; ctx.stroke();
  glassPanel(ctx, rx + 14 * pt, H - pad - 60 * pt, rw - 28 * pt, 44 * pt, 22 * pt, pt, 0.55);
  glyph(ctx, 'search', rx + 36 * pt, H - pad - 38 * pt, 16 * pt, '#3a3a3c');
  text(ctx, 'Telekom Shop suchen', rx + 52 * pt, H - pad - 37 * pt, `500 ${14 * pt}px ${FONT}`, '#3a3a3c', 'left', 'middle');
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, half - 3 * pt, H / 2 - 30 * pt, 6 * pt, 60 * pt, 3 * pt); ctx.fill();
}

// ------------------------------------------------------------------ Overlays
function pill(ctx, W, pt, y, label, gl, era, warn = false) {
  ctx.font = `600 ${15 * pt}px ${FONT}`;
  const tw = ctx.measureText(label).width + 64 * pt, h = 40 * pt, x = (W - tw) / 2;
  if (era === 'glass') glassPanel(ctx, x, y, tw, h, h / 2, pt, warn ? 0.35 : 0.3);
  ctx.fillStyle = warn ? 'rgba(255,90,40,.92)' : era === 'glass' ? 'rgba(30,30,34,.55)' : 'rgba(28,28,30,.92)';
  rr(ctx, x, y, tw, h, h / 2); ctx.fill();
  glyph(ctx, gl, x + 24 * pt, y + h / 2, 22 * pt, '#fff');
  text(ctx, label, x + 42 * pt, y + h / 2 + 1 * pt, `600 ${15 * pt}px ${FONT}`, '#fff', 'left', 'middle');
}
function drawOverlay(ctx, W, H, pt, s, p, era) {
  const o = s.overlay; if (!o) return;
  const v = iosVersion(p);
  const y = p.front === 'home' ? 40 * pt : 60 * pt;
  if (o === 'vol' || (o === 'mute' && v < 15)) {
    if (v < 13) {
      // quadratische Lautstärke-Anzeige (bis iOS 12)
      const sz = 154 * pt, x = (W - sz) / 2, yy = H / 2 - sz / 2;
      ctx.fillStyle = era === 'skeuo' ? 'rgba(20,20,22,.75)' : 'rgba(235,235,240,.88)'; rr(ctx, x, yy, sz, sz, 16 * pt); ctx.fill();
      const fg = era === 'skeuo' ? '#fff' : '#3a3a3c';
      const gl = o === 'mute' ? (s.silent ? 'belloff' : 'bell') : 'speaker';
      glyph(ctx, gl, W / 2, yy + sz * 0.42, 64 * pt, fg);
      if (o === 'mute') text(ctx, s.silent ? 'Stumm' : 'Klingeln', W / 2, yy + sz - 20 * pt, `600 ${15 * pt}px ${FONT}`, fg);
      else {
        if (era !== 'skeuo') text(ctx, 'Klingelton', W / 2, yy + 22 * pt, `600 ${14 * pt}px ${FONT}`, fg);
        for (let k = 0; k < 16; k++) {
          ctx.fillStyle = k < s.vol ? fg : era === 'skeuo' ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.18)';
          ctx.fillRect(x + 14 * pt + k * ((sz - 28 * pt) / 16), yy + sz - 24 * pt, (sz - 28 * pt) / 16 - 1.5 * pt, 5 * pt);
        }
      }
    } else {
      const bw = 16 * pt, bh = 150 * pt, x = 10 * pt, yy = 150 * pt;
      ctx.fillStyle = 'rgba(40,40,44,.75)'; rr(ctx, x, yy, bw, bh, bw / 2); ctx.fill();
      ctx.save(); rr(ctx, x, yy, bw, bh, bw / 2); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(x, yy + bh * (1 - s.vol / 16), bw, bh);
      ctx.restore();
    }
  } else if (o === 'mute') pill(ctx, W, pt, y, s.silent ? 'Stumm' : 'Klingeln', s.silent ? 'belloff' : 'bell', era, s.silent);
  else if (o === 'torch') pill(ctx, W, pt, y, s.torch ? 'Taschenlampe an' : 'Taschenlampe aus', 'torch', era);
  else if (o === 'touchid') pill(ctx, W, pt, y, 'Mit Touch ID entsperrt', 'finger', era);
  else if (o === 'faceid') pill(ctx, W, pt, y, 'Mit Face ID entsperrt', 'face', era);
}

function cutout(ctx, W, H, pt, p) {
  ctx.fillStyle = '#000';
  if (p.front === 'notch' || p.front === 'notch13') {
    const nw = W * (p.front === 'notch' ? 0.56 : 0.44), nh = 32 * pt, x = (W - nw) / 2, r = 20 * pt;
    ctx.beginPath();
    ctx.moveTo(x - 6 * pt, 0); ctx.quadraticCurveTo(x, 0, x, 6 * pt);
    ctx.lineTo(x, nh - r); ctx.quadraticCurveTo(x, nh, x + r, nh);
    ctx.lineTo(x + nw - r, nh); ctx.quadraticCurveTo(x + nw, nh, x + nw, nh - r);
    ctx.lineTo(x + nw, 6 * pt); ctx.quadraticCurveTo(x + nw, 0, x + nw + 6 * pt, 0);
    ctx.closePath(); ctx.fill();
  } else if (p.front === 'island') {
    const iw = (p.islandSmall ? 92 : 122) * pt, ih = 36 * pt;
    rr(ctx, (W - iw) / 2, 11 * pt, iw, ih, ih / 2); ctx.fill();
    ctx.fillStyle = '#10131c'; ctx.beginPath(); ctx.arc(W / 2 + iw / 2 - 18 * pt, 11 * pt + ih / 2, 6 * pt, 0, Math.PI * 2); ctx.fill();
  }
}

// ------------------------------------------------------------------ Einstieg
export function drawScreen(ctx, W, H, s, p, kind, color) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const era = eraOf(p);
  const col = Object.assign([...color], { _v: iosVersion(p) });
  if (kind === 'duoInner') {
    const pt = H / 560;
    if (s.ui === 'camera') drawCamera(ctx, W, H, pt, s, p, true);
    else {
      wallpaper(ctx, W, H, col, 'glass');
      if (s.ui === 'home') drawDuoSplit(ctx, W, H, pt);
      else {
        const t = nowParts(), fs = 150 * pt;
        text(ctx, t.date, W * 0.28, H * 0.3, `600 ${22 * pt}px ${FONT}`, '#fff');
        ctx.save(); ctx.font = `700 ${fs}px ${FONT_R}`; ctx.textAlign = 'center';
        const gg = ctx.createLinearGradient(0, H * 0.35, 0, H * 0.6); gg.addColorStop(0, 'rgba(255,255,255,.92)'); gg.addColorStop(1, 'rgba(255,255,255,.55)');
        ctx.fillStyle = gg; ctx.fillText(t.time, W * 0.28, H * 0.58);
        ctx.lineWidth = 1.6 * pt; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(t.time, W * 0.28, H * 0.58); ctx.restore();
        text(ctx, 'Display antippen oder Touch ID', W * 0.28, H * 0.7, `500 ${15 * pt}px ${FONT}`, '#fff');
        notif(ctx, W * 0.42, pt, H * 0.44, 'glass', W * 0.54);
        homeIndicator(ctx, W, H, pt);
      }
      statusBar(ctx, W, pt, p, 'glass', s.ui !== 'home');
    }
    drawOverlay(ctx, W, H, pt, s, p, 'glass');
    ctx.restore(); return;
  }
  const pt = W / pointsWide(p, kind);
  if (s.ui === 'camera') drawCamera(ctx, W, H, pt, s, p, false);
  else {
    wallpaper(ctx, W, H, col, era, s.ui === 'home');
    if (s.ui === 'home') homeScreen(ctx, W, H, pt, p, era); else lockScreen(ctx, W, H, pt, p, era);
    statusBar(ctx, W, pt, p, era, s.ui !== 'home');
  }
  drawOverlay(ctx, W, H, pt, s, p, era);
  if (kind === 'duoOuter') {
    const pxmm = W / 79.2;
    ctx.fillStyle = '#000';
    rr(ctx, W - 10.5 * pxmm - 2.1 * pxmm, 6.6 * pxmm, 4.2 * pxmm, 8.4 * pxmm, 2.1 * pxmm); ctx.fill();
    ctx.fillStyle = '#10131c'; ctx.beginPath(); ctx.arc(W - 10.5 * pxmm, 8.7 * pxmm, 1.1 * pxmm, 0, Math.PI * 2); ctx.fill();
  } else cutout(ctx, W, H, pt, p);
  ctx.restore();
}
