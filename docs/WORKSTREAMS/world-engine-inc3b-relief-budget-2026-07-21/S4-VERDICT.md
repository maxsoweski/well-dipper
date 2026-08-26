# S4 VERDICT — read-gate #2 (post-fix) + re-roll evidence + ride-alongs

**Date:** 2026-07-24 · **Tree:** post-S3-fix + boot-enable fix · **Protocol:** the SAME frozen
`calibration/read-gate-thresholds.json` (no threshold touched since the S0 freeze except the darkClip
GUESS→DERIVED replacement executed per its own frozen resolutionPath at the S1 seam). Drive: workflow
`wf_5308c6e5-179` + in-session boot-enable fix + live re-verify. Evidence: `evidence/S4/`.

## Bars at the frozen thresholds

| Bar | S2 (flip alone) | S4 (flip + synth band) | Verdict |
|---|---|---|---|
| (i) arc-asymmetry (≥70% of ≥-median stamps ≥1 band) | FAIL 0.10/0.17/0.24 | **FAIL 0.10/0.25/0.097** (seed-1 identical — fixed geometry) | FAIL, **as diagnosed** |
| darkClip regression guard | (re-baselined) | **PASS** ×3 (growth ≤ 0.0034 ≪ 0.1444) | PASS |
| (ii) blind read — captions (corroborating) | PASS 3/3 | **PASS 3/3** | PASS |
| (ii) blind read — forced-choice (PRIMARY, null 0.0156) | **FAIL 2/3** | **PASS 3/3** | **PASS — the S2 failure mode is gone** |
| (iii) surface-class vs LOLA hillshade | PASS (qualified) | **PASS (qualified)** — same class; reference still ~2.4× denser local structure | PASS qualified |
| (iv) full-phase control | filed | filed (near-featureless, honest pre-albedo state) | — |
| (v) crispnessRatio | diagnostic-only | not computed (never a gate) | — |
| AC-REROLL (headless harness) | — | **ALL GREEN** (`calibration/inc3b-reroll-sweep.mjs`, deterministic ×2) | PASS |

**Overall adjudication:** the perceptual crater read is **PRESENT in the evidence** — the PRIMARY
statistical discriminator (forced-choice) now passes 3/3 where it failed at S2, all captions read "heavily
cratered," and the surface-class verdict holds. The arc bar's failure is **fully diagnosed, adversarially
verified, and empirically falsified against every display-side remedy** (S3-DIAGNOSIS.md + falsifier): the
≥-median *stamped* walls are sub-mesh; that residual is quantified and routed forward, not hidden. Per
`feedback_perceptual-read-gate-before-uat` this is a presentable state: the evidence shows the read present
with a documented residual — Max rules.

## AC-REROLL detail (measured, not promised)

Layout variety across 3 macroSeeds: near-disjoint stamp sets (Jaccard ≈ 0), nearest-centre displacement at
the crater-spacing scale — the robust signal. Largest-basin 3-seed spread **536 km measured** vs the
truncated-SFD expectation (1σ = 434 km, E[spread] = 745 km) — reads "visible," with the recorded caveat
that drawn-radius covariance (R3 live) contributes alongside macroSeed. Radius draws 0.273/0.289/0.306 all
in [0.27,0.38] and vary; flagless callers stay canonical (asserted). Seeded `craterOffset` reproduced
bit-for-bit headlessly AND observed moving on both live 🌍 re-rolls. Stamped-count R-invariance
(147=147) stated as a mesh-floor instrument limit. Frozen radius rider evaluated per the frozen spec's
authoritative observable (see harness concerns for the archetype-band footnote).

## Ride-alongs (AC-MARS — presented, never silently shipped)

`mars-after.png` / `crystal-after.png` at the staged light + `*-synth-off.png` A/Bs. **Labeled honestly:
these are synth-channel A/Bs of the current tree, NOT before/after** — the S1 budget cannot be toggled live
and no pre-inc3b Mars/Crystal captures exist (S2 targeted Moon/Mercury). Mars leaf f_I = 0.4262 ∈ [0.3,0.8]
(AC-MARS gate, eroded-endo extension). Crystal f_I 0.7526; its w_i (~370–396) sits nearest the ε clamp —
flagged for observation across re-rolls.

## Boot-enable fix (post-workflow, this seam)

The S4 capture agent found `applyWorldDefaults` cleared `cratersEnabled` on plain preset selection (legacy
rendersOn defaults; the name-add is barred) — the synth band never rendered without a manual toggle. Fixed
in `worldDefaultEnableSet` (condition-derived enable via `craterRelevanceOf` at canonical radius) and
**live-verified without forcing**: Moon/Mercury boots armed (uCraterDensity 0.604, corrected amp 0.0061),
Venus cleared, Rocky enabled-but-invisible (density 2.2e-5). `boot-enable-fix-moon-seed1.png` filed.

## UAT recipe (pinned — Max's gate, no agent closes it)

1. `cd ~/projects/well-dipper && npm run dev` → open the lab (currently :5175) `world-engine-lab.html`.
2. Preset **Moon/Mercury (impact-airless)** — craters are ON by default now (no toggles needed). Sun stays
   at the boot az 40.6°/el 20.79° (the frozen staged light — don't move it for the judged look; moving it
   to full-phase shows the honest near-featureless pre-albedo state, filed as the control).
3. Zoom until the disc fills ~70% of the view. Judge: does a small airless world read cratered — stamped
   basins + the new fine crater texture between them?
4. Press 🌍 **"New planet (re-roll both)"** ×3 — layout, radius (0.27–0.38 draws), and the fine-texture
   field should all visibly change. (🎲 reroll-radius alone is NOT the variety control.)
5. **Frozen (airless)**: expected near-Moon/Mercury statistically (the honest AC-FROZEN finding —
   distinctness = ice substrate + palette this increment).
6. Ride-alongs **Mars** + **Crystal**: presented for acceptance, not silently shipped (R1).
7. Known-deferred, on record: stamped-crater wall shading at oblique light (the arc-bar residual,
   BUILD-NOTES); ejecta/albedo/bright rays (exogenic increment); ejecta synth stays opt-in off.
