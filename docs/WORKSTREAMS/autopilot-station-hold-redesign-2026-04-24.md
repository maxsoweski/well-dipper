# Workstream: Autopilot STATION-hold redesign — V1 motion-model implementation (2026-04-24)

## Status

**`Closed — superseded by autopilot-camera-ship-decoupling-2026-04-25
(Director audit §A4, 2026-04-25)`.**

The recording captured at V1 Attempt 1 close
(`recordings/autopilot-station-hold-v1-attempt1.webm`) **passes the
V1-Attempt-1 ACs as written** — AC #1 path-linearity, AC #2 onset
at `min(10R, cruise-distance ceiling)`, AC #3 felt-fill, AC #4 body-
lock, AC #5 (pre-shake basis) Pattern B, AC #6 shake placement, AC
#7 ship-orientation contract, AC #9 stub removal, AC #10 dispatch
preserved all evaluate to PASS in
`recordings/v1-attempt1-ac-report.json` + the pre-shake re-sample
report `recordings/v1-ac5-preshake-report.json`. **But the V1 spec
itself was wrong.** The 2026-04-24 Q3 *aim-once-at-intercept, fly
straight* rule on the ship axis composed with the V1 ESTABLISHING
*"camera looks down ship.forward + shake on top"* rule on the camera
axis to produce a tour where bodies drift toward the edge of frame
during cruise legs — the recording shows the correct AC behavior
of a wrong spec.

Director audit §A4 (2026-04-25) reverses both halves of the
coupling: camera reads target-body position directly each frame
(pursuit-curve); ship re-aims at predicted intercept each frame
(closed-form quadratic solver). The two-axis architecture is
preserved and *more* independent under §A4 than under the 2026-04-24
reframe. AC #1 redrawn as a hit-the-target tolerance bound; AC #5
invalidated and split into AC #5a (camera tracks body) + AC #5b
(ship aims at predicted intercept); AC #7 preserved with consumer
set narrowed (camera dropped, shake retained).

**Do NOT flip this workstream to Shipped.** The Attempt 1 commits
stay in git as the prior-cycle reference, but the workstream's
acceptance gate is dissolved by the §A4 redesign — Shipped on this
brief would record passage of an invalidated spec. The next
implementation pass against the §A4-redesigned ACs lives in the
new workstream:

- **`docs/WORKSTREAMS/autopilot-camera-ship-decoupling-2026-04-25.md`**
  — V1 §A4 redesign (camera = pursuit-curve on target body; ship =
  predicted-intercept re-aim). Authored 2026-04-25 by PM under
  Director audit §A4.

The `(α)` stub recording at
`screenshots/max-recordings/stub-saturn-v4-2026-04-24.fixed.webm`
remains the felt-experience reference for STATION-A jumpscare
arrival; the new workstream's AC #8 inherits that reference.

The Pattern A leg-boundary spike captured by the follow-up stub
(`docs/WORKSTREAMS/autopilot-leg-boundary-orientation-spike-followup.md`)
is **structurally dissolved** under §A4 — see closure note in that
brief.

---

**Prior closing status (preserved for history): `VERIFIED_PENDING_MAX
e6659d0` (V1 Attempt-1 closing — code + docs + AC #5 pre-shake
re-sample bundled at `e6659d0`; awaiting Max's recording review for
AC #8 before flip to Shipped).**

V1 Attempt 1 close-out gates (Director audit 2026-04-25 §A3) status:

- ✅ AC #2 brief amendment landed (`min(10R, cruise-distance ceiling)`
  per §A3; commit `e6659d0`).
- ✅ AC #5 brief amendment landed (pre-shake basis per §A3;
  commit `e6659d0`).
- ✅ AC #5 pre-shake telemetry re-sample run — Pattern B cleared
  (15 → 0 violations attributable to shake measurement artifact;
  see `recordings/v1-ac5-preshake-report.json`).
- ✅ AC #1 / #3 / #4 / #6 / #7 / #9 PASS in
  `recordings/v1-attempt1-ac-report.json`.
- ✅ AC #10 contract-confirmed: `CameraChoreographer.setShip`
  preserves legacy framing-state path (the `CameraMode` enum
  dispatch is intact; V1 selects `ESTABLISHING`).
- ⏸ AC #8 awaits Max's morning recording review at
  `recordings/autopilot-station-hold-v1-attempt1.webm` (127 MB,
  ~4 min @ 30 fps).

Pattern A (single-frame leg-boundary orientation spike) **persisted
post-resample** at 2 spikes across 3 legs in the pre-shake re-sample
(`recordings/v1-ac5-preshake-report.json`) — confirms it is a real
ordering bug, not a sample-timing artifact. Per Director audit §A3:
*"do not block status flip on it (it's punted to follow-up)."* The
follow-up workstream stub at
`docs/WORKSTREAMS/autopilot-leg-boundary-orientation-spike-followup.md`
**lights up** as the next workstream.

---

**Prior status (preserved for history): `APPROVED — Director audit
landed 2026-04-24` (authored 2026-04-24 by PM; audit at
`~/.claude/state/dev-collab/audits/autopilot-station-hold-redesign-
2026-04-24.md`; amendments §A1 + §A2 applied at brief-landing
commit).**

Director audit verdict: **APPROVED with two amendments + four
substantive rulings on the surfaced items.** The four PM-surfaced
items resolved as: (a) ship-orientation precondition — `forward`/`up`
accessors on the ship object are the right contract shape; orientation
is **settable by the autopilot**, not derived (AC #7 contract item 2
tightened §A2.2); (b) AC #9 stub-removal contract — accurate; one
scope addition added as AC #9.10 (§A1) covering function-body removal,
not just the `window.X = …` accessor lines; (c) `NavigationSubsystem`
retention call — **retire**, do not repurpose; replace with a thinner
V1 motion evaluator, `git rm` the old file in the same commit set
(§A2.3); (d) AC phrasing fidelity — all nine phase-sourced ACs match
the feature doc at `20ef423` verbatim; AC #1 *Note* tightened to drop
rescope contingency (aim-once is canonical for V1, settled by Director
ruling) (§A2.1). Handoff §11 ship-object-location TBD resolved by
PM code-read into a definite answer (§A2.4).

**Cycle-budget framing — Director-confirmed.** V1 = one Attempt 1
with parameter-tune budget for AC #3 (felt-fill 60%) and AC #2
(DECEL cubic-ease curve constants). No multi-cycle budget. Trigger
for Attempt 2: mechanism-class failure only (escalate to Director;
do not iterate within this workstream).

**Director check-in cadence.** Director audits next at first
`VERIFIED_PENDING_MAX <sha>`. No mid-execution checkpoint required.
Surface to PM if working-Claude hits unanticipated structural
surface (e.g., ship-object location entangled with warp-exit handoff);
PM decides whether to bring Director in early.

**Structural reframe, not a cycle continuation.** This workstream is
**not** cycle 5 of Loop (a). Cycles 1–4 of the live-feedback Loop (a)
are closed (`SUPERSEDED 2026-04-24`, see
`docs/WORKSTREAMS/autopilot-live-feedback-2026-04-24.md` §"Close-out")
— the stub validated in one afternoon that the upstream motion model
was the bug, not the filter class. The cycle counter on this
workstream starts fresh at Attempt 1. The cycle-4 spring-filter
implementation is preserved at `git stash@{0}` as prior-art for the
V-later STATION-B / ORBIT-mode follow-on.

**Substrate carried forward from live-feedback (both `Shipped` at
close-out):**

- **Loop (b) `Shipped 3ba1159`** — two-anchor velocity blend with
  live per-body read. The *read live per-body position rather than
  T₀ extrapolation* mechanism is the input to the V1 CRUISE re-aim
  rule (feature doc §"Per-phase criteria — ship axis" §CRUISE).
- **Loop (c) `Shipped 273e725`** — per-sign legMax pullback shake-
  onset trigger. The local-maximum detector on `smoothedAbsDSpeed`
  is exactly the gate the V1 CRUISE→APPROACH shake needs (feature
  doc §"Gravity drives" V1 scope).

**Pointer bookkeeping.** `~/.claude/state/dev-collab/active-workstream`
flips to `autopilot-station-hold-redesign-2026-04-24` on the commit
that lands this brief. Gate edit count stays at 0; Director audit
increments `last_audit_sha` to the post-audit HEAD before
working-Claude's first `Edit`/`Write` fires.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
`bdeb0ff`, **amended 2026-04-24 at `20ef423`** (V1 motion-model reframe
to STATION-hold). The load-bearing feature-doc sections for this
workstream:

- **§"Revision history" 2026-04-24 entry** — names the structural
  change: V1 ship axis collapses to CRUISE → DECEL → HOLD; V1 camera
  axis collapses to "camera looks down ship forward + shake on top";
  `STATION` bifurcates into `STATION-A` (V1 hold) and `STATION-B`
  (V-later orbit); new precondition surfaces (ship orientation
  load-bearing).
- **§"Per-phase criteria — ship axis" §CRUISE, §APPROACH, §STATION-A**
  — authored V1 criteria this workstream implements.
- **§"Per-phase criterion — camera axis (V1)"** — the thin V1
  `ESTABLISHING` mode (ship-forward + shake, nothing else).
- **§"Per-phase criterion — camera axis (V1)" §Precondition** — the
  ship-orientation load-bearing statement. This precondition does
  **not** exist in the current codebase; this workstream scopes
  establishing it.
- **§"Gravity drives" V1 scope** — ACCEL shake at CRUISE onset, DECEL
  shake at APPROACH onset, pure-reverse shape, no shake during smooth
  motion.
- **§"Failure criteria / broken states"** — the implementation's
  verifiable-against negative criteria.
- **§"V1 / V-later triage"** — what ships in V1 vs. what must graft
  on without architectural rewrite.

The motion model is authored at the feature-doc level; this
workstream's job is implementation against that spec. No new feature
criteria are authored here.

## Implementation plan

**N/A (feature-amendment is workstream-sized for V1 implementation).**
The amended feature doc is the architectural specification. No
separate `docs/PLAN_*.md` needed — the motion model is already fully
specified by the §"Per-phase criteria — ship axis" + §"Per-phase
criterion — camera axis (V1)" + §"Gravity drives" sections at commit
`20ef423`.

Anticipated edit surfaces (subject to working-Claude's first-pass
code read + Director audit):

- **`src/main.js`** — the stub lives here (L1251–L1402 + animate-loop
  branch at L6595–L6893 + gate at L6893). V1 replaces the stub with
  the production autopilot path; stub scaffolding is removed in the
  same commit set per AC #9.
- **`src/auto/NavigationSubsystem.js`** — **Director ruling
  2026-04-24: retire.** The Hermite travel-curve + seam-blend +
  orbit-arc machinery is dead by construction under V1: feature doc
  §CRUISE (aim-once, fly straight) and §APPROACH (hard-onset 10R +
  cubic-ease) do not need Hermite curves, seam-blend across phase
  boundaries, or composed-with-orbit-arc shape. The 1117-line file's
  purpose-of-existing was the multi-phase composed-motion model V1
  explicitly abandons. Replace with a thinner V1 motion evaluator
  (working-Claude names the new module — e.g., `MotionPlanner.js`
  or `AutopilotMotion.js`, or a renamed thinner module). Preserve
  any target-body-resolution / intercept-point / unit-conversion
  shape during the lift; do **not** lift the Hermite-curve /
  orbit-arc / seam-blend code. `git rm` the old file in the same
  commit set. Bookkeeping note: the cycle-4 spring filter at
  `git stash@{0}` is preserved separately for the V-later
  STATION-B / ORBIT-mode workstream; the retired
  `NavigationSubsystem.js` itself is committed-removed (git history
  preserves it for V-later reference; an explicit stash is
  unnecessary). If working-Claude's first-pass code read surfaces
  evidence that contradicts retire (e.g., critical substrate V1
  cannot cleanly re-derive in a thin module), surface to PM +
  Director — the ruling can revise to "repurpose with stripped
  Hermite layer" if evidence demands it. Default direction is
  retire.
- **`src/auto/CameraChoreographer.js`** — V1 `ESTABLISHING` collapses
  to "camera looks down ship-forward + shake on top." Existing
  framing-state machinery (LINGERING / TRACKING / PANNING_AHEAD) is
  V-later per feature doc §"Per-phase criterion — camera axis
  (V1)": *"Does NOT linger on a receding subject. V-later. Does NOT
  pan forward toward an incoming target. V-later."* Working-Claude
  decides: strip the V-later branches, or leave them dormant behind
  a camera-mode dispatch gate. The `CameraMode` enum dispatch
  itself stays (feature doc §"V1 architectural affordances": *"V1
  implements a `CameraMode` enum ... even if only one value is ever
  selected"*).
- **`src/auto/ShipChoreographer.js`** — Loop (c)'s shake-onset
  detector is kept; the trigger gates on the CRUISE→APPROACH
  boundary (the single V1 shake event on the decel side per feature
  doc §"Gravity drives" V1 scope). ACCEL shake at CRUISE onset is
  the mirror event; per-leg fire budget stays.
- **Ship-model touch surface** — location TBD by working-Claude's
  first code read. The ship model requires a defined
  front/back/top/bottom orientation readable by the camera system
  (feature doc §Precondition). Working-Claude locates the ship
  object's current representation in the scene graph, establishes
  the orientation contract, wires it as a property consumed by
  `CameraChoreographer` and by ACCEL/DECEL shake (which acts on
  ship-mesh additive perturbation). Clean abstraction — the
  orientation is a property of the ship, not of the autopilot.

If the first-pass implementation surfaces that one of these surfaces
needs a structural change not anticipated here, escalate to PM — that's
scope widening the brief must record.

## Scope statement

**Implement the V1 motion model** authored at `docs/FEATURES/autopilot.md`
`20ef423`: a straight-line CRUISE with aim-once-at-intercept + per-frame
re-aim; a hard-onset aggressive DECEL triggered at 10× body radius with
cubic-ease profile; a body-locked STATION-A hold at felt-fill ~60% of
screen; a camera that looks down the ship's forward vector with ACCEL
shake at CRUISE onset and DECEL shake at APPROACH onset (pure-reverse
shape, no shake during smooth motion); and a defined ship-orientation
precondition that makes the ship's forward vector a readable property
of the ship model at all times, including during STATION-A rest.

The scope includes **removing the (α) stub scaffolding** in the same
commit set that lands the V1 implementation — the stub stays in tree
until this workstream's first `VERIFIED_PENDING_MAX` recording matches
the `screenshots/max-recordings/stub-saturn-v4-2026-04-24.fixed.webm`
felt experience under Max's eye, at which point it is redundant
(Director §2f).

The scope is bounded: **one autopilot leg** — depart a held body,
cruise, decelerate, hold at the next body. Multi-body tour scheduling
is untouched (autoNav stays as-is); this workstream is about per-leg
motion execution. STATION-B orbit mode, linger, pan-ahead, departure
arc, OOI runtime queries, and `SHOWCASE` / `ROVING` camera modes are
all V-later per feature-doc triage and out of scope here.

**Structural reframe bookkeeping.** The live-feedback Loop (a) cycle
count (4) is archived. This workstream's Attempt 1 starts fresh —
Director §7 cycle budget applies on its own axis (Attempt-class
redesigns are different from parameter-tuning cycles; felt-fill 60%
tuning falls under the parameter-tune budget, not an Attempt-class
escalation).

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Vision / Core Experience / Discover
— *"Every system is different. Finding a terrestrial world or an alien
megastructure is rare and meaningful."* The STATION-hold V1 is the
moment the game *delivers* that felt experience: the ship has flown
to a body, the body looms huge, the player just stays there. The
jumpscare arrival (feature doc §"Per-phase criteria — `APPROACH`")
is the cinematographic punctuation that makes the hold feel like an
event, not a glide-in.

Advances `docs/GAME_BIBLE.md` §8H Propulsion & Travel Landscape
(canonized 2026-04-20) — the gravity-drive shake at ACCEL/DECEL
boundaries is the in-fiction tell of the drive at the edge of its
compensation envelope. V1 gets the two shake events to their correct
load-bearing placements (CRUISE onset + APPROACH onset), making the
drive's lore visible at the exact moments the model requires it.

Advances `docs/FEATURES/autopilot.md` §"Heart's desire" — "Wonder
and interest. Like a human navigator + cinematographer taking viewers
on a tour of the galaxy, showing the most interesting things in their
immediate environment." V1 is the minimum-viable tour: fly to a body,
hold there. Richer camera authoring (linger / pan-ahead / SHOWCASE /
ROVING) grafts on top in V-later workstreams without architectural
rewrite — the two-axis phase structure (ship axis + camera axis) is
the V1-mandatory affordance that keeps those paths open.

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy Principle 6
— First Principles Over Patches — by structural construction, not
by argument. The close-out lesson from live-feedback Loop (a) is:
four cycles of patching the filter class failed because the upstream
motion model was the bug. This workstream implements the upstream
simplification; by construction, the downstream filter pathologies
that cycles 1–4 chased have nothing to manifest on.

## Acceptance criteria

Phase-sourced where the feature doc authors a phase; contract-shaped
(per `docs/PERSONAS/pm.md` §"Per-phase AC rule carve-out") for the
ship-orientation precondition + the stub-removal deliverable, which
have no phase-quote surface.

### AC #1 — CRUISE path linearity (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §CRUISE)

Quoted criterion: *"Aim-once-at-intercept, fly straight. At CRUISE
onset, the ship aims at the target body's current position and flies
a straight line. No per-frame re-aim during the phase."*

Verification: per-frame telemetry capture during a CRUISE phase.
Path linearity is the maximum orthogonal deviation of the ship's
position from the straight line connecting CRUISE-onset position
and CRUISE-end position. **Bound: ≤ 0.05 scene units** over the
entire CRUISE duration, across a Sol tour (Mercury → Venus → Earth
→ Mars → Jupiter → Saturn — representative mix of body scales).
Moon-orbiting-planet body motion during CRUISE may shift the target
body's position slightly; re-aim is CRUISE-onset only, so the
straight-line bound holds against the CRUISE-onset aim, not against
the moving target.

*Note.* Feature doc L76 is canonical: aim-once-at-intercept is
the V1 rule; per-frame re-aim is explicit V-later (feature doc
L154). The stub used per-frame re-aim as Loop (b) substrate-
preserving demonstration; V1 reverts to aim-once. AC #1's
path-linearity bound measures the aim-once geometry directly:
aim-once produces a straight path (deviation ≤ 0.05u against the
CRUISE-onset aim-line); per-frame re-aim curves the path toward
the moving body and would fail this bound by construction. The
aim-once write happens at CRUISE-onset (the autopilot writes
`ship.forward = (target.position − ship.position).normalize()`
once at phase entry); the trajectory does not re-aim mid-flight.
*Director ruling 2026-04-24 settles the ambiguity in this AC.*

### AC #2 — APPROACH onset at min(10R, cruise-distance ceiling) (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §APPROACH; **amended §A3 — 2026-04-25 V1 Attempt 1 closing audit**)

Quoted criterion: *"Onset rule: fixed distance from the body.
APPROACH begins when the ship reaches 10× the body's radius (V1
starting value — tunable during lab iteration, not expected to vary
at shipping). No ramp, no gradual; CRUISE → APPROACH is a hard
velocity onset at the 10R threshold."*

**Amended onset rule (V1 Attempt 1):** APPROACH onset at **`min(10R,
cruise-distance ceiling)`**. The fallback gate in
`_tickCruise` (`distTraveled >= this._cruiseDistance`) is the cruise-
distance ceiling and is a correct V1 guard against the drift-from-
aim-once mode for asteroid-class bodies where 10R is sub-frame-tiny.
The feature doc §APPROACH already accepts the rule as *"tunable
during lab iteration"*; the cruise-distance ceiling is exactly that
tune — a body-scale-aware floor on the geometric threshold. Director
audit verdict (2026-04-25, V1 Attempt 1 closing): **APPROVED.** The
amendment is workstream-local; feature doc §APPROACH stands without
edit (it already authors the threshold as tunable).

Empirical surface (V1 Attempt 1 telemetry, 12-leg complete sample,
`recordings/v1-attempt1-ac-report.json`): leg-24 telemetry shows
`distAtTrans = 1.17u`, `10R = 0.0072u` — the 10R threshold is sub-
frame-tiny for asteroid-class bodies, and the cruise-distance
ceiling provides the body-scale-aware floor. The ceiling fires
when 10R would be unreachable within a sane cruise-traversal
budget; otherwise the 10R rule fires, preserving the original
intent for moon-class and larger bodies.

Verification: per-frame telemetry capture. In the same frame window
where `distance(ship, body) ≤ 10 × body.radius` **OR** `distTraveled
≥ cruiseDistance` first holds (whichever fires first), the phase
field transitions from `CRUISE` to `APPROACH` **and** the shake-
event log records one DECEL shake event. Tolerance: within 1 frame
of the geometric threshold crossing (dt-sampling artifact). No
APPROACH entry **before** either threshold crossing; no APPROACH
entry **more than 1 frame after**. Verified across every leg of the
Sol tour capture.

### AC #3 — STATION-A felt-fill ~60% of screen (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §STATION-A)

Quoted criterion: *"Felt-fill framing, not numeric ratio. The body
fills ~60% of the screen at hold."*

Verification: at the moment the phase field stabilizes into
`STATION-A` (first frame where `shipVelocity ≈ 0` AND phase =
`STATION-A`), compute the body's apparent angular diameter
(`2 × atan(radius / distToBody)`) and divide by the camera's vertical
FOV (in radians). **Bound: 0.50 ≤ fill ratio ≤ 0.70.** Verified
across body scales (moon-class, Earth-class, gas giant) — a moon-
class target and a gas-giant target in the Sol tour both satisfy the
range. If the range is satisfied for Earth-class and gas giants but
not moons (or vice versa), the hold-distance rule is scaling wrong
— see feature doc §Open questions: *"pick the simplest measure
that tracks felt intent across moons, Earth-size, and gas giants."*

### AC #4 — STATION-A body-lock invariance (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §STATION-A)

Quoted criterion: *"Held until the next mode activates... STATION-A
has orbital motion — V1 is a hold, not an orbit"* (negative
criterion from §"Failure criteria / broken states").

Verification: during STATION-A, per-frame telemetry samples
`distance(ship, body)` at each frame. **Bound: `max(distToBody) -
min(distToBody) ≤ 0.001 scene units`** over a minimum 5-second hold
window. This measures body-lock: camera/ship stays at constant
offset from the body as the body moves through world space
(moon-orbit, planet-orbit-around-star). The held ship does not
drift relative to the body, does not orbit, does not wobble.

### AC #5 — Camera forward ≡ ship forward (pre-shake basis) (per `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera axis (V1)" §ESTABLISHING; **amended §A3 — 2026-04-25 V1 Attempt 1 closing audit**)

Quoted criterion: *"Looks down the ship's forward vector. The
camera orientation is derived from the ship's defined forward
direction, not from the target body or from any independent
compositional anchor."*

**Amended threshold contract (V1 Attempt 1):** AC #5 measures
**pre-shake camera basis** — `camera.quaternion` snapshotted **after**
`camera.lookAt(cameraChoreographer.currentLookAtTarget)` and **before**
the shake-quaternion multiply. The implementation chose rotation
(not position-additive) for shake, which is contemplated in the
original AC text ("If shake is implemented as rotation, this AC's
bound relaxes to ≥ 0.99 (small-angle perturbation)"); the pre-shake
basis is the cleaner contract because the feature doc §"Per-phase
criterion — camera axis (V1)" + AC #5's own text already author
shake as additive-on-top of the look-at orientation. Director audit
verdict (2026-04-25, V1 Attempt 1 closing): **APPROVED.** Sampling
pre-shake gives the load-bearing measurement (does the camera's
ship-forward alignment hold under the V1 contract?) without the
small-angle perturbation eating the bound's headroom.

Verification: per-frame telemetry samples `ship.forward` (unit) and
`cameraForwardPreShake` (unit) — the latter read from
`camera.quaternion` **immediately after**
`camera.lookAt(cameraChoreographer.currentLookAtTarget)` and
**immediately before** the shake-quaternion multiply (main.js
animate loop, V1 STATION-hold branch). **Bound: `dot(shipForward,
cameraForwardPreShake) ≥ 0.9999` every frame, all phases (CRUISE,
APPROACH, STATION-A).** Working-Claude documents the pre-shake
sampling site in the commit; the post-shake `camera.forward` is
not the contract surface and is not measured here.

### AC #6 — Shake event placement (per `docs/FEATURES/autopilot.md` §"Gravity drives" V1 scope)

Quoted criterion: *"ACCEL shake — fires at CRUISE onset (departure
from STATION-A). DECEL shake — fires at APPROACH onset (10× body
radius). ACCEL ≡ reverse(DECEL) for V1. No shake during smooth
motion — no shake mid-CRUISE, no shake during STATION-A hold."*

Verification: shake-event telemetry log (existing infrastructure
from Loop (c)). Per leg, the log contains **exactly two entries**:
one event labeled `ACCEL` at the CRUISE-onset frame, one event
labeled `DECEL` at the APPROACH-onset frame (AC #2's same-frame
window). **No shake events during CRUISE (t ∈ (CRUISE-onset,
APPROACH-onset))**. **No shake events during STATION-A.** The
ACCEL event's envelope shape is the signed reverse of the DECEL
event's envelope (same magnitude profile, opposite sign — feature
doc: *"same shape, opposite sign"*). Verified across the Sol tour.

### AC #7 — Ship orientation is a defined property of the ship model (contract-shaped, per `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera axis (V1)" §Precondition)

Feature doc: *"V1's camera reads the ship's forward vector. This
requires the ship model to have a defined front/back/top/bottom
orientation in the scene graph. The orientation does not have to be
visible to the player (no chevrons, no decals required), but it
must exist as an authored property of the ship object, not derived
per-frame from motion direction."*

Contract (all must hold):

1. The ship object exposes a stable `forward` (Vector3, unit) and
   `up` (Vector3, unit) accessor. `right` derives from `forward ×
   up`. Accessors are readable at all times — during CRUISE, during
   APPROACH, during STATION-A hold (where ship velocity = 0 and a
   motion-derived fallback would have no signal to read).
2. The orientation is **not derived** from ship velocity or
   position. At rest, `forward` returns the authored forward axis.
   Between frames, `forward` can change only via explicit
   orientation update (phase transition, player override), not via
   motion-direction re-derivation. The autopilot **sets**
   orientation by writing the accessor; the ship holds the written
   orientation until the next write. The implementation site choice
   (where the orientation state lives, which subsystem writes it)
   is working-Claude's call as long as the accessor surface holds.
   Camera reads the SET orientation; orientation is not computed
   on-the-fly from velocity, and not inferred from motion state.
3. The `CameraChoreographer` reads the accessors; it does not
   fall back to `normalize(velocity)` or `normalize(position -
   prevPosition)` at any code path.
4. The ACCEL/DECEL shake mechanism (ship-mesh additive perturbation)
   reads the accessors to compute its perturbation axis; it does
   not fall back to motion-direction derivation.

Verification: code inspection by Director (AC #7 is contract-
shaped; no telemetry measurement). Director audit checks the ship-
object API at its implementation site, walks `CameraChoreographer`
and `ShipChoreographer` call sites, confirms no motion-derivation
fallback anywhere.

### AC #8 — STATION-A jumpscare-arrival felt-experience (per `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" §APPROACH, §STATION-A)

Quoted criterion (Max's verbatim, feature doc §APPROACH):

> *"You are zooming straight towards the planet or the moon,
> whatever it is. It gets closer and closer to you and right where
> it feels like you're about to slam into it and blow up. The
> camera shakes and you decelerate extremely quickly, such that
> it's almost like it jumpscares, like it jumps up into your vision.
> And then you're just hanging there in front of the planet. It
> looms huge in front of you. And you just stay there. You stay
> stationary until the next mode activates, either manually or
> automatically."*

Verification: **motion-class recording, Max-evaluated**, per
`docs/MAX_RECORDING_PROTOCOL.md` and
`feedback_motion-evidence-for-motion-features.md`. A Sol tour
capture (Mercury → at least Jupiter; representative body scale
range) recorded at 60fps, delivered to Max, evaluated against the
quoted phrasing. Specific felt beats Max reads against:

- "zooming straight towards the planet" — CRUISE feels purposeful
  and direct, not meandering.
- "right where it feels like you're about to slam into it and
  blow up" — APPROACH-onset tension is present at the 10R
  threshold; the body has resolved into real 3D geometry (not
  billboard), and the ship is closing fast.
- "the camera shakes and you decelerate extremely quickly" —
  DECEL shake fires simultaneously with the aggressive
  deceleration; the motion reads as jumpscare, not glide-in.
- "looms huge in front of you" — STATION-A body fills the frame
  (AC #3's ~60% is the numerical floor; felt-fill is the real
  criterion).
- "you just stay there" — STATION-A holds (AC #4's body-lock
  invariance is the numerical floor; felt-stillness is the real
  criterion).

Shipped flip waits on this AC; Director audit closes at
`VERIFIED_PENDING_MAX <sha>` once the code + doc + recording are
on disk, Shipped flips to `Shipped <sha> — verified against
<recording-path>` only after Max has watched and confirmed.

**Negative felt criteria (reject conditions):** reads as "glide
in and settle" (feature doc §"Failure criteria": *"STATION-A reads
as 'glide in and settle' — violates the jumpscare-arrival felt
criterion"*); DECEL shake is missing or fires at wrong moment
(AC #6's numerical check catches this but Max's read is the
acceptance signal); body doesn't feel huge (AC #3's 60% numerical
floor is met but the hold still reads distant — surfaces a feature-
doc open question on the hold-distance measure, not a reject on
this workstream).

### AC #9 — Stub scaffolding removed (contract-shaped, per `~/.claude/state/dev-collab/audits/autopilot-live-feedback-2026-04-24.md` §2f removal criterion)

Director §2f: *"Removal criterion: the stub goes when the new
workstream's first VERIFIED_PENDING_MAX recording matches the (α)
recording's felt experience under Max's eye. At that point the
stub is redundant; commit-removed in the same commit that lands
the restructure. PM brief must include this removal as an explicit
deliverable so it doesn't survive into the merged branch as
forgotten dead code."*

Contract (all must hold at the commit that lands V1):

1. `window._stubFly` removed from `src/main.js`.
2. `window._stubAutopilot` removed from `src/main.js`.
3. `window._stubFlyIdx` removed from `src/main.js`.
4. `window._stubStop` removed from `src/main.js`.
5. `window._listBodies` removed from `src/main.js`.
6. `window._settings` removed from `src/main.js` (debug-only
   accessor introduced for the stub).
7. `window._system` removed from `src/main.js` (debug-only
   accessor introduced for the stub).
8. The animate-loop stub branch at `src/main.js` L6595–L6893
   removed — the `if (window._stubAutopilot?.active && ...)`
   gate and its enclosed update logic are gone.
9. The `cameraController.update()` gate at L6893 (the
   `!window._stubAutopilot?.active` check) removed — the
   production camera update path is no longer conditionally
   suppressed.
10. The stub-comment-bracketed function block at `src/main.js`
    L1251–L1413 (encompassing the `window._stubFly` definition,
    the `window._stubAutopilot` initialization, the
    `window._stubStop` definition, the `window._listBodies`
    definition, and the `window._stubFlyIdx` definition) is
    removed in its entirety. No orphan function bodies survive.
    Items 1–7 above remove the `window.X = …` accessor lines;
    this item removes the underlying function bodies + comment
    bracket so no dead code remains attached to the
    no-longer-exposed names.

Verification: grep-based contract audit at the commit. Director
walks the grep output, confirms zero residuals. Specifically:
`grep -n "window\._stub" src/main.js` returns zero hits
post-commit (today: 13 hits at `690ea81`). Commit message
names AC #9 explicitly.

### AC #10 — Two-axis architecture preserved (per `docs/FEATURES/autopilot.md` §"V1 architectural affordances")

Quoted criterion: *"SHOWCASE / ROVING camera modes → the camera-
axis code path must be a first-class selector, not an if-branch
inside ESTABLISHING. V1 implements a `CameraMode` enum (`ESTABLISHING`
/ `SHOWCASE` / `ROVING`) even if only one value is ever selected,
and routes camera updates through a dispatch that can accept any
of the three. Adding `SHOWCASE` later is a new branch, not a
restructure."*

Verification: code inspection. The `CameraMode` enum + dispatch
surface survives (currently landed by
`docs/WORKSTREAMS/autopilot-camera-axis-retirement-2026-04-23.md`).
V1 selects `ESTABLISHING`; `SHOWCASE` and `ROVING` branches compile
and route but author no behavior. The `ESTABLISHING` mode itself
collapses to "ship forward + shake" but routes through the
dispatch, not an if-branch. Director audits at the audit gate.

## Principles that apply

From `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 6 — First Principles Over Patches.** Load-bearing
  because this workstream exists by Principle-6 escalation. Cycles
  1–4 of live-feedback Loop (a) patched a symptom class (camera
  filter pathologies) against an upstream the patch couldn't reach;
  the stub validated that the upstream itself was wrong. This
  workstream implements the upstream simplification — by
  construction, the downstream pathologies that cycles 1–4 chased
  have no surface to manifest on. Violation in **this workstream**
  would look like: working-Claude adding a camera filter or
  angular-rate clamp because a new symptom appears; the correct
  move is to surface the symptom to PM + Director, which almost
  certainly means the motion model needs re-examination, not
  filtering.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Load-bearing for AC #7 (ship-orientation contract)
  and for AC #5 (camera-forward is ship-forward). The ship-
  orientation is produced by the ship model and consumed by the
  camera + shake systems. The pipeline is one-directional: ship →
  camera. Reverse flow (camera computing orientation from motion
  and writing back to the ship) is the Principle-5 violation and
  is what AC #7.3 + AC #7.4 guard against.

- **Principle 2 — No Tack-On Systems.** Load-bearing for the
  ship-orientation precondition (AC #7). The orientation is a
  **property of the ship**, not a property of the autopilot.
  Wiring it in as autopilot-specific state (e.g., `autopilot.ship
  Forward`) would tack the orientation onto the autopilot
  subsystem; the correct placement is on the ship object itself,
  consumable by the autopilot and by any other system (manual
  flight, combat, on-foot rendering) that needs to read
  ship-forward. Violation would look like: orientation defined
  inside `CameraChoreographer` rather than on the ship object.

- **Principle 1 — The Bible Is the Goal.** Load-bearing because V1
  implementation must match the amended feature doc verbatim —
  not a close-enough interpretation of it. The felt criteria (AC
  #8's jumpscare, AC #3's felt-fill, AC #6's shake placement) are
  the bible-level specification. Violation would look like
  well-meaning softening ("make the decel less aggressive, it
  feels jarring") that the feature doc explicitly rejects
  (§"Failure criteria": *"gentle close-in with no visible
  deceleration beat is the failure mode"*).

## Drift risks

- **Risk: Stub-creep.** Extending the stub instead of replacing it
  — adding a new `window._stub*` hook, patching a gate exception,
  growing the animate-loop stub branch to "handle one more case."
  **Why it happens:** the stub is the validated reference; extending
  it feels less risky than rewriting. Director §2f flagged this
  explicitly: *"working-Claude must NOT add to the stub. No new
  `window._stub*` hooks. No new gate exceptions. The stub is a
  frozen calibration point; growing it would re-introduce the
  'patch on top of patch' failure mode at a different altitude."*
  **Guard:** V1 implementation is authored in production code paths
  (`src/auto/*`, not `src/main.js` stub hooks). AC #9 forces the
  stub's removal in the same commit that lands V1 — an extension
  to the stub would have to be removed in that same commit,
  surfacing the contradiction. If working-Claude finds themselves
  wanting to patch the stub, stop and escalate to Director.

- **Risk: Ship-orientation wired into autopilot instead of onto the
  ship.** The convenient path is `autopilot.shipForward` or
  `CameraChoreographer._shipForward` — define orientation state
  inside the autopilot subsystem because that's where it's
  consumed. **Why it happens:** locality bias; the autopilot is the
  thing reading it, so it feels natural to store it there.
  **Guard:** AC #7 contract explicitly places orientation on the
  ship object, not on any autopilot subsystem. Director audit on
  the implementation walks the ship-object API surface and the
  camera/shake call sites to confirm the placement. Violation:
  orientation defined inside `CameraChoreographer.js` or
  `NavigationSubsystem.js`; correct placement: on the ship object
  (location TBD by working-Claude's code read).

- **Risk: Cycle-3 / cycle-4 clamp-class instinct.** Working-Claude
  notices a camera artifact (small wobble on APPROACH, jerk at
  STATION-A entry, drift during CRUISE) and reaches for a
  rate-clamp or filter. **Why it happens:** muscle memory from the
  live-feedback cycles. The clamp class is dead by construction
  under this model — the composed-signal-from-three-weighted-
  sources that produced the cycle-1/2/3 violations doesn't exist
  in V1 (feature doc §"Per-phase criterion — camera axis (V1)":
  camera = ship-forward + shake, nothing composed). If a symptom
  appears, it's signal that the motion model needs examination,
  not filtering. **Guard:** if working-Claude finds themselves
  reaching for a clamp/filter/damper, stop and surface to PM +
  Director. Likely interpretation: a V-later camera move is
  leaking into V1, or the ship-orientation contract (AC #7) is
  violated at a code path that reads velocity instead of the
  authored forward vector.

- **Risk: V-later camera authoring smuggled into V1.** Linger on
  receding subject, pan-ahead toward incoming target, departure
  arc — all V-later per feature doc §"Per-phase criterion —
  camera axis (V1)". **Why it happens:** the existing
  `CameraChoreographer` has LINGERING / TRACKING / PANNING_AHEAD
  branches from WS 3; leaving them active "because they're already
  there and kinda work" is the easy path; the hard path is
  collapsing `ESTABLISHING` to the V1 minimum. **Guard:** feature
  doc §"Drift risks" entry #7 names this exactly: *"V-later camera
  authoring (linger / pan-ahead / departure arc) smuggled into V1.
  The 2026-04-24 amendment collapsed V1 `ESTABLISHING` to a
  minimum. A well-meaning implementation pass that partially
  authors linger or pan-ahead 'because the architecture is there'
  re-imports the V-later scope V1 deliberately discarded. V1
  `ESTABLISHING` is: forward vector + shake, nothing else."* AC
  #5's camera-forward ≡ ship-forward invariant (dot ≥ 0.9999)
  catches linger / pan-ahead by construction — both author camera
  orientation independent of ship-forward, failing the bound.

- **Risk: STATION-A drifts because reference frame leaks velocity.**
  Keeping the ship exactly at rest in a scene with moving bodies
  (moons orbit planets, planets orbit the star) is fiddly — origin
  rebasing, parent-body motion, or downstream integrator writes
  can all re-author non-zero velocity. Feature doc §"Drift risks"
  entry #8 names this: *"STATION-A drifts toward 'orbit' by
  accident... Implementation must explicitly pin the ship to the
  held-pose reference frame, not just set velocity = 0 once and
  let downstream subsystems re-author it."* **Guard:** AC #4's
  body-lock invariance (distance-to-body stable within 0.001u)
  catches drift numerically. Implementation pattern: STATION-A
  pins `ship.position = body.position + holdOffset` each frame,
  where `holdOffset` is captured at STATION-A entry and doesn't
  re-derive from velocity integration.

- **Risk: NavigationSubsystem retention decision made silently.**
  The architectural call on `NavigationSubsystem.js` (retire the
  Hermite machinery vs. repurpose it) has downstream implications
  for the V-later ORBIT-mode / STATION-B workstream and for
  manual-mode "burn to" (which uses the same nav subsystem per
  feature doc §"Manual override — two-layer architecture").
  **Why it happens:** under implementation pressure the call gets
  made by default: whoever touches the file first decides, and the
  decision doesn't surface until a later workstream hits the
  consequence. **Guard:** Director audit item explicitly on this
  brief's §Status. Working-Claude does **not** make the retention
  call alone — surface the first-pass read (what's currently in
  `NavigationSubsystem.js`, what V1 actually needs, what V-later
  would want) to PM + Director, get a ruling, then implement.

- **Risk: Per-frame re-aim drift from the aim-once rule.** The stub
  used per-frame re-aim (Loop (b) substrate); the feature doc V1
  rule is aim-once-at-intercept. Working-Claude may default to the
  stub's shape. **Why it happens:** the stub is the felt-experience
  reference; matching it exactly is the easy correctness check.
  **Guard:** AC #1's path-linearity bound distinguishes the two —
  aim-once produces a straight path; per-frame re-aim curves the
  path toward the moving body. Director audit item if AC #1
  requires rescoping to match whatever aim-rule the amended
  feature doc canonically authors (PM read: aim-once is the V1
  rule per §CRUISE verbatim; per-frame re-aim is explicit V-later).

## In scope

- Implementation of V1 ship axis: CRUISE (straight-line, aim-once-
  at-intercept), APPROACH (hard onset at 10R, aggressive decel,
  cubic-ease profile), STATION-A (body-locked hold, felt-fill ~60%).
- Implementation of V1 camera axis `ESTABLISHING` mode: camera
  forward = ship forward, shake on top, no linger / pan-ahead /
  departure arc authoring.
- ACCEL shake at CRUISE onset + DECEL shake at APPROACH onset
  (ship-mesh additive perturbation), pure-reverse shape, no shake
  during smooth motion.
- Ship-orientation contract (AC #7) — authored property of the
  ship object, readable by camera + shake subsystems at all phases
  including STATION-A rest.
- Stub scaffolding removal (AC #9) in the same commit set that
  lands V1.
- NavigationSubsystem retention decision (retire vs. repurpose) —
  **surfaced to Director**; implementation follows Director's
  ruling.
- Sol tour recording as motion-class evidence for AC #8 (Max-
  evaluated felt-experience acceptance).
- Telemetry-driven AC verification (ACs #1, #2, #3, #4, #5, #6)
  using `runAllReckoning` + the per-frame telemetry fields the
  parent reckoning workstream shipped (`f652a40`) and the
  live-feedback Loop (b) (`velocityBlendActive`) + Loop (c)
  (shake-event log) infrastructure.
- `CameraMode` dispatch surface preserved (AC #10) — V1 selects
  `ESTABLISHING`; `SHOWCASE` and `ROVING` branches compile but
  author nothing.

## Out of scope

- **STATION-B opt-in orbital motion.** V-later per feature doc
  §V-later triage; scoped in the future ORBIT-mode workstream.
  The cycle-4 spring-filter prior-art at `git stash@{0}` is
  preserved for that workstream.
- **Camera axis V-later authoring.** Linger on receding subject,
  pan-forward toward incoming target, departure arc from STATION-A
  into CRUISE, `SHOWCASE` camera mode, `ROVING` camera mode —
  explicitly V-later per feature doc §"Per-phase criterion —
  camera axis (V1)".
- **OOI runtime queries.** `getNearbyOOIs()` / `getActiveEvents()`
  stay as the stub interface (returning `null`/empty) per feature
  doc §"V1 architectural affordances" §OOI runtime registry.
  V-later workstream at `docs/WORKSTREAMS/ooi-capture-and-exposure-
  system-2026-04-20.md` implements.
- **Most-interesting-first body selection.** Feature doc
  §"First-planet selection" keeps V1 on inner-to-outer queue.
  V-later gated by OOI registry.
- **Multi-body tour scheduling logic.** `AutoNavigator.buildQueue`
  untouched; this workstream is about per-leg motion, not
  queue construction.
- **ENTRY phase (warp-exit-vector arrival pose).** Named in
  feature doc §V1 but not scoped in this workstream — a separate
  workstream wires the warp → autopilot handoff. V1 STATION-hold
  redesign starts from an already-held pose + departs from there.
  If working-Claude encounters ENTRY during implementation,
  surface to PM for a follow-up workstream.
- **Autopilot toggle UI** (upper-left status indicator + Tab
  keybinding). V1 infrastructure per feature doc §"Trigger /
  toggle / UI (V1)" — separate WS 4 scope.
- **HUD hide-during-autopilot / reappear-on-interaction.**
  Separate WS 4 scope.
- **Audio event-surface** (`phase-change`, `toggle` events).
  Partially landed by WS 3 (`camera-mode-change`); remaining
  events are WS 4 scope.
- **Star-orbit safe-distance rule.** Landed by
  `docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`.
  Unchanged by this workstream.
- **The parked travel-feel speed-field** (feature doc §"Parking
  lot"). Feature-level articulation Max has parked.
- **Shake mechanism redesign.** The mechanism (ship-mesh additive
  perturbation, envelope shape, carrier frequency) is inherited
  from the WS 2 shake-redesign at `1bb5eb2`. This workstream
  re-specifies **when** shake fires (CRUISE onset + APPROACH
  onset only); it does not redesign the mechanism.
- **Visible ship-orientation indicators** (chevrons, decals,
  orientation reticle). AC #7 requires orientation be *defined*,
  not *visualized*. Rendering changes are out of scope.

## Handoff to working-Claude

**Precondition: Director audit landed.** Audit at
`~/.claude/state/dev-collab/audits/autopilot-station-hold-redesign-
2026-04-24.md` released the gate to read-only handoff steps (§1
code reads, §4 stub recording watch, §12 recording protocol read).
Post-amendment commit (this one) is the HEAD working-Claude syncs
to before first `Edit`/`Write` on production code paths. The four
Director rulings are baked into this brief: (a) `forward`/`up`
accessor contract with settable-not-computed semantics (AC #7), (b)
AC #9.10 function-body removal added (§A1), (c)
NavigationSubsystem retire ruling (Implementation plan), (d) AC #1
*Note* tightened, ship-object-location resolved (§11). No further
audit iteration needed before code begins.

**Read this brief first.** Then, in order:

1. **`docs/FEATURES/autopilot.md` at `20ef423`** — the amended
   feature doc. §"Revision history" 2026-04-24 entry, §"Per-phase
   criteria — ship axis" (CRUISE, APPROACH, STATION-A),
   §"Per-phase criterion — camera axis (V1)" (ESTABLISHING +
   Precondition), §"Gravity drives" V1 scope, §"V1 architectural
   affordances", §"Failure criteria / broken states", §"Drift
   risks (Director watch list)". This is the spec.
2. **`~/.claude/state/dev-collab/audits/autopilot-live-feedback-2026-04-24.md`**
   §"Feature-Doc Amendment Interview Script (Max)" + the
   appended answers (post-interview). Max's verbatim felt-
   language across CRUISE re-aim, hold distance, DECEL onset,
   shake placement, and the jumpscare-arrival phrasing. The
   feature doc distills these; this is the origin. §2f is the
   stub-removal criterion AC #9 cites.
3. **`docs/WORKSTREAMS/autopilot-live-feedback-2026-04-24.md`**
   §"Close-out (2026-04-24)". What carries forward (Loops b + c
   substrate), what's archived (cycles 1–4 of Loop a), why the
   reframe happened (lesson 1).
4. **`screenshots/max-recordings/stub-saturn-v4-2026-04-24.fixed.webm`**
   — the validated felt-experience reference. Watch it. The V1
   implementation matches this felt experience; AC #8 acceptance
   is Max's eye against this baseline. Director §1 numerics:
   body-lock distance stable to `0.00005u`, max per-frame camera
   position jump at decel→HOLD boundary `0.0006u`.
5. **`src/main.js` L1251–L1402** — stub implementation
   (`window._stubFly`, `window._stubFlyIdx`, `window._stubStop`,
   `window._listBodies`). Understand the shape of what works; do
   not extend it.
6. **`src/main.js` L6595–L6893** — the animate-loop stub branch
   and the `cameraController.update()` gate at L6893. These are
   AC #9's removal deliverable.
7. **`src/auto/NavigationSubsystem.js` in full** — the Hermite
   travel-curve + seam-blend + VelocityBlend machinery. First-
   pass code read to surface to Director the retention question
   (retire vs. repurpose).
8. **`src/auto/CameraChoreographer.js` in full** — the current
   ESTABLISHING mode with LINGERING / TRACKING / PANNING_AHEAD
   framing states. V1 collapses these to "ship forward + shake";
   surface to Director how aggressively to strip (delete
   branches vs. leave dormant).
9. **`src/auto/ShipChoreographer.js` L215, L275, L360–L408** —
   the shake-onset signal derivation and Loop (c)'s per-sign
   legMax detector. Inherited substrate for AC #6.
10. **`src/auto/CameraMode.js`** — the camera-mode dispatch
    surface. V1 selects `ESTABLISHING`; preserve the enum + dispatch
    for AC #10.
11. **Ship-object location.** PM-confirmed code read at HEAD
    `690ea81`: there is **no first-class player-ship object** in
    `src/main.js` today. `camera.position` IS the ship's effective
    position (82 references in `src/main.js`). `playerShip*`
    references in `src/core/ScaleConstants.js` (L156, L173, L179,
    L186, L201, L206) are scale-helper exports for portal/tunnel
    sizing math, not a scene-graph object. There is no `Ship`
    class, no `class Ship`, no `new Ship(…)` instantiation, no
    `window.ship` accessor, no `playerShip` object attached
    anywhere in the scene graph. **AC #7 implies authoring a thin
    orientation-bearing ship-object surface.** This is in scope;
    surface to PM only if the work expands beyond what AC #7's
    precondition requires — e.g., visual ship-mesh rendering,
    chevrons, decals, orientation-reticle (all explicitly out of
    scope per §"Out of scope" — visible ship-orientation
    indicators). The minimum surface AC #7 requires: an object with
    `forward` / `up` (Vector3, unit) accessors, written by the
    autopilot, read by `CameraChoreographer` + `ShipChoreographer`.
    Position can remain on `camera.position` for V1 if working-
    Claude judges that the simpler shape, or migrate to the new
    object — the AC doesn't constrain that choice. (Director
    audit 2026-04-24 §A2.4: PM clarifies this in the brief so
    working-Claude's first implementation step has a definite
    answer rather than a TBD.)
12. **`docs/MAX_RECORDING_PROTOCOL.md`** — canvas-recording path
    for the Sol tour capture (AC #8). Agent-initiated via
    `~/.claude/helpers/canvas-recorder.js`; fetch via
    `~/.local/bin/fetch-canvas-recording.sh`.
13. **`docs/PERSONAS/pm.md` §"Per-phase AC rule"** — AC shape
    reference; this brief's ACs follow the phase-sourced pattern
    where feature-doc phases exist + contract-shaped pattern for
    preconditions (AC #7, #9).

**Then, in implementation order:**

1. **First-pass code read + surface architectural questions to PM
   + Director.** Specifically: (a) NavigationSubsystem retention
   call, (b) CameraChoreographer V-later branch strip aggression,
   (c) ship-object location + orientation contract attachment site.
   Do **not** start editing until PM + Director have ruled.
2. **Ship-orientation contract (AC #7).** First substantive edit.
   Define `forward` / `up` accessors on the ship object, stable
   at all phases including rest. No motion-direction fallback.
   Commit on its own so the contract is auditable independently
   of the motion-model replacement.
3. **V1 motion plan: CRUISE → APPROACH → STATION-A.** Author in
   `NavigationSubsystem.js` (or its successor per Director's
   retention ruling). Straight-line CRUISE with aim-once-at-
   intercept; hard-onset APPROACH at 10R with cubic-ease DECEL
   (stub's shape); body-locked STATION-A at felt-fill ~60%
   (numerical seed TBD during first-pass tune — start at
   `2.5 × body.radius` per the stub's calibration and iterate
   against AC #3's 0.50 ≤ fill ≤ 0.70 bound).
4. **Camera axis V1 ESTABLISHING.** Collapse `CameraChoreographer
   .EstablishingMode.update()` to "camera forward = ship
   forward + shake on top." Strip or gate LINGERING / TRACKING /
   PANNING_AHEAD branches per Director's ruling.
5. **ACCEL/DECEL shake wiring (AC #6).** ACCEL shake fires at
   CRUISE onset (new call site); DECEL shake fires at APPROACH
   onset (Loop (c)'s per-sign legMax detector gate is the
   trigger, or a direct phase-transition gate — working-Claude
   decides and justifies in commit). Pure-reverse shape.
6. **Stub scaffolding removal (AC #9).** In the same commit set
   that lands V1 — not after. If V1 is stable only with the stub
   still live, that's a signal V1 isn't actually stable; do not
   merge.
7. **Telemetry-driven AC verification.** Run `runAllReckoning`
   against a Sol tour capture; ACs #1, #2, #3, #4, #5, #6, #10
   evaluate from the telemetry output. Numerical passes are
   prerequisites to the motion recording for AC #8.
8. **Sol tour canvas recording for AC #8.** Mercury → at least
   Jupiter; 60fps; Max-evaluated. Deliver the recording path to
   PM + Max; Director's audit closes at `VERIFIED_PENDING_MAX
   <sha>` and Max's watch flips it to `Shipped`.

**"Done" looks like:**

- A commit or commit set on main that lands V1 motion model +
  ship-orientation contract + stub-removal.
- `runAllReckoning` passes ACs #1, #2, #3, #4, #5, #6, #10 against
  a Sol tour capture.
- AC #7 (ship-orientation contract) audited by Director at
  implementation sites.
- AC #9 (stub removal) audited by Director via grep contract at
  the landing commit.
- AC #8 (jumpscare-arrival felt experience) — canvas recording
  on disk at a known path, PM + Director audit closes at
  `VERIFIED_PENDING_MAX <sha>`, Max watches and confirms.
- Status flips to `Shipped <sha> — verified against
  <recording-path>` only after Max's confirmation.

**Cycle budget:** Attempt 1 expects to close V1 against all ACs.
Parameter-tune budget is held for the felt-fill ratio (AC #3) and
the DECEL cubic-ease curve constants (AC #2's hard-onset shape) —
these are Max-eye tunables. Attempt 2 is triggered only if Attempt
1 fails on mechanism-class grounds (not parameter tuning), which
would mean the motion-model spec itself needs re-examination.
Escalate to Director at that point; do not iterate within this
workstream.

## Amendment history

Canonical record of Director audit verdicts applied to this brief.
Audit log: `~/.claude/state/dev-collab/audits/autopilot-station-
hold-redesign-2026-04-24.md` (the file accumulates audits across
this workstream's lifecycle; verdicts are appended to the audit
log by working-Claude at the same commit that lands the brief
amendments).

### §A1 — 2026-04-24 (Director audit on brief landing)

AC #9.10 added: function-body removal of the stub-comment-bracketed
block at `src/main.js` L1251–L1413, beyond the `window.X = …`
accessor lines covered by AC #9.1–#9.7. Closes the ambiguity in
the original AC #9 about whether function bodies survived after
accessor removal.

### §A2 — 2026-04-24 (Director audit on brief landing)

§A2.1 — AC #1 *Note* tightened to drop rescope contingency. Aim-once
is canonical for V1 (settled by Director ruling); per-frame re-aim
is V-later.

§A2.2 — AC #7 contract item 2 tightened to "settable, not derived"
semantics. The autopilot **sets** orientation by writing the
accessor; the ship holds the written orientation until the next
write. Camera reads SET orientation.

§A2.3 — `NavigationSubsystem.js` **retire** ruling (not repurpose).
The Hermite travel-curve + seam-blend + orbit-arc machinery is dead
by construction under V1. Replace with a thinner V1 motion evaluator;
`git rm` the old file in the same commit set.

§A2.4 — Ship-object-location TBD resolved into definite answer:
no first-class player-ship object exists at HEAD `690ea81`;
`camera.position` IS the ship's effective position; AC #7 implies
authoring a thin orientation-bearing ship-object surface, in
scope, minimum surface = `forward` / `up` accessors (Vector3, unit).

### §A3 — 2026-04-25 (Director audit on V1 Attempt 1 closing)

**§A3.1 — AC #2 amendment APPROVED.** Threshold clarified to
"APPROACH onset at **`min(10R, cruise-distance ceiling)`**". Director
rationale (verbatim): *"The fallback gate in `_tickCruise`
(`distTraveled >= this._cruiseDistance`) is a correct V1 guard
against the drift-from-aim-once mode for asteroid-class bodies where
10R is sub-frame-tiny. The feature doc §APPROACH already accepts the
rule as 'tunable during lab iteration'; this is exactly that — a
body-scale-aware floor on the geometric threshold."* Empirical
surface: `recordings/v1-attempt1-ac-report.json` leg-24 telemetry
shows `distAtTrans = 1.17u`, `10R = 0.0072u` (12-leg complete-leg
sample, V1 Attempt 1 capture). Workstream-local amendment; feature
doc §APPROACH unchanged (already authors the threshold as tunable).

**§A3.2 — AC #5 amendment APPROVED.** Threshold contract clarified
to **pre-shake camera basis**. Director rationale (verbatim): *"The
feature doc §'Per-phase criterion — camera axis (V1)' + AC #5's own
text already authors shake-as-additive-on-top: 'Shake perturbation
is applied as additive displacement to camera position, not as
rotation of the camera's forward axis ... If shake is implemented
as rotation, this AC's bound relaxes to ≥ 0.99 (small-angle
perturbation).'"* The implementation chose rotation; pre-shake
basis sampling is the cleaner contract. AC #5 verifier reads
`camera.quaternion` snapshotted **after**
`camera.lookAt(cameraChoreographer.currentLookAtTarget)` and
**before** the shake-quaternion multiply (main.js animate loop, V1
STATION-hold branch). Bound: `dot(shipForward, cameraForwardPreShake)
≥ 0.9999`.

**§A3.3 — Pattern A PUNTED to follow-up workstream stub.** Single-
frame leg-boundary orientation spike (12 single-sample dot
violations across 12 legs in V1 Attempt 1 telemetry,
`recordings/v1-attempt1-ac-report.json`). Director rationale
(verbatim): *"The leg-boundary spike is one frame — it is below
the threshold of perceptual evidence in the AC #8 jumpscare-arrival
recording. Path 1 [pre-shake basis sampling] may also clean up
Pattern A if the spike is a sample-timing artifact rather than a
real ordering bug. Verify after the AC #5 re-sample."* Stub
authored at
`docs/WORKSTREAMS/autopilot-leg-boundary-orientation-spike-followup.md`
— conditional on V1 AC #5 re-sample outcome (close stub if pre-
shake re-sample shows Pattern A is sample-timing artifact; light up
stub if Pattern A persists as real ordering bug).

**§A3.4 — Status flip AUTHORIZED at `VERIFIED_PENDING_MAX
<commit-sha>`.** Subject to: §A3.1 + §A3.2 brief amendments landed
(this commit), AC #5 pre-shake re-sample passes ≥ 0.9999 for
Pattern B (working-Claude running this now), AC #1 / #3 / #4 / #6 /
#7 / #9 already PASS in `recordings/v1-attempt1-ac-report.json`,
AC #10 contract-confirmed (CameraChoreographer.setShip preserves
legacy framing-state path), AC #8 stays `VERIFIED_PENDING_MAX`
pending Max's morning recording review.

*Authored by PM under Director audit autopilot-station-hold-redesign-
2026-04-24 (2026-04-25); audit verdicts quoted verbatim.*

---

*This brief is PM-authored, authored per CLAUDE.md `Editing
docs/WORKSTREAMS/**` rule. Director audit landed 2026-04-24
(verdict: APPROVED with amendments §A1 + §A2, applied at brief-
landing commit). V1 Attempt 1 closing audit landed 2026-04-25
(amendments §A3 applied this commit). Working-Claude commits this
brief amendment + the AC #5 pre-shake re-sample telemetry +
the gate state update together.*
