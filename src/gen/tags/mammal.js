// Small mammals: a species library of real forms and poses.
//
// Shape vocabulary registered here (all prefixed `mammal`):
//   chassis  mammalWalk (side-view quadruped / bipedal hopper), mammalUp (sitting on
//            haunches or standing sentinel), mammalBall (curled asleep / rolled up), mammalBat (flight,
//            seen flat with head up), mammalGlide (top-view glider), mammalClimb (clinging to a stalk
//            or branch), mammalFloat (otter on its back), mammalHill (mole surfacing from a molehill)
//   heads    mammalHead (skull + muzzle with cheeks, nose button, proboscis, star, carried item)
//   crowns   mammalEar (round, long, point, tuft)
//   tips     mammalBrush (bushy plume tails), mammalFlag (jerboa tuft), mammalPaddle (beaver)
//   dorsals  mammalQuills (hedgehog / porcupine / pangolin scales), mammalShell (armadillo),
//            mammalBabies (opossum young riding on the back)
//   feet     mammalSpade (mole hand)
//
// The mammal chassis draw their own legs (haunches, long hind feet, posed arms) when the limbs gene
// is still the species' own (`mOwn`), and expose ordinary limb sockets when another tag lends limbs.
import { add, lerp, dist, angOf, polar, angDiff, clamp, mix, MINW, frame, spline, polyline, profile, pathAt, tube, leaf } from '../core.js';
import { chassis, heads, feet, tips, crowns, dorsals } from '../parts.js';

const PI = Math.PI;
const none = () => ({ type: 'none' });
const isOwn = g => !!(g.own && g.own.chassis === g && g.own.limbs && g.own.limbs.mOwn);

function strip(path, rad, t0, t1, n, sideSign, k = 0.85) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = mix(t0, t1, i / (n - 1)), { p, ang } = pathAt(path, t), na = ang + sideSign * PI / 2;
    out.push({ p: polar(p, na, rad(t) * k), dir: na, t });
  }
  return out;
}
const samp = (st, u) => {
  const x = clamp(u, 0, 1) * (st.length - 1), i = Math.min(Math.floor(x), st.length - 2), f = x - i;
  return { p: lerp(st[i].p, st[i + 1].p, f), dir: st[i].dir + angDiff(st[i + 1].dir, st[i].dir) * f };
};
// interior points of a quadratic Bezier a-c-b
const bez = (a, c, b, n = 5) => { const o = []; for (let i = 1; i < n; i++) { const t = i / n; o.push([(1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]]); } return o; };
const taper = (C, pts, w0, w1, per = 6) => C.ink.poly(tube(spline(pts, per), profile([[0, Math.max(w0, MINW / 2)], [1, Math.max(w1, MINW / 2)]])));
// flat foot lying on the ground from heel toward dir (+1 fwd, -1 back)
const flatFoot = (C, heel, len, fh, dir = 1) => C.ink.poly(tube(polyline([[heel[0] - dir * fh * 0.4, -fh], [heel[0] + dir * len, -fh * 0.85]], 3), profile([[0, fh], [0.7, fh * 0.9], [1, fh * 0.75]])));

// things held in the paws or carried in the mouth
function item(C, p, kind, s, ang = 0) {
  const { ink } = C;
  switch (kind) {
    case 'acorn': ink.oval(polar(p, ang + PI / 2, s * 0.15), s * 0.42, s * 0.5, ang); ink.oval(polar(p, ang - PI / 2, s * 0.22), s * 0.52, s * 0.3, ang); ink.line([polar(p, ang - PI / 2, s * 0.4), polar(p, ang - PI / 2 + 0.3, s * 0.85)], MINW * 1.2); break;
    case 'nut': ink.dot(p, s * 0.5); break;
    case 'berry': ink.dot(p, s * 0.42); ink.line([p, polar(p, ang - PI / 2 - 0.3, s * 0.95)], MINW * 1.1); break;
    case 'seed': ink.poly(leaf(polar(p, ang + PI, s * 0.5), ang - 0.4, s * 1.2, s * 0.7, 0, 0.5)); break;
    case 'stick': ink.poly(tube(polyline([polar(p, ang - 0.5 + PI, s * 1.5), polar(p, ang - 0.5, s * 1.5)], 3), s * 0.17)); ink.line([polar(p, ang - 0.5, s * 0.7), polar(polar(p, ang - 0.5, s * 0.7), ang - 1.4, s * 0.7)], MINW * 1.3); break;
    case 'sprig': {
      const e = polar(p, ang - 0.25, s * 1.5);
      ink.line([p, polar(p, ang - 0.1, s * 0.8), e], MINW * 1.3);
      for (const da of [-0.9, 0, 0.9]) ink.poly(leaf(e, ang - 0.25 + da, s * 0.75, s * 0.5, 0, 0.6));
      ink.poly(leaf(polar(p, ang - 0.1, s * 0.7), ang + 0.9, s * 0.7, s * 0.4, 0, 0.5));
      break;
    }
    case 'shell': ink.oval(p, s * 0.6, s * 0.36, ang); break;
    default: break;
  }
}

// =====================================================================
// FEET (lendable): mole spade hand
// =====================================================================
feet.mammalSpade = (C, p, ang, s, g, k = 1) => {
  const q = s * k * (g.spadeS ?? 1), c = polar(p, ang, q * 0.3);
  C.ink.oval(c, q * 0.46, q * 0.36, ang);
  for (let i = 0; i < 4; i++) { const a = ang + (i / 3 - 0.5) * 1.5; C.ink.poly(leaf(polar(c, a, q * 0.2), a, q * 0.62, q * 0.3, 0, 0.3)); }
};

// =====================================================================
// CHASSIS
// =====================================================================
const GAIT = {
  stand: { f: [0.05, -0.32], h: [-0.15, 0.3] },
  walk: { f: [0.6, -0.3], h: [-0.55, 0.3] },
  trot: { f: [0.75, -0.55], h: [0.45, -0.6] },
  run: { f: [1.15, 0.75], h: [-1.25, -0.85] },
  creep: { f: [0.45, 0.1], h: [0.25, 0.6] },
  leap: { f: [0, 0], h: [-0.75, -0.4] },
  stretch: { f: [1.5, 1.2], h: [-0.2, 0.2] },
  biped: { f: [0, 0], h: [0, 0.3] },
};

// Side-view body on four legs; also bipedal hoppers (gait 'biped').
chassis.mammalWalk = (C, g) => {
  const { ink, rng } = C, own = isOwn(g), r = g.r * C.plump, L = g.len;
  const lift = own ? g.clr * r : clamp(C.lift, 0.2, 1.1) * r;
  const hip = [-L / 2, -(lift + r * 0.95)], sh = [L / 2, hip[1] - L * Math.tan(g.pitch ?? 0)];
  const mid = add(lerp(hip, sh, 0.5), [0, -(g.arch ?? 0.4) * r]);
  const neckA = -(g.neckAng ?? 0.3), neckEnd = polar(sh, neckA, ((g.neckLen ?? 0.1) + 0.55) * r);
  const path = spline([hip, mid, sh, neckEnd], 8);
  const ch = g.chest ?? 0.9, nk = g.neckW ?? 0.8;
  const rad = profile([[0, r * (g.rump ?? 0.85)], [0.3, r * (g.belly ?? 1)], [0.62, r * ch], [0.8, r * mix(ch, nk, 0.6)], [1, r * nk]]);
  ink.poly(tube(path, rad));
  const limbs = [];
  if (own) {
    const gait = GAIT[g.gait] ? g.gait : 'walk', G = GAIT[gait];
    const lw = (g.legW ?? 0.3) * r, fh = Math.max(lw * 0.5, 0.9), hr = (g.haunch ?? 0.9) * r, fl = (g.footL ?? 0.7) * r;
    const j = () => rng.range(-0.1, 0.1) * r;
    // hind legs (far first)
    [1, 0].forEach(i => {
      const k = i ? 0.9 : 1, hp = add(hip, [r * 0.12 + (i ? r * 0.2 : 0), r * 0.15]);
      if (gait === 'biped') {
        const c = lift + r * 0.5, sw = i ? rng.range(0.25, 0.6) : rng.range(-0.15, 0.1);
        const knee = add(hp, [c * (0.55 + sw * 0.3), c * 0.38]), ank = [hp[0] - c * 0.22 + sw * c * 0.6, -(c * 0.3 + fh)];
        const toe = [ank[0] + fl * 1.25 * k, -fh * 0.8];
        if (!i) ink.oval(add(hp, [r * 0.12, -r * 0.08]), hr * 0.85, hr * 0.72, 0.5);
        taper(C, [hp, knee], lw * 1.25 * k, lw * 0.6 * k, 4);
        taper(C, [knee, lerp(knee, ank, 0.5), ank], lw * 0.6 * k, lw * 0.4 * k, 4);
        ink.poly(tube(polyline([ank, toe], 3), profile([[0, lw * 0.4 * k], [1, fh * 0.75]])));
        return;
      }
      const off = G.h[i] * r * (g.stride ?? 1) + j(), back = off < -0.7 * r;
      const heel = [hp[0] + off, -fh];
      const d = dist(hp, heel), knee = add(lerp(hp, heel, 0.5), [d * (back ? 0.05 : 0.3), 0]);
      if (!i) ink.oval(add(hp, [r * 0.1 + off * 0.2, -r * 0.1]), hr * 0.72, hr * 0.92, 0.25);
      taper(C, [hp, knee, [heel[0], -fh * 1.3]], lw * 1.15 * k, lw * 0.55 * k);
      flatFoot(C, heel, fl * k * (back ? 0.55 : 1), fh * k, back ? -1 : 1);
    });
    // fore legs (far first)
    [1, 0].forEach(i => {
      const k = i ? 0.9 : 1, sp = add(sh, [r * (i ? 0.25 : -0.05), r * ch * 0.35]);
      if (gait === 'biped' || gait === 'leap') {
        const a = (gait === 'leap' ? 0.25 : 0.75) + (i ? -0.3 : 0) + rng.range(-0.15, 0.15), al = r * (gait === 'leap' ? 1.05 : 0.7) * (g.armS ?? 1);
        const el = polar(sp, a + 0.5, al * 0.55), pw = polar(el, a - 0.55, al * 0.5);
        taper(C, [sp, el, pw], lw * 0.6 * k, lw * 0.38 * k);
        ink.dot(pw, Math.max(lw * 0.42 * k, 0.8));
        return;
      }
      const off = G.f[i] * r * (g.stride ?? 1) + j(), ps = (g.pawS ?? 1) * k;
      const paw = [sp[0] + off, -fh];
      const d = dist(sp, paw), el = add(lerp(sp, paw, 0.5), [-d * 0.1, 0]);
      taper(C, [sp, el, [paw[0], -fh * 1.2]], lw * 0.85 * k, lw * 0.5 * k);
      if (g.fore === 'spade') feet.mammalSpade(C, [paw[0], -r * 0.34 * ps], 0.15, r * 0.95, {}, ps);
      else ink.oval([paw[0] + fh * 0.7 * ps, -fh * k], Math.max(fh * 1.45 * ps, 1.2), fh * k, 0);
    });
  } else {
    const mk = (base, dx, role, far) => limbs.push({ p: add(base, [dx * r, r * 0.3]), dir: PI / 2, s: r, role, far, ground: 0, fwd: 0, side: 1 });
    mk(sh, 0.25, 'fore', true); mk(hip, -0.2, 'hind', true); mk(sh, -0.25, 'fore', false); mk(hip, 0.3, 'hind', false);
  }
  return {
    view: 'side', r, path, rad,
    head: { p: neckEnd, dir: neckA, face: g.face ?? neckA * 0.35, s: r * g.headS, sym: false },
    tail: { p: polar(hip, PI + 0.5, r * (g.rump ?? 0.85) * 0.55), dir: g.tailA ?? PI + rng.range(0.1, 0.6), s: r * 0.6 },
    limbs, back: [strip(path, rad, g.b0 ?? 0.04, g.b1 ?? 0.8, 14, -1)],
  };
};

// Sitting on the haunches or standing upright. `lean` is the torso angle forward from vertical.
chassis.mammalUp = (C, g) => {
  const { ink, rng } = C, own = isOwn(g), r = g.r * C.plump;
  const lift = own ? 0 : clamp(C.lift, 0, 1.1) * r * 0.7;
  const hr = r * (g.haunch ?? 1), Hc = [0, -(hr * 0.94 + lift)], lean = g.lean, h = g.h;
  const S = [Hc[0] + h * Math.sin(lean), Hc[1] - h * Math.cos(lean)];
  const hu = (g.hunch ?? 0.12) * h;
  const midp = add(lerp(Hc, S, 0.5), [-hu * Math.cos(lean), -hu * Math.sin(lean)]);
  const sw = g.shoulder ?? 0.72, nk = g.neckW ?? 0.6;
  const neckA = g.neckA ?? (-PI / 2 + lean * 0.75 + 0.25), neckEnd = polar(S, neckA, ((g.neckLen ?? 0.1) + 0.5) * r * sw);
  const path = spline([Hc, midp, S, neckEnd], 8);
  const rad = profile([[0, hr], [0.3, r * (g.belly ?? 1)], [0.66, r * sw], [1, r * nk]]);
  ink.poly(tube(path, rad));
  const face = g.face ?? 0.05, hs = r * g.headS;
  const ax = pathAt(path, 0.6), A = polar(ax.p, ax.ang + PI / 2, rad(0.6) * 0.45);
  const limbs = [];
  if (own) {
    const lw = (g.legW ?? 0.3) * r, fh = Math.max(lw * 0.5, 0.9), fl = (g.footL ?? 0.9) * r;
    flatFoot(C, [Hc[0] + hr * 0.45, 0], fl * 0.9, fh * 0.9);
    ink.oval(add(Hc, [hr * 0.3, hr * 0.12]), hr * (g.thigh ?? 0.85), hr * 0.8, -0.3);
    flatFoot(C, [Hc[0] + hr * 0.15, 0], fl, fh);
    const arms = g.arms ?? 'hang';
    [1, 0].forEach(i => {
      const k = i ? 0.9 : 1, a0 = add(A, i ? [r * 0.12, -r * 0.12] : [0, 0]);
      if (arms === 'tuck') return;
      if (arms === 'down') {
        const paw = [a0[0] + r * (0.25 + (i ? 0.3 : 0)) + (g.armX ?? 0) * r, -fh];
        taper(C, [a0, add(lerp(a0, paw, 0.5), [-r * 0.06, 0]), [paw[0], -fh * 1.2]], lw * 0.9 * k, lw * 0.5 * k);
        ink.oval([paw[0] + fh * 0.7, -fh], Math.max(fh * 1.4, 1.2), fh, 0);
        return;
      }
      let T;
      if (arms === 'hold') T = polar(neckEnd, face + 0.95, hs * 1.3);
      else if (arms === 'groom') T = polar(neckEnd, face + 0.4 - (i ? 0.5 : 0), hs * 1.25);
      else T = add(a0, [r * 0.62, r * 0.42]);
      const d = dist(a0, T), el = add(lerp(a0, T, 0.5), arms === 'hang' ? [d * 0.25, -d * 0.2] : [d * 0.05, d * 0.3]);
      taper(C, [a0, el, T], lw * 0.75 * k, lw * 0.45 * k);
      ink.dot(T, Math.max(lw * 0.45, 0.85));
      if (!i && arms === 'hold' && g.item) item(C, polar(T, face - 0.3, hs * 0.3), g.item, hs * 0.72, face);
    });
  } else {
    limbs.push({ p: add(Hc, [-hr * 0.3, hr * 0.4]), dir: PI / 2, s: r * 0.9, role: 'hind', far: true, ground: 0, fwd: 0, side: 1 });
    limbs.push({ p: add(Hc, [hr * 0.4, hr * 0.4]), dir: PI / 2, s: r * 0.9, role: 'hind', far: false, ground: 0, fwd: 0, side: 1 });
    limbs.push({ p: A, dir: rng.range(0.3, 1.0), s: r * 0.8, role: 'arm', fwd: PI / 2, side: 1 });
    limbs.push({ p: add(A, [-rad(0.6) * 0.5, 0]), dir: PI - rng.range(0.6, 1.2), s: r * 0.8, role: 'arm', fwd: PI / 2, side: -1 });
  }
  return {
    view: 'side', r, path, rad,
    head: { p: neckEnd, dir: neckA, face, s: hs, sym: false },
    tail: { p: add(Hc, [-hr * 0.72, hr * 0.38]), dir: g.tailA ?? PI + rng.range(0, 0.35), s: r * 0.6 },
    limbs, back: [strip(path, rad, 0.06, 0.85, 12, -1)],
  };
};

// Curled asleep / rolled into a ball.
chassis.mammalBall = (C, g) => {
  const { ink, rng } = C, own = isOwn(g), r = g.r * C.plump, rx = r * (g.wide ?? 1.12), ry = r;
  const lift = own ? 0 : clamp(C.lift, 0, 1) * r * 0.6, c = [0, -(ry * 0.97 + lift)];
  const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * 2 * PI; pts.push([c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a) * (Math.sin(a) > 0 ? 0.94 : 1)]); }
  ink.poly(pts);
  const path = spline([[-rx * 0.55, c[1]], c, [rx * 0.55, c[1]]], 8), rad = () => ry * 0.85;
  const limbs = [];
  if (own) {
    const fh = Math.max(r * 0.09, 0.9);
    if (g.paws !== false) { ink.oval([rx * 0.2, -fh], fh * 2.6, fh, 0); ink.oval([rx * 0.72, -fh], fh * 1.9, fh, 0); }
  } else {
    for (const [dx, role, far] of [[0.45, 'fore', true], [-0.5, 'hind', true], [0.2, 'fore', false], [-0.25, 'hind', false]]) limbs.push({ p: [dx * rx, c[1] + ry * 0.6], dir: PI / 2, s: r * 0.8, role, far, ground: 0, fwd: 0, side: 1 });
  }
  const back = [];
  for (let i = 0; i < 16; i++) { const a = mix(PI - (g.b0 ?? 0.45), 2 * PI - (g.b1 ?? 0.05), i / 15); back.push({ p: [c[0] + rx * 0.86 * Math.cos(a), c[1] + ry * 0.86 * Math.sin(a)], dir: Math.atan2(Math.sin(a) * rx, Math.cos(a) * ry), t: i / 15 }); }
  return {
    view: 'side', r, path, rad,
    head: { p: add(c, [rx * (g.headX ?? 0.58), ry * (g.headY ?? 0.42)]), dir: g.headDir ?? 0.35, face: g.face ?? rng.range(0.15, 0.4), s: r * g.headS, sym: false },
    tail: { p: add(c, [-rx * 0.8, ry * 0.42]), dir: g.tailA ?? PI + 0.9, s: r * 0.6 },
    limbs, back: [back], wrap: { c, rx, ry },
  };
};

// Bat in flight, seen flat-on with the head up and wings spread.
chassis.mammalBat = (C, g) => {
  const { ink } = C, own = isOwn(g), r = g.r * C.plump, bw = r * 0.62, bh = r;
  const F = frame([0, 0], g.bank ?? 0, 1, 1), FP = p => F(p[0], p[1]);
  const body = []; for (let i = 0; i < 22; i++) { const a = i / 22 * 2 * PI; body.push(F(bw * Math.cos(a) * (1 - 0.15 * Math.sin(a)), bh * Math.sin(a))); }
  ink.poly(body);
  const ua = r * g.arm, fa = r * g.arm * 1.2, fl = r * g.finger, back = [];
  // one outline per wing: arm leading edge to the wrist, then finger tips joined by deep scallops
  for (const sd of [-1, 1]) {
    const el = g.elev + sd * (g.skew ?? 0);
    const shp = [sd * bw * 0.5, -bh * 0.45];
    const E = add(shp, [sd * ua * Math.cos(el + 0.45), -ua * Math.sin(el + 0.45)]);
    const W = add(E, [sd * fa * Math.cos(el - 0.2), -fa * Math.sin(el - 0.2)]);
    const nf = g.nf ?? 4, tipsP = [];
    const d0 = g.droop - el * 0.45;
    for (let i = 0; i < nf; i++) { const a = d0 + i * g.fan / (nf - 1), len = fl * (1 - 0.1 * i); tipsP.push(add(W, [sd * Math.cos(a) * len, Math.sin(a) * len])); }
    const ank = [sd * bw * 0.45, bh * 0.92];
    const sc = g.scallop ?? 0.45;
    const mem = [shp, lerp(shp, E, 0.5), E, W, ...bez(W, add(lerp(W, tipsP[0], 0.5), [0, -r * 0.08]), tipsP[0], 3), tipsP[0]];
    for (let i = 0; i < nf - 1; i++) mem.push(...bez(tipsP[i], lerp(lerp(tipsP[i], tipsP[i + 1], 0.5), W, sc), tipsP[i + 1]), tipsP[i + 1]);
    mem.push(...bez(tipsP[nf - 1], lerp(lerp(tipsP[nf - 1], ank, 0.5), [sd * bw * 0.3, -bh * 0.1], sc * 0.9), ank), ank, [0, bh * 0.4]);
    ink.poly(mem.map(FP));
    ink.poly(tube(spline([shp, E, W].map(FP), 4), profile([[0, r * 0.2], [1, r * 0.12]])));
    ink.poly(leaf(FP(W), (g.bank ?? 0) - PI / 2 - sd * 0.35, r * 0.38, r * 0.2, 0, 0.3)); // thumb claw
    const st = []; for (let i = 0; i < 8; i++) { const u = i / 7, p = u < 0.5 ? lerp(shp, E, u * 2) : lerp(E, W, u * 2 - 1); st.push({ p: FP(p), dir: (g.bank ?? 0) - PI / 2, t: u }); }
    back.push(st);
    if (own) { const a = FP(ank); taper(C, [a, F(ank[0] + sd * r * 0.08, ank[1] + r * 0.32)], r * 0.12, r * 0.09, 2); ink.dot(F(ank[0] + sd * r * 0.1, ank[1] + r * 0.36), r * 0.1); }
  }
  // tail membrane between the ankles
  if (g.uro !== false) {
    const tm = bh * (1.4 + (g.tailM ?? 0)), L0 = [-bw * 0.45, bh * 0.92], R0 = [bw * 0.45, bh * 0.92], T = [0, tm];
    ink.poly([L0, ...bez(L0, [-bw * 0.15, tm * 0.97], T, 4), T, ...bez(T, [bw * 0.15, tm * 0.97], R0, 4), R0, [0, bh * 0.3]].map(FP));
  }
  const up = (g.bank ?? 0) - PI / 2, path = [F(0, bh * 0.8), F(0, 0), F(0, -bh * 0.8)];
  const limbs = own ? [] : [-1, 1].map(sd => ({ p: F(sd * bw * 0.4, bh * 0.8), dir: up + PI - sd * 0.5, s: r * 0.6, role: 'hind', fwd: up, side: sd }));
  return {
    view: 'top', mBat: true, r, path, rad: () => bw * 0.8,
    head: { p: F(0, -bh * 0.8), dir: up, face: up, s: r * g.headS, sym: true },
    tail: { p: F(0, bh * 0.9), dir: up + PI, s: r * 0.3 },
    limbs, back,
  };
};

// Gliding membrane-spreader seen from above (flying squirrel, sugar glider).
chassis.mammalGlide = (C, g) => {
  const { ink } = C, own = isOwn(g), r = g.r * C.plump, L = g.len, tilt = g.tilt ?? 0;
  const F = frame([0, 0], tilt, 1, 1), sp = r * g.span;
  const path = spline([F(-L / 2, 0), F(0, 0), F(L / 2, 0)], 8), rad = profile([[0, r * 0.72], [0.45, r], [0.85, r * 0.8], [1, r * 0.7]]);
  ink.poly(tube(path, rad));
  const back = [], limbs = [];
  for (const sd of [-1, 1]) {
    const k = 1 + sd * (g.skew ?? 0);
    const wr = [L * 0.36 + r * g.reach * k, sd * sp * k], an = [-L * 0.4 - r * g.reach * 0.75, sd * sp * 0.9 / k];
    const s0 = [L * 0.3, sd * r * 0.4], h0 = [-L * 0.32, sd * r * 0.4];
    const sag = lerp(lerp(wr, an, 0.5), [0, 0], g.sag ?? 0.16);
    const edge = spline([wr, sag, an], 6);
    ink.poly([s0, ...edge, h0].map(p => F(p[0], p[1])));
    taper(C, [F(s0[0], s0[1]), F(wr[0], wr[1])], r * 0.3, r * 0.17, 3);
    taper(C, [F(h0[0], h0[1]), F(an[0], an[1])], r * 0.34, r * 0.18, 3);
    if (own) for (const [q, a] of [[wr, sd * 0.9], [an, sd * 2.0]]) { ink.dot(F(q[0], q[1]), r * 0.2); for (const da of [-0.5, 0, 0.5]) ink.poly(leaf(F(q[0], q[1]), tilt + a + da, r * 0.42, r * 0.17, 0, 0.3)); }
    else {
      limbs.push({ p: F(wr[0], wr[1]), dir: tilt + sd * 1.0, s: r * 0.6, role: 'fore', fwd: tilt, side: sd });
      limbs.push({ p: F(an[0], an[1]), dir: tilt + sd * 2.1, s: r * 0.6, role: 'hind', fwd: tilt, side: sd });
    }
    back.push(edge.filter((_, i) => i % 2 === 0).map((p, i, arr) => ({ p: lerp(F(p[0], p[1]), F(0, 0), 0.12), dir: tilt + sd * PI / 2, t: 1 - i / (arr.length - 1) })).reverse());
  }
  return {
    view: 'top', r, path, rad,
    head: { p: F(L / 2 + r * 0.15, 0), dir: tilt, face: tilt, s: r * g.headS, sym: true },
    tail: { p: F(-L / 2, 0), dir: tilt + PI, s: r * 0.6 },
    limbs, back,
  };
};

// Clinging to an upright stalk or branch (harvest mouse on an ear of grass, tarsier on a sapling).
chassis.mammalClimb = (C, g) => {
  const { ink, rng } = C, own = isOwn(g), r = g.r * C.plump, Ht = g.stalkH, sr = Math.max(g.stalkR, 0.7);
  const bx = g.bendX * Ht;
  const sPath = spline([[0, 0], [-bx * 0.15, -Ht * 0.4], [bx * 0.25, -Ht * 0.75], [bx, -Ht]], 8);
  ink.poly(tube(sPath, profile([[0, sr * 1.25], [0.6, sr], [1, sr * (g.top === 'branch' ? 0.85 : 0.6)]])));
  const topE = pathAt(sPath, 1);
  if (g.top === 'ear') { // ear of grain: fat spindle with kernel bumps and a few awns
    const eL = Ht * 0.3, ea = topE.ang + (g.nod ?? 0.5), ePath = spline([topE.p, polar(topE.p, mix(topE.ang, ea, 0.5), eL * 0.5), polar(polar(topE.p, mix(topE.ang, ea, 0.5), eL * 0.5), ea, eL * 0.5)], 6);
    ink.poly(tube(ePath, profile([[0, sr], [0.25, sr * 2.6], [0.7, sr * 2.3], [1, sr * 0.8]])));
    for (let i = 1; i < 6; i++) { const q = pathAt(ePath, i / 6.5); for (const sd of [-1, 1]) ink.poly(leaf(polar(q.p, q.ang + sd * PI / 2, sr * 1.2), q.ang + sd * 0.55, sr * 4.2, sr * 1.9, 0, 0.45)); }
    const q = pathAt(ePath, 1); for (const da of [-0.3, 0.05, 0.4]) ink.line([q.p, polar(q.p, q.ang + da, sr * 6)], MINW);
  } else if (g.top === 'reed') {
    const q0 = pathAt(sPath, 0.72), q1 = pathAt(sPath, 0.95);
    ink.poly(tube(spline([q0.p, lerp(q0.p, q1.p, 0.5), q1.p], 5), sr * 2.4));
  } else if (g.top === 'leaf') {
    for (const [t, sd] of [[1, 1], [0.88, -1], [0.34, -1]]) { const q = pathAt(sPath, t); ink.poly(leaf(q.p, q.ang + sd * rng.range(0.6, 1), r * rng.range(1.3, 1.9), r * 0.8, sd * 0.1, 0.45)); }
  } else if (g.top === 'branch') {
    const q = pathAt(sPath, 0.3); taper(C, [q.p, polar(q.p, q.ang - 0.9, r * 1.6)], sr * 0.6, sr * 0.35, 3);
    ink.poly(leaf(polar(q.p, q.ang - 0.9, r * 1.5), q.ang - 1.1, r * 1.2, r * 0.6, 0, 0.45));
    ink.poly(leaf(topE.p, topE.ang + 0.5, r * 1.3, r * 0.65, 0, 0.45));
  }
  const Q = pathAt(sPath, g.at), ta = Q.ang, ra = ta + PI / 2; // ra: toward +x side of the stalk
  const len = g.len, off = sr + r * (g.hug ?? 0.78);
  const mk = (along, out) => polar(polar(Q.p, ta, along), ra, out);
  const rump = mk(-len / 2, off), shd = mk(len / 2, off * (g.shOff ?? 0.9));
  const neckA = ta + (g.turn ?? 0.5), neckEnd = polar(shd, neckA, r * 0.55);
  const path = spline([rump, mk(0, off + r * (g.hunch ?? 0.12)), shd, neckEnd], 8);
  const rad = profile([[0, r * 0.95], [0.3, r], [0.66, r * (g.shoulder ?? 0.78)], [1, r * (g.neckW ?? 0.65)]]);
  ink.poly(tube(path, rad));
  const limbs = [], lw = (g.legW ?? 0.3) * r;
  const grips = [[-len * 0.5 - r * 0.15, rump, 'hind'], [len * 0.5 + r * 0.25, shd, 'fore']];
  for (const [along, from, role] of grips) {
    const gp = mk(along, -sr * 0.2);
    if (!own) { limbs.push({ p: from, dir: angOf(from, gp), s: r * 0.7, role: 'arm', fwd: ta, side: 1 }); continue; }
    if (role === 'hind' && g.fold) { // long folded hind leg: knee out, foot back on the stalk
      const knee = polar(from, ra - 0.9, r * g.fold);
      taper(C, [from, knee], lw * 1.2, lw * 0.7, 3); taper(C, [knee, gp], lw * 0.7, lw * 0.5, 3);
    } else taper(C, [from, lerp(from, gp, 0.5), gp], lw, lw * 0.6, 3);
    ink.oval(polar(gp, ra, -sr * 0.6), Math.max(lw * 0.75, 1), Math.max(lw * 0.55, 0.85), ta);
  }
  return {
    view: 'side', r, path, rad,
    head: { p: neckEnd, dir: neckA, face: g.face ?? -0.35, s: r * g.headS, sym: false },
    tail: { p: polar(rump, ta + PI, r * 0.5), dir: g.tailA ?? ta + PI + 0.25, s: r * 0.6 },
    limbs, back: [strip(path, rad, 0.05, 0.8, 10, 1)],
  };
};

// Otter floating on its back, paws on its chest.
chassis.mammalFloat = (C, g) => {
  const { ink, rng } = C, own = isOwn(g), r = g.r * C.plump, L = g.len;
  const lift = own ? 0 : clamp(C.lift, 0, 1) * r * 0.6, y = -(r * 0.98 + lift);
  const tb = [-L / 2, y + r * 0.22], shd = [L / 2, y - r * 0.12], neckEnd = add(shd, [r * 0.85, -r * (g.raise ?? 0.75)]);
  const path = spline([tb, [0, y], shd, neckEnd], 8);
  const rad = profile([[0, r * 0.68], [0.35, r], [0.66, r * 0.86], [1, r * 0.62]]);
  ink.poly(tube(path, rad));
  const limbs = [];
  if (own) {
    const top = pathAt(path, 0.52), chest = add(top.p, [0, -rad(0.52) * 0.95]);
    for (const dx of [-0.25, 0.55]) taper(C, [add(pathAt(path, 0.62).p, [dx * r * 0.2, -r * 0.5]), add(chest, [dx * r, -r * 0.35]), add(chest, [r * 0.12, -r * 0.42])], r * 0.2, r * 0.15, 4);
    if (g.item) item(C, add(chest, [r * 0.1, -r * 0.6]), g.item, r * 0.75, 0);
    for (const [dx, a] of [[0.25, -1.9], [0.75, -1.35]]) { const b = add(tb, [dx * r, -r * 0.5]); ink.poly(leaf(b, a + rng.range(-0.15, 0.15), r * 1.25, r * 0.62, 0, 0.6)); }
  } else {
    for (const [t, role, far] of [[0.62, 'fore', false], [0.1, 'hind', false]]) limbs.push({ p: add(pathAt(path, t).p, [0, -r * 0.6]), dir: -PI / 2 + 0.3, s: r * 0.7, role: 'arm', fwd: 0, side: 1 });
  }
  return {
    view: 'side', r, path, rad,
    head: { p: neckEnd, dir: -0.7, face: g.face ?? -0.45, s: r * g.headS, sym: false },
    tail: { p: add(tb, [-r * 0.3, r * 0.05]), dir: PI + 0.05, s: r * 0.6 },
    limbs, back: [strip(path, rad, 0.08, 0.6, 10, -1)],
  };
};

// Mole surfacing from a molehill.
chassis.mammalHill = (C, g) => {
  const { ink, rng } = C, own = isOwn(g), r = g.r * C.plump, W = g.w, Hm = g.hm;
  const ph = rng.range(0, 6), mound = [];
  for (let i = 0; i <= 30; i++) { const a = PI + i / 30 * PI; mound.push([Math.cos(a) * W / 2, Math.sin(a) * Hm * (1 + 0.07 * Math.sin(a * 7 + ph)) * Math.pow(Math.abs(Math.sin(a)), -0.25 + 0.25)]); }
  ink.poly(mound);
  for (let i = 0; i < 3; i++) ink.dot([rng.range(-0.62, 0.62) * W * 0.5 * (i ? 1 : -1.25), -1.2], rng.range(1.1, 1.9)); // crumbs of soil
  const base = [g.x0 ?? 0, -Hm * 0.5], top = [base[0] + g.lean * g.h, -Hm - g.h];
  const path = spline([base, lerp(base, top, 0.5), top], 8), rad = profile([[0, r], [0.6, r * 0.95], [1, r * 0.8]]);
  ink.poly(tube(path, rad));
  const limbs = [];
  for (const sd of [-1, 1]) {
    const sp = add(lerp(base, top, 0.62), [sd * r * 0.7, 0]), hx = base[0] + sd * (r * 1.55 + rng.range(0, 0.3) * r);
    const hy = -Hm * Math.sqrt(Math.max(1 - (2 * hx / W) ** 2, 0)) - r * 0.1;
    if (own) { taper(C, [sp, [hx, hy]], r * 0.34, r * 0.3, 3); feet.mammalSpade(C, [hx, hy], sd > 0 ? 0.45 : PI - 0.45, r * 1.15, {}, 1); }
    else limbs.push({ p: sp, dir: sd > 0 ? 0.5 : PI - 0.5, s: r * 0.8, role: 'arm', fwd: PI / 2, side: sd });
  }
  const back = []; for (let i = 0; i < 8; i++) { const a = PI + 0.25 + i / 7 * 0.75, p = [Math.cos(a) * W / 2 * 0.9, Math.sin(a) * Hm * 0.9]; back.push({ p, dir: a, t: i / 7 }); }
  return {
    view: 'side', r, path, rad,
    head: { p: top, dir: -PI / 2 + g.lean * 0.6 + 0.15, face: g.face ?? -0.55, s: r * g.headS, sym: false },
    tail: { p: [-W * 0.3, -Hm * 0.35], dir: PI + 0.3, s: r * 0.35 },
    limbs, back: [back],
  };
};

// =====================================================================
// HEAD
// =====================================================================
heads.mammalHead = (C, sock, g) => {
  C.mHead = true;
  const { ink, rng } = C, s = sock.s, sym = sock.sym, sk = g.skull ?? 1;
  const c = polar(sock.p, sock.dir, s * sk * 0.45), F = frame(c, sock.face, s, 1);
  const dr = sym ? 0 : (g.droop ?? 0.1), L = g.snoutLen, tr = g.tipR;
  ink.oval(c, sk * s * (g.skullL ?? 1), sk * s * (g.skullH ?? 1), sock.face);
  ink.poly(tube(polyline([sock.p, c], 2), sk * s * 0.8));
  const tipP = F(L, dr * L);
  const mPath = spline([F(-sk * 0.2, 0), F(L * 0.5, dr * L * 0.25 + (sym ? 0 : (g.bridge ?? 0))), tipP], 7);
  ink.poly(tube(mPath, profile([[0, sk * s * 0.94], [0.45, mix(sk, tr, g.mid ?? 0.55) * s], [1, tr * s]])));
  const sides = sym ? [-1, 1] : [-1];
  if (g.nose) ink.dot(F(L + tr * 0.55, dr * L - (sym ? 0 : tr * 0.35)), g.nose * s);
  if (g.cheek) for (const sd of (sym ? [-1, 1] : [1])) ink.oval(F(sk * 0.18, sd * sk * (sym ? 0.78 : 0.5)), sk * 0.62 * g.cheek * s, sk * 0.5 * g.cheek * s, sock.face);
  let endP = tipP;
  if (g.trunk) { // mobile proboscis
    const a0 = sock.face + Math.atan(dr), cu = sym ? 0 : (g.trunkCurl ?? 0.5), tl = g.trunk * s;
    endP = polar(polar(tipP, a0 + cu * 0.4, tl * 0.55), a0 + cu, tl * 0.5);
    ink.poly(tube(spline([F(L * 0.7, dr * L * 0.6), tipP, polar(tipP, a0 + cu * 0.4, tl * 0.55), endP], 5), profile([[0, tr * s], [0.4, Math.max(tr * 0.75 * s, MINW * 0.7)], [1, Math.max(tr * 0.55 * s, MINW * 0.6)]])));
  }
  if (g.star) for (let i = 0; i < 7; i++) { const a = sock.face + (i / 6 - 0.5) * 3.4; ink.poly(leaf(endP, a, s * g.star, s * g.star * 0.42, 0, 0.5)); }
  if (g.whiskers) for (const sd of sides) for (let i = 0; i < g.whiskers; i++) {
    const b = F(L * 0.72, (sym ? sd : 1) * tr * 0.3), a = sym ? sock.face + sd * (0.75 + i * 0.4) : sock.face + 0.35 + i * 0.55;
    ink.line([b, polar(b, a + rng.range(-0.1, 0.1), s * (g.whiskerL ?? 0.95))], MINW);
  }
  if (g.carry) item(C, sym ? polar(endP, sock.face, tr * s) : F(L + tr * 0.6, dr * L + tr * 0.5), g.carry, s * 0.8, sock.face);
  const eyes = [], mounts = [];
  for (const sd of sides) {
    eyes.push({ p: F(g.eyeX ?? 0.4, sd * sk * (g.eyeY ?? 0.35) * (sym ? 1.5 : 1)), r: s * (g.eyeR ?? 0.15) });
    mounts.push({ p: F(g.earX ?? -0.3, sd * sk * (g.earY ?? 0.75)), dir: sock.face + sd * (sym ? 1.25 : PI / 2 + (g.earBack ?? 0.25)), flip: sd, s });
  }
  return { eyes, mounts, spots: [], tip: endP };
};

// =====================================================================
// EARS
// =====================================================================
crowns.mammalEar = (C, m, F0, s, g) => {
  // a cap or other single top mount gets no paired copy: splay a pair of ears from it
  if (!C.mHead && C.plan.rooted && !m.far && !m.split) {
    for (const sd of [-1, 1]) crowns.mammalEar(C, { ...m, split: true, p: polar(m.p, m.dir + PI / 2, sd * s * 0.75), dir: m.dir + sd * 0.5, flip: sd }, F0, s * 0.9, g);
    return;
  }
  const { ink, rng } = C, a = m.dir + m.flip * ((g.lean ?? 0) + (m.far ? (g.farLean ?? 0) : 0)), F = frame(m.p, a, s, m.flip);
  // lent to a foreign head: small ears vanish, so give them a readable minimum size
  const lent = !C.mHead, len = lent ? Math.max(g.len * 1.2, 1.15) : g.len, wid = lent ? Math.max(g.wid, 0.95) : g.wid;
  switch (g.shape) {
    case 'round': ink.oval(F(len * 0.42, 0), len * 0.56 * s, wid * 0.5 * s, a); ink.poly(tube(polyline([F(-0.15, 0), F(len * 0.3, 0)], 2), wid * 0.3 * s)); break;
    case 'long': ink.poly(tube(spline([F(-0.2, 0), F(len * 0.5, (g.bend ?? 0) * len * 0.3), F(len, (g.bend ?? 0) * len)], 6), profile([[0, wid * 0.3 * s], [0.45, wid * 0.5 * s], [0.85, wid * 0.36 * s], [1, wid * 0.14 * s]]))); break;
    case 'tuft':
    case 'point': {
      const tip = F(len, (g.bend ?? 0) * len);
      ink.poly(tube(spline([F(-0.2, 0), F(len * 0.45, (g.bend ?? 0) * len * 0.3), tip], 6), profile([[0, wid * 0.5 * s], [0.4, wid * 0.42 * s], [0.8, wid * 0.2 * s], [1, 0.12]])));
      if (g.shape === 'tuft') for (const da of [-0.35, 0, 0.35]) ink.poly(leaf(F(len * 0.8, 0), a + da, s * len * 0.55, s * 0.2, rng.range(-0.1, 0.1), 0.3));
      break;
    }
    default: ink.oval(F(len * 0.4, 0), len * 0.5 * s, wid * 0.5 * s, a);
  }
};

// =====================================================================
// TAIL TIPS (the bespoke tails are drawn as "tips" on a short stub so they lend faithfully)
// =====================================================================
// Overlapping pangolin scales along a path: each a blunt shingle pointing toward the path's end,
// tilted to the outer side `o` (+1 / -1 relative to the heading) so the outline turns scalloped.
function shingles(C, pts, hs, rad, o, n, kL, u0 = 0.06, u1 = 0.94) {
  // one outline: a serrated band whose teeth rise gently and drop steeply (roof shingles)
  const N = pts.length - 1, h = kL * 0.42, outer = [], inner = [];
  const at = u => { const x = clamp(u, 0, 1) * N, i = Math.min(Math.floor(x), N - 1), f = x - i; return { p: lerp(pts[i], pts[i + 1], f), a: hs[i] + angDiff(hs[i + 1], hs[i]) * f }; };
  for (let j = 0; j < n; j++) for (let v = 0; v <= 4; v++) {
    const u = mix(u0, u1, (j + v / 4 * 0.94) / n), q = at(u), rr = rad(u);
    outer.push(polar(q.p, q.a + o * PI / 2, rr * (0.86 + h * Math.pow(v / 4, 0.6))));
  }
  for (let i = 0; i <= 8; i++) { const u = mix(u0, u1, i / 8), q = at(u); inner.push(polar(q.p, q.a + o * PI / 2, -rad(u) * 0.2)); }
  C.ink.poly(outer.concat(inner.reverse()));
}
// Pangolin tail: thick at the root, tapering, drooping to the ground, shingled along its top.
tips.mammalScaleTail = (C, e, ang, s, g) => {
  if (g.wrap && C.plan.wrap) return wrapTail(C, g, s);
  const side = C.plan.view === 'side', n = 18, L = g.tl * s, tw = g.tw * s;
  const rad = u => Math.max(tw * Math.pow(1 - u, 0.85) + 0.5, 0.6);
  let h = ang, p = polar(e, ang + PI, s * 0.4); const pts = [p], hs = [h];
  const turn = side ? (Math.cos(ang) < 0 ? -1 : 1) : 0, wv = side ? 0 : C.rng.range(-1, 1);
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    h += side ? turn * (u < 0.7 ? -(g.droop ?? 0.9) : 1.2) / n : wv * Math.cos(u * 4) / n;
    p = polar(p, h, L / n);
    if (side && p[1] > -rad(u) - 0.3) p = [p[0], -rad(u) - 0.3];
    pts.push(p); hs.push(h);
  }
  for (let i = 0; i <= n; i++) hs[i] = angOf(pts[Math.max(i - 1, 0)], pts[Math.min(i + 1, n)]);
  C.ink.poly(tube(pts, rad));
  // side view: shingles on the upper edge; top view: both edges
  const up = side ? (Math.cos(hs[n >> 1]) < 0 ? 1 : -1) : 0;
  for (const o of side ? [up] : [-1, 1]) shingles(C, pts, hs, rad, o, g.ns ?? 7, 0.9, 0.05, 0.85);
};
// A tail wrapped around a curled-up body (C.plan.wrap): an arc from angle a0 to a1 around the
// ball, standing off it by `gap` units so it reads as a separate band; its root grows out of the body.
function wrapTail(C, g, s) {
  const { ink } = C, W = C.plan.wrap, [a0, a1, gap, wk = 0.7] = g.wrap, n = 26, pw = (g.pw ?? 1) * s * wk;
  const rad = g.pk ? profile(g.pk.map(([t, w]) => [t, w * pw])) : (u => Math.max(g.tw * s * wk * Math.pow(1 - u, 0.7) + 0.5, 0.6)), mx = g.pk ? Math.max(...g.pk.map(k => k[1])) * pw : g.tw * s * wk;
  const pts = [], hs = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = mix(a0, a1, u), k = mix(0.55, 1, Math.min(u / 0.18, 1)) * (1 + (mx + gap) / W.ry);
    let p = [W.c[0] + Math.cos(a) * W.rx * k, W.c[1] + Math.sin(a) * W.ry * k];
    if (p[1] > -rad(u) - 0.3) p = [p[0], -rad(u) - 0.3];
    pts.push(p);
  }
  for (let i = 0; i <= n; i++) hs.push(angOf(pts[Math.max(i - 1, 0)], pts[Math.min(i + 1, n)]));
  ink.poly(tube(pts, rad));
  const out = Math.sign(a1 - a0); // outer side of the band
  if (g.tip === 'mammalScaleTail') return shingles(C, pts, hs, rad, -out, g.ns ?? 8, 0.9, 0.2, 0.9);
  const nf = g.fluff ?? 0;
  for (let i = 0; i < nf + 1; i++) {
    const u = mix(0.3, 0.9, i / nf), k = Math.round(u * n), rr = rad(u);
    ink.poly(leaf(polar(pts[k], hs[k] - out * PI / 2, rr * 0.55), hs[k] - out * 0.65, rr * 0.95, rr * 0.6, 0, 0.35));
  }
  for (const da of [-0.45, 0.1]) ink.poly(leaf(pts[n - 1], hs[n] + da, rad(1) * 1.6, rad(1) * 0.85, 0, 0.35));
}
tips.mammalBrush = (C, e, ang, s, g, curl) => {
  if (g.wrap && C.plan.wrap) return wrapTail(C, g, s);
  const { ink, rng } = C, side = C.plan.view === 'side', n = g.bands ? 36 : 20, L = g.pl * s, pw = g.pw * s;
  const rad0 = profile(g.pk.map(([t, w]) => [t, w * pw]));
  // ringed tails (raccoon, red panda): narrow pinches between the rings
  const rad = g.bands ? (u => rad0(u) * (u < 0.15 ? 1 : 1 - 0.3 * Math.pow(Math.max(0, Math.cos(2 * PI * (u * g.bands + 0.5))), 6))) : rad0;
  const rise = side && g.ptarget != null ? angDiff(g.ptarget, ang) : 0, cs = side ? 1 : (rng.chance(0.5) ? 1 : -1);
  let h = ang, p = e; const pts = [p], hs = [h];
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    h += (u <= 0.5 ? rise / 0.5 : 0) / n + (u > 0.5 ? (g.precurve ?? 0) * cs / 0.5 : 0) / n + (side ? 0 : cs * (g.pwave ?? 0.5) * Math.cos(u * 5) / n);
    p = polar(p, h, L / n);
    if (side && p[1] > -rad(u) - 0.4) p = [p[0], -rad(u) - 0.4];
    pts.push(p); hs.push(h);
  }
  ink.poly(tube(pts, rad));
  ink.poly(tube(polyline([polar(e, ang + PI, s * 0.6), e], 2), rad(0)));
  const nf = g.fluff ?? 0;
  for (let i = 0; i < nf; i++) for (const sd of [-1, 1]) { // fur breaking the outline
    const u = mix(0.35, 0.92, (i + (sd > 0 ? 0.5 : 0)) / nf), k = Math.round(u * n), rr = rad(u);
    ink.poly(leaf(polar(pts[k], hs[k] + sd * PI / 2, rr * 0.6), hs[k] + sd * 0.6, rr * 1.0, rr * 0.55, 0, 0.35));
  }
  if (nf) for (const da of [-0.5, 0, 0.5]) ink.poly(leaf(pts[n - 1], hs[n] + da, rad(1) * 1.7, rad(1) * 0.8, 0, 0.35));
};
tips.mammalFlag = (C, e, ang, s, g) => {
  const q = s * (g.tipS ?? 1);
  C.ink.poly(leaf(polar(e, ang + PI, q * 0.4), ang, q * 2.6, q * 1.15, 0, 0.55));
};
tips.mammalPaddle = (C, e, ang, s, g) => {
  const side = C.plan.view === 'side', q = s * (g.tipS ?? 1), a = side ? PI + (g.padA ?? -0.08) : ang;
  const c = polar(e, a, q * 1.7), pts = spline([polar(e, a + PI, q * 0.3), c, polar(e, a, q * 3.3)], 6);
  C.ink.poly(tube(pts.map(p => side ? [p[0], Math.min(p[1], -q * 0.5)] : p), profile([[0, q * 0.3], [0.45, q * (side ? 0.5 : 1)], [0.85, q * (side ? 0.45 : 0.85)], [1, q * 0.25]])));
};

// =====================================================================
// DORSALS
// =====================================================================
dorsals.mammalQuills = (C, plan, st, sd, si, g) => {
  if (plan.view === 'side' && !plan.rooted && si > 0) return;
  const { ink, rng } = C, r = plan.r, n = g.n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, k = samp(st, u);
    const env = g.rear ? mix(1.25, 0.4, Math.pow(u, 0.8)) : Math.pow(Math.sin(PI * mix(0.08, 0.92, u)), 0.45);
    const lean = (g.rear ? mix(g.lean * 1.5, g.lean * 0.5, u) : g.lean) + rng.range(-0.12, 0.12);
    const b = polar(k.p, k.dir, -r * 0.28), a = k.dir + sd * lean, len = r * g.len * env * rng.range(0.88, 1.12) + r * 0.28, w = r * g.wid;
    ink.poly([polar(b, a + PI / 2, w), polar(b, a, len), polar(b, a - PI / 2, w)]);
  }
};
dorsals.mammalScales = (C, plan, st, sd, si, g) => {
  if (plan.view === 'side' && !plan.rooted && si > 0) return;
  const pts = [], hs = [], N = 16, R = plan.r * (g.k ?? 0.42);
  for (let i = 0; i <= N; i++) { const k = samp(st, i / N); pts.push(polar(k.p, k.dir, -R * 0.72)); }
  for (let i = 0; i <= N; i++) hs.push(angOf(pts[Math.min(i + 1, N)], pts[Math.max(i - 1, 0)])); // toward the rump
  const o = Math.sign(angDiff(samp(st, 0.5).dir, hs[N >> 1])) || 1; // outward side of that heading
  shingles(C, pts, hs, () => R, o, g.n, g.kL ?? 1.4, 0.04, 0.98);
};
dorsals.mammalShell = (C, plan, st, sd, si, g) => {
  if (plan.view === 'side' && !plan.rooted && si > 0) return;
  const r = plan.r, n = 24, out = [], inn = [], bands = g.bands ?? 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n, k = samp(st, u), notch = bands ? Math.max(0, 1 - Math.abs(((u - 0.3) / 0.4 * bands) % 1 - 0.5) * 6) * (u > 0.3 && u < 0.7 ? 1 : 0) : 0;
    out.push(polar(k.p, k.dir, r * (g.h * (0.75 + 0.25 * Math.sin(PI * u)) - notch * 0.1))); inn.push(polar(k.p, k.dir, -r * 0.35));
  }
  C.ink.poly(out.concat(inn.reverse()));
};
// Bat wing lent to other bodies (the bat's own chassis draws its own wings, so this skips it).
dorsals.mammalBatWing = (C, plan, st, sd, si, g) => {
  if (plan.mBat) return;
  const side = plan.view === 'side' && !plan.rooted;
  if (side && si > 0) return;
  const { ink } = C, r = clamp(plan.r, 6.5, 10), k = samp(st, g.at ?? 0.7), s = r * g.size;
  const base = polar(k.p, k.dir, -plan.r * 0.3);
  const wings = side ? [[1, 0.85, 0.3], [0, 1, 0]] : [[0, 1, 0]];
  for (const [far, ks, da] of wings) {
    // local frame: x along the arm (outward), y toward the trailing edge (backward / down)
    const a0 = side ? -PI / 2 - 0.3 + da : k.dir - sd * 0.25;
    const F = frame(base, a0, s * ks, sd);
    const E = [0.3, -0.06], W = [0.62, -0.1], nf = g.nf ?? 4, tipsP = [], fan = clamp(g.fan ?? 1.4, 1.3, 1.5);
    for (let i = 0; i < nf; i++) { const a = 0.55 + i * fan / (nf - 1), len = 0.7 * (1 - 0.12 * i); tipsP.push(polar(W, a, len)); }
    const sc = Math.min(g.scallop ?? 0.45, 0.45), root = [0.0, 0.4];
    const mem = [[0, -0.06], E, W, tipsP[0]];
    for (let i = 0; i < nf - 1; i++) mem.push(...bez(tipsP[i], lerp(lerp(tipsP[i], tipsP[i + 1], 0.5), W, sc), tipsP[i + 1]), tipsP[i + 1]);
    mem.push(...bez(tipsP[nf - 1], lerp(lerp(tipsP[nf - 1], root, 0.5), [0.15, 0.1], sc), root), root);
    ink.poly(mem.map(p => F(p[0], p[1])));
    ink.poly(tube(spline([F(0, -0.04), F(E[0], E[1]), F(W[0], W[1])], 4), profile([[0, r * 0.22], [1, r * 0.11]])));
    if (far) continue;
  }
};
dorsals.mammalBabies = (C, plan, st, sd, si, g) => {
  if (si > 0) return;
  const { ink, rng } = C, r = plan.r, n = g.n;
  for (let i = 0; i < n; i++) {
    const u = mix(0.3, 0.8, n > 1 ? i / (n - 1) : 0.5) + rng.range(-0.04, 0.04), k = samp(st, u), q = r * g.size * rng.range(0.9, 1.1);
    const fa = k.dir + PI / 2, c = polar(k.p, k.dir, q * 0.75), hd = polar(polar(c, fa, q * 0.9), k.dir, q * 0.25);
    ink.oval(c, q, q * 0.72, fa); ink.oval(hd, q * 0.62, q * 0.5, fa + 0.2);
    ink.poly(leaf(hd, fa + 0.25, q * 1.25, q * 0.55, 0, 0.3));
    ink.dot(polar(hd, k.dir - 0.3, q * 0.5), q * 0.3);
    ink.line([polar(c, fa + PI, q * 0.8), polar(polar(c, fa + PI, q * 1.6), k.dir, q * 0.5), polar(polar(c, fa + PI, q * 1.9), k.dir, q * 1.3)], MINW * 1.5);
  }
};

// =====================================================================
// GENE BUILDERS
// =====================================================================
const head = (o = {}) => ({ type: 'mammalHead', skull: 1, snoutLen: 1.45, tipR: 0.22, mid: 0.58, droop: 0.12, eyeX: 0.42, eyeY: 0.3, eyeR: 0.15, earX: -0.3, ...o });
const ear = (shape, len, wid, o = {}) => ({ type: 'mammalEar', shape, len, wid, pair: true, ...o });
const limbs = (o = {}) => ({ mOwn: true, len: 1.5, w: 0.42, taper: 0.6, bend: 0.8, foot: 'paw', lift: 0.4, stance: 0.3, hindW: 1.5, arm: 0.8, ...o });
const SQ = [[0, 0.3], [0.25, 0.8], [0.7, 1], [1, 0.62]], FOX = [[0, 0.3], [0.45, 0.8], [0.8, 0.62], [1, 0.12]], CLUB = [[0, 0.28], [0.3, 0.5], [0.8, 0.6], [1, 0.42]], BOTTLE = [[0, 0.4], [0.4, 0.95], [0.8, 1.1], [1, 0.55]];
const tThin = (r, len, o = {}) => ({ len: len * r.range(0.85, 1.15), w0: 0.2, mid: 0.5, w1: 0.05, curl: r.range(0.8, 2), wave: r.range(0.8, 2), freq: 1, up: r.chance(0.7), tip: 'point', ...o });
const tBrush = (o = {}) => ({ len: 0.3, w0: 0.3, mid: 0.5, w1: 0.3, curl: 0, wave: 0, tip: 'mammalBrush', pl: 6, pw: 1, pk: SQ, ptarget: -PI / 2 + 0.1, precurve: -1.2, fluff: 3, ...o });
const tScut = (o = {}) => ({ len: 0.35, w0: 0.45, mid: 0.5, w1: 0.35, curl: 0, wave: 0, tip: 'pom', tipS: 0.75, ...o });

// pose builders: B is a species "build"
const walk = (r, B, o = {}) => ({
  type: 'mammalWalk', r: B.r, len: B.len * r.range(0.93, 1.07), clr: B.clr, pitch: r.range(-0.03, 0.07), arch: (B.arch ?? 0.4) * r.range(0.8, 1.2),
  rump: B.rump ?? 0.85, belly: B.belly ?? 1, chest: B.chest ?? 0.9, neckW: B.neckW ?? 0.8, neckLen: B.neckLen ?? 0.1, neckAng: (B.neckAng ?? 0.3) + r.range(-0.1, 0.1),
  headS: B.headS, gait: r.pick(['walk', 'walk', 'stand', 'trot']), legW: B.legW ?? 0.3, haunch: B.haunch ?? 0.9, footL: B.footL ?? 0.7, pawS: B.pawS ?? 1, fore: B.fore, tailA: B.tailA, ...o,
});
const sniff = (r, B, o = {}) => walk(r, B, { pitch: r.range(0.2, 0.38), neckAng: r.range(0.8, 1.1), face: -r.range(0.5, 0.85), gait: 'stand', ...o });
const scurry = (r, B, o = {}) => walk(r, B, { clr: B.clr * 0.55, arch: 0.15, len: B.len * 1.12, gait: 'run', neckAng: 0.05, face: 0.08, stride: 0.8, ...o });
const leap = (r, B, o = {}) => walk(r, B, { pitch: r.range(0.35, 0.55), arch: 0.3, gait: 'leap', neckAng: 0.15, face: -0.1, len: B.len * 1.1, clr: B.clr + 0.25, ...o });
const stretch = (r, B, o = {}) => walk(r, B, { pitch: -r.range(0.3, 0.42), arch: -0.25, gait: 'stretch', neckAng: -0.1, face: 0.1, clr: B.clr + 0.5, len: B.len * 1.1, ...o });
const sit = (r, B, arms, o = {}) => ({
  type: 'mammalUp', r: B.r, h: (B.sitH ?? B.len * 0.72) * r.range(0.92, 1.08), lean: r.range(0.32, 0.58), haunch: B.sitHaunch ?? 1.05, shoulder: B.upShoulder ?? 0.74, neckW: B.upNeck ?? 0.62,
  headS: B.headS, arms, legW: B.legW ?? 0.3, footL: B.sitFoot ?? 0.9, hunch: r.range(0.08, 0.2), face: r.range(-0.05, 0.2), ...o,
});
const stand = (r, B, o = {}) => ({
  type: 'mammalUp', r: B.r * 0.92, h: (B.standH ?? B.len * 0.88) * r.range(0.92, 1.08), lean: r.range(0.02, 0.2), haunch: B.standHaunch ?? 0.98, shoulder: B.upShoulder ?? 0.74, neckW: B.upNeck ?? 0.62,
  headS: B.headS / 0.92, arms: 'hang', legW: B.legW ?? 0.3, footL: B.sitFoot ?? 0.8, hunch: r.range(-0.05, 0.1), face: r.range(-0.25, 0.1), thigh: 0.7, ...o,
});
const ball = (r, B, o = {}) => ({ type: 'mammalBall', r: B.r * 1.25, wide: r.range(1.08, 1.22), headS: B.headS / 1.25 * 0.95, ...o });
const sp = (name, w, fn) => ({ name, w, genes: r => { const G = fn(r); G.limbs ??= limbs(); G.dorsal ??= none(); G.crown ??= none(); G.tail ??= none(); G.surface ??= { eyes: 'dot' }; Object.defineProperty(G.chassis, 'own', { value: G, enumerable: false }); return G; } });

// =====================================================================
// SPECIES
// =====================================================================
const species = [
  sp('house mouse', 4, r => {
    const B = { r: r.range(8.5, 10.5), len: r.range(20, 26), clr: r.range(0.18, 0.3), headS: r.range(0.74, 0.84), arch: 0.5 };
    const pose = r.wpick([[3, 'walk'], [1.5, 'sniff'], [1.5, 'groom'], [1, 'stand'], [1, 'scurry'], [0.8, 'hold'], [0.8, 'stretch']]);
    const ch = { walk: () => walk(r, B), sniff: () => sniff(r, B), stretch: () => stretch(r, B), scurry: () => scurry(r, B), groom: () => sit(r, B, 'groom', { face: 0.35 }), hold: () => sit(r, B, 'hold', { item: r.pick(['seed', 'berry', 'nut']) }), stand: () => stand(r, B) }[pose]();
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.35, 1.7), tipR: r.range(0.17, 0.24), nose: 0.14, whiskers: r.chance(0.6) ? 2 : 0 }),
      crown: ear('round', r.range(0.95, 1.25), r.range(0.95, 1.2), { lean: r.range(-0.1, 0.25) }),
      tail: tThin(r, r.range(7, 10), { w0: 0.2 }),
    };
  }),

  sp('wood mouse', 2.5, r => {
    const B = { r: r.range(8, 9.5), len: r.range(19, 24), clr: r.range(0.3, 0.42), headS: r.range(0.8, 0.9), arch: 0.5, footL: 0.95, haunch: 1 };
    const ch = r.wpick([[2, () => walk(r, B)], [2, () => leap(r, B)], [1.5, () => sit(r, B, 'hold', { item: r.pick(['berry', 'acorn', 'seed']) })], [1, () => sniff(r, B)]])();
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.3, 1.55), tipR: 0.2, nose: 0.13, eyeR: 0.22, eyeX: 0.35, whiskers: r.chance(0.5) ? 2 : 0 }),
      crown: ear('round', r.range(1.5, 1.85), r.range(1.2, 1.45), { lean: r.range(-0.15, 0.2) }),
      tail: tThin(r, r.range(9, 12), { w0: 0.18, up: true, curl: r.range(1.2, 2.2) }), surface: { eyes: 'dot', eyeS: 1.1 },
    };
  }),

  sp('harvest mouse', 2.5, r => {
    const rr = r.range(6.2, 7.4), onStalk = r.chance(0.8);
    const B = { r: rr, len: rr * 2.1, clr: 0.2, headS: 0.86, arch: 0.5 };
    const ch = onStalk ? { type: 'mammalClimb', r: rr, len: rr * r.range(1.5, 1.9), stalkH: r.range(58, 74), stalkR: r.range(0.95, 1.2), bendX: r.range(0.1, 0.3), top: r.wpick([[3, 'ear'], [1, 'reed'], [1, 'leaf']]), nod: r.range(0.3, 0.9), at: r.range(0.42, 0.62), turn: r.range(0.3, 0.9), face: -r.range(0, 0.6), headS: 0.86 }
      : sit(r, B, 'hold', { item: 'seed' });
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.0, 1.2), tipR: 0.26, nose: 0.13, eyeR: 0.17 }),
      crown: ear('round', r.range(0.75, 0.95), r.range(0.8, 1), { lean: 0.2 }),
      tail: onStalk ? { len: r.range(7, 9.5), w0: 0.2, mid: 0.5, w1: 0.07, curl: r.range(3.2, 4.4), wave: 0, up: true, spiral: true, tip: 'point' } : tThin(r, 8, { up: true, curl: 2.2 }),
    };
  }),

  sp('dormouse', 2.5, r => {
    const B = { r: r.range(8.5, 10), len: r.range(17, 21), clr: 0.2, headS: 0.84, arch: 0.55 };
    const pose = r.wpick([[2, 'ball'], [1.5, 'hold'], [0.8, 'climb'], [1, 'walk']]);
    const ch = { ball: () => ball(r, B, { tailA: PI + 1.15, headX: 0.72, headY: r.range(0.05, 0.25), face: r.range(0.5, 0.8), headS: 0.62 }), hold: () => sit(r, B, 'hold', { item: r.pick(['nut', 'acorn', 'berry']), tailA: PI + 0.1 }), walk: () => walk(r, B), climb: () => ({ type: 'mammalClimb', r: B.r * 0.8, len: B.r * 1.5, stalkH: r.range(56, 68), stalkR: r.range(1.5, 2), bendX: r.range(-0.05, 0.2), top: 'leaf', at: r.range(0.45, 0.6), turn: r.range(0.4, 0.9), face: -r.range(0, 0.5), headS: 0.84 }) }[pose]();
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.05, 1.25), tipR: 0.26, nose: 0.13, eyeR: 0.2, whiskers: pose !== 'ball' && r.chance(0.4) ? 2 : 0 }),
      crown: ear('round', r.range(0.75, 0.95), r.range(0.8, 1), { lean: pose === 'ball' ? 0.5 : 0.15 }),
      tail: tBrush({ pk: CLUB, pl: r.range(4.5, 5.5), pw: r.range(0.85, 1.05), ptarget: pose === 'climb' ? PI / 2 : PI + 0.3, precurve: r.range(-0.3, 0.8), fluff: 3, wrap: [r.range(2.2, 2.5), 2 * PI - r.range(0.2, 0.5), r.range(1.5, 1.8), r.range(0.6, 0.7)] }),
      surface: { eyes: pose === 'ball' ? 'none' : 'dot' },
    };
  }),

  sp('hamster', 2.5, r => {
    const B = { r: r.range(10, 12), len: r.range(15, 19), clr: 0.08, headS: r.range(0.84, 0.92), arch: 0.55, neckW: 0.95, chest: 1, rump: 0.95, footL: 0.5, neckAng: 0.15, neckLen: -0.05, sitH: 14, upShoulder: 0.86, upNeck: 0.8 };
    const cheek = r.range(0.75, 1.15);
    const ch = r.wpick([[2.5, () => sit(r, B, 'hold', { item: r.pick(['seed', 'nut']), lean: r.range(0.2, 0.4) })], [0.7, () => walk(r, B, { gait: r.pick(['stand', 'walk']) })], [1, () => sit(r, B, 'groom', { face: 0.3 })]])();
    return {
      chassis: ch, head: head({ snoutLen: r.range(0.8, 0.95), tipR: 0.38, mid: 0.5, droop: 0.15, cheek, eyeR: 0.15, nose: 0.12 }),
      crown: ear('round', r.range(0.65, 0.85), r.range(0.75, 0.9), { lean: 0.1 }), tail: r.chance(0.6) ? tScut({ tipS: 0.3 }) : none(),
    };
  }),

  sp('gerbil', 1.8, r => {
    const B = { r: r.range(8.5, 10), len: r.range(18, 22), clr: 0.25, headS: 0.8, arch: 0.5, footL: 1.1, sitFoot: 1.15, standH: 21 };
    const ch = r.wpick([[2.5, () => stand(r, B)], [1.5, () => sit(r, B, 'hold', { item: 'seed' })], [1.5, () => walk(r, B)], [1, () => sniff(r, B)]])();
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.15, 1.35), tipR: 0.26, nose: 0.13, eyeR: 0.19 }),
      crown: ear('round', r.range(0.7, 0.9), 0.75, { lean: 0.2 }),
      tail: tThin(r, r.range(7.5, 9.5), { w0: 0.24, w1: 0.12, tip: 'mammalFlag', tipS: 0.7, up: r.chance(0.5), curl: r.range(0.6, 1.5), wave: 1 }),
    };
  }),

  sp('jerboa', 2.5, r => {
    const rr = r.range(8, 9.5);
    const B = { r: rr, len: rr * r.range(1.3, 1.6), clr: r.range(1.25, 1.7), headS: r.range(0.86, 0.95), arch: 0.4, footL: r.range(1.3, 1.7), legW: 0.3, rump: 0.9, chest: 0.85, haunch: 0.95 };
    return {
      chassis: walk(r, B, { gait: 'biped', pitch: r.range(0.35, 0.7), neckAng: r.range(0.1, 0.5), face: r.range(-0.15, 0.1), tailA: PI - r.range(0.1, 0.5) }),
      head: head({ snoutLen: r.range(0.95, 1.15), tipR: 0.3, eyeR: 0.2, nose: 0.12, whiskers: r.chance(0.5) ? 2 : 0 }),
      crown: r.chance(0.6) ? ear('long', r.range(2.1, 2.9), r.range(0.85, 1.05), { lean: r.range(-0.1, 0.3), farLean: -0.25 }) : ear('round', r.range(1.1, 1.4), 1, { lean: 0.1 }),
      tail: { len: r.range(13, 17), w0: 0.17, mid: 0.5, w1: 0.11, curl: r.range(1.6, 2.4), wave: r.range(0, 0.8), freq: 0.7, up: true, tip: 'mammalFlag', tipS: r.range(0.85, 1.1) },
    };
  }),

  sp('kangaroo rat', 1.5, r => {
    const rr = r.range(9, 10.5);
    const B = { r: rr, len: rr * r.range(1.2, 1.45), clr: r.range(0.85, 1.15), headS: r.range(0.95, 1.05), arch: 0.5, footL: r.range(1.5, 1.8), legW: 0.3, rump: 0.92, chest: 0.9, haunch: 1.05 };
    return {
      chassis: walk(r, B, { gait: 'biped', pitch: r.range(0.25, 0.5), neckAng: r.range(0, 0.3), face: r.range(0, 0.15), tailA: PI - r.range(0, 0.3), neckW: 0.9 }),
      head: head({ snoutLen: r.range(1.05, 1.2), tipR: 0.28, eyeR: 0.2, nose: 0.12, cheek: 0.6 }),
      crown: ear('round', 0.55, 0.7, { lean: 0.4 }),
      tail: { len: r.range(12, 15), w0: 0.2, mid: 0.5, w1: 0.13, curl: r.range(0.5, 1.5), wave: r.range(0.5, 1.2), freq: 0.8, up: r.chance(0.7), tip: 'mammalFlag', tipS: r.range(0.9, 1.15) },
    };
  }),

  sp('rat', 2.5, r => {
    const B = { r: r.range(9.5, 11), len: r.range(26, 32), clr: r.range(0.25, 0.38), headS: r.range(0.68, 0.76), arch: 0.55, neckLen: 0.2, footL: 0.8, standH: 27, upShoulder: 0.7 };
    const ch = r.wpick([[3, () => walk(r, B)], [1.5, () => sniff(r, B)], [1.5, () => stand(r, B, { lean: r.range(0.1, 0.3) })], [1, () => sit(r, B, 'hold', { item: r.pick(['nut', 'seed']) })]])();
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.7, 2.05), tipR: 0.26, mid: 0.62, nose: 0.14, whiskers: r.chance(0.6) ? 2 : 0 }),
      crown: ear('round', r.range(0.75, 0.95), r.range(0.8, 0.95), { lean: 0.25 }),
      tail: tThin(r, r.range(9, 12), { w0: 0.36, w1: 0.08, mid: 0.4, up: r.chance(0.4), curl: r.range(0.5, 1.4), wave: r.range(1, 2) }),
    };
  }),

  sp('shrew', 2, r => {
    const water = r.chance(0.3);
    const B = { r: r.range(8, 9.5), len: r.range(17, 21), clr: 0.1, headS: 0.78, arch: 0.45, neckW: 0.9, chest: 0.95, footL: 0.5, neckAng: 0.05, neckLen: 0.05 };
    const ch = r.wpick([[2.5, () => walk(r, B, { gait: r.pick(['walk', 'stand']) })], [1.5, () => scurry(r, B, { clr: 0.08 })], [1.2, () => sniff(r, B, { pitch: 0.12, neckAng: 0.5, face: -0.55 })]])();
    return {
      chassis: ch, head: head({ skull: 0.95, snoutLen: r.range(1.8, 2.2), tipR: 0.13, mid: 0.68, droop: 0.02, eyeR: 0.1, eyeX: 0.5, trunk: r.range(0.35, 0.6), trunkCurl: r.range(-0.7, 0.5), whiskers: r.chance(0.5) ? 2 : 0, whiskerL: 0.8 }),
      crown: r.chance(0.6) ? ear('round', 0.38, 0.55, { lean: 0.6 }) : none(),
      tail: tThin(r, r.range(5, 7), { w0: water ? 0.3 : 0.2, w1: water ? 0.14 : 0.06, curl: r.range(0.2, 1), wave: 1 }),
      dorsal: water && r.chance(0.5) ? { type: 'fur', n: 8, len: 0.28 } : none(),
    };
  }),

  sp('elephant shrew', 2, r => {
    const B = { r: r.range(8.5, 10), len: r.range(15, 18), clr: r.range(0.7, 0.95), headS: 0.8, arch: 0.6, rump: 0.95, chest: 0.85, legW: 0.22, footL: 1.05, haunch: 1, neckAng: 0.25, pawS: 0.8 };
    return {
      chassis: r.chance(0.7) ? walk(r, B, { gait: r.pick(['walk', 'stand', 'trot']) }) : sniff(r, B, { pitch: 0.1, neckAng: 0.6, face: -0.3 }),
      head: head({ snoutLen: r.range(1.5, 1.8), tipR: 0.15, mid: 0.66, droop: 0.1, eyeR: 0.2, eyeX: 0.3, trunk: r.range(0.9, 1.3), trunkCurl: r.range(0.3, 1.1) }),
      crown: ear('round', r.range(1.0, 1.25), r.range(0.85, 1), { lean: 0.15 }),
      tail: tThin(r, r.range(8, 10), { w0: 0.17, curl: r.range(0.3, 1.2), wave: 0.8, up: r.chance(0.4) }),
      surface: { eyes: 'dot', eyeS: 1.1 },
    };
  }),

  sp('mole', 2.5, r => {
    const star = false, hill = r.chance(0.5), rr = r.range(8, 9.5);
    const B = { r: rr, len: r.range(20, 25), clr: 0.04, headS: 0.74, arch: 0.25, neckW: 0.95, chest: 1, rump: 0.92, footL: 0.4, neckAng: 0.05, neckLen: 0, fore: 'spade', pawS: 1 };
    const ch = hill ? { type: 'mammalHill', r: rr * 0.82, w: r.range(44, 58), hm: r.range(13, 19), h: r.range(6, 11), lean: r.range(-0.2, 0.5), x0: r.range(-3, 3), face: -r.range(0.3, 1.0), headS: 0.9 }
      : walk(r, B, { gait: 'walk', stride: 0.8, face: r.range(-0.3, 0.1) });
    return {
      chassis: ch, head: head({ skull: 0.95, snoutLen: r.range(1.35, 1.6), tipR: 0.15, mid: 0.6, droop: 0, nose: 0.17, whiskers: r.chance(0.35) ? 2 : 0, whiskerL: 0.7, star: star ? 0.5 : 0 }),
      tail: hill ? none() : tThin(r, r.range(1.8, 2.5), { w0: 0.2, w1: 0.1, curl: 0.4, wave: 0, up: true }),
      limbs: limbs({ foreFoot: 'mammalSpade', lift: 0.15 }), surface: { eyes: 'none' },
    };
  }),

  sp('star-nosed mole', 1.2, r => {
    const hill = r.chance(0.6), rr = r.range(8, 9.5);
    const B = { r: rr, len: r.range(20, 24), clr: 0.04, headS: 0.74, arch: 0.25, neckW: 0.95, chest: 1, rump: 0.92, footL: 0.4, neckAng: 0.05, neckLen: 0, fore: 'spade' };
    const ch = hill ? { type: 'mammalHill', r: rr * 0.82, w: r.range(44, 56), hm: r.range(13, 18), h: r.range(7, 11), lean: r.range(0, 0.5), x0: r.range(-3, 3), face: -r.range(0.2, 0.7), headS: 0.9 }
      : walk(r, B, { gait: 'walk', stride: 0.8, face: r.range(-0.2, 0.1) });
    return {
      chassis: ch, head: head({ skull: 0.95, snoutLen: r.range(1.3, 1.5), tipR: 0.17, mid: 0.6, droop: 0, star: r.range(0.5, 0.62) }),
      tail: hill ? none() : tThin(r, r.range(4, 5.5), { w0: 0.3, w1: 0.1, mid: 0.2, curl: 0.5, wave: 0.6, up: false }),
      limbs: limbs({ foreFoot: 'mammalSpade', lift: 0.15 }), surface: { eyes: 'none' },
    };
  }),

  sp('hedgehog', 4, r => {
    const rr = r.range(10.5, 12.5), rolled = r.chance(0.28);
    const B = { r: rr, len: r.range(17, 22), clr: r.range(0.1, 0.22), headS: 0.66, arch: 0.6, neckW: 0.8, chest: 0.95, rump: 0.95, footL: 0.45, neckAng: 0.0, neckLen: 0.15, legW: 0.26 };
    const ch = rolled ? ball(r, B, { r: rr * 1.1, wide: r.range(1.02, 1.12), headS: 0.5, headX: 0.62, headY: 0.5, face: r.range(0.1, 0.5), b0: 0.65, b1: -0.15, paws: r.chance(0.5) })
      : r.wpick([[3, () => walk(r, B, { face: r.range(0, 0.25), b0: 0.0, b1: 0.72 })], [1.2, () => sniff(r, B, { pitch: 0.12, neckAng: 0.5, face: -0.5, b0: 0, b1: 0.72 })]])();
    return {
      chassis: ch, head: head({ skull: 0.95, snoutLen: r.range(1.5, 1.8), tipR: 0.15, mid: 0.52, droop: -0.03, nose: 0.2, eyeX: 0.5 }),
      crown: rolled ? none() : ear('round', 0.5, 0.6, { lean: 0.5 }),
      dorsal: { type: 'mammalQuills', n: rolled ? r.int(20, 25) : r.int(15, 20), len: r.range(0.34, 0.5), wid: r.range(0.17, 0.22), lean: rolled ? 0.15 : r.range(0.3, 0.6) },
    };
  }),

  sp('red squirrel', 4, r => {
    const B = { r: r.range(8.5, 10), len: r.range(20, 24), clr: 0.35, headS: r.range(0.76, 0.84), arch: 0.55, footL: 1, sitFoot: 1.05, haunch: 1, sitH: r.range(15, 18) };
    const pose = r.wpick([[4, 'hold'], [1.5, 'run'], [1.2, 'stand'], [1, 'walk'], [0.8, 'groom']]);
    const up = pose === 'hold' || pose === 'groom' || pose === 'stand';
    const ch = { hold: () => sit(r, B, 'hold', { item: r.pick(['acorn', 'acorn', 'nut']), tailA: -PI / 2 - r.range(0.5, 0.8) }), groom: () => sit(r, B, 'groom', { face: 0.3, tailA: -PI / 2 - 0.6 }), stand: () => stand(r, B, { tailA: -PI / 2 - 0.8, standH: 20 }), run: () => leap(r, B, { pitch: r.range(0.15, 0.35), tailA: PI + 0.2 }), walk: () => walk(r, B, { tailA: PI + 0.7 }) }[pose]();
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.05, 1.25), tipR: 0.3, mid: 0.55, eyeR: 0.17, nose: 0.1, carry: pose === 'run' && r.chance(0.5) ? 'acorn' : null }),
      crown: ear('tuft', r.range(1.1, 1.4), 0.62, { lean: r.range(-0.2, 0.1) }),
      tail: tBrush({ pl: r.range(5.6, 6.8), pw: r.range(1.05, 1.3), ptarget: up ? -PI / 2 + r.range(0, 0.25) : (pose === 'run' ? PI + r.range(0, 0.5) : -PI / 2 - 0.3), precurve: up ? -r.range(1.1, 1.9) : r.range(-0.5, 0.6), fluff: r.int(3, 4) }),
    };
  }),

  sp('chipmunk', 2, r => {
    const B = { r: r.range(8.5, 10), len: r.range(17, 21), clr: 0.22, headS: r.range(0.82, 0.9), arch: 0.5, footL: 0.8, sitH: 13 };
    const pose = r.wpick([[2.5, 'hold'], [2, 'walk'], [1.2, 'stand'], [1, 'scurry']]);
    const ch = { hold: () => sit(r, B, 'hold', { item: r.pick(['seed', 'nut', 'acorn']) }), stand: () => stand(r, B, { standH: 17 }), walk: () => walk(r, B, { tailA: PI + 1.1 }), scurry: () => scurry(r, B, { tailA: PI + 1.2 }) }[pose]();
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.05, 1.2), tipR: 0.28, cheek: r.range(0.6, 1.05), eyeR: 0.16, nose: 0.1 }),
      crown: ear('round', 0.6, 0.6, { lean: 0.1 }),
      tail: tBrush({ pk: CLUB, pl: r.range(4.6, 5.6), pw: r.range(0.7, 0.85), ptarget: pose === 'hold' || pose === 'stand' ? PI + 0.25 : -PI / 2 - 0.15, precurve: r.range(-0.4, 0.4), fluff: 2 }),
    };
  }),

  sp('flying squirrel', 2, r => {
    const sugar = r.chance(0.4), rr = r.range(7.5, 9);
    return {
      chassis: { type: 'mammalGlide', r: rr, len: rr * r.range(2.6, 3.1), span: r.range(2.2, 2.7), reach: r.range(0.9, 1.4), sag: r.range(0.1, 0.22), skew: r.range(-0.08, 0.08), tilt: r.range(-0.4, 0.25), headS: 0.82 },
      head: head({ snoutLen: sugar ? 1.15 : 0.95, tipR: 0.3, eyeR: 0.18, eyeX: 0.3, nose: 0.12 }),
      crown: sugar ? ear('point', 1.1, 0.8, { lean: -0.3 }) : ear('round', 0.6, 0.65, { lean: -0.2 }),
      tail: sugar ? tBrush({ pk: CLUB, pl: r.range(6.5, 8), pw: 0.75, fluff: 2, pwave: r.range(0.4, 1.2) }) : tBrush({ pk: [[0, 0.3], [0.3, 0.75], [0.75, 0.85], [1, 0.5]], pl: r.range(5, 6.2), pw: 1, fluff: 2, pwave: r.range(0.2, 0.8) }),
    };
  }),

  sp('rabbit', 4, r => {
    const B = { r: r.range(10, 12), len: r.range(19, 23), clr: 0.18, headS: r.range(0.7, 0.78), arch: 0.7, rump: 1, chest: 0.85, neckW: 0.72, footL: 1.1, haunch: 1.1, sitH: r.range(15, 18), sitFoot: 1.1, sitHaunch: 1.1, standH: 22, neckAng: 0.5, neckLen: 0.15 };
    const pose = r.wpick([[3, 'sit'], [2, 'crouch'], [1.5, 'alert'], [1.5, 'lope'], [0.8, 'groom']]);
    const ch = { sit: () => sit(r, B, 'down', { lean: r.range(0.5, 0.72), armX: 0.15 }), crouch: () => walk(r, B, { gait: 'creep', clr: 0.06, neckAng: r.range(0.2, 0.6) }), alert: () => stand(r, B, { lean: r.range(0.05, 0.22) }), lope: () => leap(r, B, { pitch: r.range(0.1, 0.3), clr: 0.5 }), groom: () => sit(r, B, 'groom', { face: 0.35 }) }[pose]();
    const earPose = r.wpick([[3, { lean: r.range(-0.25, 0.1), farLean: r.range(-0.4, 0) }], [1.5, { lean: r.range(0.7, 1.1), farLean: -0.1 }], [1, { lean: -0.1, farLean: r.range(0.7, 1.2) }]]);
    return {
      chassis: ch, head: head({ skullL: 1.08, snoutLen: r.range(1.0, 1.2), tipR: r.range(0.4, 0.46), mid: 0.5, droop: 0.2, eyeR: 0.16, eyeX: 0.3, whiskers: r.chance(0.35) ? 2 : 0, whiskerL: 0.8, earX: -0.45 }),
      crown: ear('long', r.range(2.4, 3.1), r.range(0.85, 1.05), { bend: r.range(-0.08, 0.08), ...earPose }),
      tail: tScut({ tipS: r.range(0.62, 0.8) }),
    };
  }),

  sp('hare', 2, r => {
    const B = { r: r.range(8.5, 10), len: r.range(23, 27), clr: r.range(0.75, 1), headS: r.range(0.68, 0.74), arch: 0.6, rump: 1, chest: 0.8, neckW: 0.62, footL: 1.4, haunch: 1.2, legW: 0.28, sitH: 20, sitFoot: 1.4, standH: 27, neckAng: 0.7, neckLen: 0.35, upShoulder: 0.66 };
    const pose = r.wpick([[2.5, 'alert'], [2.5, 'run'], [1.5, 'sit'], [1, 'walk']]);
    const ch = { alert: () => stand(r, B, { lean: r.range(0, 0.15) }), run: () => walk(r, B, { gait: 'run', arch: r.range(0.1, 0.5), clr: 0.6, neckAng: 0.3, face: 0 }), sit: () => sit(r, B, 'down', { lean: r.range(0.35, 0.55), armX: 0.1 }), walk: () => walk(r, B, { gait: r.pick(['stand', 'walk']) }) }[pose]();
    return {
      chassis: ch, head: head({ skullL: 1.1, snoutLen: r.range(1.15, 1.35), tipR: 0.38, mid: 0.5, droop: 0.18, eyeR: 0.17, eyeX: 0.3, earX: -0.5 }),
      crown: ear('long', r.range(3.3, 4.1), r.range(0.8, 0.95), { bend: r.range(-0.06, 0.06), lean: pose === 'run' ? r.range(0.6, 1.1) : r.range(-0.2, 0.15), farLean: r.range(-0.35, 0.1) }),
      tail: tScut({ tipS: 0.6 }),
    };
  }),

  sp('chinchilla', 1.5, r => {
    const B = { r: r.range(10.5, 12), len: r.range(15, 18), clr: 0.12, headS: 0.8, arch: 0.65, neckW: 0.9, rump: 1, footL: 0.9, sitH: 13, sitFoot: 1 };
    const pose = r.wpick([[2, 'sit'], [2, 'walk'], [1, 'hold']]);
    const ch = { sit: () => sit(r, B, 'down', { lean: r.range(0.45, 0.6) }), walk: () => walk(r, B, { gait: 'stand', tailA: PI + 0.9 }), hold: () => sit(r, B, 'hold', { item: 'nut' }) }[pose]();
    return {
      chassis: ch, head: head({ snoutLen: 0.95, tipR: 0.4, mid: 0.5, eyeR: 0.18, whiskers: r.chance(0.6) ? 2 : 0 }),
      crown: ear('round', r.range(1.35, 1.6), r.range(1.2, 1.4), { lean: 0.05 }),
      tail: tBrush({ pk: CLUB, pl: r.range(3.8, 4.6), pw: r.range(0.85, 1), ptarget: -PI / 2 - 0.4, precurve: r.range(-1.8, -1), fluff: 1 }),
    };
  }),

  sp('stoat', 3, r => {
    const ferret = r.chance(0.3);
    const B = { r: r.range(6, 7) * (ferret ? 1.12 : 1), len: r.range(30, 38), clr: r.range(0.45, 0.65), headS: r.range(0.78, 0.86), arch: r.range(0.9, 1.6), rump: 0.92, chest: 0.9, neckW: 0.78, neckLen: r.range(0.5, 0.9), neckAng: r.range(0.4, 0.8), footL: 0.7, legW: 0.34, standH: r.range(34, 42), upShoulder: 0.82, upNeck: 0.74, standHaunch: 1.05 };
    const pose = r.wpick([[3, 'walk'], [2.5, 'periscope'], [1.2, 'bound']]);
    const ch = { walk: () => walk(r, B, { arch: B.arch, gait: r.pick(['walk', 'trot', 'stand']) }), periscope: () => stand(r, B, { lean: r.range(-0.05, 0.2), hunch: r.range(-0.12, 0.12), neckLen: 0.5, arms: 'hang' }), bound: () => walk(r, B, { arch: r.range(1.8, 2.4), len: B.len * 0.8, gait: 'creep', neckAng: 0.2 }) }[pose]();
    return {
      chassis: ch, head: head({ skull: 0.95, skullL: 1.12, skullH: 0.92, snoutLen: r.range(0.95, 1.15), tipR: 0.34, mid: 0.5, droop: 0.1, eyeR: 0.14, eyeX: 0.5, nose: 0.12, whiskers: r.chance(0.3) ? 2 : 0, whiskerL: 0.7 }),
      crown: ear('round', 0.55, 0.65, { lean: 0.35 }),
      tail: ferret ? tBrush({ pk: FOX, pl: r.range(5.5, 7), pw: 0.6, ptarget: PI - 0.1, precurve: r.range(0, 0.8), fluff: 0 }) : { len: r.range(6, 8), w0: 0.3, mid: 0.4, w1: 0.2, curl: r.range(0.4, 1.4), wave: r.range(0.3, 1), freq: 0.8, up: r.chance(0.6), tip: 'mammalFlag', tipS: 0.6 },
    };
  }),

  sp('bat', 3.5, r => {
    const rr = r.range(9.5, 11), bigEar = r.chance(0.35);
    return {
      chassis: { type: 'mammalBat', r: rr, arm: r.range(1.3, 1.55), finger: r.range(2.3, 2.8), elev: r.wpick([[3, r.range(0.55, 0.85)], [1.5, r.range(0.85, 1.1)], [0.6, r.range(-0.45, -0.3)]]), droop: r.range(-0.05, 0.25), fan: r.range(1.6, 1.9), nf: 4, scallop: r.range(0.4, 0.55), skew: r.range(-0.1, 0.1), bank: r.range(-0.2, 0.2), tailM: r.range(-0.1, 0.2), headS: 0.62 },
      head: head({ snoutLen: r.range(0.6, 0.8), tipR: 0.34, mid: 0.5, droop: 0.1, eyeR: 0.13, eyeX: 0.3, nose: 0.14, earY: 0.6 }),
      crown: bigEar ? ear('long', r.range(2.2, 2.9), 1.1, { lean: -0.75 }) : ear('point', r.range(1.25, 1.7), r.range(0.9, 1.1), { lean: -0.7 }),
      dorsal: { type: 'mammalBatWing', size: r.range(2.6, 3.2), nf: 4, fan: r.range(1.3, 1.6), scallop: r.range(0.4, 0.55), at: 0.72 }, // only drawn when lent
      tail: none(),
    };
  }),

  sp('pangolin', 2, r => {
    const rolled = r.chance(0.25), rr = r.range(9, 10.5);
    const B = { r: rr, len: r.range(20, 25), clr: 0.3, headS: 0.52, arch: r.range(0.8, 1.1), neckW: 0.62, chest: 0.88, rump: 0.95, footL: 0.5, neckAng: -0.25, neckLen: 0.5, legW: 0.36, tailA: PI - 0.1 };
    const ch = rolled ? ball(r, B, { r: rr * 1.15, wide: 1.05, headS: 0.4, headX: 0.55, headY: 0.4, face: 0.9, b0: 0.6, b1: -0.25, paws: false, tailA: PI + 0.8 })
      : walk(r, B, { face: r.range(0.15, 0.45), b0: 0.0, b1: 0.84, gait: r.pick(['walk', 'stand']), pitch: r.range(-0.12, 0.02) });
    return {
      chassis: ch, head: head({ skull: 0.9, snoutLen: r.range(1.9, 2.3), tipR: 0.16, mid: 0.55, droop: 0.05, eyeR: 0.14, eyeX: 0.6 }),
      crown: none(),
      dorsal: { type: 'mammalScales', n: rolled ? r.int(13, 16) : r.int(11, 14), k: r.range(0.3, 0.38) },
      tail: { len: 0.3, w0: 1.1, mid: 0.5, w1: 1, curl: 0, wave: 0, tip: 'mammalScaleTail', tl: r.range(3.6, 4.4), tw: r.range(1.05, 1.25), droop: r.range(0.6, 1.1), ns: r.int(5, 7), wrap: [2.4, 2 * PI - 0.45, 1.7, 0.75] },
    };
  }),

  sp('armadillo', 2, r => {
    const rr = r.range(9.5, 11);
    const B = { r: rr, len: r.range(20, 24), clr: 0.3, headS: 0.5, arch: 0.75, neckW: 0.6, chest: 0.9, rump: 0.95, footL: 0.45, neckAng: -0.2, neckLen: 0.45, legW: 0.3, tailA: PI - 0.25 };
    return {
      chassis: walk(r, B, { face: r.range(0.1, 0.4), b0: 0.0, b1: 0.72, gait: r.pick(['walk', 'stand', 'trot']) }),
      head: head({ skull: 0.9, snoutLen: r.range(2.0, 2.4), tipR: 0.2, mid: 0.6, droop: 0.05, eyeR: 0.14, eyeX: 0.6, earX: -0.1 }),
      crown: ear('long', r.range(1.5, 1.9), 0.7, { lean: r.range(-0.1, 0.3), farLean: -0.25 }),
      dorsal: { type: 'mammalShell', h: r.range(0.3, 0.4), bands: r.int(3, 5) },
      tail: { len: r.range(6.5, 8.5), w0: 0.55, mid: 0.4, w1: 0.08, curl: 0.3, wave: 0.5, freq: 0.6, up: false, tip: 'point' },
    };
  }),

  sp('opossum', 1.8, r => {
    const B = { r: r.range(9.5, 11), len: r.range(22, 27), clr: 0.35, headS: 0.72, arch: 0.5, footL: 0.6, neckAng: 0.15, neckLen: 0.2 };
    return {
      chassis: walk(r, B, { gait: r.pick(['walk', 'stand']), b0: 0.1, b1: 0.75 }),
      head: head({ snoutLen: r.range(1.9, 2.2), tipR: 0.18, mid: 0.62, droop: 0.06, nose: 0.15, eyeR: 0.13, whiskers: r.chance(0.4) ? 2 : 0 }),
      crown: ear('round', 0.75, 0.8, { lean: 0.1 }),
      dorsal: r.chance(0.5) ? { type: 'mammalBabies', n: r.int(1, 2), size: r.range(0.5, 0.6) } : none(),
      tail: { len: r.range(9, 12), w0: 0.34, mid: 0.4, w1: 0.1, curl: r.range(2.6, 3.6), wave: 0, up: true, spiral: true, tip: 'point' },
    };
  }),

  sp('bushbaby', 2, r => {
    const cling = r.chance(0.5), rr = r.range(8, 9.5);
    const B = { r: rr, len: 18, clr: 0.3, headS: 0.95, sitH: r.range(11, 14), sitFoot: 1.3, sitHaunch: 1.1, upShoulder: 0.78 };
    const ch = cling ? { type: 'mammalClimb', r: rr * 0.9, len: rr * 1.5, stalkH: r.range(58, 70), stalkR: r.range(2.2, 3), bendX: r.range(-0.08, 0.12), top: 'branch', at: r.range(0.45, 0.6), turn: r.range(0.7, 1.2), face: r.range(-0.2, 0.2), headS: 0.95, fold: r.range(1.5, 1.9), hug: 0.85, tailA: PI / 2 + r.range(-0.2, 0.3) }
      : sit(r, B, r.pick(['hang', 'hold']), { item: 'berry', lean: r.range(0.2, 0.4), tailA: PI - 0.1 });
    return {
      chassis: ch, head: head({ snoutLen: r.range(0.62, 0.8), tipR: 0.3, mid: 0.45, droop: 0.2, eyeR: 0.3, eyeX: 0.35, eyeY: 0.2, nose: 0.12 }),
      crown: ear('long', r.range(1.6, 2.0), r.range(1.2, 1.4), { lean: r.range(-0.2, 0.2), farLean: -0.4 }),
      tail: tBrush({ pk: CLUB, pl: r.range(7, 9), pw: 0.7, ptarget: cling ? PI / 2 + 0.1 : PI - 0.05, precurve: r.range(0.4, 1.6), fluff: 2 }),
      surface: { eyes: 'dot', eyeS: 1.1 },
    };
  }),

  sp('tarsier', 1.5, r => {
    const rr = r.range(7.5, 8.8);
    return {
      chassis: { type: 'mammalClimb', r: rr, len: rr * 1.35, stalkH: r.range(58, 70), stalkR: r.range(2, 2.8), bendX: r.range(-0.1, 0.1), top: 'branch', at: r.range(0.5, 0.62), turn: r.range(0.8, 1.3), face: r.range(-0.15, 0.25), headS: 1.02, fold: r.range(1.7, 2.1), hug: 0.9, tailA: PI / 2 + r.range(-0.1, 0.25), legW: 0.26 },
      head: head({ snoutLen: 0.45, tipR: 0.38, mid: 0.5, droop: 0.25, eyeR: 0.36, eyeX: 0.3, eyeY: 0.15 }),
      crown: ear('round', 0.85, 0.75, { lean: 0.1 }),
      tail: { len: r.range(9, 11), w0: 0.14, mid: 0.5, w1: 0.1, curl: r.range(0, 0.5), wave: 0.5, freq: 0.6, up: r.chance(0.5), tip: 'mammalFlag', tipS: 0.5 },
      surface: { eyes: 'dot', eyeS: 1.1 },
    };
  }),

  sp('prairie dog', 2.5, r => {
    const marmot = r.chance(0.35);
    const B = { r: r.range(9.5, 11) * (marmot ? 1.1 : 1), len: r.range(20, 24), clr: 0.12, headS: r.range(0.68, 0.76), arch: 0.5, neckW: 0.9, chest: 0.98, footL: 0.6, standH: r.range(22, 28), upShoulder: 0.8, upNeck: 0.72, neckAng: 0.2, neckLen: 0 };
    const pose = r.wpick([[4, 'sentinel'], [1.5, 'walk'], [1, 'hold']]);
    const ch = { sentinel: () => stand(r, B, { lean: r.range(-0.03, 0.12), face: r.range(-0.3, 0.1) }), walk: () => walk(r, B, { gait: r.pick(['stand', 'walk']) }), hold: () => sit(r, B, 'hold', { item: 'sprig', sitH: 17, lean: 0.25 }) }[pose]();
    return {
      chassis: ch, head: head({ snoutLen: r.range(0.85, 1), tipR: 0.44, mid: 0.5, droop: 0.12, eyeR: 0.15, eyeX: 0.4, eyeY: 0.4 }),
      crown: ear('round', 0.32, 0.5, { lean: 0.7 }),
      tail: marmot ? tBrush({ pk: CLUB, pl: 3.6, pw: 0.85, ptarget: PI, precurve: 0.3, fluff: 2 }) : { len: r.range(3, 4.2), w0: 0.34, mid: 0.4, w1: 0.2, curl: 0.4, wave: 0.4, up: r.chance(0.5), tip: 'point' },
    };
  }),

  sp('beaver', 2, r => {
    const B = { r: r.range(11, 12.5), len: r.range(19, 23), clr: 0.1, headS: 0.68, arch: 0.75, neckW: 0.88, chest: 0.92, rump: 1, footL: 0.8, neckAng: 0.1, neckLen: 0, sitH: 17, upShoulder: 0.8, upNeck: 0.75, sitHaunch: 1.1 };
    const up = r.chance(0.45);
    return {
      chassis: up ? sit(r, B, 'hold', { item: 'stick', lean: r.range(0.2, 0.4) }) : walk(r, B, { gait: r.pick(['stand', 'walk']) }),
      head: head({ skullL: 1.05, snoutLen: 0.95, tipR: 0.52, mid: 0.5, droop: 0.15, eyeR: 0.13, eyeX: 0.5, carry: !up && r.chance(0.4) ? 'stick' : null }),
      crown: ear('round', 0.36, 0.5, { lean: 0.6 }),
      tail: { len: 0.4, w0: 0.5, mid: 0.5, w1: 0.4, curl: 0, wave: 0, tip: 'mammalPaddle', tipS: r.range(1.15, 1.4), padA: r.range(-0.12, 0.02) },
    };
  }),

  sp('otter', 2.5, r => {
    const rr = r.range(7.5, 8.8);
    const B = { r: rr, len: r.range(28, 34), clr: 0.3, headS: 0.8, arch: r.range(0.5, 1.1), neckW: 0.8, neckLen: 0.5, neckAng: r.range(0.3, 0.7), footL: 0.7, legW: 0.36, standH: r.range(30, 36), upShoulder: 0.84, upNeck: 0.76, standHaunch: 1.08, tailA: PI - 0.15 };
    const pose = r.wpick([[2, 'float'], [2, 'stand'], [2, 'walk']]);
    const ch = { float: () => ({ type: 'mammalFloat', r: rr * 1.05, len: r.range(19, 23), raise: r.range(0.5, 0.95), face: -r.range(0.2, 0.6), item: r.pick(['shell', 'nut', 'shell']), headS: 0.76 }), stand: () => stand(r, B, { lean: r.range(0, 0.2), tailA: PI - 0.1 }), walk: () => walk(r, B) }[pose]();
    return {
      chassis: ch, head: head({ skullL: 1.1, skullH: 0.92, snoutLen: r.range(0.85, 1), tipR: 0.46, mid: 0.5, droop: 0.1, eyeR: 0.13, eyeX: 0.5, nose: 0.13, whiskers: r.chance(0.5) ? 2 : 0, whiskerL: 0.75 }),
      crown: pose === 'float' ? none() : ear('round', 0.34, 0.45, { lean: 0.7 }),
      tail: { len: r.range(7.5, 10), w0: 0.85, mid: 0.4, w1: 0.12, curl: r.range(0.1, 0.5), wave: r.range(0.2, 0.7), freq: 0.6, up: pose === 'float' ? r.chance(0.6) : false, tip: 'point' },
    };
  }),

  sp('porcupine', 2, r => {
    const B = { r: r.range(10.5, 12), len: r.range(18, 22), clr: 0.22, headS: 0.66, arch: 0.7, neckW: 0.85, chest: 0.92, rump: 0.95, footL: 0.5, neckAng: -0.05, neckLen: 0.1 };
    return {
      chassis: walk(r, B, { gait: r.pick(['walk', 'stand']), face: r.range(0, 0.25), b0: 0, b1: 0.78 }),
      head: head({ snoutLen: 0.95, tipR: 0.48, mid: 0.5, droop: 0.15, eyeR: 0.13, eyeX: 0.5 }),
      crown: ear('round', 0.3, 0.45, { lean: 0.6 }),
      dorsal: { type: 'mammalQuills', n: r.int(13, 17), len: r.range(1.2, 1.7), wid: r.range(0.13, 0.16), lean: r.range(0.75, 0.95), rear: true },
      tail: none(),
    };
  }),

  sp('skunk', 2, r => {
    const B = { r: r.range(9.5, 11), len: r.range(20, 24), clr: 0.22, headS: 0.64, arch: 0.6, neckW: 0.78, footL: 0.55, neckAng: 0.0, neckLen: 0.2, tailA: -PI / 2 - 0.7 };
    return {
      chassis: r.chance(0.75) ? walk(r, B, { face: r.range(0.05, 0.3) }) : sniff(r, B, { pitch: 0.1, neckAng: 0.5, face: -0.4, tailA: -PI / 2 - 0.7 }),
      head: head({ snoutLen: r.range(1.4, 1.65), tipR: 0.2, mid: 0.55, droop: 0.1, nose: 0.14, eyeR: 0.12 }),
      crown: ear('round', 0.4, 0.5, { lean: 0.5 }),
      tail: tBrush({ pk: BOTTLE, pl: r.range(6.5, 8), pw: r.range(1.25, 1.55), ptarget: -PI / 2 + r.range(-0.2, 0.3), precurve: r.pick([-1, 1]) * r.range(0.9, 1.6), fluff: 4 }),
    };
  }),

  sp('badger', 2, r => {
    const B = { r: r.range(12, 13.5), len: r.range(22, 26), clr: r.range(0.55, 0.7), headS: 0.62, arch: 0.08, neckW: 0.8, chest: 1.05, rump: 0.9, footL: 0.9, neckAng: -0.35, neckLen: 0.2, legW: 0.5, pawS: 1.5 };
    return {
      chassis: r.chance(0.6) ? walk(r, B, { face: r.range(0.25, 0.5), gait: r.pick(['walk', 'stand']) }) : sniff(r, B, { pitch: -0.05, neckAng: 0.6, face: -0.2 }),
      head: head({ skull: 0.95, skullL: 1.1, snoutLen: r.range(1.7, 2), tipR: 0.24, mid: 0.5, droop: 0.1, nose: 0.17, eyeR: 0.12, eyeX: 0.55 }),
      crown: ear('round', 0.42, 0.55, { lean: 0.5 }),
      tail: tBrush({ pk: CLUB, pl: r.range(2.6, 3.4), pw: 0.75, ptarget: PI - 0.2, precurve: 0.2, fluff: 2 }),
      dorsal: r.chance(0.3) ? { type: 'fur', n: r.int(8, 11), len: 0.3 } : none(),
    };
  }),

  sp('raccoon', 2, r => {
    const B = { r: r.range(10, 11.5), len: r.range(19, 23), clr: 0.4, headS: 0.72, arch: r.range(0.7, 1.1), neckW: 0.8, footL: 0.7, neckAng: 0.0, neckLen: 0.2, legW: 0.34, standH: 22, sitH: 16, upShoulder: 0.8, upNeck: 0.72, tailA: PI - 0.1 };
    const pose = r.wpick([[3, 'walk'], [1.5, 'stand'], [1.5, 'hold']]);
    const ch = { walk: () => walk(r, B, { arch: r.range(1.0, 1.4), pitch: -r.range(0.08, 0.2), neckAng: -0.1, face: r.range(0.1, 0.35) }), stand: () => stand(r, B, { lean: r.range(0.05, 0.25) }), hold: () => sit(r, B, 'hold', { item: r.pick(['nut', 'berry', 'shell']) }) }[pose]();
    return {
      chassis: ch, head: head({ skullL: 1.08, snoutLen: r.range(1.2, 1.4), tipR: 0.22, mid: 0.45, droop: 0.12, nose: 0.15, eyeR: 0.13, cheek: 0.55 }),
      crown: ear('point', r.range(0.85, 1.05), 0.8, { lean: 0 }),
      tail: tBrush({ pk: [[0, 0.45], [0.4, 0.75], [0.85, 0.7], [1, 0.4]], pl: r.range(5, 6.2), pw: 0.95, ptarget: PI - r.range(0.05, 0.3), precurve: r.range(0.2, 1.2), fluff: 0, bands: 5 }),
    };
  }),

  sp('red panda', 1.5, r => {
    const B = { r: r.range(10, 11.5), len: r.range(20, 24), clr: 0.3, headS: 0.8, arch: 0.45, neckW: 0.85, footL: 0.65, neckAng: 0.15, neckLen: 0.1, legW: 0.4, standH: 23, upShoulder: 0.82, upNeck: 0.74, tailA: PI - 0.1 };
    const stand2 = r.chance(0.3);
    return {
      chassis: stand2 ? stand(r, B, { lean: r.range(0, 0.15), arms: 'hang' }) : walk(r, B),
      head: head({ skullL: 1.05, snoutLen: 0.9, tipR: 0.34, mid: 0.4, droop: 0.15, nose: 0.14, eyeR: 0.13, cheek: 0.7 }),
      crown: ear('point', r.range(1, 1.2), 1, { lean: 0.05 }),
      tail: tBrush({ pk: [[0, 0.45], [0.35, 0.8], [0.85, 0.75], [1, 0.4]], pl: r.range(6.5, 8), pw: 1.05, ptarget: PI - r.range(0, 0.25), precurve: r.range(0.1, 0.9), fluff: 0, bands: r.pick([4, 5]) }),
    };
  }),

  sp('fennec fox', 2.5, r => {
    const B = { r: r.range(8, 9.2), len: r.range(21, 25), clr: r.range(0.8, 1.05), headS: 0.82, arch: 0.3, neckW: 0.68, chest: 0.9, rump: 0.9, footL: 0.6, neckAng: 0.75, neckLen: 0.45, legW: 0.26, sitH: 18, sitFoot: 0.8, upShoulder: 0.7, upNeck: 0.58, haunch: 0.95 };
    const pose = r.wpick([[3, 'sit'], [2.5, 'walk'], [1, 'sniff']]);
    const ch = { sit: () => sit(r, B, 'down', { lean: r.range(0.3, 0.45), armX: 0.1, tailA: PI + 0.1 }), walk: () => walk(r, B, { gait: r.pick(['walk', 'trot', 'stand']), tailA: PI - 0.35 }), sniff: () => sniff(r, B, { pitch: r.range(0.05, 0.15), neckAng: 0.2, face: r.range(0.5, 0.8), tailA: PI - 0.2 }) }[pose]();
    return {
      chassis: ch, head: head({ snoutLen: r.range(1.45, 1.7), tipR: 0.14, mid: 0.68, droop: 0.1, nose: 0.15, eyeR: 0.14, eyeX: 0.35, earX: -0.25 }),
      crown: ear('point', r.range(2.5, 3.2), r.range(1.4, 1.7), { lean: r.range(-0.15, 0.2), farLean: -0.3 }),
      tail: tBrush({ pk: FOX, pl: r.range(5.5, 6.8), pw: r.range(0.95, 1.1), ptarget: pose === 'sit' ? PI - 0.1 : PI - r.range(0.2, 0.6), precurve: r.range(0.2, 1), fluff: 2 }),
    };
  }),
];

export default {
  id: 'mammal', label: 'Small mammals', short: 'Small mammals',
  sig: { crown: 3, tail: 2.5, head: 2, dorsal: 1 },
  species,
};
