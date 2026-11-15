# Tag: plant

File `src/gen/tags/plant.js` · id `plant` · label "Odd plants" · short "Odd plants"

User: "various odd plants". Odd is the operative word: the strange, characterful and
botanically remarkable over generic flowers. Build real breadth of growth forms, each a
different silhouette.

- Carnivorous: Venus flytrap rosette with several traps, nepenthes pitchers on tendrils,
  sarracenia trumpets, cobra lily, sundews with beaded tentacle leaves, bladderwort, butterwort.
- Ferns and allies: fiddleheads, fronds, bird's-nest, staghorn, maidenhair, adder's-tongue,
  moonwort; horsetails with whorls and cone tips; clubmosses; moss sporophytes; liverwort umbrellas.
- Arums: jack-in-the-pulpit, cuckoo-pint, titan arum, skunk cabbage, calla.
- Orchids: lady's slipper, bee orchid, monkey-face.
- Seed-heads: dandelion clock losing seeds, poppy capsule, lotus pod, teasel, thistle,
  nigella, honesty, milkweed pod splitting, physalis lantern, sycamore keys.
- Bulbs and roots shown whole, ABOVE the line as if lifted from the soil: onion, snowdrop,
  crocus corm, mandrake with its forked humanoid root (medieval herbals drew it as a little
  person; perfect here), ginseng, carrot/radish, sprouting potato.
- Succulents and cacti: lithops, barrel, prickly pear, tiny saguaro, agave with flower
  spike, aloe, echeveria, string-of-pearls, old-man cactus.
- Oddities: welwitschia, rafflesia, miniature baobab, dragon's-blood tree, monkey-puzzle,
  windswept bonsai, hogweed umbel, gunnera, lotus and water lily, cattail, pussy willow,
  mistletoe, tillandsia, Spanish moss, passionflower, bleeding heart, fritillary, foxglove,
  lupin, sea holly, bladderwrack and kelp with holdfast, sensitive plant, cotton boll,
  pinecone on a twig, ginkgo, hops, bindweed, pea with tendrils and pod, strawberry runner,
  squirting cucumber, burdock burr, touch-me-not.

Plants are rooted side-view forms on the ground line; a hint of root at the base is welcome.
Asymmetry and a living lean make them feel drawn, not stamped. Signature features to lend:
leaves as ears/wings/tail, tendrils and fiddlehead curls, a flower, seed-head or snap-trap
for a head, root feet, thorns, a sprout on the crown. Default eyes: none.

## State
- 2026-11-14 vine critic fix round: 52 -> 51 species. Passionflower CUT (side-on saucer flower
  with fringe and raised crown plus tendrils tried; at --cell 60 still an upright leafy stem
  with a cross on top, not a vine). Layouts now differ: ivy uses a new `creep` kind (short rise,
  then runs low along the line, leaves held up, tip lifts and curls; berry umbel dropped);
  grapevine leaves tilt forward along the top of the cane, bunches hang below between them;
  bottle gourd sprawls in a wide low arch, gourd hangs clear on its own stalk from the crown of
  the arch, leaves droop alternately; wisteria untouched. Removed the unused `twine`/stake code
  path. Judged at --cell 60, 10 seeds each. Still weakish: grapevine leaves a little flag-like,
  ivy small at print size.
- 2026-11-13 M2 fix run 2: monkey puzzle rebuilt as tall thick bare trunk with an asymmetric dome of 6-7 tiers of drooping spiky rope branches (skewed per side, some skipped) and an upward tuft at the top; no longer an aerial. Teasel and thistle separated: teasel is a tall narrow egg of spines with long thin bracts sweeping out and up past it; thistle is a round spiny bulb pinched to a neck with a wide flaring shaving-brush tuft. Judged at --cell 60. Still weak (unchanged): lotus, barrel/old man/pincushion, nepenthes, foxglove, titan arum symmetry.
- 2026-11-13 M2 fix run (critic list): cut honesty and bleeding heart (stalk-plus-blobs template, scribbles at print size); now 45 species. Thistle and teasel: one big head (optional single side head), thicker stems, fewer prickles. Chinese lanterns: 2-3 large lanterns on a thick arching stem. Titan arum: new wide frilled spathe skirt with tilted asymmetric rim and blunt curled lip, spadix rising from it. Monkey puzzle: thick ropey arms that droop then upturn, random lengths, 3-4 tiers. Lotus: one big round-petalled bloom (or pod) plus 1-2 tilted pads, optional bud, no stick fence. Poppy stems thickened. Still weak: lotus pads read as lens leaves, foxglove spike, living stones/welwitschia small, nepenthes berry-bush look, poppy capsules busy, barrel/pincushion/old man similar.
- 2026-11-14 M3b vine run: 47 -> 52 species. New `vine` form (one main stem: `arch`,
  `cordon` trunk+trained arm, or `twine` up a stake; nodes carry a leaf on a petiole, optional
  coiled tendril; hanging fruit and side flowers; the growing tip curls unless it carries a
  unit) and units `ivy`, `trilobe`, `grapes`, `raceme`, `gourd`, `passion`. Species: ivy
  (arch, palmate leaves, optional berry umbel tip), grapevine (thick trunk, horizontal cane,
  leaves up, 1-2 bunches down, tendrils), wisteria (twisted woody arch, 3-5 long racemes
  hanging, small leaflet fans on top; strongest), passionflower (arch, 3-lobed leaves below,
  1-2 face-on fringed flowers above; weakest, flowers read as spiky balls), bottle gourd (arch,
  3-lobed leaves on top, one big hanging bottle gourd, optional trumpet flower). All judged at
  --cell 60. Cut/abandoned: `twine`-on-a-stake for passionflower and gourd (stake and wraps
  merged into a lumpy column at print size; the code path stays, unused). Morning glory not
  added (too close to the existing bindweed). Vine lends (plantLeaf heads with the new units)
  not individually checked on animals: the sheet tool cannot pin a species inside a mix row.
- 2026-11-13: 47 species, reviewed over 3 rounds plus stacking checks. Sheets:
  `out/roads/03-plant-species.png`, `out/roads/03-plant-mixes.png`.
- Architecture (in `plant.js`): one chassis `plant` with body FORMS: `stems` (the workhorse:
  substrate, basal rosette of units, stems with leaves/whorls/prickles/branches and a crowning
  unit), `mandrake`, `bulb`, `taproot`, `potato`, `cactus` (columns/barrel/pincushion), `pear`,
  `lithops`, `tree` (baobab/dragon/bonsai/monkey), `weed` (kelp/oarweed/wrack), `welwitschia`,
  `tillandsia`. Drawing goes through a ground-clamping `Pen`, so nothing goes below the line
  except deliberate root slivers (`pen.root`). Ornaments are UNITS (`U.*`) or plant heads,
  reused as stem parts, lent heads, crowns (`plantSprig`), dorsal rows (`plantRow`), tail tips
  (`plantOrn`) and root feet (`plantRoot`).
- Lending: each species lends a head (`plantLend` + `lend` gene: its signature flower/trap/
  pitcher/seed-head on a small receptacle knob carrying the eye), crown, dorsal, tail and root
  legs. On the plant's own chassis those ornaments are muted (fungus-style `_own`). With
  borrowed legs the plant is lifted onto a root ball. A borrowed head replaces the main stem's
  crowning unit (`plan.mainUnit`).
- Strong: venus flytrap, cape sundew, trumpet pitchers, nepenthes, cobra lily, dandelion clock,
  jack-in-the-pulpit, cuckoo-pint, fritillary, cattail, hogweed, lotus, liverwort umbrellas,
  horsetail, mandrake, radish, carrot, onion/garlic (scape loop, allium ball), saguaro,
  pincushion, prickly pear, baobab, dragon's blood tree, windswept bonsai, kelp/oarweed, air plant.
- Weak (by name): living stones (cleft barely reads at print size; low weight), welwitschia
  (low, flat, small; low weight), titan arum (still a bit rocket-like), old man cactus (just a
  fuzzy column), teasel (head small for the stem), honesty and bleeding heart (busy at print
  size), foxglove bells (read as a notched spike more than bells).
- Decisions: dropped milkweed, sweet pea and echeveria (muddy silhouettes). No drifting
  dandelion seeds (would be detached). Clumps stand on a low soil mound so each critter is one
  connected piece. Bonsai sometimes in a shallow pot (charm over strict wildness).
  Performance: the ink union cost scales with vertex count, so fronds and sword leaves are one
  toothed outline each and spines/scales are 4-6 point kites; every species averages < 16 ms.
- Not yet covered from the list: bladderwort, butterwort, bee/monkey orchid, nigella, sycamore
  keys, ginseng, string-of-pearls, rafflesia, gunnera, mistletoe, Spanish moss, passionflower,
  sea holly, burdock (heads exist: `plantBur` seaholly/burdock), pinecone twig, ginkgo, hops,
  bindweed, strawberry runner, squirting cucumber, touch-me-not, sensitive plant, maidenhair,
  moonwort/adder's tongue (heads exist), clubmoss (head exists).

### Hybrids (M8 phase 1, 2026-11-14, automated scan, not yet judged by eye)

Within-tag hybrids are on by default (`hybrid` 0.85, see AUTHORING.md "Within-tag hybrids"). No throws over 2000 seeds. Worst combinations found by a heuristic over 3000 seeds (base + borrowed slot; "detached" = the silhouette falls into separate pieces where the pure base does not; "very long/tall" = aspect over 5:1):

- dandelion clock + head of baobab: 2/3 detached
- baobab + tail of onion and garlic: 2/3 detached
- carrot + dorsal of mandrake: 2/4 detached

Use the species `hybrid: { never, keep, noLend }` hints to fix these in phase 2.

### Chimeras (M8 phase 2, 2026-11-14), judged at --cell 60, 64+96 seeds

- Plant chimeras are now one organism. Cause of the old collages: sibling plants' tail, dorsal
  and crown lends were hung on the plant chassis as animal parts (the `_own` mute only caught
  the chassis parent's own), and sibling root legs put the plant on a walking root ball.
- Fix (all in `plant.js`, no shared code): `build()` gives each species' lend objects a hidden
  `_tok` and the chassis a hidden `_g` link (re-pointed by critter.js `relink`). `chassis.plant`
  mutes every plant-made tail/dorsal/crown, treats any plant root legs as rooted (no ball), and
  MELDs the siblings' units into its own stem system: head -> main stem's crowning unit (sized
  like what it replaces, stem lengthened so the plant keeps its height); non-leafy crown/dorsal/
  tail -> side-stem flowers (replacing secondary stem heads, or one new side stem); leafy
  dorsal/crown -> stem leaves (clusters capped small); single-blade tail -> basal rosette. Stub
  clumps (pitchers, cobra lily) keep their units and get a central stem for the head. Vines:
  leafy unit -> node leaves, flowers -> side flowers. Cactus, prickly pear, living stones: a
  sibling head may bloom on top. Trees, bulbs, taproots, mandrake, potato, weeds, welwitschia,
  air plant: not melded (only the chassis numeric blend), decided as unmeldable forms.
  Units are measured once (`extOf`, cached) to scale them.
- Blended vine `sd` (side sign) could land at 0 and straighten the arch; now re-signed.
- No `hybrid` hints needed after this; the phase-1 detached combos no longer occur (lent parts
  never hang on plant bodies). Root sliver is the shared 5%/2-unit allowance; no dips seen.
- Still weakish: fritillary-chassis chimeras (tangle of nodding stems), horsetail x fern
  (whorls plus fiddles read as a ladder), teasel/thistle chassis with leaf clusters (lumpy).
  Sheet: `out/roads/07-plant-chimeras.png`.

### Chimera fix round (2026-11-14, critic findings at --hybrid 1 --cell 60)

- Solid-bodied bases no longer read as catalogue plants: `borrow()` in `plant.js` makes every
  non-meldable base (cactus, prickly pear, trees, bulb, taproot, mandrake, potato, weeds,
  welwitschia, air plant) grow at least one sibling unit. Cacti/pear: units on short visible
  stalks on the top and on arm/pad/ball tips (`o.tips`). Trees: 2-4 units hanging on stalks from
  canopy spots (`o.hang`: baobab branch tips, dragon dome underside, bonsai pads, monkey-puzzle
  rope ends). Others: a flowering scape (with borrowed blade leaves) from the crown, taller on
  carrot/radish/mandrake so it clears the leaf tuft. A borrowed head on cactus/pear/lithops tops
  now sits on a short stalk instead of fusing into the body.
- Barrel cactus w 1.6 -> 1.2, dragon's blood tree w 1.8 -> 1.3 (lent as chassis less often).
- Fritillary: 1 stem (or 2, second smaller), one dominant bell hs 3.8-4.4, thicker stem.
- Wisteria raceme: a solid tapered tassel body with bead bumps (was beads on a hairline).
- Teasel: stem w 2.1, 1-2 leaf pairs, larger and wider.
- Radish tail floored so the tube stays within a ~0.2 sliver.
- Still weak: saguaro chimeras (units on arm tips can look like fused knobs), dragon's blood
  hanging units partly lost in the dome fringe, living stones (only the head on top), units
  with thin petals (lady's slipper) read small for their measured extent (`extOf` is a bbox).

