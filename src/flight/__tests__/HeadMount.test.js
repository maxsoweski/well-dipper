// src/flight/__tests__/HeadMount.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { HeadMount, HEAD_TUNING } from '../HeadMount.js';

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
    // exact component-wise equality (angleTo(self) returns ~3e-8, not 0 —
    // acos float artifact in three.js — so equals() is the honest "exactly")
    expect(cockpit.quaternion.equals(m.orientation)).toBe(true);
    // camera sits AT the ship but looks AWAY from ship-forward by the look amount
    expect(cam.position.equals(m.position)).toBe(true);
    // ship-local compose: ship × look(YXZ pitch,yaw) — exact, pins order AND frame
    // (equals(), not angleTo < 1e-9 — angleTo(self) ≈ 4e-8 acos artifact, see above)
    const expected = m.orientation.clone()
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.4, 0, 'YXZ')));
    expect(cam.quaternion.equals(expected)).toBe(true);
  });

  it('clamps look offsets at MAX_YAW / MAX_PITCH, both signs', () => {
    const h = new HeadMount();
    h.beginLook(); h.addLook(10, 10);
    expect(h.yaw).toBe(HEAD_TUNING.MAX_YAW);
    expect(h.pitch).toBe(HEAD_TUNING.MAX_PITCH);
    h.addLook(-100, -100);
    expect(h.yaw).toBe(-HEAD_TUNING.MAX_YAW);
    expect(h.pitch).toBe(-HEAD_TUNING.MAX_PITCH);
  });

  it('HOLDS the view on plain release — no auto-recenter merely because !held', () => {
    // §free-look-interaction-redesign-2026-06-27, Part 2 step 4: releasing the
    // LMB after a look-drag in free-look must HOLD the view where you dragged it.
    // A bare endLook() must NOT ease toward center any more (that recenter is now
    // explicit, gated on beginRecenter() — fired only on F-exit).
    const h = new HeadMount();
    h.beginLook(); h.addLook(0.8, 0.4); h.endLook();
    for (let i = 0; i < 120; i++) h.update(DT);
    expect(h.yaw).toBeCloseTo(0.8, 9);   // held position, never decayed
    expect(h.pitch).toBeCloseTo(0.4, 9);
  });

  it('recenters on EXPLICIT beginRecenter() (eased, fast), ends aligned', () => {
    const h = new HeadMount();
    h.beginLook(); h.addLook(0.8, 0.4); h.endLook();
    h.beginRecenter();                   // F-exit requests the recenter
    let prevMag = Math.hypot(h.yaw, h.pitch);
    for (let i = 0; i < 120; i++) {
      h.update(DT);
      const mag = Math.hypot(h.yaw, h.pitch);
      expect(mag).toBeLessThanOrEqual(prevMag + 1e-12);
      prevMag = mag;
    }
    expect(h.centered).toBe(true);
  });

  it('the exit recenter is FAST but graceful (eased, ~90% home within ~3τ)', () => {
    const h = new HeadMount();
    h.beginLook(); h.addLook(0.8, 0.4); h.endLook();
    const start = Math.hypot(h.yaw, h.pitch);
    h.beginRecenter();
    h.update(DT); // one frame — must be EASED (not an instant snap to 0)
    const afterOneFrame = Math.hypot(h.yaw, h.pitch);
    expect(afterOneFrame).toBeGreaterThan(0);            // graceful: not instant
    expect(afterOneFrame).toBeLessThan(start);           // and moving home
    // snappy: ~90% of the return done within ~3 time-constants (a fraction of a
    // second at EXIT_RECENTER_TAU) — fast feel, still an ease not a snap.
    const settleFrames = Math.ceil((3 * HEAD_TUNING.EXIT_RECENTER_TAU) / DT);
    for (let i = 1; i < settleFrames; i++) h.update(DT);
    expect(Math.hypot(h.yaw, h.pitch)).toBeLessThan(start * 0.1);
  });

  it('beginLook() during a recenter cancels it (grab the view back mid-return)', () => {
    const h = new HeadMount();
    h.beginLook(); h.addLook(0.8, 0.4); h.endLook();
    h.beginRecenter();
    h.update(DT); // partway home
    h.beginLook(); // grab it again
    const y = h.yaw, p = h.pitch;
    for (let i = 0; i < 30; i++) h.update(DT); // held → frozen, recenter cleared
    expect(h.yaw).toBeCloseTo(y, 9);
    expect(h.pitch).toBeCloseTo(p, 9);
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
