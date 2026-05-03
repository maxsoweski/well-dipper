# Workstream: Motion Test Kit — cross-project library + well-dipper integration (2026-05-02)

## Status

**Shipped — well-dipper `28feba2` + kit @ motion-test-kit:b2b0473.**

All 5 phases verified by Tester. §T1 PASSed Phases 1+2 at `c6486b0`;
§T-final PASSed Phases 3-5 + well-dipper integration at `d79d01c`.

74/74 kit self-tests pass under `npm test`. Dogfood (AC #23) ran live
at `d79d01c` + target-wiring patch and produced two findings:
1. **Kit's value proposition validated.** `approachPhaseInvariant`
   flagged 145 frame-level violations of "distance to target
   non-increasing during APPROACH" — the bug class Max saw visually
   (planet jittering, camera-inside-body color-fill).
2. **Surfaced bug:** the rebasing × realistic-celestial-motion
   interaction. Body orbital writes overwrite world-origin rebase
   shifts each frame. Diagnosed at
   `screenshots/diagnostics/rebase-celestial-interaction-2026-05-03/ANALYSIS.md`.
   Carved as new workstream — out of scope here.

Originally scoped 2026-05-02 against well-dipper HEAD `679321b`. AC #22
target-wiring landed in this fixup commit (sourcing `target` from
`autopilotMotion._target` when `navSubsystem.bodyRef` is null).

## Parent feature

**N/A — this is a tooling / verification-infrastructure workstream, not a
game-feature workstream.** Per the §"Carve-out: process / tooling
workstreams" rule in `docs/PERSONAS/pm.md`, ACs in this brief are
contract-shaped (deliverable interface + verifiable observation), not
phase-sourced. The motion-test-kit has no authored phases of its own;
its job is to *enable* phase-sourced AC verification on game-feature
workstreams.

The kit's *consumers* are feature workstreams. The pattern this kit
exists to repair is documented in:

- `docs/FEATURES/autopilot.md` §"Failure criteria / broken states"
  (lines 289–308) — *"Manual override snap-stops the ship — inertial
  continuity violated"* and *"Autopilot-on-then-off-then-on
  auto-resumes"*. The toggle-fix workstream's diagnosis showed these
  failure modes can be present even when telemetry-based ACs PASS, if
  the predicates aren't shaped to detect motion-continuity violations.
- `docs/REFACTOR_VERIFICATION_PROTOCOL.md` — the telemetry-equivalence
  pattern this kit operationalizes for refactor workstreams.
- `docs/MAX_RECORDING_PROTOCOL.md` — the recording-as-evidence path
  this kit replaces *for invariant-class bugs only*. Felt-experience
  evidence stays on recordings (carve-out documented in Tester persona
  update — Phase 5).

## Implementation plan

N/A (no separate PLAN doc; this brief carries the architecture inline
because the kit's API surface IS its acceptance criteria).

## Source material

**Read in order:**

1. `research/motion-testing-methodology-2026-05-02.md` — Dana's
   research deliverable. The 5 techniques, the 9-row vocabulary table
   (Δ-magnitude bound / sign-stability / approach-phase invariant /
   monotonicity score / zero-input null-action / velocity bound /
   state-transition well-formedness / transform-hash equivalence /
   frame-time variance), the recording-vs-invariant carve-out, the
   adoption-order rationale.
2. `screenshots/diagnostics/manual-autopilot-toggle-2026-05-02/DIAGNOSIS.md`
   — the bug class this kit must catch. Per-frame state-machine
   telemetry sampled at coarse timepoints PASSED while the recording
   showed teleport-cycle behavior. The kit closes the structural gap.
3. `docs/WORKSTREAMS/manual-nav-autopilot-toggle-fix-2026-05-02.md`
   — the in-flight workstream at `VERIFIED_PENDING_MAX 679321b` whose
   verification is the kit's first dogfood once the kit lands.
4. `docs/PERSONAS/tester.md` — current Tester persona. Phase 5 of this
   workstream updates this file (canonical at
   `~/projects/well-dipper/docs/PERSONAS/tester.md`, symlinked to
   `~/.claude/agents/tester.md`).
5. Glenn Fiedler, *Fix Your Timestep!*
   ([gafferongames.com](https://gafferongames.com/post/fix_your_timestep/))
   — accumulator pattern reference for Phase 1.
6. Erin Catto, *Determinism*, box2d.org Aug 2024
   ([link](https://box2d.org/posts/2024/08/determinism/)) —
   transform-hash pattern reference for Phase 4.

## Scope statement

Build a standalone, cross-project, engine-agnostic motion-test-kit
library at `~/projects/motion-test-kit/`, consumed by well-dipper as a
git submodule. The kit implements all 5 techniques from Dana's research
(per-frame Δ-predicates, fixed-timestep accumulator, seeded RNG + input
replay, transform-hash golden trajectory, flight-recorder ring buffer)
in dependency order, with a hexagonal architecture that keeps `core/`
free of any engine binding so a future Godot adapter is a port and not
a rewrite. Every technique ships with a per-technique RUNBOOK
documenting *when to invoke*, *how to invoke from a brief AC*, *what
the Tester does with it*, and *common pitfalls*. The Tester persona is
updated at the end of the workstream to default-load the kit on
motion-class verifications. No technique is consumed in well-dipper
production until all 5 land in the kit and the persona update is in
place — the workstream is one shipped unit, not five staged ones.

The validating integration is well-dipper-only and is *additive* to
the existing variable-dt loop: techniques #1, #3 (RNG only), #4 (hash
emission only), and #5 integrate against the loop as it stands;
technique #2 ships demonstrated end-to-end in a kit-owned `*-lab.html`
harness but does **not** rewrite well-dipper's `src/main.js` loop in
this workstream. That migration is a separate substantial workstream
that will follow.

## How it fits the bigger picture

This workstream is upstream infrastructure for every future
motion-class verification in well-dipper. The autopilot V1 work
(autopilot.md §"Per-phase criteria — ship axis", §"Per-phase
criterion — camera axis (V1)") accumulated 12+ shipped workstreams in
April 2026 whose ACs all reduce to motion-continuity invariants — and
where the toggle-fix incident proves coarse telemetry can PASS while
the felt experience is broken. The kit gives the Tester a vocabulary
(Dana's 9-row table, made callable) that names invariants precisely
enough to catch the class of bugs the current process is structurally
blind to.

It also lands the determinism floor (technique #2 + #3) that the
Refactor Verification Protocol depends on. WS 1 (navigation subsystem
split, Shipped `3d53825`) authored that protocol with telemetry-equivalence
under frozen inputs; today the "frozen inputs" part is approximated
(seeded RNG + explicit positions + fixed-step `update(dt)` loop in a
test harness). The kit makes that exact, byte-for-byte, replayable.

The Godot-portability commitment is downstream of well-dipper's
expected engine migration. Max has named the Godot move as a future
direction; building this kit with `core/` engine-agnostic from day one
costs little extra now and saves a full rewrite later. This is
Principle 6 ("First Principles Over Patches") applied to the testing
infrastructure itself — build the foundation right or pay the
patch-cost on every future motion-class workstream.

## Acceptance criteria

Contract-shaped per the §"Carve-out: process / tooling workstreams"
rule. Each AC names a deliverable's interface + a verifiable
observation (file at path, function returns contract-matching value,
doc contains named section). Five phases; ACs grouped by phase.

### Phase 1 — Repo bootstrap + fixed-timestep accumulator (technique #2)

1. **Repo exists at `~/projects/motion-test-kit/`** with the following
   directory structure: `core/`, `adapters/three/`, `adapters/dom/`,
   `tests/`, `runbooks/`, `labs/`, plus `README.md`, `LICENSE`,
   `package.json`, `.gitignore`. Verifiable: `ls -la` shows all named
   directories + files; `package.json` has `"name": "motion-test-kit"`,
   `"type": "module"`, no runtime dependencies (only devDependencies
   for the kit's own self-tests).

2. **`core/loop/accumulator.js` implements the Glenn Fiedler
   fixed-timestep pattern as a pure function set.** Exports:
   `createAccumulator({ stepMs })` returning an object with `tick(realDtMs,
   updateFn) → { stepsRun, alpha }`. No imports from THREE, no DOM API,
   no `performance.now()` inside the module (caller passes elapsed dt
   explicitly). Verifiable: `grep -E "import|require" core/loop/accumulator.js`
   returns zero engine/DOM imports; self-test `tests/accumulator.test.js`
   constructs an accumulator at 16.667 ms (60 Hz), feeds 100 ms of
   real-dt with a 33 ms maximum-step cap, asserts `stepsRun === 6`,
   asserts terminal `alpha` ∈ [0, 1].

3. **`adapters/three/three-loop-binding.js` wraps `requestAnimationFrame`
   around the core accumulator.** Exports `bindToRAF({ accumulator,
   simUpdate, render })` which returns a `{ start, stop }` controller.
   Render runs every RAF; simUpdate runs `stepsRun` times per RAF at
   fixed step. Verifiable: `grep -E "from 'three'" adapters/three/*.js`
   returns matches in adapters but NOT in `core/`. Self-test
   `tests/three-loop-integration.test.js` runs in node with a stubbed
   RAF, asserts simUpdate is called with fixed-dt arguments only.

4. **`labs/accumulator-lab.html` demonstrates the accumulator
   end-to-end** against a simple THREE.js scene (a cube rotating at
   1 rad/sec under fixed-step physics + a sine-bobbing position under
   real-dt rendering). Loads in Chrome at `file://` with no build step.
   Verifiable: `chrome-devtools.navigate(file://.../accumulator-lab.html)`,
   evaluate `window._motionTestKit.lab.frameCount > 60` after 2 seconds
   wall-clock (lab exposes its state on window for inspection).

5. **`runbooks/02-fixed-timestep-accumulator.md` exists** and contains
   the four required sections (When to use / How to invoke from a
   brief AC / What the Tester does with it / Pass-fail evidence shape /
   Common pitfalls). Verifiable: `grep "^## " runbooks/02-*.md` returns
   all five named sections.

### Phase 2 — Predicates (technique #1) + Flight Recorder (technique #5)

These two are independent additives over Phase 1; landing in parallel
within Phase 2.

6. **`core/predicates/index.js` exports all 9 invariants from Dana's
   vocabulary table as named pure functions.** Each function takes
   `(samples, options) → { passed: boolean, violations: Array<{frame,
   value, bound}> }`. The 9 functions:
   - `deltaMagnitudeBound(samples, { axis, bound })` — Δ-magnitude bound
   - `signStability(samples, { vector, phaseStart, phaseEnd })` — sign-stability of approach velocity
   - `monotonicityScore(samples, { axis, windowFrames })` — flip-count / window
   - `approachPhaseInvariant(samples, { phaseStart, phaseEnd, eps })` — d_target non-increasing during approach
   - `zeroInputNullAction(samples, { inputAxes, deltaAxes })` — input==0 ⟹ Δv==0
   - `velocityBound(samples, { axis, cMax })` — |v| < c_max
   - `stateTransitionWellFormed(samples, { stateMachine })` — every transition exists in declared SM
   - `transformHashEquivalence(samplesA, samplesB, { hashEvery })` — hash(positions, orientations) at frame N matches
   - `frameTimeVariance(samples, { vMax })` — var(frame_dt) < V_smooth (separate concern; kit ships it for completeness)

   Verifiable: `import * as predicates from 'motion-test-kit/core/predicates';`
   then `Object.keys(predicates).length === 9` and each is a function.
   Self-test `tests/predicates.test.js` includes a positive + negative
   case per function (12+ assertions total).

7. **The `samples` shape is documented + standardized.** A `samples` array
   is a sequence of pure-data records: `{ frame, t, anchor: {pos,
   quat}, target: {pos, quat}, input, state, dt }`. The `target` field
   is the **track-A-relative-to-B abstraction Max named explicitly** —
   any predicate computing "approach to target" or "Δ relative to
   anchor" reads from `samples[i].target` (vs camera-only). Verifiable:
   `core/predicates/sample-shape.md` documents the shape; predicate
   functions error with a named exception when `samples[i]` is missing
   required fields.

8. **`core/recorder/ring-buffer.js` implements a fixed-size ring buffer
   for samples** with O(1) append + on-demand snapshot-to-JSON export.
   Exports `createRingBuffer({ capacity, sampleFactory }) → { push,
   snapshot, dumpToBlob }`. No engine imports. Self-test
   `tests/ring-buffer.test.js` pushes 600 samples to a 300-capacity
   buffer, asserts `snapshot()` returns the most-recent 300 in
   chronological order, asserts memory bounded.

9. **`adapters/three/sample-capture.js` wraps the recorder for
   THREE.Object3D anchors.** Exports `captureFrame({ anchor: Object3D,
   target?: Object3D, input?, state? }) → SampleRecord`. Reads
   anchor.position + anchor.quaternion into pure-data records (no
   THREE references in the recorded data — portable to disk and
   replay). Self-test in node uses stubbed Object3D.

10. **On-failure dump pipeline.** Exports
    `attachOnFailureDump({ buffer, predicateChecks, dumpPath }) →
    detach()`. When any registered predicate fires `passed: false`,
    dumps last N frames + next 60 frames to JSON at `dumpPath`.
    Verifiable: self-test installs a deliberate predicate-failure,
    asserts dump file exists at the expected path.

11. **`runbooks/01-per-frame-deltas-and-predicates.md` and
    `runbooks/05-flight-recorder.md` exist** with the four required
    sections each. The #1 runbook explicitly enumerates which AC
    vocabulary maps to which predicate. Sample mapping (must be
    present in the runbook):

    | AC vocabulary | Predicate function |
    |---|---|
    | "no per-frame teleport > 2× max velocity × dt" | `deltaMagnitudeBound` |
    | "approach-phase invariant: d_target non-increasing" | `approachPhaseInvariant` |
    | "no oscillation during approach" | `signStability` + `monotonicityScore` |
    | "zero input → no drift in body frame" | `zeroInputNullAction` |
    | "no NaN/explosion" | `velocityBound` |
    | "state machine well-formed" | `stateTransitionWellFormed` |
    | "refactor preserves trajectory" | `transformHashEquivalence` |

### Phase 3 — Seeded RNG + Input Replay (technique #3)

Depends on Phase 1 (fixed-timestep makes replays byte-equivalent).

12. **`core/rng/mulberry32.js` implements Mulberry32 as a pure
    function.** Exports `createRNG(seed: number) → { next(): number,
    state(): number, restore(state: number) }`. No imports. Self-test
    asserts `seed=12345` produces the documented reference sequence
    (first 5 values committed in the test as a regression guard).

13. **`core/replay/input-recorder.js` records a sparse event stream:**
    `{ frame, kind: 'keydown'|'keyup'|'mousemove'|...|'rngSeed', payload }`.
    Exports `createInputRecorder({ rngSeed }) → { record(event),
    snapshot(): InputRecord }`. The RNG seed is recorded as the first
    event so replays restore it before any sim step. No DOM imports.

14. **`core/replay/input-player.js` replays an InputRecord against a
    sim under fixed-step accumulator.** Exports `createInputPlayer({
    record, simUpdate, applyEvent }) → { tick(), isComplete }`.
    Self-test `tests/replay-determinism.test.js` records 2 seconds of
    synthetic input, replays twice, asserts identical terminal state
    via FNV-1a hash of position+orientation.

15. **`adapters/dom/keyboard-mouse-bridge.js` captures real
    `KeyboardEvent` / `MouseEvent` / `TouchEvent` into the recorder.**
    The bridge MUST capture isTrusted-equivalent semantics — record
    enough event metadata that replay produces the same downstream
    behavior even though replayed events have `isTrusted: false`. The
    bridge documents which metadata is captured and which isn't (e.g.,
    `code`, `key`, `repeat`, `shiftKey`, `ctrlKey`, `altKey`,
    `metaKey`, button states for mouse). Verifiable: integration test
    in `labs/replay-lab.html` records a keystroke sequence, replays,
    asserts recorded `_heldKeys` set equals replayed set.

16. **`runbooks/03-seeded-rng-input-replay.md` exists** with all four
    sections, including the determinism-limits caveat: "JS
    floating-point is not bit-deterministic across browsers/hardware.
    Replay byte-equivalence holds for *same browser version, same OS,
    same CPU architecture*. Cross-machine replay is out-of-scope; use
    transform-hash with tolerance bands (Phase 4) for cross-machine
    regression detection."

### Phase 4 — Transform-Hash Golden Trajectory (technique #4)

Depends on Phase 1 + Phase 3 (deterministic sim is precondition for
hashable trajectory).

17. **`core/hash/fnv1a.js` implements FNV-1a 32-bit hash for byte
    sequences.** Pure function. Self-test asserts known hash values
    for known input strings.

18. **`core/hash/transform-hash.js` hashes `samples[i].anchor.pos +
    anchor.quat + target.pos + target.quat` at every Nth frame.**
    Exports `hashTrajectory(samples, { hashEvery, tolerance }) →
    { hash: string, perFrameHashes: Array<string> }`. The `tolerance`
    parameter quantizes floating-point values to a fixed grid before
    hashing — this is the Box2D pattern Dana cited and implements the
    "tolerance-band comparison, not strict bit equality" requirement
    Max named explicitly. Default tolerance: 1e-6 (picked from Box2D's
    practice; configurable per-scenario).

19. **`core/hash/golden-trajectory.js` implements the golden-trajectory
    workflow.** Exports `recordGolden({ scenario, outputPath })` and
    `verifyAgainstGolden({ scenario, goldenPath, tolerance }) →
    { passed, mismatchFrames }`. A "scenario" is a function `({ rng,
    accumulator, applyInput }) → samples[]` that runs deterministically
    and returns the recorded trajectory. Self-test
    `tests/golden-trajectory.test.js` records a golden, runs the same
    scenario twice, asserts equivalence; perturbs the scenario,
    asserts mismatch with frame-precision diagnostics.

20. **`runbooks/04-transform-hash-golden.md` exists** with all four
    sections. Documents the re-bless workflow ("intentional behavior
    change → re-record golden, commit new hash, name the change in the
    commit") and the tolerance-band rationale.

### Phase 5 — well-dipper integration + Tester persona update + cross-project demonstration

This phase lands the kit's first consumer (well-dipper, additive) and
the Tester persona update simultaneously, since the persona's
invocation patterns reference the kit's stable API surface.

21. **Well-dipper consumes the kit as a git submodule.** Path:
    `~/projects/well-dipper/vendor/motion-test-kit/`. Vite import path
    `motion-test-kit/core/predicates` resolves correctly via either
    a `vite.config.js` alias OR by pinning the submodule's package.json
    `exports` field — pick whichever produces the cleanest import
    statements (PM defers this implementation choice to working-Claude;
    AC verifies the resulting import works, not which mechanism). The
    submodule MUST be pinned to a specific commit, not a moving branch.
    Verifiable: `git submodule status` in well-dipper shows
    motion-test-kit pinned; a smoke test in well-dipper imports and
    calls `deltaMagnitudeBound([], {})` without a runtime error.

22. **Well-dipper's existing autopilot telemetry path emits
    kit-shape `samples`.** The current `window._autopilot.telemetry`
    helper that powered the toggle-fix verification already samples
    per-frame state; this AC requires extending its emitted records to
    match the kit's `SampleRecord` shape (anchor, target, input,
    state, dt). No fixed-timestep migration in this phase — kit-shape
    samples emit at variable dt; predicates that depend on
    fixed-timestep semantics (e.g., transform-hash equivalence)
    document that they require Phase 5b to be valid in well-dipper
    production. Verifiable: a kit-driven verifier script reads the
    telemetry JSON output, runs predicates `deltaMagnitudeBound` +
    `approachPhaseInvariant` against an autopilot capture, returns
    PASS/FAIL with per-frame diagnostics.

23. **Dogfood: re-verify the toggle-fix workstream's AC #4
    (`docs/WORKSTREAMS/manual-nav-autopilot-toggle-fix-2026-05-02.md`
    AC #4 — "WASD interrupt produces visible motion ≤ 200ms") using
    the kit's predicates against a fresh capture at HEAD `679321b` (or
    its successor commit).** The predicate `deltaMagnitudeBound`
    against the post-W-press window must report PASS *and* the
    monotonicity-score predicate over the next 5 seconds must NOT
    report the teleport-cycle bug class that telemetry missed in the
    original verification. If it does report a violation, that's a
    real bug — surface to working-Claude as a follow-up. The dogfood's
    purpose is to demonstrate the kit catches what the prior process
    missed, OR to demonstrate cleanly that the bug class genuinely
    isn't present (either is a valid kit-validation outcome; what's
    invalid is *no result*).

24. **Tester persona update at `~/projects/well-dipper/docs/PERSONAS/tester.md`
    adds a section "Motion-class verification — kit usage."** Required
    contents:
    - Cross-link to Dana's research file
      (`research/motion-testing-methodology-2026-05-02.md`) and the
      9-row vocabulary table.
    - Explicit invocation pattern: example code block showing
      `import { signChangeRate, deltaMagnitudeBound } from
      'motion-test-kit/core/predicates'; const samples = await
      captureWithKit({ scenario, anchor }); assert(...);` for the
      Tester's verifier scripts in `recordings/`.
    - Bug-class → technique mapping:
      - Invariant-class bug → predicates (#1) + flight recorder (#5).
      - Regression-class bug → transform-hash (#4) + input replay
        (#3) for reproducibility.
      - Reproducibility-class bug → seeded RNG + input replay (#3).
    - Felt-experience-vs-invariant-class distinction: documents that
      recordings remain the right tool for felt-experience gates
      (Principle 6 continuity, "does this feel right") and the kit
      replaces recordings only for invariant-class bugs that can be
      named as predicates. Cite Dana's research §"Recording-as-evidence"
      explicitly.
    - Default-load rule: "For motion-class workstreams (any workstream
      whose ACs include phase-sourced criteria from `docs/FEATURES/*.md`
      describing animated/phased/temporal behavior), the Tester's
      first verification attempt uses the kit's predicates. Ad-hoc
      telemetry is fallback when the kit doesn't yet have a predicate
      for the AC's invariant — and that gap should be flagged to PM
      so the kit grows."

    Verifiable: `grep "^## Motion-class verification" docs/PERSONAS/tester.md`
    matches; the section is non-empty and references the kit by name.

25. **Cross-project usage demonstrated: a smoke-test integration into a
    **scratch three.js + Vite project** (kit-internal `examples/`
    directory) shows the kit imports + functions in a project with no
    well-dipper-specific assumptions.** This is the portability proof.
    Verifiable: `examples/three-vite-smoke/` exists, `npm run dev` in
    that directory loads a page that demonstrates predicate evaluation
    against a synthetic scene.

26. **Each runbook has been read end-to-end and cross-checked against
    the AC vocabulary it claims to support.** Specifically, every
    9-row predicate has at least one runbook entry that maps an
    AC-shaped sentence to that predicate's invocation. Verifiable:
    PM (or working-Claude as PM proxy) reviews all 5 runbooks before
    Tester gate; review checklist in the workstream's commit message.

27. **Top-level `README.md` at repo root** explains the kit's purpose,
    architecture (hexagonal — `core/` engine-agnostic, `adapters/*/`
    engine-specific), the 5 techniques and their dependencies, the
    cross-project consumption pattern (git submodule + Vite alias),
    and the determinism-limits caveat (Phase 3 RNG/replay is
    same-machine-byte-equivalent; cross-machine uses Phase 4
    tolerance-band hash). Verifiable: file exists, contains all named
    headings.

## Principles that apply

(From `docs/GAME_BIBLE.md` §"Development Philosophy [BOTH]" — naming the
load-bearing 2-3 for *this* work, not blanket-listing.)

- **Principle 2 — No Tack-On Systems.** The toggle-fix incident proved
  the failure mode this principle protects against, applied to
  testing infrastructure: the prior verification path treated each
  motion-class AC as an ad-hoc telemetry assertion with predicates
  invented per-bug. That works until it doesn't — the predicate that
  would have named the teleport-cycle wasn't in the harness because
  no one had needed it yet. The kit makes the vocabulary first-class:
  Dana's 9 named invariants become callable functions with stable
  contracts, and adding a new predicate is an explicit growth event
  (PM brief amendment + kit version bump), not an ad-hoc patch in a
  one-off verifier script. **What violates it in this workstream:**
  building the kit's predicates as well-dipper-internal helpers in
  `src/test/` instead of as a standalone library; or letting the
  Tester persona's "default-load the kit" rule degrade into "use the
  kit when convenient." The first makes the kit re-tackonable per
  project; the second makes the vocabulary erosion a slow leak.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Hexagonal architecture is this principle applied to
  testing tooling. `core/` produces and carries pure data + pure
  functions; `adapters/three/` is the renderer-equivalent that
  consumes the engine API; `adapters/godot/` (future) is another
  consumer. Data flows one direction: a `SampleRecord` produced by
  `adapters/three/sample-capture.js` is pure-data and can be JSON'd,
  replayed, hashed — it never reaches back into THREE.Object3D for
  more state. **What violates it:** letting `core/predicates/*.js`
  import THREE.Vector3 for "convenience"; embedding three.js render
  state inside SampleRecord ("just store the Object3D reference, we
  can dereference later"); making the recorder push events that
  contain DOM Event objects (which are non-serializable). All three
  failure modes destroy the Godot-portability commitment and turn the
  kit into a well-dipper-private library by accident.

- **Principle 6 — First Principles Over Patches.** This kit IS
  Principle 6 applied to the testing infrastructure itself. The prior
  pattern (ad-hoc verifier scripts in `recordings/`, predicates
  invented per-bug, recordings as catch-all evidence) had been patched
  through 4+ iterations across April 2026 — the canvas-recording
  protocol, the refactor-verification protocol, the
  motion-evidence-for-motion-features rule, the recording-vs-lab
  decision feedback. Each addressed a real gap; none stepped back to
  ask "what's the architecture that would let us not need the next
  patch?" Dana's research is that step-back. The kit is the rebuild.
  **What violates it:** allowing this workstream to become "Phase 1
  ships, then Phases 2-5 land separately as Max wants them." The
  no-usage-until-all-built constraint is Principle 6's enforcement —
  if Phase 1 ships and starts being consumed in well-dipper while
  Phases 2-5 are unbuilt, working-Claude's verifier scripts will
  invent ad-hoc predicates for the missing surface area, and the
  vocabulary erosion begins immediately. Land all 5, persona-update
  in the same workstream, then turn on consumption.

## Drift risks

- **Risk:** Phase 1 ships, Max greenlights "let's start using the
  accumulator in well-dipper now" before Phases 2-5 are built.
  **Why it happens:** Phase 1 is genuinely useful in isolation
  (Fiedler accumulator + lab harness), and the migration of
  well-dipper's loop is a known-substantial improvement. The temptation
  to bank the win is high.
  **Guard:** AC #21 explicitly gates well-dipper integration on the
  kit's API surface being stable — Phases 2-5 must land first.
  Working-Claude must NOT migrate `src/main.js`'s loop in this
  workstream regardless of how clean Phase 1 looks. The full-loop
  migration is a separate, follow-up workstream after this one ships.

- **Risk:** `core/` accidentally imports THREE because "it's just for
  this one helper, the test runs three anyway."
  **Why it happens:** Convenience (Principle 6 / Principle 5
  violation). THREE.Vector3 is a nicer API than `[x, y, z]` arrays.
  The temptation to reach for it inside `core/predicates/*.js` is
  strong, especially when test data IS coming from a THREE scene.
  **Guard:** AC #2 + AC #6 both verify-by-grep that `core/` has zero
  engine imports. The CI / self-test step for this kit MUST include
  a hard `grep` assertion that fails on any THREE / DOM import in
  `core/`. If a predicate genuinely needs vector math, the kit ships
  its own minimal vector helpers in `core/math/` (3-4 functions —
  add, sub, dot, length — pure-data inputs, pure-data outputs).

- **Risk:** Tester persona update gets postponed to a "follow-up
  workstream" because the kit's API surface is "still settling."
  **Why it happens:** The persona update is the meta-glue that makes
  the kit actually used; it's also the easiest thing to defer because
  it doesn't ship code. The argument "we'll write the persona update
  once we have feedback from real consumption" is plausible-sounding.
  **Guard:** AC #24 is in this workstream, not a follow-up. The kit
  isn't "shipped" until the persona references it explicitly. If the
  API surface is still moving, the workstream isn't done — finish
  the API stabilization, *then* land the persona update, in the same
  workstream.

- **Risk:** RUNBOOK quality degrades into checkbox documentation —
  each one has the four required sections but they're shallow ("use
  this when you need to test motion. invoke from the brief AC. the
  Tester runs it. the result is a verdict.").
  **Why it happens:** Five runbooks × four sections = 20 pieces of
  prose, and the AC verifies presence-of-section, not depth.
  Documentation is the thing that gets shortest-changed under time
  pressure.
  **Guard:** AC #26 explicitly requires PM (or working-Claude as PM
  proxy) to read each runbook end-to-end before Tester gate. The
  review's output is a checklist in the workstream commit message
  naming, per runbook, what AC vocabulary maps to which predicate.
  If the mapping is missing or thin, the runbook isn't done. The PM's
  follow-up audit at workstream Shipped also re-reads the runbooks
  cold; if they don't help an unfamiliar reader connect a felt-jank
  claim to a measurable predicate, that's a defect.

- **Risk:** The kit's "track A relative to B" abstraction degrades
  into "track A relative to the camera" because every test scenario
  authored uses the camera.
  **Why it happens:** Well-dipper's existing telemetry IS
  camera-anchored; the temptation to skip the abstraction and just
  store `camera.position` is real.
  **Guard:** AC #7 makes `target` an explicit field in the SampleRecord
  shape, distinct from `anchor`. AC #6's predicates that name "target"
  in their parameters must read from `samples[i].target`, not from a
  hard-coded `camera.position`. AC #25's cross-project smoke test
  must use a non-camera anchor (e.g., a NPC ship tracking a station)
  to prove the abstraction lands.

- **Risk:** Determinism-limits caveat gets buried in a footnote and
  the kit gets used in cross-machine scenarios (multiplayer
  leaderboards, server-side validation) that it doesn't support.
  **Why it happens:** The kit's API is shaped to look like
  determinism is a property; "deterministic replay" sounds absolute.
  **Guard:** AC #16's runbook for technique #3 explicitly states the
  same-machine limit; AC #27's top-level README states it. The kit's
  `recordGolden` API name uses "tolerance" in the parameter list to
  surface that bit equality isn't the contract. If a future feature
  needs cross-machine determinism, that's a separate research +
  engineering effort (Box2D's full hardening), not a kit
  configuration option.

## In scope

- Standalone repo at `~/projects/motion-test-kit/`. New repo, new
  README, new package.json.
- All 5 techniques implemented in `core/` (engine-agnostic) +
  `adapters/three/` + `adapters/dom/`.
- Self-tests in `tests/` exercising `core/` only — no engine, no DOM.
- Lab harnesses in `labs/` demonstrating each technique end-to-end.
- Per-technique runbooks in `runbooks/` (5 files, four required
  sections each).
- Cross-project smoke test in `examples/three-vite-smoke/`.
- Well-dipper integration as git submodule with kit-shape telemetry
  emission (additive over existing variable-dt loop).
- Dogfood re-verification of toggle-fix AC #4 using the kit.
- Tester persona update at `docs/PERSONAS/tester.md` (well-dipper repo;
  symlinked from `~/.claude/agents/tester.md`).
- Top-level README documenting architecture, dependencies, and the
  determinism-limits caveat.

## Out of scope

- **Migrating well-dipper's `src/main.js` loop to fixed-timestep.** The
  kit's accumulator demonstrates end-to-end in `labs/accumulator-lab.html`
  and is consumable; the well-dipper main-loop migration is a separate
  substantial workstream (touches autopilot, ship choreographer, camera
  controller, audio, BPM clock, every `update(dt)` call). Land the kit
  first; migrate well-dipper second.
  **Sibling brief:** `docs/WORKSTREAMS/welldipper-fixed-timestep-
  migration-2026-05-03.md` (authored 2026-05-03 alongside this brief —
  together they form "Path B" per Max's 2026-05-02 direction). The
  sibling does NOT begin until this kit brief is `Shipped`.
- **Godot adapter.** Architecture supports it; building it is a future
  workstream when Max moves engines.
- **Other three.js projects beyond well-dipper.** The cross-project
  smoke test (AC #25) proves portability but isn't a real integration;
  whichever project Max moves to next does its own integration on
  demand.
- **Toggle-fix workstream's status decision.** The dogfood (AC #23)
  produces data; the workstream's Shipped flip happens in *that*
  workstream's context with Max's recording verdict, not here.
- **Visual debugging tooling** (in-game charts, overlays, HUD
  instruments). Useful but orthogonal to the 5 techniques. Carve as
  follow-up if Max wants it.
- **Property-based / QuickCheck-style fuzzing.** Dana flagged it as
  low-value for this project; not building it.
- **CI pipeline.** No build server; the kit's self-tests run via
  `npm test` locally and don't require infrastructure.
- **Cross-browser / cross-machine deterministic replay.** Out-of-scope
  per Dana's research; flagged as a future research line if
  multiplayer / leaderboards become a feature.

## Handoff to working-Claude

**Read first (in this order):**
1. `research/motion-testing-methodology-2026-05-02.md` — full
   methodology, the 9-row vocabulary table, the carve-outs.
2. `screenshots/diagnostics/manual-autopilot-toggle-2026-05-02/DIAGNOSIS.md`
   — the bug class the kit must catch.
3. `docs/PERSONAS/tester.md` — the persona this work updates in
   Phase 5.
4. `docs/WORKSTREAMS/manual-nav-autopilot-toggle-fix-2026-05-02.md`
   AC #4 — the dogfood target.
5. Glenn Fiedler, *Fix Your Timestep!* — Phase 1 reference.
6. Erin Catto, *Determinism* (box2d.org) — Phase 4 reference.

**Build order is dependency-strict:**
- Phase 1 (Repo + Accumulator) — ACs #1-#5.
- Phase 2 (Predicates + Flight Recorder) — ACs #6-#11. Land in
  parallel; both depend only on Phase 1.
- Phase 3 (RNG + Input Replay) — ACs #12-#16. Depends on Phase 1.
- Phase 4 (Transform-Hash) — ACs #17-#20. Depends on Phase 1 + 3.
- Phase 5 (Integration + Persona) — ACs #21-#27. Depends on Phases
  1-4.

Each phase commits separately; AC #26 (runbook review) gates Phase 5.

**The `core/` purity rule is load-bearing.** Before each commit in
phases 1-4, run `grep -rE "from 'three'|from '@?[a-z]+/three'|require\\\\('three" core/`
and verify zero matches. If you need vector/quaternion math in `core/`,
add it to `core/math/` as pure-data (array-based) functions. This is
non-negotiable — violating it costs the Godot-portability commitment.

**The "track A relative to B" abstraction is named explicitly by Max,
not just inferred.** When you reach for `samples[i].camera.position`,
stop and confirm whether the predicate could care about a non-camera
anchor in another scenario. If yes (e.g., NPC ship tracking a
station), the abstraction is `samples[i].anchor` + `samples[i].target`,
NOT camera-special-cased.

**The dogfood (AC #23) has two valid outcomes.** Either: (a) the
kit's predicates re-verify the toggle-fix AC #4 cleanly with PASS,
demonstrating the kit reproduces the prior verification at a higher
fidelity; or (b) the kit's predicates flag a residual issue the prior
process missed (sign-stability or monotonicity-score violation in the
post-W-press window). Outcome (b) is a real bug surfaced for follow-up
in the toggle-fix workstream's context — flag to working-Claude in
that workstream, not here. Either outcome is a kit-workstream PASS;
what's invalid is "didn't run the dogfood" or "ran it but didn't
report the result."

**What "done" looks like:**
- All 27 ACs verified.
- Kit repo at `~/projects/motion-test-kit/` exists with the 5 phases
  landed, self-tests passing locally (`npm test` in the kit repo).
- Well-dipper consumes the kit as a submodule, kit-shape telemetry
  emits from autopilot's existing telemetry helper, dogfood result
  reported.
- Tester persona at `docs/PERSONAS/tester.md` has the "Motion-class
  verification — kit usage" section with bug-class-to-technique
  mapping and the felt-experience-vs-invariant-class carve-out.
- Tester verdict PASS on the to-be-shipped commit (or commit range
  for the well-dipper-side changes; the kit repo is its own commit
  history).
- Brief flipped to `Shipped <commit-sha> — kit repo @
  motion-test-kit:<sha>` once Tester PASSes. No recording gate (this
  is a tooling workstream; AC verification is contract-shaped, not
  felt-experience).
- Push to origin both the kit repo (new repo, set up remote) and
  well-dipper (established-deploy site per
  `feedback_deploy-established-sites.md`).

**What artifacts to produce:**
- Kit repo with full source + tests + runbooks + examples.
- Well-dipper-side commits: submodule add + kit-shape telemetry
  emission + Tester persona update.
- Dogfood result: a verifier script + its output (passed/failed)
  noted in the workstream commit message or appended to the
  toggle-fix DIAGNOSIS.md addendum.
- Workstream commit messages cite which ACs each commit closes.

**What to avoid:**
- Importing THREE into `core/` (Drift risk #2, Principle 5).
- Shipping Phase 1 alone and starting consumption (Drift risk #1,
  Principle 6).
- Postponing the Tester persona update (Drift risk #3).
- Shallow runbooks (Drift risk #4).
- Camera-special-casing the `target` abstraction (Drift risk #5).
- Treating the determinism limits caveat as fine print (Drift risk
  #6).
- Migrating well-dipper's main loop to fixed-timestep — that's a
  separate workstream.

**Tester invocation (after each coherent phase, and before Shipped):**
```
Agent(subagent_type="tester", model="opus", prompt="""Verify against
docs/WORKSTREAMS/motion-test-kit-2026-05-02.md ACs #<phase-acs>.
Diff: <commit-sha or range>. Kit repo at ~/projects/motion-test-kit/.
Self-tests run via `cd ~/projects/motion-test-kit && npm test`.
Engine-agnostic grep assertion: `grep -rE "from 'three'|from 'gl-matrix'|window\\.|document\\." ~/projects/motion-test-kit/core/`
must return zero matches. Render verdict per Tester audit shape.""")
```

For Phase 5 specifically, the Tester reads `docs/PERSONAS/tester.md`
post-update and verifies the "Motion-class verification — kit usage"
section against AC #24's required-contents list — this is a
self-referential verification (Tester verifying its own persona doc),
which is fine because the Tester reads the latest version of the file
fresh per its own persona's instructions, and the AC is contract-shaped
(presence + content match), not behavioral.

---

## Open question — flag for Max if the dogfood (AC #23) surfaces a
real bug

The toggle-fix workstream is at `VERIFIED_PENDING_MAX 679321b`. If the
kit's monotonicity-score predicate flags a residual teleport-cycle in
the post-W-press window — i.e., the bug class Dana's research said the
prior process was structurally blind to — that's a real observation
that affects the toggle-fix workstream's Shipped flip. Surface to Max:
"Kit dogfood found <specific finding>. Toggle-fix Shipped flip should
wait for either (a) a fix in toggle-fix, or (b) explicit decision to
ship-anyway with the issue documented as a follow-up." Do not flip
toggle-fix to Shipped without that decision being made.

---

*Brief authored by PM 2026-05-02 against well-dipper HEAD 679321b and
research deliverable `motion-testing-methodology-2026-05-02.md`. No
parent feature doc — tooling workstream per
`docs/PERSONAS/pm.md` §"Carve-out: process / tooling workstreams".*
