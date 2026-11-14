// Core: seeded RNG, 2D geometry helpers, and the Ink surface that turns
// overlapping black/white polygons into one clean silhouette outline.
import ClipperLib from 'clipper-lib';

// ---------- RNG ----------
export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashStr(seed) : seed >>> 0) || 1;
  const f = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(f.range(lo, hi + 1));
  f.chance = p => f() < p;
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  f.wpick = (pairs) => { // [[weight, value], ...]
    let tot = 0; for (const [w] of pairs) tot += w;
    let x = f() * tot;
    for (const [w, v] of pairs) { x -= w; if (x <= 0) return v; }
    return pairs[pairs.length - 1][1];
  };
  f.shuffle = arr => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  f.fork = () => makeRng(Math.floor(f() * 4294967296));
  return f;
}

// ---------- vectors ----------
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
export const polar = (p, a, r) => [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
export const angDiff = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const MINW = 0.75; // thinnest stroke width, in critter units (~100 units per critter)

// Local frame: x along `ang`, y perpendicular. flip=-1 mirrors y.
export function frame(p, ang, s = 1, flip = 1) {
  const c = Math.cos(ang), n = Math.sin(ang);
  const f = (x, y) => [p[0] + s * (x * c - flip * y * n), p[1] + s * (x * n + flip * y * c)];
  f.p = p; f.ang = ang; f.s = s; f.flip = flip;
  f.dir = a => ang + flip * a;
  return f;
}

// ---------- curves ----------
// Open Catmull-Rom spline through control points.
export function spline(ctrl, per = 8) {
  const n = ctrl.length;
  if (n < 2) return ctrl.slice();
  const P = [sub(mul(ctrl[0], 2), ctrl[1]), ...ctrl, sub(mul(ctrl[n - 1], 2), ctrl[n - 2])];
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(ctrl[n - 1]);
  return out;
}

// Straight polyline subdivided (for angular, jointed things).
export function polyline(ctrl, per = 4) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) for (let j = 0; j < per; j++) out.push(lerp(ctrl[i], ctrl[i + 1], j / per));
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

// Radius profile from keyframes [[t, r], ...] with smooth interpolation.
export function profile(keys) {
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, r0] = keys[i - 1], [t1, r1] = keys[i];
        let u = (t - t0) / (t1 - t0 || 1); u = u * u * (3 - 2 * u);
        return r0 + (r1 - r0) * u;
      }
    }
    return keys[keys.length - 1][1];
  };
}

export function pathAt(path, t) { // point + tangent angle at t in [0,1] (by index)
  const x = clamp(t, 0, 1) * (path.length - 1), i = Math.min(Math.floor(x), path.length - 2), u = x - i;
  return { p: lerp(path[i], path[i + 1], u), ang: angOf(path[Math.max(i - 1, 0)], path[Math.min(i + 2, path.length - 1)]) };
}

// Outline polygon of a variable-radius tube around a sampled path.
export function tube(path, rad) {
  const n = path.length;
  const R = typeof rad === 'function' ? path.map((_, i) => rad(i / (n - 1))) : (typeof rad === 'number' ? path.map(() => rad) : rad);
  const L = [], Rt = [];
  let a0 = 0, a1 = 0;
  for (let i = 0; i < n; i++) {
    const a = angOf(path[Math.max(i - 1, 0)], path[Math.min(i + 1, n - 1)]);
    if (i === 0) a0 = a; if (i === n - 1) a1 = a;
    L.push(polar(path[i], a + Math.PI / 2, R[i]));
    Rt.push(polar(path[i], a - Math.PI / 2, R[i]));
  }
  const out = L.slice();
  if (R[n - 1] > 0.15) for (let k = 1; k <= 5; k++) out.push(polar(path[n - 1], a1 + Math.PI / 2 - k * Math.PI / 6, R[n - 1]));
  for (let i = n - 1; i >= 0; i--) out.push(Rt[i]);
  if (R[0] > 0.15) for (let k = 1; k <= 5; k++) out.push(polar(path[0], a0 - Math.PI / 2 - k * Math.PI / 6, R[0]));
  return out;
}

export function ellipse(c, rx, ry, rot = 0, n = 28) {
  const out = [], cs = Math.cos(rot), sn = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]);
  }
  return out;
}

// Leaf / petal / teardrop along a direction.
export function leaf(p, ang, len, wid, bend = 0, fat = 0.4) {
  const mid = polar(polar(p, ang, len * 0.5), ang + Math.PI / 2, bend * len);
  const path = spline([p, mid, polar(p, ang + bend * 0.6, len)], 7);
  return tube(path, profile([[0, wid * 0.12], [fat, wid * 0.5], [1, 0.05]]));
}

// ---------- Ink ----------
const S = 16; // grid units per critter unit (1/16 is far below print resolution; coarser grid = faster Clipper)
const toC = pts => pts.map(p => ({ X: Math.round(p[0] * S), Y: Math.round(p[1] * S) }));
const fromC = path => path.map(p => [p.X / S, p.Y / S]);
const { Clipper, ClipperOffset, ClipType, PolyType, PolyFillType, JoinType, EndType, Paths } = ClipperLib;

function dedupe(c) {
  const o = [];
  for (const p of c) { const q = o[o.length - 1]; if (!q || q.X !== p.X || q.Y !== p.Y) o.push(p); }
  while (o.length > 1 && o[0].X === o[o.length - 1].X && o[0].Y === o[o.length - 1].Y) o.pop();
  return o;
}
// True when no two non-adjacent edges touch (strictly simple ring). Conservative: any touch -> false.
function isSimple(c) {
  const n = c.length;
  if (n > 400) return false;
  for (let i = 0; i < n; i++) {
    const a = c[i], b = c[(i + 1) % n];
    const ax0 = Math.min(a.X, b.X), ax1 = Math.max(a.X, b.X), ay0 = Math.min(a.Y, b.Y), ay1 = Math.max(a.Y, b.Y);
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const p = c[j], q = c[(j + 1) % n];
      if (Math.max(p.X, q.X) < ax0 || Math.min(p.X, q.X) > ax1 || Math.max(p.Y, q.Y) < ay0 || Math.min(p.Y, q.Y) > ay1) continue;
      const d1 = (b.X - a.X) * (p.Y - a.Y) - (b.Y - a.Y) * (p.X - a.X), d2 = (b.X - a.X) * (q.Y - a.Y) - (b.Y - a.Y) * (q.X - a.X);
      const d3 = (q.X - p.X) * (a.Y - p.Y) - (q.Y - p.Y) * (a.X - p.X), d4 = (q.X - p.X) * (b.Y - p.Y) - (q.Y - p.Y) * (b.X - p.X);
      if ((d1 <= 0 || d2 <= 0) && (d1 >= 0 || d2 >= 0) && (d3 <= 0 || d4 <= 0) && (d3 >= 0 || d4 >= 0)) return false;
    }
  }
  return true;
}

function unionPolys(polys) {
  const norm = [];
  for (const p of polys) {
    if (p.length < 3 || p.some(q => !isFinite(q[0]) || !isFinite(q[1]))) continue;
    const c = dedupe(toC(p));
    if (c.length < 3) continue;
    if (isSimple(c)) norm.push(Clipper.Area(c) < 0 ? c.reverse() : c); // most parts: skip a Clipper pass
    else for (const s of Clipper.SimplifyPolygon(c, PolyFillType.pftNonZero)) norm.push(s);
  }
  return boolOp(ClipType.ctUnion, norm, null);
}
function boolOp(type, subj, clip) {
  const c = new Clipper();
  c.AddPaths(subj, PolyType.ptSubject, true);
  if (clip && clip.length) c.AddPaths(clip, PolyType.ptClip, true);
  const sol = new Paths();
  c.Execute(type, sol, PolyFillType.pftNonZero, PolyFillType.pftNonZero);
  return sol;
}
function offset(paths, delta) {
  if (!delta) return paths;
  const co = new ClipperOffset(2, 0.08 * S);
  co.AddPaths(paths, JoinType.jtRound, EndType.etClosedPolygon);
  const out = new Paths();
  co.Execute(out, delta * S);
  return out;
}

function clipToBox(paths, ref, pad) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of ref) for (const p of r) { if (p.X < x0) x0 = p.X; if (p.X > x1) x1 = p.X; if (p.Y < y0) y0 = p.Y; if (p.Y > y1) y1 = p.Y; }
  if (!(x0 <= x1)) return [];
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  return boolOp(ClipType.ctIntersection, paths, [[{ X: x0, Y: y0 }, { X: x1, Y: y0 }, { X: x1, Y: y1 }, { X: x0, Y: y1 }]]);
}

export class Ink {
  constructor() { this.k = []; this.w = []; this.k2 = []; }
  poly(pts, layer = 'k') { this[layer].push(pts); return this; }
  tube(ctrl, rad, layer = 'k', per = 8) { return this.poly(tube(spline(ctrl, per), rad), layer); }
  line(ctrl, w, layer = 'k', per = 6) { // tapered thin stroke
    const r = Math.max(w, MINW) / 2;
    return this.poly(tube(spline(ctrl, per), profile([[0, r], [0.7, r * 0.9], [1, Math.max(r * 0.55, MINW / 2.4)]])), layer);
  }
  dot(c, r, layer = 'k') { return this.poly(ellipse(c, r, r, 0, 18), layer); }
  oval(c, rx, ry, rot = 0, layer = 'k') { return this.poly(ellipse(c, rx, ry, rot), layer); }

  // -> array of rings ([[x,y],...]); outer rings and holes, for even-odd / nonzero fill.
  finish({ soften = 0.6, whiteMargin = 0.9, minHole = 5 } = {}) {
    let blk = unionPolys(this.k);
    // closing: fillets concave junctions. Dropping near-collinear points first (0.05 units) halves
    // its cost: Clipper adds a self-crossing loop at every concave vertex it offsets.
    if (soften > 0) blk = offset(offset(Clipper.CleanPolygons(blk, 0.05 * S), soften), -soften);
    blk = blk.filter(r => { const a = Clipper.Area(r) / (S * S); return a > 0 ? a > 0.5 : -a > minHole; });
    if (this.w.length) {
      let wh = unionPolys(this.w);
      // only the black near the whites matters: clip it to the whites' box (grown past the margin) first
      wh = boolOp(ClipType.ctIntersection, wh, offset(clipToBox(blk, wh, (whiteMargin + 1) * S), -whiteMargin));
      // open the whites a touch so slivers vanish
      wh = offset(offset(wh, -0.25), 0.25);
      if (wh.length) blk = boolOp(ClipType.ctDifference, blk, wh);
    }
    if (this.k2.length) blk = boolOp(ClipType.ctUnion, blk, unionPolys(this.k2));
    blk = Clipper.CleanPolygons(blk, 0.04 * S).filter(r => r.length >= 3 && Math.abs(Clipper.Area(r)) / (S * S) > 0.3);
    return blk.map(fromC);
  }
}

export function ringsBBox(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function ringsToPath(rings, tf = null, prec = 2) {
  let d = '';
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const p = tf ? tf(r[i]) : r[i];
      d += (i ? 'L' : 'M') + p[0].toFixed(prec) + ' ' + p[1].toFixed(prec);
    }
    d += 'Z';
  }
  return d;
}
