# Post-Fix Verification — rebase × celestial-motion (2026-05-03)

Companion to `ANALYSIS.md`. Captures the kit-predicate verification of
the fix landed at `97c64e9` per
`docs/WORKSTREAMS/rebase-celestial-frame-fix-2026-05-03.md`.

## Tester verdict

**PASS** at `97c64e9` against ACs #1–#4 (Tester §T1 audit log:
`~/.claude/state/dev-collab/tester-audits/rebase-celestial-frame-fix-2026-05-03.md`).
Tester ran 3 independent post-fix captures totaling 11,543 samples;
modal rebase-band violation count: **0**.

## Fix sites

`src/main.js` (3 distinct write sites; moon writes inherit via
`parentPosition`):
- Lines 5998-6006 (binary star1 + star2 per-frame writes)
- Line 6011 (planet per-frame write)
- Line 6058 (planet's moon orbit-line per-frame write — bonus site
  not in brief enumeration; orbit lines must follow rebased planet,
  caught by source-read during implementation)

Each absolute-coord write subtracts `_worldOriginVec.x/y/z` so
positions land in the renderer's rebased frame. Moon position writes
(`Moon.js:589` + `main.js:6042` for planet-class moons) inherit the
fix via `parentPosition` reading the (now-rebased) planet's
`mesh.position`.

## AC results

| AC | Result | Evidence |
|----|--------|----------|
| **#1** `approachPhaseInvariant` regression gate | **PASS** | 0 rebase-band violations across 3 Tester captures / 11,543 samples. Pre-fix baseline: 145 violations. |
| **#2** Distance continuity at rebase events | **PASS** | Tester's RAF-throttled capture max \|Δd\| at rebase = **1.55 units** (9 rebase events). Pre-fix signature: ~99 units. |
| **#3** `worldOrigin` magnitude grows during capture | **PASS** | Tester's capture: `worldOrigin.lengthSq` ended at 13,261,360 (magnitude ~3641 scene units); 9 rebase events fired in 600 frames. Confirms test exercised the bug surface. |
| **#4** Orbital math unchanged (refactor-class) | **PASS by source-read** | Diff is mechanical: 4 single-axis subtracts at 3 write sites at literal `mesh.position.set(...)` argument lists. No upstream-of-write-site edits that the brief's frozen-input harness was designed to catch. Tester confirmed declined-harness call. |
| **#5** This document | DONE |

## Numerical comparison

| Metric | Pre-fix (ANALYSIS.md) | Post-fix (Tester capture) |
|--------|---------------------|---------------------------|
| `approachPhaseInvariant` violations | 145 | 0 |
| Largest distance jump in rebase band (~99) | 99.96 (frame 67) | none |
| Max \|Δd\| at rebase events | 99-100 (rebase signature) | 1.55 (continuous) |
| `monotonicityScore` on relative position | 357 violating spans | 0 |

The bug class (camera-target distance jumping by ~99 units at every
rebase event) is structurally closed.

## Tester non-AC observations

- **`deltaMagnitudeBound` Z-axis 2128 violations** on absolute coords
  is a sub-frame-multi-sample artifact, not a motion bug. The 240Hz
  telemetry sampler fires multiple times per animate frame and
  captures both pre- and post-rebase camera states within a single
  frame. RAF-throttled capture (one sample per `requestAnimationFrame`)
  showed clean continuity at 1.5 units/frame — matches CRUISE
  approach velocity × per-frame interval.
- **Binary path** — Tester declined live exercise (current scene
  non-binary Sol). Source-read confirmed identical per-axis subtract
  pattern at the binary site. If Max wants live binary verification,
  separate request.
- **`fromWorldTrue` vs inline subtract**: implementation chose inline
  subtracts. Brief's Drift Risk #2 (Y-component asymmetry) is
  mitigated — every modified site subtracts `_worldOriginVec.y`
  consistently, satisfying the guard's "OR all three components
  consistently" disjunct.

## Captured artifacts

- `ANALYSIS.md` — pre-fix root-cause analysis with evidence chain
  (frame 67 anatomy, periodic 99-unit jumps, mechanism diagnosis)
- `dogfood-samples-v2-slim.json` — pre-fix baseline capture (5914
  samples, 145 approachPhaseInvariant violations)
- This file (`POST-FIX-VERIFICATION.md`)
- Audit log: `~/.claude/state/dev-collab/tester-audits/rebase-celestial-frame-fix-2026-05-03.md`

## Kit's value proposition validated end-to-end

The motion-test-kit's lifecycle on this bug:

1. **Surfaced** the bug via dogfood (AC #23 of `motion-test-kit-2026-05-02`)
2. **Quantified** the signature (145 violations, ~99 unit jump at every
   rebase event)
3. **Localized** the root cause (4 fix sites in `main.js` + inheritance
   in `Moon.js`)
4. **Verified the fix** (0 violations, 1.55 unit max distance jump)

This is the structural replacement for the toggle-fix workflow's
"recording + working-Claude self-report" loop that missed the bug
class entirely. End-to-end: kit catches the bug, the bug gets fixed,
kit confirms the fix.
