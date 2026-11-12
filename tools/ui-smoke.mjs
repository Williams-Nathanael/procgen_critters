// UI smoke test: load sample PDF, demo borders, then draw by hand with real pointer events.
const base = process.env.APP_URL || 'http://127.0.0.1:4188/app/';
export default async function (ff) {
  await ff.goto(base + '?demo=1&pdf=/out/tmp/sample.pdf');
  await ff.waitFor(`document.title === 'demo-ready'`);
  await ff.shot('out/tmp/ui-demo.png');
  console.log('demo borders:', await ff.eval(`window.__critters.borders.length`), 'critters:', await ff.eval(`document.querySelectorAll('#overlay .critter').length`));
  // fresh blank doc; scribble a wavy line with the pointer
  await ff.goto(base);
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
  // reroll one critter with the select tool
  await ff.eval(`document.querySelector('[data-tool=select]').click(), 1`);
  const c = await ff.eval(`(() => { const r = document.querySelector('#overlay .critter').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  const before = await ff.eval(`document.querySelector('#overlay .critter').getAttribute('d').length`);
  // click on actual ink: probe for a point inside the path
  const hit = await ff.eval(`(() => { const p = document.querySelector('#overlay .critter'); const r = p.getBoundingClientRect(); for (let i = 0; i < 400; i++) { const x = r.left + Math.random() * r.width, y = r.top + Math.random() * r.height; if (document.elementFromPoint(x, y) === p) return [x, y]; } return null; })()`);
  await ff.click(hit[0], hit[1]);
  console.log('reroll changed critter:', before !== await ff.eval(`document.querySelector('#overlay .critter').getAttribute('d').length`), 'overrides', await ff.eval(`JSON.stringify(window.__critters.borders.map(b => Object.keys(b.overrides).length))`));
  await ff.shot('out/tmp/ui-drawn.png');
}
