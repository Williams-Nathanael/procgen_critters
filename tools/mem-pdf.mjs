// Peak memory of headless Firefox on a big PDF: open, page through, scroll the thumbnail strip, export all.
// usage: APP_URL=... node tools/ff.mjs tools/mem-pdf.mjs   (PDF=/out/tmp/pdfs/dl/book.pdf to override)
import { execSync } from 'node:child_process';
const base = process.env.APP_URL || 'http://127.0.0.1:4188/app/';
const pdf = process.env.PDF || '/out/tmp/pdfs/dl/book.pdf';
// RSS of our headless Firefox (identified by its throw-away profile dir) and its child processes only
const rssMB = () => { try {
  const rows = execSync('ps -eo pid=,ppid=,rss=,args=').toString().trim().split('\n').map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map(m => ({ pid: +m[1], ppid: +m[2], rss: +m[3], args: m[4] }));
  const mine = new Set(rows.filter(r => /firefox.*--profile \S*ffp-/.test(r.args)).map(r => r.pid));
  let grew = true; while (grew) { grew = false; for (const r of rows) if (!mine.has(r.pid) && mine.has(r.ppid)) { mine.add(r.pid); grew = true; } }
  return rows.filter(r => mine.has(r.pid)).reduce((s, r) => s + r.rss, 0) / 1024;
} catch { return 0; } };
export default async function (ff) {
  let peak = 0, stop = false;
  const sampler = (async () => { while (!stop) { peak = Math.max(peak, rssMB()); await new Promise(r => setTimeout(r, 200)); } })();
  const mark = label => console.log(`${label.padEnd(28)} now ${rssMB().toFixed(0)} MB, peak so far ${peak.toFixed(0)} MB`);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  mark('start');
  try { await ff.goto(base + '?pdf=' + pdf); } catch (e) { if (!/timeout/.test(e.message)) throw e; } // headless Firefox sometimes never reports 'complete'
  await ff.waitFor(`window.__critters.numPages > 1`, 60000); await sleep(1500); mark('opened');
  const N = await ff.eval('window.__critters.numPages');
  for (let i = 0; i < 40; i++) { await ff.eval(`document.querySelector('#next').click(), 1`); await sleep(250); }
  mark('paged 40 pages');
  await ff.eval(`(async () => { const th = document.querySelector('#thumbs'); for (let y = 0; y < th.scrollHeight; y += 600) { th.scrollTop = y; await new Promise(r => setTimeout(r, 120)); } })()`);
  await sleep(1500); mark('scrolled thumbs');
  await ff.eval(`(() => { const s = window.__critters; s.defaults.tags = ['mammal', 'fungus']; document.querySelector('[data-tool=rect]').click(); return 1; })()`);
  const r = await ff.eval(`(() => { const r = document.querySelector('#overlay').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  await ff.dragPath([[r.x + r.w * 0.2, r.y + r.h * 0.3], [r.x + r.w * 0.5, r.y + r.h * 0.5], [r.x + r.w * 0.8, r.y + r.h * 0.7]]);
  await ff.eval(`(() => { const b = window.__critters.borders.at(-1); b.scope = 'all'; return 1; })()`);
  const t0 = Date.now();
  const size = await ff.eval(`window.__critters.buildExport().then(b => { window.__out = new Blob([b]); return b.length; })`);
  console.log(`export all ${N} pages: ${(size / 1048576).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  mark('after export'); stop = true; await sampler;
  console.log(`PEAK ${peak.toFixed(0)} MB`);
}
