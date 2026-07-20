/**
 * ORRERY zoom-in arrival — TDD RED phase (orrery-entry-orbits-2026-07-20, AC4).
 *
 * These tests ENCODE the ratified beginArrivalZoom contract (design-ac4.md) and
 * are written to FAIL against HEAD, where ShipCameraSystem has NO beginArrivalZoom
 * method — every case throws TypeError at the `sys.beginArrivalZoom(...)` call.
 *
 * RATIFIED MECHANISM (design-ac4.md §Carrier / §Settle signal / §Additional traps):
 *   beginArrivalZoom(spawnDistance, opts={}) seeds this.smoothedDistance = spawn
 *   (NEVER this.distance — the wheel branch maxDistance-clamps distance and would
 *   snap a 4.5M spawn to ~overview; the update() log-lerp reads distance as its
 *   UNCLAMPED target). It arms an arrival-active flag; the existing smoothedDistance
 *   log-lerp (smoothing 0.08, ShipCameraSystem.js update()) then closes the gap so
 *   the camera zooms IN to the pre-set overview distance. When
 *   |ln(smoothedDistance) − ln(distance)| < ε it flips _arrivalSettled ONCE and
 *   fires opts.onSettle EXACTLY once (the far-plane restore hook). Any interruption
 *   — wheel zoom, glideFocus/focusOn/viewSystem/setTarget, free-look enter, mode
 *   swap, or a superseding beginArrivalZoom — CANCELS the arrival and STILL fires
 *   onSettle exactly once total (far-restore must never leak, never double-fire).
 *   It must NOT disturb the two-phase glide machinery (802cceb) or smoothing=0.08.
 *
 * IDIOM: mirrors orreryGlide.test.js / ShipCameraSystem.test.js — window/document
 * mocks before import, mockCanvas(), real ShipCameraSystem driven headless with a
 * fake dt. _glidePhase 0 == module-internal GLIDE_PHASE_AIM (not exported).
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

// The AC4 settle probe: the log gap the arrival closes. distance is the (already
// set) overview target; smoothedDistance is what the log-lerp drives.
function logGap(sys) {
  return Math.abs(Math.log(sys.smoothedDistance) - Math.log(sys.distance));
}

describe('ORRERY arrival zoom-in (orrery-entry-orbits-2026-07-20, AC4) — RED', () => {
  let camera, canvas, sys;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(70, 1, 1e-9, 200000);
    canvas = mockCanvas();
    sys = new ShipCameraSystem(camera, canvas);
    // Auto-drift would add unrelated yaw motion; isolate the distance lerp.
    sys.autoRotateActive = false;
  });

  // Seat a SETTLED overview pose (smoothed == raw) at the destination distance the
  // real flow set via _frameSystemForOrrery/viewSystem BEFORE beginArrivalZoom runs.
  // distance is the overview target; the arrival only re-seeds smoothedDistance.
  function seatOverview({ dist = 2000, yaw = 0, pitch = 0.7, target = new THREE.Vector3(0, 0, 0) } = {}) {
    sys.target.copy(target);
    sys._targetGoal.copy(target);
    sys._transitioning = false;
    sys.yaw = yaw; sys.pitch = pitch; sys.distance = dist;
    sys.smoothedYaw = yaw; sys.smoothedPitch = pitch; sys.smoothedDistance = dist;
    sys.update(1 / 60);
  }

  // ─── C1: seeds smoothedDistance, NEVER distance ───
  it('C1 — beginArrivalZoom(5e6) seeds smoothedDistance to the spawn and leaves this.distance untouched', () => {
    seatOverview({ dist: 2000 });
    expect(sys.distance).toBe(2000);
    sys.beginArrivalZoom(5e6);
    // The spawn lands on smoothedDistance (the unclamped log-lerp source)...
    expect(sys.smoothedDistance).toBe(5e6);
    // ...and distance (the wheel-branch-clamped overview target) is NEVER written.
    expect(sys.distance).toBe(2000);
  });

  // ─── C2: repeated update() closes the log gap monotonically (zooms IN) ───
  it('C2 — repeated update() closes the log gap monotonically toward distance (inward, never outward)', () => {
    seatOverview({ dist: 2000 });
    sys.beginArrivalZoom(5e6);
    let prevGap = logGap(sys);
    const firstGap = prevGap;
    for (let i = 0; i < 200; i++) {
      sys.update(1 / 60);
      const g = logGap(sys);
      expect(g).toBeLessThanOrEqual(prevGap + 1e-9); // gap never grows
      prevGap = g;
    }
    expect(prevGap).toBeLessThan(firstGap);          // it actually closed
    expect(sys.smoothedDistance).toBeLessThan(5e6);  // moved DOWN from the far spawn
    expect(sys.smoothedDistance).toBeGreaterThan(2000 - 1); // toward, not past, overview
  });

  // ─── C3: settle flag flips once, onSettle fires exactly once ───
  it('C3 — _arrivalSettled flips exactly once and onSettle fires exactly once at |ln gap| < ε', () => {
    seatOverview({ dist: 2000 });
    const onSettle = vi.fn();
    sys.beginArrivalZoom(5e6, { onSettle });
    expect(onSettle).not.toHaveBeenCalled();          // no premature fire at arm time
    for (let i = 0; i < 600; i++) sys.update(1 / 60);  // ~10s ≫ the ~1s close
    expect(sys._arrivalSettled).toBe(true);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(sys.smoothedDistance).toBeCloseTo(2000, 0); // landed on the overview frame
  });

  // ─── C4: every interruption cancels the arrival AND fires onSettle exactly once ───
  describe('C4 — interruptions cancel arrival but STILL fire onSettle exactly once (no far-restore leak/double-fire)', () => {
    const interruptors = {
      'wheel-zoom': (s, cv) => cv._listeners.wheel({ deltaY: -120, preventDefault: () => {} }),
      'glideFocus': (s) => s.glideFocus(new THREE.Vector3(500, 0, 300), 4),
      'focusOn':    (s) => s.focusOn(new THREE.Vector3(500, 0, 300), 8),
      'viewSystem': (s) => s.viewSystem(1000, new THREE.Vector3(0, 0, 0)),
      'setTarget':  (s) => s.setTarget(new THREE.Vector3(10, 0, 0)),
      // Lens-A advisory fold (2026-07-20): the two cancel sites C4 originally
      // missed — both call _endArrival(false) in code; pin them here.
      'enterFreeLook': (s) => s.enterFreeLook(),
      'setCameraMode-swap': (s) => s.setCameraMode('flight'),
    };
    for (const [name, trigger] of Object.entries(interruptors)) {
      it(`C4 ${name} — cancels the live arrival; onSettle fired exactly once across the whole run`, () => {
        seatOverview({ dist: 2000 });
        const onSettle = vi.fn();
        sys.beginArrivalZoom(5e6, { onSettle });
        for (let i = 0; i < 5; i++) sys.update(1 / 60); // mid-zoom, NOT yet settled
        expect(onSettle).not.toHaveBeenCalled();
        trigger(sys, canvas);
        // Drive well past any natural settle: the cancel must have fired the restore
        // exactly once and disarmed the arrival so no second fire ever leaks.
        for (let i = 0; i < 600; i++) sys.update(1 / 60);
        expect(onSettle).toHaveBeenCalledTimes(1);
      });
    }
  });

  // ─── C5: a second beginArrivalZoom supersedes cleanly (fire-old-then-arm-new) ───
  it('C5 — a superseding beginArrivalZoom fires the old onSettle once, re-seeds the new spawn, settles the new once', () => {
    seatOverview({ dist: 2000 });
    const onSettleA = vi.fn();
    const onSettleB = vi.fn();
    sys.beginArrivalZoom(5e6, { onSettle: onSettleA });
    for (let i = 0; i < 5; i++) sys.update(1 / 60);
    expect(onSettleA).not.toHaveBeenCalled();
    sys.beginArrivalZoom(4e6, { onSettle: onSettleB });
    // Restore of the superseded arrival MUST run exactly once (far-plane can't leak).
    expect(onSettleA).toHaveBeenCalledTimes(1);
    // The new arrival re-seeds smoothedDistance to its own spawn.
    expect(sys.smoothedDistance).toBe(4e6);
    for (let i = 0; i < 600; i++) sys.update(1 / 60);
    expect(onSettleB).toHaveBeenCalledTimes(1); // new one settles exactly once
    expect(onSettleA).toHaveBeenCalledTimes(1); // old one never re-fires
  });

  // ─── C6: arrival never disturbs the two-phase glide machinery (802cceb) ───
  it('C6 — arrival leaves _gliding false throughout, and glideFocus still arms the AIM phase cleanly afterward', () => {
    seatOverview({ dist: 2000 });
    sys.beginArrivalZoom(5e6);
    for (let i = 0; i < 50; i++) {
      sys.update(1 / 60);
      expect(sys._gliding).toBe(false); // the arrival is NOT a glide
    }
    // orreryGlide-style spot check: the GLIDE_* machinery is untouched — a glideFocus
    // after the arrival still arms the AIM phase for an off-axis body.
    sys.glideFocus(new THREE.Vector3(800, 0, 600), 0.25);
    expect(sys._gliding).toBe(true);
    expect(sys._glidePhase).toBe(0); // 0 === GLIDE_PHASE_AIM (module-internal)
  });
});
