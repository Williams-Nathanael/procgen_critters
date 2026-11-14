// Fungi: a species library of real fruiting-body forms.
//
// How this file is organised
//   FB      "fruit body" drawers: cap, inkcap, funnel, morel, brain, saddle, thimble, ball, star,
//           coral, clubs, cage, arms, mane, cup, ruffle, fronds. Each draws one form at an
//           attachment point along an axis, at a scale. They are reused everywhere: as the
//           species' own body, as a head lent to another tag's body, as crown / dorsal / tail-tip
//           ornaments (little mushrooms growing from a back, coral antlers, puffball tails).
//   FORMS   body plans for the single `fungus` chassis: `stems` (one or many stalks, troops and
//           tufts, optional substrate), `wood` (stump or log carrying shelves and side growths)
//           and `cordy` (a caterpillar with clubs growing from it).
//   Every species returns lendable head / limbs / tail / dorsal / crown genes. The ornaments are
//   "lend-only": on the fungus's own chassis they are muted (see chassis.fungus), so a species
//   looks like itself, and still has something characteristic to give to a mix.
import { chassis, heads, feet, tips, crowns, dorsals } from '../parts.js';
import { add, lerp, polar, angOf, angDiff, clamp, mix, MINW, frame, spline, profile, pathAt, tube, ellipse } from '../core.js';

const PI = Math.PI, TAU = 2 * PI, UP = -PI / 2;
const toward = (a, b, k) => a + angDiff(b, a) * k;

// ---------- pen: draws into the ink, optionally clamped to the ground line and lifted ----------
function pen(ink, dy = 0, ground = false) {
  return { ground, poly(pts, layer = 'k') { ink.poly(ground ? pts.map(p => [p[0], Math.min(p[1], 0) - dy]) : pts, layer); return this; } };
}
const dot = (K, c, r, layer) => K.poly(ellipse(c, r, r, 0, r < 2 ? 10 : 16), layer);
const oval = (K, c, rx, ry, rot = 0, layer) => K.poly(ellipse(c, rx, ry, rot, Math.max(rx, ry) < 3 ? 14 : 22), layer);
const tb = (K, ctrl, rad, per = 5, layer) => K.poly(tube(spline(ctrl, per), rad), layer);
// a lighter leaf than core's (fewer vertices: this tag draws hundreds of scales, teeth and blades)
function leaf(p, ang, len, wid, bend = 0, fat = 0.4) {
  const mid = polar(polar(p, ang, len * 0.5), ang + PI / 2, bend * len);
  return tube(spline([p, mid, polar(p, ang + bend * 0.6, len)], 4), profile([[0, wid * 0.12], [fat, wid * 0.5], [1, 0.05]]));
}

// smooth pseudo-noise, periodic when f is an integer and t an angle
const wob = (rng, f = 3) => {
  const a = rng.range(0, TAU), b = rng.range(0, TAU), c = rng.range(0, TAU);
  return t => (Math.sin(t * f + a) + 0.6 * Math.sin(t * (2 * f - 1) + b) + 0.35 * Math.sin(t * (3 * f + 1) + c)) / 1.95;
};
function blob(c, rx, ry, rng, amp = 0.1, f = 3, rot = 0, n = 44) {
  const w = wob(rng, f), out = [], cs = Math.cos(rot), sn = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, k = 1 + amp * w(a), x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    out.push([c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]);
  }
  return out;
}
// symmetric outline from [[x along axis, half-width], ...]
function lathe(F, keys, per = 6, modR = null, modL = null) {
  const side = spline(keys, per), n = side.length - 1;
  const R = side.map(([x, w], i) => F(x, Math.max(w, 0) * (modR ? modR(i / n) : 1)));
  const L = side.map(([x, w], i) => F(x, -Math.max(w, 0) * (modL ? modL(i / n) : 1)));
  return R.concat(L.reverse());
}

// =====================================================================
// FRUIT BODIES   (K, rng, p, ax, s, g) -> { top, w }
// p: attachment point, ax: growth axis, s: scale unit. Each gene carries `span`, its rough
// half-width in s units, so ornaments can be sized consistently.
// =====================================================================
const FB = {
  none(K, rng, p) { return { top: p, w: 0 }; },

  // Agaric / bolete / hoof caps. a,b: superellipse exponents of the top profile.
  cap(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, a = g.a ?? 2, b = g.b ?? 0.5, un = g.under ?? 0.15;
    const F = frame(polar(p, ax, -(Math.max(un, 0) * H * 0.7 + (g.sink ?? 0) * s)), ax, 1, 1);
    const wv = g.wavy ? wob(rng, 2) : null, N = 30;
    const z = u => (g.curl ?? 0) * H * Math.abs(u) ** 2.5 + (wv ? g.wavy * H * wv(u * 1.7) * Math.abs(u) ** 0.6 : 0) + (g.tiltRim ?? 0) * H * u;
    const topf = u => H * Math.max(1 - Math.abs(u) ** a, 0) ** b
      + (g.umbo ?? 0) * H * Math.exp(-((u / (g.umboW ?? 0.2)) ** 2))
      - (g.dip ?? 0) * H * Math.exp(-((u / 0.5) ** 2))
      + (g.steps ? 0.07 * H * Math.sin(g.steps * PI * Math.abs(u)) * (1 - Math.abs(u)) : 0);
    const lat = u => W * u + (g.skew ?? 0) * W * (1 - u * u);
    const botf = u => Math.min(un * H * (1 - u * u), topf(u) - (g.thick ?? 0.16) * H * Math.sqrt(Math.max(1 - u * u, 0)));
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N; top.push(F(topf(u) + z(u), lat(u))); }
    for (let i = N - 1; i >= 1; i--) { const u = -1 + 2 * i / N; bot.push(F(botf(u) + z(u), W * u)); }
    K.poly(top.concat(bot));
    const rr = (g.rim ?? 0.1) * s;
    for (const sd of [-1, 1]) dot(K, F(z(sd) + rr * 0.25, sd * (W - rr * 0.75)), rr);
    if (g.teeth) for (let i = 0; i < g.teeth; i++) { // hedgehog spines under the cap
      const u = mix(-0.86, 0.86, (i + 0.5) / g.teeth); if (Math.abs(u) < 0.2) continue;
      K.poly(leaf(F(botf(u) + z(u) + 0.1 * s, W * u), ax + PI + rng.range(-0.15, 0.15), s * rng.range(0.38, 0.6), s * 0.26, 0, 0.25));
    }
    const spots = [];
    for (let i = 0; i < 7; i++) { const u = rng.range(-0.7, 0.7); spots.push({ p: F(mix(Math.max(botf(u), 0), topf(u), rng.range(0.45, 0.8)) + z(u), lat(u)), r: s * rng.range(0.1, 0.2) }); }
    return { top: F(topf(0) + z(0) - (g.dip ? 0 : 0.04 * H), lat(0)), w: W, spots };
  },

  // Shaggy inkcap: tall cylinder-bell with recurved scales; `flare` > 1 is the deliquescing stage.
  inkcap(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, fl = g.flare ?? 1;
    const F = frame(polar(p, ax, -H * 0.82), ax, 1, 1);
    const keys = [[0, W * fl], [H * 0.12, W * mix(fl, 1, 0.75)], [H * 0.5, W * 0.96], [H * 0.8, W * 0.74], [H * 0.94, W * 0.42], [H, W * 0.1]];
    K.poly(lathe(F, keys));
    const hw = profile(keys.map(([x, w]) => [x / H, w]));
    const n = g.shag ?? 5;
    for (const sd of [-1, 1]) for (let i = 0; i < n; i++) {
      const t = mix(0.2, 0.86, (i + rng.range(0.2, 0.8)) / n);
      K.poly(leaf(F(t * H, sd * hw(t) * 0.8), ax + PI - sd * rng.range(0.75, 1.1), s * rng.range(0.4, 0.62), s * 0.3, sd * 0.15, 0.3));
    }
    const nt = Math.round(5 * fl); // ragged hem
    for (let i = 0; i < nt; i++) { const u = mix(-0.9, 0.9, (i + 0.5) / nt); if (Math.abs(u) < 0.25) continue; K.poly(leaf(F(0.1 * s, W * fl * u), ax + PI + u * 0.3, s * rng.range(0.3, 0.55) * fl, s * 0.3, 0, 0.3)); }
    return { top: F(H * 0.97, 0), w: W };
  },

  // Chanterelle / trumpet: stalk flaring into a ruffled rim.
  funnel(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, w0 = g.w0 * s, F = frame(p, ax, 1, 1), wv = wob(rng, 2), ruf = g.ruffle ?? 0.1, dip = g.dip ?? 0.15;
    const bow = x => (g.bow ?? 0) * W * (x / H) ** 2, th = Math.max((g.rim ?? 0.12) * s * 1.7, 1.6);
    // the upper surface: dished, with a ruffled margin; the margin stays thick (no feathered edge)
    const topX = u => H - dip * H * Math.exp(-((u / 0.55) ** 2)) + ruf * H * 0.6 * wv(u * 2.4) * (0.5 + 0.5 * Math.abs(u)) - 0.04 * H * Math.abs(u) ** 6;
    const sideOf = sd => { const xr = topX(sd); return spline([[0, w0], [H * 0.35, w0 * 1.05], [Math.min(H * 0.62, xr - th * 4), mix(w0, W, 0.28)], [Math.min(H * 0.84, xr - th * 2.2), W * 0.74], [xr - th * 0.9, W * 0.98]], 7).map(([x, w]) => [Math.min(x, topX(sd * Math.min(w / W, 1)) - th), w]); };
    const R = sideOf(1), L = sideOf(-1), top = [], N = 18;
    for (let i = 0; i <= N; i++) { const u = 1 - 2 * i / N; top.push(F(topX(u), W * u + bow(H))); }
    K.poly(R.map(([x, w]) => F(x, w + bow(x))).concat(top, L.reverse().map(([x, w]) => F(x, -w + bow(x)))));
    for (const sd of [-1, 1]) dot(K, F(topX(sd) - th * 0.6, sd * (W - th * 0.45) + bow(H)), th * 0.62);
    return { top: F(H * (1 - dip), bow(H)), w: W };
  },

  // Morel: pitted cone / egg. The outline is scalloped by the ridges.
  morel(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, F = frame(polar(p, ax, -H * 0.06), ax, 1, 1), pt = g.point ?? 0.5;
    const keys = [[0, W * 0.55], [H * 0.07, W * 0.92], [H * 0.3, W], [H * 0.62, W * mix(0.95, 0.7, pt)], [H * 0.88, W * mix(0.6, 0.3, pt)], [H, W * 0.06]];
    const k = g.pits ?? 5, amp = g.amp ?? 0.1, pr = rng.range(0, PI), pl = rng.range(0, PI);
    const bump = ph => t => 1 + amp * (Math.abs(Math.sin(t * k * PI + ph)) - 0.6) * (t < 0.92 ? 1 : 0.3);
    K.poly(lathe(F, keys, 8, bump(pr), bump(pl)));
    const spots = [];
    for (let i = 0; i < 9; i++) { const t = rng.range(0.15, 0.85); spots.push({ p: F(t * H, W * rng.range(-0.5, 0.5) * (1 - t * 0.5)), r: s * rng.range(0.12, 0.2) }); }
    return { top: F(H * 0.98, 0), w: W, spots };
  },

  // False morel: a brain of lumpy lobes, wider than tall.
  brain(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, F = frame(p, ax, 1, 1), n = g.n ?? 7;
    K.poly(blob(F(H * 0.48, 0), W * 0.72, H * 0.5, rng, 0.08, 3, ax + PI / 2));
    let top = F(H * 0.9, 0);
    for (let i = 0; i < n; i++) {
      const a = mix(-0.25, PI + 0.25, (i + rng.range(0.25, 0.75)) / n), rr = Math.min(W, H) * rng.range(0.3, 0.44);
      const c = F(H * 0.45 + Math.sin(a) * (H * 0.5 - rr * 0.55), Math.cos(a) * (W - rr * 0.8));
      K.poly(blob(c, rr * rng.range(0.9, 1.25), rr, rng, 0.1, 2, rng.range(0, PI), 26));
    }
    for (const sd of [-1, 1]) if (rng.chance(g.droop ?? 0.6)) oval(K, F(H * 0.12, sd * W * 0.78), H * 0.26, W * 0.24, ax);
    return { top, w: W };
  },

  // Jelly fungus (witch's butter): fat, folded, translucent-looking lobes fanning from one base,
  // with clefts between them deep enough to survive at print size.
  jelly(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, F = frame(p, ax, 1, 1), n = g.n ?? 5, rw = W * (g.fat ?? 0.32);
    let top = F(H, 0);
    oval(K, F(H * 0.22, 0), H * 0.25, W * 0.55, ax);
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, a = ax + u * (g.fan ?? 1.2) + rng.range(-0.15, 0.15), L = H * rng.range(0.7, 0.95) * (1 - 0.25 * Math.abs(u));
      const b = F(H * 0.15, u * W * 0.25), m = polar(polar(b, a, L * 0.55), a + PI / 2, rng.range(-0.2, 0.2) * L), e = polar(b, a + rng.range(-0.3, 0.3), L);
      K.poly(tube(spline([b, m, e], 6), profile([[0, rw * 0.6], [0.45, rw * 0.85], [0.8, rw * 1.05], [1, rw * 0.95]])));
      if (Math.abs(u) < 0.3) top = e;
    }
    return { top, w: W };
  },

  // Elfin saddle (Helvella): a thick, crumpled sheet draped over the stalk top, its 2-3 lobes
  // arching up and its flaps hanging free on both sides, so daylight shows between flap and stalk.
  saddle(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, F = frame(p, ax, 1, 1), n = g.lobes ?? 2, th = W * (g.th ?? 0.28);
    const pts = [[-H * rng.range(0.2, 0.5), -W * rng.range(0.85, 1.0)], [H * 0.5, -W * 0.92]];
    if (n === 2) pts.push([H * rng.range(0.9, 1.05), -W * 0.45], [H * rng.range(0.55, 0.7), W * rng.range(-0.05, 0.05)], [H * rng.range(0.9, 1.05), W * 0.45]);
    else pts.push([H * rng.range(0.85, 0.98), -W * 0.58], [H * 0.68, -W * 0.28], [H * rng.range(0.95, 1.08), 0], [H * 0.68, W * 0.28], [H * rng.range(0.85, 0.98), W * 0.58]);
    pts.push([H * 0.5, W * 0.92], [-H * rng.range(0.2, 0.5), W * rng.range(0.85, 1.0)]);
    K.poly(tube(spline(pts.map(([x, y]) => F(x, y)), 7), profile([[0, th * 0.45], [0.15, th * 0.85], [0.5, th], [0.85, th * 0.85], [1, th * 0.45]])));
    K.poly(lathe(F, [[-0.2 * s, W * 0.16], [H * 0.4, W * 0.24], [H * 0.62, W * 0.3]]));
    return { top: F(H * 0.75, 0), w: W };
  },

  // Stinkhorn head: a thimble with a little ring at the tip; `skirt` adds the veiled lady's net.
  thimble(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, F = frame(polar(p, ax, -H * 0.3), ax, 1, 1), pt = g.point ?? 0;
    K.poly(lathe(F, [[0, W * 0.94], [H * 0.06, W * 1.0], [H * 0.45, W * mix(0.97, 0.8, pt)], [H * 0.75, W * mix(0.86, 0.55, pt)], [H * 0.9, W * mix(0.62, 0.3, pt)], [H * 0.97, W * mix(0.42, 0.14, pt)], [H, W * mix(0.36, 0.06, pt)]]));
    if (g.skirt) {
      const SL = g.skirt * s, SW = (g.skirtW ?? 2.3) * W;
      const keys = [[H * 0.22, W * 0.6], [-SL * 0.08, W * 1.25], [-SL * 0.55, mix(W * 1.25, SW, 0.72)], [-SL, SW]];
      K.poly(lathe(F, keys.slice().reverse()));
      const hw = profile(keys.map(([x, w]) => [(H * 0.22 - x) / (H * 0.22 + SL), w]));
      const nh = Math.max(4, Math.round(SW / (s * 0.24)));
      for (let i = 0; i < nh; i++) dot(K, F(-SL, SW * mix(-0.95, 0.95, i / (nh - 1))), SW / nh * 0.95); // scalloped hem
      const rows = g.rows ?? 4, cell = s * 0.52;
      for (let j = 0; j < rows; j++) {
        const t = mix(0.3, 0.9, j / (rows - 1)), x = H * 0.22 - t * (H * 0.22 + SL), half = hw(t) - cell * 0.55;
        const nc = Math.max(1, Math.floor(half * 2 / cell));
        for (let i = 0; i < nc; i++) { const y = (nc > 1 ? mix(-half, half, i / (nc - 1)) : 0) + (j % 2 ? cell * 0.25 : -cell * 0.25); if (Math.abs(y) > half) continue; K.poly(ellipse(F(x, y), cell * 0.36, cell * 0.28, ax + PI / 4, 4), 'w'); }
      }
      if (g.stemR) K.poly(tube([polar(p, ax, -SL * 1.02 - H * 0.3), p], g.stemR * s), 'k2');
    }
    return { top: F(H, 0), w: W };
  },

  // Puffballs, earthballs, truffles: `pear` = sterile base, `beak` = apical pore, `warts`, `dent` = crater.
  ball(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, F = frame(p, ax, 1, 1), pear = (g.pear ?? 0) * s, ry = (H - pear) / 2;
    const c = F(pear + ry, 0), w = wob(rng, g.lf ?? 3), n = 52, lump = g.lumpy ?? 0.05, dent = g.dent ?? 0, out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU; // 0 = along the axis (top)
      const k = 1 + lump * w(a) - dent * Math.exp(-((angDiff(a, 0) / 0.42) ** 2));
      out.push(F(pear + ry + Math.cos(a) * ry * k, Math.sin(a) * W * k));
    }
    K.poly(out);
    if (pear > 0) K.poly(lathe(F, [[0, W * (g.foot ?? 0.5)], [pear * 0.6, W * (g.foot ?? 0.5) * 1.05], [pear + ry * 0.7, W * 0.86]]));
    if (g.warts) for (let i = 0; i < g.warts; i++) {
      const a = mix(-2.1, 2.1, (i + rng.range(0.2, 0.8)) / g.warts); if (dent && Math.abs(a) < 0.5) continue;
      const q = F(pear + ry + Math.cos(a) * ry * 0.92, Math.sin(a) * W * 0.92);
      K.poly(leaf(q, ax + a, s * (g.wartL ?? 0.3) * rng.range(0.8, 1.3), s * (g.wartW ?? 0.3), 0, 0.3));
    }
    if (dent && !g.smooth) for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) { // torn lip of the crater
      const a = sd * (0.34 + i * 0.22);
      K.poly(leaf(F(pear + ry + Math.cos(a) * ry * 0.88, Math.sin(a) * W * 0.88), ax + a * 0.5, s * rng.range(0.3, 0.5), s * 0.3, 0, 0.3));
    }
    if (g.beak) K.poly(lathe(frame(F(H * (1 - dent) - s * 0.08, 0), ax, 1, 1), [[0, s * 0.3], [g.beak * s * 0.6, s * 0.15], [g.beak * s, s * 0.09]], 4));
    if (g.roots) for (let i = 0; i < g.roots; i++) { // mycelial cords splaying from a pinched base
      const u = g.roots > 1 ? i / (g.roots - 1) * 2 - 1 : 0, b = F(pear * 0.5 + s * 0.1, u * W * 0.25), e = F(-s * 0.12, u * W * rng.range(0.75, 1.05));
      K.poly(tube(spline([b, lerp(b, e, 0.5), e], 4), profile([[0, s * 0.22], [1, s * 0.09]])));
    }
    const spots = [];
    for (let i = 0; i < 7; i++) { const a = rng.range(-1.6, 1.6), d = rng.range(0.2, 0.7); spots.push({ p: F(pear + ry + Math.cos(a) * ry * d, Math.sin(a) * W * d), r: s * rng.range(0.08, 0.16) }); }
    return { top: F(H * (1 - dent * 0.8), 0), w: W, c, spots };
  },

  // Truffle tuber: an irregular knobbly lump whose outline is crenellated by pyramidal warts.
  tuber(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, F = frame(p, ax, 1, 1), c = F(H * 0.5, 0), w = wob(rng, 2), n = g.warts ?? 26, wh = (g.wh ?? 0.07), out = [];
    const ph = rng.range(0, 1);
    for (let i = 0; i < n * 2; i++) {
      const a = (i + ph) / (n * 2) * TAU, k = (1 + (g.lumpy ?? 0.12) * w(a)) * (i % 2 ? 1 - wh : 1 + wh * rng.range(0.6, 1.3));
      out.push(F(H * 0.5 + Math.cos(a) * H * 0.5 * k, Math.sin(a) * W * k));
    }
    K.poly(out);
    return { top: F(H, 0), w: W, c };
  },

  // Earthstar: spore sac with a beak, sitting on pointed rays.
  star(K, rng, p, ax, s, g) {
    const n = g.rays ?? 6, L = g.len * s, F = frame(p, ax, 1, 1), arch = g.arch ?? 0;
    for (let i = 0; i < n; i++) {
      const sd = i % 2 ? 1 : -1, j = Math.floor(i / 2), m = Math.ceil(n / 2);
      const phi = mix(1.25, 2.0, m > 1 ? j / (m - 1) : 0.4) + arch * 0.75 + rng.range(-0.1, 0.1);
      const len = L * rng.range(0.85, 1.1) * (1 - 0.22 * j / m);
      const a = ax + sd * phi, e = polar(p, a + sd * (0.35 + arch * 0.3), len);
      tb(K, [F(s * 0.1, 0), polar(p, a - sd * 0.25, len * 0.55), e], profile([[0, s * g.rw], [0.45, s * g.rw * 0.9], [1, 0.12]]), 6);
    }
    const sac = FB.ball(K, rng, F(s * (g.neck ?? 0.15), 0), ax, s, { w: g.w, h: g.h, lumpy: 0.03, beak: g.beak ?? 0.5 });
    dot(K, F(s * 0.2, 0), s * g.w * 0.7);
    return { top: sac.top, w: g.w * s, c: sac.c, spots: sac.spots };
  },

  // Coral / antler / lichen bush: recursive forking.
  coral(K, rng, p, ax, s, g) {
    const minR = 0.55; let best = null, bd = -1e9;
    const br = (q, a, L, w, d) => {
      const bend = rng.range(-0.2, 0.2) * (g.kink ?? 1), e = polar(q, a + bend, L), m = polar(lerp(q, e, 0.5), a + PI / 2, -L * bend * 0.5);
      const w1 = Math.max(w * (g.keep ?? 0.8), minR);
      K.poly(tube(spline([q, m, e], 2), profile([[0, w], [1, w1]])));
      if (d <= 0) {
        if (g.tips === 'point') K.poly(leaf(e, a + bend, Math.max(L * 0.55, w1 * 3), w1 * 2.3, 0, 0.15));
        else if (g.tips === 'knob') dot(K, e, w1 * 1.4);
        const h = (e[0] - p[0]) * Math.cos(ax) + (e[1] - p[1]) * Math.sin(ax);
        if (h > bd) { bd = h; best = e; }
        return;
      }
      const n = rng.chance(g.tri ?? 0.15) ? 3 : 2, sp = g.spread * rng.range(0.8, 1.2);
      for (let k = 0; k < n; k++) {
        const a2 = a + bend + (k / (n - 1) - 0.5) * sp;
        br(e, toward(a2, ax, g.upPull ?? 0.25), L * (g.shrink ?? 0.75) * rng.range(0.8, 1.15), w1, d - (rng.chance(g.ragged ?? 0.2) ? 2 : 1));
      }
    };
    const n0 = g.n ?? 3, w0 = Math.max(g.wid * s, minR);
    for (let i = 0; i < n0; i++) {
      const u = n0 > 1 ? i / (n0 - 1) * 2 - 1 : 0;
      br(polar(p, ax + PI / 2, u * w0 * (n0 - 1) * 0.55), ax + u * g.fan * 0.5 + rng.range(-0.08, 0.08), g.len * s * rng.range(0.85, 1.15) * (1 - 0.2 * Math.abs(u)), w0, g.depth);
    }
    if (n0 > 1) oval(K, polar(p, ax, w0 * 0.3), w0 * 0.9, w0 * n0 * 0.62, ax);
    return { top: best ?? p, w: g.span * s };
  },

  // Simple clubs: fairy spindles, earth tongues, dead man's fingers, cordyceps heads.
  clubs(K, rng, p, ax, s, g) {
    const n = g.n ?? 1, w = g.wid * s; let best = p, bh = -1e9;
    const prof = {
      spindle: [[0, 0.5], [0.45, 1], [0.85, 0.6], [1, 0.3]],
      club: [[0, 0.42], [0.5, 0.6], [0.82, 1], [1, 0.82]],
      tongue: [[0, 0.3], [0.5, 0.3], [0.62, 0.8], [0.8, 1], [1, 0.42]],
      pin: [[0, 0.32], [0.72, 0.3], [0.82, 0.9], [0.92, 1], [1, 0.7]],
      finger: [[0, 0.72], [0.25, 0.95], [0.5, 0.8], [0.76, 1], [1, 0.78]],
    }[g.kind ?? 'club'];
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, a = ax + u * (g.spread ?? 0.5) * 0.5 + rng.range(-0.1, 0.1);
      const L = g.len * s * (1 - (g.drop ?? 0.3) * Math.abs(u) ** 1.2) * rng.range(0.72, 1.1), wk = rng.range(-1, 1) * (g.wave ?? 0.12);
      const b = polar(p, ax + PI / 2, u * (g.gap ?? 0.5) * s * (n - 1) * 0.5);
      const e = polar(b, toward(a, ax, 0.3) + wk, L);
      const pts = spline([b, polar(polar(b, a, L * 0.35), a + PI / 2, L * wk * 0.6), polar(polar(b, a, L * 0.7), a + PI / 2, -L * wk * 0.5), e], 6);
      const kn = rng.range(0.85, 1.15);
      K.poly(tube(pts, profile(prof.map(([t, r]) => [t, Math.max(r * w * kn, 0.6)]))));
      const h = (e[0] - p[0]) * Math.cos(ax) + (e[1] - p[1]) * Math.sin(ax);
      if (h > bh) { bh = h; best = e; }
    }
    return { top: best, w: g.span * s };
  },

  // Lattice / cage fungus: a ball of bars. The holes are real holes, so they are always cut.
  cage(K, rng, p, ax, s, g) {
    // Clathrus: a sphere meshed into polygonal holes (pole pentagon, triangles, pentagons, and the
    // mirror image below the equator), tilted so the pattern sits off-centre and reads as a ball.
    const W = g.w * s, ry = g.h * s * 0.5, c = polar(p, ax, ry), F = frame(c, ax, 1, 1), n = g.cells ?? 5;
    const tl = rng.sign() * rng.range(0.45, 0.75), ct = Math.cos(tl), stl = Math.sin(tl);
    const V = (th, ph) => { const x = Math.sin(th) * Math.cos(ph), y = Math.sin(th) * Math.sin(ph), z = Math.cos(th); return [x * ct + z * stl, y, -x * stl + z * ct]; };
    const P = (th, ph) => { const v = V(th, ph); return F(v[0] * ry, v[1] * W); };
    const ph0 = rng.range(0, TAU), j = () => rng.range(-0.1, 0.1), a1 = rng.range(0.45, 0.52), a2 = rng.range(1.0, 1.08), arm = g.arm ?? 0.11, E = PI / 2, T = TAU / n;
    const A = [], B = [], A2 = [], B2 = [], Rn = [];
    for (let i = 0; i < n; i++) {
      A.push([a1 + j() * 0.4, ph0 + (i + j()) * T]); B.push([a2 + j(), ph0 + (i + 0.5 + j()) * T]);
      A2.push([PI - a1 + j() * 0.4, ph0 + (i + 1.5 + j()) * T]); B2.push([PI - a2 + j(), ph0 + (i + 1 + j()) * T]);
    }
    for (let i = 0; i < 2 * n; i++) Rn.push([E + j() * 0.6, ph0 + (i * 0.5 + 0.25 + j() * 0.5) * T]);
    K.poly(blob(c, ry, W, rng, 0.025, 4, ax, 44));
    const smooth = ring => { for (let it = 0; it < 2; it++) { const r2 = []; for (let i = 0; i < ring.length; i++) { const u = ring[i], v = ring[(i + 1) % ring.length]; r2.push(lerp(u, v, 0.25), lerp(u, v, 0.75)); } ring = r2; } return ring; };
    const hole = (cell) => {
      const pts = [];
      for (let i = 0; i < cell.length; i++) { const u = cell[i], v = cell[(i + 1) % cell.length]; for (let k = 0; k < 4; k++) pts.push([mix(u[0], v[0], k / 4), u[1] + angDiff(v[1], u[1]) * k / 4]); }
      let tc = 0, pc = cell[0][1], dp = 0; for (const q of cell) { tc += q[0]; dp += angDiff(q[1], pc); } tc /= cell.length; pc += dp / cell.length;
      if (V(tc, pc)[2] < 0.28) return; // back of the ball
      K.poly(smooth(pts.map(([th, ph]) => {
        const u = th - tc, v = angDiff(ph, pc) * Math.sin(th), d = Math.hypot(u, v) || 1, k = Math.max(0.1, (d - arm) / d), th2 = tc + u * k;
        return P(th2, pc + v * k / Math.max(Math.sin(th2), 0.2));
      })), 'w');
    };
    K.poly(smooth(A.map(q => P(q[0] - arm, q[1]))), 'w'); // the pole pentagon (the far pole is never in view)
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      hole([A[i], B[i], A[i1]]);
      hole([B[i], Rn[2 * i], Rn[2 * i + 1]]);
      hole([B[i], Rn[2 * i + 1], Rn[(2 * i + 2) % (2 * n)], B[i1], A[i1]]);
      hole([A2[i], B2[i1], A2[i1]]);
      hole([B2[i], Rn[2 * i + 1], Rn[(2 * i + 2) % (2 * n)]]);
      hole([B2[i], Rn[(2 * i + 2) % (2 * n)], Rn[(2 * i + 3) % (2 * n)], B2[i1], A2[i]]);
    }
    return { top: polar(p, ax, ry * 2), w: W, c };
  },

  // Ear fungi (wood ear, jelly ear, hare's ear): a rubbery lobe on a narrow base, its rim cut back
  // on one side into the ear's notch, with a white fold following the inside of the rim and a few
  // white wrinkle veins. g.notch: depth of the notch, g.fold: fold width, g.veins: wrinkle count.
  ear(K, rng, p, ax, s, g) {
    const H = g.h * s, W = g.w * s, sd = g.side ?? rng.sign(), F = (x, y) => frame(p, ax, 1, sd)(x * H, y * W), nd = g.notch ?? 0.3, jt = () => rng.range(-0.04, 0.04);
    const ctrl = [[0, -0.1], [0.14, -0.42], [0.4, -0.56], [0.72, -0.5], [0.95, -0.24], [1.02, 0.08], [0.9, 0.38], [0.68, 0.52], [0.52, 0.5 - nd * 0.4], [0.42, 0.5 - nd * 1.1], [0.3, 0.42 - nd * 0.3], [0.14, 0.3], [0.02, 0.1]];
    const pts = ctrl.map(([x, y]) => [x + jt(), y + jt()]), loop = [pts[pts.length - 1], ...pts, pts[0], pts[1]];
    const sp = spline(loop, 5), n0 = 5, outl = sp.slice(n0, sp.length - n0);
    const wv = wob(rng, 5), am = g.crinkle ?? 0.025;
    K.poly(outl.map(([x, y], i) => { const k = 1 + am * wv(i / outl.length * TAU); return F(0.5 + (x - 0.5) * k, y * k); }));
    const fw = (g.fold ?? 0.07) * W;
    if (fw > 0.5) {
      K.poly(tube(spline([F(0.25, -0.3), F(0.48, -0.41), F(0.74, -0.36), F(0.86, -0.12), F(0.84, 0.12)], 5), profile([[0, fw * 0.3], [0.3, fw], [0.75, fw], [1, fw * 0.3]])), 'w');
      for (let i = 0; i < (g.veins ?? 2); i++) { const y = rng.range(-0.15, 0.2), b = F(0.14, y * 0.4); K.poly(tube(spline([b, F(0.35, y * 0.8 + jt()), F(rng.range(0.5, 0.62), y + jt())], 4), profile([[0, fw * 0.25], [0.5, fw * 0.6], [1, fw * 0.2]])), 'w'); }
    }
    return { top: F(0.95, 0), w: W, c: F(0.5, 0) };
  },

  // Hare's ear (Otidea): a tall narrow cup split down one side, so its top shows two flaps, the
  // tall back wall and the lower front fold, with a V slit between them.
  hare(K, rng, p, ax, s, g) {
    const H = g.h * s, W = g.w * s, sd = g.side ?? rng.sign(), F = (x, y) => frame(p, ax, 1, sd)(x * H, y * W), jt = () => rng.range(-0.03, 0.03);
    const fl = g.flap ?? 0.78, sl = g.slit ?? 0.62;
    const ctrl = [[0, -0.35], [0.3, -0.75], [0.62, -0.88], [0.86, -0.78], [0.99, -0.52], [1.0, -0.22], [0.94, -0.04], [sl + 0.06, 0.08], [sl, 0.24], [sl + 0.05, 0.42], [fl - 0.04, 0.62], [fl, 0.8], [fl - 0.1, 0.92], [0.4, 0.84], [0.12, 0.55], [0, 0.35]];
    const pts = ctrl.map(([x, y]) => [x + jt(), y + jt()]), loop = [pts[pts.length - 1], ...pts, pts[0], pts[1]];
    const sp = spline(loop, 5);
    K.poly(sp.slice(5, sp.length - 5).map(([x, y]) => F(x, y)));
    return { top: F(1, -0.3), w: W, c: F(0.5, 0) };
  },

  // Jelly ear (Auricularia) seen face-on: a broad rounded ear on a pinched base, one fold notch in
  // the rim, and a pale crescent showing the cupped hollow inside the rim.
  jear(K, rng, p, ax, s, g) {
    const H = g.h * s, W = g.w * s, sd = g.side ?? rng.sign(), F = (x, y) => frame(p, ax, 1, sd)(x * H, y * W), jt = () => rng.range(-0.025, 0.025), nd = g.notch ?? 0.12;
    const ctrl = [[0, -0.1], [0.18, -0.38], [0.45, -0.55], [0.78, -0.5], [0.98, -0.22], [1.0, 0.12], [0.88, 0.38], [0.74, 0.46], [0.7 - nd, 0.36 - nd], [0.58, 0.5], [0.4, 0.52], [0.18, 0.36], [0.03, 0.1]];
    const pts = ctrl.map(([x, y]) => [x + jt(), y + jt()]), loop = [pts[pts.length - 1], ...pts, pts[0], pts[1]];
    const sp = spline(loop, 5);
    K.poly(sp.slice(5, sp.length - 5).map(([x, y]) => F(x, y)));
    const cw = [], ck = [];
    for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; cw.push(F(0.6 + Math.cos(a) * 0.27, -0.04 + Math.sin(a) * 0.33)); ck.push(F(0.55 + Math.cos(a) * 0.27, 0.03 + Math.sin(a) * 0.32)); }
    if (H > 8) { K.poly(cw, 'w'); K.poly(ck, 'k2'); }
    return { top: F(0.98, 0), w: W, c: F(0.5, 0) };
  },

  // Devil's fingers / starfish stinkhorn: arching tentacle arms.
  arms(K, rng, p, ax, s, g) {
    const n = g.n ?? 5; let best = p, bh = -1e9;
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, sd = u === 0 ? rng.sign() : Math.sign(u);
      let h = ax + u * (g.fan ?? 1.1) + rng.range(-0.1, 0.1), q = p; const pts = [q], L = g.len * s * rng.range(0.8, 1.1) * (1 - 0.15 * (1 - Math.abs(u))), m = 14;
      const curl = (g.curl ?? 1.6) * rng.range(0.7, 1.25) * (0.5 + 0.5 * Math.abs(u));
      for (let j = 0; j < m; j++) {
        const t = j / m; h += sd * curl * (0.25 + 1.6 * t * t) / m; q = polar(q, h, L / m);
        if (K.ground && q[1] > -1.2) q = [q[0], -1.2];
        pts.push(q);
        const hh = (q[0] - p[0]) * Math.cos(ax) + (q[1] - p[1]) * Math.sin(ax); if (hh > bh) { bh = hh; best = q; }
      }
      K.poly(tube(pts, profile([[0, g.wid * s], [0.5, g.wid * s * 0.85], [1, Math.max(g.wid * s * (g.tipW ?? 0.22), 0.45)]])));
    }
    dot(K, p, g.wid * s * 1.3);
    return { top: best, w: g.span * s };
  },

  // Lion's mane: a pompom of hanging icicle spines.
  mane(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, c = polar(p, ax, H * 0.5), n = g.teeth ?? 16;
    K.poly(blob(c, W * 0.8, H * 0.46, rng, 0.06, 3, 0));
    for (let i = 0; i < n; i++) {
      const a = mix(-0.5, PI + 0.5, (i + rng.range(0.1, 0.9)) / n); // around the lower sweep (y down)
      const q = [c[0] + Math.cos(a) * W * 0.62, c[1] + Math.sin(a) * H * 0.32];
      const low = Math.max(Math.sin(a), 0), d = toward(a, PI / 2, 0.72) + rng.range(-0.12, 0.12);
      K.poly(leaf(q, d, s * g.tl * (0.55 + 0.75 * low) * rng.range(0.75, 1.2), s * 0.34, rng.range(-0.08, 0.08), 0.22));
    }
    for (let i = 0; i < 5; i++) { const a = mix(PI + 0.5, TAU - 0.5, (i + 0.5) / 5); K.poly(leaf([c[0] + Math.cos(a) * W * 0.6, c[1] + Math.sin(a) * H * 0.3], toward(a, PI / 2, 0.3 + 0.4 * Math.abs(Math.cos(a))), s * g.tl * 0.42, s * 0.3, 0, 0.25)); }
    return { top: polar(p, ax, H * 0.92), w: W, c };
  },

  // Cups in section: elf cups, orange peel, bird's nests (with eggs), pixie-cup goblets, wood ears.
  cup(K, rng, p, ax0, s, g) {
    const ax = ax0 + (g.tilt ?? 0), W = g.w * s, H = g.h * s, st = (g.stalk ?? 0) * s, th = Math.max((g.thick ?? 0.2) * s, 0.9), d = (g.depth ?? 0.6) * H, as = g.asym ?? 0;
    const F = frame(p, ax, 1, 1), wv = g.wavy ? wob(rng, 2) : null, N = 18, out = [];
    const zz = c => as * H * c + (wv ? g.wavy * H * wv(c * 2) : 0);
    for (let i = 0; i <= N; i++) { const t = i / N * PI, c = Math.cos(t); out.push(F(st + H - H * Math.sin(t) ** (g.sq ?? 0.8) + zz(c), W * c)); }
    if (g.lid) for (let i = N - 1; i >= 1; i--) { const t = i / N * PI, c = Math.cos(t); out.push(F(st + H + g.lid * H * Math.sin(t) + zz(c), W * c)); }
    else for (let i = N - 1; i >= 1; i--) { const t = i / N * PI, c = Math.cos(t); out.push(F(st + H - d * Math.sin(t) ** 0.9 + zz(c), (W - th) * c)); }
    K.poly(out);
    for (const sd of [-1, 1]) dot(K, F(st + H + zz(sd), sd * (W - th * 0.5)), th * 0.5);
    if (st > 0) K.poly(lathe(F, [[-0.1 * s, (g.stalkW ?? 0.25) * s], [st * 0.6, (g.stalkW ?? 0.25) * s * 1.05], [st + H * 0.45, W * 0.55]]));
    if (g.eggs && !g.lid) for (let i = 0; i < g.eggs; i++) {
      const u = g.eggs > 1 ? mix(-0.5, 0.5, i / (g.eggs - 1)) : 0, er = W * 0.24;
      oval(K, F(st + H - d * (1 - u * u * 1.5) + er * 0.55, (W - th) * u), er * 0.72, er, ax);
    }
    return { top: F(st + H - (g.lid ? -g.lid * H : d), 0), w: W };
  },

  // Vase / trumpet / bowl seen in section: a hollow body whose cavity shows as a notch, so it reads
  // as a cup from the outline alone. flare < 1 gives a round bowl, > 1 a trumpet. Eggs = bird's nest.
  vase(K, rng, p, ax0, s, g) {
    const ax = ax0 + (g.tilt ?? 0), W = g.w * s, H = g.h * s, w0 = Math.max(g.w0 * s, 1), th = Math.max((g.thick ?? 0.3) * W, 1.4);
    const d = (g.lid ? 0.04 : g.depth ?? 0.6) * H, fl = H - d, st = (g.stalk ?? 0) * s, F = frame(polar(p, ax, st), ax, 1, 1), wv = g.wavy ? wob(rng, 2) : null, fe = g.flare ?? 1, inc = g.incurve ?? 0, lip = (g.lip ?? 0) * s;
    const bw = g.bowl ?? 0; // bowl > 0: a goblet, a narrow stem up to bowl * H then a round bowl
    const prof = t => bw > 0 ? (t < bw ? w0 * (1 + 0.4 * (t / bw) ** 2) : mix(w0 * 1.4, W, Math.sqrt(Math.max(1 - ((1 - t) / (1 - bw)) ** 2, 0)))) : mix(w0, W, t ** fe);
    const outer = x => { const t = clamp(x / H, 0, 1); return prof(t) * (1 - inc * t ** 10) + lip * t ** 12; };
    const rimOff = sd => (wv ? g.wavy * H * wv(sd * 1.3) : 0) + (g.asym ?? 0) * H * sd;
    const dx = (sd, x) => rimOff(sd) * clamp(x / H, 0, 1) ** 3;
    const wi = x => Math.max(outer(x) - th * (1 - 0.25 * ((x - fl) / Math.max(d, 1e-6))), 0.4) * Math.min(1, Math.sqrt(Math.max(x - fl, 0) / Math.max(d * 0.3, 1e-6)));
    const N = 14, R = [], Ri = [], Li = [], L = [];
    for (let i = 0; i <= N; i++) { const x = H * i / N; R.push(F(x + dx(1, x), outer(x))); L.push(F(x + dx(-1, x), -outer(x))); }
    for (let i = 0; i <= N; i++) { const x = mix(H, fl, i / N); Ri.push(F(x + dx(1, x), wi(x))); Li.push(F(x + dx(-1, x), -wi(x))); }
    K.poly(R.concat(Ri, Li.reverse(), L.reverse()));
    for (const sd of [-1, 1]) { const rw = (outer(H) - wi(H)) / 2; dot(K, F(H + rimOff(sd) - rw * 0.55, sd * (outer(H) - rw)), rw * 0.85); }
    if (st > 0) { const sw = (g.stalkW ?? 0.3) * s; K.poly(lathe(F, [[-st - 0.1 * s, sw * 1.3], [-st * 0.5, sw], [0, sw * 1.15], [H * 0.2, outer(H * 0.2) * 0.9]])); }
    if (g.eggs && !g.lid) {
      const n = g.eggs, er = (g.egg ?? 0.28) * s, room = Math.max(wi(fl + er * 1.6) - er * 0.9, 0);
      for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, x = fl + er * (0.75 + 0.5 * (1 - u * u)) + (i % 2 ? er * 0.5 : 0); oval(K, F(x, u * room), er * 0.9, er, ax); }
    }
    return { top: F(fl, 0), w: W, c: F(H * 0.5, 0) };
  },

  // Cauliflower fungus: a mass of flat, curled ribbon lobes; the ribbons make the outline frilly.
  ruffle(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, c = polar(p, ax, H * 0.48), F = frame(c, ax, 1, 1), n = g.n ?? 16;
    const ck = g.core ?? 1; K.poly(blob(c, H * 0.42 * ck, W * 0.74 * ck, rng, 0.06, 3, ax));
    for (let i = 0; i < n; i++) {
      const a = mix(-2.2, 2.2, (i + rng.range(0.15, 0.85)) / n), q = F(Math.cos(a) * H * 0.36 * ck, Math.sin(a) * W * 0.66 * ck);
      const len = s * rng.range(0.45, 0.75) * (g.lobe ?? 1), out = ax + a * rng.range(0.8, 1.0) + rng.range(-0.3, 0.3);
      const wd = s * rng.range(0.17, 0.23) * (g.lw ?? 1), bd = rng.sign() * rng.range(0.4, 0.8), m = polar(polar(q, out, len * 0.5), out + PI / 2, bd * len * 0.4);
      K.poly(tube(spline([q, m, polar(q, out + bd * 0.9, len)], 5), profile([[0, wd * 0.8], [0.5, wd * 1.15], [1, wd * 0.95]])));
    }
    return { top: polar(p, ax, H), w: W, c };
  },

  // Hen of the woods: overlapping spoon-shaped fronds in tiers.
  fronds(K, rng, p, ax, s, g) {
    const W = g.w * s, H = g.h * s, F = frame(p, ax, 1, 1), n = g.n ?? 9, th = (g.thick ?? 0.24) * s;
    K.poly(lathe(F, [[0, W * 0.32], [H * 0.35, W * 0.36], [H * 0.75, W * 0.2], [H * 0.9, W * 0.05]]));
    let top = F(H * 0.8, 0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.3) / n, sd = i % 2 ? 1 : -1, a = ax + sd * mix(1.45, 0.35, t ** 0.8) + rng.range(-0.12, 0.12);
      const L = W * mix(1.05, 0.5, t) * rng.range(0.8, 1.1), b = F(t * H * 0.8, sd * W * 0.08);
      const e = polar(polar(b, a, L), ax, L * rng.range(0.05, 0.3));
      tb(K, [b, polar(polar(b, a, L * 0.55), ax, -L * 0.06), e], profile([[0, th * 0.9], [0.55, th * 0.75], [0.85, th * 1.25], [1, th * 0.9]]), 6);
      // a spoon-shaped cap at the end of each branch, its outer margin drooping
      const ca = angOf(b, e) + sd * rng.range(0.2, 0.45);
      oval(K, polar(e, ca, -L * 0.12), L * rng.range(0.26, 0.34), th * rng.range(1.2, 1.45), ca);
      if (i === n - 1) top = e;
    }
    return { top, w: W };
  },
};

// A shelf (bracket) projecting sideways from p. sd = +1 right, -1 left. The margin keeps a
// rounded thickness (rim * th, at least 1 unit) so a thin shelf never ends in a hairline.
function shelf(K, rng, p, sd, len, th, o = {}) {
  const N = 18, top = [], bot = [], wv = o.wavy ? wob(rng, 2) : null, k = o.k ?? 1.6, dr = (o.droop ?? 0) * len;
  const tm = Math.max((o.rim ?? 0.16) * th, 1.0), up = th * (o.up ?? 0.6), dn = th * (o.down ?? 0.4);
  for (let i = 0; i <= N; i++) {
    const u = mix(-0.25, 1, i / N), uu = Math.max(u, 0), x = p[0] + sd * len * u;
    const rip = (wv ? o.wavy * th * wv(uu * 3.2) * uu : 0) + (o.steps ? 0.07 * th * Math.sin(o.steps * PI * uu) * (1 - uu * 0.5) : 0);
    const y = p[1] + dr * uu * uu;
    top.push([x, y - tm - Math.max(up - tm, 0) * (1 - uu ** k) + rip]);
    bot.push([x, y + tm * 0.8 + Math.max(dn - tm * 0.8, 0) * (1 - uu) ** (o.kb ?? 1.2) + rip * 0.4]);
  }
  const tN = top[N], bN = bot[N], rr = (bN[1] - tN[1]) / 2;
  K.poly(top.concat(bot.reverse()));
  dot(K, [tN[0] - sd * rr * 0.55, (tN[1] + bN[1]) / 2], rr);
}

// An oyster shelf seen side-on: a thin lateral base swelling into a domed half-cap whose margin
// rolls down. len along sd, th the dome height, droop how far the margin sags (fraction of len).
function capShelf(K, rng, b, sd, len, th, droop) {
  const N = 16, T = [], B = [], ph = rng.range(0, TAU);
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = b[0] + sd * len * u, d = droop * len * u * u, wv = 0.06 * th * Math.sin(u * 7 + ph) * u;
    T.push([x, b[1] - th * (0.3 + 0.95 * Math.sin(PI * Math.min(u * 0.75, 0.62))) + d + wv]);
    B.push([x, b[1] + th * 0.3 * (1 - u) - th * 0.05 * Math.sin(PI * u) + d * 1.1]);
  }
  const e = [b[0] + sd * len, (T[N][1] + B[N][1]) / 2], rr = (B[N][1] - T[N][1]) / 2;
  K.poly(T.concat(B.reverse()));
  dot(K, [e[0] - sd * rr * 0.4, e[1]], rr);
}

// A bracket lobe: a fan or tongue growing from b (buried inside the trunk, so the join is the
// trunk's own smooth side). Half-width grows from w0 to w1 and ends in a rounded, optionally
// scalloped margin. sd = +1 grows right. up / dn bias the thickness above / below the midline.
function lobe(K, rng, b, sd, len, w0, w1, o = {}) {
  const N = 10, C = [], A = []; let a = sd > 0 ? -(o.rise ?? 0) : PI + (o.rise ?? 0), q = b;
  for (let i = 0; i <= N; i++) { C.push(q); A.push(a); q = polar(q, a, len / N); a += sd * (o.bend ?? 0) / N; }
  const hw = u => mix(w0, w1, Math.sin(Math.min(u / (o.full ?? 0.8), 1) * PI / 2) ** 0.9), up = o.up ?? 1, dn = o.dn ?? 0.8;
  const T = [], Bt = [];
  for (let i = 0; i <= N; i++) { const nT = A[i] - sd * PI / 2; T.push(polar(C[i], nT, hw(i / N) * up)); Bt.push(polar(C[i], nT + PI, hw(i / N) * dn)); }
  const e = C[N], ea = A[N], r1 = w1 * (up + dn) / 2, mid = polar(e, A[N] - sd * PI / 2, w1 * (up - dn) / 2), cap = [], M = 16, wv = o.scallop ? wob(rng, o.sf ?? 3) : null;
  for (let i = 1; i < M; i++) { const t = i / M, ang = ea - sd * PI / 2 + sd * PI * t, rr = r1 * (1 + (wv ? o.scallop * wv(t * PI) * Math.sin(t * PI) : 0)); cap.push(polar(mid, ang, rr * (o.round ?? 0.9) ** (Math.sin(t * PI)))); }
  K.poly(T.concat(cap, Bt.reverse()));
  return e;
}

// =====================================================================
// BODY FORMS for chassis.fungus (drawn in ground coordinates: y = 0 is the soil)
// =====================================================================
const arcStrip = (c, rx, ry, a0, a1, n = 9) => { const out = []; for (let i = 0; i < n; i++) { const a = mix(a0, a1, i / (n - 1)); out.push({ p: [c[0] + Math.cos(a) * rx * 0.9, c[1] + Math.sin(a) * ry * 0.9], dir: Math.atan2(Math.sin(a) * rx, Math.cos(a) * ry), t: i / (n - 1) }); } return out; };
const sideStrip = (path, rad, t0, t1, n, sd) => { const out = []; for (let i = 0; i < n; i++) { const t = mix(t0, t1, i / (n - 1)), { p, ang } = pathAt(path, t), na = ang + sd * PI / 2; out.push({ p: polar(p, na, rad(t) * 0.85), dir: na, t }); } return out; };

function grass(K, rng, x, n, h) {
  for (let i = 0; i < n; i++) { const a = UP + rng.range(-0.55, 0.55); K.poly(leaf([x + rng.range(-2, 2), 0.5], a, h * rng.range(0.6, 1.2), 1.7, rng.range(-0.25, 0.25), 0.3)); }
}

const FORMS = {
  stems(K, rng, g, plump) {
    const sub = g.sub ?? {};
    let y0 = 0;
    if (sub.kind === 'twig') { // a fallen stick the fruit bodies sit on
      const rt = sub.r, x0 = sub.x0, x1 = sub.x1;
      tb(K, [[x0, -rt * 0.9], [mix(x0, x1, 0.35), -rt * (1 + sub.bow)], [mix(x0, x1, 0.7), -rt * (1 - sub.bow * 0.5)], [x1, -rt * 0.9]], profile([[0, rt * 0.8], [0.5, rt], [1, rt * 0.7]]));
      if (sub.fork) { const fx = mix(x0, x1, sub.fork); tb(K, [[fx, -rt], [fx + sub.fd * rt * 2.2, -rt * 2.6], [fx + sub.fd * rt * 4.4, -rt * 3.4]], profile([[0, rt * 0.6], [1, rt * 0.4]])); }
      y0 = -rt * 1.7;
    } else if (sub.kind === 'mound') {
      const pts = []; const w = wob(rng, 3);
      for (let i = 0; i <= 20; i++) { const a = PI + i / 20 * PI; pts.push([sub.x + Math.cos(a) * sub.w, Math.sin(a) * sub.h * (1 + 0.18 * w(a * 2))]); }
      K.poly(pts); y0 = -sub.h * 0.55;
    }
    // grass tufts snap against the nearest stalk base, so they never float as separate scraps
    if (sub.grass) for (const [x, n, h] of sub.grass) {
      let q = g.stems[0];
      for (const t of g.stems) if (Math.abs(t.x - x) < Math.abs(q.x - x)) q = t;
      const hd = q.head ?? {}, sd = x >= q.x ? 1 : -1, rw = q.h > 1 ? q.r * (q.flare ?? 1) * plump : (hd.form === 'ball' || hd.form === 'tuber') ? hd.w * q.s * 0.8 : q.volva ? q.volva.w : q.egg ? q.egg.w : hd.wid ? hd.wid * q.s * 0.8 : q.r;
      grass(K, rng, q.x + sd * (rw + 0.6), n, h);
    }
    let main = null;
    g.stems.forEach((st, i) => {
      const yb = st.y ?? (y0 * (st.onSub ?? 1)), base = [st.x, yb], h = st.h, r = st.r * plump;
      let e, path = null, rad = null;
      if (h > 1) {
        const top = [st.x + st.lean * h, yb - h], mid = [st.x + st.lean * h * (0.5 + st.arc) + st.sway * h, yb - h * 0.5];
        path = spline([base, mid, top], 10);
        rad = profile([[0, r * st.flare], [0.16, r * mix(st.flare, 1, 0.75)], [0.6, r * mix(1, st.taper, 0.6) * (st.belly ?? 1)], [1, r * st.taper]]);
        K.poly(tube(path, rad));
        e = pathAt(path, 1);
        if (st.bulb) oval(K, [st.x, yb - st.bulb.h * 0.75], st.bulb.w, st.bulb.h);
        if (st.ribs) for (let k = 0; k < 6; k++) for (const sd of [-1, 1]) { const t = mix(0.08, 0.8, (k + rng.range(0.1, 0.9)) / 6), q = pathAt(path, t); oval(K, polar(q.p, q.ang + sd * PI / 2, rad(t) * 0.9), rad(t) * 0.5, rad(t) * 0.16, q.ang + rng.range(-0.2, 0.2)); }
        if (st.volva) {
          const v = st.volva, Fv = frame(base, UP, 1, 1);
          K.poly(lathe(Fv, [[0, v.w * 0.62], [v.h * 0.3, v.w], [v.h * 0.8, v.w * 0.94], [v.h, v.w * 1.04]]));
          for (const sd of [-1, 0, 1]) K.poly(leaf([st.x + sd * v.w * 0.72, yb - v.h * 0.85], UP + sd * 0.35 + rng.range(-0.15, 0.15), v.h * rng.range(0.45, 0.7), v.w * 0.62, 0, 0.3));
        }
        if (st.rings) for (let k = 0; k < st.rings; k++) for (const sd of [-1, 1]) dot(K, [st.x + sd * r * st.flare * (1 - k * 0.1), yb - r * st.flare * (0.75 + k * 0.5)], r * 0.36);
        if (st.ring) {
          const q = pathAt(path, st.ring.t), rs = rad(st.ring.t), L = st.ring.len, Fr = frame(q.p, q.ang + PI, 1, 1);
          K.poly(lathe(Fr, [[-L * 0.3, rs * 0.9], [L * 0.15, mix(rs, st.ring.w, 0.55)], [L * 0.75, st.ring.w], [L, st.ring.w * 0.96]], 5));
        }
      } else {
        e = { p: base, ang: UP + st.lean };
        if (st.volva) { const v = st.volva; oval(K, [st.x, yb - v.h * 0.55], v.w, v.h * 0.7); for (const sd of [-1, 1]) K.poly(leaf([st.x + sd * v.w * 0.7, yb - v.h * 0.8], UP + sd * 0.5, v.h * 0.7, v.w * 0.6, 0, 0.3)); }
        if (st.egg) { const v = st.egg; oval(K, [st.x, -v.h * 0.5], v.w, v.h * 0.5); for (const sd of [-1, 1]) K.poly(leaf([st.x + sd * v.w * 0.6, -v.h * 0.8], UP + sd * rng.range(0.4, 0.8), v.h * rng.range(0.35, 0.5), v.w * 0.55, 0, 0.3)); }
      }
      const ax = (h > 1 ? toward(UP, e.ang, st.tilt ?? 0.6) : e.ang) + (st.tiltA ?? 0);
      if (i > 0 || g.selfHead) FB[st.head.form](K, rng, e.p, ax, st.s, st.head);
      if (i === 0) main = { path, rad, e, ax, r, st, base };
    });
    const m = main, R = g.R ?? m.r, out = { r: R, path: m.path, rad: m.rad };
    if (g.body) {
      const b = g.body, c = [b.x, -b.cy];
      out.head = { p: [b.x + b.rx * 0.78, -b.cy * (b.hy ?? 0.9)], dir: -0.3, face: 0, s: clamp(Math.min(b.rx, b.ry) * 0.6, 4.5, 9) };
      out.strips = [arcStrip(c, b.rx, b.ry, PI * 1.08, PI * 1.72)];
      out.legsX = [b.x - b.rx * 0.5, b.x + b.rx * 0.5]; out.tailP = [b.x - b.rx * 0.85, -Math.min(b.cy, R) * 0.6];
      if (!out.path) { out.path = [[b.x - b.rx * 0.6, -b.cy], [b.x, -b.cy], [b.x + b.rx * 0.6, -b.cy]]; out.rad = () => b.ry * 0.8; }
    } else {
      out.head = { p: m.e.p, dir: m.ax, face: rng.range(-0.15, 0.2), s: g.headS, radial: true };
      if (m.path) {
        out.strips = [sideStrip(m.path, m.rad, 0.25, 0.85, 8, -1), sideStrip(m.path, m.rad, 0.25, 0.85, 8, 1)]; out.alt = true;
        const q = pathAt(m.path, 0.62), rs = m.rad(0.62);
        out.arms = [{ p: add(q.p, [rs * 0.6, 0]), sd: 1 }, { p: add(q.p, [-rs * 0.6, 0]), sd: -1 }];
      } else { out.strips = [arcStrip(m.base, R, R, PI * 1.1, PI * 1.7)]; out.path = [add(m.base, [-R, -R]), add(m.base, [R, -R])]; out.rad = () => R; }
      const fw = m.r * (m.st.flare ?? 1) * 0.5 + 1;
      out.legsX = [m.st.x - fw, m.st.x + fw]; out.tailP = [m.st.x - fw * 1.4, (m.st.y ?? y0) - R * 0.6];
      out.legY = m.base[1];
    }
    return out;
  },

  // A broken stump (or a lying log) carrying shelves and side-growing fruit bodies.
  wood(K, rng, g) {
    const out = {};
    if (g.kind === 'log') {
      const L = g.len, rr = g.rr, x0 = -L / 2, x1 = L / 2, w = wob(rng, 2), top = [], N = 16;
      const yt = u => -rr * (1.75 + 0.1 * w(u * 3) + g.bow * Math.sin(u * PI));
      for (let i = 0; i <= N; i++) top.push([mix(x0, x1, i / N), yt(i / N)]);
      const logBody = (layer = 'k') => {
        if (g.round) { // a sawn end: a rounded oval face with a bark lip, instead of a square block
          const fy = yt(1) * 0.5, fr = -fy;
          K.poly([[x0 - rr * 0.25, 0], [x0 - rr * 0.3, yt(0) * 0.6], ...top, [x1, yt(1)], [x1, 0]], layer);
          oval(K, [x1, fy], rr * 0.8, fr, 0, layer);
          return fy;
        }
        K.poly([[x0 - rr * 0.25, 0], [x0 - rr * 0.3, yt(0) * 0.6], ...top, [x1 + rr * 0.3, yt(1) * 0.55], [x1 + rr * 0.2, 0]], layer);
        oval(K, [x1, yt(1) * 0.5], rr * 0.45, -yt(1) * 0.5, 0, layer);
      };
      const fy = logBody();
      if (g.round && g.rings) { // bark lip and growth rings on the cut face
        const fr = -fy, ex = x1 + rr * 0.1;
        oval(K, [ex, fy], rr * 0.55, fr * 0.74, 0, 'w');
        oval(K, [ex, fy], rr * 0.36, fr * 0.5, 0, 'k2');
      }
      if (g.snag) { const sx = mix(x0, x1, g.snag); tb(K, [[sx, yt(g.snag) * 0.8], [sx + g.sd * rr * 0.9, yt(g.snag) - rr * 1.2], [sx + g.sd * rr * 1.5, yt(g.snag) - rr * 2.1]], profile([[0, rr * 0.5], [1, rr * 0.3]])); }
      for (const sh of g.shelves ?? []) {
        const b = [mix(x0, x1, sh.t) + (sh.dx ?? 0), yt(sh.t) * (sh.dip ?? 0.7) + (sh.dy ?? 0)];
        if (sh.cap) { capShelf(K, rng, b, sh.sd, sh.len, sh.th, sh.droop); continue; }
        if (!sh.front) { lobe(K, rng, b, sh.sd, sh.len, sh.w0, sh.w1, sh); continue; }
        // a front fan: drawn over the back ones with a thin pale gap, so overlaps read as layers
        let poly = null; lobe({ poly: q => { poly = q; } }, rng, b, sh.sd, sh.len, sh.w0, sh.w1, sh);
        K.poly(tube([...poly, poly[0], poly[1]], 1.0), 'w'); K.poly(poly, 'k2');
      }
      if (g.shelves?.some(sh => sh.front)) logBody('k2');
      if (g.column) { const [cx, cy, h, cr] = g.column; tb(K, [[x1 - cx, yt(1) * 0.8], [x1 - cx, yt(1) - h]], profile([[0, cr * 1.2], [1, cr]]), 5); K.poly(tube(spline([[x1 - cx, yt(1) * 0.8], [x1 - cx, yt(1) - h]], 5), profile([[0, cr * 1.2], [1, cr]])), 'k2'); }
      for (const it of g.items ?? []) { const q = [mix(x0, x1, it.t), yt(it.t) * (it.dip ?? 0.92)]; if (it.stem) tb(K, [q, polar(q, UP + it.ax, it.stem)], it.stemW ?? 1); FB[it.fb.form](K, rng, polar(q, UP + it.ax, it.stem ?? 0), UP + it.ax, it.s, it.fb); }
      const c = [0, -rr];
      out.r = rr; out.path = [[x0, -rr], [0, -rr], [x1, -rr]]; out.rad = () => rr * 0.85;
      out.head = { p: [x1 + rr * 0.1, -rr * 1.05], dir: -0.25, face: 0, s: rr * 0.8 };
      out.strips = [top.filter((_, i) => i > 1 && i < N - 3 && i % 2 === 0).map((p, i, a) => ({ p: add(p, [0, rr * 0.2]), dir: UP, t: i / (a.length - 1) }))];
      out.legsX = [x0 * 0.6, x1 * 0.6, x0 * 0.3, x1 * 0.85]; out.wide = true; out.tailP = [x0, -rr];
      return out;
    }
    const w = g.w, h = g.h, lean = g.lean * h, wb = wob(rng, 2);
    const cx = t => lean * t * t, hw = (t, sd) => w * (1 + g.flare * (1 - t) ** 3 + 0.06 * wb(t * 4 + sd));
    const Lp = [], Rp = [], N = 12;
    for (let i = 0; i <= N; i++) { const t = i / N; Lp.push([cx(t) - hw(t, -1), -h * t]); Rp.push([cx(t) + hw(t, 1), -h * t]); }
    const jag = [], nj = g.teeth ?? 4, xl = cx(1) - hw(1, -1), xr = cx(1) + hw(1, 1);
    for (let i = 0; i < nj; i++) { const u = (i + 0.5) / nj; jag.push([mix(xl, xr, u - 0.32 / nj), -h - w * g.jag * rng.range(0.25, 1)], [mix(xl, xr, u + 0.3 / nj), -h + w * rng.range(0, 0.25)]); }
    if (g.smooth) { jag.length = 0; const sl = g.slant ?? 0; for (let i = 1; i < 8; i++) { const u = i / 8; jag.push([mix(xl, xr, u), -h - w * (0.35 * Math.sin(u * PI) + sl * (u - 0.5))]); } }
    K.poly([...Lp, ...jag, ...Rp.reverse()]);
    if (g.roots) for (const sd of [-1, 1]) K.poly(leaf([sd * w * 0.9, -w * 0.35], sd > 0 ? 0.25 : PI - 0.25, w * rng.range(1.2, 1.8), w * 0.75, 0, 0.25));
    if (g.snag) { const t = g.snag, sd = g.sd, b = [cx(t) + sd * hw(t, sd) * 0.6, -h * t]; tb(K, [b, add(b, [sd * w * 1.2, -w * 0.9]), add(b, [sd * w * 2.0, -w * 2.1])], profile([[0, w * 0.4], [1, w * 0.26]])); }
    const at = (t, sd) => [cx(t) + sd * hw(t, sd) * 0.8, -h * t];
    for (const sh of g.shelves ?? []) if (sh.lobe) lobe(K, rng, [cx(sh.t) + sh.sd * (sh.dx ?? 0) * w, -h * sh.t], sh.sd, sh.len, sh.w0, sh.w1, sh); else shelf(K, rng, sh.center ? [cx(sh.t), -h * sh.t] : at(sh.t, sh.sd), sh.sd, sh.len, sh.th, sh);
    for (const it of g.items ?? []) {
      const q = at(it.t, it.sd), ax = it.sd > 0 ? it.ax : PI - it.ax;
      const e = it.stem ? polar(q, ax, it.stem) : q;
      if (it.stem) tb(K, [add(q, [-it.sd * 1.5, 0]), e], it.stemW ?? 1.2);
      FB[it.fb.form](K, rng, e, ax + (it.turn ?? 0) * it.sd, it.s, it.fb);
    }
    out.r = w; out.path = spline([[0, 0], [cx(0.5), -h * 0.5], [cx(1), -h]], 6); out.rad = t => hw(t, 1);
    out.head = { p: [cx(1), -h + w * 0.2], dir: UP + g.lean * 0.8, face: rng.range(-0.1, 0.2), s: w * 0.92, radial: true };
    out.strips = [sideStrip(out.path, out.rad, 0.3, 0.9, 8, -1), sideStrip(out.path, out.rad, 0.3, 0.9, 8, 1)]; out.alt = true;
    out.arms = [{ p: at(0.6, 1), sd: 1 }, { p: at(0.6, -1), sd: -1 }];
    out.legsX = [-w * 0.6, w * 0.6]; out.tailP = [-w, -w * 0.6];
    return out;
  },

  // Cordyceps: a caterpillar on the soil with stalked clubs growing out of it.
  cordy(K, rng, g) {
    const L = g.len, rr = g.rr, n = g.segs, x0 = -L / 2, pts = [];
    const cy = u => -rr * 0.92 - g.hump * rr * Math.sin(u * PI) ** 2 - (u > 0.8 ? (u - 0.8) * rr * g.rear * 5 : 0);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, c = [x0 + L * u, cy(u)], k = 0.72 + 0.28 * Math.sin(PI * mix(0.12, 0.9, u));
      pts.push(c); oval(K, c, L / n * 0.68, rr * k);
      if (i > 0 && i < n - 1 && g.feet) dot(K, [c[0], -0.7], 0.9);
    }
    const hp = [x0 + L + rr * 0.15, cy(1) - rr * 0.05]; dot(K, hp, rr * 0.7);
    tb(K, [[x0 - rr * 0.2, -rr * 1.0], [x0 - rr * 0.9, -rr * 1.5]], profile([[0, rr * 0.3], [1, 0.4]])); // tail horn
    for (const c of g.clubs) {
      const u = c.t, b = [x0 + L * u, cy(u) - rr * 0.5];
      FB.clubs(K, rng, b, UP + c.lean, 1, c.fb);
    }
    return {
      r: rr, path: pts, rad: () => rr * 0.8, wide: true,
      head: { p: hp, dir: -0.15, face: 0, s: rr * 0.95 },
      strips: [pts.slice(1, -1).map((p, i, a) => ({ p: add(p, [0, -rr * 0.75]), dir: UP, t: i / (a.length - 1) }))],
      legsX: [x0 + L * 0.2, x0 + L * 0.8, x0 + L * 0.35, x0 + L * 0.65], tailP: [x0, -rr],
    };
  },
};

// =====================================================================
// REGISTERED PARTS
// =====================================================================
chassis.fungus = (C, g) => {
  const own = g._own, ownLimbs = !!own && C.lift === own.limbs.lift;
  if (own) for (const o of own.mute) { for (const k of Object.keys(o)) delete o[k]; o.type = 'none'; } // lend-only ornaments
  const R0 = g.R ?? 6, dy = ownLimbs ? 0 : C.lift * R0 * 1.1 + R0 * 0.15;
  const K = pen(C.ink, dy, true);
  const o = FORMS[g.form](K, C.rng, g, C.plump);
  const sh = p => [p[0], p[1] - dy], r = o.r;
  const limbs = [];
  if (!ownLimbs) {
    const ls = clamp(r, 4, 9);
    o.legsX.forEach((x, i) => limbs.push({ p: [x, -dy - ls * 0.3 + (o.legY ?? 0)], dir: PI / 2, s: ls, role: o.wide ? (x > 0 ? 'fore' : 'hind') : 'hind', far: i >= 2, ground: 0, fwd: 0, side: 1 }));
    for (const a of o.arms ?? []) limbs.push({ p: sh(a.p), dir: a.sd > 0 ? C.rng.range(0.3, 1.0) : PI - C.rng.range(0.4, 1.1), s: ls * 0.8, role: 'arm', fwd: PI / 2, side: a.sd });
  }
  return {
    view: 'side', rooted: true, alt: !!o.alt, r,
    path: o.path.map(sh), rad: o.rad,
    head: { sym: false, ...o.head, p: sh(o.head.p) },
    tail: { p: sh(o.tailP), dir: PI + C.rng.range(0, 0.35), s: clamp(r, 4, 9) * 0.6 },
    limbs, back: o.strips.map(st => st.map(k => ({ ...k, p: sh(k.p) }))),
    fungus: { dy, muteHead: !!g.selfHead || g.form !== 'stems' },
  };
};

// One head type for every fruit body. On a fungus chassis it is simply the top of the main stalk.
// On another tag's body it grows from a small face-bulb, so the creature keeps somewhere to look from.
heads.fungusFB = (C, sock, g) => {
  const { ink, rng } = C, fz = C.plan.fungus, s0 = fz ? sock.s : Math.max(sock.s, 4.2); // tiny arthropod heads still get a legible fruit body
  if (fz) {
    if (fz.muteHead) return { eyes: [], mounts: [{ p: sock.p, dir: sock.dir, flip: 1, s: s0 }], spots: [], isCap: true };
    const K = pen(ink, fz.dy, true), r = FB[g.form](K, rng, [sock.p[0], sock.p[1] + fz.dy], sock.dir, s0, g);
    const up = p => [p[0], p[1] - fz.dy];
    return { eyes: [], mounts: [{ p: up(r.top), dir: sock.dir, flip: 1, s: s0 }], spots: (r.spots ?? []).map(q => ({ p: up(q.p), r: q.r })), isCap: true };
  }
  const K = pen(ink), s = s0 * (g.lend ?? 0.8), sym = sock.sym;
  const ax = sym ? sock.dir : toward(sock.dir, UP, g.upright ?? 0.55);
  const bl = g.bulb ?? 0.7, eyes = [];
  let p = sock.p;
  if (bl > 0) {
    p = polar(sock.p, ax, s0 * bl * 0.75);
    K.poly(tube([sock.p, p], profile([[0, s0 * 0.78], [1, s0 * bl]])));
    if (sym) for (const sd of [-1, 1]) eyes.push({ p: polar(polar(sock.p, ax, s0 * bl * 0.5), ax + sd * PI / 2, s0 * bl * 0.55), r: s0 * 0.17 });
    else eyes.push({ p: polar(polar(sock.p, ax, s0 * bl * 0.45), sock.face, s0 * bl * 0.5), r: s0 * 0.19 });
    p = polar(sock.p, ax, s0 * bl * (g.seat ?? 1.2));
  } else K.poly(tube([sock.p, polar(sock.p, ax, s0 * 0.4)], s0 * 0.7));
  const gg = sym ? { ...g, skew: 0, wavy: 0, tiltRim: 0, tilt: 0, asym: 0, bow: 0 } : g;
  const r = FB[g.form](K, rng, p, ax, s, gg);
  if (bl <= 0) {
    const c = r.c ?? lerp(p, r.top, 0.5);
    if (sym) for (const sd of [-1, 1]) eyes.push({ p: polar(polar(c, ax, s * 0.3), ax + sd * PI / 2, r.w * 0.5), r: s0 * 0.17 });
    else eyes.push({ p: polar(c, sock.face - 0.2, r.w * 0.5), r: s0 * 0.19 });
  }
  const mounts = sym
    ? [-1, 1].map(sd => ({ p: polar(lerp(p, r.top, 0.6), ax + sd * PI / 2, r.w * 0.45), dir: ax + sd * 0.7, flip: sd, s: s0 }))
    : [{ p: r.top, dir: ax, flip: 1, s: s0 }];
  return { eyes: g.eyeless ? [] : eyes, mounts, spots: r.spots ?? [], isCap: true };
};

// Growths along a back: a troop of little fruit bodies of differing sizes.
dorsals.fungusGrowth = (C, plan, strip, sd, si, g, at) => {
  const { rng } = C, K = pen(C.ink), r = plan.r, n = g.n, side = plan.view === 'side';
  for (let i = 0; i < n; i++) {
    if (plan.alt && (i + si) % 2) continue;
    const u = clamp((i + 0.5) / n + rng.range(-0.06, 0.06), 0, 1), k = at(u), env = 0.62 + 0.5 * Math.sin(PI * mix(0.1, 0.9, u));
    const sz = g.size * env * rng.range(0.7, 1.2) * (side ? 1 : 0.8);
    let a = k.dir + rng.range(-0.25, 0.25) + (g.rake ?? 0) * (i % 2 ? 1 : -1);
    if (side) a = toward(a, UP, plan.rooted ? 0.45 : 0.25);
    const L = r * g.stem * sz, base = polar(k.p, k.dir, -r * 0.3), top = polar(k.p, a, L);
    K.poly(tube([base, top], Math.max(r * (g.stemW ?? 0.16) * sz, 0.7)));
    FB[g.fb.form](K, rng, top, a, r * sz * (g.hw ?? 0.6) / g.fb.span, g.fb);
  }
};
// A frilled, lobed crest: the edge of a bracket rosette.
dorsals.fungusFrill = (C, plan, strip, sd, si, g) => {
  const { rng } = C, K = pen(C.ink), r = plan.r, n = strip.length;
  if (plan.alt && si === 1 && plan.view === 'side') return;
  for (let j = 0; j < (g.tiers ?? 1); j++) for (let i = 0; i < n; i++) {
    const u = i / (n - 1), k = strip[i], env = Math.sin(PI * mix(0.08, 0.92, u)) ** 0.6, h = r * g.h * env * (1 - j * 0.35) * rng.range(0.8, 1.15);
    const c = polar(k.p, k.dir + (j ? 0.5 : 0), h * 0.35);
    oval(K, c, h * 0.75, Math.max(r * g.wid * (1 + j * 0.3), 1), k.dir + rng.range(-0.25, 0.25));
  }
};

// Fruit bodies sprouting from the head: little caps, coral antlers, pixie cups.
crowns.fungusSprout = (C, m, F, s, g) => {
  const { rng } = C, K = pen(C.ink), n = m.far ? 1 : (g.n ?? 1);
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, sz = (i === 0 || n === 1 ? 1 : rng.range(0.55, 0.85));
    const a = m.dir + m.flip * (u * (g.spread ?? 0.9) * 0.5 + (g.lean ?? 0)) + rng.range(-0.1, 0.1);
    const b = F(-0.15, u * 0.35), top = polar(b, a, s * g.stem * sz * rng.range(0.8, 1.15));
    K.poly(tube([b, top], Math.max(s * (g.stemW ?? 0.14) * sz, 0.7)));
    FB[g.fb.form](K, rng, top, toward(a, UP, C.plan.view === 'side' ? 0.3 : 0), s * sz * (g.hw ?? 0.55) / g.fb.span, g.fb);
  }
};

// A fruit body at the end of a tail (puffball tails, club tails).
tips.fungusFB = (C, e, ea, s, g) => {
  const K = pen(C.ink), a = C.plan.view === 'side' ? toward(ea, UP, g.tipUp ?? 0.5) : ea;
  FB[g.fb.form](K, C.rng, e, a, s * (g.size ?? 1) * 0.95 / g.fb.span, g.fb);
};

// A stubby foot with a bulbous base, like the foot of a stipe.
feet.fungusBulb = (C, p, ang, s, g, k) => {
  if (C.plan.view === 'side') { const ry = s * 0.2 * k; C.ink.oval([p[0] + s * 0.08, Math.min(p[1], -ry)], s * 0.36 * k, ry, 0); }
  else C.ink.dot(polar(p, ang, s * 0.1 * k), s * 0.3 * k);
};

// =====================================================================
// GENE HELPERS
// =====================================================================
const st = (x, h, r, o = {}) => ({ x, h, r, lean: 0, sway: 0, arc: 0.12, flare: 1.25, taper: 0.82, ...o });

// Lendable ornaments built from a fruit-body gene. They are muted on the species' own chassis.
// Ornaments are drawn small and many times over (a troop on each flank), so their fruit body is
// a lighter version: fewer warts, teeth, scales, lobes and branches. Keeps mixes fast and legible.
function lite(fb) {
  const c = { ...fb, skirt: 0 }, cap = (k, m) => { if (c[k] != null) c[k] = Math.min(c[k], m); };
  cap('warts', fb.form === 'tuber' ? 14 : 4); cap('teeth', fb.form === 'mane' ? 8 : 5); cap('shag', 3); cap('depth', 2); cap('rays', 6);
  cap('n', { ruffle: 9, fronds: 5, clubs: 3, arms: 4, jelly: 3, brain: 4, coral: 2 }[fb.form] ?? 6); cap('cells', 5); cap('eggs', 2);
  return c;
}
function lends(r, fb, o = {}) {
  const small = lite(o.small ?? fb);
  return {
    tail: { len: r.range(5, 8), w0: r.range(0.2, 0.28), mid: 0.5, w1: 0.15, curl: r.range(1.2, 2.4), wave: r.range(0.3, 1), up: true, tip: 'fungusFB', fb: small, size: (o.tipS ?? 1) * r.range(0.7, 0.95) },
    dorsal: o.dorsal ?? { type: 'fungusGrowth', n: r.int(3, 5), size: r.range(0.8, 1.15), stem: o.stem ?? r.range(0.5, 1.2), stemW: o.stemW ?? 0.16, hw: (o.hw ?? 0.6) * 0.72, rake: o.rake ?? 0, fb: small },
    crown: o.crown ?? { type: 'fungusSprout', n: o.cn ?? r.int(1, 3), stem: (o.stem ?? r.range(0.5, 1.2)) * 1.1, stemW: o.stemW ?? 0.15, spread: r.range(0.7, 1.3), hw: (o.hw ?? 0.6) * 1.05, pair: !!o.pair, fb: small },
  };
}
function build(r, ch, head, lo = {}) {
  const L = lends(r, lo.fb ?? head, lo);
  const limbs = { len: r.range(1.1, 1.5), w: 0.6, taper: 0.85, bend: 0.4, foot: 'fungusBulb', lift: r.range(0.1, 0.16), stance: 0.12, arm: 0.8, hindW: 1.1 };
  ch.type = 'fungus'; ch._own = { limbs, mute: [L.tail, L.dorsal, L.crown] };
  return { chassis: ch, head: { type: 'fungusFB', ...head }, limbs, tail: L.tail, dorsal: L.dorsal, crown: L.crown, surface: { eyes: r.chance(0.8) ? 'dot' : 'none', capSpots: lo.spots ? r.int(4, 7) : 0 } };
}
// shorthand for a stems-form species whose main fruit body is the head slot
function stemsSp(r, stems, o = {}) {
  const ch = { form: 'stems', stems, headS: stems[0].s, R: o.R ?? Math.max(stems[0].r * 1.2, 4.5), sub: o.sub, selfHead: !!o.body, body: o.body };
  return build(r, ch, stems[0].head, o);
}
// a tuft: stalks splaying from one base, tallest first
function tuft(r, n, o) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, k = 1 - o.drop * Math.abs(u) ** 1.3;
    out.push(st(u * o.gap * (n - 1) * 0.5 + r.range(-0.6, 0.6), o.h * k * r.range(0.78, 1.08), o.r * r.range(0.9, 1.1), { lean: u * o.splay * r.range(0.75, 1.2) + r.range(-0.05, 0.05), arc: o.arc ?? 0.2, flare: 1.1, taper: 0.9, s: o.s * r.range(0.78, 1.05) * (1 - 0.15 * Math.abs(u)), head: o.head(r), tilt: 0.75, ...(o.each ? o.each(r) : {}) }));
  }
  return out.sort((a, b) => b.h - a.h);
}
// a troop: separate stalks standing in a row
function troop(r, n, o) {
  const out = []; let x = 0;
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, k = (1 - (o.drop ?? 0) * u * u) * r.range(0.6, 1.1);
    out.push(st(x, o.h * k, o.r * r.range(0.9, 1.1), { lean: r.range(-o.lean, o.lean), sway: r.range(-o.sway, o.sway), flare: o.flare ?? 1.2, taper: 0.9, s: o.s * mix(0.72, 1, k) * r.range(0.9, 1.05), head: o.head(r), tilt: 0.7, ...(o.each ? o.each(r) : {}) }));
    x += o.gap * r.range(0.75, 1.3);
  }
  for (const s of out) s.x -= x / 2;
  return out.sort((a, b) => b.h - a.h);
}
const stub = (r, o = {}) => ({ form: 'wood', kind: 'stub', w: r.range(3.2, 4.0), h: r.range(24, 30), lean: r.range(-0.15, 0.15), flare: r.range(0.45, 0.75), jag: r.range(0.5, 1.0), teeth: r.int(2, 4), roots: r.chance(0.5), snag: r.chance(0.25) ? r.range(0.5, 0.8) : 0, sd: r.sign(), R: 6, ...o });

// ---- cap genes ----
const CAP = {
  dome: r => ({ form: 'cap', span: 2.3, w: r.range(2.0, 2.6), h: r.range(1.15, 1.6), a: 2.1, b: 0.5, under: r.range(0.1, 0.2), rim: 0.14 }),
  flyOpen: r => ({ form: 'cap', span: 2.7, w: r.range(2.5, 3.1), h: r.range(0.7, 1.0), a: 2.6, b: 0.55, under: 0.1, rim: 0.12, curl: r.range(-0.05, 0.25) }),
  button: r => ({ form: 'cap', span: 1.2, w: r.range(1.05, 1.3), h: r.range(1.3, 1.6), a: 2.2, b: 0.45, under: 0.02, rim: 0.3, sink: 0.25 }),
  parasol: r => ({ form: 'cap', span: 3.2, w: r.range(2.9, 3.6), h: r.range(0.5, 0.75), a: 2.4, b: 0.62, umbo: r.range(0.3, 0.45), umboW: 0.15, under: 0.06, rim: 0.08, curl: r.range(-0.12, 0.1) }),
  drumstick: r => ({ form: 'cap', span: 1.1, w: r.range(1.0, 1.2), h: r.range(1.5, 1.9), a: 2.2, b: 0.42, under: 0.02, rim: 0.25, sink: 0.4 }),
  bun: r => ({ form: 'cap', span: 2.2, w: r.range(1.9, 2.5), h: r.range(1.15, 1.5), a: 2.3, b: 0.5, under: -0.14, rim: 0.2, thick: 0.3 }),
  wavy: r => ({ form: 'cap', span: 2.5, w: r.range(2.2, 2.7), h: r.range(1.0, 1.3), a: 2.6, b: 0.55, under: 0.1, rim: 0.2, thick: 0.34, wavy: r.range(0.15, 0.3), curl: r.range(0.05, 0.25), skew: r.range(-0.12, 0.12), tiltRim: r.range(-0.1, 0.1) }),
  witch: r => ({ form: 'cap', span: 1.9, w: r.range(1.8, 2.2), h: r.range(1.7, 2.1), a: 1.25, b: r.range(1.05, 1.25), under: 0.04, rim: 0.16, thick: 0.26, skew: r.sign() * r.range(0.18, 0.3), wavy: r.range(0.18, 0.28), curl: 0 }),
  bell: r => ({ form: 'cap', span: 1.05, w: r.range(0.9, 1.2), h: r.range(1.1, 1.5), a: 2, b: 0.34, umbo: 0.14, umboW: 0.25, under: 0.04, rim: 0.07, thick: 0.1 }),
  liberty: r => ({ form: 'cap', span: 0.95, w: r.range(0.8, 1.05), h: r.range(1.2, 1.6), a: 1.5, b: 0.62, umbo: r.range(0.22, 0.34), umboW: 0.11, under: 0.03, rim: 0.06, thick: 0.1 }),
  honey: r => ({ form: 'cap', span: 1.5, w: r.range(1.3, 1.75), h: r.range(0.7, 0.95), a: 2.3, b: 0.5, umbo: r.range(0.1, 0.25), umboW: 0.2, under: 0.12, rim: 0.1 }),
  penny: r => ({ form: 'cap', span: 1.6, w: r.range(1.4, 1.9), h: r.range(0.6, 0.9), a: 2.4, b: 0.5, under: 0.14, rim: 0.1, curl: r.range(-0.05, 0.3) }),
  dished: r => ({ form: 'cap', span: 2.3, w: r.range(2.0, 2.5), h: r.range(0.6, 0.8), a: 3, b: 0.5, dip: r.range(0.45, 0.7), curl: r.range(0.15, 0.35), under: -r.range(0.9, 1.3), rim: 0.14, thick: 0.4, wavy: r.range(0, 0.15) }),
  hedgehog: r => ({ form: 'cap', span: 2.4, w: r.range(2.1, 2.7), h: r.range(0.8, 1.05), a: 2.6, b: 0.5, under: 0.1, rim: 0.2, wavy: r.range(0.2, 0.4), skew: r.range(-0.2, 0.2), teeth: r.int(9, 12), thick: 0.3 }),
  hoof: r => ({ form: 'cap', span: 1.8, w: r.range(1.6, 2.1), h: r.range(1.3, 1.8), a: 1.7, b: 0.6, under: -0.03, rim: 0.16, steps: r.int(3, 5), thick: 0.4 }),
  fan: r => ({ form: 'cap', span: 1.8, w: r.range(1.6, 2.1), h: r.range(0.45, 0.65), a: 2.6, b: 0.5, under: 0.1, rim: 0.12, wavy: r.range(0.2, 0.45), curl: r.range(0.1, 0.4), thick: 0.2 }),
};

// =====================================================================
// SPECIES
// =====================================================================
const species = [
  // ---------------- agarics (stem and cap) ----------------
  { name: 'fly agaric', w: 3, genes: r => {
    const open = r.chance(0.3), s = r.range(8, 9.5), rr = r.range(3.8, 4.6);
    const stems = [st(0, r.range(30, 40), rr, { lean: r.range(-0.12, 0.12), flare: 1.3, rings: r.chance(0.3) ? 1 : 0, bulb: { w: rr * 1.6, h: rr * 1.45 }, ring: { t: r.range(0.72, 0.8), w: rr * r.range(1.35, 1.6), len: rr * r.range(1.5, 2.1) }, s, head: open ? CAP.flyOpen(r) : CAP.dome(r) })];
    const nk = r.wpick([[2, 1], [2, 0], [1, 2]]);
    for (let i = 0; i < nk; i++) { const sd = i ? -1 : r.sign(); stems.push(st(sd * r.range(15, 21), r.range(7, 13), 3.4, { flare: 1.5, bulb: { w: 5.4, h: 4 }, lean: sd * 0.1, s: r.range(5.2, 6.4), head: CAP.button(r) })); }
    return stemsSp(r, stems, { spots: true, sub: { grass: r.chance(0.4) ? [[r.range(-26, -20), 3, 9]] : null } });
  } },
  { name: 'parasol', w: 2, genes: r => {
    const s = r.range(8, 9), rr = r.range(2.3, 2.9);
    const stems = [st(0, r.range(44, 56), rr, { lean: r.range(-0.1, 0.1), sway: r.range(-0.05, 0.05), flare: 1.3, taper: 0.8, bulb: { w: rr * 2.2, h: rr * 1.6 }, ring: { t: r.range(0.74, 0.82), w: rr * 2.2, len: rr * 1.1 }, s, head: CAP.parasol(r) })];
    if (r.chance(0.6)) { const sd = r.sign(); stems.push(st(sd * r.range(15, 22), r.range(24, 34), 2.3, { lean: sd * r.range(0, 0.12), bulb: { w: 4.6, h: 3.4 }, s: r.range(5.6, 6.6), head: CAP.drumstick(r) })); }
    return stemsSp(r, stems, { small: CAP.parasol(r) });
  } },
  { name: 'shaggy inkcap', w: 2.2, genes: r => {
    const ink = (fl) => ({ form: 'inkcap', span: 1.15, w: r.range(1.0, 1.2), h: fl > 1 ? r.range(1.5, 2.0) : r.range(2.6, 3.3), flare: fl, shag: r.int(4, 6), lend: 0.75, seat: 2.4 });
    const s = r.range(7.6, 8.8), old = r.chance(0.25);
    const stems = [st(0, r.range(36, 46), 3, { lean: r.range(-0.08, 0.08), flare: 1.4, taper: 0.8, s, head: ink(old ? r.range(1.4, 1.7) : 1) })];
    const nk = r.wpick([[2, 1], [2, 2], [1, 0]]);
    for (let i = 0; i < nk; i++) { const sd = i ? -1 : 1; stems.push(st(sd * r.range(13, 18), r.range(18, 30), 2.6, { lean: sd * r.range(0, 0.12), flare: 1.4, s: s * r.range(0.6, 0.85), head: ink(r.chance(0.25) ? 1.5 : 1) })); }
    return stemsSp(r, stems, { stem: 0.3 });
  } },
  { name: 'bonnet cluster', w: 2.5, genes: r => {
    const n = r.int(5, 8);
    const stems = tuft(r, n, { h: r.range(36, 46), drop: 0.55, gap: 1.6, splay: r.range(0.34, 0.5), r: r.range(1.0, 1.25), s: r.range(5.6, 6.8), head: CAP.bell, arc: 0.22 });
    return stemsSp(r, stems, { R: 5, stem: r.range(1.2, 2), stemW: 0.1, sub: { kind: 'mound', x: 0, w: r.range(7, 10), h: 3 } });
  } },
  { name: 'honey fungus tuft', w: 2.2, genes: r => {
    const n = r.int(4, 7);
    const stems = tuft(r, n, { h: r.range(28, 36), drop: 0.5, gap: 2.2, splay: r.range(0.45, 0.62), r: r.range(1.4, 1.75), s: r.range(6.2, 7.4), head: CAP.honey, arc: 0.25, each: rr => ({ ring: { t: 0.8, w: 2.8, len: 2.2 } }) });
    return stemsSp(r, stems, { R: 6, sub: { kind: 'mound', x: 0, w: r.range(7, 9), h: 3 } });
  } },
  { name: 'penny bun', w: 2.5, genes: r => {
    const s = r.range(9, 10.5), rr = r.range(6.2, 7.6);
    const stems = [st(0, r.range(19, 26), rr, { lean: r.range(-0.12, 0.12), flare: 1.25, taper: 0.72, belly: 1.2, s, head: CAP.bun(r) })];
    if (r.chance(0.5)) { const sd = r.sign(); stems.push(st(sd * r.range(18, 23), r.range(7, 11), 4.6, { flare: 1.2, belly: 1.2, lean: sd * 0.1, s: r.range(5.5, 6.5), head: { ...CAP.bun(r), w: 1.5, h: 1.3 } })); }
    return stemsSp(r, stems, { stemW: 0.34, stem: 0.6 });
  } },
  { name: 'wood blewit', w: 1.5, genes: r => {
    const s = r.range(9, 10.5), rr = r.range(4.8, 5.8);
    const stems = [st(0, r.range(17, 24), rr, { lean: r.range(-0.15, 0.15), flare: 1.6, taper: 0.85, s, head: CAP.wavy(r), tiltA: r.range(-0.12, 0.12) })];
    if (r.chance(0.45)) { const sd = r.sign(); stems.push(st(sd * r.range(20, 25), r.range(7, 11), 3.6, { flare: 1.5, lean: sd * 0.2, s: r.range(5.5, 6.5), head: CAP.wavy(r), tiltA: sd * 0.25 })); }
    return stemsSp(r, stems, { stemW: 0.3, stem: 0.55 });
  } },
  { name: 'witch\'s hat', w: 1.6, genes: r => {
    const stems = troop(r, r.int(2, 3), { h: r.range(24, 32), gap: 15, r: r.range(2.5, 3.1), lean: 0.14, sway: 0.1, s: r.range(7.6, 8.8), head: CAP.witch, flare: 1.05 });
    return stemsSp(r, stems, { sub: { grass: [[r.range(-14, 14), r.int(2, 4), 10]] } });
  } },
  { name: 'fairy ring', w: 1.8, genes: r => {
    const stems = troop(r, r.int(3, 5), { h: r.range(21, 28), drop: 0.45, gap: 12, r: 1.7, lean: 0.12, sway: 0.06, s: r.range(6, 7), head: CAP.penny });
    return stemsSp(r, stems, { R: 5, sub: { grass: [[r.range(-30, -18), 3, 7], [r.range(-6, 6), 2, 6], [r.range(18, 30), 3, 7]] } });
  } },
  { name: 'funnel cap', w: 1.3, genes: r => {
    const s = r.range(8.5, 10), rr = r.range(3.4, 4.2);
    const stems = [st(0, r.range(17, 24), rr, { lean: r.range(-0.15, 0.15), flare: 1.4, taper: 1.15, s, head: CAP.dished(r), tiltA: r.range(-0.12, 0.12) })];
    if (r.chance(0.5)) { const sd = r.sign(); stems.push(st(sd * r.range(18, 23), r.range(9, 13), 2.6, { flare: 1.4, taper: 1.1, lean: sd * 0.15, s: r.range(5, 6), head: CAP.dished(r) })); }
    return stemsSp(r, stems, {});
  } },
  { name: 'hedgehog fungus', w: 1.4, genes: r => {
    const s = r.range(9, 10.5), rr = r.range(4.4, 5.4);
    const stems = [st(r.range(-3, 3), r.range(15, 21), rr, { lean: r.range(-0.2, 0.2), flare: 1.3, taper: 1.0, s, head: CAP.hedgehog(r) })];
    return stemsSp(r, stems, { stemW: 0.3, stem: 0.5 });
  } },

  // ---------------- funnels ----------------
  { name: 'chanterelle', w: 2.5, genes: r => {
    const fn = () => ({ form: 'funnel', span: 2.1, w: r.range(1.9, 2.4), h: r.range(2.9, 3.6), w0: r.range(0.5, 0.65), ruffle: r.range(0.1, 0.16), dip: r.range(0.1, 0.2), rim: 0.16, bow: r.range(-0.12, 0.12), bulb: 0.6, seat: 0.5, lend: 0.7 });
    const s = r.range(8.5, 10), stems = [st(0, 0, 4, { lean: r.range(-0.12, 0.12), s, head: fn() })];
    const nk = r.wpick([[2, 1], [2, 2], [1, 0]]);
    for (let i = 0; i < nk; i++) { const sd = i ? -1 : r.sign(); stems.push(st(sd * r.range(11, 16), 0, 3, { lean: sd * r.range(0.2, 0.42), s: s * r.range(0.5, 0.75), head: fn() })); }
    return stemsSp(r, stems, { body: { x: 0, cy: s * 1.7, rx: s * 1.5, ry: s * 1.6, hy: 0.75 }, R: 6, stem: 0.05 });
  } },
  { name: 'horn of plenty', w: 1.6, genes: r => {
    const fn = () => ({ form: 'vase', span: 1.7, w: r.range(1.35, 1.8), h: r.range(3.9, 4.9), w0: r.range(0.3, 0.38), flare: r.range(1.8, 2.3), thick: r.range(0.5, 0.6), depth: r.range(0.1, 0.16), wavy: r.range(0.04, 0.08), lip: r.range(0.2, 0.4), asym: r.range(-0.05, 0.05), bulb: 0.6, seat: 0.5, lend: 0.6 });
    const s = r.range(7.5, 8.8), n = r.wpick([[1, 1], [3, 2], [2, 3]]), stems = [];
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) * 2 - 1 : 0; stems.push(st(u * 6.5 + r.range(-1, 1), 0, 3, { lean: u * r.range(0.22, 0.36) + r.range(-0.06, 0.06), s: s * (i === 1 || n === 1 ? 1 : r.range(0.55, 0.8)), head: fn() })); }
    stems.sort((a, b) => b.s - a.s);
    return stemsSp(r, stems, { body: { x: 0, cy: s * 2.2, rx: s * 1.5, ry: s * 2, hy: 0.6 }, R: 5.5, stem: 0.05 });
  } },

  // ---------------- morels and kin ----------------
  { name: 'morel', w: 2.8, genes: r => {
    const mo = () => ({ form: 'morel', span: 1.3, w: r.range(1.15, 1.5), h: r.range(2.7, 3.5), point: r.range(0.1, 1), pits: r.int(4, 6), amp: r.range(0.1, 0.15), seat: 0.9, lend: 0.85 });
    const s = r.range(8, 9.5), rr = r.range(4.6, 5.6);
    const stems = [st(0, r.range(12, 18), rr, { lean: r.range(-0.16, 0.16), flare: 1.3, taper: 1.0, s, head: mo(), tilt: 1 })];
    if (r.chance(0.5)) { const sd = r.sign(); stems.push(st(sd * r.range(16, 20), r.range(6, 10), 3.4, { lean: sd * r.range(0.05, 0.25), flare: 1.3, taper: 1, s: s * r.range(0.55, 0.7), head: mo(), tilt: 1 })); }
    return stemsSp(r, stems, { spots: true, stem: 0.5, stemW: 0.3 });
  } },
  { name: 'false morel', w: 1.4, genes: r => {
    const s = r.range(8.5, 10), rr = r.range(5, 6);
    const stems = [st(0, r.range(9, 14), rr, { lean: r.range(-0.15, 0.15), flare: 1.25, taper: 1.0, s, head: { form: 'brain', span: 1.9, w: r.range(1.8, 2.3), h: r.range(1.8, 2.3), n: r.int(6, 9), bulb: 0.6, seat: 0.9, lend: 0.8 } })];
    return stemsSp(r, stems, { stem: 0.4, stemW: 0.3 });
  } },
  { name: 'elfin saddle', w: 1.4, genes: r => {
    const sa = () => ({ form: 'saddle', span: 1.8, w: r.range(1.7, 2.1), h: r.range(1.2, 1.6), lobes: r.wpick([[3, 2], [1, 3]]), th: r.range(0.2, 0.26) });
    const stems = troop(r, r.wpick([[3, 1], [1, 2]]), { h: r.range(15, 22), gap: 26, r: r.range(3.2, 3.8), lean: 0.1, sway: 0.06, s: r.range(7.5, 8.6), head: sa, flare: 1.3, each: () => ({ ribs: true, taper: 0.8 }) });
    return stemsSp(r, stems, {});
  } },

  // ---------------- stinkhorns ----------------
  { name: 'veiled lady', w: 1.8, genes: r => {
    const s = r.range(7.8, 8.8), rr = r.range(3.2, 3.8), h = r.range(44, 52);
    const stems = [st(0, h, rr, { lean: r.range(-0.05, 0.05), flare: 1.0, taper: 0.85, volva: { w: rr * 2, h: rr * 2.2 }, s, tilt: 1, head: { form: 'thimble', span: 0.95, w: r.range(0.85, 0.98), h: r.range(1.7, 2.1), skirt: r.range(2.4, 3.6), skirtW: r.range(2.2, 2.9), rows: r.int(4, 5), stemR: rr * 0.86 / s, seat: 1.5 } })];
    return stemsSp(r, stems, { stem: 1.1, stemW: 0.22 });
  } },
  { name: 'devil\'s fingers', w: 1.8, genes: r => {
    const s = r.range(8, 9.5), ar = { form: 'arms', span: 2.2, n: r.int(4, 6), len: r.range(3.0, 3.9), wid: r.range(0.36, 0.44), tipW: 0.5, fan: r.range(1.3, 1.7), curl: r.range(1.6, 2.4), bulb: 0.85, seat: 0.9, lend: 0.6 };
    const eh = s * r.range(1.3, 1.6);
    const stems = [st(0, 0, 4, { y: -eh * 0.82, egg: { w: s * r.range(0.75, 0.9), h: eh }, s, head: ar })];
    return stemsSp(r, stems, { body: { x: 0, cy: s * 1.4, rx: s * 1.0, ry: s * 1.0 }, R: 6, small: { ...ar, n: 3, len: 2.4, span: 1.5 }, stem: 0.1 });
  } },
  { name: 'lattice cage', w: 1.6, genes: r => {
    const s = r.range(9, 10.5), cg = { form: 'cage', span: 1.9, w: r.range(1.8, 2.2), h: r.range(3.6, 4.4), cells: r.int(6, 7), bulb: 0, lend: 0.62 };
    const eh = s * r.range(1.0, 1.25), stems = [st(0, 0, 4, { y: -eh * 0.78, lean: r.range(-0.08, 0.08), egg: { w: s * r.range(1.15, 1.35), h: eh }, s, head: cg })];
    return stemsSp(r, stems, { body: { x: 0, cy: s * 2.1, rx: s * 1.9, ry: s * 2 }, R: 7, stem: 0.3, hw: 0.75 });
  } },

  // ---------------- puffballs and other gasteroids ----------------
  { name: 'common puffball', w: 2.6, genes: r => {
    const pb = () => ({ form: 'ball', span: 1.6, w: r.range(1.45, 1.8), h: r.range(3.0, 3.8), pear: r.range(0.9, 1.5), foot: r.range(0.45, 0.6), beak: r.range(0.25, 0.45), warts: r.chance(0.6) ? r.int(9, 13) : 0, wartL: 0.26, lumpy: 0.04, bulb: 0, lend: 0.75 });
    const s = r.range(8.5, 10), stems = [st(0, 0, 4, { lean: r.range(-0.12, 0.12), s, head: pb() })];
    const nk = r.wpick([[2, 1], [2.5, 2], [1, 3]]);
    for (let i = 0; i < nk; i++) { const sd = i % 2 ? -1 : 1; stems.push(st(sd * (s * 1.6 + i * 3 + r.range(0, 4)), 0, 3, { lean: sd * r.range(0.05, 0.3), s: s * r.range(0.45, 0.78), head: pb() })); }
    return stemsSp(r, stems, { body: { x: 0, cy: s * 2, rx: s * 1.5, ry: s * 1.5 }, R: 7, spots: true, stem: r.range(0.1, 0.5), tipS: 1.1 });
  } },
  { name: 'giant puffball', w: 1, genes: r => {
    const s = 10, w = r.range(2.6, 3.3), h = r.range(3.9, 4.8);
    const stems = [st(0, 0, 4, { lean: r.range(-0.08, 0.08), s, head: { form: 'ball', span: 2.9, w, h, pear: r.range(0.25, 0.45), foot: r.range(0.3, 0.4), lumpy: r.range(0.03, 0.05), lf: 2, warts: r.int(9, 13), wartL: 0.28, wartW: 0.55, dent: r.chance(0.35) ? r.range(0.12, 0.2) : 0, bulb: 0, lend: 0.5 } })];
    if (r.chance(0.6)) { const sd = r.sign(); stems.push(st(sd * (w * s + r.range(4, 8)), 0, 3, { s: 10, head: { form: 'ball', span: 1, w: r.range(0.9, 1.3), h: r.range(1.5, 2.1), lumpy: 0.05 } })); }
    return stemsSp(r, stems, { body: { x: 0, cy: h * s * 0.5, rx: w * s, ry: h * s * 0.5 }, R: 9, stem: 0.05, sub: { grass: [[-w * s - 2, 3, 11], [w * s * r.range(0.6, 1.1), 3, 9], [r.range(-6, 6), 2, 7]] } });
  } },
  { name: 'earthstar', w: 2.4, genes: r => {
    const s = r.range(8.5, 10), arch = r.chance(0.4) ? r.range(0.5, 0.9) : r.range(0, 0.2);
    const es = { form: 'star', span: 2.4, rays: r.int(5, 8), len: r.range(2.4, 3.1), rw: r.range(0.42, 0.55), w: r.range(1.15, 1.4), h: r.range(1.9, 2.3), beak: r.range(0.4, 0.65), arch, neck: arch > 0.4 ? 0.5 : 0.1, bulb: 0, lend: 0.8 };
    const stems = [st(0, 0, 4, { y: -s * (0.5 + arch * 1.5), s, head: es })];
    return stemsSp(r, stems, { body: { x: 0, cy: s * (1.5 + arch * 1.5), rx: s * 1.3, ry: s * 1.1 }, R: 6, stem: 0.15, hw: 0.8 });
  } },
  { name: 'earthball', w: 1.1, genes: r => {
    const s = r.range(9, 10.5), old = r.chance(0.75), eb = { form: 'ball', span: 2, w: r.range(1.6, 2.0), h: r.range(2.8, 3.3), pear: r.range(0.35, 0.55), foot: 0.32, lumpy: r.range(0.05, 0.08), lf: 4, dent: old ? r.range(0.3, 0.4) : 0, warts: r.int(8, 11), wartL: 0.3, wartW: 0.45, roots: r.int(3, 5), bulb: 0, lend: 0.62 };
    const stems = [st(0, 0, 4, { lean: r.range(-0.12, 0.12), s, head: eb })];
    if (r.chance(0.5)) { const sd = r.sign(); stems.push(st(sd * s * r.range(2.4, 2.8), 0, 3, { lean: sd * 0.15, s: s * r.range(0.45, 0.6), head: { ...eb, dent: 0, roots: 3 } })); }
    return stemsSp(r, stems, { body: { x: 0, cy: s * 1.4, rx: s * 2, ry: s * 1.4 }, R: 7, stem: 0.1 });
  } },
  { name: 'bird\'s nest fungus', w: 1.6, genes: r => {
    const cup = (lid, k) => ({ form: 'vase', span: 1.3, w: r.range(1.1, 1.3), h: r.range(1.5, 1.85), w0: r.range(0.32, 0.42), flare: r.range(0.9, 1.15), thick: r.range(0.32, 0.38), depth: r.range(0.6, 0.68), lip: 0.04, incurve: 0.04, eggs: lid ? 0 : r.int(2, 3), egg: r.range(0.27, 0.32), lid: lid ? 1 : 0, tilt: k * r.range(0.05, 0.3), bulb: 0.75, seat: 1.0 });
    const n = r.wpick([[2.5, 1], [2.5, 2], [1, 3]]), s = r.range(9.5, 11), stems = [], mi = Math.floor(n / 2);
    let x = 0;
    for (let i = 0; i < n; i++) { const k = i === mi ? 1 : r.range(0.62, 0.85), sd = Math.sign(i - mi); stems.push(st(x, 0, 3, { s: s * k, head: cup(i !== mi && r.chance(0.25), sd) })); x += s * r.range(2.05, 2.35) * (i === mi || i + 1 === mi ? 1 : 0.85); }
    const xm = x / 2 - s * 1.1; for (const q of stems) q.x -= xm;
    const m = stems[mi]; stems.splice(mi, 1); stems.unshift(m);
    const onTwig = r.chance(0.6), x0 = -xm - s * 1.4, x1 = x - xm - s * 0.6;
    return stemsSp(r, stems, { body: { x: m.x, cy: s * 1.6, rx: s * 1.3, ry: s * 1.1 }, R: 5, stem: 0.25, sub: onTwig ? { kind: 'twig', r: r.range(1.6, 2.1), x0, x1, bow: r.range(-0.15, 0.2), fork: r.chance(0.4) ? r.range(0.05, 0.15) : 0, fd: -1 } : { kind: 'mound', x: (x0 + x1) / 2, w: (x1 - x0) * 0.5, h: 3.2 } });
  } },
  { name: 'scarlet elf cup', w: 1.8, genes: r => {
    const cup = k => ({ form: 'vase', span: 1.8, w: r.range(1.45, 1.8), h: r.range(1.7, 2.1), w0: 0.3, flare: r.range(0.45, 0.65), thick: r.range(0.3, 0.36), depth: r.range(0.5, 0.6), incurve: r.range(0, 0.1), stalk: r.range(0.35, 0.9), stalkW: 0.24, tilt: k * r.range(0.05, 0.4), asym: r.range(-0.08, 0.08), bulb: 0.75, seat: 0.9 });
    const n = r.wpick([[3, 1], [3, 2], [1, 3]]), s = r.range(8.5, 10), stems = []; let x = 0;
    for (let i = 0; i < n; i++) { const k = i === 0 ? 1 : r.range(0.55, 0.8); stems.push(st(x, 0, 3, { s: s * k, head: cup(i === 0 ? r.range(-0.6, 0.6) : 1) })); x += s * r.range(2.9, 3.4) * (i === 0 ? 1 : 0.75); }
    const xm = x / 2 - s * 1.5; for (const q of stems) q.x -= xm;
    return stemsSp(r, stems, { body: { x: stems[0].x, cy: s * 1.5, rx: s * 1.8, ry: s * 1 }, R: 5, stem: 0.3, sub: { kind: 'twig', r: r.range(1.8, 2.3), x0: -xm - s * 2.2, x1: x - xm - s * 1.6, bow: r.range(-0.25, 0.25), fork: r.chance(0.6) ? r.range(0.7, 0.9) : 0, fd: 1 } });
  } },
  { name: 'orange peel fungus', w: 1.2, genes: r => {
    const cup = k => ({ form: 'vase', span: 2, w: r.range(1.5, 1.9), h: r.range(1.8, 2.3), w0: r.range(0.5, 0.7), flare: r.range(0.35, 0.5), thick: r.range(0.4, 0.46), depth: r.range(0.45, 0.55), wavy: r.range(0.1, 0.18), asym: r.range(-0.25, 0.25), tilt: k * r.range(0.1, 0.45), bulb: 0.75, seat: 0.9 });
    const n = r.wpick([[1.5, 1], [3, 2], [1.5, 3]]), s = r.range(8.5, 10), stems = []; let x = 0;
    for (let i = 0; i < n; i++) { const k = i === 0 ? 1 : r.range(0.55, 0.85); stems.push(st(x, 0, 3, { s: s * k, head: cup(i === 0 ? r.range(-0.5, 0.5) : r.sign()) })); x += s * r.range(2.4, 2.9) * (i === 0 ? 1 : 0.8); }
    for (const q of stems) q.x -= x / 2 - s * 1.2;
    return stemsSp(r, stems, { body: { x: stems[0].x, cy: s * 1, rx: s * 2, ry: s * 0.9 }, R: 5, stem: 0.2, sub: { grass: r.chance(0.5) ? [[r.range(-12, 12), 3, 7]] : null } });
  } },
  { name: 'pixie cup lichen', w: 1.8, genes: r => {
    const cup = () => ({ form: 'vase', span: 1.1, w: r.range(0.95, 1.2), h: r.range(2.4, 3.2), w0: 0.28, bowl: r.range(0.5, 0.62), thick: r.range(0.36, 0.44), depth: r.range(0.22, 0.3), lip: 0.04, tilt: r.range(-0.1, 0.1), bulb: 0.75, seat: 1.0 });
    const stems = troop(r, r.int(3, 5), { h: r.range(3, 7), gap: 10, r: 2.0, lean: 0.12, sway: 0.03, s: r.range(6, 7.2), head: cup, flare: 1.3, each: () => ({ taper: 1.0 }) });
    return stemsSp(r, stems, { R: 5, stem: r.range(1, 1.8), stemW: 0.13, sub: { kind: 'mound', x: 0, w: stems.length * 6 + 6, h: 3.4 } });
  } },

  // ---------------- corals, clubs, tongues ----------------
  { name: 'coral fungus', w: 2.6, genes: r => {
    const s = r.range(8, 9.5), co = { form: 'coral', span: 2.4, n: 3, len: r.range(1.8, 2.2), wid: r.range(0.36, 0.44), depth: 3, tri: 0.08, ragged: 0.25, spread: r.range(0.75, 1.05), fan: r.range(1.0, 1.4), shrink: 0.78, keep: 0.8, tips: r.wpick([[2, 'round'], [1, 'knob']]), bulb: 0.85, seat: 0.9, lend: 0.62 };
    const stems = [st(0, r.range(4, 7), s * 0.8, { flare: 1.15, taper: 1.0, s, head: co })];
    return stemsSp(r, stems, { body: { x: 0, cy: s * 2.2, rx: s * 2.1, ry: s * 2.2, hy: 0.45 }, R: 6, small: { ...co, n: 1, depth: 2, len: 1.5, span: 1.5, wid: 0.3 }, stem: 0.1, pair: true, cn: 1 });
  } },
  { name: 'stag\'s horn', w: 2, genes: r => {
    const an = () => ({ form: 'coral', span: 1.6, n: 1, len: r.range(2.0, 2.8), wid: r.range(0.26, 0.34), depth: r.int(1, 2), spread: r.range(0.7, 1.1), fan: 0, shrink: 0.7, keep: 0.95, tips: 'point', tri: 0.25, ragged: 0, upPull: 0.35, bulb: 0.85, seat: 0.9, lend: 0.8 });
    const n = r.int(2, 5), s = r.range(7.5, 9), stems = [];
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) * 2 - 1 : 0; stems.push(st(u * n * 3.2 + r.range(-1, 1), 0, 3, { lean: u * 0.3 + r.range(-0.15, 0.15), s: s * r.range(0.6, 1), head: an() })); }
    stems.sort((a, b) => b.s - a.s);
    const half = n * 3.2 + 12;
    return stemsSp(r, stems, { body: { x: 0, cy: s * 1.4, rx: s * 1.4, ry: s * 1.6, hy: 0.5 }, R: 5, stem: 0.1, pair: true, cn: 1, sub: { kind: 'twig', r: r.range(2, 2.6), x0: -half, x1: half, bow: r.range(-0.2, 0.2), fork: 0 } });
  } },
  { name: 'fairy clubs', w: 1.8, genes: r => {
    const s = r.range(8, 9.5), cl = { form: 'clubs', span: 1.6, kind: r.wpick([[1, 'spindle'], [2, 'club']]), n: r.int(5, 8), len: r.range(3.6, 4.8), wid: r.range(0.24, 0.3), spread: r.range(0.7, 1.1), gap: r.range(0.5, 0.7), drop: 0.4, wave: 0.09, bulb: 0.85, seat: 0.8, lend: 0.6 };
    const stems = [st(0, 0, 4, { s, head: cl })];
    return stemsSp(r, stems, { body: { x: 0, cy: s * 1.6, rx: s * 1.6, ry: s * 1.6, hy: 0.5 }, R: 5.5, small: { ...cl, n: 3, len: 2.6, span: 1.3 }, stem: 0.05, sub: { grass: r.chance(0.5) ? [[r.sign() * r.range(16, 22), 3, 8]] : null } });
  } },
  { name: 'earth tongue', w: 1.5, genes: r => {
    const tg = () => ({ form: 'clubs', span: 0.6, kind: 'tongue', n: 1, len: 1, wid: r.range(0.42, 0.56), wave: r.range(0.08, 0.2), bulb: 0.85, seat: 0.8, lend: 3 });
    const n = r.int(2, 4), stems = []; let x = 0;
    for (let i = 0; i < n; i++) { stems.push(st(x, 0, 3, { lean: r.range(-0.22, 0.22), s: r.range(28, 46) * (i === 0 ? 1.1 : 0.8), head: { ...tg() } })); x += r.range(9, 14); }
    for (const q of stems) { q.x -= x / 2 - 5; q.head.wid *= 8 / q.s * 1.0; q.head.len = 1; }
    stems.sort((a, b) => b.s - a.s);
    const small = { form: 'clubs', span: 0.5, kind: 'tongue', n: 1, len: 3, wid: 0.44, wave: 0.12 };
    return stemsSp(r, stems, { body: { x: stems[0].x, cy: 14, rx: 5, ry: 14, hy: 0.4 }, R: 4.5, fb: { ...small, bulb: 0.85, seat: 0.8, lend: 0.9 }, small, stem: 0.05, hw: 0.3, tipS: 0.5, sub: { grass: [[r.range(-20, -12), 3, 9], [r.range(12, 20), 2, 8]] } });
  } },
  { name: 'dead man\'s fingers', w: 1.6, genes: r => {
    const s = r.range(8, 9.5), fg = { form: 'clubs', span: 1.5, kind: 'finger', n: r.int(3, 5), len: r.range(3.3, 4.4), wid: r.range(0.5, 0.64), spread: r.range(0.7, 1.2), gap: 0.85, drop: 0.35, wave: 0.14, bulb: 0.85, seat: 0.7, lend: 0.6 };
    const stems = [st(0, 0, 4, { s, lean: r.range(-0.12, 0.12), head: fg })];
    return stemsSp(r, stems, { body: { x: 0, cy: s * 1.5, rx: s * 1.6, ry: s * 1.5, hy: 0.5 }, R: 6, small: { ...fg, n: 2, len: 2.2, span: 1.1 }, stem: 0.05, sub: { kind: 'mound', x: 0, w: s * 2.1, h: 4.5 } });
  } },
  { name: 'reindeer lichen', w: 1.2, genes: r => {
    const s = r.range(8, 9), co = { form: 'coral', span: 2.4, n: 3, len: r.range(1.5, 1.8), wid: 0.24, depth: r.wpick([[1, 3], [1, 4]]), spread: r.range(0.9, 1.2), fan: r.range(1.1, 1.5), shrink: 0.8, keep: 0.86, tips: 'round', tri: 0.1, ragged: 0.4, upPull: 0.2, kink: 1.6, bulb: 0.85, seat: 0.8, lend: 0.55 };
    const stems = [st(0, 0, 4, { s, head: co })];
    return stemsSp(r, stems, { body: { x: 0, cy: s * 1.7, rx: s * 2.4, ry: s * 1.8, hy: 0.4 }, R: 6, small: { ...co, n: 2, depth: 2, span: 1.6 }, stem: 0.05, cn: 1 });
  } },

  // ---------------- massed forms ----------------
  { name: 'hen of the woods', w: 1.6, genes: r => {
    const s = r.range(9, 10.5), fr = { form: 'fronds', span: 2.6, w: r.range(2.6, 3.3), h: r.range(3.0, 3.8), n: r.int(8, 12), thick: r.range(0.22, 0.28), bulb: 0.85, seat: 0.7, lend: 0.5 };
    const stems = [st(0, 0, 5, { s, head: fr })];
    return stemsSp(r, stems, { body: { x: 0, cy: s * 1.6, rx: s * 2.4, ry: s * 1.7, hy: 0.5 }, R: 7, stem: 0.05, dorsal: { type: 'fungusFrill', h: r.range(0.9, 1.3), wid: 0.2, tiers: 2 } });
  } },

  // ---------------- on wood ----------------
  { name: 'turkey tail', w: 2.4, genes: r => {
    const ch = stub(r), groups = r.int(2, 4); let sd = r.sign();
    ch.shelves = [];
    for (let g = 0; g < groups; g++) {
      const t0 = mix(0.12, 0.7, (g + r.range(0.15, 0.85)) / groups), m = r.int(2, 4), L = r.range(15, 20);
      for (let j = 0; j < m; j++) ch.shelves.push({ t: t0 + j * r.range(0.09, 0.12), sd, len: L * (1 - j * 0.16) * r.range(0.9, 1.1), th: r.range(4.2, 5), up: 0.45, down: 0.4, k: 1.8, wavy: r.range(0.3, 0.55), droop: r.range(0.04, 0.14), rim: 0.3 });
      sd = r.chance(0.7) ? -sd : sd;
    }
    return build(r, ch, { ...CAP.fan(r), seat: 1.1 }, { stem: 0.02, rake: 0.6, dorsal: r.chance(0.5) ? { type: 'fungusFrill', h: r.range(0.8, 1.2), wid: 0.16, tiers: r.int(1, 2) } : null });
  } },
  { name: 'chicken of the woods', w: 1.8, genes: r => {
    // a rosette of thick scalloped fans rising from the top of a fallen log
    // back tier: 2-3 tall fans standing up off the log; front tier: 2 lower fans splayed outward,
    // drawn over the back ones with a pale gap so the rosette reads as overlapping fans
    const L = r.range(28, 34), rr = r.range(4.6, 5.3), c0 = r.range(0.42, 0.58), nb = r.int(2, 3);
    const ch = { form: 'wood', kind: 'log', round: true, len: L, rr, bow: r.range(-0.05, 0.08), snag: r.chance(0.25) ? r.range(0.12, 0.2) : 0, sd: -1, R: rr, items: [], shelves: [] };
    for (let i = 0; i < nb; i++) {
      const u = nb > 1 ? i / (nb - 1) * 2 - 1 : 0, sd = u < 0 ? -1 : u > 0 ? 1 : r.sign();
      ch.shelves.push({ t: c0 + u * 0.08, dip: 0.9, sd, len: r.range(17, 21) * (1 - 0.12 * Math.abs(u)), w0: 2, w1: r.range(6.2, 7.2), up: 1, dn: 0.6, rise: mix(1.45, 1.05, Math.abs(u)) + r.range(-0.1, 0.1), bend: r.range(0.2, 0.45), scallop: r.range(0.12, 0.2), sf: r.int(2, 4), full: 0.9 });
    }
    for (const sd of [-1, 1]) if (r.chance(0.85)) ch.shelves.push({ front: true, t: c0 + sd * r.range(0.1, 0.16), dip: 0.95, sd, len: r.range(14, 18), w0: 1.8, w1: r.range(5.2, 6.2), up: 1, dn: 0.6, rise: r.range(0.45, 0.75), bend: r.range(0.2, 0.4), scallop: r.range(0.12, 0.2), sf: r.int(2, 4), full: 0.9 });
    return build(r, ch, { ...CAP.fan(r), thick: 0.34, rim: 0.2, seat: 1.1 }, { stem: 0.02, rake: 0.6, dorsal: { type: 'fungusFrill', h: r.range(1, 1.5), wid: 0.24, tiers: 2 } });
  } },
  { name: 'oyster mushroom', w: 2, genes: r => {
    // overlapping drooping tongues spraying from the cut end of a log, upper ones longest
    // a thick log with a rounded sawn end; 2-3 separate drooping shelves stacked up the cut face,
    // each lower one drawn in front of the one above with a pale gap between them
    const L = r.range(25, 30), rr = r.range(4.6, 5.2), n = r.wpick([[3, 2], [1, 3]]), gap = r.range(11, 12.5);
    const ch = { form: 'wood', kind: 'log', round: true, len: L, rr, bow: r.range(-0.05, 0.08), snag: r.chance(0.3) ? r.range(0.12, 0.3) : 0, sd: -1, R: rr, items: [], shelves: [] };
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0; // 0 = top shelf
      ch.shelves.push({ cap: true, t: 1, dx: -rr * 0.5, dy: -(n - 1 - i) * gap, dip: 0.95, sd: 1, len: r.range(16, 19) * (1 - 0.2 * k), th: r.range(7.2, 8.2) * (1 - 0.15 * k), droop: r.range(0.16, 0.26) });
    }
    if (n > 1) ch.column = [rr * 0.45, 0, (n - 1) * gap + 1, 2.4];
    const oyc = { form: 'cap', span: 2, w: r.range(1.7, 2.2), h: r.range(0.5, 0.7), a: 2.6, b: 0.5, under: 0.3, rim: 0.12, curl: r.range(-0.25, 0.1), skew: 0, thick: 0.2, wavy: r.range(0, 0.2) };
    return build(r, ch, { ...oyc, seat: 1.1 }, { stem: 0.3, rake: 0.4 });
  } },
  { name: 'lion\'s mane', w: 1.8, genes: r => {
    // a rounded cascade of fine hanging spines off the side of a slim snag, clear of the ground
    const ch = stub(r, { w: r.range(1.8, 2.2), h: r.range(36, 42), flare: 0.35, roots: false, snag: 0, teeth: r.int(2, 3), lean: r.range(-0.06, 0.06) }), sd = r.sign(), s = r.range(7.5, 8.5);
    const mn = { form: 'mane', span: 2, w: r.range(1.5, 1.8), h: r.range(1.7, 2.0), teeth: r.int(26, 34), tl: r.range(1.5, 1.9), bulb: 0, lend: 0.72 };
    ch.items = [{ t: r.range(0.78, 0.86), sd, ax: -0.05, stem: 0, turn: 0, s, fb: mn }];
    if (r.chance(0.4)) ch.items.push({ t: r.range(0.42, 0.5), sd: -sd, ax: -0.05, stem: 0, s: s * 0.5, fb: { ...mn, teeth: 14 } });
    return build(r, ch, mn, { stem: 0.02, hw: 0.7 });
  } },
  { name: 'jelly ear', w: 2.2, genes: r => {
    // rubbery ears on a fallen branch, cupped and veined, turned every which way
    // one or two big upright ears leaning apart on a stick (plus at most one small one), never touching
    const L = r.range(30, 36), rr = r.range(2.4, 2.9), big = r.sign();
    const ear = (k) => ({ form: 'jear', span: 1.2, h: r.range(1.9, 2.2) * k, w: r.range(1.3, 1.5) * k, notch: r.range(0.18, 0.24), bulb: 0.5, seat: 0.8, lend: 0.85 });
    const ch = { form: 'wood', kind: 'log', len: L, rr, bow: r.range(-0.05, 0.12), snag: r.chance(0.35) ? r.range(0.12, 0.25) : 0, sd: -1, R: rr, items: [] };
    for (const sd of [-1, 1]) ch.items.push({ t: 0.5 + sd * r.range(0.2, 0.26), ax: sd * r.range(0.4, 0.6), dip: 0.9, s: r.range(9, 10.5) * (sd === big ? 1 : r.range(0.72, 0.88)), fb: { ...ear(1), side: sd } });
    return build(r, ch, ear(1), { stem: 0.02 });
  } },
  { name: 'hare\'s ear', w: 1.8, genes: r => {
    // Otidea: tall ears standing from the leaf litter, split down one side, in a small clump
    // 2-4 tall narrow slit cups of clearly different heights, leaning apart from one base
    const n = r.wpick([[4, 2], [2, 3]]), s = r.range(12, 14);
    const ear = (side) => ({ form: 'hare', span: 0.8, side, h: r.range(2.3, 2.6), w: r.range(0.58, 0.68), flap: r.range(0.72, 0.82), slit: r.range(0.58, 0.66), bulb: 0.5, seat: 0.8, lend: 0.85 });
    const hs = [1, 0.66, 0.46].slice(0, n).map(k => k * r.range(0.92, 1.05)), order = r.shuffle ? r.shuffle([...Array(n).keys()]) : [...Array(n).keys()];
    const stems = [];
    for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, sd = u < 0 ? -1 : u > 0 ? 1 : r.sign(); stems.push(st(u * s * (n > 2 ? 0.3 : 0.2) + r.range(-0.4, 0.4), 0, 2, { lean: u * r.range(0.4, 0.55) + r.range(-0.06, 0.06), s: s * hs[order[i]], head: ear(-sd) })); }
    stems.sort((a, b) => b.s - a.s);
    return stemsSp(r, stems, { R: 6, stem: 0.05, sub: { grass: r.chance(0.5) ? [[r.range(-18, -12), 2, 8]] : null } });
  } },
  { name: 'witch\'s butter', w: 1.5, genes: r => {
    const L = r.range(28, 36), rr = r.range(2.6, 3.3), n = r.int(1, 3);
    const jl = () => ({ form: 'jelly', span: 1.6, w: r.range(1.3, 1.7), h: r.range(2.2, 2.8), n: r.int(3, 5), fat: r.range(0.2, 0.25), fan: r.range(0.75, 1.05), bulb: 0.6, seat: 0.9, lend: 0.75 });
    const ch = { form: 'wood', kind: 'log', len: L, rr, bow: r.range(-0.05, 0.12), snag: r.chance(0.6) ? r.range(0.12, 0.3) : 0, sd: -1, R: rr, items: [] };
    for (let i = 0; i < n; i++) ch.items.push({ t: mix(0.25, 0.8, n > 1 ? i / (n - 1) : r.range(0.35, 0.65)) + r.range(-0.05, 0.05), ax: r.range(-0.35, 0.35), dip: 1.05, s: r.range(7, 9) * (n > 1 && i % 2 === 0 ? r.range(0.55, 0.75) : 1), fb: jl() });
    return build(r, ch, jl(), { stem: 0.02 });
  } },
  { name: 'cordyceps', w: 1.8, genes: r => {
    const n = r.wpick([[2, 1], [2, 2], [1, 3]]), clubs = [];
    const cb = (len) => ({ form: 'clubs', span: 0.5, kind: r.wpick([[2, 'pin'], [1, 'club']]), n: 1, len, wid: r.range(1.7, 2.3), wave: r.range(0.1, 0.22) });
    for (let i = 0; i < n; i++) clubs.push({ t: mix(0.82, 0.45, n > 1 ? i / (n - 1) : 0) + r.range(-0.05, 0.05), lean: r.range(-0.35, 0.3), fb: cb(r.range(34, 46) * (i === 0 ? 1 : r.range(0.5, 0.8))) });
    const ch = { form: 'cordy', len: r.range(30, 38), rr: r.range(4.8, 5.8), segs: r.int(7, 9), hump: r.range(0, 0.35), rear: r.range(0, 0.25), feet: true, clubs, R: 5 };
    const small = { form: 'clubs', span: 0.5, kind: 'pin', n: 1, len: 3.4, wid: 0.34, wave: 0.15 };
    return build(r, ch, { ...small, n: 2, spread: 0.8, gap: 0.5, bulb: 0.9, seat: 0.8, lend: 1 }, { small, stem: 0.05, hw: 0.3, tipS: 0.45, pair: true, cn: 1 });
  } },
];

export default {
  id: 'fungus', label: 'Fungi', short: 'Fungi',
  sig: { head: 3, dorsal: 2.5, crown: 2, tail: 1.2 },
  species,
};
