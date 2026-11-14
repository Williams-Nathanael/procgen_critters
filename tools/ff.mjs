// Minimal WebDriver-BiDi driver for headless Firefox, for UI smoke tests and screenshots.
// usage: node tools/ff.mjs <script.mjs>   (script default-exports async (ff) => {...})
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function launch({ width = 1400, height = 900, port = 9333 } = {}) {
  const profile = mkdtempSync(join(process.env.FF_TMP || tmpdir(), 'ffp-'));
  const proc = spawn('firefox', ['--headless', '--no-remote', '--profile', profile, `--window-size=${width},${height}`, '--remote-debugging-port', String(port)], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 80; i++) {
    await new Promise(r => setTimeout(r, 250));
    try { ws = new WebSocket(`ws://127.0.0.1:${port}/session`); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); break; } catch { ws = null; }
  }
  if (!ws) { proc.kill(); throw new Error('could not connect to firefox'); }
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.type === 'error' ? rej(new Error(m.error + ': ' + m.message)) : res(m.result); }
    else if (m.method === 'log.entryAdded') logs.push(`[${m.params.level}] ${m.params.text}`);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const my = ++id; pending.set(my, { res, rej }); ws.send(JSON.stringify({ id: my, method, params })); setTimeout(() => { if (pending.has(my)) { pending.delete(my); rej(new Error('timeout in ' + method)); } }, Number(process.env.FF_TIMEOUT) || 30000); });
  if (process.env.FF_DEBUG) console.log('connected');
  await send('session.new', { capabilities: {} });
  await send('session.subscribe', { events: ['log.entryAdded'] });
  const ctx = (await send('browsingContext.getTree')).contexts[0].context;
  const ff = {
    logs,
    goto: url => send('browsingContext.navigate', { context: ctx, url, wait: 'complete' }),
    async eval(expr) {
      const r = await send('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true, serializationOptions: { maxObjectDepth: 6 } });
      if (r.type === 'exception') throw new Error('page exception: ' + r.exceptionDetails.text);
      return unwrap(r.result);
    },
    async waitFor(expr, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ff.eval(expr)) return true; await new Promise(r => setTimeout(r, 150)); } throw new Error('timeout waiting for ' + expr); },
    async shot(file) { const r = await send('browsingContext.captureScreenshot', { context: ctx }); writeFileSync(file, Buffer.from(r.data, 'base64')); return file; },
    // pointer path in viewport pixels: [[x,y],...]; pressed between first and last
    async dragPath(pts, { steps = 1 } = {}) {
      const actions = [{ type: 'pointerMove', x: Math.round(pts[0][0]), y: Math.round(pts[0][1]) }, { type: 'pointerDown', button: 0 }];
      for (const p of pts.slice(1)) actions.push({ type: 'pointerMove', x: Math.round(p[0]), y: Math.round(p[1]), duration: 8 });
      actions.push({ type: 'pointerUp', button: 0 });
      await send('input.performActions', { context: ctx, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions }] });
    },
    async click(x, y, mods = []) {
      const key = mods.map(m => ({ type: 'keyDown', value: m })), keyUp = mods.map(m => ({ type: 'keyUp', value: m }));
      await send('input.performActions', { context: ctx, actions: [
        { type: 'key', id: 'kb', actions: [...key, { type: 'pause', duration: 60 }, ...keyUp] },
        { type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', x: Math.round(x), y: Math.round(y) }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] });
    },
    async close() { try { ws.close(); } catch {} proc.kill(); await new Promise(r => setTimeout(r, 300)); try { rmSync(profile, { recursive: true, force: true }); } catch {} },
  };
  return ff;
}
function unwrap(v) {
  if (!v) return v;
  switch (v.type) {
    case 'undefined': return undefined; case 'null': return null;
    case 'string': case 'boolean': return v.value;
    case 'number': return typeof v.value === 'number' ? v.value : Number(v.value);
    case 'array': return v.value?.map(unwrap);
    case 'object': return Object.fromEntries((v.value || []).map(([k, x]) => [typeof k === 'string' ? k : unwrap(k), unwrap(x)]));
    default: return v.value ?? v.type;
  }
}
if (process.argv[2] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mod = await import(pathToFileURL(resolve(process.argv[2])).href);
  const ff = await launch();
  try { await mod.default(ff); } catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; } finally { if (ff.logs.length) console.log(ff.logs.slice(0, 30).join('\n')); await ff.close(); }
}
