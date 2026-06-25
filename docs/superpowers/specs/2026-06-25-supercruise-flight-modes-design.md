# Supercruise flight modes — F cycles three flight-assist modes + entry tooltip

**Date:** 2026-06-25 · **Branch:** `feature/supercruise-freelook` (worktree `~/projects/well-dipper-supercruise`)
**Builds on:** `2026-06-25-supercruise-polish-ui-stick-cursor-design.md` and `2026-06-24-supercruise-hud-movement-design.md`
(manual supercruise + HUD + flight-controls harness, all live-verified + pushed).
**Approved by Max** (brainstorming, 2026-06-25): three assist modes; **F cycles** `Manual → Align → Assist → Exit`
(4-state ring, the "Exit" slot leaves flight); a tooltip shows the mode on each entry.

> **STATUS 2026-06-25:** BUILT + headless-verified + 3-lens adversarially reviewed + LIVE-verified ALL-PASS on
> `:9223`/`:5174`. VERIFIED_PENDING_MAX `4fa6c28`. Commits `d7049ba`→`4fa6c28` (8). Awaiting Max UAT.

Currently F is a 2-state toggle: it flips the FLIGHT camera mode on/off (`src/main.js:8759`). This replaces that toggle
with a 4-state ring and layers two new assist behaviors on top of the existing manual flight, **reusing** the autopilot
pilot (`scPilot`), the selected-target state (`_selectedTarget`), and the clean no-jump exit (`adoptCurrentPose`).

**Elite research (done 2026-06-24/25 — do not redo):** base supercruise = fully manual aiming (selecting a target does
**not** auto-rotate the nose); Supercruise Assist = a continuous opt-in hold (manual-align + blue-throttle first), which
auto-throttles/auto-drops and disengages on manual rotation input. So **Mode A** is Elite-faithful, **Mode C** is the
Elite-faithful assist, and **Mode B** (align-on-select) is Max's own idea, not Elite.

---

## 1. The cycle / state machine

New module-scoped state next to `_scManual` (`src/main.js:443`):

```
const FlightMode = { MANUAL: 'manual', ALIGN: 'align', ASSIST: 'assist' };
let _flightMode = FlightMode.MANUAL;   // only meaningful while _scManual === true
```

"Off" (Toy-Box screensaver) is represented by `_scManual === false`; `_flightMode` is the *in-flight* sub-state. The F
handler (`src/main.js:8759`) becomes:

| Current state | F press → | Action |
|---|---|---|
| **off** (`!_scManual`) | enter **Manual** | today's enter branch (setScManual(true), scPilot.stop, seed scModel from camera, bypass) + `_flightMode=MANUAL` + tooltip |
| **Manual** | **Align** | `_flightMode=ALIGN` + tooltip; if a target is selected, run the one-time align now |
| **Align** | **Assist** | `_flightMode=ASSIST` + tooltip; if a target is selected, engage the continuous hold now |
| **Assist** | **Exit** | today's exit branch (setScManual(false), scPilot.stop, `adoptCurrentPose(findClosestBody())`, `cameraInterp.resync`) + tooltip "Exit flight" |

Entry guards unchanged (mobile, warp-active, splash/title, non-star-system all early-return — `src/main.js:8760-8766`).
The seamless **W/S takeover** while the autopilot screensaver flies (`src/main.js:8825-8833`) continues to enter flight at
**Manual** (`_flightMode=MANUAL`).

Default mode on first entry = **Manual** (Elite-accurate baseline; matches today's F behavior). Cycle order is fixed
`Manual → Align → Assist → Exit` (increasing assistance, then leave).

## 2. Mode A — Manual (≈ today, Elite-faithful)

Select a body → green `TargetingReticle` appears; you steer onto it with the mouse virtual-joystick and W/S throttle
(incl. reverse). `scPilot` is stopped; the player owns stick + throttle. No auto-align, no auto-throttle. This is exactly
the current manual flight — Mode A is the "no new behavior" baseline.

## 3. Mode B — Align-on-select (Max's idea; Manual + one-shot align sugar)

Mode B is Manual **plus** one sugar: on every target **selection/change**, the nose eases **once** to face the selected
body, then the stick is fully free with **no** continuous drift-back.

- **Trigger:** a change of `_selectedTarget` while `_flightMode===ALIGN` (hook in `selectTarget()`, `src/main.js:5950`),
  AND on entering Mode B if a target is already selected. Resolve the body via `_resolveSelectedBody()`
  (`src/main.js:6016` → `{mesh, radius}`); skip if it returns null (e.g. a ship target).
- **Mechanism:** reuse `SupercruisePilot._lookAtBody`'s primitive (`src/flight/SupercruisePilot.js:126-132`): build the
  target quaternion `setFromUnitVectors(NEG_Z, dirToBody)` and exponentially slerp `scModel.orientation` toward it. Run a
  transient `_alignState = { active, targetMesh }` consumed each **sim** frame (`src/main.js:7531-7613` block); complete
  when `-localZ >= PILOT_TUNING.ALIGN_DOT` (0.995) **or** after a ~1.5 s safety cap, then `active=false`.
- **Taste calls (Max-approved):**
  - A **still stick lets the align finish**; **deflecting the stick past the deadzone cancels the align instantly**
    (never fight the player) — detected at the existing stick site (`src/main.js:9198-9209`, non-zero `shapeStick`).
  - Re-selecting (even the same target) **re-aligns** — selection is a deliberate "look at this" gesture.
  - No target selected → Mode B behaves exactly like Manual until you select one.
- After the one-shot completes, Mode B == Manual (free stick, no drift-back).

## 4. Mode C — Assist / continuous (≈ Elite Supercruise Assist; reuses scPilot)

With a target selected, Mode C **continuously** holds the bee-line, auto-throttles to cruise, and auto-drops at the body
— by pointing the existing autopilot pilot at the selected body.

- **Engage:** when entering Mode C with a target selected, OR selecting a target while in Mode C, call
  `scPilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius })` (`src/flight/SupercruisePilot.js:45`, the same call
  shape the tour uses at `src/main.js:5574`). The existing sim plumbing then drives it: `scPilot.isActive` →
  `scPilot.update(dt)` (`src/main.js:7556`) does the ship-local bee-line steering + CRUISE throttle + decel + auto-drop at
  the `10R / (10R)/2.5` capture window (all already correct and scale-safe — `scPilot.tuning`).
- **Disengage:** **any manual input** — stick past the deadzone (`src/main.js:9198`) **or** W/S throttle
  (`src/main.js:7951`) — calls `scPilot.stop()` (`src/flight/SupercruisePilot.js:52`) while leaving `_scManual` true.
  You're now flying manually; **re-select a target to re-engage** (no auto-resume).
- **Throttle ownership:** while `_flightMode===ASSIST && scPilot.isActive`, the manual throttle/stick application is
  **skipped** (the pilot owns it) — but a manual input event in that state triggers the disengage above and then falls
  through to manual on the next frame. This avoids the player W/S fighting `scPilot`'s throttle.
- **Taste calls (Max-approved deviations from strict Elite):**
  - **No auto-resume** on input-release (Elite-faithful: re-select to re-arm). One-line flip if Max wants resume.
  - **Drop** Elite's "throttle must be in the blue zone before engaging" precondition — entering Assist with a target
    just engages and auto-cruises. Intentional friction reduction; one-line flip.
  - No target selected → Mode C behaves like Manual until you select one (nothing to assist).

## 5. Tooltip on entry — `FlightModeToast`

A small **dedicated DOM element** (`src/ui/FlightModeToast.js`), modeled on `BodyInfo`'s fade-timer idiom
(`src/ui/BodyInfo.js:107-174`: show → ~2 s timer → `fading` class → hide) but its **own** element so it neither collides
with `BodyInfo`'s `#body-info` selection display nor depends on the supercruise HUD's flight-gated visibility.

- `show(modeLabel, hint)` — sets text, restarts the ~2 s auto-fade. Called from the F handler on each transition.
- Labels/hints: `"Manual" / "you fly"`, `"Align-on-select" / "nose centers on your target"`,
  `"Assist" / "auto-flies to target — steer to take over"`, `"Exit flight" / "back to autopilot"`.
- Being its own element (not the HUD canvas) is specifically why **"Exit flight" still shows** even though the
  supercruise HUD hides the instant `_scManual` goes false.
- Optional cosmetic: tint Manual/Align/Assist reticle-green `#64ff82`, Exit amber. Position upper-center, large enough to
  read at a glance. (Style is a taste detail, tunable.)

## 6. Reuse map (file:line — verified by code exploration)

| Need | Reuse | Location |
|---|---|---|
| F handler enter/exit branches | extend in place | `src/main.js:8759-8806` |
| Manual gate / cursor | `setScManual` + `_scManual` | `src/main.js:447`, reads enumerated at 5554/6168/7529/7569/7951/9198… |
| Selected body → `{mesh,radius}` | `_selectedTarget` / `_resolveSelectedBody()` | `src/main.js:317`, `5950` (`selectTarget`), `6016` |
| Mode B one-time align | `SupercruisePilot._lookAtBody` slerp | `src/flight/SupercruisePilot.js:126-132` |
| Mode C continuous hold engine | `scPilot.beginLeg` / `scPilot.update` / `stop` | `src/flight/SupercruisePilot.js:45/59/52`, driven at `src/main.js:7556` |
| Manual-input detection (disengage / cancel) | stick site + throttle site | `src/main.js:9198-9209`, `7951-7961` |
| Tooltip fade idiom | `BodyInfo._show/_fadeOut` | `src/ui/BodyInfo.js:107-174` |
| Per-frame state assembly (HUD readout) | `renderFrame` HUD block | `src/main.js:8339-8352` |

The HUD (`scHud.update`, `src/main.js:8341`) gains a `flightMode` field for an optional mode readout; no behavior change.

## 7. Verification

**Harness-first** (Max's standing pattern): exercise the full cycle + each mode in `flight-controls-lab.html` before any
live-game UAT — the lab already drives the real `SupercruiseModel` + real `SupercruiseHud` + the expo plot; extend it with
a mode-cycle control + readouts so Modes B/C are observable in isolation.

**Unit tests (headless, pure):**
- State machine: off→Manual→Align→Assist→Exit→off ring; entry guards; W/S takeover enters Manual.
- Mode B: align fires on select + on Mode-B entry-with-target; completes at `ALIGN_DOT` / caps at ~1.5 s; **stick deflect
  cancels**; re-select re-fires; null body is a no-op.
- Mode C: engage on entry-with-target + on select-in-Assist; `scPilot` activated with the selected body; **any manual
  input disengages** (stick OR W/S); throttle path skipped while assist drives; re-select re-engages.
- `FlightModeToast`: show restarts timer; auto-fades; "Exit flight" path independent of HUD visibility.

**Existing suites stay green:** flight + UI + camera-interp 71/71; full suite known-failures-only (no new regressions);
`npm run build` clean.

**Live (subagent, GPU `:9223` → the `:5174` worktree tab):** cycle F through all four states (assert tooltip text each
press); Mode B nose-centers once then frees; Mode C flies to the selected body + auto-drops + disengages on stick;
Exit leaves flight with **0.00 position delta** (the adoptCurrentPose guarantee); 0 console errors. Hard-reload after the
main.js edit; mute on load; assert `location.href` contains `:5174` before any action.

## 8. Out of scope (explicitly deferred)

- **The control-harness / autopilot-base** (handoff item 2) and **Tasks 12-13** (retire `AutopilotMotion` +
  `NavigationSubsystem`). Those come **after** this 3-mode system lands (Max's sequencing) and fold into the harness work
  — Mode C already *is* programmatic ship control, which the harness generalizes.
- Re-tuning any scale-bug floor (`CAP_MIN_FRAC`/`CAP_MIN_ABS`/`ETA_K`/`ACCEL_TAU`) — **forbidden** (two prior live
  regressions). The drop-window math is reused verbatim from `scPilot.tuning`.
- Speed-unit crossover / HUD text-size taste items from the polish spec (unchanged here).
