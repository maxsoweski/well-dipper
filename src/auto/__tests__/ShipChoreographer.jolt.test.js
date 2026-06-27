import { describe, it, expect, beforeEach } from 'vitest';
import { ShipChoreographer } from '../ShipChoreographer.js';

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
