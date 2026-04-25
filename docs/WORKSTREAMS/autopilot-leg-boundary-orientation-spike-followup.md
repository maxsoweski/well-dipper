# Workstream: Autopilot leg-boundary orientation spike — follow-up

## Status

**`Closed — AC #5 invalidated under §A4 redesign (camera/ship
decoupling)` (closed 2026-04-25 by PM under Director audit
autopilot-station-hold-redesign-2026-04-24 §A4).**

Pattern A was a measurement issue against an AC that no longer
exists. The original AC #5 from the parent workstream (camera
forward ≡ ship forward, dot ≥ 0.9999) is **invalidated** under
§A4 — camera no longer reads `ship.forward` for the lookAt
direction at all. The single-frame leg-boundary orientation spike
captured by this stub was an order-of-write transient between the
`motionStarted` handler (which writes a new `ship.forward` at the
start of each leg) and the V1 ESTABLISHING look-at (which read
the ship.forward to compute the camera's lookAt target). Under
§A4, ESTABLISHING reads **target.current_position** directly —
there is no order-of-write between motionStarted and ESTABLISHING
look-at to misalign, because ESTABLISHING is no longer reading the
freshly-written ship.forward at all. The failure class is
structurally dissolved.

The pre-shake re-sample evidence in
`recordings/v1-ac5-preshake-report.json` (Pattern A persisted at
2 spikes across 3 legs in pre-shake re-sample, confirming the
ordering bug was real under the prior V1 spec) is now an artifact
of an invalidated spec — preserved in git for archaeology, no
longer load-bearing.

The new workstream
(`docs/WORKSTREAMS/autopilot-camera-ship-decoupling-2026-04-25.md`)
carries the §A4 redesign. Its AC #5a (camera tracks body) measures
`dot(cameraForwardPreShake, normalize(target.current_position −
camera.position)) ≥ 0.9999` per frame — a body-tracking pursuit
curve, not a ship-forward alignment, and not vulnerable to the
write-order class that produced Pattern A.

**No follow-up scope remains.** Drift risk #1 from this stub
(zombie work) is closed by this status flip. If a leg-boundary
artifact reappears under §A4 (e.g., camera reads stale
target.current_position at leg boundaries because the target
reference is captured-at-onset rather than read-each-frame), that's
the new workstream's Drift risk #9 (camera reads stale target
position) — *not* a re-light of this stub.

---

**Prior status (preserved for history): `Stub — conditional,
awaiting V1 AC #5 pre-shake re-sample outcome` (authored 2026-04-25
by PM under Director audit autopilot-station-hold-redesign-2026-04-24
§A3.3).**

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
