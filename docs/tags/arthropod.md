# Tag: arthropod

File `src/gen/tags/arthropod.js` · id `arthropod` · label "Crustaceans & arthropods" · short "Arthropods"

The user's words: "various odd crustaceans and arthropods", so favour the odd and the
crustacean over a generic bug. Segmentation must show in the OUTLINE (scalloped or stepped
edges), since white seam lines are off by default. Arthropod silhouettes are about crisp
articulated structure: a clear tagma plan, legs with real joints and tapering segments,
characteristic appendages.

Crustaceans: shore crab, fiddler crab (one giant claw), spider crab, box crab, hermit crab
in a spiral shell, coconut crab, lobster, crayfish, squat and slipper lobsters, shrimp and
prawn in side view (curved abdomen, tail fan, long antennae, rostrum), mantis shrimp,
krill, amphipod (curled sandhopper), isopod/woodlouse and giant isopod, rolled pill bug,
copepod (teardrop, long antennae, egg sacs), ostracod, barnacles (acorn cluster, goose
barnacle on a stalk), horseshoe crab, triops, fairy shrimp, daphnia, spiny crab zoea.
Chelicerates: scorpion, pseudoscorpion, vinegaroon, harvestman, orb spider, jumping spider,
crab spider, tick/mite, sea spider. Myriapods: centipede, house centipede, millipede walking
and coiled. Insects (odd and outline-rich): stag, rhinoceros/hercules, weevil, longhorn
beetles, ladybird, dung beetle with ball, earwig, mantis, stick and leaf insects,
grasshopper, mole cricket, cicada, treehoppers with bizarre helmets, dragonfly and damselfly
(top view, wings out), moth, butterfly, lacewing, antlion, mayfly, ant, wasp, bee, fly,
crane fly, flea, water strider, giant water bug, silverfish, caterpillars (looper, hairy,
hornworm). Extinct oddities welcome: trilobites, eurypterid, anomalocaris, opabinia,
hallucigenia.

Viewpoint by form: top view for crabs, beetles, spiders; side view for shrimp, mantis,
grasshopper, caterpillars (standing on the ground line). Signature features to lend:
pincers, jointed leg sets, antennae, segmented abdomen or curled stinger tail, tail fan,
carapace plates, beetle horns, insect wings. Default eyes: none (stalk eyes that change the
outline are welcome).

## State

**2026-11-13 M2 fix run** (critic list `out/tmp/critic-arthropod.md`): still 64 species.
- Shrimp: taller legs, stronger hump and curl (hang 1.3) so the arched, tail-curled profile
  survives; no longer a low caterpillar tube. Mantis shrimp: deeper body, shorter, eye stalk
  (`eyeStalk` in `FORMS.shrimp`), much bigger raptorial claw. Still the weakest crustacean.
- Spiders split: orb = big abdomen, small cephalothorax, long legs; jumping = boxy big
  cephalothorax (`box`), short stout legs; crab spider = two long front pairs held sideways,
  short back pairs; tick = egg body, capitulum (`capit`), short stout legs clustered forward.
- Harvestman legs 1.7 -> 2.5 and bigger body; water strider legs 1.6 -> 2.4, wider body.
- Horseshoe crab, triops, anomalocaris, opabinia, eurypterid, pseudoscorpion: rot 0 only
  (no tail-down spade views).
- Radiodonts: 6-7 rounded lateral lobes on a narrower body; outline now scalloped.
- Not done (minor): treehopper body, pill bug notches, flea, acorn barnacle size, longhorn
  antennae. Weakest now: mantis shrimp, pill bug, flea, treehopper, hairy caterpillar.

2026-11-13, review run (continued the interrupted 28-species WIP; commits 451fce9..). **64 species**
(was 28). Sheets: `out/roads/03-arthropod-species.png`, `out/roads/03-arthropod-mixes.png`.

**Forms** (one chassis `arthropodBody` dispatching to bespoke forms in `FORMS`):
top view `crab`, `lobster` (also clawless slipper lobster), `scorpion`, `spider`, `chain`,
`plated`, `trilobite`, `beetleTop`, `flyer`, `shield` (horseshoe crab, triops), `radiodont`
(anomalocaris, opabinia), `eurypterid`, `copepod`; side view `shrimp` (shrimp, mantis shrimp,
sandhopper), `insect` (grasshopper, mantis, ant, wasp, bumblebee, weevil, rhinoceros and dung
beetles, cicada, treehopper, stick insect, mayfly, flea), `worm` (inchworm, hornworm, hairy
caterpillar, millipede, coiled millipede), `pillball`, `hermit`, `hallu`, `daphnia`, `barnacle`
(rooted), `zoea`.

**Strong**: shore and fiddler crab, horseshoe crab, triops, trilobite (classic / spiny /
wide), hermit crab, scorpion, stag beetle, slipper lobster, antlion larva, copepod, grasshopper,
praying mantis, millipede, inchworm, sandhopper, crab zoea, eurypterid, hallucigenia, butterfly,
dragonfly, earwig, jumping and orb spider.

**Weak** (candidates for the next pass): mantis shrimp (reads as a generic segmented bug; the
raptorial claw is small), pill bug (a ragged ball, plates barely read at print size), fly (top
view reads a bit like a cat face), bumblebee (lumpy), flea (a hunched bug more than a flea),
anomalocaris and opabinia (flaps merge into a smooth oval; recognisable mainly by the tail fan,
arms / proboscis), acorn barnacles (small), hairy caterpillar (spiky rather than furry), woodlouse
(comb of legs along the top edge).

**Decisions**
- Legs are one outline each (`jleg`): a single tube with a swell after each joint, 2-3 samples
  per segment. `Ink.finish`'s soften pass dominates generation time; centipede p50 ~15-20 ms,
  lobster ~15 ms, everything else under ~12 ms (most 3-8 ms). Centipede segment count reduced
  to 12-15 for speed.
- `tleg` gets per-leg pose jitter from the chassis rng (module `JR` set while a form draws), so
  no two crabs/spiders/beetles stand alike; butterflies and moths vary wing scale and tilt.
- Side-view insect legs use an explicit knee (`ka` angle, femur `f`, tibia slant `tx`) rather
  than IK, so knees sit outside the body; grasshopper/flea hind legs are `jump` legs, mantis
  forelegs `raptor`, dung beetle hind legs `push` against the ball.
- Paths returned by side-view forms run tail -> head (the convention `arthropodWings` relies on
  to find "backward"); folded wings (`fold` kind) lie back along the abdomen.
- `TAIL(kind, { len })` stores the kind's length as `tlen`: the shared `tail()` uses `len` for
  its own stub, which had been drawing a long thin rod in front of every forceps / cerci / whip.
- Flyers (butterfly, moth, dragonfly, crane fly, fly) keep their own wings when another tag
  lends the dorsal slot (the wings are their identity); the lent dorsal is drawn as well.
- Spider leg sockets are scaled from leg length so foreign limbs are not stubs.
- Cut: mole cricket (digging forelegs never read in the outline). Not done from the list:
  squat lobster, box/coconut crab, krill, ostracod, fairy shrimp, sea spider, tick vs mite split,
  lacewing, leaf insect, ladybird side view, caterpillar variety beyond three.
- Known cross-tag issue (not ours): plant species (baobab, radish) put their tail socket off
  the body, so any lent tail floats beside them.
- Review tooling used: `out/tmp/arsheet.sh` renders from a private copy of `src/gen` at git HEAD
  plus this tag's draft (`--zoom` lifts the sheet's 1.6x cap), `out/tmp/artime.mjs` (timing,
  holes, detached parts), `out/tmp/arslot.mjs` / `arhost.mjs` (lent slots both ways).
