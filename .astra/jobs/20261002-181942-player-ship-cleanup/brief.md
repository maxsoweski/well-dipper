# 3D asset brief — player ship CLEANUP of the GPU mesh, exterior + cockpit as ONE model (well-dipper-trunk)

Reference images attached, in order: (0) `pship_raw_4view.png` — the raw Hunyuan3D mesh rendered front/left/back/right; (1) `player-ship-ext-sheet.png` — the accepted EXTERIOR concept (side, front, rear,
top, ¾, silhouette, part-colour legend), Max: "now this is more like it". (2) `player-ship-cockpit-sheet.png` — the
accepted COCKPIT INTERIOR concept (pilot's view, side section, plan, dash close-up), Max: "I am happy with this".
(3) `foss-1-21st-century-foss-cover.jpg` — Chris Foss, the style source the exterior was developed from: how big forms
intersect. Shape and look only; take no paint, numerals, panels or exhaust from it. (4)–(7) `pship_front.png`,
`pship_left.png`, `pship_back.png`, `pship_right.png` — the four turnaround views the mesh was generated from: use them to
project the part colours onto the faces. The canon sheet is inlined below;
where it disagrees with the sheets (it predates Max's part-colour map), the sheets win.

**How to read this brief.** It tells you WHAT we want and WHY; HOW to model it is your call. The hard contract
is small: the numbers under Scale and axes, the node and material slot NAMES, the triangle ceiling, the Outputs and the
Acceptance report — those the engine and the probes depend on. Everything else is intent: use your judgement and your
eye to make the best-looking low-poly model you can; where this text and the concept images disagree about shape or
look, the images win.

## The input mesh — its SHAPE is the asset
The astra workflow's required on-GPU step (skill step 8b) has run: Hunyuan3D-2mv in Max's ComfyUI turned a clean
four-view turnaround of the accepted exterior into a sculpted mesh, then it was pre-decimated (quadric) to 40,000 triangles:
`C:\Users\Max\Documents\Blender\model-supply\refs\i23d\pship_pre40k.glb`
(WSL `/mnt/c/Users/Max/Documents/Blender/model-supply/refs/i23d/pship_pre40k.glb`; the 455k original is
`pship_raw_hy2mv.glb` beside it — do not open the original). 40,000 triangles, no colour, normalised units ≈ 1.25 × 1.16 ×
1.97 (glTF X × Y × Z), not watertight. Find which end is the nose (the cockpit bubble) from the four views.

**Preserve its shape; this job makes it a game model.** Max, on the raw mesh, verbatim: "in general, your reeds [reads] are the
same as mine. The spine and the protrusions and the undercarriage from the previous design were also things that were
really strong. So I want to make sure we don't lose those." So, as you reduce it:
- KEEP and, where the raw mesh went soft, SHARPEN from sheet (1): the orange SPINE ridge along the top; the PROTRUSIONS
  (the big lobes and domes, the thruster bumps); the UNDERCARRIAGE (the teal modules slung underneath).
- The raw mesh's cockpit glass came out as thin ragged flaps: REMOVE that region and BUILD the cockpit (below).
- The engine nozzles are recessed in the rear; keep them recessed.
The reads Max agreed with: lobed fat body, spine, undercarriage, hatch, sockets and recessed nozzles came through well;
the insect climb is softer than sheet (1) — keep the raw shape's climb unless a small change at the head makes the
hanging cockpit read better.

## What the generator could not make — BUILD it here
The hanging cockpit, entirely, from sheet (2) and the accepted exterior: the rounded-cube glass bubble under the low
head in its cream frame with two thick cream pillars across its front, hollow, with the interior: pillars bending into an
overhead beam, the wide SYSTEM screen hung from the beam, the small TARGET screen on the RIGHT pillar, the low narrow dash
on a post (round gauge cutting into the level chevron bar, warp-glyph window, two spares), the seat, the passage up into
the body, and the named interface nodes listed under Scale and axes.

## Blender calls stay SHORT
Every Blender call must finish well under 5 minutes (the bridge gives up at 600 s and a crash leaves Blender hung for
every later job). Keep the heavy mesh HIDDEN from the viewport while editing (viewport drawing of big image-to-3D meshes
has crashed Blender, 2026-09-25); split heavy work (decimate, colour projection) into steps. Do not start Blender any
other way; if the bridge fails, report blocked.

## Subject
The player's own ship in Well Dipper, a retro space-exploration game, as ONE model that is both the ship seen from
outside and the cockpit the player sits in. The player flies it from two views and switches between them with a quick
camera move: outside (a camera behind and a little above the ship, orbiting it) and inside (seated in the cockpit,
looking out). So the outside must read at a glance as a heavy, fat, insect-like Foss ship with a glass cockpit hanging
under its low "head", and the inside must feel like a helicopter-bubble cockpit: mostly open glass, two pillars bending
into an overhead beam, a wide screen hung from the beam, a small screen on the right pillar, and a low, narrow dash on a
post with a round gauge cutting into a chevron-shaped bar. Its ONE distinguishing feature is the hanging rounded-cube
glass cockpit under the steeply rising insect body. Max will judge: does it read as the sheets from outside, does the
cockpit feel right-sized against the ship when the camera flies in and out, and does the view from the seat work.

**This is a placeholder.** Max will later rebuild it by hand (Steam release without AI-made assets). So build it as a
clear set of named parts that match the sheet's part legend — a person should be able to open the .blend and see one
object per part — and keep the named nodes below exact: a hand-made replacement will be checked against them.

## How the game draws this (design for it, do not imitate it)
- The game renders at one-third resolution (pixel scale 3) and upscales with hard pixels; it quantises colour to
  5 bits per channel (the N64 / PlayStation framebuffer depth) and dithers per object. A late-1990s, 5th-generation look.
- So: flat-shaded facets, matte flat colours, no textures, no baked noise or dither, no tiny detail. A feature smaller
  than about 0.3 m on the exterior vanishes at the outside camera; inside the cockpit, close to the eye, about 0.05 m
  is the floor.
- Big rounded forms (the fat lobes, the domes, the rounded-cube bubble) become a modest number of broad flat facets
  that still read as round at that resolution — polygonal, not smooth, and not blocky boxes either.
- The chevron bar's rounded tip is drawn as a few straight facets (Max: "a polygonal representation" of a curve).

## Visible outcome
1. EXTERIOR — the ¾, side, top and rear renders read as the same ship as sheet (1): low head with the glass cockpit
   hanging beneath it; a steep, rounded climb to a high, fat back built from a few big intersecting lobes and domes;
   orange spine lobe; teal modules slung underneath; engine block recessed inside the hull with four rear nozzles
   pointing straight back; small recessed magenta thruster sockets on front, top, bottom and sides; red hatch on the side.
   Nothing protrudes past the hull at the back.
2. COCKPIT FROM OUTSIDE — the rounded-cube glass bubble (not a sphere) hangs under the front, in a cream frame, with two
   thick cream pillars across its front face. You can see into it through the glass.
3. COCKPIT FROM INSIDE — the pilot's-eye render reads as sheet (2)'s pilot's view: at least about two-thirds open glass;
   two pillars bending into an overhead beam; the wide SYSTEM screen hung from the beam, a little off-centre; the small
   TARGET screen on a bracket on the RIGHT pillar near eye line; a low, narrow dash on a post at knee height with the
   round gauge cutting into the left end of a level chevron-shaped bar, the warp-glyph window and two spare windows; the
   view down past the pilot's feet open. Screen and instrument faces are blank dark faces (the game draws onto them).
4. SCALE — the cockpit sits right against the ship: a seated 1.8 m person fits the bubble (head clear of the roof, eye
   about 1.2 m above the cabin floor), and from outside the bubble is small against the 18 m body, as on sheet (1).
5. Silhouette (¾, all black) is nameable as "fat insect ship with a pod under its nose".

## Review loop (mandatory)
Clean up, then LOOK and fix, at least 3 and at most 6 passes. Each pass: render the model from the same angle(s) as each
reference view (exterior: side, front, rear, top, ¾; interior: the pilot's-eye view), view the render beside the
reference, write down every difference you see in shape and proportion (silhouette, where the climb starts and how
steep it is, lobe and dome sizes, bubble shape, pillar and screen positions, where parts point, symmetry), and fix the
GEOMETRY — not the lighting or framing. Also check the `-34-game.png` (below) each pass: anything that turns to mush at
game resolution is too small or too busy. Stop when a pass finds nothing worth fixing. Put the per-pass difference lists
in `report.md` under "Loop log".

Craft, as outcomes: symmetric where the sheets are symmetric, deliberately asymmetric where they are (the screens);
curves even; matching parts match. Any Blender method is fine as long as it is applied before export and the result
stays flat-shaded. Spend most of the triangle ceiling on the silhouette, the spine, the protrusions and the undercarriage.

## Scale and axes
- Units: metres. Overall length 18 m (±10 %); width and height as the sheet's proportions give them. Cockpit bubble
  2.6 m wide (±10 %). Anchors: a seated 1.8 m pilot; the game's fighters are 6 m long.
- Origin: the ship's centre of mass, on the world origin.
- Forward = the cockpit end. Build it along Blender **+Y** (the glTF exporter maps Blender +Y → glTF −Z, the three.js
  forward). Up = Blender +Z (exports +Y).
- The cockpit glass + frame object is the forward feature: name it `Bubble_MAIN`; it must lie wholly forward of the
  origin (its centre at +Y in Blender), since the probe requires the `_MAIN` object's glTF z-centre to be negative.
- **Named nodes (the interface — exact names):**
  - `Eye_Point` — an Empty at the seated pilot's eye, inside the bubble, oriented to look forward along +Y (Blender).
  - `Screen_System`, `Screen_Target` — each a single flat face (two triangles) covering that screen's display area,
    facing the eye, with a UV map spanning 0..1 across the face (U left→right, V bottom→top as seen from the eye).
  - `Instrument_EngineGauge` (the round face), `Instrument_SpeedBar` (the chevron face), `Instrument_WarpGlyph`,
    `Instrument_Spare_1`, `Instrument_Spare_2` — each the display face of that instrument as its own object, facing the
    eye, with a 0..1 UV map across its bounding rectangle.
  - Everything else: one object per part of the legend (e.g. `Spine`, `Decks`, `Underslung`, `Engine_Block`, `Nozzles`,
    `Hatch`, `Thrusters`, `Cockpit_Frame`, `Dash`, `Seat`, `Passage`); split further if it helps, keep names readable.
- Collision: none.

## Budgets
- Triangles ≤ 3,000 for the whole model, exterior and interior together — a CEILING, not a target (report the count,
  and the split exterior vs. cockpit).
- Materials: the 13 slots below, no others. Textures: none. UVs: only on the seven screen/instrument faces above.
- Flat-shaded and matte everywhere.

## Materials
Exactly these Principled BSDF slots (descriptive names, the part legend of the two sheets), metallic 0, roughness 1,
flat base colour in linear RGB floats, alpha 1 unless stated:
- `glass` — pale blue (0.55, 0.75, 0.90), alpha 0.15, blend mode alpha-blend; the bubble's panes (visible from both sides).
- `cockpit_frame` — cream (0.88, 0.855, 0.78): bubble frame, pillars, overhead beam, screen brackets.
- `spine` — orange (1.0, 0.5, 0.1).
- `decks` — yellow (1.0, 0.78, 0.05): the hull lobes, domes and layers.
- `underslung` — teal (0.0, 0.42, 0.45).
- `engine_block` — mid grey (0.35, 0.35, 0.36).
- `nozzles` — near-black (0.02, 0.02, 0.025): inside the main nozzles and the thruster sockets.
- `hatch` — red (0.8, 0.05, 0.05).
- `thrusters` — magenta (0.85, 0.0, 0.6): the rims of the manoeuvring-thruster sockets.
- `screens` — charcoal (0.03, 0.03, 0.035): the seven display faces (blank; the game draws onto them).
- `dash` — dark grey (0.15, 0.15, 0.16): dash body, its post, screen and instrument housings.
- `seat` — brown (0.35, 0.18, 0.08).
- `passage` — teal-blue (0.05, 0.35, 0.42): the passage behind the seat up into the body.
No emissive on any slot; no painted textures; no decals or text.

## Outputs
Blender output directory (Windows): `C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\`
FIRST move the earlier scripted-road outputs there (`player-ship.glb`, `.blend`, `player-ship-*.png` except the two
`*-sheet.png`, `build_ship.py`, `finalize_ship.py`, `review*`, `audit.json`, `metrics.json`, `report.md`) into an
`archive-scripted/` subfolder.
Always write these exact names; earlier rounds are archived by the runner, so overwriting loses nothing.
In `artifacts`, list absolute WSL paths (`/mnt/c/Users/Max/...`); Blender itself uses `C:\...`.
1. `player-ship.glb` — glTF Binary, selected objects only (include the `Eye_Point` empty), +Y up, apply modifiers,
   no cameras/lights.
2. `player-ship.blend` — save-as into the same directory before any other change.
3. `player-ship-34.png`, `-top.png`, `-side.png`, `-rear.png`, `-front.png` — 960×540 on background (0.04, 0.04, 0.07)
   linear; ¾ = 20° elevation / 125° azimuth (azimuth from +X toward +Y, so it views the forward side from front-left),
   55 mm; top, side, rear, front orthographic. Render the ¾ view from the RE-IMPORTED GLB, not the working scene.
4. `player-ship-pilot.png` — 960×540, camera AT `Eye_Point` looking along its forward axis, 70° VERTICAL field of view
   (the game's setting), background (0.55, 0.70, 0.85) so the glass reads, from the RE-IMPORTED GLB.
5. `player-ship-chase.png` — 960×540, the outside view: camera behind and a little above the ship (about 25 m behind the
   origin, 7 m up, aimed at the origin), 70° vertical FOV.
6. `player-ship-34-game.png` — the ¾ view rendered at 320×180 and upscaled ×3 with nearest-neighbour (no smoothing),
   approximating the game's one-third-resolution pixels.
7. `player-ship-silhouette.png` — ¾ view, all materials black, white background.

## Acceptance
Report: mesh/object count with names, triangle count (total, exterior, cockpit), material count with base colours,
bounding box (m), UVs yes/no and on which objects, the `_MAIN` object's glTF z-range, the `Eye_Point` position (m,
Blender axes) and its height above the cabin floor, the re-import check (fresh temp scene, dims match, named nodes
present, then delete it), the visible-outcome checks with pass/fail each, and the Loop log. List every file with its
absolute path.

## References and precedence
1. Max's words in the feedback (highest). 2. For SHAPE and LOOK: the concept sheets (1) and (2), then Foss (3) for how
forms intersect, then the canon sheet. 3. For the INTERFACE (length, bubble width, origin, forward, node and slot names,
ceiling, outputs): this brief's numbers. If two disagree, follow the higher one and say so in `decisions`.

## Do not
Modify or delete anything you did not create; write outside the job dir and the Blender output directory; add text,
decals or emissive glow; model the sample screen content from sheet (2) (the faces stay blank); open the 455k original mesh; paint textures;
smooth-shade; disturb whatever scene Max already has open — save-as into the output directory first.

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
