# Workstream: Autopilot ship-axis motion — ENTRY / CRUISE / APPROACH / STATION (2026-04-20)

## Status

Scoped — **dependency cleared 2026-04-21; ready for working-Claude
execution.** Second of four sequential workstreams delivering V1
autopilot. See `docs/FEATURES/autopilot.md` §"Workstreams" for the
full sequence.

**Dependency graph at execution time (2026-04-21):**

- **WS 1 `autopilot-navigation-subsystem-split-2026-04-20.md`:
  `Shipped 3d53825`** (refactor originally `c394e1e`, two pre-ship
  issues corrected via telemetry per `docs/REFACTOR_VERIFICATION_PROTOCOL.md`).
  This workstream's primary dependency — the `NavigationSubsystem`
  API + MotionFrame contract are on master. See §"Handoff to working-
  Claude" step 4a for the concrete surface.
- **WS `autopilot-star-orbit-distance-2026-04-20.md`: Scoped
  (not yet executed).** AC #1 ENTRY and AC #4 STATION both reference
  the multiplier that workstream tunes. Per AC wording below,
  ship-axis-motion consumes whatever value currently ships — it does
  NOT block on star-orbit-distance landing. If star-orbit tuning
  ships after this workstream, the numeric value changes; the ship-
  motion behavior does not.
- **WS `warp-phase-perf-pass-2026-04-20.md`: Brief authored, not
  yet executed.** AC #8 (warp-exit → ENTRY handoff) straddles that
  workstream's EXIT phase and this workstream's ENTRY phase. Per
  AC #8 wording below, inherit any residual EXIT stutter and flag
  in the recording review — do not attempt to fix both sides here.

**Not blocked on either sibling workstream.** Proceed.

## Revision history

- **2026-04-20 — authored** by PM as WS 2 of 4 (commit `2be6f37`).
- **2026-04-21 — dependency graph confirmed, concrete NavigationSubsystem
  API surface folded in** by PM after WS 1 shipped at `3d53825`. Status
  line flipped from "awaiting WS 1" to "ready for execution."
  `## Handoff to working-Claude` step 4 was expanded with the
  MotionFrame contract, the `beginMotion({ from, to, arrivalOptions,
  launchOptions })` signature, and the `abruptness` V1 = 0.0 handoff
  point (AC #5 wires the actual math). Drift risk added:
  **name-collision between new ship-axis `ENTRY/CRUISE/APPROACH/STATION`
  phases and the subsystem's internal `descending/traveling/approaching/orbiting`
  enum** — they are orthogonal, not a rename.
- **2026-04-21 — Director re-audit post-WS-1-ship.** Three surgical
  amendments: (1) **AC #5** updated — abruptness is produced by the
  ship choreographer, NOT by `NavigationSubsystem` (subsystem emits
  `0.0` stub; the choreographer owns the authored ship-axis sequence
  and therefore the abruptness math). Prior wording incorrectly
  pointed at the subsystem. (2) **AC #7** updated — post-WS-1
  `FlythroughCamera` has no state enum to edit (162 lines,
  orientation-only). The expected integration is the ship
  choreographer driving `subsystem.beginMotion` per ship-axis phase,
  the camera consuming `frame.position` via existing plumbing. No
  follow-mode hook needed; escalate to Director if one seems
  required. (3) **Drift risk added** — `nextBody` semantic collision
  between manual-burn's `nextBody: target` quirk (WS 1 preserved)
  and tour-phase's `nextBody: lookahead`. Both are legal
  `beginMotion` inputs with different emergent behaviors; the
  choreographer must use the lookahead pattern, not the manual-burn
  convention. Scope / principles / drift-risks #1–#6 all unchanged.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
commit `bdeb0ff` with keybinding update at `4b9b18a`.

Specific sections this workstream serves:

- **§"Two-axis phase structure" — Ship axis** — the four-phase
  table (`ENTRY / CRUISE / APPROACH / STATION`) this workstream
  implements. The feature doc explicitly contrasts this against the
  retired `FlythroughCamera.State = { DESCEND, ORBIT, TRAVEL,
  APPROACH }` and names the structural correction for each phase.
- **§"Per-phase criteria — ship axis"** — the felt-experience
  criteria per phase. Workstream ACs cite back to them verbatim.
- **§"V1 — must ship"** — the bullets this workstream closes:
  *"All 4 ship phases (ENTRY, CRUISE, APPROACH, STATION) — ship
  motion is greenfield; it doesn't exist today."* and *"Warp-exit-
  vector arrival pose — ENTRY start is derived from the warp
  forward direction, not a fixed above-the-plane origin."* and
  *"Gravity-drive shake on abrupt transitions — the cinematic
  tell."*
- **§"Failure criteria / broken states"** — specifically:
  *"ENTRY pose starts from 'above the plane' — the warp-exit
  vector has been ignored; the warp → autopilot handoff broke
  continuity."*, *"STATION is stationary — violates 'ship in
  motion throughout.'"*, *"Hard cut or jump between phases."*,
  *"Gravity-drive shake fires during smooth motion."*, and
  *"Gravity-drive shake fails to fire on genuinely abrupt
  motion."*

Primary contracts: **`docs/SYSTEM_CONTRACTS.md` §10.1 Two-axis state
machine** (ship axis: ENTRY → CRUISE → APPROACH → STATION),
**§10.2 ORBIT retirement**, **§10.5 Warp-exit handoff (continuity-
critical)**, **§10.8 Gravity-drive shake invariant**. This workstream
operates on the ship-axis half of §10.1; the camera-axis half is WS 3.

Secondary contracts: §9.1 Warp phase state machine (EXIT → ENTRY
handoff boundary), §5.3 Drive States (Autopilot column — what the
camera writer does this frame, extended by §10.4).

Lore anchor: **`docs/GAME_BIBLE.md` §8H Gravity Drive (In-System
Propulsion)** — *"The player's ship uses a gravity drive for in-
system motion … the drama is still there — it lives in the shake,
and in the implied authority of smooth motion that isn't shaking."*
The shake mechanism implemented in this workstream is the in-fiction
signal of the drive's compensation envelope being exceeded.

## Implementation plan

N/A (feature is workstream-sized if scoped to the ship axis alone).
The ship-motion layer is a single module driven by the navigation
subsystem from WS 1; no cross-system contracts need elaboration
beyond what §10 already supplies. If mid-work working-Claude
discovers a need for a PLAN doc (e.g., because the phase-transition
velocity-continuity math wants its own document), escalate to PM for
a PLAN bootstrap rather than expanding this brief.

## Scope statement

Stand up the ship-axis motion system — the greenfield module that
drives the ship's position + attitude through the four phases
`ENTRY / CRUISE / APPROACH / STATION` — per
`docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" and
`docs/SYSTEM_CONTRACTS.md` §10.1–§10.2. This includes:

- `ENTRY` — the warp-exit-vector-derived arrival pose and gradual
  acceleration toward the system's main attractor (binary: barycenter
  per feature-doc §"Open questions").
- `CRUISE` — sustained visually-fast travel between bodies.
- `APPROACH` — progressive deceleration with load-bearing reticle →
  disk transition timing.
- `STATION` — holding orbit (ship-in-motion) that sees more than the
  arrival view.
- The gravity-drive shake mechanism (§10.8) — additive perturbation
  input to ship / camera, driven by an "abruptness" signal the
  navigation subsystem produces.

Camera is held in a **debug follow-mode** during this workstream —
`FlythroughCamera` continues to run in its existing `DESCEND / ORBIT
/ TRAVEL / APPROACH` state, but is coupled to the new ship choreographer
as a reference follower. This lets motion be evaluated without waiting
for the camera-axis rewrite (WS 3). The workstream's recording shows
ship motion through all four phases with the camera pinned behind the
ship — readable as motion, not yet cinematic.

This is one unit of work because the four ship phases share motion
plumbing (position state, velocity state, per-phase transition
handoffs), the shake mechanism is driven by abruptness signals that
all four phase-transition paths produce, and the feature doc
explicitly groups them in one V1-must-ship list. Splitting across
briefs would mean authoring velocity continuity twice.

**Explicitly excluded from the bundle reasoning:** this is NOT a
license to ship without phase-by-phase motion recording verification.
AC #6 names one recording covering all four phases; the phase-sourced
ACs #1–#4 are evaluated against that single recording.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Vision / Core Experience —
specifically the **Discover** axis: *"Every system is different.
Finding a terrestrial world or an alien megastructure is rare and
meaningful."* The ship motion is the composed frame through which
discovery happens. Without authored motion — the slow bend, the
deceleration, the orbital arc — the tour reads as "planet 1, planet
2, planet 3" rather than "a considered passage through this system"
(feature doc §"Failure criteria"). This workstream is the authored
body of that passage.

Advances `docs/GAME_BIBLE.md` §8H Propulsion & Travel Landscape —
the lore claim is *"the gravity drive maintains inertial neutrality
during cinematic maneuvers … the drama is still there — it lives in
the shake."* This workstream is the code that makes that lore
visible: smooth motion by default, shake on genuine abruptness, the
contrast between the two is the cinematic tell.

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 2 — No Tack-On Systems.** Ship motion flows from the
  navigation subsystem (WS 1) which flows from the generation
  pipeline (the bodies being toured). Motion is not a "filter on
  top of generated data" — it IS what the ship does with the
  generated data.
- **Principle 6 — First Principles Over Patches.** The existing
  `FlythroughCamera` state enum is a single-axis concept that
  conflated ship motion with camera framing. The first-principles
  move is authored ship motion separate from authored camera
  motion; this workstream does the ship half.

## Acceptance criteria

Phase-sourced per `docs/PERSONAS/pm.md` §"Per-phase AC rule." Each
ship phase gets its own AC quoting the feature doc's criterion
verbatim. The shake mechanism and warp-exit handoff each get their
own AC. All six are evaluated against a single canvas recording
(AC #6) covering a full tour.

1. **ENTRY — arrival along the warp-exit forward vector, velocity
   preserved, no "from above" pop** (per `docs/FEATURES/autopilot.md`
   §"ENTRY — arrival": *"Velocity coming out of warp is **preserved
   as a continuity anchor** — no snap-to-zero on exit, no pop-to-a-
   new-velocity. The warp handoff feels like one motion."* and
   *"Holds **safe distance** — the ship can't get too close to a
   star/binary."* and *"Picks the first planet."* and *"Elegantly
   initiates CRUISE."*). Verified in Max's canvas recording: the
   post-warp arrival is a continuous motion, the ship's pose is
   derived from the warp-exit forward direction (not "above the
   plane"), the ship bends gradually toward the star at a safe
   distance, and the transition into CRUISE toward the first planet
   is a camera + choreography moment (not a hard cut). The safe-
   distance rule consumes the multiplier set by
   `autopilot-star-orbit-distance-2026-04-20.md` AC #1 (20× star
   radius or whatever Max tuned there). If the star-orbit workstream
   is still pending at this workstream's execution time, ENTRY
   uses whatever multiplier that brief's code currently ships, and
   notes the dependency in the recording review.

2. **CRUISE — sustained visually-fast travel, target ahead in
   frame** (per `docs/FEATURES/autopilot.md` §"CRUISE — sustained
   travel": *"Elegant initiation from the attractor STATION —
   linger, pan, burn."* and *"Picks up to **relativistic speeds**
   toward the target (see Open questions: literal-or-felt)."* and
   *"Target's reticle/billboard is still ahead in the frame for
   most of the phase; the handoff to APPROACH is the moment it
   starts resolving into real geometry."*). Per feature doc
   §"Open questions": V1 is **visually fast only** — no literal
   Doppler / aberration. Verified in Max's recording: CRUISE reads
   as fast-but-unhurried (the speed is expressive, not frantic),
   the target body stays a reticle / billboard for most of CRUISE,
   and the transition into APPROACH is the moment it starts
   becoming a disk. Diagnostic backup: the ship's velocity during
   CRUISE is notably higher than during STATION, and the velocity
   curve is C1-continuous across the STATION → CRUISE handoff.

3. **APPROACH — reticle → disk transition, progressive
   deceleration** (per `docs/FEATURES/autopilot.md` §"APPROACH —
   deceleration": *"The reticle→disk transition is load-bearing.
   The moment the target stops being a billboard and becomes a
   real 3D body is itself part of the felt experience — not a
   technical detail."* and *"Progressive deceleration. No sudden
   speed step; the drive compensates smoothly."* and *"Body fills
   more and more of the frame."* and *"Seamless handoff to
   STATION."*). Verified in Max's recording: the reticle-to-disk
   transition happens during APPROACH (not before — the billboard
   must still be a billboard at APPROACH start) and reads as
   part of the arrival experience; deceleration is progressive,
   no visible speed step; the APPROACH → STATION handoff is
   seamless. Diagnostic backup: the velocity curve from CRUISE
   peak speed down to STATION orbit speed is C1-continuous across
   both phase boundaries.

4. **STATION — holding orbit, ship-in-motion, arc sees more than
   arrival view** (per `docs/FEATURES/autopilot.md` §"STATION —
   holding pattern": *"Orbit, not stationary. Ship is in motion
   throughout."* and *"Orbit speed fast relative to planet size
   (dynamic feel — the planet rotates visibly beneath the observer
   during the hold)."* and *"But not so fast the planet feels
   small. Tight orbit, immersive — close enough that the planet
   is 'ground' and the starfield is 'sky.'"* and *"Arc sees more
   than the arrival view — the camera + ship motion together
   reveal surface / cloud patterns / terminator line that the
   APPROACH frame didn't."*). Verified in Max's recording:
   STATION is a visibly-moving orbit (not a static camera-
   follows-body lock), the arc reveals surface / cloud / terminator
   detail that APPROACH did not see, and the orbit is tight enough
   that the planet dominates the frame (starfield is background,
   not foreground). The star-STATION uses the multiplier from
   `autopilot-star-orbit-distance-2026-04-20.md`; planet-STATION
   uses the existing planet branch multiplier unchanged.

5. **Gravity-drive shake fires on genuinely abrupt motion; does
   NOT fire during smooth motion** (per `docs/FEATURES/autopilot.md`
   §"Gravity drives — ship-body shake on abrupt transitions":
   *"The compensation envelope has a limit. When ship motion is
   abrupt — sudden direction change, aggressive deceleration, a
   transition that exceeds the drive's smoothing capacity — the
   compensation lags the motion."* and *"Default cinematic motion
   does NOT shake. Shake is the marker of 'the drive is working
   harder than normal.' Over-using it breaks the 'gravity drives
   maintain inertial neutrality' contract."* and per
   `docs/SYSTEM_CONTRACTS.md` §10.8 *"shake fires only when the
   ship motion is genuinely abrupt — exceeding a smoothing
   threshold the drive can't absorb."*). Verified in Max's
   recording: the normal V1 tour exhibits zero shake (motion is
   smooth by design). A deliberately-abrupt transition triggered
   via a debug hook (see §In scope) DOES exhibit shake. The two
   together prove the mechanism works and is correctly gated.
   Implementation shape per §10.8: additive shake input, magnitude
   computed from motion discontinuity (second derivative of
   velocity or a dedicated "abruptness" signal produced by **the
   ship choreographer** — NOT by `NavigationSubsystem`, which
   currently emits a `0.0` stub per `MotionFrame.abruptness`).
   Rationale: abruptness is a function of the authored four-phase
   ship-axis sequence (which the choreographer owns), not of the
   subsystem's internal motion math (which doesn't know about the
   ship-axis model). See Handoff §4a for the full contract. Not
   authored per-phase-transition as a visual beat.

6. **Motion evidence at ship-gate** — **one primary recording
   covering a full tour at Sol plus one debug-shake recording.** Per
   `docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas features
   (default)" and `feedback_motion-evidence-for-motion-features.md`:
   - **Primary:** full autopilot tour at Sol captured via
     `~/.claude/helpers/canvas-recorder.js`, 30–60 s covering warp-
     exit → ENTRY → CRUISE → APPROACH (star) → STATION (star) →
     CRUISE → APPROACH (Earth) → STATION (Earth). Drop path:
     `screenshots/max-recordings/autopilot-ship-axis-motion-2026-04-20.webm`.
     ACs #1–#4 evaluated against this.
   - **Shake-verification:** a 5–10 s clip triggered via a debug
     hook that forces an abrupt velocity change (e.g., via
     `window._autopilot.debugAbruptTransition()` — the debug hook
     itself is in scope for this workstream, since the shake can't
     be verified on normal smooth motion). Drop path:
     `screenshots/max-recordings/autopilot-ship-axis-motion-2026-04-20-shake.webm`.
     AC #5 evaluated against this.

   Per the Shipped-gate protocol: working-Claude closes at
   `VERIFIED_PENDING_MAX <commit-sha>` after the commit lands and
   both recordings are on disk. The Shipped flip happens on Max's
   verdict against the recordings, not on agent inspection of
   velocity values in the console.

7. **Camera is unchanged — orientation-authoring layer stays
   orientation-authoring; no camera-axis work.** WS 1 already
   retired the `FlythroughCamera.State` enum — the post-WS-1
   camera module is 162 lines of orientation-only (free-look,
   lookAt + slerp against `MotionFrame.lookAtTarget`). WS 3
   will author the `ESTABLISHING / SHOWCASE / ROVING` dispatch
   on top of this module. This workstream's expected camera
   integration: the ship choreographer drives the subsystem via
   `subsystem.beginMotion` per ship-axis phase transition (see
   Handoff §4a), the subsystem produces `frame.position`, the
   camera already consumes `frame.position` via its existing
   update loop. **No follow-mode hook needed** — the existing
   plumbing is the follow-mode. If working-Claude finds the
   choreographer needs to write ship position NOT through the
   subsystem (e.g., a greenfield ENTRY curve that the subsystem
   can't express), escalate to Director before adding a camera-
   side hook; the escalation may redraw the split between
   choreographer and subsystem for V1. Verified by reading the
   diff: `FlythroughCamera.js` receives zero or near-zero edits;
   zero new branches on ship-axis phase; zero direct writes to
   `camera.position` outside the subsystem's output path.

8. **Warp-exit handoff honors §10.5** — no black frame, no
   pose-jump, no pop-to-a-new-speed between warp EXIT and
   autopilot ENTRY (per `docs/SYSTEM_CONTRACTS.md` §10.5
   invariant 3: *"Cinematography handoff happens within a frame."*).
   Verified in the primary recording: the warp-exit → ENTRY
   transition is continuous on playback — single motion, no
   visible seam. If `warp-phase-perf-pass-2026-04-20.md` has not
   landed, this AC is evaluated against current warp-exit state
   and may inherit whatever residual stutter that workstream
   fixes; working-Claude notes the residual in the recording
   review and does not conflate it with autopilot's own motion
   quality.

9. **One or more commits, separable by phase.** Ship-motion
   module in one commit (`feat(autopilot): ship-axis motion —
   ENTRY / CRUISE / APPROACH / STATION`); gravity-drive shake
   mechanism in a separate commit (`feat(autopilot): gravity-drive
   shake mechanism`); call-site updates in `src/main.js` (warp-
   exit hookup + autopilot pickup) in a separate commit. No
   omnibus "ship axis done" commit. Each commit names the AC it
   closes.

## Principles that apply

Four of the six from `docs/GAME_BIBLE.md` §11 are load-bearing.
Principle 3 (Per-Object Retro Aesthetic) is orthogonal to ship
motion and is omitted; Principle 4 (BPM-Synced Animation) is
orthogonal at V1 (the authored motion paces itself against the
camera's linger, not against a BPM clock — that coupling is
V-later, if ever).

- **Principle 6 — First Principles Over Patches.** The existing
  `FlythroughCamera.State` enum conflates ship motion with camera
  framing into a single axis. Patching it to accept four phase
  names instead of three would add a patch without fixing the
  structural problem. The first-principles move is to author ship
  motion as its own module with its own state and let the camera
  axis evolve separately. *Violation in this workstream would
  look like:* renaming `DESCEND → ENTRY`, `TRAVEL → CRUISE`,
  `APPROACH → APPROACH`, `ORBIT → STATION` inside
  `FlythroughCamera` and calling the workstream done. The state
  enum change is cosmetic — the structural problem is that the
  class decides "what does the ship do" AND "what does the camera
  look at" in coupled logic. The rename ships the patch and
  forecloses WS 3.

- **Principle 2 — No Tack-On Systems.** The shake mechanism is
  the load-bearing risk here. The feature doc §"Drift risks" #4
  is explicit: *"Shake is the marker of the drive working past
  its envelope. If a developer adds shake to make a transition
  feel 'more impactful,' it breaks the inertial-neutrality
  contract."* Shake must be driven by an abruptness signal that
  the motion system produces, not authored per-transition as a
  visual beat. *Violation in this workstream would look like:*
  `shake(0.3)` called directly inside `beginApproach()` because
  APPROACH "feels like it should have a bit of punch." That is a
  tack-on visual filter; the motion system must produce the
  abruptness signal, and the shake magnitude must be a function
  of that signal. If the motion is smooth (it should be by
  design), the signal is near zero, and the shake magnitude is
  near zero.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** The ship motion is a pipeline-layer concern driven
  by the generation-layer data (body positions, orbit distances,
  safe-distance multipliers). The renderer (camera) consumes
  ship motion, not the other way around. *Violation in this
  workstream would look like:* the camera deciding the ship
  should slow down because the camera "wants a longer linger"
  on a particular body. That is a reverse flow. Ship motion is
  authored per the ship-axis criteria; the camera paces its
  linger against the ship's motion (WS 3's concern).

- **Principle 1 — Hash Grid Authority** (diagnostic, not
  prescriptive). Ship motion consumes resolved body references
  (the meshes the generator placed in the scene). The ship
  choreographer does NOT query the hash grid or re-resolve
  positions — it accepts the body refs from the navigation
  subsystem (WS 1) and the cinematography layer. If the ship
  choreographer ever needs "the next star in the warp direction,"
  that query goes through `HashGridStarfield` via the
  cinematography layer, never re-invented inside the choreographer.

## Drift risks

- **Risk: Renaming the existing state enum instead of authoring
  new motion.** The seductive version: change `DESCEND → ENTRY`
  in `FlythroughCamera.js`, thread `warpExitForward` into
  `beginDescend`, claim ENTRY is done. That is a rename, not a
  feature. ENTRY is greenfield because the ship-motion system
  does not exist today — the existing "ship position = camera
  position" identity is the architectural problem that makes
  this workstream hard. Principle 6 above.
  **Why it happens:** the rename is cheap, the recording looks
  "close enough" at first glance (the camera is moving along the
  warp-exit vector, after all).
  **Guard:** AC #7 requires `FlythroughCamera` to receive only
  a debug follow-mode addition — not phase rewiring. If
  `FlythroughCamera.State` is edited, the workstream is being
  patched, not executed. Director audit flag.

- **Risk: Ship motion baked into the camera.** Related but
  distinct: even without renaming, working-Claude may implement
  ship motion inside `FlythroughCamera`'s update loop because
  "that's where motion lives." Result: the motion is expressed
  as camera position interpolation, not as a ship-position
  concept that the camera later reads.
  **Why it happens:** the existing code has no concept of "ship
  position" distinct from "camera position." Inventing the
  distinction is extra work that feels like overkill for V1.
  **Guard:** AC #7 + the workstream's premise. The ship
  choreographer writes to a **ship position + velocity** state
  that is NOT the camera position. The camera (in this
  workstream) follows the ship in debug follow-mode; in WS 3
  the camera paces against the ship independently. If ship
  position and camera position are the same variable, the
  two-axis structure is foreclosed.

- **Risk: Shake added for "feel" on every phase transition.**
  Principle 2 above. Once the shake mechanism is in place,
  every phase boundary (ENTRY→CRUISE, CRUISE→APPROACH,
  APPROACH→STATION) is a candidate for "a touch of shake to
  punctuate it." That is exactly the anti-pattern the feature
  doc §"Failure criteria" names: *"Gravity-drive shake fires
  during smooth motion — breaks the 'inertial neutrality is
  the norm' lore rule; shake loses its meaning."*
  **Why it happens:** shake feels cinematic; adding shake feels
  like polish.
  **Guard:** AC #5 requires the normal tour recording to exhibit
  zero shake. If the primary recording for AC #6 shows any
  shake during V1's smooth tour, AC #5 fails. The shake-
  verification recording requires shake — from a deliberately-
  abrupt debug-triggered transition, NOT from normal flight.

- **Risk: Authoring velocity curves that are not C1-continuous
  across phase boundaries.** The feature doc §"Failure criteria"
  names *"Hard cut or jump between phases"* as a failure mode.
  Visually, a velocity step or a velocity-curve derivative
  discontinuity reads as a stutter even at 60 fps (see the
  `warp-phase-perf-pass` workstream's H3 hypothesis for the
  same class of bug on the warp side).
  **Why it happens:** authoring four phases separately and
  gluing them at boundaries with "pick up where the last one
  left off" logic produces position continuity but not
  velocity continuity.
  **Guard:** AC #2 / #3 / #4 diagnostic backups name C1-
  continuity at phase boundaries explicitly. The motion
  system must author velocity as a continuous function of
  time across boundaries — each phase's initial condition is
  the previous phase's final condition (position AND velocity).
  This is exactly the structure the gravity-drive lore
  requires: smooth motion means the drive is within its
  compensation envelope, which means the velocity curve is
  C1 by construction.

- **Risk: Binary-system main-attractor confusion.** Feature doc
  §"Open questions" names this and Director called barycenter
  for V1, revisitable via playtest.
  **Why it happens:** the code is easier if the "main attractor"
  is "the first star" (literal reference to `system.star`),
  regardless of binarity.
  **Guard:** for a binary system, ENTRY's bend-toward-attractor
  target is the computed barycenter of the binary pair, not
  `system.star.position`. If `system.isBinary && system.star2`,
  compute the barycenter and target that. The tour queue's
  first stop is the primary star as today (queue-side concern,
  not motion-side — the ship's ENTRY bend just uses the
  barycenter as the bend-toward point; the subsequent CRUISE
  to the first queue stop still goes to `system.star`).

- **Risk: Expanding scope to "most interesting first" planet
  selection.** Feature doc §"Open questions" is explicit: V1
  stays on inner-to-outer. Max named this trap in person.
  **Why it happens:** authoring ship motion makes the queue's
  next-stop logic visible, and "most interesting first" feels
  like a small improvement.
  **Guard:** AC #9 + §Out of scope name this explicitly. The
  queue logic from WS 1's slimmed cinematography layer is
  unchanged. Queue-selection improvements are future work
  gated on OOI registry.

- **Risk: Conflating the `APPROACH` ship-phase name with the
  existing `FlythroughCamera.State.APPROACH`.** They share a
  name, not a meaning. The existing `APPROACH` state is a
  pause-then-close camera animation; the new `APPROACH` ship-
  phase is progressive ship deceleration with reticle-to-disk
  handoff.
  **Why it happens:** name collision invites the assumption
  that the existing state "already implements APPROACH."
  **Guard:** the new ship-phase logic is in a new module
  (named per §In scope — proposed `src/auto/ShipChoreographer.js`),
  NOT in `FlythroughCamera.js`. The two APPROACHes are
  separate phases in separate axes per §10.1.

- **Risk: `nextBody` semantic collision with WS 1's manual-burn
  preservation quirk.** WS 1's post-ship fix (`3d53825`) preserved
  the pre-refactor accidental-but-load-bearing behavior that manual
  burns pass `nextBody: target` (identity) — the
  `_updateTravel` entry-yaw picker takes the degenerate branch
  (`nnPos - nextPos == 0`) in that case, which produced a specific
  emergent orbit-side. See `src/main.js:4506–4510` (`focusPlanet`)
  for the documented convention. The ship choreographer's tour-
  driven `beginMotion` calls — `ENTRY → CRUISE` onto firstPlanet,
  `CRUISE → APPROACH → STATION` at each stop, then the next
  `CRUISE` onto the subsequent stop — must pass `nextBody = the
  actual next tour stop` (lookahead), **not** `nextBody = current
  target` (the manual-burn convention). The two vocabularies are
  distinct: manual-burn's `nextBody = target` is a specific
  degenerate-branch selector; tour-phase's `nextBody = lookahead`
  is the real departure-aligned-orbit hint.
  **Why it happens:** working-Claude reads `focusPlanet` as
  precedent for "how to call `beginMotion`" and copies the
  `nextBody: target` quirk into the tour path, breaking the
  departure-aligned orbit math that AC #2's C1-continuity at
  CRUISE → APPROACH depends on.
  **Guard:** the ship choreographer's tour-path `beginMotion`
  calls pass `nextBody` from `autoNav.getNextStop()?.bodyRef`
  (the pattern already used at `src/main.js:3917` for first-stop
  pickup, and at `:4105` and `:4143` for warp-reveal). If the
  choreographer's ENTRY-completion / CRUISE-initiation handoff
  writes `nextBody: firstStop.bodyRef` (the current target),
  that's the quirk leaking — escalate to Director.

- **Risk: Phase-name collision with `NavigationSubsystem`'s
  internal phase enum.** WS 1's refactor carried over the
  pre-refactor single-axis phase model: `NavigationSubsystem`
  internally tracks `descending / traveling / approaching /
  orbiting` (lowercase, emitted as `MotionFrame.phase`). This
  workstream authors a NEW, orthogonal axis —
  `ENTRY / CRUISE / APPROACH / STATION` — that the ship
  choreographer owns. They are NOT a rename of each other;
  they are two separate vocabularies on separate layers.
  **Why it happens:** working-Claude reads the subsystem's
  four-phase enum and the brief's four-phase ACs and assumes
  they're the same four phases with a case change.
  **Guard:** the ship choreographer's phase state is its own
  variable on its own module, independent of `MotionFrame.phase`.
  Subsystem may be `traveling` (its TRAVEL hermite-curve phase)
  while ship choreographer is in `CRUISE` (the authored ship-
  axis phase) — these are allowed to correlate but MUST NOT
  be the same variable. A ship-axis transition (e.g.,
  `CRUISE → APPROACH`) may or may not coincide with a subsystem
  transition; the choreographer decides its phase based on
  felt-experience criteria (reticle-to-disk timing, safe
  distance reached, etc.), not by reading `MotionFrame.phase`
  as ground truth. If the choreographer's logic looks like
  `if (frame.phase === 'approaching') shipPhase = 'APPROACH'`,
  the orthogonality is being collapsed — escalate to Director.

## In scope

- **New module `src/auto/ShipChoreographer.js`** (name provisional;
  working-Claude picks the final name, role is fixed). Drives the
  ship position + velocity through the four ship-axis phases.
  Consumes: the navigation subsystem's motion primitives (WS 1),
  resolved body refs from the cinematography layer, warp-exit
  state (velocity + forward vector) at ENTRY start. Produces:
  ship position + velocity per frame, plus an "abruptness"
  signal consumed by the shake mechanism.

- **Warp-exit → ENTRY handoff wiring** in `src/main.js` (the post-
  warp autopilot pickup path, currently ~L3884–L3900 +
  L4063–L4100). The ship choreographer's ENTRY phase receives
  the warp-exit forward vector and velocity as initial conditions,
  honoring §10.5 invariants 1–3.

- **Gravity-drive shake mechanism** per `docs/SYSTEM_CONTRACTS.md`
  §10.8. Additive shake input on the ship (and transitively the
  camera via the debug follow-mode). Magnitude computed from the
  abruptness signal the ship choreographer produces. Debug hook
  (e.g., `window._autopilot.debugAbruptTransition()`) that
  artificially triggers an abrupt velocity change so AC #5's
  shake-verification recording can be captured.

- **Camera debug follow-mode** in `FlythroughCamera.js` — minimal
  addition so the ship choreographer's motion is observable in
  a recording without waiting for WS 3. Behind / slightly above
  the ship, facing forward along ship velocity. This is
  scaffolding, labeled as such, removed when WS 3 lands the
  authored camera. AC #7 guards against invasive camera-side
  edits.

- **Binary-system barycenter helper** — small utility that
  computes the barycenter of a binary system from `star.data`
  + `star2.data` (using masses if the generator exposes them;
  otherwise using equal-mass midpoint as V1 fallback). Used by
  ENTRY's bend-toward-attractor target.

- **Primary canvas recording** (Sol, full tour) + **shake-
  verification canvas recording** (debug-triggered abrupt
  transition), both via `~/.claude/helpers/canvas-recorder.js` +
  `~/.local/bin/fetch-canvas-recording.sh`. Drop paths named in
  AC #6.

- **Commits per AC #9** — ship-motion module; shake mechanism;
  call-site wiring — separable, each naming the AC it closes.

- **`## Status` line in this brief** flipped from "Scoped" →
  `VERIFIED_PENDING_MAX <sha>` → `Shipped <sha> — verified
  against <recording-paths>` per protocol.

## Out of scope

- **Camera-axis work.** WS 3. `FlythroughCamera.State` is not
  retired here. The existing camera behavior (DESCEND / ORBIT /
  TRAVEL / APPROACH states) keeps running where the ship
  choreographer is NOT driving — i.e., the existing tour pickup
  path without warp-exit input stays on the legacy camera. The
  warp-exit → ENTRY path is the one new codepath; everything
  else stays on today's `FlythroughCamera` until WS 3 retires
  it wholesale.

  **Explicit point of coordination:** during this workstream,
  the game has two active motion systems — legacy
  `FlythroughCamera` (for non-warp-exit tour entries and for
  the manual-burn path) and the new `ShipChoreographer` (for
  warp-exit → ENTRY → full tour). This is a temporary state
  by design; WS 3 merges them by retiring the legacy camera.
  If working-Claude finds the dual-system state painful to
  maintain across the full tour, stop and escalate — the
  scoping may need revisiting.

- **Toggle UI, HUD-hide, manual-override integration, audio
  event surface, warp-select handoff at tour-complete.** All
  WS 4.

- **OOI query interface (stub) and camera-mode dispatch.** WS 3
  per §10.9. This workstream's ship choreographer does not
  query OOIs; the tour queue is still driven by the
  cinematography layer's monotonic-distance queue from WS 1.

- **Per-spectral-class ENTRY safe-distance tuning.** The star-
  orbit-distance multiplier from
  `autopilot-star-orbit-distance-2026-04-20.md` is the input
  this workstream consumes. Spectral-class variation is future
  work.

- **"Most interesting first" planet selection.** Explicitly
  V-later per feature doc §"Open questions."

- **Literal relativistic effects during CRUISE.** V1 is visually
  fast only per feature doc §"Open questions" Director call.

- **`STATION` orbit-speed ratio tuning.** Feature doc §"Open
  questions" names this as a lab-iteration concern. This
  workstream ships a reasonable starting value per the
  perceptual criterion ("fast relative to planet size" AND
  "not so fast the planet feels small"). Max tunes during
  the recording review.

- **Warp-phase perf fixes.** `warp-phase-perf-pass-2026-04-20.md`
  owns the FOLD / ENTER / EXIT hitches. This workstream's ENTRY
  may inherit whatever exit-smoothness residual exists at
  execution time. If that residual makes AC #8 fail, flag in
  the recording review — do not attempt to fix both sides at
  once.

- **Manual-burn velocity continuity.** WS 4 wires the manual-
  burn path through the navigation subsystem (WS 1) and may
  need to match velocity at burn-on. The ship choreographer
  exposes the ship's current velocity as a readable property
  so WS 4 can honor inertial continuity per the feature doc
  §"Manual override." WS 4 does the wiring; this workstream
  just makes the velocity readable.

## Handoff to working-Claude

Read this brief first. Then, in order:

1. **`docs/FEATURES/autopilot.md` in full**, especially
   §"Per-phase criteria — ship axis" (the AC source), §"Gravity
   drives — ship-body shake on abrupt transitions" (the shake
   mechanism), §"Failure criteria / broken states" (the full
   rubric for what breaks this workstream), and §"Open
   questions" (binary barycenter, literal-vs-felt speeds, orbit-
   speed ratio — all addressed above).

2. **`docs/SYSTEM_CONTRACTS.md` §10 in full**, especially §10.1
   (two-axis state machine), §10.2 (ORBIT retirement), §10.5
   (warp-exit handoff — invariants 1, 2, 3 are this workstream's
   §8 AC), §10.8 (gravity-drive shake invariant — AC #5), §10.10
   (contract precedence).

3. **`docs/GAME_BIBLE.md` §8H** — Propulsion & Travel Landscape,
   specifically the Gravity Drive subsection. Read the lore
   before implementing shake; the shake mechanism IS the lore
   made visible.

4. **`docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md`**
   — WS 1's brief + output. `Shipped 3d53825`. The navigation
   subsystem is this workstream's primary dependency. Read it
   before designing the ship choreographer.

   **4a. Concrete API surface (on master at HEAD, confirmed
   2026-04-21).** Read `src/auto/NavigationSubsystem.js` — top
   JSDoc block through line ~230. Key contract points that
   shape this workstream:

   - **Entry method:** `beginMotion(input)`. Single signature —
     autopilot and manual-burn both pass through this. Shape:
     `{ fromPosition, fromOrientation, fromOrbitBody, toBody,
     toBodyRadius, toOrbitDistance, nextBody, nextOrbitDistance,
     arrivalOptions: { approachFirst, holdOnly, slowOrbit,
     orbitDuration, approachOrbitDuration }, launchOptions:
     { warpExit, descentVector, outerOrbitRadius } }`. The ship
     choreographer calls `beginMotion` to start each leg of the
     tour; it does NOT drive motion by directly writing to the
     subsystem's internals.

   - **Per-frame contract:** call `subsystem.update(dt)`; it
     returns a `MotionFrame` with `{ position, velocity,
     lookAtTarget, phase, motionStarted, travelComplete,
     orbitComplete, targetingReady, abruptness }`. The ship
     choreographer reads this per frame to know ship pose.

   - **Subsystem-internal phase enum:** `descending /
     traveling / approaching / orbiting` (note the lowercase
     names in the MotionFrame). This is the **legacy single-
     axis carve inherited from pre-refactor `FlythroughCamera`**
     — NOT the new ship-axis `ENTRY / CRUISE / APPROACH /
     STATION`. The two vocabularies are orthogonal. See drift-
     risk "Phase-name collision with subsystem internals"
     below. WS 3 may retire the subsystem's internal names;
     this workstream does not.

   - **`abruptness` field:** V1 emits `0.0` per subsystem JSDoc
     L24/L35 (*"V1 = 0.0; V2 wires d²x/dt² math (§10.8
     consumer)"*). **This workstream's AC #5 is where the
     actual math lands.** The ship choreographer produces the
     abruptness signal (position second-derivative, velocity
     discontinuity, or per-phase-transition-driven trigger),
     and the shake mechanism consumes it. The subsystem's
     `_abruptness = 0` stays as a default; the ship
     choreographer writes the real value.

   - **`rotBlendDuration`:** public property the subsystem sets
     per motion-start (1.0s for tour departures, proportional-
     to-travel-duration capped at 2.5s for warp/manual-burn).
     Camera follow-mode reads this for its orientation slerp.
     Don't fight it.

5. **`docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`**
   — the multiplier input for ENTRY / STATION around stars.
   This workstream's ship motion consumes that multiplier; it
   does not duplicate the tuning work.

6. **`docs/WORKSTREAMS/warp-phase-perf-pass-2026-04-20.md`** —
   cross-reference, especially the EXIT velocity-continuity
   hypothesis (H3). The warp-exit → ENTRY handoff AC #8 lives
   on the boundary between that workstream's EXIT smoothness
   and this workstream's ENTRY start.

7. **`src/effects/WarpEffect.js`** — read-only. Understand the
   EXIT phase's output state (camera position, camera
   orientation, `cameraForwardSpeed` at EXIT end) because
   ENTRY reads that state as its initial condition.

8. **`src/auto/FlythroughCamera.js`** — read-only (this
   workstream) aside from the debug follow-mode addition. The
   existing state enum is what WS 3 retires; this workstream
   leaves it alone.

9. **`src/main.js`** — specifically the warp-exit autopilot
   pickup (~L3884–L3900, L4063–L4100) and the
   `_flythroughBeginTravelFrom` handoff chain. This is where
   ENTRY is wired in.

10. **`docs/MAX_RECORDING_PROTOCOL.md`** — §"Capture path —
    canvas features (default)" for the AC #6 recordings.

11. **`feedback_motion-evidence-for-motion-features.md`** — the
    cross-project principle this workstream honors.

12. **`feedback_always-test-sol.md`** — Sol as the primary
    recording target. Sol exercises `KnownSystems` /
    `SolarSystemData`, a distinct code path from procedural
    systems.

Then, in order of execution:

1. **Design the ship choreographer's data model.** Before code:
   name the state (ship position, ship velocity, current ship-
   phase, abruptness signal, shake magnitude). Surface the data
   model in chat and sanity-check against §10.1 before
   implementing.

2. **Implement ENTRY** — the new phase, greenfield. Read warp-
   exit state on pickup; derive initial pose from warp-exit
   forward vector; bend the ship gradually toward the barycenter
   at a safe distance (consuming the star-orbit multiplier from
   `populateQueueRefs`).

3. **Implement CRUISE → APPROACH → STATION** — each consuming
   the previous phase's final state as initial conditions. The
   velocity curve across boundaries is C1-continuous by
   construction.

4. **Implement the gravity-drive shake mechanism.** Additive
   shake input on ship position; magnitude from the abruptness
   signal. Add the debug hook for AC #5's verification
   recording.

5. **Wire the debug camera follow-mode** in `FlythroughCamera`
   — minimally invasive, labeled as scaffolding.

6. **Intra-session sanity check via `mcp__chrome-devtools__*`**
   (per `feedback_prefer-chrome-devtools.md`, NOT Playwright).
   Dev-shortcut to Sol, trigger warp-exit handoff, watch the
   ship motion. Screenshot for a Playwright-style self-audit.
   Not the Shipped artifact.

7. **Capture the primary recording** — Sol warp-exit → full
   tour, 30–60 s. `~/.claude/helpers/canvas-recorder.js` +
   `~/.local/bin/fetch-canvas-recording.sh`. Drop path per
   AC #6.

8. **Capture the shake-verification recording** — debug-
   triggered abrupt transition, 5–10 s. Drop path per AC #6.

9. **Surface contact sheets** (`~/.local/bin/contact-sheet.sh`)
   for both recordings to Max. Highlight specific timestamps
   at phase boundaries (ENTRY→CRUISE, CRUISE→APPROACH,
   APPROACH→STATION) for evaluation.

10. **Commit per AC #9** — stage only specific files touched
    (`src/auto/*.js`, `src/main.js`, this brief). Never
    `git add -A`.

11. **Close at `VERIFIED_PENDING_MAX <sha>`.** Max evaluates
    against the two recordings. On pass → `Shipped <sha>`; on
    fail → diagnose per the failure class (motion not reading
    as authored? tune the motion. Shake firing during smooth
    motion? tighten the abruptness gate. Velocity pop at a
    phase boundary? fix C1 continuity. Warp-exit pose jump?
    check §10.5 invariants).

**If the diff touches `FlythroughCamera.State` or renames any of
its phase enum values, stop and escalate to Director.** That is
WS 3 territory. This workstream's camera touch is strictly the
debug follow-mode addition.

**If shake is firing during normal smooth flight in the primary
recording, AC #5 fails by construction. Do not tune the
abruptness threshold to hide it in the recording — fix the
abruptness signal's derivation.** That is the Principle 2
violation path.

**If the ENTRY pose ends up "above the plane" regardless of
warp-exit direction, stop.** §10.5 invariant 2 is explicit:
*"Start-pose derivation. The arrival pose is derived from the
warp-exit forward vector."* If the pose is "above," the warp-
exit state is being ignored (or misread) — diagnose the read,
don't patch the output.

Artifacts expected at close: 1–3 commits (ship-motion module +
shake mechanism + call-site wiring, separable per AC #9); two
canvas recordings at paths in AC #6; this brief at Shipped with
recording paths cited; any followups spawned (orbit-speed tuning,
binary barycenter refinement with real masses, etc.) recorded
as new entries in this brief's §Followups (if added).

Drafted by PM 2026-04-20 as WS 2 of 4 in the V1 autopilot sequence.
