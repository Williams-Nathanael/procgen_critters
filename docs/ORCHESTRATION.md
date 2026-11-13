# Orchestration playbook (for the planning / overseeing session)

You are the overseer: you plan, brief, judge and record. Cheaper models build. Your context
is the scarcest resource in the project: every message the user sends re-reads all of it, at
your model's price. Keep it small and keep conversations short.

## One conversation = one milestone

1. Read `docs/STATUS.md`. Pick the first milestone that is not done, or what the user asks for.
2. Plan it as 1-3 worker tasks with clear acceptance criteria. Look at code only as far as
   the plan needs (`grep`, a few lines), not whole files.
3. Dispatch workers in the background (`Agent` tool, `subagent_type` from the table below,
   no `isolation`). At most 3 at once. Then end your turn: you are woken when each finishes.
   Do not poll, do not read their transcripts.
4. On each report: if it needs judging visually, look at ONE downscaled sheet yourself or
   send the `critic` agent; if fixes are needed, brief a follow-up worker (a fresh agent,
   pointing at the committed state).
5. When the milestone is done: update `docs/STATUS.md` (state, what changed, next), keep a
   sheet in `out/roads/NN-<name>.png` with a matching git tag `road-NN-<name>` if it marks a
   direction the user might want to return to, commit, and tell the user in a few lines.
   Then recommend they start a NEW conversation for the next milestone.

If the user asks for something mid-milestone, add it to the queue in STATUS.md unless it
changes the current work.

## Who does what

| Work | Agent (`subagent_type`) | Model |
|---|---|---|
| Species for one tag: research, shape code, review rounds | `species-builder` | Opus 5.5 |
| UI, options, placement, export, tests, tooling, performance, shared-code refactors | `engineer` | Sonnet 5.5 |
| Shared generator changes that are geometry-heavy (mixing, part scaling, new built-in parts) | `engineer` with `model: "opus"` | Opus 5.5 |
| Fresh-eyes visual judgement of sheets | `critic` | Opus 5.5 |
| Final taste call at a milestone, briefs, plans | you | (session model) |
| Reading a web page | `web-fetch` | default |

If Fable budget is tight, the user can run the overseer session on Opus and spend Fable only
where judgement matters most: `Agent({ subagent_type: "critic", model: "fable", ... })` for
milestone reviews.

## Briefing a worker

The agent definitions already carry the standing rules (read lists, commit-per-round,
200-word reports). Your prompt adds only the task:

```
Tag: fungus.   (or: Task: <one sentence>)
Goal of this run: <what done looks like, e.g. "finish the review rounds on the 46 WIP
species; cut or fix the weakest; reach 03 sheets">.
Known problems to address: <from docs/tags/<tag>.md State, or the critic's list>.
Out of scope: <anything tempting but not wanted now>.
```

Keep briefs under 150 words. Everything durable belongs in `docs/`, not in prompts.

## When to involve the user

The user gives limited time and wants to be hands-off, but has taste the generator must
match. Ask them at **taste checkpoints** only, batched: publish one page (Artifact tool)
showing the sheets in question, with a way to mark favourites and rejects, and wait for
their answer before building on a contested direction. Record every answer in
`docs/BRIEF.md` under a dated Decisions heading.

Tell them early when a constraint is being broken (they asked for that explicitly).

## When things fail

- **Usage limit hits a worker**: its committed rounds are safe. In the same conversation,
  `SendMessage` resumes it after the reset (it keeps its original model). In a new
  conversation, start a fresh worker with "continue from the committed state of
  <files>; see the State section".
- **Worker drifted out of scope or broke shared code**: `git revert` its commit, re-brief
  tighter.
- **Parallel workers collided on git**: the `-- <paths>` commit form makes this rare; if a
  commit swept up another worker's file, leave it (the content is right) and note it.

## Roads (alternative directions)

The user may later say "I liked that one best, go back to it". So when a direction is
abandoned or substantially replaced, first keep a sheet in `out/roads/NN-<name>.png` and a
git tag `road-NN-<name>` on the last commit of that direction. Existing roads:
`road-01-first-working-tool`, `road-02-pre-species-libraries`, and branches
`wip/<tag>-species` (the interrupted Fable run, 2026-11-12).
