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
    stepN(m, 400);
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

import * as THREE from 'three';

describe('SupercruiseModel — hard collision barrier', () => {
  const body = () => ({ position: new THREE.Vector3(0, 0, 0), radius: 5 });

  it('a head-on inward step is clamped to COLLISION_FACTOR×radius and speed zeroed', () => {
    const m = new SupercruiseModel();
    const b = body();
    m.setBodies([b]);
    m.position.set(b.radius * 1.0505, 0, 0); // a hair outside the 1.05R barrier, on +x —
                                             //   close enough that a 120-step sublight run reaches it
                                             //   (plan's 1.06R needs >2000 steps at SUBLIGHT_CAP=0.002)
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

import { starMassKgFromSceneRadius } from '../proximityHorizon.js';
import { solarRadiiToScene, earthRadiiToScene } from '../../core/ScaleConstants.js';

describe('SupercruiseModel — proximityDropRequired (direction-aware forced-drop)', () => {
  // Body sits at the origin; the ship is placed on +x. The nose default is -z
  // (tangent to the +x radial). These helpers point it at / away from the body.
  const NOSE_TOWARD = (m) => m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);  // nose → -x (at body)
  const NOSE_AWAY   = (m) => m.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // nose → +x (away)

  it('inside a star horizon: blocks when pointed toward, allows when pointed away', () => {
    const m = new SupercruiseModel();
    const sceneR = solarRadiiToScene(1);
    const star = { position: new THREE.Vector3(0, 0, 0), radius: sceneR, massKg: starMassKgFromSceneRadius(sceneR) };
    m.setBodies([star]);
    m.position.set(sceneR * 3, 0, 0);  // 3R — inside the ~4.2R horizon
    NOSE_TOWARD(m); expect(m.proximityDropRequired()).toBe(true);   // pointed at the star → blocked
    NOSE_AWAY(m);   expect(m.proximityDropRequired()).toBe(false);  // pointed away → free to leave
  });

  it('a tangent heading inside the horizon does not block', () => {
    const m = new SupercruiseModel();
    const sceneR = solarRadiiToScene(1);
    const star = { position: new THREE.Vector3(0, 0, 0), radius: sceneR, massKg: starMassKgFromSceneRadius(sceneR) };
    m.setBodies([star]);
    m.position.set(sceneR * 3, 0, 0);
    m.orientation.identity();          // nose → -z, perpendicular to the +x radial
    expect(m.proximityDropRequired()).toBe(false);
  });

  it('outside the horizon never blocks, even pointed straight at the star', () => {
    const m = new SupercruiseModel();
    const sceneR = solarRadiiToScene(1);
    const star = { position: new THREE.Vector3(0, 0, 0), radius: sceneR, massKg: starMassKgFromSceneRadius(sceneR) };
    m.setBodies([star]);
    m.position.set(sceneR * 6, 0, 0);  // 6R — outside
    NOSE_TOWARD(m); expect(m.proximityDropRequired()).toBe(false);
  });

  it('an Earth-radius body (no massKg) trips only inside the 1.1R floor AND pointed toward', () => {
    const m = new SupercruiseModel();
    const r = earthRadiiToScene(1);
    const planet = { position: new THREE.Vector3(0, 0, 0), radius: r }; // no massKg → floor only
    m.setBodies([planet]);
    m.position.set(r * 1.2, 0, 0);  NOSE_TOWARD(m); expect(m.proximityDropRequired()).toBe(false); // outside floor
    m.position.set(r * 1.05, 0, 0); NOSE_TOWARD(m); expect(m.proximityDropRequired()).toBe(true);  // inside + toward
    NOSE_AWAY(m);                                   expect(m.proximityDropRequired()).toBe(false); // inside but away → leave
  });
});
