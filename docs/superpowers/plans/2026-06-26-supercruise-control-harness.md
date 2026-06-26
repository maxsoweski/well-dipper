# Supercruise Control Harness Implementation Plan (Tasks 12–13)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Name the single shared ship-control surface — `ShipControls` (`src/flight/ShipControls.js`) — that the player, the autopilot, the attract tour, and tests all act on the ship through; exercise it harness-first in `flight-controls-lab.html`; wire the live game through it (consolidating the 9 scattered `scPilot.beginLeg` sites); and retire the three motion classes (`AutopilotMotion`, `NavigationSubsystem`, `FlythroughCamera`) that no longer sit in the live path — by dead-ref removal + spawn-disable + "mark retired, keep files." **No new flight behavior**: pure surfacing + consolidation + retirement, folding in three latent correctness fixes (surface reverse throttle, fix the silently-ignored stick-tuning casing bug, keep the on-screen stick marker in sync under programmatic steer).

**Architecture:** A small **`ShipControls`** module (`src/flight/ShipControls.js`) owns `model` (`SupercruiseModel`) + `pilot` (`SupercruisePilot`) + `head` (`HeadMount`) and is the single door every driver walks through. The **portable core lives in the class** (command verbs, steer-shaping with the casing fix, the `flyTo`→arrival driver, `getState`, and the safe `pilot.update → model.update` order) and runs identically in the lab and the game. **Host-coupled bits stay in `main.js` as thin delegate methods** the surface calls through a `host` object (camera-mode toggle, `flightControlType` Settings read, reticle/focus pipeline, the `flightExitAnchor` no-snap exit, the `_scDeflection` HUD-stick write, the drop-state read) — absent host callback ⇒ that step is a no-op, the lab/headless case. Verbs are **frame-safe intent-setters** in-game (they set inputs the next sim tick consumes); `flyTo` for headless/lab **self-steps the model** (the existing `window._sc.flyFromRest` precedent). Chose the small class over a thinner all-in-`main.js` facade so the LAB drives the SAME object the game does (harness fidelity) — guarding against a lab that exercises a divergent code path and false-passes.

**Tech Stack:** Vanilla JS + Three.js, Vite, Vitest (`npm test` → `vitest run`; per-file `npx vitest run <path>`), co-located tests in `src/**/__tests__/*.test.js`. Worktree `~/projects/well-dipper-supercruise`, branch `feature/supercruise-freelook` (off `master`). Build check: `npx vite build`.

**Spec:** `docs/superpowers/specs/2026-06-26-supercruise-control-harness-design.md`.

## Global Constraints

- **No new flight feel or behavior.** Manual / Align / Assist behaviors, throttle/turn-rate floors, freelook, HUD all stay exactly as built — this arc only names the surface and retires dead systems.
- **No physical file deletion.** Retirement = dead-ref removal (`AutopilotMotion`) + spawn-disable + "mark retired, file kept" (`NavigationSubsystem`, `FlythroughCamera`). Do NOT propose deleting any file.
- **No Ship Scanner port.** Disabling spawn makes the ship path dormant; do not migrate it onto the supercruise surface.
- **NEVER re-tune the scale-bug floors** (`SC_TUNING` cap/hold floors in `SupercruiseModel.js` or `scPilot.tuning` DROP_*) — two prior live regressions `259f855` / `d5e4e2f`. Reuse the single-sourced drop-window math (`10R` / `(10R)/2.5`); do not re-derive.
- **No-snap exit pattern.** Any path handing the camera from flight back to Toy-Box anchors on the camera's forward ray (`flightExitAnchor` + `adoptCurrentPose` + `cameraInterp.resync`); NEVER on a body center.
- **Harness-first discipline.** Task 2 must be green in `flight-controls-lab.html` (real model, real-scale body) BEFORE Task 3 touches the live game.
- **Live-instance races.** The verbs act on live instances the 60 Hz loop also touches → frame-safe intent-setters in-game; `flyTo` self-steps the model only in headless/lab.
- **Update order.** `pilot.update` MUST precede `model.update` — encapsulated in the surface's stepping method so it cannot be mis-sequenced.
- **Parallel-session / file-scoped commits.** The branch is co-touched by a separate World Engine session on `src/main.js` + `docs/NOW.md` → every commit is file-scoped (`git add <explicit paths>` then `git commit -m "…" -- <explicit paths>`); NEVER `git add -A` / `git add .`. Do NOT edit `docs/NOW.md` mid-arc except at Task 4b's final docs step.
- **No `npm run dev` / no server / no backgrounded process.** Verification uses `npx vitest run <path>` and `npx vite build`; the in-browser live-verify is a separate chrome-devtools step run by the orchestrator (`:9223` → the `:5174` worktree tab), NOT a step in this plan.
- **THREE import idiom:** `import * as THREE from 'three';`. Reticle green is `#64ff82`; HUD font is `'DotGothic16', monospace`.
- **Editing `docs/FEATURES.md` / `docs/NOW.md` requires reading `~/.claude/docs/dev-collab-os.md` first** (per project CLAUDE.md) — those edits happen during Task 4b, not before.

---

### Task 1: Build `ShipControls` + the verb surface

Build `src/flight/ShipControls.js` — the single named control surface owning `model` + `pilot` + `head`, exposing the portable verb surface (`setThrottle`, `steer`, `selectTarget`/`deselect`, `engage`/`disengage`, `flyTo`, `stop`, `getState`, `get target`, `step`), encapsulating the `pilot.update → model.update` order. First extract the inline steer-toward-body math from `SupercruisePilot.js:93-101` into a named pure helper `steerToward` in `aimAssist.js`, then name the pilot's one-shot `PilotFrame` contract, then build the class against those. Fold in the three latent fixes — surface reverse throttle, fix the `stickCurve.js` DEADZONE/EXPO casing bug (via `steer()`), and keep `_scDeflection` in sync. Wire `window._sc.controls` in `main.js` (host delegates only; live-game routing of the 9 `beginLeg` sites is Task 3). Unit-test every pure piece against REAL code.

> **No behavior change in the live game in this task.** This task adds the surface and wires `window._sc.controls`; it does NOT yet route player input / attract tour / warp re-entry through it (that is Task 3). The pilot's `update` becomes behavior-identical after the `steerToward` extraction (same clamp math, same antiparallel escape).

**Files:**
- Create: `src/flight/ShipControls.js`
- Create test: `src/flight/__tests__/ShipControls.test.js`
- Modify: `src/flight/aimAssist.js` (add `steerToward` — sibling to `alignStep`/`faceQuaternion`/`alignDot`)
- Create test: `src/flight/__tests__/steerToward.test.js`
- Modify: `src/flight/SupercruisePilot.js` (add the `PilotFrame` typedef + `PILOT_FRAME_FIELDS` const; route `update`'s inline steer block through `steerToward`)
- Modify: `src/flight/__tests__/stickCurve.test.js` is NOT touched (the casing fix lives in `ShipControls.steer`, NOT in `stickCurve.js` — `shapeMagnitude` keeps its lowercase `{deadzone,expo}` opts; `steer` lowercases the uppercase tuning before calling it)
- Modify: `src/main.js` — `window._sc` object (`484-509`): construct `const scControls = new ShipControls({...})` after the pilot is created (~`452`), add `controls: scControls` to `window._sc`, and pass the host delegates. Import `ShipControls` near the flight imports (`44`).

**Interfaces:**
- **Consumes:**
  - `SupercruiseModel` — `setThrottle(t): void` (`SupercruiseModel.js:42`, clamps −1..1), `setTurnInput(yaw,pitch): void` (`:44`), `update(dt): void` (`:75`), fields `throttle` (`:30`), `speed` (`:29`), `speedCap(): number` (`:57`), `orientation: THREE.Quaternion` (`:28`), `position: THREE.Vector3` (`:27`).
  - `SupercruisePilot` — `beginLeg({ toBody, bodyRadius, linger=8 }): void` (`SupercruisePilot.js:46`), `stop(): void` (`:53`), `update(dt): PilotFrame` (`:60`), `isActive: boolean` getter (`:44`), `phase` (`:31`), `_target: { mesh, radius, linger } | null` (`:32,47`).
  - `HeadMount` instance (owned; not driven by `step` — `head.update`/`applyTo` stay host-owned, `main.js:7612-7613`).
  - `shapeStick(x, y, opts={}): {x,y}` (`stickCurve.js:17`); `shapeMagnitude` reads opts `{ deadzone, expo }` lowercase (`stickCurve.js:7`).
  - `steerToward(orientation, from, toBody, steerGain, out?): {yaw,pitch}` (NEW, `aimAssist.js`).
  - `PILOT_TUNING.STEER_GAIN = 3.0` (`SupercruisePilot.js:19`).
- **Produces (CONTRACT — exact signatures):**
  - `export class ShipControls`, `constructor({ model, pilot, head, host = {} })`.
  - `host` delegates (all optional): `host.selectTarget(target)`, `host.deselectTarget()`, `host.resolveSelectedBody() → {mesh,radius}|null`, `host.enterFlight(type)`, `host.exitFlight()`, `host.readFlightType() → 'manual'|'align'|'assist'`, `host.setDeflection({x,y})`, `host.dropState() → {state,d,captureSphere,dropMaxSpeed}`.
  - `setThrottle(t: number): void` — delegates `model.setThrottle(t)`; reverse real (`setThrottle(-0.5)` ⇒ `model.throttle === -0.5`).
  - `steer(x: number, y: number): void` — `shapeStick(x,y,{deadzone:tuning.DEADZONE,expo:tuning.EXPO})` (casing reconciled), then `model.setTurnInput(-shaped.x,-shaped.y)` AND `host.setDeflection?.({x:shaped.x,y:shaped.y})`.
  - `selectTarget(target: object|null): void` — delegates `host.selectTarget(target)`.
  - `deselect(): void` — delegates `host.deselectTarget()`.
  - `engage(type?: 'manual'|'align'|'assist'): void` — `host.enterFlight(type ?? host.readFlightType())`.
  - `disengage(): void` — `host.exitFlight()` + `pilot.stop()`.
  - `flyTo(target: {toBody, bodyRadius, linger?}): Arrival` — wraps `pilot.beginLeg(target)`; returns `Arrival` (`{done, promise, then(cb), poll(frame), cancel()}`).
  - `stop(mode?: 'idle'|'takeover'='idle'): void` — `'idle'` ⇒ `pilot.stop()` then `model.setThrottle(0)`; `'takeover'` ⇒ `pilot.stop()` only.
  - `getState(): ShipControlsState` — `{ speed, commandedSpeed, throttle, mode, phase, dropState }` (ordered).
  - `get target(): {mesh,radius,linger}|null` — returns `pilot._target`.
  - `step(dt: number): PilotFrame | null` — `pilot.isActive` ⇒ `pilot.update(dt)` FIRST then `model.update(dt)`, return frame; else `model.update(dt)`, return null.
  - `aimAssist.js`: `export function steerToward(orientation, from, toBody, steerGain, out)` → `{yaw,pitch}` (each `clamp(-1,1)`; antiparallel ⇒ `yaw=1`).
  - `SupercruisePilot.js`: `export const PILOT_FRAME_FIELDS = ['phase','prevPhase','phaseChanged','motionComplete','overshoot','decelStarted']` + `@typedef PilotFrame`.
  - `ShipControls.js`: `export { PILOT_FRAME_FIELDS } from './SupercruisePilot.js'` — a one-line re-export so the lab + `labVerbs.test.js` (Task 2) can import `ShipControls` AND `PILOT_FRAME_FIELDS` from the single surface module. Pure passthrough.
  - `window._sc.controls` in-game (alongside existing `window._sc.{model,pilot,head,hud,…}`, `main.js:484`).

- [ ] **Step 1: Write the failing test for `steerToward`** — `src/flight/__tests__/steerToward.test.js`. This pins the extracted helper's geometry to the SAME math the pilot runs inline today (`SupercruisePilot.js:93-101`): identity orientation, nose at −Z; target ahead ⇒ `{0,0}`; target to the right (+X) ⇒ `yaw < 0` (the `-localX·gain` sign); target dead astern (+Z) ⇒ `yaw === 1` (the antiparallel escape, `:100`); off-axis ⇒ clamped to ±1.

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { steerToward } from '../aimAssist.js';

const GAIN = 3.0; // PILOT_TUNING.STEER_GAIN
const ID = () => new THREE.Quaternion();      // nose at local −Z
const V = (x, y, z) => new THREE.Vector3(x, y, z);

describe('steerToward — extracted from SupercruisePilot.update (:93-101)', () => {
  it('target dead ahead (−Z) ⇒ no turn command', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(0, 0, -10), GAIN);
    expect(out.yaw).toBeCloseTo(0, 6);
    expect(out.pitch).toBeCloseTo(0, 6);
  });

  it('target to the right (+X) ⇒ yaw < 0 (the -localX·gain sign)', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(10, 0, 0), GAIN);
    expect(out.yaw).toBeLessThan(0);
    expect(out.yaw).toBe(-1);          // clamp(-1 · 3.0) → -1
  });

  it('target above (+Y) ⇒ pitch > 0 (the +localY·gain sign)', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(0, 10, 0), GAIN);
    expect(out.pitch).toBeGreaterThan(0);
    expect(out.pitch).toBe(1);
  });

  it('target dead astern (+Z, antiparallel) ⇒ yaw = 1 (escape, :100)', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(0, 0, 10), GAIN);
    expect(out.yaw).toBe(1);           // would be 0 without the antiparallel escape
  });

  it('off-axis ⇒ clamped magnitude (never beyond ±1)', () => {
    const out = steerToward(ID(), V(0, 0, 0), V(5, 5, -1), GAIN);
    expect(out.yaw).toBeGreaterThanOrEqual(-1);
    expect(out.yaw).toBeLessThanOrEqual(1);
    expect(out.pitch).toBeGreaterThanOrEqual(-1);
    expect(out.pitch).toBeLessThanOrEqual(1);
  });

  it('does not mutate caller orientation / from / toBody', () => {
    const o = ID(); const from = V(0, 0, 0); const to = V(10, 0, 0);
    steerToward(o, from, to, GAIN);
    expect(o.equals(new THREE.Quaternion())).toBe(true);
    expect(from.equals(V(0, 0, 0))).toBe(true);
    expect(to.equals(V(10, 0, 0))).toBe(true);
  });

  it('writes into a provided out object and returns it', () => {
    const out = { yaw: 0, pitch: 0 };
    const r = steerToward(ID(), V(0, 0, 0), V(10, 0, 0), GAIN, out);
    expect(r).toBe(out);
    expect(out.yaw).toBe(-1);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — Run: `npx vitest run src/flight/__tests__/steerToward.test.js`
  Expected: FAIL — `Error: No "steerToward" export is defined in '../aimAssist.js'` (the suite errors at import; 0 passed).

- [ ] **Step 3: Write minimal implementation — add `steerToward` to `aimAssist.js`** — append below `alignDot` (`aimAssist.js:31`). Reuses the existing module scratch (`_dir`, `_inv`) the same way `alignStep`/`alignDot` do; reproduces `SupercruisePilot.js:94-101` verbatim:

```js
// Steer-toward-body turn command in the ship-local frame — extracted verbatim
// from SupercruisePilot.update (:93-101). Direction (toBody − from) is rotated
// into local space by inverse(orientation); local −Z is the nose, x>0 ⇒ target
// to the right, y>0 ⇒ above. Pure: reads caller-owned THREE objects, mutates
// none of them; uses module scratch internally. Returns clamped −1..1 each;
// exact antiparallel (target dead astern) ⇒ yaw = 1 (the ALIGN-hang escape).
const _steerOut = { yaw: 0, pitch: 0 };
export function steerToward(orientation, from, toBody, steerGain, out = _steerOut) {
  _dir.copy(toBody).sub(from).normalize()
    .applyQuaternion(_inv.copy(orientation).invert());
  let yaw = THREE.MathUtils.clamp(-_dir.x * steerGain, -1, 1);
  const pitch = THREE.MathUtils.clamp(_dir.y * steerGain, -1, 1);
  // Exact antiparallel (target dead astern) → zero steering → permanent ALIGN hang.
  if (_dir.z > 0 && Math.hypot(_dir.x, _dir.y) < 1e-6) yaw = 1;
  out.yaw = yaw; out.pitch = pitch;
  return out;
}
```

- [ ] **Step 4: Run tests, verify pass** — Run: `npx vitest run src/flight/__tests__/steerToward.test.js`
  Expected: PASS — `Test Files 1 passed (1)`, `Tests 7 passed (7)`.

- [ ] **Step 5: Commit (file-scoped — NEVER `git add -A`)** —
  `git add src/flight/aimAssist.js src/flight/__tests__/steerToward.test.js`
  `git commit -m "feat(ship-controls): extract steerToward helper from SupercruisePilot (sibling to alignStep)" -- src/flight/aimAssist.js src/flight/__tests__/steerToward.test.js`

- [ ] **Step 6: Write the parity GUARD test — pilot routes its inline steer through `steerToward` (behavior-identical)** — append to the EXISTING `src/flight/__tests__/SupercruisePilot.test.js` (a new `describe` block). This is a **regression guard**, green by construction against the still-inline code (Step 3's helper is byte-identical), that pins the invariant the Step-8 extraction must preserve: after extraction the pilot must still produce the same turn input it did inline, so an existing leg flies unchanged. Add at the end of the file, inside no other block:

```js
import { steerToward } from '../aimAssist.js';

describe('SupercruisePilot — steerToward parity (extraction is behavior-identical)', () => {
  it('ALIGN-phase turn input equals steerToward(orientation, position, body, STEER_GAIN)', () => {
    const model = new SupercruiseModel();
    model.position.set(0, 0, 0);
    // Off-axis body so yaw AND pitch are non-trivial and clamped under gain 3.0.
    const body = mkBody(0.4, 0.25, -2, 0.05);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius });
    pilot.update(DT); // ALIGN frame sets model.turnInput via steerToward
    const expected = steerToward(model.orientation, model.position, body.mesh.position, PILOT_TUNING.STEER_GAIN);
    expect(model.turnInput.yaw).toBeCloseTo(expected.yaw, 12);
    expect(model.turnInput.pitch).toBeCloseTo(expected.pitch, 12);
  });
});
```

- [ ] **Step 7: Run the parity GUARD test, verify it PASSES against the still-inline pilot math** — Run: `npx vitest run src/flight/__tests__/SupercruisePilot.test.js`
  Expected: **PASS** — `Tests N passed`. This is deliberately a **regression guard, not a red-first test**: the new `import { steerToward }` resolves (the helper was added in Step 3) and, because Step 3's helper is byte-identical to the pilot's still-inline block (`SupercruisePilot.js:93-101`), the assertion already agrees with the inline math. It locks the invariant the Step-8 extraction must preserve. The red-first cycle for the refactor itself is the post-extraction suite run at Step 9 (the existing "flies a leg" test proves behavior-identical there). Do NOT expect a FAIL here.

- [ ] **Step 8: Route the pilot's inline steer block through `steerToward`** — in `src/flight/SupercruisePilot.js`, replace the inline block (`:93-101`):

```js
    // Steer toward the body: target direction in ship-local frame.
    this._local.copy(this._toTarget).normalize()
      .applyQuaternion(this._invQ.copy(m.orientation).invert());
    // local -Z is the nose; x>0 → target to the right, y>0 → above.
    let yawIn = THREE.MathUtils.clamp(-this._local.x * t.STEER_GAIN, -1, 1);
    const pitchIn = THREE.MathUtils.clamp(this._local.y * t.STEER_GAIN, -1, 1);
    // Exact antiparallel (target dead astern) → zero steering signal → permanent ALIGN hang.
    if (this._local.z > 0 && Math.hypot(this._local.x, this._local.y) < 1e-6) yawIn = 1;
    m.setTurnInput(yawIn, pitchIn);
    const aligned = -this._local.z >= t.ALIGN_DOT;
```

with the extracted call (note `aligned` still needs `-localZ`, so keep computing `_local` for the dot but take yaw/pitch from the helper):

```js
    // Steer toward the body via the shared aimAssist.steerToward helper
    // (extracted from this block; behavior-identical). _local is still computed
    // for the ALIGN_DOT check below (−localZ = nose-to-target alignment).
    this._local.copy(this._toTarget).normalize()
      .applyQuaternion(this._invQ.copy(m.orientation).invert());
    const { yaw: yawIn, pitch: pitchIn } = steerToward(m.orientation, m.position, bodyPos, t.STEER_GAIN, this._steerOut);
    m.setTurnInput(yawIn, pitchIn);
    const aligned = -this._local.z >= t.ALIGN_DOT;
```

Add the import at the top (the existing import is `import { alignStep } from './aimAssist.js';` at `:8`):

```js
import { alignStep, steerToward } from './aimAssist.js';
```

And add the reusable output scratch in the constructor (after `this._holdQ = new THREE.Quaternion();` at `:41`):

```js
    this._steerOut = { yaw: 0, pitch: 0 };
```

- [ ] **Step 9: Run pilot + steerToward tests, verify pass** — Run: `npx vitest run src/flight/__tests__/SupercruisePilot.test.js src/flight/__tests__/steerToward.test.js`
  Expected: PASS — both files green; the existing "flies a leg: aligns, cruises, drops…" test still passes (proves behavior-identical), and the Step-6 parity test passes against the now-extracted code.

- [ ] **Step 10: Commit (file-scoped)** —
  `git add src/flight/SupercruisePilot.js src/flight/__tests__/SupercruisePilot.test.js`
  `git commit -m "refactor(pilot): route SupercruisePilot.update steer through steerToward (no behavior change)" -- src/flight/SupercruisePilot.js src/flight/__tests__/SupercruisePilot.test.js`

- [ ] **Step 11: Write the failing test — name the `PilotFrame` contract** — `src/flight/__tests__/pilotFrame.test.js`. Pins the six exact fields, in order, against a real `pilot.update` frame:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PILOT_FRAME_FIELDS } from '../SupercruisePilot.js';

const DT = 1 / 60;
const mkBody = (x, y, z, r) => ({ mesh: { position: new THREE.Vector3(x, y, z) }, radius: r });

describe('PILOT_FRAME_FIELDS — the named one-shot Frame contract', () => {
  it('lists exactly the six fields, in order', () => {
    expect(PILOT_FRAME_FIELDS).toEqual(
      ['phase', 'prevPhase', 'phaseChanged', 'motionComplete', 'overshoot', 'decelStarted'],
    );
  });

  it('a real pilot.update() frame has exactly those keys', () => {
    const model = new SupercruiseModel();
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    const frame = pilot.update(DT);
    expect(Object.keys(frame).sort()).toEqual([...PILOT_FRAME_FIELDS].sort());
  });

  it('phaseChanged is stamped (phase !== prevPhase) on the ALIGN-entry frame', () => {
    const model = new SupercruiseModel();
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    const frame = pilot.update(DT); // IDLE→ALIGN, prevPhase was IDLE
    expect(frame.phaseChanged).toBe(true);
    expect(frame.phase).toBe('ALIGN');
    expect(frame.prevPhase).toBe('IDLE');
  });
});
```

- [ ] **Step 12: Run it, verify it fails** — Run: `npx vitest run src/flight/__tests__/pilotFrame.test.js`
  Expected: FAIL — `No "PILOT_FRAME_FIELDS" export is defined in '../SupercruisePilot.js'`.

- [ ] **Step 13: Add the `PilotFrame` typedef + `PILOT_FRAME_FIELDS` const to `SupercruisePilot.js`** — insert after `export const PilotPhase = …` (the block ends at `:14`) and before `export const PILOT_TUNING` (`:16`):

```js
/**
 * @typedef {Object} PilotFrame   one-shot returned by SupercruisePilot.update(dt)
 * @property {('IDLE'|'ALIGN'|'CRUISE'|'HOLD')} phase        ENTRY phase that drove THIS frame
 * @property {('IDLE'|'ALIGN'|'CRUISE'|'HOLD')} prevPhase    phase on the prior frame
 * @property {boolean} phaseChanged    phase !== prevPhase (stamped in _stamp())
 * @property {boolean} motionComplete  HOLD linger timer elapsed (level-triggered past linger)
 * @property {boolean} overshoot       entered capture sphere too hot — flew past, stayed CRUISE
 * @property {boolean} decelStarted    one-shot AC6 shake cue at 15R (DECEL_CUE_FACTOR)
 */
// Canonical field list/order of a PilotFrame — the named arrival/Frame contract.
export const PILOT_FRAME_FIELDS = Object.freeze([
  'phase', 'prevPhase', 'phaseChanged', 'motionComplete', 'overshoot', 'decelStarted',
]);
```

- [ ] **Step 14: Run it, verify pass** — Run: `npx vitest run src/flight/__tests__/pilotFrame.test.js`
  Expected: PASS — `Tests 3 passed (3)`.

- [ ] **Step 15: Commit (file-scoped)** —
  `git add src/flight/SupercruisePilot.js src/flight/__tests__/pilotFrame.test.js`
  `git commit -m "feat(pilot): name the one-shot PilotFrame contract (PILOT_FRAME_FIELDS + typedef)" -- src/flight/SupercruisePilot.js src/flight/__tests__/pilotFrame.test.js`

- [ ] **Step 16: Write the failing test for `ShipControls` — construction + the pure verbs** — `src/flight/__tests__/ShipControls.test.js`. Drives REAL `SupercruiseModel`/`SupercruisePilot`/`HeadMount` instances (no host ⇒ lab/headless path). Covers: ownership, `setThrottle` reverse, `steer` casing-fix + negated turn-input + deflection callback, `stop` idle vs takeover, `step` ordering, `getState` shape, `get target`.

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot } from '../SupercruisePilot.js';
import { HeadMount } from '../HeadMount.js';
import { ShipControls } from '../ShipControls.js';

const DT = 1 / 60;
const mkBody = (x, y, z, r) => ({ mesh: { position: new THREE.Vector3(x, y, z) }, radius: r });

function mk(host = {}) {
  const model = new SupercruiseModel();
  const pilot = new SupercruisePilot(model);
  const head = new HeadMount();
  const controls = new ShipControls({ model, pilot, head, host });
  return { model, pilot, head, controls };
}

describe('ShipControls — construction + ownership', () => {
  it('owns model, pilot, head', () => {
    const { model, pilot, head, controls } = mk();
    expect(controls.model).toBe(model);
    expect(controls.pilot).toBe(pilot);
    expect(controls.head).toBe(head);
  });
});

describe('setThrottle — reverse is real', () => {
  it('setThrottle(-0.5) ⇒ model.throttle === -0.5 (clamp at SupercruiseModel.js:42)', () => {
    const { model, controls } = mk();
    controls.setThrottle(-0.5);
    expect(model.throttle).toBe(-0.5);
  });
  it('setThrottle(1) and setThrottle(-1) clamp at the rails', () => {
    const { model, controls } = mk();
    controls.setThrottle(5); expect(model.throttle).toBe(1);
    controls.setThrottle(-5); expect(model.throttle).toBe(-1);
  });
});

describe('steer — casing fix + negated turn-input + deflection sync', () => {
  it('runs the shaped curve and applies the NEGATED turn-input convention', () => {
    const { model, controls } = mk();
    // Large stick well outside the 0.06 deadzone; expect non-zero shaped output,
    // stored as setTurnInput(-x,-y) (the live joystick convention, main.js:9277).
    controls.steer(0.8, 0.0);
    expect(model.turnInput.yaw).toBeLessThan(0);   // -shaped.x, shaped.x>0
    expect(model.turnInput.pitch).toBe(0);
  });

  it('fixes the casing bug: a non-default DEADZONE actually changes shaped output', () => {
    // A tiny stick deflection (0.05) is INSIDE the default 0.06 deadzone ⇒ 0.
    const { model, controls } = mk();
    controls.steer(0.05, 0);
    expect(model.turnInput.yaw).toBe(0);
    // Lowering DEADZONE to 0.0 should now let 0.05 through (proves tuning takes
    // effect — today it is silently ignored because shapeMagnitude reads
    // lowercase {deadzone,expo} but the tuning is uppercase {DEADZONE,EXPO}).
    controls.tuning.DEADZONE = 0.0;
    controls.steer(0.05, 0);
    expect(model.turnInput.yaw).toBeLessThan(0);   // 0.05 now passes the deadzone
  });

  it('calls host.setDeflection with the UN-negated shaped {x,y}', () => {
    const setDeflection = vi.fn();
    const { controls } = mk({ setDeflection });
    controls.steer(0.8, 0.0);
    expect(setDeflection).toHaveBeenCalledTimes(1);
    const arg = setDeflection.mock.calls[0][0];
    expect(arg.x).toBeGreaterThan(0);   // un-negated
    expect(arg.y).toBe(0);
  });

  it('no host ⇒ steer is a clean no-op on the (absent) deflection sink', () => {
    const { controls } = mk();   // no host.setDeflection
    expect(() => controls.steer(0.8, 0)).not.toThrow();
  });
});

describe('stop — idle vs takeover', () => {
  it('idle (default) zeroes throttle AND idles the pilot', () => {
    const { model, pilot, controls } = mk();
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    controls.setThrottle(0.7);
    controls.stop();          // default 'idle'
    expect(model.throttle).toBe(0);
    expect(pilot.phase).toBe('IDLE');
    expect(pilot._target).toBe(null);
  });
  it('takeover leaves throttle latched (Elite semantics, pilot.js:53-57)', () => {
    const { model, pilot, controls } = mk();
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    controls.setThrottle(0.7);
    controls.stop('takeover');
    expect(model.throttle).toBe(0.7);   // latched
    expect(pilot.phase).toBe('IDLE');
    expect(pilot._target).toBe(null);
  });
});

describe('step — encapsulated pilot.update → model.update order', () => {
  it('active pilot ⇒ pilot.update runs BEFORE model.update; returns the frame', () => {
    const { model, pilot, controls } = mk();
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    const order = [];
    const pu = pilot.update.bind(pilot);
    const mu = model.update.bind(model);
    vi.spyOn(pilot, 'update').mockImplementation((dt) => { order.push('pilot'); return pu(dt); });
    vi.spyOn(model, 'update').mockImplementation((dt) => { order.push('model'); return mu(dt); });
    const frame = controls.step(DT);
    expect(order).toEqual(['pilot', 'model']);
    expect(frame).not.toBeNull();
    expect(frame.phase).toBe('ALIGN');
  });
  it('inactive pilot ⇒ only model.update runs; returns null', () => {
    const { model, pilot, controls } = mk();
    expect(pilot.isActive).toBe(false);
    const muSpy = vi.spyOn(model, 'update');
    const frame = controls.step(DT);
    expect(muSpy).toHaveBeenCalledTimes(1);
    expect(frame).toBe(null);
  });
});

describe('getState — live telemetry read', () => {
  it('returns the ordered { speed, commandedSpeed, throttle, mode, phase, dropState }', () => {
    const { controls } = mk();
    controls.setThrottle(0.5);
    const s = controls.getState();
    expect(Object.keys(s)).toEqual(['speed', 'commandedSpeed', 'throttle', 'mode', 'phase', 'dropState']);
    expect(s.throttle).toBe(0.5);
    expect(s.phase).toBe('IDLE');             // pilot.phase
    expect(s.mode).toBe(null);                // no host ⇒ not in flight
    expect(s.dropState).toEqual({ state: 'none', d: null, captureSphere: null, dropMaxSpeed: null });
    expect(typeof s.speed).toBe('number');
    expect(s.commandedSpeed).toBeCloseTo(0.5 * controls.model.speedCap(), 9);
  });
});

describe('get target — named accessor over pilot._target', () => {
  it('null when idle; the leg target after beginLeg', () => {
    const { pilot, controls } = mk();
    expect(controls.target).toBe(null);
    const body = mkBody(0, 0, -2, 0.05);
    pilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius, linger: 8 });
    expect(controls.target).toBe(pilot._target);
    expect(controls.target.mesh).toBe(body.mesh);
    expect(controls.target.radius).toBe(0.05);
    expect(controls.target.linger).toBe(8);
  });
});
```

- [ ] **Step 17: Run it, verify it fails** — Run: `npx vitest run src/flight/__tests__/ShipControls.test.js`
  Expected: FAIL — `Failed to resolve import "../ShipControls.js"` (module does not exist; all describe blocks error).

- [ ] **Step 18: Write minimal implementation — `src/flight/ShipControls.js` (pure verbs + step + getState + target)** — create the file. `flyTo`/`engage`/`disengage`/`selectTarget`/`deselect` are stubbed here and completed in Steps 21/26 so each verb lands behind its own test. Tuning defaults come from `STICK_TUNING` (the casing fix lowercases them at the call site):

```js
// src/flight/ShipControls.js
//
// The single named ship-control surface (contract supercruise-control-harness
// -2026-06-26). Owns model + pilot + head; the player, the autopilot, the
// attract tour, and the lab/tests all act on the ship THROUGH this object.
//
// PORTABLE core (runs identically in lab + game): the command verbs, the
// steer-shaping (with the casing fix), the flyTo→arrival driver, getState, and
// the safe pilot→model step order. HOST-coupled steps (camera-mode toggle,
// Settings read, reticle/focus pipeline, no-snap exit, the _scDeflection write,
// the drop-state read) arrive as a `host` object of thin callbacks so this
// class never imports main.js. Absent host callback ⇒ that step is a no-op
// (the lab/headless case).
import { shapeStick, STICK_TUNING } from './stickCurve.js';
import { makeArrival } from './Arrival.js';

// Re-export the named PilotFrame contract from the single surface module so
// consumers (the lab, labVerbs.test.js, Task 2 Step 12) can import BOTH
// ShipControls and PILOT_FRAME_FIELDS from this one file. Pure passthrough,
// no behavior — PILOT_FRAME_FIELDS is DEFINED on SupercruisePilot.js (Step 13).
export { PILOT_FRAME_FIELDS } from './SupercruisePilot.js';

const INERT_DROP = Object.freeze({ state: 'none', d: null, captureSphere: null, dropMaxSpeed: null });

export class ShipControls {
  constructor({ model, pilot, head, host = {} }) {
    this.model = model;
    this.pilot = pilot;
    this.head = head;
    this.host = host;
    // Live stick deadzone+expo tuning (UPPERCASE keys, as STICK_TUNING ships).
    // steer() lowercases these into shapeStick's opts so they actually apply.
    this.tuning = { ...STICK_TUNING };
    this._arrival = null;       // the in-flight Arrival being polled (flyTo)
  }

  // ── Throttle (reverse is real — model clamps −1..1) ──
  setThrottle(t) { this.model.setThrottle(t); }

  // ── Shaped steer (casing fix + negated turn-input + deflection sync) ──
  steer(x, y) {
    // Casing reconcile: shapeMagnitude reads lowercase { deadzone, expo }
    // (stickCurve.js:7) but the tuning exposes uppercase { DEADZONE, EXPO }.
    // Pass the lowercased opts so runtime tuning is no longer silently ignored.
    const shaped = shapeStick(x, y, { deadzone: this.tuning.DEADZONE, expo: this.tuning.EXPO });
    // Live joystick convention: setTurnInput(-x,-y), store un-negated deflection.
    this.model.setTurnInput(-shaped.x, -shaped.y);
    this.host.setDeflection?.({ x: shaped.x, y: shaped.y });
  }

  // ── Selection (host pipeline) ──
  selectTarget(target) { this.host.selectTarget?.(target); }
  deselect() { this.host.deselectTarget?.(); }

  // ── Stop: idle (zero throttle) vs takeover (throttle latched) ──
  stop(mode = 'idle') {
    // pilot.stop() zeroes turn input + phase + target but does NOT touch
    // model.throttle (SupercruisePilot.js:53-56 — Elite "latched" semantics), so
    // 'takeover' leaves the player's commanded throttle latched at its value.
    this.pilot.stop();                       // zeroes turn input, phase→IDLE, target=null
    if (mode === 'idle') this.model.setThrottle(0); // 'takeover' leaves throttle latched
  }

  // ── Named accessor over the cross-boundary pilot._target read ──
  get target() { return this.pilot._target; }

  // ── Live telemetry ──
  getState() {
    const m = this.model;
    return {
      speed: m.speed,
      commandedSpeed: m.throttle * m.speedCap(),
      throttle: m.throttle,
      // mode = the host's live flight TYPE via the CONTRACTED host.readFlightType()
      // delegate (contract §0; 'manual'|'align'|'assist'). No host (lab/headless) ⇒
      // null. NOTE: readFlightType() is NOT gated on "in flight", so when a host IS
      // present mode reflects the configured flight TYPE even if the ship is not
      // currently engaged — see the contract-nuance flag in the Note below.
      mode: this.host.readFlightType?.() ?? null,
      phase: this.pilot.phase,
      dropState: this.host.dropState?.() ?? { ...INERT_DROP },
    };
  }

  // ── Safe stepping: pilot.update ALWAYS before model.update ──
  step(dt) {
    if (this.pilot.isActive) {
      const frame = this.pilot.update(dt);
      this.model.update(dt);
      if (this._arrival) this._arrival.poll(frame);
      return frame;
    }
    this.model.update(dt);
    return null;
  }

  // ── flyTo + engage/disengage land in later steps (stubbed for the build) ──
  flyTo() { throw new Error('flyTo not implemented'); }
  engage() { throw new Error('engage not implemented'); }
  disengage() { throw new Error('disengage not implemented'); }
}
```

> **Note on `getState().mode`:** the contract's `mode` is the host's live flight TYPE (`main.js:8390`). It is read here through the **already-contracted** `host.readFlightType()` delegate (contract §0) — NOT a separately-invented `host.flightMode()` (which appeared nowhere in the contract's host list and would have left `mode` permanently `null` everywhere no host wired it). With no host (lab/headless) `mode` is `null`, matching the contract. **CONTRACT-NUANCE FLAG (for Max):** contract §4 defines `mode` as the `_flightMode` value *while* `_scManual`, else `null` (i.e. null when NOT in flight). `readFlightType()` is not gated on engagement, so when a host IS present `mode` reflects the configured flight TYPE even when the ship is idle. If the strict "null while not engaged" semantics matter for a consumer, the host's `readFlightType` delegate should itself return `null` when not engaged (gate it host-side, where engagement state lives) rather than adding a new portable-class delegate — keeping the frozen contract's host vocabulary intact.

- [ ] **Step 19: Add the `Arrival` factory it imports — `src/flight/Arrival.js`** — the named arrival signal (contract §6), pure and host-free. `flyTo` (Step 21) uses it for both the self-stepping (lab/headless) and the poll (in-game) modes:

```js
// src/flight/Arrival.js
//
// The named arrival signal returned by ShipControls.flyTo (contract
// supercruise-control-harness-2026-06-26 §6). ONE shape, two consumption
// modes: a promise/callback for lab/headless, and a poll(frame) the live frame
// pump feeds each tick in-game. Resolves with the completing PilotFrame
// (the frame with motionComplete === true).
export function makeArrival() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  const arrival = {
    done: false,
    promise,
    then(onArrived) { promise.then(onArrived); return arrival; },
    // In-game: feed each live PilotFrame. Flips done + resolves on motionComplete.
    poll(frame) {
      if (arrival.done) return true;
      if (frame && frame.motionComplete) {
        arrival.done = true;
        resolve(frame);
        return true;
      }
      return false;
    },
    cancel() {
      if (arrival.done) return;
      arrival.done = true;
      reject(new Error('arrival cancelled'));
    },
  };
  // Swallow an unobserved cancel rejection so a cancelled in-game leg never
  // surfaces an unhandled-rejection warning when no one awaited the promise.
  promise.catch(() => {});
  return arrival;
}
```

> **NOTE on `then()` timing (do NOT make `then` fire synchronously):** in headless self-step mode (Step 23) the promise resolves SYNCHRONOUSLY inside the `flyTo()` call — the fixed-step loop completes and `arrival.poll` resolves before `flyTo` returns. The Step-21 `then(cb)` test registers `arrival.then(cb)` AFTER `flyTo` returns, i.e. after the promise is already resolved. `Promise.prototype.then` on an already-resolved promise still fires on the NEXT microtask, so the test's trailing `await arrival.promise` flushes the microtask and the callback runs. This relies on standard already-resolved-promise microtask semantics — if `then()` is ever "simplified" to invoke the callback synchronously, that test (and any post-resolution `.then`) breaks. Keep `then` delegating to `promise.then`.

- [ ] **Step 20: Run the ShipControls test, verify the pure verbs pass** — Run: `npx vitest run src/flight/__tests__/ShipControls.test.js`
  Expected: PASS — the construction/setThrottle/steer/stop/step/getState/target blocks green. `flyTo`/`engage`/`disengage` are stubbed (not yet exercised by this test file), so all current tests pass. `Tests 13 passed (13)` (count the it() blocks above).

- [ ] **Step 21: Write the failing test for `flyTo`→arrival (self-stepping headless)** — append a `describe('flyTo — arrival signal', …)` block to `src/flight/__tests__/ShipControls.test.js`. The lab/headless mode self-steps the model (the `flyFromRest` precedent) and resolves the promise with the `motionComplete` `PilotFrame`:

```js
describe('flyTo — arrival signal (lab/headless self-stepping)', () => {
  it('flies a real leg and resolves with the motionComplete PilotFrame', async () => {
    const { model, controls } = mk();
    // Body ahead at a capturable scale (matches SupercruisePilot.test fixtures).
    const body = mkBody(0, 0, -2, 0.05);
    // REQUIRED: register the body so model.speedCap() shrinks near it
    // (SupercruiseModel.js:57-64). With NO bodies, speedCap stays CAP_MAX (20000)
    // and the ship never decelerates → capture never fires → motionComplete never
    // sets → the leg runs to the maxSteps cap and REJECTS. Mirrors labVerbs.test.js.
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]);
    const arrival = controls.flyTo({ toBody: body.mesh, bodyRadius: 0.05, linger: 1 });
    expect(arrival.done).toBe(false);
    const frame = await arrival.promise;
    expect(arrival.done).toBe(true);
    expect(frame.motionComplete).toBe(true);
    expect(frame.phase).toBe('HOLD');
  });

  it('then(cb) is sugar over the promise (callback style)', async () => {
    const { model, controls } = mk();
    const body = mkBody(0, 0, -2, 0.05);
    model.setBodies([{ position: body.mesh.position, radius: body.radius }]); // see note above: required for capture
    let arrivedFrame = null;
    const arrival = controls.flyTo({ toBody: body.mesh, bodyRadius: 0.05, linger: 1 });
    arrival.then((f) => { arrivedFrame = f; });
    await arrival.promise;
    expect(arrivedFrame).not.toBeNull();
    expect(arrivedFrame.motionComplete).toBe(true);
  });

  it('a leg that never completes within the step cap rejects/resolves timed-out (no infinite loop)', async () => {
    const { controls } = mk();
    // Body absurdly far so the fixed-cap loop hits its ceiling before HOLD-complete.
    const body = mkBody(0, 0, -1e9, 1);
    const arrival = controls.flyTo({ toBody: body.mesh, bodyRadius: 1, linger: 1, maxSteps: 600 });
    // The cap-hit path calls arrival.cancel() (Step 23), which rejects with
    // `new Error('arrival cancelled')` (Step 19). Match that actual message — do
    // NOT assert /timed out|step cap/, which the cancel() error does not contain.
    await expect(arrival.promise).rejects.toThrow(/cancel/i);
  });
});
```

- [ ] **Step 22: Run it, verify it fails** — Run: `npx vitest run src/flight/__tests__/ShipControls.test.js`
  Expected: FAIL — the new `flyTo` block hits the `throw new Error('flyTo not implemented')` stub (errors / rejections mismatch).

- [ ] **Step 23: Implement `flyTo` (self-stepping headless + intent-setter in-game)** — in `src/flight/ShipControls.js`, replace the `flyTo()` stub with:

```js
  // ── flyTo: begin a pilot leg, return the named Arrival ──
  // LAB/HEADLESS: self-steps the model at fixed 60 Hz (the flyFromRest pattern,
  //   main.js:628-632) and resolves on motionComplete — pass { selfStep: true }
  //   (the default OUTSIDE a live 60 Hz loop). A maxSteps safety cap prevents
  //   an infinite loop on a leg that never completes.
  // IN-GAME: pass { selfStep: false } — flyTo only calls pilot.beginLeg and
  //   returns the Arrival; the live sim loop owns stepping and feeds frames to
  //   arrival.poll() via this.step().
  flyTo({ toBody, bodyRadius, linger = 8, selfStep = true, maxSteps = 100000, dt = 1 / 60 } = {}) {
    this.pilot.beginLeg({ toBody, bodyRadius, linger });
    const arrival = makeArrival();
    this._arrival = arrival;
    if (!selfStep) return arrival;            // in-game: the loop polls via step()
    // Headless: drive the model ourselves until the leg completes or we cap out.
    for (let i = 0; i < maxSteps; i++) {
      const frame = this.pilot.update(dt);
      this.model.update(dt);
      if (arrival.poll(frame)) return arrival;
    }
    arrival.cancel();                          // step cap hit → reject (timed out)
    this._arrival = null;
    return arrival;
  }
```

> **Why `selfStep` and the cap:** the contract calls for "self-steps in lab/headless; intent-setter in-game." `selfStep` defaults true so the lab/unit path Just Works; Task 3 passes `selfStep:false` so the live loop's `step()` drives the leg and `arrival.poll(frame)` (already wired in `step`, Step 18) flips `done`. `maxSteps` is the contract's "safety step-cap" (`Arrival` §6) — `cancel()` rejects with the cancel error, which the timed-out test asserts.

- [ ] **Step 24: Run it, verify pass** — Run: `npx vitest run src/flight/__tests__/ShipControls.test.js`
  Expected: PASS — the `flyTo` block + all earlier blocks green. `Tests 16 passed (16)`.

- [ ] **Step 25: Write the failing test for `engage`/`disengage` (host delegation)** — append `describe('engage / disengage — host delegation', …)` to `src/flight/__tests__/ShipControls.test.js`. These are thin delegates; the host stubs assert the contract calls:

```js
describe('engage / disengage — host delegation (no-snap exit preserved in host)', () => {
  it('engage(type) calls host.enterFlight with the explicit type', () => {
    const enterFlight = vi.fn();
    const { controls } = mk({ enterFlight });
    controls.engage('assist');
    expect(enterFlight).toHaveBeenCalledWith('assist');
  });

  it('engage() with no type reads host.readFlightType()', () => {
    const enterFlight = vi.fn();
    const readFlightType = vi.fn(() => 'align');
    const { controls } = mk({ enterFlight, readFlightType });
    controls.engage();
    expect(readFlightType).toHaveBeenCalledTimes(1);
    expect(enterFlight).toHaveBeenCalledWith('align');
  });

  it('disengage() calls host.exitFlight() (no-snap) AND stops the pilot', () => {
    const exitFlight = vi.fn();
    const { pilot, controls } = mk({ exitFlight });
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    controls.disengage();
    expect(exitFlight).toHaveBeenCalledTimes(1);
    expect(pilot.phase).toBe('IDLE');   // pilot.stop() ran
  });

  it('no host ⇒ engage/disengage are clean no-ops (lab path)', () => {
    const { controls } = mk();
    expect(() => controls.engage('manual')).not.toThrow();
    expect(() => controls.disengage()).not.toThrow();
  });
});
```

- [ ] **Step 26: Run it, verify it fails** — Run: `npx vitest run src/flight/__tests__/ShipControls.test.js`
  Expected: FAIL — `engage`/`disengage` still throw `not implemented`.

- [ ] **Step 27: Implement `engage`/`disengage`** — in `src/flight/ShipControls.js`, replace the `engage()`/`disengage()` stubs with:

```js
  // ── engage: the F-on toggle made callable (host owns camera/Settings/seed) ──
  engage(type) {
    const t = type ?? this.host.readFlightType?.() ?? 'manual';
    this.host.enterFlight?.(t);   // camera→FLIGHT, seed model from camera, _enterFlightMode(t)
  }

  // ── disengage: the F-off toggle — host runs the no-snap Toy-Box exit ──
  disengage() {
    this.host.exitFlight?.();     // flightExitAnchor + adoptCurrentPose + cameraInterp.resync
    this.pilot.stop();            // momentary; throttle latched (host clears its own align state)
  }
```

- [ ] **Step 28: Run the full ShipControls + Arrival suite, verify pass** — Run: `npx vitest run src/flight/__tests__/ShipControls.test.js`
  Expected: PASS — all blocks green: construction, setThrottle, steer, stop, step, getState, target, flyTo, engage/disengage. `Tests 20 passed (20)`.

- [ ] **Step 29: Commit (file-scoped)** —
  `git add src/flight/ShipControls.js src/flight/Arrival.js src/flight/__tests__/ShipControls.test.js`
  `git commit -m "feat(ship-controls): ShipControls verb surface + Arrival signal (portable core, unit-tested)" -- src/flight/ShipControls.js src/flight/Arrival.js src/flight/__tests__/ShipControls.test.js`

- [ ] **Step 30: Wire `window._sc.controls` in `main.js` (host delegates; NO live-game routing yet)** — three edits, ONE file (`src/main.js`):

  **(a) Import** — next to the existing flight import at `src/main.js:44` (`import { shapeStick, STICK_TUNING } from './flight/stickCurve.js';`), add:
  ```js
  import { ShipControls } from './flight/ShipControls.js';
  ```

  **(b) Construct** — after `const scPilot = new SupercruisePilot(scModel);` (`src/main.js:452`), add (the host methods named below already exist: `selectTarget` `:5974`, `deselectTarget` `:6097`, `_resolveSelectedBody` `:6048`; `enterFlight`/`exitFlight`/`readFlightType`/`setDeflection`/`dropState` are thin closures wired in Task 3 — for THIS task they are written as forward-safe closures that read live module state, NOT yet called from the input path; `getState().mode` reads `host.readFlightType()`, NOT a separate `flightMode` delegate):
  ```js
  // The named ship-control surface (contract supercruise-control-harness
  // -2026-06-26). Owns model+pilot+head; host delegates reach the camera /
  // Settings / reticle / no-snap-exit / HUD-stick that can't live in the
  // portable class. Live-game ROUTING of player input + the 9 beginLeg sites
  // through this surface is Task 3 — here we only build + expose it.
  const scControls = new ShipControls({
    model: scModel, pilot: scPilot, head: scHead,
    host: {
      selectTarget: (target) => selectTarget(target),
      deselectTarget: () => deselectTarget(),
      resolveSelectedBody: () => _resolveSelectedBody(),
      setDeflection: ({ x, y }) => { _scDeflection = { x, y }; },
      // The remaining delegates (enterFlight / exitFlight / readFlightType /
      // dropState) are wired in Task 3 alongside the F-handler and HUD
      // consolidation; left undefined here ⇒ those verbs no-op, which is
      // correct because nothing calls engage/disengage/getState.mode yet.
      // (getState().mode reads host.readFlightType() — the contracted delegate
      // in §0 — NOT a separate flightMode(); see the Step-18 getState Note.)
    },
  });
  ```

  **(c) Expose** — in the `window._sc = { … }` object literal (`src/main.js:484-509`), add `controls: scControls,` to the first line so it reads:
  ```js
  window._sc = {
    model: scModel, pilot: scPilot, head: scHead, hud: scHud, controls: scControls,
  ```
  (Leave every other field — `tuning`, `pilotTuning`, `headTuning`, `stickTuning`, `flyFromRest` — untouched.)

- [ ] **Step 31: Build sanity — the live game compiles with the surface wired** — Run: `npx vite build`
  Expected: `✓ built in <time>` with no errors (no import/syntax error; `ShipControls`/`Arrival` resolve; `window._sc.controls` is now defined). No behavior change — the surface is exposed but not yet on the input path.

- [ ] **Step 32: Full flight suite sanity — nothing regressed** — Run: `npx vitest run src/flight`
  Expected: PASS — all prior flight tests green PLUS the four new files (`steerToward`, `pilotFrame`, `ShipControls`, and the SupercruisePilot parity block). `Test Files` count up by 3 (steerToward, pilotFrame, ShipControls), all passing; `Tests` ≥ 72 + the new cases, 0 failures.

- [ ] **Step 33: Commit (file-scoped — `main.js` is co-touched by the World Engine session; NEVER `git add -A`)** —
  `git add src/main.js`
  `git commit -m "feat(ship-controls): expose window._sc.controls + host delegates (no live-game routing yet)" -- src/main.js`

---

### Task 2: Harness-first — exercise the player-facing motion verbs in `flight-controls-lab.html`

> **Gate:** Task 1 (`ShipControls` + the verb surface) MUST be complete and committed,
> and **this Task 2 MUST be green (all unit suites + the lab build) BEFORE Task 3 touches
> the live game.** Harness-first discipline: a lab that exercises a divergent code path
> false-passes (the retired-4-state-ring risk). The lab here drives the SAME
> `ShipControls` instance the game will, against the real `SupercruiseModel` + a real-scale
> body — no ad-hoc reimplementation of the wiring.

**Files:**
- Modify: `flight-controls-lab.html`
  - imports block (`130-136`): drop the retired-ring imports, import `ShipControls` + the named Frame contract.
  - `_selectedBody()` single-body hard-wire (`225`): replace with a ≥2-body selectable set + a `null` no-target case.
  - the `_flightMode`/`_alignState`/`cycleFlightMode` F-cycle wiring (`217-244`): replace with a `ShipControls` instance + the real 2-state `engage`/`disengage`.
  - the keydown `F` binding (`294`) and the `#btnCycleMode` button (`112-114`, `772`): rebind from `cycleFlightMode` → `engage`/`disengage`.
  - the sim `step(dt)` body (`395-416`): route stepping through `controls.step(dt)` (encapsulated pilot→model order) instead of poking `scPilot`/`model` directly.
  - the `window._lab` API (`743-768`): add `controls`, the verb passthroughs, a `selectedBodies` set, and an `arrived` flag for `flyTo`.
- Create: `src/flight/__tests__/labVerbs.test.js` — unit tests for the pure pieces Task 1 produced (extracted steer-toward helper, shaped-stick casing fix, named Frame contract, the headless `flyTo` arrival driver), exercised exactly as the lab drives them.

**Interfaces:**
- **Consumes** (Task 1 / CONTRACT — exact signatures):
  - `class ShipControls` — `new ShipControls({ model, pilot, head, host = {} })` (host OPTIONAL; absent ⇒ host-side steps are no-ops, the lab case).
  - `setThrottle(t: number): void` — delegates `model.setThrottle(t)` (clamps −1..1; reverse real).
  - `steer(x: number, y: number): void` — shaped-stick curve with the casing reconciled (`{ deadzone: tuning.DEADZONE, expo: tuning.EXPO }`), then `model.setTurnInput(-shaped.x, -shaped.y)`, then `host.setDeflection?.({ x: shaped.x, y: shaped.y })`. `x,y` are RAW (pre-shaping) stick coords.
  - `selectTarget(target: object | null): void` — delegates `host.selectTarget(target)`; `selectTarget(null)` is a clean no-op-ish clear.
  - `deselect(): void` — delegates `host.deselectTarget()`; clean no-op when nothing selected.
  - `engage(type?: 'manual'|'align'|'assist'): void` — calls `host.enterFlight(type)` (omitted ⇒ `host.readFlightType()`).
  - `disengage(): void` — calls `host.exitFlight()` (no-snap); also `pilot.stop()`.
  - `flyTo(target: { toBody: THREE.Object3D, bodyRadius: number, linger?: number }): Arrival` — wraps `pilot.beginLeg`; in lab/headless self-steps and resolves on `motionComplete`.
  - `stop(mode?: 'idle'|'takeover'): void`; `getState(): ShipControlsState`; `get target`; `step(dt: number): PilotFrame | null` (pilot.update FIRST when `pilot.isActive`, then `model.update`; else `model.update` only).
  - `Arrival` — `{ done: boolean, promise: Promise<PilotFrame>, then(cb): Arrival, poll(frame): boolean, cancel(): void }`; resolves with the `motionComplete === true` `PilotFrame`.
  - `steerToward(orientation, from, toBody, steerGain, out?) → { yaw, pitch }` (`src/flight/aimAssist.js`) — clamped −1..1 each; antiparallel (dead astern) ⇒ `yaw = 1`.
  - `PilotFrame` typedef / `PILOT_FRAME_FIELDS` const — fields exactly `['phase','prevPhase','phaseChanged','motionComplete','overshoot','decelStarted']`.
  - existing: `SupercruiseModel`, `SupercruisePilot`, `HeadMount`, `PILOT_TUNING` (`STEER_GAIN = 3.0`, `ALIGN_DOT = 0.995`), `shapeStick`/`shapeMagnitude`/`STICK_TUNING`, `earthRadiiToScene`.
- **Produces:** the lab driving `ShipControls`; `window._lab.controls` + verb passthroughs + `selectedBodies` + `arrived`; `src/flight/__tests__/labVerbs.test.js`.

> **Commit discipline (parallel-session guard):** this branch is shared with a separate
> World Engine session that co-touches `src/main.js`/`docs/NOW.md`. Task 2 does NOT touch
> `src/main.js` or `docs/NOW.md` at all. Every commit step is **file-scoped**:
> `git add <explicit paths>` then `git commit -m "…" -- <explicit paths>`. NEVER
> `git add -A` / `git add .`.

> **Build only — no dev server in any step.** Verification uses `npx vitest run <path>`
> and `npx vite build`. Do NOT run `npm run dev` / start a server / background a process.
> Max runs his own dev server on `:5174`; the in-browser live-verify is a separate
> chrome-devtools step run by the orchestrator, NOT a step in this plan.

---

- [ ] **Step 1: Write the failing unit test — extracted steer-toward helper (known geometry)**

Create `src/flight/__tests__/labVerbs.test.js`. This first block pins the `steerToward` helper Task 1 extracted from `SupercruisePilot.update` (`SupercruisePilot.js:93-101`) — the geometry the contract specifies (§3): target ahead ⇒ `{yaw:0,pitch:0}`; target to the right ⇒ `yaw < 0` (because `-localX·gain`); target above ⇒ `pitch > 0`; dead astern ⇒ `yaw === 1`; off-axis ⇒ clamped magnitude.

```js
// src/flight/__tests__/labVerbs.test.js
//
// Unit layer for the harness-first arc (Task 2). Exercises the PURE pieces the
// lab drives through ShipControls — exactly the contract surface (steerToward,
// the shaped-stick casing fix, the named PilotFrame contract, and the headless
// flyTo arrival driver) — so the lab build and the unit suite test one code path.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { steerToward } from '../aimAssist.js';
import { PILOT_TUNING } from '../SupercruisePilot.js';

const GAIN = PILOT_TUNING.STEER_GAIN; // 3.0

// Helper: ship at origin, identity orientation → nose points local -Z (toward -Z world).
const atRest = () => ({ q: new THREE.Quaternion(), from: new THREE.Vector3(0, 0, 0) });

describe('steerToward — extracted steer-toward-body math (CONTRACT §3)', () => {
  it('target dead ahead (nose -Z) → zero steering', () => {
    const { q, from } = atRest();
    const out = steerToward(q, from, new THREE.Vector3(0, 0, -5000), GAIN);
    expect(out.yaw).toBeCloseTo(0, 6);
    expect(out.pitch).toBeCloseTo(0, 6);
  });

  it('target to the right (+X) → negative yaw (−localX·gain)', () => {
    const { q, from } = atRest();
    // slightly ahead + to the right so it is off-axis but not antiparallel
    const out = steerToward(q, from, new THREE.Vector3(0.001, 0, -5000), GAIN);
    expect(out.yaw).toBeLessThan(0);
    expect(out.pitch).toBeCloseTo(0, 6);
  });

  it('target above (+Y) → positive pitch (localY·gain)', () => {
    const { q, from } = atRest();
    const out = steerToward(q, from, new THREE.Vector3(0, 0.001, -5000), GAIN);
    expect(out.pitch).toBeGreaterThan(0);
    expect(out.yaw).toBeCloseTo(0, 6);
  });

  it('target dead astern (+Z, antiparallel) → yaw escape = 1 (no permanent ALIGN hang)', () => {
    const { q, from } = atRest();
    const out = steerToward(q, from, new THREE.Vector3(0, 0, 5000), GAIN);
    expect(out.yaw).toBe(1); // SupercruisePilot.js:100 antiparallel escape
  });

  it('a hard off-axis target clamps yaw/pitch to [-1, 1]', () => {
    const { q, from } = atRest();
    const out = steerToward(q, from, new THREE.Vector3(9000, 9000, -1), GAIN);
    expect(out.yaw).toBeGreaterThanOrEqual(-1);
    expect(out.yaw).toBeLessThanOrEqual(1);
    expect(out.pitch).toBeGreaterThanOrEqual(-1);
    expect(out.pitch).toBeLessThanOrEqual(1);
  });

  it('does not mutate the caller orientation / from / toBody', () => {
    const q = new THREE.Quaternion();
    const from = new THREE.Vector3(1, 2, 3);
    const toBody = new THREE.Vector3(4, 5, 6);
    const qBefore = q.clone(), fromBefore = from.clone(), toBefore = toBody.clone();
    steerToward(q, from, toBody, GAIN);
    expect(q.equals(qBefore)).toBe(true);
    expect(from.equals(fromBefore)).toBe(true);
    expect(toBody.equals(toBefore)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — Run: `npx vitest run src/flight/__tests__/labVerbs.test.js`
  → Expected: FAIL. If Task 1 already landed `steerToward`, the geometry assertions should already pass; the failure that confirms this test is wired is the import resolving. If `steerToward` is NOT yet exported, the failure is `SyntaxError: The requested module '../aimAssist.js' does not provide an export named 'steerToward'`. Either way: do NOT proceed until the import resolves and the six `steerToward` cases run.

  > **If `steerToward` is missing**, Task 1 is incomplete — STOP and finish Task 1 (the CONTRACT §3 helper) first. Task 2 consumes it; it does not define it.

- [ ] **Step 3: Confirm the helper passes (no new impl in this step — Task 1 owns `steerToward`)** — Run: `npx vitest run src/flight/__tests__/labVerbs.test.js`
  → Expected: PASS — all six `steerToward` cases green. This proves the extracted helper matches the inline pilot math (`SupercruisePilot.js:94-101`) and the contract geometry. (Task 2 adds NO production code for `steerToward`; it only asserts Task 1's extraction is correct.)

- [ ] **Step 4: Commit** — `git add src/flight/__tests__/labVerbs.test.js && git commit -m "test(control-harness): pin extracted steerToward helper geometry (Task 2 unit layer)" -- src/flight/__tests__/labVerbs.test.js`

---

- [ ] **Step 5: Write the casing-reconcile GUARD test — shaped-stick casing fix** (characterization, green by construction — Task 1's `steer()` owns the runtime wiring; this pins the pure-function fix shape)

The latent bug: `shapeMagnitude` destructures **lowercase** `{ deadzone, expo }` (`stickCurve.js:7`), but the tuning objects expose **uppercase** `{ DEADZONE, EXPO }` (`stickCurve.js:1-4`; the lab's `stickTuning = { ...STICK_TUNING }` at `flight-controls-lab.html:162`). Passing such an object straight in matches NEITHER key → defaults always win → runtime tuning silently ignored. `steer()` (Task 1) reconciles by lowercasing the keys before calling `shapeStick`. Append to `src/flight/__tests__/labVerbs.test.js`:

```js
import { shapeStick, shapeMagnitude, STICK_TUNING } from '../stickCurve.js';

describe('shaped-stick casing fix (CONTRACT §1 steer note) — the bug steer() fixes', () => {
  // PROOF of the latent bug: passing the UPPERCASE tuning object as opts is a
  // silent no-op (neither `deadzone` nor `expo` keys match), so the shaped output
  // equals the DEFAULT-shaped output regardless of the tuning values.
  it('passing uppercase {DEADZONE,EXPO} directly is silently ignored (defaults win)', () => {
    const wide = { ...STICK_TUNING, DEADZONE: 0.5, EXPO: 0.6 }; // very different tuning
    const ignored = shapeMagnitude(0.4, wide);                  // uppercase → no match
    const asDefault = shapeMagnitude(0.4);                      // defaults
    expect(ignored).toBeCloseTo(asDefault, 12);                 // BUG: tuning had no effect
  });

  // The fix steer() applies: lowercase the keys before handing them to shapeStick.
  // With a DEADZONE of 0.5, a stick magnitude of 0.4 falls INSIDE the deadzone →
  // shaped output is exactly {0,0}; with the default 0.06 deadzone it is non-zero.
  it('reconciled (lowercased) tuning actually changes the shaped output', () => {
    const tuning = { ...STICK_TUNING, DEADZONE: 0.5, EXPO: 0.6 };
    const opts = { deadzone: tuning.DEADZONE, expo: tuning.EXPO }; // exactly what steer() builds
    const shaped = shapeStick(0.4, 0, opts);     // |in| = 0.4 < 0.5 deadzone → killed
    expect(shaped.x).toBe(0);
    expect(shaped.y).toBe(0);
    const shapedDefault = shapeStick(0.4, 0);    // default 0.06 deadzone → passes through
    expect(Math.hypot(shapedDefault.x, shapedDefault.y)).toBeGreaterThan(0);
  });

  it('a LOWER (looser) deadzone admits a stick magnitude the default rejects', () => {
    const opts = { deadzone: 0.0, expo: 0.30 };   // no deadzone
    const shaped = shapeStick(0.03, 0, opts);     // 0.03 < default 0.06 dz, but dz=0 admits it
    expect(Math.hypot(shaped.x, shaped.y)).toBeGreaterThan(0);
    expect(Math.hypot(shapeStick(0.03, 0).x, shapeStick(0.03, 0).y)).toBe(0); // default kills it
  });
});
```

- [ ] **Step 6: Run the casing-reconcile assertions, verify they PASS against existing `stickCurve.js`** — Run: `npx vitest run src/flight/__tests__/labVerbs.test.js`
  → Expected: **PASS** for the "uppercase is silently ignored" case AND the reconciled (lowercased-opts) cases against the EXISTING `shapeStick`/`shapeMagnitude`. This is a **characterization/guard test, NOT red-first**: it pins the SHAPE of the fix at the pure-function boundary (the exact `{ deadzone, expo }` object `steer()` must build) and is GREEN by construction — the existing pure functions already honor lowercase keys, and Task 1's `steer()` owns the runtime wiring. The "uppercase is silently ignored" case documents the bug-as-it-exists-today (also green). If any reconciled-tuning assertion FAILS, `shapeStick`/`shapeMagnitude` diverged from the contract — STOP and reconcile against `stickCurve.js:7` before continuing.

  > These cases assert the SHAPE of the fix at the pure-function boundary (the exact `{ deadzone, expo }` object `steer()` must build). The `steer()` verb itself wiring `host.setDeflection` + the negated `setTurnInput` is exercised end-to-end in the lab (Step 13) where a real `model` exists; the unit layer pins only the casing-reconcile math so the lab and the unit suite agree on it.

- [ ] **Step 7: Commit** — `git add src/flight/__tests__/labVerbs.test.js && git commit -m "test(control-harness): pin shaped-stick casing reconcile (the steer() fix)" -- src/flight/__tests__/labVerbs.test.js`

---

- [ ] **Step 8: Write the failing unit test — named `PilotFrame` contract + headless `flyTo` arrival driver**

Two things the contract names that the lab consumes: the named Frame contract (`PILOT_FRAME_FIELDS`, §2) and the headless `flyTo`→`Arrival` self-stepping driver (§6). Append to `src/flight/__tests__/labVerbs.test.js`:

```js
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase } from '../SupercruisePilot.js';
import { ShipControls } from '../ShipControls.js';
import { PILOT_FRAME_FIELDS } from '../ShipControls.js';

const DT = 1 / 60;
// real-scale-ish body well ahead on -Z so the leg aligns + cruises + captures.
const mkBody = (x, y, z, r) => ({ position: new THREE.Vector3(x, y, z), radius: r });

function mkControls() {
  const model = new SupercruiseModel();
  const pilot = new SupercruisePilot(model);
  // HeadMount stand-in. SAFE precisely because ShipControls.step() never touches
  // head (contract §7: head.update/applyTo stay host-owned, outside step). If a
  // future change routes head THROUGH the surface, swap this for a real
  // `new HeadMount()` (as Task 1's ShipControls.test.js mk() uses) so the stub
  // can't silently diverge from what step() actually drives.
  const head = { update() {}, applyTo() {} };
  return { model, pilot, head, controls: new ShipControls({ model, pilot, head }) };
}

describe('PilotFrame named contract (CONTRACT §2)', () => {
  it('lists exactly the six one-shot fields, in order', () => {
    expect(PILOT_FRAME_FIELDS).toEqual([
      'phase', 'prevPhase', 'phaseChanged', 'motionComplete', 'overshoot', 'decelStarted',
    ]);
  });

  it('a real pilot frame stamps every named field', () => {
    const { model, pilot } = mkControls();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.position, radius: body.radius }]);
    pilot.beginLeg({ toBody: { position: body.position }, bodyRadius: body.radius, linger: 1 });
    const frame = pilot.update(DT);
    for (const k of PILOT_FRAME_FIELDS) expect(frame).toHaveProperty(k);
    expect(Object.values(PilotPhase)).toContain(frame.phase);
  });
});

describe('flyTo → Arrival, headless self-stepping (CONTRACT §6)', () => {
  it('step() runs pilot.update BEFORE model.update when active, model-only when idle', () => {
    const { model, pilot, controls } = mkControls();
    // idle: step returns null, model still advanced (no throw)
    expect(controls.step(DT)).toBeNull();
    // active: step returns the pilot frame
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.position, radius: body.radius }]);
    pilot.beginLeg({ toBody: { position: body.position }, bodyRadius: body.radius, linger: 1 });
    const frame = controls.step(DT);
    expect(frame).not.toBeNull();
    expect(PILOT_FRAME_FIELDS.every((k) => k in frame)).toBe(true);
  });

  it('resolves the Arrival with the motionComplete frame (flyFromRest-style 60Hz loop)', async () => {
    const { model, controls } = mkControls();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.position, radius: body.radius }]);
    const arrival = controls.flyTo({ toBody: { position: body.position }, bodyRadius: body.radius, linger: 0.5 });
    const frame = await arrival.promise;
    expect(frame.motionComplete).toBe(true);
    expect(arrival.done).toBe(true);
    // parked inside the capture sphere (10R), body-locked HOLD reached
    expect(model.position.distanceTo(body.position)).toBeLessThanOrEqual(body.radius * 10);
  });

  it('then(cb) fires with the same completing frame (callback sugar)', async () => {
    const { model, controls } = mkControls();
    const body = mkBody(0, 0, -5000, 5);
    model.setBodies([{ position: body.position, radius: body.radius }]);
    let cbFrame = null;
    const arrival = controls.flyTo({ toBody: { position: body.position }, bodyRadius: body.radius, linger: 0.5 });
    arrival.then((f) => { cbFrame = f; });
    await arrival.promise;
    expect(cbFrame).not.toBeNull();
    expect(cbFrame.motionComplete).toBe(true);
  });
});
```

- [ ] **Step 9: Run it, verify it fails** — Run: `npx vitest run src/flight/__tests__/labVerbs.test.js`
  → Expected: FAIL if `ShipControls` / `PILOT_FRAME_FIELDS` are not yet exported (`does not provide an export named 'ShipControls'` / `'PILOT_FRAME_FIELDS'`). If Task 1 landed both, expect PASS. As with Step 2: Task 2 does NOT implement these — they are Task 1's. If they are missing, STOP and finish Task 1.

> **Note on `PILOT_FRAME_FIELDS` re-export:** `PILOT_FRAME_FIELDS` is DEFINED on `SupercruisePilot.js` (Task 1 Step 13) and RE-EXPORTED from `ShipControls.js` by Task 1 Step 18 (`export { PILOT_FRAME_FIELDS } from './SupercruisePilot.js';` — a declared Task-1 Produces line). So this test's `import { PILOT_FRAME_FIELDS } from '../ShipControls.js'` resolves from the single surface module, exactly as the lab's `import { ShipControls, PILOT_FRAME_FIELDS } from './src/flight/ShipControls.js';` (Step 12) does. No branch / no decision here — if this import fails to resolve, Task 1 Step 18's re-export line is missing; flag it as a Task-1 gap rather than patching the import path here.

- [ ] **Step 10: Confirm pass (Task 1 owns `ShipControls`/`PILOT_FRAME_FIELDS`/`flyTo`)** — Run: `npx vitest run src/flight/__tests__/labVerbs.test.js`
  → Expected: PASS — the Frame-contract block and the headless `flyTo`/`step` block green. This proves the lab's headless arrival path (Step 14) works against the real model before any HTML wiring.

- [ ] **Step 11: Commit** — `git add src/flight/__tests__/labVerbs.test.js && git commit -m "test(control-harness): pin PilotFrame contract + headless flyTo arrival driver" -- src/flight/__tests__/labVerbs.test.js`

---

- [ ] **Step 12: Rewire the lab to drive `ShipControls` (drop the retired 4-state ring)**

The lab currently builds an ad-hoc `_flightMode` / `_alignState` / `cycleFlightMode` ring around the **RETIRED** `advanceFlightMode` (`flight-controls-lab.html:130` import; `217-244`; bound to `F` at `294`; `#btnCycleMode` at `112-114`,`772`). That is a divergent code path — a false-pass risk. Replace it with a real `ShipControls` instance the lab drives.

First, replace the imports (`flight-controls-lab.html:130-131`):

```html
    import { ShipControls, PILOT_FRAME_FIELDS } from './src/flight/ShipControls.js';
    import { steerToward } from './src/flight/aimAssist.js';
```
(Remove the `import { FlightMode, advanceFlightMode, flightModeInfo } from './src/flight/flightModes.js';` line at `130` and the `import { alignStep, alignDot } from './src/flight/aimAssist.js';` line at `131` — the lab no longer drives Mode-B align directly; `flyTo` exercises the assist path through the surface. Keep the `flightExitAnchor`, `ShipCameraSystem`/`CameraMode`, and `Settings` imports at `134-136`: `engage`/`disengage` use them via the host delegates below.)

Next, replace the whole F-cycle block (`flight-controls-lab.html:217-244`, from the `// ── Flight-assist modes (F-cycle) …` comment through the end of `cycleFlightMode()`) with a `ShipControls` instance plus a ≥2-body selectable set and a real host that wires `engage`/`disengage`/`selectTarget` to the lab's real camera controller + Settings:

```js
    // ── Real ShipControls surface (the SAME class the game uses) driving the real
    //    model + pilot + head. The lab is the harness: it walks the verb surface,
    //    not an ad-hoc reimplementation of the wiring (kills the divergent-path
    //    false-pass that the retired 4-state ring was). ──
    const scPilot = new SupercruisePilot(model);

    // ≥2 selectable bodies so selectTarget exercises real selection (not a single
    // hard-wired body) AND the no-target no-op. The reference planet is one; add a
    // second body offset on +X so a re-select is observable. flyTo/engage act on
    // whichever is currently selected.
    const bodyB = (() => {
      const geo = new THREE.SphereGeometry(PLANET_RADIUS * 0.6, 32, 24);
      const mat = new THREE.MeshStandardMaterial({ color: 0x886622, roughness: 0.9 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(ENTRY_DIST * 1.4, 0, 0);
      scene.add(m);
      return m;
    })();
    const selectableBodies = [
      { mesh: planet, radius: PLANET_RADIUS },
      { mesh: bodyB,  radius: PLANET_RADIUS * 0.6 },
    ];
    let _selected = null; // null = no target (the no-op case)

    // Host delegates: the lab's REAL camera controller + REAL Settings, so engage/
    // disengage/selectTarget walk the production host path (no main.js import).
    const labCtrl = _ensureExitController(); // real ShipCameraSystem on an offscreen canvas
    const labSettingsHost = new Settings();
    const controls = new ShipControls({
      model, pilot: scPilot, head: headMount,
      host: {
        selectTarget(t) { _selected = t; },
        deselectTarget() { _selected = null; },
        resolveSelectedBody() { return _selected; },
        readFlightType() { return labSettingsHost.get('flightControlType'); },
        enterFlight() {
          labCtrl.setCameraMode(CameraMode.FLIGHT);
          labCtrl.bypassed = true;
          scModelEngaged = true;
        },
        exitFlight() {
          // no-snap forward-ray exit (real flightExitAnchor + adoptCurrentPose)
          labCtrl.setCameraMode(CameraMode.TOY_BOX);
          const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
          const rawD = camera.position.distanceTo((_selected?.mesh ?? planet).position);
          const d = Math.max(labCtrl.minDistance, Math.min(labCtrl.maxDistance, rawD));
          labCtrl.adoptCurrentPose(flightExitAnchor(camera.position, fwd, d));
          scModelEngaged = false;
        },
        setDeflection(d) { _labDeflection = { x: d.x, y: d.y }; },
      },
    });
    let scModelEngaged = false; // lab "in flight" gate (mirrors main.js _scManual)
```

> Note: `_ensureExitController()` is the lab's existing real-`ShipCameraSystem` factory (`flight-controls-lab.html:584-590`) — reuse it; do not build a second controller. `_labDeflection` already exists at `163`. The `headMount` instance already exists at `215`.

- [ ] **Step 13: Rewire input + sim loop + buttons through the surface verbs**

Replace the keydown `f` branch (`flight-controls-lab.html:294`, inside the `keydown` listener) with the real 2-state toggle:

```js
      if (k === 'f') { scModelEngaged ? controls.disengage() : controls.engage(); }
```

Replace the mousemove handler body (`flight-controls-lab.html:306-320`, the whole `if (!dragging) return; … }` block) so steering runs through `controls.steer` (raw coords; the surface shapes + negates + updates deflection):

```js
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const nx = THREE.MathUtils.clamp((e.clientX - dragX) / JOY_RANGE, -1, 1);
      const ny = THREE.MathUtils.clamp(-(e.clientY - dragY) / JOY_RANGE, -1, 1);
      controls.steer(nx, ny); // shaped (casing fixed) + setTurnInput(-x,-y) + setDeflection
    });
```
And the `mouseup` handler (`321-325`) to stop steering through the surface:
```js
    window.addEventListener('mouseup', () => {
      dragging = false;
      controls.steer(0, 0);
    });
```

Replace the throttle stepping + stepping calls in `step(dt)` (`flight-controls-lab.html:395-416`) so the loop routes through `controls.step(dt)` (encapsulated pilot→model order) and `controls.setThrottle` (reverse-capable):

```js
    function step(dt) {
      // Throttle from held W/S routed through the surface (negative = reverse).
      if (!scripted) {
        const dir = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
        if (dir !== 0) controls.setThrottle(model.throttle + dir * model.tuning.THROTTLE_RATE * dt);
      }
      refreshBodies();        // current rebased body positions every tick (model contract)
      controls.step(dt);      // pilot.update (if active) BEFORE model.update — encapsulated order
      headMount.update(dt);   // recenter easing when not held
      headMount.applyTo(camera, model.position, model.orientation);
    }
```

> The retired ring drove `model` and `scPilot` by hand and inlined Mode-B `alignStep`. That all moves inside `ShipControls.step` / `flyTo` now. The lab no longer references `_flightMode` / `_alignState` / `cycleFlightMode` / `_enterFlightMode` / `_beginAlign` / `_engageAssist` / `alignStep` / `alignDot` — delete the now-dead `resetModel` lines that reset them (`flight-controls-lab.html:259-262`: the `_flightMode = …`, `_alignState.* = …`, `scPilot.stop()` lines) and replace with a single `controls.stop('idle')`:

```js
      controls.stop('idle');  // halt any pilot leg + zero throttle on reset
```

Rebind the buttons. Replace `#btnCycleMode`'s handler (`flight-controls-lab.html:772`) with an engage/disengage toggle, and relabel the button text (`112`) + readout (`113`):

```js
    document.getElementById('btnCycleMode').onclick = () =>
      scModelEngaged ? controls.disengage() : controls.engage();
```
And in the panel HTML, change the button label (`flight-controls-lab.html:112`) from `Cycle mode (F)` to `Engage / Exit (F)`, and the group title (`111`) from `FLIGHT MODES (F-cycle)` to `FLIGHT TOGGLE (F = engage/exit)`. Update `updateModeLabel` (`446-452`) to read the surface's `getState()`:

```js
    function updateModeLabel() {
      if (!modeReadoutEl) return;
      const s = controls.getState();
      modeReadoutEl.textContent =
        `engaged:${scModelEngaged ? 'ON' : 'off'}` +
        `   mode:${s.mode ?? '—'}` +
        `   phase:${s.phase}` +
        `   assist:${scPilot.isActive ? 'ON' : 'off'}`;
    }
```
And the hint text (`119`) to reflect the 2-state toggle + reverse:
```html
    <div class="hint">W/S = throttle (S past 0 = reverse) &nbsp; drag = virtual joystick (turn)<br>F = engage / exit flight &nbsp; _lab.flyTo() in console for an autopilot leg<br>_lab.flyFromRest({seconds}) for the cruise-translation verdict</div>
```

- [ ] **Step 14: Extend `window._lab` with the surface + verb passthroughs + the arrival flag**

Replace the flight-modes portion of the `window._lab` object (`flight-controls-lab.html:756-761`, the `// Flight-modes (F-cycle) …` block through `get assistActive()`) so the harness drives the verbs the lab now exercises, including a `flyTo` that records arrival:

```js
      // ── ShipControls surface (the SAME object the game drives) ──
      controls,
      scPilot,
      selectableBodies,
      // Verb passthroughs for console / chrome-devtools driving:
      engage: (type) => controls.engage(type),
      disengage: () => controls.disengage(),
      setThrottle: (t) => controls.setThrottle(t),
      steer: (x, y) => controls.steer(x, y),
      stop: (mode) => controls.stop(mode),
      getState: () => controls.getState(),
      selectTarget: (i) => controls.selectTarget(i == null ? null : selectableBodies[i] ?? null),
      deselect: () => controls.deselect(),
      get engaged() { return scModelEngaged; },
      get selected() { return _selected; },
      // flyTo a selectable body by index; records `arrived` on motionComplete so a
      // headless / chrome-devtools driver can assert "arrived at body".
      arrived: false,
      flyTo(i = 0, linger = 0.5) {
        const b = selectableBodies[i];
        this.arrived = false;
        const a = controls.flyTo({ toBody: b.mesh, bodyRadius: b.radius, linger });
        a.then(() => { this.arrived = true; });
        return a;
      },
```

> Keep the existing `flyFromRest`, `reset`, `setTuning`, `model`, `headMount`, `camera`, `planet`, `PLANET_RADIUS`, `ENTRY_DIST`, `projectedScreenRadiusPx`, `stickTuning`, `scHud`, `settings`, `checkNoSnapExit`, `checkSettingsTypeEngage` keys untouched. The `get flightMode/alignActive/assistActive` getters that referenced the deleted `_flightMode`/`_alignState` are removed (replaced by `getState()` + `get engaged`).

> `updateScHud()` (`466-486`) reads `_flightMode` at `484` (`flightMode: _flightMode`). Replace that one line with `flightMode: controls.getState().mode ?? FlightMode.MANUAL` — but `FlightMode` is no longer imported. Use the literal the HUD expects: `flightMode: controls.getState().mode ?? 'manual'`. (The HUD only stringifies it.)

- [ ] **Step 15: Build the lab + run the full flight suite, verify green** — Run: `npx vite build`
  → Expected: "built in …" with no errors (the lab HTML is an entry; a broken import or syntax error fails the build).
  Then run the flight suite: `npx vitest run src/flight`
  → Expected: PASS — `labVerbs` (steerToward + casing + PilotFrame + flyTo) green; existing `stickCurve`, `aimAssist`, `flightModes`, `SupercruiseModel`, `SupercruisePilot`, `HeadMount`, `FlightDynamics`, `flightExitAnchor` suites green (no regressions). No `src/main.js` file was touched.

- [ ] **Step 16: Commit** — `git add flight-controls-lab.html src/flight/__tests__/labVerbs.test.js && git commit -m "feat(control-harness): drive lab through ShipControls — reverse, shaped steer, ≥2-body select+no-op, 2-state engage/exit, flyTo→arrival (Task 2, harness-first)" -- flight-controls-lab.html src/flight/__tests__/labVerbs.test.js`

---

- [ ] **Step 17: Task 2 gate — confirm green before Task 3**

This is the harness-first gate. **Task 3 may not begin until both pass.**
- Run: `npx vitest run src/flight` → Expected: full flight suite green (known-failures-only elsewhere; **0 new** failures).
- Run: `npx vite build` → Expected: clean.

Then the orchestrator runs the lab live-verify OUTSIDE this plan (chrome-devtools on `:9223` → the `:5174` worktree tab, per `well-dipper-testing-reference.md`): in the lab, confirm by hand the player-facing verbs — `_lab.setThrottle(-0.5)` moves the ship backward (reverse); dragging the joystick steers with the casing-fixed curve and the HUD stick marker tracks; `_lab.selectTarget(1)` then `_lab.selectTarget(null)` is a clean no-op; F engages/exits (2-state, no 4-state ring); `_lab.flyTo(0)` then poll `_lab.arrived === true` at the reference planet. That live step is NOT a TDD step here — it is the orchestrator's gate after this Task is headless-green.

---

### Task 3: Wire the live game through `ShipControls` — consolidate the 9 `beginLeg` sites + route player steer + sim step (PURE consolidation, ZERO behavior change)

> **⚠ SCOPE BOUNDARY vs. spec Part-3 AC1 — DECISION NEEDED FROM MAX before this task runs.**
> Spec Part-3 AC1 reads: *"Player manual/assist input, the attract tour's per-leg dispatch, and warp re-entry all flow through the surface verbs (`engage`/`steer`/`flyTo`) rather than poking `scPilot`/`scModel` directly."* As written, **this task routes `step`, the 9 `beginLeg` sites (via `flyTo`), and the player joystick (`steer`) — but NOT the in-game `engage`/`disengage` path.** Three named-but-unrouted-in-game items remain after this plan as written:
> 1. **`engage`/`disengage` (the live F-key handler).** Task 1 Step 30(b) deliberately leaves the `enterFlight`/`exitFlight`/`readFlightType`/`dropState` host delegates UNWIRED ("wired in Task 3"), but Task 3 below has no step that (a) implements those delegates or (b) reroutes the player F-key `_scManual` engage/exit toggle through `scControls.engage()`/`disengage()`. So in-game `engage`/`disengage` and `getState().mode` stay non-functional, and the `engage` verb AC1 names is not on the live input path.
> 2. **In-game `selectTarget`/`deselect` call sites** — exposed on the surface + wired as host delegates, but the live game's own selection calls are not rerouted through `scControls.selectTarget`/`deselect` (only the lab exercises them, Task 2).
> 3. **The three existing raw `scPilot._target` reads** at `src/main.js:6081, 6083, 8378` — the named `get target` accessor is added (Task 1) and tested, but these existing reads are not migrated to `scControls.target`, so the cross-boundary private-field reads risk (e) names still remain.
>
> **Why deferred, not silently fixed here:** routing the live F-handler through `engage`/`disengage` touches the **locked no-snap-exit behavior** (`flightExitAnchor` + `adoptCurrentPose` + `cameraInterp.resync`) and the live camera-mode/Settings/seed path — it is a behavior-sensitive change, not a mechanical dispatch swap like the `beginLeg` consolidation. **Max must choose ONE of:**
> - **(A) Add an in-game engage-routing step to this task** — implement the `enterFlight`/`exitFlight`/`readFlightType`/`dropState` delegates promised in Task 1 Step 30(b), reroute the F-handler through `scControls.engage()`/`disengage()` (no-snap exit preserved), reroute the live `selectTarget`/`deselect` calls, migrate the 3 `_target` reads to `scControls.target`, and add headless assertions. This satisfies AC1 as written but enlarges Task 3 (the riskiest task) and adds behavior-sensitive surface area.
> - **(B) Amend spec Part-3 AC1** to drop `engage` (and in-game `selectTarget`/`deselect` + the `_target`-read migration) from the in-game required verbs for THIS arc, scoping in-game engage-routing as a follow-on. Then this plan satisfies the (narrowed) AC1 as written.
>
> Until Max picks (A) or (B), this plan does **not** satisfy Part-3 AC1 verbatim. The steps below cover only `step`/`flyTo`/`steer`.

**Files:**
- Modify: `src/main.js` — the sim-step pilot→model order (`7601-7602`); the 9 `scPilot.beginLeg(` dispatch sites (`5598`, `5653`, `5876`, `6066`, `6338`, `6384`, `6428`, `6623`, `7856`); the live virtual-joystick steer pair (`9277-9278`).
- Create: `src/flight/__tests__/shipControls-game-wiring.test.js` — a headless integration test asserting `flyTo` routes through `pilot.beginLeg` and `step` preserves the `pilot.update → model.update` order (the only pure-checkable invariants of this consolidation).

**Interfaces:**
- Consumes (from Task 1, the module-scoped `ShipControls` instance + `window._sc.controls`, `src/main.js:484`):
  - `shipControls.flyTo({ toBody: THREE.Object3D, bodyRadius: number, linger?: number }) → Arrival` — wraps `pilot.beginLeg(target)` (`SupercruisePilot.js:46`, `{ toBody, bodyRadius, linger = 8 }`); in-game it only sets the leg and returns the `Arrival` (frame-safe intent-setter — does NOT step the model, the 60 Hz loop owns stepping).
  - `shipControls.step(dt: number) → PilotFrame | null` — if `pilot.isActive`: `pilot.update(dt)` FIRST then `model.update(dt)`, returns the frame; else `model.update(dt)` only, returns `null`. Encapsulates the `pilot.update → model.update` order (matches `src/main.js:7601-7602`).
  - `shipControls.steer(x: number, y: number) → void` — RAW stick coords (pre-shaping); runs the shaped-stick curve with the casing reconciled, then `model.setTurnInput(-shaped.x, -shaped.y)` (the negated turn-input convention) AND `host.setDeflection({ x: shaped.x, y: shaped.y })` (un-negated deflection store) so `_scDeflection`/HUD stick stay in sync.
  - `Arrival` — `{ done, promise, then(cb), poll(frame), cancel() }`; resolves with the `motionComplete` `PilotFrame`.
- Produces: no new public symbol. The 9 `beginLeg` literals leave `src/main.js` (the sole surviving literal is inside `ShipControls.flyTo`, in `src/flight/ShipControls.js`).

**Behavior-change budget (ZERO):** every replacement is mechanically equivalent. `flyTo` in-game is `pilot.beginLeg(target)` + return `Arrival` (we discard the return where today's call discarded nothing). `step(dt)` runs the identical `pilot.isActive ? pilot.update(dt) : null` then `model.update(dt)` sequence and returns the same `scFrame`. `steer(nx, ny)` reproduces the exact `setTurnInput(-s.x,-s.y)` + `_scDeflection={x:s.x,y:s.y}` pair; at the DEFAULT `_scStickTuning` (`{...STICK_TUNING}`, `src/main.js:480`) the Task-1 casing fix yields identical shaped output (defaults win either way), so live feel is unchanged unless the UAT knob `window._sc.stickTuning` is mutated — which is the intended latent-bug fix, not a regression.

> **COMMIT DISCIPLINE (parallel-session guard):** the branch is shared with a separate World Engine session co-touching `src/main.js` + `docs/NOW.md`. EVERY commit step below is FILE-SCOPED — `git add <explicit paths>` then `git commit -m "..." -- <explicit paths>`. NEVER `git add -A` / `git add .`. Do NOT edit `docs/NOW.md` in this task.

> **GUARD (no re-tune):** do NOT touch `SC_TUNING` cap/hold floors or `scPilot.tuning` DROP_* in any step here — this task only moves dispatch, it changes no tuning constant.

> **Live-verify is NOT a step in this task.** This task ends at headless green (vitest + `npx vite build`). The in-browser camera-transform live-verify (`well-dipper-testing-reference.md` §6.5, on `:9223` → the `:5174` worktree tab) is run separately by the orchestrator AFTER this task's headless gate is green.

---

- [ ] **Step 1: Write the failing integration test** — `src/flight/__tests__/shipControls-game-wiring.test.js`

This pins the two invariants the consolidation must preserve, using a real `SupercruiseModel` + `SupercruisePilot` + `HeadMount` (the same objects `main.js` wires). It fails now because `ShipControls` is consumed but the test file does not exist — and it locks the in-game `flyTo` = `pilot.beginLeg` mapping + the `step` ordering this task routes the live loop through.

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot } from '../SupercruisePilot.js';
import { HeadMount } from '../HeadMount.js';
import { ShipControls } from '../ShipControls.js';

function makeControls() {
  const model = new SupercruiseModel();
  const pilot = new SupercruisePilot(model);
  const head = new HeadMount();
  return { model, pilot, controls: new ShipControls({ model, pilot, head }) };
}

describe('ShipControls game-wiring contract (Task 3 consolidation invariants)', () => {
  it('flyTo sets the pilot leg via beginLeg (in-game intent-setter, no self-step)', () => {
    const { model, pilot, controls } = makeControls();
    const body = new THREE.Object3D();
    body.position.set(0, 0, -50);
    const p0 = model.position.clone();
    controls.flyTo({ toBody: body, bodyRadius: 5, linger: 8, selfStep: false });
    // beginLeg armed the pilot onto the body, did NOT advance the model itself.
    expect(pilot.isActive).toBe(true);
    // Read the named accessor on the SURFACE (ShipControls.get target → pilot._target).
    // NOTE: SupercruisePilot has NO public `target` getter — only the private `_target`
    // field — so `pilot.target` would be undefined. The contract's accessor lives on
    // ShipControls (contract §1), so assert through `controls.target`.
    expect(controls.target?.mesh).toBe(body);
    expect(model.position.equals(p0)).toBe(true); // in-game flyTo does not step the model
  });

  it('flyTo passes linger straight through to the leg', () => {
    const { controls } = makeControls();
    const body = new THREE.Object3D();
    controls.flyTo({ toBody: body, bodyRadius: 3, linger: Infinity, selfStep: false });
    expect(controls.target?.linger).toBe(Infinity); // surface accessor, not pilot.target (no such getter)
  });

  it('step runs pilot.update BEFORE model.update and returns the frame when active', () => {
    const { model, pilot, controls } = makeControls();
    const body = new THREE.Object3D();
    body.position.set(0, 0, -50);
    controls.flyTo({ toBody: body, bodyRadius: 5, linger: 8, selfStep: false });
    const order = [];
    const realPilotUpdate = pilot.update.bind(pilot);
    const realModelUpdate = model.update.bind(model);
    pilot.update = (dt) => { order.push('pilot'); return realPilotUpdate(dt); };
    model.update = (dt) => { order.push('model'); return realModelUpdate(dt); };
    const frame = controls.step(1 / 60);
    expect(order).toEqual(['pilot', 'model']);   // pilot ALWAYS before model
    expect(frame).not.toBeNull();                 // active leg → returns the PilotFrame
  });

  it('step runs model.update only and returns null when the pilot is idle', () => {
    const { model, pilot, controls } = makeControls();
    expect(pilot.isActive).toBe(false);
    const order = [];
    const realModelUpdate = model.update.bind(model);
    model.update = (dt) => { order.push('model'); return realModelUpdate(dt); };
    const frame = controls.step(1 / 60);
    expect(order).toEqual(['model']);
    expect(frame).toBeNull();
  });
});
```

> **Note on `selfStep: false`:** the in-game `flyTo` is the intent-setter mode — it must NOT self-step the model (the 60 Hz loop owns stepping). Per the Task-1 `flyTo` signature, `selfStep` defaults to `true` (the headless/lab case), so these in-game wiring tests pass `selfStep: false` explicitly to assert the no-self-step invariant. The live `main.js` call sites in Steps 6–11 likewise rely on the in-game behavior; see Step 3's note on how the live loop drives the leg via `step()`.

- [ ] **Step 2: Run it, verify it fails** — Run: `npx vitest run src/flight/__tests__/shipControls-game-wiring.test.js`
  Expected: FAIL. If Task 1 already landed `ShipControls.js`, the failure is assertion-level (e.g. `pilot.target` accessor or `step`/`flyTo` not yet wired the way this pins). If Task 1's file is missing it errors with `Failed to resolve import '../ShipControls.js'`. Either way: not green. Do NOT proceed to Step 3 until this test is RED for the right reason (the wiring under test, not a typo). **This test stays green for the rest of Task 3** — it is the consolidation's unit anchor.

> Task 3 depends on Task 1 having created `src/flight/ShipControls.js` and the module-scoped `shipControls` instance + `window._sc.controls`. If `shipControls` is not yet a module-scoped binding in `main.js`, that is a Task-1 gap — flag it; do not invent a second instance here. **Naming note:** Task 1 Step 30 names the module-scoped instance `scControls`. Task 3's steps below refer to it as `shipControls` for readability — use the actual Task-1 binding name (`scControls`) at every call site; the two names denote the same instance.

- [ ] **Step 3: Route the sim-step pilot→model order through `shipControls.step`** — in `src/main.js`, replace the two-line update at `7601-7602`:

```js
      const scFrame = scPilot.isActive ? scPilot.update(deltaTime) : null;
      scModel.update(deltaTime);
```

with the single encapsulated step (returns the SAME `scFrame` the rest of the block already consumes at `7634`, `7661-7662`, `7671`):

```js
      const scFrame = scControls.step(deltaTime);
```

Leave `7600` (`scModel.setBodies(_scBodies);`) and `7603-7613` (Mode-B align driver + `scHead.update`/`applyTo`) UNCHANGED — `head` stays host-owned in the loop per the contract (§7: "`head.update` + `head.applyTo` stay host-owned"). `step` covers ONLY the `pilot.update → model.update` pair.

> **In-game `flyTo` self-step:** when the live loop drives a leg, `scControls.step(dt)` (this step) calls `arrival.poll(frame)` each tick (wired in Task 1 Step 18). So the in-game `flyTo` call sites in Steps 6–11 do NOT need to pass `selfStep: false` explicitly IF the live `flyTo` is invoked outside a 60 Hz self-step — but to be unambiguous and avoid a double-step, **pass `selfStep: false` at every in-game `flyTo` call site** in Steps 6–11. The headless default (`selfStep: true`) is only for the lab/unit path.

- [ ] **Step 4: Build + suite check after the step rewrite** — Run: `npx vite build` then `npx vitest run src/flight`
  Expected: `vite build` prints "built in …" with no errors; `src/flight` suite green (incl. the new wiring test from Step 1 once Task 1's `step` is in). If `scFrame` is now `undefined` instead of `null`/frame, `shipControls.step` is mis-implemented in Task 1 — flag, don't patch downstream.

- [ ] **Step 5: Commit the sim-step routing** — file-scoped:
  `git add src/main.js src/flight/__tests__/shipControls-game-wiring.test.js`
  `git commit -m "refactor(supercruise): route live sim-step pilot→model order through ShipControls.step" -- src/main.js src/flight/__tests__/shipControls-game-wiring.test.js`

---

- [ ] **Step 6: Consolidate the THREE tour-leg dispatch sites that carry a `linger × multiplier`** — these three share the exact `{ toBody, bodyRadius, linger: <stop>.linger * settings.get('tourLingerMultiplier') }` shape. Replace each `scPilot.beginLeg({ … })` with `scControls.flyTo({ …, selfStep: false })`, keeping the surrounding seed/`shipChoreographer` calls verbatim.

  (a) `_beginTourLegMotion` (`src/main.js:5598`) — replace:
```js
  scPilot.beginLeg({
    toBody: stop.bodyRef,
    bodyRadius: stop.bodyRadius,
    linger: stop.linger * settings.get('tourLingerMultiplier'),
  });
```
  with:
```js
  scControls.flyTo({
    toBody: stop.bodyRef,
    bodyRadius: stop.bodyRadius,
    linger: stop.linger * settings.get('tourLingerMultiplier'),
    selfStep: false,
  });
```

  (b) `startFlythrough` (`src/main.js:5653`) — replace:
```js
  scPilot.beginLeg({
    toBody: firstStop.bodyRef,
    bodyRadius: firstStop.bodyRadius,
    linger: firstStop.linger * settings.get('tourLingerMultiplier'),
  });
```
  with:
```js
  scControls.flyTo({
    toBody: firstStop.bodyRef,
    bodyRadius: firstStop.bodyRadius,
    linger: firstStop.linger * settings.get('tourLingerMultiplier'),
    selfStep: false,
  });
```

  (c) the tour-advance leg in `_handleScPilotFrame` (`src/main.js:6623`) — replace:
```js
      scPilot.beginLeg({
        toBody: nextStop.bodyRef,
        bodyRadius: nextStop.bodyRadius,
        linger: nextStop.linger * settings.get('tourLingerMultiplier'),
      });
```
  with:
```js
      scControls.flyTo({
        toBody: nextStop.bodyRef,
        bodyRadius: nextStop.bodyRadius,
        linger: nextStop.linger * settings.get('tourLingerMultiplier'),
        selfStep: false,
      });
```

  Leave the preceding `_seedScPoseFromCameraIfIdle()` (a,b), `shipChoreographer.onLegAdvanced()`/`beginTour(...)`, and `updateFocusFromStop(...)` calls UNCHANGED — they are not `beginLeg` and not in scope.

- [ ] **Step 7: Consolidate the warp re-entry tour legs** — the new-system reveal fly-in and the legacy navSubsystem orbit-advance fly-in, same tour shape.

  (a) `warpRevealSystem` reveal fly-in (`src/main.js:5876`) — replace:
```js
    scPilot.beginLeg({
      toBody: firstStop.bodyRef,
      bodyRadius: firstStop.bodyRadius,
      linger: firstStop.linger * settings.get('tourLingerMultiplier'),
    });
```
  with:
```js
    scControls.flyTo({
      toBody: firstStop.bodyRef,
      bodyRadius: firstStop.bodyRadius,
      linger: firstStop.linger * settings.get('tourLingerMultiplier'),
      selfStep: false,
    });
```

  (b) the warp-arrival fly-in inside the legacy navSubsystem `orbitComplete` branch (`src/main.js:7856`) — replace:
```js
          scPilot.beginLeg({
            toBody: nextStop.bodyRef,
            bodyRadius: nextStop.bodyRadius,
            linger: nextStop.linger * settings.get('tourLingerMultiplier'),
          });
```
  with:
```js
          scControls.flyTo({
            toBody: nextStop.bodyRef,
            bodyRadius: nextStop.bodyRadius,
            linger: nextStop.linger * settings.get('tourLingerMultiplier'),
            selfStep: false,
          });
```

  Leave the surrounding `navSubsystem.stop()` / `_seedScPoseFromCameraIfIdle()` / `shipChoreographer.onLegAdvanced()` / `updateFocusFromStop(...)` UNCHANGED.

- [ ] **Step 8: Build + suite check after the 5 tour/warp sites** — Run: `npx vite build` then `npx vitest run src/flight`
  Expected: build "built in …" clean; flight suite green. Then confirm progress: `grep -n 'scPilot\.beginLeg(' src/main.js` — expected: exactly **4** remaining (`6066`, `6338`, `6384`, `6428` — the assist + 3 commit-burn sites; line numbers may drift by ±a few after edits).

- [ ] **Step 9: Commit the tour + warp re-entry consolidation** — file-scoped:
  `git add src/main.js`
  `git commit -m "refactor(supercruise): route attract-tour + warp re-entry legs through ShipControls.flyTo" -- src/main.js`

---

- [ ] **Step 10: Consolidate the Mode-C assist leg** — `_engageAssist` (`src/main.js:6066`) is a one-liner with default linger (the model's `beginLeg` default `linger = 8`, `SupercruisePilot.js:46`). `flyTo` omitting `linger` preserves that default. Replace:
```js
function _engageAssist(body) { scPilot.beginLeg({ toBody: body.mesh, bodyRadius: body.radius }); }
```
  with:
```js
function _engageAssist(body) { scControls.flyTo({ toBody: body.mesh, bodyRadius: body.radius, selfStep: false }); }
```

- [ ] **Step 11: Consolidate the three commit-burn manual legs (`linger: Infinity`)** — `focusPlanet`/`focusStar`/`focusMoon` each seed the model pose with three direct lines then `beginLeg({ …, linger: Infinity })`. Replace ONLY the `scPilot.beginLeg(...)` call at each; keep the 3-line camera-pose seed (`scModel.position.copy(camera.position); scModel.orientation.copy(camera.quaternion); scModel.speed = 0; scModel.setThrottle(0);`) verbatim — that seed is host-coupled setup, not a `beginLeg` dispatch.

  (a) `focusPlanet` (`src/main.js:6338`) — replace:
```js
    scPilot.beginLeg({
      toBody: entry.planet.mesh,
      bodyRadius: bodyRadius,
      linger: Infinity,
    });
```
  with:
```js
    scControls.flyTo({
      toBody: entry.planet.mesh,
      bodyRadius: bodyRadius,
      linger: Infinity,
      selfStep: false,
    });
```

  (b) `focusStar` (`src/main.js:6384`) — replace:
```js
  scPilot.beginLeg({
    toBody: starObj.mesh,
    bodyRadius: bodyRadius,
    linger: Infinity,
  });
```
  with:
```js
  scControls.flyTo({
    toBody: starObj.mesh,
    bodyRadius: bodyRadius,
    linger: Infinity,
    selfStep: false,
  });
```

  (c) `focusMoon` (`src/main.js:6428`) — replace:
```js
  scPilot.beginLeg({
    toBody: moon.mesh,
    bodyRadius: bodyRadius,
    linger: Infinity,
  });
```
  with:
```js
  scControls.flyTo({
    toBody: moon.mesh,
    bodyRadius: bodyRadius,
    linger: Infinity,
    selfStep: false,
  });
```

- [ ] **Step 12: Verify the grep END-CONDITION** — Run: `grep -n 'scPilot\.beginLeg(' src/main.js`
  Expected: **no output** (exit code 1 — zero matches). The only surviving `scPilot.beginLeg(` / `pilot.beginLeg(` literal in the codebase is inside `ShipControls.flyTo` (`src/flight/ShipControls.js`), confirmed by: `grep -rn 'beginLeg(' src/flight/ShipControls.js` → expected exactly one match inside `flyTo`. This is the spec Part-3 AC2 checkable end condition.

- [ ] **Step 13: Build + suite check after the assist + commit-burn consolidation** — Run: `npx vite build` then `npx vitest run src/flight`
  Expected: build "built in …" clean; flight suite green (incl. the Step-1 wiring test). Then a fuller pass: `npx vitest run` — expected: known-failures-only (the pre-existing generation-data + vendored motion-test-kit files; **0 NEW** failures). If anything new is red, STOP and root-cause before proceeding — a new red here means a consolidation diverged from the original call.

- [ ] **Step 14: Commit the assist + commit-burn consolidation (grep clean)** — file-scoped:
  `git add src/main.js`
  `git commit -m "refactor(supercruise): route assist + commit-burn legs through ShipControls.flyTo (no beginLeg left in main.js)" -- src/main.js`

---

- [ ] **Step 15: Route the live virtual-joystick steer through `shipControls.steer`** — in the canvas mousemove handler (`src/main.js:9266-9280`), the `_scManual && !scHead.held` block computes the shaped stick `s`, the `_deflected` predicate, runs the Mode-B/Mode-C cancel logic, and finally writes the turn input + `_scDeflection`. Replace ONLY the final write pair (`9277-9278`):

```js
      scModel.setTurnInput(-s.x, -s.y);
      _scDeflection = { x: s.x, y: s.y };
```

  with the surface verb (RAW coords in; the verb shapes, negates the turn-input, and stores the un-negated deflection via `host.setDeflection`, reproducing both writes — see the contract Steer sign note):

```js
      scControls.steer(nx, ny);
```

  Leave UNCHANGED in that block: the `nx`/`ny` derivation (`9267-9269`), `const s = shapeStick(nx, ny, _scStickTuning);` and `const _deflected = …` (`9270-9271` — `_deflected` still gates the Mode-B/Mode-C cancels), and the `scPilot.stop()` / `_alignState.active = false` cancel branches (`9272-9276`). `steer()` only absorbs the FINAL turn-input + deflection write.

> **Zero-behavior-change note for this step:** `_scDeflection` is consumed by the HUD reticle (read at `src/main.js:8384` per spec) — `steer()`'s `host.setDeflection({ x: shaped.x, y: shaped.y })` writes the SAME `{ x: s.x, y: s.y }` the inline code did, and `model.setTurnInput(-shaped.x, -shaped.y)` is the SAME negation. At default `_scStickTuning` the casing fix is a no-op (defaults win), so the shaped values are identical. This is the contract AC4 "stick stays correct under programmatic steer" wiring.

- [ ] **Step 16: Build + suite check after the steer routing** — Run: `npx vite build` then `npx vitest run src/flight`
  Expected: build "built in …" clean; flight suite green. Then `npx vitest run` — expected: known-failures-only, **0 NEW** failures.

- [ ] **Step 17: Final grep + build gate for the task** — Run all three:
  - `grep -n 'scPilot\.beginLeg(' src/main.js` → expected: no output (zero matches).
  - `grep -n 'scModel\.setTurnInput(-' src/main.js` → expected: no output (the live joystick negation now lives in `ShipControls.steer`; the only remaining `setTurnInput` sites in `main.js` are the `flyFromRest` probe's `(0,0)` seed at `602` and the prior-state restore at `650`, neither of which is the player steer path).
  - `npx vite build` → expected: "built in …", no errors.
  - `npx vitest run` → expected: known-failures-only, 0 new.

  This is the headless gate for Task 3. The chrome-devtools live-verify (attract tour flies + advances; manual `flyTo` arrives at the right body; F engage/disengage no-snaps with camera Δposition ≈ 0, Δquaternion ≈ 0; 0 new console errors — `well-dipper-testing-reference.md` §6.5, `:5174` worktree tab) is run by the orchestrator AFTER this gate, NOT as a step here.

- [ ] **Step 18: Commit the steer routing** — file-scoped:
  `git add src/main.js`
  `git commit -m "refactor(supercruise): route live virtual-joystick steer through ShipControls.steer (HUD deflection synced)" -- src/main.js`

---

### Task 4a: Retire `AutopilotMotion` — remove dead refs + unreachable simStep branch (file KEPT)

> **Part 4 = ONE plan task with two sub-parts (4a + 4b), not two tasks.** 4a (`AutopilotMotion` dead-ref removal) and 4b (ship-spawn disable + nav-retire + test-gating + the docs-row update) sit under a single plan task so the plan stays at four tasks. If the implementer finds Part 4 genuinely too large for one task, flag it to Max before silently expanding the plan to five tasks.

`AutopilotMotion` is fully dead in the live path: its `beginMotion` is called from exactly ONE site (`src/main.js:7793`), which is itself inside the `else if (autopilotMotion.isActive …)` simStep branch (`src/main.js:7684-7804`) — and that branch can only be entered if `autopilotMotion.isActive`, which is only ever true after a `beginMotion`. The branch self-chains with no live entry point (the supercruise mover replaced it at the 2026-06-10 cutover). This task removes every live `autopilotMotion` reference from `src/main.js`, deletes the unreachable branch + its dead `_target` telemetry fallback, and marks `src/auto/AutopilotMotion.js` retired. **The file is KEPT** (dormant for ENRICHED reactivation), only its `main.js` wiring is removed. **No behavior change** (the branch never ran).

**Files:**
- Modify: `src/main.js` — import (`:40`); instantiation (`:441`); `_getBodyVelocity` bind (`:726`); `_trackControllerCaches` (`:765-767`); telemetry `_target` fallback (`:1718-1726`); `state.autopilotMotionActive` (`:1744`); `window._autopilotMotion` (`:1758`); `stopAutopilot` guard (`:1984`); `stopFlythrough` guard + stop (`:5672,5684`); `_updateCommitBurnButton` guard term (`:6213`); the unreachable simStep branch (`:7673-7804`); `cameraController.update` guard (`:8016`); reticle-occlusion guard (`:8349`).
- Modify: `src/auto/AutopilotMotion.js` — prepend a `RETIRED` header comment (file KEPT, not deleted).
- Create: `src/flight/__tests__/autopilotMotionRetired.test.js` — static source assertion that no live `autopilotMotion` token remains in `src/main.js`.

**Interfaces:**
- Consumes: nothing from the CONTRACT (this is pure dead-ref removal; `ShipControls` from Tasks 1–3 is already wired). The live supercruise path through `controls.step(dt) → PilotFrame|null` (CONTRACT §7) and `flyTo({toBody,bodyRadius,linger?}) → Arrival` (CONTRACT §1,§6) is the ONLY motion path after this task.
- Produces: no new public surface. End state: `grep -n '\bautopilotMotion\b' src/main.js` returns ZERO matches (the global `window._autopilotMotion` exposure is removed; LabMode's `window._autopilotMotion?.…` reads in `src/debug/LabMode.js` degrade to `undefined` via optional chaining — out of this task's `src/main.js` scope, noted as a known dormancy).

**Global Constraints (this task):**
- **File-scoped commits only** — `git commit -m "…" -- <explicit paths>`; NEVER `git add -A`/`git add .` (the branch is co-touched by a separate World Engine session on `src/main.js` + `docs/NOW.md`).
- **No `npm run dev` / no server / no backgrounded process** in any step.
- Do **not** delete `src/auto/AutopilotMotion.js`. Do **not** edit `docs/NOW.md` (that is Task 4b's final step only).
- Scale-bug guard: this task touches no `SC_TUNING`/`scPilot.tuning` floor.

- [ ] **Step 1: Write the failing test** — `src/flight/__tests__/autopilotMotionRetired.test.js`

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.resolve(__dirname, '../../main.js');

// Strip // line comments and /* */ block comments so the assertion only sees
// live code. AutopilotMotion is retired (file kept, main.js wiring removed):
// the only surviving mentions are allowed to live inside comments.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (not URLs after ':')
}

describe('AutopilotMotion is retired — no live reference in main.js', () => {
  const code = stripComments(readFileSync(MAIN, 'utf8'));

  it('does not import AutopilotMotion', () => {
    expect(code).not.toMatch(/import\s*\{[^}]*\bAutopilotMotion\b[^}]*\}\s*from/);
  });

  it('does not instantiate or reference the autopilotMotion variable in live code', () => {
    expect(code).not.toMatch(/\bautopilotMotion\b/);
  });

  it('does not expose window._autopilotMotion', () => {
    expect(code).not.toMatch(/window\._autopilotMotion\s*=/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run src/flight/__tests__/autopilotMotionRetired.test.js`
  Expected: **FAIL** — all three `it`s fail (the import at `:40`, the `autopilotMotion` token at `:441` and ~13 other live sites, and `window._autopilotMotion = autopilotMotion` at `:1758` are all still present).

- [ ] **Step 3: Remove the import** — `src/main.js:40`, delete the line:

```js
import { AutopilotMotion } from './auto/AutopilotMotion.js';
```

- [ ] **Step 4: Remove the instantiation + its V1 comment** — `src/main.js:434-441`, the `const ship = new Ship();` MUST be kept (it is the shared player-ship object, still used by `cameraChoreographer.setShip(ship)` at `:742`). Only the `autopilotMotion` line and the V1 comment that introduces it are removed. Replace:

```js
// V1 STATION-hold redesign (2026-04-25) — first-class ship object +
// thin per-leg motion evaluator. AutopilotMotion replaces the
// autopilot-tour callers of NavigationSubsystem; the latter remains
// dormant for manual-burn + warp-arrival paths until those are
// scoped into a follow-on workstream. See `docs/WORKSTREAMS/
// autopilot-station-hold-redesign-2026-04-24.md`.
const ship = new Ship();
const autopilotMotion = new AutopilotMotion();
```
with:
```js
// V1 STATION-hold redesign (2026-04-25) — first-class ship object.
// (AutopilotMotion retired 2026-06-26 — supercruise mover owns all
// autopilot-tour motion; see src/auto/AutopilotMotion.js header.)
const ship = new Ship();
```

- [ ] **Step 5: Remove the `_getBodyVelocity` bind + its comment** — `src/main.js:723-726`. The `_resolveBodyVelocity` function (`:678-722`) is ONLY consumed by this bind, so its dead-now status is acceptable to leave (a pure function, no side effects) — but the bind line that references `autopilotMotion` MUST go. Replace:

```js
// Bind once — AutopilotMotion's beginMotion preserves this across
// legs (§A4 amendment to AutopilotMotion.js, beginMotion does not
// overwrite when input.getBodyVelocity is undefined).
autopilotMotion._getBodyVelocity = (out) => _resolveBodyVelocity(autopilotMotion._target, out);
```
with:
```js
// (AutopilotMotion retired 2026-06-26 — the _getBodyVelocity bind that
// fed its §A4 predicted-intercept solver is removed with it. The pure
// _resolveBodyVelocity helper above is kept dormant for reactivation.)
```

- [ ] **Step 6: Remove the `_trackControllerCaches` registration** — `src/main.js:765-767`, delete:

```js
_trackControllerCaches(autopilotMotion, [
  '_startPos', '_approachStartPos', '_holdEndpoint', '_position',
], 'autopilotMotion');
```
(The `navSubsystem` registration that follows at `:768` stays — Task 4b keeps nav wiring intact.)

- [ ] **Step 7: Remove the dead `_target` telemetry fallback** — `src/main.js:1706-1729`. The telemetry sampler resolves a target from `navSubsystem.bodyRef` first, then falls back to `autopilotMotion._target`. With AutopilotMotion gone the fallback is dead; drop it to the `else` (null). Replace:

```js
  // Target source resolution: prefer navSubsystem.bodyRef (legacy nav-driven
  // motion); fall back to autopilotMotion._target (V1 motion controller —
  // active during autopilot CRUISE / APPROACH / STATION-A). The `via` field
  // disambiguates so consumers can tell which path is sourcing the target.
  if (navBP && navSubsystem.bodyRef) {
    const bq = navSubsystem.bodyRef.quaternion;
    sample.target = {
      pos: [+navBP.x.toFixed(4), +navBP.y.toFixed(4), +navBP.z.toFixed(4)],
      quat: bq ? [+bq.x.toFixed(6), +bq.y.toFixed(6), +bq.z.toFixed(6), +bq.w.toFixed(6)]
               : [0, 0, 0, 1],
      via: 'navSubsystem',
    };
  } else if (autopilotMotion._target && autopilotMotion._target.position) {
    const tp = autopilotMotion._target.position;
    const tq = autopilotMotion._target.quaternion;
    sample.target = {
      pos: [+tp.x.toFixed(4), +tp.y.toFixed(4), +tp.z.toFixed(4)],
      quat: tq ? [+tq.x.toFixed(6), +tq.y.toFixed(6), +tq.z.toFixed(6), +tq.w.toFixed(6)]
               : [0, 0, 0, 1],
      via: 'autopilotMotion',
    };
  } else {
    sample.target = null;
  }
```
with:
```js
  // Target source resolution: navSubsystem.bodyRef (legacy nav-driven
  // manual-burn / warp-arrival motion). The AutopilotMotion._target
  // fallback was removed 2026-06-26 with that retired controller — the
  // supercruise mover's target is sourced via window._sc.controls.target.
  if (navBP && navSubsystem.bodyRef) {
    const bq = navSubsystem.bodyRef.quaternion;
    sample.target = {
      pos: [+navBP.x.toFixed(4), +navBP.y.toFixed(4), +navBP.z.toFixed(4)],
      quat: bq ? [+bq.x.toFixed(6), +bq.y.toFixed(6), +bq.z.toFixed(6), +bq.w.toFixed(6)]
               : [0, 0, 0, 1],
      via: 'navSubsystem',
    };
  } else {
    sample.target = null;
  }
```

- [ ] **Step 8: Remove the `autopilotMotionActive` telemetry field** — `src/main.js:1744`, delete the line inside the `sample.state` object:

```js
    autopilotMotionActive: autopilotMotion.isActive,
```
(Leave the surrounding `autoNavActive`, `autopilotEnabled` fields untouched.)

- [ ] **Step 9: Remove the `window._autopilotMotion` debug exposure** — `src/main.js:1757-1759`. The shared comment covers both exposures; rewrite it for `window._ship` only and drop the `autopilotMotion` line. Replace:

```js
// V1 STATION-hold redesign — debug accessors (remove after Director audit).
window._autopilotMotion = autopilotMotion;
window._ship = ship;
```
with (keep `window._ship` — `ship` survives):
```js
// V1 STATION-hold redesign — debug accessor for the shared player-ship.
window._ship = ship;
```

- [ ] **Step 10: Remove the `stopAutopilot` guard** — `src/main.js:1981-1988`. Replace:

```js
  /** Stop autopilot + autopilotMotion + supercruise pilot in one call. Used by scenario 5. */
  stopAutopilot() {
    if (autoNav.isActive) stopFlythrough();
    if (autopilotMotion.isActive) autopilotMotion.stop();
    scPilot.stop();
    setScManual(false);
    _autopilotEnabled = false;
  },
```
with:
```js
  /** Stop autopilot + supercruise pilot in one call. Used by scenario 5. */
  stopAutopilot() {
    if (autoNav.isActive) stopFlythrough();
    scPilot.stop();
    setScManual(false);
    _autopilotEnabled = false;
  },
```

- [ ] **Step 11: Remove the `stopFlythrough` guard term + stop call** — `src/main.js`. First, the early-return guard at `:5672`, replace:

```js
  if (!autoNav.isActive && !flythrough.active && !autopilotMotion.isActive && !scPilot.isActive && !(_autopilotNavSequence && _autopilotNavSequence.isActive)) return;
```
with:
```js
  if (!autoNav.isActive && !flythrough.active && !scPilot.isActive && !(_autopilotNavSequence && _autopilotNavSequence.isActive)) return;
```
Then the stop call at `:5684`, delete the line:

```js
  autopilotMotion.stop();
```
(Leave `flythrough.stop(); autoNav.stop(); shipChoreographer.stop();` above it and `scPilot.stop();` below it intact.)

- [ ] **Step 12: Remove the `_updateCommitBurnButton` guard term** — `src/main.js:6213`. Replace:

```js
  const burning = flythrough.active || warpEffect.isActive || warpTarget.turning || autopilotMotion.isActive || scPilot.isActive || _scManual;
```
with:
```js
  const burning = flythrough.active || warpEffect.isActive || warpTarget.turning || scPilot.isActive || _scManual;
```

- [ ] **Step 13: Remove the unreachable simStep branch** — `src/main.js:7672-7805`. The `if (scActive) { … }` block closes at `:7672` (`}`); the dead `else if (autopilotMotion.isActive …) { … }` runs `:7673-7804` and ends with `} else` at `:7804`, chaining into the flythrough block at `:7805`. Replace the comment block + the entire dead branch (from line `7673` through line `7804`'s `} else`) — i.e. replace:

```js
    }
    // ── V1 STATION-hold autopilot (2026-04-25) ──
    // Authoritative per-leg motion path for autopilot tour. Runs when
    // AutopilotMotion has an active leg. Cruise → 10R approach → hold;
    // body-locked station-A; auto-advances tour on motionComplete.
    // Camera looks down ship.forward (AC #5); shake composes on top
    // (AC #6 ACCEL/DECEL fires at phase boundaries).
    //
    // The legacy `flythrough.update` path (below) handles non-V1
    // callers: warp-arrival velocity-continuity + manual-burn from
    // reticle selection. V1 doesn't replicate those paths' velocity
    // semantics; retire-followup workstream migrates them.
    else if (autopilotMotion.isActive && !warpEffect.isActive && !splashActive && !titleScreenActive) {
```
...through the branch's closing `} else` at `:7804`:
```js
        }
      }
    } else
    // ── Autopilot (cinematic flythrough) ──
```
with (the `if (scActive){…}` now chains straight to the flythrough block via a single `else`):
```js
    }
    // ── Autopilot (cinematic flythrough) ──
    // (V1 AutopilotMotion simStep branch removed 2026-06-26 — the
    // supercruise mover owns all autopilot-tour motion; the dead branch
    // had no live entry point. Its sole beginMotion was the self-chaining
    // tour-advance inside the branch itself.)
    else
    // Skip idle timer during warp or title screen (title has its own 30s timer)
```
> CAUTION: this is the single biggest edit in the task. The replacement deletes lines `7685-7803` (the branch body, including the dead `autopilotMotion.beginMotion({…})` self-chain at `:7793`) and rewires the `} else` join. After the edit, the line that was `} else` followed by the flythrough comment + `if (warpEffect.isActive …)` block stays structurally identical — only the dead branch between `if (scActive)`'s close and the flythrough `if` is gone. Verify the brace balance in Step 16's build.

- [ ] **Step 14: Remove the `cameraController.update` guard term** — `src/main.js:8016`. Replace:

```js
  if (!autopilotMotion.isActive && !scPilot.isActive && !_scManual) {
    cameraController.update(deltaTime);
  }
```
with:
```js
  if (!scPilot.isActive && !_scManual) {
    cameraController.update(deltaTime);
  }
```

- [ ] **Step 15: Remove the reticle-occlusion guard term** — `src/main.js:8349`. `autopilotMotion.isActive` is ALWAYS false in the live path (the controller is dead and never armed), so the `autopilotMotion.isActive ||` disjunct is a constant `false` term. The **behavior-identical** removal (which is all Part 4a authorizes — see the AC "no live reference… no behavior change, the branch never ran") simply DROPS the dead term, collapsing the predicate to its surviving `!_isReticleOccluded(...)` form. Replace:

```js
  const _selectedForReticle = (_selectedTarget && (autopilotMotion.isActive || !_isReticleOccluded(_selectedTarget))) ? _selectedTarget : null;
```
with (drop the always-false `autopilotMotion.isActive` term ONLY — no new disjuncts):
```js
  const _selectedForReticle = (_selectedTarget && !_isReticleOccluded(_selectedTarget)) ? _selectedTarget : null;
```

> **DO NOT** substitute `scPilot.isActive || _scManual` here. That would INTRODUCE a new live "burning toward target → keep reticle visible through occlusion" behavior that did NOT exist before (because `autopilotMotion.isActive` was always false, the original predicate reduced to `!_isReticleOccluded(...)`). Adding a reticle-stays-visible-during-flight behavior is OUT OF SCOPE for Part 4a (zero behavior change). If that occlusion-skip-during-supercruise behavior is genuinely wanted, it is a separate, Max-signed-off change with its own spec entry — not part of this dead-ref retirement.

- [ ] **Step 16: Mark the file retired (KEPT)** — `src/auto/AutopilotMotion.js:1`, prepend a retirement banner ABOVE the existing `/** AutopilotMotion — V1 per-leg motion evaluator. */` JSDoc (which starts at line 1). Insert at the very top of the file:

```js
// ═══════════════════════════════════════════════════════════════════
// RETIRED 2026-06-26 (supercruise-control-harness, Tasks 12–13).
// AutopilotMotion is no longer instantiated or referenced anywhere in
// the live path — the supercruise mover (SupercruiseModel +
// SupercruisePilot, driven through ShipControls / window._sc.controls)
// owns ALL autopilot-tour, manual-flight, and warp-arrival motion.
// Its main.js wiring (import, instantiation, the unreachable simStep
// branch, telemetry fallbacks) was removed in this arc.
//
// FILE KEPT, NOT DELETED — dormant for ENRICHED reactivation. Do NOT
// re-wire into main.js without a fresh scoping pass; the §A4/§A7 lhokon
// machinery below predates the supercruise model and would conflict.
// ═══════════════════════════════════════════════════════════════════

```

- [ ] **Step 17: Run the retirement test to verify it passes** — Run: `npx vitest run src/flight/__tests__/autopilotMotionRetired.test.js`
  Expected: **PASS** — all three `it`s green (no import, no live `autopilotMotion` token, no `window._autopilotMotion =` in `src/main.js`).

- [ ] **Step 18: Run the full flight suite + build for regression** — Run: `npx vitest run src/flight` then `npx vite build`
  Expected: flight suite green (SupercruiseModel, SupercruisePilot, aimAssist, stickCurve, HeadMount, flightModes, flightExitAnchor, FlightDynamics + the new retirement test); `npx vite build` ends with `built in …` and NO errors (brace balance from Step 13 confirmed; no unresolved `AutopilotMotion` import).

- [ ] **Step 19: Commit** — file-scoped (NEVER `git add -A`):
```
git add src/main.js src/auto/AutopilotMotion.js src/flight/__tests__/autopilotMotionRetired.test.js
git commit -m "refactor(supercruise): retire AutopilotMotion — remove dead refs + unreachable simStep branch (file kept)" -- src/main.js src/auto/AutopilotMotion.js src/flight/__tests__/autopilotMotionRetired.test.js
```

---

### Task 4b: Disable NPC ship spawn + mark nav classes retired + gate ship tests + update docs (files KEPT)

Disable NPC ship spawning at the **single switch** (`shipSpawner.spawnForSystem(…)` at `src/main.js:4346`). With no spawned ships, every ship site is inert (all are gated on `shipSpawner.ships`), so the ship-lock path (`focusShip`), the `_shipScannerMode` hit-test, and the `flythrough.active` simStep branch fall out of the live path automatically. `NavigationSubsystem` + `FlythroughCamera` thereby leave the live path → mark them **retired, files KEPT, nav wiring NOT ripped out**. Gate the two browser-runtime ship integration tests behind a "ships enabled" flag so they skip cleanly instead of erroring. Update `docs/FEATURES.md` + `docs/NOW.md` ship rows. **No file deletions. No Ship Scanner port. Player-ship sharing (`shipHullToScene('player')`, `ScaleConstants.js`) untouched.**

**Files:**
- Modify: `src/main.js` — the spawn switch (`:4344-4347`); add a module-scope `SHIPS_ENABLED` flag near the spawner construction (`:141-144`); expose it on `window._lab` for the gated tests.
- Modify: `src/auto/NavigationSubsystem.js` — extend the existing `RETIRE PENDING` header to `RETIRED` (file KEPT, nav wiring in `main.js` preserved).
- Modify: `src/auto/FlythroughCamera.js` — prepend a `RETIRED` header note (file KEPT).
- Modify: `src/debug/integration-suite.js` — gate `runShipScannerInspectionTests` (`:1192`) and `runShipScannerBurnArrivalTest` (`:1535`) behind the ships-enabled flag (skip cleanly, NOT deleted).
- Modify: `docs/FEATURES.md` — ship rows (`:61` Ship Scanner, `:62` Ship NPC spawning — matching Step 12a/12b) + the §"Ship NPC spawning — disable for F&F" note (`:213-214`).
- Modify: `docs/NOW.md` — the ship-disable row (`:844`).

**Interfaces:**
- Consumes: nothing from the CONTRACT directly. `window._sc.controls` (CONTRACT §0) and `_resolveSelectedBody` ship-null guard (CONTRACT §0 `host.resolveSelectedBody`, ship-null-guarded) already firewall supercruise assist from ships — this task only confirms that firewall is unreachable-by-construction once spawn is off.
- Produces: `const SHIPS_ENABLED = false;` (module scope in `src/main.js`); `window._lab.shipsEnabled() → boolean`. The integration suite reads `window._lab.shipsEnabled()` to decide skip-vs-run.

**Global Constraints (this task):**
- **File-scoped commits only** — split into TWO commits: a code commit (`src/main.js`, the two nav files, `integration-suite.js`) and a docs-only commit (`docs/FEATURES.md` + `docs/NOW.md`). NEVER `git add -A`/`git add .`.
- **Editing `docs/FEATURES.md` / `docs/NOW.md` requires reading `~/.claude/docs/dev-collab-os.md` first** (per project CLAUDE.md) — do that before Step 11.
- Do **not** delete any file. Do **not** rip out nav wiring. Do **not** port Ship Scanner. Do **not** touch `shipHullToScene('player')` / `playerShipLengthScene` / `src/core/ScaleConstants.js` / the NavComputer "SHIP" player diamond.
- No `npm run dev` / no server / no backgrounded process.

- [ ] **Step 1: Write the failing test** — `src/flight/__tests__/shipsDisabled.test.js` (static source assertion that spawn is gated off and the flag exists)

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.resolve(__dirname, '../../main.js');

describe('NPC ship spawning is disabled at the single switch', () => {
  const code = readFileSync(MAIN, 'utf8');

  it('declares a SHIPS_ENABLED flag set to false', () => {
    expect(code).toMatch(/const\s+SHIPS_ENABLED\s*=\s*false\s*;/);
  });

  it('gates spawnForSystem behind SHIPS_ENABLED', () => {
    // The spawnForSystem call must be guarded so it cannot run while ships
    // are disabled. Assert the call is preceded by an `if (SHIPS_ENABLED)`.
    const m = code.match(/if\s*\(\s*SHIPS_ENABLED\s*\)\s*\{[\s\S]{0,400}?shipSpawner\.spawnForSystem\(/);
    expect(m, 'spawnForSystem must sit inside an `if (SHIPS_ENABLED) { … }` block').not.toBeNull();
  });

  it('exposes window._lab.shipsEnabled() for gated integration tests', () => {
    expect(code).toMatch(/shipsEnabled\s*\(\s*\)\s*\{[\s\S]{0,80}?return\s+SHIPS_ENABLED\s*;/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run src/flight/__tests__/shipsDisabled.test.js`
  Expected: **FAIL** — all three `it`s fail (no `SHIPS_ENABLED` flag, `spawnForSystem` is unguarded at `:4346`, no `shipsEnabled()` on `_lab`).

- [ ] **Step 3: Add the `SHIPS_ENABLED` flag** — `src/main.js:141-144`, after the ShipSpawner construction. Replace:

```js
// ── Ship Spawner ──
const shipSpawner = new ShipSpawner();
shipSpawner.init();  // async, loads manifest in background — non-blocking
window._shipSpawner = shipSpawner;  // exposed for integration tests (Unit 3)
```
with:
```js
// ── Ship Spawner ──
// SHIPS_ENABLED gates NPC ship spawning. DISABLED for the F&F ship arc
// (supercruise-control-harness 2026-06-26): no spawned ships → every
// ship site (all gated on shipSpawner.ships) is inert → the Ship-Scanner
// ship-lock path (focusShip / NavigationSubsystem / FlythroughCamera)
// falls out of the live path. ShipSpawner code + the NPC ship features
// are KEPT, dormant for ENRICHED reactivation — flip this to true to
// restore. See docs/FEATURES.md §"Ship NPC spawning — disable for F&F".
const SHIPS_ENABLED = false;
const shipSpawner = new ShipSpawner();
shipSpawner.init();  // async, loads manifest in background — non-blocking
window._shipSpawner = shipSpawner;  // exposed for integration tests (Unit 3)
```

- [ ] **Step 4: Gate the spawn switch** — `src/main.js:4343-4347`. Replace:

```js
  // ── Spawn flavor ships near planets ──
  {
    const shipRng = new SeededRandom(`${seed}-ships`);
    shipSpawner.spawnForSystem(scene, systemData, planets, () => shipRng.float());
  }
```
with:
```js
  // ── Spawn flavor ships near planets ──
  // Single switch: gated on SHIPS_ENABLED (DISABLED for F&F — see the
  // ShipSpawner construction). With spawn off, shipSpawner.ships stays
  // empty, so focusShip / the _shipScannerMode hit-test / the
  // flythrough.active simStep branch are all unreachable by construction.
  if (SHIPS_ENABLED) {
    const shipRng = new SeededRandom(`${seed}-ships`);
    shipSpawner.spawnForSystem(scene, systemData, planets, () => shipRng.float());
  }
```

- [ ] **Step 5: Expose `shipsEnabled()` on `window._lab`** — `src/main.js`, inside the `window._lab = { … }` object (the `setShipScannerMode` method is at `:2033`). Add immediately after the `isShipScannerMode()` method (`:2038-2041`):

```js
  /** Read current Ship Scanner mode. */
  isShipScannerMode() {
    return _shipScannerMode;
  },
```
becomes:
```js
  /** Read current Ship Scanner mode. */
  isShipScannerMode() {
    return _shipScannerMode;
  },

  /** Whether NPC ship spawning is enabled. The ship integration tests
   * gate on this so they skip cleanly when ships are disabled (F&F arc). */
  shipsEnabled() {
    return SHIPS_ENABLED;
  },
```

- [ ] **Step 6: Mark the nav classes retired (files KEPT)** — two header edits.

  (a) `src/auto/NavigationSubsystem.js:5`, extend the existing `RETIRE PENDING` JSDoc. Replace the first line of the block comment:
```js
/**
 * RETIRE PENDING (2026-04-25, Director ruling on the V1 STATION-hold
 * redesign workstream). NavigationSubsystem is no longer used for
```
with:
```js
/**
 * RETIRED 2026-06-26 (supercruise-control-harness, Tasks 12–13). The
 * remaining live callers below were the manual-burn + warp-arrival
 * paths reached via ship-lock (focusShip) and the legacy flythrough
 * branch; with NPC ship spawning DISABLED (SHIPS_ENABLED=false in
 * main.js) those entry points are unreachable. The nav wiring in
 * main.js is KEPT INTACT (not ripped out) — this file is dormant for
 * ENRICHED reactivation, NOT deleted. Do NOT extend it.
 *
 * RETIRE PENDING (2026-04-25, Director ruling on the V1 STATION-hold
 * redesign workstream). NavigationSubsystem is no longer used for
```

  (b) `src/auto/FlythroughCamera.js:3`, prepend a retirement note inside the leading JSDoc. Replace:
```js
/**
 * FlythroughCamera — orientation-authoring layer for the cinematic camera.
 *
 * Thinned 2026-04-20 per WS 1 of the V1 autopilot sequence
```
with:
```js
/**
 * FlythroughCamera — orientation-authoring layer for the cinematic camera.
 *
 * RETIRED 2026-06-26 (supercruise-control-harness, Tasks 12–13).
 * FlythroughCamera.active === navSubsystem.isActive, and with NPC ship
 * spawning DISABLED (SHIPS_ENABLED=false) the ship-lock path that drove
 * it is unreachable — the flythrough.active simStep branch is dead-weight.
 * File KEPT, wiring INTACT, dormant for ENRICHED reactivation. Not deleted.
 *
 * Thinned 2026-04-20 per WS 1 of the V1 autopilot sequence
```

- [ ] **Step 7: Gate the ship integration tests (preserve, don't delete)** — `src/debug/integration-suite.js`, add an early skip-return to each of the two ship-test functions, reading `window._lab.shipsEnabled()`.

  (a) `runShipScannerInspectionTests` (`:1192`). The function opens at `:1192-1201`:
```js
export async function runShipScannerInspectionTests() {
  if (typeof window === 'undefined' || typeof window.__wd !== 'object') {
    throw new Error('runShipScannerInspectionTests: window.__wd not installed. Enter Sol first via _lab.enterSol().');
  }
  if (!window._lab || typeof window._lab.setShipScannerMode !== 'function') {
    throw new Error('runShipScannerInspectionTests: _lab.setShipScannerMode unavailable — main.js wiring missing.');
  }
  const __wd = window.__wd;
  const _lab = window._lab;
  const results = [];
```
Insert a ships-enabled gate AFTER the `const _lab = window._lab;` line and BEFORE `const results = [];`:
```js
  const __wd = window.__wd;
  const _lab = window._lab;
  // Ships disabled for the F&F arc (SHIPS_ENABLED=false) → no NPC ships
  // exist, so this suite has nothing to assert. Skip cleanly (preserved,
  // not deleted — flip SHIPS_ENABLED to re-enable).
  if (typeof _lab.shipsEnabled === 'function' && !_lab.shipsEnabled()) {
    return {
      passed: 0, failed: 0, total: 0,
      results: [{ name: 'ship-scanner-inspection', passed: true, evidence: 'skipped — NPC ships disabled (SHIPS_ENABLED=false)' }],
    };
  }
  const results = [];
```

  (b) `runShipScannerBurnArrivalTest` (`:1535`). The function opens at `:1535-1544`:
```js
export async function runShipScannerBurnArrivalTest() {
  if (typeof window === 'undefined' || typeof window.__wd !== 'object') {
    throw new Error('runShipScannerBurnArrivalTest: window.__wd not installed.');
  }
  if (!window._lab?.selectShip || !window._lab?.commitBurnNow) {
    throw new Error('runShipScannerBurnArrivalTest: _lab.selectShip/commitBurnNow unavailable.');
  }
  const _lab = window._lab;
  const __wd = window.__wd;
  const results = [];
```
Insert the same gate AFTER `const __wd = window.__wd;` and BEFORE `const results = [];`:
```js
  const _lab = window._lab;
  const __wd = window.__wd;
  // Ships disabled for the F&F arc (SHIPS_ENABLED=false) → no NPC ship to
  // burn toward. Skip cleanly (preserved, not deleted).
  if (typeof _lab.shipsEnabled === 'function' && !_lab.shipsEnabled()) {
    return {
      passed: 0, failed: 0, total: 0,
      results: [{ name: 'ship-scanner-burn-arrival', passed: true, evidence: 'skipped — NPC ships disabled (SHIPS_ENABLED=false)' }],
    };
  }
  const results = [];
```
> The `SceneInspector.js:135-142` registrations (`runShipScannerInspectionTests` / `runShipScannerBurnArrivalTest`) are LEFT untouched — they still dispatch to these functions, which now self-skip. Preserve, don't delete.

- [ ] **Step 8: Run the ships-disabled test + build** — Run: `npx vitest run src/flight/__tests__/shipsDisabled.test.js` then `npx vite build`
  Expected: ships-disabled test **PASS** (flag declared `false`, `spawnForSystem` inside `if (SHIPS_ENABLED)`, `shipsEnabled()` on `_lab`); `npx vite build` ends with `built in …`, no errors. (The browser-runtime ship integration tests are not in the vitest suite — they're verified to skip cleanly in the Part-3 live run, where `focusShip` is invoked 0 times and the target list contains 0 ship targets.)

- [ ] **Step 9: Run the full flight suite for regression** — Run: `npx vitest run src/flight`
  Expected: green (the Task-4a retirement test, the new ships-disabled test, and all existing flight tests — SupercruiseModel/Pilot/aimAssist/stickCurve/HeadMount/flightModes/flightExitAnchor/FlightDynamics).

- [ ] **Step 10: Commit the code change** — file-scoped (NEVER `git add -A`):
```
git add src/main.js src/auto/NavigationSubsystem.js src/auto/FlythroughCamera.js src/debug/integration-suite.js src/flight/__tests__/shipsDisabled.test.js
git commit -m "refactor(supercruise): disable NPC ship spawn at single switch; mark nav classes retired; gate ship tests (files kept)" -- src/main.js src/auto/NavigationSubsystem.js src/auto/FlythroughCamera.js src/debug/integration-suite.js src/flight/__tests__/shipsDisabled.test.js
```

- [ ] **Step 11: Read the dev-collab-os doc before editing the docs** — Per project CLAUDE.md, editing `docs/FEATURES.md` / `docs/NOW.md` requires reading `~/.claude/docs/dev-collab-os.md` first. Read it now; do not skip.

- [ ] **Step 12: Update the `docs/FEATURES.md` ship rows** — three edits.

  (a) `docs/FEATURES.md:62`, the Ship NPC spawning row. Replace:
```
| Ship NPC spawning (NPC ships in systems; stochastic ~0-12 per system) | ENRICHED | shipped-code — **will be disabled for F&F ship; preserve code for ENRICHED reactivation** | — | — |
```
with:
```
| Ship NPC spawning (NPC ships in systems; stochastic ~0-12 per system) | ENRICHED | **DISABLED for F&F** (`SHIPS_ENABLED=false`, `main.js` spawn switch, supercruise-control-harness 2026-06-26) — code KEPT, dormant for ENRICHED reactivation | — | — |
```

  (b) `docs/FEATURES.md:61`, the Ship Scanner row (now effectively dormant since it depends on spawned ships). Replace:
```
| Ship Scanner (Alt-toggle, cyan reticles, burn-to-ship 45°, ship-lock orbit) | ENRICHED | shipped-code (30aa1cf) | — | — |
```
with:
```
| Ship Scanner (Alt-toggle, cyan reticles, burn-to-ship 45°, ship-lock orbit) | ENRICHED | shipped-code (30aa1cf) — **dormant in F&F** (depends on NPC spawning, disabled 2026-06-26); `NavigationSubsystem`/`FlythroughCamera` retired, files kept | — | — |
```

  (c) `docs/FEATURES.md:213-214`, the §"Ship NPC spawning — disable for F&F" note. Replace the final sentence:
```
Feature is NPC-ships-in-systems = ENRICHED tier. **Action item before F&F ship:** disable spawn (likely gate behind URL param or settings flag, or remove ShipSpawner instantiation from `main.js`); preserve code for ENRICHED reactivation later.
```
with:
```
Feature is NPC-ships-in-systems = ENRICHED tier. **DONE 2026-06-26** (supercruise-control-harness): spawn disabled at the single switch — `const SHIPS_ENABLED = false` gates the `shipSpawner.spawnForSystem(…)` call in `main.js`. With spawn off, `focusShip` / the `_shipScannerMode` hit-test / the `flythrough.active` simStep branch are unreachable by construction (all gated on `shipSpawner.ships`), so `NavigationSubsystem` + `FlythroughCamera` are marked retired (files KEPT, nav wiring intact). ShipSpawner code + NPC ship features preserved for ENRICHED reactivation — flip `SHIPS_ENABLED` to restore. Player-ship sharing (`shipHullToScene('player')`, `ScaleConstants.js`) untouched.
```

- [ ] **Step 13: Update the `docs/NOW.md` ship-disable row** — `docs/NOW.md:844`. Replace:
```
- **Ship NPC spawning disable for F&F** — `ShipSpawner` turned off before F&F ship; preserve code for ENRICHED reactivation. Small follow-up workstream; not yet scoped.
```
with:
```
- **Ship NPC spawning disable for F&F** — DONE 2026-06-26 (supercruise-control-harness): `SHIPS_ENABLED=false` gates the `main.js` spawn switch; `AutopilotMotion`/`NavigationSubsystem`/`FlythroughCamera` marked retired (files KEPT, nav wiring intact); ship integration tests gated behind `_lab.shipsEnabled()` (skip cleanly). Code preserved for ENRICHED reactivation.
```

- [ ] **Step 14: Commit the docs change** — docs-scoped, SEPARATE from the code commit (NEVER `git add -A`):
```
git add docs/FEATURES.md docs/NOW.md
git commit -m "docs(supercruise): record NPC ship spawn disabled + nav classes retired (F&F arc)" -- docs/FEATURES.md docs/NOW.md
```
