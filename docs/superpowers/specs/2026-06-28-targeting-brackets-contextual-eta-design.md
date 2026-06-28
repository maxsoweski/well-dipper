# Spec — Targeting brackets + contextual ETA (Piece A: IUAT Issues 3 + 1)

**Date:** 2026-06-28
**Branch:** `feature/supercruise-freelook`
**Scope:** Restore the dimmed-bracket / hover targeting system (regression from the
Arc B cursor-by-mode work) and make the approach ETA counter contextual to where
the player is aiming. **Sibling piece B** (sublight flight + body-mass plumbing,
IUAT Issue 2) is scoped separately and is NOT part of this spec.

**Driving outcome (line of sight):** the *felt* supercruise→arrival experience.
Seeing selectable bodies, animating one as your aim crosses it, and glancing a live
ETA at the destination you're flying toward are core to making arrival feel real and
legible. This piece restores legibility the Arc B work accidentally removed.

---

## Background — what actually broke (root-caused)

The bracket/hover **drawing pipeline is unchanged** by Arc B (`TargetingReticle.js`
untouched; it already draws dim "tentative", bright "selected", and the 400ms
"ghost lock-in" tighten animation). The regression is a side-effect of hiding the
cursor:

- `pointerHudState()` (`src/flight/flightModes.js:227-233`) returns `cursor:'none'`
  for desktop **HELM hands-on** flight. The hover that feeds the dim bracket is set
  from the **mouse position** in the mousemove handler (`src/main.js:9599-9620`).
  With the cursor hidden — and with the mouse position in hands-on actually being the
  **virtual-joystick deflection**, not an aim — there is nothing meaningful driving
  the hover in flight mode. ORRERY and HELM free-look keep a visible cursor, so they
  still work.
- The ETA counter (`src/ui/SupercruiseHud.js:144-176`) is gated on `hasTarget`
  (a body is *selected*), so it shows whenever a target exists regardless of where
  the player is looking.

There is **no separate per-target hover pulse** in the code (now or pre-regression).
The "animation … when you cover your cursor over that bracket" is the **ghost
lock-in**: a body's dim brackets start ~2.5× loose and tighten with `easeOutCubic`
over 400ms as it comes into hover range (`TargetingReticle.js:339-359`). It is intact;
it only needs a valid aim point + a settable `_hoverTarget` to be seen.

---

## Behavior (the contract, in Max's words)

1. **Brackets.** Every selectable system body shows a **dim** bracket. The **selected
   target** shows a **bright** bracket. When the player's **aim point** crosses a dim
   bracket, it **animates** (the ghost lock-in tighten).
2. **Aim point — by mode.**
   - **ORRERY** and **HELM free-look (bare cursor):** aim point = the **OS cursor**
     (mouse position). *Unchanged from today — already works.*
   - **HELM hands-on flight:** aim point = the **fixed center reticle** (screen
     center). You aim by **flying so a body crosses the center reticle**
     (look-to-target). The cursor stays hidden (per the Arc B spec decision).
3. **Contextual ETA.** The **M:SS** ETA appears only when the aim point is over the
   body you are **traveling toward** (the selected/autopilot destination) **and** you
   are moving. Aim away → it hides. Fully contextual; glance back to check.

### Mode matrix (target state)

| Mode / sub-mode | Dim brackets | Aim drives hover via | Bright (selected) bracket | Cursor | Contextual ETA when aim on dest |
|---|---|---|---|---|---|
| ORRERY (tour / cursor) | yes | OS cursor (mouse) | yes | visible (`auto`) | yes |
| HELM free-look (LMB up) | yes | OS cursor (mouse) | yes | visible (`auto`) | yes |
| HELM free-look (LMB-look drag) | frozen at last aim | — (look consumes motion) | yes | visible | last state holds |
| **HELM hands-on flight** | **yes (FIX)** | **screen center (FIX)** | yes | hidden (`none`) | **yes (FIX)** |
| In-supercruise autopilot | yes (regime is ORRERY-like, cursor visible) | OS cursor | yes | visible | yes |
| Mobile (any) | yes | touch/pointer position | yes | n/a (`auto`) | yes |

Only the **HELM hands-on flight** row changes. Everything else is preserved as-is.

---

## Design — units & data flow

### Unit 1 — `aimPoint()` (pure, new, in `src/flight/flightModes.js`)
A pure function next to `pointerHudState()`:

```
aimPoint({ cursorHidden, mouseX, mouseY, centerX, centerY }) -> { x, y }
```
Returns `{centerX, centerY}` when `cursorHidden` is true (desktop HELM hands-on),
else `{mouseX, mouseY}`. `cursorHidden` is exactly `pointerHudState(...).cursor ===
'none'`, so the two helpers stay consistent by construction. **Fully unit-tested.**

### Unit 2 — per-frame aim hover (Issue 3), in the render loop `src/main.js:~8409`
The HUD update block already runs every frame and already consumes `_hoverTarget`
(→ `_hoverForReticle`, line 8424). Before that consumption:

- Track the live cursor position in `_mouseX/_mouseY` (set in the mousemove handler;
  one assignment).
- Compute `const aim = aimPoint({ cursorHidden: _pointerCursor === 'none', mouseX:_mouseX, mouseY:_mouseY, centerX, centerY })`
  (`centerX/Y` = canvas center).
- `const aimBody = hitTestBodies(aim.x, aim.y)` — **one** hit-test per frame (replaces
  the per-mousemove hit-test as the hover source; `hitTestBodies` was already called
  on every mousemove, so once-per-frame is no costlier and is free when idle).
- Set `_hoverTarget = aimBody`, preserving the existing **selected-target
  suppression** (if `aimBody` is the selected target, `_hoverTarget = null` so the
  bright reticle isn't double-drawn — current lines 9603-9609).

The **mousemove handler keeps** its cursor-feedback role (paint `'pointer'` on
hover in cursor-visible modes; orbit-line hover) but **no longer owns** the
`_hoverTarget` value — the render loop is now the single source. This makes flight
mode work (center aim, no mouse motion needed) without changing cursor-mode feel
(aim still follows the mouse, now sampled per-frame instead of per-move).

### Unit 3 — contextual ETA flag (Issue 1), `src/main.js:~8458` + `SupercruiseHud.js:144`
- In the render loop, compute `aimOnTarget = !!(aimBody && _selectedTarget &&
  _isSameTarget(aimBody, _selectedTarget))` (reuses `aimBody` from Unit 2 and the
  existing `_isSameTarget`).
- Pass `aimOnTarget` into `scHud.update({...})` (alongside the existing `targetPos`
  / `targetDistance`).
- In `SupercruiseHud.js`, gate the **ETA line only** on `state.aimOnTarget` (in
  addition to the current `speed > 0 && targetDistance != null`). **Default
  decision (flag for review):** the `SAFE TO DROP` / `SLOW DOWN` drop labels stay
  on `hasTarget` (always shown while you have a destination) — they are
  approach-*safety* cues, not a glanceable counter, so they should not vanish when
  you look away. Only the ETA counter is made contextual.

### Unchanged
`TargetingReticle.js` (drawing, ghost lock-in), `hitTestBodies`, the selected-target
selection pipeline, `pointerHudState`'s cursor/showReticle outputs, all cursor-mode
hover feel.

---

## Testing

**Unit (TDD, pure logic):**
- `aimPoint()` — center when `cursorHidden`, mouse otherwise; mobile/`auto` path
  returns mouse/pointer.
- ETA-visibility reducer — a small pure predicate `etaVisible({ speed,
  targetDistance, aimOnTarget })` extracted so the gate is tested without canvas.

**Integration (headless + adversarial review by subagent).**

**Live (working-Claude via chrome-devtools):**
- HELM hands-on: fly so a body crosses center → dim bracket appears + ghost-lock-in
  animates; selected destination shows bright bracket; ETA shows only while center is
  on the destination, hides when nose points away.
- ORRERY + HELM free-look: hover behavior unchanged (regression check).
- Debug hooks: `window._getReticleState()`, `window._hitTestBodies(x,y)`,
  `window._reticle`.

---

## Out of scope (explicit non-goals)
- Sublight flight, body-mass plumbing, sphere-of-influence rest frame, mass-based
  speed cap, sublight speed scale — that is **Piece B / Issue 2**, scoped separately.
- Any change to ORRERY / free-look hover feel.
- Any new hover animation (the ghost lock-in is the animation).
- Mobile-specific targeting redesign (mobile keeps `cursor:'auto'` → pointer aim).
