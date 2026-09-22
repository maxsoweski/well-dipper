# Astra conventions (read first; these override anything below that conflicts)

You are GPT-6 Astra running non-interactively under Codex CLI, called by Claude Code on behalf of Max.
Nobody answers mid-run. Your working directory is this job's directory; write only inside it (and,
for 3D jobs, only inside the Blender output directory the brief names).

## Your final message is JSON, nothing else
It must match the output schema you were given. Fields:
- `status`: `complete` when every output the brief lists exists and passes your own checks;
  `needs_input` when you cannot proceed without an answer (then fill `questions`, do nothing
  speculative, and stop); `blocked` when a tool, permission, quota or file stops you
  (fill `blocked_reason`).
- `report`: the acceptance report the brief asks for, as Markdown (numbers, not adjectives).
- `artifacts`: every file you wrote, ABSOLUTE path + what it is. Never list a file you did not verify exists.
- `decisions`: every choice you made alone where the brief or references were ambiguous, one line each.
- `questions`: `{id, question, options, default}`; ids like `q1`, `q2`. Bundle related blocking
  questions in one round rather than one per round.
- `checkpoint`: what the next round needs to continue without re-reading everything:
  `artifact_versions` (path + version/hash you can state), `invariants` (things that must not
  change), `accepted_decisions`, `rejected_approaches` (and why), `unresolved`, `next_action`.

## Rounds
Later rounds arrive as "Round N feedback" on this same thread, with Max's words verbatim, the
latest checkpoint, and answers to your questions keyed by id (`answers: {q1: ...}`). Treat Max's
sentence as the acceptance criterion for that round.

## Quality bar
State the visible outcome you are aiming at before building; check it before reporting. If a
step fails twice, change approach; after three failures on the same step, report `blocked` with
the exact error. Report only what you verified; when your own count and a probe could disagree,
say which you measured and how.


---

# 3D asset brief — dock buoy (well-dipper-trunk)

Reference images attached, in order: (1) `fighters_v7_close1.png` — the canon fighters: use them for SCALE (a fighter is 6 m long) and for the exact orange / blue / cream palette; (2) `station-hub-v3-34.png` — the accepted station hub v3, which is the family this buoy must belong to (faceted flat colour, wide cream band rings, blue chevrons, matte, nothing glowing). The canon sheet is inlined below.

## Subject
A navigation and docking buoy for Well Dipper: a 4 m faceted sphere-and-mast marker that sits alone in space at a jump point or a station approach lane, and that a 6 m fighter parks beside while the pilot reads it. It is the smallest object in the Well Dipper family — one round faceted body with one straight mast off one side, no greebles, no panels, no antennas. Its ONE distinguishing feature is a cream band wrapping the body with a blue chevron on it, pointing the way along the mast.

## Visible outcome
The three-quarter preview (`dock-buoy-34.png`) must show all of this, in plain words:

1. **One shape, alone.** A round faceted orange body with a single straight mast sticking out of one side, centred in frame against the near-black background, nothing else in the picture.
2. **The band reads as a continuous ring.** A cream band wraps all the way around the body, unbroken — a ring, not patches or dashes. It is about a third of the body's diameter in width, so it is wide enough to see at a glance rather than a pinstripe.
3. **The chevron reads as a V.** One blue chevron sits on the cream band, unmistakably a V or arrowhead — not a dot, not a straight stripe, not a blob — with its point aimed along the mast (the +Y / parking side). It is fully inside the cream band, fully visible in this camera, and not clipped at the body's silhouette edge.
4. **The mast reads as a separate slim column** leaving the body, with a flat cream cap on its far end — you can tell body from mast at a glance.
5. **Flat and matte.** Facets with hard edges, flat colour, no gloss highlights, no glow, no glass, no text or numerals anywhere.

Check items 1–5 on the actual ¾ render before you report. If a check fails, change the model and re-render; do not report `complete` on a render that fails one of them, and say in `decisions` what you moved to make the chevron read.

## Scale and axes
- Units: metres. Overall size: 2.2 × 4.0 × 2.2 m (Blender X × Y × Z; Y is the mast axis, so 4.0 m is body plus mast end to end, and the body is a 2.2 m sphere). Anchor: a fighter is 6 m long, so the whole buoy is about two-thirds of a fighter's length and the body alone is about a third of it.
- Origin: centre of mass of the whole buoy (body + mast together), and place that origin on the world origin.
- Forward = the main docking/attachment feature. Build it along Blender **+Y** (the glTF exporter maps
  Blender +Y → glTF −Z, the three.js forward). Up = Blender +Z (exports +Y).
- Name the forward feature's object with the suffix `_MAIN`: the mast object is `Mast_MAIN`; the body object is `Buoy_Body`. A probe reads the `_MAIN` object's glTF z-range and requires its centre to be negative, so `Mast_MAIN` must lie wholly on the +Y side of the origin in Blender: its own bounding-box centre must be at least 0.8 m along +Y.
- Attachment/docking points: one — the flat cream cap on the far (+Y) end of the mast, a flat face 0.5 m across, square to +Y and unobstructed, which is what a 6 m fighter noses up to; the game parks the fighter, so the model only owes a flat clear face with at least 6 m of empty space beyond it along +Y. Collision: none (the game uses a sphere).

## Budgets
- Triangles ≤ 300 (report the count). Materials: 3 slots max. Textures: none. UVs: not required.
- Flat shading everywhere; no subdivision; no detail or bevel under 0.2 m; primitives and simple extrusions.
- Guide numbers that fit inside the budget (use them or beat them, they are not mandates): a 12-segment × 6-ring faceted sphere body ≈ 120 tris, an 8- or 12-sided mast cylinder ≈ 30 tris, the end cap ≈ 20 tris; the band and the chevron come from assigning faces you already have, so they cost nothing.

## Materials
Exactly 3 Principled BSDF slots, all three used, no more (Well Dipper names are descriptive), each with metallic 0, roughness 1, alpha 1, flat base colour in linear RGB floats:
- `hull_orange` — orange (1.0, 0.5, 0.1): the body and the mast.
- `band_cream` — cream (0.88, 0.855, 0.78): the band ring around the body and the mast's end cap.
- `chevron_blue` — deep blue (0.05, 0.1, 0.4): the chevron on the band.

The band is a ring of faces around the body in the plane perpendicular to the mast axis, so it reads as a ring from every direction around that axis; the chevron is a group of faces inside that ring. Both are made by per-face material assignment (or by separate geometry if that is cleaner), never by a painted texture, never by a UV map. No glass slot and no emissive on any slot: this buoy does not light up.

## Outputs
Blender output directory (Windows): `C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\dock-buoy\`
1. `dock-buoy.glb` — glTF Binary, selected objects only, +Y up, apply modifiers, no cameras/lights.
2. `dock-buoy.blend` — save-as into the same directory before any other change.
3. `dock-buoy-34.png`, `dock-buoy-top.png`, `dock-buoy-side.png` — 960×540 on background (0.04, 0.04, 0.07) linear;
   fixed cameras: ¾ = 20° elevation / 125° azimuth from the +Y side, 55 mm; top and side orthographic.
   Render the ¾ view from the RE-IMPORTED GLB, not the working scene.
4. `dock-buoy-silhouette.png` — ¾ view, all materials black, white background.

**Path forms.** Blender is a Windows process, so every path you hand to Blender/`bpy` must be the Windows form above. You are running under WSL, where that same directory is mounted at `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/dock-buoy/`. Before you report, stat each of the six files at its `/mnt/c/...` path to confirm it exists and is non-empty, and list the `/mnt/c/...` form in `artifacts` — the runner checks those paths from WSL and treats a path it cannot find as a missing artifact. If the sandbox will not let you stat `/mnt/c/...`, say so in `decisions`, verify the files through Blender instead, and list the `/mnt/c/...` paths anyway.

## Acceptance
Report: mesh count, triangle count, material count with base colours, bounding box (m), UVs yes/no,
the `_MAIN` object's glTF z-range, the re-import check (fresh temp scene, dims match, then delete it),
and the visible-outcome checks with pass/fail each. List every file with its absolute path.

## References and precedence
1. Max's words in the feedback (highest). 2. This brief's numbers. 3. The concept image(s).
4. The canon sheet. If two disagree, follow the higher one and say so in `decisions`.

## Do not
Modify or delete anything you did not create; write outside the job dir and the Blender output
directory; add text, decals or emissive glow unless asked; paint textures; smooth-shade. In
particular: no numerals or letters on the band (real buoys are numbered; this one is not), no
lights, no glass, no antennas, solar panels or greeble, and do not disturb whatever scene Max
already has open — save-as into the output directory first and leave his other scenes alone.

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
