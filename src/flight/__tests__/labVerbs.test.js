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
    expect(out.pitch).toBeCloseTo(0, 6); // escape must not corrupt pitch
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

// ── Step 5: shaped-stick casing reconcile (the bug steer() fixes) ──
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

// ── Step 8: named PilotFrame contract + headless flyTo arrival driver ──
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
    // Exact key set (not just "present") so a leaked/renamed field is caught.
    expect(Object.keys(frame).sort()).toEqual([...PILOT_FRAME_FIELDS].sort());
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
