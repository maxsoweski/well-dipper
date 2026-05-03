# Workstream: rebase-celestial-frame-fix-2026-05-03

## Status

**Shipped `97c64e9` — Tester §T1 PASS at 97c64e9.**

3 captures totaling 11,543 samples; 0 rebase-band `approachPhaseInvariant`
violations (pre-fix baseline: 145). Max distance discontinuity at
rebase events: 1.55 units (pre-fix signature: ~99 units). Audit log:
`~/.claude/state/dev-collab/tester-audits/rebase-celestial-frame-fix-2026-05-03.md`.

Originally scoped 2026-05-03 by PM at HEAD `f284ce0` (post-kit-Shipped).
Surfaced by the motion-test-kit dogfood — first production catch by
the kit. Kit's lifecycle on this bug: surface → quantify → localize →
verify-fix, all via predicates.

Post-fix verification: `screenshots/diagnostics/rebase-celestial-interaction-2026-05-03/POST-FIX-VERIFICATION.md`.

## Parent feature

`docs/FEATURES/autopilot.md` — closest available feature surface. The bug
shows itself most acutely during autopilot CRUISE (Max's report: "visible
jittering of planets while autopilot CRUISE is active … camera intermittently
ends up inside or coincident with the target body"), and the dogfood capture
that diagnosed the bug is an autopilot-driven trace. But the underlying defect
is in shared infrastructure (`src/main.js` celestial update + `src/objects/Moon.js`),
not in autopilot logic — autopilot is a victim, not a cause.

**Doc-gap continues.** `docs/WORKSTREAMS/realistic-celestial-motion-2026-04-27.md`
§"Parent feature" already flagged that a dedicated `docs/FEATURES/celestial-motion.md`
would be the right home for this surface — *"the orbit/rotation pipeline is shared
infrastructure … the settings slider it ships is a system-wide control, not
autopilot-only."* This fix workstream re-confirms the gap rather than closes
it. PM does NOT propose creating `celestial-motion.md` as part of this scope —
the fix is mechanical and small; a new feature doc bootstrapped under fix
pressure would be a thin doc that doesn't pay back the authoring effort.
Working-Claude flags the gap to Max at workstream close (parking-lot item)
so a future scoping conversation can treat it as the doc-altitude work it is.

## Implementation plan

N/A (workstream-sized). The fix is a four-site mechanical edit; the verification
path is a single kit-predicate run against a re-captured dogfood. The §"In scope"
section enumerates the work.

## Scope statement

Reconcile `WorldOrigin` rebasing with the realistic-celestial-motion per-frame
position writes. Four sites in well-dipper write **absolute world coordinates**
to body meshes each frame; when `maybeRebase()` fires, those writes overwrite
the rebase shift on the very next frame, leaving camera (at rebased origin)
and bodies (at un-rebased absolute coords) in inconsistent coordinate frames
between rebase events. The fix subtracts `worldOrigin` (or routes through
`fromWorldTrue`) at each write site so positions land in the current rebased
frame. Verification is a re-run of the motion-test-kit's `approachPhaseInvariant`
predicate against a fresh dogfood capture: pre-fix produces 145 violations;
post-fix expectation is 0 (or small-N if there are real autopilot pursuit
overshoots distinct from rebase artifacts).

This is a single workstream because the four sites share one bug class — they
all forgot that `mesh.position.set(absX, absY, absZ)` is now meaningful only
in the un-rebased true-world frame, and the renderer reads positions in the
rebased local frame. Fixing them as a unit keeps the audit complete; splitting
risks shipping a partial fix where three of four sites are correct and the
fourth re-introduces the violation under a different scenario. The verification
is one predicate run against one capture protocol, so the unit-of-work shape
matches the unit-of-verification shape.

**This is a coordinate-frame bug, not a kinematic one.** Bodies' MOTION
(orbital math: angle, radius, Kepler scaling, tidal locking, jitter) is
correct. The orbital math produces the right positions in the un-rebased
true-world frame. Only the FRAME those positions are written to is wrong:
they should land in the rebased local frame because the renderer's camera
is at the rebased origin. The fix does not touch any orbital math — it
inserts one subtract per write site. Resist any urge to "improve the orbit
math while we're here"; that's scope creep, and the orbital math is exactly
what `realistic-celestial-motion-2026-04-27.md` Shipped 6 days ago.

## How it fits the bigger picture

Two Game Bible §11 principles intersect here, plus the §"Scope discipline —
feature before economy" PM guard.

This fix is the residue of a seam between two recently-Shipped workstreams
that didn't know about each other:

- `realistic-celestial-motion-2026-04-27` (Shipped `a89e454`) added per-frame
  body position writes through the celestial-time multiplier. Those writes
  use absolute world coordinates because at authoring time, "world coordinates"
  meant the same thing as "scene coordinates."
- `world-origin-rebasing-2026-05-01` (Shipped `e3504a1`) decoupled world
  coordinates from scene coordinates. After rebasing, scene coordinates are
  rebased-local; world coordinates are accumulated in `worldOrigin`. The
  rebasing audit's `Plan §"Touch list"` enumerated places where cached world
  positions had to be reconciled — but per-frame scene-graph writes from
  generation-driven orbit math weren't on that list because they're not
  *cached* values; they're produced fresh every frame. The rebase loop
  shifts them once on the rebase frame, then they get overwritten on every
  subsequent frame by the un-rebased orbital math.

The bug is exactly the §"Risks / gotchas" risk that the rebasing brief named
under Drift Risk #2 — *"Cached world-position drift in camera controllers /
shader uniforms / target Vector3s"* — but generalized one level: a per-frame
*producer* of world-position writes, not a one-time cached value. The audit
caught the cached-value class; this is the producer-class equivalent.

Advances **Game Bible §10 Scale System / Precision ceiling.** The rebasing
fix shipped two days ago promised float32 precision regardless of where in
the world the camera drifts. That promise holds for the camera and for cached
controller state. It silently doesn't hold for orbital body positions because
of this seam. Closing the seam is what makes Bible §10's "Shipped" status
honest at the body-position layer.

Advances **Game Bible §11 Principle 2 — No Tack-On Systems.** The fix lives
at the right layer: the four write sites that actually produce the wrong
frame, each routed through the rebasing module's existing primitives
(`worldOrigin` or `fromWorldTrue`). It does NOT live as a wrapper around
`maybeRebase` that re-shifts bodies post-update (which would be a tack-on
in the rebase module), nor as a "celestial-motion-aware" rebase variant
(which would tightly couple the two systems).

## Acceptance criteria

ACs are split by class per `docs/REFACTOR_VERIFICATION_PROTOCOL.md` "Which
path applies." This is mixed-class:

- **Invariant-class on the bug surface.** The bug is an invariant violation
  (camera-target distance jumps non-physically on rebase frames). The kit's
  `approachPhaseInvariant` predicate is the natural gate per
  `docs/PERSONAS/tester.md` §"Motion-class verification — kit usage" + its
  vocabulary table entry: *"approach-phase invariant: d_target non-increasing"
  → `approachPhaseInvariant`*. This is the kit's first production usage.
- **Refactor-class on the unchanged surfaces.** Orbital body trajectories
  in their reference frame must be unchanged: Kepler scaling, tidal locking,
  and per-body jitter coefficients are not touched. Telemetry-equivalence
  per `docs/REFACTOR_VERIFICATION_PROTOCOL.md`.

### Bug-fix verification — invariant-class via motion-test-kit

1. **AC #1 — `approachPhaseInvariant` regression gate.** Re-running the
   motion-test-kit `approachPhaseInvariant` predicate against a fresh
   dogfood capture (same protocol as
   `screenshots/diagnostics/rebase-celestial-interaction-2026-05-03/dogfood-samples-v2-slim.json`,
   captured at HEAD with the fix landed, options `{ phaseStart: 0,
   phaseEnd: samples.length, eps: 0.5 }`) returns **either 0 violations or
   only violations whose `distDelta` is structurally distinct from rebase
   events** (i.e., NOT clustered at ~99 units = `√REBASE_THRESHOLD_SQ`).
   Pre-fix baseline: 145 violations, with the largest 9 of the top 10 all
   at `distDelta ≈ 99` (frame 4250's `distDelta = 1523.91` is a STATION
   arrival, not a rebase artifact, and is allowed to remain).

   **Tester verifies** by:
   - Capturing a fresh dogfood-equivalent sample stream at fixed HEAD
     (autopilot-driven Sol tour matching the existing capture's protocol).
   - Running `approachPhaseInvariant(samples, { phaseStart: 0, phaseEnd:
     samples.length, eps: 0.5 })`.
   - Asserting either zero violations OR all remaining violations have
     `distDelta` outside the band `[95, 105]` (the rebase-event signature).
   - Counting violations in the rebase band as a hard FAIL — that is the
     bug class this AC is gating against.

2. **AC #2 — Camera-target distance continuous across rebase events.**
   Same fresh capture as AC #1. For every frame `i` where a rebase event
   fires (detectable by camera position magnitude crossing the rebase
   threshold between frame `i-1` and frame `i`), the camera-target distance
   must be continuous within FP noise: `|distance[i] - distance[i-1]| <
   max(velocity[i-1] × dt[i], 0.01)` where `velocity[i-1]` is the
   ship/anchor velocity at the previous frame. The pre-fix capture
   demonstrates this fails — Frame 67 jumped distance from 1422.97 to
   1522.93 (delta of 99.96) on a single rebase event, while ship velocity
   could not have produced a >1 unit delta in one frame at autopilot
   CRUISE speeds.

   **Tester verifies** by detecting rebase frames in the capture (compare
   `anchor.lengthSq()` between consecutive frames; a >`50²` drop signals
   a rebase) and asserting the continuity bound at each rebase frame.

3. **AC #3 — `worldOrigin` magnitude grows during the capture.** Sanity
   check that the test scenario actually exercises rebase events. The
   capture must include at least one frame where `worldOrigin.lengthSq()
   > 0` (i.e., at least one rebase has fired). Without this, the test
   doesn't exercise the bug class — a regression could land trivially
   "PASSing" against a capture that never crossed the rebase threshold.

   **Tester verifies** by reading `worldOrigin.lengthSq()` from the live
   `_debugState()` accessor at end of capture, asserting > 0. The dogfood
   capture protocol drives autopilot long enough that this is guaranteed
   in practice; the AC makes it explicit.

### Refactor-class — orbital math unchanged

4. **AC #4 — Body trajectories in the un-rebased true-world frame are
   unchanged from pre-fix behavior.** Capture a frozen-input lab-harness
   trace (no real-time autopilot — seeded RNG, deterministic initial
   state, fixed-step `update(dt)` loop) over N frames. For each frame,
   compute every body's true-world position as
   `mesh.position.clone().add(worldOrigin)`. Pass condition: every
   per-body, per-frame world-true position is within `1e-6` epsilon of
   the same trace captured at the pre-fix HEAD (motion-test-kit Shipped
   commit). The frame range must include at least one rebase event so
   the test exercises the seam.

   **Tester verifies** via the project's `tests/refactor-verification/`
   harness pattern (`docs/REFACTOR_VERIFICATION_PROTOCOL.md`). If a
   harness for celestial-motion telemetry doesn't exist yet, working-Claude
   creates one at `tests/refactor-verification/rebase-celestial-frame-fix.html`
   following the prior project convention. Frozen-input requirements per
   the protocol's "Input-freezing checklist": seeded RNG, explicit camera
   start position chosen to cross the rebase threshold within the capture
   window, fixed-step `update(dt)` loop with `dt = 1/60`, no real-time
   simulation.

   This AC catches the failure mode where the fix accidentally changes
   orbital math (e.g., subtracting `worldOrigin` somewhere upstream of
   the position computation rather than at the write site, which would
   double-shift the body relative to its parent or break Kepler).

### Diagnostic deliverable

5. **AC #5 — Pre/post comparison artifact saved alongside the analysis
   doc.** Working-Claude writes a `POST-FIX-VERIFICATION.md` next to
   `screenshots/diagnostics/rebase-celestial-interaction-2026-05-03/ANALYSIS.md`
   that captures the AC #1 + AC #2 numerical comparison: pre-fix violation
   count + violation table (already in the analysis doc), post-fix violation
   count + table, and the rebase-frame-continuity numbers from AC #2 for
   the first 5 rebase events post-fix. This is the audit-trail artifact
   confirming the fix actually fixed the diagnosed bug — for archaeology
   on the next fix in this seam-class.

## Principles that apply

From Game Bible §11 Development Philosophy. The PM "Scope discipline" rule
also applies as a meta-principle for this brief.

- **Principle 2 — No Tack-On Systems.** *Load-bearing.* The natural reflex
  on a coordinate-frame bug is to add a wrapper somewhere — a
  `maybeRebaseAfterCelestial()` helper that re-shifts bodies after the
  orbital update, or a "celestial-aware" branch inside `maybeRebase` that
  knows about the body-write sites. Both are tack-ons: they live in the
  rebase module but are coupled to a specific producer (celestial motion)
  in a way that obscures the actual contract. The contract is:
  *every per-frame producer of `mesh.position.set(...)` calls writes in
  the rebased local frame.* The fix lives at the four producer sites,
  each subtracting `worldOrigin` (or routing through the `fromWorldTrue`
  primitive `WorldOrigin.js` already exports for exactly this purpose).
  Violation in this workstream looks like: any change to `WorldOrigin.js`
  itself, any new helper named `rebaseCelestialBodies`, any wrapper
  around the orbital update in `main.js` that does coordinate translation
  outside the four named write sites.

- **Principle 6 — First Principles Over Patches.** *Load-bearing.* This
  bug has a clear first-principles read: rebasing is a coordinate-frame
  transform, and any code writing world-frame positions to the scene-graph
  must transform through it. The patches-instead-of-principle alternative
  would be: tune `REBASE_THRESHOLD_SQ` higher so rebases fire less often
  (hides the symptom), or special-case the bodies that "look bad" while
  leaving the other write sites silently broken (fragments the fix).
  Either would work in the immediate test scenario and re-emerge under
  any future condition that pushes camera coordinates further from origin
  or adds a new body class. The fix in this workstream is the principled
  shape: *every producer transforms; the transform is a one-line subtract;
  no producer is a special case.* Violation looks like: any change to
  `REBASE_THRESHOLD_SQ`, any "fix" that papers over the symptom by
  changing rebase fire frequency, any per-body workaround at a single
  site instead of the full audit across all four.

- **PM "Scope discipline — feature before economy."** *Meta-principle for
  brief shape.* The economical instinct on this bug is "land a one-line
  fix at the most-visible site (the moon, since Max saw moon jitter most
  clearly), ship, move on." That's the wrong shape: the bug is structural
  (four sites, one bug class), and a one-site fix would silently leave
  three other producers in the broken state. Production AC fix shape
  matches the bug class — one workstream, four write sites, one verification
  predicate that captures the invariant they all violate. This is the same
  stance the OOI brief took (per the personas doc): scope tracks what the
  fix actually needs, not what's cheapest.

(Principles 1, 3, 4, 5 not at risk: hash-grid work isn't touched; the
retro aesthetic isn't touched; BPM-sync isn't touched; the model→pipeline→renderer
direction is preserved by virtue of the fix being a transform at the renderer
boundary, not a model-side rewrite.)

## Drift risks

- **Risk — One site missed in the audit.** Working-Claude fixes three of
  the four sites and ships. The fourth (most likely the planet-class moons
  in `main.js:6033-6041`, since it's the only sub-case nested inside another
  loop) keeps writing absolute coordinates; bodies of that class re-introduce
  the violation in their own scenarios.
  **Why it happens:** The four sites are scattered across two files, and
  the planet-class moon path is structurally less prominent than the
  primary planet/moon paths. The mind's-eye edit is "fix the planet write
  + fix the moon write"; the planet-class moon and the binary-star pair
  are easy to skip on first pass.
  **Guard:** AC #1's predicate runs against a capture that includes
  binary stars and planet-class moons in its scenario. The dogfood capture
  protocol used `dogfood-samples-v2-slim.json` against Sol; the post-fix
  capture should run a scenario that exercises all four classes (one
  binary system, one system with planet-class moons, plus standard moons
  and planets). Alternative: a static grep gate — `grep -n
  "mesh.position.set" src/main.js src/objects/Moon.js | wc -l` should
  return ≥4 (and each match should be visible to surround `worldOrigin`
  or `fromWorldTrue` in a 2-line context). Working-Claude documents the
  grep result in the commit message.

- **Risk — `worldOrigin.y` term included or excluded inconsistently.**
  The analysis doc's example shows `mesh.position.set(px - worldOrigin.x,
  -worldOrigin.y, pz - worldOrigin.z)` for the planet site — i.e., the
  Y component subtracts `worldOrigin.y` even though planet orbits are
  in the XZ plane (Y component is 0 in the un-rebased frame). This is
  correct: in the rebased frame, Y must include the rebase Y-offset.
  But the inconsistency between sites that include the Y rebase and
  sites that don't would silently put bodies at the wrong Y when the
  camera has Y drift in `worldOrigin`.
  **Why it happens:** Visual inspection makes "Y is always zero in the
  XZ-plane orbit" feel safe; subtracting `worldOrigin.y` looks redundant.
  It isn't — it's required, and missing it on one site asymmetrically
  shifts that body's rendered position relative to others.
  **Guard:** Use `fromWorldTrue` at every site rather than inlining the
  per-component subtract. The helper is exported from `WorldOrigin.js`
  for exactly this purpose, eliminates the case-by-case judgment, and
  makes the fix mechanically uniform. AC #4's telemetry comparison
  catches this if a site ends up Y-asymmetric (every body's true-world
  position must match pre-fix). Verify-step: the four post-fix sites
  should have either *zero* explicit `worldOrigin.x/y/z` references
  (all routed through `fromWorldTrue`) OR all three components
  consistently — not a mix.

- **Risk — Fix collides with future fixed-timestep migration.** The
  Path-B fixed-timestep migration (`docs/WORKSTREAMS/welldipper-fixed-timestep-migration-2026-05-03.md`,
  not yet started per Tester persona §"Pre-migration limit") will rework
  the animate-loop ordering. If this fix bakes assumptions about the
  loop's current ordering of `maybeRebase()` vs. orbital updates, it
  could regress under the migration.
  **Why it happens:** "Subtract `worldOrigin` at the write site" is
  loop-ordering-independent — the value of `worldOrigin` at the write
  site is whatever it currently is, regardless of when `maybeRebase`
  fired. So this fix is naturally migration-safe. But if working-Claude
  defensively reorders `maybeRebase()` calls or adds a "before celestial
  update" wrapper, that's exactly the kind of side-effect the migration
  workstream would have to unwind.
  **Guard:** This workstream does NOT touch `WorldOrigin.js` or the
  animate-loop ordering. The four edits are mechanical: import +
  per-site subtract. No structural changes. AC #4 fixed-step harness
  also serves as future migration substrate — the harness's frozen-input
  pattern is the same shape the migration will use.

- **Risk — Tester runs predicate without exercising rebase events.** AC
  #1's predicate returns "0 violations" trivially if the test scenario
  never crosses the rebase threshold (e.g., a short capture starting
  near origin and not moving far). Test passes; bug is unfixed for any
  scenario that does cross the threshold.
  **Why it happens:** The dogfood capture protocol that produced the
  diagnosis was an autopilot-driven Sol tour run for long enough to
  accumulate ~98 rebase events. A short or trivial test capture wouldn't
  reproduce that. The predicate is silent about whether its input
  exercises the bug class.
  **Guard:** AC #3 asserts `worldOrigin.lengthSq() > 0` at end of capture,
  forcing the test scenario to exercise at least one rebase event. AC #1's
  numerical bound (no violations clustered at ~99 units) is also
  meaningful only if rebase events fired — so AC #3 is a meta-guard.

## In scope

- Edit `src/main.js:5998-6003` — binary star pair orbital position write.
  Route through `fromWorldTrue` (or per-component subtract `worldOrigin`).
- Edit `src/main.js:6011` — primary planet orbital position write.
  Route through `fromWorldTrue`.
- Edit `src/main.js:6033-6041` — planet-class moon orbital position write
  (special-case in main.js, not Moon.js). Route through `fromWorldTrue`.
  Note that this site adds the parent planet's already-rebased position
  to the moon's local orbit offset; the rebase subtract should land on
  the absolute world coordinate, not the parent-relative offset. Working-
  Claude verifies the algebra at this site since it's the only site with
  a parent-relative addend.
- Edit `src/objects/Moon.js:589` — standard moon orbital position write.
  Route through `fromWorldTrue`. Same parent-position consideration as
  the main.js planet-class-moon site.
- Add `import { fromWorldTrue } from '../core/WorldOrigin.js'` (or relative
  path equivalent) to `src/main.js` and `src/objects/Moon.js`.
- Add a scratch `THREE.Vector3` per file to avoid per-frame allocation
  inside the helper call.
- Capture a post-fix dogfood sample stream, save the slim form alongside
  the analysis doc.
- Author `tests/refactor-verification/rebase-celestial-frame-fix.html`
  per AC #4: frozen-input harness driving N frames across a rebase
  boundary, exporting per-frame per-body world-true positions.
- Write `screenshots/diagnostics/rebase-celestial-interaction-2026-05-03/POST-FIX-VERIFICATION.md`
  per AC #5: pre/post numerical comparison and continuity numbers for
  the first 5 rebase events.

## Out of scope

- **Any change to `src/core/WorldOrigin.js`.** The fix uses the existing
  primitives. Re-shaping the rebase API is a separate workstream if it
  ever becomes warranted.
- **Any change to `REBASE_THRESHOLD_SQ`.** Tuning the threshold to fire
  rebases more or less often does not address the bug class; it only
  changes how often the symptom is visible. The pre-fix code is broken
  at any threshold value > 0.
- **Any change to celestial-motion's orbital math.** Kepler scaling, tidal
  locking, jitter coefficients, the realism factors, the
  `celestialTimeMultiplier` slider — all unchanged. The Shipped contract
  of `realistic-celestial-motion-2026-04-27` stays exactly as-is.
- **The Path-B fixed-timestep migration.** Owned by
  `docs/WORKSTREAMS/welldipper-fixed-timestep-migration-2026-05-03.md`.
  This fix is migration-safe (loop-ordering-independent) and does NOT
  preempt the migration's scope.
- **Audit of OTHER per-frame producers of world-position writes.** The
  four sites named are the celestial-motion producers. There may be
  other producers in the codebase (warp portal positioning, autopilot
  station-keeping target updates, etc.) — those aren't currently failing
  the diagnosed bug class but could harbor the same producer-class
  failure. Out of scope for this workstream; if one surfaces under
  another scenario, it gets its own fix workstream. Working-Claude does
  NOT preemptively grep the codebase for `mesh.position.set` and audit
  every site — that's scope creep against the diagnosed bug.
- **Bootstrapping `docs/FEATURES/celestial-motion.md`.** Doc-altitude
  work, not fix-altitude. PM flags as parking-lot for a future scoping
  conversation; not in this workstream's scope.
- **Pushing motion-test-kit submodule URL fix.** Working-Claude is paused
  at the push step on the prior motion-test-kit-2026-05-02 workstream
  because the submodule URL is `file://` (local). That decision (gh repo
  create vs. vendor copy vs. wait) is independent of this fix and does
  NOT block local verification — AC #1's kit-predicate run executes
  against the local submodule path without any deploy push.

## Handoff to working-Claude

Read first, in order:
1. `screenshots/diagnostics/rebase-celestial-interaction-2026-05-03/ANALYSIS.md`
   — root cause, evidence chain, fix sites, fix shape. The bug, the mechanism,
   and the four-site map are all here. PM does not duplicate them in this brief.
2. `src/core/WorldOrigin.js` — `worldOrigin`, `maybeRebase`, `fromWorldTrue`.
   Use `fromWorldTrue` at each fix site rather than inlining per-component
   subtracts (per Drift Risk #2).
3. `docs/PERSONAS/tester.md` §"Motion-class verification — kit usage" — the
   kit invocation pattern AC #1 verifies against. This workstream is the kit's
   first production usage post-Shipped, so the verification pattern is being
   exercised end-to-end for the first time.
4. The pre-fix capture at `screenshots/diagnostics/rebase-celestial-interaction-2026-05-03/dogfood-samples-v2-slim.json`
   — baseline that the post-fix capture compares against (145 violations,
   top-10 distance jumps as listed in the analysis doc).

Avoid: any change to `src/core/WorldOrigin.js`, any change to
`REBASE_THRESHOLD_SQ`, any change to celestial-motion's orbital math.
Resist scope creep into "while I'm here, audit other `mesh.position.set`
producers" — the four sites named in the analysis are the diagnosed bug;
other sites are out of scope.

Verification structure:
- AC #1, #2, #3 — invariant-class via motion-test-kit predicates against
  a fresh dogfood capture.
- AC #4 — refactor-class telemetry-equivalence on body trajectories in
  the un-rebased true-world frame; harness lives at
  `tests/refactor-verification/rebase-celestial-frame-fix.html`.
- AC #5 — diagnostic deliverable (POST-FIX-VERIFICATION.md) saved next
  to the analysis doc.

Tester invocation: `Agent(subagent_type="tester", model="opus")` after the
fix lands and the capture/harness/diagnostic deliverable are in place.
Tester reads this brief + the diff, runs the predicates, renders verdict.
Per `docs/PERSONAS/tester.md`, the kit's `approachPhaseInvariant` is the
named predicate for this AC vocabulary class — Tester does NOT substitute
ad-hoc telemetry as the gate.

"Done" looks like: four mechanical edits across two files (each routed
through `fromWorldTrue`), `import` added to both files, scratch Vector3s
allocated, post-fix dogfood sample stream captured and saved, refactor
harness committed, POST-FIX-VERIFICATION.md written, Tester PASS at
the resulting commit. On Tester PASS, status flips to
`VERIFIED_PENDING_MAX <commit-sha>` and waits for Max's evaluation pass
(autopilot Sol tour live in the dev tab — this is a screensaver-loop
scenario, no canvas recording needed per `feedback_skip-recording-when-live-loop.md`;
Max watches for the absence of body jitter and the absence of camera-inside-body
events). On Max's PASS, flip to `Shipped <commit-sha> — verified via kit
predicate + Max live-tab evaluation` and clear the active-workstream
pointer for well-dipper via
`~/.claude/state/dev-collab/clear-active.sh well-dipper`.

After Shipped, working-Claude can resume the motion-test-kit submodule
URL decision (gh repo create vs. vendor copy vs. wait) as a separate
concern — that decision was paused mid-push on the prior workstream and
is unaffected by this fix.

## Cross-references

- `screenshots/diagnostics/rebase-celestial-interaction-2026-05-03/ANALYSIS.md`
  — root-cause analysis (the source of this brief).
- `docs/WORKSTREAMS/world-origin-rebasing-2026-05-01.md` — the rebasing
  workstream whose audit didn't catch the producer-class case (because
  it's not a cached-value class).
- `docs/WORKSTREAMS/realistic-celestial-motion-2026-04-27.md` — the
  workstream that authored the per-frame body position writes the fix
  edits.
- `docs/WORKSTREAMS/motion-test-kit-2026-05-02.md` — the kit whose
  predicate is the AC #1 gate; this fix is the kit's first production
  bug catch.
- `docs/PERSONAS/tester.md` §"Motion-class verification — kit usage"
  (added 2026-05-03) — kit invocation pattern.
- Game Bible refs: §10 Scale System / Precision ceiling (the substrate
  this fix makes honest at the body-position layer); §11 Development
  Philosophy — Principles 2, 6.
- Memory: `feedback_refactor-telemetry-over-video.md` (telemetry-class
  shape applies to AC #4); `feedback_skip-recording-when-live-loop.md`
  (Max evaluates live tab, not a recording, since the bug is loop-class).

## Doc-gap note (parking-lot)

`docs/FEATURES/celestial-motion.md` does not exist. The
realistic-celestial-motion-2026-04-27 brief flagged the gap; this brief
re-confirms it without closing it. Future scoping conversation: a
celestial-motion feature doc would parent (a) the realistic-celestial-motion
shipped behavior, (b) this fix, (c) any future per-system-multiplier
scope, (d) the parking-lot per-moon authored rotation. Recommended
trigger: next time the celestial-motion surface gets a feature-altitude
addition (not a fix), bootstrap the feature doc as part of that work
rather than under fix pressure.
