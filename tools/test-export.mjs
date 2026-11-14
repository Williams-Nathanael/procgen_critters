// End-to-end check without a browser: make a sample PDF, place borders, export, rasterise.
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { placeBorder, stats } from '../src/place.js';
import { exportPdf, pageMapper } from '../src/export.js';

mkdirSync('out/tmp', { recursive: true });
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.TimesRoman);
const lorem = 'It was in the grey of the morning that the small folk of the margin came out to walk along the edge of the page, one after another, and nobody who read the text ever quite saw them arrive. ';
for (let n = 0; n < 2; n++) {
  const page = doc.addPage([612, 792]);
  let y = 792 - 110;
  const words = (lorem.repeat(9)).split(' '); let line = '';
  for (const w of words) { if (font.widthOfTextAtSize(line + w, 11) > 612 - 250) { page.drawText(line, { x: 125, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) }); y -= 15; line = ''; if (y < 110) break; } line += w + ' '; }
}
const src = await doc.save();
writeFileSync('out/tmp/sample.pdf', src);

const wav = []; for (let i = 0; i <= 60; i++) wav.push([70 + 6 * Math.sin(i / 4) + 14 * Math.sin(i / 11), 700 - i * 10]);
const borders = [
  { kind: 'rect', pts: [[100, 85], [512, 707]], settings: { tags: ['salamander'], side: 'left', seed: 3 } },
];
const borders2 = [
  { kind: 'free', pts: wav, settings: { tags: ['mammal', 'fungus'], side: 'left', seed: 5 } },
  { kind: 'line', pts: [[120, 740], [500, 740]], settings: { tags: ['jansson'], side: 'left', seed: 2, spacing: 60 } },
  { kind: 'ellipse', pts: [[530, 300], [600, 500]], settings: { tags: ['fungus', 'plant'], side: 'left', seed: 2, spacing: 50, size: 30 } },
  { kind: 'line', pts: [[500, 60], [120, 60]], settings: { tags: ['dragon', 'arthropod'], side: 'right', seed: 9 } },
];
const map = pageMapper([0, 0, 612, 792], 0);
const t0 = Date.now();
const pages = [borders, borders2].map((bs, index) => ({ index, toPdf: map, critters: bs.flatMap(b => placeBorder(b, index)), strokes: [] }));
console.log('generator calls', stats.made);
console.log('placed', pages.map(p => p.critters.length), 'in', Date.now() - t0, 'ms');

// ---- placement assertions ----
import assert from 'node:assert/strict';
import { borderPolyline, measure } from '../src/place.js';
const rowsOf = (items) => { const m = new Map(); for (const it of items) { const k = it.sideSign; (m.get(k) ?? m.set(k, []).get(k)).push(it); } for (const r of m.values()) r.sort((a, b) => a.s - b.s); return m; };
function checkBasics(name, b, { mixed = true } = {}) {
  const items = placeBorder(b, 0);
  assert(items.length > 3, `${name}: placed ${items.length}`);
  const L = measure(borderPolyline(b)).length, closed = borderPolyline(b).closed;
  for (const [sg, row] of rowsOf(items)) {
    for (let i = 0; i < row.length; i++) {
      const a = row[i], c = row[i + 1] ?? (closed && row.length > 2 ? row[0] : null);
      if (!c) continue;
      if (mixed) assert.notEqual(a.key, c.key, `${name}: same-species neighbours (row ${sg}, slots ${a.slot}/${c.slot})`);
      let d = c.s - a.s; if (d < 0) d += L;
      assert(d - (a.w + c.w) / 2 > -0.5, `${name}: critters overlap along the line (${a.slot}/${c.slot})`);
    }
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) assert(!boxesOverlap(items[i].box, items[j].box), `${name}: boxes overlap`);
  return items;
}
function boxesOverlap(A, B) { // same SAT as place.js, kept independent
  for (const poly of [A, B]) for (let i = 0; i < 4; i++) {
    const p = poly[i], q = poly[(i + 1) % 4], nx = q[1] - p[1], ny = p[0] - q[0];
    const pr = P => P.map(v => v[0] * nx + v[1] * ny);
    const a = pr(A), c = pr(B);
    if (Math.max(...a) <= Math.min(...c) || Math.max(...c) <= Math.min(...a)) return false;
  }
  return true;
}
const mix = ['mammal', 'fungus', 'plant'];
// box and oval: nothing pokes inside the line (outside is left)
const rectB = { kind: 'rect', pts: [[100, 100], [400, 400]], settings: { tags: mix, side: 'left', seed: 11 } };
const rItems = checkBasics('box', rectB);
for (const it of rItems) for (const ring of it.rings) for (const [x, y] of ring) assert(x < 100 + 2.5 || x > 400 - 2.5 || y < 100 + 2.5 || y > 400 - 2.5 || false, 'box: critter pokes through the line');
for (const it of rItems) { const [x, y] = it.at; const dc = Math.min(Math.hypot(x - 100, y - 100), Math.hypot(x - 400, y - 100), Math.hypot(x - 100, y - 400), Math.hypot(x - 400, y - 400)); assert(dc > it.w * 0.3, 'box: critter straddles a corner'); }
const ovalB = { kind: 'ellipse', pts: [[100, 100], [400, 300]], settings: { tags: mix, side: 'left', seed: 4 } };
for (const it of checkBasics('oval', ovalB)) for (const ring of it.rings) for (const [x, y] of ring) assert(((x - 250) / 150) ** 2 + ((y - 200) / 100) ** 2 > 0.97, 'oval: critter pokes through the line');
// tight scribble
const scr = []; for (let i = 0; i <= 80; i++) scr.push([100 + i * 4 + 25 * Math.sin(i / 2.3), 300 + 60 * Math.sin(i / 3.1) + 20 * Math.cos(i * 0.9)]);
checkBasics('scribble', { kind: 'free', pts: scr, settings: { tags: mix, side: 'left', seed: 7 } });
// both sides: rows staggered, not mirrored, and facing neighbours differ
const bothB = { kind: 'line', pts: [[50, 500], [550, 500]], settings: { tags: mix, side: 'both', seed: 5 } };
const bItems = checkBasics('both', bothB), rw = rowsOf(bItems);
assert(rw.size === 2, 'both: two rows');
for (const a of rw.get(-1)) { const near = rw.get(1).reduce((m, o) => Math.min(m, Math.abs(o.s - a.s)), Infinity); assert(near > 0.2 * (a.w), `both: rows mirrored at ${a.slot}`); }
for (const a of bItems) for (const o of bItems) if (a.sideSign !== o.sideSign && Math.abs(a.s - o.s) < (a.w + o.w) / 2) assert.notEqual(a.key, o.key, 'both: same species face to face');
// determinism, and edits stay local
const again = placeBorder(rectB, 0);
assert.deepEqual(again.map(i => [i.slot, i.seed]), rItems.map(i => [i.slot, i.seed]), 'placement not deterministic');
const edited = placeBorder({ ...rectB, overrides: { [rItems[3].slot]: { seed: 12345 } } }, 0);
assert.equal(edited.length, rItems.length, 'reroll changed the count');
rItems.forEach((it, i) => { if (i !== 3) assert.deepEqual([it.slot, it.seed, it.s], [edited[i].slot, edited[i].seed, edited[i].s], 'reroll reshuffled others'); });
const removed = placeBorder({ ...rectB, overrides: { [rItems[3].slot]: { skip: true } } }, 0);
assert.deepEqual(removed.map(i => i.slot), rItems.filter((_, i) => i !== 3).map(i => i.slot), 'removal reshuffled others');
console.log('placement assertions ok');

const outBytes = await exportPdf(src, pages);
writeFileSync('out/tmp/sample-out.pdf', outBytes);
console.log('pdf bytes', src.length, '->', outBytes.length);
execFileSync('pdftoppm', ['-r', '80', '-png', 'out/tmp/sample-out.pdf', 'out/tmp/sample-out']);
