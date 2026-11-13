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
