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

**2026-11-16 M8 phase 3 fixes** (BRIEF chimera taste check): 51 species, no new ones.
Sheet `out/roads/08-arthropod-chimeras.png` (seeds 1000-1507, hybrid 1, cell 60).
- Fewer generic crabs: shore crab w 3 -> 2.2, fiddler crab w 2 -> 1.5 (pure frequency only).
- Crab-form chimeras with arthropod legs pick a claw style (rng, chimera only): plain 1,
  long slender squat-lobster arms 1.3, spiked king-crab arms 1.1, or long feelers sweeping
  over the claws 1.2 (the seed-1406 effect the user liked). Pure crabs unchanged.
- Borrowed scorpion stings scale to the receiving body: chain form sting socket 0.62 x body r
  (was 1.5 x, the chunky tail of seed 1503), other foreign chain tails 1.1 x; every chassis
  caps a foreign sting at 0.6 x plan r. Fans/whips/cerci on other bodies checked, look sane.
- Weight change reshuffles which seed is which chimera (hybrid picks use species weights).

**2026-11-14 M8 chimera fix round** (after shared f620c27, seeds 1000-1047, hybrid 1): 51 species.
Sheet `out/roads/07-arthropod-chimeras.png` (seeds 1000-1711, cell 60).
- Every slot gene carries a non-enumerable `arthroForm` (the body form of its species); the
  chassis calls a part foreign when its form differs (`foreignOf`), and a critter with any
  foreign head/limbs/tail/crown is a chimera (`K.chim`, plan `arthroChim`).
- Chain and plated chimeras: foreign tails/heads get sockets sized to the body (a sting or tail
  fan now shows), borrowed clawed legs draw a pair of front pincers (`chimPincers`).
- Long forms (plated, trilobite, stomatopod, chain, lobster, eurypterid, radiodont, marrella)
  lie flat (rot 0) in chimeras: no more bodies standing on end.
- Shield (triops, horseshoe) chimeras with borrowed legs draw them past the rim (no legless
  ovals); triops head socket moved onto the carapace (antennae were floating off the front).
- Insect-form chimeras: min thorax 3.2, abdomen 3.4, leg width 2.1 (no hairline sticks).
- Antennae on chimeras capped at 2.6 x body r and drawn a bit thicker. Hermit shell 0.8x.
- Still weak: small side-view mantis/stick chimeras (thick enough now, but small in the cell),
  trilobite chimeras with hornworm/beetle bits (lumpy), squat-lobster chimeras laid flat with
  crossing antennae, occasional thin worm-form chimeras (1209, 1710), weevil heads on crabs.

**2026-11-14 M8 phase 2 (chimeras at hybrid 1)**: 52 -> 51 species (woodlouse cut, user decision).
Sheet `out/roads/07-arthropod-chimeras.png` (8 seeds x 12, cell 60).
- Root cause of thin/sparse chimeras: `hybridize` copies the chassis gene by spread, which drops
  the non-enumerable `root`, so the body thought its legs were foreign and the shared limb()
  drew hairline LEND legs. Fix inside the tag: every LEND gene carries `lift: ARTHRO_LIFT`
  (0.7317, a constant, so blends keep it exact); the body draws its own legs when
  `C.lift === ARTHRO_LIFT` and no root. (Shared fix would be: keep `root` or pass the gene set.)
- `rot` was blended between 0 and UP (diagonal bodies): snapped to the nearer view.
- Hints: wings (`noLend: dorsal`) of mantis, cicada, treehopper (black wing blobs on top-view
  bodies); `noLend: chassis` for spindly or odd bodies: stick insect, water strider,
  hallucigenia, harvestman, house centipede, treehopper, both barnacles, marrella, pill bug.
- Weak still: some side-view `insect`-form chimeras come out thin; chain-form (centipede-like)
  chimeras read familiar; occasional pillball/hermit heads oversized. Foreign genes with
  form-specific meanings blend by name (W, legL), so proportions sometimes land small.

**2026-11-13 M3 taste run**: 64 -> 52 species. Cut the 21 BRIEF rejects (ant, bumblebee,
butterfly, coiled millipede, copepod, crane fly, dragonfly, dung beetle, flea, fly, giant water
bug, grasshopper, hairy caterpillar, inchworm, ladybird, longhorn beetle, mayfly, millipede,
moth, wasp, water flea). Forms flyer/copepod/daphnia/worm-millipede code kept (unused paths are
harmless; hornworm still uses worm).
- Mantis shrimp redone as a top-view bespoke form `stomatopod`: stalked eyes, antennal scales,
  big folded raptorial claws (smasher club or spiked spearer), abdomen widening to a spined
  telson and uropods. No longer a tube.
- New (9): king crab (crab shape 'king': spiked carapace, spiked thick legs), coconut crab
  (shape 'oblong' + tucked abdomen lobe `abd`), spiny lobster (`spiny` carapace spikes, thick
  antennae), squat lobster (long slim arms), whip spider (spider `palps`: spiny raptorial
  palps, whip first legs), camel spider (spider `chel` jaws, lobed abdomen `abdSeg`), trident
  trilobite (trilobite `trident`), arthropleura (long plated), marrella (bespoke form).
- Weakest new: marrella (crossbow-like at print size), arthropleura (a legged loaf; plated legs
  still comb one edge), spiny lobster (busy), camel spider (jaws small at cell 60).
- Older weak still: pill bug, treehopper, anomalocaris/opabinia small, hornworm.


**2026-11-13 M2 fix run 2** (critic `out/tmp/critic2-arthropod.md`, judged at --cell 60): still 64 species.
- Mantis shrimp: 5 segments, front raised (tilt -0.3), little curl, wide spined tail fan,
  long eye stalks, raptorial claw redrawn as a folded knob held forward. No longer a tube.
- Crab spider: front legs held sideways with mild forward curve, rear legs 0.7 L and
  visible, smaller abdomen; no longer a horned bull head.
- Thickened for print: harvestman (legW 3.8, bigger body), water strider (legW 3.6, wider
  body), stick insect (shorter, ty 2.6, legs w 2.3), grasshopper (ty 4.3-4.9, ax 13-16,
  hind femur w 4.6-5.2). Stick insect is still the slimmest form on the sheet (by nature).
- Open minor: pill bug ragged, anomalocaris/opabinia small, treehopper star.

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

### 2026-11-14 follow-up (critic fixes at --cell 60)
- Marrella: thinner, shorter horn pairs swept back; gill-legs on every other segment, longer, with two bristles each, fringing both sides.
- Arthropleura: now head-up (rot UP) so both leg rows show; slimmer, 10-12 plates; legs drawn as `stub` leaves (plated form, `g.stub`) because jleg legs vanished on one side.
- Mantis shrimp: raptorial claws folded short beside the head (no more antlers); larger stalked eyes; bigger telson and uropods. Still the weakest of the six at print size (head end a dark mass).
- Squat lobster: short, chunky, spread claws. Spiny lobster: side spines removed (`antB` gene), thick antenna-base leaves, antennae w 0.85.
- Camel spider: big cephalothorax, larger and wider jaws, narrow pointed abdomen, thinner legs.
- Watch: old trilobite reads as a blob; woodlouse and pill bug plain; mantis shrimp head.

### Hybrids (M8 phase 1, 2026-11-14, automated scan, not yet judged by eye)

Within-tag hybrids are on by default (`hybrid` 0.85, see AUTHORING.md "Within-tag hybrids"). No throws over 2000 seeds. Worst combinations found by a heuristic over 3000 seeds (base + borrowed slot; "detached" = the silhouette falls into separate pieces where the pure base does not; "very long/tall" = aspect over 5:1):

- triops + crown of spiny lobster: 3/3 detached
- triops + tail of lobster: 3/3 detached
- triops + dorsal of spider crab: 3/3 detached
- triops + tail of spiny lobster: 3/3 detached

Use the species `hybrid: { never, keep, noLend }` hints to fix these in phase 2.
