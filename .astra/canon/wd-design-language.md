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
