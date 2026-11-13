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
