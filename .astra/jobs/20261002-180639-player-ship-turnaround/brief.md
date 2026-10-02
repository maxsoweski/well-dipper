# 2D concept-image brief — player-ship-turnaround (clean four views for image-to-3D) (well-dipper-trunk)

Reference images attached, in order: (1) `player-ship-ext-sheet.png` — the ACCEPTED exterior sheet (Max: "now this is
more like it"): the authority on shape, parts, colours and proportions. The canon sheet is inlined below; this picture
is NOT a concept sheet: no labels, no legend, no scale figure, no silhouette — THIS BRIEF OVERRIDES the canon's sheet
layout and paint scheme.

## Subject
The workflow's required on-GPU mesh step (astra skill step 8b; Max, 2026-10-02: "did you use the on-gpu 3d mesh
creation step like our workflow requires?"). Hunyuan3D (in Max's ComfyUI) builds a mesh from four views of the object
on a plain background. This job makes those four views of the accepted Well Dipper player ship: the same ship as the
sheet, with every non-ship mark removed and a RIGHT side view added (the sheet has one side view). Only the EXTERIOR
matters here — the cockpit interior is built later in the cleanup job, so the glass bubble may be drawn as on the sheet.

## Visible outcome
The generated image must show ALL of the following. Check each on the actual image before you report; if one fails,
make ONE edit turn ("Change only X." followed by the whole KEEP slot, with `referenced_image_paths` set to the previous
image's local path) and re-check. If a check still fails, report `complete` with that check marked FAIL; `blocked` is
only for a tool that cannot make an image at all.
1. Exactly four views in one row: FRONT, LEFT side, BACK, RIGHT side, of the same ship.
2. Same scale; the ship's top, bottom and length line up across the views (the two side views are mirror images in outline).
3. Shape, parts, colours and proportions match the reference sheet.
4. Pure white background; no text, labels, numbers, legend, lines, dots, scale figure, ground line or silhouette anywhere.
5. Flat fills, no shading or shadows; clear white space between the four views.

## Image prompt
The prompt below goes to the built-in image tool VERBATIM as its `prompt` — do not paraphrase, shorten,
reorder or add creative detail.

```
JOB: a clean four-view turnaround of a spaceship to feed an image-to-3D generator (Hunyuan3D multi-view). The generator reads every mark on the picture as part of the object, so the picture must contain ONLY the ship, four times.

SUBJECT: exactly the spaceship on the attached reference sheet (Image 1), same shape, parts, colours and proportions: a fat, insect-like ship about 18 m long — a small low "head" at the front with a rounded-cube pale-blue glass cockpit in a cream frame hanging beneath it (two cream pillars across its front), then a steep rounded climb to a high bulky back built from a few big intersecting yellow lobes and domes with an orange spine lobe on top; teal modules slung underneath; a red hatch on the side; small magenta thruster sockets; at the back a grey engine block recessed inside the hull with four dark nozzles pointing straight back.

VIEWS: four views of the same ship side by side in one row, left to right: FRONT (nose toward the viewer), LEFT (the ship's left side toward the viewer, nose pointing right), BACK (the rear and its four nozzles toward the viewer), RIGHT (the ship's right side toward the viewer, nose pointing left). Orthographic, no perspective, all four at exactly the same scale, the ship's bottom on one shared baseline, evenly spaced with clear white space between them, each view fully in frame.

CONSTRUCTION: the ship as on the reference sheet, nothing added, nothing removed.

PROPORTIONS & SCALE: identical to the reference sheet (Image 1); do not restyle the ship.

STYLE: clean flat colour fills (solid, unshaded) with a thin dark outline, no shading, no gradients, plain pure white (#FFFFFF) background, soft even light, no shadows. NO text, NO labels, NO numbers, NO legend, NO scale figure, NO measurement lines, NO silhouette, NO ground line, nothing on the picture except the four views of the ship.

SELF-CHECK: the four views line up: top of the back, bottom of the cockpit and modules at the same heights across all four; the two side views have the same length.

KEEP: the four views FRONT, LEFT, BACK, RIGHT in one row at one scale on one baseline; the ship's shape, parts, colours and proportions as the reference sheet (Image 1); pure white background; no text, labels, legend, lines, figure or silhouette. Add nothing not listed above.
```

## Canvas and views
- Canvas: landscape, about 1536 × 1024; the tool chooses the exact size — report what it made.
- Views and scale reference as the prompt says.
- Background pure white; no text at all.

## Outputs
Write into this job directory only. Always these exact names; earlier rounds are archived by the runner,
so overwriting loses nothing.
1. `out/player-ship-turnaround.png` — the selected image, copied UNMODIFIED from the path the tool reports.
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
