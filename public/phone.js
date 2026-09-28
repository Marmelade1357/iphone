// ============================================================================
// Prozedurales 3D-iPhone: Gehäuse, Display (Canvas-Textur), Kameras, Tasten.
// Einheit: 1 = 1 mm.  Lokale Achsen: x = Breite, y = Höhe, z = Tiefe (+z = Front)
// ============================================================================
import * as THREE from 'three';
import { drawScreen } from './screen.js';

const TAU = Math.PI * 2;

// Logo-Maske (vom Nutzer bereitgestellt, weiß = Logo) – einmal laden, für alle Geräte teilen
const LOGO_ASPECT = 426 / 520;
let logoTex = null;
function getLogoTex() {
  if (!logoTex) {
    logoTex = new THREE.TextureLoader().load('assets/logo-mask.png');
    logoTex.anisotropy = 4;
  }
  return logoTex;
}

// Logo-Position auf der Rückseite: Mitte ab Oberkante + Höhe (mm).
// Aktuelle Modelle aus den Apple Dimensional Drawings, ältere anhand von Produktfotos geschätzt.
function logoSpec(p, h, w) {
  const known = {
    '16pro': [73.12, 20.04], '17': [73.18, 19.34], 'air': [77.19, 18.78],
    '17pro': [95.3, 20.04], '18pro': [91.2, 20.04],
  };
  if (known[p.id]) return known[p.id];
  const scale = w / 71.5;
  if (p.id === '16promax') return [h * 73.12 / 149.6, 20.04 * scale];
  if (p.id === '17promax') return [h * 95.3 / 150, 20.04 * scale];
  if (p.id === '18promax') return [h * 91.2 / 150, 20.04 * scale];
  if (p.foldable) return [h * 0.52, 18];
  if (p.year >= 2019 && p.front !== 'home') return [h * 0.49, 19.5 * scale];
  if (p.year >= 2014) return [h * 0.34, 14.5 * scale];
  return [h * 0.37, 13 * Math.max(1, scale)];
}


// ---------------------------------------------------------------- Helfer
function rrShape(x, y, w, h, r) {
  // r: Zahl oder [tl, tr, br, bl]
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  const s = new THREE.Shape();
  s.moveTo(x + bl, y);
  s.lineTo(x + w - br, y);
  if (br) s.quadraticCurveTo(x + w, y, x + w, y + br);
  s.lineTo(x + w, y + h - tr);
  if (tr) s.quadraticCurveTo(x + w, y + h, x + w - tr, y + h);
  s.lineTo(x + tl, y + h);
  if (tl) s.quadraticCurveTo(x, y + h, x, y + h - tl);
  s.lineTo(x, y + bl);
  if (bl) s.quadraticCurveTo(x, y, x + bl, y);
  return s;
}
const rrCentered = (w, h, r) => rrShape(-w / 2, -h / 2, w, h, r);

// ShapeGeometry mit UVs 0..1 über die Bounding-Box (optional Teilbereich u0..u1)
function flatGeo(shape, seg = 20, u0 = 0, u1 = 1) {
  const g = new THREE.ShapeGeometry(shape, seg);
  g.computeBoundingBox();
  const bb = g.boundingBox, pos = g.attributes.position, uv = g.attributes.uv;
  const bw = bb.max.x - bb.min.x || 1, bh = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) - bb.min.x) / bw, v = (pos.getY(i) - bb.min.y) / bh;
    uv.setXY(i, u0 + u * (u1 - u0), v);
  }
  uv.needsUpdate = true;
  return g;
}

function slabGeo(w, h, d, corner, edgeR, seg) {
  const e = Math.min(edgeR, d / 2 - 0.05, corner - 0.2);
  const shape = rrCentered(w - 2 * e, h - 2 * e, Math.max(0.3, corner - e));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, d - 2 * e), bevelEnabled: true,
    bevelThickness: e, bevelSize: e, bevelSegments: seg, curveSegments: 28,
  });
  g.translate(0, 0, -(d - 2 * e) / 2);
  g.computeVertexNormals();
  return { geo: g, e };
}

function slabGeo4(w, h, d, radii, edgeR, seg) {
  const e = Math.min(edgeR, d / 2 - 0.05);
  const shape = rrCentered(w - 2 * e, h - 2 * e, radii.map((r) => Math.max(0.15, r - e)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, d - 2 * e), bevelEnabled: true,
    bevelThickness: e, bevelSize: e, bevelSegments: seg, curveSegments: 28,
  });
  g.translate(0, 0, -(d - 2 * e) / 2);
  g.computeVertexNormals();
  return g;
}

// Kameramodule aus Apple Dimensional Drawings (u/v ab linker/oberer Kante von hinten, Ø in mm)
// o = äußere Glasplatte [u0,v0,u1,v1], i = innere Erhöhung, L = Objektive [u,v,Ø], f = Blitz, mic, lidar
const CAMSPEC = {
  '12': { o: [3.43, 3.43, 34.13, 36.30], i: [5.37, 5.37, 32.19, 34.37], L: [[12.73, 12.73, 12.1], [12.73, 27.01, 12.1]], f: [25.28, 19.87, 5.66], mic: [25.28, 12.28, 2.4] },
  '12mini': { o: [1.67, 1.67, 30.76, 33.95], i: [3.61, 3.61, 28.82, 32.01], L: [[10.67, 10.67, 12.1], [10.67, 24.95, 12.1]], f: [22.21, 17.81, 5.66], mic: [22.21, 10.22, 2.4] },
  '12pro': { o: [2.12, 2.12, 35.44, 37.62], i: [4.62, 4.62, 32.94, 35.11], L: [[12.16, 12.16, 12.45], [12.16, 27.58, 12.45], [25.51, 19.87, 12.45]], f: [25.51, 9.17, 6.28], mic: [30.23, 27.38, 1.15], lidar: [25.51, 30.4, 4.4], pro: true },
  '12promax': { o: [1.7, 1.7, 40.18, 42.63], i: [5.06, 5.06, 36.82, 39.27], L: [[13.43, 13.43, 14.11], [13.43, 30.9, 14.11], [28.9, 22.16, 14.11]], f: [28.9, 10.11, 6.28], mic: [33.69, 30.89, 1.15], lidar: [28.9, 34.0, 5], pro: true },
  '13': { o: [1.15, 1.15, 35.12, 35.12], i: [3.64, 3.64, 32.48, 32.48], L: [[11.88, 11.88, 13.69], [24.24, 24.24, 13.69]], f: [26.3, 10.01, 6.28], mic: [10.6, 25.69, 2.4] },
  '13mini': { o: [1.4, 1.4, 33.37, 33.37], i: [3.64, 3.64, 31.96, 31.96], L: [[10.85, 10.85, 13.69], [23.21, 23.21, 13.69]], f: [24.4, 8.98, 6.28], mic: [9.4, 24.66, 2.4] },
  '13pro': { o: [1.15, 1.15, 42.39, 43.62], i: [4.27, 4.27, 39.28, 40.51], L: [[13.43, 13.43, 15.53], [13.43, 31.35, 15.53], [30.08, 22.39, 15.8]], f: [30.08, 9.42, 6.28], mic: [35.76, 32.21, 1.15], lidar: [30.08, 35.2, 5.2], pro: true },
  '14': { o: [1.15, 1.15, 35.9, 35.9], i: [3.21, 3.21, 33.3, 33.3], L: [[11.88, 11.88, 14.38], [24.63, 24.63, 14.38]], f: [26.3, 10.21, 6.28], mic: [10.62, 25.89, 2.1] },
  '14plus': { o: [1.28, 1.28, 36.57, 36.57], i: [3.88, 3.88, 33.97, 33.97], L: [[12.55, 12.55, 14.38], [25.3, 25.3, 14.38]], f: [26.97, 10.87, 6.28], mic: [11.29, 26.56, 2.1] },
  '14pro': { o: [2.19, 2.19, 44.12, 45.61], i: [4.79, 4.79, 41.52, 43.01], L: [[14.28, 14.28, 15.61], [14.28, 33.52, 15.61], [32.12, 23.9, 15.61]], f: [32.12, 10.32, 6.9], mic: [37.91, 33.98, 1.15], lidar: [32.12, 37.4, 5.4], pro: true },
  '15': { o: [1.22, 1.22, 37.15, 37.15], i: [3.9, 3.9, 34.47, 34.47], L: [[12.73, 12.73, 15.07], [25.64, 25.64, 15.07]], f: [27.4, 11.06, 6.28], mic: [11.47, 26.9, 2.1] },
  '16pro': { o: [1.04, 1.04, 45.22, 46.54], i: [4.7, 4.7, 41.56, 42.88], L: [[14.17, 14.17, 16.2], [14.17, 33.41, 16.2], [32.16, 23.79, 16.2]], f: [32.16, 10.22, 6.92], mic: [37.95, 33.86, 0.75], lidar: [32.16, 37.4, 5.4], pro: true },
};
const CAMSPEC_MAP = {
  '11': ['12', 1.06], '11pro': ['12pro', 1], '11promax': ['12promax', 1], '12': ['12', 1], '12mini': ['12mini', 1],
  '12pro': ['12pro', 1], '12promax': ['12promax', 1], '13': ['13', 1], '13mini': ['13mini', 1], '13pro': ['13pro', 1],
  '13promax': ['13pro', 1], '14': ['14', 1], '14plus': ['14plus', 1], '14pro': ['14pro', 1], '14promax': ['14pro', 1],
  '15': ['15', 1], '15plus': ['15', 1], '15pro': ['16pro', 1], '15promax': ['16pro', 1], '16pro': ['16pro', 1], '16promax': ['16pro', 1],
};

// Gehäuse mit fein unterteilter Kontur (für farbige Bänder: Antennenlinien, Kunststoffteile)
function slabGeoDense(w, h, d, corner, edgeR, seg) {
  const e = Math.min(edgeR, d / 2 - 0.05, corner - 0.2);
  const base = rrCentered(w - 2 * e, h - 2 * e, Math.max(0.3, corner - e));
  const shape = new THREE.Shape(base.getSpacedPoints(720));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, d - 2 * e), bevelEnabled: true,
    bevelThickness: e, bevelSize: e, bevelSegments: seg, curveSegments: 4,
  });
  g.translate(0, 0, -(d - 2 * e) / 2);
  g.computeVertexNormals();
  return { geo: g, e };
}
// Dreiecke je nach Höhe (y) einem Material zuordnen: bands = [{y0, y1, mi}]
function groupBands(geo, bands) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const tri = pos.count / 3, buckets = new Map();
  for (let t = 0; t < tri; t++) {
    const cy = (pos.getY(3 * t) + pos.getY(3 * t + 1) + pos.getY(3 * t + 2)) / 3;
    let mi = 0;
    for (const b of bands) if (cy >= b.y0 && cy <= b.y1) mi = b.mi;
    if (!buckets.has(mi)) buckets.set(mi, []);
    buckets.get(mi).push(t);
  }
  const P = [], N = [], U = [], out = new THREE.BufferGeometry();
  let start = 0;
  [...buckets.keys()].sort((a, b) => a - b).forEach((mi) => {
    const list = buckets.get(mi);
    list.forEach((t) => { for (let k = 0; k < 3; k++) { const i = 3 * t + k; P.push(pos.getX(i), pos.getY(i), pos.getZ(i)); N.push(nor.getX(i), nor.getY(i), nor.getZ(i)); U.push(uv.getX(i), uv.getY(i)); } });
    out.addGroup(start, list.length * 3, mi); start += list.length * 3;
  });
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.dispose();
  return out;
}
// Ring (Außenkontur minus Innenkontur), z. B. Chromrahmen oder Diamantschliff-Fase
function ringGeo(w, h, r, wi, hi, ri, depth) {
  const s = rrCentered(w, h, r);
  s.holes.push(rrCentered(wi, hi, ri));
  if (!depth) return new THREE.ShapeGeometry(s, 24);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 3, curveSegments: 24 });
}

function hexToHsl(hex) {
  const c = new THREE.Color(hex); const o = {}; c.getHSL(o); return o;
}

function screenDims(diag, res) {
  const a = res[1] / res[0];               // Höhe / Breite
  const dmm = diag * 25.4;
  const w = dmm / Math.sqrt(1 + a * a);
  return { sw: w, sh: w * a };
}

// ---------------------------------------------------------------- Materialien
function makeMaterials(p, color, envMap) {
  const [, backHex, frontHex] = color;
  const mat = p.mat || '';
  const steel = /Edelstahl/.test(mat) || p.shinyFrame;
  const titan = /Titan/.test(mat);
  const plastic = p.style === 'g3' || p.style === 'g5c' || /Polycarbonat/.test(mat);
  const frameColor = new THREE.Color(color[3] || backHex);
  if (steel && p.id.startsWith('4')) frameColor.set('#c8c9cb');
  if (p.style === 'orig') frameColor.set('#c9cacc');

  const frame = new THREE.MeshPhysicalMaterial({
    color: frameColor,
    metalness: plastic ? 0 : (steel ? 1 : 0.85),
    roughness: plastic ? 0.28 : (steel ? 0.12 : titan ? 0.34 : 0.38),
    clearcoat: plastic ? 0.8 : 0.2, clearcoatRoughness: 0.2, envMapIntensity: 1.1,
  });
  let back;
  if (p.glassBack) {
    const matte = /Matt/.test(mat);
    back = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(backHex), metalness: 0.05,
      roughness: matte ? 0.55 : 0.12, clearcoat: matte ? 0.25 : 1, clearcoatRoughness: matte ? 0.5 : 0.04,
      envMapIntensity: 1,
    });
  } else if (p.style === 'g4') {
    back = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(backHex), metalness: 0, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 });
  } else if (plastic) {
    back = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(backHex), metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08,
    });
  } else {
    back = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(backHex), metalness: 0.85, roughness: 0.42, envMapIntensity: 1.1,
    });
  }
  const frontGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(frontHex || '#0b0b0d'), metalness: 0, roughness: 0.06,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.9,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.6, metalness: 0.2 });
  const lensGlass = new THREE.MeshPhysicalMaterial({
    color: 0x05060a, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0,
    iridescence: 0.35, iridescenceIOR: 1.5, envMapIntensity: 1.0, side: THREE.DoubleSide,
  });
  const lensInner = new THREE.MeshStandardMaterial({ color: 0x1a1d2a, roughness: 0.35, metalness: 0.3 });
  const ring = new THREE.MeshPhysicalMaterial({
    color: frameColor.clone().lerp(new THREE.Color('#9a9a9a'), 0.35), metalness: 1, roughness: 0.18, side: THREE.DoubleSide,
  });
  const plasticBlack = new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const fh = {}; frameColor.getHSL(fh);
  const antenna = new THREE.MeshStandardMaterial({
    color: frameColor.clone().lerp(new THREE.Color(fh.l < 0.35 ? '#6a6a6e' : '#ffffff'), fh.l < 0.35 ? 0.25 : 0.4).multiplyScalar(fh.l < 0.35 ? 1 : 0.93),
    roughness: 0.55, metalness: 0,
  });
  const gap = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.6 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe2e3e6, metalness: 1, roughness: 0.06, clearcoat: 1 });
  const chamfer = new THREE.MeshPhysicalMaterial({ color: frameColor.clone().lerp(new THREE.Color('#ffffff'), 0.45), metalness: 1, roughness: 0.07 });
  const insert = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color[4] || backHex), metalness: 0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  const flash = new THREE.MeshStandardMaterial({
    color: 0xf2e9c9, roughness: 0.3, emissive: 0xfff4d0, emissiveIntensity: 0, toneMapped: false,
  });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.5 });
  const sapphire = new THREE.MeshPhysicalMaterial({
    color: frameColor.clone().multiplyScalar(0.7), metalness: 0.4, roughness: 0.08, clearcoat: 1,
  });
  return { frame, back, frontGlass, dark, lensGlass, lensInner, ring, flash, orange, sapphire, plasticBlack, antenna, gap, chrome, chamfer, insert };
}

function makeScreenMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x030304, metalness: 0, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02,
    emissive: 0xffffff, emissiveIntensity: 0, toneMapped: false, envMapIntensity: 0.8,
  });
}

// ============================================================================
export class Phone {
  constructor(p, colorIdx = 0) {
    this.p = p;
    this.color = p.colors[Math.min(colorIdx, p.colors.length - 1)];
    this.group = new THREE.Group();        // wird von außen positioniert/rotiert
    this.inner = new THREE.Group();        // für Zentrier-Offsets (Duo)
    this.group.add(this.inner);
    this.m = makeMaterials(p, this.color);
    this.buttons = [];                     // {mesh, base, axis, depth, t}
    this.pickables = [];
    this.screens = [];                     // {mesh, mat, tex, canvas, kind, w, h}
    this.state = {
      on: false, ui: 'lock', vol: 9, silent: false, torch: false,
      overlay: null, overlayUntil: 0, flashUntil: 0, unlockMsg: null,
    };
    this.fold = 180;                       // Duo: Öffnungswinkel (0 = zu, 180 = flach)
    this.foldTarget = 180;
    if (p.foldable) this.buildDuo(); else this.buildBar();
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.redraw();
  }

  // -------------------------------------------------------------- Barren-iPhone
  buildBar() {
    const p = this.p, m = this.m;
    const { w, h, d } = p;
    const st = p.style || '';
    const pebble = st === 'orig' || st === 'g3';
    let edgeR = p.edge === 'curved' ? Math.min(d * 0.46, 3.4) : p.edge === 'soft' ? 1.3 : 0.45;
    if (pebble) edgeR = d * 0.47;
    const segs = p.edge === 'curved' || pebble ? 8 : 3;
    const bands = this.bodyBands(w, h, d);
    const bodyMats = [m.frame, m.plasticBlack, m.antenna, m.gap];
    const mk = (geo) => new THREE.Mesh(bands.length ? groupBands(geo, bands) : geo, bands.length ? bodyMats : m.frame);
    const { geo, e } = bands.length ? slabGeoDense(w, h, d, p.corner, edgeR, segs) : slabGeo(w, h, d, p.corner, edgeR, segs);
    const body = mk(geo);
    this.tag(body, 'body');
    this.inner.add(body);
    if (pebble) {
      // flacher vorderer Teil (Rundung nur zur Rückseite hin – gewölbter Rücken)
      const fr = bands.length ? slabGeoDense(w, h, e, p.corner, 0.4, 3) : slabGeo(w, h, e, p.corner, 0.4, 3);
      const front = mk(fr.geo); front.position.z = d / 2 - e / 2;
      this.tag(front, 'body'); this.inner.add(front);
    }
    this.dims = { w, h, d };

    // Front-Glas (bei Chromrahmen innerhalb des Rahmens)
    const chromeBezel = pebble;
    let inset = p.edge === 'curved' ? e * 0.92 : 0.35;
    if (chromeBezel) inset = 1.3;
    if (st === 'g5') inset = 0.7;
    const fg = new THREE.Mesh(flatGeo(rrCentered(w - 2 * inset, h - 2 * inset, p.corner - inset)), m.frontGlass);
    fg.position.z = d / 2 + 0.05;
    this.tag(fg, 'body');
    this.inner.add(fg);
    if (chromeBezel) {
      // polierter Edelstahl-/Chromrahmen um die Front (iPhone, 3G, 3GS)
      const ring = new THREE.Mesh(ringGeo(w - 0.1, h - 0.1, p.corner - 0.05, w - 2.5, h - 2.5, p.corner - 1.25, 1.1), m.chrome);
      ring.position.z = d / 2 - 1.0; this.tag(ring, 'body'); this.inner.add(ring);
    }
    if (st === 'g5') {
      // Diamantschliff-Fasen an Vorder- und Rückkante
      [1, -1].forEach((sz) => {
        const ch = new THREE.Mesh(ringGeo(w - 0.1, h - 0.1, p.corner - 0.05, w - 1.4, h - 1.4, p.corner - 0.7), m.chamfer);
        if (sz < 0) ch.rotation.y = Math.PI;
        ch.position.z = sz * (d / 2 + 0.07); this.inner.add(ch);
      });
    }

    // Rückseite
    const binset = pebble ? e * 0.9 : p.edge === 'curved' ? e * 0.92 : st === 'g5' ? 0.7 : 0.5;
    const bw = w - 2 * binset, bh = h - 2 * binset, br = Math.max(0.5, p.corner - binset);
    const backPanel = (y0, y1, radii, mat) => {
      const mesh = new THREE.Mesh(flatGeo(rrShape(-bw / 2, y0, bw, y1 - y0, radii)), mat);
      mesh.rotation.y = Math.PI; mesh.position.z = -d / 2 - 0.06; this.tag(mesh, 'body'); this.inner.add(mesh);
      return mesh;
    };
    if (st === 'orig') {
      // gebürstetes Aluminium oben, schwarzer Kunststoff unten (Antennenfenster)
      const yS = -h / 2 + 22;
      backPanel(yS, bh / 2, [br, br, 0, 0], m.back);
      backPanel(-bh / 2, yS, [0, 0, br, br], m.plasticBlack);
    } else if (st === 'g5') {
      // Aluminium-Mitte mit Glaseinsätzen oben und unten
      const ins = h * 0.135;
      backPanel(bh / 2 - ins, bh / 2, [br, br, 0, 0], m.insert);
      backPanel(-bh / 2 + ins + 0.4, bh / 2 - ins - 0.4, 0.01, m.back);
      backPanel(-bh / 2, -bh / 2 + ins, [0, 0, br, br], m.insert);
    } else {
      backPanel(-bh / 2, bh / 2, br, m.back);
    }
    if (st === 'g6') {
      // Antennenlinien quer über den Rücken
      [h / 2 - 10.4, -h / 2 + 10.4].forEach((y) => {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(bw, 1.1), m.antenna);
        line.rotation.y = Math.PI; line.position.set(0, y, -d / 2 - 0.09); this.inner.add(line);
      });
    }

    // Display
    const { sw, sh } = p.bezel ? { sw: w - 2 * p.bezel, sh: h - 2 * p.bezel } : screenDims(p.diag, p.res);
    let sy = 0;
    if (p.front === 'home') sy = (p.id === 'iphone' || p.id === '3g' || p.id === '3gs') ? 0 : 0.5;
    this.addScreen('phone', sw, sh, p.screenCorner || 0, 0, sy, d / 2 + 0.1, this.inner);

    const topBezelY = (sh / 2 + sy + h / 2) / 2;
    const botBezelY = (-sh / 2 + sy - h / 2) / 2;
    // Hörmuschel / Frontkamera / Home-Taste
    if (p.front === 'home') {
      const ear = new THREE.Mesh(flatGeo(rrCentered(p.w * 0.16, 1.3, 0.65)), m.dark);
      ear.position.set(0, topBezelY, d / 2 + 0.1); this.inner.add(ear);
      if (p.frontCam) {
        const fc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), m.lensGlass);
        fc.position.set(p.year >= 2014 ? 0 : -p.w * 0.16, p.year >= 2014 ? topBezelY + 4.2 : topBezelY, d / 2 + 0.12);
        if (p.year >= 2014) ear.position.y -= 0.8;
        this.inner.add(fc);
      }
      const r = Math.min(5.6, (h / 2 - sh / 2) * 0.42);
      const home = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 48), m.frontGlass);
      cap.rotation.x = Math.PI / 2;
      home.add(cap);
      if (p.homeRing) {
        const ringM = new THREE.Mesh(new THREE.TorusGeometry(r, 0.28, 12, 64), m.ring);
        ringM.position.z = 0.2; home.add(ringM);
      } else {
        const sq = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(r * 0.62, r * 0.62)),
          new THREE.LineBasicMaterial({ color: 0x8a8a8f }));
        sq.position.z = 0.27; home.add(sq);
      }
      home.position.set(0, botBezelY, d / 2 - 0.05);
      this.addButton(home, 'home', new THREE.Vector3(0, 0, -1), 0.35, cap);
      this.inner.add(home);
    } else {
      const ear = new THREE.Mesh(flatGeo(rrCentered(Math.min(12, w * 0.17), 0.7, 0.35)), m.dark);
      ear.position.set(0, h / 2 - Math.max(1.0, (h / 2 - sh / 2) * 0.45), d / 2 + 0.14);
      this.inner.add(ear);
    }

    this.addSideButtons(this.inner, w, h, d, 0);
    this.addBottomPorts(this.inner, w, h, d, 0);
    this.addCameras(this.inner, w, h, d, 0);
  }

  // -------------------------------------------------------------- iPhone Duo
  buildDuo() {
    // Aufbau nach Apple-Produktbildern: Innen ein durchgehendes Display (Ecken nur außen rund),
    // Scharnierseite der Hälften eckig, zugeklappt bildet die Titan-Scharnierabdeckung eine
    // durchgehende, flache Seite. Außendisplay mit eckigen Ecken zur Scharnierseite.
    const p = this.p, m = this.m;
    const halfW = p.wOpen / 2, t = p.dOpen, h = p.h;
    const gap = Math.max(0.3, p.d - 2 * t);
    this.duo = { halfW, t, gap, pivotZ: t / 2 + gap / 2 };
    const corner = p.corner, hc = 1.2;   // hc = Eckradius an der Scharnierseite

    // rechte Hälfte (fest, Kameras auf der Rückseite) – Scharnier bei lokal x = -halfW/2
    const R = new THREE.Group(); R.position.x = halfW / 2;
    const bodyR = new THREE.Mesh(slabGeo4(halfW, h, t, [hc, corner, corner, hc], 1.1, 3), m.frame);
    this.tag(bodyR, 'body'); R.add(bodyR);
    // Rückseite (vor Drehung um π gespiegelt: Scharnier liegt rechts)
    const backR = new THREE.Mesh(flatGeo(rrShape(-halfW / 2 + 0.5, -h / 2 + 0.5, halfW - 0.9, h - 1, [corner - 0.5, hc, hc, corner - 0.5])), m.back);
    backR.rotation.y = Math.PI; backR.position.z = -t / 2 - 0.06; this.tag(backR, 'body'); R.add(backR);
    const frontR = new THREE.Mesh(flatGeo(rrShape(-halfW / 2, -h / 2 + 0.4, halfW - 0.4, h - 0.8, [0, corner - 0.4, corner - 0.4, 0])), m.frontGlass);
    frontR.position.z = t / 2 + 0.05; this.tag(frontR, 'body'); R.add(frontR);

    // linke Hälfte (dreht um Scharnier) – Scharnier bei lokal x = +halfW/2
    const pivot = new THREE.Group(); pivot.position.z = this.duo.pivotZ;
    const L = new THREE.Group(); L.position.set(-halfW / 2, 0, -this.duo.pivotZ);
    const bodyL = new THREE.Mesh(slabGeo4(halfW, h, t, [corner, hc, hc, corner], 1.1, 3), m.frame);
    this.tag(bodyL, 'body'); L.add(bodyL);
    const frontL = new THREE.Mesh(flatGeo(rrShape(-halfW / 2 + 0.4, -h / 2 + 0.4, halfW - 0.4, h - 0.8, [corner - 0.4, 0, 0, corner - 0.4])), m.frontGlass);
    frontL.position.z = t / 2 + 0.05; this.tag(frontL, 'body'); L.add(frontL);
    const backL = new THREE.Mesh(flatGeo(rrShape(-halfW / 2 + 0.4, -h / 2 + 0.5, halfW - 0.9, h - 1, [hc, corner - 0.5, corner - 0.5, hc])), m.frontGlass);
    backL.rotation.y = Math.PI; backL.position.z = -t / 2 - 0.06; this.tag(backL, 'body'); L.add(backL);
    pivot.add(L);

    // Innendisplay: eine Fläche über beide Hälften, schmaler gleichmäßiger Rand
    const bez = 2.4;
    const iw = p.wOpen - 2 * bez, ih = h - 2 * bez;
    const sc = p.screenCorner;
    const innerTex = this.makeCanvas('duoInner', 1400, Math.round(1400 * ih / iw));
    const innerMat = makeScreenMaterial(); innerMat.emissiveMap = innerTex.tex;
    const gInL = flatGeo(rrShape(-iw / 2, -ih / 2, iw / 2, ih, [sc, 0, 0, sc]), 20, 0, 0.5);
    const gInR = flatGeo(rrShape(0, -ih / 2, iw / 2, ih, [0, sc, sc, 0]), 20, 0.5, 1);
    const scrL = new THREE.Mesh(gInL, innerMat); scrL.position.set(halfW / 2, 0, t / 2 + 0.1); L.add(scrL);
    const scrR = new THREE.Mesh(gInR, innerMat); scrR.position.set(-halfW / 2, 0, t / 2 + 0.1); R.add(scrR);
    this.tag(scrL, 'screen'); this.tag(scrR, 'screen');
    this.screens.push({ ...innerTex, mat: innerMat, kind: 'duoInner' });

    // Außendisplay (Rückseite der linken Hälfte): reicht bis an die Scharnierkante, dort eckig
    const ow = halfW - 0.8 - 2.3, oh = h - 4.6;
    const outerTex = this.makeCanvas('duoOuter', Math.round(1024 * ow / oh), 1024);
    const outerMat = makeScreenMaterial(); outerMat.emissiveMap = outerTex.tex;
    // vor der Drehung gespiegelt: Scharnierseite links (-x)
    const scrO = new THREE.Mesh(flatGeo(rrShape(-halfW / 2 + 0.8, -oh / 2, ow, oh, [0.6, sc, sc, 0.6])), outerMat);
    scrO.rotation.y = Math.PI; scrO.position.set(0, 0, -t / 2 - 0.11);
    this.tag(scrO, 'screen'); L.add(scrO);
    this.screens.push({ ...outerTex, mat: outerMat, kind: 'duoOuter', mmW: ow });

    // Scharnierabdeckung (Titan) – Geometrie wird je Faltwinkel neu erzeugt
    const hinge = new THREE.Mesh(new THREE.BufferGeometry(), m.frame);
    this.tag(hinge, 'body');
    this.duo.hinge = hinge; this.duo.pivot = pivot; this.duo.L = L; this.duo.R = R;

    // Tasten / Ports / Kamera auf der rechten Hälfte
    this.addSideButtons(R, halfW, h, t, 0, true);
    this.addBottomPorts(R, halfW, h, t, 0);
    this.addCameras(R, halfW, h, t, 0);

    this.inner.add(R, pivot, hinge);
    this.dims = { w: p.w, h, d: p.d };
    this.applyFold();
  }

  applyFold() {
    if (!this.duo) return;
    const { halfW, t, gap, pivotZ, hinge, pivot } = this.duo;
    const h = this.p.h;
    const theta = Math.PI - (this.fold / 180) * Math.PI;   // 0 = flach, π = zu
    pivot.rotation.y = theta;
    const f = theta / Math.PI;
    const g = THREE.MathUtils.smoothstep(f, 0.4, 1);
    // Profil der Abdeckung (x = nach außen, z = Tiefe): zu = flache, durchgehende Seitenfläche
    const xOut = THREE.MathUtils.lerp(0.2, 1.8, g), xIn = 0.6;
    const zc = THREE.MathUtils.lerp(0, pivotZ, g);
    const D = THREE.MathUtils.lerp(t - 1.4, 2 * t + gap, g);
    const r = Math.min(1.3, D / 2 - 0.05, (xOut + xIn) / 2 - 0.01);
    const shape = rrShape(-xOut, zc - D / 2, xOut + xIn, D, [r, 0.2, 0.2, r].map((v) => Math.max(0.05, v)));
    const hs = h - 1.6;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: hs - 1.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.3, bevelSegments: 3, curveSegments: 10 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, (hs - 1.2) / 2, 0);
    hinge.geometry.dispose();
    hinge.geometry = geo;
    hinge.visible = g > 0.02;
    // Zentrieren
    const tipX = -halfW * Math.cos(theta);
    const left = Math.min(-xOut * (g > 0.5 ? 1 : 0), tipX), right = halfW;
    this.inner.position.x = -(left + right) / 2;
    this.inner.position.z = -((t + gap) / 2) * f;
    this.footW = right - left;
    this.footD = THREE.MathUtils.lerp(t, 2 * t + gap, f) + Math.abs(Math.sin(theta)) * halfW;
  }

  // -------------------------------------------------------------- Bausteine
  tag(mesh, part) { mesh.userData.part = part; mesh.userData.phone = this; this.pickables.push(mesh); }

  makeCanvas(kind, W, H) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas, tex, ctx: canvas.getContext('2d'), kind };
  }

  // Farbige Bänder im Gehäuse: Kunststoffteil (iPhone 2007), Antennenlinien, Antennenschlitze (4/4S)
  bodyBands(w, h, d) {
    const p = this.p, st = p.style || '', b = [];
    const band = (yc, width, mi) => b.push({ y0: yc - width / 2, y1: yc + width / 2, mi });
    if (st === 'orig') b.push({ y0: -h, y1: -h / 2 + 22, mi: 1 });
    else if (st === 'g4') {
      band(-h / 2 + 13, 1.0, 3);
      if (p.id === '4s') band(h / 2 - 12, 1.0, 3); else band(h / 2 - 1.2, 1.0, 3);
    } else if (st === 'g6') { band(h / 2 - 10.4, 1.1, 2); band(-h / 2 + 10.4, 1.1, 2); }
    else if (st === 'g7') { band(h / 2 - 3.2, 1.0, 2); band(-h / 2 + 3.2, 1.0, 2); }
    else if (p.year >= 2017 && p.front !== 'home') { band(h / 2 - 10.5, 0.9, 2); band(-h / 2 + 10.5, 0.9, 2); }
    else if (p.front === 'home' && p.year >= 2017) { band(h / 2 - 9, 0.9, 2); band(-h / 2 + 9, 0.9, 2); }
    return b;
  }

  addScreen(kind, sw, sh, r, x, y, z, parent) {
    const W = 640, H = Math.round(640 * sh / sw);
    const c = this.makeCanvas(kind, W, H);
    const mat = makeScreenMaterial(); mat.emissiveMap = c.tex;
    const mesh = new THREE.Mesh(flatGeo(rrCentered(sw, sh, r), 24), mat);
    mesh.position.set(x, y, z);
    this.tag(mesh, 'screen');
    parent.add(mesh);
    this.screens.push({ ...c, mat, kind, sw, sh });
  }

  addButton(obj, id, axis, depth, pickMesh) {
    const meshes = [];
    obj.traverse(o => { if (o.isMesh) meshes.push(o); });
    (pickMesh ? [pickMesh, ...meshes] : meshes).forEach(mm => {
      mm.userData.part = 'btn'; mm.userData.btn = id; mm.userData.phone = this; this.pickables.push(mm);
    });
    this.buttons.push({ obj, id, base: obj.position.clone(), axis, depth, t: 0 });
  }

  sideCapsule(len, thick, prot) {
    const r = thick / 2;
    const g = new THREE.CapsuleGeometry(r, Math.max(0.1, len - 2 * r), 6, 16);
    g.scale(prot / r, 1, 1);
    return g;
  }

  addSideButtons(parent, w, h, d, ox, duo = false) {
    const p = this.p, m = this.m;
    const bt = Math.min(d * 0.42, 2.66);             // Tasten-Höhe (z) laut Apple-Zeichnung 2,66 mm
    const prot = 0.5;
    const Y = (fromTop) => h / 2 - fromTop;          // y aus Abstand zur Oberkante (mm)
    const scale = h / 146.7;
    // Tastenpositionen (Mitte ab Oberkante, Länge) – moderne Werte aus Apple Dimensional Drawings
    const eModel = p.id === '16e' || p.id === '17e';
    const modern = p.sw === 'action' && !eModel;
    const notchEra = p.front !== 'home' && p.sw === 'mute';
    let L;
    if (eModel) L = { sw: [31.3, 7.5], up: [45.4, 11.8], dn: [59.6, 11.8], pwr: [52.5, 18.3] };
    else if (modern) L = { sw: [34.2, 6.9], up: [48.3, 11.2], dn: [62.5, 11.2], pwr: [55.4, 17.7] };
    else if (notchEra && p.front === 'island') L = { sw: [31.1, 6], up: [44.6, 11.8], dn: [58.8, 11.8], pwr: [55.5, 18.3] };   // 14 Pro / 15 (Apple-Zeichnung)
    else if (notchEra) L = { sw: [26.0, 5.7], up: [38.3, 11.7], dn: [53.3, 11.7], pwr: [46.3, 17.8] };                        // X – 14 (Zeichnung iPhone 12)
    else {
      const top = p.pwr === 'top';
      const vl = (p.year <= 2009 ? 9 : p.year >= 2016 ? 10.5 : 8.5) * Math.min(1.1, scale);
      const y0 = h * (top ? 0.24 : 0.27);
      L = { sw: [h * (top ? 0.13 : 0.17), 5.6], up: [y0, vl], dn: [y0 + vl + 3.5, vl], pwr: [h * 0.25, (p.year >= 2014 ? 10.5 : 10) * Math.min(1.08, scale)] };
    }

    if (!duo) {
      if (p.sw === 'mute') {
        const y = Y(L.sw[0]);
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.4, L.sw[1], bt * 0.9), m.dark);
        slot.position.set(-w / 2 + 0.1, y, 0); parent.add(slot);
        const og = new THREE.Mesh(new THREE.PlaneGeometry(L.sw[1] * 0.45, bt * 0.35), m.orange);
        og.rotation.y = -Math.PI / 2; og.position.set(-w / 2 - 0.12, y, -bt * 0.22); parent.add(og);
        const knob = new THREE.Mesh(new THREE.BoxGeometry(1.0, L.sw[1] * 0.55, bt * 0.42), m.frame);
        knob.position.set(-w / 2 - 0.2, y, -bt * 0.2);
        parent.add(knob);
        knob.userData.muteZ = [-bt * 0.2, bt * 0.2];
        this.muteKnob = knob;
        this.addButton(knob, 'mute', new THREE.Vector3(1, 0, 0), 0);
      } else if (p.sw === 'action') {
        const b = new THREE.Mesh(this.sideCapsule(L.sw[1], bt, prot), m.frame);
        b.position.set(-w / 2, Y(L.sw[0]), 0); parent.add(b);
        this.addButton(b, 'action', new THREE.Vector3(1, 0, 0), 0.4);
      }
      if (p.volStyle === 'rocker') L.dn = [L.up[0] + L.up[1] * 0.98, L.up[1]];
      const round = p.volStyle === 'round';
      const rgeo = () => { const g = new THREE.CylinderGeometry(2.25, 2.25, prot * 2, 36); g.rotateZ(Math.PI / 2); return g; };
      const upMat = p.style === 'g3' || p.style === 'orig' ? m.chrome : m.frame;
      const up = new THREE.Mesh(round ? rgeo() : this.sideCapsule(L.up[1], bt, prot), upMat);
      const dn = new THREE.Mesh(round ? rgeo() : this.sideCapsule(L.dn[1], bt, prot), upMat);
      if (round) { L.up = [L.up[0], 5]; L.dn = [L.up[0] + 9.5, 5]; }
      up.position.set(-w / 2, Y(L.up[0]), 0);
      dn.position.set(-w / 2, Y(L.dn[0]), 0);
      parent.add(up, dn);
      this.addButton(up, 'volup', new THREE.Vector3(1, 0, 0), 0.4);
      this.addButton(dn, 'voldown', new THREE.Vector3(1, 0, 0), 0.4);
    } else {
      // Duo: Lautstärke oben auf der rechten Hälfte (nahe Außenkante)
      const vg = this.sideCapsule(10, bt, prot);
      const up = new THREE.Mesh(vg, m.frame), dn = new THREE.Mesh(vg.clone(), m.frame);
      up.rotation.z = Math.PI / 2; dn.rotation.z = Math.PI / 2;
      up.position.set(w / 2 - 30, h / 2, 0); dn.position.set(w / 2 - 17, h / 2, 0);
      parent.add(up, dn);
      this.addButton(up, 'volup', new THREE.Vector3(0, -1, 0), 0.4);
      this.addButton(dn, 'voldown', new THREE.Vector3(0, -1, 0), 0.4);
    }

    // Power / Seitentaste
    if (p.pwr === 'top') {
      const b = new THREE.Mesh(this.sideCapsule(10, bt, prot), m.frame);
      b.rotation.z = Math.PI / 2;
      b.position.set(w / 2 - 14, h / 2, 0); parent.add(b);
      this.addButton(b, 'pwr', new THREE.Vector3(0, -1, 0), 0.4);
    } else {
      const len = duo ? 16 : L.pwr[1];
      const b = new THREE.Mesh(this.sideCapsule(len, bt, prot), duo ? m.ring : m.frame);
      b.position.set(w / 2, duo ? Y(28) : Y(L.pwr[0]), 0); parent.add(b);
      this.addButton(b, 'pwr', new THREE.Vector3(-1, 0, 0), 0.4);
    }
    // Kamerasteuerung (Saphirglas, bündig) – Mitte 51,5 mm über Unterkante
    if (p.cc) {
      const g = new THREE.BoxGeometry(0.5, duo ? 15 : 17.1, bt * 0.85);
      const b = new THREE.Mesh(g, m.sapphire);
      b.position.set(w / 2 - 0.05, duo ? -h / 2 + 38 : -h / 2 + 51.5, 0); parent.add(b);
      this.addButton(b, 'cc', new THREE.Vector3(-1, 0, 0), 0.25);
    }
  }

  addBottomPorts(parent, w, h, d, ox) {
    const p = this.p, m = this.m;
    const addOnBottom = (geo, x, mat = m.dark) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2; mesh.position.set(x, -h / 2 - 0.04, 0); parent.add(mesh); return mesh;
    };
    const addOnTop = (geo, x) => {
      const mesh = new THREE.Mesh(geo, m.dark);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, h / 2 + 0.04, 0); parent.add(mesh); return mesh;
    };
    const port = p.port || '';
    const ph = Math.min(d * 0.4, 2.6);
    if (port.startsWith('30')) addOnBottom(flatGeo(rrCentered(21, ph, ph / 2 - 0.1)), 0);
    else if (port.startsWith('Lightning')) addOnBottom(flatGeo(rrCentered(7.8, Math.min(ph, 1.6), 0.75)), 0);
    else addOnBottom(flatGeo(rrCentered(8.9, Math.min(ph, 2.5), 1.2)), 0);
    // Lautsprecher-/Mikrofonlöcher
    const hole = new THREE.CircleGeometry(Math.min(0.6, d * 0.08), 12);
    const n = port.startsWith('30') ? 0 : 6;
    for (let i = 0; i < n; i++) {
      addOnBottom(hole, 8 + i * 1.9);
      if (i < (p.year >= 2016 ? 6 : 2)) addOnBottom(hole, -8 - i * 1.9);
    }
    if (p.jack === 'top') addOnTop(new THREE.CircleGeometry(1.8, 24), -w / 2 + 11);
    if (p.jack === 'bottom') addOnBottom(new THREE.CircleGeometry(1.8, 24), -w / 2 + 11);
    if (port.startsWith('30')) { addOnBottom(hole, 14); addOnBottom(hole, -14); }
  }

  // Kameras (Rückseite, z = -d/2). Koordinaten aus Sicht von hinten:
  // u = Abstand von der (hinten gesehen) linken Kante, v = Abstand von der Oberkante (mm).
  // Werte für aktuelle Modelle aus den Apple Dimensional Drawings.
  addCameras(parent, w, h, d, ox) {
    const p = this.p, m = this.m;
    const zb = -d / 2;
    const P = (u, v) => new THREE.Vector3(-u, v, 0);           // alte Hilfsfunktion (u = Back-X)
    const TL = (du, dv) => P(-w / 2 + du, h / 2 - dv);
    const UV = (u, v, z = 0) => new THREE.Vector3(w / 2 - u, h / 2 - v, z); // Weltposition aus u/v
    const lens = (pos, r, bump) => {
      const g = new THREE.Group();
      const ringM = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.55, r + 0.65, bump + 0.3, 48, 1, true), m.ring);
      ringM.rotation.x = Math.PI / 2; ringM.position.z = -(bump + 0.3) / 2; g.add(ringM);
      const lip = new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r + 0.55, 48), m.ring);
      lip.rotation.y = Math.PI; lip.position.z = -(bump + 0.3); g.add(lip);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.97, 48), m.lensGlass);
      glass.rotation.y = Math.PI; glass.position.z = -(bump + 0.15); g.add(glass);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(r * 0.42, 32), m.lensInner);
      inner.rotation.y = Math.PI; inner.position.z = -(bump + 0.05); g.add(inner);
      g.position.set(pos.x, pos.y, zb + (pos.z || 0)); parent.add(g); return g;
    };
    const dot = (pos, r, mat, lift = 0.14) => {
      const c = new THREE.Mesh(new THREE.CircleGeometry(r, 28), mat);
      c.rotation.y = Math.PI; c.position.set(pos.x, pos.y, zb - lift); parent.add(c); return c;
    };
    const plate = (center, pw, ph, pr, depth, mat) => {
      const shape = rrCentered(pw, ph, pr);
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3, curveSegments: 24 });
      const mesh = new THREE.Mesh(g, mat);
      mesh.rotation.y = Math.PI; mesh.position.set(center.x, center.y, zb + 0.1);
      this.tag(mesh, 'body'); parent.add(mesh); return depth + 0.3;
    };
    // Plateau aus u/v-Rechteck; radii [tl,tr,br,bl] aus Sicht von hinten; base = Starthöhe über Rückseite
    const slab = (u0, v0, u1, v1, radii, depth, mat, base = 0, bevel = 0.4) => {
      const X0 = -w / 2 + u0, X1 = -w / 2 + u1, Y0 = h / 2 - v1, Y1 = h / 2 - v0;
      const shape = rrShape(X0 + bevel, Y0 + bevel, X1 - X0 - 2 * bevel, Y1 - Y0 - 2 * bevel,
        (Array.isArray(radii) ? radii : [radii, radii, radii, radii]).map(r => Math.max(0.2, r - bevel)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.05, depth - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 28 });
      g.translate(0, 0, bevel);
      const mesh = new THREE.Mesh(g, mat);
      mesh.rotation.y = Math.PI; mesh.position.set(0, 0, zb - base + 0.05);
      this.tag(mesh, 'body'); parent.add(mesh);
      return base + depth;
    };
    const flash = (pos, r = 1.5, lift = 0.16) => { const f = dot(pos, r, m.flash, lift); this.flashMesh = f; return f; };
    const L = p.camLayout;
    const plateMat = p.alubody ? m.frame : m.back;
    const glassDark = L === 'pro-plateau'
      ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.color[1]).multiplyScalar(0.8), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.7 })
      : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.color[1]).multiplyScalar(0.55), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.3 });
    this.m.glassDark = glassDark;

    const specRef = CAMSPEC_MAP[p.id];
    if (specRef) {
      const [key, k] = specRef, S = CAMSPEC[key], K = (v) => v * k;
      const o = S.o.map(K), i = S.i.map(K);
      const ro = Math.min(o[2] - o[0], o[3] - o[1]) * 0.27, ri = Math.min(i[2] - i[0], i[3] - i[1]) * 0.23;
      const outerMat = S.pro ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.color[1]), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.1 }) : m.back;
      const innerMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.color[1]).multiplyScalar(S.pro ? 0.9 : 0.94), roughness: S.pro ? 0.45 : 0.35, metalness: S.pro ? 0.35 : 0.1, clearcoat: 0.5 });
      this.m.camOuter = outerMat; this.m.camInner = innerMat;
      const b1 = slab(o[0], o[1], o[2], o[3], [Math.max(ro, p.corner - o[0] - 0.5), ro, ro, ro], S.pro ? 1.2 : 0.9, outerMat);
      const b2 = slab(i[0], i[1], i[2], i[3], [Math.max(ri, p.corner - i[0] - 1.5), ri, ri, ri], S.pro ? 0.5 : 0.35, innerMat, b1);
      S.L.forEach(([u, v, dd]) => lens(UV(K(u), K(v), -b2), K(dd) / 2 - 0.6, S.pro ? 1.6 : 1.1));
      flash(UV(K(S.f[0]), K(S.f[1])), K(S.f[2]) / 2 - 0.25, b2 + 0.05);
      if (S.mic) dot(UV(K(S.mic[0]), K(S.mic[1])), Math.max(0.35, K(S.mic[2]) / 2), m.dark, b2 + 0.05);
      if (S.lidar) dot(UV(K(S.lidar[0]), K(S.lidar[1])), K(S.lidar[2]) / 2, m.lensInner, b2 + 0.05);
    } else if (L === 'single') {
      const off = p.year <= 2009 ? 8 : 9.5;
      const r = p.year <= 2009 ? 1.6 : p.year >= 2014 ? 2.6 : 2.2;
      lens(TL(off, off), r, p.bump ? 0.8 : 0.02);
      if (p.year >= 2010) {
        dot(TL(off + 5, off), 0.45, m.dark);                                   // Mikrofon
        flash(TL(off + (p.year >= 2014 ? 10 : 8.5), off), p.year >= 2013 ? 1.5 : 1.25);   // Blitz rechts daneben
      }
    } else if (L === 'single-flat') {
      // iPhone 16e / 17e: Einzelobjektiv Ø14,97 bei (13,32 | 13,32), steht 1,68 mm vor
      lens(UV(13.32, 13.32), 14.97 / 2 - 0.6, 1.4);
      dot(UV(24.3, 13.32), 0.65, m.dark);
      flash(UV(29.68, 13.32), 3.75 / 2);
    } else if (L === 'dual-h') {
      const pz = plate(TL(16, 10), 26, 11.5, 5.75, 0.6, m.back);
      lens(Object.assign(TL(10, 10), { z: -pz }), 3.6, 0.5); lens(Object.assign(TL(21.5, 10), { z: -pz }), 3.6, 0.5);
      flash(TL(31, 10), 1.5);
    } else if (L === 'dual-v') {
      const pz = plate(TL(10.5, 17.5), 12, 27, 6, 0.7, m.back);
      lens(Object.assign(TL(10.5, 11), { z: -pz }), 3.8, 0.4); lens(Object.assign(TL(10.5, 24), { z: -pz }), 3.8, 0.4);
      flash(TL(10.5, 17.5), 1.1, pz + 0.12);
    } else if (L === 'dual-sq' || L === 'dual-diag') {
      const s = w * 0.4, c = TL(4 + s / 2, 4 + s / 2);
      const pz = plate(c, s, s, s * 0.25, 1.0, m.back);
      const q = s * 0.24, r = s * 0.19;
      const a = P(-w / 2 + 4 + s / 2 - q, h / 2 - 4 - s / 2 + q);
      const b = L === 'dual-sq' ? P(-w / 2 + 4 + s / 2 - q, h / 2 - 4 - s / 2 - q) : P(-w / 2 + 4 + s / 2 + q, h / 2 - 4 - s / 2 - q);
      a.z = b.z = -pz; lens(a, r, 0.9); lens(b, r, 0.9);
      const fpos = P(-w / 2 + 4 + s / 2 + q, h / 2 - 4 - s / 2 + q);
      flash(fpos, 1.5, pz + 0.12);
      const mic = L === 'dual-sq' ? P(-w / 2 + 4 + s / 2 + q, h / 2 - 4 - s / 2 - q) : P(-w / 2 + 4 + s / 2 - q, h / 2 - 4 - s / 2 - q);
      dot(mic, 0.5, m.dark, pz + 0.12);
    } else if (L === 'triple-sq') {
      // Referenz iPhone 16 Pro (Apple-Zeichnung), ältere Pro-Modelle skaliert
      const k = p.camScale || (p.year <= 2020 ? 0.8 : p.year === 2021 ? 0.93 : p.year <= 2023 ? 0.97 : 1);
      const S = (x) => x * k;
      const top = slab(S(1.04), S(1.04), S(45.22), S(46.54), [p.corner - 1, S(9), S(9), S(9)], p.bigBump ? 1.6 : 1.1, m.back);
      const top2 = slab(S(4.7), S(4.7), S(41.56), S(42.88), S(7.2), 0.35, glassDark, top);
      const r = S(16.2) / 2 - 0.6;
      [[14.17, 14.17], [14.17, 33.41], [32.16, 23.79]].forEach(([u, v]) => lens(UV(S(u), S(v), -top2), r, p.bigBump ? 1.9 : 1.2));
      flash(UV(S(32.16), S(10.22)), S(6.92) / 2 - 0.3, top2 + 0.05);
      dot(UV(S(38.0), S(34.14)), 0.45, m.dark, top2 + 0.05);
      if (p.lidar) dot(UV(S(32.3), S(37.6)), S(5.2) / 2, m.lensInner, top2 + 0.05);
    } else if (L === 'pill-v') {
      // iPhone 16 / 16 Plus / 17 – Maße aus Apple-Zeichnung iPhone 17
      const b1 = slab(1.18, 1.34, 26.06, 43.62, 12.4, 0.7, m.back);
      const b2 = slab(3.79, 3.97, 23.45, 40.99, 9.8, 0.9, glassDark, b1);
      lens(UV(13.62, 13.62, -b2), 8 - 0.6, 1.0);
      lens(UV(13.62, 31.34, -b2), 8 - 0.6, 1.0);
      dot(UV(20.54, 22.48), 0.5, m.dark, b2 + 0.05);
      flash(UV(30.41, 22.48), 6.28 / 2);
    } else if (L === 'air-bar') {
      // iPhone Air: Plateau über volle Breite (bis 34 mm), darauf Glas-Pille
      const b1 = slab(0.3, 0.3, w - 0.3, 34, [p.corner - 0.3, p.corner - 0.3, 5, 5], 1.6, m.frame);
      const b2 = slab(5.0, 4.6, w - 4.4, 28.0, 11.6, 1.2, glassDark, b1);
      lens(UV(16.29, 16.29, -b2), 15.82 / 2 - 0.6, 1.4);
      dot(UV(51.34, 16.29), 1.15, m.dark, b2 + 0.05);
      flash(UV(58.42, 16.29), 6.3 / 2, b2 + 0.05);
    } else if (L === 'pro-plateau') {
      // iPhone 17 Pro / 18 Pro (+ Max): Plateau über volle Breite, Maße aus Apple-Zeichnung
      const is18 = p.id.startsWith('18');
      const b1 = slab(0.3, 0.3, w - 0.3, 47.2, [p.corner - 0.3, p.corner - 0.3, 6, 6], 1.9, plateMat);
      const b2 = slab(5.0, 5.1, w - 5.5, 42.4, 8, 0.4, glassDark, b1);
      const r = (is18 ? 16.58 : 16.2) / 2 - 0.6;
      [[14.37, 14.37], [14.37, 33.61], [is18 ? 32.49 : 32.36, 23.99]].forEach(([u, v]) => lens(UV(u, v, -b2), r, 1.9));
      const fx = w - 13.9;
      flash(UV(fx, 13.82), (is18 ? 6.9 : 6.8) / 2, b2 + 0.05);
      dot(UV(fx, 23.99), 0.55, m.dark, b2 + 0.05);
      dot(UV(fx, 34.16), (is18 ? 6.9 : 6.65) / 2, m.lensInner, b2 + 0.05);
      // Glasfläche (MagSafe-Fenster) im Aluminium-Unibody
      const gTop = h / 2 - 47.2 - 5, gBot = -h / 2 + 9;
      // Mattes, leicht aufgehelltes Ceramic-Shield-Glas mit feiner Fuge zum Aluminium
      const base = new THREE.Color(this.color[1]);
      const hsl = {}; base.getHSL(hsl);
      const glassCol = base.clone().multiplyScalar(0.93).lerp(new THREE.Color('#ffffff'), hsl.l < 0.25 ? 0.03 : 0.02);
      const seam = new THREE.Mesh(flatGeo(rrCentered(w - 11.2, gTop - gBot + 0.8, 6.4)), new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.55), roughness: 0.6 }));
      seam.rotation.y = Math.PI; seam.position.set(0, (gTop + gBot) / 2, zb - 0.08); parent.add(seam);
      const gm = new THREE.Mesh(flatGeo(rrCentered(w - 12, gTop - gBot, 6)), new THREE.MeshPhysicalMaterial({
        color: glassCol, roughness: 0.52, metalness: 0.78, clearcoat: 0.45, clearcoatRoughness: 0.5, envMapIntensity: 1.05,
      }));
      gm.rotation.y = Math.PI; gm.position.set(0, (gTop + gBot) / 2, zb - 0.12); parent.add(gm);
    } else if (L === 'duo-bar') {
      // iPhone Duo: kompakte, quer liegende Kamera-Pille nahe der Außenkante (nach Apple-Produktbildern)
      const b1 = slab(3.8, 2.9, 61, 26, 11.5, 1.5, m.back);
      lens(UV(14.3, 14.45, -b1), 8 - 0.6, 1.5);
      lens(UV(32.9, 14.45, -b1), 8 - 0.6, 1.5);
      flash(UV(49, 11.3), 1.9, b1 + 0.05);
      dot(UV(49, 18.8), 0.6, m.dark, b1 + 0.05);
    }
    this.addLogo(parent, w, h, zb);
  }

  addLogo(parent, w, h, zb) {
    const p = this.p;
    const [cy, lh] = logoSpec(p, h, w);
    const base = new THREE.Color(this.color[1]);
    const hsl = {}; base.getHSL(hsl);
    // poliertes Logo: auf Glas farblich passend glänzend, auf Alu/Kunststoff (ältere) spiegelnd
    const polished = (!p.glassBack && !p.alubody) || p.year < 2017;
    const mat = new THREE.MeshPhysicalMaterial({
      color: polished ? new THREE.Color('#c9c9cc').lerp(base, 0.25) : base.clone().lerp(new THREE.Color(hsl.l < 0.3 ? '#9a9aa0' : '#ffffff'), 0.18),
      metalness: polished ? 1 : 0.85, roughness: polished ? 0.1 : 0.16, clearcoat: 1, clearcoatRoughness: 0.05,
      alphaMap: getLogoTex(), transparent: true, depthWrite: false,
    });
    this.m.logo = mat;
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(lh * LOGO_ASPECT, lh), mat);
    logo.rotation.y = Math.PI;
    logo.position.set(0, h / 2 - cy, zb - 0.2);
    logo.castShadow = false;
    parent.add(logo);
  }

  // -------------------------------------------------------------- Zustand/Interaktion
  setOn(on) {
    this.state.on = on;
    if (on && this.state.ui !== 'home' && this.state.ui !== 'camera') this.state.ui = 'lock';
    if (!on) { this.state.ui = 'lock'; this.state.overlay = null; }
    this.redraw();
  }

  setFoldTarget(a) { this.foldTarget = a; }

  press(id) {
    const s = this.state, p = this.p;
    const b = this.buttons.find(x => x.id === id);
    if (b) b.t = 1;
    const now = performance.now();
    const showOverlay = (o, ms = 1400) => { s.overlay = o; s.overlayUntil = now + ms; };
    switch (id) {
      case 'pwr':
        if (s.on) { this.setOn(false); return 'Display aus'; }
        s.on = true; s.ui = p.bio.startsWith('Touch ID (Seite') ? 'home' : 'lock';
        if (s.ui === 'home') showOverlay('touchid', 1200);
        break;
      case 'home':
        if (!s.on) { s.on = true; s.ui = 'lock'; }
        else if (s.ui === 'lock') { s.ui = 'home'; if (p.bio.startsWith('Touch')) showOverlay('touchid', 1000); }
        else s.ui = 'home';
        break;
      case 'volup': case 'voldown':
        s.vol = Math.max(0, Math.min(16, s.vol + (id === 'volup' ? 1 : -1)));
        if (s.ui === 'camera' && s.on) { s.flashUntil = now + 180; }
        else if (s.on) showOverlay('vol');
        break;
      case 'mute': {
        s.silent = !s.silent;
        if (this.muteKnob) {
          const [zOn, zOff] = this.muteKnob.userData.muteZ;
          this.muteKnob.position.z = s.silent ? zOff : zOn;
          b.base.z = this.muteKnob.position.z;
        }
        if (s.on) showOverlay('mute');
        break;
      }
      case 'action':
        s.torch = !s.torch;
        if (s.on) showOverlay('torch');
        break;
      case 'cc':
        if (!s.on || s.ui !== 'camera') { s.on = true; s.ui = 'camera'; }
        else s.flashUntil = now + 180;
        break;
    }
    this.redraw();
    return null;
  }

  tapScreen() {
    const s = this.state;
    if (!s.on) { if (this.p.front !== 'home') { s.on = true; s.ui = 'lock'; } }
    else if (s.ui === 'lock') {
      s.ui = 'home';
      if (this.p.bio === 'Face ID') { s.overlay = 'faceid'; s.overlayUntil = performance.now() + 900; }
    }
    else if (s.ui === 'camera') s.flashUntil = performance.now() + 180;
    this.redraw();
  }

  redraw() {
    const s = this.state;
    for (const sc of this.screens) {
      let visible = s.on;
      if (sc.kind === 'duoInner') visible = s.on && this.fold > 12;
      if (sc.kind === 'duoOuter') visible = s.on && this.fold < 150;
      sc.target = visible ? 1 : 0;           // weiches Auf-/Abblenden in update()
      if (this._instant) sc.mat.emissiveIntensity = sc.target;
      if (visible) {
        drawScreen(sc.ctx, sc.canvas.width, sc.canvas.height, s, this.p, sc.kind, this.color);
        sc.tex.needsUpdate = true;
      }
    }
    if (this.m.flash) this.m.flash.emissiveIntensity = this.state.torch ? 3 : 0;
  }

  update(dt, now) {
    // Display weich auf-/abblenden
    for (const sc of this.screens) {
      const t = sc.target ?? 0, cur = sc.mat.emissiveIntensity;
      if (cur !== t) sc.mat.emissiveIntensity = Math.abs(t - cur) < 0.01 ? t : cur + (t - cur) * Math.min(1, dt * (t > cur ? 5 : 9));
    }
    // Tasten-Animation
    for (const b of this.buttons) {
      if (b.t > 0) {
        b.t = Math.max(0, b.t - dt * 7);
        const k = Math.sin(Math.min(1, b.t) * Math.PI / 2);
        b.obj.position.copy(b.base).addScaledVector(b.axis, b.depth * k);
      }
    }
    // Overlay-Ablauf / Kamera-Blitz
    const s = this.state;
    if ((s.overlay && now > s.overlayUntil) || (s.flashUntil && now > s.flashUntil)) {
      if (s.overlay && now > s.overlayUntil) s.overlay = null;
      if (s.flashUntil && now > s.flashUntil) s.flashUntil = 0;
      this.redraw();
    }
    // Uhrzeit aktualisieren (1×/Minute)
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== this._minute) { this._minute = minute; if (s.on) this.redraw(); }
    // Duo falten
    if (this.duo && Math.abs(this.fold - this.foldTarget) > 0.05) {
      const prevVisIn = this.fold > 12, prevVisOut = this.fold < 150;
      this.fold += (this.foldTarget - this.fold) * Math.min(1, dt * 6);
      if (Math.abs(this.fold - this.foldTarget) < 0.1) this.fold = this.foldTarget;
      this.applyFold();
      if (prevVisIn !== (this.fold > 12) || prevVisOut !== (this.fold < 150)) this.redraw();
    }
  }

  // Breite/Tiefe für das Layout
  footprint() {
    if (this.duo) return { w: this.footW, d: this.footD, h: this.p.h };
    return { w: this.p.w, d: this.p.d, h: this.p.h };
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
    });
    Object.values(this.m).forEach(mt => mt.dispose && mt.dispose());
    this.screens.forEach(s => { s.tex.dispose(); s.mat.dispose(); });
  }
}
