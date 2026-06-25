# Spec — Supercruise: F = flight on/off, type in Settings, no-snap exit, cursor stays visible

**Date:** 2026-06-25 · **Branch:** `feature/supercruise-freelook` (worktree `well-dipper-supercruise`)
**Approved by Max** (brainstorming, 2026-06-25): "make F turn on/off flight controls; switch the *type* of flight
controls in the Settings menu; the cursor stays on screen in flight; even in Assist the ship does nothing until
flight is engaged (F-on) — this is for player control, not the attract autopilot."

> Supersedes the **mode-switching UX** of the session-4 4-state F-ring (`4fa6c28`). It does **NOT** rebuild the three
> flight behaviors (Manual / Align-on-select / Assist) — those stay exactly as built (`flightModes.js`, `aimAssist.js`,
> `SupercruisePilot.js`). Only *how you switch them* (F-ring → F-toggle + Settings) and *how you leave* (no-snap exit)
> change, plus the cursor stays visible.

## Problem (Max's UAT, 2026-06-25)
Two issues on the session-4 build:
1. **Exit snaps the camera** to another point in the system instead of leaving it where it is.
2. **No easy way to free the mouse to select a different body** while flying (cursor effectively unusable as a
   selector; especially wanted for Assist).

Max reframed both into **one** mechanism: F is a clean on/off toggle, and the *type* lives in Settings. Then "free the
mouse to re-select" is just **F-off → click → F-on**, and the only remaining bug is that **F-off must not teleport**.

## Root causes (verified against current code)
- **Exit snap is an ORIENTATION re-derivation, not position.** The exit
  (`src/main.js` ~8833 `_next.exit` branch) calls `cameraController.adoptCurrentPose(findClosestBody().position)`.
  Toy-Box orientation is *always* `lookAt(target)` (`ShipCameraSystem._applyOrbit`), and `target` is anchored on the
  **closest body** — decoupled from where the camera was looking. `adoptCurrentPose`'s push-out preserves *position*,
  but the first orbit tick re-points the camera at the closest body → the visible snap. (Session-4's "Δ=0.00" missed
  this because it sampled the **frozen model** position, not the **camera** transform.)
- **Cursor "hidden" but actually visible.** `setScManual(true)` sets `document.body.style.cursor='none'`, but the
  full-viewport `<canvas>` carries its own cursor, so the OS cursor still renders over the canvas. Session-3 verified
  the `body` CSS property (passed) rather than the rendered result (still shows) — a "measured the wrong thing" miss.
  Max wants it visible anyway → remove the hide.

## Design

### 1. F = flight on/off (replaces the 4-state ring)
`KeyF` becomes a 2-state toggle keyed on the existing `_scManual`:
- **F when OFF → ENGAGE.** Reuse the current ENTER setup (`cameraController.bypassed=true`, FLIGHT camera, etc.).
  Set the active type from Settings: `_flightMode = settings.flightControlType`, then `_enterFlightMode(_flightMode)`
  (which begins Align/Assist if that's the type). Toast: `Flight ON — <Type>`.
- **F when ON → DISENGAGE (clean, no snap).** `setScManual(false)`; `scPilot.stop()`; `_alignState.active=false`;
  `cameraController.setCameraMode(TOY_BOX)`; **anchor the orbit on the camera's current forward ray** (below);
  `cameraInterp.resync(camera)`; `_flightMode = MANUAL`. Toast: `Flight OFF`.
- Retire `advanceFlightMode` from the F path (keep the module; the enum + behavior helpers stay in use).

### 2. No-snap exit — forward-ray anchor (Issue 1)
Replace the `findClosestBody().position` anchor with a point on the camera's **current forward direction**, passed to
the **existing** `adoptCurrentPose` (no `ShipCameraSystem` change needed):
```
forward = camera.getWorldDirection()            // world -Z, normalized
d = clamp( dist(camera, selectedBody ?? closestBody ?? fallback), minDistance, maxDistance )
anchor = camera.position + forward * d
```
Math (verified): `adoptCurrentPose` back-solves yaw/pitch from `camera − anchor = −forward·d` and pushes
`target = camera + dist·forward` (on the forward ray). `_applyOrbit` then reconstructs the **exact** camera position
*and* `lookAt(target)` reproduces the **exact** look direction → **zero snap** for position and orientation, even when
`d` is distance-clamped. `d` only sets the post-exit orbit-pivot scale (a sensible body distance). Implement the anchor
as a **pure, unit-tested** helper (`flightExitAnchor(cameraPos, forward, d)` → Vector3-like) so the pose-preservation
invariant is asserted in headless tests, not just live.
*Minor edge:* if the flight camera had roll/bank, Toy-Box's level `lookAt` levels it (a small roll change, not a
teleport). Acceptable; note in tests.

### 3. Flight-control type in Settings
Add **"Flight control type"** to the Settings menu (`src/ui/Settings.js`), following the existing settings pattern
(persisted to the same `localStorage` settings object, default-applied, read by main.js the same way other settings
are). Options: **Manual / Align-on-select / Assist**. Default **Manual**. main.js reads it on **F-on** (changing it
mid-flight applies on the next engage). One-time default for existing users (no migration needed — absent key →
Manual).

### 4. Cursor stays visible in flight
Remove cursor hiding: `setScManual` no longer writes `cursor:'none'`; drop/relax the `!_scManual` guards on the
hover-pointer writes so the pointer behaves normally while flying. Verify the **rendered/computed** cursor (canvas +
body `getComputedStyle().cursor !== 'none'`) in flight, not just a style property.

### 5. Ship still until engaged — even for Assist
Because the *type* is only a Settings value and **nothing engages `scPilot` until F-on**, selecting "Assist" does not
fly the ship. With flight OFF the model is frozen (no drift, no autopilot takeover). Only F-on hands the assist pilot
the stick at the currently selected target. (Re-select uniform across types: **F-off → click body → F-on**.)
The **attract-mode autopilot** (Q / idle screensaver) is a separate axis and is **untouched**.

### 6. In-flight behaviors unchanged
Manual steering (mouse virtual joystick, absolute-from-center), Align one-shot ease, Assist continuous hold, W/S
throttle incl. reverse, middle-mouse freelook, and the session-4 disengage rules (Assist drops on manual stick/throttle
input; W/S takeover resets `_flightMode=MANUAL`) all stay **as-is**. Only switching/exit/cursor change.

## Acceptance criteria
1. **F is a 2-state on/off toggle** (no 4-ring cycling). OFF→ENGAGE uses the Settings type; ON→DISENGAGE leaves flight.
2. **Settings → "Flight control type"** = Manual / Align-on-select / Assist; persisted; default Manual; F-on uses the
   current value.
3. **F-off leaves the camera EXACTLY where it is** — measured on the **camera world transform**: Δposition ≈ 0 and
   Δquaternion ≈ 0 (forward/look direction preserved). No teleport to another point. (Roll level-out tolerated.)
4. **Cursor visible during flight** — computed cursor over canvas AND body ≠ `'none'` while `_scManual` is true; hover
   pointer works in flight.
5. **With type = Assist and flight OFF, the ship does not move** (`scPilot.isActive===false`, model position stable);
   **F-on engages** the assist pilot toward the selected target.
6. **Re-select flow** works in every type: F-off → click a different body → F-on engages flight at the new selection
   (Assist re-targets / Align re-aims / Manual selects). Attract autopilot unaffected.
7. **No regressions:** flight + camera-interpolator + HUD + flightModes/aimAssist suites green; `npm run build` clean;
   full suite known-failures-only. **Scale-bug floors (`SC_TUNING`) and camera `minDistance/maxDistance` untouched.**

## Verification plan
- **Headless unit:** `flightExitAnchor` pose-preservation (reconstructed position == camera, look dir == forward, across
  ranges incl. clamped `d`); Settings persistence/default for the new key; the F on/off state transitions
  (engage reads type, disengage resets `_flightMode`). Existing suites stay green.
- **Harness (`flight-controls-lab.html`):** exercise F on/off + the forward-ray exit (assert reconstructed camera pose
  delta ≈ 0) and the Settings-type → engage path, where feasible in the lab's real-model context.
- **Live (`:9223` / `:5174`, hard-reload + mute):** subagent measures the **camera** `position` + `quaternion` before
  vs. after F-off (Δ≈0); confirms computed cursor ≠ 'none' in flight; with Settings=Assist confirms ship stationary
  while OFF and pilot engaging on F-on; runs the F-off→select→F-on re-select loop; 0 new console errors.

## Non-goals (explicit)
- Control-harness / autopilot-base + Tasks 12–13 (next arc item, deferred).
- Any change to the attract-mode autopilot, to pointer-lock (Max's standing "no pointer-lock"), to scale-bug floors,
  or to the Manual/Align/Assist *behaviors*.
- HUD speed-unit / text-size taste items (separate polish spec, unchanged).

## Constants that must NOT be touched
`SC_TUNING` cap/hold floors (`src/flight/SupercruiseModel.js`: `ETA_K`, `CAP_MIN_FRAC`, `CAP_MIN_ABS`, `CAP_MAX`,
`ACCEL_TAU`, `TURN_RATE_*`, `THROTTLE_RATE`); camera `minDistance=0.01` / `maxDistance=50000`
(`src/camera/ShipCameraSystem.js`). The fix lives in the F-handler, a pure anchor helper, `Settings.js`, and the
cursor-hide removal.
