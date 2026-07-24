# BUILD-NOTES — inc3b relief-variance budget + crater legibility

Sliced build S0–S4, 2026-07-24, per BUILD-PLAN (all slices committed at seams; every slice
workflow-built opus-pinned + adversarially lensed + main-session re-verified). This file records the
honest findings and the adjudicated deviations the contract requires.

## AC-FROZEN — the honest Frozen ≈ Moon/Mercury finding (with numbers)

Frozen remains **statistically near-identical to Moon/Mercury this increment, by design**: nStamp 147 = 147
(R-invariant, a mesh-floor instrument limit — stated, not sold as variety); condition-pure model f_I 0.9521
vs 0.9577; both route despun for base terrain. Distinctness this increment = the iceness term in the endo
substrate (σ_endo × (1 − K_IR·iceness), iceness 0.3704 → Λ ≈ 0.19·10⁻³) + palette. The real
differentiators — ice transition-diameter (D_t) physics, bright rims/ejecta/rays — are **deferred to the
exogenic increment** (R2/R4 rulings; already told to Max, not re-promised).

## The frozen variance definition and what "preserved total band" means

Raw-mean-square (V = mean(x²)) — the only definition that reproduces the diagnosis referent (1.139%
crater:base, w_i = 86.48; about-mean gives 65.33). Consequence, measured: the height channel's DC offset
(mean 0.064 ≈ 44% of V_h) means preserving the raw sum lets the **visible about-mean band grow ~+31%** on
budgeted worlds. Adjudicated as the intended legibility effect; definition-dependence disclosed here and in
the statusNote — Max judges the look at UAT.

## The depth-law double-count (caught and corrected at the seam)

The S3-fix builder's first cut set `uCraterAmp = D_D_SIMPLE·δ_char`; the GLSL `craterProfile` already
applies the 0.2 shape depth internally, composing to d/D ≈ 0.04. Corrected to
`(D_D_SIMPLE / CRATER_DEPTH)·δ_char` (CRATER_DEPTH newly exported from lab-core) so the composed on-screen
depth honors Pike exactly once; synth-law worked points re-pinned (×5).

## The stamped-wall residual (open, quantified, routed to Max)

The frozen arc bar FAILS at S4 (0.10/0.25/0.097 vs 0.70) exactly as S3-DIAGNOSIS predicts: the ≥-median
**stamped** craters' wall annuli (~δ/4 ≈ 1°) are sub-mesh (40k spacing 1.02°) — no display knob unlocks
them (falsifier: bake 512/1024 flat, posterize non-binding, perturb governs only a ~12% residual, all ~10×
under the bar). The S3-fix restores the **sub-floor texture band** (the content majority); the stamped-wall
shading residual is a candidate for a future mesh-density or stamped-wall-specific increment — Max rules at
UAT whether the current read suffices. The blind-read bar (the PRIMARY perceptual discriminator) flipped
S2-FAIL → **S4-PASS** with the band in place.

## Adjudicated deviations of record (each surfaced when made, none silent)

1. **T1 (R3 labUnlock):** literal NAMED_BODY removal byte-unsafe → LAB-only opt-in param; spirit preserved.
2. **S3.a discriminant floor:** the frozen S0.5 θ_floor (0.37°) is a luminance floor every stampable wall
   clears by construction — the v1 tautological conviction was overturned by the adversarial lenses; the
   spatial sampling floor was adjudicated in, results bracketed across the full ladder (S3-DIAGNOSIS.md).
3. **darkClip toleranceFrac:** GUESS → DERIVED 0.1444 per its own frozen resolutionPath (loose-guard caveat
   recorded, deliberately not re-tightened post-derivation).
4. **AC-BUDGET harness forward-compat section:** API-adapted to adopted option (ii) + strengthened
   (seam-match assert vs the shipped compositeMargins); pre-budget self-check untouched.
5. **Boot-enable derivation (S4 capture finding):** `applyWorldDefaults` cleared `cratersEnabled` from the
   legacy rendersOn list on every impact preset (the name-add is barred), so the synth never rendered on
   plain preset selection. Fixed: `worldDefaultEnableSet` derives the crater enable from `craterRelevanceOf`
   at canonical radius (timing-safe; live-verified: Moon/Mercury boots armed, Venus cleared, Rocky
   enabled-but-invisible at density 2e-5).
6. **S2 blind-run contamination:** first run had the GUI preset label in-frame → invalidated, re-run on
   disc-only crops; both runs on the record (blind-manifest.json).
7. **Mars/Crystal "before" gap:** the true pre-inc3b before-state was never captured for the ride-along
   worlds (S2 targeted Moon/Mercury only). The committed A/Bs are **synth-on/off toggles of the current
   tree**, labeled so — the S1 budget cannot be toggled live. Stated in the UAT packet, not dressed up.

## Diagnosis instrumentation retained

`globalThis.__reliefBakeSize` (planet-lod-rivers.js, guarded, unset in production/headless) — the S3.b
falsifier's committed apparatus; reusable for future bake experiments.
