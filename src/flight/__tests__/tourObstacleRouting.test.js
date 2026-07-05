// tour-body-reachability-2026-07-05, Defect 1 (barrier-pin carousel). The tour
// pilot flies a straight line at each target and tourStandoff.planLeg only routes
// around the STAR — so a moon on the far side of its parent planet is flown at
// THROUGH the planet, the collision barrier pins the ship at speed 0, the
// cap-relative stall correctly aborts, and the tour re-dispatches from the pinned
// spot → carousel. These pure functions generalize the star go-around to any
// non-star obstacle. planLeg / segmentCrossesSphere / goAroundWaypoint stay
// byte-identical (tourStandoff.test.js is the AC5 regression witness).
//
// Hand-built geometry with an INDEPENDENT sampled-distance oracle (copied from
// tourStandoff.test.js), never a mirror of the implementation formula.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  firstBlockingObstacle,
  obstacleKeepOutRadius,
  OBSTACLE_KEEP_OUT_FACTOR,
  planLegObstacle,
  goAroundWaypoint,
  segmentCrossesSphere,
} from '../tourStandoff.js';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PilotPhase } from '../SupercruisePilot.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Independent oracle: min distance from center C to the segment P->T by dense
// sampling (NOT the closest-approach formula the code uses). Copied in-spirit
// from tourStandoff.test.js so the proof does not mirror the implementation.
function sampledMinDist(P, T, C, samples = 2000) {
  let min = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = V(P.x + (T.x - P.x) * t, P.y + (T.y - P.y) * t, P.z + (T.z - P.z) * t);
    min = Math.min(min, p.distanceTo(C));
  }
  return min;
}

describe('obstacleKeepOutRadius / OBSTACLE_KEEP_OUT_FACTOR', () => {
  it('factor is 1.5 and radius scales linearly (band: >1.05 barrier, *1.2 clearance stays <2.6 park)', () => {
    expect(OBSTACLE_KEEP_OUT_FACTOR).toBe(1.5);
    expect(obstacleKeepOutRadius({ radius: 4 })).toBeCloseTo(6, 9);
    expect(obstacleKeepOutRadius({ radius: 0.02 })).toBeCloseTo(0.03, 9);
  });
});

describe('firstBlockingObstacle — nearest crossed obstacle by clamped closest-approach t, local-vector safe', () => {
  it('null when the straight path clears every obstacle', () => {
    const P = V(0, 0, 0), T = V(10, 0, 0);
    const obstacles = [{ pos: V(5, 5, 0), keepOut: 1 }, { pos: V(2, -4, 0), keepOut: 1 }];
    expect(firstBlockingObstacle(P, T, obstacles)).toBe(null);
  });

  it('returns the single crossed obstacle', () => {
    const P = V(0, 0, 0), T = V(10, 0, 0);
    const hit = { pos: V(5, 0.5, 0), keepOut: 1 };
    const obstacles = [{ pos: V(5, 5, 0), keepOut: 1 }, hit];
    expect(firstBlockingObstacle(P, T, obstacles)).toBe(hit);
  });

  it('with two crossed obstacles returns the one entered FIRST (t=0.3 beats t=0.7, hand-computed)', () => {
    const P = V(0, 0, 0), T = V(10, 0, 0); // dir=(10,0,0), lenSq=100
    const A = { pos: V(3, 0.5, 0), keepOut: 1 }; // closest-approach t = 30/100 = 0.3, perp 0.5 < 1 → crossed
    const B = { pos: V(7, 0.5, 0), keepOut: 1 }; // t = 70/100 = 0.7, perp 0.5 < 1 → crossed
    expect(firstBlockingObstacle(P, T, [B, A])).toBe(A); // order-independent: nearest t wins
    // interleave a segmentCrossesSphere call (which uses module scratch) to prove
    // firstBlockingObstacle does NOT share it (red-team attack #8):
    expect(segmentCrossesSphere(V(0, 0, 0), V(1, 0, 0), V(9, 9, 9), 0.1)).toBe(false);
    expect(firstBlockingObstacle(P, T, [B, A])).toBe(A);
  });

  it('ship starting INSIDE an obstacle: t clamps to 0, that obstacle is returned first (escape-first)', () => {
    const P = V(0, 0, 0), T = V(10, 0, 0);
    const E = { pos: V(-0.1, 0, 0), keepOut: 1 }; // P is 0.1 from E center (<1) → inside; center behind P → t clamps 0
    const far = { pos: V(5, 0.4, 0), keepOut: 1 }; // also crossed, at t=0.5
    expect(firstBlockingObstacle(P, T, [far, E])).toBe(E);
  });

  it('degenerate zero-length segment: point-in-sphere at P', () => {
    const P = V(1, 1, 1), T = V(1, 1, 1);
    expect(firstBlockingObstacle(P, T, [{ pos: V(1, 1, 1.5), keepOut: 1 }])).not.toBe(null);
    expect(firstBlockingObstacle(P, T, [{ pos: V(9, 9, 9), keepOut: 1 }])).toBe(null);
  });
});

describe('planLegObstacle — far-side-moon core case, routed path clears the collision barrier', () => {
  it('clear leg → {obstacle:null}', () => {
    const res = planLegObstacle({ shipPos: V(0, 0, 20), targetPos: V(0, 0, -20), obstacles: [{ pos: V(30, 0, 0), keepOut: 6 }] });
    expect(res.obstacle).toBe(null);
    expect(res.waypoint).toBe(null);
  });

  it('far-side moon behind its planet: obstacle=planet, and (inflated) go-around clears the 1.05R barrier on BOTH sub-segments', () => {
    // Planet R=4 at origin. keep-out = 1.5*4 = 6. Moon target on the far side at
    // (0,0,-9) (radius 4 barrier is 4.2). Ship on the near side at (0,0,11).
    const planetR = 4, C = V(0, 0, 0);
    const keepOut = obstacleKeepOutRadius({ radius: planetR }); // 6
    const shipPos = V(0, 0, 11), targetPos = V(0, 0, -9);
    const res = planLegObstacle({ shipPos, targetPos, obstacles: [{ pos: C, keepOut }] });
    expect(res.obstacle).not.toBe(null);
    expect(res.obstacle.keepOut).toBeCloseTo(6, 9);

    // main.js places the waypoint at the SAFETY-inflated keep-out (6 * 1.2 = 7.2).
    const SAFETY = 1.2;
    const W = goAroundWaypoint(shipPos, targetPos, C, keepOut * SAFETY);
    const barrier = 1.05 * planetR; // 4.2
    // Independent oracle: BOTH sub-segments clear the collision barrier.
    expect(sampledMinDist(shipPos, W, C)).toBeGreaterThan(barrier);
    expect(sampledMinDist(W, targetPos, C)).toBeGreaterThan(barrier);
  });

  it('moon-never-engulfed invariant: a target moon at 6R from its planet sits OUTSIDE the 1.5R inflated keep-out', () => {
    // Physical min moon orbit ~6R (MoonGenerator). With factor 1.5, keep-out 6R
    // never engulfs a moon at >=6R distance — so the moon is a valid target, not
    // detected as its own parent's obstacle.
    const planetR = 4;
    const keepOut = obstacleKeepOutRadius({ radius: planetR }); // 6
    const moonDist = 6 * planetR; // 24
    expect(moonDist).toBeGreaterThan(keepOut);
  });
});

// End-to-end proof with the REAL SupercruiseModel + SupercruisePilot (the
// SupercruisePilot.standoff.test.js harness): a far-side moon behind its parent
// planet. DIRECT flight reproduces the barrier-pin + stall-abort (the bug);
// ROUTED flight (go-around waypoint, then the moon) reaches HOLD and is never
// pinned against the planet. NO SC_TUNING / pilot code touched.
describe('pilot-level reachability — routed leg reaches a far-side moon, direct leg pins (AC1 mechanism)', () => {
  const DT = 1 / 60;
  const planetR = 4, R_moon = 0.5, SAFETY = 1.2;
  const planetC = V(0, 0, 0);
  const bodies = [{ position: planetC, radius: planetR }, { position: V(0, 0, -30), radius: R_moon }];
  const moon = { position: V(0, 0, -30) };

  // Runs the pilot+model loop (setBodies each tick), tracking min distance to the
  // planet CENTER. Breaks on motionComplete OR stallAbort.
  function run(model, pilot, maxFrames) {
    let minDist = Infinity, sawAbort = false, complete = false, reachedHold = false, i = 0;
    for (; i < maxFrames; i++) {
      model.setBodies(bodies.map((b) => ({ position: b.position, radius: b.radius })));
      const f = pilot.update(DT);
      model.update(DT);
      minDist = Math.min(minDist, model.position.distanceTo(planetC));
      if (f.stallAborted) sawAbort = true;
      if (pilot.phase === PilotPhase.HOLD) reachedHold = true;
      if (f.motionComplete) { complete = true; break; }
      if (f.stallAborted) break;
    }
    return { minDist, sawAbort, complete, reachedHold, frames: i };
  }

  it('DIRECT leg straight through the parent planet PINS the ship and stall-aborts (non-vacuous: the bug)', () => {
    const model = new SupercruiseModel();
    model.position.set(0, 0, 60);
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: moon, bodyRadius: R_moon, linger: 2 });
    const r = run(model, pilot, 60 * 30);
    expect(r.sawAbort).toBe(true);                       // the cap-relative CRUISE stall fires
    expect(r.minDist).toBeLessThan(1.05 * planetR + 0.5); // rammed to the ~4.2 collision barrier
  });

  it('ROUTED leg (go-around waypoint, then the moon) reaches HOLD and is NEVER pinned', () => {
    const model = new SupercruiseModel();
    model.position.set(0, 0, 60);
    const pilot = new SupercruisePilot(model);
    const keepOut = obstacleKeepOutRadius({ radius: planetR }); // 6
    const oPlan = planLegObstacle({ shipPos: model.position, targetPos: moon.position, obstacles: [{ pos: planetC, keepOut }] });
    expect(oPlan.obstacle).not.toBe(null);
    const W = goAroundWaypoint(model.position, moon.position, oPlan.obstacle.pos, oPlan.obstacle.keepOut * SAFETY);

    pilot.beginLeg({ toPosition: W, bodyRadius: 1, linger: 0 }); // leg 1: the waypoint
    const r1 = run(model, pilot, 60 * 30);
    expect(r1.sawAbort).toBe(false);
    expect(r1.complete).toBe(true);

    pilot.beginLeg({ toBody: moon, bodyRadius: R_moon, linger: 2 }); // leg 2: the moon
    const r2 = run(model, pilot, 60 * 30);
    expect(r2.sawAbort).toBe(false);
    expect(r2.complete).toBe(true);
    expect(r2.reachedHold).toBe(true);
    expect(Math.min(r1.minDist, r2.minDist)).toBeGreaterThan(1.05 * planetR); // flew AROUND, never pinned
  });
});
