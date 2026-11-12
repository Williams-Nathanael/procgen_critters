// Tiny static server for the app (localhost only). usage: node tools/serve.mjs [--port 4173] [--no-open]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
let port = Number(args[args.indexOf('--port') + 1]) || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') { res.writeHead(302, { Location: '/app/' }); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
});
server.on('error', e => { if (e.code === 'EADDRINUSE' && port < 4200) server.listen(++port, '127.0.0.1'); else throw e; });
server.on('listening', () => {
  const url = `http://127.0.0.1:${port}/app/`;
  console.log(`Procgen Critters running at ${url}  (Ctrl+C to stop)`);
  if (!args.includes('--no-open')) spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
});
server.listen(port, '127.0.0.1');
