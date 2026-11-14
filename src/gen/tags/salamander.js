// Salamanders (order Caudata): species library.
//
// Shape vocabulary registered here (all prefixed `salamander`):
//   chassis.salamanderTop   top-view body on a free centreline (walk wave, tight S, C curl,
//                           look-back, ring, eel); four limbs, forelimbs only, or none
//   chassis.salamanderSide  side-view body (walk, alert, tall stance, unken arch, swimming)
//   heads.salamanderHead    top view: wedge / blunt / spatulate head with eye bulges, parotoids,
//                           cranial ridges; side view: flat wedge with eye bump and throat
//   feet.salamanderHand / salamanderFoot   four / five round-tipped toes, optional webbing;
//                           a flat forward-fanned foot when standing on the ground in side view
//   tips.salamanderTail     the whole tail (drawn from the tail socket): round, keeled, finned,
//                           jagged-finned, filament-tipped, coiled, raised
//   crowns.salamanderGills  external gills: plume (axolotl), bush (mudpuppy), ray (larva, olm)
//   dorsals.salamanderCrest newt crest / larval fin (side), skin folds (top)
//   dorsals.salamanderWarts rib-tip and glandular warts
import { add, lerp, dist, angOf, polar, angDiff, clamp, mix, MINW, frame, spline, polyline, profile, pathAt, tube } from '../core.js';
import { chassis, heads, feet, tips, crowns, dorsals } from '../parts.js';

const PI = Math.PI, TAU = 2 * PI;
const sm = (a, b, x) => { const t = clamp((x - a) / ((b - a) || 1), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------
// Outline of a strip with different radii on the left (ang + 90deg) and right of the path.
function ribbon(path, RL, RR) {
  const n = path.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = angOf(path[Math.max(i - 1, 0)], path[Math.min(i + 1, n - 1)]);
    L.push(polar(path[i], a + PI / 2, RL[i]));
    R.push(polar(path[i], a - PI / 2, RR[i]));
  }
  return L.concat(R.reverse());
}

// Integrate a heading along a path. kap(u) = d(heading)/du; the turn per step is capped so the
// inside of a bend never folds tighter than the tube radius allows (no kinks, no blobs).
function walk(p0, h0, len, n, kap, radAt) {
  const pts = [p0], hs = [h0]; let h = h0, p = p0;
  const step = len / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const cap = radAt ? step / (1.4 * radAt(u) + 1.2) : 9;
    h += clamp(kap(u, h, p) / n, -cap, cap);
    p = polar(p, h, step);
    pts.push(p); hs.push(h);
  }
  return { pts, hs };
}

// true when a tube (pts, R) neither crosses itself nor touches any obstacle circle
function isClear(pts, R, obst, gap = 1.5) {
  const arc = [0];
  for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + dist(pts[i], pts[i - 1]));
  for (let i = 0; i < pts.length; i++) {
    for (const o of obst) { if (o.from != null && i < o.from * (pts.length - 1)) continue; if (dist(pts[i], o.p) < R[i] + o.r + gap) return false; }
    for (let j = 0; j < i; j++) {
      if (arc[i] - arc[j] < 4 * (R[i] + R[j]) / 2 * 2 + 3) continue;
      if (dist(pts[i], pts[j]) < R[i] + R[j] + gap) return false;
    }
  }
  return true;
}

function strip(path, rad, t0, t1, n, sideSign) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = mix(t0, t1, i / (n - 1)), { p, ang } = pathAt(path, t), na = ang + sideSign * PI / 2;
    out.push({ p: polar(p, na, rad(t) * 0.85), dir: na, t });
  }
  return out;
}

// ---------------------------------------------------------------------
// CHASSIS: top view
// ---------------------------------------------------------------------
chassis.salamanderTop = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, P = g.pose ?? {};
  const ph = P.ph ?? rng.range(0, TAU), f = P.freq ?? 1;
  const prof = (g.prof ?? [[0, 0.7], [0.2, 0.95], [0.5, g.belly ?? 1], [0.8, 0.9], [1, g.neckW ?? 0.72]]).map(([t, k]) => [t, k * r]);
  const rad = profile(prof);
  const N = 40;
  let path, kap, amp = 1;
  for (let tries = 0; tries < 7; tries++) {
    const a = amp;
    kap = t => a * ((P.wave ?? 3) * Math.cos(ph + TAU * f * t) + (P.curl ?? 0))
      + (P.look ?? 0) * (t > 0.58 && t < 1 ? 6 * ((t - 0.58) / 0.42) * (1 - (t - 0.58) / 0.42) / 0.42 : 0);
    path = walk([0, 0], 0, L, N, kap, rad).pts;
    if (isClear(path, path.map((_, i) => rad(i / N)), [], 2)) break;
    amp *= 0.8;
  }
  // put the tail-to-neck chord on the x axis, head toward +x
  const ca = angOf(path[0], path[N]), cs = Math.cos(-ca), sn = Math.sin(-ca), mx = (path[0][0] + path[N][0]) / 2, my = (path[0][1] + path[N][1]) / 2;
  path = path.map(([x, y]) => [(x - mx) * cs - (y - my) * sn, (x - mx) * sn + (y - my) * cs]);
  ink.poly(tube(path, rad));

  const limbs = [], obst = [];
  const e = pathAt(path, 1), b = pathAt(path, 0);
  const face = e.ang + (P.headTurn ?? 0), hs = rad(1) / 0.74 * (g.headS ?? 1);
  const bendMid = clamp(kap(0.5) / 3, -1, 1), gait = g.gait ?? 0.4;
  const want = g.limbs ?? 'four', ls = r * (g.limbS ?? 1.1);
  // Where will the limb land? (limb() bends the lower leg toward the front for forelimbs and
  // toward the back for hindlimbs.) A leg whose elbow, foot or toes come back onto the body
  // encloses a white hole; turn it out until it is clear.
  const LL = (g.legLen ?? 2.1) * ls, BB = g.legBend ?? 0.9, TL = 0.75 * ls;
  const body = path.map((q, i) => ({ q, t: i / N, R: rad(i / N) }));
  // the tail is drawn later; its base continues the trunk backward
  for (let j = 1; j <= 7; j++) body.push({ q: polar(path[0], angOf(path[1], path[0]), j * r * 0.55), t: -0.2, R: rad(0) * (1 - j * 0.07) });
  const headC = polar(e.p, face, hs * 0.7), headR = hs * 1.25;
  // external gills (drawn later as a crown) sweep back from the sides of the head: keep the
  // forelimbs out of them too
  const gillZone = [];
  if (g.gill) for (const sd of [-1, 1]) {
    const m0 = polar(e.p, face + sd * PI / 2, hs * 0.75);
    for (let i = 0; i < 3; i++) for (const u of [0.45, 0.8, 1]) gillZone.push({ p: polar(m0, face + sd * (1.3 + g.gill.fan[i] + g.gill.bend * u * 0.6), g.gill.len * hs * u * 0.95), r: hs * (0.25 + (g.gill.fl ?? 0.2)) });
  }
  const legPts = (p0, dir, fwd, role) => {
    const bs = (Math.sign(angDiff(fwd, dir)) || 1) * (role === 'hind' ? -1 : 1);
    const knee = polar(p0, dir, LL / 2), fa = dir + bs * BB;
    return { knee, fa, foot: polar(knee, fa, LL / 2) };
  };
  const clearance = (p0, dir, fwd, role, t) => {
    const { knee, fa, foot } = legPts(p0, dir, fwd, role);
    let m = Infinity;
    for (const x of [lerp(p0, knee, 0.75), knee, lerp(knee, foot, 0.5), foot, polar(foot, fa, TL), polar(foot, fa + 0.95, TL * 0.85), polar(foot, fa - 0.95, TL * 0.85)]) {
      for (const B of body) if (Math.abs(B.t - t) > 0.07) m = Math.min(m, dist(x, B.q) - B.R);
      if (role === 'fore') { m = Math.min(m, dist(x, headC) - headR); for (const G of gillZone) m = Math.min(m, dist(x, G.p) - G.r); }
    }
    return m;
  };
  const clearDir = (p0, dir, fwd, role, t) => {
    const need = ls * 0.42 + 1;
    if (clearance(p0, dir, fwd, role, t) > need) return dir;
    let best = dir, bm = -Infinity;
    for (let k = 1; k <= 9; k++) for (const sg of [1, -1]) {
      const d2 = dir + sg * k * 0.12, m = clearance(p0, d2, fwd, role, t);
      if (m > need) return d2;
      if (m > bm) { bm = m; best = d2; }
    }
    return best;
  };
  const pairs = [];
  if (want !== 'none') pairs.push([g.tF ?? 0.86, 'fore', -0.45]);
  if (want === 'four') pairs.push([g.tH ?? 0.12, 'hind', 0.18]);
  for (const [t, role, tilt] of pairs) {
    const { p, ang } = pathAt(path, t);
    for (const sd of [-1, 1]) {
      // on the concave flank the fore limb reaches back and the hind limb forward (the salamander trot)
      const tl = tilt + gait * bendMid * sd * (role === 'fore' ? 1 : -1) + rng.range(-0.12, 0.12);
      let dir = ang + sd * (PI / 2 + tl);
      // a forelimb never reaches along a turned head (it would trap a white sliver against it)
      if (role === 'fore' && sd * angDiff(dir, face) < 1.2) dir = face + sd * 1.2;
      const sp0 = polar(p, ang + sd * PI / 2, rad(t) * 0.5);
      dir = clearDir(sp0, dir, ang, role, t);
      const sock = { p: sp0, dir, s: ls, role, fwd: ang, side: sd };
      limbs.push(sock);
      obst.push({ p: polar(sock.p, sock.dir, ls * 1.5), r: ls * 0.9, from: role === 'hind' ? 0.3 : 0 });
      // the tail must also keep off the (predicted) lower leg and foot
      const lp = legPts(sp0, dir, ang, role);
      obst.push({ p: lerp(lp.knee, lp.foot, 0.5), r: ls * 0.45 }, { p: polar(lp.foot, lp.fa, TL * 0.4), r: TL * 0.75 });
    }
  }
  obst.push({ p: polar(e.p, face, hs * 0.9), r: hs * 1.15 });
  return {
    view: 'top', r, path, rad,
    head: { p: e.p, dir: e.ang, face, s: hs, sym: true },
    tail: { p: b.p, dir: b.ang + PI, s: rad(0) * (g.tailS ?? 1), wavePhase: ph, sal: { kap, L, obst } },
    limbs,
    back: [strip(path, rad, g.backT0 ?? 0.2, g.backT1 ?? 0.78, 12, -1), strip(path, rad, g.backT0 ?? 0.2, g.backT1 ?? 0.78, 12, 1)],
  };
};

// ---------------------------------------------------------------------
// CHASSIS: side view
// ---------------------------------------------------------------------
chassis.salamanderSide = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, P = g.pose ?? {};
  const swim = !!P.swim;
  const belly = g.belly ?? 1, lift = swim ? 0 : clamp(C.lift, 0.05, 1.3) * r * (P.liftK ?? 2.9);
  const y0 = swim ? -r * (P.depth ?? 2.1) : -(lift + r * 0.9);
  const hip = [-L / 2, y0 - (P.hipRise ?? 0) * r], sh = [L / 2, y0 - (P.rise ?? 0) * r];
  let mid = add(lerp(hip, sh, 0.5), [0, ((P.sag ?? 0) - (P.arch ?? 0.08)) * r]);
  if (!swim) mid[1] = Math.min(mid[1], -(belly * r + 0.4));
  const neckA = -(P.neck ?? 0.3), neckEnd = polar(sh, neckA, (g.neckLen ?? 0.95) * r);
  const tb = polar(hip, PI + (P.tailBase ?? 0.05), r * 1.0);
  if (swim) { const w = (P.wave ?? 0.3) * r; mid = add(mid, [0, w]); hip[1] -= w * 0.6; tb[1] += w * 0.2; }
  const path = spline([tb, hip, mid, sh, neckEnd], 8);
  const rad = profile((g.prof ?? [[0, 0.62], [0.25, 0.94], [0.5, belly], [0.75, 0.9], [1, g.neckW ?? 0.66]]).map(([t, k]) => [t, k * r]));
  ink.poly(tube(path, rad));
  const limbs = [], ls = r * (g.limbS ?? 1.0), st = (g.gait ?? 0.55) * r * rng.sign();
  const want = g.limbs ?? 'four';
  const mk = (base, dx, role, far) => {
    if (swim) limbs.push({ p: add(base, [dx, r * 0.55]), dir: PI - (role === 'fore' ? 1.0 : 0.6) + rng.range(-0.12, 0.12), s: ls * 0.9, role, far, fwd: role === 'fore' ? -PI / 2 : PI / 2, side: 1 }); // lower legs fold back
    else limbs.push({ p: add(base, [dx, r * 0.55]), dir: PI / 2, s: ls, role, far, ground: 0, fwd: 0, side: 1 });
  };
  // swimming: limbs folded back along the flank, near side only (a far leg would cross it)
  if (want !== 'none' && swim) { mk(sh, -r * 0.2, 'fore', false); if (want === 'four') mk(hip, r * 0.1, 'hind', false); }
  else if (want !== 'none') {
    // near and far leg of a pair stand a full foot-length apart (diagonal gait), so toes never
    // touch the other foot and close a white hole under the belly
    const D = ls * rng.range(1.6, 1.8), sg = rng.sign();
    mk(sh, -0.25 * r + sg * D / 2, 'fore', true); if (want === 'four') mk(hip, 0.15 * r - sg * D / 2, 'hind', true);
    mk(sh, -0.25 * r - sg * D / 2, 'fore', false); if (want === 'four') mk(hip, 0.15 * r + sg * D / 2, 'hind', false);
  }
  const b = pathAt(path, 0);
  return {
    view: 'side', r, path, rad,
    head: { p: neckEnd, dir: neckA, face: neckA * (P.faceK ?? 0.35) - (P.face ?? 0), s: rad(1) / 0.74 * (g.headS ?? 1), sym: false },
    tail: { p: tb, dir: b.ang + PI, s: rad(0) * (g.tailS ?? 1), sal: { up: P.tailUp ?? false, swim } },
    limbs, back: [strip(path, rad, g.backT0 ?? 0, g.backT1 ?? 0.9, 16, -1)],
  };
};

// ---------------------------------------------------------------------
// HEAD
// ---------------------------------------------------------------------
heads.salamanderHead = (C, sock, g) => {
  const { ink } = C, s = sock.s;
  if (sock.sym) {
    const F = frame(sock.p, sock.face, s, 1);
    ink.dot(sock.p, s * 0.74);
    // wid is relative to the neck; 0.84 keeps a typical head just narrower than the trunk
    const x0 = -0.4, len = g.len * 1.22, wid = g.wid * 0.84, jx = g.jawX ?? len * 0.3, nw = g.neckW ?? 0.72, p = g.p ?? 2.2, q = g.q ?? 2;
    const W = x => x <= jx ? mix(nw, wid, sm(x0, jx, x)) : wid * Math.pow(Math.max(1 - Math.pow((x - jx) / (len - jx), p), 0), 1 / q);
    const up = [], dn = [], N = 26;
    for (let i = 0; i <= N; i++) { const x = mix(x0, len, 1 - Math.pow(1 - i / N, 1.7)); up.push(F(x, -W(x))); dn.push(F(x, W(x))); }
    ink.poly(up.concat(dn.reverse()));
    const eyes = [], mounts = [], ex = g.eyeX ?? jx + (len - jx) * 0.3, eye = g.eye ?? 0.2;
    for (const sd of [-1, 1]) {
      if (eye > 0.02) ink.dot(F(ex, sd * (W(ex) - eye * (g.eyeIn ?? 0.5))), eye * s);
      if (g.paro) ink.oval(F(g.paroX ?? -0.05, sd * wid * 0.74), s * 0.44 * g.paro, s * 0.2 * g.paro, sock.face + sd * 0.1);
      if (g.ridge) { ink.dot(F(jx - 0.05, sd * wid * 0.98), s * g.ridge); ink.dot(F(jx + (len - jx) * 0.42, sd * W(jx + (len - jx) * 0.42) * 0.98), s * g.ridge * 0.7); }
      eyes.push({ p: F(ex, sd * W(ex) * 0.58), r: s * 0.14 });
      mounts.push({ p: F(g.mountX ?? -0.05, sd * W(-0.05) * 0.92), dir: sock.face + sd * 1.3, flip: sd, s });
    }
    return { eyes, mounts, spots: [], tip: F(len, 0) };
  }
  // side view
  const c = polar(sock.p, sock.dir, s * 0.3), F = frame(c, sock.face, s, 1);
  ink.poly(tube(polyline([sock.p, c], 3), s * 0.74));
  const len = g.len * (g.sideLen ?? 1.05), topH = g.top ?? 0.62, jaw = g.jaw ?? 0.5, x0 = -0.55, xe = g.sideEyeX ?? 0.2, pt = g.pt ?? 1.7, dr = g.droop ?? 0.08;
  const yT = x => -topH * (x <= xe ? mix(0.92, 1, sm(x0, xe, x)) : Math.pow(Math.max(1 - Math.pow((x - xe) / (len - xe), pt), 0), 0.5));
  const yB = x => jaw * (x <= 0.1 ? 1 : Math.pow(Math.max(1 - Math.pow((x - 0.1) / (len - 0.1), 2.6), 0), 0.5)) + (g.throat ?? 0.08) * Math.sin(PI * sm(x0, 0.7, x));
  const up = [], dn = [], N = 24;
  for (let i = 0; i <= N; i++) { const x = mix(x0, len, 1 - Math.pow(1 - i / N, 1.7)), d = dr * Math.max(x, 0); up.push(F(x, yT(x) + d)); dn.push(F(x, yB(x) + d)); }
  ink.poly(up.concat(dn.reverse()));
  const eye = g.eye ?? 0.2;
  if (eye > 0.02) ink.dot(F(xe + 0.12, -topH * 0.98 + eye * 0.45 + dr * xe), eye * s * 0.95);
  return {
    eyes: [{ p: F(xe + 0.12, -topH * 0.5), r: s * 0.15 }],
    mounts: [{ p: F(-0.3, -topH * 0.85), dir: sock.face - PI / 2 - 0.55, flip: -1, s }],
    spots: [], tip: F(len, dr * len),
  };
};

// ---------------------------------------------------------------------
// FEET: rounded toes, four in front and five behind
// ---------------------------------------------------------------------
function toesFoot(C, p, ang, s, g, k, n, web) {
  const { ink } = C, plan = C.plan;
  n = Math.max(1, n);
  const tl0 = (g.toeLen ?? 0.62) * s * k, tl = tl0;
  const tw = Math.max(s * 0.085 * k * (g.toeW ?? 1), MINW / 2);
  const back = Math.abs(angDiff(ang, PI)) < 0.4, fwdish = Math.abs(angDiff(ang, 0)) < 0.4;
  if (plan && plan.view === 'side' && (back || fwdish) && p[1] > -s * 0.7) {
    // standing foot seen from the side: flat sole, toes fanned forward and a little upward
    const dx = back ? -1 : 1, gy = Math.min(p[1] + s * 0.14 * k, 0), m = Math.min(n, 3), tl = tl0 * 0.75;
    const q = [p[0], gy - tw];
    const cl = pts => pts.map(([x, y]) => [x, Math.min(y, gy)]);
    for (let i = 0; i < m; i++) {
      const a = -(i * 0.42) * (web ? 0.6 : 1), tip = [q[0] + dx * Math.cos(a) * tl * (1 - 0.12 * i), q[1] + Math.sin(a) * tl * (1 - 0.12 * i)];
      ink.poly(cl(tube(polyline([q, tip], 3), tw)));
      ink.poly(cl(tube(polyline([tip, add(tip, [dx * 0.01, 0])], 1), Math.max(tw * 1.3, MINW * 0.6))));
    }
    if (web) ink.poly(cl([q, [q[0] + dx * tl * 0.95, gy], [q[0] + dx * Math.cos(-0.5) * tl * 0.85, q[1] + Math.sin(-0.5) * tl * 0.85]]));
    ink.poly(cl(tube(polyline([[p[0] - dx * s * 0.1 * k, gy - s * 0.13 * k], [p[0] + dx * s * 0.2 * k, gy - s * 0.1 * k]], 2), s * 0.13 * k)));
    return;
  }
  const spread = (g.spread ?? 1.75) * (n >= 5 ? 1.12 : n === 4 ? 1 : n === 3 ? 0.75 : 0.5);
  const tipsP = [];
  for (let i = 0; i < n; i++) {
    const v = n > 1 ? i / (n - 1) - 0.5 : 0;
    const a = ang + v * spread, len = tl * (0.72 + 0.28 * Math.cos(v * PI * 0.95));
    const tip = polar(p, a, len); tipsP.push(tip);
    // one polygon per toe: a slim digit ending in a round pad (cheaper than tube + dot)
    const tr = Math.max(tw * 1.32, MINW * 0.62);
    ink.poly(tube(polyline([lerp(p, tip, 0.1), tip], 2), [tw, tw * 1.05, tr]));
  }
  if (web && n > 1) ink.poly([p, ...tipsP.map(t => lerp(p, t, web))]);
  ink.dot(p, s * (g.palm ?? 0.17) * k);
}
feet.salamanderHand = (C, p, ang, s, g, k) => toesFoot(C, p, ang, s, g, k, g.toesF ?? 4, g.webF ?? 0);
feet.salamanderFoot = (C, p, ang, s, g, k) => toesFoot(C, p, ang, s, g, k, g.toesH ?? 5, g.webH ?? 0);

// ---------------------------------------------------------------------
// TAIL: drawn whole by a tail "tip", from the chassis tail socket
// ---------------------------------------------------------------------
// a tail lent to another tag's chassis: its length was set against a salamander body, so
// keep it to a long-but-plausible multiple of the host's body radius
const lentLen = (L, sal, plan) => sal ? L : Math.min(L, (plan.r || 8) * 3.2);

function tailTop(C, sock, T) {
  const { ink, rng } = C, s = sock.s, n = 34, sal = sock.sal, plan = C.plan;
  const Lt = lentLen(T.len * s, sal, plan);
  const comp = T.fin ? (T.topK ?? 0.72) : 1;
  const keys = T.keys ?? [[0, 1], [0.5, 0.58], [1, 0.07]];
  const rf0 = profile(keys.map(([u, k]) => [u, k * T.w0 * s]));
  const rf = u => Math.max(rf0(u) * mix(1, comp, sm(0, 0.3, u)), MINW / 2);
  const ph = rng.range(0, TAU), freq = T.freq ?? 1;
  // obstacles: the body, the head and the limbs (own chassis lists them; otherwise use the plan)
  const obst = sal?.obst ? sal.obst.slice() : [];
  if (!sal?.obst && plan.head) obst.push({ p: plan.head.p, r: plan.head.s * 1.3 });
  if (plan.path && plan.rad) for (let i = 0; i <= 12; i++) { const t = 0.22 + 0.78 * i / 12; obst.push({ p: pathAt(plan.path, t).p, r: plan.rad(t), from: 0.25 }); }
  // an obstacle that already covers the tail root cannot be avoided by bending: ignore it
  for (let i = obst.length - 1; i >= 0; i--) if (obst[i].from == null && dist(obst[i].p, sock.p) < obst[i].r + rf(0) + 1.6) obst.splice(i, 1);
  let pts, R, k = 1, flip = 1;
  for (let tries = 0; tries < 10; tries++) {
    const kk = k, fl = flip;
    // later tries straighten the whole tail (body-wave follow-through included), so a tail that
    // cannot clear the legs ends up as a plain sweep rather than a loop that traps white
    const kf = Math.min(1, kk * 1.25);
    const kap = u => (sal?.kap ? -sal.kap(-u * Lt / sal.L) * (Lt / sal.L) * Math.pow(1 - u, 1.2) * (T.follow ?? 1) * kf : 0)
      + kk * fl * ((T.curl ?? 0) + (T.coil ?? 0) * 3 * u * u) + (T.wave ?? 0) * kf * Math.cos(ph + TAU * freq * u) * mix(0.6, 1.2, u);
    pts = walk(sock.p, sock.dir, Lt, n, kap, rf).pts;
    R = pts.map((_, i) => rf(i / n));
    if (isClear(pts, R, obst, 1.6)) break;
    k *= 0.72; if (tries === 3) { flip = -1; k = 0.8; }
  }
  ink.poly(tube(pts, R));
  if (T.fil) { const e = pts[n], a = angOf(pts[n - 2], e); ink.poly(tube(polyline([e, polar(e, a, T.fil * s)], 4), Math.max(MINW * 0.6, rf(1) * 0.45))); }
}

function tailSide(C, sock, T) {
  const { ink, rng } = C, s = sock.s, n = 34, sal = sock.sal, plan = C.plan;
  const Lt = lentLen(T.len * s * (T.sideLen ?? 1), sal, plan);
  const swim = !!sal?.swim, up = sal ? (sal.up || (!!T.up && !swim && sal.up !== false && false)) : !!T.up;
  const keys = T.keys ?? [[0, 1], [0.5, 0.58], [1, 0.07]];
  const rf0 = profile(keys.map(([u, k]) => [u, k * T.w0 * s]));
  const rf = u => Math.max(rf0(u), MINW / 2);
  const finT = (T.fin ?? 0) * s, finB = (T.finB ?? (T.fin ?? 0) * 0.55) * s;
  const fe = profile(T.finKeys ?? [[0, T.finBase ?? 0.5], [0.25, 1], [0.6, 0.85], [1, 0]]);
  const teeth = T.jag ? (T.teeth ?? 9) : 0;
  const tooth = u => { if (!teeth) return 1; const x = (u * teeth) % 1, v = x < 0.7 ? x / 0.7 : (1 - x) / 0.3; return 1 - T.jag * (1 - v); };
  const ph = rng.range(0, TAU), freq = T.freq ?? 1, floor = !plan.rooted || true;
  const curlUp = T.curlUp ?? 2.4;
  let kUp = 1, pts;
  for (let tries = 0; tries < 5; tries++) {
    const kap = (u, h) => {
      let k = (T.tipCurl ?? 0) * 3 * u * u;
      if (up) k += kUp * (curlUp + (T.coilUp ?? 0) * 3 * u * u) + (T.wave ?? 0) * 0.4 * Math.cos(ph + TAU * freq * u);
      else if (swim) k += 2.5 * angDiff(PI, h) + (T.swimWave ?? 4) * Math.cos(ph + TAU * 1.1 * u);
      else k += 3.2 * angDiff(PI - 0.55, h) + (T.wave ?? 0) * 0.6 * Math.cos(ph + TAU * freq * u);
      return k;
    };
    pts = [sock.p]; let h = sock.dir, p = sock.p;
    const step = Lt / n;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, cap = step / (1.4 * rf(u) + 1.2);
      h += clamp(kap(u, h) / n, -cap, cap);
      p = polar(p, h, step);
      const lim = -(rf((i + 1) / n) + finB * fe((i + 1) / n) + 0.15);
      if (floor && p[1] > lim) { p = [p[0], lim]; if (!up) h += angDiff(PI, h) * 0.7; }
      pts.push(p);
    }
    if (!up) break;
    // a raised tail must not fall back into the body
    const obst = [];
    if (plan.path && plan.rad) for (let i = 0; i <= 10; i++) { const t = 0.2 + 0.8 * i / 10; obst.push({ p: pathAt(plan.path, t).p, r: plan.rad(t) + finT, from: 0.25 }); }
    if (plan.head) obst.push({ p: plan.head.p, r: plan.head.s * 1.5 });
    if (isClear(pts, pts.map((_, i) => rf(i / n) + finT * fe(i / n)), obst, 1.6)) break;
    kUp *= 0.75;
  }
  const RL = pts.map((_, i) => { const u = i / n; return rf(u) + finT * fe(u) * tooth(u); });
  const RR = pts.map((_, i) => { const u = i / n; return rf(u) + finB * fe(u); });
  // dorsal side stays dorsal: for a tail heading backward that is the left of the path
  ink.poly(ribbon(pts, RL, RR).map(([x, y]) => [x, Math.min(y, 0)]));
  ink.dot(pts[n], Math.max(rf(1), MINW / 2));
  if (T.fil) { const e = pts[n], a = angOf(pts[n - 2], e); ink.poly(tube(polyline([e, polar(e, a, T.fil * s)], 4), Math.max(MINW * 0.6, rf(1) * 0.45)).map(([x, y]) => [x, Math.min(y, 0)])); }
}

tips.salamanderTail = (C, e, ea, s, g) => {
  const sock = C.plan.tail, T = g.T;
  if (!sock || !T) return;
  if (C.plan.view === 'top') tailTop(C, sock, T); else tailSide(C, sock, T);
};

// ---------------------------------------------------------------------
// CROWN: external gills
// ---------------------------------------------------------------------
crowns.salamanderGills = (C, m, F, s, g) => {
  const { ink } = C, far = !!m.far, style = g.style ?? 'plume';
  const fan = g.fan ?? [-0.3, 0.38, 1.05], lens = [0.82, 1, 0.8];
  // top view: rami fan out from each side of the head (local frame of the mount).
  // side view: three rami rise from behind the head, from just forward of vertical to well
  // back, each curving backward; the far tuft shows only its two rear rami.
  const sideV = C.plan.view === 'side', SF = [0.35, -0.35, -1.05];
  const dirAt = (i, k) => sideV ? -PI / 2 + SF[i] - k - (far ? 0.3 : 0) : m.dir + m.flip * (fan[i] + k + (far ? 0.25 : 0));
  const Q = (i, k, d) => polar(m.p, dirAt(i, k), d * s);
  const web = [m.p];
  for (let i = far ? 1 : 0; i < 3; i++) {
    const len = g.len * lens[i] * (far ? 0.82 : 1) * (sideV ? 1.3 : 1), bend = g.bend ?? 0.45;
    const pts = spline([Q(i, 0, -0.2), Q(i, bend * 0.1, len * 0.4), Q(i, bend * 0.5, len * 0.75), Q(i, bend, len)], 6);
    const n = pts.length, w = Math.max(s * (g.w ?? 0.12), MINW * 0.55), fl = s * (g.fl ?? 0.3), nf = g.nf ?? 4;
    const core = u => Math.max(w * mix(1, 0.5, u), MINW * 0.45);
    const comb = u => fl * Math.sin(PI * Math.pow(u, 0.75)) ** 0.7 * (0.5 + 0.5 * Math.abs(Math.sin(PI * nf * u)));
    const A = [], B = [];
    for (let j = 0; j < n; j++) {
      const u = j / (n - 1);
      const back = style === 'ray' ? 0 : comb(u), front = style === 'bush' ? comb(1 - u) * 0.55 : 0;
      // the fringe hangs on the trailing side
      if (!sideV && m.flip > 0) { A.push(core(u) + back); B.push(core(u) + front); } else { A.push(core(u) + front); B.push(core(u) + back); }
    }
    ink.poly(ribbon(pts, A, B));
    ink.dot(pts[n - 1], core(1));
    web.push(pts[Math.round((n - 1) * 0.5)]);
  }
  // fill the crotches between the rami near the head: open fronds, never trapped white gaps
  ink.poly(web);
};

// ---------------------------------------------------------------------
// DORSAL: newt crest / larval fin (side view), skin folds (top view); warts
// ---------------------------------------------------------------------
dorsals.salamanderCrest = (C, plan, st, sd, si, g) => {
  const { ink } = C, r = plan.r, n = st.length, sideV = plan.view === 'side' && !plan.rooted;
  const h = r * (sideV ? g.h : (g.top ?? g.h * 0.3));
  if (h < 0.3) return;
  const teeth = g.jag ? (g.teeth ?? 9) : 0, M = Math.max(teeth * 6, 40);
  const env = sideV ? profile(g.env ?? [[0, g.rear ?? 0.55], [0.3, 1], [0.75, 0.9], [1, 0]]) : profile([[0, 0], [0.2, 1], [0.8, 1], [1, 0]]);
  const top = [], bot = [];
  for (let i = 0; i <= M; i++) {
    const u = i / M, x = u * (n - 1), a = Math.min(Math.floor(x), n - 2), f = x - a;
    const p = lerp(st[a].p, st[a + 1].p, f), dir = st[a].dir + angDiff(st[a + 1].dir, st[a].dir) * f;
    let k = env(u);
    if (teeth && sideV) { const xx = (u * teeth) % 1, v = xx < 0.3 ? xx / 0.3 : (1 - xx) / 0.7; k *= 1 - g.jag * (1 - v); }
    k *= 1 + (g.wave ?? 0) * Math.sin(u * (g.freq ?? 5) * TAU + si * 1.7);
    bot.push(polar(p, dir, -r * 0.3)); top.push(polar(p, dir, Math.max(h * k, 0)));
  }
  ink.poly(bot.concat(top.reverse()));
};

dorsals.salamanderWarts = (C, plan, st, sd, si, g, at) => {
  const { ink, rng } = C, r = plan.r, cnt = g.n;
  for (let i = 0; i < cnt; i++) {
    const u = (i + 0.5) / cnt, k = at(u), env = 0.75 + 0.25 * Math.sin(PI * u), b = r * g.size * env;
    const out = plan.rad ? plan.rad(k.t) * 0.15 : r * 0.15;
    ink.dot(polar(k.p, k.dir, out + b * (g.out ?? 0.1)), Math.max(b, MINW * 0.7));
  }
};

// =====================================================================
// SPECIES
// =====================================================================
const none = () => ({ type: 'none' });

function topPose(r, kind, k = 1) {
  const sg = r.sign(), ph = r.range(0, TAU);
  switch (kind) {
    case 'ess': return { kind, sg, ph, wave: r.range(5.5, 7.5) * k, freq: r.range(0.95, 1.3), curl: 0 };
    case 'curl': return { kind, sg, ph, wave: r.range(1, 2) * k, freq: r.range(0.7, 1), curl: sg * r.range(1.5, 2.3) };
    case 'ring': return { kind, sg, ph, wave: r.range(0.3, 0.9), freq: 0.8, curl: sg * r.range(2.6, 3.2) };
    case 'coil': return { kind, sg, ph, wave: r.range(2, 3.6) * k, freq: r.range(0.8, 1.1), curl: sg * r.range(0.2, 1) };
    case 'look': return { kind, sg, ph, wave: r.range(1.5, 3) * k, freq: r.range(0.8, 1), curl: -sg * r.range(0, 0.5), look: sg * r.range(1.3, 1.9), headTurn: sg * r.range(0.25, 0.55) };
    case 'eel': return { kind, sg, ph, wave: r.range(7, 10.5) * k, freq: r.range(1.5, 2.1), curl: r.range(-1, 1) };
    case 'eelcoil': return { kind, sg, ph, wave: r.range(3, 5) * k, freq: r.range(1.2, 1.6), curl: sg * r.range(2.6, 3.6) };
    default: return { kind: 'walk', sg, ph, wave: r.range(1.9, 3.3) * k, freq: r.range(0.8, 1.15), curl: r.range(-0.5, 0.5) };
  }
}
function sidePose(r, kind) {
  switch (kind) {
    case 'alert': return { kind, rise: r.range(0.45, 0.85), neck: r.range(0.55, 0.9), faceK: 0.3, arch: 0.05 };
    case 'tall': return { kind, liftK: 2.8, rise: r.range(0.1, 0.4), neck: r.range(0.3, 0.6), arch: r.range(0.2, 0.45), tailUp: true, tailBase: 0.5 };
    case 'unken': return { kind, liftK: 1.7, rise: r.range(0.5, 0.8), hipRise: r.range(0.3, 0.5), sag: 0.8, arch: 0, neck: r.range(1.0, 1.3), faceK: 0.75, tailUp: true, tailBase: 0.75 };
    case 'tailcurl': return { kind, rise: r.range(0, 0.25), neck: r.range(0.25, 0.5), arch: 0.1, tailUp: true, tailBase: 0.55 };
    case 'swim': return { kind, swim: true, depth: r.range(1.9, 2.4), wave: r.range(-0.35, 0.35), neck: r.range(-0.1, 0.35), rise: r.range(-0.2, 0.4), faceK: 0.6 };
    default: return { kind: 'walk', rise: r.range(0, 0.3), neck: r.range(0.15, 0.5), arch: r.range(0, 0.2), faceK: 0.35 };
  }
}

// tail gene: a stub for the shared tail tube plus the real description T
function tailG(r, pose, T) {
  const sg = pose.sg ?? r.sign(), top = {
    walk: { curl: r.sign() * r.range(0.3, 1.6), wave: r.range(1, 2.4) },
    ess: { curl: r.range(-0.6, 0.6), wave: r.range(1.6, 2.8) },
    curl: { curl: sg * r.range(1.2, 2.3), wave: r.range(0.4, 1.2) },
    ring: { curl: sg * r.range(2, 2.8), wave: 0.3 },
    coil: { curl: sg * r.range(1, 1.8), coil: sg * r.range(4, 6.5), wave: 0.5 },
    look: { curl: r.sign() * r.range(0.5, 1.8), wave: r.range(0.8, 1.8) },
    eel: { curl: r.range(-0.5, 0.5), wave: r.range(2, 3.4), freq: r.range(0.9, 1.3) },
    eelcoil: { curl: sg * r.range(0.5, 1.4), wave: r.range(1, 2) },
  }[pose.kind] ?? { curl: r.sign() * r.range(0.3, 1.6), wave: r.range(1, 2.4) };
  const side = { tipCurl: r.chance(0.5) ? r.range(0.4, 1.6) : 0, up: r.chance(0.3), curlUp: r.range(1.8, 3) };
  if (pose.kind === 'unken') Object.assign(side, { curlUp: r.range(1.7, 2.2), coilUp: r.range(0.3, 0.9), tipCurl: 0, keys: [[0, 0.7], [0.45, 0.4], [1, 0.06]] });
  if (pose.kind === 'tailcurl') Object.assign(side, { curlUp: r.range(1.9, 2.4), coilUp: r.range(0.6, 1.3), tipCurl: 0 });
  if (pose.kind === 'tall') Object.assign(side, { curlUp: r.range(1.2, 1.7), tipCurl: r.range(-2.2, -1.2) });
  const full = { w0: 1, freq: r.range(0.8, 1.3), ...top, ...side, ...T };
  if (side.keys) full.keys = side.keys; // a pose that needs a thinner tail wins over the species
  if (T.curlMax != null) full.curl = Math.max(-T.curlMax, Math.min(T.curlMax, full.curl ?? 0));
  if (T.curlK != null) { full.curl = (full.curl ?? 0) * T.curlK; full.coil = (full.coil ?? 0) * T.curlK; }
  return { len: 0.15, w0: 0.4, mid: 0.5, w1: 0.4, curl: 0, wave: 0, curlSign: 1, up: false, tip: 'salamanderTail', T: full };
}
// tail length as a fraction of snout-vent length
const tl = (frac, len, rr, k0 = 0.7) => frac * (len + 1.6 * rr) / (k0 * rr);

const legs = (r, o = {}) => ({ len: r.range(2.0, 2.3), w: 0.5, taper: 0.74, bend: r.range(0.7, 1.1), foot: 'salamanderFoot', foreFoot: 'salamanderHand', toeLen: 0.6, spread: 1.75, lift: 0.3, stance: 0.45, arm: 0.8, hind: 1.08, hindW: 1.12, ...o });
const headG = (r, o = {}) => ({ type: 'salamanderHead', len: r.range(1.25, 1.4), wid: r.range(0.98, 1.06), p: 2.2, eye: r.range(0.18, 0.22), ...o });
const gills = (r, o = {}) => ({ type: 'salamanderGills', pair: true, len: r.range(1.5, 2), style: 'plume', ...o });
const pick = (r, pairs) => r.wpick(pairs);
const isTop = k => !['walkS', 'alert', 'tall', 'unken', 'swim', 'tailcurl'].includes(k);

// Seen from the side a sprawling leg shows only its lower part: shorter, nearly straight legs
// angled fore-forward / hind-back read as walking; long bent ones merge into blocks.
const sideLegs = (L, top, d) => top ? L : { ...L, len: L.len * (d.sideLegK ?? 0.7), w: L.w * 0.78, stance: d.sideStance ?? 0.35 };

// One generic assembler: d describes the species; kind is the chosen pose.
function make(r, d, kinds) {
  const kind = pick(r, kinds), top = isTop(kind);
  const R = d.r, len = d.len;
  const pose = top ? topPose(r, kind, d.waveK ?? 1) : sidePose(r, kind === 'walkS' ? 'walk' : kind);
  if (d.poseFix) Object.assign(pose, d.poseFix(pose, top) ?? {});
  const k0 = (top ? d.prof : d.sideProf)?.[0][1] ?? (top ? 0.7 : 0.62);
  const LG = d.limbsG ?? legs(r);
  const ch = top
    ? { type: 'salamanderTop', len: len * (d.topLenK ?? 1.18), r: R, pose, belly: d.belly, neckW: d.neckW, prof: d.prof, headS: d.headS, limbs: d.limbs, tF: d.tF, tH: d.tH, limbS: d.limbS, gait: d.gait, backT0: d.backT0, backT1: d.backT1, legLen: LG.len, legBend: LG.bend, gill: d.crown?.type === 'salamanderGills' ? { len: d.crown.len, fan: d.crown.fan ?? [-0.3, 0.38, 1.05], bend: d.crown.bend ?? 0.45, fl: d.crown.style === 'ray' ? 0.1 : d.crown.fl } : null }
    : { type: 'salamanderSide', len: len * (d.sideLenK ?? 0.92), r: R * (d.sideR ?? 0.95), pose, belly: d.belly, neckW: d.sideNeckW, prof: d.sideProf, headS: d.headS, limbs: d.limbs, limbS: d.sideLimbS, neckLen: d.neckLen, backT0: d.backT0s, backT1: d.backT1s };
  const T = { len: tl(d.tail, top ? len * (d.topLenK ?? 1.18) : len, R, k0), ...(d.T ?? {}) };
  return {
    chassis: ch, head: d.head, limbs: sideLegs(LG, top, d), tail: tailG(r, pose, T),
    dorsal: (top ? d.dorsalTop : d.dorsalSide) ?? d.dorsal ?? none(), crown: d.crown ?? none(),
    surface: { eyes: 'none', spots: d.spots ?? 0, stripe: d.stripe ?? false },
  };
}

const species = [
  // ------------------------------------------------ true salamanders and mole salamanders
  { name: 'fire salamander', w: 5, genes: r => make(r, {
    r: r.range(7.2, 8.2), len: r.range(44, 52), belly: 1.06, neckW: 0.9, tail: r.range(0.62, 0.75),
    head: headG(r, { len: r.range(1.25, 1.4), wid: r.range(0.98, 1.04), p: 2.2, eye: 0.19, neckW: 0.8, paro: r.range(0.9, 1.1), top: 0.66 }),
    limbsG: legs(r, { w: 0.58, toeLen: 0.55 }), T: { keys: [[0, 1], [0.5, 0.66], [0.9, 0.3], [1, 0.16]] },
    spots: r.int(4, 7),
  }, [[3, 'walk'], [1.2, 'curl'], [1, 'look'], [1.6, 'walkS'], [0.8, 'alert']]) },

  { name: 'spotted salamander', w: 4, genes: r => make(r, {
    r: r.range(6.4, 7.2), len: r.range(42, 49), belly: 1.08, neckW: 0.86, tail: r.range(0.8, 0.95),
    head: headG(r, { len: r.range(1.2, 1.3), wid: r.range(0.98, 1.04), p: 2.5, eye: 0.2 }),
    limbsG: legs(r, { w: 0.55 }), T: { fin: 0.12, topK: 0.82, keys: [[0, 1], [0.5, 0.7], [1, 0.1]] },
    spots: r.int(5, 8),
  }, [[3, 'walk'], [1.5, 'ess'], [1, 'curl'], [1, 'look'], [1.5, 'walkS']]) },

  { name: 'tiger salamander', w: 4, genes: r => make(r, {
    r: r.range(7.6, 8.6), len: r.range(45, 52), belly: 1.1, neckW: 0.9, tail: r.range(0.72, 0.88),
    head: headG(r, { len: r.range(1.12, 1.22), wid: r.range(1.0, 1.06), p: 2.4, neckW: 0.82, eye: 0.16, eyeIn: 0.4, top: 0.7, jaw: 0.55 }),
    limbsG: legs(r, { w: 0.6, len: r.range(2.0, 2.2) }), T: { fin: 0.18, topK: 0.8, keys: [[0, 1], [0.5, 0.72], [1, 0.12]] },
  }, [[2.5, 'walk'], [1, 'curl'], [1, 'look'], [2, 'walkS'], [1.6, 'alert']]) },

  { name: 'mole salamander', w: 2, genes: r => make(r, {
    r: r.range(8, 9), len: r.range(37, 43), belly: 1.1, neckW: 0.88, tail: r.range(0.5, 0.62),
    head: headG(r, { len: r.range(1.25, 1.35), wid: r.range(0.92, 0.98), p: 2.0, eye: 0.17, neckW: 0.88 }),
    limbsG: legs(r, { w: 0.56, len: r.range(1.8, 2.0), toeLen: 0.5 }), T: { fin: 0.15, keys: [[0, 1], [0.5, 0.7], [1, 0.14]], curlK: 0.6 },
  }, [[3, 'walk'], [1, 'curl'], [2, 'walkS'], [1, 'alert']]) },

  // ------------------------------------------------ lungless salamanders
  { name: 'red-backed salamander', w: 4, genes: r => make(r, {
    r: r.range(4.2, 4.8), len: r.range(44, 50), belly: 1.02, neckW: 0.8, tail: r.range(0.85, 1.05), tF: 0.9, tH: 0.08,
    head: headG(r, { len: r.range(1.4, 1.55), wid: r.range(0.98, 1.05), p: 2.0, eye: 0.2 }),
    limbsG: legs(r, { len: r.range(1.7, 1.9), w: 0.44, toeLen: 0.5 }), T: { keys: [[0, 1], [0.55, 0.62], [1, 0.08]] },
    stripe: true,
  }, [[3, 'walk'], [2, 'ess'], [1.5, 'curl'], [1.2, 'coil'], [1, 'look']]) },

  { name: 'slender salamander', w: 3, genes: r => make(r, {
    r: r.range(3.6, 4.0), len: r.range(48, 58), belly: 1, neckW: 0.86, tail: r.range(1.1, 1.5), tF: 0.94, tH: 0.05, waveK: 1.25, limbS: 1.15,
    prof: [[0, 0.85], [0.3, 1], [0.7, 1], [1, 0.86]],
    head: headG(r, { len: r.range(1.5, 1.7), wid: r.range(1.0, 1.08), p: 2.1, eye: 0.2 }),
    limbsG: legs(r, { len: r.range(1.6, 1.85), w: 0.46, toeLen: 0.55, toesH: 4, bend: 0.6 }), T: { keys: [[0, 1], [0.6, 0.7], [1, 0.12]], curlMax: 0.5 },
    poseFix: p => ({ curl: Math.max(-0.6, Math.min(0.6, p.curl)) }),
  }, [[2.5, 'coil'], [2.5, 'ess'], [1.5, 'eel'], [1.5, 'walk']]) },

  { name: 'long-tailed salamander', w: 3, genes: r => make(r, {
    r: r.range(4.4, 5), len: r.range(38, 44), belly: 1.03, neckW: 0.82, tail: r.range(1.5, 1.8),
    head: headG(r, { len: r.range(1.35, 1.5), wid: r.range(1.05, 1.12), p: 2.1, eye: 0.24 }),
    limbsG: legs(r, { len: r.range(2.3, 2.6), w: 0.4, toeLen: 0.62 }), T: { keys: [[0, 1], [0.4, 0.62], [1, 0.06]], fin: 0.1, topK: 0.85, curlMax: 0.5 },
    poseFix: p => ({ curl: Math.max(-0.5, Math.min(0.5, p.curl)) }),
  }, [[3, 'walk'], [2, 'ess'], [1, 'look'], [1.5, 'coil']]) },

  { name: 'cave salamander', w: 3, genes: r => make(r, {
    r: r.range(4.5, 5.1), len: r.range(34, 39), belly: 1.02, neckW: 0.7, tail: r.range(1.25, 1.5), gait: 0.6,
    head: headG(r, { len: r.range(1.35, 1.5), wid: r.range(1.28, 1.4), p: 2.3, eye: r.range(0.28, 0.33), eyeIn: 0.42, jawX: 0.5 }),
    limbsG: legs(r, { len: r.range(2.7, 3.1), w: 0.36, toeLen: 0.72, spread: 1.95, bend: r.range(0.9, 1.3) }), T: { keys: [[0, 1], [0.4, 0.6], [1, 0.06]] },
  }, [[2.5, 'walk'], [2, 'coil'], [1.5, 'look'], [1.5, 'curl'], [1, 'ess']]) },

  { name: 'ensatina', w: 3, genes: r => make(r, {
    r: r.range(5.4, 6.1), len: r.range(33, 38), belly: 1.04, neckW: 0.72, tail: r.range(0.85, 1), limbS: 1.15,
    prof: [[0, 0.5], [0.16, 0.9], [0.5, 1.04], [0.8, 0.9], [1, 0.72]], sideProf: [[0, 0.48], [0.25, 0.92], [0.5, 1.02], [0.75, 0.9], [1, 0.66]],
    head: headG(r, { len: r.range(1.3, 1.42), wid: r.range(1.08, 1.16), p: 2.3, eye: r.range(0.25, 0.3), eyeIn: 0.45 }),
    limbsG: legs(r, { len: r.range(2.4, 2.7), w: 0.42, toeLen: 0.6, lift: 0.4 }),
    T: { w0: 1, keys: [[0, 0.8], [0.16, 1.3], [0.5, 1.05], [1, 0.1]] },
  }, [[1.2, 'tall'], [2, 'walkS'], [2.5, 'walk'], [1.2, 'look'], [0.8, 'coil']]) },

  { name: 'arboreal salamander', w: 2.5, genes: r => make(r, {
    r: r.range(5.4, 6.1), len: r.range(35, 40), belly: 1.02, neckW: 0.7, tail: r.range(0.9, 1.1), gait: 0.6,
    head: headG(r, { len: r.range(1.65, 1.8), wid: r.range(1.36, 1.48), p: 1.55, jawX: 0.22, eye: 0.22, eyeX: 0.75, top: 0.72, jaw: 0.6 }),
    limbsG: legs(r, { len: r.range(2.5, 2.8), w: 0.44, toeLen: 0.8, spread: 2.0, toeW: 1.15 }), T: { keys: [[0, 1], [0.5, 0.6], [1, 0.1]] },
  }, [[2.5, 'coil'], [2, 'look'], [2, 'walk'], [1.5, 'curl']]) },

  { name: 'web-footed salamander', w: 2, genes: r => make(r, {
    r: r.range(5, 5.6), len: r.range(33, 38), belly: 1.04, neckW: 0.78, tail: r.range(0.9, 1.05),
    prof: [[0, 0.52], [0.16, 0.92], [0.5, 1.04], [0.8, 0.92], [1, 0.78]],
    head: headG(r, { len: r.range(1.1, 1.2), wid: r.range(1.12, 1.2), p: 3, eye: r.range(0.26, 0.3), eyeIn: 0.42 }),
    limbsG: legs(r, { len: r.range(2.1, 2.4), w: 0.46, toeLen: 0.5, webF: 0.96, webH: 0.96, palm: 0.26, toeW: 1.2 }),
    T: { keys: [[0, 0.85], [0.16, 1.25], [0.55, 0.95], [1, 0.12]] },
  }, [[2.5, 'walk'], [2, 'curl'], [1.5, 'coil'], [1, 'look']]) },

  { name: 'spectacled salamander', w: 2, genes: r => make(r, {
    r: r.range(4.4, 5), len: r.range(31, 36), belly: 1.05, neckW: 0.72, tail: r.range(1.1, 1.3), sideLimbS: 1.1,
    head: headG(r, { len: r.range(1.3, 1.42), wid: r.range(1.05, 1.12), p: 1.9, eye: 0.24 }),
    limbsG: legs(r, { len: r.range(2.1, 2.4), w: 0.4, toeLen: 0.55, toesH: 4 }), T: { keys: [[0, 1], [0.5, 0.55], [1, 0.07]] },
  }, [[4, 'tailcurl'], [2, 'coil'], [1, 'walk']]) },

  // ------------------------------------------------ giants
  { name: 'giant salamander', w: 3, genes: r => make(r, {
    r: r.range(10, 11.5), len: r.range(58, 66), neckW: 0.94, tail: r.range(0.5, 0.6), headS: 0.95, limbS: 0.85, sideLimbS: 0.78,
    prof: [[0, 0.74], [0.2, 0.95], [0.5, 1], [0.8, 0.97], [1, 0.92]], sideR: 0.72, sideProf: [[0, 0.6], [0.25, 0.95], [0.5, 1], [0.75, 0.95], [1, 0.8]],
    head: headG(r, { len: r.range(1.12, 1.24), wid: r.range(0.9, 0.97), p: 2.4, eye: 0, neckW: 0.9, top: 0.5, jaw: 0.5, pt: 2.4 }),
    limbsG: legs(r, { len: r.range(1.9, 2.1), w: 0.62, toeLen: 0.45, lift: 0.12 }),
    T: { fin: 0.75, finB: 0.2, finBase: 0.7, topK: 0.62, keys: [[0, 1], [0.5, 0.7], [1, 0.2]], curlK: 0.6 },
    dorsalTop: { type: 'salamanderCrest', h: 0.3, top: r.range(0.13, 0.19), wave: 0.5, freq: r.range(10, 14) },
    dorsalSide: { type: 'salamanderCrest', h: 0.14, wave: 0.5, freq: 6, rear: 1 }, backT0: 0.1, backT1: 0.86,
  }, [[3, 'walk'], [0.8, 'curl'], [1.8, 'walkS']]) },

  { name: 'hellbender', w: 3, genes: r => make(r, {
    r: r.range(7.8, 8.8), len: r.range(51, 58), neckW: 0.88, tail: r.range(0.55, 0.68), limbS: 0.95, sideLimbS: 0.85,
    prof: [[0, 0.72], [0.2, 0.93], [0.5, 1], [0.8, 0.96], [1, 0.88]], sideR: 0.7,
    head: headG(r, { len: r.range(1.3, 1.42), wid: r.range(0.95, 1.0), p: 2.3, eye: 0.08, eyeIn: 0.3, neckW: 0.85, top: 0.46, jaw: 0.46, pt: 2.2 }),
    limbsG: legs(r, { len: r.range(1.9, 2.1), w: 0.58, toeLen: 0.48, lift: 0.12 }),
    T: { fin: 0.85, finB: 0.25, finBase: 0.6, topK: 0.6, keys: [[0, 1], [0.5, 0.66], [1, 0.16]] },
    dorsalTop: { type: 'salamanderCrest', h: 0.3, top: r.range(0.15, 0.22), wave: 0.55, freq: r.range(11, 15) },
    dorsalSide: { type: 'salamanderCrest', h: 0.12, wave: 0.6, freq: 8, rear: 1 }, backT0: 0.1, backT1: 0.84,
  }, [[3, 'walk'], [0.8, 'ess'], [0.7, 'curl'], [2, 'walkS']]) },

  // ------------------------------------------------ gilled and eel-like
  { name: 'mudpuppy', w: 3, genes: r => make(r, {
    r: r.range(6.4, 7.2), len: r.range(46, 52), neckW: 0.82, tail: r.range(0.48, 0.58), sideR: 0.85,
    head: headG(r, { len: r.range(1.45, 1.6), wid: r.range(1.04, 1.1), p: 3.2, eye: 0.08, eyeIn: 0.3, top: 0.5, jaw: 0.48, pt: 2.6 }),
    limbsG: legs(r, { len: r.range(1.8, 2.1), w: 0.44, toeLen: 0.55, toesH: 4, lift: 0.2 }),
    T: { fin: 0.7, finB: 0.45, finBase: 0.45, topK: 0.6, keys: [[0, 1], [0.5, 0.68], [1, 0.14]] },
    crown: gills(r, { style: 'bush', len: r.range(1.8, 2.2), fl: 0.34, w: 0.16, nf: 3, bend: 0.3, fan: [-0.45, 0.25, 0.9] }),
  }, [[3, 'walk'], [1.5, 'ess'], [1, 'curl'], [2, 'walkS'], [1, 'swim']]) },

  { name: 'axolotl', w: 5, genes: r => make(r, {
    r: r.range(7, 8), len: r.range(37, 43), belly: 1.06, neckW: 0.84, tail: r.range(0.8, 0.95), headS: 1.02,
    head: headG(r, { len: r.range(1.12, 1.22), wid: r.range(1.24, 1.36), p: 2.8, eye: 0.09, eyeIn: 0.3, top: 0.6, jaw: 0.5, pt: 2.3, sideLen: 1.15 }),
    limbsG: legs(r, { len: r.range(2.1, 2.4), w: 0.36, toeLen: 0.72, toeW: 0.85, spread: 1.9, lift: 0.22 }),
    T: { fin: 0.95, finB: 0.6, finBase: 0.85, topK: 0.6, keys: [[0, 1], [0.5, 0.6], [1, 0.08]] },
    crown: gills(r, { style: 'plume', len: r.range(3.0, 3.6), fl: 0.6, w: 0.15, nf: 5, fan: [-0.55, 0.2, 0.9] }),
    dorsalSide: { type: 'salamanderCrest', h: r.range(0.45, 0.6), rear: 1, env: [[0, 1], [0.6, 0.9], [1, 0]] }, backT1s: 0.72,
  }, [[3, 'walk'], [1.2, 'curl'], [1, 'look'], [2, 'walkS'], [2, 'swim']]) },

  { name: 'olm', w: 2.5, genes: r => make(r, {
    r: r.range(3.2, 3.7), len: r.range(58, 70), neckW: 0.8, tail: r.range(0.26, 0.34), tF: 0.9, tH: 0.07, limbS: 1.2,
    prof: [[0, 0.8], [0.3, 1], [0.7, 1], [1, 0.8]],
    head: headG(r, { len: r.range(2.5, 2.9), wid: r.range(1.12, 1.2), p: 2.6, q: 1.3, jawX: 0.5, eye: 0 }),
    limbsG: legs(r, { len: r.range(1.9, 2.2), w: 0.34, toeLen: 0.5, toesF: 3, toesH: 2, bend: 0.6 }),
    T: { fin: 0.6, topK: 0.7, keys: [[0, 1], [0.5, 0.85], [1, 0.12]], curlK: 0.4 },
    crown: gills(r, { style: 'ray', len: r.range(1.7, 2.1), w: 0.17, bend: 0.5, fan: [-0.45, 0.25, 0.9] }),
  }, [[3, 'eel'], [2, 'ess']]) },

  { name: 'siren', w: 3, genes: r => make(r, {
    r: r.range(4.8, 5.6), len: r.range(76, 92), neckW: 0.82, tail: r.range(0.3, 0.38), limbs: 'fore', tF: 0.84, limbS: 0.9,
    prof: [[0, 0.72], [0.3, 1], [0.7, 1], [1, 0.82]],
    head: headG(r, { len: r.range(1.35, 1.5), wid: r.range(1.0, 1.06), p: 2.6, eye: 0.06, eyeIn: 0.3 }),
    limbsG: legs(r, { len: r.range(1.5, 1.8), w: 0.4, toeLen: 0.5, toesF: r.pick([3, 4, 4]), bend: 0.8 }),
    T: { fin: 0.5, topK: 0.7, keys: [[0, 1], [0.5, 0.75], [1, 0.07]], curlK: 0.5 },
    crown: gills(r, { style: 'bush', len: r.range(1.7, 2.1), fl: 0.34, w: 0.16, nf: 3, bend: 0.4, fan: [-0.45, 0.25, 0.9] }),
  }, [[3, 'eel'], [2, 'eelcoil'], [1, 'ess']]) },

  { name: 'amphiuma', w: 1.5, genes: r => make(r, {
    r: r.range(5.4, 6.2), len: r.range(66, 76), neckW: 0.86, tail: r.range(0.22, 0.28), tF: 0.88, tH: 0.06, limbS: 1.1, waveK: 0.55,
    prof: [[0, 0.7], [0.3, 1], [0.7, 1], [1, 0.8]],
    head: headG(r, { len: r.range(1.7, 1.9), wid: r.range(1.12, 1.2), p: 1.9, jawX: 0.3, eye: 0.1 }),
    limbsG: legs(r, { len: r.range(1.6, 1.9), w: 0.42, toeLen: 0.5, toesF: r.int(2, 3), toesH: r.int(2, 3), bend: 0.6 }),
    T: { keys: [[0, 1], [0.5, 0.66], [1, 0.06]], curlK: 0.5 },
  }, [[2, 'eel'], [2, 'walk'], [1.2, 'ess']]) },

  { name: 'blind cave salamander', w: 2, genes: r => make(r, {
    r: r.range(3.8, 4.4), len: r.range(32, 38), neckW: 0.66, tail: r.range(0.7, 0.85), gait: 0.5, limbS: 1.2,
    head: headG(r, { len: r.range(2.1, 2.4), wid: r.range(1.4, 1.52), p: 3.4, jawX: 0.75, eye: 0, neckW: 0.66 }),
    limbsG: legs(r, { len: r.range(3.2, 3.7), w: 0.27, toeLen: 0.62, toeW: 0.8, spread: 1.9, bend: r.range(0.9, 1.3) }),
    T: { fin: 0.6, topK: 0.7, keys: [[0, 1], [0.5, 0.7], [1, 0.08]] },
    crown: gills(r, { style: 'plume', len: r.range(1.9, 2.3), fl: 0.4, w: 0.14, nf: 4, fan: [-0.5, 0.2, 0.9] }),
  }, [[3, 'walk'], [1.5, 'ess'], [1, 'look']]) },

  // ------------------------------------------------ newts
  { name: 'great crested newt', w: 5, genes: r => make(r, {
    r: r.range(5.8, 6.5), len: r.range(36, 42), belly: 1.08, neckW: 0.84, tail: r.range(0.85, 1),
    head: headG(r, { len: r.range(1.25, 1.36), wid: r.range(1.04, 1.1), p: 2.3, eye: 0.2 }),
    limbsG: legs(r, { len: r.range(2.2, 2.5), w: 0.42, toeLen: 0.78, toeW: 0.9, spread: 1.9 }),
    T: { fin: 0.95, finB: 0.7, finBase: 0.08, topK: 0.6, keys: [[0, 1], [0.5, 0.6], [1, 0.07]], finKeys: [[0, 0.05], [0.12, 0.25], [0.35, 1], [0.7, 0.8], [1, 0]] },
    dorsalSide: { type: 'salamanderCrest', h: r.range(0.95, 1.3), jag: 0.6, teeth: r.int(9, 13), env: [[0, 0], [0.15, 0.8], [0.5, 1], [0.85, 0.85], [1, 0.3]], top: 0 }, backT0s: 0.2, backT1s: 0.98,
    dorsalTop: none(),
  }, [[3.5, 'walkS'], [3, 'swim'], [1, 'alert'], [1.2, 'walk'], [0.6, 'curl']]) },

  { name: 'smooth newt', w: 4, genes: r => make(r, {
    r: r.range(5, 5.6), len: r.range(33, 37), belly: 1.05, neckW: 0.82, tail: r.range(0.95, 1.1),
    head: headG(r, { len: r.range(1.3, 1.42), wid: r.range(1.0, 1.06), p: 2.0, eye: 0.2 }),
    limbsG: legs(r, { len: r.range(2.2, 2.5), w: 0.46, toeLen: 0.8, toeW: 1.3, spread: 1.9 }), sideLegK: 0.95, sideLimbS: 1.25, sideStance: 0.5,
    T: { fin: 0.85, finB: 0.6, finBase: 1, topK: 0.6, keys: [[0, 1], [0.5, 0.58], [1, 0.05]], finKeys: [[0, 1], [0.3, 1], [0.7, 0.7], [1, 0]], jag: 0.22, teeth: r.int(7, 10) },
    dorsalSide: { type: 'salamanderCrest', h: r.range(0.6, 0.85), wave: 0.22, freq: r.range(6, 9), env: [[0, 1], [0.7, 1], [0.92, 0.7], [1, 0]], top: 0 }, backT0s: 0.03, backT1s: 0.98,
    dorsalTop: none(),
  }, [[0.7, 'walkS'], [1, 'swim'], [4, 'walk'], [1.5, 'ess'], [0.8, 'look']]) },

  { name: 'palmate newt', w: 3, genes: r => make(r, {
    r: r.range(4.8, 5.4), len: r.range(31, 36), belly: 1.06, neckW: 0.82, tail: r.range(0.75, 0.88),
    head: headG(r, { len: r.range(1.25, 1.36), wid: r.range(1.0, 1.06), p: 2.1, eye: 0.2 }),
    limbsG: legs(r, { len: r.range(2.1, 2.4), w: 0.46, toeLen: 0.8, webH: 0.94, hind: 1.2, palm: 0.24 }), sideLegK: 0.95, sideLimbS: 1.25, sideStance: 0.5,
    T: { fin: 0.6, finB: 0.5, finBase: 0.9, topK: 0.7, keys: [[0, 1], [0.6, 0.66], [0.94, 0.3], [1, 0.22]], finKeys: [[0, 0.9], [0.4, 1], [0.85, 0.8], [1, 0.25]], fil: r.range(1.6, 2.4), curlK: 0.5 },
    dorsalSide: { type: 'salamanderCrest', h: r.range(0.2, 0.3), env: [[0, 1], [0.8, 1], [1, 0]], top: 0 }, backT0s: 0.03, backT1s: 0.92,
    dorsalTop: none(),
  }, [[0.7, 'walkS'], [0.8, 'swim'], [4, 'walk'], [1, 'curl'], [1, 'ess']]) },

  { name: 'red eft', w: 4, genes: r => make(r, {
    r: r.range(4.9, 5.5), len: r.range(30, 34), belly: 1.04, neckW: 0.84, tail: r.range(0.85, 1), limbS: 1.15, sideLimbS: 1.1, headS: 1.05,
    head: headG(r, { len: r.range(1.2, 1.3), wid: r.range(0.96, 1.02), p: 2.4, eye: 0.22 }),
    limbsG: legs(r, { len: r.range(2.2, 2.5), w: 0.4, toeLen: 0.58, lift: 0.36 }),
    T: { topK: 0.62, fin: 0.14, keys: [[0, 1], [0.5, 0.56], [1, 0.07]] },
  }, [[3, 'alert'], [2, 'walkS'], [3, 'walk'], [1.5, 'look'], [1.5, 'curl']]) },

  { name: 'rough-skinned newt', w: 3, genes: r => make(r, {
    r: r.range(6, 6.8), len: r.range(35, 41), belly: 1.08, neckW: 0.86, tail: r.range(0.9, 1.05),
    head: headG(r, { len: r.range(1.2, 1.3), wid: r.range(1.05, 1.12), p: 2.4, eye: 0.2 }),
    limbsG: legs(r, { len: r.range(2.2, 2.5), w: 0.46, toeLen: 0.6 }),
    T: { fin: 0.3, finB: 0.2, topK: 0.7, keys: [[0, 1], [0.5, 0.6], [1, 0.08]] },
    dorsal: { type: 'salamanderWarts', n: r.int(9, 13), size: r.range(0.1, 0.14) },
  }, [[0.35, 'unken'], [2, 'walkS'], [3, 'walk'], [1, 'curl']]) },

  { name: 'ribbed newt', w: 3, genes: r => make(r, {
    r: r.range(6.4, 7.2), len: r.range(42, 48), belly: 1.06, neckW: 0.84, tail: r.range(0.85, 1), sideR: 0.82,
    head: headG(r, { len: r.range(1.2, 1.3), wid: r.range(1.0, 1.06), p: 2.4, eye: 0.13, eyeIn: 0.35, top: 0.5, jaw: 0.48 }),
    limbsG: legs(r, { len: r.range(2.0, 2.2), w: 0.46, toeLen: 0.6 }),
    T: { fin: 0.5, finB: 0.35, finBase: 0.6, topK: 0.62, keys: [[0, 1], [0.5, 0.62], [1, 0.07]] },
    dorsalTop: { type: 'salamanderWarts', n: r.int(7, 9), size: r.range(0.12, 0.15), out: 0.3 },
    dorsalSide: { type: 'salamanderWarts', n: r.int(8, 11), size: 0.12 },
  }, [[4, 'walk'], [2, 'ess'], [1.5, 'curl'], [1.2, 'walkS']]) },

  { name: 'crocodile newt', w: 3, genes: r => make(r, {
    r: r.range(6.8, 7.5), len: r.range(36, 41), belly: 1.08, neckW: 0.8, tail: r.range(0.75, 0.9),
    head: headG(r, { len: r.range(1.25, 1.35), wid: r.range(1.06, 1.14), p: 1.9, jawX: 0.35, eye: 0.14, ridge: r.range(0.2, 0.25), top: 0.7 }),
    limbsG: legs(r, { len: r.range(2.1, 2.3), w: 0.52, toeLen: 0.58 }),
    T: { fin: 0.3, topK: 0.62, keys: [[0, 1], [0.5, 0.6], [1, 0.1]] },
    dorsalTop: { type: 'salamanderWarts', n: r.int(6, 8), size: r.range(0.17, 0.21), out: 0.3 },
    dorsalSide: { type: 'salamanderWarts', n: r.int(7, 9), size: r.range(0.18, 0.22), out: 0.4 }, backT0: 0.16, backT1: 0.82,
  }, [[4, 'walk'], [0.8, 'curl'], [1, 'look'], [2, 'walkS']]) },

  // ------------------------------------------------ larvae
  { name: 'salamander larva', w: 3, genes: r => make(r, {
    r: r.range(5.2, 6), len: r.range(25, 29), belly: 1.05, neckW: 0.86, tail: r.range(1.0, 1.2), headS: 1.12, sideLenK: 1,
    head: headG(r, { len: r.range(1.1, 1.2), wid: r.range(1.18, 1.28), p: 2.8, eye: 0.14, eyeIn: 0.35, top: 0.62, jaw: 0.52, pt: 2.2 }),
    limbsG: legs(r, { len: r.range(1.5, 1.8), w: 0.3, toeLen: 0.5, toeW: 0.85, lift: 0.2 }),
    T: { fin: 1.0, finB: 0.75, finBase: 1, topK: 0.5, keys: [[0, 1], [0.5, 0.5], [1, 0.05]], finKeys: [[0, 1], [0.35, 1], [0.7, 0.75], [1, 0]] },
    crown: gills(r, { style: 'plume', len: r.range(2.5, 3.0), fl: 0.5, w: 0.14, nf: 4, fan: [-0.5, 0.2, 0.9] }),
    dorsalSide: { type: 'salamanderCrest', h: r.range(0.7, 0.95), env: [[0, 1], [0.6, 0.9], [1, 0]], top: 0 }, backT0s: 0.03, backT1s: 0.8,
    dorsalTop: none(),
  }, [[4, 'swim'], [1.5, 'walkS'], [2.5, 'walk']]) },

  { name: 'newt larva', w: 1.5, genes: r => { const two = r.chance(0.5); return make(r, {
    r: r.range(4.2, 4.8), len: r.range(24, 28), belly: 1.02, neckW: 0.8, tail: r.range(1.2, 1.45), headS: 1.15, limbs: two ? 'fore' : 'four', tF: 0.84, limbS: 1.1,
    head: headG(r, { len: r.range(1.1, 1.2), wid: r.range(1.2, 1.3), p: 2.6, eye: 0.16, eyeIn: 0.35 }),
    limbsG: legs(r, { len: r.range(1.6, 2.0), w: 0.26, toeLen: 0.55, toeW: 0.8, toesF: 3, toesH: 3, bend: 0.5 }),
    T: { fin: 0.9, finB: 0.7, finBase: 1, topK: 0.55, keys: [[0, 1], [0.5, 0.52], [0.92, 0.12], [1, 0.05]], fil: 0.8 },
    crown: gills(r, { style: 'plume', len: r.range(2.4, 2.9), fl: 0.32, w: 0.13, nf: 6, bend: 0.6, fan: [-0.4, 0.25, 0.9] }),
    dorsalSide: { type: 'salamanderCrest', h: 0.7, env: [[0, 1], [0.6, 0.9], [1, 0]], top: 0 }, dorsalTop: none(),
  }, [[3, 'walk'], [2, 'ess'], [2, 'swim']]); } },
];

export default {
  id: 'salamander', label: 'Salamanders', short: 'Salamanders',
  sig: { tail: 3, limbs: 2, crown: 2, dorsal: 1.2, head: 1 },
  species,
};
