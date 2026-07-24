# S2 VERDICT — perceptual read-gate #1 (flip alone)

**Date:** 2026-07-24 · **Tree:** `feature/world-engine-production-L1` @ `5f4fb22` (S1 committed; the budget IS the flip — no toggle) · **Protocol:** `calibration/read-gate-thresholds.json`, FROZEN at the S0 seam, applied without modification (`feedback_perceptual-read-gate-before-uat`). Drive: workflow `wf_4c7007a1-d92` (capture → arc/reference/blind in parallel) + an in-session blind-read re-run (see Contamination). Evidence: `evidence/S2/`.

## VERDICT: **TEXTURE-FAIL → S3 fires (diagnose-first, R4)**

Two of the three frozen bars fail as frozen. Recorded whichever way it fell; no threshold was
re-chosen, relaxed, or re-tagged after any render was viewed.

| Bar | Frozen requirement | Result | Verdict |
|---|---|---|---|
| (i) arc-asymmetry | ≥70% of ≥-median lit-disc stamps show ≥1-posterize-band light-consistent wall asymmetry (probe centres, staged light) | seed-1 **0.10**, re-rolls **0.17 / 0.24** | **FAIL** |
| (ii) blind read | forced-choice 3/3 correct (PRIMARY) AND captions ≥2/3 vocab (corroborating) | captions **3/3** PASS; forced-choice **2/3** | **FAIL** |
| (iii) surface-class | same class as relief-dominated reference, read off density+texture | LOLA LDEM_16 hillshade @ matched az/el: **PASS (qualified)** | PASS |
| (iv) full-phase control | filed, not scored | `control-fullphase.png` filed | — |
| (v) crispnessRatio | diagnostic-only, never a gate | not computed this gate | — |

## Staging facts

Light az 40.6° / el 20.79° (frozen values == lab boot defaults, verified + explicitly re-set per
capture); posterize 6, pixelScale 3, spin 0; disc ≈70% viewport. **R3 is live:** the lab drew
Moon/Mercury radii 0.273 (seed 1) / 0.341 / 0.367 (🌍 re-rolls) — so nStamp is 165/153/149, not the
frozen file's canonical-radius 147. Bar values are population-fraction-based; unchanged. seed-1's
recorded macroSeed=1 is the lab boot value (not the `'draw:macro:'` derivation); the arc harness used
recorded macroSeeds throughout (matches the rendered fields — projection self-test 0 px residual,
overlay correlates with rendered craters). Console clean. Capture page closed.

## Contamination adjudication (blind read)

The first blind run (workflow stage) used **full-viewport screenshots with the lab GUI visible** —
the preset name ("Moon/Mercury (impa…") is legible in-frame, and one forced-choice agent's stated
reason cited the preset label. **That run is INVALID and is not evidence** (its raw outputs: captions
3/3, forced-choice 3/3 — discarded). The bars were re-run on disc-only crops (`evidence/S2/blind2/`,
GUI excluded, same pixels otherwise) with 6 fresh sonnet agents and new shuffles:

- **Captions (3/3 vocab hits, PASS as corroborating):** all three independently open with "heavily
  cratered" and describe overlapping impact craters, varying sizes, no atmosphere.
- **Forced-choice (2/3, FAIL vs the all-3 rule):** set1 (target=seed1) ✓; set3 (target=reroll2) ✓;
  set2 (target=reroll1) ✗ — the agent picked the **Europa distractor** ("densely overlapping field of
  circular rimmed depressions") and read reroll1's mottled palette patches as "continent-like
  landmasses". Answer keys: set1=C, set2=A, set3=B; picks C/D/B.

## Surface-class detail

Primary reference acquired live: **LRO LOLA LDEM_16** (16 px/deg global DEM, PDS Geosciences Node,
`lro-l-lola-3-rdr-v1/lola_gdr/cylindrical/img/ldem_16.img`, 33,177,600 bytes,
md5 `87d937cf968462a61043e1e5b3166d65` — raw .img kept on disk, NOT committed; re-fetch by that path;
`reference-hillshade.mjs` reproduces the hillshade from it). Lambertian hillshade at az 40.6/el 20.79
(z=1, untuned), farside southern-highlands crop, same posterize-6/×3 pipeline. Verdict: **same
surface class, heavily cratered — PASS (qualified)**: morphology + size-frequency spread match;
local saturation in pockets; the honest reservation is non-uniform full-disc density (sun-facing
expanse reads relief-smooth; partly a sphere-lighting confound absent from a flat hillshade, partly
genuinely fewer craters there). Decisively not a sparse dimpled sphere.

## darkClip re-baseline (executed per the frozen resolutionPath)

darkClipFrac1 = {0.0364, 0.0276, 0.0399}, mean 0.0347, σ 0.0052; toleranceFrac = max(2σ, dither
floor) = **0.1444** — replaced the 0.01 GUESS in `read-gate-thresholds.{mjs,json}` (status DERIVED,
caveat recorded: the dither floor dominates and makes the guard loose; NOT re-tightened — that would
be post-hoc tuning; lit-only diagnostic alternative in `arc-report.json`).

## What the diagnostics say (S3 seed — NOT the bar)

The failure pattern is informative and mildly paradoxical, which is exactly what S3.a must resolve:

1. **The crater READ is present at the gestalt level** — 3/3 clean captions say heavily cratered;
   2/3 forced-choice correct; the reference read is same-class. Max's Inc-3 complaint ("looks the
   same / venus plateaus") is visibly addressed by the S1 flip.
2. **The measured per-stamp wall shading is weak:** after removing the verified sunward-brighter
   global disc gradient, ≥-median stamps carry a correct-signed but **sub-1-band mean** wall
   asymmetry (~0.6–1.25 lum vs the 42.5 required); a peak/percentile metric reaches ≥1 band on
   80–91% of stamps vs 9–12% on a flat-terrain control.
3. Candidate explanations for S3.a to discriminate with the θ_wall ≷ θ_floor inequality (per plan —
   no conviction is being pre-chosen here): content (sub-floor wall subtenses), instrument-display
   (bake/posterize eating resolvable walls), and the frozen metric's own acknowledged limitations
   (the gradient confound; the GUESSED ≥-median size gate, whose recorded resolutionPath is the
   exact θ_wall ≥ θ_floor partition).

**Next per BUILD-PLAN §1.S3:** S3.a diagnosis FIRST (geometric inequality, measured deficit-split,
`S3-DIAGNOSIS.md`) — then a fix only at the convicted layer. Legacy-F2 adoption is NOT pre-authorized.
