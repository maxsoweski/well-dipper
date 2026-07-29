# `_lab.tapControl()` — RUN 2: same body, `enableAllFeatures()` (2026-07-29)

Same config as run 1 (`Rocky (Earthlike)`, R = 1.0, seeds 1234, frozen, rivers routed 6029 channels)
with `_lab.enableAllFeatures()` applied first. Confirmed the enable actually took: `uMountainAmp`
went 0 → 0.46 (the lab zeroes amplitude uniforms for features not enabled in the preset).

Ran in 214 ms. `verdict: "red"`. `uFieldTap` back to 0.

## The discriminating result — L3 coverage 4 → 23

`errors: []` again, so every row is a real measurement. Table grew 33 → 56 gates (more features in
scope). **Newly covered are precisely the relief gates that failed in run 1:**

`uDuneAmp`, `uEdificeAmp`, `uLobeAmp`, `uMountainAmp`, `uOrogenyStrength`, `uOutflowActivity`,
`uTalusAmp`, `uTectonicGrainStrength`, `uDeltaAmp` — plus gates only in scope once enabled:
`uPlateauStrength`, `uScarpStrength`, `uTesseraStrength`, `uVolcanismStrength`, `uKarstDensity`,
`uMassWastDensity`, `uDeltaDensity`, `uDuneDensity`, `uOutflowDensity`, `uMachCoverage`.

**Conclusion: for those gates the leg was never broken — Rocky-with-default-enables simply has those
combiners gated off.** L3's non-coverage there is configuration scope, exactly as its own note says.

## What still fails (33) — and it now sorts into two clean classes

**Class A — not height gates at all.** These drive albedo, emissive, specular, atmosphere or limb.
They provably never touch `h` or `grad`, so "must move its tap" is an **error in the leg's
expectation table**, not a finding about the taps:

`uBioCoverage`, `uCloudCoverage`, `uCoastStrength`, `uStrandStrength`, `uGlintDensity`,
`uLimbStrength`, `uSpecStrength`, `uTermStrength`, `uLightningStrength`, `uMachWindowDensity`,
`uTarCoverage`, `uFacetCoverage`, `uEcuCoverage`, `uWeatherStrength`, `uFrostMaxCoverage`,
`uLavaCoverage`, `uLavaActivity`.

`uRiverCarveStrength` belongs here for a documented reason: the AC4 carve scales **height** by
`uRiverCarveDepth` and **gradient** by `uRiverCarveStrength`. If L3 tests the height channel only,
that gate cannot move it — by design, and the plan already records the asymmetry.

**Class B — relief gates that still do not move, all features on.** These need source work:
`uCraterAmp` (while `uCraterDensity` **does** move — same feature, so "craters are off" cannot
explain the pair), `uEjectaAmp`, `uEjectaStrength`, `uFacetAmp`, `uFluvialActivity`, `uFrostNoiseAmp`,
`uGlacialAmp`, `uLineationAmp`, `uPldStrength`, `uPolarAmp`, `uSubAmp`, `uSubPitDensity`,
`uWrinkleAmp`, `uChevronStrength`, `uCryoRidgeAmp`.

## L4 got substantially WORSE, which kills the obvious fix

| | run 1 (preset enables) | run 2 (all features) |
|---|---|---|
| `floorAtComposite` R² | 0.962247 | 0.962247 |
| `real` R² | 0.823375 | **0.206466** |
| `gradBaseMutant` R² | 0.800205 | **0.184120** |
| `floorFraction` | 0.855679 | 0.214566 |
| separation (real − mutant) | 0.0232 | 0.0224 |

The separation is ~0.023 in **both** configurations. So "run L4 on a richer configuration" does not
recover its discriminating power — the leg is weak for a structural reason, not for want of live
terms. The collapse of `real` to R² 0.21 is a second question: either the shipped analytic gradient
is badly inconsistent with the height field once ~50 combiners are live, or `eps = 0.002` finite
differences undersample the high-frequency field that all-features-on produces. **Both readings are
open; they are not the same finding and must not be conflated.**

## L5 barely moved, but `fadeGap` is now nonzero

| | run 1 | run 2 |
|---|---|---|
| `pixels` | 191 | 191 |
| `parity.slope` | 1.00069 | 1.00197 |
| `parity.r2` | 0.985863 | 0.983746 |
| `parity.rms` | 0.0248031 | 0.0289886 |
| `parity.maxAbs` | 0.342773 | 0.360480 |
| `fadeGap.rms` | 0 | **0.0351163** |
| `fadeGap.maxAbs` | 0 | **0.228514** |

`pixels: 191` is identical across both runs — consistent with a fixed screen-space grid and a
field-independent sphere hit test. `rms 0.029` remains ~380× the sphere tessellation sag (7.5e-5),
and `maxAbs 0.36` is far larger than `rms`, which is the signature of a small number of outlier
pixels rather than a uniform bias.

## L1 / L2 unchanged

L1 `pass`, 0 problems, same `programDigest fnv1a:de1a4a52:len327676` (the program is the same one —
enabling features changes uniforms, not the compiled string). L2 `pass`, identical figures to run 1
(height R² 0.999817, gradient R² 0.998739, `gpuRms` 1.96679) — it reads the bake carrier, which
all-features-on does not alter.
