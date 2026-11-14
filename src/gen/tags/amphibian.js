// Amphibians: frogs and toads in bulk, with tadpoles, caecilians and a couple of newts.
//
// Shape vocabulary registered here (all prefixed `amphibian`):
//   chassis  amphibianSit       side view: sitting / crouching / walking frog, toad or newt
//            amphibianTop       top view: frog body seen from above
//            amphibianLeap      side view: frog at full stretch, pushing off the line
//            amphibianFront     front view: frog sitting face-on
//            amphibianUnken     side view: fire-bellied toad arched in the unken reflex
//            amphibianPad       side view: sitting frog on a lily pad
//            amphibianTadpole   tadpole body (top or side view)
//            amphibianCaecilian top view: ringed limbless burrower (wave, loop, coil)
//   heads    amphibianFrog (side wedge / top triangle), amphibianFace (face-on),
//            amphibianBlunt (caecilian bullet), amphibianNone
//   feet     amphibianLeg   -- draws the WHOLE limb (see note at `feet.amphibianLeg`)
//   crowns   amphibianEyes (bulging top-set eyes), amphibianBrow (eyelid horns)
//   dorsals  amphibianWarts, amphibianEggs (bead string at the hips), amphibianHair (hairy frog fringe)
import { add, mul, lerp, dist, angOf, polar, angDiff, clamp, mix, MINW, frame, spline, polyline, profile, pathAt, tube, ellipse, leaf } from '../core.js';
import { chassis, heads, feet, crowns, dorsals } from '../parts.js';

const PI = Math.PI;
const none = () => ({ type: 'none' });

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------
// Closed Catmull-Rom through control points.
function blob(ctrl, per = 6) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  return out;
}
// Strip of dorsal anchor points (same convention as the shared chassis: 15% inside the surface).
function strip(path, rad, t0, t1, n, sideSign) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = mix(t0, t1, i / (n - 1)), { p, ang } = pathAt(path, t), na = ang + sideSign * PI / 2;
    out.push({ p: polar(p, na, rad(t) * 0.85), dir: na, t });
  }
  return out;
}
// Two-bone joint position; `score` picks which of the two solutions to use.
function kneeOf(a, b, l1, l2, score) {
  const d = Math.max(Math.min(dist(a, b), (l1 + l2) * 0.999), 1e-6), base = angOf(a, b);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
  const m = polar(a, base, x), k1 = polar(m, base + PI / 2, h), k2 = polar(m, base - PI / 2, h);
  return score(k1) >= score(k2) ? k1 : k2;
}
// Fan of toes from p. o: { n, len, spread | angs, pad, web, maxY, tr }
function toes(C, p, ang, s, o) {
  const { ink } = C, n = o.n ?? 4, tr = Math.max((o.tr ?? 0.075) * s, MINW / 2), tp = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0.5;
    const a = o.angs ? o.angs[i] : ang + (u - 0.5) * o.spread;
    const len = o.len * s * (o.lens ? o.lens[i] : 1 - 0.5 * Math.abs(u - (o.long ?? 0.55)));
    const tip = polar(p, a, len);
    if (o.maxY != null) tip[1] = Math.min(tip[1], o.maxY - Math.max(tr, o.pad ? o.pad * s : 0));
    ink.poly(tube([p, lerp(p, tip, 0.5), tip], [tr * 1.2, tr, tr * 0.85]));
    if (o.pad) ink.dot(tip, Math.max(o.pad * s, MINW * 0.85));
    tp.push(tip);
  }
  if (o.web > 0.05 && n > 1) {
    const w = [p];
    for (let i = 0; i < n; i++) { w.push(lerp(p, tp[i], o.web)); if (i < n - 1) w.push(lerp(p, lerp(tp[i], tp[i + 1], 0.5), o.web * 0.82)); }
    ink.poly(w);
  }
  ink.dot(p, Math.max((o.base ?? 0.13) * s, tr));
  return tp;
}
// Body tube with smooth round ends (tube()'s own end caps are coarse on fat bodies).
function bodyTube(ink, path, rad) {
  ink.poly(tube(path, rad));
  const n = path.length - 1, r0 = rad(0), r1 = rad(1);
  if (r0 > 2) ink.poly(ellipse(path[0], r0, r0, 0, 24));
  if (r1 > 2) ink.poly(ellipse(path[n], r1, r1, 0, 24));
}
const seg = (C, pts, r0, r1, rm) => C.ink.poly(tube(spline(pts, 5), profile([[0, r0], [0.4, rm ?? mix(r0, r1, 0.35)], [1, r1]])));

// ---------------------------------------------------------------------
// LIMBS
// The shared limb() can only draw one generic two-bone leg (its `fold` frog leg is a
// stick), so amphibian limbs are drawn here in full. Mechanism: the limb gene has
// `len: NaN`, which makes every polygon the shared limb() emits non-finite (Ink drops
// those), and `foot: 'amphibianLeg'`, whose handler is called exactly once per socket in
// plan.limbs order; it looks the socket up by call index and draws the whole limb.
// ---------------------------------------------------------------------
feet.amphibianLeg = (C, _p, _ang, _s, g) => {
  const i = C.amphLimbI ?? 0; C.amphLimbI = i + 1;
  const sock = C.plan?.limbs?.[i];
  if (!sock) return;
  const role = sock.role;
  // limbless species lend a frog's legs instead of nothing: on their own chassis they draw none
  if (g.ownNone && C.plan.amphLimbless) return;
  if (g.only && C.plan.amphLimbless != null && role !== g.only) return;
  if (C.plan.view === 'top') return topLeg(C, sock, g);
  if (sock.pose === 'frontHind') return frontHind(C, sock, g);
  if (sock.pose === 'frontFore') return frontFore(C, sock, g);
  if (sock.pose === 'leap') return leapLeg(C, sock, g);
  if (role === 'arm' || sock.ground == null) return freeLimb(C, sock, g);
  if (role === 'root') return sideHind(C, sock, g, (sock.stanceDir ?? sock.side) >= 0 ? 1 : -1);
  if (role === 'hind') return sideHind(C, sock, g, 1);
  return sideFore(C, sock, g);
};

// Side view, sitting: the folded Z. Thigh runs forward and a little down from the hip to a
// knee that pokes out under the belly; the shin runs back down to a heel tucked under the
// rump; the long foot runs forward along the line, toes reaching out past the knee.
function sideHind(C, sock, g, m) {
  if (g.stride) return sideStride(C, sock, g, m);
  const far = sock.far, k = far ? 0.88 : 1, s = sock.s * k, G = sock.ground ?? 0;
  const hip = far ? add(sock.p, [m * (g.farDX0 ?? 0) * s, -0.04 * s]) : sock.p;
  const hw = g.hw * s, kr = hw * 0.62, ar = Math.max(hw * 0.36, MINW * 0.8), fr = Math.max(hw * 0.27, MINW * 0.75);
  const H = Math.max(G - hip[1], hw);
  const th = g.hl * s * (g.thigh ?? 1.1);
  const kh = clamp(H * (g.kneeH ?? 0.55), kr + ar * 1.6, H + 0.2 * s);
  const dy = H - kh, kx = Math.sqrt(Math.max(th * th - dy * dy, th * th * 0.3));
  const kn = [hip[0] + m * kx, G - kh];
  const heel = [hip[0] - m * (g.heelX ?? 0.08) * s, G - ar];
  // thigh: full at the hip, swelling a touch, knee rounded
  seg(C, [hip, lerp(hip, kn, 0.55), kn], hw, kr, hw * 1.02);
  seg(C, [kn, lerp(kn, heel, 0.5), heel], kr, ar, kr * 0.92);
  const tb = [heel[0] + m * g.hf * s, G - fr];
  C.ink.poly(tube(polyline([heel, tb], 3), profile([[0, ar], [1, fr]])));
  if (g.spade) C.ink.poly(leaf(add(heel, [0, -ar * 0.2]), m > 0 ? PI + 0.25 : -0.25, s * 0.5, s * 0.36, 0, 0.5));
  const st = g.toeFan ?? 0.3, base = m > 0 ? 0 : PI;
  toes(C, tb, 0, s, { n: 3, len: g.toeLen, angs: [0, 1, 2].map(i => base - m * i * st), lens: [1, 0.86, 0.66], pad: g.pad, web: g.web, maxY: G, tr: g.tr });
}

// Side view, walking: the older two-bone leg with the ankle placed behind or ahead.
function sideStride(C, sock, g, m) {
  const k = sock.far ? 0.9 : 1, s = sock.s * k, G = sock.ground ?? 0, hip = sock.p;
  const hw = g.hw * s, kr = hw * 0.64, ar = Math.max(hw * 0.4, MINW * 0.8), fr = Math.max(hw * 0.3, MINW * 0.75);
  let a = g.hl * s, b = a * 0.95;
  const ankle = [hip[0] + m * ((g.ankleX ?? 0.3) + (sock.far ? (g.farDX ?? 0.3) : 0)) * s, G - ar];
  const d = dist(hip, ankle);
  if (a + b < d * 1.05) { const f = d * 1.05 / (a + b); a *= f; b *= f; }
  let kn = kneeOf(hip, ankle, a, b, p => m * p[0] - p[1]);
  if (kn[1] > G - kr) kn = [kn[0], G - kr];
  seg(C, [hip, lerp(hip, kn, 0.5), kn], hw, kr, hw * 0.95);
  seg(C, [kn, lerp(kn, ankle, 0.5), ankle], kr, ar, kr * 0.95);
  const tb = [ankle[0] + m * g.hf * s, G - fr];
  C.ink.poly(tube(polyline([ankle, tb], 3), profile([[0, ar], [1, fr]])));
  if (g.spade) C.ink.poly(leaf(add(ankle, [0, -ar * 0.2]), m > 0 ? PI + 0.25 : -0.25, s * 0.5, s * 0.36, 0, 0.5));
  const st = g.toeFan ?? 0.34, base = m > 0 ? 0 : PI;
  toes(C, tb, 0, s, { n: 3, len: g.toeLen, angs: [0, 1, 2].map(i => base - m * i * st), lens: [1, 0.92, 0.7], pad: g.pad, web: g.web, maxY: G, tr: g.tr });
}

function sideFore(C, sock, g) {
  const k = sock.far ? 0.9 : 1, s = sock.s * k, G = sock.ground ?? 0, sh = sock.p;
  const r0 = Math.max(g.fw * s, MINW * 0.8), hr = Math.max(g.fw * s * 0.72, MINW * 0.75);
  const hand = [sh[0] + ((g.reach ?? 0.3) + (sock.far ? (g.farReach ?? 0.24) : 0)) * s, G - hr];
  const d = dist(sh, hand), L = Math.max(g.fl * s, d * 1.04);
  const el = kneeOf(sh, hand, L * 0.5, L * 0.5, p => -p[0] - 0.3 * p[1]);
  seg(C, [sh, el, hand], r0, hr);
  toes(C, hand, 0, s, { n: 3, len: g.toeLen * 0.8, angs: [0.05, -0.34, -0.72], lens: [1, 0.9, 0.7], pad: g.pad, web: (g.foreWeb ?? g.web * 0.4), maxY: G, tr: g.tr });
}

// Side view, in the air: arms of upright bodies, raised limbs.
function freeLimb(C, sock, g) {
  const s = sock.s * (sock.far ? 0.9 : 1), dir = sock.dir, bs = sock.bendS ?? (sock.side || 1), p = sock.p;
  if (sock.role === 'hind') {
    const z = sock.zig ?? 0.9, a = g.hl * s * 0.85, hw = g.hw * s * 0.85;
    const kn = polar(p, dir + bs * z * 0.5, a), an = polar(kn, dir - bs * z, a * 0.95), fa = dir + bs * z * 0.6, tb = polar(an, fa, g.hf * s * 0.8);
    seg(C, [p, lerp(p, kn, 0.5), kn], hw, hw * 0.62);
    seg(C, [kn, lerp(kn, an, 0.5), an], hw * 0.62, hw * 0.38);
    C.ink.poly(tube(polyline([an, tb], 3), Math.max(hw * 0.3, MINW * 0.75)));
    toes(C, tb, fa, s, { n: 4, len: g.toeLen, spread: 1.1, pad: g.pad, web: g.web, tr: g.tr });
  } else {
    const z = sock.zig ?? 0.8, L = g.fl * s * (sock.role === 'arm' ? 0.8 : 0.95), r0 = Math.max(g.fw * s, MINW * 0.8);
    const el = polar(p, dir + bs * z * 0.5, L * 0.5), fa = dir - bs * z * 0.5, hand = polar(el, fa, L * 0.5);
    seg(C, [p, el, hand], r0, r0 * 0.72);
    toes(C, hand, fa, s, { n: 4, len: g.toeLen * 0.8, spread: 1.5, pad: g.pad, web: (g.foreWeb ?? g.web * 0.4), tr: g.tr });
  }
}

// Side view, full stretch: the leg is one long line from hip to the toes on the ground.
function leapLeg(C, sock, g) {
  const s = sock.s * (sock.far ? 0.92 : 1), G = sock.ground ?? 0, hip = sock.p, H = Math.max(G - hip[1], s * 0.5), z = 0.3;
  let a = g.hl * s, c = g.hf * s, t = g.toeLen * s;
  let T = a * 1.95 * Math.cos(z * 0.6) + c + t * 0.5;
  if (T < H * 1.1) { const f = H * 1.1 / T; a *= f; c *= f; T *= f; }
  const dir = PI - Math.asin(clamp(H / T, 0.25, 0.97)) - (sock.far ? 0.16 : 0), hw = g.hw * s * 0.8;
  const cl = (q, r) => [q[0], Math.min(q[1], G - r)];
  const kn = cl(polar(hip, dir - z, a), hw * 0.6), an = cl(polar(kn, dir + z, a * 0.95), hw * 0.4), tb = cl(polar(an, dir - z * 0.4, c), hw * 0.3);
  seg(C, [hip, lerp(hip, kn, 0.5), kn], hw, hw * 0.6, hw * 0.95);
  seg(C, [kn, lerp(kn, an, 0.5), an], hw * 0.6, hw * 0.38, hw * 0.6);
  C.ink.poly(tube(polyline([an, tb], 3), Math.max(hw * 0.3, MINW * 0.75)));
  toes(C, tb, dir, s, { n: 3, len: g.toeLen, spread: 0.7, pad: g.pad, web: g.web, maxY: G, tr: g.tr });
}

// Face-on sitting frog: knees up and out at the sides, arms as pillars in the middle.
function frontHind(C, sock, g) {
  const s = sock.s, sd = sock.side, G = sock.ground ?? 0, hip = sock.p, hw = g.hw * s, ar = Math.max(hw * 0.42, MINW * 0.8);
  const kh = clamp(g.hl / 1.35, 0.55, 1.15);
  const kn = [hip[0] + sd * 0.62 * s * kh, hip[1] - 0.5 * s * kh], an = [hip[0] + sd * 0.42 * s, G - ar];
  seg(C, [hip, lerp(hip, kn, 0.5), kn], hw, hw * 0.66, hw);
  seg(C, [kn, add(lerp(kn, an, 0.5), [sd * 0.12 * s, 0]), an], hw * 0.66, ar, hw * 0.62);
  const tb = [an[0] + sd * g.hf * s * 0.55, G - ar * 0.8], base = sd > 0 ? 0 : PI;
  C.ink.poly(tube(polyline([an, tb], 3), ar * 0.85));
  toes(C, tb, 0, s, { n: 3, len: g.toeLen * 0.9, angs: [base, base - sd * 0.4, base - sd * 0.85], lens: [1, 0.9, 0.7], pad: g.pad, web: g.web, maxY: G, tr: g.tr });
}
function frontFore(C, sock, g) {
  const s = sock.s, sd = sock.side, G = sock.ground ?? 0, sh = sock.p, r0 = Math.max(g.fw * s * 1.1, MINW * 0.9);
  const hand = [sh[0] - sd * 0.08 * s, G - r0 * 0.8], el = add(lerp(sh, hand, 0.5), [sd * 0.14 * s, 0]), base = sd > 0 ? 0 : PI;
  seg(C, [sh, el, hand], r0, r0 * 0.8);
  toes(C, hand, 0, s, { n: 3, len: g.toeLen * 0.62, angs: [base, base - sd * 0.5, PI - base], lens: [1, 0.8, 0.75], pad: g.pad, web: 0, maxY: G, tr: g.tr });
}

// Top view. Angles are measured from "forward" (0) round through "outward" (PI/2) to "back" (PI).
const POSE = {
  sit: { h: [1.2, 3.0, 0.5], f: [1.3, -0.15] },         // folded Z either side of the body
  kick: { h: [2.5, 3.2, 2.95], f: [2.35, 2.9] },       // swimming: legs driven straight back, arms swept
  glide: { h: [1.75, 2.45, 1.75], f: [1.15, 0.55] },   // flying frog: everything spread
  splay: { h: [1.45, 2.75, 2.15], f: [0.8, 0.2] },     // clawed frog hanging in the water
  climb: { h: [1.15, 3.05, 0.95], f: [0.7, 0.15] },    // tree frog on a pane
  crawl: { h: [1.7, 2.55, 1.5], f: [1.3, 0.45] },      // toads and newts
  pipa: { h: [1.55, 2.35, 2.05], f: [0.75, 0.15] },    // Surinam toad: hind feet out-back, long arms reaching forward
};
function topLeg(C, sock, g) {
  const { rng } = C, s = sock.s, sd = sock.side || 1, f = sock.fwd ?? C.plan.head.face ?? 0, p = sock.p;
  const A = t => f + sd * t, P = POSE[g.pose] ?? POSE.sit, jit = g.loose ?? 0.14, pj = g.pj ?? [0, 0, 0];
  if (sock.role === 'hind') {
    let [t1, t2, t3] = P.h.map((v, i) => v + pj[i] + rng.range(-jit, jit));
    if (g.oneOut && sd === g.oneOut) { t1 += 0.9; t2 -= 0.45; t3 += 0.5; } // one leg trailing
    const a = g.hl * s, hw = g.hw * s * 0.82;
    const kn = polar(p, A(t1), a), an = polar(kn, A(t2), a * 0.95), tb = polar(an, A(t3), g.hf * s);
    seg(C, [p, lerp(p, kn, 0.5), kn], hw, hw * 0.66, hw * 0.98);
    seg(C, [kn, lerp(kn, an, 0.5), an], hw * 0.66, hw * 0.4, hw * 0.66);
    C.ink.poly(tube(polyline([an, tb], 3), profile([[0, hw * 0.4], [1, Math.max(hw * 0.32, MINW * 0.75)]])));
    toes(C, tb, A(t3), s, { n: g.toes ?? 4, len: g.toeLen, spread: g.spread ?? 1.15, pad: g.pad, web: g.web, tr: g.tr ?? 0.12, long: sd > 0 ? 0.62 : 0.38 });
  } else {
    let u = P.f[0], w = P.f[1];
    if (sock.role === 'mid') { u = Math.abs(angDiff(sock.dir, f)); w = u - 0.6; }
    u += pj[0] * 0.5 + rng.range(-jit, jit); w += rng.range(-jit, jit);
    const L = g.fl * s * (sock.role === 'arm' ? 0.8 : 1), r0 = Math.max(g.fw * s, MINW * 0.8);
    const el = polar(p, A(u), L * 0.48), hand = polar(el, A(w), L * 0.52);
    seg(C, [p, el, hand], r0, r0 * 0.72);
    toes(C, hand, A(w), s, { n: g.fingers ?? 3, len: g.toeLen * (g.fingerK ?? 0.72), spread: g.foreSpread ?? 1.7, pad: g.forePad ?? g.pad, web: g.foreWeb ?? g.web * 0.35, tr: g.tr ?? 0.12, long: 0.5 });
  }
}

// Leg proportions, in units of the socket scale (about one body radius).
const LEG = {
  frog: { hl: 1.36, hf: 1.05, hw: 0.43, fl: 1.6, fw: 0.2, toeLen: 0.72, pad: 0, web: 0.72, lift: 0.2 },
  toad: { hl: 0.92, hf: 0.62, hw: 0.4, fl: 1.35, fw: 0.24, toeLen: 0.46, pad: 0, web: 0.25, lift: 0.22 },
  tree: { hl: 1.3, hf: 0.95, hw: 0.32, fl: 1.65, fw: 0.16, toeLen: 0.6, pad: 0.17, web: 0.22, lift: 0.2 },
  dart: { hl: 1.12, hf: 0.78, hw: 0.28, fl: 1.95, fw: 0.15, toeLen: 0.5, pad: 0.11, web: 0, lift: 0.3 },
  stub: { hl: 0.6, hf: 0.42, hw: 0.36, fl: 0.95, fw: 0.25, toeLen: 0.36, pad: 0, web: 0, lift: 0.1 },
  glide: { hl: 1.3, hf: 0.8, hw: 0.3, fl: 1.6, fw: 0.17, toeLen: 1.05, pad: 0.15, web: 0.9, lift: 0.2 },
  claw: { hl: 1.3, hf: 0.9, hw: 0.5, fl: 1.25, fw: 0.15, toeLen: 0.95, pad: 0, web: 0.88, lift: 0.2 },
  newt: { hl: 0.72, hf: 0.3, hw: 0.24, fl: 1.15, fw: 0.19, toeLen: 0.45, pad: 0, web: 0, lift: 0.45 },
};
function legs(r, style, o = {}) {
  const b = LEG[style], v = () => r.range(0.92, 1.08);
  return {
    len: NaN, w: 0.4, taper: 0.6, bend: 1, foot: 'amphibianLeg', style,
    hl: b.hl * v(), hf: b.hf * v(), hw: b.hw * v(), fl: b.fl * v(), fw: b.fw * v(), toeLen: b.toeLen * v(), pad: b.pad, web: b.web, lift: b.lift,
    ankleX: r.range(0.18, 0.4), reach: r.range(0.1, 0.45), pose: 'sit', pj: [r.range(-0.12, 0.12), r.range(-0.1, 0.1), r.range(-0.15, 0.15)], ...o,
  };
}

// ---------------------------------------------------------------------
// CHASSIS
// ---------------------------------------------------------------------
// Side view: a wedge that rises from a low tapered rump to the shoulders. `pitch` tilts it from
// a walking toad (near 0) to a bolt-upright dart frog; the profile makes it lean or spherical.
chassis.amphibianSit = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, lift = C.lift * r, pitch = g.pitch;
  const pr = [[0, g.rump ?? 0.5], [0.34, g.belly ?? 1], [0.68, g.chest ?? 0.85], [1, g.neck ?? 0.72]];
  const rad = profile(pr.map(([t, k]) => [t, k * r]));
  const ax = [Math.cos(pitch), -Math.sin(pitch)], up = [-Math.sin(pitch), -Math.cos(pitch)];
  const build = y0 => {
    const Rp = [-L / 2 * ax[0], y0], Sp = add(Rp, mul(ax, L));
    const mid = add(lerp(Rp, Sp, 0.5), mul(up, (g.arch ?? 0.2) * r));
    const nk = polar(Sp, -pitch * (g.neckK ?? 0.6), (g.neckLen ?? 0.45) * r);
    return { Rp, Sp, nk, path: spline([Rp, mid, Sp, nk], 8) };
  };
  let y0 = -(r * pr[0][1] + lift * (g.rearLift ?? 0.3) + r * 0.1), B = build(y0);
  let low = -Infinity; B.path.forEach((p, i) => { low = Math.max(low, p[1] + rad(i / (B.path.length - 1))); });
  const clear = lift * (g.rearLift ?? 0.3) * 0.5 + r * 0.03;
  if (g.seat != null) { y0 -= low + g.seat * r; B = build(y0); } // belly held clear of the line: the haunch shows
  else if (low > -clear) { y0 -= low + clear; B = build(y0); }
  const { Rp, Sp, nk, path } = B;
  bodyTube(ink, path, rad);
  if (g.hump) { // sacral hump: the angle in a sitting frog's back
    const q = pathAt(path, 0.3), hh = g.hump * r * 0.22;
    ink.dot(polar(q.p, q.ang - PI / 2, rad(0.3) - r * 0.5 + hh), r * 0.5);
  }
  const fore = add(Sp, [(g.armX ?? 0.1) * r, r * pr[2][1] * 0.45]), hind = add(Rp, [(g.hipX ?? 0.15) * r, r * 0.05]);
  const mk = (p, role, far) => ({ p, dir: PI / 2, s: r * (g.limbS ?? 1), role, far, ground: 0, fwd: 0, side: 1 });
  return {
    view: 'side', r, path, rad,
    head: { p: nk, dir: -pitch * (g.neckK ?? 0.6), face: -(g.face ?? pitch * 0.3), s: r * g.headS, sym: false },
    tail: { p: polar(Rp, PI - pitch, r * pr[0][1] * 0.45), dir: PI - pitch * 0.5 + rng.range(-0.15, 0.2), s: r * (g.tailS ?? 0.55) },
    limbs: [mk(add(fore, [r * 0.05, -r * 0.1]), 'fore', true), mk(add(hind, [r * 0.3, 0]), 'hind', true), mk(fore, 'fore', false), mk(hind, 'hind', false)],
    back: [strip(path, rad, 0.06, 0.8, 14, -1)],
  };
};

// Top view: egg-shaped trunk, narrow at the hips.
chassis.amphibianTop = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, b = (g.bend ?? 0.05) * rng.range(-1, 1);
  const path = spline([[-L / 2, 0], [0, b * L], [L / 2, 0]], 10);
  const pr = g.prof ?? [[0, 0.45], [0.25, 0.74], [0.58, 1], [0.85, 0.92], [1, 0.84]];
  const rad = profile(pr.map(([t, k]) => [t, k * r]));
  bodyTube(ink, path, rad);
  const limbs = [];
  for (const [t, role, tilt] of [[g.foreT ?? 0.84, 'fore', -0.45], [g.hindT ?? 0.08, 'hind', 0.35]]) {
    const { p, ang } = pathAt(path, t);
    for (const sd of [-1, 1]) limbs.push({ p: polar(p, ang + sd * PI / 2, rad(t) * 0.5), dir: ang + sd * (PI / 2 + tilt), s: r * (g.limbS ?? 1), role, fwd: ang, side: sd });
  }
  const e = pathAt(path, 1), a = pathAt(path, 0);
  return {
    view: 'top', r, path, rad,
    head: { p: e.p, dir: e.ang, face: e.ang, s: r * g.headS, sym: true },
    tail: { p: a.p, dir: a.ang + PI, s: r * 0.5 },
    limbs, back: [strip(path, rad, 0.25, 0.75, 8, -1), strip(path, rad, 0.25, 0.75, 8, 1)],
  };
};

// Surinam toad (Pipa pipa), top view, drawn whole: a flat square leaf of a body, a small
// flat triangular head, thin forward-reaching arms with long fingers ending in star tips,
// and big fully webbed hind feet swept out behind. Limb genes are ignored on its own chassis.
chassis.amphibianPipa = (C, g) => {
  const { ink, rng } = C, h = g.r * C.plump, L = g.len, j = () => rng.range(-1, 1);
  const xf = L / 2, xb = -L / 2, hl = h * g.headL, hw = h * g.headW, sq = g.square;
  // body: rounded square, slightly wider at the hips like the real animal
  const body = [[xf, -h * 0.82], [xf * 0.35, -h * (0.98 + sq * 0.04)], [xb * 0.4, -h * (1.02 + sq * 0.05)], [xb, -h * 0.9], [xb - h * 0.12, -h * 0.35], [xb - h * 0.14, 0],
    [xb - h * 0.12, h * 0.35], [xb, h * 0.9], [xb * 0.4, h * (1.02 + sq * 0.05)], [xf * 0.35, h * (0.98 + sq * 0.04)], [xf, h * 0.82], [xf + h * 0.1, 0]];
  ink.poly(blob(body, 6));
  // head: a flat straight-sided triangle with a slightly pinched point
  const tip = [xf + hl, j() * h * 0.04];
  ink.poly([[xf - h * 0.3, -hw], [lerp([xf, -hw], tip, 0.55)[0], -hw * 0.5], tip, [lerp([xf, hw], tip, 0.55)[0], hw * 0.5], [xf - h * 0.3, hw]]);
  const fingersOf = (p, a, s, n, len, spread) => {
    const tr = Math.max(0.09 * s, MINW / 2);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), aa = a + (u - 0.5) * spread + j() * 0.08, q = polar(p, aa, len * s * (0.85 + 0.25 * Math.sin(u * PI)));
      ink.poly(tube([p, lerp(p, q, 0.5), q], [tr * 1.2, tr, tr * 0.9]));
      // star tip: a tiny cross of four nubs
      const k = Math.max(0.15 * s, MINW * 0.9);
      for (let m = 0; m < 4; m++) ink.dot(polar(q, aa + m * PI / 2 + PI / 4, k * 0.55), k * 0.42);
      ink.dot(q, k * 0.5);
    }
    ink.dot(p, Math.max(0.14 * s, tr));
  };
  for (const sd of [-1, 1]) {
    const s = h, A = t => sd * t; // angle measured from forward (+x)
    // arm: from the shoulder out sideways, elbow, forearm reaching forward-out
    const sh = [xf * 0.55, sd * h * 0.8], el = polar(sh, A(g.armOut + j() * 0.12), s * g.arm * 0.5);
    const hand = polar(el, A(g.armFwd + j() * 0.15), s * g.arm * 0.55), fw = Math.max(0.19 * s, MINW);
    seg(C, [sh, el, hand], fw * 1.15, fw * 0.8);
    fingersOf(hand, A(g.armFwd), s, 4, g.finger, 1.35);
    // hind leg: thigh out-back, shin back, a big webbed fan of five toes behind
    const hip = [xb * 0.75, sd * h * 0.78], kn = polar(hip, A(g.hipA + j() * 0.12), s * g.thigh);
    const an = polar(kn, A(g.shinA + j() * 0.12), s * g.thigh * 0.9), lw = 0.36 * s;
    seg(C, [hip, lerp(hip, kn, 0.5), kn], lw, lw * 0.7, lw);
    seg(C, [kn, lerp(kn, an, 0.5), an], lw * 0.7, lw * 0.45);
    toes(C, an, A(g.footA + j() * 0.1), s, { n: 5, len: g.toe, spread: g.footSpread, web: 0.95, tr: 0.11, long: 0.75, base: 0.2 });
  }
  const path = spline([[xb, 0], [0, 0], [xf, 0]], 6), rad = () => h * 0.9;
  return {
    view: 'top', r: h, path, rad, amphLimbless: true,
    head: { p: [xf + hl * 0.3, 0], dir: 0, face: 0, s: h * 0.6, sym: true, eyes: [] },
    tail: { p: [xb, 0], dir: PI, s: h * 0.4 },
    limbs: [], back: [strip(path, rad, 0.2, 0.8, 8, -1), strip(path, rad, 0.2, 0.8, 8, 1)],
  };
};

// Side view: a frog at full stretch, toes just leaving the line.
chassis.amphibianLeap = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, al = g.pitch;
  const ax = [Math.cos(al), -Math.sin(al)], up = [-Math.sin(al), -Math.cos(al)];
  const Rp = [-L / 2 * ax[0], -r * g.h], Sp = add(Rp, mul(ax, L)), nk = polar(Sp, -al * 0.9, r * 0.45);
  const path = spline([Rp, add(lerp(Rp, Sp, 0.5), mul(up, 0.12 * r)), Sp, nk], 8);
  const rad = profile([[0, 0.46 * r], [0.35, 0.86 * r], [0.7, 0.8 * r], [1, 0.7 * r]]);
  bodyTube(ink, path, rad);
  const hip = add(Rp, mul(ax, r * 0.1)), sh = add(Sp, mul(up, -r * 0.4));
  const armDir = g.armDir ?? 0.5, zig = g.armZig ?? 0.5;
  const limbs = [
    { p: add(hip, [r * 0.1, r * 0.12]), dir: PI - 0.9, s: r, role: 'hind', far: true, ground: 0, pose: 'leap', fwd: 0, side: 1 },
    { p: add(sh, [r * 0.15, 0]), dir: armDir - 0.3, s: r, role: 'fore', far: true, fwd: -al, side: 1, zig, bendS: -1 },
    { p: hip, dir: PI - 0.9, s: r, role: 'hind', far: false, ground: 0, pose: 'leap', fwd: 0, side: 1 },
    { p: sh, dir: armDir, s: r, role: 'fore', far: false, fwd: -al, side: 1, zig, bendS: -1 },
  ];
  return {
    view: 'side', r, path, rad,
    head: { p: nk, dir: -al * 0.9, face: -al * (g.faceK ?? 0.7), s: r * g.headS, sym: false },
    tail: { p: Rp, dir: PI - al + rng.range(-0.2, 0.2), s: r * 0.45 },
    limbs, back: [strip(path, rad, 0.08, 0.8, 12, -1)],
  };
};

// Front view: face-on sitting frog. Torso is held off the ground so arms and knees read.
chassis.amphibianFront = (C, g) => {
  const { ink } = C, r = g.r * C.plump, w = g.wide, lift = C.lift * r;
  const cy = -(r * 1.2 + lift * 0.5), top = [0, cy - r * 0.85];
  ink.poly(ellipse([0, cy], r * w, r * 0.92, 0, 36));
  ink.poly(tube(polyline([[0, cy], top], 3), r * 0.8));
  const mk = (x, y, role, sd, pose) => ({ p: [x, y], dir: PI / 2, s: r, role, far: false, ground: 0, pose, fwd: 0, side: sd });
  const limbs = [];
  for (const sd of [-1, 1]) limbs.push(mk(sd * r * w * 0.74, cy + r * 0.3, 'hind', sd, 'frontHind'), mk(sd * r * (g.armX ?? 0.44), cy + r * 0.45, 'fore', sd, 'frontFore'));
  const arc = sd => { const out = []; for (let i = 0; i < 7; i++) { const a = -PI / 2 + sd * mix(0.75, 1.35, i / 6); out.push({ p: [Math.cos(a) * r * w * 0.85, cy + Math.sin(a) * r * 0.78], dir: a, t: i / 6 }); } return out; };
  const path = polyline([[0, cy + r * 0.8], top], 8);
  return {
    view: 'side', r, path, rad: () => r * 0.8,
    head: { p: top, dir: -PI / 2, face: 0, s: r * g.headS, sym: false, front: true },
    tail: { p: [-r * w * 0.8, cy + r * 0.5], dir: PI - 0.1, s: r * 0.45 },
    limbs, back: [arc(-1), arc(1)],
  };
};

// Side view: fire-bellied toad in the unken reflex -- belly down, both ends and all four
// feet lifted to flash the warning colours.
chassis.amphibianUnken = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, c = g.curl;
  const path = spline([[-L / 2, -r * (0.8 + c * 0.9)], [-L * 0.18, -r * 0.82], [L * 0.18, -r * 0.82], [L / 2, -r * (0.85 + c * 1.1)]], 8);
  const rad = profile([[0, 0.5 * r], [0.3, 0.8 * r], [0.62, 0.84 * r], [1, 0.7 * r]]);
  bodyTube(ink, path, rad);
  const e = pathAt(path, 1), limbs = [];
  for (const far of [true, false]) {
    const f = pathAt(path, 0.8), h = pathAt(path, 0.1), o = far ? 0.3 : 0;
    limbs.push({ p: polar(f.p, f.ang - PI / 2, rad(0.8) * 0.3), dir: -PI / 2 + 0.15 + o + rng.range(-0.15, 0.15), s: r, role: 'fore', far, fwd: 0, side: 1, bendS: -1, zig: 1.1 });
    limbs.push({ p: polar(h.p, h.ang - PI / 2, rad(0.1) * 0.2), dir: -PI / 2 - 0.55 + o + rng.range(-0.15, 0.15), s: r, role: 'hind', far, fwd: 0, side: 1, bendS: 1, zig: 1.0 });
  }
  return {
    view: 'side', r, path, rad,
    head: { p: e.p, dir: e.ang, face: e.ang * 0.9, s: r * g.headS, sym: false },
    tail: { p: path[0], dir: PI + 0.5, s: r * 0.45 },
    limbs, back: [strip(path, rad, 0.3, 0.7, 8, -1)],
  };
};

// Side view: a sitting frog on a lily pad. The pad is a flat lens on the line; the frog is
// drawn by amphibianSit through a shifted ink and its plan is shifted to match, so every
// socket (and the limbs' ground) sits on the pad's top.
chassis.amphibianPad = (C, g) => {
  const { ink, rng } = C, R = g.r * C.plump, W = R * g.padW, T = R * g.padT, dy = -T * 0.86;
  const sh = q => [q[0], q[1] + dy];
  const ink2 = Object.create(ink);
  ink2.poly = function (pts, layer = 'k') { ink.poly(pts.map(sh), layer); return this; };
  const plan = chassis.amphibianSit({ ...C, ink: ink2 }, g);
  // pad: a lens, a little fuller at the far rim, with the notch side lifted
  const cx = rng.range(-0.25, 0.15) * W, pts = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24, x = cx - W + 2 * W * u, sw = Math.sin(PI * u); pts.push([x, -T * 0.5 - T * 0.5 * Math.pow(sw, 0.6) - g.curl * T * u ** 4]); }
  for (let i = 24; i >= 0; i--) { const u = i / 24, x = cx - W + 2 * W * u; pts.push([x, -T * 0.5 + T * 0.45 * Math.pow(Math.sin(PI * u), 0.6) - g.curl * T * u ** 4]); }
  ink.poly(pts);
  const mv = o => ({ ...o, p: sh(o.p) });
  plan.path = plan.path.map(sh);
  plan.head = mv(plan.head); plan.tail = mv(plan.tail);
  plan.limbs = plan.limbs.map(l => ({ ...mv(l), ground: dy }));
  plan.back = plan.back.map(st => st.map(mv));
  return plan;
};

// Tadpole: the body is the head. Top view (the comma) or side view (deep belly, finned tail).
chassis.amphibianTadpole = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, top = g.view !== 'side', lift = C.lift * r;
  let path, rad, limbs = [];
  if (top) {
    path = spline([[-L / 2, 0], [0, rng.range(-0.06, 0.06) * L], [L / 2, 0]], 10);
    rad = profile([[0, 0.5 * r], [0.3, 0.92 * r], [0.62, r], [0.86, 0.86 * r], [1, 0.6 * r]]);
    for (const [t, role, tilt] of [[0.74, 'fore', -0.45], [0.06, 'hind', 0.35]]) {
      const { p, ang } = pathAt(path, t);
      for (const sd of [-1, 1]) limbs.push({ p: polar(p, ang + sd * PI / 2, rad(t) * 0.55), dir: ang + sd * (PI / 2 + tilt), s: r * (g.limbS ?? 0.6), role, fwd: ang, side: sd });
    }
  } else {
    const y0 = -(r * 0.95 + lift);
    path = spline([[-L / 2, y0 - r * 0.1], [0, y0], [L / 2, y0 - r * 0.12]], 10);
    rad = profile([[0, 0.45 * r], [0.35, 0.9 * r], [0.66, 0.95 * r], [1, 0.58 * r]]);
    const mk = (t, role, far) => { const p = pathAt(path, t).p; return { p: add(p, [far ? r * 0.25 : 0, rad(t) * 0.5]), dir: PI / 2, s: r * (g.limbS ?? 0.6), role, far, ground: 0, fwd: 0, side: 1 }; };
    limbs = [mk(0.72, 'fore', true), mk(0.1, 'hind', true), mk(0.72, 'fore', false), mk(0.1, 'hind', false)];
  }
  bodyTube(ink, path, rad);
  const e = pathAt(path, 1), a = pathAt(path, 0), hs = r * g.headS, m = pathAt(path, 0.66);
  const mounts = top ? [-1, 1].map(sd => ({ p: polar(m.p, m.ang + sd * PI / 2, rad(0.66) * 0.8), dir: m.ang + sd * 2.1, flip: sd, s: hs }))
    : [{ p: polar(m.p, -PI / 2, rad(0.66) * 0.8), dir: -PI / 2 - 0.3, flip: -1, s: hs }];
  const eyes = top ? [-1, 1].map(sd => ({ p: polar(pathAt(path, 0.8).p, e.ang + sd * PI / 2, rad(0.8) * 0.55), r: hs * 0.2 })) : [{ p: add(pathAt(path, 0.8).p, [0, -rad(0.8) * 0.35]), r: hs * 0.2 }];
  return {
    view: top ? 'top' : 'side', r, path, rad, amphLimbless: true,
    head: { p: polar(e.p, e.ang, -rad(1) * 0.2), dir: e.ang, face: e.ang, s: hs, sym: top, eyes, mounts },
    tail: { p: polar(a.p, a.ang, rad(0) * 0.6), dir: a.ang + PI, s: r * 0.6 },
    limbs, back: top ? [strip(path, rad, 0.2, 0.75, 8, -1), strip(path, rad, 0.2, 0.75, 8, 1)] : [strip(path, rad, 0.1, 0.8, 10, -1)],
  };
};

// Caecilian, top view: a ringed limbless tube, blunt at both ends.
chassis.amphibianCaecilian = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, pts = [];
  if (g.style === 'coil') {
    const turns = g.turns, r0 = r * 2.3, pitch = r * g.gap, n = Math.round(turns * 110), sg = g.hand;
    for (let i = 0; i <= n; i++) { const th = i / n * turns * 2 * PI, rho = r0 + pitch * th / (2 * PI); pts.push([Math.cos(th) * rho, sg * Math.sin(th) * rho]); }
    let h = angOf(pts[n - 1], pts[n]), p = pts[n]; const m = Math.round(g.run * 2.5);
    for (let i = 1; i <= m; i++) { h += -sg * g.unwind / m * (1 - i / m) * 2; p = polar(p, h, 0.4); pts.push(p); }
  } else if (g.style === 'loop') {
    const c = g.c, R = g.R, n = 260, t0 = -PI * g.lead, t1 = 2 * PI + PI * g.tailLead;
    for (let i = 0; i <= n; i++) { const th = mix(t0, t1, i / n); pts.push([-(c * th - R * Math.sin(th)), -R * Math.cos(th) * 0.85 + g.drift * th]); }
    pts.reverse(); pts.forEach(p => { p[0] = -p[0]; });
  } else {
    const L = g.len, n = 200, ph = rng.range(0, 2 * PI);
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push([-L / 2 + L * u, g.amp * Math.sin(ph + u * g.k * 2 * PI) * (1 - 0.5 * u * u)]); }
  }
  const n = pts.length - 1, arc = [0];
  for (let i = 1; i <= n; i++) arc.push(arc[i - 1] + dist(pts[i - 1], pts[i]));
  const env = profile([[0, 0.72], [0.06, 0.95], [0.5, 1], [0.92, 0.95], [1, 0.82]]), ring = r * g.ring;
  const R = pts.map((_, i) => r * env(i / n) * (1 + 0.085 * Math.cos(2 * PI * arc[i] / ring)));
  ink.poly(tube(pts, R));
  const rad = t => r * env(t), limbs = [];
  for (const [t, role, tilt] of [[0.86, 'fore', -0.45], [0.2, 'hind', 0.35]]) {
    const { p, ang } = pathAt(pts, t);
    for (const sd of [-1, 1]) limbs.push({ p: polar(p, ang + sd * PI / 2, r * 0.5), dir: ang + sd * (PI / 2 + tilt), s: r * 1.1, role, fwd: ang, side: sd });
  }
  const e = pathAt(pts, 1), a = pathAt(pts, 0);
  return {
    view: 'top', r, path: pts, rad, amphLimbless: true,
    head: { p: polar(e.p, e.ang, -r * 0.3), dir: e.ang, face: e.ang, s: r, sym: true },
    tail: { p: a.p, dir: a.ang + PI, s: r * 0.8 },
    limbs, back: [strip(pts, rad, 0.4, 0.8, 9, -1), strip(pts, rad, 0.4, 0.8, 9, 1)],
  };
};

// ---------------------------------------------------------------------
// HEADS
// ---------------------------------------------------------------------
// Frog head. Side view: a wedge with a flat jaw line and one bulging eye breaking the top
// outline. Top view: a broad rounded triangle with an eye bump either side.
heads.amphibianFrog = (C, sock, g) => {
  const { ink } = C, s = sock.s, sn = g.snout, pt = g.point ?? 0.2, deep = g.deep ?? 0.62, eye = g.eye ?? 0.33;
  const c = polar(sock.p, sock.dir, s * 0.35), F = frame(c, sock.face, s, 1);
  ink.poly(tube(polyline([sock.p, c], 2), s * (g.gape > 0.05 ? Math.min(g.neck ?? 0.68, 0.6) : (g.neck ?? 0.68))));
  if (sock.sym) {
    const w = g.wide ?? 1, half = [[-0.55, 0.88 * w], [0, w], [0.5, 0.84 * w], [sn * 0.8, mix(0.56, 0.3, pt) * w], [sn * 0.98, mix(0.26, 0.08, pt) * w]];
    ink.poly(blob([...half.map(([x, y]) => F(x, -y)), F(sn * 1.03, 0), ...half.reverse().map(([x, y]) => F(x, y))], 5));
    const eyes = [], mounts = [];
    for (const sd of [-1, 1]) {
      const ep = F(g.eyeX ?? 0.3, sd * w * 0.8);
      if (eye > 0.05) ink.dot(ep, eye * 0.88 * s);
      if (g.pouch) ink.dot(F(-0.05, sd * w * (0.85 + g.pouch * 0.3)), g.pouch * 0.5 * s);
      eyes.push({ p: ep, r: s * 0.14 });
      mounts.push({ p: F(-0.1, sd * w * 0.8), dir: sock.face + sd * 1.25, flip: sd, s, amph: { eye: ep, up: sock.face + sd * 1.9, r: eye * s } });
    }
    if (g.tongue) tongue(C, F, sn, g.tongue, s, 0);
    return { eyes, mounts, spots: [] };
  }
  const tipH = mix(0.2, 0.03, pt), hh = g.hh ?? 1;
  const ga = g.gape ?? 0;
  if (ga > 0.05) { // mouth agape: upper jaw tipped up, a deep rounded notch to the corner, lower jaw dropped
    const a1 = ga * 0.4, a2 = ga * 0.6, c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    ink.poly(blob([F(-0.62, -0.6 * hh), F(0, -0.66 * hh), F(0.42, -0.5 * hh - 0.3 * s1), F(sn * 0.8 * c1, -0.16 - sn * 0.8 * s1), F(sn * c1, 0.02 - sn * s1),
      F(sn * 0.86 * c1, 0.14 - sn * 0.86 * s1), F(sn * 0.42, 0.16), F(sn * 0.86 * c2, 0.22 + sn * 0.86 * s2), F(sn * 0.97 * c2, 0.3 + sn * 0.97 * s2),
      F(sn * 0.7 * c2, 0.5 + sn * 0.7 * s2), F(0.2, deep + ga * 0.3), F(-0.62, deep * 1.02)], 6));
  } else ink.poly(blob([F(-0.62, -0.6 * hh), F(0, -0.66 * hh), F(0.42, -0.5 * hh), F(sn * 0.8, mix(-0.2, -0.06, pt) * hh), F(sn, 0.1 - tipH), F(sn * 0.985, 0.1 + tipH * 0.9),
    F(sn * 0.72, 0.34 + (deep - 0.62) * 0.4), F(0.2, deep), F(-0.62, deep * 1.02)], 6));
  const ep = F(g.eyeX ?? 0.05, -(0.6 * hh + eye * (g.eyeUp ?? 0.22)));
  if (eye > 0.05) ink.dot(ep, eye * s);
  if (g.pouch) ink.dot(F(0.22 + g.pouch * 0.12, deep * 0.72 + g.pouch * 0.36), g.pouch * 0.74 * s);
  if (g.parotoid) ink.oval(F(-0.55, -0.6 * hh), g.parotoid * 0.5 * s, g.parotoid * 0.26 * s, sock.face + 0.15);
  if (g.tongue) tongue(C, F, sn, g.tongue, s, 0.12);
  const up = sock.face - PI / 2;
  return {
    eyes: [{ p: ep, r: s * 0.15 }], spots: [],
    mounts: [{ p: F(-0.32, -0.6 * hh), dir: up - 0.25, flip: -1, s, amph: { eye: ep, up: up - 0.4, r: eye * s } }],
  };
};
function tongue(C, F, sn, len, s, y) {
  const a = F(sn * 0.85, y), end = F(sn + len, y - len * 0.22);
  C.ink.poly(tube(spline([a, F(sn + len * 0.5, y - len * 0.02), end], 6), Math.max(s * 0.085, MINW * 0.7)));
  C.ink.dot(end, Math.max(s * 0.19, MINW * 1.4));
}

// Face-on frog: a wide low dome with both eyes standing proud on top.
heads.amphibianFace = (C, sock, g) => {
  const { ink } = C, s = sock.s, up = sock.dir, c = polar(sock.p, up, s * 0.2), F = frame(c, up + PI / 2, s, 1); // F: x lateral, y down the neck
  const w = g.wide ?? 1.25, eye = g.eye ?? 0.36;
  ink.poly(tube(polyline([sock.p, c], 2), s * 0.7));
  ink.poly(blob([F(-w, 0.05), F(-w * 0.8, -0.5), F(0, -0.66), F(w * 0.8, -0.5), F(w, 0.05), F(w * 0.72, 0.5), F(0, 0.62), F(-w * 0.72, 0.5)], 6));
  const eyes = [], mounts = [];
  for (const sd of [-1, 1]) {
    const ep = F(sd * w * 0.6, -0.56 - eye * 0.3);
    ink.dot(ep, eye * s);
    if (g.pouch) ink.dot(F(sd * w * 0.98, 0.3), g.pouch * 0.5 * s);
    eyes.push({ p: ep, r: s * 0.15 });
    mounts.push({ p: F(sd * w * 0.6, -0.5), dir: up + sd * 0.5, flip: sd, s, amph: { eye: ep, up: up + sd * 0.55, r: eye * s } });
  }
  return { eyes, mounts, spots: [] };
};

// Caecilian: no visible head at all, just a blunt bullet end.
heads.amphibianBlunt = (C, sock, g) => {
  const { ink } = C, s = sock.s, a = sock.sym ? sock.dir : sock.face;
  const tip = polar(sock.p, a, s * g.len);
  ink.poly(tube(spline([sock.p, lerp(sock.p, tip, 0.5), tip], 5), [s * 0.96, s * 0.95, s * 0.92, s * 0.88, s * 0.84, s * 0.8, s * 0.76, s * 0.72, s * 0.66, s * 0.58, s * g.tipR]));
  const sides = sock.sym ? [-1, 1] : [-1];
  return {
    eyes: sides.map(sd => ({ p: polar(lerp(sock.p, tip, 0.5), a + sd * PI / 2, s * 0.45), r: s * 0.14 })),
    mounts: sides.map(sd => ({ p: polar(lerp(sock.p, tip, 0.2), a + sd * PI / 2, s * 0.7), dir: a + sd * (sock.sym ? 1.25 : PI / 2 + 0.25), flip: sd, s })),
    spots: [],
  };
};

// On a tadpole the body is the head. Lent to anybody else it draws a plain frog head.
heads.amphibianNone = (C, sock, g) => (!sock.eyes && C.plan && !C.plan.amphLimbless) ? heads.amphibianFrog(C, sock, { snout: 1.15, point: 0.2, deep: 0.62, eye: 0.33, wide: 1 }) : ({
  eyes: sock.eyes ?? [],
  mounts: sock.mounts ?? [{ p: sock.p, dir: sock.sym ? sock.dir : sock.face - PI / 2, flip: -1, s: sock.s }],
  spots: [],
});

// ---------------------------------------------------------------------
// CROWNS and DORSALS
// ---------------------------------------------------------------------
// Bulging top-set eyes for somebody else's head. Does nothing on amphibian heads, which
// already place their own eyes exactly.
crowns.amphibianEyes = (C, m, F, s, g) => { if (!m.amph) C.ink.dot(F(g.r * 0.25, 0), Math.max(g.r * s, MINW * 1.5)); };
// Eyelid horns (horned frogs, leaf-litter frogs).
crowns.amphibianBrow = (C, m, F, s, g) => {
  if (m.amph) C.ink.poly(leaf(polar(m.amph.eye, m.amph.up, m.amph.r * 0.2), m.amph.up + (g.lean ?? 0) * m.flip, (g.len + 0.3) * s, Math.max(m.amph.r * 1.5, s * 0.4), 0, 0.2));
  else C.ink.poly(leaf(F(-0.15, 0), m.dir, (g.len + 0.3) * s, s * 0.5, 0, 0.2));
};

// Hairy frog: a fringe of skin filaments on the flanks and thighs. Side view: hanging from
// the lower flank over the haunch. Top view: out from each flank.
dorsals.amphibianHair = (C, plan, st, sd, si, g) => {
  const { ink, rng } = C, r = plan.r;
  const hip = plan.view === 'side' && plan.limbs.find(l => l.role === 'hind' && !l.far);
  if (plan.view === 'side') {
    if (si > 0) return;
    // shaggy fringe round the back of the haunch, and a few down the lower flank
    const c = hip ? hip.p : pathAt(plan.path, 0.1).p, G = hip?.ground ?? 0;
    for (let i = 0; i < g.n; i++) {
      const u = (i + rng.range(0.2, 0.8)) / g.n, a = mix(PI * 0.32, PI * 1.06, u), len = r * g.len * rng.range(0.75, 1.15);
      const b = polar(c, a, r * 0.46), h = a + 0.45;
      const e = polar(b, h, len); e[1] = Math.min(e[1], G - MINW);
      ink.poly(tube(spline([b, polar(lerp(b, e, 0.5), h + PI / 2, len * 0.1), e], 4), profile([[0, Math.max(r * 0.16, MINW * 0.9)], [0.6, Math.max(r * 0.08, MINW * 0.7)], [1, MINW * 0.55]])));
    }
    return;
  }
  for (let i = 0; i < Math.ceil(g.n / 2); i++) {
    const k = st[Math.round(mix(0, st.length - 1, (i + 0.5) / Math.ceil(g.n / 2)))], a = k.dir + sd * rng.range(0.2, 0.6) * 0, len = r * g.len * rng.range(0.6, 1);
    ink.poly(tube(spline([polar(k.p, k.dir, -r * 0.1), polar(k.p, a, len * 0.5), polar(polar(k.p, a, len), a + PI / 2, len * 0.2 * sd)], 4), profile([[0, Math.max(r * 0.09, MINW * 0.7)], [1, MINW / 2]])));
  }
};

// Newt crest: a strip along the back with broad sawteeth (wide bases, blunt tips), so the
// teeth survive print size.
dorsals.amphibianCrest = (C, plan, st, sd, si, g) => {
  if (si > 0) return;
  const { ink, rng } = C, r = plan.r, n = st.length, at = u => { const x = clamp(u, 0, 1) * (n - 1), i = Math.min(Math.floor(x), n - 2); return { p: lerp(st[i].p, st[i + 1].p, x - i), dir: st[i].dir }; };
  const pts = [];
  for (let t = 0; t < g.n; t++) {
    const u0 = t / g.n, w = 1 / g.n, hk = rng.range(0.92, 1.1);
    for (const [f, hh] of [[0, 0.5], [0.38, hk], [0.62, hk * 0.93]]) {
      const u = u0 + f * w, k = at(u);
      pts.push(polar(k.p, k.dir, r * g.h * Math.sin(PI * u) ** 0.6 * hh));
    }
  }
  pts.push(at(1).p);
  const bot = []; for (let i = 20; i >= 0; i--) { const k = at(i / 20); bot.push(polar(k.p, k.dir, -r * 0.3)); }
  ink.poly(pts.concat(bot));
};

// Warts: a handful of distinct round bumps along the back.
dorsals.amphibianWarts = (C, plan, st, sd, si, g) => {
  const { ink, rng } = C, n = st.length;
  for (let i = 0; i < g.n; i++) {
    const u = clamp((i + 0.5) / g.n + rng.range(-0.3, 0.3) / g.n, 0, 1), x = u * (n - 1), i0 = Math.min(Math.floor(x), n - 2);
    const p = lerp(st[i0].p, st[i0 + 1].p, x - i0), dir = st[i0].dir, wr = Math.max(plan.r * g.size * rng.range(0.7, 1.2) * Math.sin(PI * mix(0.2, 0.8, u)) ** 0.5, MINW * 1.2);
    ink.dot(polar(p, dir, wr * 0.45), wr);
  }
};
// Egg string carried at the rump (midwife toad).
// In side view the string is wound round the haunches: a bunch of grapes behind the hip.
dorsals.amphibianEggs = (C, plan, st, sd, si, g) => {
  const hip = plan.view === 'side' && plan.limbs.find(l => l.role === 'hind' && !l.far);
  if (hip) {
    if (si > 0) return;
    // a looped string of beads trailing from the hips to the heels
    const { ink, rng } = C, r = plan.r, er = Math.max(r * g.size * 0.78, MINW * 1.6), G = hip.ground ?? 0, h = hip.p, gy = G - er * 1.05;
    const back = Math.max(plan.rad(0), r * 0.5) + r * rng.range(0.55, 0.8), sag = rng.range(0.1, 0.3);
    const path = spline([add(h, [-0.35 * r, -0.2 * r]), [h[0] - back, mix(h[1], gy, 0.25)], [h[0] - back * 0.85, gy - sag * r], [h[0] - 0.25 * r, gy]], 10);
    ink.poly(tube(path, Math.max(er * 0.3, MINW * 0.6)));
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      acc += dist(path[i - 1], path[i]);
      if (acc >= er * 2.25) { acc = 0; const q = [path[i][0], Math.min(path[i][1], gy)]; ink.poly(ellipse(q, er, er, 0, 14)); }
    }
    return;
  }
  const { ink, rng } = C, n = st.length, er = Math.max(plan.r * g.size, MINW * 1.6), m = Math.max(2, Math.round(n * 0.3));
  for (let row = 0; row < g.rows; row++) {
    const cnt = g.n - row;
    for (let i = 0; i < cnt; i++) {
      const x = (i + 0.5 * row + 0.2) / g.n * m, i0 = Math.min(Math.floor(x), n - 2), p = lerp(st[i0].p, st[i0 + 1].p, x - i0);
      ink.dot(polar(p, st[i0].dir + rng.range(-0.15, 0.15), er * (0.5 + row * 1.35)), er * rng.range(0.9, 1.1));
    }
  }
};

// ---------------------------------------------------------------------
// GENE HELPERS
// ---------------------------------------------------------------------
const sit = (r, o) => ({ type: 'amphibianSit', r: r.range(9, 11), len: r.range(20, 25), pitch: r.range(0.5, 0.66), arch: r.range(0.1, 0.25), hump: r.range(0.3, 0.7), headS: 0.9, seat: r.range(0.75, 0.95), belly: 0.86, chest: 0.8, ...o });
const frogHead = (r, o = {}) => ({ type: 'amphibianFrog', snout: r.range(1.1, 1.3), point: r.range(0.1, 0.4), deep: r.range(0.58, 0.68), eye: r.range(0.3, 0.37), wide: r.range(0.95, 1.05), ...o });
const popEyes = r => ({ type: 'amphibianEyes', r: r.range(0.3, 0.42), pair: r.chance(0.65) });
const look = (r, p = 0.35, sp = 0.35) => ({ eyes: r.chance(p) ? 'dot' : 'none', spots: r.chance(sp) ? r.int(3, 7) : 0 });
const warts = (r, o = {}) => ({ type: 'amphibianWarts', n: r.int(4, 7), size: r.range(0.13, 0.19), ...o });
const topBody = (r, o) => ({ type: 'amphibianTop', r: r.range(8.5, 10.5), len: r.range(19, 24), headS: 0.95, ...o });

// ---------------------------------------------------------------------
// SPECIES
// ---------------------------------------------------------------------
const species = [
  // ---- sitting frogs, side view ----
  { name: 'common frog', w: 3, genes: r => ({
    chassis: sit(r, {}), head: frogHead(r), limbs: legs(r, 'frog'), tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r),
  }) },
  { name: 'frog on a lily pad', w: 2, genes: r => ({
    chassis: sit(r, { type: 'amphibianPad', r: r.range(8.5, 10), padW: r.range(2.3, 2.9), padT: r.range(0.4, 0.55), curl: r.range(0, 1.2) }),
    head: frogHead(r), limbs: legs(r, r.pick(['frog', 'frog', 'tree'])), tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r),
  }) },
  { name: 'hairy frog', w: 1, genes: r => ({ // Trichobatrachus: breeding males grow hair-like filaments on flanks and thighs
    chassis: sit(r, { r: r.range(9.5, 11), len: r.range(18, 22), pitch: r.range(0.42, 0.56), belly: 0.92 }),
    head: frogHead(r, { snout: r.range(0.95, 1.08), point: 0.05, deep: 0.7, eye: r.range(0.28, 0.33) }),
    limbs: legs(r, 'frog', { hw: r.range(0.46, 0.52) }), tail: none(), dorsal: { type: 'amphibianHair', n: r.int(13, 17), len: r.range(1.05, 1.35) }, crown: popEyes(r), surface: look(r, 0.3, 0),
  }) },
  { name: 'calling frog', w: 2, genes: r => ({
    chassis: sit(r, { r: r.range(8, 9.5), len: r.range(18, 22), pitch: r.range(0.58, 0.75) }),
    head: frogHead(r, { pouch: r.range(0.95, 1.4), snout: r.range(1.05, 1.2), eye: r.range(0.32, 0.38) }),
    limbs: legs(r, r.pick(['frog', 'tree'])), tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r, 0.3),
  }) },
  { name: 'tree frog', w: 2, genes: r => ({
    chassis: sit(r, { r: r.range(7.5, 9), len: r.range(20, 24), pitch: r.range(0.25, 0.48), belly: 0.92, chest: 0.82, hump: r.range(0.2, 0.5), headS: 0.98 }),
    head: frogHead(r, { snout: r.range(1, 1.15), point: 0.1, eye: r.range(0.38, 0.46), eyeUp: 0.3 }),
    limbs: legs(r, 'tree'), tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r, 0.4, 0.1),
  }) },
  { name: 'tongue-flicking frog', w: 1.2, genes: r => ({
    chassis: sit(r, { pitch: r.range(0.5, 0.7), face: r.range(0.25, 0.5) }), head: frogHead(r, { tongue: r.range(1.4, 2.6) }),
    limbs: legs(r, 'frog'), tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r, 0.4),
  }) },
  { name: 'leaf-litter horned frog', w: 1.5, genes: r => ({
    chassis: sit(r, { seat: r.range(0.55, 0.7), r: r.range(9, 10.5), len: r.range(18, 22), pitch: r.range(0.34, 0.5), belly: 0.96, hump: r.range(0.5, 0.9) }),
    head: frogHead(r, { snout: r.range(1.4, 1.7), point: 1, deep: 0.56, eye: r.range(0.24, 0.3), hh: 0.92, wide: 1.1 }),
    limbs: legs(r, 'frog', { hw: 0.36, web: 0.3 }), tail: none(), dorsal: none(), crown: { type: 'amphibianBrow', len: r.range(0.6, 1), lean: r.range(-0.1, 0.25), pair: true }, surface: look(r, 0.2, 0.2),
  }) },
  // ---- toads ----
  { name: 'common toad', w: 3, genes: r => ({
    chassis: sit(r, { seat: r.range(0.35, 0.5), r: r.range(10.5, 12.5), len: r.range(15, 19), pitch: r.range(0.3, 0.46), rump: 0.74, belly: 1.08, chest: 0.92, neck: 0.8, hump: 0, headS: 0.84 }),
    head: frogHead(r, { snout: r.range(0.9, 1.02), point: 0, deep: 0.72, eye: r.range(0.25, 0.3), parotoid: r.range(1.2, 1.5), neck: 0.78 }),
    limbs: legs(r, 'toad', { hw: 0.5, fw: 0.3 }), tail: none(), dorsal: warts(r, { n: r.int(4, 6), size: r.range(0.2, 0.26) }), crown: popEyes(r), surface: look(r, 0.35, 0.5),
  }) },
  { name: 'walking toad', w: 1.2, genes: r => ({
    chassis: sit(r, { seat: null, r: r.range(8.5, 9.5), len: r.range(23, 27), pitch: r.range(0.06, 0.16), rump: 0.66, belly: 0.94, chest: 0.86, neck: 0.8, hump: 0, arch: r.range(0.02, 0.12), rearLift: 1, headS: 1, neckLen: 0.55, face: r.range(-0.05, 0.12) }),
    head: frogHead(r, { snout: r.range(0.9, 1.02), point: 0, deep: 0.72, eye: r.range(0.25, 0.3), parotoid: r.range(0.8, 1.1), neck: 0.78 }),
    limbs: legs(r, 'toad', { stride: true, lift: r.range(1.15, 1.45), ankleX: r.range(-1.1, -0.7), farDX: r.range(1.6, 2.1), reach: r.range(0.8, 1.1), farReach: r.range(-1.7, -1.3), hl: r.range(1.25, 1.4), fl: r.range(2.0, 2.3), hw: 0.36, fw: 0.24 }),
    tail: none(), dorsal: warts(r, { n: r.int(4, 6), size: r.range(0.11, 0.15) }), crown: popEyes(r), surface: look(r, 0.35, 0.5),
  }) },
  { name: 'midwife toad', w: 1.2, genes: r => ({
    chassis: sit(r, { seat: r.range(0.38, 0.5), r: r.range(9.5, 11), len: r.range(15, 19), pitch: r.range(0.26, 0.4), rump: 0.7, belly: 1.04, chest: 0.9, neck: 0.78, hump: 0, headS: 0.86 }),
    head: frogHead(r, { snout: r.range(0.9, 1.05), point: 0.05, deep: 0.68, eye: r.range(0.3, 0.36) }),
    limbs: legs(r, 'toad'), tail: none(), dorsal: { type: 'amphibianEggs', n: r.int(4, 6), rows: r.int(2, 3), size: r.range(0.55, 0.65) }, crown: popEyes(r), surface: look(r, 0.3, 0),
  }) },
  // ---- other postures ----
  { name: 'leaping frog', w: 2, genes: r => ({
    chassis: { type: 'amphibianLeap', r: r.range(8, 9.5), len: r.range(22, 27), pitch: r.range(0.4, 0.75), h: r.range(2.1, 2.9), headS: 0.9, armDir: r.wpick([[2, r.range(0.1, 0.7)], [1, r.range(1.9, 2.4)]]), armZig: r.range(0.3, 0.8) },
    head: frogHead(r, { point: r.range(0.2, 0.5) }), limbs: legs(r, 'frog', { hl: r.range(1.4, 1.6) }), tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r, 0.3),
  }) },
  { name: 'frog from the front', w: 1.5, genes: r => ({
    chassis: { type: 'amphibianFront', r: r.range(9.5, 11.5), wide: r.range(1.12, 1.3), headS: r.range(0.84, 0.94), armX: r.range(0.36, 0.5) },
    head: { type: 'amphibianFace', wide: r.range(1.15, 1.32), eye: r.range(0.33, 0.42), pouch: r.chance(0.2) ? r.range(0.7, 1) : 0 },
    limbs: legs(r, r.pick(['frog', 'frog', 'toad'])), tail: none(), dorsal: none(), crown: popEyes(r), surface: { eyes: r.chance(0.5) ? 'dot' : 'none' },
  }) },
  // ---- top views ----
  { name: 'swimming frog', w: 2, genes: r => ({
    chassis: topBody(r, { r: r.range(8, 9.5), len: r.range(21, 26), bend: 0.02 }), head: frogHead(r, { point: r.range(0.3, 0.6) }),
    limbs: legs(r, 'frog', { pose: 'kick', loose: 0.05, toeLen: r.range(0.85, 1), web: 0.9, spread: 1.3, pj: [r.range(-0.5, 0.1), r.range(-0.2, 0.1), r.range(-0.1, 0.2)] }),
    tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r, 0.1),
  }) },
  { name: 'climbing tree frog', w: 2, genes: r => ({
    chassis: topBody(r, { r: r.range(7.2, 8.6), len: r.range(20, 25), bend: 0.12, prof: [[0, 0.45], [0.25, 0.72], [0.55, 0.96], [0.85, 0.9], [1, 0.84]], headS: 1 }),
    head: frogHead(r, { snout: r.range(1, 1.15), point: 0.15, eye: r.range(0.36, 0.42) }),
    limbs: legs(r, 'tree', { pose: 'climb', loose: 0.3, pad: 0.19, toeLen: 0.66, oneOut: r.chance(0.55) ? r.sign() : 0 }),
    tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r, 0.15, 0.1),
  }) },
  { name: 'flying frog', w: 1.5, genes: r => ({
    chassis: topBody(r, { r: r.range(7, 8.2), len: r.range(21, 25), prof: [[0, 0.5], [0.3, 0.8], [0.6, 0.95], [1, 0.86]], headS: 1 }),
    head: frogHead(r, { snout: r.range(1.05, 1.2), point: 0.3, eye: r.range(0.3, 0.36) }),
    limbs: legs(r, 'glide', { pose: 'glide', loose: 0.1, hl: r.range(0.72, 0.85), hw: 0.5, fl: 1.4, fw: 0.24, toes: 4, toeLen: r.range(1.9, 2.2), web: 1, spread: 1.45, foreSpread: 1.5, foreWeb: 1, fingerK: 0.75, fingers: 4, tr: 0.17, pad: 0.2, forePad: 0.18 }),
    tail: none(), dorsal: none(), crown: popEyes(r), surface: look(r, 0.1, 0),
  }) },
  { name: 'Surinam toad', w: 1.5, genes: r => ({ // flat as a dead leaf
    chassis: { type: 'amphibianPipa', r: r.range(9.5, 11), len: r.range(19, 23), square: r.range(0.5, 1), headL: r.range(0.7, 0.85), headW: r.range(0.5, 0.62),
      arm: r.range(1.2, 1.45), armOut: r.range(0.8, 1.05), armFwd: r.range(0.05, 0.3), finger: r.range(0.5, 0.62),
      thigh: r.range(0.42, 0.52), hipA: r.range(1.8, 2.1), shinA: r.range(2.4, 2.7), footA: r.range(2.3, 2.6), toe: r.range(1.8, 2.1), footSpread: r.range(1.6, 1.85) },
    head: { type: 'amphibianNone' }, limbs: legs(r, 'claw', { ownNone: true }), tail: none(), dorsal: none(), crown: none(), surface: { eyes: 'none' },
  }) },
  // ---- tadpoles ----
  { name: 'tadpole', w: 2.5, genes: r => ({
    chassis: { type: 'amphibianTadpole', view: 'top', r: r.range(8.5, 10.5), len: r.range(12, 17), headS: 0.75 }, head: { type: 'amphibianNone' }, limbs: legs(r, 'frog', { ownNone: true }),
    tail: { tailLen: r.range(6.5, 9.5), w0: r.range(0.62, 0.75), mid: 0.5, w1: 0.07, curl: r.range(0, 1.3), wave: r.range(1.4, 3.2), freq: r.range(0.9, 1.4), tip: 'point' },
    dorsal: none(), crown: none(), surface: { eyes: 'none' },
  }) },
  { name: 'tadpole profile', w: 1.3, genes: r => ({
    chassis: { type: 'amphibianTadpole', view: 'side', r: r.range(8, 9.5), len: r.range(13, 17), headS: 0.75 }, head: { type: 'amphibianNone' }, limbs: legs(r, 'frog', { ownNone: true }),
    tail: { tailLen: r.range(6, 8), w0: r.range(0.75, 0.9), mid: r.range(1.3, 1.5), w1: 0.05, curl: r.range(0.1, 0.7), up: true, wave: r.range(0.3, 1.2), freq: 1, tip: 'point' },
    dorsal: none(), crown: none(), surface: { eyes: r.chance(0.5) ? 'dot' : 'none' },
  }) },
  { name: 'tadpole with hind legs', w: 1.5, genes: r => ({
    chassis: { type: 'amphibianTadpole', view: 'top', r: r.range(8.5, 10), len: r.range(14, 18), headS: 0.75, limbS: r.range(0.55, 0.75) }, head: { type: 'amphibianNone' },
    limbs: legs(r, 'frog', { only: 'hind', pose: 'sit', hl: r.range(0.6, 0.75), hw: 0.42, toeLen: 0.4, toes: 3, loose: 0.2 }),
    tail: { tailLen: r.range(6, 8.5), w0: r.range(0.8, 0.92), mid: 0.5, w1: 0.07, curl: r.range(0, 1.2), wave: r.range(1.4, 3), freq: r.range(0.9, 1.4), tip: 'point' },
    dorsal: none(), crown: none(), surface: { eyes: 'none' },
  }) },
  { name: 'four-legged tadpole', w: 1.3, genes: r => ({
    chassis: topBody(r, { r: r.range(9.5, 11), len: r.range(11, 14), headS: 0.8, prof: [[0, 0.62], [0.3, 0.98], [0.65, 1.08], [1, 0.92]] }), head: frogHead(r, { snout: r.range(0.8, 0.95), point: 0, wide: 1.1 }),
    limbs: legs(r, 'frog', { pose: 'sit', hl: r.range(0.58, 0.68), hw: 0.4, fl: 0.55, fw: 0.22, toeLen: 0.3, toes: 3, loose: 0.08 }),
    tail: { tailLen: r.range(7, 9), w0: r.range(1.25, 1.45), mid: 0.75, w1: 0.08, curl: r.range(0, 1.2), wave: r.range(1.2, 2.6), freq: r.range(0.9, 1.3), tip: 'point' },
    dorsal: none(), crown: popEyes(r), surface: look(r, 0.1, 0),
  }) },
  { name: 'froglet', w: 1.5, genes: r => ({ // just out of the pond: frog in front, tail stub behind
    chassis: sit(r, { r: r.range(8.5, 10), len: r.range(15, 19), pitch: r.range(0.45, 0.62), headS: 1, tailS: 0.5 }), head: frogHead(r, { eye: r.range(0.34, 0.4) }),
    limbs: legs(r, 'frog', { hl: r.range(1.15, 1.3) }),
    tail: { tailLen: r.range(3, 6), w0: 0.8, mid: 0.6, w1: 0.1, curl: r.range(0.2, 1), wave: r.range(0.3, 1.2), up: false, tip: 'point' },
    dorsal: none(), crown: popEyes(r), surface: look(r, 0.4, 0),
  }) },
  // ---- caecilians ----
  { name: 'caecilian', w: 1.2, genes: r => ({
    chassis: { type: 'amphibianCaecilian', style: 'wave', r: r.range(3.6, 4.4), len: r.range(58, 72), amp: r.range(6, 10), k: r.range(1.1, 1.7), ring: r.range(0.75, 0.95) },
    head: { type: 'amphibianBlunt', len: r.range(1.2, 1.6), tipR: r.range(0.5, 0.62) }, limbs: legs(r, 'frog', { ownNone: true }), tail: none(), dorsal: none(), crown: none(), surface: { eyes: 'none' },
  }) },
  { name: 'looped caecilian', w: 0.7, genes: r => ({
    chassis: { type: 'amphibianCaecilian', style: 'loop', r: r.range(3.2, 3.7), c: r.range(5.2, 6.2), R: r.range(12.5, 14.5), lead: r.range(0.9, 1.3), tailLead: r.range(0.7, 1.2), drift: r.range(-0.6, 0.6), ring: r.range(0.75, 0.95) },
    head: { type: 'amphibianBlunt', len: r.range(1.2, 1.6), tipR: r.range(0.5, 0.62) }, limbs: legs(r, 'frog', { ownNone: true }), tail: none(), dorsal: none(), crown: none(), surface: { eyes: 'none' },
  }) },
  // ---- newts (the salamander tag covers Caudata in depth; these are for completeness) ----
  { name: 'crested newt', w: 0.7, genes: r => ({
    chassis: sit(r, { seat: null, r: r.range(5.8, 6.6), len: r.range(28, 34), pitch: r.range(0.02, 0.1), rump: 0.7, belly: 1, chest: 0.88, neck: 0.74, hump: 0, arch: r.range(0.1, 0.4), rearLift: 1, headS: 0.95, tailS: 0.62, face: r.range(-0.1, 0.2) }),
    head: frogHead(r, { snout: r.range(1.3, 1.5), point: 0.3, deep: 0.6, eye: r.range(0.2, 0.25), eyeUp: 0.1 }),
    limbs: legs(r, 'newt', { stride: true, ankleX: r.range(-0.6, 0.2), farDX: r.range(0.6, 1), reach: r.range(0.3, 0.7), farReach: r.range(-0.9, -0.5) }),
    tail: { tailLen: r.range(9, 12), w0: 0.85, mid: r.range(1.1, 1.3), w1: 0.06, curl: r.range(0.2, 0.8), wave: r.range(0.5, 1.5), freq: 1, up: r.chance(0.3), tip: 'point' },
    dorsal: { type: 'amphibianCrest', h: r.range(1.5, 1.9), n: r.int(5, 7) }, crown: none(), surface: look(r, 0.2, 0.5),
  }) },
];

export default {
  id: 'amphibian', label: 'Amphibians', short: 'Amphibians',
  sig: { limbs: 3, head: 2.2, crown: 1.4, tail: 0.8, dorsal: 0.5 },
  // M4: frog legs on an arthropod body read as a cricket; lead that pair and lend no legs there
  mix: {
    arthropod: { lead: 4, sig: { head: 3, crown: 1.4, dorsal: 0.6 } },
    // on a mushroom keep the fungus outline: mostly a frog face, legs less often
    fungus: { sig: { head: 3, limbs: 1.2, crown: 1.4 }, want: [[3, 1], [1, 2]] },
  },
  species,
};
