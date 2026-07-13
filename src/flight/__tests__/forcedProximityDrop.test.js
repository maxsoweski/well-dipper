// Pure predicate for tour-body-reachability-2026-07-05, Defect 2 (drive-drop
// near big stars). The "forced proximity drop-out" (main.js:8333) is a HANDS-ON
// affordance — near a star the drive drops so the player hands off to sublight —
// but there is NO hands-off drive re-arm (R is inert hands-off, main.js:9780).
// So firing it while the AUTOPILOT owns the throttle strands the ship at
// throttle*SUBLIGHT_CAP = 0.75*0.002 = 0.0015 u/s and the tour dies.
//
// forcedProximityDropAllowed decides whether the forced drop MAY fire, from the
// regime only. Autopilot owns the throttle when a pilot leg OR a tour is active
// AND we are not in player-directed ASSIST. In that case the drop is suppressed;
// otherwise (hands-on manual, or ASSIST) it fires as before.
//
// These are HAND-BUILT expectations, independent of the implementation formula,
// so a regression in the gate fails loudly. (Red-team attack #8: this is the ONLY
// hand-oracle for Defect 2 — the main.js wiring is proven by the live AC3 drive.)
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { forcedProximityDropAllowed, FlightMode } from '../flightModes.js';
import { SupercruiseModel, SC_TUNING } from '../SupercruiseModel.js';
import { starMassKgFromSceneRadius, forcedDropRadiusScene } from '../proximityHorizon.js';

describe('forcedProximityDropAllowed — the forced drive-drop yields while the autopilot owns the throttle', () => {
  it('hands-on MANUAL flight near a star: drop FIRES (the player affordance is preserved)', () => {
    expect(forcedProximityDropAllowed({
      scManual: true, pilotActive: false, tourActive: false, flightMode: FlightMode.MANUAL,
    })).toBe(true);
  });

  it('HELM tour (pilot + tour active, not ASSIST): drop SUPPRESSED — the core fix', () => {
    expect(forcedProximityDropAllowed({
      scManual: true, pilotActive: true, tourActive: true, flightMode: FlightMode.MANUAL,
    })).toBe(false);
  });

  it('between-leg degenerate frame (tour active, pilot momentarily inactive): still SUPPRESSED (belt-and-suspenders via tourActive)', () => {
    expect(forcedProximityDropAllowed({
      scManual: true, pilotActive: false, tourActive: true, flightMode: FlightMode.MANUAL,
    })).toBe(false);
  });

  it('player-directed ASSIST near a star: drop FIRES (preserved — Assist keeps its graceful stall-dropout)', () => {
    expect(forcedProximityDropAllowed({
      scManual: true, pilotActive: true, tourActive: false, flightMode: FlightMode.ASSIST,
    })).toBe(true);
  });

  it('autopilot fly-in with autoNav inactive (Z-coast -> warp fly-in, red-team attack #2): SUPPRESSED via pilotActive', () => {
    expect(forcedProximityDropAllowed({
      scManual: true, pilotActive: true, tourActive: false, flightMode: FlightMode.MANUAL,
    })).toBe(false);
  });

  it('ORRERY (scManual false): NEVER fires, whatever the pilot/tour/mode', () => {
    for (const pilotActive of [true, false]) {
      for (const tourActive of [true, false]) {
        for (const flightMode of [FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST]) {
          expect(forcedProximityDropAllowed({ scManual: false, pilotActive, tourActive, flightMode })).toBe(false);
        }
      }
    }
  });

  it('invariant: result === scManual && !((pilotActive||tourActive) && flightMode!==ASSIST) across the full grid', () => {
    for (const scManual of [true, false]) {
      for (const pilotActive of [true, false]) {
        for (const tourActive of [true, false]) {
          for (const flightMode of [FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST]) {
            const autopilotOwns = (pilotActive || tourActive) && flightMode !== FlightMode.ASSIST;
            const expected = scManual && !autopilotOwns;
            expect(forcedProximityDropAllowed({ scManual, pilotActive, tourActive, flightMode })).toBe(expected);
          }
        }
      }
    }
  });

  it('missing args default safely (no throw, no accidental true)', () => {
    expect(forcedProximityDropAllowed()).toBe(false);
    expect(forcedProximityDropAllowed({})).toBe(false);
  });
});

// Model-level cause/effect (no host): proves WHY the gate matters. At a
// runtime-representative BIG star (radius 8.0 = the O-star mapRadius — NOT a
// fantasy solarRadiiToScene(12) horizon no generated star produces), an inbound
// ship inside the forced-drop horizon that has its drive turned OFF is stranded
// at the ~0.0015 u/s sublight crawl and the leg never closes; keeping the drive
// ON lets it track the gravity-well cap and cross the leg. The fix keeps the
// drive ON for the autopilot, so the ON branch is the post-fix behavior.
describe('drive-drop is the crawl CAUSE at a runtime-representative big star', () => {
  const DT = 1 / 60;
  const R = 8.0; // O-star mapRadius
  const massKg = starMassKgFromSceneRadius(R);
  const dropDist = Math.max(SC_TUNING.FORCED_DROP_FLOOR_FACTOR * R, forcedDropRadiusScene(massKg, SC_TUNING.SUBLIGHT_CAP));
  const startDist = 0.9 * dropDist; // just INSIDE the forced-drop horizon
  const ORIGIN = new THREE.Vector3(0, 0, 0);

  const makeModel = () => {
    const m = new SupercruiseModel();
    m.setBodies([{ position: new THREE.Vector3(0, 0, 0), radius: R, massKg }]);
    m.position.set(0, 0, startDist); // on +Z; default nose (-Z) points at the star → INBOUND
    return m;
  };

  it('setup is valid: ship starts inbound inside the horizon and well outside the collision barrier', () => {
    expect(startDist).toBeGreaterThan(SC_TUNING.COLLISION_FACTOR * R * 2); // not touching the barrier
    // Non-vacuous: the forced drop WOULD fire here — this is exactly the
    // condition the fix suppresses for the autopilot.
    expect(makeModel().proximityDropRequired()).toBe(true);
  });

  it('drive OFF (today, when the forced drop fires mid-tour): sublight crawl, the leg does not close', () => {
    const m = makeModel();
    m.setDrive(false);
    m.setThrottle(0.75);
    for (let i = 0; i < 60; i++) m.update(DT); // 1 s
    expect(Math.abs(m.speed)).toBeLessThan(SC_TUNING.SUBLIGHT_CAP * 1.01); // ≈ 0.0015 crawl
    expect(startDist - m.position.distanceTo(ORIGIN)).toBeLessThan(0.01);  // essentially frozen
  });

  it('drive ON (the fix — autopilot keeps the drive): tracks the gravity-well cap, the leg closes many units', () => {
    const m = makeModel();
    m.setDrive(true);
    m.setThrottle(0.75);
    for (let i = 0; i < 60; i++) m.update(DT); // 1 s
    expect(Math.abs(m.speed)).toBeGreaterThan(SC_TUNING.SUBLIGHT_CAP * 100); // >> sublight
    expect(startDist - m.position.distanceTo(ORIGIN)).toBeGreaterThan(1.0);  // real progress
  });
});
