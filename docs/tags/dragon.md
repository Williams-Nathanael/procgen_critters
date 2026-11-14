# Tag: dragon

File `src/gen/tags/dragon.js` · id `dragon` · label "Small dragons" · short "Dragons"

User: "small dragonlike entities"; "Dragons, your call where your designs stem from; I'd
default towards varied medieval illustrations." Ground it in the medieval visual record,
not modern fantasy art.

Sources to draw on: bestiary dragons (Aberdeen and Harley bestiaries: draco as a winged
serpent, small dog- or wolf-like head, ears, two legs, long looping tail), wyverns (two
legs, wings, knotted or barbed tail), lindworm (wingless, two forelegs, serpent body),
amphisbaena (second head at the tail tip), basilisk and cockatrice (rooster head, comb and
wattles, wings, serpent tail), jaculus, hydra, sea-serpents and serra, St George and St
Margaret dragons (often small, pug-faced, bat-winged, curled tail), Romanesque and Insular
interlace beasts with knotted bodies and leaf-spray tails, Gothic marginal drolleries
(Luttrell Psalter, Maastricht Hours, Macclesfield Psalter: two-legged dragonets with long
ears, foliate tails), initial-letter dragons and ouroboros, heraldic dragons and wyverns
(passant, rampant, statant, sejant; barbed tongue and tail), Norse/Urnes ribbon serpents,
alchemical serpents; a few non-European cousins only if they add distinct outline.

Medieval dragons are often small, comic and doglike rather than majestic, which suits the
storybook mood. Wings: bat/membrane with scalloped edge, feathered, vestigial; raised,
half-folded, spread. Tails: looped, knotted (an overhand knot is very medieval), coiled,
barbed, leaf-tipped, second head. Heads: dog/wolf-like with ears, beaked, pug-nosed,
long-jawed with open mouth and tongue (open mouth via outline; white only for the eye dot).
Poses: walking, crouching, rearing, coiled, looking back over the shoulder, biting own tail.

Signature features to lend: wings, horns and ears, knotted or barbed tails, the long S-neck
with dog-like head, dorsal spikes. Default eyes: a small white dot.

## State
Updated 2026-11-13 (species-builder run on main, continuing the interrupted WIP; review rounds
done). Sheets: `out/roads/03-dragon-species.png`, `out/roads/03-dragon-mixes.png`.

- **27 species** (was 28 unreviewed; draco constellation cut).
- **Strong**: heraldic dragon passant (paw raised, heraldic wing), dragon rampant, dragon
  sejant (folded wing), saint george dragon (pug, round wing), saint margaret dragon,
  regardant dragonet, amphisbaena, hydra, ouroboros, coiled wyrm, interlace beast, urnes
  ribbon beast, tarasque, sea serpent, basilisk (new: crowned serpent reared on cock's legs),
  lindworm (now stout, usually tied in a loop, two strong forelegs), prow wyrm (new: a
  longship with a stern post ending in a spiral and a maned prow neck).
- **Weak, by name**: foliate wyvern (leafy wing reads as a lump at print size), cockatrice
  (feather wing and comb merge into one ruffled mass), fire salamander (long and low, small
  at print size; flame tail tip now reads more as a spade), long (mane teeth still sparse;
  slowest species, ~20 ms), bestiary draco / wyvern / heraldic passant are still close
  cousins (winged two- or four-leggers) and differ mainly by wing kind and legs.
- **Wings rewritten**: every wing is one outline polygon (no finger tubes). Presets, each a
  distinct silhouette: `heraldic` (5 ribs, hooked leading tip), `batw` (3-4 fingers hanging
  down-back, deep scallops), `roundw` (Uccello fan), `folded` (cloak along the back),
  `stub`, `feather` (feather ends along a convex trailing curve), `leafy` (few broad lobes,
  hooked tip). Species pick by kind (draco feather, sejant folded, St George round, rampant
  and passant heraldic, foliate wyvern leafy...). In side view the arm angle is mostly
  absolute (up, leaning back) so a pitched body does not bury the fingers. The far wing is a
  smaller copy rotated slightly forward. Lent wings use `min(r, 8)` as their scale so big
  foreign bodies (Jansson shaggy mop) do not get giant wings.
- **Speed**: dragon alone ~10 ms mean (max ~17 ms) on the shared laptop under load, was
  ~17 ms. Done by cutting vertices, not features: single-outline talons (feet were a third
  of all vertices), single-outline ridges, dragon-own ears/horns (`dragonEar`,
  `dragonHorn`), a cheap 12-vertex leaf `lf`, 16/12-vertex ovals and dots, fewer serpent
  and neck samples. `Ink.finish` (soften pass) is still >half the cost; see report.
- **Decisions**: draco constellation cut (thin loop serpent, overlapped lindworm/sea serpent
  and not iconic). Knot tails kept as the medieval looped tail (bigger loop now); a true
  over-under knot is not readable in silhouette. `serpent` chassis gained `stern` (rising
  tail end) for the prow wyrm.
- **Next**: give the feather/leafy wing a clearer gap from the body; a winged amphiptere;
  biting-own-tail and St George pinned-under-spear poses; more distinct heads (beaked eagle,
  horse-headed).

### M2 fix run (2026-11-13)
- 27 -> 25 species. Winged-biped cluster merged: foliate wyvern folded into bestiary draco (scroll-tail option, upswept feather wing); regardant dragonet folded into luttrell dragonet (beaked head, regardant option). Remaining winged forms differ by pose/head: draco (feather wing, eared), wyvern (bat wing, horns, gaping), passant (quad), St George (squat pug), luttrell (beak, long ears), cockatrice.
- Cockatrice: wing set back and not far-side, long bird legs (basilisk-style), bigger 3-4 lobe comb.
- Sea serpent: body r 6.4-7.4, shorter, 1-2 humps, fewer bigger fins. Long: thicker, bigger head, hairline whiskers removed, 6-8 bold mane lobes.
- Fire salamander: shorter and plumper, head raised, big flame tail tuft, fewer bigger flame spines.
- Still weak (minor, not addressed): jaculus (crumpled wings), sleeping drake/serra (heads unclear), ouroboros plain rings (small head).

### M2 fix run 2 (2026-11-13, judged at --cell 60 only)
- Still 25 species. Winged trio separated by overall outline: bestiary draco is now long and
  low (near-level body, long straight trailing tail, small feather wing); wyvern stands bolt
  upright on two legs with big raised bat wings and the tail curled under; heraldic passant is
  a horizontal four-legger, always paw raised, wings folded along the back, tail curled high.
- Fire salamander rebuilt as a plump, high-standing short beast, head up, flame tongue, 3-4
  big flame crests and a big flame-tufted tail held up. Still the most blob-like; next cut
  candidate if it bothers.
- Ouroboros: thinner ring, head 1.5-1.75x with brow, horns or long ears, always a foreleg,
  so the head breaks the ring outline at the top.
- Weak: draco is thin at print size; fire salamander chunky; jaculus, sleeping drake, sea
  serpent minors untouched.

### M3 taste fixes (2026-11-13, judged at --cell 60)
- Still 25 species. Only the five the user flagged were touched; the rest is unchanged.
- Each was tried in 2-3 variants (scratch `amph A/B`, `bas A/B`, `cock A/B`, `our A/B`, `fire A`), best kept:
  - **Amphisbaena**: low two-legged dragon (draco-like stance, sturdier legs), tail thick and held
    high in an arc ending in a big second head (tipS 1.7-2). Rejected: serpent U with raised stern
    (tail head too small, read as a lizard).
  - **Basilisk**: 65% a crowned coiled serpent reared from a flat spiral with a big crown (reads
    instantly at print size); 35% the old reared serpent on cock's legs, now shorter and thicker
    with sturdier legs and bigger crown.
  - **Cockatrice**: upright, pot-bellied cock body, short neck, big comb and wattle, feather wing
    raised behind, serpent tail curled high with barb. Rejected: bat-wing version (wing became a
    blob over the body).
  - **Ouroboros**: thin ring, moderate head (1.5-1.65), snout follows the ring (`faceOff` on the
    serpent ring), gaping jaws closing over a thin tapered tail tip; small horns/ears/none; 40%
    winged. No foreleg (it made a lump at the bottom of the ring).
  - **Fire salamander**: new `dragonNewt` chassis (low newt body, long tail, sprawled stout legs,
    small flat head, no flame breath) and `dragonFlames` dorsal (low newt crest throwing up
    curling flame tongues along back and tail), flame tail tip.
- Weakest now: fire salamander is still small at cell 60 (long and low) and its flames are
  somewhat regular; cockatrice could still read as a griffin to some; ouroboros head is only a
  bump at cell 60.

### M3 critic follow-up (2026-11-14, judged at --cell 60)
- Still 25 species; only these four touched.
- Fire salamander: r x1.4 (7.3-8.4), slightly shorter, tail held up; `dragonFlames` now has
  jittered spacing, uneven heights, and 2-3 tall forked tongues leaning further back.
- Cockatrice: rounder hen chest (chest 1.3-1.45), more upright, short neck and beak, big
  wattle; `dragonComb` rewritten as one serrated blade across the top of the head; wing is
  stub or a small 4-feather wing only; shorter tail.
- Amphisbaena: tail head ~front-head size, jaw open, aimed at the front head (`face2` gene
  in `tipEnd`); front head turns back up over the shoulder (`tilt` ~ -2.6) so the two heads
  face each other over the back. Wings mostly dropped (stub at 1/3).
- Basilisk: the legged variant was always reachable (chance was 0.35); now 0.5. Coil varies
  more (turns 1.05-2, rise, gap, thickness).
- Still weak: salamander body is a heavy lump under the flames; cockatrice beak small at
  print size.
