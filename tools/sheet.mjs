// Contact-sheet renderer for reviewing generator output.
// usage: node tools/sheet.mjs out/name.png "salamander" "fungus+jansson" "fungus@*" "fungus@morel" ... [--n 10] [--seed 1] [--cell 150] [--detail 0.3]
// rows: a tag, a +mix of tags, tag@* (one row per species), or tag@<species name>. Mix cells are captioned with
// the donor initials for chassis/head/limbs/tail/dorsal/crown.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TAG_NAMES, TAGS } from '../src/gen/tags/index.js';

const args = process.argv.slice(2);
const opt = { n: 10, seed: 1, cell: 150, detail: 0.3, labels: 1 };
const rows = []; let out = null;
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opt[args[i].slice(2)] = Number(args[++i]);
  else if (!out) out = args[i]; else rows.push(args[i]);
}
if (!rows.length) rows.push(...TAG_NAMES);
// "tag@*" expands to one row per species of that tag; "tag@species name" pins one species
for (let i = rows.length - 1; i >= 0; i--) if (rows[i].endsWith('@*')) { const t = rows[i].slice(0, -2); rows.splice(i, 1, ...TAGS[t].species.map(sp => `${t}@${sp.name}`)); }
import { sheetSvg } from './sheet-lib.mjs';
let svg = sheetSvg(rows, opt);
const svgPath = out.replace(/\.png$/, '.svg');
writeFileSync(svgPath, svg);
if (out.endsWith('.png')) execFileSync('magick', ['-density', '96', svgPath, out]);
console.log('wrote', out);
