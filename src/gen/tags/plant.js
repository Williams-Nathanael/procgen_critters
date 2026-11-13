// Odd plants: a species library of strange, characterful and botanically remarkable
// growth forms (carnivores, ferns and their allies, arums, seed-heads, bulbs and roots
// lifted from the soil, succulents, miniature trees, seaweeds, climbers).
//
// How this file is organised:
//   1. geometry helpers
//   2. UNITS: small ornaments (leaves, keys, catkins, ...) drawn at a point; shared by
//      chassis, heads, and the generic `plantOrn` dorsal / crown / tail-tip
//   3. HEADS (plant*): flowers, seed-heads, traps, pitchers, arums, cones, fiddleheads
//   4. CHASSIS (plant*): stems, rosettes, ferns, cacti, trees, roots, kelp, vines
//   5. species
//
// Conventions specific to this tag:
//   - plant chassis return `plantOwn: true`. Dorsal/crown genes carrying `own: true` are
//     skipped on such a chassis (the chassis already draws its own foliage) and exist to
//     be LENT to animal bodies. A head gene may carry `lend: {...}`: the head gene used
//     instead when the head is lent to a non-plant body.
//   - on a non-plant body every plant head grows from a small round "receptacle" knob,
//     which carries the eye, so plant-headed animals still read as creatures.
import { add, lerp, angOf, polar, angDiff, clamp, mix, MINW, frame, spline, polyline, profile, pathAt, tube, ellipse, leaf } from '../core.js';
import { chassis, heads, feet, tips, crowns, dorsals } from '../parts.js';

const PI = Math.PI, TAU = 2 * PI, UP = -PI / 2, DOWN = PI / 2;
const P = profile;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const last = a => a[a.length - 1];
const endAng = pts => angOf(pts[pts.length - 2], pts[pts.length - 1]);
const hair = MINW / 2; // radius of the thinnest stroke

// ---------------------------------------------------------------------
// 1. geometry helpers
// ---------------------------------------------------------------------
// Path whose heading turns by `turn` in total; k > 1 concentrates the turn at the end
// (hooks, croziers); shrink shortens later steps (spirals).
function arcPath(p, a, len, turn, n = 14, k = 1, shrink = 0) {
  const pts = [p]; let q = p;
  const norm = 1 - shrink / 2;
  for (let i = 1; i <= n; i++) { const u = (i - 0.5) / n; q = polar(q, a + turn * Math.pow(u, k), len / n * (1 - shrink * u) / norm); pts.push(q); }
  return pts;
}
// Path that sags under gravity and never sinks below `floor` above the ground line.
function droop(p, a, len, grav, n = 12, floor = 0.7) {
  const pts = [p]; let q = p, h = a;
  for (let i = 0; i < n; i++) { h += grav * Math.cos(h) / n; q = polar(q, h, len / n); if (q[1] > -floor) q = [q[0], -floor]; pts.push(q); }
  return pts;
}
const floorPts = (pts, f = 0.6) => pts.map(p => (p[1] > -f ? [p[0], -f] : p));
// Variable-width band around a sampled path with a FLAT start (sits on the ground) and a round end.
function ribbon(path, rad, cap = true) {
  const n = path.length, f = typeof rad === 'function' ? rad : () => rad, L = [], R = [];
  let a1 = 0;
  for (let i = 0; i < n; i++) { const a = angOf(path[Math.max(i - 1, 0)], path[Math.min(i + 1, n - 1)]), w = f(i / (n - 1)); a1 = a; L.push(polar(path[i], a + PI / 2, w)); R.push(polar(path[i], a - PI / 2, w)); }
  const out = L.slice(), we = f(1);
  if (cap && we > 0.15) for (let k = 1; k <= 5; k++) out.push(polar(path[n - 1], a1 + PI / 2 - k * PI / 6, we));
  for (let i = n - 1; i >= 0; i--) out.push(R[i]);
  return out;
}
function superE(c, rx, ry, rot = 0, e = 2.6, n = 32) {
  const out = [], cs = Math.cos(rot), sn = Math.sin(rot), q = 2 / e;
  for (let i = 0; i < n; i++) { const a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a), x = Math.sign(ca) * Math.abs(ca) ** q * rx, y = Math.sign(sa) * Math.abs(sa) ** q * ry; out.push([c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]); }
  return out;
}
const thin = (ink, pts, w = MINW) => ink.poly(tube(pts, Math.max(w, MINW) / 2));
// Pinnate frond along a sampled rachis.
function frond(ink, pts, pl, pw, n, o = {}) {
  ink.poly(tube(pts, P([[0, o.rw ?? 0.6], [1, 0.32]])));
  const t0 = o.t0 ?? 0.14, env = P(o.env ?? [[0, 0.35], [0.22, 1], [0.6, 0.72], [1, 0.14]]);
  for (let i = 0; i < n; i++) {
    const t = mix(t0, 0.97, i / (n - 1)), { p, ang } = pathAt(pts, t), e = env(i / (n - 1));
    for (const sd of [-1, 1]) ink.poly(leaf(p, ang + sd * (o.ang ?? 1.15), pl * e, pw * mix(0.65, 1, e), -sd * 0.1, 0.4));
  }
  ink.poly(leaf(last(pts), endAng(pts), pl * 0.3, pw * 0.6, 0, 0.4));
}
const usock = (p, dir, s, face = 0) => ({ p, dir, face, s, sym: false, radial: true });

// ---------------------------------------------------------------------
// 2. UNITS  U[kind](C, p, a, s, o): ornament at p pointing along a, scale s
// ---------------------------------------------------------------------
const U = {
  leaf: (C, p, a, s, o) => C.ink.poly(leaf(p, a, s * (o.len ?? 1), s * (o.wid ?? 0.45), o.bend ?? 0, o.fat ?? 0.45)),
  // several leaflets fanned from one point: trifoliate, palmate, whorl
  leaves: (C, p, a, s, o) => { const n = o.n ?? 3; for (let i = 0; i < n; i++) { const f = n > 1 ? i / (n - 1) - 0.5 : 0; C.ink.poly(leaf(p, a + f * (o.spread ?? 2.2), s * (o.len ?? 1) * (1 - 0.25 * Math.abs(f)), s * (o.wid ?? 0.5), f * 0.2, o.fat ?? 0.5)); } },
  strap: (C, p, a, s, o) => { const w = s * (o.wid ?? 0.16); C.ink.poly(tube(droop(p, a, s * (o.len ?? 1), o.grav ?? 1, 10, w + 0.3), P([[0, w * 0.6], [0.3, w], [1, 0.15]]))); },
  heart: (C, p, a, s, o) => { // heart / arrowhead leaf: two lobes meeting at the tip
    const L = s * (o.len ?? 1), w = s * (o.wid ?? 0.8), tip = polar(p, a, L), sp = o.arrow ? 0.42 : 0.3;
    for (const sd of [-1, 1]) C.ink.poly(tube(polyline([tip, polar(tip, a + PI + sd * sp, L * (o.arrow ? 1.12 : 1.05))], 8), P(o.arrow ? [[0, 0.08], [0.5, w * 0.3], [0.8, w * 0.26], [1, 0.12]] : [[0, 0.08], [0.55, w * 0.4], [1, w * 0.3]])));
    C.ink.poly(leaf(p, a, L, w * 0.6, 0, 0.4));
  },
  ginkgo: (C, p, a, s, o) => { // fan with a central notch
    const L = s * (o.len ?? 1), sp = o.spread ?? 0.95, pts = [p];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(polar(p, a + (t - 0.5) * 2 * sp, L * (0.93 + 0.07 * Math.cos(t * TAU * 3)) * (1 - (o.notch ?? 0.3) * Math.exp(-(((t - 0.5) / 0.07) ** 2))))); }
    C.ink.poly(pts);
  },
  lobed: (C, p, a, s, o) => { // big palmate jagged leaf seen at a tilt (gunnera, hops, rhubarb)
    const L = s * (o.len ?? 1), lobes = o.lobes ?? 5, sq = o.squash ?? 0.6, F = frame(polar(p, a, L * 0.3), a, 1, 1), pts = [];
    for (let i = 0; i <= 60; i++) { const th = (i / 60 - 0.5) * 5.4, rr = L * (0.5 + 0.5 * Math.abs(Math.cos(th * lobes / 5.4 * PI / 2 * 2)) ** 0.8) * (0.72 + 0.28 * Math.cos(th / 2)) * (1 + 0.06 * Math.cos(i * 2.1)); pts.push(F(rr * Math.cos(th) * 0.75, rr * Math.sin(th) * sq)); }
    C.ink.poly(pts);
  },
  peltate: (C, p, a, s, o) => { // umbrella leaf seen from the side (lotus, nasturtium): a shallow tilted lens
    const w = s * (o.wid ?? 1.3), tilt = (a - UP) * 0.5, c = polar(p, a, w * 0.12), pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24 * TAU, x = Math.cos(t) * w, y = Math.sin(t) * w * (Math.sin(t) < 0 ? 0.2 : 0.1) - w * 0.08 * (Math.cos(t) ** 2); pts.push(polar(polar(c, tilt, x), tilt + PI / 2, y)); }
    C.ink.poly(pts);
  },
  frond: (C, p, a, s, o) => frond(C.ink, droop(p, a, s * (o.len ?? 1), o.grav ?? 0.8, 12, 1), s * (o.pl ?? 0.3), s * (o.pw ?? 0.12), o.n ?? 7, { rw: 0.42 }),
  key: (C, p, a, s) => { // sycamore / maple samara pair
    C.ink.dot(p, s * 0.22);
    for (const sd of [-1, 1]) C.ink.poly(tube(arcPath(p, a + sd * 0.5, s * 1.25, sd * 0.35, 8), P([[0, s * 0.14], [0.45, s * 0.24], [0.8, s * 0.3], [1, s * 0.2]])));
  },
  disc: (C, p, a, s) => { C.ink.oval(polar(p, a, s * 0.6), s * 0.62, s * 0.56, a); C.ink.poly(leaf(polar(p, a, s * 1.1), a, s * 0.3, s * 0.14, 0, 0.3)); }, // honesty
  catkin: (C, p, a, s) => { C.ink.oval(polar(p, a, s * 0.42), s * 0.52, s * 0.27, a); C.ink.poly(leaf(p, a - 0.5, s * 0.4, s * 0.25, 0, 0.4)); },
  thorn: (C, p, a, s, o) => C.ink.poly(leaf(p, a, s * (o.len ?? 1), s * 0.5, o.hook ?? 0.25, 0.2)),
  bud: (C, p, a, s, o) => C.ink.oval(polar(p, a, s * 0.4), s * (o.len ?? 0.55), s * (o.wid ?? 0.34), a),
  berries: (C, p, a, s, o) => { const n = o.n ?? 4; for (let i = 0; i < n; i++) C.ink.dot(polar(p, a + (i - (n - 1) / 2) * 0.9, s * (0.35 + 0.18 * (i % 2))), s * 0.26); },
  tendril: (C, p, a, s, o) => C.ink.poly(tube(arcPath(p, a, s * (o.len ?? 1), (o.sign ?? C.rng.sign()) * (o.turn ?? 5.5), 16, 2, 0.6), P([[0, Math.max(s * 0.07, hair)], [1, hair * 0.9]]))),
  sundew: (C, p, a, s) => { // paddle leaf fringed with glue-tipped tentacles
    const c = polar(p, a, s * 0.55), n = 9;
    C.ink.oval(c, s * 0.62, s * 0.5, a);
    for (let i = 0; i < n; i++) { const b = a + (i / (n - 1) - 0.5) * 4.5, e = polar(c, b, s * 1.22); thin(C.ink, [c, e]); C.ink.dot(e, Math.max(s * 0.13, 0.5)); }
  },
  buds: (C, p, a, s, o) => { // one-sided curled raceme (sundew, forget-me-not)
    const sg = o.sign ?? 1, pts = arcPath(p, a, s * 2.4, sg * 2.8, 10, 1.4);
    thin(C.ink, pts, MINW * 1.1);
    for (let i = 3; i <= 10; i += 2) C.ink.dot(polar(pts[i], angOf(pts[i - 1], pts[i]) - sg * PI / 2, s * 0.2), s * mix(0.26, 0.17, i / 10));
  },
  plantlet: (C, p, a, s) => { for (const d of [-0.8, 0, 0.8]) C.ink.poly(leaf(p, UP + d, s * 1.1, s * 0.7, d * 0.2, 0.55)); },
  // nepenthes leaf: blade, then the midrib runs on as a tendril that loops down and up into a pitcher
  nepLeaf: (C, p, a, s, o) => {
    const sd = Math.cos(a) >= 0 ? 1 : -1, bend = sd * 0.22, L = s * 2.6;
    C.ink.poly(leaf(p, a, L, s * 0.7, bend, 0.5));
    const tip = polar(p, a + bend * 0.6, L * 0.96), ps = s * (o.ps ?? 1), drop = Math.min(s * (o.drop ?? 2), -tip[1] - 1.6);
    if (drop < s * 0.6) return;
    const end = [tip[0] + sd * s * 1.7, tip[1] + drop * 0.72];
    C.ink.tube([tip, [tip[0] + sd * s * 0.35, tip[1] + drop * 0.6], [tip[0] + sd * s * 0.95, tip[1] + drop], end, [end[0] + sd * 0.1, end[1] - ps * 0.5]], Math.max(s * 0.09, hair));
    heads.plantPitcher(C, usock(end, UP + sd * 0.1, ps, sd), { kind: 'nepenthes', wid: o.pw ?? 1, lid: o.lid ?? 0.9, fs: sd });
  },
  // pea leaf: paired leaflets, the tip running out into branched tendrils
  peaLeaf: (C, p, a, s, o) => {
    const pts = droop(p, a, s * 2.3, 0.4, 8, 1), sg = Math.cos(a) >= 0 ? 1 : -1;
    thin(C.ink, pts, MINW * 1.2);
    for (const t of [0.35, 0.72]) { const q = pathAt(pts, t); for (const sd of [-1, 1]) C.ink.poly(leaf(q.p, q.ang + sd * 1.0, s * 1.05, s * 0.62, 0, 0.5)); }
    for (const d of [-0.5, 0.45]) U.tendril(C, last(pts), endAng(pts) + d, s * 1.9, { sign: d < 0 ? -sg : sg, turn: 6 });
  },
};
function drawUnit(C, p, a, s, spec) {
  if (!spec) return null;
  if (spec.type) return heads[spec.type](C, usock(p, a, s, spec.face ?? 0), spec);
  U[spec.u](C, p, a, s, spec); return null;
}

// ---------------------------------------------------------------------
// 3. HEADS
// ---------------------------------------------------------------------
function hstart(C, sock, g, tilt = 0) {
  const { ink, rng } = C, s = sock.s * (g.size ?? 1), animal = !sock.radial;
  const ax = animal ? (sock.sym ? sock.face : sock.face + tilt) : sock.dir;
  const o = animal ? polar(sock.p, sock.dir, s * 0.3) : sock.p;
  const fs = animal ? 1 : (g.fs ?? ((sock.face ?? 0) >= 0 ? 1 : -1));
  if (animal) { ink.poly(tube(polyline([sock.p, o], 2), s * 0.55)); ink.dot(o, s * 0.64); }
  return { C, ink, rng, s, animal, ax, o, fs, F: frame(o, ax, s, 1), sock };
}
function hend(H, apex, world) {
  const { sock, s, o } = H, eyes = [], mounts = [];
  if (!H.animal) mounts.push({ p: world ?? H.F(apex[0], apex[1] ?? 0), dir: H.ax, flip: 1, s: s * 0.8 });
  else {
    const Fe = frame(o, sock.face, s, 1);
    for (const sd of sock.sym ? [-1, 1] : [-1]) {
      eyes.push({ p: Fe(0.1, sd * (sock.sym ? 0.32 : 0.2)), r: s * 0.17 });
      mounts.push({ p: Fe(-0.2, sd * 0.45), dir: sock.face + sd * (sock.sym ? 1.25 : PI / 2 + 0.25), flip: sd, s });
    }
  }
  return { eyes, mounts, spots: [] };
}
// outline of a body of revolution along the head axis, flat at both ends (radii in s units)
function lathe(H, x0, x1, keys, n = 14) {
  const f = P(keys), top = [], bot = [];
  for (let i = 0; i <= n; i++) { const t = i / n, x = mix(x0, x1, t), rr = f(t); top.push(H.F(x, -rr)); bot.push(H.F(x, rr)); }
  return top.concat(bot.reverse());
}
function axTube(H, x0, x1, keys, n = 14) {
  const pts = []; for (let i = 0; i <= n; i++) pts.push(H.F(mix(x0, x1, i / n), 0));
  return tube(pts, P(keys.map(([t, v]) => [t, v * H.s])));
}
// register a head; honours `lend` (alternative gene when lent to a non-plant body)
// (the plant chassis sets plan.plantOwn; units drawn by the chassis itself run with C.plantDraw)
const head = (name, fn) => { heads[name] = (C, sock, g) => (g.lend && !(C.plantDraw || C.plan?.plantOwn) ? heads[g.lend.type](C, sock, g.lend) : fn(C, sock, g)); };

// On the plant's own chassis: draws the main stem's crowning unit (kept back by the chassis so
// that a borrowed head can take its place), or nothing. Always carries a `lend`.
head('plantLend', (C, sock) => {
  const mu = C.plan?.mainUnit;
  if (mu) {
    const res = drawUnit({ ...C, ink: mu.K, plantDraw: true }, mu.p, mu.a, mu.s, mu.spec);
    const m = res?.mounts?.[0];
    if (m) return { eyes: [], mounts: [{ ...m, p: [m.p[0], m.p[1] - mu.K.dy], dir: UP, s: sock.s }], spots: [] };
  }
  return { eyes: [], mounts: [{ p: sock.p, dir: sock.dir, flip: 1, s: sock.s * 0.8 }], spots: [] };
});

// petalled flower: daisy rays, cups (tulip, crocus), water lily, face-on (spread >= TAU)
head('plantBloom', (C, sock, g) => {
  const H = hstart(C, sock, g), { ink, rng, s, ax, F } = H, n = g.petals, full = g.spread > 6;
  const c = F(g.disc * 0.7, 0);
  for (let i = 0; i < n; i++) {
    const f = full ? i / n : (n > 1 ? i / (n - 1) - 0.5 : 0), a = ax + f * g.spread + rng.range(-0.05, 0.05);
    ink.poly(leaf(c, a, s * g.pl * rng.range(0.9, 1.06) * (g.round && !full ? 1 - 0.25 * Math.abs(f) * 2 : 1), s * g.pw, (g.curl ?? 0) * f * 2, g.fat ?? 0.55));
  }
  ink.dot(c, s * g.disc);
  if (g.calyx) ink.poly(lathe(H, -0.1, g.disc * 1.6, [[0, 0.15], [0.5, g.disc * 1.05], [1, g.disc * 1.2]]));
  return hend(H, [g.disc * 1.6 + (full ? g.pl * 0.6 : g.pl * 0.4), 0]);
});

// dandelion clock / allium / globe seed-head: a ball of rays tipped with beads
head('plantClock', (C, sock, g) => {
  const H = hstart(C, sock, g), { ink, rng, s, ax, F, o } = H, R = g.R, c = F(R * 0.9, 0), n = g.n;
  ink.poly(tube(polyline([o, c], 3), Math.max(s * 0.1, hair)));
  ink.dot(c, s * (g.core ?? 0.4));
  const gap0 = ax + rng.range(-2.2, 2.2), gapW = g.gap ?? 0;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + rng.range(-0.07, 0.07), inGap = gapW > 0 && Math.abs(angDiff(a, gap0)) < gapW;
    const len = s * R * (inGap ? rng.range(0.28, 0.42) : rng.range(0.93, 1.04)), e = polar(c, a, len);
    thin(ink, [c, e]);
    if (!inGap) ink.dot(e, Math.max(s * (g.bead ?? 0.15), 0.5));
    if (g.fluff && !inGap) ink.dot(polar(c, a + PI / n, len * 0.66), Math.max(s * (g.bead ?? 0.15) * 0.9, 0.5));
  }
  if (g.bracts) for (const sd of [-1, 1]) ink.poly(leaf(F(R * 0.9 - (g.core ?? 0.4), 0), ax + PI + sd * 0.9, s * 0.8, s * 0.3, 0, 0.4));
  return hend(H, [R * 1.9, 0]);
});

// dry fruits: poppy urn, lotus shower-head, nigella, physalis lantern, milkweed, cotton boll, strawberry, bud
head('plantPod', (C, sock, g) => {
  const H = hstart(C, sock, g), { ink, rng, s, ax, F, fs } = H, w = g.wid ?? 1, L = g.len ?? 1;
  let top = 2;
  switch (g.kind) {
    case 'poppy': {
      ink.poly(axTube(H, 0, 1.75 * L, [[0, 0.16], [0.14, 0.3 * w], [0.45, 0.86 * w], [0.75, 0.8 * w], [1, 0.42 * w]]));
      ink.oval(F(1.75 * L + 0.32, 0), 0.17 * s, 0.98 * w * s, ax);
      for (let i = 0; i < 5; i++) ink.dot(F(1.75 * L + 0.42, (i / 4 - 0.5) * 1.7 * w), 0.2 * s);
      top = 1.75 * L + 0.6; break;
    }
    case 'lotus': {
      const pts = [F(0, -0.22), F(1.25 * L, -1.1 * w)];
      for (let i = 0; i <= 8; i++) { const t = i / 8 * 2 - 1; pts.push(F(1.25 * L + 0.2 * (1 - t * t), t * 1.1 * w)); }
      pts.push(F(0, 0.22)); ink.poly(pts);
      for (let i = 0; i < 4; i++) ink.dot(F(1.25 * L + 0.26 - 0.1 * Math.abs(i - 1.5), (i / 3 - 0.5) * 1.5 * w), 0.2 * s);
      top = 1.25 * L + 0.4; break;
    }
    case 'nigella': {
      ink.oval(F(1.05 * L, 0), 0.95 * L * s, 0.78 * w * s, ax);
      for (let i = 0; i < 5; i++) { const f = i / 4 - 0.5; ink.poly(tube(arcPath(F(1.7 * L, f * 0.8 * w), ax + f * 1.5, 1.15 * s, f * 1.6, 7), P([[0, 0.16 * s], [1, hair]]))); }
      for (let i = 0; i < 7; i++) { const f = i / 6 - 0.5; thin(ink, arcPath(F(0.15, 0), ax + f * 4.2, 1.7 * s, -f * 1.2, 7)); }
      top = 2.5 * L; break;
    }
    case 'physalis': {
      ink.poly(axTube(H, 0, 2.3 * L, [[0, 0.14], [0.1, 0.5 * w], [0.3, 0.98 * w], [0.55, 0.86 * w], [0.85, 0.3 * w], [1, 0.06]]));
      top = 2.3 * L; break;
    }
    case 'milkweed': {
      ink.poly(leaf(H.o, ax, 2.9 * L * s, 1.25 * w * s, fs * 0.1, 0.38));
      for (let i = 0; i < 5; i++) { const b = F(1.3 + i * 0.22, -fs * 0.42), a = ax - fs * (0.6 + i * 0.22), e = polar(b, a, s * rng.range(1.1, 1.5)); thin(ink, [b, e]); ink.dot(e, Math.max(0.16 * s, 0.5)); }
      top = 2.8 * L; break;
    }
    case 'boll': {
      for (const [x, y, rr] of [[0.95, -0.5, 0.58], [0.95, 0.5, 0.58], [1.45, 0, 0.62], [0.8, 0, 0.55]]) ink.dot(F(x, y * w), rr * s * w);
      for (const d of [-1.05, 0, 1.05]) ink.poly(leaf(F(0, 0), ax + d, 1.25 * s, 0.6 * s, 0, 0.35));
      top = 2.1; break;
    }
    case 'berry': {
      ink.poly(axTube(H, 0.35, 1.75 * L, [[0, 0.6 * w], [0.25, 0.86 * w], [0.6, 0.7 * w], [1, 0.22 * w]]));
      for (let i = 0; i < 5; i++) ink.poly(leaf(F(0.2, 0), ax + (i / 4 - 0.5) * 3.6, 0.85 * s, 0.36 * s, 0, 0.4));
      top = 2; break;
    }
    default: ink.poly(leaf(H.o, ax, 2.1 * L * s, 1.1 * w * s, 0, 0.42)); top = 2 * L;
  }
  return hend(H, [top, 0]);
});

// snap-trap: two toothed lobes hinged at the base, opening like jaws, rims set with cilia
head('plantTrap', (C, sock, g) => {
  const H = hstart(C, sock, g, -0.25), { ink, s, ax, o } = H, n = g.teeth ?? 4, wid = Math.min(g.wid ?? 0.6, 0.65);
  ink.dot(o, s * 0.3);
  for (const sd of [-1, 1]) {
    const Fl = frame(o, ax + sd * g.gape, s, sd), pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14 * PI; pts.push(Fl(g.len * 0.5 * (1 - Math.cos(t)), 0.78 * wid * Math.sin(t) ** 0.8)); }
    ink.poly(pts);
    for (let i = 0; i < n; i++) { const x = g.len * (i + 0.8) / (n + 0.6), b = Fl(x, -0.02), a = ax + sd * g.gape - sd * (1.0 + 0.5 * (i / n)); ink.poly(tube([b, polar(b, a, s * (g.cil ?? 0.6))], P([[0, Math.max(s * 0.07, hair)], [1, hair * 0.8]]))); }
  }
  return hend(H, [g.len, 0]);
});

// pitchers: nepenthes pouch with lid, sarracenia trumpet with hood, cobra lily
head('plantPitcher', (C, sock, g) => {
  const H = hstart(C, sock, g, -0.95), { ink, s, ax, o, F, fs } = H, w = g.wid ?? 1, bk = -fs;
  let apex = [3, 0], world;
  if (g.kind === 'sarracenia') {
    const L = g.len ?? 4;
    ink.poly(axTube(H, 0, L, [[0, 0.14], [0.45, 0.3 * w], [0.82, 0.58 * w], [1, 0.74 * w]]));
    ink.oval(F(L + 0.05, 0), 0.2 * s, 0.9 * w * s, ax + fs * 0.12);
    ink.poly(leaf(F(L - 0.15, bk * 0.6 * w), ax - bk * 0.3, 1.9 * s, 1.7 * w * s, -bk * 0.2, 0.6));
    apex = [L + 1.6, 0];
  } else if (g.kind === 'cobra') { // tall twisted tube, a domed hood, a forked fishtail tongue hanging in front
    const L = g.len ?? 4.4, pts = arcPath(o, ax - fs * 0.05, L * s, fs * (g.hook ?? 0.35), 14);
    ink.poly(tube(pts, P([[0, 0.16 * s], [0.5, 0.3 * w * s], [0.85, 0.42 * w * s], [1, 0.5 * w * s]])));
    const e = last(pts), he = endAng(pts), hc = polar(polar(e, he, 0.35 * s), he + fs * PI / 2, 0.45 * s);
    ink.oval(hc, 1.0 * w * s, 0.82 * w * s, he + fs * 0.35);
    const mouth = polar(polar(hc, he + fs * PI / 2, 0.75 * w * s), he, -0.35 * s);
    for (const k of [-1, 1]) ink.poly(tube(arcPath(mouth, DOWN + fs * 0.15 + k * 0.32, 1.3 * s, -k * 0.5, 6), P([[0, 0.24 * s], [0.6, 0.2 * s], [1, 0.07 * s]])));
    world = polar(hc, he, 0.8 * w * s);
  } else { // nepenthes
    const L = g.len ?? 2.7;
    ink.poly(axTube(H, 0.3, L, [[0, 0.34 * w], [0.2, 0.8 * w], [0.5, 0.62 * w], [0.8, 0.56 * w], [1, 0.64 * w]]));
    ink.oval(F(L + 0.02, 0), 0.17 * s, 0.82 * w * s, ax + fs * 0.22);
    ink.poly(leaf(F(L + 0.05, bk * 0.62 * w), ax - bk * (g.lid ?? 0.9), 1.5 * s, 1.05 * w * s, 0, 0.55));
    apex = [L + 1, 0];
  }
  return hend(H, apex, world);
});

// arums: jack-in-the-pulpit, cuckoo-pint, calla, titan
head('plantArum', (C, sock, g) => {
  const H = hstart(C, sock, g, -1.1), { ink, s, ax, o, F, fs } = H, bk = -fs, w = g.wid ?? 1;
  let apex = [3.4, 0];
  switch (g.kind) {
    case 'jack': {
      ink.poly(lathe(H, 0, 2.2, [[0, 0.2], [0.25, 0.5 * w], [1, 0.66 * w]]));
      ink.poly(axTube(H, 1.5, 2.95, [[0, 0.2], [0.7, 0.25], [1, 0.25]]));
      ink.poly(tube(arcPath(F(1.9, bk * 0.5 * w), ax + bk * 0.3, 4.1 * s, fs * 2.5, 16, 1.25), P([[0, 0.3 * s], [0.3, 0.52 * s], [0.6, 0.45 * s], [1, 0.05]])));
      apex = [3.5, 0]; break;
    }
    case 'calla': {
      ink.poly(lathe(H, 0, 2.5, [[0, 0.16], [0.35, 0.32 * w], [0.75, 0.7 * w], [1, 1.0 * w]]));
      ink.poly(leaf(F(2.0, bk * 0.5 * w), ax + bk * 0.35, 2.2 * s, 1.5 * w * s, bk * 0.25, 0.5));
      ink.poly(axTube(H, 1.8, 3.3, [[0, 0.17], [1, 0.19]]));
      apex = [3.8, 0]; break;
    }
    case 'titan': { // ribbed vase-shaped spathe with a frilled rim, a huge spadix rising from it
      const cup = 2.6, top = [], bot = [], N = 16, prof = P([[0, 0.55], [0.35, 1.25 * w], [0.75, 1.6 * w], [1, 2.05 * w]]);
      for (let i = 0; i <= N; i++) { const t = i / N, x = cup * t, rr = prof(t) + (i === N ? 0.25 : 0); top.push(F(x, -rr)); bot.push(F(x, rr)); }
      for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1; bot.push(F(cup + 0.12 + 0.18 * Math.cos(i * PI) - 0.25 * t * t, -t * 2.15 * w)); }
      ink.poly(top.concat(bot.slice(N + 1).reverse(), bot.slice(0, N + 1).reverse()));
      ink.poly(axTube(H, 1.0, g.len ?? 6, [[0, 0.75], [0.35, 0.68], [0.8, 0.42], [1, 0.22]]));
      apex = [(g.len ?? 6) + 0.2, 0]; break;
    }
    default: { // cuckoo-pint: hooded sheath with a club standing in front of it
      ink.oval(F(0.55, 0), 0.62 * s, 0.5 * w * s, ax);
      ink.poly(tube(arcPath(F(0.2, bk * 0.1), ax + bk * 0.42, 4.9 * s, fs * 1.0, 16, 1.2), P([[0, 0.3 * s], [0.25, 0.7 * w * s], [0.6, 0.55 * w * s], [1, 0.05]])));
      ink.poly(tube([F(0.6, fs * 0.2), F(1.8, fs * 0.5), F(3.0, fs * 0.72)], P([[0, 0.14 * s], [0.55, 0.16 * s], [0.75, 0.3 * s], [1, 0.28 * s]])));
      apex = [4.4, 0];
    }
  }
  return hend(H, apex);
});

// lady's slipper orchid: pouch, dorsal sepal, two twisted side petals
head('plantSlipper', (C, sock, g) => {
  const H = hstart(C, sock, g, -1.0), { ink, s, ax, F, fs } = H;
  ink.poly(leaf(F(0.1, 0), ax - fs * 0.12, 2.3 * s, 1.1 * s, -fs * 0.1, 0.5));
  ink.oval(F(-0.2, fs * 1.0), 1.08 * s * (g.pouch ?? 1), 0.74 * s * (g.pouch ?? 1), ax + fs * 2.0);
  ink.dot(F(0.3, fs * 0.5), 0.4 * s);
  for (const k of [1, -1]) ink.poly(tube(arcPath(F(0.2, 0), ax + k * fs * (k > 0 ? 2.45 : 2.1), 2.5 * s, -k * fs * 0.7, 10), P([[0, 0.14 * s], [0.35, 0.24 * s], [1, 0.06]])));
  return hend(H, [2.4, 0]);
});

// bells: snowdrop, fritillary, foxglove, bindweed trumpet, bleeding heart
head('plantBell', (C, sock, g) => {
  const H = hstart(C, sock, g, 0.3), { ink, s, ax, F, fs } = H, w = g.wid ?? 1;
  switch (g.kind) {
    case 'snowdrop':
      ink.oval(F(0.3, 0), 0.34 * s, 0.27 * s, ax);
      for (const d of [-0.46, 0.46, 0]) ink.poly(leaf(F(0.45, 0), ax + d, (d ? 2.2 : 1.7) * s, 0.8 * w * s, d * 0.25, 0.58));
      break;
    case 'fritillary':
      ink.poly(lathe(H, 0, 2.0, [[0, 0.2], [0.2, 0.84 * w], [0.65, 0.9 * w], [1, 0.96 * w]]));
      for (const y of [-0.62, 0, 0.62]) ink.poly(leaf(F(1.85, y * w), ax + y * 0.25, 0.75 * s, 0.66 * s * w, 0, 0.3));
      break;
    case 'trumpet':
      ink.poly(lathe(H, 0, 1.9, [[0, 0.14], [0.45, 0.3], [0.8, 0.75 * w], [1, 1.3 * w]]));
      ink.oval(F(1.9, 0), 0.16 * s, 1.3 * w * s, ax);
      ink.poly(leaf(F(-0.1, 0), ax, 0.7 * s, 0.6 * s, 0, 0.4));
      break;
    case 'heart':
      for (const sd of [-1, 1]) { ink.dot(F(0.62, sd * 0.45), 0.58 * s); ink.poly(tube(arcPath(F(1.45, sd * 0.2), ax + sd * 0.5, 0.75 * s, sd * 1.9, 6), P([[0, 0.2 * s], [1, 0.09 * s]]))); }
      ink.poly(lathe(H, 0.6, 1.6, [[0, 0.98], [0.6, 0.48], [1, 0.2]]));
      ink.oval(F(1.95, 0), 0.34 * s, 0.2 * s, ax);
      break;
    default: // foxglove
      ink.poly(lathe(H, 0, 2.0, [[0, 0.24], [0.3, 0.5 * w], [0.75, 0.62 * w], [1, 0.86 * w]]));
      ink.poly(leaf(F(1.7, fs * 0.45 * w), ax + fs * 0.25, 0.9 * s, 0.8 * s, 0, 0.5));
      ink.oval(F(2.0, 0), 0.13 * s, 0.86 * w * s, ax);
  }
  return hend(H, [2.3, 0]);
});

// prickly heads: thistle, teasel, burdock, sea holly
head('plantBur', (C, sock, g) => {
  const H = hstart(C, sock, g), { ink, rng, s, ax, F } = H, w = g.wid ?? 1;
  const ring = (cx, rx, ry, n, len, wd, bias) => { for (let i = 0; i < n; i++) { const t = i / n * TAU + 0.2, q = F(cx + rx * Math.cos(t), ry * Math.sin(t)); ink.poly(leaf(q, ax + t * (1 - bias) + (bias ? angDiff(t, 0) * 0 : 0), len * s, wd * s, 0, 0.25)); } };
  let top = 2.4;
  switch (g.kind) {
    case 'teasel': {
      ink.oval(F(1.5, 0), 1.3 * s, 0.74 * w * s, ax);
      for (let i = 0; i < 18; i++) { const t = i / 18 * TAU, q = F(1.5 + 1.25 * Math.cos(t), 0.7 * w * Math.sin(t)); ink.poly(leaf(q, ax + t * 0.55, 0.42 * s, 0.24 * s, 0, 0.25)); }
      for (const sd of [-1, 1]) for (const k of [0, 1]) ink.poly(tube(arcPath(F(0.15, 0), ax + sd * (1.5 - k * 0.35), (2.9 + k * 0.8) * s, -sd * (1.35 - k * 0.2), 10, 0.9), P([[0, 0.15 * s], [0.6, 0.12 * s], [1, hair]])));
      ink.poly(leaf(F(2.6, 0), ax, 0.7 * s, 0.4 * s, 0, 0.3));
      top = 3.2; break;
    }
    case 'burdock': {
      ink.dot(F(1.05, 0), 0.95 * w * s);
      for (let i = 0; i < 15; i++) { const t = i / 15 * TAU, q = F(1.05 + 0.9 * w * Math.cos(t), 0.9 * w * Math.sin(t)); ink.poly(tube(arcPath(q, ax + t, 0.62 * s, 2.2, 6, 2), P([[0, 0.1 * s], [1, hair]]))); }
      top = 2.3; break;
    }
    case 'seaholly': {
      for (let i = 0; i < 8; i++) { const a = ax + (i / 7 - 0.5) * 3.9, b = F(0.35, 0); ink.poly(leaf(b, a, 2.0 * s * rng.range(0.85, 1.1), 0.5 * s, 0, 0.35)); for (const sd of [-1, 1]) ink.poly(leaf(polar(b, a, 0.9 * s), a + sd * 0.8, 0.7 * s, 0.26 * s, 0, 0.3)); }
      ink.oval(F(1.05, 0), 0.85 * s, 0.6 * w * s, ax);
      top = 2; break;
    }
    default: { // thistle: a spiny, bulbous involucre with a shaving-brush of florets on top
      ink.poly(lathe(H, 0, 1.75, [[0, 0.25], [0.45, 0.88 * w], [0.8, 0.78 * w], [1, 0.5 * w]]));
      for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { const x = 0.35 + i * 0.35; ink.poly(leaf(F(x, sd * 0.75 * w * Math.sin(PI * (0.25 + x / 2.2))), ax + sd * (1.25 - i * 0.18), 0.6 * s, 0.22 * s, 0, 0.2)); }
      ink.poly(lathe(H, 1.6, 2.8, [[0, 0.45 * w], [0.6, 0.8 * w], [1, 0.95 * w]]));
      for (let i = 0; i < 5; i++) { const f = i / 4 - 0.5; ink.poly(leaf(F(2.6, f * 1.6 * w), ax + f * 0.8, 0.5 * s, 0.32 * s, 0, 0.5)); }
      top = 3.1;
    }
  }
  void ring;
  return hend(H, [top, 0]);
});

// cones and spikes: pine cone, hop, horsetail and clubmoss strobili, cattail, moss capsule, adder's-tongue, moonwort
head('plantCone', (C, sock, g) => {
  const H = hstart(C, sock, g), { ink, s, ax, F, fs } = H, w = g.wid ?? 1, L = g.len ?? 2.2;
  const scales = (n, sa, sl, sw) => { for (let i = 0; i < n; i++) { const x = L * (i + 0.6) / (n + 0.4), hw = w * 0.5 * Math.sqrt(Math.max(1 - (2 * x / L - 1) ** 2, 0)); for (const sd of [-1, 1]) ink.poly(leaf(F(x, sd * hw * 0.7), ax + sd * sa, sl * s, sw * s, 0, 0.5)); } };
  let top = L;
  switch (g.kind) {
    case 'cattail':
      ink.poly(axTube(H, 0.4, 0.4 + L, [[0, 0.42 * w], [1, 0.42 * w]]));
      ink.poly(tube([F(0.4 + L, 0), F(L + 2.1, 0)], P([[0, 0.12 * s], [1, hair]])));
      top = L + 2.1; break;
    case 'moss':
      ink.poly(axTube(H, 0.2, 1.5, [[0, 0.22], [0.25, 0.52 * w], [0.75, 0.5 * w], [1, 0.34 * w]]));
      ink.poly(leaf(F(1.5, 0), ax + fs * 0.25, 1.0 * s, 0.5 * s, fs * 0.2, 0.25));
      top = 2.4; break;
    case 'grape': // moonwort fertile spike
      thin(ink, [H.o, F(L, 0)], MINW * 1.3);
      for (let i = 0; i < 6; i++) { const x = L * (0.35 + 0.65 * i / 5), sd = i % 2 ? 1 : -1; ink.dot(F(x, sd * 0.3 * w), 0.3 * s); ink.dot(F(x + 0.15, -sd * 0.22 * w), 0.24 * s); }
      break;
    case 'adder': // slender spike with two beaded rows
      ink.poly(tube([H.o, F(L * 0.3, 0), F(L, 0)], P([[0, 0.1 * s], [0.3, 0.2 * w * s], [0.9, 0.2 * w * s], [1, 0.06 * s]])));
      for (let i = 0; i < 7; i++) for (const sd of [-1, 1]) ink.dot(F(L * (0.34 + 0.085 * i), sd * 0.2 * w), 0.15 * s);
      break;
    case 'hop':
      ink.oval(F(L / 2, 0), L / 2 * s, w * 0.5 * s, ax); scales(4, 0.45, 0.85, 0.6);
      ink.poly(leaf(F(L * 0.8, 0), ax, 0.6 * s, 0.5 * s, 0, 0.4)); top = L + 0.3; break;
    case 'horsetail':
      ink.oval(F(L / 2 + 0.1, 0), L / 2 * s, w * 0.5 * s, ax);
      for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) ink.dot(F(L * (0.22 + 0.15 * i), sd * w * 0.44 * Math.sqrt(1 - (0.44 + 0.3 * i - 1) ** 2 * 0.9)), 0.14 * s);
      ink.poly(leaf(F(L * 0.85, 0), ax, 0.55 * s, 0.3 * s, 0, 0.3)); top = L + 0.4; break;
    case 'club': { // clubmoss: slender strobili, optionally forked like a candelabrum
      const k = g.fork ?? 1, st = g.stalk ?? 1.5;
      thin(ink, [H.o, F(st, 0)], Math.max(0.16 * s, MINW));
      for (let i = 0; i < k; i++) { const d = k > 1 ? (i / (k - 1) - 0.5) * 0.9 : 0, b = F(st, 0), pts = arcPath(b, ax + d * 1.6, L * s, -d * 1.5, 8); ink.poly(tube(pts, P([[0, 0.1 * s], [0.25, 0.22 * w * s], [0.85, 0.2 * w * s], [1, 0.08 * s]]))); }
      top = st + L; break;
    }
    default: // pine
      ink.oval(F(L / 2, 0), L / 2 * s, w * 0.5 * s, ax); scales(g.rows ?? 5, 1.0, 0.5, 0.42);
  }
  return hend(H, [top, 0]);
});

// fiddlehead crozier
head('plantFiddle', (C, sock, g) => {
  const H = hstart(C, sock, g, -0.5), { ink, s, ax, o, fs } = H;
  const w = (g.w ?? 0.3) * s * (H.animal ? 1.5 : 1), L = (g.len ?? 7) * s * (H.animal ? 0.8 : 1);
  const pts = arcPath(o, ax - fs * (g.lean ?? 0.3), L, fs * (g.turns ?? 1.5) * TAU, 44, g.k ?? 3.2, 0.8);
  ink.poly(tube(pts, P([[0, w], [0.5, w * 0.85], [1, w * 0.5]])));
  if (g.nubs) for (let i = 3; i < 24; i += 3) ink.poly(leaf(pts[i], angOf(pts[i - 1], pts[i]) - fs * 1.3, w * 2.2, w * 1.3, 0, 0.4));
  return hend(H, null, pts.reduce((m, p) => (p[1] < m[1] ? p : m), pts[0]));
});

// umbels: hogweed parasol, liverwort umbrella (drooping fingers), ginseng whorl
head('plantUmbel', (C, sock, g) => {
  const H = hstart(C, sock, g, -0.6), { ink, rng, s, ax, o, F } = H, n = g.n ?? 7, R = g.R ?? 2;
  if (g.kind === 'palm') { // marchantia archegoniophore
    const c = F(0.25, 0); ink.dot(c, 0.36 * s);
    for (let i = 0; i < n; i++) { const f = i / (n - 1) - 0.5; ink.poly(tube(arcPath(c, ax + f * 3.3, R * s * (1 - 0.2 * Math.abs(f)), f * 1.9, 8, 1.5), P([[0, 0.17 * s], [0.8, 0.14 * s], [1, 0.1 * s]]))); }
    return hend(H, [0.7, 0]);
  }
  if (g.kind === 'whorl') { // stalk, a whorl of palmate leaves, a knot of berries
    const st = g.stalk ?? 2, c = F(st, 0);
    thin(ink, [o, c], Math.max(0.16 * s, MINW));
    for (let i = 0; i < n; i++) { const f = n > 1 ? i / (n - 1) - 0.5 : 0, a = ax + f * 2.7, e = polar(c, a, R * 0.55 * s); thin(ink, [c, e], MINW * 1.2); U.leaves(C, e, a, s * R * 0.6, { n: 5, spread: 2.6, len: 1, wid: 0.34 }); }
    thin(ink, [c, F(st + R * 0.55, 0)], MINW); U.berries(C, F(st + R * 0.5, 0), ax, s * 0.8, { n: 4 });
    return hend(H, [st + R, 0]);
  }
  // compound umbel: spokes to a flat-topped parasol of florets
  const sp = g.spread ?? 2.1, ends = [];
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) - 0.5 : 0, a = ax + f * sp, e = polar(o, a, R * s * (1 + 0.35 * f * f * 4) * rng.range(0.97, 1.03));
    thin(ink, [o, e], Math.max(0.09 * s, MINW)); ends.push(e);
  }
  const top = ends.map(e => polar(e, ax, 0.12 * s));
  ink.poly(tube(spline(top, 4), Math.max(0.24 * s * (g.puff ?? 1), 0.8)));
  for (let i = 0; i < 2 * n - 1; i++) { const q = lerp(top[Math.floor(i / 2)], top[Math.ceil(i / 2)], 0.5); ink.dot(polar(q, ax, 0.22 * s), 0.27 * s * (g.puff ?? 1)); }
  return hend(H, [R, 0]);
});

// leafy tuft: carrot top, mandrake leaves, onion shoots, fountain of straps
head('plantTuft', (C, sock, g) => {
  const H = hstart(C, sock, g, -0.9), { ink, rng, s, ax, o } = H, n = g.n ?? 5, len = g.len ?? 2.5, wid = g.wid ?? 0.9;
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) - 0.5 : 0, a = ax + f * (g.spread ?? 2) + rng.range(-0.1, 0.1), L = len * s * (1 - 0.3 * Math.abs(f)) * rng.range(0.85, 1.1);
    if (g.kind === 'strap') { const w = wid * s * 0.5; ink.poly(tube(droop(o, a, L, (g.grav ?? 1.4) * rng.range(0.7, 1.2), 12, w + 0.4), P([[0, w * 0.5], [0.25, w], [0.7, w * 0.7], [1, 0.12]]))); }
    else if (g.kind === 'tube') ink.poly(tube(arcPath(o, a, L, f * rng.range(0.2, 0.9), 8), P([[0, wid * s * 0.3], [0.6, wid * s * 0.34], [1, 0.1]])));
    else if (g.kind === 'feather') frond(ink, arcPath(o, a, L, f * 0.9, 10), L * 0.26, L * 0.1, 6, { rw: 0.45, env: [[0, 0.5], [0.4, 1], [1, 0.35]], t0: 0.3 });
    else ink.poly(leaf(o, a, L, wid * s, f * 0.35, g.fat ?? 0.55));
  }
  if (g.berries) U.berries(C, polar(o, ax, s * 0.3), ax, s * 0.9, { n: 3 });
  return hend(H, [len * 0.8, 0]);
});

// flowering spires: foxglove, lupin, aloe torch, agave mast
head('plantSpire', (C, sock, g) => {
  const H = hstart(C, sock, g, -1.0), { ink, rng, s, ax, o, fs } = H, L = (g.len ?? 5) * s * (H.animal ? 0.7 : 1), n = g.n ?? 7;
  const pts = arcPath(o, ax, L, fs * (g.bow ?? 0.15), 14);
  ink.poly(tube(pts, P([[0, Math.max(0.16 * s, hair)], [1, hair]])));
  for (let i = 0; i < n; i++) {
    const u = mix(g.t0 ?? 0.12, 0.96, i / (n - 1)), { p, ang } = pathAt(pts, u), k = mix(1, 0.4, u) * s;
    if (g.kind === 'lupin') for (const sd of [-1, 1]) ink.poly(leaf(p, ang + sd * 0.95, 0.95 * k, 0.6 * k, -sd * 0.3, 0.55));
    else if (g.kind === 'torch') { const d = mix(2.5, 0.5, u ** 1.5); for (const sd of [-1, 1]) ink.poly(leaf(p, ang + sd * d, 1.0 * k + 0.2 * s, 0.34 * s, 0, 0.5)); }
    else if (g.kind === 'mast') { if (i % 2 === 0 || true) { const sd = i % 2 ? 1 : -1, e = polar(polar(p, ang + sd * 1.35, 1.5 * k), ang, 0.5 * k); ink.poly(tube(spline([p, polar(p, ang + sd * 1.4, 1.1 * k), e], 4), Math.max(0.09 * s, hair))); ink.oval(e, 0.3 * k + 0.1 * s, 0.75 * k, ang); } }
    else if (i < n - 1) heads.plantBell(C, usock(polar(p, ang + fs * PI / 2, 0.25 * s), ang + fs * mix(2.3, 1.9, u) + rng.range(-0.1, 0.1), 0.42 * k + 0.1 * s, fs), { kind: 'foxglove', fs });
  }
  ink.poly(leaf(last(pts), endAng(pts), 0.5 * s, 0.3 * s, 0, 0.4));
  return hend(H, null, last(pts));
});

// a single leaf (or other unit) carried as a head
head('plantLeaf', (C, sock, g) => {
  const H = hstart(C, sock, g, -0.7);
  drawUnit(C, H.o, H.ax + (H.animal ? 0 : (g.tilt ?? 0) * H.fs), H.s, g.unit);
  return hend(H, [1, 0]);
});

// ---------------------------------------------------------------------
// 4. PEN, CHASSIS, LENDABLE PARTS
// ---------------------------------------------------------------------
// A plant is drawn in ground coordinates (y = 0 is the soil) through a pen that clamps
// everything to the ground line (roots drawn inside pen.root() may poke a sliver below) and
// lifts the whole plant by dy when it walks on borrowed legs.
class Pen {
  constructor(ink, dy) { this.ink = ink; this.dy = dy; this.floor = 0; }
  poly(pts, layer = 'k') { const f = this.floor, dy = this.dy; this.ink.poly(pts.map(p => [p[0], Math.min(p[1], f) - dy]), layer); return this; }
  tube(ctrl, rad, layer = 'k', per = 8) { return this.poly(tube(spline(ctrl, per), rad), layer); }
  line(ctrl, w, layer = 'k', per = 6) { const r = Math.max(w, MINW) / 2; return this.poly(tube(spline(ctrl, per), P([[0, r], [0.7, r * 0.9], [1, Math.max(r * 0.55, MINW / 2.4)]])), layer); }
  dot(c, r, layer = 'k') { return this.poly(ellipse(c, r, r, 0, 18), layer); }
  oval(c, rx, ry, rot = 0, layer = 'k') { return this.poly(ellipse(c, rx, ry, rot), layer); }
  root(fn) { const f = this.floor; this.floor = 1.3; fn(); this.floor = f; }
}
function stripOf(path, rad, t0, t1, n, sd) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = mix(t0, t1, i / (n - 1)), { p, ang } = pathAt(path, t), na = ang + sd * PI / 2; out.push({ p: polar(p, na, rad(t) * 0.85), dir: na, t }); }
  return out;
}

const FORMS = {};
chassis.plant = (C, g) => {
  const own = g._own, ownLimbs = !!own && C.lift === own.lift;
  if (own) for (const o of own.mute) { for (const k of Object.keys(o)) delete o[k]; o.type = 'none'; } // lend-only ornaments
  const R0 = g.R ?? 6, dy = ownLimbs ? 0 : C.lift * R0 * 1.1 + R0 * 0.7;
  const K = new Pen(C.ink, dy), Cp = { ...C, ink: K, plantDraw: true };
  const o = FORMS[g.form](Cp, g);
  const sh = p => [p[0], p[1] - dy];
  const r = clamp(o.r, 3.5, 9), limbs = [];
  if (!ownLimbs) { // a root-ball to walk on
    const [x0, x1] = o.foot, cx = (x0 + x1) / 2, w = Math.max(x1 - x0, 10), ry = Math.min(dy * 0.6, w * 0.32), ls = clamp(w * 0.26, 4, 9);
    C.ink.poly(superE([cx, -dy], w * 0.55, ry, 0, 2.3));
    for (const [k, far] of [[0.3, false], [-0.3, false], [0.12, true], [-0.42, true]]) limbs.push({ p: [cx + k * w, -dy + ry * 0.3], dir: DOWN, s: ls, role: k > 0 ? 'fore' : 'hind', far, ground: 0, fwd: 0, side: 1 });
    for (const a of o.arms ?? []) limbs.push({ p: sh(a.p), dir: a.sd > 0 ? C.rng.range(0.3, 1.0) : PI - C.rng.range(0.4, 1.1), s: ls * 0.8, role: 'arm', fwd: PI / 2, side: a.sd });
  }
  const path = o.path.map(sh), back = o.strips ? o.strips.map(st => st.map(k => ({ ...k, p: sh(k.p) }))) : [stripOf(path, o.rad, 0.3, 0.9, 8, -1), stripOf(path, o.rad, 0.3, 0.9, 8, 1)];
  const hs = o.head.s ?? r;
  return {
    view: 'side', rooted: true, alt: true, plantOwn: true, r, path, rad: o.rad,
    head: { p: sh(o.head.p), dir: o.head.dir ?? UP, face: C.rng.range(-0.1, 0.25), s: hs, sym: false, radial: true },
    tail: { p: sh(o.tailP ?? [o.foot[0] + 1, -r * 0.6]), dir: PI + C.rng.range(0, 0.35), s: r * 0.6 },
    limbs, back, mainUnit: o.main ? { ...o.main, K } : null,
  };
};

// Lendable parts. `unit` is any U kind or plant head spec.
// A row of units along a back: leaves, thorns, little flowers, fronds, pitchers.
dorsals.plantRow = (C, plan, strip, sd, si, g, at) => {
  const { rng } = C, r = plan.r, n = g.n, side = plan.view === 'side';
  if (side && si === 1 && !g.both) return;
  for (let i = 0; i < n; i++) {
    const u = clamp((i + 0.5) / n + rng.range(-0.04, 0.04), 0, 1), k = at(u), env = 0.6 + 0.4 * Math.sin(PI * u);
    let a = k.dir + rng.range(-0.15, 0.15) + (g.rake ?? 0);
    if (side) a = a + angDiff(UP, a) * (g.up ?? 0.4) - (g.back ?? 0.35);
    drawUnit(C, polar(k.p, k.dir, -r * 0.25), a, r * g.size * env * rng.range(0.85, 1.1), g.unit);
  }
};
// A stalk from the head carrying one unit: sprout, flower, trap, crozier; leaf ears when paired.
crowns.plantSprig = (C, m, F, s, g) => {
  const { rng } = C, side = C.plan.view === 'side';
  let a = m.dir + (g.lean ?? 0) * m.flip + rng.range(-0.1, 0.1);
  if (side && !g.ears) a = a + angDiff(UP, a) * 0.5;
  const b = F(-0.15, 0), st = s * (g.stem ?? 1), top = polar(polar(b, a, st * 0.5), a + PI / 2 * m.flip, st * (g.crook ?? 0.08)), e = polar(b, a, st);
  if (st > 0.3) C.ink.poly(tube(spline([b, top, e], 5), P([[0, Math.max(s * 0.13, hair)], [1, Math.max(s * 0.09, hair)]])));
  drawUnit(C, e, a, s * (g.size ?? 1), g.unit);
};
// A unit at the end of a tail.
tips.plantOrn = (C, e, ea, s, g) => { const a = C.plan.view === 'side' ? ea + angDiff(UP, ea) * (g.tipUp ?? 0.4) : ea; drawUnit(C, e, a, s * (g.tipS ?? 1), g.unit); };
// Rootlet feet: splay along the ground (side view), or fan like twiggy fingers.
feet.plantRoot = (C, p, ang, s, g, k) => {
  const { ink, rng } = C, n = g.toes ?? 3, tl = (g.toeLen ?? 0.9) * s * k, onGround = C.plan.view === 'side' && p[1] > -s * 0.6;
  ink.dot(p, Math.max(s * 0.17 * k, hair));
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) - 0.5 : 0;
    let a = onGround ? (f < 0 ? PI - 0.25 : 0.25) + f * 0.6 + rng.range(-0.15, 0.15) : ang + f * 1.5 + rng.range(-0.15, 0.15);
    let pts = arcPath(p, a, tl * rng.range(0.8, 1.25), rng.range(-0.8, 0.8), 6, 1.5);
    if (onGround) pts = floorPts(pts, 0.35);
    ink.poly(tube(pts, P([[0, Math.max(s * 0.11 * k, hair)], [1, hair * 0.9]])));
  }
};

// ---------------------------------------------------------------------
// 5. FORMS (body plans for chassis.plant). Each draws into Cp.ink (a Pen, ground coords)
// and returns { r, path, rad, head: {p, dir, s}, foot: [x0, x1], main?, strips?, arms?, tailP? }.
// ---------------------------------------------------------------------
function stemPts(p, a0, len, turn = 0, nod = 0, n = 16, wav = 0, ph = 0) {
  const pts = [p]; let q = p;
  for (let i = 1; i <= n; i++) { const u = (i - 0.5) / n; q = polar(q, a0 + turn * u + nod * ss(0.5, 1, u) + wav * Math.sin(ph + u * TAU), len / n); pts.push(q); }
  return pts;
}
// One stem with leaves, whorls, prickles, branches and a crowning unit. Returns its points.
function drawStem(Cp, p, a0, st, keepHead) {
  const K = Cp.ink, rng = Cp.rng;
  const raw = stemPts(p, a0, st.h, st.arc ?? 0, st.nod ?? 0, 16, st.wav ?? 0, rng.range(0, TAU)), pts = floorPts(raw, 0.4);
  const w0 = Math.max(st.w ?? 1, hair), w1 = Math.max(st.w1 ?? w0 * 0.6, hair);
  const rad = P([[0, w0], [1, w1]]);
  K.poly(tube(pts, rad));
  const L = st.leaves;
  if (L) for (let i = 0; i < L.n; i++) {
    const u = L.n > 1 ? i / (L.n - 1) : 0.5, t = mix(L.t0 ?? 0.15, L.t1 ?? 0.8, u) + rng.range(-0.02, 0.02), q = pathAt(pts, t);
    for (const sd of L.pair ? [-1, 1] : [(i % 2 ? 1 : -1) * (L.sd ?? 1)]) {
      const a = q.ang + sd * (L.ang ?? 0.9) + rng.range(-0.15, 0.15);
      drawUnit(Cp, q.p, a, L.s * mix(1, L.k1 ?? 0.6, u) * rng.range(0.88, 1.1), L.spec);
    }
  }
  const J = st.joints; // horsetail nodes: sheath collars and whorls of needles
  if (J) for (let i = 0; i < J.n; i++) {
    const u = (i + 1) / (J.n + 1), q = pathAt(pts, u), wr = rad(u);
    K.poly(tube([polar(q.p, q.ang, -wr * 0.8), polar(q.p, q.ang, wr * 0.8)], wr * 1.35));
    if (J.len) for (const sd of [-1, 1]) for (let j = 0; j < (J.k ?? 1); j++) {
      const len = J.len * mix(1, J.k1 ?? 0.35, u) * rng.range(0.85, 1.1) * (j ? 0.7 : 1), a = q.ang + sd * (J.ang ?? 1.15) * (j ? 0.6 : 1);
      K.poly(tube(floorPts(arcPath(q.p, a, len, sd * (J.curl ?? 0.5), 8, 1.6), 0.4), P([[0, hair * 1.15], [1, hair * 0.85]])));
    }
  }
  if (st.prickles) for (let i = 0; i < st.prickles; i++) { const t = rng.range(0.08, 0.85), q = pathAt(pts, t), sd = rng.sign(); K.poly(leaf(polar(q.p, q.ang + sd * PI / 2, rad(t) * 0.6), q.ang + sd * 1.1 + 0.4 * (sd > 0 ? -1 : 1) * 0, rad(t) * 1.2 + 0.6, rad(t) * 0.9 + 0.3, 0, 0.2)); }
  const B = st.branch;
  if (B) for (let i = 0; i < B.n; i++) {
    const u = B.n > 1 ? i / (B.n - 1) : 0.5, t = mix(B.t0 ?? 0.4, B.t1 ?? 0.8, u), q = pathAt(pts, t), sd = (i % 2 ? 1 : -1) * (B.sd ?? 1);
    const k = mix(1, B.k1 ?? 0.7, u) * rng.range(0.85, 1.1);
    drawStem(Cp, q.p, q.ang + sd * (B.ang ?? 0.6) + rng.range(-0.12, 0.12), { ...B, n: 0, h: B.h * k, w: Math.min(B.w ?? rad(t) * 0.75, rad(t)), w1: B.w1, arc: (B.arc ?? 0) * sd, nod: (B.nod ?? 0) * sd, branch: B.branch, hs: (B.hs ?? 1) * mix(1, 0.85, u) });
  }
  if (st.head) {
    const e = last(pts), ea = endAng(raw);
    if (keepHead) return { pts, main: { p: e, a: ea, s: st.hs, spec: st.head } };
    drawUnit(Cp, e, ea, st.hs, st.head);
  }
  return { pts };
}
// Rosette of units at ground level, fanning around `up`.
function drawBasal(Cp, B) {
  const rng = Cp.rng, n = B.n;
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? (i + rng.range(-0.25, 0.25)) / (n - 1) - 0.5 : 0, a = UP + (B.tilt ?? 0) + f * B.spread;
    const k = mix(B.inner ?? 0.75, 1, Math.abs(f) * 2) * rng.range(0.85, 1.12);
    drawUnit(Cp, [(B.x ?? 0) + f * (B.wx ?? 2), -(B.y ?? 0.4)], a, B.s * k, B.spec);
  }
}
// ground substrates
const SUB = {
  cushion: (Cp, o) => { const rng = Cp.rng, pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30, x = (t - 0.5) * 2 * o.w, y = -o.h * Math.sqrt(Math.max(1 - (2 * t - 1) ** 2, 0)) ** 0.45 * (1 + 0.07 * Math.sin(i * 1.9 + o.ph)); pts.push([o.x + x, y]); } pts.push([o.x + o.w, 0.5], [o.x - o.w, 0.5]); Cp.ink.poly(pts); for (let i = 0; i < 14; i++) { const t = rng.range(0.05, 0.95), x = (t - 0.5) * 2 * o.w, y = -o.h * Math.sqrt(1 - (2 * t - 1) ** 2) ** 0.45; Cp.ink.poly(leaf([o.x + x, y + 0.6], UP + (t - 0.5) * 2.4 + rng.range(-0.3, 0.3), rng.range(1.2, 2.2), 0.9, 0, 0.4)); } },
  thallus: (Cp, o) => { const rng = Cp.rng, pts = [[o.x - o.w / 2, 0.4]]; for (let i = 0; i <= o.n * 4; i++) { const t = i / (o.n * 4), x = o.x + (t - 0.5) * o.w, lobe = Math.abs(Math.sin(t * o.n * PI)); pts.push([x, -(0.6 + 1.6 * lobe ** 0.6) * Math.min(1, Math.sin(PI * t) * 3 + 0.3)]); } pts.push([o.x + o.w / 2, 0.4]); Cp.ink.poly(pts); void rng; },
  pebbles: (Cp, o) => { const rng = Cp.rng; for (let i = 0; i < o.n; i++) { const r = rng.range(0.9, 1.8); Cp.ink.oval([o.x + rng.range(-o.w, o.w), -r * 0.7], r * 1.25, r, rng.range(-0.3, 0.3)); } },
};
// 'stems': the workhorse. A substrate, a basal rosette, and stems; stems[0] is the main stem.
FORMS.stems = (Cp, g) => {
  if (g.sub) SUB[g.sub.kind](Cp, g.sub);
  if (g.base) Cp.ink.poly(superE([g.base.x ?? 0, 0], g.base.w, g.base.h, 0, 2.2));
  for (const B of g.basal ?? []) drawBasal(Cp, B);
  let main = null, mp = null, mst = null;
  g.stems.forEach((st, i) => {
    const res = drawStem(Cp, [st.x ?? 0, 0.2], UP + (st.lean ?? 0), st, i === 0 && g.keepHead !== false);
    if (i === 0) { main = res.main; mp = res.pts; mst = st; }
  });
  if (g.roots) Cp.ink.root(() => { for (const x of g.roots) for (const sd of [-1, 1]) Cp.ink.poly(tube(arcPath([x, -0.2], DOWN + sd * 1.1, 2.4, -sd * 0.6, 5), P([[0, 0.55], [1, hair]]))); });
  if (!mp) { mp = stemPts([0, 0], UP, g.coreH ?? 8, 0, 0, 8); mst = { w: 2, w1: 1.5 }; }
  const xs = g.stems.map(s => s.x ?? 0).concat((g.basal ?? []).map(b => b.x ?? 0));
  const x0 = Math.min(...xs) - 3, x1 = Math.max(...xs) + 3;
  const top = mp ? last(mp) : [0, -10];
  return { r: g.r ?? Math.max((mst?.w ?? 1) * 2.5, 4), path: mp, rad: P([[0, mst?.w ?? 1], [1, mst?.w1 ?? 0.6]]), head: { p: top, dir: mp ? endAng(mp) : UP, s: g.headS ?? 4 }, foot: [x0, x1], main };
};

// more units, used by the forms and species below
// a stalk (petiole, pedicel) carrying a unit, which turns partly upward
U.stalk = (C, p, a, s, o) => {
  const sg = Math.cos(a) >= 0 ? 1 : -1, pts = floorPts(arcPath(p, a, s * (o.ped ?? 0.8), -sg * (o.rise ?? 0.3), 6), 0.5);
  thin(C.ink, pts, Math.max(s * (o.pw ?? 0.06), MINW));
  const ea = endAng(pts); drawUnit(C, last(pts), ea + angDiff(UP, ea) * (o.up ?? 0.3), s * (o.k ?? 1), o.spec);
};
// a pedicel arching over, with a unit hanging from it (lanterns, bells, pods, hearts)
U.hang = (C, p, a, s, o) => {
  const sg = Math.cos(a) >= 0 ? 1 : -1, pts = floorPts(arcPath(p, a, s * (o.ped ?? 0.6), sg * (o.droop ?? 1.6), 6, 1.5), 1);
  thin(C.ink, pts, Math.max(s * 0.08, MINW));
  drawUnit(C, last(pts), DOWN - sg * (o.swing ?? 0.25), s * (o.k ?? 1), o.spec);
};
// runcinate leaf with backward-pointing lobes (dandelion, poppy, thistle when spiny)
U.jag = (C, p, a, s, o) => {
  const L = s * (o.len ?? 1), W = s * (o.wid ?? 0.32), n = o.lobes ?? 4, F = frame(p, a, 1, 1), top = [], bot = [], N = n * 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N, env = Math.sin(PI * Math.min(t * 1.25, 1) ** 0.8) * (t > 0.8 ? 1 - (t - 0.8) * 3 : 1), saw = 1 - ((t * n + 0.15) % 1);
    const w = W * Math.max(env, 0.08) * (0.35 + 0.65 * saw ** 1.6), x = L * t - (o.spiny ? 0 : saw * L / n * 0.2);
    top.push(F(x, -w)); bot.push(F(x + (o.spiny ? 0 : L / n * 0.1), w * (o.flat ?? 1)));
  }
  C.ink.poly(top.concat(bot.reverse()));
  if (o.spiny) for (let i = 1; i < n; i++) for (const sd of [-1, 1]) { const t = (i - 0.15) / n; C.ink.poly(leaf(F(L * t, sd * W * 0.6), a + sd * 1.2 - 0.3, W * 0.9, W * 0.25, 0, 0.2)); }
};
// Venus flytrap leaf: winged petiole, then the trap
U.flytrap = (C, p, a, s, o) => {
  const L = s * (o.len ?? 1.5), bend = (o.bend ?? 0.25) * (Math.cos(a) >= 0 ? -1 : 1), pts = arcPath(p, a, L, bend, 8), e = last(pts), ea = endAng(pts);
  C.ink.poly(tube(pts, P([[0, 0.1 * s], [0.5, 0.18 * s], [0.88, 0.3 * s], [1, 0.1 * s]])));
  const gape = o.closed ? 0.1 : C.rng.range(o.gape0 ?? 0.4, o.gape1 ?? 0.75);
  heads.plantTrap(C, usock(e, ea + angDiff(UP, ea) * 0.35, s * (o.ts ?? 0.62)), { len: 2.3, wid: 0.6, gape, teeth: o.teeth ?? 4 });
};
// cape sundew leaf: a strap fringed with glue-tipped tentacles, tip curled over
U.drosera = (C, p, a, s, o) => {
  const sg = Math.cos(a) >= 0 ? 1 : -1, pts = arcPath(p, a, s * (o.len ?? 1), sg * (o.curl ?? 1.6), 16, 2.6), n = Math.max(3, Math.min(o.n ?? 9, Math.floor(s * (o.len ?? 1) * 0.67 / 2.3)));
  C.ink.poly(tube(pts, P([[0, 0.05 * s], [0.25, 0.04 * s], [1, 0.035 * s]].map(([t, v]) => [t, Math.max(v, hair)]))));
  for (let i = 0; i < n; i++) {
    const t = mix(0.3, 0.97, i / (n - 1)), q = pathAt(pts, t);
    for (const sd of [-1, 1]) { const e = polar(q.p, q.ang + sd * 1.25 - sg * 0.2, Math.max(s * 0.11, 1.8)); thin(C.ink, [q.p, e]); C.ink.dot(e, Math.max(s * 0.035, 0.6)); }
  }
};
// pea / bean pod with swelling seeds
U.pod = (C, p, a, s, o) => {
  const sg = Math.cos(a) >= 0 ? 1 : -1, pts = arcPath(p, a, s * (o.len ?? 1), sg * (o.curve ?? 0.4), 14), n = o.seeds ?? 5;
  C.ink.poly(tube(pts, P([[0, 0.05 * s], [0.12, 0.13 * s], [0.9, 0.12 * s], [1, 0.03 * s]])));
  for (let i = 0; i < n; i++) { const q = pathAt(pts, mix(0.2, 0.85, i / (n - 1))); C.ink.dot(polar(q.p, q.ang + sg * PI / 2, s * 0.03), s * 0.115); }
};
// succulent sword leaf with toothed margins and a terminal spine (agave, aloe)
U.sword = (C, p, a, s, o) => {
  const L = s * (o.len ?? 1), W = s * (o.wid ?? 0.22), sg = Math.cos(a) >= 0 ? 1 : -1, pts = arcPath(p, a, L, sg * (o.curve ?? 0.25), 12);
  C.ink.poly(tube(pts, P([[0, W * 0.8], [0.25, W], [0.7, W * 0.6], [1, hair]])));
  if (o.teeth) for (let i = 1; i < o.teeth; i++) { const t = i / o.teeth, q = pathAt(pts, t), w = W * (t < 0.25 ? 0.8 + t * 0.8 : 1 - (t - 0.25) * 0.55); for (const sd of [-1, 1]) C.ink.poly(leaf(polar(q.p, q.ang + sd * PI / 2, w * 0.85), q.ang + sd * 1.0, W * 0.5 + 0.4, W * 0.3 + 0.2, 0, 0.2)); }
  C.ink.poly(leaf(polar(last(pts), endAng(pts), -0.3), endAng(pts), W * 1.1 + 0.8, 0.9, 0, 0.2));
};
// plump succulent leaf, pointed (echeveria) or rounded (sedum, pearls)
U.fat = (C, p, a, s, o) => { const L = s * (o.len ?? 1), W = s * (o.wid ?? 0.4); C.ink.poly(tube(arcPath(p, a, L, (o.curve ?? 0.2) * (Math.cos(a) >= 0 ? -1 : 1), 10), P([[0, W * 0.45], [0.55, W], [0.85, W * 0.85], [1, o.point ? 0.1 : W * 0.6]]))); };
// needle tuft (pine, larch)
U.needles = (C, p, a, s, o) => { const n = o.n ?? 7; for (let i = 0; i < n; i++) { const f = i / (n - 1) - 0.5; C.ink.poly(tube(arcPath(p, a + f * (o.spread ?? 2.2), s * (1 - 0.3 * Math.abs(f)), f * 0.3, 4), P([[0, Math.max(s * 0.06, hair)], [1, hair * 0.9]]))); } };

// ---------------------------------------------------------------------
// 6. GENE HELPERS
// ---------------------------------------------------------------------
// Lendable genes from a species' signature features. o.head: a plant head spec (the head lent
// to animals); o.orn: unit for crown/tail-tip; o.row: unit for the dorsal row.
function lends(r, o) {
  const lift = r.range(0.12, 0.2);
  return {
    head: { type: 'plantLend', lend: { ...o.head, size: o.headSize ?? 0.75 } },
    limbs: { len: r.range(1.3, 1.9), w: r.range(0.3, 0.4), taper: 0.55, bend: 0.4, foot: 'plantRoot', toes: r.int(3, 4), toeLen: r.range(0.7, 1.0), lift, stance: 0.15, arm: 0.8 },
    tail: { len: r.range(4, 6.5), w0: 0.3, mid: 0.5, w1: 0.13, curl: r.range(1.5, 3), wave: r.range(0.2, 0.6), up: true, spiral: o.spiral ?? r.chance(0.4), tip: 'plantOrn', unit: o.tip ?? o.orn, tipS: o.tipS ?? 0.5 },
    dorsal: { type: 'plantRow', unit: o.row ?? o.orn, n: o.rowN ?? r.int(3, 5), size: o.rowS ?? 0.35 },
    crown: { type: 'plantSprig', unit: o.crown ?? o.orn, stem: o.stem ?? r.range(0.6, 1.1), size: o.crownS ?? 0.4, pair: !!o.ears, ears: !!o.ears, lean: o.ears ? -0.3 : 0 },
  };
}
function build(r, form, o) {
  const L = lends(r, o);
  form.type = 'plant'; form._own = { lift: L.limbs.lift, mute: [L.tail, L.dorsal, L.crown] };
  return { chassis: form, ...L, surface: { eyes: r.chance(0.85) ? 'dot' : 'none' } };
}
const leafU = (len = 1, wid = 0.45) => ({ u: 'leaf', len, wid });

// ---------------------------------------------------------------------
// 7. SPECIES
// ---------------------------------------------------------------------
const species = [
  // ---------------- carnivores ----------------
  { name: 'venus flytrap', w: 3, genes: r => {
    const fan = sd => ({ n: r.int(1, 3), tilt: sd * r.range(0.75, 1.0), spread: r.range(0.5, 0.8), s: r.range(4.8, 5.6), inner: 0.85, wx: 2, x: sd * 1.5, spec: { u: 'flytrap', len: r.range(1.4, 1.9), bend: 0.45 } });
    const form = { form: 'stems', R: 7, r: 4, keepHead: false, stems: [], basal: [fan(-1), fan(1)] };
    if (r.chance(0.5)) form.basal.push({ n: 1, spread: 0, tilt: r.range(-0.2, 0.2), s: r.range(3.6, 4.2), spec: { u: 'flytrap', len: 1.2, closed: r.chance(0.5) } });
    if (r.chance(0.45)) form.stems.push({ x: r.range(-1, 1), lean: r.range(-0.15, 0.15), arc: r.range(-0.2, 0.2), h: r.range(28, 38), w: 0.75, w1: 0.55, head: { type: 'plantBloom', petals: 5, spread: 2.3, pl: 1.3, pw: 0.8, disc: 0.35 }, hs: 2.2 });
    return build(r, form, { head: { type: 'plantTrap', len: 2.3, wid: 1, gape: r.range(0.35, 0.6), teeth: 6 }, orn: { u: 'flytrap', len: 1.2 }, tipS: 0.7, crownS: 0.55, rowS: 0.4 });
  } },
  { name: 'cape sundew', w: 2, genes: r => {
    const form = { form: 'stems', R: 6, r: 4, keepHead: false,
      basal: [{ n: r.int(3, 5), spread: r.range(1.3, 1.9), s: r.range(20, 26), inner: 0.75, wx: 3, spec: { u: 'drosera', len: 1, curl: r.range(1.4, 2.4), n: 9 } }],
      stems: r.chance(0.6) ? [{ x: r.range(-1, 1), lean: r.range(-0.2, 0.2), h: r.range(26, 36), w: 0.6, w1: 0.45, head: { u: 'buds', sign: r.sign() }, hs: 2.4 }] : [] };
    return build(r, form, { head: { type: 'plantLeaf', unit: { u: 'sundew' } , size: 1.8 }, orn: { u: 'sundew' }, row: { u: 'drosera', len: 1, curl: 1.8, n: 6 }, rowS: 1.6, tipS: 1, crownS: 1 });
  } },
  { name: 'trumpet pitchers', w: 2.2, genes: r => {
    const n = r.int(3, 6), stems = [];
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) - 0.5 : 0, k = 1 - 0.35 * Math.abs(u) * 2 * r.range(0.6, 1.2); stems.push({ x: u * n * r.range(3.5, 4.5), lean: u * 0.35 + r.range(-0.06, 0.06), h: 0.6, w: 0.8, head: { type: 'plantPitcher', kind: 'sarracenia', len: r.range(7, 9) * k, wid: r.range(0.72, 0.9), fs: r.sign() }, hs: r.range(3.6, 4.2) }); }
    stems.sort((a, b) => b.head.len - a.head.len);
    if (r.chance(0.5)) stems.push({ x: r.range(-4, 4), lean: r.range(-0.2, 0.2), h: r.range(22, 30), w: 0.7, w1: 0.55, nod: r.sign() * 2.4, head: { type: 'plantBell', kind: 'fritillary', wid: 0.9 }, hs: 2 });
    return build(r, { form: 'stems', R: 7, r: 4, stems }, { head: { type: 'plantPitcher', kind: 'sarracenia', len: 3.5 }, headSize: 0.8, orn: { type: 'plantPitcher', kind: 'sarracenia', len: 3 }, tipS: 0.5, crownS: 0.45, rowS: 0.3 });
  } },
  // ---------------- seed-heads ----------------
  { name: 'dandelion clock', w: 3, genes: r => {
    const n = r.int(1, 3), stems = [];
    for (let i = 0; i < n; i++) {
      const kind = i === 0 ? 'clock' : r.wpick([[3, 'clock'], [2, 'flower'], [1, 'bud']]);
      const head = kind === 'clock' ? { type: 'plantClock', R: r.range(2.2, 2.6), n: r.int(18, 26), gap: r.chance(0.5) ? r.range(0.5, 1.2) : 0, bead: 0.16 }
        : kind === 'flower' ? { type: 'plantBloom', petals: 11, spread: 3.2, pl: 1.0, pw: 0.35, disc: 0.5, calyx: true } : { u: 'bud', len: 0.8, wid: 0.45 };
      stems.push({ x: r.range(-3, 3), lean: r.range(-0.3, 0.3) * (i ? 1.5 : 1), arc: r.range(-0.3, 0.3), h: r.range(28, 40) * (i ? r.range(0.6, 0.9) : 1), w: 0.8, w1: 0.6, head, hs: kind === 'clock' ? r.range(4.6, 5.4) : 3.2 });
    }
    return build(r, { form: 'stems', R: 7, r: 4, stems, basal: [{ n: r.int(4, 6), spread: r.range(2.6, 3.0), s: r.range(11, 15), inner: 0.6, wx: 3, spec: { u: 'jag', lobes: r.int(3, 5), wid: 0.24 } }] },
      { head: { type: 'plantClock', R: 2.4, n: 20, bead: 0.17 }, headSize: 0.8, orn: { type: 'plantClock', R: 2.2, n: 16, bead: 0.18 }, row: { u: 'jag', lobes: 3, wid: 0.3 }, rowS: 1.2, tipS: 0.55, crownS: 0.45 });
  } },
  { name: 'poppy capsules', w: 2, genes: r => {
    const n = r.int(2, 4), stems = [];
    for (let i = 0; i < n; i++) stems.push({ x: (i - (n - 1) / 2) * r.range(3, 5), lean: r.range(-0.25, 0.25), arc: r.range(-0.4, 0.4), h: r.range(26, 42) * (i ? 0.85 : 1), w: 0.75, w1: 0.6, ...(i && r.chance(0.35) ? { nod: r.sign() * 2.6, head: { u: 'bud', len: 0.7, wid: 0.45 }, hs: 3.4 } : { head: { type: 'plantPod', kind: 'poppy', wid: r.range(0.85, 1.1), len: r.range(0.9, 1.15) }, hs: r.range(3.0, 3.6) }) });
    return build(r, { form: 'stems', R: 7, r: 4, stems, basal: [{ n: r.int(3, 5), spread: 2.6, s: r.range(8, 11), inner: 0.6, wx: 3, spec: { u: 'jag', lobes: 4, wid: 0.3 } }] },
      { head: { type: 'plantPod', kind: 'poppy' }, headSize: 0.9, orn: { type: 'plantPod', kind: 'poppy' }, tipS: 0.6, crownS: 0.5, row: { u: 'jag', lobes: 3, wid: 0.3 }, rowS: 1.1 });
  } },
  // ---------------- ferns and allies ----------------
  { name: 'horsetail', w: 2, genes: r => {
    const n = r.int(1, 3), stems = [];
    for (let i = 0; i < n; i++) {
      const fertile = i > 0 && r.chance(0.45), h = r.range(30, 44) * (i ? r.range(0.6, 0.85) : 1);
      stems.push({ x: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * r.range(9, 13), lean: r.range(-0.18, 0.18), arc: r.range(-0.2, 0.2), h, w: fertile ? 1.1 : 0.9, w1: fertile ? 0.9 : 0.4,
        joints: { n: fertile ? r.int(3, 4) : r.int(5, 7), len: fertile ? 0 : r.range(9, 13), k: 1, ang: r.range(0.7, 0.95), curl: r.range(0.5, 1.1), k1: 0.35 },
        ...(fertile ? { head: { type: 'plantCone', kind: 'horsetail', len: 2.3, wid: 1.1 }, hs: 2.4 } : {}) });
    }
    return build(r, { form: 'stems', R: 6, r: 4, stems }, { head: { type: 'plantCone', kind: 'horsetail', len: 2.3 }, headSize: 0.8, orn: { type: 'plantCone', kind: 'horsetail', len: 2 }, row: { u: 'needles', n: 5, spread: 1.6 }, rowS: 1.2, tipS: 0.6, crownS: 0.5 });
  } },
  { name: 'moss sporophytes', w: 1.8, genes: r => {
    const W = r.range(9, 14), H = r.range(4.5, 7), n = r.int(3, 6), stems = [];
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) - 0.5 : 0; stems.push({ x: u * W * 1.2 + r.range(-1, 1), lean: u * 0.5 + r.range(-0.12, 0.12), arc: r.range(-0.2, 0.2), h: (r.range(14, 22) + H) * (1 - 0.3 * Math.abs(u)), w: 0.42, w1: 0.38, nod: r.range(0.4, 1.3) * (u >= 0 ? 1 : -1), head: { type: 'plantCone', kind: 'moss', wid: 1.0 }, hs: r.range(2.1, 2.5) }); }
    stems.sort((a, b) => b.h - a.h);
    return build(r, { form: 'stems', R: W, r: 4, stems, sub: { kind: 'cushion', x: 0, w: W, h: H, ph: r.range(0, 6) } }, { head: { type: 'plantCone', kind: 'moss' }, headSize: 1.1, orn: { type: 'plantCone', kind: 'moss' }, crownS: 0.7, tipS: 0.8, stem: 1.8 });
  } },

  { name: 'nepenthes', w: 2.4, genes: r => {
    const sd = r.sign(), h = r.range(36, 48), nl = r.int(3, 5);
    const stems = [{ x: 0, lean: sd * r.range(0.05, 0.2), arc: -sd * r.range(0.2, 0.6), wav: r.range(0.08, 0.16), h, w: 1.1, w1: 0.7,
      leaves: { n: nl, t0: 0.2, t1: 0.85, ang: 1.05, s: r.range(3.6, 4.2), k1: 0.75, spec: { u: 'nepLeaf', ps: r.range(0.9, 1.1), drop: 2.2 } }, head: { u: 'leaves', n: 2, spread: 0.8, len: 2.4, wid: 0.32 }, hs: 3 }];
    return build(r, { form: 'stems', R: 5, r: 4, stems, keepHead: false }, { head: { type: 'plantPitcher', kind: 'nepenthes' }, headSize: 0.85, orn: { type: 'plantPitcher', kind: 'nepenthes' }, tipS: 0.55, crownS: 0.5, row: { u: 'nepLeaf', ps: 0.9, drop: 1.6 }, rowS: 0.55 });
  } },
  { name: 'cobra lily', w: 1.8, genes: r => {
    const n = r.int(2, 4), stems = [];
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) - 0.5 : 0, fs = r.sign(); stems.push({ x: u * n * r.range(4, 5.5), lean: u * 0.3 + r.range(-0.08, 0.08), h: 0.6, w: 0.8, head: { type: 'plantPitcher', kind: 'cobra', len: r.range(4.6, 5.6) * (1 - 0.3 * Math.abs(u)), hook: r.range(0.15, 0.45), wid: r.range(0.9, 1.1), fs }, hs: r.range(4.2, 5) }); }
    return build(r, { form: 'stems', R: 7, r: 4, stems }, { head: { type: 'plantPitcher', kind: 'cobra', len: 3.6 }, headSize: 0.8, orn: { type: 'plantPitcher', kind: 'cobra', len: 3.4 }, tipS: 0.55, crownS: 0.45, rowS: 0.3 });
  } },
  // ---------------- arums and orchids ----------------
  { name: 'jack-in-the-pulpit', w: 2.2, genes: r => {
    const sd = r.sign();
    const stems = [{ x: 0, lean: r.range(-0.1, 0.1), arc: r.range(-0.15, 0.15), h: r.range(14, 20), w: 1.2, w1: 1.0, head: { type: 'plantArum', kind: 'jack', wid: r.range(0.9, 1.1), fs: sd }, hs: r.range(4.4, 5) }];
    for (let i = 0; i < r.int(1, 2); i++) stems.push({ x: -sd * r.range(3, 5) * (i ? -0.6 : 1), lean: -sd * r.range(0.1, 0.25) * (i ? -1 : 1), h: r.range(30, 40) * (i ? 0.75 : 1), w: 1.0, w1: 0.8, nod: -sd * r.range(0.6, 1.2) * (i ? -1 : 1), head: { u: 'leaves', n: 3, spread: r.range(2.4, 3.0), len: 1, wid: 0.42, fat: 0.5 }, hs: r.range(9, 11) });
    return build(r, { form: 'stems', R: 5, r: 4, stems }, { head: { type: 'plantArum', kind: 'jack' }, headSize: 0.7, orn: { type: 'plantArum', kind: 'jack' }, tipS: 0.4, crownS: 0.38, row: { u: 'leaves', n: 3, spread: 2.4, wid: 0.42 }, rowS: 0.9 });
  } },
  { name: 'cuckoo-pint', w: 1.8, genes: r => {
    const sd = r.sign(), fruit = false;
    const stems = [{ x: 0, lean: r.range(-0.12, 0.12), h: fruit ? r.range(18, 24) : r.range(8, 13), w: 1.0, w1: 0.9, head: fruit ? { u: 'berries', n: 7 } : { type: 'plantArum', kind: r.chance(0.3) ? 'calla' : 'cuckoo', wid: r.range(0.9, 1.1), fs: sd }, hs: fruit ? 2.6 : r.range(4.2, 5) }];
    if (fruit) stems[0].leaves = { n: 6, t0: 0.6, t1: 0.98, ang: 0.9, s: 2.6, k1: 0.75, spec: { u: 'berries', n: 2 } };
    return build(r, { form: 'stems', R: 6, r: 4, stems, basal: [{ n: r.int(2, 3), spread: r.range(1.6, 2.2), s: r.range(9, 11), inner: 0.8, wx: 3, spec: { u: 'stalk', ped: 0.9, rise: 0.4, up: 0.2, k: 0.85, spec: { u: 'heart', arrow: true, len: 0.9, wid: 0.75 } } }] },
      { head: { type: 'plantArum', kind: 'cuckoo' }, headSize: 0.7, orn: { type: 'plantArum', kind: 'cuckoo' }, tipS: 0.4, crownS: 0.38, row: { u: 'heart', arrow: true, len: 0.9, wid: 0.75 }, rowS: 0.9 });
  } },
  { name: 'titan arum', w: 1.3, genes: r => {
    const stems = [{ x: 0, lean: r.range(-0.06, 0.06), h: r.range(3, 6), w: 2.4, w1: 2.2, head: { type: 'plantArum', kind: 'titan', len: r.range(5, 6.4), wid: r.range(0.9, 1.1) }, hs: r.range(6.2, 7.2) }];
    return build(r, { form: 'stems', R: 8, r: 6, stems }, { head: { type: 'plantArum', kind: 'titan', len: 5 }, headSize: 0.55, orn: { type: 'plantArum', kind: 'titan', len: 4.6 }, tipS: 0.35, crownS: 0.3, rowS: 0.25 });
  } },
  { name: 'lady\'s slipper', w: 2, genes: r => {
    const sd = r.sign(), n = r.int(1, 2), stems = [];
    for (let i = 0; i < n; i++) stems.push({ x: i ? -sd * r.range(5, 7) : 0, lean: (i ? -sd : sd) * r.range(0.05, 0.2), arc: sd * r.range(0.1, 0.4), h: r.range(22, 30) * (i ? 0.8 : 1), w: 0.8, w1: 0.6, leaves: { n: 1, t0: 0.6, t1: 0.6, ang: 0.6, s: 4, spec: { u: 'leaf', len: 1, wid: 0.3 } }, head: { type: 'plantSlipper', pouch: r.range(0.9, 1.15), fs: sd }, hs: r.range(3.2, 3.7) });
    return build(r, { form: 'stems', R: 6, r: 4, stems, basal: [{ n: 2, spread: r.range(1.5, 2.1), s: r.range(12, 15), inner: 1, wx: 2, spec: { u: 'leaf', len: 1, wid: 0.5, fat: 0.5 } }] },
      { head: { type: 'plantSlipper' }, headSize: 0.85, orn: { type: 'plantSlipper' }, tipS: 0.5, crownS: 0.45, row: leafU(1, 0.5), rowS: 0.9 });
  } },
  // ---------------- seed-heads and flowers ----------------
  { name: 'teasel', w: 1.8, genes: r => {
    const nb = r.int(0, 2), stems = [{ x: 0, lean: r.range(-0.08, 0.08), arc: r.range(-0.15, 0.15), h: r.range(36, 46), w: 1.1, w1: 0.8, prickles: 6,
      leaves: { n: 2, pair: true, t0: 0.3, t1: 0.55, ang: 0.75, s: r.range(9, 11), k1: 0.8, spec: { u: 'leaf', len: 1, wid: 0.22, bend: 0.1 } },
      branch: nb ? { n: nb, t0: 0.62, t1: 0.75, ang: 0.55, h: r.range(10, 15), w: 0.7, arc: -0.25, head: { type: 'plantBur', kind: 'teasel', wid: 0.95 }, hs: 2.2 } : null,
      head: { type: 'plantBur', kind: 'teasel', wid: r.range(0.95, 1.1) }, hs: r.range(3.8, 4.4) }];
    return build(r, { form: 'stems', R: 5, r: 4, stems }, { head: { type: 'plantBur', kind: 'teasel' }, headSize: 0.8, orn: { type: 'plantBur', kind: 'teasel' }, tipS: 0.5, crownS: 0.45, row: { u: 'thorn', len: 1 }, rowS: 0.5, rowN: 6 });
  } },
  { name: 'thistle', w: 2, genes: r => {
    const nb = r.int(1, 3), stems = [{ x: 0, lean: r.range(-0.1, 0.1), arc: r.range(-0.2, 0.2), h: r.range(30, 42), w: 1.2, w1: 0.8, prickles: 8,
      leaves: { n: r.int(2, 3), t0: 0.12, t1: 0.5, ang: 0.85, s: r.range(9, 11), k1: 0.65, spec: { u: 'jag', lobes: 3, wid: 0.28 } },
      branch: { n: nb, t0: 0.62, t1: 0.8, ang: 0.6, h: r.range(9, 14), w: 0.8, arc: -0.3, head: { type: 'plantBur', kind: 'thistle', wid: 0.95 }, hs: 2.9 },
      head: { type: 'plantBur', kind: 'thistle', wid: r.range(0.95, 1.1) }, hs: r.range(3.6, 4.1) }];
    return build(r, { form: 'stems', R: 5, r: 4, stems }, { head: { type: 'plantBur', kind: 'thistle' }, headSize: 0.8, orn: { type: 'plantBur', kind: 'thistle' }, tipS: 0.5, crownS: 0.45, row: { u: 'jag', lobes: 3, wid: 0.3, spiny: true }, rowS: 1.1 });
  } },
  { name: 'chinese lanterns', w: 1.8, genes: r => {
    const sd = r.sign(), nl = r.int(3, 4);
    const stems = [{ x: 0, lean: sd * r.range(0.05, 0.2), arc: sd * r.range(0.9, 1.4), h: r.range(36, 44), w: 1.0, w1: 0.55,
      leaves: { n: nl, t0: 0.4, t1: 0.95, ang: 1.3, sd: -sd, s: r.range(3.6, 4.2), k1: 0.8, spec: { u: 'hang', ped: 0.7, droop: 1.6, swing: 0.1, k: 1, spec: { type: 'plantPod', kind: 'physalis', wid: 1.1 } } },
      branch: { n: 2, t0: 0.2, t1: 0.5, ang: 0.9, sd, h: 0.2, w: 0.5, head: { u: 'leaf', len: 1, wid: 0.5 }, hs: 5.5 } }];
    return build(r, { form: 'stems', R: 5, r: 4, stems }, { head: { type: 'plantPod', kind: 'physalis' }, headSize: 1, orn: { type: 'plantPod', kind: 'physalis' }, tipS: 0.7, crownS: 0.6, row: { u: 'hang', spec: { type: 'plantPod', kind: 'physalis' } }, rowS: 0.6 });
  } },
  { name: 'honesty', w: 1.5, genes: r => {
    const nb = r.int(2, 3), disc = { u: 'disc' }, sdisc = { u: 'stalk', ped: 0.9, rise: 0.2, up: 0.15, k: 1, spec: disc };
    const stems = [{ x: 0, lean: r.range(-0.1, 0.1), arc: r.range(-0.2, 0.2), h: r.range(38, 46), w: 0.9, w1: 0.5,
      leaves: { n: 3, t0: 0.65, t1: 0.92, ang: 0.95, s: r.range(3.4, 3.8), k1: 0.85, spec: sdisc },
      branch: { n: nb, t0: 0.3, t1: 0.5, ang: 0.7, h: r.range(14, 18), w: 0.6, arc: -0.4, leaves: { n: 2, t0: 0.45, t1: 0.8, ang: 1.0, s: 3.2, k1: 0.9, spec: sdisc }, head: disc, hs: 3.4 },
      head: disc, hs: 3.6 }];
    return build(r, { form: 'stems', R: 5, r: 4, stems }, { head: { type: 'plantLeaf', unit: disc, size: 2 }, orn: disc, tipS: 1.2, crownS: 1, row: disc, rowS: 0.8 });
  } },
  { name: 'lotus', w: 1.6, genes: r => {
    const n = r.int(3, 5), stems = [];
    for (let i = 0; i < n; i++) {
      const kind = i === 0 ? 'pod' : r.wpick([[3, 'leaf'], [1.5, 'pod'], [1, 'bud']]), x = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * r.range(5, 8);
      const head = kind === 'leaf' ? { u: 'peltate', wid: 1.3 } : kind === 'pod' ? { type: 'plantPod', kind: 'lotus', wid: r.range(0.9, 1.1) } : { u: 'bud', len: 0.75, wid: 0.42 };
      stems.push({ x, lean: Math.sign(x) * r.range(0, 0.2), arc: r.range(-0.3, 0.3), nod: kind === 'leaf' ? r.sign() * r.range(0.6, 1.4) : (kind === 'pod' && i ? r.sign() * r.range(0.3, 1.2) : 0), h: r.range(22, 38) * (kind === 'leaf' ? 0.85 : 1), w: 0.8, w1: 0.7, head, hs: kind === 'leaf' ? r.range(7, 9) : kind === 'pod' ? r.range(3.2, 3.8) : 4.5 });
    }
    return build(r, { form: 'stems', R: 6, r: 4, stems }, { head: { type: 'plantPod', kind: 'lotus' }, headSize: 0.85, orn: { type: 'plantPod', kind: 'lotus' }, tipS: 0.55, crownS: 0.5, row: { u: 'peltate', wid: 1.3 }, rowS: 0.8, ears: r.chance(0.3) });
  } },
  { name: 'foxglove', w: 1.6, genes: r => {
    const sd = r.sign(), lupin = r.chance(0.35);
    const stems = [{ x: 0, lean: r.range(-0.1, 0.1), h: r.range(8, 14), w: 1.1, w1: 0.9, head: { type: 'plantSpire', kind: lupin ? 'lupin' : 'foxglove', len: r.range(5.5, 7), n: lupin ? r.int(9, 12) : r.int(6, 7), bow: r.range(0.1, 0.3), fs: sd, t0: lupin ? 0.1 : 0.25 }, hs: r.range(4.2, 5) }];
    const basal = lupin ? [{ n: r.int(3, 4), spread: 2.0, s: 8, inner: 0.8, wx: 3, spec: { u: 'hang', ped: 0.8, droop: 0.4, swing: 0, k: 0.8, spec: { u: 'leaves', n: 7, spread: 3.4, len: 0.8, wid: 0.22 } } }] : [{ n: r.int(4, 6), spread: 2.4, s: r.range(10, 13), inner: 0.75, wx: 3, spec: leafU(1, 0.38) }];
    return build(r, { form: 'stems', R: 6, r: 4, stems, basal }, { head: { type: 'plantSpire', kind: lupin ? 'lupin' : 'foxglove', len: 5 }, headSize: 0.7, orn: { type: 'plantBell', kind: 'foxglove' }, tipS: 0.6, crownS: 0.55, row: { type: 'plantBell', kind: 'foxglove' }, rowS: 0.45 });
  } },
  { name: 'fritillary', w: 1.3, genes: r => {
    const n = r.int(1, 3), stems = [];
    for (let i = 0; i < n; i++) { const sd = r.sign(); stems.push({ x: (i - (n - 1) / 2) * r.range(5, 8), lean: r.range(-0.15, 0.15), arc: sd * r.range(0, 0.3), nod: sd * r.range(2.2, 2.8), h: r.range(26, 36) * (i ? 0.85 : 1), w: 0.65, w1: 0.55, leaves: { n: 3, t0: 0.2, t1: 0.6, ang: 0.5, s: r.range(7, 9), k1: 0.7, spec: { u: 'strap', len: 1, wid: 0.1, grav: 0.6 } }, head: { type: 'plantBell', kind: 'fritillary', wid: r.range(0.9, 1.05) }, hs: r.range(3, 3.5) }); }
    return build(r, { form: 'stems', R: 5, r: 4, stems }, { head: { type: 'plantBell', kind: 'fritillary' }, headSize: 0.9, orn: { type: 'plantBell', kind: 'fritillary' }, tipS: 0.6, crownS: 0.55, row: { type: 'plantBell', kind: 'fritillary' }, rowS: 0.45 });
  } },
  { name: 'bleeding heart', w: 1.4, genes: r => {
    const sd = r.sign(), nh = r.int(3, 5);
    const stems = [{ x: 0, lean: sd * r.range(0.25, 0.45), arc: sd * r.range(1.2, 1.7), h: r.range(32, 40), w: 0.9, w1: 0.45,
      leaves: { n: nh, t0: 0.5, t1: 0.95, ang: 1.4, sd: -sd, s: 3.0, k1: 0.55, spec: { u: 'hang', ped: 0.7, droop: 1.2, swing: 0, k: 0.8, spec: { type: 'plantBell', kind: 'heart' } } },
      branch: { n: 2, t0: 0.1, t1: 0.3, ang: 0.7, sd: -sd, h: r.range(14, 18), w: 0.6, arc: 0.4, nod: 0.6, head: { u: 'leaves', n: 3, spread: 2.2, len: 1, wid: 0.36 }, hs: 6 } }];
    return build(r, { form: 'stems', R: 5, r: 4, stems }, { head: { type: 'plantBell', kind: 'heart' }, headSize: 1, orn: { type: 'plantBell', kind: 'heart' }, tipS: 0.6, crownS: 0.55, row: { u: 'hang', spec: { type: 'plantBell', kind: 'heart' } }, rowS: 0.55 });
  } },
  { name: 'hogweed', w: 1.5, genes: r => {
    const nb = r.int(1, 3);
    const stems = [{ x: 0, lean: r.range(-0.08, 0.08), arc: r.range(-0.15, 0.15), h: r.range(36, 46), w: 1.4, w1: 0.9,
      leaves: { n: 2, t0: 0.25, t1: 0.45, ang: 0.8, s: r.range(9, 11), k1: 0.8, spec: { u: 'jag', lobes: 4, wid: 0.35 } },
      branch: { n: nb, t0: 0.65, t1: 0.82, ang: 0.6, h: r.range(9, 13), w: 0.7, arc: -0.2, head: { type: 'plantUmbel', n: 6, R: 1.8, spread: 2.0 }, hs: 2.6 },
      head: { type: 'plantUmbel', n: r.int(7, 9), R: 2.1, spread: 2.2 }, hs: r.range(3.6, 4.2) }];
    return build(r, { form: 'stems', R: 5, r: 4, stems }, { head: { type: 'plantUmbel', n: 7, R: 2 }, headSize: 0.8, orn: { type: 'plantUmbel', n: 6, R: 1.8 }, tipS: 0.55, crownS: 0.5, row: { u: 'jag', lobes: 3, wid: 0.35 }, rowS: 1.1 });
  } },
  { name: 'cattail', w: 1.5, genes: r => {
    const n = r.int(1, 3), stems = [];
    for (let i = 0; i < n; i++) stems.push({ x: (i - (n - 1) / 2) * r.range(3, 5), lean: r.range(-0.12, 0.12), arc: r.range(-0.15, 0.15), h: r.range(26, 36) * (i ? 0.85 : 1), w: 0.8, w1: 0.6, head: { type: 'plantCone', kind: 'cattail', len: r.range(2.6, 3.4), wid: r.range(1.1, 1.3) }, hs: r.range(3, 3.4) });
    return build(r, { form: 'stems', R: 6, r: 4, stems, basal: [{ n: r.int(4, 6), spread: 1.1, s: r.range(30, 40), inner: 0.9, wx: 4, spec: { u: 'strap', len: 1, wid: 0.07, grav: 0.55 } }] },
      { head: { type: 'plantCone', kind: 'cattail' }, headSize: 0.9, orn: { type: 'plantCone', kind: 'cattail' }, tipS: 0.55, crownS: 0.5, row: { u: 'strap', len: 1, wid: 0.12 }, rowS: 2 });
  } },
  { name: 'fiddleheads', w: 2.6, genes: r => {
    const n = r.int(3, 5), stems = [];
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) - 0.5 : 0, fs = u >= 0 ? -1 : 1, open = r.chance(0.3);
      stems.push({ x: u * n * 2.6 + r.range(-0.8, 0.8), lean: u * 0.5, h: 0.5, w: 1.2, head: { type: 'plantFiddle', len: r.range(9, 13) * (1 - 0.3 * Math.abs(u)), turns: open ? r.range(0.6, 0.9) : r.range(1.3, 1.8), k: open ? 2.2 : 3.2, w: 0.42, nubs: r.chance(0.6), fs, lean: r.range(0.1, 0.4) }, hs: r.range(2.4, 2.9) }); }
    stems.sort((a, b) => b.head.len - a.head.len);
    const basal = r.chance(0.5) ? [{ n: r.int(1, 2), spread: 1.2, s: r.range(28, 34), inner: 1, wx: 3, spec: { u: 'frond', len: 1, pl: 0.2, pw: 0.075, n: 9, grav: 0.5 } }] : [];
    return build(r, { form: 'stems', R: 6, r: 4, stems, basal }, { head: { type: 'plantFiddle', len: 7, turns: 1.6, w: 0.35 }, headSize: 0.8, orn: { type: 'plantFiddle', len: 6, turns: 1.6, w: 0.3 }, tipS: 0.6, crownS: 0.55, row: { type: 'plantFiddle', len: 5, turns: 1.4, w: 0.3 }, rowS: 0.4, spiral: true });
  } },
  { name: 'shuttlecock fern', w: 1.8, genes: r => {
    const n = r.int(5, 7);
    return build(r, { form: 'stems', R: 6, r: 4, keepHead: false, base: { w: 3.2, h: 3 }, stems: r.chance(0.6) ? [{ x: 0, lean: r.range(-0.1, 0.1), h: 0.4, w: 1, head: { type: 'plantFiddle', len: 8, turns: 1.6, w: 0.4, nubs: true, fs: r.sign() }, hs: 2.2 }] : [],
      basal: [{ n, spread: r.range(1.3, 1.7), s: r.range(32, 40), inner: 0.8, wx: 3, y: 1.5, spec: { u: 'frond', len: 1, pl: 0.19, pw: 0.07, n: 10, grav: r.range(0.45, 0.8) } }] },
      { head: { type: 'plantFiddle', len: 7, turns: 1.6, w: 0.35 }, headSize: 0.8, orn: { u: 'frond', len: 1, pl: 0.3, pw: 0.12, n: 6, grav: 0.6 }, tipS: 2.2, crownS: 2, row: { u: 'frond', len: 1, pl: 0.3, pw: 0.12, n: 6, grav: 0.6 }, rowS: 1.6 });
  } },
  { name: 'liverwort umbrellas', w: 1.4, genes: r => {
    const n = r.int(2, 5), stems = [];
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) - 0.5 : 0, palm = r.chance(0.6); stems.push({ x: u * n * 4 + r.range(-1, 1), lean: u * 0.4 + r.range(-0.1, 0.1), arc: r.range(-0.2, 0.2), h: r.range(9, 15), w: 0.6, w1: 0.5, head: palm ? { type: 'plantUmbel', kind: 'palm', n: r.int(7, 9), R: 1.6 } : { u: 'peltate', wid: 1.1 }, hs: palm ? r.range(2.3, 2.7) : r.range(3, 3.6) }); }
    return build(r, { form: 'stems', R: 7, r: 4, stems, sub: { kind: 'thallus', x: 0, w: n * 5 + 6, n: n + 2 } }, { head: { type: 'plantUmbel', kind: 'palm', n: 8, R: 1.6 }, headSize: 0.9, orn: { type: 'plantUmbel', kind: 'palm', n: 8, R: 1.6 }, tipS: 0.6, crownS: 0.6, stem: 1.6, rowS: 0.5 });
  } },
];

export default {
  id: 'plant', label: 'Odd plants', short: 'Odd plants',
  sig: { head: 3, crown: 2.5, dorsal: 2, tail: 1.5, limbs: 1.2 },
  species,
};
