// src/flight/__tests__/SupercruiseStall.test.js
//
// WS-1 — CRUISE stall-detector / no-freeze guard.
// The pilot's CRUISE phase has no timeout (only ALIGN does). A leg whose
// straight path is blocked by the star (wedge), or that chases a moon orbiting
// too fast to catch, stays in CRUISE forever and the tour never advances
// (flight-audit 2026-06-30 Phase 2/3). These tests pin the detector: it aborts
// a non-converging CRUISE leg (frame.stallAborted + phase leaves CRUISE), while
// NEVER touching a genuinely-converging leg or a deliberate HOLD park.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase } from '../SupercruisePilot.js';

const DT = 1 / 60;
const NEG_Z = new THREE.Vector3(0, 0, -1);

describe('SupercruisePilot — CRUISE stall-detector (WS-1)', () => {
  it('AC1 — aborts a star-wedged leg (dist pinned behind the star) within the stall window', () => {
    const model = new SupercruiseModel();
    const star = { position: new THREE.Vector3(0, 0, 0), radius: 4.65 };
    const planetMesh = { position: new THREE.Vector3(0, 0, -1000) };
    const planetR = 5;
    // Ship on the FAR side of the star from the planet, on the star->planet axis
    // (antipodal wedge): its straight nose-line to the planet passes through the star.
    model.position.set(0, 0, 50);
    const dir = new THREE.Vector3().subVectors(planetMesh.position, model.position).normalize();
    model.orientation.setFromUnitVectors(NEG_Z, dir);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: planetMesh, bodyRadius: planetR, linger: 1 });

    const maxSteps = Math.ceil(30 * 60);
    let aborted = false, i = 0;
    for (; i < maxSteps; i++) {
      model.setBodies([star, { position: planetMesh.position, radius: planetR }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (frame.stallAborted) { aborted = true; break; }
    }

    expect(aborted).toBe(true);
    expect(pilot.phase).toBe(PilotPhase.IDLE);
    // It really was wedged near the star, not captured at the planet.
    expect(model.position.distanceTo(planetMesh.position)).toBeGreaterThan(planetR * 10);
  });

  it('AC2 — never aborts a genuinely converging leg (reaches HOLD + motionComplete, no false stall)', () => {
    const model = new SupercruiseModel();
    const planetMesh = { position: new THREE.Vector3(0, 0, -5000) };
    const planetR = 5;
    model.position.set(0, 0, 0);           // default orientation faces -Z, straight at the planet
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: planetMesh, bodyRadius: planetR, linger: 1 });

    let sawAbort = false, reachedHold = false, complete = false, i = 0;
    for (; i < 60 * 60; i++) {
      model.setBodies([{ position: planetMesh.position, radius: planetR }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (frame.stallAborted) sawAbort = true;
      if (pilot.phase === PilotPhase.HOLD) reachedHold = true;
      if (frame.motionComplete) { complete = true; break; }
    }

    expect(sawAbort).toBe(false);
    expect(reachedHold).toBe(true);
    expect(complete).toBe(true);
  });

  it('AC3 — never aborts a deliberate HOLD park (linger:Infinity) — detector keys on CRUISE only', () => {
    const model = new SupercruiseModel();
    const planetMesh = { position: new THREE.Vector3(0, 0, -5000) };
    const planetR = 5;
    model.position.set(0, 0, 0);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: planetMesh, bodyRadius: planetR, linger: Infinity });

    let sawAbort = false, sawComplete = false, i = 0;
    for (; i < 40 * 60; i++) {
      model.setBodies([{ position: planetMesh.position, radius: planetR }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (frame.stallAborted) sawAbort = true;
      if (frame.motionComplete) sawComplete = true;
    }

    expect(sawAbort).toBe(false);
    expect(sawComplete).toBe(false);            // linger:Infinity never completes
    expect(pilot.phase).toBe(PilotPhase.HOLD);  // parked in HOLD at the end, not aborted
  });

  it('AC5 — aborts a fast-orbiting-moon leg the pure-pursuit pilot cannot capture', () => {
    const model = new SupercruiseModel();
    const moonR = 5;
    // Moon whipping around the origin at radius 150, omega 0.3 rad/s (the fast-orbit
    // regime where a no-lead pursuit pilot never closes -> perpetual CRUISE).
    let ang = Math.PI / 2;
    const orbit = 150, omega = 0.3;
    const moonMesh = { position: new THREE.Vector3() };
    const place = () => moonMesh.position.set(orbit * Math.sin(ang), 0, -orbit * Math.cos(ang));
    place();
    model.position.set(0, 0, 3000);
    const dir = new THREE.Vector3().subVectors(moonMesh.position, model.position).normalize();
    model.orientation.setFromUnitVectors(NEG_Z, dir);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: moonMesh, bodyRadius: moonR, linger: 1 });

    const maxSteps = Math.ceil(30 * 60);
    let aborted = false, i = 0;
    for (; i < maxSteps; i++) {
      ang += omega * DT; place();
      model.setBodies([{ position: moonMesh.position, radius: moonR }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (frame.stallAborted) { aborted = true; break; }
    }

    expect(aborted).toBe(true);
    expect(pilot.phase).toBe(PilotPhase.IDLE);
  });
});
