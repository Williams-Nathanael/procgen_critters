// Shared contact-sheet SVG renderer (used by tools/sheet.mjs and tools/review-page.mjs).
import { makeCritter, chooseDonors } from '../src/gen/critter.js';
import { ringsToPath, makeRng } from '../src/gen/core.js';

// "tag", "tag@species", "a+b", "a@species+b+c" (pin a species of the first tag inside a mix).
// Returns { tags, species, pinned } or { error } for "a+b@species" style rows.
export function parseRow(row) {
  const at = row.indexOf('@');
  if (at < 0) return { tags: row.split('+'), species: undefined, pinned: false };
  const head = row.slice(0, at), rest = row.slice(at + 1);
  if (head.includes('+')) return { error: `"${row}": a pinned species goes on the first tag, e.g. "${head.split('+')[0]}@species+${head.split('+').slice(1).join('+')}"` };
  const plus = rest.indexOf('+');
  if (plus < 0) return { tags: [head], species: rest, pinned: false };
  if (rest.includes('@', plus)) return { error: `"${row}": only one species can be pinned in a mix` };
  return { tags: [head, ...rest.slice(plus + 1).split('+')], species: rest.slice(0, plus), pinned: true };
}

// rows: array of "tag", "a+b", or "tag@species". opt: n, seed, cell, detail, labels, bg, scale, hybrid (0..1; default: makeCritter's, 0 for tag@species) (output pixel multiplier)
export function sheetSvg(rows, opt) {
  const { n, cell } = opt, sk = opt.scale || 1, labelW = opt.labels ? 110 : 0, W = labelW + n * cell, H = rows.length * cell;
  const bg = opt.bg || '#f6f1e4';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * sk}" height="${H * sk}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${bg}"/>`;
  rows.forEach((row, ri) => {
  const { tags, species, pinned } = parseRow(row);
  if (opt.labels) svg += `<text x="4" y="${ri * cell + cell / 2}" font-family="sans-serif" font-size="11" fill="#888">${(species ? (pinned ? [...species.split(' '), '+' + tags.slice(1).join('+')] : species.split(' ')) : tags).map((t, i) => `<tspan x="4" dy="${i ? 12 : 0}">${t}</tspan>`).join('')}</text>`;
  for (let ci = 0; ci < n; ci++) {
    const seed = opt.seed * 1000 + ri * 100 + ci;
    let c;
    try {
      // tag@species rows show the species itself unless --hybrid is given
      const o = { detail: opt.detail, species, hybrid: opt.hybrid ?? (species && !pinned ? 0 : undefined) };
      if (pinned) {
        // chooseDonors with the same rng stream makeCritter would use, then make the pinned tag primary
        const d = chooseDonors(makeRng(seed), tags), pin = tags[0];
        if (d.primary !== pin) { const old = d.primary; for (const k of Object.keys(d)) { if (d[k] === pin) d[k] = old; else if (d[k] === old) d[k] = pin; } }
        o.donors = d;
      }
      c = makeCritter(tags, seed, o);
    } catch (e) { console.error(row, seed, e.stack.split('\n').slice(0, 3).join(' | ')); continue; }
    const b = c.bbox, pad = 14, sc = Math.min((cell - 2 * pad) / b.w, (cell - 2 * pad) / b.h, 1.6);
    const ox = labelW + ci * cell + cell / 2 - (b.x0 + b.w / 2) * sc, oy = ri * cell + cell / 2 - (b.y0 + b.h / 2) * sc;
    svg += `<path fill="#111" fill-rule="evenodd" d="${ringsToPath(c.rings, p => [p[0] * sc + ox, p[1] * sc + oy], 1)}"/>`;
    const name = Object.values(c.species).join(' + ');
    svg += `<title>${name}</title>`;
    if (opt.labels && c.hybrid) svg += `<text x="${labelW + ci * cell + 3}" y="${ri * cell + 9}" font-family="sans-serif" font-size="${cell < 100 ? 5 : 7}" fill="#aaa">${name.slice(0, Math.floor(cell / (cell < 100 ? 2.6 : 3.6)))}</text>`;
    if (opt.labels) svg += `<text x="${labelW + ci * cell + 3}" y="${ri * cell + cell - 3}" font-family="sans-serif" font-size="7" fill="#aaa">${seed}${tags.length > 1 ? ' ' + ['chassis', 'head', 'limbs', 'tail', 'dorsal', 'crown'].map(s => c.donors[s][0]).join('') : ''}</text>`;
  }
});
  svg += '</svg>';
  return svg;
}
