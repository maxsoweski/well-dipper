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

# 2D concept-image brief — player ship, exterior, v2 (well-dipper-trunk)

Reference images attached, in order: (1) `foss-1-21st-century-foss-cover.jpg` — Chris Foss's cover painting
of a fat, rounded liner wrapped in bold stripes. It controls the SHAPE LANGUAGE and the WAY THE STRIPES WRAP
the hull, NOT the size: that ship reads as enormous, ours is the size of a house. Ignore its numerals, its
exhaust cloud and its fine panel detail. (2) `fighters_v7_close1.png` — Well Dipper's own fighters: they
control the COLOURS (orange, deep blue, cream) and the flat-shaded, low-poly family look. The canon sheet is
inlined below.

## Subject
Round 2 (a redo): round 1 came back as a smooth, toy-like submarine pod drawn at half the labelled size; Max
asked for a redo. The player's own ship in Well Dipper, a retro space-exploration game: a compact, hand-built
ship about the size of a house (18 m long), in the style of Chris Foss's 1970s paperback-cover spaceships — a
heavy, industrial hull built up from stacked layers (a raised spine, decks stepping down toward the nose, blocky
hardware slung underneath), wrapped in bold stripes. Its ONE distinguishing feature is a big glass bubble cockpit
at the nose, like a helicopter's, with the glass wrapping down below the pilot's feet. The player flies
from inside that bubble and also sees the whole ship from outside, so the bubble must read clearly from
outside too. A stranger must recognise it at a glance as "a chunky little Foss-style ship with a bubble
cockpit".

## Visible outcome
The generated sheet must show ALL of the following. Check each on the actual image before you report;
if a check fails, make ONE edit turn ("Change only X." followed by the whole KEEP slot, with
`referenced_image_paths` set to the previous image's local path) and re-check; report what the second
image shows. "Unchanged" means unchanged to the eye: a few pixels' drift in an edit is not a failure;
proportions, layout and labels are what must hold. A sheet is judged by its labels; the drawing is a
reference, not a measurement — write the numbers on it exactly as the prompt gives them. If a check
still fails after the edit turn, report `complete` with that check marked FAIL and what you saw — the
reviewer decides; `blocked` is only for a tool that cannot make an image at all.

**Spend the edit turn on the labels and the arrangement, never on the drawing's proportions.** The image
tool writes exact labels and draws inexact pictures; a correction round does not fix the drawing.

1. Side, front and top views of the same ship, flat and orthographic, on one shared baseline, plus one
   small three-quarter view in a corner.
2. A plain black 1.8 m human figure standing beside the side view.
3. Labels: "LENGTH 18 m" on the side view, and "BUBBLE 2.6 m" across the cockpit bubble on the front view.
   Parts named: BUBBLE, SPINE, DECKS, ENGINES, HATCH.
4. The hull is built from visibly stacked layers: a raised spine along the top, decks stepping down toward the
   nose, blocky hardware underneath. It does NOT read as one smooth bean, pod or toy submarine.
5. The ship is drawn about ten times as long as the human figure is tall.
6. A glass bubble cockpit at the nose that wraps down below the cockpit floor line, divided by two thick
   frame pillars; it is visibly about the height of the human figure plus a little.
7. Bold stripes or bands that wrap around the hull in orange, deep blue and cream.
8. The side view repeated as a small solid black silhouette in a corner.
9. No numerals, insignia, exhaust plumes or flames, scene, cast shadows or text other than the labels.

## Image prompt
The prompt below goes to the built-in image tool VERBATIM as its `prompt` — do not paraphrase, shorten,
reorder or add creative detail; it was written against the engine's profile and every slot is deliberate.

```
JOB: video-game spaceship concept sheet, so a 3D artist can model the player's ship. The game is a late-1990s style low-poly game (PlayStation-1 era, 240 lines of resolution): only a bold silhouette, a few big flat colour blocks and big shapes survive, so design with large, simple, chunky forms. Nothing smaller than 30 cm.

SUBJECT: the player's own small spaceship, about the size of a house, in the style of Chris Foss's 1970s science-fiction paperback covers (Image 1): a heavy, industrial working ship, not a toy, not a pod, not a submarine. The hull is built up from stacked layers like Image 1: a raised spine running along the top, decks stepping down toward the nose, and chunky blocky hardware slung underneath (engine housings, intakes, a cargo box), a little asymmetric. Rounded where Image 1 is rounded (the nose and the deck edges), blocky and angular elsewhere. Bold stripes and bands wrap around the layers. At the nose sits a big glass bubble cockpit like a helicopter's, the glass wrapping down below the pilot's feet, divided by two thick frame pillars. Engines are a cluster of large round nozzles at the back, dark inside, with no flame or exhaust. One boarding hatch on the side. Image 1 is a much bigger ship: keep its shape language and the way its stripes wrap the hull, but this ship is small, so it has few, large features, not many small ones.

VIEWS: a side view, a front view and a top view, flat and orthographic (no perspective), same scale, on one shared baseline, plus one small three-quarter view in a corner for recognition only.

CONSTRUCTION: a handful of large simple solids stacked and joined, each visibly distinct: the spine, the deck layers, the underslung hardware, the glass bubble, the engine cluster, the hatch. Flat faceted surfaces, hard edges, no smooth gloss. No panel lines, rivets, rows of tiny windows, aerials, grime or fine trim. Nothing smaller than 30 cm.

PROPORTIONS & SCALE: overall length 18 metres. The bubble cockpit is 2.6 metres wide. A plain black 1.8 metre human figure stands beside the side view, and the ship is about ten times as long as that figure is tall: the figure is small next to the ship. Write these labels exactly: "LENGTH 18 m" along the side view, "BUBBLE 2.6 m" across the bubble on the front view. Name the parts: BUBBLE, SPINE, DECKS, ENGINES, HATCH.

STYLE: clean game concept art, flat colour fills with a strong dark outline, no shading, plain off-white background, soft even light, no cast shadows, no scene, no stars, no text except the labels. Colours as in Image 2: bright orange (main hull), deep navy blue (stripes), cream off-white (bands), pale blue-grey tinted glass, dark grey engine nozzles. No numbers, letters or insignia painted on the ship.

SELF-CHECK: in one corner, the side view repeated as a small solid black silhouette.

KEEP: side, front and top views, orthographic, same scale, one baseline, small three-quarter view; the 1.8 m human figure; the labels "LENGTH 18 m" and "BUBBLE 2.6 m" and the part names BUBBLE, SPINE, DECKS, ENGINES, HATCH; the heavy layered Foss-style hull (raised spine, stepped decks, underslung hardware) with wrap-around stripes; the ship about ten figure-heights long; the helicopter-style glass bubble at the nose with two thick pillars; the orange, navy and cream colours; flat fills with dark outlines; the small black silhouette; no numbers, insignia, flames or exhaust. Add nothing not listed above.
```

Extraction note: read LENGTH and BUBBLE from the labels; the side view gives hull height and where the
bubble sits relative to the hull; the top view gives the hull's width and plan; check the tenth-size
silhouette names as "heavy Foss-style ship with a bubble nose". If an edit turn is needed, it must keep the small
black silhouette (round 1's edit dropped it).

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
