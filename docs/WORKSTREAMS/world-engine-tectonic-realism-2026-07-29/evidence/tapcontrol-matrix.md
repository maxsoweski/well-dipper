# `_lab.tapControl()` — the four-configuration matrix (2026-07-29, first ever live runs)

All runs: R = 1.0 R⊕ (L2's anchor), seeds 1234/1234, distance 2.6, `normalMode 0`, `levels 6`,
animation frozen, rivers routed. GPU ANGLE/NVIDIA RTX 5080/D3D11, Chrome 150, WebGL2.
`uFieldTap` verified back to 0 after every run.

| run | preset | enables | river channels |
|---|---|---|---|
| **A** | Rocky (Earthlike) | preset defaults | 6029 |
| **B** | Rocky (Earthlike) | `enableAllFeatures()` | 6029 |
| **C** | Eyeball (locked temperate) | preset defaults | 3477 |
| **D** | Europa (icy moon) | preset defaults | 4039 |

`verdict: "red"` in all four.

---

## L1 — rendered-program identity: PASS ×4

`problems: []` every run. Same `programDigest fnv1a:de1a4a52:len327676` throughout (enabling features
and switching preset changes uniforms, not the compiled string — as expected for a single mega-shader).

## L2 — composite anchor: PASS ×4

| run | height slope | height R² | grad slope | grad R² | `gpuRms` |
|---|---|---|---|---|---|
| A | 0.993916 | 0.999817 | 0.973189 | 0.998739 | 1.96679 |
| B | 0.993916 | 0.999817 | 0.973189 | 0.998739 | 1.96679 |
| C | 0.959846 | 0.997463 | 0.928597 | 0.996338 | 1.17224 |
| D | 0.960469 | 0.997687 | 0.930718 | 0.996992 | 1.55604 |

`provenance: { heightSource: "carrier", uReliefBakeStrength: 1, uCraterBakeRestore: 0 }` on all four.
Gradient channels nonzero everywhere ⇒ counterexample (c) "the baked gradient was dropped from the
composite" is closed live, not just structurally.

**This is the AC's core indictment answered.** The pre-AC-SAMPLER sampler regressed near R² ≈ 0
against the cube; this reads 0.9975–0.9998 on height and 0.9963–0.9987 on gradient across four bodies.

## L3 — per-term coverage: FAIL ×4, `errors: []` ×4

| run | table | covered | failed |
|---|---|---|---|
| A | 33 | 4 | 29 |
| B | 56 | **23** | 33 |
| C | 34 | 4 | 30 |
| D | 31 | 4 | 27 |

Covered on A/C/D is the *same* four every time: `uCraterDensity`, `uReliefBakeStrength`,
`uRiverCarveDepth`, `uSeaLevel`. Only `enableAllFeatures()` moves the number, and it moves it to 23.

Two facts that constrain any explanation:
- **`uTectonicGrainStrength` = 1 on run A and fails, but is COVERED on run B.** Same body, same
  radius, same seeds. So something `enableAllFeatures()` changes makes the grain reach `h`.
- **On run C, `uGlacialAmp` = 0.06 and `uSubAmp` = 0.1 with `uFrostLocked` = 1** — the mandatory
  tidally-locked state whose glacial/sublimation combiners read `vSubstellarAngle` upstream of every
  tap — and **both still fail to move the tap.**

## L4 — gradient vs derivative: never passes; **returns nulls on 2 of 4 runs**

| run | floor R² | real R² | mutant R² | separation | floorFraction | threshold | pass |
|---|---|---|---|---|---|---|---|
| A | 0.962247 | 0.823375 | 0.800205 | 0.0232 | 0.855679 | 0.481124 | `false` |
| B | 0.962247 | 0.206466 | 0.184120 | 0.0224 | 0.214566 | 0.481124 | `false` |
| C | 0.882491 | 0.671365 | 0.635320 | 0.0361 | **`null`** | **`null`** | **`null`** |
| D | 0.871084 | 0.702358 | 0.670467 | 0.0319 | **`null`** | **`null`** | **`null`** |

Two separate problems, and they must not be merged:

1. **Separation from the `gradBase` mutant is 0.022–0.036 in every configuration.** `l4Verdict`
   (fieldSampler.js:716-736) requires `minSeparation = 0.1`, so `separated` is false on all four bodies
   and the leg reports `weak: true` rather than passing. The leg exists to go clearly red against that
   mutant (plan §8 counterexample (b)) and on this evidence it cannot discriminate it at all.

2. **The nulls on runs C and D are NOT a code defect — they are the designed `floorUnusable` branch,
   and what they report is worse than a bug.** `L4_FLOOR_MIN_R2 = 0.9` (fieldSampler.js:714): if the
   TAP_COMPOSITE calibration floor comes back below 0.9 the leg declares its own *probe* broken and
   returns `pass/floorFraction/threshold = null` with a `reason`, deliberately refusing to render a
   verdict on a number it cannot interpret. Floor R² was **0.882491 (Eyeball)** and **0.871084
   (Europa)** — both under the bar — versus 0.962247 on Rocky.

   So the leg is behaving exactly as designed and telling us something true: **the epsilon-triplet
   probe fails its own calibration on two of four bodies.** The composite relation is exact by
   construction, so per the leg's own comment (fieldSampler.js:702-703) a floor materially below 1
   means "the epsilon, the readback or the probe geometry is wrong." Note Rocky's 0.962 only just
   clears the bar, so the probe is marginal everywhere and fails outright on two bodies.

   *Correction to an earlier reading in this evidence set:* the nulls were first characterised as a
   reproducible unhandled branch. They are not — the branch is documented and intentional. The thing
   to fix is the probe's calibration, not the null handling.

## L5 — vertex-plumbing parity: **PASSES on C and D, fails on A and B**

| run | pixels | slope | R² | rms | maxAbs | `fadeGap.rms` | pass |
|---|---|---|---|---|---|---|---|
| A Rocky preset | 191 | 1.00069 | 0.985863 | 2.480e-2 | 0.342773 | 0 | `false` |
| B Rocky all-features | 191 | 1.00197 | 0.983746 | 2.899e-2 | 0.360480 | **0.035116** | `false` |
| C Eyeball | 191 | 0.998982 | **0.996774** | 2.250e-3 | 0.030762 | 0 | **`true`** |
| D Europa | 191 | 0.999715 | **0.999611** | 7.738e-4 | 0.007000 | 0 | **`true`** |

**The plumbing is not broken.** It reads R² 0.9996 on Europa. The residual orders monotonically with
how rough the body's field is — Europa (7.7e-4) < Eyeball (2.2e-3) < Rocky preset (2.5e-2) < Rocky
all-features (2.9e-2) — and `maxAbs` tracks it (0.007 → 0.031 → 0.343 → 0.360), with `maxAbs` always
≫ `rms`, the signature of a few outlier pixels rather than a bias.

This reframes the leg's own PASS bar. The plan bounds `rms` by the **sphere tessellation chord sag**
(7.5e-5 for a 2π/256 longitude step) — a purely *geometric* number. But what a mesh vertex can miss is
how much the *field* varies across one cell, which is a property of the body, not of the sphere. On
that reading the correct bound is body-dependent and the fixed R² > 0.99 bar is the wrong instrument.
**Not yet established** — it is the leading hypothesis and it needs the per-pixel residuals L5 does
not currently expose.

`slope` is 0.999–1.002 on all four runs: there is no systematic scale error anywhere.

`fadeGap` is exactly 0 on A, C and D and 0.035 rms / 0.229 maxAbs on B. So pinning octaves costs
nothing except when all features are enabled. That is the number the plan required be *reported*
rather than argued.
