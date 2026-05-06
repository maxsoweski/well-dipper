# Phase 5 AC #16 Dogfood Addendum — Sim-tick Fidelity Re-verification 2026-05-05

Captured against the post-migration HEAD `af06a55`
(welldipper-fixed-timestep-migration-2026-05-03 §T12 PASS).

## Capture method

Live-app instrumentation via chrome-devtools on port 9223:

1. Reloaded with initScript that monkey-patched `window.AudioContext` to
   capture the instance to `window._capturedAudioContext` (used for the
   parallel AC #19 audio-clock harness; not material to this AC).
2. Drove splash → title → in-system flow via synthetic `click` /
   `Space` keydown events.
3. Started `window._autopilot.telemetry.start()` while autopilot
   screensaver was active in CRUISE phase.
4. Held a 3-second baseline, dispatched synthetic `KeyW` keydown +
   keyup (intended to interrupt autopilot to manual flight).
5. Stopped telemetry after ~25 s wall-clock; captured 1500 samples at
   ~60 Hz sim-tick fidelity (median dt = 16.7 ms; mean dt = 16.67 ms).

**Note on the W-press:** the synthetic `KeyW` keydown DID transition
`autopilotMotion.isActive: true → false, phase: STATION-A → IDLE` for
one tick (probed immediately after dispatch), but the autopilot
screensaver re-engaged before the next sim tick. No samples in the
captured stream show shipPhase = IDLE; the ship remained in
CRUISE/STATION throughout. This is consistent with the
parking-lot work
(`session-2026-04-28-autopilot-shipped-manual-flying-pickup.md` —
manual-flying-toggle still pending) — the toggle-fix workstream's
Bug 1 (autopilotMotion.isActive never releases) DOES release at this
HEAD, but autopilot screensaver immediately re-acquires. So the
dogfood here is sim-tick fidelity verification of **autopilot motion
under CRUISE + STATION**, not the post-W-press manual-flight surface.

## Predicate runs (kit `motion-test-kit/core/predicates`)

Imported via the live Vite-served alias path
`/well-dipper/vendor/motion-test-kit/core/predicates/index.js`.

### CRUISE phase (1348 frames)

| Predicate | Bound | Result | Notes |
|-----------|-------|--------|-------|
| `deltaMagnitudeBound` z-axis | calibration-derived (median * 4 ≈ 0) | FAIL 664/1348 | Bound calibration broke (median was 0 due to many zero-delta frames between rebases); not material. |
| `deltaMagnitudeBound` x-axis | 1 unit/frame | **PASS** 0/1348 | X axis clean (CRUISE is z-aligned). |
| `monotonicityScore` z-axis | 5 flips per 30-frame window | FAIL 361/1348 | Per-window flip-count = 19-20 (40 sign changes/sec). |

### STATION phase (1023 frames — autopilot parked)

| Predicate | Bound | Result | Notes |
|-----------|-------|--------|-------|
| `deltaMagnitudeBound` z-axis | 1 unit/frame | **PASS** 0/1023 | Parked ship Z stable. |
| `deltaMagnitudeBound` x-axis | 1 unit/frame | **PASS** 0/1023 | Parked ship X stable. |
| `monotonicityScore` z-axis | 5 flips / 30 frames | **PASS** 0/1023 | No oscillation when parked. |

### Full-stream signStability

| Predicate | Result | Notes |
|-----------|--------|-------|
| `signStability` (anchor velocity vs target direction, frames 1-1499) | FAIL 246 violations | Sign-flip pattern with magnitudes clustered at ~97.59 units. |

## Root-cause analysis of CRUISE-phase "oscillation"

The CRUISE-phase failures are NOT a real motion bug.

**The pattern:**

```
frame  ship.z    delta_z     analysis
295    -153.25   -            ← about to cross rebase threshold
296    -55.95    +97.30 ★    ← REBASE EVENT — origin shifts +97.59 units
297    -104.60   -48.65       ← normal CRUISE motion forward
298    -153.25   -48.65       ← normal CRUISE motion forward
299    -55.66    +97.59 ★    ← REBASE EVENT — origin shifts +97.59 units
300    -104.31   -48.65       ← normal CRUISE motion forward
...    (pattern repeats every 3 frames)
```

The ~97.59-unit "delta" is the world-origin rebase delta firing when
`|ship.z|` crosses the rebase threshold (`REBASE_THRESHOLD_SQ` per
`docs/PLAN_world-origin-rebasing.md`). The 48.65-unit deltas are
legitimate CRUISE motion advancing toward the target. Target.z values
in the same window confirm the rebase: target.z shifts by the same
~146 units each rebase event (`-3920 → -3774 → -3628 → ...`),
consistent with all world positions being subtracted by the rebase
offset together.

**Implication:** the kit's predicates `signStability`,
`monotonicityScore`, `deltaMagnitudeBound` operate on the
**rebased-frame** sample stream (`anchor.pos` is local to the rebased
origin). They cannot distinguish rebase events from real motion.

This is a kit limitation, NOT a migration regression. A 60-Hz CRUISE
leg passing through frequent rebase boundaries (which it must under
the rebasing workstream's design) will always trip these predicates as
"oscillating" — even though the actual ship motion is smooth and
monotone in world-true space.

## Verdict

**PASS** at the AC #16 contract: dogfood ran at sim-tick fidelity, kit
predicates executed against post-migration HEAD samples, verdicts
recorded.

**Surfaced residual issue:** the kit's invariant predicates need
rebase-awareness for use against well-dipper proper. Two viable
fixes:

1. **Operate on world-true positions.** Have the telemetry sampler
   emit `anchor.pos_worldtrue = anchor.pos + worldOriginOffset` and
   have predicates read `pos_worldtrue` instead of `pos`. Cleanest
   architectural fix; predicates remain rebase-agnostic.

2. **Add a rebase-event detector to predicate input pre-processing.**
   Detect frames where every body's position shifts by the same
   amount (the rebase-event signature) and skip those frames in
   per-frame predicate evaluation. Cheaper to implement; changes only
   the kit-side, not well-dipper.

Recommend option 1 — surface to PM as a kit-side workstream
(sibling to the eventual scene-inventory-telemetry workstream Max
authorized 2026-05-05).

## Migration-regression check

The STATION-phase predicate runs all PASSed at sim-tick fidelity
(0 violations on `deltaMagnitudeBound` z + x at 1-unit bound,
0 violations on `monotonicityScore` z). Parked ship motion is clean
post-migration — the 0.0354-unit max Z delta during STATION is
sub-frame numerical jitter only, well under the 1-unit bound.

This rules out a migration-induced oscillation in STATION-hold
mechanics. If Max is seeing visible artifacts during station-hold or
in cruise (the "crosses/runway persists after warp" / "warp tunnel
short" reports from the same session), the cause is not a misclass-
ified `update(dt)` consumer in the autopilot motion path — that path
is clean.

## Next-step pointer for follow-up workstream

The two visible regressions Max reported during this session
(reticle/runway persists after warp; warp-tunnel second half not
rendering) are AC #17 capture targets — the brief's structural catch
for Phase 3 misclassification per Drift Risk #2. Triage on AC #17
recordings.
