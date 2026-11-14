// Shared contact-sheet SVG renderer (used by tools/sheet.mjs and tools/review-page.mjs).
import { makeCritter } from '../src/gen/critter.js';
import { ringsToPath } from '../src/gen/core.js';

// rows: array of "tag", "a+b", or "tag@species". opt: n, seed, cell, detail, labels, bg, scale (output pixel multiplier)
export function sheetSvg(rows, opt) {
  const { n, cell } = opt, sk = opt.scale || 1, labelW = opt.labels ? 110 : 0, W = labelW + n * cell, H = rows.length * cell;
  const bg = opt.bg || '#f6f1e4';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * sk}" height="${H * sk}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${bg}"/>`;
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
  return svg;
}
