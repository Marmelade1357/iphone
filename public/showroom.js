// ============================================================================
// Showroom: Telekom-Shop mit Apple-Präsentationsflächen (Maße in mm)
// ============================================================================
import * as THREE from 'three';

export const TABLE_TOP = 0, TABLE_H = 760, TABLE_W = 3000, TABLE_D = 1050, TABLE_T = 48;
export const FLOOR = TABLE_TOP - TABLE_H;
const ROOM = { x0: -6000, x1: 6000, z0: -3600, z1: 5600, h: 4200 };

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function dataTex(w, h, draw, repeat) { // lineare Daten (Rauheit etc.)
  const t = canvasTex(w, h, draw, repeat); t.colorSpace = THREE.NoColorSpace; return t;
}

// ---------------------------------------------------------------- Telekom × Apple Deko
const MAGENTA = '#e20074';
const magentaGlow = new THREE.MeshBasicMaterial({ color: 0xff2a95, toneMapped: false });
const FONT_UI = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, Arial, sans-serif';
function textFit(g, text, maxW, weight, size) {
  let fs = size; g.font = `${weight} ${fs}px ${FONT_UI}`;
  while (g.measureText(text).width > maxW && fs > 20) { fs -= 4; g.font = `${weight} ${fs}px ${FONT_UI}`; }
}
// Telekom-Logo (vom Nutzer bereitgestellt) – wird nach dem Laden in alle Markenflächen gezeichnet
const TLOGO = new Image();
const brandTextures = [];
function brandTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const redraw = () => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  redraw(); brandTextures.push(redraw);
  return t;
}
TLOGO.onload = () => brandTextures.forEach((f) => f());
TLOGO.src = 'assets/telekom-logo.svg';
// Logo in Wunschfarbe (z. B. weiß auf Magenta) zeichnen; h = Höhe in px
function drawLogo(g, x, y, h, color) {
  if (!TLOGO.complete || !TLOGO.naturalWidth) return 0;
  const w = h * (TLOGO.naturalWidth / TLOGO.naturalHeight);
  const off = document.createElement('canvas'); off.width = Math.ceil(w); off.height = Math.ceil(h);
  const o = off.getContext('2d');
  o.drawImage(TLOGO, 0, 0, w, h);
  if (color) { o.globalCompositeOperation = 'source-in'; o.fillStyle = color; o.fillRect(0, 0, w, h); }
  g.drawImage(off, x, y);
  return w;
}
function posterTelekom() {
  return brandTex(1400, 2200, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W * 0.4, H);
    gr.addColorStop(0, '#ff3fa4'); gr.addColorStop(0.55, MAGENTA); gr.addColorStop(1, '#8a0048');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const phone = (x, y, w, h, c) => {
      g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 40; g.shadowOffsetY = 20;
      g.fillStyle = '#16161a'; roundRect(g, x, y, w, h, w * 0.16); g.fill(); g.restore();
      const sg = g.createLinearGradient(x, y, x + w, y + h); sg.addColorStop(0, c); sg.addColorStop(1, '#1a1440');
      g.fillStyle = sg; roundRect(g, x + 14, y + 14, w - 28, h - 28, w * 0.13); g.fill();
      g.fillStyle = '#000'; roundRect(g, x + w / 2 - w * 0.12, y + 34, w * 0.24, 30, 15); g.fill();
    };
    phone(250, 900, 420, 860, '#ff9ecf'); phone(720, 780, 440, 900, '#7fb4ff');
    drawLogo(g, 100, 110, 150, '#ffffff');
    g.fillStyle = '#fff'; g.textAlign = 'left';
    textFit(g, 'iPhone 18 Pro.', W - 200, 800, 140); g.fillText('iPhone 18 Pro.', 100, 450);
    textFit(g, 'Besser im besten Netz.', W - 200, 650, 96); g.fillText('Besser im besten Netz.', 100, 580);
    g.font = `500 60px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.9)';
    g.fillText('Jetzt bei der Telekom – mit 5G.', 100, 690);
    g.fillStyle = '#fff'; roundRect(g, 100, 1900, 620, 130, 65); g.fill();
    g.fillStyle = MAGENTA; g.font = `700 60px ${FONT_UI}`; g.fillText('Jetzt beraten lassen', 150, 1985);
  });
}
function posterDuo() {
  return brandTex(1400, 2200, (g, W, H) => {
    g.fillStyle = '#0b0b0e'; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H * 0.55, 900);
    rg.addColorStop(0, 'rgba(226,0,116,.55)'); rg.addColorStop(1, 'rgba(226,0,116,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    const x = 250, y = 820, w = 900, h = 640;
    g.fillStyle = '#d9d4c9'; roundRect(g, x, y, w, h, 70); g.fill();
    const sg = g.createLinearGradient(x, y, x + w, y + h); sg.addColorStop(0, '#5b7cff'); sg.addColorStop(0.5, '#b04fd8'); sg.addColorStop(1, MAGENTA);
    g.fillStyle = sg; roundRect(g, x + 18, y + 18, w - 36, h - 36, 56); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = `800 150px ${FONT_UI}`; g.fillText('iPhone Duo', W / 2, 380);
    g.font = `500 68px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText('Das erste faltbare iPhone.', W / 2, 500);
    g.font = `700 76px ${FONT_UI}`; g.fillStyle = '#ff5fb0';
    g.fillText('Ab 23.10. bei der Telekom', W / 2, 1700);
    g.font = `500 56px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillText('Jetzt vorbestellen', W / 2, 1800);
    const lh = 120, lw = drawLogo(g, -9999, -9999, lh) || 0;
    if (lw) drawLogo(g, (W - lw) / 2, 1930, lh, MAGENTA);
  });
}
function accentWallTex() {
  return brandTex(2048, 1600, (g, W, H) => {
    g.fillStyle = MAGENTA; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(W * 0.82, H * 0.2, 140 + i * 110, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.07)'; g.stroke(); }
    drawLogo(g, 150, 250, 330, '#ffffff');
    g.fillStyle = '#fff'; g.textAlign = 'left';
    g.font = `800 150px ${FONT_UI}`; g.fillText('Connecting', 150, 830);
    g.fillText('your world.', 150, 990);
    g.font = `500 70px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.9)';
    g.fillText('Telekom × iPhone', 150, 1130);
  });
}
function counterTex() {
  return brandTex(2480, 832, (g, W, H) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = MAGENTA; g.fillRect(0, H - 90, W, 90);
    const lw = drawLogo(g, -9999, -9999, 170) || 0;
    if (lw) drawLogo(g, (W - lw) / 2, 90, 170);
    g.fillStyle = '#1d1d1f'; g.textAlign = 'center';
    g.font = `700 104px ${FONT_UI}`; g.fillText('Beratung & Service', W / 2, 440);
    g.font = `500 54px ${FONT_UI}`; g.fillStyle = '#6b6b70';
    g.fillText('Tarife · Vertragsverlängerung · Einrichtung · Zubehör', W / 2, 540);
  });
}
function videoWallTex() {
  return brandTex(2048, 1024, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0d0c12'); gr.addColorStop(0.6, '#1c0b18'); gr.addColorStop(1, '#3d0626');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W * 0.7, H * 0.5, 30, W * 0.7, H * 0.5, 700);
    rg.addColorStop(0, 'rgba(226,0,116,.65)'); rg.addColorStop(1, 'rgba(226,0,116,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // Drei stilisierte iPhones (Rückseiten)
    const cols = ['#e7e7e5', '#6b2a35', '#c9dde6'];
    cols.forEach((c, i) => {
      const x = W * 0.52 + i * 250, y = H * 0.16 + (i === 1 ? -30 : 20), w = 220, h = 460;
      g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40; g.shadowOffsetY = 20;
      g.fillStyle = c; roundRect(g, x, y, w, h, 40); g.fill(); g.restore();
      g.fillStyle = 'rgba(0,0,0,.12)'; roundRect(g, x + 8, y + 8, w - 16, h * 0.3, 30); g.fill();
      [[0.3, 0.1], [0.3, 0.22], [0.62, 0.16]].forEach(([u, v]) => {
        g.fillStyle = '#d7d7da'; g.beginPath(); g.arc(x + w * u, y + h * v, 30, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#0d0f18'; g.beginPath(); g.arc(x + w * u, y + h * v, 23, 0, Math.PI * 2); g.fill();
      });
    });
    drawLogo(g, 120, 110, 120, '#ffffff');
    g.fillStyle = '#fff'; g.textAlign = 'left';
    g.font = `800 120px ${FONT_UI}`; g.fillText('iPhone 18 Pro', 120, 440);
    g.font = `600 66px ${FONT_UI}`; g.fillStyle = '#ff5fb0'; g.fillText('Besser im besten Netz.', 120, 540);
    g.font = `500 44px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillText('Jetzt bei der Telekom – mit MagentaMobil.', 120, 620);
    g.font = `600 40px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('Connecting your world.', 120, H - 90);
  });
}
function tvTex() {
  return brandTex(1920, 1080, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#111116'); gr.addColorStop(1, '#2a0a1d');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W * 0.72, H * 0.5, 40, W * 0.72, H * 0.5, 620);
    rg.addColorStop(0, 'rgba(226,0,116,.5)'); rg.addColorStop(1, 'rgba(226,0,116,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // stilisiertes Kamera-Plateau
    g.fillStyle = '#c9c9cc'; roundRect(g, W * 0.56, H * 0.2, W * 0.32, H * 0.36, 60); g.fill();
    g.fillStyle = '#9d9da2'; roundRect(g, W * 0.575, H * 0.23, W * 0.29, H * 0.3, 44); g.fill();
    [[0.63, 0.32], [0.63, 0.46], [0.73, 0.39]].forEach(([cx, cy]) => {
      g.fillStyle = '#e8e8ea'; g.beginPath(); g.arc(W * cx, H * cy, 72, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#101018'; g.beginPath(); g.arc(W * cx, H * cy, 58, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2c3350'; g.beginPath(); g.arc(W * cx, H * cy, 24, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = '#fff'; g.textAlign = 'left';
    g.font = `800 110px ${FONT_UI}`; g.fillText('iPhone 18 Pro', 110, 330);
    g.font = `500 54px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.8)';
    ['A20 Pro in 2 nm', 'Variable Blende', 'Bis zu 45 h Video (Pro Max)'].forEach((t, i) => g.fillText(t, 110, 460 + i * 80));
    g.font = `700 58px ${FONT_UI}`; g.fillStyle = '#ff5fb0'; g.fillText('Besser im besten Netz.', 110, 880);
    drawLogo(g, W - 190, H - 190, 110, '#ffffff');
  });
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}


export const brand = { magentaGlow, posterTelekom, posterDuo, accentWall: accentWallTex, counter: counterTex, tv: tvTex, videoWall: videoWallTex };

// ---------------------------------------------------------------- Materialien
// Ahorn-Tischplatte mit feiner Maserung
const woodTex = canvasTex(2048, 512, (g, W, H) => {
  g.fillStyle = '#d8b88e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const y = rnd() * H, a = 0.03 + rnd() * 0.07;
    g.strokeStyle = rnd() < 0.5 ? `rgba(120,78,35,${a})` : `rgba(255,240,215,${a})`;
    g.lineWidth = 0.6 + rnd() * 2.4;
    g.beginPath(); g.moveTo(0, y);
    const f = 260 + rnd() * 300, amp = 1.5 + rnd() * 5, ph = rnd() * 6;
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x / f + ph) * amp + Math.sin(x / (f * 0.23)) * 0.6);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) { // kleine Poren
    g.fillStyle = 'rgba(110,70,30,.12)'; g.fillRect(rnd() * W, rnd() * H, 6 + rnd() * 20, 1);
  }
});
const woodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0xe8d4b4, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.28, envMapIntensity: 0.7 });
const woodEdgeMat = new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0xe7cfaa, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 });
const legMat = new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0xe2c8a0, roughness: 0.5, clearcoat: 0.3 });

// Großformatige Steinfliesen 1200 × 600 mm
const floorTex = canvasTex(2048, 2048, (g, W, H) => {
  const cols = 4, rows = 8, tw = W / cols, th = H / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const off = (r % 2) * tw / 2, tone = 200 + rnd() * 10;
    g.fillStyle = `rgb(${tone},${tone - 4},${tone - 10})`;
    g.fillRect(c * tw + off - (off ? tw : 0), r * th, tw, th); if (off) g.fillRect(c * tw + off, r * th, tw, th);
  }
  for (let i = 0; i < 26000; i++) { // Steinkörnung
    const v = 150 + rnd() * 90; g.fillStyle = `rgba(${v},${v - 5},${v - 12},${0.06 + rnd() * 0.12})`;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
  }
  g.strokeStyle = 'rgba(120,112,100,.5)'; g.lineWidth = 3;
  for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * th); g.lineTo(W, r * th); g.stroke(); }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    const x = c * tw + (r % 2) * tw / 2; g.beginPath(); g.moveTo(x % W, r * th); g.lineTo(x % W, (r + 1) * th); g.stroke();
  }
}, [ (ROOM.x1 - ROOM.x0) / 4800, (ROOM.z1 - ROOM.z0) / 4800 ]);
const floorMat = new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 0.9 });

const plasterTex = canvasTex(1024, 1024, (g, W, H) => {
  g.fillStyle = '#f3f0ea'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { const v = 225 + rnd() * 30; g.fillStyle = `rgba(${v},${v - 2},${v - 6},.18)`; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 5, 2 + rnd() * 5); }
}, [4, 2]);
const wallMat = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2f, roughness: 0.45, metalness: 0.4 });
const aluMat = new THREE.MeshStandardMaterial({ color: 0xc9c9cc, roughness: 0.35, metalness: 0.8 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfbfbfa, roughness: 0.5 });
const glowWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

// Weiche Kontaktschatten (Textur einmal, vielfach verwendet)
const shadowTex = canvasTex(256, 256, (g, W, H) => {
  const rg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2);
  rg.addColorStop(0, 'rgba(0,0,0,.55)'); rg.addColorStop(0.6, 'rgba(0,0,0,.22)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
});
function contactShadow(parent, x, z, w, d, opacity = 0.5, y = FLOOR + 1.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 1; parent.add(m); return m;
}

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  return s;
}

// Präsentationstisch im Apple-Store-Stil: massive Ahornplatte, abgerundete Kanten, vier Beine mit Zarge
export function makeTable(w, d, x, z, withShadow) {
  const g = new THREE.Group();
  const s = roundedRectShape(w, d, 70);
  const geo = new THREE.ExtrudeGeometry(s, { depth: TABLE_T - 16, bevelEnabled: true, bevelThickness: 8, bevelSize: 8, bevelSegments: 5, curveSegments: 24 });
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w * (w / 2000), (pos.getY(i) + d / 2) / d * (d / 500));
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  geo.rotateX(-Math.PI / 2); geo.translate(0, -TABLE_T + 8, 0);
  const top = new THREE.Mesh(geo, [woodMat, woodEdgeMat]);
  top.receiveShadow = true; top.castShadow = withShadow; g.add(top);
  const legH = TABLE_H - TABLE_T;
  const lg = new THREE.BoxGeometry(64, legH, 64);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(lg, legMat);
    leg.position.set(sx * (w / 2 - 150), -TABLE_T - legH / 2, sz * (d / 2 - 120));
    leg.castShadow = withShadow; g.add(leg);
  });
  [[w - 300, 0, d / 2 - 120], [w - 300, 0, -(d / 2 - 120)]].forEach(([len, , zz]) => {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(len, 70, 28), legMat);
    apron.position.set(0, -TABLE_T - 42, zz); g.add(apron);
  });
  g.position.set(x, TABLE_TOP, z);
  return g;
}

// Ausgestellte Demo-Geräte (flach liegend mit Sicherungs-Dock und Kabel)
const demoScreens = ['#6c8cff', '#ff6fb1', '#48c9a0', '#f5a25d', '#9a7bff', '#56b7ff'].map((c1, k) =>
  canvasTex(128, 256, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, c1); gr.addColorStop(1, '#1b1440');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { g.fillStyle = `hsla(${(k * 60 + r * 40 + c * 25) % 360},70%,70%,.9)`; g.beginPath(); g.roundRect?.(10 + c * 28, 40 + r * 34, 22, 22, 6); g.fill(); }
    g.fillStyle = '#000'; g.fillRect(W / 2 - 18, 6, 36, 9);
  }));
const demoBody = new THREE.MeshPhysicalMaterial({ color: 0x2b2b2e, metalness: 0.7, roughness: 0.3 });
const dockMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
const cableMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 });
function demoPhone(parent, x, z, rot, k) {
  const g = new THREE.Group();
  const dock = new THREE.Mesh(new THREE.CylinderGeometry(38, 44, 10, 32), dockMat); dock.position.y = 5; g.add(dock);
  const body = new THREE.Mesh(new THREE.BoxGeometry(72, 8, 150), demoBody); body.position.y = 14; body.rotation.x = -0.08; g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(66, 144), new THREE.MeshBasicMaterial({ map: demoScreens[k % demoScreens.length], toneMapped: false }));
  scr.rotation.x = -Math.PI / 2 - 0.08; scr.position.y = 18.6; g.add(scr);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 180, 6), cableMat);
  cable.rotation.x = Math.PI / 2; cable.position.set(0, 2, -110); g.add(cable);
  g.position.set(x, TABLE_TOP, z); g.rotation.y = rot;
  parent.add(g);
}

// Feigenbaum im runden Betonkübel (typisch für Apple Stores)
const potMat = new THREE.MeshStandardMaterial({ color: 0xcfcbc4, roughness: 0.85 });
const soilMat = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 1 });
const barkMat = new THREE.MeshStandardMaterial({ color: 0x8b7b68, roughness: 0.9 });
const leafMats = [0x4f7a3d, 0x5d8a45, 0x456d34].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, side: THREE.DoubleSide }));
function makeTree(parent, x, z, s = 1) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(520 * s, 470 * s, 560 * s, 48), potMat);
  pot.position.y = 280 * s; pot.castShadow = true; g.add(pot);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(500 * s, 40), soilMat); soil.rotation.x = -Math.PI / 2; soil.position.y = 545 * s; g.add(soil);
  const trunkH = 1900 * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(28 * s, 55 * s, trunkH, 12), barkMat);
  trunk.position.y = 545 * s + trunkH / 2; g.add(trunk);
  // Blätter als Instanzen (flache Ellipsen) in einer lockeren Krone
  const leafGeo = new THREE.CircleGeometry(60 * s, 7); leafGeo.scale(1, 1.6, 1);
  leafMats.forEach((mat, mi) => {
    const n = 380;
    const inst = new THREE.InstancedMesh(leafGeo, mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const cl = Math.floor(rnd() * 5);
      const cx = [0, 350, -330, 150, -120][cl] * s, cy = (2350 + [0, -250, -150, 300, 250][cl]) * s, cz = [0, 120, -80, -260, 260][cl] * s;
      const r = (260 + rnd() * 240) * s, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      p.set(cx + r * Math.sin(ph) * Math.cos(th), cy + r * Math.cos(ph) * 0.8, cz + r * Math.sin(ph) * Math.sin(th));
      e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI); q.setFromEuler(e);
      const k = 0.7 + rnd() * 0.6; sc.set(k, k, k);
      m4.compose(p, q, sc); inst.setMatrixAt(i, m4);
    }
    inst.castShadow = true; g.add(inst);
  });
  g.position.set(x, FLOOR, z);
  parent.add(g);
  contactShadow(parent, x, z, 1500 * s, 1500 * s, 0.45);
}

// Zubehörwand: Regalböden mit Hüllen, Kartons und Kopfhörer-Boxen
function accessoryWall(parent, x, zc, width, rotY) {
  const g = new THREE.Group();
  const H = 2600, bays = 3, bw = width / bays;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, H), whiteMat);
  back.position.set(0, FLOOR + 300 + H / 2, 6); g.add(back);
  const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(width, 14, 20), glowWhite);
  lightStrip.position.set(0, FLOOR + 300 + H - 30, 30); g.add(lightStrip);
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xe9e6e1, roughness: 0.5 });
  const colors = ['#e20074', '#1d1d1f', '#f5f5f7', '#6b8cff', '#ff9f43', '#2ec4b6', '#b388ff', '#ffd166', '#ef476f', '#8d99ae'];
  for (let b = 0; b < bays; b++) {
    const bx = -width / 2 + bw * (b + 0.5);
    for (let s = 0; s < 5; s++) {
      const y = FLOOR + 520 + s * 460;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(bw - 60, 18, 300), shelfMat);
      shelf.position.set(bx, y, 150); shelf.castShadow = true; shelf.receiveShadow = true; g.add(shelf);
      // Produkte
      let px = bx - bw / 2 + 90;
      while (px < bx + bw / 2 - 110) {
        const kind = rnd();
        if (kind < 0.45) { // Hülle in Blister (hoch)
          const c = colors[Math.floor(rnd() * colors.length)];
          const box = new THREE.Mesh(new THREE.BoxGeometry(95, 185, 22), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
          box.position.set(px, y + 9 + 92, 120); g.add(box);
          const cse = new THREE.Mesh(new THREE.BoxGeometry(76, 155, 6), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
          cse.position.set(px, y + 9 + 95, 134); g.add(cse);
          px += 120;
        } else if (kind < 0.75) { // Karton (Ladegerät/Kabel)
          const box = new THREE.Mesh(new THREE.BoxGeometry(85, 85, 85), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.45 }));
          box.position.set(px, y + 9 + 43, 140); box.castShadow = true; g.add(box);
          px += 110;
        } else { // Kopfhörer-Box
          const box = new THREE.Mesh(new THREE.BoxGeometry(120, 120, 60), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
          box.position.set(px, y + 9 + 60, 140); box.castShadow = true; g.add(box);
          px += 150;
        }
      }
    }
    if (b > 0) { const div = new THREE.Mesh(new THREE.BoxGeometry(20, H, 320), shelfMat); div.position.set(-width / 2 + bw * b, FLOOR + 300 + H / 2, 160); g.add(div); }
  }
  // Sockel
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width, 300, 420), whiteMat);
  plinth.position.set(0, FLOOR + 150, 210); g.add(plinth);
  g.position.set(x, 0, zc); g.rotation.y = rotY;
  parent.add(g);
}

// Blick nach draußen durch die Schaufensterfront
const outsideTex = canvasTex(2048, 1024, (g, W, H) => {
  const sky = g.createLinearGradient(0, 0, 0, H * 0.7); sky.addColorStop(0, '#b9d6f2'); sky.addColorStop(1, '#eef4f8');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) { // unscharfe Gebäude
    const bw = 120 + rnd() * 260, bh = 250 + rnd() * 420, bx = rnd() * W;
    const v = 170 + rnd() * 50; g.fillStyle = `rgba(${v},${v + 4},${v + 10},.85)`; g.fillRect(bx, H * 0.72 - bh, bw, bh);
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let r = 0; r < bh / 40; r++) for (let c = 0; c < bw / 36; c++) if (rnd() < 0.7) g.fillRect(bx + 8 + c * 36, H * 0.72 - bh + 12 + r * 40, 18, 22);
  }
  g.fillStyle = '#c8c3bb'; g.fillRect(0, H * 0.72, W, H * 0.28); // Gehweg
  g.fillStyle = 'rgba(90,110,70,.7)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(rnd() * W, H * 0.66, 60 + rnd() * 70, 0, Math.PI * 2); g.fill(); }
  g.filter = 'blur(6px)'; g.drawImage(g.canvas, 0, 0); g.filter = 'none';
});


// ---------------------------------------------------------------- Aufbau
export function buildShowroom(scene, renderer) {
  const room = new THREE.Group();
  const { x0, x1, z0, z1, h } = ROOM, W = x1 - x0, D = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

  // Boden, Decke, Wände
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, FLOOR, cz); floor.receiveShadow = true; room.add(floor);
  const wall = (w, px, pz, ry, mat = wallMat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(px, FLOOR + h / 2, pz); m.rotation.y = ry; m.receiveShadow = true; room.add(m); return m;
  };
  wall(W, cx, z0, 0); wall(W, cx, z1, Math.PI); wall(D, x0, cz, Math.PI / 2);
  // Schattenfuge unten an den Wänden
  [[W, cx, z0 + 4, 0], [W, cx, z1 - 4, Math.PI], [D, x0 + 4, cz, Math.PI / 2]].forEach(([w, px, pz, ry]) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 60), darkMat); f.position.set(px, FLOOR + 30, pz); f.rotation.y = ry; room.add(f);
  });

  // Lichtdecke (Apple-Store-typisch): große, gleichmäßig leuchtende Felder mit schmalen Fugen
  const ceilTex = canvasTex(1024, 1024, (g, CW, CH) => {
    g.fillStyle = '#e9e7e2'; g.fillRect(0, 0, CW, CH);
    const n = 4, gap = 10, s = CW / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const gr = g.createLinearGradient(0, j * s, 0, (j + 1) * s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#f7f6f2');
      g.fillStyle = gr; g.fillRect(i * s + gap, j * s + gap, s - 2 * gap, s - 2 * gap);
    }
  }, [W / 2400, D / 2400]);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W - 800, D - 800), new THREE.MeshBasicMaterial({ map: ceilTex, toneMapped: false, color: 0xf2f0ec }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, FLOOR + h, cz); room.add(ceil);
  const soffit = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0xdedbd5, roughness: 0.95 }));
  soffit.rotation.x = Math.PI / 2; soffit.position.set(cx, FLOOR + h + 2, cz); room.add(soffit);

  // Rückwand: Holzlamellen mit großer LED-Videowand
  const slatTex = woodTex.clone(); slatTex.needsUpdate = true;
  const slatMat = new THREE.MeshPhysicalMaterial({ map: slatTex, color: 0xd9b68a, roughness: 0.55, clearcoat: 0.2 });
  const slatW = 9000, n = 150;
  const slatGeo = new THREE.BoxGeometry(36, h - 300, 44);
  const slats = new THREE.InstancedMesh(slatGeo, slatMat, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m4.makeTranslation(-slatW / 2 + (i + 0.5) * (slatW / n), FLOOR + (h - 300) / 2 + 300, z0 + 40); slats.setMatrixAt(i, m4); }
  slats.receiveShadow = true; room.add(slats);
  const slatBack = new THREE.Mesh(new THREE.PlaneGeometry(slatW, h - 300), new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 }));
  slatBack.position.set(0, FLOOR + (h - 300) / 2 + 300, z0 + 12); room.add(slatBack);
  // Videowand
  const vw = 4400, vh = 2200;
  const vFrame = new THREE.Mesh(new THREE.BoxGeometry(vw + 60, vh + 60, 60), darkMat);
  vFrame.position.set(0, FLOOR + h - vh / 2 - 350, z0 + 90); room.add(vFrame);
  const vScreen = new THREE.Mesh(new THREE.PlaneGeometry(vw, vh), new THREE.MeshBasicMaterial({ map: brand.videoWall(), toneMapped: false }));
  vScreen.position.set(0, FLOOR + h - vh / 2 - 350, z0 + 122); room.add(vScreen);
  // Magenta-Lichtfuge unter den Lamellen
  const led = new THREE.Mesh(new THREE.BoxGeometry(slatW, 16, 24), brand.magentaGlow);
  led.position.set(0, FLOOR + 290, z0 + 70); room.add(led);

  // Linke Wand: Zubehörwand + Magenta-Markenwand
  accessoryWall(room, x0 + 10, -1200, 4200, Math.PI / 2);
  const accent = new THREE.Mesh(new THREE.PlaneGeometry(3400, 2650), new THREE.MeshStandardMaterial({ map: brand.accentWall(), roughness: 0.8 }));
  accent.rotation.y = Math.PI / 2; accent.position.set(x0 + 8, FLOOR + 1900, 2700); room.add(accent);

  // Rechte Wand: Schaufensterfront mit Blick nach draußen
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(D, h), new THREE.MeshBasicMaterial({ map: outsideTex, toneMapped: false }));
  outside.rotation.y = -Math.PI / 2; outside.position.set(x1 + 600, FLOOR + h / 2, cz); room.add(outside);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(D, h), new THREE.MeshPhysicalMaterial({ color: 0xdfe9ee, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0 }));
  glass.rotation.y = -Math.PI / 2; glass.position.set(x1, FLOOR + h / 2, cz); room.add(glass);
  for (let zz = z0; zz <= z1 + 1; zz += 2300) { // Pfosten
    const post = new THREE.Mesh(new THREE.BoxGeometry(80, h, 80), darkMat); post.position.set(x1, FLOOR + h / 2, Math.min(zz, z1)); room.add(post);
  }
  const transom = new THREE.Mesh(new THREE.BoxGeometry(80, 80, D), darkMat); transom.position.set(x1, FLOOR + 3000, cz); room.add(transom);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(200, 60, D), darkMat); sill.position.set(x1, FLOOR + 30, cz); room.add(sill);

  // Vorderwand (hinter der Kamera): Beratungstheke mit Display
  const counter = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(3200, 40, 750), new THREE.MeshPhysicalMaterial({ color: 0xf7f7f5, roughness: 0.3, clearcoat: 0.6 }));
  top.position.y = 1060; top.castShadow = true; counter.add(top);
  const bodyC = new THREE.Mesh(new THREE.BoxGeometry(3100, 1040, 650), whiteMat); bodyC.position.y = 520; counter.add(bodyC);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(3100, 1040), new THREE.MeshBasicMaterial({ map: brand.counter(), toneMapped: false }));
  front.position.set(0, 520, 326); counter.add(front);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(3100, 10, 10), brand.magentaGlow); glow.position.set(0, 10, 330); counter.add(glow);
  counter.position.set(0, FLOOR, z1 - 1100); counter.rotation.y = Math.PI; room.add(counter);
  contactShadow(room, 0, z1 - 1100, 3700, 1300, 0.35);
  const tv = new THREE.Group();
  const tvBody = new THREE.Mesh(new THREE.BoxGeometry(2440, 1400, 50), darkMat);
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1350), new THREE.MeshBasicMaterial({ map: brand.tv(), toneMapped: false }));
  tvScreen.position.z = 26; tv.add(tvBody, tvScreen);
  tv.position.set(0, FLOOR + 2300, z1 - 40); tv.rotation.y = Math.PI; room.add(tv);

  // Werbe-Stelen im Eingangsbereich
  [[3900, 3600, brand.posterTelekom()], [4600, 1200, brand.posterDuo()]].forEach(([sx, sz, tex]) => {
    const st = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1080, 1700, 120), whiteMat); body.position.y = 850 + 60; st.add(body);
    [1, -1].forEach((sd) => {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1570), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      face.position.set(0, 910, sd * 61); if (sd < 0) face.rotation.y = Math.PI; st.add(face);
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1000, 60, 400), darkMat); base.position.y = 30; st.add(base);
    st.position.set(sx, FLOOR, sz); st.rotation.y = -Math.PI / 2 + 0.35; room.add(st);
    contactShadow(room, sx, sz, 1400, 900, 0.35);
  });

  // Weitere Präsentationstische mit Demo-Geräten
  [[-3300, -1500], [3300, -1500], [-3300, 1400], [3300, 1400]].forEach(([tx, tz], ti) => {
    room.add(makeTable(2600, 1000, tx, tz, false));
    contactShadow(room, tx, tz, 3200, 1600, 0.4);
    for (let k = 0; k < 5; k++) {
      demoPhone(room, tx - 1000 + k * 500, tz + 180, 0, ti * 5 + k);
      demoPhone(room, tx - 1000 + k * 500 + 250, tz - 180, Math.PI, ti * 5 + k + 2);
    }
  });
  contactShadow(room, 0, 0, TABLE_W + 700, TABLE_D + 700, 0.45);

  // Bäume
  makeTree(room, -4900, -2700, 1);
  makeTree(room, 4800, -2700, 0.95);
  makeTree(room, -4800, 4400, 0.9);

  scene.add(room);

  // Haupttisch (fest) + Magenta-Lichtkante
  const mainTable = makeTable(TABLE_W, TABLE_D, 0, 0, true);
  scene.add(mainTable);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W - 160, 5, 5), brand.magentaGlow);
  edge.position.set(0, TABLE_TOP - TABLE_T - 3, TABLE_D / 2 - 40); scene.add(edge);

  // Umgebungs-Reflexionen aus dem Raum selbst (einmalig) – Geräte spiegeln den Showroom
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(10, 30000, cubeRT);
  cubeCam.position.set(0, TABLE_TOP + 250, 600);
  scene.add(cubeCam);
  const bake = () => {
    cubeCam.update(renderer, scene);
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromCubemap(cubeRT.texture).texture;
    scene.environment = env;
    pm.dispose();
  };
  return { bake };
}
