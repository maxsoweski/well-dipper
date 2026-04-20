# Workstream: Warp phase perf pass — FOLD hitch, INSIDE freeze, EXIT stutter (2026-04-20)

## Parent feature

`docs/FEATURES/warp.md` — specifically:

- §"Primary criterion — 'seamless'": *"The feature has failed if ANY
  of the following occurs at ANY phase or phase boundary: … Framerate
  change … Sudden jarring speed change."* Framerate change is the
  failure rubric this workstream attacks.
- §"Phase sequence ENTER": *"Ship accelerates toward the portal. Camera
  can shake briefly during acceleration — thrusters amping up to keep
  the ship on line. Shake is a directed effect, not an artifact.
  Smooths out once in the fold."* The bible explicitly forbids hitch-
  as-artifact; a framerate drop during acceleration is the
  disallowed class.
- §"Failure criteria / broken states" — *"Loading-induced hitches. The
  most likely cause of seamless-break today … destination system
  assets must be ready before any phase where a freeze would occur,
  not streamed during. This is a load-timing problem, not a
  shader / frame-budget problem."* The feature-doc-level hypothesis
  for the INSIDE freeze. This workstream tests it.
- §"Phase sequence EXIT": *"Crowning transition: giant-flying-headfirst
  analogy … Quick transition; camera continuous."* "Quick" + "camera
  continuous" is incompatible with the stuttery fly-out → slowdown →
  speed-back-up profile Max observed in the un-do recording.
- §"Current state snapshot (2026-04-18) ENTER": *"weakest link.
  1–2 second freeze at the initial slowdown. This is the primary bug
  blocking V1."* The existing on-record state of the feature names
  freeze #2 as the primary V1 blocker.

## Implementation plan

`docs/PLAN_transition-freeze-fix.md` — existing design draft
(session 2026-04-15) for the INSIDE freeze that is exactly this
workstream's issue #2. The plan proposes "pre-spawn during FOLD":
move the GPU resource creation (mesh build, shader compile, texture
upload) out of `onSwapSystem` and into `onPrepareSystem` so it runs
while the FOLD portal animation hides it. Currently the PLAN is
marked *"Design draft, awaiting Max's review before implementation."*
If the diagnosis below confirms shader compile / GPU-upload as the
INSIDE root cause, this workstream is the implementation vehicle for
PLAN_transition-freeze-fix Phase 1 + Phase 2 (plus cancellation per
Phase 3 if the diagnosis reveals an abort path). If the diagnosis
reveals a different mechanism, PLAN_transition-freeze-fix stays a
draft and this workstream writes its own fix plan.

Also relevant: `docs/PLAN_warp-tunnel-v2.md` (hybrid stencil portal +
screen-space composite architecture — the surface the perf issues
live on).

## Scope statement

Diagnose and fix three phase-window perf regressions observed in
Max's 2026-04-19 un-do recording (`screenshots/max-recordings/
warp-hyper-dimness-undo-2026-04-18.webm`) and named as followups in
that workstream's Status block:

1. **FOLD hitch** — framerate chugs at warp initiate while the camera
   accelerates toward the portal (first ~2–3 s of a warp; the first
   followup listed in the un-do brief as `warp-fold-fps-hitch`).
2. **INSIDE freeze** — momentary hang at the ENTER → HYPER transition
   when the camera crosses Portal A's plane (followup
   `warp-inside-entry-freeze`; matches the 1–2 s freeze the feature
   doc already names as the primary V1 blocker and which
   `PLAN_transition-freeze-fix.md` proposes a fix for).
3. **EXIT stutter** — fly-out → slowdown → speed-back-up arc into
   orbit that reads stuttery rather than continuous (followup
   `warp-exit-smoothness`).

One unit of work because the three phases are contiguous moments of
the same warp traversal, they share likely root causes (shader
compilation, allocation churn, synchronous GPU work on phase
boundaries — see §"Diagnosis posture" below), and collapsing them
into one diagnosis pass produces a shared profiling trace covering
all three phase windows rather than three separate traces with
overlapping setup costs. Per `docs/GAME_BIBLE.md` §11 Principle 6
(First Principles Over Patches): if the three hitches turn out to
share a mechanism, the correct response is one fix, not three
independent patches.

**Explicitly excluded from the bundle reasoning:** this is NOT a
license to fix the issues simultaneously. The work order is
**profile → diagnose → fix (one phase at a time, smallest first) →
re-verify.** Bundling is for diagnosis efficiency, not for
"everything at once" shipping.

### Diagnosis posture

Before any code change, working-Claude produces a Chrome DevTools
Performance trace of a full warp (FOLD → ENTER → HYPER → EXIT) with
the destination being Sol (per `feedback_always-test-sol.md` —
Sol exercises the `KnownSystems` / `SolarSystemData` path, which is
distinct enough from procedural destinations that it must be tested
explicitly) and a second trace with a random procedural destination.
Each trace must cover all four phases of a single warp end-to-end.
The trace is the diagnostic artifact; the fixes are derived from it.

Hypotheses to test in the trace, from cheapest-to-check to
deepest-structural, so working-Claude can stop early if an upstream
hypothesis fires:

- **H1 — Synchronous GPU work at phase transitions.** Shader compile
  / GSL link / texture upload on the main thread during ENTER →
  HYPER crossing. This is the feature-doc-stated hypothesis for
  issue #2 and the one `PLAN_transition-freeze-fix.md` proposes the
  "pre-spawn during FOLD" fix for. Signature in the trace: a
  multi-hundred-ms purple / GPU block at `onSwapSystem` /
  `spawnSystem` / `warpSwapSystem`.
- **H2 — Allocation churn / GC pause at phase transitions.** Any of
  the three transitions may trigger garbage collection if the
  `spawnSystem` disposal path or the EXIT handoff creates sufficient
  allocation pressure. Signature in the trace: yellow/orange GC
  marks coincident with phase transition timestamps.
- **H3 — Deceleration profile discontinuity at HYPER → EXIT.** The
  EXIT stutter Max described (fly-out → slowdown → speed-back-up)
  suggests a velocity curve that is not C1-continuous — a
  derivative discontinuity between `_exitPeakSpeed` decay and the
  post-warp autopilot velocity. Signature: not in a perf trace but
  in the `WarpEffect.js` L285–320 EXIT update + the handoff to
  whatever owns post-warp camera speed. This is a *correctness*
  bug masquerading as a perf bug — a 60 fps animation of a
  non-continuous velocity curve still reads stuttery.
- **H4 — Autopilot post-warp computation cost.** At HYPER → EXIT the
  game hands back to autopilot (per `SYSTEM_CONTRACTS.md` §9.1:
  *"warp drive state hands back to Autopilot or Manual"*), which
  may do expensive target-acquisition work synchronously. Signature:
  JS-side cost cluster right at the EXIT phase start. Related to but
  distinct from H3. Note: the un-do brief's followup #5
  (`autopilot-star-orbit-distance`) is an autopilot bug, not this
  workstream's concern — but autopilot's cost during EXIT is in
  scope here if the trace shows it.
- **H5 — Camera acceleration profile discontinuity at FOLD start.**
  `WarpEffect.js` L146–177 FOLD update ramps `cameraForwardSpeed`
  from 0 to `_foldPeakSpeed` "over FOLD_DUR (quadratic ramp)." If
  the ramp kicks off with a velocity discontinuity (previous-state
  non-zero camera velocity minus new quadratic-ramp-from-zero
  initial condition), that reads as a hitch at warp initiate. Same
  reasoning as H3 — correctness bug reading as perf.

Hypotheses H3 and H5 are "correctness masquerading as perf" — if
either fires, the fix is a velocity-curve edit and the fix-it-smallest
principle says touch only that curve. Hypotheses H1 and H2 are
"synchronous work on main thread" — if either fires, the fix follows
`PLAN_transition-freeze-fix.md` (pre-spawn during FOLD) for H1 or
requires an allocation audit for H2. Hypothesis H4 is a handoff
question answered by the trace.

**Do not start coding fixes until the trace confirms which hypothesis
is live for each phase.** This is Principle 6 explicitly: no patches
ahead of diagnosis.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §"The Warp as Sacred Experience" — the
bible's core claim for warp is that it is a *sacred* experience, and
the feature doc's §"Primary criterion — 'seamless'" names framerate
change as an ANY-phase sacred-experience failure. The un-do
recording closed HYPER, EXIT (geometry), and ENTER (structural)
content ACs; this workstream closes the motion-continuity AC the
un-do explicitly marked PARTIAL.

Advances `docs/FEATURES/warp.md` §"Current state snapshot (2026-04-18)
ENTER" by attacking the 1–2 s freeze the snapshot names as "the
primary bug blocking V1." The un-do's AC #4 passed structurally but
did not eliminate the freeze; this workstream targets the freeze
directly.

Feeds the V1 criteria in `docs/FEATURES/warp.md` §"V1 — must ship":
*"Motion continuity / seamlessness across all phase transitions (the
primary criterion)."* V1 is not shippable with the three hitches in
place.

## Acceptance criteria

ACs are phase-sourced per `docs/PERSONAS/pm.md` §"Per-phase AC rule."
The workstream touches all four warp phases to varying degrees
(FOLD, ENTER, HYPER via transitions, EXIT), so each has an AC even
though the recording only documented user-visible issues at three
phase windows. HYPER gets a regression-guard AC (must not be made
worse).

### Scope-pushback on FPS floor numbers

The feature doc does not name a numeric FPS floor. §"Primary
criterion — 'seamless'" names "framerate change" as the failure
class but not a threshold. `docs/GAME_BIBLE.md` §"Performance /
Optimization Strategy" does not pin a warp frame budget either;
it names a starfield-generation budget (3000ms total for a warp,
not per-frame) and names overdraw as the known GPU bottleneck.

This brief's ACs therefore use **"no visible hitch in Max's
recording"** as the evaluation criterion rather than a numeric FPS
floor, with supporting telemetry from the Chrome DevTools trace as
backup. Rationale: Max is the evaluator of sacred-experience
smoothness per the Shipped-gate protocol; a 55 fps minimum that
reads smooth passes, and a 60 fps minimum with a single 200 ms
spike fails — the threshold that matters is perceptual, not
numerical. The trace gives us *diagnostic* numbers for working-
Claude to reason about fixes; the recording gives us the
*acceptance* verdict from Max.

**If Max wants a numeric floor baked in, he flags it on this brief
and I revise before working-Claude starts.** Pending that flag, the
AC-authoring decision is: perceptual recording pass + trace-based
numeric sanity check (phase windows show no >100 ms synchronous
block and no GC pause >50 ms during any phase transition).

### Phase-sourced ACs

1. **FOLD — framerate smooth during portal-approach acceleration**
   (per `docs/FEATURES/warp.md` §"Primary criterion — 'seamless'":
   *"The feature has failed if ANY of the following occurs … at
   ANY phase or phase boundary: Framerate change"*; and §"Phase
   sequence ENTER": *"Camera can shake briefly during acceleration
   — thrusters amping up … Smooths out once in the fold"* — shake
   is authored, hitch is not). Verified in Max's recording: the
   first 2–3 s of the warp (FOLD phase + early ENTER) read as
   smooth camera acceleration. The chugging Max observed in the
   un-do recording's FOLD window is eliminated. Diagnostic backup
   from the Chrome DevTools trace: no synchronous JS block
   >100 ms during FOLD's L146–177 update loop.

2. **ENTER — no freeze at Portal A threshold crossing** (per
   `docs/FEATURES/warp.md` §"Phase-level criteria (V1) ENTER":
   *"both-visible partial-in moment occurs cleanly. Camera
   continuous through threshold. No sudden position change"*; and
   §"Current state snapshot (2026-04-18) ENTER": *"1–2 second
   freeze at the initial slowdown. This is the primary bug
   blocking V1"*). Verified in Max's recording: the ENTER →
   HYPER transition is continuous; no momentary hang as the
   camera crosses Portal A's plane. Diagnostic backup: no
   synchronous JS block >100 ms around `onTraversal('INSIDE')` /
   `onSwapSystem` / `warpSwapSystem` / `spawnSystem` in the
   trace. (If H1 is the live hypothesis, the expected fix is
   PLAN_transition-freeze-fix Phases 1 + 2.)

3. **HYPER — regression guard, no new stutter introduced** (per
   `docs/FEATURES/warp.md` §"Phase-level criteria (V1) HYPER":
   *"tunnel geometry is cylindrical and extends into distance …
   Destination visible at the far end at some point during
   HYPER"*; and the un-do workstream's Shipped-verified pass on
   AC #1 and AC #2). Verified in Max's recording: HYPER reads as
   the un-do recording did or better — compositor ray-cone
   walls present, destination-star crown visible, no new
   mid-tunnel hitch introduced by the fixes above. This is a
   regression-guard AC; fixes to FOLD / ENTER / EXIT must not
   visually affect the compositor-owned HYPER experience.

4. **EXIT — crowning transition smooth, deceleration continuous**
   (per `docs/FEATURES/warp.md` §"Phase-level criteria (V1) EXIT":
   *"crowning transition, camera continuous, end state is flying
   in the destination system"*; and §"Phase sequence EXIT":
   *"Quick transition; camera continuous."*). Verified in Max's
   recording: the HYPER → EXIT crowning reads as quick and
   continuous; the fly-out → slowdown → speed-back-up stutter Max
   observed in the un-do recording is eliminated. Diagnostic
   backup: if H3 is the live hypothesis, the `WarpEffect.js`
   EXIT update + the post-warp velocity handoff forms a C1-
   continuous velocity curve (no derivative discontinuity at
   either the EXIT phase start or at EXIT → post-warp handoff).

5. **Seamless — no framerate change at any phase transition** (per
   `docs/FEATURES/warp.md` §"Primary criterion — 'seamless'":
   *"Framerate change"*). Verified in Max's recording: the
   recording does not exhibit any of the three hitches the un-do
   recording did. This is the integrative AC the three phase-
   specific ACs together support; it exists separately so that
   "two of three passed, one still hitches" is not accidentally
   readable as Shipped.

6. **Verification artifact is a canvas-path recording covering
   FOLD → EXIT.** Per `docs/MAX_RECORDING_PROTOCOL.md` §"Capture
   path — canvas features (default)." Agent-initiated via
   `~/.claude/helpers/canvas-recorder.js`; fetched via
   `~/.local/bin/fetch-canvas-recording.sh` into
   `screenshots/max-recordings/warp-phase-perf-pass-2026-04-20.webm`.
   Single recording of a full warp to Sol, contact-sheet surfaced
   for Max's review. Shipped flips only after Max evaluates
   ACs #1–#5 against the recording, per `VERIFIED_PENDING_MAX`
   → `Shipped` protocol. A second recording to a random
   procedural destination is a nice-to-have if the first one is
   ambiguous at any AC; not required.

7. **Diagnosis commit + fix commits are separable.** The first
   commit of this workstream is the diagnostic artifact — the
   Chrome DevTools Performance trace (or its summary in the
   brief's §"Trace findings" section, appended below by working-
   Claude) — and names which hypotheses fired for which phases.
   Fix commits follow, smallest first (usually a velocity curve
   edit if H3/H5 fire, then the pre-spawn refactor if H1 fires).
   Each fix commit names the AC it closes and cites the
   hypothesis it resolves. No omnibus "fix all three" commit.

## Principles that apply

(From `docs/GAME_BIBLE.md` §11 Development Philosophy. Four
principles are load-bearing here; the other two — Principle 1 Hash
Grid Authority and Principle 4 BPM-Synced Animation — are orthogonal
to phase-window perf and are intentionally omitted.)

- **Principle 6 — First Principles Over Patches.** *"If a system
  needs more than 2-3 patches to achieve a goal, the architecture is
  wrong."* The INSIDE freeze has been partially patched multiple
  times across sessions (the design-draft PLAN at
  `docs/PLAN_transition-freeze-fix.md` is itself the second attempt
  at a fix; earlier attempts are in the session logs). A third
  patch-shaped fix without diagnosis would cross the "2-3 patches"
  line. The Director's bundling reasoning is load-bearing here:
  *"almost certainly shared root causes … one fix not three."* The
  diagnostic trace is the first-principles move. *Violation in this
  workstream would look like:* jumping to a fix for FOLD before the
  trace runs ("probably shader compile, let's just pre-spawn and
  see"). No. Trace first, then fix, then verify. If the fix works
  and the trace wasn't necessary, we still generated the trace for
  the record.

- **Principle 2 — No Tack-On Systems.** *"Every feature must flow
  naturally from the generation pipeline. If rendering needs data
  that generation doesn't provide, the fix is ALWAYS in generation."*
  For perf fixes this reads as: if `WarpEffect.js` needs the system
  built before ENTER and the current architecture builds it during
  ENTER, the fix is to move the build (PLAN_transition-freeze-fix's
  approach — lift GPU work into `onPrepareSystem`), not to insert a
  "hide the hitch" visual layer over the freeze. *Violation in this
  workstream would look like:* a brief screen-darken / fake
  "entering warp" overlay during the INSIDE freeze to mask it
  visually, an exposure tween to soften perceived stutter at EXIT,
  or any visual plaster that doesn't eliminate the underlying
  stall. The fix is structural or it isn't a fix.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** *"Data flows one direction through the system … Never
  go backward."* The pre-spawn-during-FOLD approach
  (`PLAN_transition-freeze-fix.md`) honors this — destination
  system data is produced once (model), carried through the warp
  (pipeline via `pendingSystemData` / `_pendingBuiltSystem`), and
  consumed at INSIDE crossing (renderer activation). *Violation in
  this workstream would look like:* mid-warp the renderer deciding
  to lazy-load a texture the pipeline didn't carry — a reverse flow
  that would show up as a new hitch class later. Any fix that lifts
  work earlier in the warp timeline must preserve the one-direction
  flow; it is not OK to smuggle deferred work into HYPER to "pay it
  later."

- **Principle 3 — Per-Object Retro Aesthetic.** Relevant to this
  workstream specifically because the EXIT stutter's
  deceleration-profile hypothesis (H3) butts up against the post-
  warp autopilot velocity handoff. Each object — the warp camera,
  the autopilot camera — owns its own motion aesthetic. A fix that
  couples them (e.g., "autopilot starts its velocity from the
  warp's exit speed verbatim") risks bleeding warp-motion state
  into autopilot and vice versa. *Violation in this workstream
  would look like:* a cross-system "smoothing buffer" that holds
  state at the EXIT → autopilot handoff and rewrites velocity
  retroactively. The clean answer is a C1-continuous velocity
  curve expressed locally in each system, with the handoff point
  specified as a boundary condition (exit-velocity out = autopilot
  start-velocity in, both computed forward not backward).

## Drift risks

This workstream inherits the patch-loop history documented in
`docs/WORKSTREAMS/warp-hyper-dimness-2026-04-18.md` (the original
dimness workstream closed Shipped on proxy evidence) and in
`docs/WORKSTREAMS/warp-hyper-dimness-undo-2026-04-18.md`
(the un-do that fixed it). Both workstreams are recent and their
lessons are live.

Specific risks for this workstream:

- **Risk: Patching ahead of diagnosis.** The dominant drift mode.
  Working-Claude reads the three-hitch list, recognizes
  `PLAN_transition-freeze-fix.md`'s pre-spawn fix as "the answer"
  for issue #2, starts implementing it, and skips the trace
  entirely. When FOLD and EXIT are still hitching after the pre-
  spawn lands, another patch layer gets added. This is the exact
  shape of the 2026-04-18 `warp-hyper-dimness-2026-04-18` miss —
  a plausible mechanism was proposed, implemented, and shipped
  without a diagnostic check.
  **Why it happens:** the pre-spawn fix is written and reviewed;
  going straight to implementation feels efficient. The trace
  feels like ceremony.
  **Guard:** AC #7 separates diagnosis from fix commits. The
  diagnosis artifact (the Chrome DevTools trace + the brief
  update naming which hypotheses fired for which phases) lands
  before any fix commit. If working-Claude feels tempted to
  "profile and fix in one go," stop — the temptation IS the
  drift.

- **Risk: Bundling fixes into one commit.** The Director bundled
  the three issues into one workstream for diagnosis efficiency.
  It is tempting to treat the bundle as license to ship a single
  "warp perf pass" commit that mashes the three fixes together.
  **Why it happens:** "while we're in WarpEffect.js / main.js"
  energy — the classic shape.
  **Guard:** AC #7 explicitly requires fix commits separable by
  phase / AC. If a future session wants to bisect which fix
  regressed what, separable commits make that possible. If
  every fix rides on the same commit, bisection dies.

- **Risk: "Just needs one more tweak" perf drift.** Perf work is
  uniquely susceptible to this — each trace pass shows a new
  incremental opportunity, each fix reveals a smaller hitch
  previously masked, and the workstream stretches into a
  Ship-of-Theseus "warp general perf" project.
  **Why it happens:** the trace is seductive; each frame-cost
  line is optimizable.
  **Guard:** the in-scope list below is exactly the three
  observed hitches. Any new hitch found in the trace that was
  not visible to Max in the un-do recording is **out of scope**
  for this workstream — it becomes a followup. The ACs are
  sourced to what Max saw, not to the trace's sub-perceptual
  opportunities.

- **Risk: Shader compile fix that leaves the old
  `WarpEffect.js` path ambiguously live.** If the pre-spawn
  approach lands for H1, the old `warpSwapSystem` at INSIDE still
  has the build-time dispose branch in the code. A future change
  may wire a new destination type that bypasses the pre-spawn
  hook and goes through the slow path silently.
  **Why it happens:** PLAN_transition-freeze-fix Phase 4 proposed
  flag-gating the pre-spawn for A/B. Flags that survive the A/B
  window become permanent dead code and permanent failure modes.
  **Guard:** if PLAN_transition-freeze-fix Phase 1 + 2 ship, the
  A/B flag (Phase 4) is NOT part of this workstream. Pre-spawn
  is default-on or it is not committed. The A/B flag belongs to
  a separate future workstream if Max wants it for low-end
  hardware.

- **Risk: Camera velocity fix bleeds into autopilot.** If H3
  (EXIT velocity discontinuity) is the live hypothesis, the fix
  touches the HYPER → EXIT → post-warp velocity handoff. That
  handoff's other end is autopilot, and autopilot has its own
  post-warp start sequence (including the `autopilot-star-orbit-
  distance` followup Max surfaced on the un-do recording).
  Conflating the velocity fix with the orbit-distance fix pollutes
  this workstream's ACs.
  **Why it happens:** same file, same handoff.
  **Guard:** `autopilot-star-orbit-distance` is named out of
  scope below. If the velocity fix requires touching autopilot,
  touch only the velocity initial condition — not the orbit
  distance computation.

- **Risk: Static-screenshot / Playwright-filmstrip substitution
  for the Shipped-gate recording.** Perf fixes are "measurable"
  in ways visual fixes aren't — a trace showing no >100 ms block
  feels like proof. It is not the Shipped artifact.
  **Why it happens:** the trace is available mid-session and
  produces compelling-looking evidence. "Numbers pass" is
  frictionless; waiting for the agent-initiated recording is a
  few more minutes.
  **Guard:** AC #6 names the canvas-path recording as the
  Shipped artifact. The trace is the *diagnostic* evidence for
  working-Claude's reasoning; the recording is the *acceptance*
  evidence for Max's sign-off. Both are required; neither
  substitutes.

## In scope

- **Chrome DevTools Performance trace of a full warp** (FOLD →
  EXIT) with Sol as destination. Second trace with a random
  procedural destination if the first is ambiguous on any
  hypothesis. Traces captured via the MCP
  `chrome-devtools` server (preferred per
  `feedback_prefer-chrome-devtools.md`) against Max's Chrome on
  port 9223. Full user-flow entry per
  `feedback_test-actual-user-flow.md`: dev shortcut to Sol, real-
  click destination, Space ×3.
- **Trace findings section** appended to this brief by working-
  Claude naming which hypotheses fired for which phases. This is
  the "diagnosis commit" the workstream starts with.
- **Fix implementation** for whichever hypotheses fired.
  Expected cases:
  - H1 fires for INSIDE → implement PLAN_transition-freeze-fix
    Phases 1 + 2 (extract `buildSystemGPU` + `activateSystem`
    from `spawnSystem`; wire pre-spawn into `onPrepareSystem`).
    Phase 3 (cancellation cleanup) only if the trace reveals an
    abort-path bug; otherwise defer to a followup.
  - H3 fires for EXIT → edit `WarpEffect.js` EXIT update
    (L285–320) + the post-warp velocity handoff to produce a
    C1-continuous velocity curve. Minimal edit.
  - H5 fires for FOLD → edit `WarpEffect.js` FOLD update
    (L146–177) initial condition to remove the velocity-
    discontinuity hitch at warp initiate.
  - H2 fires anywhere → allocation audit of the `spawnSystem`
    disposal path; reuse typed arrays, pool meshes, or
    restructure the allocation site per what the trace reveals.
  - H4 fires for EXIT → profile the autopilot post-warp
    computation; if it's synchronous and expensive, defer to
    next animation frame via `requestAnimationFrame` or
    similar.
- **Playwright / chrome-devtools screenshot during the dev loop**
  as a self-audit step per `feedback_visual-qa-mandatory.md`.
  Not the acceptance artifact; used to confirm the fix landed
  before requesting the canvas recording.
- **Canvas-path recording of a full warp** captured via
  `~/.claude/helpers/canvas-recorder.js`, fetched via
  `~/.local/bin/fetch-canvas-recording.sh` to
  `screenshots/max-recordings/warp-phase-perf-pass-2026-04-20.webm`.
  Contact sheet + per-phase frame extraction surfaced in chat
  for Max's evaluation per `docs/MAX_RECORDING_PROTOCOL.md` §"How
  the agent verifies."
- **One diagnosis commit + one fix commit per phase** (FOLD,
  ENTER, EXIT). HYPER regression-guard AC does not need a fix
  commit if HYPER stays clean. Commit messages name the
  hypothesis that fired and the AC that closes.
- **Parent-feature `## Workstreams` update** — add this brief's
  path to `docs/FEATURES/warp.md` §"Workstreams." That section
  is PM-editable per `docs/PERSONAS/pm.md` §"Commit discipline."
- **Close at `VERIFIED_PENDING_MAX <sha>`**, wait for Max's
  evaluation of the canvas recording, then flip to
  `Shipped <sha>` per protocol.

## Out of scope

- **`warp-exit-drama-polish`** (followup #4 from the un-do
  workstream's Status block). This workstream attacks the EXIT
  *smoothness* stutter, not the *drama* Max wants more of. A
  more-dramatic exit is a distinct feature edit; it might
  re-introduce perceived speed changes by design. Separate
  workstream, separate brief.
- **`autopilot-star-orbit-distance`** (followup #5). This is an
  autopilot-domain concern, not a warp-phase concern. Director
  to route to the appropriate feature doc (autopilot / post-
  warp arrival / star orbit). If the EXIT velocity fix has to
  touch the autopilot-handoff velocity boundary condition, that
  touches only velocity — not orbit distance.
- **Tunnel wall content / starfield-papering** (the design note
  at the bottom of the un-do brief's Status — "tunnel walls will
  eventually be papered with starfield stars; non-animated;
  camera-motion produces parallax"). This is a HYPER content
  workstream, not a perf workstream. Director owns routing.
- **PLAN_transition-freeze-fix Phase 3 (cancellation cleanup)
  beyond what the trace shows is needed.** If the trace doesn't
  reveal an abort-path bug, cancellation cleanup is a future
  workstream. Abort paths matter when the player presses Escape
  mid-warp or double-Spaces — they're real but not the current
  hitch.
- **PLAN_transition-freeze-fix Phase 4 (A/B flag).** Pre-spawn
  is default-on or it isn't committed. Flag-gated A/B is a
  separate low-end-hardware workstream.
- **World-origin rebasing perf work.** `SYSTEM_CONTRACTS.md`
  §9.4 notes FP drift at large destination-system coordinates;
  the fix is `docs/PLAN_world-origin-rebasing.md`, a separate
  deferred workstream. Not this one.
- **New FPS targets or frame budgets in
  `docs/GAME_BIBLE.md` §Performance.** If the trace surfaces
  numbers that should become project-level budgets, flag for
  Director — don't silently write them into ACs here.
- **Any fix that changes the authored warp experience.** Tuning
  FOLD_DUR / ENTER_DUR / HYPER_DUR / EXIT_DUR to "hide" hitches
  by extending the visible phase is a Principle 2 violation (see
  Drift Risk above). Phase durations are authored values and
  aren't perf knobs.

## Bible / feature-doc update flags (for Director)

Director-owned edits that may follow this workstream's close. PM
flags, Director executes in a separate commit:

- **`docs/FEATURES/warp.md` §"Current state snapshot
  (2026-04-18)"** — if this workstream ships and all three
  hitches are eliminated, the ENTER snapshot line that reads
  *"weakest link. 1–2 second freeze at the initial slowdown"*
  should be revised. Suggested revision-direction (Director's
  call on phrasing): *"Post 2026-04-20 perf pass: FOLD / ENTER /
  EXIT motion continuity verified via Max-evaluated canvas
  recording. HYPER rendering is compositor-owned per §9 post-
  un-do."*
- **`docs/GAME_BIBLE.md` §11 / §Performance** — if the
  trace surfaces a numeric frame budget for warp phases that
  deserves to be a project-level invariant (e.g., "no
  synchronous JS block >100 ms during any warp phase
  transition"), flag for inclusion. Do not silently promote
  convention to principle.
- **`docs/SYSTEM_CONTRACTS.md` §9.2 callback contract** — if
  the pre-spawn approach ships, the `onPrepareSystem` row will
  need an update (it currently reads *"Non-blocking"*, which is
  still correct but its payload expands from "CPU-only data
  generation" to "CPU data + GPU resource build"). That's a
  contract edit, not a code-file edit — Director-owned.

## Handoff to working-Claude

Read this brief first. Then the Director's routing call (inline in
the invocation that spawned this brief).

Then, in order:

1. **`docs/FEATURES/warp.md` in full.** §"Phase-level criteria
   (V1)" and §"Phase sequence" are the ACs' source of truth;
   §"Current state snapshot (2026-04-18)" names ENTER as the
   primary V1 blocker; §"Failure criteria / broken states"
   names the load-timing hypothesis for the INSIDE freeze;
   §"V1 — must ship" lists seamlessness as the primary V1
   criterion.
2. **`docs/SYSTEM_CONTRACTS.md` §9 Warp in full.** §9.1 phase
   state machine, §9.2 callback contract (`onPrepareSystem` /
   `onSwapSystem` / `onTraversal` ownership), §9.3 async-
   ordering invariant (load-bearing — the pre-spawn approach
   MUST preserve this), §9.4 portal scene-anchoring, §9.5 non-
   Euclidean tunnel visibility (the mesh is cosmetic;
   compositor owns HYPER/EXIT rendering — don't regress the
   un-do), §9.6 uniform-input parity invariant (don't add
   exposure knobs).
3. **`docs/PLAN_transition-freeze-fix.md` in full.** The
   INSIDE-freeze fix proposal. If H1 fires, this is the
   implementation. Read it, then trace the current
   `spawnSystem` / `warpSwapSystem` code to verify the
   refactor's split points.
4. **`docs/WORKSTREAMS/warp-hyper-dimness-undo-2026-04-18.md`
   §Status + §Followups.** The three hitches this workstream
   attacks are named there with Max's own language. Keep his
   phrasing close; it's the ground truth for "what smooth
   means here."
5. **`docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas
   features (default)."** The agent-initiated recording
   workflow. This is the Shipped artifact path.
6. **`src/effects/WarpEffect.js`** L10–320 (the full phase
   update loop) plus L37–52 (phase durations + speed
   constants). Entry to the velocity discontinuity hypotheses
   H3 and H5.
7. **`src/effects/WarpPortal.js`** L683–704 (the INSIDE-mode
   block — now post-un-do, minimal). Context for §9.5 / §9.4
   portal anchoring.
8. **`src/rendering/RetroRenderer.js`** L420–492
   (`hyperspace()` fullscreen shader — the compositor the
   HYPER/EXIT regression-guard AC protects), L660–723 (the
   HYPER/EXIT gate).
9. **`src/main.js`** the `spawnSystem` / `warpSwapSystem` /
   `onPrepareSystem` / `onSwapSystem` / `onTraversal` wiring.
   Canonical reference at `src/main.js:447` per
   `SYSTEM_CONTRACTS.md` §9.3 (the `async onTraversal` + `await
   onSwapSystem` line). Central to H1 (shader compile) and the
   pre-spawn refactor.

Then, in order of execution:

1. **Ask Max to start Vite.** Per `feedback_no-start-servers.md`:
   *"Please restart Vite: `pnpm dev` (or `npm run dev`) in your
   WSL terminal. Then open `http://localhost:5173` in your
   Chrome with the debugging extension attached."*
2. **Run the diagnostic trace.** MCP `chrome-devtools`;
   start Performance recording; trigger the dev shortcut to
   Sol, real-click the first reachable destination, Space ×3;
   stop recording after EXIT completes. Repeat for a random
   procedural destination if any hypothesis is ambiguous.
3. **Append `## Trace findings` to this brief.** Name which
   hypotheses (H1–H5) fired for which phases with specific
   timestamps, JS block durations, and GC markers. Cite the
   source file + line where the cost lives.
4. **Commit the diagnosis.** Commit message:
   `diagnose(warp): phase perf trace — <brief-slug-
   per-hypothesis-results>`. Stage this brief only; do NOT
   stage source changes yet.
5. **Implement fixes smallest-first.** If H3 or H5 fired
   (velocity discontinuity), fix those first — they're
   single-line or single-function edits. Then H1 (pre-spawn
   refactor) if it fired. One fix commit per AC. Each commit
   message names the AC it closes and the hypothesis it
   resolves.
6. **Intra-session sanity check after each fix.** Open Chrome
   on port 9223, trigger the real warp flow, screenshot mid-
   phase to confirm the fix didn't break rendering. Not the
   Shipped artifact — a self-check per
   `feedback_visual-qa-mandatory.md`.
7. **Capture the canvas recording.** Per
   `docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas
   features (default)": install recorder helper, trigger
   full warp flow to Sol, await `stop()`, run
   `fetch-canvas-recording.sh` into
   `screenshots/max-recordings/warp-phase-perf-pass-2026-04-20.webm`.
8. **Surface a contact sheet + per-phase frames to Max.** Use
   `~/.local/bin/contact-sheet.sh` for the overview;
   `~/.local/bin/frame-at.sh` for the FOLD initiate, the
   ENTER → HYPER transition, and the HYPER → EXIT crowning
   specifically. Those are the three AC-defining moments.
9. **Close at `VERIFIED_PENDING_MAX <sha>`.** Append a `##
   Status` section to this brief. Max evaluates the recording
   against ACs #1–#5. On his pass, flip to `Shipped <sha> —
   verified against <recording-path>` with a one-paragraph
   summary per AC. On a fail, leave status pending and
   escalate — a remaining hitch may be a different
   hypothesis than the trace caught first.

Artifacts expected at close: one diagnosis commit with trace
findings; one fix commit per fired hypothesis (1–3 commits);
parent feature doc `## Workstreams` section updated; this brief
updated with `## Trace findings`, `## Fix narrative` (what was
done per AC), and `## Status` flipping `VERIFIED_PENDING_MAX` →
`Shipped`; canvas recording on disk at the drop path; contact
sheet in chat for Max.

**If any fix feels like "just needs one more tweak," stop and
escalate.** The dimness-workstream lesson sits in that sentence.
Perf work is especially susceptible to this — each trace reveals
the next opportunity. The in-scope list is exactly the three
hitches Max saw in the un-do recording; new hitches the trace
surfaces that were not user-visible become followups, not this
workstream's problem.

## Status

Brief authored 2026-04-20 by PM. Ready for working-Claude
execution pending Director audit.
