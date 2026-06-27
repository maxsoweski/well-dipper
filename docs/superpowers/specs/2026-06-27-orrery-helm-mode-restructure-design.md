# ORRERY ↔ HELM Mode Restructure + Commit-Burn Assist Takeover Fix — Design

**Date:** 2026-06-27 · **Branch:** `feature/supercruise-freelook` (continues the
supercruise arc) · **Status:** design APPROVED by Max in-thread 2026-06-27.

> **Provenance.** This spec closes the two nuances left open by the
> [supercruise-arrival-modes arc](./2026-06-27-supercruise-arrival-modes-design.md)
> and its contract
> [`docs/WORKSTREAMS/supercruise-arrival-modes-2026-06-27/contract.json`](../../WORKSTREAMS/supercruise-arrival-modes-2026-06-27/contract.json).
> The arrival-modes arc reached `VERIFIED_PENDING_MAX` but flagged two items as
> unresolved: (#1) the COMMIT BURN Assist leg could not be cancelled by manual
> input, and (#2) the mode model still used Esc to "exit flight to Toybox." This
> spec defines the restructure that resolves both. It changes USER-FACING NAMES
> and CONTROL FLOW only — it is **not** an internal refactor. Internal identifiers
> (`CameraMode.TOY_BOX`, `_scManual`, the `FlightMode` enum) stay as-is to minimize
> churn.

## Summary

Two changes, one spec:

1. **#1 — Takeover fix.** A player-directed COMMIT BURN currently activates
   `scPilot` while `_flightMode` stays `MANUAL`, but the manual-cancel gates require
   `_flightMode === FlightMode.ASSIST`. So grabbing the stick/throttle cannot cancel
   the burn. Fix: when a **player-directed** burn starts, set
   `_flightMode = FlightMode.ASSIST` so the existing gates fire; reset to `MANUAL`
   when the leg ends or is cancelled.
2. **#2 — Mode restructure.** The old "Toybox" and "Flight" become two **peer modes**
   named **ORRERY** and **HELM**, chosen at a splash screen and swapped via a hotkey
   (M), an Options-menu item, and a small HUD button — **never via Esc**. Esc loses
   its "exit flight" step entirely.

These match the supercruise PILLARS framing ("both modes coexist, siblings sharing a
universe").

## The Two Nuances

### #1 — Takeover (manual input cancels a commit-burn Assist leg)

The arrival-modes contract recorded this as the one open behavioral gap: AC5's
"manual input cancels the pilot" works for ordinary Assist, but **not** for the
COMMIT BURN path. Root cause (confirmed in the arrival-modes arc): the commit-burn
leg runs the pilot with `_flightMode` left at `MANUAL`, while both live takeover
gates test `_flightMode === FlightMode.ASSIST && scPilot.isActive`. The condition is
never true during a burn, so the burn ignores W/S and stick.

### #2 — Modes (ORRERY / HELM as peer modes, never via Esc)

The arrival-modes arc still leaned on the legacy "Esc exits In-Flight → Toybox"
mental model (Toybox as the "default non-flight view" you fall back to). Max's
decision: that is wrong for sibling modes. ORRERY and HELM are PEERS — you choose one
at the splash and swap deliberately. Esc must never strand you in or out of a mode.

## The Model — two peer modes

| | ORRERY (was Toybox) | HELM (was Flight / In-Flight) |
|---|---|---|
| **Stance** | God's-eye overview. "Watch & plan" station. | In-ship piloting. |
| **Does** | Orbit/inspect bodies, select, plot jumps. Contemplative. | Drive (E), free-look (F), dive gravity wells. |
| **Internally** | `_scManual === false` + `CameraMode.TOY_BOX` | `_scManual === true` + `CameraMode.FLIGHT` |

**Only the user-facing NAME changes** — ORRERY for the overview station, HELM for the
piloting station. The internal `CameraMode.TOY_BOX`, `_scManual`, and `FlightMode`
identifiers are unchanged.

## Splash — mode picker

The existing title/splash screen (the game already has a "title screen → first warp"
flow) becomes the **mode picker**. It presents two choices, **ORRERY** and **HELM**.
Selecting one launches the game into that mode via the **same launch flow used
today** — we extend the existing boot, we do **not** invent a parallel one. Mode is
swappable afterward (see Switching). Mobile is unaffected (mobile is ORRERY-only; see
Mobile).

## Switching modes

Three discoverable entry points, all doing the same swap:

- **Hotkey M** — toggles ORRERY ↔ HELM in both directions.
- **Options-menu item** — same swap, menu-driven.
- **Small HUD button** — same swap, discoverable without knowing the key.

Reuse of the existing enter/exit internals:

- **HELM → ORRERY** swap REUSES `_exitFlightInternal` — the SAME pose-preserving exit
  used today on the old Esc-exit (`setScManual(false)`, `scPilot.stop`,
  `setCameraMode(TOY_BOX)`, `flightExitAnchor` + `adoptCurrentPose` +
  `cameraInterp.resync`, clears focus indices, `_flightMode = MANUAL`). **No snap.**
- **ORRERY → HELM** swap REUSES `_enterFlightInternal` but must **NOT force the drive
  ON** — it preserves the current drive state when swapping with M.

Drive semantics, two distinct keys (convenience preserved from today):

- **M = swap stations only** — the drive is left untouched across the swap.
- **E-from-ORRERY = swap + drive ON** — today's `nextDriveAction(inFlight, driveOn)`
  `'engage'` action: "take the Helm AND light the drive." Unchanged.

## Esc cascade — new order, exit-step removed

Esc **loses its "exit flight" step** (the whole point of #2). New cascade order:

1. Close any open overlay (debug / nav / settings / sound / keybinds).
2. Otherwise, deselect a selected body.
3. Otherwise, **nothing**.

The old EXIT-TO-TOYBOX block (`if (_scManual) { freeLook.exit; scModel.setDrive(false);
_exitFlightInternal(); return }`) is **removed**, and the late "Toybox overview
`focusPlanet(-1)`" Esc handler is removed/neutralized for mode purposes. **Esc must
NEVER switch modes.** Leaving ORRERY (or HELM) is ONLY via the swap key M / HUD button
/ Options item. Mashing Esc can at most drop your selection; it can never strand you
in or out of a mode.

## Select-and-jump + #1 fix

In ORRERY: select a body + **Space** (commit burn) → **auto-swap to HELM** and burn
toward the target as an **ASSIST leg**. The #1 fix makes grabbing the stick/throttle
cancel that burn.

**#1 fix detail.** When a **player-directed** burn starts — COMMIT BURN, or
`focusPlanet` / `focusStar` / `focusMoon` → `scControls.flyTo`, whether triggered from
ORRERY or from an in-flight reselect — set `_flightMode = FlightMode.ASSIST` so the
existing takeover gates fire (the W/S frame-loop gate and the stick mousemove gate,
both `_flightMode === FlightMode.ASSIST && scPilot.isActive`). Reset
`_flightMode = FlightMode.MANUAL` when the leg ends or is cancelled.

**Targeted, not broad (critical).** Do **NOT** broaden the gate to "any
`scPilot.isActive`" — that would also catch the **AUTOPILOT TOUR (Q)**, which has its
own separate takeover. Keep the fix to player-directed legs only. This realises the
arrival-modes spec's intent that "any manual input cancels the pilot" (AC5) for the
commit-burn path specifically.

## No-snap regression guard

Swapping **HELM → ORRERY** and **ORRERY → HELM** must **NOT** snap the camera onto a
body. Both swaps reuse the existing pose-preserving anchor (`flightExitAnchor` /
`adoptCurrentPose` / `cameraInterp.resync`). A HEADLESS camera unit test asserts the
camera pose is preserved across a mode swap (quatDot ≈ 1.0, no body-center
re-anchor), mirroring the existing camera test patterns. The **2026-06-25 body-center
re-anchor regression must stay absent.**

## Mobile + Tour unchanged

- **Mobile:** unchanged — mobile stays ORRERY-only (it is hard-locked to `TOY_BOX`
  today). Do **not** add a Helm to mobile.
- **Autopilot Tour (Q):** keeps working as today in both modes; do **not** restrict
  it, and do **not** let the #1 fix touch it (its takeover is separate).

## Naming

Rename **user-facing strings only**:

- "Toybox" / "Toy Box" → **ORRERY** (e.g. `flightModes.js` `INFO.exit` hint "back to
  Toy Box"; `index.html` keybind hints "Unfocus / exit flight to Toybox").
- user-facing "Flight" / "exit flight to Toybox" → **HELM** / swap semantics (e.g.
  the keybind hints in `index.html:63-68`, and the now-removed Esc "exit flight"
  affordance).

Internal identifiers (`CameraMode.TOY_BOX`, `_scManual`, the `FlightMode` enum) MAY
stay. **This is a user-facing rename, not an internal refactor.**

## Non-goals (explicit)

- No internal-identifier rename (`CameraMode.TOY_BOX`, `_scManual`, `FlightMode` stay).
- No broadening of the takeover gate to "any `scPilot.isActive`" (would catch the Q
  tour).
- No Helm on mobile (mobile stays ORRERY-only).
- No restriction of the autopilot tour (Q) in either mode.
- No new parallel splash/boot flow — extend the existing one.
- No re-introduction of any Esc → mode-switch behavior.

## Acceptance criteria

- **AC1 (unit) — manual input cancels a commit-burn Assist leg.** Starting a
  player-directed burn (commit-burn / `focusPlanet`·`focusStar`·`focusMoon` →
  `scControls.flyTo`) sets `_flightMode = FlightMode.ASSIST`; injecting manual input
  (W/S throttle or stick) while the leg is active cancels the pilot via the existing
  gates; on cancel or leg-end `_flightMode` resets to `MANUAL`. Headless.
- **AC2 (unit) — the Q autopilot tour is NOT cancelled by the #1 fix.** A running
  autopilot tour (Q) leaves `_flightMode` unchanged by the player-directed-burn path,
  and the player-burn takeover gate does not fire for it; the tour's own separate
  takeover is untouched. Headless.
- **AC3 (unit) — `nextDriveAction` drive semantics.** From ORRERY (`inFlight===false`)
  the action is `'engage'` (swap + drive ON); the M swap path leaves the drive state
  untouched (ORRERY→HELM reuses `_enterFlightInternal` without forcing the drive on).
  Headless, asserting `nextDriveAction` plus the M-swap drive-preservation contract.
- **AC4 (unit) — Esc cascade order + no mode switch.** The Esc handler, given an open
  overlay, closes the overlay and stops; given no overlay but a selected body,
  deselects and stops; given neither, does nothing — and in NO branch does it change
  `_scManual` / `CameraMode`. The removed exit-to-Toybox block is gone. **Esc never
  switches modes.** Headless (logic-level).
- **AC5 (unit, camera) — M swaps ORRERY ↔ HELM with no camera snap.** A headless
  camera test asserts the camera pose is preserved across an M swap in each direction
  (quatDot ≈ 1.0, no body-center re-anchor), mirroring the existing camera test
  patterns; the 2026-06-25 re-anchor regression stays absent.
- **AC6 (integration, live) — splash launches into the chosen mode.** Selecting ORRERY
  at the splash launches into the ORRERY station; selecting HELM launches into the
  HELM station — via the existing launch flow, no parallel boot; 0 new console errors.
  *Deferred to Max (UAT layer).*
- **AC7 (integration, live) — M / HUD / Options all swap, both directions, no snap.**
  M toggles ORRERY↔HELM; the HUD button and the Options item do the same; each swap is
  pose-preserving (no camera snap); HELM→ORRERY reuses `_exitFlightInternal`,
  ORRERY→HELM reuses `_enterFlightInternal` without forcing the drive on. *Deferred to
  Max (UAT layer).*
- **AC8 (integration, live) — select-and-jump auto-swaps to HELM and the burn is
  cancellable.** In ORRERY, select a body + Space auto-swaps to HELM and burns toward
  it as an Assist leg; grabbing stick/throttle mid-burn cancels it. *Deferred to Max
  (UAT layer).*
- **AC9 (live) — no user-facing "Toybox" / "Flight" strings remain.** A scan of
  user-facing surfaces (`index.html` keybind hints, `flightModes.js` labels/hints,
  HUD/Options text) shows ORRERY/HELM and no residual "Toybox" / "Toy Box" / "exit
  flight to Toybox" strings. *Deferred to Max (UAT layer).*
- **AC10 (UAT — Max only) — it reads right as a whole.** Splash picks a mode, M / HUD
  / Options swap cleanly with no snap, Esc only ever drops selection, select-and-jump
  flies you in and lets you grab control, the tour still showcases the system, mobile
  stays ORRERY-only. *Deferred to Max.*

## Testing approach

- **Unit (headless vitest):** AC1–AC5 — the player-burn `_flightMode=ASSIST`/reset +
  takeover-gate firing, the Q-tour-untouched guard, `nextDriveAction`/M-swap drive
  semantics, the Esc-cascade logic, and the camera no-snap swap test.
  `npx vitest run src/flight src/camera src/ui`.
- **Integration (live, chrome-devtools):** AC6–AC9 — splash→mode launch, M/HUD/Options
  swaps with camera-transform no-snap checks, select-and-jump auto-swap + mid-burn
  cancel, and a user-facing-string scan. Working-Claude drives the objective live
  integration checks; the UAT-layer ACs (AC6–AC9 holistic feel and AC10) are
  **deferred to Max** — no agent closes UAT.
- **Build:** `npm run build` clean.

## Cross-references

- Arc spec: [`2026-06-27-supercruise-arrival-modes-design.md`](./2026-06-27-supercruise-arrival-modes-design.md)
  (the arc this closes; Esc-exit model superseded here, AC5 takeover completed here).
- Contract: [`docs/WORKSTREAMS/supercruise-arrival-modes-2026-06-27/contract.json`](../../WORKSTREAMS/supercruise-arrival-modes-2026-06-27/contract.json)
  (`VERIFIED_PENDING_MAX`; this spec resolves the two flagged-open items: AC5 commit-burn
  takeover and the Esc/Toybox mode model).
