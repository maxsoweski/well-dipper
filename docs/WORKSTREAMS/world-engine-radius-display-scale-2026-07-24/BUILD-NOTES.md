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
        └─ sVis                            [world-engine-lab.html frame loop, module-scope let]
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
| `world-engine-lab.html` | **Slice B.** Import extension (`:151`); module-scope `let sVis = 1.0` (`~:5637`); frame-loop block — `sVis` compute, `planet`/`hazeShell`/`ring`/`ringCloud` scale, ring-cloud `uDResolve`/`uDCull` threshold scaling, min-distance guard (`~:5655–5671`); `logicalDist` keying of `lodRampOf`/`lodHysteresis` (`~:5688`); wheel clamp (`~:5590`); sweep coverage pin `SWEEP_DISTANCE * sVis` (`:5216`); `_lab` probe additions (`~:6284`). |
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
   `planet-lod-lab-core.js` or `world-engine-lab.html` (it imports only `canonical-scenario.js`
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

---

# FIX-PLAN Slice B (post-UAT-fail rebuild) — 2026-07-24

**Builder subagent, per `FIX-PLAN.md` Slice B ("Fence re-scope + combiner-feature display
keying, P4 + P5"), post-lens.** Built on top of this run's Slice A (log-position radius
slider + debounced re-derive). NOT committed. Files touched: `world-engine-lab.html`,
`tests/vis-scale-fence.test.js`. (`planet-lod-lab-core.js` NOT touched by Slice B —
`featureFrequencyFromKm`/`visScaleOf` already existed.)

## What Slice B does (plain language)

Makes surface FORMS hold their on-screen size while the disc grows, by keying every
angular-fixed render frequency `∝ sVis` at the live lab frame write (`θ ∝ 1/sVis` ⇒
`S = θ·sVis` = constant). Three mechanisms, all display-only, all identity at `sVis=1`:

- **P4 — synth sub-floor craters** (1 write, `uCraterScale` at `:6089`): multiply the
  DISPLAY uniform by `sVis` on the real-R value —
  `featureFrequencyFromKm(state.planetRadiusEarth, state.craterSizeKm, C_CRATER) * sVis`.
  The `featureFrequencyFromKm` arg stays real-R so the inc3b synth-law pin (which recomputes
  `uCraterScale = featureFrequencyFromKm(RE, D_char, C_CRATER)`) is blind to the `·sVis`.
- **P5 — km-keyed texture** (15 `featureFrequencyFromKm` writes): swap the first arg
  `state.planetRadiusEarth → _dispR`, where `const _dispR = sVis;` is defined once near the
  top of the `frame()` write block. `freq = C·sVis·6371/sizeKm ∝ sVis` ⇒ these fixed-km
  textures hold constant instead of shrinking `∝ R^-0.5` (D2 default = "hold constant", the
  ratified bar). **D2 is one-line-reversible:** set `_dispR = state.planetRadiusEarth`.
- **P5b — fixed-uniform relief combiners** (16 writes): multiply the DISPLAY uniform by
  `sVis` at the frame write (`state.<x> * sVis`); `state`/physics stays real-R. These set
  their wavelength from dedicated fixed uniforms (`pos*uX` / `field*uX` in the GLSL), run
  UNCONDITIONALLY after the bake `if/else`, and were missed by P4/P5 and by Slice C — the
  headline gap (mountains render 4.0× larger at R0.5→R8 without this). Wired:
  `uMountainScale`, `uScarpFreq`/`uScarpWarpFreq`, `uPlateauScale`, `uTesseraFreq`/
  `uTesseraWarpFreq`, `uWrinkleFreq`, `uDoubleRidgeFreq`, `uGroovedBandFreq`, `uBladeFreq`,
  `uGlacialScale`, `uLineationFreq`, `uLineationWarpFreq`, `uMachDistrictScale`/
  `uMachBlockScale`, `uCityScale`.

**Fence re-scope (D1):** rewrote `tests/vis-scale-fence.test.js` — the old
`featureFrequencyFromKm`-ban and planet-uniform-bundle-ban became (a) a real-R re-anchor on
the golden/canonical/worldengine surfaces and (b) a display-frequency ALLOWLIST (P4 +
P5b + P5 + Slice-C `uDispDomainScale`). The worldengine/golden/GLSL-token bans STAY. Added
unit pins: `featureFrequencyFromKm(sVis,…)` identity at `sVis=1` + `∝sVis` at `sVis>1`; a
positive `_dispR === sVis` (D2) pin; a positive `uShatSubFreq` NOT-scaled (no-double-scale) pin.

### Non-goals (Slice B)
- **`uCraterAmp` depth compensation NOT applied** (see deviation #4).
- **Exotic/albedo/mask frequencies NOT scaled** (see deviation #6 — the census).
- No Slice C / Slice D work (macro analytic domain-scale + baked-cube re-bake are later).

## Complete relief-form census (required by the plan — every `*Scale`/`*Freq` planet write)

Every `uniforms.u*(Scale|Freq)*.value =` write classified as P4 / P5 / P5b / non-scaled:

- **P4 (·sVis, real-R arg):** `uCraterScale`.
- **P5 (`_dispR` swap, 15):** `uOutflowFreq`, `uKarstDolineFreq`, `uDuneFreq`, `uFacetScale`,
  `uHexScale`, `uShatScale`, `uEcuDistrictScale`, `uEcuBlockScale`, `uEdificeScale`,
  `uLavaScale`, `uCrackScale`, `uChaosCellScale`, `uSubPitScale`, `uSubPolyScale`,
  `uFluvialFreq`. (`uEcuDistrict`/`uEcuBlock` verified independent — both key raw `pos`.)
- **P5b (·sVis, 16):** the list above.
- **NOT scaled — double-scale (deviation #1):** `uShatSubFreq` (rides `shatQ=pos·uShatScale`).
- **NOT scaled — region masks / exotic-or-albedo freqs gated OFF on the Rocky read-gate
  preset (deviation #6):** `uShatMaskScale`, `uChaosMaskScale` (low-freq region masks);
  `uBioScale` (F46 albedo veins), `uOutflowGrooveFreq`, `uKarstMazeFreq`, `uDustRegionFreq`,
  `uLobeFreq`, `uJetTurbFreq` (ratio-multiplier), `uLightCellFreq` (F48 emissive),
  `uFrostNoiseScale`. (`uPointScale` is `ringCloud.material`, not the planet bundle.)

## Gate results (Slice B)

1. **Named + moved suites:** `tests/vis-scale-fence.test.js` (18) + `tests/planet-vis-scale.test.js`
   (9) + `tests/radius-slider-map.test.js` (8, Slice A) → **35 passed / 0 failed.** The fence
   grew 14 → 18 (2 tests rewritten in place, 4 new unit pins).
2. **inc3b physics pins (P4 must not break):** `worldengine-inc3b-synth-law` +
   `worldengine-inc3b-crater-relevance` + `worldengine-v2-6-craters` → **31 passed / 0 failed.**
3. **Golden byte-identity:** `npm run verify-golden` → **PASS**, `canonical-scenario-v1`
   matches golden **`40c18aad`**, 1200/1200 samples, NO `--record`.
4. **Full suite:** `npx vitest run` → **2324 passed / 4 failed.** The 4 failures are EXACTLY
   the pre-existing baseline (`GalacticFeatures` feature-context; `KnownObjects` five-profiles /
   case-insensitive / partial-match) — unchanged, unrelated. (17 failed test *files* =
   `vendor/motion-test-kit` import-level, 0 test contribution — same as prior BUILD-NOTES.)
5. **Fence grep:** `grep -rnE 'visScaleOf|\bsVis\b|VIS_SCALE_EXP' src/worldengine/
   planet-lod-height.glsl.js planet-lod-river-amplifier.glsl.js planet-lod-rivers.js
   tests/golden-trajectories/` → **0 hits.** sVis stays in lab JS only.

## Deviations (Slice B — recorded honestly)

1. **`uShatSubFreq` EXCLUDED from P5b (double-scale fix).** The plan's P5b list includes
   `uShatSubFreq`, but its GLSL samples `shatQ * uShatSubFreq` where `shatQ = pos·uShatScale`
   (`planet-lod-height.glsl.js:2687/:2702`) and `uShatScale` is a P5 write already scaled
   `∝sVis`. So `uShatScale`'s scaling already propagates to the sub-fracture octave; also
   scaling `uShatSubFreq` would give it `∝sVis²` (over-held → shrinks). Left `uShatSubFreq`
   real. **Plan factually wrong about source** (it did not account for the shared `shatQ`
   domain, the exact "no double-scale" hazard class the plan flagged for craters). Guarded by
   a new positive fence pin.
2. **`uLineationWarpFreq` ADDED to P5b.** The plan enumerated `uLineationFreq` but omitted its
   warp partner `uLineationWarpFreq` (`pos·uLineationWarpFreq`, `:2961`), while explicitly
   listing the sibling warp partners `uScarpWarpFreq`/`uTesseraWarpFreq` and stating the rule
   "warp-frequency uniforms scale together with their base so the warp domain tracks." Added
   `·sVis` to keep the lineation warp domain tracking its base. **Plan's enumerated list
   incomplete vs its own stated rule.** Net P5b count stays 16 (−`uShatSubFreq`, +`uLineationWarpFreq`).
3. **Plan prose "17 P5 sites" vs 15 actual.** The plan's Slice-B body says "17" but enumerates
   15 line numbers; the grep confirms **15** non-crater `featureFrequencyFromKm` writes (+1
   crater = P4). Implemented the 15 actual sites. Naming discrepancy, no functional gap.
4. **`uCraterAmp` depth compensation NOT applied (plan-conditional, un-evaluable here).** The
   plan makes the `uCraterAmp = state.craterAmp * (1/sVis)` factor CONDITIONAL ("IF the crater
   depth/diameter aspect visibly breaks under P4's `·sVis` shrink"). As a no-browser build
   agent I cannot evaluate that visible break, so per faithful-implementation-of-a-conditional
   I took the un-triggered branch: `uCraterAmp` (`:6090`) left real. If the read-gate/UAT shows
   steepened synth-crater walls at large radius, the fix is one line at the WRITE site `:6090`
   ONLY (`* (1/sVis)`), NEVER the derivation `:3689–3740`. Flagged for the UAT step.
5. **Line numbers shifted ~+22 from the plan's citations** (Slice A's insertions). Re-grepped
   every actual site rather than trusting the plan's numbers; current sites recorded above.
6. **Census: unlisted angular position-frequencies deliberately NOT scaled (scope boundary).**
   The census found `*Scale`/`*Freq` writes beyond the plan's list that DO multiply `pos`
   (`uBioScale`, `uOutflowGrooveFreq`, `uKarstMazeFreq`, `uDustRegionFreq`, `uLobeFreq`,
   `uJetTurbFreq`, `uLightCellFreq`, `uFrostNoiseScale`) plus two region masks
   (`uShatMaskScale`, `uChaosMaskScale`). Left them REAL: each is either an albedo/emissive
   pattern (not relief), a low-freq region mask (province-class), or a ratio-multiplier
   (`uJetTurbFreq` = "freq multiplier vs the band-warp domain" — a double-scale trap like
   `uShatSubFreq`), and ALL are strength-gated OFF on the `Rocky (Earthlike)` read-gate preset
   the plan UATs. Scaling them is out of Slice B's prominent-Rocky-relief scope and would
   require per-feature independent-vs-ratio domain analysis. **Flagged for Max:** a fully
   general "forms constant on ALL presets (incl. albedo/exotic)" pass is a future slice.

---

# FIX-PLAN Slice C (post-UAT-fail rebuild) — 2026-07-24

**Builder subagent, per `FIX-PLAN.md` Slice C ("Analytic macro body + provinces honor the
display domain-scale, P1 + P3"), post-lens.** Built on top of this run's Slice A (log slider)
and Slice B (P4/P5/P5b combiner-feature keying + fence re-scope). NOT committed. Files touched:
`planet-lod-uniforms.js`, `planet-lod-height.glsl.js`, `world-engine-lab.html`,
`tests/vis-scale-fence.test.js`.

## What Slice C does (plain language — `record-build-intent`)

Introduces the **single global display-domain lever** `uDispDomainScale` that holds the
**analytic macro relief body** (continents) and the **province partition** (region scale)
constant on screen while the disc grows. This is the P1+P3 half of the bar — the "continents
stop scaling" mechanism, in the LIVE shader (visible at `reliefBakeStrength = 0`).

The one equation (FORM-SIZE-MAP §0): to keep a form's on-screen size `S = θ·sVis`
constant while `sVis↑`, its render frequency must scale `∝ sVis` (so `θ ∝ 1/sVis`). The macro
FBM body and province fields are **angular-fixed** today (`uNoiseScale` is a fixed constant,
never radius-keyed), so they GROW with the disc. Slice C fixes that with a domain multiply.

- **New uniform** `uDispDomainScale` in `planet-lod-uniforms.js` (right after `uNoiseScale`),
  **default `1.0`**. The default is load-bearing: the headless/golden bake path is CPU
  `writeHeightSphere` (worldengine), which never writes this uniform → it renders at 1.0 →
  identity → carrier goldens byte-identical.
- **Frame-loop write** (`world-engine-lab.html`, in the per-frame uniform block right after
  `uOctaves`/`uLodRamp`): `uniforms.uDispDomainScale.value = sVis;` — the **ONLY** writer,
  display-only, identity at `sVis=1`.
- **GLSL threading** (`planet-lod-height.glsl.js`) — the height field samples the display-scaled
  domain so every macro-tied frequency scales together:
  - `uniform float uDispDomainScale;` declared in the header (next to `uNoiseScale`).
  - `computeHeight` (finite-diff normal path, `uNormalMode==1`): `pos *= uDispDomainScale;` at
    the top. The finite-difference normal in `perturbFiniteDiff` picks up the chain-rule factor
    for free (numerical gradient of the scaled field).
  - `fbmd` / `fbmdRidged` / `fbmdHetero` / `fbmdDamped` (all four `uNoiseScale*0.3` FBM bases):
    `float freq = uNoiseScale * 0.3 * uDispDomainScale;`. Each function's analytic gradient
    accumulates as `grad += … * freq * n.yzw`, so folding the factor into `freq` at init makes
    **the shaded normal automatically correct** — no separate edit to the grad line is needed
    (see deviation #1). This is the plan's "scale the base freq … and the gradient must pick up
    the same factor" satisfied in one token.
  - `initProvinces`: `pos *= uDispDomainScale;` at the top. Provinces read only `.x` (no gradient
    consumers), so a domain scale is sufficient; the six `pos*<const>` threshold fields all
    partition finer → more, smaller provinces on the growing disc.

At `uDispDomainScale = 1.0` every expression above is its pre-increment self, byte-for-byte.

### Non-goals (Slice C)
- **Does NOT reach the live `bake=1` default.** The lab renders macro relief from the baked
  relief cube (`reliefBakeStrength = 1.0`), and that cube's continuous body is baked by CPU
  `writeHeightSphere`, which does not read `uDispDomainScale`. Slice C is proven at `bake=0`
  (synth macro); **Slice D** re-bakes the continuous body at display density to make this reach
  the eyes at the live default. Do not present to Max at `bake=0` (process guard, FIX-PLAN §0).
- **No `src/worldengine/**` edit, no `planet-lod-rivers.js` edit, no bake edit** — those are
  Slice D's surfaces.
- **Craters not touched here** (P4 — Slice B; the crater combiner reads no `uNoiseScale`, so
  the domain lever does not reach it → no double-scale, per FIX-PLAN's Slice-B guard).

## Gate results (Slice C)

1. **Named + moved suites:** `tests/vis-scale-fence.test.js` (**21**) + `tests/planet-vis-scale.test.js`
   (9) + `tests/radius-slider-map.test.js` (8) → **38 passed / 0 failed.** The fence grew 18 → 21
   (3 new Slice-C pins: default `=== 1.0`; GLSL declares + threads the lever with 2 `pos*=` sites,
   still token-free; frame loop is the sole writer of `= sVis`).
2. **Golden byte-identity:** `npm run verify-golden` → **PASS**, `canonical-scenario-v1` matches
   golden **`40c18aad`**, 1200/1200 samples, NO `--record`. (Incidental backstop — pure orbital
   motion, no bake refs; lens #1.)
3. **Carrier goldens — THE bake guarantee (lens #1) + inc3b physics pins:**
   `v2-0-byte-identity` + `worldengine-base-height-sphere` + `relief-height-cube` +
   `inc3b-synth-law` + `inc3b-crater-relevance` + `v2-6-craters` → **136 passed / 0 failed.**
   The carrier goldens recompute via `makeSphereField(buildIrregularSphere(…))`+`writeHeightSphere`
   → byte-identical (default 1.0, CPU path untouched).
4. **Composite/budget pins + uniform contract:** `v2-5-preset-composite` +
   `inc3b-composite-budget` + `inc3b-relief-budget` + `ws4-uniforms` → **44 passed / 0 failed.**
5. **Full suite:** `npx vitest run` → **2327 passed / 4 failed.** Baseline was 2324/4 at Slice B
   close; +3 = my new Slice-C fence pins. The 4 failures are EXACTLY the pre-existing baseline
   (`GalacticFeatures` feature-context; `KnownObjects` five-profiles / case-insensitive /
   partial-match) — unchanged, unrelated. (17 failed test *files* = `vendor/motion-test-kit`
   import-level, 0 test contribution — same as prior BUILD-NOTES.)
6. **Fence grep:** `grep -rnE 'visScaleOf|\bsVis\b|VIS_SCALE_EXP' src/worldengine/
   planet-lod-height.glsl.js planet-lod-river-amplifier.glsl.js planet-lod-rivers.js
   tests/golden-trajectories/` → **0 hits.** The lever is a uniform NAME in the GLSL; the
   display-scale token stays in the lab JS only.

## Deviations (Slice C — recorded honestly)

1. **Gradient chain-rule handled by scaling `freq`, not by a separate edit at the grad line.**
   The plan (Slice C fbmd) says "scale the base `freq` (or `pos`) … and apply the chain-rule
   factor to the analytic gradient (`grad += amp*w*freq*n.yzw` … must pick up the same
   `uDispDomainScale`)." I scaled `freq` at each FBM's init (`uNoiseScale*0.3*uDispDomainScale`).
   Because the gradient accumulation in ALL four FBM functions is literally `… * freq * n.yzw`
   (fbmd `:771`, fbmdRidged `:991`, fbmdHetero `:2153`/`:2164`, fbmdDamped `:2192`), the scaled
   `freq` flows through the gradient automatically — the shaded normal is correct with **no
   second edit**. Not a departure from the plan's requirement (it offered "freq (or pos)" and
   demanded the gradient carry the factor); recorded so a reviewer isn't surprised the grad line
   is byte-unchanged. **The `pos`-scale variant was reserved for computeHeight (finite-diff, no
   analytic grad) and initProvinces (value-only, no grad) — both correct under a domain scale.**
2. **Line numbers shifted from the plan's citations (Slice A/B insertions).** The plan cited
   frame loop `~:5698`, `computeHeight :630-633`, `fbmd :753`, `initProvinces :840-845`. GLSL
   file numbers were stable (Slice A/B edited the HTML, not the GLSL): computeHeight scale at
   `:631`, the four freq inits at `:755/:974/:2150/:2181`, initProvinces scale at `:840`, header
   decl at `:14`. The lab frame write landed at `:5736` (post Slice-A/B +~40 shift). Re-grepped
   every site rather than trusting the plan's numbers.
3. **Self-caught: the display-scale TOKEN must not appear even in GLSL *comments*.** My first pass
   wrote "sVis" inside three explanatory GLSL comments; the fence's `planet-lod-height.glsl.js`
   token ban (correctly) rejected it. Rephrased the comments to "the display scale" — the token
   now lives only in the lab JS. No functional change; noting it because it is the exact fence
   the plan relies on for uniform-name indirection, and it fired as designed.
4. **OBSERVATION (not a plan departure) — the GPU river-routing sampler shares the `uniforms`
   object, so it reads `uDispDomainScale` too.** `planet-lod-rivers.js createHeightSampler`
   builds its height material with `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN`, binding **the same
   `uniforms` instance** the lab planet shader consumes (its comment: "binds the SAME `uniforms`
   object"), and `ROUTER_MAIN` calls `fbmd(vPos, …)`. So when the live frame loop has set
   `uDispDomainScale = sVis` and `route()` runs, the GPU drainage sampler routes rivers on the
   **display-scaled domain**. Consequences: (a) **identity at `sVis=1`** (radius 1), so no change
   to the canonical path; (b) **goldens unaffected** — the carrier goldens use the CPU
   `writeHeightSphere`, never the GPU `createHeightSampler`, and headless vitest has no WebGL
   context so the sampler never executes in tests (verified: full suite green); (c) it is
   arguably **correct** — rivers routing on the same scaled domain as the continents keeps the
   drainage coherent with the domain-scaled macro body. It IS a live side effect the plan's
   Slice-C description ("the ONLY write, lab-side") did not call out, and `createHeightSampler`'s
   `read()` saves/restores `uOctaves`/`uFwClamp` but **not** `uDispDomainScale`. **Flagged for
   Slice D / the read-gate:** if river routing must stay real-R (unscaled) independent of the
   continent domain, `read()` would need to pin `uDispDomainScale = 1.0` around the route sample;
   left as-is here because coherent-with-continents is the defensible Slice-C reading and
   decoupling is out of Slice C's scope.

---

# FIX-PLAN Slice D (post-UAT-fail rebuild) — 2026-07-24

**Builder subagent, per `FIX-PLAN.md` Slice D ("Baked macro body honors the display scale —
procgen-forced; D3 — + residue"), post-lens.** Built on top of this run's Slice A (log slider),
Slice B (P4/P5/P5b combiner keying + fence re-scope), and Slice C (`uDispDomainScale` analytic
lever). NOT committed. Files touched: `planet-lod-lab-core.js`, `world-engine-lab.html`,
`tests/vis-scale-fence.test.js`. **No `src/worldengine/**` / `planet-lod-rivers.js` /
`planet-lod-height.glsl.js` edit** (byte-safe by construction — see the mechanism below).

## What Slice D does (plain language — `record-build-intent`)

Makes the "forms hold their size" fix REACH THE EYES at the live `bake=1` default. Slices B/C
key the render frequencies `∝ sVis`, but at the live default the macro body is drawn from the
**baked relief cube** (`reliefBakeStrength = 1`), and the cube's continents are ANGULAR-FIXED
geometry that grows with the disc under `planet.scale` — Slice C's `uDispDomainScale` only
affects the *synth* (`fbmd`) residual, which is weighted `(1 - s)` = 0 at `s = 1`. So Slice C is
invisible at the default profile. Slice D fixes that with a **bake→synth crossover**:

- **Effective bake strength = `base · bakeReliefCrossover(sVis)`**, written once per frame at the
  live uniform (`world-engine-lab.html`, right after the Slice-C `uDispDomainScale` write). As the
  disc departs `sVis = 1`, the baked cube fades OUT and the Slice-C domain-scaled analytic body
  (`fbmd · uDispDomainScale`, which IS constant-on-screen) fades IN.
- **`bakeReliefCrossover(sVis)`** (new pure export in `planet-lod-lab-core.js`): a smoothstep of
  `|log2(sVis)|` over `BAKE_CROSS_SPAN` disc-doublings, `1` at `sVis=1` → `0` past the span.
  Symmetric in grow/shrink. `bakeReliefCrossover(1) === 1` **exactly** (smoothstep(0,SPAN,0)=0),
  so at radius 1 R⊕ the frame write re-affirms the base → identity → byte-identical to today.
- **Preset-AGNOSTIC:** every preset's shader shares the same `fbmd` synth body, so the crossover
  reaches ALL of them — including the `Rocky (Earthlike)` read-gate/UAT preset — without editing
  any per-preset worldengine writer.

### The one load-bearing deviation — MECHANISM SWITCH (route-rebake → bake→synth crossover)

**The plan's recommended Slice-D mechanism (thread a `domainScale` param into
`writeHeightSphere` and scale its hardcoded continent frequencies) is factually wrong about the
source for the read-gate/UAT preset, and fixing it "minimally" is not possible. So I built the
plan's OWN documented byte-safe fallback (the bake→synth crossover) instead.** Evidence,
source-verified in the live tree:

1. **`Rocky (Earthlike)` does not use `writeHeightSphere`.** The plan (and FORM-SIZE-MAP) grounds
   Slice D on `writeHeightSphere`'s frequencies (`steeredNoise3(…,9.0,…)`, plateau `d*6`,
   `thicknessBlobSphere` 2.5/5.0). But `route()` dispatches height-writing through
   `writeBodyRelief` (`planet-lod-rivers.js:1321`), and `Rocky (Earthlike)` routes to the **plate**
   path → **`writePlateUpliftSphere`**, NOT the despun `writeHeightSphere`. Pinned by
   `tests/worldengine-v2-3-dispatch-oracle.test.js:92`
   (`'Rocky (Earthlike)': { derived: { path: 'plate' } }`). The read-gate/UAT profile is exactly
   `Rocky (Earthlike)` (FIX-PLAN READ-GATE §Staging). So scaling `writeHeightSphere` would have
   **zero effect** on the continents Max sees at the read-gate — the precise "verified the wrong
   profile" miss the plan is built to avoid.
2. **The plate body has no confineable "domain frequency" to scale.** `writePlateUpliftSphere`
   (`src/worldengine/base/plates.js:195`) sets continent size via a **spherical-Voronoi plate
   partition** — plate COUNT (`PLATE_COUNT_MIN + floor(rng·PLATE_COUNT_SPAN)`), centroid placement,
   rigid Euler-pole motion, boundary-stress classification, and a multi-source BFS distance
   transform. To make its continents smaller/more-numerous you must rescale the plate COUNT and the
   entire stress simulation — a redesign of the plate model, not a `freq·domainScale` multiply.
   There is no minimal confineable scale here.
3. **The route-rebake also carries an UNQUANTIFIED live hazard I cannot clear.** The plan itself
   says the `compositeMargins(carrier, reliefBudget)` (`planet-lod-rivers.js:1361`) RMS-preserving
   budget **re-solves on the display-scaled field** and this "is UNQUANTIFIED" and must be
   **read-gated at R=8**. I am a no-browser builder; I cannot run that live read-gate. The
   crossover **never touches `compositeMargins`** (plan's words), so it sidesteps the hazard
   entirely.
4. **The crossover is the plan's explicitly-preferred contingency.** FIX-PLAN Slice D:
   *"prefer the FALLBACK if the confined route-scale proves risky … the `bake→synth` crossover …
   IS byte-safe — it reuses the Slice-C analytic path, needs NO re-bake, never touches
   `src/worldengine/**` or `compositeMargins`, and sidesteps the shared-verts and budget-re-solve
   hazards entirely."* Given 1–3, the confined route-scale is not merely "risky" — as specified it
   does not reach the read-gate preset at all. The crossover is the responsible, byte-safe,
   plan-documented choice, and it DOES reach `Rocky (Earthlike)`.

**Net:** the crossover subsumes what the `writeHeightSphere` edit would have bought (despun presets
also fade to the constant-size synth body at large `sVis`) while additionally covering the plate /
shell / stagnant-lid / volcanic presets the `writeHeightSphere` edit would have MISSED, at zero
worldengine byte-risk. A future per-writer domain-scale (threading `domainScale` into
`writePlateUpliftSphere` + `writeHeightSphere` + the shell/magmatism/stagnant writers, each with a
default-`1.0` pinned byte-identity) could improve *mid-crossover* fidelity (hold the baked pattern
constant during the blend instead of fading it), keeping stamped basins — but that is a large
multi-file worldengine slice gated on the `compositeMargins` characterization + Max's D3 nod, out
of scope here.

### Residue disclosure (D3, verbatim into the read-gate + UAT recipe)

Two residues, both to be carried into the UAT recipe so Max signs them knowingly:

- **(inherited, plan D3)** *"Fine stamped craters/basins are angular-fixed physics geometry floored
  at the mesh resolution; beyond ~radius 8 they cannot be held constant without sub-mesh-floor
  craters, which the frozen 256²/cube substrate cannot represent. They retain some growth at large
  radius — the one form no display transform corrects."*
- **(crossover-specific)** *As the disc departs radius 1, the continent PATTERN morphs from the
  baked body (Earthlike plate-tectonic continents, incl. stamped basins) into the Slice-C analytic
  FBM body. This is a change in continent CHARACTER, not size — the size-constancy bar ("forms
  remain the same size") is met; the specific coastline you started with is not preserved across
  the grow.* This is the "cheaper, less faithful" cost the plan attaches to the fallback.

## Files touched

| File | Change |
|------|--------|
| `planet-lod-lab-core.js` | **Slice D.** Added pure exports `BAKE_CROSS_SPAN` (=1.0) + `bakeReliefCrossover(sVis)` (smoothstep of `|log2 sVis|`; `===1` exactly at `sVis=1`). After the radius-slider section; existing functions untouched → goldens/headless unaffected. |
| `world-engine-lab.html` | **Slice D.** Import extension (`:151`, add `bakeReliefCrossover`); frame-loop write right after the Slice-C `uDispDomainScale` write (`~:5737`): `uniforms.uReliefBakeStrength.value = grainCarveUI.reliefBakeStrength * bakeReliefCrossover(sVis);`. Identity at `sVis=1`. No other lab change. |
| `tests/vis-scale-fence.test.js` | **Slice D.** Added `uReliefBakeStrength` to the display-scale ALLOW set (display-BLEND term); added `planet-lod-rivers.js` to the sVis-free walk (plan lens #9); new "Slice D — bake→synth crossover" describe (6 pins: identity at 1, symmetric fade + clamp-to-0 past span, `[0,1]` over the radius span, frame-loop re-weight pin, worldengine-untouched pin). Fence grew 21 → 27. |

**Untouched (per HARD RULES):** `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`
(pre-existing NOT-OURS working-tree mods — never edited, never staged; confirmed by mtime + token
grep). **No `src/worldengine/**` edit, no `planet-lod-rivers.js` edit, no GLSL edit** — the whole
point of the crossover mechanism.

## Gate results (Slice D — all run at build close)

1. **Named + moved suites:** `tests/vis-scale-fence.test.js` (**27**) + `tests/planet-vis-scale.test.js`
   (9) + `tests/radius-slider-map.test.js` (8) → **44 passed / 0 failed.** The fence grew 21 → 27
   (6 new Slice-D pins).
2. **Bake byte-identity — THE bake guarantee (plan lens #1) + composite/budget + dispatch:**
   `v2-0-byte-identity` + `worldengine-base-height-sphere` + `relief-height-cube` +
   `v2-5-preset-composite` + `inc3b-composite-budget` + `inc3b-relief-budget` +
   `v2-3-dispatch-oracle` → **171 passed / 0 failed.** All carrier/cube hashes byte-identical (I
   touched no worldengine file, so this holds by construction — the crossover is lab-side only).
3. **Golden byte-identity:** `npm run verify-golden` → **PASS**, `canonical-scenario-v1` matches
   golden **`40c18aad`**, 1200/1200 samples, **NO `--record`.**
4. **Full suite:** `npx vitest run` → **2333 passed / 4 failed.** Baseline was 2327/4 at Slice C
   close; **+6 = my 6 new Slice-D fence pins.** The 4 failures are EXACTLY the pre-existing baseline
   (`GalacticFeatures` feature-context; `KnownObjects` five-profiles / case-insensitive /
   partial-match) — unchanged, unrelated. (17 failed test *files* = `vendor/motion-test-kit`
   import-level, 0 test contribution — same as prior BUILD-NOTES.)
5. **Hard-fence grep:** `grep -rnE 'visScaleOf|\bsVis\b|VIS_SCALE_EXP' src/worldengine/
   planet-lod-height.glsl.js planet-lod-river-amplifier.glsl.js planet-lod-rivers.js
   tests/golden-trajectories/` → **0 hits.** The display scale stays in lab JS only.

## Deviations (Slice D — recorded honestly)

1. **MECHANISM SWITCH: bake→synth crossover instead of the plan's route-rebake into
   `writeHeightSphere`.** The load-bearing deviation — full evidence above ("The one load-bearing
   deviation"). Summary: the read-gate/UAT preset `Rocky (Earthlike)` dispatches to
   `writePlateUpliftSphere` (dispatch-oracle `:92`), not `writeHeightSphere`, and the plate body's
   continent size is a Voronoi plate-count, not a scalable noise frequency; plus the route-rebake's
   `compositeMargins` budget re-solve is unquantified and needs a live read-gate a no-browser
   builder cannot run. I built the plan's own documented byte-safe fallback, which reaches every
   preset via Slice C's shared `fbmd` body.
2. **`BAKE_CROSS_SPAN` default = 1.0 is a READ-GATE TUNABLE I could not validate.** The exact fade
   width is decided by read-gate (b) (form-constancy over the `{0.5, 2, 8}` trio), which needs a
   browser. With `SPAN=1.0`: `R=8` (sVis 2.83) is fully synth (forms constant — good for (b) at the
   top), `R=2`/`R=0.5` (sVis 1.41/0.71) are ~half-blend (forms partially grow). **If (b) fails at
   `R=2`, reduce `SPAN` toward ~0.5** so the fade completes by `R=2` (documented at the export). I
   shipped the MECHANISM with a balanced default; the tuning is deferred to the browser read-gate
   the main session runs — same "ship the lever, tune at read-gate" pattern as Slices A/C.
3. **`uReliefBakeStrength` added to the fence's display-scale ALLOW set as a display-BLEND term.**
   The Slice-B/C allowlist is described as "display-FREQUENCY" writes; the crossover makes a
   display-BLEND uniform legitimately carry `sVis`. Added it explicitly (with a comment) rather than
   hide the `sVis` behind a local var — keeping the fence an honest, greppable enumeration of every
   planet uniform the display scale touches. `found.length` sanity (`≥ 15`) still holds (now 16+).
4. **Read-gate NOT run (no-browser builder).** The FINAL read-gate at `reliefBakeStrength = 1.0`,
   the `octAuto`-ON live-profile pass (lens #6), the through-drag mid-drag form-constancy pass
   (lens #4), and the canvas-element-only capture (lens #5) all require a browser and are the main
   session's / Max's gate. I verified only what a headless builder can: identity at `sVis=1`
   (byte-safe), the pure-fn crossover shape, the fence, and the 4-failure baseline. **Slice D is
   NOT read-gate-verified; do not present to Max until the browser read-gate (a)–(d) passes at the
   live `bake=1` default.**
5. **Router `bakedOn` boolean vs continuous blend (flagged, not a bug).** `route()`'s height-source
   gate is `uReliefBakeStrength.value > 0`; the crossover drives the effective value continuously,
   so at the exact point it reaches 0 (large `|log2 sVis|`) the router flips to the sampler path
   while the renderer blends smoothly. `route()` runs on drag-SETTLE (Slice A debounce) with `sVis`
   stable, so both read the same crossed value at settle; the boolean/continuous mismatch is
   inherent to the pre-existing `bakedOn` design, not introduced here. Left as-is; flagged for the
   read-gate if river/surface coherence looks off at large radius.

### Non-goals (Slice D)
- **No re-bake, no worldengine edit, no per-writer domain-scale** — the crossover re-weights the
  existing blend; it does not make the baked *pattern* itself constant (that is the disclosed morph
  residue). A future per-writer `domainScale` slice could, at large multi-file byte-risk.
- **No `BAKE_CROSS_SPAN` final tuning** — deferred to the browser read-gate (deviation #2).
- **No mid-drag re-bake contract decision** (lens #4) — the crossover happens to make the mid-drag
  transient BENIGN in the limit (as `sVis` grows the baked cube's weight → 0, so the stale-cube
  1:1-grow-with-disc transient fades out rather than dominating), but the exact through-drag
  behavior is a read-gate measurement (deviation #4), not settled here.

---

# FIXER PASS — fbm-routed combiner double-scale (BLOCKER) — 2026-07-24

**Fixer subagent, post-verify.** The in-flight verifier found a BLOCKER: five relief forms that
route through an fbm helper — **mountains, plateau, glacial** (via `fbmdRidged`/`fbmdHetero`/
`fbmdDamped`) and the **machine / ecumenopolis district coverage masks** (via `fbmd`) — were being
scaled by the display factor **TWICE**, so they **SHRINK ~4× across the radius range** instead of
holding constant, directly violating Max's bar for the exact form he complained about (mountains on
`Rocky (Earthlike)`). Files touched by this pass: **`planet-lod-height.glsl.js` ONLY** (5 edits). No
lab.html / lab-core / uniforms / worldengine / test changes. NOT committed.

## Root cause (a latent defect in FIX-PLAN itself — "plan factually wrong about source")

The double-scale is the SAME hazard the plan explicitly guarded for craters (BUILD-NOTES lines
360–361) and for `uShatSubFreq` (Slice-B deviation #1), but it was **never checked for the fbm-routed
combiners**. Two plan slices each scale the same forms:

- **Slice B (P5/P5b)** scales the combiner's OUTER domain uniform: `uMountainScale`/`uPlateauScale`/
  `uGlacialScale`/`uMachDistrictScale` = `state.* · sVis` (and `uEcuDistrictScale` =
  `featureFrequencyFromKm(_dispR=sVis, …) ∝ sVis`).
- **Slice C** threads `uDispDomainScale` (= `sVis` at the frame write) into the INTERNAL base freq of
  all four fbm functions (`float freq = uNoiseScale * 0.3 * uDispDomainScale`), per FIX-PLAN Slice C:
  *"the combiner-internal macro-tied frequencies … get the same `uDispDomainScale` factor so they
  track the body."*

For a combiner sampled as `fbmX(pos * uOuterScale, …)`, the on-screen angular frequency =
`uOuterScale × internalFreq`. When BOTH carry `sVis`, that is `∝ sVis²`, so on-screen size
`S = θ·sVis ∝ (1/sVis²)·sVis = 1/sVis` → a **4× shrink** over `r = 0.5 → 8` (`sVis 0.707 → 2.83`).
FIX-PLAN Slice C's blanket "all four fbm functions" instruction is the factual error: **three of the
four fbm helpers exclusively serve combiners that Slice B already scales**, and the fourth (`fbmd`) is
SHARED between the base body (which legitimately needs the internal factor) and two district masks
that Slice B already scales. This is the same "plan factually wrong about source" class as the
`uShatSubFreq` case, recorded here as the plan told the builder to record analogous cases.

## The fix — confine Slice C's `uDispDomainScale` to the base body; scale each combiner form exactly ONCE

Verified callers (grep): `fbmdRidged` is used ONLY by `mountainCombiner` (`:1480`), `fbmdHetero` ONLY
by `plateauCombiner` (`:2231`), `fbmdDamped` ONLY by `glacialCombiner` (`:2953`). `fbmd` is used by
the base body (`hd = fbmd(vPos, …)` at lab main `:381/:385`, raw `vPos` — **correct single-scale**,
KEEP), the F24/F25/F26 albedo/cloud warp helpers (raw-ish `pos`, off-preset — untouched), and the two
district coverage masks (`fbmd(p·uMachDistrictScale…)` `:2740`, `fbmd(p·uEcuDistrictScale…)` `:2763`).

- **`fbmdRidged` / `fbmdHetero` / `fbmdDamped` — REMOVED the internal `* uDispDomainScale`**
  (`float freq = uNoiseScale * 0.3`). Combiner-EXCLUSIVE helpers with no base-body use, so their single
  display scale now comes solely from Slice B's outer `uMountainScale`/`uPlateauScale`/`uGlacialScale`
  (`∝ sVis`). Removing it from `freq` removes it from the analytic gradient too (grad ∝ `freq·n.yzw`),
  which is CORRECT — the gradient must match the now-single-scaled value (the exact inverse of Slice-C
  deviation #1's "scale freq → gradient tracks for free").
- **`fbmd` — KEPT the internal `* uDispDomainScale`** (`:755`; the base body / provinces / computeHeight
  / albedo helpers legitimately consume it). For the two **district** calls, **DIVIDED the input scale by
  `uDispDomainScale`** (`fbmd(p * uMachDistrictScale * 0.5 / uDispDomainScale + uMacroOffset, …)` and the
  `uEcuDistrictScale` twin), cancelling the internal factor for those calls so the district's single
  display scale comes from its Slice-B outer uniform. Districts read `.x` only (no gradient), so the
  cancel is value-only and clean. `uMacroOffset` seed-phase still tracks the scale (benign, unchanged
  from the buggy code; districts are off-preset for the `Rocky` read-gate and the size-constancy bar is
  what matters — pattern phase is within the disclosed morph tolerance).

**Anti-shimmer clamp bonus (verified correct):** with the internal factor gone, each combiner's fwidth
clamp arg becomes `fwBase · uOuterScale · internalFreq`. Since `fwBase = fwidth(vPos) ∝ 1/sVis` (object
coords magnify on the growing disc) and `uOuterScale ∝ sVis`, the clamp arg is now **radius-invariant**
(`∝ (1/sVis)·sVis·const`), which is the right behavior for a form held constant on screen; the buggy
`∝ sVis²` freq made the clamp over-fade at large radius. Districts pass `fwBase = 0.0` (no clamp), so
the division only moves the sample position.

**Why not the alternative "remove Slice-B outer scale" for the districts:** `uMachDistrictScale` is a
plain `state·sVis` (P5b) but `uEcuDistrictScale` is a `featureFrequencyFromKm(_dispR)` (P5) write — its
sVis-free form is `∝ R`, not constant, so reverting the outer would leave `R·sVis` (still wrong). The
divide-the-shared-input approach keeps BOTH districts faithful to their Slice-B class (scaled via the
outer uniform, consistent with every other combiner incl. `machBlock`/`ecuBlock`) and touches no
lab.html write, so the fence allowlist and `found.length ≥ 15` sanity stay exactly as built.

### `sVis = 1` identity preserved
`uDispDomainScale = 1` at radius 1 R⊕ (default, and the frame write there): `uNoiseScale·0.3` is the
pre-Slice-C value, and `/ uDispDomainScale = /1` is a no-op. Every edited expression is its
pre-increment self at radius 1 → goldens/headless byte-identical by construction (they never run the
GLSL and never set the uniform ≠ 1).

## Gate results (fixer pass — all re-run)

1. **Fence + slider + combiner-source suites:** `tests/vis-scale-fence.test.js` (27) +
   `tests/planet-vis-scale.test.js` (9) + `tests/radius-slider-map.test.js` (8) +
   `tests/ws4-expression-only.test.js` + `tests/ws4-combiners-wire.test.js` → **61 passed / 0 failed.**
   The fence's Slice-C pins still hold: `uNoiseScale * 0.3 * uDispDomainScale` still present (at `fbmd`
   `:755`); exactly **2** `pos *= uDispDomainScale;` (computeHeight + initProvinces); height GLSL carries
   no display-scale token (comments are ASCII, no `sVis`). The ws4 `fbmdRidged` orogeny/no-hash source
   pins survive (I changed only the `freq` line + comments).
2. **inc3b physics + carrier/bake goldens + composite/dispatch:** `inc3b-synth-law` +
   `inc3b-crater-relevance` + `v2-6-craters` + `v2-0-byte-identity` + `worldengine-base-height-sphere` +
   `relief-height-cube` + `v2-5-preset-composite` + `inc3b-composite-budget` + `inc3b-relief-budget` +
   `v2-3-dispatch-oracle` → **202 passed / 0 failed.** Holds by construction (no worldengine / lab-core
   edit; the GLSL string is not imported by any headless test except the fence's content grep).
3. **Golden byte-identity:** `npm run verify-golden` → **PASS**, `canonical-scenario-v1` matches golden
   **`40c18aad`**, 1200/1200 samples, **NO `--record`.**
4. **Full suite:** `npx vitest run` → **2333 passed / 4 failed** — EXACTLY the pre-existing 4-test-failure
   baseline (`GalacticFeatures` feature-context; `KnownObjects` five-profiles / case-insensitive /
   partial-match). No new failures; no regressions.
5. **Hard-fence grep:** `grep -rnE 'visScaleOf|\bsVis\b|VIS_SCALE_EXP' src/worldengine/
   planet-lod-height.glsl.js planet-lod-river-amplifier.glsl.js planet-lod-rivers.js
   tests/golden-trajectories/` → **0 hits.**
6. **NOT-OURS + staging:** `src/auto/CameraChoreographer.js` + `src/debug/LabMode.js` carry only their
   pre-existing working-tree `M` (untouched by this pass); nothing staged; no commits.

## Deviation (fixer pass — recorded honestly)

1. **FIX-PLAN Slice C over-scoped `uDispDomainScale` to ALL four fbm functions — factually wrong about
   source.** The plan instructed threading `uDispDomainScale` into `fbmd`/`fbmdRidged`/`fbmdHetero`/
   `fbmdDamped` "so they track the body," but three of those helpers exclusively serve combiners that
   Slice B/P5b already scales (`∝ sVis` via the outer uniform), and `fbmd`'s use by the two district
   coverage masks is likewise already scaled by Slice B — so the plan's own two slices double-count the
   same forms (`∝ sVis²`). Fix confines Slice C's lever to the base body / provinces / computeHeight (the
   forms with NO outer domain uniform) and de-double-scales the combiner/district paths. Same class as
   Slice-B deviation #1 (`uShatSubFreq`); recorded per HARD RULES.

### Non-goals (fixer pass)
- **Albedo/cloud fbm helpers (F24 band-warp, F25 jets, F26 weather) left as-is** — they consume `fbmd`'s
  internal `uDispDomainScale` (so they hold constant on screen, single-scaled) but carry no outer `·sVis`,
  so they are NOT double-scaled. They are off-preset for `Rocky (Earthlike)` and out of this finding's
  scope (Slice-B census deviation #6's "albedo/exotic on all presets is a future slice"). Untouched.
- **No read-gate run** — this pass is a headless correctness fix; the live `bake=1` read-gate (a)–(d),
  the through-drag and `octAuto`-ON passes, and canvas-element capture remain the main session's / Max's
  gate (Slice-D deviation #4 stands).
