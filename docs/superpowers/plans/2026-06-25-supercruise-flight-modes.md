# Supercruise Flight Modes (F-cycle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2-state F flight toggle with a 4-state ring — `Manual → Align-on-select → Assist → Exit` — that cycles three flight-assist modes and shows a tooltip on each entry.

**Architecture:** Push all testable logic into two new pure modules (`flightModes.js` state machine + `aimAssist.js` orientation primitives) and a small DOM `FlightModeToast`; `main.js` stays thin wiring that calls those tested units. Mode A = today's manual flight; Mode B layers a one-shot nose-align on target selection (reusing the align-slerp primitive); Mode C points the existing autopilot `scPilot` at the selected body for a continuous hold, disengaging on any manual input.

**Tech Stack:** Vanilla JS + Three.js, Vite, Vitest (`npm test` → `vitest run`), co-located tests in `src/**/__tests__/*.test.js`.

**Spec:** `docs/superpowers/specs/2026-06-25-supercruise-flight-modes-design.md`.

## Global Constraints

- **NEVER re-tune the scale-bug floors** `CAP_MIN_FRAC`/`CAP_MIN_ABS`/`ETA_K`/`ACCEL_TAU` in `SupercruiseModel.js` (two prior live regressions `259f855`/`d5e4e2f`). The drop window (`10R` / `(10R)/2.5`) is reused verbatim from `scPilot.tuning` (`DROP_RADIUS_FACTOR`/`DROP_ETA_MAX`).
- `_scManual` stays the master "player is in flight" gate; `_flightMode` is the in-flight sub-state, only meaningful while `_scManual === true`. Mode C keeps `_scManual === true` AND `scPilot.isActive === true`.
- Reuse, don't reinvent: `_selectedTarget`/`_resolveSelectedBody()` for "the selected body"; `scPilot.beginLeg/update/stop` for Mode C; `cameraController.adoptCurrentPose()` + `cameraInterp.resync()` for the no-jump exit.
- THREE import idiom: `import * as THREE from 'three';`. Reticle green is `#64ff82`; HUD font is `'DotGothic16', monospace`.
- Commit after each task. Worktree `~/projects/well-dipper-supercruise`, branch `feature/supercruise-freelook`. Do NOT edit `NOW.md` mid-arc.

---

### Task 1: `flightModes.js` — pure state machine + tooltip content + manual-input predicate

**Files:**
- Create: `src/flight/flightModes.js`
- Test: `src/flight/__tests__/flightModes.test.js`

**Interfaces:**
- Produces: `FlightMode = { MANUAL:'manual', ALIGN:'align', ASSIST:'assist' }`;
  `advanceFlightMode(current, inFlight) → { mode, inFlight, exit }`;
  `flightModeInfo(modeOrExit) → { label, hint }` (accepts a FlightMode value or the string `'exit'`);
  `isManualInput(stick, throttleDir) → boolean` where `stick` is `{x,y}` (deadzone-shaped, 0 inside deadzone) and `throttleDir ∈ {-1,0,1}`.

- [ ] **Step 1: Write the failing test** — `src/flight/__tests__/flightModes.test.js`

```js
import { describe, it, expect } from 'vitest';
import { FlightMode, advanceFlightMode, flightModeInfo, isManualInput } from '../flightModes.js';

describe('advanceFlightMode — the 4-state ring', () => {
  it('enters at Manual from not-in-flight', () => {
    expect(advanceFlightMode(FlightMode.ASSIST, false)).toEqual({ mode: FlightMode.MANUAL, inFlight: true, exit: false });
    expect(advanceFlightMode(null, false)).toEqual({ mode: FlightMode.MANUAL, inFlight: true, exit: false });
  });
  it('cycles Manual → Align → Assist → Exit while in flight', () => {
    expect(advanceFlightMode(FlightMode.MANUAL, true)).toEqual({ mode: FlightMode.ALIGN, inFlight: true, exit: false });
    expect(advanceFlightMode(FlightMode.ALIGN, true)).toEqual({ mode: FlightMode.ASSIST, inFlight: true, exit: false });
    expect(advanceFlightMode(FlightMode.ASSIST, true)).toEqual({ mode: null, inFlight: false, exit: true });
  });
  it('a full cycle returns to entering at Manual', () => {
    let mode = null, inFlight = false;
    const seen = [];
    for (let i = 0; i < 4; i++) { const n = advanceFlightMode(mode, inFlight); seen.push(n.exit ? 'exit' : n.mode); mode = n.mode; inFlight = n.inFlight; }
    expect(seen).toEqual([FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST, 'exit']);
    expect(advanceFlightMode(mode, inFlight).mode).toBe(FlightMode.MANUAL); // next press re-enters
  });
});

describe('flightModeInfo', () => {
  it('gives a label + hint for each mode and for exit', () => {
    expect(flightModeInfo(FlightMode.MANUAL).label).toBe('Manual');
    expect(flightModeInfo(FlightMode.ALIGN).label).toBe('Align-on-select');
    expect(flightModeInfo(FlightMode.ASSIST).label).toBe('Assist');
    expect(flightModeInfo('exit').label).toBe('Exit flight');
    for (const m of [FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST, 'exit']) {
      expect(typeof flightModeInfo(m).hint).toBe('string');
    }
  });
});

describe('isManualInput', () => {
  it('is true on any throttle or any non-zero stick, false at rest', () => {
    expect(isManualInput({ x: 0, y: 0 }, 0)).toBe(false);
    expect(isManualInput(null, 0)).toBe(false);
    expect(isManualInput({ x: 0, y: 0 }, -1)).toBe(true);
    expect(isManualInput({ x: 0.0001, y: 0 }, 0)).toBe(true);
    expect(isManualInput({ x: 0, y: -0.2 }, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npm test -- flightModes` → Expected: FAIL ("Failed to resolve import '../flightModes.js'").

- [ ] **Step 3: Write minimal implementation** — `src/flight/flightModes.js`

```js
// Pure flight-assist mode state machine for the F-cycle.
// F rotates a 4-state ring: Manual → Align-on-select → Assist → Exit (leaves flight) → …
// `_flightMode` (in main.js) holds the in-flight sub-state; "off" is _scManual === false.
export const FlightMode = Object.freeze({
  MANUAL: 'manual',
  ALIGN: 'align',
  ASSIST: 'assist',
});

// One F press. Returns the NEXT state:
//  - not in flight  → enter at MANUAL.
//  - MANUAL→ALIGN, ALIGN→ASSIST (stay in flight).
//  - ASSIST→exit:true (leave flight; mode null).
export function advanceFlightMode(current, inFlight) {
  if (!inFlight) return { mode: FlightMode.MANUAL, inFlight: true, exit: false };
  switch (current) {
    case FlightMode.MANUAL: return { mode: FlightMode.ALIGN, inFlight: true, exit: false };
    case FlightMode.ALIGN:  return { mode: FlightMode.ASSIST, inFlight: true, exit: false };
    case FlightMode.ASSIST: return { mode: null, inFlight: false, exit: true };
    default:                return { mode: FlightMode.MANUAL, inFlight: true, exit: false };
  }
}

const INFO = {
  [FlightMode.MANUAL]: { label: 'Manual', hint: 'you fly' },
  [FlightMode.ALIGN]:  { label: 'Align-on-select', hint: 'nose centers on your target' },
  [FlightMode.ASSIST]: { label: 'Assist', hint: 'auto-flies to target — steer to take over' },
  exit:                { label: 'Exit flight', hint: 'back to autopilot' },
};
export function flightModeInfo(modeOrExit) {
  return INFO[modeOrExit] ?? INFO[FlightMode.MANUAL];
}

// True when the player is actively steering/throttling — cancels a Mode-B align
// and disengages a Mode-C hold. `stick` is the deadzone-shaped {x,y} (0 inside
// deadzone), `throttleDir` is -1|0|1 from W/S.
export function isManualInput(stick, throttleDir) {
  const sx = stick?.x ?? 0, sy = stick?.y ?? 0;
  return throttleDir !== 0 || (sx * sx + sy * sy) > 0;
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npm test -- flightModes` → Expected: PASS (all 3 describe blocks green).
- [ ] **Step 5: Commit** — `git add src/flight/flightModes.js src/flight/__tests__/flightModes.test.js && git commit -m "feat(flight-modes): pure F-cycle state machine + tooltip content"`

---

### Task 2: `aimAssist.js` — pure nose-orientation primitives (+ refactor `SupercruisePilot._lookAtBody`)

**Files:**
- Create: `src/flight/aimAssist.js`
- Test: `src/flight/__tests__/aimAssist.test.js`
- Modify: `src/flight/SupercruisePilot.js:126-132` (route `_lookAtBody` through `alignStep`, DRY)

**Interfaces:**
- Produces: `faceQuaternion(from, to, outQ) → outQ` (points local −Z at `to`); `alignStep(orientation, from, to, dt, tau=0.16) → orientation` (one exp-slerp step, mutates); `alignDot(orientation, from, to) → number` (−localZ · dirToTarget; 1 = dead-on).
- Consumes: THREE (`Vector3`, `Quaternion`). `from`/`to` are `THREE.Vector3`; `orientation`/`outQ` are `THREE.Quaternion`.

- [ ] **Step 1: Write the failing test** — `src/flight/__tests__/aimAssist.test.js`

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { faceQuaternion, alignStep, alignDot } from '../aimAssist.js';

const NEG_Z = new THREE.Vector3(0, 0, -1);

describe('faceQuaternion', () => {
  it('rotates the local nose (−Z) onto the direction to the target', () => {
    const q = new THREE.Quaternion();
    faceQuaternion(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), q); // target to +X
    const nose = NEG_Z.clone().applyQuaternion(q);
    expect(nose.x).toBeCloseTo(1, 6); expect(nose.y).toBeCloseTo(0, 6); expect(nose.z).toBeCloseTo(0, 6);
  });
});

describe('alignDot', () => {
  it('is 1 when already facing the target and < 1 when off-axis', () => {
    const facing = faceQuaternion(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), new THREE.Quaternion());
    expect(alignDot(facing, new THREE.Vector3(), new THREE.Vector3(1, 0, 0))).toBeCloseTo(1, 6);
    const identity = new THREE.Quaternion(); // nose points −Z, target +X → orthogonal
    expect(alignDot(identity, new THREE.Vector3(), new THREE.Vector3(1, 0, 0))).toBeCloseTo(0, 6);
  });
});

describe('alignStep', () => {
  it('eases an off-axis orientation toward the target (monotone, converges to ~1)', () => {
    const o = new THREE.Quaternion(); // start nose at −Z
    const from = new THREE.Vector3(), to = new THREE.Vector3(1, 0, 0);
    let prev = alignDot(o, from, to);
    for (let i = 0; i < 200; i++) { alignStep(o, from, to, 1 / 60, 0.16); const d = alignDot(o, from, to); expect(d).toBeGreaterThanOrEqual(prev - 1e-9); prev = d; }
    expect(prev).toBeGreaterThan(0.999);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npm test -- aimAssist` → Expected: FAIL ("Failed to resolve import '../aimAssist.js'").

- [ ] **Step 3: Write minimal implementation** — `src/flight/aimAssist.js`

```js
// Pure nose-orientation primitives shared by the autopilot pilot's HOLD look
// and Mode-B "align-on-select". No state — operates on caller-owned THREE objects.
import * as THREE from 'three';

const NEG_Z = new THREE.Vector3(0, 0, -1); // local nose
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _local = new THREE.Vector3();
const _inv = new THREE.Quaternion();

// Quaternion that points local −Z at `to` from `from`. Writes + returns outQ.
export function faceQuaternion(from, to, outQ) {
  _dir.copy(to).sub(from).normalize();
  return outQ.setFromUnitVectors(NEG_Z, _dir);
}

// One exponential-slerp step toward facing `to` from `from`. tau seconds
// (smaller = snappier). Mutates + returns `orientation`.
export function alignStep(orientation, from, to, dt, tau = 0.16) {
  faceQuaternion(from, to, _q);
  orientation.slerp(_q, 1 - Math.exp(-dt / tau));
  return orientation;
}

// Nose-to-target alignment: −localZ component of the unit direction to `to`.
// 1 = dead-on. Compare against PILOT_TUNING.ALIGN_DOT (0.995).
export function alignDot(orientation, from, to) {
  _dir.copy(to).sub(from).normalize();
  _local.copy(_dir).applyQuaternion(_inv.copy(orientation).invert());
  return -_local.z;
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npm test -- aimAssist` → Expected: PASS.

- [ ] **Step 5: Refactor `SupercruisePilot._lookAtBody` to use `alignStep` (DRY)** — In `src/flight/SupercruisePilot.js`: add `import { alignStep } from './aimAssist.js';` under the existing `import * as THREE from 'three';` (line 7), then replace the body of `_lookAtBody` (lines 126-132):

```js
  _lookAtBody(bodyPos, dt) {
    // During HOLD keep the nose on the body so the resumed leg departs cleanly.
    alignStep(this.model.orientation, this.model.position, bodyPos, dt, 0.16);
  }
```

- [ ] **Step 6: Run pilot + flight suites to verify no regression** — Run: `npm test -- SupercruisePilot aimAssist` → Expected: PASS (HOLD behavior unchanged — same math, now shared).

- [ ] **Step 7: Commit** — `git add src/flight/aimAssist.js src/flight/__tests__/aimAssist.test.js src/flight/SupercruisePilot.js && git commit -m "feat(flight-modes): pure aimAssist nose primitives; route pilot HOLD-look through them"`

---

### Task 3: `FlightModeToast` — the entry tooltip (DOM element + CSS), verified live

**Files:**
- Create: `src/ui/FlightModeToast.js`
- Modify: `index.html:195` (add the toast element after `#body-info`'s closing `</div>`)
- Modify: `src/style.css` (add toast rules after the `.body-info-cursor` block, ~line 648; and a `body.hud-hidden` hide rule)

**Interfaces:**
- Produces: `class FlightModeToast { constructor(); show(label, hint) }`. `show` restarts a ~1.6 s hold then fades. Reads `document.getElementById('flight-mode-toast')`.

- [ ] **Step 1: Add the DOM element** — `index.html`, immediately after the `#body-info` block (after line 196 `</div>`):

```html
    <div id="flight-mode-toast" style="display:none;">
      <div class="flight-mode-toast-label"></div>
      <div class="flight-mode-toast-hint"></div>
    </div>
```

- [ ] **Step 2: Add the CSS** — `src/style.css`, after the `.body-info-cursor { … }` rule. Mirrors BodyInfo's font + fade idiom; centered upper third; reticle green:

```css
/* ── Flight-mode toast (F-cycle entry tooltip) ── */
#flight-mode-toast {
  position: fixed;
  top: 22%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 95;
  font-family: 'DotGothic16', monospace;
  text-align: center;
  pointer-events: none;
  transition: opacity 0.4s ease;
  text-shadow: 0 0 8px #000, 0 0 16px #000, 0 0 24px #000;
}
#flight-mode-toast.fading { opacity: 0; }
.flight-mode-toast-label {
  color: #64ff82;
  font-size: 26px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.flight-mode-toast-hint {
  color: rgba(100, 255, 130, 0.7);
  font-size: 15px;
  font-weight: bold;
  margin-top: 4px;
  letter-spacing: 0.1em;
}
body.hud-hidden #flight-mode-toast { display: none !important; }
```

- [ ] **Step 3: Implement the component** — `src/ui/FlightModeToast.js`

```js
// FlightModeToast — brief centered banner naming the flight-assist mode on each
// F-cycle entry. Modeled on BodyInfo's fade-timer idiom, but its OWN element so
// it neither collides with the selection display (#body-info) nor depends on the
// supercruise HUD's flight-gated visibility — so "Exit flight" still shows as the
// HUD hides on exit.
export class FlightModeToast {
  constructor() {
    this._el = document.getElementById('flight-mode-toast');
    this._labelEl = this._el?.querySelector('.flight-mode-toast-label');
    this._hintEl = this._el?.querySelector('.flight-mode-toast-hint');
    this._fadeTimer = null;
    this._hideTimer = null;
    this._holdMs = 1600;
  }
  show(label, hint) {
    if (!this._el) return;
    clearTimeout(this._fadeTimer);
    clearTimeout(this._hideTimer);
    this._labelEl.textContent = label;
    this._hintEl.textContent = hint ?? '';
    this._el.style.display = 'block';
    this._el.classList.remove('fading');
    void this._el.offsetWidth; // reflow so a rapid re-show restarts the fade
    this._fadeTimer = setTimeout(() => this._fadeOut(), this._holdMs);
  }
  _fadeOut() {
    if (!this._el) return;
    this._el.classList.add('fading');
    this._hideTimer = setTimeout(() => { if (this._el) this._el.style.display = 'none'; }, 400);
  }
}
```

- [ ] **Step 4: Build check** — Run: `npm run build` → Expected: clean (no import/syntax errors). (DOM behavior is verified live in Task 8, matching the codebase's untested-UI convention — BodyInfo has no unit test.)
- [ ] **Step 5: Commit** — `git add src/ui/FlightModeToast.js index.html src/style.css && git commit -m "feat(flight-modes): FlightModeToast entry tooltip (DOM + CSS)"`

---

### Task 4: Wire the F handler into the 4-state ring + introduce `_flightMode`/`flightModeToast`

**Files:**
- Modify: `src/main.js` — imports (~line 44 area), state defs (~443), construct toast (~296), the F handler (`8759-8806`).

**Interfaces:**
- Consumes: `FlightMode`, `advanceFlightMode`, `flightModeInfo` (Task 1); `FlightModeToast` (Task 3); existing `setScManual`, `scPilot`, `scModel`, `cameraController`, `findClosestBody`, `cameraInterp`, `CameraMode`.
- Produces: module-scoped `let _flightMode`, `const flightModeToast`, and `function _enterFlightMode(mode)` (mode-specific entry; extended by Tasks 5/6). `_alignState` is declared here as `{ active:false, mesh:null, t:0 }` so Task 5 can fill it.

- [ ] **Step 1: Add imports** — near the other flight imports (the `stickCurve.js` import is at `src/main.js:44`), add:

```js
import { FlightMode, advanceFlightMode, flightModeInfo } from './flight/flightModes.js';
import { FlightModeToast } from './ui/FlightModeToast.js';
```
(`alignStep`/`alignDot` from `./flight/aimAssist.js` are added in Task 5.)

- [ ] **Step 2: Add state + toast construction** — after `const scPilot = new SupercruisePilot(scModel);` and the `setScManual` block (`src/main.js:442-450`), add:

```js
let _flightMode = FlightMode.MANUAL;          // in-flight sub-state (meaningful while _scManual)
const _alignState = { active: false, mesh: null, t: 0 }; // Mode-B one-time align (Task 5)
const ALIGN_TAU = 0.16;                        // s — Mode-B ease time constant
const ALIGN_MAX_S = 1.5;                        // s — Mode-B align safety cap
```
And next to `const bodyInfo = new BodyInfo();` (`src/main.js:296`), add:
```js
const flightModeToast = new FlightModeToast();
```

- [ ] **Step 3: Replace the F handler body** — replace `src/main.js:8774-8805` (from `const newMode = cameraController.toggleCameraMode();` through the `console.log(...); return;` that closes the FLIGHT/else block — keep the guards at 8759-8767 unchanged):

```js
    // F now cycles a 4-state ring: (off) → Manual → Align → Assist → Exit → (off).
    // _scManual is the "in flight" gate; advanceFlightMode owns the ring.
    const _next = advanceFlightMode(_flightMode, _scManual);
    if (!_scManual) {
      // ── ENTER flight at Manual (today's enter branch) ──
      cameraController.setCameraMode(CameraMode.FLIGHT);
      setScManual(true);
      scPilot.stop();
      scModel.position.copy(camera.position);
      scModel.orientation.copy(camera.quaternion);
      scModel.speed = 0;
      scModel.setThrottle(0);
      cameraController.bypassed = true;
      _flightMode = FlightMode.MANUAL;
      _enterFlightMode(_flightMode);
    } else if (_next.exit) {
      // ── EXIT flight → Toy Box, no teleport (today's exit branch) ──
      setScManual(false);
      scPilot.stop();
      _alignState.active = false;
      cameraController.setCameraMode(CameraMode.TOY_BOX);
      const _closest = findClosestBody();
      if (_closest) cameraController.adoptCurrentPose(_closest.position);
      else cameraController.bypassed = false;
      cameraInterp.resync(camera);
      _flightMode = FlightMode.MANUAL; // reset for the next entry
    } else {
      // ── CYCLE to the next assist mode, staying in flight ──
      _flightMode = _next.mode;
      _enterFlightMode(_flightMode);
    }
    const _info = flightModeInfo(_next.exit ? 'exit' : _flightMode);
    flightModeToast.show(_info.label, _info.hint);
    console.log(`[MODE] flight ${_scManual ? _flightMode : 'OFF'}`);
    return;
```

- [ ] **Step 4: Add the `_enterFlightMode` helper** — define near `selectTarget`/`_resolveSelectedBody` (e.g. after `_resolveSelectedBody` at `src/main.js:6021`). Tasks 5/6 fill the ALIGN/ASSIST branches; this stub is correct for Manual now:

```js
// Mode-specific entry actions when the F-cycle lands on a mode. Manual is the
// no-assist baseline; ALIGN/ASSIST act on the selected body (filled in Tasks 5/6).
function _enterFlightMode(mode) {
  _alignState.active = false;            // any prior align ends on a mode change
  if (mode !== FlightMode.ASSIST) scPilot.stop(); // only Assist drives the pilot
  const body = _resolveSelectedBody();
  if (!body) return;
  if (mode === FlightMode.ALIGN) _beginAlign(body);      // Task 5
  else if (mode === FlightMode.ASSIST) _engageAssist(body); // Task 6
}
```
Add temporary no-op stubs so the build passes before Tasks 5/6 (they get real bodies there):
```js
function _beginAlign(body) { _alignState.active = true; _alignState.mesh = body.mesh; _alignState.t = 0; }
function _engageAssist(body) { scPilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius }); }
```

- [ ] **Step 5: Verify build + existing suites green** — Run: `npm run build` then `npm test` → Expected: build clean; full suite known-failures-only (no NEW failures). Manual entry/exit unchanged behaviorally (still enters Manual, Exit reachable after 2 more F presses).
- [ ] **Step 6: Commit** — `git add src/main.js && git commit -m "feat(flight-modes): F cycles the 4-state ring + entry tooltip"`

---

### Task 5: Mode B — one-time align-on-select (sim driver + select hook + cancel-on-deflect)

**Files:**
- Modify: `src/main.js` — import aimAssist; sim-loop align driver (after `scModel.update` at `7557`, before `scHead.applyTo` at `7559`); `selectTarget` tail (`6006`); stick handler (`9198-9209`).

**Interfaces:**
- Consumes: `alignStep`, `alignDot` (Task 2); `_alignState`, `ALIGN_TAU`, `ALIGN_MAX_S`, `_beginAlign` (Task 4); `scPilot.tuning.ALIGN_DOT` (0.995).

- [ ] **Step 1: Add the import** — under the Task-4 imports add: `import { alignStep, alignDot } from './flight/aimAssist.js';`

- [ ] **Step 2: Add the sim-loop align driver** — in the `scActive` block, between `scModel.update(deltaTime);` (`src/main.js:7557`) and `scHead.update(deltaTime);` (`7558`), insert:

```js
      // Mode B: ease the nose ONCE to face the selected body, then release. A
      // still stick lets it finish; deflecting the stick cancels it (see the
      // mousemove handler). Writes orientation before scHead.applyTo reads it.
      if (_alignState.active && _alignState.mesh) {
        _alignState.t += deltaTime;
        alignStep(scModel.orientation, scModel.position, _alignState.mesh.position, deltaTime, ALIGN_TAU);
        const _d = alignDot(scModel.orientation, scModel.position, _alignState.mesh.position);
        if (_d >= scPilot.tuning.ALIGN_DOT || _alignState.t >= ALIGN_MAX_S) _alignState.active = false;
      }
```

- [ ] **Step 3: Hook target selection** — at the end of `selectTarget`, replace the final `_updateCommitBurnButton();` (`src/main.js:6006`) with:

```js
  // Flight-assist modes react to a (re)selection while flying.
  if (_scManual) {
    const _b = _resolveSelectedBody();
    if (_b) {
      if (_flightMode === FlightMode.ALIGN) _beginAlign(_b);
      else if (_flightMode === FlightMode.ASSIST) _engageAssist(_b); // Task 6
    }
  }
  _updateCommitBurnButton();
```

- [ ] **Step 4: Cancel align on stick deflection** — in the mousemove handler, replace the body of `if (_scManual && !scHead.held) { … }` (`src/main.js:9198-9209`) with (this also lays the Mode-C disengage groundwork completed in Task 6):

```js
  if (_scManual && !scHead.held) {
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) - r.width / 2) / (r.width / 2);   // -1..1
    const ny = ((e.clientY - r.top) - r.height / 2) / (r.height / 2);  // -1..1
    const s = shapeStick(nx, ny, _scStickTuning);
    const _deflected = (s.x !== 0 || s.y !== 0);
    if (_alignState.active && _deflected) _alignState.active = false; // Mode B: deflect cancels align
    // Mode C disengage is added in Task 6; in Manual/Align the stick is authoritative:
    scModel.setTurnInput(-s.x, -s.y);
    _scDeflection = { x: s.x, y: s.y };
  }
```

- [ ] **Step 5: Verify build + suites** — Run: `npm run build` then `npm test -- flightModes aimAssist SupercruisePilot` and `npm test` → Expected: build clean; targeted green; full suite known-failures-only.
- [ ] **Step 6: Commit** — `git add src/main.js && git commit -m "feat(flight-modes): Mode B align-on-select (one-shot, cancel-on-deflect)"`

---

### Task 6: Mode C — continuous assist (engage / disengage / drop-out)

**Files:**
- Modify: `src/main.js` — stick handler (assist-driving skip + disengage), throttle path (`7951-7961`), manual drop-out (`7581-7588`). (`_engageAssist` already defined in Task 4; `selectTarget`/`_enterFlightMode` already call it.)

**Interfaces:**
- Consumes: `scPilot.beginLeg/isActive/stop`; `_flightMode`, `FlightMode`; `_resolveSelectedBody`.
- Defines the convention: **assist is driving** ⇔ `_flightMode === FlightMode.ASSIST && scPilot.isActive`.

- [ ] **Step 1: Stick — skip + disengage while assist drives** — update the mousemove block from Task 5 so assist-driving steering is owned by the pilot and any deflection disengages (then the same input applies immediately):

```js
  if (_scManual && !scHead.held) {
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) - r.width / 2) / (r.width / 2);
    const ny = ((e.clientY - r.top) - r.height / 2) / (r.height / 2);
    const s = shapeStick(nx, ny, _scStickTuning);
    const _deflected = (s.x !== 0 || s.y !== 0);
    if (_flightMode === FlightMode.ASSIST && scPilot.isActive && _deflected) {
      scPilot.stop(); // Mode C: manual steer disengages the hold
    }
    if (!(_flightMode === FlightMode.ASSIST && scPilot.isActive)) {
      if (_alignState.active && _deflected) _alignState.active = false; // Mode B cancel
      scModel.setTurnInput(-s.x, -s.y);
      _scDeflection = { x: s.x, y: s.y };
    }
  }
```

- [ ] **Step 2: Throttle — skip + disengage while assist drives** — replace the `if (_scManual) { … }` throttle block (`src/main.js:7951-7961`) with:

```js
    if (_scManual) {
      const dir = (_heldKeys.has('KeyW') ? 1 : 0) - (_heldKeys.has('KeyS') ? 1 : 0);
      if (_flightMode === FlightMode.ASSIST && scPilot.isActive) {
        if (dir !== 0) scPilot.stop(); // Mode C: W/S disengages the hold (manual throttle resumes next frame)
      } else if (dir !== 0) {
        scModel.setThrottle(scModel.throttle + dir * SC_TUNING.THROTTLE_RATE * deltaTime);
      }
      cameraController.setFlightInput(0, 0, false);
    } else if (flightOk) {
```
(Leave the `else if (flightOk)` / `else` branches that follow at 7962-7970 unchanged.)

- [ ] **Step 3: Drop-out — stop the pilot on Mode C arrival** — in the manual drop-out capture block (`src/main.js:7581-7588`), add `scPilot.stop();` and clear any align right after `setScManual(false);`:

```js
          if (d <= captureSphere && scModel.speed <= dropMaxSpeed) {
            // In the drop window → capture into Toy Box orbit at the body.
            setScManual(false);
            scPilot.stop();          // Mode C: arrival ends the assist hold cleanly
            _alignState.active = false;
            cameraController.setCameraMode(CameraMode.TOY_BOX);
            cameraController.bypassed = false;
            cameraController.restoreFromWorldState(bp);
            shipChoreographer.debugDecelImpulse();
          }
```

- [ ] **Step 4: Verify build + suites** — Run: `npm run build` then `npm test` → Expected: build clean; full suite known-failures-only (no NEW failures). Note: `scPilot.update` already runs every frame it `isActive` (`7556`), so engaging via `beginLeg` needs no new sim wiring — the existing plumbing drives the hold + auto-drop.
- [ ] **Step 5: Commit** — `git add src/main.js && git commit -m "feat(flight-modes): Mode C continuous assist via scPilot (disengage on manual input, stop on drop)"`

---

### Task 7: HUD mode readout + flight-controls-lab harness extension

**Files:**
- Modify: `src/main.js:8341-8352` (pass `flightMode` to `scHud.update`); `src/ui/SupercruiseHud.js` (optional small "MODE: …" label).
- Modify: `flight-controls-lab.html` (add a "Cycle mode (F)" control + a mode/align/assist readout).

- [ ] **Step 1: Pass the mode to the HUD** — in the `scHud.update({ … })` call (`src/main.js:8341-8352`), add a field:

```js
    dropState: _scDrop.state,
    flightMode: _scManual ? _flightMode : null,
```

- [ ] **Step 2: Render it (optional, minimal)** — in `src/ui/SupercruiseHud.js` `update(state)`/draw, if `state.flightMode` is set, draw a small upper-center label `MODE: ${state.flightMode.toUpperCase()}` in reticle green near the existing SAFE-TO-DROP draw. Keep it one `fillText`; no new layout. If this risks clutter, skip — the toast already announces modes (Max's call at UAT).

- [ ] **Step 3: Extend the lab harness** — read `flight-controls-lab.html`; following its existing control pattern, add: (a) a "Cycle mode (F)" button that calls `advanceFlightMode` + updates a displayed mode label and (b) a readout of `_alignState.active` and `scPilot.isActive`, so Modes B/C are observable in isolation against the real `SupercruiseModel`. Reuse `window._lab` exposure if present.

- [ ] **Step 4: Verify build + suites** — Run: `npm run build` then `npm test` → Expected: clean / known-failures-only.
- [ ] **Step 5: Commit** — `git add src/main.js src/ui/SupercruiseHud.js flight-controls-lab.html && git commit -m "feat(flight-modes): HUD mode readout + lab harness mode-cycle controls"`

---

### Task 8: Full verification gate (headless) — handoff to live verify

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite** — Run: `npm test` → Expected: flightModes + aimAssist + SupercruisePilot + existing flight/UI/camera-interp green; full suite **known-failures-only** (the 17 pre-existing generation-data + vendored motion-test-kit files; **0 new** failures). If anything new fails, fix before proceeding.
- [ ] **Step 2: Build** — Run: `npm run build` → Expected: clean.
- [ ] **Step 3: Hand off to live verification** — the build workflow / a chrome-devtools subagent live-verifies on `:9223` → the `:5174` worktree tab (assert `location.href` contains `:5174`; hard-reload after the main.js edit; mute on load): cycle F through Manual→Align→Assist→Exit asserting each tooltip; Mode B nose-centers once then frees + cancels on stick; Mode C flies to the selected body, auto-drops, and disengages on stick/W/S; Exit leaves flight with **0.00 position delta**; 0 console errors. This live step is driven OUTSIDE this plan (working-Claude / subagent), per the verify split.

---

## Self-Review

**Spec coverage:** §1 cycle/state-machine → Tasks 1,4. §2 Manual → Task 4 (baseline, unchanged). §3 Mode B → Tasks 2,5. §4 Mode C → Tasks 4(`_engageAssist`),6. §5 tooltip → Task 3 + wired in Task 4. §6 reuse map → honored throughout (scPilot, _selectedTarget, _lookAtBody→aimAssist, adoptCurrentPose). §7 verification → Tasks 1-2 unit tests + Task 8 + harness in Task 7. §8 out-of-scope → no task touches the harness/autopilot-base, Tasks 12-13, or scale-bug floors. No gaps.

**Placeholder scan:** No TBD/TODO; every code step has complete code; main.js edits show the exact anchor + replacement. Task 2 Step 5 and Task 7 Step 3 reference existing code the implementer reads in place (line-anchored). OK.

**Type consistency:** `advanceFlightMode → {mode,inFlight,exit}` consumed in Task 4 exactly. `_alignState {active,mesh,t}` declared Task 4, used Tasks 4/5/6 consistently. `alignStep(orientation,from,to,dt,tau)`/`alignDot(orientation,from,to)` signatures match between Task 2 def, the pilot refactor, and the Task 5 sim driver. "assist driving" predicate `_flightMode===FlightMode.ASSIST && scPilot.isActive` identical in Tasks 6 Steps 1+2. `_beginAlign`/`_engageAssist` defined Task 4, called Tasks 4/5/6. Consistent.
