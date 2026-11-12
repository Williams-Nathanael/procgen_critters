// Bundle the browser app into app/dist/.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('app/dist', { recursive: true });
await build({ entryPoints: ['src/app/main.js'], bundle: true, format: 'esm', outfile: 'app/dist/main.js', sourcemap: true, target: 'es2022', logLevel: 'warning' });
copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'app/dist/pdf.worker.min.mjs');
console.log('built app/dist');
