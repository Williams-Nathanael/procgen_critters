// Browser UI: open a PDF, draw borders, tune settings, export.
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { TAGS, TAG_NAMES } from '../gen/tags/index.js';
import { ringsToPath } from '../gen/core.js';
import { makeCritter } from '../gen/critter.js';
import { DEFAULTS, placeBorder, placeInteractive, bandOutline, borderPolyline, simplify } from '../place.js';
import { exportPdf, hexToRgb } from '../export.js';
import { friendlyPdfError, looksLikePdf, looksEncrypted } from '../pdfio.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./dist/pdf.worker.min.mjs', document.baseURI).href;
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat(3)) if (k != null) e.append(k);
  return e;
};

const MAX_CANVAS_PX = 12e6;
const DEFAULT_INK = '#000000';
const state = {
  name: 'blank page', bytes: null, doc: null, numPages: 1,
  page: 1, zoom: 1, fit: true, pageW: 612, pageH: 792, viewport1: null,
  borders: [], selected: null, tool: 'free',
  defaults: structuredClone(DEFAULTS),
  history: [], nextId: 1, renderToken: 0,
};
window.__critters = state; // handy for debugging from the console and the UI tests

// ------------------------------------------------------------------ messages and dialogs
// In-app notices instead of alert(): kind is 'error' | 'warn' | 'info'. `progress` shows a bar (0..1).
let msgTimer = 0;
function showMessage(text, kind = 'error', { progress = null, sticky = kind !== 'info' } = {}) {
  const box = $('#msg'); clearTimeout(msgTimer);
  box.className = kind; box.hidden = false;
  box.replaceChildren(...[el('span', { class: 'mtext' }, text),
    progress != null ? el('progress', { max: 1, value: progress }) : null,
    sticky && progress == null ? el('button', { class: 'mclose', title: 'Dismiss', onclick: hideMessage }, '×') : null].filter(Boolean));
  if (!sticky) msgTimer = setTimeout(hideMessage, 5000);
}
function hideMessage() { clearTimeout(msgTimer); $('#msg').hidden = true; }
// Ask for a PDF password; resolves to the text, or null if cancelled.
function askPassword(wrong) {
  return new Promise(res => {
    const done = v => { dlg.remove(); res(v); };
    const input = el('input', { type: 'password', id: 'pwinput', autocomplete: 'off', onkeydown: e => { if (e.key === 'Enter') done(input.value); else if (e.key === 'Escape') done(null); } });
    const dlg = el('div', { id: 'pwdlg', class: 'overlay-dlg' }, el('div', { class: 'card' },
      el('h2', {}, 'Password needed'),
      el('p', {}, wrong ? 'That password was not right. Try again.' : 'This PDF is password protected. Type the password to open it. It is only used in this tab.'),
      input,
      el('div', { class: 'row' }, el('button', { class: 'primary', id: 'pwok', onclick: () => done(input.value) }, 'Open'), el('button', { id: 'pwcancel', onclick: () => done(null) }, 'Cancel'))));
    document.body.append(dlg); input.focus();
  });
}

// ------------------------------------------------------------------ document
async function blankPdf() {
  const d = await PDFDocument.create(); d.addPage([612, 792]);
  return d.save();
}
const tick = () => new Promise(r => setTimeout(r, 0));
class CancelledError extends Error {}
async function loadBytes(bytes, name) {
  if (!bytes.length) throw Object.assign(new Error('empty'), { name: 'InvalidPDFException' });
  if (!looksLikePdf(bytes)) throw Object.assign(new Error('no PDF header'), { name: 'InvalidPDFException' });
  const task = pdfjs.getDocument({
    data: bytes.slice(), isEvalSupported: false,
    cMapUrl: new URL('../node_modules/pdfjs-dist/cmaps/', document.baseURI).href, cMapPacked: true,
    standardFontDataUrl: new URL('../node_modules/pdfjs-dist/standard_fonts/', document.baseURI).href,
    wasmUrl: new URL('../node_modules/pdfjs-dist/wasm/', document.baseURI).href,
  });
  task.onPassword = async (give, reason) => { const pw = await askPassword(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD); if (pw == null) { task.destroy(); } else give(pw); };
  let doc;
  try { doc = await task.promise; }
  catch (e) { if (e?.name === 'PasswordException' || /destroyed/i.test(e?.message || '')) throw new CancelledError(); throw e; }
  const old = state.doc; // free the previous document's worker memory
  state.bytes = bytes; state.doc = doc; state.name = name; state.numPages = doc.numPages; state.page = 1;
  state.encrypted = looksEncrypted(bytes);
  state.borders = []; state.selected = null; state.history = [];
  if (old) old.loadingTask.destroy().catch(() => {});
  $('#docname').textContent = name;
  for (const b of [$('#export'), $('#exportpage')]) { b.disabled = state.encrypted; b.title = state.encrypted ? 'This PDF is encrypted, so critters cannot be written into it' : b.dataset.title; }
  if (state.encrypted) showMessage('This PDF is encrypted. You can place critters and preview them, but Export is switched off: pdf-lib cannot write into encrypted files. Remove the protection first (for example qpdf --decrypt in.pdf out.pdf) and open that copy.', 'warn');
  else hideMessage();
  restoreSession();
  buildThumbs();
  await showPage();
}

async function showPage() {
  const token = ++state.renderToken;
  const page = await state.doc.getPage(state.page);
  const vp1 = page.getViewport({ scale: 1 });
  state.viewport1 = vp1; state.pageW = vp1.width; state.pageH = vp1.height;
  if (state.fit) {
    const st = $('#stage');
    state.zoom = Math.max(0.2, Math.min((st.clientWidth - 48) / vp1.width, (st.clientHeight - 60) / vp1.height));
  }
  const dpr = window.devicePixelRatio || 1;
  let sc = state.zoom * dpr; // cap the canvas (zoomed-in huge pages would otherwise eat memory)
  const px = vp1.width * vp1.height * sc * sc; if (px > MAX_CANVAS_PX) sc *= Math.sqrt(MAX_CANVAS_PX / px);
  const vp = page.getViewport({ scale: sc });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  try { await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport: vp }).promise; }
  catch (e) { if (token === state.renderToken) showMessage('Could not draw page ' + state.page + ': ' + (e?.message || e)); return; }
  finally { page.cleanup(); }
  if (token !== state.renderToken) return;
  const shown = $('#pdf');
  shown.width = canvas.width; shown.height = canvas.height;
  shown.style.width = vp1.width * state.zoom + 'px'; shown.style.height = vp1.height * state.zoom + 'px';
  shown.getContext('2d').drawImage(canvas, 0, 0);
  $('#overlay').setAttribute('viewBox', `0 0 ${vp1.width} ${vp1.height}`);
  $('#pageinfo').textContent = `${state.page} / ${state.numPages}`;
  markThumbs(true);
  $('#prev').disabled = state.page <= 1; $('#next').disabled = state.page >= state.numPages;
  drawOverlay(); drawPanel();
}

// ------------------------------------------------------------------ page thumbnails
// A strip of placeholders, one per page. Only thumbnails near the visible part of the strip are
// rendered (small scale, one at a time); ones that scroll away are released, so a 200-page PDF costs
// a handful of small canvases.
const THUMB_W = 84;
let thumbObs = null, thumbQueue = [], thumbBusy = false, thumbDoc = null;
function buildThumbs() {
  const box = $('#thumbs'); thumbObs?.disconnect(); thumbQueue = []; thumbDoc = state.doc;
  box.hidden = state.numPages < 2; box.replaceChildren();
  if (box.hidden) return;
  thumbObs = new IntersectionObserver(entries => {
    for (const en of entries) {
      const t = en.target;
      if (en.isIntersecting) { if (!t.dataset.done && !thumbQueue.includes(t)) thumbQueue.push(t); }
      else { thumbQueue = thumbQueue.filter(x => x !== t); const c = t.querySelector('canvas'); if (c) { c.remove(); delete t.dataset.done; } }
    }
    pumpThumbs();
  }, { root: box, rootMargin: '300px 0px' });
  const ratio = state.pageH / state.pageW || 1.3;
  for (let n = 1; n <= state.numPages; n++) {
    const t = el('button', { class: 'thumb', 'data-page': n, title: `Go to page ${n}`, onclick: () => { if (state.page !== n) { state.page = n; showPage(); } } }, el('span', { class: 'tn' }, String(n)));
    t.style.height = Math.round(THUMB_W * ratio) + 'px';
    box.append(t); thumbObs.observe(t);
  }
}
async function pumpThumbs() {
  if (thumbBusy) return; thumbBusy = true;
  const doc = thumbDoc;
  try {
    while (thumbQueue.length && doc === thumbDoc) {
      const t = thumbQueue.shift(); if (!t.isConnected || t.dataset.done) continue;
      const page = await doc.getPage(+t.dataset.page), v1 = page.getViewport({ scale: 1 }), sc = THUMB_W / v1.width * (window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale: sc }), c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvasContext: c.getContext('2d'), canvas: c, viewport: vp }).promise;
      page.cleanup();
      if (doc !== thumbDoc || !t.isConnected) break;
      t.style.height = ''; t.dataset.done = 1; t.prepend(c);
    }
  } catch (e) { console.error(e); }
  thumbBusy = false;
  if (thumbQueue.length && doc === thumbDoc) pumpThumbs();
}
// Highlight the current page and mark pages that carry borders.
function markThumbs(scroll = false) {
  if ($('#thumbs').hidden) return;
  for (const t of $('#thumbs').children) {
    const n = +t.dataset.page;
    t.classList.toggle('cur', n === state.page);
    t.classList.toggle('has', state.borders.some(b => appliesTo(b, n)));
    if (scroll && n === state.page) t.scrollIntoView({ block: 'nearest' });
  }
}

// ------------------------------------------------------------------ borders
const appliesTo = (b, pageNo) => b.scope === 'all' || (b.scope === 'odd' && pageNo % 2 === 1) || (b.scope === 'even' && pageNo % 2 === 0) || ((b.scope ?? 'page') === 'page' && b.page === pageNo);
const pageKey = (b, pageNo) => ((b.scope ?? 'page') === 'page' ? 0 : pageNo);
const selected = () => state.borders.find(b => b.id === state.selected) || null;
const target = () => selected()?.settings ?? state.defaults;

function pushHistory() {
  state.history.push(JSON.stringify({ borders: state.borders, selected: state.selected }));
  if (state.history.length > 100) state.history.shift();
}
function undo() {
  const h = state.history.pop(); if (!h) return; handleIdx = null;
  const s = JSON.parse(h); state.borders = s.borders; state.selected = s.selected;
  changed();
}
function changed() { drawOverlay(); drawPanel(); saveSession(); markThumbs(); }
state.redraw = changed;

function addBorder(kind, pts, closed = false) {
  pushHistory();
  const b = { id: state.nextId++, kind, pts, closed, page: state.page, scope: state.defaults.scope ?? 'page', settings: structuredClone(state.defaults), overrides: {}, showLine: false };
  delete b.settings.scope;
  b.settings.seed = Math.floor(Math.random() * 100000);
  state.borders.push(b); state.selected = b.id;
  changed();
}

// ------------------------------------------------------------------ overlay
function polyD(pts, closed) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + (closed ? 'Z' : ''); }
// Redraw the overlay. Borders whose inputs did not change reuse their layout and markup; a border
// that needs many new critters (detail / mix sliders) shows its previous layout and catches up over
// the next frames, so no single event blocks for long.
const FRAME_BUDGET = 12; // ms of critter generation per draw when a stale layout can be shown
let catchUp = 0, rafPending = 0, lastDraft = null;
const SVGNS = 'http://www.w3.org/2000/svg';
const svgGroup = markup => { const g = document.createElementNS(SVGNS, 'g'); g.innerHTML = markup; return g; };
function drawOverlay(draft = null) {
  const t0 = performance.now();
  const svg = $('#overlay'); let stale = false;
  lastDraft = draft;
  const nodes = [];
  for (const b of state.borders) {
    if (!appliesTo(b, state.page)) continue;
    const sel = b.id === state.selected;
    let r = { items: [], stale: false, memo: null };
    try { r = placeInteractive(b, pageKey(b, state.page), FRAME_BUDGET); } catch (e) { console.error(e); }
    if (r.stale) stale = true;
    const m = r.memo; if (!m) continue;
    if (sel) { // the band preview is cheap; rebuilt each time
      let bh = ''; for (const band of bandOutline(b)) bh += `<path class="band" d="${polyD(band.line.concat(band.off.slice().reverse()), true)}"/>`;
      nodes.push(svgGroup(bh));
    }
    // One group per border, reused as long as the border's layout memo and selection are unchanged.
    // The hit stroke sits under the critters so they stay clickable.
    if (!m.el || m.sel !== sel) {
      const poly = borderPolyline(b), d = polyD(poly.pts, poly.closed);
      m.el = svgGroup(`<path class="hit" data-b="${b.id}" d="${d}"/>` + r.items.map(it => `<path class="critter" data-b="${b.id}" data-slot="${it.slot}" d="${ringsToPath(it.rings, null, 2)}"/>`).join('') + `<path class="bline${sel ? ' sel' : ''}" d="${d}"/>`);
      m.el.style.setProperty('--c', b.settings.ink || DEFAULT_INK);
      m.sel = sel;
    }
    nodes.push(m.el);
  }
  if (draft) nodes.push(svgGroup(`<path class="draft" d="${draft}"/>`));
  nodes.push(drawHandles());
  svg.replaceChildren(...nodes);
  svg.classList.toggle('draw', state.tool !== 'select');
  svg.classList.toggle('pick', state.tool === 'select');
  const n = state.borders.length;
  $('#hint').textContent = n ? '' : 'Draw a border on the page: scribble a line, or pick Box / Oval. Critters appear along it; tune them on the right.';
  state.stale = stale; state.lastDrawMs = performance.now() - t0;
  if (stale && !catchUp) catchUp = requestAnimationFrame(() => { catchUp = 0; drawOverlay(lastDraft); });
}
// ---- editable border points. Handles belong to the selected border (Select tool only) and live in
// one persistent group, so a focused handle keeps focus while its position updates during a drag.
const handleG = document.createElementNS(SVGNS, 'g'); handleG.setAttribute('class', 'handles');
let handleIdx = null; // scribbles: indices into b.pts of the handle points
function freeHandleIdx(b) {
  if (handleIdx && handleIdx.id === b.id && handleIdx.n === b.pts.length) return handleIdx.idx;
  let tol = 8, s; const pos = new Map(b.pts.map((p, i) => [p, i]));
  do { s = simplify(b.pts, tol); tol *= 1.5; } while (s.length > 24);
  let idx = s.map(p => pos.get(p));
  if (b.closed && idx.length > 3 && Math.hypot(b.pts[idx[0]][0] - b.pts[idx.at(-1)][0], b.pts[idx.at(-1)][1] - b.pts[idx[0]][1]) < 20) idx.pop();
  handleIdx = { id: b.id, n: b.pts.length, idx }; return idx;
}
function handlePoints(b) { // -> [[x, y], ...] in page units
  if (b.kind === 'rect' || b.kind === 'ellipse') {
    const [[x0, y0], [x1, y1]] = b.pts, a = Math.min(x0, x1), c = Math.max(x0, x1), t = Math.min(y0, y1), d = Math.max(y0, y1);
    return [[a, t], [c, t], [a, d], [c, d]];
  }
  if (b.kind === 'free') return freeHandleIdx(b).map(i => b.pts[i]);
  return b.pts;
}
function drawHandles() {
  const b = state.tool === 'select' ? selected() : null;
  if (!b || !appliesTo(b, state.page)) { handleG.replaceChildren(); return handleG; }
  const pts = handlePoints(b), r = 5 / state.zoom;
  while (handleG.children.length > pts.length) handleG.lastChild.remove();
  pts.forEach((p, i) => {
    let c = handleG.children[i];
    if (!c) { c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('class', 'handle'); c.setAttribute('tabindex', '0'); handleG.append(c); }
    c.dataset.h = i; c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1)); c.setAttribute('r', r.toFixed(2));
  });
  return handleG;
}
// Move handle k of border b to page point p. d holds what the drag started from.
function dragHandle(b, d, p) {
  if (b.kind === 'rect' || b.kind === 'ellipse') b.pts = [[Math.min(d.o[0], p[0]), Math.min(d.o[1], p[1])], [Math.max(d.o[0], p[0]), Math.max(d.o[1], p[1])]];
  else if (b.kind === 'line') b.pts[d.k] = p;
  else { // scribble: pull the stretch between the neighbouring handles along, tapering off
    const idx = d.idx, n = d.orig.length, m = idx.length, ik = idx[d.k];
    const dx = p[0] - d.orig[ik][0], dy = p[1] - d.orig[ik][1];
    const fwd = d.k < m - 1 ? idx[d.k + 1] - ik : (b.closed ? idx[0] + n - ik : 0), back = d.k > 0 ? ik - idx[d.k - 1] : (b.closed ? ik + n - idx[m - 1] : 0);
    b.pts = d.orig.map((q, i) => {
      let w = 0;
      const f = (i - ik + n) % n, g = (ik - i + n) % n;
      if (i === ik) w = 1;
      else if (b.closed || i > ik) { if (f > 0 && f < fwd && (b.closed || i > ik)) w = 1 - f / fwd; }
      if (!w && (b.closed || i < ik)) { if (g > 0 && g < back) w = 1 - g / back; }
      return w ? [q[0] + dx * w, q[1] + dy * w] : q;
    });
  }
}
// Coalesce rapid inputs (slider drags) into one redraw per animation frame.
function drawSoon() {
  if (rafPending) return;
  rafPending = requestAnimationFrame(() => { rafPending = 0; drawOverlay(); });
}

function evPt(e) {
  const r = $('#overlay').getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * state.pageW, (e.clientY - r.top) / r.height * state.pageH];
}
function draftPath(kind, pts) {
  if (kind === 'rect') { const [[a, b], [c, d]] = pts; return `M${a} ${b}L${c} ${b}L${c} ${d}L${a} ${d}Z`; }
  if (kind === 'ellipse') return polyD(borderPolyline({ kind, pts }).pts, true);
  return polyD(pts, false);
}

let drag = null, polyDraft = null;
function setupPointer() {
  const svg = $('#overlay');
  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const p = evPt(e);
    if (state.tool === 'select') {
      let t = e.target;
      if (t.classList.contains('handle')) {
        // a critter under the pointer wins, so handles never block reroll / Alt-remove
        const under = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList?.contains('critter'));
        if (!under) {
          const b = selected(); if (!b) return;
          const k = +t.dataset.h; pushHistory(); t.focus({ preventScroll: true });
          const o = b.kind === 'rect' || b.kind === 'ellipse' ? (() => { const [[x0, y0], [x1, y1]] = b.pts, hp = handlePoints(b)[k]; return [hp[0] === Math.min(x0, x1) ? Math.max(x0, x1) : Math.min(x0, x1), hp[1] === Math.min(y0, y1) ? Math.max(y0, y1) : Math.min(y0, y1)]; })() : null;
          drag = { mode: 'handle', k, o, moved: false, orig: b.pts.map(q => q.slice()), idx: b.kind === 'free' ? freeHandleIdx(b) : null };
          svg.setPointerCapture(e.pointerId); e.preventDefault(); return;
        }
        t = under;
      }
      if (t.classList.contains('critter')) {
        const b = state.borders.find(x => x.id === +t.dataset.b); if (!b) return;
        pushHistory();
        const key = (b.scope ?? 'page') === 'page' ? t.dataset.slot : `${state.page}|${t.dataset.slot}`;
        b.overrides[key] = e.altKey || e.shiftKey ? { skip: true } : { seed: Math.floor(Math.random() * 2 ** 31) };
        state.selected = b.id; changed(); return;
      }
      if (t.classList.contains('hit')) {
        state.selected = +t.dataset.b; pushHistory();
        drag = { mode: 'move', last: p, moved: false }; svg.setPointerCapture(e.pointerId); changed(); return;
      }
      state.selected = null; changed(); return;
    }
    if (state.tool === 'line') {
      if (!polyDraft) polyDraft = [p, p]; else polyDraft.splice(polyDraft.length - 1, 0, p);
      drag = { mode: 'poly' }; return;
    }
    drag = { mode: state.tool, pts: [p, p] }; svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    const p = evPt(e);
    if (polyDraft && state.tool === 'line') {
      let q = p; const prev = polyDraft[polyDraft.length - 2];
      if (e.shiftKey && prev) { const a = Math.round(Math.atan2(p[1] - prev[1], p[0] - prev[0]) / (Math.PI / 4)) * Math.PI / 4, d = Math.hypot(p[0] - prev[0], p[1] - prev[1]); q = [prev[0] + Math.cos(a) * d, prev[1] + Math.sin(a) * d]; }
      polyDraft[polyDraft.length - 1] = q; drawOverlay(polyD(polyDraft, false)); return;
    }
    if (!drag) return;
    if (drag.mode === 'handle') {
      const b = selected(); if (!b) return;
      dragHandle(b, drag, p); drag.moved = true; drawOverlay(); return;
    }
    if (drag.mode === 'move') {
      const b = selected(); if (!b) return;
      const dx = p[0] - drag.last[0], dy = p[1] - drag.last[1];
      b.pts = b.pts.map(q => [q[0] + dx, q[1] + dy]); drag.last = p; drag.moved = true; drawOverlay(); return;
    }
    if (drag.mode === 'free') { const l = drag.pts[drag.pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 1.5) drag.pts.push(p); }
    else {
      let q = p;
      if (e.shiftKey) { const [a, b] = drag.pts[0], s = Math.max(Math.abs(p[0] - a), Math.abs(p[1] - b)); q = [a + Math.sign(p[0] - a) * s, b + Math.sign(p[1] - b) * s]; }
      drag.pts[1] = q;
    }
    drawOverlay(draftPath(drag.mode, drag.pts));
  });
  const finishPoly = () => {
    if (!polyDraft) return;
    const pts = polyDraft.slice(0, -1).filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 2);
    polyDraft = null; drag = null;
    if (pts.length >= 2) addBorder('line', pts); else drawOverlay();
  };
  svg.addEventListener('dblclick', e => {
    const b = selected();
    if (state.tool === 'select' && b?.kind === 'line' && e.target.classList.contains('hit') && +e.target.dataset.b === b.id) { // add a point on the nearest segment
      const p = evPt(e); let best = 0, bd = Infinity, bq = null;
      for (let i = 0; i < b.pts.length - 1; i++) {
        const [ax, ay] = b.pts[i], [cx, cy] = b.pts[i + 1], vx = cx - ax, vy = cy - ay, L = vx * vx + vy * vy || 1e-9;
        const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - ay) * vy) / L)), q = [ax + t * vx, ay + t * vy], dd = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (dd < bd) { bd = dd; best = i; bq = q; }
      }
      if (bq) { pushHistory(); b.pts.splice(best + 1, 0, bq); changed(); }
      return;
    }
    finishPoly();
  });
  window.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'Escape' && !$('#help').hidden) { toggleHelp(false); return; }
    if (e.key === '?') { toggleHelp(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.classList?.contains('handle')) { // remove a polyline point (never below 2)
      e.preventDefault();
      const b = selected();
      if (b?.kind === 'line' && b.pts.length > 2) { pushHistory(); b.pts.splice(+e.target.dataset.h, 1); changed(); }
      return;
    }
    if (!$('#help').hidden) return;
    if (e.key === 'Enter') finishPoly();
    if (e.key === 'Escape') { polyDraft = null; drag = null; drawOverlay(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected()) { pushHistory(); state.borders = state.borders.filter(b => b.id !== state.selected); state.selected = null; changed(); }
    const tk = { f: 'free', l: 'line', r: 'rect', o: 'ellipse', v: 'select' }[e.key.toLowerCase()];
    if (tk && !e.ctrlKey && !e.metaKey) setTool(tk);
  });
  svg.addEventListener('pointerup', e => {
    if (!drag || drag.mode === 'poly') return;
    const d = drag; drag = null;
    if (d.mode === 'handle' || d.mode === 'move') { if (!d.moved) state.history.pop(); changed(); return; }
    if (d.mode === 'free') {
      if (d.pts.length < 4) { drawOverlay(); return; }
      const a = d.pts[0], z = d.pts[d.pts.length - 1];
      let len = 0; for (let i = 1; i < d.pts.length; i++) len += Math.hypot(d.pts[i][0] - d.pts[i - 1][0], d.pts[i][1] - d.pts[i - 1][1]);
      const closed = len > 120 && Math.hypot(a[0] - z[0], a[1] - z[1]) < Math.max(14, len * 0.04);
      addBorder('free', d.pts, closed);
    } else {
      const [[a, b], [c, dd]] = d.pts;
      if (Math.abs(a - c) < 6 || Math.abs(b - dd) < 6) { drawOverlay(); return; }
      addBorder(d.mode, d.pts, true);
    }
  });
}

function setTool(t) {
  state.tool = t; polyDraft = null; drag = null;
  for (const b of document.querySelectorAll('#tools button')) b.classList.toggle('on', b.dataset.tool === t);
  drawOverlay();
}

// ------------------------------------------------------------------ side panel
const fmtPt = v => `${(v / 72).toFixed(2)} in`;
const pct = v => `${Math.round(v * 100)}%`;
const SLIDERS = [
  ['radius', 'Band depth', 8, 200, 1, fmtPt, 'How far out from the line critters may reach'],
  ['spacing', 'Spacing', 16, 360, 1, fmtPt, 'Distance between critters along the line'],
  ['size', 'Critter size', 10, 160, 1, fmtPt, 'Nominal size of each critter'],
];
const MORE = [
  ['sizeVar', 'Size variety', 0, 0.6, 0.01, pct],
  ['spacingVar', 'Spacing jitter', 0, 1, 0.01, pct],
  ['lift', 'Float off line', 0, 1, 0.01, pct],
  ['tilt', 'Tilt', 0, 0.8, 0.01, v => `±${Math.round(v * 57.3)}°`],
  ['startOffset', 'Start offset', 0, 1, 0.01, pct],
  ['detail', 'White detail', 0, 1, 0.01, v => (v < 0.05 ? 'none' : v < 0.5 ? 'eyes' : 'eyes + marks')],
  ['chaos', 'Mix wildness', 0, 1, 0.01, pct],
  ['hybrid', 'Hybrid', 0, 1, 0.01, pct, 'How often a critter melds several species of its tag (0: one catalogue species each)'],
  ['plump', 'Plumpness', 0.7, 1.4, 0.01, v => v.toFixed(2)],
];

function slider([key, label, min, max, step, fmt, title]) {
  const st = target(), v0 = st[key] ?? DEFAULTS[key];
  const out = el('output', {}, fmt(v0));
  const input = el('input', { type: 'range', min, max, step, value: v0, title: title || label,
    onpointerdown: () => { if (selected()) pushHistory(); },
    oninput: e => { target()[key] = +e.target.value; out.textContent = fmt(+e.target.value); drawSoon(); },
    onchange: () => saveSession() });
  return el('div', { class: 'row' }, el('label', {}, label), input, out);
}
function seg(options, get, set) {
  return el('div', { class: 'seg' }, options.map(([v, label]) => el('button', { class: get() === v ? 'on' : '', onclick: () => { if (selected()) pushHistory(); set(v); changed(); } }, label)));
}

// A few sample critters for the current tag selection, so you can see what a mix gives
// before drawing anything. Click to shuffle.
function sampleStrip(st) {
  const box = el('div', { class: 'samples', title: 'Samples of what these tags produce, in the ink colour. Click for more.' });
  box.style.setProperty('--c', st.ink || DEFAULT_INK);
  const fill = () => {
    let h = '';
    for (let i = 0; i < 8; i++) {
      let c; try { c = makeCritter(st.tags, (state.sampleSeed ?? 7) * 100 + i, { detail: st.detail, chaos: st.chaos, plump: st.plump, hybrid: st.hybrid }); } catch { continue; }
      const b = c.bbox, m = Math.max(b.w, b.h) * 0.06;
      h += `<svg viewBox="${(b.x0 - m).toFixed(1)} ${(b.y0 - m).toFixed(1)} ${(b.w + 2 * m).toFixed(1)} ${(b.h + 2 * m).toFixed(1)}"><title>${Object.values(c.species || {}).join(' + ')}</title><path d="${ringsToPath(c.rings, null, 1)}"/></svg>`;
    }
    box.innerHTML = h;
  };
  box.addEventListener('click', () => { state.sampleSeed = Math.floor(Math.random() * 1e6); fill(); });
  fill();
  return box;
}

function describe(b) {
  const kind = { free: b.closed ? 'Loop' : 'Scribble', line: 'Line', rect: 'Box', ellipse: 'Oval' }[b.kind];
  const where = (b.scope ?? 'page') === 'page' ? `p.${b.page}` : `${b.scope} pages`;
  return `${kind} · ${b.settings.tags.map(t => t.slice(0, 4)).join('+') || 'no tags'} · ${where}`;
}

// ------------------------------------------------------------------ presets
const PRESET_KEYS = ['tags', 'side', 'radius', 'spacing', 'size', 'facing', 'sizeVar', 'spacingVar', 'lift', 'tilt', 'startOffset', 'detail', 'chaos', 'plump', 'hybrid', 'avoidOverlap', 'ink'];
const BUILTIN_PRESETS = {
  'Tidy row': { tags: ['salamander'], side: 'left', radius: 40, spacing: 72, size: 40, sizeVar: 0.1, spacingVar: 0.1, tilt: 0, lift: 0 },
  'Dense hedge': { tags: ['plant', 'fungus'], side: 'both', radius: 50, spacing: 24, size: 24, sizeVar: 0.35, spacingVar: 0.4, tilt: 0.2 },
  'Sparse wanderers': { tags: ['mammal'], side: 'left', radius: 70, spacing: 190, size: 56, sizeVar: 0.3, spacingVar: 0.5, facing: 'random' },
  'Tiny frieze': { tags: ['salamander', 'fungus'], side: 'left', radius: 20, spacing: 30, size: 16, sizeVar: 0.15, spacingVar: 0.1 },
};
const loadPresets = () => { try { return JSON.parse(localStorage.getItem('critters:presets') || '{}') || {}; } catch { return {}; } };
const storePresets = p => { try { localStorage.setItem('critters:presets', JSON.stringify(p)); } catch { /* storage unavailable */ } };
function applyPreset(p) {
  const b = selected(); if (b) pushHistory();
  const st = target();
  for (const k of PRESET_KEYS) if (k in p) st[k] = structuredClone(p[k]);
  if (p.ink) state.defaults.ink = p.ink;
  changed();
}
function presetBar(st, b) {
  const user = loadPresets();
  const sel = el('select', { id: 'presetsel', title: 'Saved and built-in sets of border options' },
    el('option', { value: '' }, 'Presets…'),
    Object.keys(BUILTIN_PRESETS).map(n => el('option', { value: 'b:' + n }, n)),
    Object.keys(user).map(n => el('option', { value: 'u:' + n }, n + ' (saved)')));
  const pick = () => { const v = sel.value; return v.startsWith('b:') ? BUILTIN_PRESETS[v.slice(2)] : v.startsWith('u:') ? user[v.slice(2)] : null; };
  const name = el('input', { type: 'text', id: 'presetname', placeholder: 'name', size: 10, title: 'Name for a new preset' });
  return el('div', { class: 'line' },
    sel,
    el('button', { id: 'presetapply', title: b ? 'Apply to the selected border' : 'Apply to the settings for the next border', onclick: () => { const p = pick(); if (p) applyPreset(p); } }, 'Apply'),
    el('button', { id: 'presetdel', title: 'Delete the chosen saved preset', onclick: () => { if (sel.value.startsWith('u:')) { delete user[sel.value.slice(2)]; storePresets(user); drawPanel(); } } }, 'Delete'),
    name,
    el('button', { id: 'presetsave', title: 'Save the current options under this name', onclick: () => {
      const n = name.value.trim(); if (!n) return;
      const p = {}; for (const k of PRESET_KEYS) if (k in st) p[k] = structuredClone(st[k]);
      user[n] = p; storePresets(user); drawPanel();
    } }, 'Save'));
}

// ------------------------------------------------------------------ keyboard help
const HELP = [
  ['Tools', [['F', 'Scribble'], ['L', 'Line (click points; double-click or Enter to finish)'], ['R', 'Box'], ['O', 'Oval'], ['V', 'Select']]],
  ['Drawing', [['Shift + drag / click', 'Snap line to 45 degrees; square box; circle'], ['Enter', 'Finish a line'], ['Esc', 'Cancel the line being drawn']]],
  ['Select tool', [['Click a border', 'Select it; drag to move it'], ['Click a critter', 'Reroll just that critter'], ['Alt + click / Shift + click a critter', 'Remove that critter'], ['Delete / Backspace', 'Delete the selected border'], ['Drag a round handle', 'Move a border point (a box or oval corner; a scribble bends smoothly)'], ['Double-click a line segment', 'Add a point to a straight / polyline border'], ['Delete on a focused handle', 'Remove that polyline point (a line keeps at least 2)']]],
  ['General', [['Page strip (left)', 'Click a thumbnail to jump to that page; a dot marks pages with borders'], ['Ctrl + Z', 'Undo'], ['?', 'Show or hide this help'], ['Esc', 'Close this help'], ['Drop a PDF on the page', 'Open it']]],
];
function toggleHelp(show = $('#help').hidden) {
  const h = $('#help'); h.hidden = !show;
  if (show) {
    h.replaceChildren(el('div', { class: 'card', role: 'dialog', 'aria-label': 'Keyboard shortcuts' },
      el('h2', {}, 'Shortcuts and mouse'),
      HELP.map(([t, rows]) => [el('h3', {}, t), el('dl', {}, rows.map(([k, d]) => [el('dt', {}, k), el('dd', {}, d)]))]),
      el('button', { onclick: () => toggleHelp(false) }, 'Close (Esc)')));
  }
}

function drawPanel() {
  const b = selected(), st = target(), panel = $('#panel');
  const closed = b ? borderPolyline(b).closed : false;
  const kids = [];
  kids.push(el('h2', {}, b ? 'Selected border' : 'Settings for the next border'));
  if (!b) kids.push(el('p', { class: 'note' }, 'Nothing selected: these settings are used for the next border you draw. Click a border (Select tool) to edit it.'));

  kids.push(el('h3', {}, 'Critter tags (stackable)'));
  kids.push(el('div', { class: 'chips' }, TAG_NAMES.map(t => el('button', { class: st.tags.includes(t) ? 'on' : '', title: TAGS[t].label,
    onclick: () => { if (b) pushHistory(); const i = st.tags.indexOf(t); if (i >= 0) st.tags.splice(i, 1); else st.tags.push(t); changed(); } }, TAGS[t].short || TAGS[t].label))));
  if (st.tags.length > 1) kids.push(el('p', { class: 'note' }, 'Stacked: each critter takes its body from one of these and borrows features from the others, differently each time.'));
  if (!st.tags.length) kids.push(el('p', { class: 'note' }, 'Pick at least one tag.'));
  else kids.push(sampleStrip(st));

  kids.push(el('div', { class: 'line' }, el('label', { for: 'ink' }, 'Ink colour'),
    el('input', { type: 'color', id: 'ink', value: st.ink || DEFAULT_INK, title: 'Colour of the critters, on screen and in the exported PDF. New borders use the last colour you picked.',
      onpointerdown: () => { if (b) pushHistory(); },
      oninput: e => { st.ink = e.target.value; state.defaults.ink = st.ink; $('.samples')?.style.setProperty('--c', st.ink); drawSoon(); },
      onchange: () => changed() })));
  kids.push(presetBar(st, b));

  kids.push(el('h3', {}, 'Side of the line'));
  kids.push(seg(closed ? [['left', 'Outside'], ['right', 'Inside'], ['both', 'Both']] : [['left', 'One side'], ['right', 'Other side'], ['both', 'Both']], () => st.side, v => { st.side = v; }));

  kids.push(el('h3', {}, 'Layout'));
  for (const s of SLIDERS) kids.push(slider(s));
  kids.push(el('div', { class: 'line' }, el('label', {}, 'Facing'), seg([['forward', 'Forward'], ['backward', 'Back'], ['random', 'Mixed']], () => st.facing, v => { st.facing = v; })));

  kids.push(el('div', { class: 'line' },
    el('button', { class: 'primary', title: 'New random critters for this border', onclick: () => { if (b) pushHistory(); st.seed = Math.floor(Math.random() * 100000); if (b) b.overrides = {}; changed(); } }, 'Reroll all'),
    el('label', {}, 'seed'), el('input', { type: 'number', value: st.seed, onchange: e => { if (b) pushHistory(); st.seed = +e.target.value || 0; changed(); } })));

  if (b) {
    kids.push(el('h3', {}, 'Pages'));
    kids.push(seg([['page', `Only p.${b.page}`], ['all', 'All'], ['odd', 'Odd'], ['even', 'Even']], () => b.scope ?? 'page', v => { b.scope = v; }));
    kids.push(el('div', { class: 'line' }, el('label', {}, el('input', { type: 'checkbox', checked: b.showLine, onchange: e => { pushHistory(); b.showLine = e.target.checked; changed(); } }), ' Also draw the line itself in the exported PDF')));
  }

  const more = el('details', { open: state.moreOpen }, el('summary', {}, 'More options'));
  more.addEventListener('toggle', () => { state.moreOpen = more.open; });
  for (const s of MORE) more.append(slider(s));
  more.append(el('div', { class: 'line' }, el('label', {}, el('input', { type: 'checkbox', checked: st.avoidOverlap, onchange: e => { if (b) pushHistory(); st.avoidOverlap = e.target.checked; changed(); } }), ' Skip critters that would overlap')));
  kids.push(more);

  if (b) kids.push(el('div', { class: 'line' },
    el('button', { onclick: () => { pushHistory(); const c = structuredClone(b); c.id = state.nextId++; c.pts = c.pts.map(p => [p[0] + 14, p[1] + 14]); c.page = state.page; state.borders.push(c); state.selected = c.id; changed(); } }, 'Duplicate'),
    el('button', { onclick: () => { pushHistory(); b.pts = b.pts.slice().reverse(); changed(); }, title: 'Reverse the direction of travel' }, 'Reverse'),
    el('button', { onclick: () => { state.defaults = { ...structuredClone(b.settings) }; changed(); }, title: 'Use these settings for new borders' }, 'Make default'),
    el('button', { onclick: () => { pushHistory(); state.borders = state.borders.filter(x => x.id !== b.id); state.selected = null; changed(); } }, 'Delete')));

  kids.push(el('h3', {}, `Borders (${state.borders.length})`));
  kids.push(el('ul', { class: 'blist' }, state.borders.map(x => el('li', { class: x.id === state.selected ? 'sel' : '', onclick: () => { state.selected = x.id; if (!appliesTo(x, state.page)) { state.page = x.page; showPage(); } else changed(); } },
    el('span', {}, describe(x)),
    el('button', { title: 'Delete', onclick: e => { e.stopPropagation(); pushHistory(); state.borders = state.borders.filter(y => y.id !== x.id); if (state.selected === x.id) state.selected = null; changed(); } }, '×')))));
  if (state.borders.length) kids.push(el('p', { class: 'note' }, 'Select tool: click a critter to reroll just that one, Alt-click to remove it, drag a line to move it.'));

  kids.push(el('h3', {}, 'Project'));
  kids.push(el('div', { class: 'line' },
    el('button', { onclick: saveProject, title: 'Save borders and settings as a small JSON file' }, 'Save borders…'),
    el('button', { onclick: () => $('#projfile').click() }, 'Load borders…'),
    el('input', { type: 'file', id: 'projfile', accept: '.json,application/json', hidden: true, onchange: loadProject })));
  panel.replaceChildren(...kids);
}

// ------------------------------------------------------------------ persistence
const sessionKey = () => `critters:${state.name}:${state.bytes?.length ?? 0}`;
function saveSession() {
  try { localStorage.setItem(sessionKey(), JSON.stringify({ borders: state.borders, nextId: state.nextId })); localStorage.setItem('critters:defaults', JSON.stringify(state.defaults)); } catch { /* storage unavailable */ }
}
function restoreSession() {
  try {
    const d = JSON.parse(localStorage.getItem('critters:defaults') || 'null'); if (d) state.defaults = { ...structuredClone(DEFAULTS), ...d };
    const s = JSON.parse(localStorage.getItem(sessionKey()) || 'null'); if (s) { state.borders = s.borders; state.nextId = s.nextId; }
  } catch { /* ignore */ }
}
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function saveProject() { download(JSON.stringify({ app: 'procgen-critters', version: 1, borders: state.borders, defaults: state.defaults }, null, 1), state.name.replace(/\.pdf$/i, '') + '.critters.json', 'application/json'); }
async function loadProject(e) {
  const f = e.target.files[0]; if (!f) return;
  try { const j = JSON.parse(await f.text()); pushHistory(); state.borders = j.borders || []; state.nextId = Math.max(1, ...state.borders.map(b => b.id + 1)); if (j.defaults) state.defaults = j.defaults; state.selected = null; changed(); }
  catch (err) { showMessage('Could not read that borders file. It should be a .critters.json file saved from this app.'); }
}

async function buildExport(only = 0, onProgress = () => {}) {
  const first = only || 1, last = only || state.numPages, total = last - first + 1;
  async function* pageStream() { // one page at a time, so finished pages' geometry can be freed
    for (let n = first; n <= last; n++) {
      const bs = state.borders.filter(b => appliesTo(b, n));
      onProgress('Placing critters, page ' + n + ' of ' + last, (n - first + 1) / total * 0.9);
      if (!bs.length) continue;
      const page = await state.doc.getPage(n), vp = page.getViewport({ scale: 1 }); page.cleanup();
      const critters = bs.flatMap(b => { const ink = hexToRgb(b.settings.ink || DEFAULT_INK); return placeBorder(b, pageKey(b, n)).map(c => ({ rings: c.rings, ink })); });
      const strokes = bs.filter(b => b.showLine).map(b => { const p = borderPolyline(b); return { pts: p.pts, closed: p.closed, width: 0.6, ink: hexToRgb(b.settings.ink || DEFAULT_INK) }; });
      yield { index: n - 1, toPdf: pt => vp.convertToPdfPoint(pt[0], pt[1]), critters, strokes };
      if (n % 4 === 0) await tick();
    }
  }
  return exportPdf(state.bytes, pageStream(), { ...(only ? { onlyIndex: only - 1 } : {}), total, onProgress: (label, f) => { if (f >= 1) onProgress(label, 0.95); }, yieldUi: tick });
}
state.buildExport = buildExport;
async function doExport(only = 0) {
  if (state.encrypted) { showMessage('This PDF is encrypted, so critters cannot be written into it. Remove the protection first (for example qpdf --decrypt in.pdf out.pdf).', 'warn'); return; }
  const btn = $(only ? '#exportpage' : '#export'), label = btn.textContent; btn.disabled = true; btn.textContent = 'Exporting…';
  const big = state.numPages > 30 && !only;
  try {
    const out = await buildExport(only, (t, f) => { btn.textContent = 'Exporting ' + Math.round(f * 100) + '%'; if (big) showMessage(t, 'info', { progress: f, sticky: true }); });
    download(out, state.name.replace(/\.pdf$/i, '').replace(/ /g, '-') + (only ? `-p${only}` : '') + '-critters.pdf', 'application/pdf');
    if (big) showMessage('Export finished.', 'info');
  }
  catch (err) { console.error(err); showMessage(friendlyPdfError(err, 'export')); }
  btn.disabled = false; btn.textContent = label;
}

// ------------------------------------------------------------------ wiring
async function openFile(f) {
  if (!f) return;
  try { await loadBytes(new Uint8Array(await f.arrayBuffer()), f.name); }
  catch (err) { if (!(err instanceof CancelledError)) { console.error(err); showMessage(friendlyPdfError(err, 'open')); } }
}
state.openFile = openFile;
async function init() {
  $('#open').onclick = () => $('#file').click();
  $('#file').onchange = e => openFile(e.target.files[0]);
  $('#prev').onclick = () => { if (state.page > 1) { state.page--; showPage(); } };
  $('#next').onclick = () => { if (state.page < state.numPages) { state.page++; showPage(); } };
  $('#zoomin').onclick = () => { state.fit = false; state.zoom = Math.min(state.zoom * 1.25, 6); showPage(); };
  $('#zoomout').onclick = () => { state.fit = false; state.zoom = Math.max(state.zoom / 1.25, 0.2); showPage(); };
  $('#zoomfit').onclick = () => { state.fit = true; showPage(); };
  $('#undo').onclick = undo;
  for (const b of [$('#export'), $('#exportpage')]) b.dataset.title = b.title;
  $('#export').onclick = () => doExport();
  $('#exportpage').onclick = () => doExport(state.page);
  $('#helpbtn').onclick = () => toggleHelp(true);
  $('#help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(false); });
  for (const b of document.querySelectorAll('#tools button')) b.onclick = () => setTool(b.dataset.tool);
  window.addEventListener('resize', () => { if (state.fit) showPage(); });
  const stage = $('#stage');
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', e => { e.preventDefault(); openFile(e.dataTransfer.files[0]); });
  setupPointer(); setTool('free');

  const q = new URLSearchParams(location.search);
  if (q.get('pdf')) { try { const r = await fetch(q.get('pdf')); await loadBytes(new Uint8Array(await r.arrayBuffer()), q.get('pdf').split('/').pop()); } catch (err) { showMessage(friendlyPdfError(err, 'open')); await loadBytes(await blankPdf(), 'blank page'); } }
  else await loadBytes(await blankPdf(), 'blank page');
  if (q.get('demo')) { // scripted state for screenshots / smoke tests
    localStorage.clear(); state.borders = []; state.defaults = structuredClone(DEFAULTS);
    const wav = []; for (let i = 0; i <= 60; i++) wav.push([70 + 6 * Math.sin(i / 4) + 14 * Math.sin(i / 11), 700 - i * 10]);
    state.defaults.tags = ['mammal', 'fungus']; addBorder('free', wav);
    state.defaults.tags = ['salamander']; addBorder('rect', [[110, 80], [520, 720]], true);
    if (q.get('demo') === 'export') await doExport();
    document.title = 'demo-ready';
  }
}
init();
