/**
 * ORRERY glide-coherence — TDD RED phase (orrery-coherence-2026-07-15).
 *
 * HISTORY TRAIL (this file's T1 block has been re-ruled twice):
 *   round 1 (UAT round 2)  — glideFocus eased THREE channels (pivot @0.06,
 *      yaw/pitch @0.08, log-distance @0.08). They arrived at mismatched rates →
 *      a curved DOGLEG. T1 asserted max perpendicular deviation < 5%.
 *   round 2 (single-channel, shipped 31eae77) — ONE normalized t drove camera
 *      P_start→P_final and target T_start→body together, so the PATH became a
 *      straight segment (~0.00% deviation on HEAD). This fixed the dogleg.
 *   round 2b (TWO-PHASE, THIS redefinition — Max's ruling 2026-07-17) — the
 *      single-channel glide still translated and rotated the look SIMULTANEOUSLY,
 *      so a body clicked at screen edge slid edge→center WHILE flying (reads as a
 *      lateral slide). Straight path, wrong feel. The ruled contract splits the
 *      move into two phases and T1 is redefined to encode it.
 *
 * These tests ENCODE the ORRERY click-2 "glide the view to the body" contract and
 * the standoff-table + radius-min APIs. Written to FAIL against HEAD (c1169bf, the
 * single-channel glide):
 *
 *   T1 TWO-PHASE GLIDE (behavioral red) — the ruled contract:
 *      • PHASE 1 AIM: the camera POSITION does not move at all; only the VIEW
 *        rotates — the look eases toward the body's LIVE position until the body
 *        is centered on screen.
 *      • PHASE 2 APPROACH: the camera translates in a STRAIGHT line along the
 *        settled camera→body ray to the standoff, and the body STAYS centered the
 *        whole way (never slides in from the side).
 *      Phase-2 onset is detected IMPLEMENTATION-AGNOSTICALLY as the first frame the
 *      camera position moves (no private phase fields). Centered-ness is the ANGLE
 *      between camera forward and the camera→body ray. RED on HEAD: the single-
 *      channel glide translates from frame 0 with the body still ~30° off-axis, so
 *      it centers WHILE flying — the AIM "stationary + centered-by-onset" and the
 *      APPROACH "centered on every frame" asserts fail (straightness itself passes).
 *
 *   T5 TARGET-CHANNEL OWNERSHIP + MID-AIM INTERRUPT (behavioral red) — main.js
 *      simStep calls trackTarget(body) every frame while a body is focused; the
 *      glide must OWN the target channel through phase 1 (an external per-frame
 *      target write must not defeat the eased aim), and a drag/wheel interrupt
 *      mid-AIM must hand back with NO snap and NO camera move.
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

// Centered-ness metric: the ANGLE (degrees) between the camera's forward vector
// and the camera→body direction. Robust when the body starts far off-axis (acos
// of the dot), and — unlike screen-space NDC — never garbage when the body is
// behind the camera. angle→0 means the body is dead-center on screen.
const _fwd = new THREE.Vector3();
function forwardAngleDeg(camera, body) {
  camera.getWorldDirection(_fwd);
  const toBody = body.clone().sub(camera.position);
  const len = toBody.length();
  if (len < 1e-12) return 0;
  toBody.divideScalar(len);
  const dot = Math.max(-1, Math.min(1, _fwd.dot(toBody)));
  return (Math.acos(dot) * 180) / Math.PI;
}

// The agreed standoff table (radius multiples). Used inline by T1/T2 so they load
// even while the orreryStandoff.js module is absent; T4 asserts the MODULE exports
// exactly these.
const STANDOFF = { star: 15, planet: 4, moon: 2.6 };

describe('ORRERY glide coherence (orrery-coherence-2026-07-15, round 2b two-phase) — RED', () => {
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

  // Drive a glide to completion, sampling per frame. Returns the pre-glide start
  // pose, per-frame camera positions + forward-to-body angles (deg), the detected
  // PHASE-2 onset (first frame the camera POSITION moves > 1e-9 — implementation-
  // agnostic, reads NO private phase fields), and the final pose. `maxFrames` caps
  // the loop, so a never-moving OR never-arriving glide FAILS the caller (onset=-1
  // / wrong endpoint) rather than hanging. `trackEachFrame` mirrors main.js simStep
  // by writing trackTarget(body) both BEFORE and AFTER each update (both orders).
  function runGlide({ body, standoff, maxFrames = 1500, trackEachFrame = false }) {
    const start = camera.position.clone();
    sys.glideFocus(body, standoff);
    const positions = [];
    const angles = [];
    let onset = -1;
    let prev = start.clone();
    for (let i = 0; i < maxFrames; i++) {
      if (trackEachFrame) sys.trackTarget(body);
      sys.update(1 / 60);
      if (trackEachFrame) sys.trackTarget(body);
      const p = camera.position.clone();
      if (onset === -1 && p.distanceTo(prev) > 1e-9) onset = i;
      positions.push(p);
      angles.push(forwardAngleDeg(camera, body));
      prev = p;
    }
    return { start, positions, angles, onset, end: positions[positions.length - 1] };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // T1 — TWO-PHASE GLIDE (aim in place, then straight approach, body centered)
  // ─────────────────────────────────────────────────────────────────────────
  describe('T1 — two-phase glide: aim in place, then straight approach', () => {
    it('T1a AIM — settled overview → off-axis body: camera holds its position until the body is centered', () => {
      // Real ORRERY case: far system overview (dist 2000, tilted 0.7 like
      // _frameSystemForOrrery), glide to an off-axis body at a tiny radius-scaled
      // standoff — the side-slide configuration.
      seatOrbit({ dist: 2000, yaw: 0, pitch: 0.7 });
      const B = new THREE.Vector3(800, 0, 600);
      const standoff = 0.25; // e.g. a ~0.06-radius planet at planet*4
      const startAngle = forwardAngleDeg(camera, B);

      const { start, positions, angles, onset } = runGlide({ body: B, standoff });
      // eslint-disable-next-line no-console
      console.log(`[T1a AIM] startAngle=${startAngle.toFixed(1)}deg onset=frame ${onset} angleAtOnset=${(onset >= 0 ? angles[onset] : NaN).toFixed(2)}deg`);

      // The body genuinely starts well off-axis (otherwise there is no aim to test).
      expect(startAngle).toBeGreaterThan(10);
      // A phase-2 onset must EXIST (a never-moving glide would leave onset = -1).
      expect(onset).toBeGreaterThanOrEqual(0);
      // AIM: the camera POSITION does not move on any frame before onset.
      for (let i = 0; i < onset; i++) {
        expect(positions[i].distanceTo(start)).toBeLessThan(1e-7);
      }
      // AIM RESULT: the body is centered (forward within ~1deg of the camera→body
      // ray) by the time the camera first translates. RED on HEAD (single-channel):
      // the camera translates from frame 0 with the body still ~30deg off-axis, so
      // it centers WHILE flying rather than before.
      expect(angles[onset]).toBeLessThan(1);
      // Smoothness pin (round-2b lens advisory): a teleport-snap aim (target=body
      // in one frame) would pass the stationary+centered asserts alone. Smoothstep
      // barely moves on its first frame, so most of the initial offset must remain.
      expect(angles[0]).toBeGreaterThan(startAngle * 0.5);
    });

    it('T1a APPROACH — after onset the camera flies straight AND the body stays centered the whole way', () => {
      seatOrbit({ dist: 2000, yaw: 0, pitch: 0.7 });
      const B = new THREE.Vector3(800, 0, 600);
      const standoff = 0.25;

      const { positions, angles, onset, end } = runGlide({ body: B, standoff });
      expect(onset).toBeGreaterThanOrEqual(0);

      // Straight approach: perpendicular deviation from the onset→end segment < 1%.
      const approach = positions.slice(onset);
      const { maxPerp, segLen } = maxPerpDeviation(approach, positions[onset], end);
      const pct = segLen > 1e-9 ? (100 * maxPerp) / segLen : 0;
      // Body centered on EVERY approach frame, not just the endpoints. RED on HEAD:
      // early approach frames still show the body tens of degrees off-axis (the
      // side-slide), even though the PATH itself is straight (pct passes on HEAD).
      let maxApproachAngle = 0;
      for (let i = onset; i < angles.length; i++) maxApproachAngle = Math.max(maxApproachAngle, angles[i]);
      // eslint-disable-next-line no-console
      console.log(`[T1a APPROACH] straightness=${pct.toFixed(2)}% maxApproachAngle=${maxApproachAngle.toFixed(1)}deg`);

      expect(pct).toBeLessThan(1);
      expect(maxApproachAngle).toBeLessThan(2);
      // Endpoint carry-overs: camera parked at the standoff, pivot on the body.
      expect(end.distanceTo(B)).toBeCloseTo(standoff, 2);
      expect(sys.target.distanceTo(B)).toBeLessThan(standoff);
    });

    it('T1b AIM (click-1/click-2 race) — camera still holds position until centered', () => {
      // Worst case: click-1 started a selectTarget pivot ease that has NOT arrived
      // when click-2 fires the glide — the residual pivot gap. The two-phase aim
      // must still hold position and finish centering before translating.
      seatOrbit({ dist: 3000, yaw: 0, pitch: 0.7 });
      sys._targetGoal.set(300, 20, -200);
      sys._transitioning = true;
      sys._transitionSpeed = 0.06;
      for (let i = 0; i < 8; i++) sys.update(1 / 60);

      const B = new THREE.Vector3(700, 0, 500);
      const standoff = 0.25;
      const startAngle = forwardAngleDeg(camera, B);

      const { start, positions, angles, onset } = runGlide({ body: B, standoff });
      // eslint-disable-next-line no-console
      console.log(`[T1b AIM] startAngle=${startAngle.toFixed(1)}deg onset=frame ${onset} angleAtOnset=${(onset >= 0 ? angles[onset] : NaN).toFixed(2)}deg`);

      expect(startAngle).toBeGreaterThan(10);
      expect(onset).toBeGreaterThanOrEqual(0);
      for (let i = 0; i < onset; i++) {
        expect(positions[i].distanceTo(start)).toBeLessThan(1e-7);
      }
      expect(angles[onset]).toBeLessThan(1);
      // Smoothness pin — same rationale as T1a AIM: no teleport-snap aim.
      expect(angles[0]).toBeGreaterThan(startAngle * 0.5);
    });

    it('T1b APPROACH (race) — straight approach with the body centered on every frame', () => {
      seatOrbit({ dist: 3000, yaw: 0, pitch: 0.7 });
      sys._targetGoal.set(300, 20, -200);
      sys._transitioning = true;
      sys._transitionSpeed = 0.06;
      for (let i = 0; i < 8; i++) sys.update(1 / 60);

      const B = new THREE.Vector3(700, 0, 500);
      const standoff = 0.25;

      const { positions, angles, onset, end } = runGlide({ body: B, standoff });
      expect(onset).toBeGreaterThanOrEqual(0);

      const approach = positions.slice(onset);
      const { maxPerp, segLen } = maxPerpDeviation(approach, positions[onset], end);
      const pct = segLen > 1e-9 ? (100 * maxPerp) / segLen : 0;
      let maxApproachAngle = 0;
      for (let i = onset; i < angles.length; i++) maxApproachAngle = Math.max(maxApproachAngle, angles[i]);
      // eslint-disable-next-line no-console
      console.log(`[T1b APPROACH] straightness=${pct.toFixed(2)}% maxApproachAngle=${maxApproachAngle.toFixed(1)}deg`);

      expect(pct).toBeLessThan(1);
      expect(maxApproachAngle).toBeLessThan(2);
      expect(end.distanceTo(B)).toBeCloseTo(standoff, 2);
      expect(sys.target.distanceTo(B)).toBeLessThan(standoff);
    });

    it('T1c already-centered click — an on-axis body still glides to the standoff (aim may be ~zero, no stall)', () => {
      // GUARD (not a design-gap red): when the body is already dead-center, the aim
      // phase may be skipped / near-zero — the glide must NOT stall; it must still
      // complete to the standoff. Green on HEAD and after the fix; it protects the
      // two-phase build from an aim-phase stall on the trivial case.
      seatOrbit({ dist: 500, yaw: 0, pitch: 0 }); // camera at ~(0,0,500) looking at origin
      const B = new THREE.Vector3(0, 0, 480);     // straight ahead down the forward ray
      const standoff = 0.25;
      const startAngle = forwardAngleDeg(camera, B);
      expect(startAngle).toBeLessThan(0.2); // within ~0.2deg of the forward axis

      const { onset, end } = runGlide({ body: B, standoff });
      // eslint-disable-next-line no-console
      console.log(`[T1c already-centered] startAngle=${startAngle.toFixed(3)}deg onset=frame ${onset}`);
      expect(onset).toBeGreaterThanOrEqual(0);          // it moves (no stall)
      expect(end.distanceTo(B)).toBeCloseTo(standoff, 2); // reaches the standoff
      expect(sys.target.distanceTo(B)).toBeLessThan(standoff);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T5 — TARGET-CHANNEL OWNERSHIP + MID-AIM INTERRUPT
  // ─────────────────────────────────────────────────────────────────────────
  describe('T5 — glide owns the target channel, and interrupts mid-aim hand back cleanly', () => {
    it('T5a trackTarget ownership — a per-frame external target write does NOT defeat the eased aim', () => {
      // main.js simStep calls trackTarget(body.mesh.position) EVERY frame while a
      // body is focused. The glide must own the target channel through phase 1: the
      // eased look must not be stomped to the body (which would snap the view) and
      // the aim must still hold position + finish centering.
      seatOrbit({ dist: 2000, yaw: 0, pitch: 0.7 });
      const B = new THREE.Vector3(800, 0, 600);
      const standoff = 0.25;

      const { start, positions, angles, onset } = runGlide({ body: B, standoff, trackEachFrame: true });
      expect(onset).toBeGreaterThanOrEqual(0);

      // PRIMARY (design gap): the aim still holds position and centers the body by
      // onset even though main.js writes trackTarget(body) every frame — the glide
      // owns the target channel through phase 1. RED on HEAD: the single-channel
      // glide translates from frame 0 with the body ~30deg off-axis, so it never
      // centers before flying (onset=0, angle-at-onset ~30deg), trackTarget or not.
      expect(angles[onset]).toBeLessThan(1);
      for (let i = 0; i < onset; i++) expect(positions[i].distanceTo(start)).toBeLessThan(1e-7);

      // GUARD (ordered last; not the HEAD red): the eased look must never collapse
      // the body from far off-axis to dead-center in a SINGLE frame during aim —
      // which is exactly what an unguarded trackTarget stomp of this.target through
      // phase 1 would cause (the aim defeated into an instant snap). A smooth two-
      // phase aim never does a >10deg→<0.1deg one-frame jump.
      let snapped = false;
      for (let i = 1; i <= onset && i < angles.length; i++) {
        if (angles[i - 1] > 10 && angles[i] < 0.1) snapped = true;
      }
      expect(snapped).toBe(false);
    });

    it('T5b mid-AIM interrupt — a drag during the aim hands back with NO snap and NO camera move', () => {
      seatOrbit({ dist: 2000, yaw: 0, pitch: 0.7 });
      const B = new THREE.Vector3(800, 0, 600);
      const standoff = 0.25;
      sys.glideFocus(B, standoff);
      const start = camera.position.clone();

      // A few AIM frames: two-phase must NOT have translated the camera yet.
      for (let i = 0; i < 3; i++) sys.update(1 / 60);
      const posAtInterrupt = camera.position.clone();

      // Interrupt via the REAL drag path (canvas mousedown) — the same no-snap
      // handback (_endGlideToOrbit) every interrupt uses.
      canvas._listeners.mousedown({ button: 0 });
      expect(sys._gliding).toBe(false);

      // AIM invariant: the camera never moved during the aim, so the interrupt
      // fires from the START pose. RED on HEAD: the single-channel glide has
      // already translated several units by frame 3.
      // eslint-disable-next-line no-console
      console.log(`[T5b] |posAtInterrupt-start| = ${posAtInterrupt.distanceTo(start).toFixed(4)} (want ~0 during aim)`);
      expect(posAtInterrupt.distanceTo(start)).toBeLessThan(1e-6);

      // No-snap handback: the back-solved orbit reproduces the current pose, so the
      // next update leaves the camera essentially in place. SCOPE (round-2b lens
      // record): this spec runs WITHOUT main.js's per-frame trackTarget(body) —
      // under real ordering the post-interrupt trackTarget re-derives the orbit
      // about the body and the camera converges over ~12 frames (measured strictly
      // smaller than the shipped single-channel's window; carried as a taste
      // advisory to Max's UAT, not asserted here).
      const posBeforeStep = camera.position.clone();
      sys.update(1 / 60);
      expect(camera.position.distanceTo(posBeforeStep)).toBeLessThan(1e-3);
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
