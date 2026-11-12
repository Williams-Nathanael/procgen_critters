// Export through the real browser code path (pdf.js coordinate mapping), incl. a rotated, cropped page.
import { writeFileSync } from 'node:fs';
const base = process.env.APP_URL || 'http://127.0.0.1:4188/app/';
export default async function (ff) {
  for (const name of ['sample.pdf', 'rotated.pdf']) {
    await ff.goto(base + '?demo=1&pdf=/out/tmp/' + name);
    await ff.waitFor(`document.title === 'demo-ready'`);
    const b64 = await ff.eval(`window.__critters.buildExport().then(u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); })`);
    writeFileSync('out/tmp/ui-export-' + name, Buffer.from(b64, 'base64'));
    await ff.shot('out/tmp/ui-export-' + name.replace('.pdf', '-screen.png'));
    console.log(name, 'exported bytes', b64.length * 0.75 | 0);
  }
}
