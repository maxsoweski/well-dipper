# `_lab.tapControl()` — RUN 1, first ever execution (2026-07-29)

**Config:** `Rocky (Earthlike)`, `planetRadiusEarth = 1.0` (L2's anchor), seeds 1234/1234,
distance 2.6, `normalMode = 0`, `levels = 6`, animation frozen, rivers routed (6029 channels,
seaLevel 0.3036, oceanFrac 0.35). GPU: ANGLE / NVIDIA RTX 5080 / D3D11, Chrome 150, WebGL2.

**`verdict: "red"`**, 867 ms. `uFieldTap` back to 0 after the run (§7 safety check passed).

**env:** `octavesLive 9`, `octavesPinned 9`, `uFwClamp 1`, `uLodRamp 1`, `uNormalMode 0`,
`uReliefBakeStrength 1`, `uCraterBakeRestore 0`, `uRiverCarvePatchStrength 0`.

---

## L1 — rendered-program identity: **PASS**

`problems: []`, `renderedIsCompiled: true`, reference resolved mesh → Scene → material at check
time. `programDigest fnv1a:de1a4a52:len327676`, `tapVertexDigest fnv1a:bee804ef:len1672`.

## L2 — composite anchor: **PASS, and this is the AC's core indictment answered**

| channel | slope | R² | notes |
|---|---|---|---|
| height | 0.993916 | **0.999817** | |
| gradient | 0.973189 | **0.998739** | `gpuRms 1.96679` (nonzero ⇒ gradient not dropped) |

`provenance: { heightSource: "carrier", uReliefBakeStrength: 1, uCraterBakeRestore: 0 }`, 4000 points.

The plan's bar: *"Today's pre-AC-SAMPLER sampler regressed near R² ≈ 0 against the cube — if the new
number is not decisively better, the AC has not closed."* 0.9998 vs ~0. Decisive.

## L3 — per-term sensitivity/invariance: **FAIL** — 4 covered, 29 failed, **0 errors**

`errors: []` matters: no plant was overwritten between set and read, so every row is a real
measurement, not a vacuous pass/fail against an unplanted field.

**Covered (4):** `uCraterDensity`, `uReliefBakeStrength`, `uRiverCarveDepth`, `uSeaLevel`.
`compositeInvariant` held on every row except `uReliefBakeStrength`, which is expected to move
`TAP_COMPOSITE` and did.

**The 29 failures are not homogeneous.** At least eight are gates that cannot move a *height* tap
because they are not height gates at all:

| gate | what it actually drives |
|---|---|
| `uCloudCoverage` | cloud layer, composited after the surface |
| `uLimbStrength` | limb glow |
| `uGlintDensity` | specular glint |
| `uCoastStrength`, `uStrandStrength` | F20 coastline **luminance** terms (shader: "All luminance") |
| `uTarCoverage` | albedo |
| `uMachWindowDensity` | machine-city window albedo |
| `uFacetCoverage` | F43 facet albedo/spark |

The remaining ~21 (`uChevronStrength`, `uCraterAmp`, `uDeltaAmp`, `uDuneAmp`, `uEdificeAmp`,
`uEjectaAmp`, `uFacetAmp`, `uFluvialActivity`, `uFrostNoiseAmp`, `uGlacialAmp`, `uLineationAmp`,
`uLobeAmp`, `uOrogenyStrength`, `uOutflowActivity`, `uPolarAmp`, `uRiverCarveStrength`, `uSubAmp`,
`uSubPitDensity`, `uTalusAmp`, `uTectonicGrainStrength`, `uWrinkleAmp`) *are* relief gates and did
not move `TAP_SOLID`. Open question: preset-scoped inertness (feature disabled ⇒ combiner gated to
zero, which the leg's own note says it does not claim otherwise about) vs. a real defect.

Note `uCraterAmp` did **not** move the tap while `uCraterDensity` **did** — same feature, so
"craters are off" cannot explain that pair.

## L4 — gradient vs derivative: **FAIL, `weak: true`** (correctly refused to pass)

| | slope | R² | samples |
|---|---|---|---|
| `floorAtComposite` | 1.04455 | 0.962247 | 800 |
| `real` | 1.05444 | **0.823375** | 800 |
| `gradBaseMutant` | 1.04015 | **0.800205** | — |

`eps 0.002`, `floorFraction 0.855679`, `threshold 0.481124`, `floorUnusable: false`.

Separation between the real implementation and a one-token `gradBase`-for-`grad` mutant is
**0.023 in R²**. The leg is supposed to be red against that mutant; it is barely distinguishable.
Per the plan this is reported WEAK, not passed.

## L5 — vertex-plumbing parity: **FAIL**

`pixels: 191`. `parity: slope 1.00069, R² 0.985863, rms 0.0248031, maxAbs 0.342773`.
Bar: R² > 0.99, slope ≈ 1. Slope is fine; R² is just under; **rms 0.0248 is ~330× the sphere
tessellation sag** (longitude step 2π/256 = 0.0245 rad ⇒ sag ≈ 7.5e-5), and `maxAbs 0.343` is large.

`fadeGap: { rms: 0, maxAbs: 0, octavesLive: 9, octavesPinned: 9, fwClampLive: 1 }` — pinning octaves
cost **exactly nothing** at this distance, which is the number the plan asked to be reported rather
than argued.

---

## Raw verdict

`evidence/tapcontrol-run1-rocky-R1.json` (342 KB — the bulk is L1's full 327,676-char fragment
program, retained deliberately as the identity evidence).
