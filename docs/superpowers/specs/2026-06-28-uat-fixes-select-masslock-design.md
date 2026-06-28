# Design — two UAT fixes: HELM click-select + direction-aware mass-lock

**Date:** 2026-06-28 · branch `feature/supercruise-freelook`
**Context:** Two UAT issues from the sublight-flight/collision ship (master @ `09db316`).
Handoff: `/tmp/well-dipper-supercruise-uat-fixes-handoff-2026-06-28.md`.

## Issue A — left-click selects the centered body in HELM hands-on flight

**Problem.** In desktop HELM hands-on flight the OS cursor is hidden and the mouse
position *is* the virtual flight stick (steering reads absolute mouse-offset from
canvas-center; `flightModes.js:213`). So a click lands at the invisible cursor's
position — almost never on the body the nose points at — finds no in-system body,
and falls through to the background-star selector. Net effect: "click only selects
stars." True cursor-clicking is impossible here because moving the mouse steers.

**Fix.** In HELM hands-on, select what the **nose/reticle** points at (screen-center).
This is the same aim point the hover bracket already samples (`aimPoint`, `_aimBody`),
so "what the bracket is on" becomes "what you select."

- `main.js` `trySelect()`: after the minimap-consume block, if `_pointerCursor === 'none'`
  (desktop HELM hands-on — exactly `pointerHudState(...).cursor === 'none'`), override the
  pick coords to canvas-center before the raycaster/`hitTestBodies` path.
- `main.js` `mouseup` handler: `if (isDrag) return;` → `if (isDrag && _pointerCursor !== 'none') return;`
  so a left-press reliably selects in hands-on (mouse-as-stick means down→up often
  exceeds the 5px drag threshold; there is no drag-to-orbit in this mode to protect).

**Scope.** Desktop HELM hands-on only. Free-look (cursor visible), orrery, mobile unchanged.
**Verify.** Live in Sol: fly nose onto a planet, then a moon, left-click → selects that body, not a star.

## Issue B — direction-aware forced-drop / mass-lock near a star

**Problem.** `SupercruiseModel.proximityDropRequired()` is distance-only, so you can't
engage supercruise near a star even when pointed away ("too close"). Both consumers
(simStep forced-drop, E-key reengage block) use it, so a one-sided fix would re-drop
next tick (flicker).

**Fix.** Make the predicate direction-aware on the **nose**: a body inside its
forced-drop distance (`max(FORCED_DROP_FLOOR_FACTOR·radius, escape-velocity horizon)`)
only blocks when `nose · (body − position) > 0` (pointed toward). Pointed away or
tangent → doesn't block. Both consumers call the same parameterless method, so they go
direction-aware together — no flicker. The hard collision barrier in `update()` stays
direction-blind (the physical floor). No real gravity pull exists, so "fly away" is fine.

- Preserved: head-on approach to a star still force-drops (capture-on-approach).
- New: pointing away lets you engage and leave.

**Tests (TDD).** Extend `src/flight/__tests__/SupercruiseModel.sublight.test.js`:
inside horizon + nose-toward → true; nose-away → false; tangent → false; far → false
regardless of facing. Update existing distance-only assertions to aim the nose at the body.

## Out of scope
Velocity-aware variant (Max chose nose-direction); cursor-visible HELM steering rework;
Rule-3 doc catch-up (tracked separately in the handoff).
