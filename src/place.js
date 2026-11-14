// Border geometry -> critter placements. Pure functions, no DOM.
// A border is { kind, pts (page coords, y down, PDF points), closed, settings }.
// Output: list of placed critters, each with outline rings already in page coords.
import { makeRng, hashStr } from './gen/core.js';
import { makeCritter } from './gen/critter.js';

export const DEFAULTS = {
  tags: ['salamander'],
  side: 'left',        // 'left' | 'right' | 'both' (relative to drawing direction)
  radius: 40,          // band depth out from the line, PDF points
  spacing: 72,         // distance between critters along the line, points
  size: 40,            // nominal critter size, points
  sizeVar: 0.2,        // random size variation (fraction)
  spacingVar: 0.2,     // random spacing variation (fraction)
  facing: 'forward',   // 'forward' | 'backward' | 'random'
  lift: 0,             // random float off the line, as a fraction of spare band depth
  tilt: 0,             // random rotation, radians
  detail: 0.3,         // white interior detail 0..1
  chaos: 0.12,         // how wild tag mixes get 0..1
  plump: 1,
  seed: 1,
  startOffset: 0.5,    // first critter position, fraction of spacing
  avoidOverlap: true,
};

// ---- path helpers ----
export function simplify(pts, tol) { // Ramer-Douglas-Peucker
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function smooth(pts, closed, iters = 2) { // Chaikin corner cutting
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const q = [], n = p.length;
    if (!closed) q.push(p[0]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = p[i], b = p[(i + 1) % n];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) q.push(p[n - 1]);
    p = q;
  }
  return p;
}

function densify(pts, closed, step) {
  const out = [], n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

// Turn a border description into a dense polyline to walk along.
export function borderPolyline(border) {
  const { kind, pts } = border;
  if (kind === 'rect') {
    const [[x0, y0], [x1, y1]] = pts, a = Math.min(x0, x1), b = Math.min(y0, y1), c = Math.max(x0, x1), d = Math.max(y0, y1);
    return { pts: densify([[a, b], [c, b], [c, d], [a, d]], true, 6), closed: true };
  }
  if (kind === 'ellipse') {
    const [[x0, y0], [x1, y1]] = pts, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2, out = [];
    const n = Math.max(48, Math.round((rx + ry) / 4));
    for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI; out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
    return { pts: out, closed: true };
  }
  if (kind === 'line') return { pts: densify(pts, false, 6), closed: false };
  // freehand
  const closed = !!border.closed;
  let s = simplify(pts, 1.2);
  if (closed) { // wind clockwise on screen so that "left" always means outside
    let area = 0; for (let i = 0; i < s.length; i++) { const a = s[i], b = s[(i + 1) % s.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) s = s.reverse();
  }
  return { pts: s.length > 2 ? smooth(s, closed, 3) : s, closed };
}

export function measure(poly) {
  const { pts, closed } = poly, n = pts.length, cum = [0];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  return { cum, length: cum[m] };
}

// Point at arc length d along the polyline.
export function pointAt(poly, meas, d) {
  const { pts, closed } = poly, { cum, length } = meas, n = pts.length;
  if (closed) d = ((d % length) + length) % length; else d = Math.max(0, Math.min(length, d));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  const a = pts[lo % n], b = pts[(lo + 1) % n], u = (d - cum[lo]) / ((cum[lo + 1] - cum[lo]) || 1);
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

// Where a critter of half-width hw rests on the line at arc length s: it stands on the
// chord under its feet, pushed outward just enough that no part of the line bulges
// through its baseline. So critters never dip below the line, even on wiggles and corners.
export function restAt(poly, meas, s, hw, sideSign) {
  hw = Math.max(hw, 1);
  let A = pointAt(poly, meas, s - hw), B = pointAt(poly, meas, s + hw);
  if (Math.hypot(B[0] - A[0], B[1] - A[1]) < 1e-6) { A = pointAt(poly, meas, s - 1); B = pointAt(poly, meas, s + 1); }
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  const nx = Math.sin(ang) * sideSign, ny = -Math.cos(ang) * sideSign;
  const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  let bulge = 0;
  for (let k = 1; k < 12; k++) {
    const q = pointAt(poly, meas, s - hw + 2 * hw * k / 12);
    bulge = Math.max(bulge, (q[0] - mid[0]) * nx + (q[1] - mid[1]) * ny);
  }
  return { p: [mid[0] + nx * bulge, mid[1] + ny * bulge], ang };
}

// ---- oriented-box overlap (separating axis) ----
function boxCorners(c) { return c.box; }
function overlap(A, B) {
  for (const poly of [A, B]) for (let i = 0; i < 4; i++) {
    const p = poly[i], q = poly[(i + 1) % 4], nx = q[1] - p[1], ny = p[0] - q[0];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of A) { const d = v[0] * nx + v[1] * ny; if (d < a0) a0 = d; if (d > a1) a1 = d; }
    for (const v of B) { const d = v[0] * nx + v[1] * ny; if (d < b0) b0 = d; if (d > b1) b1 = d; }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}

export const stats = { made: 0 }; // generator calls (for tests)
const critterCache = new Map();
// Interactive callers may set a deadline (performance.now() ms); a placement that would
// generate a critter past it throws DEFER. Critters made so far stay cached, so calling again
// continues where it stopped. placeBorder has no other side effects.
export const DEFER = Symbol('placement deferred');
let deadline = 0;
export function placeWithin(border, pageKey, ms) {
  deadline = performance.now() + ms;
  try { return placeBorder(border, pageKey); } finally { deadline = 0; }
}
// Layout memo per border (keyed by content and page key): sliders that do not touch a border cost it nothing.
const placeMemo = new Map();
export function placeInteractive(border, pageKey, ms) { // -> { items, stale }
  const key = JSON.stringify([border.kind, border.pts, border.closed, border.settings, border.overrides, pageKey]);
  const m = placeMemo.get(border.id);
  if (m && m.key === key && m.pageKey === pageKey) return { items: m.items, stale: false, memo: m };
  try {
    const items = m ? placeWithin(border, pageKey, ms) : placeBorder(border, pageKey);
    const memo = { key, pageKey, items }; if (border.id != null) placeMemo.set(border.id, memo);
    return { items, stale: false, memo };
  } catch (e) { if (e === DEFER && m) return { items: m.items, stale: true, memo: m }; throw e; }
}
function cachedCritter(tags, seed, st) {
  const key = tags.join('+') + '|' + seed + '|' + st.detail + '|' + st.chaos + '|' + st.plump;
  let c = critterCache.get(key);
  if (!c) {
    if (deadline && performance.now() > deadline) throw DEFER;
    stats.made++;
    c = makeCritter(tags, seed, { detail: st.detail, chaos: st.chaos, plump: st.plump });
    if (critterCache.size > 4000) critterCache.clear();
    critterCache.set(key, c);
  }
  return c;
}

const speciesKey = c => String(c.species?.[c.donors?.primary ?? c.donors?.chassis] ?? Object.values(c.species || {})[0] ?? '');
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

// Does a critter of width w centred at arc length s sit cleanly on the line? Rejects sharp
// corners under its feet and line that rises into the body (inside of a tight bend).
function fitsLine(poly, meas, s, w, sideSign) {
  const ends = [pointAt(poly, meas, s - w / 2), pointAt(poly, meas, s), pointAt(poly, meas, s + w / 2)];
  const d1 = Math.atan2(ends[1][1] - ends[0][1], ends[1][0] - ends[0][0]), d2 = Math.atan2(ends[2][1] - ends[1][1], ends[2][0] - ends[1][0]);
  if (angDiff(d1, d2) > 0.75) return false;
  const { p, ang } = restAt(poly, meas, s, w * 0.42, sideSign);
  const nx = Math.sin(ang) * sideSign, ny = -Math.cos(ang) * sideSign;
  for (let k = 0; k <= 12; k++) {
    const q = pointAt(poly, meas, s - w / 2 + w * k / 12);
    if ((q[0] - p[0]) * nx + (q[1] - p[1]) * ny > Math.max(1.5, 0.12 * w)) return false;
  }
  return true;
}

// Place critters along one border. `overrides` maps slot index -> { seed } | { skip:true }.
// pageKey varies the result between pages when the border repeats.
// Layout is computed from each slot's "natural" critter (never from overrides), so rerolling
// or removing one critter leaves every other critter where it was.
export function placeBorder(border, pageKey = 0) {
  const st = { ...DEFAULTS, ...border.settings };
  if (!st.tags.length) return [];
  const poly = borderPolyline(border);
  if (poly.pts.length < 2) return [];
  const meas = measure(poly);
  if (meas.length < 4) return [];
  const L = meas.length, closed = poly.closed;
  const overrides = border.overrides || {};
  const out = [];
  const sides = st.side === 'both' ? [1, -1] : [st.side === 'right' ? -1 : 1];
  const gapBase = Math.max(st.spacing - st.size, st.spacing * 0.15), pitch = st.size + gapBase;
  const arcDist = (a, b) => { const d = Math.abs(a - b); return closed ? Math.min(d, L - d) : d; };
  let rows = [];
  const scaleOf = (c, sizeK) => {
    const b = c.bbox;
    let sc = st.size * sizeK / Math.max(b.w, b.h * 1.25, 1);
    const tall = -b.y0;
    if (tall * sc > st.radius) sc = st.radius / tall;
    return sc;
  };
  for (const sideSign of sides) {
    const rng = makeRng(hashStr(`${st.seed}|${pageKey}|${sideSign}`));
    const opp = rows.find(r => r.sideSign === -sideSign)?.slots ?? [];
    // geometry of critter c (scale sc) resting at arc length s: transform + oriented footprint box
    const frame = (n, c, sc, s) => {
      const b = c.bbox, tall = -b.y0; // height above the line
      const { p, ang } = restAt(poly, meas, s, b.w * sc * 0.42, sideSign);
      // Critter space: x along facing, y down with ground at 0, body in -y.
      const back = st.facing === 'backward' || (st.facing === 'random' && n.faceR < 0.5);
      const fx = back ? -1 : 1;
      const lift = st.lift * n.liftR * Math.max(st.radius - tall * sc, 0);
      const rot = ang + st.tilt * n.tiltR;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      const tf = ([x, y]) => {
        const lx = x * sc * fx, ly = (y * sc - lift) * sideSign;
        return [p[0] + lx * ca - ly * sa, p[1] + lx * sa + ly * ca];
      };
      const box = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, Math.min(b.y1, 0)], [b.x0, Math.min(b.y1, 0)]].map(tf);
      return { p, tf, box };
    };
    const streams = []; // per-slot random streams (slot-stable), created in order
    const stream = i => { while (streams.length <= i) streams.push(rng.fork()); return streams[i]; };
    const nat = []; // natural pick per slot
    let exhausted = 0;
    const candidate = (i, attempt) => {
      const r = stream(i);
      if (attempt === 0) {
        const jit = r(), seed = Math.floor(r() * 2 ** 31), sizeK = 1 + (r() * 2 - 1) * st.sizeVar;
        const faceR = r(), liftR = r(), tiltR = r() * 2 - 1;
        const c = cachedCritter(st.tags, seed, st);
        return { c, seed, sizeK, faceR, liftR, tiltR, jit, w: c.bbox.w * scaleOf(c, sizeK), key: speciesKey(c) };
      }
      const ra = makeRng(hashStr(`${st.seed}|${pageKey}|${sideSign}|${i}|alt${attempt}`));
      const base = nat[i] ?? candidate(i, 0);
      const seed = Math.floor(ra() * 2 ** 31), c = cachedCritter(st.tags, seed, st);
      return { ...base, c, seed, w: c.bbox.w * scaleOf(c, base.sizeK), key: speciesKey(c) };
    };
    const pick = (i, prevKey, centreOf) => {
      const tries = exhausted >= 2 ? 1 : 5;
      let cand = null;
      for (let a = 0; a < tries; a++) {
        cand = a === 0 && nat[i] ? nat[i] : candidate(i, a);
        const s = centreOf(cand);
        const clash = cand.key === prevKey || opp.some(o => o.key === cand.key && arcDist(o.s, s) < (o.w + cand.w) / 2 + 2);
        if (!clash) { nat[i] = cand; return cand; }
      }
      exhausted++;
      nat[i] = candidate(i, 0);
      return nat[i];
    };
    const startEdge = st.startOffset * gapBase + (sideSign < 0 && st.side === 'both' ? pitch * 0.5 : 0);
    const run = extra => {
      const slots = []; let edge = startEdge, prevKey = null, used = 0;
      for (let i = 0; i < 400; i++) {
        const cand = pick(i, prevKey, c => edge + c.w / 2);
        const w = cand.w;
        let s = edge + w / 2;
        // stagger: stay clear of the opposite row's centres
        for (let sweep = 0; sweep < 2; sweep++) for (const o of opp) {
          const d = 0.3 * (w + o.w) / 2;
          if (s >= o.s - d && s < o.s + d) s = o.s + d;
        }
        // slide forward off sharp corners and bends
        let ok = fitsLine(poly, meas, s, w, sideSign);
        for (let k = 1; !ok && k <= 12; k++) { ok = fitsLine(poly, meas, s + w * k / 4, w, sideSign); if (ok) s += w * k / 4; }
        const gap = (gapBase + extra) * (1 + (cand.jit * 2 - 1) * st.spacingVar * 0.5);
        if (closed ? (slots.length && s + w / 2 + gap * 0.5 > slots[0].s - slots[0].w / 2 + L) || s + w / 2 > startEdge + L : s - w / 2 > L) break;
        const fr = ok && frame(cand, cand.c, scaleOf(cand.c, cand.sizeK), s);
        // a footprint that collides with a neighbour (round a bend) is skipped, not shoved
        if (ok && st.avoidOverlap && (slots.some(o => overlap(o.box, fr.box)) || opp.some(o => overlap(o.box, fr.box)))) ok = false;
        if (!ok) { edge += w + gap; continue; }
        slots.push({ i, s, w, key: cand.key, cand, gap, box: fr.box });
        edge = s + w / 2 + gap; prevKey = cand.key;
        used = edge;
      }
      return { slots, used, n: slots.length };
    };
    let res = run(0);
    if (closed && res.n > 1) {
      const leftover = startEdge + L - res.used;
      if (leftover > 0) res = run(leftover / res.n * 0.95);
      // seam: last neighbour must differ from the first
      const l = res.slots[res.slots.length - 1], f = res.slots[0];
      if (res.n > 1 && l.key === f.key) {
        for (let a = 1; a < 6; a++) { const c2 = candidate(l.i, a); if (c2.key !== f.key && c2.key !== res.slots[res.slots.length - 2]?.key && c2.w <= l.w * 1.05) { l.cand = { ...l.cand, ...c2 }; l.key = c2.key; break; } }
        if (l.key === f.key) res.slots.pop();
      }
    }
    rows.push({ sideSign, slots: res.slots });
    // ---- emit ----
    const placed = [];
    for (const sl of res.slots) {
      const { i, s, cand: n } = sl;
      const slot = `${sideSign}:${i}`;
      const ov = overrides[`${pageKey}|${slot}`] || overrides[slot];
      if (ov?.skip) continue;
      let c = n.c, seed = n.seed, sc = scaleOf(c, n.sizeK);
      if (ov?.seed != null) {
        c = cachedCritter(st.tags, ov.seed, st); seed = ov.seed;
        sc = scaleOf(c, n.sizeK);
        const cell = sl.w + sl.gap * 0.6; // an overridden critter keeps its neighbours in place
        if (c.bbox.w * sc > cell) sc = cell / c.bbox.w;
      }
      const { p, tf, box } = frame(n, c, sc, s);
      const rings = c.rings.map(ring => ring.map(tf));
      placed.push({ rings, box, slot, seed, sideSign, at: p, critter: c, s, w: c.bbox.w * sc, key: speciesKey(c) });
    }
    out.push(...placed);
  }
  return out;
}

// Outline of the band (for on-screen preview only).
export function bandOutline(border) {
  const st = { ...DEFAULTS, ...border.settings };
  const poly = borderPolyline(border);
  if (poly.pts.length < 2) return [];
  const sides = st.side === 'both' ? [1, -1] : [st.side === 'right' ? -1 : 1];
  const { pts, closed } = poly, n = pts.length;
  return sides.map(sg => {
    const off = [];
    for (let i = 0; i < n; i++) {
      const a = pts[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)], b = pts[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      off.push([pts[i][0] + Math.sin(ang) * st.radius * sg, pts[i][1] - Math.cos(ang) * st.radius * sg]);
    }
    return { line: pts, off, closed };
  });
}
