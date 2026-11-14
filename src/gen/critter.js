// Assemble one critter from a set of tags and a seed.
import { makeRng, Ink, ringsBBox } from './core.js';
import { chassis, heads, limb, tail, crown, dorsal, surface } from './parts.js';
import { TAGS, SLOTS } from './tags/index.js';

// Decide which tag donates each anatomical slot.
// Coherent mixing: one PRIMARY tag supplies the body plan and, by default, everything
// else; each other tag lends one or two of its signature features (TAGS[t].sig).
// `chaos` (0..1) is the chance that each remaining slot is handed to a random tag instead.
export function chooseDonors(rng, tags, chaos = 0.12) {
  const donors = {};
  const primary = rng.pick(tags);
  for (const s of SLOTS) donors[s] = primary;
  const taken = new Set(['chassis']);
  for (const t of rng.shuffle(tags.filter(x => x !== primary))) {
    const want = tags.length === 2 ? rng.wpick([[2, 1], [3, 2], [1, 3]]) : rng.wpick([[3, 1], [2, 2]]);
    for (let k = 0; k < want; k++) {
      const opts = Object.entries(TAGS[t].sig).filter(([s]) => !taken.has(s)).map(([s, w]) => [w, s]);
      if (!opts.length) break;
      const s = rng.wpick(opts); donors[s] = t; taken.add(s);
    }
  }
  for (const s of ['head', 'limbs', 'tail', 'dorsal', 'crown']) if (!taken.has(s) && rng.chance(chaos)) donors[s] = rng.pick(tags);
  donors.surface = donors.head;
  donors.primary = primary;
  return donors;
}

export function makeCritter(tags, seed, opts = {}) {
  const rng = makeRng(seed);
  const detail = opts.detail ?? 0.6;
  const donors = opts.donors ?? chooseDonors(rng, tags, opts.chaos ?? 0.12);
  // Each tag holds a library of species. The primary tag contributes one whole species;
  // each donor tag contributes the relevant slot(s) from one of its own species.
  const pickSpecies = (tag, only) => {
    let list = TAGS[tag].species;
    if (only != null) { const f = list.filter(sp => sp.name === only); if (f.length) list = f; }
    return rng.wpick(list.map(sp => [sp.w ?? 1, sp]));
  };
  const isNone = x => !x || x.type === 'none';
  const sp0 = pickSpecies(donors.primary ?? donors.chassis, opts.species);
  const g = sp0.genes(rng.fork());
  const lent = {}, names = { [donors.primary ?? donors.chassis]: sp0.name };
  for (const s of SLOTS) {
    const t = donors[s];
    if (t === (donors.primary ?? donors.chassis) || s === 'surface') continue;
    if (!lent[t]) { const sp = pickSpecies(t); lent[t] = sp.genes(rng.fork()); names[t] = sp.name; }
    let gene = lent[t][s];
    // a lent feature that came up empty is a wasted mix: look through other species of that tag
    for (let k = 0; k < 10 && isNone(gene) && ['tail', 'dorsal', 'crown'].includes(s); k++) gene = pickSpecies(t).genes(rng.fork())[s];
    g[s] = gene;
  }
  if (donors.head !== (donors.primary ?? donors.chassis) && lent[donors.head]) g.surface = lent[donors.head].surface;
  for (const s of SLOTS) if (g[s] == null) g[s] = { type: 'none' };
  const ink = new Ink();
  const C = { ink, rng, plump: (opts.plump ?? 1) * rng.range(0.92, 1.1), lift: g.limbs?.lift ?? 0.5, plan: null };
  const plan = chassis[g.chassis.type](C, g.chassis);
  C.plan = plan;
  tail(C, plan.tail, g.tail, donors.tail !== (donors.primary ?? donors.chassis));
  if (g.limbs && g.limbs.type !== 'none') for (const sock of plan.limbs) limb(C, sock, g.limbs);
  dorsal(C, plan, g.dorsal);
  const hd = heads[g.head.type](C, plan.head, g.head);
  crown(C, hd, g.crown);
  surface(C, plan, hd, g.surface, detail);
  // creatures with a borrowed, non-animal head still want an eye to read as creatures
  let rings = ink.finish({ soften: opts.soften ?? 0.6 });
  // Normalise: x-centred; everything sits on/above y=0 (the border line). Rooted things
  // may poke a sliver of root below; nothing else goes under the line.
  let b = ringsBBox(rings);
  const dx = -(b.x0 + b.x1) / 2;
  const allow = plan.rooted ? Math.min(b.h * 0.05, 2) : 0;
  const dy = plan.view === 'top' ? -b.y1 : (b.y1 > allow ? allow - b.y1 : 0);
  rings = rings.map(r => r.map(([x, y]) => [x + dx, y + dy]));
  b = ringsBBox(rings);
  return { rings, bbox: b, view: plan.view, donors, tags, seed, species: names };
}
