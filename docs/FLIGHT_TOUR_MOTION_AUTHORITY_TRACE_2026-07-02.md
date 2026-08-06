# Tour Motion-Authority Trace (2026-07-02)

**Why this exists:** during Step-0 UAT (from HELM), Max saw autopilot movements "that don't
look like what the flight navigation system is capable of outputting" and asked whether
legacy autopilot functions are still in play. Opus code-explorer trace, HEAD ~`6e9ef79`.
Feeds: inc-4 scope (mode ownership), inc-2/3 arrival design, Step-0 re-UAT.

## Direct answer

**No legacy autopilot motion code runs during the tour.** `NavigationSubsystem`,
`FlythroughCamera`, and `CameraChoreographer` are all dormant — the legacy driver sits in an
`else` branch (`main.js:8271`) unreachable while `scPilot.isActive`; the ORRERY body-tracker
is gated `!cameraController.bypassed` (`main.js:8409`) and the tour sets `bypassed=true`.
The single wired legacy path (`focusShip` → `navSubsystem.beginMotion`, `main.js:6589`,
marked QUARANTINED) cannot fire from a tour — ships are never tour stops
(`AutoNavigator.buildQueue:32-70`).

## What the "impossible" movements actually are

1. **Every arrival is a position LERP, not flight.** `SupercruisePilot.js:156`: on capture
   (anywhere inside 10R) the ship *glides* to the hold point (2.6R / star standoff) via
   `m.position.lerp(holdPoint, k)` (τ=0.6s → up to ~7.4R of straight-line slide over
   ~1.8s), ignoring nose direction, thrust, and turn caps. Paired with
   `SupercruisePilot.js:158` → `aimAssist.js:19-23`: a quaternion **slerp** that swings the
   nose onto the body faster than `TURN_RATE_MAX` allows. Modern, deliberate easing
   ("reproduce STATION-A linger") — but by construction not physics, and it reads that way.
2. **Collision-barrier snap** (`SupercruiseModel.js:186`) — hard projection onto the 1.05R
   sphere; rare discontinuity.
3. **Shake is rotation-only** (`ShipChoreographer` → composed at `main.js:8258`); never a slide.

Everything else in a tour leg (turn-toward, accelerate, gravity-capped cruise, decel) is
genuine flight physics (`SupercruiseModel.js:127-170`).

## Camera: there is NO god's-eye tour anymore (stale-doc discovery)

The only camera writer during a tour is `HeadMount.applyTo` (`HeadMount.js:70-74`, called
`main.js:8202`): camera **welded to the ship**, first-person, in BOTH modes.
`CameraInterpolator` is render smoothing only. The 2026-06-27 mode design's "ORRERY
god's-eye contemplative tour" framing describes the *legacy* `FlythroughCamera` orbit rig,
dead since the 2026-06-10 supercruise cutover. **Consequence: inc-4's "move the tour's
rendering into the cockpit regime — the big part" is largely already true.** Inc-4 reduces
to: boot-mapping flip, regime/input/HUD ownership, mobile default decision.

## The HELM mix (what Max was inside)

`Z` from HELM (`main.js:9582`) calls `startFlythrough()` with **no regime reset** — HELM's
`_scManual` stays `true` while `scPilot.isActive` is `true`. Every leak, with anchors:

| Leak | Where | Effect during the tour |
|---|---|---|
| **Q/E roll injected into tour motion** | `main.js:8468` (runs whenever `_scManual`) | Pilot's `setTurnInput` writes yaw+pitch only (`SupercruiseModel.js:72-75`), never zeroes roll → player roll input **persists in the autopilot's flight** |
| Mouse-steer live under autopilot | `main.js:10008` | `_scDeflection` jiggles the reticle dot as if hand-flying (turn input overwritten by pilot each frame — transient) |
| W/S contention | `main.js:8457-8464` | MANUAL mode: W/S writes throttle against the pilot (transient); ASSIST: cancels the leg |
| HELM HUD persists | `_applyPointerHud` state from boot (`main.js:9005`) | Steering reticle shown + OS cursor hidden for the whole tour — HUD claims hands-on while the pilot flies |
| Boot mapping inverted | `flightModes.js:201-204` | ORRERY→autopilot, HELM→manual — inverse of Max's standing model (HELM owns autopilot; ORRERY player-only; no mixing) |

**Categorized (HELM view):** (a) flight-physics — transit turns/speeds; (b) modern
non-physics easing — the arrival lerp/slerp (the "doesn't look like the flight system"
motion); (c) regime *state/input* mixing — the table above (no camera leak; camera is
first-person in both regimes); (d) legacy nav code — **none live**.

## Dispositions

- **Mode ownership (thin workstream, recommended before Step-0 re-UAT):** `Z`/
  `startFlythrough` asserts the autopilot regime (single owner: clear `_scManual` or a
  dedicated pilot-regime flag; `_applyPointerHud` swap; zero roll on pilot legs), ORRERY
  never auto-arms the tour, boot mapping flipped per Max's model. Small — the camera work
  inc-4 feared is already done.
- **Arrival easing (inc-2/3 design decision, Max's taste):** keep the HOLD lerp/slerp
  (smooth, cheap, non-physical) vs. replace with a physics decel + ETA-scheduled arrival
  (research: Elite blue-zone rule) so arrivals *look like flying*. Flag at inc-2 scope.
- 2026-06-27 mode-restructure doc: mark the god's-eye-tour framing stale when inc-4's
  contract opens (it must reconcile that doc anyway).
