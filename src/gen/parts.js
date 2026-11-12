// Anatomy parts. Every critter is: a CHASSIS (body plan) that draws a body and
// exposes sockets, plus parts plugged into those sockets: HEAD, LIMBS, TAIL,
// DORSAL ornaments, CROWN ornaments, SURFACE (white) details.
// Any part can plug into any chassis; that is what makes tags stackable.
//
// Conventions: y is down (SVG). Side-view critters face +x and stand on y=0.
// Top-view critters are centred on y=0 and head toward +x.
// C = { ink, rng, plump, lift, plan }.
import { add, sub, mul, lerp, dist, angOf, polar, angDiff, clamp, mix, MINW, frame, spline, polyline, profile, pathAt, tube, ellipse, leaf } from './core.js';

const PI = Math.PI;

// Extension registries: tag files may add new foot / tail-tip / crown / dorsal types here
// (and new entries on `chassis` and `heads`) without touching this file.
export const feet = {}, tips = {}, crowns = {}, dorsals = {};

// =====================================================================
// CHASSIS
// =====================================================================
function backStrip(path, rad, t0, t1, n, sideSign) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = mix(t0, t1, i / (n - 1)), { p, ang } = pathAt(path, t);
    const na = ang + sideSign * PI / 2;
    out.push({ p: polar(p, na, rad(t) * 0.85), dir: na, t });
  }
  return out;
}

export const chassis = {
  // Side-view quadruped: mouse, dragon, sitting frog (with pitch).
  quad(C, g) {
    const { ink } = C, r = g.r * C.plump, L = g.len, lift = C.lift * r;
    const hip = [-L / 2, -(lift + r * 0.9)], sh = [L / 2, hip[1] - L * Math.tan(g.pitch)];
    const mid = add(lerp(hip, sh, 0.5), [0, -g.arch * r]);
    const neckA = -g.neckAng, neckEnd = polar(sh, neckA, (g.neckLen + 0.55) * r);
    const path = spline([hip, mid, sh, neckEnd], 8);
    const nk = g.neckW;
    const rad = profile([[0, r * 0.82], [0.3, r], [0.62, r * 0.92], [0.8, r * mix(0.9, nk, 0.6)], [1, r * nk]]);
    ink.poly(tube(path, rad));
    const limbs = [];
    const mk = (base, dx, role, far) => limbs.push({ p: add(base, [dx * r, r * 0.3]), dir: PI / 2, s: r, role, far, ground: 0, fwd: 0, side: 1 });
    mk(sh, 0.25, 'fore', true); mk(hip, -0.2, 'hind', true);
    mk(sh, -0.25, 'fore', false); mk(hip, 0.3, 'hind', false);
    return {
      view: 'side', r, path, rad,
      head: { p: neckEnd, dir: neckA, face: neckA * 0.35, s: r * g.headS, sym: false },
      tail: { p: polar(hip, PI + 0.5, r * 0.5), dir: PI + C.rng.range(0.1, 0.7), s: r * 0.6 },
      limbs, back: [backStrip(path, rad, 0.04, 0.8, 14, -1)],
    };
  },

  // Upright biped: pear-shaped standing creature.
  upright(C, g) {
    const { ink } = C, r = g.r * C.plump, lift = C.lift * r * 0.7;
    const base = [0, -(lift + r * 0.75)], top = [g.lean * r, base[1] - g.h];
    const path = spline([base, add(lerp(base, top, 0.5), [-g.lean * r * 0.35, 0]), top], 10);
    const rad = profile([[0, r * 0.88], [0.22, r], [0.7, r * g.shoulder], [1, r * g.shoulder * 0.85]]);
    ink.poly(tube(path, rad));
    const sh = pathAt(path, 0.72).p, rs = rad(0.72);
    const limbs = [
      { p: add(base, [-r * 0.4, r * 0.35]), dir: PI / 2, s: r * 0.9, role: 'hind', far: true, ground: 0, fwd: 0, side: 1 },
      { p: add(base, [r * 0.4, r * 0.35]), dir: PI / 2, s: r * 0.9, role: 'hind', far: false, ground: 0, fwd: 0, side: 1 },
      { p: add(sh, [rs * 0.55, 0]), dir: C.rng.range(0.3, 1.1), s: r * 0.8, role: 'arm', fwd: PI / 2, side: 1 },
      { p: add(sh, [-rs * 0.75, 0]), dir: PI - C.rng.range(0.5, 1.2), s: r * 0.8, role: 'arm', fwd: PI / 2, side: -1 },
    ];
    return {
      view: 'side', r, path, rad,
      head: { p: top, dir: -PI / 2 + 0.12, face: C.rng.range(-0.12, 0.2), s: r * g.headS, sym: false },
      tail: { p: add(base, [-r * 0.8, r * 0.1]), dir: PI + C.rng.range(-0.1, 0.5), s: r * 0.5 },
      limbs, back: [backStrip(path, rad, 0.1, 0.85, 12, -1)],
    };
  },

  // Rooted stalk: fungi and plants. Head sits on top; roots at the base.
  rooted(C, g) {
    const { ink, rng } = C, r = g.r * C.plump, lift = C.lift * r * 2.2;
    const base = [0, -lift], top = [g.bend * g.h, base[1] - g.h];
    const path = spline([base, add(lerp(base, top, 0.5), [-g.bend * g.h * 0.45 + g.sway * g.h, 0]), top], 10);
    const rad = profile([[0, r * g.flare], [0.18, r * mix(g.flare, 1, 0.7)], [0.6, r * mix(1, g.taper, 0.6)], [1, r * g.taper]]);
    ink.poly(tube(path, rad));
    const end = pathAt(path, 1);
    const limbs = [-1, 1].map(sd => ({ p: add(base, [sd * r * g.flare * 0.5, lift > 0 ? 0 : -r * 0.3]), dir: PI / 2 - sd * 1.0, s: r * 1.3, role: 'root', ground: 0, fwd: sd > 0 ? 0 : PI, side: sd, stanceDir: sd }));
    if (rng.chance(0.5)) limbs.push({ p: add(base, [0, -r * 0.2]), dir: PI / 2 - rng.sign() * 0.5, s: r * 1.1, role: 'root', ground: 0, fwd: 0, side: 1, stanceDir: rng.sign() * 0.5 });
    return {
      view: 'side', rooted: true, r, path, rad,
      head: { p: end.p, dir: -PI / 2 + angDiff(end.ang, -PI / 2) * (g.headTilt ?? 0.5), face: rng.range(-0.2, 0.2), s: r * g.headS, sym: false, radial: true },
      tail: { p: add(base, [-r * 0.3, -r * 0.4]), dir: PI + rng.range(0, 0.4), s: r * 0.7 },
      limbs, back: [backStrip(path, rad, 0.25, 0.85, 8, -1), backStrip(path, rad, 0.25, 0.85, 8, 1)],
      alt: true,
    };
  },

  // Top-view crawler: salamanders, lizards, splayed frogs.
  crawler(C, g) {
    const { ink, rng } = C, r = g.r * C.plump, L = g.len;
    const ph = rng.range(0, 2 * PI), k = rng.range(0.9, 1.5), ctrl = [];
    for (let i = 0; i < 5; i++) ctrl.push([-L / 2 + L * i / 4, g.wave * Math.sin(ph + i * k)]);
    const path = spline(ctrl, 7);
    const rad = profile([[0, r * 0.72], [0.2, r * 0.95], [0.5, r * g.belly], [0.8, r * 0.9], [1, r * g.neckW]]);
    ink.poly(tube(path, rad));
    const limbs = [];
    for (const [t, role, tilt] of [[0.82, 'fore', -0.45], [0.14, 'hind', 0.35]]) {
      const { p, ang } = pathAt(path, t);
      for (const sd of [-1, 1]) limbs.push({ p: polar(p, ang + sd * PI / 2, rad(t) * 0.55), dir: ang + sd * (PI / 2 + tilt), s: r, role, fwd: ang, side: sd });
    }
    const e = pathAt(path, 1), b = pathAt(path, 0);
    return {
      view: 'top', r, path, rad,
      head: { p: e.p, dir: e.ang, face: e.ang, s: r * g.headS, sym: true },
      tail: { p: b.p, dir: b.ang + PI, s: r * 0.72, wavePhase: ph },
      limbs, back: [backStrip(path, rad, 0.3, 0.68, 8, -1), backStrip(path, rad, 0.3, 0.68, 8, 1)],
    };
  },

  // Top-view segmented body: beetles, crabs, isopods, centipedes.
  segmented(C, g) {
    const { ink, rng } = C, r = g.r * C.plump, n = g.n, L = g.len;
    const curve = g.curve * rng.sign();
    const ctrl = [[-L / 2, 0], [0, curve * L * 0.5], [L / 2, 0]];
    const path = spline(ctrl, 10);
    const env = g.env, rad = t => r * env(t);
    const limbs = [], seams = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, { p, ang } = pathAt(path, t), w = rad(t);
      ink.poly(ellipse(p, L / n * g.overlap, w, ang, 26));
      if (i > 0) { const q = pathAt(path, i / n); seams.push({ p: q.p, ang: q.ang, w: Math.min(rad(i / n), w) }); }
      const tf = 1 - t; // 0 at head
      if (g.legs(i, n)) {
        const tilt = mix(-0.7, 0.7, tf) * g.legFan;
        for (const sd of [-1, 1]) limbs.push({ p: polar(p, ang + sd * PI / 2, w * 0.7), dir: ang + sd * (PI / 2 + tilt), s: r * g.legS, role: limbs.length < 2 ? 'fore' : (tf > 0.6 ? 'hind' : 'mid'), fwd: ang, side: sd, arthro: true });
      }
    }
    const e = pathAt(path, 1), b = pathAt(path, 0);
    return {
      view: 'top', r, path, rad, seams,
      head: { p: polar(e.p, e.ang, -L / n * 0.2), dir: e.ang, face: e.ang, s: rad(1 - 0.5 / n) * g.headS, sym: true },
      tail: { p: polar(b.p, b.ang, L / n * 0.3), dir: b.ang + PI, s: rad(0.5 / n) * 0.8 },
      limbs: limbs.reverse(), // fore pair was pushed last (head is at t=1)
      back: [backStrip(path, rad, 0.2, 0.8, 8, -1), backStrip(path, rad, 0.2, 0.8, 8, 1)],
    };
  },
};

// =====================================================================
// FEET
// =====================================================================
function foot(C, p, ang, s, g, small = 1) {
  const { ink, rng } = C, k = small;
  const tl = (g.toeLen ?? 0.8) * s * k;
  switch (g.foot) {
    case 'toes': case 'web': {
      const n = g.toes ?? 4, spread = g.spread ?? 1.5, tips = [];
      for (let i = 0; i < n; i++) {
        const a = ang + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
        const len = tl * (1 - 0.25 * Math.abs(i / (n - 1 || 1) - 0.5) * 2 + 0.12);
        const tip = polar(p, a, len); tips.push(tip);
        ink.poly(tube(polyline([p, tip], 3), profile([[0, Math.max(s * 0.11 * k, MINW / 2)], [1, Math.max(s * 0.07 * k, MINW / 2.2)]])));
        if (g.tipDot) ink.dot(tip, Math.max(s * 0.12 * k, MINW * 0.62));
      }
      if (g.foot === 'web') ink.poly([p, ...tips.map(t => lerp(p, t, 0.82))]);
      ink.dot(p, s * 0.16 * k);
      break;
    }
    case 'paw': ink.oval(polar(p, ang, s * 0.22 * k), s * 0.36 * k, s * 0.17 * k, ang); break;
    case 'pad': ink.oval(polar(p, ang, s * 0.12 * k), s * 0.34 * k, s * 0.26 * k, ang); break;
    case 'claw': {
      for (const da of [-0.55, 0, 0.55]) ink.poly(leaf(p, ang + da, tl * 0.9, s * 0.2 * k, da * 0.25, 0.25));
      ink.dot(p, s * 0.15 * k);
      break;
    }
    case 'pincer': {
      const c = polar(p, ang, s * 0.45 * k);
      ink.oval(c, s * 0.5 * k, s * 0.34 * k, ang);
      for (const sd of [-1, 1]) {
        const b = polar(c, ang + sd * 0.7, s * 0.34 * k);
        ink.poly(tube(spline([b, polar(b, ang + sd * 0.35, s * 0.5 * k), polar(c, ang + sd * 0.1, s * 1.25 * k)], 5), profile([[0, s * 0.2 * k], [1, 0.1]])));
      }
      break;
    }
    case 'root': {
      const n = g.toes ?? 3;
      for (let i = 0; i < n; i++) {
        const a = ang + (i / (n - 1 || 1) - 0.5) * 1.3 + rng.range(-0.2, 0.2), len = tl * rng.range(0.9, 1.6);
        const m = polar(polar(p, a, len * 0.5), a + PI / 2, len * rng.range(-0.25, 0.25));
        ink.line([p, m, polar(p, a + rng.range(-0.3, 0.3), len)], s * 0.2 * k);
      }
      break;
    }
    default: if (feet[g.foot]) feet[g.foot](C, p, ang, s, g, k); break; // 'point' draws nothing
  }
}

// =====================================================================
// LIMBS
// =====================================================================
function ik(a, b, l1, l2, sign) {
  const d = Math.min(dist(a, b), (l1 + l2) * 0.999), base = angOf(a, b);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
  return polar(polar(a, base, x), base + PI / 2, h * sign);
}

export function limb(C, sock, g) {
  const { ink, rng } = C, s = sock.s, role = sock.role;
  const isArm = role === 'arm', hind = role === 'hind';
  if (sock.far && g.noFar) return;
  let len = g.len * s * (isArm ? (g.arm ?? 0.75) : 1) * (hind ? (g.hind ?? 1) : 1);
  const w0 = Math.max(g.w * s * (hind ? (g.hindW ?? 1) : 1) * (isArm ? 0.8 : 1), MINW), w1 = Math.max(w0 * g.taper, MINW);
  const curve = g.angular ? (pts => polyline(pts, 4)) : (pts => spline(pts, 6));
  const jit = () => rng.range(-0.12, 0.12);
  let pts, fa, fp;
  if (sock.ground != null && !isArm) {
    const hip = sock.p;
    if (role === 'root') {
      // sprawl outward along the ground
      const sd = sock.stanceDir ?? sock.side;
      fp = [hip[0] + sd * Math.max(len * 0.75, 0.01), sock.ground - w1 * 0.5];
      const d = dist(hip, fp), L = Math.max(len, d * 1.04);
      const knee = ik(hip, fp, L / 2, L / 2, sd > 0 ? -1 : 1);
      pts = [hip, knee, fp]; fa = sd >= 0 ? 0.15 : PI - 0.15;
    } else if (g.fold && hind) {
      // folded frog leg: thigh forward-up, shin back down, long foot forward
      const knee = add(hip, [len * 0.42, -len * 0.16]), ankle = [hip[0] - len * 0.12, sock.ground - w1 * 0.6];
      ink.poly(tube(spline([hip, knee], 4), profile([[0, w0 * 0.75], [1, w0 * 0.5]])));
      ink.poly(tube(spline([knee, lerp(knee, ankle, 0.5), ankle], 4), profile([[0, w0 * 0.5], [1, w1 * 0.5]])));
      fp = [ankle[0] + len * 0.5, sock.ground - w1 * 0.45];
      ink.poly(tube(polyline([ankle, fp], 4), w1 * 0.45));
      foot(C, fp, 0, s, g, sock.far ? 0.85 : 1);
      return;
    } else {
      const stance = (g.stance ?? 0.15) * s * (role === 'fore' ? 1 : -0.6) + jit() * s;
      fp = [hip[0] + stance, sock.ground - w1 * 0.5];
      const d = dist(hip, fp), L = Math.max(len, d * 1.03);
      const sign = (role === 'fore' ? 1 : -1) * (g.kneeFlip ? -1 : 1);
      const knee = ik(hip, fp, L * 0.5, L * 0.5, sign);
      pts = [hip, knee, fp]; fa = 0;
    }
  } else {
    // free limb (top view, or an arm)
    const a0 = sock.dir + jit();
    const toward = sock.fwd != null ? Math.sign(angDiff(sock.fwd, a0)) || 1 : 1;
    const bsign = toward * (hind ? -1 : 1) * (g.bendFlip ? -1 : 1);
    if (g.joints === 3) {
      const k1 = polar(sock.p, a0 - bsign * 0.5, len * 0.4), k2 = polar(k1, a0 + bsign * g.bend * 0.6, len * 0.4);
      fa = a0 + bsign * g.bend * 1.3; fp = polar(k2, fa, len * 0.35);
      pts = [sock.p, k1, k2, fp];
    } else {
      const knee = polar(sock.p, a0, len * 0.5);
      fa = a0 + bsign * g.bend + jit(); fp = polar(knee, fa, len * 0.5);
      pts = [sock.p, knee, fp];
    }
  }
  const footG = (sock.role === 'fore' && g.foreFoot) ? { ...g, foot: g.foreFoot } : g;
  if (footG.foot === 'pincer') { // claws get a sturdier arm
    ink.poly(tube(curve(pts), profile([[0, w0 * 0.5], [1, w0 * 0.55]])));
  } else {
    ink.poly(tube(curve(pts), profile([[0, w0 * 0.5], [0.5, mix(w0, w1, 0.6) * 0.5], [1, w1 * 0.5]])));
  }
  foot(C, fp, fa, s, footG, (sock.far ? 0.85 : 1) * (isArm ? 0.8 : 1));
}

// =====================================================================
// TAILS
// =====================================================================
export function tail(C, sock, g) {
  if (!g || g.type === 'none') return;
  const { ink, rng } = C, s = sock.s, side = C.plan.view === 'side';
  const n = 20, L = g.len * s;
  let h = sock.dir, p = sock.p;
  const pts = [p], ph = sock.wavePhase ?? rng.range(0, 6.28), cs = (g.curlSign ?? rng.sign());
  // in side view prefer curling up
  // side view: g.up=true curls up and over the back, g.up=false trails along the ground
  const curl = side ? Math.abs(g.curl) * ((g.up ?? rng.chance(0.4)) ? 1 : -1) : g.curl * cs;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    h += (curl * (g.spiral ? 0.3 + 3.2 * u * u : 1) + g.wave * Math.cos(ph + u * (g.freq ?? 1) * 6.28)) / n;
    p = polar(p, h, L / n * (g.spiral ? 1.25 - 0.8 * u : 1));
    if (side && p[1] > -g.w1 * s - 0.6) p = [p[0], -g.w1 * s - 0.6];
    pts.push(p);
  }
  const w1 = Math.max(g.w1 * s, MINW / 2);
  ink.poly(tube(pts, profile([[0, g.w0 * s], [0.5, mix(g.w0 * s, w1, 1 - (g.mid ?? 0.5))], [1, w1]])));
  const e = pts[n], ea = angOf(pts[n - 2], e);
  switch (g.tip) {
    case 'tuft': for (let i = 0; i < 5; i++) { const a = ea + (i / 4 - 0.5) * 1.5; ink.poly(leaf(e, a, s * rng.range(0.9, 1.5) * (g.tipS ?? 1), s * 0.4, rng.range(-0.15, 0.15), 0.3)); } break;
    case 'spade': { const q = s * (g.tipS ?? 1); ink.poly([polar(e, ea + PI, q * 0.3), polar(e, ea + 1.9, q * 0.75), polar(e, ea, q * 1.7), polar(e, ea - 1.9, q * 0.75)]); break; }
    case 'pom': ink.dot(polar(e, ea, s * 0.3), s * 0.75 * (g.tipS ?? 1)); break;
    case 'club': ink.oval(polar(e, ea, s * 0.5), s * 0.9 * (g.tipS ?? 1), s * 0.5 * (g.tipS ?? 1), ea); break;
    case 'fan': for (let i = 0; i < 5; i++) { const a = ea + (i / 4 - 0.5) * 1.7; ink.poly(leaf(e, a, s * 1.5 * (g.tipS ?? 1), s * 0.75, 0, 0.6)); } break;
    case 'sting': { ink.dot(e, s * 0.5); ink.poly(leaf(e, ea + 0.9 * (curl > 0 ? 1 : -1), s * 1.3, s * 0.45, 0.2 * (curl > 0 ? 1 : -1), 0.2)); break; }
    case 'leaf': ink.poly(leaf(e, ea, s * 2.2 * (g.tipS ?? 1), s * 1.3, rng.range(-0.1, 0.1), 0.45)); break;
    case 'fork': for (const sd of [-1, 1]) ink.poly(leaf(e, ea + sd * 0.5, s * 1.3, s * 0.4, sd * 0.2, 0.2)); break;
    case 'bud': ink.oval(polar(e, ea, s * 0.4), s * 0.75, s * 0.5, ea); break;
    default: if (tips[g.tip]) tips[g.tip](C, e, ea, s, g, curl); break;
  }
}

// =====================================================================
// HEADS  -> { eyes:[{p,r}], mounts:[{p,dir,flip,s}], spots:[{p,r}] }
// =====================================================================
function capPoly(F, W, H, shape, under) {
  const N = 22, top = [], bot = [];
  const fn = {
    dome: u => Math.sqrt(Math.max(1 - u * u, 0)),
    cone: u => Math.pow(1 - Math.abs(u), 1.25) * 1.0 + 0.06 * Math.sqrt(Math.max(1 - u * u, 0)),
    flat: u => 0.5 * Math.pow(Math.max(1 - u * u * u * u, 0), 0.5),
    bell: u => Math.pow(Math.max(1 - u * u, 0), 0.32) * (0.8 + 0.2 * (1 - Math.abs(u))),
    funnel: u => 0.55 * Math.pow(Math.abs(u), 1.6) + 0.12 * Math.sqrt(Math.max(1 - u * u, 0)),
  }[shape] || (u => Math.sqrt(Math.max(1 - u * u, 0)));
  for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N; top.push(F(H * fn(u), W * u)); }
  for (let i = N - 1; i >= 1; i--) { const u = -1 + 2 * i / N; bot.push(F(under * H * (1 - u * u) - (shape === 'funnel' ? H * 0.5 * (1 - Math.abs(u)) : 0), W * u)); }
  return top.concat(bot);
}

export const heads = {
  // Snouted head. Covers salamander wedge, mouse cone, dragon muzzle, frog, soft Jansson-ish snoot.
  snout(C, sock, g) {
    const { ink } = C, s = sock.s, sym = sock.sym;
    const c = polar(sock.p, sock.dir, s * g.skull * 0.45);
    const F = frame(c, sock.face, s, 1);
    const dr = sym ? 0 : g.droop;
    const tip = [g.snoutLen, dr * g.snoutLen];
    const path = spline([F(-g.skull * 0.25, 0), F(g.snoutLen * 0.45, dr * g.snoutLen * 0.2), F(tip[0], tip[1])], 7);
    ink.poly(tube(path, profile([[0, g.skull * s], [0.5, mix(g.skull, g.tipR, g.mid ?? 0.5) * s], [1, g.tipR * s]])));
    // connect to neck
    ink.poly(tube(polyline([sock.p, c], 2), g.skull * s * 0.8));
    const eyes = [], mounts = [];
    const ex = g.eyeX ?? 0.3, ey = g.skull * (g.eyeY ?? 0.5);
    const sides = sym ? [-1, 1] : [-1];
    for (const sd of sides) {
      if (g.bulge) ink.dot(F(ex, sd * g.skull * (sym ? 0.82 : 0.9)), g.bulge * s);
      eyes.push({ p: g.bulge ? F(ex, sd * g.skull * (sym ? 0.82 : 0.9)) : F(ex, sd * ey), r: s * (g.eyeR ?? 0.2) });
      mounts.push({ p: F(g.crownX ?? -0.15, sd * g.skull * 0.75), dir: sock.face + sd * (sym ? 1.25 : PI / 2 + 0.25), flip: sd, s });
    }
    if (g.jaw && !sym) { // open mouth wedge
      const t = F(tip[0] + g.tipR * 0.7, tip[1] + g.tipR * 0.35);
      ink.poly([t, F(g.snoutLen * 0.25, tip[1] * 0.3 + g.tipR * 0.45), F(tip[0] + g.tipR * 0.5, tip[1] + g.tipR * 1.4)], 'w');
    }
    if (g.whiskers) for (const sd of sides) for (let i = 0; i < 3; i++) {
      const b = F(g.snoutLen * 0.8, sd * g.tipR * 0.3);
      ink.line([b, polar(b, sym ? sock.face + sd * (0.7 + i * 0.35) : sock.face + (i - 1) * 0.5 + 0.9, s * 1.3)], MINW);
    }
    return { eyes, mounts, spots: [], tip: F(tip[0], tip[1]) };
  },

  // Mushroom cap as head.
  cap(C, sock, g) {
    const { ink, rng } = C, s = sock.s;
    const F = frame(sock.p, sock.dir, s, 1);
    if (g.shape === 'morel') {
      ink.oval(F(g.h * 0.55, 0), g.h * 0.62 * s, g.w * 0.6 * s, sock.dir);
      const spots = []; for (let i = 0; i < 9; i++) spots.push({ p: F(g.h * rng.range(0.15, 1), g.w * rng.range(-0.38, 0.38)), r: s * rng.range(0.12, 0.2) });
      return { eyes: [{ p: F(-0.35, -0.3), r: s * 0.2 }], mounts: [{ p: F(g.h * 1.1, 0), dir: sock.dir, flip: 1, s }], spots };
    }
    ink.poly(capPoly(F, g.w, g.h, g.shape, g.under));
    if (g.ring) ink.poly(capPoly(frame(F(-g.w * 0.45, 0), sock.dir, s, 1), g.w * 0.32, g.h * 0.25, 'cone', -0.6));
    const spots = [];
    for (let i = 0; i < 7; i++) { const u = rng.range(-0.72, 0.72); spots.push({ p: F(g.h * rng.range(0.3, 0.75) * Math.sqrt(1 - u * u) + g.under * g.h * 0.5, g.w * u), r: s * rng.range(0.1, 0.22) }); }
    const gills = [];
    if (g.under > 0.12) for (let i = -3; i <= 3; i++) gills.push([F(g.under * g.h * 0.2, g.w * i * 0.2), F(g.under * g.h * (1 - (i * 0.25) ** 2) * 0.9, g.w * i * 0.27)]);
    const eyeY = sock.radial ? -0.28 : -0.3;
    return {
      eyes: [{ p: F(g.under * g.h + g.h * 0.28, g.w * -0.28), r: s * 0.2 }, { p: F(g.under * g.h + g.h * 0.28, g.w * 0.28), r: s * 0.2 }],
      mounts: [{ p: F(g.h * (g.shape === 'funnel' ? 0.2 : 0.95), 0), dir: sock.dir, flip: 1, s }], spots, gills, isCap: true,
    };
  },

  // Flower / bud / seed-head.
  flower(C, sock, g) {
    const { ink, rng } = C, s = sock.s, c = polar(sock.p, sock.dir, s * 0.3);
    const n = g.petals, spread = g.spread;
    for (let i = 0; i < n; i++) {
      const a = sock.dir + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0) + rng.range(-0.06, 0.06);
      ink.poly(leaf(c, a, s * g.pl * rng.range(0.9, 1.1), s * g.pw, 0, g.fat ?? 0.6));
    }
    ink.dot(c, s * g.disc);
    return { eyes: [{ p: polar(c, sock.dir - 1.2, s * g.disc * 0.45), r: s * 0.18 }, { p: polar(c, sock.dir + 1.2, s * g.disc * 0.45), r: s * 0.18 }], mounts: [{ p: polar(c, sock.dir, s * g.disc * 0.8), dir: sock.dir, flip: 1, s }], spots: [] };
  },

  // Snap-trap jaws (carnivorous plant).
  trap(C, sock, g) {
    const { ink } = C, s = sock.s, ax = sock.radial ? sock.dir : sock.face;
    const c = polar(sock.p, sock.dir, s * 0.2);
    ink.poly(tube(polyline([sock.p, c], 2), s * 0.6));
    for (const sd of [-1, 1]) {
      const a = ax + sd * g.gape, F = frame(c, a, s, sd);
      const pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12 * PI; pts.push(F(g.len * 0.5 * (1 - Math.cos(t)), 0.75 * g.wid * Math.sin(t))); }
      ink.poly(pts);
      for (let i = 1; i <= g.teeth; i++) { const x = g.len * i / (g.teeth + 1); ink.poly([F(x - 0.12, 0.05), F(x, -0.42), F(x + 0.12, 0.05)]); }
    }
    return { eyes: [{ p: polar(c, ax - g.gape - 0.9, s * g.wid * 0.4), r: s * 0.18 }], mounts: [{ p: polar(c, ax + PI, s * 0.3), dir: ax - PI / 2, flip: 1, s }], spots: [] };
  },

  // Arthropod head capsule with optional mandibles / stalk eyes.
  capsule(C, sock, g) {
    const { ink } = C, s = sock.s, sym = sock.sym;
    const c = polar(sock.p, sock.dir, s * g.len * 0.5), F = frame(c, sock.face, s, 1);
    ink.oval(c, g.len * s * 0.7, g.wid * s, sock.face);
    ink.poly(tube(polyline([sock.p, c], 2), g.wid * s * 0.8));
    const sides = sym ? [-1, 1] : [-1];
    const eyes = [], mounts = [];
    for (const sd of sides) {
      if (g.mand) ink.poly(tube(spline([F(g.len * 0.5, sd * g.wid * 0.5), F(g.len * 0.5 + g.mand * 0.6, sd * g.wid * 0.75), F(g.len * 0.5 + g.mand, sd * g.wid * 0.1)], 5), profile([[0, s * 0.22], [1, 0.1]])));
      if (g.stalk) { const e = F(g.len * 0.4 + g.stalk * 0.5, sd * (g.wid * 0.6 + g.stalk * 0.5)); ink.line([F(g.len * 0.3, sd * g.wid * 0.5), e], s * 0.16); ink.dot(e, s * 0.2); }
      else if (g.bulge) ink.dot(F(g.len * 0.15, sd * g.wid * 0.92), g.bulge * s);
      eyes.push({ p: F(g.len * 0.15, sd * g.wid * 0.5), r: s * 0.16 });
      mounts.push({ p: F(g.len * 0.35, sd * g.wid * 0.6), dir: sock.face + sd * (sym ? 0.6 : 1.3), flip: sd, s });
    }
    return { eyes, mounts, spots: [] };
  },
};

// =====================================================================
// CROWN ornaments, drawn at each head mount
// =====================================================================
export function crown(C, hd, g) {
  if (!g || g.type === 'none') return;
  const { ink, rng } = C;
  const mounts = hd.mounts.slice();
  // in side view give paired things a second, offset copy (near + far)
  if (mounts.length === 1 && g.pair && !hd.isCap) { const m = mounts[0]; mounts.push({ ...m, p: polar(m.p, m.dir + PI / 2, m.s * 0.42), dir: m.dir + 0.35, far: true }); }
  for (const m of mounts) {
    const s = m.s * (g.size ?? 1) * (m.far ? 0.9 : 1), F = frame(m.p, m.dir, s, m.flip);
    switch (g.type) {
      case 'ears': {
        if (g.shape === 'round') ink.oval(F(g.len * 0.45, 0), g.len * 0.55 * s, g.wid * 0.5 * s, m.dir);
        else ink.poly(leaf(F(-0.15, 0), m.dir + m.flip * (g.lean ?? 0), g.len * s, g.wid * s, m.flip * (g.bend ?? 0), g.fat ?? 0.45));
        break;
      }
      case 'horns': ink.poly(tube(spline([F(-0.1, 0), F(g.len * 0.5, g.curve * g.len * 0.35), F(g.len, g.curve * g.len)], 6), profile([[0, s * g.wid * 0.5], [1, 0.08]]))); break;
      case 'gills': for (let i = 0; i < 3; i++) {
        const a = m.dir + m.flip * (i - 1) * 0.55 - m.flip * 0.5, len = s * g.len * (1 - 0.12 * Math.abs(i - 1));
        const tipP = polar(polar(m.p, a, len), a + m.flip * PI / 2, -len * 0.25);
        ink.poly(tube(spline([m.p, polar(m.p, a, len * 0.55), tipP], 5), profile([[0, s * 0.2], [0.6, s * 0.17], [1, s * 0.09]])));
        if (g.feather) for (let j = 1; j <= 3; j++) { const b = lerp(m.p, tipP, 0.3 + j * 0.2); for (const sd of [-1, 1]) ink.line([b, polar(b, a + sd * 1.1, s * 0.4)], MINW); }
      } break;
      case 'antennae': {
        const tipP = F(g.len, g.curve * g.len);
        ink.line([F(0, 0), F(g.len * 0.5, g.curve * g.len * 0.15), tipP], Math.max(s * 0.12, MINW));
        if (g.club) ink.dot(tipP, s * 0.2);
        break;
      }
      case 'tuft': for (let i = 0; i < g.n; i++) { const a = m.dir + (i / (g.n - 1 || 1) - 0.5) * g.spread; ink.poly(leaf(F(-0.1, 0), a, s * g.len * rng.range(0.7, 1.15), s * 0.3, rng.range(-0.2, 0.2), 0.3)); } break;
      case 'sprout': {
        const top = F(g.len * 0.5, 0);
        ink.line([F(-0.1, 0), top], Math.max(s * 0.16, MINW));
        for (const sd of [-1, 1]) ink.poly(leaf(top, m.dir + sd * 0.75, s * g.len * 0.75, s * g.len * 0.4, sd * 0.15, 0.5));
        break;
      }
      case 'minicap': {
        const top = F(g.len * 0.45, 0);
        ink.line([F(-0.1, 0), top], Math.max(s * 0.2, MINW * 1.3));
        ink.poly(capPoly(frame(top, m.dir, s, 1), g.len * 0.55, g.len * 0.5, g.shape ?? 'dome', 0.15));
        break;
      }
      case 'bloom': {
        const top = F(g.len * 0.5, 0);
        ink.line([F(-0.1, 0), top], Math.max(s * 0.14, MINW));
        for (let i = 0; i < 5; i++) ink.poly(leaf(top, m.dir + (i / 4 - 0.5) * 2.4, s * g.len * 0.5, s * g.len * 0.3, 0, 0.6));
        break;
      }
      default: if (crowns[g.type]) crowns[g.type](C, m, F, s, g); break;
    }
  }
}

// =====================================================================
// DORSAL ornaments along plan.back strips
// =====================================================================
export function dorsal(C, plan, g) {
  if (!g || g.type === 'none') return;
  const { ink, rng } = C, r = plan.r;
  const strips = plan.back;
  const leanBack = (st, i) => st[i].dir + (plan.view === 'side' && !plan.rooted ? -1 : 1) * 0; // hook for later
  strips.forEach((st, si) => {
    const sd = si === 0 ? -1 : 1, n = st.length;
    const at = u => st[clamp(Math.round(u * (n - 1)), 0, n - 1)];
    switch (g.type) {
      case 'spines': {
        const cnt = g.n;
        for (let i = 0; i < cnt; i++) {
          const u = (i + 0.5) / cnt, k = at(u), env = Math.sin(PI * mix(0.12, 0.88, u));
          ink.poly(leaf(polar(k.p, k.dir, -r * 0.2), k.dir + sd * (g.lean ?? 0.5) * (plan.view === 'side' ? -1 : 1) + rng.range(-0.12, 0.12), r * g.len * env * rng.range(0.85, 1.15), r * g.wid, 0, 0.22));
        }
        break;
      }
      case 'crest': {
        const top = [], bot = [];
        for (let i = 0; i < n; i++) { const u = i / (n - 1), k = st[i]; bot.push(polar(k.p, k.dir, -r * 0.3)); top.push(polar(k.p, k.dir, r * g.h * Math.sin(PI * u) ** 0.6 * (1 + g.wave * Math.sin(u * g.freq * 6.28)))); }
        ink.poly(bot.concat(top.reverse()));
        break;
      }
      case 'wings': {
        if (plan.rooted && si === 1 && rng.chance(0.0)) break;
        const k = at(g.at ?? 0.72), s = r * g.size;
        const tiltSide = plan.view === 'side' && !plan.rooted ? -0.75 : sd * 0.55 * (plan.view === 'top' ? -1 : -1);
        const base = polar(k.p, k.dir, -r * 0.3), a0 = k.dir + tiltSide;
        const tips = [];
        const nf = g.fingers;
        for (let i = 0; i < nf; i++) {
          const a = a0 + (plan.view === 'side' && !plan.rooted ? -1 : sd) * i * g.fan / (nf - 1) * (plan.view === 'top' ? 1 : 1), len = s * (1 - 0.13 * i);
          const tp = polar(base, a, len); tips.push(tp);
          ink.poly(tube(spline([base, polar(polar(base, a, len * 0.5), a - PI / 2, len * 0.05), tp], 4), profile([[0, r * 0.2], [1, MINW / 2]])));
        }
        // scalloped membrane
        const mem = [base];
        for (let i = 0; i < nf - 1; i++) { mem.push(tips[i]); const m = lerp(tips[i], tips[i + 1], 0.5); mem.push(lerp(m, base, 0.22)); }
        mem.push(tips[nf - 1]);
        ink.poly(mem);
        break;
      }
      case 'leaves': {
        const cnt = g.n;
        for (let i = 0; i < cnt; i++) {
          if (plan.alt && (i + si) % 2) continue;
          const k = at((i + 0.5) / cnt), up = plan.rooted ? -sd * 0.7 : (plan.view === 'side' ? -0.5 : sd * 0.5);
          const b = polar(k.p, k.dir, -r * 0.25);
          ink.poly(leaf(b, k.dir + up + rng.range(-0.2, 0.2), r * g.len * rng.range(0.8, 1.2), r * g.wid, rng.range(-0.12, 0.12) , g.fat ?? 0.45));
        }
        break;
      }
      case 'shrooms': {
        const cnt = g.n;
        for (let i = 0; i < cnt; i++) {
          if (plan.alt && (i + si) % 2) continue;
          const k = at((i + 0.5) / cnt + rng.range(-0.08, 0.08)), len = r * g.len * rng.range(0.7, 1.2), a = k.dir + rng.range(-0.3, 0.3) + (plan.rooted ? -sd * 0.6 : 0);
          const top = polar(k.p, a, len);
          ink.line([polar(k.p, k.dir, -r * 0.2), top], Math.max(len * 0.22, MINW * 1.2));
          ink.poly(capPoly(frame(top, a, len, 1), 0.6, 0.5, g.shape ?? 'dome', 0.15));
        }
        break;
      }
      case 'plates': {
        const cnt = g.n;
        for (let i = 0; i < cnt; i++) { const u = (i + 0.5) / cnt, k = at(u), env = Math.sin(PI * mix(0.1, 0.9, u)); ink.oval(polar(k.p, k.dir, r * g.len * env * 0.3), r * g.len * env * 0.6, r * g.wid * env, k.dir); }
        break;
      }
      case 'fur': {
        const cnt = g.n;
        for (let i = 0; i < cnt; i++) { const k = at(i / (cnt - 1)); ink.poly(leaf(polar(k.p, k.dir, -r * 0.2), k.dir + (plan.view === 'side' ? (plan.rooted ? sd * 0.4 : -0.7) : sd * 0.6) + rng.range(-0.25, 0.25), r * g.len * rng.range(0.7, 1.2), r * 0.3, rng.range(-0.2, 0.2), 0.3)); }
        break;
      }
      case 'tendrils': {
        const cnt = g.n;
        for (let i = 0; i < cnt; i++) {
          if (plan.alt && (i + si) % 2) continue;
          const k = at((i + 0.5) / cnt); let h = k.dir + rng.range(-0.3, 0.3), p = k.p; const pts = [p], cs = rng.sign(), len = r * g.len * rng.range(0.7, 1.2);
          for (let j = 0; j < 14; j++) { const u = j / 14; h += cs * (0.1 + 4.5 * u * u) / 14 * 2.2; p = polar(p, h, len / 14 * (1.2 - 0.7 * u)); pts.push(p); }
          ink.poly(tube(pts, profile([[0, Math.max(r * 0.12, MINW / 2)], [1, MINW / 2.2]])));
        }
        break;
      }
      default: if (dorsals[g.type]) dorsals[g.type](C, plan, st, sd, si, g, at); break;
    }
  });
}

// =====================================================================
// SURFACE: white interior details (eyes, spots, seams, gills)
// =====================================================================
export function surface(C, plan, hd, g, detail) {
  const { ink, rng } = C;
  if (detail <= 0 || !g) return;
  if (g.eyes && g.eyes !== 'none' && detail > 0.05) for (const e of hd.eyes) {
    const R = e.r * (g.eyeS ?? 1);
    if (g.eyes === 'ring') { ink.dot(e.p, R * 1.5, 'w'); ink.dot(add(e.p, [R * 0.3, R * 0.15]), R * 0.6, 'k2'); }
    else ink.dot(e.p, Math.max(R * 0.8, 0.7), 'w');
  }
  if (detail < 0.5) return;
  if (g.capSpots && hd.spots) for (const sp of hd.spots.slice(0, g.capSpots)) ink.dot(sp.p, sp.r, 'w');
  if (g.gills && hd.gills) for (const [a, b] of hd.gills) ink.line([a, b], MINW, 'w');
  if (g.spots) for (let i = 0; i < g.spots; i++) {
    const t = rng.range(0.08, 0.92), { p, ang } = pathAt(plan.path, t), rr = plan.rad(t);
    ink.oval(polar(p, ang + PI / 2, rr * rng.range(-0.5, 0.5)), rr * rng.range(0.14, 0.3), rr * rng.range(0.12, 0.22), ang + rng.range(-0.5, 0.5), 'w');
  }
  if (g.seams && plan.seams) for (const sm of plan.seams) ink.line([polar(sm.p, sm.ang + PI / 2, sm.w * 0.8), sm.p, polar(sm.p, sm.ang - PI / 2, sm.w * 0.8)], MINW, 'w');
  if (g.stripe) { const pts = []; for (let i = 0; i <= 8; i++) pts.push(pathAt(plan.path, mix(0.1, 0.9, i / 8)).p); ink.poly(tube(pts, MINW * 0.6), 'w'); }
}
