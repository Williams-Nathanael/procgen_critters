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

const critterCache = new Map();
function cachedCritter(tags, seed, st) {
  const key = tags.join('+') + '|' + seed + '|' + st.detail + '|' + st.chaos + '|' + st.plump;
  let c = critterCache.get(key);
  if (!c) {
    c = makeCritter(tags, seed, { detail: st.detail, chaos: st.chaos, plump: st.plump });
    if (critterCache.size > 4000) critterCache.clear();
    critterCache.set(key, c);
  }
  return c;
}

// Place critters along one border. `overrides` maps slot index -> { seed } | { skip:true }.
// pageKey varies the result between pages when the border repeats.
export function placeBorder(border, pageKey = 0) {
  const st = { ...DEFAULTS, ...border.settings };
  if (!st.tags.length) return [];
  const poly = borderPolyline(border);
  if (poly.pts.length < 2) return [];
  const meas = measure(poly);
  if (meas.length < 4) return [];
  const overrides = border.overrides || {};
  const out = [];
  const sides = st.side === 'both' ? [1, -1] : [st.side === 'right' ? -1 : 1];
  for (const sideSign of sides) {
    const rng = makeRng(hashStr(`${st.seed}|${pageKey}|${sideSign}`));
    let count = Math.max(1, Math.floor(meas.length / st.spacing + (poly.closed ? 0 : 1 - st.startOffset)));
    const step = poly.closed ? meas.length / Math.max(1, Math.round(meas.length / st.spacing)) : st.spacing;
    if (poly.closed) count = Math.max(1, Math.round(meas.length / st.spacing));
    for (let i = 0; i < count; i++) {
      const slot = `${sideSign}:${i}`;
      const r = rng.fork(); // one independent stream per slot, so edits elsewhere don't reshuffle it
      const ov = overrides[`${pageKey}|${slot}`] || overrides[slot];
      if (ov?.skip) continue;
      const s = (i + st.startOffset) * step + (r() * 2 - 1) * st.spacingVar * step * 0.5 + (sideSign < 0 && st.side === 'both' ? step * 0.5 : 0);
      if (!poly.closed && (s < 0 || s > meas.length)) continue;
      const seed = ov?.seed ?? Math.floor(r() * 2 ** 31);
      const sizeK = 1 + (r() * 2 - 1) * st.sizeVar;
      const faceR = r(), liftR = r(), tiltR = r() * 2 - 1;
      const c = cachedCritter(st.tags, seed, st);
      const b = c.bbox;
      // scale: nominal size governs the larger of width / 1.25*height; never taller than the band
      let sc = st.size * sizeK / Math.max(b.w, b.h * 1.25, 1);
      const tall = -b.y0; // height above the line
      if (tall * sc > st.radius) sc = st.radius / tall;
      const { p, ang } = restAt(poly, meas, s, b.w * sc * 0.42, sideSign);
      // Critter space: x along facing, y down with ground at 0, body in -y.
      // Page: line direction `ang`; the chosen side is the direction (sin, -cos)*sideSign ("left" of travel when y is down = up on screen for rightward lines).
      const back = st.facing === 'backward' || (st.facing === 'random' && faceR < 0.5);
      const fx = back ? -1 : 1;
      const lift = st.lift * liftR * Math.max(st.radius - tall * sc, 0);
      const rot = ang + st.tilt * tiltR;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      // up vector (critter -y) must map to the chosen side normal: n = sideSign * (sin, -cos)
      const tf = ([x, y]) => {
        const lx = x * sc * fx, ly = (y * sc - lift) * sideSign; // ly>0 is toward the far side of the line
        return [p[0] + lx * ca - ly * sa, p[1] + lx * sa + ly * ca];
      };
      const box = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, Math.min(b.y1, 0)], [b.x0, Math.min(b.y1, 0)]].map(tf);
      if (st.avoidOverlap && out.some(o => o.sideSign === sideSign && overlap(o.box, box))) continue;
      // mirroring an odd number of axes flips winding; keep rings consistently wound for nonzero fill
      const rings = c.rings.map(ring => ring.map(tf));
      out.push({ rings, box, slot, seed, sideSign, at: p, critter: c });
    }
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
