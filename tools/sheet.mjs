// Contact-sheet renderer for reviewing generator output.
// usage: node tools/sheet.mjs out/name.png "salamander" "fungus+jansson" "fungus@*" "fungus@morel" ... [--n 10] [--seed 1] [--cell 150] [--detail 0.3]  [--pairs]
// rows: a tag, a +mix of tags, tag@* (one row per species), or tag@<species name>. Mix cells are captioned with
// the donor initials for chassis/head/limbs/tail/dorsal/crown.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TAG_NAMES, TAGS } from '../src/gen/tags/index.js';

const args = process.argv.slice(2);
const opt = { n: 10, seed: 1, cell: 150, detail: 0.3, labels: 1 };
const rows = []; let out = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pairs') opt.pairs = true;
  else if (args[i].startsWith('--')) opt[args[i].slice(2)] = Number(args[++i]);
  else if (!out) out = args[i]; else rows.push(args[i]);
}
const die = msg => { console.error('sheet: ' + msg); process.exit(1); };
const mixable = TAG_NAMES.filter(t => TAGS[t].sig);
if (opt.pairs) for (let a = 0; a < mixable.length; a++) for (let b = a + 1; b < mixable.length; b++) rows.push(`${mixable[a]}+${mixable[b]}`);
if (!rows.length) rows.push(...TAG_NAMES);
if (!out) die('usage: node tools/sheet.mjs out.png [rows...] [--pairs] [--n N] [--cell PX] [--seed S] [--detail D]');
// validate every row before rendering
for (const row of rows) {
  const [tagPart, species, ...extra] = row.split('@');
  const tags = tagPart.split('+');
  if (extra.length) die(`bad row "${row}": at most one @species`);
  for (const t of tags) if (!TAGS[t]) die(`unknown tag "${t}" in "${row}". Tags: ${TAG_NAMES.join(', ')}`);
  if (tags.length > 1) {
    for (const t of tags) if (!TAGS[t].sig) die(`tag "${t}" cannot be mixed (no sig) in "${row}". Mixable: ${mixable.join(', ')}`);
    if (species != null) die(`"${row}": pinning a species inside a mix is not supported (sheet-lib/makeCritter pin only the primary tag's species)`);
  } else if (species != null && species !== '*' && !TAGS[tags[0]].species.some(sp => sp.name === species)) {
    die(`no species "${species}" in tag "${tags[0]}". Valid: ${TAGS[tags[0]].species.map(sp => sp.name).join(', ')}`);
  }
}
// "tag@*" expands to one row per species of that tag; "tag@species name" pins one species
for (let i = rows.length - 1; i >= 0; i--) if (rows[i].endsWith('@*')) { const t = rows[i].slice(0, -2); rows.splice(i, 1, ...TAGS[t].species.map(sp => `${t}@${sp.name}`)); }
import { sheetSvg } from './sheet-lib.mjs';
let svg = sheetSvg(rows, opt);
const svgPath = out.replace(/\.png$/, '.svg');
writeFileSync(svgPath, svg);
if (out.endsWith('.png')) execFileSync('magick', ['-density', '96', svgPath, out]);
console.log('wrote', out);
