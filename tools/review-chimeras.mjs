// Builds the M8 phase 3 chimera taste-check page: out/review-chimeras/index.html plus sprites.
// usage: npm run review:chimeras   (--seed N to change the seed family, --skip-sprites to rewrite only the page)
// Open out/review-chimeras/index.html. Marks save in the browser (and to the page database when hosted).
import { mkdirSync, writeFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TAG_NAMES, TAGS } from '../src/gen/tags/index.js';
import { sheetSvg } from './sheet-lib.mjs';

// Optional overseer note per tag, shown under the tag heading. Leave '' for none.
const NOTES = {
  salamander: '', amphibian: '', arthropod: '', fungus: '', mammal: '', dragon: '', plant: '', jansson: '',
};


const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Chimera Taste Check</title>
<style>
:root{--bg:#f3f1ea;--panel:#faf9f5;--ink:#1d1d1b;--muted:#625f57;--rule:#cfcabd;--accent:#8a3b12;--focus:#1a5fb4;--fav:#245c2e;--rej:#8c1d1d;--paper:#fff;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#191917;--panel:#222220;--ink:#e9e6dc;--muted:#a29e92;--rule:#403e38;--accent:#e0a070;--focus:#7db3ff;--fav:#7fc58a;--rej:#e58a8a;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-right,0px)) 80px max(16px,env(safe-area-inset-left,0px))}
header.top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--rule);padding:8px 0 6px;margin:0 0 16px}
.topline{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 16px}
h1{font-size:1.15rem;margin:0}
#status{color:var(--muted);font-size:.85rem;margin-left:auto}
nav{display:flex;gap:4px 14px;overflow-x:auto;padding:6px 0 2px;white-space:nowrap}
nav a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--rule);padding:2px 0}
button:focus-visible,input:focus-visible,textarea:focus-visible,.cell:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.intro{max-width:44rem;margin:0 0 20px}
section{margin:0 0 36px;scroll-margin-top:90px}
h2{font-size:1rem;text-transform:uppercase;letter-spacing:.1em;margin:0 0 4px;padding-bottom:4px;border-bottom:2px solid var(--ink)}
.sub{color:var(--muted);margin:4px 0 10px;font-size:.9rem}
.note{background:var(--panel);border-left:3px solid var(--accent);padding:6px 10px;margin:8px 0;font-size:.9rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(60px,1fr));gap:4px;max-width:520px;margin:8px 0}
.cell{position:relative;aspect-ratio:1;width:100%;max-width:60px;background-color:var(--paper);background-repeat:no-repeat;border:2px solid transparent;padding:0;cursor:pointer;image-rendering:auto}
.cell[data-v="fav"]{border-color:var(--fav);box-shadow:inset 0 0 0 1px var(--fav)}
.cell[data-v="rej"]{border-color:var(--rej);opacity:.45}
.cell[data-v="fav"]::after{content:"\\2605";position:absolute;right:1px;top:-2px;color:var(--fav);font-size:13px}
.cell[data-v="rej"]::after{content:"\\2715";position:absolute;right:2px;top:-1px;color:var(--rej);font-size:13px;font-weight:700}
.ctl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}
.ctl button,.copybtn{font:inherit;font-size:.85rem;background:transparent;color:var(--ink);border:1px solid var(--muted);border-radius:2px;padding:3px 9px;min-height:32px;cursor:pointer}
.ctl button::before{content:"\\25CB\\00a0"}
.ctl button[aria-pressed="true"]::before{content:"\\25CF\\00a0"}
.ctl button[aria-pressed="true"]{font-weight:700;border-width:2px;padding:2px 8px}
.ctl button[data-v="ready"],.ctl button[data-v="keep"]{--c:var(--fav)}
.ctl button[data-v="more"],.ctl button[data-v="retry"]{--c:var(--accent)}
.ctl button[data-v="wrong"],.ctl button[data-v="cut"]{--c:var(--rej)}
.ctl button[aria-pressed="true"]{color:var(--c);border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent)}
textarea,input[type=text]{font:inherit;width:100%;background:var(--panel);color:var(--ink);border:1px solid var(--muted);border-radius:2px;padding:5px 7px}
textarea{min-height:56px;resize:vertical}
label.l{display:block;font-size:.85rem;color:var(--muted);margin:6px 0 3px}
.scroll{overflow-x:auto;max-width:100%;background:var(--paper);border:1px solid var(--rule);margin:6px 0}
.strip{height:60px;background-repeat:no-repeat;background-color:var(--paper)}
.item{border-top:1px solid var(--rule);padding:10px 0}
.item h3{margin:0;font-size:1rem}
.copybtn{border-color:var(--accent);color:var(--accent);font-weight:600}
#copy-fallback{display:none;margin-top:8px;min-height:160px;font:12px/1.4 ui-monospace,Menlo,monospace}
</style></head><body>
<div class="wrap">
<header class="top"><div class="topline"><h1>Chimera Taste Check</h1><span id="progress"></span><span id="status" role="status" aria-live="polite"></span></div><nav id="nav" aria-label="Sections"></nav></header>
<p class="intro">Full chimeras (hybrid 100%), print size. Tap a creature to cycle: none, favourite, reject. Then a verdict per tag. Answers save as you go.</p>
<main id="main"></main>
<section id="sec-end"><h2>Done</h2><p class="ctl"><button type="button" class="copybtn" id="copy-btn">Copy all answers as text</button><span id="copy-msg" role="status"></span></p>
<textarea id="copy-fallback" readonly aria-label="All answers as text"></textarea></section>
</div>
<script>
(function(){
var M = /*MANIFEST*/null;
var LS_KEY = 'critter-chimeras-v1';
var recs = {}, coll = null, chains = {}, timers = {}, ui = {}, known = {};
var $ = function(id){ return document.getElementById(id); };
function el(tag, attrs, kids){ var e = document.createElement(tag); for (var k in (attrs||{})) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } (kids||[]).forEach(function(c){ e.appendChild(c); }); return e; }
function lsLoad(){ try { var s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) || {} : {}; } catch (e) { return {}; } }
function lsSave(){ try { localStorage.setItem(LS_KEY, JSON.stringify(recs)); } catch (e) {} }
function setStatus(k){ $('status').textContent = { saved: 'Saved', saving: 'Saving...', local: 'Saved in this browser only', fail: 'Could not save, use Copy all answers' }[k] || ''; }
function pushDb(id){
  if (!coll) return;
  var prev = chains[id] || Promise.resolve(); setStatus('saving');
  chains[id] = prev.then(function(){ var r = recs[id], ref = coll.doc(id); return r ? ref.set(r) : ref.delete(); }).then(function(){ setStatus('saved'); }, function(){ setStatus('fail'); });
}
function commit(id){ lsSave(); if (coll) pushDb(id); else setStatus('local'); refreshProgress(); }
function change(id, meta, patch){
  var r = recs[id] || { kind: meta.kind, tag: meta.tag, name: meta.name, verdict: '', comment: '', at: 0 };
  for (var k in patch) r[k] = patch[k];
  r.at = Date.now();
  if (!r.verdict && !r.comment) delete recs[id]; else recs[id] = r;
  commit(id);
}
function debounced(id, meta, text){ clearTimeout(timers[id]); setStatus('saving'); ui[id].pending = { meta: meta, text: text }; timers[id] = setTimeout(function(){ flush(id); }, 800); }
function flush(id){ if (!timers[id]) return; clearTimeout(timers[id]); delete timers[id]; var p = ui[id].pending; change(id, p.meta, { comment: p.text.trim() }); }
function area(id, meta, label){
  var ta = el('textarea', { id: 'c-' + id }); ui[id] = ui[id] || { btns: {} }; ui[id].area = ta; known[id] = 1;
  ta.addEventListener('input', function(){ debounced(id, meta, ta.value); }); ta.addEventListener('blur', function(){ flush(id); });
  return el('div', {}, [el('label', { class: 'l', for: 'c-' + id, text: label }), ta]);
}
function verdicts(id, meta, set, label){
  var box = el('div', { class: 'ctl', role: 'group', 'aria-label': label }); ui[id] = ui[id] || { btns: {} }; known[id] = 1;
  set.forEach(function(v){
    var b = el('button', { type: 'button', 'data-v': v[0], 'aria-pressed': 'false', text: v[1], title: v[2] || '' });
    b.addEventListener('click', function(){ var cur = recs[id] ? recs[id].verdict : ''; change(id, meta, { verdict: cur === v[0] ? '' : v[0] }); paint(id); });
    ui[id].btns[v[0]] = b; box.appendChild(b);
  });
  return box;
}
function paint(id){
  var u = ui[id]; if (!u) return; var r = recs[id], v = r ? r.verdict : '';
  for (var k in u.btns) u.btns[k].setAttribute('aria-pressed', String(k === v));
  if (u.area && document.activeElement !== u.area) u.area.value = r ? r.comment : '';
  if (u.cell) { if (v) u.cell.setAttribute('data-v', v); else u.cell.removeAttribute('data-v'); u.cell.setAttribute('aria-label', u.cellName + ', ' + (v === 'fav' ? 'favourite' : v === 'rej' ? 'rejected' : 'unmarked')); }
}
var main = $('main'), nav = $('nav');
function navLink(id, t){ nav.appendChild(el('a', { href: '#' + id, text: t })); }
var NEXT = { '': 'fav', fav: 'rej', rej: '' };
(function build(){
  var ov = el('section', { id: 'sec-overall' });
  ov.appendChild(el('h2', { text: 'Overall' }));
  ov.appendChild(el('p', { class: 'sub', text: 'Is the full-chimera direction right?' }));
  ov.appendChild(verdicts('overall', { kind: 'overall', tag: '', name: 'direction' }, [['keep', 'Yes, right direction', 'The full-chimera direction is right'], ['retry', 'Partly', 'Right idea, needs adjusting'], ['cut', 'No', 'Wrong direction']], 'Is the full-chimera direction right?'));
  ov.appendChild(area('overall-c', { kind: 'overall', tag: '', name: 'direction' }, 'Comment'));
  main.appendChild(ov); navLink('sec-overall', 'overall');
  M.tags.forEach(function(t){
    var sec = el('section', { id: 'sec-' + t.id });
    sec.appendChild(el('h2', { text: t.label }));
    sec.appendChild(el('p', { class: 'sub', text: M.cols * M.rows + ' chimeras at hybrid 1. Tap to cycle none, favourite, reject.' }));
    if (t.note) sec.appendChild(el('p', { class: 'note', text: t.note }));
    var g = el('div', { class: 'grid' });
    for (var i = 0; i < M.cols * M.rows; i++) (function(i){
      var id = 'cell-' + t.id + '-' + i, c = i % M.cols, r = Math.floor(i / M.cols), meta = { kind: 'cell', tag: t.id, name: '#' + (i + 1) };
      var b = el('button', { type: 'button', class: 'cell', title: t.label + ' #' + (i + 1) });
      b.style.backgroundImage = 'url(sprites/chim-' + t.id + '.png)';
      b.style.backgroundSize = (M.cols * 100) + '% ' + (M.rows * 100) + '%';
      b.style.backgroundPosition = (M.cols > 1 ? c * 100 / (M.cols - 1) : 0) + '% ' + (M.rows > 1 ? r * 100 / (M.rows - 1) : 0) + '%';
      ui[id] = { btns: {}, cell: b, cellName: t.label + ' #' + (i + 1) }; known[id] = 1;
      b.addEventListener('click', function(){ var cur = recs[id] ? recs[id].verdict : ''; change(id, meta, { verdict: NEXT[cur] || '' }); paint(id); });
      g.appendChild(b);
    })(i);
    sec.appendChild(g);
    var vm = { kind: 'tag', tag: t.id, name: t.label };
    sec.appendChild(verdicts('tag-' + t.id, vm, [['ready', 'Ready', 'This tag is ready'], ['more', 'Needs more work', 'Direction fine, needs more work'], ['wrong', 'Wrong direction', 'Rethink this tag']], t.label + ' verdict'));
    sec.appendChild(area('tag-' + t.id + '-c', vm, 'Comment on ' + t.label));
    main.appendChild(sec); navLink('sec-' + t.id, t.label);
  });
  var ps = el('section', { id: 'sec-pure' });
  ps.appendChild(el('h2', { text: 'Reworked pure species' }));
  ps.appendChild(el('p', { class: 'sub', text: 'Hybrid 0, 8 seeds each.' }));
  M.pure.forEach(function(p){
    var it = el('div', { class: 'item' }), title = p.name.charAt(0).toUpperCase() + p.name.slice(1) + ' (' + p.tag + ')';
    it.appendChild(el('h3', { text: title })); it.appendChild(el('p', { class: 'sub', text: p.q }));
    var s = el('div', { class: 'strip', role: 'img', 'aria-label': title + ', 8 seeds', style: 'width:' + (M.cell * M.cols) + 'px;background-size:' + (M.cell * M.cols) + 'px 60px;background-image:url(sprites/' + p.sprite + '.png)' });
    it.appendChild(el('div', { class: 'scroll' }, [s]));
    var m = { kind: 'pure', tag: p.tag, name: p.name };
    it.appendChild(verdicts(p.id, m, [['keep', 'Keep'], ['cut', 'Cut'], ['retry', 'Try again']], title + ' verdict'));
    it.appendChild(area(p.id + '-c', m, 'Comment'));
    ps.appendChild(it);
  });
  main.appendChild(ps); navLink('sec-pure', 'pure species'); navLink('sec-end', 'copy');
})();
var total = Object.keys(known).filter(function(i){ return /^(tag-[a-z]+|overall|pure-.*)$/.test(i); }).length;
function refreshProgress(){
  var n = 0, f = 0, r = 0;
  for (var id in recs) { if (!known[id]) continue; var rc = recs[id]; if (rc.kind === 'cell') { if (rc.verdict === 'fav') f++; else if (rc.verdict === 'rej') r++; } else if (rc.verdict) n++; }
  $('progress').textContent = n + ' of ' + total + ' verdicts, ' + f + ' fav, ' + r + ' rej';
}
function paintAll(){ for (var id in ui) paint(id); refreshProgress(); }
function answersText(){
  var lab = { keep: 'KEEP', cut: 'CUT', retry: 'TRY AGAIN', ready: 'READY', more: 'NEEDS MORE WORK', wrong: 'WRONG DIRECTION', fav: 'FAV', rej: 'REJECT' };
  var lines = ['Chimera taste check answers'];
  var v = function(r){ return r.verdict ? lab[r.verdict] || r.verdict : ''; };
  var cm = function(r){ return r.comment ? (r.verdict ? ' | ' : '') + r.comment : ''; };
  var ids = Object.keys(recs);
  var o = recs['overall'], oc = recs['overall-c'];
  if (o || oc) lines.push('', 'Overall: ' + (o ? (o.verdict === 'keep' ? 'right direction' : o.verdict === 'retry' ? 'partly' : 'wrong direction') : '') + (oc ? ' | ' + oc.comment : ''));
  M.tags.forEach(function(t){
    var tv = recs['tag-' + t.id], tc = recs['tag-' + t.id + '-c'];
    var fav = [], rej = [];
    ids.sort().forEach(function(i){ var r = recs[i]; if (r.kind === 'cell' && r.tag === t.id) (r.verdict === 'fav' ? fav : rej).push(r.name); });
    if (!tv && !tc && !fav.length && !rej.length) return;
    lines.push('', t.label + ': ' + (tv ? v(tv) : '(no verdict)') + (tc ? ' | ' + tc.comment : ''));
    if (fav.length) lines.push('  favourites: ' + fav.join(' '));
    if (rej.length) lines.push('  rejects: ' + rej.join(' '));
  });
  var pure = [];
  M.pure.forEach(function(p){ var r = recs[p.id], c = recs[p.id + '-c']; if (r || c) pure.push('- ' + p.tag + ' / ' + p.name + ': ' + (r ? v(r) : '') + (c ? ' | ' + c.comment : '')); });
  if (pure.length) { lines.push('', 'Reworked pure species'); lines.push.apply(lines, pure); }
  return lines.join('\\n');
}
$('copy-btn').addEventListener('click', function(){
  var text = answersText(), msg = $('copy-msg'), fb = $('copy-fallback');
  function fallback(){ fb.value = text; fb.style.display = 'block'; fb.focus(); fb.select(); msg.textContent = 'Select and copy the text below.'; }
  try { if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('no clipboard'); navigator.clipboard.writeText(text).then(function(){ msg.textContent = 'Copied.'; fb.style.display = 'none'; }, fallback); } catch (e) { fallback(); }
});
recs = lsLoad(); Object.keys(recs).forEach(function(i){ if (!known[i]) delete recs[i]; }); paintAll(); setStatus('local');
function adopt(remote){
  var ids = {}; Object.keys(remote).filter(function(i){ return known[i]; }).concat(Object.keys(recs)).forEach(function(i){ ids[i] = 1; });
  Object.keys(ids).forEach(function(i){
    var r = known[i] ? remote[i] : null, l = recs[i];
    if (r && (!l || (r.at || 0) >= (l.at || 0))) recs[i] = r; else if (l && (!r || (l.at || 0) > (r.at || 0))) pushDb(i);
  });
  lsSave(); paintAll();
}
(function connect(){
  var done = false;
  function fail(){ if (done) return; done = true; setStatus('local'); }
  var timer = setTimeout(fail, 10000), p;
  try { p = window.claude && window.claude.use ? window.claude.use('db') : null; } catch (e) { p = null; }
  if (!p) { clearTimeout(timer); fail(); return; }
  p.then(function(d){
    clearTimeout(timer); if (done) return; if (!d) { fail(); return; }
    done = true; coll = d.collection('answers');
    return coll.get().then(function(snap){ var remote = {}; snap.docs.forEach(function(s){ if (s.exists) remote[s.id] = s.data(); }); adopt(remote); setStatus('saved'); }, function(){ coll = null; setStatus('local'); });
  }, fail);
})();
})();
</script></body></html>`;

const argv = process.argv.slice(2);
const skipSprites = argv.includes('--skip-sprites');
const seed = argv.includes('--seed') ? Number(argv[argv.indexOf('--seed') + 1]) : 1;
const OUT = 'out/review-chimeras', SP = OUT + '/sprites', CELL = 60, SCALE = 2, COLS = 8, ROWS = 6;
if (!skipSprites) rmSync(SP, { recursive: true, force: true });
mkdirSync(SP, { recursive: true });

function sprite(file, rows, opt) {
  if (skipSprites) return;
  const svg = sheetSvg(rows, { n: COLS, seed, cell: CELL, detail: 0.3, labels: 0, bg: '#ffffff', scale: SCALE, ...opt });
  const svgPath = `${OUT}/.tmp-${file}.svg`;
  writeFileSync(svgPath, svg);
  execFileSync('magick', ['-density', '96', '-background', 'white', svgPath, '-flatten', `${SP}/${file}.png`]);
  rmSync(svgPath);
  console.log('sprite', file, rows.length, 'rows');
}

const tags = TAG_NAMES.map(t => ({ id: t, label: TAGS[t].label || t, note: NOTES[t] || '' }));
for (const t of tags) sprite('chim-' + t.id, Array(ROWS).fill(t.id), { hybrid: 1 });

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PURE = [
  ['fungus', 'jelly ear', 'Floppy ear fold, reworked.'],
  ['jansson', 'ampersand knot', 'Knot with a visible eye, reworked.'],
  ['dragon', 'amphisbaena', 'Two heads facing out, reworked.'],
].map(([tag, name, q]) => {
  if (!TAGS[tag].species.some(s => s.name === name)) throw new Error('species not found: ' + tag + ' / ' + name);
  return { tag, name, q, id: 'pure-' + tag + '-' + slug(name), sprite: 'pure-' + tag + '-' + slug(name) };
});
for (const p of PURE) sprite(p.sprite, [`${p.tag}@${p.name}`], { hybrid: 0 });

const manifest = { cell: CELL, cols: COLS, rows: ROWS, tags, pure: PURE };
writeFileSync(OUT + '/index.html', PAGE.replace('/*MANIFEST*/null', () => JSON.stringify(manifest)));
for (const f of [...readdirSync(OUT), ...readdirSync(SP).map(x => 'sprites/' + x)]) { const st = statSync(`${OUT}/${f}`); if (st.isFile()) console.log(f.padEnd(28), (st.size / 1024).toFixed(0) + ' KB'); }

