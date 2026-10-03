# 2D concept-image brief — gameplay-loop icon sheet (well-dipper-trunk)

Reference images attached, in order: none. The canon sheet is inlined below; take its palette (orange, deep blue, cream on dark navy) and its "strong silhouette, one distinguishing feature" rule.

## Subject
A sheet of sixteen small square icons for Max's gameplay-loop review page (a web page of flowcharts about Well Dipper's game loops). They decorate the page's section headers and chart boxes so reviewing it feels joyful. This is page decoration, NOT an in-game asset, so the icons may carry their own retro look (posterised colour, light dithering). The distinguishing feature of the set: every icon is one bold, simple silhouette on its own dark navy tile, readable at 32 pixels wide. A stranger should recognise it as "a set of retro space-game icons".

## Visible outcome
The generated sheet must show ALL of the following. Check each on the actual image before you report; if a check fails, make ONE edit turn ("Change only X." followed by the whole KEEP slot, with `referenced_image_paths` set to the previous image's local path) and re-check; report what the second image shows. "Unchanged" means unchanged to the eye: a few pixels' drift in an edit is not a failure; layout and tile count are what must hold. If a check still fails after the edit turn, report `complete` with that check marked FAIL and what you saw — the reviewer decides; `blocked` is only for a tool that cannot make an image at all.
1. Exactly sixteen tiles in a 4 × 4 grid, all the same size, separated by plain cream gutters of even width, with a cream margin around the whole grid.
2. Each tile is a solid dark navy square with exactly one icon centred in it; no icon crosses its tile's edge.
3. No text, letters, numbers or labels anywhere on the sheet.
4. The sixteen subjects appear in the order listed in the prompt, left to right, top row first.
5. Each icon is still recognisable when the sheet is viewed at one eighth of its size.

## Image prompt
The prompt below goes to the built-in image tool VERBATIM as its `prompt` — do not paraphrase, shorten, reorder or add creative detail.

```
JOB: A sheet of 16 small UI icons for a web page about a retro space exploration game's gameplay loops. Each icon will be cut out along its tile edge and shown at 32 to 64 pixels wide, so only bold shapes survive.

SUBJECT: Sixteen retro space-game icons, one per tile. In order, left to right, top row first:
1 signal: three concentric arcs radiating from a small dot.
2 warp: a glowing ring-shaped portal opening in space.
3 scan: a targeting reticle over a small planet.
4 gravity well: a funnel-shaped grid dipping down to a point.
5 fuel: a rounded fuel cell with three charge bars.
6 hull damage: a cracked armour plate.
7 stasis and rescue: a small escape pod with a beacon light on top.
8 settlement: a ring-shaped space station with a central hub.
9 credits: a hexagonal coin.
10 debt: a broken chain link.
11 ancient human remnant: a weathered stone monolith shard.
12 alien artifact: an impossible floating crystal of three intersecting shapes.
13 time debt: an hourglass.
14 autopilot rules: three stacked cards with a small arrow between them.
15 postcard: a framed picture of a ringed planet.
16 ship AI: a cute tiny low-poly character, a few faceted shapes, with a round face and two dot eyes, standing in a cone of hologram light.

VIEWS / COMPOSITION: An exact 4 by 4 grid of equal square tiles separated by even cream gutters, with a cream margin around the grid. One icon centred in each tile, filling about 70 percent of the tile. Front-facing, flat, no perspective scenes.

CONSTRUCTION: Each icon built from a few bold flat-coloured shapes with faceted low-poly edges, like a late-1990s PlayStation or Saturn game menu icon. Smallest detail no thinner than one sixteenth of the tile width. At most four colours per icon besides the tile.

PROPORTIONS & SCALE: All sixteen icons at the same visual weight and roughly the same size within their tiles.

STYLE: Each tile solid dark navy (#0a0a12). Icons in a limited palette: warm orange (#ff8019), deep blue (#1a2a7a), cream (#e0d9c7) and one pale cyan (#7fe6ff) used only for glowing parts (portal, hologram, beacon). Posterised flat colour with light ordered-dither shading on the icons only. Even lighting, no cast shadows, no gradients on the tiles, no text, no letters, no numbers, no labels, no frames beyond the tile edge.

SELF-CHECK: Every icon must still be nameable when the sheet is shrunk to one eighth of its size.

KEEP: 4 by 4 grid of 16 equal dark navy square tiles, even cream gutters and margin, one centred icon per tile in the listed order, the palette above, no text anywhere.
```
Extraction note: the tiles will be cut out by finding the navy squares against the cream gutters, then shown at 32–64 px; tile count, order and the absence of text are what gets checked.

## Canvas and views
- Canvas: square, about 1024 × 1024; the tool chooses the exact size — report what it made.
- One flat front view per icon; no scale reference needed (UI icons).
- Background is the cream gutter colour; there is no text at all.

## Outputs
Write into this job directory only. Always these exact names; earlier rounds are archived by the runner, so overwriting loses nothing.
1. `out/loops-icons-sheet.png` — the selected image, copied UNMODIFIED from the path the tool reports.
2. A provenance line in `report`: the tool's `output_hint` path, the copied path, byte size, width × height, sha256 of the copy, the number of tool calls (generate + edits), and the prompt actually sent if it differed from the brief's (it must not).
Use ONLY the built-in `image_gen` tool. Take each artifact path from the tool's own return value (its `output_hint` names the saved file under `~/.codex/generated_images/`), never "the newest PNG in a folder". Never paste the `image_url` data URL into your reply, the report, or any file. If the tool is unavailable or errors: status `blocked`, the exact error in `blocked_reason`, no API fallback, no CLI script, no drawing by code.

## Acceptance
Report: the provenance line; each visible-outcome check with pass/fail and what you saw; the prompt used for any edit turn, verbatim. List every file with its absolute WSL path.

## References and precedence
1. Max's words in the feedback (highest). 2. This brief's numbers. 3. The image prompt's KEEP slot. 4. The canon sheet. If two disagree, follow the higher one and say so in `decisions`.

## Do not
Paraphrase the prompt; add a scene, haze, shadows, glow, textures, decoration or objects the prompt does not list; write outside this job directory; modify the generated image with code; use any image path other than the built-in tool; reproduce the data URL.

---
## Canon sheet (Well Dipper design language, excerpt)
- "Retro space screensaver that doubles as an exploration game." CRT retro; slow, contemplative.
- "Strong silhouettes — planets, ships, megastructures read as shapes before they read as detail."
- Ships: Chris Foss-inspired, Star Fox 64-adjacent; low-poly flat-shaded facets; bold two-tone patterns in orange + deep blue; cream as the preferred third colour.
- Era: late-90s PC / PS1 / Saturn. Posterised colours, Bayer dithering, pixelated upscaling. Vast rather than frantic; open rather than cluttered. One distinguishing feature per object.
- The void is dark navy `#0a0a12`.
