# Tag: fungus

File `src/gen/tags/fungus.js` · id `fungus` · label "Fungi" · short "Fungi"

The user singled this tag out: "There exists an incredible diversity of fungus forms, even
in silhouette, and it should be possible to draw on hundreds of them rather than all 'stem
and cap' designs." So stem-and-cap must be a minority of the library.

Cover the real range: agarics of many habits (fly agaric with ring and volva, parasol,
inkcap/shaggy mane, bonnet clusters on thin stems, honey-fungus tufts, bolete with fat stem,
wavy-capped blewit, deceiver), chanterelle and trumpet funnels, morels and false morels,
stinkhorns and veiled lady (skirt), puffballs and giant puffball, earthstars, earthballs,
bird's-nest fungi, cup and goblet fungi (scarlet elf cup, orange peel), bracket/shelf fungi
and turkey-tail tiers on a stub of wood, chicken-of-the-woods rosettes, oyster shelves,
coral and club fungi (branched clavaria, candlesnuff/stag's-horn, earth tongues, dead man's
fingers), tooth fungi (hedgehog, lion's mane cascade), jelly fungi (witch's butter, wood
ear, jelly antler), cauliflower fungus, hen-of-the-woods, truffles, cordyceps on a stalk,
lattice/cage fungus (clathrus), octopus stinkhorn (devil's fingers), fairy-ring fragments,
lichens if they help (pixie cups, reindeer lichen).

Clusters and troops (several fruiting bodies from one base, differing sizes) are essential
to fungal character. Fungi are rooted side-view forms. When this tag lends parts to
animals: caps as heads or hats, little mushrooms or brackets growing from a back,
gills/frills, puffball tails and coral antlers read well. Default eyes: none.

## State (update this section when you work on the tag)

### M8 phase 2 fix round (2026-11-14, critic sheet seeds 1000/1100/1200, --cell 60, hybrid 1)
- 41 species (unchanged). Lone-stalk species (`LONE` = `hybrid: { noLend: ['chassis'] }`: fly agaric,
  parasol, penny bun, wood blewit, witch's hat, funnel cap, hedgehog, horn of plenty, morel, false
  morel, veiled lady, devil's fingers, lattice cage, earth tongue, hare's ear) no longer give a chimera
  its body, so bodies are clusters, troops, brackets on wood, corals, cups, crusts and mounds.
- Stalk trimming: stems record each stalk's polygons (`pen.last`); a chimera head takes them back
  out of `ink.k` (and the ring if above the cut) and redraws the stalk to suit its kind: stalked heads
  get at most ~1.5 head heights, balls/cups/vases a stub, arms a stub plus a small egg. (Painting the
  top out with 'w' does not work: whites keep a black margin outline.) Ground-seat stalks also ~1.5x
  head height, thicker. Grass is removed on chimeras (it was placed for the old fruit bodies).
- `FBH`: hare's ear / earth tongue heads become a clump of 3 cupped ears on a knob; stag's horn/coral
  heads are stouter (wid >= 0.42, depth 2, shorter). Wide flat caps on chimeras scale to 1.9 w and tip
  0.15-0.4 rad. Jelly-ear heads grow from a knob. Pure jelly ear: pale fold is an open C, not a spiral.
- Weak, by name: flat heads (turkey tail, chicken, parasol, wood blewit) on row chassis (bird's nest,
  stag's horn twig, fairy ring) still give thin low "tables"; coral x veiled lady skirt dome; giant
  puffball x parasol. Worst time ~22 ms (honey tuft x lattice cage), a few seeds per 800 over 15 ms.

### M8 phase 2: chimeras (2026-11-14, judged at --cell 60, hybrid 1)
- **41 species** (was 42): oyster mushroom cut (user). Jelly ear redone: 2-3 wrinkled, lobed ears
  (new `jwrink` drawer, thick pale rim fold like an ear's helix) hanging off the sides of a slim
  upright snag; no lying log, so no flat baseline and no snail read. Could be more wrinkled.
- **One organism per chimera**: the chassis no longer draws its fruit bodies; it records their
  seats (`plan.fungus.fbs`: side stalks, body-seated heads, wood items) and `heads.fungusFB`
  draws them. When the head comes from a different parent (`hid` string set in `build`), every
  seat takes the head's kind, sized by span ratio (`(own/head span)^0.75`, clamped 0.62-1.3), so a
  troop/tuft/log carries one kind of fruit body. Stalked kinds (`STALKED`: caps, inkcaps,
  thimbles, saddles, morels, brains, cages, manes) landing on a ground seat grow a stout stalk.
  Wood stubs without items get the head on top. Veiled-lady skirts shrink to 60% on foreign stalks.
- Fungus limb genes carry a constant `lift` marker (`FZ_LIFT`); when the limbs are fungus (any
  parent) the body grows no legs, the tail socket is zero-size and sibling fungus ornaments
  (growth troops, sprouts, tail tips) skip drawing, so no loose stalks or bits. Foreign tags'
  parts on a fungus chassis are unaffected. Root sliver: max 0.3% of height below the line.
- Weak, by name: devil's fingers / pixie cup heads on thick stalks read as bare "Y"s; ball heads
  (puffballs, earthball) on tall troop stalks read as lollipop trees; earth tongue and hare's ear
  heads as flat blades; cordyceps chassis with a foreign head on the caterpillar is odd but cute;
  fly agaric's narrow neck above the ring looks nearly detached at print size (pre-existing).
- Side seats of a chimera use `lite` fruit bodies (cages at 4 cells) to stay fast: worst case ~21 ms
  (honey tuft x lattice cage), ~0.3% of seeds over 15 ms.
- Sheet: `out/roads/07-fungus-chimeras.png` (3 seeds x 18, cell 60).


### M3 critic fix round (2026-11-14, judged at --cell 60)
- **42 species** (was 43; snow fungus cut: a frond-spray rebuild read as seaweed/coral, the old
  ear-ball as a cloud mound).
- Logs gained `round` (oval sawn end face, no square block); `rings` option kept but unused.
  Log shelves gained `front` (drawn in k2 over a 1-unit white halo, log redrawn in k2 on top)
  and `cap` (new `capShelf`: thin lateral base swelling into a domed, drooping half-cap), plus
  `g.column` (a short common base, k2) for stacked shelves.
- Oyster: thick round-ended log, 2 (sometimes 3) separate domed drooping shelves stacked up the
  end on a short base. 3-shelf version shows the base as a pole; still reads a bit like an "F".
- Chicken: thicker round-ended log, 2-3 tall upright back fans plus 2 lower front fans with a
  pale overlap gap. No longer a hedge.
- Jelly ear: new `jear` drawer (broad ear on a pinched base, one rim notch, pale crescent for
  the cupped hollow). Always two ears of different size leaning apart, never touching.
  Borderline: can read as a pair of snails.
- Hare's ear: new `hare` drawer (tall rounded tongue split at the top into a tall back wall and
  a lower front flap). 2 (or 3) ears of clearly different heights from one base, leaning apart.
  Reads as rabbit ears; passes.

### M3 taste run (2026-11-14)
- **43 species** (was 41; liberty caps cut; jelly ear, hare's ear, snow fungus added).
- Chicken of the woods: a rosette of thick scalloped fans rising from the top of a fallen log
  (new `lobe` drawer; bases buried, no stump joins). Oyster: drooping overlapping tongues
  sprayed from the cut end of a log. Stumps also gained `smooth` (rounded, toothless top).
- Lattice cage: rebuilt `cage` as a real meshed sphere (pole pentagon, triangles, pentagons and
  the mirrored southern half), tilted 0.45-0.75 rad so the pattern sits off-centre; back holes
  and near-silhouette slivers skipped. Reads as a ball of bars at print size.
- New `ear` drawer (lobe with notch, white rim fold, white wrinkle veins). Jelly ear: 2-3 big
  ears on a branch. Hare's ear (Otidea): 3-5 tall split ears in a clump. Snow fungus: a frilly
  ball of 8-11 small crinkled ears on a twig.
- Tried and cut: beefsteak fungus (tongue on a trunk read as a tap), stalked puffball (read as
  a lollipop tree).
- Weak: oyster (fan of shells can read as a wing), snow fungus (cloud-like mound), hare's ear
  (fleur-de-lis at print size when 5 ears), jelly ear (white folds lost at print size, ears
  overlap and cut each other), giant puffball / earthball still blobby.
Updated 2026-11-13 (species-builder run on main; review rounds done). Sheets:
`out/roads/03-fungus-species.png`, `out/roads/03-fungus-mixes.png`.

M2 fix run 2 (judged at --cell 60): lion's mane is now a rounded cascade of 26-34 fine short
spines hung high off a slim snag (no ground-reaching spines, no second stump; was reading as
an elephant). Oyster and chicken of the woods use a slim rootless stub (w 2.2-2.7) with longer,
round-rimmed shelves (rim 0.5) so shelves dominate; oyster shelves droop as tongues. Chicken
still a little blocky when 5 shelves stack. Minor items (puffball, earthball, false morel,
liberty caps, earthstar) untouched.

- **45 species** (was 46 unreviewed; wood ear cut). Stem-and-cap agarics are 13 of 45.
- **Strong**: fly agaric, parasol, shaggy inkcap, bonnet cluster, liberty caps, witch's hat,
  funnel cap, hedgehog, chanterelle, morel, veiled lady, devil's fingers (egg + arms),
  lattice cage (on its volva), earthstar, bird's nest (eggs in the cup), scarlet elf cup,
  coral, stag's horn, dead man's fingers, hoof fungus, cordyceps, elfin saddle.
- **Weak, by name**: giant puffball (still a big blob; context from grass only), cauliflower
  fungus (crinkled mass, blob-like at print size), earthball (lumpy potato with root fringe),
  witch's butter (jelly folds on a branch, reads only as "lumpy"), truffle (now knobbly
  crenellated tubers, but low and small at print size), reindeer lichen vs coral fungus are
  close, pixie cups are a thin strip at print size, hen of the woods could be more rosette-like.
- **Fixed this run**: funnel margins (chanterelle, horn of plenty) no longer feather to
  hairlines; new `vase` form (cups in section with thick walls, goblet option, eggs) for
  bird's nest, scarlet elf cup, orange peel, horn of plenty, pixie cups; brackets rewritten
  (`shelf` keeps a rounded margin, no lollipop knobs; stumps wider/shorter with root flare;
  turkey tail in overlapping tiers, chicken/oyster shelves spaced by real thickness);
  witch's hat and stinkhorn no longer read as arrows; elfin saddle is a draped sheet with
  free flaps, not a palm; truffle is a new crenellated `tuber`; witch's butter uses new
  `jelly` folds; grass tufts snap against a stalk so they never float as scraps.
- **Decisions**: wood ear cut (ears read as hooks or clouds in every variant tried).
  Lent ornaments use `lite()` copies of their fruit body (fewer warts/teeth/branches): mixes
  stay fast and legible. Lent fungus heads get a minimum socket size (4.2) so tiny arthropod
  heads still show a fruit body. Back growths in top view stay side-profile mushrooms
  pointing outward (discs seen from above read as warts, tried and rejected).
- **Speed**: fungus alone ~5 ms average (heaviest species < 10 ms). Mix maxima are dominated
  by the host tag (salamander/dragon bodies with many polygons).
- **Next**: a log substrate with shelves (turkey tail on a fallen log), jelly antler,
  hairy-curtain crust (lichen) forms, slime-mould-like extras if wanted; improve the blobs above.

### M2 fix run (2026-11-13)
- Cut: stinkhorn (plain rod; veiled lady covers the family), truffle (read as rocks), hoof fungus (on any stump it read as a horse/llama head), cauliflower fungus (blob or splat, never a ribbon mass). 45 -> 41 species.
- Stumps (`stub`) thinner (w 3.2-4) and shorter (24-30); turkey tail, chicken, oyster shelves larger, lion's mane stump slimmer. Fungus now carries the silhouette.
- Witch's hat: wider conical cap with bent tip (strong skew), wavy hem, rounder rim; always 2-3 caps so a lone cap never reads as an arrow.
- Giant puffball: small pear foot, plated/cracked top warts, optional crater. Earthball: taller, mostly split-cratered, bigger scales.
- `ruffle` gained `core`/`lw` genes (unused now cauliflower is cut).
- Still weak: lion's mane (stump still heavy), earthball and giant puffball (better but blobby at print size), liberty caps thin stems, false morel broccoli-like (critic minor items not addressed).

### Hybrids (M8 phase 1, 2026-11-14, automated scan, not yet judged by eye)

Within-tag hybrids are on by default (`hybrid` 0.85, see AUTHORING.md "Within-tag hybrids"). No throws over 2000 seeds. Worst combinations found by a heuristic over 3000 seeds (base + borrowed slot; "detached" = the silhouette falls into separate pieces where the pure base does not; "very long/tall" = aspect over 5:1):

- coral fungus + head of morel: 3/3 detached
- bird's nest fungus + limbs of morel: 5/5 detached
- scarlet elf cup + tail of penny bun: 3/3 detached
- stag's horn + dorsal of shaggy inkcap: 3/3 detached
- scarlet elf cup + tail of bird's nest fungus: 4/4 detached
- earthball + dorsal of devil's fingers: 3/3 detached
- earthball + dorsal of fly agaric: 3/3 detached
- chanterelle + crown of honey fungus tuft: 3/3 detached

Use the species `hybrid: { never, keep, noLend }` hints to fix these in phase 2.

- 2026-11-16: jelly ear (`jwrink`) pale fold made milder per user (thinner, about half width, shorter arc, extra vein only at veins>3), about as subtle as the pre-rebuild crescent. Shape unchanged. Before/after: out/roads/09-fungus-jelly-ear-mild.png (top old, bottom new).
