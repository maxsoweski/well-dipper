// src/flight/__tests__/SupercruiseStallCapRelative.test.js
//
// tour-reliability-corrections-2026-07-01 — AC1-stall-criterion-cap-relative.
// The WS-1 CRUISE stall detector used to compare progress against a quota fixed
// at CRUISE leg-entry (2% of the leg's INITIAL distance). That quota is scale-
// blind: near a body the achievable speed collapses (speedCap() shrinks toward
// its floor), so a converging leg's terminal crawl could never beat an
// absolute quota sized off the leg's opening distance — every long leg was
// aborted just short of arrival (measured: a 15,387u leg killed 2.7u from the
// target; see docs/WORKSTREAMS/autopilot-standoff-routing-2026-07-01/triage/).
//
// The corrected detector judges progress against what the CURRENT speedCap()
// permits, not the leg's own scale. These tests hand-build the three
// regimes named in the contract (AC1a/b/c) with fresh, real
// SupercruiseModel + SupercruisePilot instances — no formula-mirroring: each
// scenario is a physical setup (bodies, positions, orientation) and the
// assertions read the pilot's real output, not a re-derivation of its math.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase } from '../SupercruisePilot.js';

const DT = 1 / 60;
const NEG_Z = new THREE.Vector3(0, 0, -1);

describe('SupercruisePilot — CRUISE stall detector is cap-relative (tour-reliability-corrections RC1)', () => {
  it('AC1(a) — a converging leg is NEVER aborted through its terminal crawl near a body (reproduces the moon5.4 kill geometry)', () => {
    // Multi-thousand-unit leg to a small body (reproduces the measured
    // 15,387u leg to a small moon whose gravity well collapses the cap near
    // arrival). Ship starts on-axis (default orientation faces -Z, straight
    // at the target), so ALIGN clears in one frame and CRUISE runs the whole
    // approach — including the terminal crawl where absolute speed drops to
    // a small fraction of a u/s well before capture.
    const model = new SupercruiseModel();
    const bodyR = 0.005;
    const initDist = 15387;
    const bodyMesh = { position: new THREE.Vector3(0, 0, -initDist) };
    model.position.set(0, 0, 0);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: bodyMesh, bodyRadius: bodyR, linger: 1 });

    // Diagnostic ONLY (not part of the pilot): replays the OLD, now-removed
    // "2% of the leg's initial distance per CRUISE_STALL_WINDOW" quota
    // alongside the real run, to prove this scenario genuinely reproduces
    // the old bug's conditions — without re-implementing that formula in
    // production code.
    let oldBest = Infinity, oldStallTimer = 0, oldWouldHaveAborted = false;
    const oldNeed = initDist * 0.02;

    let sawAbort = false, complete = false, i = 0;
    const maxSteps = 60 * 90;
    for (; i < maxSteps && complete === false; i++) {
      model.setBodies([{ position: bodyMesh.position, radius: bodyR }]);
      const frame = pilot.update(DT);
      model.update(DT);
      if (frame.stallAborted) { sawAbort = true; break; }
      if (frame.phase === PilotPhase.CRUISE) {
        const dist = model.position.distanceTo(bodyMesh.position);
        if (dist < oldBest - oldNeed) { oldBest = dist; oldStallTimer = 0; }
        else {
          oldStallTimer += DT;
          if (oldStallTimer >= 12.0) oldWouldHaveAborted = true;
        }
      }
      if (frame.motionComplete) complete = true;
    }

    // The scenario really does reproduce the old failure's conditions —
    // the deleted absolute quota would have tripped on this exact run.
    expect(oldWouldHaveAborted).toBe(true);
    // ...but the corrected, cap-relative detector never aborts it, and the
    // leg genuinely reaches HOLD.
    expect(sawAbort).toBe(false);
    expect(complete).toBe(true);
    expect(pilot.phase).toBe(PilotPhase.HOLD);
  });

  it('AC1(b) — aborts when pinned at a collision barrier while the well still permits meaningfully more speed', () => {
    // Ship, a mid-sized obstacle, and the real target are colinear (star-
    // wedge geometry): the ship rams the obstacle's collision barrier while
    // chasing a target far beyond it. The obstacle's OWN gravity floor sets
    // a non-trivial local cap even while the ship sits pinned at speed 0 —
    // exactly the "barrier-pinned, cap >= floor" case named in the contract.
    const model = new SupercruiseModel();
    const obstacle = { position: new THREE.Vector3(0, 0, 0), radius: 4.65 };
    const targetMesh = { position: new THREE.Vector3(0, 0, -1000) };
    const targetR = 5;
    model.position.set(0, 0, 50);
    const dir = new THREE.Vector3().subVectors(targetMesh.position, model.position).normalize();
    model.orientation.setFromUnitVectors(NEG_Z, dir);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: targetMesh, bodyRadius: targetR, linger: 1 });

    let aborted = false, capAtAbort = null, speedJustBeforeAbort = null, i = 0;
    const maxSteps = 60 * 40;
    for (; i < maxSteps; i++) {
      model.setBodies([obstacle, { position: targetMesh.position, radius: targetR }]);
      speedJustBeforeAbort = model.speed;
      const frame = pilot.update(DT);
      if (frame.stallAborted) {
        capAtAbort = model.speedCap();
        aborted = true;
        model.update(DT);
        break;
      }
      model.update(DT);
    }

    expect(aborted).toBe(true);                         // fires within the window (+ travel-to-barrier time)
    expect(pilot.phase).toBe(PilotPhase.IDLE);
    expect(speedJustBeforeAbort).toBeCloseTo(0, 6);      // genuinely pinned, not merely slow
    expect(capAtAbort).toBeGreaterThan(0.1);             // the well permitted real motion — this wasn't a dead cap
  });

  it('AC1(c) — aborts a fast-orbiting-moon leg that never converges, even though the cap stays high', () => {
    // Moon whipping around the origin fast enough that a no-lead pursuit
    // pilot never closes on it — dist-to-target stays flat/oscillating while
    // the gravity-well cap (dominated by the moon's own modest floor, never
    // collapsed toward zero the way a true terminal-crawl capture would) stays
    // well above any "stuck" reading.
    const model = new SupercruiseModel();
    const moonR = 5;
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

    let aborted = false, capAtAbort = null, i = 0;
    const maxSteps = 60 * 45;
    for (; i < maxSteps; i++) {
      ang += omega * DT; place();
      model.setBodies([{ position: moonMesh.position, radius: moonR }]);
      const frame = pilot.update(DT);
      if (frame.stallAborted) { capAtAbort = model.speedCap(); aborted = true; model.update(DT); break; }
      model.update(DT);
    }

    expect(aborted).toBe(true);
    expect(pilot.phase).toBe(PilotPhase.IDLE);
    expect(capAtAbort).toBeGreaterThan(20); // the well permitted fast cruise — non-convergence, not a genuine crawl
  });
});
