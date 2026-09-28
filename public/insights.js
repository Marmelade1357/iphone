// ============================================================================
// Abgeleitete Merkmale, Kernwerte und Upgrade-Argumente (für Beratung)
// ============================================================================
const nf = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

export const zoomOf = (p) => {
  const m = [...p.cam.matchAll(/(\d+(?:,\d+)?)\s*×\s*(?:Tele|Zoom|Tetra)/g)].map((x) => parseFloat(x[1].replace(',', '.')));
  if (m.length) return Math.max(...m);
  if (/Tele/.test(p.cam) || (p.camCount >= 3 && p.year < 2021)) return 2;
  return 1;
};
export const mpOf = (p) => Math.max(...[...p.cam.matchAll(/(\d+)\s*MP/g)].map((x) => +x[1]), 0);
export const hasUltraWide = (p) => /Ultraweit/.test(p.cam) || (p.camCount >= 3);
export const chipShort = (p) => p.chip.replace(/^Apple\s+/, '').replace(/^Samsung\s+/, '').replace(/\s*\(.*?\)/g, '').replace(/,.*$/, '').replace(/ Bionic| Fusion/, '');
export const aiReady = (p) => /A1[89]|A2\d|A17 Pro/.test(p.chip);
export const satellite = (p) => p.year >= 2022 && p.id !== 'se3';
export const is5G = (p) => /5G/.test(p.net);
export const usbC = (p) => /USB-C/.test(p.port);
export const magsafe = (p) => /MagSafe/.test(p.charge);
export const aod = (p) => /Always-On/.test(p.disp);
export const oled = (p) => /OLED/.test(p.disp);
export const baseStorageGB = (p) => { const [l] = p.prices[0]; const n = parseFloat(l); return /TB/.test(l) ? n * 1024 : n; };
export const displayOf = (p) => (p.foldable ? p.diagInner : p.diag);
const chipScore = (p) => p.year * 10 + (/Pro/.test(p.chip) ? 5 : 0) + (p.foldable ? 5 : 0);
const camScore = (p) => p.camCount * 100 + zoomOf(p) * 10 + mpOf(p) / 10 + (p.lidar ? 5 : 0);

// ---------------------------------------------------------------- 5 Kernwerte (Tischkarten)
// price: { value, text, sub }
export function keyValues(p, price) {
  const z = zoomOf(p);
  return [
    { k: 'Preis', t: price.text, sub: price.sub, n: price.value, better: 'low' },
    { k: 'Display', t: p.foldable ? `${nf(p.diagInner, 1)}″ innen` : `${nf(p.diag, 1)}″`, sub: `${oled(p) ? 'OLED' : 'LCD'} · ${p.hz} Hz${aod(p) ? ' · Always-On' : ''}`, n: displayOf(p), better: 'high' },
    { k: 'Kamera', t: `${p.camCount} × ${mpOf(p)} MP`, sub: z > 1 ? `bis ${nf(z, z % 1 ? 1 : 0)}× Zoom${p.lidar ? ' · LiDAR' : ''}` : 'ohne Zoom-Objektiv', n: camScore(p), better: 'high' },
    { k: 'Akku', t: p.video ? `${p.video} h` : '–', sub: 'Videowiedergabe', n: p.video, better: 'high' },
    { k: 'Chip', t: chipShort(p), sub: aiReady(p) ? 'Apple Intelligence' : String(p.year), n: chipScore(p), better: 'high' },
  ];
}
// bester Wert je Zeile (null = alle gleich / nur 1 Gerät)
export function bestIndices(rowsPerDevice) {
  const n = rowsPerDevice.length;
  if (n < 2) return rowsPerDevice[0].map(() => []);
  return rowsPerDevice[0].map((row, r) => {
    const vals = rowsPerDevice.map((d) => d[r].n);
    const valid = vals.filter((v) => typeof v === 'number');
    if (valid.length < 2 || new Set(valid).size < 2) return [];
    const best = row.better === 'low' ? Math.min(...valid) : Math.max(...valid);
    return vals.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
  });
}

// ---------------------------------------------------------------- Upgrade: was wird besser?
export function upgradeGains(from, to) {
  const plus = [], minus = [];
  const add = (cond, t, list = plus) => { if (cond) list.push(t); };
  // Akku
  const dv = (to.video || 0) - (from.video || 0);
  add(dv >= 2, `+${dv} h Akkulaufzeit (Video: ${from.video} → ${to.video} h)`);
  add(dv <= -2, `${Math.abs(dv)} h weniger Akkulaufzeit (Video)`, minus);
  // Kamera
  const zf = zoomOf(from), zt = zoomOf(to);
  add(zt > zf, `${nf(zt, zt % 1 ? 1 : 0)}× Zoom${zf > 1 ? ` statt ${nf(zf, zf % 1 ? 1 : 0)}×` : ' (bisher kein Zoom)'}`);
  add(zt < zf, `Weniger Zoom (${nf(zt, zt % 1 ? 1 : 0)}× statt ${nf(zf, zf % 1 ? 1 : 0)}×)`, minus);
  const mf = mpOf(from), mt = mpOf(to);
  add(mt > mf, `${mt}-MP-Hauptkamera statt ${mf} MP`);
  add(hasUltraWide(to) && !hasUltraWide(from), 'Ultraweitwinkel-Kamera (mehr aufs Bild)');
  add(to.camCount < from.camCount, `Weniger Kameras (${to.camCount} statt ${from.camCount})`, minus);
  add(to.lidar && !from.lidar, 'LiDAR-Scanner (bessere Porträts bei Nacht)');
  add(to.cc && !from.cc, 'Kamerasteuerung – Foto mit einem Klick');
  // Display
  const dd = displayOf(to) - displayOf(from);
  add(to.foldable && !from.foldable, `Faltbar: ${nf(to.diagInner || 0, 1)}″-Tablet-Display im Hosentaschen-Format`);
  add(!to.foldable && dd >= 0.2, `Größeres Display (${nf(displayOf(to), 1)}″ statt ${nf(displayOf(from), 1)}″)`);
  add(dd <= -0.2, `Kleineres Display (${nf(displayOf(to), 1)}″ statt ${nf(displayOf(from), 1)}″)`, minus);
  add(to.hz > from.hz, `ProMotion ${to.hz} Hz – flüssigeres Scrollen`);
  add(to.hz < from.hz, `Nur ${to.hz} Hz statt ${from.hz} Hz`, minus);
  add(aod(to) && !aod(from), 'Always-On-Display');
  add(oled(to) && !oled(from), 'OLED-Display statt LCD (echtes Schwarz)');
  add(to.front === 'island' && from.front !== 'island', 'Dynamic Island');
  // Bedienung / Ausstattung
  add(aiReady(to) && !aiReady(from), 'Apple Intelligence');
  add(is5G(to) && !is5G(from), '5G – schneller im Telekom-Netz');
  add(satellite(to) && !satellite(from), 'Notruf SOS & Unfallerkennung per Satellit');
  add(usbC(to) && !usbC(from), 'USB-C statt Lightning – ein Kabel für Mac, iPad & Co.');
  add(to.sw === 'action' && from.sw !== 'action', 'Action-Taste (frei belegbar)');
  add(magsafe(to) && !magsafe(from), 'MagSafe – magnetisches Laden & Zubehör');
  add(to.ip === 'IP68' && from.ip !== 'IP68', `Besser wassergeschützt (IP68 statt ${from.ip || 'ohne'})`);
  const sf = baseStorageGB(from), st = baseStorageGB(to);
  add(st > sf, `${st >= 1024 ? st / 1024 + ' TB' : st + ' GB'} Grundspeicher statt ${sf >= 1024 ? sf / 1024 + ' TB' : sf + ' GB'}`);
  add(chipShort(to) !== chipShort(from) && to.year - from.year >= 2, `${chipShort(to)} statt ${chipShort(from)} – spürbar schneller`);
  const dg = to.g - from.g;
  add(dg <= -10, `${-dg} g leichter`);
  add(dg >= 15, `${dg} g schwerer (${to.g} g)`, minus);
  // Hinweise für die Beratung
  add(from.front === 'home' && to.front !== 'home', 'Keine Home-Taste mehr – Bedienung per Wischgesten, Face ID', minus);
  add(from.bio.startsWith('Touch') && to.bio === 'Face ID' && from.front !== 'home', 'Face ID statt Touch ID', minus);
  add(/nur eSIM/.test(to.net) && !/nur eSIM/.test(from.net), 'Nur eSIM – SIM-Karte wird auf eSIM umgestellt', minus);
  add(usbC(to) && !usbC(from), 'Lightning-Kabel & -Zubehör passen nicht mehr', minus);
  add(from.jack && !to.jack, 'Kein 3,5-mm-Kopfhöreranschluss', minus);
  return { plus, minus };
}

// ---------------------------------------------------------------- Upgrade-Vorschläge
export const LINEUP = ['18pro', '18promax', 'duo', 'air', '17', '17e'];
export function defaultTargets(from) {
  if (!from) return ['18pro', '17e'];
  const big = displayOf(from) >= 6.5 && !from.foldable;
  const top = from.foldable ? 'duo' : big ? '18promax' : '18pro';
  const second = big ? '17' : '17e';
  return [top, second].filter((id) => id !== from.id).concat(from.id === top || from.id === second ? ['17'] : []).slice(0, 2);
}
