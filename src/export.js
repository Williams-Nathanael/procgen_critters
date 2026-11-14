// Write placed critters into a PDF as vector paths. Pure (no DOM): works in browser and node.
import { PDFDocument, EncryptedPDFError, PDFOperator, PDFOperatorNames as Op, PDFNumber } from 'pdf-lib';

const num = v => PDFNumber.of(Math.round(v * 100) / 100);
const op = (name, ...args) => PDFOperator.of(name, args.map(num));

// pages: [{ index, toPdf: ([x,y]) => [X,Y], critters: [{rings}], strokes?: [{pts, closed, width}] }]
// `toPdf` maps our page coords (points, origin top-left of the *displayed* page, y down)
// into that page's PDF user space, accounting for crop box and rotation.
export async function exportPdf(srcBytes, pages, { ink = [0, 0, 0], onlyIndex = null } = {}) {
  // Encrypted files cannot be edited: pdf-lib has no decryption, and writing plain content into
  // encrypted streams would give a file nothing can open. Fail clearly instead (see pdfio.js).
  let doc;
  try { doc = await PDFDocument.load(srcBytes, { updateMetadata: false }); }
  catch (e) { throw e instanceof EncryptedPDFError ? Object.assign(e, { code: 'ENCRYPTED' }) : e; }
  const docPages = doc.getPages();
  for (const pg of pages) {
    const page = docPages[pg.index];
    if (!page) continue;
    const ops = [op(Op.PushGraphicsState)];
    let cur = null;
    const setInk = rgb => { // critters/strokes may carry their own `ink` ([r,g,b] 0..1); default is the page-wide one
      const k = (rgb || ink).join(',');
      if (k !== cur) { cur = k; ops.push(op(Op.NonStrokingColorRgb, ...(rgb || ink)), op(Op.StrokingColorRgb, ...(rgb || ink))); }
    };
    for (const c of pg.critters) {
      setInk(c.ink);
      for (const ring of c.rings) {
        ring.forEach((pt, i) => { const [X, Y] = pg.toPdf(pt); ops.push(op(i ? Op.LineTo : Op.MoveTo, X, Y)); });
        ops.push(op(Op.ClosePath));
      }
      ops.push(op(Op.FillNonZero));
    }
    for (const s of pg.strokes || []) {
      setInk(s.ink);
      ops.push(op(Op.SetLineWidth, s.width), op(Op.SetLineCapStyle, 1), op(Op.SetLineJoinStyle, 1));
      s.pts.forEach((pt, i) => { const [X, Y] = pg.toPdf(pt); ops.push(op(i ? Op.LineTo : Op.MoveTo, X, Y)); });
      if (s.closed) ops.push(op(Op.ClosePath));
      ops.push(op(Op.StrokePath));
    }
    ops.push(op(Op.PopGraphicsState));
    page.pushOperators(...ops);
  }
  if (onlyIndex != null) for (let i = docPages.length - 1; i >= 0; i--) if (i !== onlyIndex) doc.removePage(i); // single-page export
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
