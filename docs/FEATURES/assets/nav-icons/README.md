# Nav review icon set

Sixteen pixel-art icons that decorate the **review pages about the nav computer's menus**
(the pilot's star-map instrument). They are page decoration only, not in-game assets.
The style follows Max's ruling that the nav's menu systems read as a 4th-generation
(SNES / Mega Drive) game: sprites on a deep blue-black tile (`#0b0f14`) in the nav glass
palette (cyan `#9fe6ff`, orange `#ffb347`, pale ink `#d6e2ee`, green `#5fd38d`, dim blue `#2a4a6a`).

- Source: Astra 2d job `.astra/jobs/20261002-233841-nav-review-icons/` (brief, report, `out/nav-icons-sheet.png`).
- `nav-icons-sheet.png` is the uncut 4x4 sheet, a byte-identical copy of the job output.
- Each tile was cut by finding the dark tiles against the cream gutters. The cuts are square, 267x267, centred on each tile.
- `<slug>.png` is the full-size tile. `<slug>-64.png` is a 64x64 nearest-neighbour downscale.

## Slugs, in sheet order (left to right, top row first)

1. `galaxy`: spiral galaxy
2. `sector`: grid with one cell highlighted
3. `region`: smaller grid in brackets (zoom in)
4. `prism`: column of light with dots
5. `system`: star with orbit rings
6. `moons`: planet with two moons
7. `search`: magnifier over a star
8. `route`: dashed GPS path to a dot
9. `warp`: ring portal
10. `goto`: eye with motion chevrons (view glide / go to)
11. `target`: diamond marker in brackets
12. `here`: map pin (you are here)
13. `drag`: hand with four arrows (drag / pan)
14. `neighbours`: three blocks, middle bright
15. `autopilot`: ship with looping arrow
16. `legacy`: CRT monitor with a grid (old nav)

## Using them on a review page (Artifact)

Publish the icons as supporting files beside the page, for example
`files: {"icons/galaxy-64.png": "docs/FEATURES/assets/nav-icons/galaxy-64.png", ...}`,
then reference them from the HTML:

```html
<img src="icons/galaxy-64.png" width="32" height="32" alt="" style="image-rendering: pixelated">
```

Show them at 24, 32 or 64 px. Integer multiples of 32 keep the pixels crisp. Always use
`image-rendering: pixelated`, or the browser will blur the sprites.
