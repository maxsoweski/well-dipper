# S3-DIAGNOSIS — content vs instrument (adjudicated gate record)

**Date:** 2026-07-24 · **Tree:** `feature/world-engine-production-L1` (post-S2 `67da16e`) · **Harness:**
`evidence/S3/s3-diagnosis.mjs` → `s3-diagnosis-report.json` (deterministic, exit 0) · **Process:** workflow
`wf_af559d0c-85b` (diagnose → 2 adversarial lenses × 3 rounds, 2 fix rounds) + main-session adjudication.
Frame: systematic-debugging Phase 1 (evidence at every chain boundary) — **no fix was built in this slice.**

## VERDICT: **MIXED — CONTENT-DOMINANT, with a real instrument residual**

Partitioning every failing lit-disc stamp (156 across seed 1 + 2 re-rolls) by whether its wall annulus
(θ_wall = δ/4, from the shipped craterProfile geometry) is spatially resolvable by the mesh/bake:

| Discriminant floor | θ (deg) | Deficit owned by CONTENT (sub-floor walls) |
|---|---|---|
| S0.5 display floor (posterize band-carrying) | 0.37 | 0% — **tautological, rejected as discriminant (see Deviation)** |
| mesh 1-sample (40k vertex spacing) | 1.0155 | 40% |
| bake 1-texel pitch (256²/face) | 1.11 | 53% |
| mesh Nyquist (2 samples) | 2.03 | 85% |
| bake Nyquist (2 texels) | 2.22 | **88%** (resolvable residual 12.2%) |

- **CONTENT (majority owner):** the stamped craters' wall annuli (median 1.04–1.16°, minimum 0.79°) are
  ~one bake texel wide — the 256²/face cube + 40k mesh **cannot spatially represent the wall slope** for
  most of the population. This is the plan's own content branch ("the wall falls below what any N can
  resolve at this mesh → unresolvable-at-N"), landing there by the inequality as MF-3 specified. Note the
  nuance vs the plan's imagined case: it is not only the sub-133 km texture band that is missing — the
  *stamped* ≥133 km craters' **walls** are themselves sub-sampling features at current resolution (their
  bowls survive as soft dimples, which is why the gestalt blind read passes while the arc bar fails).
- **INSTRUMENT (real minority residual, not sub-splittable headlessly):** fully-resolvable walls still
  under-deliver — the seed-1 625 km basin (wall far above every floor; carrier tilt ≈66° pre-clamp) reads
  12.95/255 detrended on screen, under the 42.5 one-band bar; peak-metric residual loss ≈7.3×. The
  co-owners — bake sub-texel arc-smear ⊕ display shading scale ⊕ frozen-metric dilution (the MEAN
  half-annulus averages away thin arcs the PEAK diagnostic sees on ~80% of craters vs 11% flat-control) —
  **cannot be separated headlessly** (the 256²/face bake is a GPU CubeCamera raster; the S0.5 box model is
  a stand-in, flagged not hidden).
- **Carrier data: signal PRESENT.** Median wall slope 3.65 relief-units/rad (implied pre-clamp tilt ~72°)
  in the composited, budget-weighted field — the S1 flip delivered the relief; absence-at-source is
  excluded. (Read off the un-saturated slope; the Lambert asymmetry ceiling saturates, stated honestly.)

## Deviation of record — the S3.a discriminant floor

BUILD-PLAN §1.S3.a named the S0.5 θ_floor (0.37°) as the discriminant. Measured fact: D_FLOOR truncation
puts every stampable wall at ≥0.79° = 2.1× that floor, so "θ_wall ≥ θ_floor for 100% of stamps" is **true by
construction** — a constant-true gate, exactly the R4/MF-3 defect class (a discriminant that presupposes its
answer; the v1 run of this very diagnosis produced that artifact and was overturned by the adversarial
lenses). Adjudication: the S0.5 number is a **luminance** floor (can a resolved full-contrast wall carry ≥1
posterize band — valid for what it models); the spatial question ("can the mesh/bake represent this wall")
requires the **sampling** floor derived from the actual grids. Both floors now live in the record, results
**bracketed across the full ladder** above so the conviction does not ride a single floor choice. Content is
material at the most conservative spatial floor (40%) and dominant at Nyquist (88%); the verdict is stable
across the bracket.

## Assumptions + honesty notes

`perturb=0.55` reconstructed from the lab default (the capture state.json omits it) — carrier magnitudes
scale ~linearly with it; cannot flip the verdict (the split is geometry-only and the residual has ~2 orders
of headroom). The v1→FIX-R2 history, the lens findings, and one lens's procedural note (it overwrote the
committed report before backing it up; the artifact is deterministic, re-run byte-identical, so benign) are
preserved in the workflow record. The stale v1 draft (`S3-DIAGNOSIS-DRAFT.md`) and a stale v1 literal in the
script's emitted note were removed/corrected at this adjudication seam — this document supersedes both.

## S3.b — what happens next (fix at the convicted layer ONLY, after the falsifier)

The conviction is mixed, so the **binding** constraint is determined empirically before any fix is built —
a GPU-in-loop falsifier on the live lab (the headless harness cannot separate the instrument co-owners):

1. **Bake 256→512/face A/B** at identical staging — if the wall arc appears, the sampling floor is binding
   (content mechanism: raise sampling and/or add a sub-sampling-scale crater-texture channel).
2. **Posterize-off A/B** — if the arc appears, quantization is binding.
3. **reliefAmp step A/B** — if the arc appears, effective shading scale is binding.
4. None of the above → carrier→cube gradient packing convicted.

Fix candidates map per outcome: sampling-bound → rendering-scale fix (bake/mesh resolution — explicitly
in-domain per Max's R4) and/or the peppering path **with the mandatory riders** (condition-derived relevance
gate re-derived from scalars — `craters.rendersOn` name-add BARRED; envelope-free `uCraterAmp`;
worldSeed-seeded `craterOffset`; single density law; provinceWeight decision; `regolithRoughness` plumbing).
**Legacy-F2 adoption is NOT pre-authorized** (Max decision #4 mechanism applies only as the diagnosis-backed
substitution). Metric-dilution findings route to the frozen sizeGate's own recorded resolutionPath at S4
re-freeze — never silently.

---

## ADDENDUM 2026-07-24 — S3.b falsifier RUN: final conviction **CONTENT (mesh-level sub-sampling)**

Falsifier executed live (workflow `wf_b617a430-b47`; evidence `evidence/S3/falsifier/`; control condition
reproduces the S2 seed-1 measurement EXACTLY — 0.10 = 3/30, largest-basin raw 11.25 in [11,13] — so the
deltas are interpretable). One knob per condition at bit-identical staging:

| Condition | Δ median detrend (/255) | Δ median peak | Δ largest-basin detrend | Reading |
|---|---|---|---|---|
| bake 256→512 | +0.09 | 0.00 | +0.06 | flat within noise |
| bake 256→1024 | +0.09 | −0.11 | +0.07 | flat at 4× — **bake falsified as binding** |
| posterize 6→16 | +0.65 | −2.03 | −0.52 | nudges mean, drops peak, unlocks nothing |
| perturb ×2 | +1.18 | +4.79 | +2.00 | the only coherent lift — governs the resolved residual |

**Key mechanism finding:** bake 512/1024 provably re-rasterized the frame (0.30/0.33% pixel change) yet
recovered no wall slope — because the walls are **sub-MESH (40k vertex spacing 1.02°)**, not merely
sub-bake-texel: more bake texels cannot carry slope the mesh never held. And the hard ceiling: every knob's
movement is ~10× below the 42.5 one-band bar (perturb ×2 leaves the frozen fraction at 0.13 vs 0.70) — **no
display-side knob unlocks the walls.** The instrument residual is real but shading-scale-governed and small;
the deficit majority is content in the strict plan sense: the crater-wall texture band is unresolvable at
this mesh/display scale.

**CONVICTED LAYER → FIX (S3.b build): the peppering path** — the in-shader analytic crater-texture channel
(fragment-shader synthesis is resolution-independent, bypassing mesh and bake sampling entirely), per Max
decision #4 (F2-adapted as the diagnosis-backed substitution), carrying ALL mandatory riders enumerated
above. Display/bake/mesh resolution changes are NOT part of the fix (falsified / not binding). The
diagnosis-instrumentation `__reliefBakeSize` override stays in `planet-lod-rivers.js` (guarded, unset in
production/headless; full suite at the 4-failure baseline with it in place) — it is the falsifier's
committed apparatus, and S4's re-gate can reuse it.
