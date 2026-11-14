// Generation benchmark: all tags plus all 28 pairs, fixed seeds.
// node tools/bench-gen.mjs [--n 40] [--hash]   (--hash prints a digest of all output rings)
import { createHash } from 'node:crypto';
import { makeCritter } from '../src/gen/critter.js';
import { TAG_NAMES } from '../src/gen/tags/index.js';

const args = process.argv.slice(2);
const n = +(args[args.indexOf('--n') + 1] || 0) || 40;
const rows = [...TAG_NAMES.map(t => [t])];
for (let i = 0; i < TAG_NAMES.length; i++) for (let j = i + 1; j < TAG_NAMES.length; j++) rows.push([TAG_NAMES[i], TAG_NAMES[j]]);

for (let s = 0; s < 20; s++) makeCritter(rows[s % rows.length], 999000 + s); // warm-up
const times = [], per = [], h = createHash('sha1');
for (const [ri, tags] of rows.entries()) {
  let tot = 0, worst = 0;
  for (let k = 0; k < n; k++) {
    const t0 = performance.now(), c = makeCritter(tags, 5000 + ri * 100 + k), dt = performance.now() - t0;
    times.push(dt); tot += dt; worst = Math.max(worst, dt);
    if (args.includes('--hash')) h.update(JSON.stringify(c.rings));
  }
  per.push({ name: tags.join('+'), mean: tot / n, worst });
}
times.sort((a, b) => a - b);
const mean = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`${times.length} critters: mean ${mean.toFixed(2)} ms, p95 ${times[Math.floor(times.length * 0.95)].toFixed(2)} ms, max ${times.at(-1).toFixed(1)} ms`);
per.sort((a, b) => b.mean - a.mean);
console.log('slowest:', per.slice(0, 5).map(p => `${p.name} ${p.mean.toFixed(1)} (max ${p.worst.toFixed(0)})`).join(', '));
if (args.includes('--hash')) console.log('hash', h.digest('hex'));
