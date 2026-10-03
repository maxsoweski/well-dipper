# 3D asset brief — player ship, REAR JUNCTION TEST (well-dipper-trunk)

Reference images attached, in order: (1) concept sheet r10, the authority on shape; (2) `lines-r10.png`, r10 with its
ten named feature lines; (3) `r10-rear-annotated.png` — r10's OWN rear, side-rear and top-rear, enlarged and labelled A–G with how the rear is
built (a redrawn detail sheet drifted from r10 and was not used); (4) the current B rear render and (5) B's side overlay — the result Max rejected. Data file:
`lines.json` (in the output folder) — every named line as polylines in metres per view.

**How to read this brief.** WHAT and WHY; HOW is yours. Hard contract: Scale and axes, slot names, the triangle
ceiling, Outputs, Acceptance. Where text and images disagree on shape, r10 wins; image 3's numbered notes say how its parts meet.

**Lineage.** Step 3 of the line-driven process Max approved 2026-10-03 ("yes"), built from your own proposal on thread
`01a0feb3-b048-7e71-86ab-6c3fae0eda63` (`consult-after-B-r02.md`): "Prove the difficult junction first. Model the
upper-shell/flank/rear-lip meeting with its neighbouring surfaces and engine carrier visible. Review this before
reconstructing the remaining hull." Scripted road authorised by Max for this asset (quotes in the cleanup job's UAT).

## Subject
A TEST PIECE, not the ship: only the rear third of the B hull (from about 12 m back from the bubble's front to the
tail), rebuilt as ONE connected surface whose facet edges run along r10's lines, at the triangle allocation it would
have in the finished ship. It answers one question for Max: can this workflow produce coherent, deliberate surfaces?
Max's words on the current B (verbatim): "the rear of the craft looks like a bunch of shapes stuck on top of each other
rather than several shapes meeting in a shared plane. It also looks like there's no care given to the overall polygons
on the decks to create the specific (and not that many) lines that are displayed in the concept art. This is like a
clay model that hasn't had a final pass over it to smooth out the jagged shapes that aren't actually coherent yet."
"The lip above the rear exhaust should be a lot more rounded in shape and shouldn't end in a sharp angle. It should be
just kind of a lip that extends out over the rear engines." "The thrusters on the body should all be the same octagonal
shape. There should be no thrusters on modules."

## Visible outcome
- The deck shells, aft shoulder, spine end, lip and engine surround read as surfaces that MEET — shared edges, one
  shared rear plane — not solids pushed into each other. No visible interpenetration anywhere.
- Facet edges lie along the named lines that pass through this region (L1, L3, L4, L5, L6, L10): drawn over r10's line
  art in the side, top and rear views, the model's crease edges land on those lines. Between lines, facets are even
  and flow along the surface; no slivers, no random diagonal zig-zags.
- The lip is a soft rounded brim over the recessed engine block. The four nozzles are shallow sockets with
  `engine_glow` backs. Thruster ports: identical small octagons, none on modules.
- Mirror-symmetric by construction.
- Under neutral grey shading (no part colours), the surfaces still look deliberate.

## Review loop (mandatory)
At least 3, at most 6 passes. Each pass: render rear, side, top and ¾-rear views; draw the model's crease edges over
r10's line art (registered as in `lines.json`); render the same views in neutral grey; list every place an edge misses
its line by more than about 0.3 m, every interpenetration, sliver or incoherent facet run; fix the GEOMETRY. Loop log in
`report.md`. Keep three statements separate: technical checks; remaining differences; no claim of approval.

## Scale and axes
Same frame as `envelope-B.glb`: metres; build forward along Blender **+Y** (exports to glTF −Z); up = +Z; name the
connected rear hull object `RearHull_MAIN` (the `_MAIN` suffix marks it for the probe); origin unchanged, so the test piece drops into
B's place. Envelope of the rear third unchanged within ±0.3 m. Use B's current rear (`envelope-B-source.glb`, in the output folder) as the size guide, not its surfaces. The
blueprints are in `blueprints\` there too.

## Budgets
Triangles ≤ 800 for the rear third (its share of the ~2,200 exterior budget). Flat-shaded, matte.

## Materials
Same slots as B: `decks`, `spine`, `underslung`, `engine_block`, `nozzles`, `engine_glow`, `thrusters`, `hatch`.

## Outputs
Blender output directory (Windows): `C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\rear-test\`
(WSL: `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/`). Do not touch the
`envelope\` folder. In `artifacts`, list absolute WSL paths.
1. `rear-test.glb`, `rear-test.blend`.
2. `rear-test-34.png` (¾ from behind-left, 20° up), `-rear.png`, `-side.png`, `-top.png` — 960×540, background
   (0.04, 0.04, 0.07); from the RE-IMPORTED GLB.
3. `rear-test-grey-34.png`, `rear-test-grey-side.png` — the same with every material neutral grey.
4. `rear-test-lines-side.png`, `-lines-top.png`, `-lines-rear.png` — 1600 px wide: r10's view with its line art, and
   the model's crease edges drawn over it in a contrasting colour.

Blender calls stay SHORT (under 5 minutes each).

## Acceptance
Report: triangle count, materials, bbox, symmetry (largest left/right vertex mismatch), interpenetration check, the
Loop log, remaining differences per named line, every file with its absolute path.

## References and precedence
1. Max's words (highest). 2. SHAPE: r10, then image 3's notes, then `lines.json`. 3. INTERFACE: this brief's numbers.
If two disagree, follow the higher one and say so in `decisions`.

## Do not
Rebuild anything forward of the rear third; reuse B's intersecting-volume method; rely on automatic decimation or
remeshing to make the final edges; put thrusters on modules; modify or delete anything you did not create; smooth-shade.

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

