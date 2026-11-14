// Builds the 1.0 taste-check page: out/review/index.html plus sprite sheets.
// usage: npm run review   (add --seed N to change the seed family, --skip-sprites to rewrite only the page)
import { mkdirSync, writeFileSync, readFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TAG_NAMES, TAGS } from '../src/gen/tags/index.js';
import { sheetSvg } from './sheet-lib.mjs';

const argv = process.argv.slice(2);
const skipSprites = argv.includes('--skip-sprites');
const seed = argv.includes('--seed') ? Number(argv[argv.indexOf('--seed') + 1]) : 1;
const OUT = 'out/review', SP = OUT + '/sprites', CELL = 60, SCALE = 2;
if (!skipSprites) rmSync(SP, { recursive: true, force: true });
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
const N = 8;
const L = (tag, name, q) => ({ tag, name, q });
const GROUPS = [
  { id: 'g1', title: 'Cut or try again', set: 'kct', sub: 'Marked weak last time. Keep it, cut it, or ask for another attempt.', items: [
    L('fungus', 'oyster mushroom', 'Does the shelf read as an oyster mushroom, or is it still a smear on the log?'),
    L('fungus', 'jelly ear', 'Does the floppy ear read at this size?'),
    L('jansson', 'ampersand knot', 'The eye barely shows. Worth keeping?'),
  ] },
  { id: 'g2', title: 'Reworks you have not seen', set: 'kct', sub: 'New or redrawn since the last check. Keep, cut, or try again.', items: [
    L('dragon', 'amphisbaena', 'Two heads facing out. Do they crowd?'),
    L('dragon', 'basilisk', 'Crowned coil or cock-legged, half and half. Reads as a basilisk?'),
    L('dragon', 'cockatrice', 'Hen-chested with a serrated comb. Right?'),
    L('dragon', 'ouroboros', 'Does the ring read as a snake eating its tail?'),
    L('dragon', 'fire salamander', 'Flame-crested newt. Still a bit small. Keep?'),
    L('plant', 'wisteria', 'Arch with hanging racemes.'),
    L('plant', 'bottle gourd', 'Sprawling arch with a gourd hanging clear.'),
    L('plant', 'grapevine', 'Trunk and cane, bunches hanging. Leaves a little flag-like?'),
    L('plant', 'ivy', 'Creeps low along the line. Too small?'),
    ...['king crab', 'coconut crab', 'spiny lobster', 'squat lobster', 'whip spider', 'camel spider', 'trident trilobite', 'arthropleura', 'marrella'].map(n => L('arthropod', n, 'New arthropod. Does it read as the animal?')),
    L('arthropod', 'mantis shrimp', 'Redrawn top view. Head end may still be a dark lump.'),
    L('fungus', 'lattice cage', 'Does the cage read as a stinkhorn lattice?'),
    L('fungus', 'chicken of the woods', 'Shelves on a log, smoothed attachment. Still a blob?'),
    L('fungus', "hare's ear", 'Does the cup read as an ear?'),
    L('amphibian', 'Surinam toad', 'Redrawn so it is not the same X as the flying frog.'),
    L('mammal', 'beaver', 'Paddle tail is thicker and lifted. Reads now?'),
    L('jansson', 'spiral snail', 'Was the at-snail. Reads as a snail?'),
  ] },
  { id: 'g3', title: 'Weak leftovers', set: 'fc', sub: 'Never loved, never cut. Fine to leave, or cut?', items: [
    L('arthropod', 'trilobite', 'Reads as a blob at print size.'),
    L('arthropod', 'woodlouse', 'Plain.'),
    L('arthropod', 'pill bug', 'Plain.'),
    L('fungus', 'giant puffball', 'Fine or cut?'),
    L('fungus', 'earthball', 'Fine or cut?'),
    L('dragon', 'jaculus', 'Weak. Fine or cut?'),
    L('dragon', 'sleeping drake', 'Weak. Fine or cut?'),
    L('amphibian', 'hairy frog', 'Fine or cut?'),
    L('amphibian', 'midwife toad', 'Fine or cut?'),
  ] },
];
for (const g of GROUPS) {
  g.items = g.items.map(it => {
    const t = TAGS[it.tag], i = t ? t.species.findIndex(s => s.name === it.name) : -1;
    if (i < 0) throw new Error('species not found: ' + it.tag + ' / ' + it.name);
    return { ...it, id: 'q-' + it.tag + '-' + slug(it.name) };
  });
  sprite(g.id, g.items.map(it => `${it.tag}@${it.name}`), N);
}
sprite('mixes', pairs.map(p => p.join('+')), N);

const manifest = { cell: CELL, n: N, groups: GROUPS, pairs };
const tpl = readFileSync(new URL('./review/template.html', import.meta.url), 'utf8');
writeFileSync(OUT + '/index.html', tpl.replace('/*MANIFEST*/null', () => JSON.stringify(manifest)));
let total = 0;
for (const f of [...readdirSync(OUT), ...readdirSync(SP).map(x => 'sprites/' + x)]) { const st = statSync(`${OUT}/${f}`); if (st.isFile()) { console.log(f.padEnd(24), (st.size / 1024).toFixed(0) + ' KB'); total++; } }
console.log('files', total);
