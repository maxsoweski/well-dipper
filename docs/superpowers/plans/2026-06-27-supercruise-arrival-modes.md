# Supercruise Arrival + Mode Restructure — Implementation Plan

> **For agentic workers:** This plan is executed by opus workflow agents with full
> codebase access. Tasks are calibrated to **intent + interfaces + test code + verify
> commands + acceptance** — for `main.js` edits (8000+ lines), READ the live file and
> match by CONTENT, not line number (line numbers drift). Pure-module tasks include
> real code. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Split the single F flight toggle into two buttons (E = supercruise drive
on/off + pose-preserving drop-out; F = latched free-look), add a drive-idle "dropped
out" in-flight state, asymmetric enter/drop camera-shake, selection-via-free-look for
Assist, and fix the Assist moving-moon ALIGN hang — per
`docs/superpowers/specs/2026-06-27-supercruise-arrival-modes-design.md`.

**Architecture:** Three orthogonal layers — Regime (Toybox↔In-Flight, Esc),
Drive (supercruise ON↔OFF, E), Controls (hands-on↔free-look, F) — over the existing
`ShipControls` single-door surface and `SupercruiseModel`/`SupercruisePilot`/`HeadMount`/
`ShipChoreographer`. Pure modules carry testable logic; `main.js` wires inputs.

**Tech Stack:** three.js, Vitest, Vite. Test: `./node_modules/.bin/vitest run <path>`.
Build: `npm run build`. (NEVER `npx vite` — hook-blocked; the bare word "vite" in commit
messages/echo also trips the hook.)

## Global Constraints (every task)

- **Branch:** `feature/supercruise-freelook` (continues the supercruise arc).
- **File-scoped commits only** (`git add <explicit paths>` → `git commit -- <paths>`).
  NEVER `git add -A` — a parallel World-Engine session shares the repo. Exclude the
  untracked `.mcp.json`, `config.lock`, `screenshots/*`.
- **Do NOT edit `docs/NOW.md`** (shared, ship-gate only) or re-tune `SC_TUNING`
  cap/hold/DROP floors or camera min/maxDistance (scale-bug guard — two prior live
  regressions `259f855`/`d5e4e2f`).
- **Pose-preserving everywhere:** drop-out and Esc-to-Toybox must NOT re-anchor the
  camera on a body center (the bug class that forced the old drop-out removal). Reuse
  `flightExitAnchor`/`adoptCurrentPose` (forward-ray anchor).
- **Measure the CAMERA world transform** for any no-snap claim (testing-ref §6.5), not
  raw sim coords (the snap-back blind spot).
- **Keep retired things retired:** `advanceFlightMode` 4-state ring stays unused;
  `AutopilotMotion`/`NavigationSubsystem`/`FlythroughCamera` stay retired;
  `SHIPS_ENABLED=false`.
- E and R are unbound today; supercruise → **E** (R reserved). F repurposed.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/flight/SupercruiseModel.js` | + drive-idle / coast-on-drop (momentum preserved, no snap-to-0 when dropped); speedCap anti-clip unchanged | 1 |
| `src/flight/freeLook.js` (NEW) | Pure latched free-look state: latch on/off, input-routing decision (head vs joystick), recenter trigger | 2 |
| `src/flight/SupercruisePilot.js` | Fix ALIGN moving-target hang (lead/relax dot gate + timeout) | 3 |
| `src/auto/ShipChoreographer.js` | + dedicated enter-swell / drop-jolt envelope (bigger/shorter than cruise tremor), rotation-only | 4 |
| `src/main.js` | Key rewire (E/F/Esc), drive-idle in-flight state, free-look apply path + selection-via-free-look, enter/drop shake wiring, SAFE-TO-DROP guidance, Assist target sources | 5–8 |
| `src/flight/__tests__/*`, `src/auto/__tests__/*` | Unit tests | 1–4 |

Tasks 1–4 (pure, independent files) build in parallel. Tasks 5–8 (all edit `main.js`)
build sequentially. Task 9 verifies.

---

### Task 1: Drive-idle / coast-on-drop in SupercruiseModel (AC1)

**Files:** Modify `src/flight/SupercruiseModel.js`; Test `src/flight/__tests__/SupercruiseModel.drop.test.js` (new).

**Interfaces — Produces:**
- `model.setDrive(on: boolean)` — engage (true) / drop-out (false). When OFF, the model
  stops actively propelling: it no longer ramps speed toward the throttle target;
  instead it COASTS — current velocity preserved, decays gently by a `COAST_TAU`
  (a new tuning constant, NOT a scale-bug floor), and the gravity-well `speedCap` still
  clamps the max. When ON, existing throttle/accel behavior resumes.
- `model.driveOn: boolean` getter.
- Existing `step(dt)` / `update(dt)` honors `driveOn`.

**Implementation intent:** Read the current `step`/`update` + speed integration. Add a
`_driveOn` field (default true for back-comp). In the speed update: if `_driveOn`, keep
today's behavior (approach throttle-target speed with the heavy accel curve, clamped by
`speedCap()`); if `!_driveOn`, do NOT pull toward throttle target — decay current speed
by `exp(-dt/COAST_TAU)` (COAST_TAU ≈ 8s, gentle) and still clamp to `speedCap()` so
proximity to a body parks you. Position still integrates along the nose from the
(coasting) speed. Do NOT touch the existing `CAP_MIN_FRAC`/`CAP_MIN_ABS` scale floors.

**Tests (write first, must fail, then implement):**
```js
// engage accelerates toward the capped target in open space
m.setDrive(true); m.setThrottle(1); stepN(m, 60, 1/60);
expect(m.speed).toBeGreaterThan(0);
// drop-out preserves momentum (does NOT snap to 0)
const v = m.speed; m.setDrive(false); m.step(1/60);
expect(m.speed).toBeGreaterThan(v * 0.9);   // coast, not zeroed
// drop-out coasts position forward
const p0 = m.position.clone(); stepN(m, 30, 1/60);
expect(m.position.distanceTo(p0)).toBeGreaterThan(0);
// near a body, speedCap parks you even while coasting
// (place a dominant body close; expect speed clamped low)
// anti-clip: engage with nose toward a near body cannot exceed ~cap (~0)
```
Use the existing test helpers/patterns in `SupercruiseModel.test.js` for body setup.

**Verify:** `./node_modules/.bin/vitest run src/flight/__tests__/SupercruiseModel.drop.test.js` PASS, and the existing `SupercruiseModel.test.js` stays green.

**Commit:** `feat(flight): SupercruiseModel drive-idle coast-on-drop (momentum preserved)`

---

### Task 2: Pure latched free-look state (AC2)

**Files:** Create `src/flight/freeLook.js`; Test `src/flight/__tests__/freeLook.test.js`.

**Interfaces — Produces:**
- `createFreeLook()` → `{ latched:boolean, toggle(), enter(), exit(), route(dx,dy) }`
  where `route` returns `{ target:'head'|'joystick', dx, dy }` — `'head'` when latched
  (feed `scHead.addLook`), else `'joystick'`. `exit()`/toggle-off sets a `recenter` flag
  consumed by the caller to start `HeadMount` recenter.
- `fl.consumeRecenter()` → boolean (true once after an exit, to trigger recenter).

**Implementation (real code):**
```js
// src/flight/freeLook.js
// Pure latched free-look state. Decides whether pointer motion drives the head
// (look) or the virtual joystick (steer), and signals a one-shot recenter on exit.
// Camera math lives in HeadMount; this is just the latch + routing decision so it's
// unit-testable without three.js.
export function createFreeLook() {
  let latched = false;
  let recenterPending = false;
  return {
    get latched() { return latched; },
    enter() { latched = true; },
    exit() { if (latched) { latched = false; recenterPending = true; } },
    toggle() { latched ? this.exit() : this.enter(); },
    route(dx, dy) {
      return { target: latched ? 'head' : 'joystick', dx, dy };
    },
    consumeRecenter() { const r = recenterPending; recenterPending = false; return r; },
  };
}
```

**Tests (write first):**
```js
const fl = createFreeLook();
expect(fl.route(2,3)).toEqual({target:'joystick',dx:2,dy:3});
fl.toggle();
expect(fl.latched).toBe(true);
expect(fl.route(2,3)).toEqual({target:'head',dx:2,dy:3});
fl.toggle();
expect(fl.latched).toBe(false);
expect(fl.consumeRecenter()).toBe(true);
expect(fl.consumeRecenter()).toBe(false); // one-shot
```

**Verify:** `./node_modules/.bin/vitest run src/flight/__tests__/freeLook.test.js` PASS.

**Commit:** `feat(flight): pure latched free-look state (route + one-shot recenter)`

---

### Task 3: Fix Assist ALIGN moving-target hang (AC8)

**Files:** Modify `src/flight/SupercruisePilot.js`; Test `src/flight/__tests__/SupercruisePilot.align.test.js` (new or extend existing pilot test).

**Interfaces:** Behavior change only — ALIGN must converge against a target whose
position advances each step.

**Implementation intent:** Read the ALIGN phase. Today ALIGN holds throttle 0 until
nose-dot ≥ ~0.995 against the (possibly moving) target → can hang on an orbiting moon.
Fix with BOTH: (a) **lead the target** — aim at the target's current position (and, if a
velocity is available, slightly ahead) rather than a stale capture; (b) **relax/timeout
the gate** — once dot ≥ a looser threshold (e.g. 0.985) OR an ALIGN timer exceeds a cap
(e.g. 8s), proceed to CRUISE (CRUISE keeps steering, so perfect pre-alignment isn't
required). Keep scale-bug floors untouched.

**Tests (write first):**
```js
// ALIGN against a target that moves each step still leaves ALIGN within a bounded time
const pilot = makePilot(); pilot.begin(movingTarget);
for (let i=0;i<8*60 && pilot.phase==='ALIGN'; i++){ movingTarget.advance(1/60); pilot.step(1/60); }
expect(pilot.phase).not.toBe('ALIGN');   // converged, no hang
expect(pilot.target).toBe(movingTarget); // did not flip to another body
```
Match the real pilot API (read it; `phase`, `begin`/`beginLeg`/`flyTo`, `step`).

**Verify:** new test PASS; existing `SupercruisePilot` tests stay green.

**Commit:** `fix(flight): Assist ALIGN converges on a moving moon (lead + relax dot gate)`

---

### Task 4: Enter-swell / drop-jolt shake envelope (AC7)

**Files:** Modify `src/auto/ShipChoreographer.js`; Test `src/auto/__tests__/ShipChoreographer.jolt.test.js` (new or extend).

**Interfaces — Produces:**
- `choreographer.enterImpulse()` — accel SWELL (crescendo-then-fade), a bigger/shorter
  beat than the cruise tremor.
- `choreographer.dropImpulse()` — drop JOLT (impact-then-ring), sharp + decaying.
- Both feed the existing `shakeEuler` (rotation-only); both gate-bypassing one-shots
  (model on the existing `debugAccelImpulse`/`debugDecelImpulse`).

**Implementation intent:** Read `debugAccelImpulse`/`debugDecelImpulse` + the envelope/
carrier architecture. Add a dedicated "jolt" envelope with a larger peak (e.g. pitch/yaw
~0.8–1.2°, roll ~0.5°) and shorter duration (~0.5–0.8s) — distinct from the 0.2°/1.5s
cruise tremor. `enterImpulse` = swell (ramp-up then fade); `dropImpulse` = jolt (instant
peak then ring-down). Public, not debug-prefixed. Keep rotation-only (never write
`camera.position`).

**Tests (write first):**
```js
const c = makeChoreographer();
c.dropImpulse();
const peak = sampleMaxShake(c, 1.0);     // step 1s, track max |shakeEuler|
expect(peak.magnitude).toBeGreaterThan(cruiseTremorPeak); // bigger than cruise
expect(c.shakeEuler).toHaveProperty('pitch');
// rotation-only: no position field is produced (API returns only euler)
```

**Verify:** new test PASS; existing ShipChoreographer tests green.

**Commit:** `feat(fx): enter-swell / drop-jolt shake envelopes (rotation-only)`

---

### Task 5: Key rewire — E=supercruise drive, F=free-look, Esc→Toybox (AC3, AC4)

**Files:** Modify `src/main.js` (keydown handler ~8444–8917; F-handler ~8789; Esc chain
~8525; `_enterFlightInternal`/`_exitFlightInternal` ~8373/8400; the sim drive branch).

**Implementation intent (read live, match by content):**
1. **E handler (new):** add `if (e.code === 'KeyE')` near the F-handler with the same
   guards (desktop, not warp/splash/title, star-system present). Behavior:
   - If in Toybox (not In-Flight): enter In-Flight + engage drive — call the existing
     `scControls.engage()` path (which runs `_enterFlightInternal`) AND `model.setDrive(true)`.
   - If In-Flight with drive ON: **drop out** — `model.setDrive(false)` (coast), stay
     In-Flight (do NOT call the full disengage-to-Toybox). Fire `dropImpulse()`. Pose
     unchanged (no re-anchor).
   - If In-Flight with drive OFF (dropped): re-engage — `model.setDrive(true)`,
     `enterImpulse()`. (Anti-clip is automatic via `speedCap`.)
   - Track drive state (reuse `_scManual` for "In-Flight" + a new `_scDrive` boolean, or
     read `model.driveOn`).
2. **F handler (repurpose ~8789):** REMOVE the engage/disengage-supercruise body. Make F
   toggle the latched free-look (`freeLook.toggle()`), guarded to In-Flight only. On
   toggle-off, the recenter is handled in the frame loop (Task 6) via `consumeRecenter()`.
   Keep the `[MODE]` log updated.
3. **Esc chain (~8525):** after the existing dismiss/deselect cascade, add: if In-Flight,
   Esc exits to Toybox — run the existing pose-preserving `_exitFlightInternal`
   (forward-ray anchor, clears focus per `7bd261c`) + `setCameraMode(TOY_BOX)`.
4. **Enter FX:** fire `enterImpulse()` when E engages from Toybox.
5. Update the keybinds overlay text (E, F, Esc) if it lists keys.

**Tests:** This is integration (live). Add a headless guard test only if a pure helper is
extractable (e.g. a `nextDriveState(inFlight, driveOn, action)` reducer — RECOMMENDED:
extract the E-handler decision into a tiny pure function in `flightModes.js` and unit-test
the transition table). Otherwise rely on Task 9 live verify.

**Verify (live, Task 9 sweep does the full run):** quick sanity — `npm run build` clean;
the extracted reducer test (if added) PASS.

**Commit:** `feat(supercruise): E=drive toggle (drop-out), F=free-look, Esc→Toybox`

---

### Task 6: Free-look apply path + selection-via-free-look (AC4, AC5)

**Files:** Modify `src/main.js` (frame loop ~7645/7881/7900; pointer handlers ~9215/9351;
hit-test/select `trySelect`/`hitTestBodies`).

**Implementation intent:**
1. **Apply path:** ensure `scHead.applyTo(camera)` runs every frame while In-Flight
   regardless of drive state (today it's inside the sc sim branch). On drive-idle
   (dropped), still compose the head pose so free-look works while parked. Preserve the
   order: head pose THEN `_composeShakeOntoCamera()` (6601).
2. **Input routing:** when `freeLook.latched`, route pointer motion to `scHead.addLook`
   and freeze the virtual joystick (reuse the `scHead.held` gate at ~9215). When not
   latched, pointer drives the joystick (hands-on) as today.
3. **Recenter:** each frame, if `freeLook.consumeRecenter()` → begin `HeadMount` recenter
   (it eases yaw/pitch→0; already built).
4. **Selection-via-free-look:** while In-Flight (esp. free-look), a click hit-tests bodies
   (`hitTestBodies`) and selects via `scControls.selectTarget` (the same path Toybox uses
   in `trySelect`). Then Space (`commitSelection`→`commitBurn`→`scControls.flyTo`) flies
   Assist there (existing). Keep the middle-mouse hold-to-look "peek" working.

**Verify:** `npm run build` clean; live (Task 9).

**Commit:** `feat(supercruise): free-look apply-every-frame + aim-to-select for Assist`

---

### Task 7: Enter/drop shake wiring + SAFE-TO-DROP guidance (AC7)

**Files:** Modify `src/main.js` (shake dispatch ~7667; `_scDropState` ~6107 consumers; HUD
state assembly).

**Implementation intent:**
1. Confirm the Task-5 `enterImpulse()`/`dropImpulse()` calls fire on E engage/drop. Handle
   the lifetime-on-drop caveat: the drop jolt must out-live the drive flip — fire it on the
   last driving frame or keep composing ~0.5s after (since we stay In-Flight on drop, the
   sc compose branch stays live — verify the shake still composes when `driveOn=false`).
2. Keep the existing pilot phase-edge shakes (CRUISE-entry accel, 15R decel) for autopilot
   legs — don't double-fire with the manual E beats.
3. **SAFE-TO-DROP guidance:** ensure `_scDropState()` still drives the HUD "SAFE TO DROP /
   SLOW DOWN" cue, now framed as guidance for the E drop (no behavior gate on E).

**Verify:** `npm run build` clean; live (Task 9).

**Commit:** `feat(supercruise): asymmetric enter/drop shake + SAFE-TO-DROP guidance`

---

### Task 8: Assist target sources + tour-unaffected check (AC5, AC6)

**Files:** Modify `src/main.js` (Q autopilot ~8825; commit/nav paths; the `flightControlType`
plumbing — light).

**Implementation intent:**
1. Verify both Assist target sources reach `scControls.flyTo`: (a) free-look aim+select
   +Space (Task 6), (b) nav-computer select+commit (existing). No new pilot.
2. Verify Q autopilot tour is unaffected by the E/F rewire (tour drives the pilot; free-look
   works during it; W/S takeover still cancels).
3. Light consolidation: comments/labels framing Q-tour (system-picks) vs Assist (you-pick)
   as one autopilot concept over the same pilot. No behavior change to the tour.

**Verify:** `npm run build` clean; flight+camera+ui suites green; live (Task 9).

**Commit:** `feat(supercruise): Assist target sources unified; tour unaffected`

---

### Task 9: Integration verify + regression + docs (all ACs)

**Files:** none (verify) + progress memory + morning handoff doc.

**Steps:**
- [ ] `npm run build` — clean.
- [ ] `./node_modules/.bin/vitest run src/flight src/camera src/ui` — green (≥ baseline
  187+13; new tests added).
- [ ] **Live integration sweep** (working-Claude drives, chrome-devtools :9223/:5174,
  fresh `/well-dipper/` tab, mute, hard-reload; testing-ref §6.5): AC3 (drop-out
  pose-preserving across drift), AC4 (E/F/Esc machine), AC5 (Assist via free-look + nav),
  AC6 (tour unaffected + screensaver loop), AC7 (asymmetric enter/drop shake). Record
  dPos/quatDot, screenshots, console-clean.
- [ ] Write the morning-review handoff (`/tmp/...-handoff-...md`) — verified vs assumed,
  exact UAT steps for Max, key bindings, what to look at.
- [ ] Update `memory/well-dipper-supercruise-progress.md` with the arc result at
  `VERIFIED_PENDING_MAX`. Do NOT touch NOW.md / FEATURES (not shipping; Max UAT first).

**Commit:** `test(supercruise): arrival+modes integration verify (VERIFIED_PENDING_MAX)`

---

## Self-review

- **Spec coverage:** AC1→T1, AC2→T2, AC8→T3, AC7→T4+T7, AC3/AC4→T5(+T6), AC5→T6+T8,
  AC6→T8, AC9→Max UAT (T9 surfaces). All ACs mapped.
- **Placeholders:** none — pure modules have real code; main.js tasks have concrete
  edit-intent + verify; tests are concrete.
- **Type consistency:** `model.setDrive`/`driveOn` (T1) consumed in T5; `freeLook`
  `toggle/latched/route/consumeRecenter` (T2) consumed in T5/T6; `enterImpulse/dropImpulse`
  (T4) consumed in T5/T7 — names consistent across tasks.
- **Risk:** T5–T8 all edit main.js → sequential, each headless-build-verified + adversarially
  reviewed + committed before the next. Live verify (T9) is the integration gate; UAT is Max's.
