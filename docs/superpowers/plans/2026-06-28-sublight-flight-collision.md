# Sublight Flight + Collision Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add throttle-controlled sublight flight when dropped out of supercruise (IUAT Issue 2), plus a hard "never fly through a body" guarantee (collision barrier + mass-based forced drop-out).

**Architecture:** Motion + collision live in the pure `SupercruiseModel`; the drive-state machine (forced-drop, mass-lock, choreography) lives in `main.js` `simStep`/E-key; the escape-velocity horizon is a new pure helper `proximityHorizon.js`; the readout is `SpeedFormat` (pure) + `SupercruiseHud` (view). The model is already signed-speed + bipolar-throttle ready, and the HUD already renders reverse — so the core change is the drive-OFF branch + a barrier.

**Tech Stack:** ES modules, three.js (Vector3/Quaternion math only in the model), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-28-sublight-flight-collision-design.md` (committed `0dea042`). Read it for physics rationale and unit-by-unit detail.

## Global Constraints

- **Pure model:** `SupercruiseModel.js` stays free of DOM/scene-graph. `proximityHorizon.js` is pure math (constants + arithmetic) — no THREE, no DOM.
- **Scene units everywhere in the model.** `SUBLIGHT_CAP = 0.002` scene-u/s ≈ 300 km/s (`300 / 149597.8707`). `v_ref` for the horizon = `SUBLIGHT_CAP`.
- **Unit bridge:** `2GM/v_ref²` is computed in SI then converted scene↔SI via `ScaleConstants` (`METERS_PER_SCENE`, `metersToScene`, `solarRadiiToScene`). `G`/`M_SUN` come from `PhysicsEngine` (export them).
- **Tests:** `npx vitest run src/flight src/ui`. Pre-existing UNRELATED failures in `src/generation` + `vendor/motion-test-kit` — ignore. Pre-commit hook prints `grep: subpattern name expected` — harmless.
- **Commit messages** end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Branch `feature/supercruise-freelook`; do NOT push (Max gates push).
- **Positional safety only** — no gravity-acceleration sim, no star heat/damage.

---

## File Structure

- **Modify** `src/flight/SupercruiseModel.js` — tuning constants; drive-OFF sublight branch; collision barrier; `proximityDropRequired()`; `turnRateCap` abs fix; `_scratch` vector.
- **Create** `src/flight/proximityHorizon.js` — pure `starMassKgFromSceneRadius()` + `forcedDropRadiusScene()`.
- **Modify** `src/generation/PhysicsEngine.js` — export `G` and `M_SUN`.
- **Modify** `src/ui/SpeedFormat.js` — add `sublightBarFrac()`.
- **Modify** `src/ui/SupercruiseHud.js` — SUBLIGHT label; bipolar speed bar when dropped; TOO CLOSE hint.
- **Modify** `src/main.js` — star `massKg` in `_scBodies` builder; forced-drop orchestration in `simStep`; mass-lock + throttle-reset in E-key; HUD feed fields; mass-lock-hint counter.
- **Modify** `src/flight/__tests__/SupercruiseModel.drop.test.js` — `DROP_TAU`→`SUBLIGHT_TAU`; rewrite the "ignores throttle target" test; adjust the small-body capture test geometry for the barrier.
- **Create** `src/flight/__tests__/SupercruiseModel.sublight.test.js` — sublight regime + collision barrier + proximityDropRequired.
- **Create** `src/flight/__tests__/proximityHorizon.test.js` — horizon math.
- **Modify** `src/ui/__tests__/SpeedFormat.test.js` — `sublightBarFrac`.

---

## Task 1: Sublight propulsion in the drive-OFF regime + tuning constants

**Files:**
- Modify: `src/flight/SupercruiseModel.js` (`SC_TUNING` lines 9-31; `update()` OFF branch lines 118-124; comments at 19/56/120)
- Modify: `src/flight/__tests__/SupercruiseModel.drop.test.js` (line 46 ref; the test at 75-86)
- Test: `src/flight/__tests__/SupercruiseModel.sublight.test.js` (create)

**Interfaces:**
- Produces: `SC_TUNING.SUBLIGHT_CAP` (number, scene-u/s), `SC_TUNING.SUBLIGHT_TAU` (renamed from `DROP_TAU`), `SC_TUNING.FORCED_DROP_FLOOR_FACTOR`, `SC_TUNING.COLLISION_FACTOR`. Drive-OFF `update()` now exp-approaches `throttle × SUBLIGHT_CAP`.

- [ ] **Step 1: Write the failing sublight tests**

Create `src/flight/__tests__/SupercruiseModel.sublight.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { SupercruiseModel, SC_TUNING } from '../SupercruiseModel.js';

const DT = 1 / 60;
const stepN = (m, n) => { for (let i = 0; i < n; i++) m.update(DT); };

describe('SupercruiseModel — sublight (drive OFF) propulsion', () => {
  it('OFF + full throttle accelerates toward +SUBLIGHT_CAP (no bodies)', () => {
    const m = new SupercruiseModel();
    m.setDrive(false);
    m.setThrottle(1);
    stepN(m, 300); // ~5s, well past SUBLIGHT_TAU
    expect(m.speed).toBeGreaterThan(0);
    expect(m.speed).toBeCloseTo(SC_TUNING.SUBLIGHT_CAP, 6);
  });

  it('OFF + zero throttle settles to a full STOP', () => {
    const m = new SupercruiseModel();
    m.setDrive(false);
    m.speed = SC_TUNING.SUBLIGHT_CAP; // moving
    m.setThrottle(0);
    stepN(m, 300);
    expect(m.speed).toBeCloseTo(0, 9);
  });

  it('OFF + negative throttle reverses toward -SUBLIGHT_CAP', () => {
    const m = new SupercruiseModel();
    m.setDrive(false);
    m.setThrottle(-1);
    stepN(m, 300);
    expect(m.speed).toBeLessThan(0);
    expect(m.speed).toBeCloseTo(-SC_TUNING.SUBLIGHT_CAP, 6);
  });

  it('OFF dropout from cruise with throttle 0 still sheds ≈all momentum (~1.5s)', () => {
    const m = new SupercruiseModel();
    m.setDrive(true); m.setThrottle(1); stepN(m, 120);
    const cruise = m.speed;
    m.setDrive(false); m.setThrottle(0);
    stepN(m, 90);
    expect(m.speed / cruise).toBeLessThan(0.03);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.sublight.test.js`
Expected: FAIL — `SUBLIGHT_CAP` is `undefined` (toBeCloseTo NaN) and OFF branch still decays to 0 (negative-throttle test fails: speed stays ≥ 0).

- [ ] **Step 3: Add the tuning constants**

In `src/flight/SupercruiseModel.js` `SC_TUNING`, rename `DROP_TAU` and add four constants. Replace the `DROP_TAU` line (19-21) with:

```javascript
  SUBLIGHT_TAU: 0.4,        // s — exponential approach time-constant for the drive-OFF (sublight) regime.
                            //   Handles BOTH the hard decel when you drop out AND throttle response at
                            //   sublight. (Renamed from DROP_TAU 2026-06-28: drive-OFF no longer decays to
                            //   zero — it approaches throttle × SUBLIGHT_CAP; with throttle 0 that IS rest.)
  SUBLIGHT_CAP: 0.002,      // u/s — fixed sublight top speed (≈ 300 km/s = 300 / 149597.87). NO mass.
                            //   Also v_ref for the forced-drop horizon. KEY TUNING KNOB — dial live.
  FORCED_DROP_FLOOR_FACTOR: 1.1,  // × radius (center-distance): minimum forced-drop buffer. Dominates for
                                  //   planets/moons (their mass horizon falls inside the surface).
  COLLISION_FACTOR: 1.05,   // × radius (center-distance): uniform hard barrier — never fly through a body.
```

Update the comment at line 56 (`zero by DROP_TAU`) → `zero by SUBLIGHT_TAU` (or reword: "settles to rest when throttle is 0 via SUBLIGHT_TAU").

- [ ] **Step 4: Replace the drive-OFF branch**

In `update()`, replace the `else` branch (lines 118-124) with:

```javascript
    } else {
      // DRIVE OFF (sublight): exp-approach to throttle × SUBLIGHT_CAP — the same
      // shape as the ON path, minus the MIN_CRUISE floor (full stop allowed) and
      // allowing a negative target (reverse). throttle ∈ [-1,1] → full reverse …
      // stop(0) … full forward. The E-key dropout zeroes throttle (main.js), so
      // dropping out SETTLES TO REST; then W/S maneuver at sublight.
      const cap = this.tuning.SUBLIGHT_CAP;
      const target = this.throttle * cap;
      const k = 1 - Math.exp(-dt / this.tuning.SUBLIGHT_TAU);
      this.speed += (target - this.speed) * k;
    }
```

- [ ] **Step 5: Run the sublight tests to verify they pass**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.sublight.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Fix the existing drop-test for the rename + new semantics**

In `src/flight/__tests__/SupercruiseModel.drop.test.js`:
- Line 46: `SC_TUNING.DROP_TAU` → `SC_TUNING.SUBLIGHT_TAU`.
- Replace the test at lines 75-86 ("drop-out ignores the throttle target") — it asserted the opposite of the new design. New version:

```javascript
  it('drop-out HONORS throttle at the sublight cap (settles toward throttle×SUBLIGHT_CAP, not the SC cap)', () => {
    const m = new SupercruiseModel();
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    const v = m.speed;                 // cruising fast
    m.setDrive(false);                 // dropped out, throttle LEFT at 1
    stepN(m, 300);                     // ~5s
    // It sheds the huge cruise speed and lands on the tiny sublight cap — NOT 0,
    // NOT the supercruise cap. (In practice the E-key zeroes throttle on dropout.)
    expect(m.speed).toBeLessThan(v);
    expect(m.speed).toBeCloseTo(SC_TUNING.SUBLIGHT_CAP, 6);
  });
```

- [ ] **Step 7: Run the full drop suite to confirm no regressions**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.drop.test.js`
Expected: PASS. (The decay-to-rest tests at lines 33/49/157 still pass: with throttle high but `SUBLIGHT_CAP`≈0, exp-approach-to-≈0 equals the old decay numerically. The near-body tests 88/100 still pass: they assert `speed ≤ cap`, and 0 ≤ cap. Test 134 is handled in Task 3.)

- [ ] **Step 8: Commit**

```bash
git add src/flight/SupercruiseModel.js src/flight/__tests__/SupercruiseModel.sublight.test.js src/flight/__tests__/SupercruiseModel.drop.test.js
git commit -m "feat(supercruise): sublight propulsion in the drive-OFF regime

Drive-OFF now exp-approaches throttle × SUBLIGHT_CAP instead of decaying
to zero. Full-stop (throttle 0) and reverse (throttle < 0) fall out of the
already-signed model. Renames DROP_TAU → SUBLIGHT_TAU; adds SUBLIGHT_CAP,
FORCED_DROP_FLOOR_FACTOR, COLLISION_FACTOR (latter two used in Tasks 3/4).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: turnRateCap reverse robustness

**Files:**
- Modify: `src/flight/SupercruiseModel.js` (`turnRateCap()` line 91)
- Test: `src/flight/__tests__/SupercruiseModel.sublight.test.js` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `turnRateCap()` symmetric in speed sign.

- [ ] **Step 1: Write the failing test** (append to `SupercruiseModel.sublight.test.js`)

```javascript
describe('SupercruiseModel — turn authority is symmetric in speed sign', () => {
  it('turnRateCap at -X equals turnRateCap at +X (reverse does not inflate it)', () => {
    const m = new SupercruiseModel(); // no bodies → cap = CAP_MAX
    m.speed = 5000;
    const fwd = m.turnRateCap();
    m.speed = -5000;
    const rev = m.turnRateCap();
    expect(rev).toBeCloseTo(fwd, 9);
    expect(rev).toBeLessThanOrEqual(SC_TUNING.TURN_RATE_MAX + 1e-9);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.sublight.test.js -t "symmetric"`
Expected: FAIL — at speed −5000, `frac` is negative → turn rate exceeds `TURN_RATE_MAX`, so `rev` ≠ `fwd`.

- [ ] **Step 3: Implement the abs fix**

In `turnRateCap()` (line 91), wrap speed in `Math.abs`:

```javascript
    const frac = Math.min(1, Math.abs(this.speed) / Math.max(1e-6, this.speedCap()));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.sublight.test.js -t "symmetric"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/flight/SupercruiseModel.js src/flight/__tests__/SupercruiseModel.sublight.test.js
git commit -m "fix(supercruise): symmetric turn authority under reverse (abs speed in turnRateCap)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Hard collision barrier (never fly through a body)

**Files:**
- Modify: `src/flight/SupercruiseModel.js` (`constructor` add `_scratch`; `update()` after translation line 133)
- Modify: `src/flight/__tests__/SupercruiseModel.drop.test.js` (small-body capture test geometry, line ~134)
- Test: `src/flight/__tests__/SupercruiseModel.sublight.test.js` (append)

**Interfaces:**
- Consumes: `SC_TUNING.COLLISION_FACTOR` (Task 1).
- Produces: `update()` clamps `position` to `COLLISION_FACTOR × radius` and zeroes `speed` on inward contact, both regimes.

- [ ] **Step 1: Write the failing barrier tests** (append to `SupercruiseModel.sublight.test.js`)

```javascript
import * as THREE from 'three';

describe('SupercruiseModel — hard collision barrier', () => {
  const body = () => ({ position: new THREE.Vector3(0, 0, 0), radius: 5 });

  it('a head-on inward step is clamped to COLLISION_FACTOR×radius and speed zeroed', () => {
    const m = new SupercruiseModel();
    const b = body();
    m.setBodies([b]);
    m.position.set(b.radius * 1.06, 0, 0);   // just outside the 1.05R barrier, on +x
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // nose → -x (into body)
    m.setDrive(false);
    m.setThrottle(1);
    stepN(m, 120);                            // drive straight in
    const barrier = SC_TUNING.COLLISION_FACTOR * b.radius;
    expect(m.position.distanceTo(b.position)).toBeGreaterThanOrEqual(barrier - 1e-6);
    expect(m.speed).toBeCloseTo(0, 9);
  });

  it('after hitting the barrier, turning away lets you leave (position moves outward)', () => {
    const m = new SupercruiseModel();
    const b = body();
    m.setBodies([b]);
    m.position.set(SC_TUNING.COLLISION_FACTOR * b.radius, 0, 0); // sitting on the barrier
    m.orientation.identity();                 // nose → -z (tangential, not into body)
    m.setDrive(false);
    m.setThrottle(1);
    const d0 = m.position.distanceTo(b.position);
    stepN(m, 120);
    expect(m.position.distanceTo(b.position)).toBeGreaterThan(d0); // got away
  });

  it('degenerate: a step landing at the body center is pushed out, no NaN', () => {
    const m = new SupercruiseModel();
    const b = body();
    m.setBodies([b]);
    m.position.copy(b.position);              // exactly at center
    m.speed = 0;
    m.update(DT);
    expect(Number.isFinite(m.position.x)).toBe(true);
    expect(m.position.distanceTo(b.position)).toBeCloseTo(SC_TUNING.COLLISION_FACTOR * b.radius, 6);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.sublight.test.js -t "collision barrier"`
Expected: FAIL — ship penetrates inside the barrier / lands at center (no clamp yet).

- [ ] **Step 3: Add the `_scratch` vector to the constructor**

In the constructor (after `this._q = new THREE.Quaternion();`, line 45):

```javascript
    this._scratch = new THREE.Vector3();     // collision-barrier projection scratch
```

- [ ] **Step 4: Implement the barrier after the translation step**

In `update()`, immediately AFTER `this.position.addScaledVector(this.nose(), this.speed * dt);` (line 133), add:

```javascript
    // Hard surface barrier (both regimes): never penetrate a body. If the step
    // landed inside COLLISION_FACTOR×radius, project back onto that barrier sphere
    // and stop. Bodies don't overlap, so at most one fires per tick. The clamp only
    // triggers on inward crossings — turning away leaves the new position outside,
    // so you can always fly off the surface.
    const cf = this.tuning.COLLISION_FACTOR;
    for (const b of this._bodies) {
      const barrier = cf * b.radius;
      const d = this.position.distanceTo(b.position);
      if (d < barrier) {
        if (d > 1e-9) {
          this._scratch.copy(this.position).sub(b.position).multiplyScalar(1 / d); // outward unit dir
        } else {
          this.nose(this._scratch);            // degenerate (at center): shove out along the nose
        }
        this.position.copy(b.position).addScaledVector(this._scratch, barrier);
        this.speed = 0;
      }
    }
```

- [ ] **Step 5: Run the barrier tests to verify they pass**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.sublight.test.js -t "collision barrier"`
Expected: PASS (3 tests).

- [ ] **Step 6: Fix the small-body capture test that now rams the barrier**

In `src/flight/__tests__/SupercruiseModel.drop.test.js`, test "(b) near a body where cap < MIN_CRUISE…" (≈line 134): the ship noses straight into a `radius=1e-3` body and `stepN(m, 600)` now drives it into the `1.05R` barrier (speed → 0), failing `speed > 0`. Keep the floor-yield intent but stop before barrier contact: change `m.position.set(body.radius * 1.5, ...)` to start farther out and reduce steps so it stays outside `1.05×radius`:

```javascript
    m.position.set(body.radius * 3, 0, 0);                  // start well outside the 1.05R barrier
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // nose toward -x (the body)
    const cap0 = m.speedCap();
    expect(cap0).toBeLessThan(SC_TUNING.MIN_CRUISE);
    m.setDrive(true);
    m.setThrottle(0);
    stepN(m, 60);                                           // settle on the cap, BEFORE reaching the barrier
```

Then confirm the post-step assertions still describe the cap-governed sub-floor regime (they do: `speed ≤ cap`, `speed < MIN_CRUISE`, `speed > 0`). If `speed > 0` is still flaky, lower the step count until `m.position.distanceTo(body.position) > 1.05 * body.radius` holds throughout — verify by reading `m.position.x` after the loop.

- [ ] **Step 7: Run the full flight suite**

Run: `npx vitest run src/flight`
Expected: PASS (all `SupercruiseModel.*` green; pre-existing unrelated failures elsewhere are out of scope).

- [ ] **Step 8: Commit**

```bash
git add src/flight/SupercruiseModel.js src/flight/__tests__/SupercruiseModel.sublight.test.js src/flight/__tests__/SupercruiseModel.drop.test.js
git commit -m "feat(supercruise): hard collision barrier — never fly through a body

After each translation, clamp position out of COLLISION_FACTOR×radius and
zero speed (both regimes). You can still turn and fly away. Adjusts the
small-body capture test to exercise the floor-yield without ramming the
new barrier.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Mass-based forced-drop horizon (helper + model query)

**Files:**
- Modify: `src/generation/PhysicsEngine.js` (export `G` line 30, `M_SUN` line 32)
- Create: `src/flight/proximityHorizon.js`
- Modify: `src/flight/SupercruiseModel.js` (import helper; add `proximityDropRequired()`)
- Test: `src/flight/__tests__/proximityHorizon.test.js` (create); append to `SupercruiseModel.sublight.test.js`

**Interfaces:**
- Consumes: `SC_TUNING.FORCED_DROP_FLOOR_FACTOR`, `SC_TUNING.SUBLIGHT_CAP`; body entries optionally carry `massKg`.
- Produces:
  - `starMassKgFromSceneRadius(sceneRadius: number) → number` (kg)
  - `forcedDropRadiusScene(massKg: number, vRefScenePerSec: number) → number` (scene units; 0 if massKg falsy)
  - `SupercruiseModel.proximityDropRequired() → boolean`

- [ ] **Step 1: Write the failing horizon tests**

Create `src/flight/__tests__/proximityHorizon.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { starMassKgFromSceneRadius, forcedDropRadiusScene } from '../proximityHorizon.js';
import { solarRadiiToScene } from '../../core/ScaleConstants.js';
import { SC_TUNING } from '../SupercruiseModel.js';

describe('proximityHorizon', () => {
  it('a 1-solar-radius star derives ≈1 solar mass (1.989e30 kg)', () => {
    const sceneR = solarRadiiToScene(1); // 4.65 scene-u
    const m = starMassKgFromSceneRadius(sceneR);
    expect(m).toBeGreaterThan(1.9e30);
    expect(m).toBeLessThan(2.1e30);
  });

  it('a more massive (larger) star derives a larger mass', () => {
    const big = starMassKgFromSceneRadius(solarRadiiToScene(10));
    const small = starMassKgFromSceneRadius(solarRadiiToScene(1));
    expect(big).toBeGreaterThan(small);
  });

  it('the G-star horizon is ~4.2 stellar radii (~19-20 scene-u)', () => {
    const sceneR = solarRadiiToScene(1);
    const massKg = starMassKgFromSceneRadius(sceneR);
    const d = forcedDropRadiusScene(massKg, SC_TUNING.SUBLIGHT_CAP);
    expect(d / sceneR).toBeGreaterThan(3.5);
    expect(d / sceneR).toBeLessThan(5.0);
  });

  it('zero / missing mass → zero horizon', () => {
    expect(forcedDropRadiusScene(0, SC_TUNING.SUBLIGHT_CAP)).toBe(0);
    expect(forcedDropRadiusScene(undefined, SC_TUNING.SUBLIGHT_CAP)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/flight/__tests__/proximityHorizon.test.js`
Expected: FAIL — module `proximityHorizon.js` does not exist.

- [ ] **Step 3: Export the physical constants**

In `src/generation/PhysicsEngine.js`, add `export` to the two constants (lines 30, 32):

```javascript
export const G = 6.674e-11;            // gravitational constant (m³/kg/s²)
```
```javascript
export const M_SUN = 1.989e30;         // solar mass (kg)
```

(Leave the other `const` lines as-is.)

- [ ] **Step 4: Create the pure helper**

Create `src/flight/proximityHorizon.js`:

```javascript
// src/flight/proximityHorizon.js
//
// Pure escape-velocity "horizon" math for the supercruise forced drop-out
// (spec 2026-06-28-sublight-flight-collision §2). The forced-drop distance is
// the distance where escape velocity rises to meet the ship's reference speed:
//   d_horizon = 2·G·M / v_ref²   (∝ mass; radius enters only as the floor, in the model)
// Only stars are massive enough for this to exceed the radius floor — planets/
// moons are floor-dominated, so we only ever feed star mass.
//
// No THREE, no DOM — pure arithmetic + constants.
import { G, M_SUN } from '../generation/PhysicsEngine.js';
import { METERS_PER_SCENE, metersToScene, solarRadiiToScene } from '../core/ScaleConstants.js';

const SCENE_PER_SOLAR_RADIUS = solarRadiiToScene(1); // 4.65 scene-u per solar radius

/** Re-derive a star's mass (kg) from its rendered scene radius, using the
 *  generator's own mass-radius relation massSolar = radiusSolar^1.25
 *  (StarSystemGenerator.js:239). Avoids persisting mass upstream. */
export function starMassKgFromSceneRadius(sceneRadius) {
  const solarRadii = sceneRadius / SCENE_PER_SOLAR_RADIUS;
  const massSolar = Math.pow(solarRadii, 1.25);
  return massSolar * M_SUN;
}

/** Forced-drop horizon distance in SCENE units for a body of mass `massKg`,
 *  given the ship's reference speed in scene-units/sec. Returns 0 for falsy mass. */
export function forcedDropRadiusScene(massKg, vRefScenePerSec) {
  if (!massKg || massKg <= 0) return 0;
  const vRefMps = vRefScenePerSec * METERS_PER_SCENE; // scene-u/s → m/s
  const dMeters = (2 * G * massKg) / (vRefMps * vRefMps);
  return metersToScene(dMeters);
}
```

- [ ] **Step 5: Run the horizon tests to verify they pass**

Run: `npx vitest run src/flight/__tests__/proximityHorizon.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing `proximityDropRequired` tests** (append to `SupercruiseModel.sublight.test.js`)

```javascript
import { starMassKgFromSceneRadius } from '../proximityHorizon.js';
import { solarRadiiToScene, earthRadiiToScene } from '../../core/ScaleConstants.js';

describe('SupercruiseModel — proximityDropRequired (forced-drop horizon)', () => {
  it('true inside a star horizon, false outside', () => {
    const m = new SupercruiseModel();
    const sceneR = solarRadiiToScene(1);
    const star = { position: new THREE.Vector3(0, 0, 0), radius: sceneR, massKg: starMassKgFromSceneRadius(sceneR) };
    m.setBodies([star]);
    m.position.set(sceneR * 3, 0, 0);  // 3R — inside the ~4.2R horizon
    expect(m.proximityDropRequired()).toBe(true);
    m.position.set(sceneR * 6, 0, 0);  // 6R — outside
    expect(m.proximityDropRequired()).toBe(false);
  });

  it('an Earth-radius body (no massKg) only trips inside the 1.1R floor', () => {
    const m = new SupercruiseModel();
    const r = earthRadiiToScene(1);
    const planet = { position: new THREE.Vector3(0, 0, 0), radius: r }; // no massKg → floor only
    m.setBodies([planet]);
    m.position.set(r * 1.2, 0, 0);     // outside 1.1R floor
    expect(m.proximityDropRequired()).toBe(false);
    m.position.set(r * 1.05, 0, 0);    // inside 1.1R floor
    expect(m.proximityDropRequired()).toBe(true);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.sublight.test.js -t "proximityDropRequired"`
Expected: FAIL — `proximityDropRequired is not a function`.

- [ ] **Step 8: Implement `proximityDropRequired()`**

In `src/flight/SupercruiseModel.js`, add the import near the top (after the THREE import):

```javascript
import { forcedDropRadiusScene } from './proximityHorizon.js';
```

Add the method after `speedCap()` (after line 86):

```javascript
  /** True when any body is within its forced-drop distance =
   *  max(FORCED_DROP_FLOOR_FACTOR × radius, escape-velocity horizon). The horizon
   *  (2GM/v_ref²) only exceeds the floor for stars; bodies without `massKg` use the
   *  floor. main.js calls this to force a supercruise drop-out and to mass-lock
   *  re-engage. v_ref = SUBLIGHT_CAP. Pure. */
  proximityDropRequired() {
    const floorFactor = this.tuning.FORCED_DROP_FLOOR_FACTOR;
    const vRef = this.tuning.SUBLIGHT_CAP;
    for (const b of this._bodies) {
      const floor = floorFactor * b.radius;
      const horizon = forcedDropRadiusScene(b.massKg, vRef);
      if (this.position.distanceTo(b.position) < Math.max(floor, horizon)) return true;
    }
    return false;
  }
```

- [ ] **Step 9: Run to verify it passes + full flight suite**

Run: `npx vitest run src/flight`
Expected: PASS (all SupercruiseModel + proximityHorizon green).

- [ ] **Step 10: Commit**

```bash
git add src/generation/PhysicsEngine.js src/flight/proximityHorizon.js src/flight/SupercruiseModel.js src/flight/__tests__/proximityHorizon.test.js src/flight/__tests__/SupercruiseModel.sublight.test.js
git commit -m "feat(supercruise): mass-based forced-drop horizon (escape-velocity, star-scoped)

Pure proximityHorizon.js: star mass from radius (^1.25) + d=2GM/v_ref².
SupercruiseModel.proximityDropRequired() = inside max(1.1R floor, horizon).
Exports G/M_SUN from PhysicsEngine for the unit bridge.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: sublightBarFrac (readout math)

**Files:**
- Modify: `src/ui/SpeedFormat.js` (add export)
- Test: `src/ui/__tests__/SpeedFormat.test.js` (append)

**Interfaces:**
- Produces: `sublightBarFrac(sceneUPerSec: number, cap: number) → number` in `[-1, 1]` (signed, linear; 0 if cap ≤ 0).

- [ ] **Step 1: Write the failing test** (append to `src/ui/__tests__/SpeedFormat.test.js`)

```javascript
import { sublightBarFrac } from '../SpeedFormat.js';

describe('sublightBarFrac — linear bipolar sublight bar', () => {
  const CAP = 0.002;
  it('maps stop/forward/reverse to 0/+1/-1', () => {
    expect(sublightBarFrac(0, CAP)).toBe(0);
    expect(sublightBarFrac(CAP, CAP)).toBeCloseTo(1, 9);
    expect(sublightBarFrac(-CAP, CAP)).toBeCloseTo(-1, 9);
  });
  it('clamps beyond the cap', () => {
    expect(sublightBarFrac(2 * CAP, CAP)).toBe(1);
    expect(sublightBarFrac(-2 * CAP, CAP)).toBe(-1);
  });
  it('cap ≤ 0 → 0 (no divide-by-zero)', () => {
    expect(sublightBarFrac(0.001, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/__tests__/SpeedFormat.test.js -t "sublightBarFrac"`
Expected: FAIL — `sublightBarFrac` not exported.

- [ ] **Step 3: Implement it**

In `src/ui/SpeedFormat.js`, after `speedToBarFrac` (line 89), add:

```javascript
/**
 * Linear bipolar bar fraction for the sublight regime: the log speed bar
 * (speedToBarFrac) pins ~empty below ~150 km/s, so sublight gets its own
 * center-anchored scale. Reverse → negative, stop → 0, full forward → +1.
 * @param {number} sceneUPerSec signed speed in scene-units/sec
 * @param {number} cap sublight cap (scene-u/s)
 * @returns {number} signed fill fraction in [-1, 1]
 */
export function sublightBarFrac(sceneUPerSec, cap) {
  if (!(cap > 0)) return 0;
  return Math.min(1, Math.max(-1, sceneUPerSec / cap));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/__tests__/SpeedFormat.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/SpeedFormat.js src/ui/__tests__/SpeedFormat.test.js
git commit -m "feat(ui): sublightBarFrac — linear bipolar bar for the sublight regime

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire star mass, forced drop-out, mass-lock, throttle reset (main.js)

Integration task — no unit tests (main.js wiring + choreography). Verified by `npm run build` then live (Task 7 covers the visible half; behavior here is live-verified by working-Claude in Sol). Right-sized as one task: these edits all live in the supercruise drive-state machine and a reviewer would accept/reject them together.

**Files:**
- Modify: `src/main.js` — import; `_scBodies` builder (7785/7788); `simStep` forced-drop (after 7801); E-key handler (9124-9145); mass-lock-hint counter; stale comment (8080).

**Interfaces:**
- Consumes: `starMassKgFromSceneRadius` (Task 4), `scModel.proximityDropRequired()` (Task 4), `scModel.setThrottle` / `setDrive`.
- Produces: module-scope `let _massLockHintFrames = 0;` (read by Task 7's HUD feed).

- [ ] **Step 1: Import the mass helper**

Near the other `./flight/...` imports at the top of `main.js` (the `flightModes.js` import is at line 50), add:

```javascript
import { starMassKgFromSceneRadius } from './flight/proximityHorizon.js';
```

- [ ] **Step 2: Attach `massKg` to the star bodies in the live builder**

In `simStep`'s `scActive` block, the two star pushes (lines 7785, 7788) gain `massKg`. Replace:

```javascript
          _scBodies.push({ position: system.star.mesh.position, radius: system.star.data.radius });
```
with:
```javascript
          _scBodies.push({ position: system.star.mesh.position, radius: system.star.data.radius,
                           massKg: starMassKgFromSceneRadius(system.star.data.radius) });
```
and the same for `system.star2` (line 7788). Leave the planet/moon pushes unchanged (floor-dominated — no mass needed).

- [ ] **Step 3: Add a module-scope mass-lock-hint counter**

Near the other supercruise module-scope state (e.g., beside `const _scBodies = [];` at line 531), add:

```javascript
let _massLockHintFrames = 0;   // >0 → HUD shows "TOO CLOSE" after a mass-locked reengage; counts down in simStep
```

- [ ] **Step 4: Forced proximity drop-out + hint countdown in simStep**

Immediately AFTER `scModel.setBodies(_scBodies);` (line 7801), add:

```javascript
      // Forced proximity drop-out (spec §Unit 5): in hands-on flight, if the drive
      // is ON and we've crossed a body's forced-drop horizon (mass-based for stars,
      // 1.1R floor otherwise), kick to sublight. The hard barrier (model) is the
      // backstop; this is the supercruise-side safety + the "stars push you out far".
      if (_scManual && scModel.driveOn && scModel.proximityDropRequired()) {
        scModel.setDrive(false);
        scModel.setThrottle(0);
        shipChoreographer.dropImpulse();
        console.log('[MODE] forced proximity drop — too close to a body');
      }
      if (_massLockHintFrames > 0) _massLockHintFrames--;
```

- [ ] **Step 5: Mass-lock + throttle reset in the E-key handler**

Replace the action dispatch (lines 9133-9143) with:

```javascript
    if (action === 'engage') {
      scControls.engage();          // enter In-Flight at the Settings-selected type
      scModel.setDrive(true);       // ensure the drive is propelling
      scModel.setThrottle(0);       // start from rest; W/S take over
      shipChoreographer.enterImpulse();
    } else if (action === 'dropout') {
      scModel.setDrive(false);      // drop to sublight; reset throttle so we SETTLE TO REST first
      scModel.setThrottle(0);
      shipChoreographer.dropImpulse();
    } else { // 'reengage'
      if (scModel.proximityDropRequired()) {  // mass-lock: too close to (re)engage supercruise
        _massLockHintFrames = 90;             // ~1.5s "TOO CLOSE" hint
        console.log('[MODE] reengage blocked — mass-locked (too close to a body)');
        return;
      }
      scModel.setDrive(true);       // re-engage; anti-clip via speedCap
      scModel.setThrottle(0);
      shipChoreographer.enterImpulse();
    }
```

- [ ] **Step 6: Fix the stale throttle-clamp comment**

At line ~8080, change the comment `setThrottle clamps to 0..1 internally.` to `setThrottle clamps to -1..1 internally (S past 0 = reverse, honored at sublight).`

- [ ] **Step 7: Build to verify it compiles**

Run: `npm run build`
Expected: clean (only the pre-existing >500 kB chunk advisory).

- [ ] **Step 8: Commit**

```bash
git add src/main.js
git commit -m "feat(supercruise): wire forced proximity drop-out, mass-lock, throttle reset

Star bodies carry massKg (derived from radius) into the gravity-well list.
simStep forces a drive-OFF drop when inside a body's forced-drop horizon
(manual flight). E-key resets throttle on every transition (settle to rest
on dropout) and blocks reengage while mass-locked (TOO CLOSE hint).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: HUD readout — SUBLIGHT label, bipolar speed bar, TOO CLOSE hint

Integration task — canvas drawing, live-verified. Right-sized with the HUD feed because the feed fields exist only to drive these draws.

**Files:**
- Modify: `src/main.js` — HUD feed (`scHud.update({...})`, line 8502): add `driveOn`, `sublightCap`, `massLockHint`; regime-aware `commandedSpeed`.
- Modify: `src/ui/SupercruiseHud.js` — import `sublightBarFrac`; SUBLIGHT label; bipolar speed bar when `driveOn === false`; TOO CLOSE hint.

**Interfaces:**
- Consumes: `sublightBarFrac` (Task 5); `SC_TUNING.SUBLIGHT_CAP`; `scModel.driveOn`; `_massLockHintFrames` (Task 6).

- [ ] **Step 1: Extend the HUD feed in main.js**

In the `scHud.update({ … })` call (line 8502), change `commandedSpeed` and add three fields:

```javascript
    commandedSpeed: scModel.driveOn
      ? scModel.throttle * scModel.speedCap()
      : scModel.throttle * SC_TUNING.SUBLIGHT_CAP,
    driveOn: scModel.driveOn,
    sublightCap: SC_TUNING.SUBLIGHT_CAP,
    massLockHint: _massLockHintFrames > 0,
```

(Leave `speed`, `throttle`, `deflection`, etc. as-is.)

- [ ] **Step 2: Import sublightBarFrac in the HUD**

In `src/ui/SupercruiseHud.js` line 7, extend the import:

```javascript
import { formatSpeed, speedToBarFrac, sublightBarFrac } from './SpeedFormat.js';
```

- [ ] **Step 3: Swap the speed bar to a bipolar sublight bar when dropped out**

In `update()`, the "(2) Horizontal LOG speed bar" block (lines 93-99 draws the log bar). Wrap it so sublight uses a center-anchored linear bar. Replace lines 95-99 (`const sbY …` through the log `fillRect`) with:

```javascript
    const sbY = innerHeight - 52, sbH = 8;
    c.strokeStyle = '#9fe8ff';
    c.strokeRect(lx, sbY, barW, sbH);
    if (state.driveOn === false) {
      // SUBLIGHT: linear bipolar bar — center zero, right = forward, left (amber) = reverse.
      const cxBar = lx + barW / 2;
      const frac = sublightBarFrac(speed, state.sublightCap || 1);
      c.strokeStyle = '#9fe8ff';
      c.beginPath(); c.moveTo(cxBar, sbY - 2); c.lineTo(cxBar, sbY + sbH + 2); c.stroke();
      const w = (barW / 2) * Math.abs(frac);
      c.fillStyle = frac < 0 ? '#ffb84d' : speedColor;
      if (frac >= 0) c.fillRect(cxBar, sbY, w, sbH);
      else c.fillRect(cxBar - w, sbY, w, sbH);
    } else {
      c.fillStyle = speedColor;
      c.fillRect(lx, sbY, barW * speedToBarFrac(Math.abs(speed)), sbH);
    }
```

(The commanded "pin" and drop tick below it stay as-is — they read fine in both regimes.)

- [ ] **Step 4: Add the SUBLIGHT mode label**

After the large numeric speed `fillText` (line 83), add an amber SUBLIGHT tag when dropped out:

```javascript
    if (state.driveOn === false) {
      c.fillStyle = '#ffb84d';
      c.font = '12px monospace';
      c.fillText('SUBLIGHT', lx, innerHeight - 84);
    }
```

- [ ] **Step 5: Add the TOO CLOSE mass-lock hint**

Inside `update()`, after the flight-assist mode block (after line 208, before the closing brace of `update`), add a centered hint:

```javascript
    if (state.massLockHint) {
      c.fillStyle = '#ff7b6b';
      c.font = '14px monospace';
      c.textAlign = 'center';
      c.fillText('TOO CLOSE — SUBLIGHT ONLY', innerWidth / 2, innerHeight / 2 + 48);
      c.textAlign = 'left';
    }
```

- [ ] **Step 6: Build + run UI tests**

Run: `npm run build && npx vitest run src/ui`
Expected: build clean; `SpeedFormat` + `SupercruiseHud` tests pass (the HUD test exercises `update()` with a canvas stub — confirm the new branches don't throw; if `SupercruiseHud.test.js` calls `update` without `driveOn`, the `=== false` guards default to the supercruise path, so existing cases stay green).

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/ui/SupercruiseHud.js
git commit -m "feat(ui): SUBLIGHT label + bipolar sublight speed bar + TOO CLOSE hint

HUD feed gains driveOn/sublightCap/massLockHint and a regime-aware
commandedSpeed. When dropped out the speed bar switches to a center-anchored
linear bar (amber reverse); a SUBLIGHT tag and a mass-lock hint render.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `npx vitest run src/flight src/ui` → all green (ignore pre-existing `src/generation` + `vendor/motion-test-kit` failures).
- [ ] `npm run build` → clean.
- [ ] **Adversarial review** (subagent, `model:"opus"`): collision clamp (tunneling, center-degenerate, multi-body), the horizon unit bridge, mass-lock not soft-locking, the drop-test rewrites.
- [ ] **Live (working-Claude, chrome-devtools, Sol via `window._lab.enterSol()`):**
  - Drop out (E) → SUBLIGHT label + bipolar bar; W forward, S reverse (past 0), throttle 0 → full stop.
  - Fly head-on into a planet → clamps just above the surface, speed reads 0; turn away → fly off.
  - Approach the star → forced drop at several radii; E to reengage → blocked + "TOO CLOSE" hint; back off then reengage works.
- [ ] **UAT:** Max's gate alone (feel of sublight + the safety net). Mark UAT ACs `deferred-to-max`.

## Self-review notes (done while writing)

- **Spec coverage:** Units 1-8 of the spec all map to tasks (1→T1, 2→T1, 3→T3, 4→T4+T6, 5→T6, 6→T6, 7→T5+T7, 8→T2). ✓
- **Type consistency:** `proximityDropRequired()`, `forcedDropRadiusScene(massKg, vRef)`, `starMassKgFromSceneRadius(sceneRadius)`, `sublightBarFrac(speed, cap)`, `_massLockHintFrames`, feed keys `driveOn`/`sublightCap`/`massLockHint` are used identically across tasks. ✓
- **Known test interactions documented:** DROP_TAU rename + test-75 rewrite (T1 S6); small-body capture geometry vs barrier (T3 S6); HUD test default-path safety (T7 S6). ✓
