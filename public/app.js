// ============================================================================
// iPhone-Vergleich – Szene, Steuerung, Vergleichstabelle
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { PHONES, VPI_NOW, vpiFor } from './data.js';
import { Phone } from './phone.js';

const $ = (s) => document.querySelector(s);
const byId = (id) => PHONES.find((p) => p.id === id) || PHONES[PHONES.length - 1];
const SLOT_COLORS = ['#4f8cff', '#f2994a', '#3ecf8e', '#c77dff'];
const SLOT_LETTERS = ['A', 'B', 'C', 'D'];
const GAP = 30; // mm zwischen den Geräten

const VIEWS = {
  front: [0, 0], back: [0, Math.PI], left: [0, Math.PI / 2], right: [0, -Math.PI / 2],
  top: [Math.PI / 2, 0], bottom: [-Math.PI / 2, 0], three: [0.28, -0.62], tq: [0.28, -0.62],
};

// ---------------------------------------------------------------- Zustand
const state = {
  n: 2,
  slots: [
    { id: '18pro', c: 0, s: 0 },
    { id: 'duo', c: 1, s: 0 },
    { id: 'iphone', c: 0, s: 0 },
    { id: 'air', c: 3, s: 0 },
  ],
  display: 'on',
  price: 'nom',
  fold: 180,
  sync: true,
  grid: true,
};

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const n = parseInt(h.get('n'), 10);
  if (n >= 1 && n <= 4) state.n = n;
  if (h.get('s')) h.get('s').split(',').slice(0, 4).forEach((x, i) => {
    const [id, c, s] = x.split('.');
    if (PHONES.some((p) => p.id === id)) state.slots[i] = { id, c: +c || 0, s: +s || 0 };
  });
  if (h.get('d') === 'off' || h.get('d') === 'on') state.display = h.get('d');
  if (h.get('p') === 'real' || h.get('p') === 'nom') state.price = h.get('p');
  const f = parseInt(h.get('f'), 10);
  if (f >= 0 && f <= 180) state.fold = f;
}
function writeHash() {
  const s = state.slots.map((x) => `${x.id}.${x.c}.${x.s}`).join(',');
  history.replaceState(null, '', `#n=${state.n}&s=${s}&d=${state.display}&p=${state.price}&f=${Math.round(state.fold)}`);
}

// ---------------------------------------------------------------- Formatierung
const nf = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const mm = (v) => nf(v, v % 1 ? (Math.round(v * 100) % 10 ? 2 : 1) : 0);
const eur = (v) => (v == null ? '–' : `${nf(v, v % 1 ? 2 : 0)} €`);
const eurR = (v) => (v == null ? '–' : `${nf(Math.round(v))} €`);
function priceOf(slot) {
  const p = byId(slot.id);
  const [label, price] = p.prices[Math.min(slot.s, p.prices.length - 1)];
  const factor = VPI_NOW.value / vpiFor(p.year);
  return { label, price, real: price == null ? null : price * factor, factor };
}

// ---------------------------------------------------------------- Three.js
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.background = new THREE.Color(0xeeebe6);
scene.fog = new THREE.Fog(0xeeebe6, 4500, 11000);

const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.6;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xe6eeff, 0.45); rim.position.set(-1500, 1200, -1500); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffffff, 0xcbb89c, 0.3));

const camera = new THREE.PerspectiveCamera(30, 1, 5, 20000);
camera.position.set(0, 90, 700);

// Eigene Pointer-Logik VOR OrbitControls registrieren (kann sie deaktivieren)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let drag = null;
renderer.domElement.addEventListener('pointerdown', onPointerDown);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 120;
controls.maxDistance = 2600;
controls.maxPolarAngle = Math.PI * 0.62;
controls.target.set(0, 0, 0);

// ---------------------------------------------------------------- Showroom
// Maße in mm. Der Präsentationstisch steht fest im Raum (TABLE_TOP = Oberkante).
const TABLE_TOP = 0, TABLE_H = 760, TABLE_W = 2400, TABLE_D = 950, TABLE_T = 40;
const FLOOR = TABLE_TOP - TABLE_H;
const ROOM = { x0: -4200, x1: 4200, z0: -2600, z1: 4200, h: 3400 };

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const woodTex = canvasTex(2048, 1024, (g, W, H) => {
  const planks = 6, ph = H / planks;
  for (let k = 0; k < planks; k++) {
    const tone = 0.93 + rnd() * 0.12;
    g.fillStyle = `rgb(${Math.round(196 * tone)},${Math.round(156 * tone)},${Math.round(110 * tone)})`;
    g.fillRect(0, k * ph, W, ph);
    for (let i = 0; i < 70; i++) {
      const y = k * ph + rnd() * ph;
      g.strokeStyle = `rgba(100,60,25,${0.06 + rnd() * 0.1})`; g.lineWidth = 0.6 + rnd() * 1.8;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= W; x += 64) g.lineTo(x, y + Math.sin(x / (180 + rnd() * 90) + k) * (2 + rnd() * 4));
      g.stroke();
    }
    g.fillStyle = 'rgba(90,60,30,.2)'; g.fillRect(0, k * ph, W, 2);
  }
});
const woodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0xe6cfae, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.55 });
const woodSideMat = new THREE.MeshStandardMaterial({ color: 0xa47a4c, roughness: 0.55 });

const floorTex = canvasTex(1024, 1024, (g, W, H) => {
  g.fillStyle = '#d9d5ce'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { // Terrazzo-Körnung
    g.fillStyle = `rgba(${120 + rnd() * 80},${115 + rnd() * 70},${105 + rnd() * 60},${0.25 + rnd() * 0.35})`;
    g.beginPath(); g.arc(rnd() * W, rnd() * H, 1 + rnd() * 4, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(120,112,100,.35)'; g.lineWidth = 3; g.strokeRect(0, 0, W, H);
}, [7, 6]);
const floorMat = new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.25, envMapIntensity: 0.6 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1eee9, roughness: 0.92 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 0.95 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const slatMat = new THREE.MeshStandardMaterial({ color: 0xb58a5a, roughness: 0.6 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x3b3b3e, roughness: 0.5, metalness: 0.3 });
const potMat = new THREE.MeshStandardMaterial({ color: 0xe7e3dc, roughness: 0.7 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f8a4a, roughness: 0.8 });
const legMat = new THREE.MeshStandardMaterial({ color: 0x8f6a42, roughness: 0.55 });

function roundedSlab(w, d, t, r, mats) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: t - 6, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 4, curveSegments: 20 });
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + d / 2) / d);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -t + 3, 0);
  return new THREE.Mesh(geo, mats);
}

// Präsentationstisch im Apple-Store-Stil (Holzplatte auf Holzbeinen)
function makeTable(w, d, x, z, withShadow) {
  const g = new THREE.Group();
  const top = roundedSlab(w, d, TABLE_T, 40, [woodMat, woodSideMat]);
  top.receiveShadow = true; top.castShadow = withShadow; g.add(top);
  const legH = TABLE_H - TABLE_T;
  const lg = new THREE.BoxGeometry(70, legH, 70);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(lg, legMat);
    leg.position.set(sx * (w / 2 - 110), -TABLE_T - legH / 2, sz * (d / 2 - 110));
    leg.castShadow = withShadow; leg.receiveShadow = true; g.add(leg);
  });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w - 220, 60, 30), legMat);
  rail.position.set(0, -TABLE_T - 40, 0); g.add(rail);
  g.position.set(x, TABLE_TOP, z);
  return g;
}

function makePlant(x, z, s = 1) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(260 * s, 200 * s, 520 * s, 32), potMat);
  pot.position.y = 260 * s; pot.castShadow = true; g.add(pot);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(22 * s, 30 * s, 1300 * s, 10), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }));
  trunk.position.y = 520 * s + 650 * s; g.add(trunk);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((260 + rnd() * 160) * s, 1), leafMat);
    leaf.position.set((rnd() - 0.5) * 520 * s, (1500 + rnd() * 600) * s, (rnd() - 0.5) * 520 * s);
    leaf.castShadow = true; g.add(leaf);
  }
  g.position.set(x, FLOOR, z);
  return g;
}

// ---------------------------------------------------------------- Telekom × Apple Deko
const MAGENTA = '#e20074';
const magentaGlow = new THREE.MeshBasicMaterial({ color: 0xff2a95, toneMapped: false });
const FONT_UI = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, Arial, sans-serif';
function textFit(g, text, maxW, weight, size) {
  let fs = size; g.font = `${weight} ${fs}px ${FONT_UI}`;
  while (g.measureText(text).width > maxW && fs > 20) { fs -= 4; g.font = `${weight} ${fs}px ${FONT_UI}`; }
}
function posterTelekom() {
  return canvasTex(1400, 2200, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W * 0.4, H);
    gr.addColorStop(0, '#ff3fa4'); gr.addColorStop(0.55, MAGENTA); gr.addColorStop(1, '#8a0048');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // stilisierte iPhones
    const phone = (x, y, w, h, c) => {
      g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 40; g.shadowOffsetY = 20;
      g.fillStyle = '#16161a'; roundRect(g, x, y, w, h, w * 0.16); g.fill(); g.restore();
      const sg = g.createLinearGradient(x, y, x + w, y + h); sg.addColorStop(0, c); sg.addColorStop(1, '#1a1440');
      g.fillStyle = sg; roundRect(g, x + 14, y + 14, w - 28, h - 28, w * 0.13); g.fill();
      g.fillStyle = '#000'; roundRect(g, x + w / 2 - w * 0.16, y + 34, w * 0.32, 30, 15); g.fill();
    };
    phone(260, 820, 420, 860, '#ff9ecf'); phone(720, 700, 440, 900, '#7fb4ff');
    g.fillStyle = '#fff'; g.textAlign = 'left';
    textFit(g, 'Das neue iPhone.', W - 200, 800, 130); g.fillText('Das neue iPhone.', 100, 300);
    textFit(g, 'Jetzt bei der Telekom.', W - 200, 600, 92); g.fillText('Jetzt bei der Telekom.', 100, 430);
    g.font = `500 64px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.9)';
    g.fillText('Im besten Netz – mit 5G.', 100, 560);
    g.fillStyle = '#fff'; roundRect(g, 100, 1880, 620, 130, 65); g.fill();
    g.fillStyle = MAGENTA; g.font = `700 60px ${FONT_UI}`; g.fillText('Jetzt beraten lassen', 150, 1965);
  });
}
function posterDuo() {
  return canvasTex(1400, 2200, (g, W, H) => {
    g.fillStyle = '#0b0b0e'; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H * 0.55, 900);
    rg.addColorStop(0, 'rgba(226,0,116,.55)'); rg.addColorStop(1, 'rgba(226,0,116,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // aufgeklapptes Duo, stilisiert
    const x = 250, y = 800, w = 900, h = 640;
    g.fillStyle = '#d9d4c9'; roundRect(g, x, y, w, h, 70); g.fill();
    const sg = g.createLinearGradient(x, y, x + w, y + h); sg.addColorStop(0, '#5b7cff'); sg.addColorStop(0.5, '#b04fd8'); sg.addColorStop(1, MAGENTA);
    g.fillStyle = sg; roundRect(g, x + 18, y + 18, w - 36, h - 36, 56); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + w / 2 - 2, y + 18, 4, h - 36);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = `800 150px ${FONT_UI}`; g.fillText('iPhone Duo', W / 2, 360);
    g.font = `500 70px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText('Faltbar. Riesig. Pocketable.', W / 2, 480);
    g.font = `700 76px ${FONT_UI}`; g.fillStyle = '#ff5fb0';
    g.fillText('Ab 23.10. bei der Telekom', W / 2, 1700);
    g.font = `500 56px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillText('Vorbestellen ab 16.10.', W / 2, 1800);
  });
}
function accentWallTex() {
  return canvasTex(2048, 1600, (g, W, H) => {
    g.fillStyle = MAGENTA; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(W * 0.8, H * 0.2, 140 + i * 110, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.08)'; g.stroke(); }
    g.fillStyle = '#fff'; g.textAlign = 'left';
    g.font = `800 150px ${FONT_UI}`; g.fillText('Erleben,', 140, 560);
    g.fillText('was verbindet.', 140, 730);
    g.font = `500 70px ${FONT_UI}`; g.fillStyle = 'rgba(255,255,255,.9)';
    g.fillText('Telekom × iPhone', 140, 880);
  });
}
function counterTex() {
  return canvasTex(2100, 1060, (g, W, H) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = MAGENTA; g.fillRect(0, H - 120, W, 120);
    g.fillStyle = '#1d1d1f'; g.textAlign = 'center';
    g.font = `700 120px ${FONT_UI}`; g.fillText('Beratung & Service', W / 2, 460);
    g.font = `500 64px ${FONT_UI}`; g.fillStyle = '#6b6b70';
    g.fillText('Tarife · Vertragsverlängerung · Einrichtung', W / 2, 580);
  });
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function buildShowroom() {
  const room = new THREE.Group();
  const { x0, x1, z0, z1, h } = ROOM, W = x1 - x0, D = z1 - z0;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set((x0 + x1) / 2, FLOOR, (z0 + z1) / 2); floor.receiveShadow = true;
  room.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.set((x0 + x1) / 2, FLOOR + h, (z0 + z1) / 2); room.add(ceil);
  const wall = (w, px, pz, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(px, FLOOR + h / 2, pz); m.rotation.y = ry; m.receiveShadow = true; room.add(m);
  };
  wall(W, (x0 + x1) / 2, z0, 0);                 // Rückwand
  wall(W, (x0 + x1) / 2, z1, Math.PI);           // Wand hinter der Kamera
  wall(D, x0, (z0 + z1) / 2, Math.PI / 2);       // links
  wall(D, x1, (z0 + z1) / 2, -Math.PI / 2);      // rechts
  // Sockelleisten
  [[W, (x0 + x1) / 2, z0 + 6, 0], [W, (x0 + x1) / 2, z1 - 6, 0]].forEach(([w, px, pz]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 80, 12), darkMat); b.position.set(px, FLOOR + 40, pz); room.add(b);
  });
  // Holzlamellen-Wand hinter dem Tisch
  const slatW = 3600, n = 60;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(34, h - 400, 40), slatMat);
    s.position.set(-slatW / 2 + (i + 0.5) * (slatW / n), FLOOR + (h - 400) / 2 + 200, z0 + 25);
    s.receiveShadow = true; room.add(s);
  }
  // Leuchtwände (Plakate) links und rechts der Lamellen – Telekom × Apple
  const posters = [posterTelekom(), posterDuo()];
  [-1, 1].forEach((sx, k) => {
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(1400, 2200), new THREE.MeshBasicMaterial({ map: posters[k], toneMapped: false }));
    lb.position.set(sx * 2850, FLOOR + 1700, z0 + 14); room.add(lb);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1460, 2260, 20), darkMat);
    frame.position.set(sx * 2850, FLOOR + 1700, z0 + 2); room.add(frame);
  });
  // Magenta-Lichtleisten ober- und unterhalb der Holzlamellen
  [FLOOR + 190, FLOOR + h - 190].forEach((y) => {
    const led = new THREE.Mesh(new THREE.BoxGeometry(3700, 18, 30), magentaGlow);
    led.position.set(0, y, z0 + 60); room.add(led);
  });
  // Lichtbänder an der Decke (eins in Magenta über dem Haupttisch)
  for (let i = 0; i < 4; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 1200, 12, 90), i === 1 ? magentaGlow : lightMat);
    strip.position.set((x0 + x1) / 2, FLOOR + h - 8, z0 + 900 + i * 1500); room.add(strip);
  }
  // Magenta-Akzentwand links mit Schriftzug
  const accent = new THREE.Mesh(new THREE.PlaneGeometry(3600, h - 600), new THREE.MeshStandardMaterial({ map: accentWallTex(), roughness: 0.85 }));
  accent.rotation.y = Math.PI / 2; accent.position.set(x0 + 4, FLOOR + (h - 600) / 2 + 300, 600); room.add(accent);
  // Beratungstheke rechts hinten
  const counter = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(2200, 40, 700), new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.4 }));
  top.position.y = 1080; top.castShadow = true; counter.add(top);
  const bodyC = new THREE.Mesh(new THREE.BoxGeometry(2100, 1060, 620), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  bodyC.position.y = 530; counter.add(bodyC);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2100, 1060), new THREE.MeshBasicMaterial({ map: counterTex(), toneMapped: false }));
  front.position.set(0, 530, 311); counter.add(front);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(2100, 10, 10), magentaGlow);
  glow.position.set(0, 12, 315); counter.add(glow);
  counter.position.set(3700, FLOOR, 200); counter.rotation.y = -Math.PI / 2;
  room.add(counter);
  // weitere Präsentationstische im Hintergrund
  room.add(makeTable(2000, 850, -2600, -1300, false));
  room.add(makeTable(2000, 850, -2900, 1700, false));
  room.add(makeTable(2000, 850, 2900, 1700, false));
  // Ausstellungs-Attrappen auf den Nebentischen
  const dummyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2d, roughness: 0.3, metalness: 0.5 });
  [[-2600, -1300], [-2900, 1700], [2900, 1700]].forEach(([tx, tz]) => {
    for (let k = -2; k <= 2; k++) {
      const dm = new THREE.Mesh(new THREE.BoxGeometry(72, 8, 150), dummyMat);
      dm.position.set(tx + k * 320, TABLE_TOP + 4, tz); dm.rotation.y = (rnd() - 0.5) * 0.3; room.add(dm);
    }
  });
  // Pflanzen
  room.add(makePlant(-3700, -2050, 1));
  room.add(makePlant(3700, -2050, 1));
  room.add(makePlant(-3800, 3600, 0.9));
  // Sitzbank vorne rechts
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1800, 60, 420), woodMat);
  bench.position.set(2600, FLOOR + 450, 3300); bench.castShadow = true; room.add(bench);
  [-1, 1].forEach((sx) => { const l = new THREE.Mesh(new THREE.BoxGeometry(60, 420, 380), legMat); l.position.set(2600 + sx * 800, FLOOR + 210, 3300); room.add(l); });
  scene.add(room);
}
buildShowroom();

// Haupttisch (fest)
const mainTable = makeTable(TABLE_W, TABLE_D, 0, 0, true);
scene.add(mainTable);
{
  const edge = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W - 120, 6, 6), magentaGlow);
  edge.position.set(0, TABLE_TOP - TABLE_T - 4, TABLE_D / 2 - 30); scene.add(edge);
}
{
  const sc = key.shadow.camera;
  sc.left = -TABLE_W / 2 - 200; sc.right = TABLE_W / 2 + 200; sc.top = TABLE_D / 2 + 700; sc.bottom = -TABLE_D / 2 - 700;
  sc.near = 10; sc.far = 4000; sc.updateProjectionMatrix();
  key.position.set(350, TABLE_TOP + 1600, 700); key.target.position.set(0, TABLE_TOP, 0);
}

// Lineal auf dem Tisch
let ruler = null;
function rulerTexture(cm) {
  const pxPerCm = 60, c = document.createElement('canvas');
  c.width = Math.min(8192, cm * pxPerCm + 40); c.height = 180;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f4ec'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1d1d1f'; g.strokeStyle = '#1d1d1f';
  for (let mmI = 0; mmI <= cm * 10; mmI++) {
    const x = 20 + mmI * pxPerCm / 10;
    const len = mmI % 10 === 0 ? 70 : mmI % 5 === 0 ? 48 : 28;
    g.lineWidth = mmI % 10 === 0 ? 3 : 1.5;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, len); g.stroke();
    if (mmI % 10 === 0) { g.font = '600 40px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(String(mmI / 10), x, 118); }
  }
  g.font = '500 28px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('cm', c.width - 16, 166);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function buildRuler(lengthMm) {
  if (ruler) {
    scene.remove(ruler); ruler.geometry.dispose();
    ruler.material.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
  }
  const cm = Math.ceil(lengthMm / 10);
  const len = cm * 10 + 20 / 6 * 2;
  const side = () => new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.6 });
  const mats = [side(), side(), new THREE.MeshStandardMaterial({ map: rulerTexture(cm), roughness: 0.6 }), side(), side(), side()];
  ruler = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, 30), mats);
  ruler.position.set(0, TABLE_TOP + 0.6, 72);
  ruler.receiveShadow = true;
  ruler.visible = state.grid;
  scene.add(ruler);
}

// Acryl-Ständer (nur bei 1 Gerät)
const acrylMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, metalness: 0, depthWrite: false });
let stands = [];

// ---------------------------------------------------------------- Geräte
const devices = []; // { phone, rot:{x,y}, target:{x,y}, x }
let fitPending = true;
let L = { lift: 20, total: 300, maxH: 150 };
const isSingle = () => devices.filter(Boolean).length === 1;

function buildDevice(i) {
  const slot = state.slots[i];
  const old = devices[i];
  if (old) { scene.remove(old.phone.group); old.phone.dispose(); }
  const phone = new Phone(byId(slot.id), slot.c);
  phone.group.rotation.order = 'XYZ';
  if (phone.p.foldable) { phone.fold = phone.foldTarget = state.fold; phone.applyFold(); }
  phone.setOn(state.display === 'on');
  const keep = old ? { rot: old.rot, target: old.target, x: old.x } : { rot: { x: 0, y: 0 }, target: { x: 0, y: 0 }, x: 0 };
  if (!old && state.sync && devices.find(Boolean)) {
    const ref = devices.find(Boolean); keep.rot = { ...ref.rot }; keep.target = { ...ref.target };
  }
  devices[i] = { phone, ...keep };
  scene.add(phone.group);
}

function syncDevices() {
  for (let i = 0; i < 4; i++) {
    if (i < state.n) { if (!devices[i] || devices[i].phone.p.id !== state.slots[i].id) buildDevice(i); }
    else if (devices[i]) { scene.remove(devices[i].phone.group); devices[i].phone.dispose(); devices[i] = null; }
  }
  // Bei 1 Gerät dreht die Kamera um das Gerät (der Raum dreht sich scheinbar mit) – Gerät selbst bleibt gerade
  if (isSingle()) devices.filter(Boolean).forEach((d) => { d.target = { x: 0, y: 0 }; d.rot = { x: 0, y: 0 }; });
  $('#duoCtl').hidden = !state.slots.slice(0, state.n).some((s) => byId(s.id).foldable);
  computeLayout();
  fitPending = true;
}

// Feste Plätze: jede Position bietet Platz für die maximale Drehung (und das aufgeklappte Duo)
function computeLayout() {
  const act = devices.filter(Boolean);
  const single = act.length === 1;
  const spans = act.map((d) => {
    const p = d.phone.p, wMax = p.foldable ? p.wOpen : p.w;
    return single ? wMax : Math.hypot(wMax, p.foldable ? p.h * 0.5 : p.d * 3);
  });
  const total = spans.reduce((a, b) => a + b, 0) + GAP * (act.length - 1);
  const maxH = Math.max(...act.map((d) => d.phone.p.h));
  const lift = single ? 14 : Math.max(...act.map((d) => {
    const p = d.phone.p, wMax = p.foldable ? p.wOpen : p.w;
    return Math.hypot(p.h, wMax, p.d) / 2 - p.h / 2;
  })) + 10;
  let x = -total / 2;
  act.forEach((d, k) => { d.x = x + spans[k] / 2; x += spans[k] + GAP; });
  buildRuler(Math.max(200, total + 40));
  stands.forEach((s) => { scene.remove(s); s.geometry.dispose(); }); stands = [];
  if (single) {
    const p = act[0].phone.p;
    const sw = Math.min(46, (p.foldable ? p.wOpen : p.w) * 0.55);
    const s = new THREE.Mesh(new THREE.BoxGeometry(sw, lift, 32), acrylMat);
    s.position.set(act[0].x, TABLE_TOP + lift / 2, 0);
    scene.add(s); stands.push(s);
  }
  L = { lift, total, maxH };
  act.forEach((d) => d.phone.group.position.set(d.x, TABLE_TOP + lift + d.phone.p.h / 2, 0));
  buildPlaques();
}

function viewTarget() { return new THREE.Vector3(0, TABLE_TOP + (L.lift + L.maxH) / 2 - 25, 40); }

// Freier Bereich zwischen schwebender Leiste oben und Geräte-Karten unten
function uiInsets() {
  const H = stage.clientHeight;
  const tb = document.querySelector('.toolbar').getBoundingClientRect();
  const sl = document.querySelector('.slots').getBoundingClientRect();
  const top = Math.min(H * 0.3, tb.bottom + 8);
  const bottom = Math.min(H * 0.4, H - sl.top + 8);
  return { top, bottom };
}
function applyViewOffset() {
  const W = stage.clientWidth, H = stage.clientHeight;
  const { top, bottom } = uiInsets();
  camera.setViewOffset(W, H, 0, (bottom - top) / 2, W, H);
  camera.updateProjectionMatrix();
  return { freeH: H - top - bottom, H };
}
function fitCamera(animate = true, dirOverride = null) {
  const { total, maxH, lift } = L;
  const { freeH, H } = applyViewOffset();
  const hScale = H / Math.max(200, freeH);            // nur der freie Bereich zählt
  const aspect = stage.clientWidth / stage.clientHeight;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hNeed = maxH + lift + 70;                       // inkl. Namensschilder auf dem Tisch
  const distH = (hNeed * 1.02 * hScale) / (2 * Math.tan(vfov / 2));
  const distW = (Math.max(total, 180) * 1.12) / (2 * Math.tan(vfov / 2) * aspect);
  const dist = Math.max(distH, distW, 260);
  let dir = dirOverride || camera.position.clone().sub(controls.target).normalize();
  if (dir.lengthSq() < 0.5) dir = new THREE.Vector3(0, 0.16, 1).normalize();
  const tgt = viewTarget();
  camAnim = { from: camera.position.clone(), fromT: controls.target.clone(), to: dir.clone().multiplyScalar(dist).add(tgt), toT: tgt, t: animate ? 0 : 1 };
}
let camAnim = null;

function setView(v) {
  const [x, y] = VIEWS[v] || VIEWS.front;
  const act = devices.filter(Boolean);
  let dir = new THREE.Vector3(0, 0.16, 1).normalize();
  if (act.length === 1) {
    // Kamera um das Gerät bewegen (Tisch & Raum bleiben fest)
    const pitch = THREE.MathUtils.clamp(x, -1.45, 1.45) || 0.16;
    dir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(-pitch, -y, 0, 'YXZ'));
    if (Math.abs(x) < 0.01) dir.y = 0.16;
    dir.normalize();
  } else act.forEach((d) => { d.target.x = x; d.target.y = y; });
  camAnim = null;
  fitCamera(true, dir);
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
}

// ---------------------------------------------------------------- Pointer
const BTN_NAMES = {
  pwr: 'Seitentaste – Display an/aus', home: 'Home-Taste', volup: 'Lauter', voldown: 'Leiser',
  mute: 'Klingeln/Stumm-Schalter', action: 'Action-Taste – Taschenlampe', cc: 'Kamerasteuerung',
};
function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const objs = devices.filter(Boolean).flatMap((d) => d.phone.pickables);
  const hit = raycaster.intersectObjects(objs, false)[0];
  return hit ? hit.object.userData : null;
}

function onPointerDown(ev) {
  const u = pick(ev);
  if (!u) return; // Hintergrund → OrbitControls
  if (u.part === 'btn') {
    controls.enabled = false;
    renderer.domElement.setPointerCapture(ev.pointerId);
    u.phone.press(u.btn);
    drag = { mode: 'btn' };
    return;
  }
  if (isSingle()) {
    // 1 Gerät: Ziehen dreht die Kamera um das Gerät (OrbitControls bleibt aktiv), Tippen = Display antippen
    drag = { mode: 'orbit', phone: u.phone, part: u.part, x: ev.clientX, y: ev.clientY, moved: 0 };
    return;
  }
  controls.enabled = false;
  renderer.domElement.setPointerCapture(ev.pointerId);
  drag = { mode: 'rot', phone: u.phone, part: u.part, x: ev.clientX, y: ev.clientY, moved: 0 };
}
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (drag && (drag.mode === 'rot' || drag.mode === 'orbit')) {
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.x = ev.clientX; drag.y = ev.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 4) document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.remove('on'));
    if (drag.mode === 'orbit') return;
    const act = devices.filter(Boolean);
    const list = state.sync ? act : act.filter((d) => d.phone === drag.phone);
    list.forEach((d) => {
      d.target.y += dx * 0.011;
      d.target.x = THREE.MathUtils.clamp(d.target.x + dy * 0.011, -Math.PI / 2, Math.PI / 2);
      d.rot.y = d.target.y; d.rot.x = d.target.x;
    });
    return;
  }
  if (drag) return;
  hoverEv = ev;
});
let hoverEv = null;
function doHover() {
  if (!hoverEv) return;
  const ev = hoverEv; hoverEv = null;
  const u = pick(ev);
  const tip = $('#tip');
  const r = stage.getBoundingClientRect();
  if (u && u.part === 'btn') {
    renderer.domElement.style.cursor = 'pointer';
    let name = BTN_NAMES[u.btn];
    if (u.btn === 'pwr' && u.phone.p.pwr === 'top') name = 'Standby-Taste – Display an/aus';
    if (u.btn === 'pwr' && u.phone.p.foldable) name = 'Seitentaste mit Touch ID';
    if (u.btn === 'home' && u.phone.p.bio.startsWith('Touch')) name = 'Home-Taste mit Touch ID';
    tip.textContent = name; tip.hidden = false;
    tip.style.left = `${ev.clientX - r.left}px`; tip.style.top = `${ev.clientY - r.top}px`;
  } else {
    renderer.domElement.style.cursor = u ? 'grab' : 'default';
    tip.hidden = true;
  }
}
function endDrag(ev) {
  if (!drag) return;
  if ((drag.mode === 'rot' || drag.mode === 'orbit') && drag.moved < 5 && drag.part === 'screen') drag.phone.tapScreen();
  drag = null;
  controls.enabled = true;
  try { renderer.domElement.releasePointerCapture(ev.pointerId); } catch (e) { /* egal */ }
}
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
renderer.domElement.addEventListener('pointerleave', () => { $('#tip').hidden = true; });

// ---------------------------------------------------------------- Namensschilder auf dem Tisch
// Kleine Aufsteller (wie in einer Ausstellung): Karte auf Acryl-Keil vor jedem Gerät
const plaques = [];
const PLAQUE_Z = 135;
function plaqueInfo(i) {
  const d = devices[i], p = d.phone.p;
  const open = p.foldable && d.phone.fold > 90;
  const dims = p.foldable
    ? (open ? `${mm(p.h)} × ${mm(p.wOpen)} × ${mm(p.dOpen)} mm (offen)` : `${mm(p.h)} × ${mm(p.w)} × ${mm(p.d)} mm (zu)`)
    : `${mm(p.h)} × ${mm(p.w)} × ${mm(p.d)} mm`;
  const pr = priceOf(state.slots[i]);
  const price = pr.price == null ? 'nur im Vertrag' : state.price === 'real' ? `≈ ${eurR(pr.real)} heute` : eur(pr.price);
  return { name: p.name, line2: `${dims} · ${p.g} g`, line3: `${p.launch.replace(/ \(.*\)/, '')} · ${pr.label} · ${price}`, color: SLOT_COLORS[i], letter: SLOT_LETTERS[i] };
}
function drawPlaque(canvas, info) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#26272b'); grd.addColorStop(1, '#17181b');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = info.color; g.fillRect(0, 0, 22, H);
  g.fillStyle = '#ffffff'; g.textBaseline = 'alphabetic';
  let fs = 92;
  g.font = `700 ${fs}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  while (g.measureText(info.name).width > W - 110 && fs > 50) { fs -= 4; g.font = `700 ${fs}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`; }
  g.fillText(info.name, 60, 128);
  g.fillStyle = '#d7dae0';
  g.font = '500 44px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  g.fillText(info.line2, 60, 208);
  g.fillStyle = '#9aa0ab';
  g.font = '400 40px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  g.fillText(info.line3, 60, 272);
  g.fillStyle = info.color;
  g.beginPath(); g.arc(W - 58, 62, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '700 36px -apple-system, "Segoe UI", Roboto, Arial, sans-serif'; g.textAlign = 'center';
  g.fillText(info.letter, W - 58, 75); g.textAlign = 'left';
}
const plaqueCardMat = () => new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.35, metalness: 0.2 });
const plaqueAcryl = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.04, clearcoat: 1, depthWrite: false });
function buildPlaques() {
  plaques.forEach((q) => { scene.remove(q.group); q.tex.dispose(); q.mat.dispose(); q.group.traverse((o) => o.geometry && o.geometry.dispose()); });
  plaques.length = 0;
  const act = devices.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  const xs = act.map((i) => devices[i].x);
  const spacing = xs.length > 1 ? Math.min(...xs.slice(1).map((x, k) => x - xs[k])) : 200;
  const cw = Math.min(72, spacing - 12), ch = cw * 0.31;
  act.forEach((i) => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 372;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const group = new THREE.Group();
    const tilt = 0.32;
    // Acryl-Keil
    const wedge = new THREE.Shape();
    const sx = ch * Math.sin(tilt), sy = ch * Math.cos(tilt);
    wedge.moveTo(0, 0); wedge.lineTo(-sx - 6, 0); wedge.lineTo(-sx - 1, sy - 1); wedge.lineTo(-sx + 0.5, sy);
    const wg = new THREE.ExtrudeGeometry(wedge, { depth: cw + 6, bevelEnabled: false });
    wg.rotateY(-Math.PI / 2); wg.translate((cw + 6) / 2, 0, 0);
    const wm = new THREE.Mesh(wg, plaqueAcryl); wm.position.z = -1.4; group.add(wm);
    // Karte
    const card = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 1.2), [plaqueCardMat(), plaqueCardMat(), plaqueCardMat(), plaqueCardMat(), mat, plaqueCardMat()]);
    card.position.set(0, (ch / 2) * Math.cos(tilt) + 0.4, -(ch / 2) * Math.sin(tilt) + 0.6);
    card.rotation.x = -tilt; card.castShadow = true;
    group.add(card);
    group.position.set(devices[i].x, TABLE_TOP, PLAQUE_Z);
    scene.add(group);
    plaques.push({ i, group, tex, mat, canvas, key: '' });
  });
}
function updatePlaques() {
  for (const q of plaques) {
    if (!devices[q.i]) continue;
    const info = plaqueInfo(q.i);
    const key = JSON.stringify(info);
    if (key !== q.key) { q.key = key; drawPlaque(q.canvas, info); q.tex.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- Loop
const clock = new THREE.Clock();
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(() => { resize(); fitCamera(false); }).observe(stage);
new ResizeObserver(() => { applyViewOffset(); }).observe(document.querySelector('.slots'));

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now();
  if (fitPending) { fitPending = false; fitCamera(true, new THREE.Vector3(0, 0.16, 1).normalize()); }
  const k = Math.min(1, dt * 8);
  for (const d of devices) {
    if (!d) continue;
    d.rot.x += (d.target.x - d.rot.x) * k;
    d.rot.y += (d.target.y - d.rot.y) * k;
    d.phone.group.rotation.set(d.rot.x, d.rot.y, 0);
    d.phone.update(dt, now);
  }
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 2.2);
    const e = 1 - Math.pow(1 - camAnim.t, 3);
    // auf einer Kugel um das Ziel interpolieren (nicht durch das Gerät hindurch)
    controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e);
    const o1 = camAnim.from.clone().sub(camAnim.fromT), o2 = camAnim.to.clone().sub(camAnim.toT);
    const q = new THREE.Quaternion().setFromUnitVectors(o1.clone().normalize(), o2.clone().normalize());
    const qe = new THREE.Quaternion().slerp(q, e);
    const off = o1.clone().normalize().applyQuaternion(qe).multiplyScalar(THREE.MathUtils.lerp(o1.length(), o2.length(), e));
    camera.position.copy(controls.target).add(off);
    if (camAnim.t >= 1) camAnim = null;
  }
  controls.update();
  doHover();
  renderer.render(scene, camera);
  updatePlaques();
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- UI: Slots
function phoneOptions(sel) {
  const years = [...new Set(PHONES.map((p) => p.year))];
  return years.map((y) => `<optgroup label="${y}">${PHONES.filter((p) => p.year === y)
    .map((p) => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${p.name}</option>`).join('')}</optgroup>`).join('');
}

function renderSlots() {
  const box = $('#slots');
  box.style.setProperty('--n', state.n);
  box.dataset.n = state.n;
  box.innerHTML = '';
  for (let i = 0; i < state.n; i++) {
    const slot = state.slots[i], p = byId(slot.id);
    slot.c = Math.min(slot.c, p.colors.length - 1);
    slot.s = Math.min(slot.s, p.prices.length - 1);
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = `
      <div class="row"><span class="tag" style="background:${SLOT_COLORS[i]}">${SLOT_LETTERS[i]}</span>
        <select class="model" aria-label="Modell ${SLOT_LETTERS[i]}">${phoneOptions(slot.id)}</select></div>
      <div class="row">
        <select class="storage" aria-label="Speicher">${p.prices.map(([l], k) => `<option value="${k}"${k === slot.s ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <div class="swatches">${p.colors.map((c, k) => `<button class="sw${k === slot.c ? ' on' : ''}" data-k="${k}" title="${c[0]}" style="background:${c[1]}"></button>`).join('')}</div>
      </div>
      <div class="cname">${p.colors[slot.c][0]} · ${p.launch}</div>
      <div class="price"></div>`;
    el.querySelector('.model').addEventListener('change', (e) => {
      state.slots[i] = { id: e.target.value, c: 0, s: 0 };
      syncDevices(); renderAll();
    });
    el.querySelector('.storage').addEventListener('change', (e) => { slot.s = +e.target.value; renderAll(); });
    el.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => {
      slot.c = +b.dataset.k; buildDevice(i); computeLayout(); renderAll();
    }));
    box.appendChild(el);
  }
  updateSlotPrices();
}
function updateSlotPrices() {
  document.querySelectorAll('#slots .slot').forEach((el, i) => {
    const pr = priceOf(state.slots[i]), p = byId(state.slots[i].id);
    const main = state.price === 'real' ? pr.real : pr.price;
    let sub;
    if (pr.price == null) sub = 'nur mit Vertrag';
    else if (state.price === 'real') sub = `damals ${eur(pr.price)} (${p.year}) · heutige Kaufkraft`;
    else sub = `UVP zum Start · ${pr.label}`;
    el.querySelector('.price').innerHTML = `<b>${state.price === 'real' ? (main == null ? '–' : '≈ ' + eurR(main)) : eur(main)}</b><small>${sub}</small>`;
  });
}

// ---------------------------------------------------------------- UI: Tabelle
function screenRatio(p) {
  const d = (diag, res) => { const a = res[1] / res[0], w = (diag * 25.4) / Math.sqrt(1 + a * a); return w * w * a; };
  if (p.foldable) return (d(p.diagInner, p.resInner.slice().reverse()) / (p.h * p.wOpen)) * 100;
  // abgerundete Ecken grob berücksichtigen
  return ((d(p.diag, p.res) - (p.screenCorner ? (4 - Math.PI) * p.screenCorner ** 2 : 0)) / (p.h * p.w)) * 100;
}
function buttonsOf(p) {
  const b = [];
  if (p.front === 'home') b.push(p.bio.startsWith('Touch') ? 'Home-Taste mit Touch ID' : 'Home-Taste');
  b.push(p.pwr === 'top' ? 'Standby-Taste oben' : p.foldable ? 'Seitentaste mit Touch ID' : 'Seitentaste');
  b.push(p.vol === 'top' ? 'Lautstärke oben' : 'Lautstärke +/−');
  if (p.sw === 'mute') b.push('Stummschalter');
  if (p.sw === 'action') b.push('Action-Taste');
  if (p.cc) b.push('Kamerasteuerung');
  return b.join(', ');
}

const ROWS = [
  { k: 'Marktstart', f: (p) => ({ t: p.launch }) },
  { k: 'Preis', price: true },
  { k: 'Speicher', f: (p) => ({ t: p.prices.map((x) => x[0]).join(' · ') }) },
  { k: 'Höhe', f: (p) => ({ t: `${mm(p.h)} mm`, n: p.h }), bar: true },
  { k: 'Breite', f: (p) => ({ t: p.foldable ? `${mm(p.w)} mm zu · ${mm(p.wOpen)} mm auf` : `${mm(p.w)} mm`, n: p.w }), bar: true },
  { k: 'Dicke', f: (p) => ({ t: p.foldable ? `${mm(p.d)} mm zu · ${mm(p.dOpen)} mm auf` : `${mm(p.d)} mm`, n: p.d }), better: 'low', bar: true },
  { k: 'Gewicht', f: (p) => ({ t: `${p.g} g`, n: p.g }), better: 'low', bar: true, unit: 'g' },
  { k: 'Display', f: (p) => ({ t: p.foldable ? `${nf(p.diagInner, 1)}″ innen · ${nf(p.diag, 1)}″ außen` : `${nf(p.diag, 1)}″`, n: p.foldable ? p.diagInner : p.diag, sub: `${p.disp}${p.hz > 60 ? ` · ${p.hz} Hz` : ''}` }), better: 'high', bar: true },
  { k: 'Auflösung', f: (p) => ({ t: p.foldable ? `${p.resInner[0]} × ${p.resInner[1]} innen` : `${p.res[1]} × ${p.res[0]}`, n: p.foldable ? p.ppiInner : p.ppi, sub: p.foldable ? `${p.ppiInner} ppi innen · ${p.res[1]} × ${p.res[0]} außen` : `${p.ppi} ppi` }), better: 'high' },
  { k: 'Displayanteil Front', f: (p) => { const r = screenRatio(p); return { t: `≈ ${nf(r)} %`, n: r }; }, better: 'high', bar: true },
  { k: 'Chip', f: (p) => ({ t: p.chip }) },
  { k: 'Kamera hinten', f: (p) => ({ t: p.cam, sub: `${p.camCount} Objektiv${p.camCount > 1 ? 'e' : ''}${p.lidar ? ' + LiDAR' : ''}` }) },
  { k: 'Entsperren', f: (p) => ({ t: p.bio }) },
  { k: 'Tasten', f: (p) => ({ t: buttonsOf(p) }) },
  { k: 'Anschluss', f: (p) => ({ t: p.port, sub: p.jack ? 'mit 3,5-mm-Klinke' : 'ohne Klinke' }) },
  { k: 'Laden', f: (p) => ({ t: p.charge }) },
  { k: 'Mobilfunk', f: (p) => ({ t: p.net }) },
  { k: 'Wasserschutz', f: (p) => ({ t: p.ip }) },
  { k: 'Material', f: (p) => ({ t: p.mat }) },
  { k: 'Neu bei diesem Modell', feat: true },
];

function renderTable() {
  const act = state.slots.slice(0, state.n);
  const ps = act.map((s) => byId(s.id));
  let html = `<thead><tr><th></th>${ps.map((p, i) => `<th><span style="color:${SLOT_COLORS[i]}">${SLOT_LETTERS[i]}</span> · ${p.name}</th>`).join('')}</tr></thead><tbody>`;
  for (const row of ROWS) {
    html += `<tr><th>${row.k}</th>`;
    if (row.price) {
      const prs = act.map(priceOf);
      const vals = prs.map((x) => (state.price === 'real' ? x.real : x.price));
      const valid = vals.filter((v) => v != null);
      const best = valid.length > 1 ? Math.min(...valid) : null;
      const max = Math.max(...valid, 1);
      prs.forEach((x, i) => {
        const v = vals[i], p = ps[i];
        let sub;
        if (v == null) sub = p.priceNote || '';
        else if (state.price === 'real') sub = `damals ${eur(x.price)} (${x.label}, ${p.year}) × ${nf(x.factor, 2)} Inflation`;
        else sub = `${x.label}${p.priceNote ? ' · ' + p.priceNote : ''}`;
        const main = v == null ? (p.prices[0][1] == null ? 'nur im Vertrag' : '–') : state.price === 'real' ? '≈ ' + eurR(v) : eur(v);
        html += `<td class="${v != null && v === best ? 'best' : ''}"><div class="main">${main}</div><div class="sub">${sub}</div>${v != null ? `<div class="bar"><i style="width:${(v / max) * 100}%"></i></div>` : ''}</td>`;
      });
    } else if (row.feat) {
      ps.forEach((p) => { html += `<td><ul>${p.feat.map((f) => `<li>${f}</li>`).join('')}</ul></td>`; });
    } else {
      const cells = ps.map((p) => row.f(p));
      const nums = cells.map((c) => c.n).filter((n) => typeof n === 'number');
      let best = null;
      if (row.better && nums.length > 1 && new Set(nums).size > 1) best = row.better === 'low' ? Math.min(...nums) : Math.max(...nums);
      const max = Math.max(...nums, 0.0001);
      cells.forEach((c, i) => {
        let delta = '';
        if (row.unit && i > 0 && typeof c.n === 'number' && typeof cells[0].n === 'number' && c.n !== cells[0].n) {
          const d = c.n - cells[0].n; delta = `<span class="delta">${d > 0 ? '+' : '−'}${nf(Math.abs(d))} ${row.unit} ggü. A</span>`;
        }
        html += `<td class="${best != null && c.n === best ? 'best' : ''}"><div class="main">${c.t}${delta}</div>${c.sub ? `<div class="sub">${c.sub}</div>` : ''}${row.bar && typeof c.n === 'number' ? `<div class="bar"><i style="width:${(c.n / max) * 100}%"></i></div>` : ''}</td>`;
      });
    }
    html += '</tr>';
  }
  html += '</tbody>';
  $('#specTable').innerHTML = html;
  $('#priceNote').textContent = state.price === 'real'
    ? `Inflationsbereinigt: Startpreis × (VPI ${VPI_NOW.label} ÷ VPI im Erscheinungsjahr), Verbraucherpreisindex Deutschland (Destatis). Grüne Werte = jeweils bester Wert im Vergleich.`
    : 'Preise: deutsche Apple-UVP zum Marktstart für die gewählte Speichervariante. Grüne Werte = jeweils bester Wert im Vergleich.';
}

// ---------------------------------------------------------------- UI: Toolbar
function segSet(id, v) { document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === String(v))); }
function renderAll() {
  renderSlots();
  renderTable();
  segSet('countSeg', state.n);
  segSet('screenSeg', state.display);
  segSet('priceSeg', state.price);
  segSet('foldSeg', state.fold);
  $('#foldRange').value = state.fold;
  $('#foldVal').textContent = `${Math.round(state.fold)}°`;
  writeHash();
}
function setFoldAll(a) {
  state.fold = a;
  devices.forEach((d) => { if (d && d.phone.p.foldable) d.phone.setFoldTarget(a); });
  segSet('foldSeg', Math.round(a)); $('#foldRange').value = a; $('#foldVal').textContent = `${Math.round(a)}°`;

  writeHash();
}

document.querySelectorAll('#countSeg button').forEach((b) => b.addEventListener('click', () => { state.n = +b.dataset.v; syncDevices(); renderAll(); }));
document.querySelectorAll('#screenSeg button').forEach((b) => b.addEventListener('click', () => {
  state.display = b.dataset.v; devices.forEach((d) => d && d.phone.setOn(state.display === 'on')); renderAll();
}));
document.querySelectorAll('#viewSeg button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
document.querySelectorAll('#priceSeg button').forEach((b) => b.addEventListener('click', () => { state.price = b.dataset.v; renderAll(); }));
document.querySelectorAll('#foldSeg button').forEach((b) => b.addEventListener('click', () => setFoldAll(+b.dataset.v)));
$('#foldRange').addEventListener('input', (e) => setFoldAll(+e.target.value));
$('#syncTog').addEventListener('change', (e) => { state.sync = e.target.checked; });
$('#gridTog').addEventListener('change', (e) => { state.grid = e.target.checked; if (ruler) ruler.visible = state.grid; });
$('#resetBtn').addEventListener('click', () => setView('front'));
const specsPanel = $('#specsPanel'), specsBtn = $('#specsBtn');
const setSpecs = (open) => { specsPanel.hidden = !open; specsBtn.setAttribute('aria-expanded', String(open)); };
specsBtn.addEventListener('click', () => setSpecs(specsPanel.hidden));
$('#specsClose').addEventListener('click', () => setSpecs(false));
$('#helpBtn').addEventListener('click', () => { $('#help').hidden = !$('#help').hidden; });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setSpecs(false); $('#help').hidden = true; } });

// ---------------------------------------------------------------- Start
readHash();
syncDevices();
renderAll();
resize();
setView('front');
tick();

// Für Tests / Konsole
window.__iphone = { camera, controls, setView, setFoldAll, devices, state, press: (i, b) => devices[i].phone.press(b), tap: (i) => devices[i].phone.tapScreen() };
