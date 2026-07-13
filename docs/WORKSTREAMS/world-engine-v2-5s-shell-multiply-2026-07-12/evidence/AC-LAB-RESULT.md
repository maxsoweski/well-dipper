# AC-LAB — live result (2026-07-13, working-Claude via chrome-devtools)

**Setup:** Max-started dev server `:5175` + debug Chrome `:9223` (still up from the V2-3 UAT
sweep); ONE isolated fresh tab `http://localhost:5175/well-dipper/planet-lod-lab.html`
(isolatedContext, Max's tabs untouched); code at `c24ea37` (V2-5s Slice A+B). Sliders driven
through the REAL lil-gui inputs (`gravity (g)` / `tidal heat` / `surface temp (T_surf K)` — the
free lever, no new plumbing), settle confirmed per change by polling `_lab.state._lastBodyDrivers`
identity. Observables from `_lab.shellProbe()` (std(U) computed in-page over the probe's U array).

## Europa (icy-active) — default page seed, reliefBakeStrength 1

| Step | State | appliedTune | linN | cellCount | std(U) | varStress |
|---|---|---|---|---|---|---|
| 1 TRUE baseline | preset, none touched | **null** | 3935 | 11 | 0.07225 | 0.3987 |
| 2 A1 gravity 0.1 (low) | OVERRIDE (gravity) | RIDGE_AMP **2.3426** (=1.4×(0.1/0.28)^-0.5=1.4×1.673) | 3935 | 11 | **0.12081 ↑** | 0.3994 |
| 3 A1 gravity 1.5 (high) | 〃 | RIDGE_AMP **0.6049** (=1.4×0.432) | 3935 | 11 | **0.03140 ↓** | 0.3939 |
| 4 A2 tidal 0.005 (down) | +tidal touched | CREST_THRESH **0.985** (=CREST_HI at tidalDev −1) | **964 ↓** | 11 | — | — |
| 5 A3/A4 T_surf 250 K (warm) | +tsurf touched | CELL_MIN **9→17**, CHAOS_THRESH **0.6→0.3** | — | **11→19 ↑** (Δ8 = the calibration number exactly) | — | — |

- A1 correct-sign both directions, amplitude-only (linN/cellCount/varStress untouched at both
  extremes — the blast-radius property visible live); std(U) ratio across the slider range 3.85.
- A2 correct-sign down on Europa (tidal↑ unreachable on Europa by design: REF 136.7 ≫ slider max
  1.0 — flagged in the plan; the ↑ direction is demonstrated on Titan below; surface to Max at UAT
  if he wants Europa tidal-up live).
- Screenshots: `AC-LAB-01-europa-baseline.png` … `AC-LAB-05-europa-warm-250K.png`.

## Titan (volatile-cold) — second regime about its own REF

| Step | State | appliedTune | linN | cellCount |
|---|---|---|---|---|
| 6 TRUE baseline (real preset change → overrides reset) | "override (none touched = preset)" | **null** | 3948 | 11 |
| 7 A2 tidal 0.8 (up; Titan REF 1.6e-8 ≪ slider) | OVERRIDE (tidal) | CREST_THRESH **0.85** (saturation value, documented) | **9872 ↑** | 11 |

- Screenshot: `AC-LAB-06-titan-tidal-up.png`.

## Gotcha recorded (lab behavior, pre-existing, not a defect)

**Same-preset re-select does NOT reset overrides** — `resetDriverOverrides` runs only when
`_presetChanged` (planet-lod-lab.html:3634). Re-selecting Europa after the A1 sweep left gravity
touched, so step 4's probe carried gravity+tidal together. Evidence unaffected (A1 proved gravity
never moves linN), attribution stays clean per axis; a TRUE reset needs a real preset change
(used for the Titan leg) or a page reload. Same family as the V2-2b-1 thermal-persist gotcha.

## Console + hygiene

Console: **zero errors/warnings** in the isolated tab across the whole drive. The isolated agent
page was closed at the end; Max's tabs untouched.

**AC-LAB: PASS.** Baseline null + per-axis live response in correct directions on two regimes,
via the real sliders, console clean, screenshots archived.
