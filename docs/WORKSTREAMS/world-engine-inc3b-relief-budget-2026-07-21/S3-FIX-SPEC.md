# S3-FIX SPEC — in-shader analytic crater-texture channel (F2-adapted), adjudicated

Grounded at HEAD 6b6d8a9 by the grounding agent (all seams grep-verified); flags F1–F7 adjudicated by
working-Claude 2026-07-24. Conviction basis: S3-DIAGNOSIS.md (+ falsifier addendum) — CONTENT: the
sub-floor crater band is unresolvable at the 40k mesh; the synth renders it analytically per-fragment
(resolution-independent, bypasses mesh+bake sampling). The stamped-wall ~12% residual is NOT this fix's
scope (S4 shading-scale/metric item — F4, disclosed to Max in the UAT packet).

## Adjudicated design (F-flags resolved)

- F1: `craterRelevanceOf(cond)` exported from `src/worldengine/base/bombardment.js` (cohesion; e1-blind).
  Predicate: `isImpactSurface(cond) && schedule.fired && (schedule.nStamp > 0 || schedule.regolithRoughness > 0)`
  → returns 0/1 (or a scalar if a derived fade is cleaner — derivation-honest either way). TOTAL, never
  throws, identity(0)-outside-domain, loop-18-presets test.
- F2: single representative `D_char = sqrt(L · D_FLOOR_KM)` (geometric mean of the sub-floor band)
  drives `uCraterScale = RE·6371 / D_char`. Multi-octave stack recorded as fallback if S4 reads monotone.
- F3: anti-double-render clamp — choose the scale so the MAX hashed crater diameter (the 0.55-tail of
  `mix(0.18,0.55)`) lands AT or below `D_FLOOR_KM`; derive the clamp factor from the hash range, comment it.
- F4: scope = the sub-floor texture band only. The synth must NOT re-render stamped-size bowls.
- F5: keep `provinceWeight(PROV_CRATERS)` as wired (continuity with the stamped population); S4 revisit.
- F6: DELETE the preservation modulation for craters (lab.html ~:3260–3268 crater lines: `_craterWeathering`
  → craterDensity/craterAmp/craterRelaxation blends) — its physics (weathering/erosion/resurfacing) already
  lives in `craterSchedule` (tExp/erosion); one law. Legacy defaults `craterSizeKm=530` / `craterAmp=0.9`
  superseded on the auto path: route-time derivation writes state.craterScaleKm/craterDensity/craterAmp/
  craterRelaxation from the schedule (same derived-state pattern as `state.iceness` at :3694). GUI sliders
  remain as post-route manual tweaks (overwritten on next route). Verify `_craterWeathering` has no other
  consumer before deleting (grep).
- F7: `state.cratersEnabled` DEFAULT flips to `true`; semantics = debug force-OFF. The auto gate is
  `uniforms.uCraterDensity.value = state.cratersEnabled ? state.craterDensity * state.craterRelevance : 0`
  — `featureRelevant.craters` (preset-name) is DROPPED from the crater path (the :3011–3013 computation
  stays for other consumers; `craters.rendersOn` at planet-feature-associations.js:74 BYTE-UNMODIFIED).
  Ejecta path same treatment (relevance gate, rendersOn dropped from the gate).

## Schedule-derived single law (uniforms written at route time, lab.html near :3694)

From `const _sch = craterSchedule(_bodyDrivers.condition)`:
- `state.craterRelevance = craterRelevanceOf(_bodyDrivers.condition)`
- `uCraterScale`: `featureFrequencyFromKm(RE, D_char, 1.0)` with D_char per F2/F3 (from `_sch.L`,
  `_sch.D_FLOOR_KM` — mind sizeMul).
- `uCraterDensity`: host fraction derived closed-form from `_sch.regolithRoughness` (the sub-floor areal
  coverage) at the chosen cell frequency — derivation comment mandatory, no taste constant.
- `uCraterAmp`: depth law — `0.20 · radPerKm(R) · D_char` (`D_D_SIMPLE=0.20` imported/cited from
  bombardment.js; sub-floor ≪ D_t ⇒ pure simple bowls; envelope-free — uCraterAmp stays bare at :5957,
  riding uPerturb once).
- `uCraterComplexD`: set so morphology≈0 (all simple).
- `uCraterRelaxation`: schedule-derived (tExp/erosion) replacing the deleted `_craterWeathering`.
- NEW `uRegolithRoughness` (optional micro-grain term): amplitude ∝ `_sch.regolithRoughness`, synced like
  `uIcenessMix` (:6036). May be deferred if the synth alone carries the read — builder's call, recorded.

## Seeded craterOffset (rider)

`newPlanet()` (:3871–3875): derive `state.craterOffset` deterministically from the re-rolled world seed —
use the existing `seedOffset(state.macroSeed, ...)` helper pattern (:2461/:2467). 🌍 re-rolls move the
crater/ejecta/ray field. 🎲 `randOffset()` button stays as a manual scramble. No existing test asserts
offset behavior (verified).

## Fences (verified by grounding)

Render-side only: no carrier writes → 75 goldens / dispatch-oracle / composite suites byte-untouched, NO
re-capture. Atmo-owned lab.html regions (F27–F30 storm block :651–1090, mulberry32 :1985 — a test pins its
presence, F43 crystal) UNTOUCHED. e1-shadow-audit: bombardment.js must not gain an e1Regime import (it
won't). `feature-associations.test.js` stays green (rendersOn unmodified). Files touched:
`planet-lod-height.glsl.js` (crater/ejecta combiner region + uniform decls ONLY),
`world-engine-lab.html` (crater uniform writes/defaults/route-derivation/newPlanet seed; preservation-chain
crater lines deleted), `src/worldengine/base/bombardment.js` (export craterRelevanceOf), + 2 new test files.

## Tests

- `tests/worldengine-inc3b-crater-relevance.test.js`: AC-0 grep (no label/archetype/regime/rendersOn);
  0 on non-impact worlds, 1 on Moon/Mercury+Frozen+Mars(+Crystal); total over 18 presets, never throws.
- `tests/worldengine-inc3b-synth-law.test.js`: uniform derivations reproduce from craterSchedule; sub-floor
  band strictly below D_FLOOR incl. the hash-tail clamp (anti-double-render assert); determinism.
- Full suite at the 4-failure baseline; the S1/S2 suites re-run green.

## Live-only (S4)

Arc/blind/surface-class re-gate at the SAME frozen thresholds; double-render visual check at the D_FLOOR
seam; 🌍 re-roll moves the synth field; Mars/Crystal ride-alongs; full-phase control. AC-UAT = Max alone.
