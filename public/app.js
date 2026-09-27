// ============================================================================
// iPhone-Vergleich – Szene, Steuerung, Vergleichstabelle
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { PHONES, VPI_NOW, vpiFor } from './data.js';
import { Phone } from './phone.js';
import { buildShowroom, TABLE_TOP, TABLE_W, TABLE_D } from './showroom.js';

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
  auto: false,
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
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.background = new THREE.Color(0xe9e6e1);
scene.fog = new THREE.Fog(0xe9e6e1, 9000, 22000);

const key = new THREE.DirectionalLight(0xfff8f0, 1.1);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.6;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xeef4ff, 0.55); rim.position.set(4000, 1500, 800); scene.add(rim);   // Tageslicht vom Schaufenster
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cbb8, 0.55));

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
controls.maxDistance = 3200;
controls.maxPolarAngle = Math.PI * 0.62;
controls.target.set(0, 0, 0);

// ---------------------------------------------------------------- Showroom
const showroom = buildShowroom(scene, renderer);
showroom.bake();                       // Raum-Reflexionen für Geräte & Tisch
{
  const sc = key.shadow.camera;
  sc.left = -TABLE_W / 2 - 300; sc.right = TABLE_W / 2 + 300; sc.top = TABLE_D / 2 + 900; sc.bottom = -TABLE_D / 2 - 900;
  sc.near = 10; sc.far = 6000; sc.updateProjectionMatrix();
  key.position.set(500, TABLE_TOP + 2600, 1100); key.target.position.set(0, TABLE_TOP, 0);
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
  if (state.auto && !document.body.classList.contains('present')) setAuto(false);
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
  controls.autoRotate = state.auto && isSingle() && !drag;
  controls.autoRotateSpeed = 1.2;
  if (state.auto && !isSingle() && !drag) devices.forEach((d) => { if (d) { d.target.y += dt * 0.45; d.rot.y = d.target.y; } });
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

// Stärken eines Geräts im aktuellen Vergleich (für Beratung: "Was spricht für dieses Modell?")
function strengths(ps, prices) {
  const n = ps.length, out = ps.map(() => []);
  if (n < 2) return out;
  const pick = (vals, better, label, fmt) => {
    const valid = vals.filter((v) => typeof v === 'number');
    if (valid.length < 2 || new Set(valid).size < 2) return;
    const best = better === 'low' ? Math.min(...valid) : Math.max(...valid);
    const sorted = [...valid].sort((x, y) => (better === 'low' ? x - y : y - x));
    const second = sorted.find((v) => v !== best);
    vals.forEach((v, i) => { if (v === best) out[i].push(label + (fmt ? ` (${fmt(best, second)})` : '')); });
  };
  pick(ps.map((p) => (p.foldable ? p.diagInner : p.diag)), 'high', 'Größtes Display', (a, b) => `+${nf(a - b, 1)}″`);
  pick(ps.map((p) => p.video), 'high', 'Längste Akkulaufzeit', (a, b) => `+${a - b} h Video`);
  pick(ps.map((p) => p.g), 'low', 'Am leichtesten', (a, b) => `−${b - a} g`);
  pick(ps.map((p) => (p.foldable ? p.dOpen : p.d)), 'low', 'Am dünnsten', (a, b) => `${mm(a)} mm`);
  pick(prices, 'low', 'Günstigster Preis', (a, b) => `−${eurR(b - a)}`);
  pick(ps.map((p) => p.camCount + (p.lidar ? 0.5 : 0)), 'high', 'Meiste Kameras', null);
  pick(ps.map((p) => p.hz), 'high', 'ProMotion 120 Hz', null);
  pick(ps.map((p) => p.year), 'high', 'Neuestes Modell', null);
  pick(ps.map((p) => (/USB 3/.test(p.port) ? 2 : /USB-C/.test(p.port) ? 1 : 0)), 'high', 'Schnellster Anschluss', null);
  pick(ps.map((p) => (p.foldable ? 1 : 0)), 'high', 'Faltbar – Tablet-Display', null);
  return out;
}

const SECTIONS = [
  ['Auf einen Blick', [
    { k: 'Highlights', feat: true },
    { k: 'Stärken im Vergleich', strengths: true },
    { k: 'Preis', price: true },
    { k: 'Speicher', f: (p) => ({ t: p.prices.map((x) => x[0]).join(' · ') }) },
  ]],
  ['Display & Größe', [
    { k: 'Display', f: (p) => ({ t: p.foldable ? `${nf(p.diagInner, 1)}″ innen · ${nf(p.diag, 1)}″ außen` : `${nf(p.diag, 1)}″`, n: p.foldable ? p.diagInner : p.diag, sub: `${p.disp}${p.hz > 60 ? ` · ${p.hz} Hz` : ' · 60 Hz'}` }), better: 'high', bar: true },
    { k: 'Maße (H × B × T)', f: (p) => ({ t: p.foldable ? `${mm(p.h)} × ${mm(p.w)} × ${mm(p.d)} mm zu` : `${mm(p.h)} × ${mm(p.w)} × ${mm(p.d)} mm`, sub: p.foldable ? `${mm(p.h)} × ${mm(p.wOpen)} × ${mm(p.dOpen)} mm aufgeklappt` : '' }) },
    { k: 'Gewicht', f: (p) => ({ t: `${p.g} g`, n: p.g }), better: 'low', bar: true, unit: 'g' },
    { k: 'Displayanteil Front', f: (p) => { const r = screenRatio(p); return { t: `≈ ${nf(r)} %`, n: r }; }, better: 'high', bar: true },
    { k: 'Auflösung', f: (p) => ({ t: p.foldable ? `${p.resInner[0]} × ${p.resInner[1]} innen` : `${p.res[1]} × ${p.res[0]}`, n: p.foldable ? p.ppiInner : p.ppi, sub: p.foldable ? `${p.ppiInner} ppi innen · ${p.res[1]} × ${p.res[0]} außen` : `${p.ppi} ppi` }), better: 'high' },
  ]],
  ['Kamera, Leistung & Akku', [
    { k: 'Kamera hinten', f: (p) => ({ t: p.cam, n: p.camCount + (p.lidar ? 0.5 : 0), sub: `${p.camCount} Objektiv${p.camCount > 1 ? 'e' : ''}${p.lidar ? ' + LiDAR' : ''}` }), better: 'high' },
    { k: 'Chip', f: (p) => ({ t: p.chip }) },
    { k: 'Akku (Video)', f: (p) => ({ t: p.video ? `bis zu ${p.video} h${p.videoOuter ? ` innen · ${p.videoOuter} h außen` : ''}` : '–', n: p.video, sub: p.video ? 'Videowiedergabe laut Apple' : '' }), better: 'high', bar: true, unit: 'h' },
    { k: 'Laden', f: (p) => ({ t: p.charge }) },
  ]],
  ['Ausstattung', [
    { k: 'Entsperren', f: (p) => ({ t: p.bio }) },
    { k: 'Anschluss', f: (p) => ({ t: p.port, sub: p.jack ? 'mit 3,5-mm-Klinke' : 'ohne Klinke' }) },
    { k: 'Mobilfunk', f: (p) => ({ t: p.net }) },
    { k: 'Wasserschutz', f: (p) => ({ t: p.ip }) },
    { k: 'Material', f: (p) => ({ t: p.mat }) },
    { k: 'Tasten', f: (p) => ({ t: buttonsOf(p) }) },
    { k: 'Marktstart', f: (p) => ({ t: p.launch }) },
  ]],
];

function renderTable() {
  const act = state.slots.slice(0, state.n);
  const ps = act.map((s) => byId(s.id));
  const prs = act.map(priceOf);
  const pvals = prs.map((x) => (state.price === 'real' ? x.real : x.price));
  const str = strengths(ps, pvals);
  const cols = ps.length + 1;
  specsPanel.style.setProperty('--specs-w', `${170 + ps.length * 270}px`);
  let html = `<colgroup><col class="lab">${ps.map(() => '<col>').join('')}</colgroup><thead><tr><th></th>${ps.map((p, i) => `<th><span class="dot" style="background:${SLOT_COLORS[i]}">${SLOT_LETTERS[i]}</span>${p.name}</th>`).join('')}</tr></thead><tbody>`;
  for (const [title, rows] of SECTIONS) {
    html += `<tr class="sec"><th colspan="${cols}">${title}</th></tr>`;
    for (const row of rows) {
      if (row.strengths && ps.length < 2) continue;
      html += `<tr><th>${row.k}</th>`;
      if (row.price) {
        const valid = pvals.filter((v) => v != null);
        const best = valid.length > 1 ? Math.min(...valid) : null;
        const max = Math.max(...valid, 1);
        prs.forEach((x, i) => {
          const v = pvals[i], p = ps[i];
          let sub;
          if (v == null) sub = p.priceNote || '';
          else if (state.price === 'real') sub = `damals ${eur(x.price)} (${x.label}, ${p.year}) × ${nf(x.factor, 2)} Inflation`;
          else sub = `${x.label}${p.priceNote ? ' · ' + p.priceNote : ''}`;
          const main = v == null ? (p.prices[0][1] == null ? 'nur im Vertrag' : '–') : state.price === 'real' ? '≈ ' + eurR(v) : eur(v);
          html += `<td class="${v != null && v === best ? 'best' : ''}"><div class="main big">${main}</div><div class="sub">${sub}</div>${v != null ? `<div class="bar"><i style="width:${(v / max) * 100}%"></i></div>` : ''}</td>`;
        });
      } else if (row.feat) {
        ps.forEach((p) => { html += `<td><div class="chips">${p.feat.map((f) => `<span class="chip">${f}</span>`).join('')}</div></td>`; });
      } else if (row.strengths) {
        str.forEach((list) => { html += `<td>${list.length ? `<ul class="plus">${list.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<span class="sub">–</span>'}</td>`; });
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
  }
  html += '</tbody>';
  $('#specTable').innerHTML = html;
  $('#priceNote').textContent = state.price === 'real'
    ? `Inflationsbereinigt: Startpreis × (VPI ${VPI_NOW.label} ÷ VPI im Erscheinungsjahr), Verbraucherpreisindex Deutschland (Destatis). Grün = bester Wert im Vergleich.`
    : 'Preise: deutsche Apple-UVP zum Marktstart für die gewählte Speichervariante. Grün = bester Wert im Vergleich.';
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
$('#autoTog').addEventListener('change', (e) => setAuto(e.target.checked));
function setAuto(on) {
  state.auto = on; $('#autoTog').checked = on;
  controls.autoRotate = on && isSingle();
}
// Präsentationsmodus: Bedienelemente ausblenden, Vollbild, Drehteller an
function setPresent(on) {
  document.body.classList.toggle('present', on);
  if (on) { setSpecs(false); $('#help').hidden = true; setAuto(true); document.documentElement.requestFullscreen?.().catch(() => {}); }
  else { setAuto(false); if (document.fullscreenElement) document.exitFullscreen?.(); }
  setTimeout(() => setView(isSingle() ? 'three' : 'front'), 80);
}
$('#presentBtn').addEventListener('click', () => setPresent(true));
$('#presentExit').addEventListener('click', () => setPresent(false));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('present')) setPresent(false); });
$('#resetBtn').addEventListener('click', () => setView('front'));
const specsPanel = $('#specsPanel'), specsBtn = $('#specsBtn');
const setSpecs = (open) => { specsPanel.hidden = !open; specsBtn.setAttribute('aria-expanded', String(open)); };
specsBtn.addEventListener('click', () => setSpecs(specsPanel.hidden));
$('#specsClose').addEventListener('click', () => setSpecs(false));
$('#helpBtn').addEventListener('click', () => { $('#help').hidden = !$('#help').hidden; });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setSpecs(false); $('#help').hidden = true; } if (e.key === 'p' && !e.target.closest('select,input')) setPresent(!document.body.classList.contains('present')); });

// ---------------------------------------------------------------- Start
readHash();
syncDevices();
renderAll();
resize();
setView('front');
tick();

// Für Tests / Konsole
window.__iphone = { camera, controls, setView, setFoldAll, devices, state, press: (i, b) => devices[i].phone.press(b), tap: (i) => devices[i].phone.tapScreen() };
