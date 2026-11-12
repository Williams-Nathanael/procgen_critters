# Brief: build the species library for one critter tag

You are one of eight parallel agents, each owning ONE tag of a procedural silhouette-critter generator. The project ("Procgen Critters") places small black silhouette marginalia creatures along borders drawn on PDF pages. The generator already works end to end; what it lacks is breadth and beauty. Right now each tag has one generic "species". Your job is to replace your tag's file with a large, well-researched, visually excellent library of real forms.

## What the user wants (their words, condensed)
- "Small silhouette marginalia entities", entirely black-and-white, printed about half an inch across, one every inch or so along a border line, standing on that line.
- "I do very much want the final form to draw on a massive corpus of reality for each tag. There exists an incredible diversity of fungus forms, even in silhouette, and it should be possible to draw on hundreds of them rather than all 'stem and cap' designs; same for all the others."
- "I would like you to be stylistically picky."
- Mood chosen by the user: **storybook naturalist** - recognisable real anatomy, but soft, plump and a little charming.
- White interior detail default: **eyes only where they help** (none on salamanders, plants, fungi; a small dot on mammals and dragons; round ringed eyes on the Jansson-ish folk). Markings (spots, seams) exist only at higher detail settings, so every form must read from its OUTLINE alone.
- Tags are stackable: a mix takes its body from one tag and borrows one or two signature features from the others, and must read as **one coherent creature**.
- Critters stand on the border line; nothing may hang below it (rooted things may show a sliver of root).

## Setup
You are in your own git worktree of the repo. First run:
`ln -s "/home/cardinal/Procgen Critters/node_modules" node_modules` (if node_modules is missing), then read, in full: `AUTHORING.md`, `src/gen/core.js`, `src/gen/parts.js`, `src/gen/critter.js`, `src/gen/tags/legacy.js`, `tools/sheet.mjs`. AUTHORING.md is the contract; follow it.

## Rules
- Edit ONLY `src/gen/tags/<your tag>.js` (rewrite it completely; keep the default export shape `{ id, label, short, sig, species: [{ name, w, genes(r) }] }`). You may also add PNG sheets under `out/roads/`. Do not edit any other source file: seven other agents depend on the shared files staying identical. If a shared-code bug or limitation blocks you, work around it inside your own file (you can register your own chassis/heads/feet/tips/crowns/dorsals, prefixed with your tag id, and you may copy and adapt any shared function into your file) and list it in your final report.
- All randomness through the provided rng. Keep generation fast (a critter should take well under 20 ms).
- Do not ask questions; make the call and note it.

## Process
1. **Research first.** Use web search and your own knowledge to compile a list of at least 40 genuinely distinct silhouette forms for your tag, drawn from reality (and from the specific sources named in your tag notes). Think about what distinguishes each in pure outline: posture, proportions, appendages, viewpoint (side, top, three-quarter), characteristic pose.
2. **Design the shape vocabulary.** Decide which new chassis / head / limb / tail / dorsal / crown types you need so those forms are actually different shapes, not the same template with different numbers. Bespoke chassis for distinctive forms are expected.
3. **Implement species**, aiming for 25-40 that are each clearly recognisable and distinct, each with real internal variation (proportions, pose, optional features) so that 10 seeds of one species give 10 different individuals. Quality beats count: 25 excellent species beat 40 muddy ones. Weight (`w`) common/iconic forms higher.
4. **Review loop, at least five rounds.** Render sheets (`node tools/sheet.mjs out/tmp/<tag>-a.png "<tag>@*" --n 6 --cell 130`), open the PNG with your image-reading tool and actually look. Be harsh. For each species ask: would a naturalist name it from the outline? Is it charming? Any slivers, hairline spikes, detached bits, lumps where parts join, ugly proportions, legs that don't reach the ground, things below the ground line, heads that are blobs? Fix and re-render. Also check at small size (`--cell 70`), since that is how it prints.
5. **Check stacking both ways** using the other tags as they exist in your worktree (their first-pass versions): your tag as body with others lending parts, and your signature parts lent to other bodies (`"<tag>+mammal"`, `"<tag>+fungus"`, `"<tag>+jansson"`, three-way mixes; use `--n 12`). Set `sig` weights to the slots where your tag is most recognisable, and make sure your genes for those slots look right on someone else's chassis (side view AND top view, big and small sockets). Make sure foreign heads/tails/limbs look sane on your custom chassis: return sensible sockets with sensible scales `s`.
6. Save your final species sheet as `out/roads/02-<tag>-species.png` (`"<tag>@*" --n 8 --cell 120`) and a mixes sheet as `out/roads/02-<tag>-mixes.png`, then `git add -A && git commit -m "<tag>: species library"` in your worktree.

## Final report (your last message; it is all I will see)
- Worktree path and branch name, and the commit hash.
- The species list (names only), and the new part types you registered.
- What still looks weak, honestly, with species names.
- Any shared-code problems or wishes (specific function, what is wrong, suggested fix).

## Your tag
