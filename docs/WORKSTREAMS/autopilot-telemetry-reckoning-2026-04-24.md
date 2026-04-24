# Workstream: Autopilot telemetry reckoning — make the self-audit report what Max actually sees in the 3D scene (2026-04-24)

## Status

`HELD — pending Director audit.`

Stop-the-line workstream. **Supersedes** the drafted
`autopilot-telemetry-coverage-2026-04-23` brief (at `4f9e1bb`), which was
scoped too narrowly — WS 3 + shake-redesign AC #19 backfill only —
while the continuity workstream's `VERIFIED_PENDING_MAX f90ae2e` flip
and the WS 3 Shipped flip both leaned on a telemetry pipeline that did
not in fact describe what Max was seeing in the 3D scene.

**Blocks:**

- the continuity re-audit cycle (the continuity workstream is at
  `HELD — REJECTED on 2026-04-24, telemetry insufficient` and waits
  for this brief's audits to land before its code at `f90ae2e` can
  be re-verified);
- **WS 4** (autopilot-toggle UI + warp-select follow-up), which was next
  on the roadmap before the reckoning intervened.

The `~/.claude/state/dev-collab/active-workstream` pointer is flipped
to this brief on the commit that lands it. Execution begins only after
Director audit.

## Revision history

- **2026-04-24 — authored.** Max viewed the continuity workstream's
  recording and rejected the flip. PM and Director had both closed
  the `VERIFIED_PENDING_MAX f90ae2e` claim against telemetry results
  (velocity-direction angle ≤ 0.1° at seams; shake `runAll` PASS).
  Max's review of the same recording surfaced three specific visible
  issues the audits did not catch:
  1. A **head turn on arrival at the planet** — camera view direction
     swung visibly, but the existing `camLookAt` position-delta
     measurement registered as smooth.
  2. A **pause-zoom-in-zoom-out cycle** at arrival — a FOV or position
     change not captured in any telemetry field.
  3. **Jerky motion on transition to the moon** — a velocity-direction
     discontinuity the continuity workstream was supposed to fix and
     didn't, and that the `f90ae2e` audit did not catch.
  Plus: shake fires at *"kind of random points,"* not correlated with
  actual velocity-change peaks.

  Max's verbatim ultimatum:

  > *"If the telemetry system right now, as it is, is supposed to
  > give me all of these points of information that I care about …
  > if it doesn't do that today, then we need to stop, and I need you
  > to actually implement a system that does those things."*

  Director owned the miss (audits were released against criteria the
  audits didn't actually test) and ruled **stop**. This brief is the
  stop-the-line answer.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
`bdeb0ff`, keybinding update at `4b9b18a`, parking-lot entries at
`79cdf4e` + `14835cc`, WS 3 entry at `a1019da`, continuity
phase-transition criteria at `14835cc`.

This workstream does not add new feature criteria. It encodes the
existing autopilot feature's authored behavior as observable telemetry
so the audits describe what Max sees, not a proxy of it. Specifically
it services:

- **§"Camera axis — ESTABLISHING (V1)"** — the authored linger,
  pan-ahead, independent-pacing criteria, plus the implicit criterion
  that camera *angular* motion (view direction) matches authored intent.
  The head-turn-on-arrival miss means ESTABLISHING's criteria need
  angular observables, not only lookAt-position observables.
- **§"Phase-level criteria (V1) — STATION"** — the "orbit commences
  pretty normally" read-across after ESTABLISHING is the reference;
  any FOV / zoom / re-frame *during* STATION that Max can see must
  be observable.
- **§"Phase-transition velocity continuity (V1)"** — the
  STATION→CRUISE, TRAVEL→APPROACH, APPROACH→ORBIT criteria. The
  current continuity workstream's audits measure magnitude + direction
  at the seam frame itself but don't detect the **curvature jumps**
  (`d²pos/dt²` step-changes) that read as "jerky." The moon-transition
  jerk Max named is a curvature-class observable, not a
  magnitude/direction-class one.
- **§"Gravity drives — ship-body shake on abrupt transitions"** —
  shake authored to correlate with the velocity-change peaks. The
  "fires at random points" read means the audits cannot distinguish
  peak-correlated onsets from off-peak onsets. `signalCoincidence`
  (AC #17) only checks that `smoothedAbsDSpeed ≥ floor` at onset; it
  does not check that the onset sits at a *local maximum* of the
  signal envelope.

## Implementation plan

N/A (workstream-sized). All additions land in `src/main.js`:
`_captureTelemetrySample` gets additional read-only snapshots;
`window._autopilot.telemetry.audit.*` gets three new helpers plus a
`runAllReckoning` convenience; a small shake-event log is maintained
adjacent to the samples buffer. No new module seam, no changes to any
behavioral code path. If mid-work a capture requires a new
computation inside ShipChoreographer / CameraChoreographer /
NavigationSubsystem (rather than a read-only snapshot via existing
getters), stop — that's scope inversion and an escalation.

## Scope statement

**Encode, in telemetry, every class of motion Max can see in the 3D
scene** so the next continuity re-audit and every subsequent change
set answers *"what did the tour actually do"* rather than *"did the
fields we already sample stay within thresholds we already defined."*
The failure mode this workstream closes: audit-released code whose
recording shows Max-visible regressions in classes of motion the
audit doesn't know how to observe. Head-turn on arrival is the
canonical example — a 60°+ change in camera view direction inside
a ~0.5 s window is an ESTABLISHING-criterion regression; it's
measurable; nothing in the current sample shape computes it.

This is an **observer** workstream — no behavioral code changes. All
deliverables are reads on existing public getters (camera forward,
camera FOV, body positions, ship velocity, nav subsystem state, ship
choreographer state).

This includes:

- **Six telemetry-field extensions** in `_captureTelemetrySample()`
  (Director-specified):
  1. **All-bodies snapshot** per frame. The set of in-system bodies
     (star, planets, moons) with `{ name, type, position: [x,y,z],
     radius }`. Enumerated from the module-local `system` variable
     (star / star2 / planets[].planet / planets[].moons[]); confirm
     exposure path during execution (currently accessible inside
     `main.js` closure but not on `window` — working-Claude may
     need to pass `system` into `_captureTelemetrySample`'s closure
     or expose a `window._currentSystemBodies()` helper).
  2. **Camera angular rates** (`camYawRate`, `camPitchRate`) per
     frame, derived from `camFwd[i-1]` and `camFwd[i]` via a
     yaw/pitch decomposition (yaw = `atan2(x, -z)` in the X-Z plane;
     pitch = `asin(y)`). Output in rad/s. Measured frame-over-frame
     in the capture; samples retain raw camFwd as today, the audits
     derive rates on read (or captured as a field for simpler audits
     — working-Claude's call, document the choice).
  3. **Camera FOV** per frame (`camera.fov`). Captures the zoom-in/
     zoom-out Max named. FOV is already a `PerspectiveCamera` property
     in three.js; copy via `camera.fov` with `.toFixed(4)` precision.
     Samples carry `camFov` scalar; a derived `camFovRate` is computed
     at audit time.
  4. **Ship speed in two units.** Existing `shipVelocity` vec3 in
     scene-units. Add: `shipSpeedSceneUnitsPerSec` (magnitude of
     `shipVelocity`, as a convenience scalar) and
     `shipSpeedLightYearsPerSec` (scene-units/s ÷ `SCENE_PER_LY =
     63,241,077`; derived at capture so audits and humans can read
     without re-conversion). **Light-year ↔ scene mapping is NOT in
     `src/core/ScaleConstants.js` today** — it is derivable from the
     existing `AU_TO_SCENE = 1000` constant (1 ly = 63,241.077 AU,
     so 1 ly = 63,241,077 scene units), but is not exported. Flag
     for Director: either extend `ScaleConstants.js` with
     `LIGHT_YEAR_AU` + `lyToScene` / `sceneToLy` helpers and use
     them here (my recommendation — centralizes the constant for
     any future use), or inline the constant at the telemetry site
     with a citation comment. Director's call.
  5. **Ship position relative to each body** — for each body in (1):
     `distanceScene` (scalar) and `approachRate` (scalar, positive =
     closing; computed as `dot(shipVelocity, bodyDirection)` where
     `bodyDirection = normalize(bodyPos − shipPos)`). One record per
     body per frame. At a 12-body system (Sol) × 60 Hz × 60 s = 43 k
     scalar pairs — sub-MB at `.toFixed(4)`. Confirm buffer-size OK
     during execution.
  6. **Body angular coordinates in camera view** — for each body in
     (1), its angular coordinates relative to camera forward:
     `azimuthRad` (angle in the horizontal plane) and `altitudeRad`
     (vertical angle). Computed via basis change of `(bodyPos −
     camPos)` into the camera's right / up / forward basis and an
     `atan2`. Enables the bodies-in-frame audit.

- **Shake-event log.** Separately tracked from per-frame samples
  (onset-timestamped, one record per shake event). On each
  `_firedThisLeg[type] = true` transition observed (or equivalent
  per-onset hook), append
  `{ onsetT, eventType, smoothedAbsDSpeed_at_onset, leg_id_or_timestamp }`.
  Implementation: a lightweight per-frame check inside
  `_captureTelemetrySample` that looks for the eventOnsetTime
  transition (already exposed via `shipChoreographer.eventOnsetTime`).
  Buffer lives in `_telemetryState.shakeEvents` alongside `samples`.

- **Four audit helpers** at `window._autopilot.telemetry.audit.*`,
  each returning `{ passed, violations, totalSamples }`:

  1. **`cameraViewAngularContinuity(samples, options?)`** — flags
     frames whose total camera-forward angular change
     (combined yaw + pitch) exceeds a threshold (default: 10°/frame
     ≈ 600°/s at 60 Hz) AND the frame is *not* inside an authored
     rotation-blend window. Authored windows: during
     `FlythroughCamera._rotBlendDuration` (camera's post-motion-start
     blend), during an explicit framing-state transition flagged on
     that frame, or during warp/portal sequences. The audit reports
     violation frames with their angular-delta magnitude and the
     active phases/modes at that frame for triage. **This is the
     head-turn-on-arrival detector.**

  2. **`bodyInFrameChanges(samples, options?)`** — for each sample,
     identify the body *most centered* in camera view (smallest
     angular distance from camFwd, computed from field 6 above).
     Detect "flip-to-different-body" events where the centered body
     changes for < 0.5 s (default; configurable) and then flips back.
     This is the **quarter-second-glance detector** — if the camera
     briefly centers on a different body then returns, it's reported
     as a violation. An authored pan-ahead that smoothly traverses
     bodies is continuous centering; a glance is a discontinuity.

  3. **`shakeVelocityCorrelation(samples, events, options?)`** — for
     each logged shake-event onset, compute the max
     `smoothedAbsDSpeed` within the ±0.5 s window around the onset.
     Flag events where that max does NOT fall in the top 80th
     percentile of the entire tour's `smoothedAbsDSpeed` distribution.
     Expected behavior: authored shake fires at *local peaks*, so
     every onset's windowed max lands in the top tier; "random"
     firing is uncorrelated and distributes across percentiles.
     This turns *"feels random"* into a regression-testable
     observation.

  4. **`runAllReckoning(samples, events?)`** — combined report.
     Mirrors shake `runAll()`'s shape at `src/main.js` L606–620.
     Returns
     `{ passed, cameraViewAngularContinuity: {...}, bodyInFrameChanges: {...}, shakeVelocityCorrelation: {...}, totalSamples, totalShakeEvents }`.

**Explicitly NOT a license to rewrite WS 3 / continuity / shake-redesign
ACs.** The three new audits add *new classes of observation*; they do
not supersede `runAllCameraAxis` (if working-Claude later lands it) or
`runAll` (shake). A future combined report
(`runAllAutopilotAudits`) composes them all, but that composition is
out of scope here — keep this workstream tight.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 6 — First Principles Over Patches.** The first-principles
  shape of autopilot regression verification is *"the audit observes
  the classes of motion the feature can exhibit, and compares what
  was observed against what the feature's criteria say it should be
  doing."* The patch move is *"define audits against the fields we
  already have and call it verification."* The continuity workstream's
  `f90ae2e` closure is the canonical instance of the patch move: the
  recording showed a head-turn, a zoom cycle, and a moon-transition
  jerk; none of the three classes of motion had a telemetry field
  that could describe them; the audits all PASSED. First-principles
  move: encode classes of motion as observables *before* the next
  audit-released close. *Violation in this workstream would look like:*
  adding a scalar field ("did the view turn a lot? a single scalar
  between 0 and 1") rather than the per-frame angular-rate timeseries
  that a threshold-based detector needs. Or: a "bodies visible"
  boolean instead of the angular-coordinate record that a
  centering-change detector needs. Symptom-altitude fields cannot
  compose into criterion-altitude audits — the shape matters.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Telemetry is strictly a **read-side observer** on the
  pipeline. All six new fields are reads on existing public getters
  and on module-local state. No field computation mutates
  `cameraChoreographer`, `navSubsystem`, `shipChoreographer`, or
  `camera`. *Violation in this workstream would look like:* caching
  `camFwd[i-1]` inside `camera` or `cameraChoreographer` instead of
  inside `_telemetryState` or a capture-local variable. The subject
  is the sampler, not the rendered objects.

- **Principle 2 — No Tack-On Systems.** All six fields and all three
  audits land on the existing `_captureTelemetrySample` function and
  the existing `window._autopilot.telemetry.audit.*` namespace. The
  one structural addition — the shake-event log — lands as
  `_telemetryState.shakeEvents` adjacent to `_telemetryState.samples`,
  with matching `.start()` / `.stop()` lifecycle. *Violation in this
  workstream would look like:* a separate `_autopilot.reckoning.*`
  namespace, a new capture-lifecycle, a parallel reporting shape.

## Acceptance criteria

Contract-shaped per `docs/PERSONAS/pm.md` §"Per-phase AC rule carve-out:
process / tooling workstreams." This is a telemetry / tooling
workstream — observers on top of existing feature behavior, does
not author new user-visible phases — so ACs cite the deliverable's
interface + a verifiable observation rather than quoting feature-doc
phase sections verbatim.

### Per-field ACs

1. **All-bodies snapshot field lands on every sample.**
   - `_captureTelemetrySample` produces samples with a `bodies: Array`
     field.
   - Each entry: `{ name: string, type: 'star'|'planet'|'moon', position: [x,y,z], radius: number }`.
   - Enumerated from `system.star` (+`system.star2` if present),
     `system.planets[].planet` (with `.data.radius` → `radiusScene`
     via the existing generator convention), `system.planets[].moons[]`
     (iterate through all planets' moon arrays).
   - All three `{x,y,z}` components rounded to `.toFixed(4)`;
     `radius` likewise.
   - Verification: stop a Sol tour capture; inspect `samples[0].bodies`;
     assert the count equals `1 (star) + planets.length + sum(moons per planet)`.

2. **Camera angular-rate fields land.**
   - Samples carry `camYawRate` and `camPitchRate` scalars in rad/s
     (or rad/frame; document which and be consistent across audit
     code).
   - First sample's rates are `0` (no prior frame).
   - Subsequent samples' rates derive from `camFwd[i-1]` and
     `camFwd[i]` via yaw = `atan2(x, -z)`, pitch = `asin(y)`,
     with wrap-handling on yaw (`atan2`-delta, not raw subtraction).
   - Verification: synthetic test — push two manual samples
     (camFwd = `[0,0,-1]` then `[1,0,0]`); assert `camYawRate`
     reflects a +90° rotation scaled by 1 / deltaT.

3. **Camera FOV field lands.**
   - Samples carry `camFov: number` (degrees or radians — document
     and be consistent; three.js `camera.fov` is in degrees).
   - Rounded to `.toFixed(4)`.
   - Verification: capture during a tour; inspect samples; confirm
     field is populated every frame.

4. **Ship speed in multi-unit lands.**
   - Samples carry `shipSpeedSceneUnitsPerSec: number`
     (magnitude of `shipVelocity`).
   - Samples carry `shipSpeedLightYearsPerSec: number` (converted
     from scene-units via the documented `SCENE_PER_LY` constant).
   - Extend `src/core/ScaleConstants.js` with `LIGHT_YEAR_AU = 63241.077`
     + `lyToScene(ly)` + `sceneToLy(scene)` helpers. Use `sceneToLy`
     at the telemetry site. No Bible edit.
   - Verification: synthetic test — `shipVelocity = [1, 0, 0]`
     (1 u/s) → `shipSpeedSceneUnitsPerSec = 1`,
     `shipSpeedLightYearsPerSec ≈ 1.58 × 10⁻⁸`.

5. **Ship-to-body distance + approach-rate fields land.**
   - Samples carry `bodyRelatives: Array` (parallel to `bodies`
     by index) with `{ distanceScene: number, approachRate: number }`
     per body.
   - `distanceScene = |bodyPos − shipPos|`.
   - `approachRate = dot(shipVelocity, normalize(bodyPos − shipPos))`
     — positive when closing, negative when receding, zero when
     perpendicular (or at rest).
   - When `shipVelocity` is null (ship not in motion / no plan),
     `approachRate` is `null` or `0` — document which.
   - Verification: Sol tour capture; assert for the STATION phase
     around a given planet that `approachRate` for that planet
     hovers near `0` (orbiting tangentially), and for the incoming
     next body that `approachRate` ≥ 0 during CRUISE toward it.

6. **Body angular-coordinates field lands.**
   - Samples carry `bodyAngles: Array` (parallel to `bodies` by
     index) with `{ azimuthRad: number, altitudeRad: number }` per
     body. Units radians, `.toFixed(6)`.
   - Derived via basis change of `(bodyPos − camPos)` into
     `{ right, up, forward }` basis with
     `forward = camFwd`, `up = camera.up`, `right = forward × up`
     (normalized); then
     `azimuthRad = atan2(rightComponent, forwardComponent)` and
     `altitudeRad = atan2(upComponent, horizontalMag)`.
   - Bodies behind the camera report `|azimuthRad| > π/2` (or a
     documented sentinel); audits that ignore behind-camera bodies
     filter on `forwardComponent > 0`.
   - Verification: synthetic test — camera at origin facing `-Z`,
     body at `[0, 0, -10]`; assert `azimuthRad ≈ 0`, `altitudeRad ≈ 0`
     (body centered). Move body to `[10, 0, -10]`; assert
     `azimuthRad ≈ 0.785 rad` (~45°).

7. **Shake-event log populates.**
   - `_telemetryState.shakeEvents: Array` is created by
     `telemetry.start()` and returned/cleared by `telemetry.stop()`
     alongside `samples`.
   - On each frame where
     `shipChoreographer.eventOnsetTime !== previousOnsetTime`
     (new onset), append
     `{ onsetT: performance.now(), eventType: shipChoreographer.eventType, smoothedAbsDSpeedAtOnset: shipChoreographer.smoothedAbsDSpeed, legContext }`.
     `legContext` can be `navPhase` + `shipPhase` + current
     `currentTargetType` — enough for post-hoc filtering.
   - Verification: capture during a tour with ≥ 1 leg; expect ≥ 1
     event; confirm each `eventType ∈ {'accel', 'decel'}`.

### Per-audit ACs

8. **`cameraViewAngularContinuity(samples)` audit exists and works.**
   - Callable at `window._autopilot.telemetry.audit.cameraViewAngularContinuity(samples)`.
   - Returns `{ passed, violations, totalSamples }`.
   - Flags frames where combined angular delta
     (`sqrt(camYawRate² + camPitchRate²) × deltaT`) exceeds a
     tunable threshold. Default: `10° / frame` ≈ 0.175 rad/frame
     (600°/s at 60 Hz). Name the constant at the top of the audit.
   - Reports all frames above threshold with full classifying context
     (`framingState`, `shipPhase`, `navPhase`, `cameraMode`). Max is
     the first-pass filter. If a later workstream needs programmatic
     authored-window exemption, it authors that against concrete
     violation-distribution evidence.
   - Each violation record: `{ sampleIndex, t, angularDeltaRad, framingState, shipPhase, navPhase, cameraMode }`.
   - **Retroactive diagnosis on the 2026-04-24 rejected recording.**
     The recording path
     `screenshots/max-recordings/autopilot-phase-transition-velocity-continuity-2026-04-23.webm`
     is the evidence Max cited for the head-turn issue. Running this
     audit against a fresh Sol tour capture should produce one or
     more violations corresponding to the on-arrival head-turn. The
     audit **is expected to flag violations on the current Shipped
     code** — its job is to diagnose, not to pass-at-all-costs. Do
     NOT tune the threshold upward to eliminate violations; surface
     them, preserve their details, and escalate the diagnosis.

9. **`bodyInFrameChanges(samples)` audit exists and works.**
   - Callable at `window._autopilot.telemetry.audit.bodyInFrameChanges(samples)`.
   - Computes the "most centered body" per sample: the body with
     smallest `sqrt(azimuthRad² + altitudeRad²)` among bodies with
     forward component > 0 (visible).
   - Walks the timeline; a "glance" is a run where the centered-body
     ID differs from its neighbors on both sides AND the run
     duration < `GLANCE_MAX_DURATION = 0.5 s` (default).
   - Returns `{ passed, violations, totalSamples }` where each
     violation = `{ glanceStart, glanceEnd, glanceDuration, centeredBodyDuring, centeredBodyBefore, centeredBodyAfter }`.
   - **Retroactive diagnosis on the 2026-04-24 recording.** Max
     named a flip between planet and moon at arrival; this audit
     is the detector. Same rule as #8: report, don't tune away.

10. **`shakeVelocityCorrelation(samples, events)` audit exists and works.**
    - Callable at `window._autopilot.telemetry.audit.shakeVelocityCorrelation(samples, events)`.
      If `events` omitted, defaults to `_telemetryState.shakeEvents`.
    - Computes the full-tour `smoothedAbsDSpeed` distribution; derives
      the 80th-percentile value `P80`.
    - For each event in `events`, computes
      `maxWithin ±0.5 s` of the event's `onsetT` in the samples
      timeline; flag if `maxWithin < P80`.
    - Returns `{ passed, violations, totalSamples: samples.length, totalEvents: events.length, P80, perEvent: [...] }`.
      Each `perEvent` entry: `{ onsetT, eventType, maxWithinWindow, percentileRank }`.
    - **Retroactive diagnosis on the 2026-04-24 recording.** Max
      named the shake as firing at *"kind of random points."* The
      audit output — how many of the tour's shake events land above
      P80 vs. below — is the regression-testable evidence of
      whether the complaint has a mechanical cause.

11. **`runAllReckoning(samples, events?)` combined report.**
    - Callable at `window._autopilot.telemetry.audit.runAllReckoning(samples, events)`.
    - Shape:
      ```
      {
        passed: boolean,
        cameraViewAngularContinuity: { passed, violationCount },
        bodyInFrameChanges: { passed, violationCount },
        shakeVelocityCorrelation: { passed, violationCount, P80 },
        totalSamples, totalShakeEvents
      }
      ```
    - Same shape as shake `runAll()` at `src/main.js` L606–620.

### Verification + commit ACs

12. **Retroactive-diagnosis report committed with the code.** A
    `## Status` appendix in this brief at close shows:
    - Sample count of the fresh Sol tour capture used for diagnosis.
    - `runAllReckoning` result on that capture — per-audit pass/fail
      with violation counts.
    - For each failed audit: top-3 violation records with their
      full sample-index / timestamp / classifying context.
    - Cross-reference to the 2026-04-24 rejected recording:
      `screenshots/max-recordings/autopilot-phase-transition-velocity-continuity-2026-04-23.webm`.
    - Any sample-size / performance numbers (buffer size after a
      60 s tour; frame-rate impact — expected negligible since all
      computation is per-frame O(bodies)).

13. **Back-compat with existing audits.** The three existing audit
    sets — shake `runAll` (AC #16/#17/#18/#20), any WS 3
    `runAllCameraAxis` if landed, the continuity audits (velocity
    magnitude + direction at seams) — all continue to run and
    produce the same outputs on the same samples. The new fields
    don't alter the shape of pre-existing fields.

14. **Commits separable by concern.** Minimum two:
    (a) `feat(autopilot): telemetry field extensions for reckoning`
    (all six fields + shake-event log).
    (b) `feat(autopilot): reckoning audits — angular continuity, body-in-frame, shake-velocity correlation`.
    Status-appendix commit may be a third or fold into (b).

## Principles that apply

From `docs/GAME_BIBLE.md` §11. Three are load-bearing here; the
remaining three are orthogonal (telemetry doesn't touch hash grid,
per-object rendering aesthetic, or BPM sync).

- **Principle 6 — First Principles Over Patches.** Named above.
  The biggest risk in executing this brief is writing audits whose
  *observables* are at the wrong altitude — scalars ("a lot of
  motion happened") instead of timeseries ("frame 143 had 0.4 rad
  of yaw change in 16 ms, inside TRACKING framing, not during any
  authored rotation window"). Only timeseries observables compose
  into criterion-altitude audits. *Violation check:* if an audit's
  implementation body can be satisfied without per-frame data
  indexing, it's at the wrong altitude.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Named above. Every new field is a pure read on an
  existing getter or on module-local state. Any computation
  (angular rates, angular coordinates, approach rates) happens
  inside `_captureTelemetrySample` or inside the audit function
  — never inside the object being sampled. *Violation check:* a
  diff that adds `this._lastAngularRate = …` to
  `CameraChoreographer` or `camera` is a reverse flow.

- **Principle 2 — No Tack-On Systems.** Named above. Everything
  lands on the existing `_captureTelemetrySample` + `audit.*`
  surface; the shake-event log lives adjacent to the samples
  buffer with matching lifecycle. *Violation check:* any new
  module or a separate lifecycle.

Principles 1, 3, 4 not load-bearing here (no generator changes,
no aesthetic surface, no audio / BPM).

## Drift risks

- **Risk: Symptom-altitude observables.** The continuity workstream
  was audit-released on observables that couldn't describe what Max
  was seeing. The same failure mode here would look like adding
  `cameraJumped: boolean` instead of `camYawRate + camPitchRate`
  scalars per frame; or `bodiesInView: number` instead of per-body
  `azimuthRad + altitudeRad`. The boolean/count aggregates "passed"
  easily and are useless for criterion-altitude audits.
  **Why it happens:** the simpler observable feels cheaper and
  "covers" the issue with fewer lines.
  **Guard:** per-field ACs #1–#7 name the *shape* of the required
  observable (array of records, scalar rate timeseries, per-body
  indexed arrays). Diff review: if a new field is a scalar summary
  and the corresponding audit is a threshold on that summary,
  escalate — it's at the wrong altitude.

- **Risk: Threshold-tuning to eliminate retroactive violations.**
  The three new audits are expected to flag violations on the
  current Shipped code (`f90ae2e`) for the three issues Max named.
  The temptation during retroactive-diagnosis runs will be to widen
  thresholds until the audits pass — which "closes" the audits
  without actually diagnosing the issues.
  **Why it happens:** clean-green-output is mis-perceived as
  audit-good. It's not; diagnosing-violations is audit-good here.
  **Guard:** per-audit ACs #8–#10 explicitly state *report, don't
  tune away*. Commit the audits with thresholds that fire on the
  shipped code. The continuity re-audit uses these violations as
  input; silencing them is a scope inversion.

- **Risk: Threshold tuned high enough to miss the head-turn Max saw.**
  Guard: AC #8's default threshold (`10°/frame ≈ 0.175 rad/frame`) is
  named at the audit head; tuning it upward without a diagnostic
  reason is a scope inversion.

- **Risk: All-bodies snapshot access path is unclear.** The module-
  local `system` variable inside `main.js` is not currently exposed
  on `window` or passed into `_captureTelemetrySample`. Working-
  Claude may propose exposing it as `window._currentSystem` for
  convenience, which is a tack-on surface.
  **Why it happens:** need-to-read-at-capture-time meets
  no-existing-read-path.
  **Guard:** `_captureTelemetrySample` is defined in `main.js`
  and closes over the same module scope that holds `system` —
  no window exposure is required. Working-Claude should reference
  `system` directly inside the function, same as existing code
  at `src/main.js` L146–147 (`!system || !system.planets` check).
  Escalate to Director if a closure path is not viable.

- **Risk: Shake-event log mis-identifies onsets.** The check
  `eventOnsetTime !== previousOnsetTime` is the natural detector,
  but a timeAccum reset (tour end, `.reset()`) could false-trigger.
  **Why it happens:** ShipChoreographer's internal timer lifecycle
  is not the same as the telemetry buffer's lifecycle.
  **Guard:** Compare against BOTH `previousOnsetTime` and
  `previousEventActive` (require `shipChoreographer.eventActive ===
  true` at the sample where onset fires). Additionally, track a
  `lastLoggedOnsetT` local variable in the capture closure; append
  only when `shipChoreographer.eventOnsetTime > lastLoggedOnsetT`.
  This is idempotent even across `reset()` calls.

- **Risk: Sample-size balloon.** Adding bodies × 2 (position +
  radius in `bodies`) + bodies × 2 (`bodyRelatives`: distance +
  approach rate) + bodies × 2 (`bodyAngles`: azimuth + altitude)
  = ~6 scalars per body per frame. Sol = 12 bodies × 60 Hz × 60 s
  × ~8 bytes × 6 scalars ≈ 2 MB. Tolerable but meaningful.
  **Why it happens:** no one audits growth unless measured.
  **Guard:** AC #12 includes sample-size numbers in the
  retroactive-diagnosis report. If the buffer exceeds ~10 MB for
  a 60 s tour at 60 Hz, the capture lifecycle (cleared on `.stop()`)
  is the backstop. Leave a comment at the top of
  `_captureTelemetrySample` noting the new fields' size impact.

- **Risk: Light-year conversion site proliferates.** The
  `SCENE_PER_LY` constant gets inlined at the telemetry site
  instead of landing in `ScaleConstants.js`, and a future feature
  (nav-computer distance display, HUD overlay, etc.) re-derives
  the same constant from `AU_TO_SCENE` independently — drift
  between sites.
  **Why it happens:** inlining feels cheaper than a dependency
  extension.
  **Guard:** AC #4 requires extending `ScaleConstants.js` with
  `LIGHT_YEAR_AU = 63241.077` and `lyToScene` / `sceneToLy` helpers,
  and using `sceneToLy` at the telemetry site. Single source of
  truth is load-bearing for Principle 2; future nav-computer /
  OOI-distance displays inherit the same helpers.

## In scope

- **Six telemetry-field extensions** in `src/main.js`
  `_captureTelemetrySample()`: `bodies`, `camYawRate`,
  `camPitchRate`, `camFov`, `shipSpeedSceneUnitsPerSec`,
  `shipSpeedLightYearsPerSec`, `bodyRelatives`, `bodyAngles`.
- **Shake-event log** at `_telemetryState.shakeEvents` with
  matching `.start()` / `.stop()` lifecycle.
- **Three audit helpers** at `window._autopilot.telemetry.audit.*`:
  `cameraViewAngularContinuity`, `bodyInFrameChanges`,
  `shakeVelocityCorrelation`, plus the `runAllReckoning`
  combined report.
- **Retroactive-diagnosis run** on the current Shipped code
  (`f90ae2e` continuity baseline; recording at
  `screenshots/max-recordings/autopilot-phase-transition-velocity-continuity-2026-04-23.webm`).
  Produce the `## Status` appendix per AC #12.
- **`ScaleConstants.js` extension** with `LIGHT_YEAR_AU` +
  `lyToScene` / `sceneToLy` helpers (per AC #4).
- **Commits per AC #14** (two minimum, fields + audits).

## Out of scope

- **Any fix to the three named issues** — head-turn on arrival,
  pause-zoom-in-zoom-out cycle, moon-transition jerk, shake
  firing at off-peak points. This workstream **diagnoses** them;
  each becomes a followup workstream after the reckoning audits
  land. No changes to `CameraChoreographer.js`, `FlythroughCamera.js`,
  `ShipChoreographer.js`, `NavigationSubsystem.js`, `VelocityBlend.js`.
- **Any fix to the shake mechanism** — same principle. The
  `shakeVelocityCorrelation` audit identifies whether the
  "feels random" complaint has a mechanical cause; the fix is a
  separate scope.
- **New ACs beyond the three classes of motion named by Max.**
  Curvature-class observables (`d²pos/dt²`) and higher-order
  continuity audits may eventually land, but are explicitly NOT
  in this brief — keep the scope tight to what Max surfaced.
  The continuity workstream's re-audit uses these three audits
  + the existing velocity-magnitude / velocity-direction audits;
  if the re-audit reveals a fourth class needed, that spawns a
  followup brief.
- **UI / HUD for the audits.** Console / test-runner output only.
- **Integration with WS 4 (autopilot-toggle UI / warp-select).**
  WS 4 waits behind this brief + the continuity re-audit.
- **Headless / CI integration.** Audits run against live-canvas
  tour captures via `mcp__chrome-devtools__*` during agent
  sessions. Headless wiring is a separate infrastructure concern.
- **The parked travel-feel speed-field issue** (feature-doc
  §"Parking lot"). No telemetry coverage until the feature-level
  articulation lands. The `bodyRelatives.approachRate` field is
  general-purpose and may later be used by speed-field work, but
  this workstream does not author that coupling.
- **Test harnesses for pixel-stability / canvas-level invariants**
  (the pinned-star pixel check from the superseded
  `autopilot-telemetry-coverage-2026-04-23` brief). That scope
  stays parked with the superseded brief; if a pixel-level
  runtime observer is needed later, it spawns its own brief.

## Handoff to working-Claude

**Precondition: Director audit.** This brief is `HELD — pending
Director audit`. The `~/.claude/state/dev-collab/active-workstream`
pointer is set to this workstream on the commit that lands it, but
execution begins only after Director has audited and released. If
Director pushes back on scope (e.g., rejects the optional
`ScaleConstants.js` extension, or renames an audit), iterate the
brief before starting code.

Read this brief first. Then, in order:

1. **`docs/WORKSTREAMS/autopilot-phase-transition-velocity-continuity-2026-04-23.md`**
   — the rejected baseline. Especially `## Status` (Max's verbatim
   rejection, the three specific visible issues named) and ACs #1b/c,
   #2b/c, #3b/c, #5 (the audits that passed while the issues went
   uncaught — this brief closes the observability gap those audits
   did not have).
2. **`docs/WORKSTREAMS/autopilot-telemetry-coverage-2026-04-23.md`**
   — the superseded brief (now a redirect stub). The `## Parent
   feature`, `## Scope statement`, and `## Acceptance criteria` of
   that brief are the narrower scope this brief replaces. Don't
   re-execute that brief's scope; do read it to understand what
   was cut and why.
3. **`docs/WORKSTREAMS/autopilot-shake-redesign-2026-04-21.md`**
   — the round-10/11 shake mechanism (`_firedThisLeg`, signal
   gating, `eventOnsetTime`). AC #17 `signalCoincidence` is the
   existing shake audit; AC #10 `shakeVelocityCorrelation` (this
   brief) is complementary, not a replacement.
4. **`src/main.js` L441–623** — the existing
   `window._autopilot.telemetry.*` API. Model new audits on
   `orbitCrossProduct` / `signalCoincidence` / `envelopeFitsPhase`
   / `perLegFireBudget` / `runAll` for shape + JSDoc convention.
5. **`src/main.js` L625–711** — `_captureTelemetrySample()`
   current state. The six new fields land here. Note the existing
   `.toFixed(4)` precision, null-safety on `bodyRef`/`nextBodyRef`,
   and vec3-as-array convention.
6. **`src/main.js` L146–147** — existing `!system || !system.planets`
   check confirms `system` is visible in module scope;
   `_captureTelemetrySample` can close over it the same way.
7. **`src/auto/FlythroughCamera.js` L40–155** — the `_rotBlendDuration`
   window and how it interacts with motion-start. Context for
   interpreting what the audit reports, not a surface to build against.
8. **`src/auto/CameraChoreographer.js`** — public getters
   (`currentMode`, `currentLookAtTarget`, `framingState`). The
   angular-continuity audit filters on these.
9. **`src/auto/NavigationSubsystem.js`** — public getters
   (`bodyRef`, `nextBodyRef`, `isActive`, `getCurrentPlan`).
10. **`src/auto/ShipChoreographer.js` L226–508** — the shake-event
    onset plumbing (`_eventOnsetTime`, `_firedThisLeg`). The
    shake-event log hooks into the onset transition at the
    `telemetry` side without modifying ShipChoreographer.
11. **`src/core/ScaleConstants.js`** — existing scale framework
    (AU / solar / Earth radii + `metersToScene`). Where the
    `LIGHT_YEAR_AU` + helpers land if Director approves AC #4
    option A.
12. **`docs/GAME_BIBLE.md` §Scale System [BOTH]** (L1592-1620) —
    the `1 AU = 1000 scene units` anchor. The light-year
    derivation (1 ly = 63,241.077 AU) is referenced here but not
    the constant itself.
13. **`docs/PERSONAS/pm.md` §"Per-phase AC rule carve-out: process
    / tooling workstreams"** — the carve-out that permits this
    brief's contract-shaped ACs.
14. **`docs/REFACTOR_VERIFICATION_PROTOCOL.md`** — the telemetry-
    equivalence pattern. These audits extend that pattern.

Then, in order of execution:

1. **Extend `ScaleConstants.js` per AC #4.**
2. **Extend `_captureTelemetrySample()` with the six new fields**
   (ACs #1-#6). Verify the existing shake + WS 3 diagnostic audits
   still pass on a fresh Sol tour capture — back-compat check, not
   feature work.
3. **Wire the shake-event log** (AC #7). Verify by capturing a
   tour and inspecting `shakeEvents`; expect ≥ 1 event with
   `eventType ∈ {'accel', 'decel'}` and matching `onsetT` within
   the samples timeline.
4. **Implement `cameraViewAngularContinuity`** (AC #8). Report all
   violations above threshold; do not build exemption logic. Run
   against a fresh Sol tour; **expect violations** on the Shipped
   code (head-turn-on-arrival); preserve them, do not tune thresholds
   to make them disappear.
5. **Implement `bodyInFrameChanges`** (AC #9). Same retroactive-
   diagnosis pattern; expect violations at the moon-transition moment.
6. **Implement `shakeVelocityCorrelation`** (AC #10). Expect some
   number of events to land below P80; that number is the
   diagnostic output.
7. **Implement `runAllReckoning`** (AC #11).
8. **Run the retroactive-diagnosis capture** — fresh Sol D-shortcut
   tour, telemetry captured, `runAllReckoning` executed. Capture:
   per-audit pass/fail, violation counts, top-3 violation records
   per failing audit, cross-reference to the 2026-04-24 rejected
   recording.
9. **Update this brief's `## Status`** with the retroactive-diagnosis
   appendix per AC #12.
10. **Commit per AC #14** — minimum two commits. Stage only
    `src/main.js` + (optionally) `src/core/ScaleConstants.js` +
    this brief's Status update. Never `git add -A`.
11. **Close at `VERIFIED_PENDING_MAX <sha>`** — standard Shipped-gate
    protocol. Telemetry / process workstreams do not require a canvas
    recording (contract-shaped ACs per `docs/PERSONAS/pm.md` §"Per-
    phase AC rule carve-out"), but Max's greenlight on the audit
    thresholds + the retroactive-diagnosis output is required before
    Shipped. Max's review pattern: confirm that the three new audits
    flag the three issues he named in the 2026-04-24 recording; if
    not, the audits are at the wrong altitude and the workstream
    iterates.

**If any of the three audits pass on the Shipped code** — i.e., none
of the three issues Max named produces a violation — stop and
escalate to Director. The audits are at the wrong altitude. Do NOT
conclude *"the issue wasn't real"*; Max saw it. The audit is the
wrong instrument.

**If you find yourself proposing a fourth audit ("also cover
curvature jumps")**, stop. That's a followup workstream once the
first three land and the continuity re-audit produces its output.
Keep this workstream tight.

Artifacts expected at close: 2-3 commits (fields + shake-event log;
audits; optional Status commit); this brief at `VERIFIED_PENDING_MAX`
with the retroactive-diagnosis appendix; feature doc's `## Workstreams`
section updated to list this brief alongside the continuity and WS 3
entries (as tooling / observability support, not a feature advance).

**After this workstream ships:**

1. The continuity workstream is re-audited against the new audits.
   If all three audits pass on the continuity code + Max eyeballs
   the recording and agrees the head-turn / pause-zoom / jerk are
   gone, the continuity workstream flips to `Shipped <sha>` against
   the original (or a re-recorded) recording.
2. If any of the three audits surface violations on the continuity
   code that Max can confirm visually, each class of motion becomes
   its own scoped followup workstream.
3. WS 4 greenlights once the continuity re-audit lands.

Drafted by PM 2026-04-24 following Max's ultimatum + Director's
stop-the-line ruling.
