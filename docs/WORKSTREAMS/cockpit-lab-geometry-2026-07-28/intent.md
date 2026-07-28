# cockpit-lab-geometry-2026-07-28 — intent

Increment 1 of the HELM cockpit program (lane E). Lab-only; cannot break the game.

## Why we care

Max, this session, verbatim:

> We care because modelling the cockpit and having diagetic screens will increase the immersion
> of the helm mode; this is going to be the default autopilot/screensaver aesthetic. This takes
> the game from "ooo cool a planet" to "woah, this is a real game"

The through-line for scope discipline: **the cockpit is the frame the default experience plays
inside**, not a game-mode extra. That is what makes the geometry worth authoring carefully in a
lab before it goes anywhere near `main.js`.

## Journey context

Serves the **F&F-MVP / SCREENSAVER tier** — `docs/FEATURES.md:60` files the cockpit row as
`F&F-MVP`, and Max's "default autopilot/screensaver aesthetic" puts it squarely in
`PLAYER_EXPERIENCE.md`'s SCREENSAVER tier (viewer, not player; "Max would be proud to leave this
running"). It is *not* gated by the "no new ENRICHED/GAME work until F&F MVP ships" rule in
`NOW.md`, because it is not ENRICHED or GAME tier.

⚠ `docs/JOURNEY.md` is ~2 months stale (last edited 2026-05-19, predates the entire world-engine
program). No milestone percentage is cited here on purpose — citing one would be citing fiction.

## Success criteria (Max's language)

- **"Classic cockpit"** — the frame takes roughly a quarter to a third of the view at the game's
  real 70° FOV. Not a thin sliver, not an enclosed box.
- **"Each screen is mounted at the 4 corners of the cockpit"** — two upper, two lower, each angled
  toward the pilot's eye. (This supersedes the earlier "four screens in a row above the median.")
- **"We shouldn't need a separate dash since we have these 4 screens, but let's model the bottom
  of the cockpit/ship nose down there"** — exterior hull below the median, not an interior console.
- **"Spin the model"** — a browser tab where Max can orbit the cockpit freely *and* drop into the
  pilot's seat at the real FOV to judge the framing.
- The geometry comes from a **committed Blender script**, not hand-modelling — re-runnable,
  diffable, and re-authorable when he wants the proportions changed.

## Decisions working-Claude made (not Max's to adjudicate, recorded for traceability)

- **GLB metric convention: eye-point at the origin, 1 unit = 1 m, Y-up, no scale normalisation.**
  Deliberately *not* the ships pipeline's `mesh.scale.setScalar(1/radius)` — that is a
  ships-manifest convention and is wrong for the one object whose real-world size matters. In-game
  scaling happens at the 5th-pass cockpit camera instead.
- **Cockpit render resolution** (match the world's ⅓-res `pixelScale=3` chunk vs. render crisper)
  is deferred to increment 2, where both can be shown side by side. It is a taste call Max makes by
  eye, not one to bake into geometry by argument.
- **Lab affordances:** free orbit for inspection *plus* an "eye" button that snaps the camera to
  the origin at 70° FOV (`src/ui/Settings.js:40`), so what Max judges is what he would actually see.

## Open questions this increment deliberately does not answer

- **Does the cockpit render during autopilot?** Max said the cockpit is "the default
  autopilot/screensaver aesthetic," but the program's architecture note has it HELM-gated at
  `setScManual()` (`main.js:532-543`). Autopilot uses `CameraChoreographer` cinematic shots that
  orbit and frame bodies from arbitrary positions — you cannot be inside a cockpit *and* be a free
  camera swinging around a planet. **This needs a designed answer before increment 4.** Flagged, not
  resolved here; increment 1 is lab-only so nothing depends on it yet.
- **Which panel shows what.** The program's proposed assignment (nav computer / flight status /
  selected object / system map) predates the corner arrangement. Corners are peripheral vision —
  good for at-a-glance status, bad for detail. Re-check in increment 2 once the panels are legible,
  rather than locking it now.
- **ORRERY has no cockpit, so retiring the DOM overlays leaves it with zero HUD.** That is a real
  consequence of Max's DIEGETIC-ONLY ruling and must become an explicit AC — but in **increment 5**
  (data migration / overlay retirement), where it actually bites. Putting it here would be theatre.

## Out of scope

- Any CRT / phosphor screen shader (increment 2).
- Glass, refraction, or any transmissive material (increment 3).
- Any change to a file under `src/` — this increment is a Blender script, a GLB asset, and a lab
  page. `AC-NOGAME` is the gate.
- Head/hull decoupling, the 5th render pass, HELM gating (increment 4).
- Screen data plumbing (increment 5) and zoom-to-panel (increment 6).
- Sub-object float32 precision / `WorldOrigin` interaction. The 5th-pass architecture makes this
  question vanish by construction (own scene, camera at origin) — it is not deferred debt here.

## Program reference

`~/.claude/projects/-home-ax/memory/well-dipper-cockpit-program.md` — full program state, the two
Max rulings (lane E off master; DIEGETIC-ONLY), the 6-increment ladder, prior art, and the Blender
tooling notes. Deep briefs at `~/briefings/cockpit-program/` (6 files).
