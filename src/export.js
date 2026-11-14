// Write placed critters into a PDF as vector paths. Pure (no DOM): works in browser and node.
import { PDFDocument, EncryptedPDFError } from 'pdf-lib';

// pages: array, or (async) iterable so callers can build one page at a time and let its rings be
// garbage-collected: [{ index, toPdf: ([x,y]) => [X,Y], critters: [{rings, ink?}], strokes?: [{pts, closed, width, ink?}] }]
// `toPdf` maps our page coords (points, origin top-left of the *displayed* page, y down)
// into that page's PDF user space, accounting for crop box and rotation.
// Content is written as one plain-text, flate-compressed stream per page (cheap on memory).
const f2 = v => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? '0' : String(r); };
export async function exportPdf(srcBytes, pages, { ink = [0, 0, 0], onlyIndex = null, total = null, onProgress = () => {}, yieldUi = null } = {}) {
  // Encrypted files cannot be edited: pdf-lib has no decryption, and writing plain content into
  // encrypted streams would give a file nothing can open. Fail clearly instead (see pdfio.js).
  let doc;
  try { doc = await PDFDocument.load(srcBytes, { updateMetadata: false }); }
  catch (e) { throw e instanceof EncryptedPDFError ? Object.assign(e, { code: 'ENCRYPTED' }) : e; }
  const docPages = doc.getPages();
  if (total == null && Array.isArray(pages)) total = pages.length;
  let k = 0;
  for await (const pg of pages) {
    if (yieldUi && k % 8 === 0) { onProgress('Writing page ' + (pg.index + 1), total ? Math.min(1, k / total) : 0); await yieldUi(); }
    k++;
    const page = docPages[pg.index];
    if (!page) continue;
    const out = ['q'];
    let cur = null;
    const setInk = rgb => { // critters/strokes may carry their own `ink` ([r,g,b] 0..1); default is the page-wide one
      const c = rgb || ink, key = c.join(',');
      if (key !== cur) { cur = key; const t = c.map(f2).join(' '); out.push(t + ' rg', t + ' RG'); }
    };
    const path = (pts, close) => { pts.forEach((pt, i) => { const [X, Y] = pg.toPdf(pt); out.push(f2(X) + ' ' + f2(Y) + (i ? ' l' : ' m')); }); if (close) out.push('h'); };
    for (const c of pg.critters) {
      setInk(c.ink);
      for (const ring of c.rings) path(ring, true);
      out.push('f');
    }
    for (const s of pg.strokes || []) {
      setInk(s.ink);
      out.push(f2(s.width) + ' w 1 J 1 j');
      path(s.pts, s.closed); out.push('S');
    }
    out.push('Q');
    page.node.normalize(); // wraps the original content in q/Q so our drawing starts from a clean state
    page.node.addContentStream(doc.context.register(doc.context.flateStream(out.join('\n'))));
  }
  if (onlyIndex != null) for (let i = docPages.length - 1; i >= 0; i--) if (i !== onlyIndex) doc.removePage(i); // single-page export
  onProgress('Saving the PDF', 1); if (yieldUi) await yieldUi();
  return doc.save();
}

// '#rrggbb' -> [r,g,b] in 0..1 (black for anything unparseable)
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Mapping for a page given its PDF crop box [x0,y0,x1,y1] and /Rotate (0,90,180,270).
// Matches how viewers (and pdf.js) display the page at 1pt = 1 unit.
export function pageMapper(box, rotate = 0) {
  const [x0, y0, x1, y1] = box; const r = ((rotate % 360) + 360) % 360;
  if (r === 90) return ([x, y]) => [x0 + y, y0 + x];
  if (r === 180) return ([x, y]) => [x1 - x, y0 + y];
  if (r === 270) return ([x, y]) => [x1 - y, y1 - x];
  return ([x, y]) => [x0 + x, y1 - y];
}
