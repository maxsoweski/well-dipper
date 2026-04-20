# Workstream: Autopilot navigation subsystem split (2026-04-20)

## Status

Scoped — awaiting working-Claude execution. First of four sequential
workstreams delivering V1 autopilot. See
`docs/FEATURES/autopilot.md` §"Workstreams" for the full sequence.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
commit `bdeb0ff` with keybinding update at `4b9b18a`.

Specific sections this workstream serves:

- **§"Manual override — two-layer architecture"** — *"This implies a
  two-layer architecture — load-bearing architectural realization …
  Navigation subsystem … **No — always available.** Reused by
  manual-mode 'burn to' action."* This workstream is the
  implementation pass that establishes that split.
- **§"Drift risks" #2 — *"Leaking cinematography into the navigation
  subsystem. `AutoNavigator` today owns both. If the V1 split is
  implicit ('it kinda works today') rather than explicit, manual-mode
  'burn to' will have cinematography side-effects and autopilot-off
  will not cleanly hand the subsystem over."*** The drift risk the
  feature doc names is what this workstream exists to prevent.
- **§"V1 architectural affordances for V-later items"** — the manual-
  override criterion implicitly requires the split; without it, WS 4
  cannot wire a clean "burn to" affordance.

Primary contracts: **`docs/SYSTEM_CONTRACTS.md` §10.3 Two-layer
architecture (cinematography + navigation subsystem)** — *"`AutoNavigator`
today owns both layers. Splitting them cleanly is a refactor requirement,
not optional. Any V1 autopilot implementation must surface the split
explicitly."* This workstream is that refactor.

Secondary contracts: §5.3 Drive States (`Manual` + `Autopilot` both
need access to the navigation subsystem), §5.4 In-System Targeting
(the `commitBurn()` path must reach the navigation subsystem without
touching the cinematography layer).

## Implementation plan

N/A (feature is workstream-sized). The split is a structural refactor
of one short file (`src/auto/AutoNavigator.js`, ~257 lines) plus
edits to the call-site `main.js` functions listed in §"In scope."
No cross-system state machines; no PLAN_ doc needed.

## Scope statement

Split `AutoNavigator` into two layers per `docs/SYSTEM_CONTRACTS.md`
§10.3 so that the navigation subsystem (accelerate A → B, arrive in
a stable orbit around B, honor safe-distance rules) is callable
independently of the cinematography layer (tour orchestration, queue
building, per-body framing). The cinematography layer consumes the
navigation subsystem; the navigation subsystem does not depend on
cinematography.

This is one unit of work because the two layers are entangled in a
single class today, and splitting one method without the other produces
a half-migrated structure that actively misleads working-Claude in the
next workstream. This workstream ships zero visible change — it is a
refactor-only pass that the next three workstreams rely on.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Core Experience — *"Every system is
different. Finding a terrestrial world or an alien megastructure is
rare and meaningful."* The autopilot is the vehicle that delivers
"rare and meaningful"; a navigation subsystem that can be driven
either by the cinematography (autopilot tour) or by the player
(manual burn) is how the same cinematic flight language covers
both modes. Without the split, manual-mode burns either (a) re-invent
motion execution ad-hoc, producing a different feel per mode, or (b)
inherit cinematography side-effects (queue advance, tour-complete
callbacks) that make "I just want to burn to this moon" feel like
"autopilot hijacks my intent."

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy **Principle 6
— First Principles Over Patches.** `AutoNavigator` has been patched
multiple times across sessions (deep-sky queue, navigable-cluster
queue, per-planet linger heuristics, queue-index-jump APIs) without
a role articulation. A third-and-fourth patch round to add manual-
override and camera-axis decoupling would cross the "2–3 patches"
line. The split is the first-principles move — name the two roles
the class is serving, separate them, then let each evolve on its
own axis.

## Acceptance criteria

**Process / refactor workstream** — zero visible authored-feature
phases. ACs are contract-shaped per `docs/PERSONAS/pm.md` §"Per-phase
AC rule" carve-out for process / tooling workstreams (the same
carve-out that governs `canvas-recording-workflow-formalization-2026-04-19.md`).

1. **Navigation subsystem module exists and is independently callable.**
   A new module (proposed: `src/auto/NavigationSubsystem.js`) exposes
   the motion-execution surface: given a target body reference + an
   orbit distance + a body radius + optional options, produce a
   motion plan that accelerates the ship from its current inertial
   state to a stable orbit around the target. No knowledge of tour
   queues, no `onTourComplete` callback, no per-phase linger
   durations. Verified by reading the module's public API.

2. **Cinematography layer consumes the subsystem; does not reach
   into it.** The retained class (proposed: `src/auto/AutoNavigator.js`
   reduced, or renamed `src/auto/TourOrchestrator.js`) owns queue
   building (`buildQueue`, `buildDeepSkyQueue`, `buildNavigableQueue`),
   queue index state (`currentIndex`, `_stopsVisited`,
   `onTourComplete`), and per-stop linger timing. When it's time to
   move to the next stop, it calls the navigation subsystem's
   motion-execution API with the stop's body ref + distance — it
   does NOT directly reach into navigation-state internals.
   Verified by reading the two modules: the cinematography module's
   imports list names the subsystem, and the subsystem's imports
   list does NOT name the cinematography module.

3. **Existing autopilot tour renders identically post-refactor.**
   This is the regression-guard AC. Pre-refactor: capture one canvas
   recording of an autopilot tour at Sol under the current
   `AutoNavigator` + `FlythroughCamera` code. Post-refactor: capture
   the same recording with the same seed / same entry path. The
   two recordings should be visually indistinguishable — motion,
   linger durations, orbit directions, travel easing all preserved.
   Working-Claude surfaces both recordings and a frame-diff
   overview to Max. **Pass condition:** Max confirms the two
   read as identical. **Fail condition:** any visible difference
   in motion is a regression and blocks Shipped.

4. **Manual burn path (`commitBurn`) reaches the navigation subsystem
   without going through cinematography.** Today's `commitBurn` →
   `focusPlanet` / `focusStar` / `focusMoon` → `flythrough.beginTravelFrom`
   goes through `FlythroughCamera` (camera) but implicitly through
   `AutoNavigator` state as well (the call sites at `src/main.js`
   L3887, L4068, L4098 mutate `flythrough.nextBodyRef` / call
   `beginTravelFrom` which is part of today's conflated surface).
   Post-refactor: the manual-burn call site imports the navigation
   subsystem module and calls the motion-execution API directly,
   without touching tour-queue state. Verified by `grep`: no
   references to `autoNav.queue`, `autoNav.currentIndex`, or
   cinematography-layer state from the `commitBurn` path.

5. **`FlythroughCamera` is not touched in this workstream.** Camera-
   axis work lives in WS 3. This refactor is strictly the
   navigation / cinematography split. `FlythroughCamera` continues
   to do everything it does today; the rename + state-enum
   retirement is WS 3's job. Verified by reading the diff: no
   edits to `src/auto/FlythroughCamera.js`.

6. **No new behavior, no new tests fail, no user-visible change.**
   The dev-mode autopilot tour, the warp-arrival autopilot pickup,
   the manual burn path, the Tab next-planet cycler, the deep-sky
   tour, and the navigable-cluster tour all behave identically.
   Verified by a smoke-test session: dev-shortcut to Sol, let
   autopilot run through the full tour + one warp, run a manual
   burn, open deep-sky, open a navigable cluster. If any flow
   regresses, halt and escalate.

7. **One commit for the split.** Commit message shape:
   `refactor(autopilot): split AutoNavigator into navigation-subsystem
   + cinematography layers`. Commit body cites this brief path, lists
   the modules created / edited, and states explicitly that no
   behavior changes. Stage ONLY the specific files touched — never
   `git add -A` — per `docs/PERSONAS/pm.md` §"Commit discipline."

## Principles that apply

Four of the six from `docs/GAME_BIBLE.md` §11 Development Philosophy
are load-bearing here. Principle 3 (Per-Object Retro Aesthetic) and
Principle 4 (BPM-Synced Animation) are orthogonal to a structural
refactor and are omitted.

- **Principle 6 — First Principles Over Patches.** This is the
  headline principle for this workstream. `AutoNavigator` has been
  patched for deep-sky tours, navigable-cluster tours, per-planet
  linger heuristics, and queue-index-jump affordances — each added
  without revisiting the role of the class. Patching it again for
  manual-override + camera-axis decoupling would cross the "2–3
  patches" line. The refactor is the first-principles move.
  *Violation in this workstream would look like:* adding a new
  method `AutoNavigator.beginManualBurn()` alongside the existing
  `beginTravel*` methods on `FlythroughCamera`, wiring it as an
  "escape hatch" around the cinematography layer, and claiming the
  split is complete. That is a patch, not a split.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** The post-refactor dependency direction must be
  one-way: **pipeline → cinematography → subsystem → camera**
  (renderer). Generator data flows through `StarSystemGenerator`
  into the cinematography layer (which builds the queue), the
  cinematography layer calls the subsystem with individual stops,
  the subsystem writes motion plans, the camera consumes the
  motion plans. *Violation in this workstream would look like:*
  the navigation subsystem importing from `src/generation/` to
  "look up" body properties — that's a backward flow. Or the
  camera reading tour-queue state to decide framing — also
  backward. Data flows in; state flows out.

- **Principle 2 — No Tack-On Systems.** The seductive anti-pattern
  here is a "bridge module" or "facade class" that sits between
  the cinematography and subsystem layers, forwarding calls and
  translating state. That is a tack-on. The clean answer is a
  direct dependency: the cinematography layer's module imports
  the subsystem module and calls its API. If the API requires an
  adapter, the API is wrong — fix the API shape, not with a
  bridge.
  *Violation in this workstream would look like:* a
  `NavigationAdapter` / `AutoNavigatorBridge` / `SubsystemFacade`
  file. Any new module whose sole job is translation is a
  warning sign.

- **Principle 1 — Hash Grid Authority** (adjacent, not central).
  The navigation subsystem accepts body references and position
  vectors as inputs; it does NOT query the hash grid, the
  `GalacticMap`, or any generator. The cinematography layer owns
  the "what body is at this stop" question, answered from the
  already-generated system data. The subsystem only needs the
  resolved body reference + current camera state.
  *Violation in this workstream would look like:* the subsystem
  taking a `starIndex` or `galacticCoord` and resolving it to a
  mesh internally. It doesn't get to know the galaxy exists.

## Drift risks

- **Risk: Half-migration.** The seductive version: extract one or
  two methods into the subsystem module, leave the rest in the
  monolith, ship the workstream claiming "the split is started."
  Result: the next workstream has to finish the split AND build its
  new feature, which entangles the two concerns.
  **Why it happens:** a full split of 257 lines across two modules
  feels like a lot for a commit with zero visible change. Partial
  migration feels like "pragmatic."
  **Guard:** AC #1 + AC #2 together require the split to be
  complete. The subsystem must be independently callable; the
  cinematography layer must not reach into subsystem internals.
  A half-migration fails AC #2 by construction. The regression
  recording (AC #3) is the acceptance evidence; a half-migrated
  tour will be visually identical to a pre-migration tour (because
  nothing changed behaviorally), which is the right sign — but the
  AC #2 code-read is what catches the half-split.

- **Risk: Creating a "bridge" module during migration.** Principle
  2 above names this as the headline failure mode. Working-Claude
  is tempted to create a transitional adapter "for safety," plans
  to remove it later, never does.
  **Why it happens:** the adapter lets the call sites stay the
  same during migration, reducing blast radius. Safety feels
  responsible.
  **Guard:** the call-site changes in `src/main.js` ARE part of
  this workstream. AC #4 explicitly requires the manual-burn
  path to reach the subsystem directly. No adapter survives this
  workstream's close.

- **Risk: Extending the subsystem's API beyond motion execution.**
  The subsystem's job is motion execution only. Once the module
  exists, it's tempting to lift "safe-distance classification"
  or "per-body-type approach heuristics" into it — after all,
  those are "navigation concerns." But those are
  cinematography-layer or per-stop-data concerns, and lifting
  them inflates the subsystem's role.
  **Why it happens:** the subsystem feels like "the smart motion
  module" rather than "the dumb executor."
  **Guard:** AC #1 names the subsystem's surface exactly: given
  a body ref + orbit distance + body radius, execute motion. The
  orbit distance comes from the caller — the subsystem does NOT
  compute "should this be a 20× multiplier?" That's the
  `autopilot-star-orbit-distance` workstream's concern, landing
  in the cinematography-layer call site.

- **Risk: Camera state leaking into the subsystem.** `FlythroughCamera`
  today owns camera state (yaw, pitch, orbit-distance-breathing,
  free-look offset). The refactor may be tempted to move some of
  that "into" the navigation subsystem under the reasoning that
  "motion state and camera state are related."
  **Why it happens:** the subsystem and the camera share a
  position (the ship's position), and it's easy to conflate ship
  position with camera position in a game that historically
  coupled them.
  **Guard:** AC #5 names the split explicitly. The camera axis
  retirement is WS 3. The subsystem produces motion plans that
  the camera (or whatever renders the ship) consumes —
  decoupling of motion-plan-production from camera-state-update
  is exactly what enables the two-axis structure.

- **Risk: Discovering mid-refactor that the existing code is
  tangled in ways the interface-only read did not catch.** The
  current `FlythroughCamera.beginTravelFrom` mutates camera
  orientation, velocity profile, and look-at blending in a single
  call. Some of that is camera (WS 3 territory), some is motion
  (this workstream's territory). The line is not clean.
  **Why it happens:** the tangle is the reason the split is
  needed. The tangle is also why the split is risky.
  **Guard:** when the line is genuinely ambiguous, default to
  *"camera stays in FlythroughCamera, motion moves to subsystem."*
  The subsystem's output is a motion plan (position + velocity
  over time) that the camera consumes. If something in the
  existing code decides "where the camera looks at this moment,"
  it's camera. If it decides "where the ship is moving," it's
  navigation. If the code does both in one step, split the step.

## In scope

- **New module `src/auto/NavigationSubsystem.js`** (name provisional;
  working-Claude picks the final name during implementation, but
  the role is fixed). Owns the motion-execution API: accelerate
  from the current inertial state to a stable orbit around a body.
  Consumes: current camera position / velocity, target body ref,
  target orbit distance, target body radius, options (short-trip
  vs. long-trip detection, arrival easing profile, etc.). Produces:
  motion plans that the caller ticks via `update(deltaTime)`.

- **Reduced / renamed `src/auto/AutoNavigator.js`** (proposed
  rename: `src/auto/TourOrchestrator.js`, or keep the name and
  let the semantics tell). Retains: queue building (all three
  `build*Queue` methods), queue index state, `onTourComplete`
  callback, per-stop linger logic, per-stop advance / jump
  affordances. Loses: any method that directly executes motion.
  When it's time to move, it calls the subsystem.

- **Call sites in `src/main.js`** that today reach through
  `flythrough.beginTravelFrom` with implicit `autoNav` coupling —
  currently L3887, L4068, L4098 (autopilot pick-up sites) and
  L4445, L4485, L4517 (manual burn sites). Post-refactor: the
  autopilot sites drive through the cinematography layer (which
  drives through the subsystem); the manual-burn sites drive
  through the subsystem directly. This split at the call-site
  layer is what makes WS 4's manual-override work clean.

- **Pre-refactor regression recording** captured at the start of
  the workstream via `~/.claude/helpers/canvas-recorder.js` +
  `~/.local/bin/fetch-canvas-recording.sh`. Drop path:
  `screenshots/max-recordings/autopilot-navigation-subsystem-split-2026-04-20-before.webm`.
  5–10 s of autopilot tour at Sol showing star → first planet →
  first moon. Referenced in AC #3.

- **Post-refactor regression recording** captured at the end of
  the workstream with the same entry flow. Drop path:
  `screenshots/max-recordings/autopilot-navigation-subsystem-split-2026-04-20-after.webm`.

- **One commit** per AC #7.

- **`## Status` line in this brief** flipped from "Scoped" →
  `VERIFIED_PENDING_MAX <sha>` → `Shipped <sha> — verified against
  <both-recording-paths>` per `docs/MAX_RECORDING_PROTOCOL.md`.

## Out of scope

- **Camera-axis changes.** `FlythroughCamera` is untouched. AC #5
  is the guard. Camera work is WS 3.

- **Ship-axis phase renames.** `DESCEND / ORBIT / TRAVEL / APPROACH`
  stay exactly as they are in this workstream. The ship-axis
  phase model (ENTRY / CRUISE / APPROACH / STATION) is WS 2's
  concern. This workstream does not touch phase names or the
  state enum.

- **Toggle UI, manual-override affordance wiring, HUD-hide, audio
  event surface.** All WS 4. This workstream lands the clean
  manual-burn call path that WS 4 will surface as a user
  affordance, but it does not add any user-facing behavior.

- **`AutoNavigator.buildQueue` selector-function refactor.** The
  feature doc §"V1 architectural affordances" calls out that
  `buildQueue` should take a `selector` function in V1 so
  V-later can supply an OOI-weighted selector. That is a future
  workstream's concern; introducing the selector here would
  conflate the split with a new-feature hook. The monotonic-
  distance default stays as-is inside `buildQueue`.

- **OOI query interface stub.** WS 3 (camera axis). The stub
  lives on the camera side per §10.9.

- **Retuning any behavior — orbit speeds, linger durations, travel
  easing curves, shake mechanism.** This is a refactor. Zero
  behavioral changes; AC #3 is the regression guard. If a tempting
  cleanup surfaces during implementation (e.g., "we could fix the
  short-trip detection heuristic while we're here"), defer to a
  followup — don't mix a behavior change into a refactor commit.

- **Work the `warp-phase-perf-pass-2026-04-20.md` workstream
  touches.** If the perf pass is still in flight, coordinate via
  the Director on ordering. This workstream's refactor does not
  depend on the perf pass landing first, and vice versa.

## Handoff to working-Claude

Read this brief first. Then, in order:

1. **`docs/FEATURES/autopilot.md` in full**, especially §"Manual
   override — two-layer architecture," §"Drift risks" #2, and
   §"V1 architectural affordances for V-later items."
2. **`docs/SYSTEM_CONTRACTS.md` §10.3 Two-layer architecture** and
   §10.10 Contract precedence (the §10 invariants this refactor
   must honor).
3. **`src/auto/AutoNavigator.js`** in full (short file — ~257
   lines). This is the file being split.
4. **`src/auto/FlythroughCamera.js`** L1–130 (the constructor +
   state enum) plus L278–488 (`beginApproach`, `beginTravel`,
   `beginTravelFrom`). Read-only — you need to understand what
   the camera does to know where the motion / camera line falls.
   Do NOT edit this file in this workstream.
5. **`src/main.js`** the `populateQueueRefs` (~L3731) and
   `populateNavigableQueueRefs` (~L3766) sites plus the autopilot
   pick-up sites (~L3844–L3900, L4037–L4100) plus the manual
   burn sites (L4445, L4485, L4517). These are the call-site
   edits.
6. **`docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`**
   — precedent for workstream-level autopilot scoping. Its
   call-site edits (the `8× → 20×` change) survive this
   refactor; this refactor preserves the star-orbit-distance
   multipliers as-is and threads them through the new module
   boundary.
7. **`docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas
   features (default)"** — the recording workflow used for AC
   #3's regression evidence.

Then, in order of execution:

1. **Capture the pre-refactor regression recording** before
   touching any code. Sol debug-start per
   `feedback_always-test-sol.md`; 5–10 s covering star stop →
   first planet → first moon. Drop at the path in §In scope.
2. **Draft the subsystem module's public API.** Write the module
   header (exports, JSDoc) before writing any method bodies.
   Surface the API in chat and sanity-check it against §10.3
   before proceeding. This is the "articulate the split before
   executing it" step.
3. **Implement the subsystem module** by lifting motion-execution
   code out of today's `FlythroughCamera` / `AutoNavigator`
   entanglement. Some of this code is duplicated or tangled; the
   subsystem gets the motion-execution slice.
4. **Thin the cinematography layer** to just queue + index +
   linger + `onTourComplete`. Import and call the subsystem from
   within it.
5. **Update the call sites in `src/main.js`** per AC #4. Manual-
   burn sites call the subsystem directly; autopilot pick-up
   sites drive through the cinematography layer (which drives
   the subsystem).
6. **Capture the post-refactor regression recording** with the
   same entry flow as step 1.
7. **Frame-diff compare** both recordings via contact sheets at
   matched timestamps (`~/.local/bin/contact-sheet.sh` at e.g.
   `5x1 1` — one frame per second across 5 s). Surface both
   sheets to Max. Pass condition: Max reads them as identical.
8. **Commit per AC #7** — stage only the specific files touched
   (`src/auto/*.js`, the new subsystem module, `src/main.js`,
   this brief). Never `git add -A`.
9. **Close at `VERIFIED_PENDING_MAX <sha>`.** Wait for Max's
   evaluation of the two recordings. On pass → `Shipped <sha>`;
   on fail → diagnose the regression and re-commit.

**If the diff touches `src/auto/FlythroughCamera.js`, stop and
escalate to Director.** Camera-axis work is WS 3. This refactor's
clean line is ship motion vs. camera motion; if you can't land
the split without touching the camera, the refactor is wrong and
you need to rethink the line.

**If the subsystem's public API feels like it needs more than
one entry method (e.g., `beginTravelFrom` + `beginApproach` +
`beginOrbit`), that's a signal the split is leaking phase
semantics from today's state enum into the subsystem.** The
subsystem's API should be phase-agnostic: "given these inputs,
produce motion toward this target with this arrival behavior."
The caller (cinematography or manual-burn) decides which phase
semantics to apply. If you find yourself writing `beginOrbit`
on the subsystem, the enum is leaking — stop and redesign the
API.

Artifacts expected at close: one refactor commit (new subsystem
module + slimmed cinematography module + call-site updates in
`src/main.js`); two canvas recordings at the paths in §In scope;
this brief at Shipped with both recording paths cited.

Drafted by PM 2026-04-20 as WS 1 of 4 in the V1 autopilot sequence.
