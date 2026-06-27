# Free-look Interaction Redesign + Cursor-by-Mode + Boot-flow Reorder — Design

**Date:** 2026-06-27 · **Branch:** `feature/supercruise-freelook` (continues the
supercruise arc) · **Status:** design APPROVED by Max in-thread 2026-06-27.

> **Provenance.** This spec sits alongside the
> [ORRERY ↔ HELM mode-restructure spec](./2026-06-27-orrery-helm-mode-restructure-design.md)
> (the peer-mode model — ORRERY = god's-eye overview station, HELM = in-ship piloting —
> and its splash mode-picker). That spec established WHICH mode you boot into and how M /
> HUD / Options swap stations; THIS spec changes HOW the cursor and steering HUD behave
> per sub-mode, redesigns the free-look interaction inside HELM, and prepends a black
> ORRERY/HELM chooser to the boot (the original title sequence is left UNCHANGED — see the
> CORRECTED Part 3). The two specs share the same boot/splash surfaces and
> the same ORRERY/HELM vocabulary — read them together. **DESKTOP only unless noted;
> mobile stays ORRERY-only and touch-driven and must be left working.**

## Summary

Three coupled changes, one spec:

1. **Part 1 — Cursor + steering-HUD by sub-mode.** Hide the OS cursor in HELM hands-on
   flight; show it in HELM free-look and in ORRERY. Hide the flight-HUD center crosshair
   and the joystick deflection dot in free-look; restore them in hands-on. Driven by one
   pure reducer applied on every regime / free-look transition.
2. **Part 2 — Free-look, redesigned.** F still toggles free-look MODE on/off, but looking
   now happens ONLY while the left mouse button is held (hold-to-look). Bare mouse motion
   in free-look is a FREE CURSOR (no steer, no camera move) for pointing/selecting; a
   click selects a body; the view HOLDS where you dragged it on LMB-release and only
   recenters when you EXIT free-look (F off), via a fast-but-graceful ease.
3. **Part 3 — Boot: prepend a black ORRERY/HELM chooser (CORRECTED 2026-06-27).** A new
   minimal BLACK splash showing ONLY ORRERY and HELM replaces "Do you wish to begin?".
   Picking records the choice, then plays the ORIGINAL title sequence UNCHANGED (intro
   logos → WELL-DIPPER title → music → warp); only the end drops you into the chosen mode.

These changes SUPERSEDE the deliberate 2026-06-25 "cursor stays visible in flight"
decision (`main.js:468-473` comment): selection now happens in free-look where the cursor
is shown, so the comment is updated rather than honored.

## Part 1 — Cursor + steering-HUD by sub-mode

### Why `cursor:none`, not Pointer Lock

We hide the OS cursor with CSS (`document.body.style.cursor = 'none'` / the canvas cursor
style), **not** the Pointer Lock API, for two concrete reasons:

- **The virtual joystick reads ABSOLUTE mouse position** relative to canvas-center
  (`main.js` mousemove free-look branch ~9445-9489, the `_scManual && !held` ABSOLUTE-
  position `scControls.steer` path). Pointer Lock delivers only relative `movementX/Y` and
  zeroes absolute position — it would break the joystick's absolute read entirely.
- **Pointer Lock hijacks Esc** to exit the lock. Esc is load-bearing in the mode model
  (it drops selection / closes overlays per the mode-restructure spec); we cannot cede it.

So cursor visibility is purely a CSS concern: `cursor:none` hides it without touching
input semantics; `cursor:auto` restores it. (Pointer Lock stays in use ONLY for the
minimap drag at `main.js:9582/9649/9670` — that is untouched.)

### What hides in free-look

The flight HUD's CENTER CROSSHAIR (the cross) and the JOYSTICK DEFLECTION DOT
(`SupercruiseHud.js:124-133`) HIDE while in free-look and RETURN in hands-on. These two
are the steering indicators — they have no meaning when the joystick is gated off and the
cursor is free. The speed / throttle readouts STAY visible (they still inform).

### Centralize: one pure reducer

A single pure reducer — `pointerHudState({ regime, freeLook, isMobile })` — returns
`{ cursor: 'none' | 'auto', showReticle: boolean }`. It is applied on EVERY transition
that changes regime or free-look:

- enter / exit flight (HELM ↔ ORRERY swap, per the mode-restructure spec — we only CALL
  the apply on swap; we do not touch the swap logic itself),
- F toggle (free-look on/off).

Rules the reducer encodes:

- `cursor:'none'` IFF desktop AND HELM hands-on (regime = HELM, free-look OFF).
- `cursor:'auto'` in HELM free-look, in ORRERY, and ALWAYS on mobile.
- `showReticle:true` (cross + deflection dot drawn) in HELM hands-on; `false` in free-look.
- **Mobile: cursor is irrelevant (touch) and must NEVER be hidden.** `isMobile` forces
  `cursor:'auto'`.

The reducer lives in `src/flight/flightModes.js` with a co-located unit test; the `main.js`
wiring is the thin apply (set `document.body`/canvas cursor; pass `showReticle` into the
HUD visibility path at `main.js:8414-8419`).

## Part 2 — Free-look, redesigned

F still toggles the free-look MODE on/off. Mobile returns early from F (unchanged).

### Today vs. the change

Today free-look is **latched**: once F is on, the latch re-asserts `scHead.held` EVERY
FRAME (`freeLookApply.syncHeadToFreeLook`), so ALL mouse motion looks around and the
joystick freezes. The redesign DECOUPLES `scHead.held` from the latch:

- **Looking happens ONLY while LMB is held.** In free-look: LMB-down → `scHead.beginLook()`;
  LMB-up → `scHead.endLook()`. The latch no longer re-asserts `held`. (`syncHeadToFreeLook`
  stops force-holding while latched.)
- **HOLD LMB + drag = look around** — `scHead.addLook(-mx*0.003, -my*0.0025)` from
  `e.movementX/Y`, as today. Reuse the existing 5px click-vs-drag threshold (`isDrag`,
  `main.js:9687`) to distinguish a look-drag from a click.

### Bare mouse in free-look = a free cursor

With LMB UP in free-look, bare mouse movement must NOT steer the ship and must NOT move
the camera — the cursor moves freely for pointing/selecting:

- **Gate the virtual-joystick branch OFF whenever free-look mode is active.** The
  `_scManual && !held` ABSOLUTE-position `scControls.steer` path (`main.js` ~9445-9489)
  must not fire in free-look, even with LMB up. (Today the joystick would steer here.)
- The camera does not move on bare motion because `held` is false, so `scHead.addLook`
  no-ops (`HeadMount.addLook` early-returns when `!held`).

### Click a body = select (existing path), stay in free-look

A CLICK (LMB down+up, moved < 5px) SELECTS a planet / moon / star via the EXISTING path:
`trySelect → hitTestBodies → scControls.selectTarget` (mouseup handler ~`main.js:9710`).
Behavior by flight mode, per Max:

- **In ASSIST**, the existing path already flies an Assist leg to the picked body
  (`selectTarget → focusPlanet/Star/Moon → flyTo`). It MUST **fly but STAY IN FREE-LOOK** —
  do NOT auto-exit free-look. The player keeps looking and can re-pick mid-flight.
- **In MANUAL**, a click just HIGHLIGHTS (sets `_selectedTarget`, arms BURN). The selection
  SURVIVES when the player exits free-look (F) to fly it manually, or presses Space to
  commit the burn.

### View stays on LMB-release; recenter only on F-exit

- **Releasing LMB after a look-drag must NOT recenter.** The view HOLDS where you dragged
  it. This requires a HeadMount change: today `HeadMount.update` eases yaw/pitch → 0
  whenever `!held` (`HeadMount.js:38-44`), which would WRONGLY recenter on every LMB
  release. Add a **hold-position vs. recenter** distinction:
  - **HOLD** (no ease) while free-look mode is active AND not looking (LMB up between drags).
  - **RECENTER** (eased) ONLY when free-look is EXITED (F off).
- **Recenter on F-exit is FAST BUT GRACEFUL** — a quick eased return to nose-forward (not
  an instant snap, not a slow drift). Use a snappy ease (~150-250 ms / a small
  `RECENTER_TAU`), exposed as a SINGLE NAMED CONSTANT so Max / working-Claude can tune the
  exact feel live afterward.

### Peek preserved

The middle-mouse PEEK (hands-on quick look) keeps working unchanged
(`main.js` mousedown ~9600-9603 / mouseup ~9652-9658). It drives `held` directly on
press/release and is orthogonal to the free-look latch.

## Part 3 — Boot: prepend a black ORRERY/HELM chooser (CORRECTED 2026-06-27)

> **This supersedes the original "picker is the cold-open" Part 3.** That version
> (commit `c8e7b53`) turned the WELL-DIPPER title screen itself into the picker, removed
> "Do you wish to begin?", and made *picking* trigger the logos. Max corrected it: the
> title sequence must stay UNTOUCHED; only a new chooser is prepended and the chosen mode
> is consumed at the end. Reworked in the boot-flow-redo commit below.

### Today (pre-session)

`#splash-screen` "Do you wish to begin?" (first) → click → `startIntroSequence()` plays
`'intro'` music + DESHE/score logos over ~8s → `#title-screen` (WELL-DIPPER + "press
anything to begin") shows at 8000 ms with `'title'` music → "press anything" /
music-driven auto-dismiss → `dismissTitleScreen()` → screensaver/warp.

### The change

A **new, minimal BLACK splash showing ONLY the two choices ORRERY and HELM** replaces the
"Do you wish to begin?" splash as the begin-gate (the FIRST screen, nothing else on it).

- **Selecting ORRERY or HELM records the choice** (`_pendingBootMode`) **then runs the
  ORIGINAL title sequence COMPLETELY UNCHANGED**: `startIntroSequence()` → DESHE/score
  intro logos (~8s) → WELL-DIPPER title screen ("press anything to begin") → `'title'`
  music → press-anything / music-driven auto-dismiss → warp. The intro logos, title
  screen, music cues, and timing are exactly as before this session.
- **The ONLY difference from the pre-session flow:** the chooser is prepended, and when
  the title screen ends/dismisses the player drops into the chosen mode (HELM → flight;
  ORRERY → autopilot tour) instead of always the autopilot tour.
- The picker is OFF the title screen — the title screen is plain again. The intro is NOT
  skippable and the music semantics are untouched (the original `dismissTitleScreen`
  still `musicManager.stop`s on dismiss, exactly as before).

So: **black ORRERY/HELM chooser → [original unchanged title sequence] → chosen mode.**
The choice is captured up front (`#splash-screen` repurposed) and consumed once at the
first star-system arrival; the title sequence in the middle is left alone.

### Preserve

- The legacy "press anything" = ORRERY path: a click on the black background (not on a
  button) defaults to ORRERY via `_handleSplashDismiss`.
- The title screen's music-driven auto-dismiss to the ORRERY / screensaver auto-warp.
- Mobile = ORRERY-only (HELM hidden on mobile).
- The D-hold debug skip (lands directly in Sol) on the splash background.

The boot decision stays expressed by the pure `bootModeAction(mode)` reducer
(`flightModes.js`): `{ mode: 'helm'|'orrery', enterFlight: helm }`, consumed unchanged in
`warpRevealSystem`. The change is only WHERE the pick is captured (the new black chooser
instead of the title screen) — not a new boot path, and not a reorder of the intro.

## Non-goals (explicit)

- Do NOT add Helm to mobile (mobile stays ORRERY-only; cursor untouched on mobile).
- Do NOT change ORRERY orbit / select behavior beyond cursor visibility.
- Do NOT touch the ORRERY ↔ HELM swap logic itself — only CALL the new cursor/HUD apply on
  swap (the swap internals are owned by the mode-restructure spec).
- Do NOT use Pointer Lock for cursor hiding (breaks the absolute-position joystick + Esc).
- Do NOT disturb the minimap Pointer Lock (`main.js:9582/9649/9670`).
- Internal identifiers may stay as-is; rename user-facing strings only where strings change.
- No new parallel boot flow — reorder the existing one.

## Acceptance criteria

- **AC1 (unit) — `pointerHudState` reducer.** `pointerHudState({regime, freeLook, isMobile})`
  returns `cursor:'none'` IFF desktop AND HELM hands-on (HELM regime, free-look OFF);
  `cursor:'auto'` for HELM free-look, ORRERY, and any mobile case; and `showReticle:true`
  for HELM hands-on, `false` for free-look. Headless (`src/flight/flightModes.js` test).
- **AC2 (unit) — mobile never hides the cursor.** For `isMobile:true`, `pointerHudState`
  returns `cursor:'auto'` in EVERY regime/free-look combination. Headless.
- **AC3 (integration, live) — cursor hidden in HELM hands-on, visible elsewhere.** In HELM
  hands-on the OS cursor is hidden (`document.body`/canvas `cursor:none`); entering
  free-look (F) shows it; in ORRERY it is shown; swapping HELM↔ORRERY re-applies correctly
  on each transition. *Deferred to Max (UAT layer).*
- **AC4 (integration, live) — crosshair + deflection dot hidden in free-look.** Entering
  free-look hides the HUD center cross and joystick deflection dot
  (`SupercruiseHud.js:124-133`); the speed/throttle readouts stay; exiting free-look
  restores cross + dot. *Deferred to Max (UAT layer).*
- **AC5 (integration, live) — free-look looks ONLY while LMB held.** In free-look, holding
  LMB and dragging looks around (camera yaw/pitch changes); the latch no longer holds the
  head — releasing LMB stops the look. Headless-where-possible (HeadMount/freeLook hold
  decoupling) + live confirmation. *Live portion deferred to Max (UAT layer).*
- **AC6 (integration, live) — bare mouse in free-look does not steer.** With LMB UP in
  free-look, moving the mouse moves a free cursor only — the ship does not steer (virtual-
  joystick branch gated off) and the camera does not move. *Deferred to Max (UAT layer).*
- **AC7 (integration, live) — click selects a body in free-look.** A click (< 5px move) on
  a planet/moon/star in free-look selects it via the existing `trySelect →
  scControls.selectTarget` path. *Deferred to Max (UAT layer).*
- **AC8 (integration, live) — ASSIST click flies but stays in free-look.** In ASSIST,
  clicking a body flies an Assist leg toward it AND leaves free-look ACTIVE (no auto-exit);
  the player can re-pick mid-flight. *Deferred to Max (UAT layer).*
- **AC9 (unit + live) — view holds on LMB-release, recenters only on F-exit.** With
  free-look active and LMB released after a look-drag, `HeadMount` HOLDS yaw/pitch (no ease
  toward zero); only F-exit triggers an eased recenter governed by the single named
  recenter constant. The hold-vs-recenter distinction is unit-tested on `HeadMount`
  (held-released-in-freelook holds; freelook-exit eases). Headless unit + live feel.
- **AC10 (unit) — MANUAL selection survives free-look exit.** In MANUAL, a free-look click
  sets `_selectedTarget`/arms BURN, and the selection is not cleared by exiting free-look
  (F off). Modelled at the reducer/logic level where the decision lives; live confirm
  deferred. *Live portion deferred to Max (UAT layer).*
- **AC11 (integration, live) — black chooser is the first screen; original title sequence
  unchanged; end drops into the chosen mode (CORRECTED 2026-06-27).** On cold load the
  BLACK ORRERY/HELM chooser is shown first with nothing else (replacing "Do you wish to
  begin?"); picking a mode records it and runs the ORIGINAL `startIntroSequence` UNCHANGED
  (DESHE/score logos → WELL-DIPPER title → `'title'` music → press-anything/auto-dismiss →
  warp); the warp enters the chosen mode (HELM → `_enterFlightInternal`, ORRERY → autopilot
  tour). The black-background "press anything" defaults to ORRERY; the title's music-driven
  auto-dismiss to the ORRERY screensaver still fires. *Verified live (working-Claude,
  2026-06-27): both HELM and ORRERY paths confirmed; UAT-feel deferred to Max.*
- **AC12 (unit) — `bootModeAction` drives the reordered boot.** `bootModeAction('helm')`
  → `{mode:'helm', enterFlight:true}`; `bootModeAction('orrery')` and any unknown/missing
  pick → `{mode:'orrery', enterFlight:false}`. (Pins the boot decision the reorder threads;
  reuses the existing reducer.) Headless.
- **AC13 (integration, live) — mobile stays ORRERY-only with cursor untouched.** On mobile
  the picker shows ORRERY only (HELM hidden), boot enters ORRERY, F returns early, and the
  cursor is never hidden. *Deferred to Max (UAT layer).*
- **AC14 (UAT — Max only) — it reads right as a whole.** The cursor disappears the moment
  you take the Helm and returns the moment you free-look; the steering reticle gets out of
  the way for looking; LMB-drag-to-look feels natural and holds where you left it;
  recenter-on-F feels snappy-but-graceful; clicking bodies in free-look selects/flies
  intuitively; the boot opens on the black ORRERY/HELM chooser, the original title
  sequence plays unchanged, and you drop into the mode you chose. *Deferred to Max.*

## Testing approach

- **Unit (headless vitest):** AC1, AC2, AC9 (HeadMount hold-vs-recenter), AC10
  (MANUAL-selection-survives logic), AC12 (`bootModeAction`). Pure reducers + HeadMount
  state live in `src/flight/`. `npx vitest run src/flight src/camera src/ui`.
- **Integration (live, chrome-devtools):** AC3–AC8, AC11, AC13 — cursor visibility per
  sub-mode, crosshair/dot hide, hold-to-look, free-cursor-no-steer, click-select,
  ASSIST-flies-but-stays, the black-chooser→original-intro→title→warp→chosen-mode flow, and
  mobile ORRERY-only. Working-Claude drives the objective live integration checks; the UAT-layer
  ACs (the felt-feel halves of AC3–AC8/AC11/AC13 and AC14) are **deferred to Max** — no
  agent closes UAT.
- **Build:** `npm run build` clean.

## Cross-references

- Mode-restructure spec:
  [`2026-06-27-orrery-helm-mode-restructure-design.md`](./2026-06-27-orrery-helm-mode-restructure-design.md)
  (the ORRERY/HELM peer-mode model, the splash mode-picker, M/HUD/Options swap — this spec
  layers cursor/HUD-by-sub-mode, the free-look redesign, and the boot reorder on top).
- Arc spec:
  [`2026-06-27-supercruise-arrival-modes-design.md`](./2026-06-27-supercruise-arrival-modes-design.md)
  (free-look latch + recenter origin — `syncHeadToFreeLook` / `consumeRecenter`, redesigned
  here to hold-to-look + hold-on-release).
- Superseded decision: the 2026-06-25 "cursor stays visible in flight" comment
  (`main.js:468-473`) — updated here; selection now happens in free-look where the cursor
  is shown.
