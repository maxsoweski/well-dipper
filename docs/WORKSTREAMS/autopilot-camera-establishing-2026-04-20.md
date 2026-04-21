# Workstream: Autopilot camera-axis restructure — ESTABLISHING mode (2026-04-20)

## Status

Scoped — awaiting working-Claude execution. Third of four sequential
workstreams delivering V1 autopilot. **Depends on
`autopilot-navigation-subsystem-split-2026-04-20.md` (WS 1, commit
`656ded3`) and `autopilot-ship-axis-motion-2026-04-20.md` (WS 2,
commit `2be6f37`) landing first.** See `docs/FEATURES/autopilot.md`
§"Workstreams" for the full sequence and this brief's §"Sequencing"
below for the execution order across all four.

Drafted by PM 2026-04-20 as WS 3 of 4 in the V1 autopilot sequence.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
commit `bdeb0ff` with keybinding update at `4b9b18a`.

Specific sections this workstream serves:

- **§"Two-axis phase structure" — Camera axis** — the three-mode
  table (`ESTABLISHING / SHOWCASE / ROVING`) of which V1 implements
  **only `ESTABLISHING`**. The feature doc is explicit: *"Camera
  mode is selected per-moment, not per-ship-phase."* This workstream
  is the camera-axis half of the two-axis decoupling that WS 2
  could not complete.
- **§"Per-phase criterion — camera axis (V1)"** — `ESTABLISHING`'s
  four felt-experience criteria (wide/slow/composed; pace with ship
  but not coupled frame-for-frame; linger on receding subject; pan
  forward toward ship heading). Workstream ACs cite them verbatim.
- **§"V1 — must ship"** — the bullets this workstream closes:
  *"Ship/camera decoupling architecture — the two-axis structure
  must be in place at V1 even though only `ESTABLISHING` is
  exercised on the camera axis."* and *"`ESTABLISHING` camera mode
  — paces independently of ship phase, can linger/pan."*
- **§"V1 architectural affordances for V-later items"** —
  specifically: *"`SHOWCASE` / `ROVING` camera modes → the camera-
  axis code path must be a **first-class selector**, not an
  if-branch inside `ESTABLISHING`. V1 implements a `CameraMode`
  enum (`ESTABLISHING` / `SHOWCASE` / `ROVING`) even if only one
  value is ever selected, and routes camera updates through a
  dispatch that can accept any of the three. Adding `SHOWCASE`
  later is a new branch, not a restructure."* This dispatch
  architecture is the workstream's load-bearing deliverable.
- **§"Failure criteria / broken states"** — specifically:
  *"Camera feels locked to ship — the player's eyes can't linger,
  can't pan independently. Violates the two-axis decoupling."*
  This is the central perceptual AC for ESTABLISHING.
- **§"Drift risks" #1** — *"Re-coupling ship + camera axes under
  'simplicity.' The two-axis structure is V1-mandatory because
  `SHOWCASE` and `ROVING` require it. Any V1 implementation that
  bakes `ESTABLISHING` into ship-phase logic (because it's the
  only camera mode V1 exercises) is storing an architectural
  rewrite cost against V-later."* The foundational risk this
  workstream is written against.

Primary contracts: **`docs/SYSTEM_CONTRACTS.md` §10.1 Two-axis
state machine** (camera axis: `ESTABLISHING | SHOWCASE | ROVING`
with orthogonality invariant *"Any state encoding that forces
camera mode to be a function of ship phase is a contract
violation"*), **§10.2 `ORBIT` retirement** (the camera-framing
half of retired `ORBIT` is the seed of `SHOWCASE`; must not be
re-fused with the ship-holding `STATION`), **§10.3 Two-layer
architecture** (camera-axis code runs in the cinematography
layer that WS 1 already split), **§10.9 OOI query interface
stub** (this workstream lands the stub — `SHOWCASE` / `ROVING`
V-later will subscribe).

Secondary contracts: §5.3 Drive States — the autopilot column
names "what writes the camera this frame" as autopilot's
cinematography layer; this workstream defines the dispatch path
inside that writer.

## Implementation plan

N/A (feature is workstream-sized at the camera-axis scope). The
camera rewrite is a bounded replacement of `FlythroughCamera`'s
update loop with a mode-dispatching update loop; the Hermite
spline + double-smootherstep work lives inside `ESTABLISHING`'s
implementation where it still fits. No cross-system state machines
beyond what §10 already supplies. If mid-work working-Claude
discovers the authored linger/pan system wants its own PLAN doc
(e.g. because the camera's pose controller wants a formal state
machine in addition to the mode dispatcher), escalate to PM for
a PLAN bootstrap rather than expanding this brief.

## Scope statement

Retire `FlythroughCamera.State = { DESCEND, ORBIT, TRAVEL, APPROACH }`
at `src/auto/FlythroughCamera.js:26` — the single-axis enum that
conflated ship motion with camera framing. In its place, land the
two-axis camera-mode dispatcher: a `CameraMode` enum
(`ESTABLISHING / SHOWCASE / ROVING` per §10.1) with a first-class
selector that routes each frame's camera update through a
dispatch table. V1 implements **only `ESTABLISHING`**; `SHOWCASE`
and `ROVING` have registered mode-slots that return a not-implemented
sentinel (stub the dispatch, not the consumer — V-later lights up
the implementations without changing the dispatcher).

Implement `ESTABLISHING` per feature doc §"Per-phase criterion —
camera axis (V1)": wide/slow composed framing that **paces
independently of ship phase**. The camera can linger on a receding
subject (e.g. the planet the ship just finished `STATION`-ing
around, while the ship has already begun `CRUISE` toward the next
body), then pan forward toward the ship's heading ahead of the
ship's arrival. This is the load-bearing decoupling: **camera pose
is NOT a function of ship pose** — camera pose is a function of
(what the camera is currently composing against) AND (how far along
its own linger/pan envelope it is).

Preserve WS 2's camera debug follow-mode path as scaffolding until
this workstream retires it; the final diff replaces the debug
follow-mode with the authored `ESTABLISHING` update.

**Preserve what still fits from the existing camera code:** the
Hermite spline work (`_departTangentScaled`, `_arrivalTangentScaled`,
`hermite()` at `src/auto/FlythroughCamera.js:694`) and the
double-smootherstep easing (`src/auto/FlythroughCamera.js:503` +
§`Travel easing — slow departure, fast cruise, slow arrival` at
:513) are legitimate cinematic tools for a wide/slow composed
camera; `ESTABLISHING` can reuse them where it fits. **Discard
what doesn't:** the ship-holding concerns baked into the existing
`ORBIT` state (the retired `ORBIT` in §10.2) stay discarded; any
motion expressed as "camera = ship + some offset" is a coupling
violation and must be rewritten.

Land the **OOI query interface stub** per §10.9 (`getNearbyOOIs`,
`getActiveEvents` — both returning `[]` in V1). The stub lives in
the cinematography layer's camera-mode dispatch so V-later can
wire OOI-aware SHOWCASE / ROVING without changing the dispatcher.

This is one unit of work because the camera-axis rewrite cannot
be landed incrementally — the mode dispatcher, the enum retirement,
and `ESTABLISHING`'s update path are entangled in a single
`update(deltaTime)` surface on the camera module. Shipping
half — keeping the old state enum alongside the new dispatcher,
say — produces a dual-system mess that the next workstream
(WS 4) has to reason about.

**Explicitly NOT in the bundle:** SHOWCASE and ROVING are V-later
per feature doc §"V1 / V-later triage." The dispatcher must
**accept them as valid mode values** (the enum contains all three
from V1) and must route to stub implementations; actually
authoring SHOWCASE / ROVING frame behavior is out of scope.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Vision / Core Experience — the
**Discover** axis specifically: *"Every system is different.
Finding a terrestrial world or an alien megastructure is rare and
meaningful."* Discovery is an act of the player's **eyes**, not
the ship's body. The camera-axis decoupling is the architectural
basis for the player-eye independence the feature doc §"Heart's
desire" articulates: *"the camera moves in 360° independently of
the ship, looking at nearby stars, galactic features (nebulas in
the starfield), the disk of the galaxy, planets and their details,
moons, planet-moon relationships, planet-star relationships."* WS
2 authored the ship's body; this workstream authors the player's
eyes.

Advances `docs/GAME_BIBLE.md` §2 Aesthetic — the 60s/70s space
cinematography register: *"Blue Danube over 2001's station-docking
sequence as the touchstone."* That sequence is built of composed
frames — a wide lens, a slow pan, a held moment on a receding
body before the cut. `ESTABLISHING` is this register made into
game code. Without the ability to linger / pan independently of
ship motion, the game cannot compose in this register; the camera
is locked behind the ship and the sequence reads as first-person
chase cam.

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 6 — First Principles Over Patches.** The existing
  `FlythroughCamera.State` enum is the canonical example of a
  patched structure. The class started as a single-axis state
  machine; deep-sky tours, navigable-cluster tours, per-planet
  linger heuristics, and queue-index-jump affordances were each
  added as patches. Patching again to support "the camera pans
  independently" would cross the 2–3 patch line. The first-
  principles move is the two-axis model: ship axis lives in
  WS 2's choreographer, camera axis lives in the dispatcher
  this workstream lands.
- **Principle 2 — No Tack-On Systems.** The feature doc §"V1
  architectural affordances" is explicit that SHOWCASE / ROVING
  must be **first-class selectors, not if-branches inside
  ESTABLISHING**. The seductive shortcut is to bake camera
  behavior into ship-phase logic because V1 only exercises one
  camera mode; that shortcut is the tack-on anti-pattern.
  Dispatch routing the update through a mode-selector (even
  when only one mode exists today) is the first-class path.
- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** The camera is the renderer. Generator data flows
  through the cinematography layer; the cinematography layer
  consumes ship state (WS 2's choreographer output) + target
  body state (from the queue) + OOI query results (V1 stub)
  and produces a camera pose. Camera pose never feeds back into
  ship motion or queue logic.

## Acceptance criteria

Phase-sourced per `docs/PERSONAS/pm.md` §"Per-phase AC rule."
The camera-axis rewrite is a visible feature — phased/authored
experience — so the Shipped-gate uses **motion evidence** per
`docs/MAX_RECORDING_PROTOCOL.md` (canvas-path) and
`feedback_motion-evidence-for-motion-features.md`.

1. **`FlythroughCamera.State = { DESCEND, ORBIT, TRAVEL, APPROACH }`
   is retired.** The enum at `src/auto/FlythroughCamera.js:26` is
   removed. Any code referencing `State.DESCEND / ORBIT / TRAVEL
   / APPROACH` by name is rewritten to use the new two-axis
   structure (ship axis lives in WS 2's choreographer; camera
   axis lives in this workstream's `CameraMode` enum). Verified
   by `grep`: zero references to `State.DESCEND`, `State.ORBIT`,
   `State.TRAVEL`, `State.APPROACH` remain in `src/**`.

2. **`CameraMode` enum exists with all three V1-defined values
   and a first-class dispatcher** (per feature doc §"V1
   architectural affordances for V-later items" and §10.1). The
   enum contains `ESTABLISHING`, `SHOWCASE`, `ROVING`. The
   dispatcher routes each frame's camera update through the
   selected mode; V1 routes only to `ESTABLISHING` in normal
   operation, but `SHOWCASE` and `ROVING` mode slots are
   registered and dispatch-callable (returning a stub
   implementation that logs-and-noops, or that calls
   `ESTABLISHING` as a fallback — pick one and document in code).
   Verified by reading the camera module's update loop:
   `dispatchMode(mode, state, dt)` exists; each mode is a
   registered function-slot, not an inline `if (mode === …)`
   branch.

3. **`ESTABLISHING` — wide/slow composed framing** (per
   `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera
   axis (V1)": *"Default camera mode for V1. Paces with the ship
   phase but **is not coupled to it frame-for-frame.**"* and
   *"Wide FOV, slow angular velocity, composed framing."*).
   Verified in Max's primary canvas recording: the frame is wide
   (the target body is NOT filling the frame until APPROACH /
   STATION), camera angular velocity is visibly slow, and
   composition reads as composed (the body sits off-center or
   framed against the starfield in a way that reads as
   deliberate rather than auto-tracked). Diagnostic backup:
   camera yaw / pitch angular-velocity peaks are notably lower
   than ship velocity-direction-change rates during the same
   window.

4. **`ESTABLISHING` — linger on receding subject** (per
   `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera
   axis (V1)": *"Can **linger** on a receding subject as the
   ship begins the next phase (e.g. on the planet the ship just
   finished STATION-ing, while the ship starts CRUISE toward
   the next body)."*). Verified in Max's primary canvas
   recording: at the STATION → CRUISE transition for at least
   one body (Earth is the natural candidate at Sol), the camera
   is observably still **pointing at the body** for some window
   AFTER the ship has begun CRUISE. The body is receding in
   frame; the ship is moving away from it; the camera has not
   yet cut or panned to the next target. Diagnostic backup:
   there exists a frame range T1..T2 where ship velocity
   direction points toward planet B (the next target) while
   camera look-direction points at planet A (the body just
   departed). This is the decoupling made visible.

5. **`ESTABLISHING` — pan forward toward ship heading** (per
   `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera
   axis (V1)": *"Can **pan forward** toward the direction the
   ship is heading, ahead of the ship's arrival."*). Verified
   in Max's primary canvas recording: after the linger above
   completes, the camera pans forward (not cuts) to compose
   the approach toward the next target. The pan is slow (AC
   #3 criterion) and arrives at its forward-framing before
   the ship's APPROACH phase begins. Diagnostic backup: in the
   frame range after linger-end, camera angular velocity is
   non-zero in the direction of the next target's screen-space
   bearing, and the resulting frame at APPROACH-start shows
   the target composed (off-center with lead room, or framed
   against the star, or similar — NOT centered auto-tracker
   style).

6. **`ESTABLISHING` — does NOT rove 90° off-path to look at a
   nebula; does NOT zoom to crescent-at-terminator beat** (per
   `docs/FEATURES/autopilot.md` §"Per-phase criterion — camera
   axis (V1)": *"**Does NOT** rove 90° off-path to look at a
   nebula for its own sake. That's `ROVING` (V-later)."* and
   *"**Does NOT** zoom to a specific compositional beat like a
   crescent-at-terminator. That's `SHOWCASE` (V-later)."*).
   Verified in Max's primary canvas recording: the camera's
   look-direction stays within a reasonable cone of the
   "current subject or next target" axis throughout — no
   surprise pans to unrelated starfield features, no zooms to
   compositional beats. This is the scope guard: if
   `ESTABLISHING` drifts toward SHOWCASE or ROVING behavior,
   the architectural slot for those modes is being consumed
   by its neighbor.

7. **Camera update goes through the mode dispatcher; no ship-
   phase-coupled camera logic remains.** (Per `docs/SYSTEM_CONTRACTS.md`
   §10.1: *"Any state encoding that forces camera mode to be a
   function of ship phase is a contract violation."* and
   feature doc §"Drift risks" #1.) Verified by reading the
   camera module's update loop and grepping for references to
   ship-phase names (`ENTRY`, `CRUISE`, `APPROACH`, `STATION`).
   The camera MAY read the ship choreographer's current phase
   as **input to a pacing heuristic** (e.g. "if ship is in
   STATION, subject of composition is the planet being
   stationed around"), but the camera's frame-by-frame pose
   is NOT computed as `f(shipPhase)`. A camera update path of
   shape `if (shipPhase === 'STATION') { camera.pose = orbitPose(); }`
   is a contract violation.

8. **OOI query interface stub** lives in the camera dispatch
   path (per §10.9). Two functions exist as V1 stubs:
   `getNearbyOOIs(camera, radius) → []` and
   `getActiveEvents(now, horizon) → []`. The `SHOWCASE` and
   `ROVING` mode-slots READ through these interfaces even
   though V1 never calls those mode-slots in normal operation;
   this is the V-later wiring point. Verified by reading the
   stub module: two exported functions, correct signatures,
   both return empty arrays, with a comment naming
   `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`
   as the V-later implementer.

9. **Hermite spline + double-smootherstep easing preserved where
   they fit `ESTABLISHING`; discarded where they encode retired
   `ORBIT` / `DESCEND` semantics.** Per Scope statement. Verified
   by reading the diff: the Hermite helper (`hermite()` at
   `src/auto/FlythroughCamera.js:694`) survives in some form
   (same-module refactor, or lifted to a helper consumed by
   `ESTABLISHING`); the double-smootherstep easing survives in
   some form for `ESTABLISHING`'s linger/pan pacing. No
   `beginDescend` / `beginOrbit` entry methods remain on the
   camera API — they are replaced by mode-dispatch entry.

10. **Motion evidence at camera-gate** — **one primary canvas
    recording of a full autopilot tour at Sol, authored camera
    not debug follow-mode.** Per `docs/MAX_RECORDING_PROTOCOL.md`
    §"Capture path — canvas features (default)". 30–60 s covering
    warp-exit → ENTRY → CRUISE → APPROACH (star) → STATION
    (star) → CRUISE → APPROACH (Earth) → STATION (Earth) →
    CRUISE handoff to next planet. Drop path:
    `screenshots/max-recordings/autopilot-camera-establishing-2026-04-20.webm`.
    ACs #3–#6 evaluated against this recording. AC #4's linger
    is evaluated at the STATION(Earth) → CRUISE(next) transition;
    AC #5's pan is evaluated at the CRUISE transition that
    follows; AC #6's negative scoping is evaluated across the
    whole recording.

    Per the Shipped-gate protocol: working-Claude closes at
    `VERIFIED_PENDING_MAX <commit-sha>` after the commit(s) land
    and the recording is on disk. Shipped flips on Max's verdict
    against the recording, not on agent inspection of camera
    yaw/pitch values in the console.

11. **Ship motion from WS 2 is unchanged** (per §10.1 orthogonality,
    the camera axis rewrite does not touch the ship axis). Verified
    by `git diff src/auto/ShipChoreographer.js` (or whatever WS 2
    named the ship-motion module): zero changes. If the camera
    rewrite surfaces a "I need to change ship behavior" question,
    stop and escalate — that is a scope-violation or a §10
    orthogonality violation.

12. **One or more commits, separable by concern.** Camera-axis
    dispatcher + enum retirement in one commit
    (`feat(autopilot): retire FlythroughCamera.State, land
    CameraMode dispatcher`); `ESTABLISHING` implementation in a
    separate commit (`feat(autopilot): camera ESTABLISHING mode
    — wide/slow linger/pan composition`); OOI stub interface in
    a separate commit (`feat(autopilot): OOI query interface
    stub (V1 — V-later implementation)`). No omnibus "camera
    axis done" commit. Each commit names the AC(s) it closes.
    Stage only specific files touched — never `git add -A` — per
    `docs/PERSONAS/pm.md` §"Commit discipline."

## Principles that apply

Four of the six from `docs/GAME_BIBLE.md` §11 are load-bearing.
Principle 3 (Per-Object Retro Aesthetic) is orthogonal to the
camera-axis rewrite; Principle 4 (BPM-Synced Animation) is
V-later per feature doc §"V-later" and WS 2's analysis — V1
`ESTABLISHING` paces against ship motion and its own linger
envelope, not against a BPM clock.

- **Principle 2 — No Tack-On Systems.** Headline principle for
  this workstream. The feature doc §"V1 architectural affordances"
  is explicit that SHOWCASE / ROVING must be first-class slots,
  not if-branches inside ESTABLISHING. *Violation in this
  workstream would look like:* implementing `ESTABLISHING`
  directly inside `FlythroughCamera.update()` with no dispatch
  indirection, reasoning that "V1 only has one mode, the
  dispatch is overhead." That is the tack-on: V-later has to
  restructure the update loop to add SHOWCASE; the restructure
  cost was supposed to be paid in V1, not deferred.
  *Another violation pattern:* adding a mode dispatcher but
  having ESTABLISHING's implementation peek at ship-phase and
  branch on it (`if (shipPhase === 'APPROACH') { … } else { … }`).
  That's coupling the camera axis to the ship axis, which §10.1
  forbids. ESTABLISHING reads "what subject am I composing
  against right now" from the cinematography layer's current-
  subject tracker; ship phase is context, not control flow.

- **Principle 6 — First Principles Over Patches.** The existing
  `FlythroughCamera.State` enum has been patched across sessions;
  this workstream retires it rather than accepting another
  patch. *Violation in this workstream would look like:*
  renaming `DESCEND → ENTRY_CAMERA`, `ORBIT → STATION_CAMERA`,
  `TRAVEL → CRUISE_CAMERA`, `APPROACH → APPROACH_CAMERA` inside
  the existing single-axis enum and calling the workstream
  done. That's a rename, not a restructure — the structural
  problem is that the camera's state is a single axis. The
  fix is two orthogonal axes, with ship axis owned by WS 2's
  choreographer (already shipped) and camera axis owned by
  this workstream's `CameraMode` dispatcher.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** The camera is the renderer. The camera consumes:
  ship position + velocity (WS 2 choreographer), current subject
  (cinematography layer's subject tracker), target body for
  next approach (from the queue), OOI query results (V1 stub).
  The camera produces: a pose per frame. *Violation in this
  workstream would look like:* the camera writing back to the
  ship choreographer ("the ship should slow down because I
  need more linger time"). Reverse flow. If the linger envelope
  needs more time than ship motion currently affords, the
  cinematography layer tunes the pacing — the camera does not
  push on the ship. Another violation: the camera querying
  the hash grid directly to find "what's nearby for composition."
  The OOI interface from §10.9 is the correct abstraction; the
  camera reads through it, doesn't re-invent the query.

- **Principle 1 — Hash Grid Authority** (diagnostic, not
  central). The camera dispatch reads current subject + next
  target as resolved body references from the cinematography
  layer — it does NOT query the hash grid, `GalacticMap`, or
  any generator for "what's there." If the camera ever needs
  "what nebula is in my field of view," that query goes
  through the OOI interface (stub in V1, runtime registry
  V-later); the camera never re-resolves positions. *Violation
  would look like:* camera code importing from `src/generation/`.

## Drift risks

- **Risk: Baking `ESTABLISHING` into ship-phase logic because it's
  the only camera mode V1 exercises.** The feature doc §"Drift
  risks" #1 names this as the load-bearing failure mode. The
  seductive version: implement `ESTABLISHING` as a set of
  per-ship-phase camera behaviors (ENTRY-camera, CRUISE-camera,
  APPROACH-camera, STATION-camera), ship the workstream, declare
  V1 done. Result: SHOWCASE and ROVING in V-later have to
  restructure the update loop to exist — exactly the architectural
  rewrite cost the V1 affordance was written to avoid.
  **Why it happens:** V1 has one camera mode; "dispatch through a
  mode selector" feels like overengineering. The ship-phase is
  visible, the camera mode is invisible (because there's only
  one), so ship-phase becomes the organizing principle by default.
  **Guard:** AC #2 requires the `CameraMode` enum + dispatcher
  to exist. AC #7 requires the camera update path to NOT be
  computed as `f(shipPhase)`. AC #8 requires the stub mode-slots
  to be dispatch-callable (proving the dispatcher can route to
  them). If the dispatcher is missing or SHOWCASE/ROVING have
  no registered slots, the workstream has landed the tack-on
  anti-pattern.

- **Risk: Linger/pan implemented as a hard-coded timer keyed to
  ship-phase.** Related but distinct. Working-Claude implements
  "linger for N seconds after STATION ends, then pan for M
  seconds before APPROACH begins." The result LOOKS like
  decoupling in a single recording, but it IS coupling — the
  camera's timing is driven entirely by ship phase with fixed
  offsets.
  **Why it happens:** a ship-phase-keyed timer is the simplest
  way to write "linger then pan" if you treat the camera as a
  slave to ship motion.
  **Guard:** the linger/pan is authored against the camera's
  OWN pacing — the camera knows "I'm in a linger envelope right
  now; the linger envelope has elapsed X of Y seconds; when it
  completes I transition to pan envelope." Ship-phase is CONTEXT
  (the cinematography layer selects which subject the camera
  composes against), not CONTROL (the camera's moment-to-moment
  pose is not a function of shipPhase). AC #4 and AC #5's
  diagnostic backups require the linger window to exist as a
  frame range where ship-velocity-direction and
  camera-look-direction disagree — if they never disagree, the
  linger isn't real, the camera is locked.

- **Risk: Losing the Hermite/double-smootherstep work because
  "we're rewriting the camera."** The existing Hermite spline +
  double-smootherstep easing (`FlythroughCamera.js:503, 513, 694`)
  is legitimate cinematic tooling — slow-fast-slow motion is
  exactly what `ESTABLISHING` wants. Throwing it out under "this
  is a rewrite" is wasted work and probably produces worse motion.
  **Why it happens:** rewrites invite rewrites. The retirement
  of the state enum feels like it should extend to retiring the
  methods on the class.
  **Guard:** AC #9 names this explicitly. Preserve the Hermite
  and the easing; discard the ship-holding concerns that were
  embedded in `beginOrbit` / `beginDescend` / `beginApproach`
  (those are WS 2's concern and already shipped). The new
  `ESTABLISHING` update consumes the easing/spline helpers;
  it does not re-derive them.

- **Risk: Keeping the old state enum alongside the new
  dispatcher "during migration."** The half-migration pattern
  that §"Drift risks" of WS 1 also names. The seductive
  version: land the new `CameraMode` dispatcher but leave the
  old `State` enum in place "for safety," plan to remove it
  later, never do.
  **Why it happens:** dual-structure shrinks blast radius
  during migration.
  **Guard:** AC #1 requires the old enum to be removed.
  Verified by `grep` — zero references to `State.DESCEND`,
  `State.ORBIT`, `State.TRAVEL`, `State.APPROACH` survive.
  The workstream closes with the new structure as the only
  structure.

- **Risk: SHOWCASE and ROVING mode-slots implemented as
  "do nothing" inline rather than as registered dispatch
  targets.** The affordance the feature doc §"V1 architectural
  affordances" names is that SHOWCASE and ROVING dispatch
  correctly even though their implementations are stubs.
  Skipping that affordance (because V1 never calls them) means
  V-later has to restructure the dispatcher to register new
  modes — the exact cost V1 was supposed to pay.
  **Why it happens:** registering stubs that will never be
  called in V1 feels like dead code.
  **Guard:** AC #2 + AC #8. SHOWCASE and ROVING are registered
  mode-slots; the dispatcher CAN route to them; their V1
  implementations log-and-noop or fall through to
  ESTABLISHING (working-Claude's pick). A test-hook
  `camera.setMode('SHOWCASE')` must be dispatchable without
  runtime error — this is the affordance working-Claude can
  exercise during dev to confirm the dispatcher is wired.

- **Risk: The "subject tracker" the camera reads turns out to
  be the ship's current target, computed identically.** The
  cinematography layer has to tell the camera "what are you
  composing against right now" — and if the answer is always
  "whatever the ship's current queue-stop is," the decoupling
  is cosmetic. The linger pattern specifically requires the
  subject tracker to be ABLE to lag the queue ("the ship has
  advanced to the next stop, but the camera is still composing
  against the previous stop because the linger envelope hasn't
  elapsed").
  **Why it happens:** treating the cinematography layer's
  current-subject as identical to the ship's current-target
  is the default path of least resistance.
  **Guard:** AC #4's diagnostic backup specifically requires
  a frame range where ship-velocity-direction (toward next
  target) and camera-look-direction (at previous subject)
  disagree. That is the subject tracker lagging the queue.
  If they never disagree, the subject tracker is pinned to
  the ship's current target — fix the tracker.

- **Risk: Scope inflation into SHOWCASE or ROVING.** The
  dispatcher + enum architecture is V1; the IMPLEMENTATIONS
  of SHOWCASE and ROVING are V-later. Once the dispatcher
  exists, implementing a "simple" SHOWCASE (e.g., zoom to
  body during STATION) feels easy.
  **Why it happens:** the architecture invites the feature.
  **Guard:** §Out of scope below lists SHOWCASE and ROVING
  implementation work explicitly. AC #6 scope-guards
  `ESTABLISHING` against drifting toward SHOWCASE / ROVING
  behavior. If the camera zooms to a body during STATION,
  that's SHOWCASE leakage into ESTABLISHING, which §10.1
  forbids.

## In scope

- **Retire `FlythroughCamera.State` enum** at
  `src/auto/FlythroughCamera.js:26` and all references to its
  four values across `src/`. AC #1.

- **New `CameraMode` enum** (`ESTABLISHING | SHOWCASE | ROVING`
  per §10.1) and **first-class mode dispatcher** — location
  TBD by working-Claude (proposed: inside the surviving
  `FlythroughCamera.js`, or a sibling
  `src/auto/CameraAxisDispatcher.js` if the class wants a
  smaller surface). The dispatcher's API:
  `setMode(mode)`, `update(deltaTime, context)` where the
  dispatcher routes to the registered mode-slot's update
  function. AC #2.

- **`ESTABLISHING` mode implementation** — the V1 camera mode.
  Wide FOV, slow angular velocity, composed framing, linger
  on receding subject, pan forward toward ship heading.
  Authored against the camera's own pacing envelope (linger
  duration, pan duration, FOV parameters) — not keyed to ship
  phase as a control-flow variable. ACs #3–#6.

- **Subject tracker** — the cinematography layer's "what is
  the camera currently composing against?" property that
  `ESTABLISHING` reads. MAY lag the ship's current-queue-stop
  during linger windows. Lives in the cinematography layer
  (the slimmed `AutoNavigator` / `TourOrchestrator` from WS 1),
  not in the camera. The camera reads it; the camera does
  not write it.

- **OOI query interface stub** per §10.9. Module location
  TBD (proposed:
  `src/auto/OOIQueryInterface.js` or equivalent). Exports
  `getNearbyOOIs(camera, radius) → []` and
  `getActiveEvents(now, horizon) → []`. Both return empty
  arrays in V1; comments reference
  `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`
  as the V-later implementer. `SHOWCASE` and `ROVING` stub
  mode-slots import this interface (proving the wiring path
  exists) even though V1 never calls them in normal operation.
  AC #8.

- **Stub implementations of `SHOWCASE` and `ROVING` mode-slots**
  — registered with the dispatcher, dispatch-callable, V1
  behavior is (working-Claude's choice) either log-and-noop
  or fall-through to `ESTABLISHING`. Documented in code which
  fallback was chosen and why. AC #2, AC #8.

- **Removal of WS 2's debug camera follow-mode** — the
  scaffolding that WS 2 added to `FlythroughCamera` to make
  ship motion observable is replaced by this workstream's
  `ESTABLISHING` mode. Verified by `grep`: the debug follow-
  mode symbol from WS 2 is gone. (If WS 2 landed the follow-
  mode as a separate export that's still referenced elsewhere,
  clean it up here.)

- **Primary canvas recording** (authored camera, full tour at
  Sol) per AC #10. Drop path:
  `screenshots/max-recordings/autopilot-camera-establishing-2026-04-20.webm`.
  Captured via `~/.claude/helpers/canvas-recorder.js` +
  `~/.local/bin/fetch-canvas-recording.sh`.

- **Contact sheets for AC-phase-boundary frames** via
  `~/.local/bin/contact-sheet.sh`. Working-Claude surfaces
  specific timestamps for Max to evaluate: warp-exit moment,
  STATION(Earth) → CRUISE linger window, CRUISE pan-forward
  window, APPROACH-start composed frame. Supports Max's
  verdict, does NOT replace the recording.

- **Commits per AC #12** — dispatcher + enum retirement,
  `ESTABLISHING` implementation, OOI stub — separable.

- **`## Status` line in this brief** flipped from "Scoped" →
  `VERIFIED_PENDING_MAX <sha>` → `Shipped <sha> — verified
  against <recording-path>` per protocol.

## Out of scope

- **Ship-axis work.** WS 2 shipped at `2be6f37`. The ship
  choreographer is unchanged. AC #11 is the guard.

- **Navigation-subsystem changes.** WS 1 shipped at `656ded3`.
  The subsystem's API is consumed by the cinematography
  layer, unchanged here.

- **SHOWCASE or ROVING mode IMPLEMENTATIONS** (framed
  compositional beats, 360° player-eye freedom). The
  dispatcher accepts them as registered mode values in V1;
  their implementations are V-later (separate workstream,
  gated on OOI runtime registry from
  `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`).
  Per feature doc §"V1 / V-later triage."

- **OOI runtime registry implementation.** V1 ships the
  interface stub that returns `[]`; the runtime registry
  that lights it up is the
  `ooi-capture-and-exposure-system-2026-04-20.md` workstream.

- **Toggle UI, keybinding, HUD-hide, manual-override, warp-
  select integration, audio event surface.** All WS 4. This
  workstream's authored `ESTABLISHING` camera is the target
  state of the `Autopilot` drive-state; WS 4 wires the
  toggle that enters / exits that drive-state.

- **Audio event emission for camera-mode changes.** §10.7
  names `camera-mode-change` as one of three typed events
  on the autopilot event surface. The event SURFACE is WS 4's
  concern; THIS workstream does not need to emit the events
  (because in V1 the camera-mode is always `ESTABLISHING` —
  no transitions). When WS 4 lands the event surface, it
  will wire the dispatcher's `setMode()` path to emit
  `camera-mode-change` if the mode actually changes. Flag
  for WS 4 in its §Handoff.

- **Camera FOV / angular-velocity tuning beyond "reasonable
  starting values."** `ESTABLISHING` ships with FOV + angular-
  velocity parameters tuned to the perceptual criterion
  (wide/slow); precise tuning is a visual-lab iteration for
  Max during recording review. Working-Claude picks a
  starting set that reads as wide/slow in the initial
  recording; Max tunes if needed.

- **Relativistic camera effects during CRUISE** (Doppler /
  aberration). V1 CRUISE is visually fast only per feature
  doc §"Open questions" Director call. The camera composes
  wide; no relativistic distortion on the camera side.

- **Per-body composition rules** (e.g. "compose gas giants
  off-center to the right," "compose ringed planets with the
  ring plane diagonal"). V-later; belongs in SHOWCASE's
  territory. `ESTABLISHING` uses one composed-framing rule
  across all subjects in V1 — working-Claude's choice,
  documented.

## Handoff to working-Claude

Read this brief first. Then, in order:

1. **`docs/FEATURES/autopilot.md` in full**, especially
   §"Two-axis phase structure" (the orthogonality contract),
   §"Per-phase criterion — camera axis (V1)" (the AC source),
   §"V1 architectural affordances for V-later items" (the
   dispatcher requirement), §"Failure criteria / broken states"
   (the camera-locked failure mode), §"Drift risks" #1 (the
   re-coupling risk).

2. **`docs/SYSTEM_CONTRACTS.md` §10 in full**, especially §10.1
   (the orthogonality invariant — *"Any state encoding that
   forces camera mode to be a function of ship phase is a
   contract violation"*), §10.2 (`ORBIT` retirement), §10.3
   (two-layer — the camera lives in the cinematography layer),
   §10.9 (OOI stub), §10.10 (contract precedence).

3. **`docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md`**
   (WS 1 brief + output at commit `656ded3`) — the subsystem
   this workstream reads FROM (indirectly, through the
   cinematography layer). Understand the subject-tracker
   concept before implementing; the cinematography layer owns
   it and the camera reads it.

4. **`docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`**
   (WS 2 brief + output at commit `2be6f37`) — the ship
   choreographer this workstream reads FROM. Specifically:
   understand `ShipChoreographer`'s output (ship position +
   velocity + current ship-phase) and the `velocity` readable-
   property WS 2 exposed for WS 4's manual-burn continuity.
   Also read WS 2's debug camera follow-mode — that's the
   scaffolding this workstream removes.

5. **`src/auto/FlythroughCamera.js`** in full. This file is
   the subject of the retirement. Specifically:
   - L26: the `State` enum being retired.
   - L1–130: constructor + state.
   - L278–488: `beginDescend` / `beginApproach` / `beginTravel`
     / `beginTravelFrom` — the methods being replaced by
     mode dispatch.
   - L503: `smootherstep` helper — preserve.
   - L513: `doubleSmootherstep` helper — preserve.
   - L694: `hermite()` helper — preserve.
   - L843–918: `update()` method — the frame-by-frame dispatch.
     This is where the mode dispatcher lands.
   - L959+: `inOutSine` and related — evaluate for preservation.

6. **`src/main.js`** — the call sites that today reference
   `FlythroughCamera` state names or invoke the
   `begin*` entry methods. After WS 1 shipped, most of
   `main.js`'s autopilot-pickup sites should route through
   the cinematography layer; any remaining direct camera
   entry-method calls are this workstream's rewrite targets.

7. **`docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`**
   — the V-later implementer of the OOI interface stubbed
   here. Cross-reference comment in the stub module points
   to this brief.

8. **`docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas
   features (default)"** — the recording workflow for AC #10.

9. **`feedback_motion-evidence-for-motion-features.md`** — the
   cross-project principle this workstream honors.

10. **`feedback_always-test-sol.md`** — Sol as the primary
    recording target. Sol hits `KnownSystems` / `SolarSystemData`,
    a distinct code path from procedural systems.

11. **`feedback_prefer-chrome-devtools.md`** — use
    `mcp__chrome-devtools__*` for intra-session sanity checks,
    NOT Playwright.

Then, in order of execution:

1. **Design the camera-mode dispatcher + `ESTABLISHING` data
   model.** Before code: name the dispatcher API
   (`setMode(mode)`, `update(deltaTime, context)` — what does
   `context` contain?), the `ESTABLISHING` internal state
   (linger timer, pan timer, current subject, composition
   parameters), the subject tracker's API on the
   cinematography side (`getCurrentSubject()`,
   `advanceSubjectAfterLinger()`). Surface this in chat and
   sanity-check against §10.1 orthogonality + §10.3 layer
   discipline before implementing.

2. **Implement the `CameraMode` enum + dispatcher** in
   `FlythroughCamera.js` (or sibling module — working-Claude's
   call). Register all three mode-slots; SHOWCASE and ROVING
   get stub implementations per working-Claude's choice
   (log-and-noop OR fall-through to ESTABLISHING). Verify:
   calling `setMode('SHOWCASE')` at runtime dispatches without
   error.

3. **Retire `FlythroughCamera.State`** — remove the enum at
   :26, remove the `begin*` methods, remove `this.state`
   references. Run `grep` to verify all call sites are
   updated. The diff should be substantial in
   `FlythroughCamera.js` and lighter in `src/main.js` (most
   of `main.js`'s autopilot-pickup was routed through the
   cinematography layer by WS 1).

4. **Implement `ESTABLISHING`** — wide FOV, slow angular
   velocity, linger envelope, pan envelope. Consume the
   subject tracker from the cinematography layer; read ship
   choreographer's ship-position + current-phase as CONTEXT
   (for pacing) but NOT as control-flow. Reuse the Hermite
   and double-smootherstep helpers where they fit; discard
   the retired `beginDescend`/`beginOrbit` semantics.

5. **Add the subject tracker** to the cinematography layer
   (WS 1's slimmed module). The tracker advances to the
   next-queue-stop only when the camera's linger envelope
   has elapsed OR the ship reaches a phase threshold
   (working-Claude's design — document the rule in code
   comments). The subject tracker is how AC #4's linger
   window becomes visible in the recording.

6. **Land the OOI query interface stub** per AC #8.
   Register reads from SHOWCASE and ROVING mode-slots even
   though V1 never calls them, so the wiring is exercised.

7. **Remove WS 2's debug camera follow-mode** — replaced by
   the authored `ESTABLISHING`. Grep for the follow-mode
   symbol; verify it's gone.

8. **Intra-session sanity check via `mcp__chrome-devtools__*`**
   (per `feedback_prefer-chrome-devtools.md`). Dev-shortcut
   to Sol, watch the tour, screenshot at phase transitions.
   Not the Shipped artifact, but catches obvious regressions
   before recording.

9. **Capture the primary recording** — Sol warp-exit → full
   tour through at least two planets, 30–60 s. Drop path per
   AC #10.

10. **Surface contact sheets** (`~/.local/bin/contact-sheet.sh`)
    for Max. Highlight the linger window (STATION(Earth) →
    CRUISE(next)) and the pan-forward window (CRUISE → APPROACH
    composed-frame start) explicitly so Max can evaluate AC
    #4 and AC #5 against specific frames.

11. **Commit per AC #12** — stage only specific files touched
    (`src/auto/*.js`, the new dispatcher / stub modules,
    `src/main.js` call sites, this brief). Never `git add -A`.

12. **Close at `VERIFIED_PENDING_MAX <sha>`.** Max evaluates
    against the recording. On pass → `Shipped <sha>`; on
    fail → diagnose per the failure class (camera locked to
    ship = subject tracker not lagging, or ESTABLISHING
    reading ship-phase as control-flow / linger not firing =
    linger envelope wrong or subject tracker pinned /
    composition feels auto-tracker = framing rule too
    passive, author it more / SHOWCASE leakage = ESTABLISHING
    doing compositional beats it shouldn't, strip them).

**If the diff touches `ShipChoreographer.js` (WS 2's module),
stop and escalate to Director.** That is AC #11 territory;
the camera rewrite does not modify ship motion.

**If the `State` enum at `src/auto/FlythroughCamera.js:26` is
preserved "for safety" or "just during migration," the
workstream has landed the half-migration anti-pattern.** AC
#1 is a grep-verifiable hard constraint; the enum goes.

**If SHOWCASE and ROVING dispatch to inline `if` branches
inside `ESTABLISHING`, the workstream has landed the
tack-on anti-pattern.** AC #2 requires registered mode-slots
— verified by reading the dispatcher's registration table.

**If ESTABLISHING reads `shipPhase` as the primary control
variable for its frame-by-frame pose, §10.1 is violated.**
Ship phase is context (what subject is the camera composing
against); the camera's pose is a function of (subject,
linger-envelope-state, pan-envelope-state, composition rule)
— not a function of shipPhase directly.

Artifacts expected at close: 2–3 commits (dispatcher + enum
retirement, ESTABLISHING implementation, OOI stub — separable
per AC #12); one primary canvas recording at the path in
AC #10; this brief at Shipped with the recording path cited;
any followups (SHOWCASE implementation, ROVING implementation,
camera FOV tuning) captured as new entries in §Followups
(if added).

## Sequencing across the four V1 autopilot workstreams

Full V1 autopilot delivery is four workstreams. The recommended
default execution order is **sequential**:

1. **WS 1 — `autopilot-navigation-subsystem-split-2026-04-20.md`**
   (shipped 2026-04-20 at commit `656ded3`). Separates the
   navigation subsystem (motion execution) from the cinematography
   layer (tour orchestration). Prerequisite for everything else.
2. **WS 2 — `autopilot-ship-axis-motion-2026-04-20.md`** (shipped
   2026-04-20 at commit `2be6f37`). Authored ship motion through
   ENTRY / CRUISE / APPROACH / STATION; gravity-drive shake
   mechanism; warp-exit handoff. Consumes the subsystem from WS 1.
   Camera is held in debug follow-mode during this workstream.
3. **WS 3 — THIS WORKSTREAM.** Retires `FlythroughCamera.State`,
   lands the two-axis camera dispatcher, implements ESTABLISHING.
   Consumes WS 2's ship motion as context (subject tracker reads
   the choreographer's output); replaces WS 2's debug camera
   follow-mode with authored camera.
4. **WS 4 — `autopilot-toggle-ui-and-warp-select-2026-04-20.md`
   (this PM pass).** Toggle UI, `Tab` keybinding, HUD-hide,
   manual-override routed through WS 1's subsystem, warp-select
   handoff at tour-complete, audio event surface. Consumes the
   full-stack behavior WS 1–3 produced as its end-to-end
   recording target.

**Parallel option considered (WS 2 + WS 3):** WS 2 and WS 3 both
consume the navigation subsystem's API from WS 1; they do not
write to each other's modules. In theory they could run in
parallel — WS 2 authors ship motion + debug camera, WS 3 authors
camera dispatcher + ESTABLISHING, integration at the end.
**Rejected.** Two reasons:

1. WS 3's AC #4 (linger) requires observing the linger window
   in a recording of authored ship motion — the debug follow-
   mode in WS 2 does not produce the frame range where ship-
   velocity-direction and camera-look-direction disagree,
   because the debug camera is by construction pinned to the
   ship. So WS 3's recording-based AC needs WS 2's output first.
2. WS 2's regression surface (is ship motion reading as
   authored?) is cleaner to evaluate under the debug follow-mode
   than under an authored ESTABLISHING — the authored camera
   hides ship-motion issues by composing around them. Sequential
   gives Max a cleaner evaluation pass per workstream.

**Lock sequential.** If working-Claude discovers mid-WS-3 that a
parallel lane would have been cleaner, capture the learning for
the next project; do not restructure the current sequence.

## See also

- `docs/FEATURES/autopilot.md` — parent feature.
- `docs/SYSTEM_CONTRACTS.md` §10 — autopilot invariants.
- `docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md`
  (WS 1 — shipped `656ded3`).
- `docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`
  (WS 2 — shipped `2be6f37`).
- `docs/WORKSTREAMS/autopilot-toggle-ui-and-warp-select-2026-04-20.md`
  (WS 4 — sibling, this PM pass).
- `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`
  — V-later implementer of the OOI interface stubbed here.
- `docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`
  — star-orbit multiplier consumed indirectly via WS 2's ENTRY.
- `docs/MAX_RECORDING_PROTOCOL.md` — canvas-path capture
  workflow for AC #10.
- `feedback_motion-evidence-for-motion-features.md` — motion
  evidence principle.
