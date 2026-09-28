// ============================================================================
// iPhone-Vergleich – Szene, Steuerung, Vergleich & Upgrade-Beratung
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { PHONES, VPI_NOW, vpiFor } from './data.js';
import { Phone } from './phone.js';
import { keyValues, bestIndices, upgradeGains, LINEUP, defaultTargets } from './insights.js';
import { openPicker, closePicker } from './picker.js';
import { thumbFor } from './thumbs.js';
import { initAdmin, tkPrice, tkInfo } from './admin.js';
import { printSheet } from './print.js';

const $ = (s) => document.querySelector(s);
const byId = (id) => PHONES.find((p) => p.id === id) || PHONES[PHONES.length - 1];
const SLOT_COLORS = ['#4f8cff', '#f2994a', '#3ecf8e', '#c77dff'];
const SLOT_LETTERS = ['A', 'B', 'C', 'D'];
const GAP = 30; // mm zwischen den Geräten
const DEFAULT_DIR = () => new THREE.Vector3(0, 0.25, 1).normalize();

// ---------------------------------------------------------------- Ladebildschirm
const loaderBar = $('#loaderBar'), loaderStep = $('#loaderStep');
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
async function loadStep(pct, txt) { loaderBar.style.width = `${pct}%`; loaderStep.textContent = txt; await nextFrame(); }
await loadStep(8, 'Lade 3D-Engine …');

const VIEWS = {
  front: [0, 0], back: [0, Math.PI], left: [0, Math.PI / 2], right: [0, -Math.PI / 2],
  top: [Math.PI / 2, 0], bottom: [-Math.PI / 2, 0], three: [0.28, -0.62],
};

// ---------------------------------------------------------------- Zustand
const store = {
  get(k, d) { try { const v = localStorage.getItem('iphone.' + k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('iphone.' + k, v); } catch { /* egal */ } },
};
const state = {
  mode: 'compare',
  n: 2,
  slots: [
    { id: '18pro', c: 0, s: 0 },
    { id: 'duo', c: 1, s: 0 },
    { id: 'iphone', c: 0, s: 0 },
    { id: 'air', c: 3, s: 0 },
  ],
  up: [{ id: '12', c: 0, s: 0 }, { id: '18pro', c: 0, s: 0 }, { id: '17e', c: 0, s: 0 }],
  display: 'on',
  price: 'nom',
  fold: 180,
  sync: true,
  auto: false,
  diff: store.get('diff', '0') === '1',
  night: store.get('night', 'day') === 'night',
  focus: null,
};
const active = () => (state.mode === 'upgrade' ? state.up : state.slots.slice(0, state.n));

function parseSlots(str) {
  return str.split(',').slice(0, 4).map((x) => { const [id, c, s] = x.split('.'); return { id, c: +c || 0, s: +s || 0 }; })
    .filter((x) => PHONES.some((p) => p.id === x.id));
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const n = parseInt(h.get('n'), 10);
  if (n >= 1 && n <= 4) state.n = n;
  if (h.get('s')) parseSlots(h.get('s')).forEach((x, i) => { state.slots[i] = x; });
  if (h.get('u')) { const u = parseSlots(h.get('u')); if (u.length >= 2) state.up = u; }
  if (h.get('m') === 'up') state.mode = 'upgrade';
  if (h.get('d') === 'off' || h.get('d') === 'on') state.display = h.get('d');
  if (h.get('p') === 'real' || h.get('p') === 'nom') state.price = h.get('p');
  const f = parseInt(h.get('f'), 10);
  if (f >= 0 && f <= 180) state.fold = f;
}
function writeHash() {
  const enc = (arr) => arr.map((x) => `${x.id}.${x.c}.${x.s}`).join(',');
  history.replaceState(null, '', `#m=${state.mode === 'upgrade' ? 'up' : 'cmp'}&n=${state.n}&s=${enc(state.slots)}&u=${enc(state.up)}&d=${state.display}&p=${state.price}&f=${Math.round(state.fold)}`);
}

// ---------------------------------------------------------------- Formatierung & Preise
const nf = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const mm = (v) => nf(v, v % 1 ? (Math.round(v * 100) % 10 ? 2 : 1) : 0);
const eur = (v) => (v == null ? '–' : `${nf(v, v % 1 ? 2 : 0)} €`);
const eurR = (v) => (v == null ? '–' : `${nf(Math.round(v))} €`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function priceOf(slot) {
  const p = byId(slot.id);
  const [label, price] = p.prices[Math.min(slot.s, p.prices.length - 1)];
  const factor = VPI_NOW.value / vpiFor(p.year);
  return { label, price, real: price == null ? null : price * factor, factor };
}
// Preis für Tischkarte/Upgrade: Telekom-Preis (wenn hinterlegt), sonst Apple-UVP
function priceInfo(slot) {
  const pr = priceOf(slot), t = tkPrice(slot.id, slot.s), tariff = tkInfo().tariff || 'Telekom';
  if (t) {
    const txt = t.once != null ? eur(t.once) : `${eur(t.monthly)} mtl.`;
    const sub = t.once != null && t.monthly != null ? `+ ${eur(t.monthly)} mtl. · ${tariff}` : `${tariff} · ${pr.label}`;
    return { type: 'tk', value: (t.once || 0) + 24 * (t.monthly || 0), text: txt, sub, label: pr.label };
  }
  if (pr.price == null) return { type: 'uvp', value: null, text: 'nur im Vertrag', sub: pr.label, label: pr.label };
  if (state.price === 'real') return { type: 'real', value: pr.real, text: `≈ ${eurR(pr.real)}`, sub: `heute · damals ${eur(pr.price)}`, label: pr.label };
  return { type: 'uvp', value: pr.price, text: eur(pr.price), sub: `UVP · ${pr.label}`, label: pr.label };
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
const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cbb8, 0.55); scene.add(hemi);
// Nachts: warmer Lichtkegel über dem Präsentationstisch
const spot = new THREE.SpotLight(0xffe2b8, 0, 0, 0.55, 0.7, 0);
spot.position.set(0, 2400, 400); scene.add(spot, spot.target);

const camera = new THREE.PerspectiveCamera(30, 1, 5, 20000);
camera.position.set(0, 200, 700);

// Eigene Pointer-Logik VOR OrbitControls registrieren (kann sie deaktivieren)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let drag = null;
renderer.domElement.addEventListener('pointerdown', onPointerDown);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 90;
controls.maxDistance = 3200;
controls.maxPolarAngle = Math.PI * 0.62;
controls.target.set(0, 0, 0);

// ---------------------------------------------------------------- Showroom
await loadStep(22, 'Baue Showroom: Boden, Wände, Tische …');
const SR = await import('./showroom.js');
const { TABLE_TOP, TABLE_W, TABLE_D } = SR;
await loadStep(40, 'Stelle Möbel, Pflanzen und Werbeflächen auf …');
const showroom = SR.buildShowroom(scene, renderer);
await loadStep(55, 'Berechne Licht und Spiegelungen …');
showroom.bake();
{
  const sc = key.shadow.camera;
  sc.left = -TABLE_W / 2 - 300; sc.right = TABLE_W / 2 + 300; sc.top = TABLE_D / 2 + 900; sc.bottom = -TABLE_D / 2 - 900;
  sc.near = 10; sc.far = 6000; sc.updateProjectionMatrix();
  key.position.set(500, TABLE_TOP + 2600, 1100); key.target.position.set(0, TABLE_TOP, 0);
}

// Acryl-Ständer (nur bei 1 Gerät)
const acrylMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, metalness: 0, depthWrite: false });
let stands = [];

// ---------------------------------------------------------------- Tag / Nacht
function applyNight(on, rebake = true) {
  state.night = on;
  key.color.set(on ? 0xffe6c4 : 0xfff8f0); key.intensity = on ? 0.45 : 1.1;
  spot.intensity = on ? 2.2 : 0;
  rim.color.set(on ? 0x7d8fff : 0xeef4ff); rim.intensity = on ? 0.06 : 0.55;
  hemi.intensity = on ? 0.06 : 0.55;
  const bg = on ? 0x16171c : 0xe9e6e1;
  scene.background.set(bg); scene.fog.color.set(bg);
  renderer.toneMappingExposure = on ? 1.05 : 0.95;
  showroom.setNight(on);
  scene.environmentIntensity = on ? 0.22 : 1;
  if (rebake) {
    const hidden = [];
    scene.traverse((o) => { if (o.userData.noBake && o.visible) { o.visible = false; hidden.push(o); } });
    showroom.bake();
    hidden.forEach((o) => { o.visible = true; });
    scene.environmentIntensity = on ? 0.6 : 1;   // gebackene Nacht-Umgebung ist bereits dunkel
  }
  document.querySelectorAll('#daySeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === (on ? 'night' : 'day')));
}

// ---------------------------------------------------------------- Geräte
const devices = []; // { phone, rot:{x,y}, target:{x,y}, x, enter }
let fitPending = true;
let L = { lift: 20, total: 300, maxH: 150 };
const isSingle = () => devices.filter(Boolean).length === 1;

function buildDevice(i) {
  const slot = active()[i];
  const old = devices[i];
  if (old) { scene.remove(old.phone.group); old.phone.dispose(); }
  const phone = new Phone(byId(slot.id), slot.c);
  phone.group.rotation.order = 'XYZ';
  phone.group.userData.noBake = true;
  if (phone.p.foldable) { phone.fold = phone.foldTarget = state.fold; phone.applyFold(); }
  phone.setOn(state.display === 'on');
  // Nur Farbe gewechselt: Display ohne Einblenden sofort zeigen
  if (old && old.phone.p.id === slot.id) { phone._instant = true; phone.redraw(); phone._instant = false; }
  const keep = old ? { rot: old.rot, target: old.target, x: old.x } : { rot: { x: 0, y: 0 }, target: { x: 0, y: 0 }, x: 0 };
  if (!old && state.sync && devices.find(Boolean)) {
    const ref = devices.find(Boolean); keep.rot = { ...ref.rot }; keep.target = { ...ref.target };
  }
  devices[i] = { phone, ...keep, enter: old && old.phone.p.id === slot.id ? 1 : 0 };
  scene.add(phone.group);
}

function syncDevices() {
  const act = active();
  for (let i = 0; i < 4; i++) {
    if (i < act.length) { if (!devices[i] || devices[i].phone.p.id !== act[i].id || devices[i].phone.color !== byId(act[i].id).colors[Math.min(act[i].c, byId(act[i].id).colors.length - 1)]) buildDevice(i); }
    else if (devices[i]) { scene.remove(devices[i].phone.group); devices[i].phone.dispose(); devices[i] = null; }
  }
  // Bei 1 Gerät dreht die Kamera um das Gerät (der Raum dreht sich scheinbar mit) – Gerät selbst bleibt gerade
  if (isSingle()) devices.filter(Boolean).forEach((d) => { d.target = { x: 0, y: 0 }; d.rot = { x: 0, y: 0 }; });
  $('#duoCtl').hidden = !act.some((s) => byId(s.id).foldable);
  state.focus = null;
  computeLayout();
  fitPending = true;
}

// Feste Plätze: jede Position bietet Platz für die maximale Drehung (und das aufgeklappte Duo)
function computeLayout() {
  const act = devices.filter(Boolean);
  const single = act.length === 1;
  const spans = act.map((d) => {
    const p = d.phone.p, wMax = p.foldable ? p.wOpen : p.w;
    return Math.max(single ? wMax : Math.hypot(wMax, p.foldable ? p.h * 0.5 : p.d * 3), single ? 130 : 96);
  });
  const total = spans.reduce((a, b) => a + b, 0) + GAP * (act.length - 1);
  const maxH = Math.max(...act.map((d) => d.phone.p.h));
  const lift = single ? 14 : Math.max(...act.map((d) => {
    const p = d.phone.p, wMax = p.foldable ? p.wOpen : p.w;
    return Math.hypot(p.h, wMax, p.d) / 2 - p.h / 2;
  })) + 10;
  let x = -total / 2;
  act.forEach((d, k) => { d.x = x + spans[k] / 2; d.span = spans[k]; x += spans[k] + GAP; });
  stands.forEach((s) => { scene.remove(s); s.geometry.dispose(); }); stands = [];
  if (single) {
    const p = act[0].phone.p;
    const sw = Math.min(46, (p.foldable ? p.wOpen : p.w) * 0.55);
    const s = new THREE.Mesh(new THREE.BoxGeometry(sw, lift, 32), acrylMat);
    s.position.set(act[0].x, TABLE_TOP + lift / 2, 0); s.userData.noBake = true;
    scene.add(s); stands.push(s);
  }
  L = { lift, total, maxH };
  act.forEach((d) => d.phone.group.position.set(d.x, TABLE_TOP + lift + d.phone.p.h / 2, 0));
  buildCards();
}

const CARD_Z = 104;                   // Hinterkante der Tischkarten (vor dem Drehradius)
function viewTarget() { return new THREE.Vector3(0, TABLE_TOP + (L.lift + L.maxH) / 2 - 22, 60); }

// Freier Bereich zwischen schwebender Leiste oben, Geräte-Karten unten und Upgrade-Panel rechts
function uiInsets() {
  const H = stage.clientHeight, W = stage.clientWidth;
  const tb = document.querySelector('.toolbar').getBoundingClientRect();
  const sl = document.querySelector('.slots').getBoundingClientRect();
  const top = Math.min(H * 0.3, tb.bottom + 8);
  const bottom = Math.min(H * 0.4, H - sl.top + 8);
  const up = $('#upgradePanel');
  const right = up.hidden || document.body.classList.contains('present') ? 0 : Math.min(W * 0.45, W - up.getBoundingClientRect().left + 8);
  return { top, bottom, right };
}
function applyViewOffset() {
  const W = stage.clientWidth, H = stage.clientHeight;
  const { top, bottom, right } = uiInsets();
  camera.setViewOffset(W, H, right / 2, (bottom - top) / 2, W, H);
  camera.updateProjectionMatrix();
  return { freeH: H - top - bottom, freeW: W - right, H, W };
}
function fitCamera(animate = true, dirOverride = null) {
  const { total, maxH, lift } = L;
  const { freeH, freeW, H, W } = applyViewOffset();
  const hScale = H / Math.max(200, freeH);            // nur der freie Bereich zählt
  const wScale = W / Math.max(300, freeW);
  const aspect = W / H;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hNeed = maxH + lift + 95;                      // inkl. Tischkarten
  const distH = (hNeed * 1.0 * hScale) / (2 * Math.tan(vfov / 2));
  const distW = (Math.max(total, 180) * 1.1 * wScale) / (2 * Math.tan(vfov / 2) * aspect);
  const dist = Math.max(distH, distW, 280);
  let dir = dirOverride || camera.position.clone().sub(controls.target).normalize();
  if (dir.lengthSq() < 0.5) dir = DEFAULT_DIR();
  const tgt = viewTarget();
  state.focus = null;
  camAnim = { from: camera.position.clone(), fromT: controls.target.clone(), to: dir.clone().multiplyScalar(dist).add(tgt), toT: tgt, t: animate ? 0 : 1 };
}
let camAnim = null;

// Doppelklick: Gerät heranholen
function focusDevice(i) {
  const d = devices[i]; if (!d) return;
  const { freeH, H } = applyViewOffset();
  const hScale = H / Math.max(200, freeH);
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const p = d.phone.p;
  const dist = Math.max(200, ((Math.max(p.h, p.foldable ? p.wOpen : p.w) * 1.9) * hScale) / (2 * Math.tan(vfov / 2)));
  const tgt = d.phone.group.position.clone();
  const dir = camera.position.clone().sub(controls.target).normalize();
  camAnim = { from: camera.position.clone(), fromT: controls.target.clone(), to: dir.multiplyScalar(dist).add(tgt), toT: tgt, t: 0 };
  state.focus = i;
}

function setView(v) {
  const [x, y] = VIEWS[v] || VIEWS.front;
  const act = devices.filter(Boolean);
  let dir = DEFAULT_DIR();
  if (act.length === 1) {
    // Kamera um das Gerät bewegen (Tisch & Raum bleiben fest)
    const pitch = THREE.MathUtils.clamp(x, -1.45, 1.45) || 0.25;
    dir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(-pitch, -y, 0, 'YXZ'));
    if (Math.abs(x) < 0.01) dir.y = 0.25;
    dir.normalize();
  } else act.forEach((d) => { d.target.x = x; d.target.y = y; });
  camAnim = null;
  fitCamera(true, dir);
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
}
// Pfeiltasten: schrittweise drehen
function nudge(dx, dy) {
  const act = devices.filter(Boolean);
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.remove('on'));
  if (act.length === 1) {
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta -= dx * 0.26; sph.phi = THREE.MathUtils.clamp(sph.phi - dy * 0.2, 0.15, controls.maxPolarAngle);
    const to = new THREE.Vector3().setFromSpherical(sph).add(controls.target);
    camAnim = { from: camera.position.clone(), fromT: controls.target.clone(), to, toT: controls.target.clone(), t: 0 };
  } else act.forEach((d) => { d.target.y += dx * Math.PI / 12; d.target.x = THREE.MathUtils.clamp(d.target.x + dy * Math.PI / 12, -Math.PI / 2, Math.PI / 2); });
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
  closeCube();
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
renderer.domElement.addEventListener('dblclick', (ev) => {
  const u = pick(ev);
  if (!u || u.part === 'btn') return;
  const i = devices.findIndex((d) => d && d.phone === u.phone);
  if (i >= 0) focusDevice(i);
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

// ---------------------------------------------------------------- Tischkarten mit Kernwerten
// Liegende Karten auf flachem Acryl-Keil vor jedem Gerät: Name, 5 Kernwerte, bester Wert in Magenta
const cards = [];
const CARD_TILT = THREE.MathUtils.degToRad(32);     // Neigung gegenüber der Tischplatte
const CW = 1200, CH = 820;                          // Canvas-Auflösung
function cardData() {
  const act = active();
  const rows = act.map((slot) => keyValues(byId(slot.id), priceInfo(slot)));
  // Preise nur vergleichen, wenn alle von derselben Art sind (Telekom vs. UVP)
  const types = new Set(act.map((s) => priceInfo(s).type));
  if (types.size > 1) rows.forEach((r) => { r[0].n = null; });
  return { rows, best: bestIndices(rows) };
}
const F = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, Arial, sans-serif';
function drawCard(canvas, i, info) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const slot = active()[i], p = byId(slot.id);
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fbfbfa'; g.fillRect(0, 0, W, H);
  g.fillStyle = SLOT_COLORS[i]; g.fillRect(0, 0, W, 16);
  // Kopf
  const cust = state.mode === 'upgrade' && i === 0;
  g.fillStyle = cust ? '#6e6e73' : SLOT_COLORS[i];
  g.beginPath(); g.arc(78, 100, 38, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = `700 40px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(cust ? 'K' : SLOT_LETTERS[i], 78, 102);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#1d1d1f';
  let fs = 72; g.font = `700 ${fs}px ${F}`;
  while (g.measureText(p.name).width > W - 170 && fs > 44) { fs -= 4; g.font = `700 ${fs}px ${F}`; }
  g.fillText(p.name, 136, 110);
  g.fillStyle = '#86868b'; g.font = `500 34px ${F}`;
  g.fillText(cust ? `Kundengerät · ${p.year}` : `${p.colors[Math.min(slot.c, p.colors.length - 1)][0]} · ${priceOf(slot).label} · ${p.year}`, 136, 156);
  // Zeilen
  const top = 196, rh = (H - top - 20) / info.rows[i].length;
  info.rows[i].forEach((row, r) => {
    const y = top + r * rh, isBest = info.best[r].includes(i);
    g.fillStyle = r % 2 ? '#fbfbfa' : '#f2f2f4'; g.fillRect(0, y, W, rh);
    if (isBest) { g.fillStyle = '#e20074'; g.fillRect(0, y, 12, rh); }
    g.fillStyle = '#6e6e73'; g.font = `600 42px ${F}`; g.fillText(row.k, 44, y + rh / 2 + 14);
    g.textAlign = 'right';
    g.fillStyle = isBest ? '#e20074' : '#1d1d1f';
    let vf = 66; g.font = `700 ${vf}px ${F}`;
    while (g.measureText(row.t).width > W - 300 && vf > 40) { vf -= 3; g.font = `700 ${vf}px ${F}`; }
    g.fillText(row.t, W - 40, y + rh / 2 + 6);
    g.fillStyle = isBest ? '#e20074' : '#6e6e73'; g.font = `500 36px ${F}`;
    let sub = row.sub || ''; while (g.measureText(sub).width > W - 300 && sub.length > 4) sub = sub.slice(0, -2) + '…';
    g.fillText(sub, W - 40, y + rh / 2 + 50);
    g.textAlign = 'left';
  });
  g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
}
const cardEdgeMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.5 });
const cardAcryl = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.04, clearcoat: 1, depthWrite: false });
let cardSig = '';
function buildCards() {
  // Karten nur neu aufbauen, wenn sich Platz oder Größe ändert – sonst nur neu beschriften (kein Flackern)
  const sig = devices.map((d) => (d ? `${d.x.toFixed(2)}:${d.span.toFixed(2)}` : '-')).join('|');
  if (sig === cardSig && cards.length) { cards.forEach((q) => { q.key = ''; }); updateCards(); return; }
  cardSig = sig;
  cards.forEach((q) => { scene.remove(q.group); q.tex.dispose(); q.mat.dispose(); q.group.traverse((o) => o.geometry && o.geometry.dispose()); });
  cards.length = 0;
  const act = devices.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  act.forEach((i) => {
    const cw = Math.min(act.length === 1 ? 124 : 116, devices[i].span + GAP - 10), ch = cw * (CH / CW);
    const canvas = document.createElement('canvas'); canvas.width = CW; canvas.height = CH;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const group = new THREE.Group(); group.userData.noBake = true;
    // flacher Acryl-Keil
    const hy = ch * Math.sin(CARD_TILT), dz = ch * Math.cos(CARD_TILT);
    const wedge = new THREE.Shape();
    wedge.moveTo(0, 0); wedge.lineTo(dz + 4, 0); wedge.lineTo(0, hy + 2); wedge.lineTo(0, 0);
    const wg = new THREE.ExtrudeGeometry(wedge, { depth: cw + 4, bevelEnabled: false });
    wg.rotateY(-Math.PI / 2); wg.translate((cw + 4) / 2, 0, 0);
    const wm = new THREE.Mesh(wg, cardAcryl); wm.position.z = -2; group.add(wm);
    const card = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 0.8), [cardEdgeMat, cardEdgeMat, cardEdgeMat, cardEdgeMat, mat, cardEdgeMat]);
    // Karte liegt auf der schrägen Keilfläche: hinten hoch, vorne tief, Oberseite zum Betrachter
    card.rotation.x = -(Math.PI / 2 - CARD_TILT);
    card.position.set(0, hy / 2 + 1.2, dz / 2);
    card.castShadow = true; card.receiveShadow = false;
    group.add(card);
    group.position.set(devices[i].x, TABLE_TOP, CARD_Z);
    scene.add(group);
    cards.push({ i, group, tex, mat, canvas, key: '' });
  });
  updateCards();   // Textur sofort zeichnen, bevor das nächste Bild gerendert wird
}
function updateCards() {
  if (!cards.length) return;
  const info = cardData();
  for (const q of cards) {
    if (!devices[q.i]) continue;
    const keyStr = JSON.stringify([info.rows[q.i], info.best.map((b) => b.includes(q.i)), active()[q.i], state.mode]);
    if (keyStr !== q.key) { q.key = keyStr; drawCard(q.canvas, q.i, info); q.tex.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- Loop
const clock = new THREE.Clock();
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
let ready = false;
new ResizeObserver(() => { resize(); if (ready) fitCamera(false); }).observe(stage);
new ResizeObserver(() => { applyViewOffset(); }).observe(document.querySelector('.slots'));

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now();
  if (fitPending) { fitPending = false; fitCamera(true, DEFAULT_DIR()); }
  const k = Math.min(1, dt * 8);
  controls.autoRotate = state.auto && isSingle() && !drag;
  controls.autoRotateSpeed = 1.2;
  if (state.auto && !isSingle() && !drag) devices.forEach((d) => { if (d) { d.target.y += dt * 0.45; d.rot.y = d.target.y; } });
  for (const d of devices) {
    if (!d) continue;
    d.rot.x += (d.target.x - d.rot.x) * k;
    d.rot.y += (d.target.y - d.rot.y) * k;
    // Einblenden: Gerät senkt sich sanft auf seinen Platz
    if (d.enter < 1) d.enter = Math.min(1, d.enter + dt * 2.2);
    const e = 1 - Math.pow(1 - d.enter, 3);
    d.phone.group.position.y = TABLE_TOP + L.lift + d.phone.p.h / 2 + (1 - e) * 70;
    d.phone.group.rotation.set(d.rot.x, d.rot.y + (1 - e) * 1.2, 0);
    d.phone.group.scale.setScalar(0.9 + 0.1 * e);
    d.phone.update(dt, now);
  }
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 2.2);
    const e = 1 - Math.pow(1 - camAnim.t, 3);
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
  updateCards();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- UI: Geräte-Karten unten
function modelButton(slot) {
  const p = byId(slot.id);
  return `<img alt="" class="thumb" data-thumb="${p.id}.${slot.c}"><span class="mname">${esc(p.name)}</span><span class="caret">▾</span>`;
}
function fillThumbs(root) {
  root.querySelectorAll('img[data-thumb]').forEach((img) => {
    const [id, c] = img.dataset.thumb.split('.');
    thumbFor(byId(id), +c).then((url) => { if (img.dataset.thumb === `${id}.${c}`) img.src = url; });
  });
}
function choose(i, title) {
  const slot = active()[i];
  openPicker({
    title, selected: slot.id,
    onPick: (id, c) => {
      const list = state.mode === 'upgrade' ? state.up : state.slots;
      list[i] = { id, c: c ?? 0, s: 0 };
      if (state.mode === 'upgrade' && i === 0) retarget();
      syncDevices(); renderAll();
    },
  });
}
function renderSlots() {
  const box = $('#slots');
  const act = active();
  box.style.setProperty('--n', act.length);
  box.dataset.n = act.length;
  box.innerHTML = '';
  act.forEach((slot, i) => {
    const p = byId(slot.id);
    slot.c = Math.min(slot.c, p.colors.length - 1);
    slot.s = Math.min(slot.s, p.prices.length - 1);
    const cust = state.mode === 'upgrade' && i === 0;
    const el = document.createElement('div');
    el.className = 'slot' + (cust ? ' cust' : '');
    el.innerHTML = `
      <div class="row"><span class="tag" style="background:${cust ? '#6e6e73' : SLOT_COLORS[i]}">${cust ? 'K' : SLOT_LETTERS[i]}</span>
        <button class="model-btn" aria-label="Modell ${cust ? 'Kundengerät' : SLOT_LETTERS[i]} wählen">${modelButton(slot)}</button></div>
      <div class="row">
        <select class="storage" aria-label="Speicher">${p.prices.map(([l], k) => `<option value="${k}"${k === slot.s ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <div class="swatches">${p.colors.map((c, k) => `<button class="sw${k === slot.c ? ' on' : ''}" data-k="${k}" title="${esc(c[0])}" style="background:${c[1]}"></button>`).join('')}</div>
      </div>
      <div class="cname">${cust ? 'Kundengerät · ' : ''}${esc(p.colors[slot.c][0])} · ${esc(p.launch)}</div>
      <div class="price"></div>`;
    el.querySelector('.model-btn').addEventListener('click', () => choose(i, cust ? 'Welches iPhone hat der Kunde?' : `Gerät ${SLOT_LETTERS[i]} wählen`));
    el.querySelector('.storage').addEventListener('change', (e) => { slot.s = +e.target.value; renderAll(); });
    el.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => {
      slot.c = +b.dataset.k; buildDevice(i); devices[i].enter = 1; computeLayout(); renderAll();
    }));
    box.appendChild(el);
  });
  fillThumbs(box);
  updateSlotPrices();
}
function updateSlotPrices() {
  document.querySelectorAll('#slots .slot').forEach((el, i) => {
    const slot = active()[i];
    const pr = priceOf(slot), p = byId(slot.id), t = tkPrice(slot.id, slot.s);
    const main = state.price === 'real' ? pr.real : pr.price;
    let sub;
    if (pr.price == null) sub = 'nur mit Vertrag';
    else if (state.price === 'real') sub = `damals ${eur(pr.price)} (${p.year}) · heutige Kaufkraft`;
    else sub = `UVP zum Start · ${pr.label}`;
    let html = `<b>${state.price === 'real' ? (main == null ? '–' : '≈ ' + eurR(main)) : eur(main)}</b><small>${sub}</small>`;
    if (t) html += `<span class="tk">Telekom: ${t.once != null ? eur(t.once) : ''}${t.once != null && t.monthly != null ? ' + ' : ''}${t.monthly != null ? eur(t.monthly) + ' mtl.' : ''}${tkInfo().tariff ? ' · ' + esc(tkInfo().tariff) : ''}</span>`;
    el.querySelector('.price').innerHTML = html;
  });
}

// ---------------------------------------------------------------- UI: Tabelle
function screenRatio(p) {
  const d = (diag, res) => { const a = res[1] / res[0], w = (diag * 25.4) / Math.sqrt(1 + a * a); return w * w * a; };
  if (p.foldable) return (d(p.diagInner, p.resInner.slice().reverse()) / (p.h * p.wOpen)) * 100;
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
  const pickBest = (vals, better, label, fmt) => {
    const valid = vals.filter((v) => typeof v === 'number');
    if (valid.length < 2 || new Set(valid).size < 2) return;
    const best = better === 'low' ? Math.min(...valid) : Math.max(...valid);
    const sorted = [...valid].sort((x, y) => (better === 'low' ? x - y : y - x));
    const second = sorted.find((v) => v !== best);
    vals.forEach((v, i) => { if (v === best) out[i].push(label + (fmt ? ` (${fmt(best, second)})` : '')); });
  };
  pickBest(ps.map((p) => (p.foldable ? p.diagInner : p.diag)), 'high', 'Größtes Display', (a, b) => `+${nf(a - b, 1)}″`);
  pickBest(ps.map((p) => p.video), 'high', 'Längste Akkulaufzeit', (a, b) => `+${a - b} h Video`);
  pickBest(ps.map((p) => p.g), 'low', 'Am leichtesten', (a, b) => `−${b - a} g`);
  pickBest(ps.map((p) => (p.foldable ? p.dOpen : p.d)), 'low', 'Am dünnsten', (a) => `${mm(a)} mm`);
  pickBest(prices, 'low', 'Günstigster Preis', (a, b) => `−${eurR(b - a)}`);
  pickBest(ps.map((p) => p.camCount + (p.lidar ? 0.5 : 0)), 'high', 'Meiste Kameras', null);
  pickBest(ps.map((p) => p.hz), 'high', 'ProMotion 120 Hz', null);
  pickBest(ps.map((p) => p.year), 'high', 'Neuestes Modell', null);
  pickBest(ps.map((p) => (/USB 3/.test(p.port) ? 2 : /USB-C/.test(p.port) ? 1 : 0)), 'high', 'Schnellster Anschluss', null);
  pickBest(ps.map((p) => (p.foldable ? 1 : 0)), 'high', 'Faltbar – Tablet-Display', null);
  return out;
}

const SECTIONS = [
  ['Auf einen Blick', [
    { k: 'Highlights', feat: true },
    { k: 'Stärken im Vergleich', strengths: true },
    { k: 'Preis', price: true },
    { k: 'Telekom-Preis', tk: true },
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

function tableHTML({ diffOnly = state.diff, withBars = true } = {}) {
  const act = active();
  const ps = act.map((s) => byId(s.id));
  const prs = act.map(priceOf);
  const pvals = prs.map((x) => (state.price === 'real' ? x.real : x.price));
  const str = strengths(ps, pvals);
  const cols = ps.length + 1;
  const multi = ps.length > 1;
  const same = (arr) => multi && arr.every((x) => x === arr[0]);
  const label = (i) => (state.mode === 'upgrade' && i === 0 ? 'K' : SLOT_LETTERS[i]);
  const color = (i) => (state.mode === 'upgrade' && i === 0 ? '#6e6e73' : SLOT_COLORS[i]);
  let html = `<colgroup><col class="lab">${ps.map(() => '<col>').join('')}</colgroup><thead><tr><th></th>${ps.map((p, i) => `<th><span class="dot" style="background:${color(i)}">${label(i)}</span>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>`;
  let hidden = 0;
  for (const [title, rows] of SECTIONS) {
    let body = '';
    for (const row of rows) {
      if (row.strengths && !multi) continue;
      let cellsHtml = '';
      if (row.price) {
        if (diffOnly && same(act.map((s, i) => `${pvals[i]}|${prs[i].label}`))) { hidden++; continue; }
        const valid = pvals.filter((v) => v != null);
        const best = valid.length > 1 && new Set(valid).size > 1 ? Math.min(...valid) : null;
        const max = Math.max(...valid, 1);
        prs.forEach((x, i) => {
          const v = pvals[i], p = ps[i];
          let sub;
          if (v == null) sub = p.priceNote || '';
          else if (state.price === 'real') sub = `damals ${eur(x.price)} (${x.label}, ${p.year}) × ${nf(x.factor, 2)} Inflation`;
          else sub = `${x.label}${p.priceNote ? ' · ' + p.priceNote : ''}`;
          const main = v == null ? (p.prices[0][1] == null ? 'nur im Vertrag' : '–') : state.price === 'real' ? '≈ ' + eurR(v) : eur(v);
          cellsHtml += `<td class="${v != null && v === best ? 'best' : ''}"><div class="main big">${main}</div><div class="sub">${esc(sub)}</div>${withBars && v != null ? `<div class="bar"><i style="width:${(v / max) * 100}%"></i></div>` : ''}</td>`;
        });
      } else if (row.tk) {
        const ts = act.map((s) => tkPrice(s.id, s.s));
        if (!ts.some(Boolean)) continue;
        if (diffOnly && same(ts.map((t) => JSON.stringify(t)))) { hidden++; continue; }
        const tot = ts.map((t) => (t ? (t.once || 0) + 24 * (t.monthly || 0) : null));
        const valid = tot.filter((v) => v != null);
        const best = valid.length > 1 && new Set(valid).size > 1 ? Math.min(...valid) : null;
        ts.forEach((t, i) => {
          if (!t) { cellsHtml += '<td><span class="sub">nicht hinterlegt</span></td>'; return; }
          cellsHtml += `<td class="${tot[i] === best ? 'best' : ''}"><div class="main big">${t.once != null ? eur(t.once) + ' einmalig' : ''}</div><div class="sub">${t.monthly != null ? eur(t.monthly) + ' monatlich · ' : ''}${esc(tkInfo().tariff || 'Telekom')} · ${prs[i].label}</div></td>`;
        });
      } else if (row.feat) {
        ps.forEach((p) => { cellsHtml += `<td><div class="chips">${p.feat.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div></td>`; });
      } else if (row.strengths) {
        str.forEach((list) => { cellsHtml += `<td>${list.length ? `<ul class="plus">${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span class="sub">–</span>'}</td>`; });
      } else {
        const cells = ps.map((p) => row.f(p));
        if (diffOnly && same(cells.map((c) => `${c.t}|${c.sub || ''}`))) { hidden++; continue; }
        const nums = cells.map((c) => c.n).filter((n) => typeof n === 'number');
        let best = null;
        if (row.better && nums.length > 1 && new Set(nums).size > 1) best = row.better === 'low' ? Math.min(...nums) : Math.max(...nums);
        const max = Math.max(...nums, 0.0001);
        cells.forEach((c, i) => {
          let delta = '';
          if (row.unit && i > 0 && typeof c.n === 'number' && typeof cells[0].n === 'number' && c.n !== cells[0].n) {
            const d = c.n - cells[0].n; delta = `<span class="delta">${d > 0 ? '+' : '−'}${nf(Math.abs(d))} ${row.unit} ggü. ${label(0)}</span>`;
          }
          cellsHtml += `<td class="${best != null && c.n === best ? 'best' : ''}"><div class="main">${esc(c.t)}${delta}</div>${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ''}${withBars && row.bar && typeof c.n === 'number' ? `<div class="bar"><i style="width:${(c.n / max) * 100}%"></i></div>` : ''}</td>`;
        });
      }
      body += `<tr><th>${row.k}</th>${cellsHtml}</tr>`;
    }
    if (body) html += `<tr class="sec"><th colspan="${cols}">${title}</th></tr>${body}`;
  }
  html += '</tbody>';
  return { html, hidden };
}
function renderTable() {
  const n = active().length;
  specsPanel.style.setProperty('--specs-w', `${170 + n * 270}px`);
  const { html, hidden } = tableHTML();
  $('#specTable').innerHTML = html;
  const base = state.price === 'real'
    ? `Inflationsbereinigt: Startpreis × (VPI ${VPI_NOW.label} ÷ VPI im Erscheinungsjahr), Verbraucherpreisindex Deutschland (Destatis).`
    : 'Preise: deutsche Apple-UVP zum Marktstart für die gewählte Speichervariante.';
  $('#priceNote').textContent = `${base} Grün = bester Wert im Vergleich.${state.diff && hidden ? ` ${hidden} gleiche Zeilen ausgeblendet.` : ''}${tkInfo().note ? ' Telekom: ' + tkInfo().note : ''}`;
}

// ---------------------------------------------------------------- UI: Upgrade-Beratung
function retarget() {
  const from = byId(state.up[0].id);
  const keep = state.up.slice(1).map((s) => s.id).filter((id) => id !== from.id);
  const ids = keep.length ? keep : defaultTargets(from);
  state.up = [state.up[0], ...ids.map((id) => state.up.find((s) => s.id === id) || { id, c: 0, s: 0 })];
}
function renderUpgrade() {
  if (state.mode !== 'upgrade') return;
  const from = byId(state.up[0].id);
  $('#custBtn').innerHTML = modelButton(state.up[0]);
  fillThumbs($('#custBtn'));
  const chosen = state.up.slice(1).map((s) => s.id);
  $('#suggChips').innerHTML = LINEUP.filter((id) => id !== from.id)
    .map((id) => `<button class="chip-btn${chosen.includes(id) ? ' on' : ''}" data-id="${id}">${esc(byId(id).name.replace('iPhone ', ''))}</button>`).join('');
  $('#suggChips').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.id, cur = state.up.slice(1).map((s) => s.id);
    let next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    if (!next.length) return;
    if (next.length > 3) next = next.slice(-3);
    next.sort((a, c) => LINEUP.indexOf(a) - LINEUP.indexOf(c));
    state.up = [state.up[0], ...next.map((x) => state.up.find((s) => s.id === x) || { id: x, c: 0, s: 0 })];
    syncDevices(); renderAll();
  }));
  $('#upList').innerHTML = upgradeHTML();
}
function upgradeHTML() {
  const from = byId(state.up[0].id);
  return state.up.slice(1).map((slot, k) => {
    const p = byId(slot.id), g = upgradeGains(from, p), pi = priceInfo(slot);
    const years = p.year - from.year;
    return `<article class="up-card">
      <header><span class="dot" style="background:${SLOT_COLORS[k + 1]}">${SLOT_LETTERS[k + 1]}</span><div><b>${esc(p.name)}</b><small>${years > 0 ? `${years} Jahr${years > 1 ? 'e' : ''} neuer` : p.year === from.year ? 'gleicher Jahrgang' : 'älteres Modell'} · ${esc(pi.label)}</small></div>
        <div class="up-price"><b>${esc(pi.text)}</b><small>${esc(pi.sub)}</small></div></header>
      ${g.plus.length ? `<h4>Das wird besser</h4><ul class="plus">${g.plus.slice(0, 9).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="sub">Kaum Verbesserungen gegenüber dem Kundengerät.</p>'}
      ${g.minus.length ? `<h4>Beachten</h4><ul class="minus">${g.minus.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </article>`;
  }).join('');
}

// ---------------------------------------------------------------- PDF
// Bild für das PDF: nur die iPhones (ohne Showroom, Tisch und Karten) auf weißem Grund, eng zugeschnitten
function snapshot() {
  const phones = devices.filter(Boolean).map((d) => d.phone.group);
  const hidden = [];
  scene.children.forEach((o) => { if (!o.isLight && !phones.includes(o) && o.visible) { o.visible = false; hidden.push(o); } });
  const bg = scene.background, fog = scene.fog;
  scene.background = new THREE.Color(0xffffff); scene.fog = null;
  renderer.render(scene, camera);
  const src = renderer.domElement, W = src.width, H = src.height;
  const box = new THREE.Box3();
  phones.forEach((g) => box.expandByObject(g));
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  if (!box.isEmpty()) {
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
  } else { x0 = 0; y0 = 0; x1 = W; y1 = H; }
  const pad = 0.05, AR = 2.6;
  let w = (x1 - x0) * (1 + pad * 2), h = (y1 - y0) * (1 + pad * 2);
  if (w / h < AR) w = h * AR; else h = w / AR;
  w = Math.min(w, W); h = Math.min(h, H);
  const cx = THREE.MathUtils.clamp((x0 + x1) / 2, w / 2, W - w / 2), cy = THREE.MathUtils.clamp((y0 + y1) / 2, h / 2, H - h / 2);
  const out = document.createElement('canvas'); out.width = Math.round(Math.min(w, 2000)); out.height = Math.round(out.width * h / w);
  const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(src, cx - w / 2, cy - h / 2, w, h, 0, 0, out.width, out.height);
  // Szene wiederherstellen
  scene.background = bg; scene.fog = fog;
  hidden.forEach((o) => { o.visible = true; });
  renderer.render(scene, camera);
  return out.toDataURL('image/jpeg', 0.92);
}
function makePDF() {
  const act = active(), names = act.map((s) => byId(s.id).name);
  const img = snapshot();
  const info = cardData();
  const key = `<table class="p-key"><thead><tr><th></th>${act.map((s, i) => `<th>${esc(names[i])}</th>`).join('')}</tr></thead><tbody>${info.rows[0].map((row, r) => `<tr><th>${row.k}</th>${act.map((s, i) => `<td class="${info.best[r].includes(i) ? 'best' : ''}"><b>${esc(info.rows[i][r].t)}</b><br><small>${esc(info.rows[i][r].sub || '')}</small></td>`).join('')}</tr>`).join('')}</tbody></table>`;
  if (state.mode === 'upgrade') {
    printSheet({
      title: `Upgrade-Beratung: ${names[0]} → ${names.slice(1).join(' / ')}`,
      img, landscape: false,
      body: `<h3>Kernwerte</h3>${key}<h3>Was sich für den Kunden verbessert</h3><div class="p-up">${upgradeHTML()}</div>`,
      note: tkInfo().note,
    });
  } else {
    const { html } = tableHTML({ withBars: false });
    printSheet({
      title: `iPhone-Vergleich: ${names.join(' · ')}`,
      img, landscape: act.length >= 3,
      body: `<h3>Kernwerte</h3>${key}<h3>Datenblatt${state.diff ? ' (nur Unterschiede)' : ''}</h3><table class="p-full">${html}</table>`,
      note: tkInfo().note,
    });
  }
}

// ---------------------------------------------------------------- UI: Leisten
function segSet(id, v) { document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === String(v))); }
function renderAll() {
  renderSlots();
  renderTable();
  renderUpgrade();
  segSet('modeSeg', state.mode);
  segSet('countSeg', state.n);
  segSet('screenSeg', state.display);
  segSet('priceSeg', state.price);
  segSet('foldSeg', state.fold);
  $('#countCtl').hidden = state.mode === 'upgrade';
  $('#upgradeBtn').hidden = state.mode !== 'upgrade';
  $('#diffTog').checked = state.diff;
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
function setMode(m) {
  if (m === state.mode) return;
  state.mode = m;
  if (m === 'upgrade') retarget();
  syncDevices(); renderAll();
  setPanel(m === 'upgrade' ? 'upgrade' : null);
}

document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.v)));
document.querySelectorAll('#countSeg button').forEach((b) => b.addEventListener('click', () => { state.n = +b.dataset.v; syncDevices(); renderAll(); }));
document.querySelectorAll('#screenSeg button').forEach((b) => b.addEventListener('click', () => {
  state.display = b.dataset.v; devices.forEach((d) => d && d.phone.setOn(state.display === 'on')); renderAll();
}));
document.querySelectorAll('#viewSeg button').forEach((b) => b.addEventListener('click', () => { setView(b.dataset.v); closeCube(); }));
document.querySelectorAll('#priceSeg button').forEach((b) => b.addEventListener('click', () => { state.price = b.dataset.v; renderAll(); }));
document.querySelectorAll('#foldSeg button').forEach((b) => b.addEventListener('click', () => setFoldAll(+b.dataset.v)));
$('#foldRange').addEventListener('input', (e) => setFoldAll(+e.target.value));
$('#syncTog').addEventListener('change', (e) => { state.sync = e.target.checked; });
$('#autoTog').addEventListener('change', (e) => setAuto(e.target.checked));
$('#diffTog').addEventListener('change', (e) => { state.diff = e.target.checked; store.set('diff', state.diff ? '1' : '0'); renderTable(); });
$('#pdfBtn').addEventListener('click', makePDF);
$('#pdfBtn2').addEventListener('click', makePDF);
$('#custBtn').addEventListener('click', () => choose(0, 'Welches iPhone hat der Kunde?'));
function setAuto(on) {
  state.auto = on; $('#autoTog').checked = on;
  controls.autoRotate = on && isSingle();
}
// Ansichts-Würfel
const cubeMenu = $('#cubeMenu'), cubeBtn = $('#cubeBtn');
function closeCube() { cubeMenu.hidden = true; cubeBtn.setAttribute('aria-expanded', 'false'); }
cubeBtn.addEventListener('click', (e) => { e.stopPropagation(); cubeMenu.hidden = !cubeMenu.hidden; cubeBtn.setAttribute('aria-expanded', String(!cubeMenu.hidden)); });
document.addEventListener('click', (e) => { if (!e.target.closest('#cubeWrap')) closeCube(); });

// Präsentationsmodus: Bedienelemente ausblenden, Vollbild, Drehteller an
function setPresent(on) {
  document.body.classList.toggle('present', on);
  if (on) { setPanel(null); $('#help').hidden = true; closeCube(); setAuto(true); document.documentElement.requestFullscreen?.().catch(() => {}); }
  else { setAuto(false); if (document.fullscreenElement) document.exitFullscreen?.(); }
  setTimeout(() => setView(isSingle() ? 'three' : 'front'), 80);
}
$('#presentBtn').addEventListener('click', () => setPresent(true));
$('#presentExit').addEventListener('click', () => setPresent(false));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('present')) setPresent(false); });
$('#resetBtn').addEventListener('click', () => setView('front'));

// Seitenpanels (Datenblatt / Upgrade) – immer nur eines offen
const specsPanel = $('#specsPanel'), specsBtn = $('#specsBtn'), upPanel = $('#upgradePanel'), upBtn = $('#upgradeBtn');
function setPanel(which) {
  specsPanel.hidden = which !== 'specs'; specsBtn.setAttribute('aria-expanded', String(which === 'specs'));
  upPanel.hidden = which !== 'upgrade'; upBtn.setAttribute('aria-expanded', String(which === 'upgrade'));
  document.body.classList.toggle('up-open', which === 'upgrade');
  if (ready) fitCamera(true);
}
specsBtn.addEventListener('click', () => setPanel(specsPanel.hidden ? 'specs' : null));
upBtn.addEventListener('click', () => setPanel(upPanel.hidden ? 'upgrade' : null));
$('#specsClose').addEventListener('click', () => setPanel(null));
$('#upgradeClose').addEventListener('click', () => setPanel(null));
$('#helpBtn').addEventListener('click', () => { $('#help').hidden = !$('#help').hidden; });

// Einstellungen
const settings = $('#settings');
$('#settingsBtn').addEventListener('click', () => { settings.hidden = false; });
$('#settingsClose').addEventListener('click', () => { settings.hidden = true; });
settings.addEventListener('click', (e) => { if (e.target === settings) settings.hidden = true; });
document.querySelectorAll('#daySeg button').forEach((b) => b.addEventListener('click', () => {
  const on = b.dataset.v === 'night'; store.set('night', on ? 'night' : 'day'); applyNight(on);
}));

// Tastatur
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const modal = document.querySelector('.modal:not([hidden])');
  if (e.key === 'Escape') {
    if (modal) { if (modal.id === 'picker') closePicker(); else modal.hidden = true; return; }
    if (!cubeMenu.hidden) { closeCube(); return; }
    if (!$('#help').hidden) { $('#help').hidden = true; return; }
    if (state.focus != null) { fitCamera(true); return; }
    if (!specsPanel.hidden || !upPanel.hidden) { setPanel(null); return; }
    return;
  }
  if (modal) return;
  const k = e.key.toLowerCase();
  const views = { f: 'front', b: 'back', l: 'left', r: 'right', o: 'top', u: 'bottom' };
  if (views[k]) { setView(views[k]); e.preventDefault(); return; }
  if (k === 'p') { setPresent(!document.body.classList.contains('present')); return; }
  const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
  if (arrows[k]) { nudge(...arrows[k]); e.preventDefault(); }
});

// ---------------------------------------------------------------- Start
readHash();
applyNight(state.night, false);
await loadStep(66, 'Baue iPhones maßstabsgetreu auf …');
syncDevices();
devices.forEach((d) => { if (d) d.enter = 1; });
await loadStep(76, 'Lade Telekom-Preise …');
await initAdmin({ onChange: () => { renderAll(); } });
renderAll();
resize();
setView('front');
if (state.mode === 'upgrade') setPanel('upgrade');
await loadStep(86, 'Bereite Materialien und Schatten vor …');
try { await renderer.compileAsync(scene, camera); } catch { /* ältere Browser: beim ersten Bild */ }
if (state.night) applyNight(true);
renderer.render(scene, camera);
await loadStep(100, 'Fertig');
ready = true;
tick();
$('#loader').classList.add('done');
setTimeout(() => $('#loader').remove(), 700);

// Für Tests / Konsole
window.__iphone = { camera, controls, setView, setFoldAll, devices, state, setMode, focusDevice, applyNight, makePDF, press: (i, b) => devices[i].phone.press(b), tap: (i) => devices[i].phone.tapScreen() };
