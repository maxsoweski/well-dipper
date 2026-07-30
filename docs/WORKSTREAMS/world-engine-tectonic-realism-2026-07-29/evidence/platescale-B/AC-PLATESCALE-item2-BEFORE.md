# AC-PLATESCALE item 2 — the display law, measured live BEFORE any source edit

**Date** 2026-07-29 (session C) · **Branch** `feature/world-engine-production-L1` · **HEAD at capture** `ab89388`
**Ruling being executed** Max chose **outcome B — remove the law**, over outcome A (name + derive it),
2026-07-29. This file is the BEFORE half of the evidence for that edit. **No source file was changed to
produce any capture here.**

**GPU of record** `ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)`,
vendor `Google Inc. (NVIDIA)`, Chrome 150, WebGL2, `highp` fragment precision 23, DPR 1.25,
drawing buffer 1750×1377. Same GPU as every prior measurement filed in this workstream.

---

## 1. What the law is, confirmed against the running renderer

`uniforms.uDispDomainScale.value = sVis` (`planet-lod-lab.html:5976`) — the single writer — feeds three
sites in the shared height GLSL:

| site | what it scales |
|---|---|
| `planet-lod-height.glsl.js:641` | `pos *= uDispDomainScale` in `computeHeight` |
| `planet-lod-height.glsl.js:765` | `freq = uNoiseScale * 0.3 * uDispDomainScale` (macro FBM base freq) |
| `planet-lod-height.glsl.js:850` | `pos *= uDispDomainScale` in `initProvinces` |

`sVis = R^VIS_SCALE_EXP` with `VIS_SCALE_EXP = 0.5` (`planet-lod-lab-core.js:45`), a **camera-framing**
constant chosen so the 0.3–16 R⊕ span fits a fixed camera (`planet-lod-lab-core.js:42-44`). Angular
feature wavelength therefore goes as **θ ∝ R^-0.5**, and since feature count over a sphere goes as
1/θ², **N ∝ R^1** — the "exponent 1". The literature ruled in `amendments[1]` gives **N ∝ R^-0.07**,
i.e. exponent 0. Nobody chose the 1; it is `VIS_SCALE_EXP` doubled by the 1/θ² relation.

**Live confirmation of the uniform chain** (Rocky (Earthlike), macroSeed 1, radiusSeed 1):

| R | sVis | `uDispDomainScale` |
|---|---|---|
| 1 | 1 | 1 |
| 4 | 2 | 2 |
| 16 | 4 | 4 |

---

## 2. The crossover hands the whole upper band to the invented body

`bakeReliefCrossover(sVis)` (`planet-lod-lab-core.js:125-131`) at `BAKE_CROSS_SPAN = 1.0` is fully faded
by `|log2 sVis| = 1`, i.e. **R = 4**. Measured on the running page, after letting `frame()` settle and
*then* re-running the router against the settled uniform:

| R | sVis | effective `uReliefBakeStrength` | `uCraterBakeRestore` | renderer draws | router `heightSource` |
|---|---|---|---|---|---|
| 1.0 | 1.000000 | **1.000000** | 0.000000 | baked×1.000 + synth×0.000 | `carrier` |
| 1.5 | 1.224745 | 0.793405 | 0.206595 | baked×0.793 + synth×0.207 | `carrier` |
| 2.0 | 1.414214 | 0.500000 | 0.500000 | baked×0.500 + synth×0.500 | `carrier` |
| 3.0 | 1.732051 | 0.111319 | 0.888681 | baked×0.111 + synth×0.889 | `carrier` |
| 4.0 | 2.000000 | **0.000000** | 1.000000 | **pure synth** (else branch, no cube fetch) | `sampler` |

`uReliefBakeStrength + uCraterBakeRestore = 1.000000` at every row — the crater-restore complement
(`planet-lod-lab.html:5998`) holds exactly, so craters are not being deleted at any radius sampled.

Two things follow, both of which matter beyond item 2:

**(a) R = 4 → 16 is governed 100% by the display law.** The baked (exponent-0, literature-correct) body
contributes exactly nothing above R = 4. Three quarters of the slider band is the invented exponent.

**(b) AC-ONEBODY is a property of the crossover band, and it is now quantified.** In `1 < R < 4` the
renderer draws a *blend* while the router must pick *one* source, and it picks `carrier` — the pure
baked body — for the whole band. The disagreement is largest at **R = 3, where the router routes rivers
onto a body contributing only 11.1% of what is drawn.** At R = 1 and R ≥ 4 the two agree. So removing
the crossover collapses this band to nothing and closes the split as a side effect rather than as a
separate fix.

> ⚠ **Correction recorded so it is not re-derived wrongly:** reading `heightSource` *before* letting
> `frame()` settle returns `carrier` at R = 4 and R = 16, which looks like a renderer/router split at the
> top of the band. It is not — it is a stale read. Settled, the router follows the uniform to `sampler`
> and the two **agree** there. The real split is the blend band above.

---

## 3. The law isolated — single-variable A/B, no source edit

The naive R = 1 vs R = 16 comparison confounds **two** variables: body source (baked → synth) and domain
scale (1 → 4). To isolate the law, the body was pinned constant (pure synth + craters fully restored) and
only `uDispDomainScale` varied, using the accessor-redefinition technique from session B (`get`/no-op
`set` on the uniform's `value`, so the frame loop cannot overwrite it — JS only, cannot perturb GLSL
compilation).

| file | R | `uDispDomainScale` | `uReliefBakeStrength` | md5 |
|---|---|---|---|---|
| `AB-R1-lawON-disp1.png` | 1 | 1 (= sVis) | 0 (pinned) | `074861d721028af41f874e6261b158ca` |
| `AB-R1-lawOFF-disp1.png` | 1 | 1 (forced) | 0 (pinned) | `074861d721028af41f874e6261b158ca` |
| `AB-R4-lawON-disp2.png` | 4 | 2 (= sVis) | 0 (pinned) | `75fbd6546126aade4f064f1bf4ebb348` |
| `AB-R4-lawOFF-disp1.png` | 4 | 1 (forced) | 0 (pinned) | `048d2723ba3b4e9e9f1ae409556dd702` |
| `AB-R16-lawON-disp4.png` | 16 | 4 (= sVis) | 0 (pinned) | `f03a8013c57dcbafb3b9c4848557d6ff` |
| `AB-R16-lawOFF-disp1.png` | 16 | 1 (forced) | 0 (pinned) | `4172833b1a9cfa4a20fcc638231cf682` |

Every capture: logical camera distance **3** planet-radii (so `uOctaves = 9` and `uLodRamp = 1` are
pinned across all radii and cannot confound the read), `yaw 0.6 / pitch 0.25`, `levels 6` (shipped look),
`macroSeed 1`, `radiusSeed 1`, animation frozen.

### Controls

- **NULL control — PASS.** At R = 1, `sVis = 1`, so law-ON and law-OFF are the same value. The two PNGs
  are **byte-identical**. This proves both the anchor identity *and* that the A/B mechanism does not
  itself perturb the frame.
- **LIVENESS control — PASS.** At R = 16 the two PNGs **differ**. The comparison responds to the variable.
- **FIDELITY control — PASS, and stronger than planned.** Pinning the uniforms to the values `frame()`
  was already writing reproduces the un-pinned live frame *byte-for-byte*:
  `AB-R16-lawON-disp4.png` ≡ `BEFORE-ld3-R16.png` (`f03a8013…`) and
  `AB-R4-lawON-disp2.png` ≡ `BEFORE-ld3-R4.png` (`75fbd654…`). The pins are faithful, not approximate.

### What the frames show

At R = 16, law ON: roughly 15–20 distinct small dark basins across the visible hemisphere — high count,
each small relative to the disc. Law OFF: roughly 4–5 large features — one dominant ocean, two large
basins, a broad continental mass. Count drops by about the 16× the algebra predicts for a 4× domain
scale (N ∝ disp²), and the structure reads in the same *proportion to the disc* as Earth does, which is
what radius-invariant angular plate structure means.

**This is what outcome B will look like.** It is a preview, not the edit.

---

## 4. Whole-disc context captures

`BEFORE-fixed-R{1,4,16}.png` (fixed camera distance 20, what dragging the radius slider actually does)
and `BEFORE-held-R{4,16}.png` (logical distance held at 20). These are context only — at whole-disc
distance the Rocky Earthlike preset reads as a small mottled dot and no plate structure is legible,
which is itself the AC-HYPSO / AC-PROVINCE gap already filed. The fixed-camera set additionally
confounds LOD: at distance 20 with `planetScale` 2 and 4, `uOctaves` moves 4 → 8.01 → 9 and `uLodRamp`
0 → 0.80 → 1, because distance-in-radii crosses the `lodHysteresis` threshold. **Do not read structure
off the fixed-camera set.** The `ld3` and `AB` sets exist because of this.

---

## 5. Known limitations of this evidence

- `levels = 6` throughout (the shipped look). Correct for visual judgement; **not** valid for any
  sub-1e-5 numeric comparison — that needs `levels = 255` per session B's sensitivity finding.
- Feature counts in §3 are read off the frames by eye, not segmented. They are stated as approximate
  and are not load-bearing; the load-bearing facts are the uniform values and the hashes.
- One preset only (Rocky (Earthlike)), one seed pair (1, 1), one camera orientation. The law is
  preset-agnostic by construction (every preset shares the same `fbmd` body, `planet-lod-lab-core.js:111`)
  but that is an argument, not a measurement.
- The on-screen "✦ current: relief:" summary line lags the uniforms — it refreshes on GUI events, not per
  frame, so in several captures it reads `LEGACY synth (carrier off)` while the uniforms say otherwise.
  **Read the fingerprints, not the panel text.** `carrierOn` is computed at `planet-lod-lab.html:4377`
  from `grainCarveUI.reliefBakeStrength` (the GUI *base*) and `riverOverlay.heightSource`, neither of
  which is the effective uniform.
