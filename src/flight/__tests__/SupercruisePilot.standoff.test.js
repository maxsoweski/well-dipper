// src/flight/__tests__/SupercruisePilot.standoff.test.js
//
// Increment 1 (autopilot-standoff-routing-2026-07-01) — the pilot honors a
// per-leg standoff hold distance (AC4) and legs with no standoff are byte-for-
// byte today's 2.6R hold (AC5). Fresh SupercruiseModel + SupercruisePilot per
// the SupercruisePilot.align.test.js pattern; NO SC_TUNING touched.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase, PILOT_TUNING } from '../SupercruisePilot.js';

const DT = 1 / 60;

describe('SupercruisePilot — per-leg standoff hold (AC4)', () => {
  it('captures and holds at the supplied standoff S (>> 2.6R), not the default', () => {
    const model = new SupercruiseModel();
    const R = 4.65;                 // representative G-star radius
    const S = 8 * R;                // = 37.2 — the min(8R, 0.6*innerOrbit) star standoff
    const starMesh = { position: new THREE.Vector3(0, 0, 0) };
    // Ship far out on +Z facing the star (default −Z nose points at the origin).
    model.position.set(0, 0, 300);
    const pilot = new SupercruisePilot(model);
    // linger 4 s so the HOLD exponential settle (~3τ = 1.8 s) fully converges to
    // the hold point before motionComplete fires — then the measured distance is
    // the true held distance, not a mid-settle sample.
    pilot.beginLeg({ toBody: starMesh, bodyRadius: R, linger: 4, standoff: S });

    let reachedHold = false, complete = false, i = 0;
    for (; i < 60 * 40; i++) {
      model.setBodies([{ position: starMesh.position, radius: R }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (pilot.phase === PilotPhase.HOLD) reachedHold = true;
      if (frame.motionComplete) { complete = true; break; }
    }

    expect(reachedHold).toBe(true);
    expect(complete).toBe(true);
    const held = model.position.distanceTo(starMesh.position);
    // Held at ~S (37.2), NOT the default 2.6R (12.09). Capture tolerance.
    expect(held).toBeGreaterThan(S - 2);
    expect(held).toBeLessThan(S + 2);
    // Safely outside the 2.5R crawl-onset and 1.05R barrier — never pinned.
    expect(held).toBeGreaterThan(2.5 * R);
  });

  it('outward-settle: a standoff BEYOND the drop radius (12R > 10R) still holds at ~S', () => {
    // DROP_RADIUS_FACTOR = 10, so the capture sphere is 10R. A standoff of 12R
    // sits OUTSIDE that sphere: the ship flies in to capture at ~10R, then the
    // HOLD exponential settle eases OUTWARD to the 12R hold point. Exercises the
    // outward branch of the settle (the star case, 8R, settles inward instead).
    const model = new SupercruiseModel();
    const R = 4.65;
    const S = 12 * R; // = 55.8, beyond the 10R (46.5) drop radius
    const starMesh = { position: new THREE.Vector3(0, 0, 0) };
    model.position.set(0, 0, 400);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: starMesh, bodyRadius: R, linger: 4, standoff: S });

    let reachedHold = false, complete = false, i = 0;
    for (; i < 60 * 50; i++) {
      model.setBodies([{ position: starMesh.position, radius: R }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (pilot.phase === PilotPhase.HOLD) reachedHold = true;
      if (frame.motionComplete) { complete = true; break; }
    }

    expect(reachedHold).toBe(true);
    expect(complete).toBe(true);
    const held = model.position.distanceTo(starMesh.position);
    // Settled OUTWARD to ~S (55.8), not left at the ~10R (46.5) capture point.
    expect(held).toBeGreaterThan(S - 2);
    expect(held).toBeLessThan(S + 2);
  });

  it('with NO standoff supplied, holds at exactly 2.6R (today\'s behavior, unchanged)', () => {
    const model = new SupercruiseModel();
    const R = 5;
    const planetMesh = { position: new THREE.Vector3(0, 0, 0) };
    model.position.set(0, 0, 400);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: planetMesh, bodyRadius: R, linger: 4 }); // no standoff, linger 4 to settle

    let complete = false, i = 0;
    for (; i < 60 * 40; i++) {
      model.setBodies([{ position: planetMesh.position, radius: R }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (frame.motionComplete) { complete = true; break; }
    }
    expect(complete).toBe(true);
    const held = model.position.distanceTo(planetMesh.position);
    const expected = R * PILOT_TUNING.HOLD_VIEW_FRAC; // 2.6R = 13
    expect(held).toBeGreaterThan(expected - 1);
    expect(held).toBeLessThan(expected + 1);
  });
});

describe('SupercruisePilot — clear leg is unchanged (AC5)', () => {
  it('a no-standoff leg progresses ALIGN->CRUISE->HOLD->motionComplete with 2.6R hold and no stall', () => {
    const model = new SupercruiseModel();
    const R = 5;
    const planetMesh = { position: new THREE.Vector3(0, 0, -5000) };
    model.position.set(0, 0, 0); // default −Z nose is already on-axis
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: planetMesh, bodyRadius: R, linger: 4 });

    // Record the ENTRY phase that drove each frame (frame.phase) — an on-axis
    // ALIGN transitions to CRUISE within its own first update, so pilot.phase
    // read after update() would miss ALIGN; frame.phase reports it.
    const seen = [];
    let sawAbort = false, complete = false, i = 0;
    for (; i < 60 * 60; i++) {
      model.setBodies([{ position: planetMesh.position, radius: R }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (seen[seen.length - 1] !== frame.phase) seen.push(frame.phase);
      if (frame.stallAborted) sawAbort = true;
      if (frame.motionComplete) { complete = true; break; }
    }

    expect(sawAbort).toBe(false);
    expect(complete).toBe(true);
    // Phase sequence: ALIGN → CRUISE → HOLD (exact, in order).
    expect(seen).toEqual([PilotPhase.ALIGN, PilotPhase.CRUISE, PilotPhase.HOLD]);
    const held = model.position.distanceTo(planetMesh.position);
    expect(held).toBeGreaterThan(R * PILOT_TUNING.HOLD_VIEW_FRAC - 1);
    expect(held).toBeLessThan(R * PILOT_TUNING.HOLD_VIEW_FRAC + 1);
  });
});

describe('SupercruisePilot — position (waypoint) target (go-around plumbing)', () => {
  it('flies to a fixed point target (no mesh), reaches HOLD and completes (linger 0 pass-through)', () => {
    const model = new SupercruiseModel();
    // Mirror the real go-around geometry: the go-around waypoint sits just
    // outside the star keep-out sphere, so the STAR's gravity well caps the
    // ship's speed near the waypoint and lets it capture. (In empty space with
    // no mass there is nothing to slow a CRUISE pass — that is by design.)
    const R = 4.65;
    const star = { position: new THREE.Vector3(0, 0, 0), radius: R };
    const W = new THREE.Vector3(45, 0, 0); // ~just outside the ~37-u keep-out
    model.position.set(45, 0, 300);        // on-axis: default −Z nose aims at W
    const pilot = new SupercruisePilot(model);
    // Waypoint: generous radius so capture is reachable, linger 0 = pass-through.
    pilot.beginLeg({ toPosition: W, bodyRadius: 10, linger: 0 });
    // The pilot must accept a position target (no mesh) and expose it.
    expect(pilot._target).toBeTruthy();
    expect(pilot._target.mesh.position.equals(W)).toBe(true);

    const startDist = model.position.distanceTo(W);
    let reachedHold = false, complete = false, sawAbort = false, i = 0;
    for (; i < 60 * 60; i++) {
      model.setBodies([star]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (pilot.phase === PilotPhase.HOLD) reachedHold = true;
      if (frame.stallAborted) sawAbort = true;
      if (frame.motionComplete) { complete = true; break; }
    }
    expect(sawAbort).toBe(false);
    expect(reachedHold).toBe(true);
    expect(complete).toBe(true);
    // Made real progress toward the waypoint (did not wedge/stall).
    expect(model.position.distanceTo(W)).toBeLessThan(startDist);
  });
});
