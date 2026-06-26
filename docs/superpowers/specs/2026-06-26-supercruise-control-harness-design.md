# Spec — Supercruise control harness: name the shared ship-control surface, exercise it harness-first, wire the live game through it, retire the dead motion classes (Tasks 12–13)

**Date:** 2026-06-26 · **Branch:** `feature/supercruise-freelook` (worktree `well-dipper-supercruise`, off `master`)
**Approved by Max** (brainstorming/scoping, 2026-06-26): build the named ship-control surface → exercise it
harness-first in `flight-controls-lab.html` → wire the live game through it → retire the legacy motion classes.
Two scope decisions LOCKED (below). **This spec is the design doc only — no source/FEATURES.md/NOW.md/lab edits here.**

> **Covers Tasks 12–13** of `docs/superpowers/plans/2026-06-10-supercruise-freelook.md`. Tasks 1–11 are DONE
> (autopilot + manual flight + freelook + HUD + 3 flight modes + F on/off toggle + no-snap exit + no-jump
> close-approach), all VERIFIED_PENDING_MAX and pushed. This is the LAST arc item: it does **not** add or change any
> flight behavior — it *names* the control surface the player, autopilot, attract tour, and tests already share, and
> *retires* the three motion systems that no longer sit in the live path.
>
> **Task count, to avoid confusion:** the "12–13" label is *parent-arc bookkeeping* (Tasks 12 and 13 of the freelook
> plan). They are re-decomposed here into the **four** tasks (Parts 1–4) of a *new* implementation plan. So the plan
> this spec feeds has FOUR tasks, not two — "12–13" does not name its task count.

## Line of sight to the outcome

The supercruise arc's whole point is **one** in-system flight model with **two** drivers — the attract autopilot and the
player on the stick. That single-model goal is already met: both drivers push the ship through the **same two calls**,
`model.setThrottle(t)` and `model.setTurnInput(yaw, pitch)`, and `SupercruisePilot` is already "one policy on top." But
three OTHER motion systems still linger in the codebase:

- **`AutopilotMotion`** (`src/auto/AutopilotMotion.js`) — fully dead in the live path (its `beginMotion` only
  self-chains inside its own unreachable `simStep` branch).
- **`NavigationSubsystem` + `FlythroughCamera`** — alive **only** through the NPC Ship-Scanner ship-lock
  (`focusShip`), which the F&F MVP will not ship.

Tasks 12–13 finish the arc: **name a single control surface** that the player, autopilot, attract tour, and tests all
walk through, then **retire the dead systems** so the live path has exactly one flight model and one control door. This
also gives the NEXT autopilot a clean base to build on. **JOURNEY framing:** this serves the "supercruise is THE
in-system motion model" milestone (one model, two drivers) and lives in the F&F-MVP player-experience tier — it removes
legacy scaffolding rather than adding new player-facing feel.

## Structural finding (shapes everything)

**"Generalize SupercruisePilot" = extract + name, NOT rebuild.** The command vocabulary is already universal — the human
stick/throttle and the autopilot both drive the ship via `setThrottle` / `setTurnInput`, and `setThrottle` already
clamps to −1..1 (`src/flight/SupercruiseModel.js:42`), so **reverse is already real** at the model layer; nothing
surfaces it. The work is therefore:

1. **Name the shared handle** (a small `ShipControls` module).
2. **Put callable verbs on `window`** so the lab and tests drive the same object the game does.
3. **Exercise the player-facing motion verbs in the lab** before touching the live game (`stop`/`getState` are unit-covered).
4. **Consolidate the 9 scattered dispatch sites** that call `scPilot.beginLeg` directly.
5. **Retire the dead classes** (dead-ref removal + spawn-disable; no file deletion).

**No new flight behavior.** This is pure surfacing + consolidation + retirement.

## Goals

- A single named control surface — `ShipControls` (`src/flight/ShipControls.js`) — owning `model` + `pilot` + `head`,
  through which the player, the autopilot, the attract tour, and tests all act on the ship.
- A callable **verb surface** on `window._sc.controls` in-game, mirrored in `window._lab` in the lab, so the harness
  drives the **same object** the game does (harness fidelity).
- Three latent correctness fixes folded into the verbs (no behavior added): surface reverse throttle; fix the
  silently-ignored stick-tuning casing bug; keep the on-screen stick marker in sync when steering programmatically.
- A **named arrival signal** for `flyTo` (none exists today — the lab discards the pilot frame).
- A **`getState()`** read of live flight telemetry (also missing today).
- The 9 scattered `scPilot.beginLeg` call sites consolidated to route through the surface — pure consolidation, no
  behavior change.
- `AutopilotMotion` retired (dead refs + unreachable branch removed, file kept + marked retired).
- NPC ship spawning disabled at the single switch, which makes `focusShip`/ship-lock unreachable → `NavigationSubsystem`
  + `FlythroughCamera` fall out of the live path → marked retired, **files KEPT, nav wiring NOT ripped out**.

## Non-goals (YAGNI — explicit)

- **No new flight feel or behavior.** Manual / Align / Assist behaviors, throttle/turn-rate floors, freelook, HUD — all
  stay exactly as built.
- **No Ship Scanner port.** Disabling spawn makes the ship path dormant; we do not migrate it onto the supercruise
  surface.
- **No physical file deletion.** Retirement = dead-ref removal (`AutopilotMotion`) + spawn-disable + "mark retired, file
  kept" (`NavigationSubsystem`, `FlythroughCamera`). Do **not** propose deleting any file.
- **No scale-bug-floor changes.** `SC_TUNING` cap/hold floors and `scPilot.tuning` DROP_* are forbidden to re-tune (two
  prior live regressions `259f855` / `d5e4e2f`). Reuse the single-sourced drop-window math (`10R / (10R)/2.5`).
- **No cockpit, no on-foot, no world-origin rebasing.** Out of arc.
- **No new attract-autopilot behavior.** The screensaver tour already drives `scPilot`; we only route its existing calls
  through the surface.

> The first five non-goals above (flight feel, Ship Scanner port, file deletion, scale-bug floors, cockpit) are Max's
> approved list. "On-foot / world-origin rebasing" and "no new attract-autopilot behavior" are spec-author
> *clarifications* added to reduce risk — they only narrow scope (consistent with the arc), not widen it. A downstream
> plan should not treat these two as independently Max-confirmed constraints without checking.

## Two decisions Max LOCKED

1. **Scope = full Option-3 OUTCOME without hard deletion.** Build the named ship-control surface → exercise it
   harness-first → wire the live game through it → retire the legacy motion classes. (Max first picked "Everything incl.
   port Ship Scanner," then decision 2 mooted the port.)
2. **Ships = DISABLE spawn, PRESERVE code, MARK nav retired (NOT delete).** Turn off `ShipSpawner` spawn → no spawned
   ships → `focusShip`/ship-lock are **unreachable** (every ship site is gated on `shipSpawner.ships`) →
   `NavigationSubsystem` + `FlythroughCamera` fall out of the live path → mark them **retired, files KEPT, dormant for
   ENRICHED reactivation** (same posture as the already-dead `AutopilotMotion`). The committed spec already anticipates
   this: `docs/FEATURES.md:214` — *"disable spawn… or remove ShipSpawner instantiation from `main.js`; preserve code for
   ENRICHED reactivation later."* Do **not** physically delete nav files or ship features. Do **not** port Ship Scanner.

## Architecture (internal decision — already made)

A small **`ShipControls`** module (`src/flight/ShipControls.js`) owns `model` + `pilot` + `head` and is the single door
the player, the autopilot, the attract tour, and tests all walk through.

- **Portable core lives in the class:** the command verbs, the steer-shaping, the `flyTo`→arrival driver, `getState`,
  and the **safe pilot→model update order**. These are host-agnostic and run identically in the lab and the game.
- **Host-coupled bits stay in `main.js` as thin methods the surface delegates to:** the camera-mode toggle, the
  `flightControlType` Settings read, the reticle/toast, the `selectTarget` pipeline, and the `flightExitAnchor` no-snap
  exit. These reach into `cameraController`, `settings`, DOM, and the system graph, so they cannot live in a portable
  class.

**Considered and rejected:** a thinner all-in-`main.js` facade. **Chose** the small class so the LAB drives the SAME
object the game does (harness fidelity) — the recurring failure mode this arc guards against is a lab that exercises a
divergent code path and false-passes (see the retired-4-state-ring risk below).

### Why a class and not just functions

The verbs operate on **live instances** that the 60 Hz sim + render loop also touches. External pokes (lab steps, test
drivers, `window._sc.controls.*`) race that loop. The class lets every verb be a **frame-safe intent-setter** (it sets
inputs the next sim tick consumes) while `flyTo` for headless/lab contexts **steps the model itself** (the precedent is
the existing `window._sc.flyFromRest` at `src/main.js:484,508`, which steps `scModel.update` at fixed 60 Hz and restores
state). The class is the natural home for that "intent-setter in-game / self-stepping headless" split.

## The verb surface

Exposed at **`window._sc.controls`** in-game (alongside the existing `window._sc.{model,pilot,head,hud,…}` at
`src/main.js:484`) and **mirrored in `window._lab`** in the lab (existing `_lab` API at `flight-controls-lab.html:743`).

| Verb | What it does | Why it's new / what it fixes |
|---|---|---|
| `setThrottle(t)` | Sets commanded throttle, **including reverse** (model already clamps −1..1). | Reverse is real at the model (`SupercruiseModel.js:42`) but nothing surfaces it. |
| `steer(x, y)` | Runs the real shaped-stick curve, then steers, **AND updates the on-screen stick marker** (`_scDeflection`). | Fixes a stale-HUD risk (raw `setTurnInput` leaves `_scDeflection`/HUD stick stale). **Also fixes a latent casing bug** (below). |
| `selectTarget(…)` / `deselect()` | Selection through the real reticle/focus/bodyInfo pipeline. `deselect()` is the public verb; it delegates to `deselectTarget`. | Routes through `selectTarget` (`src/main.js:5974`) / `deselectTarget` (`src/main.js:6097`) — the real pipeline, not a lab shortcut. |
| `engage(type)` / `disengage()` | The F on/off toggle made callable; `type` ∈ the **lowercase** `FlightMode` enum values `{'manual','align','assist'}` (`src/flight/flightModes.js:11-13`), read from `flightControlType` (stored verbatim as those same lowercase strings — `src/ui/Settings.js:63`). | No-snap exit preserved (`flightExitAnchor` + `adoptCurrentPose` + `cameraInterp.resync`). |
| `flyTo(target) → arrival` | Wraps `scPilot.beginLeg` + a **NAMED arrival signal** (callback/promise in lab; event/poll in-game). | **No arrival signal exists today** — the lab discards the pilot frame. |
| `stop(mode)` | Halts pilot-driven motion; `mode` distinguishes **idle stop** (zero throttle) vs. **takeover stop** (throttle left latched). | `scPilot.stop()` leaves throttle **latched** (`SupercruisePilot.js:53-57` — Elite takeover semantics); callers need to choose idle vs. takeover. |
| `getState()` | Live read of speed / commandedSpeed / throttle / mode / phase / dropState. | Also missing today. |

### The latent casing bug `steer()` fixes

`stickCurve.js`'s `shapeMagnitude` destructures **lowercase** `{ deadzone = STICK_TUNING.DEADZONE, expo =
STICK_TUNING.EXPO }` (`src/flight/stickCurve.js:7`), while the tuning objects expose **uppercase** `{ DEADZONE, EXPO }`
(`src/flight/stickCurve.js:1-4`; the lab's live copy `const stickTuning = { ...STICK_TUNING }` at
`flight-controls-lab.html:162`; the game's `window._sc.stickTuning` at `src/main.js:484-487`). Passing such an object as
`opts` therefore matches **neither** key, so the defaults always win → **runtime stick tuning is silently ignored today
in BOTH the lab and the game.** The shaped-steer path the verb runs must reconcile this casing so tuning actually takes
effect. (Both refs verified: `stickCurve.js:7` lowercase destructure; `flight-controls-lab.html:162` uppercase spread.)

### "Generalizing the pilot" concretely

Extract the inline steer-toward-body math (`src/flight/SupercruisePilot.js:93-101` — the local-frame direction →
clamped yaw/pitch block) into a **NAMED helper**, a sibling to `aimAssist.alignStep` (`src/flight/aimAssist.js:19`); and
**NAME the pilot's one-shot Frame contract** — the real fields are `{ phase, prevPhase, phaseChanged, motionComplete,
overshoot, decelStarted }` (`src/flight/SupercruisePilot.js:61-65`). Both are verified against the source.

### API-design risks the surface must address (from recon)

- **(a) Live-instance races.** `window._sc.*` are LIVE instances — external pokes race the 60 Hz sim + render loop. The
  surface verbs must be **frame-safe intent-setters**; `flyTo` for headless/lab steps the model itself (like the
  existing `flyFromRest`).
- **(b) Update order.** `pilot.update` MUST precede `model.update` (`src/main.js:7601-7602`). Encapsulate this so it
  cannot be mis-sequenced.
- **(c) Stale HUD stick.** Raw `setTurnInput` leaves `_scDeflection`/HUD stick stale (`_scDeflection` written at
  `src/main.js:471,9278`, read into the HUD at `src/main.js:8384`) → `steer()` must update it.
- **(d) Latched throttle on stop.** `scPilot.stop()` leaves throttle **latched** (`src/flight/SupercruisePilot.js:53-57`
  — Elite takeover semantics) → the surface needs an explicit idle-vs-takeover stop so callers can choose.
- **(e) Cross-boundary `_target` read.** `scPilot._target` is read across the module boundary by `main.js` HUD code
  (`src/main.js:6081,6083,8378`) → formalize it (a named accessor) rather than reaching into the private field.

## The four parts of the work

These become the implementation plan's four tasks. Each has a goal and explicit, checkable acceptance criteria.
**Harness-first discipline: Part 2 must be green in the lab BEFORE Part 3 touches the live game.**

### Part 1 — Build `ShipControls` + the verb surface

**Goal:** create `src/flight/ShipControls.js` owning `model` + `pilot` + `head`, exposing the verb surface
(`setThrottle`, `steer`, `selectTarget`/`deselect`, `engage`/`disengage`, `flyTo`, `stop`, `getState`), and
encapsulating the `pilot.update → model.update` order so it cannot be mis-sequenced. Expose it at `window._sc.controls`.

**Acceptance criteria:**
1. `src/flight/ShipControls.js` exists and exports a class owning `model`, `pilot`, `head`.
2. The class exposes `setThrottle`, `steer`, `selectTarget`/`deselect`, `engage`/`disengage`, `flyTo`, `stop`,
   `getState` — the portable verbs in the class; host-coupled steps (`engage`/`disengage`'s camera-mode toggle +
   Settings read + `flightExitAnchor`, `selectTarget`'s reticle/focus pipeline) are **thin delegates** into `main.js`
   methods, not reimplemented.
3. `setThrottle(t)` reaches the model and **reverse works** — `setThrottle(-0.5)` results in `model.throttle === -0.5`
   (clamp at `SupercruiseModel.js:42`).
4. `steer(x, y)` runs the shaped curve with the casing bug **fixed** (a non-default `DEADZONE`/`EXPO` actually changes
   the shaped output) **and** updates `_scDeflection` so the HUD stick marker reflects programmatic steering.
5. The inline steer-toward-body math (`SupercruisePilot.js:93-101`) is extracted into a **named helper** (sibling to
   `aimAssist.alignStep`); the pilot's Frame contract `{ phase, prevPhase, phaseChanged, motionComplete, overshoot,
   decelStarted }` is **named** (typedef/const), not anonymous.
6. The class encapsulates the `pilot.update → model.update` order — a single stepping method that always runs
   `pilot.update(dt)` (when active) **before** `model.update(dt)` (matches `src/main.js:7601-7602`).
7. `getState()` returns live `{ speed, commandedSpeed, throttle, mode, phase, dropState }`.
8. `scPilot._target` is exposed via a **named accessor** on the surface (formalizing the cross-boundary read at
   `src/main.js:6081,6083,8378`); raw private-field reads are not added.
9. `stop` distinguishes **idle stop vs. takeover stop** so the latched-throttle behavior
   (`SupercruisePilot.js:53-57`) is an explicit choice, not an accident.
10. `window._sc.controls` is the surface in-game; existing `window._sc.{model,pilot,head,hud,…}` (`src/main.js:484`)
    untouched.
11. `npm run build` clean; existing flight/UI/camera-interp suites stay green; no behavior change in the live game yet.

### Part 2 — Harness-first: exercise the player-facing motion verbs in the lab

**Goal:** extend `flight-controls-lab.html` so the lab drives `ShipControls` (the same object the game uses) and
exercises every **player-facing motion verb** against the real `SupercruiseModel` + a real-scale body, **before** any
live-game change. (Harness-exercised: `setThrottle`, `steer`, `selectTarget`/`deselect`, `engage`/`disengage`, `flyTo`.
`stop` and `getState` are covered by the unit layer below, not driven through the lab.) Add unit tests for the pure
pieces. **Nothing touches the live game until this is green.**

**Acceptance criteria:**
1. The lab drives the **`ShipControls` instance** (via `window._lab`, existing API at `flight-controls-lab.html:743`),
   not an ad-hoc reimplementation of the wiring.
2. **Reverse throttle** is exercised — `setThrottle(<0)` and the ship moves backward in the lab.
3. **Shaped steer** is exercised with the **casing bug fixed** — changing `DEADZONE`/`EXPO` in the lab's `stickTuning`
   (currently `flight-controls-lab.html:162`) visibly changes the shaped output (today it is silently ignored).
4. **Select across ≥2 bodies including the no-target no-op** — the lab currently hard-wires a single body
   (`_selectedBody()` returns the one reference planet, `flight-controls-lab.html:225`); Part 2 gives it ≥2 selectable
   bodies and asserts `selectTarget(null)`/`deselect()` is a clean no-op.
5. **The real 2-state engage/exit toggle** is exercised — the lab's live `F` currently runs the **RETIRED 4-state
   `advanceFlightMode` ring** (`flight-controls-lab.html:130` import; `cycleFlightMode` at `236-239`; bound to `F` at
   `294`), a **false-pass risk**. Part 2 switches the lab's F to the real `engage`/`disengage` surface (2-state), so the
   lab exercises the shipped toggle, not the retired ring.
6. **`flyTo`→arrival** is exercised — the lab consumes the **named arrival signal** (the lab discards the pilot frame
   today) and can assert "arrived at body."
7. **Unit tests** cover the pure pieces: the extracted steer-toward helper (output vs. known geometry), the shaped-stick
   casing fix, the named Frame contract, and the `flyTo` arrival driver in a headless/self-stepping context.
8. Existing suites stay green; `npm run build` clean. **No live-game file is touched in this part.**

### Part 3 — Wire the live game through the surface

**Goal:** route the player's manual/assist input + the attract tour + warp re-entry through `ShipControls`,
consolidating the 9 scattered `scPilot.beginLeg` sites. **Pure consolidation, no behavior change.** This is the
riskiest part → live-verify hardest.

**The `scPilot.beginLeg` sites to consolidate** (all verified present in `src/main.js`):
`5598`, `5653`, `5876`, `6066` (`_engageAssist`), `6338`, `6384`, `6428`, `6623`, `7856` (the warp-arrival fly-in leg).

**Acceptance criteria:**
1. Player manual/assist input, the attract tour's per-leg dispatch, and warp re-entry all flow through the surface verbs
   (`engage`/`steer`/`flyTo`) rather than poking `scPilot`/`scModel` directly.
2. The 9 `beginLeg` sites above are consolidated to route through `flyTo`/the surface (or a single shared call the
   surface owns) — **zero behavior change**: same legs, same arrivals, same tour advance via `_handleScPilotFrame` on
   `frame.motionComplete`. **Checkable end condition:** after this part, `grep -n 'scPilot\.beginLeg(' src/main.js`
   returns only call sites inside the `ShipControls` delegate (or zero) — no other dispatch site calls `beginLeg`
   directly.
3. The `pilot.update → model.update` order in the live sim loop (`src/main.js:7601-7602`) goes through the surface's
   stepping method.
4. `_scDeflection`/HUD stick stays correct under programmatic steer (no stale marker).
5. **Live-verify (chrome-devtools subagent on `:9223` → the `:5174` worktree tab):** measure **dQuat + the CAMERA
   transform** per `well-dipper-testing-reference.md` §6.5 — **never** the frozen model or raw `camera.position`. Assert:
   the attract tour still flies + advances; a manual `flyTo` arrives at the right body; F engage/disengage still no-snaps
   (Δposition ≈ 0, Δquaternion ≈ 0 on the camera); 0 new console errors. ~100-unit world-origin rebases are
   compensated/invisible (dQuat ≈ 0) — not bugs.
6. Existing suites green; `npm run build` clean; full suite known-failures-only.

### Part 4 — Retire the legacy classes (no file deletion)

**Goal:** retire the three motion systems that are no longer (or about to no longer be) in the live path, by dead-ref
removal (`AutopilotMotion`) and spawn-disable (`NavigationSubsystem` / `FlythroughCamera`). **Mark retired, keep files.**

> **Part 4 = ONE plan task with two sub-parts (4a + 4b), not two tasks.** 4a (`AutopilotMotion` dead-ref removal) and
> 4b (ship-spawn disable + nav-retire + test-gating + the docs-row update) sit under a single plan task so the plan
> stays at four tasks. Part 4 is heavier than Parts 1–3; if the implementer finds it genuinely too large for one task,
> flag it to Max before silently expanding the plan to five tasks.

#### 4a — `AutopilotMotion` (genuinely dead — remove dead refs)

- Remove the unreachable `simStep` branch — the `else if (autopilotMotion.isActive && …)` block at
  `src/main.js:7684-7804` (the branch's closing brace, before `} else`, is at 7804), whose **sole** `beginMotion` is the
  self-chaining call at `src/main.js:7793` (only reachable from inside the branch itself → unreachable from the live path).
- Remove the instantiation (`const autopilotMotion = new AutopilotMotion()` at `src/main.js:441`) and the ~10 dead refs
  (import at `src/main.js:40`; binding/cache wiring ~`669,723-726,765-767`; `isActive` guards ~`1744,1984,5672,5684,6213`).
- Remove the dead `_target` fallback in the telemetry sampler at `src/main.js:1718-1725` (the
  `autopilotMotion._target` branch).
- **Mark `src/auto/AutopilotMotion.js` retired (header comment); keep the file.**

**Acceptance criteria:** no live reference to `autopilotMotion` remains in `src/main.js`; the file is marked retired and
kept; `npm run build` clean; suites green.

#### 4b — Ships / `NavigationSubsystem` / `FlythroughCamera` (PRESERVE + dormant — do NOT delete)

- **Disable NPC spawning at the single switch:** the `shipSpawner.spawnForSystem(…)` call at `src/main.js:4346` (called
  in every system build). Disabling it means no spawned ships exist → every ship site (`shipSpawner.ships`-gated)
  becomes inert automatically. Per `docs/FEATURES.md:214`: *"remove ShipSpawner instantiation… preserve code."*
- Disabling spawn makes the ship-lock path unreachable: `focusShip` (`src/main.js:6250`, reached by `commitBurn`
  `kind==='ship'` at `src/main.js:6115`), the `_makeTarget` ship branch (`src/main.js:3670`), the `_shipScannerMode`
  hit-test (`src/main.js:3796`) and Alt-toggle (`src/main.js:8470` — *approx, verify at build*), and the
  `flythrough.active` simStep branch (`src/main.js:7809-7867`, since `FlythroughCamera.active === navSubsystem.isActive`,
  permanently false with no ships). The minimap/prev/next `flythrough.active` terms (~`src/main.js:8993,9607,9621` —
  *approx, verify at build*) become dead-weight.
- **Mark `NavigationSubsystem` + `FlythroughCamera` retired (header comments); keep the files.** **Do NOT rip out the
  nav wiring** — it is the preserved feature.
- **PLAYER ship ≠ NPC ship:** the player is the camera + `SupercruiseModel`; `shipHullToScene('player')` /
  `playerShipLengthScene` (`src/core/ScaleConstants.js:169,183`) is SHARED — KEEP it; disable only the NPC callers. The NavComputer
  "SHIP" diamond is the player, not an NPC — don't touch. `_resolveSelectedBody` already returns null for ships
  (`src/main.js:6048` — the `t.kind === 'ship'` guard), so supercruise assist is already firewalled from ships.
- **Gate the ship integration tests behind a "ships enabled" flag** — `runShipScannerInspectionTests`
  (`src/debug/integration-suite.js:1192`, comment header `:1181`) and `runShipScannerBurnArrivalTest`
  (`src/debug/integration-suite.js:1535`, which waits `window._navSubsystem?._phase === 4` at `:1577`); registrations at
  `src/debug/SceneInspector.js:135-142`. **Preserve, don't delete** — gate so they skip cleanly when ships are disabled.

**Acceptance criteria:**
1. NPC spawning disabled at the single switch (`src/main.js:4346`); no NPC ships spawn in any system.
2. `focusShip`/ship-lock are unreachable with ships disabled (no live entry point); the `flythrough.active` branch is
   dead-weight; nav classes are marked retired with files **KEPT** and nav wiring intact. **Checkable:** the *sole*
   entry to `focusShip` is the `kind === 'ship'` branch at `src/main.js:6115`; with spawn off, `shipSpawner.ships` is
   empty, so no ship targets exist and that branch is never taken — verify in the Part-3 live run that the target list
   contains zero ship targets and `focusShip` is invoked 0 times across a full attract-tour + manual-`flyTo` pass.
3. Player-ship sharing (`shipHullToScene('player')`/`playerShipLengthScene`) is untouched; the NavComputer "SHIP" player
   diamond is untouched.
4. Ship integration tests are **gated** behind a ships-enabled flag (skip cleanly, not deleted); the rest of the suite
   stays green.
5. **`docs/FEATURES.md` / `docs/NOW.md` rows are updated to note spawn disabled** — **during implementation (this
   Part), NOT in this design doc.** The docs already anticipate this (`docs/FEATURES.md:214` and the ship rows
   `docs/FEATURES.md:60-72`; `docs/NOW.md:844` *"Ship NPC spawning disable for F&F… preserve code for ENRICHED
   reactivation"*). Per project CLAUDE.md, editing `docs/FEATURES.md` / `docs/NOW.md`
   requires reading `~/.claude/docs/dev-collab-os.md` first.
6. `npm run build` clean; suites green (ship tests gated/green).

## Testing strategy

**Three layers, harness-first.**

### Unit (headless, pure)
- The extracted **steer-toward helper** — output vs. known geometry (target ahead/behind/off-axis → expected clamped
  yaw/pitch; the antiparallel `yawIn = 1` escape at `SupercruisePilot.js:100`).
- The **shaped-stick casing fix** — a non-default `DEADZONE`/`EXPO` actually changes `shapeMagnitude` output (today it
  is silently ignored).
- The **named Frame contract** — `{ phase, prevPhase, phaseChanged, motionComplete, overshoot, decelStarted }` fields
  present and stamped correctly.
- The **`flyTo` arrival driver** in a self-stepping headless context (the `flyFromRest`-style pattern) — fires the
  arrival signal at `motionComplete`.
- The **idle-vs-takeover stop** — idle stop zeroes throttle; takeover stop leaves it latched (matches
  `SupercruisePilot.js:53-57`).
- The `pilot.update → model.update` ordering is enforced by the surface's stepping method.

### Harness (`flight-controls-lab.html`) — Part 2's gate
Drive `ShipControls` via `window._lab`; exercise reverse throttle, shaped steer (casing fixed), select across ≥2 bodies
incl. the no-target no-op, the real 2-state engage/exit, and `flyTo`→arrival — against the real `SupercruiseModel` +
real-scale body. **This must be green before Part 3 touches the live game.**

### Live (chrome-devtools subagent, GPU `:9223` → the `:5174` worktree tab) — Part 3's gate
Per `well-dipper-testing-reference.md`: assert `location.href` contains `:5174` before any action; HARD-RELOAD the tab
after a `main.js` edit (HMR won't hot-swap the entry); apply the mute snippet on load. Measure **dQuat + the CAMERA
transform** (§6.5) — never the frozen model or raw `camera.position`. Confirm: attract tour flies + advances; a manual
`flyTo` arrives at the right body; F engage/disengage no-snaps (camera Δposition ≈ 0, Δquaternion ≈ 0); ships absent
after Part 4; 0 new console errors.

### Existing suites
Flight + UI + camera-interp suites stay green; full suite known-failures-only (no new regressions); `npm run build`
clean at every part boundary.

## Risks / guards

- **Scale-bug guard.** NEVER re-tune `SC_TUNING` cap/hold floors (`src/flight/SupercruiseModel.js`) or `scPilot.tuning`
  DROP_* (two prior live regressions `259f855` / `d5e4e2f`). Reuse the single-sourced drop-window math (`10R /
  (10R)/2.5`); don't re-derive.
- **No-snap pattern.** Any path handing the camera from flight back to Toy-Box anchors on the camera's forward ray
  (`flightExitAnchor` + `adoptCurrentPose` + `cameraInterp.resync`, the shipped pattern at `src/main.js:8865-8867`) —
  **never** on a body center.
- **Camera-snap verification.** Measure dQuat + the CAMERA (`well-dipper-testing-reference.md` §6.5); ~100-unit
  world-origin rebases are compensated/invisible (dQuat ≈ 0) — they are NOT bugs.
- **Parallel sessions.** The main checkout (`/home/ax/projects/well-dipper`) runs a SEPARATE World Engine session on
  `feature/world-engine-production-L1`; `src/main.js` + `docs/NOW.md` are co-touched → **file-scoped commits** (`git
  commit --only <paths>`). Don't edit `docs/NOW.md` mid-arc except at the VERIFIED/Shipped gate. On Chrome `:9223`:
  `:5173` = World Engine (NEVER touch), `:5174/well-dipper/` = this worktree (assert `:5174` before any chrome-devtools
  action). Do NOT edit the worktree `main.js` while Max is riding.
- **Harness-first discipline.** Part 2 must be green in `flight-controls-lab.html` (real model, real-scale body) BEFORE
  Part 3 touches the live game.
- **Live-instance races.** The verbs act on live instances the 60 Hz loop also touches → frame-safe intent-setters
  in-game; `flyTo` self-steps the model only in headless/lab.

## Dev-collab posture

- This spec is a **design doc only.** No source file, `docs/FEATURES.md`, `docs/NOW.md`, or the lab is edited here.
- **`docs/FEATURES.md` / `docs/NOW.md` row updates happen DURING implementation (Part 4), not in this doc.** The docs
  already anticipate the spawn-disable (`docs/FEATURES.md:214`, ship rows `60-72`; `docs/NOW.md:844`). Per
  project CLAUDE.md, editing those files requires reading `~/.claude/docs/dev-collab-os.md` first.
- The four parts map 1:1 to the implementation plan's four tasks (`superpowers:writing-plans` next).
- Final verification → **VERIFIED_PENDING_MAX `<sha>`** → **Max UAT is the sole gate to Shipped** (no agent closes UAT).

## Line-reference confidence

All file:line refs in this spec were verified against the source on 2026-06-26 **except** the following, flagged
**"approx — verify at build"**: `_shipScannerMode` Alt-toggle (brief said `~8465`; actual `src/main.js:8470`); and the
minimap/prev/next `flythrough.active` terms (`~src/main.js:8993,9607,9621`, not individually re-confirmed). The
`docs/NOW.md` ship-disable row is verified at `:844` (the brief's `:844` was correct). The hit-test site is
`src/main.js:3796` (brief said `~3793`). The `_resolveSelectedBody` ship-null guard is inside the function defined at
`src/main.js:6048` (the brief's `6048-6052` range; the `t.kind === 'ship'` guard sits a few lines into the function).
