# Lab UI rider — "Isolate plate relief" control (AC8-UAT viewing)

**Date:** 2026-06-27 · **File:** `planet-lod-lab.html` (lab only — charter: lab≠game) ·
**Rider on:** the plate/uplift increment (`e07da8c`, this workstream). NOT a new contract —
single-system lab tooling, no `dev-collab-scope` pass (per handoff 2026-06-27).

## What it does (plain language)
Adds a left-panel lil-gui folder **"Plate relief (UAT)"** with two controls, plus a desync fix
to the existing "baked relief" slider. The point: give Max a **one-click honest AC8 view** of the
plate-uplift field, replacing a console snippet.

- **"Isolate plate relief (AC8 view)"** checkbox:
  - **ON** → snapshots the current feature-enable set + relief strength, then disables three
    buckets so the plate field authors 100% of the relief:
    - **CLASH** (legacy in-shader orogeny that bumps terrain on its *own* seeds, competing with
      plate boundaries): mountains, canyons, scarps, tessera, plateaus, edifices, craters, ejecta.
    - **OBSCURE** (surface cover that hides relief): dust, dunes, lava, chaos, cryoRidge, frost,
      sublimation(`subEnabled`), glacial, karst, massWast.
    - **CLUTTER** (atmosphere/fx): clouds, weatherBands, bands, jets, dustStorm, greatSpot,
      stormTrain, polarVortex, lightning, aurora, airglow, sunglint, terminator, facets, magma, carbon.
    - …KEEPS drainage context ON (rivers, lakes, deltas, coast, outflow), forces baked relief = 1,
      and calls `setRiverOverlay(true)` to re-route — which re-bakes the plate carrier so
      `plateProbe().heightSource == 'carrier'`.
  - **OFF** → restores the **exact** pre-isolate enable set + relief from the snapshot.
- **"Relief A/B: plates ↔ flat ocean"** button: flips `uReliefBakeStrength` 1↔0 (display kept in
  sync). Use while isolated (or after any route at relief>0) so the carrier is already baked.
- **Desync fix:** a single `applyReliefBake(v)` helper sets the uniform **and** `grainCarveUI.reliefBakeStrength`
  **and** the captured slider controller's `updateDisplay()`. `_lab.reliefBakeStrength(s)` now routes
  through it, so the old bug (uniform=1 while the slider showed a stale 0) is gone for all callers.

## Intent
Unblock Max's AC8 UAT: "does an Earth-like body read as a coherent WORLD authored by plates?"
The only honest read is **stripped features + relief=1 + routed**; this control produces that in one
click and lets Max A/B plate-relief against flat ocean to confirm the plates are doing the authoring.

## Why these mechanisms (corrections to the handoff's stated plan)
The handoff assumed `setPreset(current)` re-applies `*Enabled` and that a `rebuild()/route()` call
is needed. Neither is true in the actual code:
- No `setPreset`/`applyDrivers` path touches the `*Enabled` booleans → OFF uses a **snapshot/restore**
  (mirrors the existing solo `captureEnables`/`_preSoloEnables` idiom). This restores exactly what the
  operator had, which is more faithful than a preset baseline anyway.
- Feature toggles take effect via the **per-frame uniform writer** reading `state.*Enabled` live → no
  terrain rebuild call exists or is needed; only **rivers** needs the `setRiverOverlay` side-effect.
- Verified key-name fixes: `subEnabled` (not `sublimationEnabled`), `coastEnabled`, `massWastEnabled`.

## Deliberate non-goals (what this does NOT do)
- Does **not** touch the generator (`src/worldengine/**`) or the game (`src/objects/**`,
  `MaterialBodyShader.js`). Lab tooling only.
- Does **not** change any production uniform default (prod `uReliefBakeStrength` stays 0; the lab's
  live 1.0 is unchanged). AC2 byte-identical captures preserved (the uniform value `applyReliefBake`
  writes is identical to the old path; only GUI-display side-effects added).
- Does **not** re-seat legacy orogeny to nest into plate boundaries — that's the **named deferred
  follow-on** (2+ system generative change; needs its own scope pass + brainstorm), to do ONLY if
  Max's UAT finds the isolated plate ranges too smooth standalone.
- Snapshot semantics: manual feature toggles made *while isolated* are discarded on OFF (restores the
  pre-isolate snapshot), by design — same as the solo mechanism. Toggling Isolate ON also collapses any
  in-flight solo first (guard added so the snapshot captures the operator's real pre-solo enables).

## Verification (2026-06-27)
- **Multi-lens adversarial audit** (correctness / scope-regression / closure-lil-gui, each finding
  refuted-by-default): 3 raised, 1 confirmed (minor: solo→isolate→unsolo snapshot corruption — **fixed**
  with a `if (_preSoloEnables) unsolo()` guard at ON-entry), 2 refuted. Closure/TDZ/hoisting + lil-gui
  API + AC2 preservation all verified clean.
- **Live drive on :9223** (subagent, real GUI clicks): PASS. After clicking Isolate ON,
  `plateProbe().heightSource=='carrier'`, `varExplainedByBoundaryDist 0.394` vs `varExplainedByLatitude
  0.018` (~22×), riverStats `{orphanPct:0, uphillPct:0, nanCount:0, channelCount:5153, maxStrahler:6}`.
  Desync slider tracked 0→1; A/B flipped; OFF restored baseline; no exceptions from the new code.
  Screenshots: `scratchpad/verify-{1-baseline,2-isolated,3-flat,4-plates,5-restored}.png`.
- **Still Max's gate:** AC8 UAT (the visual "is this a coherent world" judgment) — this control exists
  to make that judgment cleanly. Zoom in; the body renders small at distance-20.
