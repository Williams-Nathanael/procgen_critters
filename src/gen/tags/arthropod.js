// Crustaceans & arthropods: a species library of real (and a few extinct) forms.
//
// How this file is organised
//  - One chassis, `arthropodBody`, dispatches to a table of bespoke body FORMS (crab,
//    lobster, spider, shrimp, beetle ...). Each form draws in its own local frame
//    (x forward, y lateral / down) through a Pen, which lets top-view forms be turned to
//    face up the page (crabs, spiders, butterflies read best that way).
//  - Legs. The shared limb() cannot draw articulated arthropod legs, so a form draws its
//    own legs when the limbs gene is this tag's own (`limbs.arthro`), and otherwise exposes
//    ordinary limb sockets for the lending tag. The chassis gene carries a hidden
//    back-reference to the whole gene set (`root`) so it can tell which case applies.
//  - Heads, antennae/horns (crowns), wings (dorsals), and tails (a tail "tip" that draws
//    the whole segmented tail) are ordinary registered parts, so they look the same on our
//    own bodies and when lent to another tag.
import { add, sub, lerp, dist, angOf, polar, angDiff, clamp, mix, frame, spline, polyline, profile, pathAt, tube, ellipse, leaf } from '../core.js';
import { chassis, heads, feet, tips, crowns, dorsals } from '../parts.js';

const PI = Math.PI, TAU = 2 * PI;
const MA = 1.2;                       // thinnest appendage (antenna, leg tip) we allow
const none = () => ({ type: 'none' });
const ovalT = t => Math.sqrt(Math.max(1 - (2 * t - 1) ** 2, 0));

// ---------------------------------------------------------------------------
// Drawing kit. Everything takes `k`, anything with .poly(pts): an Ink or a Pen.
// ---------------------------------------------------------------------------
class Pen { // rigid transform (rotate about origin, then translate) in front of an Ink
  constructor(ink, rot = 0, org = [0, 0]) {
    this.ink = ink; this.rot = rot; this.org = org;
    const c = Math.cos(rot), s = Math.sin(rot);
    this.tf = (rot || org[0] || org[1]) ? (p => [p[0] * c - p[1] * s + org[0], p[0] * s + p[1] * c + org[1]]) : (p => p);
  }
  poly(pts, layer = 'k') { this.ink.poly(pts.map(this.tf), layer); return this; }
}
const dot = (k, c, r) => k.poly(ellipse(c, r, r, 0, 16));
const oval = (k, c, rx, ry, rot = 0) => k.poly(ellipse(c, rx, ry, rot, 26));
const tb = (k, ctrl, rad, per = 7) => k.poly(tube(spline(ctrl, per), rad));
const bar = (k, ctrl, rad) => k.poly(tube(polyline(ctrl, 3), rad));
const lf = (k, p, ang, len, wid, bend = 0, fat = 0.4) => k.poly(leaf(p, ang, len, wid, bend, fat));
const tap = (a, b, m) => profile([[0, a], [0.5, m ?? (a + b) / 2], [1, b]]);
// symmetric (about y = 0) closed shape from its +y half outline, front to back
function sym(k, half, per = 6) { const up = spline(half, per); k.poly(up.concat(up.slice().reverse().map(([x, y]) => [x, -y]))); }
function symP(k, half) { k.poly(half.concat(half.slice().reverse().map(([x, y]) => [x, -y]))); }
function closed(k, pts, per = 5) { k.poly(spline(pts.concat([pts[0]]), per)); }
// arc-shaped whip: starts at p heading a0 and turns by `turn` radians over its length
function arcPts(p, a0, len, turn, n = 8) { const out = [p]; let q = p; for (let i = 0; i < n; i++) { q = polar(q, a0 + turn * (i + 0.5) / n, len / n); out.push(q); } return out; }
function whip(k, p, a0, len, turn, w0, w1 = MA) { const pts = arcPts(p, a0, len, turn); k.poly(tube(spline(pts, 3), tap(w0 / 2, Math.max(w1, MA * 0.8) / 2))); return pts[pts.length - 1]; }

// Jointed leg through the given points: spindle segments with a knuckle at each joint.
// One outline per leg (Ink.finish is slow on many small overlapping polygons): the radius
// swells a little after each joint and pinches before the next, so the joints read.
function jleg(k, pts, w0, w1 = w0 * 0.5) {
  const n = pts.length - 1, P = [], R = [], per = w0 < 2.2 && n > 1 ? 2 : dist(pts[0], pts[n]) < 11 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const a = Math.max(mix(w0, w1, i / n), MA), b = Math.max(mix(w0, w1, (i + 1) / n), MA), last = i === n - 1;
    const f = profile([[0, a * (i ? 0.5 : 0.46)], [0.28, a * 0.56], [1, last ? Math.max(b * 0.34, MA * 0.4) : b * 0.42]]);
    for (let j = 0; j < per; j++) { const u = j / per; P.push(lerp(pts[i], pts[i + 1], u)); R.push(f(u)); }
    if (last) { P.push(pts[n]); R.push(f(1)); }
  }
  k.poly(tube(P, R));
}
// top-view leg: leaves `base` heading a0 and turns by `turn` at each joint
let JR = null; // the chassis' rng while a form draws: per-leg pose jitter, so no two individuals stand alike
function tleg(k, base, a0, turn, L, w, fr = [0.42, 0.33, 0.27]) {
  if (JR) { a0 += JR.range(-0.12, 0.12); turn *= JR.range(0.8, 1.2); L *= JR.range(0.93, 1.07); }
  const pts = [base]; let a = a0, p = base;
  for (let i = 0; i < fr.length; i++) { if (i) a += turn * (i === 1 ? 0.75 : 1); p = polar(p, a, L * fr[i]); pts.push(p); }
  jleg(k, pts, w); return pts;
}
function ik(a, b, l1, l2, sign) {
  const d = Math.min(dist(a, b), (l1 + l2) * 0.999), base = angOf(a, b);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
  return polar(polar(a, base, x), base + PI / 2, h * sign);
}
// side-view leg from hip to a foot on the ground at x = fx. sign -1: knee forward, +1: knee back
function sleg(k, hip, fx, L, w, sign = 1, o = {}) {
  const gy = o.gy ?? 0, foot = [fx, gy - Math.max(w * 0.32, 0.5)];
  const d = dist(hip, foot), LL = Math.max(L, d * 1.05), f = o.split ?? 0.5;
  const knee = ik(hip, foot, LL * f, LL * (1 - f), sign);
  const toe = [fx + (o.toe ?? 0.2) * L * (o.toeDir ?? 1), gy - Math.max(w * 0.26, 0.5)];
  jleg(k, o.toe === 0 ? [hip, knee, foot] : [hip, knee, foot, toe], w, w * (o.tp ?? 0.5));
  return knee;
}
// thick arm (cheliped / pedipalp): segs = [[absolute angle, length], ...]
function arm(k, base, segs, w) {
  let p = base, a = 0;
  for (const [ang, len] of segs) { const q = polar(p, ang, len); bar(k, [p, q], tap(w * 0.44, w * 0.5)); dot(k, q, w * 0.54); p = q; a = ang; }
  return { p, a };
}
// pincer: palm with a fixed finger and an opened movable finger. s = palm length
function chela(k, p, ang, s, o = {}) {
  const F = frame(p, ang, s, o.flip ?? 1), fat = o.fat ?? 0.42, fg = o.finger ?? 0.85, gap = Math.max(o.open ?? 0.3, 1.6 / s);
  k.poly(ellipse(F(0.5, 0), 0.62 * s, fat * s, ang, 24));
  k.poly(tube(spline([F(0.75, fat * 0.45), F(1.05 + fg * 0.45, fat * 0.64), F(1.05 + fg, fat * 0.1)], 6), profile([[0, fat * 0.5 * s], [0.5, fat * 0.36 * s], [1, 0.3]])));
  k.poly(tube(spline([F(0.8, -fat * 0.4), F(1.0 + fg * 0.45, -fat * 0.35 - gap), F(1.0 + fg * 0.95, -fat * 0.05 - gap * 0.45)], 6), profile([[0, fat * 0.4 * s], [0.5, fat * 0.27 * s], [1, 0.3]])));
}
function pathLen(path) { let L = 0; for (let i = 1; i < path.length; i++) L += dist(path[i - 1], path[i]); return L; }
// chain of overlapping ovals along a path: the scalloped outline of a segmented body
function beads(k, path, n, rad, ov = 0.64, t0 = 0, t1 = 1) {
  const seg = pathLen(path) * (t1 - t0) / n, out = [];
  for (let i = 0; i < n; i++) { const t = mix(t0, t1, (i + 0.5) / n), q = pathAt(path, t), w = rad(t); k.poly(ellipse(q.p, seg * ov, w, q.ang, n > 10 ? 16 : 22)); out.push({ p: q.p, ang: q.ang, w, t, seg }); }
  return out;
}
function strip(path, rad, t0, t1, n, sd) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = mix(t0, t1, i / (n - 1)), q = pathAt(path, t), na = q.ang + sd * PI / 2; out.push({ p: polar(q.p, na, rad(t) * 0.85), dir: na, t }); }
  return out;
}
const axis = (x0, x1, y = 0) => spline([[x0, y], [(x0 + x1) / 2, y], [x1, y]], 8);

// ---------------------------------------------------------------------------
// HEAD. Works on any socket. On our own bodies that already include the head mass
// (crab, lobster, spider ...) the socket is marked `arthroBare` and only the eyes, jaws
// and antenna mounts are added.
// ---------------------------------------------------------------------------
heads.arthropodHead = (C, sock, g) => {
  const k = C.ink, s = sock.s, sy = sock.sym, bare = !!(sock.arthroBare && g.bare !== false);
  const L = bare ? 0 : (g.len ?? 1), W = bare ? (sock.arthroW ?? 0.8) : (g.wid ?? 0.9);
  const c = bare ? sock.p : polar(sock.p, sock.dir, s * L * 0.5), F = frame(c, sock.face, s, 1);
  const fx = bare ? 0 : L * 0.5;
  if (!bare) {
    bar(k, [sock.p, c], W * s * (g.neck ?? 0.7));
    if (g.tri) { // mantis: wide at the eyes, narrowing to the mouth
      if (sy) closed(k, [F(-L * 0.45, 0), F(-L * 0.3, -W), F(L * 0.1, -W * 1.05), F(L * 0.75, -W * 0.22), F(L * 0.75, W * 0.22), F(L * 0.1, W * 1.05), F(-L * 0.3, W)]);
      else closed(k, [F(-L * 0.5, -W * 0.5), F(-L * 0.1, -W), F(L * 0.45, -W * 0.7), F(L * 0.55, W * 0.1), F(L * 0.2, W * 1.15), F(-L * 0.15, W * 0.6)]);
    } else oval(k, c, L * s * 0.72, W * s, sock.face);
  }
  const sides = sy ? [-1, 1] : [-1], eyes = [], mounts = [];
  for (const sd of sides) {
    const ex = bare ? -0.15 : L * (g.eyeX ?? 0.15);
    if (g.eye) dot(k, F(ex, sy ? sd * W * 0.82 : -W * 0.5), g.eye * s);
    if (g.stalk) {
      const b = F(fx - 0.15, sy ? sd * W * 0.7 : -W * 0.4), e = sy ? F(fx + g.stalk * 0.8, sd * (W * 0.7 + g.stalk * 0.4)) : F(fx + g.stalk * 0.4, -W * 0.4 - g.stalk * 0.9);
      bar(k, [b, e], Math.max(s * 0.14, 0.7)); dot(k, e, Math.max(s * (g.stalkR ?? 0.25), 1.2));
    }
    if (g.mand) tb(k, [F(fx - 0.15, sy ? sd * W * 0.5 : W * 0.25), F(fx + g.mand * 0.6, sy ? sd * W * 0.8 : W * 0.8), F(fx + g.mand, sy ? sd * W * 0.1 : W * 0.4)], profile([[0, s * 0.26], [0.6, s * 0.18], [1, 0.25]]));
    if (g.palp) lf(k, F(fx - 0.2, sy ? sd * W * 0.35 : W * 0.5), sock.face + (sy ? sd * 0.3 : 0.55), g.palp * s, s * 0.5, 0, 0.55);
    eyes.push({ p: F(ex, sy ? sd * W * 0.45 : -W * 0.3), r: s * 0.18 });
    mounts.push({ p: F(fx - 0.15, sy ? sd * W * (g.antGap ?? 0.5) : -W * 0.5), dir: sock.face + (sy ? sd * (g.splay ?? 0.55) : -(g.splaySide ?? 0.8)), flip: sd, s });
  }
  if (g.rostrum) { // shrimp / spider-crab beak
    if (sy) lf(k, F(fx - 0.3, 0), sock.face, g.rostrum * s, s * 0.55, 0, 0.2);
    else { const R = g.rostrum; k.poly([F(fx - 0.5, -W * 0.75), F(fx + R * 0.35, -W * 0.95), F(fx + R * 0.5, -W * 0.72), F(fx + R * 0.7, -W * 0.95), F(fx + R, -W * 0.85), F(fx + R * 0.6, -W * 0.45), F(fx - 0.3, -W * 0.1)]); }
  }
  if (g.snout) { // weevil rostrum, antennae elbowing off its middle
    const dr = sy ? 0 : (g.snoutDroop ?? 0.9), pts = arcPts(F(fx - 0.25, sy ? 0 : W * 0.2), sock.face + (sy ? 0 : 0.25), g.snout * s, dr, 6);
    k.poly(tube(spline(pts, 3), tap(s * 0.3, s * 0.2))); dot(k, pts[6], s * 0.24);
    const m = pts[3];
    mounts.length = 0;
    for (const sd of sides) mounts.push({ p: m, dir: sock.face + (sy ? sd * 1.0 : -0.5), flip: sd, s });
  }
  return { eyes, mounts, spots: [] };
};

// ---------------------------------------------------------------------------
// CROWNS: antennae, antlers, horns, eye stalks, cirri, treehopper helmets.
// In the mount frame F, +y sweeps outward (top view) or backward (side view).
// ---------------------------------------------------------------------------
crowns.arthropodAntenna = (C, m, F, s, g) => {
  const k = C.ink, L = g.len * s, w = Math.max((g.w ?? 0.17) * s, MA * 1.15), fl = m.flip, a0 = m.dir, turn = fl * (g.curve ?? 0.5);
  const base = F(-0.1, 0);
  switch (g.style) {
    case 'elbow': { // scape, then a bent funicle (ants, weevils)
      const e = polar(base, a0, L * 0.42), a1 = a0 + fl * (g.elbow ?? 1.2);
      bar(k, [base, e], tap(w * 0.5, w * 0.42)); dot(k, e, w * 0.5);
      const t = whip(k, e, a1, L * 0.58, turn * 0.5, w * 0.85, MA);
      if (g.club) oval(k, t, w * 1.1, w * 0.7, a1 + turn * 0.5);
      break;
    }
    case 'feather': { // plumose moth antenna
      const pts = arcPts(base, a0, L, turn, 8), wd = (g.plume ?? 0.3) * L;
      k.poly(tube(spline(pts, 3), tap(w * 0.5, MA * 0.4)));
      for (let i = 1; i < 8; i++) { const a = angOf(pts[i - 1], pts[i]), l = wd * Math.sin(PI * (i + 0.6) / 9.2); for (const sd of [-1, 1]) lf(k, pts[i], a + sd * 1.05, l, Math.max(L * 0.085, MA * 1.1), 0, 0.5); }
      break;
    }
    case 'bead': { // moniliform
      const n = g.n ?? 7, pts = arcPts(base, a0, L, turn, n);
      for (let i = 1; i <= n; i++) dot(k, pts[i], Math.max(w * mix(0.62, 0.48, i / n), MA * 0.6));
      k.poly(tube(pts, w * 0.3));
      break;
    }
    case 'sweep': { // shrimp: rises, bends back over the body in a long low sweep
      const pts = [base]; let q = base, a = a0; const N = 10;
      for (let i = 0; i < N; i++) { const u = (i + 0.5) / N; a += turn * 3.6 * Math.exp(-u * 4) / N; q = polar(q, a, L / N); pts.push(q); }
      k.poly(tube(spline(pts, 3), tap(w * 0.5, MA * 0.4)));
      break;
    }
    case 'lamella': { // scarab fan
      const e = polar(base, a0, L * 0.55); bar(k, [base, e], w * 0.42);
      for (let i = 0; i < 3; i++) lf(k, e, a0 + fl * (0.3 + i * 0.45), L * 0.55, L * 0.24, 0, 0.6);
      break;
    }
    default: {
      const t = whip(k, base, a0, L, turn, w, MA);
      if (g.club) oval(k, t, Math.max(w * 0.95, 1.5), Math.max(w * 0.6, 1.1), a0 + turn);
    }
  }
};
crowns.arthropodStag = (C, m, F, s, g) => { // stag-beetle antler mandible
  const k = C.ink, L = g.len, wd = (g.wid ?? 0.24) * s;
  tb(k, [F(-0.15, 0), F(L * 0.4, L * 0.24), F(L * 0.82, L * 0.16), F(L * 1.0, -L * 0.14)], profile([[0, wd], [0.6, wd * 0.8], [1, wd * 0.3]]));
  k.poly([F(L * 0.42, L * 0.2), F(L * 0.56, -L * 0.14), F(L * 0.68, L * 0.17)]);         // inner tooth
  if (g.fork) k.poly([F(L * 0.8, L * 0.2), F(L * 1.04, L * 0.2), F(L * 0.9, L * 0.05)]); // forked tip
};
crowns.arthropodSickle = (C, m, F, s, g) => { // antlion larva jaws: long, curved inward, toothed
  const k = C.ink, L = g.len, wd = (g.wid ?? 0.24) * s;
  tb(k, [F(-0.15, 0), F(L * 0.45, L * 0.1), F(L * 0.85, -L * 0.04), F(L, -L * 0.32)], profile([[0, wd], [0.6, wd * 0.75], [1, 0.35]]));
  for (const u of [0.35, 0.55, 0.72]) k.poly([F(L * u - 0.25, -L * 0.02 + 0.2), F(L * u + 0.05, -L * 0.16), F(L * u + 0.35, -L * 0.0)]);
};
crowns.arthropodPlate = (C, m, F, s, g) => { // slipper lobster: flat shovel antennae
  const k = C.ink, L = g.len;
  closed(k, [F(-0.2, -0.35), F(L * 0.35, -0.45), F(L * 0.45, -0.2), F(L * 0.4, 0.35), F(-0.2, 0.4)]);
  closed(k, [F(L * 0.3, -0.5), F(L * 0.75, -0.75), F(L * 1.0, -0.35), F(L * 1.05, 0.15), F(L * 0.95, 0.55), F(L * 0.7, 0.75), F(L * 0.35, 0.5)]);
  for (let i = 0; i < 4; i++) dot(k, F(L * 1.0, -0.45 + i * 0.32), Math.max(s * 0.14, 0.7));
};
crowns.arthropodHorn = (C, m, F, s, g) => { // rhinoceros-beetle horn
  const k = C.ink, L = g.len, wd = (g.wid ?? 0.3) * s, cv = g.curve ?? 0.5;
  const pts = [F(-0.2, 0), F(L * 0.45, cv * L * 0.08), F(L * 0.85, cv * L * 0.45), F(L, cv * L * 0.8)];
  tb(k, pts, profile([[0, wd], [0.7, wd * 0.6], [1, wd * 0.5]]));
  if (g.fork) { const a = angOf(pts[2], pts[3]); for (const sd of [-1, 1]) lf(k, pts[3], a + sd * 0.75, wd * 2.6, wd * 1.5, 0, 0.3); }
};
crowns.arthropodStalk = (C, m, F, s, g) => { const k = C.ink, e = F(g.len, g.len * 0.15); bar(k, [F(-0.1, 0), e], Math.max(s * 0.14, 0.7)); dot(k, e, Math.max(s * 0.27, 1.3)); };
crowns.arthropodCirri = (C, m, F, s, g) => { // barnacle feeding fan
  const k = C.ink, n = g.n ?? 5;
  for (let i = 0; i < n; i++) { const u = i / (n - 1) - 0.5; whip(k, F(0, u * 0.5), m.dir + u * (g.spread ?? 1.0), g.len * s * (1 - Math.abs(u) * 0.3), (g.curl ?? 1.5) * (g.hand ?? 1), Math.max(s * 0.22, 1.5), MA); }
};
crowns.arthropodBranch = (C, m, F, s, g) => { // water-flea swimming antenna: stalk, two branches, bristles
  const k = C.ink, L = g.len * s, w = Math.max(s * 0.3, 1.8), e = polar(m.p, m.dir, L * 0.45);
  bar(k, [F(-0.1, 0), e], tap(w * 0.5, w * 0.4));
  for (const sd of [-1, 1]) {
    const t = whip(k, e, m.dir + sd * 0.45, L * 0.55, sd * 0.35, w * 0.75, MA * 1.1);
    for (let j = 0; j < 3; j++) whip(k, lerp(e, t, 0.45 + j * 0.27), m.dir + sd * (0.5 + j * 0.3), L * 0.3, sd * 0.3, MA, MA * 0.8);
  }
};
crowns.arthropodHelmet = (C, m, F, s, g) => { // treehopper pronotum ornaments
  const k = C.ink, L = g.len;
  switch (g.kind) {
    case 'thorn': tb(k, [F(-0.3, -0.4), F(L * 0.5, 0.05), F(L, L * 0.5)], profile([[0, s * 0.7], [0.5, s * 0.4], [1, 0.3]])); break;
    case 'crescent': for (const sd of [-1, 1]) tb(k, [F(-0.2, 0), F(L * 0.5, sd * L * 0.35), F(L * 0.75, sd * L * 0.95)], profile([[0, s * 0.5], [1, 0.3]])); break;
    case 'sail': closed(k, [F(-0.3, -0.9), F(L * 0.6, -0.7), F(L, 0), F(L * 0.7, 0.9), F(-0.3, 1.2)]); break;
    default: { // Bocydium: a mast carrying little globes, and a long rear spine
      const top = F(L * 0.6, 0); bar(k, [F(-0.2, 0), top], Math.max(s * 0.16, MA * 0.6));
      for (const [a, l] of [[-1.3, 0.55], [-0.45, 0.5], [0.45, 0.5], [1.3, 0.55]]) { const e = polar(top, m.dir + a, L * l * s); bar(k, [top, e], Math.max(s * 0.1, MA * 0.5)); dot(k, e, Math.max(s * 0.3, 1.6)); }
      whip(k, top, m.dir + m.flip * 1.9, L * 1.5 * s, -m.flip * 0.5, Math.max(s * 0.3, 1.6), MA);
    }
  }
};

// ---------------------------------------------------------------------------
// FEET (used when our limbs are lent to another tag's body)
// ---------------------------------------------------------------------------
feet.arthropodChela = (C, p, ang, s, g, kk) => {
  const hp = C.plan && C.plan.head; let fl = 1;
  if (hp && C.plan.view === 'top') { const f = hp.face ?? hp.dir; fl = (Math.cos(f) * (p[1] - hp.p[1]) - Math.sin(f) * (p[0] - hp.p[0])) >= 0 ? 1 : -1; }
  chela(C.ink, polar(p, ang, -s * 0.1), ang, s * 0.85 * kk * (g.clawS ?? 1), { flip: fl, fat: g.clawFat ?? 0.45, finger: 0.8 });
};
feet.arthropodDactyl = (C, p, ang, s, g, kk) => { dot(C.ink, p, Math.max(g.w * s * 0.3, MA * 0.5)); lf(C.ink, p, ang, s * 0.55 * kk, Math.max(s * 0.2 * kk, MA * 1.3), 0.15, 0.3); };

// ---------------------------------------------------------------------------
// TAILS. Registered as a tail tip that draws the whole articulated tail from the
// socket, so the segmentation shows in the outline. `curl` sign picks the bending side.
// ---------------------------------------------------------------------------
tips.arthropodTail = (C, e, ea, s, g, curl) => {
  const k = C.ink, side = C.plan.view === 'side', sg = curl >= 0 ? 1 : -1;
  const gy = (p, cl) => (side ? [p[0], Math.min(p[1], -cl - 0.3)] : p);
  switch (g.kind) {
    case 'sting': { // scorpion metasoma: beads, bulb, curved sting
      const n = g.n ?? 5, sl = (g.seg ?? 1.45) * s, arc = (side ? (g.arcSide ?? 3.0) : (g.arc ?? 2.0)) * sg;
      let p = e, h = ea;
      for (let i = 0; i < n; i++) { h += arc / (n + 1); const rr = s * mix(0.62, 0.48, i / (n - 1)), q = gy(polar(p, h, sl), rr); oval(k, lerp(p, q, 0.5), sl * 0.6, rr, angOf(p, q)); p = q; }
      h += arc / (n + 1);
      const v = polar(p, h, s * 0.5); oval(k, v, s * 0.85, s * 0.6, h);
      tb(k, [polar(v, h, s * 0.5), polar(v, h + sg * 0.5, s * 1.35), polar(v, h + sg * 1.3, s * 1.8)], profile([[0, s * 0.32], [1, 0.25]]));
      break;
    }
    case 'fan': { // lobster / shrimp abdomen with pleura and a tail fan
      const n = g.n ?? 5, sl = (g.seg ?? 1.0) * s, arc = (side ? (g.arcSide ?? g.arc ?? 0.5) : (g.arc ?? 0.4)) * sg;
      let p = e, h = ea;
      for (let i = 0; i < n; i++) {
        h += arc / n; const rr = s * mix(1, g.end ?? 0.7, i / (n - 1)), q = gy(polar(p, h, sl), rr), c = lerp(p, q, 0.5), a = angOf(p, q);
        oval(k, c, sl * 0.63, rr, a);
        for (const sd of side ? [sg] : [-1, 1]) {
          const na = a + sd * PI / 2, P = (x, y) => polar(polar(c, a, x * sl), na, y * rr);
          k.poly([P(-0.35, 0.75), P(0.5, 1.3), P(0.3, 0.55)]);
          if (side && g.swim) lf(k, P(0, 0.8), na - sd * 0.5 * sg * -1, s * 1.15, s * 0.5, 0, 0.5);
        }
        p = q;
      }
      const fs = (g.fanS ?? 1) * s;
      if (side) for (const da of [-0.4, 0.05, 0.5]) lf(k, polar(p, h, -sl * 0.2), h + da * -sg, fs * 1.7, fs * 0.7, 0, 0.6);
      else { lf(k, polar(p, h, -sl * 0.3), h, fs * 1.7, fs * 1.05, 0, 0.6); for (const sd of [-1, 1]) for (const j of [0.5, 0.95]) lf(k, polar(p, h, -sl * 0.3), h + sd * j, fs * 1.75, fs * 1.0, 0, 0.62); }
      break;
    }
    case 'forceps': { // earwig
      const L = g.tlen * s, bow = g.bow ?? 0.3;
      for (const sd of [-1, 1]) {
        const P = (x, y) => gy(polar(polar(e, ea, x * L), ea + sd * PI / 2, y), 0.4);
        tb(k, [P(-0.05, s * 0.4), P(0.5, s * 0.4 + L * bow), P(0.85, L * bow * 0.7), P(1, L * 0.05)], profile([[0, s * 0.34], [0.6, s * 0.22], [1, 0.25]]));
      }
      break;
    }
    case 'cerci': { // tapering segments (optional) ending in 2-3 long filaments
      let p = e, h = ea; const ns = g.segs ?? 0, sl = (g.seg ?? 0.9) * s, arc = (g.arc ?? 0) * sg;
      for (let i = 0; i < ns; i++) { h += arc / ns; const rr = s * mix(0.9, g.end ?? 0.45, i / Math.max(ns - 1, 1)), q = gy(polar(p, h, sl), rr); oval(k, lerp(p, q, 0.5), sl * 0.64, rr, angOf(p, q)); p = q; }
      const n = g.n ?? 2, L = g.tlen * s, w = Math.max(s * (g.fw ?? 0.3), MA * 1.3);
      for (let j = 0; j < n; j++) {
        const u = n > 1 ? j / (n - 1) - 0.5 : 0, da = side ? sg * (0.12 + j * (g.splay ?? 0.3)) : u * 2 * (g.splay ?? 0.3);
        const pts = arcPts(p, h + da, L * (1 - Math.abs(u) * (g.midLong ? 0.5 : 0)), side ? sg * 0.35 : u * 0.5).map(q => gy(q, 0.5));
        k.poly(tube(spline(pts, 3), tap(w / 2, MA * 0.4)));
      }
      break;
    }
    case 'telson': { const L = g.tlen * s; bar(k, [polar(e, ea, -s * 0.4), gy(polar(e, ea + (side ? sg * 0.15 : 0), L), 0.4)], tap(s * (g.fw ?? 0.42), 0.25)); break; }
    case 'whip': { const pts = arcPts(e, ea, g.tlen * s, (side ? 0.9 : 0.6) * sg).map(q => gy(q, 0.6)); k.poly(tube(spline(pts, 3), tap(Math.max(s * 0.2, MA * 0.6), MA * 0.4))); break; }
    case 'horn': tb(k, [polar(e, ea, -s * 0.3), polar(e, ea + sg * 0.6, s * 1.0), polar(e, ea + sg * 1.2, s * (g.tlen ?? 2))], profile([[0, s * 0.42], [1, 0.25]])); break;
  }
};
// (`len` of the kind goes to `tlen`: the shared tail() uses `len` for its own stub)
const TAIL = (kind, { len, ...o } = {}) => ({ tailLen: 0.2, w0: 0.55, mid: 0.5, w1: 0.55, curl: 0.01, wave: 0, tip: 'arthropodTail', kind, tlen: len, ...o });

// ---------------------------------------------------------------------------
// DORSAL: insect wings. Frame at the wing base: x outward from the body, y toward the tail.
// ---------------------------------------------------------------------------
const WING = {
  drag: [[0, -0.05], [0.3, -0.12], [0.75, -0.14], [1, -0.07], [1.0, 0.04], [0.7, 0.1], [0.3, 0.08], [0, 0.05]],
  bfF: [[0, -0.1], [0.45, -0.68], [0.95, -1.0], [1.08, -0.8], [0.97, -0.3], [0.72, 0.03], [0.3, 0.12], [0, 0.1]],
  bfH: [[0, 0], [0.5, -0.02], [0.82, 0.25], [0.8, 0.65], [0.5, 0.9], [0.2, 0.75], [0.02, 0.3]],
  bfT: [[0, 0], [0.5, -0.02], [0.82, 0.25], [0.8, 0.62], [0.64, 0.84], [0.6, 1.4], [0.46, 0.9], [0.2, 0.75], [0.02, 0.3]],
  moF: [[0, -0.14], [0.5, -0.42], [1.1, -0.34], [1.16, -0.12], [0.8, 0.3], [0.35, 0.42], [0, 0.25]],
  moH: [[0, 0.1], [0.5, 0.22], [0.66, 0.6], [0.36, 0.84], [0.05, 0.5]],
  fly: [[0, -0.05], [0.4, -0.2], [0.85, -0.21], [1.03, -0.02], [0.85, 0.15], [0.4, 0.11], [0, 0.05]],
  may: [[0, -0.12], [0.6, -0.34], [1.05, -0.2], [1, 0.02], [0.5, 0.24], [0, 0.12]],
  fold: [[0, -0.07], [0.45, -0.12], [0.9, -0.1], [1.02, -0.02], [0.96, 0.07], [0.5, 0.1], [0, 0.08]],
};
dorsals.arthropodWings = (C, plan, st, sd, si, g, at) => {
  const k = C.ink, r = plan.r, n = st.length, kk = at(g.at ?? 0.7);
  const bk = angOf(st[n - 1].p, st[0].p);
  const sideV = plan.view === 'side' && plan.back.length === 1;
  const flip = Math.cos(angDiff(kk.dir + PI / 2, bk)) >= 0 ? 1 : -1;
  const sz = r * g.size, base = polar(kk.p, kk.dir, -r * (g.inset ?? 0.25));
  const W = (pts, tilt, scl = 1, off = 0) => { const F = frame(polar(base, bk, off * sz), kk.dir + flip * tilt, sz * scl, flip); closed(k, pts.map(([x, y]) => F(x, y))); };
  switch (g.kind) {
    case 'dragonfly': if (sideV) { W(WING.drag, 0.55); W(WING.drag, 0.95, 0.95); } else { W(WING.drag, -0.1); W(WING.drag, 0.3, 0.94, 0.1); } break;
    case 'butterfly': if (sideV) { W(WING.bfF, 0.45); W(g.tails ? WING.bfT : WING.bfH, 0.45, 0.9); } else { W(WING.bfF, 0.05 + (g.ft ?? 0), g.fs ?? 1); W(g.tails ? WING.bfT : WING.bfH, g.ht ?? 0, 0.92 * (g.hs ?? 1), 0.02); } break;
    case 'moth': if (sideV) { W(WING.moF, 0.75); } else { W(WING.moF, 0.3 + (g.ft ?? 0), g.fs ?? 1); W(WING.moH, 0.25 + (g.ht ?? 0), 0.95 * (g.hs ?? 1)); } break;
    case 'mayfly': if (sideV) { W(WING.may, 0.12); W(WING.may, 0.75, 0.42, 0.12); } else { W(WING.may, 0.1); W(WING.may, 0.75, 0.45, 0.1); } break;
    case 'fold': W(WING.fold, PI / 2 - (g.lift ?? 0.08)); break; // grasshopper tegmina, mantis wings, folded over the back
    case 'roof': W(WING.fly, sideV ? PI / 2 - 0.12 : 1.2); if (sideV) W(WING.fly, PI / 2 - 0.3, 0.85); break; // cicada / lacewing tent
    default: { W(WING.fly, sideV ? 0.95 : (g.sweep ?? 0.7)); if (g.hind) W(WING.fly, sideV ? 1.25 : 1.05, 0.72); else if (sideV) W(WING.fly, 0.72, 0.92); }
  }
};
const WINGS = (kind, size, o = {}) => ({ type: 'arthropodWings', kind, size, ...o });

// ---------------------------------------------------------------------------
// CHASSIS: dispatch to a body form
// ---------------------------------------------------------------------------
const FORMS = {};
chassis.arthropodBody = (C, g) => {
  const root = g.root, nat = !!(root && root.limbs && root.limbs.arthro);
  const rot = g.rot ?? 0, k = new Pen(C.ink, rot), socks = [];
  const K = {
    k, rng: C.rng, nat, pl: C.plump, C,
    // a leg: drawn by us when the limbs are our own, otherwise offered as a socket (role null: never a socket)
    limb(p, dir, s, role, side, draw, far) { if (nat) { if (draw) draw(); } else if (role) socks.push({ p, dir, s, role, side, far }); },
  };
  JR = C.rng; const pl = FORMS[g.form](K, g); JR = null;
  const sideV = pl.view === 'side', tp = k.tf;
  const path = pl.path.map(tp), rad = pl.rad;
  const back = (pl.back ?? (sideV ? [strip(pl.path, rad, pl.b0 ?? 0.15, pl.b1 ?? 0.85, 12, -1)] : [strip(pl.path, rad, pl.b0 ?? 0.2, pl.b1 ?? 0.8, 8, -1), strip(pl.path, rad, pl.b0 ?? 0.2, pl.b1 ?? 0.8, 8, 1)]))
    .map(st => st.map(q => ({ p: tp(q.p), dir: q.dir + rot, t: q.t })));
  // a butterfly whose dorsal slot went to another tag keeps its own wings
  if (g.wings && root && root.dorsal !== g.wings) back.forEach((st, si) => { const n = st.length; dorsals.arthropodWings(C, { view: pl.view, r: pl.r, back }, st, si ? 1 : -1, si, g.wings, u => st[clamp(Math.round(u * (n - 1)), 0, n - 1)]); });
  const h = pl.head, t = pl.tail;
  return {
    view: pl.view, r: pl.r, path, rad, back, ...(pl.rooted ? { rooted: true } : {}),
    head: { p: tp(h.p), dir: h.dir + rot, face: (h.face ?? h.dir) + rot, s: h.s, sym: !sideV, arthroBare: !!h.bare, arthroW: h.W },
    tail: { p: tp(t.p), dir: t.dir + rot, s: t.s },
    limbs: socks.map(s => ({ p: tp(s.p), dir: s.dir + rot, s: s.s, role: s.role, side: s.side ?? 1, far: s.far, fwd: sideV ? 0 : rot, ...(sideV && s.role !== 'arm' ? { ground: 0 } : {}) })),
  };
};

// ===== top-view forms (local x = forward, y = lateral) =======================

// Crabs: shore, fiddler, spider.
FORMS.crab = (K, g) => {
  const { k } = K, W = g.W * K.pl, D = g.D, sh = g.shape;
  if (sh === 'fiddler') symP(k, [[D * 0.7, 0], [D * 0.78, W * 0.5], [D * 0.9, W * 1.02], [D * 0.5, W * 0.96], [-D * 0.2, W * 0.84], [-D * 0.8, W * 0.58], [-D, W * 0.3], [-D, 0]]);
  else if (sh === 'spider') {
    sym(k, [[D * 0.95, W * 0.1], [D * 0.55, W * 0.42], [D * 0.05, W * 0.86], [-D * 0.45, W * 0.98], [-D * 0.9, W * 0.6], [-D * 1.05, 0]]);
    for (const sd of [-1, 1]) {
      lf(k, [D * 0.7, sd * W * 0.12], sd * 0.22, D * 0.75, W * 0.3, 0, 0.25);                                   // rostral horns
      for (const [x, y, a] of [[0.35, 0.6, 1.0], [-0.1, 0.9, 1.35], [-0.6, 0.85, 1.9]]) lf(k, [D * x, sd * W * y * 0.9], sd * a, W * 0.42, W * 0.26, 0, 0.25);
    }
  } else if (sh === 'king') {
    const half = [[D * 0.9, W * 0.12], [D * 0.6, W * 0.5], [D * 0.15, W * 0.92], [-D * 0.35, W], [-D * 0.85, W * 0.62], [-D, 0]];
    sym(k, half);
    for (const sd of [-1, 1]) {
      lf(k, [D * 0.75, sd * W * 0.1], sd * 0.12, D * 0.55, W * 0.24, 0, 0.25);
      for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7, p = pathAt(spline(half, 4), u); lf(k, [p.p[0], sd * p.p[1] * 0.92], sd * (PI / 2 + mix(-0.9, 1.0, u)), W * 0.26, W * 0.17, 0, 0.3); }
      for (const [x, y] of [[0.3, 0.35], [-0.2, 0.55], [-0.45, 0.2]]) lf(k, [D * x, sd * W * y], sd * (PI / 2 + 0.4), W * 0.2, W * 0.14, 0, 0.3);
    }
  } else if (sh === 'oblong') {
    sym(k, [[D * 0.85, 0], [D * 0.8, W * 0.5], [D * 0.45, W * 0.9], [-D * 0.2, W], [-D * 0.75, W * 0.85], [-D, W * 0.4], [-D, 0]]);
  } else symP(k, [[D * 0.8, 0], [D * 0.84, W * 0.14], [D * 0.74, W * 0.2], [D * 0.82, W * 0.3], [D * 0.58, W * 0.46], [D * 0.72, W * 0.62], [D * 0.38, W * 0.72], [D * 0.5, W * 0.88], [D * 0.14, W * 0.92], [D * 0.2, W * 1.06], [-D * 0.2, W * 0.98], [-D * 0.62, W * 0.76], [-D * 0.92, W * 0.46], [-D, W * 0.2], [-D, 0]]);
  if (g.abd) sym(k, [[-D * 0.7, 0], [-D * 0.85, W * g.abd * 0.85], [-D - W * g.abd * 0.9, W * g.abd], [-D - W * g.abd * 1.6, W * g.abd * 0.6], [-D - W * g.abd * 1.8, 0]]);
  for (const sd of [-1, 1]) {
    const big = g.giant ? (sd === g.giant ? 1.75 : 0.42) : 1, cs = g.claw * big;
    const sp = [D * 0.45, sd * W * 0.82];
    K.limb(sp, sd * 0.9, W * 0.42, 'fore', sd, () => {
      const a = arm(k, [D * 0.4, sd * W * 0.7], [[sd * (g.armA + (big > 1 ? 0.25 : 0)), g.arm * mix(1, big, 0.6)], [sd * 0.25, g.arm * 0.5 * mix(1, big, 0.5)]], g.armW * mix(1, big, 0.4));
      chela(k, a.p, -sd * g.clawIn * (big > 1 ? 1.5 : 1), cs, { flip: sd, fat: g.fat, finger: g.finger });
    });
    for (let i = 0; i < 4; i++) {
      const u = i / 3, base = [mix(D * 0.1, -D * 0.8, u), sd * W * mix(0.92, 0.5, u)], a0 = sd * (PI / 2 + mix(-0.28, 0.85, u));
      K.limb(base, a0, W * 0.4, i === 0 ? 'mid' : i === 3 ? 'hind' : null, sd, () => { const pts = tleg(k, base, a0, sd * g.legTurn, g.legL * (g.legK ?? [0.95, 1.1, 1.05, 0.82])[i], g.legW * (g.legWk ? g.legWk[i] : 1), g.legFr); if (g.legSpk) for (let j = 1; j < pts.length - 1; j++) { const a = angOf(pts[j - 1], pts[j]); lf(k, lerp(pts[j - 1], pts[j], 0.55), a - sd * 1.0, g.legW * 0.9, Math.max(g.legW * 0.45, MA * 1.2), 0, 0.3); } });
    }
  }
  return { view: 'top', r: D * 0.8, path: axis(-D, D * 0.8), rad: t => W * (0.55 + 0.45 * ovalT(t)), head: { p: [D * 0.78, 0], dir: 0, s: W * 0.36, bare: true, W: g.eyeGap }, tail: { p: [-D * 0.9, 0], dir: PI, s: W * 0.28 } };
};

// Lobster / crayfish: carapace + claws + walking legs; the abdomen and fan are the tail part.
FORMS.lobster = (K, g) => {
  const { k } = K, Lc = g.Lc, Wc = g.Wc * K.pl, x1 = Lc * 0.5, x0 = -Lc * 0.5;
  if (g.spiny) for (const sd of [-1, 1]) {
    lf(k, [x1 - 1, sd * Wc * 0.35], sd * 0.3, Wc * (g.antB ?? 0.9), Wc * (g.antB ? 0.6 : 0.42), -sd * 0.1, 0.4);
    if (!g.antB) for (let i = 0; i < 3; i++) lf(k, [x1 - Lc * (0.12 + i * 0.12), sd * Wc * 0.85], sd * (PI / 2 - 0.7), Wc * 0.3, Wc * 0.2, 0, 0.3);
  }
  sym(k, [[x1 + g.rost, 0.4], [x1 - 1, Wc * 0.55], [x1 - Lc * 0.3, Wc * 0.95], [0, Wc], [x0 + 2, Wc * 0.92], [x0, Wc * 0.72], [x0 - 0.5, 0]]);
  for (const sd of [-1, 1]) {
    const big = g.big === sd ? 1.2 : 1;
    K.limb([x1 - Lc * 0.2, sd * Wc * 0.8], sd * 0.6, Wc * 0.85, 'fore', sd, g.noClaw ? (() => tleg(k, [x1 - Lc * 0.2, sd * Wc * 0.8], sd * 0.9, -sd * 0.45, g.legL * 0.9, g.legW)) : () => {
      const a = arm(k, [x1 - Lc * 0.25, sd * Wc * 0.65], [[sd * g.armA, g.arm1], [sd * g.armB, g.arm2]], g.armW);
      chela(k, a.p, sd * g.clawA, g.claw * big, { flip: sd, fat: g.fat, finger: g.finger });
    });
    for (let i = 0; i < 4; i++) {
      const u = i / 3, base = [mix(x1 - Lc * 0.42, x0 + Lc * 0.14, u), sd * Wc * 0.85], a0 = sd * (PI / 2 + mix(-0.6, 0.75, u));
      K.limb(base, a0, Wc * 0.8, i === 1 ? 'mid' : i === 3 ? 'hind' : null, sd, () => tleg(k, base, a0, sd * (i < 2 ? -0.45 : 0.5), g.legL * [1, 1.08, 1.05, 0.95][i], g.legW));
    }
  }
  return { view: 'top', r: Wc, path: axis(x0, x1), rad: t => Wc * (0.75 + 0.25 * ovalT(t)), head: { p: [x1 - 0.5, 0], dir: 0, s: Wc * 0.62, bare: true, W: 0.55 }, tail: { p: [x0 + 1.5, 0], dir: PI, s: Wc * 0.9 } };
};

// Scorpion, pseudoscorpion, whip scorpion.
FORMS.scorpion = (K, g) => {
  const { k } = K, W = g.W * K.pl, n = g.n, sl = g.seg;
  symP(k, [[12, 0], [12.4, W * 0.5], [10, W * 0.7], [3, W * 0.95], [2, 0]]);
  const xe = 3 - n * sl;
  for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; oval(k, [3 - (i + 0.5) * sl, 0], sl * 0.72, W * g.env(u)); }
  for (const sd of [-1, 1]) {
    K.limb([10, sd * W * 0.6], sd * 0.8, W * 0.8, 'fore', sd, () => {
      const a = arm(k, [10.5, sd * W * 0.45], [[sd * g.armA, g.arm1], [sd * g.armB, g.arm2]], g.armW);
      chela(k, a.p, sd * g.clawA, g.claw, { flip: sd, fat: g.fat, finger: g.finger });
    });
    for (let i = 0; i < 4; i++) {
      const u = i / 3, base = [mix(9, 1.5, u), sd * W * 0.8], a0 = sd * (PI / 2 + mix(-0.6, 0.9, u));
      K.limb(base, a0, W * 0.8, i === 0 ? 'mid' : i === 3 ? 'hind' : null, sd, () => tleg(k, base, a0, sd * (i < 2 ? -0.5 : 0.55), g.legL * [0.8, 0.9, 1.02, 1.15][i] * (g.feeler && i === 0 ? 1.7 : 1), g.legW * (g.feeler && i === 0 ? 0.7 : 1)));
    }
  }
  return { view: 'top', r: W, path: axis(xe, 12), rad: t => W * (0.6 + 0.4 * ovalT(t)), head: { p: [12, 0], dir: 0, s: W * 0.7, bare: true, W: 0.55 }, tail: { p: [xe + sl * 0.3, 0], dir: PI, s: g.tailS } };
};

// Spiders, harvestmen, ticks: cephalothorax + abdomen + four leg pairs.
FORMS.spider = (K, g) => {
  const { k } = K, [ca, cb] = g.ceph, [aa, ab] = g.abd, cx = 0, axc = -(ca * 0.72 + aa * 0.85);
  if (g.box) sym(k, [[ca, 0], [ca * 0.98, cb * 0.6], [ca * 0.7, cb * 0.95], [-ca * 0.5, cb], [-ca, cb * 0.6], [-ca, 0]], 5); else oval(k, [cx, 0], ca, cb * K.pl);
  if (g.capit) { lf(k, [ca * 0.6, 0], 0, ca * 1.4, cb * 0.9, 0, 0.5); }
  if (aa > 0) { oval(k, [axc, 0], aa, ab * K.pl); if (g.abdPt) lf(k, [axc - aa * 0.6, 0], PI, aa * 0.9, ab * 1.1, 0, 0.3); }
  if (g.abdSeg && aa > 0) for (let i = 1; i < g.abdSeg; i++) { const x = axc + aa - 2 * aa * i / g.abdSeg; for (const sd of [-1, 1]) lf(k, [x, sd * ab * 0.75 * Math.sqrt(1 - ((x - axc) / aa) ** 2) * K.pl], sd * (PI / 2 + 0.5), ab * 0.32, ab * 0.3, 0, 0.4); }
  if (g.palps) for (const sd of [-1, 1]) { // amblypygid: spiny raptorial palps folded forward
    const P = g.palps, b = [ca * 0.75, sd * cb * 0.35], e1 = polar(b, sd * 0.95, P * 0.6), e2 = polar(e1, -sd * 0.25, P * 0.62);
    bar(k, [b, e1], tap(P * 0.12, P * 0.1)); dot(k, e1, P * 0.11); bar(k, [e1, e2], tap(P * 0.1, P * 0.08));
    for (const [p0, p1, n] of [[b, e1, 3], [e1, e2, 3]]) for (let j = 1; j <= n; j++) { const q = lerp(p0, p1, j / (n + 0.6)); lf(k, q, angOf(p0, p1) - sd * 1.25, P * 0.2, Math.max(P * 0.07, MA * 1.2), 0, 0.3); }
    tb(k, [e2, polar(e2, -sd * 1.2, P * 0.18), polar(e2, -sd * 2.0, P * 0.3)], tap(P * 0.07, 0.4));
  }
  if (g.chel) for (const sd of [-1, 1]) { // solifuge: huge forward jaws
    const C0 = g.chel, b = [ca * 0.7, sd * cb * 0.28];
    k.poly(leaf(b, sd * 0.06, C0, C0 * (g.chelW ?? 0.42), -sd * 0.08, 0.6));
    tb(k, [polar(b, 0, C0 * 0.6), polar(b, sd * 0.05, C0 * 1.05), polar(b, -sd * 0.25, C0 * 1.3)], tap(C0 * 0.16, 0.4));
    tb(k, [polar(b, sd * 0.3, C0 * 0.6), polar(b, sd * 0.2, C0 * 1.0), polar(b, -sd * 0.05, C0 * 1.22)], tap(C0 * 0.13, 0.4));
  }
  const back = aa > 0 ? axc - aa : -ca;
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a0 = sd * g.legA[i], base = polar([cx, 0], a0, Math.min(ca, cb) * 0.72);
    K.limb(base, a0, Math.max(cb * 0.9, g.legL[i] * 0.3), i === 0 ? 'fore' : i === 3 ? 'hind' : null, sd, () => { const pts = tleg(k, base, a0, sd * g.legT[i], g.legL[i], g.legW * (g.legWk ? g.legWk[i] : 1), g.legFr); if (g.club && i === 0) dot(k, pts[pts.length - 1], g.legW * 0.5); });
  }
  return { view: 'top', r: Math.max(cb, ab * 0.8), path: axis(back, ca), rad: t => Math.max(ab, cb) * (0.6 + 0.4 * ovalT(t)), head: { p: [ca * 0.9, 0], dir: 0, s: cb * 0.72, bare: true, W: 0.5 }, tail: { p: [back + 1, 0], dir: PI, s: Math.max(ab, cb) * 0.35 }, b0: 0.1, b1: 0.6 };
};

// Chains: centipedes, house centipedes, silverfish, earwigs. A wavy path of bead segments.
FORMS.chain = (K, g) => {
  const { k, rng } = K, L = g.len, n = g.n, ph = rng.range(0, TAU), kk = rng.range(0.9, 1.4), ctrl = [];
  for (let i = 0; i < 5; i++) ctrl.push([-L / 2 + L * i / 4, g.wave * Math.sin(ph + i * kk)]);
  const path = spline(ctrl, 10), rad = t => g.r * K.pl * g.env(t);
  const bs = beads(k, path, n, rad, g.ov ?? 0.66);
  bs.forEach((b, i) => {
    const lg = g.leg(i, n); if (!lg) return;
    for (const sd of [-1, 1]) {
      const base = polar(b.p, b.ang + sd * PI / 2, b.w * 0.7), a0 = b.ang + sd * (PI / 2 + lg.lean);
      K.limb(base, a0, Math.max(b.w * 1.2, 4), lg.role ?? null, sd, () => tleg(k, base, a0, sd * lg.turn, lg.L, lg.w, lg.fr));
    }
  });
  const e = pathAt(path, 1), b = pathAt(path, 0);
  return { view: 'top', r: Math.max(g.r, 4), path, rad, head: { p: polar(e.p, e.ang, -L / n * 0.3), dir: e.ang, s: rad(1) * g.headS }, tail: { p: polar(b.p, b.ang, L / n * 0.4), dir: b.ang + PI, s: rad(0.02) * (g.tailS ?? 0.9) } };
};

// Plated ovals: woodlice, giant isopods and trilobites. Head shield, pleural points, tail shield.
FORMS.plated = (K, g) => {
  const { k } = K, L = g.len, W = g.W * K.pl, n = g.n, hl = g.headL, tl = g.tailL, xh = L / 2 - hl, xt = -L / 2 + tl, seg = (xh - xt) / n;
  const env = x => g.env((x + L / 2) / L);
  for (let i = 0; i < n; i++) {
    const x = xt + (i + 0.5) * seg, w = W * env(x);
    oval(k, [x, 0], seg * 0.68, w);
    for (const sd of [-1, 1]) {
      k.poly([[x + seg * 0.4, sd * w * 0.75], [x - seg * (0.35 + g.sweep), sd * (w + g.pt)], [x - seg * 0.35, sd * w * 0.55]]);
      if (g.legL) { const base = [x, sd * w * 0.8]; K.limb(base, sd * (PI / 2 + 0.3), W * 0.5, i === n - 1 ? 'fore' : i === 0 ? 'hind' : i === (n >> 1) ? 'mid' : null, sd, () => g.stub ? lf(k, base, sd * (PI / 2 + 0.12), w * 0.2 + g.pt + g.legL * 1.4, g.legW * 0.75, 0, 0.3) : jleg(k, [base, [x - 0.6, sd * (w + g.pt + g.legL * 0.55)], [x - 2.2, sd * (w + g.pt + g.legL)]], g.legW)); }
      else if (i === n - 1 || i === 0 || i === (n >> 1)) K.limb([x, sd * w * 0.8], sd * (PI / 2 + (i === 0 ? 0.5 : i === n - 1 ? -0.5 : 0)), W * 0.5, i === n - 1 ? 'fore' : i === 0 ? 'hind' : 'mid', sd, null);
    }
  }
  const Wc = W * g.headW, Wp = W * env(xt) * (g.tailW ?? 1);
  sym(k, [[L / 2, 0], [L / 2 - hl * 0.12, Wc * 0.5], [xh + hl * 0.4, Wc * 0.92], [xh, Wc], [xh - seg * 0.5, Wc * 0.8], [xh - seg * 0.6, 0]]);
  if (g.genal) for (const sd of [-1, 1]) tb(k, [[xh + hl * 0.35, sd * Wc * 0.78], [xh - g.genal * 0.5, sd * Wc * 1.04], [xh - g.genal, sd * Wc * (g.genalIn ?? 0.98)]], profile([[0, hl * 0.3], [0.5, hl * 0.2], [1, 0.3]]));
  if (g.tailPts) symP(k, [[xt + seg * 0.5, 0], [xt + seg * 0.5, Wp], [xt - tl * 0.25, Wp * 1.02], [xt - tl * 0.55, Wp * 0.62], [xt - tl * 0.4, Wp * 0.45], [xt - tl * 0.95, Wp * 0.3], [xt - tl * 0.7, Wp * 0.12], [xt - tl * 1.1, 0]]);
  else sym(k, [[xt + seg * 0.6, 0], [xt + seg * 0.5, Wp], [xt - tl * 0.35, Wp * 0.88], [xt - tl * 0.8, Wp * 0.5], [-L / 2, 0]]);
  return { view: 'top', r: W * 0.8, path: axis(-L / 2, L / 2), rad: t => W * g.env(t), head: { p: [L / 2 - hl * 0.15, 0], dir: 0, s: Wc * 0.55, bare: true, W: 0.6 }, tail: { p: [-L / 2 + 1, 0], dir: PI, s: Math.max(Wp * 0.4, 2.2) } };
};

// Trilobite: half-moon cephalon with genal spines, a thorax whose pleural tips saw-tooth
// the outline (one polygon), and a pygidium.
FORMS.trilobite = (K, g) => {
  const { k } = K, L = g.len, W = g.W * K.pl, hl = g.headL, pl = g.tailL, n = g.n;
  const xh = L / 2 - hl, xt = -L / 2 + pl, seg = (xh - xt) / n, Wc = W * g.headW;
  const top = [];
  for (let i = 0; i <= 12; i++) { const a = -PI / 2 + i / 12 * PI / 2; top.push([xh + hl * Math.cos(a) * (g.headR ?? 1), Wc * Math.sin(a)]); } // cephalon, right side to the snout
  const ceph = top.slice().reverse(); // snout .. side corner (y < 0 side)
  const side = [];
  for (let i = 0; i < n; i++) {
    const x0 = xh - i * seg, x1 = x0 - seg, w = W * g.env(i / (n - 1));
    side.push([x0 - seg * 0.05, -w * 0.9], [x1 - seg * g.sweep, -(w + g.pt)], [x1 + seg * 0.25, -w * 0.88]);
  }
  const Wp = W * g.env(1) * (g.tailW ?? 0.9);
  const pq = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * PI / 2; pq.push([xt - pl * Math.sin(a), -Wp * Math.cos(a)]); }
  symP(k, [...ceph, ...side, ...pq]);
  if (g.genal) for (const sd of [-1, 1]) tb(k, [[xh + hl * 0.2, sd * Wc * 0.9], [xh - g.genal * 0.4, sd * Wc * (1.0 + (g.genalOut ?? 0.06))], [xh - g.genal, sd * Wc * (g.genalIn ?? 0.98)]], profile([[0, hl * 0.2], [0.4, hl * 0.12], [1, 0.4]]));
  if (g.pygSp) for (const sd of [-1, 1]) lf(k, [xt - pl * 0.5, sd * Wp * 0.75], PI - sd * 0.35, g.pygSp, Math.max(pl * 0.3, MA * 1.4), 0, 0.3);
  if (g.trident) { const T = g.trident, b = [L / 2 - hl * 0.3, 0], e = [L / 2 + T, 0];
    bar(k, [b, e], tap(Math.max(hl * 0.12, 1.4), Math.max(hl * 0.09, 1.1)));
    lf(k, polar(e, PI, 0.5), 0, T * 0.32, Math.max(hl * 0.16, 1.6), 0, 0.3);
    for (const sd of [-1, 1]) tb(k, [polar(e, PI, T * 0.05), polar(e, sd * 1.2, T * 0.18), polar(polar(e, sd * 1.2, T * 0.2), sd * 0.15, T * 0.3)], tap(Math.max(hl * 0.08, 0.9), 0.5)); }
  if (g.eyes) for (const sd of [-1, 1]) dot(k, [xh + hl * 0.35, sd * Wc * 0.42], Math.max(hl * 0.12, 1.2));
  for (const [i, role] of [[0, 'fore'], [n >> 1, 'mid'], [n - 1, 'hind']]) for (const sd of [-1, 1]) { const x = xh - (i + 0.5) * seg; K.limb([x, sd * W * 0.8], sd * (PI / 2 + (i === 0 ? -0.4 : i === n - 1 ? 0.5 : 0)), W * 0.5, role, sd, null); }
  return { view: 'top', r: W * 0.8, path: axis(-L / 2, L / 2), rad: t => W * 0.9, head: { p: [L / 2 - hl * 0.2, 0], dir: 0, s: Wc * 0.45, bare: true, W: 0.6 }, tail: { p: [-L / 2 + 1, 0], dir: PI, s: Math.max(Wp * 0.35, 2.2) } };
};

// Beetles (and other compact insects) from above: abdomen under wing cases, pronotum, three leg pairs.
FORMS.beetleTop = (K, g) => {
  const { k } = K, E = g.E, We = g.We * K.pl, P = g.P, Wp = g.Wp * K.pl;
  sym(k, [[3, 0], [2.6, We * 0.86], [-E * 0.3, We], [-E * 0.72, We * 0.8], [-E * 0.95, We * (g.endW ?? 0.35)], [-E, 0]]);
  sym(k, [[3 + P, 0], [3 + P - 0.4, Wp * 0.7], [3 + P * 0.45, Wp], [2.4, Wp * (g.prBase ?? 0.9)], [1.6, 0]]);
  const bases = [[3 + P * 0.5, Wp * 0.8], [0.5, We * 0.85], [-E * 0.3, We * 0.9]];
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
    const base = [bases[i][0], sd * bases[i][1]], a0 = sd * g.legA[i];
    K.limb(base, a0, Math.max(We * 0.8, 4), ['fore', 'mid', 'hind'][i], sd, () => {
      if (g.raptor && i === 0) { const a = arm(k, base, [[sd * 0.9, g.legL[0] * 0.55]], g.legW * 1.5); tb(k, [a.p, polar(a.p, sd * -0.2, g.legL[0] * 0.4), polar(a.p, sd * -0.7, g.legL[0] * 0.7)], tap(g.legW * 0.6, 0.3)); }
      else tleg(k, base, a0, sd * g.legT[i], g.legL[i], g.legW, g.legFr);
    });
  }
  return { view: 'top', r: Math.max(We * 0.85, 4), path: axis(-E, 3 + P), rad: t => We * (0.6 + 0.4 * ovalT(t)), head: { p: [3 + P - 0.6, 0], dir: 0, s: g.hs }, tail: { p: [-E + 1, 0], dir: PI, s: Math.max(We * 0.35, 2.2) } };
};

// Flyers from above: slim body; the wings are the dorsal part and attach along the thorax.
FORMS.flyer = (K, g) => {
  const { k } = K, tx = g.tx, ty = g.ty * K.pl, ab = g.ab;
  oval(k, [0, 0], tx, ty);
  if (g.beadN) beads(k, axis(-tx * 0.6 - ab, -tx * 0.6), g.beadN, t => mix(g.aend, g.ar, t), 0.7);
  else tb(k, [[-tx * 0.5, 0], [-tx * 0.6 - ab * 0.5, 0], [-tx * 0.6 - ab, 0]], profile([[0, g.ar], [0.5, g.ar * g.amid], [1, g.aend]]));
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
    const base = [tx * (0.5 - i * 0.5), sd * ty * 0.7], a0 = sd * (g.legA ? g.legA[i] : [0.7, 1.6, 2.4][i]);
    K.limb(base, a0, g.R * 0.7, g.legL ? ['fore', 'mid', 'hind'][i] : (i === 1 ? null : ['fore', 0, 'hind'][i]), sd, g.legL ? (() => tleg(k, base, a0, sd * (i === 0 ? -0.4 : 0.4), g.legL[i], g.legW, g.legFr)) : null);
  }
  const back = [-1, 1].map(sd => [0, 1, 2, 3, 4].map(i => ({ p: [mix(-tx * 0.7, tx * 0.7, i / 4), sd * ty * 0.5], dir: sd * PI / 2, t: i / 4 })));
  return { view: 'top', r: g.R, path: axis(-tx * 0.6 - ab, tx), rad: t => Math.max(ty * t, g.aend), back, head: { p: [tx * 0.8, 0], dir: 0, s: g.hs }, tail: { p: [-tx * 0.6 - ab + 0.5, 0], dir: PI, s: Math.max(g.aend * 1.2, 2) } };
};

// ===== side-view forms (local x = forward, y = down, ground at y = 0) =========

// Shrimp, prawn, krill, mantis shrimp, amphipod: carapace + a chain of abdominal segments
// whose ventral pleura scallop the outline, ending in a tail fan. The abdomen arches and
// curls down by `T`; the whole body is lifted so the legs stand on the ground.
FORMS.shrimp = (K, g) => {
  const { k, rng } = K, rc = g.rc * K.pl, n = g.n, Lc = g.Lc;
  // centreline from the head end backward: carapace, then abdominal segments
  const P = [[0, 0]], R = [rc * 0.72];
  const hc = PI + (g.tilt ?? 0);
  for (let i = 1; i <= 6; i++) { P.push(polar(P[0], hc, Lc * i / 6)); R.push(rc * [0.72, 0.9, 0.98, 1, 1, 0.98, 0.96][i]); }
  let carLow = -Infinity;
  for (let i = 0; i < P.length; i++) carLow = Math.max(carLow, P[i][1] + R[i]);
  // abdomen; if its curl would hang far below the legs, straighten it a little
  let segs, h, p, low, TT = g.T;
  for (let tries = 0; tries < 5; tries++) {
    segs = []; h = hc + (g.hump ?? 0.35); p = P[6];
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(n - 1, 1), sl = g.sl * mix(1, g.slEnd ?? 0.85, u);
      h -= TT * (g.bend ? g.bend(u) : 1 / n);
      const q = polar(p, h, sl), r = rc * mix(g.a0 ?? 0.95, g.re, Math.pow(u, 1.3));
      segs.push({ p, q, h, r, sl }); p = q;
    }
    low = carLow;
    for (const s of segs) low = Math.max(low, s.q[1] + s.r * (g.plDeep ?? 1.25), s.p[1] + s.r * (g.plDeep ?? 1.25));
    low = Math.max(low, polar(p, h, g.fan * 1.9)[1] + 1);
    if (low < carLow + g.legH * (g.hang ?? 0.75)) break;
    TT *= 0.8;
  }
  const dy = Math.min(-g.legH - carLow, -low - 0.3), T = q => [q[0], q[1] + dy];
  const Pc = P.map(T);
  // carapace
  k.poly(tube(spline(Pc, 4), profile([[0, R[0]], [0.2, R[1]], [0.45, R[3]], [1, R[6]]])));
  if (g.carSpine) k.poly([polar(Pc[1], -PI / 2, R[1] * 0.8), polar(Pc[2], -PI / 2, R[2] * 1.35), polar(Pc[3], -PI / 2, R[3] * 0.85)]);
  // abdomen: segment ovals and their ventral pleura
  segs.forEach((s, i) => {
    const a = T(s.p), b = T(s.q), c = lerp(a, b, 0.5), vn = s.h - PI / 2;
    oval(k, polar(c, s.h, -s.sl * 0.1), s.sl * (g.segOv ?? 0.74), s.r, s.h);
    if (g.plDeep) oval(k, polar(polar(c, vn, s.r * (g.plDeep - 0.55)), s.h, s.sl * 0.1), s.sl * 0.45, s.r * 0.62, s.h + 0.25);
    if (g.swim && i < n - 1 && i < 5) { const sp = polar(c, vn, s.r * (g.plDeep ?? 1) * 0.8); lf(k, sp, vn + 0.7 * (g.swimLean ?? 1), s.r * g.swim, Math.max(s.r * 0.5, MA * 1.3), 0, 0.55); }
  });
  // tail fan: telson and uropods, opened a little
  const e = T(p), fs = g.fan, spread = g.fanSpread ?? 0.45;
  for (const [da, l, w] of [[spread, 1.55, 0.62], [-spread * 0.6, 1.6, 0.6], [0, 1.9, 0.42]]) lf(k, polar(e, h, -fs * 0.25), h + da, fs * l, fs * w, 0, 0.55);
  if (g.fanSpines) for (const da of [-0.5, 0.5]) lf(k, polar(e, h + da, fs * 0.9), h + da * 1.4, fs * 0.6, Math.max(fs * 0.18, MA), 0, 0.3);
  // rostrum: a toothed blade
  const front = Pc[0];
  if (g.rost) {
    const ra = -(g.rostUp ?? 0.15), F = frame(polar(front, -PI / 2, R[0] * 0.35), ra, 1, 1), L = g.rost, nt = g.teeth ?? 4, top = [];
    for (let i = 0; i <= nt; i++) { const x = -R[0] * 0.6 + (L * 0.8 + R[0] * 0.6) * i / nt; top.push(F(x, -R[0] * 0.35 * (1 - x / L))); if (i < nt) top.push(F(x + L * 0.08, -R[0] * 0.35 * (1 - x / L) - Math.max(R[0] * 0.28, 1.1))); }
    k.poly([F(-R[0] * 0.9, R[0] * 0.5), ...top, F(L, 0), F(L * 0.5, R[0] * 0.25), F(0, R[0] * 0.5)]);
  }
  if (g.eyeStalk) { const eb = polar(front, -PI / 2, R[0] * 0.5), ee = polar(eb, -1.1, g.eyeStalk); bar(k, [eb, ee], Math.max(rc * 0.18, MA)); oval(k, ee, rc * 0.42, rc * 0.3, -1.1); }
  if (g.scale) lf(k, polar(front, PI / 2, R[0] * 0.2), 0.12, g.scale, Math.max(rc * 0.4, 1.6), -0.05, 0.4); // antennal scale
  // legs from the carapace underside (thin walking legs), optional raptorial claw
  const nl = g.legs ?? 5;
  for (let i = 0; i < nl; i++) {
    const u = nl > 1 ? i / (nl - 1) : 0.5, t = mix(g.leg0 ?? 0.25, g.leg1 ?? 0.95, u), q = pathAt(Pc, t), hip = polar(q.p, PI / 2, R[Math.round(t * 6)] * 0.7);
    const fx = hip[0] + mix(g.legFw ?? 0.5, -(g.legBk ?? 0.4), u) * g.legL, far = i % 2 === 1;
    K.limb(hip, PI / 2, rc * 0.9, i === 0 ? 'fore' : i === nl - 1 ? 'hind' : null, 1, () => sleg(k, hip, fx, g.legL * (far ? 0.92 : 1), g.legW * (far ? 0.85 : 1), mix(-1, 1, u) >= 0 ? 1 : -1, { toe: 0.08, split: 0.48 }), far);
  }
  if (g.raptor) { // mantis shrimp: folded smasher / spearer held under the head
    const b = polar(Pc[1], PI / 2, R[1] * 0.4), w = g.raptor;
    const m1 = polar(b, 0.2, w * 2.3), m2 = polar(m1, -1.35, w * 1.9);
    bar(k, [b, m1], tap(w * 0.55, w * 0.7)); dot(k, m1, w * 0.7);
    bar(k, [m1, m2], tap(w * 0.8, w * 0.6)); dot(k, m2, w * 0.55);
    tb(k, [m2, polar(m2, 0.5, w * 1.1), polar(m2, 1.2, w * 1.9)], tap(w * 0.45, 0.35));
  }
  // socket strip along the back of the abdomen for wings / spines lent to us
  const bpath = [...Pc.slice(1), ...segs.map(s => T(s.q))].reverse(), brad = t => (t > 0.55 ? rc : rc * 0.8);
  const hp = polar(front, -PI / 2, R[0] * 0.2);
  return { view: 'side', r: rc * 1.1, path: bpath, rad: brad, b0: 0.4, b1: 0.92, head: { p: hp, dir: -0.15, face: 0, s: rc * 0.7, bare: true, W: 0.8 }, tail: { p: polar(e, h, -fs * 0.4), dir: h, s: rc * 0.55 } };
};

// Insects in side view: thorax, abdomen (smooth, scalloped, domed, or on a waist), and three
// leg pairs (near and far), with special legs: jumping hind legs, raptorial or digging forelegs.
FORMS.insect = (K, g) => {
  const { k } = K, tx = g.tx, ty = g.ty * K.pl, cy = -(g.legH + ty), T0 = [0, cy];
  // ----- abdomen
  const aTilt = g.aTilt ?? 0.1, ax = g.ax, ay = g.ay * K.pl;
  let aStart = polar(T0, PI + aTilt * 0.5, tx * 0.7);
  if (g.waist) { const w0 = polar(aStart, PI + aTilt, g.waist); bar(k, [polar(aStart, 0, tx * 0.3), w0], Math.max(ty * 0.22, MA * 0.6)); if (g.node) dot(k, lerp(aStart, w0, 0.55), Math.max(ty * (g.node), 1.2)); aStart = w0; }
  const ah = PI + aTilt, bendA = g.aBend ?? 0;
  const apath = spline([aStart, polar(aStart, ah, ax * 0.5), polar(polar(aStart, ah, ax * 0.5), ah + bendA, ax * 0.5)], 8);
  const aprof = g.aShape === 'dome' ? (t => ay * Math.pow(Math.max(Math.sin(PI * clamp(t * 0.92 + 0.06, 0, 1)), 0), 0.55))
    : profile(g.aProf ?? [[0, ay * 0.7], [0.3, ay], [0.75, ay * 0.85], [1, ay * (g.aEnd ?? 0.35)]]);
  if (g.aShape === 'elytra') { // beetle wing cases: high domed back, flatter belly
    const c = polar(aStart, ah, ax * 0.48), rx = ax * 0.52, pts = [];
    for (let i = 0; i < 30; i++) { const a = i / 30 * TAU, sy = Math.sin(a); pts.push([Math.cos(a) * rx * (Math.cos(a) < 0 ? 1 : 0.92), sy * ay * (sy > 0 ? (g.belly ?? 0.55) : 1)]); }
    const rot = ([x, y]) => add(c, [x * Math.cos(aTilt) + y * Math.sin(aTilt), -x * Math.sin(aTilt) + y * Math.cos(aTilt)]);
    k.poly(pts.map(rot));
    if (g.comb) for (let i = 0; i < g.comb; i++) { const a = -PI * (0.2 + 0.6 * (i + 0.5) / g.comb), q = rot([Math.cos(a) * rx * 0.97, Math.sin(a) * ay * 0.97]); lf(k, q, a + PI * 0.5 + 0.9 + aTilt * 0, ay * 0.32, Math.max(ay * 0.12, MA * 1.1), 0, 0.3); }
  } else if (g.aSegs) { beads(k, apath, g.aSegs, aprof, g.aOv ?? 0.72, 0.03, 0.97); k.poly(tube(apath, t => aprof(t) * 0.9)); }
  else k.poly(tube(apath, aprof));
  if (g.fuzz) for (const [c0, rx, ry] of [[T0, tx, ty], [polar(aStart, ah, ax * 0.5), ax * 0.5, ay]]) for (let i = 0; i < 11; i++) { const a = -PI * 1.05 + i / 10 * PI * 1.1 + K.rng.range(-0.08, 0.08); dot(k, add(c0, [Math.cos(a) * rx * 0.97, Math.sin(a) * ry * 0.97]), g.fuzz * K.rng.range(0.8, 1.1)); }
  if (g.ball) { const R = g.ball, c = [aStart[0] - ax - R * 0.75, -R]; k.poly(ellipse(c, R, R, 0, 30)); g._ball = c; }
  if (g.sting) lf(k, apath[apath.length - 1], ah + bendA, g.sting, Math.max(ay * 0.25, MA), 0, 0.25);
  // ----- thorax and pronotum
  oval(k, T0, tx, ty, g.tTilt ?? 0);
  let hp = polar(T0, 0, tx * 0.85), hdir = g.hDir ?? 0.1, face = g.face ?? 0.25;
  if (g.pron === 'saddle') k.poly(spline([[tx * 0.85, cy + ty * 0.2], [tx * 0.9, cy - ty * 1.05], [0, cy - ty * 1.18], [-tx * 1.1, cy - ty * 1.08], [-tx * 1.25, cy - ty * 0.2], [-tx * 0.4, cy + ty * 0.35], [tx * 0.85, cy + ty * 0.2]], 5));
  if (g.pron === 'shield') { // treehopper pronotum: covers the body, rises to a hump or thorn
    const H = g.pH, x0 = tx * 0.75, xe = -tx * 0.7 - ax - 1, apx = tx * (g.pX ?? 0.2), ap = [apx, cy - ty - H];
    if (g.pShape === 'thorn') k.poly([[x0, cy - ty * 0.3], [apx + tx * 0.25, cy - ty * 0.9], polar(ap, 0.3, 1.2), polar(ap, PI + 0.6, 0.8), [apx - tx * 0.4, cy - ty * 1.0], [xe * 0.5, cy - ty * 0.95], [xe, cy - ty * 0.1], [xe * 0.5, cy + ty * 0.1], [-tx * 0.3, cy + ty * 0.3]]);
    else k.poly(spline([[x0, cy - ty * 0.2], [x0 * 0.8, cy - ty * 0.9], [apx + tx * 0.3, cy - ty - H * 0.85], ap, [apx - tx * 0.8, cy - ty - H * 0.7], [xe * 0.6, cy - ty * 1.0], [xe, cy - ty * 0.1], [xe * 0.5, cy + ty * 0.1], [-tx * 0.3, cy + ty * 0.3], [x0, cy - ty * 0.2]], 5));
  }
  if (g.pron === 'hump' || g.pron === 'horn') { oval(k, [tx * 0.2, cy - ty * 0.25], tx * 0.95, ty * 1.12); if (g.pron === 'horn') tb(k, [[tx * 0.3, cy - ty * 0.9], [tx * 0.9, cy - ty * 1.5], [tx * 1.5, cy - ty * (1.6 + g.pHorn * 0.2)], [tx * (1.2 + g.pHorn * 0.35), cy - ty * (1.4 + g.pHorn * 0.5)]], profile([[0, ty * 0.45], [0.6, ty * 0.25], [1, 0.4]])); }
  let neckTop = null;
  if (g.neck) { // mantis prothorax
    neckTop = polar(polar(T0, 0, tx * 0.6), -g.neckA, g.neck);
    tb(k, [polar(T0, 0, tx * 0.4), polar(polar(T0, 0, tx * 0.6), -g.neckA, g.neck * 0.5), neckTop], profile([[0, ty * 0.75], [0.5, ty * 0.45], [1, ty * 0.6]]));
    hp = neckTop;
  }
  // ----- legs: [hip x (fraction of tx), foot x offset, length, width, knee sign]
  const lg = g.legs;
  for (let i = 0; i < 3; i++) {
    const L = lg[i], role = ['fore', 'mid', 'hind'][i];
    let hip = [tx * L.x, cy + ty * 0.6];
    if (i === 0 && neckTop && L.kind === 'raptor') hip = lerp(polar(T0, 0, tx * 0.6), neckTop, 0.8);
    for (const far of [true, false]) {
      const sc = far ? 0.88 : 1, dx = far ? (L.farDx ?? -2.5) : 0;
      K.limb(hip, PI / 2, ty * 1.2, far ? (i === 1 ? null : role) : role, 1, () => {
        if (L.kind === 'jump') { // long femur up and back past the abdomen, tibia down to the ground
          const knee = polar(hip, PI + (L.fa ?? 0.4) + (far ? 0.06 : 0), L.f * sc), foot = [knee[0] + dx - L.f * (L.back ?? 0.1), 0];
          tb(k, [hip, lerp(hip, knee, 0.45), knee], profile([[0, L.w * sc * 0.7], [0.35, L.w * sc * 0.8], [1, L.w * sc * 0.3]]));
          jleg(k, [knee, lerp(knee, foot, 0.98), [foot[0] - L.f * 0.18, -0.6]], Math.max(L.w * 0.4 * sc, MA), MA);
        } else if (L.kind === 'raptor') {
          const ca = (L.ca ?? 0.95) + (far ? 0.12 : 0), fa = (L.fa ?? -1.05) + (far ? 0.2 : 0);
          const c1 = polar(hip, ca, L.L * 0.36 * sc), f1 = polar(c1, fa, L.L * 0.46 * sc);
          jleg(k, [polar(hip, ca, -1), c1, f1], L.w * sc * 0.8, L.w * sc * 1.05);
          const ta = fa + PI - 0.32, t1 = polar(f1, ta, L.L * 0.4 * sc);
          tb(k, [f1, lerp(f1, t1, 0.55), t1, polar(t1, ta - 1.6, L.w * 0.9)], tap(L.w * 0.3 * sc, MA * 0.42));
          for (let j = 0; j < 3; j++) { const q = lerp(c1, f1, 0.35 + j * 0.2); lf(k, q, fa + PI * 0.75, L.w * 0.8, Math.max(L.w * 0.32, MA), 0, 0.3); }
        } else if (L.kind === 'push') { // dung beetle hind legs braced up against the ball
          const c = g._ball, R = g.ball, tgt = polar(c, -0.35 + (far ? 0.35 : 0) + PI * 0.05, R * 0.98), knee = ik(hip, tgt, L.L * 0.5 * sc, L.L * 0.5 * sc, -1);
          jleg(k, [hip, knee, tgt], L.w * sc, L.w * sc * 0.6);
        } else if (L.kind === 'dig') { // mole cricket / dung beetle: short toothed spade
          const e = polar(hip, 0.35, L.L * 0.45 * sc), q = [e[0] + L.L * 0.3, -Math.max(L.w * 0.4, 0.8)];
          jleg(k, [hip, e, q], L.w * sc, L.w * 1.1 * sc);
          for (let j = 0; j < 4; j++) lf(k, lerp(e, q, 0.45 + j * 0.18), 0.2 - j * 0.15, L.w * 1.3, Math.max(L.w * 0.42, MA), 0, 0.3);
        } else if (L.ka != null) { // explicit knee: femur out from under the body, tibia down to the ground
          const knee = polar(hip, L.ka + (far ? (L.ka > PI / 2 ? -0.18 : 0.18) : 0), L.f * sc), dir = Math.cos(L.ka) >= 0 ? 1 : -1;
          const foot = [knee[0] + (L.tx ?? 0) * dir + dx * 0.3, -Math.max(L.w * 0.3, 0.5)], toe = [foot[0] + dir * (L.toe ?? 2.2), -0.5];
          jleg(k, [hip, knee, foot, toe], L.w * sc, L.w * sc * 0.55);
        } else sleg(k, hip, hip[0] + L.fx + dx, L.L * sc, L.w * sc, L.sign ?? 1, { toe: L.toe ?? 0.12, split: L.split ?? 0.5, toeDir: L.toeDir ?? (i === 0 ? 1 : -1) });
      }, far);
    }
  }
  const bpath = [...apath].reverse().concat([polar(T0, 0, tx * 0.8)]), brad = t => (t > 0.8 ? ty : aprof(1 - t));
  return { view: 'side', r: Math.max(ty, ay), path: bpath, rad: brad, b0: g.b0 ?? 0.4, b1: g.b1 ?? 0.95, head: { p: hp, dir: hdir, face, s: g.hs }, tail: { p: apath[apath.length - 1], dir: ah + bendA, s: Math.max(ay * 0.4, 2) } };
};

// Caterpillars and millipedes in side view: a chain of ring segments on the ground (or arched,
// for a looper; or coiled up in a spiral). Legs per segment: 'true' jointed legs, 'pro' stubby
// prolegs, 'milli' a fringe of tiny legs. Optional tail horn and hair tufts.
FORMS.worm = (K, g) => {
  const { k, rng } = K, r = g.r * K.pl, n = g.n;
  let path;
  if (g.coil) { // spiral, head in the middle; sits on the ground
    const turns = g.coil, R0 = r * (1.05 + turns * 2.05), c = [0, -R0 - r], pts = [];
    for (let i = 0; i <= 60; i++) { const u = i / 60, th = PI * 0.5 + u * turns * TAU, rr = R0 - u * turns * r * 2.05; pts.push(polar(c, th, rr)); }
    path = pts;
  } else {
    const L = n * g.sl, y0 = -(g.legH + r), x0 = -L / 2, x1 = L / 2, A = g.arch ?? 0;
    path = A ? spline([[x0 + L * 0.2, y0], [x0 + L * 0.32, y0 - A * 0.55], [x0 + L * 0.38, y0 - A * 0.92], [0, y0 - A * 1.08], [x1 - L * 0.38, y0 - A * 0.92], [x1 - L * 0.32, y0 - A * 0.55], [x1 - L * 0.2, y0]], 8) : spline([[x0, y0], [0, y0 - (g.hump ?? 0)], [x1, y0]], 10);
  }
  const rad = t => r * (g.env ? g.env(t) : 1);
  const bs = beads(k, path, n, rad, g.ov ?? 0.66);
  const hb = bs[n - 1];
  bs.forEach((b, i) => {
    const kind = g.leg ? g.leg(i, n) : null; if (!kind || g.coil) return;
    const belly = polar(b.p, b.ang + PI / 2, b.w * 0.6);
    if (belly[1] < -b.w * 1.9 - (g.legH ?? 0)) return; // raised part of a looper
    if (kind === 'pro') { const top = b.seg * 0.38, bot = b.seg * 0.22; k.poly(spline([[belly[0] - top, belly[1] - 1], [belly[0] + top, belly[1] - 1], [belly[0] + bot, -0.9], [belly[0] + bot * 0.6, -0.3], [belly[0] - bot * 0.6, -0.3], [belly[0] - bot, -0.9], [belly[0] - top, belly[1] - 1]], 3)); }
    else if (kind === 'true') K.limb(belly, PI / 2, r, i === n - 2 ? 'fore' : null, 1, () => jleg(k, [belly, [belly[0] + b.seg * 0.45, belly[1] * 0.4], [belly[0] + b.seg * 0.6, -0.5]], Math.max(r * 0.32, MA * 1.1), MA));
    else if (kind === 'milli') K.limb(belly, PI / 2, r, null, 1, () => jleg(k, [belly, [belly[0] + b.seg * 0.3, belly[1] * 0.45], [belly[0] + b.seg * 0.05, -0.4]], MA * 1.1, MA));
  });
  if (!g.coil) for (const [i, role] of [[1, 'hind'], [n >> 1, 'mid']]) { const b = bs[i]; if (!g.leg || g.leg(i, n) !== 'true') K.limb(polar(b.p, b.ang + PI / 2, b.w * 0.6), PI / 2, r, K.nat ? null : role, 1, null); }
  // head capsule
  const ha = hb.ang + (g.coil ? 0 : (g.headDown ?? 0.5)), hc = polar(hb.p, ha, hb.seg * 0.55);
  if (!g.coil) oval(k, hc, r * (g.headL ?? 0.75), r * (g.headW ?? 0.8), ha);
  if (g.horn) { const b = bs[1], base = polar(b.p, b.ang - PI / 2, b.w * 0.7); tb(k, [base, polar(base, -PI / 2 - 0.5, g.horn * 0.55), polar(base, -PI / 2 - 1.0, g.horn)], profile([[0, r * 0.3], [1, 0.3]])); }
  if (g.hair) bs.forEach((b, i) => {
    const tuft = (g.pencil && (i === 1 || i === n - 2)) ? 2.2 : 1;
    for (let j = 0; j < (g.hairN ?? 3); j++) { const a = b.ang - PI / 2 + (j - ((g.hairN ?? 3) - 1) / 2) * 0.42 + rng.range(-0.12, 0.12); lf(k, polar(b.p, a, b.w * 0.75), a, g.hair * tuft * rng.range(0.75, 1.15), Math.max(MA * 1.3, r * 0.18), 0, 0.2); }
  });
  if (g.spikes) bs.forEach((b, i) => { if (i > 0 && i < n - 1) { const a = b.ang - PI / 2; lf(k, polar(b.p, a, b.w * 0.75), a, g.spikes, Math.max(r * 0.35, MA * 1.3), 0, 0.3); } });
  const back = g.coil ? null : [strip(path, rad, 0.08, 0.9, 12, -1)];
  const t0 = pathAt(path, 0);
  return { view: 'side', r, path, rad, back, head: { p: hc, dir: ha, face: g.coil ? ha : 0.3, s: r * 0.9, bare: true, W: 0.7 }, tail: { p: t0.p, dir: t0.ang + PI, s: r * 0.7 } };
};

// Pill bug rolled into a ball: a circle whose plates step the outline.
FORMS.pillball = (K, g) => {
  const { k } = K, R = g.R * K.pl, n = g.n, c = [0, -R], a0 = g.a0 ?? 0.55, span = (TAU - 0.5) / n, st = g.step ?? 0.07, pts = [];
  for (let j = 0; j < n; j++) for (let m = 0; m <= 4; m++) { const a = a0 + 0.25 + (j + m / 4.6) * span, rr = R * (1 + st * (m / 4) - (m === 0 ? st * 0.3 : 0)); pts.push(polar(c, a, rr)); }
  k.poly(pts);
  oval(k, polar(c, a0, R * 0.8), R * 0.32, R * 0.24, a0 + PI / 2); // tucked head
  const hp = polar(c, a0 + 0.05, R * 0.95);
  return { view: 'side', r: R, path: [polar(c, PI, R * 0.5), polar(c, 0, R * 0.5)], rad: () => R * 0.5, back: [[0.1, 0.3, 0.5, 0.7, 0.9].map((t, i) => { const a = PI + 0.3 + t * (PI - 0.6); return { p: polar(c, a, R * 0.9), dir: a, t }; })], head: { p: hp, dir: a0, face: 0.2, s: R * 0.35, bare: true, W: 0.6 }, tail: { p: polar(c, a0 + 0.3 + TAU - 0.6, R * 0.9), dir: a0 - 0.3, s: R * 0.3 } };
};

// Hermit crab in side view: a stepped spiral shell, the crab's front end out of the aperture.
FORMS.hermit = (K, g) => {
  const { k } = K, S = g.S * K.pl, lift = g.lift, c = [-S * 0.25, -(S + lift)];
  oval(k, c, S * (g.bodyX ?? 1.05), S, g.tilt ?? -0.15);
  let p = c, rr = S, a = PI + (g.spireA ?? 0.75);
  for (let i = 0; i < g.whorls; i++) { const q = polar(p, a, rr * 0.72), r2 = rr * (g.shrink ?? 0.6); oval(k, q, r2 * 1.1, r2, a + PI / 2 - 0.2); p = q; rr = r2; a -= g.twist ?? 0.12; }
  if (g.spire) lf(k, p, a, rr * g.spire, rr * 1.4, 0, 0.35);
  // the crab: carapace front, eye stalks, legs, claw
  const cc = add(c, [S * 0.95, S * 0.35]), cr = S * 0.42;
  oval(k, cc, cr, cr * 0.8, -0.2);
  for (let i = 0; i < 2; i++) { const hip = add(cc, [-cr * 0.4 + i * cr * 0.5, cr * 0.5]), fx = hip[0] + (i ? 1 : 0.4) * S * 0.7; K.limb(hip, PI / 2, S * 0.5, i ? 'fore' : 'mid', 1, () => sleg(k, hip, fx, S * 1.3, S * 0.2, -1, { toe: 0.1, split: 0.45 }), false); }
  K.limb(add(cc, [cr * 0.3, cr * 0.2]), 0.5, S * 0.55, 'arm', 1, () => {
    const big = g.claw * S, a1 = arm(k, add(cc, [cr * 0.5, cr * 0.3]), [[0.9, big * 0.55], [-0.3, big * 0.45]], S * 0.3);
    chela(k, a1.p, -0.15, big * 0.75, { flip: 1, fat: 0.45, finger: 0.8 });
  });
  const hp = add(cc, [cr * 0.7, -cr * 0.3]);
  return { view: 'side', r: S, path: [polar(c, PI, S * 0.6), polar(c, 0, S * 0.6)], rad: () => S * 0.8, back: [[0, 1, 2, 3, 4].map(i => { const a = -PI * 0.9 + i * 0.35; return { p: polar(c, a, S * 0.85), dir: a, t: i / 4 }; })], head: { p: hp, dir: -0.3, face: 0, s: cr * 0.8, bare: true, W: 0.7 }, tail: { p: polar(c, PI * 0.85, S * 0.8), dir: PI * 0.85, s: S * 0.3 } };
};

// Horseshoe crab and triops from above: a domed shield, a hinged or segmented hind body, a spike or two tails.
FORMS.shield = (K, g) => {
  const { k, rng } = K, Lp = g.Lp, Wp = g.Wp * K.pl;
  let tailP, tailS;
  if (g.kind === 'horseshoe') {
    sym(k, [[Lp, 0], [Lp * 0.88, Wp * 0.5], [Lp * 0.5, Wp * 0.9], [0, Wp], [-Lp * 0.4, Wp * 0.96], [-Lp * 0.62, Wp * 0.86], [-Lp * 0.38, Wp * 0.62], [-Lp * 0.28, 0]], 6);
    const Lo = g.Lo, Wo = Wp * 0.62, x0 = -Lp * 0.25;
    symP(k, [[x0, 0], [x0, Wo], [x0 - Lo * 0.85, Wo * 0.42], [x0 - Lo, 0]]);
    for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { const u = (i + 0.5) / 6, p = lerp([x0, sd * Wo], [x0 - Lo * 0.85, sd * Wo * 0.42], u); lf(k, polar(p, sd * PI / 2, -0.8), sd * (PI / 2 + 0.6), g.spine * (i % 2 ? 0.6 : 1), Math.max(g.spine * 0.4, MA * 1.2), 0, 0.3); }
    const tp = [x0 - Lo * 0.9, 0]; tb(k, [tp, polar(tp, PI + g.tBend * 0.5, g.T * 0.5), polar(tp, PI + g.tBend, g.T)], profile([[0, Wo * 0.2], [1, 0.4]]));
    tailP = [x0 - Lo, 0]; tailS = Wo * 0.3;
  } else { // triops
    const C = Lp, Wc = Wp;
    sym(k, [[C * 0.5, 0], [C * 0.45, Wc * 0.6], [C * 0.1, Wc], [-C * 0.3, Wc * 0.9], [-C * 0.5, Wc * 0.5], [-C * 0.36, Wc * 0.18], [-C * 0.3, 0]], 6);
    for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) { const p = [-C * (0.05 + i * 0.08), sd * Wc * (0.92 - i * 0.05)]; lf(k, p, sd * (PI / 2 + 0.7 + i * 0.12), Wc * 0.28, Math.max(Wc * 0.09, MA * 1.1), 0, 0.4); }
    const A = g.A, ap = axis(-C * 0.15, -C * 0.15 - A).reverse();
    beads(k, ap, g.n, t => Wc * mix(0.12, 0.3, t), 0.7);
    const e = [-C * 0.15 - A, 0];
    for (const sd of [-1, 1]) whip(k, e, PI + sd * g.splay, g.T, sd * 0.15, Math.max(Wc * 0.1, MA * 1.2), MA);
    tailP = e; tailS = Wc * 0.15;
  }
  for (const [x, role] of [[0.6, 'fore'], [0.15, 'mid'], [-0.25, 'hind']]) for (const sd of [-1, 1]) K.limb([Lp * x, sd * Wp * 0.75], sd * (PI / 2 + x * -0.6), Wp * 0.4, role, sd, null);
  return { view: 'top', r: Wp * 0.8, path: axis(tailP[0], Lp), rad: t => Wp * 0.7, head: { p: [Lp * 0.8, 0], dir: 0, s: Wp * 0.35, bare: true, W: 0.9 }, tail: { p: tailP, dir: PI, s: tailS } };
};

// Anomalocaris and Opabinia from above: lobed swimming flaps down both sides, a tail fan of
// blades; frontal grasping arms (anomalocaris) or a clawed proboscis and five eyes (opabinia).
FORMS.radiodont = (K, g) => {
  const { k } = K, L = g.L, W = g.W * K.pl, n = g.n, x1 = L / 2, x0 = -L / 2;
  const env = u => Math.sin(PI * clamp(0.08 + u * 0.92, 0, 1)) ** 0.6; // u: 0 tail .. 1 head
  sym(k, [[x1, 0], [x1 - L * 0.05, W * 0.55], [x1 - L * 0.2, W * 0.62], [0, W * 0.6], [x0 + L * 0.2, W * 0.4], [x0, W * 0.2], [x0, 0]], 6);
  for (const sd of [-1, 1]) for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, x = mix(x1 - L * 0.2, x0 + L * 0.12, u), f = g.flap * mix(1, 0.5, u * u) * (0.8 + 0.2 * env(1 - u));
    const sp = (L * 0.68) / n; oval(k, [x - f * 0.2, sd * (W * 0.42 + f * 0.42)], sp * 0.62, f * 0.5, sd * (0.35 + u * 0.25));
  }
  for (const sd of [-1, 1]) for (let j = 0; j < g.blades; j++) lf(k, [x0 + L * 0.02, sd * W * 0.12], PI - sd * (0.35 + j * 0.32), g.blade * (1 - j * 0.12), g.blade * 0.36, 0, 0.45);
  if (g.kind === 'anomalocaris') {
    for (const sd of [-1, 1]) { // stalked eyes and the segmented frontal arms curling inward
      const sb = [x1 - L * 0.08, sd * W * 0.5], se = polar(sb, sd * 1.2, W * 0.45); bar(k, [sb, se], Math.max(W * 0.12, MA * 0.8)); dot(k, se, W * 0.22);
      const pts = arcPts([x1 - L * 0.02, sd * W * 0.25], sd * 0.1, g.arm, -sd * g.armCurl, 8);
      pts.forEach((q, i) => { if (i) { oval(k, lerp(pts[i - 1], q, 0.5), dist(pts[i - 1], q) * 0.62, Math.max(W * mix(0.26, 0.12, i / 8), 1.1), angOf(pts[i - 1], q)); if (i > 1 && i < 8) lf(k, q, angOf(pts[i - 1], q) - sd * 1.45, W * 0.35, Math.max(W * 0.08, MA * 1.1), 0, 0.3); } });
    }
  } else { // opabinia
    const pb = [x1, 0], pe = polar(pb, 0, g.prob); bar(k, [pb, pe], tap(W * 0.18, Math.max(W * 0.1, MA * 0.7)));
    for (const sd of [-1, 1]) lf(k, pe, sd * 0.5, W * 0.45, Math.max(W * 0.14, MA * 1.2), -sd * 0.2, 0.35);
    for (const [a, l] of [[-0.9, 0.55], [-0.45, 0.7], [0, 0.6], [0.45, 0.7], [0.9, 0.55]]) { const sb = [x1 - L * 0.07, a * W * 0.3], se = polar(sb, a * 1.1, W * l * 1.2); bar(k, [sb, se], Math.max(W * 0.1, MA * 0.8)); dot(k, se, W * 0.24); }
  }
  for (const [u, role] of [[0.2, 'fore'], [0.5, 'mid'], [0.8, 'hind']]) for (const sd of [-1, 1]) K.limb([mix(x1 - L * 0.2, x0 + L * 0.1, u), sd * W * 0.6], sd * (PI / 2 + (u - 0.5)), W * 0.6, role, sd, null);
  return { view: 'top', r: W, path: axis(x0, x1), rad: t => W * 0.6, head: { p: [x1, 0], dir: 0, s: W * 0.5, bare: true, W: 0.5 }, tail: { p: [x0, 0], dir: PI, s: W * 0.3 } };
};

// Hallucigenia in side view: a slender tube on tentacle legs, a row of tall spines along its back.
FORMS.hallu = (K, g) => {
  const { k, rng } = K, r = g.r * K.pl, L = g.L, y0 = -(g.legH + r);
  const path = spline([[-L / 2, y0 + r * 1.2], [-L * 0.35, y0], [0, y0 - g.hump], [L * 0.38, y0], [L / 2, y0 + r * 0.4]], 10);
  k.poly(tube(path, profile([[0, r * 0.5], [0.15, r], [0.85, r], [1, r * 0.9]])));
  const e = pathAt(path, 1); dot(k, polar(e.p, e.ang, r * 0.4), r * (g.headR ?? 1.5));
  for (let i = 0; i < g.n; i++) {
    const t = mix(0.2, 0.8, i / (g.n - 1)), q = pathAt(path, t);
    for (const far of [true, false]) {
      const a = q.ang - PI / 2 + (far ? 0.3 : -0.1) - 0.15 + rng.range(-0.05, 0.05);
      lf(k, polar(q.p, a, r * 0.5), a, g.spine * (far ? 0.85 : 1) * rng.range(0.92, 1.08), Math.max(r * 0.75, MA * 1.4), 0, 0.15);
    }
  }
  for (let i = 0; i < g.legs; i++) {
    const t = mix(0.15, 0.82, i / (g.legs - 1)), q = pathAt(path, t), b = polar(q.p, q.ang + PI / 2, r * 0.6), f = [b[0] + rng.range(-0.8, 0.8) + 1.0, -0.6];
    K.limb(b, PI / 2, r * 2.5, i === 0 ? 'hind' : i === g.legs - 1 ? 'fore' : null, 1, () => { tb(k, [b, add(lerp(b, f, 0.5), [-1.2, 0]), f], tap(Math.max(r * 0.38, MA * 0.62), MA * 0.5)); lf(k, f, 0.25, 1.6, MA * 1.1, 0, 0.3); });
  }
  return { view: 'side', r, path, rad: () => r, back: [strip(path, () => r, 0.2, 0.8, 10, -1)], head: { p: polar(e.p, e.ang, r * 0.8), dir: e.ang, face: 0.2, s: r * 1.2, bare: true, W: 0.6 }, tail: { p: pathAt(path, 0).p, dir: pathAt(path, 0).ang + PI, s: r * 0.7 } };
};

// Eurypterid (sea scorpion) from above: rounded prosoma with small legs and a pair of swimming
// paddles, a broad segmented body narrowing to a spike or paddle telson.
FORMS.eurypterid = (K, g) => {
  const { k } = K, Lp = g.Lp, Wp = g.Wp * K.pl, n = g.n, sl = g.sl;
  sym(k, [[Lp * 0.5, 0], [Lp * 0.45, Wp * 0.7], [Lp * 0.15, Wp], [-Lp * 0.5, Wp * 0.95], [-Lp * 0.55, 0]], 6);
  const pts = [[-Lp * 0.45, 0]]; for (let i = 1; i <= n; i++) pts.push([-Lp * 0.45 - i * sl * (i > g.pre ? 0.9 : 1), 0]);
  const env = i => (i < g.pre ? mix(1.0, 1.2, Math.sin(PI * i / g.pre)) : mix(0.55, 0.32, (i - g.pre) / Math.max(n - g.pre - 1, 1))) * Wp;
  for (let i = 0; i < n; i++) { const c = lerp(pts[i], pts[i + 1], 0.5), w = env(i); oval(k, c, sl * 0.62, w, 0); for (const sd of [-1, 1]) k.poly([[c[0] + sl * 0.4, sd * w * 0.7], [c[0] - sl * 0.55, sd * w * 1.02], [c[0] - sl * 0.2, sd * w * 0.6]]); }
  const e = pts[n];
  if (g.telson === 'paddle') lf(k, polar(e, 0, sl * 0.5), PI, g.tel, Wp * 0.75, 0, 0.5); else { bar(k, [polar(e, 0, sl * 0.5), polar(e, PI, g.tel)], tap(Wp * 0.18, 0.4)); }
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 3; i++) { const base = [Lp * (0.25 - i * 0.22), sd * Wp * 0.85], a0 = sd * (0.9 + i * 0.35); K.limb(base, a0, Wp * 0.5, i === 0 ? 'fore' : i === 2 ? 'mid' : null, sd, () => tleg(k, base, a0, -sd * 0.4, g.legL * (1 + i * 0.1), g.legW, [0.4, 0.33, 0.27])); }
    const pb = [-Lp * 0.35, sd * Wp * 0.85];
    K.limb(pb, sd * 2.1, Wp * 0.6, 'hind', sd, () => { const pts2 = tleg(k, pb, sd * 1.75, sd * 0.35, g.pad * 1.5, g.legW * 1.5, [0.45, 0.35]); lf(k, pts2[2], angOf(pts2[1], pts2[2]), g.pad, g.pad * 0.5, 0, 0.5); });
    if (g.claws) { const a = arm(k, [Lp * 0.48, sd * Wp * 0.35], [[sd * 0.35, g.claws * 0.9], [-sd * 0.1, g.claws * 0.7]], Wp * 0.3); chela(k, a.p, -sd * 0.2, g.claws * 0.8, { flip: sd, fat: 0.3, finger: 1.4 }); }
  }
  return { view: 'top', r: Wp, path: axis(e[0], Lp * 0.5), rad: () => Wp * 0.8, head: { p: [Lp * 0.42, 0], dir: 0, s: Wp * 0.4, bare: true, W: 0.6 }, tail: { p: e, dir: PI, s: Wp * 0.3 } };
};

// Copepod from above: a teardrop prosome, slender urosome with furcal setae, egg sacs.
// (The great sweeping first antennae are the crown.)
FORMS.copepod = (K, g) => {
  const { k } = K, P = g.P, W = g.W * K.pl, xb = -P * 0.5;
  sym(k, [[P * 0.5, 0], [P * 0.42, W * 0.65], [P * 0.15, W], [-P * 0.12, W * 0.95], [-P * 0.18, W * 0.82], [-P * 0.3, W * 0.78], [-P * 0.36, W * 0.62], [-P * 0.46, W * 0.52], [xb, W * 0.28], [xb, 0]], 6);
  const up = axis(xb + 1, xb - g.U).reverse(); beads(k, up, g.un, t => W * mix(0.16, 0.27, t), 0.7);
  const e = [xb - g.U, 0];
  for (const sd of [-1, 1]) { const f = polar(e, PI + sd * 0.25, W * 0.35); bar(k, [e, f], Math.max(W * 0.08, MA * 0.7)); for (const da of [-0.12, 0.12]) whip(k, f, PI + sd * (0.3 + da * 3), g.set, sd * 0.2, MA * 1.1, MA * 0.8); }
  if (g.eggs) for (const sd of [-1, 1]) oval(k, [xb - g.U * 0.45, sd * W * 0.55], g.U * 0.42, W * 0.36, sd * -0.25);
  const hp = [P * 0.45, 0];
  for (const [x, role] of [[0.2, 'fore'], [-0.1, 'mid'], [-0.35, 'hind']]) for (const sd of [-1, 1]) K.limb([P * x, sd * W * 0.7], sd * (PI / 2 + x * -1), W * 0.4, role, sd, null);
  return { view: 'top', r: W, path: axis(e[0], P * 0.5), rad: () => W * 0.7, head: { p: hp, dir: 0, s: W * 0.5, bare: true, W: 0.9 }, tail: { p: e, dir: PI, s: W * 0.2 } };
};

// Water flea (Daphnia) in side view: a bean carapace with a tail spine, a beaked head.
FORMS.daphnia = (K, g) => {
  const { k } = K, R = g.R * K.pl, c = [0, -R * 1.02 - (g.lift ?? 0.4)];
  oval(k, c, R * 0.82, R, g.tilt ?? 0.25);
  const hc = add(c, [R * 0.55, -R * 0.62]); oval(k, hc, R * 0.45, R * 0.4, 0.4);
  k.poly([add(hc, [R * 0.15, R * 0.15]), add(hc, [R * 0.55, R * 0.6]), add(hc, [R * 0.05, R * 0.45])]); // rostrum
  const sp = polar(c, PI * 1.15 + (g.tilt ?? 0.25), R * 0.82); lf(k, sp, PI * 1.12 + (g.spA ?? 0), g.spine, R * 0.22, 0, 0.3);
  return { view: 'side', r: R, path: [add(c, [-R * 0.6, 0]), add(c, [R * 0.6, 0])], rad: () => R * 0.7, back: [[0, 1, 2, 3].map(i => { const a = -PI * 0.8 + i * 0.3; return { p: polar(c, a, R * 0.85), dir: a, t: i / 3 }; })], head: { p: add(hc, [-R * 0.1, -R * 0.3]), dir: -1.4, face: -0.6, s: R * 0.45, bare: true, W: 0.5 }, tail: { p: sp, dir: PI * 1.1, s: R * 0.2 } };
};

// Barnacles in side view, rooted: goose barnacles on flexible stalks, or a cluster of acorn cones.
FORMS.barnacle = (K, g) => {
  const { k, rng } = K;
  let head = null, mainR = 4;
  if (g.kind === 'goose') {
    const n = g.count;
    for (let i = 0; i < n; i++) {
      const main = i === 0, s = main ? 1 : rng.range(0.6, 0.75), base = [main ? 0 : (i === 1 ? 1 : -1) * rng.range(2, 3), 0.3], h = g.h * s, lean = (main ? rng.range(-0.25, 0.25) : (base[0] > 0 ? 0.35 : -0.35)) + rng.range(-0.1, 0.1);
      const top = polar(base, -PI / 2 + lean, h), w = g.w * s;
      tb(k, [base, polar(polar(base, -PI / 2 + lean * 0.5, h * 0.5), lean > 0 ? 0 : PI, w * 0.3), top], profile([[0, w * 0.8], [0.5, w * 0.62], [1, w * 0.7]]));
      const ca = -PI / 2 + lean * 1.3, cap = g.cap * s;
      oval(k, polar(top, ca, cap * 0.38), cap * 0.5, cap * 0.33, ca); lf(k, polar(top, ca, cap * 0.3), ca + 0.08, cap * 0.75, cap * 0.5, 0, 0.4);
      if (main) { head = { p: polar(top, ca, cap * 0.92), dir: ca + 0.2, face: ca + 0.2, s: cap * 0.32, bare: true, W: 0.3 }; mainR = cap * 0.3; }
    }
  } else { // acorn barnacles: toothed volcano cones
    const n = g.count; let x = -(n - 1) * g.cone * 0.55;
    for (let i = 0; i < n; i++) {
      const s = i === 0 ? 1 : rng.range(0.55, 0.85), R = g.cone * s, H = R * rng.range(0.8, 1.1), cx = x + rng.range(-1, 1), tw = R * 0.42;
      const pts = [[cx - R, 0.3], [cx + R, 0.3]];
      for (let j = 0; j <= 6; j++) { const u = j / 6, xx = mix(cx + tw, cx - tw, u); pts.push([xx, -H + (j % 2 ? R * 0.12 : 0)]); }
      k.poly(spline([[cx - R, 0.3], [cx + R, 0.3], [cx + R * 0.75, -H * 0.4], [cx + tw * 1.05, -H], [cx + tw * 0.4, -H * 1.08], [cx - tw * 0.4, -H * 1.08], [cx - tw * 1.05, -H], [cx - R * 0.75, -H * 0.4], [cx - R, 0.3]], 4));
      for (let j = -1; j <= 1; j++) k.poly([[cx + j * tw * 0.7 - R * 0.12, -H * 0.97], [cx + j * tw * 0.75, -H * 1.22], [cx + j * tw * 0.7 + R * 0.12, -H * 0.97]]);
      if (i === 0) { head = { p: [cx, -H * 1.05], dir: -PI / 2, face: -PI / 2 + 0.3, s: R * 0.3, bare: true, W: 0.3 }; mainR = R * 0.3; }
      x += g.cone * rng.range(0.95, 1.15);
    }
  }
  return { view: 'side', rooted: true, r: mainR * 2, path: [[-3, -3], [3, -3]], rad: () => 2, back: [[{ p: [-2, -3], dir: -PI / 2, t: 0 }, { p: [2, -3], dir: -PI / 2, t: 1 }]], head, tail: { p: [-2, -1], dir: PI, s: 2 } };
};

// Crab zoea larva in side view: a round carapace with a long dorsal spine and a rostral
// spine, a big eye, a slim segmented abdomen curled under, ending in a forked telson.
FORMS.zoea = (K, g) => {
  const { k } = K, R = g.R * K.pl, buf = { polys: [], poly(p) { this.polys.push(p); return this; } };
  const c = [0, 0];
  oval(buf, c, R, R * 0.92, 0);
  lf(buf, polar(c, -PI / 2 - g.dA, R * 0.7), -PI / 2 - g.dA, g.dS, R * 0.42, -0.04, 0.25);       // dorsal spine
  lf(buf, polar(c, 0.75, R * 0.75), 0.75 + g.rA, g.rS, R * 0.32, 0.03, 0.25);                     // rostral spine
  if (g.lat) for (const a of [PI * 0.95]) lf(buf, polar(c, a, R * 0.8), a, g.lat, R * 0.22, 0, 0.25); // lateral spine
  dot(buf, polar(c, 0.15, R * 0.85), R * 0.36);                                                   // eye
  const pts = arcPts(polar(c, PI * 0.7, R * 0.6), PI * 0.62, g.aL, g.aCurl, 6);
  pts.forEach((q, i) => { if (i) oval(buf, lerp(pts[i - 1], q, 0.5), dist(pts[i - 1], q) * 0.62, R * mix(0.32, 0.2, i / 6), angOf(pts[i - 1], q)); });
  const e = pts[6], ea = angOf(pts[5], e);
  for (const sd of [-1, 1]) lf(buf, e, ea + sd * 0.45, R * 0.75, R * 0.18, sd * 0.05, 0.3);
  for (const a of [1.35, 1.6]) { const b = polar(c, a, R * 0.8); buf.poly(tube(spline(arcPts(b, a, R * 1.0, -0.6, 4), 3), tap(R * 0.12, MA * 0.5))); }
  let low = -Infinity; for (const p of buf.polys) for (const q of p) low = Math.max(low, q[1]);
  for (const p of buf.polys) k.poly(p.map(q => [q[0], q[1] - low - 0.2]));
  const T = q => [q[0], q[1] - low - 0.2], cc = T(c);
  return { view: 'side', r: R, path: [T([-R * 0.6, 0]), T([R * 0.6, 0])], rad: () => R * 0.7, back: [[0, 1, 2, 3].map(i => { const a = -PI * 0.85 + i * 0.25; return { p: polar(cc, a, R * 0.85), dir: a, t: i / 3 }; })], head: { p: T(polar(c, 0.2, R * 0.9)), dir: 0.2, face: 0.2, s: R * 0.4, bare: true, W: 0.5 }, tail: { p: T(e), dir: ea, s: R * 0.2 } };
};

// Mantis shrimp from above: stalked eyes and antennal scales, a narrow carapace, folded
// raptorial claws at its sides, an abdomen that widens to a spiked telson and uropods.
FORMS.stomatopod = (K, g) => {
  const { k } = K, W = g.W * K.pl, Lc = g.Lc, xc1 = Lc * 0.5, xc0 = -Lc * 0.5;
  sym(k, [[xc1 + W * 0.15, 0], [xc1, W * 0.55], [xc1 - Lc * 0.3, W * 0.85], [xc0, W * 0.8], [xc0 - 0.5, 0]]);
  lf(k, [xc1 - 0.5, 0], 0, W * 0.6, W * 0.4, 0, 0.5);                                    // rostral plate
  const ts = W * 0.42, as = g.sl, na = 5;
  for (let i = 0; i < 3; i++) oval(k, [xc0 - ts * (i + 0.5), 0], ts * 0.75, W * mix(0.75, 0.9, i / 2));
  const xa = xc0 - ts * 3;
  for (let i = 0; i < na; i++) {
    const x = xa - as * (i + 0.5), w = W * mix(0.95, g.wide, i / (na - 1));
    oval(k, [x, 0], as * 0.66, w);
    for (const sd of [-1, 1]) k.poly([[x + as * 0.35, sd * w * 0.7], [x - as * 0.55, sd * (w + W * 0.18)], [x - as * 0.3, sd * w * 0.5]]);
  }
  const xt = xa - as * na, Tl = g.tel, Wt = W * g.wide * 0.8;
  sym(k, [[xt + as * 0.4, 0], [xt + as * 0.2, Wt], [xt - Tl * 0.55, Wt * 0.9], [xt - Tl * 0.9, Wt * 0.45], [xt - Tl, 0]]);
  for (const sd of [-1, 1]) {
    for (const [u, len] of [[0.35, 0.4], [0.7, 0.32]]) lf(k, [xt - Tl * u, sd * Wt * mix(0.95, 0.5, u)], PI - sd * mix(1.1, 0.6, u), W * len, W * 0.22, 0, 0.3);
    const ub = [xt + as * 0.1, sd * Wt * 0.8];                                              // uropods
    lf(k, ub, PI - sd * 0.75, W * g.uro, W * 0.48, sd * 0.1, 0.5);
    lf(k, ub, PI - sd * 1.15, W * g.uro * 0.75, Math.max(W * 0.16, MA * 1.2), 0, 0.3);
  }
  lf(k, [xt - Tl * 0.8, 0], PI, W * 0.4, W * 0.2, 0, 0.3);
  for (const sd of [-1, 1]) {
    // eyes on stalks, antennal scales
    const eb = [xc1 + W * 0.1, sd * W * 0.2], ee = polar(eb, sd * g.eyeA, W * g.eyeS);
    bar(k, [eb, ee], Math.max(W * 0.16, MA * 0.8)); oval(k, ee, W * 0.5, W * 0.66, sd * g.eyeA);
    lf(k, [xc1 - W * 0.1, sd * W * 0.45], sd * 0.5, W * 0.8, W * 0.4, 0, 0.5);
    // raptorial claw, folded: merus out and forward, propodus folded back along it, dactyl
    const b = [xc1 - Lc * 0.45, sd * W * 0.75];
    K.limb(b, sd * 0.9, W * 0.8, 'fore', sd, () => {
      const R = g.rap, el = polar(b, sd * 1.5, R * 0.6), tip = polar(el, sd * 0.06, R * 1.15);
      dot(k, el, R * 0.36);
      k.poly(leaf(polar(el, PI, R * 0.15), sd * 0.06, R * 1.3, R * 0.62, -sd * 0.05, 0.4));
      if (g.smash) dot(k, polar(el, sd * 0.06, R * 0.95), R * 0.34);
      else for (let j = 0; j < 3; j++) lf(k, polar(el, sd * 0.06, R * (0.35 + j * 0.28)), -sd * 0.6, R * 0.3, Math.max(R * 0.12, MA * 1.2), 0, 0.3);
      tb(k, [tip, polar(tip, -sd * 1.9, R * 0.25), polar(tip, -sd * 2.9, R * 0.55)], tap(R * 0.2, 0.5));
    });
    for (let i = 0; i < 3; i++) { const base = [xc0 - ts * (i + 0.5), sd * W * 0.7], a0 = sd * (PI / 2 + i * 0.25); K.limb(base, a0, W * 0.5, i === 0 ? 'mid' : i === 2 ? 'hind' : null, sd, () => tleg(k, base, a0, sd * 0.45, W * 1.0, g.legW, [0.5, 0.5])); }
  }
  return { view: 'top', r: W, path: axis(xt - Tl, xc1), rad: t => W * 0.9, head: { p: [xc1, 0], dir: 0, s: W * 0.5, bare: true, W: 0.4 }, tail: { p: [xt - Tl * 0.5, 0], dir: PI, s: W * 0.4 } };
};

// Marrella (Burgess Shale) from above: a small head shield with two pairs of great spines
// sweeping back, feathery swimming antennae, and a tapering trunk fringed with branched gill-legs.
FORMS.marrella = (K, g) => {
  const { k, rng } = K, W = g.W * K.pl, L = g.L, hx = L * 0.5;
  oval(k, [hx - W * 0.5, 0], W * 0.75, W * 0.6);
  const tp = axis(hx - W * 0.9, hx - W * 0.9 - L).reverse();
  const bs = beads(k, tp.slice().reverse(), g.n, t => W * mix(0.36, 0.14, t), 0.75);
  for (const sd of [-1, 1]) {
    for (const [y0, a0, len, turn, w0] of [[0.5, 1.85, g.sp1, 0.45, 0.16], [0.3, 1.45, g.sp2, 0.75, 0.13]]) {
      const pts = arcPts([hx - W * 0.6, sd * W * y0], sd * a0, len, sd * turn, 8);
      k.poly(tube(spline(pts, 3), tap(W * w0, MA * 0.5)));
    }
    // feathery second antennae: a curved shaft with bristles on its trailing side
    const pts = arcPts([hx - W * 0.1, sd * W * 0.45], sd * 1.0, g.ant, sd * 1.2, 6);
    k.poly(tube(spline(pts, 3), tap(W * 0.14, MA * 0.5)));
    for (let j = 2; j < 6; j++) lf(k, pts[j], angOf(pts[j - 1], pts[j]) + sd * 1.3, W * 0.55, MA * 1.25, 0, 0.3);
  }
  bs.forEach((b, i) => { if (i % 2 === 0 || i === g.n >> 1) for (const sd of [-1, 1]) {
    const base = polar(b.p, sd * PI / 2, b.w * 0.6), a0 = sd * (PI / 2 + 0.2 + i * 0.05), L1 = W * mix(1.6, 0.8, i / g.n), e = polar(base, a0, L1);
    K.limb(base, a0, W * 0.4, i === 0 ? 'fore' : i === (g.n >> 1) ? 'mid' : i === g.n - 2 ? 'hind' : null, sd, () => {
      k.poly(tube([base, e], tap(Math.max(b.w * 0.35, MA * 0.9), MA * 0.5)));
      for (const u of [0.4, 0.75]) lf(k, lerp(base, e, u), a0 + sd * 0.8, L1 * 0.45, MA * 1.25, 0, 0.3);
    });
  } });
  const e = bs[bs.length - 1];
  lf(k, e.p, PI, W * 0.5, W * 0.2, 0, 0.3);
  return { view: 'top', r: W, path: axis(e.p[0], hx), rad: t => W * 0.5, head: { p: [hx - W * 0.1, 0], dir: 0, s: W * 0.45, bare: true, W: 0.5 }, tail: { p: e.p, dir: PI, s: W * 0.2 } };
};

//@@FORMS

// ---------------------------------------------------------------------------
// Gene helpers
// ---------------------------------------------------------------------------
const HEAD = (o = {}) => ({ type: 'arthropodHead', len: 1, wid: 0.9, ...o });
const ANT = (len, curve, o = {}) => ({ type: 'arthropodAntenna', len, curve, pair: true, ...o });
// the generic part of a limb gene: what another tag's body gets when it borrows our legs
const LEND = (r, o = {}) => ({ arthro: true, len: r.range(2.4, 3.2), w: r.range(0.26, 0.34), taper: 0.5, bend: r.range(0.9, 1.3), joints: 3, angular: true, foot: 'arthropodDactyl', toeLen: 0.8, lift: r.range(0.6, 0.9), stance: 0.6, arm: 0.9, kneeFlip: true, ...o });
const CLAWED = (r, o = {}) => LEND(r, { foreFoot: 'arthropodChela', clawS: r.range(0.9, 1.3), ...o });
function G(ch, o = {}) {
  const g = { chassis: { type: 'arthropodBody', ...ch }, head: o.head ?? HEAD(), limbs: o.limbs, tail: o.tail ?? none(), dorsal: o.dorsal ?? none(), crown: o.crown ?? none(), surface: { eyes: 'none' } };
  Object.defineProperty(g.chassis, 'root', { value: g, enumerable: false });
  if (ch.form === 'flyer' && g.dorsal.type === 'arthropodWings') Object.defineProperty(g.chassis, 'wings', { value: g.dorsal, enumerable: false });
  return g;
}
const UP = -PI / 2;

// ---------------------------------------------------------------------------
// SPECIES
// ---------------------------------------------------------------------------
const species = [
  { name: 'shore crab', w: 3, genes: r => { const W = r.range(17, 21); return G({ form: 'crab', rot: UP, shape: 'shore', W, D: W * r.range(0.6, 0.7), claw: W * r.range(0.5, 0.62), fat: r.range(0.42, 0.5), finger: r.range(0.75, 0.95), arm: W * r.range(0.42, 0.52), armA: r.range(0.75, 1.1), armW: W * 0.25, clawIn: r.range(0.25, 0.7), legL: W * r.range(1.05, 1.3), legW: W * 0.17, legTurn: r.range(0.55, 0.8), eyeGap: 0.75 },
    { head: HEAD({ stalk: r.range(0.3, 0.45) }), limbs: CLAWED(r), crown: none() }); } },
  { name: 'fiddler crab', w: 2, genes: r => { const W = r.range(14, 17); return G({ form: 'crab', rot: UP, shape: 'fiddler', W, D: W * r.range(0.62, 0.72), giant: r.sign(), claw: W * r.range(0.62, 0.72), fat: r.range(0.4, 0.46), finger: r.range(1.1, 1.4), arm: W * 0.42, armA: r.range(0.9, 1.1), armW: W * 0.24, clawIn: r.range(0.3, 0.6), legL: W * r.range(1.1, 1.3), legW: W * 0.16, legTurn: r.range(0.55, 0.8), eyeGap: 0.35 },
    { head: HEAD({ stalk: r.range(1.1, 1.5), stalkR: 0.22 }), limbs: CLAWED(r, { clawS: 1.5 }), crown: { type: 'arthropodStalk', len: r.range(1.2, 1.6), pair: true } }); } },
  { name: 'spider crab', w: 2, genes: r => { const W = r.range(10, 12.5); return G({ form: 'crab', rot: UP, shape: 'spider', W, D: W * r.range(1.15, 1.35), claw: W * r.range(0.5, 0.62), fat: 0.3, finger: 1.0, arm: W * r.range(1.1, 1.4), armA: r.range(0.7, 0.95), armW: W * 0.24, clawIn: r.range(0.2, 0.5), legL: W * r.range(2.9, 3.5), legW: W * 0.24, legTurn: r.range(0.45, 0.65), legFr: [0.4, 0.34, 0.3], eyeGap: 0.5 },
    { head: HEAD({ stalk: 0.3 }), limbs: CLAWED(r, { len: r.range(3.2, 4), w: 0.22 }), dorsal: { type: 'spines', n: r.int(4, 6), len: r.range(0.5, 0.8), wid: 0.4, lean: 0.2 } }); } },
  { name: 'lobster', w: 3, genes: r => { const Wc = r.range(6.5, 7.8), cray = r.chance(0.4); return G({ form: 'lobster', rot: 0, Lc: Wc * r.range(2.7, 3.1), Wc, rost: r.range(2, 4), big: r.sign(), arm1: r.range(7, 9), arm2: r.range(6, 8), armA: r.range(0.45, 0.8), armB: r.range(-0.1, 0.2), armW: Wc * 0.5, claw: Wc * (cray ? r.range(1.3, 1.6) : r.range(1.7, 2.1)), clawA: r.range(-0.25, 0.1), fat: cray ? 0.34 : r.range(0.4, 0.48), finger: r.range(0.75, 0.95), legL: Wc * r.range(1.8, 2.2), legW: Wc * 0.3 },
    { head: HEAD({ stalk: 0.3 }), limbs: CLAWED(r, { clawS: 1.3 }), crown: ANT(r.range(4.5, 7), r.range(0.4, 1.3), { w: 0.2 }), tail: TAIL('fan', { n: r.int(5, 6), seg: r.range(0.72, 0.85), arc: r.range(0, 0.25), end: 0.74, fanS: r.range(0.95, 1.15) }) }); } },
  { name: 'scorpion', w: 3, genes: r => { const W = r.range(6.5, 7.8); return G({ form: 'scorpion', rot: 0, W, n: 6, seg: r.range(2.9, 3.3), env: u => [1.02, 1.1, 1.1, 1.0, 0.86, 0.68][Math.floor(u * 6)], arm1: r.range(7, 9), arm2: r.range(6, 8), armA: r.range(0.9, 1.2), armB: r.range(0, 0.4), armW: 3.2, claw: r.range(9, 11.5), clawA: r.range(-0.5, -0.1), fat: r.range(0.34, 0.46), finger: r.range(0.9, 1.15), legL: r.range(14, 17), legW: 2.1, tailS: r.range(3.5, 4.1) },
    { head: HEAD({ mand: 0.35 }), limbs: CLAWED(r), tail: TAIL('sting', { arc: r.range(1.7, 2.5), arcSide: r.range(2.8, 3.3), seg: r.range(1.35, 1.6), up: true }) }); } },
  { name: 'pseudoscorpion', w: 1, genes: r => { const W = r.range(7, 8.5); return G({ form: 'scorpion', rot: 0, W, n: 5, seg: r.range(3, 3.5), env: u => [1.05, 1.2, 1.25, 1.1, 0.75][Math.floor(u * 5)], arm1: r.range(11, 14), arm2: r.range(9, 12), armA: r.range(0.9, 1.25), armB: r.range(0.1, 0.5), armW: 3, claw: r.range(10, 12), clawA: r.range(-0.6, -0.2), fat: 0.36, finger: r.range(1.1, 1.3), legL: r.range(11, 13), legW: 1.9, tailS: 3 },
    { head: HEAD({ mand: 0.3 }), limbs: CLAWED(r, { clawS: 1.4 }) }); } },
  { name: 'whip scorpion', w: 1, genes: r => { const W = r.range(6.5, 7.5); return G({ form: 'scorpion', rot: 0, W, n: 7, seg: 3, env: u => [1, 1.08, 1.1, 1.1, 1.04, 0.9, 0.66][Math.floor(u * 7)], arm1: r.range(5, 6), arm2: r.range(4, 5), armA: r.range(0.7, 1), armB: r.range(-0.5, -0.2), armW: 4, claw: r.range(5, 6), clawA: r.range(-1.1, -0.7), fat: 0.5, finger: 0.9, legL: r.range(14, 16), legW: 1.9, feeler: true, tailS: 2.6 },
    { head: HEAD({ mand: 0.3 }), limbs: CLAWED(r), tail: TAIL('whip', { len: r.range(9, 13) }) }); } },
  { name: 'orb spider', w: 3, genes: r => { const ab = r.range(10.5, 13), L = r.range(26, 31); return G({ form: 'spider', rot: r.pick([UP, UP, 0]), ceph: [4.4, 3.8], abd: [ab * r.range(1, 1.2), ab], abdPt: r.chance(0.25), legA: [0.45, 0.95, 1.75, 2.25], legT: [-0.55, -0.45, 0.5, 0.55], legL: [L, L * 0.92, L * 0.62, L * 0.9], legW: r.range(2.0, 2.3) },
    { head: HEAD({ palp: 0.9 }), limbs: LEND(r, { len: r.range(3, 3.8) }) }); } },
  { name: 'jumping spider', w: 2, genes: r => { const L = r.range(11, 13.5); return G({ form: 'spider', rot: r.pick([UP, 0]), ceph: [r.range(7.8, 8.8), r.range(6.8, 7.6)], box: true, abd: [r.range(6.5, 7.5), r.range(5, 5.8)], legA: [0.5, 1.1, 1.85, 2.35], legT: [-0.35, -0.3, 0.35, 0.4], legL: [L * 1.2, L * 0.95, L * 0.85, L * 1.05], legW: 3.6, legWk: [1.35, 1, 1, 1.05], legFr: [0.45, 0.3, 0.25] },
    { head: HEAD({ palp: 1.0, eye: 0.3 }), limbs: LEND(r, { len: 2, w: 0.4 }) }); } },
  { name: 'crab spider', w: 1.5, genes: r => { const L = r.range(21, 25); return G({ form: 'spider', rot: UP, ceph: [4.6, 5], abd: [r.range(6, 6.8), r.range(7, 8)], legA: [1.0, 1.4, 2.15, 2.6], legT: [-0.15, -0.1, 0.45, 0.55], legL: [L * 0.95, L * 0.9, L * 0.7, L * 0.7], legW: 3.0, legWk: [1.2, 1.15, 0.9, 0.9], legFr: [0.4, 0.4, 0.2] },
    { head: HEAD({ palp: 0.8 }), limbs: LEND(r) }); } },
  { name: 'harvestman', w: 1.5, genes: r => { const L = r.range(34, 42); return G({ form: 'spider', rot: r.pick([UP, 0]), ceph: [r.range(8, 9), r.range(6.8, 7.6)], abd: [0, 0], legA: [0.55, 1.15, 1.95, 2.55], legT: [-0.7, -0.6, 0.6, 0.7], legL: [L * 0.85, L * 1.1, L * 0.85, L], legW: 3.8, legFr: [0.36, 0.34, 0.3] },
    { head: HEAD({ palp: 0.7 }), limbs: LEND(r, { len: r.range(4, 5), w: 0.2 }) }); } },
  { name: 'tick', w: 1, genes: r => { const ab = r.range(9, 11); return G({ form: 'spider', rot: r.pick([UP, 0]), ceph: [2.6, 2.4], capit: true, abd: [ab * 1.3, ab], legA: [0.85, 1.25, 1.65, 2.05], legT: [-0.5, -0.3, 0.3, 0.5], legL: [13, 12, 12, 13].map(x => x * r.range(0.95, 1.1)), legW: 2.7, legFr: [0.45, 0.3, 0.25] },
    { head: HEAD({ palp: 1.1 }), limbs: LEND(r, { len: 1.6 }) }); } },
  { name: 'centipede', w: 3, genes: r => { const n = r.int(12, 15), Ll = r.range(8, 10); return G({ form: 'chain', rot: 0, len: n * r.range(3.9, 4.4), n, r: r.range(3, 3.6), wave: r.range(4, 8), env: t => 0.85 + 0.15 * ovalT(t), headS: 1.15, leg: (i, n) => ({ L: i === 0 ? Ll * 1.5 : Ll, w: 1.7, lean: i === 0 ? 1.1 : mix(0.5, -0.35, i / (n - 1)), turn: 0.45, fr: [0.55, 0.45], role: i === n - 2 ? 'fore' : i === 1 ? 'hind' : i === (n >> 1) ? 'mid' : null }) },
    { head: HEAD({ mand: 0.7, len: 1.1, wid: 0.95 }), limbs: LEND(r, { len: 2 }), crown: ANT(r.range(3, 4.2), r.range(0.4, 1), { style: r.pick(['whip', 'bead']), n: 8 }) }); } },
  { name: 'house centipede', w: 1.5, genes: r => { const n = r.int(9, 11), L0 = r.range(13, 16); return G({ form: 'chain', rot: 0, len: n * 3.6, n, r: r.range(2.8, 3.3), wave: r.range(1, 3), env: t => 0.8 + 0.2 * ovalT(t), headS: 1.2, leg: (i, n) => ({ L: L0 * mix(1.9, 1, i / (n - 1)), w: 1.5, lean: mix(0.95, -0.55, i / (n - 1)), turn: 0.35, fr: [0.36, 0.34, 0.3], role: i === n - 2 ? 'fore' : i === 1 ? 'hind' : null }) },
    { head: HEAD({ eye: 0.3 }), limbs: LEND(r, { len: 3.6, w: 0.2 }), crown: ANT(r.range(8, 11), r.range(0.5, 1.2), { w: 0.2 }) }); } },
  { name: 'silverfish', w: 1.5, genes: r => { const n = 10; return G({ form: 'chain', rot: 0, len: r.range(28, 33), n: 11, r: r.range(5, 5.8), wave: r.range(1, 3), env: t => (0.3 + 0.7 * Math.pow(t, 0.55)) * (t > 0.88 ? 1 - (t - 0.88) * 2 : 1), headS: 0.8, tailS: 1.5, leg: (i, n) => (i >= n - 4 && i < n - 1 ? { L: 8, w: 1.7, lean: mix(0.6, -0.4, (i - n + 4) / 2), turn: 0.4, fr: [0.55, 0.45], role: ['hind', 'mid', 'fore'][i - n + 4] } : null) },
    { head: HEAD({ len: 0.9, wid: 0.9 }), limbs: LEND(r, { len: 1.6 }), crown: ANT(r.range(4.5, 6.5), r.range(0.5, 1.1)), tail: TAIL('cerci', { n: 3, len: r.range(4, 5.5), splay: r.range(0.45, 0.7), fw: 0.4 }) }); } },
  { name: 'earwig', w: 2, genes: r => { const n = 9; return G({ form: 'chain', rot: 0, len: r.range(34, 40), n, r: r.range(3.8, 4.4), wave: r.range(0, 3), env: t => (t > 0.62 ? 1.05 : 0.8 + 0.3 * ovalT(t / 0.62)), headS: 0.95, tailS: 1.1, leg: (i, n) => (i >= n - 4 && i < n - 1 ? { L: 10, w: 1.9, lean: mix(0.7, -0.6, (i - n + 4) / 2), turn: 0.5, fr: [0.5, 0.5], role: ['hind', 'mid', 'fore'][i - n + 4] } : null) },
    { head: HEAD({ len: 1, wid: 0.95 }), limbs: LEND(r, { len: 1.8 }), crown: ANT(r.range(3, 4), r.range(0.3, 0.8), { style: 'bead', n: 8 }), tail: TAIL('forceps', { len: r.range(2.8, 3.8), bow: r.range(0.2, 0.42) }) }); } },
  { name: 'woodlouse', w: 2.5, genes: r => { const giant = r.chance(0.35), n = 7; return G({ form: 'plated', rot: 0, len: giant ? r.range(46, 52) : r.range(36, 42), W: giant ? r.range(11, 12.5) : r.range(10, 12), n, headL: giant ? 7 : 4.5, tailL: giant ? 11 : 5, headW: giant ? 0.8 : 0.62, env: t => 0.5 + 0.5 * Math.pow(ovalT(t), 0.6), sweep: 0.3, pt: giant ? 2 : 1.4, legL: giant ? 5 : 4.2, legW: 1.8, tailPts: giant },
    { head: HEAD({ eye: giant ? 0.3 : 0 }), limbs: LEND(r, { len: 1.5 }), crown: ANT(r.range(1.8, 2.6), 0.4, { style: 'elbow', elbow: 0.9, w: 0.24 }), tail: giant ? none() : TAIL('cerci', { n: 2, len: r.range(1.4, 2), splay: 0.5, fw: 0.5 }) }); } },
  { name: 'trilobite', w: 3, genes: r => {
    const v = r.wpick([[3, 'classic'], [2.5, 'spiny'], [1, 'wide']]), rot = r.pick([0, 0, UP]);
    const ch = v === 'classic' ? { len: r.range(40, 48), W: r.range(10, 11.5), n: r.int(9, 12), headL: r.range(9, 11), tailL: r.range(5, 7), headW: r.range(1.12, 1.25), env: u => 0.95 - 0.35 * u, sweep: 0.45, pt: r.range(1.4, 2.2), genal: r.range(7, 12), eyes: true }
      : v === 'spiny' ? { len: r.range(42, 50), W: r.range(9, 10.5), n: r.int(13, 16), headL: r.range(8, 10), tailL: r.range(2.5, 4), headW: r.range(1.2, 1.35), env: u => 0.95 - 0.55 * u, sweep: r.range(0.9, 1.4), pt: r.range(2.5, 4), genal: r.range(14, 22), genalOut: 0.12, pygSp: r.chance(0.5) ? r.range(4, 6) : 0, eyes: true }
      : { len: r.range(38, 44), W: r.range(12.5, 14), n: 8, headL: r.range(12, 14), tailL: r.range(11, 13), headW: 1.06, env: u => 0.98 - 0.06 * u, sweep: 0.3, pt: 1.0, genal: r.range(3, 6), tailW: 1.04, eyes: r.chance(0.5) };
    return G({ form: 'trilobite', rot, ...ch }, { head: HEAD(), limbs: LEND(r, { len: 1.6 }), crown: r.chance(0.3) ? ANT(r.range(1.6, 2.4), 0.5) : none() }); } },
  { name: 'stag beetle', w: 3, genes: r => { const We = r.range(8, 9.5); return G({ form: 'beetleTop', rot: r.pick([UP, UP, 0]), E: We * r.range(2.3, 2.7), We, P: r.range(6, 7.5), Wp: We * r.range(0.95, 1.08), prBase: 0.8, hs: We * r.range(0.62, 0.75), legA: [0.8, 1.75, 2.4], legT: [-0.7, 0.55, 0.5], legL: [15, 15, 17].map(x => x * r.range(0.95, 1.1)), legW: 2.6 },
    { head: HEAD({ len: 0.9, wid: 1.15 }), limbs: LEND(r), crown: { type: 'arthropodStag', len: r.range(2.2, 3.4), fork: r.chance(0.6), pair: true } }); } },
  { name: 'water strider', w: 1, genes: r => { const We = r.range(4.4, 5); return G({ form: 'beetleTop', rot: r.pick([UP, 0]), E: r.range(16, 19), We, P: 5, Wp: We * 1.25, hs: We * 0.95, endW: 0.6, legA: [0.45, 1.3, 2.3], legT: [-0.25, -0.2, 0.2], legL: [10, r.range(28, 34), r.range(24, 28)], legW: 3.6, legFr: [0.4, 0.6] },
    { head: HEAD({ len: 1.1, wid: 0.9, eye: 0.35 }), limbs: LEND(r, { len: 4, w: 0.18 }), crown: ANT(2.2, 0.3) }); } },
  { name: 'shrimp', w: 3, genes: r => { const rc = r.range(4.2, 5); return G({ form: 'shrimp', rc, Lc: rc * r.range(3.2, 3.8), n: 6, sl: rc * r.range(1.1, 1.3), T: r.range(2.0, 2.6), bend: u => [0.02, 0.12, 0.3, 0.32, 0.18, 0.06][Math.round(u * 5)], hump: r.range(0.6, 0.85), hang: 1.3, re: 0.55, plDeep: 1.15, fan: rc * r.range(1.15, 1.4), rost: rc * r.range(1.6, 2.6), rostUp: r.range(0.05, 0.35), teeth: r.int(3, 6), scale: rc * r.range(1.2, 1.6), legH: rc * r.range(1.9, 2.3), legL: rc * r.range(2.9, 3.4), legW: 1.8, tilt: r.range(-0.05, 0.08) },
    { head: HEAD({ stalk: r.range(0.35, 0.55), stalkR: 0.32 }), limbs: LEND(r, { len: 2.4, w: 0.2 }), crown: ANT(r.range(10, 15), r.range(2.4, 2.9), { style: 'sweep', w: 0.2, splaySide: r.range(0.9, 1.25) }) }); } },
  { name: 'praying mantis', w: 3, genes: r => { const ty = r.range(2, 2.4); return G({ form: 'insect', legH: r.range(6.5, 8), tx: 4.2, ty, neck: r.range(10, 13), neckA: r.range(0.75, 1.05), ax: r.range(19, 24), ay: ty * r.range(1.3, 1.6), aTilt: r.range(0.05, 0.25), aSegs: 7, aEnd: 0.4, hs: 3.1, hDir: 0.2, face: r.range(0.35, 0.75),
      legs: [{ kind: 'raptor', L: r.range(14, 17), w: 2.4, ca: r.range(0.8, 1.1), fa: r.range(-1.3, -0.8) }, { x: 0.3, ka: r.range(-0.05, 0.25), f: r.range(6, 8), tx: r.range(2, 4), w: 1.3 }, { x: -0.6, ka: PI - r.range(-0.05, 0.25), f: r.range(7, 9), tx: r.range(2, 4), w: 1.3 }] },
    { head: HEAD({ len: 1, wid: 1.0, tri: true, eye: 0.35, eyeX: 0.0, antGap: 0.6, splaySide: 0.9 }), limbs: CLAWED(r, { len: 2.6, w: 0.24 }), dorsal: WINGS('fold', r.range(5.5, 7), { at: 0.1, inset: 0.1, lift: r.range(0.02, 0.1) }), crown: ANT(r.range(4, 6), r.range(0.3, 0.9), { w: 0.18 }) }); } },
  { name: 'weevil', w: 2, genes: r => { const ay = r.range(6.5, 8); return G({ form: 'insect', legH: r.range(3, 4), tx: 3.4, ty: 3.2, ax: ay * r.range(1.9, 2.3), ay, aShape: 'elytra', aTilt: r.range(0.05, 0.25), belly: 0.5, hs: 2.8, hDir: 0.15, face: r.range(0.2, 0.45),
      legs: [{ x: 0.5, ka: 0.6, f: 4.5, tx: 2.6, w: 1.6 }, { x: -1.4, ka: 1.2, f: 3.5, tx: 0, w: 1.6 }, { x: -2.6, ka: PI - 0.6, f: 4.5, tx: 2.5, w: 1.6 }] },
    { head: HEAD({ len: 0.9, wid: 0.85, snout: r.range(3, 4.5), snoutDroop: r.range(0.6, 1.1) }), limbs: LEND(r, { len: 2 }), crown: ANT(r.range(3, 4), 0.4, { style: 'elbow', elbow: r.range(-1.6, -1.1), club: true, w: 0.22 }) }); } },
  { name: 'rhinoceros beetle', w: 2.5, genes: r => { const ay = r.range(7, 8.5); return G({ form: 'insect', legH: r.range(3.5, 4.5), tx: 4.5, ty: 4.2, pron: r.chance(0.6) ? 'horn' : 'hump', pHorn: r.range(0.8, 1.8), ax: ay * r.range(2.1, 2.4), ay, aShape: 'elytra', aTilt: r.range(0.0, 0.15), belly: 0.5, hs: 3.4, hDir: 0.3, face: 0.7,
      legs: [{ x: 0.5, ka: 0.5, f: 6, tx: 3.5, w: 2 }, { x: -1.2, ka: 1.0, f: 4.5, tx: 1.5, w: 2 }, { x: -2.4, ka: PI - 0.6, f: 6, tx: 3.5, w: 2 }] },
    { head: HEAD({ len: 0.8, wid: 0.9, splaySide: 1.0 }), limbs: LEND(r, { w: 0.4 }), crown: { type: 'arthropodHorn', len: r.range(2.4, 3.4), wid: 0.62, curve: r.range(0.9, 1.4), fork: r.chance(0.4) } }); } },
  { name: 'cicada', w: 2, genes: r => { const ty = r.range(4, 4.6); return G({ form: 'insect', legH: r.range(2.5, 3.5), tx: r.range(4.8, 5.6), ty, ax: r.range(10, 12), ay: ty * 0.95, aTilt: r.range(-0.15, 0.05), aProf: [[0, 4], [0.5, 4.2], [1, 1.8]], aSegs: 5, hs: 3.8, hDir: 0.1, face: r.range(0.35, 0.6),
      legs: [{ x: 0.6, ka: 0.7, f: 3.5, tx: 2, w: 1.7 }, { x: -0.1, ka: PI - 1.0, f: 3.5, tx: 2, w: 1.7 }, { x: -0.7, ka: PI - 0.7, f: 4.5, tx: 3, w: 1.7 }] },
    { head: HEAD({ len: 0.75, wid: 1.15, eye: 0.5, eyeX: 0.1, antGap: 0.3, splaySide: 0.6 }), limbs: LEND(r), dorsal: WINGS('roof', r.range(4.2, 5), { at: 0.95, inset: 0.4 }), crown: ANT(1.4, 0.3) }); } },
  { name: 'treehopper', w: 1.5, genes: r => { const ty = r.range(2.8, 3.2), kind = r.pick(['thorn', 'crescent', 'sail', 'globes']); const sh = r.pick(['hump', 'thorn', 'thorn']); return G({ form: 'insect', legH: r.range(2.5, 3.2), tx: 3.6, ty, ax: 7, ay: ty * 0.85, aTilt: 0, aProf: [[0, 2.6], [0.5, 2.6], [1, 1.2]], pron: 'shield', pShape: sh, pH: sh === 'thorn' ? r.range(7, 11) : r.range(3, 5), pX: sh === 'thorn' ? r.range(-0.2, 0.6) : r.range(-0.4, 0.3), hs: 3, hDir: 0.15, face: 0.7,
      legs: [{ x: 0.6, ka: 0.8, f: 3, tx: 1.5, w: 1.5 }, { x: -0.1, ka: PI - 1.0, f: 3, tx: 1.5, w: 1.5 }, { x: -0.7, ka: PI - 0.7, f: 4, tx: 2.5, w: 1.5 }] },
    { head: HEAD({ len: 0.7, wid: 1.0, eye: 0.35, antGap: 0.3, splaySide: 1.6 }), limbs: LEND(r), dorsal: WINGS('fold', r.range(3.2, 3.8), { at: 0.95, inset: 0.6, lift: 0.1 }), crown: ANT(1, 0.2) }); } },
  { name: 'stick insect', w: 1.5, genes: r => { const L = r.range(19, 23); return G({ form: 'insect', legH: r.range(4, 6), tx: r.range(7, 8.5), ty: 2.6, ax: L, ay: 2.5, aTilt: r.range(-0.02, 0.08), aProf: [[0, 2.4], [0.85, 2.2], [1, 1.3]], hs: 3, hDir: 0, face: 0.15,
      legs: [{ x: 0.95, ka: r.range(-0.4, -0.1), f: r.range(9, 12), tx: r.range(5, 8), w: 2.3 }, { x: 0, ka: r.range(-0.1, 0.3), f: r.range(8, 10), tx: 4, w: 2.3 }, { x: -0.9, ka: PI - r.range(-0.1, 0.3), f: r.range(9, 11), tx: 5, w: 2.3 }] },
    { head: HEAD({ len: 1.2, wid: 0.8, antGap: 0.4, splaySide: 0.3 }), limbs: LEND(r, { len: 4, w: 0.2 }), crown: ANT(r.range(4, 9), r.range(0.1, 0.4), { w: 0.18 }) }); } },
  { name: 'mantis shrimp', w: 2.5, genes: r => { const W = r.range(5.2, 6), smash = r.chance(0.5); return G({ form: 'stomatopod', rot: r.pick([0, 0, UP]), W, Lc: W * r.range(1.5, 1.8), sl: W * r.range(0.62, 0.72), wide: r.range(1.0, 1.15), tel: W * r.range(1.35, 1.6), uro: r.range(1.6, 1.9), eyeA: r.range(0.35, 0.6), eyeS: r.range(1.1, 1.4), rap: W * (smash ? r.range(1.35, 1.5) : r.range(1.2, 1.35)), smash, legW: 1.6 },
    { head: HEAD(), limbs: CLAWED(r), crown: ANT(r.range(3, 4.5), r.range(0.4, 0.9), { w: 0.22 }), tail: none() }); } },
  { name: 'sandhopper', w: 1.5, genes: r => { const rc = r.range(3.2, 3.8); return G({ form: 'shrimp', rc, Lc: rc * 1.1, n: 10, sl: rc * r.range(0.72, 0.85), T: r.range(2.6, 3.4), hump: r.range(0.35, 0.6), hang: 1.6, re: 0.55, a0: 1.0, plDeep: 1.5, segOv: 0.7, fan: rc * 0.55, fanSpread: 0.7, legH: rc * r.range(1.3, 1.7), legL: rc * 2.6, legW: 1.3, legs: 6, leg0: 0.3, leg1: 1.6, legFw: 0.5, legBk: 0.6, tilt: r.range(-0.1, 0.05) },
    { head: HEAD({ eye: 0.32 }), limbs: LEND(r, { len: 2.2, w: 0.2 }), crown: ANT(r.range(3.5, 5), r.range(0.6, 1.2), { w: 0.22, splaySide: r.range(0.3, 0.7) }) }); } },
  { name: 'hornworm', w: 1.5, genes: r => { const rr = r.range(3.6, 4.2), n = 12; return G({ form: 'worm', r: rr, n, sl: rr * 1.15, legH: 1.2, hump: rr * r.range(0.5, 1.5), ov: 0.72, env: t => 0.8 + 0.2 * Math.sin(PI * clamp(t * 1.2, 0, 1)), headL: 0.8, headW: 0.85, headDown: 0.7, horn: rr * r.range(2.2, 3), leg: (i, n) => (i >= n - 4 && i <= n - 2 ? 'true' : (i === 0 || (i >= 3 && i <= 6)) ? 'pro' : null) },
    { head: HEAD(), limbs: LEND(r, { len: 1.6 }), crown: none(), tail: TAIL('horn', { len: 2.4 }) }); } },
  { name: 'pill bug', w: 1, genes: r => G({ form: 'pillball', R: r.range(8.5, 10.5), n: r.int(8, 10), step: r.range(0.09, 0.13), a0: r.range(0.35, 0.7) },
    { head: HEAD(), limbs: LEND(r, { len: 1.4 }), crown: r.chance(0.6) ? ANT(r.range(2.4, 3.2), 0.4, { style: 'elbow', elbow: 0.9, w: 0.3, splaySide: 0.1 }) : none() }) },
  { name: 'hermit crab', w: 2.5, genes: r => G({ form: 'hermit', S: r.range(8, 9.5), lift: r.range(0.3, 1.2), whorls: r.int(2, 3), shrink: r.range(0.52, 0.66), spireA: r.range(0.55, 0.95), twist: r.range(0.05, 0.25), spire: r.chance(0.4) ? r.range(1.2, 2) : 0, bodyX: r.range(0.95, 1.15), tilt: r.range(-0.3, 0.1), claw: r.range(0.9, 1.25) },
    { head: HEAD({ stalk: r.range(0.9, 1.3), stalkR: 0.32 }), limbs: CLAWED(r), crown: ANT(r.range(5, 7), r.range(0.3, 0.9), { w: 0.2, splaySide: 0.4 }) }) },
  { name: 'horseshoe crab', w: 2, genes: r => { const Wp = r.range(14, 16); return G({ form: 'shield', kind: 'horseshoe', rot: 0, Lp: Wp * r.range(0.85, 1), Wp, Lo: Wp * r.range(0.7, 0.85), spine: r.range(1.8, 2.6), T: Wp * r.range(1.3, 1.7), tBend: r.range(-0.25, 0.25) },
    { head: HEAD(), limbs: LEND(r), crown: none() }); } },
  { name: 'triops', w: 1.5, genes: r => { const Wp = r.range(10, 12); return G({ form: 'shield', kind: 'triops', rot: 0, Lp: Wp * r.range(1.9, 2.2), Wp, A: Wp * r.range(1.1, 1.4), n: 9, T: Wp * r.range(1.1, 1.5), splay: r.range(0.15, 0.35) },
    { head: HEAD(), limbs: LEND(r), crown: none(), tail: TAIL('cerci', { n: 2, len: 4, splay: 0.3, fw: 0.3 }) }); } },
  { name: 'anomalocaris', w: 2.5, genes: r => { const W = r.range(6, 7); return G({ form: 'radiodont', kind: 'anomalocaris', rot: 0, L: W * r.range(5.5, 6.5), W, n: r.int(6, 7), flap: W * r.range(1.15, 1.35), blades: 3, blade: W * r.range(1.2, 1.5), arm: W * r.range(2.2, 2.7), armCurl: r.range(1.6, 2.2) },
    { head: HEAD(), limbs: LEND(r), crown: none(), tail: none() }); } },
  { name: 'opabinia', w: 1.5, genes: r => { const W = r.range(5, 5.8); return G({ form: 'radiodont', kind: 'opabinia', rot: 0, L: W * r.range(5.5, 6.5), W, n: r.int(6, 7), flap: W * r.range(0.95, 1.15), blades: 3, blade: W * r.range(1.3, 1.6), prob: W * r.range(1.8, 2.4) },
    { head: HEAD(), limbs: LEND(r), crown: none(), tail: none() }); } },
  { name: 'hallucigenia', w: 1.5, genes: r => G({ form: 'hallu', r: r.range(1.4, 1.7), L: r.range(30, 36), legH: r.range(8, 10), hump: r.range(0.5, 2.5), n: 7, spine: r.range(9, 12), legs: 7, headR: r.range(1.3, 1.7) },
    { head: HEAD(), limbs: LEND(r), crown: none() }) },
  { name: 'eurypterid', w: 2, genes: r => { const pt = r.chance(0.35), Wp = r.range(8, 9.5); return G({ form: 'eurypterid', rot: 0, Lp: Wp * r.range(1.3, 1.5), Wp, n: 12, pre: 7, sl: Wp * r.range(0.36, 0.42), telson: pt ? 'paddle' : 'spike', tel: Wp * (pt ? 1.0 : r.range(1.1, 1.4)), legL: Wp * 0.9, legW: 1.6, pad: Wp * r.range(0.75, 0.95), claws: pt ? Wp * r.range(0.9, 1.1) : 0 },
    { head: HEAD(), limbs: CLAWED(r), crown: none(), tail: TAIL('telson', { len: 2.5, fw: 0.4 }) }); } },
  { name: 'goose barnacle', w: 1.2, genes: r => G({ form: 'barnacle', kind: 'goose', count: r.wpick([[2, 1], [2, 2], [1, 3]]), h: r.range(9, 12), w: r.range(3, 3.8), cap: r.range(11, 13.5) },
    { head: HEAD({ splaySide: 0 }), limbs: { type: 'none' }, crown: { type: 'arthropodCirri', n: 6, len: r.range(3, 3.8), spread: 1.3, curl: r.range(1.6, 2.4), hand: r.sign() } }) },
  { name: 'acorn barnacles', w: 0.7, genes: r => G({ form: 'barnacle', kind: 'acorn', count: r.int(2, 4), cone: r.range(6, 7.5) },
    { head: HEAD({ splaySide: 0 }), limbs: { type: 'none' }, crown: { type: 'arthropodCirri', n: 6, len: r.range(3.6, 4.6), spread: 1.2, curl: r.range(1.6, 2.4), hand: r.sign() } }) },
  { name: 'slipper lobster', w: 1.2, genes: r => { const Wc = r.range(9, 10.5); return G({ form: 'lobster', rot: r.pick([0, UP]), noClaw: true, Lc: Wc * r.range(1.9, 2.2), Wc, rost: 0, legL: Wc * r.range(1.3, 1.6), legW: Wc * 0.25 },
    { head: HEAD({ stalk: 0.2 }), limbs: LEND(r), crown: { type: 'arthropodPlate', len: r.range(2.2, 2.8), pair: true }, tail: TAIL('fan', { n: 5, seg: r.range(0.55, 0.62), arc: r.range(0, 0.15), end: 0.8, fanS: r.range(0.75, 0.9) }) }); } },
  { name: 'antlion larva', w: 1.2, genes: r => { const We = r.range(9, 10.5); return G({ form: 'beetleTop', rot: r.pick([UP, 0]), E: We * r.range(1.4, 1.6), We, P: 3.5, Wp: We * 0.45, prBase: 0.9, hs: We * 0.42, endW: 0.45, legA: [0.9, 1.6, 2.2], legT: [-0.5, 0.5, 0.6], legL: [7, 7, 8], legW: 1.7, legFr: [0.5, 0.5] },
    { head: HEAD({ len: 0.9, wid: 1.1, antGap: 0.45 }), limbs: LEND(r, { len: 1.6 }), crown: { type: 'arthropodSickle', len: r.range(3, 3.8), wid: 0.32, splay: 0.05 } }); } },
  { name: 'crab zoea', w: 1, genes: r => G({ form: 'zoea', R: r.range(5.5, 6.5), dA: r.range(-0.15, 0.25), dS: r.range(12, 17), rA: r.range(0.1, 0.5), rS: r.range(8, 12), lat: r.chance(0.4) ? r.range(4, 6) : 0, aL: r.range(13, 16), aCurl: r.range(1.3, 2.2) },
    { head: HEAD(), limbs: LEND(r), crown: none() }) },
  { name: 'king crab', w: 2, genes: r => { const W = r.range(12, 14); return G({ form: 'crab', rot: UP, shape: 'king', W, D: W * r.range(0.95, 1.1), giant: r.chance(0.6) ? r.sign() : 0, claw: W * r.range(0.4, 0.5), fat: 0.36, finger: 0.8, arm: W * r.range(0.55, 0.7), armA: r.range(0.8, 1.1), armW: W * 0.26, clawIn: r.range(0.4, 0.8), legL: W * r.range(2.0, 2.4), legK: [1, 1.1, 1.0, 0.5], legW: W * 0.24, legTurn: r.range(0.5, 0.75), legSpk: true, eyeGap: 0.4 },
    { head: HEAD({ stalk: 0.25 }), limbs: CLAWED(r, { w: 0.36 }) }); } },
  { name: 'coconut crab', w: 2, genes: r => { const W = r.range(10, 11.5); return G({ form: 'crab', rot: UP, shape: 'oblong', W, D: W * r.range(1.05, 1.2), abd: r.range(0.75, 0.9), giant: r.chance(0.5) ? r.sign() : 0, claw: W * r.range(0.75, 0.9), fat: r.range(0.42, 0.5), finger: r.range(0.7, 0.85), arm: W * r.range(0.6, 0.75), armA: r.range(0.6, 0.85), armW: W * 0.34, clawIn: r.range(0.3, 0.6), legL: W * r.range(1.8, 2.1), legK: [1.15, 1.15, 1.0, 0.45], legW: W * 0.26, legTurn: r.range(0.55, 0.8), eyeGap: 0.4 },
    { head: HEAD({ stalk: r.range(0.4, 0.55) }), limbs: CLAWED(r, { w: 0.38 }), crown: ANT(r.range(3, 4.5), r.range(0.4, 0.9), { w: 0.24 }) }); } },
  { name: 'spiny lobster', w: 2, genes: r => { const Wc = r.range(7.5, 8.5); return G({ form: 'lobster', rot: 0, noClaw: true, spiny: true, antB: r.range(1.4, 1.7), Lc: Wc * r.range(2.3, 2.6), Wc, rost: 0, legL: Wc * r.range(1.6, 1.9), legW: Wc * 0.27 },
    { head: HEAD({ stalk: 0.25 }), limbs: LEND(r), crown: ANT(r.range(6, 8), r.range(0.2, 0.6), { w: 0.85, splay: 1.1 }), tail: TAIL('fan', { n: 6, seg: r.range(0.7, 0.8), arc: r.range(0, 0.2), end: 0.78, fanS: r.range(1.0, 1.15) }) }); } },
  { name: 'squat lobster', w: 1.5, genes: r => { const Wc = r.range(7.5, 8.5); return G({ form: 'lobster', rot: r.pick([0, UP]), spiny: r.chance(0.5), Lc: Wc * r.range(1.6, 1.8), Wc, rost: r.range(2, 3.5), big: 0, arm1: Wc * r.range(0.9, 1.15), arm2: Wc * r.range(0.8, 1.0), armA: r.range(0.75, 1.05), armB: r.range(-0.1, 0.25), armW: Wc * 0.42, claw: Wc * r.range(1.05, 1.25), clawA: r.range(-0.1, 0.25), fat: r.range(0.36, 0.42), finger: r.range(0.7, 0.85), legL: Wc * r.range(1.7, 2.0), legW: Wc * 0.26 },
    { head: HEAD({ stalk: 0.3 }), limbs: CLAWED(r), crown: ANT(r.range(3, 4.5), r.range(0.3, 0.9), { w: 0.2 }), tail: TAIL('fan', { n: 4, seg: r.range(0.55, 0.62), arc: r.range(0.2, 0.5), end: 0.8, fanS: r.range(0.7, 0.85) }) }); } },
  { name: 'whip spider', w: 1.5, genes: r => { const L = r.range(19, 23); return G({ form: 'spider', rot: r.pick([UP, UP, 0]), ceph: [r.range(5.5, 6.2), r.range(7.2, 8)], abd: [r.range(7.5, 8.5), r.range(5.8, 6.5)], abdSeg: 5, palps: r.range(13, 16), legA: [0.75, 1.35, 1.9, 2.4], legT: [-0.35, -0.2, 0.35, 0.45], legL: [L * 1.9, L, L * 1.05, L * 1.1], legW: 2.8, legWk: [0.6, 1, 1, 1], legFr: [0.4, 0.33, 0.27] },
    { head: HEAD({ palp: 0 }), limbs: LEND(r) }); } },
  { name: 'camel spider', w: 1.5, genes: r => { const L = r.range(18, 22); return G({ form: 'spider', rot: r.pick([UP, 0]), ceph: [r.range(6.5, 7.5), r.range(6.8, 7.6)], abd: [r.range(9.5, 11), r.range(4.6, 5.4)], abdPt: true, abdSeg: 6, chel: r.range(11, 13), chelW: 0.55, club: true, legA: [0.45, 1.1, 1.85, 2.4], legT: [-0.4, -0.3, 0.35, 0.45], legL: [L * 1.15, L * 0.9, L, L * 1.15], legW: 2.3, legWk: [1.25, 0.9, 1, 1.05], legFr: [0.4, 0.33, 0.27] },
    { head: HEAD({ palp: 0 }), limbs: LEND(r) }); } },
  { name: 'trident trilobite', w: 1.5, genes: r => G({ form: 'trilobite', rot: 0, len: r.range(40, 46), W: r.range(9, 10.5), n: r.int(11, 13), headL: r.range(9, 10.5), tailL: r.range(3, 4.5), headW: r.range(1.2, 1.3), env: u => 0.95 - 0.5 * u, sweep: r.range(0.8, 1.2), pt: r.range(2.4, 3.4), genal: r.range(14, 20), genalOut: 0.1, pygSp: r.range(3.5, 5), eyes: true, trident: r.range(11, 15) },
    { head: HEAD(), limbs: LEND(r, { len: 1.6 }) }) },
  { name: 'arthropleura', w: 1.5, genes: r => G({ form: 'plated', rot: UP, len: r.range(50, 58), W: r.range(5.5, 6.3), n: r.int(10, 12), headL: 5, tailL: 4, headW: 0.75, env: t => 0.6 + 0.4 * Math.pow(ovalT(t), 0.35), sweep: 0.45, pt: r.range(3.2, 4), legL: r.range(3.2, 4), stub: true, legW: 1.8, tailPts: false },
    { head: HEAD(), limbs: LEND(r, { len: 1.5 }), crown: ANT(r.range(2.2, 3), 0.4, { style: 'bead', n: 5, w: 0.3 }) }) },
  { name: 'marrella', w: 1.5, genes: r => G({ form: 'marrella', rot: 0, W: r.range(5, 5.8), L: r.range(25, 29), n: r.int(12, 14), sp1: r.range(18, 23), sp2: r.range(12, 15), ant: r.range(12, 15) },
    { head: HEAD(), limbs: LEND(r), crown: ANT(r.range(4, 5.5), r.range(0.2, 0.5), { w: 0.2 }) }) },
  //@@SPECIES
];

export default {
  id: 'arthropod', label: 'Crustaceans & arthropods', short: 'Arthropods',
  sig: { crown: 3, limbs: 3, tail: 2.5, dorsal: 1.2, head: 1 },
  species,
};
