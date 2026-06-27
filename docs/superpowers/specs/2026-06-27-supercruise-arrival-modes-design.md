# Supercruise Arrival + Mode Restructure — Design

**Date:** 2026-06-27 · **Branch:** `feature/supercruise-freelook` (continues the
supercruise arc) · **Status:** design APPROVED by Max in-thread 2026-06-27;
authored autonomously overnight per Max's instruction ("do everything through
implementation in workflows… document well, test well, review tomorrow morning").

> **Provenance.** Brainstormed with Max 2026-06-27. Research + recon via Workflow
> `wf_61b958ba-7e6` (4 Elite-Dangerous research agents + 5 code-recon agents, all
> opus; synthesis re-verified line anchors live). Brief saved at
> `/tmp/.../scratchpad/supercruise-arrival-modes-design-brief.md`. This supersedes
> the 2026-06-25 `F = ON/OFF` decision (`supercruise-flight-toggle-settings-design`)
> by splitting the one F-toggle into **two independent buttons** (the key insight
> that resolved the design).

## Why this matters (traceability)

The supercruise-freelook arc (UAT-passed, accepted 2026-06-27) made supercruise
THE in-system mover. This arc finishes the *experience*: **what happens when you
actually reach a planet**, and a **mode model** that lets the same flight system
serve both the **screensaver** (autopilot tours, showcasing bodies — the 35%
SCREENSAVER-MVP milestone) and the **player** (drop in/out, fly manually or with
assist, look around freely — the GAME-tier flight capability). One flight system,
two drivers, three player-facing modes.

## The core: two independent toggles + a separate Toybox mode

The design crux (Max, 2026-06-27): **the button that starts/ends supercruise and
the button that takes/releases the flight controls are DIFFERENT buttons.** They
are orthogonal axes:

```
                  SUPERCRUISE ON                 SUPERCRUISE OFF (dropped out)
                  (drive engaged, fast travel)   (drive idle, parked / coasting)
┌───────────────┬──────────────────────────────┬──────────────────────────────┐
│ CONTROLS ON   │ Piloting in supercruise       │ Dropped out, hands-on         │
│ (hands on     │ • mouse-stick steers          │ • re-orient / aim; re-engage  │
│  stick)       │ • W/S throttle                │   supercruise (E) to leave    │
├───────────────┼──────────────────────────────┼──────────────────────────────┤
│ CONTROLS OFF  │ Free-look while cruising       │ Dropped out, free-look        │
│ (= free-look) │ • autopilot/coast flies it    │ • parked at the planet, just  │
│               │ • you drag the camera          │   look around (the "arrival") │
└───────────────┴──────────────────────────────┴──────────────────────────────┘
   TOYBOX is a third, separate mode (Esc / menu): orbit + examine a selected
   body; click/select a body to jump to it. (Today's default non-flight view.)
```

### Layered state model (implementation framing)

Three orthogonal layers, NOT one ring:

1. **Regime: Toybox ↔ In-Flight.** Toybox = `CameraMode.TOY_BOX` (orbit a body).
   In-Flight = the supercruise camera path (`CameraMode.FLIGHT`, `bypassed=true`,
   `scHead.applyTo` drives the camera). **Esc** exits In-Flight → Toybox. Entering
   In-Flight happens by engaging supercruise (E) from Toybox.
2. **Drive: Supercruise ON ↔ OFF ("dropped out").** Within In-Flight, **E** toggles
   the *drive*. ON = the SupercruiseModel propels along the nose (accelerate to the
   gravity-well-capped cruise speed). OFF = "dropped out": the drive idles, momentum
   is preserved (coast; decays gently; the gravity-well cap parks you near a body).
   You stay In-Flight (camera unchanged, pose-preserving — no re-anchor).
3. **Controls: Hands-on ↔ Free-look.** Within In-Flight, **F** toggles whether *you*
   steer (hands-on: mouse-stick + W/S) or *look around* (free-look: click+drag moves
   the camera via `HeadMount`; the ship keeps doing whatever it was — coasting,
   driving, or autopilot-flown). Re-grab (F) eases the view back to center-on-nose.

**Autopilot/Assist** is a fourth concern that rides on top: an auto-steerer
(`SupercruisePilot` via `ShipControls`) that works the same controls a player
would, cancelling on manual input. It does not add a mode; it's "who's holding the
stick" when your hands are off.

## Key bindings

| Key | New meaning | Was |
|---|---|---|
| **E** | **Supercruise drive toggle** (engage drive / **drop out**). From Toybox, engages → enters In-Flight. Works anytime. | *unbound* (free) |
| **F** | **Free-look toggle** (hands-on ⇄ free-look; recenter on re-grab) | supercruise flight ON/OFF |
| **Esc** | Exit In-Flight → Toybox (after its existing dismiss/deselect chain) | dismiss/deselect (extended) |
| **Q** | Autopilot tour (screensaver) — unchanged | autopilot tour |
| **W/S** | Throttle (hands-on); cancels autopilot/assist (takeover) — unchanged | throttle/takeover |
| **A/D** | Stick (hands-on) — unchanged | stick |
| **Tab / 1-9 / click / nav** | Select/cycle a body (target source for Assist) — unchanged | select |
| **Space** | Commit selection → Assist fly-to the selected body — unchanged | commit |
| middle-mouse (hold) | Momentary free-look "peek" (stays in current control state) — kept | hold-to-look |

**E and R were both unbound**, so assigning supercruise to **E** displaces nothing.
F's old engage/disengage logic moves onto E (the `scControls.engage()/disengage()`
calls). R stays free (reserved).

## Feature 1 — Supercruise drive toggle + drop-out (E)

- **Engage (E from Toybox or from a dropped state):** enter In-Flight if not already;
  `scControls.engage()` (reads Settings type; default hands-on Manual); drive ramps
  up; **camera-shake accel swell** fires.
- **Drop out (E while driving):** the drive idles at the **current position/pose**
  (no re-anchor — reuses the pose-preserving exit pattern from `flightExitAnchor`/
  `adoptCurrentPose`, but you *stay In-Flight* rather than going to Toybox). Momentum
  preserved; gravity-well `speedCap` parks you near a body, you coast in open space.
  **Camera-shake jolt** fires. Works **anytime, anywhere**.
- **"SAFE TO DROP" indicator (already exists, `_scDropState()` main.js:6107):** keep it
  as *guidance* — it tells the player when dropping leaves them cleanly parked at the
  selected target (`in-window`) vs coasting past (`too-fast`). It does NOT gate the E
  action (you can drop anytime); it just informs.
- **Anti-clip (Max's "forced out near a planet", confirmed mechanic):** you can't
  supercruise *into* a body. Re-engaging the drive (E) while your nose vector points
  into a body: the gravity-well `speedCap` collapses to ~zero so you can't accelerate
  in; if you're already too close + fast, the engage immediately drops back out.
  Pointed away → you accelerate off normally. **No damage / cooldown / penalty
  system** — the gravity well *is* the wall (we have no hull system; screensaver-first).
- **Why this is safe:** dropping out = pose-preserving + drive-idle. It does NOT
  re-anchor the camera on the body center — which is exactly the bug that forced the
  removal of the old auto-capture drop-out (2026-06-25, main.js:7648-7659) and caused
  the F-off snap-back (fixed 2026-06-27, `7bd261c`). We re-introduce a drop-out, but a
  *controlled, pose-preserving* one.
- **Min-speed floor:** **OFF.** Elite never fully stops in supercruise (~30 km/s
  floor); we deliberately diverge — dropping out (E) is how you stop, and free-look /
  toybox are the genuinely-stationary views. Throttle 0 while driving still decays
  toward (but the drop is the real "stop").

## Feature 2 — Free-look as a latched mode (F)

- **F toggles latched free-look** within In-Flight (works in any drive state). Today
  free-look is middle-mouse *hold* (main.js:9351/9406, `scHead` HeadMount). We add the
  latched toggle; the momentary middle-mouse *peek* stays for quick glances.
- **In free-look:** the mouse drives the **camera** (`scHead.addLook`) instead of the
  virtual joystick (reuse the existing `scHead.held` gate that already freezes the
  joystick). The ship keeps doing what it was (coast / driving / autopilot). **F again
  → eased recenter to center-on-nose** (`HeadMount.update` RECENTER_TAU, already built).
- **Selection-via-free-look (new):** in free-look you can **aim the reticle at a body
  and click to select it** (route the existing `hitTestBodies`/`trySelect` →
  `scControls.selectTarget` used in Toybox into the free-look state). Then Space commits
  → Assist fly-to. This is one of the two target sources for Assist (the other is the
  nav computer).
- **Apply-path gap to close (from recon):** `scHead.applyTo` currently only runs inside
  the supercruise sim branch. Latched free-look must apply every frame while In-Flight
  regardless of drive state. Ensure the head pose composes after any pilot/coast update
  and before `_composeShakeOntoCamera()` (order already correct for shake; preserve it).

## Feature 3 — Toybox as an explicit mode

- Toybox already exists (`CameraMode.TOY_BOX`, orbit `_applyOrbit`, drag-spin, scroll-
  zoom, `trackTarget` re-center, select-to-jump via commit). The only changes:
  - **Esc exits In-Flight → Toybox** (extend the existing Esc chain at main.js:8525;
    after dismissing overlays/deselecting, if In-Flight → drop drive + leave to Toybox).
  - Optional **menu entry** (settings/HUD) to switch to Toybox explicitly.
  - Keep the mobile always-Toybox constraint untouched.
- The F-off snap-back fix (`7bd261c`, clears focus on exit) stays; leaving to Toybox
  still uses the pose-preserving anchor so there's no jump.

## Feature 4 — Autopilot (tour) + Assist (player-directed)

Same pilot (`SupercruisePilot` → `ShipControls`), two target sources:
- **Autopilot (tour) — the screensaver default.** Q toggles it (unchanged). The
  AutoNavigator picks targets and tours all bodies; the pilot flies via the controls.
  This is what runs idle/unattended. Free-look (F) works during it (watch + look around).
- **Assist (player-directed).** The player picks a destination — by **aiming at a body
  in free-look + selecting**, or via the **nav computer** — then **Space commits** →
  `scControls.flyTo` flies throttle + steering there (this path already exists via
  `commitBurn`/`focusPlanet`). On arrival the gravity well parks you (drop guidance
  shows SAFE TO DROP). **Any manual input cancels** the pilot (existing takeover).
- **Consolidation:** frame Q-tour and the Settings 'Assist' type as the one "autopilot"
  concept (system-picks vs you-pick). Keep the existing `flightControlType` plumbing;
  no behavior regressions. (Light consolidation — do not rebuild the pilot.)

## Feature 5 — Enter/exit camera-shake FX

- **Asymmetric** (the Elite rule): **engage supercruise (E) = an accel SWELL**
  (crescendo-then-fade); **drop out (E) = a JOLT** (impact-then-ring). Reuse the
  existing `ShipChoreographer` one-shots `debugAccelImpulse()` / `debugDecelImpulse()`
  (rotation-only, composed by `_composeShakeOntoCamera()` after the head pose, so
  free-look + shake coexist).
- **Magnitude:** the cruise tremor is a subtle 0.2°. Enter/exit want a **bigger,
  shorter** beat — add a dedicated "jolt" envelope/peak set rather than reusing the
  cruise amplitude (the carrier/envelope architecture supports it).
- **Lifetime-on-exit caveat:** shake composes only while the sc branch is live. A drop
  jolt must out-live the drive-idle flip — fire it on the last driving frame, or keep
  composing for ~0.5s after. (Less of an issue here than the old design since we stay
  In-Flight on drop.)
- Shake = the *jolt only*. The blue-streak/whoosh/FOV-punch render effects are OUT of
  scope (separate render channel; not this arc).

## Feature 6 — Fix the Assist "hangs on a moon" bug

Surfaced during verify; "reach the planet" will hit it more. Symptom: Assist sometimes
fails to converge within ~55s and flips its target to a moon (e.g. Dione). Root cause
(recon): ALIGN holds throttle 0 until nose-dot ≥ 0.995 against a *moving* target, which
can hang when the target (an orbiting moon) keeps moving. Fix: lead the moving target
(aim where it will be) and/or relax/timeout the ALIGN dot gate so it proceeds. Keep the
scale-bug floors untouched. Add a unit test for the moving-target ALIGN case.

## Non-goals (explicit)

- No blue-streak / whoosh / FOV-punch render FX (shake jolt only).
- No normal-space flight model / combat / docking / stations.
- No hull/damage/cooldown penalty system (the gravity well is the anti-clip wall).
- No min-speed floor.
- No world-origin rebasing work (deferred; [[well-dipper-rebasing-plan]]).
- No re-enabling NPC ships / Ship Scanner (stay `SHIPS_ENABLED=false`).
- Do NOT re-tune `SC_TUNING` cap/hold/DROP floors or camera min/maxDistance (scale-bug
  guard — two prior live regressions were exactly this).

## Acceptance criteria

- **AC1 (unit) — drive toggle model.** Engaging the drive accelerates along the nose to
  the gravity-well-capped speed; dropping out idles the drive while preserving momentum
  (no instant zero); re-engage aimed into a body cannot exceed ~0 speed (anti-clip);
  aimed away accelerates. Headless model tests.
- **AC2 (unit) — free-look latched + recenter.** A latched free-look flag routes look
  input to the head mount and freezes the joystick; toggling off eases the head back to
  center within tolerance; ship trajectory is identical with/without free-look input.
- **AC3 (integration, live) — E drop-out is pose-preserving.** In-flight at varying
  world-origin drift, press E to drop out: camera world position + orientation unchanged
  across the drop (dPos≈0, quatDot≈1), drive idles, you stay In-Flight. Re-engage E
  resumes; aimed into a planet you don't accelerate in. Measured via testing-ref §6.5
  (camera world transform + dQuat).
- **AC4 (integration, live) — mode machine.** E from Toybox enters In-Flight + drives;
  F toggles free-look (click+drag moves camera, ship keeps moving, recenter on re-grab);
  Esc exits In-Flight → Toybox with no snap; selection persists appropriately.
- **AC5 (integration, live) — Assist via free-look + nav.** Aim at a body in free-look,
  select, Space → pilot flies you there and parks (SAFE TO DROP shows in-window);
  nav-computer selection does the same; manual input cancels the pilot.
- **AC6 (integration, live) — autopilot tour unaffected.** Q tour still flies + tours
  bodies via the controls; free-look works during it; no regressions to the screensaver
  loop (warp → arrival → tour → auto-warp).
- **AC7 (integration, live) — enter/exit FX.** Engage = a visible accel swell; drop =
  a visible jolt, asymmetric; no position displacement from shake (rotation-only
  invariant held).
- **AC8 (unit+live) — Assist moving-moon convergence.** Assist converges on an orbiting
  moon (e.g. Dione) without hanging or target-flipping within a bounded time.
- **AC9 (UAT — Max only).** The whole thing reads right: E drops you in/out cleanly, F
  free-look feels good, arriving at a planet feels like an arrival (jolt + park),
  autopilot still showcases the system, nothing snaps. Deferred to Max.

## Testing approach

- **Unit (headless vitest):** AC1, AC2, AC8 — drive/coast/anti-clip model, free-look
  flag + recenter, moving-target ALIGN. `./node_modules/.bin/vitest run src/flight
  src/camera src/ui`.
- **Integration (live, chrome-devtools :9223/:5174, working-Claude drives):** AC3-AC7 —
  per testing-ref §6.5 (camera world transform + dQuat), fresh `:5174/well-dipper/`
  tab, mute, hard-reload (main.js is the bundler entry). Drift the world origin before
  drop-out checks (the snap-back blind spot — a fresh tab hides it).
- **Build:** `npm run build` clean (NOT `npx vite` — hook-blocked; the word "vite" in
  commit msgs/echo also trips the hook).
- **UAT:** Max rides it (AC9). No agent closes UAT.

## Risk / reversal notes

- **Reverses the 2026-06-25 `F = ON/OFF` decision** — but cleanly: F=ON/OFF was chosen
  to kill a *confusing 4-state ring*; we are NOT resurrecting that ring. We split into
  two clear single-purpose toggles (E drive, F free-look), which is simpler per-button,
  not more complex. `advanceFlightMode` (the retired ring, flightModes.js:20) stays
  retired; do not resurrect it.
- **Re-introduces a drop-out** (removed 2026-06-25 for the body-center re-anchor jump) —
  but the new one is **pose-preserving** (no re-anchor), which structurally avoids that
  bug class. AC3 measures the camera transform to prove it.
- **Big main.js rewiring** (key handlers ~8789-8822, the F/E split; sim branch for the
  drive-idle state; free-look apply path). Sequence main.js edits; verify headless +
  live at each seam.

## Key file:line anchors (from recon, re-verified)

F-handler `main.js:8789`; Q autopilot `8825`; W/S takeover `8841`; Esc chain `8525`;
drive/exit internals `_enterFlightInternal`/`_exitFlightInternal` ~`8373`/`8400`;
drop-state `_scDropState` `6107`; old removed drop-out `7648-7659`; shake dispatch
`7667-7672` / compose `6601`; CameraMode enum `ShipCameraSystem.js:53`; orbit
`_applyOrbit` `ShipCameraSystem.js:509`, `trackTarget` `601`; HeadMount recenter
`HeadMount.js` (`update`/`centered`); free-look bind `main.js:9351`/`9406`; joystick
gate `~9215`; pilot capture `SupercruisePilot.js:125`; speedCap `SupercruiseModel.js:57`;
ShipControls surface `ShipControls.js:92-137`; Settings flightControlType `Settings.js:63`.
