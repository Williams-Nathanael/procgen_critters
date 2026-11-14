// Builds the M3 taste-check page: out/review/index.html plus sprite sheets.
// usage: npm run review   (add --seed N to change the seed family, --skip-sprites to rewrite only the page)
import { mkdirSync, writeFileSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TAG_NAMES, TAGS } from '../src/gen/tags/index.js';
import { sheetSvg } from './sheet-lib.mjs';

const argv = process.argv.slice(2);
const skipSprites = argv.includes('--skip-sprites');
const seed = argv.includes('--seed') ? Number(argv[argv.indexOf('--seed') + 1]) : 1;
const OUT = 'out/review', SP = OUT + '/sprites', CELL = 60, SCALE = 2;
mkdirSync(SP, { recursive: true });

const slug = s => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pairs = [];
for (let i = 0; i < TAG_NAMES.length; i++) for (let j = i + 1; j < TAG_NAMES.length; j++) pairs.push([TAG_NAMES[i], TAG_NAMES[j]]);

function sprite(file, rows, n) {
  if (skipSprites) return;
  const svg = sheetSvg(rows, { n, seed, cell: CELL, detail: 0.3, labels: 0, bg: '#ffffff', scale: SCALE });
  const svgPath = `${OUT}/.tmp-${file}.svg`;
  writeFileSync(svgPath, svg);
  execFileSync('magick', ['-density', '96', '-background', 'white', svgPath, '-flatten', `${SP}/${file}.png`]);
  execFileSync('rm', [svgPath]);
  console.log('sprite', file, rows.length, 'rows');
}
const N_SP = 6, N_MIX = 8;
const tags = TAG_NAMES.map(tag => {
  const species = TAGS[tag].species.map(s => s.name);
  sprite(tag, species.map(s => `${tag}@${s}`), N_SP);
  return { tag, species: species.map(name => ({ name, id: slug(name) })) };
});
for (const t of tags) { const ids = t.species.map(s => s.id); if (new Set(ids).size !== ids.length) throw new Error('duplicate species slug in ' + t.tag); }
sprite('mixes', pairs.map(p => p.join('+')), N_MIX);

const OPEN = [
  { id: 'horned-frog', title: 'Horned frog', rows: [['amphibian', 'horned frog']], complaint: 'The tall brow horn reads as a rabbit ear, so the whole frog reads as a sitting rabbit.' },
  { id: 'flying-frog-surinam-toad', title: 'Flying frog and Surinam toad', rows: [['amphibian', 'flying frog'], ['amphibian', 'Surinam toad']], complaint: 'Both are the same splayed top-view X.' },
  { id: 'beaver', title: 'Beaver', rows: [['mammal', 'beaver']], complaint: 'A flat smear at print size; the paddle tail reads on about 1 seed in 6.' },
  { id: 'grasshopper', title: 'Grasshopper', rows: [['arthropod', 'grasshopper']], complaint: 'A thin dash.' },
  { id: 'mantis-shrimp', title: 'Mantis shrimp', rows: [['arthropod', 'mantis shrimp']], complaint: 'Still reads as a caterpillar tube.' },
  { id: 'chicken-of-the-woods', title: 'Chicken of the woods', rows: [['fungus', 'chicken of the woods']], complaint: 'A scribbled blob.' },
  { id: 'lions-mane', title: "Lion's mane", rows: [['fungus', "lion's mane"]], complaint: 'Reads as a mop or a broom.' },
].map(o => ({ ...o, rows: o.rows.map(([tag, name]) => {
  const t = tags.find(x => x.tag === tag), i = t.species.findIndex(s => s.name === name);
  if (i < 0) throw new Error('open item species not found: ' + name);
  return { tag, name, i };
}) }));

const manifest = { cell: CELL, nSp: N_SP, nMix: N_MIX, tags, pairs, open: OPEN };
const tpl = readFileSync(new URL('./review/template.html', import.meta.url), 'utf8');
writeFileSync(OUT + '/index.html', tpl.replace('/*MANIFEST*/null', () => JSON.stringify(manifest)));
let total = 0;
for (const f of [...readdirSync(OUT), ...readdirSync(SP).map(x => 'sprites/' + x)]) { const st = statSync(`${OUT}/${f}`); if (st.isFile()) { console.log(f.padEnd(24), (st.size / 1024).toFixed(0) + ' KB'); total++; } }
console.log('files', total);
