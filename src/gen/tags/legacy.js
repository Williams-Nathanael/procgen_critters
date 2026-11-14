// First-pass tag definitions (one sampler per slot). Kept as the fallback/reference;
// the real per-tag species libraries live in the sibling files.
const PI = Math.PI;
const P = (keys) => keys; // readability

const none = () => ({ type: 'none' });
const oval = t => Math.sqrt(Math.max(1 - (2 * t - 1) ** 2, 0));

export const LEGACY = {
  salamander: {
    label: 'Salamanders',
    sig: { tail: 3, limbs: 2, crown: 2, head: 1 },
    chassis: r => ({ type: 'crawler', len: r.range(40, 54), r: r.range(5.6, 7), wave: r.range(4, 9), belly: r.range(1, 1.15), neckW: 0.7, headS: 1 }),
    head: r => ({ type: 'snout', skull: r.range(1, 1.12), snoutLen: r.range(1, 1.4), tipR: r.range(0.68, 0.85), mid: 0.4, droop: 0.1, bulge: r.chance(0.5) ? r.range(0.2, 0.3) : 0, eyeX: 0.45, eyeY: 0.55, eyeR: 0.17, crownX: -0.35 }),
    limbs: r => ({ len: r.range(2.3, 3), w: 0.62, taper: 0.7, bend: r.range(0.6, 1.1), foot: 'toes', toes: r.int(4, 5), toeLen: r.range(0.75, 1), spread: 1.7, tipDot: true, lift: 0.9, stance: 0.5, arm: 0.8 }),
    tail: r => ({ tailLen: r.range(9, 13), w0: 1, mid: 0.55, w1: 0.06, curl: r.range(0.4, 2.2), wave: r.range(1, 2.6), freq: r.range(0.8, 1.3), tip: 'point' }),
    dorsal: r => r.wpick([[5, none()], [1, { type: 'crest', h: r.range(0.5, 0.9), wave: 0.15, freq: 3 }]]),
    crown: r => r.wpick([[3, none()], [1.2, { type: 'gills', len: r.range(1.2, 1.7), feather: r.chance(0.5), pair: true }]]),
    surface: r => ({ eyes: r.wpick([[3, 'none'], [1, 'dot']]), spots: r.chance(0.3) ? r.int(5, 9) : 0 }),
  },

  amphibian: {
    label: 'Amphibians',
    sig: { limbs: 3, head: 2, crown: 1 },
    chassis: r => r.wpick([
      [3, { type: 'quad', len: r.range(20, 27), r: r.range(9, 11.5), pitch: r.range(0.4, 0.62), arch: 0.25, neckLen: 0.05, neckAng: 0.5, neckW: 0.85, headS: 0.95 }], // sitting frog/toad
      [2.5, { type: 'crawler', len: r.range(22, 30), r: r.range(8.5, 11), wave: r.range(0, 2), belly: 1.15, neckW: 0.85, headS: 0.95 }], // splayed frog from above
      [1.5, { type: 'crawler', len: r.range(44, 58), r: r.range(5, 6.4), wave: r.range(5, 10), belly: 1.05, neckW: 0.75, headS: 1 }], // newt
    ]),
    head: r => ({ type: 'snout', skull: r.range(1, 1.1), snoutLen: r.range(0.6, 0.95), tipR: r.range(0.7, 0.85), mid: 0.35, droop: 0.12, bulge: r.range(0.3, 0.42), eyeX: 0.15, eyeY: 0.6, eyeR: 0.2, crownX: -0.3 }),
    limbs: r => ({ len: r.range(2.2, 2.8), w: 0.5, taper: 0.6, bend: r.range(1.2, 1.7), foot: r.wpick([[2, 'web'], [2, 'toes']]), toes: r.int(3, 4), toeLen: r.range(0.9, 1.2), spread: 1.6, tipDot: true, fold: true, hind: 1.7, hindW: 1.5, lift: 0.25, stance: 0.5, arm: 0.8 }),
    tail: r => r.wpick([[3, none()], [1, { tailLen: r.range(5, 9), w0: 0.95, mid: 0.3, w1: 0.25, curl: r.range(0.3, 1.2), wave: r.range(1, 2), tip: 'point' }]]), // tadpole-ish paddle tail
    dorsal: r => r.wpick([[3, none()], [1, { type: 'crest', h: r.range(0.5, 1), wave: 0.3, freq: r.range(3, 5) }], [0.6, { type: 'plates', n: r.int(5, 8), len: 0.35, wid: 0.2 }]]), // warts
    crown: r => r.wpick([[4, none()], [1, { type: 'gills', len: r.range(1.1, 1.6), feather: true, pair: true }]]),
    surface: r => ({ eyes: r.wpick([[1, 'none'], [2, 'dot'], [1, 'ring']]), spots: r.chance(0.3) ? r.int(4, 8) : 0 }),
  },

  arthropod: {
    label: 'Crustaceans & arthropods',
    sig: { crown: 3, limbs: 2, tail: 2, head: 1 },
    chassis: r => r.wpick([
      [2, { type: 'segmented', n: 3, len: r.range(30, 38), r: r.range(9, 12), env: t => [0.95, 1, 0.6][Math.min(Math.floor(t * 3), 2)] * (0.85 + 0.15 * oval(t)), overlap: 0.72, curve: 0, legs: (i, n) => i >= 1, legS: 0.9, legFan: 1, headS: 0.6 }], // beetle: abdomen, thorax, pronotum
      [2, { type: 'segmented', n: 2, len: r.range(18, 24), r: r.range(13, 17), env: () => 1, overlap: 1.0, curve: 0, legs: () => true, legS: 0.7, legFan: 0.9, headS: 0.3, crab: true }], // crab
      [1.6, { type: 'segmented', n: r.int(7, 10), len: r.range(34, 44), r: r.range(8, 10), env: t => 0.35 + 0.65 * oval(t) ** 0.7, overlap: 0.85, curve: r.range(0, 0.15), legs: () => true, legS: 0.55, legFan: 0.6, headS: 0.6 }], // isopod / trilobite
      [1.4, { type: 'segmented', n: r.int(11, 16), len: r.range(56, 72), r: r.range(3.4, 4.4), env: t => 0.8 + 0.2 * oval(t), overlap: 0.8, curve: r.range(0.15, 0.4), legs: () => true, legS: 1.3, legFan: 0.5, headS: 1.1 }], // centipede
      [1.4, { type: 'segmented', n: r.int(5, 7), len: r.range(38, 50), r: r.range(6, 8), env: t => 0.3 + 0.7 * t ** 0.8, overlap: 0.8, curve: r.range(0.1, 0.3), legs: (i, n) => i >= n - 3, legS: 0.9, legFan: 0.8, headS: 0.6 }], // scorpion / lobster taper
    ]),
    head: r => ({ type: 'capsule', len: r.range(0.9, 1.4), wid: r.range(0.75, 1), mand: r.chance(0.55) ? r.range(0.6, 1.3) : 0, stalk: r.chance(0.3) ? r.range(0.5, 0.9) : 0, bulge: r.chance(0.5) ? 0.28 : 0 }),
    limbs: r => ({ len: r.range(2.6, 3.8), w: 0.24, taper: 0.55, bend: r.range(0.9, 1.4), joints: r.pick([2, 3]), angular: true, foot: 'point', foreFoot: r.wpick([[2, 'pincer'], [3, 'point']]), toeLen: 0.8, lift: 0.8, stance: 0.8, arm: 0.9, kneeFlip: true }),
    tail: r => r.wpick([[3, none()], [1.2, { tailLen: r.range(5, 8), w0: 0.8, mid: 0.6, w1: 0.3, curl: r.range(2.5, 4), wave: 0, tip: 'sting' }], [1, { tailLen: r.range(2, 4), w0: 0.9, mid: 0.8, w1: 0.6, curl: 0, wave: 0.3, tip: 'fan' }], [1, { tailLen: r.range(3, 5), w0: 0.3, mid: 0.5, w1: 0.08, curl: 0.3, wave: 0.5, tip: 'fork' }]]),
    dorsal: r => r.wpick([[3, none()], [1, { type: 'spines', n: r.int(4, 7), len: r.range(0.5, 0.9), wid: 0.35, lean: 0.3 }]]),
    crown: r => r.wpick([[1, none()], [4, { type: 'antennae', len: r.range(2, 4.5), curve: r.range(0.15, 0.6), club: r.chance(0.3), pair: true }]]),
    surface: r => ({ eyes: 'none', seams: r.chance(0.7), stripe: r.chance(0.3) }),
  },

  fungus: {
    label: 'Fungi',
    sig: { head: 3, crown: 2, dorsal: 2 },
    chassis: r => ({ type: 'rooted', h: r.range(20, 40), r: r.range(3.5, 6), bend: r.range(-0.25, 0.25), sway: r.range(-0.12, 0.12), flare: r.range(1.1, 1.7), taper: r.range(0.65, 0.9), headS: r.range(1.5, 2.2) }),
    head: r => r.wpick([
      [3, { type: 'cap', shape: 'dome', w: r.range(1.7, 2.6), h: r.range(1.1, 1.8), under: r.range(0.1, 0.3), ring: r.chance(0.3) }],
      [2, { type: 'cap', shape: 'cone', w: r.range(1.2, 2), h: r.range(1.8, 2.8), under: r.range(0.05, 0.2), ring: r.chance(0.2) }],
      [1.5, { type: 'cap', shape: 'flat', w: r.range(2.2, 3.2), h: r.range(1, 1.5), under: r.range(0.1, 0.3) }],
      [1.5, { type: 'cap', shape: 'bell', w: r.range(1.2, 1.8), h: r.range(1.7, 2.4), under: 0.05 }],
      [1, { type: 'cap', shape: 'funnel', w: r.range(1.6, 2.3), h: r.range(1.2, 1.7), under: 0 }],
      [1, { type: 'cap', shape: 'morel', w: r.range(1.3, 1.7), h: r.range(2.2, 3) }],
    ]),
    limbs: r => ({ len: r.range(1, 1.6), w: 0.3, taper: 0.5, bend: 0.5, foot: 'root', toes: r.int(2, 3), toeLen: r.range(0.5, 0.9), lift: 0, arm: 0.7 }),
    tail: r => r.wpick([[4, none()], [1, { tailLen: r.range(2, 4), w0: 0.25, mid: 0.5, w1: 0.06, curl: 1.5, wave: 2, tip: 'point' }]]),
    dorsal: r => r.wpick([[2.5, none()], [2, { type: 'shrooms', n: r.int(2, 4), len: r.range(1.2, 2.2), shape: r.pick(['dome', 'cone', 'bell']) }], [0.8, { type: 'plates', n: r.int(3, 5), len: 0.8, wid: 0.5 }]]),
    crown: r => r.wpick([[5, none()], [1, { type: 'minicap', len: r.range(0.8, 1.2), shape: 'dome' }]]),
    surface: r => ({ eyes: 'none', capSpots: r.chance(0.45) ? r.int(4, 7) : 0, gills: r.chance(0.5) }),
  },

  mammal: {
    label: 'Small mammals',
    sig: { crown: 3, tail: 2, head: 2, dorsal: 1 },
    chassis: r => r.wpick([
      [3, { type: 'quad', len: r.range(22, 32), r: r.range(8.5, 11), pitch: r.range(-0.02, 0.15), arch: r.range(0.25, 0.6), neckLen: r.range(0, 0.25), neckAng: r.range(0.1, 0.5), neckW: 0.8, headS: r.range(0.72, 0.85) }],
      [1.2, { type: 'upright', h: r.range(14, 22), r: r.range(8, 10.5), lean: r.range(0.1, 0.5), shoulder: r.range(0.62, 0.75), headS: r.range(0.8, 0.9) }], // sitting up
    ]),
    head: r => ({ type: 'snout', skull: r.range(0.95, 1.05), snoutLen: r.range(1.2, 2), tipR: r.range(0.16, 0.32), mid: 0.62, droop: r.range(0.05, 0.25), eyeX: 0.4, eyeY: 0.35, eyeR: 0.15, crownX: -0.3, whiskers: r.chance(0.6) }),
    limbs: r => ({ len: r.range(1.3, 1.7), w: 0.42, taper: 0.6, bend: 0.8, foot: 'paw', lift: r.range(0.3, 0.55), stance: 0.3, hindW: 1.5, arm: 0.8 }),
    tail: r => r.wpick([
      [3, { tailLen: r.range(9, 14), w0: 0.22, mid: 0.5, w1: 0.05, curl: r.range(0.5, 2), wave: r.range(1, 2.5), tip: 'point' }], // mouse
      [1.5, { tailLen: r.range(5, 7), w0: 0.6, mid: -0.9, w1: 0.5, curl: r.range(1.8, 2.8), wave: 0.5, tip: 'pom', tipS: 1.5 }], // squirrel-ish
      [1, { tailLen: 0.5, w0: 0.4, mid: 0.5, w1: 0.3, curl: 0, wave: 0, tip: 'pom', tipS: 0.8 }], // bun
      [0.7, none()],
    ]),
    dorsal: r => r.wpick([[4, none()], [1.5, { type: 'spines', n: r.int(12, 18), len: r.range(0.55, 0.85), wid: 0.3, lean: 0.6 }], [0.6, { type: 'fur', n: 14, len: 0.5 }]]),
    crown: r => r.wpick([
      [3, { type: 'ears', shape: 'round', len: r.range(0.8, 1.3), wid: r.range(0.8, 1.2), pair: true }],
      [1.2, { type: 'ears', len: r.range(2, 3.4), wid: r.range(0.7, 0.9), lean: r.range(-0.5, 0.1), bend: 0.05, pair: true }], // long ears
      [1, { type: 'ears', len: r.range(0.9, 1.3), wid: 0.8, lean: 0, fat: 0.3, pair: true }], // pointed
    ]),
    surface: r => ({ eyes: r.wpick([[1, 'none'], [3, 'dot']]) }),
  },

  dragon: {
    label: 'Small dragons',
    sig: { dorsal: 3, crown: 3, tail: 2, head: 1 },
    chassis: r => r.wpick([
      [3, { type: 'quad', len: r.range(26, 36), r: r.range(6.5, 8.5), pitch: r.range(0, 0.3), arch: r.range(0.2, 0.6), neckLen: r.range(1.2, 2.6), neckAng: r.range(0.6, 1.2), neckW: r.range(0.42, 0.55), headS: r.range(0.55, 0.68) }],
      [1, { type: 'crawler', len: r.range(46, 60), r: r.range(5, 6.2), wave: r.range(6, 11), belly: 1.1, neckW: 0.6, headS: 0.95 }], // wyrm from above
    ]),
    head: r => ({ type: 'snout', skull: r.range(0.9, 1), snoutLen: r.range(1.7, 2.4), tipR: r.range(0.42, 0.55), mid: 0.75, droop: r.range(0, 0.15), eyeX: 0.3, eyeY: 0.4, eyeR: 0.15, crownX: -0.4, jaw: r.chance(0.4), bulge: r.chance(0.5) ? 0.22 : 0 }),
    limbs: r => ({ len: r.range(2, 2.6), w: 0.5, taper: 0.5, bend: 1, foot: 'claw', toeLen: r.range(0.6, 0.85), lift: r.range(0.7, 1.1), stance: 0.35, hindW: 1.5, arm: 0.7 }),
    tail: r => ({ tailLen: r.range(9, 14), w0: 0.9, mid: 0.45, w1: 0.07, curl: r.range(0.8, 2.6), wave: r.range(1, 2.5), freq: 1, tip: r.wpick([[3, 'spade'], [1, 'point'], [1, 'fork'], [0.6, 'club']]), tipS: 0.8 }),
    dorsal: r => r.wpick([
      [3, { type: 'wings', size: r.range(2.6, 4.2), fingers: r.int(3, 4), fan: r.range(1, 1.5), at: r.range(0.62, 0.8) }],
      [1.5, { type: 'spines', n: r.int(6, 10), len: r.range(0.5, 0.9), wid: 0.45, lean: 0.5 }],
      [1, { type: 'plates', n: r.int(5, 8), len: r.range(0.6, 1), wid: 0.35 }],
    ]),
    crown: r => r.wpick([[4, { type: 'horns', len: r.range(1.2, 2.4), curve: r.range(-0.5, 0.5), wid: 0.5, pair: true }], [1, { type: 'tuft', n: 3, spread: 0.9, len: 1.2 }], [0.5, none()]]),
    surface: r => ({ eyes: r.wpick([[1, 'none'], [2, 'dot']]) }),
  },

  plant: {
    label: 'Odd plants',
    sig: { dorsal: 3, crown: 2, tail: 2, head: 1 },
    chassis: r => ({ type: 'rooted', h: r.range(28, 46), r: r.range(1.6, 2.8), bend: r.range(-0.35, 0.35), sway: r.range(-0.25, 0.25), flare: r.range(1, 1.5), taper: r.range(0.55, 0.8), headS: r.range(2.4, 3.6) }),
    head: r => r.wpick([
      [2, { type: 'flower', petals: r.int(5, 9), spread: r.range(2.2, 5.6), pl: r.range(1.5, 2.3), pw: r.range(0.6, 1), disc: r.range(0.5, 0.8) }],
      [1.5, { type: 'flower', petals: r.int(2, 3), spread: r.range(0.5, 0.9), pl: r.range(2, 2.8), pw: r.range(1, 1.4), disc: 0.55, fat: 0.45 }], // tulip / bud
      [1.5, { type: 'trap', gape: r.range(0.25, 0.6), len: r.range(2, 2.8), wid: r.range(1, 1.4), teeth: r.int(4, 6) }],
      [1, { type: 'flower', petals: r.int(11, 16), spread: 6.28, pl: r.range(1.2, 1.7), pw: 0.22, disc: 0.4, fat: 0.8 }], // dandelion clock / allium
      [1, { type: 'flower', petals: 1, spread: 0, pl: r.range(2.2, 3), pw: r.range(1.3, 1.8), disc: 0.5, fat: 0.4 }], // pod
    ]),
    limbs: r => ({ len: r.range(1.5, 2.6), w: 0.4, taper: 0.4, bend: 0.5, foot: 'root', toes: r.int(2, 3), toeLen: r.range(1, 1.8), lift: 0, arm: 0.8 }),
    tail: r => r.wpick([[2, none()], [2, { tailLen: r.range(8, 14), w0: 0.3, mid: 0.5, w1: 0.08, curl: r.range(1.5, 2.5), wave: 0.5, tip: r.pick(['point', 'leaf', 'bud']), spiral: true }]]),
    dorsal: r => r.wpick([
      [3, { type: 'leaves', n: r.int(3, 6), len: r.range(4, 7), wid: r.range(1.6, 3) }],
      [1.5, { type: 'tendrils', n: r.int(3, 5), len: r.range(5, 9) }],
      [1, { type: 'leaves', n: r.int(6, 9), len: r.range(2.5, 4), wid: 0.8, fat: 0.3 }], // needle / fern-ish
    ]),
    crown: r => r.wpick([[3, none()], [1, { type: 'sprout', len: r.range(1, 1.6) }]]),
    surface: r => ({ eyes: 'none' }),
  },

  jansson: {
    label: 'Little folk',
    sig: { head: 3, tail: 2, crown: 1 },
    chassis: r => r.wpick([
      [3, { type: 'upright', h: r.range(13, 24), r: r.range(9, 12), lean: r.range(-0.1, 0.35), shoulder: r.range(0.6, 0.8), headS: r.range(0.85, 1.05) }],
      [1.3, { type: 'upright', h: r.range(26, 40), r: r.range(5.5, 7), lean: r.range(-0.2, 0.2), shoulder: r.range(0.75, 0.95), headS: r.range(0.9, 1) }], // tall thin wanderer
      [1, { type: 'quad', len: r.range(14, 22), r: r.range(9, 12), pitch: r.range(0, 0.2), arch: 0.5, neckLen: 0, neckAng: 0.3, neckW: 0.9, headS: 0.9 }], // little lump on legs
    ]),
    head: r => r.wpick([
      [3, { type: 'snout', skull: r.range(1, 1.1), snoutLen: r.range(1.1, 1.7), tipR: r.range(0.72, 0.95), mid: 0.25, droop: r.range(0.2, 0.5), eyeX: 0.15, eyeY: 0.35, eyeR: 0.22, crownX: -0.35 }], // big soft snoot
      [1.5, { type: 'snout', skull: r.range(0.95, 1.05), snoutLen: r.range(1.4, 2.2), tipR: r.range(0.12, 0.2), mid: 0.7, droop: r.range(-0.1, 0.2), eyeX: 0.2, eyeY: 0.3, eyeR: 0.22, crownX: -0.3 }], // long pointy nose
      [1.2, { type: 'snout', skull: r.range(1, 1.15), snoutLen: 0.35, tipR: 0.9, mid: 0.5, droop: 0, eyeX: 0.45, eyeY: 0.15, eyeR: 0.24, crownX: 0 }], // round noseless
    ]),
    limbs: r => ({ len: r.range(1.1, 1.6), w: r.range(0.36, 0.5), taper: 0.8, bend: r.range(0.3, 0.9), foot: 'pad', lift: r.range(0.15, 0.4), stance: 0.25, arm: 0.95 }),
    tail: r => r.wpick([[2.5, { tailLen: r.range(6, 10), w0: 0.2, mid: 0.5, w1: 0.1, curl: r.range(0.8, 2), wave: r.range(0.8, 2), tip: 'tuft', tipS: 0.9 }], [1.5, none()], [1, { tailLen: r.range(4, 7), w0: 0.25, mid: 0.5, w1: 0.1, curl: 1.5, wave: 1, tip: 'point' }]]),
    dorsal: r => r.wpick([[4, none()], [1.2, { type: 'fur', n: r.int(10, 16), len: r.range(0.45, 0.8) }]]),
    crown: r => r.wpick([
      [2.5, { type: 'ears', len: r.range(0.7, 1.1), wid: 0.6, lean: 0, fat: 0.35, pair: true }], // small pointed ears
      [1.5, { type: 'tuft', n: r.int(3, 6), spread: r.range(0.8, 1.8), len: r.range(0.9, 1.8) }],
      [1, { type: 'ears', shape: 'round', len: 0.7, wid: 0.8, pair: true }],
      [1, none()],
    ]),
    surface: r => ({ eyes: r.wpick([[4, 'ring'], [1, 'dot']]), eyeS: r.range(1, 1.3) }),
  },
};


const SLOT_NAMES = ['chassis', 'head', 'limbs', 'tail', 'dorsal', 'crown', 'surface'];
// Wrap a first-pass definition as a tag with a single generic species.
export function legacy(id, short) {
  const d = LEGACY[id];
  return { id, label: d.label, short: short || d.label, sig: d.sig, species: [{ name: 'generic ' + id, w: 1, genes: r => Object.fromEntries(SLOT_NAMES.map(s => [s, d[s](r.fork())])) }] };
}
