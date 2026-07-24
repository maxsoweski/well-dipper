# BUILD-NOTES — Radius display-scale (`sVis`)

**Workstream:** `world-engine-radius-display-scale-2026-07-24`
**Built:** 2026-07-24 (builder subagent, per BUILD-PLAN.md, post-lens)
**Branch:** `feature/world-engine-production-L1` — NOT committed (working-Claude commits at the seam).

---

## What this does (plain language — `record-build-intent`)

The lab used to render every world — Moon-class 0.3 R⊕ through Sub-Neptune 16 R⊕ — at
the **same on-screen size** (`R = 1.0` unit sphere, fixed camera in unit-radii). This adds
a **display-only visual scale** so a bigger-radius world genuinely reads bigger on screen:
move the radius slider right → the planet disc grows.

- **Mapping:** `sVis = visScaleOf(planetRadiusEarth) = planetRadiusEarth ^ 0.5` (sqrt),
  normalized so `sVis(1 R⊕) = 1` exactly. `0.3 → 0.5477`, `16 → 4.0`. sqrt (not linear)
  keeps the 53× span usable inside the fixed camera; a linear 16 R⊕ sphere would engulf
  the default 20-unit view. `VIS_SCALE_EXP` is the **one** UAT-tunable knob.
- **Mechanism:** `planet.scale.setScalar(sVis)` each frame; the camera distance stays
  **absolute** (`state.distance * R`), which is what makes the disc actually grow (scaling
  the camera in planet-radii would exactly cancel the effect).
- **LOD honesty:** `lodRampOf` / `lodHysteresis` re-key on `logicalDist = state.distance /
  sVis` so surface detail tracks *apparent* size; `autoOctaves` follows transitively via
  `lod`. At `sVis = 1` this reduces to `state.distance` **exactly** — bit-identical to
  pre-increment behaviour at radius 1.
- **Zoom clamp:** the camera-min-distance floor scales with the disc
  (`minCameraDistance(sVis) = sVis · 1.1`) via the wheel handler and an authoritative
  per-frame guard, so the camera can never enter the scaled sphere. `minCameraDistance(1)
  = 1.1` = the original surface-skim floor.
- **Attached geometry:** province overlay + river/tributary ribbons are **children of
  `planet`**, so they inherit `sVis` for free (no code change — AC-OVERLAY satisfied by the
  scene graph). Scene-space shells (haze, ring impostor, ring particle cloud) are NOT
  planet children, so they get an explicit per-frame `setScalar(sVis)`. The ring cloud's
  internal camera-space distance-LOD (`uDResolve`/`uDCull`) is also scaled by `sVis` so it
  resolves/culls at the right *apparent* size (lens-01; identity at `sVis = 1`).

### Deliberate non-goals (what this does NOT do)

- **No mesh-floor / mesh-resolution change** — the base sphere stays `R = 1.0`; only its
  transform scales. Max accepted this at the inc3b UAT ("It's fine that the base mesh
  doesn't change size").
- **Craters scale WITH the disc** — angular crater sizes are mesh-floor R-invariant
  (inc3b finding). On a bigger disc, craters render bigger *with it*; the physical read
  "bigger world → relatively smaller craters" is NOT delivered here. Carried into the UAT
  recipe verbatim.
- **No procgen / physics / `planetRadiusEarth` semantic change** — `sVis` is a pure display
  term (see AC-0 chain + fence below).
- **No game-side `Planet.js` port** — lab-only per the LOD charter.
- **Rings/haze scale for concentricity only** — they only render on ringed/hazy presets;
  identity at `sVis = 1` for every other preset.

---

## AC-0 — named consumer chain (spine conformance, Rule 15)

The display scale reads **exactly one input** — `state.planetRadiusEarth` — with no
label / archetype / regime / `rendersOn` read, and introduces **no new `*Enabled` key**.

```
state.planetRadiusEarth
   └─ visScaleOf(planetRadiusEarth)        [planet-lod-lab-core.js — pure export, DISPLAY-ONLY]
        └─ sVis                            [planet-lod-lab.html frame loop, module-scope let]
             ├─ planet.scale.setScalar(sVis)                      (the disc grows)
             ├─ hazeShell / ring / ringCloud .scale.setScalar(sVis)   (scene-space shells track)
             │     └─ ringCloud uDResolve/uDCull = state.ring* · sVis  (near-tier LOD tracks apparent size)
             ├─ logicalDist = state.distance / sVis
             │     ├─ lodRampOf(logicalDist)  → lod → autoOctaves(lod)   (LOD detail + octave budget)
             │     └─ lodHysteresis(logicalDist, …)                       (LOD2-active flag)
             └─ minCameraDistance(sVis)
                   ├─ wheel clamp (Math.max floor)                        (zoom can't enter the sphere)
                   └─ per-frame guard (raise-only, idempotent)
```

Single input; display-only; taxonomy/drift guards stay green (existing `worldengine-*`
suites pass unchanged — see gates below). Live probe surface: `window._lab.visScaleOf` +
`window._lab.sVis` getter (additive) for the AC-SCALE-LIVE / AC-CLAMP live drives.

---

## AC-STAGE-DOC — read-gate / UAT staging consequence (REQUIRED)

**Disc size is now radius-dependent.** Before this increment, the same camera-wheel
position always produced the same on-screen disc, so read-gate and UAT recipes could crop
the planet at a fixed **disc-crop fraction** (the inc3b **S4 "~70% disc"** convention) and
compare across presets freely. That is no longer safe: **the same wheel position now
yields a different disc diameter at different radii** (a 16 R⊕ world is `sVis = 4×` the
apparent size of a 1 R⊕ world at the same `state.distance`).

**Any future read-gate / UAT recipe that captures the planet at a fixed disc-crop fraction
must now pin EITHER the radius OR the disc fraction explicitly** — otherwise a capture
"at ~70% disc" is ambiguous about which radius it was taken at. The affected harness
pattern is the **disc-crop capture** (external chrome-devtools `readPixels` disc-diameter
measurement; there is no in-file disc-crop helper — measurement is external).

### HUD-label secondary note (lens-01)

The top-left HUD `dist/radius` readout (`state.distance.toFixed(1)`, help text "Current
approach distance in radii") still shows **absolute** `state.distance`, while the disc now
spans `sVis` radii. The true logical distance-in-planet-radii is `state.distance / sVis`.
This copy was **deliberately NOT rewired** here (display-only increment; a label change is
out of scope) — flagged so a reader doesn't misread the "in radii" label as logical
distance at non-1 radius. Candidate for a one-line HUD tweak in a later polish pass.

---

## Files touched

| File | Change |
|------|--------|
| `planet-lod-lab-core.js` | **Slice A.** Added `VIS_SCALE_EXP`, `visScaleOf`, `CAMERA_CLEARANCE`, `minCameraDistance` (pure exports, after `lodHysteresis`). Existing functions untouched → goldens/headless unaffected. |
| `planet-lod-lab.html` | **Slice B.** Import extension (`:151`); module-scope `let sVis = 1.0` (`~:5637`); frame-loop block — `sVis` compute, `planet`/`hazeShell`/`ring`/`ringCloud` scale, ring-cloud `uDResolve`/`uDCull` threshold scaling, min-distance guard (`~:5655–5671`); `logicalDist` keying of `lodRampOf`/`lodHysteresis` (`~:5688`); wheel clamp (`~:5590`); sweep coverage pin `SWEEP_DISTANCE * sVis` (`:5216`); `_lab` probe additions (`~:6284`). |
| `tests/planet-vis-scale.test.js` | **NEW.** AC-VIS-MONO (identity, worked points, 200-pt monotonicity), AC-CLAMP unit (margin at radius extremes), AC-LOD-KEY keying identity. 9 tests. |
| `tests/vis-scale-fence.test.js` | **NEW.** AC-ZERO-CLOBBER denylist (procgen surfaces + worldengine tree + lab GLSL regions + featureFrequencyFromKm + planet uniform bundle), AC-LOD-KEY source pins, AC-0 single-input pin. 14 tests. |
| `docs/WORKSTREAMS/.../BUILD-NOTES.md` | **Slice C.** This file. |

**Untouched (per HARD RULES):** `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`
(pre-existing NOT-OURS working-tree mods — never edited, never staged).

New line locations are recorded above so a future reader isn't misled by stale numbers if
the file shifts.

---

## Gate results (all run at build close)

1. **New unit tests:** `planet-vis-scale.test.js` (9) + `vis-scale-fence.test.js` (14) =
   **23 passed / 0 failed.**
2. **Golden byte-identity:** `npm run verify-golden` → **PASS**, `canonical-scenario-v1`
   matches golden **`40c18aad`**, 1200/1200 samples, **NO `--record`.** (See deviation #1
   on the "83/83" wording.)
3. **Source-pin suites:** `worldengine-inc3b-synth-law.test.js` +
   `worldengine-inc3b-crater-relevance.test.js` → **22 passed.** No pin updates required —
   the pins are content-regex on crater code far from the LOD/scale edit region, immune to
   line insertions (BUILD-PLAN §5 / R5 confirmed).
4. **Full suite:** `npx vitest run` → **2312 passed / 4 failed** (baseline was 2289 passed
   / 4 failed; +23 = my new tests). The **4 failures are unchanged and pre-existing**,
   unrelated to this work:
   - `GalacticFeatures.test.js > feature types match their galactic context`
   - `KnownObjects.test.js > KnownObjectProfiles > has all five test profiles`
   - `KnownObjects.test.js > searchKnownObjects > is case-insensitive`
   - `KnownObjects.test.js > searchKnownObjects > partial match works`
5. **AC-ZERO-CLOBBER denylist grep:**
   `grep -rnE 'visScaleOf|\bsVis\b|VIS_SCALE_EXP' src/worldengine/ planet-lod-height.glsl.js planet-lod-river-amplifier.glsl.js tests/golden-trajectories/`
   → **0 hits** (grep exit 1). `sVis` appears only in the lab's JS display wiring, never in
   any GLSL string, procgen file, or the golden harness.

---

## Deviations (recorded honestly)

1. **Golden count wording — "83/83" vs actual "canonical-scenario-v1 / 1200 samples".**
   The contract (AC-ZERO-CLOBBER) and BUILD-PLAN say "goldens 83/83 byte-identical." The
   actual golden harness (`tests/golden-trajectories/run-golden.mjs`) validates **one**
   canonical scenario (`canonical-scenario-v1`, 1200 samples, hash `40c18aad`), not 83
   goldens. I verified the golden harness has **zero import dependency** on
   `planet-lod-lab-core.js` or `planet-lod-lab.html` (it imports only `canonical-scenario.js`
   + the motion-test-kit), so my edits cannot affect it — byte-identity holds regardless of
   the count. Treating this as a naming discrepancy in the contract, not a functional gap.
   The gate ran clean (same hash, no `--record`).

2. **"Full suite 4-failure baseline" — 17 failed test FILES vs 4 failed TESTS.** `vitest`
   reports `17 failed` test **files** (all `vendor/motion-test-kit/**` — import-level
   failures that contribute 0 to the test count) but `4 failed` **tests**. The invariant
   the task pins is the **4-test-failure baseline**, which is held exactly. Recorded so the
   file-count isn't misread as regression.

3. **Ring-cloud LOD: took the DEFAULT (scale thresholds), not the deferral.** BUILD-PLAN
   lens-01 offered a documented-deferral fallback (leave `uDResolve`/`uDCull` absolute).
   I implemented the plan's **default** — scaling both thresholds by `sVis` in the frame
   loop — because it is identity at `sVis = 1` (zero golden/baseline/headless impact) and
   consistent with the `logicalDist` apparent-size principle. No deviation from the plan's
   recommendation; noting it because a reviewer choosing the fallback would see a
   difference. Live confirmation of the ring look is a UAT taste call, not a correctness
   gate (rings render only when `state.ringsEnabled`).

4. **Live ACs (AC-SCALE-LIVE, AC-OVERLAY, AC-CLAMP live half) not exercised here.** Per the
   task, no browser was opened; these are driven later by the main session via
   `window._lab` (the probe hooks are in place: `visScaleOf`, `get sVis()`, plus the
   existing `state`, `planet`, `camera`, `rerollRadius`). AC-UAT is deferred-to-Max with
   the crater non-goal carried verbatim.
