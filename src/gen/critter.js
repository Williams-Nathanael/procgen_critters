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
  // Optional per-partner tuning, TAGS[t].mix[other] = { lead, sig, want }:
  // lead weights how often t supplies the body when mixed with `other` (default 1; product
  // over partners), sig replaces t's sig when it lends to an `other` body, want replaces the
  // [weight, slot count] table. Single tags never consult it (pure output unchanged).
  const mixOf = (t, o) => TAGS[t].mix?.[o] ?? {};
  const primary = tags.length < 2 ? rng.pick(tags)
    : rng.wpick(tags.map(t => [tags.filter(o => o !== t).reduce((a, o) => a * (mixOf(t, o).lead ?? 1), 1), t]));
  for (const s of SLOTS) donors[s] = primary;
  const taken = new Set(['chassis']);
  for (const t of rng.shuffle(tags.filter(x => x !== primary))) {
    const m = mixOf(t, primary);
    const want = rng.wpick(m.want ?? (tags.length === 2 ? [[2, 1], [3, 2], [1, 3]] : [[3, 1], [2, 2]]));
    for (let k = 0; k < want; k++) {
      const opts = Object.entries(m.sig ?? TAGS[t].sig).filter(([s]) => !taken.has(s)).map(([s, w]) => [w, s]);
      if (!opts.length) break;
      const s = rng.wpick(opts); donors[s] = t; taken.add(s);
    }
  }
  for (const s of ['head', 'limbs', 'tail', 'dorsal', 'crown']) if (!taken.has(s) && rng.chance(chaos)) {
    const t = rng.pick(tags), ms = t !== primary && mixOf(t, primary).sig;
    if (!ms || ms[s]) donors[s] = t; // a tuned pair never gets a slot its table rules out
  }
  donors.surface = donors.head;
  donors.primary = primary;
  return donors;
}

// the socket moved to the nearest body centreline point, then out toward it to 0.6 of the radius
function onBody(plan, sock) {
  const P = plan.path, n = P.length - 1;
  let bi = 0, bd = Infinity;
  P.forEach((q, i) => { const d = Math.hypot(q[0] - sock.p[0], q[1] - sock.p[1]) - plan.rad(i / n); if (d < bd) { bd = d; bi = i; } });
  if (bd <= 0) return sock;
  const q = P[bi], dx = sock.p[0] - q[0], dy = sock.p[1] - q[1], L = Math.hypot(dx, dy) || 1, k = plan.rad(bi / n) * 0.6 / L;
  return { ...sock, p: [q[0] + dx * k, q[1] + dy * k] };
}

// ---- within-tag hybrids ----
// The default share of single-tag critters (and primaries of mixes) that are meldings of
// several species of their tag rather than one catalogue species.
export const HYBRID = 0.85;
const LENDABLE = ['head', 'limbs', 'tail', 'dorsal', 'crown'];
const none = x => !x || x.type === 'none';
// t of the way from a toward b for every numeric gene both share (top level and one level
// of nested plain objects); integers stay integers. Booleans, strings, arrays untouched.
function blend(a, b, t) {
  for (const k of Object.keys(a)) {
    const x = a[k], y = b[k];
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      const v = x + (y - x) * t;
      a[k] = Number.isInteger(x) && Number.isInteger(y) ? Math.round(v) : v;
    } else if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y) && x.type === y.type) {
      blend(x, y, t);
    }
  }
}
// Meld species of one tag: the base species `sp0` (genes g) takes 1-3 slots from siblings
// and blends its numeric genes toward one sibling wherever both use the same part type.
// Uses its own rng stream (seeded from the critter seed), so hybrid 0 leaves output untouched.
// Species hints (optional, on the species object): hybrid: { never, keep: [slots], noLend: [slots] }.
// Returns [[slot | 'blend', sibling name], ...] in order.
function hybridize(tag, sp0, g, donors, seed, amount) {
  const hr = makeRng((Math.imul(typeof seed === 'number' ? seed : String(seed).length, 2654435761) ^ 0x5bd1e995) >>> 0);
  if (!hr.chance(amount) || sp0.hybrid?.never) return [];
  const sibs = TAGS[tag].species.filter(sp => sp !== sp0 && !sp.hybrid?.never);
  if (!sibs.length) return [];
  const pick = () => hr.wpick(sibs.map(sp => [sp.w ?? 1, sp]));
  const used = [];
  // slots still the primary's own (lent slots of a mix stay with their tag)
  const open = LENDABLE.filter(s => donors[s] === tag && !sp0.hybrid?.keep?.includes(s));
  const want = Math.min(open.length, hr.wpick([[4, 1], [4, 2], [2, 3]]));
  for (const s of hr.shuffle(open).slice(0, want)) {
    for (let k = 0; k < 8; k++) {
      const sp = pick();
      if (sp.hybrid?.noLend?.includes(s)) continue;
      const sg = sp.genes(hr.fork());
      if (none(sg[s]) && k < 7) continue; // borrowing nothing is no melding
      g[s] = sg[s];
      if (s === 'head') g.surface = sg.surface; // surface follows head
      used.push([s, sp.name]);
      break;
    }
  }
  // numeric blend toward one sibling, slot by slot where the part types agree
  const mate = pick(), mg = mate.genes(hr.fork()), t = hr.range(0.2, 0.55) * amount;
  let blended = false;
  for (const s of ['chassis', ...LENDABLE]) {
    if (s !== 'chassis' && donors[s] !== tag) continue;
    if (sp0.hybrid?.keep?.includes(s) || mate.hybrid?.noLend?.includes(s)) continue;
    if (g[s] && mg[s] && !none(g[s]) && g[s].type === mg[s].type) { g[s] = { ...g[s] }; blend(g[s], mg[s], t); blended = true; }
  }
  if (blended) used.push(['blend', mate.name]);
  return used;
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
    for (let k = 0; k < 10 && isNone(gene) && ['head', 'limbs', 'tail', 'dorsal', 'crown'].includes(s); k++) gene = pickSpecies(t).genes(rng.fork())[s];
    g[s] = gene;
  }
  if (donors.head !== (donors.primary ?? donors.chassis) && lent[donors.head]) g.surface = lent[donors.head].surface;
  const hy = opts.hybrid ?? HYBRID;
  let hybrid = null;
  if (hy > 0) {
    const mix = hybridize(donors.primary ?? donors.chassis, sp0, g, donors, seed, hy);
    if (mix.length) names[donors.primary ?? donors.chassis] = [sp0.name, ...new Set(mix.map(m => m[1]))].join(' × ');
    hybrid = Object.fromEntries(mix);
  }
  for (const s of SLOTS) if (g[s] == null) g[s] = { type: 'none' };
  const ink = new Ink();
  const C = { ink, rng, plump: (opts.plump ?? 1) * rng.range(0.92, 1.1), lift: g.limbs?.lift ?? 0.5, plan: null };
  const plan = chassis[g.chassis.type](C, g.chassis);
  // origin: which tag drew the chassis / head, so lent parts can adapt to their host
  plan.tag = donors.chassis;
  C.plan = plan;
  const lentTail = donors.tail !== (donors.primary ?? donors.chassis);
  // rooted bodies (plants, fungi) often put the tail socket off the body (beside a taproot,
  // under a baobab's crown); a lent tail there floats, so pull the socket onto the body
  if (lentTail && plan.rooted && plan.path?.length > 1 && plan.rad) plan.tail = onBody(plan, plan.tail);
  tail(C, plan.tail, g.tail, lentTail);
  if (g.limbs && g.limbs.type !== 'none') for (const sock of plan.limbs) limb(C, sock, g.limbs);
  dorsal(C, plan, g.dorsal);
  // a lent head may ask to be drawn larger on a given host (mix[host].headS), e.g. a cap
  // that would otherwise vanish on a slender salamander
  const hS = donors.head !== donors.chassis && TAGS[donors.head].mix?.[donors.chassis]?.headS;
  const hd = heads[g.head.type](C, hS ? { ...plan.head, s: plan.head.s * hS } : plan.head, g.head);
  hd.tag = donors.head;
  C.head = hd;
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
  return { rings, bbox: b, view: plan.view, donors, tags, seed, species: names, base: sp0.name, hybrid };
}
