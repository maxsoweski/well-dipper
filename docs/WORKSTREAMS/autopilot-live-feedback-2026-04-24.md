# Workstream: Autopilot live-feedback — promote telemetry from observer to pipeline input (2026-04-24)

## Status

`Released 2026-04-24 (Director audit `d81a982`) — execution begins with loop (b).` Director audit: scope clean, three loops carve distinct ACs with non-overlapping invariants, loop order (b → c → a) load-bearing and justified, Principle 5/6/2 framing explicit with grep-enforced AC #10 guard. Loop-specific rulings:

- **Loop (b):** `VelocityBlend` machinery stays; blend target moves from captured-extrapolation to live-per-body. **Committed formula shape revised 2026-04-24 post-first-pass to Option 4 (two-anchor blend)** per Director's ruling after mid-window geometric artifact surfaced in test capture (AC #9: 18→554 violations). See AC #1 for verbatim formula: `ship_extrap` (momentum-anchored) and `body_tracked` (body-frame-anchored) are computed independently every frame; `ramp = elapsed/duration` controls only the mix. Continuity at blend-start (`ramp=0` → ship_extrap → _seamEntryPosition at elapsed=0) and frame-lock at blend-end (`ramp=1` → body_tracked) are both satisfied by construction. Restores `capturedVelocity` capture at seam entry. See Revision history 2026-04-24 loop-(b) formula revision entry for the full audit trail.
- **Loop (c):** Local-maximum detector as ADDITIONAL predicate on existing threshold (PM lean accepted); three-point peak with two-point percentile fallback if AC #5 fails at 100%.
- **Loop (a):** Per-frame angular-delta clamp on raw target pre-commit (not velocity-integrating, no clamp-side oscillation risk). Starting constant `MAX_FRAME_ANGULAR_RATE_DEG_PER_SEC = 600` per brief; working-Claude should consider opening tighter (300–450°/sec range — above authored pan-ahead rate, well below the 35,384°/sec violation peak) on first pass and widen only if authored pan-ahead visibly clips. Mid-workstream pause between (c) and (a) surfaces the chosen value + recording evidence for Director re-check before (a) commits.

`~/.claude/state/dev-collab/active-workstream` flipped to `autopilot-live-feedback-2026-04-24`; `state.json[...].last_audit_sha` = `273e725be9bf6cf8132e64feaf9999c421101d63` (Loop (a) cycle-2 audit; supersedes prior `d81a982` release audit and the Loop (a) cycle-1 audit).

**Loop (a) cycle-2 (2026-04-24):** cycle-1 clamp at 450°/sec shipped as uncommitted edit in `src/auto/CameraChoreographer.js` L327–364 and shaped p99.9 angular rate to 540°/sec (under the 600°/sec AC #8 bar). 31 violations remained — all downstream of the clamp, caused by `three.js camera.lookAt()` numerical instability when `|target − shipPos| < 0.5u` (cluster 1 at 0.30u from PANNING_AHEAD blend output, cluster 2 at 0.46u from LINGERING direct write; cluster 3 a dt-sampling hitch). Director ruled **Option (A) — target-distance guard** — companion mechanism to the clamp (geometric precondition, not rate limit). AC #7 amended below with co-mechanism clause; drift-risks extended with sub-2u composition-distortion risk. Cycle-1 recording: `recordings/loopa-clamp-450dps.webm`.

Foundational scope-expansion workstream. Promotes the reckoning
telemetry (shipped at `f652a40`, `VERIFIED_PENDING_MAX 516bb90`) from
**observer** to **pipeline input** — three per-frame fields (live
per-body position, live `|d|v|/dt|`, live per-body camera-view azimuth/
altitude) become read-inputs to the three subsystems that currently
derive the same quantities from stale / synthetic sources.

**Pointer bookkeeping.** `~/.claude/state/dev-collab/active-workstream`
flips to `autopilot-live-feedback-2026-04-24` on the commit that lands
this brief. The reckoning workstream's gate state stays intact — it's
`VERIFIED_PENDING_MAX f652a40` and will flip to Shipped on Max's pass
against the retroactive-diagnosis appendix; that is independent of
this workstream's lifecycle. Execution on this workstream begins only
after Director audit releases the gate.

## Revision history

- **2026-04-24 — authored.** During the reckoning brief review, Max
  asked a direct question: can the reckoning telemetry be leveraged
  as a real-time input to the autopilot? Director's ruling (verbatim
  from the session): *"yes — structurally it already is real-time
  (runs per-frame from live state); only a policy + consumer decision
  keeps it observer-only. Promoting it to pipeline input likely
  unwinds several class-of-bug issues we've been whack-a-moling
  (moon-motion reconciliation, quarter-second glances, shake-at-
  random)."* Director named three concrete loops; PM carves them into
  this brief with loop-order discipline (non-oscillation-risk loops
  first, oscillation-risk loop last). Drafted by PM 2026-04-24 after
  Director's loop articulation.

- **2026-04-24 — loop (a) cycle-2 co-mechanism added (target-distance
  guard).** Cycle-1 of Loop (a) landed the Director-specified per-frame
  angular-rate clamp on the raw target at `MAX_FRAME_ANGULAR_RATE_DEG_
  PER_SEC = 450` in `src/auto/CameraChoreographer.js` L327–364. The
  clamp behaved as specified — p99.9 of camera angular rate fell to
  540°/sec (under the AC #8 600°/sec bar) — but 31 violations remained
  in the cycle-1 capture (`recordings/loopa-clamp-450dps.webm`).
  Diagnosis (working-Claude, Director-confirmed): all 31 violations
  are downstream of the clamp. Cause is `three.js camera.lookAt()`
  numerical instability when `|target − shipPos| < 0.5` scene units.
  `lookAt` builds the camera quaternion from `normalize(target −
  cameraPos)`; at sub-unit distance, millimeter-scale per-frame
  perturbations on `target.position` (body-orbit animation + ship
  position integration) amplify into large swings in the unit
  direction. No clamp value can fix this — the failure is geometric,
  not rate-limited. Two distinct degenerate clusters were observed:
  **Cluster 1** at `distance ≈ 0.30u` (PANNING_AHEAD branch L295–299,
  pan-ahead blend output near small-moon APPROACH); **Cluster 2** at
  `distance ≈ 0.46u` (LINGERING branch L262, `_lingerTargetRef.
  position` write during camera linger on a receding small moon).
  Cluster 3 (single-frame dt-sampling artifact after a 44.9ms hitch)
  is acceptable-as-artifact per Director's cycle-2 ruling. Director
  ruled Option (A) — target-distance guard — verbatim: *"Your
  diagnosis holds: the 31 violations are degenerate-lookAt geometry
  downstream of the clamp, not clamp-escape. Tuning doesn't close
  them. (B) is the Principle-6 anti-pattern the brief explicitly
  named; (C) would scope-invert AC #8."* Ruling details: guard sits
  after the switch's closing brace in `EstablishingMode.update()`
  (covering both Cluster 1 and Cluster 2 write sites) and before the
  angular-rate clamp; `MIN_TARGET_DISTANCE = 2.0` scene units (gives
  4–6× margin over observed clusters; puts per-frame wobble at <1% of
  vector magnitude, out of the `normalize`-amplification regime);
  keep the 450°/sec clamp (shaping p99.9 correctly — lowering clips
  authored pan-ahead, raising eats AC #8 headroom). Mechanism class
  is **additive** (co-mechanism — clamp is a rate limit, guard is a
  geometric precondition); nothing in the existing brief is retracted.
  AC #7 extended with the co-mechanism clause; drift-risks extended
  with a sub-2u composition-distortion risk + falsification signal.
  Cycle-2 audit SHA: `273e725be9bf6cf8132e64feaf9999c421101d63`.

- **2026-04-24 — loop (b) formula revised to Option 4 (two-anchor
  blend).** First-pass implementation of loop (b) used the Director's
  originally-specified formula
  `_seamEntryPosition + (body.position − bodyPositionAtSeamEntry) ×
  (elapsed / duration)` — ramp-scaled body-delta on top of the seam
  entry position. Test capture against the new AC #8/#9 audits
  surfaced a geometric artifact mid-window: at ramp=0.5, the ship
  ended up ~4× farther from the body than the approach-endpoint
  orbit distance (approach-endpoint 0.06 → first-frame-of-ORBIT
  captured 0.27). Telemetry deltas: AC #8 improved (11 → 5
  `cameraViewAngularContinuity` violations), **but AC #9
  catastrophically regressed (18 → 554 `bodyInFrameChanges`
  violations)** — the
  body re-crossed every frame threshold as the captured position
  orbited the true body position at the wrong radius. Record-scratch
  visual artifact worsened (amplitude 0.068 → 0.078, coverage
  13% → 30%). Director ruled Option 4 verbatim: *"Your framing is
  correct: the ramp conflates two independent continuities (momentum
  at t=0, body-relative frame at t=duration) into one scalar. The
  mid-window artifact is the geometric cost of collapsing them.
  Blend between the two anchors explicitly — ship-extrapolation
  satisfies C1-at-start by construction, body-tracked satisfies
  frame-lock at end, ramp controls only the mix. Seam 3's zero
  leaving-velocity falls out naturally. PM picks up for brief
  revision."* Formula replaced in AC #1 and in the drift-risk guard
  below. The capturedVelocity capture that was removed for the
  simplified first-pass formula is restored. Loop (b) commits (c)
  and (a) are unchanged in scope.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
`bdeb0ff`, keybinding update at `4b9b18a`, parking-lot entries at
`79cdf4e` + `14835cc`, WS 3 entry at `a1019da`, continuity phase-
transition criteria at `14835cc`.

This workstream does not author new feature criteria. It changes
**how** the existing criteria are produced at three sites — each of
which the reckoning audits have already flagged as the producer of a
Max-visible issue the existing mechanism cannot resolve from within
its own scope:

- **§"Per-phase criterion — ship axis (V1)" — continuity at seam
  boundaries.** Seam 2 and Seam 3 (TRAVEL→APPROACH, APPROACH→ORBIT)
  — and implicitly Seam 1 where moons are the target — use a
  T₀-captured velocity extrapolation (`_velocityBlend.capturedVelocity
  × elapsed`) as the blend anchor. Moons don't stand still during
  the 0.3–0.5s blend window. Loop (b) reads live per-body position
  each frame instead.
- **§"Gravity drives — ship-body shake on abrupt transitions."** The
  shake's onset condition gates on a smoothed internal
  `smoothedAbsDSpeed` signal (`ShipChoreographer.js:275` + `378`)
  derived from its own position tracking. The reckoning audit
  (`shakeVelocityCorrelation`, AC #10 of reckoning) cannot yet
  evaluate whether the signal's local maxima correlate with onsets
  because the current tour captures no natural shake events — but
  Max's "fires at random points" read stands. Loop (c) replaces (or
  augments) the internal signal with the reckoning pipeline's
  per-frame derivative.
- **§"Per-phase criterion — camera axis (V1)" — ESTABLISHING.** WS 3
  ACs #4–#6 author linger + pan-ahead behavior; the reckoning
  retroactive-diagnosis appendix (AC #12) found 11 `cameraViewAngular
  Continuity` violations (top violation: 35,384°/sec yaw rate during
  PANNING_AHEAD / APPROACH / ESTABLISHING) and 18 quarter-second-
  glance `bodyInFrameChanges` violations in the current Shipped tour.
  Loop (a) adds a damper in `EstablishingMode` that reads the live
  per-body angular-coordinate field to clamp frame-to-frame target
  motion.

## Implementation plan

**N/A (feature is workstream-sized).** All three loops land as minimal-
surface edits:

- Loop (b): `src/auto/NavigationSubsystem.js` — `update()` lines
  308–317 blend-apply region; the captured-velocity extrapolation
  (`_seamEntryPosition + capturedVelocity × elapsed`) is replaced with
  a live-position read via the body reference the seam's departing
  phase was tracking.
- Loop (c): `src/auto/ShipChoreographer.js` — the onset gate at
  line 385 (`this._smoothedAbsDSpeed >= SIGNAL_ONSET_THRESHOLD`) gates
  on a signal that is either (a) the reckoning pipeline's per-frame
  `shipSpeedSceneUnitsPerSec` derivative, or (b) the existing
  `_smoothedAbsDSpeed` with an additional local-maximum detector. PM
  leans (b) — augment, not replace — because the existing signal has
  already proved its gating behavior; working-Claude justifies either
  choice in the commit with evidence from a fresh capture.
- Loop (a): `src/auto/CameraChoreographer.js` — `EstablishingMode.
  update()` adds an angular-delta clamp on the per-frame `_current
  LookAtTarget` assignment. Dampening constant is the load-bearing
  tune — start ~600°/sec (the reckoning AC #8 threshold) and
  negotiate with Director + recording evidence.

If mid-work working-Claude discovers that loop (a)'s damper needs its
own state machine (e.g., "if clamped for >N frames, allow a pop"),
escalate to PM — that's a behavioral-state addition the brief hasn't
sanctioned.

## Scope statement

**Promote the reckoning telemetry from observer to pipeline input at
three named sites.** Each site today derives the same or equivalent
quantity from a stale / synthetic / self-smoothed source; each site
is the producer of a Max-visible issue the reckoning audits flag as a
regression on the current Shipped code. The three loops:

- **Loop (b) — live per-body read replaces velocity-blend extra-
  polation.** No oscillation risk; "use current truth instead of
  stale capture." `VelocityBlend` machinery stays in place (blend
  window + smoothstep ramp are not regressed) but the extrapolation
  target becomes the live body position this frame, not the T₀
  captured offset. Makes the continuity round-1 code at `f90ae2e`
  correct for moving moons.

- **Loop (c) — live `d|v|/dt` trigger for shake.** No oscillation
  risk; the signal is already derived per-frame from live state
  — the question is whether `ShipChoreographer`'s internal smoothed
  version or the reckoning pipeline's `shipSpeedSceneUnitsPerSec`
  derivative is the better trigger source. Adds a local-maximum
  detector (or replaces the threshold-crossing with it) so onsets
  sit at actual velocity-change peaks, not at any frame where the
  smoothed signal first crosses threshold. Resolves the shake-at-
  random parking-lot concern without reopening the shake-redesign
  workstream.

- **Loop (a) — body-in-frame flip → camera damper.** Oscillation
  risk — needs damping constant. Does LAST after (b) and (c) land.
  `EstablishingMode` reads next-frame predicted per-body azimuth/
  altitude; clamps angular delta on the frame-to-frame raw target
  to prevent the head-turn / glance AC #8 + AC #9 detects. Resolves
  WS 3's PANNING_AHEAD/APPROACH finding.

**Loop order is load-bearing.** (b) and (c) land first because they
are non-oscillation-risk pure "read live truth instead of stale
capture" replacements; once the pipeline is carrying those live reads
and Max's visible-on-the-recording issues for those two classes are
resolved, (a) lands with a known-good pipeline to damp against.
Landing (a) first would mean damping against a target that is itself
still producing the moon-motion reconciliation errors (b) fixes, and
the damper's tuning would chase that moving target.

**Supersedes continuity round-2 scope.** Per Director's ruling, loop
(b) replaces the velocity-blend mechanism's role at the seam-moving-
target problem. The continuity workstream (`autopilot-phase-transition-
velocity-continuity-2026-04-23.md`, `HELD — REJECTED 2026-04-24`)
remains held; after this workstream Ships, its re-audit runs against
the new pipeline. The Seam 1 / Seam 2 / Seam 3 `VelocityBlend` scaffol
at `f90ae2e` is not retired wholesale by loop (b) — the blend-window
duration + smoothstep ramp are preserved; only the **blend target**
(what position the ship is being lerped toward during the blend) moves
from captured-extrapolation to live-per-body.

**Defers shake-redesign parking-lot reopening.** Loop (c) resolves the
"shake at random" concern within this workstream's scope; the shake-
redesign workstream stays `Shipped 1bb5eb2` and does not reopen. Any
actual shake *mechanism* change (envelope shape, carrier frequency,
phase of trigger) remains out of scope per Principle 2 — loop (c)
replaces the **signal the trigger reads**, not the trigger's
downstream envelope/carrier/phase-gate machinery.

**Defers WS 3 reopening.** Loop (a) resolves the PANNING_AHEAD /
APPROACH head-turn within this workstream's scope; WS 3 stays `Shipped
b7699de` and does not reopen. Any **framing-state authoring** change
(linger duration, pan-ahead magnitude, new framing states) remains
out of scope — loop (a) adds a rate-limiter to a specific composition
site, not a new framing state.

**WS 4 queue discipline.** WS 4 (autopilot-toggle UI + warp-select
follow-up) continues to wait behind the reckoning re-audit pipeline.
This workstream's Shipped flip is the gate; once the three loops pass
their per-loop ACs + the reckoning audits show the retroactively-named
issues resolved, the continuity re-audit runs, and WS 4 greenlights.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Director's framing for this workstream: *"telemetry-
  as-pipeline, not consumer feeding back."* The one-direction flow
  stays intact and gets tighter:
    1. Nav subsystem produces motion frame.
    2. Reckoning telemetry pipeline computes per-frame derived fields
       from live state (per-body position, `|d|v|/dt|`, per-body
       azimuth/altitude) — this already happens in the reckoning
       capture function; today those fields exist only in the sample
       buffer, not on the per-frame object subsystems read from.
    3. Ship choreographer consumes live `|d|v|/dt|` derivative for
       shake-onset (loop c).
    4. Camera choreographer consumes live per-body angular coordinates
       for framing-damping (loop a) and nav subsystem consumes live
       per-body position for seam-blend anchoring (loop b).
    5. Renderer consumes.

  Every stage still reads from **earlier** stages only. Telemetry is
  an early stage (computed from positions the renderer has already
  been handed for prior frames, plus this frame's live reads). **No
  backward read from a consumer to a producer.** The wire-up is a
  pipeline extension, not a reverse flow. *Violation in this work-
  stream would look like:* loop (c) making `ShipChoreographer` call
  into `_autopilot.telemetry` to fetch its own prior frame's signal —
  that would be a consumer reading from a sampler that samples the
  consumer's state, a circular read. The correct shape: the per-frame
  `|d|v|/dt|` computation is extracted into an early-stage helper
  that both the telemetry sampler AND the ship choreographer consume
  as a pure input.

- **Principle 6 — First Principles Over Patches.** The moon-motion-
  reconciliation, quarter-second-glance, and shake-at-random issues
  have been whack-a-moled across three workstreams (continuity round-
  1, shake-redesign rounds 1–11, WS 3 rounds 1–2). Each patch ships
  V1 for its specific seam / signal / frame-transition and compounds
  foreclosure against the shared root cause: the three sites all
  derive their inputs from stale / smoothed / synthetic sources when
  a live-state read is available. The first-principles move is to
  unify on the live-state read; the patch move is to keep tuning the
  per-site easing curves and debounce windows. *Violation in this
  workstream would look like:* loop (a)'s damper implemented as "if
  last N frames' camLookAt delta exceeded X, clamp this frame" —
  which is a smoothing filter on the output, not a live-read on the
  input. The right shape: read the live per-body azimuth/altitude
  this frame, predict next frame's raw target, compute angular delta
  against this frame's committed target, clamp if exceeds rate.

- **Principle 2 — No Tack-On Systems.** The reckoning telemetry
  fields land once (already Shipped/pending at `f652a40`); this
  workstream wires three consumers to those fields. The alternative —
  adding three independent per-consumer derivations of the same
  live-state reads (ShipChoreographer gets its own per-body position
  cache, NavigationSubsystem gets its own per-body position cache,
  CameraChoreographer gets its own per-body position cache) — would
  be the tack-on anti-pattern. *Violation in this workstream would
  look like:* loop (b)'s live per-body read implemented as
  `navSubsystem._livePosCache[bodyName]` instead of consuming from a
  shared early-stage source. Pipeline principle says: one producer,
  many consumers.

Principles 1, 3, 4 not load-bearing here. Principle 1 (Hash Grid
Authority) is orthogonal — the per-body data this workstream reads is
already supplied through the nav/body-ref channel; no hash-grid read.
Principle 3 (Per-Object Retro Aesthetic) is orthogonal — this is a
motion/input plumbing change. Principle 4 (BPM-Synced Animation) is
orthogonal at V1.

## Acceptance criteria

Per-loop ACs in loop-execution order. Contract-shaped per
`docs/PERSONAS/pm.md` §"Per-phase AC rule carve-out: process /
tooling workstreams" for the pipeline-wiring ACs (#1, #4, #7); phase-
sourced per `docs/PERSONAS/pm.md` §"Per-phase AC rule" for the
behavioral-outcome ACs (#2, #3, #5, #6, #8, #9) because they cite
feature-doc phase sections verbatim. The workstream-level ACs (#10,
#11) are contract-shaped.

### Loop (b) — live per-body read at seam-blend anchor

**AC #1 — blend target is a two-anchor mix of ship-extrapolation and
body-tracked position (Option 4).** `NavigationSubsystem.update()`
lines 310–317 (the blend-apply region) is refactored so that during
an active `_velocityBlend`, the captured ship position each frame is
computed as an **explicit blend between two independent anchors**
rather than a ramp-scaled body-delta on top of the seam entry:

```
ship_extrap  = _seamEntryPosition + capturedVelocity × elapsed
body_tracked = _seamEntryPosition + (body.position − bodyPositionAtSeamEntry)
//              ^ full body-delta, NO ramp
capturedPos  = ship_extrap + (body_tracked − ship_extrap) × ramp
//              ^ ramp = elapsed / duration (or smoothstep), controls
//                ONLY the mix between anchors
```

Why two anchors, not one ramp-scaled delta:
- **ship_extrap** satisfies C1 continuity at `elapsed=0` by
  construction — the momentum the ship had entering the seam carries
  it forward exactly as captured. At `ramp=0` the captured position
  equals `ship_extrap`, which equals `_seamEntryPosition` at the
  first frame (when `elapsed=0`).
- **body_tracked** satisfies frame-lock at `elapsed=duration` — the
  captured position ends the blend window locked to the same
  body-relative offset it had at seam entry, so the next frame's
  ORBIT handoff starts with the ship in the body's frame, not
  lagging behind it.
- `ramp` controls **only the mix**, not the magnitude of body-
  tracking. The previous formula (ramp-scaled body-delta) conflated
  the two continuities into one scalar, producing the mid-window
  geometric artifact that blew up AC #9 (see revision history,
  2026-04-24 loop-(b) formula revision).

Seam 3 (APPROACH→ORBIT) note: leaving velocity is zero by design
(approach decelerates to a stop before ORBIT). At `capturedVelocity
= 0`, `ship_extrap` degenerates to `_seamEntryPosition`, and
`capturedPos` reduces to pure body-tracking (`_seamEntryPosition +
(body.position − bodyPositionAtSeamEntry) × ramp` scaled by the
ship_extrap→body_tracked blend). This is the correct behavior at
zero leaving velocity and is not a special case in the formula — it
falls out of the two-anchor shape naturally.

Implementation note: `capturedVelocity` must be computed at seam
entry from `(this._position − this._prevPosition) / deltaTime` and
stored on the seam-capture object (the first-pass Loop (b)
implementation removed this capture when simplifying; restore it).
`bodyPositionAtSeamEntry` is similarly captured at seam-entry time.

Verified by:
- Grep of `src/auto/NavigationSubsystem.js` blend-apply region
  (lines 310–317 post-fix) for the two-anchor pattern — both
  `ship_extrap` (or equivalent named intermediate using
  `capturedVelocity`) and `body_tracked` (or equivalent named
  intermediate using `body.position − bodyPositionAtSeamEntry` with
  NO ramp multiplier) are computed, and the final `capturedPos`
  (or equivalent) is a lerp from the first to the second using
  `ramp = elapsed / duration` (or the smoothstep of that).
- `capturedVelocity` is captured at seam entry (grep for a write to
  the seam-capture object that derives from `_position` and
  `_prevPosition` or equivalent per-frame delta source).
- `_velocityBlend.begin()` + `.advance()` + `.blendT` remain
  unchanged — the blend window / smoothstep ramp machinery is
  preserved; only the blend-*target* computation at the apply site
  changes shape.

**AC #2 — moon-motion reconciliation resolved in telemetry.**
Per `docs/FEATURES/autopilot.md` §"Phase-transition velocity
continuity (V1)" — STATION→CRUISE and TRAVEL→APPROACH seams on
moon-targeted legs. A fresh Sol D-shortcut tour capture, post-fix,
running `window._autopilot.telemetry.audit.bodyInFrameChanges` and
the existing continuity audits:
- No centered-body-flip violations attributable to moon motion
  during the 0.3–0.5s seam windows (the reckoning appendix's
  second cluster at t=86.8–87.0s around the moon transition
  resolves or substantially reduces).
- Velocity-direction angle at seam ≤ 15° preserved (continuity AC
  #1c/#2c/#3c; AC #2 does not regress the angle, it holds the
  continuity while fixing the moving-target issue).
- **ORBIT-entry geometric bound (Director-added 2026-04-24 after
  Option 4 ruling).** During any window where `_velocityBlend.
  active && _shipMode === 'ORBIT'` (i.e., the Seam 3
  APPROACH→ORBIT blend window), the audit asserts `distToBody ≤
  1.5 × approachEndpointOrbitDistance`. The approach-endpoint
  orbit distance is the `distToBody` value at the last frame of
  APPROACH (before the ORBIT transition). The 1.5× ceiling bounds
  the mid-window geometry: if the captured position departs from
  the approach-endpoint distance by more than 50%, the blend
  formula has a geometric artifact and must be fixed before
  Shipping. (Origin: first-pass Loop (b) formula produced ~4×
  departure — 0.06 approach-endpoint → 0.27 mid-ORBIT — which
  this bound would have caught immediately.) The bound is not a
  new top-level AC by Director direction; it lives here in AC #2
  because this is the telemetry audit where `bodyInFrameChanges`
  and continuity are already asserted, and the geometric bound is
  a direct companion to both. Working-Claude implements the audit
  as an extension of the `bodyInFrameChanges` pass so it runs on
  the same per-frame sample stream.

**AC #3 — moon-motion reconciliation resolved in Max's canvas
recording.** Per `docs/MAX_RECORDING_PROTOCOL.md`. A fresh Sol
tour recording post-loop-(b) shows the STATION→CRUISE moon
transition and the TRAVEL→APPROACH moon transition without the
"jerky motion on transition to the moon" Max named in the
continuity rejection (2026-04-24 recording evidence). Max is
evaluator.

### Loop (c) — live `|d|v|/dt|` trigger for shake

**AC #4 — shake onset gates on a signal with a local-maximum
detector.** `ShipChoreographer`'s onset gate at line 385 (post-
fix line number may shift) no longer fires solely on
`smoothedAbsDSpeed >= SIGNAL_ONSET_THRESHOLD`. It additionally
requires the signal be at (or within a short window of) a **local
maximum** of the per-leg signal trajectory — implemented as: prior-
frame signal < current-frame signal < next-frame signal (strict or
near-strict, working-Claude's call, documented), OR equivalent
three-point peak detector. Verified by:
- Grep of `ShipChoreographer.js` for the new detector (named
  constant / function / inline logic, documented).
- The onset branch at the current `if (!this._eventActive && this.
  _smoothedAbsDSpeed >= SIGNAL_ONSET_THRESHOLD)` gate has an
  additional predicate for local-maximum.
- Per-leg fire budget (AC #20 round-11) remains in place — no
  regression.

**AC #5 — shake correlates with signal peaks per reckoning audit.**
Per `docs/FEATURES/autopilot.md` §"Gravity drives — ship-body shake
on abrupt transitions." A fresh long-leg / warp-arrival tour
capture that fires natural shake events, running `window._autopilot.
telemetry.audit.shakeVelocityCorrelation`:
- All (or nearly all — tolerance TBD by Director; starting value
  100%) logged shake onsets fall within ±0.5s of a signal local
  maximum that lands in the top 80th percentile of the tour's
  smoothedAbsDSpeed distribution.
- The per-event `percentileRank` field for each logged onset is
  ≥ 80 (or the Director-sanctioned tolerance).
- The reckoning `shakeVelocityCorrelation` audit returns
  `passed: true`.

**AC #6 — shake-at-random concern resolved in Max's canvas
recording.** Per `docs/MAX_RECORDING_PROTOCOL.md`. A fresh long-leg
tour recording post-loop-(c) plays back with Max evaluating the
shake's onset correlation with felt acceleration/deceleration peaks.
Max is evaluator. Shake mechanism (envelope, carrier, rotation
surface) is **unchanged** — only the trigger's signal-local-maximum
predicate changes.

### Loop (a) — body-in-frame flip → camera damper

**AC #7 — `EstablishingMode` frame-to-frame angular delta is
rate-limited AND the raw target clears a minimum distance from the
camera (two co-mechanisms).** `CameraChoreographer.EstablishingMode.
update()` applies **both** of the following to the raw target before
it commits to `_currentLookAtTarget`:

**Mechanism 1 — per-frame angular-rate clamp (cycle 1).** A clamp on
the angular delta between the prior-frame `_currentLookAtTarget` and
this-frame's raw computed target at `MAX_FRAME_ANGULAR_RATE_DEG_PER_
SEC = 450`. The clamp landed in cycle 1 and is **retained unchanged**
— it shapes p99.9 of camera angular rate under the AC #8 bar
(observed 540°/sec post-clamp vs. 35,384°/sec pre-clamp). Director
ruling on the constant: *"Shaping p99.9 correctly; lowering would
clip authored pan-ahead, raising would eat AC #8 headroom."*

**Mechanism 2 — target-distance guard (cycle 2).** A geometric
precondition on the raw target ensuring `|_prevRawTargetFrame −
shipPos| ≥ MIN_TARGET_DISTANCE = 2.0` scene units. If the raw target
is closer than the floor, push it outward along its current direction
to `shipPos + direction × MIN_TARGET_DISTANCE`. Rationale: `three.js
camera.lookAt()` builds the camera quaternion from `normalize(target
− cameraPos)`, which amplifies sub-unit-magnitude perturbations on
target position into large unit-direction swings. The floor keeps the
vector magnitude comfortably larger than per-frame body-orbit and
ship-integration wobble (~1e-2 to 1e-3 scene units) so the forward
direction is numerically stable. Constant value is Director-specified
(*"observed clusters sit at 0.30 and 0.46; 2.0 gives 4–6× margin and
puts per-frame wobble at <1% of vector magnitude — out of the
`normalize`-amplification regime"*).

**Guard placement (load-bearing).** The guard sits **after the
switch statement's closing brace** in `EstablishingMode.update()`
(every framing-state branch has finished writing `_prevRawTargetFrame`)
and **before** the angular-rate clamp block. This single-point
placement covers both observed degenerate-cluster sources:
- **Cluster 1** — PANNING_AHEAD branch (~L285), where the pan-ahead
  blend output can sit at 0.30u from ship on small-moon APPROACH.
- **Cluster 2** — LINGERING branch (~L262), where the direct write
  `_prevRawTargetFrame.copy(this._lingerTargetRef.position)` can put
  the target at 0.46u from ship when linger body is near camera.

Branch-local placement would miss Cluster 2; the single post-switch
site is the correct location.

**Degenerate direction fallback (sub-sub-case).** If
`|_prevRawTargetFrame − shipPos| < ε` (numerically zero direction
vector — target is coincident with camera), use the following
fallback chain:
1. `normalize(_currentLookAtTarget − shipPos)` (prior-frame
   committed direction).
2. If that is also `< ε`, fall back to camera forward:
   `new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)`.

Document the fallback path chosen per frame (if telemetry is cheap)
or in the commit message (if not).

Verified by:
- Grep of `src/auto/CameraChoreographer.js` for `MAX_FRAME_ANGULAR_
  RATE_DEG_PER_SEC = 450` and `MIN_TARGET_DISTANCE = 2.0` as named
  constants at the top of the module alongside `LINGER_DURATION` and
  `PAN_AHEAD_FRACTION`.
- Grep of `EstablishingMode.update()` for both mechanisms: the
  distance-guard `if (|v| < MIN_TARGET_DISTANCE && |v| > ε) { push
  outward }` sits **after** the switch's closing brace and **before**
  the angular-rate clamp block.
- The clamp is applied **on the raw target before it commits** to
  `_currentLookAtTarget`, not as a post-hoc smoothing filter on
  `_currentLookAtTarget` itself (Principle 6 — live-read at the
  input, not smoothing on the output).
- Both mechanisms act on `_prevRawTargetFrame` pre-commit at the same
  composition site; guard runs first, clamp runs second (order:
  fix the geometric precondition, then rate-limit the delta).

**Acceptance:** AC #8 `cameraViewAngularContinuity` returns zero
violations at 10.47 rad/s (600°/sec) audit bar on the cycle-2
capture. **Exception: single-violation dt-sampling artifacts** (frame-
timing jitter where dt < 1ms after a long-dt hitch, as in cycle-1's
Cluster 3) may remain — Director will rule accept-as-artifact vs.
dt-floor per capture. If more than one dt-sampling artifact persists,
footnote each in the commit and flag to Director.

**AC #8 — head-turn on arrival resolved in reckoning audit.** Per
`docs/FEATURES/autopilot.md` §"Camera axis — ESTABLISHING (V1)" —
*"slow angular velocity, composed framing."* A fresh Sol D-shortcut
tour capture, post-loop-(a), running `window._autopilot.telemetry.
audit.cameraViewAngularContinuity`:
- Zero violations above 600°/sec (the reckoning default threshold).
  The retroactive-diagnosis appendix's top violation (35,384°/sec
  yaw at t=48.16s during PANNING_AHEAD / APPROACH) resolves.
- Zero `bodyInFrameChanges` quarter-second-glance violations
  during PANNING_AHEAD / APPROACH at the planet↔moon transition
  crossover. The appendix's 18 violations resolve.

**AC #9 — head-turn + glance resolved in Max's canvas recording.**
Per `docs/MAX_RECORDING_PROTOCOL.md`. A fresh Sol tour recording
post-loop-(a) shows the on-arrival framing as a composed camera
motion — no visible "head turn" on arrival, no fractional-second
glance between planet and moon during PANNING_AHEAD. Max is
evaluator. Linger + pan-ahead authored behavior (WS 3 ACs #5 + #6)
is preserved — only angular rate is clamped, composition is not.

### Workstream-level ACs

**AC #10 — Principle 5 one-direction flow preserved (grep + diff
review).** A diff review of the three loops confirms:
- No new read from `CameraChoreographer` / `ShipChoreographer` /
  `NavigationSubsystem` back into `window._autopilot.telemetry.
  samples` or equivalent sampler output.
- Any new helper that computes a live-state derivative (loop c's
  `|d|v|/dt|` extraction, if refactored out of
  `ShipChoreographer`) is an **early-stage** helper that both the
  sampler and the consumer read from, not a sampler-to-consumer
  read.
- All three consumers still receive their non-telemetry inputs
  (`motionFrame`, `shipPhase`, `nav`) through the existing
  constructor / update-argument channel — no new circular
  instantiation.

**AC #11 — Shake-redesign + WS 3 + continuity no-regression.** After
all three loops land:
- All four shake audits (`orbitCrossProduct`, `signalCoincidence`,
  `envelopeFitsPhase`, `perLegFireBudget`) return `passed: true` on
  a fresh tour.
- The reckoning `cameraViewAngularContinuity`, `bodyInFrameChanges`,
  `shakeVelocityCorrelation`, `runAllReckoning` all return
  `passed: true` on a fresh tour (this is the reason the loops
  exist — these audits go green under live-feedback wiring).
- No regression of WS 3 ACs #4–#6 authored behavior (linger
  engages at STATION→CRUISE on receding body; pan-ahead engages
  during CRUISE; independent pacing preserved).
- Continuity ACs #1–#3 (velocity-magnitude + velocity-direction
  at seam boundaries) pass on a fresh capture; the re-audit of
  the continuity workstream runs green.

**AC #12 — Commits separable by concern.** Three commits minimum,
one per loop, in loop order:
1. `feat(autopilot): live per-body read at seam-blend anchor (loop b)`.
2. `feat(autopilot): local-maximum predicate for shake onset (loop c)`.
3. `feat(autopilot): frame-to-frame angular rate clamp in EstablishingMode (loop a)`.
Each commit names the ACs it closes. Optional fourth commit for
shared-helper extraction if loop (c) extracts `|d|v|/dt|` into a
pipeline-early helper.

## Principles that apply

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Load-bearing for the workstream's core shape. Named
  explicitly above. The direction Director approved is: telemetry
  moves from observer to pipeline **early stage**, with subsystems
  as consumers. The alternative — subsystems polling telemetry back
  — is the reverse-flow violation this brief's AC #10 guards against.

- **Principle 6 — First Principles Over Patches.** Load-bearing for
  the loop-ordering and for each loop's individual shape. Named
  above. The workstream replaces stale/smoothed/synthetic inputs at
  three sites with their live-state equivalents; the patch move at
  any site would be to keep the current input and add a compensating
  filter.

- **Principle 2 — No Tack-On Systems.** Load-bearing because the
  reckoning telemetry fields are already authored as pipeline
  infrastructure; this workstream wires consumers to the existing
  infrastructure rather than recreating three independent copies of
  the same live-state reads. Named above.

## Drift risks

- **Risk: Loop (a) oscillation under wrong damping constant.** The
  angular-rate clamp is a rate-limiter on a feedback-adjacent
  composition (ESTABLISHING reads next-frame predicted azimuth →
  clamps delta → writes `_currentLookAtTarget` → next frame reads
  from the clamped output to predict again). If the damper is too
  tight, the camera lags the scene perceptibly (reads as "camera is
  sticky"); if too loose, the head-turn Max named is not resolved;
  if tuned against the wrong signal altitude (scalar rate vs
  axis-decomposed rate), the clamp can oscillate at the boundary.
  **Why it happens:** damping constants always need tuning, and
  without motion-evidence feedback (recording + Max review) the
  tuning loop is internal.
  **Guard:** loop (a) is the LAST loop. (b) and (c) land and are
  recording-verified first, so the pipeline (a) damps against is
  known-stable. (a)'s damping constant starts at ~600°/sec (the
  reckoning AC #8 threshold) — above this is "head turn" Max named
  as visible; below this is authored pan-ahead. Working-Claude
  surfaces the chosen value + evidence from a capture; Director
  audits. A single mid-workstream recording review before loop (a)
  commits is expected.

- **Risk: sub-2u framing composition distortion (Loop (a) cycle-2
  guard).** The `MIN_TARGET_DISTANCE = 2.0` floor is a safety
  precondition against `three.js lookAt` numerical instability — it
  does NOT encode a design intent about where the camera should
  frame. If LINGER engages on a body whose *body radius* itself is
  smaller than 2.0 scene units (small Sol moons: Phobos, Deimos-scale
  bodies, possibly some Jovian moons at close approach), the guard
  could push the look-at target **past** the body, outward along the
  camera-to-body direction. The resulting framing would visibly
  "look past" the body — the camera's forward axis crosses through
  the body and lands in empty space beyond it.
  **Why it happens:** the guard's outward-push direction is the
  unit-vector from camera to current target. If current target is
  the body's center and the body's surface is at 0.5u from camera,
  pushing to 2.0u from camera puts the look-at point 1.5u past the
  body along the same line-of-sight. Perceptually the body is still
  roughly centered — the lookAt direction only changes magnitude, not
  direction in the nominal case — but frame composition (body's
  apparent size, relative position of any secondary body in frame)
  shifts.
  **Guard:** cycle-2 capture is the falsification event. In the
  cycle-2 recording, LINGER motions on small bodies should still
  look like the camera is composed **on** the body, not on the
  body's peripheral neighborhood. If Max or Director sees LINGER
  visibly "looking past" a small moon — the body floats off-center
  while the camera holds a pose toward empty space behind it —
  reduce `MIN_TARGET_DISTANCE` to `1.0` and re-capture. If `1.0`
  still visibly distorts framing, escalate to Director — the
  outward-push **direction** is wrong (not the magnitude), and the
  guard needs a different mechanism class (Director's cycle-2 audit
  named this escalation explicitly).
  **Out-of-scope reminder:** small-moon LINGER framing authoring
  (how to compose on a sub-2u-radius body cinematically) is a
  separate concern. Loop (a) adds a numerical-stability floor only;
  it is NOT a framing-authoring mechanism.

- **Risk: Principle 5 bending without it breaking.** The wire-up is
  within the rules (read from earlier stage), but it's tempting to
  implement the "read" as `shipChoreographer.smoothedAbsDSpeed` or
  `cameraChoreographer.panAheadBias` — values the subsystems
  **output**, not **input**. A consumer reading another consumer's
  output across subsystem boundaries is Principle 5-adjacent but
  not strictly-compliant; it creates an implicit sibling-ordering
  constraint (shipChoreographer must update before anyone else
  reads its smoothed signal this frame) that's brittle.
  **Why it happens:** the existing `shipChoreographer.
  smoothedAbsDSpeed` getter (line 275) is the already-computed
  signal. "Read it" feels like zero-cost reuse.
  **Guard:** AC #10's grep + diff review. If loop (c) needs the
  `|d|v|/dt|` derivative in a consumer outside `ShipChoreographer`,
  extract the derivative computation into a shared early-stage
  helper (new module or new method on `NavigationSubsystem` where
  `shipVelocity` already lives per the continuity workstream's
  AC #7 field extension). PM's lean: loop (c) does NOT need to
  consume from outside ShipChoreographer — it's a self-consumer
  loop inside ShipChoreographer (the trigger reads the local-
  maximum detector on the SAME signal it already derives). The
  cross-subsystem risk is loop (a) — `EstablishingMode` reading
  per-body azimuth/altitude. That consumption's correct pathway
  is through the `nav` argument `CameraChoreographer.update()`
  already receives; the per-body fields come from the nav/body-
  ref channel, not from a telemetry-sampler output.

- **Risk: Telemetry becoming a bottleneck if overused.** The
  reckoning fields are computed per-frame over all bodies (12 at
  Sol × 60Hz = 720 field computations/sec). That's fine as
  observer-only work; if three subsystems each re-run per-body
  loops in their own update path in addition to the sampler, the
  per-frame cost multiplies.
  **Why it happens:** each loop's implementation instinct is
  "read the body I care about" which naturally becomes a per-body
  iteration.
  **Guard:** the live reads this workstream needs are scoped:
  loop (b) reads ONE body (the seam's departing-phase body ref);
  loop (a) reads per-body only at the specific composition decision
  point (which is already N-body in today's WS 3 code — no new
  iteration). Loop (c) does not read per-body at all — it's a
  self-consumer on the ship's own signal. The aggregate additional
  per-frame cost is loop (a)'s single per-body angular-delta
  computation on the damper's short-list — bounded to the bodies
  `EstablishingMode` considers for centering, not all bodies. If
  working-Claude's implementation of loop (a) introduces a new
  full-body iteration outside the centering decision, escalate to
  Director — the damper's scope is the composition site, not a
  new per-frame full-scene read.

- **Risk: Loop (b) regresses the C1 continuity the velocity-blend
  machinery provides, OR introduces a mid-window geometric
  artifact.** The blend's smoothstep ramp (`VelocityBlend.blendT`,
  line 78–82) is authored for position-derivative continuity at
  both ends of the 0.3–0.5s window. A single-anchor formula that
  ramp-scales body-delta on top of the seam entry (the original
  first-pass shape) satisfies C1 at blend-start but drifts off the
  body-relative radius mid-window — the captured position tracks
  an orbit at the wrong radius, which blows up `bodyInFrameChanges`
  as the body crosses every frame threshold (observed: AC #9
  18→554 violations, 2026-04-24 test capture). That was the
  origin of the Option 4 ruling.
  **Why it happens:** collapsing two independent continuities
  (momentum-at-start, body-frame-at-end) into one scalar ramp is
  structurally lossy — the mid-window geometry is the geometric
  cost of the collapse. Ramp-scaling the body-delta keeps the
  ship on a small-radius arc around the seam-entry position
  instead of on (or near) the approach-endpoint orbit radius
  around the body.
  **Guard:** the committed formula shape is the two-anchor
  Option 4 blend (see AC #1 verbatim). Both anchors must be
  computed independently every frame; `ramp` controls only the
  mix. `capturedVelocity` is restored to the seam-capture object
  so `ship_extrap` is well-defined. The ORBIT-entry geometric
  bound sub-criterion under AC #2 (distToBody ≤ 1.5× approach-
  endpoint during `_velocityBlend.active && _shipMode ===
  'ORBIT'`) is the direct regression guard — it would have caught
  the first-pass artifact on capture #1 instead of waiting on
  `bodyInFrameChanges` to amplify the symptom. AC #2's velocity-
  direction angle ≤ 15° at seam remains the C1-continuity guard.

- **Risk: Loop (c)'s local-maximum detector introduces one-frame
  lag.** A three-point peak detector (`prev < curr < next`) requires
  seeing the next frame's signal before firing, which is a one-frame
  event-onset lag. At 60Hz that's ~16ms — below perceptual
  threshold for an event whose envelope is 1–2s long, but worth
  naming.
  **Why it happens:** three-point peak detection needs all three
  points.
  **Guard:** a two-point variant (`prev <= curr` with a post-hoc
  "and current value is in the top percentile of the signal
  trajectory so far") can fire on-frame at the cost of slightly
  more permissive firing. Working-Claude picks based on AC #5's
  percentile evaluation — whichever variant passes AC #5 at 100%
  (or Director-sanctioned tolerance) is the committed shape.

- **Risk: Scope creep into "also fix the zoom cycle."** Max's
  original continuity rejection (2026-04-24) named three visible
  issues: head-turn on arrival, pause-zoom-in-zoom-out cycle,
  jerky motion on moon transition. This brief addresses the head-
  turn (loop a) and the moon-motion jerk (loop b). **The zoom
  cycle is NOT in scope.** The reckoning telemetry now carries a
  `camFov` field; a zoom-cycle diagnostic audit may be added in a
  follow-up workstream (not this one) if the reckoning Sol capture
  + subsequent recordings show FOV changes Max can attribute to
  the cycle he saw. As of 2026-04-24 the zoom cycle's cause is
  unidentified — possibly a camera-position write somewhere
  (violating Principle 5 / WS 3's AC #3), possibly a FOV tween
  in an unexpected place. Out of scope until the diagnostic
  narrows the cause.
  **Why it might happen:** "we have the camFov field, let's just
  look at it and fix the cycle too" is a 20-minute-looking diff
  until it turns out the cycle is in `FlythroughCamera` or
  elsewhere and the diff becomes a cross-module debugging hunt.
  **Guard:** out-of-scope block below names it explicitly.

## In scope

- **Loop (b) — `NavigationSubsystem.js:update()` lines 310–317**
  (the blend-apply region) refactored to read live per-body
  position for the blend target. `VelocityBlend` helper unchanged.
  Per-seam handling (which body ref to read at each seam) documented
  inline. Seam 1 / Seam 2 / Seam 3 each updated accordingly — the
  per-seam body ref is documented (likely `_travelToBody` or
  equivalent, confirmed at implementation time).

- **Loop (c) — `ShipChoreographer.js:385` onset gate** augmented
  with a local-maximum detector on `_smoothedAbsDSpeed` (or
  equivalent). Per-leg fire budget + warp-exit gate + cooldown
  unchanged. Onset type (accel/decel) derivation unchanged (via
  `_signedDSpeed` sign at onset). Local-maximum detector is the
  single additional predicate.

- **Loop (a) — `CameraChoreographer.js:EstablishingMode.update()`**
  extended with TWO co-mechanisms on the raw target before commit
  to `_currentLookAtTarget`:
    1. **Angular-rate clamp** (`MAX_FRAME_ANGULAR_RATE_DEG_PER_SEC
       = 450`, cycle 1). Clamps the angular delta between the
       prior-frame `_currentLookAtTarget` and this-frame's raw
       computed target.
    2. **Target-distance guard** (`MIN_TARGET_DISTANCE = 2.0` scene
       units, cycle 2). Ensures `|_prevRawTargetFrame − shipPos| ≥
       MIN_TARGET_DISTANCE`; if closer, push outward along current
       direction with the degenerate fallback chain (prior-frame
       direction → camera forward) from AC #7.
  Both constants exposed at top of module as named tunables
  alongside `LINGER_DURATION` and `PAN_AHEAD_FRACTION`. Both apply
  to TRACKING, PANNING_AHEAD, and LINGERING→TRACKING fall-through
  via single-point placement after the switch's closing brace
  (guard first, then clamp).

- **Motion evidence per AC #3, AC #6, AC #9.** Three canvas
  recordings (or one composite Sol tour that covers all three
  classes of moment). Drop paths:
    - `screenshots/max-recordings/autopilot-live-feedback-loop-b-2026-04-24.webm` (loop b moon-transition recording)
    - `screenshots/max-recordings/autopilot-live-feedback-loop-c-2026-04-24.webm` (loop c long-leg shake recording)
    - `screenshots/max-recordings/autopilot-live-feedback-loop-a-2026-04-24.webm` (loop a on-arrival recording)

- **Reckoning audit runs per AC #2, #5, #8, #11.** On each loop's
  post-fix capture, `runAllReckoning` + existing shake audits run
  and results are committed alongside the corresponding loop's
  commit (either in commit message or this brief's Status
  appendix).

- **Commits per AC #12.** Three minimum, one per loop, in loop
  order.

- **Feature-doc `## Workstreams` section** updated to list this
  brief under "Child workstream briefs." Committed as part of
  this workstream's bootstrap commit.

- **This brief's `## Status`** flipped through the lifecycle:
  `HELD → Drafted → VERIFIED_PENDING_MAX → Shipped`.

## Out of scope

- **The pause-zoom-in-zoom-out cycle Max named in the continuity
  rejection.** See drift-risk above. Follow-up workstream gated
  on diagnostic narrowing of the cause; reckoning `camFov` field
  is the observability foundation; no fix here.

- **Any shake mechanism change.** Envelope shape, carrier
  frequency, rotation surface, per-leg budget, cooldown window —
  all unchanged. Loop (c) replaces only the signal the trigger
  reads.

- **Any framing-state authoring change.** Linger duration, pan-
  ahead magnitude, new framing states, linger-on-which-body
  semantics — all unchanged. Loop (a) adds only a rate-limiter
  on the composition output.

- **Any new body-motion model.** The per-body positions this
  workstream reads are whatever the existing generators + orbit
  animation write each frame. No changes to moon-orbit-around-
  planet authoring, planet-orbit-around-star authoring, or the
  physics of body motion.

- **Any new reckoning telemetry field.** The fields land in the
  reckoning workstream's Shipped flip. If a loop discovers it
  needs a field that isn't yet authored, escalate to PM — that's
  scope inversion (the reckoning brief was authored to include
  every field needed to diagnose the three named issues; needing
  more is either a loop-implementation mistake or a sign the
  diagnosis was incomplete).

- **Headless / CI integration of the reckoning audits.** The
  audits run against live-canvas tour captures via `mcp__chrome-
  devtools__*` during agent sessions. Headless wiring is separate
  infrastructure.

- **WS 4 toggle UI + warp-select follow-up.** Waits behind this
  workstream.

- **Continuity workstream's own Shipped flip.** Waits behind this
  workstream's Shipped flip. Continuity re-audit runs against
  the new pipeline once this Ships; on pass, continuity flips to
  `Shipped <continuity-sha>` against its original or re-recorded
  motion evidence.

- **Retiring the `VelocityBlend` class.** Loop (b) keeps it — the
  blend window + smoothstep ramp are the mechanism for the C1
  continuity at seam boundaries; only the blend target moves from
  captured-extrapolation to live-per-body.

- **The parked travel-feel speed-field issue** (`docs/FEATURES/
  autopilot.md` §"Parking lot"). Unrelated to live-feedback; feature-
  level articulation work Max has parked for a separate pass.

- **OOI-infrastructure work.** Separate workstream; this one
  doesn't touch `getNearbyOOIs` / `getActiveEvents` interfaces.

## Handoff to working-Claude

**Precondition: Director audit.** This brief is `HELD — pending
Director audit`. Execution begins only after Director releases
the gate. If Director pushes back on loop order, loop boundaries
(e.g., proposes extracting `|d|v|/dt|` into a shared helper as
part of loop c's scope), or the damping-constant starting value,
iterate the brief before starting code.

Read this brief first. Then, in order:

1. **`docs/WORKSTREAMS/autopilot-telemetry-reckoning-2026-04-24.md`**
   — the parent observer workstream. Especially `## Retroactive
   diagnosis appendix (AC #12)` which names the specific
   violations each loop resolves, and `## Scope statement` which
   names the six telemetry-field extensions this workstream's
   consumers can now read.
2. **`docs/WORKSTREAMS/autopilot-phase-transition-velocity-
   continuity-2026-04-23.md`** — the HELD workstream loop (b)
   supersedes (partially). Read the `## Status` verbatim-Max
   rejection for the moon-transition jerk, and `## Candidate
   unified fix pattern` for the `VelocityBlend` machinery loop (b)
   preserves but re-targets.
3. **`docs/WORKSTREAMS/autopilot-shake-redesign-2026-04-21.md`**
   — the Shipped round-11 workstream loop (c) augments. Read the
   `## Status` Round-11 scope (per-leg fire budget) + `## How to
   tune` for the signal-trigger constants. Loop (c) does NOT
   retune any of them — it adds a predicate only.
4. **`docs/WORKSTREAMS/autopilot-camera-axis-retirement-
   2026-04-23.md`** — the Shipped round-2 workstream loop (a)
   supplements. Read the `## Status` round-2 patch summary
   (linger body-ref cache + transition blend) + the WS 3 ACs
   #4–#6 authored behavior loop (a) preserves.
5. **`src/auto/NavigationSubsystem.js` L280–349** — `update()`,
   blend-apply region (310–317), `_captureSeamAndBegin` (341–349).
   This is loop (b)'s edit surface.
6. **`src/auto/NavigationSubsystem.js` L428–444** — `_beginTravel`
   seam-1 consume region. Loop (b)'s seam-1 pathway.
7. **`src/auto/VelocityBlend.js`** in full — loop (b) does NOT
   touch this file; the machinery is preserved.
8. **`src/auto/ShipChoreographer.js` L360–408** — the signal
   derivation + onset-detection branch. This is loop (c)'s edit
   surface.
9. **`src/auto/ShipChoreographer.js` L215, L275** — the signal
   state variable + getter. Useful for understanding what's
   already exposed.
10. **`src/auto/CameraChoreographer.js` L180–310** —
    `EstablishingMode.update()` (effectively at the top-level
    `update()` per round-2). This is loop (a)'s edit surface.
    Especially L259–287 (TRACKING / PANNING_AHEAD branch) where
    the raw target is computed.
11. **`src/auto/CameraChoreographer.js` L63–91** — the existing
    tunable constants (LINGER_DURATION, PAN_AHEAD_FRACTION,
    PAN_AHEAD_RAMP, PAN_AHEAD_DECAY). Loop (a)'s new clamp
    constant sits alongside these.
12. **`src/main.js` L900** — `smoothedAbsDSpeed` sampled via
    `shipChoreographer.smoothedAbsDSpeed.toFixed(4)`. Reckoning
    field already carries the signal; confirm loop (c)'s choice
    of reading the internal `_smoothedAbsDSpeed` vs the per-
    sample reckoning field.
13. **`docs/GAME_BIBLE.md` §11 Principle 5** (L1658–1666) — the
    one-direction flow canon. The telemetry-as-pipeline framing
    Director approved is a pipeline-extension of this.
14. **`docs/PERSONAS/pm.md` §"Per-phase AC rule"** — the AC shape
    for behavioral-outcome ACs (#2, #3, #5, #6, #8, #9).
15. **`docs/PERSONAS/pm.md` §"Per-phase AC rule carve-out:
    process / tooling workstreams"** — the contract-shaped ACs
    (#1, #4, #7, #10, #11).

Then, in loop order (NOT in numeric AC order):

**Loop (b) — live per-body read at seam-blend anchor (Option 4
two-anchor blend).**

1. Identify the per-seam body ref. Seam 1 (STATION→CRUISE)
   captures in `_updateOrbit` on `orbitComplete`; the blend
   target during the 0.5s window is the body the ship just
   STATION-ed (receding subject). Seam 2 (TRAVEL→APPROACH)
   captures at `t >= 1` in `_updateTravel`; the blend target is
   the body the ship is approaching (`this.bodyRef`). Seam 3
   (APPROACH→ORBIT) captures at approach-end; blend target is
   `this.bodyRef` (same body). Document the per-seam mapping in
   the commit message.
2. **Restore the `capturedVelocity` capture** at seam entry.
   The simplified first-pass Loop (b) removed it when the formula
   was single-anchor; Option 4 needs it back. Compute at seam
   entry as `(this._position.clone().sub(this._prevPosition)).
   divideScalar(deltaTime)` (or equivalent live per-frame delta
   source) and store on the seam-capture / `_velocityBlend`
   object alongside `_seamEntryPosition` and
   `bodyPositionAtSeamEntry`.
3. Refactor `update()` L310–317 to implement the Option 4
   two-anchor blend per AC #1 verbatim:

   ```
   ship_extrap  = _seamEntryPosition + capturedVelocity × elapsed
   body_tracked = _seamEntryPosition + (body.position − bodyPositionAtSeamEntry)
   capturedPos  = ship_extrap + (body_tracked − ship_extrap) × ramp
   // ramp = elapsed / duration (or the smoothstep of that via _velocityBlend.blendT)
   ```

   Both anchors are computed independently every frame. Do NOT
   ramp-scale the body-delta; `ramp` controls only the mix.
   At `ramp=0`, capturedPos = ship_extrap (satisfies C1 at start
   by construction). At `ramp=1`, capturedPos = body_tracked
   (frame-locked to body at end). At Seam 3 (APPROACH→ORBIT)
   where `capturedVelocity = 0`, ship_extrap degenerates to
   `_seamEntryPosition` and the formula reduces naturally to
   body-tracked mixing — this is correct, not a special case.
4. Run `window._autopilot.telemetry.audit.bodyInFrameChanges` +
   continuity audits on a fresh Sol D-shortcut tour. Verify
   AC #2 including the **ORBIT-entry geometric bound sub-
   criterion** (distToBody ≤ 1.5× approach-endpoint during
   `_velocityBlend.active && _shipMode === 'ORBIT'`). If the
   geometric bound fails, the formula has an artifact — do NOT
   ship loop (b) until it passes. Target telemetry deltas from
   first-pass baseline: AC #8 violations ≤ 5 (first-pass hit
   this), AC #9 violations near zero (first-pass was 554 —
   the regression the two-anchor shape is designed to fix),
   record-scratch amplitude/coverage at or below the pre-loop-
   (b) baseline.
5. Capture the AC #3 recording. Commit loop (b) per AC #12
   commit 1. Close `VERIFIED_PENDING_MAX <sha>` for loop (b)
   specifically.

**Loop (c) — local-maximum predicate for shake onset.**

5. Decide: replace `_smoothedAbsDSpeed >= SIGNAL_ONSET_THRESHOLD`
   with `local-maximum + threshold` (two predicates AND'd), OR
   keep the threshold and add local-maximum as a third predicate.
   PM lean: add as third predicate (preserves threshold behavior;
   narrows firing to peaks only). Document choice in commit.
6. Implement the three-point (or two-point with percentile)
   detector. Test with `window._autopilot.debugAccelImpulse()` /
   `debugDecelImpulse()` — these bypass gates so the detector
   itself is tested via natural-fire captures.
7. Capture a long-leg / warp-arrival tour that fires natural
   shake events (the reckoning capture on Sol D-shortcut fired
   zero natural events per the reckoning appendix — a different
   tour shape is needed). Run
   `window._autopilot.telemetry.audit.shakeVelocityCorrelation`;
   verify AC #5.
8. Capture the AC #6 recording. Commit loop (c) per AC #12
   commit 2. Close `VERIFIED_PENDING_MAX <sha>` for loop (c).

**Mid-workstream pause.** Surface a status to Max + Director:
- Loops (b) and (c) committed and audit-passing.
- The damping-constant starting value for loop (a) (default ~600°/
  sec per brief; working-Claude may propose a different starting
  value with evidence).
- Any recording-observation that changes the loop-(a) shape.

**Loop (a) — frame-to-frame angular rate clamp.**

9. Name a constant at top of `CameraChoreographer.js`:
   `MAX_FRAME_ANGULAR_RATE_DEG_PER_SEC = 600` (or Director-
   sanctioned starting value). Document the interaction with
   LINGER_DURATION, PAN_AHEAD_FRACTION, PAN_AHEAD_RAMP,
   PAN_AHEAD_DECAY — the clamp is a ceiling that those authored
   rates should never naturally exceed; if they do at default
   values, either the clamp is too tight or the authored values
   are.
10. Implement the clamp in the main `update()` at the raw-target
    commit site. Apply before `_currentLookAtTarget.copy(this._
    prevRawTargetFrame)` (or the equivalent assignment in the
    round-2 transition-blend region).
11. Run `window._autopilot.telemetry.audit.cameraViewAngularContinuity`
    + `bodyInFrameChanges` on a fresh Sol D-shortcut tour. Verify
    AC #8.
12. Capture the AC #9 recording. Commit loop (a) per AC #12
    commit 3.

**Workstream close.**

13. Run `runAllReckoning` + all four shake audits + the continuity
    audits on a consolidated fresh tour. Verify AC #11.
14. Update this brief's `## Status` with per-loop Shipped SHAs and
    recording paths.
15. Close at `VERIFIED_PENDING_MAX <final-sha>` — Max evaluates
    against the three recordings. On pass → `Shipped <sha> —
    verified against <recording-paths>`. On fail → diagnose per
    failure class (damper too tight / too loose for loop a;
    local-maximum detector too strict for loop c; per-seam body
    ref wrong for loop b).

**If the diff to any consumer reads from `window._autopilot.
telemetry.samples` or equivalent sampler output, stop and
escalate to Director.** AC #10 / Principle 5 violation — the
fix is to extract the live-state derivation into a shared early-
stage helper.

**If the damper's constant pushes below 300°/sec and AC #9 still
fails, stop.** The mechanism is wrong, not the tuning. The
PANNING_AHEAD raw-target computation itself needs attention, not
the clamp.

**If loop (c)'s local-maximum detector is introducing >1-frame
event-onset lag (AC #5 passes but shake onset perceptibly lags
Max's felt peak in the recording), stop and escalate to Director.**
The two-point variant may be needed.

Artifacts expected at close: 3–4 commits (one per loop + optional
shared-helper extraction); three (or one composite) canvas
recordings; this brief at Shipped with per-loop SHAs and
recording paths; feature doc's `## Workstreams` section updated.

**After this workstream ships:**

1. Continuity workstream re-audits against the new pipeline; on
   pass, flips to `Shipped <sha>` against its original or re-
   recorded motion evidence.
2. Shake-redesign parking-lot "shake at random" concern closes.
3. WS 3 PANNING_AHEAD/APPROACH head-turn finding closes.
4. WS 4 (autopilot-toggle UI + warp-select follow-up)
   greenlights.
5. If the pause-zoom-in-zoom-out cycle is still visible in
   recordings post-workstream, a follow-up workstream scopes the
   diagnosis (reckoning `camFov` field is the observability
   foundation).

Drafted by PM 2026-04-24 following Max's reckoning-brief question
("can we leverage this as real-time input?") and Director's
three-loop ruling.
