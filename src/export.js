// Write placed critters into a PDF as vector paths. Pure (no DOM): works in browser and node.
import { PDFDocument, PDFOperator, PDFOperatorNames as Op, PDFNumber } from 'pdf-lib';

const num = v => PDFNumber.of(Math.round(v * 100) / 100);
const op = (name, ...args) => PDFOperator.of(name, args.map(num));

// pages: [{ index, toPdf: ([x,y]) => [X,Y], critters: [{rings}], strokes?: [{pts, closed, width}] }]
// `toPdf` maps our page coords (points, origin top-left of the *displayed* page, y down)
// into that page's PDF user space, accounting for crop box and rotation.
export async function exportPdf(srcBytes, pages, { ink = [0, 0, 0] } = {}) {
  const doc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  const docPages = doc.getPages();
  for (const pg of pages) {
    const page = docPages[pg.index];
    if (!page) continue;
    const ops = [op(Op.PushGraphicsState), op(Op.NonStrokingColorRgb, ...ink), op(Op.StrokingColorRgb, ...ink)];
    for (const c of pg.critters) {
      for (const ring of c.rings) {
        ring.forEach((pt, i) => { const [X, Y] = pg.toPdf(pt); ops.push(op(i ? Op.LineTo : Op.MoveTo, X, Y)); });
        ops.push(op(Op.ClosePath));
      }
      ops.push(op(Op.FillNonZero));
    }
    for (const s of pg.strokes || []) {
      ops.push(op(Op.SetLineWidth, s.width), op(Op.SetLineCapStyle, 1), op(Op.SetLineJoinStyle, 1));
      s.pts.forEach((pt, i) => { const [X, Y] = pg.toPdf(pt); ops.push(op(i ? Op.LineTo : Op.MoveTo, X, Y)); });
      if (s.closed) ops.push(op(Op.ClosePath));
      ops.push(op(Op.StrokePath));
    }
    ops.push(op(Op.PopGraphicsState));
    page.pushOperators(...ops);
  }
  return doc.save();
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
