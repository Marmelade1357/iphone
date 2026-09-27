// ============================================================================
// Bildschirminhalt als 2D-Canvas (Sperrbildschirm, Home, Kamera, Overlays)
// ============================================================================
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MO = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const FONT = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const APPS = [
  ['Nachrichten', '💬', '#34c759'], ['Kalender', '📅', '#ffffff'], ['Fotos', '🌼', '#ffffff'], ['Kamera', '📷', '#8e8e93'],
  ['Wetter', '⛅', '#3a8ee6'], ['Uhr', '⏰', '#1c1c1e'], ['Karten', '🗺️', '#7ed27b'], ['Notizen', '📝', '#ffd60a'],
  ['Erinnerungen', '☑️', '#ffffff'], ['Aktien', '📈', '#1c1c1e'], ['Bücher', '📚', '#ff9500'], ['Podcasts', '🎙️', '#a64fe0'],
  ['TV', '📺', '#1c1c1e'], ['Health', '❤️', '#ffffff'], ['Wallet', '💳', '#1c1c1e'], ['Einstellungen', '⚙️', '#8e8e93'],
  ['Rechner', '🧮', '#ff9f0a'], ['Kompass', '🧭', '#1c1c1e'], ['Home', '🏠', '#ff9f0a'], ['Dateien', '📁', '#0a84ff'],
  ['Übersetzen', '🌐', '#0a84ff'], ['Wo ist?', '📍', '#34c759'], ['Musik', '🎵', '#fa2d48'], ['Tipps', '💡', '#ffcc00'],
];
const DOCK = [['Telefon', '📞', '#34c759'], ['Safari', '🧭', '#0a84ff'], ['Mail', '✉️', '#0a84ff'], ['Musik', '🎵', '#fa2d48']];

function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }
function hueOf(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const s = mx === 0 ? 0 : d / mx;
  return { h: (h * 60 + 360) % 360, s };
}
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function nowParts() {
  const d = new Date();
  return {
    time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`,
    date: `${WD[d.getDay()]}, ${d.getDate()}. ${MO[d.getMonth()]}`,
  };
}

function wallpaper(ctx, W, H, color) {
  let { h, s } = hueOf(color[1]);
  if (s < 0.18) h = 225;
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, hsl(h, 70, 52)); g.addColorStop(0.55, hsl((h + 35) % 360, 60, 30)); g.addColorStop(1, hsl((h + 60) % 360, 55, 12));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const blob = (x, y, r, c) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  };
  blob(W * 0.85, H * 0.18, Math.max(W, H) * 0.5, hsl((h + 330) % 360, 90, 65, 0.55));
  blob(W * 0.1, H * 0.75, Math.max(W, H) * 0.55, hsl((h + 80) % 360, 80, 50, 0.45));
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

function statusBar(ctx, W, pt, p, dark = false) {
  const { time } = nowParts();
  ctx.fillStyle = dark ? '#000' : '#fff';
  ctx.textBaseline = 'middle';
  const classic = p.front === 'home';
  const y = classic ? 11 * pt : 29 * pt;
  ctx.font = `600 ${(classic ? 14 : 17) * pt}px ${FONT}`;
  if (classic) {
    ctx.textAlign = 'center'; ctx.fillText(time, W / 2, y);
    ctx.textAlign = 'left'; ctx.font = `500 ${12 * pt}px ${FONT}`; ctx.fillText(p.year < 2012 ? 'Telekom 3G' : 'Telekom LTE', 6 * pt, y);
  } else {
    ctx.textAlign = 'center'; ctx.fillText(time, 62 * pt, y);
  }
  // Akku
  const bx = W - (classic ? 34 : 44) * pt, bw = 25 * pt, bh = 12 * pt;
  ctx.strokeStyle = dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.4 * pt;
  rr(ctx, bx, y - bh / 2, bw, bh, 3.5 * pt); ctx.stroke();
  ctx.fillStyle = dark ? '#000' : '#fff'; rr(ctx, bx + 2 * pt, y - bh / 2 + 2 * pt, (bw - 4 * pt) * 0.8, bh - 4 * pt, 2 * pt); ctx.fill();
  ctx.fillRect(bx + bw + 1 * pt, y - 2.5 * pt, 1.6 * pt, 5 * pt);
  // Signal
  if (!classic) for (let i = 0; i < 4; i++) {
    const h = (4 + i * 2.6) * pt; rr(ctx, W - 96 * pt + i * 5 * pt, y + 5 * pt - h, 3.2 * pt, h, 1 * pt); ctx.fill();
  }
}

function appIcon(ctx, x, y, s, pt, app, label = true) {
  const [name, glyph, bg] = app;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 6 * pt; ctx.shadowOffsetY = 2 * pt;
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -18));
  ctx.fillStyle = g; rr(ctx, x, y, s, s, s * 0.23); ctx.fill();
  ctx.restore();
  ctx.font = `${s * 0.54}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x + s / 2, y + s * 0.54);
  if (label) {
    ctx.fillStyle = '#fff'; ctx.font = `500 ${11 * pt}px ${FONT}`;
    ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 3 * pt;
    ctx.fillText(name, x + s / 2, y + s + 12 * pt);
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  }
}
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * 255)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ------------------------------------------------------------------ Ansichten
function drawLock(ctx, W, H, pt, p) {
  const { time, date } = nowParts();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (p.front === 'home') {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 22 * pt, W, 110 * pt);
    ctx.fillStyle = '#fff';
    ctx.font = `300 ${72 * pt}px ${FONT}`; ctx.fillText(time, W / 2, 100 * pt);
    ctx.font = `400 ${17 * pt}px ${FONT}`; ctx.fillText(date, W / 2, 124 * pt);
    // "Entsperren"-Leiste
    const by = H - 70 * pt;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, by - 30 * pt, W, 90 * pt);
    ctx.font = `400 ${22 * pt}px ${FONT}`;
    const g = ctx.createLinearGradient(W * 0.2, 0, W * 0.9, 0);
    g.addColorStop(0, 'rgba(255,255,255,.4)'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, 'rgba(255,255,255,.4)');
    ctx.fillStyle = g;
    ctx.fillText(p.year >= 2016 ? 'Home-Taste zum Öffnen' : '› Zum Entsperren streichen', W / 2, by + 15 * pt);
  } else {
    ctx.font = `400 ${19 * pt}px ${FONT}`; ctx.fillText(date, W / 2, 112 * pt);
    ctx.font = `600 ${92 * pt}px ${FONT}`; ctx.fillText(time, W / 2, 200 * pt);
    const cy = H - 88 * pt;
    [[62 * pt, '🔦'], [W - 62 * pt, '📷']].forEach(([x, gl]) => {
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.arc(x, cy, 25 * pt, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${22 * pt}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(gl, x, cy + 1 * pt);
    });
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `500 ${13 * pt}px ${FONT}`; ctx.textBaseline = 'alphabetic';
    ctx.fillText('Display antippen zum Entsperren', W / 2, H - 36 * pt);
    homeIndicator(ctx, W, H, pt);
  }
}
function homeIndicator(ctx, W, H, pt, dark = false) {
  ctx.fillStyle = dark ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.9)';
  rr(ctx, W / 2 - 68 * pt, H - 13 * pt, 136 * pt, 5 * pt, 2.5 * pt); ctx.fill();
}

function drawHome(ctx, W, H, pt, p) {
  const classic = p.front === 'home';
  const s = 60 * pt, margin = 26 * pt, cols = 4;
  const gapX = (W - 2 * margin - cols * s) / (cols - 1);
  const top = (classic ? 34 : 72) * pt, rowH = 90 * pt;
  const dockH = 100 * pt;
  const rows = Math.max(2, Math.floor((H - top - dockH - 30 * pt) / rowH));
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (i >= APPS.length) break;
    appIcon(ctx, margin + c * (s + gapX), top + r * rowH, s, pt, APPS[i++]);
  }
  // Seitenpunkte
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (let d = 0; d < 3; d++) {
    ctx.globalAlpha = d === 0 ? 1 : 0.4;
    ctx.beginPath(); ctx.arc(W / 2 + (d - 1) * 14 * pt, H - dockH - 18 * pt, 3.5 * pt, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Dock
  const dy = H - dockH + (classic ? 0 : -6 * pt);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  rr(ctx, classic ? 0 : 12 * pt, dy, classic ? W : W - 24 * pt, dockH - (classic ? 0 : 8 * pt), classic ? 0 : 32 * pt); ctx.fill();
  DOCK.forEach((a, k) => appIcon(ctx, margin + k * (s + gapX), dy + (dockH - s) / 2 - (classic ? 8 * pt : 4 * pt), s, pt, a, classic));
  if (!classic) homeIndicator(ctx, W, H, pt);
}

function drawCamera(ctx, W, H, pt, s, landscape = false) {
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
  // Raster
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1 * pt;
  for (let k = 1; k < 3; k++) {
    ctx.beginPath(); ctx.moveTo(vx + vw * k / 3, vy); ctx.lineTo(vx + vw * k / 3, vy + vh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vx, vy + vh * k / 3); ctx.lineTo(vx + vw, vy + vh * k / 3); ctx.stroke();
  }
  // Zoom-Pillen
  const zy = landscape ? H / 2 : vy + vh - 26 * pt, zx = landscape ? vx + vw - 30 * pt : W / 2;
  ['0,5', '1×', '2', '4'].forEach((z, k) => {
    const x = landscape ? zx : zx + (k - 1.5) * 38 * pt, y = landscape ? zy + (k - 1.5) * 38 * pt : zy;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(x, y, 15 * pt, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = k === 1 ? '#ffd60a' : '#fff'; ctx.font = `600 ${11 * pt}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(z, x, y);
  });
  // Auslöser
  const sx = landscape ? W - (W - vx - vw) / 2 : W / 2, sy = landscape ? H / 2 : H - 70 * pt;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * pt;
  ctx.beginPath(); ctx.arc(sx, sy, 34 * pt, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 28 * pt, 0, Math.PI * 2); ctx.fill();
  if (!landscape) {
    ctx.font = `600 ${13 * pt}px ${FONT}`; ctx.textAlign = 'center';
    ['ZEITLUPE', 'VIDEO', 'FOTO', 'PORTRÄT', 'PANO'].forEach((m, k) => {
      ctx.fillStyle = m === 'FOTO' ? '#ffd60a' : '#fff';
      ctx.fillText(m, W / 2 + (k - 2) * 78 * pt, vy + vh + 22 * pt);
    });
    ctx.fillStyle = '#444'; rr(ctx, 30 * pt, sy - 22 * pt, 44 * pt, 44 * pt, 8 * pt); ctx.fill();
  }
  if (s.flashUntil) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, 0, W, H); }
}

function drawDuoSplit(ctx, W, H, pt) {
  // linke App: Nachrichten
  const half = W / 2, pad = 16 * pt, top = 58 * pt;
  ctx.fillStyle = 'rgba(20,20,24,.82)'; rr(ctx, pad, top, half - 1.5 * pad, H - top - pad, 26 * pt); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 ${22 * pt}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Nachrichten', pad + 20 * pt, top + 40 * pt);
  const msgs = [['Treffen wir uns um 19 Uhr?', false], ['Klar! Ich bring das neue Duo mit 📱', true], ['Aufgeklappt oder zu? 😄', false], ['Aufgeklappt natürlich – Split-Screen!', true]];
  let y = top + 70 * pt;
  ctx.font = `400 ${15 * pt}px ${FONT}`;
  msgs.forEach(([t, me]) => {
    const tw = ctx.measureText(t).width + 26 * pt, bh = 34 * pt;
    const x = me ? pad + half - 1.5 * pad - tw - 16 * pt : pad + 16 * pt;
    ctx.fillStyle = me ? '#0a84ff' : '#3a3a3c'; rr(ctx, x, y, tw, bh, 17 * pt); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(t, x + 13 * pt, y + 22 * pt); y += bh + 12 * pt;
  });
  // rechte App: Karten
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
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, half - 3 * pt, H / 2 - 30 * pt, 6 * pt, 60 * pt, 3 * pt); ctx.fill();
}

function pill(ctx, W, pt, y, text, bg = 'rgba(28,28,30,.92)') {
  ctx.font = `600 ${15 * pt}px ${FONT}`;
  const tw = ctx.measureText(text).width + 40 * pt, h = 40 * pt;
  ctx.fillStyle = bg; rr(ctx, (W - tw) / 2, y, tw, h, h / 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y + h / 2 + 1 * pt);
}

function drawOverlay(ctx, W, H, pt, s, p) {
  const o = s.overlay; if (!o) return;
  const classic = p.front === 'home';
  const y = classic ? 40 * pt : 60 * pt;
  if (o === 'vol') {
    if (classic || p.year < 2020) {
      const sz = 150 * pt, x = (W - sz) / 2, yy = H / 2 - sz / 2;
      ctx.fillStyle = 'rgba(40,40,44,.82)'; rr(ctx, x, yy, sz, sz, 20 * pt); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `${56 * pt}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.vol === 0 ? '🔈' : '🔊', W / 2, yy + sz * 0.42);
      for (let k = 0; k < 16; k++) {
        ctx.fillStyle = k < s.vol ? '#fff' : 'rgba(255,255,255,.25)';
        ctx.fillRect(x + 14 * pt + k * ((sz - 28 * pt) / 16), yy + sz - 26 * pt, (sz - 28 * pt) / 16 - 1.5 * pt, 6 * pt);
      }
    } else {
      const bw = 16 * pt, bh = 150 * pt, x = 10 * pt, yy = 150 * pt;
      ctx.fillStyle = 'rgba(40,40,44,.75)'; rr(ctx, x, yy, bw, bh, bw / 2); ctx.fill();
      ctx.save(); rr(ctx, x, yy, bw, bh, bw / 2); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(x, yy + bh * (1 - s.vol / 16), bw, bh);
      ctx.restore();
    }
  } else if (o === 'mute') pill(ctx, W, pt, y, s.silent ? '🔕  Stumm' : '🔔  Klingeln', s.silent ? 'rgba(255,90,40,.95)' : 'rgba(28,28,30,.92)');
  else if (o === 'torch') pill(ctx, W, pt, y, s.torch ? '🔦  Taschenlampe an' : '🔦  Taschenlampe aus');
  else if (o === 'touchid') pill(ctx, W, pt, y, '☝️  Mit Touch ID entsperrt');
  else if (o === 'faceid') pill(ctx, W, pt, y, '🙂  Mit Face ID entsperrt');
}

// ------------------------------------------------------------------ Einstieg
export function drawScreen(ctx, W, H, s, p, kind, color) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (kind === 'duoInner') {
    const pt = H / 560;
    if (s.ui === 'camera') drawCamera(ctx, W, H, pt, s, true);
    else {
      wallpaper(ctx, W, H, color);
      statusBar(ctx, W, pt, p);
      if (s.ui === 'home') drawDuoSplit(ctx, W, H, pt);
      else {
        const { time, date } = nowParts();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.font = `400 ${22 * pt}px ${FONT}`; ctx.fillText(date, W * 0.3, H * 0.38);
        ctx.font = `600 ${110 * pt}px ${FONT}`; ctx.fillText(time, W * 0.3, H * 0.62);
        ctx.font = `500 ${15 * pt}px ${FONT}`; ctx.fillText('Display antippen oder Touch ID', W * 0.3, H * 0.72);
        homeIndicator(ctx, W, H, pt);
      }
    }
    drawOverlay(ctx, W, H, pt, s, p);
    ctx.restore(); return;
  }
  const pt = W / 390;
  if (s.ui === 'camera') {
    drawCamera(ctx, W, H, pt, s, false);
  } else {
    wallpaper(ctx, W, H, color);
    if (s.ui === 'home') drawHome(ctx, W, H, pt, p); else drawLock(ctx, W, H, pt, p);
    statusBar(ctx, W, pt, p);
  }
  drawOverlay(ctx, W, H, pt, s, p);
  if (kind === 'duoOuter') {
    // iPhone Duo außen: senkrechte Kamera-Aussparung oben rechts (Apple-Produktbilder)
    const pxmm = W / 79.2;
    ctx.fillStyle = '#000';
    rr(ctx, W - 10.5 * pxmm - 2.1 * pxmm, 6.6 * pxmm, 4.2 * pxmm, 8.4 * pxmm, 2.1 * pxmm); ctx.fill();
    ctx.fillStyle = '#10131c'; ctx.beginPath(); ctx.arc(W - 10.5 * pxmm, 8.7 * pxmm, 1.1 * pxmm, 0, Math.PI * 2); ctx.fill();
  } else cutout(ctx, W, H, pt, p);
  ctx.restore();
}
