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
- `artifacts`: every file you wrote, ABSOLUTE path + what it is. Never list a file you did not verify
  exists. List absolute WSL paths (`/mnt/c/Users/Max/...`); Blender itself uses `C:\...`, so convert —
  a relative path or a `C:\` path is resolved for you, but the WSL form is what the runner checks against.
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

## 2D jobs (concept images)
Use only the built-in `image_gen` tool — never an API key, the imagegen CLI script, or drawing by code.
Send the brief's prompt verbatim. The tool returns `image_url` (a data URL) and `output_hint` (the saved
path under `~/.codex/generated_images/<thread>/`); take the path from `output_hint`, copy the file
unmodified into this job's `out/` under the name the brief gives, and never paste the data URL into your
reply, the report, or a file. An edit turn passes the previous image's local path in
`referenced_image_paths` and repeats the KEEP list. Tool unavailable or failing → `blocked` with the
exact error; there is no fallback.


---

# 3D asset brief — player ship, COARSE ENVELOPE (well-dipper-trunk)

Reference images attached, in order: (1) concept sheet r10, the authority on shape; (2) r10 with the numbered parts of
the parts map; (3) r10 with every line-enclosed region numbered (`regions-r10.png`); (4) the two bubble-size options
on the front view (`bubble-options-c1.png`). The canon sheet is inlined below.

**How to read this brief.** It tells you WHAT we want and WHY; HOW to model it is your call. The hard contract
is small: the numbers under Scale and axes, the material slot NAMES, the triangle ceiling, the Outputs and the
Acceptance report. Everything else is intent: use your judgement, and where this text and the concept image disagree
about shape or look, the image wins.

**Lineage.** This is step 2 of the panel-by-panel process you helped design on thread
`01a0feb3-b048-7e71-86ab-6c3fae0eda63` (job `20261002-181942-player-ship-cleanup`, your answers in its
`consult-after-r03.md` and in `docs/WORKSTREAMS/player-ship-lab-2026-10-02/parts-map/astra-check-r01.md`). The full
parts map, r02, which applies your four required changes, is pasted at the bottom of this brief. Max approved this
process; his words: "The interior is going to have to be rebuilt anyway. The basic components that were created are
fine. They can be scaled up or down if necessary ... We can change the overall shape of the concept at this early
phase, and it won't be majorly impactful. So yeah, this sounds good to me." Earlier: "I'm open to putting this together
panel by panel ... get the shapes right individually and then put them together." **Scripted road authorised by Max for
this asset** (these quotes): you build the shape yourself in Blender; there is no Hunyuan sculpt in this job, and the old
sculpt and the round 01–03 models are NOT references.

## Subject
The Well Dipper player ship: an 18 m Chris Foss-style hauler the player flies from a hanging glass bubble at the front.
This job is NOT the finished ship. It is a **coarse volume study**: the whole ship as a few big, simple, smooth-enough
masses, one per part in the parts map, built in place against r10's views as blueprints, so Max can approve the
proportions and the reading of the parts before any detail is built. Max judges it on one thing: from the side, the
front and the top, do the big masses follow r10's lines?

## Visible outcome
- Side, front and top orthographic renders of the envelope, each laid over r10's matching view at the registration in
  the parts map, show the outline following r10's outline closely all round: the low blunt head with the bubble hanging
  under it, the long straight climb of the top line to the crest at about 11–14.5 m back, the rounded rear, the
  undercarriage outline.
- The deck shells read as ONE continuous body whose shells overlap and merge (the region evidence in the map),
  sweeping along the climb. **No horizontal stacked discs, no layered shelves.**
- The undercarriage is a few grouped rounded masses tucked against the belly. **Nothing reads as feet or legs.**
- Engines are recessed into the rear; nothing sticks out behind.
- The ¾ render beside r10 reads as the same ship.

## Two variants (the only difference is the bubble and the brow above it)
- **Variant A — "as drawn"**: bubble glass ~3.5 m wide, ~5.1 m with frame, as in r10's front view.
- **Variant B — "contract"**: bubble outer width ≤ 3.0 m (glass ~2.6 m), as in r10's side view and label.
Everything else is identical. Max chooses between them by looking.

## Review loop (mandatory)
Build, then LOOK and fix, at least 3 and at most 6 passes. Each pass: render side, front and top orthographic views of
the envelope with the r10 blueprint registered behind at 50 % opacity (the overlay images below); list every place the
outline departs from r10's outline by more than about half a metre, part by part (head, crest, rear, shoulders, belly,
modules, bubble); fix the GEOMETRY. Also look at r10's interior lines against the part boundaries: the masses must sit
where r10's lines say the parts are. Stop when a pass finds nothing worth fixing. Put the per-pass lists in `report.md`
under "Loop log".

**Honest reporting (your own rule from the consultation):** keep three statements separate in `report.md` —
"technical checks passed", "remaining differences from r10" (always list them; an empty list needs evidence), and never
claim the look is approved; only Max approves.

## Scale and axes
- Units: metres. Overall envelope ~18.0 L × ~11.0 H × ~10.4 W (from the map's registration: side view sets length =
  18 m; each view keeps its own uniform scale; never stretch one axis). Anchors: a seated 1.8 m pilot; the game's fighters
  are 6 m long.
- Registration of the blueprints (`blueprints\r10-<view>.png`, crops of the sheet; pixels per metre AT THE CROP'S OWN
  PIXEL SIZE): side 29.4 px/m, ship spans crop x 10–539, ground at crop y 336; front and rear 27.0 px/m; top 26.3 px/m.
  Centre the front, rear and top on the ship's centreline. If a landmark makes another alignment clearly better, use it
  and record what you changed in `decisions`.
- Origin: the ship's centre of mass, on the world origin. Forward = the bubble end along Blender **+Y**; up = +Z.
- Name the bubble object `Bubble_MAIN` (forward of the origin). One object per part, named by the map's numbers:
  `P01_Spine_Front`, `P02_Spine_Rear`, `P03_Deck_Upper`, `P04_Flank`, `P05_Head`, `P06a_Aft_Shoulder`,
  `P06b_Engine_Surround`, `P07_Side_Bulges`, `Bubble_MAIN`, `P09_Modules_<group>`, `P10_Belly_Pod`, `P12_Engine_Carrier`.
  Skip hatch (11) and thrusters (13) in this job.

## Budgets
- Triangles ≤ 1,500 per variant — a ceiling for a volume study, not a target. Enough to read curves; no detail.
- Flat-shaded, matte. Materials: the slots below only.

## Materials
Exactly these Principled BSDF slots, metallic 0, roughness 1, linear RGB:
- `glass` — pale blue (0.55, 0.75, 0.90), alpha 0.15, alpha-blend.
- `cockpit_frame` — cream (0.88, 0.855, 0.78).
- `spine` — orange (1.0, 0.5, 0.1).
- `decks` — yellow (1.0, 0.78, 0.05).
- `underslung` — teal (0.0, 0.42, 0.45).
- `engine_block` — mid grey (0.35, 0.35, 0.36).
- `nozzles` — near-black (0.02, 0.02, 0.025).

## Outputs
Blender output directory (Windows): `C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\envelope\`
(WSL: `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/`). The blueprints are already
there in `blueprints\`. Do not touch anything in the parent `player-ship\` folder.
Always write these exact names; earlier rounds are archived by the runner, so overwriting loses nothing.
In `artifacts`, list absolute WSL paths (`/mnt/c/Users/Max/...`); Blender itself uses `C:\...`.
For each variant V in {A, B}:
1. `envelope-V.glb` — selected objects only, +Y up, modifiers applied, no cameras/lights, no blueprint planes.
2. `envelope-V-34.png`, `-side.png`, `-front.png`, `-top.png` — 960×540, background (0.04, 0.04, 0.07); ¾ = 20°
   elevation / 125° azimuth, 55 mm, rendered from the RE-IMPORTED GLB; side, front, top orthographic.
3. `envelope-V-overlay-side.png`, `-overlay-front.png`, `-overlay-top.png` — the same orthographic views with the
   registered r10 view behind at 50 % opacity, 1600 px wide.
Plus one `envelope.blend` holding both variants in separate collections and the blueprint planes.

Blender calls stay SHORT (under 5 minutes each); the bridge hangs Blender after a 600 s call.

## Acceptance
Report per variant: object list, triangle count, material count, bounding box (m), the `Bubble_MAIN` glTF z-range,
the re-import check; the Loop log; "remaining differences from r10" per part; every file with its absolute path.

## References and precedence
1. Max's words (highest). 2. SHAPE and LOOK: r10, read through the parts map. 3. INTERFACE: this brief's numbers.
If two disagree, follow the higher one and say so in `decisions`.

## Do not
Use the Hunyuan sculpt or rounds 01–03 as a shape source; build stacked horizontal discs; put stalks under the modules;
modify or delete anything you did not create; write outside the job dir and the envelope directory; add text, decals or
glow; paint textures; smooth-shade.

---
## Parts map r02 (verbatim)
# Player ship — parts map (r02, 2026-10-02)

Authority: concept sheet r10 (`.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png`).
Pictures: `parts-map-r10.png` (numbered parts; `python3 draw_markers.py`), `regions-r10.png` (every area enclosed by
the sheet's black lines, numbered; `python3 regions.py` → `regions.json`), `bubble-options-c1.png`.
Purpose: step 1 of the panel-by-panel build Max approved 2026-10-02 (quotes in
`.astra/jobs/20261002-181942-player-ship-cleanup/UAT.md`).
History: r01 drafted by CC → checked by Astra (`astra-check-r01.md`) → r02 applies its four required changes
(spine markers swapped; parts tied to traced regions; landmark table; cabin proportion carried as two variants) and
records the rear construction and the disputed flank line as open alternatives.

## Status of this map
This is a **provisional** reading. It is good enough to build a coarse whole-ship envelope (step 2), and that envelope
is where Max judges it. Exact module count, hatch details and thruster placement are settled later, at the part-group
reviews (step 3), not here.

## Registration (candidate, not final)

Each view gets its own uniform scale; no axis is stretched to force agreement. Drawn ship length (not the dimension
bar) is set to 18 m — a choice, recorded as such.

| view | crop on the sheet (px) | scale | owns |
|---|---|---|---|
| Side | x 105–700, y 60–400; ship spans x 115–644, ground y 396 | 529 px = 18 m → 29.4 px/m | length, top-line climb, head height, rear curve, undercarriage depth |
| Front | x 745–1060, y 85–400 | ×1.09 so its height equals the side's → 27.0 px/m on the sheet | cross-section: arches, shoulders, head bar, bubble |
| Rear | x 1065–1365, y 85–400 | same as front | engine block size and placement |
| Top | x 1390–1890, y 110–400 | ×1.12 so its length equals the side's → 26.3 px/m on the sheet | plan shape: snout, mid-ship bulges, rear rounding |

Landmarks (metres; length measured from the bubble's front, height from the lowest module):

| landmark | value | from |
|---|---|---|
| Crest (top of rear spine crown) | 10.9 m high, 11.8–14.5 m back | side region 1 |
| Spine starts | 5.3 m back (side) / 3.4 m back (top) | side 2, top 70 — **mismatch 1.9 m, open** |
| Spine ends | 16.0 m back | top 69 |
| Yellow body underside at the head | 2.7 m high | side 3 |
| Bubble (side) | 0–3.4 m back, 0.5–2.6 m high | side 15/16 |
| Bubble glass width (front) | 3.5 m; with frame 5.1 m | front 29/40 |
| Module tops / lowest point | 4.1 m / 0 m | side 4, 19 |
| Mid-ship side bulges | 8.4–12.7 m back | top 62, 76 |
| Engine carrier width (rear) | ~6.7 m incl. surround | rear 45 |
| Overall envelope | 18.0 L × ~11.0 H × ~10.4 W (front 10.25, top 10.59) | — |

Front and top widths agree within 4 %; that is agreement on overall width only, not on proportion everywhere (the
bubble disagrees, C1; the spine start disagrees, above).

## What the traced regions show (new evidence)
In the **side and top views the deck lines are open strokes**: the whole yellow body is one connected area, even with
every line widened by 2 px (side: one 34–40 k px region plus the rear lobe; top: one 41–51 k px region). The lines end
inside the body instead of enclosing separate plates. In the **front view the same lines close into arches**
(nine yellow regions). Reading: the decks are one continuous body whose shells overlap and then merge back into it,
like overlapping lens forms fading into each other, **not separate plates stacked on each other**. This is the
evidence against round 03's stacked pancakes.

## Parts

Line labels: **E** outer edge · **O** overlap · **S** seam between flush surfaces · **C** curvature only ·
**?** unresolved. Region numbers refer to `regions-r10.png`.

| # | part (slot) | 3D reading | regions | lines |
|---|---|---|---|---|
| 1 | Spine, front segment (orange) | Raised rounded ridge on the centreline, low at the head, climbing back; blunt rounded front end (top view). | side 2 (front part), front 24, top 70 | E on the silhouette; orange/yellow boundary elsewhere = **? (C8)** |
| 2 | Spine, rear segment (orange) | The same ridge, larger and higher, ending before the rear; carries a small **crown** at its summit (part of #2, not a separate object). | side 1–2, front 20–21, top 69 | joint with #1 = candidate O, **?** |
| 3 | Upper deck shell (yellow) | Rounded shell over the rear two-thirds, either side of the spine, like a beetle's wing case; its edges overlap the flank and fade into it. Extent provisional. | side 3 (upper), front 26/27, top 65 (inner U) | lower edge = O fading out (open stroke) |
| 4 | Flank / main body (yellow) | The ship's main volume from head to rear; bottom broadly level with curves near head and rear. Outer shoulder arch in the front view. | side 3 (lower), front 22/23/25 | the long line through it in the side view = **? seam vs shallow overlap (C4)** |
| 5 | Head / brow (yellow) | Low rounded brow above the bubble, ~60 % of the ship's width, two large forward ports. The narrow lip directly above the glass = **? part of the brow or a lower collar**. | front 28, side 3 (front tip), top 65 (front) | E |
| 6a | Aft shoulder (yellow) | Rounded volume at the back, the highest rounded mass at the rear. | side (rear lobe), top 65 (rear) | relation to the shells' ends **? (C6)** |
| 6b | Engine surround (yellow) | Frame around the engine carrier; may share an object with 6a. | rear 43/44/46 | **? (C6)** |
| 7 | Mid-ship side bulges (yellow) | Paired rounded volumes, mostly buried in the flank, emerging only at the widest point. Hidden in side/front by occlusion, not absent. | top 62, 76 | E where visible; emergence boundary kept |
| 8 | Bubble + frame (bubble, cockpit frame) | Rounded-cube glazing under the brow. Two near-vertical cream members cross the front glass and continue over the cabin roof (top 71/72 are split by them), plus a perimeter frame. Size: **C1**. | side 15/16, front 29/40, top 71/72 | E |
| 9 | Underslung modules (teal) | Rounded boxes of mixed height AND depth, closely attached to the belly with their roots hidden in or intersecting it. **No stalks or legs.** Built first as a few grouped masses matching the combined outline; count settled at the group review. | side 4–14, front 30–39, rear 51–61, top 63–67/73–75 | E |
| 10 | Belly pod (teal) | Stepped lower assembly: an attachment mass and a rounded lower pod with a downward thruster. No stalk. | side 17–19 | E |
| 11a / 11b | Side hatch / aft panel (red) | Red panel on a module in the side view (11a) and at the bottom of the rear view (11b). One assembly or two: **C5**, settled later. | side 12, rear 58 | E |
| 12 | Engine carrier + 4 nozzles (engine block, nozzles) | Rounded-rectangle carrier with four round sockets in a 2×2 grid. Everything goes **inward**: the carrier perimeter is an opening, the circles are socket mouths, the inner circles are recessed interiors. | rear 45/47–50/53, top 68 | opening edges, inward |
| 13 | Manoeuvring thrusters (pink) | Small round ports. Each port gets a location and facing direction at the part-group stage (C7). | all | E |

## Conflicts

| # | conflict | handling |
|---|---|---|
| C1 | **Bubble size.** Front view: glass 3.5 m wide, 5.1 m with frame; side view: 3.4 m long, 2.1 m tall glass. Contract: 1.8–3.0 m outer width, from Max's "helicopter-cabin scale". | **Max decides, by looking at two whole-ship envelopes** (A: as drawn in the front view; B: within the contract), not from cabin sizes alone. A needs a contract change. |
| C2 | Absolute scale between views | Registration above; candidate. |
| C3 | Side bulges | #7 as buried paired volumes; whether they merge into the flank is judged on the envelope. |
| C4 | Long line through the flank (side view) | Open: seam vs shallow overlap. The region evidence (open stroke) favours a shallow overlap fading out. Not a third plate. |
| C5 | Side hatch vs aft panel | Deferred to the undercarriage group. |
| C6 | Aft shoulder vs engine surround vs shell ends | Envelope carries 6a/6b as separate masses; overlap direction judged on the envelope. |
| C7 | Thruster positions across views | Deferred to the part groups. |
| C8 | Orange/yellow boundaries: raised, flush, or colour only | The spine is raised on the silhouette; elsewhere decided at the hull-shells group. |
| C9 | Spine start: 5.3 m back (side) vs 3.4 m (top) | Envelope uses the side view (it owns length); flagged on the review. |

## Not decided here
Exact curves, the triangle split, the cockpit interior layout (Max directs the interior separately; its components
can be rescaled and moved).


---
## Canon sheet
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

