# Status and work queue

Single source of truth for "where are we, what is next". The overseer updates it at the end
of every milestone. Per-tag detail lives in the State section of `docs/tags/<tag>.md`.

## Where things stand (2026-11-13)

**Working end to end**: `./critters` opens the app in the browser. Open a PDF, draw a
scribble / polyline / box / oval border, stack tags, choose side, band depth, spacing and
size (more under "More options"), reroll or remove single critters, repeat a border across
all/odd/even pages, export a PDF with critters as vector paths. Tested in headless Firefox
with real pointer input, and export checked on a rotated, cropped page.

**Generator**: chassis + socket anatomy (`src/gen/parts.js`), species libraries per tag
(`src/gen/tags/`), coherent mixing (one primary tag supplies the body; others lend 1-2
signature slots; "Mix wildness" lets more slots wander). Critters sit on the line, never
below it (rooted forms may poke a sliver of root).

**Species libraries (M1 done, then M2 critic pass, 2026-11-13)**: all 8 tags reviewed by
Opus `species-builder` runs, then judged by `critic` at print size (`--cell 60`) and fixed
in two rounds per tag. Counts from the code: arthropod 64, plant 46, fungus 41, mammal 35,
jansson 33, salamander 29, amphibian 27, dragon 25. Sheets per tag:
`out/roads/03-<tag>-species.png` and `-mixes.png` (regenerated after M2); strengths, weak
species by name and decisions are in each `docs/tags/<tag>.md` State section.
The interrupted Fable WIP is kept on `wip/<tag>-species` branches.

**M3 result (2026-11-13)**: the user answered everything; dragons, mammals and fungus are
loved, arthropod loses 21 familiar or too-simple insects, and the fixes are queued as M3b.

**M2 result**: the final critic pass ranks nothing "would bother the user" in dragon,
salamander, jansson and plant. Seven items remain in the other four (capped at two fix
rounds per tag to bound cost; they go to the user at M3 as cut-or-fix choices):
- amphibian: horned frog's tall brow horn reads as a rabbit ear (whole frog reads as a
  sitting rabbit); flying frog and Surinam toad are the same splayed top-view X.
- mammal: beaver is a flat smear at print size, paddle tail reads on about 1 seed in 6.
- arthropod: grasshopper is a thin dash; mantis shrimp still reads as a caterpillar tube.
- fungus: chicken of the woods is a scribbled blob; lion's mane reads as a mop or broom.
Jansson: the critic confirmed no species reads as a specific existing character (drift
bells cut, tall wanderer lost hat and stick); watch hunched troll and back-turned sitter.
Lesson: workers that judged only at `--cell 110` failed the critic; briefs must say
"judge from `--cell 60` renders".

## Queue

Each milestone is one overseer conversation. Acceptance criteria in brackets.

1. **M1 Finish species libraries. DONE 2026-11-13.** (Kept for reference:) one
   `species-builder` per unfinished tag, at most 3 at a time. [each tag has
   `out/roads/03-<tag>-species.png` and `-mixes.png`; State section updated; no render errors
   in `npm run sheet -- out/tmp/all.png --n 8`]
2. **M2 Critic pass and fixes. DONE 2026-11-13 with 7 open items** (listed above; 4 of 8
   tags meet the criterion). [critic finds nothing ranked "would bother the user" in the
   top 5]
3. **M3 Taste checkpoint with the user.** Publish one page: every tag's species sheet plus a
   mixes sheet, with a way to mark favourites, rejects and comments. Show the 7 open M2
   items at print size and ask cut / fix / fine as is. Record answers in
   `docs/BRIEF.md`. [user has answered]
   **DONE 2026-11-13.** Answers recorded in `docs/BRIEF.md` ("Decisions (2026-11-13, M3
   taste check)"). Page: https://claude.ai/artifact/AttqqiKu3Crg1hsZwwmn7Y (private; raw
   answers stay in its database, collection `answers`).
3b. **M3b Taste fixes** (one `species-builder` per tag, at most 3 at once, judge at
   `--cell 60`; every brief: read the M3 decisions in BRIEF.md, commit only
   `out/roads/03-<tag>-*` plus the tag's two files, no `git reset`). Suggested batches:
   - Batch 1: **arthropod** (cut the 21 rejects; fix mantis shrimp; add about 8 chunky,
     armoured or feathery-limbed non-insects to replace them), **dragon** (rework
     amphisbaena, basilisk, cockatrice, ouroboros in 2-3 variants, fire salamander as a
     flame-based newt-like form), **jansson** (cut asterisk mite, pilcrow strider,
     stilt-legs; at-snail must not read as @; eyes embedded and smaller across the tag).
   - Batch 2: **fungus** (smooth the log attachment on chicken of the woods and oyster;
     rework lattice cage; cut liberty caps; add wrinkly ear-like fungi and other missing
     sorts), **amphibian** (cut horned frog, coiled caecilian, poison dart frog; faithful
     Surinam toad body plan), **salamander** (sturdier legs on about half the species; if
     that needs `parts.js`, stop and report).
   - Batch 3: **mammal** (beaver, one attempt, keep as is if it fails; harvest mouse
     climbing only; house mouse no standing pose). **plant** optional: a few vines, kept
     only if coherent.
   [each changed tag passes a `critic` look at `--cell 60`; sheets regenerated]
4. **M4 Mixing quality** (engineer, model opus; no tag workers running). Lent parts scaled
   to the receiving body; `sig` weights tuned; mixes coherent across all 28 tag pairs and
   some triples; per-border tag weights (e.g. mostly fungus, a little dragon) if the user
   wants them. Known: lent tails scale with the receiving chassis's tail-socket size, so e.g.
   jansson tassel tails get very long on jerboa-like mammal bodies; cap lent tail length
   relative to body radius in `parts.js` (salamander already caps its own lent tails at 3.2x).
   Also: lent parts cannot tell which tag's head/chassis they sit on (mammal works around it
   with a `C.mHead` flag); add a shared origin field to `plan` and head results.
   Also: `makeCritter` re-rolls an empty lent tail/dorsal/crown but not an empty lent `head`
   or `limbs` (headless/legless mixes; amphibian works around it); add both to that list.
   Fungus funnel caps (chanterelle etc.) put the crown mount in the hollow above the cap, so
   lent crowns float; that mount belongs on the cap surface (fungus tag fix).
   Plant species such as baobab and radish put their tail socket off the body, so lent tails
   float beside them (plant tag fix). `tail()` in `parts.js` reads `g.len` for its stub, so a
   tail-tip gene using `len` for itself also draws a long rod (arthropod uses `tlen`);
   rename the stub's field.
   Mammal brush tails: `ptarget` has no visible effect on a walk chassis when a custom
   `tailA` is passed, so tails cannot be arched upward (found in M2; cause not investigated).
   From M3: salamander+fungus was rejected and salamander+plant has the same problem (a
   salamander with mushrooms sticking out, or the reverse, does not work; fungus-headed
   ones "somewhat worked"), so rooted tags should lend a head or cap, not scattered
   growths. Top-down salamander legs projecting on both sides look wrong on jansson folk.
   Amphibian+fungus and amphibian+plant are liked ("stately") but could be improved.
   [critic on a 28-pair sheet]
5. **M5 Placement polish** (engineer). No identical species adjacent; spacing by actual
   critter width; corners of boxes and tight curves handled; "both sides" staggered;
   placement fast enough to drag sliders smoothly (now ~1 s for ~60 critters: cache
   geometry per seed, consider a Web Worker). [smoke test passes; sliders feel live on a
   page with 3 borders]
6. **M6 UI options pass** (engineer). Presets; ink colour; editable border points; page
   thumbnails; export current page only; keyboard help; whatever the user asked for at M3.
   [smoke test extended and passing]
7. **M7 Robustness** (engineer). Large and odd PDFs (many pages, encrypted, forms), memory
   on the 7.5 GB laptop, clear errors. [tested on 3 real-world PDFs]

## Known issues

- `npm run test:ui` needs the test server on port 4188 (`npm run serve:test`).
- Worktree isolation branches from the stale `origin/main`; workers run in the main checkout.
- Parallel workers committing with `-- out/roads/` sweep up each other's sheets (happened
  three times in M2; one worker then ran `git reset` on a sibling's commit and restored it,
  nothing lost). Until the commit command in `.claude/agents/species-builder.md` names only
  `out/roads/03-<tag>-*`, say so in every brief and forbid `git reset`. Workers also tend to
  commit sheet PNGs but not the matching SVGs.
- Placement got slower with the richer species (node e2e: ~2.7 s for 57 critters). See M5.
  Fungus worker measured: `Ink.finish` (core.js) costs ~10 ms per 1000 vertices of overlapping
  shapes; some salamander/dragon-bodied mixes take 55-100 ms per critter. Suggested fix: union
  in batches, skip the soften pass for small simple shapes, cache per seed. Four workers
  independently found the soften step (two round-join offsets) is 50-75% of generation
  time; the arthropod worker suggests raising the `ClipperOffset` arc tolerance from 0.02*S
  to ~0.08*S. Do this early in M4/M5: it speeds every tag. Slowest species now: centipede
  15-20 ms, long (dragon) ~20 ms.
