// Assemble one critter from a set of tags and a seed.
import { makeRng, Ink, ringsBBox } from './core.js';
import { chassis, heads, limb, tail, crown, dorsal, surface } from './parts.js';
import { TAGS, SLOTS } from './tags.js';

// Decide which tag donates each anatomical slot. With several tags, every tag
// is guaranteed at least one of the conspicuous slots, and the rest are drawn
// from a per-critter random weighting, so the mix differs each time.
export function chooseDonors(rng, tags) {
  const donors = {};
  if (tags.length === 1) { for (const s of SLOTS) donors[s] = tags[0]; return donors; }
  const w = tags.map(() => -Math.log(1 - rng()) + 0.15); // exponential -> Dirichlet-ish
  const pickW = () => rng.wpick(tags.map((t, i) => [w[i], t]));
  for (const s of SLOTS) donors[s] = pickW();
  const major = rng.shuffle(['chassis', 'head', 'limbs', 'tail', 'dorsal', 'crown']);
  const order = rng.shuffle(tags);
  // head and chassis are the most identity-bearing: hand those out first
  major.sort((a, b) => (['chassis', 'head'].includes(b) ? 1 : 0) - (['chassis', 'head'].includes(a) ? 1 : 0));
  order.forEach((t, i) => { if (i < major.length) donors[major[i]] = t; });
  donors.surface = donors.head;
  return donors;
}

export function makeCritter(tags, seed, opts = {}) {
  const rng = makeRng(seed);
  const detail = opts.detail ?? 0.6;
  const donors = opts.donors ?? chooseDonors(rng, tags);
  const g = {};
  for (const s of SLOTS) g[s] = TAGS[donors[s]][s](rng.fork());
  // an ornament-less mix is a wasted mix: if a donated slot came up 'none', retry a few times
  if (tags.length > 1) for (const s of ['tail', 'dorsal', 'crown']) {
    for (let k = 0; k < 4 && g[s].type === 'none' && !('len' in g[s]); k++) g[s] = TAGS[donors[s]][s](rng.fork());
  }
  const ink = new Ink();
  const C = { ink, rng, plump: (opts.plump ?? 1) * rng.range(0.92, 1.1), lift: g.limbs.lift ?? 0.5, plan: null };
  const plan = chassis[g.chassis.type](C, g.chassis);
  C.plan = plan;
  tail(C, plan.tail, g.tail);
  for (const sock of plan.limbs) limb(C, sock, g.limbs);
  dorsal(C, plan, g.dorsal);
  const hd = heads[g.head.type](C, plan.head, g.head);
  crown(C, hd, g.crown);
  surface(C, plan, hd, g.surface, detail);
  const rings = ink.finish({ soften: opts.soften ?? 0.6 });
  const bbox = ringsBBox(rings);
  return { rings, bbox, view: plan.view, donors, tags, seed };
}
