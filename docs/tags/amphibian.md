# Tag: amphibian

File `src/gen/tags/amphibian.js` · id `amphibian` · label "Amphibians" · short "Amphibians"

"Amphibians in general." The salamander tag owns Caudata in depth, so here frogs and toads
are the bulk, with tadpoles, caecilians and a few newt/salamander forms at low weight.

A frog silhouette lives or dies on the hind legs (the folded Z of thigh, shin and long
foot), the head wedge with bulging eyes breaking the outline, and posture. The first-pass
frogs had lumpy heads and stick hind legs.

Cover: common frog sitting, bullfrog (heavy), tree frogs with round toe pads (clinging,
climbing), toads (squat, warty outline, short legs, walking not hopping), spadefoot, horned
/ pacman frog (huge mouth, horns over eyes), Surinam toad (flat as a leaf, star fingers),
tomato and rain frogs (spherical, tiny legs), glass frog, poison dart frog (slim, upright),
leaf-litter frogs with pointed snouts and eyelid horns, flying frogs with huge webbed feet,
midwife toad carrying eggs, fire-bellied toad in unken reflex, African clawed frog (flat,
splayed, top view), frog mid-leap fully stretched, frog swimming with a kick, frog from
above splayed, frog from front; tadpoles at every stage (plain, hind legs only, froglet);
caecilians (ringed limbless, coiled or looped). Inflated throat pouch (calling) is a lovely
outline feature. Vary viewpoint: side sitting, top, three-quarter.

Signature features to lend: folded jumping hind legs with long webbed feet, bulging top-set
eyes, toe pads, inflated throat, tadpole tail. Default eyes: a small dot only where it
helps; most should read without.

## State
2026-11-14 critic fix round (judged at --cell 60), still **25 species**. Four-legged tadpole:
round fat body-blob (short topBody, wide profile), small head, stub legs, much fatter tail fin.
Surinam toad: bigger squarer body, smaller narrower pointed head, thicker arms reaching
straight forward, huge 5-toe webbed hind fans; Surinam-bodied mixes with every tag checked
(rows `amphibian+<tag>@Surinam toad` in the mixes sheet): foreign heads/tails sit sanely,
never legless. Hairy frog: 13-17 thicker, longer filaments from flank to thigh. Midwife
toad: eggs ~1.4x larger (reads as a grape cluster behind the rump). Walking toad: legs
much longer, body high, wide near/far stride. Crested newt: own dorsal `amphibianCrest`
with 5-7 broad flat-topped teeth (shared `crest` teeth were hairlines). Weakest now:
crested newt (crest small at print size), midwife toad (egg cluster is a lump more than
beads), hairy frog (fringe reads as a skirt), four-legged tadpole (legs barely visible).

2026-11-14 M3 taste run: **25 species** (was 28). Cut horned frog, coiled caecilian, poison
dart frog (user rejects). Surinam toad redrawn on its own chassis `amphibianPipa` (draws
body, head and limbs whole; limb genes ignored on it, `amphLimbless` so foreign legs skip
it): flat rounded-square body a little wider at the hips, flat straight-sided triangular
head, thin arms reaching forward with four long fingers ending in star tips (dot cross),
big five-toed fully webbed hind feet swept out behind on short thighs. Reads apart from
the flying frog's X at --cell 60. Weakest now: four-legged tadpole, crested newt, midwife
toad (eggs small), hairy frog, walking toad (low at print size).

2026-11-13 M2 fix run 2 (judged at --cell 60 only): cut narrowmouth toad (never read apart
from horned frog/common toad at print size). Horned frog: always gaping, much longer brow
horns. Common toad: bigger parotoids, fewer larger warts, thicker limbs. Flying frog: shorter
thick legs, long fully webbed 4-toe feet as solid paddles front and back. Surinam toad: wide
square flat body, arrow-pointed head, short stubby legs, thick star-tipped fingers. Species
count now 35 minus 1 = 34 (approx; see sheet).

2026-11-13, after review rounds 1-4. **35 species** (was 37 unreviewed). Sheets:
`out/roads/03-amphibian-species.png`, `out/roads/03-amphibian-mixes.png`.

Strong: common frog, tree frog, poison dart frog, calling frog (throat pouch), tongue-flicking
frog, leaf-litter horned frog, frog on a lily pad, frog from the front, leaping frog, swimming
frog, flying frog, climbing tree frog, Surinam toad, African clawed frog, tadpoles (all four),
froglet, caecilian / coiled caecilian, walking toad.

Weak, by name: **rain frog** (a ball with feet; real but low information), **spadefoot**
(round toad told apart only by the big eye), **horned frog** (pacman; gape notch helps but it
is still mostly a blob), **fire-bellied toad unken** (odd U at print size; weight 0.7),
**hairy frog** (the fringe reads as a shaggy rump rather than flank hair), **midwife toad**
(egg string is small at print size), **crested newt** (crest reads as lumps; weight 0.7).

How it works / decisions:
- All amphibian limbs are drawn by `feet.amphibianLeg` (gene `len: NaN` blanks the shared
  `limb()`, which then calls the foot once per socket). Side-view sitting hind leg
  (`sideHind`) is now a real folded Z: thigh forward and down to a knee that pokes out under
  the belly, shin back to a heel under the rump, long foot forward along the line. Walking
  species use `stride: true` (old two-bone leg). The sit chassis takes `seat` (belly height
  above the line, in r) so the haunch shows; round species sit low (0.1-0.3), frogs 0.75-0.95.
- Body tubes get round ellipse end caps (`bodyTube`): tube() caps were faceted on fat bodies.
- Top-view `sit` pose: knee out at the side, shin back, foot forward-out past the knee.
- Far fore arm sits behind the near one (no parallel-stick sliver).
- Frog head `gape` opens the mouth (pacman). Midwife eggs: a bead string looping from the
  hips to the heels. `amphibianPad` draws the sit chassis through a shifted ink and moves
  the plan and the limbs' ground onto the pad.
- Limbless species (tadpoles, caecilians) lend frog legs (`ownNone`) and `amphibianNone`
  lends a plain frog head, so a mix never gets a headless or legless body from them.
- Cut: glass frog (identical to frog from above in outline), newt from above (salamander
  tag covers it), reed frog (muddy at print size), tomato frog (merged into rain frog).
  Added: frog on a lily pad, hairy frog.
- Newts kept to one low-weight side-view crested newt to stay clear of the salamander tag.
- Speed: about 5-7 ms per critter (coiled caecilian about 9 ms), almost all in Ink.finish.

Ideas not done: three-quarter view; Darwin's frog nose; Titicaca skin folds; star tips on
Surinam fingers; a lily flower on the pad.

### M2 fix run (2026-11-13), 37 -> 30 species
- Cut the round-lump cluster down to three with distinct cues: horned frog (tall brow points), narrowmouth toad (pointed snout), common toad (parotoid + warts). Cut bullfrog, rain frog, spadefoot.
- Cut fire-bellied toad unken (read as a flipped animal).
- Top views merged to swimming, climbing tree, flying, Surinam; cut frog from above, toad from above, African clawed. Top-view digits now thicker (tr 0.12 default) and 3 fingers per hand by default.
- Tadpoles with legs: short stubby 3-toed hind legs, fatter tail fin. Four-legged tadpole still slightly lizard-like (weakest).
- Hairy frog: fewer, longer flank tufts. Midwife toad: bigger eggs. Crested newt: chunkier body, taller wavy crest.
- Not done: amphibian+salamander mix contribution (queued for M4 with mount/scaling work).

### Hybrids (M8 phase 1, 2026-11-14, automated scan, not yet judged by eye)

Within-tag hybrids are on by default (`hybrid` 0.85, see AUTHORING.md "Within-tag hybrids"). No throws over 2000 seeds. Worst combinations found by a heuristic over 3000 seeds (base + borrowed slot; "detached" = the silhouette falls into separate pieces where the pure base does not; "very long/tall" = aspect over 5:1):

- looped caecilian + dorsal of midwife toad: 2/4 detached

Use the species `hybrid: { never, keep, noLend }` hints to fix these in phase 2.
