# 2D concept-image brief — player ship, cockpit interior (well-dipper-trunk)

Reference images attached, in order: (1) `cockpit-bubble-rebels.jpg` — Max's cockpit inspiration: it controls the FEEL
from the seat (thick pillars rising and bending inward, open glass all round and below, screens hung off the structure, a
low dash). Max does NOT want its many screens or its cables. (2) `player-ship-ext-sheet.png` — the accepted exterior: it is
the AUTHORITY for the cockpit's shell — the rounded-cube glass bubble hanging under the front of the hull, its cream frame
and its two cream pillars across the front face — and for the part-colour convention. The canon sheet is inlined below;
where it disagrees with Image 2 (paint), Image 2 wins.

## Subject
The inside of the player ship's cockpit in Well Dipper, a retro space-exploration game: the rounded-cube glass bubble that
hangs under the front of the ship (Image 2), seen from the pilot's seat and in section. One seated pilot. The view must stay
open — "the cockpit should feel like it doesn't detract too much from the environment" (Max) — with glass in front, to the
sides and below the pilot's feet. Its ONE distinguishing feature: the two thick front pillars, from which the screens hang
on short arms. A stranger must recognise it as "a helicopter-style bubble cockpit, mostly glass, with a few instruments".

The instrument layout is Max's signed-off display plan (`DISPLAY-PLAN.md`):
- LOWER DASH (low, at knee height, centred, narrow so it does not block the view down): a ROUND GAUGE (engine mode), beside
  it a SEGMENTED BAR (throttle and speed, one direction, a straight row of segments), and near both a WARP GLYPH (a small
  square window for a status symbol). Two small SPARE slots beside them for later readouts.
- ABOVE THE DASH: two flat SCREENS on short arms off the two front pillars, angled toward the pilot: SYSTEM on the left,
  TARGET on the right (working-Claude's assignment; Max may swap).

Screens and instruments are drawn BLANK (dark faces with a light outline) and LABELLED — no invented displays, numbers or UI.

## Visible outcome
Check each on the actual image before you report; if a check fails, make ONE edit turn ("Change only X." followed by the
whole KEEP slot, with `referenced_image_paths` set to the previous image's local path) and re-check. A sheet is judged by
its labels; the drawing is a reference, not a measurement — write the labels exactly as the prompt gives them. If a check
still fails after the edit turn, report `complete` with that check marked FAIL — the reviewer decides; `blocked` is only
for a tool that cannot make an image at all.

**Spend the edit turn on the labels and the arrangement, never on the drawing's proportions.**

1. Three views: a large PILOT'S VIEW (first person, from the seated eye, looking forward), a SIDE SECTION (the bubble cut
   in half lengthwise, with a seated 1.8 m figure) and a TOP PLAN (cut away from above), each named.
2. Labels: SYSTEM SCREEN, TARGET SCREEN, ENGINE GAUGE, THROTTLE / SPEED BAR, WARP GLYPH, SPARE, PILLAR, SEAT, EYE; and
   "BUBBLE 2.6 m" across the width in the top plan.
3. Two thick cream pillars across the front glass, with the two screens hanging off them on short arms.
4. A low, narrow dash at knee height with the round gauge, the segmented bar beside it, the warp glyph and two spare
   slots; clear glass beside and below it so the pilot can see down past their feet.
5. Screens and instruments blank and labelled; no invented readouts.
6. A part-colour legend; no scene outside the glass (plain pale background seen through it), no cast shadows.

## Image prompt
The prompt below goes to the built-in image tool VERBATIM as its `prompt` — do not paraphrase, shorten, reorder or add
creative detail; it was written against the engine's profile and every slot is deliberate.

```
JOB: video-game cockpit interior concept sheet, so a 3D artist can model the inside of the player's ship cockpit and place its instruments. Late-1990s low-poly game target (PlayStation-1 era, 240 lines): big simple forms, flat colours, nothing smaller than 5 cm.

SUBJECT: the inside of the rounded-cube glass bubble cockpit that hangs under the front of the ship in Image 2, for one seated pilot, with the feel of Image 1 (a helicopter-style bubble cockpit: open glass all round and below the pilot's feet, thick pillars, screens hung off the structure) but far fewer screens. Two thick cream pillars run up the front of the glass in front of the pilot. Two flat screens hang on short arms off those two pillars, angled toward the pilot: the SYSTEM SCREEN on the left, the TARGET SCREEN on the right. A low, narrow dash at knee height, centred, holds a round ENGINE GAUGE, beside it a THROTTLE / SPEED BAR (a straight row of rectangular segments), a small square WARP GLYPH window near them, and two small blank SPARE slots. Clear glass beside and below the dash so the pilot can see down past their feet. A simple seat. Behind the seat, a short passage up into the ship's body. No cables, keypads, switches, extra screens or clutter.

VIEWS: a large PILOT'S VIEW (first person from the seated pilot's eye, looking straight ahead, wide 70-degree view); a SIDE SECTION (the bubble cut in half lengthwise, showing a seated 1.8 metre human figure, the seat, the dash and the pillars); a TOP PLAN (cut away from above). Each view named underneath. Section and plan flat and orthographic.

CONSTRUCTION: a few large simple solids: the glass shell, the cream frame and pillars, two screen boxes on short arms, the dash, the gauge, the bar, the glyph window, the seat. Screens and instrument faces drawn blank: dark faces with a light outline, no readouts, no numbers, no invented interface.

PROPORTIONS & SCALE: the bubble is 2.6 metres wide; a plain 1.8 metre human figure sits in the seat in the side section with a small circle marking the eye, labelled EYE. Write these labels exactly: SYSTEM SCREEN, TARGET SCREEN, ENGINE GAUGE, THROTTLE / SPEED BAR, WARP GLYPH, SPARE, PILLAR, SEAT, EYE, and "BUBBLE 2.6 m" across the width in the top plan.

STYLE: clean game concept art, flat colour fills with strong dark outlines, no shading, plain off-white background, plain pale sky-blue seen through the glass (no scene, no stars, no city), even light, no cast shadows, no text except the labels and a legend. Colour = part map, with a small legend: GLASS pale blue, FRAME AND PILLARS cream, SCREENS dark charcoal with white outline, DASH dark grey, INSTRUMENTS green, SEAT brown, PASSAGE teal.

SELF-CHECK: in the pilot's view, at least two-thirds of the picture is open glass.

KEEP: the three named views; the labels exactly as listed; the 1.8 m seated figure and EYE marker; two cream pillars with the two screens on arms; the low narrow dash with gauge, bar, glyph and two spares; open glass in front, at the sides and below; blank labelled screens and instruments; the part colours and legend; flat fills with dark outlines on plain off-white. Add nothing not listed above.
```

Extraction note: read the instrument and screen positions from the pilot's view and the section; read the eye height and
the dash height from the section against the 1.8 m figure; read the bubble width from the plan label. Check the pilot's
view is mostly open glass.

## Canvas and views
- Canvas: landscape, about 1536 × 1024; the tool chooses the exact size — report what it made.
- Views and scale reference as the prompt says.
- Background plain off-white; labels and legend are the only text.

## Outputs
Write into this job directory only. Always these exact names; earlier rounds are archived by the runner,
so overwriting loses nothing.
1. `out/player-ship-cockpit-sheet.png` — the selected image, copied UNMODIFIED from the path the tool reports.
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
not list; invent screen content; write outside this job directory; modify the generated image with code; use any
image path other than the built-in tool; reproduce the data URL.

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
