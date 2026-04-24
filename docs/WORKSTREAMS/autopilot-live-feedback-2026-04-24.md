# Workstream: Autopilot live-feedback — promote telemetry from observer to pipeline input (2026-04-24)

## Status

`Loop (b) Shipped 3ba1159 — VERIFIED_PENDING_MAX.` `Loop (c) Shipped 273e725 — VERIFIED_PENDING_MAX.` **`Loop (a) cycle-4 REDESIGN IN PROGRESS — target-position critically-damped spring per Director's 2026-04-24 §5 closure.`** Cycles 1–3 of Loop (a) are closed (mechanism class abandoned); cycles-1/2/3 code in `src/auto/CameraChoreographer.js` is slated for full removal per §5.7 of the Director's 2026-04-24 cycle-4 redesign scoping audit.

**Path-2 greenlight (Max, 2026-04-24, verbatim):** *"Let's go with path two per the director's feedback. Hand it back off to the director and PM, make sure that rebuilding this system from scratch is very well thought out, well planned, includes research if necessary about how movement in spacefaring games like this works in other games. Test criteria and so on."*

**Cycle-4 scoping audit:** `~/.claude/state/dev-collab/audits/autopilot-live-feedback-2026-04-24.md` §§1–8 + §5 closure (Director, 2026-04-24). `state.json[...].last_audit_sha` = `f63ec122a57895383720ddf4895d3256cd37b2ce` (HEAD unchanged — cycles 1–3 code still uncommitted).

**Mechanism class (Dana-informed, Director §5 closure).** Target-position critically-damped spring (Holden's `spring_damper_exact` / Lowe's Game Programming Gems 4 `SmoothDamp` form). The filter acts on a **Vector3 world-space point** (the raw lookAt target post-distance-guard), NOT on `camFwd`. Half-life parameterization. ζ = 1.0 hardcoded. Seed: `TARGET_HALF_LIFE_SEC = 0.35`. Distance guard (`MIN_TARGET_DISTANCE = 2.0`) remains as orthogonal co-mechanism and runs BEFORE the filter. Cycle-3's camFwd-rate clamp is removed in full — no secondary safety net (Director: *"a safety clamp on the filter's output fights the filter"*); the 10.47 rad/s ceiling survives only as a recording-assertion numerical invariant, not as runtime code.

**Research input.** Dana's prior-art survey `research/autopilot-camera-motion-prior-art-2026-04-24.md` (2026-04-24) converged across Unity Cinemachine, Daniel Holden's spring-roll-call, Juckett's damped-springs, Allen Chou's slerp derivation, Nesky's GDC 2014 "50 Game Camera Mistakes," and Lowe's Game Programming Gems 4 `SmoothDamp`. Convergence quote (Dana §"Executive summary"): *"when a camera needs to track a moving subject smoothly, the dominant mechanism is a critically-damped spring applied to the look-at target's position (or to the camera's own position), not an angular-rate clamp on the camera's orientation. The orientation is then derived from the smoothed target — so jerk is absorbed upstream, before it ever becomes an angular-velocity problem."* Dana landmines #3 (per-axis rate clamping → staircase artifacts) and #6 (parallax-from-self-motion → clamp fights the spike, lags, then overshoots) directly indict the cycle-1/2/3 clamp-class shape.

**Cycles 1–3 closed (mechanism class abandoned).** Prior status — cycle-1 (raw-target-rate clamp, 70 violations), cycle-2 (distance guard added, 31 → 17 new-class violations), cycle-3 (camFwd-rate clamp swap, 234 3D-rate violations) — is retained in revision history only. Director's cycle-3 post-mortem self-audit (§"Self-audit on my cycle-3 ruling"): *"I conflated 'true 3D angular rate of camFwd' with 'max of chart-decomposed yaw-rate and pitch-rate,' which are only equal at pitch=0."* Cycle-3 escalation ruled path 2 (full rebuild, not path-1 AC-metric revision with cycle-3 code shipping). Cycles-1/2/3 code remains uncommitted in `src/auto/CameraChoreographer.js`; the cycle-4 Attempt-1 implementation removes it.

**Cycle budget.** 2 mechanism-class **attempts** (not cycles), up to 2 parameter-tuning passes per attempt, per Director §7 Stop A/B/C/D. Attempt 1 = target-position critically-damped spring. Attempt 2 is triggered only if Attempt 1 fails on mechanism-class grounds (not parameter tuning).

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

- **2026-04-24 — loop (a) cycle-3 mechanism-1 substitution
  (camFwd-rate clamp replaces raw-target-rate clamp).** Cycle-2
  capture (`recordings/loopa-cycle2-distance-guard.webm`) closed 30
  of 31 cycle-1 violations — clusters 1 + 2 eliminated by the 2.0u
  distance guard, residual sub-1.95u frames explained as
  pre-blend-guarded / post-blend-unguarded mid-transition blend
  outputs (not mechanism failure). But cycle-2 capture failed AC #8
  with **17 new-class violations**: sustained monotonic yawRate
  building from 9 → 13 rad/s across 11+ consecutive stable-TRACKING/
  APPROACH frames at dist ≈ 2.0u with guard active and dt normal
  (~6ms). Working-Claude carried attribution in-line with options
  analysis; Director's audit (§"Diagnosis") closed attribution
  without cycle-3 instrumentation. Math walk verbatim: *"The cycle-1
  raw-target-rate clamp measures the wrong thing. It bounds the
  angle between last-frame's target and this-frame's target, both
  measured from this frame's ship position. The AC measures camFwd
  rate, which depends on both the target AND the ship-origin moving
  between frames. At 2.0u target distance, 7.3 u/sec of lateral ship
  velocity (ordinary APPROACH motion) becomes a 1.26°/frame excess
  parallax — exactly the 146%-of-clamp-ceiling signature observed."*
  Ruling: **Option (A') — replace the raw-target-rate clamp with a
  camFwd-rate clamp** that directly bounds the quantity AC #8
  samples (`(0,0,-1).applyQuaternion(camera.quaternion)`
  frame-to-frame angular delta). Director verbatim: *"Keeps the
  cycle-2 distance guard."* Mechanism class **unchanged** —
  Loop (a) is still a co-mechanism (distance guard + angular-rate
  clamp); the angular-rate mechanism's **target of measurement**
  changes from raw-target direction to camFwd direction, giving a
  one-to-one AC-to-invariant encoding (no proxy). Constants:
  `MAX_FRAME_ANGULAR_RATE_DEG_PER_SEC = 450` deleted;
  `MAX_FRAME_CAM_ANGULAR_RATE_RAD_PER_SEC = 10.47` added (600°/sec
  = AC #8 threshold, not a margin below). New EstablishingMode
  state fields: `_priorCamFwdRendered` (Vector3) and
  `_hasValidPriorCamFwd` (bool). Distance guard unchanged. (b) and
  (c) unchanged. AC #7 Mechanism 1 rewritten below; Loop (a)
  in-scope block updated; drift-risks extended with shake-contribution
  note; Handoff step 10 rewritten. Cycle-3 audit SHA:
  `89261d1c304687728a86140172d2a2957ce96035`.

- **2026-04-24 — loop (a) cycle-4 REDESIGN (mechanism class
  replaced; cycles 1–3 closed).** Max chose path 2 after the
  cycle-3 escalation — verbatim greenlight: *"Let's go with path
  two per the director's feedback. Hand it back off to the
  director and PM, make sure that rebuilding this system from
  scratch is very well thought out, well planned, includes
  research if necessary about how movement in spacefaring games
  like this works in other games. Test criteria and so on."*
  Loop (a) is rebuilt from scratch as **Attempt 1** of a
  mechanism-class redesign — not a fourth cycle of clamp tuning.

  **Why cycles 1–3 failed.** Each cycle landed a different
  placement of a rate ceiling on a camera-forward / raw-target
  direction. Dana's 2026-04-24 prior-art survey
  (`research/autopilot-camera-motion-prior-art-2026-04-24.md`)
  found the rate-clamp-on-look-direction mechanism class does not
  appear as a primary mechanism in reputable camera literature;
  where it appears it is a secondary safety net on top of a
  damped target, and Dana landmines #3 (per-axis rate clamping
  produces staircase artifacts) and #6 (parallax-from-self-motion
  confounds angular-rate clamps — clamp fights the spike, lags,
  then overshoots) explicitly indict the cycle-1/2/3 shape.
  Director's cycle-3 post-mortem (cycle-3 audit §"Self-audit")
  closed the clamp class with *"when ruling that an invariant
  maps 1:1 to an AC, verify the AC's exact measurement expression,
  not just its English description"* — the camFwd-rate clamp
  location was the wrong place to encode the felt invariant.

  **New mechanism class.** Target-position critically-damped
  spring (Holden's `spring_damper_exact` / Lowe's `SmoothDamp`
  form). Dana's convergence quote (§"Executive summary"):
  *"when a camera needs to track a moving subject smoothly, the
  dominant mechanism is a critically-damped spring applied to
  the look-at target's position (or to the camera's own
  position), not an angular-rate clamp on the camera's
  orientation. The orientation is then derived from the smoothed
  target — so jerk is absorbed upstream, before it ever becomes
  an angular-velocity problem."* The filter acts on a Vector3
  world-space point (the raw lookAt target post-distance-guard),
  NOT on camFwd. Half-life parameterization; ζ = 1.0 hardcoded;
  seed `TARGET_HALF_LIFE_SEC = 0.35`. Distance guard
  (`MIN_TARGET_DISTANCE = 2.0`) retained as orthogonal
  co-mechanism, runs BEFORE the filter. Cycle-3's camFwd-rate
  clamp is removed in full — Director §5.7: *"Not 'downgrade to
  secondary safety net.' The removal is load-bearing, not
  cosmetic."* The 10.47 rad/s ceiling survives only as a
  recording-assertion numerical invariant (not runtime code).
  AC #8 acceptance revised: ceiling 10.47 rad/s hard invariant,
  p99 ≤ 3.5 rad/s soft invariant, plus an angular-jerk smoothness
  companion (threshold set empirically during Attempt-1 first
  capture with Director review). AC #7 fully rewritten below.
  Drift-risks for Loop (a) rewritten (distance-guard risk kept;
  new filter-speed, filter-initialization, and transition-reset
  risks added; shake-contribution risk removed — no longer
  relevant without a camFwd clamp). Handoff steps 9–12 rewritten
  as the Attempt-1 implementation playbook; new step 13 is
  Director re-audit before commit. Cycle budget reshaped per
  Director §7: 2 mechanism-class attempts, ≤ 2 parameter-tuning
  passes per attempt, Stop A/B/C/D. Cycle-4 scoping audit SHA:
  `f63ec122a57895383720ddf4895d3256cd37b2ce` (HEAD at audit;
  cycles-1/2/3 code still uncommitted, to be removed in
  Attempt-1 implementation).

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

**AC #7 — `EstablishingMode`'s raw lookAt target is smoothed by a
target-position critically-damped spring, with the distance guard
as an orthogonal geometric precondition (two co-mechanisms).**
`CameraChoreographer.EstablishingMode.update()` applies **both** of
the following, in order:

1. **Distance guard** — runs first, on the raw target.
2. **Target-position critically-damped spring** — runs second, on
   the guard's output. Produces the smoothed point that
   `camera.lookAt` consumes.

Cycle-3's camFwd-rate clamp is **removed in full** (§5.7 of the
Director's 2026-04-24 cycle-4 redesign scoping audit). No secondary
safety net, no post-filter clamp. The 10.47 rad/s ceiling survives
as a recording-assertion invariant (see AC #8 below), not as runtime
code.

**Mechanism 1 — target-position critically-damped spring (cycle 4
Attempt 1; replaces cycles 1–3 entirely).**

*Signal filtered.* The **raw lookAt target** produced by
`EstablishingMode`'s framing-state switch (TRACKING / LINGERING /
PANNING_AHEAD branches, after the switch statement's closing brace
writes `_prevRawTargetFrame`), then after the distance guard runs on
it, and **before** the transition-blend step consumes it.

The filter acts on a **Vector3 world-space point**, not on `camFwd`,
not on a quaternion, not on per-axis angles. This is load-bearing
per Director §5.2 and Dana's landmines #3 (per-axis rate clamping →
staircase artifacts) and #6 (parallax-from-self-motion → clamp
fights the spike, lags, overshoots). Damping the world-space target
point absorbs jerk upstream; orientation is derived from the smooth
point by `camera.lookAt(smoothedTarget)` each frame.

*Filter form.* Holden's `spring_damper_exact` / Lowe's Game
Programming Gems 4 `SmoothDamp` — the canonical analytical form of
a critically-damped second-order filter. **Frame-rate independent by
construction** (closed-form update per frame using `deltaTime`; no
`lerp(x, target, 0.1)` naive form — Dana landmine #5). ζ = 1.0
hardcoded (we are not tuning overshoot in V1; Director §5.5).

Reference implementations (working-Claude reads these before
implementing, per Dana §Citations and Director §5.9):
- Daniel Holden, *"Spring-It-On: The Game Developer's Spring-Roll-
  Call"* — canonical `spring_damper_exact`, half-life
  parameterization, frame-rate-independent forms.
  <https://theorangeduck.com/page/spring-roll-call>
- Ryan Juckett, *"Damped Springs"* — derivation + practical code.
  <https://www.ryanjuckett.com/damped-springs/>
- Thomas Lowe, *"Critically Damped Ease-In/Ease-Out Smoothing,"*
  Game Programming Gems 4 (cited as the basis of Unity's
  `SmoothDamp`).

*Tunable constant.*
`TARGET_HALF_LIFE_SEC = 0.35` at the top of `CameraChoreographer.js`
alongside `LINGER_DURATION`, `PAN_AHEAD_FRACTION`, and
`MIN_TARGET_DISTANCE`. The name is load-bearing for the felt
time-constant: *"the smoothed target closes half the remaining gap
to raw in 0.35s."* At critical damping, the filter reaches ~63% of
setpoint in one half-life and ~95% in ~3 half-lives — seed gives
~1s total settling on a TRACKING → LINGERING flip, inside the
"Blue Danube" / 2001 station-dock musical phrasing range (§"How
it fits the bigger picture" / Director §5.5 derivation).

One tuning knob in V1. ζ = 1.0 hardcoded. No per-phase variants; no
dispatch on `ShipPhase`.

*State additions on `EstablishingMode`.*
- `_filteredTarget: Vector3` — the filter's position state. The
  smoothed point `camera.lookAt` consumes. Replaces direct use of
  `_prevRawTargetFrame` in the transition blend and in
  `_currentLookAtTarget` assignment.
- `_filteredTargetVelocity: Vector3` — the filter's velocity state
  (the `spring_damper_exact` / `SmoothDamp` signature requires it;
  it holds the inertia that produces the "camera wrist" feel).
  **PERSISTS across framing-state transitions** (TRACKING ↔
  LINGERING ↔ PANNING_AHEAD) — do NOT zero on flip. Persistence is
  the structural mechanism for continuity-at-flip (Director §6a M5
  + §5.4).

*Mechanism (in order, inside `EstablishingMode.update()`, after the
framing-state switch's closing brace):*

1. The framing-state switch has already written
   `_prevRawTargetFrame` (the raw lookAt target for this frame, per
   existing branch logic).
2. **Distance guard runs** on `_prevRawTargetFrame` (Mechanism 2
   below — unchanged from cycle 2).
3. **Filter update.** Call `spring_damper_exact` (or `SmoothDamp`
   equivalent) with:
   - current position = `_filteredTarget`
   - current velocity = `_filteredTargetVelocity`
   - goal = `_prevRawTargetFrame` (the guarded raw target)
   - half-life = `TARGET_HALF_LIFE_SEC`
   - dt = `deltaTime`

   Both state fields are mutated in place per the standard signature
   (Holden / Unity). Because the filter acts on a Vector3, the
   update is three independent scalar spring updates (one per
   component) — mathematically equivalent to a spring on the 3D
   point because critically-damped analytical updates commute with
   linear vector spaces.
4. **Downstream consumption.** The transition blend (which
   previously consumed `_prevRawTargetFrame`) and the
   `_currentLookAtTarget` assignment now consume `_filteredTarget`.
   `camera.lookAt(_filteredTarget)` is the effective render call.

*Initialization rule (first frame / ESTABLISHING entry).*
On the first frame after ESTABLISHING becomes active, **snap the
filter state to the current raw-guarded target** — no transient
catch-up:
```
_filteredTarget.copy(_prevRawTargetFrame)  // post-guard
_filteredTargetVelocity.set(0, 0, 0)
```
Then run the filter update from the next frame onward. Director §6a
M5: *"On ESTABLISHING entry, the filter state snaps to the current
camera forward direction (no transient catch-up)."* The
same-first-frame "snap to raw-guarded target" satisfies this for a
target-position filter.

*Framing-state transition rule (TRACKING ↔ LINGERING ↔
PANNING_AHEAD).*
The filter state **is NOT reset** on framing-state flip. The switch
writes a new raw target (e.g., LINGERING → TRACKING replaces the
linger-target-ref with the next subject); the filter picks it up as
a new setpoint and smoothly pulls toward it, with
`_filteredTargetVelocity` providing inertial continuity. This is
the Director §6a M5 / §5.4 canonical behavior: *"the filter state
is CONTINUOUS — no state reset. The new setpoint is picked up from
wherever the filter currently is."*

If the cycle-4 Attempt-1 capture reveals that continuity-at-flip
looks sluggish (the camera chases the new subject instead of
picking it up cleanly), the discussion is whether to change the
rule — surface to Director, do not patch in-place (this is
explicitly an Attempt-1 design question per Director §5.4 +
drift-risk below).

*Degenerate fallback — active blend overlaps filter.*
If the existing transition-blend machinery (cross-fading between
framing-state outputs) is downstream of the filter, the blend
consumes `_filteredTarget` as its input. The filter itself is not
bypassed during a blend. If working-Claude finds the blend's shape
interacts poorly with the filter's smoothing (two smoothers in
series), surface to Director — the question is whether the blend
itself becomes redundant under the filter.

**Mechanism 2 — target-distance guard (cycle 2, retained unchanged).**
A geometric precondition on the raw target ensuring
`|_prevRawTargetFrame − shipPos| ≥ MIN_TARGET_DISTANCE = 2.0` scene
units. If the raw target is closer than the floor, push it outward
along its current direction to `shipPos + direction ×
MIN_TARGET_DISTANCE`. Rationale: `three.js camera.lookAt()` builds
the camera quaternion from `normalize(target − cameraPos)`, which
amplifies sub-unit-magnitude perturbations on target position into
large unit-direction swings. The floor keeps the vector magnitude
comfortably larger than per-frame body-orbit and ship-integration
wobble (~1e-2 to 1e-3 scene units) so the forward direction is
numerically stable.

Director §5.6 confirms retention against the cycle-4 redesign:
*"The damping doesn't know the difference between 'setpoint is a
valid-geometry point 0.5u away' and 'setpoint is a valid-geometry
point 5u away'; it smooths in either case, and the lookAt matrix
still blows up in the close case."* Dana landmines #1 (colinear up
and look direction → degenerate `lookAt`) and #2 (target coincident
with camera → zero-length target vector) independently document
these as failure modes distinct from — and not obsoleted by —
damping.

**Mechanism order inside `EstablishingMode.update()`:**
```
raw target  (from framing-state switch: TRACKING | LINGERING | PANNING_AHEAD)
  └→ distance guard (MIN_TARGET_DISTANCE = 2.0 — unchanged)
       └→ spring_damper_exact(state, guardedTarget, halfLife, dt)
            └→ _filteredTarget  (camera.lookAt consumes this)
```

One smoothing stage. Guard first, filter second. `camera.lookAt` is
the only place orientation is derived, and it is derived from the
smoothed point.

**Mechanism-level requirements (Director §6a M1–M6).**

- **M1 — Single authored smoothing stage.** The camera's rendered
  forward direction is the output of exactly one smoothing stage
  (the spring). No downstream clamp, no upstream clamp. Distance
  guard is a separate, earlier geometric precondition.
- **M2 — Setpoint/state separation.** The filter has explicit
  internal state (`_filteredTarget`, `_filteredTargetVelocity`)
  distinct from its input (setpoint = raw target post-guard). State
  persists across frames; setpoint is recomputed per-frame.
- **M3 — Camera-axis-only.** `TARGET_HALF_LIFE_SEC` is a module
  constant. Not dispatched on `ShipPhase`. If phase-dependent feel
  is wanted later, routed through `_framingState` (camera-axis),
  not `ShipPhase` — see drift-risk "Soft re-coupling to ShipPhase."
- **M4 — Graceful at dt boundaries.** The filter is stable at the
  observed dt range (~3ms to ~45ms including hitches) because
  `spring_damper_exact` uses the analytical closed-form, not
  forward Euler. Working-Claude confirms the implementation uses
  Holden's exact form (not a custom ad-hoc integration).
- **M5 — Initial-condition handling.** On ESTABLISHING entry,
  filter state snaps to current raw-guarded target (no transient).
  On framing-state transitions (TRACKING ↔ LINGERING ↔
  PANNING_AHEAD), filter state is CONTINUOUS — no reset. See
  "Initialization rule" and "Framing-state transition rule" above.
- **M6 — Distance guard runs before the filter.** Guard operates on
  the raw target; filter operates on the guarded setpoint. See
  mechanism-order diagram above.

**What cycle-3 state and code is slated for removal** (per Director
§5.7; working-Claude executes during Handoff step 9):
- `MAX_FRAME_CAM_ANGULAR_RATE_RAD_PER_SEC = 10.47` (module-level
  constant) — delete.
- `EstablishingMode._priorCamFwdRendered`, `_hasValidPriorCamFwd`
  (state fields) — delete.
- `CameraChoreographer.js:428–455` (camFwd-rate clamp block with
  slerp fallback) — delete.
- `CameraChoreographer.js:475` (`_prevShipPos` snapshot after
  blend, added cycle-3) — delete IF its only reader was the clamp;
  retain if Loop (b) or (c) now reads it. Working-Claude verifies
  during implementation (Director §5.7 notes this).
- `MAX_FRAME_ANGULAR_RATE_DEG_PER_SEC = 450` (cycle-1 constant) —
  already slated for deletion per cycle-3 amendment; confirm it is
  in fact absent after cycle-4 Attempt-1 edit.

Verified by:
- Grep of `src/auto/CameraChoreographer.js` for
  `TARGET_HALF_LIFE_SEC = 0.35` and `MIN_TARGET_DISTANCE = 2.0` as
  named constants at the top of the module alongside
  `LINGER_DURATION` and `PAN_AHEAD_FRACTION`. The prior
  `MAX_FRAME_CAM_ANGULAR_RATE_RAD_PER_SEC` and
  `MAX_FRAME_ANGULAR_RATE_DEG_PER_SEC` constants are **absent**.
- Grep of `EstablishingMode` for new fields `_filteredTarget`,
  `_filteredTargetVelocity`. Prior cycle-3 fields
  `_priorCamFwdRendered`, `_prevShipPos` (if its only reader was
  the clamp), `_hasValidPriorCamFwd` are **absent**.
- Grep of `EstablishingMode.update()` confirms mechanism order:
  the distance-guard `if (|v| < MIN_TARGET_DISTANCE && |v| > ε)
  { push outward }` sits **after** the switch's closing brace and
  **before** the filter update; the filter update sits **after**
  the distance guard and produces `_filteredTarget`;
  `_filteredTarget` is what the transition blend and
  `_currentLookAtTarget` assignment consume.
- No downstream clamp on `_filteredTarget`,
  `_currentLookAtTarget`, `camFwd`, or `camera.quaternion` in
  `CameraChoreographer.js` or `FlythroughCamera.js` (Director §5.7:
  *"no secondary safety net"*; drift-risk "Clamp creep" below).

**Acceptance.** Three layers, per Director §6 — all three must
pass for Attempt-1 to complete:

1. **Mechanism-level (M1–M6).** Grep + diff review confirms each
   requirement above.
2. **AC-level (AC #8 revised — see AC #8 below).** Fresh Sol
   D-shortcut tour capture passes the revised ceiling, p99, and
   jerk-companion invariants.
3. **Recording-level (AC #9 — six visual check-points below).**
   Fresh Sol tour recording passes Max's evaluation against each
   check-point.

**dt-sampling carve-out** (inherited from cycle-2): single-violation
frames where dt < 1ms after a long-dt hitch are accept-as-artifact
with Director per-capture ruling. If more than one dt-sampling
artifact persists, footnote each in the commit and flag to Director.

**AC #8 — ESTABLISHING camera angular motion falls inside the
redesigned numerical envelope (cycle-4 Attempt-1 revised invariants;
recording-assertion, not runtime enforcement).** Per
`docs/FEATURES/autopilot.md` §"Camera axis — ESTABLISHING (V1)" —
*"slow angular velocity, composed framing."* A fresh Sol D-shortcut
tour capture, post-cycle-4-Attempt-1, running the revised
`window._autopilot.telemetry.audit.cameraViewAngularContinuity`
audit (metric + thresholds below):

**AC #8 — revised measurement.** The audit uses the **true 3D
angular rate** between consecutive rendered camera-forward
vectors:
```
ω_3D = acos(clamp(camFwd_t · camFwd_{t-1}, -1, 1)) / deltaSec
```
The prior chart-decomposed `max(|Δyaw_chart|, |Δpitch_chart|)`
metric from `src/main.js:1038–1057` is **retired** from AC #8 (per
cycle-3 audit §2 — chart decomposition compresses yaw by
`1/cos(pitch)` off-equator and is undefined at the poles; Dana
landmine #3 independently names per-axis rate reasoning as a
staircase-artifact source). The chart fields stay as diagnostic
telemetry; they do not gate AC #8. `main.js` is updated to
compute and emit `camAngRate3D` on the per-frame sample, and the
audit at `src/main.js:~L666` reads it.

**AC #8 — thresholds (recording-assertion invariants, not runtime
clamps).** Per Director §§5.7 + 6b + 5a answer #4:

- **Hard ceiling (recording invariant).** `ω_3D ≤ 10.47 rad/s
  (600°/sec)` on every frame. Zero violations across the full
  recording. This is a **post-hoc numerical assertion** the audit
  runs against the captured telemetry — NOT a runtime clamp. The
  filter's natural smoothness is what keeps `ω_3D` under the
  ceiling; a violation means the mechanism class or parameters are
  wrong, per §7 Stop A/B (surface to Director, do not add a clamp).
- **Typical-case soft invariant.** `ω_3D` p99 ≤ 3.5 rad/s
  (~200°/sec) during TRACKING / LINGERING frames; `ω_3D` p99.9 ≤
  10.47 rad/s overall. This encodes §"How it fits the bigger
  picture" / feature-doc's *"slow angular velocity, composed
  framing"* as a numerical criterion. Rationale (Director §6b): a
  professional camera operator on a dolly rig tops out around
  200°/sec for a "pan-follow" move; the 600°/sec ceiling is the
  safety envelope for genuinely fast motion, the expected body is
  much slower. Half-life 0.35s gives a theoretical peak of
  ~3.7 rad/s on the worst realistic setpoint jump (Director §5.5
  derivation) — consistent with p99 ≤ 3.5 and confirmed if the
  capture delivers it.
- **Smoothness companion — angular jerk (new, cycle-4).** The time
  derivative of angular acceleration of `camFwd`:
  ```
  jerk = (ω_3D_t − 2·ω_3D_{t-1} + ω_3D_{t-2}) / deltaSec²
  ```
  or the equivalent from the filter's `_filteredTargetVelocity`
  state. A smooth filter's jerk sits near zero most of the time
  with brief bounded excursions; a clamp-driven mechanism's jerk
  shows sharp spikes at clamp-activation boundaries. **Threshold
  TBD by Director during cycle-4 Attempt-1 first-capture review**
  (Director §6b: *"threshold to be set empirically during cycle-4
  first capture, with Director review before fixing it. This is
  the numerical signature of 'no visible snap' distinct from 'no
  violation of rate ceiling.'"*). Working-Claude emits the `jerk`
  field on the per-frame sample and surfaces the p50 / p95 / p99 /
  max to Director at the first-capture audit boundary; Director
  fixes the threshold in this brief before Attempt-1 commit.

  *Placeholder threshold flag for working-Claude.* If Director is
  temporarily unavailable at first-capture boundary, record the
  observed distribution in the commit message and open a follow-up
  audit request rather than picking a threshold unilaterally.

**AC #8 — historical context.** Cycles 1–3 never hit the ceiling
invariant cleanly. Cycle-1: 70 violations (raw-target-rate clamp
at 450°/sec). Cycle-2: 17 new-class violations (distance guard
added; clamp still at 450°/sec raw-target). Cycle-3: 216 violations
(camFwd-rate clamp at 10.47 rad/s, chart-decomposed AC metric).
Cycle-4 Attempt-1 is the first capture expected to hit zero
ceiling-violations by construction of the filter's natural
smoothness, and the first capture to be measured against the
revised `ω_3D` metric. A cycle-4 Attempt-1 capture with violations
above the ceiling triggers Director §7 Stop A/B (mechanism-class
or parameter-tuning question), NOT a clamp addition.

**AC #9 — head-turn + glance resolved in Max's canvas recording
(six visual check-points, cycle-4 Attempt-1).** Per
`docs/MAX_RECORDING_PROTOCOL.md`. A fresh Sol tour recording
post-cycle-4-Attempt-1 (full tour, Sol default autopilot,
uninterrupted from system-load through at least one full
planet-moon cycle, ideally to tour-complete). Director
pre-commits to the following visual check-points (§6c):

1. **Arrival frame at a small moon (Category: Jupiter's Io-class
   or Saturn's Mimas-class).** Camera responds to the
   reticle-to-disk transition smoothly. No head-turn spike. No
   "camera snapped to follow the body" visible tell. The body
   enters the frame and the camera gradually centers it over
   0.5–1.5 seconds.
2. **Linger on a receding subject.** After the ship leaves STATION
   and begins CRUISE, the camera stays on the body for the full
   `LINGER_DURATION`, then gradually pans forward. The pan is
   continuous; there is no moment where the camera "unstuck" from
   the lingering target and snapped to the next.
3. **PANNING_AHEAD during CRUISE.** The camera leads the ship
   toward the next target at a rate consistent with §"How it fits
   the bigger picture" / feature-doc's *"slow, composed"*
   qualitative criterion. The pan is one continuous motion, not a
   series of catch-up steps.
4. **Approach to a large body (Category: gas giant).** The close-in
   phase does not produce parallax-driven spikes. (This is the
   case cycle-3 failed: large bodies, close approach, parallax
   from ship motion. Dana landmine #6 names the mechanism the
   filter absorbs.)
5. **Approach to a small body (Category: sub-0.1u moon).** Distance
   guard holds; `ω_3D` stays in the slow-composed envelope; no
   "looking past" the body from guard interaction (see drift-risk
   "sub-2u framing composition distortion" — unchanged from
   cycle 2).
6. **Tour-complete → warp-select handoff.** Not strictly a Loop (a)
   concern but the recording should reach it and show no Loop (a)
   regression at the moment the HUD reappears.

Max is evaluator per the motion-evidence-for-motion-features rule
(`feedback_motion-evidence-for-motion-features.md` /
`docs/MAX_RECORDING_PROTOCOL.md`). Linger + pan-ahead authored
behavior (WS 3 ACs #5 + #6) is preserved — only the filter's
smoothing is new, composition / duration / direction authoring is
unchanged.

**AC #9 acceptance.** All six check-points pass Max's evaluation.
Any check-point failure triggers Director §7 Stop A/B/C/D analysis
(is it a parameter-tune question, a mechanism-class question, or a
perceptual criterion the numerical ACs didn't capture).

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

- **Risk: Loop (a) filter half-life too slow (camera lags visibly
  on flips).** If `TARGET_HALF_LIFE_SEC` is too large, the filter
  closes the gap to the raw target too slowly; the camera
  perceptibly chases the subject instead of holding it composed.
  Most visible at framing-state flips: the LINGER anchor appears
  to "chase" a receding body instead of following it gracefully,
  or PANNING_AHEAD during CRUISE feels sluggish relative to the
  ship's forward motion.
  **Why it happens:** at critical damping, filter response is
  monotonic to setpoint; half-life directly parameterizes response
  time. Seed `0.35s` is principled (§"How it fits the bigger
  picture" / Director §5.5 Blue-Danube phrasing derivation) but
  Attempt-1 capture is the falsification event.
  **Guard:** AC #8 soft invariant `p99 ≤ 3.5 rad/s` is a numerical
  proxy — if the measured p99 sits well below 3.5 rad/s AND Max's
  recording reads as sluggish, the filter is under-responsive.
  Attempt-1 first capture surfaces the observed p50/p95/p99
  `ω_3D` distribution to Director; if Max's recording review
  agrees the camera is "draggy," tune `TARGET_HALF_LIFE_SEC`
  downward (e.g., 0.25s, 0.20s) inside the 2-parameter-tune budget
  per Attempt 1 (Director §7). Do not add a clamp as a
  "responsiveness booster" — that's clamp creep (separate
  drift-risk below).

- **Risk: Loop (a) filter half-life too fast (residual clamp-class
  pathologies survive).** If `TARGET_HALF_LIFE_SEC` is too small,
  the filter barely smooths; the camera responds almost at the
  raw-target's frame-to-frame rate, preserving parallax spikes and
  arrival jerks that cycles 1–3 were trying to clamp. Small jerks
  on arrival and head-turn on framing-state flip return — the
  mechanism-class signature Max already rejected in path-2
  escalation.
  **Why it happens:** tuning pressure to "make the camera more
  responsive" is the intuitive fix for the too-slow risk; tuning
  too far the other direction undoes the mechanism's point.
  **Guard:** AC #8 hard ceiling (10.47 rad/s, zero violations) AND
  the angular-jerk smoothness companion are the numerical
  falsifiers — a filter tuned too fast shows jerk spikes
  indistinguishable from a clamp-activation boundary. If Attempt-1
  capture shows jerk distributions with sharp per-frame
  excursions, the half-life is too small — widen it. If widening
  still shows jerk spikes at specific events (arrival, flip), the
  mechanism class may be wrong — surface to Director for §7 Stop
  B Attempt-2 analysis, do not keep tuning.

- **Risk: Filter initialization at first frame (undefined state on
  ESTABLISHING entry).** The spring has no prior state on the
  first frame after ESTABLISHING becomes active —
  `_filteredTarget` and `_filteredTargetVelocity` are
  fresh-constructed `Vector3` objects. If they default to (0,0,0)
  and `_filteredTarget` is used directly by `camera.lookAt`, the
  first-frame camera aims at world-origin (likely far from the
  intended subject), producing a visible one-frame snap to the
  correct direction on frame 2.
  **Why it happens:** `new THREE.Vector3()` defaults to (0,0,0);
  zero-initializing filter state and running the filter update on
  frame 1 gives `_filteredTarget = exponential_blend(0,0,0 →
  realTarget)` which lands somewhere between origin and subject.
  **Guard:** explicit init rule per AC #7 — on the first frame
  after ESTABLISHING entry, `_filteredTarget.copy(
  _prevRawTargetFrame)` (the guarded raw target) and
  `_filteredTargetVelocity.set(0, 0, 0)`, THEN run the filter from
  frame 2 onward. Director §6a M5: *"On ESTABLISHING entry, the
  filter state snaps to the current camera forward direction (no
  transient catch-up)."* Verified by grep for the init branch in
  `EstablishingMode.update()` or in an `onActivate` hook.

- **Risk: Framing-state transition reset question (flip behavior
  ambiguous in §5.4 for non-adjacent setpoints).** Director §§5.4 +
  6a M5 specify that `_filteredTargetVelocity` PERSISTS across
  framing-state transitions (TRACKING ↔ LINGERING ↔
  PANNING_AHEAD) — no reset on flip. This is the structural
  mechanism for continuity-at-flip and is canonical for the
  redesign. **However,** if Attempt-1 capture shows that a
  specific flip class (e.g., LINGERING → TRACKING when the new
  target is 180° from the prior target) produces a noticeable
  camera swing with inertia carrying it past the new setpoint,
  the persistence rule may be over-permissive for discontinuous
  setpoint jumps. This is explicitly an Attempt-1 design question,
  not a mechanism-class failure.
  **Why it happens:** `_filteredTargetVelocity` is inertia; a
  large setpoint jump at a frame boundary makes the spring's
  critically-damped response interact with pre-existing velocity
  in a way that looks "like the camera is still headed the wrong
  way for a beat." Whether that reads as natural inertial
  handoff or as a visible flaw is a perceptual question.
  **Guard:** do not unilaterally add a velocity-reset rule.
  Surface the observed behavior to Director at Attempt-1
  first-capture audit; Director §5.4 says *"Do not zero on flip"*
  as the canonical ruling, and deviating requires an explicit
  audit entry. If a flip-reset rule is ultimately needed, it is
  authored in a follow-up amendment, not inlined.

- **Risk: Clamp creep (the cycle-1/2/3 shape returning as a
  "safety net").** The temptation is to keep a safety clamp on
  `_filteredTarget` or on `camera.quaternion`'s frame-delta *"just
  for the ceiling invariant."* Director §5.7 forecloses this:
  *"A safety clamp on the filter's output fights the filter. Pick
  one."* The cycles-1/2/3 shape was an externally-enforced rate
  ceiling on a raw-physics direction — the redesign replaces that
  shape; reintroducing a clamp layer below the filter reinstates
  the shape under a new name.
  **Why it happens:** if Attempt-1 capture shows even one ceiling
  violation, the intuitive fix is *"add a clamp that only fires
  above 10.47 rad/s — won't affect normal motion."* That clamp is
  exactly the mechanism class §7 Stop A/B is designed to send to
  Attempt 2, not to patch.
  **Guard:** AC #8 hard ceiling is a **recording-assertion
  invariant**, not a clamp spec. If the recording shows a
  violation, the filter parameters are wrong (widen half-life
  toward too-slow zone, see risk above) OR the mechanism class is
  wrong (surface to Director for §7 Stop B Attempt-2). Grep of
  `CameraChoreographer.js` and `FlythroughCamera.js` post-cycle-4
  for any `slerp`, `lerp`, or angular-threshold check on
  `_filteredTarget`, `_currentLookAtTarget`, or `camera.quaternion`
  that gates on a ceiling is a falsification test — if found,
  remove or escalate.

- **Risk: Soft re-coupling to ShipPhase.** If PM or working-Claude
  finds themselves wanting to switch filter parameters based on
  ship phase (*"stiffer during APPROACH, looser during CRUISE"*),
  that's a re-coupling against the feature doc's two-axis
  structure — the Bible invariant `docs/GAME_BIBLE.md` §"Authored
  camera" is a camera-axis concern. Filter parameters depending
  on `ShipPhase` would make camera-axis behavior derivable from
  ship-axis state.
  **Why it happens:** different ship phases have different
  apparent-target-rate distributions (APPROACH's close parallax
  vs CRUISE's far-range pans); a constant half-life may feel
  different in each. The fix looks trivial: switch half-life on
  phase.
  **Guard:** per Director §3 out-of-scope list — "the camera-axis
  architecture (feature doc §two-axis phase structure).
  `ESTABLISHING` stays camera-axis-only; the redesign does NOT
  re-couple to `ShipPhase`. Keep gains global or derived from
  observable camera-side quantities, not from ship-axis state."
  Any phase-dependent behavior must route through
  `_framingState` (TRACKING / LINGERING / PANNING_AHEAD — all
  camera-axis), not through `ShipPhase` (STATION / CRUISE /
  TRAVEL / APPROACH — ship-axis). If Attempt-1 capture argues
  for phase-variant half-lives, surface to Director; this is a
  mechanism-class decision (two-state filter) not a parameter
  tune.

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

- **Loop (a) cycle-4 Attempt 1 —
  `CameraChoreographer.js:EstablishingMode.update()`** rebuilt
  from scratch. Two co-mechanisms, in order:
    1. **Target-distance guard** (`MIN_TARGET_DISTANCE = 2.0`
       scene units, cycle 2, retained unchanged). Ensures
       `|_prevRawTargetFrame − shipPos| ≥ MIN_TARGET_DISTANCE`;
       if closer, push outward along current direction with the
       degenerate fallback chain (prior-frame direction → camera
       forward) from AC #7. Runs first.
    2. **Target-position critically-damped spring**
       (`TARGET_HALF_LIFE_SEC = 0.35`, ζ = 1.0 hardcoded,
       Holden's `spring_damper_exact` / Lowe's `SmoothDamp`
       analytical form). Acts on the **Vector3 world-space point**
       that is the post-guard raw lookAt target. New
       `EstablishingMode` state fields: `_filteredTarget`
       (Vector3, position state), `_filteredTargetVelocity`
       (Vector3, velocity state — persists across framing-state
       transitions per §5.4). Init on ESTABLISHING entry:
       `_filteredTarget.copy(_prevRawTargetFrame)`,
       `_filteredTargetVelocity.set(0, 0, 0)`. Per-frame update
       mutates both fields in place. Downstream:
       `_currentLookAtTarget` assignment and the transition blend
       consume `_filteredTarget` (not `_prevRawTargetFrame`
       directly). `camera.lookAt(_filteredTarget)` is the
       effective render call.
  Constants exposed at top of module as named tunables alongside
  `LINGER_DURATION` and `PAN_AHEAD_FRACTION`. Both co-mechanisms
  apply to TRACKING, PANNING_AHEAD, and LINGERING→TRACKING
  fall-through via single-point placement after the switch's
  closing brace (guard first, filter second, then blend).
  **Removed in full from cycle 3:**
  `MAX_FRAME_CAM_ANGULAR_RATE_RAD_PER_SEC = 10.47` constant, the
  camFwd-rate clamp block at `CameraChoreographer.js:428–455`,
  state fields `_priorCamFwdRendered` and `_hasValidPriorCamFwd`,
  the tail `_prevShipPos` snapshot at `CameraChoreographer.js:475`
  (if its only reader was the clamp — working-Claude verifies
  during implementation per §5.7), and cycle-1's long-dead
  `MAX_FRAME_ANGULAR_RATE_DEG_PER_SEC = 450`. No post-filter
  clamp is added back (§5.7; drift-risk "Clamp creep").

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

### Cycle-4 Loop (a) redesign out-of-scope perimeter (Director §3)

Per Director's cycle-4 redesign scoping §3 — any PR that crosses
these lines is out of scope for the cycle-4 Loop (a) redesign and
triggers a Director hold:

- **Loops (b) and (c).** Both `VERIFIED_PENDING_MAX`
  (`3ba1159`, `273e725`). Their mechanisms (VelocityBlend
  two-anchor; local-maximum shake-onset detector) are untouched
  by the cycle-4 redesign. If Attempt-1 capture surfaces AC #9 or
  AC #10 regressions caused by interaction with the new filter,
  those are flagged to Max, not patched inside this workstream.
- **The orbit subsystem.** STATION-phase orbit-distance-floor
  (feature-doc parking-lot travel-feel item) is a separate parked
  concern.
- **The nav-produced `lookAtTarget`.** Upstream producer of raw
  target directions. The redesign consumes whatever the nav
  subsystem emits; it does not revise the emission contract.
  A smoothing filter on the *input* side is in-scope for the
  filter's job; revising the *producer* is out.
- **The motion-produces-target pipeline boundary.**
  `ShipChoreographer` → `NavigationSubsystem.nextTarget(...)` →
  `CameraChoreographer`. Redesign lives strictly inside
  `CameraChoreographer.EstablishingMode`. The pipeline shape is
  preserved.
- **The camera-axis / two-axis camera architecture** (feature
  doc §"two-axis phase structure"). `ESTABLISHING` stays
  camera-axis-only; the redesign does NOT re-couple to
  `ShipPhase`. Filter parameters are global constants or routed
  through `_framingState` (camera-axis), never through
  `ShipPhase` directly — see drift-risk "Soft re-coupling to
  ShipPhase."
- **The Bible invariant that the camera is authored, not derived
  from raw physics** (`docs/GAME_BIBLE.md` §"Authored camera").
  The redesign implements a smoother/filter — this IS authored
  camera motion (the filter is the authoring). Any proposal whose
  mechanism is "pass through raw physics with a final clamp"
  fails this invariant by construction and is rejected at
  scoping time.
- **AC #8 as a threshold quantity.** The value and the
  definition-of-what-it-measures are revisable (and are revised
  for cycle 4: `camAngRate3D` replacing chart decomposition).
  The idea of *having* a numerical invariant that bounds camera
  angular rate stays — that's the Max-greenlight context for
  measuring 3D rate.
- **The distance guard (`MIN_TARGET_DISTANCE = 2.0`).** Keep.
  Orthogonal to rate; Dana's landmines #1 and #2 independently
  confirm the guard's geometric-precondition role as distinct
  from damping.
- **Telemetry (reckoning fields).** The redesign reads reckoning
  fields freely but does not alter their definitions. AC #8's
  measurement formula in the audit helper is revised (3D rate);
  that's a different change in the same file, in scope for the
  cycle-4 amendment.

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

**Loop (a) cycle-4 Attempt 1 — target-position critically-damped
spring (retained distance guard).**

Canonical source for these steps: Director's 2026-04-24 cycle-4
redesign scoping audit (`~/.claude/state/dev-collab/audits/autopilot-
live-feedback-2026-04-24.md` §§1–8 + §5 closure). Quote §5 closure
verbatim when implementation detail is load-bearing.

9. **Remove cycle-3 (and residual cycle-1) code from
   `src/auto/CameraChoreographer.js`** per §5.7:
   - Delete module-level constant
     `MAX_FRAME_CAM_ANGULAR_RATE_RAD_PER_SEC = 10.47`.
   - Delete `EstablishingMode` state fields
     `_priorCamFwdRendered` and `_hasValidPriorCamFwd`.
   - Delete the camFwd-rate clamp block (`CameraChoreographer.js`:
     428–455 in the uncommitted cycle-3 edit — slerp-with-fallback
     block between the distance guard and the blend).
   - Delete the tail `_prevShipPos` snapshot at
     `CameraChoreographer.js:475` **IF** its only reader was the
     clamp. Grep `_prevShipPos` across `src/auto/` and
     `src/main.js` to verify — retain only if Loop (b) or (c) now
     reads it (unlikely per §5.7).
   - Confirm cycle-1's `MAX_FRAME_ANGULAR_RATE_DEG_PER_SEC = 450`
     is absent (it was slated for deletion in the cycle-3
     amendment; double-check).
   - The cycle-2 distance guard (`MIN_TARGET_DISTANCE = 2.0` plus
     the post-switch guard block) is **retained unchanged**.

10. **Implement the target-position critically-damped spring** in
    `EstablishingMode`:
    - **Add module-level constant**
      `TARGET_HALF_LIFE_SEC = 0.35` at the top of
      `CameraChoreographer.js` alongside `LINGER_DURATION`,
      `PAN_AHEAD_FRACTION`, and `MIN_TARGET_DISTANCE`.
    - **Add `EstablishingMode` state fields:**
      `_filteredTarget: Vector3`, `_filteredTargetVelocity:
      Vector3`. Initialize as fresh `new Vector3()` instances on
      construction (zero defaults).
    - **Add an `isActive` / `onActivate` initialization path.** On
      the first frame after ESTABLISHING becomes active:
      `_filteredTarget.copy(_prevRawTargetFrame)` (after the
      distance guard has run on `_prevRawTargetFrame`) and
      `_filteredTargetVelocity.set(0, 0, 0)`. Working-Claude
      picks the cleanest place to detect first-frame — either an
      explicit `_hasInitialized` flag set at the end of the first
      `update()`, or an `onActivate` hook invoked when
      ESTABLISHING flips on. Document the choice in the commit.
    - **Implement `spring_damper_exact`** (Holden) or equivalent
      `SmoothDamp` (Lowe). Reference: Holden's "Spring-It-On" —
      <https://theorangeduck.com/page/spring-roll-call>. Write the
      analytical closed-form update, NOT a forward-Euler
      approximation. Three independent scalar updates on x/y/z
      components of the Vector3 (equivalent to a spring on the 3D
      point for linear spaces). Signature takes current position,
      current velocity (mutated), goal, half-life, dt; mutates
      position and velocity in place.
    - **Wire it in:** after the distance guard's closing brace and
      before the transition-blend step in
      `EstablishingMode.update()`, call the spring update with
      `_filteredTarget`, `_filteredTargetVelocity`,
      `_prevRawTargetFrame` (the guarded raw target),
      `TARGET_HALF_LIFE_SEC`, `deltaTime`. Downstream, replace
      every reference to `_prevRawTargetFrame` in the blend and
      in the final `_currentLookAtTarget` assignment with
      `_filteredTarget`.
    - **Preallocate temporaries.** If the spring update needs
      scratch Vector3s, reuse module-scope or instance-scope
      temporaries rather than allocating in the hot path.
    - **Do NOT add any post-filter clamp.** §5.7 forecloses this;
      drift-risk "Clamp creep" is the falsification test.

11. **Update the AC #8 audit metric.** In `src/main.js`
    (`_captureTelemetrySample` around L1034–1057 per cycle-3
    audit §2), compute and emit `camAngRate3D = acos(clamp(
    camFwd · camFwd_prev, -1, 1)) / deltaSec` on the per-frame
    sample. In the AC #8 audit helper (`cameraViewAngularContinuity`
    at `src/main.js:~L666`), switch the violation check from the
    chart-decomposed `max(|camYawRate|, |camPitchRate|)` to
    `camAngRate3D`. Emit companion fields `camAngJerk3D` (the
    second-difference / time-derivative of `camAngRate3D`) for
    Director's Attempt-1 first-capture threshold-setting review.
    The chart-decomposed fields remain as diagnostic telemetry;
    they no longer gate AC #8.

12. **Run Attempt-1 capture.** Fresh Sol D-shortcut tour via
    MCP chrome-devtools. Run
    `window._autopilot.telemetry.audit.cameraViewAngularContinuity`
    with the revised metric. Evaluate:
    - **AC #8 hard ceiling:** zero violations `ω_3D > 10.47 rad/s`.
    - **AC #8 soft invariant:** p99 `ω_3D` during TRACKING /
      LINGERING ≤ 3.5 rad/s; p99.9 overall ≤ 10.47 rad/s.
    - **Jerk distribution:** emit p50 / p95 / p99 / max of
      `camAngJerk3D` for Director's threshold-setting review.
    - **AC #9 six visual check-points:** capture the tour as a
      canvas recording via `~/.claude/helpers/canvas-recorder.js`;
      drop at
      `screenshots/max-recordings/autopilot-live-feedback-loop-a-
      cycle4-attempt1-2026-04-24.webm`.
    - **M1–M6 grep + diff audit:** verify each mechanism-level
      requirement from AC #7 / Director §6a.
    dt-sampling-artifact carve-out from cycle 2 is retained.

13. **Director re-audit before commit.** Surface to Director with:
    - The `ω_3D` distribution (p50/p95/p99/max).
    - The `camAngJerk3D` distribution (p50/p95/p99/max — for
      threshold-setting).
    - The M1–M6 grep + diff results.
    - The Attempt-1 recording.
    - Any observed anomalies (flip-transition handoff quality,
      sub-2u framing composition, filter-speed feel).
    Director audits against AC #7 / AC #8 / AC #9 and either:
    - **Closes Attempt 1** with jerk threshold written into AC #8
      and a `VERIFIED_PENDING_MAX <sha>` commit greenlight; OR
    - **Triggers a parameter-tune pass** (≤ 2 per Attempt 1,
      Director §7) — adjust `TARGET_HALF_LIFE_SEC` and re-capture;
      OR
    - **Triggers Stop B Attempt 2** — mechanism-class failure;
      re-scope in a new audit entry with a different class
      (Cinemachine Body+Aim two-stage; first-order EMA on target;
      look-ahead composition onto spring — candidates named in
      §5.3 rejected list, re-evaluated on Attempt-1 evidence).

14. **Commit Attempt 1 on Director greenlight.** Commit message
    names cycle-4 Attempt-1 mechanism-class substitution
    (clamp-class → target-position critically-damped spring),
    cites cycle-4 scoping audit SHA
    `f63ec122a57895383720ddf4895d3256cd37b2ce`, names Dana's
    research file `research/autopilot-camera-motion-prior-art-
    2026-04-24.md`, and notes the cycle-3 code removals per §5.7.
    Close `VERIFIED_PENDING_MAX <sha>` for Loop (a)
    specifically.

**Workstream close.**

15. Run `runAllReckoning` + all four shake audits + the continuity
    audits on a consolidated fresh tour. Verify AC #11.
16. Update this brief's `## Status` with per-loop Shipped SHAs and
    recording paths.
17. Close at `VERIFIED_PENDING_MAX <final-sha>` — Max evaluates
    against the three recordings. On pass → `Shipped <sha> —
    verified against <recording-paths>`. On fail → diagnose per
    failure class (filter half-life too tight / too loose for
    loop (a) Attempt 1; mechanism-class fail triggers Attempt 2
    per Stop B below; local-maximum detector too strict for
    loop (c); per-seam body ref wrong for loop (b)).

**Cycle-4 Attempt-1 stop conditions (Director §7).**

- **Stop A — continue to tune.** Attempt-1 capture shows the
  filter's jerk signature is fundamentally different from a
  clamp-driven one (no sharp spikes at activation boundaries) AND
  the numerical ACs pass OR fall narrowly below target with a
  clear tuning path. Working-Claude proceeds into the
  2-parameter-tune budget: adjust `TARGET_HALF_LIFE_SEC` (not ζ,
  which is hardcoded at 1.0) and re-capture. Stop A's budget is
  ≤ 2 tuning passes per Attempt 1; before a third tuning pass,
  working-Claude surfaces to Director.

- **Stop B — mechanism class wrong; trigger Attempt 2.** Attempt-1
  capture shows the mechanism class itself is wrong (e.g., filter
  oscillates because the setpoint itself is discontinuous; large
  setpoint jumps produce visible overshoot that critical damping
  should have precluded; jerk signature shows filter-internal
  spikes not attributable to clamp class). Director re-scopes in
  a new audit entry with a different mechanism class — candidates
  from §5.3's rejected list (Cinemachine Body+Aim two-stage;
  first-order EMA on target; look-ahead composition onto spring).
  No auto-resume — Attempt 2 is a fresh scoping cycle.

- **Stop C — both attempts fail; escalate to Max.** Attempt 2
  also fails. Escalate to Max with a full audit of both attempts
  + Dana's research + Director's recommendation for next action.
  No Attempt 3 without Max's direction. The full-rebuild budget
  is exhausted; the question returns to Max for vision-level
  re-direction.

- **Stop D — numerical ACs pass but §6c recording fails.** Not a
  mechanism-class failure; likely a perceptual criterion the
  numerical ACs didn't capture. Director + Max collaborate on a
  new numerical AC that encodes what Max saw (e.g., if
  flip-transition handoff looks wrong, a flip-specific
  ω_3D-during-first-200ms-post-flip AC), then re-tune. This is a
  learning outcome, not a budget failure — Attempt 1 is not
  consumed; the re-capture runs against the new AC with the same
  filter parameters.

**If the diff to any consumer reads from `window._autopilot.
telemetry.samples` or equivalent sampler output, stop and
escalate to Director.** AC #10 / Principle 5 violation — the
fix is to extract the live-state derivation into a shared early-
stage helper. (Unchanged from pre-cycle-4 stop condition.)

**If loop (c)'s local-maximum detector is introducing >1-frame
event-onset lag (AC #5 passes but shake onset perceptibly lags
Max's felt peak in the recording), stop and escalate to Director.**
The two-point variant may be needed. (Unchanged — Loop (c) scope
is not touched by the cycle-4 redesign.)

**If the filter visibly slows authored camera pans below
subjective acceptability (pans feel "heavy" or "draggy"), stop
and surface to Director.** This is the "half-life too slow"
drift-risk; fix is to reduce `TARGET_HALF_LIFE_SEC` within the
Stop-A tuning budget, not to add a responsiveness clamp
(drift-risk "Clamp creep").

**No Attempt 3 without Max's explicit direction.** Two
mechanism-class attempts is the full-rebuild budget; a third
attempt requires fresh vision-level re-direction (Stop C).

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

---

**Proxy-authoring flag (cycle-3 amendment, 2026-04-24).** The cycle-3
amendment (Status cycle-3 paragraph; cycle-3 revision-history
entry; AC #7 Mechanism 1 rewrite; In-scope Loop (a) block update;
shake-contribution drift-risk addition; Handoff steps 9–12 rewrite;
cycle-3 stop-condition replacement) was authored by working-Claude
in **degraded-mode PM-proxy** per CLAUDE.md §"PM agent times out
mid-work." Canonical source quoted verbatim: Director's cycle-3
audit at `~/.claude/state/dev-collab/audits/autopilot-live-feedback-
2026-04-24.md` (commit SHA `89261d1c304687728a86140172d2a2957ce96035`).
All mechanism substitution terms (constant names, state field
names, placement order, degenerate fallbacks, stop conditions, "keep
the cycle-2 distance guard" ruling) were transcribed from the audit,
not authored on working-Claude's judgment. **Superseded by cycle-4
redesign amendment (below) — the cycle-3 Mechanism-1 rewrite is
closed; Loop (a) cycle-3 code is slated for removal per §5.7.**

---

**PM authorship (cycle-4 redesign amendment, 2026-04-24).** The
cycle-4 redesign amendment (Status block rewrite for Loop (a) to
"cycle-4 REDESIGN IN PROGRESS"; cycle-4 revision-history entry
with Max's path-2 greenlight + Dana's convergence quote + Director's
§5 closure cite; full AC #7 rewrite for target-position
critically-damped spring; full AC #8 rewrite with revised metric +
ceiling/p99/jerk invariants as recording-assertion; AC #9 rewrite
with six visual check-points from §6c; Loop (a) drift-risks rewrite
(new: filter-too-slow, filter-too-fast, filter-initialization,
transition-reset, clamp-creep, soft-re-coupling; removed:
shake-contribution); In-scope Loop (a) block rewrite; cycle-4
out-of-scope perimeter from §3; Handoff steps 9–14 rewrite as
Attempt-1 implementation playbook; Workstream-close renumbering
15–17; cycle-4 Stop A/B/C/D conditions replacing cycle-3 stop
conditions) was authored by the PM agent per Director's cycle-4
redesign scoping audit (`~/.claude/state/dev-collab/audits/autopilot-
live-feedback-2026-04-24.md` §§1–8 + §5 closure,
HEAD at audit `f63ec122a57895383720ddf4895d3256cd37b2ce`). Director
§5 closure (§§5.1–5.9) quoted verbatim in the mechanism section;
§5a answers quoted verbatim in the revision entry as the
audit-direction cite. Dana's research file
`research/autopilot-camera-motion-prior-art-2026-04-24.md` is cited
as the load-bearing input to §5 mechanism-class finalization.

Authorial scope granted by Director §5.9: *"PM is cleared to
author the brief amendment against this scoping as-is. §§1–8 of
this audit are the canonical direction; §5 as written here is the
mechanism-class section PM will transcribe into AC #7's
formulation."* Jerk-threshold placeholder flagged in AC #8 per
§6b *"threshold to be set empirically during cycle-4 first
capture, with Director review before fixing it"* — working-Claude
surfaces the distribution for Director to fix before Attempt-1
commit.
