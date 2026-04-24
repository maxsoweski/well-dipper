# Workstream: Autopilot phase-transition velocity continuity — three seams (2026-04-23)

## Status

`HELD — REJECTED on 2026-04-24, telemetry insufficient. Superseded (partially) by autopilot-live-feedback-2026-04-24 — loop (b) replaces the velocity-blend mechanism's seam-blend target with a live-per-body read, resolving the moon-motion reconciliation class of bug this workstream's T₀-captured extrapolation cannot address. VelocityBlend machinery (window + smoothstep ramp) stays; the blend target moves from captured-extrapolation to live-per-body. Continuity re-audit runs against the new pipeline after the live-feedback workstream Ships; this workstream's Shipped flip waits on that re-audit.` Max viewed the 2026-04-23 recording and reported specific visible issues the telemetry self-audit did NOT catch:

> *"After arriving at the planet, there's a weird head turn motion that happens, and then there's a weird pause followed by a small zoom in, zoom out, then return. Then the orbit commences pretty normally. Then there's a transition to a moon and there's like another weird kind of like jerky motion."*

Plus: *"The camera shake does not seem to be at all choreographed with the acceleration and deceleration. It feels like it happens kind of at random points."*

**Director owned the telemetry miss** (session 2026-04-24 audit). AC #1c / #2c / #3c measured velocity-direction angle between velocity vectors, NOT angular change of camera-view direction frame-to-frame. A 0.03-unit `camLookAt` shift at a target 0.3 units away = ~5.7° of view swing — a head turn — but the AC rubric registered it as "smooth." Same gap on shake: AC #17 checked shake is active when signal is above floor, but did NOT verify shake onset correlates with signal peaks; a random fire at a quiet moment would pass.

**Workstream stays HELD.** Code at `f90ae2e` is preserved in git history but does NOT ship without re-audit against expanded telemetry. The new `autopilot-telemetry-reckoning-2026-04-24` workstream (supersedes the drafted `autopilot-telemetry-coverage-2026-04-23`) blocks this workstream's re-audit; WS 4 waits behind both.

Max's verbatim ultimatum (2026-04-24): *"If the telemetry system right now, as it is, is supposed to give me all of these points of information that I care about ... if it doesn't do that today, then we need to stop, and I need you to actually implement a system that does those things."*

---

**Historical: VERIFIED_PENDING_MAX claim (rejected 2026-04-24, retained for audit trail):**

`VERIFIED_PENDING_MAX f90ae2e` — continuity workstream code committed in two commits (`b630873` VelocityBlend helper; `f90ae2e` NavigationSubsystem integration at all three seams + main.js telemetry extension). Director audit at `14835cc` released the gate; implementation follows the unified velocity-blend pattern Director specified.

**Telemetry verification (60s Sol D-shortcut tour, 4024 samples at ~68Hz):**
- 5 seam transitions across 2 tour cycles.
- **Velocity-direction angle at every seam: ≤ 0.1°** (AC #1c/#2c/#3c threshold: 15°). Well below threshold.
- **Velocity-magnitude delta at every seam: ≤ 0.04 u/s** (AC #1b/#2b/#3b band-shape threshold: 2× adjacent-frame magnitude deltas). Negligible.
- **Shake ACs #16-20: all PASS** (AC #5 no-regression verified — round-10/11 shake mechanism intact).
- **WS 3 camera-axis structurally preserved** (AC #6 — no changes to CameraChoreographer / EstablishingMode).

**Recording:** `screenshots/max-recordings/autopilot-phase-transition-velocity-continuity-2026-04-23.webm` (~16.7 MB, 60s Sol D-shortcut tour covering all three seams).

**Implementation summary:**
- `src/auto/VelocityBlend.js` — shared state-tracker (96 lines). Begin/advance/blendT API; smoothstepped 0 → 1 over duration for C1 continuity at both ends.
- Three seam captures:
  - Seam 1 (STATION→CRUISE): `_pendingSeam1Capture` at `_updateOrbit` orbitComplete frame; consumed at next `_beginTravel` (cross-module boundary with main.js handled inside nav subsystem per Director's ruling). Duration 0.5s.
  - Seam 2 (TRAVEL→APPROACH): `_captureSeamAndBegin()` in `_updateTravel` at `t >= 1`. Duration 0.3s.
  - Seam 3 (APPROACH→ORBIT): `_captureSeamAndBegin()` in `_updateApproach` at completion. Duration 0.5s.
- Position-space lerp in `update()` per tick: during blend window, `_position = lerp(natural, capturedExtrapolation, 1 − blendT)`. At blendT=0 (seam entry), position = captured extrapolation (continuous); at blendT=1 (blend end), position = phase natural.
- `MotionFrame.shipVelocity` added (AC #7 field landed here per Director's split; audit helper `velocityContinuityAtSeams` belongs to the telemetry-coverage workstream).

**Tunable durations at top of NavigationSubsystem.js** (F12-edit-reload-observe per the tuning-dashboard pattern): `_seam1Duration = 0.5`, `_seam2Duration = 0.3`, `_seam3Duration = 0.5`.

Awaiting Max's verdict.

---

**Historical: HELD state (superseded by commits b630873 + f90ae2e).**

`HELD — pending Director audit of expanded scope.` Expanded 2026-04-23
from the original single-seam APPROACH → ORBIT brief
(`autopilot-approach-orbit-continuity-2026-04-22.md`, `Drafted — pending
Director audit`) to cover **all three velocity-direction-flip seams** Max
surfaced during WS 3 camera-axis retirement review. Director ruled the
expansion (session 2026-04-23 audit, after WS 3 Shipped at `b7699de`):
one class of bug — phase-transition velocity hand-off — at three seams;
fix all three together because fixing one without the others is whack-a-
mole. Max greenlit. The expanded scope requires Director re-audit before
working-Claude picks up implementation — the single-seam Candidate-A fix
does not generalize unchanged to the other two seams, so the unified fix
pattern (velocity-blend-at-seam-boundaries) must be adjudicated.

Predecessor workstream:
`docs/WORKSTREAMS/autopilot-approach-orbit-continuity-2026-04-22.md` —
redirect stub pointing here. The 2026-04-22 Candidate A / B / C
articulation for APPROACH → ORBIT carries forward as scoped alternatives
for that seam specifically; the new brief picks a unified shape across
all three seams.

## Parent feature

`docs/FEATURES/autopilot.md` — arrival/orbit/departure transition
cinematography. Feature-doc §"Ship axis" names the four phases
(`ENTRY / CRUISE / APPROACH / STATION`) whose transitions this
workstream hardens. Specific anchors:

- **§"Per-phase criterion — ship axis (V1)"** — all four phases specify
  *"smooth"* or *"settle"* continuity at entry/exit that the current
  nav-layer seams violate at the velocity derivative.
- **§"Drift risks"** — the "sudden velocity flips at phase boundaries"
  drift is named implicitly under the broader ship-cinematography
  quality bar (cited by WS 2 brief §"Drift risks" on shake-vs-nav-motion
  separation).
- **§"V1 — must ship"** bullet *"Ship phase transitions must feel
  continuous — no visible hitch at CRUISE → APPROACH, APPROACH → STATION,
  or STATION → CRUISE"* — this workstream closes that bullet.

If `docs/FEATURES/autopilot.md` does not currently quote those
transitions verbatim, Director audit of the expanded scope may flag it
for a feature-doc amendment before execution begins. Per PM convention:
feature-doc amendments are Director-owned; this brief flags, does not
author.

## Implementation plan

N/A (feature is workstream-sized). The three seams live in one module
(`src/auto/NavigationSubsystem.js`) with one call-site sibling in
`src/main.js` (the STATION → CRUISE `orbitComplete` → `beginMotion`
bridge). No cross-system state machine complexity that a PLAN doc would
clarify. The Director audit of the expanded scope may call for a PLAN
bootstrap if the unified velocity-blend helper's contract is load-bearing
enough to warrant one; working-Claude should escalate to PM before
implementing if the helper's shape grows beyond ~40 lines.

## Scope statement

Eliminate velocity-direction discontinuities at all three phase-
transition seams. Position is already continuous at all three; what
changes is the velocity derivative. Fix all three together because they
share one class of bug — phase-transition velocity hand-off — and share
one solution shape (velocity-ease-in at the new phase's frame 1 from the
previous phase's terminal velocity).

The three seams:

- **Seam 1 — STATION → CRUISE (departure).** Orbit's final-25% pull-out
  phase (`_updateOrbit` line 606–607: `pullT = (orbitT - 0.75) / 0.25;
  dist *= 1 + this._ease(pullT) * 0.25`) grows `dist` radially over the
  last quarter of the orbit, producing a radially-outward velocity
  component at orbit-end. `main.js` line 5934 then calls
  `navSubsystem.beginMotion({ fromPosition: camera.position.clone(), … })`
  on `orbitComplete`, and `_beginTravel` (line 336+) recomputes
  `_departureTangent` from orbit yaw/pitch — flat, pre-pullout, pre-y-
  tilt. The Hermite's frame-1 position picks up from the clone (continuous)
  but velocity picks up from the freshly-recomputed tangent (direction
  flip from the pull-out's radial-outward component to the Hermite's
  tangent-only direction).

- **Seam 2 — TRAVEL → APPROACH.** At `_updateTravel` line 813 (`t >= 1`
  branch), `_beginApproach` (line 428–442) is called in the same frame
  as `_updateTravel`'s final `_position.copy(_v6)` write. The Hermite's
  last sample ended with velocity along `_arrivalTangentScaled`
  direction (the authored approach-tangent the travel curves into over
  the last 50% — see line 753 and 784). `_beginApproach` computes
  `_approachInitialDir = normalize(_position - bodyRef.position)` — the
  radial-in unit vector — and `_updateApproach` (line 651+) begins moving
  radially along that direction via `_ease(closeT)` on the same frame.
  Position is continuous (both use `_position`); velocity direction
  flips from Hermite's terminal tangent to approach's radial-in.

- **Seam 3 — APPROACH → ORBIT.** At `_updateApproach` (line 665–670),
  ship position moves radially inward along `_approachInitialDir` via
  `_ease(closeT)` over ~3 s. At `closeT = 1`, radial velocity asymptotes
  to near-zero (the easing curve ends on a flat tangent). `_beginOrbit`
  (line 454+) then re-derives yaw/pitch/dist from the current position
  and, on frame 1 of orbit, `orbitYaw` advances tangentially at
  `orbitYawSpeed × entryFactor`. `entryFactor` at frame 1 is ≈ 0 so
  position stays at the approach endpoint, but the tangential-velocity
  *direction* is nonzero (orthogonal to the approach's radial-in
  direction). Velocity direction flip: radial-near-zero → tangential-
  nonzero. This is the seam the 2026-04-22 brief originally scoped.

**Why one workstream, not three.** Per Director's diagnosis: the three
share one class of bug (phase-transition velocity hand-off — each
phase's starter recomputes its own velocity basis from `_position`
without consulting the previous phase's terminal velocity), and they
share one solution shape (capture previous phase's terminal velocity
vector; ease into new phase's intrinsic velocity from it at frame 1).
Fixing one at a time would (a) duplicate the capture-and-blend scaffolding
three times at three call sites, foreclosing extraction into a shared
helper, and (b) leave the other two seams producing the same hitch Max
sees — whack-a-mole. The three seams also share the shake-mechanism
invariant (round-10/11 subtle rotation-only shake must not regress) and
the WS 3 camera-axis invariant (ESTABLISHING linger/pan-ahead
authoring remains intact) — one coordinated change against those
invariants is safer than three staggered changes re-asserting them.

**Explicitly NOT a license to** restructure how the three phases compose
(i.e., adding a "settle" sub-phase, as the 2026-04-22 brief's Candidate
B proposed for seam 3). The unified fix pattern is the minimal shape:
capture terminal velocity, init new phase velocity from it, ease over
0.3–0.5 s to authored intrinsic velocity. Candidates B and C from the
predecessor brief are retained as fallbacks in case the unified pattern
produces an artifact at one seam that can't be tuned out; Director
audit picks the shape.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Vision / Core Experience — the
**Discover** axis: *"Every system is different. Finding a terrestrial
world or an alien megastructure is rare and meaningful."* A player who
feels a visible hitch at every arrival and every departure is reading
"the autopilot code transitions phases" instead of "the ship smoothly
arrived at the ringed planet." The transition seam is where the
cinematography either holds or collapses — a velocity-direction flip
that the eye can detect (even at subtle shake magnitudes) is
indistinguishable from a scene-level bug and erodes the authored
discover-experience.

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 6 — First Principles Over Patches.** The first-principles
  shape of a phase-transition hand-off is *"the leaving phase deposits
  its terminal state (position AND velocity); the entering phase's frame
  1 initializes from that deposit and eases into its own intrinsic
  dynamics."* The patch move is to tune the easing curves on each
  phase's ends to happen to match (e.g., make the orbit pull-out flatter
  so the departure hitch is less visible). Patches per-seam ship V1 and
  structurally preclude future phase additions (each new phase has to
  re-solve the basis-reconciliation ad hoc). *Violation in this
  workstream would look like:* reshaping `_ease` in `_updateApproach` to
  hand off a non-zero radial velocity that happens to match orbit frame
  1's tangential direction — a patch whose fragility shows up the next
  time the orbit's initial yaw is randomized differently.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer Consumes.**
  The nav subsystem produces the ship's motion frame; downstream
  consumers (camera, shake, HUD) read it without driving it. A velocity-
  blend helper lives inside the nav subsystem — the phase-transition
  hand-off is an internal concern. *Violation would look like:* having
  the camera choreographer (or `main.js`) read the previous phase's
  terminal velocity and pass it into `beginMotion` as an input the
  subsystem didn't own — a reverse-flow where the consumer informs the
  producer about its own state.

- **Principle 2 — No Tack-On Systems.** The velocity-blend helper is
  shared infrastructure for all three seams. Tack-on anti-pattern
  would be: three independent per-seam fixes with copy-pasted capture
  scaffolds. The helper must be authored as a single utility the three
  seams consume.

Principle 1 (Hash Grid Authority) is orthogonal — this work doesn't
touch the hash grid. Principle 3 (Per-Object Retro Aesthetic) is
orthogonal — this authors motion dynamics, not rendering. Principle 4
(BPM-Synced Animation) is orthogonal at V1 — the 0.3–0.5 s blend window
is felt-experience-tuned, not BPM-locked.

## Candidate unified fix pattern (Director's audit to confirm)

At each of the three seams:

1. **Capture previous phase's terminal velocity vector.** At the last
   frame of the leaving phase (or as part of the transition call),
   compute `v_terminal = (position_this_frame - position_prev_frame) /
   deltaTime` OR derive analytically from the phase's formula — whichever
   is cleaner. Expose as a field on the nav subsystem (e.g.,
   `_terminalVelocity: Vector3`) written at phase-end, read at next
   phase's frame 1.

2. **Initialize new phase's velocity from the captured vector.** At the
   first frame of the entering phase, the velocity-generating component
   (Hermite tangent magnitude, approach radial-rate, orbit
   tangential-rate) is not the authored value but a lerp between
   `v_terminal` and the authored value parameterized by a `blendT` that
   ramps 0 → 1 over the blend window.

3. **Ease into authored intrinsic velocity over ~0.3–0.5 s** — per-seam
   tunable, starting values:
   - Seam 1 (STATION → CRUISE): 0.5 s (longest — the pull-out's radial
     component is the most visibly-different direction from the Hermite's
     flat-tangent start).
   - Seam 2 (TRAVEL → APPROACH): 0.3 s (shortest — Hermite's terminal
     tangent and approach's radial-in are both non-zero magnitudes, just
     directionally different; a short blend is enough to reconcile).
   - Seam 3 (APPROACH → ORBIT): 0.5 s (existing 2 s orbit entry-blend
     already ramps `entryFactor`; the velocity-blend is a tighter
     sub-window for the direction reconciliation, with `orbitYawSpeed *
     entryFactor` continuing the 2 s position ramp separately).

4. **Shared helper** — a small velocity-blend class / utility in
   `src/auto/` (name provisional; working-Claude picks). Consumes:
   captured terminal velocity, authored intrinsic velocity, blend
   duration, deltaTime. Produces: the blended velocity for this frame.
   All three seams call through it — no per-seam copy-paste.

**Per-seam specializations (not escapes from the unified shape):**

- **Seam 1 Candidate A (retained from 2026-04-22 brief) — velocity-ease-in
  on Hermite construction.** The Hermite's initial tangent magnitude is
  lerped from captured orbit-terminal velocity magnitude to authored
  Hermite-initial tangent magnitude over 0.5 s. The direction also
  lerps, so the Hermite *starts along* the orbit pull-out's velocity
  direction and curves into the authored travel tangent. Pro: minimal
  edit. Con: alters the Hermite's curve shape on the first 0.5 s (the
  ship takes a slightly different path for that window than it would
  under the authored Hermite alone).

- **Seam 2 — approach radial-rate blend.** Approach's initial radial
  velocity is lerped from `Hermite_terminal_tangent · _approachInitialDir`
  (projection of travel's terminal velocity onto approach's radial
  axis — may be small or negative; that's fine) to authored approach
  radial velocity over 0.3 s. The approach's off-radial velocity
  components (the tangential remainder of the Hermite's terminal
  velocity) damp to zero over the same window.

- **Seam 3 Candidate A (retained, slightly narrowed from 2026-04-22) —
  velocity-ease-in on orbit entry.** `orbitYawSpeed` and
  `orbitPitchPhase` advance rates are scaled by `entryFactor` (2 s ramp,
  already authored) AND by an additional `velocityBlendFactor` (0.5 s
  sub-ramp) so the tangential velocity ramps in from the approach's
  near-zero terminal radial velocity over the first 0.5 s specifically,
  while the 2 s entry-blend continues to govern position-derivation
  smoothness. Pro: composes with the existing entry-blend. Con: two
  overlapping ramps make the orbit's first 2 s slightly more complex to
  reason about — document inline.

**Candidate B fallback (per-seam, only if A produces artifacts).** Add
a 0.3–0.5 s "settle" micro-phase between each seam's two phases. More
invasive (new phase enum values, new state-machine branches); retained
as fallback only.

**Candidate C fallback (Seam 3 only).** Extend approach close-in ease
to deposit the ship at the approach endpoint with the exact tangential
velocity ORBIT frame 1 expects. Originally in the 2026-04-22 brief;
Director leaned against because it couples approach and orbit state
and may produce its own cinematography artifacts. Retained as fallback
only for Seam 3.

**Director lean (inherited from 2026-04-22 Seam 3 audit, pending re-
audit for the expanded scope):** unified Candidate A is the surgical
pick across all three seams. Candidate B per-seam if A produces
artifacts at any seam.

## Acceptance criteria

Phase-sourced per `docs/PERSONAS/pm.md` §"Per-phase AC rule." The three
seam-specific AC clusters (#1, #2, #3) quote `docs/FEATURES/autopilot.md`
§"Per-phase criterion — ship axis (V1)" phasing verbatim — or flag the
criterion as needing feature-doc authoring if it's not currently written
there at the verbatim level Director audit requires. The invariant ACs
(#4, #5, #6, #7) are contract-shaped.

### AC #1 — Seam 1 (STATION → CRUISE / departure) velocity continuity

Per `docs/FEATURES/autopilot.md` §"Per-phase criterion — ship axis (V1)
— CRUISE" (the CRUISE entry continuity criterion; if feature doc does
not quote it, Director audit flags for amendment). Verified by:

- **#1a — Position continuity (regression guard).** `_position` value
  at the last frame of ORBIT pull-out ≤ 0.001 scene-unit distance from
  `_position` value at the first frame of CRUISE Hermite. Already true;
  this AC is a regression guard that the fix doesn't introduce a
  position discontinuity.
- **#1b — Velocity-magnitude continuity at seam.** `||v(frame N)|| −
  ||v(frame N-1)||` at the ORBIT-pullout-last-frame / CRUISE-Hermite-
  first-frame boundary ≤ 2× the adjacent-frame magnitude deltas in the
  5 frames before and after the boundary. (Band, not absolute — because
  the blend ramp itself produces a mild magnitude change within the
  0.5 s window; the AC guards against the abrupt hand-off step.)
- **#1c — Velocity-direction continuity at seam.** Angle between
  `v(frame N)` and `v(frame N-1)` at the ORBIT-pullout-last /
  CRUISE-Hermite-first boundary ≤ 15° (tunable; starting value — the
  pre-fix angle is > 45° at this seam per Director's diagnosis of the
  pull-out's radial-outward component vs. the Hermite's flat-tangent
  start).
- **#1d — Visible smoothness in canvas recording at departure.** In
  Max's canvas recording (AC #4), the STATION → CRUISE transition reads
  as continuous motion — no perceived hitch at the moment the ship
  leaves orbit.

### AC #2 — Seam 2 (TRAVEL → APPROACH) velocity continuity

Per `docs/FEATURES/autopilot.md` §"Per-phase criterion — ship axis (V1)
— APPROACH" (APPROACH entry continuity criterion; flag if absent).
Verified by:

- **#2a — Position continuity (regression guard).** `_position` at
  Hermite's last sample ≤ 0.001 scene-unit from `_position` at
  approach's first update. Already true; regression guard.
- **#2b — Velocity-magnitude continuity at seam.** Same band shape as
  #1b, computed at the TRAVEL-last / APPROACH-first boundary.
- **#2c — Velocity-direction continuity at seam.** Angle ≤ 15° (same
  starting tolerance as #1c) at the TRAVEL-last / APPROACH-first
  boundary. Pre-fix angle is the angle between Hermite's terminal
  tangent direction and `_approachInitialDir` — not always > 45° (on a
  well-aligned approach the Hermite curves the travel tangent toward
  the radial-in direction), but variable across legs.
- **#2d — Visible smoothness in canvas recording at arrival-entry.** In
  Max's canvas recording, the CRUISE → APPROACH transition reads as
  continuous — no perceived hitch at the moment the ship stops
  traveling and starts closing in.

### AC #3 — Seam 3 (APPROACH → ORBIT) velocity continuity

Per `docs/FEATURES/autopilot.md` §"Per-phase criterion — ship axis (V1)
— STATION" (STATION entry continuity criterion; flag if absent). This
is the AC cluster inherited from the 2026-04-22 single-seam brief;
re-ACed in the seam-specific shape for symmetry with #1 and #2.
Verified by:

- **#3a — Position continuity (regression guard).** `_position` at
  APPROACH's last frame ≤ 0.001 scene-unit from `_position` at ORBIT's
  first frame. Already true.
- **#3b — Velocity-magnitude continuity at seam.** Same band shape.
  Note: pre-fix magnitude jump is small at this seam (approach's
  terminal velocity asymptotes to near-zero; orbit's frame-1 tangential
  velocity is non-zero) — the magnitude step is the observable.
- **#3c — Velocity-direction continuity at seam.** Angle ≤ 15°. Pre-fix
  angle is approximately 90° here (radial-near-zero → tangential) —
  the most pathological of the three seams in direction flip, partially
  masked because both magnitudes are near-zero at the instant.
- **#3d — Visible smoothness in canvas recording at orbit-settle.** In
  Max's canvas recording, the APPROACH → ORBIT transition reads as
  continuous — no perceived hitch as the ship settles into orbit.

### AC #4 — Motion-evidence recording

Per `docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas features
(default)" + `feedback_motion-evidence-for-motion-features.md`:

- Full autopilot tour at Sol captured via
  `~/.claude/helpers/canvas-recorder.js`, 45–90 s covering at least:
  warp-exit → ENTRY → CRUISE → APPROACH (star) → STATION (star) →
  **STATION → CRUISE departure** (for AC #1d) → CRUISE → **CRUISE →
  APPROACH** (for AC #2d) → APPROACH (Earth) → **APPROACH → STATION**
  (for AC #3d).
- Drop path:
  `screenshots/max-recordings/autopilot-phase-transition-velocity-continuity-2026-04-23.webm`.
- ACs #1d / #2d / #3d evaluated against this recording. ACs #1a–c /
  #2a–c / #3a–c evaluated against telemetry.

### AC #5 — Shake-mechanism no-regression

Per round-10/11 shake-redesign workstream ACs #16–20 (Shipped
`1bb5eb2`). Verified by:

- The four shake audits (`window._autopilot.telemetry.audit.orbitCrossProduct`,
  `signalCoincidence`, `envelopeFitsPhase`, `perLegFireBudget`) all
  return `passed: true` on a fresh Sol tour capture under the fixed
  code.
- Subtle shake remains visible at abrupt transitions (where the round-10
  rotation-only shake fires) and absent during smooth motion.

### AC #6 — WS 3 camera-axis no-regression

Per WS 3 (`autopilot-camera-axis-retirement-2026-04-23.md`, Shipped
`b7699de`) ACs #4, #5, #6. Verified by:

- The `runAllCameraAxis(samples)` helper (once the
  `autopilot-telemetry-coverage-2026-04-23` workstream ships; if it
  hasn't yet, use the subset of audits available — #4 at minimum) returns
  `passed: true` on a fresh Sol tour capture under the fixed code.
- Linger on receding body still engages at STATION → CRUISE (AC #5).
- Pan-ahead bias still engages during CRUISE (AC #6).
- Independent pacing between ship phase and camera framing still holds
  (AC #4).

### AC #7 — Telemetry-invariant AC (velocity-vector field extension)

`_captureTelemetrySample()` in `src/main.js` is extended with a
`shipVelocity` (or equivalent-name) Vector3 snapshot field, sampled as
`(position_this_frame - position_prev_frame) / deltaTime`. Verified by:

- The sample buffer carries `shipVelocity` on every sample post-extension.
- Existing shake + camera-axis audits do not read this field and
  continue to pass (back-compat).
- A new audit helper (`velocityContinuityAtSeams(samples)`, proposed
  here; Director audit to confirm whether it lands in THIS workstream
  or coordinates with `autopilot-telemetry-coverage-2026-04-23`)
  implements the AC #1b/c, #2b/c, #3b/c checks programmatically:
  detects phase-transition frames, measures velocity-magnitude and
  angle deltas across each, reports `{ passed, seam1: {…}, seam2: {…},
  seam3: {…}, totalTransitions }`.

**Scope note on AC #7.** The 2026-04-22 single-seam brief did not
specify telemetry-programmatic verification for its single seam (Max
was expected to eyeball the recording). The expanded scope's three-
seam coverage argues for programmatic verification because (a) the
three seams are structurally similar — one audit covers all three,
(b) future nav-layer changes (a Seam 4 for ENTRY → CRUISE if the
ENTRY phase gets independent velocity dynamics; any phase-count
expansion) should inherit the regression gate without re-authoring.
Director audit decides whether AC #7's audit lands in this workstream
or as a scoped addition to the telemetry-coverage workstream; the
velocity-vector field extension to `_captureTelemetrySample` lands
**here** in either case (it's load-bearing for this workstream's own
verification).

### AC #8 — Commits separable by concern

At minimum three (one per seam) plus optional helper commit and
optional telemetry commit. Model:

1. `feat(autopilot): velocity-blend helper + Seam 3 APPROACH → ORBIT
   continuity` (helper + first seam to land; verifies helper contract).
2. `feat(autopilot): Seam 2 TRAVEL → APPROACH continuity`.
3. `feat(autopilot): Seam 1 STATION → CRUISE continuity` (the
   cross-module seam — touches both `NavigationSubsystem.js` and
   `main.js` at line 5934).
4. (optional) `feat(autopilot): shipVelocity sample-shape extension +
   velocityContinuityAtSeams audit`.

Each commit names the AC(s) it closes. No omnibus "phase-transition
continuity done" commit.

## Principles that apply

Recap from §"How it fits" with per-seam load-bearing emphasis:

- **Principle 6 — First Principles Over Patches.** Load-bearing at all
  three seams. A per-seam patch (retuning an easing curve or a phase
  boundary condition) ships V1 for that seam and compounds foreclosure
  against future nav-phase changes. The first-principles move — phases
  deposit terminal state, successors initialize from it — is what
  future-proofs.

- **Principle 2 — No Tack-On Systems.** Load-bearing because the
  velocity-blend helper must be one shared utility, not three per-seam
  copies. Tack-on violation: three bespoke fixes with similar-but-
  diverging code in the three phase-starter methods.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Load-bearing at Seam 1 specifically because the fix
  touches the cross-module boundary (`main.js` line 5934). The fix's
  terminal-velocity capture must live inside `NavigationSubsystem` —
  `main.js` passes `fromPosition` and (new) implicit references; it
  does not compute or supply velocity from its side.

## Drift risks

- **Risk: Per-seam patches that don't generalize.** Under implementation
  pressure, the temptation is to fix Seam 3 with Candidate A (proven in
  the 2026-04-22 brief), Seam 2 with a bespoke radial-projection tweak,
  and Seam 1 with a different tangent-magnitude smoothing. Each fix
  works; the helper never gets authored; the code diverges.
  **Why it happens:** three seams with three different pre-fix
  directional discrepancies naturally invite three different per-seam
  solutions. The unified pattern is less obviously-optimal per-seam.
  **Guard:** AC #8 requires the helper commit precede or land with the
  first seam's fix. If working-Claude starts the work and no helper
  appears in the first commit, escalate to Director. The helper is the
  deliverable; the three seams are its three consumers.

- **Risk: Velocity-blend window tuning masks a deeper bug.** Tuning the
  blend window per-seam (0.3 s / 0.5 s / 0.5 s starting values) is
  legitimate — the seams have different pre-fix discrepancy magnitudes
  and different authored intrinsic velocities. But the window is a
  cosmetic smoothing tool: if a seam still shows a visible hitch after
  the blend window is tuned reasonable, the hitch is a different bug
  (wrong capture basis, wrong intrinsic-velocity authority, etc.). The
  drift is to keep widening the blend window past ~0.8 s to force
  smoothness; the fix becomes a low-pass filter rather than a hand-off.
  **Why it happens:** a blend window that "almost works" is one slider-
  pull away from looking fine, and the slider is right there.
  **Guard:** if any seam's blend window pushes past 0.6 s and AC #1d
  / #2d / #3d still don't pass, stop and escalate to Director. The
  mechanism is wrong, not the window.

- **Risk: Seam 1 (STATION → CRUISE) cross-module boundary gets fixed
  incorrectly in `main.js` instead of `NavigationSubsystem.js`.** The
  natural instinct at Seam 1 is "the bug is that `main.js` line 5934
  passes `camera.position.clone()` as `fromPosition` without passing a
  velocity; fix by passing the velocity." That move works mechanically
  but violates Principle 5 (producer-consumer flow) — the consumer
  (`main.js`) is now informing the producer (`NavigationSubsystem`) of
  its own terminal state.
  **Why it happens:** `main.js` is where the `orbitComplete` detection
  and `beginMotion` call live; "add a param to `beginMotion`" is a
  visible one-line fix.
  **Guard:** the terminal-velocity capture lives inside
  `NavigationSubsystem` (a `_terminalVelocity: Vector3` field written
  at orbit-end, read at `_beginTravel`'s entry). `main.js`'s call to
  `beginMotion` does NOT gain a velocity parameter. If the fix's diff
  to `main.js` is larger than zero lines (other than the helper
  import if one is needed), escalate to Director.

- **Risk: The fix regresses the shake mechanism.** The shake fires on
  abrupt velocity transitions (round-10 trigger: `|d|v|/dt|` at phase
  transitions). A perfectly-smooth velocity hand-off would silence the
  shake at phase transitions entirely — which is not the fix; the shake
  is the ship-body response to being commanded into a new velocity
  direction, and some of that command remains after the direction flip
  is reconciled. The blend window is 0.3–0.5 s; the shake's trigger
  window is ~0.1–0.2 s. The shake should continue to fire at the
  beginning of the blend window (on the magnitude/direction command
  change that exists, just-softened), then ease off as the blend
  completes.
  **Why it might regress:** over-softening the hand-off (too long blend
  window; too gentle easing curve) can suppress the shake trigger
  entirely.
  **Guard:** AC #5 runs the four shake audits post-fix. If any fail,
  the fix is regressing shake — narrow the blend window or steepen
  the easing curve until shake re-engages at transitions.

- **Risk: The fix regresses WS 3 camera-axis (ESTABLISHING linger /
  pan-ahead).** ESTABLISHING's linger engages at STATION → CRUISE on
  detection of `previousStationBodyPos` (WS 3 round-2 patch). The
  transition is detected on ship-phase edge (`shipPhase` changes from
  STATION to CRUISE). This workstream's fix changes velocity dynamics
  at the transition, not phase-edge timing, so the detection should
  remain intact — but the camera observing the ship during the blend
  window might frame differently if `navBodyPos` or similar camera-
  input fields are affected.
  **Why it might regress:** the camera-mode update reads from the same
  motion frame the nav subsystem produces; velocity-basis changes can
  (rarely) cascade into `lookAtTarget` composition.
  **Guard:** AC #6 runs the WS 3 camera-axis audits (once available).
  If any fail, diagnose whether the cascade is through motion-frame
  composition or through the camera's own blend (WS 3 round-2's 0.4 s
  transition smoothstep) interacting with this workstream's 0.3–0.5 s
  velocity blend.

- **Risk: Telemetry sample-shape extension (AC #7) bloats the buffer
  or breaks shake/camera audits.** Adding `shipVelocity` = one Vector3
  = 3 floats × 8 bytes × 3600 samples = ~87 KB extra. Tolerable. The
  shake audits and camera-axis audits should not read this field; if
  any do incidentally (e.g., via `Object.keys(sample).length` or
  spread-copy), they may break.
  **Why it might happen:** audit helpers occasionally iterate all keys
  for diagnostic dumps.
  **Guard:** after extending `_captureTelemetrySample`, re-run the
  existing shake `runAll` and (if available) `runAllCameraAxis` on a
  fresh capture; confirm back-compat pass.

- **Risk: Feature-doc `§"Per-phase criterion — ship axis (V1)"` does
  not actually quote the continuity criteria this workstream's ACs
  #1/#2/#3 cite verbatim.** PM's AC #1/#2/#3 are authored assuming
  feature-doc §"Per-phase criterion — ship axis (V1)" contains
  entry/exit continuity criteria for each phase. If it doesn't — if
  the feature doc only states phase-end behaviors (e.g., "STATION: ship
  holds orbit at safe distance") without "CRUISE: entry velocity reads
  as continuous with the prior phase's terminal velocity" — then the
  ACs are inventing criteria.
  **Why it happens:** feature doc was authored 2026-04-20 before the
  seam bugs were surfaced 2026-04-23; the continuity criteria may be
  implicit (as "smooth" in §"V1 — must ship") but not quoted.
  **Guard:** Director audit of the expanded scope checks feature-doc
  coverage. If the criteria aren't verbatim there, Director either (a)
  authors the feature-doc amendment before this workstream's execution
  begins, or (b) rules that the implicit §"V1 — must ship" "smooth"
  criterion is sufficient grounding and this brief's ACs stand on it.
  Per PM convention, this brief flags the gap; Director authors the
  feature-doc change.

## In scope

- **New velocity-blend helper** in `src/auto/` (e.g.,
  `src/auto/VelocityBlend.js` or sibling file; working-Claude picks the
  name). Signature per the §"Candidate unified fix pattern." One shared
  utility consumed by all three seams.

- **Seam 3 (APPROACH → ORBIT) fix** in `NavigationSubsystem.js` around
  `_updateApproach` (line 651+), `_beginOrbit` (line 454+), and
  `_updateOrbit` (line 586+). Velocity blend integrated with the
  existing 2 s `entryFactor` ramp per §"Candidate unified fix pattern."

- **Seam 2 (TRAVEL → APPROACH) fix** in `NavigationSubsystem.js` around
  `_updateTravel` (line 678+, specifically the `t >= 1` branch at line
  813), `_beginApproach` (line 428+), and `_updateApproach` (line 651+).
  Terminal-velocity capture at travel's last frame; approach's radial
  velocity blends from captured projection.

- **Seam 1 (STATION → CRUISE) fix** in `NavigationSubsystem.js` around
  `_updateOrbit` (line 586+, specifically the `orbitComplete` branch
  at line 627+) and `_beginTravel` (line 336+). Terminal-velocity
  capture at orbit-end (after the pull-out); Hermite's initial tangent
  magnitude + direction blend from captured value. `main.js` line 5934
  remains unchanged in signature per Principle 5 guard.

- **Telemetry sample-shape extension** in `src/main.js`
  `_captureTelemetrySample()` — add `shipVelocity` Vector3 snapshot.
  Same `.toFixed(4)` precision pattern as existing vec3 fields.

- **Optional** (Director audit to confirm placement):
  `velocityContinuityAtSeams(samples)` audit helper under
  `window._autopilot.telemetry.audit.*` per AC #7. Either here or in
  `autopilot-telemetry-coverage-2026-04-23`'s scope.

- **Canvas recording per AC #4.** Sol tour capture at
  `screenshots/max-recordings/autopilot-phase-transition-velocity-continuity-2026-04-23.webm`.

- **Commits per AC #8** — helper+Seam3 / Seam2 / Seam1 / optional
  telemetry. Each naming ACs closed.

- **Feature-doc `## Workstreams` section** updated to list this brief
  under "Child workstream briefs." Per `docs/PERSONAS/pm.md` §"PM-
  specific paths."

- **Predecessor brief redirect stub** at
  `docs/WORKSTREAMS/autopilot-approach-orbit-continuity-2026-04-22.md`
  authored as part of this expansion (see §"Renaming" below).

## Out of scope

- **Any changes to cruise behavior, approach close-in behavior, or
  orbit settled behavior outside the entry-blend window.** The blend
  windows (0.3 s / 0.5 s / 0.5 s) are scoped; behavior outside them is
  not this workstream's concern.
- **Any changes to camera-axis behavior** (WS 3 / ESTABLISHING mode /
  `CameraChoreographer`). AC #6 is a no-regression check only.
- **Any changes to the shake mechanism** (`ShipChoreographer` / shake
  envelope / `_firedThisLeg`). AC #5 is a no-regression check only.
- **Any new mechanism beyond velocity-blend at seam boundaries.** New
  phase enum values (Candidate B fallback settle sub-phases) are held
  as fallbacks only, not in scope unless the unified pattern fails at
  a seam.
- **Warp-exit → ENTRY transition.** ENTRY phase does not today carry
  independent velocity dynamics; warp-exit deposits the ship into
  ENTRY at a known state. If future work adds independent ENTRY
  dynamics, a Seam 0 becomes applicable; not this workstream.
- **The camera-transition 0.4 s smoothstep blend (WS 3 round-2
  `TRANSITION_BLEND_DURATION = 0.4s`).** Separate system, separate
  workstream; interaction noted in drift-risk but not rescoped here.
- **The OOI workstream, WS 4 toggle UI, telemetry-coverage workstream's
  own scope.** Adjacent, not this workstream's concern.
- **`docs/FEATURES/autopilot.md` authoring of entry/exit continuity
  criteria** if Director audit finds them absent. PM flags; Director
  authors (feature-doc is Director-owned per Dev Collab OS triggers).
  This workstream waits for that authoring if Director rules it
  load-bearing.

## Renaming

This brief supersedes
`docs/WORKSTREAMS/autopilot-approach-orbit-continuity-2026-04-22.md`.
The 2026-04-22 brief was authored in degraded PM-proxy mode after a PM
agent stream timeout (2026-04-22 session) and covered a single seam
(Seam 3 only). Expansion to three seams was greenlit by Max 2026-04-23
after Director's diagnosis that the observed departure + arrival jerks
Max reported during WS 3 review were the same class of bug at two
additional seams (Seam 1 and Seam 2).

**The old path receives a redirect stub** pointing here, so pending
references (e.g., WS 3 brief `## Out of scope` citing it, memory files
referencing the old filename) resolve correctly. The stub's contents:
title, status (`Superseded — see <new path>`), one-sentence reason,
revision history pointer, link.

**Why new filename, not in-place edit:** the old filename's slug
(`approach-orbit-continuity`) describes a specific seam; the new
filename's slug (`phase-transition-velocity-continuity`) describes the
unified class. Readers navigating `docs/WORKSTREAMS/` by filename see
the correct scope in the listing. The redirect stub covers link
continuity.

## Handoff to working-Claude

**Precondition: Director audit of the expanded scope.** Status is
`HELD — pending Director audit` until Director re-audits the three-seam
coverage + unified fix pattern + AC #7 placement (this workstream vs.
`autopilot-telemetry-coverage-2026-04-23`). Director audit closes at
`Drafted — pending execution` or (if audit calls for brief edits)
`HELD — pending PM amendment`. Working-Claude does NOT pick up the work
from this status; wait for Director's audit + release.

When release lands, read this brief first, then:

1. **`docs/WORKSTREAMS/autopilot-camera-axis-retirement-2026-04-23.md`**
   — especially `## Status` (the Shipped baseline's three-seam
   diagnosis attribution at the end, and the residual-finding note).
2. **`docs/WORKSTREAMS/autopilot-shake-redesign-2026-04-21.md`** — the
   round-10/11 rotation-only shake mechanism. AC #5 is against this.
3. **`docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`** — WS
   2 Shipped baseline. The phase state machine this workstream's fixes
   hand off within.
4. **`docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md`**
   — WS 1 Shipped `3d53825`. The nav subsystem's public contract.
5. **`src/auto/NavigationSubsystem.js`** in full — especially lines
   336+ (`_beginTravel`), 428+ (`_beginApproach`), 454+ (`_beginOrbit`),
   586+ (`_updateOrbit`), 651+ (`_updateApproach`), 678+ (`_updateTravel`
   incl. `t >= 1` branch at 813).
6. **`src/main.js`** line 5927–5940 (`orbitComplete` → `beginMotion`
   bridge, Seam 1's cross-module boundary).
7. **`src/main.js`** line 625–683 (`_captureTelemetrySample` — where
   the `shipVelocity` field extension lands).
8. **`docs/PERSONAS/pm.md` §"Per-phase AC rule"** — the AC shape this
   brief's #1/#2/#3 follow.
9. **`docs/MAX_RECORDING_PROTOCOL.md`** — for AC #4 capture.

Then, in order of execution:

1. **Author the velocity-blend helper.** Name it; surface its signature
   in chat; sanity-check against Principle 2 (one shared utility) and
   Principle 5 (lives in `src/auto/`, not in `main.js`) before
   implementing.
2. **Extend `_captureTelemetrySample` with `shipVelocity`** (AC #7's
   field extension). Verify back-compat: fresh Sol tour capture under
   the extension; shake `runAll` and (if available)
   `runAllCameraAxis` pass.
3. **Implement Seam 3 (APPROACH → ORBIT) fix first.** This is the
   seam the 2026-04-22 brief analyzed deepest; Candidate A integrates
   with the existing 2 s `entryFactor` ramp. Verify AC #3 passes
   (telemetry + recording-beat).
4. **Implement Seam 2 (TRAVEL → APPROACH) fix.** Verify AC #2 passes;
   confirm no regression to AC #3 (fix doesn't rely on Seam 3 state
   that changed).
5. **Implement Seam 1 (STATION → CRUISE) fix.** The cross-module
   seam; hardest to get right because of the Principle 5 guard. The
   fix lives inside `NavigationSubsystem`; `main.js` line 5934 is
   unchanged in signature. Verify AC #1 passes; confirm no regression
   to ACs #2 and #3.
6. **Run shake audit + camera-axis audit** (AC #5, AC #6). Both
   `passed: true`.
7. **Capture AC #4 recording** — Sol tour covering all three
   seam-transitions in one take.
8. **(Optional, Director audit decision)** — implement
   `velocityContinuityAtSeams(samples)` audit helper per AC #7.
9. **Commit per AC #8** — helper+Seam3 / Seam2 / Seam1 / optional
   telemetry. Stage only specific touched files. Never `git add -A`.
10. **Close at `VERIFIED_PENDING_MAX <sha>`.** Max evaluates against
    the recording + telemetry-assertion report. On pass → `Shipped
    <sha> — verified against <recording-path>`; on fail → diagnose per
    the failure class (visible hitch persists at seam X → widen blend
    window there; shake regressed → narrow blend window; WS 3
    regressed → check motion-frame composition cascade).

**If the diff to `main.js` grows beyond the `_captureTelemetrySample`
extension at line 625–683, stop.** Per drift-risk #3, Seam 1's fix
lives inside `NavigationSubsystem`; `main.js`'s call to `beginMotion`
at line 5934 is unchanged in signature.

**If any seam's blend window pushes past 0.6 s and the visible-
smoothness AC still fails, stop.** Per drift-risk #2, the mechanism
is wrong, not the window. Escalate to Director.

**If the shake audits or camera-axis audits regress on the fixed
code, stop.** ACs #5 / #6 are load-bearing; a continuity fix that
breaks shake or WS 3 is a Principle 6 violation against just-shipped
features.

**If you find yourself wanting to add a "settle" micro-phase at any
seam, stop and escalate to Director.** Candidate B is held as
fallback only; opening it requires Director ruling that the unified
pattern's Candidate A doesn't work at that seam.

Artifacts expected at close: 3–4 commits (helper + three seams +
optional telemetry); one canvas recording at the path in AC #4;
this brief at Shipped; feature doc's `## Workstreams` section
updated; any followups spawned (per-phase tuning, per-body arrival
variants) recorded as new entries.

## Revision history

- **2026-04-22 — Drafted (predecessor)** at
  `autopilot-approach-orbit-continuity-2026-04-22.md` by working-Claude
  in degraded PM-proxy mode (PM agent stream timeout). Single-seam
  scope (APPROACH → ORBIT only). Status `Drafted — pending Director
  audit`.
- **2026-04-23 — Expanded and renamed** to
  `autopilot-phase-transition-velocity-continuity-2026-04-23.md`.
  Scope broadened from one seam to three (STATION → CRUISE,
  TRAVEL → APPROACH, APPROACH → ORBIT) after Director's diagnosis
  during WS 3 camera-axis retirement Shipped review (`b7699de`): the
  residual departure + arrival jerks Max reported are pre-existing
  nav-layer velocity-direction flips at three seams, one class of
  bug. Director's verbatim diagnosis carried into §Scope statement.
  Max greenlit the expansion. Redirect stub authored at the old
  path. Status flipped from `Drafted` (predecessor) to `HELD —
  pending Director audit of expanded scope`. Authored by PM
  2026-04-23.
