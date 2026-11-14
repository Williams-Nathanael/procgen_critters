# Procgen Critters: instructions for every Claude session

A local browser tool that procedurally generates small black silhouette critters and places
them along borders drawn on PDF pages, then exports the PDF with the critters as vector art.
`README.md` covers usage; `AUTHORING.md` covers generator internals.

## Read first, depending on your role

- **Planning / overseeing session** (a fresh conversation the user starts, usually on
  Fable): read `docs/ORCHESTRATION.md`, then `docs/STATUS.md`. Do not read source files or
  images beyond what the next decision needs.
- **Worker sub-agent**: your brief names the files to read. Always also `docs/BRIEF.md`
  (the user's intent and taste decisions) for anything visual.

## Budget rules (these exist because the first run burned a week of budget in a day)

1. **Short conversations.** Every message in a conversation re-reads the whole thing. One
   milestone per conversation, then update `docs/STATUS.md` and stop. State lives in files,
   never only in chat.
2. **The expensive model plans and judges; cheaper models build.** Opus 5.5 does geometry
   and species work, Sonnet 5.5 does UI, tooling, tests and research. Use the agents in
   `.claude/agents/`. Fable does not write bulk code.
   Never spawn `general-purpose` agents (they run on the session's model). Use `engineer`
   (Sonnet) for searches and general work, `species-builder` / `critic` otherwise.
3. **At most 3 workers at once**, each with a bounded task (one tag, or one review round).
4. **Workers commit after every review round** (`git commit -- <their paths>`), so a usage
   limit or crash loses minutes, not hours.
5. **Workers report in 200 words or fewer.** Detail goes in files (`docs/tags/<tag>.md`
   State section, commit messages), not in the report that lands in the overseer's context.
6. **Images are expensive context.** The overseer looks at one downscaled sheet per
   decision (`magick in.png -resize 50% out.png`), never every sheet a worker made.

## Ground rules for code

- Node 22, plain ES modules, no framework. Bundled with esbuild. No new dependencies
  without a reason in the commit message.
- Each tag owns exactly `src/gen/tags/<tag>.js` and `docs/tags/<tag>.md`. Tag-specific
  shapes are registered from the tag file (see AUTHORING.md), never added to shared files.
- Shared files (`src/gen/core.js`, `parts.js`, `critter.js`, `tags/index.js`, `src/place.js`,
  `src/export.js`, `src/app/*`) are changed by one worker at a time, never while tag workers
  are running in parallel.
- Workers run in the main checkout, NOT in `isolation: "worktree"`: worktrees branch from
  `origin/main`, which is stale (the repo is never pushed without the user's say-so). With
  several workers in one checkout, commit only your own paths: `git add <paths> && git
  commit -m ... -- <paths>`. If `index.lock` exists, wait a few seconds and retry.
- All randomness through the seeded rng. Same seed, same critter, always.
- Never put anything below the border line except a sliver of root on rooted forms.
- Never commit to anything but main or a wip/* / road/* branch. The overseer pushes at clean stopping points (every tag renders, npm run test:export and npm run build pass, checked on a clean copy of HEAD), over SSH: git push git@github.com:Williams-Nathanael/procgen_critters.git <commit>:refs/heads/main plus --tags. Workers never push.
- Commit trailer: `Co-Authored-By:` line for the model you are.

## Commands

```sh
./critters                         # build + serve on 127.0.0.1 + open the browser
npm run build                      # bundle the app into app/dist (git-ignored)
npm run sheet -- out/tmp/x.png "fungus@*" --n 6 --cell 110   # species contact sheet
npm run sheet -- out/tmp/m.png fungus+mammal dragon+plant --n 10  # mixes
npm run test:export                # node-only placement + PDF export, writes out/tmp/sample-out*.png
npm run test:ui                    # headless Firefox smoke test; needs `npm run serve:test`
                                   # running and test:export run once (it makes the sample PDF)
```

`out/tmp/` is scratch (git-ignored). `out/roads/` holds kept sheets, one per road or
milestone; `out/roads/wip/` holds the unreviewed sheets from the interrupted 2026-11-12 run.
