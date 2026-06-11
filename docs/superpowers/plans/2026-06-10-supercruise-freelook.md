# Supercruise + Freelook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all in-system motion with an Elite-Dangerous-style supercruise flight model (one model, two drivers: autopilot + player), with Elite-style hold-to-look freelook and a minimal HUD, per `docs/WORKSTREAMS/supercruise-freelook-2026-06-10/contract.json`.

**Architecture:** Three new pure-math modules in `src/flight/` — `SupercruiseModel` (ship entity: nose-vector kinematics, throttle→target speed, gravity-well speed cap, capped turn rate), `HeadMount` (rotation-only head/camera mount, hold-to-look, eased recenter — **computed math, NOT Object3D parenting**, per the WorldOrigin no-camera-parent rule at `src/core/WorldOrigin.js:148-150`), `SupercruisePilot` (autopilot driver issuing the same throttle/steer commands a player would). main.js integrates them in `simStep` (fixed 60Hz — never in renderFrame; the camera interpolator owns render-time blending) and cuts over the three motion seams one at a time: tour legs (AutopilotMotion), post-warp fly-in (`warpRevealSystem` → NavigationSubsystem), COMMIT BURN (`focus*` → NavigationSubsystem). HUD is a `TargetingReticle`-pattern canvas overlay updated in renderFrame.

**Tech Stack:** three.js, Vitest 4 (`npm test`), chrome-devtools MCP on GPU :9223 for live integration (per `~/.claude/projects/-home-ax/memory/well-dipper-testing-reference.md`).

**Ground rules for executors:**
- main.js line numbers below were verified 2026-06-10 but a parallel session shares this tree — **always locate edits by the quoted anchor text, not the line number.**
- **File-scoped commits only** (`git commit --only <paths>`) — the parallel LOD session commits to the same branch.
- Never start a dev server (Vite is already running for the :9223 tab). Never push.
- Run targeted tests (`npx vitest run <file>`), not the full suite, until the final task (known pre-existing failures: KnownObjects ×3, GalacticFeatures ×1, vendor runner-mismatch — not ours).
- Tunables: every feel constant lives in an exported `SC_TUNING` object and is exposed as `window._sc` for live UAT tuning (house pattern: `_warpArrivalMargin`).

**Key codebase facts (from the 2026-06-10 exploration; cite, don't re-derive):**
- The camera IS the ship today. Movers write `camera.position` inside `simStep` (main.js:7153 AutopilotMotion branch / :7282 flythrough branch / :7470 manual fallback).
- `cameraInterp` (CameraInterpolator, main.js:7544) lerps the camera per render frame; **teleports require `cameraInterp.resync(camera)`**; world-origin rebase fires at tick start (main.js:6216) and `_trackControllerCaches` (main.js:512-561) registers every controller-cached world-frame Vector3 for rebase subtraction. The new model's `position` must join that list.
- Shake = `ShipChoreographer.debugAccelImpulse()/debugDecelImpulse()` triggered at phase boundaries (main.js:7179-7185), euler composed onto `camera.quaternion` post-lookAt (main.js:7253-7258). This is the AC6 beat to preserve.
- Body meshes are absolute-recomputed every tick in the rebased frame (main.js:6299-6403) — read `mesh.position` fresh each tick; never cache body positions across ticks.
- `ShipCameraSystem` stays the camera-MODE owner (TOY_BOX/FLIGHT enum, F key main.js:8229, `wd_cameraMode` persistence, isMobile lock). FLIGHT mode's internals (FlightDynamics/CinematicDirector drive) are superseded by supercruise-manual.
- W/S/A/D held-key consumption seam: main.js:7445-7465 (`flightOk` gate). Autopilot interrupt: W/A/S/D at main.js:8257-8260; mouse-drag >5px at :8770-8788; wheel TOY_BOX-only at :8720-8727. Idle re-arm: main.js:7337-7363.
- COMMIT BURN reproduction list (all seven, from `focusMoon` main.js:6044-6082 etc.): `_selectedTarget` set before travel; `focusIndex/focusMoonIndex/focusStarIndex` writes; `bodyInfo.show*`; `_syncNavBody()`; BURN-button predicate `_updateCommitBurnButton` (main.js:5847); camera ownership (`bypassed = true`); `_manualBurnOrbiting` arming on arrival (main.js:7310-7312).

---

## File structure

| File | Responsibility |
|---|---|
| Create `src/flight/SupercruiseModel.js` | Ship entity + flight model. Pure math, no THREE scene, no DOM. |
| Create `src/flight/HeadMount.js` | Head/camera mount: hold-to-look state, eased recenter, `applyTo(camera, shipPos, shipQuat)`. |
| Create `src/flight/SupercruisePilot.js` | Autopilot driver: ALIGN/CRUISE/HOLD phases, drop window, one-shot frames (AutopilotMotion's frame idiom). |
| Create `src/ui/SupercruiseHud.js` | Canvas HUD: speed, throttle, joystick reticle, target marker + drop window. TargetingReticle pattern. |
| Create `src/flight/__tests__/SupercruiseModel.test.js`, `HeadMount.test.js`, `SupercruisePilot.test.js` | Headless unit suites (AC1, AC2, pilot logic). |
| Modify `src/main.js` | Instantiate; simStep mover branch; three seam cutovers; input bindings; rebase tracking; HUD render-site; retirement. |
| Modify `src/auto/` (final task) | Retire AutopilotMotion + NavigationSubsystem from the live path (quarantine `focusShip`'s ship-lock path — see Task 12). |

---

### Task 1: SupercruiseModel — nose-vector kinematics + throttle (AC1 core)

**Files:** Create `src/flight/SupercruiseModel.js`, `src/flight/__tests__/SupercruiseModel.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/flight/__tests__/SupercruiseModel.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel, SC_TUNING } from '../SupercruiseModel.js';

const DT = 1 / 60;

describe('SupercruiseModel — nose-vector flight + throttle', () => {
  it('advances only along the nose vector', () => {
    const m = new SupercruiseModel();
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
    m.setThrottle(1);
    for (let i = 0; i < 120; i++) {
      const before = m.position.clone();
      m.update(DT);
      const delta = m.position.clone().sub(before);
      if (delta.lengthSq() === 0) continue;
      const nose = m.nose(new THREE.Vector3());
      expect(delta.normalize().dot(nose)).toBeCloseTo(1, 6);
    }
    expect(m.speed).toBeGreaterThan(0);
  });

  it('speed approaches throttle × cap asymptotically — bounded accel, no step change', () => {
    const m = new SupercruiseModel(); // no bodies → cap = CAP_MAX
    m.setThrottle(1);
    let prev = 0; let prevDelta = Infinity;
    for (let i = 0; i < 600; i++) {
      m.update(DT);
      const delta = m.speed - prev;
      expect(delta).toBeGreaterThanOrEqual(0);          // monotonic toward target
      expect(delta).toBeLessThanOrEqual(prevDelta + 1e-9); // decreasing increments (exponential ease)
      prev = m.speed; prevDelta = delta;
    }
    expect(m.speed).toBeLessThan(SC_TUNING.CAP_MAX);     // asymptote, never overshoots
    expect(m.speed).toBeGreaterThan(SC_TUNING.CAP_MAX * 0.9);
  });

  it('throttle 0 decays speed smoothly toward 0', () => {
    const m = new SupercruiseModel();
    m.speed = 100; m.setThrottle(0);
    for (let i = 0; i < 600; i++) m.update(DT);
    expect(m.speed).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/flight/__tests__/SupercruiseModel.test.js`
Expected: FAIL — `SupercruiseModel` not exported / module not found.

- [ ] **Step 3: Implement the model core**

```js
// src/flight/SupercruiseModel.js
//
// Elite-Dangerous-style supercruise flight model — the single authoritative
// source of in-system ship motion (contract supercruise-freelook-2026-06-10).
// Pure math: no scene graph, no DOM. Positions are SCENE-LOCAL (rebased frame);
// main.js registers `position` for world-origin rebase subtraction.
import * as THREE from 'three';

export const SC_TUNING = {
  ETA_K: 6.0,               // speed cap = surfaceDist / ETA_K (Elite's ~6s rule)
  CAP_MIN_FRAC: 0.5,        // per-body cap floor = radius × this (scale-free: capture stays possible at any body size)
  CAP_MIN_ABS: 1e-5,        // u/s absolute floor — pure numerical safety; MUST stay ≤ 5.3 × smallest capturable body radius (capture needs 0.75×floor ≤ 4R; smallest moon ≈ 4e-5)
  CAP_MAX: 20000.0,         // u/s deep-space ceiling
  ACCEL_TAU: 1.4,           // s — exponential approach to target speed (heavy feel)
  TURN_RATE_MAX: 0.7,       // rad/s at rest
  TURN_RATE_MIN_FRAC: 0.25, // turn authority remaining at full local speed
  THROTTLE_RATE: 0.6,       // throttle units/s for held W/S stepping
};

export class SupercruiseModel {
  constructor(tuning = {}) {
    this.tuning = { ...SC_TUNING, ...tuning };
    this.position = new THREE.Vector3();      // scene-local (rebased) frame
    this.orientation = new THREE.Quaternion();
    this.speed = 0;                            // u/s along the nose, ≥ 0
    this.throttle = 0;                         // 0..1
    this.turnInput = { yaw: 0, pitch: 0 };     // -1..1 each
    this._bodies = [];                         // [{ position: Vector3, radius: number }]
    this._nose = new THREE.Vector3();
    this._euler = new THREE.Euler();
    this._q = new THREE.Quaternion();
  }

  /** Bodies used for the gravity-well speed cap. Caller refreshes per tick
   *  with CURRENT rebased mesh positions (never cache across ticks). */
  setBodies(list) { this._bodies = list; }

  setThrottle(t) { this.throttle = THREE.MathUtils.clamp(t, 0, 1); }

  setTurnInput(yaw, pitch) {
    this.turnInput.yaw = THREE.MathUtils.clamp(yaw, -1, 1);
    this.turnInput.pitch = THREE.MathUtils.clamp(pitch, -1, 1);
  }

  nose(out = this._nose) {
    return out.set(0, 0, -1).applyQuaternion(this.orientation);
  }

  /** Gravity-well cap: min over bodies of clamp(surfaceDist / ETA_K). */
  speedCap() {
    const t = this.tuning;
    let cap = t.CAP_MAX;
    for (const b of this._bodies) {
      const d = Math.max(0, this.position.distanceTo(b.position) - b.radius);
      const c = Math.max(t.CAP_MIN_ABS, b.radius * t.CAP_MIN_FRAC, d / t.ETA_K);
      if (c < cap) cap = c;
    }
    return cap;
  }

  /** Turn authority shrinks as speed approaches the local cap (Elite feel). */
  turnRateCap() {
    const t = this.tuning;
    const frac = Math.min(1, this.speed / Math.max(1e-6, this.speedCap()));
    return t.TURN_RATE_MAX * (1 - (1 - t.TURN_RATE_MIN_FRAC) * frac);
  }

  update(dt) {
    // Steering first: ship-local yaw/pitch at the capped rate.
    const rate = this.turnRateCap();
    const yaw = this.turnInput.yaw * rate * dt;
    const pitch = this.turnInput.pitch * rate * dt;
    if (yaw !== 0 || pitch !== 0) {
      this._q.setFromEuler(this._euler.set(pitch, yaw, 0, 'YXZ'));
      this.orientation.multiply(this._q).normalize();
    }
    // Speed: exponential approach to throttle × cap. The cap falling as we
    // near a body IS the Elite decel-on-approach.
    const target = this.throttle * this.speedCap();
    const k = 1 - Math.exp(-dt / this.tuning.ACCEL_TAU);
    this.speed += (target - this.speed) * k;
    if (this.speed < 1e-9) this.speed = 0;
    // The ONLY translation source: forward along the nose.
    this.position.addScaledVector(this.nose(), this.speed * dt);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS** (`npx vitest run src/flight/__tests__/SupercruiseModel.test.js`)

- [ ] **Step 5: Commit**

```bash
git add src/flight/SupercruiseModel.js src/flight/__tests__/SupercruiseModel.test.js
git commit --only src/flight/SupercruiseModel.js --only src/flight/__tests__/SupercruiseModel.test.js \
  -m "feat(supercruise): SupercruiseModel core — nose-vector flight, throttle, exponential accel (AC1)"
```

---

### Task 2: Gravity-well speed cap + turn-rate cap tests (AC1 remainder)

**Files:** Modify `src/flight/__tests__/SupercruiseModel.test.js` (implementation already exists from Task 1 — these tests pin the contract observables)

- [ ] **Step 1: Add the failing-or-passing characterization tests** (append to the same describe file)

```js
describe('SupercruiseModel — gravity-well cap + turn rate (AC1)', () => {
  it('speed cap is monotonically increasing with distance from the dominant body', () => {
    const m = new SupercruiseModel();
    const body = { position: new THREE.Vector3(0, 0, 0), radius: 5 };
    m.setBodies([body]);
    let prevCap = 0;
    for (const d of [10, 50, 200, 1000, 10000, 100000]) {
      m.position.set(d, 0, 0);
      const cap = m.speedCap();
      expect(cap).toBeGreaterThanOrEqual(prevCap);
      prevCap = cap;
    }
    expect(m.speedCap()).toBeLessThanOrEqual(SC_TUNING.CAP_MAX);
    m.position.set(body.radius + 0.1, 0, 0);
    expect(m.speedCap()).toBe(Math.max(SC_TUNING.CAP_MIN_ABS, body.radius * SC_TUNING.CAP_MIN_FRAC)); // floor at the surface (scale-free)
  });

  it('crawls near a planet, runs enormous in deep space (end-to-end)', () => {
    const m = new SupercruiseModel();
    m.setBodies([{ position: new THREE.Vector3(), radius: 5 }]);
    m.setThrottle(1);
    m.position.set(60, 0, 0);                    // near body
    for (let i = 0; i < 300; i++) m.update(DT);
    const nearSpeed = m.speed;
    m.position.set(120000, 0, 0); m.speed = 0;   // deep space
    for (let i = 0; i < 1200; i++) m.update(DT);
    expect(m.speed).toBeGreaterThan(nearSpeed * 100);
  });

  it('achieved turn rate never exceeds the cap, and the cap tightens with speed', () => {
    const m = new SupercruiseModel();
    m.setTurnInput(1, 0);
    m.speed = 0;
    const slowCap = m.turnRateCap();
    const q0 = m.orientation.clone();
    m.update(DT);
    expect(q0.angleTo(m.orientation)).toBeLessThanOrEqual(slowCap * DT + 1e-9);
    m.speed = m.speedCap();                      // full local speed
    expect(m.turnRateCap()).toBeLessThan(slowCap);
    expect(m.turnRateCap()).toBeCloseTo(SC_TUNING.TURN_RATE_MAX * SC_TUNING.TURN_RATE_MIN_FRAC, 6);
  });
});
```

- [ ] **Step 2: Run** (`npx vitest run src/flight/__tests__/SupercruiseModel.test.js`) — expect PASS (characterization of Task 1 code). If any fail, fix the model, not the test intent.

- [ ] **Step 3: Commit**

```bash
git commit --only src/flight/__tests__/SupercruiseModel.test.js \
  -m "test(supercruise): pin AC1 gravity-well cap + turn-rate observables"
```

---

### Task 3: HeadMount — hold-to-look + independence (AC2, AC4 logic)

**Files:** Create `src/flight/HeadMount.js`, `src/flight/__tests__/HeadMount.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/flight/__tests__/HeadMount.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { HeadMount } from '../HeadMount.js';

const DT = 1 / 60;

describe('HeadMount (AC2 ship/head split + AC4 hold-to-look)', () => {
  it('ship trajectory is bit-identical with and without freelook input', () => {
    const run = (useLook) => {
      const m = new SupercruiseModel();
      const h = new HeadMount();
      m.setThrottle(0.8); m.setTurnInput(0.3, -0.2);
      const trail = [];
      for (let i = 0; i < 300; i++) {
        if (useLook) { h.beginLook(); h.addLook(0.01, 0.005); }
        m.update(DT); h.update(DT);
        trail.push(m.position.x, m.position.y, m.position.z,
                   m.orientation.x, m.orientation.y, m.orientation.z, m.orientation.w);
      }
      return trail;
    };
    expect(run(true)).toEqual(run(false)); // bitwise — the mount NEVER touches the ship
  });

  it('applyTo composes ship transform + look; a cockpit probe tracks the ship exactly', () => {
    const m = new SupercruiseModel();
    m.position.set(10, 20, 30);
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
    const h = new HeadMount();
    h.beginLook(); h.addLook(0.4, 0.2);
    const cam = new THREE.PerspectiveCamera();
    h.applyTo(cam, m.position, m.orientation);
    // cockpit probe = dummy locked to the SHIP transform
    const cockpit = new THREE.Object3D();
    cockpit.position.copy(m.position); cockpit.quaternion.copy(m.orientation);
    expect(cockpit.position.equals(m.position)).toBe(true);
    // exact component-wise — angleTo(==) is 1 ULP shy of 0 in float64
    expect(cockpit.quaternion.equals(m.orientation)).toBe(true);
    // camera sits AT the ship but looks AWAY from ship-forward by the look amount
    expect(cam.position.equals(m.position)).toBe(true);
    expect(cam.quaternion.angleTo(m.orientation)).toBeGreaterThan(0.3);
  });

  it('recenters on release (eased), ends aligned', () => {
    const h = new HeadMount();
    h.beginLook(); h.addLook(0.8, 0.4); h.endLook();
    let prevMag = Math.hypot(h.yaw, h.pitch);
    for (let i = 0; i < 120; i++) {
      h.update(DT);
      const mag = Math.hypot(h.yaw, h.pitch);
      expect(mag).toBeLessThanOrEqual(prevMag + 1e-12);
      prevMag = mag;
    }
    expect(h.centered).toBe(true);
  });

  it('ignores look input while not held; holds offset while held', () => {
    const h = new HeadMount();
    h.addLook(0.5, 0.5);
    expect(h.yaw).toBe(0);
    h.beginLook(); h.addLook(0.5, 0.2);
    for (let i = 0; i < 60; i++) h.update(DT); // held → no decay
    expect(h.yaw).toBeCloseTo(0.5, 9);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (HeadMount missing)

- [ ] **Step 3: Implement**

```js
// src/flight/HeadMount.js
//
// Head/camera mount for supercruise (AC2/AC4). ROTATION-ONLY, computed math —
// deliberately NOT an Object3D parented under the camera/scene: WorldOrigin's
// rebase assumes an unparented camera (src/core/WorldOrigin.js:148-150).
// The future cockpit parents to the SHIP transform; this mount stays the
// player's head on top of it.
import * as THREE from 'three';

export const HEAD_TUNING = {
  MAX_YAW: Math.PI * 0.75,  // ±135°
  MAX_PITCH: Math.PI / 3,   // ±60°
  RECENTER_TAU: 0.25,       // s — eased recenter on release
  SNAP_EPS: 1e-3,           // rad (0.057°) — snap-to-zero; full recenter ≤ ~1.7s
};

export class HeadMount {
  constructor(tuning = {}) {
    this.tuning = { ...HEAD_TUNING, ...tuning };
    this.held = false;
    this.yaw = 0;
    this.pitch = 0;
    this._look = new THREE.Quaternion();
    this._euler = new THREE.Euler();
  }

  beginLook() { this.held = true; }
  endLook() { this.held = false; }

  /** Mouse-movement deltas, radians. Only while held (hold-to-look). */
  addLook(dyaw, dpitch) {
    if (!this.held) return;
    const t = this.tuning;
    this.yaw = THREE.MathUtils.clamp(this.yaw + dyaw, -t.MAX_YAW, t.MAX_YAW);
    this.pitch = THREE.MathUtils.clamp(this.pitch + dpitch, -t.MAX_PITCH, t.MAX_PITCH);
  }

  update(dt) {
    if (this.held) return;
    const f = Math.exp(-dt / this.tuning.RECENTER_TAU);
    this.yaw *= f; this.pitch *= f;
    if (Math.abs(this.yaw) < this.tuning.SNAP_EPS) this.yaw = 0;
    if (Math.abs(this.pitch) < this.tuning.SNAP_EPS) this.pitch = 0;
  }

  get centered() { return this.yaw === 0 && this.pitch === 0; }

  /** Write the camera pose: AT the ship position, ship orientation × look.
   *  Cockpit offset arrives with the cockpit arc, not here. */
  applyTo(camera, shipPos, shipQuat) {
    camera.position.copy(shipPos);
    this._look.setFromEuler(this._euler.set(this.pitch, this.yaw, 0, 'YXZ'));
    camera.quaternion.copy(shipQuat).multiply(this._look);
  }
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit --only src/flight/HeadMount.js --only src/flight/__tests__/HeadMount.test.js \
  -m "feat(supercruise): HeadMount — hold-to-look head/ship split, eased recenter (AC2/AC4)"
```

---

### Task 4: SupercruisePilot — the autopilot driver (AC5 logic, AC3 drop/overshoot logic)

**Files:** Create `src/flight/SupercruisePilot.js`, `src/flight/__tests__/SupercruisePilot.test.js`

The pilot issues `setThrottle`/`setTurnInput` — the SAME controls a player has (the AC5 invariant). Phases follow the FlightStates validated-transition idiom. The HOLD phase body-locks the model (today's STATION-A behavior, AutopilotMotion.js:583-642). Drop/overshoot rule: at the 10R crossing, capture iff `speed ≤ dropMaxSpeed(R)`; the cap curve makes the autopilot always-capture while a full-throttle manual run blows through.

- [ ] **Step 1: Write the failing tests**

```js
// src/flight/__tests__/SupercruisePilot.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase } from '../SupercruisePilot.js';

const DT = 1 / 60;
const mkBody = (x, y, z, r) => ({
  mesh: { position: new THREE.Vector3(x, y, z) }, radius: r,
});

function fly(pilot, model, maxSteps) {
  const frames = [];
  for (let i = 0; i < maxSteps; i++) {
    const f = pilot.update(DT);
    model.update(DT);
    frames.push({ ...f, speed: model.speed });
    if (f.motionComplete || f.overshoot) break;
  }
  return frames;
}

describe('SupercruisePilot', () => {
  it('flies a leg: aligns, cruises, drops in-window, holds for linger, completes', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 1.0 });
    const frames = fly(pilot, model, 60 * 120);
    const last = frames[frames.length - 1];
    expect(last.motionComplete).toBe(true);
    expect(last.overshoot).toBeFalsy();
    // held at the felt-fill hold distance, body-locked
    const holdDist = model.position.distanceTo(body.mesh.position);
    expect(holdDist).toBeLessThan(body.radius * 12);
    // phases were traversed in order
    const seq = [...new Set(frames.map(f => f.phase))];
    expect(seq).toEqual([PilotPhase.ALIGN, PilotPhase.CRUISE, PilotPhase.HOLD]);
  });

  it('pilot inputs respect the same caps a player has', () => {
    const model = new SupercruiseModel();
    const body = mkBody(3000, 1000, -4000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 0.5 });
    for (let i = 0; i < 600; i++) {
      pilot.update(DT);
      expect(Math.abs(model.turnInput.yaw)).toBeLessThanOrEqual(1);
      expect(Math.abs(model.turnInput.pitch)).toBeLessThanOrEqual(1);
      expect(model.throttle).toBeGreaterThanOrEqual(0);
      expect(model.throttle).toBeLessThanOrEqual(1);
      model.update(DT);
    }
  });

  it('emits decelStarted once per leg (the AC6 shake trigger)', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 0.5 });
    const frames = fly(pilot, model, 60 * 120);
    expect(frames.filter(f => f.decelStarted).length).toBe(1);
    expect(frames.filter(f => f.phaseChanged && f.phase === PilotPhase.CRUISE).length).toBe(1);
  });

  it('a too-hot crossing overshoots: no capture, flies past', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -200, 5);
    // No setBodies: simulate a manual run where the cap never reins speed in.
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 1 });
    model.speed = 800; model.orientation.identity(); // barreling at it, nose -Z
    pilot.update(DT); // let the pilot see phase state
    const frames = fly(pilot, model, 60 * 10);
    expect(frames.some(f => f.overshoot)).toBe(true);
    expect(frames.some(f => f.motionComplete)).toBe(false);
    // it passed the body
    expect(model.position.z).toBeLessThan(body.mesh.position.z);
  });

  it('stop() goes IDLE and stops issuing inputs', () => {
    const model = new SupercruiseModel();
    const body = mkBody(0, 0, -5000, 5);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 1 });
    pilot.update(DT);
    pilot.stop();
    expect(pilot.phase).toBe(PilotPhase.IDLE);
    model.setTurnInput(0.5, 0.5);
    pilot.update(DT);
    expect(model.turnInput.yaw).toBe(0.5); // untouched — pilot is hands-off
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```js
// src/flight/SupercruisePilot.js
//
// Autopilot driver for SupercruiseModel (AC5). Issues the SAME controls a
// player has — setThrottle / setTurnInput — plus a body-locked HOLD that
// reproduces today's STATION-A linger (AutopilotMotion.js:583-642).
// Frame idiom copied from AutopilotMotion: one-shots polled by main.js.
import * as THREE from 'three';

export const PilotPhase = Object.freeze({
  IDLE: 'IDLE', ALIGN: 'ALIGN', CRUISE: 'CRUISE', HOLD: 'HOLD',
});

export const PILOT_TUNING = {
  ALIGN_DOT: 0.995,          // nose alignment to open the throttle
  CRUISE_THROTTLE: 0.75,     // Elite blue-zone
  STEER_GAIN: 3.0,           // local-offset → turn-input proportional gain
  DROP_RADIUS_FACTOR: 10,    // capture sphere = 10R (today's APPROACH onset)
  DROP_ETA_MAX: 2.5,         // s — dropMaxSpeed = 10R / DROP_ETA_MAX
  DECEL_CUE_FACTOR: 15,      // decelStarted one-shot at 15R (AC6 shake cue)
  HOLD_VIEW_FRAC: 2.6,       // hold distance ≈ 2.6R (today's felt-fill)
  HOLD_SETTLE_TAU: 0.6,      // s — exponential ease from capture point to hold point (kills HOLD-entry snap)
};

export class SupercruisePilot {
  constructor(model, tuning = {}) {
    this.model = model;
    this.tuning = { ...PILOT_TUNING, ...tuning };
    this.phase = PilotPhase.IDLE;
    this._target = null;       // { mesh, radius, linger }
    this._holdOffset = new THREE.Vector3();
    this._holdPoint = new THREE.Vector3();
    this._holdTimer = 0;
    this._decelCued = false;
    this._prevPhase = PilotPhase.IDLE;
    this._toTarget = new THREE.Vector3();
    this._local = new THREE.Vector3();
    this._invQ = new THREE.Quaternion();
  }

  get isActive() { return this.phase !== PilotPhase.IDLE; }

  beginLeg({ toBody, bodyRadius, linger = 8 }) {
    this._target = { mesh: toBody, radius: bodyRadius, linger };
    this.phase = PilotPhase.ALIGN;
    this._holdTimer = 0;
    this._decelCued = false;
  }

  stop() {
    this.phase = PilotPhase.IDLE;
    this._target = null;
  }

  /** Step the driver. Returns the one-shot frame; caller then steps the model. */
  update(dt) {
    const frame = {
      phase: this.phase, prevPhase: this._prevPhase,
      phaseChanged: false, motionComplete: false,
      overshoot: false, decelStarted: false,
    };
    this._prevPhase = this.phase;
    if (this.phase === PilotPhase.IDLE || !this._target) return frame;

    const m = this.model, t = this.tuning, tgt = this._target;
    const bodyPos = tgt.mesh.position;
    this._toTarget.copy(bodyPos).sub(m.position);
    const dist = this._toTarget.length();
    const dropRadius = tgt.radius * t.DROP_RADIUS_FACTOR;
    const dropMaxSpeed = dropRadius / t.DROP_ETA_MAX;

    if (this.phase === PilotPhase.HOLD) {
      // Body-locked hold (today's STATION-A): ease toward the (moving) hold
      // point — exponential settle (~3τ ≈ 1.8 s) instead of a one-frame teleport.
      const k = 1 - Math.exp(-dt / t.HOLD_SETTLE_TAU);
      this._holdPoint.copy(bodyPos).add(this._holdOffset);
      m.position.lerp(this._holdPoint, k);
      m.speed = 0; m.setThrottle(0); m.setTurnInput(0, 0);
      this._lookAtBody(bodyPos);
      this._holdTimer += dt;
      if (this._holdTimer >= tgt.linger) frame.motionComplete = true;
      return this._stamp(frame);
    }

    // Steer toward the body: target direction in ship-local frame.
    this._local.copy(this._toTarget).normalize()
      .applyQuaternion(this._invQ.copy(m.orientation).invert());
    // local -Z is the nose; x>0 → target to the right, y>0 → above.
    const yawIn = THREE.MathUtils.clamp(-this._local.x * t.STEER_GAIN, -1, 1);
    const pitchIn = THREE.MathUtils.clamp(this._local.y * t.STEER_GAIN, -1, 1);
    m.setTurnInput(yawIn, pitchIn);
    const aligned = -this._local.z >= t.ALIGN_DOT;

    if (this.phase === PilotPhase.ALIGN) {
      m.setThrottle(0);
      if (aligned) { this.phase = PilotPhase.CRUISE; }
    } else if (this.phase === PilotPhase.CRUISE) {
      m.setThrottle(t.CRUISE_THROTTLE);
      if (!this._decelCued && dist <= tgt.radius * t.DECEL_CUE_FACTOR) {
        this._decelCued = true; frame.decelStarted = true;
      }
      if (dist <= dropRadius) {
        if (m.speed <= dropMaxSpeed) {
          // Capture: enter the body-locked hold at felt-fill distance.
          this._holdOffset.copy(m.position).sub(bodyPos)
            .normalize().multiplyScalar(Math.max(tgt.radius * t.HOLD_VIEW_FRAC, tgt.radius * 1.05)); // scale-free: ×1.05 inside-body guard, no absolute term
          this.phase = PilotPhase.HOLD;
          this._holdTimer = 0;
        } else {
          frame.overshoot = true; // too hot — fly past, stay in CRUISE
        }
      }
    }
    return this._stamp(frame);
  }

  _lookAtBody(bodyPos) {
    // During HOLD keep the nose on the body so the resumed leg departs cleanly.
    const m = this.model;
    this._toTarget.copy(bodyPos).sub(m.position).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1), this._toTarget);
    m.orientation.slerp(q, 0.1);
  }

  _stamp(frame) {
    // Report the ENTRY phase — the phase that drove this frame's behavior.
    // (Stamping the exit phase double-fires phaseChanged and hides one-frame
    // phases like an instant on-axis ALIGN.)
    frame.phaseChanged = frame.phase !== frame.prevPhase;
    return frame;
  }
}
```

- [ ] **Step 4: Run — expect PASS.** Sign conventions (yaw/pitch) are the likeliest failure; fix the implementation signs until the geometric tests pass — do not weaken the tests.

- [ ] **Step 5: Commit**

```bash
git commit --only src/flight/SupercruisePilot.js --only src/flight/__tests__/SupercruisePilot.test.js \
  -m "feat(supercruise): SupercruisePilot — ALIGN/CRUISE/HOLD driver, drop window, overshoot (AC5/AC3 logic)"
```

---

### Task 5: main.js integration — instantiate, simStep branch, rebase tracking

**Files:** Modify `src/main.js`

No new tests (wiring); verified live in Task 6. Keep ALL legacy mover branches working — this task adds the new branch dormant.

- [ ] **Step 1: Imports + instantiation.** Near the other auto/camera imports (main.js top), add:

```js
import { SupercruiseModel, SC_TUNING } from './flight/SupercruiseModel.js';
import { HeadMount } from './flight/HeadMount.js';
import { SupercruisePilot, PilotPhase } from './flight/SupercruisePilot.js';
```

Near `const autopilotMotion = new AutopilotMotion();` (anchor: that exact line, ~main.js:422), add:

```js
const scModel = new SupercruiseModel();
const scHead = new HeadMount();
const scPilot = new SupercruisePilot(scModel);
let _scManual = false;            // player has the stick (FLIGHT-mode supercruise)
const _scBodies = [];             // per-tick gravity-well body list (reused)
window._sc = { model: scModel, pilot: scPilot, head: scHead, tuning: SC_TUNING }; // UAT knobs + test probe
```

- [ ] **Step 2: Rebase tracking.** In `_trackControllerCaches` (anchor: `function _trackControllerCaches`, main.js:512-561), add to the tracked list, following the existing field-list pattern:

```js
// Supercruise ship entity — scene-local position must rebase with the world.
WorldOrigin.trackForRebase(scModel.position);
```

(Use the same mechanism the existing entries use — if entries are listed as `[controller, 'field']` pairs, add `[scModel, 'position']` in that style instead. Orientation/speed/throttle are frame-free: do NOT track.)

- [ ] **Step 3: Per-tick body list + the new mover branch.** In `simStep`, BEFORE the existing `autopilotMotion.isActive` branch (anchor: `if (autopilotMotion.isActive && !warpEffect.isActive`, main.js:7153), add the supercruise branch so it takes priority:

```js
// ── Supercruise mover (autopilot pilot OR manual stick) ──
const scActive = (scPilot.isActive || _scManual)
  && !warpEffect.isActive && !splashActive && !titleScreenActive;
if (scActive) {
  // Gravity-well cap inputs: CURRENT rebased mesh positions, refreshed per tick.
  _scBodies.length = 0;
  if (system) {
    for (const s of system.stars || [system.star]) {
      if (s?.mesh) _scBodies.push({ position: s.mesh.position, radius: s.data.radius });
    }
    for (const e of system.planets || []) {
      if (e?.planet?.mesh) _scBodies.push({ position: e.planet.mesh.position, radius: e.planet.data.radius });
      for (const mn of e?.moons || []) {
        if (mn?.mesh) _scBodies.push({ position: mn.mesh.position, radius: mn.data.radius });
      }
    }
  }
  scModel.setBodies(_scBodies);

  const scFrame = scPilot.isActive ? scPilot.update(deltaTime) : null;
  scModel.update(deltaTime);
  scHead.update(deltaTime);
  scHead.applyTo(camera, scModel.position, scModel.orientation);

  // AC6 felt beats: same impulses, new triggers (pattern: main.js:7179-7185).
  if (scFrame) {
    if (scFrame.phaseChanged && scFrame.phase === PilotPhase.CRUISE) {
      shipChoreographer.debugAccelImpulse();
    }
    if (scFrame.decelStarted) shipChoreographer.debugDecelImpulse();
  }
  // Shake quat composition — reuse the existing block's mechanism verbatim
  // (the camera-local euler compose at main.js:7253-7258).
  _composeShakeOntoCamera();   // extract the existing 6-line compose into this helper if not already shared

  if (scFrame) _handleScPilotFrame(scFrame);  // defined in Task 6
}
else if (autopilotMotion.isActive && ...) { /* existing branch unchanged */ }
```

NOTE for the executor: `system.stars`/`system.planets`/moons — verify the actual system-object field names against the body-rewrite block at main.js:6299-6403 (it iterates exactly these structures; copy ITS accessors). Extract the existing shake-compose lines into `_composeShakeOntoCamera()` and call it from both the old branch and the new one (no behavior change to the old branch).

- [ ] **Step 4: Stub the frame handler** (fleshed out in Task 6):

```js
function _handleScPilotFrame(frame) {
  // Tour advance / arrival wiring lands in the tour-cutover task.
}
```

- [ ] **Step 5: Manual-mode camera guard.** In the camera-controller fallback (anchor: the `autopilotMotion.isActive` skip at main.js:7470-7472), extend the skip so `cameraController.update()` doesn't fight the new mover:

```js
if (!autopilotMotion.isActive && !scPilot.isActive && !_scManual) {
  cameraController.update(deltaTime);
}
```

- [ ] **Step 6: Sanity build + commit.** Run `npx vitest run src/flight/` (all green), `node --check src/main.js` is not valid for ESM — instead run `npx vite build 2>&1 | tail -3` and expect a clean build.

```bash
git commit --only src/main.js \
  -m "feat(supercruise): main.js wiring — model/pilot/head instantiation, simStep mover branch (dormant), rebase tracking"
```

---

### Task 6: Tour-legs cutover (AC5a + AC6) — live verify

**Files:** Modify `src/main.js`

- [ ] **Step 1: Dispatch tour legs to the pilot.** In `_beginTourLegMotion` (anchor: `function _beginTourLegMotion`, main.js:5297-5309) replace the `autopilotMotion.beginMotion({...})` call with:

```js
scPilot.beginLeg({
  toBody: stop.bodyRef,
  bodyRadius: stop.bodyRadius,
  linger: stop.linger * settings.get('tourLingerMultiplier'),
});
```

Seed the model pose once at autopilot start so the first leg departs from the camera's pose (anchor: `startFlythrough`, main.js:5352 — where `autopilotMotion.beginMotion` is called today):

```js
scModel.position.copy(camera.position);
scModel.orientation.copy(camera.quaternion);
scModel.speed = 0; scModel.setThrottle(0);
```

- [ ] **Step 2: Tour advance.** Flesh out `_handleScPilotFrame` with the advance logic currently at main.js:7263-7276 (the `frame.motionComplete` handler):

```js
function _handleScPilotFrame(frame) {
  if (frame.motionComplete && autoNav.isActive) {
    const nextStop = autoNav.advanceToNext();
    if (nextStop && nextStop.bodyRef) {
      scPilot.beginLeg({
        toBody: nextStop.bodyRef,
        bodyRadius: nextStop.bodyRadius,
        linger: nextStop.linger * settings.get('tourLingerMultiplier'),
      });
      shipChoreographer.onLegAdvanced();
      updateFocusFromStop(nextStop);
    }
  }
}
```

- [ ] **Step 3: Stop/interrupt plumbing.** In `stopFlythrough` (anchor: `function stopFlythrough`, main.js:5372-5406) add `scPilot.stop(); _scManual = false;` alongside the existing `autopilotMotion.stop()`. In `window._lab.stopAutopilot` (main.js:1733-1738) add the same. Leave the legacy stops in place — they're harmless until retirement.

- [ ] **Step 4: Keep the legacy branch from double-driving.** The old `autopilotMotion.isActive` branch only runs when `scPilot` is idle (Task 5's `else if`), and `_beginTourLegMotion` no longer arms autopilotMotion — confirm by grep: `grep -n "autopilotMotion.beginMotion" src/main.js` should now show ONLY the orbitComplete handoff (main.js:7323) and startFlythrough remnants you haven't cut yet; change those two call sites to `scPilot.beginLeg(...)` with the same stop fields.

- [ ] **Step 5: Live integration verify (chrome-devtools, GPU :9223).** Per `memory/well-dipper-testing-reference.md`: `select_page` bringToFront (rAF-throttle check), `window._lab.enterSol()`, start the autopilot (Q), then sample via evaluate_script across 2+ legs:

```js
// poll ~every 500ms, short evals
({ phase: window._sc.pilot.phase, speed: +window._sc.model.speed.toFixed(2),
   throttle: window._sc.model.throttle,
   cam: window._cc ? undefined : undefined,
   pos: window._sc.model.position.toArray().map(v => +v.toFixed(1)) })
```

Expected: phase walks ALIGN→CRUISE→HOLD per leg; speed rises smoothly, falls into each arrival (cap curve decel); camera tracks `model.position` exactly; accel shake at CRUISE onset, decel shake near arrival (visually + `shipChoreographer` state if exposed); tour advances stop to stop. No console errors, no AC4/AC5 portal warnings.

- [ ] **Step 6: Commit**

```bash
git commit --only src/main.js \
  -m "feat(supercruise): tour legs fly supercruise — pilot dispatch, advance, shake beats (AC5a/AC6)"
```

---

### Task 7: Post-warp fly-in cutover (AC5b + AC8 invariant)

**Files:** Modify `src/main.js`

- [ ] **Step 1: Replace the seam.** In `warpRevealSystem`'s star-system branch (anchor: `navSubsystem.beginMotion({` inside the block at main.js:5550-5584 containing `launchOptions: { warpExit: true }`), replace the whole `navSubsystem.beginMotion({...})` call with:

```js
// Supercruise seam (contract supercruise-freelook-2026-06-10):
// arrive at billboard distance (unchanged, upstream), fly in on the new model.
scModel.position.copy(camera.position);
scModel.orientation.copy(camera.quaternion);
scModel.speed = 0; scModel.setThrottle(0);
scPilot.beginLeg({
  toBody: firstStop.bodyRef,
  bodyRadius: firstStop.bodyRadius,
  linger: firstStop.linger * settings.get('tourLingerMultiplier'),
});
```

Keep `shipChoreographer.beginTour({ fromWarp: true })`, `updateFocusFromStop(firstStop)`, and the systemMap blink unchanged. Keep `cameraController.bypassed = true` (set earlier in the function) unchanged.

- [ ] **Step 2: Warp-arrival re-arm semantics.** The legacy seam started the fly-in UNCONDITIONALLY (even with autopilot off) — preserve that: `scPilot.beginLeg` above is unconditional; `autoNav.start()` stays gated on `_autopilotEnabled` exactly as today.

- [ ] **Step 3: orbitComplete handoff is now dead at this seam.** The `result.orbitComplete` block (main.js:7314-7335) only fires from `flythrough.active` — after this cutover the warp leg never enters that branch. Leave the block in place (manual burns still use it until Task 9), but verify by live trace that post-warp motion never touches it.

- [ ] **Step 4: Live verify (GPU :9223).** Drive a seed-targeted warp (testing-reference §"Seed-targeted warps": replicate `_setWarpTargetFromNavStar` field writes on `window._warpTarget` → `window._beginWarpTurn()`). Assert after emergence:

- `system.star._billboard.visible === true` at emergence (AC8 billboard invariant — unchanged upstream, must still hold);
- `window._sc.pilot.phase` runs ALIGN→CRUISE→HOLD into the first stop; speed profile decelerates into arrival;
- no AC4/AC5 warnings; tour continues normally after the hold; a second warp repeats clean (re-arm path).
- Binary destination check (known binary seed `175217743`): both stars billboard at emergence, fly-in completes.

- [ ] **Step 5: Commit**

```bash
git commit --only src/main.js \
  -m "feat(supercruise): post-warp fly-in flies supercruise at the warpRevealSystem seam (AC5b)"
```

---

### Task 8: Manual controls — W/S throttle, mouse virtual joystick, takeover (AC3)

**Files:** Modify `src/main.js`

- [ ] **Step 1: Manual-mode entry/exit.** Repurpose the F-key FLIGHT toggle: in the F handler (anchor: main.js:8229-8241 `toggleCameraMode`), when toggling INTO FLIGHT set supercruise-manual instead of the legacy flight drive:

```js
// F → supercruise manual (replaces FlightDynamics-driven FLIGHT internals)
cameraController.toggleCameraMode();           // keeps wd_cameraMode persistence + mobile lock
if (cameraController.cameraMode === CameraMode.FLIGHT) {
  _scManual = true;
  scPilot.stop();
  scModel.position.copy(camera.position);
  scModel.orientation.copy(camera.quaternion);
  scModel.speed = 0; scModel.setThrottle(0);
  cameraController.bypassed = true;
} else {
  _scManual = false;
  cameraController.bypassed = false;
  cameraController.restoreFromWorldState(findClosestBody()?.position);
}
```

(Import `CameraMode` from ShipCameraSystem if not already in scope at that site. The legacy FLIGHT internals stop being reachable because `_scManual` short-circuits `cameraController.update()` per Task 5 Step 5.)

- [ ] **Step 2: W/S throttle.** In the held-keys consumption block (anchor: `flightOk` gate, main.js:7445-7465), add ahead of the legacy `setFlightInput` path:

```js
if (_scManual) {
  const dir = (_heldKeys.has('KeyW') ? 1 : 0) - (_heldKeys.has('KeyS') ? 1 : 0);
  if (dir !== 0) scModel.setThrottle(scModel.throttle + dir * SC_TUNING.THROTTLE_RATE * (stepMs / 1000));
} else if (flightOk) { /* existing legacy setFlightInput path unchanged until retirement */ }
```

(Match the actual dt variable name used in that block.)

- [ ] **Step 3: Mouse virtual joystick.** In the canvas `mousemove` handler (anchor: main.js:8582), add an early branch:

```js
if (_scManual && !scHead.held) {
  const r = canvas.getBoundingClientRect();
  const nx = ((e.clientX - r.left) - r.width / 2) / (r.width / 2);   // -1..1
  const ny = ((e.clientY - r.top) - r.height / 2) / (r.height / 2);
  const dead = 0.06;
  const shape = (v) => Math.abs(v) < dead ? 0 : Math.sign(v) * (Math.abs(v) - dead) / (1 - dead);
  scModel.setTurnInput(-shape(nx), -shape(ny));  // mouse right → yaw right; mouse up → pitch up
  _scDeflection = { x: shape(nx), y: shape(ny) }; // consumed by the HUD reticle
  // fall through — idle-reset etc. still run
}
```

Module-scope `let _scDeflection = { x: 0, y: 0 };` near the other input state. Sign convention: verify live; Max UAT-tunes feel, tests only assert proportionality + cap.

- [ ] **Step 4: Autopilot takeover.** In the autopilot-active keydown branch (anchor: main.js:8255-8260 where W/A/S/D calls `stopFlythrough()`), change W/S behavior when supercruise is flying:

```js
if (scPilot.isActive && (e.code === 'KeyW' || e.code === 'KeyS')) {
  // Seamless takeover: same model keeps flying — pilot hands off mid-state.
  scPilot.stop();
  _scManual = true;
  cameraController.cameraMode = CameraMode.FLIGHT; // intent follows action; persistence via setCameraMode if needed
  autoNav.stop();
  return;
}
```

Mouse-drag and wheel interrupts keep today's behavior (`stopFlythrough()` → Toy Box restore) — unchanged.

- [ ] **Step 5: Manual drop-out.** In the supercruise simStep branch (Task 5), after `scModel.update`, add manual capture:

```js
if (_scManual && _selectedTarget?.bodyRef) {
  const bp = _selectedTarget.bodyRef.position;
  const R = _selectedTarget.bodyRadius ?? 5;
  const d = scModel.position.distanceTo(bp);
  if (d <= R * 10 && scModel.speed <= (R * 10) / 2.5) {
    // In the drop window → capture into Toy Box orbit at the body (existing pattern)
    _scManual = false;
    cameraController.setCameraMode(CameraMode.TOY_BOX);
    cameraController.bypassed = false;
    cameraController.restoreFromWorldState(bp);
    shipChoreographer.debugDecelImpulse();
  }
}
```

(Adapt `_selectedTarget` field names to the real shape at main.js:5672 `selectTarget` — it stores kind/indices; resolve the mesh the same way `commitBurn`'s focus functions do. If too involved inline, add a `_resolveSelectedBody()` helper next to `selectTarget`.)

- [ ] **Step 6: Live verify AC3 (GPU :9223).** Enter Sol, press F → manual. Inject synthetic input via evaluate_script (dispatch `keydown`/`mousemove` events or write `window._sc.model.setThrottle/setTurnInput` directly for the model-level checks, then real DOM events for the binding checks). Verify: throttle responds to W/S; turn rate proportional to deflection and capped; fly at a planet in-window → Toy Box capture at the body; repeat too hot → flies past, no capture. Park tab at about:blank after.

- [ ] **Step 7: Commit**

```bash
git commit --only src/main.js \
  -m "feat(supercruise): manual piloting — W/S throttle, mouse virtual joystick, takeover, manual drop (AC3)"
```

---

### Task 9: COMMIT BURN cutover (AC5c)

**Files:** Modify `src/main.js`

- [ ] **Step 1: Rewire the focus functions.** In `focusStar` (main.js:5993), `focusPlanet` (:5931), `focusMoon` (:6044) — anchor each by its `navSubsystem.beginMotion({` call — replace the dispatch with:

```js
scModel.position.copy(camera.position);
scModel.orientation.copy(camera.quaternion);
scModel.speed = 0; scModel.setThrottle(0);
scPilot.beginLeg({
  toBody: <same mesh passed today>,        // e.g. moon.mesh
  bodyRadius: <same bodyRadius today>,
  linger: Infinity,                        // holdOnly semantics: orbit until input/idle
});
```

Keep every other line of each focus function intact (the 7-item reproduction list: `_selectedTarget` pre-set by callers, focus indices, `bypassed = true`, `bodyInfo.show*`, `_syncNavBody()`).

In `SupercruisePilot.update`, `linger: Infinity` already works (the hold timer never reaches it) — add a unit test in the pilot suite asserting HOLD persists ≥ 60s of steps with `linger: Infinity` and `motionComplete` never fires.

- [ ] **Step 2: `_manualBurnOrbiting` arming.** Today set at main.js:7310-7312 on `travelComplete && !autoNav.isActive`. New equivalent: in `_handleScPilotFrame`, on the HOLD transition:

```js
if (frame.phaseChanged && frame.phase === PilotPhase.HOLD && !autoNav.isActive) {
  _manualBurnOrbiting = true;
}
```

- [ ] **Step 3: BURN-button predicate.** In `_updateCommitBurnButton` (anchor main.js:5847), add `|| scPilot.isActive || _scManual` to the suppression predicate.

- [ ] **Step 4: focusShip QUARANTINE.** `focusShip` (main.js:5884) uses NavigationSubsystem's ship-lock orbit mode (camera in an NPC ship's local frame — serves the shipped Ship Scanner feature). Do NOT port it this arc: leave `focusShip` on `navSubsystem.beginMotion` as an explicitly quarantined legacy path. Add the comment:

```js
// QUARANTINED LEGACY PATH (supercruise-freelook-2026-06-10): ship-target burns
// keep NavigationSubsystem's ship-lock orbit until a dedicated port preserves
// Ship Scanner behavior. All other in-system motion is SupercruiseModel.
```

- [ ] **Step 5: Live verify (GPU :9223).** Open nav computer (N) → select a planet → COMMIT: pilot leg dispatches, reticle stays locked through the burn (`_selectedTarget` intact), arrival holds indefinitely, BodyInfo shows, BURN button suppressed during the leg, `_manualBurnOrbiting === true` after arrival, idle timeout later re-engages the tour. Also verify a ship burn still works (quarantined path).

- [ ] **Step 6: Commit**

```bash
git commit --only src/main.js \
  -m "feat(supercruise): COMMIT BURN flies supercruise (focusShip quarantined on ship-lock legacy) (AC5c)"
```

---

### Task 10: Freelook binding (AC4 live)

**Files:** Modify `src/main.js`

- [ ] **Step 1: Hold-to-look on middle mouse.** Canvas `mousedown` (anchor main.js:8663): when `(_scManual || scPilot.isActive)` and `e.button === 1`, `e.preventDefault(); scHead.beginLook();`. Window `mouseup` (anchor :8729/:8743): `if (e.button === 1) scHead.endLook();`. In the `mousemove` handler, BEFORE the joystick branch:

```js
if (scHead.held) {
  scHead.addLook(-e.movementX * 0.003, -e.movementY * 0.0025); // first-person convention
  return; // freelook consumes the motion; joystick deflection freezes while held
}
```

- [ ] **Step 2: Suppress conflicts.** While `scHead.held`, the legacy middle-mouse flythrough free-look (main.js:8602-8606) and ShipCameraSystem free-look must not also fire — guard both with `!scHead.held` (or rely on the supercruise mover being active: the legacy branches are unreachable when the new mover drives; verify by reading each site).

- [ ] **Step 3: Live verify AC4 (GPU :9223).** During an autopilot cruise leg: record ship heading + camera quaternion per frame via short evals; hold middle mouse + move; assert camera orientation diverges while `window._sc.model.orientation` series matches a no-freelook control leg (same seed/leg, compare headings); release → camera realigns to ship-forward within ~0.5s. Verify trajectory invariance: leg arrival time/position unchanged vs control.

- [ ] **Step 4: Commit**

```bash
git commit --only src/main.js \
  -m "feat(supercruise): hold-to-look freelook binding on middle mouse, eased recenter (AC4)"
```

---

### Task 11: HUD (AC7)

**Files:** Create `src/ui/SupercruiseHud.js`; modify `src/main.js`

- [ ] **Step 1: Implement the HUD canvas** (TargetingReticle pattern — own fixed canvas, DPR-scaled, pointer-events none, zIndex 51; pure view, state injected per frame; inspection probe for tests):

```js
// src/ui/SupercruiseHud.js
//
// Minimal supercruise HUD (AC7): speed readout, throttle bar, virtual-joystick
// reticle, target marker + drop window. Pure view — main.js passes state each
// render frame. Pattern: src/ui/TargetingReticle.js (own canvas, _project).
import * as THREE from 'three';

export class SupercruiseHud {
  constructor(camera) {
    this.camera = camera;
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 51,
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this._v = new THREE.Vector3();
    this._last = null;            // inspection probe
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = innerWidth * dpr; this.canvas.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _project(worldPos) {
    this._v.copy(worldPos).project(this.camera);
    if (this._v.z > 1) return null;
    return { x: (this._v.x * 0.5 + 0.5) * innerWidth, y: (-this._v.y * 0.5 + 0.5) * innerHeight };
  }

  /** state: { visible, speed, throttle, deflection:{x,y}, targetPos|null,
   *           dropState: 'none'|'in-window'|'too-fast' } */
  update(state) {
    const c = this.ctx; c.clearRect(0, 0, innerWidth, innerHeight);
    this._last = state;
    if (!state.visible) return;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    c.strokeStyle = c.fillStyle = '#9fe8ff'; c.font = '13px monospace'; c.lineWidth = 1;

    // Speed readout + throttle bar (bottom-left)
    c.fillText(`SPD ${state.speed.toFixed(0)} u/s`, 24, innerHeight - 48);
    c.strokeRect(24, innerHeight - 40, 120, 8);
    c.fillRect(24, innerHeight - 40, 120 * state.throttle, 8);

    // Virtual-joystick reticle: center cross + deflection dot
    c.beginPath(); c.moveTo(cx - 10, cy); c.lineTo(cx + 10, cy);
    c.moveTo(cx, cy - 10); c.lineTo(cx, cy + 10); c.stroke();
    const jr = Math.min(innerWidth, innerHeight) * 0.25;
    c.beginPath();
    c.arc(cx + state.deflection.x * jr, cy + state.deflection.y * jr, 4, 0, Math.PI * 2);
    c.fill();

    // Target marker + drop window
    if (state.targetPos) {
      const p = this._project(state.targetPos);
      if (p) {
        c.strokeStyle = state.dropState === 'too-fast' ? '#ff7b6b'
          : state.dropState === 'in-window' ? '#7bff9e' : '#9fe8ff';
        c.strokeRect(p.x - 14, p.y - 14, 28, 28);
        if (state.dropState !== 'none') {
          c.fillStyle = c.strokeStyle;
          c.fillText(state.dropState === 'in-window' ? 'DROP READY' : 'TOO FAST', p.x + 18, p.y);
        }
      }
    }
  }

  getLastFrameState() { return this._last; }  // SceneInspector-style probe
}
```

- [ ] **Step 2: Wire in main.js.** Instantiate after the reticle; expose `window._sc.hud = scHud`. In `renderFrame`, inside the existing HUD block AFTER `camera.updateMatrixWorld` and next to `targetingReticle.update` (anchor main.js:7785-7821), add:

```js
scHud.update({
  visible: _hudVisible && (_scManual || scPilot.isActive) && !warpEffect.isActive,
  speed: scModel.speed,
  throttle: scModel.throttle,
  deflection: _scDeflection,
  targetPos: _resolveSelectedBody()?.position ?? scPilot._target?.mesh.position ?? null,
  dropState: _scDropState(),   // helper: 'in-window' | 'too-fast' | 'none' from dist/speed vs the Task 8 rule
});
```

Implement `_scDropState()` next to the manual-drop check using the same `R*10` / `(R*10)/2.5` constants (single source: read them via `scPilot.tuning`).

- [ ] **Step 3: Live verify AC7 (GPU :9223).** With manual flight + a locked target: `window._sc.hud.getLastFrameState()` equals model state for speed/throttle/deflection across injected input changes; marker tracks the target's projected position; dropState flips in-window/too-fast per the model. H key hides it (honors `_hudVisible`).

- [ ] **Step 4: Commit**

```bash
git add src/ui/SupercruiseHud.js
git commit --only src/ui/SupercruiseHud.js --only src/main.js \
  -m "feat(supercruise): minimal HUD — speed, throttle, joystick reticle, target marker + drop window (AC7)"
```

---

### Task 12: Retire the old movers from the live path

**Files:** Modify `src/main.js`; tests under `tests/` and `src/auto/`

- [ ] **Step 1: Confirm zero live dispatches.** `grep -n "autopilotMotion.beginMotion\|navSubsystem.beginMotion" src/main.js` — expected remaining: ONLY `focusShip`'s quarantined call. Remove the now-dead `autopilotMotion.isActive` simStep branch (main.js:7153-7276) and the `flythrough.active` branch's tour/orbitComplete handling EXCEPT what the quarantined ship path needs (read the branch; keep the minimal `flythrough.update` + ship-lock handling, delete the tour-advance arm). Delete the legacy `setFlightInput` consumption (Task 8 Step 2's else-arm) and the FlightDynamics-driven FLIGHT internals' reachability (F now routes to supercruise).

- [ ] **Step 2: Keep files, mark retired.** Do NOT delete `AutopilotMotion.js` / `NavigationSubsystem.js` / `FlythroughCamera.js` this arc (quarantine + revert safety). Add a header line to AutopilotMotion.js: `// RETIRED FROM LIVE PATH 2026-06-10 (supercruise-freelook): no main.js dispatch remains. Delete after the cockpit arc ships.` NavigationSubsystem keeps its retire-pending header with the quarantine note updated to "focusShip only".

- [ ] **Step 3: Tests.** Run the full suite: `npx vitest run 2>&1 | tail -20`. Tests that encode the retired movers' MOTION behavior (e.g. AutopilotMotion phase tests) still pass (the modules still exist — unchanged). Tests that drive main.js wiring through the old movers: update to the new dispatch or mark with a `// retired-path` skip + comment. Expected green except the known pre-existing failures.

- [ ] **Step 4: Commit**

```bash
git commit --only src/main.js --only src/auto/AutopilotMotion.js --only src/auto/NavigationSubsystem.js \
  -m "refactor(supercruise): retire AutopilotMotion + NavigationSubsystem from live path (focusShip quarantined)"
```

(Include any updated test files in the `--only` list.)

---

### Task 13: Full verification + handoff to Max

- [ ] **Step 1: AC8 unattended loop (live, GPU :9223).** Fresh load → title → first warp → let it run 2+ complete system visits (tour + auto-warp) unattended. Poll with short evals (never a single >2.5min wait — MCP timeout). Assert per visit: billboard LOD at emergence; tour completes; auto-warp fires; no AC4/AC5 warnings; no new console errors. Verify Toy Box drag/zoom at a focused body; verify `isMobile` constraint headlessly (existing ShipCameraSystem tests cover the lock — run them).

- [ ] **Step 2: Run the verify-workstream workflow** (mode full):

```
Workflow({scriptPath:"/home/ax/projects/personal-os-improvements/dev-collab/workflows/verify-workstream.mjs",
  args:{contractPath:"/home/ax/projects/well-dipper/docs/WORKSTREAMS/supercruise-freelook-2026-06-10/contract.json",
        mode:"full", commit:"<HEAD sha>", liveBranch:"main"}})
```

Iterate on FAIL/INSUFFICIENT. AC9 must come back `deferred-to-max`, never PASS.

- [ ] **Step 3: Docs (project Rule 3 prep).** Update `docs/NOW.md` active-workstream entry with status `VERIFIED_PENDING_MAX <sha>`; note the focusShip quarantine + AutopilotMotion/NavigationSubsystem retirement state as an open structural item. FEATURES.md row update happens at Shipped, not now.

- [ ] **Step 4: Surface UAT to Max.** Exactly what to ride (AC9's verifyVia): manual flight to a planet + deliberate overshoot + freelook mid-flight; then watch a full autopilot tour + auto-warp. Recording per the Shipped-gate (canvas path) when Max is ready. List the `window._sc.tuning` knobs for feel adjustments — confirmed values get baked.

---

## Self-review (run after writing, fixed inline)

- **Spec coverage:** AC1→Tasks 1-2; AC2→Task 3; AC3→Tasks 4 (logic) + 8 (live); AC4→Tasks 3 (logic) + 10 (live); AC5→Tasks 4-7, 9; AC6→Tasks 4 (decelStarted) + 6 (impulses); AC7→Task 11; AC8→Tasks 7 (billboard) + 13 (loop); AC9→Task 13 Step 4 (deferred). Contract `mustStayWorking`: warp pipeline untouched (only the post-handoff seam edited); Toy Box/mobile via Task 13; nav computer UI untouched (only dispatch internals); rebase conventions via Task 5 Step 2; mute/reticle/landing-strip untouched.
- **Known deltas from contract text:** (1) "FlythroughCamera's motion role retires" is implemented as NavigationSubsystem retirement (exploration finding: FlythroughCamera has no motion math since 04-20); (2) `focusShip` stays on a quarantined legacy path to protect Ship Scanner ship-lock behavior — contract allows "explicitly quarantined"; flag at UAT.
- **Type consistency check:** `scPilot.beginLeg({toBody, bodyRadius, linger})` consistent across Tasks 4/6/7/9; `PilotPhase` import used in Tasks 5/9; `SC_TUNING.THROTTLE_RATE` consumed in Task 8; `_scDeflection` defined Task 8, consumed Task 11; drop constants single-sourced via `scPilot.tuning` (Task 11 Step 2).
