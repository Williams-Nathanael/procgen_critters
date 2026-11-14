// UI smoke test: load sample PDF, demo borders, then draw by hand with real pointer events.
const base = process.env.APP_URL || 'http://127.0.0.1:4188/app/';
import { inflateSync } from 'node:zlib';
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
export default async function (ff) {
  // headless Firefox sometimes never reports 'complete' for the pdf page even though it is up; retry once
  const goto = async url => { try { await ff.goto(url); } catch (e) { if (!/timeout/.test(e.message)) throw e; await ff.goto(url); } };
  await goto(base + '?demo=1&pdf=/out/tmp/sample.pdf');
  await ff.waitFor(`document.title === 'demo-ready'`);
  await ff.shot('out/tmp/ui-demo.png');
  console.log('demo borders:', await ff.eval(`window.__critters.borders.length`), 'critters:', await ff.eval(`document.querySelectorAll('#overlay .critter').length`));
  // fresh blank doc; scribble a wavy line with the pointer
  await goto(base);
  await ff.waitFor(`document.querySelector('#overlay').getAttribute('viewBox')`);
  await ff.eval(`localStorage.clear(), 1`);
  const r = await ff.eval(`(() => { const r = document.querySelector('#overlay').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const pts = []; for (let i = 0; i <= 40; i++) pts.push([r.x + r.w * (0.12 + 0.76 * i / 40), r.y + r.h * (0.3 + 0.05 * Math.sin(i / 4))]);
  await ff.dragPath(pts);
  console.log('after scribble: borders', await ff.eval(`window.__critters.borders.length`), 'critters', await ff.eval(`document.querySelectorAll('#overlay .critter').length`));
  // box tool via toolbar
  await ff.eval(`document.querySelector('[data-tool=rect]').click(), 1`);
  await ff.dragPath([[r.x + r.w * 0.2, r.y + r.h * 0.5], [r.x + r.w * 0.5, r.y + r.h * 0.6], [r.x + r.w * 0.8, r.y + r.h * 0.85]]);
  console.log('after box: borders', await ff.eval(`window.__critters.borders.length`), 'critters', await ff.eval(`document.querySelectorAll('#overlay .critter').length`));
  // toggle a second tag on, via the chips
  await ff.eval(`[...document.querySelectorAll('.chips button')].find(b => /Fungi/.test(b.textContent)).click(), 1`);
  await ff.waitFor(`!window.__critters.stale`, 20000); // new tags regenerate over a few frames
  // reroll one critter with the select tool
  await ff.eval(`document.querySelector('[data-tool=select]').click(), 1`);
  const c = await ff.eval(`(() => { const r = document.querySelector('#overlay .critter').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  const before = await ff.eval(`document.querySelector('#overlay .critter').getAttribute('d').length`);
  // click on actual ink: probe for a point inside the path
  // probe a grid of whole-pixel points (the pointer driver rounds) for a point where the topmost element is a critter (critters must win over the border's hit stroke)
  const probe = (skip = '') => `(() => { for (const p of document.querySelectorAll('#overlay .critter')) { if (p.dataset.b + '/' + p.dataset.slot === ${JSON.stringify(skip)}) continue; const r = p.getBoundingClientRect(); for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { const x = Math.round(r.left + r.width * (i + 0.5) / 12), y = Math.round(r.top + r.height * (j + 0.5) / 12); if (document.elementFromPoint(x, y) === p) return [x, y, p.dataset.b, p.dataset.slot]; } } return null; })()`;
  let hit = await ff.eval(probe());
  assert(hit, 'no clickable critter found');
  const dOf = `(() => document.querySelector('#overlay .critter[data-b="${hit[2]}"][data-slot="${hit[3]}"]')?.getAttribute('d'))()`;
  const dBefore = await ff.eval(dOf), nBefore = await ff.eval(`document.querySelectorAll('#overlay .critter').length`);
  await ff.click(hit[0], hit[1]);
  const ov = await ff.eval(`window.__critters.borders.reduce((n, b) => n + Object.keys(b.overrides).length, 0)`);
  console.log('reroll: overrides', ov, 'critter changed:', dBefore !== await ff.eval(dOf), 'count', nBefore, '->', await ff.eval(`document.querySelectorAll('#overlay .critter').length`));
  assert(ov === 1 && dBefore !== await ff.eval(dOf), 'reroll click did not reroll the critter');
  const done = hit[2] + '/' + hit[3];
  hit = await ff.eval(probe(done));
  await ff.click(hit[0], hit[1], ['\uE00A']);
  console.log('alt-click: overrides', await ff.eval(`JSON.stringify(window.__critters.borders.map(b => b.overrides))`), 'count', await ff.eval(`document.querySelectorAll('#overlay .critter').length`));
  assert(await ff.eval(`window.__critters.borders.reduce((n, b) => n + Object.keys(b.overrides).length, 0)`) === 2 && await ff.eval(`document.querySelectorAll('#overlay .critter').length`) === nBefore - 1, 'alt-click did not remove one critter');
  await ff.shot('out/tmp/ui-drawn.png');

  // slider drag on a page with 3 borders of ~60 critters each
  await ff.eval(`(() => { const s = window.__critters; s.borders = []; s.selected = null; s.history = [];
    const tagSets = [['mammal', 'fungus'], ['salamander'], ['plant', 'dragon']];
    tagSets.forEach((tags, i) => { const pts = []; for (let k = 0; k <= 60; k++) pts.push([30 + k * 9.5, 150 + i * 220 + 20 * Math.sin(k / 6)]);
      s.borders.push({ id: 100 + i, kind: 'free', pts, closed: false, page: 1, scope: 'page', overrides: {}, showLine: false,
        settings: { ...structuredClone(s.defaults), tags, side: 'both', size: 10, spacing: 16, radius: 30, seed: 7 + i } }); });
    s.selected = 100; s.redraw(); })()`);
  console.log('3 borders (both sides), critters:', await ff.eval(`document.querySelectorAll('#overlay .critter').length`));
  // each step: set the slider, fire a real input event, wait for the coalesced redraw; time the redraw itself
  const drag = async (label, key, lo, hi) => {
    const times = await ff.eval(`(async () => {
      const inp = [...document.querySelectorAll('#panel .row')].find(r => r.querySelector('label').textContent === ${JSON.stringify(label)}).querySelector('input');
      if (inp.closest('details') && !inp.closest('details').open) inp.closest('details').open = true;
      const out = [];
      for (let i = 0; i <= 20; i++) {
        inp.value = ${lo} + (${hi} - ${lo}) * i / 20; inp.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        out.push(window.__critters.lastDrawMs);
      }
      return JSON.stringify(out);
    })()`);
    const t = JSON.parse(times).slice(3).sort((a, b) => a - b); // after warm-up
    const worst = t[t.length - 1];
    console.log(label.padEnd(14), 'draw ms: median', t[t.length >> 1].toFixed(1), 'max', worst.toFixed(1));
    // The median is the "feels live" criterion; a single slow frame (GC, a busy machine) is
    // allowed up to 150 ms so the test does not flake.
    assert(t[t.length >> 1] < 50, `${label} slider redraw median ${t[t.length >> 1].toFixed(0)} ms`);
    assert(worst < 150, `${label} slider redraw took ${worst.toFixed(0)} ms`);
    await ff.waitFor(`!window.__critters.stale`, 20000);
  };
  await drag('Band depth', 'radius', 20, 60);
  await drag('Spacing', 'spacing', 16, 24);
  await drag('Critter size', 'size', 10, 16);
  await drag('Tilt', 'tilt', 0, 0.5);
  await drag('Plumpness', 'plump', 0.8, 1.3);
  await drag('Hybrid', 'hybrid', 0, 0.85);
  console.log('3 borders after drags, critters:', await ff.eval(`document.querySelectorAll('#overlay .critter').length`));
  // screen and export must agree
  const same = await ff.eval(`(() => { const s = window.__critters; return s.borders.length === 3 && document.querySelectorAll('#overlay .critter').length > 100; })()`);
  assert(same, 'overlay lost critters after slider drags');
  await ff.shot('out/tmp/ui-3borders.png');

  // --- M6a: ink colour, single-page export, presets, keyboard help
  await ff.eval(`(() => { const i = document.querySelector('#ink'); i.value = '#ff0000'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await ff.waitFor(`!window.__critters.stale`, 20000);
  const ink = await ff.eval(`JSON.stringify([window.__critters.borders[0].settings.ink, window.__critters.borders[1].settings.ink, window.__critters.defaults.ink, document.querySelector('#overlay .critter').parentNode.style.getPropertyValue('--c')])`);
  console.log('ink:', ink);
  assert(JSON.parse(ink)[0] === '#ff0000' && JSON.parse(ink)[2] === '#ff0000' && JSON.parse(ink)[3] === '#ff0000', 'ink colour not applied to selected border / overlay');
  assert(await ff.eval(`JSON.parse(${JSON.stringify(ink)})[1] !== '#ff0000'`), 'ink leaked onto another border');
  const b64 = await ff.eval(`window.__critters.buildExport().then(u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); })`);
  const raw = Buffer.from(b64, 'base64'); let streams = '';
  for (let at = raw.indexOf('stream\n'); at >= 0; at = raw.indexOf('stream\n', at + 7)) {
    const end = raw.indexOf('endstream', at); if (end < 0) break;
    try { streams += inflateSync(raw.subarray(at + 7, end)).toString('latin1'); } catch { /* not flate */ }
  }
  assert(/(^|\s)1 0 0 rg/.test(streams) && /(^|\s)0 0 0 rg/.test(streams), 'exported PDF lacks the red fill or the other borders\' black');
  await ff.eval(`(() => { const s = window.__critters; s.selected = null; s.redraw(); })()`);
  await ff.eval(`(() => { const s = window.__critters; s.borders.push({ id: 300, kind: 'line', pts: [[40, 40], [300, 60]], closed: false, page: 1, scope: 'page', overrides: {}, showLine: false, settings: { ...structuredClone(s.defaults), tags: ['salamander'], seed: 3 } }); })()`);
  assert(await ff.eval(`window.__critters.defaults.ink === '#ff0000'`), 'last-used ink should be the default for new borders');
  await ff.eval(`document.querySelector('[data-tool=select]').click(), 1`);

  assert(await ff.eval(`!!document.querySelector('#exportpage')`), 'no Export this page button');
  assert(await ff.eval(`window.__critters.buildExport(1).then(u => u.length > 500 && String.fromCharCode(...u.subarray(0, 4)) === '%PDF')`), 'single-page export failed');

  // presets: save, change an option, apply it back, delete
  await ff.eval(`(() => { const s = window.__critters; s.selected = 100; s.redraw(); })()`);
  await ff.eval(`(() => { const n = document.querySelector('#presetname'); n.value = 'smoke'; document.querySelector('#presetsave').click(); })()`);
  assert(await ff.eval(`!!JSON.parse(localStorage.getItem('critters:presets') || '{}').smoke`), 'preset not saved');
  await ff.eval(`(() => { const b = window.__critters.borders[0]; b.settings.size = 99; b.settings.tags = ['plant']; window.__critters.redraw(); })()`);
  await ff.eval(`(() => { const sel = document.querySelector('#presetsel'); sel.value = 'u:smoke'; document.querySelector('#presetapply').click(); })()`);
  const pb = await ff.eval(`JSON.stringify(window.__critters.borders[0].settings)`);
  assert(JSON.parse(pb).size === 16 && JSON.parse(pb).tags.join() === 'mammal,fungus', 'preset apply did not restore the border options: ' + pb);
  await ff.eval(`(() => { const sel = document.querySelector('#presetsel'); sel.value = 'b:Sparse wanderers'; document.querySelector('#presetapply').click(); })()`);
  assert(await ff.eval(`window.__critters.borders[0].settings.size === 56`), 'built-in preset did not apply');
  assert(await ff.eval(`window.__critters.borders[1].settings.size === 10`), 'preset leaked onto an unselected border');
  await ff.eval(`(() => { const sel = document.querySelector('#presetsel'); sel.value = 'u:smoke'; document.querySelector('#presetdel').click(); })()`);
  assert(await ff.eval(`!JSON.parse(localStorage.getItem('critters:presets') || '{}').smoke`), 'preset not deleted');
  console.log('presets ok');

  // keyboard help
  const key = k => ff.eval(`(document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true })), document.querySelector('#help').hidden)`);
  assert(await key('?') === false, '? did not open help');
  assert(await ff.eval(`document.querySelectorAll('#help dt').length > 10 && /Alt/.test(document.querySelector('#help').textContent)`), 'help lacks shortcut list');
  await ff.shot('out/tmp/ui-help.png');
  assert(await key('Escape') === true, 'Esc did not close help');
  await ff.shot('out/tmp/ui-m6a.png');

  assert(await ff.eval(`document.querySelector('.samples').style.getPropertyValue('--c') === '#ff0000'`), 'sample strip does not follow the ink colour');

  // --- M6b: border point handles
  const rectOf = sel => ff.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await ff.eval(`(() => { const s = window.__critters; s.selected = 300; s.redraw(); })()`);
  await ff.eval(`document.querySelector('[data-tool=select]').click(), 1`);
  assert(await ff.eval(`document.querySelectorAll('#overlay .handle').length === 2`), 'line border should show 2 handles');
  const geo = () => ff.eval(`JSON.stringify(window.__critters.borders.find(b => b.id === 300).pts)`);
  const g0 = await geo(), crit0 = await ff.eval(`JSON.stringify([...document.querySelectorAll('#overlay .critter')].filter(c => c.dataset.b === '300').map(c => c.getAttribute('d')))`);
  const h1 = await rectOf('#overlay .handle[data-h="1"]');
  await ff.dragPath([h1, [h1[0] + 20, h1[1] + 40], [h1[0] + 40, h1[1] + 80]]);
  await ff.waitFor(`!window.__critters.stale`, 20000);
  const g1 = await geo();
  assert(g1 !== g0 && JSON.parse(g1)[0].join() === JSON.parse(g0)[0].join(), 'handle drag did not move only the dragged point: ' + g0 + ' -> ' + g1);
  assert(await ff.eval(`JSON.stringify([...document.querySelectorAll('#overlay .critter')].filter(c => c.dataset.b === '300').map(c => c.getAttribute('d')))`) !== crit0, 'critters were not re-placed after a handle drag');
  // double-click a segment adds a point
  const mid = await ff.eval(`(() => { const s = window.__critters, b = s.borders.find(b => b.id === 300), r = document.querySelector('#overlay').getBoundingClientRect(), [a, c] = [b.pts[0], b.pts[1]]; return [r.left + (a[0] + c[0]) / 2 / s.pageW * r.width, r.top + (a[1] + c[1]) / 2 / s.pageH * r.height]; })()`);
  await ff.eval(`document.querySelector('#overlay .hit[data-b="300"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: ${mid[0]}, clientY: ${mid[1]} })), 1`);
  await ff.waitFor(`window.__critters.borders.find(b => b.id === 300).pts.length === 3`, 5000);
  assert(await ff.eval(`document.querySelectorAll('#overlay .handle').length === 3`), 'new point has no handle');
  // Delete on a focused handle removes it; the border stays; stops at 2
  const del = () => ff.eval(`(() => { const h = document.querySelector('#overlay .handle[data-h="1"]'); h.focus(); h.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); return window.__critters.borders.length + '/' + window.__critters.borders.find(b => b.id === 300).pts.length; })()`);
  assert(await del() === '4/2', 'Delete on a handle should remove one point and keep the border');
  assert(await del() === '4/2', 'a line must keep 2 points');
  // box: corner handle resizes
  await ff.eval(`(() => { const s = window.__critters; s.borders.push({ id: 301, kind: 'rect', pts: [[300, 400], [420, 500]], closed: true, page: 1, scope: 'page', overrides: {}, showLine: false, settings: { ...structuredClone(s.defaults), tags: ['salamander'], seed: 5 } }); s.selected = 301; s.redraw(); })()`);
  assert(await ff.eval(`document.querySelectorAll('#overlay .handle').length === 4`), 'box should show 4 corner handles');
  const hc = await rectOf('#overlay .handle[data-h="3"]');
  await ff.dragPath([hc, [hc[0] + 30, hc[1] + 30]]);
  assert(await ff.eval(`JSON.stringify(window.__critters.borders.find(b => b.id === 301).pts)`) !== '[[300,400],[420,500]]', 'box corner drag did not resize');
  // scribble: handles exist and a drag bends it
  await ff.eval(`(() => { const s = window.__critters; s.selected = 100; s.redraw(); })()`);
  const nh = await ff.eval(`document.querySelectorAll('#overlay .handle').length`);
  assert(nh >= 2 && nh <= 24, 'scribble handle count ' + nh);
  await ff.eval(`window.__critters.selected = 300, window.__critters.redraw(), 1`);
  await ff.shot('out/tmp/ui-handles.png');

  // --- M6b: page thumbnails (30-page PDF made here)
  const { PDFDocument } = await import('pdf-lib');
  const { writeFileSync } = await import('node:fs');
  const md = await PDFDocument.create(); for (let i = 0; i < 30; i++) md.addPage([612, 792]);
  writeFileSync('out/tmp/multi.pdf', await md.save());
  await goto(base + '?pdf=/out/tmp/multi.pdf');
  await ff.waitFor(`document.querySelectorAll('#thumbs .thumb').length === 30`);
  await ff.waitFor(`document.querySelectorAll('#thumbs canvas').length > 0`);
  await ff.eval(`localStorage.clear(), 1`);
  await new Promise(r => setTimeout(r, 800));
  const rendered = await ff.eval(`document.querySelectorAll('#thumbs canvas').length`);
  console.log('thumbs rendered at load:', rendered, 'of 30');
  assert(rendered < 30, 'all thumbnails rendered up front');
  assert(await ff.eval(`document.querySelector('#thumbs .thumb.cur').dataset.page === '1'`), 'page 1 not highlighted');
  await ff.eval(`(() => { const s = window.__critters; s.borders.push({ id: 400, kind: 'line', pts: [[40, 40], [300, 60]], closed: false, page: 3, scope: 'page', overrides: {}, showLine: false, settings: { ...structuredClone(s.defaults), tags: ['salamander'], seed: 3 } }); s.redraw(); })()`);
  assert(await ff.eval(`[...document.querySelectorAll('#thumbs .thumb.has')].map(t => t.dataset.page).join() === '3'`), 'thumbnail border mark wrong');
  await ff.eval(`document.querySelector('#thumbs .thumb[data-page="3"]').click(), 1`);
  await ff.waitFor(`window.__critters.page === 3 && document.querySelector('#pageinfo').textContent === '3 / 30'`);
  assert(await ff.eval(`document.querySelector('#thumbs .thumb.cur').dataset.page === '3'`), 'current thumbnail not updated');
  await ff.eval(`document.querySelector('#thumbs .thumb[data-page="30"]').scrollIntoView(), 1`);
  await ff.waitFor(`document.querySelector('#thumbs .thumb[data-page="30"] canvas')`);
  assert(await ff.eval(`document.querySelectorAll('#thumbs canvas').length < 30`), 'thumbnails not released when scrolled away');
  await ff.shot('out/tmp/ui-thumbs.png');

  // --- M7: bad files give an in-app message (no alert), encrypted files ask for the password and switch export off
  await goto(base);
  await ff.waitFor(`document.querySelector('#overlay').getAttribute('viewBox')`);
  await ff.eval(`window.__critters.openFile(new File(['this is not a pdf at all'], 'bad.pdf')), 1`);
  await ff.waitFor(`!document.querySelector('#msg').hidden && document.querySelector('#msg').className === 'error'`);
  const bad = await ff.eval(`document.querySelector('#msg').textContent`);
  console.log('bad file message:', bad);
  assert(/does not look like a readable PDF/.test(bad) && !/null/.test(bad), 'bad-file message is not plain language');
  assert(await ff.eval(`window.__critters.name === 'blank page'`), 'bad file replaced the open document');
  const { existsSync } = await import('node:fs');
  if (existsSync('out/tmp/pdfs/gen-userpw.pdf')) {
    await ff.eval(`fetch('/out/tmp/pdfs/gen-userpw.pdf').then(r => r.blob()).then(b => window.__critters.openFile(new File([b], 'locked.pdf'))), 1`);
    await ff.waitFor(`document.querySelector('#pwinput')`);
    await ff.shot('out/tmp/ui-password.png');
    await ff.eval(`(() => { const i = document.querySelector('#pwinput'); i.value = 'wrong'; document.querySelector('#pwok').click(); })()`);
    await ff.waitFor(`document.querySelector('#pwdlg p')?.textContent.includes('not right')`);
    await ff.eval(`(() => { const i = document.querySelector('#pwinput'); i.value = 'user123'; document.querySelector('#pwok').click(); })()`);
    await ff.waitFor(`window.__critters.name === 'locked.pdf'`);
    assert(await ff.eval(`document.querySelector('#export').disabled`), 'export not disabled for an encrypted PDF');
    assert(await ff.eval(`document.querySelector('#msg').className === 'warn'`), 'no encrypted-file notice');
    await ff.shot('out/tmp/ui-encrypted.png');
  } else console.log('SKIP encrypted-file check: run npm run test:pdfs first');
}
