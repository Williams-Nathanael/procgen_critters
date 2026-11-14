# Tag: salamander

File `src/gen/tags/salamander.js` · id `salamander` · label "Salamanders" · short "Salamanders"

The user's headline example ("have e.g. little salamanders show up"); they expect
salamanders to be pure silhouette with no white. The first-pass top-view S-curved crawler
already read well; that quality is the floor.

Cover order Caudata properly: fire salamander (stocky, blunt), tiger and spotted
salamanders, slender and worm salamanders (tiny limbs, very long), lungless woodland
species, long-tailed and cave salamanders, giant salamanders and hellbender (broad flat
head, skin folds, paddle tail), mudpuppy and axolotl (feathery external gills, tail fin),
olm (eel-like, thin limbs), sirens (forelimbs only, eel body, gills), amphiuma (vestigial
limbs), newts in terrestrial and aquatic phases (crested newt with jagged dorsal crest and
tail fin, smooth and palmate newts with tail filament and webbed hind feet, red eft, ribbed
newt), larval forms with gills and tail fins.

Vary viewpoint and pose, since dozens are seen at once along a border: top view walking with
different body waves, curled C and tight S, tail coiled, looking back over the shoulder;
side view walking, raised head or raised tail, newt swimming with limbs tucked, the unken
defensive arch. Toes matter (four front, five back, rounded tips). Avoid drifting into
lizards: no claws, no scales, moist rounded forms, short sprawled legs. Frogs, toads,
tadpoles and caecilians belong to the amphibian tag.

Signature features to lend: the long expressive tail, splayed limbs with rounded toes,
external gills, newt crest. Default eyes: none.

## State

Updated 2026-11-13 (review run on main; sheets `out/roads/03-salamander-species.png`,
`out/roads/03-salamander-mixes.png`).

**29 species**, all kept: fire, spotted, tiger, mole; red-backed, slender, long-tailed, cave,
ensatina, arboreal, web-footed, spectacled; giant salamander, hellbender; mudpuppy, axolotl,
olm, siren, amphiuma, blind cave salamander; great crested, smooth, palmate newt, red eft,
rough-skinned, ribbed, crocodile newt; salamander larva, newt larva. Two bespoke chassis
(`salamanderTop` on a free centreline with walk / ess / curl / ring / coil / look / eel poses,
`salamanderSide` with walk / alert / tall / unken / tail-curl / swim), own head, feet, whole-tail
tip, gills crown, crest and warts dorsals.

**Strong:** fire, spotted, tiger, red-backed, long-tailed, cave, arboreal, spectacled (top-view
coils), hellbender, giant salamander, axolotl (side and top gills), great crested and smooth
newt (side view with crest), red eft, blind cave salamander, slender (coils and rings).

**Weak:** amphiuma (a plain thick eel; only its tiny legs say salamander), siren (bushy gills
read as a lump from above), rough-skinned newt unken pose (a big C tail, a little scorpion-like;
weighted down), newt larva (busy at print size), web-footed (close to arboreal), ensatina
'tall' pose (raised tail still a bit lizard/squirrel), mole salamander top view (stubby).

**Decisions this run:**
- Top-view trunks lengthened (path x1.18 and longer species `len`) and the head narrowed to
  just under trunk width (`wid` x0.84, length x1.22): the first WIP read as toads with ball
  heads. Necks widened on stocky species to stop the bulb-head look.
- Side view: belly lifted (`liftK` 2.9), legs shorter, thinner and nearly straight
  (`sideLegs`), near/far leg of a pair spaced a foot-length apart; long bent legs merged into
  blocks. Swimming newts fold their legs back, near side only.
- Gills: explicit side-view fan (three rami rising from the top-rear of the head), longer rami,
  webbed crotches; forelimbs are steered out of the gill zone.
- No trapped white: top-view limbs are steered (`clearDir`) clear of body, head, gills and tail
  base; the tail avoids predicted feet and straightens when it cannot clear. About 8% of
  critters still enclose one small gap (mostly hind leg against a curled tail), down from ~40%.
- Lent tails on other chassis are capped at 3.2 x the host's body radius.
- Defensive poses toned down: unken tail thinner and lower, ensatina tail tip droops,
  spectacled tail curl smaller. Ensatina/olm/larva 'curl' poses dropped (made folded blobs).
- Toes are single polygons; fire/spotted spots reduced. Generation p50 about 8 ms, p99 about
  17 ms at detail 0.6; most of the time is in the shared `Ink.finish` (offset/union).
- Review renders used a private mirror (other tags at git HEAD) because another worker's
  uncommitted `plant.js` briefly broke the shared import.

### M2 fix run (2026-11-13)
- Slender / long-tailed: tail curl capped (new `T.curlMax`, clamps top-view tail curl) and body curl clamped via poseFix; 'curl'/'ring' poses dropped. No more vertical J/fishhook layouts. Slender thickened (r 3.6-4.0) so it is not a hairline at print size.
- Amphiuma: thicker body, shorter, broader head, longer visible stubby legs, gentler wave (waveK 0.55), adds 'walk' pose. Now reads as an eel-salamander with legs.
- Smooth / palmate newt: top view now dominant (side poses ~15%); side legs longer/thicker (sideLegK 0.95, sideLimbS 1.25), feet bigger.
- Rough-skinned newt unken weight 1.8 -> 0.35; ensatina 'tall' 3 -> 1.2.
- Not done (minor): axolotl side spiky blot, siren top gill lump, top-view template sameness, hellbender/giant side view still somewhat sausage-like.

### M2 fix run 2 (2026-11-13)
- Spectacled salamander: tailcurl (scorpion C over back) pose dropped; now walkS/coil/walk.
- Rough-skinned newt: unken (tail-over-back) pose dropped.
- Slender salamander: body radius 3.6-4 -> 5.4-6, shorter, longer/thicker legs (limbS 1.4); reads as a salamander at 60px.
- Siren: eelcoil (vertical hook) pose removed; eel/ess only.
- Still minor: ensatina tall pose, hellbender/tiger side-view sausages.

### M3 taste run (2026-11-14): sturdier legs
- New species gene `stout` (in `make`): limb width x stout, length x(1-0.3(stout-1)), taper >= 0.8; side view keeps 95% width (not 78%) and 0.85 length so stubs show.
- 14 of 29 species stout, chosen where thick limbs are true to the animal: fire, spotted, tiger (1.4), mole, giant, hellbender (1.3), mudpuppy, axolotl (1.5), cave (1.35), great crested, red eft, rough-skinned, ribbed, crocodile newt (1.4). Plethodontids (red-backed, slender, long-tailed, arboreal, ensatina...), eels and larvae keep slender limbs.
- Still weak: mole salamander top view (fat, occasional curled-tail trap), hellbender/giant side view sausage, amphiuma, siren top gills, newt larva.
