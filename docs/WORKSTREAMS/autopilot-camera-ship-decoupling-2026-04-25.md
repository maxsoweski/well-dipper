# Workstream: Autopilot camera/ship axis decoupling — V1 redesign (2026-04-25)

## Status

**`Active — amended 2026-04-25 (lhokon phase)`** — see §"Amendments —
2026-04-25 (lhokon phase introduction)" below for the amendment shape
and rationale. The V1 §A4 redesign authored under Director audit
`autopilot-station-hold-redesign-2026-04-24` §A4 stands; this amendment
inserts a new named phase, **`lhokon`**, between `STATION-A` and
`CRUISE` to host the camera convergence that the prior implementation
attempted to author *during* CRUISE (and that Tester verdict §T1 at
HEAD `8f6623d` rejected as a structural conflict with AC #5a's
"every CRUISE frame, all phases" bound).

Original status framing follows.

**`Active — pre-execution gate` (authored 2026-04-25 by PM under
Director audit `autopilot-station-hold-redesign-2026-04-24` §A4 at
`~/.claude/state/dev-collab/audits/autopilot-station-hold-redesign-
2026-04-24.md`).**

This is a new V1 attempt under the §A4 redesign, not a tune of the
prior workstream's Attempt 1. The prior workstream
(`docs/WORKSTREAMS/autopilot-station-hold-redesign-2026-04-24.md`)
is closed — the recording captured at its V1 Attempt 1 close passes
its V1-Attempt-1 ACs as written, but the V1 spec itself proved wrong
(aim-once-at-intercept produces body-drift during cruise; the ship-
forward camera read composed with that drift produces visible body
mis-framing). The §A4 audit reverses both halves of the coupling:
camera reads target-body position directly; ship re-aims at predicted
intercept each frame. The two axes are now genuinely independent —
*more* independent than under the 2026-04-24 reframe, where camera-
axis silently read ship-axis state.

**Cycle budget — Director-confirmed §A4.** 1 Attempt, 1 capture,
1 audit at first `VERIFIED_PENDING_MAX <sha>`. Parameter-tune budget
is held for the predicted-intercept solver edge cases (discriminant
< 0 fallback behavior, smaller-positive-root selection under FP
noise) and the AC #5b angular-error tolerance (`≤ 0.1°` is tight
under FP precision; relax to `≤ 0.5°` if noise warrants — PM tunes,
not Director-escalation-class).

**Pre-execution gate — what working-Claude is released to before
Director audit of this brief:**

- Read this brief, the parent feature doc at HEAD `9a37bec`, and
  the §A4 audit appendix.
- First-pass code read at the four named surfaces below
  (`AutopilotMotion.js` `_tickCruise`, `CameraChoreographer.js`
  ESTABLISHING dispatch, `src/main.js` burn-button visibility +
  `_selectedTarget` integration site, body-velocity-exposure code-
  read).
- Specifically: the body-velocity-exposure code read is its own
  deliverable — surface to PM whether `velocity_at(t)` is cleanly
  derivable from the orbital model or whether finite-differencing
  position frames is the V1 path. This is the most likely surface
  to need PM/Director eyes if it turns out non-trivial; surface
  *before* substantive edits.

Working-Claude is **NOT** released to `Edit`/`Write` on production
code paths until Director audits this brief. Audit happens next; PM
flags Director when this brief lands.

## Amendments — 2026-04-25 (lhokon phase introduction)

### Why this amendment

The §A4 redesign shipped with **AC #5a verbatim:** *"Camera tracks
autopilot target body. Every frame, `camera.lookAt(target.current_
position)`. This applies across the full leg — ENTRY, CRUISE, and
APPROACH — and persists into STATION-A where the held pose is
naturally body-centered. Shake stays additive on top of the body-
tracking lookAt."* The bound: *"`dot(cameraForwardPreShake,
expectedForward) ≥ 0.9999` every frame, all phases (ENTRY, CRUISE,
APPROACH, STATION-A)."*

Drift Risk #5 was authored explicitly to catch any swap-window
smoothing: *"V-later camera authoring smuggled into V1... if the
camera linger on a receding subject (target_n−1) for any frame after
the leg to target_n has begun, dot(cameraForwardPreShake,
expectedForward) fails for those frames. **The V-later moves are
caught by construction.**"*

Working-Claude implemented per-CRUISE-frame `lookAt(target)` plus a
1.5s direction-nlerp on leg-swap to avoid a "tiny-body direction-
whip" snap (commits `dc26cbd` + `70c4b09` + `8f6623d`). Tester verdict
§T1 at HEAD `8f6623d`
(`~/.claude/state/dev-collab/tester-audits/autopilot-camera-ship-
decoupling-2026-04-25.md` §T1) **FAILed AC #5a:** 685/13362 (5.13%)
CRUISE samples below the dot-0.9999 bound, all clustered at leg-swap
windows, per-leg stabilization 658–1120 ms — matching the 1.5 s
nlerp duration exactly. Live capture artifact at
`recordings/autopilot-camera-ship-decoupling-v1-attempt1-telemetry.json`
(16,952 samples).

The smoothing is fine; the **placement** of the smoothing is what
violated the brief. CRUISE under §A4 is the body-tracking leg by
construction — it must satisfy `lookAt(target.current_position)`
every frame. A smoothing window inside CRUISE conflicts structurally,
not numerically (i.e., loosening the bound to "every frame except
within 1.5 s of swap" would re-import V-later linger authoring into
V1 by amendment, which is what Drift Risk #5 was authored to forbid).

### What the amendment does

The amendment **moves the smoothing out of CRUISE and into a new
named phase, `lhokon`**, between `STATION-A` and `CRUISE`. Spelled
"lhokon" — Max's chosen name; preserve verbatim, do not normalize
casing, do not substitute. The lhokon phase is the **camera
convergence beat**: ship is stationary at the STATION-A position;
camera rotates from old-target-direction to new-target-direction;
when the camera is centered on the new target, CRUISE begins.

Phase order under this amendment:

| # | Phase | Ship | Camera |
|---|-------|------|--------|
| 1 | `STATION-A` | At rest near old body. | `lookAt(old_target.current_position)`. |
| 2 | **`lhokon`** *(new)* | **Stationary at STATION-A position. Velocity = 0.** | **Rotating from old-target-direction toward new-target-direction.** |
| 3 | `CRUISE` | Burning toward new target (predicted-intercept solver, per §A4). | `lookAt(new_target.current_position)` every frame. |
| 4 | `APPROACH` | (Unchanged.) | `lookAt(target.current_position)` every frame. |
| 5 | `STATION-A` *(arrival)* | (Unchanged.) | (Unchanged.) |

Because the ship is **stationary throughout `lhokon`** by spec, the
prior Drift Risk #5 failure shape ("linger on a receding subject")
becomes **structurally impossible**: there is no "receding subject"
during lhokon — the ship is not yet moving toward the new target,
and the old subject is not receding. The camera is mid-rotation by
*design*; the new target is not yet on-axis by *design*. AC #5a's
"every CRUISE frame, body-tracking" bound becomes enforceable on
CRUISE specifically, where it remains the load-bearing contract.

### CRUISE-entry gate (criterion choice)

CRUISE begins only after lhokon completes. Three options were
considered:

- **(a) Pure dot-gate** — `dot(camera_forward_preshake,
  normalize(new_target.current_position − camera.position)) ≥ 0.9999`.
  Semantic match to AC #5a's bound. Failure mode: lhokon hangs if
  FP noise asymptotes near dot 1.0, or if the rotation axis becomes
  degenerate (prev and new directions nearly antiparallel). Silent
  player-visible bug; no recovery.
- **(b) Fixed duration** — exit lhokon after `_turnDurationSec`
  (1.5 s) regardless of dot. Predictable, simple. Failure mode: if
  the body's orbital motion shifts the new-target-direction during
  the turn, lhokon ends with the camera ~degrees off; CRUISE then
  begins off-center and AC #5a's first-CRUISE-frame measurement
  flags it.
- **(c) (a) OR (b)-as-timeout** — dot-gate normally; fixed-duration
  timeout as a hang-prevention fallback. Empirically, working-
  Claude's telemetry showed stabilization at 658–1120 ms on legs
  1–3 (well under 1.5 s), so (a) carries lhokon's exit on every
  realistic case; (b) is the safety net.

**PM choice: (c) — dot-gate primary, fixed-duration timeout
fallback.** Rationale: the failure mode for (a) alone is silent
hang; the failure mode for (b) alone is caught immediately by AC
#5a's first-CRUISE-frame measurement. (c) has neither failure mode
at the cost of one branch. Telemetry pattern is mirrored on the
solver's discriminant-fallback (§A4): the timeout is reported in
the telemetry log as a flag for feature-doc review, not an
auto-failure of any AC.

**Tunable values:**

- `lhokon_dot_threshold = 0.9999` (matches AC #5a's bound; the
  semantic equivalence is intentional — lhokon's exit criterion *is*
  AC #5a's entry criterion for CRUISE).
- `lhokon_timeout_sec = 1.5` (matches the existing
  `_turnDurationSec`; preserves the smoothing duration the
  implementation already established).
- Under FP precision, `0.9999` may prove tight at very small
  rotation axes; PM-tunable to `0.99996` (`≤ 0.5°`) symmetric with
  AC #5b's tolerance pathway. **Tunable, not Director-escalation-
  class.**

### Quoted prior-brief surfaces being amended

For audit-trail integrity, the surfaces this amendment touches:

1. **`## Acceptance criteria` §"AC #5a"** — phrase **"every frame,
   all phases (ENTRY, CRUISE, APPROACH, STATION-A)"** narrows to
   **"every CRUISE frame, every APPROACH frame, every STATION-A
   frame"**; explicit lhokon carve-out added with rationale.
2. **`## Acceptance criteria`** — four new ACs (#11 lhokon-onset, #12
   lhokon-completion, #13 ship-stationary-during-lhokon, #14
   smoothness-preserved) added.
3. **`## Drift risks` §"Risk: V-later camera authoring smuggled into
   V1"** — rewritten. The old framing (catch swap-window smoothing
   by construction via AC #5a) is dissolved by the lhokon design;
   the new framing watches for *the wrong failure mode under the
   new design* (ship moving before lhokon completes; CRUISE entering
   on a stale dot reading; etc.).
4. **`## In scope`** — lhokon phase added; smoothing migration named
   explicitly.
5. **`## Out of scope`** — V-later linger / pan-ahead / departure
   arc carve-out preserved verbatim. The lhokon phase is **not** a
   linger on the receding subject (ship is stationary; old subject
   is not receding); it is a camera-convergence beat on the new
   subject. Distinct shape, distinct semantics.
6. **`## Handoff to working-Claude`** — implementation-order step
   for migrating the existing 1.5 s direction-nlerp from CRUISE-
   entry into the new lhokon phase + adding the CRUISE-entry gate.

### Cross-references

- **Tester verdict §T1** at HEAD `8f6623d`:
  `~/.claude/state/dev-collab/tester-audits/autopilot-camera-ship-
  decoupling-2026-04-25.md`. Quoted: *"AC #5a — Camera tracks body —
  **FAIL**... 685 / 13362 samples below threshold (5.13%)... per-leg
  stabilization 658–1120 ms... This is the `_turnDurationSec = 1.5`
  direction-nlerp at `CameraChoreographer.js:359` executing exactly
  as designed — the smoothing block introduced by commits `70c4b09`
  (direction-based turn smoothing), `dc26cbd` (smooth camera turn
  between targets), and `8f6623d` (seed with prev-frame direction).
  The mechanism is intentional; the brief AC bound forbids it."*
- **Live telemetry artifact:**
  `recordings/autopilot-camera-ship-decoupling-v1-attempt1-telemetry.json`
  (16,952 samples).
- **Commits introducing the smoothing-in-CRUISE shape:**
  `dc26cbd`, `70c4b09`, `8f6623d`. Working-Claude migrates the
  smoothing into the lhokon phase rather than reverting these
  commits wholesale; the underlying nlerp mechanism is reused at the
  new phase site.
- **Feature doc:** A feature-doc amendment introducing `lhokon` as
  a named phase is **deferred** to working-Claude's same-session
  feature-doc update under the 2026-04-25 Dev Collab OS restructure
  (working-Claude owns `docs/FEATURES/*.md` updates same-session
  with implementation). PM flags it here; working-Claude lands the
  feature-doc edit alongside the implementation. The brief's ACs
  carry the phase-sourced text in the interim and are valid against
  the to-be-amended feature doc.

### Deferred decisions (flagged for Max)

- **Feature-doc revision-history wording for the lhokon
  introduction.** PM defers the §"Revision history" entry phrasing
  to working-Claude's same-session feature-doc edit. Suggested
  shape: *"2026-04-25 — `lhokon` phase introduction (§A5
  amendment). Camera convergence beat between STATION-A and CRUISE,
  ship stationary, camera rotates from old-target-direction to
  new-target-direction. CRUISE entry gated on dot ≥ 0.9999 (with
  fixed-duration timeout fallback). Resolves the structural conflict
  Tester verdict §T1 surfaced between in-CRUISE smoothing and AC
  #5a's per-frame body-tracking bound."*
- **AC #5a numerical bound during APPROACH at very small ship-to-
  body distances.** APPROACH terminates at ~0.6 × hold-distance
  geometry where the body's apparent angular size grows rapidly
  per frame. The dot-bound holds in principle (camera tracks body
  current position; geometry doesn't enter the bound), but FP
  precision at sub-0.001u distances may warrant the 0.5° relaxation
  pathway already named in AC #5b. **PM-tunable, not
  amendment-blocking.**

### What stays unchanged

- AC #1 (ship intercepts body within tolerance) — unchanged.
- AC #2 (APPROACH onset at min(10R, cruise-distance ceiling)) —
  unchanged.
- AC #3 (STATION-A felt-fill ~60%) — unchanged.
- AC #4 (STATION-A body-lock invariance) — unchanged.
- AC #5b (ship aims at predicted intercept) — unchanged. CRUISE-
  only bound; lhokon does not gate AC #5b because ship is
  stationary during lhokon (AC #5b applies *during CRUISE*, where
  the ship is burning).
- AC #6 (shake event placement) — unchanged. Shake fires at CRUISE
  onset (= lhokon-completion boundary, structurally) and at
  APPROACH onset.
- AC #7 (ship orientation set by autopilot, read by shake only) —
  unchanged. During lhokon, autopilot still writes `ship.forward`
  each frame (likely to the predicted-intercept direction toward
  the new target, anticipating CRUISE; or to last-written value
  from STATION-A — working-Claude's call as long as the accessor
  surface holds).
- AC #8 (jumpscare-arrival felt experience) — **stays
  `VERIFIED_PENDING_MAX`.** Recording recapture deferred until the
  lhokon implementation lands at a new HEAD. The amended brief is
  the spec the recording will be evaluated against.
- AC #9 (stub scaffolding removal) — unchanged.
- AC #10 (two-axis architecture preserved) — unchanged.

## Parent feature

**`docs/FEATURES/autopilot.md`** — amended 2026-04-25 at HEAD
`9a37bec` (§A4 amendment landing this turn). The load-bearing
sections for this workstream:

- **§"Revision history" 2026-04-25 entry** — names the §A4 structural
  reframe: V1 ship axis = predicted-intercept re-aim each frame; V1
  camera axis = pursuit-curve on autopilot target body (camera does
  NOT read `ship.forward` for lookAt direction). Two-axis architecture
  preserved and *more* independent under §A4.
- **§"Per-phase criteria — ship axis" §CRUISE** — predicted-intercept
  re-aim each frame, closed-form quadratic solver text, graceful
  fallback when discriminant < 0.
- **§"Per-phase criterion — camera axis (V1)" §ESTABLISHING (§A4
  redesign)** — camera tracks autopilot target body's current
  position each frame (`camera.lookAt(target.current_position)`);
  shake additive on top; V-later carve preserved (no linger / no
  pan-ahead / no departure arc / no roving / no zoom).
- **§"Per-phase criterion — camera axis (V1)" §Precondition** — ship
  orientation is still authored; consumer set narrows from
  {camera, shake} to {shake} only. Autopilot writes `ship.forward`
  each frame to the predicted-intercept direction; shake reads it.
- **§"Failure criteria / broken states"** — body-drift during
  cruise/approach failure mode, ship-overshoot/undershoot failure
  mode, ACCEL/DECEL shake placement (unchanged from 2026-04-24).
- **§"Drift risks (Director watch list)" #9** — replaced under §A4:
  camera reads stale target position (the new failure class once
  camera reads target.current_position rather than ship.forward).

The feature doc §A4 amendment is the spec; this workstream's job is
implementation against it. No new feature criteria are authored here.

## Implementation plan

**N/A (feature-amendment is workstream-sized for V1 implementation,
same as the prior workstream).** The amended feature doc §"Per-phase
criteria — ship axis" §CRUISE + §"Per-phase criterion — camera axis
(V1)" §ESTABLISHING + §"Drift risks" #9 are the architectural
specification at HEAD `9a37bec`.

Anticipated edit surfaces (subject to working-Claude's first-pass
code read):

### 1. `src/auto/AutopilotMotion.js` — predicted-intercept solver in `_tickCruise`

Closed-form quadratic per Director §A4:
```
|R + V·t|² = (s·t)²
(V·V − s²)·t² + 2(R·V)·t + R·R = 0
where R = body.position − ship.position
      V = body.velocity
      s = cruiseSpeed (ship's scalar cruise velocity)
```
Pick smaller positive root. Intercept point = `body.position + V·t`;
write `ship.forward = (intercept − ship.position).normalize()` each
frame.

**Edge case — discriminant < 0.** The body is moving away faster
than the ship can close. **Graceful fallback:** re-aim at
`body.current_position` (the aim-at-current-position degenerate case).
Do **not** silently swallow the case; surface a one-time telemetry
log entry per CRUISE phase if the fallback fires, so feature doc
§"Failure criteria" can flag it during recording review (per §A4
verdict: *"Surface this fallback in feature doc §'Failure criteria'
as a flag if it fires under realistic playable conditions."*).

The solver replaces the existing `_tickCruise` aim-once write
(currently `_v2.subVectors(this._target.position, positionAtOnset)
.normalize()` at AutopilotMotion.js L289). The new write happens
per frame, not once at onset.

### 2. `src/auto/CameraChoreographer.js` — ESTABLISHING decouples from `_ship.forward`

Current path (L450, V1 STATION-hold dispatch):
```js
this._currentLookAtTarget.copy(motionFrame.position)
  .addScaledVector(this._ship.forward, 100);
```

New path:
```js
this._currentLookAtTarget.copy(target.current_position);
```

Where `target` is the autopilot's current target body — same body
the AutopilotMotion solver is intercept-aiming at. Working-Claude
locates the cleanest pipe to deliver it (likely a new field on
`motionFrame`, populated by `AutopilotMotion` from its `_target`
reference; or `setShip`'s analog `setTarget` — choose the surface
that doesn't require restructuring the dispatch). The body-tracking
lookAt persists into STATION-A naturally — the held pose is body-
centered already, and `lookAt(target.current_position)` continues to
fire on a stationary body.

**Critical: the camera no longer reads `_ship.forward` for the lookAt
direction.** Drift risk #9 (camera reads stale target position) is
the load-bearing failure class to guard against — see Drift risks
section below for the verification telemetry that catches it.

**`CameraMode` dispatch unchanged.** The ESTABLISHING branch routes
through the dispatch as before; only the inside of the branch
changes. AC #10 holds without further work.

### 3. `src/main.js` — burn-button visibility + reticle wiring

**Burn-button visibility extension (line ~5346, `const burning = …`):**
Extend the `burning` flag to include `autopilotMotion.isActive` so
the burn button hides while the autopilot is actively flying.
Current line:
```js
const burning = flythrough.active || warpEffect.isActive || warpTarget.turning;
```
New line:
```js
const burning = flythrough.active || warpEffect.isActive
              || warpTarget.turning || autopilotMotion.isActive;
```

**Preserve the troubleshooting `_selectedTarget` integration that
just landed.** Current code at `src/main.js:6436–6454` (the
`autopilotMotion.isActive` block that reads `autoNav.getCurrentStop()`,
synthesizes a target via `_makeTarget(stop.type, …)`, and assigns
`_selectedTarget = _tgt`) is the right reticle wiring. **Do not
remove or restructure it.** It's the path that surfaces the autopilot
target as the selected reticle so the player sees what the ship is
flying to; keep it intact across this workstream's edits.

### 4. Body velocity exposure — first-pass code-read deliverable

**Read first, decide second.** Find where body positions are computed
from time in the orbital model. Candidates: `src/generation/
SolarSystemData.js`, `src/generation/StarSystemGenerator.js`,
`src/generation/MoonGenerator.js`, animate-loop body-update calls in
`src/main.js`. The question to answer:

- **Path A — analytic.** If body position is computed from a closed
  form like `position(t) = parent + radius × (cos(ωt + φ), sin(ωt
  + φ), 0)` (or equivalent — Keplerian, circular, etc.), then
  `velocity(t) = d/dt position(t)` is cleanly derivable analytically.
  Path A is the architectural target — the solver consumes
  `body.velocity` as a property derived from the same model that
  produces `body.position`.

- **Path B — finite difference.** If the orbital model is entangled
  (e.g., body position state is integrated forward each frame, no
  closed-form analytic available, or velocity is buried inside a
  cluster generator that rebuilds the system), then `velocity ≈
  (position_now − position_prev) / dt` from frame-to-frame state is
  V1-acceptable fallback. Surface this in the implementation commit
  with the rationale.

**Surface the choice to PM in the implementation commit message.**
This is the most likely structural surface in the workstream; if
Path A turns out non-trivial (e.g., crosses cluster boundaries, or
the orbital model has hand-tuned non-closed-form quirks), surface
*before* substantive edits and PM/Director may rule on whether to
expand scope. PhysicsEngine.js is stateless math utility, **not** the
live orbital model — don't be fooled by the file name.

If working-Claude finds the body-velocity exposure requires a
structural change beyond a thin `velocity_at(t)` accessor (e.g.,
threading a new state field through the cluster→system→body
pipeline), surface to PM — that's scope widening the brief must
record.

## Scope statement

**Implement the V1 §A4 redesign of camera and ship axes** authored
at `docs/FEATURES/autopilot.md` HEAD `9a37bec`: a CRUISE phase where
the ship re-aims `ship.forward` each frame at the predicted intercept
point (closed-form quadratic solver, graceful fallback if discriminant
< 0); a V1 ESTABLISHING camera mode where the camera tracks the
autopilot target body's current position each frame (`camera.lookAt
(target.current_position)`) across ENTRY/CRUISE/APPROACH/STATION-A,
with shake additive on top; a body-velocity exposure surface
(architectural target Path A — analytic; V1-acceptable fallback Path
B — finite-difference, working-Claude surfaces the choice); and
preservation of the troubleshooting `_selectedTarget` reticle wiring
in `src/main.js` plus the burn-button visibility extension to
suppress UI while the autopilot is flying.

The scope explicitly does **not** include extracting the predicted-
intercept solver or pursuit-curve camera read into shared modules
for future reuse. Director ruling: keep both call sites inline but
cleanly (single-purpose functions, well-named, easy to lift later
when manual nav lands and gives evidence of the second consumer's
shape). Pre-extraction without a second consumer is speculation; the
shape that fits both autopilot and manual-nav is established by
seeing the second consumer, not guessed in advance.

## How it fits the bigger picture

Advances `docs/FEATURES/autopilot.md` §"Heart's desire" — *"Wonder
and interest. Like a human navigator + cinematographer taking viewers
on a tour of the galaxy, showing the most interesting things in their
immediate environment."* Max's verbatim §A4 framing:

> *"During autopilot, when the next planet is ready for burning to,
> the first thing that happens before the ship moves is the camera
> centers on the planet or moon. The reticle selects it, and then
> the camera stays centered on that object until we get to it and
> the cycle continues. This is the camera's behavior that's separate
> from the ship's behavior which should be predicted intercept...
> we will reuse some of these systems when we're designing the
> player's manual navigation."*

The cinematographer's behavior (camera centers on the next subject,
stays on it across the leg, hands off to the next at arrival) is
the felt criterion; the predicted-intercept solver is what makes the
ship's behavior independently coherent (it actually arrives at where
the body is, not where the body was). The two axes compose into the
2001-station-docking shape the feature doc names: ship as a body
moving through a composed frame; the body framed steadily as the
ship pursues.

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy Principle 5
(Model Produces → Pipeline Carries → Renderer Consumes) by
restructuring the pipeline. Under the 2026-04-24 reframe, camera-axis
read ship-axis state (a coupling that violated the model→pipeline
direction — camera was inferring a frame from ship motion). Under
§A4, both axes read **target-body position** as the model output;
camera consumes target.current_position; ship consumes target.position
+ target.velocity through the solver. The model is the orbital body;
the pipeline carries position/velocity to two independent consumers.

Advances Principle 6 (First Principles Over Patches) by structural
construction. The 2026-04-24 attempt's patch shape — "look down
ship-forward + shake on top" — was an economy-driven scope that
preserved camera-reads-ship-forward as the existing surface. The §A4
redesign reaches up the stack to the actual feature need (camera
tracks the subject) rather than the cheap delta from the existing
code. The PM brief shape rule (`docs/PERSONAS/pm.md` §"Scope
discipline — feature before economy") applies here: feature wins,
economy is a tiebreaker after the feature question is answered, not
the framing that shapes the answer.

Advances `docs/FEATURES/autopilot.md` §"Manual override — two-layer
architecture" by leaving the predicted-intercept solver and pursuit-
curve camera read as inline-but-clean shapes that lift cleanly when
manual nav lands. The architectural carry is preserved; the speculative
extraction is deferred until the second consumer's shape is visible.

## Acceptance criteria

Phase-sourced where the feature doc authors a phase; contract-shaped
(per `docs/PERSONAS/pm.md` §"Per-phase AC rule carve-out") for the
ship-orientation precondition + the dispatch-preservation deliverable.

### AC #1 — Ship intercepts body within tolerance (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §CRUISE; **redrawn under §A4 — 2026-04-25**)

Quoted criterion: *"Predicted-intercept re-aim each frame. Each
frame, the ship re-aims `ship.forward` at the predicted intercept
point — where the target body will be when the ship arrives, given
current body velocity and cruise speed."*

Verification: per-frame telemetry capture. At APPROACH onset (the
phase boundary at `min(10R, cruise-distance ceiling)` per AC #2,
inherited from the prior workstream's §A3), record both the ship's
position and the body's ground-truth current position at that frame.
Compute the arrival-position error:
```
err = |ship.position − body.current_position| − 10R
```
where the absolute distance minus 10R is the ship's overshoot or
undershoot of the geometric onset target.

**Bound: |err| ≤ 0.001 scene units OR ≤ 0.01% of the leg's CRUISE-
onset distance, whichever is larger.** Across a Sol tour (Mercury →
Venus → Earth → Mars → Jupiter → Saturn — representative mix of
body scales and orbital velocities). **Tolerance rationale:** the
solver writes the intercept direction analytically each frame; the
remaining error at arrival is dominated by FP precision and the
discrete-time sampling of body velocity (whether Path A analytic or
Path B finite-difference). 0.001u absolute is the tight floor; the
0.01% relative ceiling allows long legs (Saturn-class) where the
tight absolute floor would over-constrain on cumulative FP drift.

**Pattern A leg-boundary spike note.** The prior workstream's
follow-up stub
(`docs/WORKSTREAMS/autopilot-leg-boundary-orientation-spike-followup.md`)
captured a single-frame leg-boundary spike at the AC #5 ship-forward-
to-camera-forward dot product. Under §A4, AC #5 is invalidated and
split into AC #5a + AC #5b; the leg-boundary spike's structural
class is dissolved by the new AC #5a (camera tracks body, no longer
reads ship.forward, so there's no order-of-write between
`motionStarted` and ESTABLISHING look-at to misalign). The follow-up
stub closes per the §A4 redesign — see closure rationale at
`docs/WORKSTREAMS/autopilot-leg-boundary-orientation-spike-followup.md`.

### AC #2 — APPROACH onset at min(10R, cruise-distance ceiling) (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §APPROACH; **inherited from prior workstream's §A3 amendment**)

Quoted criterion: *"Onset rule: fixed distance from the body.
APPROACH begins when the ship reaches 10× the body's radius (V1
starting value — tunable during lab iteration, not expected to vary
at shipping). No ramp, no gradual; CRUISE → APPROACH is a hard
velocity onset at the 10R threshold."*

**Inherited amended onset rule (V1):** APPROACH onset at **`min(10R,
cruise-distance ceiling)`**. Director §A3 verdict (workstream-local;
feature doc §APPROACH already authors the threshold as tunable). The
cruise-distance ceiling is the body-scale-aware floor on the geometric
threshold for asteroid-class bodies where 10R is sub-frame-tiny.

Verification: per-frame telemetry capture. In the same frame window
where `distance(ship, body) ≤ 10 × body.radius` **OR** `distTraveled
≥ cruiseDistance` first holds, the phase field transitions from
`CRUISE` to `APPROACH` **and** the shake-event log records one DECEL
shake event. Tolerance: within 1 frame of the geometric threshold
crossing. Verified across every leg of the Sol tour capture.

### AC #3 — STATION-A felt-fill ~60% of screen (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §STATION-A; **unchanged from prior workstream**)

Quoted criterion: *"Felt-fill framing, not numeric ratio. The body
fills ~60% of the screen at hold."*

Verification: at the moment the phase field stabilizes into
`STATION-A` (first frame where `shipVelocity ≈ 0` AND phase =
`STATION-A`), compute the body's apparent angular diameter
(`2 × atan(radius / distToBody)`) and divide by the camera's vertical
FOV (in radians). **Bound: 0.50 ≤ fill ratio ≤ 0.70.** Verified
across body scales (moon-class, Earth-class, gas giant) — a moon-
class target and a gas-giant target in the Sol tour both satisfy the
range.

### AC #4 — STATION-A body-lock invariance (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §STATION-A; **unchanged from prior workstream**)

Quoted criterion: *"Held until the next mode activates... STATION-A
has orbital motion — V1 is a hold, not an orbit"* (negative criterion
from §"Failure criteria / broken states").

Verification: during STATION-A, per-frame telemetry samples
`distance(ship, body)` at each frame. **Bound: `max(distToBody) −
min(distToBody) ≤ 0.001 scene units`** over a minimum 5-second hold
window. The held ship does not drift relative to the body, does not
orbit, does not wobble.

### AC #5a — Camera tracks body (per `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera axis (V1)" §ESTABLISHING §A4 redesign; **amended 2026-04-25 — narrowed to non-lhokon phases**)

Quoted criterion (feature-doc §A4): *"Camera tracks autopilot target
body. Every frame, `camera.lookAt(target.current_position)`. This
applies across the full leg — ENTRY, CRUISE, and APPROACH — and
persists into STATION-A where the held pose is naturally body-
centered. Shake stays additive on top of the body-tracking lookAt."*

**Phase scope (amended 2026-04-25):** the bound applies on
**`CRUISE`, `APPROACH`, `STATION-A`, and `ENTRY`** — every frame on
those phases. The bound **does not apply on the new `lhokon` phase**
(introduced by the 2026-04-25 amendment as the camera-convergence
beat between STATION-A and CRUISE). During lhokon, the camera is
mid-rotation by design — it does not `lookAt(target.current_position)`
every frame; instead it follows a smooth angular interpolation from
old-target-direction toward new-target-direction. The
prior-attempt's failure shape that this carve-out admits — a
camera that is not on-axis with the new target during the swap
window — is structurally bounded because **the ship is stationary
throughout lhokon** (AC #13). Drift Risk #5's old failure shape
("linger on a receding subject after leg-swap") becomes
structurally impossible: there is no receding subject during
lhokon (ship is not moving toward the new target; old subject is
not receding). The lhokon phase is the camera-convergence beat on
the new subject, distinct semantics from V-later linger.

Verification: per-frame telemetry samples `cameraForwardPreShake`
(unit) — read from `camera.quaternion` immediately after
`camera.lookAt(cameraChoreographer.currentLookAtTarget)` and
immediately before the shake-quaternion multiply (same sampling site
the prior workstream's §A3 AC #5 amendment established at main.js
animate loop, V1 STATION-hold branch). Compute the unit vector from
camera to body's current position:
```
expectedForward = normalize(target.current_position − camera.position)
```

**Bound: `dot(cameraForwardPreShake, expectedForward) ≥ 0.9999`
every frame, on phases `{ENTRY, CRUISE, APPROACH, STATION-A}`** —
i.e., **excluding `lhokon`**. The pre-shake basis is the contract
surface; post-shake `camera.forward` is not measured here (shake is
additive; AC #5a measures the body-tracking pursuit-curve, not the
shake perturbation). Verified across the Sol tour, full leg coverage
on the in-scope phases.

**The first CRUISE frame after lhokon completion is in scope of
this bound.** That is, lhokon's exit gate must deliver the camera
to the AC #5a-passing regime; if lhokon's timeout (1.5 s fallback)
fires with the dot still below 0.9999, the first CRUISE frame
captures the violation. This is the hand-off contract: lhokon's
exit *is* AC #5a's entry. AC #12 (lhokon-completion) bounds the
lhokon side; AC #5a bounds the CRUISE side. They meet at the phase
boundary.

**Negative criterion the bound catches by construction (during
in-scope phases):** if the camera reads stale target position
(snapshot capture, copied Vector3, parent-frame mismatch — drift
risk #9), the body drifts off-center during the leg and
`expectedForward` diverges from `cameraForwardPreShake` by more
than the bound. Per-frame measurement catches the drift class
within frames of onset.

### AC #5b — Ship aims at predicted intercept (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §CRUISE §A4 redesign; **new under §A4 — 2026-04-25**)

Quoted criterion: *"Each frame, the ship re-aims `ship.forward` at
the predicted intercept point — where the target body will be when
the ship arrives, given current body velocity and cruise speed."*

Verification: per-frame telemetry samples `ship.forward` (unit) and
the solver's intercept-direction:
```
expectedShipForward = normalize(intercept_point − ship.position)
where intercept_point = body.position + body.velocity × t_arrival
      and t_arrival is the smaller positive root of the quadratic
      named in §"Implementation plan" §1.
```

**Bound: `dot(ship.forward, expectedShipForward) ≥ 0.9999` every
frame during CRUISE.** No shake on top (ship.forward is the autopilot's
direct write, not the camera's read). Tolerance is tight because the
ship-axis write is direct — no compositional overlay. If the bound
proves too tight under FP precision (e.g., the solver's intermediate
arithmetic loses precision at long-leg distances), PM relaxes to
`≤ 0.5°` (`dot ≥ 0.99996`) — symmetry with AC #5a's pre-shake bound.

**Discriminant-fallback measurement.** When the solver's discriminant
is negative (body moving away faster than cruise speed), the spec
falls back to aim-at-current-position. AC #5b's bound applies against
the fallback's expected forward as well:
```
expectedShipForward (fallback) = normalize(body.current_position − ship.position)
```
The fallback is reported in the telemetry log; if it fires under
realistic playable conditions (Sol tour, normal cruise speeds), AC
#1's hit-the-target bound likely also fails — the fallback firing is
a flag for feature doc §"Failure criteria" review, not an automatic
AC failure.

### AC #6 — Shake event placement (per `docs/FEATURES/autopilot.md` §"Gravity drives" V1 scope; **unchanged from prior workstream**)

Quoted criterion: *"ACCEL shake — fires at CRUISE onset (departure
from STATION-A). DECEL shake — fires at APPROACH onset (10× body
radius). ACCEL ≡ reverse(DECEL) for V1. No shake during smooth
motion — no shake mid-CRUISE, no shake during STATION-A hold."*

Verification: shake-event telemetry log. Per leg, the log contains
**exactly two entries**: one event labeled `ACCEL` at the CRUISE-
onset frame, one event labeled `DECEL` at the APPROACH-onset frame.
**No shake events during CRUISE.** **No shake events during
STATION-A.** The ACCEL event's envelope shape is the signed reverse
of the DECEL event's envelope. Verified across the Sol tour.

### AC #7 — Ship orientation is set by the autopilot, read by shake only (contract-shaped, per `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera axis (V1)" §Precondition §A4 update; **consumer-set narrowed under §A4**)

Feature doc (§A4 update): *"The camera no longer reads ship.forward
for its lookAt direction. The precondition is preserved because the
shake mechanism still reads `ship.forward` and `ship.up` to author
its perturbation axis (camera/ship-mesh additive perturbation,
anchored to the ship's body frame). Under §A4, the autopilot still
writes `ship.forward` each frame — to the predicted-intercept
direction (§CRUISE) — and the ship holds the written orientation
through STATION-A's rest; shake reads it. The accessor surface
(`forward`/`up`) is unchanged from the 2026-04-24 contract; only the
consumer set narrows (camera dropped, shake retained)."*

Contract (all must hold):

1. The ship object exposes a stable `forward` (Vector3, unit) and
   `up` (Vector3, unit) accessor. `right` derives from `forward ×
   up`. Accessors are readable at all times — during CRUISE, during
   APPROACH, during STATION-A hold.
2. The orientation is **set by the autopilot**, not derived from
   ship velocity or position. The autopilot writes `ship.forward`
   each frame to the predicted-intercept direction (§CRUISE) or to
   the appropriate phase-specific direction (other phases). The ship
   holds the written orientation between writes. At STATION-A rest,
   `forward` returns the last-written value. The implementation site
   choice (where the orientation state lives, which subsystem writes
   it) is working-Claude's call as long as the accessor surface
   holds.
3. **Consumer narrowing (§A4):** `CameraChoreographer` does **NOT**
   read `ship.forward` for the V1 ESTABLISHING lookAt direction.
   Camera reads target body's current position directly. The V1
   ESTABLISHING dispatch site (CameraChoreographer.js L450 in the
   prior shape) is the change surface — drop the
   `addScaledVector(this._ship.forward, 100)` write; replace with
   `target.current_position` lookAt target.
4. The ACCEL/DECEL shake mechanism (ship-mesh additive perturbation)
   reads the accessors to compute its perturbation axis; consumer
   set is `{shake}` under §A4.

Verification: code inspection by Director (AC #7 is contract-shaped;
no telemetry measurement). Director audit confirms (a) `forward`/`up`
accessors stable on the ship object; (b) autopilot writes each frame
to the predicted-intercept direction (cross-check against AC #5b's
telemetry bound); (c) `CameraChoreographer` no longer reads
`ship.forward` for the lookAt direction (grep + dispatch trace);
(d) shake reads `forward`/`up` for perturbation axis.

### AC #8 — STATION-A jumpscare-arrival felt-experience (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §APPROACH, §STATION-A; **unchanged from prior workstream**)

Quoted criterion (Max's verbatim, feature doc §APPROACH):

> *"You are zooming straight towards the planet or the moon, whatever
> it is. It gets closer and closer to you and right where it feels
> like you're about to slam into it and blow up. The camera shakes
> and you decelerate extremely quickly, such that it's almost like
> it jumpscares, like it jumps up into your vision. And then you're
> just hanging there in front of the planet. It looms huge in front
> of you. And you just stay there. You stay stationary until the
> next mode activates, either manually or automatically."*

Verification: **motion-class recording, Max-evaluated**, per
`docs/MAX_RECORDING_PROTOCOL.md` and
`feedback_motion-evidence-for-motion-features.md`. A Sol tour capture
(Mercury → at least Jupiter; representative body scale range) recorded
at 60fps, delivered to Max, evaluated against the quoted phrasing.
Specific felt beats Max reads against (unchanged from prior
workstream's AC #8).

**Additional negative criterion under §A4:** body must remain centered
in frame across the full leg (CRUISE + APPROACH). Under the prior
workstream's V1, bodies drifted toward the edge of frame as the ship
cruised past the aim-once intercept; that's the structural failure
§A4 fixes. Max's eye should read the body as steadily framed
throughout the leg, not drifting off-center.

Shipped flip waits on this AC; Director audit closes at
`VERIFIED_PENDING_MAX <sha>` once the code + doc + recording are on
disk; Shipped flips to `Shipped <sha> — verified against
<recording-path>` only after Max has watched and confirmed.

### AC #9 — *Superseded.* (was: stub scaffolding removal)

Stub removal already shipped at `3b46199`. AC #9 from the prior
workstream is **dead** under §A4 and is **dropped** rather than
re-numbered — successive ACs (#10) keep their numbers for cross-
reference continuity with the prior workstream's audit history.

If `grep -n "window\._stub" src/main.js` returns non-zero hits at
any point during this workstream's edits (it should not — stub
removal is a fixed past commit), surface to Director immediately;
something has reintroduced the stub scaffolding, which is a Drift
risk #1 (Stub-creep) violation from the prior workstream and remains
load-bearing under §A4.

### AC #10 — Two-axis architecture preserved (per `docs/FEATURES/autopilot.md` §"V1 architectural affordances"; **unchanged from prior workstream**)

Quoted criterion: *"SHOWCASE / ROVING camera modes → the camera-axis
code path must be a first-class selector, not an if-branch inside
ESTABLISHING. V1 implements a `CameraMode` enum (`ESTABLISHING` /
`SHOWCASE` / `ROVING`) even if only one value is ever selected, and
routes camera updates through a dispatch that can accept any of the
three. Adding `SHOWCASE` later is a new branch, not a restructure."*

Verification: code inspection. The `CameraMode` enum + dispatch
surface survives. V1 selects `ESTABLISHING`; `SHOWCASE` and `ROVING`
branches compile and route but author no behavior. The `ESTABLISHING`
mode itself collapses to "lookAt(target.current_position) + shake on
top" but routes through the dispatch, not an if-branch. Director
audits at the audit gate.

### AC #11 — lhokon onset at STATION-A → next-target-selected boundary (per amendment 2026-04-25 — `lhokon` phase introduction)

Quoted criterion (this brief §"Amendments — 2026-04-25 (lhokon phase
introduction)"): *"`lhokon` is the camera-convergence beat: ship is
stationary at the STATION-A position; camera rotates from
old-target-direction to new-target-direction; when the camera is
centered on the new target, CRUISE begins."*

Verification: phase-transition telemetry. The ship's phase field
transitions from `STATION-A` to `lhokon` **on the same frame** that
the autopilot's queue advances to the next target (i.e., the frame
on which `_target` reference changes from old body to new body, or
equivalently the frame on which `autoNav.getCurrentStop()` transitions).

**Bound: phase transition `STATION-A → lhokon` occurs within 1
frame of next-target selection.** No `STATION-A → CRUISE` direct
transitions in the per-leg phase-transition log; the only path from
`STATION-A` out of the held state is via `lhokon`.

**Negative criterion the bound catches:** if working-Claude wires
the new-target advance to fire `STATION-A → CRUISE` directly (the
old phase order, prior to the amendment), the phase log shows the
direct transition; AC #11 fails immediately. Verified across the
Sol tour: every leg-swap shows `STATION-A → lhokon → CRUISE`,
never `STATION-A → CRUISE`.

### AC #12 — lhokon completion gates CRUISE entry (per amendment 2026-04-25 — `lhokon` phase introduction; CRUISE-entry gate (c) — dot-gate primary, fixed-duration timeout fallback)

Quoted criterion (this brief §"Amendments — 2026-04-25 (lhokon phase
introduction)" §"CRUISE-entry gate"): *"CRUISE begins only after
lhokon completes. Dot-gate primary (`dot(camera_forward_preshake,
normalize(new_target.current_position − camera.position)) ≥
lhokon_dot_threshold`); fixed-duration timeout fallback
(`lhokon_timeout_sec`). Tunable values: `lhokon_dot_threshold =
0.9999`, `lhokon_timeout_sec = 1.5`."*

Verification: per-frame telemetry samples `cameraForwardPreShake`,
`new_target.current_position`, `camera.position`, and the
`lhokon_elapsed_sec` accumulator. On the frame `lhokon → CRUISE`
transitions, **at least one** of the following must hold:

- **Dot-gate path:** `dot(cameraForwardPreShake,
  normalize(new_target.current_position − camera.position)) ≥
  lhokon_dot_threshold` (default `0.9999`, PM-tunable to `0.99996`
  symmetric with AC #5b's tolerance pathway).
- **Timeout path:** `lhokon_elapsed_sec ≥ lhokon_timeout_sec`
  (default `1.5`).

If the timeout path fires, the telemetry pipeline records a
`lhokon_timeout` flag for the leg; **the flag is not an automatic
AC failure**, but if it fires under realistic playable conditions
(Sol tour, normal cruise speeds), AC #5a's first-CRUISE-frame bound
likely also fails — the timeout firing is a flag for feature-doc
§"Failure criteria" review, mirroring the discriminant-fallback
shape on AC #5b.

**Bound:** the `lhokon → CRUISE` transition occurs **only** on a
frame where one of the two gate conditions holds. **No `lhokon →
CRUISE` transitions on any other frame.** Verified across the Sol
tour; expected pattern (per Tester §T1 telemetry on legs 1–3):
dot-gate carries every leg at ~658–1120 ms elapsed, timeout never
fires.

**Negative criterion the bound catches:** if the implementation
swaps to a fixed-duration-only gate (option (b) in the amendment),
the dot-gate side fails to ever fire and lhokon always exits on
timeout; the per-leg telemetry shows `lhokon_elapsed_sec ≈ 1.5` for
every leg without ever recording a sub-1.5s exit. If the
implementation swaps to a pure-dot-only gate (option (a)) and a
degenerate axis case hangs lhokon indefinitely, the per-leg
telemetry shows `lhokon` extending past 1.5 s without exiting; AC
#12 catches the hang within frames of the timeout boundary.

### AC #13 — Ship stationary during lhokon (per amendment 2026-04-25 — `lhokon` phase introduction)

Quoted criterion (this brief §"Amendments — 2026-04-25 (lhokon phase
introduction)"): *"Ship remains stationary at the STATION-A
position. Velocity = 0."*

Verification: per-frame telemetry samples `ship.velocity` (or
finite-differenced `(ship.position_now − ship.position_prev) / dt`
if velocity is not exposed) and `ship.position` during lhokon.

**Bound: `|ship.velocity| ≤ 0.0001 scene units / second` for every
frame on phase `lhokon`** (numerical tolerance for FP drift in
parent-frame transforms; same order of magnitude as AC #4's
STATION-A body-lock invariance bound). Equivalently, **`max
|ship.position − ship.position_at_lhokon_onset| ≤ 0.0001 scene
units` across the lhokon duration.** Verified across the Sol tour.

**Negative criterion the bound catches:** if working-Claude lands
the lhokon phase but the ship begins to accelerate before
lhokon-completion (e.g., the predicted-intercept solver fires its
`_tickCruise` path during lhokon), the receding-subject linger
failure mode reappears — old subject becomes a receding subject as
the ship moves away from STATION-A while the camera is still
mid-convergence. AC #13 catches the velocity onset within frames;
AC #5a's CRUISE-side bound catches the consequence on the first
CRUISE frame.

### AC #14 — Smoothness preserved at lhokon entry/exit (per amendment 2026-04-25 — `lhokon` phase introduction)

Quoted criterion (this brief §"Amendments — 2026-04-25 (lhokon phase
introduction)"): *"No per-frame angular-velocity discontinuity at
lhokon entry/exit (i.e., no visible snap at either boundary)."*

Verification: per-frame telemetry samples `cameraForwardPreShake`;
compute frame-to-frame angular delta:
```
angularDelta_n = angle(cameraForwardPreShake_n,
                        cameraForwardPreShake_{n-1})
```
where `angle` is the unit-vector angle (`acos(dot)` clamped).

**Bounds:**

- **At lhokon entry** (last STATION-A frame → first lhokon frame):
  `angularDelta_lhokon_entry ≤ 0.5°`. The camera's last-held pose
  on STATION-A is `lookAt(old_target.current_position)`; the
  lhokon's first frame begins the rotation from that pose. The
  rotation must start from the held pose with continuous angular
  velocity, not snap to a new direction.
- **At lhokon exit** (last lhokon frame → first CRUISE frame):
  `angularDelta_lhokon_exit ≤ 0.5°`. CRUISE begins with
  `lookAt(new_target.current_position)`; lhokon's last frame must
  be at or near that direction (AC #12 enforces the dot-bound;
  AC #14 enforces the *continuity* of the transition).
- **Within lhokon:** the angular-velocity envelope is the
  smoothing curve's authored shape (nlerp / ease — implementation
  choice). No bound on magnitude (working-Claude's smoothing
  function authors the shape); only on continuity at the
  boundaries.

**Tolerance:** `0.5°` per-frame at 60 fps corresponds to angular
velocity `≤ 30°/s` — well below the swap-frame snap (~180°)
working-Claude's commits `70c4b09` were authored to suppress.

**Negative criterion the bound catches:** if the implementation
lands lhokon as a phase that does not seed from the prior-frame's
camera direction (i.e., it computes the rotation from a
to-be-named "swap reference direction" that doesn't equal
old-target-direction at lhokon-entry), AC #14's lhokon-entry bound
catches the discontinuity. Symmetric argument at lhokon-exit
against CRUISE's first-frame `lookAt(new_target.current_position)`.

## Principles that apply

From `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 6 — First Principles Over Patches.** Load-bearing
  because §A4 *is* the Principle-6 escalation against the 2026-04-24
  reframe. The prior workstream's V1 (camera reads ship-forward)
  was the cheap delta from existing code; §A4 reaches up the stack
  to the actual feature need (camera tracks the subject, ship aims
  at where the body will be). Violation **in this workstream** would
  look like: working-Claude noticing that the per-frame solver is
  "expensive" or "noisy" and reaching for a pre-computed intercept
  trajectory or a smoothing filter on the aim direction. Both are
  symptoms of compositional patch-class thinking; the predicted-
  intercept solver is *the* mechanism. If a symptom appears, surface
  to PM + Director; do not filter.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Load-bearing for the §A4 restructure. The model is the
  orbital body (produces position + velocity); the pipeline carries
  position to the camera consumer (lookAt) and position + velocity
  to the ship consumer (intercept solver); the renderer consumes the
  ship's authored orientation (shake reads forward/up). The reverse
  flow that §A4 closed: camera computing orientation from ship motion
  state. Violation in **this workstream** would look like: introducing
  a "camera position blend that smooths against ship velocity" or
  similar — those are the cycle-1/2/3 patch-class shapes that the
  feature doc §"Drift risks" entry #2 flagged on the prior workstream
  and that §A4 dissolves at the model layer.

- **Principle 2 — No Tack-On Systems.** Load-bearing for the body-
  velocity exposure deliverable. `body.velocity` is a property of
  the orbital model, not a property of the autopilot subsystem.
  Wiring it as autopilot-internal state (`autopilotMotion._cachedBodyVel`)
  would tack the velocity onto the autopilot; the correct placement
  is on the body / orbital-model side, consumed by the autopilot.
  Path A (analytic `velocity_at(t)`) honors this directly; Path B
  (finite-difference) approximates it without violating it (the
  finite-difference site lives in the body update loop, not inside
  the autopilot).

- **Principle 1 — The Bible Is the Goal.** Load-bearing because the
  §A4 redesign must match the amended feature doc verbatim — the
  camera tracks the body (not "follows the ship"), the ship aims at
  predicted intercept (not "aim-once and let drift"), the consumer
  set narrows (camera no longer reads ship-forward). Violation would
  look like a well-meaning compromise — "camera reads body 90% of
  the time but blends with ship-forward during shake" — that the
  feature doc rejects by construction. Shake is additive on top of
  body-tracking; there is no blend with ship-forward in the V1 spec.

## Drift risks

- **Risk: Camera reads stale target position** (verbatim from feature
  doc §"Drift risks" entry #9, replaced under §A4): *"Camera reads
  stale target position. Under §A4, the pursuit-curve must read the
  body's **current** position each frame, not a captured-at-onset
  snapshot. Variants of the failure: target reference captured at
  CRUISE onset and never refreshed; lookAt invoked with a copied
  Vector3 instead of a live reference; the body's parent frame moves
  but the lookAt target wasn't reparented. All produce a body that
  drifts off-frame mid-leg. Verification: per-frame camera-to-body
  angular error (`angle(camera.forward, normalize(body.current_position
  − camera.position))`) stays below tolerance across the leg."*
  **Why it happens:** the convenient code path is to capture
  `target.position` at CRUISE onset and reuse the captured Vector3;
  the failure surfaces silently because the body's continuous motion
  is small enough that the bound is satisfied for the first few
  seconds before the drift accumulates beyond tolerance. **Guard:**
  AC #5a's per-frame bound (`dot ≥ 0.9999`) catches the drift class
  within frames of onset. Implementation pattern: `lookAt
  (target.current_position)` reads through a live reference each
  frame; do not snapshot, do not copy into a stable Vector3. If
  `target.current_position` requires a function call (Path A
  analytic), call it each frame.

- **Risk: Solver discriminant < 0 fires under realistic conditions.**
  The graceful fallback (re-aim at body.current_position) is the
  right edge-case behavior, but if it fires during the Sol tour at
  realistic cruise speeds, the chosen cruise speed is too low for
  the body's orbital velocity — the spec is broken at a different
  layer. **Why it happens:** Path B finite-difference can produce
  noisy velocity estimates; or the cruise speed envelope was tuned
  against static-body assumptions and isn't large enough to close
  fast-moving bodies. **Guard:** working-Claude logs each fallback
  fire to the telemetry stream (one entry per CRUISE phase that
  enters fallback). Director reviews the log during the audit; if
  fallbacks fire in the Sol tour recording, the workstream surfaces
  to PM + Director — likely a feature doc §"Failure criteria"
  flag, not an in-workstream patch.

- **Risk: Solver over-corrects near arrival.** As the ship approaches
  the body, `t_arrival` shrinks toward zero and the intercept point
  approaches the body's current position. FP precision of the
  intermediate arithmetic (especially `V·V − s²` near the discriminant
  edge) can produce unstable aim direction in the last few CRUISE
  frames. **Why it happens:** division by small numbers (or the
  smaller-positive-root selection swapping signs) near arrival.
  **Guard:** AC #5b's bound (`dot ≥ 0.9999` between `ship.forward`
  and `expectedShipForward`) catches over-correction within frames.
  If the bound fails at the last 2–5 frames of CRUISE only,
  implementation can introduce a "near-arrival" fallback (e.g., when
  `|R| < 2 × 10R`, switch to aim-at-current-position) — but only
  with PM/Director sign-off, since this *adds* a phase-internal
  branch the feature doc doesn't author. Default: no near-arrival
  fallback; let AC #5b measure and surface.

- **Risk: Body velocity precision (Path B finite-difference noise).**
  If working-Claude takes Path B (finite-difference position frames),
  the velocity estimate is `(pos_now − pos_prev) / dt` which inherits
  the dt's discretization noise. At 60fps, dt ≈ 0.0167s; for a body
  with orbital period ~1 year, the per-frame position delta is tiny,
  and FP cancellation in the subtraction can amplify noise 100×
  relative to the underlying velocity. **Why it happens:** Path B is
  the "easy" choice; the noise problem is silent. **Guard:** AC #1's
  hit-the-target bound and AC #5b's per-frame bound both fail under
  noisy velocity input (the solver writes a noisy intercept direction
  → ship.forward jitters → AC #5b fails; the cumulative error at
  arrival → AC #1 fails). If both fail and Path A (analytic) is
  available, working-Claude switches paths; surface to PM with the
  rationale.

- **Risk: V-later camera authoring smuggled into V1** (rewritten
  under 2026-04-25 amendment — `lhokon` phase introduction). The
  feature-doc carve preserves V-later linger on receding subjects,
  pan-ahead toward incoming targets, and departure arcs as
  out-of-V1 explicitly: *"V-later authoring may add a brief linger
  on the receding subject before re-targeting; V1 does not."* The
  prior framing of this risk caught swap-window smoothing during
  CRUISE by construction via AC #5a. The 2026-04-25 amendment
  introduces `lhokon` as the legitimate phase for camera
  convergence between legs — but this is **not a license** to
  re-import V-later linger / pan-ahead / departure-arc authoring
  into V1 under the lhokon banner. The lhokon phase is **the
  camera-convergence beat on the new subject** (camera rotates
  *toward* the new target while the ship is stationary); it is
  **not a linger on the receding subject** (which would require
  the ship to be moving away from the old target while the camera
  follows it). The two are structurally distinct: lhokon's
  ship-velocity = 0 (AC #13) makes "receding subject" semantically
  impossible. **Why it happens:** the existing `CameraChoreographer`
  retains LINGERING / TRACKING / PANNING_AHEAD branches from WS 3;
  a well-meaning implementation pass might land the lhokon phase
  by routing through the LINGERING branch (because the visual
  shape — camera holds on a subject as a phase boundary crosses
  — feels superficially similar). It is not the same shape;
  LINGERING authors a camera that holds on a subject as the *ship
  moves away*; lhokon authors a camera that *rotates toward a new
  subject while the ship holds*. **Guard:** AC #13's
  ship-stationary-during-lhokon bound is the structural
  enforcement (LINGERING-as-lhokon would not violate AC #13 by
  itself; the violation surfaces on the first CRUISE frame when
  AC #5a's bound activates and the camera is still angularly
  off-axis from the new target because the LINGERING branch was
  authored against the *old* target's motion, not the new
  target's geometry). AC #5a's first-CRUISE-frame bound (per
  AC #12's gate) catches this within one frame of CRUISE entry.
  Additionally: if working-Claude is tempted to author *both*
  lhokon (per amendment) *and* a brief linger on the receding
  subject during lhokon's first 200–500 ms, that is the V-later
  scope the carve forbids. AC #14's lhokon-entry continuity bound
  catches a held-on-old-subject opening (zero angular velocity at
  lhokon entry implies the camera is not yet rotating toward the
  new target, which fails AC #12's exit gate within `lhokon_timeout_sec`).

- **Risk: Ship moves before lhokon completes (new under 2026-04-25
  amendment).** The lhokon phase is defined by **ship.velocity = 0**
  (AC #13). If the per-frame predicted-intercept solver fires its
  `_tickCruise` write path while the phase is still `lhokon`, the
  ship begins to accelerate toward the new target — and the
  receding-subject linger failure mode reappears (old subject
  recedes from the moving ship while the camera is still
  mid-convergence on the new). **Why it happens:** the V1 §A4
  predicted-intercept solver is wired into `_tickCruise`; if the
  amendment's phase routing fires `_tickCruise` on `lhokon` (instead
  of a new `_tickLhokon` that holds position + advances camera
  rotation), velocity onset is silent. **Guard:** AC #13's
  per-frame velocity bound catches the onset within frames; AC
  #5a's CRUISE-side bound catches the consequence on first CRUISE
  frame. Implementation pattern: `lhokon` phase has its own tick
  function (or a guarded branch in the dispatch) that **does not**
  call the predicted-intercept solver; the camera-rotation update
  is the only authoring on lhokon; the ship's position is held at
  the STATION-A onset position via the same hold-frame mechanism
  STATION-A uses (AC #4's body-lock invariance bound is the
  precedent).

- **Risk: CRUISE-entry gate hangs (new under 2026-04-25
  amendment).** Pure-dot-gate option (a) was rejected in favor of
  (c) (dot-gate primary + fixed-duration timeout fallback)
  because (a)'s failure mode is a silent hang — if FP noise
  asymptotes the dot near 0.9999 without crossing it, or if the
  rotation axis is degenerate (prev and new directions nearly
  antiparallel), lhokon never exits and CRUISE never begins;
  player sees a frozen ship. **Why it happens:** option (a)
  feels semantically cleanest and the implementation might
  arrive at (a) by simplification ("we don't need the timeout —
  the dot always converges"). It does not always converge under
  FP precision. **Guard:** the timeout fallback is **not
  optional** in the amendment's gate criterion (c); landing
  pure-(a) is a Drift Risk #5-class violation. AC #12's
  bound enforces *one of* the two gate conditions; if the
  timeout path is removed, the per-leg telemetry shows `lhokon`
  extending past 1.5 s on degenerate cases, AC #12 fails. PM
  ruling: if the timeout path *fires* on a leg under realistic
  conditions (dot-gate didn't carry within 1.5 s), surface to PM
  + working-Claude — likely a feature doc §"Failure criteria"
  flag, mirroring the discriminant-fallback shape on §A4's
  predicted-intercept solver.

- **Risk: Stub-creep returning** (preserved from prior workstream's
  Drift risk #1). AC #9 is now dead (`window._stub*` already removed),
  but the temptation to introduce *new* `window.X` debug accessors
  during V1 §A4 implementation is the same shape. **Why it happens:**
  the §A4 work touches new code paths (predicted-intercept solver,
  body-velocity surface) and a debug accessor for inspecting them
  feels useful. **Guard:** if working-Claude wants a debug accessor,
  surface to PM — a workstream-bounded debug helper is allowable
  under `feedback_build-dev-shortcuts.md` (Max-authorized dev shortcuts)
  if it's named workstream-specifically and removed at workstream
  close. The default is no new debug accessors; AC verification runs
  through telemetry, not `window.*` poking.

- **Risk: Pre-extraction of the predicted-intercept solver / pursuit-
  curve camera read into a shared module.** Director ruling explicitly
  against this: keep both inline-but-clean; the shape that fits both
  autopilot and manual-nav is established by seeing the second
  consumer, not guessed in advance. **Why it happens:** Max named
  the manual-nav reuse explicitly in the §A4 framing
  (*"we will reuse some of these systems when we're designing the
  player's manual navigation"*); the convenient response is to
  pre-extract the shape now to "save work later." **Guard:** code
  review at audit time. If working-Claude introduces a new shared
  module like `src/auto/InterceptSolver.js` or
  `src/auto/PursuitCurve.js` during this workstream, surface to PM
  + Director; the extraction is out of scope. The single-purpose
  function shape (well-named function inside `AutopilotMotion.js`,
  well-named function inside `CameraChoreographer.js`) is the V1
  target — easy to lift later when the second consumer's shape is
  visible.

## In scope

- Implementation of V1 §A4 ship axis: per-frame predicted-intercept
  re-aim (closed-form quadratic solver with discriminant-fallback)
  in `_tickCruise`.
- Implementation of V1 §A4 camera axis ESTABLISHING: per-frame
  `lookAt(target.current_position)` in `CameraChoreographer.js`,
  dropping the `ship.forward × 100` write.
- **Implementation of the `lhokon` phase (2026-04-25 amendment).**
  New named phase between `STATION-A` and `CRUISE` that hosts
  camera convergence on the next target while the ship is
  stationary. Includes:
  - Phase enum extension (`STATION-A → lhokon → CRUISE` order;
    AC #11).
  - CRUISE-entry gate (dot-gate primary + fixed-duration timeout
    fallback per amendment §"CRUISE-entry gate"; AC #12).
  - Ship-stationary enforcement during lhokon (AC #13).
  - Boundary-continuity at lhokon entry/exit (AC #14).
  - **Migration of the existing 1.5 s direction-nlerp** from
    its current CRUISE-entry placement (commits `dc26cbd` +
    `70c4b09` + `8f6623d`) into the new lhokon phase. The nlerp
    mechanism is reused; only the phase that hosts it changes.
  - **Same-session feature-doc edit** introducing `lhokon` as a
    named phase in `docs/FEATURES/autopilot.md` §"Per-phase
    criteria — ship axis" + §"Per-phase criterion — camera axis
    (V1)" + §"Revision history". Working-Claude owns the
    feature-doc update under the 2026-04-25 Dev Collab OS
    restructure (working-Claude updates `docs/FEATURES/*.md`
    same-session; PM does not author the feature-doc edit).
- Body-velocity exposure surface: Path A (analytic `velocity_at(t)`)
  if cleanly derivable from the orbital model; Path B (finite-
  difference) as V1-acceptable fallback. Working-Claude surfaces the
  choice in the implementation commit.
- Burn-button visibility extension in `src/main.js` (line ~5346) to
  include `autopilotMotion.isActive`.
- Preservation of the troubleshooting `_selectedTarget` integration
  at `src/main.js:6436–6454` (autoNav.getCurrentStop → _makeTarget →
  _selectedTarget) — kept as-is across this workstream's edits.
- Sol tour recording as motion-class evidence for AC #8 (Max-
  evaluated).
- Telemetry-driven AC verification (ACs #1, #2, #3, #4, #5a, #5b,
  #6, #10) using the existing telemetry pipeline + the existing
  `runAllReckoning` audit harness, plus per-frame solver-output and
  intercept-direction logging.
- `CameraMode` dispatch surface preserved (AC #10 unchanged).

## Out of scope

- **STATION-B opt-in orbital motion.** V-later per feature doc
  §V-later triage; scoped in the future ORBIT-mode workstream.
- **Camera axis V-later authoring under §A4.** Linger on receding
  subject, pan-forward toward incoming target, departure arc from
  STATION-A into CRUISE, `SHOWCASE` camera mode, `ROVING` camera
  mode — explicitly V-later per feature doc §"Per-phase criterion —
  camera axis (V1)" §A4 redesign. **The 2026-04-25 lhokon amendment
  does NOT relax this carve.** The lhokon phase is the
  camera-convergence beat *toward the new subject while the ship
  is stationary*; it is structurally distinct from V-later's
  *linger on the receding subject as the ship moves away* (see
  Drift Risk #5 rewritten under the amendment for the failure
  shape that distinguishes lhokon from LINGERING). Pan-ahead,
  departure-arc, and SHOWCASE / ROVING remain V-later regardless
  of the lhokon phase's existence.
- **Pre-extraction of the predicted-intercept solver or pursuit-curve
  camera read** into shared modules like `src/auto/InterceptSolver.js`
  or `src/auto/PursuitCurve.js`. Director ruling: inline-but-clean
  in `AutopilotMotion.js` and `CameraChoreographer.js` respectively;
  the second-consumer shape (manual nav) lifts the function later.
- **Manual nav implementation.** Named in the §A4 framing as the
  reuse target; not implemented in this workstream. The single-
  purpose function shape is the carry-forward affordance, nothing
  more.
- **OOI runtime queries.** `getNearbyOOIs()` / `getActiveEvents()`
  stay as the stub interface (returning `null`/empty) per feature
  doc §"V1 architectural affordances".
- **Most-interesting-first body selection.** Feature doc keeps V1
  on inner-to-outer queue.
- **Multi-body tour scheduling logic.** `AutoNavigator.buildQueue`
  untouched.
- **ENTRY phase (warp-exit-vector arrival pose).** Named in feature
  doc §V1 but not scoped here.
- **Autopilot toggle UI** (upper-left status indicator + Tab
  keybinding). Separate WS 4 scope.
- **HUD hide-during-autopilot / reappear-on-interaction.** Separate
  WS 4 scope.
- **Audio event-surface** (`phase-change`, `toggle` events). Partially
  landed by WS 3; remaining events are WS 4 scope.
- **Star-orbit safe-distance rule.** Landed by
  `docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`.
- **The parked travel-feel speed-field** (feature doc §"Parking
  lot"). Feature-level articulation Max has parked.
- **Shake mechanism redesign.** The mechanism is inherited from WS 2
  shake-redesign at `1bb5eb2`. This workstream re-specifies the
  consumer set on `ship.forward` (camera dropped, shake retained);
  it does not redesign the shake authoring.
- **Visible ship-orientation indicators** (chevrons, decals,
  orientation reticle). AC #7 requires orientation be *defined* and
  *settable*, not *visualized*. Rendering changes are out of scope.
- **Stub re-introduction.** AC #9 is dead under §A4 (stub removal
  shipped at `3b46199`); no new `window._stub*` paths.

## Handoff to working-Claude

**Read this brief first.** Then, in order:

1. **`docs/FEATURES/autopilot.md` at HEAD `9a37bec`** — the §A4
   amendment. Specifically: §"Revision history" 2026-04-25 entry,
   §"Per-phase criteria — ship axis" §CRUISE (predicted-intercept
   re-aim + closed-form quadratic + edge-case fallback), §"Per-phase
   criterion — camera axis (V1)" §ESTABLISHING (§A4 redesign) +
   §Precondition (§A4 update), §"Failure criteria / broken states"
   (body-drift, ship-overshoot), §"Drift risks" entry #9.
2. **`~/.claude/state/dev-collab/audits/autopilot-station-hold-redesign-2026-04-24.md`
   §A4** — the canonical Director ruling. The verdicts in §A4 drive
   this brief; quote them when in doubt.
3. **`docs/WORKSTREAMS/autopilot-station-hold-redesign-2026-04-24.md`
   §"Status" + §A3 amendments** — prior-cycle reference. The §A3
   amendments to AC #2 (`min(10R, cruise-distance ceiling)`) and AC
   #5 (pre-shake basis sampling) are inherited unchanged.
4. **`recordings/autopilot-station-hold-v1-attempt1.webm`** — the
   prior workstream's V1 Attempt 1 recording. Watch the cruise legs
   to see the body-drift failure mode §A4 fixes; this is the
   regression criterion AC #8 reads against (body remains centered
   in frame across the full leg under the §A4 redesign, where it
   drifted under the prior V1).
5. **`src/auto/AutopilotMotion.js` in full** — the prior workstream's
   V1 evaluator that replaced `NavigationSubsystem.js`. The
   `_tickCruise` function (currently aim-once + straight-line
   integration) is the change surface for §A4 §1.
6. **`src/auto/CameraChoreographer.js` L440–L460** — the V1
   STATION-hold ESTABLISHING dispatch where `_currentLookAtTarget`
   is computed from `motionFrame.position + ship.forward × 100`.
   This is the change surface for §A4 §2.
7. **`src/main.js` L5346** — the burn-button visibility line. Trivial
   extension (add `|| autopilotMotion.isActive`).
8. **`src/main.js` L6436–L6454** — the troubleshooting `_selectedTarget`
   integration that just landed. **Read it; do not modify it.** This
   is the reticle wiring that surfaces the autopilot target as the
   selected reticle.
9. **`src/generation/`** — body-velocity exposure code-read.
   Specifically `SolarSystemData.js`, `StarSystemGenerator.js`,
   `MoonGenerator.js`. PhysicsEngine.js is stateless utility math,
   **not** the live orbital model — don't mistake it for the source.
   Find where `body.position` is computed from `t` (or where it's
   integrated frame-to-frame). Surface to PM whether Path A or Path
   B is the V1 path before substantive edits.
10. **`docs/MAX_RECORDING_PROTOCOL.md`** — canvas-recording path for
    the Sol tour capture (AC #8). Agent-initiated via
    `~/.claude/helpers/canvas-recorder.js`; fetch via
    `~/.local/bin/fetch-canvas-recording.sh`.

**Then, in implementation order:**

1. **First-pass code read + body-velocity-exposure surfacing.** Run
   the §1–§9 reads above. Surface the Path A vs. Path B choice to
   PM in a brief note (chat, or a comment on this brief — not a
   commit) before substantive edits. PM/Director may rule on whether
   Path A's structural cost is worth absorbing or Path B finite-
   difference is the V1 path. Do **not** start editing until this
   surface is resolved.
2. **Body-velocity exposure (Path A or Path B).** Implement the
   chosen path. Path A: add `velocity_at(t)` (or equivalent
   accessor) to the orbital model alongside position. Path B: add
   a frame-to-frame velocity estimate at the body update site; the
   estimate is `(pos_now − pos_prev) / dt`. Either way, the autopilot
   reads the exposed velocity through the same surface that exposes
   position.
3. **Predicted-intercept solver in `_tickCruise`.** Implement the
   closed-form quadratic with smaller-positive-root selection.
   Discriminant-fallback re-aims at `body.current_position`; log the
   fallback fire to telemetry. Each frame, write `ship.forward =
   normalize(intercept_point − ship.position)`.
4. **CameraChoreographer ESTABLISHING decouples from ship.forward.**
   Replace the L450 `addScaledVector(this._ship.forward, 100)` with
   `target.current_position`. Working-Claude locates the cleanest pipe
   to deliver the target reference (likely a new field on
   `motionFrame` populated by `AutopilotMotion`). Drop the dependency
   on `_ship` for the V1 ESTABLISHING lookAt direction; preserve the
   `setShip` accessor (shake still uses the ship reference).
4a. **lhokon phase migration (2026-04-25 amendment).** Add a new
   `lhokon` value to the autopilot phase enum (between `STATION-A`
   and `CRUISE`). Wire the phase-transition path: on next-target
   selection, `STATION-A → lhokon` (AC #11); during lhokon, ship
   is held stationary at the STATION-A onset position (AC #13;
   reuse the same hold-frame mechanism STATION-A's body-lock uses
   per AC #4); during lhokon, camera rotates from
   old-target-direction to new-target-direction via the existing
   1.5 s direction-nlerp (currently at `CameraChoreographer.js:359`,
   commits `dc26cbd` + `70c4b09` + `8f6623d`); on each frame,
   evaluate the CRUISE-entry gate (AC #12) — if `dot ≥ 0.9999`
   **OR** `lhokon_elapsed_sec ≥ 1.5`, transition `lhokon →
   CRUISE` and begin the predicted-intercept solver path. **Do
   not** call the predicted-intercept solver during lhokon; the
   ship is stationary by AC #13. AC #14's continuity bounds
   constrain the boundary frames. Add the lhokon-side telemetry:
   per-frame `cameraForwardPreShake` + `lhokon_elapsed_sec` +
   `lhokon_timeout_fired` flag.

   Same-session, edit `docs/FEATURES/autopilot.md` to introduce
   `lhokon` as a named phase. Suggested touch-points: §"Per-phase
   criteria — ship axis" (insert lhokon between STATION-A and
   CRUISE on the ship axis with "stationary, hold position" as
   the ship behavior); §"Per-phase criterion — camera axis (V1)"
   §ESTABLISHING (note that ESTABLISHING's body-tracking applies
   on `{ENTRY, CRUISE, APPROACH, STATION-A}` and that lhokon hosts
   a camera-rotation-toward-new-target sub-mode); §"Revision
   history" 2026-04-25 entry (per Suggested shape in §"Amendments —
   2026-04-25 (lhokon phase introduction)" §"Deferred decisions").
   Working-Claude lands the feature-doc edit alongside the
   implementation in the same commit / commit-set.
5. **Burn-button visibility extension in `src/main.js`.** One-line
   edit at the `burning` flag computation.
6. **Telemetry-driven AC verification.** Run `runAllReckoning`
   against a Sol tour capture; ACs #1, #2, #3, #4, #5a, #5b, #6,
   #10 evaluate from telemetry. Add the new per-frame solver-output
   logging (`expectedShipForward` for AC #5b, `expectedForward` for
   AC #5a) to the telemetry pipeline.
7. **Sol tour canvas recording for AC #8.** Mercury → at least
   Jupiter; 60fps; Max-evaluated. Deliver the recording path to PM
   + Max; Director's audit closes at `VERIFIED_PENDING_MAX <sha>`
   and Max's watch flips it to `Shipped`.

**"Done" looks like:**

- A commit or commit set on main that lands V1 §A4 redesign +
  the 2026-04-25 lhokon-phase amendment: predicted-intercept
  solver + body-velocity exposure + camera-decoupled ESTABLISHING
  + lhokon phase + lhokon CRUISE-entry gate + burn-button
  visibility extension.
- `runAllReckoning` passes ACs #1, #2, #3, #4, #5a (narrowed to
  non-lhokon phases per amendment), #5b, #6, #10, **#11
  (lhokon-onset), #12 (lhokon-completion gate), #13 (ship-
  stationary-during-lhokon), #14 (smoothness preserved at lhokon
  boundaries)** against a Sol tour capture.
- AC #7 (consumer-set narrowed: camera no longer reads ship.forward)
  re-verified by Tester at implementation sites at the new HEAD.
- AC #8 (jumpscare-arrival felt experience + body remains centered
  in frame) — canvas recording on disk at a known path, Tester
  audit closes at `VERIFIED_PENDING_MAX <sha>`, Max watches and
  confirms. Recording recapture is **deferred until the lhokon
  implementation lands at a new HEAD**, per the amendment.
- Feature-doc edit (`docs/FEATURES/autopilot.md`) introducing
  `lhokon` as a named phase landed in the same commit / commit-
  set as the implementation, per the 2026-04-25 Dev Collab OS
  restructure (working-Claude owns same-session feature-doc
  updates).
- Status flips to `Shipped <sha> — verified against <recording-path>`
  only after Max's confirmation.

**Cycle budget:** Attempt 1, 1 capture, 1 audit at first
`VERIFIED_PENDING_MAX <sha>` (Director ruling). Parameter-tune budget
held for the AC #5b angular-error tolerance (PM tunes `0.1°` to
`0.5°` if FP noise warrants) and the discriminant-fallback edge-case
behavior (working-Claude surfaces fallback fires; Director reviews
during audit). Attempt 2 triggered only if mechanism-class failure
— e.g., the predicted-intercept solver is unstable under realistic
cruise speeds, or Path B finite-difference is too noisy and Path A
turns out non-trivial. Escalate to Director at that point; do not
iterate within this workstream.

**Re-use note (Director ruling).** Max called out this design will
be reused for player manual navigation: *"we will reuse some of
these systems when we're designing the player's manual navigation."*
Director ruled **against** pre-extraction in this workstream. Keep
the predicted-intercept solver as a single-purpose function inside
`AutopilotMotion.js` (well-named, e.g., `solveInterceptDirection
(shipPos, bodyPos, bodyVel, cruiseSpeed)`); keep the pursuit-curve
camera read as the body-tracking lookAt site inside `CameraChoreographer.js`.
Both shapes are easy to lift later when manual nav lands and the
second consumer's shape provides evidence of what the right shared
abstraction looks like. Pre-extraction without that evidence is
speculation; the function-shape carry-forward is the affordance.

---

*Authored by PM under Director audit §A4 (2026-04-25); audit
verdicts quoted verbatim. Amended 2026-04-25 by PM (lhokon phase
introduction) under Tester verdict §T1 at HEAD `8f6623d`; verdict
quoted verbatim and cross-referenced. The amendment moves swap-
window camera smoothing from CRUISE (where it conflicted with AC
#5a's per-frame body-tracking bound) into a new named phase
`lhokon` between STATION-A and CRUISE; ship is stationary during
lhokon, so the receding-subject linger failure mode that Drift Risk
#5 was authored to catch is structurally impossible. CRUISE-entry
gate is dot-gate primary (`≥ 0.9999`, semantic match to AC #5a's
bound) with fixed-duration timeout fallback (`1.5 s`, matching the
existing `_turnDurationSec`). See §"Amendments — 2026-04-25
(lhokon phase introduction)" for the full amendment trail.*
