// ============================================================================
// Druck-/PDF-Ansicht: eine Seite mit Bild, Kernwerten und Datenblatt
// (Browser-Druckdialog → "Als PDF speichern")
// ============================================================================
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function printSheet({ title, img, body, landscape, note }) {
  const el = document.getElementById('printSheet');
  let style = document.getElementById('printPage');
  if (!style) { style = document.createElement('style'); style.id = 'printPage'; document.head.appendChild(style); }
  style.textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`;
  const d = new Date();
  el.className = landscape ? 'landscape' : 'portrait';
  el.innerHTML = `
    <header class="p-head">
      <img class="p-logo" src="assets/telekom-logo.svg" alt="">
      <div><h1>${esc(title)}</h1><p>Erstellt am ${d.toLocaleDateString('de-DE')} um ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · iPhone-Vergleich</p></div>
    </header>
    ${img ? `<img class="p-shot" src="${img}" alt="">` : ''}
    ${body}
    <footer class="p-foot">Preise: deutsche Apple-UVP zum Marktstart bzw. hinterlegte Telekom-Preise${note ? ' – ' + esc(note) : ''}. Angaben ohne Gewähr. Maße & Daten: Apple Tech Specs und Dimensional Drawings.</footer>`;
  const imgs = [...el.querySelectorAll('img')];
  Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))))
    .then(() => {
      // Auf eine Seite einpassen: Inhalt in Seitenbreite messen und bei Bedarf verkleinern
      const mmPx = 96 / 25.4, pageW = (landscape ? 277 : 190) * mmPx, pageH = (landscape ? 190 : 277) * mmPx;
      el.style.zoom = '';
      el.classList.add('measure'); el.style.width = `${pageW}px`;
      const h = el.scrollHeight;
      el.classList.remove('measure'); el.style.width = '';
      el.style.zoom = h > pageH ? String(Math.max(0.55, (pageH - 4) / h)) : '';
      setTimeout(() => window.print(), 50);
    });
}
