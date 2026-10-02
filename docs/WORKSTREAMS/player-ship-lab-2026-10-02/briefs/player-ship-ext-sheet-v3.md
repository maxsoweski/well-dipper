# 2D concept-image brief — player ship, exterior, v3 (well-dipper-trunk)

Reference images attached, in order: (1) `player-ship-ext-sheet-r07.png` — the current sheet, which Max calls "a
great base" after six rounds of his edits: it is the DESIGN AUTHORITY for every part, colour, view and label. (2)
`foss-1-21st-century-foss-cover.jpg` — Chris Foss's liner, used ONLY for its overall side profile (a long, steep, rounded
climb from a low nose to a high bulky back). The canon sheet is inlined below; where it disagrees with Image 1 (paint
scheme), Image 1 wins: Max replaced paint with a part-colour map.

Lineage: continues job `20261002-133357-player-ship-ext-v2` (thread `01a0fdae-12f7-7da1-a242-86bcea6d477c`), whose
rounds 7 and 8 failed server-side ("Bad Request" after websocket fallback) on this same change; a fresh thread.

## Subject
The player's own ship in Well Dipper: an 18 m, house-sized, heavy industrial ship in Chris Foss's style, shown in Image 1.
Max's last change for this sheet, verbatim: "I'd like a more dramatic slope up from the cockpit area to the main body,
almost like a fat insect" … "look at the voss reference for example, just in terms of the overall shape" ("Voss" = Foss).

## Visible outcome
Check each on the actual image before you report; if a check fails, make ONE edit turn ("Change only X." followed by the
whole KEEP slot, with `referenced_image_paths` set to the previous image's local path) and re-check. A sheet is judged by
its labels; the drawing is a reference, not a measurement. If a check still fails after the edit turn, report `complete`
with that check marked FAIL — the reviewer decides; `blocked` is only for a tool that cannot make an image at all.

1. Side, front, rear and top views with view names, one baseline, same scale; small three-quarter view; small black silhouette.
2. The 1.8 m figure beside the side view; labels "LENGTH 18 m" and "BUBBLE 2.6 m"; part callouts BUBBLE, SPINE, DECKS, ENGINES, HATCH.
3. NEW: the side view shows a steep, rounded climb from a small, low front "head" (the hanging cockpit and the hull around
   it) up to a high, fat, bulky body — clearly steeper than Image 1, like Image 2's profile and like a fat insect. The deck
   rolls and spine sweep upward from the nose. The silhouette shows the same profile.
4. Everything else as Image 1: the rounded-cube glass bubble hanging under the front with two cream pillars across its
   front face; forward thruster sockets in the front view; magenta recessed manoeuvring thrusters on every non-rear face;
   the engine block recessed inside the hull with four recessed rear nozzles; stacked fat deck rolls, spine, teal
   underslung modules, red hatch; the nine-entry part-colour legend.
5. No numbers, insignia, flames, exhaust, scene, cast shadows or text other than labels and legend.

## Image prompt
The prompt below goes to the built-in image tool VERBATIM as its `prompt` — do not paraphrase, shorten, reorder or add creative detail.

```
JOB: redraw an approved spaceship concept sheet (Image 1) with ONE design change, so a 3D artist can model it. Late-1990s low-poly game target: big simple forms, nothing smaller than 30 cm.

SUBJECT: the ship in Image 1, exactly — same parts, same part colours, same legend, same views and labels — with one change: a much more dramatic slope up from the cockpit area to the main body, like a fat insect. The front becomes a small, low "head" (the hanging glass cockpit and the hull right around it), then the hull climbs steeply in a big rounded curve up to a high, fat, bulky body, the way Image 2's ship rises from its low nose to its high back (use Image 2 for that overall profile only, nothing else). The stacked fat deck rolls and the orange spine sweep upward from the nose along that climb.

VIEWS: side view, front view, rear view and top view, flat and orthographic, same scale, on one shared baseline, each named underneath (SIDE VIEW, FRONT VIEW, REAR VIEW, TOP VIEW); a small three-quarter view; a small solid black silhouette of the side view.

CONSTRUCTION: as Image 1: stacked fat rounded deck rolls, a raised spine, chunky teal underslung modules, a grey engine block recessed inside the hull's rear with four recessed nozzles facing straight back, small magenta recessed manoeuvring-thruster sockets on the front, top, bottom and sides, a red hatch, and a rounded-cube pale-blue glass cockpit in a cream frame hanging below the front with two thick cream pillars across its front face. Nothing smaller than 30 cm.

PROPORTIONS & SCALE: overall length 18 metres; a plain black 1.8 metre human figure beside the side view, labelled "1.8 m"; the ship about ten figure-heights long. Labels exactly: "LENGTH 18 m" under the side view, "BUBBLE 2.6 m" across the bubble in the front view. Part callouts: BUBBLE, SPINE, DECKS, ENGINES, HATCH.

STYLE: clean game concept art, flat colour fills with strong dark outlines, no shading, plain off-white background, even light, no cast shadows, no scene. Colour = part map, exactly as Image 1's legend: BUBBLE pale blue, COCKPIT FRAME cream, SPINE orange, DECKS yellow, UNDERSLUNG MODULES teal, ENGINE BLOCK mid grey, NOZZLES near-black, HATCH red, MANOEUVRING THRUSTERS magenta; the legend box with these nine entries. No numbers, insignia, flames or exhaust.

SELF-CHECK: the small solid black side silhouette must show the low head and steep climb to the high body.

KEEP: everything in Image 1 except the front profile — parts, colours, legend, views and view names, labels, the bubble's rounded-cube shape and front pillars, the recessed engines and thrusters, the figure; flat fills with dark outlines on plain off-white. Add nothing not listed above.
```

## Canvas and views
- Canvas: landscape, about 1536 × 1024; the tool chooses the exact size — report what it made.
- Views and scale reference as the prompt says; nothing measured from the three-quarter view.
- Background plain off-white; labels are the only text.

## Outputs
Write into this job directory only. Always these exact names; earlier rounds are archived by the runner,
so overwriting loses nothing.
1. `out/player-ship-ext-sheet.png` — the selected image, copied UNMODIFIED from the path the tool reports.
2. A provenance line in `report`: the tool's `output_hint` path, the copied path, byte size, width × height,
   sha256 of the copy, the number of tool calls (generate + edits), and the prompt actually sent if it
   differed from the brief's (it must not).
Use ONLY the built-in `image_gen` tool. Take each artifact path from the tool's own return value (its
`output_hint` names the saved file under `~/.codex/generated_images/`), never "the newest PNG in a folder".
Never paste the `image_url` data URL into your reply, the report, or any file. If the tool is unavailable
or errors: status `blocked`, the exact error in `blocked_reason`, no API fallback, no CLI script, no
drawing by code.

## Acceptance
Report: the provenance line; each visible-outcome check with pass/fail and what you saw; the prompt used
for any edit turn, verbatim. List every file with its absolute WSL path.

## References and precedence
1. Max's words in the feedback (highest). 2. This brief's numbers. 3. The image prompt's KEEP slot.
4. The canon sheet. If two disagree, follow the higher one and say so in `decisions`.

## Do not
Paraphrase the prompt; add a scene, haze, shadows, glow, textures, decoration or objects the prompt does
not list; write outside this job directory; modify the generated image with code; use any image path
other than the built-in tool; reproduce the data URL.

---
# Well Dipper — design language for modelled objects (canon sheet, 2026-09-21)

Attach this to every Well Dipper modelling brief. Sources: `docs/PILLARS.md` (Aesthetic, still a
skeleton Max will refine), the ship generator (`well-dipper-ships/src`), the Blender ship notes
(2026-03), and the shipped GLBs measured with `probes/glb-info.py`.

## The look, in the project's own words
- "Retro space screensaver that doubles as an exploration game." CRT retro; slow, contemplative.
- **"Strong silhouettes — planets, ships, megastructures read as shapes before they read as detail."**
- Ships are **Chris Foss-inspired, Star Fox 64-adjacent, classic sci-fi**: low-poly, **flat-shaded**
  facets, and **bold geometric colour patterns — stripes, chevrons, checkerboards, bands** in a
  primary + secondary colour pair (defaults were orange 1.0/0.5/0.1 and deep blue 0.05/0.1/0.4).
  Cockpit glass is tinted by the ship's secondary colour. Freighters also use a coarse speckle
  (two-tone stipple) pattern.
- The void is dark navy (renderer clear colour `#0a0a12`); models must read against it.

## From the Game Bible §2 Aesthetic (the ruling text; PILLARS is its skeleton)
- **Era:** "Late-90s PC / PS1 / Saturn. Low-poly geometry, posterized colors, Bayer dithering,
  pixelated upscaling. Frontier, Starglider, Galaxy on Fire. Vast rather than frantic. Open rather
  than cluttered."
- **The game does the retro rendering, not the model.** Per-object Bayer dithering and low render
  resolution are fragment-shader effects in Well Dipper. So a model ships CLEAN flat colours and
  the game posterises and dithers it. Never bake dither, noise or pixel textures into a model.
- **"No PBR, no bloom, no anti-aliasing."** Materials: metallic 0, roughness 1 (matte), flat base
  colour; the engine ignores the rest.
- **Energy is vacuum-realistic:** ports glow, light bounces on nearby hull, but no beams, plumes
  or jets. A station's docking-collar rims or thruster ports may glow; nothing streams out of them.
- **Open, not cluttered:** one distinguishing feature per object, no greeble carpets.

## What the shipped assets actually are (measured)
| asset | triangles | materials | UVs | size (m, X × Y × Z, Y up) |
|---|---|---|---|---|
| fighter-dart-101.glb | 152 | 1 flat colour | none | 1.2 × 0.3 × 6.1 |
| fighter-flying-wing-503.glb | 328 | 1 flat colour | none | 4.4 × 0.5 × 2.2 |
| cockpit.glb | 782 | 6 flat colours, one glass (alpha 0.12) | yes | 2.6 × 1.9 × 2.6 |

So the family is **hundreds of triangles, not thousands**; flat `baseColor` materials, no image
textures; metres; Y up in the GLB (Blender's glTF exporter does the Z-up → Y-up conversion).

## Rules for a new object
1. **Silhouette first.** It must be nameable from a black cutout at 200 m.
2. **Facets, not smoothing.** Flat shading; no subdivision; no bevel smaller than 0.2 m.
3. **Triangle budget by class:** fighter ≤ 400 · freighter ≤ 1,500 · **station module ≤ 2,500** ·
   megastructure ≤ 6,000. Report the count.
4. **Colour by material slot, not texture:** 2–4 Principled BSDF materials with flat base colours;
   bands/chevrons/checkerboards are made of **geometry or material assignment per face**, never
   painted textures. One primary, one secondary, optional dark hull and glass.
   **Preferred 4th slot = cream/off-white (0.88, 0.855, 0.78) on docking collars, band rings, hub cap
   and panel frames; glass optional, drop it if the slot budget is tight.** (Max's blind A/B pick,
   2026-09-21: the cream scheme "better", so it outranks blue glass as the 4th material.)
5. **Scale in metres** against the anchors above (a fighter is 6 m). State overall dimensions.
6. **Export:** glTF Binary, selected objects only, +Y up, no cameras or lights, origin at the
   object's centre of mass, forward = −Z (three.js convention).
7. **No text, no decals, no emissive glow** unless the brief asks (screens and engines may glow).
8. What "reads as Well Dipper": a bold two-tone pattern wrapped around a simple faceted mass, with
   one distinguishing feature per object (a spine, twin hulls, a disc, a ring).

## Station archetypes already on the record (research commissioned 2026-03-26, `well-dipper-ship-archetypes.md`)
"Stationary structures in orbit around planets or at Lagrange points. Larger than any ship. Built
from the same component library." Five types, each with a one-glance silhouette:
1. **Ring station** — 1–3 concentric tori on spokes round a cylindrical hub; "circles within circles".
2. **Cylinder station** (O'Neill) — one enormous cylinder, mirror panels, "the biggest thing you've ever seen".
3. **Hub station** (ISS / DS9 / Mir) — central node with 4–8 cylindrical modules radiating at odd
   angles, solar panels, a dish or two, docking ports on module ends; "asterisk silhouette, the most
   real-world looking".
4. **Platform station** (orbital dock / shipyard) — flat slab with recessed docking bays and crane
   gantries; "the working station, not elegant".
5. **Spire station** (relay) — tall needle with dishes at intervals; "vertical needle".
Working scale (my derivation, not ruled): a fighter is 6 m, so a hub station is 40–60 m across and
a ring station 60–100 m; state the number in every brief and let Max move it.
