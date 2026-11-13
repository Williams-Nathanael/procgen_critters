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
function jleg(k, pts, w0, w1 = w0 * 0.5) {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = Math.max(mix(w0, w1, i / n), MA), b = Math.max(mix(w0, w1, (i + 1) / n), MA), last = i === n - 1;
    k.poly(tube(polyline([pts[i], pts[i + 1]], 4), profile([[0, a * 0.46], [0.3, a * 0.56], [1, last ? Math.max(b * 0.34, MA * 0.36) : b * 0.44]])));
    if (i > 0) dot(k, pts[i], a * 0.56);
  }
}
// top-view leg: leaves `base` heading a0 and turns by `turn` at each joint
function tleg(k, base, a0, turn, L, w, fr = [0.42, 0.33, 0.27]) {
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
  for (let i = 0; i < n; i++) { const t = mix(t0, t1, (i + 0.5) / n), q = pathAt(path, t), w = rad(t); oval(k, q.p, seg * ov, w, q.ang); out.push({ p: q.p, ang: q.ang, w, t, seg }); }
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
      const L = g.len * s, bow = g.bow ?? 0.3;
      for (const sd of [-1, 1]) {
        const P = (x, y) => gy(polar(polar(e, ea, x * L), ea + sd * PI / 2, y), 0.4);
        tb(k, [P(-0.05, s * 0.4), P(0.5, s * 0.4 + L * bow), P(0.85, L * bow * 0.7), P(1, L * 0.05)], profile([[0, s * 0.34], [0.6, s * 0.22], [1, 0.25]]));
      }
      break;
    }
    case 'cerci': { // tapering segments (optional) ending in 2-3 long filaments
      let p = e, h = ea; const ns = g.segs ?? 0, sl = (g.seg ?? 0.9) * s, arc = (g.arc ?? 0) * sg;
      for (let i = 0; i < ns; i++) { h += arc / ns; const rr = s * mix(0.9, g.end ?? 0.45, i / Math.max(ns - 1, 1)), q = gy(polar(p, h, sl), rr); oval(k, lerp(p, q, 0.5), sl * 0.64, rr, angOf(p, q)); p = q; }
      const n = g.n ?? 2, L = g.len * s, w = Math.max(s * (g.fw ?? 0.3), MA * 1.3);
      for (let j = 0; j < n; j++) {
        const u = n > 1 ? j / (n - 1) - 0.5 : 0, da = side ? sg * (0.12 + j * (g.splay ?? 0.3)) : u * 2 * (g.splay ?? 0.3);
        const pts = arcPts(p, h + da, L * (1 - Math.abs(u) * (g.midLong ? 0.5 : 0)), side ? sg * 0.35 : u * 0.5).map(q => gy(q, 0.5));
        k.poly(tube(spline(pts, 3), tap(w / 2, MA * 0.4)));
      }
      break;
    }
    case 'telson': { const L = g.len * s; bar(k, [polar(e, ea, -s * 0.4), gy(polar(e, ea + (side ? sg * 0.15 : 0), L), 0.4)], tap(s * (g.fw ?? 0.42), 0.25)); break; }
    case 'whip': { const pts = arcPts(e, ea, g.len * s, (side ? 0.9 : 0.6) * sg).map(q => gy(q, 0.6)); k.poly(tube(spline(pts, 3), tap(Math.max(s * 0.2, MA * 0.6), MA * 0.4))); break; }
    case 'horn': tb(k, [polar(e, ea, -s * 0.3), polar(e, ea + sg * 0.6, s * 1.0), polar(e, ea + sg * 1.2, s * (g.len ?? 2))], profile([[0, s * 0.42], [1, 0.25]])); break;
  }
};
const TAIL = (kind, o = {}) => ({ len: 0.2, w0: 0.55, mid: 0.5, w1: 0.55, curl: 1, wave: 0, tip: 'arthropodTail', kind, ...o });

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
    case 'butterfly': if (sideV) { W(WING.bfF, 0.45); W(g.tails ? WING.bfT : WING.bfH, 0.45, 0.9); } else { W(WING.bfF, 0.05); W(g.tails ? WING.bfT : WING.bfH, 0, 0.92, 0.02); } break;
    case 'moth': if (sideV) { W(WING.moF, 0.75); } else { W(WING.moF, 0.3); W(WING.moH, 0.25, 0.95); } break;
    case 'mayfly': if (sideV) { W(WING.may, 0.12); W(WING.may, 0.75, 0.42, 0.12); } else { W(WING.may, 0.1); W(WING.may, 0.75, 0.45, 0.1); } break;
    case 'roof': W(WING.fly, sideV ? 1.32 : 1.2); if (sideV) W(WING.fly, 1.12, 0.9); break; // cicada / lacewing tent
    default: { W(WING.fly, sideV ? 0.95 : 0.7); if (g.hind) W(WING.fly, sideV ? 1.25 : 1.05, 0.72); else if (sideV) W(WING.fly, 0.72, 0.92); }
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
  const pl = FORMS[g.form](K, g), sideV = pl.view === 'side', tp = k.tf;
  const path = pl.path.map(tp), rad = pl.rad;
  const back = (pl.back ?? (sideV ? [strip(pl.path, rad, pl.b0 ?? 0.15, pl.b1 ?? 0.85, 12, -1)] : [strip(pl.path, rad, pl.b0 ?? 0.2, pl.b1 ?? 0.8, 8, -1), strip(pl.path, rad, pl.b0 ?? 0.2, pl.b1 ?? 0.8, 8, 1)]))
    .map(st => st.map(q => ({ p: tp(q.p), dir: q.dir + rot, t: q.t })));
  const h = pl.head, t = pl.tail;
  return {
    view: pl.view, r: pl.r, path, rad, back,
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
  } else symP(k, [[D * 0.8, 0], [D * 0.84, W * 0.14], [D * 0.74, W * 0.2], [D * 0.82, W * 0.3], [D * 0.58, W * 0.46], [D * 0.72, W * 0.62], [D * 0.38, W * 0.72], [D * 0.5, W * 0.88], [D * 0.14, W * 0.92], [D * 0.2, W * 1.06], [-D * 0.2, W * 0.98], [-D * 0.62, W * 0.76], [-D * 0.92, W * 0.46], [-D, W * 0.2], [-D, 0]]);
  for (const sd of [-1, 1]) {
    const big = g.giant ? (sd === g.giant ? 1.75 : 0.42) : 1, cs = g.claw * big;
    const sp = [D * 0.45, sd * W * 0.82];
    K.limb(sp, sd * 0.9, W * 0.42, 'fore', sd, () => {
      const a = arm(k, [D * 0.4, sd * W * 0.7], [[sd * (g.armA + (big > 1 ? 0.25 : 0)), g.arm * mix(1, big, 0.6)], [sd * 0.25, g.arm * 0.5 * mix(1, big, 0.5)]], g.armW * mix(1, big, 0.4));
      chela(k, a.p, -sd * g.clawIn * (big > 1 ? 1.5 : 1), cs, { flip: sd, fat: g.fat, finger: g.finger });
    });
    for (let i = 0; i < 4; i++) {
      const u = i / 3, base = [mix(D * 0.1, -D * 0.8, u), sd * W * mix(0.92, 0.5, u)], a0 = sd * (PI / 2 + mix(-0.28, 0.85, u));
      K.limb(base, a0, W * 0.4, i === 0 ? 'mid' : i === 3 ? 'hind' : null, sd, () => tleg(k, base, a0, sd * g.legTurn, g.legL * [0.95, 1.1, 1.05, 0.82][i], g.legW, g.legFr));
    }
  }
  return { view: 'top', r: D * 0.8, path: axis(-D, D * 0.8), rad: t => W * (0.55 + 0.45 * ovalT(t)), head: { p: [D * 0.78, 0], dir: 0, s: W * 0.36, bare: true, W: g.eyeGap }, tail: { p: [-D * 0.9, 0], dir: PI, s: W * 0.28 } };
};

// Lobster / crayfish: carapace + claws + walking legs; the abdomen and fan are the tail part.
FORMS.lobster = (K, g) => {
  const { k } = K, Lc = g.Lc, Wc = g.Wc * K.pl, x1 = Lc * 0.5, x0 = -Lc * 0.5;
  sym(k, [[x1 + g.rost, 0.4], [x1 - 1, Wc * 0.55], [x1 - Lc * 0.3, Wc * 0.95], [0, Wc], [x0 + 2, Wc * 0.92], [x0, Wc * 0.72], [x0 - 0.5, 0]]);
  for (const sd of [-1, 1]) {
    const big = g.big === sd ? 1.2 : 1;
    K.limb([x1 - Lc * 0.2, sd * Wc * 0.8], sd * 0.6, Wc * 0.85, 'fore', sd, () => {
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
  oval(k, [cx, 0], ca, cb * K.pl);
  if (aa > 0) { oval(k, [axc, 0], aa, ab * K.pl); if (g.abdPt) lf(k, [axc - aa * 0.6, 0], PI, aa * 0.9, ab * 1.1, 0, 0.3); }
  const back = aa > 0 ? axc - aa : -ca;
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a0 = sd * g.legA[i], base = polar([cx, 0], a0, Math.min(ca, cb) * 0.72);
    K.limb(base, a0, cb * 0.9, i === 0 ? 'fore' : i === 3 ? 'hind' : null, sd, () => tleg(k, base, a0, sd * g.legT[i], g.legL[i], g.legW * (g.legWk ? g.legWk[i] : 1), g.legFr));
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
      if (g.legL) { const base = [x, sd * w * 0.8]; K.limb(base, sd * (PI / 2 + 0.3), W * 0.5, i === n - 1 ? 'fore' : i === 0 ? 'hind' : i === (n >> 1) ? 'mid' : null, sd, () => jleg(k, [base, [x - 0.6, sd * (w + g.pt + g.legL * 0.55)], [x - 2.2, sd * (w + g.pt + g.legL)]], g.legW)); }
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
    { head: HEAD({ stalk: 0.3 }), limbs: CLAWED(r, { clawS: 1.3 }), crown: ANT(r.range(4.5, 7), r.range(0.4, 1.3), { w: 0.2 }), tail: TAIL('fan', { n: r.int(5, 6), seg: r.range(0.72, 0.85), arc: r.range(0, 0.6), end: 0.74, fanS: r.range(0.95, 1.15) }) }); } },
  { name: 'scorpion', w: 3, genes: r => { const W = r.range(6.5, 7.8); return G({ form: 'scorpion', rot: 0, W, n: 6, seg: r.range(2.9, 3.3), env: u => [1.02, 1.1, 1.1, 1.0, 0.86, 0.68][Math.floor(u * 6)], arm1: r.range(7, 9), arm2: r.range(6, 8), armA: r.range(0.9, 1.2), armB: r.range(0, 0.4), armW: 3.2, claw: r.range(9, 11.5), clawA: r.range(-0.5, -0.1), fat: r.range(0.34, 0.46), finger: r.range(0.9, 1.15), legL: r.range(14, 17), legW: 2.1, tailS: r.range(3.5, 4.1) },
    { head: HEAD({ mand: 0.35 }), limbs: CLAWED(r), tail: TAIL('sting', { arc: r.range(1.7, 2.5), arcSide: r.range(2.8, 3.3), seg: r.range(1.35, 1.6), up: true }) }); } },
  { name: 'pseudoscorpion', w: 1, genes: r => { const W = r.range(7, 8.5); return G({ form: 'scorpion', rot: r.pick([0, UP]), W, n: 5, seg: r.range(3, 3.5), env: u => [1.05, 1.2, 1.25, 1.1, 0.75][Math.floor(u * 5)], arm1: r.range(11, 14), arm2: r.range(9, 12), armA: r.range(0.9, 1.25), armB: r.range(0.1, 0.5), armW: 3, claw: r.range(10, 12), clawA: r.range(-0.6, -0.2), fat: 0.36, finger: r.range(1.1, 1.3), legL: r.range(11, 13), legW: 1.9, tailS: 3 },
    { head: HEAD({ mand: 0.3 }), limbs: CLAWED(r, { clawS: 1.4 }) }); } },
  { name: 'whip scorpion', w: 1, genes: r => { const W = r.range(6.5, 7.5); return G({ form: 'scorpion', rot: 0, W, n: 7, seg: 3, env: u => [1, 1.08, 1.1, 1.1, 1.04, 0.9, 0.66][Math.floor(u * 7)], arm1: r.range(5, 6), arm2: r.range(4, 5), armA: r.range(0.7, 1), armB: r.range(-0.5, -0.2), armW: 4, claw: r.range(5, 6), clawA: r.range(-1.1, -0.7), fat: 0.5, finger: 0.9, legL: r.range(14, 16), legW: 1.9, feeler: true, tailS: 2.6 },
    { head: HEAD({ mand: 0.3 }), limbs: CLAWED(r), tail: TAIL('whip', { len: r.range(9, 13) }) }); } },
  { name: 'orb spider', w: 3, genes: r => { const ab = r.range(8, 10.5), L = r.range(22, 27); return G({ form: 'spider', rot: r.pick([UP, UP, 0]), ceph: [5.2, 4.4], abd: [ab * r.range(1, 1.2), ab], abdPt: r.chance(0.25), legA: [0.5, 1.05, 2.0, 2.6], legT: [-0.55, -0.45, 0.45, 0.5], legL: [L, L * 0.92, L * 0.7, L * 0.95], legW: r.range(1.9, 2.3) },
    { head: HEAD({ palp: 0.9 }), limbs: LEND(r, { len: r.range(3, 3.8) }) }); } },
  { name: 'jumping spider', w: 2, genes: r => { const L = r.range(12, 15); return G({ form: 'spider', rot: r.pick([UP, 0]), ceph: [6.6, 6], abd: [r.range(6.5, 8), r.range(5, 6)], legA: [0.45, 1.0, 2.0, 2.6], legT: [-0.6, -0.5, 0.5, 0.55], legL: [L * 1.15, L * 0.9, L * 0.85, L], legW: 2.9, legWk: [1.35, 1, 1, 1] },
    { head: HEAD({ palp: 1.0, eye: 0.3 }), limbs: LEND(r, { len: 2, w: 0.4 }) }); } },
  { name: 'crab spider', w: 1.5, genes: r => { const L = r.range(19, 23); return G({ form: 'spider', rot: UP, ceph: [5, 5], abd: [r.range(6.5, 7.5), r.range(7.5, 9)], legA: [0.75, 1.3, 2.1, 2.65], legT: [-0.7, -0.65, 0.3, 0.4], legL: [L, L * 0.98, L * 0.5, L * 0.5], legW: 2.3, legWk: [1.2, 1.2, 0.85, 0.85] },
    { head: HEAD({ palp: 0.8 }), limbs: LEND(r) }); } },
  { name: 'harvestman', w: 1.5, genes: r => { const L = r.range(34, 42); return G({ form: 'spider', rot: r.pick([UP, 0]), ceph: [r.range(5, 6), r.range(4.4, 5.2)], abd: [0, 0], legA: [0.55, 1.15, 1.95, 2.55], legT: [-0.7, -0.6, 0.6, 0.7], legL: [L * 0.85, L * 1.1, L * 0.85, L], legW: 1.7, legFr: [0.36, 0.34, 0.3] },
    { head: HEAD({ palp: 0.7 }), limbs: LEND(r, { len: r.range(4, 5), w: 0.2 }) }); } },
  { name: 'tick', w: 1, genes: r => { const ab = r.range(8, 10); return G({ form: 'spider', rot: r.pick([UP, 0]), ceph: [3, 3.4], abd: [ab * 1.15, ab], legA: [0.6, 1.2, 1.9, 2.5], legT: [-0.6, -0.5, 0.5, 0.6], legL: [10, 10, 10, 11].map(x => x * r.range(0.95, 1.1)), legW: 2.2 },
    { head: HEAD({ palp: 1.1 }), limbs: LEND(r, { len: 1.6 }) }); } },
  { name: 'centipede', w: 3, genes: r => { const n = r.int(13, 18), Ll = r.range(8, 10); return G({ form: 'chain', rot: 0, len: n * r.range(3.9, 4.4), n, r: r.range(3, 3.6), wave: r.range(4, 8), env: t => 0.85 + 0.15 * ovalT(t), headS: 1.15, leg: (i, n) => ({ L: i === 0 ? Ll * 1.5 : Ll, w: 1.7, lean: i === 0 ? 1.1 : mix(0.5, -0.35, i / (n - 1)), turn: 0.45, fr: [0.55, 0.45], role: i === n - 2 ? 'fore' : i === 1 ? 'hind' : i === (n >> 1) ? 'mid' : null }) },
    { head: HEAD({ mand: 0.7, len: 1.1, wid: 0.95 }), limbs: LEND(r, { len: 2 }), crown: ANT(r.range(3, 4.2), r.range(0.4, 1), { style: r.pick(['whip', 'bead']), n: 8 }) }); } },
  { name: 'house centipede', w: 1.5, genes: r => { const n = r.int(9, 11), L0 = r.range(13, 16); return G({ form: 'chain', rot: 0, len: n * 3.6, n, r: r.range(2.8, 3.3), wave: r.range(1, 3), env: t => 0.8 + 0.2 * ovalT(t), headS: 1.2, leg: (i, n) => ({ L: L0 * mix(1.9, 1, i / (n - 1)), w: 1.5, lean: mix(0.95, -0.55, i / (n - 1)), turn: 0.35, fr: [0.36, 0.34, 0.3], role: i === n - 2 ? 'fore' : i === 1 ? 'hind' : null }) },
    { head: HEAD({ eye: 0.3 }), limbs: LEND(r, { len: 3.6, w: 0.2 }), crown: ANT(r.range(8, 11), r.range(0.5, 1.2), { w: 0.2 }) }); } },
  { name: 'silverfish', w: 1.5, genes: r => { const n = 10; return G({ form: 'chain', rot: 0, len: r.range(34, 40), n, r: r.range(5, 6), wave: r.range(1, 4), env: t => 0.3 + 0.7 * Math.pow(t, 0.7) * (t > 0.85 ? 1 - (t - 0.85) * 1.2 : 1), headS: 0.8, tailS: 1.5, leg: (i, n) => (i >= n - 4 && i < n - 1 ? { L: 8, w: 1.7, lean: mix(0.6, -0.4, (i - n + 4) / 2), turn: 0.4, fr: [0.55, 0.45], role: ['hind', 'mid', 'fore'][i - n + 4] } : null) },
    { head: HEAD({ len: 0.9, wid: 0.9 }), limbs: LEND(r, { len: 1.6 }), crown: ANT(r.range(4.5, 6.5), r.range(0.5, 1.1)), tail: TAIL('cerci', { n: 3, len: r.range(7, 10), splay: r.range(0.5, 0.75), fw: 0.4 }) }); } },
  { name: 'earwig', w: 2, genes: r => { const n = 9; return G({ form: 'chain', rot: 0, len: r.range(34, 40), n, r: r.range(3.8, 4.4), wave: r.range(0, 3), env: t => (t > 0.62 ? 1.05 : 0.8 + 0.3 * ovalT(t / 0.62)), headS: 0.95, tailS: 1.1, leg: (i, n) => (i >= n - 4 && i < n - 1 ? { L: 10, w: 1.9, lean: mix(0.7, -0.6, (i - n + 4) / 2), turn: 0.5, fr: [0.5, 0.5], role: ['hind', 'mid', 'fore'][i - n + 4] } : null) },
    { head: HEAD({ len: 1, wid: 0.95 }), limbs: LEND(r, { len: 1.8 }), crown: ANT(r.range(3, 4), r.range(0.3, 0.8), { style: 'bead', n: 8 }), tail: TAIL('forceps', { len: r.range(2.8, 3.8), bow: r.range(0.2, 0.42) }) }); } },
  { name: 'woodlouse', w: 2.5, genes: r => { const giant = r.chance(0.35), n = 7; return G({ form: 'plated', rot: 0, len: giant ? r.range(46, 52) : r.range(36, 42), W: giant ? r.range(11, 12.5) : r.range(10, 12), n, headL: giant ? 7 : 4.5, tailL: giant ? 11 : 5, headW: giant ? 0.8 : 0.62, env: t => 0.5 + 0.5 * Math.pow(ovalT(t), 0.6), sweep: 0.3, pt: giant ? 2 : 1.4, legL: giant ? 5 : 4.2, legW: 1.8, tailPts: giant },
    { head: HEAD({ eye: giant ? 0.3 : 0 }), limbs: LEND(r, { len: 1.5 }), crown: ANT(r.range(1.8, 2.6), 0.4, { style: 'elbow', elbow: 0.9, w: 0.24 }), tail: giant ? none() : TAIL('cerci', { n: 2, len: r.range(1.4, 2), splay: 0.5, fw: 0.5 }) }); } },
  { name: 'trilobite', w: 3, genes: r => { const v = r.pick(['plain', 'spiny', 'long', 'wide']), n = v === 'wide' ? 8 : r.int(9, 12); return G({ form: 'plated', rot: r.pick([0, 0, UP]), len: v === 'wide' ? r.range(40, 46) : r.range(44, 52), W: v === 'wide' ? r.range(13, 15) : r.range(10.5, 12.5), n, headL: v === 'wide' ? 12 : r.range(9, 11), tailL: v === 'wide' ? 11 : r.range(5, 8), headW: v === 'wide' ? 1.02 : r.range(1.08, 1.2), env: t => 0.42 + 0.6 * Math.pow(ovalT(clamp(t * 0.8 + 0.2, 0, 1)), 0.7), sweep: v === 'spiny' ? 1.1 : 0.35, pt: v === 'spiny' ? r.range(4, 6) : v === 'wide' ? 0.6 : r.range(1.4, 2.4), genal: v === 'wide' ? 0 : v === 'plain' ? r.range(5, 9) : r.range(14, 24), genalIn: r.range(0.9, 1.08), tailW: v === 'wide' ? 1.05 : 0.9 },
    { head: HEAD({ eye: 0.22 }), limbs: LEND(r, { len: 1.6 }), crown: r.chance(0.35) ? ANT(r.range(1.6, 2.4), 0.5) : none(), tail: v === 'long' ? TAIL('telson', { len: r.range(4, 7), fw: 0.5 }) : none() }); } },
  { name: 'stag beetle', w: 3, genes: r => { const We = r.range(8, 9.5); return G({ form: 'beetleTop', rot: r.pick([UP, UP, 0]), E: We * r.range(2.3, 2.7), We, P: r.range(6, 7.5), Wp: We * r.range(0.95, 1.08), prBase: 0.8, hs: We * r.range(0.62, 0.75), legA: [0.8, 1.75, 2.4], legT: [-0.7, 0.55, 0.5], legL: [15, 15, 17].map(x => x * r.range(0.95, 1.1)), legW: 2.6 },
    { head: HEAD({ len: 0.9, wid: 1.15 }), limbs: LEND(r), crown: { type: 'arthropodStag', len: r.range(2.2, 3.4), fork: r.chance(0.6), pair: true } }); } },
  { name: 'longhorn beetle', w: 2, genes: r => { const We = r.range(5.6, 6.6); return G({ form: 'beetleTop', rot: r.pick([UP, 0]), E: We * r.range(3.6, 4.4), We, P: r.range(5, 6), Wp: We * 0.82, prBase: 0.85, hs: We * 0.7, endW: 0.5, legA: [0.85, 1.7, 2.35], legT: [-0.55, 0.5, 0.45], legL: [13, 14, 17], legW: 2.1 },
    { head: HEAD({ len: 0.9, wid: 0.9, splay: 0.9 }), limbs: LEND(r), crown: ANT(r.range(9, 12), r.range(1.6, 2.3), { w: 0.34 }) }); } },
  { name: 'ladybird', w: 2, genes: r => { const We = r.range(10, 11.5); return G({ form: 'beetleTop', rot: r.pick([UP, 0]), E: We * r.range(1.75, 1.95), We, P: 3.4, Wp: We * 0.72, prBase: 1.1, hs: We * 0.36, endW: 0.62, legA: [0.75, 1.65, 2.4], legT: [-0.5, 0.5, 0.5], legL: [7.5, 8, 8], legW: 1.9, legFr: [0.5, 0.5] },
    { head: HEAD({ len: 0.8, wid: 1 }), limbs: LEND(r, { len: 1.5 }), crown: ANT(r.range(1.5, 2), 0.5, { club: true, w: 0.3 }) }); } },
  { name: 'water strider', w: 1, genes: r => { const We = r.range(2.4, 2.9); return G({ form: 'beetleTop', rot: r.pick([UP, 0]), E: r.range(16, 19), We, P: 5, Wp: We * 1.25, hs: We * 0.95, endW: 0.6, legA: [0.45, 1.3, 2.3], legT: [-0.25, -0.2, 0.2], legL: [10, r.range(28, 34), r.range(24, 28)], legW: 1.6, legFr: [0.4, 0.6] },
    { head: HEAD({ len: 1.1, wid: 0.9, eye: 0.35 }), limbs: LEND(r, { len: 4, w: 0.18 }), crown: ANT(2.2, 0.3) }); } },
  { name: 'giant water bug', w: 1, genes: r => { const We = r.range(9, 10.5); return G({ form: 'beetleTop', rot: r.pick([UP, 0]), E: We * r.range(2.3, 2.6), We, P: 5.5, Wp: We * 0.82, prBase: 1.05, hs: We * 0.42, endW: 0.45, raptor: true, legA: [0.6, 1.8, 2.45], legT: [-0.5, 0.45, 0.4], legL: [16, 12, 14], legW: 2.6, legFr: [0.5, 0.5] },
    { head: HEAD({ len: 0.9, wid: 0.95, eye: 0.42 }), limbs: CLAWED(r, { len: 2 }), tail: TAIL('telson', { len: 1.8, fw: 0.4 }) }); } },
  { name: 'dragonfly', w: 3, genes: r => { const dam = r.chance(0.35); return G({ form: 'flyer', rot: UP, tx: dam ? 4 : 5, ty: dam ? 2.6 : 3.6, ab: dam ? r.range(27, 32) : r.range(24, 29), ar: dam ? 1.5 : 2.3, amid: 0.75, aend: dam ? 1.2 : 1.6, R: 7, hs: dam ? 2.6 : 3.4 },
    { head: HEAD({ len: 0.9, wid: 1.05, eye: dam ? 0.5 : 0.62, eyeX: 0.05 }), limbs: LEND(r), dorsal: WINGS('dragonfly', dam ? r.range(3.6, 4.2) : r.range(3.9, 4.6), { at: 0.6, inset: 0.1 }), tail: r.chance(0.5) ? TAIL('cerci', { n: 2, len: 1.6, splay: 0.4, fw: 0.5 }) : none() }); } },
  { name: 'butterfly', w: 3, genes: r => G({ form: 'flyer', rot: UP, tx: 4.2, ty: 2.8, ab: r.range(11, 14), ar: 2.4, amid: 0.9, aend: 1.1, R: 7, hs: 2.6 },
    { head: HEAD({ len: 0.9, wid: 1, eye: 0.4 }), limbs: LEND(r), dorsal: WINGS('butterfly', r.range(3.2, 4), { at: 0.6, inset: 0.1, tails: r.chance(0.4) }), crown: ANT(r.range(3.6, 4.6), r.range(-0.5, 0.3), { club: true, w: 0.3 }) }) },
  { name: 'moth', w: 2, genes: r => G({ form: 'flyer', rot: UP, tx: 5.5, ty: 4.6, ab: r.range(10, 13), ar: 4.2, amid: 0.95, aend: 1.6, R: 7.5, hs: 3.4 },
    { head: HEAD({ len: 0.8, wid: 1, eye: 0.35 }), limbs: LEND(r), dorsal: WINGS('moth', r.range(3.3, 3.9), { at: 0.65, inset: 0.3 }), crown: ANT(r.range(2.4, 3), r.range(0.2, 0.6), { style: 'feather', plume: r.range(0.26, 0.36) }) }) },
  { name: 'crane fly', w: 1.5, genes: r => { const L = r.range(24, 30); return G({ form: 'flyer', rot: UP, tx: 4, ty: 3, ab: r.range(15, 19), ar: 1.9, amid: 0.9, aend: 1.3, R: 7, hs: 2.4, legL: [L, L * 1.1, L * 1.2], legW: 1.5, legA: [0.55, 1.75, 2.55], legFr: [0.36, 0.36, 0.3] },
    { head: HEAD({ len: 0.9, wid: 0.9, eye: 0.35 }), limbs: LEND(r, { len: 4.2, w: 0.18 }), dorsal: WINGS('fly', r.range(3.4, 4), { at: 0.6, inset: 0.1 }), crown: ANT(1.6, 0.4) }); } },
  { name: 'fly', w: 1.5, genes: r => G({ form: 'flyer', rot: UP, tx: 5.5, ty: 4.6, ab: r.range(7, 9), ar: 4.6, amid: 1.05, aend: 2, R: 7, hs: 4, legL: [9, 9, 11], legW: 1.7, legFr: [0.5, 0.5] },
    { head: HEAD({ len: 0.8, wid: 1.05, eye: 0.55, eyeX: 0.1 }), limbs: LEND(r, { len: 1.8 }), dorsal: WINGS('fly', r.range(2.6, 3.1), { at: 0.65, inset: 0.3 }), crown: ANT(1, 0.3) }) },
  //@@SPECIES
];

export default {
  id: 'arthropod', label: 'Crustaceans & arthropods', short: 'Arthropods',
  sig: { crown: 3, limbs: 3, tail: 2.5, dorsal: 1.2, head: 1 },
  species,
};
