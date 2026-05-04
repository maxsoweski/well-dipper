// Canonical scenario for the welldipper-fixed-timestep-migration
// golden-trajectory verification (AC #15).
//
// What this scenario IS: a pure-math, headless-runnable simulation that
// exercises the determinism substrate the migration introduced —
// fixed-timestep accumulator + sim-clock + seeded RNG. It produces a
// deterministic sample stream matching the kit's transform-hash shape
// (`{frame, anchor: {pos, quat}}`) so `npm run verify-golden` can
// assert hash equivalence across runs.
//
// What this scenario IS NOT: a full replay of well-dipper's "warp to
// Sol → autopilot to Earth → manual disengage" trajectory. The brief's
// canonical-scenario language reads aspirationally — that scenario
// can't run in Node CLI without headless three.js + DOM, which is
// scope-creep beyond AC #15's verifiable. The canvas-recording verifiable
// in Phase 5 (AC #17) covers the actual visible-experience scenario.
//
// What it tests instead:
// - Fixed-step accumulator reproduces the same step-count for a given
//   wall-dt schedule.
// - Mulberry32 RNG threaded through sim path produces the same
//   sequence for a given seed.
// - The combination produces byte-identical sample streams across runs
//   (= the determinism floor that input-replay + golden-trajectory
//   downstream verification rely on).
//
// Scenario shape: a moving anchor whose position advances per sim tick
// via deterministic orbital math, with occasional RNG-driven direction
// flips. After 1200 sim ticks (= 20 seconds at 60 Hz), the scenario
// returns the captured samples. Anchor quat is derived from the motion
// vector for hash-shape completeness.

import { createAccumulator } from '../../vendor/motion-test-kit/core/loop/accumulator.js';
import { createRNG } from '../../vendor/motion-test-kit/core/rng/mulberry32.js';

const SCENARIO_SEED = 0x7c84;     // canonical-scenario seed (fixed)
const SIM_STEP_MS = 1000 / 60;    // 60 Hz sim
const TOTAL_FRAMES = 1200;        // 20 seconds of sim
const ORBIT_RADIUS = 5.0;
const ORBIT_ANGULAR_VEL = 0.3;    // rad/sec
const DIRECTION_FLIP_PROB = 0.02; // 2% chance per sim tick

/**
 * Run the canonical scenario. Pure function: same inputs → same output.
 *
 * @returns {Array<{ frame: number, anchor: { pos: number[], quat: number[] } }>}
 */
export function runScenario() {
  const rng = createRNG(SCENARIO_SEED);
  const acc = createAccumulator({ stepMs: SIM_STEP_MS, maxStepMs: 100 });

  // Simulated wall-dt schedule. Mirrors the Phase 1 harness's pattern
  // of 60 Hz dominant + 144 Hz spikes + occasional hitches. Drives the
  // accumulator just like a real RAF loop would.
  const dtPattern = [16, 17, 7, 16, 17, 33, 16, 16];

  const samples = [];
  let frame = 0;
  let theta = 0;
  let direction = 1;
  let simClock = 0;

  // Drive the accumulator until we've produced TOTAL_FRAMES sim ticks.
  // The dt schedule's wall time is unbounded; we stop on frame count.
  let dtIdx = 0;
  while (frame < TOTAL_FRAMES) {
    const realDtMs = dtPattern[dtIdx % dtPattern.length];
    dtIdx++;
    acc.tick(realDtMs, (stepMs) => {
      if (frame >= TOTAL_FRAMES) return;
      simClock += stepMs;
      // RNG-driven direction flip — exercises the seeded-RNG path that
      // sim-class autopilot/nav code uses post-AC-#13.
      if (rng.next() < DIRECTION_FLIP_PROB) {
        direction = -direction;
      }
      // Advance the orbital angle deterministically by sim dt.
      theta += direction * ORBIT_ANGULAR_VEL * (stepMs / 1000);
      // Anchor position: an orbit on the XZ plane, with a small
      // sim-clock-driven Y wiggle so frames aren't planar-coplanar.
      const ax = Math.cos(theta) * ORBIT_RADIUS;
      const ay = Math.sin(simClock * 0.001) * 0.5;
      const az = Math.sin(theta) * ORBIT_RADIUS;
      // Anchor quat: identity rotation + small rotation around Y axis
      // proportional to theta. Just enough to make the quat field
      // contribute meaningfully to the hash.
      const halfTheta = theta * 0.5;
      const qy = Math.sin(halfTheta);
      const qw = Math.cos(halfTheta);
      samples.push({
        frame,
        anchor: { pos: [ax, ay, az], quat: [0, qy, 0, qw] },
      });
      frame++;
    });
  }

  return samples;
}

export const scenarioName = 'canonical-scenario-v1';
