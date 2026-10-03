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

# 2D concept-image brief — player ship, REAR DETAIL sheet (well-dipper-trunk)

Reference images attached, in order: (1) `player-ship-ext-sheet.png` — accepted concept sheet r10, the DESIGN AUTHORITY
for every part, colour, style and the rear's look; (2) `lines-r10.png` — r10 with its ten named feature lines (L1–L10)
drawn in colour, so you can see which drawn lines the 3D model must reproduce. Use Image 2 only to understand the
lines; draw in Image 1's style. The canon sheet is inlined below; where it disagrees with Image 1, Image 1 wins.

Lineage: step 2 of the line-driven rebuild Max approved 2026-10-03 ("yes") after your consultation on job
`20261002-234634-player-ship-envelope` (your answer: `consult-after-B-r02.md` there). Fresh thread for a 2D job.

## Subject
The rear third of the Well Dipper player ship (18 m, Chris Foss style, flat part-colour map), drawn LARGER than on r10
and with its CONSTRUCTION made explicit, so a 3D modeller knows which surfaces meet, which overlap, and where they end.
Max on the current 3D rear, verbatim: "the rear of the craft looks like a bunch of shapes stuck on top of each other
rather than several shapes meeting in a shared plane." He also asked: "The lip above the rear exhaust should be a lot
more rounded in shape and shouldn't end in a sharp angle. It should be just kind of a lip that extends out over the rear
engines." And: "The thrusters on the body should all be the same octagonal shape." This sheet answers those questions
in drawing form. It must stay the same ship as r10 — same parts, same colours, same look — only larger and clearer.

## Visible outcome
Check each on the actual image before you report; if a check fails, make ONE edit turn ("Change only X." followed by the
whole KEEP slot, with `referenced_image_paths` set to the previous image's local path) and re-check. The image tool
writes exact labels and draws inexact proportions; spend the edit turn on labels and arrangement, never on proportions.
If a check still fails after the edit turn, report `complete` with that check marked FAIL — the reviewer decides.

1. Four views of the REAR THIRD of the ship, each named underneath: REAR VIEW, SIDE VIEW (REAR), TOP VIEW (REAR),
   SECTION A-A. The side and top views show only the rear third, cut off cleanly at the front with a straight break line.
2. Part callouts on the views: AFT SHOULDER, UPPER SHELL, FLANK, SPINE, LIP, ENGINE SURROUND, ENGINE BLOCK, NOZZLE,
   THRUSTER, UNDERSLUNG MODULE.
3. A dashed line labelled "SHARED REAR PLANE" in the side and top views, where the shells, shoulder and engine surround
   all end together.
4. SECTION A-A: a cut along the ship's centreline through the rear third, showing the LIP as a rounded overhang above the
   ENGINE BLOCK, the engine block sitting INSIDE the engine surround, and the nozzle sockets as shallow recesses.
5. Every manoeuvring thruster is the same small OCTAGONAL recessed port. None on the underslung modules.
6. Same flat part colours, dark outlines and style as Image 1; plain off-white background; a small legend.

## Image prompt
The prompt below goes to the built-in image tool VERBATIM as its `prompt` — do not paraphrase, shorten, reorder or add
creative detail.

```
JOB: a construction detail sheet for the rear third of an approved spaceship design (Image 1), so a 3D modeller can see exactly which surfaces meet, which overlap, and where they end. Late-1990s low-poly game target: big simple forms, nothing smaller than 30 cm.

SUBJECT: the rear third of the ship in Image 1 — the same ship, same parts, same colours — drawn about three times larger than on Image 1, with its construction made clear: the yellow UPPER SHELL and the yellow FLANK sweep back and end against the rounded yellow AFT SHOULDER; the orange SPINE runs back along the top centre and ends before the rear; the yellow ENGINE SURROUND is a thick rounded frame around a recessed grey ENGINE BLOCK with four round near-black NOZZLE sockets; a rounded yellow LIP extends out over the top of the engine block like a soft brim, with a smooth rounded edge, no sharp corner. All of these end together on one flat SHARED REAR PLANE — they meet cleanly, not stacked on top of each other.

VIEWS: four flat orthographic views at the same scale, each named underneath: REAR VIEW; SIDE VIEW (REAR) showing only the rear third, cut off at the front with a straight break line; TOP VIEW (REAR) showing only the rear third, cut off the same way; SECTION A-A, a cut straight down the ship's centreline through the rear third, seen from the side, with the cut surfaces filled in their part colours. A small line labelled A-A on the top view shows where the cut is.

CONSTRUCTION: rounded hull shells whose edges overlap the next shell like a beetle's wing case; the aft shoulder is one big rounded mass; the engine block sits inside the engine surround, its face set back about 30 cm; each nozzle is a shallow round socket set back about 30 cm; small magenta recessed manoeuvring THRUSTER ports, every one the same small octagon, on the shoulder and the hull sides, none on the teal underslung modules. Teal UNDERSLUNG MODULES hang close under the belly in two rows, one on each side, with an empty gap down the centre. A dashed line labelled SHARED REAR PLANE marks where the shells, shoulder, lip and engine surround end together, in the side and top views.

PROPORTIONS & SCALE: proportions exactly as the rear of Image 1. A plain black 1.8 metre human figure beside the side view, labelled "1.8 m". Part callouts: AFT SHOULDER, UPPER SHELL, FLANK, SPINE, LIP, ENGINE SURROUND, ENGINE BLOCK, NOZZLE, THRUSTER, UNDERSLUNG MODULE.

STYLE: clean game concept art exactly like Image 1: flat colour fills with strong dark outlines, no shading, plain off-white background, even light, no cast shadows, no scene. Colour = part map as Image 1's legend: SPINE orange, DECKS yellow, UNDERSLUNG MODULES teal, ENGINE BLOCK mid grey, NOZZLES near-black, MANOEUVRING THRUSTERS magenta, HATCH red; a small legend box with these entries. No numbers other than the 1.8 m label, no insignia, flames or exhaust.

SELF-CHECK: in the side view, a reader can trace each surface back to the dashed SHARED REAR PLANE and see that they end there together.

KEEP: the same ship as Image 1 — parts, part colours, rounded forms, the four-nozzle engine block recessed inside the hull, the style and line weight; the four views and their names; the callouts and the dashed SHARED REAR PLANE; plain off-white background. Add nothing not listed above.
```

Extraction note: the 3D step reads which surface overlaps which, where each ends, the lip's rounded overhang and the
recess depths from SECTION A-A; proportions still come from r10's registration, not from this sheet.

## Canvas and views
- Canvas: landscape, about 1536 × 1024; the tool chooses the exact size — report what it made.
- Views and scale reference as the prompt says.
- Background plain off-white; labels are the only text.

## Outputs
Write into this job directory only. Always these exact names; earlier rounds are archived by the runner,
so overwriting loses nothing.
1. `out/player-ship-rear-detail-sheet.png` — the selected image, copied UNMODIFIED from the path the tool reports.
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
1. Max's words (highest). 2. Image 1 (r10). 3. The image prompt's KEEP slot. 4. The canon sheet.
If two disagree, follow the higher one and say so in `decisions`.

## Do not
Paraphrase the prompt; modify the generated image with code; reproduce the data URL; modify or delete anything you did not create; write outside the job dir; use any image tool other than the built-in one; draw the whole ship (rear third only); add scene, shading or text beyond the labels and legend.

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

