# Workstream: Autopilot telemetry coverage — SUPERSEDED 2026-04-24

## Status

`SUPERSEDED — 2026-04-24 by docs/WORKSTREAMS/autopilot-telemetry-reckoning-2026-04-24.md.`

**Do not execute against this brief.** The scope was too narrow —
retroactive backfill for WS 3 camera-axis ACs + the shake-redesign
AC #19 surface invariant — and it was drafted (at `4f9e1bb`) under
the assumption that the existing telemetry fields could describe
what Max sees in the 3D scene. The 2026-04-24 rejection of the
continuity workstream recording proved that assumption false.

## Why superseded

On 2026-04-24, Max viewed the
`autopilot-phase-transition-velocity-continuity-2026-04-23` recording
and rejected the `VERIFIED_PENDING_MAX f90ae2e` flip. He named three
specific visible issues the telemetry self-audit did not catch:

1. Head turn on arrival at the planet.
2. Pause-zoom-in-zoom-out cycle at arrival.
3. Jerky motion on transition to the moon.

Plus: shake firing at *"kind of random points,"* not correlated
with velocity-change peaks.

None of these were observable in the telemetry fields this brief
proposed to extend. This brief would have shipped audits against
the same set of inadequate observables, which is why Director ruled
**stop** and PM authored the reckoning brief as a full
replacement rather than an expansion.

## Redirect

The live workstream is:

**`docs/WORKSTREAMS/autopilot-telemetry-reckoning-2026-04-24.md`**

Read that brief for:
- the six telemetry-field extensions (all-bodies snapshot, camera
  angular rates, camera FOV, ship speed in light-years/s, ship-to-
  body distances + approach rates, body angular coordinates in view);
- the shake-event log;
- the three new audit helpers (`cameraViewAngularContinuity`,
  `bodyInFrameChanges`, `shakeVelocityCorrelation`) plus
  `runAllReckoning`;
- the stop-the-line positioning — this blocks the continuity
  re-audit AND WS 4.

## What was deferred, not superseded

The **pinned-star pixel-check harness** from the superseded brief's
AC #4 (the runtime observability upgrade for shake-redesign AC #19)
is NOT in the reckoning brief's scope. It stays parked with this
superseded brief; if a pixel-level runtime observer is needed later
(e.g., during a future shake-composition refactor), it spawns its
own brief.

Similarly, the three retroactive WS 3 camera-axis audits
(`lingerTargetCorrect`, `independentPacing`, `panAheadBias`) are
parked here. The reckoning brief's new observables (angular rates,
body-in-frame) are complementary, not replacements; if a future
session needs the specific WS 3 retroactive-coverage pattern, the
scope from this brief's AC #1 / #2 / #3 is the reference.

## Audit trail

- Drafted 2026-04-23 at `4f9e1bb` (original full-scope brief).
- Superseded 2026-04-24 — this stub replaces the original full
  scope; the original is preserved in git history at `4f9e1bb`.
