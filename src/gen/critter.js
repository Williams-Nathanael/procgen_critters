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

// ---- within-tag hybrids (chimeras) ----
// `hybrid` (0..1) is a continuous dial. 0: one catalogue species. 1: no base species at all;
// every slot from a different sibling where the tag has enough, the chassis a blend of
// several siblings, and each slot's numbers blended with another same-type sibling.
export const HYBRID = 1;
const LENDABLE = ['head', 'limbs', 'tail', 'dorsal', 'crown'];
const none = x => !x || x.type === 'none';
const isNum = x => typeof x === 'number' && Number.isFinite(x);
const plain = x => x && typeof x === 'object' && !Array.isArray(x);
// t of the way from a toward b for every numeric gene both share (recursing into nested
// plain objects of the same type); integers stay integers. Booleans, strings, arrays untouched.
// Copy a gene keeping non-enumerable links (e.g. arthropod's chassis.root), which spread drops.
const clone = o => Object.defineProperties({}, Object.getOwnPropertyDescriptors(o));
// After a chimera swaps slots, re-point a copied gene's hidden links from its parent's gene
// set (and that set's slots) to the chimera's own.
function relink(gene, src, g) {
  for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(gene))) {
    if (d.enumerable || !('value' in d)) continue;
    const v = d.value, s = v === src ? null : Object.keys(src).find(s => src[s] === v);
    if (v === src) Object.defineProperty(gene, k, { ...d, value: g });
    else if (s) Object.defineProperty(gene, k, { ...d, value: g[s] });
  }
}
// Genes blend numerically only between the same part type and the same variant: forms mean
// different things by the same key (W, legL, rot), so a blend across them is noise.
const VARIANT = ['form', 'view', 'kind', 'mode'];
const sameForm = (a, b) => plain(a) && plain(b) && a.type === b.type && VARIANT.every(k => a[k] === b[k]);
function blend(a, b, t) {
  for (const k of Object.keys(a)) {
    const x = a[k], y = b[k];
    if (isNum(x) && isNum(y)) {
      const v = x + (y - x) * t;
      a[k] = Number.isInteger(x) && Number.isInteger(y) ? Math.round(v) : v;
    } else if (sameForm(x, y)) { a[k] = clone(x); blend(a[k], y, t); }
  }
}
// Weighted blend of several same-type genes into a (a's keys), pushed a little beyond the
// parents' mean (`ex`), then clamped to the parents' range widened by 15% (sign kept).
function blendMany(a, others, ws, ex) {
  for (const k of Object.keys(a)) {
    const vs = [a[k], ...others.map(o => o[k])];
    if (vs.every(isNum)) {
      let W = 0, v = 0; vs.forEach((x, i) => { v += x * ws[i]; W += ws[i]; }); v /= W;
      const mean = vs.reduce((p, x) => p + x, 0) / vs.length, lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo) * 0.15;
      v += (v - mean) * ex;
      v = Math.min(hi + pad, Math.max(lo - pad, v));
      if (lo >= 0) v = Math.max(v, lo > 0 ? lo * 0.85 : 0);
      if (hi <= 0) v = Math.min(v, hi < 0 ? hi * 0.85 : 0);
      a[k] = vs.every(Number.isInteger) ? Math.round(v) : v;
    } else if (vs.every(x => sameForm(x, a[k]))) {
      a[k] = clone(a[k]); blendMany(a[k], vs.slice(1), ws, ex);
    }
  }
}
// Meld species of one tag into a chimera. Every species of the tag (sp0, the rng's pick,
// is just one of them) is a potential parent. With chance `amount` per slot, the slot comes
// from a parent not yet used; the chassis likewise becomes a weighted blend of up to three
// same-type parents. Each borrowed slot then blends toward a second same-type parent.
// Uses its own rng stream (seeded from the critter seed), so hybrid 0 leaves output untouched.
// Species hints: hybrid: { never, keep: [slots], noLend: [slots] } (see AUTHORING.md).
// Returns { parents: [names], from: { slot: name or [names] } } or null; g is edited in place.
function hybridize(tag, sp0, g, donors, seed, amount) {
  const hr = makeRng((Math.imul(typeof seed === 'number' ? seed : String(seed).length, 2654435761) ^ 0x5bd1e995) >>> 0);
  if (sp0.hybrid?.never) return null;
  const pool = TAGS[tag].species.filter(sp => sp === sp0 || !sp.hybrid?.never)
    .map(sp => ({ sp, w: sp.w ?? 1, g: sp === sp0 ? g : sp.genes(hr.fork()) }));
  if (pool.length < 2) return null;
  const P0 = pool.find(p => p.sp === sp0);
  const from = {}, used = new Map(); // parent -> use count
  const use = (p, s) => { used.set(p, (used.get(p) ?? 0) + 1); from[s] = p.sp.name; };
  // weighted pick among parents that pass `ok`, preferring fresh ones (sp0 fades out as amount -> 1)
  const pick = (ok) => {
    const c = pool.filter(ok);
    if (!c.length) return null;
    return hr.wpick(c.map(p => [p.w * (p === P0 ? 1 - amount + 0.02 : 1) / (1 + 4 * (used.get(p) ?? 0)), p]));
  };
  // chassis
  let chassisP = P0;
  const keepOf = p => p.sp.hybrid?.keep ?? [];
  if (!keepOf(P0).includes('chassis') || amount >= 1) {
    if (hr.chance(amount)) {
      chassisP = pick(p => !p.sp.hybrid?.noLend?.includes('chassis')) ?? P0;
      const mates = hr.shuffle(pool.filter(p => p !== chassisP && sameForm(p.g.chassis, chassisP.g.chassis) && !p.sp.hybrid?.noLend?.includes('chassis'))).slice(0, hr.int(1, 2));
      g.chassis = clone(chassisP.g.chassis);
      if (mates.length && !keepOf(chassisP).includes('chassis')) {
        const ws = [hr.range(0.5, 1), ...mates.map(() => hr.range(0.25, 1) * amount)];
        blendMany(g.chassis, mates.map(m => m.g.chassis), ws, hr.range(0, 0.35) * amount);
        from.chassis = [chassisP.sp.name, ...mates.map(m => m.sp.name)];
        mates.forEach(m => used.set(m, (used.get(m) ?? 0) + 1));
      } else from.chassis = chassisP.sp.name;
      used.set(chassisP, (used.get(chassisP) ?? 0) + 1);
    } else {
      const m = pick(p => p !== P0 && sameForm(p.g.chassis, g.chassis) && !p.sp.hybrid?.noLend?.includes('chassis'));
      if (m && amount > 0) { g.chassis = clone(g.chassis); blend(g.chassis, m.g.chassis, hr.range(0.2, 0.5) * amount); from.chassis = [P0.sp.name, m.sp.name]; used.set(m, 1); }
    }
  }
  if (from.chassis == null) { from.chassis = P0.sp.name; used.set(P0, (used.get(P0) ?? 0) + 1); }
  // the chassis parent's keep-list binds its own slots (a snail's head stays on its shell)
  const keep = new Set(keepOf(chassisP));
  if (chassisP !== P0) for (const s of keepOf(chassisP)) if (LENDABLE.includes(s)) { g[s] = chassisP.g[s]; if (s === 'head') g.surface = chassisP.g.surface; }
  if (chassisP === P0) keepOf(P0).forEach(s => keep.add(s));
  // slots: only those the primary tag still owns (lent slots of a mix stay with their tag)
  for (const s of hr.shuffle(LENDABLE.filter(s => donors[s] === tag && !keep.has(s)))) {
    if (!hr.chance(amount)) {
      if (chassisP !== P0) { g[s] = chassisP.g[s]; if (s === 'head') g.surface = chassisP.g.surface; from[s] = chassisP.sp.name; }
      continue;
    }
    const can = p => !p.sp.hybrid?.noLend?.includes(s);
    // empty slots are a legitimate parent choice, but rarely (and never an empty head)
    let p = pick(q => can(q) && !none(q.g[s]));
    if (!p || (s !== 'head' && hr.chance(0.12))) p = pick(can) ?? p;
    if (!p) continue;
    g[s] = p.g[s];
    if (s === 'head') g.surface = p.g.surface; // surface follows head
    use(p, s);
    if (none(g[s])) continue;
    const m = pick(q => q !== p && can(q) && sameForm(q.g[s], g[s]));
    if (m) { g[s] = clone(g[s]); blend(g[s], m.g[s], hr.range(0.2, 0.6) * amount); from[s] = [p.sp.name, m.sp.name]; used.set(m, (used.get(m) ?? 0) + 1); }
  }
  if (none(g.head)) { const p = pick(q => !none(q.g.head)); if (p) { g.head = p.g.head; g.surface = p.g.surface; use(p, 'head'); } }
  if (g.chassis !== chassisP.g.chassis) relink(g.chassis, chassisP.g, g);
  const parents = [...used.keys()].map(p => p.sp.name);
  if (parents.length < 2) return null;
  return { parents, from, chassis: chassisP.sp.name };
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
  let hybrid = null, chassisFrom = sp0.name;
  if (hy > 0) {
    const hx = hybridize(donors.primary ?? donors.chassis, sp0, g, donors, seed, hy);
    if (hx) { names[donors.primary ?? donors.chassis] = hx.parents.join(' × '); hybrid = hx.from; chassisFrom = hx.chassis; }
  }
  for (const s of SLOTS) if (g[s] == null) g[s] = { type: 'none' };
  const ink = new Ink();
  const C = { ink, rng, plump: (opts.plump ?? 1) * rng.range(0.92, 1.1), lift: g.limbs?.lift ?? 0.5, plan: null };
  const plan = chassis[g.chassis.type](C, g.chassis);
  // origin: which tag drew the chassis / head, so lent parts can adapt to their host
  plan.tag = donors.chassis;
  C.plan = plan;
  // a tail from another tag, or (in a chimera) from a sibling other than the chassis's,
  // is capped to the receiving body
  const tailFrom = hybrid?.tail && [].concat(hybrid.tail)[0];
  const lentTail = donors.tail !== (donors.primary ?? donors.chassis) || (tailFrom != null && tailFrom !== chassisFrom);
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
  return { rings, bbox: b, view: plan.view, donors, tags, seed, species: names, base: hybrid ? null : sp0.name, hybrid };
}
