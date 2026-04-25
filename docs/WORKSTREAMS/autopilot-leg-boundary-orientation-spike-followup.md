# Workstream: Autopilot leg-boundary orientation spike — follow-up

## Status

**`Stub — conditional, awaiting V1 AC #5 pre-shake re-sample
outcome` (authored 2026-04-25 by PM under Director audit
autopilot-station-hold-redesign-2026-04-24 §A3.3).**

This workstream is a **stub**. It exists to capture a Pattern A
observation surfaced during V1 Attempt 1 telemetry analysis but
**punted** to a follow-up because the failure class is below the
perceptual-evidence threshold of the parent workstream's AC #8
jumpscare-arrival recording. The stub is **conditional**:

- **If** V1 Attempt 1's AC #5 pre-shake re-sample (running now,
  per parent workstream §A3.4) shows Pattern A **disappears** —
  the spike was a sample-timing artifact of the post-shake
  measurement, and the pre-shake basis sampling cleans it up by
  construction. **Close this stub** with a note recording the
  resolution.
- **If** the re-sample shows Pattern A **persists** — the spike is
  a real frame-ordering bug between the V1 ESTABLISHING look-at
  and the upstream `ship.forward` write at leg boundaries. **Light
  up this stub** as an active workstream, scope an Attempt 1, run
  through the standard PM-brief / Director-audit / working-Claude
  cycle.

Telemetry artifact (Pattern A observation):
`recordings/v1-attempt1-ac-report.json` — 12 single-sample dot
violations across 12 legs (single-frame transients at leg
boundaries). Re-sample telemetry (pending):
`recordings/autopilot-station-hold-v1-attempt1-preshake-telemetry.json`.

**Trigger to light up:** working-Claude or Director compares pre-
shake re-sample against the original Pattern A signature; if the
single-frame violations remain at leg boundaries with the same
12-of-12 cadence (or any non-zero count that recurs across legs
rather than dispersing into noise), this stub activates.

## Parent feature

**`docs/FEATURES/autopilot.md`** — same parent as the source
workstream
(`docs/WORKSTREAMS/autopilot-station-hold-redesign-2026-04-24.md`).
The Pattern A observation is a sub-symptom inside that parent
feature's V1 ESTABLISHING camera-axis criterion, not a feature
in its own right.

## Implementation plan

**N/A** while in stub status. If this workstream lights up, an
implementation plan is authored at that point — likely fits in
the brief itself given the suspected one-line-fix scope.

## Suspected cause (V1 Attempt 1 closing audit hypothesis)

**Ordering bug between `motionStarted` handler and the V1 ESTABLISHING
look-at.** At leg boundaries, the autopilot writes a new
`ship.forward` in `AutopilotMotion.beginMotion` (or equivalent),
but the previous frame's `camera.quaternion` still reflects the
last leg's orientation for one frame because the look-at reads
the new `ship.forward` only on the next animate-loop tick. The
single-frame discrepancy shows up as one dot-violation sample at
each leg boundary.

**One-line-fix shape (if real):** main.js animate loop or
`AutopilotMotion.beginMotion` write-order — either route the
look-at update synchronously inside the `motionStarted` handler,
or defer the telemetry sample by one frame so it reads the
post-write basis. Director will audit the fix against the
write-order surface when this stub lights up.

## Acceptance criteria (drafted, not active until stub lights up)

Contract-shaped (process / diagnostic workstream — no feature-doc
phase quote, per `docs/PERSONAS/pm.md` §"Per-phase AC rule carve-
out").

### AC #1 — Pre-shake re-sample comparison performed

A diff between original Pattern A telemetry
(`recordings/v1-attempt1-ac-report.json`) and pre-shake re-sample
telemetry
(`recordings/autopilot-station-hold-v1-attempt1-preshake-telemetry.json`)
is recorded. The diff names whether Pattern A persisted or
disappeared. If disappeared, this stub closes; if persisted, the
remaining ACs become live.

### AC #2 — Frame-ordering bug located (if Pattern A persists)

Code inspection identifies the write-order surface where
`ship.forward` is updated relative to where
`camera.quaternion` is computed via the V1 ESTABLISHING look-at.
The ordering issue is named in the workstream brief at the file
+ line site.

### AC #3 — Fix lands and Pattern A disappears (if Pattern A persists)

Post-fix telemetry capture under the same Sol tour conditions
(seeded RNG + matched 12-leg sample) shows zero leg-boundary
dot-violation samples. Bound: `min(dot(shipForward,
cameraForwardPreShake)) ≥ 0.9999` across all leg boundaries
(no relaxation; the AC #5 pre-shake bound from the parent
workstream is the reference).

### AC #4 — No regression on AC #5 Pattern B (if Pattern A persists)

Post-fix telemetry preserves the parent workstream's AC #5 bound
(`dot(shipForward, cameraForwardPreShake) ≥ 0.9999` every frame,
all phases). The fix may not introduce a new failure mode
elsewhere on the camera-axis surface.

## Principles that apply

Drafted; not load-bearing until stub lights up.

- **Principle 6 — First Principles Over Patches.** If Pattern A is
  a real frame-ordering bug, the fix is a write-order correction,
  not a smoothing filter on the dot-violation samples. Filtering
  the symptom would re-introduce the cycle-1/2/3 patch-class
  failure mode at a different altitude.

## Drift risks

- **Risk: Stub stays open as zombie work.** If the V1 AC #5 re-
  sample resolves Pattern A by construction (sample-timing
  artifact), this stub must be **closed**, not left in
  perpetually-conditional status. **Guard:** PM closes the stub
  with a status flip to `Closed — Pattern A resolved by V1 AC #5
  pre-shake re-sample` once the re-sample evidence is on disk.
  Do not leave the stub open as a "just in case" placeholder.
- **Risk: Premature activation.** If working-Claude or Director
  activates this stub before the V1 AC #5 re-sample is on disk,
  the diagnostic is operating without the data that determines
  whether the workstream should exist. **Guard:** AC #1 is the
  gate; do not proceed past AC #1 until the re-sample telemetry
  is captured and compared.

## In scope (if stub lights up)

- Code inspection of the autopilot motion-start handler + V1
  ESTABLISHING look-at write order.
- One-line-or-small fix at the identified write-order surface.
- Post-fix Sol tour telemetry capture for AC #3 + AC #4
  verification.

## Out of scope

- **Camera-axis filter / smoothing.** If a smoothing filter is
  reached for instead of a write-order fix, escalate to Director;
  filtering the symptom is not in scope.
- **Parent workstream's other ACs.** AC #1 / #3 / #4 / #6 / #7 /
  #9 / #10 from the parent are already PASS in
  `recordings/v1-attempt1-ac-report.json`; this stub does not re-
  audit them.
- **Shake mechanism redesign.** The shake mechanism is inherited
  from WS 2 (`1bb5eb2`); this stub does not touch shake authoring.
- **STATION-B / ORBIT-mode work.** V-later, separate workstream.

## Handoff to working-Claude

This stub is **inactive** at landing. Do not begin work on the
ACs above. The parent workstream
(`docs/WORKSTREAMS/autopilot-station-hold-redesign-2026-04-24.md`
§A3.4) will deliver the V1 AC #5 pre-shake re-sample telemetry to
`recordings/autopilot-station-hold-v1-attempt1-preshake-telemetry.json`.
At that point:

1. **PM compares re-sample telemetry** against original Pattern A
   signature in `recordings/v1-attempt1-ac-report.json`.
2. **If Pattern A disappeared:** PM flips this stub's status to
   `Closed — Pattern A resolved by V1 AC #5 pre-shake re-sample
   <sha>`. Done.
3. **If Pattern A persisted:** PM flips status to `Active — Attempt
   1`, fills in the implementation plan with the located write-
   order site, runs the standard Director-audit cycle. Working-
   Claude does not begin substantive edits until that audit is on
   disk.

---

*This stub is PM-authored under Director audit autopilot-station-
hold-redesign-2026-04-24 (2026-04-25, V1 Attempt 1 closing audit
§A3.3); audit verdict ("PUNT to follow-up workstream") quoted
verbatim. Authored by PM under Director audit
autopilot-station-hold-redesign-2026-04-24 (2026-04-25); audit
verdicts quoted verbatim.*
