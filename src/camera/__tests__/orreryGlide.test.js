/**
 * ORRERY glide-coherence — TDD RED phase (orrery-coherence-2026-07-15, UAT round 2).
 *
 * These tests ENCODE the three root-caused defects of the ORRERY click-2 "glide
 * the view to the body" flow, and the standoff-table + radius-min APIs the agreed
 * fix introduces. They are written to FAIL against HEAD:
 *
 *   T1 PATH-STRAIGHTNESS (behavioral red) — the current glideFocus decomposes the
 *      move into THREE independently-eased channels (pivot target @0.06,
 *      smoothedYaw/Pitch @0.08, log-smoothedDistance @0.08) that are then composed
 *      as camera = target + smoothedDistance*dir. In the real ORRERY case (far
 *      overview → tiny standoff, off-axis body) the distance collapses toward the
 *      OLD pivot before the pivot has carried over → a big curved DOGLEG. The fix
 *      (single-channel glide: one normalized t drives camera P_start→P_final and
 *      target T_start→body together) makes the camera path a near-straight segment.
 *      Asserted: max perpendicular deviation < 5% of the start→end segment.
 *
 *   T2 MOVING-TARGET (behavioral red) — glideFocus copies the click-time position
 *      into _targetGoal and freezes yaw/pitch from it, so a body that keeps moving
 *      during the glide is CHASED to where it WAS. The fix re-derives the vantage
 *      from the body's LIVE position each frame. Asserted: final |camera−body|
 *      equals the standoff of where the body ENDED.
 *
 *   T3 RADIUS-RELATIVE MIN-DISTANCE (missing-API red) — closest approach is bounded
 *      by an ABSOLUTE 0.01 floor that ignores body radius, so a 0.002-unit moon
 *      can't be zoomed nearer than ~5R. The fix sets minDistance = radius*1.05 while
 *      a body is focused and resets it to 0.01 on overview framing. Asserted against
 *      the designed camera API (setFocusMinDistance / resetFocusMinDistance).
 *
 *   T4 STANDOFF TABLE (missing-module red) — new pure helper src/camera/orreryStandoff.js
 *      with ORRERY_STANDOFF = { star:15, planet:4, moon:2.6 } radius multiples and a
 *      0.002 degenerate-radius floor. Imported dynamically so its absence reds only T4.
 *
 * IDIOM: mirrors ShipCameraSystem.test.js / modeSwapNoSnap.test.js — window/document
 * mocks before import, mockCanvas(), real ShipCameraSystem driven headless.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

// Mock window + document before importing ShipCameraSystem (constructor attaches
// listeners to window/canvas).
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    screen: { orientation: { angle: 0 } },
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { addEventListener: vi.fn() };
}
if (typeof globalThis.DeviceOrientationEvent === 'undefined') {
  globalThis.DeviceOrientationEvent = class {};
}

const { ShipCameraSystem } = await import('../ShipCameraSystem.js');

function mockCanvas() {
  const listeners = {};
  return {
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    style: {},
  };
}

// Max perpendicular distance of any sampled point from the straight segment a→b,
// returned alongside the segment length (so callers can express a % bound).
function maxPerpDeviation(samples, a, b) {
  const ab = b.clone().sub(a);
  const segLen = ab.length();
  if (segLen < 1e-12) return { maxPerp: 0, segLen: 0 };
  ab.normalize();
  let maxPerp = 0;
  for (const p of samples) {
    const ap = p.clone().sub(a);
    const along = ap.dot(ab);
    const perp = ap.clone().sub(ab.clone().multiplyScalar(along)).length();
    if (perp > maxPerp) maxPerp = perp;
  }
  return { maxPerp, segLen };
}

// The agreed standoff table (radius multiples). Used inline by T1/T2 so they load
// even while the orreryStandoff.js module is absent; T4 asserts the MODULE exports
// exactly these.
const STANDOFF = { star: 15, planet: 4, moon: 2.6 };

describe('ORRERY glide coherence (orrery-coherence-2026-07-15, UAT round 2) — RED', () => {
  let camera, canvas, sys;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(70, 1, 0.01, 200000);
    canvas = mockCanvas();
    sys = new ShipCameraSystem(camera, canvas);
    // Auto-drift would add unrelated yaw motion; isolate the glide path.
    sys.autoRotateActive = false;
  });

  // Seat a settled Toy-Box orbit pose (smoothed == raw), then run one update so
  // the camera is exactly on its orbit position before the glide begins.
  function seatOrbit({ dist, yaw, pitch, target = new THREE.Vector3(0, 0, 0) }) {
    sys.target.copy(target);
    sys._targetGoal.copy(target);
    sys._transitioning = false;
    sys.yaw = yaw; sys.pitch = pitch; sys.distance = dist;
    sys.smoothedYaw = yaw; sys.smoothedPitch = pitch; sys.smoothedDistance = dist;
    sys.update(1 / 60);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // T1 — PATH STRAIGHTNESS
  // ─────────────────────────────────────────────────────────────────────────
  describe('T1 — glide follows a straight path (no dogleg)', () => {
    it('T1a settled overview → off-axis body: camera path deviates < 5% of the segment', () => {
      // Real ORRERY case: far system overview (dist 2000, tilted 0.7 like
      // _frameSystemForOrrery), glide to an off-axis body at a tiny radius-scaled
      // standoff. This is the configuration that doglegs today.
      seatOrbit({ dist: 2000, yaw: 0, pitch: 0.7 });
      const start = camera.position.clone();

      const B = new THREE.Vector3(800, 0, 600);
      const standoff = 0.25; // e.g. a ~0.06-radius planet at planet*4
      sys.glideFocus(B, standoff);

      const samples = [];
      for (let i = 0; i < 1500; i++) { sys.update(1 / 60); samples.push(camera.position.clone()); }
      const end = camera.position.clone();

      const { maxPerp, segLen } = maxPerpDeviation(samples, start, end);
      const pct = (100 * maxPerp) / segLen;
      // eslint-disable-next-line no-console
      console.log(`[T1a] dogleg deviation = ${pct.toFixed(2)}% of segment (maxPerp=${maxPerp.toFixed(1)}, segLen=${segLen.toFixed(1)})`);

      // Destination is CORRECT today (right endpoint) — proving the defect is the
      // PATH, not the target: these two pass on HEAD.
      expect(camera.position.distanceTo(B)).toBeCloseTo(standoff, 2);
      expect(sys.target.distanceTo(B)).toBeLessThan(standoff);

      // PATH straightness — FAILS today (~40%), passes after the single-channel fix.
      expect(pct).toBeLessThan(5);
    });

    it('T1b click-1/click-2 race (pivot mid-ease) → glide still deviates < 5%', () => {
      // Worst case: click-1 started a selectTarget pivot ease that has NOT arrived
      // when click-2 fires the glide — the residual pivot gap is what doglegs.
      seatOrbit({ dist: 3000, yaw: 0, pitch: 0.7 });
      // Click-1: pivot easing toward a first body, only a few frames in.
      sys._targetGoal.set(300, 20, -200);
      sys._transitioning = true;
      sys._transitionSpeed = 0.06;
      for (let i = 0; i < 8; i++) sys.update(1 / 60);

      const start = camera.position.clone();
      const B = new THREE.Vector3(700, 0, 500);
      const standoff = 0.25;
      sys.glideFocus(B, standoff);

      const samples = [];
      for (let i = 0; i < 1500; i++) { sys.update(1 / 60); samples.push(camera.position.clone()); }
      const end = camera.position.clone();

      const { maxPerp, segLen } = maxPerpDeviation(samples, start, end);
      const pct = (100 * maxPerp) / segLen;
      // eslint-disable-next-line no-console
      console.log(`[T1b] race dogleg deviation = ${pct.toFixed(2)}% of segment`);

      expect(camera.position.distanceTo(B)).toBeCloseTo(standoff, 2);
      expect(pct).toBeLessThan(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T2 — MOVING TARGET
  // ─────────────────────────────────────────────────────────────────────────
  it('T2 — glide meets a MOVING body at its live position (not chased to a stale one)', () => {
    seatOrbit({ dist: 1500, yaw: 0, pitch: 0.5 });

    // The body is a live-updated point. glideFocus captures it at t0; the fix must
    // re-read its LIVE position each frame. We mutate the SAME Vector3 instance to
    // model the body moving — HEAD's glideFocus copied it once, so it ignores this.
    const bodyPos = new THREE.Vector3(800, 20, 300);
    const standoff = 0.25;
    sys.glideFocus(bodyPos, standoff);

    // Body drifts during the glide, then holds still so there is a stable "ended"
    // position to measure against.
    for (let i = 0; i < 220; i++) { bodyPos.z += 2; sys.update(1 / 60); } // +440 in Z
    for (let i = 0; i < 200; i++) { sys.update(1 / 60); }

    const distToEnded = camera.position.distanceTo(bodyPos);
    // eslint-disable-next-line no-console
    console.log(`[T2] final |camera−body_ended| = ${distToEnded.toFixed(3)} (want standoff ${standoff})`);

    // FAILS today (camera parked ~440 units away at the stale click-time spot);
    // passes when the glide tracks the live body.
    expect(distToEnded).toBeCloseTo(standoff, 1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T3 — RADIUS-RELATIVE MIN-DISTANCE
  // ─────────────────────────────────────────────────────────────────────────
  describe('T3 — focused-body min-distance is radius-relative', () => {
    it('T3a focusing a tiny body lets wheel-zoom reach radius*1.05 (not the 0.01 floor)', () => {
      const radius = 0.002;
      seatOrbit({ dist: 0.05, yaw: 0, pitch: 0, target: new THREE.Vector3(500, 0, 0) });

      // DESIGNED (fix C): focusing a body in ORRERY sets minDistance = radius*1.05.
      // Missing on HEAD → this assertion reds before the zoom even runs.
      expect(typeof sys.setFocusMinDistance).toBe('function');
      sys.setFocusMinDistance(radius);
      expect(sys.minDistance).toBeCloseTo(radius * 1.05, 6);

      // Wheel-zoom hard inward (sustained inward pressure overcomes zoom damping).
      for (let i = 0; i < 600; i++) { sys.zoomSpeed = -20; sys.update(1 / 60); }

      // Effective closest approach clamps at radius*1.05 (~0.0021), NOT 0.01.
      expect(sys.distance).toBeCloseTo(radius * 1.05, 4);
      expect(sys.smoothedDistance).toBeLessThan(0.01);
    });

    it('T3b overview framing resets the clamp to 0.01', () => {
      const radius = 0.002;
      // DESIGNED (fix C): reset happens on system-overview framing.
      expect(typeof sys.resetFocusMinDistance).toBe('function');
      sys.setFocusMinDistance(radius);
      expect(sys.minDistance).toBeCloseTo(radius * 1.05, 6);
      sys.resetFocusMinDistance();
      expect(sys.minDistance).toBe(0.01);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T4 — STANDOFF TABLE HELPER
  // ─────────────────────────────────────────────────────────────────────────
  it('T4 — orreryStandoff(kind, radius) returns the agreed radius multiples + 0.002 floor', async () => {
    // Dynamic import so the missing module reds ONLY this test (a static import
    // would abort the whole file at load). Rejects on HEAD → valid red.
    const mod = await import('../orreryStandoff.js');
    const orreryStandoff = mod.orreryStandoff || mod.default;

    expect(typeof orreryStandoff).toBe('function');
    expect(orreryStandoff('star', 4.65)).toBeCloseTo(4.65 * STANDOFF.star, 5);   // 15R
    expect(orreryStandoff('planet', 0.0426)).toBeCloseTo(0.0426 * STANDOFF.planet, 6); // 4R
    expect(orreryStandoff('moon', 0.01)).toBeCloseTo(0.01 * STANDOFF.moon, 6);   // 2.6R

    // Degenerate-radius backstop: a ~zero radius must not collapse the standoff to 0.
    // Floor is 0.002 — SMALLER than any real body's radius*multiple (smallest moons
    // ~0.001 → 2.6R = 0.0026), so it never re-parks a real moon far out.
    expect(orreryStandoff('moon', 0)).toBeCloseTo(0.002, 6);
    expect(orreryStandoff('planet', 1e-9)).toBeGreaterThanOrEqual(0.002);
    // A real tiny moon must get its 2.6R, NOT the floor (the old 0.02 floor bug).
    expect(orreryStandoff('moon', 0.002)).toBeCloseTo(0.002 * 2.6, 6);

    // The exported table itself, if surfaced, should carry the agreed multiples.
    if (mod.ORRERY_STANDOFF) {
      expect(mod.ORRERY_STANDOFF).toMatchObject(STANDOFF);
    }
  });
});
