import { describe, it, expect, beforeEach } from 'vitest';
import { ShipChoreographer } from '../ShipChoreographer.js';
import { _seedSimRandom } from '../../core/SimRandom.js';

// ─────────────────────────────────────────────────────────────────────────
//  Task 4 — enter-swell / drop-jolt shake envelopes (AC7).
//
//  The cruise tremor is a subtle sustained turbulence (peak pitch/yaw 0.2°,
//  roll 0.1°, over 1.5s). The manual-drive enter/drop beats are deliberately
//  BIGGER and SHORTER: a single felt "thump" when you engage or drop the
//  supercruise drive. These tests assert (a) a jolt's peak rotation exceeds
//  the cruise tremor's peak, and (b) the jolt is rotation-only (the public
//  surface produces euler angles, never a camera position).
// ─────────────────────────────────────────────────────────────────────────

// Minimal nav stub — ShipChoreographer only reaches into nav.travelDuration /
// nav.travelElapsed inside _startTremorEvent's clamp, and only when its own
// phase is CRUISE. We deliberately leave those undefined so the clamp is a
// no-op and jolts always run their full authored duration.
function makeNav() {
  return {};
}

function makeChoreographer() {
  const c = new ShipChoreographer(makeNav());
  // Kick it out of IDLE so update() runs the envelope sampler. Non-warp tour
  // => phase CRUISE. The jolt one-shots bypass the trigger/phase gates anyway
  // (they are modeled on the debug fires), but update() early-returns while
  // IDLE, so we must leave IDLE first.
  c.beginTour({ fromWarp: false });
  return c;
}

// Step the choreographer for `seconds` worth of frames at 60fps with a
// 'traveling' pseudo motion-frame, tracking the maximum |euler| component
// magnitude seen across the run.
function sampleMaxShake(c, seconds, opts = {}) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  const phase = opts.phase ?? 'traveling';
  let max = { pitch: 0, yaw: 0, roll: 0, magnitude: 0 };
  for (let i = 0; i < steps; i++) {
    c.update(dt, {
      position: { x: 0, y: 0, z: 0 },
      phase,
      motionStarted: false,
      isShortTrip: false,
      warpExit: false,
    });
    const se = c.shakeEuler;
    const ap = Math.abs(se.pitch);
    const ay = Math.abs(se.yaw);
    const ar = Math.abs(se.roll);
    if (ap > max.pitch) max.pitch = ap;
    if (ay > max.yaw) max.yaw = ay;
    if (ar > max.roll) max.roll = ar;
    const mag = Math.max(ap, ay, ar);
    if (mag > max.magnitude) max.magnitude = mag;
  }
  return max;
}

// The cruise tremor peak (envelope max × carrier=1) for the dominant axis.
// pitch/yaw peak is 0.2°; we compare jolt peaks against this in radians.
const CRUISE_TREMOR_PEAK_RAD = 0.2 * (Math.PI / 180);

describe('ShipChoreographer enter/drop jolt envelopes', () => {
  let c;
  beforeEach(() => {
    c = makeChoreographer();
  });

  it('dropImpulse peak rotation exceeds the cruise tremor peak', () => {
    c.dropImpulse();
    const peak = sampleMaxShake(c, 1.0);
    expect(peak.magnitude).toBeGreaterThan(CRUISE_TREMOR_PEAK_RAD);
  });

  it('enterImpulse peak rotation exceeds the cruise tremor peak', () => {
    c.enterImpulse();
    const peak = sampleMaxShake(c, 1.0);
    expect(peak.magnitude).toBeGreaterThan(CRUISE_TREMOR_PEAK_RAD);
  });

  it('jolt peak exceeds an actual debug cruise-tremor peak measured live', () => {
    // Measure the cruise tremor empirically rather than trusting the constant.
    const tremorC = makeChoreographer();
    tremorC.debugAccelImpulse();
    const tremorPeak = sampleMaxShake(tremorC, 2.0).magnitude;

    const joltC = makeChoreographer();
    joltC.dropImpulse();
    const joltPeak = sampleMaxShake(joltC, 1.0).magnitude;

    expect(joltPeak).toBeGreaterThan(tremorPeak);
  });

  it('jolt is rotation-only — public surface produces only euler, never a position', () => {
    c.dropImpulse();
    sampleMaxShake(c, 0.3);
    const se = c.shakeEuler;
    expect(se).toHaveProperty('pitch');
    expect(se).toHaveProperty('yaw');
    expect(se).toHaveProperty('roll');
    // No position field is produced by the shake surface.
    expect(se).not.toHaveProperty('x');
    expect(se).not.toHaveProperty('position');
    // shakeOffset stays the zero singleton (AC #19 invariant — never written).
    expect(c.shakeOffset.x).toBe(0);
    expect(c.shakeOffset.y).toBe(0);
    expect(c.shakeOffset.z).toBe(0);
  });

  it('jolt fires even outside the traveling phase (drop-out can happen anytime)', () => {
    // Drop-out leaves you In-Flight but drive-idle; the pilot maps HOLD →
    // 'orbiting'. The jolt must still play (it bypasses the phase gate).
    c.dropImpulse();
    const peak = sampleMaxShake(c, 1.0, { phase: 'orbiting' });
    expect(peak.magnitude).toBeGreaterThan(CRUISE_TREMOR_PEAK_RAD);
  });

  it('drop jolt out-lives a mid-ring phase flip (lifetime-on-drop, AC7/T7)', () => {
    // T7 caveat: pressing E to drop out fires dropImpulse() and THEN flips the
    // drive off — we STAY In-Flight so the sc-compose branch stays live, but the
    // motion-frame phase the choreographer sees can change from 'traveling' to a
    // non-traveling phase on the very next frame (e.g. an assist pilot that was
    // mid-leg snaps to HOLD → 'orbiting'). The drop beat must NOT be cut short by
    // that flip; the belt-and-suspenders gate exempts an active jolt so it rings
    // out fully even when driveOn=false changes the surrounding phase.
    c.dropImpulse();
    // First frame: fire the jolt while still 'traveling' (the last driving frame).
    c.update(1 / 60, {
      position: { x: 0, y: 0, z: 0 },
      phase: 'traveling',
      motionStarted: false,
      isShortTrip: false,
      warpExit: false,
    });
    // Now flip the surrounding phase to non-traveling (the drive went idle) and
    // keep stepping through the rest of the jolt window. The shake must stay
    // non-zero across the flip rather than being silenced on the transition.
    let maxAfterFlip = 0;
    const dt = 1 / 60;
    const steps = Math.round(0.4 / dt); // jolt duration is <=0.8s; 0.4s is well inside
    for (let i = 0; i < steps; i++) {
      c.update(dt, {
        position: { x: 0, y: 0, z: 0 },
        phase: 'orbiting', // drive idle / pilot HOLD — was 'traveling' last frame
        motionStarted: false,
        isShortTrip: false,
        warpExit: false,
      });
      const se = c.shakeEuler;
      const mag = Math.max(Math.abs(se.pitch), Math.abs(se.yaw), Math.abs(se.roll));
      if (mag > maxAfterFlip) maxAfterFlip = mag;
    }
    // The drop beat survived the phase flip and kept composing.
    expect(maxAfterFlip).toBeGreaterThan(CRUISE_TREMOR_PEAK_RAD);
  });

  it('drop jolt is not double-driven by an incidental cruise tremor on the same frame', () => {
    // T7: on autopilot legs the pilot phase edges fire debugAccelImpulse (CRUISE)
    // / debugDecelImpulse. If a manual drop lands on the same frame as a pending
    // cruise tremor, the JOLT must win (manual beat takes precedence) — the two
    // must NOT both drive shakeEuler, which would compound into an over-large
    // rotation. Queueing both then stepping must yield exactly the jolt envelope,
    // identical to a clean drop with no competing debug fire. Seed the RNG before
    // each run so the carrier phases match and the peaks are directly comparable
    // (simRandom is one shared advancing sequence, so without re-seeding the two
    // choreographers would draw different carriers).
    _seedSimRandom(1234);
    const combined = makeChoreographer();
    combined.dropImpulse();
    combined.debugAccelImpulse(); // also pending on the same frame
    const combinedPeak = sampleMaxShake(combined, 1.0).magnitude;

    _seedSimRandom(1234);
    const clean = makeChoreographer();
    clean.dropImpulse();
    const cleanPeak = sampleMaxShake(clean, 1.0).magnitude;

    // The combined-fire peak equals the clean jolt peak — the jolt replaced the
    // debug tremor; they did not sum into a bigger rotation.
    expect(combinedPeak).toBeCloseTo(cleanPeak, 10);
  });

  it('jolt decays back to zero after its (short) duration', () => {
    c.dropImpulse();
    // Run well past the jolt duration (<=0.8s); afterward shake is silent.
    sampleMaxShake(c, 1.2);
    // One more settled frame.
    c.update(1 / 60, {
      position: { x: 0, y: 0, z: 0 },
      phase: 'traveling',
      motionStarted: false,
      isShortTrip: false,
      warpExit: false,
    });
    const se = c.shakeEuler;
    expect(Math.abs(se.pitch)).toBe(0);
    expect(Math.abs(se.yaw)).toBe(0);
    expect(Math.abs(se.roll)).toBe(0);
  });
});
