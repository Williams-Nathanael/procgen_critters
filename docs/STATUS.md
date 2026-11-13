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

**Species libraries (M1 done, 2026-11-13)**: all 8 tags reviewed by Opus `species-builder`
runs: arthropod 64, plant 47, fungus 45, salamander 29, mammal 38, jansson 38, amphibian 35,
dragon 27 species. Final sheets per tag: `out/roads/03-<tag>-species.png` and `-mixes.png`;
strengths, weak species by name and decisions are in each `docs/tags/<tag>.md` State section.
The interrupted Fable WIP is kept on `wip/<tag>-species` branches. Pushed to GitHub.

## Queue

Each milestone is one overseer conversation. Acceptance criteria in brackets.

1. **M1 Finish species libraries. DONE 2026-11-13.** (Kept for reference:) one
   `species-builder` per unfinished tag, at most 3 at a time. [each tag has
   `out/roads/03-<tag>-species.png` and `-mixes.png`; State section updated; no render errors
   in `npm run sheet -- out/tmp/all.png --n 8`]
2. **M2 Critic pass and fixes.** `critic` on each tag's 03 sheets (two or three tags per
   critic run), then one short `species-builder` fix run per tag with the ranked list.
   [critic finds nothing ranked "would bother the user" in the top 5]
3. **M3 Taste checkpoint with the user.** Publish one page: every tag's species sheet plus a
   mixes sheet, with a way to mark favourites, rejects and comments. Record answers in
   `docs/BRIEF.md`. [user has answered]
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
- Placement got slower with the richer species (node e2e: ~2.7 s for 57 critters). See M5.
  Fungus worker measured: `Ink.finish` (core.js) costs ~10 ms per 1000 vertices of overlapping
  shapes; some salamander/dragon-bodied mixes take 55-100 ms per critter. Suggested fix: union
  in batches, skip the soften pass for small simple shapes, cache per seed. Four workers
  independently found the soften step (two round-join offsets) is 50-75% of generation
  time; the arthropod worker suggests raising the `ClipperOffset` arc tolerance from 0.02*S
  to ~0.08*S. Do this early in M4/M5: it speeds every tag. Slowest species now: centipede
  15-20 ms, long (dragon) ~20 ms.
