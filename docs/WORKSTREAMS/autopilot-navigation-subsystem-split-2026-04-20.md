# Workstream: Autopilot navigation subsystem split (2026-04-20)

## Status

Scoped — awaiting working-Claude execution. First of four sequential
workstreams delivering V1 autopilot. See
`docs/FEATURES/autopilot.md` §"Workstreams" for the full sequence.

**Revision history:**
- **2026-04-20 — authored** by PM, scoped to split `AutoNavigator` into
  cinematography + navigation-subsystem layers per §10.3 as-written.
- **2026-04-20 — rewritten** by Director after working-Claude's
  pre-execution code read surfaced that the original brief's target
  was inverted. `AutoNavigator.js` is already cinematography-only;
  the motion/camera monolith is `FlythroughCamera.js`. The refactor
  target, AC #4, AC #5, drift-risk #2, and the Handoff steps have
  been re-aimed accordingly. The *concept* of the split, the four
  Principles that apply, the regression-recording AC, the commit
  discipline, and the workstream sequencing (WS 1 before WS 2/3/4)
  all survive unchanged. Upstream `SYSTEM_CONTRACTS.md` §10.3 and
  `docs/FEATURES/autopilot.md` §"Manual override" + drift-risk #2
  were corrected in the same pass.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
commit `bdeb0ff` with keybinding update at `4b9b18a`.

Specific sections this workstream serves:

- **§"Manual override — two-layer architecture"** — *"This implies a
  two-layer architecture — load-bearing architectural realization …
  Navigation subsystem … **No — always available.** Reused by
  manual-mode 'burn to' action."* This workstream is the
  implementation pass that establishes that split.
- **§"Drift risks" #2 — *"Leaking camera state into the navigation
  subsystem. `FlythroughCamera` today owns both motion execution
  and camera state."*** The drift risk the feature doc names is
  what this workstream exists to prevent.
- **§"V1 architectural affordances for V-later items"** — the manual-
  override criterion implicitly requires the split; without it, WS 4
  cannot wire a clean "burn to" affordance.

Primary contracts: **`docs/SYSTEM_CONTRACTS.md` §10.3 Two-layer
architecture (cinematography + navigation subsystem)** — *"The two
layers are tangled inside `FlythroughCamera.js` … `AutoNavigator.js`
is already cinematography-only … Splitting them cleanly is a refactor
requirement, not optional."* This workstream is that refactor.

Secondary contracts: §5.3 Drive States (`Manual` + `Autopilot` both
need access to the navigation subsystem), §5.4 In-System Targeting
(the `commitBurn()` path must reach the navigation subsystem without
touching the cinematography layer).

## Implementation plan

N/A (feature is workstream-sized). The split is a structural refactor
of `src/auto/FlythroughCamera.js` (~900+ lines — motion execution
lifts out into a new sibling module) plus caller-side edits in
`src/main.js`. `AutoNavigator.js` is largely untouched beyond caller
re-routing in main.js. No cross-system state machines; no PLAN_ doc
needed.

## Scope statement

Split `FlythroughCamera` into two layers per `docs/SYSTEM_CONTRACTS.md`
§10.3 so that the navigation subsystem (accelerate A → B, arrive in
a stable orbit around B, honor safe-distance rules) is callable
independently of the camera layer (yaw/pitch, orientation slerp,
free-look offset, lookAt blending, FOV framing). The subsystem
produces **motion plans** (position + velocity over time + target
framing data); the camera module **consumes** motion plans and
authors its own orientation blend against them. The subsystem does
not depend on the camera; the camera does not mutate motion state.

`AutoNavigator.js` is already cinematography-only (queue + index +
linger + `onTourComplete`). It is not the split target. Its only
edits in this workstream are the caller-side re-routing in `main.js`
(autopilot engage sites stop calling `flythrough.beginTravelFrom`
directly and instead drive the subsystem through the existing
cinematography surface).

This is one unit of work because the motion and camera concerns are
entangled across every `begin*` method in `FlythroughCamera`, and
splitting one method without the others produces a half-migrated
structure that actively misleads working-Claude in the next workstream.
This workstream ships zero visible change — it is a refactor-only
pass that the next three workstreams rely on.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Core Experience — *"Every system is
different. Finding a terrestrial world or an alien megastructure is
rare and meaningful."* The autopilot is the vehicle that delivers
"rare and meaningful"; a navigation subsystem that can be driven
either by the cinematography (autopilot tour) or by the player
(manual burn) is how the same cinematic flight language covers
both modes. Without the split, manual-mode burns either (a) re-invent
motion execution ad-hoc, producing a different feel per mode, or (b)
inherit camera-state side-effects (quaternion slerp that assumes a
prior orbit, lookAt blending baked to tour semantics) that make
"I just want to burn to this moon" feel like "autopilot hijacks my
camera framing."

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy **Principle 6
— First Principles Over Patches.** `FlythroughCamera` has been
patched multiple times across sessions (warp-arrival mode, short-trip
vs. long-trip detection, slingshot-orbit-direction capture, arrival
Hermite blending, hold-only orbit mode) without a role articulation.
A third-and-fourth patch round to add manual-override motion and
camera-axis decoupling would cross the "2–3 patches" line. The split
is the first-principles move — name the two roles the class is
serving, separate them, then let each evolve on its own axis.

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
   state to a stable orbit around the target. No knowledge of yaw /
   pitch / quaternion / free-look / lookAt / FOV. The subsystem's
   output is position + velocity over time + "where should the camera
   be looking at this moment" as a target point, consumed by the
   camera module. Verified by reading the module's public API.

2. **Camera module consumes the subsystem; does not reach into it.**
   The retained class (proposed: `src/auto/FlythroughCamera.js`
   reduced, name preserved — the rename is WS 3's job) owns yaw /
   pitch / orientation slerp / free-look offset / lookAt blending /
   FOV. Per-frame it reads the current motion plan from the subsystem
   and authors its orientation blend against the plan's position +
   target-look data. It does NOT directly compute position / velocity
   / Hermite curves / approach close-in math.
   Verified by reading the two modules: the camera module's imports
   list names the subsystem, and the subsystem's imports list does
   NOT name the camera module. Grep `src/auto/NavigationSubsystem.js`
   for `camera.quaternion` / `camera.lookAt` / `freeLook` — zero hits
   is the pass condition.

3. **Existing autopilot tour renders identically post-refactor.**
   This is the regression-guard AC. Pre-refactor: capture one canvas
   recording of an autopilot tour at Sol under the current
   `AutoNavigator` + `FlythroughCamera` code. Post-refactor: capture
   the same recording with the same seed / same entry path. The
   two recordings should be visually indistinguishable — motion,
   linger durations, orbit directions, travel easing, approach
   close-in timing, free-look responsiveness, all preserved.
   Working-Claude surfaces both recordings and a frame-diff
   overview to Max. **Pass condition:** Max confirms the two
   read as identical. **Fail condition:** any visible difference
   in motion or framing is a regression and blocks Shipped.

4. **Manual burn path (`focusPlanet` / `focusStar` / `focusMoon`)
   calls the navigation subsystem directly, not `FlythroughCamera`.**
   Today: `focusPlanet` (L4445) / `focusStar` (L4485) / `focusMoon`
   (L4517) each call `flythrough.beginTravelFrom(...)`. That's the
   conflated surface — `beginTravelFrom` does motion AND camera
   framing in one call.
   Post-refactor: the manual-burn call sites import the navigation
   subsystem module and call its motion-execution API directly. The
   camera module (what remains of `FlythroughCamera`) still consumes
   the resulting motion plan per frame — but the manual-burn sites
   hand the plan to the camera module via a clean "here's the current
   motion plan to render against" surface, not via a conflated
   `beginTravelFrom` method that does both.
   Verified by `grep`: no references to `flythrough.beginTravelFrom`
   from `focusPlanet` / `focusStar` / `focusMoon`. The subsystem is
   called instead.

5. **`AutoNavigator.js` is not touched beyond caller-site re-routing
   in main.js.** Queue building (`buildQueue`, `buildDeepSkyQueue`,
   `buildNavigableQueue`), queue index state (`currentIndex`,
   `_stopsVisited`, `onTourComplete`), linger heuristics
   (`_planetLinger`), and the advance/jump affordances
   (`advanceToNext`, `jumpTo`, `jumpToStar`, `jumpToPlanet`, `advance`)
   all stay exactly as they are today. The feature-doc-prescribed
   rename to `TourOrchestrator` (if it happens at all) is not in
   scope for this workstream. Verified by reading the diff: no
   non-trivial edits to `src/auto/AutoNavigator.js`.

6. **No new behavior, no new tests fail, no user-visible change.**
   The dev-mode autopilot tour, the warp-arrival autopilot pickup,
   the manual burn path, the Tab next-planet cycler, the deep-sky
   tour, and the navigable-cluster tour all behave identically.
   Verified by a smoke-test session: dev-shortcut to Sol, let
   autopilot run through the full tour + one warp, run a manual
   burn, open deep-sky, open a navigable cluster. If any flow
   regresses, halt and escalate.

7. **One commit for the split.** Commit message shape:
   `refactor(autopilot): extract NavigationSubsystem from FlythroughCamera`.
   Commit body cites this brief path, lists the modules created /
   edited, and states explicitly that no behavior changes. Stage ONLY
   the specific files touched — never `git add -A` — per
   `docs/PERSONAS/pm.md` §"Commit discipline."

## Principles that apply

Four of the six from `docs/GAME_BIBLE.md` §11 Development Philosophy
are load-bearing here. Principle 3 (Per-Object Retro Aesthetic) and
Principle 4 (BPM-Synced Animation) are orthogonal to a structural
refactor and are omitted.

- **Principle 6 — First Principles Over Patches.** This is the
  headline principle for this workstream. `FlythroughCamera` has
  been patched for warp-arrival mode, short-trip vs. long-trip
  detection, slingshot-orbit-direction capture, arrival Hermite
  blending, and hold-only orbit mode — each added without revisiting
  the role of the class. Patching it again for manual-override
  motion + camera-axis decoupling would cross the "2–3 patches"
  line. The refactor is the first-principles move.
  *Violation in this workstream would look like:* adding a new
  method `FlythroughCamera.beginManualBurn()` alongside the existing
  `beginTravelFrom`, wiring it as an "escape hatch" that also touches
  camera state, and claiming the split is complete. That is a patch,
  not a split.

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
  backward. Or the subsystem reading `camera.quaternion` to
  pick a tangent direction — also backward. Data flows in; motion
  plans flow out; camera renders.

- **Principle 2 — No Tack-On Systems.** The seductive anti-pattern
  here is a "bridge module" or "facade class" that sits between
  the camera and subsystem layers, forwarding calls and translating
  state. That is a tack-on. The clean answer is a direct dependency:
  the camera module imports the subsystem module and reads its
  current motion plan per frame. If the API requires an adapter,
  the API is wrong — fix the API shape, not with a bridge.
  *Violation in this workstream would look like:* a
  `NavigationAdapter` / `FlythroughBridge` / `MotionFacade` file.
  Any new module whose sole job is translation is a warning sign.

- **Principle 1 — Hash Grid Authority** (adjacent, not central).
  The navigation subsystem accepts body references and position
  vectors as inputs; it does NOT query the hash grid, the
  `GalacticMap`, or any generator. The cinematography layer owns
  the "what body is at this stop" question, answered from the
  already-generated system data. The subsystem only needs the
  resolved body reference + current ship position + current
  inertial state.
  *Violation in this workstream would look like:* the subsystem
  taking a `starIndex` or `galacticCoord` and resolving it to a
  mesh internally. It doesn't get to know the galaxy exists.

## Drift risks

- **Risk: Half-migration.** The seductive version: extract one or
  two `begin*` methods into the subsystem module, leave the rest in
  `FlythroughCamera`, ship the workstream claiming "the split is
  started." Result: the next workstream has to finish the split AND
  build its new feature, which entangles the two concerns.
  **Why it happens:** a full split of five `begin*` methods + four
  `_update*` interiors across two modules feels like a lot for a
  commit with zero visible change. Partial migration feels like
  "pragmatic."
  **Guard:** AC #1 + AC #2 together require the split to be
  complete. The subsystem must be independently callable; the
  camera module must not reach into subsystem internals. A
  half-migration fails AC #2 by construction. The regression
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
  today couples motion math tightly with camera state — yaw / pitch
  are written inside `beginOrbit` from the camera's current position,
  `_initialQuat` is captured in `beginTravel`/`beginTravelFrom` for
  the orientation slerp, `freeLookYaw`/`freeLookPitch` are overlaid
  on orbit output. The refactor may be tempted to move some of
  that "into" the subsystem under the reasoning that "motion state
  and camera state are related."
  **Why it happens:** the subsystem and the camera share a
  position (the ship's position), and it's easy to conflate ship
  position with camera position in a game that historically
  coupled them.
  **Guard:** AC #1 + AC #2 together name the split. The clean rule:
  the subsystem produces motion plans (position + velocity over
  time + "where to look" as a target point), and the camera module
  authors its own orientation (yaw/pitch/quaternion/free-look/FOV)
  against the plan. If code decides "where the ship is moving," it's
  navigation. If code decides "where the camera is pointing this
  frame," it's camera. If a method does both in one step, split the
  step.

- **Risk: Discovering mid-refactor that the existing code is
  tangled in ways the interface-only read did not catch.** For
  example, `FlythroughCamera.beginTravel` reads `this.orbitYaw`,
  `this.orbitPitch`, `this.orbitDirection` to compute the departure
  tangent — that's camera state driving motion state. Or
  `_updateOrbit` updates `orbitYaw` as part of moving the ship —
  motion state writing camera state. The line is not clean.
  **Why it happens:** the tangle is the reason the split is
  needed. The tangle is also why the split is risky.
  **Guard:** when the line is genuinely ambiguous, default to
  *"position + velocity + target-look-point belong to the subsystem;
  everything that converts those into camera.position +
  camera.quaternion belongs to the camera module."* If the current
  code has the camera's yaw feeding back into the orbit arc's
  tangent computation, that's a camera-state→motion-state leak that
  needs a clean break. The subsystem's orbit arc math should take
  "current ship position relative to body" as input and produce
  "next ship position + target-look-point" as output, independent
  of what the camera's yaw happens to be.

## In scope

- **New module `src/auto/NavigationSubsystem.js`** (name provisional;
  working-Claude picks the final name during implementation, but
  the role is fixed). Owns motion-execution methods lifted out of
  today's `FlythroughCamera`. Input: current ship position +
  velocity, target body ref, target orbit distance, target body
  radius, options (short-trip vs. long-trip detection, arrival
  easing profile, warp-arrival mode, hold-only mode, etc.). Output:
  per-frame motion plan — next ship position, current velocity,
  target-look-point for the camera to use, "state" indicator
  (still traveling / arrived / orbiting / etc.), and abruptness
  signal for the shake hook (V-later consumer; V1 emits zero).

- **Reduced `src/auto/FlythroughCamera.js`** (name preserved —
  rename is WS 3's concern). Retains: yaw / pitch / orientation
  slerp / free-look offset / lookAt blending / FOV framing. Per
  frame, reads the current motion plan from the subsystem and
  authors its orientation blend against the plan's target-look
  data. Loses: position / velocity integration, Hermite curve math,
  orbit arc math, approach close-in math, descend path math —
  those move to the subsystem. The `begin*` methods on the camera
  module are either retired (motion moved out) or reduced to
  "here's a new motion plan to render against, reset my orientation
  blend state."

- **Call sites in `src/main.js`.** Six primary sites:
  - Autopilot engage sites (L3887, L4068, L4098) — today mutate
    `flythrough.nextBodyRef` then call `flythrough.beginTravelFrom`.
    Post-refactor: drive the subsystem (via the cinematography
    layer — `AutoNavigator` surfaces the next stop; main.js hands
    it to the subsystem; the camera module reads the subsystem).
  - Manual burn sites (L4445, L4485, L4517) — today call
    `flythrough.beginTravelFrom` directly. Post-refactor: call the
    subsystem directly. The camera module's orientation blend still
    happens — but it's triggered by "new motion plan in flight,"
    not by a conflated `beginTravelFrom` call.
  - Other `flythrough.begin*` call sites — audit in the Handoff
    step 1 reading pass; the full list is likely 10–15 sites across
    `main.js`. Each one routes through the subsystem post-refactor
    (if motion) or stays on the camera module (if purely camera
    framing).

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

- **`AutoNavigator` rename / restructure.** The feature doc mentions
  `TourOrchestrator` as a possible rename. Not this workstream.
  `AutoNavigator.js` stays as-is beyond caller-site routing.

- **Camera-axis retirement / two-axis dispatch.** That's WS 3. The
  camera module's V1-only `ESTABLISHING` code path is authored in
  WS 3; this workstream leaves camera framing exactly as it is
  today.

- **Ship-axis phase renames.** `DESCEND / ORBIT / TRAVEL / APPROACH`
  stay exactly as they are in this workstream. The ship-axis
  phase model (`ENTRY / CRUISE / APPROACH / STATION`) is WS 2's
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
   §"V1 architectural affordances for V-later items." Note the
   2026-04-20 revision notes on §"Manual override" and drift-risk
   #2 — earlier versions had the monolith attribution inverted.
2. **`docs/SYSTEM_CONTRACTS.md` §10.3 Two-layer architecture** and
   §10.10 Contract precedence (the §10 invariants this refactor
   must honor). Note the 2026-04-20 correction paragraph.
3. **`src/auto/AutoNavigator.js`** in full (~257 lines). This file
   is NOT the split target — read it to confirm for yourself that
   it's already cinematography-only, so you know what you're NOT
   editing.
4. **`src/auto/FlythroughCamera.js`** in full (~900+ lines). This
   IS the file being split. Pay attention to the tangle in each
   `begin*` method: motion math (position/velocity/tangent) and
   camera state (yaw/pitch/quaternion/lookAt) are written together.
   The split line is between those two categories of state.
5. **`src/main.js`** — the call sites that drive into
   `FlythroughCamera`. Primary reads:
   - autopilot engage sites (~L3844–L3900 `startFlythrough`,
     L4037–L4110 `warpRevealSystem`)
   - manual burn sites (L4445 `focusPlanet`, L4485 `focusStar`,
     L4517 `focusMoon`)
   - the autopilot tour loop (~L5430–L5470)
   - any other `flythrough.begin*` calls — do a full-file grep
     and enumerate before starting the refactor.
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
   executing it" step. The API should be phase-agnostic: "given
   these inputs, produce motion toward this target with this
   arrival behavior." The caller (autopilot cinematography or
   manual-burn call site) decides which semantics to apply.
3. **Implement the subsystem module** by lifting motion-execution
   code out of today's `FlythroughCamera`. Every line that writes
   `camera.position`, reads/writes `orbitYaw`-driven tangent math,
   runs Hermite curves, computes approach close-in, or decides
   "where the ship is next frame" moves here. Every line that
   writes `camera.quaternion`, reads `freeLookYaw`, does
   `camera.lookAt`, or decides "where the camera is pointed"
   stays in the camera module.
4. **Thin the camera module** (`FlythroughCamera.js` retained
   name) to just orientation authoring. It reads the subsystem's
   motion plan per frame and authors yaw/pitch/quaternion/FOV
   against it.
5. **Update the call sites in `src/main.js`** per AC #4. Manual-
   burn sites call the subsystem directly; autopilot pick-up
   sites drive the subsystem via the cinematography layer.
6. **Capture the post-refactor regression recording** with the
   same entry flow as step 1.
7. **Frame-diff compare** both recordings via contact sheets at
   matched timestamps (`~/.local/bin/contact-sheet.sh` at e.g.
   `5x1 1` — one frame per second across 5 s). Surface both
   sheets to Max. Pass condition: Max reads them as identical.
8. **Commit per AC #7** — stage only the specific files touched
   (`src/auto/NavigationSubsystem.js` [new], `src/auto/FlythroughCamera.js`
   [reduced], `src/main.js`, this brief). Never `git add -A`.
9. **Close at `VERIFIED_PENDING_MAX <sha>`.** Wait for Max's
   evaluation of the two recordings. On pass → `Shipped <sha>`;
   on fail → diagnose the regression and re-commit.

**If the diff touches `src/auto/AutoNavigator.js` beyond caller-
site impact (which is in `main.js`, not in AutoNavigator itself),
stop and escalate to Director.** `AutoNavigator` is already
cinematography-only; this refactor has no reason to edit it. If
something makes you want to, the refactor line is wrong and you
need to rethink.

**If the subsystem's public API feels like it needs more than
one entry method (e.g., `beginTravelFrom` + `beginApproach` +
`beginOrbit`), that's a signal the split is leaking phase
semantics from today's state enum into the subsystem.** The
subsystem's API should be phase-agnostic: "given these inputs,
produce motion toward this target with this arrival behavior."
The caller decides which phase semantics to apply. If you find
yourself writing `beginOrbit` on the subsystem, the enum is
leaking — stop and redesign the API.

**If the regression recording (AC #3) shows any visible motion
or framing difference**, the split is wrong somewhere. Do not
patch the difference — diagnose where motion/camera state is
crossing the split line and fix the split. A refactor that
required behavioral tweaks to preserve identical output didn't
preserve the interfaces cleanly.

Artifacts expected at close: one refactor commit (new subsystem
module + slimmed camera module + call-site updates in
`src/main.js`); two canvas recordings at the paths in §In scope;
this brief at Shipped with both recording paths cited.

Drafted by PM 2026-04-20 as WS 1 of 4 in the V1 autopilot sequence.
Rewritten by Director 2026-04-20 after pre-execution code read
surfaced the original brief's inverted target attribution; see
Revision history above.
