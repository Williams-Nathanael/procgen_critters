// Browser UI: open a PDF, draw borders, tune settings, export.
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { TAGS, TAG_NAMES } from '../gen/tags.js';
import { ringsToPath } from '../gen/core.js';
import { DEFAULTS, placeBorder, bandOutline, borderPolyline } from '../place.js';
import { exportPdf } from '../export.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./dist/pdf.worker.min.mjs', document.baseURI).href;
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};

const state = {
  name: 'blank page', bytes: null, doc: null, numPages: 1,
  page: 1, zoom: 1, fit: true, pageW: 612, pageH: 792, viewport1: null,
  borders: [], selected: null, tool: 'free',
  defaults: structuredClone(DEFAULTS),
  history: [], nextId: 1, renderToken: 0,
};
window.__critters = state; // handy for debugging from the console

// ------------------------------------------------------------------ document
async function blankPdf() {
  const d = await PDFDocument.create(); d.addPage([612, 792]);
  return d.save();
}
async function loadBytes(bytes, name) {
  const doc = await pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: new URL('../node_modules/pdfjs-dist/cmaps/', document.baseURI).href, cMapPacked: true,
    standardFontDataUrl: new URL('../node_modules/pdfjs-dist/standard_fonts/', document.baseURI).href,
    wasmUrl: new URL('../node_modules/pdfjs-dist/wasm/', document.baseURI).href,
  }).promise;
  state.bytes = bytes; state.doc = doc; state.name = name; state.numPages = doc.numPages; state.page = 1;
  state.borders = []; state.selected = null; state.history = [];
  $('#docname').textContent = name;
  restoreSession();
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
  const vp = page.getViewport({ scale: state.zoom * dpr });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport: vp }).promise;
  if (token !== state.renderToken) return;
  const shown = $('#pdf');
  shown.width = canvas.width; shown.height = canvas.height;
  shown.style.width = vp1.width * state.zoom + 'px'; shown.style.height = vp1.height * state.zoom + 'px';
  shown.getContext('2d').drawImage(canvas, 0, 0);
  $('#overlay').setAttribute('viewBox', `0 0 ${vp1.width} ${vp1.height}`);
  $('#pageinfo').textContent = `${state.page} / ${state.numPages}`;
  $('#prev').disabled = state.page <= 1; $('#next').disabled = state.page >= state.numPages;
  drawOverlay(); drawPanel();
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
  const h = state.history.pop(); if (!h) return;
  const s = JSON.parse(h); state.borders = s.borders; state.selected = s.selected;
  changed();
}
function changed() { drawOverlay(); drawPanel(); saveSession(); }

function addBorder(kind, pts, closed = false) {
  pushHistory();
  const b = { id: state.nextId++, kind, pts, closed, page: state.page, scope: state.defaults.scope ?? 'page', settings: structuredClone(state.defaults), overrides: {}, showLine: false };
  delete b.settings.scope;
  b.settings.seed = Math.floor(Math.random() * 100000);
  state.borders.push(b); state.selected = b.id;
  changed();
}

// ------------------------------------------------------------------ overlay
let placedNow = []; // [{border, items}]
function polyD(pts, closed) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + (closed ? 'Z' : ''); }
function drawOverlay(draft = null) {
  const svg = $('#overlay'); let h = '';
  placedNow = [];
  for (const b of state.borders) {
    if (!appliesTo(b, state.page)) continue;
    const sel = b.id === state.selected;
    const poly = borderPolyline(b);
    if (sel) for (const band of bandOutline(b)) h += `<path class="band" d="${polyD(band.line.concat(band.off.slice().reverse()), true)}"/>`;
    let items = [];
    try { items = placeBorder(b, pageKey(b, state.page)); } catch (e) { console.error(e); }
    placedNow.push({ border: b, items });
    for (const it of items) h += `<path class="critter" data-b="${b.id}" data-slot="${it.slot}" d="${ringsToPath(it.rings, null, 2)}"/>`;
    h += `<path class="bline${sel ? ' sel' : ''}" d="${polyD(poly.pts, poly.closed)}"/><path class="hit" data-b="${b.id}" d="${polyD(poly.pts, poly.closed)}"/>`;
  }
  if (draft) h += `<path class="draft" d="${draft}"/>`;
  svg.innerHTML = h;
  svg.classList.toggle('draw', state.tool !== 'select');
  svg.classList.toggle('pick', state.tool === 'select');
  const n = state.borders.length;
  $('#hint').textContent = n ? '' : 'Draw a border on the page: scribble a line, or pick Box / Oval. Critters appear along it; tune them on the right.';
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
      const t = e.target;
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
  svg.addEventListener('dblclick', finishPoly);
  window.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
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
    if (d.mode === 'move') { if (!d.moved) state.history.pop(); changed(); return; }
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
  ['plump', 'Plumpness', 0.7, 1.4, 0.01, v => v.toFixed(2)],
];

function slider([key, label, min, max, step, fmt, title]) {
  const st = target();
  const out = el('output', {}, fmt(st[key]));
  const input = el('input', { type: 'range', min, max, step, value: st[key], title: title || label,
    onpointerdown: () => { if (selected()) pushHistory(); },
    oninput: e => { target()[key] = +e.target.value; out.textContent = fmt(+e.target.value); drawOverlay(); },
    onchange: () => saveSession() });
  return el('div', { class: 'row' }, el('label', {}, label), input, out);
}
function seg(options, get, set) {
  return el('div', { class: 'seg' }, options.map(([v, label]) => el('button', { class: get() === v ? 'on' : '', onclick: () => { if (selected()) pushHistory(); set(v); changed(); } }, label)));
}

function describe(b) {
  const kind = { free: b.closed ? 'Loop' : 'Scribble', line: 'Line', rect: 'Box', ellipse: 'Oval' }[b.kind];
  const where = (b.scope ?? 'page') === 'page' ? `p.${b.page}` : `${b.scope} pages`;
  return `${kind} · ${b.settings.tags.map(t => t.slice(0, 4)).join('+') || 'no tags'} · ${where}`;
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
  catch (err) { alert('Could not read that file: ' + err.message); }
}

async function buildExport() {
  const pages = [];
  for (let n = 1; n <= state.numPages; n++) {
    const bs = state.borders.filter(b => appliesTo(b, n)); if (!bs.length) continue;
    const vp = (await state.doc.getPage(n)).getViewport({ scale: 1 });
    const critters = bs.flatMap(b => placeBorder(b, pageKey(b, n)));
    const strokes = bs.filter(b => b.showLine).map(b => { const p = borderPolyline(b); return { pts: p.pts, closed: p.closed, width: 0.6 }; });
    pages.push({ index: n - 1, toPdf: pt => vp.convertToPdfPoint(pt[0], pt[1]), critters, strokes });
  }
  return exportPdf(state.bytes, pages);
}
state.buildExport = buildExport;
async function doExport() {
  const btn = $('#export'); btn.disabled = true; btn.textContent = 'Exporting…';
  try { download(await buildExport(), state.name.replace(/\.pdf$/i, '').replace(/ /g, '-') + '-critters.pdf', 'application/pdf'); }
  catch (err) { console.error(err); alert('Export failed: ' + err.message); }
  btn.disabled = false; btn.textContent = 'Export PDF';
}

// ------------------------------------------------------------------ wiring
async function openFile(f) {
  if (!f) return;
  try { await loadBytes(new Uint8Array(await f.arrayBuffer()), f.name); }
  catch (err) { console.error(err); alert('Could not open that PDF: ' + err.message); }
}
async function init() {
  $('#open').onclick = () => $('#file').click();
  $('#file').onchange = e => openFile(e.target.files[0]);
  $('#prev').onclick = () => { if (state.page > 1) { state.page--; showPage(); } };
  $('#next').onclick = () => { if (state.page < state.numPages) { state.page++; showPage(); } };
  $('#zoomin').onclick = () => { state.fit = false; state.zoom = Math.min(state.zoom * 1.25, 6); showPage(); };
  $('#zoomout').onclick = () => { state.fit = false; state.zoom = Math.max(state.zoom / 1.25, 0.2); showPage(); };
  $('#zoomfit').onclick = () => { state.fit = true; showPage(); };
  $('#undo').onclick = undo;
  $('#export').onclick = doExport;
  for (const b of document.querySelectorAll('#tools button')) b.onclick = () => setTool(b.dataset.tool);
  window.addEventListener('resize', () => { if (state.fit) showPage(); });
  const stage = $('#stage');
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', e => { e.preventDefault(); openFile(e.dataTransfer.files[0]); });
  setupPointer(); setTool('free');

  const q = new URLSearchParams(location.search);
  if (q.get('pdf')) { const r = await fetch(q.get('pdf')); await loadBytes(new Uint8Array(await r.arrayBuffer()), q.get('pdf').split('/').pop()); }
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
