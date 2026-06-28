import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel, SC_TUNING } from '../SupercruiseModel.js';

const DT = 1 / 60;

function stepN(m, n, dt = DT) {
  for (let i = 0; i < n; i++) m.update(dt);
}

describe('SupercruiseModel — drive-idle / drop-to-rest (AC1)', () => {
  it('driveOn defaults to true (back-compat)', () => {
    const m = new SupercruiseModel();
    expect(m.driveOn).toBe(true);
  });

  it('setDrive toggles driveOn', () => {
    const m = new SupercruiseModel();
    m.setDrive(false);
    expect(m.driveOn).toBe(false);
    m.setDrive(true);
    expect(m.driveOn).toBe(true);
  });

  it('engage accelerates toward the capped target in open space', () => {
    const m = new SupercruiseModel(); // no bodies → cap = CAP_MAX
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    expect(m.speed).toBeGreaterThan(0);
  });

  it('drop-out settles to REST fast (does NOT preserve momentum)', () => {
    // Reversed 2026-06-27: drop → rest, no longer a momentum-preserving coast.
    const m = new SupercruiseModel(); // open space
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    const v = m.speed;
    expect(v).toBeGreaterThan(0);
    m.setDrive(false);
    m.setThrottle(0);
    m.update(DT);
    // One frame of SUBLIGHT_TAU=0.4 decay loses ~4% (k≈0.041) — clearly bleeding off,
    // not preserved. Assert it has already started shedding momentum.
    expect(m.speed).toBeLessThan(v);
    expect(m.speed).toBeLessThan(v * Math.exp(-DT / SC_TUNING.SUBLIGHT_TAU) + 1e-9);
  });

  it('drop-out from cruising speed sheds ≈all momentum within ~1.5s (much faster than the old 8s coast)', () => {
    const m = new SupercruiseModel(); // open space, nothing to park us
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    const cruise = m.speed;
    expect(cruise).toBeGreaterThan(0);
    m.setDrive(false);
    stepN(m, 90); // 1.5 s of drop decay: exp(-1.5/0.4) ≈ 2.35% remains (~98% gone)
    expect(m.speed / cruise).toBeLessThan(0.03);
    // Old COAST_TAU=8 would still retain exp(-1.5/8) ≈ 0.83 of cruise — orders of magnitude more.
    expect(m.speed / cruise).toBeLessThan(Math.exp(-1.5 / 8));
  });

  it('drop-out still moves position forward briefly while settling (open space)', () => {
    const m = new SupercruiseModel();
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    m.setDrive(false);
    const p0 = m.position.clone();
    stepN(m, 5); // a few frames before it fully settles
    expect(m.position.distanceTo(p0)).toBeGreaterThan(0);
  });

  it('drop-out HONORS throttle at the sublight cap (settles toward throttle×SUBLIGHT_CAP, not the SC cap)', () => {
    const m = new SupercruiseModel();
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 60);
    const v = m.speed;                 // cruising fast
    m.setDrive(false);                 // dropped out, throttle LEFT at 1
    stepN(m, 600);                     // ~10s — bridges ~7 decades from cruise to the tiny cap
    // It sheds the huge cruise speed and lands on the tiny sublight cap — NOT 0,
    // NOT the supercruise cap. (In practice the E-key zeroes throttle on dropout.)
    expect(m.speed).toBeLessThan(v);
    expect(m.speed).toBeCloseTo(SC_TUNING.SUBLIGHT_CAP, 6);
  });

  it('near a body, speedCap parks you even while settling to rest', () => {
    const m = new SupercruiseModel();
    const body = { position: new THREE.Vector3(0, 0, 0), radius: 5 };
    m.setBodies([body]);
    m.position.set(body.radius + 0.1, 0, 0); // hugging the surface
    m.speed = 1000;                          // arrive fast
    m.setDrive(false);                       // dropped out (settling)
    m.update(DT);
    const cap = m.speedCap();
    expect(m.speed).toBeLessThanOrEqual(cap + 1e-9); // clamped to the well cap = parked
  });

  it('anti-clip: re-engaging with nose toward a near body cannot exceed the cap (~parked)', () => {
    const m = new SupercruiseModel();
    const body = { position: new THREE.Vector3(0, 0, 0), radius: 5 };
    m.setBodies([body]);
    m.position.set(body.radius + 0.1, 0, 0);
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // nose toward -x ≈ body
    m.speed = 0;
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 120);
    const cap = m.speedCap();
    expect(m.speed).toBeLessThanOrEqual(cap + 1e-9);
  });
});

describe('SupercruiseModel — minimum-cruise floor (drive ON)', () => {
  it('(a) throttle 0 far from bodies settles to MIN_CRUISE (cannot stop in SC)', () => {
    const m = new SupercruiseModel(); // no bodies → cap = CAP_MAX ≫ MIN_CRUISE
    m.setDrive(true);
    m.setThrottle(0);
    stepN(m, 1800); // 30 s — well past the ACCEL_TAU settle, lands on the floor
    expect(m.speed).toBeCloseTo(SC_TUNING.MIN_CRUISE, 5);
    expect(m.speed).toBeGreaterThan(0); // never crawls to a stop
  });

  it('(a2) throttle 0 from a fast start decays DOWN to the MIN_CRUISE floor, not to 0', () => {
    const m = new SupercruiseModel();
    m.setDrive(true);
    m.setThrottle(0);
    m.speed = 1000; // arrive fast, throttle now 0
    stepN(m, 1800);
    expect(m.speed).toBeCloseTo(SC_TUNING.MIN_CRUISE, 5);
  });

  it('(b) near a body where cap < MIN_CRUISE, the cap WINS so capture survives (speed below the floor)', () => {
    const m = new SupercruiseModel();
    // Small body so its cap near the surface is below the cruise floor.
    const body = { position: new THREE.Vector3(0, 0, 0), radius: 1e-3 };
    m.setBodies([body]);
    m.position.set(body.radius * 1.5, 0, 0);                 // hugging the surface, on +x
    m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // nose toward -x (the body)
    const cap0 = m.speedCap();
    expect(cap0).toBeLessThan(SC_TUNING.MIN_CRUISE);          // precondition: well cap is below the floor here
    m.setDrive(true);
    m.setThrottle(0);
    stepN(m, 600);
    // Floor yields to the cap: throttle-0 target = clamp(0, min(MIN_CRUISE,cap), cap) = cap. The ship
    // tracks the LIVE well cap, which stays BELOW MIN_CRUISE near the body → it never reaches the cruise
    // floor, so capture (slowing below the floor) survives. (Speed lags the per-frame-changing cap by one
    // exponential step while the ship moves, so assert the regime invariants, not exact speed==cap.)
    const cap = m.speedCap();
    expect(cap).toBeLessThan(SC_TUNING.MIN_CRUISE);            // still cap-governed near the body
    expect(m.speed).toBeLessThanOrEqual(cap + 1e-9);          // clamped to the well cap
    expect(m.speed).toBeLessThan(SC_TUNING.MIN_CRUISE);       // BELOW the cruise floor → capture possible
    expect(m.speed).toBeGreaterThan(0);                       // still cruising, just slowly
  });

  it('(c) drop-out from cruising speed → ≈0 within ~1.5s (fast, not the old 8s coast)', () => {
    const m = new SupercruiseModel();
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 120);
    const cruise = m.speed;
    expect(cruise).toBeGreaterThan(0);
    m.setDrive(false);
    stepN(m, 90); // 1.5 s → exp(-1.5/0.4) ≈ 2.35% remains
    expect(m.speed / cruise).toBeLessThan(0.03);
    // Sanity: a COAST_TAU=8 coast would still retain exp(-1.5/8) ≈ 83% of cruise after 1.5s.
    expect(m.speed).toBeLessThan(cruise * Math.exp(-1.5 / 8));
  });

  it('(d) regression: throttle 1 far from bodies → speed → cap (CAP_MAX), unchanged by the floor', () => {
    const m = new SupercruiseModel(); // no bodies → cap = CAP_MAX
    m.setDrive(true);
    m.setThrottle(1);
    stepN(m, 1200);
    expect(m.speed).toBeLessThanOrEqual(SC_TUNING.CAP_MAX);
    expect(m.speed).toBeGreaterThan(SC_TUNING.CAP_MAX * 0.99);
  });
});
