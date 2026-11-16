# The brief: what the user asked for

The user's intent and every decision they have made, so no session has to rediscover it.
Quotes are the user's words. Add new decisions at the bottom with a date.

## The thing

"Something that procedurally generates small silhouette marginalia entities according to a
set of criteria, in a way that places them along a defined border." Workflow: open the
program, upload a PDF, scribble a curly line (or a box/oval border, or similar), choose the
radius outwards and the side, choose the tags, and "have e.g. little salamanders show up
(not interlocking Escher-style, just one every inch or so) within that defined area."

- **Silhouette**: entirely black and white, "with as much obscured as is useful (non-edge
  features could be visible as white if it helps the critter's design, but don't have to
  be, and I assume in the case of salamanders should not be)."
- **Tags** (8): small Tove Jansson-style marginalia entities, salamanders, odd crustaceans
  and arthropods, fungi, amphibians in general, small mammals, small dragonlike entities,
  odd plants. More will be added later ("Presumably I'd at some later point ask you to add
  another entity type").
- **Stackable**: "one should be able to get critters with some of the properties of a
  Tove Jansson-style entity and some of the properties of a fungus and some of the
  properties of an amphibian (probably not with the exact same mix each time)."
- **Corpus of reality**: "I do very much want the final form to draw on a massive corpus of
  reality for each tag. There exists an incredible diversity of fungus forms, even in
  silhouette, and it should be possible to draw on hundreds of them rather than all 'stem
  and cap' designs; same for all the others." Dragons: "varied medieval illustrations."
  Jansson: the little word-creatures from the dictionary and the small background critters
  of Finn Family Moomintroll, only as far as is free and permissible (see `docs/tags/jansson.md`).
- **UI**: "lots of options in my UI, with sensible defaults", most of which can come later
  (e.g. adjustable distance between critters).
- **Taste**: "I would like you to be stylistically picky; this is presumably something where
  your first shot won't work perfectly."
- **Roads**: "Save outputs from any mostly-formed roads that don't pan out, as well; I might
  say 'hey, I actually like that one the most, please go back to that road and keep going
  down it.'" Convention: `out/roads/NN-<name>.png` plus a git tag `road-NN-<name>`.
- **Platform**: small Fedora laptop (8 cores, 7.5 GB RAM, often little free). Development
  happens on the same machine.
- The user is "flexible on almost any of the constraints", but wants to hear early when one
  is being broken.

## Decisions (2026-11-12, from the user's answers)

| Question | Answer |
|---|---|
| Overall mood | **Storybook naturalist**: recognisable real anatomy, soft, plump, a little charming |
| Default white detail | **Eyes only where they help**: none on salamanders, plants, fungi; small dot on mammals and dragons; round ringed eyes on margin folk. Markings only at higher detail settings |
| What a mix should feel like | **One coherent creature**: one tag supplies the body, the others lend a few clear features |
| Placement | **Walking along the line**, with: "no critter should be more than a fraction below the line. E.g. fungi are allowed to protrude a tiny bit of root below, but no more." |

## Decisions (2026-11-13): how the work is run

The first big run burned the Fable budget fast: a very long main conversation (every message
re-reads it) and eight Fable sub-agents in parallel. The user's direction: "Fable should be
acting as a planner and overseer and maybe researcher and delegating to Sonnet 5.5 or Opus
5.5 for most of the work." That is now the operating model in `CLAUDE.md` and
`docs/ORCHESTRATION.md`.

## Decisions (2026-11-13, M3 taste check)

From the review page (all 28 mixes, all 7 open items, every species answered). Quotes are
the user's. "Overseer reading" marks an interpretation, not something the user said.

**General taste that came out of it**
- Complexity over simplicity: "I prefer, say, trilobites over smooth simple stuff like a
  flea or a copepod, and don't really like the simplicity of a butterfly ... could imagine
  myself liking feathery stuff coming off of a solid body plan."
- Familiar is boring: "everyone's seen grasshoppers, they don't want to see more
  grasshopper and just read it as 'grasshopper'."
- Not comical: spindly legs, oversized eyeballs and "comically misproportioned" /
  "comically grotesque" forms were the recurring complaints.
- Dragons ("very much fit the project"), mammals ("a fertile ground; I love these") and
  fungus ("very awesome stuff, with a marvelous array of variety") are the reference level.

**Open M2 items**
| Item | Answer |
|---|---|
| Horned frog | Cut |
| Flying frog / Surinam toad | Keep flying frog (favourite). Fix the toad: "a more faithful Surinam Toad body plan would solve these issues" |
| Beaver | Fix; "if fixing it isn't viable I'd take it as is. It still does read as 'misc mammal'" |
| Grasshopper | Marked fine as an open item, then rejected as a species (familiar insect): cut |
| Mantis shrimp | Fix |
| Chicken of the woods | Blob is fine. Real problem: "the jaggedness and square edges where I'm guessing it attaches to a log look terrible." Oyster mushroom: "same deal" |
| Lion's mane | Fine as is |

**Per tag**
- **Arthropod**: "mostly not (standard) insects" and "more chunky scaly stuff". Rejected
  (21): ant, bumblebee, butterfly, coiled millipede, copepod ("too simple"), crane fly,
  dragonfly, dung beetle ("a really wacky bug with a bulbous body"), flea, fly, giant water
  bug, grasshopper, hairy caterpillar, inchworm, ladybird, longhorn beetle, mayfly,
  millipede, moth, wasp, water flea. Favourites: crab spider, crab zoea, fiddler crab,
  jumping spider, pseudoscorpion, scorpion, shore crab, slipper lobster, spider crab. Pill
  bug "barely accepted". Overseer reading: cut the 21; replacements should be armoured,
  segmented or feathery-limbed crustaceans, arachnids and fossil forms.
- **Amphibian**: rejected coiled caecilian, horned frog, poison dart frog (no comment:
  cut). Favourites: climbing tree frog, crested newt, flying frog, four-legged tadpole,
  froglet, tadpole profile.
- **Salamander**: no rejects. "In general the legs look much too spindly relative to the
  body, and that makes the overall impression of a line of these guys too comical ... when
  looking at real salamanders I only think that perhaps half of them have spindly legs."
  Favourites: axolotl, blind cave salamander, mole salamander, mudpuppy, newt larva, olm,
  salamander larva, siren, spectacled salamander, tiger salamander.
- **Fungus**: rejected chicken of the woods and oyster mushroom (log attachment, above),
  liberty caps (no comment: cut), lattice cage ("Doesn't read right ... in silhouette, but
  the original mushroom is quite fun. Definitely try to rework this one"). Wanted: "more of
  the little wrinkly ear-like fungi", and other sorts still missing. 17 favourites.
- **Mammal**: harvest mouse "I dislike the non-climbing versions; the climbing versions are
  okay"; house mouse "Looks bad standing". 23 of 35 are favourites.
- **Dragon**: rework amphisbaena (favourite, but "its feet(?) and body read very oddly, so
  much so that I barely notice the tail"), basilisk ("Doesn't read very well; might be
  viable with a rework"), cockatrice ("doesn't read clearly"), ouroboros ("Head reads as
  comically grotesque and head-tail interface is messy; redesign, maybe a few versions?"),
  fire salamander ("Too comically misproportioned, and the breath reads wrong ... lean a
  bit away from heraldic and towards amphibians' crested newt; I would enjoy something
  solidly flame-based in this set"). Loved: hydra ("Wonderful and beloved by me"),
  lindworm ("Delightful"), sea serpent, serra, and 9 more favourites.
- **Jansson**: "I don't want the dictionary folk to explicitly read as specific unusual
  symbols, and the way that their large eyes look disconnected and spherical isn't great. I
  prefer embedded eyes where the whole sphericality is not quite visible." Rejected:
  asterisk mite ("A bizarre starfish with an oversized eyeball"), pilcrow strider ("too
  disconnected from reality, especially with the enormous eyeball"), stilt-legs, at-snail
  ("I love this fellow, but I don't love the @ part; adjust it to not explicitly read as an
  @"). Query hook: "I like the smaller eyeball editions". Ampersand knot, comma crawler and
  loop runner are favourites, so the symbol rule is about the reject list, not those.
  20 favourites, including hunched troll and back-turned sitter.
- **Plant**: no rejects. "great in hybrids, but I'm guessing they'll read as disunified and
  messy standalone. I'm fine with that; someday later I might ask for a
  designed-to-work-alone more vine-based run. A few more vines here wouldn't hurt, if and
  only if they ended up looking coherent."

**Mixes** (11 favourites, 16 fine, 1 reject)
- Rejected salamander+fungus: "Neither 'salamander with mushrooms sticking out' nor
  'mushroom with salamander sticking out' really did it for me; the fungus-headed guys
  somewhat worked." Salamander+plant: "Similar problem."
- Salamander+jansson: "Spindly legs aren't working so well with folk when they project on
  both sides (top-down)."
- Amphibian+fungus and amphibian+plant: favourites, "could be improved, but they look quite
  stately."
- Favourites: every salamander+animal pair (amphibian, arthropod, dragon, mammal),
  amphibian+arthropod, amphibian+dragon, arthropod+dragon ("Lovely combinations"),
  fungus+jansson, mammal+jansson.

## Decisions (2026-11-14, 1.0 taste check)

Page: https://claude.ai/artifact/Py2LfDvwLMuFgSZzTwihn1 (raw answers in its database,
collection `answers`). Overall: "More of them work better than I expected!"

**The major objection (blocks 1.0): no hybridization within a tag.** In the user's words:
"within species, we have almost no hybridization. Much of the point is that these fellows,
even as lone tags, are procedurally generated afresh, but as is they just generate from a
pool of ~40 species with ~3 noticeable variations per species. Can we have a major overhaul
to make e.g. each amphibian be an unnameable hybrid of the amphibians rather than the
present singular type? Or even if it does have a visible base, absolutely being an
interesting melding? If we can't get a hydra with an amphisbaena tail, I'm dissatisfied and
don't feel that it's really procedurally generated."
So: a single tag must produce meldings of its own species by default, not one species at a
time. A visible base species is acceptable; a plain catalogue entry is not.

**Species**
- Cut: woodlouse (arthropod), oyster mushroom (fungus, "Log still doesn't read right").
- Try again: amphisbaena ("the second head needs an eye, or at least a little more to not
  read as just 'funky tail'"); jelly ear ("Log almost reads right, I'd keep this as is but
  would prefer a redo. The 'flat baseline' style it's running doesn't quite work");
  ampersand knot ("Eye is good, the big lump is questionable; if the big lump were not so
  spherical and bothersome I'd say keep as is").
- Kept, with comments: coconut crab "Quite handsome", squat lobster "Also handsome",
  chicken of the woods "Very good", lattice cage "Aha! Much nicer.", ouroboros "Much
  better", beaver "Works.", fire salamander "A little busy, but workable.", spiral snail
  "Is alright, though it lost some of the charm."
- Kept without comment: all other new arthropods, mantis shrimp, basilisk, cockatrice,
  Surinam toad, hare's ear, the four vines. Weak leftovers left as they are: trilobite,
  pill bug, giant puffball, earthball, jaculus, sleeping drake, hairy frog, midwife toad.

**Mixes** (20 fine, 7 less of this, 1 never)
- Never: salamander+fungus ("A little overdone, these fellows do get boring now; switching
  to pure cap-head wasn't great").
- Less of this: amphibian+arthropod ("These don't work as well as I expected"),
  arthropod+plant ("Doesn't really feel special, somehow."), fungus+dragon ("They don't
  work as well as I hoped"), fungus+mammal ("Not great, same as salamanders."),
  salamander+jansson ("Doesn't combine smoothly."), plant+jansson (no comment).
- Fine, with comments: salamander+arthropod "Cooler than I expected", amphibian+fungus
  "Nice", dragon+plant "Rather good", dragon+jansson "Not as good as I hoped, but still
  okay."
- Follow-up on salamander+fungus (same day): "either redesign it to be coherently
  salamander blended with fungus rather than 'salamander with a mushroom for a head,' or
  just give it up as a lost cause and I'll use it rarely." Not a ban on the pairing.
- Follow-up on the "less of this" pairs (same day): "the same - take a look for a redesign,
  or leave as is - but not high priority, because I either don't care much about them or
  think they're already okay. Not every combination needs to look amazing."

## Decisions (2026-11-14, after the first hybrid mechanism)

The user saw the first within-tag hybrids (base species + 1-3 borrowed slots, 85%) and
rejected the approach: "I still don't like it. The procedural generation idea feels like
it's falling by the wayside and being replaced with 'a hydra with a bit extra tacked on' -
these things really should be chimeras, albeit chimeras that make an effort to have some
coherence. Their point is not to be 'a surinam toad with some modifications,' their point
is to be 'some creature, inspired by real life but not of it'. The slider is a good idea,
but at 100% it really should be 100% hybridization, hybridized to the max; if I want less,
that's just a reason to set the slider lower."

So:
- The species libraries are a parts-and-proportions vocabulary, not a catalogue. The normal
  output of a tag is a creature nobody can name.
- Hybrid 100% means no base species at all: every part from a different parent where
  possible, the body itself a blend, proportions free to land between and beyond the
  parents. Coherence (parts attached, scaled to the body, reading as one animal) is still
  required at 100%.
- The slider is the user's way to ask for less; do not hold back at the top of its range.

## Decisions (2026-11-16, chimera taste check, M8 phase 3)

Page: https://claude.ai/artifact/XMBa68NUA2LpyiZJKggFLz (raw answers in its database,
collection `answers`). 48 chimeras per tag at hybrid 1; cell #n is seed
`1000 + floor((n-1)/8)*100 + (n-1)%8`, sprite `out/review-chimeras/sprites/chim-<tag>.png`
(8 columns, 60 px cells at 2x).

- **Overall direction: keep.** Chimeras are the right approach.
- **Ready**: salamander ("All look good to me."), mammal ("I love these very much; and the
  level of 'stupid looking circular mouse ears' no longer feels oppressive"; 21 favourites,
  no rejects), fungus ("Good enough. Not amazing, but fungi were always going to be
  extremely hard."; 9 favourites), plant ("surprisingly solid! I don't like them as a whole
  and wouldn't use them alone, but I think they'll be good in hybrids"; reject #25),
  amphibian and arthropod (ready, with the fixes below).
- **Amphibian** (ready, with fixes): "Let's cut our loopy little friends, they barely read
  as part of the team. And some of those sharp legs read as too shattery and jagged. And, of
  course, the floating-dots thing is unintentional, right?" Rejects #2 #7 #32 #43 all have
  the caecilian / looped caecilian chassis (overseer's reading: these are the "loopy
  friends"); #16 #40 #48 presumably show the jagged legs and floating dots.
- **Arthropod** (ready, with fixes): "Solidly arthropodly now. Though the scorpion-tailed
  little one has a tail far chunkier than its body; bad scaling? Also, I'd tone down the
  level of crab claws (marked 'reject') and tone up the level of varied claws (marked
  'favorite') a bit; the ones that read as generic crab feel too plentiful. #39 somehow
  works well without feeling generically crabby even with crab claws because of the
  antennae(?) overlapping the claws." Rejects #3 #18 #19 (shore / fiddler crab chassis), #44
  (silverfish-earwig-centipede body with a scorpion tail: the chunky tail). Favourites #23
  #27 #31 #39 #43 #46 #47 #48 (squat / spiny lobster, scorpion, pseudoscorpion, whip
  scorpion, king / spider crab bodies).
- **Dragon: needs more work.** "The very thin front leg makes some of these ridiculous, and
  the way these feel dominantly diagonal with a kind of ridiculous 'middle leg' or aborted
  back half is bad. (ones marked reject are to illustrate the problem, not to explicitly
  downweight those exact designs)". Rejects #19 #22 #24 #28 #29 #32 #39 (5 of 7 have
  cockatrice in the chassis blend; also serra, saint margaret, basilisk, amphisbaena).
  Favourites #1 #2 #6 #13 #15 #36 #42 #43 #44 #48.
- **Little folk: needs more work**, one instruction: "Remove Bracket Crawler and Query
  Hook". No species is called bracket crawler; rejects #9 #12 have the bracket peeper
  chassis and #4 the query hook chassis, so the overseer reads it as bracket peeper + query
  hook. 13 favourites.
- Reworked pure species: amphisbaena keep ("Solid little fellow now, yeah. Feet read
  okay."); ampersand knot keep ("Still a bit too large of a lump, but it's good."); jelly
  ear keep, but "Older version looked fine with its milder markings."
