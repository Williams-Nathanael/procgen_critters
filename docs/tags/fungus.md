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
Updated 2026-11-13 (species-builder run on main; review rounds done). Sheets:
`out/roads/03-fungus-species.png`, `out/roads/03-fungus-mixes.png`.

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
