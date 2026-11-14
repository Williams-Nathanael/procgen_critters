# Tag: mammal

File `src/gen/tags/mammal.js` · id `mammal` · label "Small mammals" · short "Small mammals"

The first-pass mice (side-view quad, pointed snout, round ears, long thin tail) set the
floor for charm. Breadth of species AND pose matters: a row of identical walking mice is dull.

Species: house, wood (big ears and eyes) and harvest mice (tiny, climbing a stalk), dormouse
(fluffy tail, curled asleep), vole, lemming, hamster, gerbil and jerboa (kangaroo legs,
tufted tail, bipedal), kangaroo rat, rat, shrews and elephant shrew, water shrew, mole
(spade hands, cylinder body), star-nosed mole, hedgehog (walking and rolled), tenrec,
squirrel (sitting, tail up, holding a nut; running), chipmunk, flying squirrel gliding,
sugar glider, rabbit and hare (sitting, loping, upright alert, ear positions), pika, guinea
pig, chinchilla, weasel/stoat (long, arched, standing periscope), ferret, mink, bat (flight
and crawling only: a hanging bat would hang below the line, which is not allowed), pangolin
(walking and rolled), armadillo, small opossum, bushbaby, mouse lemur, tarsier, loris, tree
shrew, marmot/prairie dog sentinel, beaver, otter, muskrat, porcupine, skunk, badger,
raccoon, red panda, fennec fox. Keep everything small-and-round, not large-animal proportions.

Poses: walking, sniffing nose-up, sitting on haunches, standing upright, grooming, curled
asleep, stretching, scurrying low, leaping, carrying something. Outline details: whiskers
(sparingly, never hairline mess), ear shape and position, tail carriage, fur breaking the
outline on fluffy species.

Signature features to lend: ears (round, long, bat, tufted), tails (mouse, bushy, tufted,
cottontail), whiskered pointed snouts, hedgehog and porcupine spines, bat wings. Default
eyes: a small white dot.

## State
Updated 2026-11-13 (species-builder run on main, continuing the interrupted WIP; four review
rounds plus stacking checks). Sheets: `out/roads/03-mammal-species.png`,
`out/roads/03-mammal-mixes.png`.

- **38 species** (was 41 unreviewed; lemming, guinea pig and tenrec cut as muddy blobs that
  duplicated vole / hamster / hedgehog at print size). Mean ~7 ms per critter.
- **Strong**: house, wood and harvest mice (stalk climber), jerboa, kangaroo rat, rat,
  elephant shrew, mole and star-nosed mole (molehill), hedgehog (walking and rolled), red
  squirrel, chipmunk, flying squirrel / sugar glider, rabbit, hare, stoat (periscope), bat
  (rewritten: one clean outline per wing, wrist high, four finger tips joined by curved
  scallops; spread, raised-V and downstroke poses), porcupine, skunk, prairie dog, beaver,
  bushbaby, fennec fox, raccoon (now hunched with ringed tail), opossum (babies bigger).
- **Weak, by name**: pangolin (shingled saw-tooth back and tail read as "armoured", not
  clearly pangolin; rolled form is a busy curl), otter (float pose is a long low log at
  print size), badger (generic low wedge), pika and hamster walking (potato blobs, rely on
  ears and sprig), red panda (close cousin of raccoon), tarsier (one pose only).
- **Poses**: walk/stand/trot, sniff nose-up, scurry, leap/lope, stretch (play-bow, house
  mouse), sit holding food, groom, standing sentinel/periscope, curled asleep (dormouse
  with its tail wrapped round as a separate band), rolled (hedgehog, pangolin), climbing a
  stalk, gliding, flying, floating, surfacing from a molehill, carrying in the mouth.
- **New shapes this run**: `mammalBat` wings; `mammalBatWing` dorsal (lent bat wing, side
  and top view, skipped on the bat's own chassis via `plan.mBat`; scaled by
  `clamp(plan.r, 6.5, 10)`); `mammalScales` dorsal and `mammalScaleTail` tip (pangolin,
  one serrated outline each); wrapped tails (`wrap: [a0, a1, gap, widthK]` on brush and
  scale tails; used only when the chassis exposes `plan.wrap`, i.e. `mammalBall`); ringed
  tails (`bands` on `mammalBrush`).
- **Decisions**: crawling bat cut (never read as a bat; flight only). Curled fennec cut
  (read as a rabbit loaf); fennec gained a sniffing pose instead. Lent mammal ears get a
  minimum size (`!C.mHead`: set by `mammalHead`) and, on a single top mount of a rooted
  thing (mushroom cap), splay as a pair. Default standing height lowered (mice standing
  were too tall).
- **Next**: a distinct pangolin (bipedal ground pangolin walk, bigger rounded scales);
  otter swimming/porpoising pose; badger digging; tarsier and red panda second poses;
  marmot as its own species; lemming back only with a distinct pose.

### M2 fix run (2026-11-13)
Addressed the critic's "would bother" items; 38 -> 36 species.
- Cut vole and pika (potato blobs; house/wood mouse cover vole, pika had no outline cue).
  Hamster now mostly sits upright with cheek pouches (walk pose weight 0.7); chinchilla keeps
  its big ears plus curled brush tail.
- Badger rebuilt: bigger, flat back, high clearance with thick legs and big fore paws, head
  carried low; reads as a squat digger on legs, clearly apart from the paddle-tailed beaver.
- Bat: larger body, longer arm/fingers, wings mostly raised (elev 0.55-1.1), so it is a
  V or W outline instead of a flat sliver.
- Pangolin: dorsal scales doubled in count at half size, so the back reads as shingles
  not saw teeth. Otter float shortened (19-23) so it is not a log.
- Still weak: rolled pangolin (big curl), red panda (raccoon clone), mole vs star-nosed
  mole heaps, tarsier/bushbaby same clinging pose, shrew vs otter walk somewhat alike.
