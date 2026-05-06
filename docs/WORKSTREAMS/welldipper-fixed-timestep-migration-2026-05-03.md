# Workstream: well-dipper fixed-timestep migration (2026-05-03)

## Status

Scoped 2026-05-03 against well-dipper HEAD `679321b` (post toggle-fix
landing, pending Max recording verdict) + `e3504a1` (post world-origin
rebasing Shipped 2026-05-02). Authored as **sibling** to
`docs/WORKSTREAMS/motion-test-kit-2026-05-02.md` — the two compose into
"Path B" per Max's 2026-05-02 direction (*"scope out then deploy B"*):
the kit lands the predicate / replay / hash / recorder library and the
fixed-timestep accumulator pattern itself in a lab; this workstream
lands the accumulator INTO well-dipper's `src/main.js` animate loop so
all 5 kit techniques are fully operational against well-dipper, not
lab-only for techniques #2 / #3 / #4.

This brief is the second half of the pair. It does NOT begin until the
kit brief is `Shipped` — see Drift risk #1 below.

## Parent feature

**N/A — this is an architectural-substrate / refactor workstream, not a
game-feature workstream.** Per the §"Carve-out: refactor / code-lift
workstreams" rule in `docs/PERSONAS/pm.md`, ACs are
**telemetry-assertion shaped** (not phase-sourced; not contract-shaped
in the tooling sense). The migration's contract is *zero behavioral
change at the visible-experience layer*, with one explicit exception:
render-time interpolation may smooth motion that previously stuttered
under variable-dt at high refresh rates (a strict improvement, not a
regression). Telemetry-equivalence path per
`docs/REFACTOR_VERIFICATION_PROTOCOL.md`.

This is the same shape as the world-origin rebasing workstream
(`docs/WORKSTREAMS/world-origin-rebasing-2026-05-01.md`) — substrate
fix, mostly behavior-preserving, telemetry-assertion ACs on the
unchanged surfaces. The rebasing workstream used motion-recording
evidence on the intentionally-changing surfaces; this brief originally
inherited that shape. **Phase 5 ACs were reshaped 2026-05-05 to
telemetry + lab-mode-stub instead of recordings** per the new rule
(see §"Brief amendment history" at the bottom of this brief). World-
origin rebasing remains the load-bearing precedent for the
two-position test pattern (Sol + ≥10,000 scene units), now expressed
in telemetry assertions rather than visual recordings.

The features this migration *touches but does not change behaviorally*:

- `docs/FEATURES/autopilot.md` (Shipped V1 at `7c80c94`) — autopilot
  motion path runs through the migrated loop; AC #7-style telemetry
  asserts identical trajectories pre/post.
- `docs/FEATURES/warp.md` — WarpEffect's phased animations run through
  the migrated loop; AC verifies phase ordering + portal animation
  preserved at multiple test-start positions (same two-position pattern
  the rebasing workstream used; rebasing is the precedent that Sol-only
  evidence is insufficient).
- The in-system screensaver loop, manual-flying camera control, sky
  shader time uniform, idle timer, world-origin rebase event timing.

The features this migration *does* affect at the API-surface level
(though authored experience is preserved):

- The motion-test-kit's techniques #2 / #3 / #4 against well-dipper
  proper. Pre-migration: only labs can demonstrate these. Post-migration:
  the kit's predicates / replays / golden trajectories run against
  well-dipper's actual sim, and the Tester's verdicts gain
  byte-equivalent reproducibility on motion-class workstreams.

## Implementation plan

N/A as a separate `docs/PLAN_*.md` doc. The phasing in §"Acceptance
criteria" carries the architecture inline — the migration's ordering is
its plan. Two reference inputs working-Claude reads first:

- Glenn Fiedler, *Fix Your Timestep!*
  ([gafferongames.com](https://gafferongames.com/post/fix_your_timestep/))
  — the canonical accumulator-with-interpolation pattern. Phase 2 and
  Phase 3 implement the alpha-blend-the-render-state half that's
  often skipped in informal accumulator implementations.
- The motion-test-kit's `core/loop/accumulator.js` and
  `adapters/three/three-loop-binding.js` (Shipped from the kit
  workstream) — the kit IS the accumulator, this workstream wires
  well-dipper to consume it.

## Source material

**Read in order before authoring code:**

1. The kit workstream brief
   `docs/WORKSTREAMS/motion-test-kit-2026-05-02.md` — full context for
   what the kit ships and how this workstream consumes it. Especially
   §"Acceptance criteria / Phase 1" (accumulator API), §"Acceptance
   criteria / Phase 2" (`samples` shape + recorder), §"Acceptance
   criteria / Phase 5" (well-dipper additive integration that this
   workstream upgrades).
2. `docs/REFACTOR_VERIFICATION_PROTOCOL.md` — telemetry-equivalence
   pattern + input-freezing checklist. Every AC #6–#11 below depends on
   this pattern.
3. `docs/WORKSTREAMS/world-origin-rebasing-2026-05-01.md` — the most
   recent precedent for substrate-fix-with-feature-evidence. The rebase
   workstream's two-position warp recording requirement (Sol origin +
   ≥10,000 scene units from origin) is reused here for the same reason:
   substrate changes can pass at one test position and silently fail at
   another.
4. `docs/WORKSTREAMS/autopilot-camera-ship-decoupling-2026-04-25.md`
   §A7 (lhokon body-lock) and `realistic-celestial-motion-2026-04-27.md`
   AC #5 — both define telemetry surfaces this migration must continue
   to satisfy.
5. `src/main.js` lines 5803–6890 — the animate loop. The migration's
   surface area is delineated here. Specifically: line 5803
   (`Math.min(timer.getDelta(), 0.1)` — the variable-dt source today)
   and the ~40 `deltaTime`-consuming sites scattered through the body.
6. `research/motion-testing-methodology-2026-05-02.md` §"Refactor the
   simulation update path to a fixed-timestep accumulator" — Dana's
   recommendation step #2, the impact-per-hour rationale that puts
   this work upstream of every future motion-class workstream.
7. Glenn Fiedler, *Fix Your Timestep!* — full read, especially the
   "Free the Physics" section on render-state interpolation. Phase 2
   stops at fixed-step-no-interpolation; Phase 3 adds interpolation.

## Scope statement

Migrate well-dipper's animate loop in `src/main.js` from a single
variable-dt update path (`timer.getDelta()` clamped to 100 ms feeding
every subsystem's `update(dt)` directly) to a fixed-timestep
accumulator with separated sim and render ticks per Glenn Fiedler's
canonical pattern, consuming the accumulator from the
motion-test-kit. Sim runs at a fixed 60 Hz (16.667 ms), zero or more
sim ticks per RAF; render runs every RAF with state interpolation
(`alpha`-blended) between the previous and current sim states. Every
existing `update(dt)` call site is classified as **sim-affecting**
(uses fixed sim dt, runs in the accumulator's sim loop) or
**render-affecting** (uses real render dt, runs in the render path,
typically with interpolation). The `_captureTelemetrySample()` call
relocates to the sim-tick path so the kit's per-frame predicates and
transform-hash receive consistent state, not interpolated state.
Audio remains on its own real-time clock domain (correctly — fixed-step
sim doesn't help audio); the audio↔sim coupling sites are explicitly
audited and documented to confirm they don't introduce drift.

The migration's verification structure: telemetry-equivalence on
behavior-preserving surfaces (autopilot trajectory, body orbital
positions, ship choreographer state) demonstrates zero numerical
divergence pre/post; **telemetry assertions at multiple test-start
positions (Sol origin + ≥10,000-scene-unit position, same as the
rebasing workstream) confirm phase ordering / rebase semantics / sim-
tick sampling are preserved (Amended 2026-05-05 — formerly canvas
recordings; see §"Brief amendment history")**; lab-mode stub
keybinds plus the live screensaver loop give Max a path to
interactive felt-experience evaluation; the toggle-fix dogfood from
the kit workstream re-runs at HIGHER fidelity (sim-tick predicate
sampling instead of variable-dt-jitter sampling) and either reaffirms
the prior PASS or surfaces the residual issue more cleanly.

This is a single workstream because the loop architecture and the
per-call-site sim/render classification are mutually load-bearing —
landing the loop without classifying every existing `update(dt)` call
site produces silent drift (calls that *should* run on sim dt receive
render dt, or vice versa); landing the classification without the loop
is no-op work. The per-call-site audit is the bulk of the labor; the
loop architecture itself is small. Splitting into "loop now, audit
later" risks the audit being indefinitely deferred while a partial-
migration substrate ships — same trap world-origin rebasing's brief
named (§"Scope statement").

## How it fits the bigger picture

This migration is the architectural precondition Dana's research named
as the second-priority adoption (research §"Adoption recommendations
for well-dipper" step #2):

> *"This is the change that pays back across every future motion-class
> workstream, because it's the precondition for everything downstream.
> Without it, replays drift. With it, the sim becomes byte-equivalent
> across runs given the same input."*

It advances:

- **Game Bible §11 Development Philosophy / Principle 6 (First
  Principles Over Patches).** The motion-test-kit pattern (predicates +
  replays + golden trajectories) is the first-principles redesign of
  the testing layer. Path B completes that redesign by making it real
  for well-dipper proper — the architectural substrate (fixed-timestep
  sim) is the part that turns "same idea in a lab" into "same idea
  against the actual product." Stopping at the kit workstream would be
  a Principle 6 half-measure: the right idea, deployed against the
  wrong surface area.

- **Game Bible §11 / Principle 2 (No Tack-On Systems).** The motion
  testing infrastructure was added as a tack-on to a variable-dt sim
  (additive predicates over an existing telemetry stream). That
  composition works for technique #1 (Δ-predicates) and #5 (flight
  recorder) — they don't depend on determinism — but it's structurally
  blocking for #2 / #3 / #4. Treating fixed-timestep as a future
  workstream while the kit ships and starts being used is the same
  shape as treating world-origin rebasing as deferred while the warp
  shipped: the substrate gap silently caps how far the upstream feature
  can reach. Path B closes the cap.

- **Determinism floor for the Refactor Verification Protocol.** WS 1
  (navigation subsystem split, Shipped `3d53825`) authored
  `docs/REFACTOR_VERIFICATION_PROTOCOL.md` with telemetry-equivalence
  under frozen inputs. "Frozen inputs" is approximated today via seeded
  RNG + explicit positions + fixed-step `update(dt)` *in the harness
  only*. Production runs against a different (variable-dt) sim path
  than the harness, which means the harness can drift from production
  without the harness noticing. Post-migration, harness sim path == prod
  sim path, and the protocol's promise becomes byte-precise.

- **Cascading: motion-test-kit techniques #2 / #3 / #4 fully
  operational.** Kit Phase 5 ships kit-shape telemetry against
  well-dipper's variable-dt loop (additive). That's enough for
  technique #1 and #5. Techniques #2 / #3 / #4 land in the kit but
  cannot be invoked against well-dipper proper until this workstream's
  migration. Path B unlocks the full kit value.

The Godot-portability story is unaffected. The migration uses the
kit's `core/loop/accumulator.js` (engine-agnostic, per kit AC #2);
well-dipper's `adapters/three/three-loop-binding.js` is the binding.
A future Godot port reuses the same `core/` accumulator with a Godot-
specific binding adapter. The migration keeps `core/` purity intact —
all engine wiring stays in `adapters/three/` and `src/main.js`.

## Acceptance criteria

ACs split per `docs/REFACTOR_VERIFICATION_PROTOCOL.md` "Which path
applies":

- Surfaces whose contract is **zero behavioral change** at the visible
  layer (autopilot trajectory, body positions, orbit math, ship
  choreographer, idle timer) → telemetry-equivalence at `1e-6` epsilon
  per the protocol's tolerance default.
- Surfaces whose contract is **change** (warp visible behavior, ship
  motion at high-refresh displays where interpolation may legitimately
  smooth what variable-dt jittered) → telemetry assertions on the
  load-bearing structural properties (phase ordering, frame-pacing
  variance, position-snapshot continuity) PLUS lab-mode keybinds for
  Max's interactive felt-experience evaluation. Recordings are the
  exception path, not the default.
- The migration delivers a new capability (kit techniques #2/#3/#4
  against production) → contract-shaped ACs that verify the capability
  is operational, not just compiling.

**Layered on top of the protocol (Amended 2026-05-05 per
`~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`):**
motion-class, visual, and phased-feature verification defaults to
*telemetry + scene-inventory + lab-mode*. Recordings are reserved for
transient bugs that resist interactive lab reproduction. Phase 5 ACs
#17 / #19 / #20 are reshaped under this rule; AC #18 is reshaped to
update the Tester persona to put lab + telemetry FIRST. See
§"Brief amendment history" at the bottom of this brief.

Five phases, gated dependency-strict.

### Phase 1 — Accumulator wired into animate loop, sim-tick = render-tick = 60 Hz, no interpolation yet

This phase introduces the accumulator at the loop entry. Sim runs at
fixed 60 Hz; under load (RAF dt > 16.7 ms) sim runs multiple ticks
per RAF; under spare time (RAF dt < 16.7 ms — common at 144 Hz
displays) sim runs zero ticks some RAFs. Render runs every RAF using
the *current* sim state (no interpolation yet — visible jitter at
144 Hz is acceptable, will be fixed in Phase 2). This phase's purpose
is to verify the architectural change without yet committing to
interpolation logic.

1. **Animate loop entry (`src/main.js` line ~5803) replaces
   `Math.min(timer.getDelta(), 0.1)` direct dispatch with kit
   accumulator.** Imports `bindToRAF` from
   `motion-test-kit/adapters/three/three-loop-binding.js` per kit AC
   #3. The bind invocation supplies a `simUpdate(fixedDt)` function
   that runs every sim-affecting subsystem's update with fixed dt, and
   a `render(alpha)` function that runs every render-affecting
   subsystem (during Phase 1 `alpha` is unused; Phase 2 wires it).
   Verifiable: `grep -n "timer.getDelta" src/main.js` returns at most
   one match (the accumulator's underlying RAF clock; reads dt and
   feeds the kit accumulator), the legacy `const deltaTime = ...` at
   the loop top is replaced by `simDt` / `renderDt` derived from the
   accumulator's tick callbacks.

2. **Per-call-site classification audit committed at
   `docs/refactor-audits/fixed-timestep-migration-call-sites.md`.**
   Every existing `deltaTime`-consuming call site (~40 in `main.js`,
   ~10 in `src/auto/`, ~5 in `src/effects/WarpEffect.js`,
   `src/sky/SkyRenderer.js`, `src/camera/CameraController.js`,
   `src/objects/Planet.js` / `Moon.js` / `AsteroidBelt.js`) is
   enumerated with three columns: file:line, current dt source,
   classification (`sim` / `render` / `audit-required`). The
   `audit-required` rows are the ambiguous cases that need explicit
   PM/Tester review before phase 3 commits — examples likely to land
   here: idle timer (semantically "wall-clock seconds since last
   input" → render-affecting? or sim-affecting because it gates an
   autopilot start? — ruling: sim, since it triggers sim-state
   transition), audio↔sim coupling sites (audio is real-time, but
   if sim reads audio state for BPM-synced animation, that's a
   bridge). Verifiable: file exists, has a row per enumerated call
   site, total rows match the grep-count of `deltaTime`-consuming
   sites in the touch list.

3. **Audio clock isolation documented.** The audit-list above
   includes a §"Audio clock domain" subsection identifying every
   site where sim reads audio state (`musicManager.currentTrack`,
   BPM-synced animation reading audio time, any `soundEngine`
   real-time reads). Each is documented as either: (a) read-only
   from sim (audio clock pushes data into sim, sim consumes
   passively) — safe; or (b) sim writes affect audio clock
   (sim controls audio timing) — must be moved off the sim tick or
   explicitly noted as "fires-on-every-N-th-sim-tick" with the
   audio-side latency consequence described. Verifiable: subsection
   exists, every audio↔sim coupling site is named with a ruling.

4. **World-origin rebase event timing rule documented + enforced.**
   Per `docs/WORKSTREAMS/world-origin-rebasing-2026-05-01.md` Drift
   risk *"Rebase event timing wrong relative to per-frame logic"*
   and `docs/PLAN_world-origin-rebasing.md` §"Risks / gotchas" #2
   (*"Rebase must happen before any per-frame logic that uses world
   positions that frame"*): in the migrated loop, `maybeRebase()`
   fires at the **start of each sim tick**, before any sim-affecting
   subsystem update. NEVER inside a render path (interpolated render
   state would jump mid-render-frame). Verifiable: the
   `simUpdate(fixedDt)` function's source code begins with a
   `maybeRebase()` call (or equivalent invocation of the rebase
   loop's entry); a comment block at that call site cross-references
   the rebasing workstream's drift-risk text verbatim.

5. **Phase 1 telemetry-equivalence harness lands at
   `tests/refactor-verification/welldipper-fixed-timestep-phase1.html`.**
   Reuses the rebasing workstream's two-scenario pattern (autopilot
   leg + body-orbit advance over N frames) per the input-freezing
   checklist (`docs/REFACTOR_VERIFICATION_PROTOCOL.md`). Captures the
   same per-frame fields the rebasing harness captured (camera
   world-true position, camera quaternion, ship position, body
   positions, tour-stop state). Pass condition: every numerical
   field within `1e-6` epsilon at every sim-tick boundary,
   pre-migration HEAD vs post-migration HEAD. Specifically guards
   the "rebase event lands on sim tick boundary" rule from AC #4 by
   advancing the autopilot leg across a `REBASE_THRESHOLD_SQ`
   crossing.

   *Note on what "1e-6 epsilon" means here:* the comparison is
   pre-migration variable-dt sim vs post-migration fixed-step sim.
   These are NOT bit-equivalent by construction (different dt
   schedules → different numerical paths through the math).
   `1e-6` is the rebasing-workstream tolerance because both use
   double-precision JS number math; the migration sticks with that
   tolerance and surfaces any field that systematically drifts
   above it as a real defect (most likely: an `update(dt)` call site
   that should be sim but was misclassified as render, or vice
   versa). The harness reports per-frame max-divergence so
   working-Claude can pinpoint the offending site.

### Phase 2 — Render-time interpolation (`alpha`-blended)

Phase 1 leaves render running at "current sim state." On Max's
high-refresh display (typically 144 Hz or higher), this looks
visibly stuttery — render runs every ~7 ms but sim only updates
every 16.7 ms, so 1-in-2 RAFs render the same sim state. Phase 2
adds the canonical fix: render reads the previous AND current sim
states and lerps between them by `alpha` (the accumulator's
fractional position between sim ticks, 0 ≤ alpha ≤ 1).

6. **Sim subsystems publish two-state snapshots: previous-sim-state
   and current-sim-state, both pure-data.** Examples: camera
   position+quaternion at sim tick N-1 and at sim tick N, ship
   choreographer's shake euler at N-1 and at N, body positions at
   N-1 and at N. The pure-data shape matches the kit's `SampleRecord`
   contract per kit AC #7, so the same data feeds both render
   interpolation AND telemetry sampling. Verifiable: the relevant
   subsystems expose `previousState` / `currentState` accessors (or
   equivalent two-snapshot API), and the render path reads both.

7. **Render path interpolates camera position + quaternion.** Camera
   position lerps `prevPos.lerp(currPos, alpha)`; quaternion slerps
   `prevQuat.slerp(currQuat, alpha)`. Order: position first, then
   quaternion, then `lookAt` if dispatched, then shake-rotation
   multiplication if active (mirroring the existing post-`lookAt`
   shake composition at `src/main.js` ~6727–6732). Verifiable: at
   144 Hz on Max's hardware, a recording shows visibly smooth motion
   during an autopilot CRUISE leg — no 60 Hz judder visible against
   the high-refresh background. Felt-experience evidence; canvas
   recording per `docs/MAX_RECORDING_PROTOCOL.md`.

8. **Body-orbit motion interpolates per-body position.** Each
   `Planet` / `Moon` / `AsteroidBelt` exposes prev/curr position
   snapshots and the render path lerps. Bodies that visibly orbit
   fast at high `celestialTimeMultiplier` values (e.g., 1000×) must
   render smoothly without judder. Verifiable: a recording with
   `celestialTimeMultiplier = 1000` set, autopilot pointed at a Sol
   moon, shows the moon translating smoothly during APPROACH; no
   per-sim-tick judder visible.

9. **Telemetry sampler hooked into sim tick.** The
   `_captureTelemetrySample()` call in `src/main.js` (currently at
   ~6734 inside the autopilotMotion branch) relocates to the sim-tick
   path so each sample reads the *fresh post-sim-update* state, not
   an interpolated render-time state. Verifiable: the existing
   `window._autopilot.telemetry.samples` array, when toggled on
   during an autopilot leg, contains exactly one sample per sim tick
   (60 Hz on average — `samples.length / wallClockSeconds ≈ 60`,
   ±5%), independent of display refresh rate. The previous behavior
   (one sample per render tick at 144 Hz) drops to 60 Hz, and the
   sample timestamps land on sim-tick boundaries.

### Phase 3 — Per-call-site migration of every `update(dt)` consumer

Phase 1 introduced the accumulator and classified the call sites;
Phase 3 actually moves each call into its right place (sim path or
render path).

10. **Every sim-classified call site receives fixed sim dt; every
    render-classified call site receives variable render dt.** The
    audit list from AC #2 is the work breakdown. Each call-site
    migration is its own commit (or commits-per-file group when
    related), so the migration is reviewable at the granularity of
    individual subsystem decisions.

    Specifically called out as sim-classified:
    - `autopilotMotion.update(dt)` — sim. Path planning, phase
      transitions, motionComplete events.
    - `flythrough.update(dt)` / `navSubsystem.update(dt)` — sim.
      Same reasons.
    - `cameraChoreographer.update(dt, frame)` — sim. Framing-state
      lerps that affect the camera's *commanded* position; render-
      time interpolation handles the smooth-motion layer above.
    - `shipChoreographer.update(dt, frame)` — sim. Shake envelope,
      signal smoothing.
    - `cameraController.update(dt)` — sim. Manual orbit input
      processing.
    - `warpEffect.update(dt)` — sim. Phased warp animations are
      time-windowed sim state.
    - `warpPortal.update(dt)` — sim. Same.
    - Body orbit / rotation advance (`Planet.update`,
      `Moon.update`, `AsteroidBelt.update`, `MoonGenerator` orbit
      math) — sim. Per `realistic-celestial-motion-2026-04-27.md`
      AC #2 — celestial state advances at sim rate.
    - `idleTimer += dt` — sim. Triggers autopilot start (sim
      transition).
    - World-origin rebase check — sim. Per AC #4 above.
    - Per-leg lhokon body-lock compensation — sim.

    Specifically called out as render-classified:
    - `skyRenderer.update(camera, dt)` — render. Time-based shader
      uniforms feed visual-only output. (If it gates a sim-affecting
      thing — e.g., a star's position the autopilot reads — that's
      audit-required: route the sim-affecting half through sim, keep
      the shader-uniform half on render dt.)
    - Camera quaternion slerp toward target (the warp-targeting
      slerp at `src/main.js` ~6239) — render. The slerp is a
      visible-motion thing; the underlying targeting state is sim.
    - Gallery / preview-mode camera animations — render. Visual-only
      eased motion.

    Specifically called out as audit-required (Tester ruling needed
    before commit):
    - `flythrough.update`'s velocity-blend logic during warp arrival —
      mostly sim, but blends against a render-rate camera quaternion
      slerp. Decompose into sim part (target velocity computation) +
      render part (slerp display).
    - Audio-time-driven animations — render. (Audio is its own clock
      domain. Animations that read audio time stay on render.)
    - Title-screen / splash-screen animations — render.

    Verifiable: post-Phase-3 grep `deltaTime` in `src/main.js` shows
    every consuming line is either inside the `simUpdate` callback
    or the `render(alpha)` callback (no orphan calls outside the
    accumulator's binding); audit list AC #2 has every row's
    classification translated to a code location.

11. **`AutopilotNavSequence.js` `performance.now()` call sites
    migrate to sim clock.** Lines 322 and 412 currently use
    `performance.now()` — wall-clock real time. Per Dana's research
    §"Replay infrastructure" (*"if any gameplay logic uses
    [DOMHighResTimeStamp] directly, replays will desync on different
    hardware"*), this is exactly the failure mode that breaks input
    replay. Migrate to the sim-tick clock (a monotonically-increasing
    sim-clock counter incremented per sim tick). Verifiable: `grep -n
    "performance.now\|Date.now" src/auto/` returns zero matches
    (or only matches that are explicitly inside audio-clock-domain
    code paths, which are render-side and called out individually).

12. **Phase-3 telemetry-equivalence harness extends Phase-1 harness
    to cover the per-call-site migration.** Same scenarios; the
    harness's pass condition tightens — every numerical field
    `1e-6` at every sim tick (no longer just at sim-tick boundaries
    of the unmigrated subsystems). If a sim-classified subsystem is
    silently consuming render dt, the harness flags it as
    divergence.

### Phase 4 — Kit techniques #3 + #4 operational against well-dipper

Phase 3 leaves well-dipper deterministic at the sim path. Phase 4
turns on input replay (technique #3) and transform-hash golden
trajectory (technique #4) against well-dipper proper.

13. **Seeded RNG threaded through sim path.** Every `Math.random()`
    in sim-classified code paths replaced with the kit's
    `mulberry32`-backed RNG (`motion-test-kit/core/rng/mulberry32.js`
    per kit AC #12), seed sourced from `?seed=N` URL param or a
    debug-mode default. Render-side `Math.random()` (e.g., shader
    randomization, visual-only twinkle) stays on `Math.random()`
    since render isn't part of the deterministic sim. Verifiable:
    `grep -rn "Math.random" src/auto/ src/objects/ src/effects/` lists
    only render-side / audit-justified call sites; sim-side call sites
    are zero. Two URL loads with the same seed + same input replay
    produce byte-equivalent telemetry.

14. **Input replay against well-dipper.** The kit's
    `adapters/dom/keyboard-mouse-bridge.js` (per kit AC #15)
    captures real input during a recording session; replay drives
    the same sim deterministically. Working-Claude exposes a
    debug-mode toggle (URL param `?recordInput=1` and
    `?replayInput=path/to/recording.json`). Verifiable: a recording
    session captures a 30-second autopilot tour with one manual W
    interrupt; replay against the same seed produces a transform-
    hash that exactly matches the original (using the kit's
    `transformHashEquivalence` predicate per kit AC #6).

15. **Golden trajectory committed for the canonical scenario.**
    Per Dana's research recommendation: *"warp to Sol, autopilot to
    Earth, manual disengage."* The scenario ships as a kit
    `scenario` function (per kit AC #19) at
    `tests/golden-trajectories/canonical-scenario.js`. The golden
    transform-hash is committed at
    `tests/golden-trajectories/canonical-scenario.golden.json`. CI-
    style verification (still ad-hoc — no build server, just a `npm
    run verify-golden` script in `package.json`) runs the scenario
    and asserts hash-equivalence. Verifiable: file exists, the
    `verify-golden` script runs in <30 wall-clock seconds and
    reports PASS or per-frame mismatch diagnostics.

### Phase 5 — Dogfood + telemetry/lab-mode verification + Tester persona update

**Reshaped 2026-05-05 from "canvas-recording verification" to
"telemetry + lab-mode verification" per the new rule.** The toggle-fix
dogfood (AC #16) and the kit-techniques dogfood remain — predicates
against post-migration sim-tick samples — at higher fidelity than
pre-migration. The four canvas recordings originally specified by
AC #17 are removed in favor of telemetry assertions (running now,
against existing infrastructure) plus lab-mode keybinds for Max's
interactive felt-experience evaluation (full lab-mode lands in the
sibling workstream `welldipper-lab-mode-2026-05-05`; this brief
ships a minimal stub). The Tester persona's "Production-grade
verification (post-migration)" subsection is reshaped under AC #18
to put lab + telemetry + scene-inventory FIRST, with recordings as
the exception path.

16. **Toggle-fix re-verification at sim-tick fidelity.** Re-runs
    the kit AC #23 dogfood against the post-migration HEAD. The
    kit's `deltaMagnitudeBound` + `monotonicityScore` + `signStability`
    predicates execute against per-sim-tick samples (60 Hz, no render
    interpolation contaminating the data) for the post-W-press
    window. Pass condition: predicates report PASS, OR they report
    a residual issue that — if it shows up only post-migration but
    not pre-migration — is surfaced as a real bug for follow-up
    in the toggle-fix workstream's context (Max-tiebreak whether
    that's a migration regression or a pre-existing bug the kit
    finally caught). Verifiable: dogfood output appended to the
    toggle-fix workstream's DIAGNOSIS.md addendum (or a sibling
    addendum at the same path), with the predicate verdicts recorded.

    **Status (2026-05-05): COMPLETE.** Addendum on disk at
    `~/projects/well-dipper/screenshots/diagnostics/manual-autopilot-toggle-2026-05-02/DIAGNOSIS-phase5-dogfood-addendum.md`.
    Predicate verdicts recorded: STATION-phase predicate runs all PASS
    (autopilot motion structurally clean post-migration). Surfaced kit
    limitation: predicates don't natively understand world-origin
    rebasing — they flag rebase events as oscillation. The limitation is
    documented in the addendum and is the trigger for the kit-side
    "rebase-aware predicate" follow-up (out of scope here).

17. **Telemetry-asserted phase preservation at multiple test-start
    positions + lab-mode stub keybind. (Amended 2026-05-05 — replaces
    the original 4-canvas-recording AC.)** Splits into two layers:

    **Layer A — telemetry assertions (achievable AT HEAD `af06a55`,
    runs now):** Drive the canonical scenarios programmatically via
    the existing `window._autopilot.telemetry` stream and
    `window._warpEffect` API. Three scenarios:

    - **warp-Sol** (warp from a near-origin start position to Sol's
      Earth) — assert phase ordering `IDLE → ENTER → HYPER → EXIT →
      IDLE` preserved across the post-migration sim path; assert
      `WarpEffect.phase` advances monotonically; assert no phase is
      skipped or revisited.
    - **warp-far** (warp from a position ≥10,000 scene units from
      origin to a destination across a `REBASE_THRESHOLD_SQ`
      crossing) — same phase-ordering assertion AND assert at least
      one rebase event fires during HYPER without breaking phase
      ordering (this is the rebasing-workstream's two-position
      requirement, retained as a telemetry assertion rather than a
      visual one).
    - **autopilot-tour** (Sol multi-stop tour) — assert phase
      sequence `IDLE → ENTRY → CRUISE → APPROACH → STATION` per
      tour stop; assert per-leg `motionComplete` events fire in
      order; assert telemetry sample rate ≈ 60 Hz at sim-tick
      fidelity (per AC #9).

    Each scenario's assertions ship as a self-contained harness at
    `tests/refactor-verification/welldipper-fixed-timestep-phase5-{warp-sol,warp-far,autopilot-tour}.html`,
    pattern-matching the Phase 1 / Phase 3 harness style. Pass
    condition: all three harnesses report green; per-scenario
    telemetry sample dumps committed under `qa-results/phase5-ac17/`
    for archaeology.

    **Layer B — lab-mode stub keybind:** A minimal keybind layer
    gated behind URL param `?lab=1` (matches the planned full
    lab-mode contract from sibling workstream
    `welldipper-lab-mode-2026-05-05`). At HEAD `af06a55`, Layer B
    ships exactly ONE keybind: pressing **L** (capital L) when
    `?lab=1` is present opens an in-page panel with text:
    *"Lab mode stub — full keybinds 1–7 land in
    `welldipper-lab-mode-2026-05-05`. For now, use the live app's
    normal flows to reach the canonical scenarios; telemetry
    assertions in Layer A cover structural correctness."* The panel
    is the placeholder; the dependency carve is explicit so working-
    Claude doesn't accidentally try to author the full lab in this
    workstream. Pass condition: panel opens on L-press when
    `?lab=1`, text matches, no console errors.

    **Felt-experience evaluation deferred** to the live screensaver
    loop (per `feedback_skip-recording-when-live-loop.md` —
    autopilot/screensaver behavior is already replaying in front of
    Max in the running tab) plus the full lab-mode keybinds
    delivered by sibling workstream. The migration ships its
    structural substrate now; rich felt-experience evaluation lands
    when the siblings ship.

    **Dependency carve:** AC #17 Layer A PASSes at HEAD `af06a55`
    against existing infrastructure. AC #17 Layer B PASSes at HEAD
    `af06a55` as a stub. Full felt-experience evaluation ships in
    sibling workstream `welldipper-lab-mode-2026-05-05` and is
    explicitly NOT a Phase 5 Shipped blocker.

    **Recording-as-exception clause:** If Layer A telemetry
    assertions surface a defect that working-Claude cannot reproduce
    interactively in the live tab (a transient bug under specific
    frame-pacing conditions, e.g.), recording remains the right tool
    per `feedback_lab-modes-not-recordings.md` "How to apply" #4.
    This is the exception path; default execution does NOT capture
    recordings.

18. **Tester persona update at
    `~/projects/well-dipper/docs/PERSONAS/tester.md` extends the
    "Motion-class verification — kit usage" section** (added in kit
    workstream AC #24) with a §"Production-grade verification (post-
    migration)" subsection. **Status (2026-05-05): subsection landed
    earlier this session; AC #18 reshaped under the new rule to
    require an UPDATE to the existing subsection.**

    **Original required contents (still apply):**

    - Cross-link to this brief and the kit brief, naming Path B as
      the integrated story.
    - Updated bug-class → technique mapping that references real
      well-dipper invocation, not lab-only invocation.

    **Amended 2026-05-05 — additional required contents under the
    new rule** (`~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`):

    - **The bug-class → technique mapping table is reordered** so
      the FIRST row is "felt-experience-class → lab-mode keybind +
      Max interactive evaluation," not deferred to the bottom. The
      table currently exists; the felt-experience row needs to be
      ADDED as the top row, with mapping: *"felt-experience class
      bug → lab-mode keybind (per `welldipper-lab-mode-2026-05-05`)
      that teleports Max to the test scenario; Max plays the
      scenario interactively; recording is the exception path,
      reserved for transient bugs that resist interactive lab
      reproduction."*
    - **The "Default-load rule" subsection is rewritten** to read:
      *"Motion-class verification's first attempt uses (1) telemetry
      predicates from the kit, (2) scene-inventory snapshots at
      phase boundaries, (3) lab-mode keybinds for Max's interactive
      felt-experience evaluation. Recordings are the EXCEPTION path
      — used only when an interactive lab cannot reproduce a
      fleeting transient bug. Per
      `~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`
      (2026-05-05), recordings are no longer the default
      felt-experience-gate artifact."* The current text reads
      "Recordings remain the right tool for felt-experience gates
      only" — that line is too recording-friendly under the new
      rule and gets replaced by the amended text above.
    - **A new paragraph after the bug-class table** cites the
      feedback memo path and summarizes the rule in one sentence:
      *"For motion-class, visual, and phased-feature verification,
      Tester defaults to telemetry + scene-inventory + lab-mode;
      recordings are reserved for the exception path documented in
      `feedback_lab-modes-not-recordings.md`."*
    - **Scene-inventory capability is named as a forward
      dependency** with a one-paragraph note: *"Scene-inventory
      snapshots (which meshes are visible, which DOM overlays are
      present, which post-effect passes are active per phase) are
      not yet implemented in the kit; they land in sibling
      workstream `motion-test-kit-scene-inventory-2026-05-05` as
      kit technique #6. Until that workstream Ships, Tester uses
      telemetry-only structural assertions for phase-boundary
      verification."*

    Verifiable: `grep "Production-grade verification" docs/PERSONAS/tester.md`
    matches (already does); subsection content names this brief +
    the feedback memo path; the bug-class table's top row is
    felt-experience-class with lab-mode-keybind technique;
    "Default-load rule" rewritten per above; scene-inventory
    forward-dependency note present.

### Phase-spanning ACs

19. **Audio clock isolation telemetrically verified. (Amended
    2026-05-05 — threshold rewritten from `±2 ms` to slope-based
    criterion.)** Run a canonical-scenario harness with audio active
    (synthetic tone or real music track — both acceptable) and
    capture the time-deltas between expected and measured audio
    timestamps over a 60-second sim-active run. **Pass condition
    (amended):**

    - `|slope|` of the (expected − measured) drift series ≤ 1
      ms/sec — drift does not systematically grow under sim load.
    - No monotone-growth signature — drift fluctuates around a
      bounded mean, doesn't trend in one direction.
    - End-to-end accumulated drift ≤ 10 ms over 60 seconds — the
      sim isn't slowly back-pressuring the audio clock.

    **Why the threshold changed.** The original `±2 ms` literal
    threshold is structurally unreachable on in-browser
    AudioContext on consumer hardware: the audio device buffer
    scheduling introduces 5–15 ms periodic jitter independent of
    sim load (visible as periodic ~12-second dips in the captured
    data). That jitter is a property of the platform, not a
    migration regression. The slope-based criterion catches the
    actual failure mode the AC was meant to guard (sim back-
    pressuring audio = monotone drift growth) without false-
    failing on platform jitter that's there pre-migration too.

    **Status (2026-05-05): PASS.** Live-app harness ran; evidence
    at `~/projects/well-dipper/qa-results/phase5-audio/ac19-drift-runs.json`.
    Slope ≈ -0.08 ms/sec, no monotone-growth signature. Harness
    file at
    `~/projects/well-dipper/tests/refactor-verification/welldipper-fixed-timestep-phase5-audio.html`.

    **No recording component.** Audio drift is a numerical signal;
    the harness's slope/jitter/end-drift assertions are sufficient
    per the new rule.

20. **No render-tick-rate-dependent visual artifacts at the
    canonical-scenario warp. (Amended 2026-05-05 — replaces 3
    forced-refresh recordings with telemetry assertion via the
    kit's `frameTimeVariance` predicate.)** Render the canonical
    scenario at three forced RAF rates (60 Hz, 144 Hz, 240 Hz —
    throttled via chrome-devtools' performance throttling). At
    each forced rate, capture a sample stream covering the full
    warp ENTRY → HYPER → EXIT phase sequence and run the kit's
    `frameTimeVariance` predicate (already exists per Tester
    persona vocabulary table). Pass condition:

    - `frameTimeVariance` predicate reports PASS at all three
      forced rates (variance bounded per the predicate's default
      threshold; per-rate threshold scaled to the rate — at 60 Hz
      the expected sim-tick-to-render ratio is 1:1, at 144 Hz it's
      ~0.42, at 240 Hz it's ~0.25; the predicate accepts the
      ratio as a parameter or has rate-aware defaults).
    - Phase ordering preserved at all three rates (same sequence
      assertion as AC #17 Layer A).
    - No phase skipped or duplicated at any tested rate (the
      structural failure mode this AC is meant to catch — Phase 2
      interpolation hiding a phase-state bug at a specific
      refresh).

    Each rate's sample stream + predicate verdict committed under
    `qa-results/phase5-ac20/{60hz,144hz,240hz}/`. Harness at
    `tests/refactor-verification/welldipper-fixed-timestep-phase5-frame-pacing.html`
    drives the three forced rates programmatically.

    **Why no recordings.** The original AC asked Max to eyeball
    three recordings for visible shimmer / jitter / mis-pacing —
    that's a felt-experience evaluation. The amended AC isolates
    the *structural* property (frame-pacing variance bounded across
    refresh rates) that the original AC was actually testing for;
    Max's felt-experience eval of Phase 2 interpolation smoothness
    in general flows through the live screensaver loop + the
    sibling lab-mode workstream, NOT through three forced-rate
    recordings of one scenario.

    **No lab-mode dependency.** Forced-rate testing runs from a
    standalone harness; doesn't need the lab-mode keybinds. AC #20
    PASSes at HEAD `af06a55` against existing infrastructure +
    chrome-devtools' performance throttling.

## Principles that apply

From `docs/GAME_BIBLE.md` §11 Development Philosophy. Naming the
load-bearing 2-3 for *this* work specifically.

- **Principle 6 — First Principles Over Patches.** *Load-bearing.*
  This migration is the first-principles substrate fix that lets the
  kit's vocabulary actually reach well-dipper. Treating it as a
  follow-up to the kit (the original additive-only carve at kit
  workstream §"Out of scope" line about "migrating well-dipper's
  `src/main.js` loop") was the economical reflex that the §"Scope
  discipline — feature before economy" rule (`docs/PERSONAS/pm.md`
  §"Scope discipline") names as the wrong default. Path B says: the
  feature is *kit-fully-operational-against-well-dipper*; the
  cheaper-diff scope was wrong-shape for what Max's direction
  ("scope out then deploy B") asked for. Violation here looks like:
  splitting the migration into "Phase 1 ships, Phase 2-5 land
  separately when convenient." The all-or-nothing Shipped flip is
  Principle 6's enforcement; partial-migration substrate is the
  trap world-origin rebasing's brief named explicitly.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** *Load-bearing during execution.* The migration
  formalizes the sim/render split that Principle 5 implies but the
  current variable-dt loop blurs. Sim is "model produces" (path
  planning, body advance, autopilot transitions). Render is
  "renderer consumes" (interpolated draw, shader uniforms). The
  pipeline carries pure-data snapshots between them per kit AC #7's
  `SampleRecord` shape. Violation looks like: a sim-classified
  subsystem accessing `THREE.Camera.matrixWorld` mid-sim (renderer
  state leaking into sim — common with frustum-culling shortcuts);
  a render-classified subsystem mutating sim state (renderer
  writing to model — anti-pattern). The audit list (AC #2) is the
  primary guard; the harness (AC #5, #12, #15) is the enforcement.

- **Principle 2 — No Tack-On Systems.** *Load-bearing.* The current
  loop predates both kit and Director/PM/Tester roles — variable-
  dt was the easy default, not a designed choice. Adding the
  motion-test-kit on top of variable-dt would have been a tack-on
  in the testing layer (technique #2/#3/#4 lab-only because
  production can't run them). Path B is the un-tack-on: bring
  production under the same architectural rule the kit assumes.
  Violation looks like: leaving any sim-classified subsystem on
  variable dt because "it's working fine" (the audit list catches
  this; the harness numerically catches the silent drift); shipping
  a partial migration where some bodies advance on sim time and
  others on render time (visible as bodies-out-of-phase at high
  multiplier values; Phase 2 AC #8 catches this).

## Drift risks

- **Risk:** This workstream begins before kit workstream Shipped.
  The kit's API surface is still in flight; the migration's
  `motion-test-kit/core/loop/accumulator.js` consumer lands against
  a moving import path / signature.
  **Why it happens:** Path B's value is *visible* once both halves
  exist; the temptation to start the second half while the first is
  still in Phase 4 (only one phase from done) is real.
  **Guard:** This brief's §"Status" specifies "does NOT begin until
  the kit brief is `Shipped`." Working-Claude must verify the kit
  brief's status field reads `Shipped <commit-sha>` before opening
  any file in this workstream's scope. The active-workstream
  pointer at `~/.claude/state/dev-collab/active-workstream.json`
  flips from kit-slug to this slug only after kit Shipped. PM
  enforces by holding the migration's `set-active.sh` invocation
  until the kit's `clear-active.sh` has fired.

- **Risk:** Per-call-site classification mistakes propagate
  undetected because the harness only covers the autopilot + body-
  orbit scenarios. A misclassified subsystem (e.g.,
  `cameraController.update` accidentally on render dt instead of
  sim dt) goes silent until manual-flying is exercised.
  **Why it happens:** ~50 call sites, ambiguous-cases-by-construction
  in the audit list, and the harness's per-frame `1e-6` is local to
  what the harness drives. Sites outside the harness's scenarios
  don't get checked numerically.
  **Guard:** AC #2 requires the audit list be committed BEFORE Phase
  3 commits — this is the human-review gate that catches
  misclassifications before they ship. AC #20 (Amended 2026-05-05)
  runs the kit's `frameTimeVariance` predicate at three forced RAF
  rates (60/144/240 Hz) at the canonical scenario; rate-dependent
  misclassifications (e.g., a camera subsystem accidentally on render
  dt that fires-pacing-dependent at 240 Hz but not at 60 Hz) surface
  as variance-bounding violations. Manual-flying-specific surfaces
  reach Max via the live screensaver loop + the sibling lab-mode
  workstream's keybind 4 (mid-CRUISE manual-flying-toggle interrupt).
  Surfaces still uncovered (rare manual-flying patterns Max iterates
  on) are flagged in a parking-lot followup.

- **Risk:** Audio drift introduced by sim-time leaking into the
  audio clock. A BPM-synced animation that previously read
  `audioContext.currentTime` directly gets accidentally rewritten
  to read sim-clock-time, and the visual stops syncing to the
  music.
  **Why it happens:** The Bible §"BPM-Synced Animation" principle
  (Principle 4) says animations are clocked off the music; the
  migration's per-call-site refactor surface is large; an
  enthusiastic "let me put EVERYTHING on sim clock" pass would
  break this.
  **Guard:** AC #3 explicitly carves audio↔sim coupling sites and
  rules them out of the sim-tick migration. AC #19 telemetrically
  verifies audio BPM stays accurate post-migration. The audit list
  (AC #2) §"Audio clock domain" subsection is the human-readable
  guard that surfaces every coupling site for explicit ruling
  before code changes.

- **Risk:** World-origin rebase event lands inside a render path
  instead of the sim tick start. Visible result: rendered camera
  position jumps mid-render-frame at every rebase boundary;
  cached-world-position drift bugs (rebasing brief Drift risk #2)
  re-emerge despite that workstream's audit having fixed them
  pre-migration.
  **Why it happens:** The migration's loop restructure changes
  where the rebase-check call sits. A sloppy refactor copies it
  from the old `animate()` body to the new `render()` callback by
  mistake.
  **Guard:** AC #4 documents the rule and requires the comment-
  block cross-reference; AC #5 (Phase 1 harness) advances the
  autopilot leg across `REBASE_THRESHOLD_SQ` and asserts numerical
  equivalence at the rebase frame, which fails loudly if the rebase
  fires at the wrong tick.

- **Risk:** Phase 2 interpolation introduces visible "rubber-band"
  motion when sim ticks land near the render frame boundary.
  Specifically: at sim tick boundary, the *current* sim state
  becomes the *previous* sim state, and the render path's
  `prevState.lerp(currState, alpha=0)` snaps back to the prior
  position for one frame.
  **Why it happens:** Implementing the Fiedler pattern correctly
  requires storing TWO sim states (the one before the most recent
  sim tick AND the one after); reading the wrong one produces a
  rewind. This is a common Phase 2 implementation bug.
  **Guard:** AC #6 specifies the two-snapshot API explicitly; AC
  #7's pass condition is felt-experience smoothness at 144 Hz
  (Max evaluates via the live screensaver loop or the sibling
  workstream's full lab-mode keybinds — recording exception path
  if a transient bug resists interactive reproduction). AC #20's
  three-refresh-rate `frameTimeVariance` predicate run is the
  structural catch (rubber-banding manifests as bounded-but-
  abnormal frame-time variance at one refresh and not another).
  **Amended 2026-05-05 — AC #20 reshaped from recordings to
  telemetry predicate per the new rule; structural catch logic
  unchanged.**

- **Risk:** Pre/post `1e-6` epsilon comparison fails at fields that
  are *legitimately* different post-migration. Example: sim runs
  at fixed 60 Hz so RAF dt of 7 ms (144 Hz) accumulates to 0
  sim-ticks one frame and 1 sim-tick the next; in pre-migration,
  the same render frames each got 7 ms of sim advance. The post-
  migration sim trajectory is a different sequence of integer-tick
  states than pre-migration's variable-dt-fractional-tick states.
  At the same wall-clock time, sim states won't match exactly.
  **Why it happens:** The migration is a sim-rate change in
  addition to a structural change. The `1e-6` comparison from the
  rebasing workstream presumed "same sim path, different code
  organization" — which doesn't hold here.
  **Guard:** AC #5's note explicitly carves this. The harness
  compares pre-migration variable-dt to post-migration fixed-step;
  divergence is expected to be small but nonzero. The harness reports
  per-frame max-divergence for working-Claude to triage: if
  divergence is bounded and decays toward zero over the leg
  (transient sim-rate-mismatch artifact, expected) → PASS; if
  divergence is monotone or grows → defect, surface for fix. The
  Tester reads the harness output and renders verdict accordingly.
  This is a fuzzier gate than the rebasing workstream's, by
  necessity. Working-Claude's job is to make the divergence
  *bounded and not behavior-changing*; the Tester's job is to
  validate that property.

- **Risk:** Telemetry assertions captured at one test-start
  position only. Same trap as the rebasing workstream — Sol-only
  testing passes because Sol-only test setup is fastest.
  **Why it happens:** Same reasons rebasing named (extra friction
  to set up the far-position warp).
  **Guard:** AC #17 Layer A explicitly requires three telemetry
  harnesses covering warp-Sol, warp-far (≥10,000 scene units from
  origin, exercising rebase during HYPER), and autopilot-tour. The
  Tester verdict cannot pass on Sol-only evidence per the
  rebasing-workstream precedent. **Amended 2026-05-05 — formerly
  named four canvas recordings; now named three telemetry
  harnesses + one lab-mode stub. The two-position requirement
  retained as a structural property; visual recording is the
  exception path per the new rule.**

- **Risk:** Toggle-fix dogfood (AC #16) is run but its result
  isn't captured anywhere readable post-Shipped. The workstream
  Ships with a green PASS but the dogfood evidence lives only in
  working-Claude's session memory.
  **Why it happens:** Dogfood-as-side-effect framing; the AC
  language says "verifiable: dogfood output appended" but it's
  easy to skip the append step and just claim PASS.
  **Guard:** AC #16 requires the dogfood output append to the
  toggle-fix DIAGNOSIS.md addendum (or sibling). The Tester
  verifies the file exists and contains predicate verdicts before
  PASSing this AC. No append → no AC-passed → no Shipped.

## In scope

- All five phases above as a single shipped unit. No partial
  migration.
- Every `update(dt)`-consuming call site in the touch list audited
  + classified + migrated to its right path (sim or render).
- World-origin rebase event timing rule documented + enforced at
  sim-tick start.
- Render-time interpolation of camera position+quaternion + body
  positions per Glenn Fiedler's Phase-2 pattern.
- Telemetry sampler relocated to sim-tick (kit predicates / hash /
  replay receive consistent state, not interpolated state).
- Seeded RNG threaded through sim path; render-side `Math.random()`
  stays as-is.
- Input replay (kit technique #3) operational against well-dipper
  via `?recordInput=1` / `?replayInput=path` URL params.
- Transform-hash golden trajectory committed at
  `tests/golden-trajectories/canonical-scenario.golden.json` for
  the canonical "warp to Sol, autopilot to Earth, manual disengage"
  scenario.
- Toggle-fix dogfood re-verification at sim-tick fidelity per AC
  #16.
- Telemetry-asserted phase preservation at multiple test-start
  positions per AC #17 Layer A (warp-Sol, warp-far, autopilot-tour
  harnesses).
- Lab-mode stub keybind per AC #17 Layer B (full lab-mode lands in
  sibling workstream `welldipper-lab-mode-2026-05-05`).
- Audio clock drift bounded per AC #19 (slope-based criterion).
- Frame-pacing variance bounded across forced refresh rates per
  AC #20 (kit `frameTimeVariance` predicate at 60/144/240 Hz).
- Tester persona update extending the "Motion-class verification —
  kit usage" subsection added in the kit workstream, reshaped per
  AC #18 to put lab + telemetry FIRST.
- Audit list document at `docs/refactor-audits/fixed-timestep-
  migration-call-sites.md`.

## Out of scope

- **The motion-test-kit's library code itself.** The kit is its
  own workstream and its own commit history. This workstream
  consumes the kit as a pinned-commit submodule and does not
  modify `core/` or `adapters/` of the kit. If a defect surfaces
  in the kit during this workstream's execution, working-Claude
  flags it for a kit-side fix workstream and (if blocking) pauses
  this workstream's progress.
- **Godot adapter for the loop binding.** Architecture supports
  it (`core/` is engine-agnostic per kit AC #2). Future workstream
  when Max moves engines.
- **CI build server / automated golden-trajectory verification.**
  AC #15 specifies an ad-hoc `npm run verify-golden` script. No
  build infrastructure beyond that.
- **Multiplayer / cross-machine deterministic replay.** Single-
  machine determinism only, per Dana's research §"Adoption
  recommendations" step #3 caveat and the kit's AC #16 caveat.
- **Re-baselining the world-origin rebasing workstream's
  recordings.** Those exist as Shipped evidence at HEAD `e3504a1`.
  This workstream's recordings are at a later HEAD; they don't
  invalidate the earlier evidence.
- **Interpolation of every sim-state field.** Phase 2 explicitly
  scopes interpolation to camera position+quaternion + body
  positions. Subsystems that are visually-quantized by design
  (e.g., the system map's blink animation) stay on sim-tick
  rendering — render reads "current sim state, no interpolation."
  The audit list (AC #2) flags any other render-path readers that
  should interpolate; they're added explicitly with a per-site
  decision recorded.
- **Frame-pacing tooling integration (PresentMon, CapFrameX).**
  Out of scope per Dana's research §"What I'm explicitly *not*
  recommending" — render smoothness is observed via Max's eyes +
  the telemetry sampler's frame-time variance predicate (kit
  predicate `frameTimeVariance` exists for this; this workstream
  doesn't bind to PresentMon or any external profiler).
- **Refactoring `src/auto/AutopilotNavSequence.js`'s structure
  beyond the `performance.now()` migration.** AC #11 narrowly
  scopes the change to clock-source replacement. Larger refactors
  are separate workstreams.
- **The toggle-fix workstream's Shipped flip.** The dogfood (AC
  #16) produces evidence; the toggle-fix workstream's Shipped
  flip happens in *that* workstream's context with Max's
  recording verdict, not here. If the dogfood surfaces a real
  bug, that's data for the toggle-fix Shipped decision, not a
  blocker on this workstream.
- **Other three.js projects beyond well-dipper.** The kit's cross-
  project smoke test (kit AC #25) proves portability; whichever
  project Max moves to next does its own integration on demand.
- **Re-running every motion-class workstream's ACs against the
  migrated loop.** That's a per-workstream concern (each
  workstream's harness re-runs as part of normal motion-class
  verification post-migration). This workstream's job is to ship
  the substrate; the downstream re-runs are downstream.

## Handoff to working-Claude

**Read first, in this order:**

1. The kit workstream brief
   `docs/WORKSTREAMS/motion-test-kit-2026-05-02.md` (full read,
   especially Phase 1 and Phase 5 ACs).
2. `docs/REFACTOR_VERIFICATION_PROTOCOL.md` (full read).
3. `docs/WORKSTREAMS/world-origin-rebasing-2026-05-01.md` (full
   read — this is the load-bearing precedent; the migration
   reuses its harness pattern, recording-evidence pattern, and
   audit-list-as-commit-artifact pattern).
4. `research/motion-testing-methodology-2026-05-02.md` §"Refactor
   the simulation update path to a fixed-timestep accumulator"
   (re-read; it's the why).
5. Glenn Fiedler, *Fix Your Timestep!* — full read, especially
   "Free the Physics" (Phase 2 interpolation pattern).
6. `src/main.js` lines 5803–6890 (the animate loop) and every
   file the audit list (AC #2) names. The audit list IS the work
   breakdown — assemble it first, then act on it.

**Build order is dependency-strict:**

- Phase 1 (Accumulator wired, no interpolation) — ACs #1–#5.
- Phase 2 (Interpolation) — ACs #6–#9. Depends on Phase 1.
- Phase 3 (Per-call-site migration) — ACs #10–#12. Depends on
  Phases 1+2.
- Phase 4 (Kit techniques #3+#4 against well-dipper) — ACs #13–#15.
  Depends on Phase 3.
- Phase 5 (Dogfood + telemetry/lab-mode + persona update) — ACs
  #16–#20. Depends on Phases 1–4. **Phase 5 ACs reshaped 2026-05-05
  per the new lab-modes-not-recordings rule; see §"Brief amendment
  history" at the bottom of this brief.**

**Each phase commits separately;** AC #2 (audit list) gates Phase
3's commits — the audit list is committed as a doc artifact BEFORE
any per-call-site code change lands.

**Critical rules:**

1. **Do NOT begin until the kit workstream is Shipped.** Verify by
   reading the kit workstream brief's status field and confirming
   `Shipped <commit-sha>`. The kit's API surface is the contract this
   workstream consumes; consuming a moving target produces silent
   integration drift.

2. **The world-origin rebase event MUST land at sim-tick start.**
   Per AC #4, with comment-block cross-reference to the rebasing
   workstream's drift-risk text verbatim. This is a one-line code
   discipline that prevents an entire class of silent visual bugs.
   Mis-placing it ALSO breaks the rebasing workstream's Shipped
   evidence retroactively.

3. **Audio clock stays on its own real-time clock.** Per AC #3 and
   AC #19. Do NOT migrate audio sites to sim time. The Bible
   Principle 4 (BPM-Synced Animation) requires audio↔visual sync
   on the audio clock; sim time would drift against the music.

4. **The audit list (AC #2) is the centerpiece of this work, not a
   side artifact.** Treat it as the work breakdown structure.
   Commit it before Phase 3 code changes. The Tester reads it
   during verification to validate per-call-site decisions; PM
   reads it at workstream Shipped to validate completeness. A
   thin / hand-wavy audit list is a workstream defect.

5. **Pre/post `1e-6` epsilon does NOT mean bit-equivalent.** Per
   AC #5's note. The migration is a sim-rate change AND a
   structural change; numerical paths legitimately differ. The
   harness's job is to surface per-frame max-divergence so
   working-Claude can triage which differences are
   sim-rate-mismatch artifacts (expected, bounded, decay) vs. real
   defects (monotone or growing). The Tester's verdict on the
   harness is a *qualitative* PASS-or-FAIL on the divergence
   *shape*, not a quantitative threshold. This is the fuzziest gate
   in the workstream; treat it as such.

6. **Do NOT scope-creep into bonus features.** Tempting bonuses to
   resist:
   - "Add render-tick frame-pacing telemetry" — out of scope per
     §"Out of scope".
   - "Refactor the AutopilotNavSequence state machine while we're
     in there" — out of scope per AC #11's narrow carve.
   - "Make the render path GPU-accelerated for body interpolation"
     — out of scope; render-side performance concerns are a
     separate workstream.
   - "Move audio onto sim clock for replay determinism" — explicit
     drift risk above; do NOT do this.
   - "Author the full lab-mode keybinds 1-7 while wiring Layer B
     of AC #17" — out of scope; full lab-mode lands in sibling
     workstream `welldipper-lab-mode-2026-05-05`. Layer B ships
     ONLY the placeholder panel.
   - "Author the kit's scene-inventory technique while updating
     the Tester persona" — out of scope; scene-inventory lands in
     sibling workstream `motion-test-kit-scene-inventory-2026-05-05`.
     The Tester persona REFERENCES scene-inventory as a forward
     dependency under AC #18; it does not implement it.

7. **Default-path verification is telemetry + lab-mode, not
   recordings.** Per `~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`
   (2026-05-05), motion-class / visual / phased verification
   defaults to (a) telemetry predicate runs, (b) scene-inventory
   snapshots at phase boundaries (when the kit ships that
   technique — sibling workstream), (c) lab-mode keybinds for
   Max's interactive felt-experience eval (when the lab-mode
   workstream ships them; stub-only at HEAD `af06a55`). Recordings
   are reserved for transient bugs that resist interactive lab
   reproduction. Phase 5's amended ACs implement this rule; do
   NOT regress to recording-as-default during execution. If a
   transient bug surfaces, capture per
   `docs/MAX_RECORDING_PROTOCOL.md`, but flag the capture
   explicitly as the exception path.

**Tester invocation (after each phase, and before Shipped):**

```
Agent(subagent_type="tester", model="opus", prompt="""Verify against
docs/WORKSTREAMS/welldipper-fixed-timestep-migration-2026-05-03.md
ACs #<phase-acs>. Diff: <commit-sha or range>. Phase 1 telemetry
harness: tests/refactor-verification/welldipper-fixed-timestep-
phase1.html. Phase 3 harness extends Phase 1. Phase 4 golden-
trajectory verification: `cd ~/projects/well-dipper && npm run
verify-golden`. Phase 5 ACs amended 2026-05-05 — telemetry +
lab-mode-stub default; recordings are exception path only:
- AC #16 dogfood addendum at
  screenshots/diagnostics/manual-autopilot-toggle-2026-05-02/DIAGNOSIS-phase5-dogfood-addendum.md
  — verify predicate verdicts recorded (already on disk).
- AC #17 Layer A: three telemetry harnesses
  (welldipper-fixed-timestep-phase5-warp-sol.html / -warp-far.html /
  -autopilot-tour.html) — verify phase ordering assertions PASS at
  each.
- AC #17 Layer B: lab-mode stub — verify ?lab=1 + L-press opens
  placeholder panel pointing at sibling workstream.
- AC #18: docs/PERSONAS/tester.md "Production-grade verification
  (post-migration)" subsection REVISED per the new rule —
  felt-experience class as TOP row of bug-class table, "Default-
  load rule" rewrites lab+telemetry+scene-inventory FIRST, cites
  feedback_lab-modes-not-recordings.md.
- AC #19: welldipper-fixed-timestep-phase5-audio.html slope-based
  criterion (slope ≤ 1 ms/sec, no monotone, end drift ≤ 10 ms)
  PASS — already on disk.
- AC #20: welldipper-fixed-timestep-phase5-frame-pacing.html
  green at 60/144/240 Hz forced rates; frameTimeVariance predicate
  PASS at each.

Per-frame `1e-6` epsilon expectation (Phases 1–4) is *qualitative
pass on divergence shape* per brief AC #5 note — bounded + decaying
= PASS, monotone or growing = FAIL with per-frame max-divergence
diagnostics. Render verdict per Tester audit shape.""")
```

**For Phase 5 specifically,** the Tester reads
`docs/PERSONAS/tester.md` post-update and verifies the new
"Production-grade verification (post-migration)" subsection against
AC #18's required-contents list. Same self-referential pattern as
the kit workstream's persona-update Tester gate — fine because the
Tester reads the latest version of the file fresh, and the AC is
contract-shaped (presence + content match), not behavioral.

**What "done" looks like:**

- All 20 ACs verified.
- Animate loop in `src/main.js` runs through the kit's
  `bindToRAF` accumulator; every `update(dt)` call site consumed
  per the audit list's classification.
- Telemetry sampler fires at sim tick (60 Hz), not render tick.
- Audit list at `docs/refactor-audits/fixed-timestep-migration-
  call-sites.md` complete.
- Phase 1 + Phase 3 telemetry harnesses at
  `tests/refactor-verification/welldipper-fixed-timestep-phase1.html`
  pass with bounded-decaying divergence.
- Canonical-scenario golden trajectory at
  `tests/golden-trajectories/canonical-scenario.golden.json`;
  `npm run verify-golden` passes.
- Toggle-fix dogfood result appended to its DIAGNOSIS.md addendum
  with kit predicate verdicts.
- Telemetry harnesses for AC #17 Layer A on disk at
  `tests/refactor-verification/welldipper-fixed-timestep-phase5-{warp-sol,warp-far,autopilot-tour}.html`
  with sample dumps under `qa-results/phase5-ac17/` — three green
  harness runs covering warp-Sol, warp-far (rebase during HYPER),
  autopilot tour ENTRY → CRUISE → APPROACH → STATION.
- Lab-mode stub keybind (`?lab=1` + L-press → placeholder panel)
  wired into the live app per AC #17 Layer B; full lab-mode
  deferred to sibling workstream `welldipper-lab-mode-2026-05-05`.
- Audio drift harness at
  `tests/refactor-verification/welldipper-fixed-timestep-phase5-audio.html`
  green; evidence at `qa-results/phase5-audio/ac19-drift-runs.json`
  (slope ≤ 1 ms/sec, no monotone-growth, end drift ≤ 10 ms).
- Frame-pacing harness at
  `tests/refactor-verification/welldipper-fixed-timestep-phase5-frame-pacing.html`
  green at three forced rates; per-rate sample dumps under
  `qa-results/phase5-ac20/{60hz,144hz,240hz}/` with
  `frameTimeVariance` predicate PASS at each rate.
- Tester persona's "Production-grade verification (post-migration)"
  subsection at `docs/PERSONAS/tester.md` REVISED per AC #18 to
  put lab + telemetry + scene-inventory FIRST, recordings as
  exception path; cites
  `feedback_lab-modes-not-recordings.md` and the two sibling
  workstreams.
- Tester PASS at the to-be-shipped commit (verifies the amended
  Phase 5 ACs against telemetry + harness evidence; no recording
  dependency for default-path acceptance).
- Brief flipped to `Shipped <commit-sha>` (no recording suffix
  required under the new rule; Shipped flips on Tester PASS at
  current HEAD).
- Push to origin per `feedback_deploy-established-sites.md`;
  deploy verified per `feedback_push-on-shipped.md`.
- Active-workstream cleared via
  `~/.claude/state/dev-collab/clear-active.sh well-dipper`.

**What artifacts to produce:**

- `src/main.js` migration commits (per-phase, granular).
- Per-subsystem `update(dt)` call site changes (per Phase 3 commits).
- `docs/refactor-audits/fixed-timestep-migration-call-sites.md`.
- `tests/refactor-verification/welldipper-fixed-timestep-phase1.html`.
- `tests/golden-trajectories/canonical-scenario.js` +
  `canonical-scenario.golden.json`.
- `package.json` `npm run verify-golden` script.
- `docs/PERSONAS/tester.md` subsection REVISION per AC #18.
- AC #17 Layer A telemetry harnesses (3 files) +
  `qa-results/phase5-ac17/` sample dumps.
- AC #17 Layer B lab-mode stub keybind wired into the live app
  (`?lab=1` + L-press → placeholder panel).
- AC #19 audio drift harness +
  `qa-results/phase5-audio/ac19-drift-runs.json` (already on disk
  from this session).
- AC #20 frame-pacing harness +
  `qa-results/phase5-ac20/{60hz,144hz,240hz}/` per-rate sample
  dumps with predicate verdicts.
- Toggle-fix DIAGNOSIS.md addendum with predicate verdicts
  (already on disk: see AC #16 Status).
- **No canvas recordings as default deliverable.** Recording
  remains the exception path per the new rule —
  `~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`
  "How to apply" #4. If a transient bug surfaces during AC
  execution that resists interactive reproduction, capture a
  recording per the original protocol; otherwise, skip.

---

## Sibling workstreams (next)

Two sibling workstreams are queued for PM authoring after Phase 5
of this brief Ships. They are NOT prerequisites for Phase 5 Shipped
under the amended ACs (AC #17 Layer B is a stub; full lab-mode and
scene-inventory are explicit forward dependencies). Working-Claude
should know these are coming so AC #17 / AC #18 references resolve
when the siblings ship.

### `motion-test-kit-scene-inventory-2026-05-05` (kit-side)

**Location:** `~/projects/motion-test-kit/docs/WORKSTREAMS/motion-test-kit-scene-inventory-2026-05-05.md`
(authored separately).

**Scope (one-paragraph preview):** Adds scene-graph + DOM-overlay +
post-effect-pass inventory snapshot capability to the motion-test-kit
as **technique #6** (alongside the existing #1 Δ-predicates / #2
golden-trajectory / #3 input-replay / #4 transform-hash / #5 flight
recorder). The technique captures a structural snapshot at any
moment: which `THREE.Mesh` nodes have `visible=true`, which DOM
overlay layers (HUD, reticle, dialogs) are present in the DOM with
non-zero opacity, which `EffectComposer` passes are enabled. Snapshots
ship as pure-data and feed into Tester's per-phase-boundary
verification — "at HYPER entry, was tunnelMesh visible? was reticle
hidden? was warp post-effect pass enabled?" — replacing the lossy
"infer from a recording" pattern named in
`feedback_lab-modes-not-recordings.md` §"Why."

**Why it depends on this brief landing first:** Scene-inventory
relies on consistent per-sim-tick state for snapshot-time-anchoring;
running it against a variable-dt loop produces snapshots whose timing
is determined by render scheduling, not sim semantics. Post-Phase-3
of this brief, snapshots taken at sim-tick boundaries have stable
meaning.

### `welldipper-lab-mode-2026-05-05` (well-dipper-side)

**Location:** `~/projects/well-dipper/docs/WORKSTREAMS/welldipper-lab-mode-2026-05-05.md`
(authored separately).

**Scope (one-paragraph preview):** Implements lab-mode keybinds 1–7
(gated behind `?lab=1` URL param) that teleport Max to canonical
test scenarios for interactive felt-experience evaluation. Concrete
keybind set: 1 = warp from Sol, 2 = mid-HYPER tunnel, 3 = autopilot
ENTRY into Earth, 4 = manual-flying-toggle interrupt mid-CRUISE, 5 =
station-hold, 6 = body-orbit at 1000× time multiplier, 7 = far-
position warp (≥10,000 scene units). Each keybind sets up the scene
deterministically (seeded RNG, explicit positions, audio-active
optional) and hands off to Max's interactive evaluation. Implements
the "test modes/areas where needed" half of Max's 2026-05-05
direction. The Layer B stub from this brief's AC #17 is the
placeholder; the full lab is the sibling's deliverable.

**Why it depends on this brief landing first:** Lab-mode scenarios
require deterministic sim setup — seeded RNG, fixed-step sim, input-
replay-grade reproducibility. Pre-migration, lab keybinds would
produce subtly different scenes per run (variable-dt schedule
variance). Post-migration, pressing "1" twice produces byte-
equivalent scenes; Max's felt-experience evaluation lands against a
stable reference.

---

## Open question — flag for Max if AC #5 divergence is structurally
## above what "bounded and decaying" can rule

The pre/post epsilon comparison is the fuzziest gate in this
workstream. If the migration produces a sim trajectory where pre-
migration variable-dt and post-migration fixed-step diverge in a
shape that's neither clearly-decaying-artifact nor clearly-defect
(e.g., divergence stays bounded but doesn't decay over a 60-second
leg, sitting at ~1e-4 — small but persistent), surface to Max:
*"Migration produces bounded-but-non-decaying divergence at
~1e-4 in field X. Possible interpretations: (a) sim-rate
mismatch artifact at the chosen tick frequency — increase tick
frequency to test, (b) a genuine integration drift — investigate.
Which way to go?"* Max's tiebreak. Do not flip workstream to
Shipped without that decision being made.

---

*Brief authored by PM 2026-05-03 against well-dipper HEAD `679321b`
(post toggle-fix landing) and `e3504a1` (post world-origin rebasing
Shipped). Sibling to `motion-test-kit-2026-05-02.md`. Together they
form Path B per Max's 2026-05-02 direction. No parent feature doc —
refactor / substrate workstream per `docs/PERSONAS/pm.md`
§"Carve-out: refactor / code-lift workstreams".*

---

## Brief amendment history

### 2026-05-05 — Phase 5 ACs reshaped under the lab-modes-not-recordings rule

**Trigger:** Max's mid-Phase-5 direction:

> *"let's move away from recordings...once you verify that something
> works in terms of the telemetry/asset data, I want you to give me
> test modes/areas where needed rather than recordings"*

**New rule encoded at:**
`~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`.
For motion-class, visual, and phased-feature verification, the
default verification stack is now: (1) telemetry predicates,
(2) scene-inventory snapshots at phase boundaries, (3) lab-mode
keybinds for Max's interactive felt-experience evaluation.
Recordings are reserved for the exception path (transient bugs that
resist interactive reproduction).

**Changes in this brief:**

- §"Acceptance criteria" preamble — added paragraph layering the new
  rule on top of the existing protocol; cited the feedback memo
  path.
- AC #16 — annotated COMPLETE with the dogfood addendum path and the
  surfaced kit-limitation finding (predicates don't natively
  understand world-origin rebasing).
- AC #17 — full reshape from "4 canvas recordings" to two-layer
  structure: Layer A telemetry harnesses (warp-Sol / warp-far /
  autopilot-tour) achievable now, Layer B lab-mode stub keybind as
  the minimum at HEAD `af06a55` with full lab-mode deferred to
  sibling workstream `welldipper-lab-mode-2026-05-05`.
- AC #18 — annotated as "subsection landed earlier this session,
  needs UPDATE under new rule." Required-contents list extended:
  bug-class table TOP row is now felt-experience-class with lab-mode-
  keybind technique; "Default-load rule" rewrites to put telemetry +
  scene-inventory + lab-mode FIRST; recording line that read
  *"Recordings remain the right tool for felt-experience gates only"*
  gets replaced; scene-inventory named as forward dependency on
  sibling `motion-test-kit-scene-inventory-2026-05-05`.
- AC #19 — threshold rewritten from `±2 ms` literal to slope-based
  criterion (slope ≤ 1 ms/sec, no monotone-growth, end-to-end ≤ 10
  ms over 60 s). Annotated PASS with evidence path.
- AC #20 — full reshape from "3 forced-refresh recordings" to
  telemetry assertion via the kit's `frameTimeVariance` predicate
  at three forced RAF rates (60/144/240 Hz). No lab-mode dependency;
  PASSes at HEAD `af06a55` against existing infrastructure +
  chrome-devtools throttling.
- §"In scope" — recordings bullet replaced with telemetry + lab-
  mode-stub bullets.
- §"Out of scope" — unchanged.
- §"Drift risks" — Sol-only-recording risk re-named to Sol-only-
  telemetry risk; rubber-band risk's structural catch updated from
  AC #20 recordings to AC #20 `frameTimeVariance` predicate.
- §"Critical rules" — added rule #7 (default-path verification is
  telemetry + lab-mode, not recordings); rule #6 expanded to forbid
  scope-creeping into the sibling workstreams' deliverables.
- §"Tester invocation" snippet — extended with Phase 5 amended-AC
  paths so the Tester reads against the right harnesses.
- §"What 'done' looks like" — four-canvas-recording bullet removed;
  five telemetry/lab-mode-stub bullets added in its place; Shipped
  flip suffix updated to drop `verified against <recording-paths>`
  (no recording dependency under the new rule).
- §"What artifacts to produce" — recording artifact replaced with
  telemetry harness + lab-mode-stub artifacts; explicit "no canvas
  recordings as default deliverable" clause added.
- §"Sibling workstreams (next)" — new section naming
  `motion-test-kit-scene-inventory-2026-05-05` and
  `welldipper-lab-mode-2026-05-05` with one-paragraph scoping
  notes each.

**Pass condition for the amendment** (per PM brief from this
session): each amended AC carries telemetry + lab-mode-or-stub
evidence shape, no canvas recordings as default verification
artifact; the original verification intent is preserved (catching
Phase 3 misclassification, frame-pacing-dependent artifacts, audio-
clock isolation, dogfood completion); each amended AC is achievable
at HEAD `af06a55` plus whatever sibling infra is explicitly carved
as a forward dependency. AC #17 Layer B and AC #18 scene-inventory
references are the two carved dependencies; both name the sibling
workstream slug explicitly.

**Recordings are NOT abolished.** They remain the exception path for
transient bugs that resist interactive lab reproduction. The
amendment changes the default; it doesn't remove the tool.
