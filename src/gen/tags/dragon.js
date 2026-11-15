// Small dragons: a species library drawn from the medieval visual record (bestiary
// 'draco', wyverns, lindworms, cockatrices, marginal dragonets, interlace beasts,
// heraldic dragons, ouroboroi, sea-serpents...) rather than from modern fantasy art.
// Everything dragon-specific is registered here with a `dragon` prefix.
import { add, lerp, dist, angOf, polar, angDiff, clamp, mix, MINW, frame, spline, polyline, profile, pathAt, tube, leaf, ellipse } from '../core.js';
import { chassis, heads, feet, tips, crowns, dorsals } from '../parts.js';

const PI = Math.PI, TAU = 2 * PI;
const sm = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const none = () => ({ type: 'none' });
// lower-vertex ovals and dots: Ink.finish cost grows with vertex count
const ov = (ink, c, rx, ry, rot = 0, n = 16) => ink.poly(ellipse(c, rx, ry, rot, n));
const dt = (ink, c, rr, n = 12) => ink.poly(ellipse(c, rr, rr, 0, n));
// a cheap leaf/petal outline (same signature as core leaf, ~12 vertices instead of ~40)
function lf(p, ang, len, wid, bend = 0, fat = 0.4) {
  const L = [], R = [], n = 5, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = wid * 0.5 * (t <= fat ? 0.24 + 0.76 * Math.sin(PI / 2 * t / fat) : Math.cos(PI / 2 * (t - fat) / (1 - fat))), off = bend * len * 4 * t * (1 - t);
    const x = p[0] + ca * len * t - sa * off, y = p[1] + sa * len * t + ca * off;
    L.push([x - sa * w, y + ca * w]); R.push([x + sa * w, y - ca * w]);
  }
  return L.concat(R.slice(0, n).reverse());
}

// ---------------------------------------------------------------- helpers
function resample(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const tot = cum[cum.length - 1], out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = tot * i / (n - 1);
    while (j < pts.length - 2 && cum[j + 1] < d) j++;
    out.push(lerp(pts[j], pts[j + 1], clamp((d - cum[j]) / ((cum[j + 1] - cum[j]) || 1), 0, 1)));
  }
  return out;
}
function strip(path, rad, t0, t1, n, side) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = mix(t0, t1, i / (n - 1)), { p, ang } = pathAt(path, t), na = ang + side * PI / 2;
    out.push({ p: polar(p, na, rad(t) * 0.85), dir: na, t });
  }
  return out;
}
// quadratic curve samples (exclusive of both ends)
function qcurve(a, c, b, n = 5) {
  const out = [];
  for (let i = 1; i < n; i++) { const t = i / n; out.push(lerp(lerp(a, c, t), lerp(c, b, t), t)); }
  return out;
}
// a path grown by turning: heading h0, total length L, turn(u) = heading offset at u
function grow(p, h0, L, turn, n = 16) {
  const pts = [p];
  let h = h0;
  for (let i = 1; i <= n; i++) { h = h0 + turn((i - 0.5) / n); p = polar(p, h, L / n); pts.push(p); }
  pts.endAng = h0 + turn(1);
  return pts;
}

// A tiny generic dragon head (hydra's extra heads, the amphisbaena's tail head).
function miniHead(ink, p, ang, s, o = {}) {
  const flip = Math.cos(ang) < 0 ? -1 : 1, c = polar(p, ang, s * 0.35), F = frame(c, ang, s, flip);
  ink.poly(tube(polyline([p, c], 2), s * 0.6));
  ov(ink, F(0.05, 0), s * 0.82, s * 0.72, ang);
  ink.poly(tube(spline([F(0.2, -0.12), F(0.9, -0.14), F(1.55, -0.02)], 5), profile([[0, s * 0.56], [1, s * 0.3]])));
  dt(ink, F(1.6, -0.22), s * 0.2);
  const gape = o.gape ?? 0.45;
  ink.poly(tube(polyline([F(0.1, 0.34), polar(F(0.1, 0.34), F.dir(gape), s * 1.25)], 3), profile([[0, s * 0.36], [1, s * 0.17]])));
  if (o.ears !== false) ink.poly(lf(F(-0.35, -0.5), F.dir(-PI / 2 - 0.9), s * 1.25, s * 0.55, 0, 0.4));
  return { eye: F(0.3, -0.25) };
}

// ---------------------------------------------------------------- chassis
// Legged side-view beast: passant quadruped, two-legged wyvern, rampant, sejant, lying.
// The long neck is NOT here: it lives in the head gene, so it travels when lent.
chassis.dragonBeast = (C, g) => {
  const { ink, rng } = C, r = g.r * C.plump, L = g.len, p = g.pitch ?? 0, legs = g.legs ?? 'quad';
  const lift = g.lie ? 0 : Math.max(C.lift, 0.12) * r * (g.liftK ?? 1);
  const H = [-L * Math.cos(p) / 2, -(lift + r * 0.9)];
  const S = add(H, [L * Math.cos(p), -L * Math.sin(p)]);
  const M = polar(lerp(H, S, 0.5), -p - PI / 2, (g.arch ?? 0.3) * r);
  let T = polar(H, PI - p * 0.8 + (g.tailLift ?? 0.3), r * 1.25);
  if (T[1] > -r * 0.62) T = [T[0], -r * 0.62];
  const na = g.neckA ?? clamp(-(p + 0.75), -1.5, 0.3), nl = g.neckL ?? 0.9;
  const N = polar(S, na, nl * r);
  const ctrl = [T, H, M, S, N], rs = [0.52, 0.9, g.belly ?? 1, g.chest ?? 0.9, g.neckW ?? 0.55];
  const cum = [0]; for (let i = 1; i < ctrl.length; i++) cum.push(cum[i - 1] + dist(ctrl[i - 1], ctrl[i]));
  const tk = cum.map(c => c / cum[cum.length - 1]);
  const path = resample(spline(ctrl, 10), 48), rad = profile(tk.map((t, i) => [t, rs[i] * r]));
  ink.poly(tube(path, rad));
  if (g.haunch ?? !g.lie) ov(ink, add(H, [r * 0.1, r * 0.22]), r * 0.82, r * 0.74, -p);
  const limbs = [], ls = r * (g.legS ?? 1);
  const mk = (base, dx, role, far, dy = 0.3) => limbs.push({ p: add(base, [dx * r, r * dy]), dir: PI / 2, s: ls, role, far, ground: 0, fwd: 0, side: 1 });
  const arm = (dir, far) => limbs.push({ p: add(S, [r * (far ? 0.55 : 0.3), r * (far ? -0.1 : 0.3)]), dir, s: ls * (far ? 0.9 : 1), role: 'arm', fwd: -PI / 2, side: 1 });
  if (legs === 'quad') {
    if (g.pawUp) arm(rng.range(0.25, 0.6), true); else mk(S, 0.3, 'fore', true);
    mk(H, -0.25, 'hind', true); mk(S, -0.2, 'fore', false); mk(H, 0.3, 'hind', false);
  } else if (legs === 'six') {
    mk(S, 0.3, 'fore', true); mk(H, -0.25, 'hind', true); mk(M, 0.25, 'fore', true, 0.9);
    mk(S, -0.2, 'fore', false); mk(H, 0.3, 'hind', false); mk(M, -0.3, 'hind', false, 0.9);
  } else if (legs === 'biped') {
    const B = lerp(H, S, g.legAt ?? 0.12);
    mk(B, 0.45, 'hind', true); mk(B, -0.15, 'hind', false);
  } else if (legs === 'rampant') {
    mk(H, 0.35, 'hind', true); mk(H, -0.25, 'hind', false);
    arm(rng.range(-0.7, -0.25), true); arm(rng.range(0.1, 0.5), false);
  } else if (legs === 'sejant') {
    mk(H, 0.75, 'fore', false, 0.1); mk(S, 0.35, 'fore', true); mk(S, -0.1, 'fore', false);
  } else if (legs === 'lie') {
    ov(ink, [S[0] + r * 1.15, -r * 0.24], r * 0.62, r * 0.24, 0); // tucked forepaw
  }
  const plan = {
    view: 'side', r, path, rad,
    head: { p: N, dir: na, face: g.face ?? clamp(na * 0.25 + 0.1, -0.5, 0.25), s: r * g.headS, sym: false },
    tail: { p: T, dir: angOf(H, T) + (g.tailAng ?? 0), s: r * 0.6 },
    limbs, back: [strip(path, rad, tk[1] - 0.03, tk[3] + (tk[4] - tk[3]) * 0.3, 14, -1)],
  };
  if (g.shell) { // tarasque: domed carapace; ornaments ride on the dome
    const c = add(lerp(H, S, 0.5), [0, r * 0.1]), A = L / 2 + r * 1.05, B = r * (g.shell + 1), dome = [], st = [];
    for (let i = 0; i <= 24; i++) { const a = PI * i / 24; dome.push([c[0] + A * Math.cos(a), c[1] - B * Math.sin(a)]); }
    ink.poly(dome);
    for (let i = 0; i < 14; i++) { const a = mix(0.86, 0.14, i / 13) * PI; st.push({ p: [c[0] + A * Math.cos(a) * 0.97, c[1] - B * Math.sin(a) * 0.97], dir: Math.atan2(-A * Math.sin(a), B * Math.cos(a)), t: i / 13 }); }
    plan.back = [st];
  }
  for (let i = 0; i < (g.extraNecks ?? 0); i++) { // hydra
    const n = g.extraNecks, a0 = na - 0.35 - 0.55 * i + rng.range(-0.12, 0.12), len = r * rng.range(2.6, 3.6) * (1 + 0.12 * i);
    const fa = mix(0.25, -0.5, (i + 1) / (n + 0.5)) + rng.range(-0.15, 0.15);
    const b = add(S, [-r * 0.3 * i, -r * 0.15]);
    const pts = grow(b, a0, len, u => angDiff(fa, a0) * sm(u) - 0.7 * Math.sin(PI * u), 10);
    ink.poly(tube(pts, profile([[0, r * 0.5], [0.4, r * 0.36], [1, r * 0.3]])));
    miniHead(ink, pts[pts.length - 1], fa, r * g.headS * 0.7, { gape: rng.range(0.3, 0.6) });
  }
  return plan;
};

// Legless (or nearly) serpent bodies built from a height profile above the ground:
// humped sea-serpents, looped and knotted wyrms, flat spirals, the ouroboros ring.
chassis.dragonSerpent = (C, g) => {
  const { ink } = C, r = g.r * C.plump, raw = [[0, 0]];
  let x = 0, hb = 0, h = 0;
  const run = (len, f) => { const n = Math.max(4, Math.round(len / 1.5)); for (let i = 1; i <= n; i++) raw.push([x + len * i / n, f ? f(i / n) : 0]); x += len; hb = f ? f(1) : 0; };
  const hump = (A, n) => u => A * (1 - Math.cos(TAU * n * u)) / 2;
  const mode = g.mode ?? 'wave';
  if (g.stern) { // the tail end rises in a curve like a ship's stern post (path runs tail -> head)
    const Hs = g.stern * r, n = 12; raw.length = 0;
    for (let i = 0; i <= n; i++) { const u = i / n, a = PI / 2 * u; raw.push([x + Hs * 0.8 * Math.sin(a), Hs * Math.cos(a)]); }
    x += Hs * 0.8;
  }
  if (mode === 'wave') run(g.len, hump((g.amp ?? 0) * r, g.humps ?? 1));
  else if (mode === 'loop') {
    const R = r * 1.9 + 2.2 + (g.loopR ?? 0) * r;
    run(g.len * (g.loopAt ?? 0.4), hump((g.amp ?? 0) * r, 1));
    for (let i = 1; i <= 30; i++) { const f = TAU * i / 30; raw.push([x + R * Math.sin(f), R * (1 - Math.cos(f))]); }
    run(g.len * (1 - (g.loopAt ?? 0.4)), hump((g.amp ?? 0) * r, 1));
  } else if (mode === 'ring') {
    const R = g.R * r, th = g.headAt ?? -1.05, gap = g.gap ?? 0.5; raw.length = 0;
    for (let i = 0; i <= 60; i++) { const a = mix(th + gap, th + TAU, i / 60); raw.push([R * Math.cos(a), R * (1 - Math.sin(a))]); }
    h = th + PI / 2; x = raw[60][0]; hb = raw[60][1];
  } else if (mode === 'spiral') {
    const turns = g.turns ?? 1.8, b = (2 * r + (g.gapW ?? 2)) / TAU, r0 = r * 0.5 + 1, a1 = -PI / 2 + TAU * 2, a0 = a1 - TAU * turns;
    const rho = a => r0 + b * (a - a0), hc = rho(a1 - PI); raw.length = 0;
    const n = Math.round(turns * 36);
    for (let i = 0; i <= n; i++) { const a = mix(a0, a1, i / n); raw.push([rho(a) * Math.cos(a), hc - rho(a) * Math.sin(a)]); }
    x = raw[n][0]; hb = raw[n][1];
  }
  if (g.rise) { // the forebody lifts off the ground
    const Lr = g.rise * r, n = 14, A = g.riseA ?? 1.2, h0 = h;
    for (let i = 1; i <= n; i++) { h = h0 - A * sm((i - 0.5) / n); x += Math.cos(h) * Lr / n; hb -= Math.sin(h) * Lr / n; raw.push([x, hb]); }
    h = h0 - A;
  }
  const N = g.mode === 'spiral' || g.mode === 'ring' ? 84 : 66, pts = resample(raw, N);
  const keys = g.radKeys ?? [[0, 0.36], [0.2, 0.8], [0.55, 1], [0.85, 0.86], [1, 0.62]];
  const rad = profile(keys.map(([t, k]) => [t, k * r]));
  const [c0, c1] = g.clearT ?? [0.1, 0.3], clear = (g.clear ?? 0) * r;
  const path = pts.map(([px, ph], i) => { const t = i / (N - 1); return [px, -(ph + rad(t) + clear * sm((t - c0) / (c1 - c0)))]; });
  ink.poly(tube(path, rad));
  const limbs = [];
  for (const lg of g.legsAt ?? []) {
    const q = pathAt(path, lg.t).p, ls = r * (g.legS ?? 1.2);
    limbs.push({ p: add(q, [r * 0.3, rad(lg.t) * 0.3]), dir: PI / 2, s: ls, role: lg.role, far: true, ground: 0, fwd: 0, side: 1 });
    limbs.push({ p: add(q, [-r * 0.3, rad(lg.t) * 0.3]), dir: PI / 2, s: ls, role: lg.role, far: false, ground: 0, fwd: 0, side: 1 });
  }
  const e = path[N - 1], t0 = path[0], bt = g.backT ?? [0.42, 0.9];
  const ha = g.rise || mode === 'ring' ? h : angOf(path[N - 4], e);
  return {
    view: 'side', r, path, rad,
    head: { p: e, dir: ha, face: g.face ?? (mode === 'ring' ? ha + (g.faceOff ?? 0) : clamp(ha * 0.3 + 0.1, -0.5, 0.3)), s: r * g.headS, sym: false },
    tail: { p: t0, dir: angOf(path[3], t0), s: Math.max(rad(0) / 0.9, 1) },
    limbs, back: [strip(path, rad, bt[0], bt[1], 14, -1)],
  };
};


// Fire salamander: a low crested newt whose crest, back to tail tip, is one run of flames.
chassis.dragonNewt = (C, g) => {
  const { ink } = C, r = g.r * C.plump, L = g.len, lift = Math.max(C.lift, 0.12) * r * (g.liftK ?? 1);
  const y0 = -(lift + r * 0.9), TL = (g.tailL ?? 1.1) * L;
  const H = [-L / 2, y0], S = [L / 2, y0 - r * (g.chestUp ?? 0.15)], M = [0, y0 - r * (g.arch ?? 0.15)];
  const Tm = [H[0] - TL * 0.5, Math.min(y0 + r * 0.25, -r * 0.6)], Tt = [H[0] - TL, y0 - r * (g.tailUp ?? 0.8)];
  const N = polar(S, g.neckA ?? -0.3, r * 0.75);
  const ctrl = [Tt, Tm, H, M, S, N], rs = [0.16, 0.5, 0.88, 1, 0.92, 0.66];
  const cum = [0]; for (let i = 1; i < ctrl.length; i++) cum.push(cum[i - 1] + dist(ctrl[i - 1], ctrl[i]));
  const tk = cum.map(c => c / cum[cum.length - 1]);
  const path = resample(spline(ctrl, 10), 56), rad = profile(tk.map((t, i) => [t, rs[i] * r]));
  ink.poly(tube(path, rad));
  const limbs = [], ls = r * (g.legS ?? 1);
  const mk = (base, dx, role, far) => limbs.push({ p: add(base, [dx * r, r * 0.35]), dir: PI / 2, s: ls, role, far, ground: 0, fwd: 0, side: 1 });
  mk(S, 0.2, 'fore', true); mk(H, -0.3, 'hind', true); mk(S, -0.3, 'fore', false); mk(H, 0.25, 'hind', false);
  return {
    view: 'side', r, path, rad,
    head: { p: N, dir: g.neckA ?? -0.3, face: g.face ?? -0.1, s: r * g.headS, sym: false },
    tail: { p: Tt, dir: angOf(path[2], path[0]), s: r * 0.6 },
    limbs, back: [strip(path, rad, g.crest0 ?? 0.04, tk[4] - 0.02, 22, -1)],
  };
};

// ---------------------------------------------------------------- head
// Dog-, pug-, long-jawed or beaked dragon head with a real (outline) open mouth and an
// optional neck of its own: swan-S, or turned right round to look back over the shoulder.
heads.dragonHead = (C, sock, g) => {
  const { ink } = C, s = sock.s, sym = sock.sym, sk = g.skull ?? 0.95, mz = g.mz ?? 1.8, tr = g.tipR ?? 0.4;
  let p = sock.p, h = sock.dir, fa = sock.face, flip = 1;
  const nk = g.neck;
  if (sym) {
    if (nk) { const q = polar(p, h, nk.len * s * 0.45); ink.poly(tube(polyline([p, q], 4), profile([[0, s * (nk.w0 ?? 0.7)], [1, s * (nk.w1 ?? 0.55)]]))); p = q; }
  } else {
    const target = g.regard ? -PI - (g.lookDown ?? 0.1) : sock.face + (g.tilt ?? 0);
    if (nk) {
      const d = g.regard ? target - h : angDiff(target, h), sway = g.regard ? -0.25 : (nk.sway ?? 0.8);
      const pts = grow(p, h, nk.len * s, u => d * (g.regard ? sm(u) * sm(u) * 0.5 + u * 0.5 : sm(u)) - sway * Math.sin(PI * u), 11);
      ink.poly(tube(pts, profile([[0, s * (nk.w0 ?? 0.7)], [0.6, s * (nk.w1 ?? 0.52)], [1, s * (nk.w1 ?? 0.52)]])));
      p = pts[pts.length - 1]; h = target;
    }
    fa = target; flip = Math.cos(fa) < 0 ? -1 : 1;
  }
  const c = polar(p, h, s * sk * 0.45), F = frame(c, fa, s, flip);
  ink.poly(tube(polyline([p, c], 2), sk * s * 0.78));
  const eyes = [], mounts = [];
  if (sym) { // from above
    ov(ink, c, sk * s, sk * 0.88 * s, fa);
    ink.poly(tube(spline([F(0.2, 0), F(mz * 0.5, 0), F(mz * 0.92, 0)], 5), profile([[0, sk * 0.8 * s], [0.6, mix(sk * 0.8, tr, 0.75) * s], [1, tr * s]])));
    for (const sd of [-1, 1]) {
      if (!g.beak) dt(ink, F(mz * 0.95, sd * tr * 0.55), tr * 0.42 * s);
      dt(ink, F(0.3, sd * sk * 0.74), 0.28 * s);
      eyes.push({ p: F(0.3, sd * sk * 0.62), r: s * 0.17 });
      mounts.push({ p: F(-0.3, sd * sk * 0.7), dir: fa + sd * 1.25, flip: sd, s });
    }
    return { eyes, mounts, spots: [], tip: F(mz, 0) };
  }
  const up = g.up ?? 0, gape = g.gape ?? 0;
  ov(ink, F(0.05, 0), sk * 1.04 * s, sk * 0.94 * s, fa);
  if (g.brow) dt(ink, F(0.32, -sk * 0.72), g.brow * s);
  if (g.beak) {
    ink.poly(tube(spline([F(0.2, -0.1), F(mz * 0.55, -0.16), F(mz * 0.9, 0.02), F(mz, 0.34)], 4), profile([[0, sk * 0.66 * s], [0.55, 0.33 * s], [1, 0.1 * s]])));
    const J = F(0.2, 0.36 * sk);
    ink.poly(tube(polyline([J, polar(J, F.dir(gape + 0.12), mz * 0.72 * s)], 4), profile([[0, sk * 0.4 * s], [1, 0.09 * s]])));
    if (g.wattle) for (const [dx, k] of [[0.42, 1], [0.12, 0.72]]) ink.poly(lf(F(dx, sk * 0.55), PI / 2 + flip * 0.12, g.wattle * k * s, g.wattle * 0.62 * k * s, 0, 0.66));
  } else {
    const yo = gape ? -0.12 * sk : 0.06;
    ink.poly(tube(spline([F(0.2, yo), F(mz * 0.55, yo + up * 0.45), F(mz, yo + up)], 4), profile([[0, sk * 0.7 * s], [0.55, mix(sk * 0.7, tr, 0.7) * s], [1, tr * s]])));
    if (g.nose) dt(ink, F(mz + tr * 0.15, yo + up - tr * 0.6), tr * g.nose * s);
    if (gape) {
      const J = F(0.15, 0.42 * sk), jl = mz * (g.jawK ?? 0.86) * s, ja = F.dir(gape + 0.08);
      const jt = polar(J, ja, jl);
      ink.poly(tube(spline([J, polar(lerp(J, jt, 0.55), ja + flip * PI / 2, s * 0.1), jt], 4), profile([[0, sk * 0.42 * s], [0.6, tr * 0.72 * s], [1, tr * 0.6 * s]])));
      dt(ink, F(-0.05, 0.36 * sk), sk * 0.52 * s);
      if (g.beard) ink.poly(lf(lerp(J, jt, 0.45), ja + flip * 1.9, g.beard * s, g.beard * 0.5 * s, 0, 0.4));
      if (g.tongue) {
        const ta = F.dir(gape * 0.5 + 0.02), b = F(0.5, 0.2 * sk), e = polar(b, ta, (mz + (g.tongueL ?? 0.5)) * s), w = Math.max(s * 0.15, 0.95);
        ink.poly(tube(spline([b, polar(lerp(b, e, 0.5), ta + flip * PI / 2, s * 0.12), e], 5), w / 2));
        if (g.tongue === 'barb') ink.poly([polar(e, ta, s * 0.55), polar(e, ta + 2.3, s * 0.36), polar(e, ta + PI, s * 0.05), polar(e, ta - 2.3, s * 0.36)]);
        else if (g.tongue === 'fork') for (const sd of [-1, 1]) ink.poly(tube(polyline([e, polar(e, ta + sd * 0.5, s * 0.5)], 3), w / 2));
        else if (g.tongue === 'flame') for (const [da, k] of [[-0.45, 0.8], [0, 1.25], [0.5, 0.75]]) ink.poly(lf(polar(e, ta, -s * 0.2), ta + da, s * 1.1 * k, s * 0.5, da * 0.5, 0.4));
      }
    } else if (g.beard) ink.poly(lf(F(mz * 0.5, 0.3), F.dir(1.9), g.beard * s, g.beard * 0.5 * s, 0, 0.4));
    if (g.whisker) for (const [a, k] of [[2.2, 1], [2.75, 0.75]]) {
      const b = F(mz * 0.9, yo + up + tr * 0.3);
      ink.line([b, polar(b, F.dir(a - 0.7), g.whisker * k * s * 0.5), polar(polar(b, F.dir(a - 0.7), g.whisker * k * s * 0.5), F.dir(a), g.whisker * k * s * 0.6)], Math.max(s * 0.13, 0.95));
    }
  }
  eyes.push({ p: F(0.3, -0.26 * sk), r: s * 0.19 });
  mounts.push({ p: F(-0.3, -0.72 * sk), dir: fa - flip * (PI / 2 + 0.3), flip: -flip, s });
  return { eyes, mounts, spots: [], tip: F(mz, 0) };
};

// ---------------------------------------------------------------- wings
// Every wing is ONE outline polygon (cheap to union, no piles of finger tubes).
// Local frame: x runs out along the arm, +y is the trailing side (towards the tail); unit = S.
// Kinds: membrane (bat / heraldic / round Uccello / folded / stub), feather, leafy.
function lobe(out, T, a, w, k = 1) { // rounded feather end centred on tip T pointing along a
  const c = polar(T, a + PI, w);
  for (const d of [-1.25, -0.6, 0, 0.6, 1.25]) out.push(polar(c, a + d * k, w));
}
function membraneWing(g) {
  const n = g.fingers ?? 4, W = g.W ?? [0.46, -0.03], E = [W[0] * 0.5, W[1] - 0.09 - (g.elbow ?? 0.03)];
  const f0 = g.f0 ?? 0.1, f1 = g.f1 ?? 2.1, sc = g.scallop ?? 0.42, aw = g.aw ?? 0.06, A = g.A ?? [0.02, 0.3];
  const tips = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), a = mix(f0, f1, u), l = mix(g.l0 ?? 0.76, g.l1 ?? 0.56, u) * (g.fl ?? 1);
    tips.push(polar(W, a, l));
  }
  const out = [[-0.04, -aw], [E[0], E[1] - aw], [W[0] - aw * 0.4, W[1] - aw * 1.1]];
  if (g.thumb !== false) out.push(polar(W, f0 - 1.75, 0.15), [W[0] + aw * 0.5, W[1] - aw * 0.9]);
  if (g.hook) { // the leading rib curls over forwards at its end (heraldic)
    const T = tips[0], a = f0;
    out.push(polar(W, a, mix(0, dist(W, T), 0.62)), polar(polar(W, a, dist(W, T) * 0.92), a - PI / 2, g.hook * 0.1));
  }
  for (let i = 0; i < n; i++) {
    const T = tips[i], B = i < n - 1 ? tips[i + 1] : A;
    out.push(T);
    const m = lerp(T, B, 0.5), ctl = i < n - 1 ? lerp(m, W, sc) : lerp(m, [W[0] * 0.15, W[1] + 0.05], g.gap ?? 0.75);
    out.push(...qcurve(T, ctl, B, 6));
  }
  out.push(A, [A[0] - 0.14, A[1] * 0.4]);
  return out;
}
function featherWing(g) {
  // leading edge arches out to the wing tip; feather ends lie along a convex trailing curve
  // from the tip back to the body, each pointing away from the bone line
  const n = g.feathers ?? 7, W = g.W ?? [0.46, -0.06], A = g.A ?? [0.1, 0.16], notch = g.notch ?? 0.3;
  const T0 = polar(W, g.f0 ?? 0.15, g.l0 ?? 0.62), Q = g.Q ?? [0.62, 0.62];
  const out = [[-0.04, -0.07], [W[0] * 0.5, W[1] - 0.13], [W[0], W[1] - 0.08]];
  if (g.hook) out.push(lerp(W, T0, 0.55), polar(lerp(W, T0, 0.97), angOf(W, T0) - PI / 2, g.hook * 0.1));
  const tipAt = u => { const v = u; return lerp(lerp(T0, Q, v), lerp(Q, A, v), v); };
  const boneAt = u => lerp(lerp(W, [W[0] * 0.5, W[1] * 0.5], u), [0, 0], u * u);
  let prev = null;
  for (let i = 0; i < n; i++) {
    const u = mix(0, g.span ?? 0.82, (i / (n - 1)) ** (g.bunch ?? 1.15)), T = tipAt(u), B = boneAt(u), a = angOf(B, T);
    const fw = (g.fw ?? 0.055) * mix(1, 1.3, u);
    if (prev) { const m = lerp(prev, T, 0.5); out.push(lerp(m, lerp(boneAt(u - 0.05), B, 0.5), notch)); }
    lobe(out, T, a, fw, g.round ?? 1);
    prev = T;
  }
  out.push(lerp(lerp(prev, A, 0.5), W, g.gap ?? 0.4), A, [A[0] - 0.14, A[1] * 0.4]);
  return out;
}
const WING = { membrane: membraneWing, bat: membraneWing, feather: featherWing, bird: featherWing };
dorsals.dragonWings = (C, plan, st, sd, si, g, at) => {
  const side = plan.view === 'side' && !plan.rooted, r = plan.r, k = at(g.at ?? 0.8);
  const S = Math.min(r, 8) * g.size * (plan.view === 'top' ? 0.85 : 1), shape = (WING[g.kind] ?? membraneWing)(g);
  // side view: the arm angle is mostly absolute (up, leaning back by tilt) so a pitched body
  // does not bury the trailing fingers in its own back
  const tilt = plan.rooted ? -0.3 : (g.tilt ?? 0.2), base = polar(k.p, k.dir, -r * 0.25);
  const up = side ? angDiff(k.dir, -PI / 2) * 0.35 - PI / 2 : k.dir;
  const draw = F => C.ink.poly(shape.map(q => F(q[0], q[1])));
  if (side && g.far !== false) draw(frame(polar(base, k.dir - sd * PI / 2, r * (g.farX ?? 0.1)), up + sd * (tilt - (g.farA ?? 0.42)), S * (g.farS ?? 0.88), sd));
  draw(frame(base, up + sd * tilt, S, sd));
};

// Ridges along the back: saw teeth, soft scallops, flames, a rayed fin, a mane.
// Flame crest (fire salamander): a low solid newt crest throwing up curling flame tongues.
dorsals.dragonFlames = (C, plan, st, sd, si, g, at) => {
  const { ink, rng } = C, r = plan.r, n = g.n, lean = sd * (plan.rooted ? -1 : 1) * (g.lean ?? 0.6);
  const bot = [], top = [];
  for (let i = 0; i < st.length; i++) { const u = i / (st.length - 1), k = st[i]; bot.push(polar(k.p, k.dir, -r * 0.3)); top.push(polar(k.p, k.dir, r * (g.base ?? 0.3) * Math.sin(PI * mix(0.02, 0.98, u)) ** 0.5)); }
  ink.poly(bot.concat(top.reverse()));
  // uneven flames: jittered spacing and heights, with a few tall tongues licking back
  const tall = new Set(); while (tall.size < Math.min(g.tall ?? 0, n)) tall.add(rng.int(0, n - 1));
  for (let i = 0; i < n; i++) {
    const big = tall.has(i), u = clamp((i + 0.5 + rng.range(-0.35, 0.35)) / n, 0.04, 0.96), k = at(u);
    const env = 0.55 + 0.45 * Math.sin(PI * mix(0.05, 1, u)), len = r * g.h * env * (big ? rng.range(1.35, 1.7) : rng.range(0.45, 0.9));
    const a = k.dir + lean * (big ? 1.5 : 1) + rng.range(-0.15, 0.15), b = polar(k.p, k.dir, -r * 0.05), bend = -sd * rng.range(0.15, big ? 0.35 : 0.25);
    ink.poly(lf(b, a, len, r * g.wid * (big ? 1.1 : rng.range(0.6, 0.9)), bend, 0.3));
    if (big || rng.chance(g.fork ?? 0.4)) ink.poly(lf(polar(b, a, len * 0.35), a - lean * 0.9, len * rng.range(0.35, 0.55), r * g.wid * 0.55, -bend, 0.3));
  }
};
dorsals.dragonRidge = (C, plan, st, sd, si, g, at) => {
  const { ink, rng } = C, r = plan.r, n = g.n, lean = sd * (plan.rooted ? -1 : 1) * (g.lean ?? 0.3);
  if (g.shape === 'fin') {
    const top = [], bot = [];
    for (let i = 0; i < st.length; i++) {
      const u = i / (st.length - 1), k = st[i], env = Math.sin(PI * mix(0.06, 0.94, u)) ** 0.55;
      bot.push(polar(k.p, k.dir, -r * 0.3));
      top.push(polar(k.p, k.dir + lean, r * g.h * env * (0.74 + 0.26 * Math.abs(Math.cos(PI * u * n)))));
    }
    ink.poly(bot.concat(top.reverse()));
    return;
  }
  // one outline: a base band sunk in the body, the teeth drawn as its upper edge
  const bot = [], top = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, k = at(u), env = Math.sin(PI * mix(0.16, 0.84, u)) ** 0.6, h = r * g.h * env * rng.range(0.9, 1.1), bw = r * (g.wid ?? 0.3);
    const b = polar(k.p, k.dir, -r * 0.25), along = k.dir + PI / 2;
    bot.push(polar(b, along, -bw), polar(b, along, bw));
    if (g.shape === 'scallop') {
      for (let j = 0; j <= 6; j++) { const a = PI * j / 6; top.push(polar(polar(b, along, -bw * 1.15 * Math.cos(a)), k.dir, (h * 0.55 + r * 0.25) * Math.sin(a) ** 0.8)); }
      continue;
    }
    const kind = g.shape, ln = kind === 'flame' ? h * 1.7 + r * 0.25 : kind === 'mane' ? h * 1.5 + r * 0.25 : h + r * 0.25;
    const a = k.dir + lean + (kind === 'mane' ? 0.5 * sd : 0) + (kind === 'flame' ? rng.range(-0.2, 0.2) : 0);
    const tip = polar(b, a, ln), bend = kind === 'flame' ? rng.range(0.1, 0.3) * rng.sign() : kind === 'mane' ? sd * 0.25 : 0;
    const w = kind === 'saw' || !kind ? bw : bw * (kind === 'flame' ? 1.1 : 0.9);
    const mid = polar(polar(b, a, ln * 0.45), a + PI / 2, bend * ln);
    top.push(polar(b, along, -w), polar(mid, along, -w * 0.55), tip, polar(mid, along, w * 0.55), polar(b, along, w));
  }
  ink.poly(bot.concat(top.reverse()));
};

// ---------------------------------------------------------------- tail tips
const barb = (ink, e, a, q) => ink.poly([polar(e, a, q * 1.75), polar(e, a + 2.25, q * 1.05), polar(e, a + PI, -q * 0.15), polar(e, a - 2.25, q * 1.05)]);
const trefoil = (ink, e, a, q) => {
  ink.poly(lf(polar(e, a, -q * 0.2), a, q * 2, q * 1.15, 0, 0.55));
  for (const sd of [-1, 1]) ink.poly(lf(polar(e, a, -q * 0.1), a + sd * 1.05, q * 1.45, q * 0.95, sd * 0.12, 0.55));
};
function tipEnd(C, kind, e, a, s, g) {
  const q = s * (g.tipS ?? 1) * 0.85, ink = C.ink;
  if (kind === 'barb') barb(ink, e, a, q);
  else if (kind === 'trefoil') trefoil(ink, e, a, q);
  else if (kind === 'head') { // g.face2: the tail head turns to face the front head
    const hp = C.plan.head?.p, ang = g.face2 && hp ? angOf(e, [hp[0], hp[1] - C.plan.r * g.face2]) : a;
    const hs = s * (g.tipS ?? 1) * 0.95, m = miniHead(ink, e, ang, hs, { gape: g.gape2 ?? 0.4 });
    if (hs > 1.6) { ink.dot(m.eye, Math.max(hs * 0.24, 0.7), 'w'); ink.dot(m.eye, Math.max(hs * 0.11, 0.38), 'k2'); }
  }
  else if (kind === 'fluke') for (const sd of [-1, 1]) ink.poly(lf(polar(e, a, -q * 0.3), a + sd * 0.72, q * 2.3, q * 1.1, sd * 0.18, 0.55));
  else if (kind === 'flame') for (const [da, k] of [[-0.6, 0.8], [0, 1.3], [0.55, 0.9]]) ink.poly(lf(polar(e, a, -q * 0.3), a + da, q * 2 * k, q * 0.95, da * 0.5 + 0.12, 0.42));
}
tips.dragonBarb = (C, e, a, s, g) => tipEnd(C, 'barb', e, a, s, g);
tips.dragonTrefoil = (C, e, a, s, g) => tipEnd(C, 'trefoil', e, a, s, g);
tips.dragonHead2 = (C, e, a, s, g) => tipEnd(C, 'head', e, a, s, g);
tips.dragonFluke = (C, e, a, s, g) => tipEnd(C, 'fluke', e, a, s, g);
tips.dragonFlame = (C, e, a, s, g) => tipEnd(C, 'flame', e, a, s, g);
// The tail ties a loop (the medieval overhand knot), runs on, and ends in g.tip2.
tips.dragonKnot = (C, e, a, s, g, curl) => {
  const { ink } = C, side = C.plan.view === 'side', w = Math.max(g.w1 * s, 1.15), R = Math.max(s * (g.knotR ?? 1.5), w * 2 + 1.8);
  let sg = curl >= 0 ? 1 : -1;
  if (side) sg = polar(e, a + PI / 2, R)[1] < polar(e, a - PI / 2, R)[1] ? 1 : -1; // loop upwards
  const n = 30, turn = TAU + (g.knotOver ?? -0.5), L = R * turn, pts = [e];
  let p = e, h = a;
  for (let i = 1; i <= n; i++) { h = a + sg * turn * (i - 0.5) / n; p = polar(p, h, L / n); pts.push(p); }
  const L2 = s * (g.knotOut ?? 2.2), a2 = a + sg * turn;
  for (let i = 1; i <= 8; i++) { h = a2 - sg * 0.9 * (i / 8); p = polar(p, h, L2 / 8); pts.push(p); }
  if (side) { const lim = -w - 0.4; for (const q of pts) if (q[1] > lim) q[1] = lim; }
  ink.poly(tube(pts, profile([[0, w], [0.7, w * 0.9], [1, Math.max(w * 0.6, 0.6)]])));
  tipEnd(C, g.tip2 ?? 'barb', p, angOf(pts[pts.length - 3], p), s, g);
};
// Romanesque scroll: the tail winds into a spiral and throws off leaves as it goes.
tips.dragonScroll = (C, e, a, s, g, curl) => {
  const { ink } = C, side = C.plan.view === 'side', w = Math.max(g.w1 * s, 1.1), q = s * (g.tipS ?? 1);
  let sg = curl >= 0 ? 1 : -1;
  if (side) sg = polar(e, a + PI / 2, 5)[1] < polar(e, a - PI / 2, 5)[1] ? 1 : -1;
  const n = 26, pts = [e], L = q * 7.5; let p = e, h = a;
  for (let i = 1; i <= n; i++) {
    const u = i / n; h += sg * (0.7 + 5.2 * u * u) * 1.25 / n * 1.6; p = polar(p, h, L / n * (1.25 - 0.85 * u));
    if (side && p[1] > -w - 0.4) p = [p[0], -w - 0.4];
    pts.push(p);
    if (i % 6 === 3 && i < n - 4) ink.poly(lf(p, h - sg * 1.25, q * 1.7 * (1.15 - u * 0.5), q * 0.95, -sg * 0.15, 0.5));
  }
  ink.poly(tube(pts, profile([[0, w], [1, w * 0.8]])));
  dt(ink, p, w * 1.25);
};

// ---------------------------------------------------------------- feet
// Three splayed talons and a hind spur, as ONE outline (feet were a third of all vertices).
feet.dragonTalon = (C, p, ang, s, g, k) => {
  const tl = (g.toeLen ?? 0.75) * s * k, side = C.plan.view === 'side', w = Math.max(s * 0.15 * k, 0.75);
  const toes = side ? [[-0.5, 0.95], [-0.05, 1.05], [0.35, 0.8], [PI - 0.25, 0.5]] : [[-0.6, 0.9], [0, 1], [0.6, 0.9]];
  const out = [];
  toes.sort((u, v) => u[0] - v[0]);
  toes.forEach(([da, l], i) => {
    const a = ang + da, t = polar(p, a, tl * l), hook = side ? 1 : 0;
    out.push(polar(p, a - 0.5, w * 1.1), polar(lerp(p, t, 0.6), a - PI / 2, w * 0.55), polar(t, a + PI / 2, w * 0.2 * hook), t, polar(lerp(p, t, 0.6), a + PI / 2, w * 0.5), polar(p, a + 0.5, w * 1.1));
    const nx = toes[(i + 1) % toes.length][0] + (i === toes.length - 1 ? TAU : 0);
    if (nx - da > 1.4) out.push(polar(p, ang + (da + nx) / 2, w * 1.3));
  });
  C.ink.poly(out);
};

// ---------------------------------------------------------------- crowns
// Ears and horns as small single outlines (the shared ones are tubes of ~40 vertices each).
function blade(F, a0, len, wid, bend, fat, hook = 0) { // F-frame leaf from (-0.15,0) along local angle a0
  const L = [], Rr = [], n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = wid * 0.5 * (t < fat ? Math.sin(PI / 2 * t / fat) * 0.75 + 0.25 : Math.cos(PI / 2 * (t - fat) / (1 - fat))), off = bend * len * 4 * t * (1 - t) + hook * len * t * t * t;
    const x = -0.15 + Math.cos(a0) * len * t - Math.sin(a0) * off, y = Math.sin(a0) * len * t + Math.cos(a0) * off;
    L.push([x - Math.sin(a0) * w, y + Math.cos(a0) * w]); Rr.push([x + Math.sin(a0) * w, y - Math.cos(a0) * w]);
  }
  return L.concat(Rr.slice(0, n).reverse()).map(q => F(q[0], q[1]));
}
crowns.dragonEar = (C, m, F, s, g) => C.ink.poly(blade(F, g.lean ?? 0, g.len, g.wid, g.bend ?? 0, g.fat ?? 0.45));
crowns.dragonHorn = (C, m, F, s, g) => C.ink.poly(blade(F, 0, g.len, g.wid * 1.6, g.curve * 0.25, 0.08, g.curve * 0.4));

// Cock's comb: one solid blade along the top of the skull, its top edge cut into big points.
crowns.dragonComb = (C, m, F, s, g) => {
  const n = g.n ?? 5, y0 = g.y0 ?? -1.15, y1 = g.y1 ?? 0.55, out = [F(-0.3, y1), F(-0.3, y0)];
  for (let i = 0; i <= 2 * n; i++) {
    const u = i / (2 * n), y = mix(y0, y1, u), env = g.len * (0.75 + 0.45 * Math.sin(PI * mix(0.15, 1, u)));
    out.push(F(i % 2 ? env : env * 0.5 + (i === 0 || i === 2 * n ? -0.2 : 0), y + (i % 2 ? -0.08 : 0)));
  }
  C.ink.poly(out);
};
// The basilisk's little crown: a band and three points.
crowns.dragonCrown = (C, m, F, s, g) => {
  const { ink } = C, h = g.len, y0 = -0.95, y1 = 0.15;
  ink.poly([F(-0.2, y0), F(h * 0.3, y0 - 0.06), F(h * 0.3, y1 + 0.06), F(-0.2, y1)]);
  for (let i = 0; i < 3; i++) {
    const y = mix(y0 + 0.08, y1 - 0.08, i / 2), top = F(h * (i === 1 ? 1.05 : 0.85), y + (i - 1) * 0.1);
    ink.poly([F(h * 0.2, y - 0.2), top, F(h * 0.2, y + 0.2)]);
    dt(ink, top, 0.17 * s);
  }
};
// Branching antler (the long).
crowns.dragonAntler = (C, m, F, s, g) => {
  const { ink } = C, L = g.len, w = Math.max(s * 0.2, 1);
  const beam = spline([F(-0.1, 0), F(L * 0.5, L * 0.12), F(L, L * 0.42)], 6);
  ink.poly(tube(beam, profile([[0, w * 0.6], [1, Math.max(w * 0.3, 0.42)]])));
  for (const [t, a, l] of [[0.4, -0.75, 0.45], [0.72, -0.7, 0.32]]) { const b = pathAt(beam, t); ink.poly(tube(polyline([b.p, polar(b.p, b.ang + m.flip * a, L * l * s)], 3), profile([[0, w * 0.45], [1, Math.max(w * 0.28, 0.42)]]))); }
};
// Lappet: a ribbon from the back of the head ending in a curl (Urnes / Ringerike).
crowns.dragonLappet = (C, m, F, s, g) => {
  const pts = grow(F(-0.1, 0), m.dir + m.flip * 0.35, g.len * s, u => m.flip * (0.5 * u + (g.curl ?? 4.2) * u * u * u), 18);
  const w = Math.max(s * 0.17, 0.95);
  C.ink.poly(tube(pts, profile([[0, w], [0.8, w * 0.75], [1, w * 0.7]])));
  dt(C.ink, pts[pts.length - 1], w * 1.25);
};

// ---------------------------------------------------------------- gene helpers
const eye = () => ({ eyes: 'dot', eyeS: 1.1 });
const dog = (r, o = {}) => ({ type: 'dragonHead', skull: r.range(0.88, 1), mz: r.range(1.5, 2.05), tipR: r.range(0.36, 0.46), up: r.range(-0.14, 0.04), gape: r.chance(0.72) ? r.range(0.3, 0.55) : 0, jawK: r.range(0.8, 0.95), tongue: r.wpick([[2, 'barb'], [1, 'fork'], [3, null]]), nose: r.chance(0.7) ? r.range(0.45, 0.6) : 0, brow: r.chance(0.6) ? r.range(0.26, 0.34) : 0, beard: r.chance(0.2) ? r.range(0.7, 1) : 0, ...o });
const pug = (r, o = {}) => ({ type: 'dragonHead', skull: r.range(0.98, 1.1), mz: r.range(0.8, 1.15), tipR: r.range(0.52, 0.64), up: r.range(-0.3, -0.12), gape: r.chance(0.75) ? r.range(0.35, 0.6) : 0, jawK: r.range(0.95, 1.12), tongue: r.wpick([[1, 'barb'], [3, null]]), nose: r.range(0.45, 0.6), brow: r.range(0.3, 0.4), ...o });
const longjaw = (r, o = {}) => ({ type: 'dragonHead', skull: r.range(0.82, 0.92), mz: r.range(2.3, 2.9), tipR: r.range(0.28, 0.36), up: r.range(-0.1, 0.05), gape: r.range(0.28, 0.5), jawK: r.range(0.88, 0.97), tongue: r.wpick([[2, 'barb'], [2, 'fork'], [2, null]]), nose: r.range(0.5, 0.7), brow: r.range(0.26, 0.32), ...o });
const beak = (r, o = {}) => ({ type: 'dragonHead', beak: true, skull: r.range(0.88, 1), mz: r.range(1.25, 1.7), gape: r.chance(0.6) ? r.range(0.25, 0.5) : 0.02, ...o });
const sneck = (r, a = 2.2, b = 3.4) => ({ len: r.range(a, b), sway: r.range(0.6, 1.15), w0: 0.72, w1: r.range(0.48, 0.56) });
const legs = (r, o = {}) => ({ len: r.range(2, 2.5), w: 0.5, taper: 0.55, bend: 1, foot: 'dragonTalon', toeLen: r.range(0.62, 0.8), lift: r.range(0.7, 1), stance: 0.35, hindW: 1.4, arm: 0.8, ...o });
const tl = (r, o = {}) => ({ tailLen: r.range(8, 11.5), w0: 0.9, mid: 0.5, w1: 0.16, curl: r.range(0.8, 1.8), wave: r.range(0.6, 1.6), freq: 1, up: true, tip: 'dragonBarb', tipS: 1, ...o });
const knot = (r, o = {}) => tl(r, { tailLen: r.range(6.5, 9), w1: 0.26, curl: r.range(0.5, 1.4), tip: 'dragonKnot', tip2: r.wpick([[3, 'barb'], [1, 'trefoil']]), knotOut: r.range(2.8, 4), knotOver: r.range(-0.8, -0.2), ...o });
const coil = (r, o = {}) => tl(r, { tailLen: r.range(10, 14), curl: r.range(4.6, 6.6), wave: 0, spiral: true, tip: r.wpick([[2, 'dragonBarb'], [1, 'point']]), tipS: 0.8, ...o });
// Wing presets: each is a distinct silhouette, not new numbers on one template.
const WG = (r, kind, o) => ({ type: 'dragonWings', kind, at: r.range(0.72, 0.86), ...o });
const heraldic = (r, o = {}) => WG(r, 'membrane', { size: r.range(3, 3.7), fingers: r.int(4, 5), W: [0.5, -0.04], tilt: r.range(0.45, 0.65), f0: r.range(-0.25, -0.05), f1: r.range(2.1, 2.3), l0: 0.82, l1: 0.5, scallop: r.range(0.5, 0.6), hook: r.range(0.5, 1), farA: r.range(0.25, 0.4), farS: 0.85, ...o });
const batw = (r, o = {}) => WG(r, 'membrane', { size: r.range(3, 3.7), fingers: r.int(3, 4), W: [0.5, -0.04], tilt: r.range(0.55, 0.8), f0: r.range(0.05, 0.25), f1: r.range(2.1, 2.35), l0: 0.72, l1: 0.5, scallop: r.range(0.5, 0.6), farA: r.range(0.45, 0.6), farS: 0.8, ...o });
const roundw = (r, o = {}) => WG(r, 'membrane', { size: r.range(2.7, 3.3), fingers: r.int(5, 6), W: [0.3, -0.02], tilt: r.range(0.75, 1), f0: r.range(-0.55, -0.4), f1: r.range(1.9, 2.1), l0: 0.7, l1: 0.6, A: [0.02, 0.3], scallop: r.range(0.3, 0.38), thumb: false, farA: r.range(0.45, 0.6), farS: 0.8, ...o });
const folded = (r, o = {}) => WG(r, 'membrane', { size: r.range(3.4, 4.2), fingers: 3, W: [0.4, -0.06], tilt: r.range(0.75, 0.95), f0: r.range(1.0, 1.15), f1: r.range(1.6, 1.8), l0: r.range(0.95, 1.1), l1: 0.8, A: [-0.06, 0.45], scallop: 0.28, farA: 0.12, farS: 0.8, ...o });
const stub = (r, o = {}) => WG(r, 'membrane', { size: r.range(1.8, 2.4), fingers: 3, tilt: r.range(0.1, 0.4), f0: 0.15, f1: 1.8, A: [-0.06, 0.45], scallop: 0.4, far: r.chance(0.5), ...o });
const feather = (r, o = {}) => WG(r, 'feather', { size: r.range(3.1, 3.8), feathers: r.int(6, 8), W: [0.5, -0.05], tilt: r.range(0.2, 0.45), f0: r.range(-0.05, 0.15), l0: r.range(0.55, 0.65), Q: [r.range(0.75, 0.85), r.range(0.45, 0.6)], notch: r.range(0.25, 0.35), fw: 0.05, gap: 0.55, farA: r.range(0.3, 0.45), ...o });
const leafy = (r, o = {}) => WG(r, 'feather', { size: r.range(2.9, 3.5), feathers: r.int(4, 5), tilt: r.range(0, 0.25), f0: r.range(-0.3, -0.1), l0: 0.5, Q: [0.6, 0.7], notch: 0.32, fw: 0.12, bunch: 0.9, hook: r.range(0.8, 1.2), round: 0.8, farA: 0.5, ...o });
export const wingPresets = { heraldic, batw, roundw, folded, stub, feather, leafy };
const ridge = (r, shape, o = {}) => ({ type: 'dragonRidge', shape, n: r.int(6, 10), h: r.range(0.5, 0.8), wid: 0.3, lean: 0.35, ...o });
const horns = (r, o = {}) => ({ type: 'dragonHorn', len: r.range(1.3, 2.3), curve: r.range(-0.5, 0.5), wid: 0.55, pair: true, ...o });
const ears = (r, o = {}) => ({ type: 'dragonEar', len: r.range(1.3, 2), wid: r.range(0.6, 0.8), lean: r.range(-0.5, -0.1), bend: 0.08, fat: 0.4, pair: true, ...o });
const longEars = (r, o = {}) => ({ type: 'dragonEar', len: r.range(2.4, 3.4), wid: r.range(0.65, 0.85), lean: r.range(-0.6, -0.15), bend: r.range(0.05, 0.14), fat: 0.45, pair: true, ...o });
const beast = (r, o = {}) => ({ type: 'dragonBeast', r: r.range(6.4, 8), len: r.range(17, 23), pitch: 0, arch: r.range(0.2, 0.45), headS: r.range(0.66, 0.78), ...o });
const serpent = (r, o = {}) => ({ type: 'dragonSerpent', r: r.range(4.4, 5.6), headS: r.range(0.95, 1.1), ...o });

// ---------------------------------------------------------------- species
const species = [
  { name: 'bestiary draco', w: 3, genes: r => ({ // Aberdeen/Harley: winged, two-legged, small eared head, long looping tail
    chassis: beast(r, { legs: 'biped', pitch: r.range(-0.05, 0.12), r: r.range(6.8, 7.8), len: r.range(19, 23), headS: r.range(0.62, 0.72), legAt: 0.35, tailLift: r.range(-0.1, 0.15) }),
    head: dog(r, { neck: sneck(r, 2.8, 3.8), mz: r.range(1.35, 1.75) }),
    limbs: legs(r, { lift: r.range(0.9, 1.1) }), tail: r.wpick([[3, tl(r, { tailLen: r.range(10, 12.5), w1: 0.22, curl: r.range(0.3, 0.7), wave: r.range(0.3, 0.7), up: false })], [1.5, tl(r, { tailLen: r.range(9.5, 12), w1: 0.24, curl: r.range(0.4, 0.8), wave: 0.4, up: false, tip: 'dragonScroll', tipS: r.range(1, 1.25) })]]),
    dorsal: feather(r, { tilt: r.range(0.3, 0.5), size: r.range(3, 3.5), feathers: r.int(5, 6) }), crown: ears(r), surface: eye(),
  }) },
  { name: 'wyvern', w: 3.4, genes: r => ({
    chassis: beast(r, { legs: 'biped', pitch: r.range(0.85, 1.05), len: r.range(15, 19), legAt: 0.05, neckA: r.range(-1.4, -1.1), tailLift: -0.4 }),
    head: r.wpick([[2, dog(r, { neck: sneck(r, 1.6, 2.6), gape: r.range(0.35, 0.55), tongue: 'barb' })], [1, longjaw(r, { neck: sneck(r, 1.4, 2.2) })]]),
    limbs: legs(r, { lift: r.range(0.9, 1.2) }), tail: r.wpick([[2, coil(r, { tailLen: r.range(9, 12), up: false })], [2, tl(r, { up: false, curl: r.range(2, 3), tailLen: r.range(8, 10) })]]),
    dorsal: batw(r, { size: r.range(4.2, 5), tilt: r.range(0.9, 1.2), at: r.range(0.6, 0.72) }), crown: r.wpick([[2, horns(r)], [2, ears(r)]]), surface: eye(),
  }) },
  { name: 'heraldic dragon passant', w: 3, genes: r => ({
    chassis: beast(r, { legs: 'quad', pawUp: true, pitch: r.range(-0.04, 0.06), len: r.range(21, 26), liftK: 1.6 }),
    head: dog(r, { neck: sneck(r, 1.5, 2.4), gape: r.range(0.35, 0.5), tongue: 'barb', beard: r.chance(0.4) ? 0.8 : 0 }),
    limbs: legs(r, { len: r.range(2.4, 2.8) }), tail: tl(r, { curl: r.range(2.2, 3), wave: r.range(0.8, 1.3), tailLen: r.range(9, 12) }),
    dorsal: folded(r, { at: r.range(0.55, 0.65) }), crown: horns(r), surface: eye(),
  }) },
  { name: 'dragon rampant', w: 2, genes: r => ({
    chassis: beast(r, { legs: 'rampant', pitch: r.range(1.0, 1.22), len: r.range(17, 21), neckA: r.range(-1.35, -1.1), tailLift: -0.3 }),
    head: dog(r, { neck: sneck(r, 1.4, 2.2), gape: r.range(0.35, 0.55), tongue: r.pick(['barb', 'flame']) }),
    limbs: legs(r, { lift: r.range(0.75, 1), arm: 0.9 }), tail: tl(r, { up: true, curl: r.range(1.8, 2.6), wave: 0.5, tailLen: r.range(8, 10) }),
    dorsal: heraldic(r, { at: r.range(0.6, 0.74) }), crown: r.wpick([[2, horns(r)], [1, ears(r)]]), surface: eye(),
  }) },
  { name: 'dragon sejant', w: 1.6, genes: r => ({ // sits like a dog, forelegs straight
    chassis: beast(r, { legs: 'sejant', pitch: r.range(0.8, 1.0), len: r.range(14, 17), r: r.range(6.6, 8), neckA: r.range(-1.3, -1), tailLift: -0.2, belly: 1.08 }),
    head: r.wpick([[2, dog(r, { neck: sneck(r, 1, 1.8) })], [1, pug(r, { neck: sneck(r, 0.8, 1.2) })]]),
    limbs: legs(r, { lift: 0.14, w: 0.44, stance: 0.5 }), tail: r.wpick([[2, tl(r, { up: false, curl: 0.3, wave: 1.4, tailLen: r.range(7, 9) })], [1, coil(r, { tailLen: r.range(8, 10) })]]),
    dorsal: r.wpick([[2, folded(r, { at: r.range(0.62, 0.76) })], [1, batw(r, { at: r.range(0.62, 0.76) })]]), crown: r.wpick([[2, ears(r)], [1, horns(r)]]), surface: eye(),
  }) },
  { name: 'saint george dragon', w: 2.6, genes: r => ({ // small, squat, pug-faced, glaring up
    chassis: beast(r, { legs: 'quad', len: r.range(14, 18), r: r.range(7, 8.6), pitch: r.range(0.05, 0.25), headS: r.range(0.8, 0.92), neckA: r.range(-1.1, -0.7), face: r.range(-0.5, -0.15), belly: 1.08 }),
    head: pug(r, { neck: r.chance(0.5) ? sneck(r, 0.8, 1.4) : null }),
    limbs: legs(r, { lift: r.range(0.4, 0.6), len: r.range(1.6, 2) }), tail: r.wpick([[3, coil(r, { tailLen: r.range(8, 11) })], [1.5, knot(r, { tailLen: r.range(5, 7) })]]),
    dorsal: r.wpick([[3, roundw(r, { size: r.range(2.6, 3.2) })], [1, stub(r)]]), crown: r.wpick([[2, ears(r, { len: r.range(1, 1.5) })], [1, horns(r, { len: r.range(0.9, 1.4) })], [1, none()]]), surface: eye(),
  }) },
  { name: 'saint margaret dragon', w: 1.6, genes: r => ({ // all belly and gaping mouth
    chassis: beast(r, { legs: 'quad', len: r.range(15, 19), r: r.range(8.2, 9.6), pitch: r.range(0, 0.12), arch: r.range(0.4, 0.7), headS: r.range(0.95, 1.1), neckA: r.range(-0.6, -0.3), neckL: 1.1, neckW: 0.7, face: r.range(-0.25, 0) }),
    head: dog(r, { gape: r.range(0.7, 0.95), jawK: r.range(0.9, 1), mz: r.range(1.5, 1.9), tipR: r.range(0.42, 0.5), tongue: r.pick(['barb', null]) }),
    limbs: legs(r, { lift: r.range(0.3, 0.5), len: r.range(1.5, 1.9) }), tail: r.wpick([[2, knot(r, { tailLen: r.range(4.5, 6.5) })], [1, tl(r, { tailLen: r.range(6, 8), curl: 2.2 })]]),
    dorsal: r.wpick([[2, stub(r)], [1.5, ridge(r, 'saw')], [1, none()]]), crown: ears(r, { len: r.range(0.9, 1.3) }), surface: eye(),
  }) },
  { name: 'luttrell dragonet', w: 3.2, genes: r => ({ // Gothic margin two-legger: long ears, foliate tail
    chassis: beast(r, { legs: 'biped', pitch: r.range(0.15, 0.45), len: r.range(13, 17), r: r.range(6, 7.4), headS: r.range(0.72, 0.85), legAt: 0.3 }),
    head: r.wpick([[1.5, beak(r, { neck: sneck(r, 1.6, 2.8) })], [1, dog(r, { neck: sneck(r, 1.6, 2.8), mz: r.range(1.2, 1.6) })], [1.5, beak(r, { regard: true, neck: sneck(r, 2.6, 3.4), lookDown: r.range(-0.1, 0.3) })]]), // regardant: looks back over its shoulder
    limbs: legs(r, { lift: r.range(0.8, 1.1) }),
    tail: r.wpick([[2, tl(r, { tip: 'dragonTrefoil', curl: r.range(1.2, 2.4), w1: 0.2 })], [1.5, knot(r, { tip2: 'trefoil' })], [1.5, tl(r, { tailLen: r.range(4, 6), w1: 0.22, tip: 'dragonScroll', curl: 0.8 })]]),
    dorsal: r.wpick([[2, none()], [1.2, stub(r)], [1, leafy(r, { size: r.range(2.2, 2.8) })], [1, ridge(r, 'scallop')]]), crown: longEars(r), surface: eye(),
  }) },
  { name: 'cockatrice', w: 2.6, genes: r => ({ // a cock with a serpent tail: upright, combed and wattled, wing raised
    chassis: beast(r, { legs: 'biped', pitch: r.range(0.75, 0.95), len: r.range(10, 12), r: r.range(7, 7.8), headS: r.range(0.8, 0.9), legAt: 0.3, chest: r.range(1.3, 1.45), belly: r.range(1.15, 1.25), arch: 0.1, neckW: 0.6, neckA: r.range(-1.6, -1.35), tailLift: r.range(0.1, 0.4) }),
    head: beak(r, { neck: sneck(r, 0.8, 1.3), mz: r.range(1, 1.3), wattle: r.range(1.5, 1.9), gape: r.chance(0.6) ? r.range(0.25, 0.45) : 0.02 }),
    limbs: legs(r, { len: r.range(2.4, 2.8), w: 0.46, hindW: 1, lift: 1, stance: 0.15, toeLen: r.range(0.9, 1.05) }),
    tail: tl(r, { tailLen: r.range(7, 8.5), up: true, curl: r.range(2, 2.8), wave: 0.3, w1: 0.24, tip: 'dragonBarb' }),
    dorsal: r.wpick([[2, stub(r, { at: r.range(0.55, 0.65), size: r.range(2, 2.5), far: false })], [1, feather(r, { at: 0.6, size: r.range(1.9, 2.3), feathers: 4, tilt: r.range(0.9, 1.2), far: false })]]), crown: { type: 'dragonComb', len: r.range(1.5, 1.9), n: r.int(4, 5), y0: -1.9, y1: -0.3 }, surface: eye(),
  }) },
  { name: 'basilisk', w: 1.6, genes: r => r.chance(0.5) ? ({ // the crowned king of serpents: coiled and reared, crowned
    chassis: serpent(r, { mode: 'spiral', turns: r.range(1.05, 2), gapW: r.range(1.3, 2.6), r: r.range(3.2, 4.2), rise: r.range(2.8, 5.2), riseA: r.range(0.95, 1.5), headS: r.range(1.15, 1.3), backT: [0.82, 0.97], radKeys: [[0, 0.4], [0.25, 0.9], [0.7, 1], [1, 0.75]] }),
    head: dog(r, { mz: r.range(1.1, 1.4), tongue: 'fork', gape: r.range(0.3, 0.5), neck: sneck(r, 0.6, 1), brow: 0.3 }),
    limbs: none(), tail: none(),
    dorsal: r.wpick([[1, none()], [1, stub(r, { at: 0.5, far: false, size: r.range(3, 3.6) })]]), crown: { type: 'dragonCrown', len: r.range(1.6, 2) }, surface: eye(),
  }) : ({ // or reared on a cock's legs
    chassis: serpent(r, { mode: 'wave', len: r.range(12, 15), r: r.range(5.8, 6.6), amp: 0, humps: 1, rise: r.range(4.5, 5.5), riseA: r.range(1.35, 1.55), clear: r.range(2.4, 2.8), clearT: [0.1, 0.4], legsAt: [{ t: 0.45, role: 'hind' }], legS: 1.1, headS: r.range(0.95, 1.05), backT: [0.3, 0.7], radKeys: [[0, 0.5], [0.3, 1], [0.55, 1.05], [0.8, 0.75], [1, 0.62]] }),
    head: dog(r, { neck: sneck(r, 0.5, 0.9), mz: r.range(1.1, 1.3), tongue: 'fork', gape: r.range(0.35, 0.55), brow: 0.3 }),
    limbs: legs(r, { len: r.range(2.4, 2.8), w: 0.52, hindW: 1, lift: 1, stance: 0.15, toeLen: r.range(0.85, 1) }), tail: coil(r, { tailLen: r.range(9, 11), w0: 0.85, up: true, tip: 'point' }),
    dorsal: r.wpick([[2, stub(r, { at: 0.6, size: r.range(2.8, 3.3), far: false })], [1, ridge(r, 'saw', { n: r.int(5, 7), h: 0.7 })]]), crown: { type: 'dragonCrown', len: r.range(1.6, 2) }, surface: eye(),
  }) },
  { name: 'lindworm', w: 2.2, genes: r => ({ // wingless, two stout forelegs, the rest serpent tied in a loop
    chassis: serpent(r, { mode: r.wpick([[2, 'loop'], [1, 'wave']]), r: r.range(6, 7), len: r.range(26, 34), amp: r.range(0.6, 1.4), humps: r.int(1, 2), loopR: r.range(0.9, 1.4), rise: r.range(2.4, 3.2), riseA: r.range(0.9, 1.2), clear: r.range(1.1, 1.4), clearT: [0.6, 0.78], legsAt: [{ t: 0.84, role: 'fore' }], legS: 1.1, headS: r.range(0.8, 0.92), loopAt: r.range(0.25, 0.4), radKeys: [[0, 0.3], [0.25, 0.75], [0.6, 0.95], [0.85, 1], [1, 0.7]] }),
    head: r.wpick([[2, dog(r, { neck: sneck(r, 0.9, 1.5), beard: r.chance(0.4) ? 0.9 : 0 })], [1, longjaw(r, { neck: sneck(r, 0.8, 1.3) })]]),
    limbs: legs(r, { lift: 1, w: 0.6, hindW: 1, len: r.range(2, 2.4) }), tail: r.wpick([[2, tl(r, { tailLen: r.range(4, 6), up: true, curl: r.range(1, 2), tip: 'dragonBarb', w1: 0.24 })], [1, knot(r, { tailLen: r.range(3, 4.5) })]]),
    dorsal: r.wpick([[2, ridge(r, 'mane', { n: r.int(5, 8), h: r.range(0.6, 0.85) })], [1.5, ridge(r, 'saw', { n: r.int(8, 12), h: 0.6 })], [1, none()]]), crown: r.wpick([[2, ears(r)], [1, horns(r)]]), surface: eye(),
  }) },
  { name: 'amphisbaena', w: 2, genes: r => ({ // a low two-legged dragon whose tail, held high, ends in a second head
    chassis: beast(r, { legs: 'biped', pitch: r.range(-0.05, 0.1), r: r.range(6.6, 7.4), len: r.range(17, 20), headS: r.range(0.68, 0.78), legAt: 0.4, tailLift: r.range(0.1, 0.3) }),
    head: dog(r, { neck: { ...sneck(r, 2.2, 2.8), sway: r.range(-0.6, -0.2) }, tilt: r.range(-2.75, -2.5), gape: r.range(0.45, 0.65) }),
    limbs: legs(r, { lift: 1, w: 0.55, len: r.range(2.3, 2.7) }), tail: tl(r, { tailLen: r.range(5.5, 7), w0: 1, w1: 0.6, mid: 0.4, up: true, curl: r.range(0.7, 1.1), wave: 0.2, tip: 'dragonHead2', tipS: r.range(1.45, 1.65), gape2: r.range(0.6, 0.8), face2: r.range(-0.2, 0.5) }),
    dorsal: r.wpick([[1, stub(r, { at: 0.6, far: false })], [2, none()]]), crown: ears(r), surface: eye(),
  }) },
  { name: 'fire salamander', w: 1.5, genes: r => ({ // the salamander that lives in fire: a low crested newt, its crest and tail all flame
    chassis: { type: 'dragonNewt', r: r.range(7.3, 8.4), len: r.range(15, 17.5), tailL: r.range(1.1, 1.3), tailUp: r.range(0.7, 1.3), arch: r.range(0.1, 0.3), headS: r.range(0.85, 0.95), liftK: 1.3, neckA: r.range(-0.55, -0.3) },
    head: dog(r, { mz: r.range(0.95, 1.2), tipR: r.range(0.5, 0.58), skull: r.range(0.85, 0.95), up: -0.05, gape: 0, tongue: null, nose: 0, brow: 0, beard: 0 }),
    limbs: legs(r, { len: r.range(2, 2.3), w: 0.62, lift: 0.7, stance: 0.4, hindW: 1.15 }), tail: tl(r, { tailLen: 1, w0: 0.3, w1: 0.2, curl: 0, wave: 0, tip: 'dragonFlame', tipS: r.range(1.2, 1.5) }),
    dorsal: { type: 'dragonFlames', n: r.int(5, 7), h: r.range(2.5, 3.1), wid: 0.5, lean: r.range(0.45, 0.7), base: 0.32, tall: r.int(2, 3) }, crown: none(), surface: eye(),
  }) },
  { name: 'jaculus', w: 1.5, genes: r => ({ // the javelin-snake that flies
    chassis: serpent(r, { mode: 'wave', len: r.range(24, 32), amp: r.range(2.4, 3.6), humps: 1, rise: r.range(3, 4.5), riseA: r.range(0.7, 1.1), backT: [0.5, 0.92], r: r.range(4.2, 5) }),
    head: dog(r, { mz: r.range(1.3, 1.7), tongue: 'fork', gape: r.range(0.3, 0.45), neck: sneck(r, 0.6, 1.2) }),
    limbs: none(), tail: tl(r, { tailLen: r.range(5, 8), up: r.chance(0.5), curl: r.range(0.6, 1.4), tip: r.pick(['dragonBarb', 'point']) }),
    dorsal: r.wpick([[2, feather(r, { at: 0.72, size: r.range(5, 6), tilt: r.range(0.3, 0.55) })], [1, batw(r, { at: 0.72, size: r.range(5, 6) })]]), crown: r.wpick([[1, ears(r)], [1, none()]]), surface: eye(),
  }) },
  { name: 'hydra', w: 2, genes: r => ({
    chassis: beast(r, { legs: r.pick(['quad', 'biped']), extraNecks: r.int(2, 4), pitch: r.range(0.1, 0.3), len: r.range(17, 21), r: r.range(7, 8.4), headS: r.range(0.56, 0.64), legAt: 0.3, neckA: r.range(-0.5, -0.2) }),
    head: dog(r, { neck: sneck(r, 2.4, 3.4), mz: r.range(1.4, 1.7), tongue: r.pick(['fork', null]) }),
    limbs: legs(r, { lift: r.range(0.5, 0.8) }), tail: r.wpick([[2, tl(r, { curl: r.range(1, 2) })], [1, knot(r)]]),
    dorsal: r.wpick([[2, none()], [1, ridge(r, 'saw', { n: r.int(4, 6) })]]), crown: ears(r, { len: r.range(1, 1.4) }), surface: eye(),
  }) },
  { name: 'sea serpent', w: 2, genes: r => ({ // arches rising from the line
    chassis: serpent(r, { mode: 'wave', len: r.range(28, 36), amp: r.range(3.2, 4.2), humps: r.wpick([[3, 2], [1, 1]]), rise: r.range(4, 5.5), riseA: r.range(1.1, 1.4), backT: [0.1, 0.95], r: r.range(6.4, 7.4), headS: r.range(0.9, 1) }),
    head: r.wpick([[2, longjaw(r, { neck: sneck(r, 0.8, 1.4) })], [1, dog(r, { neck: sneck(r, 0.8, 1.4) })]]),
    limbs: none(), tail: tl(r, { tailLen: r.range(3.5, 5.5), up: true, curl: r.range(1.2, 2), wave: 0, tip: 'dragonFluke', w1: 0.3 }),
    dorsal: r.wpick([[2, ridge(r, 'fin', { n: r.int(5, 8), h: r.range(0.8, 1.1), wid: 0.36 })], [1, ridge(r, 'saw', { n: r.int(7, 10), wid: 0.34 })], [1, none()]]), crown: r.wpick([[1, ears(r)], [1, horns(r)], [1, none()]]), surface: eye(),
  }) },
  { name: 'serra', w: 1.2, genes: r => ({ // the bestiary's winged saw-fish that races ships
    chassis: beast(r, { lie: true, legs: 'none', len: r.range(18, 24), r: r.range(7, 8.4), arch: r.range(0.3, 0.5), headS: r.range(0.78, 0.9), neckA: r.range(-0.25, 0.05), neckL: 1.1, neckW: 0.75, tailLift: 0.45, face: 0 }),
    head: dog(r, { mz: r.range(1.3, 1.7), gape: r.chance(0.6) ? r.range(0.3, 0.5) : 0, tongue: null }),
    limbs: none(), tail: tl(r, { tailLen: r.range(4, 6), up: true, curl: r.range(0.8, 1.6), wave: 0, w1: 0.34, tip: 'dragonFluke', tipS: 1.2 }),
    dorsal: r.wpick([[3, batw(r, { size: r.range(3.6, 4.4), at: r.range(0.6, 0.75), far: false })], [1.5, feather(r, { size: r.range(3.6, 4.4), at: r.range(0.6, 0.75), far: false })]]), crown: r.wpick([[1, ears(r, { len: r.range(0.9, 1.3) })], [1, none()]]), surface: eye(),
  }) },
  { name: 'ouroboros', w: 2, genes: r => r.chance(0.6) ? ({ // the tail-biter: the jaws close on the thin tail tip
    chassis: serpent(r, { mode: 'ring', R: r.range(4.4, 5), r: r.range(3.0, 3.4), gap: r.range(0.5, 0.6), headS: r.range(1.5, 1.65), faceOff: r.range(0.3, 0.45), radKeys: [[0, 0.3], [0.25, 0.75], [0.55, 1], [0.9, 0.85], [1, 0.72]], backT: [0.5, 0.9] }),
    head: dog(r, { gape: r.range(0.45, 0.6), tongue: null, mz: r.range(1.5, 1.8), tipR: 0.38, up: 0, beard: 0, nose: 0, brow: 0.28 }),
    limbs: none(), tail: none(),
    dorsal: r.wpick([[2, none()], [1, ridge(r, 'saw', { n: r.int(9, 13), wid: 0.26, h: 0.5 })]]), crown: r.wpick([[1, horns(r, { len: r.range(1.1, 1.5) })], [1, ears(r, { len: r.range(1.1, 1.5) })], [1, none()]]), surface: eye(),
  }) : ({ // winged
    chassis: serpent(r, { mode: 'ring', R: r.range(4.4, 5), r: r.range(3.0, 3.4), gap: r.range(0.5, 0.6), headS: r.range(1.5, 1.65), faceOff: r.range(0.3, 0.45), radKeys: [[0, 0.3], [0.25, 0.75], [0.55, 1], [0.9, 0.85], [1, 0.72]], backT: [0.5, 0.9] }),
    head: dog(r, { gape: r.range(0.45, 0.6), tongue: null, mz: r.range(1.5, 1.8), tipR: 0.38, up: 0, beard: 0, nose: 0, brow: 0.28 }),
    limbs: none(), tail: none(),
    dorsal: batw(r, { at: 0.72, size: r.range(3, 3.6) }), crown: ears(r, { len: r.range(1.1, 1.5) }), surface: eye(),
  }) },

  { name: 'interlace beast', w: 1.6, genes: r => ({ // Insular / Romanesque initial: knotted, biting back, leaf-tailed
    chassis: beast(r, { legs: 'quad', len: r.range(20, 26), r: r.range(4.6, 5.6), arch: r.range(0.3, 0.6), headS: r.range(0.78, 0.9), neckA: r.range(-1.25, -1), neckW: 0.6, haunch: true }),
    head: longjaw(r, { regard: true, neck: sneck(r, 3.2, 4.2), lookDown: r.range(0.2, 0.5), mz: r.range(1.8, 2.3), tongue: null }),
    limbs: legs(r, { w: 0.42, lift: r.range(0.9, 1.2) }), tail: knot(r, { tip2: 'trefoil', tailLen: r.range(6, 8), knotR: 1.7, up: true }),
    dorsal: none(), crown: r.wpick([[2, { type: 'dragonLappet', len: r.range(2.2, 3.2) }], [1, ears(r)]]), surface: eye(),
  }) },
  { name: 'urnes ribbon beast', w: 1.5, genes: r => ({ // slender Norse greyhound-serpent, all loops
    chassis: beast(r, { legs: 'quad', pawUp: r.chance(0.5), len: r.range(22, 28), r: r.range(3.6, 4.4), arch: r.range(0.5, 1), headS: r.range(0.9, 1.05), neckA: r.range(-1.2, -0.9), neckW: 0.62, belly: 0.85, haunch: true }),
    head: longjaw(r, { neck: { len: r.range(3, 4.2), sway: r.range(0.9, 1.3), w0: 0.6, w1: 0.45 }, mz: r.range(2, 2.5), gape: r.range(0.25, 0.4), tongue: null, nose: 0.7 }),
    limbs: legs(r, { w: 0.5, len: r.range(2.6, 3.2), lift: r.range(1.5, 2), hindW: 1.3 }), tail: knot(r, { tailLen: r.range(9, 12), w0: 0.8, w1: 0.26, knotR: 1.5, knotOut: r.range(3, 4.5), tip2: r.pick(['trefoil', 'barb']), up: true, curl: r.range(1, 1.8) }),
    dorsal: none(), crown: { type: 'dragonLappet', len: r.range(2.6, 3.6) }, surface: eye(),
  }) },
  { name: 'prow wyrm', w: 1.2, genes: r => ({ // longship: tall maned neck at one end, a great spiral at the other
    chassis: serpent(r, { mode: 'wave', stern: r.range(4, 5.5), len: r.range(20, 26), amp: 0, humps: 1, rise: r.range(8, 10), riseA: r.range(1.5, 1.7), r: r.range(5.6, 6.6), headS: r.range(0.8, 0.9), backT: [0.62, 0.97], radKeys: [[0, 0.75], [0.3, 1.05], [0.6, 1], [0.85, 0.74], [1, 0.62]] }),
    head: dog(r, { neck: { len: r.range(1.2, 1.8), sway: 1.3, w0: 0.66, w1: 0.5 }, gape: r.range(0.35, 0.55), tongue: r.pick(['barb', null]) }),
    limbs: none(), tail: tl(r, { tailLen: r.range(7, 9), w0: 1.05, w1: 0.3, up: true, curl: r.range(5.4, 6.6), spiral: true, wave: 0, tip: 'point', curlSign: 1 }),
    dorsal: ridge(r, 'scallop', { n: r.int(6, 9), h: r.range(0.8, 1), wid: 0.36 }), crown: r.wpick([[2, { type: 'dragonLappet', len: r.range(2.4, 3.2) }], [1, ears(r)]]), surface: eye(),
  }) },
  { name: 'coiled wyrm', w: 2.2, genes: r => ({ // flat spiral coil, head up; winged it is the alchemists' serpent
    chassis: serpent(r, { mode: 'spiral', turns: r.range(1.6, 2.15), gapW: r.range(1.9, 2.5), r: r.range(3.3, 4), rise: r.range(2.5, 4), riseA: r.range(0.9, 1.3), headS: r.range(1.15, 1.35), backT: [0.82, 0.97], radKeys: [[0, 0.4], [0.25, 0.9], [0.7, 1], [1, 0.72]] }),
    head: dog(r, { mz: r.range(1.2, 1.6), tongue: r.pick(['fork', 'barb', null]), neck: sneck(r, 0.8, 1.6) }),
    limbs: none(), tail: none(),
    dorsal: r.wpick([[2.5, none()], [1.5, heraldic(r, { at: 0.5, size: r.range(4, 5), far: false })], [1, feather(r, { at: 0.5, size: r.range(4, 5), far: false })]]), crown: r.wpick([[1, ears(r)], [1, horns(r)], [1, none()]]), surface: eye(),
  }) },
  { name: 'long', w: 1.4, genes: r => ({ // a compact Chinese dragon: humped, maned, antlered, whiskered
    chassis: serpent(r, { mode: 'wave', len: r.range(28, 34), amp: r.range(2, 2.8), humps: 2, rise: r.range(2.8, 3.6), riseA: r.range(0.8, 1.1), clear: r.range(0.7, 1), clearT: [0.05, 0.2], legsAt: [{ t: 0.24, role: 'hind' }, { t: 0.8, role: 'fore' }], legS: 1.1, r: r.range(6, 6.8), backT: [0.12, 0.92], headS: r.range(1.1, 1.25) }),
    head: dog(r, { mz: r.range(1.4, 1.8), tipR: r.range(0.44, 0.52), beard: r.range(0.9, 1.2), gape: r.range(0.3, 0.45), tongue: null, neck: sneck(r, 0.8, 1.4) }),
    limbs: legs(r, { lift: 1, len: r.range(1.5, 1.9), hindW: 1.1 }), tail: tl(r, { tailLen: r.range(5, 7), up: true, curl: r.range(1, 2), tip: 'dragonFlame', w1: 0.3 }),
    dorsal: ridge(r, 'mane', { n: r.int(6, 8), h: r.range(0.9, 1.15), wid: 0.4 }), crown: { type: 'dragonAntler', len: r.range(1.8, 2.5), pair: true }, surface: eye(),
  }) },
  { name: 'tarasque', w: 1.2, genes: r => ({ // six-legged, lion-headed, under a spiked shell
    chassis: beast(r, { legs: 'six', shell: r.range(0.55, 0.85), len: r.range(18, 23), r: r.range(7, 8.2), arch: 0.2, headS: r.range(0.8, 0.92), neckA: r.range(-0.5, -0.2), neckL: 1.3, neckW: 0.7, haunch: false }),
    head: pug(r, { beard: r.range(0.8, 1.1) }),
    limbs: legs(r, { lift: r.range(0.35, 0.5), len: r.range(1.5, 1.8), hindW: 1.1 }), tail: tl(r, { tailLen: r.range(5, 7), up: r.chance(0.5), curl: r.range(0.8, 1.6) }),
    dorsal: ridge(r, 'saw', { n: r.int(6, 9), h: r.range(0.6, 0.9), wid: 0.34, lean: 0 }), crown: r.wpick([[2, { type: 'tuft', n: r.int(3, 4), spread: 1, len: r.range(0.9, 1.3) }], [1, ears(r, { len: 1 })]]), surface: eye(),
  }) },
  { name: 'sleeping drake', w: 1.5, genes: r => ({
    chassis: beast(r, { lie: true, legs: 'lie', len: r.range(16, 20), r: r.range(7.4, 8.8), arch: r.range(0.5, 0.8), headS: r.range(0.74, 0.84), neckA: r.range(0.2, 0.35), neckL: 1.1, neckW: 0.7, face: 0.02, tailLift: 0.2 }),
    head: dog(r, { gape: 0, tongue: null, mz: r.range(1.3, 1.7), up: 0 }),
    limbs: none(), tail: r.wpick([[2, coil(r, { tailLen: r.range(8, 10) })], [1, tl(r, { up: false, curl: 0.2, wave: 1.2, tailLen: r.range(6, 9) })]]),
    dorsal: r.wpick([[3, folded(r, { far: false, at: r.range(0.6, 0.75) })], [1, ridge(r, 'saw')]]), crown: r.wpick([[2, ears(r)], [1, horns(r)]]), surface: { eyes: 'none' },
  }) },
];

export default {
  id: 'dragon', label: 'Small dragons', short: 'Dragons',
  sig: { dorsal: 3, tail: 3, head: 2, crown: 2 },
  // M4: wings, crests and tails stuck on a mushroom clump read as a collage; dragon bodies
  // lead this pair and a mushroom gets only one dragon head or horns
  mix: { fungus: { lead: 2.5, sig: { head: 3, crown: 1.5 }, want: [[1, 1]] } },
  species,
};
