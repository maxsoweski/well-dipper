# ROOT-0 — the committed delta table: the lab-side law seam

> **Generated artifact — do not hand-edit.** Regenerate with `node tools/root0-seam-delta.mjs --write`.
> The gate for **B1** of `docs/FEATURES/comprehensive-wiring-plan-2026-08-20.md` (plan:318-381).
> B1 is a **declared number-moving block, LAB-SIDE ONLY**: its named movers *must* move, and a
> table of zeros here is a failure, not a pass. Its OTHER gate — Instrument C, the shipped-uniform
> delta — must stay byte-identical on all four packs, and the two are not in tension: `deriveUniforms`
> has no call site in `src/`, and `deriveConditionVector` is called with `derived = null` on the game
> route (`conditionFromBody.js:868`), so nothing measured below is on the player path.

**Tree at generation:** `5b1099b` (dirty tree) · **generated:** 2026-08-20

## Population

- **1517 bodies** over `lab-procedural-0…199` — **852 planets + 632 plain moons + 33 planet-class moons**.
- Every body is a pure function of an integer seed; a second build from the same seeds gives the same population.
- ⛔ **Sol is nowhere in this file.** 18 NASA textures, a different renderer, no world-engine condition fields.

## How to read a section

Delta = |NEW − OLD| per body; vector rows are the max absolute component delta. **No epsilon anywhere** —
`moved` counts bodies whose delta is not exactly 0. Percentiles are nearest-rank over ALL bodies (including
the unmoved ones), so a median of 0 with a large max means "moves hard on a minority".

⭐ **THE CONTROL IS THE PRE-FIX RUN.** Both bundles in every section differ only in a key the PRE-fix reader
cannot see, so this same tool run against the pre-fix tree prints **all four sections all-zero**. That
all-zero run is the "before" half of this measurement and it is what proves the comparator is wired to the
repaired read and to nothing else.

---

## Fix 1 — erosion — the key the game never emits

**Master:** `deriveUniforms` (src/worldengine/base/labCore.js)

PRE: `d.surfaceHistory?.erosion ?? 0` — the game emits `erosionLevel` (PhysicsEngine.js:822), so the reader resolved a hard **0** on every game body. POST: the reader accepts the game spelling. OLD bundle = both spellings deleted (what the pre-fix reader saw); NEW bundle = the condition untouched.

| quantity | moved / n | min | median | p95 | max | worst body |
|---|---:|---:|---:|---:|---:|---|
| `reliefAmplitude` | 1517 / 1517 | 0.0012 | 0.106774 | 0.4 | 0.4 | S:1:p0 |
| `chasmaDepth` | 1517 / 1517 | 0.0001008 | 0.0180486 | 0.074616 | 0.112 | S:46:p1 |
| `plateauStrength` | 1517 / 1517 | 0.000072 | 0.0128918 | 0.0532972 | 0.08 | S:46:p1 |
| `scarpStrength` | 1263 / 1517 | 0 | 0.00833757 | 0.0433262 | 0.0595562 | S:168:p0 |
| `mountainAmp` | 1179 / 1517 | 0 | 0.0492513 | 0.35 | 0.35 | S:1:p0 |
| `orogenyStrength` | 885 / 1517 | 0 | 0.145269 | 0.85 | 1 | S:32:p1 |
| `rayBrightness` | 632 / 1517 | 0 | 0 | 0.226718 | 0.3 | S:29:p2:m0 |
| `tesseraStrength` | 606 / 1517 | 0 | 0 | 0.0313948 | 0.06 | S:9:p0 |

**Did not move on any body (55):** `atmosphereModel`, `auroraIntensity`, `channelDensity`, `chaosCellScale`, `chaosMatrixRough`, `chaosRaftJitter`, `chasmaAxes`, `chasmaCount`, `cloudCoverage`, `craterCells`, `craterComplexD`, `craterDensity`, `craterRelaxation`, `cryoActivity`, `cryoRidgeAxes`, `cryoRidgeOffset`, `cryoRidgeWidth`, `doubleRidgeFreq`, `edificeMaxHeight`, `ejectaRampart`, `ejectaStrength`, `emissive`, `frostAlbedo`, `frostCondensationT`, `frostLatitudeBias`, `frostLocked`, `frostMaxCoverage`, `glacialFlowVigor`, `glacialStrength`, `groovedBandFreq`, `lavaActivity`, `lavaAxis`, `lavaCoverage`, `limbStrength`, `liquidSpecies`, `liquidStability`, `magneticField`, `maxOctaves`, `orogenyAxis`, `pldLevels`, `pldStrength`, `precipitation`, `pressure`, `scarpAxis`, `scarpStyle`, `shieldStratoMix`, `specStrength`, `subStrength`, `surfaceGravity`, `tempEq`, `terraceCount`, `tesseraAxes`, `tidalHeat`, `volatileSpecies`, `volcanismStrength`

---

## Fix 1.5 — erosion — the same key, the other reader

**Master:** `deriveBodyScalars` (src/worldengine/base/baseStep.js)

The identical mis-spelling at `baseStep.js:38`. Reported separately because it is a different master: `surfaceHistory` is a *returned scalar* here, not a uniform.

| quantity | moved / n | min | median | p95 | max | worst body |
|---|---:|---:|---:|---:|---:|---|
| `surfaceHistory` | 1517 / 1517 | 0.003 | 0.266935 | 1 | 1 | S:1:p0 |

**Did not move on any body (17):** `ageNorm`, `density`, `despinAmp`, `discriminator`, `liquidSpecies`, `liquidStability`, `loveK2`, `radialStrainMag`, `radialStrainSign`, `rainFactor`, `rawTidalIoRatio`, `rockyCrust`, `shellThickness`, `surfaceGravity`, `thermalState`, `tidalHeat`, `useDiscriminator`

---

## Fix 2 — tidal precedence — the recompute that overrode the real value

**Master:** `deriveUniforms` (src/worldengine/base/labCore.js)

PRE: `deriveUniforms` recomputed the Io-ratio from `d.eccentricity ?? 0` against a 1 M☉-at-1 AU fallback, ignoring the real value the condition already carries as `rawTidalIoRatio`. `baseStep.js:29` has had the correct precedence shape since WS2. OLD bundle = both tidal keys deleted (forces the recompute, which is what the pre-fix reader always did); NEW = the condition untouched.

| quantity | moved / n | min | median | p95 | max | worst body |
|---|---:|---:|---:|---:|---:|---|
| `tidalHeat` | 1414 / 1517 | 0 | 0.00263602 | 219.313 | 316301 | S:163:p3 |
| `chasmaDepth` | 1175 / 1517 | 0 | 0.000023678 | 0.0894585 | 0.13529 | S:184:p4 |
| `plateauStrength` | 1174 / 1517 | 0 | 0.0000169128 | 0.0638989 | 0.0966359 | S:184:p4 |
| `lavaActivity` | 1006 / 1517 | 0 | 6.96803e-8 | 0.831296 | 1 | S:3:p1:m0 |
| `channelDensity` | 1006 / 1517 | 0 | 6.34505e-8 | 0.756974 | 0.910595 | S:3:p1:m0 |
| `volcanismStrength` | 899 / 1517 | 0 | 4.42827e-8 | 0.5 | 0.781436 | S:31:p3 |
| `cryoActivity` | 596 / 1517 | 0 | 0 | 0.907586 | 1 | S:6:p5:m0 |
| `tesseraStrength` | 414 / 1517 | 0 | 0 | 0.0461881 | 0.141386 | S:93:p0 |

**Did not move on any body (55):** `atmosphereModel`, `auroraIntensity`, `chaosCellScale`, `chaosMatrixRough`, `chaosRaftJitter`, `chasmaAxes`, `chasmaCount`, `cloudCoverage`, `craterCells`, `craterComplexD`, `craterDensity`, `craterRelaxation`, `cryoRidgeAxes`, `cryoRidgeOffset`, `cryoRidgeWidth`, `doubleRidgeFreq`, `edificeMaxHeight`, `ejectaRampart`, `ejectaStrength`, `emissive`, `frostAlbedo`, `frostCondensationT`, `frostLatitudeBias`, `frostLocked`, `frostMaxCoverage`, `glacialFlowVigor`, `glacialStrength`, `groovedBandFreq`, `lavaAxis`, `lavaCoverage`, `limbStrength`, `liquidSpecies`, `liquidStability`, `magneticField`, `maxOctaves`, `mountainAmp`, `orogenyAxis`, `orogenyStrength`, `pldLevels`, `pldStrength`, `precipitation`, `pressure`, `rayBrightness`, `reliefAmplitude`, `scarpAxis`, `scarpStrength`, `scarpStyle`, `shieldStratoMix`, `specStrength`, `subStrength`, `surfaceGravity`, `tempEq`, `terraceCount`, `tesseraAxes`, `volatileSpecies`

---

## Fix 3 — ageNorm — raw Gyr driven into a `(1 − ageNorm)` term

**Master:** `deriveBodyScalars` (src/worldengine/base/baseStep.js)

PRE: `d.ageNorm ?? (d.age ?? 0.5)` — the condition emits `age` in **Gyr**, so `(1 − ageNorm)` ran negative for every body older than 1 Gyr. `adaptL0.js:36` and `e1Regime.js:224` BOTH already express the law as `clamp01(age/10)`. OLD bundle pins `ageNorm` to the raw Gyr the pre-fix fallback resolved; NEW = the condition untouched.

| quantity | moved / n | min | median | p95 | max | worst body |
|---|---:|---:|---:|---:|---:|---|
| `ageNorm` | 1517 / 1517 | 0.09 | 3.9003 | 7.64658 | 11 | S:29:p0 |
| `shellThickness` | 1517 / 1517 | 0.018 | 0.433955 | 0.872621 | 0.899868 | S:16:p0:m0 |
| `loveK2` | 1517 / 1517 | 0.000491074 | 0.113595 | 0.395328 | 0.588939 | S:142:p3 |
| `thermalState` | 1503 / 1517 | 0 | 0.27955 | 0.656938 | 0.886006 | S:142:p3 |
| `despinAmp` | 1501 / 1517 | 0 | 0.343136 | 0.586697 | 0.621485 | S:130:p0 |
| `radialStrainMag` | 1501 / 1517 | 0 | 0.220202 | 0.490479 | 0.532702 | S:130:p0 |
| `radialStrainSign` | 5 / 1517 | 0 | 0 | 0 | 2 | S:4:p2 |
| `discriminator` | 5 / 1517 | 0 | 0 | 0 | 1 | S:4:p2 |

**Did not move on any body (10):** `density`, `liquidSpecies`, `liquidStability`, `rainFactor`, `rawTidalIoRatio`, `rockyCrust`, `surfaceGravity`, `surfaceHistory`, `tidalHeat`, `useDiscriminator`

---

## Fix 4 — surfaceGravity — a recompute that disagrees with the condition

**Master:** `deriveUniforms` (src/worldengine/base/labCore.js)

PRE: `massEarth / radiusEarth²` with `massEarth ?? 1.0` — the condition carries no `massEarth`, so every body was given **1 M⊕** and its g came out as `1/R²`. `conditionVector.js:134` already supplies the real g. ⚠ Booked as **CORRECTNESS, not differentiation** (see the plan's row 4). OLD bundle = `surfaceGravity` deleted (forces the recompute); NEW = the condition untouched.

| quantity | moved / n | min | median | p95 | max | worst body |
|---|---:|---:|---:|---:|---:|---|
| `surfaceGravity` | 1517 / 1517 | 0.00292529 | 2.57212 | 2079.2 | 17863.8 | S:188:p3:m0 |
| `craterComplexD` | 1517 / 1517 | 0.00328548 | 3.32858 | 17.9992 | 17.9999 | S:188:p3:m0 |
| `glacialFlowVigor` | 1517 / 1517 | 0.00146265 | 0.392863 | 0.494454 | 0.49818 | S:119:p7:m0 |
| `chaosRaftJitter` | 1517 / 1517 | 0.00146265 | 0.392863 | 0.494454 | 0.49818 | S:119:p7:m0 |
| `edificeMaxHeight` | 1515 / 1517 | 0 | 1.65707 | 1.8 | 1.8 | S:0:p0:m0 |

**Did not move on any body (58):** `atmosphereModel`, `auroraIntensity`, `channelDensity`, `chaosCellScale`, `chaosMatrixRough`, `chasmaAxes`, `chasmaCount`, `chasmaDepth`, `cloudCoverage`, `craterCells`, `craterDensity`, `craterRelaxation`, `cryoActivity`, `cryoRidgeAxes`, `cryoRidgeOffset`, `cryoRidgeWidth`, `doubleRidgeFreq`, `ejectaRampart`, `ejectaStrength`, `emissive`, `frostAlbedo`, `frostCondensationT`, `frostLatitudeBias`, `frostLocked`, `frostMaxCoverage`, `glacialStrength`, `groovedBandFreq`, `lavaActivity`, `lavaAxis`, `lavaCoverage`, `limbStrength`, `liquidSpecies`, `liquidStability`, `magneticField`, `maxOctaves`, `mountainAmp`, `orogenyAxis`, `orogenyStrength`, `plateauStrength`, `pldLevels`, `pldStrength`, `precipitation`, `pressure`, `rayBrightness`, `reliefAmplitude`, `scarpAxis`, `scarpStrength`, `scarpStyle`, `shieldStratoMix`, `specStrength`, `subStrength`, `tempEq`, `terraceCount`, `tesseraAxes`, `tesseraStrength`, `tidalHeat`, `volatileSpecies`, `volcanismStrength`

### ⚠ THE COST, MEASURED — this fix is CORRECTNESS and it LOSES differentiation

A section that reported only movement would read as all-upside. `edificeMaxHeight` reads g directly
against two clamp rails, so "how many bodies sit ON a rail" is the differentiation question:

| | on a clamp rail | at CEIL 2.0 | at FLOOR 0.2 |
|---|---:|---:|---:|
| **OLD** (recompute from a defaulted 1 M⊕) | 834 / 1517 | 248 | 586 |
| **NEW** (the condition's own g) | 904 / 1517 | 904 | 0 |

⛔ The rail count gets **WORSE**, 834 → 904, and that is the honest reading: the repaired law
is more correct AND less differentiating on this consumer. The SHAPE is the part worth carrying
forward — the floor rail **empties** (586 → 0) and the ceiling absorbs all of it
(248 → 904), because real bodies are mostly LOW-gravity while `1/R²` on a defaulted
Earth mass sent every small body to the opposite extreme. So this is not "the same amount of flatness
moved around": it is one rail replacing two, on 59.6% of the corpus. ⭐ Whoever wires the edifice
consumer inherits this, and the answer is a re-ranged law, not a re-broken g.

