// Contact-sheet renderer for reviewing generator output.
// usage: node tools/sheet.mjs out/name.png "salamander" "fungus+jansson" "fungus@*" "fungus@morel" ... [--n 10] [--seed 1] [--cell 150] [--detail 0.3]
// rows: a tag, a +mix of tags, tag@* (one row per species), or tag@<species name>. Mix cells are captioned with
// the donor initials for chassis/head/limbs/tail/dorsal/crown.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { makeCritter } from '../src/gen/critter.js';
import { ringsToPath } from '../src/gen/core.js';
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
const { n, cell } = opt, labelW = opt.labels ? 110 : 0, W = labelW + n * cell, H = rows.length * cell;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#f6f1e4"/>`;
rows.forEach((row, ri) => {
  const [tagPart, species] = row.split('@');
  const tags = tagPart.split('+');
  if (opt.labels) svg += `<text x="4" y="${ri * cell + cell / 2}" font-family="sans-serif" font-size="11" fill="#888">${(species ? species.split(' ') : tags).map((t, i) => `<tspan x="4" dy="${i ? 12 : 0}">${t}</tspan>`).join('')}</text>`;
  for (let ci = 0; ci < n; ci++) {
    const seed = opt.seed * 1000 + ri * 100 + ci;
    let c;
    try { c = makeCritter(tags, seed, { detail: opt.detail, species }); } catch (e) { console.error(row, seed, e.stack.split('\n').slice(0, 3).join(' | ')); continue; }
    const b = c.bbox, pad = 14, sc = Math.min((cell - 2 * pad) / b.w, (cell - 2 * pad) / b.h, 1.6);
    const ox = labelW + ci * cell + cell / 2 - (b.x0 + b.w / 2) * sc, oy = ri * cell + cell / 2 - (b.y0 + b.h / 2) * sc;
    svg += `<path fill="#111" fill-rule="evenodd" d="${ringsToPath(c.rings, p => [p[0] * sc + ox, p[1] * sc + oy], 1)}"/>`;
    if (opt.labels) svg += `<text x="${labelW + ci * cell + 3}" y="${ri * cell + cell - 3}" font-family="sans-serif" font-size="7" fill="#aaa">${seed}${tags.length > 1 ? ' ' + ['chassis', 'head', 'limbs', 'tail', 'dorsal', 'crown'].map(s => c.donors[s][0]).join('') : ''}</text>`;
  }
});
svg += '</svg>';
const svgPath = out.replace(/\.png$/, '.svg');
writeFileSync(svgPath, svg);
if (out.endsWith('.png')) execFileSync('magick', ['-density', '96', svgPath, out]);
console.log('wrote', out);
