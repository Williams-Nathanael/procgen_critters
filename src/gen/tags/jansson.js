// Margin folk: an ORIGINAL cast of small storybook marginalia creatures in the Nordic
// picture-book tradition (round low bodies, big ringed eyes, tiny hands and feet, tufts,
// tasselled tails, small props, huddles and processions), plus a family of "word-creatures":
// stray handwriting come alive (pen-stroke loops, hooks, ascenders and ball terminals on
// little tick legs). Nothing here depicts an existing character; the forms are invented.
import { add, lerp, angOf, polar, clamp, mix, MINW, frame, spline, polyline, profile, pathAt, tube, leaf } from '../core.js';
import { chassis, heads, feet, tips, crowns, dorsals } from '../parts.js';

const PI = Math.PI;
const none = () => ({ type: 'none' });

// =====================================================================
// helpers
// =====================================================================
const stroke = (ink, pts, w, per = 6) => ink.poly(tube(spline(pts, per), Math.max(w, MINW) / 2));
const bar = (ink, a, b, w) => ink.poly(tube(polyline([a, b], 3), Math.max(w, MINW) / 2));

// Broad-nib pen stroke: width swells and thins with stroke direction, like handwriting.
function pen(ink, pts, w, { con = 0.5, nib = 0.5, t0 = 1, t1 = 1, per = 6 } = {}) {
  const path = spline(pts, per), n = path.length;
  let R = [];
  for (let i = 0; i < n; i++) {
    const a = angOf(path[Math.max(i - 2, 0)], path[Math.min(i + 2, n - 1)]), u = i / (n - 1);
    const end = (u < 0.18 ? mix(t0, 1, u / 0.18) : 1) * (u > 0.82 ? mix(1, t1, (u - 0.82) / 0.18) : 1);
    R.push(Math.max(w / 2 * mix(1 - con, 1, Math.abs(Math.sin(a - nib))) * end, 0.5));
  }
  for (let k = 0; k < 3; k++) R = R.map((r, i) => (R[Math.max(i - 1, 0)] + 2 * r + R[Math.min(i + 1, n - 1)]) / 4);
  ink.poly(tube(path, R));
  return path;
}

function rrect(x, y, w, h, r) {
  const out = [], cs = [[x + w - r, y + r, -PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, PI / 2], [x + r, y + r, PI]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= 4; i++) out.push([cx + Math.cos(a0 + i * PI / 8) * r, cy + Math.sin(a0 + i * PI / 8) * r]);
  return out;
}

// dome with a flat bottom sitting exactly on y = yb
function dome(ink, cx, yb, rx, ry, n = 14) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = PI + i / n * PI; pts.push([cx + Math.cos(a) * rx, yb + Math.sin(a) * ry]); }
  ink.poly(pts);
}

// Soft upright body: half-width profile over height, rounded ends, optional forward lean.
const SHAPES = {
  lump: [[0, 0.92], [0.3, 1], [0.7, 0.9], [1, 0.72]],
  pear: [[0, 0.95], [0.25, 1], [0.62, 0.62], [1, 0.5]],
  tall: [[0, 0.85], [0.18, 1], [0.6, 0.8], [1, 0.62]],
  bell: [[0, 1], [0.2, 0.92], [0.65, 0.6], [1, 0.5]],
  egg: [[0, 0.8], [0.4, 1], [1, 0.74]],
  drop: [[0, 0.9], [0.28, 1], [0.7, 0.6], [1, 0.3]],
  squat: [[0, 1], [0.45, 1.06], [1, 0.95]],
  cone: [[0, 1], [0.35, 0.82], [1, 0.42]],
  gourd: [[0, 1], [0.32, 0.95], [0.55, 0.62], [0.78, 0.74], [1, 0.6]],
  sack: [[0, 0.7], [0.3, 0.86], [0.7, 1.04], [1, 0.95]],
};
function body({ x = 0, y0 = 0, h, w, keys, lean = 0, tb = 0.3, tt = 0.4, n = 24 }) {
  const pf = profile(keys);
  const wid = t => w * pf(t) * (t < tb ? Math.sqrt(Math.max(1 - (1 - t / tb) ** 2, 0)) : 1) * (t > 1 - tt ? Math.sqrt(Math.max(1 - ((t - 1 + tt) / tt) ** 2, 0)) : 1);
  const cx = t => x + lean * h * t * t;
  const at = (t, sd, k = 1) => [cx(t) + sd * wid(t) * k, y0 - h * t];
  const L = [], R = [];
  for (let i = 0; i <= n; i++) { const t = (1 - Math.cos(PI * i / n)) / 2; L.push(at(t, -1)); R.push(at(t, 1)); }
  return { pts: L.concat(R.reverse()), wid, cx, at, h, w, y0, x, c: t => [cx(t), y0 - h * t] };
}
function sideStrip(B, t0 = 0.18, t1 = 0.86, n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = mix(t0, t1, i / (n - 1)); out.push({ p: B.at(t, -1), dir: angOf(B.at(t - 0.03, -1), B.at(t + 0.03, -1)) - PI / 2, t }); }
  return out;
}
function arcStrip(c, rx, ry, a0, a1, n = 8) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = mix(a0, a1, i / (n - 1)); out.push({ p: [c[0] + Math.cos(a) * rx * 0.9, c[1] + Math.sin(a) * ry * 0.9], dir: a, t: i / (n - 1) }); }
  return out;
}
// fur along both flanks; `down` (0..1) turns the strands from bristling outward to hanging
// like a shaggy thatch, `nj` strands per side
function fuzzEdge(C, B, len, down = 0, nj = 11) {
  const { ink, rng } = C, c = B.c(0.5);
  for (const sd of [-1, 1]) for (let j = 0; j < nj; j++) {
    const t = mix(down ? 0.06 : 0.1, 0.97, j / (nj - 1)), p = B.at(t, sd, 0.9), ao = angOf(c, p);
    const a = ao + (((PI / 2 + sd * 0.35 - ao + 3 * PI) % (2 * PI)) - PI) * down * (0.55 + 0.45 * t);
    ink.poly(leaf(p, a + rng.range(-0.2, 0.2), len * rng.range(0.8, 1.3) * (down ? 0.75 + 0.6 * t : 1), len * 0.62, rng.range(-0.15, 0.15), 0.3));
  }
  ink.poly(leaf(B.c(0.95), -PI / 2 + rng.range(-0.25, 0.25), len * 1.3, len * 0.62, 0, 0.3));
}
// frontal pair of big eyes on a body at height t
function frontEyes(B, t, k = 1, shift = 0.07) {
  const wd = B.wid(t), cx = B.cx(t) + wd * shift, y = B.y0 - B.h * t, Rw = Math.max(wd * 0.24 * k, 1.1);
  return [-1, 1].map(sd => ({ p: [cx + sd * wd * 0.44, y], r: Rw / 1.5 }));
}
const topMounts = (B, s, t = 0.9) => [-1, 1].map(sd => ({ p: B.at(t, sd, 0.6), dir: -PI / 2 + sd * 0.4, flip: sd, s }));

// little chassis-drawn ornaments for huddles (which have many heads but only one crown slot)
function tinyTop(C, B, kind) {
  const { ink, rng } = C, w = B.w, top = B.c(0.97);
  if (kind === 'point') for (const sd of [-1, 1]) ink.poly(leaf(B.at(0.86, sd, 0.6), -PI / 2 + sd * 0.35, w * 0.95, w * 0.5, 0, 0.35));
  else if (kind === 'round') for (const sd of [-1, 1]) ink.dot(add(B.at(0.93, sd, 0.85), [0, -w * 0.12]), w * 0.3);
  else if (kind === 'hair') { const n = rng.int(1, 3); for (let i = 0; i < n; i++) { const a = -PI / 2 + (i - (n - 1) / 2) * 0.55 + rng.range(-0.15, 0.15), m = polar(top, a, w * 0.6); ink.line([top, m, polar(m, a + rng.range(-1, 1), w * 0.45)], 0.95); } }
  else if (kind === 'long') for (const sd of [-1, 1]) ink.poly(leaf(B.at(0.88, sd, 0.5), -PI / 2 + sd * rng.range(0.1, 0.35), w * 1.7, w * 0.5, sd * 0.08, 0.5));
  else if (kind === 'cap') { ink.poly(tube(spline([B.c(0.86), add(top, [-w * 0.1, -w * 0.6]), add(top, [-w * 0.45, -w * 1.25])], 6), profile([[0, B.wid(0.86) * 1.02], [0.4, w * 0.45], [1, 0.6]]))); ink.dot(add(top, [-w * 0.45, -w * 1.25]), Math.max(w * 0.2, 1)); }
}
function tinyFeet(ink, B, k = 1) { for (const sd of [-1, 1]) dome(ink, B.x + sd * B.w * 0.42 + B.w * 0.1, 0, B.w * 0.36 * k, B.w * 0.24 * k); }
// a complete tiny lump-creature drawn by a chassis; pushes its eyes into `eyes`
function lumpling(C, eyes, o) {
  const { ink } = C;
  const B = body({ x: o.x, y0: o.y0 ?? 0, h: o.h, w: o.w, keys: SHAPES[o.shape ?? 'lump'], lean: o.lean ?? 0, tb: o.tb ?? 0.3, tt: o.tt ?? 0.42 });
  ink.poly(B.pts);
  const eT = o.eT ?? 0.68;
  if (o.look === 'side') {
    const wd = B.wid(eT), y = B.y0 - B.h * eT, Rw = Math.max(wd * 0.42, 1.4);
    eyes.push({ p: [B.cx(eT) + wd * 0.3, y], r: Rw / 2.2 });
    const n0 = [B.cx(eT) + wd * 0.5, y + wd * 0.5], nl = (o.nose ?? 0.5) * o.w;
    ink.poly(tube(spline([n0, add(n0, [wd * 0.5 + nl * 0.5, nl * 0.08]), add(n0, [wd * 0.5 + nl, nl * 0.22])], 5), profile([[0, wd * 0.42], [1, Math.max(wd * 0.2, 0.75)]])));
  } else if (o.look !== 'back') eyes.push(...frontEyes(B, eT, o.eyeK ?? 1));
  if (o.top) tinyTop(C, B, o.top);
  if (o.feet !== false && !(o.y0 < 0)) tinyFeet(ink, B);
  return B;
}

// =====================================================================
// props
// =====================================================================
function arm(ink, S, H, sc) {
  const m = add(lerp(S, H, 0.5), [0, sc * 0.12]);
  ink.poly(tube(spline([S, m, H], 5), profile([[0, sc * 0.17], [1, sc * 0.13]])));
  ink.dot(H, sc * 0.17);
}
function pennant(C, top, sc, kind) {
  const { ink, rng } = C, L = sc * rng.range(1.5, 2.1), hgt = sc * rng.range(0.75, 1), ph = rng.range(0, 6), up = [], lo = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8, wv = Math.sin(ph + u * 5) * sc * 0.16 * u;
    up.push([top[0] - L * u, top[1] + sc * 0.08 + wv + (kind === 'tri' ? hgt * 0.45 * u : 0)]);
    lo.push([top[0] - L * u, top[1] + sc * 0.08 + hgt + wv - (kind === 'tri' ? hgt * 0.45 * u : 0)]);
  }
  if (kind === 'swallow') up.push([top[0] - L * 0.72, top[1] + sc * 0.08 + hgt * 0.5 + Math.sin(ph + 3.6) * sc * 0.1]);
  ink.poly(up.concat(lo.reverse()));
}
function canopy(ink, c, U, n) {
  const uh = U * 0.62, pts = [];
  for (let i = 0; i <= 16; i++) { const a = PI + i / 16 * PI; pts.push([c[0] + Math.cos(a) * U, c[1] + Math.sin(a) * uh]); }
  for (let j = n - 1; j >= 0; j--) { const lc = c[0] - U + (2 * j + 1) * U / n; for (let i = 1; i < 6; i++) { const a = i / 6 * PI; pts.push([lc + Math.cos(a) * U / n, c[1] - Math.sin(a) * U / n * 0.42]); } if (j > 0) pts.push([lc - U / n, c[1]]); }
  ink.poly(pts);
  bar(ink, [c[0], c[1] - uh + 0.3], [c[0], c[1] - uh - U * 0.2], 1.2);
}
function lanternAt(ink, L, sc) {
  const lw = sc * 0.44, lh = sc * 0.82;
  ink.poly([[L[0] - lw * 0.95, L[1] + lh * 0.24], [L[0], L[1] - lh * 0.1], [L[0] + lw * 0.95, L[1] + lh * 0.24]]);
  ink.poly(rrect(L[0] - lw * 0.72, L[1] + lh * 0.18, lw * 1.44, lh * 0.76, 0.9));
  ink.poly(rrect(L[0] - lw * 0.95, L[1] + lh * 0.88, lw * 1.9, lh * 0.16, 0.5));
  ink.poly(rrect(L[0] - lw * 0.42, L[1] + lh * 0.32, lw * 0.84, lh * 0.48, 0.5), 'w');
  ink.poly(leaf([L[0], L[1] + lh * 0.78], -PI / 2, lh * 0.36, lw * 0.42, 0, 0.4), 'k2');
}
function bundleAt(ink, E, sc) {
  const c = add(E, [-sc * 0.1, sc * 0.5]);
  ink.oval(c, sc * 0.62, sc * 0.55);
  for (const a of [-2.0, -1.1]) ink.poly(leaf(add(E, [0, sc * 0.1]), a, sc * 0.55, sc * 0.32, 0, 0.55));
}
const PROPS = {
  lantern(C, S, sc) {
    const { ink } = C, H = add(S, [sc * 0.75, -sc * 0.05]); arm(ink, S, H, sc);
    const T = add(H, [sc * C.rng.range(0.6, 0.95), -sc * C.rng.range(1.5, 1.9)]);
    stroke(ink, [add(H, [-sc * 0.22, sc * 0.5]), H, T], 1.3);
    const L = add(T, [0, sc * 0.3]); bar(ink, T, L, 1); lanternAt(ink, L, sc);
  },
  candle(C, S, sc) {
    const { ink } = C, H = add(S, [sc * 0.7, -sc * 0.05]); arm(ink, S, H, sc);
    const d = add(H, [sc * 0.3, sc * 0.05]);
    ink.oval(d, sc * 0.55, Math.max(sc * 0.1, 0.8));
    stroke(ink, [add(d, [-sc * 0.5, 0]), add(d, [-sc * 0.78, sc * 0.02]), add(d, [-sc * 0.72, sc * 0.3]), add(d, [-sc * 0.45, sc * 0.12])], 1);
    ink.poly(rrect(d[0] - sc * 0.13, d[1] - sc * 0.75, sc * 0.26, sc * 0.75, 0.4));
    bar(ink, [d[0], d[1] - sc * 0.7], [d[0], d[1] - sc * 0.95], 0.8);
    ink.poly(leaf([d[0], d[1] - sc * 0.86], -PI / 2 + 0.1, sc * 0.7, sc * 0.36, 0.06, 0.38));
  },
  umbrella(C, S, sc, o) {
    const { ink, rng } = C, H = add(S, [sc * 0.6, sc * 0.05]); arm(ink, S, H, sc);
    const c = [H[0] - sc * rng.range(0.25, 0.6), o.yTop - sc * 0.35], hb = [H[0] + sc * 0.03, H[1] + sc * 0.5];
    stroke(ink, [hb, H, add(c, [0, -sc * 0.5])], 1.3);
    stroke(ink, [hb, add(hb, [sc * 0.2, sc * 0.2]), add(hb, [sc * 0.4, sc * 0.02])], 1.3);
    canopy(ink, c, sc * rng.range(1.5, 1.95), rng.int(3, 4));
  },
  suitcase(C, S, sc) {
    const { ink, rng } = C, ch = sc * rng.range(0.6, 0.8), cw = sc * rng.range(0.95, 1.25);
    // carried out at the side, clear of the body, hanging just above the ground
    const H = [S[0] + sc * 0.45 + cw * 0.5, -(ch + sc * 0.24 + 0.7)]; arm(ink, S, H, sc);
    stroke(ink, [[H[0] - sc * 0.24, H[1] + sc * 0.26], [H[0] - sc * 0.2, H[1] + sc * 0.02], [H[0] + sc * 0.2, H[1] + sc * 0.02], [H[0] + sc * 0.24, H[1] + sc * 0.26]], 1.1);
    ink.poly(rrect(H[0] - cw / 2, H[1] + sc * 0.22, cw, ch, 1.3));
  },
  rod(C, S, sc) {
    const { ink, rng } = C, H = add(S, [sc * 0.7, -sc * 0.1]); arm(ink, S, H, sc);
    const a = -rng.range(0.5, 0.85), T = polar(H, a, sc * rng.range(2.7, 3.5));
    ink.poly(tube(spline([polar(H, a + PI, sc * 0.45), H, add(lerp(H, T, 0.6), [0, -sc * 0.12]), T], 6), profile([[0, 0.85], [1, 0.45]])));
    const E = [T[0] + sc * rng.range(-0.2, 0.4), -rng.range(7, 10)];
    stroke(ink, [T, add(lerp(T, E, 0.5), [sc * 0.12, 0]), E], 0.85);
    if (rng.chance(0.6)) { ink.poly(leaf(add(E, [0, -0.6]), PI / 2, 5.2, 2.9, 0, 0.42)); ink.poly([[E[0], E[1] + 3.6], [E[0] - 1.7, E[1] + 6], [E[0] + 1.7, E[1] + 6]]); }
    else { ink.dot(add(E, [0, 1]), 1.5); stroke(ink, [add(E, [0, 2]), add(E, [0.2, 4.4]), add(E, [1.5, 5]), add(E, [2, 3.6])], 0.85); }
  },
  flag(C, S, sc, o) {
    const { ink, rng } = C, H = add(S, [sc * 0.65, 0]); arm(ink, S, H, sc);
    const top = [H[0] + sc * 0.2, o.yTop - sc * rng.range(0.9, 1.4)];
    stroke(ink, [[H[0] - sc * 0.06, Math.min(H[1] + sc * 0.75, -0.6)], H, top], 1.3); ink.dot(top, 1.25);
    pennant(C, top, sc, rng.pick(['tri', 'swallow', 'tri']));
  },
  quill(C, S, sc, o) {
    const { ink, rng } = C, H = add(S, [sc * 0.62, 0]); arm(ink, S, H, sc);
    const nib = [H[0] + sc * 0.28, Math.min(H[1] + sc * 0.85, -0.3)], top = [H[0] - sc * rng.range(0.5, 0.9), o.yTop - sc * rng.range(0.8, 1.3)];
    const q = add(lerp(H, top, 0.55), [sc * 0.16, 0]);
    ink.poly(tube(spline([nib, H, q, top], 6), profile([[0, 0.3], [0.12, 0.8], [1, 0.5]])));
    ink.poly(tube(spline([lerp(H, q, 0.5), q, top, add(top, [-sc * 0.12, -sc * 0.2])], 7), profile([[0, 0.5], [0.25, sc * 0.4], [0.7, sc * 0.36], [1, 0.35]])));
    const v = spline([lerp(H, q, 0.5), q, top], 7);
    for (const u of [0.45, 0.72]) { const k = pathAt(v, u); ink.poly([polar(k.p, k.ang + PI / 2, sc * 0.5), polar(k.p, k.ang + PI / 2 + 0.2, sc * 0.1), polar(polar(k.p, k.ang, sc * 0.2), k.ang + PI / 2, sc * 0.5)], 'w'); }
  },
  net(C, S, sc, o) {
    const { ink, rng } = C, H = add(S, [sc * 0.65, 0]); arm(ink, S, H, sc);
    const top = [H[0] + sc * 0.45, o.yTop - sc * rng.range(0.3, 0.7)], rr = sc * 0.62, hc = add(top, [-rr * 0.2, -rr * 0.95]);
    stroke(ink, [[H[0] - sc * 0.15, Math.min(H[1] + sc * 0.75, -0.6)], H, top], 1.3);
    const ring = []; for (let i = 0; i <= 20; i++) ring.push([hc[0] + Math.cos(i / 20 * 6.283) * rr * 0.55, hc[1] + Math.sin(i / 20 * 6.283) * rr]);
    ink.poly(tube(ring, 0.6));
    ink.poly(tube(spline([add(hc, [-rr * 0.2, 0]), add(hc, [-rr * 1.4, rr * 0.15]), add(hc, [-rr * 2.5, rr * 0.9])], 6), profile([[0, rr * 0.95], [0.5, rr * 0.6], [1, 0.5]])));
  },
  bundle(C, S, sc, o) {
    const { ink, rng } = C, H = add(S, [sc * 0.3, -sc * 0.35]); arm(ink, S, H, sc);
    const E = [o.B.cx(1) - sc * rng.range(1.5, 1.9), o.yTop + sc * rng.range(0.3, 0.8)];
    stroke(ink, [add(H, [sc * 0.45, sc * 0.3]), H, E], 1.4); bundleAt(ink, E, sc);
  },
  staff(C, S, sc, o) {
    const { ink } = C, H = add(S, [sc * 0.7, 0]); arm(ink, S, H, sc);
    const top = [H[0] - sc * 0.05, o.yTop + sc * 0.4];
    stroke(ink, [[H[0] + sc * 0.12, -0.7], H, top, add(top, [sc * 0.25, -sc * 0.55]), add(top, [sc * 0.75, -sc * 0.45]), add(top, [sc * 0.8, sc * 0.05])], 1.5, 7);
  },
};
function scarf(C, B, t, w) {
  const { ink, rng } = C, nb = B.at(t, -1, 0.9), ph = rng.range(0, 6);
  ink.oval(B.c(t), B.wid(t) * 1.1, w * 0.17);
  // the long end streams back and DOWN (a level streamer reads as an arm)
  const L = w * rng.range(1.0, 1.45), dn = rng.range(0.4, 0.7), pts = [];
  for (let i = 0; i <= 5; i++) pts.push([nb[0] - L * i / 5, nb[1] + L * dn * (i / 5) ** 1.4 + Math.sin(ph + i * 1.3) * w * 0.12 * (i / 5)]);
  const path = spline(pts, 5);
  ink.poly(tube(path, profile([[0, w * 0.14], [1, w * 0.2]])));
  const e = pathAt(path, 1);
  for (const d of [-0.6, 0, 0.6]) ink.line([e.p, polar(polar(e.p, e.ang + PI / 2, d * w * 0.3), e.ang, w * 0.32)], 0.9);
  ink.poly(tube(spline([nb, add(nb, [-w * 0.35, w * 0.3]), add(nb, [-w * 0.45, w * 0.8])], 5), profile([[0, w * 0.14], [1, w * 0.18]])));
}

// =====================================================================
// CHASSIS
// =====================================================================
// Upright folk: lumps, pears, tall wanderers; frontal (face on the body) or profile (head socket).
chassis.janssonFolk = (C, g) => {
  const { ink, rng } = C, w = g.w * C.plump, h = g.hk * w, lift = Math.min(C.lift, 1.4) * w * (g.liftK ?? 0.6), lean = g.lean ?? 0;
  const B = body({ y0: -lift, h, w, keys: SHAPES[g.shape] ?? SHAPES.lump, lean, tb: g.tb ?? 0.3, tt: g.tt ?? 0.4 });
  ink.poly(B.pts);
  if (g.fuzz) fuzzEdge(C, B, g.fuzz * w, g.shag ?? 0, g.shag ? 13 : 11);
  const jan = {}; let head, yTop;
  if (g.face === 'side') {
    const p = B.c(g.neckT ?? 0.9), hs = w * (g.headS ?? 0.8);
    head = { p, dir: -PI / 2 + lean * 1.3 + 0.1, face: g.look ?? 0.05, s: hs, sym: false };
    yTop = p[1] - hs * 1.9;
  } else {
    const eT = g.eyeT ?? 0.7, wd = B.wid(eT), y = -lift - h * eT;
    jan.face = { eyes: g.face === 'back' ? [] : frontEyes(B, eT, g.eyeK ?? 1), mounts: topMounts(B, w * 0.55), nose: { p: [B.cx(eT) + wd * 0.5, y + wd * 0.45], dir: 0.12, s: wd } };
    head = { p: B.at(0.8, 1, 0.3), dir: -1.0, face: 0.05, s: w * 0.62, sym: false };
    yTop = -lift - h - w * 0.35;
  }
  const limbs = [], hipY = -(lift + Math.min(w * 0.3, h * 0.18));
  if (g.sit) for (const [dx, far] of [[0.78, true], [0.45, false]]) limbs.push({ p: [dx * w, hipY], dir: PI / 2, s: w * 0.9, role: 'fore', far, ground: 0, fwd: 0, side: 1 });
  else if (g.face !== 'back') for (const [dx, far] of [[-0.42, true], [0.42, false]]) limbs.push({ p: [dx * w, hipY], dir: PI / 2, s: w * 0.9, role: 'hind', far, ground: 0, fwd: 0, side: 1 });
  const aT = g.armT ?? 0.5, S = B.at(aT, 1, 0.8);
  if (g.arms !== 0) {
    if (!g.prop) limbs.push({ p: S, dir: rng.range(0.2, 1.0), s: w * 0.8, role: 'arm', fwd: PI / 2, side: 1 });
    if (g.prop !== 'bundle') limbs.push({ p: B.at(aT, -1, 0.8), dir: PI - rng.range(0.3, 1.1), s: w * 0.8, role: 'arm', fwd: PI / 2, side: -1 });
  }
  if (g.prop) PROPS[g.prop](C, S, Math.max(w, 6.5), { yTop, B });
  if (g.scarf) scarf(C, B, g.scarfT ?? (g.face === 'side' ? 0.86 : 0.5), w);
  if (g.face === 'back') tinyFeet(ink, { x: 0, w: w * 1.5 }, 0.5);
  const path = []; for (let i = 0; i <= 10; i++) path.push(B.c(0.05 + 0.9 * i / 10));
  return {
    view: 'side', r: w, path, rad: t => B.wid(0.05 + 0.9 * t), head, jan,
    tail: g.face === 'back' ? { p: [-w * 0.2, -(lift + w * 0.3)], dir: PI + rng.range(-0.15, 0.1), s: w * 0.5 } : { p: B.at(0.13, -1, 0.75), dir: PI + rng.range(-0.2, 0.4), s: w * 0.5 },
    limbs, back: [sideStrip(B)],
  };
};

// Low horizontal bean on short legs (scuttlers), or tilted on two legs (bird folk).
chassis.janssonBean = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, lift = Math.min(C.lift, 1.6) * r * (g.liftK ?? 0.8);
  const c = [0, -(lift + r * 0.95)], a = -(g.tilt ?? 0), bk = polar(c, a + PI, L / 2), fr = polar(c, a, L / 2);
  const path = spline([bk, c, fr], 8), rad = profile([[0, r * (g.rear ?? 0.8)], [0.42, r], [1, r * (g.front ?? 0.78)]]);
  ink.poly(tube(path, rad));
  const limbs = [], hy = c[1] + r * 0.35;
  const mk = (x, role, far) => limbs.push({ p: [x, hy], dir: PI / 2, s: r, role, far, ground: 0, fwd: 0, side: 1 });
  if (g.two) { mk(-r * 0.3, 'hind', true); mk(r * 0.25, 'hind', false); }
  else { mk(fr[0] + r * 0.2, 'fore', true); mk(bk[0] - r * 0.15, 'hind', true); mk(fr[0] - r * 0.3, 'fore', false); mk(bk[0] + r * 0.35, 'hind', false); }
  const strip = [];
  for (let i = 0; i < 10; i++) { const t = mix(0.06, 0.82, i / 9), k = pathAt(path, t); strip.push({ p: polar(k.p, k.ang - PI / 2, rad(t) * 0.85), dir: k.ang - PI / 2, t }); }
  return {
    view: 'side', r, path, rad,
    head: { p: polar(fr, a - 0.6, r * 0.3), dir: a - (g.neck ?? 0.6), face: g.look ?? 0.05, s: r * (g.headS ?? 0.8), sym: false },
    tail: { p: polar(bk, a + PI, r * 0.5), dir: PI + rng.range(0.2, 0.9), s: r * 0.5 },
    limbs, back: [strip],
  };
};

// Several small creatures on one base: a huddle, a stack, or a tail-holding procession.
chassis.janssonGroup = (C, g) => {
  const { ink, rng } = C, k = C.plump, eyes = [];
  const tops = ['none', 'point', 'round', 'hair', 'hair', 'long', 'cap', 'none'];
  let lead, rear, limbs = [], mounts;
  if (g.mode === 'stack') {
    let y0 = -Math.min(C.lift, 1) * g.w * 0.5, w = g.w * k, x = 0; const Bs = [];
    for (let i = 0; i < g.n; i++) {
      const h = w * rng.range(1.45, 1.8), B = lumpling(C, eyes, { x, y0, w, h, shape: rng.pick(['lump', 'egg', 'lump']), feet: false, top: i < g.n - 1 ? 'none' : null });
      if (i > 0) for (const sd of [-1, 1]) ink.oval([x + sd * w * 0.62, y0 - w * 0.1], w * 0.3, w * 0.2, sd * 0.5);
      if (i === 0) for (const [dx, far] of [[-0.42, true], [0.42, false]]) limbs.push({ p: [dx * w, y0 - w * 0.3], dir: PI / 2, s: w * 0.9, role: 'hind', far, ground: 0, fwd: 0, side: 1 });
      Bs.push(B); y0 -= h * 0.9; x += rng.range(-0.22, 0.22) * w; w *= rng.range(0.68, 0.8);
    }
    lead = Bs[Bs.length - 1]; rear = Bs[0];
    for (const sd of [-1, 1]) limbs.push({ p: lead.at(0.45, sd, 0.8), dir: sd > 0 ? -rng.range(0.1, 0.7) : PI + rng.range(0.1, 0.7), s: lead.w * 1.1, role: 'arm', fwd: -PI / 2, side: sd });
  } else if (g.mode === 'line') {
    let x = 0, w = g.w * k, prev = null; const Bs = [];
    for (let i = 0; i < g.n; i++) {
      const h = w * rng.range(1.7, 2.2), B = lumpling(C, eyes, { x, w, h, shape: rng.pick(['pear', 'lump', 'pear']), lean: 0.06, look: 'side', nose: rng.range(0.3, 0.9), top: i === 0 ? null : rng.pick(tops) });
      if (prev) { // this one holds the tail of the one in front
        const hand = add(B.at(0.5, 1, 0.8), [w * 0.75, -w * 0.1]), tb = prev.at(0.16, -1, 0.8);
        arm(ink, B.at(0.5, 1, 0.8), hand, w);
        stroke(ink, [tb, add(lerp(tb, hand, 0.5), [0, w * 0.35]), hand], 1.1);
        ink.poly(leaf(hand, PI - 0.5, w * 0.7, w * 0.4, 0, 0.6));
      }
      Bs.push(B); prev = B; const nw = w * rng.range(0.72, 0.92); x -= (w + nw) * rng.range(1.25, 1.5); w = nw;
    }
    lead = Bs[0]; rear = Bs[Bs.length - 1];
  } else {
    let x = 0, prevW = 0; const Bs = [];
    for (let i = 0; i < g.n; i++) {
      const w = g.w * k * rng.range(0.62, 1.1), h = w * rng.range(1.5, 2.7);
      x += (prevW + w) * rng.range(0.74, 0.86);
      Bs.push({ x, w, h }); prevW = w;
    }
    const tall = Bs.reduce((a, b) => (b.h > a.h ? b : a));
    const done = Bs.map(b => lumpling(C, eyes, { ...b, shape: rng.pick(['lump', 'pear', 'egg', 'tall', 'lump']), lean: rng.range(-0.06, 0.06), top: b === tall ? null : rng.pick(tops) }));
    lead = done[Bs.indexOf(tall)]; rear = done[0];
  }
  mounts = topMounts(lead, lead.w * 0.6);
  return {
    view: 'side', r: lead.w, path: [rear.c(0.4), lead.c(0.5)], rad: () => lead.w * 0.8,
    jan: { face: { eyes, mounts, nose: null } },
    head: { p: lead.at(0.82, 1, 0.3), dir: -1.0, face: 0.05, s: lead.w * 0.62, sym: false },
    tail: { p: rear.at(0.14, -1, 0.75), dir: PI + rng.range(-0.2, 0.4), s: rear.w * 0.5 },
    limbs, back: [sideStrip(rear)],
  };
};

// A creature peeping from behind or out of something.
chassis.janssonPeeper = (C, g) => {
  const { ink, rng } = C, k = C.plump, eyes = [];
  let hc, hr, tail, limbs = [], back, r, mountT = null;
  const hands = (pts, q) => { for (const p of pts) ink.oval(p, q * 0.3, q * 0.22); };
  if (g.kind === 'stone') {
    // a faceted rock (straight edges read as stone, not as a soft body); the creature is behind
    // it: only the top of its head, its two hands gripping the top edge, and a tail out the back
    const sw = g.sw * k, sh = g.sh, ys = [rng.range(0.45, 0.65), rng.range(0.9, 1), rng.range(0.85, 1), rng.range(0.45, 0.7)];
    const xs = [-sw * rng.range(0.92, 1.0), -sw * rng.range(0.5, 0.7), sw * rng.range(0.1, 0.4), sw * rng.range(0.8, 0.95)];
    const rock = [[-sw, 0], ...xs.map((x, i) => [x, -sh * ys[i]]), [sw * 1.02, 0]];
    ink.poly(rock);
    if (rng.chance(0.6)) { const px = sw * rng.range(1.05, 1.25), pw = sw * rng.range(0.25, 0.4), ph = sh * rng.range(0.15, 0.3); ink.poly([[px - pw, 0], [px - pw * 0.7, -ph], [px + pw * 0.4, -ph * rng.range(0.8, 1.1)], [px + pw, 0]]); }
    // top edge between facet points 1 and 2 is where it peeps over
    const ea = [xs[1], -sh * ys[1]], eb = [xs[2], -sh * ys[2]], u = rng.range(0.3, 0.6), edge = x => mix(ea[1], eb[1], (x - ea[0]) / (eb[0] - ea[0] || 1));
    hr = g.hr * k; const hx = mix(ea[0], eb[0], u); hc = [hx, edge(hx) - hr * rng.range(0.45, 0.65)];
    ink.dot(hc, hr);
    ink.poly(tube(polyline([hc, [hx, edge(hx) + hr * 0.4]], 2), hr * 0.95));
    // Kilroy grip: one small hand either side of the head, fingers over the edge
    for (const sd of [-1, 1]) { const x = hx + sd * hr * 1.3; ink.oval([x, edge(x) - hr * 0.1], hr * 0.3, hr * 0.24); }
    eyes.push(...[-1, 1].map(sd => ({ p: [hc[0] + hr * 0.12 + sd * hr * 0.42, hc[1] - hr * 0.05], r: hr * 0.26 / 1.5 })));
    tail = { p: [-sw * 0.85, -sh * 0.3], dir: PI + rng.range(0.1, 0.5), s: hr * 0.6 };
    back = arcStrip([0, 0], sw, sh, PI * 1.25, PI * 1.8, 7); r = sw;
  } else if (g.kind === 'burrow') {
    hr = g.hr * k; const up = rng.range(1.6, 2.1); hc = [0, -hr * (up - 0.6)];
    dome(ink, 0, 0, hr, hr * up);
    const mw = hr * rng.range(2.1, 2.6);
    ink.poly(tube(polyline([[-mw * 1.25, -1.1], [mw, -1.1]], 6), 1.1));
    for (const sd of [-1, 1]) { dome(ink, sd * hr * 1.2, 0, hr * 0.5, hr * 0.42); if (rng.chance(0.6)) dome(ink, sd * mw * rng.range(0.7, 0.9), 0, hr * rng.range(0.2, 0.4), hr * rng.range(0.1, 0.2)); }
    eyes.push(...[-1, 1].map(sd => ({ p: [hr * 0.06 + sd * hr * 0.42, -hr * (up - 0.5)], r: hr * 0.3 / 1.5 })));
    tail = { p: [-mw * 1.0, -0.8], dir: -PI / 2 - rng.range(0, 0.4), s: hr * 0.5 };
    back = arcStrip([0, 0], hr, hr * up, PI * 1.1, PI * 1.45, 5); r = hr;
  } else if (g.kind === 'grass') {
    const w = g.hr * k, B = body({ h: w * rng.range(1.5, 1.9), w, keys: SHAPES.lump, tb: 0.25, tt: 0.45 });
    ink.poly(B.pts); hr = w; hc = B.c(0.62);
    eyes.push(...frontEyes(B, 0.6, 1.05));
    const n = g.blades;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) * 2 - 1 + rng.range(-0.08, 0.08), len = w * rng.range(1.7, 3.2) * (1 - 0.3 * u * u);
      ink.poly(leaf([u * w * 1.7, -0.2], -PI / 2 + u * 0.75 + rng.range(-0.12, 0.12), len, w * rng.range(0.34, 0.5), u * 0.12 + rng.range(-0.08, 0.08), 0.3));
      if (rng.chance(0.14)) ink.oval(polar([u * w * 1.7, -0.2], -PI / 2 + u * 0.75, len * 0.98), w * 0.2, w * 0.36, u * 0.75);
    }
    tail = { p: B.at(0.12, -1, 0.7), dir: PI + rng.range(-0.1, 0.5), s: w * 0.5 };
    back = [sideStrip(B)][0]; r = w; mountT = topMounts(B, w * 0.6, 0.86);
  } else { // containers: pot, boot, cup, egg
    const w = g.pw * k; let rimY, rimW;
    const lift = g.kind === 'pot' ? Math.min(C.lift, 1) * w * 0.5 : 0;
    if (g.kind === 'pot') {
      const B = body({ y0: -lift, h: g.ph, w, keys: [[0, 0.66], [0.78, 0.98], [0.8, 1.12], [1, 1.12]], tb: 0.04, tt: 0.02 });
      ink.poly(B.pts); rimY = -lift - g.ph; rimW = w * 0.95;
      if (g.handles) for (const sd of [-1, 1]) stroke(ink, [B.at(0.8, sd, 0.9), add(B.at(0.74, sd), [sd * w * 0.42, 0]), add(B.at(0.5, sd), [sd * w * 0.3, 0]), B.at(0.46, sd, 0.9)], 1.5);
      for (const [dx, far] of [[-0.4, true], [0.4, false]]) limbs.push({ p: [dx * w, -lift - w * 0.2], dir: PI / 2, s: w * 0.8, role: 'hind', far, ground: 0, fwd: 0, side: 1 });
      back = sideStrip(B, 0.15, 0.7, 7);
    } else if (g.kind === 'boot') {
      const bh = g.ph, fl = w * rng.range(1.9, 2.4), fh = w * rng.range(0.95, 1.2);
      ink.poly(spline([[-w, -1], [-w * 1.02, -bh * 0.5], [-w * 1.1, -bh], [w * 1.1, -bh], [w * 0.95, -fh * 1.25], [w * 1.5, -fh * 1.05], [w + fl * 0.8, -fh], [w + fl, -fh * 0.5], [w + fl * 0.98, -1.2], [w * 0.5, -1.2]], 5));
      ink.poly(rrect(-w * 1.08, -1.6, w * 0.9, 1.6, 0.3)); ink.poly(rrect(-w * 0.3, -1.3, w * 1.3 + fl, 1.3, 0.3));
      ink.poly(rrect(-w * 1.22, -bh - 1, w * 2.44, 2.4, 1));
      stroke(ink, [[-w * 1.05, -bh], [-w * 1.6, -bh - w * 0.2], [-w * 1.5, -bh + w * 0.55]], 1.1);
      rimY = -bh; rimW = w * 1.0; back = arcStrip([0, -bh * 0.5], w, bh * 0.5, PI * 0.9, PI * 1.1, 4);
    } else if (g.kind === 'cup') {
      const ch = g.ph * 0.62, pts = [];
      for (let i = 0; i <= 14; i++) { const a = i / 14 * PI; pts.push([Math.cos(a) * w * 1.25 * (0.72 + 0.28 * Math.sin(a) ** 0.5 * 0 + 0.28 * (1 - Math.sin(a))), -2.6 - ch + Math.sin(a) * ch]); }
      ink.poly(pts); ink.poly(rrect(-w * 0.45, -3, w * 0.9, 1.6, 0.4));
      ink.poly(rrect(-w * 1.75, -1.7, w * 3.5, 1.7, 0.8));
      stroke(ink, [[-w * 1.15, -2.6 - ch * 0.9], [-w * 1.85, -2.6 - ch * 0.85], [-w * 1.8, -2.6 - ch * 0.3], [-w * 1.0, -2.6 - ch * 0.3]], 1.5);
      rimY = -2.6 - ch; rimW = w * 1.15; back = arcStrip([0, rimY], w * 1.2, ch, PI * 0.6, PI * 0.9, 4);
    } else { // egg
      const eh = g.ph * 0.6, pts = [], nz = 6;
      for (let i = 0; i <= 14; i++) { const a = i / 14 * PI; pts.push([Math.cos(a) * w * 1.05, -eh + Math.sin(a) * eh * 0.98]); }
      for (let i = 1; i < nz * 2; i++) pts.push([-w * 1.05 + i * w * 2.1 / (nz * 2), -eh - (i % 2 ? w * rng.range(0.3, 0.55) : 0)]);
      ink.poly(pts); rimY = -eh - w * 0.1; rimW = w * 0.95; back = arcStrip([0, -eh], w, eh, PI * 0.6, PI * 0.9, 4);
      tinyFeet(ink, { x: 0, w: w * 1.2 }, 0.8);
    }
    hr = rimW * (g.kind === 'boot' ? 0.86 : g.kind === 'pot' ? 0.62 : 0.8); hc = [0, rimY - hr * 0.5];
    ink.dot(hc, hr); ink.poly(rrect(-hr * 0.9, hc[1], hr * 1.8, hr * 0.8, 0.5));
    if (g.kind === 'egg' && g.cap) { const cp = []; for (let i = 0; i <= 10; i++) { const a = PI + i / 10 * PI; cp.push([hc[0] + Math.cos(a) * hr * 0.95, hc[1] - hr * 0.55 + Math.sin(a) * hr * 0.85]); } for (let i = 1; i < 6; i++) cp.push([hc[0] + hr * 0.95 - i * hr * 1.9 / 6, hc[1] - hr * 0.55 + (i % 2 ? hr * 0.3 : 0)]); ink.poly(cp); }
    hands([[-rimW * 0.98, rimY - 0.3], [rimW * 0.98, rimY - 0.3]], hr * 1.1);
    eyes.push(...[-1, 1].map(sd => ({ p: [hr * 0.07 + sd * hr * 0.43, hc[1] - hr * 0.05], r: hr * 0.26 / 1.5 })));
    tail = { p: [-w * 0.75, -lift - g.ph * 0.2], dir: PI + rng.range(0, 0.5), s: w * 0.45 }; r = w;
  }
  const mounts = mountT ?? [-1, 1].map(sd => ({ p: [hc[0] + sd * hr * 0.55, hc[1] - hr * 0.62], dir: -PI / 2 + sd * 0.45, flip: sd, s: hr * 0.62 }));
  return {
    view: 'side', r, path: [[-r * 0.5, -r * 0.6], [r * 0.5, -r * 0.6]], rad: () => r * 0.6,
    jan: { face: { eyes, mounts, nose: null } },
    head: { p: add(hc, [hr * 0.25, -hr * 0.2]), dir: -1.1, face: 0.05, s: hr * 0.7, sym: false },
    tail, limbs, back: [back],
  };
};

// Drifting bell-ghosts: wide draped bells with a curled wisp, scalloped hem, clasped hands.
chassis.janssonDrift = (C, g) => {
  const { ink, rng } = C, eyes = []; let x = 0, lead = null, rear = null, w = g.w * C.plump;
  for (let i = 0; i < g.n; i++) {
    const h = w * rng.range(1.9, 2.5), ns = rng.int(3, 4), rr = w / ns, lean = rng.range(0.02, 0.1);
    const B = body({ x, y0: -rr * 0.9, h, w, keys: [[0, 1], [0.25, 0.9], [0.7, 0.6], [1, 0.4]], tb: 0.02, tt: 0.3, lean });
    ink.poly(B.pts);
    for (let j = 0; j < ns; j++) ink.dot([x - w + (2 * j + 1) * rr, -rr], rr);
    const t = B.c(1), cs = rng.range(0.8, 1.2);
    ink.poly(tube(spline([B.c(0.88), add(t, [-w * 0.05, -w * 0.45 * cs]), add(t, [-w * 0.6 * cs, -w * 0.8 * cs]), add(t, [-w * 1.05 * cs, -w * 0.45 * cs]), add(t, [-w * 0.85 * cs, -w * 0.1 * cs])], 7), profile([[0, B.wid(0.88)], [0.35, w * 0.24], [1, 0.55]])));
    const hp = B.at(0.47, 1, 0.85);
    for (const dy of [0, w * 0.28]) { const e = add(hp, [w * 0.55, dy - w * 0.12]); ink.poly(tube(spline([add(hp, [0, dy]), e], 4), w * 0.11)); ink.dot(e, w * 0.15); }
    eyes.push(...frontEyes(B, 0.76, 1.1, 0.1));
    if (!lead) lead = B; rear = B;
    const nw = w * rng.range(0.6, 0.8); x -= (w + nw) * rng.range(1.0, 1.2); w = nw;
  }
  return {
    view: 'side', r: lead.w, path: [lead.c(0.1), lead.c(0.9)], rad: t => lead.wid(0.1 + 0.8 * t),
    jan: { face: { eyes, mounts: [{ p: lead.c(0.9), dir: -PI / 2 + 0.5, flip: 1, s: lead.w * 0.4 }], nose: null } },
    head: { p: lead.at(0.85, 1, 0.2), dir: -1.1, face: 0.05, s: lead.w * 0.55, sym: false },
    tail: { p: rear.at(0.1, -1, 0.8), dir: PI, s: rear.w * 0.4 },
    limbs: [], back: [sideStrip(rear, 0.2, 0.75, 7)],
  };
};

// Snail-ish folk: slug foot, neck and a shell (coil, spire or a tiny house).
chassis.janssonSnail = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, fr = r * 0.3;
  const nk = [r * rng.range(1.35, 1.6), -r * rng.range(0.95, 1.35)];
  const path = spline([[-r * rng.range(1.5, 1.9), -0.7], [-r * 0.8, -fr * 0.75], [r * 0.3, -fr], [r * 1.0, -fr * 1.05], [r * 1.3, -r * 0.6], nk], 7);
  const rad = profile([[0, 0.6], [0.25, fr * 0.75], [0.6, fr], [0.85, fr * 0.9], [1, fr * 0.95]]);
  ink.poly(tube(path, rad).map(p => [p[0], Math.min(p[1], 0)]));
  const sc = [-r * 0.12, -(fr * 1.3 + r * 0.9)];
  if (g.shell === 'coil') { ink.dot(sc, r); ink.dot(polar(sc, -PI * 0.72, r * 0.72), r * 0.5); ink.oval([sc[0] + r * 0.75, sc[1] + r * 0.62], r * 0.4, r * 0.3, 0.6); }
  else if (g.shell === 'spire') { let p = [sc[0] + r * 0.15, sc[1] + r * 0.3], q = r * 0.85; for (let i = 0; i < 5; i++) { ink.oval(p, q, q * 0.72, -0.5); p = add(p, [-q * 0.55, -q * 0.8]); q *= 0.68; } }
  else {
    const hw = r * 0.85, hh = r * 1.0, x0 = sc[0] - hw, yb = -fr * 1.6;
    ink.poly(rrect(x0, yb - hh, hw * 2, hh + 1, 0.6));
    ink.poly([[x0 - hw * 0.28, yb - hh + 0.4], [sc[0], yb - hh - hw * rng.range(0.9, 1.3)], [x0 + hw * 2.28, yb - hh + 0.4]]);
    ink.poly(rrect(x0 + hw * 0.3, yb - hh - hw * 1.05, hw * 0.34, hw * 0.8, 0.3));
    ink.poly(rrect(sc[0] - hw * 0.3 + hw * 0.35, yb - hh * 0.75, hw * 0.6, hh * 0.42, hw * 0.25), 'w');
  }
  return {
    view: 'side', r, path, rad,
    head: { p: nk, dir: -1.05, face: 0.1, s: fr * 1.3, sym: false },
    tail: { p: [-r * 1.5, -1.2], dir: PI, s: fr * 0.5 },
    limbs: [], back: [arcStrip(sc, r, r, PI * 1.05, PI * 1.75, 8)],
  };
};

// Curled-up sleeper: a dome with the head tucked low in front. No eyes: it is asleep.
chassis.janssonSleeper = (C, g) => {
  const { ink, rng } = C, w = g.w * C.plump, hg = g.hg, pts = [];
  for (let i = 0; i <= 22; i++) { const a = PI + i / 22 * PI; pts.push([Math.cos(a) * w, Math.sin(a) * hg * (1 + 0.16 * Math.cos(a - 3.9))]); }
  ink.poly(pts);
  const hr = hg * rng.range(0.44, 0.52), hc = [w * 0.78, -hr * 0.98];
  ink.dot(hc, hr);
  ink.poly(tube(polyline([[w * 0.2, -hr], hc], 3), hr * 0.95).map(p => [p[0], Math.min(p[1], 0)]));
  dome(ink, hc[0] + hr * 0.85, 0, hr * g.snout, hr * 0.62);
  dome(ink, w * 0.3, 0, hr * 0.5, hr * 0.3); dome(ink, -w * 0.72, 0, hr * 0.6, hr * 0.34);
  const strip = [];
  for (let i = 0; i < 9; i++) { const a = PI * mix(1.12, 1.62, i / 8); strip.push({ p: [Math.cos(a) * w * 0.9, Math.sin(a) * hg * 0.9], dir: a, t: i / 8 }); }
  return {
    view: 'side', r: hg, path: [[-w * 0.7, -hg * 0.45], [w * 0.5, -hg * 0.45]], rad: () => hg * 0.45,
    jan: { face: { eyes: [], mounts: [{ p: [hc[0] - hr * 0.35, hc[1] - hr * 0.7], dir: -PI / 2 - 0.35, flip: -1, s: hr * 0.95 }], nose: null } },
    head: { p: add(hc, [hr * 0.2, 0]), dir: -0.15, face: 0.2, s: hr * 0.8, sym: false },
    tail: { p: [-w * 0.86, -hg * 0.3], dir: PI + rng.range(-0.1, 0.3), s: hg * 0.42 },
    limbs: [], back: [strip],
  };
};

// Farm-sprite (folk tomte/nisse, the generic Nordic household spirit): long bell coat, a tall
// cone hat pulled down to the nose, a potato nose, a beard spilling forward, boot toes.
chassis.janssonTomte = (C, g) => {
  const { ink, rng } = C, w = g.w * C.plump, h = g.hk * w, lift = w * 0.16;
  const B = body({ x: -w * 0.22, y0: -lift, h, w, keys: [[0, 0.95], [0.3, 0.82], [0.8, 0.6], [1, 0.55]], tb: 0.1, tt: 0.3, lean: g.lean ?? 0 });
  ink.poly(B.pts);
  for (const [dx, k] of [[0.5, 1], [-0.2, 0.85]]) dome(ink, dx * w, 0, w * 0.42 * k, w * 0.3 * k);
  const top = B.c(0.97), yb = top[1] + w * 0.05, bw = B.wid(0.9) * 1.12, hh = w * g.hat, fl = g.flop;
  const tip = add(top, [-w * (0.25 + fl * 0.9), -hh + fl * w * 0.6]);
  ink.poly(tube(spline([[top[0], yb], add(top, [-w * 0.05, -hh * 0.5]), add(top, [-w * (0.15 + fl * 0.3), -hh * 0.85]), tip], 7), profile([[0, bw], [0.35, bw * 0.62], [0.8, bw * 0.22], [1, 0.6]])));
  if (g.pom) ink.dot(tip, Math.max(w * 0.17, 1.1));
  ink.oval([top[0] + w * 0.12, yb + w * 0.02], bw * 1.12, w * 0.17, -0.08);
  // the nose juts out under the brim; the beard hangs from it as a long wavy wedge that IS the
  // front profile (the coat sits back behind it)
  const nr = w * g.nose, nose = [top[0] + bw * 0.85 + nr * 0.55, yb + nr * 0.85];
  ink.dot(nose, nr);
  const bl = h * g.beard, by = Math.min(yb + bl, -lift - w * 0.25), fx = nose[0] + w * rng.range(-0.05, 0.12), bk = top[0] - w * 0.1;
  const front = [];
  for (let i = 0; i <= 4; i++) { const u = i / 4; front.push([mix(nose[0] - nr * 0.2, fx, u) + Math.sin(u * PI * 2.5) * w * 0.05, mix(nose[1] + nr * 0.5, by, u)]); }
  ink.poly([[bk, yb + w * 0.1], [nose[0] - nr * 0.5, nose[1]], ...spline(front, 3), [mix(fx, bk, 0.45), by - bl * 0.12], [bk, by - bl * 0.3]]);
  const eyes = g.eye ? [{ p: [nose[0] - nr * 1.45, yb + w * 0.16], r: w * 0.1 }] : [];
  const limbs = [], S = B.at(0.5, 1, 0.82);
  if (g.prop) PROPS[g.prop](C, S, w, { yTop: tip[1] + hh * 0.5, B });
  else if (g.arms) limbs.push({ p: S, dir: rng.range(0.4, 1.0), s: w * 0.8, role: 'arm', fwd: PI / 2, side: 1 });
  const path = []; for (let i = 0; i <= 10; i++) path.push(B.c(0.05 + 0.9 * i / 10));
  return {
    view: 'side', r: w, path, rad: t => B.wid(0.05 + 0.9 * t),
    jan: { face: { eyes, mounts: [{ p: tip, dir: -PI / 2 - 0.6, flip: -1, s: w * 0.4 }], nose: null } },
    head: { p: nose, dir: -0.2, face: 0.05, s: w * 0.55, sym: false },
    tail: { p: B.at(0.12, -1, 0.8), dir: PI + rng.range(-0.1, 0.4), s: w * 0.45 },
    limbs, back: [sideStrip(B, 0.2, 0.8, 8)],
  };
};

// Word-creatures: stray handwriting come alive.
chassis.janssonGlyph = (C, g) => {
  const { ink, rng } = C, k = g.k * Math.sqrt(C.plump), lg = g.lg ?? 3, eyes = [];
  const sx = g.sx ?? 1, sy = g.sy ?? 1, sl = g.sl ?? 0, wt = g.wt ?? 1, wob = g.wob ?? 1;
  const P = (x, y) => [(x * sx + y * sy * sl) * k, -(lg + y * sy * k)], Pm = (x, y) => [(x * sx + y * sy * sl) * k, -(y * sy * k)];
  const penG = (ink, pts, w, o) => pen(ink, pts, w * wt, o);
  const j = (a = 0.6) => rng.range(-a, a) * wob;
  const ball = (c, r) => { ink.dot(c, r); eyes.push({ p: [c[0] + r * 0.06, c[1]], r: Math.max(r * 0.42, 0.9) / 1.5 }); return c; };
  const tick = (x, yTop, d = 1) => { bar(ink, [x, yTop], [x + d * 0.5, -0.6], 1.2); bar(ink, [x + d * 0.1, -0.6], [x + d * 2.1, -0.6], 1.2); };
  const footBar = x => bar(ink, [x - 0.8, -0.65], [x + 2.6 * k * 0.6 + 1, -0.65], 1.3);
  let hc, hr, tailP = [0, -lg], tailDir = PI;
  switch (g.kind) {
    case 'comma': {
      let x = 0;
      for (let i = 0; i < g.n; i++) {
        const q = k * (i === 0 ? 1 : rng.range(0.62, 0.86)), lq = lg * q / k, Q = (a, b) => [x + a * q, -(lq + b * q)];
        const c = Q(5, 7.2 + j(0.8)), pts = [c, Q(2.6, 3.4), Q(-3, 2.0), Q(-9, 1.7), Q(-13, 3.6 + g.curl * 1.5)];
        if (g.curl > 0.5) pts.push(Q(-14.6, 7.2), Q(-12.4, 9.6), Q(-10.6, 8));
        ink.poly(tube(spline(pts, 8), profile([[0, 4.2 * q], [0.2, 3.3 * q], [0.5, 1.9 * q], [1, 0.55]])));
        ball(c, 4.5 * q);
        for (const lx of [4.5, 0.8, -3.2, -7].slice(0, g.legs)) tick(x + lx * q, -(lq + 1.6 * q), rng.sign());
        if (i === 0) { hc = c; hr = 4.5 * q; }
        tailP = Q(-9, 1.7);
        x -= q * rng.range(23, 26) * (g.curl > 0.5 ? 1.08 : 1);
      }
      break;
    }
    case 'amp': {
      const raw = [[12.6, 3.2], [9.4, 0.7], [4.6, 4.4], [0.6, 10.6], [0.1, 15.4], [3.5, 18.8], [7, 15.6], [5, 11.4], [-1, 7.6], [-5.4, 3.4], [-3.4, 0.7], [1, 0.3], [5.6, 3.6], [8.4, 7.6], [9.6, 10.8]];
      penG(ink, raw.map(([a, b]) => P(a + j(0.5), b + j(0.5))), 2.5 * k, { con: 0.5, t0: 0.45 });
      hc = ball(P(10.2, 12.2), 3.7 * k); hr = 3.7 * k;
      for (const lx of [-3.6, 0.8, 9]) tick(lx * k, -(lg + 1 * k), rng.sign());
      tailP = P(12.6, 3.2); tailDir = 0;
      break;
    }
    case 'stem': {
      const H = g.H, bw = g.bowl, sd = g.backBowl ? -1 : 1;
      penG(ink, [P(0, 0.2), P(0, H * 0.5), P(0.3, H)], 2.8 * k, { con: 0.2 });
      penG(ink, [P(0.3, H - 0.6), P(1.6, H + 3.1), P(5, H + 3.7), P(7.5, H + 1.2)], 2.4 * k, { con: 0.4, t1: 0.8 });
      hc = ball(P(7.7, H - 1), 3.6 * k); hr = 3.6 * k;
      penG(ink, [P(0, bw * 1.3), P(sd * bw * 0.55, bw * 1.5), P(sd * bw, bw * 0.78), P(sd * bw * 0.6, 0.7), P(0, 1.3)], 2.5 * k, { con: 0.45 });
      if (g.arms) { const ay = H * 0.7; stroke(ink, [P(-4.6, ay + j(1.2)), P(0, ay), P(4.6, ay + j(1.2) + 0.6)], 1.25); ink.dot(P(-4.6, ay), 1.15); ink.dot(P(4.6, ay + 0.6), 1.15); }
      tick(-0.6 * k, -lg - k); tick(sd * bw * 0.62 * k, -lg - k);
      tailP = P(-1, 1.5);
      break;
    }
    case 'minim': {
      const n = g.n, p = 6.5, X = 10.5, wv = i => g.amp * Math.sin(g.ph + i * 1.15);
      for (let i = 0; i <= n; i++) { bar(ink, Pm(i * p, X * 0.72 + wv(i)), Pm(i * p, 1.0), 2.5 * k); footBar(i * p * k); }
      for (let i = 0; i < n; i++) penG(ink, [Pm(i * p, X * 0.62 + wv(i)), Pm(i * p + p * 0.42, X + (wv(i) + wv(i + 1)) / 2), Pm(i * p + p * 0.9, X * 0.9 + wv(i + 1)), Pm((i + 1) * p, X * 0.6 + wv(i + 1))], 2.3 * k, { con: 0.35 });
      const nx = n * p, ny = X * 0.7 + wv(n);
      stroke(ink, [Pm(nx, ny), Pm(nx + 2, ny + 3.6), Pm(nx + 4, ny + 5.6)], 2 * k);
      hc = ball(Pm(nx + 4.6, ny + 6.6), 3.9 * k); hr = 3.9 * k;
      ink.line([Pm(0, X * 0.7 + wv(0)), Pm(-2.8, X + 1.4 + wv(0)), Pm(-5.6, X - 0.6 + wv(0))], 1.5);
      tailP = Pm(-5.6, X - 0.6 + wv(0));
      break;
    }
    case 'loop': {
      const n = g.tall.length, p = 8, pts = [P(-p * 0.9, 5.2), P(-p * 0.62, 1.6)];
      for (let i = 0; i < n; i++) {
        const H = (g.tall[i] ? 19.5 : 12) + j(1), x = i * p;
        pts.push(P(x - 2.4, 0.9), P(x + 2.9, H * 0.5), P(x + 4.3, H * 0.88), P(x + 2.6, H + 0.3), P(x + 0.4, H * 0.85), P(x, H * 0.4), P(x + 0.7, 1.1));
        tick((x + 0.4) * k, -lg - 0.6 * k, i % 2 ? -1 : 1);
      }
      const xl = (n - 1) * p;
      pts.push(P(xl + p * 0.5, 1), P(xl + p + 0.2, 4.4), P(xl + p + 1.2, 7));
      penG(ink, pts, 2.2 * k, { con: 0.5, t0: 0.5 });
      hc = ball(P(xl + p + 1.6, 8.2), 3.9 * k); hr = 3.9 * k;
      tick((xl + p * 0.6) * k, -lg - 0.6 * k);
      tailP = P(-p * 0.9, 5.2); tailDir = -PI * 0.7;
      break;
    }
    case 'query': {
      const hs = g.hs, hv = g.hv ?? 1, bw = g.bw ?? 5.7, nk = g.nk ?? 0, fl = g.flip ? -1 : 1, X = (a, b) => P(a * fl, b);
      const by = bw * 0.88, top = by * 2 + nk;
      ink.oval(X(0, by), bw * k, by * k);
      stroke(ink, [X(0, by * 1.6), X(-0.3, top + 4.6)], 1.3 * k);
      const H = (a, b) => X(a * hs, top + 4 + (b - 13) * hv);
      penG(ink, [X(-0.3, top + 4), H(-3.7, 17.6), H(-3.2, 23), H(1, 26.6), H(5.6, 24.6), H(6.8, 20.6)], 2.7 * k, { con: 0.5, t0: 0.6 });
      hr = (g.hr ?? 3.7) * k; hc = ball(H(6.6, 19), hr);
      if (g.arms) for (const sd of [-1, 1]) { const a0 = X(sd * bw * 0.8, by * 1.2), a1 = X(sd * (bw + 3.5), by * 1.2 + 3 + j(1.5)); stroke(ink, [a0, a1], 1.2); ink.dot(a1, 1.1); }
      tick(-bw * 0.45 * k, -lg - 1.5 * k, -1); tick(bw * 0.4 * k, -lg - 1.5 * k, 1);
      tailP = X(-bw + 0.5, by * 0.8); tailDir = fl > 0 ? PI : 0;
      break;
    }
    case 'pilcrow': {
      const H = g.H, st = g.stride;
      hr = 5.6 * k; hc = Pm(-3.2, H - 5); ink.oval(hc, 5.9 * k, 5.3 * k);
      eyes.push({ p: add(hc, [0.6 * k, 0]), r: 2.2 * k / 1.5 });
      stroke(ink, [Pm(-3, H - 1), Pm(7.4, H - 1), Pm(9.4, H + 0.9)], 2 * k);
      for (const [xt, xb] of [[1.7, 1.7 - st], [6, 6 + st]]) { bar(ink, Pm(xt, H - 1), [xb * k, -1], 2.1 * k); footBar(xb * k); }
      tailP = Pm(-9, H - 5);
      break;
    }
    case 'serif': {
      let x = 0, pq = 0;
      for (let i = 0; i < g.n; i++) {
        const q = k * rng.range(0.8, 1.25), o = j(1.6), tl = j(0.9);
        x -= (pq + q) * 6.1; pq = q;
        const Q = (a, b) => [x + a * q, -(lg + b * q)];
        ink.poly([Q(-6.5, 0), Q(-6.5, 1.7), Q(-4.9 + o * 0.5, 2.2), Q(-3.5 + o, 3.8), Q(-3.1 + o, 6), Q(-3.1 + o, 9.6 - tl), Q(3.1 + o, 9.6 + tl), Q(3.1 + o, 6), Q(3.5 + o, 3.8), Q(4.9 + o * 0.5, 2.2), Q(6.5, 1.7), Q(6.5, 0)]);
        const c = Q(o + 0.2, 6.6); eyes.push({ p: c, r: Math.max(3.1 * q * 0.42, 0.9) / 1.5 });
        for (const lx of [-4.6, -1.5, 1.5, 4.6]) tick(x + lx * q, -lg - 0.5, lx < 0 ? -1 : 1);
        if (i === 0) { hc = c; hr = 3.1 * q; }
        tailP = Q(-6.5, 1);
      }
      break;
    }
    case 'swash': {
      const ar = g.arch;
      penG(ink, [P(-14.5, 6.5 + g.curl), P(-12.8, 2.4), P(-9.4, 1.7), P(-4.8, 8 + ar), P(0.5, 11.5 + ar), P(5.6, 6 + ar * 0.5), P(8.6, 1.9), P(12, 3.4), P(13.8, 7.6)], 4 * k, { con: 0.6, t0: 0.3, t1: 0.75 });
      hc = ball(P(14.4, 10.6), 4.1 * k); hr = 4.1 * k;
      for (const lx of [-11.4, -8.6, 7.4, 10.2]) tick(lx * k, -lg - 1.2 * k, lx < 0 ? -1 : 1);
      tailP = P(-14.5, 6.5 + g.curl); tailDir = -PI * 0.6;
      break;
    }
    case 'aster': { // an asterisk standing on its two lower spokes: teardrop arms, ball centre
      const n = g.spokes, L = g.L, sp = g.splay, cy = L * Math.cos(sp) * 0.97 + 0.5, c = Pm(0, cy);
      const spoke = (a, len, foot) => {
        const e = polar(c, a, len * k), m = polar(polar(c, a, len * k * 0.5), a + PI / 2, (j(0.5) + (foot ? 0 : (g.curl ?? 0) * len * 0.22)) * k), th = g.th ?? 1;
        ink.poly(tube(spline([c, m, e], 5), profile([[0, 0.8 * k * th], [0.7, 1.35 * k * th], [1, 1.05 * k * th]])));
        if (foot) bar(ink, [e[0] - 0.4, -0.6], [e[0] + foot * 2.4, -0.6], 1.25);
      };
      spoke(PI / 2 - sp + j(0.06), L / Math.cos(0) , 1); spoke(PI / 2 + sp + j(0.06), L, -1);
      const a0 = PI / 2 + sp, a1 = PI / 2 - sp + 2 * PI;
      for (let i = 1; i < n - 1; i++) spoke(mix(a0, a1, i / (n - 1)) + j(0.12), L * rng.range(0.85, 1.05), 0);
      hr = (g.cr ?? 3.5) * k; hc = ball(c, hr);
      tailP = polar(c, PI + 0.3, 2 * k); tailDir = PI;
      break;
    }
    case 'at': { // an @ whose outer stroke runs on as a snail's foot, up into a neck and head
      const R = g.R, es = g.es ?? 1, nl = g.nl ?? 1, c = Pm(0, R * es + 1.25), pr = (a, rr) => [c[0] + Math.cos(a) * rr * k, c[1] + Math.sin(a) * rr * k * es];
      // a calligraphic spiral shell: the stroke coils inward over ~2.2 turns to a ball centre, no 'a' heart
      const turns = g.turns ?? 1.6, core = [];
      for (let i = 0; i <= 26; i++) { const t = i / 26, a = -PI * 0.5 - t * turns * 2 * PI; core.push(pr(a, mix(R * 0.66, R * 0.1, t))); }
      penG(ink, core, Math.min(1.5, R * 0.16) * k, { con: 0.4, t1: 0.6, per: 6 });
      ink.dot(core[core.length - 1], 1.4 * k);
      const sp = [];
      for (let i = 0; i <= 11; i++) { const t = i / 11, a = 0.45 - t * (2 * PI - 0.15); sp.push(pr(a, mix(R * 0.62, R, Math.min(t * 2.2, 1)))); }
      sp.push(Pm(R * 0.9, 0.95), Pm(R + 4.5, 0.95), Pm(R + 4.5 + 3.5 * nl, 3.2 * nl), Pm(R + 4.5 + 4.7 * nl, 6.8 * nl));
      penG(ink, sp, 2.5 * k, { con: 0.5, t0: 0.6, per: 6 });
      hr = (g.hr ?? 3.3) * k; hc = ball(Pm(R + 4.5 + 5.1 * nl, 6.8 * nl + 1.6), hr);
      ink.poly(tube(polyline([Pm(-R * 0.7, 0.8), Pm(R + 7, 0.8)], 4), 0.75 * k));
      tailP = Pm(-R * 0.95, 1); tailDir = PI;
      break;
    }
    case 'bracket': { // a pair of brackets held like curtains, a head peeping out between them
      const H = g.H, gp = g.gap, hy = H * rng.range(0.5, 0.62), br = gp * 0.62;
      for (const sd of [-1, 1]) {
        let pts;
        if (g.br === 'paren') pts = [Pm(sd * gp * 0.7, H), Pm(sd * gp * 1.12, H * 0.66), Pm(sd * gp * 1.12, H * 0.34), Pm(sd * gp * 0.72, 0.9)];
        else pts = [Pm(sd * gp * 0.62, H), Pm(sd * gp * 0.86, H * 0.92), Pm(sd * gp * 0.82, H * 0.62), Pm(sd * gp * 1.15, H * 0.5), Pm(sd * gp * 0.82, H * 0.38), Pm(sd * gp * 0.85, H * 0.1), Pm(sd * gp * 0.62, 0.9)];
        if (g.br === 'square') { bar(ink, Pm(sd * gp, H), Pm(sd * gp, 0.9), 2.5 * k); for (const y of [H, 0.9]) bar(ink, Pm(sd * gp, y), Pm(sd * gp * 0.62, y), 2 * k); }
        else penG(ink, pts, (g.br === 'brace' ? 2.1 : 2.6) * k, { con: 0.55, t0: 0.55, t1: 0.55, per: 6 });
        tick(sd * gp * (g.br === 'square' ? 1 : 0.72) * k, -1.2 * k, sd);
        const hxk = sd * gp * (g.br === 'square' ? 1 : g.br === 'paren' ? 1.08 : 0.95);
        ink.oval(Pm(hxk, hy - 0.4), 1.5 * k, 1.1 * k);
        bar(ink, Pm(hxk, hy - 0.4), Pm(sd * br * 0.7, hy - 0.2), 1.4 * k);
      }
      hr = br * k; hc = Pm(0, hy + 0.6); ink.dot(hc, hr);
      eyes.push(...[-1, 1].map(sd => ({ p: [hc[0] + sd * hr * 0.42, hc[1] - hr * 0.05], r: hr * 0.26 / 1.5 })));
      tailP = Pm(-gp, hy * 0.5); tailDir = PI;
      break;
    }
    default: { // 'word': a nonsense cursive word walking along
      let x = 0; const base = [P(-3, 1.6)];
      for (const u of g.units) {
        if (u === 'o') { ball(P(x + 1.5, 5.4), 4.5 * k); tick((x + 1.5) * k, -lg - 1.5 * k, rng.sign()); x += 10.5; }
        else if (u === 'l') { const H = rng.range(17.5, 21); penG(ink, [P(x - 2.4, 1.3), P(x + 2.9, H * 0.5), P(x + 4.3, H * 0.88), P(x + 2.6, H + 0.3), P(x + 0.4, H * 0.85), P(x, H * 0.4), P(x + 0.7, 1.3)], 2.2 * k, { con: 0.5 }); tick((x + 0.4) * k, -lg - k); x += 7.8; }
        else if (u === 'n') { for (const dx of [0, 5.6]) { bar(ink, P(x + dx, 9), P(x + dx, 1), 2.3 * k); tick((x + dx) * k, -lg - k); } penG(ink, [P(x, 7.6), P(x + 2.4, 11), P(x + 5, 10), P(x + 5.6, 7.4)], 2.2 * k, { con: 0.35 }); x += 10.6; }
        else { const H = rng.range(14, 17); bar(ink, P(x, H), P(x, 1), 2.4 * k); stroke(ink, [P(x - 3.2, H * 0.68), P(x + 3.6, H * 0.72)], 1.25 * k); tick(x * k, -lg - k); x += 7.6; }
        base.push(P(x - 4, 1.4 + j(0.3)));
      }
      base.push(P(x, 2.2), P(x + 2.6, 5.6));
      stroke(ink, base, 1.3 * k);
      hc = ball(P(x + 3.2, 8.2), 5 * k); hr = 5 * k; tick((x + 2.6) * k, -lg - 4 * k);
      penG(ink, [P(-3, 1.6), P(-7, 3.2), P(-9.6, 7.6), P(-7.6, 10.4)], 1.9 * k, { con: 0.3, t1: 0.5 });
      tailP = P(-7.6, 10.4); tailDir = -0.6;
    }
  }
  return {
    view: 'side', r: hr, path: [[hc[0] - hr * 3, hc[1]], hc], rad: () => hr * 0.7,
    jan: { face: { eyes, mounts: [{ p: polar(hc, -PI / 2 - 0.35, hr * 0.8), dir: -PI / 2 - 0.35, flip: -1, s: hr * 0.8 }], nose: { p: add(hc, [hr * 0.4, hr * 0.35]), dir: 0.15, s: hr * 0.9 } } },
    head: { p: hc, dir: -0.7, face: 0.05, s: hr * 0.9, sym: false },
    tail: { p: tailP, dir: tailDir, s: hr * 0.42 },
    limbs: [], back: [arcStrip(hc, hr, hr, PI * 1.05, PI * 1.55, 5)],
  };
};

// =====================================================================
// HEAD
// =====================================================================
// One head for all the folk. kind 'face' uses the face a margin-folk chassis has already laid
// out on its own body (plan.jan.face); on any other body it falls back to g.alt:
// 'round' (noseless, two eyes), 'soft' (short rounded snout), 'long' (long thin nose), 'beak'.
heads.janssonHead = (C, sock, g) => {
  const { ink, rng } = C, face = C.plan?.jan?.face;
  if (g.kind === 'face' && face) {
    if (g.nose && face.nose) { const n = face.nose, L = n.s * (0.55 + g.nose); ink.poly(tube(spline([n.p, polar(n.p, n.dir, L * 0.6), polar(n.p, n.dir + 0.25, L)], 5), profile([[0, n.s * 0.36], [1, Math.max(n.s * 0.17, 0.75)]]))); }
    return { eyes: face.eyes, mounts: face.mounts, spots: [] };
  }
  const kind = g.kind === 'face' ? g.alt : g.kind, sym = sock.sym, R = (g.R ?? 1) * sock.s;
  const c = polar(sock.p, sock.dir, R * 0.55), fa = sock.face, F = frame(c, fa, R, 1);
  ink.dot(c, R);
  ink.poly(tube(polyline([sock.p, c], 2), R * 0.72));
  if (g.fuzz) for (let i = 0; i < 16; i++) { const a = fa + PI * 0.35 + i / 15 * PI * 1.5; ink.poly(leaf(polar(c, a, R * 0.85), a + rng.range(-0.3, 0.3), R * g.fuzz * rng.range(0.8, 1.3), R * g.fuzz * 0.6, 0, 0.3)); }
  const dr = sym ? 0 : 1;
  if (kind === 'soft') {
    // a small BUTTON snout only (short, narrow, slightly upturned). Deliberately never a broad,
    // head-sized rounded muzzle: that, on a pear body with a tufted tail, is a famous character.
    const L = Math.min(g.len ?? 0.5, 0.62), tr = Math.min(g.tipR ?? 0.36, 0.4);
    ink.poly(tube(spline([F(0.45, 0.12 * dr), F(0.75 + L * 0.6, 0.12 * dr), F(0.8 + L, (0.06 - 0.1 * L) * dr)], 5), profile([[0, R * 0.5], [0.5, R * 0.38], [1, R * tr]])));
  } else if (kind === 'bulb') {
    // troll nose: a short bridge ending in a big round potato knob that hangs a little
    const L = g.blen ?? 0.7, nr = R * (g.bulbR ?? 0.55), tip = F(0.75 + L * 0.6, 0.3 * dr + (g.droop ?? 0.2) * L * 0.5 * dr);
    ink.poly(tube(spline([F(0.3, 0.05 * dr), lerp(F(0.3, 0.05 * dr), tip, 0.55), tip], 4), profile([[0, R * 0.42], [1, nr * 0.8]])));
    ink.dot(tip, nr);
  } else if (kind === 'long') {
    const L = g.nlen ?? 2, b = (g.droop ?? 0) * dr;
    ink.poly(tube(spline([F(0.4, 0.15 * dr), F(0.5 + L * 0.5, (0.15 + b * L * 0.15) * dr), F(0.5 + L, 0.15 * dr + b * L * 0.55)], 6), profile([[0, R * 0.5], [0.3, R * 0.27], [1, Math.max(R * 0.15, 0.75)]])));
    if (g.knob) ink.dot(F(0.5 + L, 0.15 * dr + b * L * 0.55), Math.max(R * 0.24, 1.1));
  } else if (kind === 'beak') {
    const L = g.blen ?? 0.9;
    ink.poly([F(0.7, -0.42), F(0.86 + L, 0.12 * dr), F(0.7, 0.5)]);
  }
  let top = null;
  if (g.cone && !sym) { // the head rises into a pointed, hat-like cone
    const hh = g.cone, fl = g.flop ?? 0; top = F(-0.35 - fl * 0.9, -0.5 - hh + fl * 0.5);
    const pts = [F(-0.08, -0.35), F(-0.2, -0.5 - hh * 0.55), F(-0.3 - fl * 0.2, -0.5 - hh * 0.92), top];
    ink.poly(tube(spline(pts, 6), profile([[0, R * 1.0], [0.3, R * 0.72], [0.8, R * 0.2], [1, Math.max(R * 0.1, 0.5)]])));
    if (g.brim) ink.oval(F(-0.05, -0.5), R * 1.3, R * 0.2, fa - 0.15);
    if (g.pom) ink.dot(top, Math.max(R * 0.2, 1.1));
  }
  if (g.beard && !sym) ink.poly(tube(spline([F(0.1, 0.5), F(0.3, 0.9 + g.beard * 0.5), F(0.2 + g.beard * 0.25, 0.9 + g.beard)], 6), profile([[0, R * 0.8], [0.5, R * 0.55], [1, 0.5]])));
  const eyes = [], mounts = [], er = R * (g.eyeR ?? 0.2);
  if (sym) for (const sd of [-1, 1]) { eyes.push({ p: F(0.15, sd * 0.46), r: er * 0.85 }); mounts.push({ p: F(-0.3, sd * 0.8), dir: fa + sd * 1.25, flip: sd, s: R }); }
  else {
    if (kind === 'round' || g.two) { eyes.push({ p: F(-0.12, -0.14), r: er }, { p: F(0.62 - er * 0.3 / R, -0.1), r: er * 0.86 }); }
    else eyes.push({ p: F(0.22, -0.18), r: er * 1.12 });
    mounts.push(top ? { p: top, dir: fa - PI / 2 - 0.4, flip: -1, s: R * 0.6 } : { p: F(-0.3, -0.8), dir: fa - (PI / 2 + 0.25), flip: -1, s: R });
  }
  return { eyes, mounts, spots: [] };
};

// =====================================================================
// FEET, TIPS, CROWNS, DORSALS
// =====================================================================
// small round pad; a flat-soled dome when it stands on the ground line
feet.janssonPad = (C, p, ang, s, g, k) => {
  const q = s * k * (g.footS ?? 1);
  if (C.plan.view === 'side' && Math.abs(Math.sin(ang)) < 0.3 && p[1] > -q * 0.5) dome(C.ink, p[0] + Math.cos(ang) * q * 0.16, 0, q * 0.42, q * 0.3);
  else C.ink.oval(polar(p, ang, q * 0.08), q * 0.27, q * 0.21, ang);
};
// bird foot: long front toes and a short back toe, flat on the line
feet.janssonBird = (C, p, ang, s, g, k) => {
  const q = s * k;
  if (C.plan.view === 'side' && p[1] > -q * 0.6) { bar(C.ink, [p[0] - q * 0.22, -0.6], [p[0] + q * 0.6, -0.6], 1.2); bar(C.ink, [p[0], -0.7], [p[0] + q * 0.42, -q * 0.2 - 0.6], 1.1); }
  else for (const d of [-0.5, 0, 0.5]) C.ink.line([p, polar(p, ang + d, q * 0.5)], 1);
};
// tassel: a plump brush with a bound neck and a couple of flyaway hairs
tips.janssonTassel = (C, e, ang, s, g) => {
  const { ink, rng } = C, q = s * (g.tipS ?? 0.8);
  // a brush: bound neck, a plump body, and a ragged end of a few strands (not a tulip)
  ink.oval(polar(e, ang, q * 0.15), q * 0.32, q * 0.5, ang);
  ink.poly(leaf(polar(e, ang, q * 0.1), ang, q * 2.0, q * 1.05, 0, 0.5));
  const n = rng.int(3, 4);
  for (let i = 0; i < n; i++) { const d = (i / (n - 1) - 0.5) * 0.55 + rng.range(-0.06, 0.06); ink.poly(leaf(polar(e, ang, q * 0.6), ang + d, q * rng.range(1.8, 2.4), q * 0.5, d * 0.25, 0.35)); }
};
// three soft feathers
tips.janssonFan = (C, e, ang, s, g) => { const q = s * (g.tipS ?? 1); for (const d of [-0.42, 0, 0.42]) C.ink.poly(leaf(polar(e, ang, -q * 0.3), ang + d, q * (d ? 2.1 : 2.5), q * 0.85, d * 0.15, 0.6)); };
// single hairs: one to three thin curling strands, optionally beaded
crowns.janssonHair = (C, m, F, s, g) => {
  const { ink, rng } = C, n = g.n ?? 1, base = F(-0.15, 0);
  for (let i = 0; i < n; i++) {
    const a = m.dir + (i - (n - 1) / 2) * (g.spread ?? 0.5) + rng.range(-0.12, 0.12), L = s * g.len * rng.range(0.8, 1.15), mid = polar(base, a, L * 0.6);
    const end = polar(mid, a + m.flip * (g.curl ?? 0.8) * rng.range(0.5, 1.2), L * 0.5);
    ink.line([base, mid, end], Math.max(s * 0.09, 0.95));
    if (g.bead) ink.dot(end, Math.max(s * 0.13, 1));
  }
};
// soft cap: bobble hat or drooping nightcap
crowns.janssonCap = (C, m, F, s, g) => {
  const { ink } = C;
  if (m.far) return;
  if (g.shape === 'night') {
    const end = F(1.5 * g.len, m.flip * -1.0 * g.len);
    ink.poly(tube(spline([F(-0.15, m.flip * -0.25), F(0.75 * g.len, m.flip * -0.3), F(1.35 * g.len, m.flip * -0.6 * g.len), end], 6), profile([[0, s * 0.85], [0.4, s * 0.45], [1, Math.max(s * 0.1, 0.5)]])));
    ink.dot(end, Math.max(s * 0.2, 1.1));
  } else {
    ink.oval(F(0.12, m.flip * -0.25), s * 0.55 * g.len, s * 0.86, m.dir);
    ink.dot(F(0.12 + 0.62 * g.len, m.flip * -0.25), Math.max(s * 0.26, 1.1));
  }
};
// short fuzz with a few long single hairs
dorsals.janssonFuzz = (C, plan, st, sd, si, g) => {
  const { ink, rng } = C, r = plan.r, n = st.length, side = plan.view === 'side';
  for (let i = 0; i < g.n; i++) {
    const k = st[clamp(Math.round(i / (g.n - 1) * (n - 1)), 0, n - 1)], a = k.dir + (side ? (plan.rooted ? sd * 0.4 : -0.5) : sd * 0.6) + rng.range(-0.25, 0.25);
    ink.poly(leaf(polar(k.p, k.dir, -r * 0.2), a, r * g.len * rng.range(0.7, 1.2), r * 0.3, rng.range(-0.2, 0.2), 0.3));
  }
  for (let i = 0; i < (g.hairs ?? 0); i++) {
    const k = st[rng.int(1, n - 2)], a = k.dir + rng.range(-0.4, 0.4), L = r * rng.range(0.8, 1.3), mid = polar(k.p, a, L * 0.6);
    ink.line([polar(k.p, k.dir, -r * 0.15), mid, polar(mid, a + rng.range(-1, 1), L * 0.45)], 0.95);
  }
};
// something carried on the back: a pennant on a pole, a bundle on a stick, an umbrella, a lantern
dorsals.janssonProp = (C, plan, st, sd, si, g, at) => {
  const { ink, rng } = C, r = plan.r;
  if (si !== 0) return;
  if (plan.view !== 'side') return dorsals.janssonFuzz(C, plan, st, sd, si, { n: 7, len: 0.4, hairs: 2 });
  const k = at(g.at ?? 0.6), base = polar(k.p, k.dir, -r * 0.3), a = -PI / 2 - rng.range(0.05, 0.3), sc = r * (g.size ?? 0.8);
  const top = polar(base, a, sc * rng.range(2.6, 3.4));
  if (g.kind === 'bundle') { const e = polar(base, a - 0.5, sc * 2.4); stroke(ink, [base, e], 1.4); bundleAt(ink, e, sc * 0.9); }
  else if (g.kind === 'umbrella') { stroke(ink, [base, top], 1.3); canopy(ink, top, sc * 1.7, 3); }
  else if (g.kind === 'lantern') { const t2 = add(top, [sc * 0.8, sc * 0.1]); stroke(ink, [base, top, t2], 1.3); bar(ink, t2, add(t2, [0, sc * 0.3]), 1); lanternAt(ink, add(t2, [0, sc * 0.3]), sc); }
  else { stroke(ink, [base, top], 1.3); ink.dot(top, 1.25); pennant(C, top, sc, g.kind === 'swallow' ? 'swallow' : 'tri'); }
};

// =====================================================================
// GENES
// =====================================================================
const hd = (r, o = {}) => ({
  type: 'janssonHead', kind: 'face', alt: r.wpick([[1.5, 'soft'], [2, 'long'], [1.8, 'round'], [0.5, 'beak'], [0.9, 'bulb']]),
  R: r.range(0.95, 1.1), len: r.range(0.35, 0.6), nlen: r.range(1.3, 2.4), blen: r.range(0.5, 0.9), bulbR: r.range(0.42, 0.58), droop: r.range(-0.15, 0.4), tipR: r.range(0.3, 0.4),
  nose: r.chance(0.45) ? r.range(0.15, 0.6) : 0, knob: r.chance(0.2), eyeR: r.range(0.18, 0.22), two: r.chance(0.3), ...o,
});
const limbsFolk = (r, o = {}) => ({ len: r.range(0.75, 1.0), w: r.range(0.3, 0.38), taper: 0.85, bend: r.range(0.3, 0.9), foot: 'janssonPad', lift: r.range(0.18, 0.34), stance: 0.2, arm: 1.0, ...o });
const tassel = (r, o = {}) => ({ len: r.range(3.2, 5.2), w0: 0.22, mid: 0.5, w1: 0.14, curl: r.range(1.0, 2.4), wave: r.range(0.5, 1.5), tip: 'janssonTassel', tipS: r.range(0.65, 0.85), up: r.chance(0.75), ...o });
const tailAny = r => r.wpick([[3, tassel(r)], [1.4, none()], [0.8, { len: r.range(3.5, 6), w0: 0.2, mid: 0.5, w1: 0.1, curl: r.range(1, 2.4), wave: 1, tip: 'point', up: true }], [0.6, { len: r.range(2, 3.5), w0: 0.18, mid: 0.5, w1: 0.14, curl: 0.8, wave: 0.6, tip: 'pom', tipS: 0.75 }]]);
const hair = (r, o = {}) => ({ type: 'janssonHair', n: r.int(1, 3), len: r.range(0.9, 1.6), spread: r.range(0.3, 0.7), curl: r.range(0.3, 1.2), bead: r.chance(0.25), ...o });
const earsPoint = r => ({ type: 'ears', len: r.range(1.0, 1.5), wid: r.range(0.55, 0.75), lean: 0, fat: 0.38, pair: true });
const earsRound = r => ({ type: 'ears', shape: 'round', len: r.range(0.6, 0.85), wid: r.range(0.7, 0.9), pair: true });
const earsLong = r => ({ type: 'ears', len: r.range(1.9, 2.8), wid: r.range(0.6, 0.8), lean: r.range(-0.25, 0.1), bend: 0.06, fat: 0.5, pair: true });
const cap = r => ({ type: 'janssonCap', shape: r.pick(['bobble', 'bobble', 'night']), len: r.range(0.9, 1.25) });
const crownAny = r => r.wpick([[2, hair(r)], [2, earsPoint(r)], [1.4, earsRound(r)], [1, { type: 'tuft', n: r.int(3, 5), spread: r.range(0.8, 1.6), len: r.range(0.8, 1.4) }], [0.8, earsLong(r)], [0.7, cap(r)], [1.5, none()]]);
const fuzz = r => ({ type: 'janssonFuzz', n: r.int(9, 14), len: r.range(0.3, 0.5), hairs: r.int(0, 3) });
const dorsalAny = r => r.wpick([[5, none()], [1.2, fuzz(r)], [0.5, { type: 'janssonProp', kind: r.pick(['flag', 'swallow', 'bundle', 'umbrella', 'lantern']), size: r.range(0.7, 0.9), at: r.range(0.5, 0.75) }]]);
const eyesRing = () => ({ eyes: 'ring', eyeS: 0.75 });
const folkBody = (r, o = {}) => r.wpick([
  [1.2, { type: 'janssonFolk', shape: r.pick(['lump', 'egg', 'gourd', 'sack']), w: r.range(7.5, 9.5), hk: r.range(1.65, 2.3), face: 'front', ...o }],
  [1, { type: 'janssonFolk', shape: 'squat', w: r.range(9.5, 11), hk: r.range(1.05, 1.3), face: 'front', ...o }],
  [0.8, { type: 'janssonFolk', shape: 'cone', w: r.range(7.5, 9), hk: r.range(2.2, 2.8), face: 'front', ...o }],
  [2, { type: 'janssonFolk', shape: 'pear', w: r.range(7.5, 9.5), hk: r.range(1.6, 2.0), face: 'side', lean: r.range(0, 0.1), headS: r.range(0.72, 0.85), ...o }],
  [1, { type: 'janssonFolk', shape: 'tall', w: r.range(4.8, 6), hk: r.range(3.6, 4.8), face: 'side', lean: r.range(0, 0.06), headS: r.range(0.95, 1.1), ...o }],
]);
const sp = (name, w, genes) => ({ name, w, genes });
// Copyright guard (docs/tags/jansson.md): a snouted profile head + ears on a pear body is the
// silhouette of a famous character. Any folk whose head shows a snout in profile gets no ears
// (hair, tufts, caps instead), and the snout itself is only ever a small button (see head).
const std = (r, o) => {
  const g = { limbs: limbsFolk(r), tail: tailAny(r), dorsal: none(), crown: crownAny(r), surface: eyesRing(), head: hd(r), ...o };
  const hk = g.head.kind === 'face' ? (g.chassis.face === 'side' || g.chassis.type === 'janssonBean' ? g.head.alt : null) : g.head.kind;
  if ((hk === 'soft' || hk === 'bulb') && g.crown.type === 'ears') g.crown = r.chance(0.5) ? hair(r) : { type: 'tuft', n: r.int(3, 5), spread: r.range(0.6, 1.2), len: r.range(0.8, 1.3) };
  return g;
};
const glyph = (r, ch, o = {}) => ({ chassis: { type: 'janssonGlyph', lg: r.range(2.2, 4.6), sx: r.range(0.8, 1.25), sy: r.range(0.85, 1.18), sl: r.range(-0.12, 0.3), wt: r.range(0.8, 1.3), wob: r.range(0.6, 2.2), ...ch }, head: hd(r, { alt: 'round', nose: 0 }), limbs: limbsFolk(r), dorsal: none(), crown: r.wpick([[1.4, hair(r, { n: r.int(1, 3), len: r.range(0.9, 1.5) })], [0.8, { type: 'tuft', n: r.int(2, 4), spread: r.range(0.5, 1.0), len: r.range(0.7, 1.2) }], [0.6, earsPoint(r)], [2, none()]]), tail: r.chance(0.3) ? tassel(r, { len: r.range(2.5, 4.5) }) : none(), surface: eyesRing(), ...o });

const species = [
  // ----- word-creatures -----
  sp('comma crawler', 3.5, r => glyph(r, { kind: 'comma', k: r.range(1.25, 1.6), n: r.wpick([[3, 1], [2, 2], [0.7, 3]]), curl: r.range(0, 1), legs: r.int(2, 4) })),
  sp('ampersand knot', 3.5, r => glyph(r, { kind: 'amp', k: r.range(1.35, 1.65) })),
  sp('minim caterpillar', 3, r => glyph(r, { kind: 'minim', k: r.range(1.25, 1.55), n: r.int(2, 5), amp: r.range(0, 2.2), ph: r.range(0, 6) })),
  sp('loop runner', 3, r => glyph(r, { kind: 'loop', k: r.range(1.2, 1.45), tall: Array.from({ length: r.int(2, 4) }, () => r.chance(0.5)) })),
  sp('query hook', 3, r => glyph(r, { kind: 'query', k: r.range(1.15, 1.55), hs: r.range(0.75, 1.3), hv: r.range(0.7, 1.45), bw: r.range(4.2, 7.5), nk: r.range(-1, 6), hr: r.range(3, 4.6), flip: r.chance(0.3), arms: r.chance(0.4) }, { tail: r.chance(0.5) ? tassel(r, { len: r.range(3, 5) }) : none() })),
  sp('spiral snail', 3.5, r => glyph(r, { kind: 'at', k: r.range(1.05, 1.4), R: r.range(6.5, 11.5), turns: r.range(1.25, 1.85), es: r.range(0.8, 1.35), nl: r.range(0.55, 1.6), hr: r.range(2.6, 4.2) }, { crown: r.chance(0.75) ? { type: 'antennae', len: r.range(1.2, 2.4), curve: r.range(-0.4, 0.2), club: true, pair: true } : none() })),
  sp('bracket peeper', 3, r => glyph(r, { kind: 'bracket', k: r.range(1.2, 1.45), br: r.wpick([[2.2, 'paren'], [1, 'brace'], [1.3, 'square']]), H: r.range(17, 22), gap: r.range(7, 8.5) }, { crown: r.chance(0.5) ? hair(r, { n: r.int(1, 3), len: r.range(0.8, 1.3) }) : none() })),
  sp('swash inchworm', 3, r => glyph(r, { kind: 'swash', k: r.range(1.15, 1.45), arch: r.range(-1.5, 6), curl: r.range(-1, 3) })),

  // ----- single folk -----
  sp('shy lump', 4, r => std(r, { chassis: { type: 'janssonFolk', ...r.wpick([[1.5, { shape: 'squat', w: r.range(11.5, 13.5), hk: r.range(0.85, 1.1) }], [1, { shape: 'lump', w: r.range(11, 13), hk: r.range(1.0, 1.25) }]]), face: 'front', eyeK: r.range(0.95, 1.2) }, limbs: limbsFolk(r, { len: r.range(0.5, 0.75) }), crown: r.wpick([[2, { type: 'tuft', n: r.int(2, 4), spread: r.range(0.4, 0.8), len: r.range(0.6, 1.0) }], [1.5, none()], [1, earsRound(r)]]) })),
  sp('shaggy mop', 2.5, r => std(r, { chassis: { type: 'janssonFolk', shape: r.pick(['drop', 'tall']), w: r.range(7.5, 9), hk: r.range(2.5, 3.2), face: 'front', fuzz: r.range(0.38, 0.52), shag: r.range(0.7, 0.95), arms: 0, eyeT: r.range(0.55, 0.66), eyeK: r.range(0.85, 1.05), liftK: r.range(0.7, 1.1) }, head: hd(r, { nose: r.chance(0.45) ? r.range(0.2, 0.5) : 0, fuzz: 0.4, alt: 'round' }), limbs: limbsFolk(r, { len: r.range(0.7, 0.95) }), crown: r.wpick([[2, { type: 'tuft', n: r.int(3, 5), spread: r.range(0.5, 1.0), len: r.range(1.0, 1.6) }], [1.5, hair(r, { n: r.int(1, 2), len: r.range(1.2, 1.8) })], [1, none()]]), tail: none() })),
  sp('pear sitter', 3, r => std(r, { chassis: { type: 'janssonFolk', shape: 'pear', w: r.range(9, 11), hk: r.range(1.6, 1.9), face: 'side', sit: true, lean: r.range(-0.03, 0.08), headS: r.range(0.7, 0.82), tb: 0.2 }, head: hd(r, { kind: r.wpick([[2, 'long'], [1.6, 'round'], [0.8, 'soft'], [0.6, 'beak']]) }), limbs: limbsFolk(r, { stance: r.range(0.45, 0.7), lift: 0 }), tail: tassel(r, { len: r.range(2.6, 3.8), up: r.chance(0.6), curl: r.range(0.6, 1.8) }) })),
  sp('back-turned sitter', 2.5, r => std(r, { chassis: { type: 'janssonFolk', shape: 'pear', w: r.range(9, 12), hk: r.range(1.7, 2.1), face: 'back', arms: 0, tb: 0.2 }, head: hd(r, { nose: 0 }), limbs: limbsFolk(r, { lift: 0 }), crown: r.wpick([[2, earsPoint(r)], [2, earsLong(r)], [1.5, { type: 'tuft', n: r.int(3, 5), spread: 1.2, len: r.range(0.9, 1.4) }], [1, hair(r, { n: r.int(2, 3) })]]), tail: tassel(r, { len: r.range(4.5, 6.5), up: r.chance(0.6), curl: r.range(1.2, 2.6), wave: r.range(0.8, 2) }) })),
  sp('tall wanderer', 3, r => std(r, { chassis: { type: 'janssonFolk', shape: 'tall', w: r.range(4.8, 6.2), hk: r.range(4, 5.6), face: 'side', lean: r.range(0.01, 0.06), headS: r.range(0.95, 1.15), prop: r.wpick([[2, 'bundle'], [1.5, 'lantern'], [1, null]]), armT: 0.62 }, head: hd(r, { kind: r.pick(['long', 'round', 'beak']) }), crown: r.wpick([[2, earsLong(r)], [1.5, { type: 'tuft', n: r.int(3, 5), spread: r.range(0.6, 1.2), len: r.range(1.0, 1.6) }], [1, hair(r, { n: r.int(2, 3) })]]), tail: r.chance(0.4) ? tassel(r) : none() })),
  sp('long-nose scuttler', 3, r => std(r, { chassis: { type: 'janssonBean', r: r.range(6.5, 8), len: r.range(12, 19), tilt: r.range(-0.12, 0.1), headS: r.range(0.78, 0.9), neck: r.range(0.3, 0.7) }, head: hd(r, { kind: 'long', nlen: r.range(2, 3.2), droop: r.range(-0.2, 0.35), knob: r.chance(0.3) }), limbs: limbsFolk(r, { len: r.range(0.9, 1.2), lift: r.range(0.3, 0.6), stance: 0.3 }), tail: r.wpick([[2, tassel(r, { up: true })], [1, { len: r.range(4, 6), w0: 0.2, mid: 0.5, w1: 0.1, curl: r.range(1.5, 2.6), wave: 0.5, tip: 'point', up: true }]]), crown: r.wpick([[2, earsRound(r)], [2, earsPoint(r)], [1, hair(r)], [1, earsLong(r)]]), dorsal: r.chance(0.25) ? fuzz(r) : none() })),
  sp('hunched troll', 2.5, r => std(r, { chassis: { type: 'janssonFolk', shape: r.pick(['lump', 'pear']), w: r.range(10, 12), hk: r.range(1.55, 1.85), face: 'side', lean: r.range(0.14, 0.24), neckT: 0.84, headS: r.range(0.68, 0.8), look: r.range(0.15, 0.4), armT: 0.6 }, head: hd(r, { kind: r.wpick([[3, 'bulb'], [1, 'long']]), blen: r.range(0.5, 0.9), bulbR: r.range(0.55, 0.72), nlen: r.range(1.5, 2.3), droop: r.range(0.3, 0.6), knob: true, eyeR: 0.17 }), limbs: limbsFolk(r, { arm: 1.35, bend: r.range(0.2, 0.5) }), crown: r.wpick([[2, { type: 'ears', len: r.range(0.9, 1.3), wid: 0.6, lean: -0.3, fat: 0.4, pair: true, size: 0.8 }], [1.5, { type: 'tuft', n: r.int(3, 5), spread: 1.0, len: r.range(0.8, 1.3) }], [1, hair(r, { n: r.int(2, 3) })]]), dorsal: r.chance(0.5) ? { type: 'janssonFuzz', n: r.int(5, 7), len: r.range(0.3, 0.45), hairs: 0 } : none(), tail: tassel(r, { len: r.range(3.5, 5.5) }) })),
  sp('farm sprite', 2.5, r => std(r, { chassis: { type: 'janssonTomte', w: r.range(7, 8.8), hk: r.range(1.5, 1.9), hat: r.range(1.2, 1.9), flop: r.chance(0.5) ? r.range(0.2, 0.8) : 0, pom: r.chance(0.4), nose: r.range(0.3, 0.4), beard: r.range(0.6, 0.85), eye: r.chance(0.5), lean: r.range(0, 0.06), prop: r.wpick([[3, null], [1, 'lantern']]), arms: r.chance(0.6) }, limbs: none(), crown: none(), tail: none() })),
  sp('bird folk', 2.5, r => std(r, { chassis: { type: 'janssonBean', two: true, r: r.range(6.5, 8.5), len: r.range(9, 14), tilt: r.range(0.25, 0.6), liftK: r.range(1.1, 2.4), rear: 0.6, front: 0.8, headS: r.range(0.68, 0.8), neck: r.range(0.7, 1.1) }, head: hd(r, { kind: 'beak', blen: r.range(0.6, 2.2), two: false }), limbs: limbsFolk(r, { len: 1.5, w: 0.15, taper: 0.9, lift: 1, stance: 0.15, foot: 'janssonBird' }), tail: { len: r.range(0.8, 1.6), w0: 0.5, mid: 0.5, w1: 0.4, curl: r.range(0, 0.6), wave: 0, tip: 'janssonFan', tipS: r.range(0.8, 1.2), up: true }, crown: r.wpick([[2, hair(r)], [1.5, { type: 'tuft', n: 3, spread: 0.8, len: r.range(0.9, 1.5) }], [1, none()]]) })),

  // ----- bearers -----
  sp('lantern bearer', 2.5, r => std(r, { chassis: folkBody(r, { prop: r.pick(['lantern', 'lantern', 'candle']) }) })),
  sp('umbrella walker', 2.5, r => std(r, { chassis: folkBody(r, { prop: 'umbrella' }), crown: r.wpick([[2, none()], [1, earsRound(r)], [1, hair(r, { len: 0.8 })]]) })),
  sp('suitcase traveller', 2, r => std(r, { chassis: folkBody(r, { prop: 'suitcase', scarf: r.chance(0.35) }) })),
  sp('angler', 2, r => std(r, { chassis: { type: 'janssonFolk', shape: 'pear', w: r.range(8.5, 10.5), hk: r.range(1.6, 1.9), face: 'side', sit: true, headS: r.range(0.7, 0.82), prop: 'rod', tb: 0.2 }, head: hd(r, { kind: r.wpick([[2, 'long'], [1.6, 'round'], [0.7, 'soft']]) }), limbs: limbsFolk(r, { stance: r.range(0.45, 0.7), lift: 0 }), tail: tassel(r, { len: r.range(2.6, 3.8), up: r.chance(0.6), curl: r.range(0.6, 1.8) }) })),
  sp('flag bearer', 2.5, r => std(r, { chassis: folkBody(r, { prop: r.pick(['flag', 'flag', 'quill', 'net']) }) })),

  // ----- several on one base, peepers, oddities -----
  sp('huddle', 3.5, r => std(r, { chassis: { type: 'janssonGroup', mode: 'huddle', n: r.wpick([[3, 2], [1, 3]]), w: r.range(7.5, 9) }, tail: r.chance(0.4) ? tassel(r, { len: r.range(3.5, 5.5) }) : none() })),
  sp('stack', 1.8, r => std(r, { chassis: { type: 'janssonGroup', mode: 'stack', n: r.int(2, 3), w: r.range(8.5, 10.5) }, limbs: limbsFolk(r, { arm: 0.9, bend: 0.3 }), tail: r.chance(0.4) ? tassel(r) : none() })),
  sp('stone peeper', 2.5, r => std(r, { chassis: { type: 'janssonPeeper', kind: 'stone', sw: r.range(12, 16), sh: r.range(9, 13), hr: r.range(4.2, 5.4) }, crown: r.wpick([[2, earsPoint(r)], [1.5, earsLong(r)], [1.5, hair(r)], [1, earsRound(r)]]), tail: tassel(r, { len: r.range(3.5, 6) }) })),
  sp('burrow peeper', 2, r => std(r, { chassis: { type: 'janssonPeeper', kind: 'burrow', hr: r.range(8.5, 10.5) }, crown: r.wpick([[2, earsPoint(r)], [2, earsLong(r)], [1.5, hair(r)], [1, earsRound(r)]]), tail: r.chance(0.65) ? tassel(r, { len: r.range(3.5, 6), up: true, curl: r.range(0.6, 1.6) }) : none() })),
  sp('pot dweller', 3, r => std(r, { chassis: { type: 'janssonPeeper', kind: r.wpick([[2.5, 'pot'], [1, 'boot'], [2, 'cup']]), pw: r.range(8.5, 10.5), ph: r.range(15, 20), handles: r.chance(0.75), cap: r.chance(0.6) }, limbs: limbsFolk(r, { lift: r.chance(0.5) ? 0 : r.range(0.4, 0.9) }), tail: r.chance(0.35) ? tassel(r, { len: r.range(3.5, 5.5) }) : none() })),
  sp('grass lurker', 2, r => std(r, { chassis: { type: 'janssonPeeper', kind: 'grass', hr: r.range(7, 8.5), blades: r.int(8, 12) }, crown: r.wpick([[2, earsPoint(r)], [1, earsLong(r)], [1, none()]]), tail: r.chance(0.5) ? tassel(r, { len: r.range(4, 6) }) : none() })),
  sp('snail folk', 2.5, r => std(r, { chassis: { type: 'janssonSnail', r: r.range(8.5, 11), shell: r.wpick([[2.5, 'coil'], [1.5, 'spire'], [1.5, 'house']]) }, head: hd(r, { kind: r.pick(['round', 'soft']), R: 1, len: 0.5, tipR: 0.6, droop: 0.1, two: false, eyeR: 0.22 }), crown: { type: 'antennae', len: r.range(1.6, 2.4), curve: r.range(-0.3, 0.1), club: true, pair: true }, tail: none() })),
  sp('curled sleeper', 2, r => std(r, { chassis: { type: 'janssonSleeper', w: r.range(13, 16), hg: r.range(9.5, 12), snout: r.range(0.6, 1.0) }, head: hd(r, { nose: 0 }), crown: r.wpick([[2, { ...earsPoint(r), pair: false }], [1.5, { ...earsLong(r), pair: false }], [1, { ...earsRound(r), pair: false }]]), tail: tassel(r, { len: r.range(5.5, 7), up: true, curl: r.range(2.6, 3.3), wave: 0 }), dorsal: r.chance(0.2) ? fuzz(r) : none() })),
];

export default {
  id: 'jansson',
  label: 'Jansson-ish marginalia folk',
  short: 'Margin folk',
  sig: { head: 3, tail: 2, crown: 1.5, dorsal: 0.7 },
  species,
};
