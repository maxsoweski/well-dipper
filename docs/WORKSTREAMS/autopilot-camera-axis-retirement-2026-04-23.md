# Workstream: Autopilot camera-axis retirement — land `ESTABLISHING` + `CameraMode` dispatch (2026-04-23)

## Status

`Shipped b7699de — verified against screenshots/max-recordings/autopilot-camera-axis-retirement-round2-2026-04-23.webm + Max's own tour playback 2026-04-23.` Max explicit verdict 2026-04-23: *"Let's go with director's rec"* accepting Director's call that WS 3 is clean — the residual jerks Max reported at departure / arrival seams are **pre-existing nav-layer velocity-direction flips** that the round-10 subtle shake + round-2 transition-smooth camera finally made visible. Director's diagnosis: three seams (STATION→CRUISE, TRAVEL→APPROACH, APPROACH→ORBIT) share one class of bug — phase-transition velocity hand-off — that pre-dates WS 1. WS 1's telemetry-equivalence passed because it verified "no change from pre-WS-1," but pre-WS-1 had the same bugs. WS 2/3 earlier rounds' violent shake/camera-bounce masked them. Not WS 3 regressions. Follow-up: expanded `autopilot-approach-orbit-continuity-2026-04-22` workstream to cover all three seams.

**Round-2 patch summary (what landed):**

Round-2 patched EstablishingMode per Director option (a) — direct code patch, no mechanism change, no brief amendment. Three fixes:

1. **Cache `_lastStationBodyRef`** each frame `shipPhase === 'STATION'`. Use it on STATION→CRUISE edge instead of live `nav.bodyRef` (which has been replaced with the next target by leg-advance before the edge is detected).
2. **Fall-through from LINGERING → TRACKING/PANNING_AHEAD** when linger completes — recomputes camLookAt the same frame instead of leaving stale linger target on the wire.
3. **Transition blend** (`TRANSITION_BLEND_DURATION = 0.4s`) smoothstep-lerps from pre-transition camLookAt to the new state's raw target. Closes the inherent ~100-unit gap between LINGERING's body-center target and TRACKING/PANNING_AHEAD's `navPlanLookAt + bias` target.

**Round-1 vs round-2 telemetry (camLookAt delta across framing transitions):**
- Round-1: 13,499 / 13,416 / 99.4 / 99.2 units (visible jumps Max saw).
- Round-2: **0.029 / 0.001 / 0.003 / 0.005 / 0.001** units across 5 transitions (~465,000× reduction at the worst case).

**Round-1 WS 3 ACs verified in round-2:**
- AC #1 first-class dispatch: structural, no change.
- AC #2 camera-mode-change idempotence: structural, no change.
- AC #3 shake preservation: **all four shake ACs (#16–20) PASS** in round-2 telemetry. Round-10/11 shake mechanism NOT regressed.
- AC #4/#5/#6 ESTABLISHING authored: linger observed on CORRECT (receding) body at ~1.8s; pan-ahead bias peaks at 0.35 with smooth ramp in/out.
- AC #7 OOI stub: structural, no change.
- AC #8 two-axis decoupling: `switch(_framingState)`, not `switch(shipPhase)`. No change.
- AC #10 separable commits: round-1 `e6c5201` + `3b926aa` + round-2 `b7699de` — three behavioral commits.

**Also added in round-2 (at Director option-a authorization):** six diagnostic telemetry fields in `src/main.js` `_captureTelemetrySample` — `camLookAt`, `framingState`, `cameraMode`, `navBodyPos`, `navNextBodyPos`, `navPlanLookAt`. Read-only, no behavior changes. Subset of the fields the autopilot-telemetry-coverage workstream (`4f9e1bb`, Drafted) will formalize with audit helpers.

**Recording:** `screenshots/max-recordings/autopilot-camera-axis-retirement-round2-2026-04-23.webm` (~19 MB, 60s Sol D-shortcut tour).

**Residual finding (NOT WS 3 scope, flagged for continuity/follow-up):** one mid-TRACKING frame showed a ~99.9 unit `camLookAt` delta with `framingState` stable. Per Director's attribution rule, a non-transition jump = nav-layer target-composition issue (`motionFrame.lookAtTarget` jumped; WS 3 faithfully reflected it). Likely the nav subsystem's heading-composition seam at a leg-advance. Not a WS 3 regression.

**PANNING_AHEAD / APPROACH head-turn finding (reckoning appendix 2026-04-24, deferred to loop (a) of `docs/WORKSTREAMS/autopilot-live-feedback-2026-04-24.md`).** The reckoning telemetry's `cameraViewAngularContinuity` audit flagged 11 violations on a fresh Sol D-shortcut tour against this workstream's Shipped code (top: 35,384°/sec yaw at t=48.16s during PANNING_AHEAD / APPROACH / ESTABLISHING), and `bodyInFrameChanges` flagged 18 quarter-second-glance violations at the planet↔moon transition crossover. These were below the prior audit's observability floor (`camLookAt` position-delta vs angular rate on `camFwd`). WS 3 stays Shipped at `b7699de`; the fix is a frame-to-frame angular-rate clamp in `EstablishingMode` (loop a of the live-feedback workstream), which adds a rate-limiter on the composition output without altering WS 3's authored linger / pan-ahead / independent-pacing behavior per ACs #4–#6.

Awaiting Max's re-verdict.

---

**Historical: round-1 VERIFIED_PENDING_MAX (rejected 2026-04-23 — superseded by round-2 at `b7699de`).**

`VERIFIED_PENDING_MAX 3b926aa` — WS 3 code committed in two commits (`e6c5201` dispatch + ESTABLISHING + wiring; `3b926aa` OOI stub + event surface). All ACs programmatically verified in 60s Sol D-shortcut tour:

- **AC #1** first-class dispatch: `CameraMode = Object.freeze({ESTABLISHING, SHOWCASE, ROVING})` exported from `src/auto/CameraMode.js`. Dispatch is `switch(this._mode)` in `CameraChoreographer.update()`; SHOWCASE + ROVING branches exist, reference OOI stub via `getNearbyOOIs` + `getActiveEvents`, fall back through dispatch to ESTABLISHING.
- **AC #2** mode-transition idempotent emission: 3 distinct `setCameraMode` calls → 3 `camera-mode-change` events; 2 same-mode calls → 0 events; invalid mode → 0 events + console warn.
- **AC #3** shake composition preserved: all four shake ACs (#16–20) PASS on the 60s capture. `camera.lookAt` stays in `FlythroughCamera._applyFreeLookAndLookAt`; mode only produces the target.
- **AC #4/#5/#6** ESTABLISHING authored: linger observed at STATION→CRUISE edge (1.749s; > 1.0s rot-blend). Pan-ahead periods: 2, peak bias 0.35 (authored PAN_AHEAD_FRACTION). Camera-framing transitions decoupled from ship-phase transitions.
- **AC #7** OOI stub signature + dispatch-side references: `getNearbyOOIs` and `getActiveEvents` called from SHOWCASE/ROVING dispatch branches (grep-findable).
- **AC #8** two-axis decoupling: `EstablishingMode.update()` switches on `_framingState ∈ {TRACKING, LINGERING, PANNING_AHEAD}`, NOT on `ShipPhase`. Ship phase consulted only for transition-edge detection, as an input signal.
- **AC #10** separable commits landed: `e6c5201` + `3b926aa` + (this Status flip).

**Recording drop path:** `screenshots/max-recordings/autopilot-camera-axis-retirement-2026-04-23.webm` (~20 MB, 60s Sol tour). Shows a full STATION→CRUISE linger + CRUISE pan-ahead + arrival sequence with shake mechanism intact.

**Tunable surface** at top of `src/auto/CameraChoreographer.js`: `LINGER_DURATION = 1.8s`, `PAN_AHEAD_FRACTION = 0.35`, `PAN_AHEAD_RAMP = 0.8/s`, `PAN_AHEAD_DECAY = 2.0/s`. Max edits during review via F12.

Awaiting Max's verdict.

---

**Historical: Scoped state (superseded by commits e6c5201 + 3b926aa).**

`Scoped 2026-04-23` — third of four sequential workstreams delivering
V1 autopilot. Parent feature `docs/FEATURES/autopilot.md` (Director-
authored 2026-04-20 at commit `bdeb0ff`). Predecessors:

- **WS 1 `autopilot-navigation-subsystem-split-2026-04-20.md`:
  `Shipped 3d53825`** — carved `NavigationSubsystem` out of
  `FlythroughCamera`; in doing so, already retired the legacy
  `FlythroughCamera.State = { DESCEND, ORBIT, TRAVEL, APPROACH }`
  enum. The post-WS-1 `FlythroughCamera.js` is 193 lines,
  orientation-only (free-look + lookAt + rot-blend slerp + shake
  composition).
- **WS 2 `autopilot-ship-axis-motion-2026-04-20.md`:
  `Shipped <TBC by Max — currently VERIFIED_PENDING_MAX cfd6df0>`**
  with the nested **`autopilot-shake-redesign-2026-04-21.md`:
  `Shipped 1bb5eb2` (Status flip `9a601fa`)**. Together these
  landed the ship-axis `ShipPhase.ENTRY/CRUISE/APPROACH/STATION`
  state on `ShipChoreographer`, the rotation-only gravity-drive
  shake, and the `FlythroughCamera.setShakeProvider` /
  `shakeEuler` surface.

Siblings this workstream coordinates with but does not block on:

- **WS 4 (future) — toggle UI + manual-override + warp-select
  handoff.** Consumes this workstream's `CameraMode` enum and the
  camera-mode-change event-surface hook (§10.7).
- **`ooi-capture-and-exposure-system-2026-04-20.md` — Scoped.**
  V-later implements the runtime OOI registry that this workstream's
  §10.9 stub interface is a V1 placeholder for.

## Premise correction (load-bearing — read this before scoping)

Max's WS 3 prompt and a prior Director framing described this
workstream as *"retire the legacy `FlythroughCamera.State` enum and
land `ESTABLISHING` as the first proper camera mode."* **The enum
retirement already happened in WS 1.** Re-confirmed 2026-04-23 by
reading `src/auto/FlythroughCamera.js` at HEAD: zero `State` enum,
zero `DESCEND/ORBIT/TRAVEL/APPROACH` references, zero phase
branches. The module's entire job today is reading
`navigation.update(dt)` → writing `camera.position = frame.position`
→ authoring `camera.lookAt(frame.lookAtTarget)` with free-look +
rot-blend slerp + shake composition.

**What is actually outstanding for the camera axis, per feature doc
§"V1 — must ship" and §"V1 architectural affordances for V-later
items":**

1. The **`CameraMode` enum** (`ESTABLISHING / SHOWCASE / ROVING`)
   as a **first-class dispatch surface** — not an if-branch inside
   `ESTABLISHING`. Feature doc §133: *"V1 implements a `CameraMode`
   enum … even if only one value is ever selected, and routes camera
   updates through a dispatch that can accept any of the three.
   Adding `SHOWCASE` later is a new branch, not a restructure."*
2. **`ESTABLISHING` as an authored camera mode** — wide/slow,
   paces independently of ship phase, can linger on a receding
   subject as the ship begins the next phase, can pan forward ahead
   of arrival. Today's `FlythroughCamera` passively consumes
   whatever `lookAtTarget` the subsystem produces — this reads as
   "camera locked behind ship looking where the subsystem says,"
   which is the debug follow-mode WS 2 scoped to be sufficient for
   ship-motion evaluation but is **not** `ESTABLISHING` per the
   feature-doc criteria.
3. The **OOI query stub interface** (§10.9) — `getNearbyOOIs(camera,
   radius) → []` and `getActiveEvents(now, horizon) → []`, plumbed
   through the camera-mode dispatch so V-later can light up
   `SHOWCASE` / `ROVING` without restructuring the dispatch.
4. The **camera-mode-change event** on the autopilot event-surface
   per §10.7 (*"`autopilotEvents.on('camera-mode-change', ({ from,
   to }) => …)`"*) — emits on mode transitions; zero subscribers in
   V1.

This brief is scoped to land these four items, with `SHOWCASE` and
`ROVING` **architecturally present but unexercised** — the dispatch
route for them exists, the implementation of their authored behavior
does not.

**Why this correction matters for scope discipline.** Writing the
brief against the outdated premise ("retire the enum") would ship a
no-op commit; writing it against the actual outstanding V1 work
("land the dispatch + ESTABLISHING authoring + OOI stub + event
surface") is what advances the autopilot feature toward V1. Per
`docs/PERSONAS/pm.md` §"Scope discipline — feature before economy":
economy-first framing ("what's the cheapest delta from current
code?") would keep today's passive-follow behavior and relabel it
`ESTABLISHING`; feature-first framing is to author the independent-
pacing criteria the feature doc names.

## Revision history

- **2026-04-23 — authored** by PM as WS 3 of 4 in the V1 autopilot
  sequence. Greenlight from Director (prior session audit) naming
  WS 3 next after WS 2 + shake-redesign closed.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
commit `bdeb0ff` with keybinding update at `4b9b18a` and parking-
lot entry at `79cdf4e`.

Specific sections this workstream serves:

- **§"Two-axis phase structure" — Camera axis** — the three-mode
  table (`ESTABLISHING / SHOWCASE / ROVING`). This workstream lands
  the dispatch for all three and the V1 implementation of
  `ESTABLISHING`.
- **§"Per-phase criterion — camera axis (V1)" — `ESTABLISHING`** —
  the felt-experience criteria this workstream's ACs cite verbatim:
  independent pacing, linger on receding subjects, pan-forward
  toward incoming targets, wide FOV, slow angular velocity, composed
  framing.
- **§"V1 — must ship"** — the bullets this workstream closes:
  *"Ship/camera decoupling architecture — the two-axis structure
  must be in place at V1 even though only ESTABLISHING is exercised
  on the camera axis."*, *"ESTABLISHING camera mode — paces
  independently of ship phase, can linger/pan."*
- **§"V1 architectural affordances for V-later items"** — the
  `CameraMode` enum as a first-class selector; the OOI runtime
  interface (stub in V1); the camera-mode-change event.
- **§"Drift risks" #1** — *"Re-coupling ship + camera axes under
  'simplicity.'"* This workstream's principal drift risk.
- **§"Failure criteria / broken states"** — specifically: *"Camera
  feels locked to ship — the player's eyes can't linger, can't pan
  independently. Violates the two-axis decoupling."*

Primary contracts:

- **`docs/SYSTEM_CONTRACTS.md` §10.1 Two-axis state machine —
  Camera axis** (the three-mode enum lives here).
- **§10.2 ORBIT retirement migration invariant** (*"any replacement
  code must not reintroduce a single combined state … A future
  refactor that folds them back together for 'simplicity'
  forecloses V-later `SHOWCASE` and `ROVING`"*).
- **§10.7 Audio event-surface hook** (camera-mode-change event
  must emit in V1 with zero subscribers).
- **§10.9 OOI query interface (stub in V1)** — *"autopilot's
  `SHOWCASE` / `ROVING` code paths read through the interface, not
  from scene globals. V-later implementation of the OOI runtime
  registry does not require autopilot-side changes."*
- **§10.10 Contract precedence** — §10 governs the autopilot
  drive-state internal structure; any apparent conflict with §5
  Camera and Control resolves by §5 governing the Toy-Box/Flight
  × Manual/Autopilot orthogonality and §10 governing autopilot's
  internal shape.

Secondary: **§5.3 Drive States** (Autopilot column is what the
camera writer does this frame — this workstream adds the camera-
mode dimension to that cell).

Lore anchor: `docs/GAME_BIBLE.md` §1 Core Experience — *"Every
system is different. Finding a terrestrial world or an alien
megastructure is rare and meaningful."* ESTABLISHING is the
cinematographer's composition of the "rare and meaningful" find —
the mode where the camera lingers on the ringed planet so the
player has time to register that it *is* ringed.

## Implementation plan

N/A (feature is workstream-sized). The camera-axis dispatch is a
single module seam plus a new authored-mode class; no cross-system
state machine complexity that a PLAN doc would clarify. If mid-
work working-Claude discovers the ESTABLISHING independent-pacing
math needs its own document (e.g., the linger/pan-ahead decisions
grow a state machine of their own), escalate to PM for a PLAN
bootstrap rather than expanding this brief.

## Scope statement

Land the **camera-axis dispatch infrastructure** — `CameraMode`
enum, first-class selector routing camera updates through a mode
object, §10.9 OOI query stub interface, §10.7 camera-mode-change
event — and ship **`ESTABLISHING` as the authored V1 camera mode**
per `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera
axis (V1)." `SHOWCASE` and `ROVING` are **architecturally present
but unexercised**: the dispatch routes to them, the authored
behavior for them does not exist, and V1 is explicit about that.

This includes:

- A `CameraMode` enum exported from `src/auto/` (alongside
  `ShipPhase`), value set `{ ESTABLISHING, SHOWCASE, ROVING }`.
- A camera-mode dispatch surface — a `CameraChoreographer` (or
  equivalent; working-Claude picks the final name) that holds the
  current mode, routes each frame's camera-authoring work to the
  mode's implementation, and handles mode transitions. This is the
  "first-class selector" §10.1 / feature-doc §133 requires.
- An `EstablishingMode` implementation that authors camera behavior
  per the feature-doc `ESTABLISHING` criteria — wide/slow framing,
  independent pacing from ship phase, can linger on a receding
  STATION subject as the ship begins CRUISE, can pan forward toward
  the next target ahead of arrival.
- An OOI stub interface (`getNearbyOOIs`, `getActiveEvents`) that
  the `SHOWCASE` / `ROVING` dispatch branches **would** consume;
  V1 returns empty arrays.
- A `camera-mode-change` event emission on the autopilot event-
  surface when the dispatch transitions mode. V1 has no subscribers.
- The `FlythroughCamera` module becoming the **orientation-write
  surface** that `CameraChoreographer` drives, rather than the
  module that decides what to look at. Concretely: `FlythroughCamera`
  still owns free-look offset, rot-blend slerp, and the shake-
  composition quaternion multiply at the end of `update()`; the
  `lookAtTarget` / framing-decision layer moves into the mode
  implementations.

**Camera-to-shake composition is load-bearing and must be preserved
exactly.** `FlythroughCamera.update()` at lines 128–147 (HEAD)
runs, in order: `camera.position = frame.position` →
`_applyFreeLookAndLookAt(target)` (which calls `camera.lookAt`) →
rot-blend slerp pulling orientation back toward `_initialQuat` →
`camera.quaternion.multiply(_shakeQuat)` (shake is the final post-
lookAt composition). Any WS 3 edit that changes which module calls
`camera.lookAt`, or reorders the steps so shake composes before
lookAt, will break the shake-redesign just-shipped at `1bb5eb2`.
The camera-mode dispatch provides the **lookAtTarget + any
framing-level camera-state overrides** (FOV, roll, yaw-offset for
pan-ahead, etc.); `FlythroughCamera` is the module that applies
them to the Three.js camera and composes the shake on top. See AC
#3 and drift-risk #3.

This is **one unit of work** because the `CameraMode` enum, the
dispatch surface, and the first mode implementation ship together
by design — an enum without a dispatch is dead code, a dispatch
without a mode is scaffolding, a mode without the enum + dispatch
is an if-branch (the anti-pattern the feature doc explicitly names
at §133). Splitting the three would either ship dead code on
commit 1 or foreclose V-later on commit 3.

**Explicitly excluded from the bundle reasoning:** this is NOT a
license to skip the ESTABLISHING authoring ACs (#4–#6) on the
grounds that "the infrastructure is the important part." The
ESTABLISHING criteria are felt-experience criteria that only the
recording can evaluate; they are testable AC requirements, not
optional polish.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Vision / Core Experience — the
**Discover** axis: *"Every system is different. Finding a
terrestrial world or an alien megastructure is rare and
meaningful."* Today's passive follow-mode camera reads discovery
as "the ship is pointed at a planet, so there must be a planet" —
the authored ESTABLISHING mode reads discovery as "the camera is
composing a frame on this planet because it *is* a terrestrial
world." The two-axis structure is the architectural substrate
that lets V-later ship `SHOWCASE` (the eclipse framing, the ring-
shadow composition) without restructuring the camera module.

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 6 — First Principles Over Patches.** The camera
  axis as a first-class concept (with a dispatch surface, not an
  if-branch) is the first-principles shape. Patching ESTABLISHING
  behavior into the existing passive-follow code would work for
  V1 and structurally foreclose V-later — that's economy-first
  framing Principle 6 rejects.
- **Principle 2 — No Tack-On Systems.** The OOI stub interface
  is load-bearing here. `SHOWCASE` and `ROVING` consume OOI data
  as part of their authored behavior — not as a filter applied
  on top. The stub interface V1 ships is the architectural seam
  that V-later implementations slot into. Skipping the stub
  ("we'll add it when we need it") is the Principle 2 anti-pattern.
- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** The camera mode consumes ship-motion-subsystem
  output (ship position, target body refs) and OOI data (stub V1,
  real V-later). It does NOT drive ship motion. ESTABLISHING may
  linger on a receding subject, but it does not slow the ship
  down to achieve the linger — the independent pacing is a
  camera-side choice, not a ship-side command.

## Acceptance criteria

Phase-sourced per `docs/PERSONAS/pm.md` §"Per-phase AC rule." The
authored camera-mode ACs (#4–#6) quote feature-doc §"Per-phase
criterion — camera axis (V1) — ESTABLISHING" verbatim. The
infrastructure ACs (#1–#3, #7–#9) are contract-shaped — they cite
§10.1 / §10.7 / §10.9 invariants with a verifiable observation.

1. **`CameraMode` enum lands as a first-class selector, not an
   if-branch.** Per `docs/FEATURES/autopilot.md` §"V1 architectural
   affordances for V-later items" (*"V1 implements a `CameraMode`
   enum (`ESTABLISHING` / `SHOWCASE` / `ROVING`) even if only one
   value is ever selected, and routes camera updates through a
   dispatch that can accept any of the three. Adding `SHOWCASE`
   later is a new branch, not a restructure."*) and
   `docs/SYSTEM_CONTRACTS.md` §10.1. Verified by:
   - `CameraMode = Object.freeze({ ESTABLISHING: 'ESTABLISHING',
     SHOWCASE: 'SHOWCASE', ROVING: 'ROVING' })` is exported from
     a module in `src/auto/` (e.g., `CameraChoreographer.js` or
     a sibling `CameraMode.js`).
   - The per-frame camera update routes through a dispatch that
     accepts any of the three values (a `switch` or mode-object
     lookup at the top of the update), not through an
     `if (mode === 'ESTABLISHING') { … }` with no other branch.
   - A grep for `CameraMode.SHOWCASE` and `CameraMode.ROVING`
     returns references (at minimum in the dispatch surface).
     Their branches may delegate to a V1-stub that falls back to
     `ESTABLISHING` behavior *through the dispatch* — but the
     branch exists, distinct from the ESTABLISHING branch.

2. **Mode transition emits `camera-mode-change` on the autopilot
   event-surface** (per `docs/SYSTEM_CONTRACTS.md` §10.7:
   *"`autopilotEvents.on('camera-mode-change', ({ from, to }) =>
   …)`"*). Verified by:
   - A `setCameraMode(newMode)` call on the choreographer emits
     exactly one `camera-mode-change` event with `{ from, to }`
     payload.
   - V1 has zero subscribers to this event in production code.
     The only subscriber, if any, is the test harness / diagnostic
     hook that verifies emission.
   - Emission is idempotent on same-mode assignment (setting
     ESTABLISHING when already ESTABLISHING does NOT emit).

3. **`FlythroughCamera` preserves its shake-composition ordering
   exactly** (see Scope statement + drift-risk #3). Verified by:
   - `src/auto/FlythroughCamera.js` `update()` still runs, in
     order: (a) `camera.position = frame.position`, (b) free-look
     + `camera.lookAt(target)`, (c) rot-blend slerp toward
     `_initialQuat`, (d) `camera.quaternion.multiply(_shakeQuat)`.
   - The `camera.lookAt` call is still inside `FlythroughCamera`,
     not moved up into the mode object. The mode object produces
     the **target** (`lookAtTarget`) and any framing-level camera
     state (FOV, roll offset, yaw-offset for pan-ahead); it does
     NOT call `camera.lookAt` itself.
   - Existing shake-verify recording from the shake-redesign
     workstream (`screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm`)
     still plays with shake visible on abrupt motion and absent
     during smooth motion — shake mechanism is NOT regressed.

4. **ESTABLISHING paces independently of ship phase** (per
   `docs/FEATURES/autopilot.md` §"`ESTABLISHING` — wide/slow
   framing that follows ship phases independently": *"Default
   camera mode for V1. Paces with the ship phase but **is not
   coupled to it frame-for-frame.**"*). Verified by:
   - In Max's canvas recording (AC #9), during at least one
     ship-phase transition (e.g., STATION → CRUISE), the camera's
     framing does NOT transition at the same frame as the ship's
     phase change. The camera continues to hold or finish its
     prior framing decision for a visible beat, then transitions
     on its own cadence.
   - Diagnostic backup: the camera's framing-decision timestamp
     (the frame on which it re-elects its look target) is NOT
     identical to the ship-phase-transition frame for every
     ship-phase boundary in the recording. At least one transition
     shows camera-timestamp ≠ ship-phase-timestamp.

5. **ESTABLISHING can linger on a receding subject as the ship
   begins the next phase** (per `docs/FEATURES/autopilot.md`
   §"`ESTABLISHING`": *"Can **linger** on a receding subject as
   the ship begins the next phase (e.g. on the planet the ship
   just finished `STATION`-ing, while the ship starts `CRUISE`
   toward the next body)."*). Verified by:
   - In Max's canvas recording at a STATION → CRUISE boundary
     on a planet tour, the camera remains framed on the planet
     the ship just left (the receding subject) for a visible
     beat after the ship has begun its CRUISE motion toward the
     next body. The planet is in frame as a receding body, not
     already replaced by the next target.
   - The linger is readable as authored — not an artifact of
     the orientation slerp's finite duration — which means the
     linger duration is **longer than `rotBlendDuration`** (the
     subsystem's ~1.0s for tour departures; see WS 2 Handoff
     §4a).

6. **ESTABLISHING can pan forward toward the next target ahead
   of the ship's arrival** (per `docs/FEATURES/autopilot.md`
   §"`ESTABLISHING`": *"Can **pan forward** toward the direction
   the ship is heading, ahead of the ship's arrival."*). Verified
   by:
   - In Max's canvas recording during CRUISE or APPROACH, there
     is at least one beat where the camera's framing has panned
     ahead of the ship's travel vector — the next target is
     visibly more centered in the frame than the ship-forward
     vector alone would produce.
   - The pan-forward does NOT violate the shake-composition
     ordering (AC #3) — shake still composes on top of the
     panned-forward orientation.

7. **OOI query stub interface ships with V1-empty implementation**
   (per `docs/SYSTEM_CONTRACTS.md` §10.9: *"V1 returns `[]`
   (stub). … Invariant: autopilot's `SHOWCASE` / `ROVING` code
   paths read through the interface, not from scene globals."*).
   Verified by:
   - A module (e.g., `src/auto/OOIRegistry.js` or a stub object
     inside the camera choreographer) exports
     `getNearbyOOIs(camera, radius) → []` and
     `getActiveEvents(now, horizon) → []`.
   - The SHOWCASE and ROVING dispatch branches in the camera
     choreographer reference these methods (even if in a
     fallback code path that never runs in V1). A grep for
     `getNearbyOOIs` and `getActiveEvents` returns references
     in the dispatch code, not just in the stub definition.
   - V-later wire-up is a **replacement of the stub's return
     values**, not a restructure of the dispatch. Verified by
     inspection: the stub's signature is the signature V-later
     will implement.

8. **Two-axis decoupling preserved — ESTABLISHING does not
   reintroduce a combined ship-phase-and-camera-framing state**
   (per `docs/SYSTEM_CONTRACTS.md` §10.2 migration invariant:
   *"any replacement code must not reintroduce a single combined
   state. `STATION` lives on the ship axis; `SHOWCASE` lives on
   the camera axis."*). Verified by:
   - The `EstablishingMode` implementation does NOT switch on
     `ShipPhase` in its main update path as the primary selector
     for what to look at. It MAY read `ShipPhase` (e.g., to know
     whether the ship is at a STATION so linger-on-receding is
     applicable), but ship phase is **input**, not **state**.
   - Specifically: there is no `EstablishingMode` state variable
     that holds "currently framing-as-if-STATION" vs. "currently
     framing-as-if-CRUISE." The mode's state (what it's looking
     at, what it's panning toward) is camera-axis state only.
   - Grep: `EstablishingMode.js` does NOT contain
     `case 'ENTRY'` / `case 'CRUISE'` / `case 'APPROACH'` /
     `case 'STATION'` as the top-level structure of its update
     method.

9. **Motion evidence at camera-gate — one canvas recording showing
   ESTABLISHING framing across the tour.** Per
   `docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas
   features (default)" and
   `feedback_motion-evidence-for-motion-features.md`:
   - Full autopilot tour at Sol captured via
     `~/.claude/helpers/canvas-recorder.js`, 45–90 s covering
     warp-exit → ENTRY → CRUISE → APPROACH (star) → STATION
     (star) → CRUISE → APPROACH (Earth) → STATION (Earth) →
     at least one STATION → CRUISE transition for AC #5's
     linger beat.
   - Drop path: `screenshots/max-recordings/autopilot-camera-axis-retirement-2026-04-23.webm`.
   - ACs #4, #5, #6 evaluated against this recording. ACs #1,
     #2, #3, #7, #8 evaluated against the commit diff + console
     inspection (contract-shaped).

   Per the Shipped-gate protocol: working-Claude closes at
   `VERIFIED_PENDING_MAX <commit-sha>` after the commit lands
   and the recording is on disk. Shipped flip on Max's verdict
   against the recording.

10. **Commits separable by concern.** At minimum three: (a)
    `feat(autopilot): CameraMode enum + dispatch surface` (the
    infrastructure), (b) `feat(autopilot): ESTABLISHING camera
    mode — linger + pan-ahead authoring` (the first authored
    mode), (c) `feat(autopilot): OOI query stub interface + camera-
    mode-change event emission` (the V-later affordances). Call-
    site wiring in `src/main.js` may be its own fourth commit or
    fold into (a). No omnibus "camera axis done" commit. Each
    commit names the AC it closes.

## Principles that apply

Four of the six from `docs/GAME_BIBLE.md` §11 are load-bearing.
Principle 3 (Per-Object Retro Aesthetic) is orthogonal — the
camera authors framing, not object-specific rendering. Principle 4
(BPM-Synced Animation) is orthogonal at V1 — the ESTABLISHING
pacing is authored to felt-experience criteria, not to a BPM
clock; coupling them is V-later territory if it happens at all.

- **Principle 6 — First Principles Over Patches.** The structural
  problem the camera axis has at HEAD is that `FlythroughCamera`
  passively consumes whatever `lookAtTarget` the subsystem hands
  out. The patch move would be: add an "authored pacing" filter
  on top of the subsystem's `lookAtTarget` — slow down the target
  transitions, add a linger delay, etc. That ships a patch that
  works for V1 and structurally precludes V-later, because
  `SHOWCASE` and `ROVING` need to look at things the subsystem
  *doesn't* have a `lookAtTarget` for (OOIs, composition points,
  300° off-axis points of interest). The first-principles move
  is: the subsystem produces a **ship-motion plan**; the camera
  axis **independently decides where the camera looks**, which
  today happens to often coincide with the subsystem's
  `lookAtTarget` but is not defined as "whatever the subsystem
  says." *Violation in this workstream would look like:* an
  `EstablishingMode` whose single job is "smooth the subsystem's
  lookAtTarget over time." That's a filter, not an authored mode.
  The authored ESTABLISHING makes its own framing decisions;
  the subsystem's target is one input among several.

- **Principle 2 — No Tack-On Systems.** The OOI stub interface is
  the load-bearing affordance here. `SHOWCASE` and `ROVING` are
  V-later, but they're not *unrelated* V-later — they're part of
  the same camera axis this workstream lands. If the stub
  interface doesn't ship in V1, then the V-later workstream that
  lights up OOI has to:
  1. Define the interface.
  2. Wire it through the dispatch.
  3. Implement it.
  4. Implement SHOWCASE / ROVING consumption.
  That's three extra steps that could have been done at V1 for
  near-zero cost (empty-array stubs). Skipping the stub because
  "V1 doesn't use it" is the exact tack-on pattern. *Violation
  in this workstream would look like:* "we'll add the OOI
  interface when we need it." The feature doc §133 and contract
  §10.9 are both explicit that the stub ships at V1.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** The camera consumes ship-motion data and (V-later)
  OOI data. It does NOT drive ship motion. A common drift in
  camera-authoring work is having the camera "need" the ship to
  slow down for a linger to work — that's a reverse flow. If
  ESTABLISHING wants to linger on a receding subject, the
  linger is authored in camera time — the ship continues on
  its CRUISE schedule, and the camera either holds the receding
  subject until the linger-duration expires OR decides the
  subject is no longer framable and transitions. The camera
  does not tell the ship to wait. *Violation in this workstream
  would look like:* an "extended STATION" signal from the
  camera to the ship choreographer so the linger has room to
  complete. That's a camera-driving-ship reverse flow.

- **Principle 1 — Hash Grid Authority** (diagnostic, not
  prescriptive). The OOI stub interface at V1 returns empty
  arrays. When V-later implements it, the implementation queries
  through the hash grid / scene-graph for the OOIs — it does NOT
  get a side-channel registry that camera-axis populates
  independently. This workstream's stub ships the *signature*
  of the interface; V-later ships the implementation; neither
  re-invents OOI storage outside the hash grid's authority.

## Drift risks

- **Risk: Scope creep into `SHOWCASE` or `ROVING` implementation.**
  The V1 architectural affordances (stub OOI interface,
  first-class dispatch) make it tempting to "also land a minimal
  SHOWCASE" because the dispatch branch is right there and a
  crescent-framing heuristic feels cheap. Feature doc §"V1 —
  must ship" vs. §"V-later — polish, must graft on without
  architectural rewrite" draws the line explicitly: `SHOWCASE`
  and `ROVING` are V-later.
  **Why it happens:** the dispatch's SHOWCASE branch is a
  one-line `return` or fallback-to-ESTABLISHING; "might as well
  put a heuristic here" is a 10-minute delta.
  **Guard:** AC #1 permits the SHOWCASE and ROVING branches to
  **fall back through the dispatch to ESTABLISHING behavior** —
  that's the V1 shape. AC #4–#6 ACs explicitly evaluate only
  ESTABLISHING. If the recording contains behavior that reads as
  SHOWCASE (framed crescent, composed eclipse, etc.), the
  workstream has drifted — escalate to Director. SHOWCASE is
  a named separate workstream (not yet scoped); landing any
  authored SHOWCASE behavior here pre-empts that workstream's
  scope.

- **Risk: Re-coupling camera mode to ship phase "because
  ESTABLISHING only exists to frame ship phases."** Feature doc
  §"Drift risks" #1 names this as the Director's primary watch
  item: *"Any V1 implementation that bakes `ESTABLISHING` into
  ship-phase logic (because it's the only camera mode V1
  exercises) is storing an architectural rewrite cost against
  V-later."*
  **Why it happens:** the ESTABLISHING criteria are written
  against ship-phase transitions (linger on STATION as ship
  begins CRUISE; pan forward during CRUISE). The natural code
  shape is `switch(shipPhase) { case STATION: ...; case CRUISE:
  ...; }`. This ships a working ESTABLISHING at V1 and structurally
  entangles the two axes — SHOWCASE has to unwind it.
  **Guard:** AC #8 is the direct test. `EstablishingMode`'s
  main update path does NOT switch on `ShipPhase` as its primary
  structure. Ship phase is an **input signal** the mode consults
  (e.g., "the ship just left STATION — a linger is appropriate"),
  not the **selector** for what the mode does. The mode's own
  state machine — "currently lingering," "currently panning
  toward next target," "currently tracking the subsystem
  lookAtTarget" — is camera-axis state, independent of ship
  phase.

- **Risk: Breaking the shake composition ordering in
  `FlythroughCamera.update()`.** The shake redesign just shipped
  at `1bb5eb2` and composes pitch/yaw/roll into
  `camera.quaternion` AFTER `camera.lookAt()` has run (L128–147
  of `FlythroughCamera.js`). If WS 3 moves `camera.lookAt` into
  the mode object (a natural instinct — the mode knows what to
  look at), or reorders the steps so shake composes before
  lookAt, the shake-redesign regresses silently — shake becomes
  expressed in world space rather than camera-local space, and
  the "aircraft turbulence in the cockpit" felt experience
  collapses back into "scene is bouncing."
  **Why it happens:** cleanly decoupling "what to look at"
  (camera axis) from "how to author orientation" (FlythroughCamera)
  naturally suggests moving `lookAt` to the caller that knows
  the target. That's the wrong move — `lookAt` stays in
  `FlythroughCamera`; only the *target* moves out.
  **Guard:** AC #3 is the direct test. `camera.lookAt` call
  stays in `FlythroughCamera._applyFreeLookAndLookAt`.
  `FlythroughCamera.update()`'s five-step order is preserved.
  Diff review: if `camera.lookAt` appears in any mode object,
  escalate to Director. The existing shake-verify recording
  from the shake-redesign workstream must still play correctly
  — include it in the shipped-flip evidence package as a
  regression check.

- **Risk: Bypassing the OOI stub interface "because it returns
  [] anyway."** Camera mode dispatch has a SHOWCASE branch; the
  branch is expected to query OOIs to pick a composition target;
  the query returns empty; the branch falls back to ESTABLISHING.
  The temptation is to skip wiring the query at all — "why
  call a function that returns [] when I could just fall back
  directly?"
  **Why it happens:** removing the dead call looks like a minor
  cleanup; the dead call "clearly" doesn't do anything in V1.
  **Guard:** AC #7 is the direct test. The SHOWCASE and ROVING
  dispatch branches reference `getNearbyOOIs` and
  `getActiveEvents` by name — a grep finds them. When V-later
  lights up the registry, those exact call sites become live.
  If the V1 implementation is `if (mode === SHOWCASE) return
  fallbackToEstablishing()` with no OOI call, V-later has to
  re-thread the query — Principle 2 violation. Contract §10.9
  invariant: *"V1 exercises neither `SHOWCASE` nor `ROVING`,
  so the stub interface has no effective call sites in V1. But
  the interface must exist at V1, and the dispatch from camera
  mode to interface-query must exist at V1, so V-later is a
  wire-up and not a restructure."*

- **Risk: Authoring an ESTABLISHING that reads as "smooth the
  subsystem's lookAtTarget."** Principle 6 above names this —
  the patch move that ships V1 and forecloses V-later. The
  visible symptom: the recording shows a camera that follows
  the ship's heading with a low-pass filter but does not
  linger on receding subjects, does not pan ahead toward
  incoming targets, and does not have any framing state of
  its own. It reads as "follow-mode with extra inertia," not
  as an authored mode.
  **Why it happens:** the existing passive follow is 30 lines
  of code that already works; adding a low-pass filter on top
  is a 10-line delta; AC #9's recording might even pass a
  cursory review because "the camera is doing something."
  **Guard:** ACs #4, #5, #6 are authored against felt-experience
  criteria that a smoothed-follow cannot satisfy. AC #5
  specifically requires **linger longer than `rotBlendDuration`**
  at a STATION → CRUISE boundary, and AC #6 requires a pan-
  forward framing that differs from the ship-forward vector.
  A low-pass filter satisfies neither (its "linger" is the
  rot-blend duration; its "heading" is always on the ship's
  forward vector plus noise).

- **Risk: Mode-transition emission gets folded into per-frame
  update instead of transition-only.** §10.7 event surface:
  the `camera-mode-change` event fires on **transitions**, not
  every frame. The naive implementation emits on every `update`
  call; the subscriber (V-later BGM layer) gets a per-frame
  firehose.
  **Why it happens:** "emit on every frame where the mode is
  set" is one line shorter than "emit only when the mode
  actually changes."
  **Guard:** AC #2 names idempotence — `setCameraMode(current
  + 1)` emits once; `setCameraMode(current)` (same mode)
  emits zero times. Transition detection is a simple prior-mode
  comparison, not a firehose.

- **Risk: Rewiring `camera.position`.** `FlythroughCamera.update()`
  writes `camera.position = frame.position` at L119 and that's
  the subsystem's job (motion-produces pipeline). If the camera
  mode dispatch somehow gets involved in position writing
  (e.g., a SHOWCASE that "backs off" to compose a wider shot),
  that's the reverse-flow Principle 5 violation. Camera mode
  authors orientation (+ FOV + framing-scale inputs); it does
  NOT author position.
  **Why it happens:** composing a wide shot can feel like a
  camera-position move (move the camera further back to fit
  the whole ring system in frame). That's authored by changing
  **FOV**, not position. The ship's position is the subsystem's
  output.
  **Guard:** AC #3 verifies `camera.position = frame.position`
  stays at the start of `FlythroughCamera.update()`. If a mode
  writes to `camera.position` outside that line, escalate to
  Director. FOV is fair game for modes to set; position is not.

## In scope

- **New module `src/auto/CameraChoreographer.js`** (name
  provisional; working-Claude picks the final name, role is
  fixed). Owns the current `CameraMode`, the dispatch surface,
  and the mode-transition event emission. Instantiated alongside
  `ShipChoreographer`; per-frame `cameraChoreographer.update(dt,
  motionFrame, shipPhase)` produces the target lookAt point +
  any framing-level overrides (FOV, roll, pan-ahead yaw offset)
  that `FlythroughCamera` consumes.

- **New module `src/auto/EstablishingMode.js`** (name provisional).
  The V1 authored camera mode. Implements the
  `ESTABLISHING` criteria: independent pacing, linger on
  receding subjects, pan-forward toward incoming targets, wide
  FOV, slow angular velocity. Consumes: the ship choreographer's
  current ship phase (as input signal, not selector), the
  subsystem's motion frame (ship position, velocity,
  `lookAtTarget` as one candidate target among several), the
  OOI stub interface (returns empty arrays in V1 but called
  through so V-later wire-up is architectural no-op).

- **Stub SHOWCASE + ROVING branches in the dispatch** — V1 falls
  back to ESTABLISHING behavior through the dispatch (not around
  it). The branches exist, reference the OOI stub interface,
  and route back through the ESTABLISHING implementation as a
  fallback when V1's empty OOI arrays mean "nothing to showcase
  / nothing to rove toward." The fallback is through the
  dispatch so V-later is a replacement of the fallback, not a
  restructure.

- **OOI query stub interface** (`src/auto/OOIRegistry.js` or
  equivalent, name provisional). Exports `getNearbyOOIs(camera,
  radius) → []` and `getActiveEvents(now, horizon) → []` per
  §10.9. V1 implementation returns empty arrays. Module exports
  the interface so V-later can swap the implementation without
  changing any call site.

- **Autopilot event-surface `camera-mode-change` emission** —
  `setCameraMode(newMode)` on the choreographer emits
  `autopilotEvents.emit('camera-mode-change', { from, to })`.
  V1 zero subscribers. The `autopilotEvents` object itself may
  need to be bootstrapped in this workstream if it doesn't exist
  yet (it should, per §10.7; verify in `src/main.js` or the
  autopilot module index). If it doesn't exist, ship a minimal
  emitter — V1's other events (`phase-change`, `toggle`) are
  WS 4's scope but the emitter itself is shared infrastructure.

- **`FlythroughCamera` integration changes — minimal and
  order-preserving.** `FlythroughCamera` takes a reference to
  the camera choreographer (or equivalent source of
  `lookAtTarget` + framing overrides) in its constructor. Per-
  frame: `FlythroughCamera.update()` reads `lookAtTarget` and
  framing overrides from the choreographer instead of from
  `frame.lookAtTarget`. Position write, free-look, rot-blend
  slerp, and shake composition all unchanged. AC #3 is the
  direct test of this. The diff to `FlythroughCamera.js` should
  be small — a dependency injection + one line changed (reading
  `target` from a different source).

- **Call-site wiring in `src/main.js`** — camera choreographer
  instantiated, passed to `FlythroughCamera`, per-frame update
  wired. Debug hooks (`window._autopilot.getCameraMode()`,
  `window._autopilot.setCameraMode('SHOWCASE')` for manual
  testing the dispatch) added under `window._autopilot` alongside
  existing debug hooks.

- **Canvas recording per AC #9.** Primary Sol tour at
  `screenshots/max-recordings/autopilot-camera-axis-retirement-2026-04-23.webm`.
  Via `~/.claude/helpers/canvas-recorder.js` +
  `~/.local/bin/fetch-canvas-recording.sh`.

- **Commits per AC #10** — dispatch infrastructure; ESTABLISHING
  mode; OOI stub + event emission — separable, each naming the
  AC it closes. Call-site wiring may be its own commit or fold
  into the dispatch commit.

- **`## Status` line in this brief** flipped from `Scoped
  2026-04-23` → `VERIFIED_PENDING_MAX <sha>` → `Shipped <sha>
  — verified against <recording-path>` per protocol.

- **Feature doc `## Workstreams` section** updated to list this
  brief under "Child workstream briefs" (promoted from the
  "Future workstreams" list bullet "Camera-axis decoupling").
  Per `docs/PERSONAS/pm.md` §"PM-specific paths": the PM commits
  this update as part of the workstream-bootstrap commit.

## Out of scope

- **`SHOWCASE` authored behavior.** The dispatch branch exists
  (AC #1), references OOI stubs (AC #7), and falls back through
  the dispatch to ESTABLISHING. Authored SHOWCASE behavior —
  crescent framing, eclipse composition, ring-shadow, moon-
  transit — is a separate future workstream gated on the OOI
  runtime registry (`ooi-capture-and-exposure-system-2026-04-20.md`)
  lighting up.

- **`ROVING` authored behavior.** Same shape — branch exists,
  OOI query references exist, authored rove-toward-interesting-
  nearby behavior is V-later.

- **OOI runtime registry implementation.** V1 stubs return
  empty arrays; V-later populates them via the capture-and-
  exposure workstream.

- **Autopilot toggle UI, keybinding, HUD-hide, warp-select tour-
  complete handoff, manual-override integration.** All WS 4.
  This workstream's camera-mode-change event fires correctly at
  toggle-off (when WS 4 wires the toggle to shut down the camera
  choreographer); wiring the toggle itself is WS 4.

- **BGM subscription to `camera-mode-change`.** V1 emits with
  zero subscribers per §10.7 invariant. The audio layer's
  subscription is a later workstream.

- **Additional phase-change / toggle event-surface events.**
  If `autopilotEvents` doesn't exist yet, this workstream may
  bootstrap it — but it only emits the `camera-mode-change`
  event. WS 4 owns `phase-change` and `toggle` emission.

- **The travel-feel speed-field parking-lot issue** (`docs/FEATURES/autopilot.md`
  §"Parking lot"). Unrelated to camera axis; feature-level
  articulation work Max has parked for a separate pass.

- **The approach-orbit continuity workstream.** Separate — the
  velocity-curve smoothness across CRUISE → APPROACH → STATION
  is a ship-axis / subsystem concern.

- **Legacy `FlythroughCamera.State` enum removal.** Already done
  in WS 1; there is no enum to remove. See §Premise correction.

- **Legacy camera debug-follow behavior removal.** The "camera
  passively follows subsystem lookAtTarget" behavior is what
  `ESTABLISHING` replaces; once `CameraChoreographer` is wired,
  the passive-follow behavior is no longer the code path — the
  choreographer drives the target. No separate "remove the old
  behavior" commit; it is replaced by the new behavior in the
  same commit that wires the choreographer.

- **Per-body ESTABLISHING tuning (FOV curves, linger durations
  per body size, pan-ahead magnitudes).** V1 picks reasonable
  starting values per the perceptual criteria; tuning is a
  recording-review concern. Open to Max's feedback on the
  AC #9 recording; not scope-expansion-blocking.

- **Per-spectral-class framing for star STATION.** The star-
  orbit-distance workstream handles the ship-side safe-distance
  multiplier; ESTABLISHING at star STATION uses whatever
  framing parameters the V1 implementation picks. Per-spectral-
  class camera tuning is V-later.

## Handoff to working-Claude

Read this brief first, especially §Premise correction — the
framing you may have in your head ("retire the legacy State enum")
is already done by WS 1; the actual work is the camera-axis
dispatch + ESTABLISHING authoring + OOI stub + event emission.

Then, in order:

1. **`docs/FEATURES/autopilot.md` in full**, especially:
   - §"Two-axis phase structure" — Camera axis (the three-mode
     enum).
   - §"Per-phase criterion — camera axis (V1)" — `ESTABLISHING`
     (the AC source for #4, #5, #6).
   - §"V1 — must ship" (the bullets this workstream closes).
   - §"V1 architectural affordances for V-later items" (the
     CameraMode enum as first-class selector, the OOI runtime
     interface stub, the camera-mode-change event).
   - §"Drift risks" #1 (re-coupling — the Director's top watch).
   - §"Failure criteria / broken states" (*"Camera feels locked
     to ship"* is the failure mode this workstream exists to
     prevent).

2. **`docs/SYSTEM_CONTRACTS.md` §10 in full**, especially §10.1
   (two-axis state machine — camera axis is this workstream's
   half), §10.2 (ORBIT retirement migration invariant), §10.7
   (event-surface hook — camera-mode-change emission), §10.9
   (OOI query interface stub), §10.10 (contract precedence).

3. **`docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md`**
   — WS 1, `Shipped 3d53825`. Confirms the `State` enum is
   already retired. Read the MotionFrame contract (the camera
   choreographer consumes MotionFrame as input to its framing
   decisions).

4. **`docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`**
   — WS 2. Read the Status block and the shake-provider hookup.
   The shake composition ordering in `FlythroughCamera.update()`
   is preserved by this workstream — AC #3.

5. **`docs/WORKSTREAMS/autopilot-shake-redesign-2026-04-21.md`**
   — the rotation-only shake mechanism shipped at `1bb5eb2`.
   Read `## Status` + the shake surface (`shakeEuler` vs. the
   retired `shakeOffset`). Any WS 3 edit that regresses the
   shake composition is a Principle 6 violation against a just-
   shipped feature.

6. **`src/auto/FlythroughCamera.js`** — read in full. The module
   is 193 lines at HEAD. Note the `update()` method's five-step
   order (L119 position write → L121–123 lookAt →
   L128–134 rot-blend slerp → L140–147 shake composition).
   That order is AC #3; preserve it.

7. **`src/auto/ShipChoreographer.js`** — read the top JSDoc block
   (through ~L75) for the ship-axis contract. Note the
   `ShipPhase` enum (`IDLE / ENTRY / CRUISE / APPROACH / STATION`)
   — this is the input signal `EstablishingMode` consults, NOT
   the selector it switches on (drift-risk #2 / AC #8).

8. **`src/auto/NavigationSubsystem.js`** — top JSDoc block + the
   `MotionFrame` shape. The subsystem's `lookAtTarget` is one
   candidate target the camera mode may choose; not the only
   one, not automatically authoritative.

9. **`src/main.js`** — specifically the autopilot integration
   block (`shipChoreographer`, `flythrough`, `setShakeProvider`,
   the per-frame update loop around L340–600). This is where
   `CameraChoreographer` is instantiated and wired; diff will
   be small.

10. **`docs/MAX_RECORDING_PROTOCOL.md`** — §"Capture path —
    canvas features (default)" for the AC #9 recording.

11. **`feedback_motion-evidence-for-motion-features.md`** — the
    cross-project principle. ESTABLISHING is a motion-class
    feature (independent-pacing linger, pan-forward); recording
    is the acceptance artifact, not screenshots.

Then, in order of execution:

1. **Design the `CameraChoreographer` data model.** Before code:
   name the state (current mode, transition-in-progress flag,
   ESTABLISHING's own state — what it's framing, how long it's
   been framing it, whether a linger or pan is in progress,
   target the linger/pan is bound to). Surface the model in
   chat and sanity-check against §10.1 + §10.2 migration invariant
   (AC #8 — mode state is camera-axis only, not ship-phase-keyed)
   before implementing.

2. **Implement the `CameraMode` enum + dispatch surface** (AC #1,
   AC #2). First class selector; SHOWCASE / ROVING branches exist
   and fall back through the dispatch.

3. **Implement the OOI stub interface** (AC #7). Empty-array
   returns. Wire the SHOWCASE / ROVING branches to consume it.

4. **Implement `EstablishingMode`** (ACs #4, #5, #6, #8). Consult
   ship phase as input signal, not switch on it. Author linger
   on receding subjects and pan-forward toward incoming targets.

5. **Wire the event-surface** (AC #2). If `autopilotEvents`
   doesn't exist yet, bootstrap it minimally. Emit
   `camera-mode-change` on transitions only; idempotent on
   same-mode assignment.

6. **Wire `FlythroughCamera` to consume from the choreographer**
   (AC #3). Minimal diff; preserve the update-order. Shake
   composition unchanged.

7. **Intra-session sanity check via `mcp__chrome-devtools__*`**
   (per `feedback_prefer-chrome-devtools.md`, NOT Playwright).
   Dev-shortcut to Sol, trigger warp-exit, watch ESTABLISHING
   author a linger at STATION → CRUISE. Screenshot for a
   self-audit. Run the existing shake-verify recording back
   (or its debug hook) to confirm shake mechanism is preserved
   — AC #3's "shake mechanism is NOT regressed" check.

8. **Capture the AC #9 recording** — Sol warp-exit → full tour,
   45–90 s, covering at least one STATION → CRUISE transition
   for AC #5 and one CRUISE pan-forward beat for AC #6.

9. **Surface contact sheets** (`~/.local/bin/contact-sheet.sh`)
   for the recording to Max. Highlight the timestamps of:
   (a) STATION → CRUISE transition on a planet, (b) a CRUISE
   beat where the camera is panned forward ahead of ship heading,
   (c) the warp-exit → ENTRY transition for shake-mechanism
   regression-check continuity.

10. **Commit per AC #10** — stage only specific files touched
    (`src/auto/*.js`, `src/main.js`, this brief, feature doc
    `## Workstreams` section update). Never `git add -A`.

11. **Close at `VERIFIED_PENDING_MAX <sha>`.** Max evaluates
    against the recording. On pass → `Shipped <sha>`; on fail
    → diagnose per the failure class (ESTABLISHING reads as
    smoothed-follow? author the linger / pan-ahead state. Shake
    regressed? check `FlythroughCamera.update()` order. Mode
    dispatch firing per-frame? transition-only emission fix.
    Camera coupled to ship phase? extract mode state from
    ship-phase switch).

**If the diff touches `FlythroughCamera.update()`'s five-step
order (position → lookAt → rot-blend → shake), stop and
escalate to Director.** That order is the shake-redesign's
ship-gate invariant and this workstream is not authorized to
renegotiate it.

**If the `EstablishingMode` update method is structured as
`switch (shipPhase)`, stop.** AC #8 / drift-risk #2 / feature-
doc §"Drift risks" #1 all name this as the foreclosing-V-later
anti-pattern. Refactor to camera-axis-state-primary.

**If you find yourself wanting to implement "just a little
SHOWCASE," stop.** Drift-risk #1. SHOWCASE is a separate
workstream gated on OOI runtime registry.

Artifacts expected at close: 3–4 commits (dispatch infrastructure
+ ESTABLISHING + OOI stub + event emission + call-site wiring,
separable per AC #10); one canvas recording at path in AC #9;
this brief at Shipped with recording path cited; feature doc's
`## Workstreams` section updated; any followups spawned (per-
body ESTABLISHING tuning, per-spectral-class framing, etc.)
recorded as new entries in this brief's §Followups (if added).

Drafted by PM 2026-04-23 as WS 3 of 4 in the V1 autopilot
sequence.
