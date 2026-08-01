# Live close-out — AC7 cross-system inventory-change sliver @ HEAD `3305297`

Closes the one standing AC7 gap carried as a caveat since the 2026-07-22 close-out:
*"different-inventory system warp not live-driven (AC7 sliver, mechanism proven via
`enterSol` + headless c1–c4)."* Every other AC7 parity observable (hover hit-test,
mode-sync visibility, prox fade, per-frame moon tracking, per-ring colors, dispose)
was already live-PASSed at `47ca81f`; only the **cross-system inventory change** —
a warp to a system with a *different ring count* — had never been driven live.

**MEASURE-ONLY.** No `src/`, test, or lab edits. Branch `feature/supercruise-freelook`,
HEAD `3305297`, game at `http://localhost:5174/well-dipper/` (Max's server), own
isolated page (`isolatedContext=ac7-inventory-drive`), closed at end of drive.

**Autopilot discipline** (`feedback_wd-nav-drives-autopilot-off`): `_lab.stopAutopilot()`
called after every arrival; `_autoNav.isActive === false` confirmed at every measurement.

## Method

Real production warp path, not a synthetic respawn: `window._autoSelectWarpTarget()`
then `window._commitSelection()` — the exact pair the `Space` universal-commit keydown
handler runs (`main.js:10687`) and that the mobile speed-dial WARP button runs
(`main.js:11536`). Sol was the on-ramp ONLY; every measured transition is
**procedural→procedural** (Sol renders through a different path and is not a valid
render subject — `memory/feedback_sol-is-nasa-textured-not-representative`).

**Independent ground truth.** Ring inventory was counted by walking `window._scene`
for meshes on `ORBIT_PROXY_LAYER` (10) with an unbroken visible-ancestor chain — a
different source than the descriptor pass `OrbitConicField.updateFromSystem` itself
walks (`system.starOrbitLines` / `system.orbitLines` / `planets[].moonOrbitLines`).
The field's own count is therefore never its own witness.

## Result — 7 consecutive warps, both directions

| # | system | planets | scene proxies | field `count` | shader `uCount` |
|---|---|---|---|---|---|
| 0 | Sol (on-ramp) | 13 | 39 | 39 | 39 |
| 1 | Polnag-4FQEXDEEBN | 2 | 4 | 4 | 4 |
| 2 | Lugpup-4OYOFEDRNK | 4 | 10 | 10 | 10 |
| 3 | NBG J3EDR1N2-WET9MJ7 | 5 | 10 | 10 | 10 |
| 4 | KRV J3E6GIZI-OHVYBJI | 5 | 11 | 11 | 11 |
| 5 | XND J3DD82CF-2R230UW | 4 | 7 | 7 | 7 |
| 6 | Xogmel-4O7N9SUTD6 | 1 | 3 | 3 | 3 |
| 7 | NBG J3DILSFQ+PRQHUGF | 2 | 2 | 2 | 2 |

- **Shrink** (the dangerous direction): 39→4, 11→7, 7→3, 3→2.
- **Grow:** 4→10, 10→11.
- **Null case:** 10→10 (inventory-size-preserving swap, different systems).
- `sceneProxies === fieldCount === uCount` on **every** row. Scene proxy totals never
  accumulate — a 2-ring system holds 2 proxies, not 41 — so `dispose` leaves no orphans.

## The stale-texel hazard — subject proven present, then excluded

⭐ **A control against an absent subject is not a control.** Before claiming "no stale
rings render," the stale rings were shown to still be *in the buffer*:

- `_source` is 2048 floats = **CONIC_MAX 64 × stride 32**. It is never cleared on swap.
- In the final 2-ring system, **38 entries past `uCount` still held non-zero ring data**,
  indices **2–60**. `readConic(2)` returned **radius 9550.87** — a leftover from a prior
  system — against the live `readConic(0)` radius **1707.07**.
- Exclusion is structural, not incidental: the fragment shader
  (`OrbitConicField.js:177–178`) is a constant-bound loop
  `for (int i = 0; i < 64; i++) { if (i >= uCount) break; … }`.
  `uCount` is rewritten from `count` every frame at `:492`.
- **Rendered confirmation:** `evidence/live-ac7-2ring-after-39ring.png` — exactly **2**
  rings drawn in the final system. Zero ghost rings from Sol's 39.

## Parity survives the swap

Re-checked in the final system, i.e. *after* seven inventory changes — parity was
previously only ever confirmed on a system entered cold:

- Hover hit-test: `userData.orbitHitPositions` present on both rings.
- Per-ring color: both `0x00ff00` (planet class; this system has no moons and no star pair).
- `uOpacity` 0.8, `uVisFactor` 1 — prox/vis channels live.
- Mode-sync visibility via the real `KeyO` toggle: `count` drives **2 → 0 → 2**.

## Console

Zero errors, zero warnings across all 7 warps (`list_console_messages`, filtered to
error/warn/assert/trace).

## Verdict

**AC7-parity-surface — inventory-change sliver CLOSED.** The caveat is retired; it no
longer needs surfacing at Max's AC10 UAT.

## Not exercised (stated, not claimed)

- **CONIC_MAX=64 overflow (R9).** The richest system observed was Sol at 39 rings;
  procedurals ran 2–11. A >64-ring system was not encountered, so the specced
  "drop least-visible sub-pixel moon rings first" degradation remains headless-only.
  This is specced graceful degradation, not a defect, and was never part of the sliver.
- The floor-GPU perf caveat (AC9) is **untouched** by this drive and still stands.
