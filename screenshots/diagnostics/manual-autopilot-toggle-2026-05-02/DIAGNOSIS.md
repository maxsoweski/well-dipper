# Manual Nav + Autopilot Toggle — Diagnosis 2026-05-02

Captured four scenarios on HEAD `e11fc4b` (post world-origin-rebasing
ship). All artifacts in this directory.

| Scenario | System | Path |
|----------|--------|------|
| A | Sol | autopilot → WASD interrupt |
| B | Sol | manual flying → Q engage |
| A | procedural binary | autopilot → WASD interrupt |
| B | procedural binary | manual flying → Q engage |

Capture method: chrome-devtools on port 9223 driving a foregrounded tab,
synthetic `keydown`/`keyup` events on `window` (handler is at
`src/main.js:7055` and adds to `_heldKeys` unconditionally on entry — no
`isTrusted` gate). Recording via `~/.claude/helpers/canvas-recorder.js`
30 fps insertable-streams throttle. Telemetry via the existing
`window._autopilot.telemetry.start()` per-frame sampler. Sample rates
held ~230 Hz once the tab was foregrounded (a first throttled run at 1 Hz
proved Chrome had backgrounded the tab; `select_page(bringToFront:true)`
cleared it).

---

## What we set out to test

Per memory `session-2026-04-28-autopilot-shipped-manual-flying-pickup.md`,
the standing todo: "wire autopilot toggle-off / interrupt to work
seamlessly with manual flying — verify lhokon, body-lock, shake
suppression, realistic motion all behave correctly across the toggle
boundary."

Max's report this session: "Sol is especially bad but procedural is
affected too."

---

## Three bugs identified

### Bug 1 — `autopilotMotion.isActive` never releases

Highest-confidence finding. The `AutopilotMotion` controller stays
`isActive: true` after every test path that should release it:

- After **warp arrival**: procA started with `autopilotMotion=true,
  autoNav=false` before any input. The warp coast handed off but did
  not zero out the motion controller. (procA `start` event,
  `procA-…-telemetry.json`.)
- After **WASD interrupt** of autopilot: every scenario shows
  `shipPhase=IDLE, autoNav=false, autopilotMotion=true` after W.
  (procA `W-pressed` and `mid-W-hold`, solA aftermath via slim cam
  freeze.)
- After **Q toggle off**: same pattern.

Symptom Max sees: the ship/camera keeps drifting along the autopilot's
last leg trajectory after he interrupts. procA `end` (3 s after W
released) shows `camPos` returned to [3.1, 0, -9.3] — exactly the
autopilot engagement position. procB drifted 28 000 scene units in 5 s
after a Q-press that didn't toggle `autoNav` at all. Something is
moving the camera through `autopilotMotion`'s residual envelope.

Where to look: `src/auto/AutopilotMotion.js` `beginMotion` /
`stopMotion` / `release()`; `src/main.js` `stopFlythrough()` (line
4992) — this should call `autopilotMotion.stop()` (or equivalent) but
the controller stays active. The keydown branch at `main.js:7408`
calls `stopFlythrough()` synchronously — verify what
`stopFlythrough` actually does to `autopilotMotion`.

### Bug 2 — Manual flight gate is dead under residual autopilot state

User-visible: **pressing WASD produces no ship motion** in 3 of 4
scenarios. `cameraController._flightInput` stays `{x:0, y:0, z:0}` and
`_flightVelocity` stays `[0,0,0]` even while `_heldKeys.has('KeyW')`
must be true (the keydown listener unconditionally adds it).

The block at `main.js:6905-6928` reads:

```
const flightOk = !titleScreenActive && !warpEffect.isActive
              && !warpTarget.turning && !galleryMode
              && !autoNav.isActive && !_settingsOpen
              && !_soundTestOpen
              && document.getElementById('keybinds-overlay')?.style.display === 'none';
cameraController._flightEnabled = flightOk;
if (flightOk) cameraController.setFlightInput(fwd, right, boost);
else cameraController.setFlightInput(0, 0, false);
```

Telemetry observation:

| Scenario | `autoNav` | `autopilotMotion` | `flightEnabled` |
|---|---|---|---|
| solB W-press | false | true | false |
| procA W-press | false | true | false |
| procA W+500ms | false | true | true |
| procB W-press | false | true | false |
| procB W+2s | false | true | false |

`autopilotMotion.isActive` is **not in the `flightOk` gate list**, yet
`flightEnabled=false` correlates 1:1 with `autopilotMotion=true` at
W-press time across scenarios. This means another gate is being held by
the residual autopilot state — most likely `warpTarget.turning` (warp
finishes but `turning` doesn't reset cleanly), or possibly
`_settingsOpen`/`_soundTestOpen` flickers. Worth instrumenting each
gate's value during a repro to identify the sticky one. (Couldn't read
the closure-scoped vars from console; would need a debug hook on
`window` exposing the gate booleans, or instrumentation lines added to
`flightOk` computation.)

Note: `cameraController.bypassed = true` in procB end-state
suggests the camera is under autopilotMotion's bypass mode. While
bypassed, `cameraController.update(deltaTime)` is gated by
`!autopilotMotion.isActive` at `main.js:6932` — so even if `flightOk`
were true, manual flight wouldn't propagate to camera position because
the update loop is skipped. Two-layer block.

### Bug 3 — Q toggle is no-op when `autopilotMotion` is residually active

procB: Q press at `t=395207` → `autoNav` stays `false`. But camera
moves 28 km over the next 5 s. So `startFlythrough()` was called by the
Q keypress (the listener at `main.js:7395-7402` is unconditional on
`else if (system)`), but either it returned early without setting
`autoNav.isActive`, or `autopilotMotion` is doing the motion in a state
where `autoNav` is decoupled.

Hypothesis: `startFlythrough()` checks `autopilotMotion.isActive` and
refuses to engage cleanly when it's already true — leaving the user in
a half-engaged state where the motion controller continues a phantom
leg but the autoNav state machine never enters. The residual state is
the cause and Q is the trigger.

This is downstream of Bug 1 — fixing the `autopilotMotion` release
should resolve this.

---

## Sol vs procedural

Both systems exhibit all three bugs. The "Sol is especially bad"
report is consistent with this evidence: in Sol, after the WASD
interrupt the camera freezes at the body the autopilot was visiting
(STATION orbit). In procedural, the camera continues to drift along the
last leg's trajectory. Both feel broken; Sol's freeze may be more
visually startling because the framing is locked on the body and the
"stuck" affordance is louder than procedural's slow drift toward the
binary star.

No system-specific code path differs in the WASD/autopilot-toggle
interaction — the bugs are in the global state machine and the gates
in `main.js`.

---

## Camera teleport on autopilot engage — design, not bug

solA log shows `camPos` jumping from [-37033, 0, -22282] → [-275, 0,
291] within 700 ms of the Q press. This is the **establishing camera
placement** — `AutopilotMotion.beginMotion` repositions the camera to
a cinematic vantage near the engagement origin. Not a bug; flagging
because the cam-jump in raw telemetry can mislead a reader.

---

## Suggested next steps (not yet decided)

1. **Add a debug hook** — expose the closure-scoped flight gates
   (`warpTarget`, `_settingsOpen`, `_soundTestOpen`) on `window` so the
   sticky gate can be identified from telemetry without code edits.
   One-line addition in `main.js` near the existing `window._*` block.
2. **Audit `stopFlythrough()`** — verify it calls
   `autopilotMotion.stop()` (or whatever the release method is). If
   it doesn't, that's the fix for Bug 1.
3. **Fix the WASD interrupt path** — line 7408's keydown branch
   currently calls `stopFlythrough()` only. It should also explicitly
   release `autopilotMotion` and reset `cameraController.bypassed`.
4. **Once Bug 1 is fixed**, re-run these four scenarios. Bugs 2 and 3
   will likely resolve as downstream effects.

Open call: are there OTHER manual-nav bugs (separate from
toggle-boundary) that Max is seeing that this capture didn't surface?
WASD steering / boost behavior under correctly-released autopilot state

---

# Addendum — AC #1 fix + code-review pass results (2026-05-02 PM)

Fix landed at `f674ced`. Two-line change to `src/main.js:stopFlythrough()`:
adds `autopilotMotion.isActive` to the early-return guard and calls
`autopilotMotion.stop()` after `shipChoreographer.stop()`.

## AC verdicts (all PASS at `f674ced`)

| AC | What was tested | Result |
|----|-----------------|--------|
| #1 | autopilotMotion releases ≤ 2 frames after stopFlythrough() | PASS — `framesUntilFalse=0` across (a) Q-off STATION-A 5500ms, (b) Q-off CRUISE, (c-early) W-interrupt 150ms-into-CRUISE, (c-late) W-interrupt at CRUISE→APPROACH boundary. 100/100 frames post-release. Tester §T1 verdict at `f674ced`. |
| #2 / #8 | Warp from autopilot-off Sol → procedural; autopilotMotion=false through warp + 5s | PASS — 0/3656 samples had motion=true. The pre-fix procA observation was residual state leaking across the warp boundary; AC #1 fix releases pre-warp. Code surface at `main.js:6797` retains a latent precondition gap (no `_autopilotEnabled` check) but is not currently reachable — see AC #9 below. |
| #3 | Manual flight gate releases (`flightEnabled=true`) post-release | PASS — `flightEnabled=true` immediately at first post-release sample in all scenarios. |
| #4 | WASD interrupt produces visible motion ≤ 200ms | PASS — 80 scene-units of camera delta at +200ms post-W-press in procedural CRUISE. Includes `restoreFromWorldState` snap-to-closest-body (lines 5015-5022) which produces a teleport-style pose change, not a smooth handoff. Felt-experience evaluation deferred to AC #13 recording. |
| #5 | Q off → on produces fresh tour leg | PASS — cycle 1 bodyId=444 (idx=10), cycle 2 bodyId=422 (idx=5). Different body, different queue index. Robustness probe with forced `_phase='CRUISE'` residual state: Q-press still cleanly engages. |
| #6 | stopFlythrough idempotent + complete | PASS — early-return guard now checks all 4 motion components; release calls `flythrough.stop()`, `autoNav.stop()`, `shipChoreographer.stop()`, `autopilotMotion.stop()`. |
| #7 | cameraController.bypassed resets | PASS — `bypassed=false` post-release in all telemetry. The closest-body branch at lines 5015-5019 doesn't explicitly set `bypassed=false`, but `restoreFromWorldState()` at `src/camera/CameraController.js:763-764` (and `ShipCamera.js:294-295`, `ShipCameraSystem.js:680-681`) sets `this.bypassed = false` as its first line. Internal contract holds. |
| #11 | Closure-scoped flight gates not held by autopilot lifecycle | PASS — `warpTarget.turning=false`, `warpEffect.isActive=false`, `keybinds-overlay`/`settings-panel`/`sound-test-panel` all hidden in 0/183 post-interrupt frames. None of the gate vars are stuck. |
| #12 | HUD reveal across toggle boundary | PASS by current state — `body.hud-hidden` not set, `body-info-printout`, `burn-btn`, `minimap-canvas` all visible post-release. Felt-experience verification in AC #13 recording. |
| #13 | Seamlessness recording | Captured separately at the to-be-shipped commit. |

## AC #9 — `autopilotMotion.beginMotion()` callsite enumeration

| Line | Function | Precondition check | Risk |
|------|----------|---------------------|------|
| 4915 | `_beginTourLegMotion(stop, priorBody)` | Checks `stop && stop.bodyRef` only. No `_autopilotEnabled` check. | LOW — only called from autopilot-active code paths (Tab / number keys / minimap during tour, line 6738 `motionComplete` handoff). |
| 4972 | `startFlythrough()` | Sets `_autopilotEnabled = true` at line 4936 *before* this call. Function entry is the precondition gate. | None — `startFlythrough` is the engagement point. |
| 6740 | autopilot tour `motionComplete` handoff | Inside `if (autopilotMotion.isActive && !warpEffect.isActive && !splashActive && !titleScreenActive)` at line 6627. The `autopilotMotion.isActive` gate ensures this only runs for an already-engaged tour. | None — gated. |
| 6797 | legacy navSubsystem `orbitComplete` handoff | Inside `else if (flythrough.active)` (line 6756). `flythrough.active` can be true during manual burns, but `autoNav.advanceToNext()` returns null when `autoNav` isn't started, so the `if (nextStop && nextStop.bodyRef)` gate at line 6796 keeps this from firing. **Latent gap:** if a future change makes `autoNav.advanceToNext()` return a stop without an active queue, this would fire `autopilotMotion.beginMotion` even though autopilot is off. **Recommendation: add a defensive `if (!_autopilotEnabled) return` at the top of the orbitComplete block, or at minimum a `_autopilotEnabled` check on the `if (nextStop && nextStop.bodyRef)` line.** Not changed in this workstream — currently unreachable; flagged for the orbitComplete-V1-migration follow-up workstream. |

## AC #10 — `stopFlythrough()` caller intent table

All 11 callers want full release. AC #1's fix delivers full release uniformly; no caller needs additional cleanup work post-fix.

| Line | Context | Intent |
|------|---------|--------|
| 1870 | nav-computer toggle off (autopilot button in nav UI) | Full release |
| 3116 | spawnSystem (non-warp scene swap) | Full release before scene swap |
| 4196 | enterGallery | Full release |
| 5405 | commitBurn (manual burn takeover) | Full release before flythrough re-engages for the burn |
| 7398 | Q keydown — autopilot toggle | Full release |
| 7410 | WASD keydown during autopilot — manual interrupt | Full release |
| 7875 | mouse wheel during autopilot in non-FLIGHT camera | Full release |
| 7926 | mouse drag during autopilot | Full release |
| 7952 | touch tap during autopilot | Full release |
| 8031 | mobile autonav-toggle button off | Full release |
| 8075 | mobile autonav button toggle off | Full release |

## AC #11 — gate var observability

`warpEffect.isActive` and `warpTarget.turning` are exposed on `window` (`window._warpEffect`, `window._warpTarget`). `_settingsOpen` and `_soundTestOpen` are module-scope and not directly readable from console; their associated DOM elements (`#settings-panel`, `#sound-test-panel`) returned `null` `.style.display` in a release-test scenario, suggesting either no inline style is set or the elements aren't rendered when closed. Either way, neither the boolean gate nor the DOM proxy was held during release tests. If a future debugging session needs to assert these directly, a one-line `window._gateProbe = () => ({ settings: _settingsOpen, soundTest: _soundTestOpen })` addition would close the gap; not added here since the release-test telemetry didn't observe stuck gates.

## Bugs surfaced by review (additional to the original 3)

**None of additional-bug class.** The latent gap at line 6797 (AC #9) is the only newly-identified surface, and it's not currently reachable. All originally-cited bugs (1, 2, 3) resolved via AC #1's single fix; the diagnosis correctly identified Bug 1 as the upstream cause and Bugs 2 + 3 as downstream effects.

## Felt-experience caveat for AC #13

Post-release WASD-interrupt produces a `restoreFromWorldState` snap when a closest-body is found (lines 5013-5022). Cinematically this is a teleport-style pose change rather than a smooth handoff from autopilot's STATION-A pose to manual's body-orbit pose. AC #1 + AC #4 are mechanically satisfied (manual flight responds, autopilot releases) but the *transition feel* — Principle 6's continuity — may read as jarring. Felt-experience evaluation is the AC #13 recording's job; if Max reads it as broken, that's a follow-up workstream on the handoff-smoothing seam (the architecture knows where the seam is — `cameraController.restoreFromWorldState` vs. autopilot's parked camera pose — but doesn't currently bridge them).
wasn't tested here — the gate killed the input every time.
