// End-to-end check without a browser: make a sample PDF, place borders, export, rasterise.
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { placeBorder } from '../src/place.js';
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
console.log('placed', pages.map(p => p.critters.length), 'in', Date.now() - t0, 'ms');
const outBytes = await exportPdf(src, pages);
writeFileSync('out/tmp/sample-out.pdf', outBytes);
console.log('pdf bytes', src.length, '->', outBytes.length);
execFileSync('pdftoppm', ['-r', '80', '-png', 'out/tmp/sample-out.pdf', 'out/tmp/sample-out']);
