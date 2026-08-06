# Grounding Map — Piece B: Sublight Flight + Body Mass into the Flight Model

**Date:** 2026-06-28 · **Branch:** `feature/supercruise-freelook`
**Status:** Reference map for the upcoming **Piece B(c) — sublight** spec (and later B(a)/B(b) mass work). Produced by a read-only code survey; anchors verified by reading the cited lines. **Line numbers predate the Piece A commit `61980fb` (+71 lines in main.js) — re-grep before editing.**

**Decision (Max, 2026-06-28):** ship **sublight (B-c) first** as its own shippable piece; defer the mass plumbing (B-a SOI rest frame, B-b mass-based cap) to a later pass. The three parts are separable — B-c needs **no mass**.

---

## TL;DR of the seams
- **Mass exists at generation time but is thrown away before flight.** `massEarth` is computed per-planet and stored on planet data; `starMassSolar` is computed but **discarded** (never stored on the star object); moons have **no mass at all**. None reaches the flight model.
- **The flight-model boundary drops mass at one place:** `src/main.js` `_scBodies` builder (~7782-7801 pre-Piece-A) pushes `{position, radius}` only. Single chokepoint for B(a)/B(b). A **duplicate** seed-builder (~680-687) + four `_resolve*` single-body helpers (~613-625) must change too.
- **`SupercruiseModel.speedCap()` is purely kinematic** (`surfaceDist / ETA_K`), radius-driven, mass-free — `src/flight/SupercruiseModel.js:77-86`. This is what B(b) would replace.
- **There is no sublight propulsion.** Drive OFF → `update()` ignores throttle and decays speed to zero (`SupercruiseModel.js:118-124`). W/S only move throttle, ignored while dropped (`main.js` ~8075-8089). So dropped-out speed is genuinely 0 — that's **IUAT Issue 2**. **B(c) needs a propulsion source that does not exist yet.**
- **One speed readout, one formatter.** `formatSpeed()` in `src/ui/SpeedFormat.js` is consumed only by `SupercruiseHud.js`. A sublight scale plugs in here; the km/s tier already shows down to 0.1 km/s, so the formatter is NOT the blocker — the input speed being 0 is.

---

## 1. Mass data layer — what / where / units / consumers
- `src/generation/PhysicsEngine.js`: SI constants (29-48). `estimateMassEarth(radiusEarth, type)` **:61** (Chen & Kipping; returns Earth masses). `escapeVelocity(massEarth,radiusEarth)` **:81** (m/s; defined, NO src caller). `jeansParameter` **:96** (→ `computeAtmosphere`). `tidalLockTimescale` **:258** (mixed units: parent solar, body Earth). `tidalHeating` **:295**. `deriveFormation(starMassSolar,...)` **:532**.
- `src/generation/PlanetGenerator.js`: `massEarth = estimateMassEarth(...)` **:353**; consumed at 368 (tidal lock), 372-378 (atmosphere), 557 (habitability); **stored on planet data at :682**. Rides the `...entry.planetData` spread (`main.js:4261`) onto `entry.planet.data.massEarth` — **present at runtime but unread.**
- `src/generation/StarSystemGenerator.js`: `starMassSolar = pow(radiusSolarVaried, 1.25)` **:239**; used at 245/294; **NOT persisted on the star object** (149-161; binary star2 190-198). So `system.star.data` has **no mass** — biggest gap for B(a).
- `src/generation/MoonGenerator.js`: moons compute **NO mass** (radius-only outputs, 160-165/222-227; planet-class moons 236-285 don't surface `massEarth`). B(a) for moons needs a fresh `estimateMassEarth(moon.radiusEarth, type)`.
- **Units:** planet mass = Earth masses; star = solar masses; moon = none. At runtime `data.radius` is **scene units** (overridden at scene-build: planet `radius:...radiusScene` `main.js:4262`, star :4198, moon :4334).

## 2. Flight-model boundary (mass dropped here)
- Builder inside `simStep` (fixed 60Hz): `_scBodies.length=0` then `push({position, radius})` for star/star2/planets/moons (~`main.js:7782-7801`), `scModel.setBodies(_scBodies)`. **Each body = exactly `{position:Vector3, radius:number}`.** Rebuilt every tick; `position` is the live rebased mesh position.
- `SupercruiseModel.setBodies(list)` **:50** sets `this._bodies`.
- **Duplicate builder** for autopilot warm-up/seed (~`main.js:680-687`) used by `_enterFlightInternal` (~697) and simulate-leg helper (~745). Plus four `_resolve*` single-body helpers (~613-625). All must change for B(a)/B(b).
- `data.radius` is **scene units**; mass is Earth/solar; `PhysicsEngine` is SI → B(b) needs an explicit unit bridge (`src/core/ScaleConstants.js` `METERS_PER_SCENE:123`).

## 3. SupercruiseModel mechanics + tuning — `src/flight/SupercruiseModel.js`
- `SC_TUNING` (9-31): `ETA_K:3.0` (cap = surfaceDist/ETA_K; must stay ≥2.25 drop-safety), `CAP_MIN_FRAC:0.5`, `CAP_MIN_ABS:1e-5`, `CAP_MAX:20000`, `ACCEL_TAU:0.6`, **`DROP_TAU:0.4`** (decay-to-rest when drive OFF), **`MIN_CRUISE:2.0`** (min cruise while drive ON; comment names sublight as the sub-MIN_CRUISE regime that doesn't exist yet), `THROTTLE_RATE:0.6`.
- `speedCap()` **77-86**: `cap = min over bodies of max(CAP_MIN_ABS, radius*CAP_MIN_FRAC, surfaceDist/ETA_K)`. **No mass term.** B(b) target.
- `update(dt)` **95-134**: steer (turnRateCap 89-93); **drive ON** (105-117) exp-approach to `throttle×cap`, floored at `min(MIN_CRUISE,cap)`, never reverse/stop; **drive OFF** (118-124) `speed *= exp(-dt/DROP_TAU)` → **decays to 0, throttle ignored** (the "parked" behavior); gravity-well clamp (128-131); translation `position.addScaledVector(nose(), speed*dt)` (133) — **forward-along-nose only.**
- `_bodies` consumed only by `speedCap()`/`turnRateCap()`. Capture sphere / drop window live OUTSIDE the model: `SupercruisePilot.js` (95-96, 141-151; `DROP_RADIUS_FACTOR:10`, `DROP_ETA_MAX:2.5`) and `_scDropState()` (`main.js` ~6245-6260) — both radius-keyed, mass-free.

## 4. Speed scale / display
- `src/ui/SpeedFormat.js`: `KM_PER_SCENE ≈ 149,597.87` km per scene-u/s (:18); `1 c ≈ 2.004 scene-u/s` (:19) → 1 u/s ≈ 0.499 c. `formatSpeed(sceneUPerSec)` (44-69): tiers **km/s** (<1 Mm/s, 1-dp under 100), **Mm/s** (<0.1c), **c** (≥0.1c). `speedToBarFrac` (85-89): log10 bar, `SPEED_BAR_MIN_C=0.0005` (≈150 km/s) … `MAX_C=10000` — **sublight (km/s) pins the bar empty; needs a separate sublight bar or a regime branch.**
- HUD feed `scHud.update({speed: scModel.speed, commandedSpeed: throttle*speedCap(), ...})` (~`main.js:8458` pre-Piece-A; now ~8520). Visible gate `_hudVisible && (_scManual || scPilot.isActive) && !warpEffect.isActive`. `formatSpeed` consumed only at `SupercruiseHud.js:79`.

## 5. Dropped-out state machine
- E-key (`main.js` ~9124-9145) via `nextDriveAction(inFlight, driveOn)` (`flightModes.js:49-52`): `!inFlight→'engage'`, `driveOn→'dropout'`, else `'reengage'`. `dropout` = `scModel.setDrive(false)` + cosmetic `dropImpulse()`.
- **No sublight propulsion when drive OFF:** OFF branch decays speed to 0, throttle ignored; W/S (`main.js` ~8075-8089) only `setThrottle` (unread while OFF). The `*Impulse` calls are `shipChoreographer` camera shake, not thrust. Autopilot HOLD (`SupercruisePilot.js:98-113`) also hard-sets `speed=0`. The legacy WASD mover `CameraController._flightThrust` (`CameraController.js:92,691-724`) is **suppressed in `_scManual`** (`main.js` ~8090) — a camera toy, not the ship model.
- **B(c) hooks into:** a propulsion source for the OFF regime. Throttle plumbing + HUD speed feed already exist; the missing piece is `update()` zeroing motion when `!driveOn`.

## 6. OPEN DESIGN QUESTIONS for the B(c) sublight scoping interview
**B(c) — sublight (do first):**
1. **Same model with a low cap, or a separate sublight model?** Three forks: (1) add a sublight branch to `update()`'s OFF path that reads throttle and approaches a small cap, reusing nose-translation + `_bodies` clamp (minimal; but DROP_TAU "settle to rest" and the no-reverse/no-stop floor need a regime split); (2) a separate pure sublight module owning motion while `!driveOn` (cleaner, more wiring incl. rebasing registration ~`main.js:7874`); (3) one model, regime-aware `speedCap()`.
2. **What sets the sublight top speed?** Fixed constant (e.g. a few hundred km/s), thrust-integrated (accel toward a ceiling), or mass-derived (fraction of local escape/orbital velocity)? **B(c) can ship with a FIXED cap — no mass.**
3. **Units/visual for the readout.** km/s tier already works (down to 0.1 km/s). Want a distinct label/color ("SUBLIGHT") so the player knows they left supercruise? `speedToBarFrac` log window (min ≈150 km/s) pins empty at sublight → separate sublight bar?
4. **Throttle behavior:** today `0..1 × cap`. At sublight: allow reverse (currently forbidden) and a true zero/full-stop?

**B(a) — mass → SOI rest frame (later):** 5. Source of star/moon mass (re-derive at the `_scBodies` seam vs persist upstream). 6. Does SOI change *where* you come to rest. 7. SOI definition (Hill/Laplace needs parent mass + orbit distance; `_scBodies` is flat/no parent links).

**B(b) — mass-based cap (later):** 8. Replace vs augment `surfaceDist/ETA_K` (gravity `√(GM/d)`-style?); note ETA_K≥2.25 drop-safety + radius-keyed capture sphere must stay consistent. 9. Unit bridge scene↔SI (where the conversion lives). 10. Is B(c)'s sublight ceiling the same quantity as B(b)'s near-body cap floor, or independent.

## Essential files
`src/flight/SupercruiseModel.js` (model: tuning, speedCap, drive on/off, drop-to-rest), `src/main.js` (`_scBodies` 7782/dup 680/resolvers 613, HUD feed, throttle input 8075, E-state 9124, `_scDropState` 6245, scene-build radius override 4198/4262/4334 — all pre-Piece-A line numbers), `src/flight/SupercruisePilot.js`, `src/flight/flightModes.js` (`nextDriveAction` 49), `src/ui/SpeedFormat.js`, `src/ui/SupercruiseHud.js`, `src/generation/{PhysicsEngine,PlanetGenerator,StarSystemGenerator,MoonGenerator}.js`, `src/core/ScaleConstants.js`.

**Confidence:** static survey (game not run). "`massEarth` present-but-unread at runtime" rests on the `...entry.planetData` spread (`main.js:4261`) + no `massEarth` ref in main.js (grep clean) — high-confidence but static.
