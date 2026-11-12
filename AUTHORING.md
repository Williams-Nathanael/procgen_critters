# Authoring critters

How the generator is put together, and how to add or extend a tag (entity type).

## The model in one paragraph

A critter is a **chassis** (body plan) that draws a body and exposes **sockets**, plus
parts plugged into those sockets: **head**, **limbs**, **tail**, **dorsal** ornaments,
**crown** ornaments, and **surface** (white interior detail). Every part works on every
chassis, which is what makes tags stackable. A **tag** (`src/gen/tags/<tag>.js`) is a
library of **species**; each species returns one gene spec per slot. For a single tag,
one species supplies everything. For stacked tags, one *primary* tag supplies a whole
species and each other tag lends one or two of its signature slots (`sig` weights) taken
from one of its own species (`src/gen/critter.js`).

Everything is black polygons unioned into a single silhouette (`Ink` in `core.js`), with
optional white shapes cut out. No strokes, no greys.

## Coordinates and conventions

- Units: a critter is roughly 40-100 units across. `MINW` (0.75) is the thinnest stroke
  that survives printing at about an inch; nothing thinner.
- y is **down**. Angle 0 = +x (right), `-PI/2` = up.
- **Side view** (`plan.view === 'side'`): faces +x, stands on the ground line `y = 0`,
  body in negative y. Nothing may go below y = 0 except a sliver of root on rooted things.
- **Top view** (`plan.view === 'top'`): centred on y = 0, head toward +x, bilaterally
  symmetric. It is shifted to sit on the line afterwards.
- `C = { ink, rng, plump, lift, plan }` is passed to every part. Use `C.rng` for all
  randomness (never `Math.random`) so seeds reproduce.
- `ink.poly(pts)`, `ink.tube(ctrlPts, radiusFnOrNumber)`, `ink.line(ctrlPts, width)`,
  `ink.dot(c, r)`, `ink.oval(c, rx, ry, rot)`. Last argument `'w'` draws white (cut out),
  `'k2'` draws black on top of white (pupils). See `core.js` for `spline`, `polyline`,
  `profile`, `tube`, `ellipse`, `leaf`, `frame`, `pathAt`, `polar`, `lerp`, `mix`.

## Gene specs (what a species returns)

`genes(r)` gets a seeded rng `r` (`r.range(a,b)`, `r.int(a,b)`, `r.chance(p)`,
`r.pick(arr)`, `r.wpick([[weight, value], ...])`, `r.sign()`) and returns:

```js
{ chassis: { type, ... }, head: { type, ... }, limbs: { ... } | { type: 'none' },
  tail: { ... } | { type: 'none' }, dorsal: { type, ... }, crown: { type, ... },
  surface: { eyes: 'none' | 'dot' | 'ring', ... } }
```

Built-in types and their parameters are in `src/gen/parts.js`; the first-pass
definitions in `src/gen/tags/legacy.js` show every built-in in use with sensible ranges.

- **chassis**: `quad` (side-view four-legger, `pitch` tilts it into a sitting frog),
  `upright` (standing biped pear), `rooted` (stalk growing from the ground),
  `crawler` (top-view S-curved body with four splayed legs), `segmented` (top-view chain
  of segments with leg pairs).
- **head**: `snout` (skull + tapering muzzle: salamander wedge to mouse cone to dragon
  muzzle), `cap` (mushroom caps: dome, cone, flat, bell, funnel, morel), `flower`,
  `trap`, `capsule` (arthropod).
- **limbs**: one spec for all limb sockets: `len, w, taper, bend, foot, toes, toeLen,
  lift (stance height), fold (frog hind legs), angular (jointed), joints, foreFoot`.
  Feet: `toes, web, paw, pad, claw, pincer, root, point`.
- **tail**: `len, w0, mid, w1, curl, wave, freq, spiral, up, tip`.
  Tips: `point, tuft, spade, pom, club, fan, sting, leaf, fork, bud`.
- **dorsal**: `spines, crest, wings, leaves, shrooms, plates, fur, tendrils`.
- **crown**: `ears, horns, gills, antennae, tuft, sprout, minicap, bloom`.
- **surface**: `eyes`, `eyeS`, `spots`, `capSpots`, `gills`, `seams`, `stripe`.

## Adding new forms

Most real diversity needs new shapes, not just new numbers. Register them from the tag's
own file; do not edit `parts.js` or `core.js` for tag-specific forms:

```js
import { chassis, heads, feet, tips, crowns, dorsals } from '../parts.js';
chassis.fungusBracket = (C, g) => { /* draw; return plan */ };
heads.fungusCoral = (C, sock, g) => { /* draw; return { eyes, mounts, spots } */ };
feet.x = (C, p, ang, s, g, k) => {};          // foot at p pointing along ang, scale s*k
tips.x = (C, end, ang, s, g, curl) => {};     // tail tip
crowns.x = (C, mount, F, s, g) => {};         // F = local frame at the mount, x pointing out
dorsals.x = (C, plan, strip, sd, si, g, at) => {}; // strip = [{p, dir, t}], at(u) samples it
```

Prefix new type names with the tag id so files never collide.

**A chassis must return the plan contract**, so that parts from other tags can plug in:

```js
{ view: 'side' | 'top', r,            // r: characteristic body radius
  path, rad,                          // body centreline (points) and radius fn rad(t), for spots
  head:  { p, dir, face, s, sym, radial? },   // dir: direction the neck grows; face: where it looks
  tail:  { p, dir, s },
  limbs: [{ p, dir, s, role: 'fore'|'hind'|'mid'|'arm'|'root', side, fwd, ground?, far? }],
  back:  [[{ p, dir, t }, ...], ...], // one strip (side view) or two flank strips (top view)
  rooted?: true, alt?: true, seams?: [...] }
```

A species that is really one bespoke silhouette (an earthstar, a snail, a bat) is a custom
chassis that draws most of itself and still returns sensible sockets; pair it with
`head: { type: 'none' }`-style empty slots where there is genuinely nothing to plug in
(register a trivial `heads.<tag>None` that draws nothing and returns
`{ eyes: [], mounts: [{ p, dir, flip: 1, s }], spots: [] }`).

**A head must return** `{ eyes: [{p, r}], mounts: [{p, dir, flip, s}], spots: [] }`.
`mounts` is where crown ornaments attach: one mount in side view, a mirrored pair when
`sock.sym` (top view).

## Reviewing output

```sh
node tools/sheet.mjs out/tmp/x.png "fungus@*" --n 8 --cell 130       # one row per species
node tools/sheet.mjs out/tmp/y.png fungus "fungus+mammal" --n 10     # tag rows and mixes
node tools/sheet.mjs out/tmp/z.png "fungus@morel" --n 12 --detail 1  # one species, all white detail
```

Then look at the PNG. Default `--detail 0.3` is what users see by default (eyes only);
`--detail 1` adds markings. Judge at the size it will be printed: about half an inch.

## Style bar

- Storybook naturalist: recognisable real anatomy, soft and slightly plump, a little
  charming. A salamander should be unmistakably a salamander from outline alone.
- The outline carries everything. If a form only reads with white detail, redesign it.
- Default white detail is "eyes only where they help": none on salamanders, plants and
  fungi; a small dot on mammals and dragons; round ringed eyes on the margin folk.
- Mixes read as one coherent creature, not a collage.
- No hairline spikes, no accidental slivers, no parts floating detached, nothing below
  the ground line.
