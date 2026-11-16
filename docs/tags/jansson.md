# Tag: jansson ("Little folk")

File `src/gen/tags/jansson.js` · id `jansson` · label "Little folk" · short "Folk"

User: "small Tove Jansson-style marginalia entities"; and later: "of course one can look
into what's (freely, permissibly) available; I'd especially be interested in the small
word-creatures from the dictionary and any other little critters in the backgrounds of
Finn Family Moomintroll's illustrations."

**Hard constraint.** Tove Jansson died in 2001; her work is in copyright everywhere
relevant and nothing of hers is freely reusable. Do NOT recreate any of her characters or
drawings: no Moomin-family figures, Snufkin, Little My, Hattifatteners, the Groke, Hemulens,
Snork, Sniff, Too-Ticky, Stinky, Thingumy and Bob, or any other named or recognisable
creature of hers, and do not name species after them. Build an ORIGINAL cast that would feel
at home in that kind of margin: learn from how the drawings work, not from what they depict.

Research the style and its wider tradition (descriptions and criticism of her illustration;
the Hobgoblin's Hat episode where the Dictionary of Outlandish Words turns into little
crawling word-creatures; Scandinavian troll and tomte illustration such as John Bauer and
Elsa Beskow; Edward Lear's nonsense creatures; Edward Gorey's small beasts; medieval
drolleries). Qualities to distil: small rounded bodies with a low centre of gravity; very
simple confident outlines; large round wide-set eyes carrying all the expression; tiny
hands and feet; noses from none to long; tufts, tasselled tails, single hairs; shy,
watchful, wandering, huddled, peeping poses; processions; crowds of very small things;
cosiness with slight unease.

Cast ideas: word-creatures (what the user most wants an echo of: tiny scuttling beings like
stray handwriting come alive, bodies of a few loops, hooks and ascenders, many little legs or
none; commas with legs, knotted ampersands, dropped serifs); round shy lumps with eyes and
feet; tall thin wanderers with a pointed head or a bundle; long-nosed scuttlers; all-fur
things with two eyes; huddles of three to five on one base (counts as one critter);
pear-shaped sitters; peepers behind a stone or out of a shell, pot or grass tuft; creatures
carrying a lantern, umbrella, suitcase, fishing rod or flag; seen from behind with a tail;
drifting columns with little hands (clearly distinct from Hattifatteners); snail-ish and
bird-ish folk; winter creatures in scarves; curled sleepers. Attitude matters more than
anatomy. Big ringed eyes are this tag's default white detail; each form must also read as a
creature at detail 0 (pure black).

Signature features to lend: big round ringed eyes, a soft rounded snout or long nose,
tasselled tail, tufts and single hairs, small props, the upright pear body.

## State
- **Taste-check cuts (2026-11-16), 28 species.** Cut bracket peeper and query hook (user verdict) with their glyph drawer cases; no hints or mixes referred to them. Ampersand knot head ball 2.5k -> 2.1k (about 16% smaller), nothing else. Checked 2,000 seeds at hybrid 1 and 500 at hybrid 0: no throws, nothing below the line. Sheets regenerated.
- **Chimera fix round (2026-11-14), 30 species.** Judged at --hybrid 1 --cell 60, seeds 1000/1100/1200 (`out/roads/07-jansson-chimeras.png`).
  Blob folk each carry an outline trait: stack has a white crease between members; huddle members spaced so each keeps its outline;
  stone peeper always has a pebble ledge and a white crack; pot always has handles and a white rim band. Shy lump, huddle, stack,
  stone peeper and pot dweller keep their chassis unblended (`keep: ['chassis']`), so blob+blob chassis blends no longer happen.
  Comma crawler bigger (k 1.45-1.8), almost always single; query hook belly min 5.4; curled sleeper bigger, shorter tail.
  Loop runner: 2-3 loops, larger, big eyed head raised on a neck. Spiral snail: calligraphic flourish loop off the back of the foot.
  Shag: 7 broad strands per side, min length. Grass lurker: 5-8 short blades, short in front of the head. Farm sprite hat
  blunter (1.1-1.5) and always tilted, pom more often. Ampersand pure: no big ball (checked).
  Weak still: comma crawler pairs, query hook chimeras (thin, tall), suitcase traveller, curled sleeper.
- **M3b eye fix (2026-11-13), still 30 species.** Bracket peeper: the two eyes are now small
  white points (r = 0.11 hr) set high in the head, no longer goggly discs. Ampersand knot: the
  right-hand ball keeps no eye; one small ringed eye sits in an ink knob on the top loop, so the
  glyph reads as a creature at print size. Judged at --cell 60.
- **Watch, not fixed:** five blob-with-two-eyes species (shy lump, huddle, stack, stone peeper,
  pot dweller) read as one template; comma crawler and loop runner legs are hairline at print size.
- **M3 taste run (2026-11-13): 30 species** (was 33). Cut per the user: asterisk mite, pilcrow
  strider, stilt-legs. At-snail renamed **spiral snail**: the 'a' heart of the @ is gone, the shell is
  now an inward calligraphic spiral (1.25-1.85 turns, thin stroke, ball centre) on the old foot/neck,
  so it reads as a snail shell, not an @. Eyes smaller and embedded across the whole tag: ring eye
  scale 0.75 (was 1), frontEyes 0.24 of body width (was 0.33), glyph ball eyes 0.42 of ball radius
  (was nearly the whole ball), head eyeR 0.18-0.22 (was 0.24-0.29), side-view/huddle/peeper eyes
  ~25% smaller. Judged at cell 60: eyes now read as small white points inside heads.
  Weakest now: ampersand (ball head small so eye ring still dominates it), huddle at print,
  suitcase traveller, curled sleeper, shaggy mop. No shared-code change needed.
- **M2 fix run (2026-11-13): 33 species** (was 38). Cut: drift bells (drifted toward a known
  character), tail-holding procession, cursive procession (members smudge at print), crook stemling
  (read as b/6), scarf creature (scarf read as arm). Tall wanderer no longer has a cone hat or a
  walking stick: plain head with long ears / tuft / hair, carries bundle or lantern. Farm sprite never
  carries a staff. Folk bodies vary in outline: new local shapes squat, cone, gourd, sack used by
  folkBody and shy lump. Glyph chassis gained genes sx/sy (stretch), sl (slant), wt (stroke weight),
  wob (jitter), wider leg length, plus random crown and tail. Huddle is mostly 2 members, larger.
  Still weak: huddle at print, suitcase case small, curled sleeper plain, squat folk with big props.
- **38 species** (2026-11-13; was 36 unreviewed WIP). Sheets: `out/roads/03-jansson-species.png`,
  `out/roads/03-jansson-mixes.png`. All load, nothing below the line, slowest mean ~15 ms (loop runner).
- **Word-creatures (12, ~37% of weight)**: comma crawler, ampersand knot, crook stemling, minim
  caterpillar, loop runner, query hook, pilcrow strider, asterisk mite (new: stands on its two lower
  spokes), at-snail (new: the @ outer stroke runs on as a snail foot), bracket peeper (new: a head
  peeping between ( ), [ ] or { } held like curtains), swash inchworm, cursive procession. Pen strokes
  swell and thin like a broad nib; ball terminals are the heads. Strongest: ampersand, at-snail,
  minim, loop runner, query hook, pilcrow, bracket peeper.
- **Folk (26)**: shy lump, shaggy mop, pear sitter, back-turned sitter, tall wanderer, long-nose
  scuttler, stilt-legs, hunched troll, farm sprite, scarf creature, bird folk, lantern / umbrella /
  suitcase / angler / flag bearers, huddle, stack, tail-holding procession, stone / burrow peeper,
  pot dweller, grass lurker, drift bells, snail folk, curled sleeper. Strongest: umbrella walker,
  stilt-legs, long-nose scuttler, bird folk, stack, burrow peeper, snail folk, farm sprite.
- **Weak**: tail-holding procession and comma trains (wide, so each member is tiny at print size;
  weights lowered), huddle (members merge at print), scarf creature (scarf still reads a bit as an
  arm/tail), curled sleeper (plain), crook stemling (letterform less obvious), suitcase case small.
- **Copyright review (done, all 38)**: decisions: the 'soft' snout is now only a small button, never a
  broad head-sized muzzle; a profile head with a snout or bulb nose never gets ears (guard in `std`);
  pear sitter / angler never take the bulb nose; back-turned sitter has no round ears; tall
  wanderer's cone never has a brim; drift bells are wide hooked bells with a scalloped hem, at most
  two, never tall columns; the old soot-sprite-like fuzzball became the shaggy mop (hanging thatch,
  feet, tufts); suitcase bearers are always single. Nisse renamed "farm sprite" (generic folklore tomte).
- Cut: serif scuttlers (read as boxes/teeth). Old WIP branch `wip/jansson-species` is superseded.
- Stacking checked both ways: lent heads (ringed eyes, button/long/bulb noses) and brush tassels sit
  well on other chassis; foreign parts on glyph chassis attach at the ball head and back arc.

### M2 fix run 2 (2026-11-13)
- Glyph variation widened so it shows at print size: query hook (belly size, neck length, hook height/width, head size, optional arms, mirrored), at-snail (shell size and stretch, neck length, head size), asterisk mite (5-8 spokes, pinwheel curl either way, spoke weight, centre size, splay).
- Blob folk split by outline: shy lump is now flat and wide (squat/lump, low), shaggy mop is tall and narrow; pot dweller is a straight flared flowerpot with a smaller head and handles most of the time (egg kind dropped); stone peeper is a low wide rock with a small head over it.
- Burrow peeper: head rises well above the mound, bigger eyes and side mounds, thicker ground line.
- Removed dead duplicate `tail` key in `glyph()`.
- Still weak: shaggy mop's shag barely reads at 60px; pot dweller without handles can still look like a blob; asterisk mite with strong curl is busy.

### Hybrids M8 phase 2 (2026-11-14, 30 species)
- Judged at --hybrid 1, cell 60 (`out/roads/07-jansson-chimeras.png`): chimeras read as whole folk.
- Hints: bracket peeper keep head+tail; back-turned sitter keep limbs; stone peeper keep dorsal+limbs; curled sleeper keep head (fixes the detached pairs below).
- Ampersand knot: head ball 3.7k -> 2.5k, pulled into the stroke end (user decision).
- Glyph leg ticks thicker (1.2 -> 1.6/1.5) so comma crawler and loop runner legs survive print.
- Shy lump vocabulary widened (caps, long ears, pom tail) so blob chimeras differ more.
- Still weak: blob folk (shy lump, stack, stone peeper, pot dweller) still share a body template; suitcase traveller; curled sleeper.

### Hybrids (M8 phase 1, 2026-11-14, automated scan, not yet judged by eye)

Within-tag hybrids are on by default (`hybrid` 0.85, see AUTHORING.md "Within-tag hybrids"). No throws over 2000 seeds. Worst combinations found by a heuristic over 3000 seeds (base + borrowed slot; "detached" = the silhouette falls into separate pieces where the pure base does not; "very long/tall" = aspect over 5:1):

- bracket peeper + head of pear sitter: 3/3 detached
- bracket peeper + tail of hunched troll: 3/3 detached
- back-turned sitter + limbs of curled sleeper: 2/3 detached
- stone peeper + dorsal of spiral snail: 2/3 detached
- stone peeper + limbs of spiral snail: 2/3 detached
- back-turned sitter + limbs of lantern bearer: 2/4 detached
- back-turned sitter + limbs of bracket peeper: 2/4 detached
- curled sleeper + head of snail folk: 2/4 detached

Use the species `hybrid: { never, keep, noLend }` hints to fix these in phase 2.
