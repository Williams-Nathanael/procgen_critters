# Procgen Critters

Procedurally generated silhouette marginalia: draw a border on a PDF page, pick what
kind of creatures live there, and little black critters appear along it. Export gives
you the same PDF with the critters added as vector art.

## Run it

```sh
./critters
```

This builds the app, starts a small server on `127.0.0.1` and opens it in your browser.
Nothing leaves the machine; PDFs are read and written entirely in the browser tab.
Needs Node (already installed here). `./critters --no-open` skips opening the browser,
`./critters --port 5000` picks a port. To get an entry in the desktop app menu:
`./tools/install-launcher.sh`.

## Use it

1. **Open PDF…** (or drop one on the page). With no PDF you get a blank Letter page to
   play on.
2. Pick a border tool and draw on the page:
   - **Scribble**: freehand line. End near where you started to close it into a loop.
   - **Line**: click points for a straight or multi-segment line; double-click or Enter
     to finish. Shift snaps to 45 degrees.
   - **Box**, **Oval**: drag. Shift for square / circle.
3. On the right, choose **tags** (stack as many as you like), which **side** of the line
   the critters live on, the **band depth** (how far out they may reach), **spacing**
   and **size**. Everything updates live. The white strip of samples under the tags
   shows what the current mix produces; click it to shuffle.
4. **Select** tool: click a border to edit it, drag to move it; click a single critter
   to reroll just that one, Alt-click to remove it. **Reroll all** changes the lot.
5. A border can repeat on **all / odd / even pages**, with different critters on each.
6. **Export PDF** downloads `<name>-critters.pdf`. The original is never modified.

Borders are remembered per PDF in the browser; **Save borders…** writes them to a small
JSON file if you want to keep or move them.

Critters stand on the line and never dip below it (rooted things may show a sliver of
root). Tall critters are scaled down to fit the band depth.

## How the critters work

A critter is a body plan with sockets (head, limbs, tail, back, crown) and parts plugged
into them. Each tag is a library of species. A single tag gives you one of its species;
stacked tags give a creature whose body comes from one tag and which borrows one or two
signature features from each of the others, differently every time. The **Mix wildness**
slider (under More options) lets more slots wander between tags.

`AUTHORING.md` explains the internals and how to add a new entity type: one new file in
`src/gen/tags/`, one line in `src/gen/tags/index.js`.

## Layout

- `src/gen/` generator: `core.js` (geometry, silhouette union), `parts.js` (anatomy),
  `critter.js` (assembly and tag mixing), `tags/` (one species library per tag)
- `src/place.js` border geometry and placement; `src/export.js` PDF writing
- `src/app/`, `app/` the browser UI
- `tools/sheet.mjs` contact sheets for reviewing output; `tools/test-export.mjs` and
  `tools/ui-smoke.mjs` end-to-end checks
- `out/roads/` saved sheets from each stage of development, including abandoned
  directions; matching git tags are named `road-NN-...`
