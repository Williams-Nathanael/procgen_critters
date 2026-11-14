// Robustness corpus: load -> place -> export -> re-open, for large and odd PDFs.
// Real-world files go in out/tmp/pdfs/ (see tools/fetch-test-pdfs.sh); missing ones are skipped.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { placeBorder } from '../src/place.js';
import { exportPdf } from '../src/export.js';
import { friendlyPdfError, looksLikePdf, looksEncrypted } from '../src/pdfio.js';

const DIR = 'out/tmp/pdfs';
mkdirSync(DIR, { recursive: true });
const P = f => `${DIR}/${f}`;
const log = (...a) => console.log(...a);

// ---------- generated cases
async function generate() {
  const mk = async (sizes) => {
    const d = await PDFDocument.create(), f = await d.embedFont(StandardFonts.Helvetica);
    sizes.forEach(([w, h, rot, box], i) => {
      const p = d.addPage([w, h]); p.drawText(`MIXEDPAGE ${i + 1}`, { x: 40, y: h - 60, size: 20, font: f });
      if (rot) p.setRotation(degrees(rot));
      if (box) p.setCropBox(...box);
    });
    return d.save();
  };
  writeFileSync(P('gen-mixed.pdf'), await mk([[612, 792], [595, 842, 90], [300, 400, 180], [792, 612, 270], [612, 792, 0, [50, 60, 400, 500]], [612, 792, 90, [50, 60, 400, 500]], [200, 200]]));
  writeFileSync(P('gen-blank-tiny.pdf'), await mk([[72, 72]]));
  const base = P('dl/form.pdf');
  if (existsSync(base)) {
    const q = (args) => { try { execFileSync('qpdf', args, { stdio: 'pipe' }); } catch (e) { if (e.status !== 3) throw e; } };
    q(['--encrypt', 'user123', 'owner123', '256', '--', base, P('gen-userpw.pdf')]);
    q(['--encrypt', '', 'owner123', '128', '--use-aes=y', '--modify=none', '--', base, P('gen-ownerpw.pdf')]);
  }
  const book = P('dl/book.pdf');
  if (existsSync(book)) { const b = readFileSync(book); writeFileSync(P('gen-truncated.pdf'), b.subarray(0, Math.floor(b.length * 0.6))); }
  writeFileSync(P('gen-notpdf.pdf'), 'PK\u0003\u0004 this is really not a pdf, just a zip-looking text file\n'.repeat(50));
  writeFileSync(P('gen-empty.pdf'), '');
}

// name, file, password, expect: 'ok' | 'open-fails' | 'export-fails'
const CASES = [
  ['book (800+ pages)', 'dl/book.pdf', null, 'ok'],
  ['tax form (fillable)', 'dl/form.pdf', null, 'ok'],
  ['scan (image heavy)', 'dl/scan.pdf', null, 'ok'],
  ['mixed sizes/rotations/crop', 'gen-mixed.pdf', null, 'ok'],
  ['tiny page', 'gen-blank-tiny.pdf', null, 'ok'],
  ['user password', 'gen-userpw.pdf', 'user123', 'export-fails'],
  ['owner password only', 'gen-ownerpw.pdf', null, 'export-fails'],
  ['truncated', 'gen-truncated.pdf', null, 'any-fail'],
  ['not a pdf', 'gen-notpdf.pdf', null, 'open-fails'],
  ['empty file', 'gen-empty.pdf', null, 'open-fails'],
];

const rings = (cx, cy, r) => [[[cx - r, cy], [cx, cy - r], [cx + r, cy], [cx, cy + r]]];
async function openJs(bytes, password) {
  const task = pdfjs.getDocument({ data: bytes.slice(), password: password || undefined, useSystemFonts: false, verbosity: 0, isEvalSupported: false });
  return task.promise;
}
async function textOf(doc, n) { const t = await (await doc.getPage(n)).getTextContent(); return t.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim(); }
async function opCount(doc, n) { return (await (await doc.getPage(n)).getOperatorList()).fnArray.length; }

let failed = 0;
async function run([name, file, pw, expect]) {
  const path = P(file);
  if (!existsSync(path)) { log(`SKIP  ${name}: ${path} missing`); return; }
  const t0 = Date.now(), fail = m => { failed++; log(`FAIL  ${name}: ${m}`); };
  const bytes = new Uint8Array(readFileSync(path));
  // ---- open
  let doc;
  try {
    if (!looksLikePdf(bytes)) throw Object.assign(new Error('no PDF header'), { name: 'InvalidPDFException' });
    doc = await openJs(bytes, pw);
  } catch (e) {
    const msg = friendlyPdfError(e, 'open');
    if (expect === 'open-fails' || expect === 'any-fail') { if (/Error|Exception|\bat\b.*\.js/.test(msg) && !/^Could not open/.test(msg)) fail('raw error leaks: ' + msg); else log(`ok    ${name}: open refused -> "${msg}"`); }
    else fail('open failed: ' + e.message);
    return;
  }
  if (expect === 'open-fails') return fail('opened but should not have');
  const N = doc.numPages;
  if (looksEncrypted(bytes) !== (expect === 'export-fails')) return fail('looksEncrypted gave the wrong answer');
  // ---- place on a spread of pages
  const picks = N <= 12 ? Array.from({ length: N }, (_, i) => i + 1) : [...new Set([1, 2, Math.ceil(N / 2), N])];
  const pages = [];
  for (const n of picks) {
    const pg = await doc.getPage(n), vp = pg.getViewport({ scale: 1 });
    const b = { kind: 'rect', pts: [[vp.width * 0.15, vp.height * 0.15], [vp.width * 0.85, vp.height * 0.85]], settings: { tags: ['mammal', 'fungus'], side: 'left', seed: n } };
    pages.push({ index: n - 1, toPdf: pt => vp.convertToPdfPoint(pt[0], pt[1]), critters: placeBorder(b, n).map(c => ({ rings: c.rings, ink: [0, 0, 0] })), strokes: [{ pts: [[vp.width * 0.15, vp.height * 0.15], [vp.width * 0.85, vp.height * 0.15]], closed: false, width: 0.6, ink: [0, 0, 0] }] });
    if (!pages.at(-1).critters.length) return fail(`nothing placed on page ${n}`);
  }
  // ---- export
  let out;
  try { out = await exportPdf(bytes, pages); }
  catch (e) {
    const msg = friendlyPdfError(e, 'export');
    if (expect === 'export-fails' || expect === 'any-fail') log(`ok    ${name}: export refused -> "${msg.slice(0, 90)}..."`);
    else fail('export threw: ' + e.message);
    return;
  }
  if (expect === 'export-fails') return fail('export of an encrypted file "succeeded" (would be garbage)');
  // ---- re-open and compare
  let doc2;
  try { doc2 = await openJs(out); } catch (e) { return fail('output does not re-open: ' + e.message); }
  if (doc2.numPages !== N) return fail(`page count ${N} -> ${doc2.numPages}`);
  for (const p of pages) {
    const n = p.index + 1;
    if ((await opCount(doc2, n)) <= (await opCount(doc, n))) return fail(`page ${n}: no critter operators added`);
    const a = await textOf(doc, n), b = await textOf(doc2, n);
    if (a !== b) return fail(`page ${n}: text changed (${a.length} -> ${b.length} chars)`);
    const v1 = (await doc.getPage(n)).getViewport({ scale: 1 }), v2 = (await doc2.getPage(n)).getViewport({ scale: 1 });
    if (Math.abs(v1.width - v2.width) + Math.abs(v1.height - v2.height) > 0.01) return fail(`page ${n}: size changed`);
  }
  // untouched pages survive too
  const mid = Math.min(N, 2); if (!picks.includes(mid) && (await textOf(doc, mid)) !== (await textOf(doc2, mid))) return fail('untouched page text changed');
  // form fields
  const fieldNames = async b => { const d = await PDFDocument.load(b, { updateMetadata: false }); return d.getForm().getFields().map(f => f.getName()).sort(); };
  const k1 = await fieldNames(bytes), k2 = await fieldNames(out);
  if (k1.join('|') !== k2.join('|')) return fail(`form fields ${k1.length} -> ${k2.length}`);
  const g1 = await doc.getFieldObjects(), g2 = await doc2.getFieldObjects();
  if (Object.keys(g1 || {}).length !== Object.keys(g2 || {}).length) return fail('pdf.js sees different form fields after export');
  // single-page export
  const one = await exportPdf(bytes, pages.slice(0, 1), { onlyIndex: 0 }); const d3 = await openJs(one);
  if (d3.numPages !== 1) return fail('single-page export has ' + d3.numPages + ' pages');
  writeFileSync(`out/tmp/pdfs/out-${file.replace(/[^\w.]/g, '_')}`, out);
  log(`ok    ${name}: ${N} pages, ${bytes.length >> 10} KiB -> ${out.length >> 10} KiB, ${k1.length} form fields, ${Date.now() - t0} ms`);
}

await generate();
for (const c of CASES) { try { await run(c); } catch (e) { failed++; log(`FAIL  ${c[0]}: unexpected ${e.stack || e}`); } }
log(failed ? `${failed} FAILED` : 'pdf corpus ok');
process.exit(failed ? 1 : 0);
