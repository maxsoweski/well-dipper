# Workstream: World-origin rebasing (2026-05-01)

## Status

VERIFIED_PENDING_MAX `e3504a1` (2026-05-01).

Tester §T4 PASS for all directly-verifiable ACs (#5, #7, #8, #9, #10, #11)
at `e3504a1`. AC #5 quantitatively confirmed: idle-portal world-true drift
of 5.80×10⁻⁷ scene units across 200 rebase events vs. camera world-true
drift of 1.88×10⁷ — drift ratio 3.09×10⁻¹⁴, fourteen orders of magnitude
below the "follows camera" threshold. AC #7 + AC #8 spot-check confirms
no controller-cache drift across rebase events. AC #9 harness scenarios
both PASS at 0 field-invariance diff.

Pending Max recording evaluation for ACs #1, #2, #3, #4, #6:
- `screenshots/max-recordings/world-origin-rebasing-warp-from-sol-2026-05-01.webm`
- `screenshots/max-recordings/world-origin-rebasing-warp-from-far-2026-05-01.webm`

§T4 caveat: AC #6 (Stage 2 alignment slerp visibly reorients camera) was
state-inspection-inconclusive. While evaluating the recordings, watch the
Stage 2 → Stage 3 window (~1.5 s before FOLD begins) specifically for
visible camera reorientation toward the warp direction. If the warp begins
with camera still in its Stage 1 orientation, AC #6 is failing — needs
follow-up investigation of `_portalLabAlignTargetQuat` capture at
`src/main.js:5460–5467` (whether it's reading a stale or null
`warpTarget.direction`, possibly a lifecycle interaction with the autopilot
tour).

Workstream history: greenlit by Max 2026-05-01 after diagnosis of the warp
regression on `7c80c94` showed the precision ceiling had crossed from
"deferred" to "blocking V1 warp" in practice. Implementation reference is
`docs/PLAN_world-origin-rebasing.md`, previously deferred per
`memory/well-dipper-rebasing-plan.md` and the Bible §10 "Precision ceiling
(deferred work)" note (now Shipped per AC #10).

## Parent feature

`docs/FEATURES/warp.md` — primary feature impacted. Rebasing exists to
serve the warp's "seamless = motion continuity" criterion at any test-start
position in the system, not only positions near scene origin.

Secondary features the rebase touches but does not change behaviorally:
`docs/FEATURES/autopilot.md` (Shipped V1 at `7c80c94`), the in-system
screensaver loop, and any in-system rendering where camera position can
drift from origin. These are refactor-class surfaces — telemetry-equivalent
pre/post.

## Implementation plan

`docs/PLAN_world-origin-rebasing.md` — canonical plan. Authored when
rebasing was deferred; treated here as the implementation reference. The
plan's "Touch list" (definitely affected / potentially affected / not
affected) is the audit checklist for this workstream. The plan's "Risks /
gotchas" section enumerates the known failure modes; the brief's drift
risks below are a subset re-anchored to this workstream's verification
structure.

## Scope statement

Implement world-origin rebasing as specified in
`docs/PLAN_world-origin-rebasing.md`: every frame past a threshold,
subtract the camera's world position from every position-tracked object in
the scene and reset the camera to `(0, 0, 0)`, accumulating the offset in
a `worldOrigin` Vector3 that any code needing "true" world position reads.
The unit of work is the rebase loop itself plus the audit-and-fix pass
across the plan's touch list, gated by per-frame telemetry-equivalence on
unchanged surfaces (autopilot, body positions, orbit math) and
canvas-recorded warp evidence at multiple test-start positions to confirm
the warp's authored experience renders correctly regardless of where in
the system it begins.

This is a single workstream because the rebase loop and the per-system
audit are mutually load-bearing — landing the loop without auditing the
touch list produces visible teleports at rebase time; auditing without
landing the loop is no-op work. Splitting into "loop now, audit later"
risks the audit being indefinitely deferred while the symptom looks
fixed in low-coordinate test cases (which is the same trap that hid this
bug from `6d0f957` until 2026-05-01).

## How it fits the bigger picture

Rebasing is the precision-substrate fix the Bible §10 Scale System has
named as deferred work since the dual-scale system landed (`6d0f957`).
Per the Bible: *"Float32 (~7 sig figs) limits ship-scale precision when
world coordinates grow large. … Required before ship combat, docking,
on-foot, or landing features ship."* The session's diagnosis showed the
precision ceiling has crossed from "deferred" to "blocking V1 warp" in
practice — per-frame camera motion during FOLD/ENTER (5e-10 scene units)
is seven orders of magnitude below float32 precision at world coord
~32,000 (~4e-3 scene units), so `camera.position.addScaledVector` rounds
to zero every frame and the camera never approaches the portal. The warp
state machine fires correctly; the camera just doesn't move.

Rebasing advances:

- **§1 Vision / The Warp as Sacred Experience** — the warp's seamless
  motion continuity must hold at any test-start position, not only near
  origin. Without rebasing, the warp's authored experience silently
  degrades the longer a session runs (or the further the screensaver's
  autopilot drifts the camera).
- **§10 Scale System / Precision ceiling** — the named deferred work
  becomes done work. Removes the "required before X / Y / Z" gating
  language from future feature scoping.
- **§11 Development Philosophy / Principle 2 (No Tack-On Systems)** —
  the precision-substrate fix lives at the right layer (a per-frame
  scene-graph rebase + accumulated `worldOrigin`), not at the warp
  layer (e.g., a "warp-only" camera reset hack that papers over the
  symptom while leaving the root for combat / docking / on-foot to
  re-encounter).

## Acceptance criteria

ACs are split by contract per
`docs/REFACTOR_VERIFICATION_PROTOCOL.md` "Which path applies":

- Surfaces whose contract is **zero behavioral change** (autopilot, body
  positions, orbit math, in-system screensaver) → telemetry-equivalence.
- Surfaces whose contract is **change** (warp visible behavior, portal
  pinning, alignment slerp) → canvas-recording at multiple test-start
  positions, Max-evaluated.

Phase-sourced ACs cite `docs/FEATURES/warp.md` §"Phase-level criteria
(V1)" verbatim per the PM "Per-phase AC rule" — each warp phase the
post-rebasing camera traverses has its own AC.

### Warp behavior — canvas-recording, Max-evaluated

1. **FOLD — "portal visually reads as gravitational lensing / space-time
   bending. Tunnel is visible through the 2D opening. Portal stays locked
   in world-space ~500m ahead of the ship (not screen-locked)"** (per
   `docs/FEATURES/warp.md` §"Phase-level criteria (V1)"). Verified at
   **two test-start positions:** (a) Sol origin warp to a target star, and
   (b) a warp begun from a position ≥10,000 scene units from origin
   (reachable by warping once from Sol then initiating a second warp
   without resetting). Both must show portal visible and camera approaching
   it during FOLD. Fixes the diagnosed regression where camera position
   was frozen for the full 5+ s of FOLD + ENTER at world coord ~32,000.

2. **ENTER — "both-visible partial-in moment occurs cleanly. Camera
   continuous through threshold. No sudden position change"** (per
   `docs/FEATURES/warp.md` §"Phase-level criteria (V1)"). Verified at the
   same two test-start positions. The
   threshold-crossing must fire (`traversalMode` transitions from
   `OUTSIDE_A` to `INSIDE`) — the diagnosed regression had this stuck at
   `OUTSIDE_A` for the full ENTER phase because the camera never closed
   the distance to the portal.

3. **HYPER — "tunnel geometry is cylindrical and extends into distance.
   Starfield tunnel (not sphere interior). Destination visible at the far
   end at some point during HYPER"** (per `docs/FEATURES/warp.md`
   §"Phase-level criteria (V1)"). Verified at the same two test-start
   positions. Rebasing must not regress the existing HYPER compositor
   experience (see warp.md §"Current state snapshot (2026-04-18) HYPER" —
   the post-`0cb717c` un-do baseline).

4. **EXIT — "crowning transition, camera continuous, end state is flying
   in the destination system"** (per `docs/FEATURES/warp.md` §"Phase-level
   criteria (V1)"). Verified at the same two test-start positions. EXIT
   crowning must occur and camera must end up in the destination system's
   coordinate frame correctly — the post-warp `onSwapSystem` teleport must
   set the rebased camera + `worldOrigin` such that destination-system
   bodies render at the right scene-space distances.

5. **Idle portal does NOT follow camera** (Max's session observation #1).
   When the portal is in its pre-warp state (Stage 1 preview / Stage 2
   alignment) the portal mesh is **world-fixed** at the player's chosen
   target offset, not pinned to the camera. Verified by a recording that
   includes camera motion (rotation or translation) during the pre-warp
   preview state — portal must remain visually stationary in the world,
   moving across the screen as the camera rotates around it.

6. **Stage 2 alignment slerp visibly reorients camera to face portal
   direction** (Max's session observation #2). The pre-warp Stage 2
   `_portalLabAlignDuration` slerp must produce visible camera rotation
   toward the portal before Stage 3 fires `warpEffect.start()`. Verified
   by recording that captures Stage 2 → Stage 3 transition; the alignment
   moment must be observable as camera reorientation, not skipped or
   instantaneous.

### Refactor surfaces — telemetry-equivalence per `docs/REFACTOR_VERIFICATION_PROTOCOL.md`

7. **Autopilot tour behavior identical pre/post rebasing.** A frozen-input
   harness drives an autopilot leg with seeded RNG, fixed initial
   positions, and fixed-step `update(dt)` loop. Per-frame telemetry
   captures camera world-true position (`camera.position.clone().add(
   worldOrigin)`), camera quaternion, ship position, and tour-stop state.
   Pass condition: every numerical field is within `1e-6` epsilon at
   every frame across the leg, exact match for phase strings and integer
   flags. Test scenarios: at least one autopilot leg that crosses the
   `REBASE_THRESHOLD_SQ` boundary, to confirm the rebase event itself is
   numerically transparent.

8. **Orbital body positions identical pre/post rebasing.** Same harness
   pattern: seeded scene, fixed-step `update(dt)` loop simulating
   orbital advance over N frames. Per-frame telemetry captures every
   planet, moon, and asteroid-belt body's world-true position. Pass
   condition: every body position is within `1e-6` epsilon at every
   frame. Specifically guards Plan §"Camera controllers" risk — cached
   target positions and look-at vectors that the rebase must update.

### Telemetry harness deliverable

9. **Per-frame warp telemetry harness committed at
   `tests/refactor-verification/world-origin-rebasing.html`** (project
   convention from
   `tests/refactor-verification/autopilot-navigation-subsystem-split.html`).
   Harness contents:
   - Pre/post equivalence loop driving the autopilot + body-orbit
     scenarios for ACs #7 and #8 (input freezing per
     `docs/REFACTOR_VERIFICATION_PROTOCOL.md` "Input-freezing checklist").
   - The session's `window.__diag` per-frame warp telemetry surface
     (warp state, progress, `cameraForwardSpeed`, `camPos`, `portalPos`,
     `portalRadius`, sub-mesh visibility, `traversalMode`, `camToPortal`)
     persisted as a wired-in diagnostic for re-running against rebased
     HEAD when verifying ACs #1–#5. Phase-change log and portal-event
     log kept separate.
   - Reproducible test-start positions (Sol origin AND a position ≥10,000
     scene units from origin) so AC #1–#4 can be re-driven without manual
     setup.

### Bible / doc updates

10. **Bible §10 Scale System "Precision ceiling (deferred work)" updated**
    to reflect rebasing as Shipped (not deferred). The wording shifts from
    "Solution (deferred): world-origin rebasing. Full plan in
    `docs/PLAN_world-origin-rebasing.md`" to a Shipped reference plus a
    pointer to this workstream and the implementation file(s).

11. **`docs/FEATURES/warp.md` §"Current state snapshot" entries for FOLD /
    ENTER updated** to record the precision-ceiling root cause and the
    rebasing fix — replacing the 2026-04-18 phrasing that said FOLD
    "appearance works okay today." That phrasing was correct only at near-
    origin test positions; the post-rebasing snapshot must say so.

## Principles that apply

Citing `docs/GAME_BIBLE.md` §"Development Philosophy" entries 2 and 6 as
load-bearing for this workstream; principle 5 cited because rebasing
preserves it through audit. Other principles (1 Hash Grid Authority, 3
Per-Object Retro Aesthetic, 4 BPM-Synced Animation) are not at risk in
this work.

- **Principle 2 — No Tack-On Systems.** *Load-bearing.* The natural
  reflex when staring at the warp regression is to fix it inside the warp
  module — e.g., a special-case "during FOLD, snap camera to a small-
  coord frame" hack that makes the symptom go away while leaving the
  underlying float32 ceiling for combat / docking / on-foot to re-
  encounter. That is a tack-on by definition: it papers over the symptom
  in the rendering layer when the actual fix belongs at the scene-graph
  precision substrate. The PM "Scope discipline — feature before economy"
  rule (`docs/PERSONAS/pm.md` §"Scope discipline") points the same
  direction: the feature wants seamless warp from any starting position;
  the cheaper-diff scope (warp-local fix) is the wrong shape for what
  the feature needs. Violation in this workstream looks like: any
  WarpEffect.js or WarpPortal.js change that does precision-management
  inside the warp's own coordinate space rather than at the scene level.

- **Principle 6 — First Principles Over Patches.** *Load-bearing.* The
  warp regression diagnosed this session is itself a first-principles
  signal: the warp at near-origin test positions has been "working" since
  `6d0f957`, but only because near-origin test positions accidentally
  satisfied the precision constraint. Patches like "make portal radius
  bigger" or "increase fold-peak speed" would extend the working envelope
  marginally without addressing the root. Rebasing IS the first-principles
  redesign. The principle's framing — *"If a system needs more than 2-3
  patches to achieve a goal, the architecture is wrong"* — applies in
  reverse here: the rebasing plan has been waiting in `docs/
  PLAN_world-origin-rebasing.md` since 2026-04-16 specifically because
  the team recognized the architecture-level fix in advance. Violation in
  this workstream looks like: scope-creeping rebasing into a per-feature
  fix list (rebase-for-warp-only, rebase-for-autopilot-only) instead of
  the unified scene-level rebase the plan specifies.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** *Risk during execution.* Rebasing introduces a new
  bidirectional concern: any code that read object positions as world-
  space coordinates and stored them must now read them as rebased
  coordinates plus `worldOrigin`. The `Plan §"Touch list" / Camera
  controllers` entry — *"each caches target positions, look-at vectors,
  tour stops"* — is exactly this risk. A renderer / camera-controller
  that has stashed a captured Vector3 from a body position is reading
  what the model produced; if rebasing happens between the capture and
  the read, the cached value becomes stale and the camera-controller
  silently looks at "where the body used to be in world coords" rather
  than where it is now. Violation looks like: any camera controller
  that survives the rebase audit by storing a captured position without
  also subscribing to the rebase event (or switching to a reference-to-
  object lookup pattern). Mitigation is in the AC structure (#7 and #8
  catch this telemetrically) and in the Plan's enumerated Touch list.

## Drift risks

- **Risk:** Rebasing scoped to "fix the warp regression" rather than
  "implement the plan." Working-Claude lands a warp-local fix that makes
  the immediate symptom go away (e.g., camera-frame manipulation inside
  WarpEffect during FOLD) without ever editing scene-graph rebase logic.
  Bible §10 "Precision ceiling" stays marked deferred; the next feature
  to need ship-scale precision (combat, docking, on-foot) re-encounters
  the ceiling and re-discovers the fix.
  **Why it happens:** Economy of effort + the warp regression being the
  loud signal. The PM "Scope discipline" rule names this exact failure
  mode — economy shaping the scope before the feature question is
  answered.
  **Guard:** AC #1–#6 verify the warp from a position ≥10,000 scene units
  from origin AND from Sol origin. A warp-local fix that succeeds at
  ~32,000 by special-casing FOLD coordinates will likely not produce the
  uniform behavior across both starting positions that the AC requires.
  AC #7 and #8 verify autopilot + body positions are unchanged at the
  rebase boundary — a warp-local fix won't have a rebase boundary to
  test against, so the harness can't even be written.

- **Risk:** Cached world-position drift in camera controllers /
  shader uniforms / target Vector3s. The rebase loop lands and the warp
  works, but autopilot or screensaver shows visible teleport / wrong-
  target behavior at the rebase event boundary because some controller
  cached `target.position.clone()` and didn't update at rebase.
  **Why it happens:** The Plan §"Risks / gotchas" #1 names this exactly:
  *"Missing a cached world-position — one forgotten spot produces a
  visible teleport at rebase."* The codebase has many `.position.copy(`
  and `new Vector3(` assignments to controller state.
  **Guard:** AC #7 (autopilot telemetry-equivalence at rebase boundary)
  and AC #8 (body position telemetry-equivalence) catch this
  numerically. Plan-mandated grep audit (`.position.copy(`,
  `.position.set(`, `new Vector3(` assigned to state) is part of the
  work, surfaced in the workstream's commits.

- **Risk:** Shader-uniform world positions stale at rebase. Body-shader
  `_sunDir`, StarFlare orientation references, light directions — any
  uniform set once at spawn (rather than recomputed per-frame from an
  object's `.position`) becomes stale after a rebase event.
  **Why it happens:** Plan §"Risks / gotchas" #3 names this. Hard to
  detect via telemetry harness because the harness drives the
  subsystem-under-test (camera / bodies / autopilot), not the shader
  uniform layer.
  **Guard:** Working-Claude does the Plan §"Definitely affected /
  Shader uniforms carrying world positions" audit explicitly during the
  workstream and surfaces the audit list (touched files, uniforms found,
  decision per uniform: "recomputed per-frame, free" / "set once,
  needs rebase update"). Audit list lands as a comment block or commit
  message annotation, not just an artifact in the author's head.

- **Risk:** Recordings captured against one near-origin position only.
  Working-Claude captures the warp recording from Sol origin, hits AC
  #1–#4 phase criteria visually, and ships without the second test-start
  position because Sol-origin warp "looks fine."
  **Why it happens:** Sol origin is the fastest test setup; the
  ≥10,000-scene-unit position requires warping once first then initiating
  the second warp. Extra friction.
  **Guard:** ACs #1–#4 explicitly require **two** test-start positions.
  The Tester verdict cannot pass on Sol-only evidence. Memory
  `feedback_always-test-sol.md` reminds Claude to test Sol; this
  workstream additionally requires the far-position test. Both are gates,
  not a substitution.

- **Risk:** Rebase event timing wrong relative to per-frame logic.
  Plan §"Risks / gotchas" #2: *"Rebase must happen before any per-frame
  logic that uses world positions that frame. Wrong order → one-frame
  inconsistencies."* Subtle visual artifacts (one-frame portal flicker,
  one-frame autopilot wobble) at every rebase event.
  **Why it happens:** The animation loop has a specific ordering
  (camera-controller updates, body updates, render). Rebasing has to
  slot into this ordering correctly.
  **Guard:** AC #7 fixed-step harness specifically advances the loop
  N frames across a rebase boundary and asserts numerical equivalence
  at every frame including the rebase frame — a one-frame inconsistency
  shows up as a non-zero diff at the rebase frame.

## In scope

- Implementation of the rebase loop per `docs/PLAN_world-origin-rebasing.md`
  §"What rebasing does (mechanical summary)" — `worldOrigin` Vector3,
  `REBASE_THRESHOLD_SQ`, per-frame `maybeRebase()` integrated into the
  animation loop ordering correctly.
- Audit + fix of every entry in Plan §"Touch list / Definitely affected"
  (scene-graph objects, camera controllers, shader uniforms,
  HashGridStarfield + GalacticMap seam, warp portal).
- Audit of every entry in Plan §"Touch list / Potentially affected" with
  decision recorded (free / fix needed / fix applied).
- Per-frame telemetry harness committed at
  `tests/refactor-verification/world-origin-rebasing.html`.
- Canvas recordings (Sol-origin warp + far-position warp) as Shipped
  evidence per `docs/MAX_RECORDING_PROTOCOL.md`.
- Bible §10 Scale System "Precision ceiling (deferred work)" update.
- `docs/FEATURES/warp.md` §"Current state snapshot" update for FOLD +
  ENTER.
- Fix for Max's session observations #1 and #2 (idle portal world-fixed,
  Stage 2 alignment slerp visible) — these are likely incidental
  beneficiaries of the rebasing fix (camera now actually moves, so the
  alignment slerp produces visible reorientation; portal is rebased like
  any other scene object, so it stops appearing pinned to camera). If
  the rebase implementation does not naturally fix them, working-Claude
  fixes them within this workstream's scope, since both observations
  share the precision-substrate root.

## Out of scope

- **Sub-object precision (ship-local frame nesting).** Plan §"What
  rebasing doesn't fix" #1: *"a 0.5 m hull detail on a 20 m ship still
  needs ~10⁻⁷ scene precision."* Future workstream when on-foot /
  cockpit-interior features start. This workstream uses a single
  rebased world frame; nested ship-local frames are someone else's
  problem.
- **Warp portal asset redesign.** Max flagged the portal/tunnel assets
  as placeholders slated for redesign (per `docs/PLAN_world-origin-rebasing.md`
  §"Interim workarounds"). This workstream uses the existing assets as-is;
  the redesign is a separate workstream.
- **Loading-induced ENTER freeze.** `docs/WORKSTREAMS/warp-phase-perf-pass-2026-04-20.md`
  (active) owns the diagnosis + fix of the 1–2 s ENTER freeze attributed
  to asset loading. This workstream's ENTER AC verifies the threshold-
  crossing fires + camera continuity at multiple positions; it does not
  re-attempt the load-timing fix the perf-pass workstream owns.
- **Warp HYPER tunnel brightness / streak density / blue-shift.** Open
  HYPER tuning questions per `docs/FEATURES/warp.md` §"Open questions"
  remain open and are tracked elsewhere. This workstream's HYPER AC
  verifies the existing HYPER compositor experience continues to render;
  it does not change tuning.
- **Multiplayer coordinate canonicalization.** Plan §"Risks / gotchas"
  #6 names networking as a future concern. Out of scope until multiplayer
  is on the roadmap.
- **Save-game persistence with rebased coords.** Plan §"Risks / gotchas"
  #4 names this. Out of scope until save-game is on the roadmap.
- **Removing the `feedback_always-test-sol.md` Sol-default-test rule.**
  This workstream introduces a far-position test as an additional gate,
  not a replacement.

## Handoff to working-Claude

Read first, in order: `docs/PLAN_world-origin-rebasing.md` cover-to-cover
(this is the implementation reference), `docs/FEATURES/warp.md`
§"Phase-level criteria (V1)" + §"Failure criteria / broken states" (the
authored-experience criteria the warp must continue to satisfy),
`docs/REFACTOR_VERIFICATION_PROTOCOL.md` "Which path applies" + "Input-
freezing checklist" (the AC #7 / #8 telemetry harness pattern), and
`docs/GAME_BIBLE.md` §10 Scale System (especially the ScaleConstants
helpers — every physical dimension the rebase touches still pulls from
those helpers, never hardcoded).

Avoid: any change inside `WarpEffect.js` or `WarpPortal.js` that does
precision-management in the warp's local coordinate space rather than at
the scene-graph level. The diagnosed regression's root cause is
universal float32 precision, not warp-specific. A warp-local fix is the
tack-on Principle 2 forbids.

Verification structure: telemetry-assertion path for ACs #7 and #8 (the
unchanged surfaces — autopilot, body positions); canvas-recording path
for ACs #1–#6 (the warp's authored experience + portal-pinning + Stage 2
slerp). Two test-start positions for the recordings — Sol origin AND a
position ≥10,000 scene units from origin (achievable by warping once
from Sol then initiating a second warp without resetting). The Tester
verdict cannot pass on Sol-only evidence.

"Done" looks like: rebase loop landed in the animation loop with correct
ordering, every Plan §"Touch list / Definitely affected" entry audited
and fixed (with the audit list surfaced in commits), telemetry harness
at `tests/refactor-verification/world-origin-rebasing.html` passing 0
regressions across the autopilot + body-orbit scenarios at `1e-6`
epsilon, two warp recordings on disk under `screenshots/max-recordings/`
both showing FOLD portal visibility + ENTER threshold-crossing + HYPER
tunnel + EXIT crowning, Bible §10 + warp.md current-state-snapshot
updated, idle-portal world-fixed and Stage 2 slerp visibly reorienting
either as natural consequences of the rebase or as fixed within scope.
After working-Claude's last coherent change lands, invoke
`Agent(subagent_type="tester")` with the diff + this brief path. On
PASS, status flips to `VERIFIED_PENDING_MAX <commit-sha>` and waits for
Max's recording evaluation per the Shipped-gate protocol; on Max's PASS,
flip to `Shipped <commit-sha> — verified against
<recording-paths>` and clear the active workstream via
`~/.claude/state/dev-collab/clear-active.sh well-dipper`.
