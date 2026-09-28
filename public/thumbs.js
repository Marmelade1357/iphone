// ============================================================================
// Vorschaubilder der Geräte (echte 3D-Modelle, Vorder- und Rückseite)
// Eigener kleiner Renderer, Bilder werden zwischengespeichert.
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { Phone } from './phone.js';

const SIZE = 256;
let R = null, scene = null, cam = null;
const cache = new Map();      // key -> Promise<string>
const queue = [];
let busy = false;

function init() {
  const canvas = document.createElement('canvas'); canvas.width = SIZE; canvas.height = SIZE;
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  R.setPixelRatio(1); R.setSize(SIZE, SIZE, false);
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
  R.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const l = new THREE.DirectionalLight(0xffffff, 1.2); l.position.set(200, 400, 600); scene.add(l);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6ba, 0.6));
  cam = new THREE.PerspectiveCamera(20, 1, 10, 5000);
}

function renderOne(p, c) {
  if (!R) init();
  const ph = new Phone(p, c);
  ph._instant = true;
  if (p.foldable) { ph.fold = ph.foldTarget = 180; ph.applyFold(); }
  ph.setOn(true);
  const w = p.foldable ? p.wOpen : p.w;
  // userData enthält Rückverweise auf das Phone-Objekt → für clone() kurz entfernen
  const saved = [];
  ph.group.traverse((o) => { saved.push([o, o.userData]); o.userData = {}; });
  const back = ph.group.clone(true);
  saved.forEach(([o, u]) => { o.userData = u; });
  ph.group.rotation.set(0, -0.32, 0); ph.group.position.set(-w * 0.28, 0, 12);
  back.rotation.set(0, Math.PI + 0.42, 0); back.position.set(w * 0.34, p.h * 0.03, -14);
  scene.add(ph.group, back);
  const span = Math.max(p.h * 1.08, w * 1.75);
  const dist = span / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  cam.position.set(0, p.h * 0.05, dist); cam.lookAt(0, 0, 0);
  R.setClearColor(0x000000, 0);
  R.render(scene, cam);
  let url;
  try { url = R.domElement.toDataURL('image/webp', 0.9); } catch { url = R.domElement.toDataURL(); }
  if (!url.startsWith('data:image/webp')) url = R.domElement.toDataURL('image/png');
  scene.remove(ph.group, back);
  ph.dispose();
  return url;
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    try { job.resolve(renderOne(job.p, job.c)); } catch (e) { job.resolve(''); console.warn('Vorschau fehlgeschlagen', job.p.id, e); }
    await new Promise((r) => setTimeout(r, 0));   // UI bleibt bedienbar
  }
  busy = false;
}

export function thumbFor(p, c = 0) {
  const key = `${p.id}.${c}`;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => { queue.push({ p, c, resolve }); }));
    pump();
  }
  return cache.get(key);
}
// Bereits angefragte, aber noch nicht gerenderte Bilder vorziehen
export function prioritize(ids) {
  queue.sort((a, b) => (ids.includes(b.p.id) ? 1 : 0) - (ids.includes(a.p.id) ? 1 : 0));
}
