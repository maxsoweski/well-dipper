# Workstream: Manual nav ↔ autopilot toggle — lifecycle fix + adjacent code review (2026-05-02)

## Status

**Active — scoped 2026-05-02 against HEAD `e11fc4b`.**

## Parent feature

`docs/FEATURES/autopilot.md` — specifically:

- §"Manual override — two-layer architecture" (lines 228–245). The **navigation subsystem** is supposed to be *always available*, reused by manual-mode "burn to" actions; the **cinematography layer** is what toggles. Today's `AutopilotMotion` controller (the V1 ship-axis motion module that supersedes the `FlythroughCamera` motion path) is part of the cinematography layer's leg execution. Its lifecycle must follow autopilot toggle on/off cleanly — that's the load-bearing contract this brief lands.
- §"Failure criteria / broken states" (lines 289–308). Two entries name this workstream's surface directly:
  - *"Manual override snap-stops the ship — inertial continuity violated; the two-layer architecture leaked through."* (Today's bug is the inverse — manual override doesn't even *take effect*; the ship continues on the autopilot leg. Same architectural root: leakage of cinematography-layer state past the toggle boundary.)
  - *"Autopilot-on-then-off-then-on auto-resumes — the 'toggle-on must be explicit' rule violated."* (Bug 3 — Q-press-during-residual-state half-engages instead of cleanly engaging.)

## Implementation plan

N/A (workstream-sized; no separate PLAN doc needed).

## Source material

Diagnosis captured 2026-05-02 morning by working-Claude:
**`screenshots/diagnostics/manual-autopilot-toggle-2026-05-02/DIAGNOSIS.md`** — full findings, telemetry pointers, suspected root-cause hypotheses, four scenario recordings (sol/proc × A/B), four telemetry JSONs.

Standing todo (originating intent): memory file `session-2026-04-28-autopilot-shipped-manual-flying-pickup.md` — *"wire autopilot toggle-off / interrupt to work seamlessly with manual flying — verify lhokon, body-lock, shake suppression, realistic motion all behave correctly across the toggle boundary."*

Max's session-opening direction: *"spawn the pm, and include a review of all the code for bugs."* Translation embedded in this brief: scope a code-review pass over the related lifecycle paths *in the same workstream* so the bug fix doesn't paper over a deeper rot.

## Scope statement

Three user-visible bugs at the manual-nav ↔ autopilot toggle boundary. All three trace to a single architectural cause: the `AutopilotMotion` controller's lifecycle is partially decoupled from the `autoNav` / `_autopilotEnabled` lifecycle that drives the rest of the toggle, so its `isActive` state can be stale (residually true after a release path runs) or erroneously hot (true when autopilot was never engaged). The cinematography-layer's motion executor leaks past the boundary that's supposed to release it, and downstream gates (`flightOk` predicate at `main.js:6905-6928`, `cameraController.update` skip at `main.js:6933`, `stopFlythrough` early-return at `main.js:4993`, `cameraController.bypassed` reset branches at `main.js:5008-5022`) all read the stale state and produce the user-visible failure modes.

The workstream lands the lifecycle fix **and** carries a focused review of the adjacent code surface — every site that starts, stops, gates on, or otherwise reads `autopilotMotion.isActive`, `_autopilotEnabled`, `autoNav.isActive`, `cameraController.bypassed`, or the closure-scoped flight gate booleans — to surface additional bugs the diagnostic capture didn't reach (only one keypress was tested per scenario; downstream behavior across the toggle boundary was unobservable while the gate killed input).

## How it fits the bigger picture

Advances autopilot.md §"Manual override — two-layer architecture" — the **load-bearing architectural realization** that *manual-mode targeting + burn reuses the same navigation subsystem the autopilot uses, and autopilot toggle-off swaps the caller without killing the subsystem*. Today's bugs are evidence the layer separation isn't clean: `AutopilotMotion` (the V1 motion executor that lives in the cinematography layer's leg machinery) is being treated as both a layer-private thing (started by `startFlythrough`, started by the warp-arrival auto-handoff) and a layer-public thing (its `isActive` is read by main-loop gates that should only care about cinematography state). Fixing the lifecycle is a step toward the §"Manual override" contract being implementable at all — without it, the "toggle-off, take manual control, burn to a different body" flow Max expects from the autopilot heart's-desire is not reachable from current state.

Cross-references the §"Gravity drives" V1 spec (shake fires only on authored ACCEL/DECEL boundaries) — Bug 1's residual `autopilotMotion.isActive=true` keeps `shipChoreographer.update` in `'traveling'` subPhase via the gate at `main.js:6706`, which can fire shake events at random under post-interrupt drift. Fix candidates must verify shake suppression after toggle-off + after WASD-interrupt.

Cross-references the §"HUD" rule (HUD reappears on player interaction) — confirm in adjacent review that toggle-off + WASD-interrupt restore HUD visibility. Today this is downstream of the gate fix and may regress silently.

## Acceptance criteria

This is a behavior-change workstream on a phased motion feature, so ACs follow the §"Per-phase AC rule" — each AC cites the autopilot.md section / failure-criteria entry it verifies. Verification is **telemetry-equivalence first** (well-suited to state-machine assertions) **plus a single recording** as the seamlessness check. The capture infrastructure (`window._autopilot.telemetry.start/stop`, canvas-recorder, fetch script) is already in place.

### Lifecycle (load-bearing — fix these or nothing else passes)

1. **Bug 1 — `autopilotMotion.isActive` releases on every release path.** After `stopFlythrough()` returns, `autopilotMotion.isActive === false` within ≤ 2 frames. Verified in three release scenarios: (a) Q-press toggle-off during STATION-A hold, (b) Q-press toggle-off during CRUISE, (c) WASD interrupt during CRUISE. (Per autopilot.md §"Failure criteria" — *"Manual override snap-stops the ship"* surfaces if the release isn't clean; today's failure mode is the inverse — release doesn't happen at all — but the same architectural seam.) Telemetry-assertion: sample `window._autopilotMotion.isActive` per frame; assert `false` from the first frame post-stopFlythrough through the next 60 frames.

2. **Bug 1 corollary — autopilot was never engaged → `autopilotMotion.isActive` is `false` from session start through warp arrival.** procA scenario showed `autopilotMotion=true, autoNav=false` *before any input* — the warp-arrival handoff at `main.js:6796` (line: `if (result.orbitComplete) { ... autopilotMotion.beginMotion(...) }`) starts the controller unconditionally on the first navSubsystem tour-leg orbitComplete, even when `_autopilotEnabled=false` (warp from a system where autopilot was off). The handoff must respect `_autopilotEnabled`. (Per autopilot.md §"Failure criteria" — *"Autopilot-on-then-off-then-on auto-resumes"* — toggle-on must be explicit; warp arrival must not implicitly enable cinematography motion.) Telemetry-assertion: warp from autopilot-off Sol → procedural; assert `autopilotMotion.isActive === false` from warp end through 5 s of post-arrival drift.

3. **Manual flight gate releases under all autopilot-off conditions.** `cameraController._flightEnabled === true` and `cameraController.update(deltaTime)` is invoked at full rate within ≤ 2 frames after a release path completes. Telemetry-assertion: after each of (a)/(b)/(c) from AC #1, sample `cameraController._flightEnabled` and observe `cameraController.update` being called (proxy: camera position responds to `setFlightInput`). (Per autopilot.md §"Manual override" — *"player can select another object + burn toward it"* requires manual-flight WASD reaches the camera.) Note the **two-layer block** identified in DIAGNOSIS.md §"Bug 2 note": even with `flightOk=true`, line 6933's `if (!autopilotMotion.isActive)` skip would block the camera-update path — both gates must be reachable simultaneously. AC #1 fix subsumes this; AC #3 verifies the user-visible result.

4. **WASD interrupt during cruise produces visible ship motion within 200 ms of release.** During an active autopilot CRUISE leg, pressing W must (i) stop the autopilot tour, (ii) release `autopilotMotion`, (iii) propagate WASD thrust to camera position. Recorded delta-position over 1 s post-W-press > 0 with W still held. (Per autopilot.md §"Failure criteria" — the WASD-interrupt path is the *manual override* the architecture is built around; today's silent-no-op is the most user-visible symptom.) Telemetry-assertion: sample `camera.position` per frame; assert magnitude of position delta over 1 s with W held > [threshold informed by `cameraController.flightSpeed`].

5. **Q toggle off → on cleanly engages autopilot from current camera pose.** Press Q during STATION-A → release verified (AC #1). Press Q again → `autoNav.isActive === true`, `autopilotMotion.isActive === true`, new tour leg begins from current camera position toward a randomly-selected stop. (Per autopilot.md §"Failure criteria" — *"Autopilot-on-then-off-then-on auto-resumes"* fails this AC if the second engage replays the prior tour state instead of beginning fresh.) Telemetry-assertion: sample `autoNav.currentIndex` and `autopilotMotion.bodyRef` across the off→on transition; assert the new bodyRef is selected from the queue *after* the toggle-on, not preserved from before.

### Adjacent / code-review surface (catch additional bugs the capture didn't reach)

6. **`stopFlythrough()` is idempotent and complete across all entry conditions.** Code review surface: line 4992. Today's early-return at line 4993 reads `(!autoNav.isActive && !flythrough.active && !nav-sequence)` — if `autopilotMotion.isActive` is true while all three are false (the residual state from Bug 1), `stopFlythrough()` no-ops, and the WASD-interrupt path at line 7409 silently does nothing. AC: `stopFlythrough()` either (a) tears down all four motion components or (b) explicitly documents the early-return condition + verifies no caller depends on the no-op being a release. Telemetry-assertion: invoke `stopFlythrough()` from each known entry condition (idle re-engage timeout, WASD interrupt, Q toggle, commit-burn, warp start, restart); after each, assert `autoNav.isActive === false && flythrough.active === false && autopilotMotion.isActive === false && shipChoreographer.currentPhase === 'IDLE'`.

7. **`cameraController.bypassed` resets to `false` on every release path that doesn't restore camera control via `restoreFromWorldState`.** Code review surface: lines 5008–5022 of `stopFlythrough`. Today, when `findClosestBody()` returns truthy, `restoreFromWorldState` is called *but `cameraController.bypassed = false` is not set in that branch* — the reset only fires in the `!system` and `!closest` branches. Verify whether `restoreFromWorldState` internally clears `bypassed`; if not, that's a third residual-state vector. AC: post-`stopFlythrough()`, `cameraController.bypassed === false`. Telemetry-assertion: before/after stopFlythrough sampling.

8. **Warp-arrival auto-engage of `autopilotMotion` respects `_autopilotEnabled`.** Code review surface: line 6796 (the `result.orbitComplete` handoff) and line 5190 (the warp-arrival `autoNav.start()` gate). Today, line 5190 correctly checks `if (_autopilotEnabled) autoNav.start();` — but line 6796 has no such check. The legacy navSubsystem orbit-complete fires the same `autopilotMotion.beginMotion(...)` path regardless of whether autopilot was engaged. (This is the structural cause of AC #2's procA-started-true observation.) AC: warp from an autopilot-off system; assert `autopilotMotion` never starts during the post-warp coast. Telemetry-assertion: continuous sample of `autopilotMotion.isActive` from warp HYPER through ENTRY through 30 s of post-arrival drift.

9. **All `autopilotMotion.beginMotion(...)` call sites enumerated and reviewed.** Code review surface: lines 4915 (`_beginTourLegMotion`), 4972 (`startFlythrough`), 6739 (post-motionComplete next-leg), 6796 (orbitComplete handoff — see AC #8). For each: confirm preconditions (`_autopilotEnabled === true`, system in valid state, `autoNav` aligned with the engagement). Document any callsite that intentionally bypasses preconditions (and *why*). AC: a list of all callsites + their precondition contracts in the workstream's commit message or a short addendum to autopilot.md §"Manual override".

10. **All `stopFlythrough()` callers + autopilot-off-equivalent code paths enumerated and reviewed.** Code review surface (from `grep stopFlythrough src/main.js`): lines 1870, 3116, 4196, 5404, 7397, 7409, 7874, 7925, 7951, 8030, 8074. For each: confirm the caller's intent matches what `stopFlythrough()` actually does post-fix, and the caller doesn't need to do additional work (e.g., explicit `autopilotMotion.stop()`, `cameraController.bypassed = false`, HUD reveal). AC: any caller whose intent is "release autopilot completely" reaches the same end-state as the WASD-interrupt path; any caller whose intent is narrower (e.g., `commitBurn` may want to keep some state) has that narrowing documented inline.

11. **Closure-scoped flight gate booleans (`warpTarget.turning`, `_settingsOpen`, `_soundTestOpen`, keybinds-overlay display) are not held hot by autopilot lifecycle.** Code review surface: line 6909–6916. DIAGNOSIS.md §"Bug 2" suspected `warpTarget.turning` was held by residual autopilot state — couldn't read closure-scoped vars from console. With AC #1 fixed, run telemetry while exposing each gate var on `window._gateProbe` and confirm none are stuck `true` after a release path. Telemetry-assertion: sample each gate var across (a)/(b)/(c) from AC #1; assert each is `false` post-release. (If any gate var IS held by autopilot lifecycle, that's a bug-12 scope expansion — not a separate workstream, raise to Max in the brief update.)

12. **HUD reveal across the toggle boundary** (per autopilot.md §"HUD" — *"reappears on player interaction"*). Code-review surface: HUD-hide / HUD-show triggers around `_autopilotEnabled` and player input. AC: after WASD-interrupt during autopilot, HUD is fully visible within ≤ 1 s. Recording-class verification (one frame at +1 s post-W-press, looking for HUD chrome).

### Recording (one)

13. **A single recording (~30 s) covers the seamlessness arc the failure-criteria language commits to.** Sol system: autopilot engages → tour for ~10 s → WASD-interrupt → 5 s of manual flight → Q re-engages autopilot → 5 s of new tour leg. Captured via `~/.claude/helpers/canvas-recorder.js` (30 fps throttle, settings volume to 0 first per `feedback_default-mute-audio-in-dev.md`). Per autopilot.md §"Failure criteria" — *"Manual override snap-stops the ship"* + *"Autopilot-on-then-off-then-on auto-resumes"* — both are felt criteria, not telemetry criteria. Tester verdict on the recording covers the felt-experience gate that telemetry can't reach.

## Principles that apply

(From `docs/GAME_BIBLE.md` §11 Development Philosophy — naming the load-bearing 2-4 for *this* work, not blanket-listing.)

- **Principle 2 — Repair upstream, never downstream.** Bug 1 is the upstream cause; Bugs 2 + 3 are downstream effects. The diagnosis already proves Bug 2's gate-killed-input behavior correlates 1:1 with `autopilotMotion=true` even though `autopilotMotion` isn't in the gate list — the cause is somewhere else (a closure-scoped gate held by lifecycle) and the visible symptom (`flightOk=false`) is downstream. The temptation is to add `autopilotMotion.isActive` to the `flightOk` gate's NOT-list — that would mask the bug at the gate without fixing the lifecycle. *Do not patch the gate. Fix the lifecycle.* Same for Bug 3: the temptation is to add a guard in the Q-keypress branch that pre-releases `autopilotMotion` before calling `startFlythrough()` — that's a downstream symptom-mask that leaves the next residual-state path silently broken.

- **Principle 5 — Architecture before convenience.** The code-review surface (ACs #6–#11) exists *because* this bug class — lifecycle of a layer-private thing leaking into layer-public state-reads — is exactly the pattern Principle 5 protects against. The two-layer architecture (cinematography vs navigation subsystem, autopilot.md §"Manual override") is the architectural commitment; today's `autopilotMotion` straddles the line by being part of cinematography-layer execution but read by main-loop gates as if it were navigation-subsystem state. The fix scope includes naming this seam explicitly — what does `autopilotMotion.isActive` *mean* to the rest of the loop, and which other modules legitimately need to read it? The review pass surfaces bugs that have the same architectural shape elsewhere in the lifecycle plumbing (warp-arrival auto-engage at line 6796 is the prime example — it's the same straddle in the other direction).

- **Principle 6 — Continuity is the felt experience.** The §"Failure criteria" entry *"Manual override snap-stops the ship — inertial continuity violated; the two-layer architecture leaked through"* is Principle 6 applied to this surface specifically. Today's failure isn't a snap-stop — it's the inverse (the ship continues on the autopilot trajectory and the player has no way to interrupt) — but the architectural seam that produces both failure modes is the same: the cinematography layer's motion state isn't cleanly handed over at the toggle boundary. AC #4 (WASD produces visible motion within 200 ms) is the felt-continuity criterion this principle anchors. Note the inverse risk after fix: implementing the release as `autopilotMotion._velocity.set(0,0,0); autopilotMotion.stop()` at the WASD-interrupt site would snap-stop the ship and trip the §"Failure criteria" entry directly. The release path must preserve momentum (cameraController's manual-flight integrator picks up where the autopilotMotion left off — already the architectural intent of `restoreFromWorldState`'s contract).

## Drift risks

- **Risk:** Patching the gate at line 6909–6916 by adding `&& !autopilotMotion.isActive` to the `flightOk` predicate.
  **Why it happens:** It's the most visible site where the bug surfaces (gate is dead → WASD does nothing). One-line fix that "works" in isolation. Removes the visible symptom.
  **Guard:** This is symptom-masking, not lifecycle repair (Principle 2). The underlying `autopilotMotion.isActive` should *be `false`* when autopilot is off; if you're adding it to the gate, you're admitting the lifecycle is broken and routing around it. Reject this patch; fix `stopFlythrough()` instead.

- **Risk:** Adding `autopilotMotion.stop()` at every keydown branch that interrupts autopilot, instead of inside `stopFlythrough()`.
  **Why it happens:** Each call site has its own context — `commitBurn` cares about the burn target, the WASD-interrupt cares about manual control, the warp-start cares about scene swap. Local context tempts local fixes.
  **Guard:** `stopFlythrough()` is the named release function; that's where the release of all autopilot-layer state belongs. AC #6 (idempotent + complete `stopFlythrough()`) is the contract. Any callsite that needs *narrower* release should justify it inline (AC #10).

- **Risk:** Fixing Bug 1 + Bug 2 declared shipped, leaving Bug 3 (Q half-engage on residual state) "for later" because Bug 1's fix appears to make Bug 3 unreachable.
  **Why it happens:** Bugs 2 and 3 are downstream of Bug 1 per the diagnosis. Once Bug 1 is fixed, the residual-state precondition for Bug 3 disappears, so it *seems* fixed — but only because the *path* to it is closed, not because the Q-keypress handler itself is robust.
  **Guard:** AC #5 explicitly tests Q toggle off → on producing a clean fresh engage. Verify by *forcing* `autopilotMotion.isActive=true` in the console (debug hook), then Q-press, and asserting `startFlythrough` either refuses cleanly with a console-log explanation OR pre-releases the residual state before engaging. The handler's robustness is the AC, not the path's reachability.

- **Risk:** Code-review pass (ACs #6–#11) becomes a refactor. Reviewer notices structural seams beyond the lifecycle ones, scopes a refactor of `stopFlythrough` + `_beginTourLegMotion` + `commitBurn` lifecycle plumbing into a unified release-orchestrator.
  **Why it happens:** The seams are real and the urge to consolidate is correct in principle. But this workstream is a *bug fix + adjacent review*, not a refactor — Max wants the bugs fixed and additional bugs surfaced, not the lifecycle plumbing rewritten. A refactor opens its own ACs, its own verification protocol (telemetry-equivalence per `REFACTOR_VERIFICATION_PROTOCOL.md`), and a recording surface.
  **Guard:** If the review surfaces structural seams worth refactoring, capture them in a follow-up workstream brief — not in this one. The review's output is *bugs found* + *callsite preconditions documented*, not a unified release-orchestrator. Raise the followup to Max for explicit greenlight before authoring.

- **Risk:** Recently-shipped world-origin-rebasing (HEAD `e11fc4b`, this morning) introduces precision-related residual state that confounds the lifecycle diagnosis.
  **Why it happens:** Rebasing landed today; the bugs were observed today. Causal-temporal proximity tempts attribution.
  **Guard:** The diagnosis recordings + telemetry are at `e11fc4b`. The keypress handler at line 7055 unconditionally adds to `_heldKeys` — that path is unaffected by rebasing. The `flightOk` gate at line 6909 reads only state booleans — unaffected. `stopFlythrough`'s missing `autopilotMotion.stop()` is a code-shape bug, not a precision bug. Rebasing is *not* the suspected cause; if a fix for AC #1 doesn't resolve the visible symptoms, *then* re-examine whether rebasing introduced an interacting precision issue (e.g., world-origin shifts during a residually-active leg producing visual drift that persists past the fix). Revisit only if AC #1 fix doesn't close AC #3-5.

## In scope

- Fix `stopFlythrough()` to release `AutopilotMotion` (call `autopilotMotion.stop()`) and reset `cameraController.bypassed` cleanly across all branches (ACs #1, #6, #7).
- Fix the warp-arrival handoff at `main.js:6796` to respect `_autopilotEnabled` (AC #2, #8).
- Verify the WASD-interrupt path at `main.js:7408` reaches a clean release end-state (AC #1c, #4).
- Verify the Q-toggle handler at `main.js:7395-7402` engages cleanly from the post-release state (AC #5).
- Code review of: every `autopilotMotion.beginMotion(...)` callsite (AC #9), every `stopFlythrough()` caller (AC #10), the closure-scoped flight gate booleans (AC #11), the HUD reveal path (AC #12).
- Surface any **additional bugs** the review uncovers; document each in DIAGNOSIS.md addendum or in the workstream's commit message; if any rise to architectural-fix scope, raise to Max for triage (this brief vs. a new follow-up workstream).
- Single recording verifying the seamlessness arc (AC #13).

## Out of scope

- **Rewriting the cinematography vs navigation-subsystem layer separation.** That's a refactor scope, not a bug-fix scope. If the review surfaces structural seams worth refactoring, capture as a follow-up workstream — do not bundle.
- **Manual-mode "burn to" feature** (autopilot.md §"Manual override" — *player can select another object + burn toward it*). Today's bugs block the **interrupt + WASD movement** half of the manual-override architecture; the **select + burn** half is its own feature surface that depends on this fix landing first. Carve it as a separate future workstream once the toggle boundary is clean.
- **Body-lock / shake-suppression / realistic-motion behavior verification across the toggle boundary** (the explicit standing-todo language). All four behaviors are downstream of AC #1 — they only matter if the lifecycle releases cleanly. Verify in passing as part of AC #1's scenarios; if any read as broken *after* AC #1 closes, scope as follow-up. Do not architect for them in this workstream.
- **Rebasing precision interactions** (see Drift risks). Out of scope unless AC #1 fix doesn't close downstream ACs.
- **Refactor of the gate-predicate at line 6909** to consolidate flight-disable conditions into a named function or centralized state. Touch the gate only if the review surfaces a bug *in* it; do not restructure.
- **Telemetry coverage extensions.** The reckoning telemetry from `autopilot-telemetry-reckoning-2026-04-24` is sufficient for AC #1-#11. If the review identifies a *new* observable that's not yet sampled (e.g., gate-var probes on `window`), add a one-line probe; do not extend the reckoning surface.

## Handoff to working-Claude

**Read first:**
1. `screenshots/diagnostics/manual-autopilot-toggle-2026-05-02/DIAGNOSIS.md` — full picture: scenarios, telemetry, suspected root causes, the gate-correlation table.
2. `docs/FEATURES/autopilot.md` §"Manual override — two-layer architecture" (lines 228–245) and §"Failure criteria / broken states" (lines 289–308). The architectural commitment + the specific failure-criteria entries this workstream lands against.
3. `src/main.js` lines 4992 (`stopFlythrough`), 6905–6935 (flight gate + cameraController.update gate), 6796 (warp-arrival handoff), 7395–7438 (Q + WASD-interrupt handlers), 4913–4925 (`_beginTourLegMotion`), 4960–4987 (`startFlythrough`).
4. `src/auto/AutopilotMotion.js` lines 247 (`isActive` getter), 267 (`beginMotion`), 451 (`stop`). Confirm `stop()` does the right teardown — it does, at the source-read level: phase → IDLE clears `isActive`, body refs cleared, lhokon refs cleared.

**Do AC #1 first.** Bugs 2 and 3 are downstream of Bug 1 per the diagnosis. The first commit should be the `stopFlythrough()` fix that adds `autopilotMotion.stop()` and verifies AC #1 in isolation (single telemetry assertion). If Bugs 2 and 3 don't resolve as downstream effects after AC #1 lands, *that's its own discovery* — surface it before continuing.

**The review pass is part of the workstream, not after it.** ACs #6–#11 are not optional follow-up — they're load-bearing. Max specifically asked for the broader review *in this workstream* so the fix doesn't paper over deeper rot. The expected output of the review is: (a) callsite preconditions documented in commit messages or DIAGNOSIS.md addendum, (b) any newly-found bugs surfaced for triage, (c) explicit answer for AC #11's gate-var question.

**What "done" looks like:**
- All 13 ACs verified (12 telemetry-assertion + 1 recording).
- AC #2 + AC #8 (warp-arrival path) closed: a fresh-load Sol → warp → procedural with autopilot OFF the whole time → `autopilotMotion.isActive` is `false` continuously.
- AC #5 closed: the Q toggle off → on cycle produces a fresh tour leg, not a phantom resumption.
- Recording (AC #13) captured at the to-be-shipped commit, located at `screenshots/max-recordings/manual-nav-autopilot-toggle-fix-2026-05-02.webm`.
- Tester (`Agent(subagent_type="tester")`) verdict PASS on the to-be-shipped commit. Telemetry-assertions cover ACs #1-#11 mechanically; AC #13 recording goes to Max for the felt-experience gate.
- Brief flipped to `Shipped <commit-sha> — verified against <recording-path>` *only after* Max's recording verdict is in. (Per `feedback_motion-evidence-for-motion-features.md`: motion-class evidence for motion-class features.)
- Push to origin (well-dipper is an established-deploy site per `feedback_deploy-established-sites.md`); deploy verification per `feedback_push-on-shipped.md`.

**What artifacts to produce:**
- The fix commit(s) — one per AC where natural; do not bundle the lifecycle fix with unrelated review-discovered bugs (each newly-surfaced bug is its own commit so attribution is clean).
- Recording per AC #13 at `screenshots/max-recordings/manual-nav-autopilot-toggle-fix-2026-05-02.webm`.
- DIAGNOSIS.md addendum (or workstream commit message) with: callsite preconditions for AC #9, AC #10 caller-intent table, AC #11 gate-var probe results.
- Any new bugs surfaced by the review pass: write up briefly in DIAGNOSIS.md addendum and surface to Max for "fix in this workstream vs. follow-up workstream" decision.

**What to avoid:**
- Adding `autopilotMotion.isActive` to the `flightOk` gate (Drift risk #1).
- Snap-stopping the ship at WASD-interrupt (Drift risk under Principle 6).
- Refactoring the lifecycle plumbing (Drift risk #4).
- Declaring AC #5 closed via Bug 1 path-closure alone (Drift risk #3).
- Skipping the review pass because the bug fix "works" (Max's explicit ask — and the review is what catches the latent warp-arrival auto-engage at AC #8, which the diagnosis surfaced as a real existing bug, not a hypothetical).

**Tester invocation (after each coherent unit):**
```
Agent(subagent_type="tester", prompt="Verify against docs/WORKSTREAMS/manual-nav-autopilot-toggle-fix-2026-05-02.md AC #<N>. Diff: <commit-sha or range>. Telemetry helper: window._autopilot.telemetry.start/stop. Repro: <scenario>.")
```
