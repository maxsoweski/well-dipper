// src/flight/__tests__/tourStandoff.test.js
//
// Increment 1 (autopilot-standoff-routing-2026-07-01) — pure geometry unit tests.
// TDD RED-first for the pure helpers that keep the tour out of the star's
// restricted zone and route around it, with DECOUPLED park vs keep-out radii:
//   AC1 starParkRadius / starKeepOutRadius — the two decoupled star distances
//   AC2 segmentCrossesSphere               — does the leg P->T cross the keep-out sphere
//   AC3 goAroundWaypoint                   — a BOUNDED detour W clearing BOTH sub-segments
//   AC5 planLeg                            — the pure {waypoint,standoff} decision seam
//
// No SC_TUNING is touched anywhere here — this is pure routing geometry. The AC3
// "clears" oracle is an INDEPENDENT sampled min-distance check, NOT the module's
// own segmentCrossesSphere, so a bug shared between the module helper and the
// waypoint placement cannot hide behind a self-consistent check.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  starParkRadius,
  starKeepOutRadius,
  segmentCrossesSphere,
  goAroundWaypoint,
  planLeg,
  KEEP_OUT_FACTOR,
  PARK_MIN_FACTOR,
} from '../tourStandoff.js';

// ── Independent oracle: min distance from the segment [P,T] to center C, by
//    dense sampling. Deliberately NOT the analytic projection the module uses. ──
function sampledMinDist(P, T, C, n = 4000) {
  let minSq = Infinity;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = P.x + (T.x - P.x) * s;
    const y = P.y + (T.y - P.y) * s;
    const z = P.z + (T.z - P.z) * s;
    const dx = x - C.x, dy = y - C.y, dz = z - C.z;
    const dsq = dx * dx + dy * dy + dz * dz;
    if (dsq < minSq) minSq = dsq;
  }
  return Math.sqrt(minSq);
}
// "Clears" per the oracle: closest approach stays at/above the radius (a hair of
// sampling + float slop tolerated). Independent of the module's own test.
const oracleClears = (P, T, C, r) => sampledMinDist(P, T, C, r) >= r * 0.999;

describe('tourStandoff radii (AC1) — DECOUPLED park vs keep-out, hand-computed', () => {
  const R = 4.65; // representative G-star radius
  // Hand-computed constants (NOT a formula mirror):
  const KEEP_OUT = 16.275;   // = 3.5 * 4.65
  const RAW_8R = 37.2;       // = 8 * 4.65

  it('exposes the named factors (keep-out above the crawl/barrier, park bump ratio)', () => {
    expect(KEEP_OUT_FACTOR).toBe(3.5);
    expect(PARK_MIN_FACTOR).toBe(1.3);
    // keep-out must sit above the 2.5R crawl-onset and the 1.05R barrier.
    expect(KEEP_OUT_FACTOR).toBeGreaterThan(2.5);
    expect(KEEP_OUT_FACTOR).toBeGreaterThan(1.05);
  });

  it('keep-out = 3.5R exactly, independent of the inner orbit', () => {
    expect(starKeepOutRadius({ starRadius: R })).toBeCloseTo(KEEP_OUT, 6);
  });

  it('wide orbit → park = 8R (37.2), strictly > keep-out (16.275) > 2.5R > 1.05R', () => {
    const park = starParkRadius({ starRadius: R, innerOrbitRadius: 200 }); // 0.6*200=120 > 37.2
    const keepOut = starKeepOutRadius({ starRadius: R });
    expect(park).toBeCloseTo(RAW_8R, 6);           // hand: 37.2
    expect(keepOut).toBeCloseTo(KEEP_OUT, 6);       // hand: 16.275
    expect(park).toBeGreaterThan(keepOut);
    expect(keepOut).toBeGreaterThan(2.5 * R);       // 16.275 > 11.625
    expect(keepOut).toBeGreaterThan(1.05 * R);      // 16.275 > 4.8825
  });

  it('tight orbit → park = 0.6*innerOrbit (30), still > keep-out', () => {
    const park = starParkRadius({ starRadius: R, innerOrbitRadius: 50 }); // 0.6*50=30 < 37.2
    expect(park).toBeCloseTo(30, 6);                // hand: 0.6*50
    expect(park).toBeGreaterThan(starKeepOutRadius({ starRadius: R }));
  });

  it('PATHOLOGICAL ultra-tight orbit → raw park (6) would fall BELOW keep-out; bumped to keepOut*1.3', () => {
    // 0.6*10 = 6 < keep-out 16.275 → the raw min(8R,0.6*orbit) is below keep-out.
    const park = starParkRadius({ starRadius: R, innerOrbitRadius: 10 });
    const keepOut = starKeepOutRadius({ starRadius: R });
    // Bumped up to keepOut * 1.3 = 21.1575 (hand-computed), NOT the raw 6.
    expect(park).toBeCloseTo(21.1575, 4);
    expect(park).toBeGreaterThan(keepOut);          // the decoupling invariant holds
    expect(park).not.toBeCloseTo(6, 1);             // NOT the naive raw value
  });

  it('no inner planet (Infinity) → park = 8R (37.2), finite, > keep-out', () => {
    const park = starParkRadius({ starRadius: R, innerOrbitRadius: Infinity });
    expect(park).toBeCloseTo(RAW_8R, 6);
    expect(Number.isFinite(park)).toBe(true);
    expect(park).toBeGreaterThan(starKeepOutRadius({ starRadius: R }));
  });
});

describe('tourStandoff.segmentCrossesSphere (AC2)', () => {
  const C = new THREE.Vector3(0, 0, 0);
  const radius = 37;

  it('(a) TRUE when the star sits between P and T (far-side leg)', () => {
    const P = new THREE.Vector3(0, 0, 50);
    const T = new THREE.Vector3(0, 0, -1000);
    expect(segmentCrossesSphere(P, T, C, radius)).toBe(true);
  });

  it('(b) FALSE when the line clears the sphere (star off to the side)', () => {
    const P = new THREE.Vector3(0, 0, 50);
    const T = new THREE.Vector3(200, 0, 50);
    expect(segmentCrossesSphere(P, T, C, radius)).toBe(false);
  });

  it('(c) P already inside the sphere is treated as crossing (no NaN)', () => {
    const P = new THREE.Vector3(10, 0, 0); // |P-C| = 10 < 37
    const T = new THREE.Vector3(500, 0, 0);
    const r = segmentCrossesSphere(P, T, C, radius);
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBe(true);
  });

  it('clamps to the SEGMENT — the infinite line would hit but the segment stops short', () => {
    const P = new THREE.Vector3(0, 0, 100);
    const T = new THREE.Vector3(0, 0, 300);
    expect(segmentCrossesSphere(P, T, C, radius)).toBe(false);
  });

  it('degenerate zero-length segment outside the sphere is FALSE (no NaN)', () => {
    const P = new THREE.Vector3(0, 0, 100);
    const r = segmentCrossesSphere(P, P.clone(), C, radius);
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBe(false);
  });
});

describe('tourStandoff.goAroundWaypoint (AC3) — BOUNDED detour, INDEPENDENT oracle', () => {
  const C = new THREE.Vector3(0, 0, 0);

  it('(a) on-axis far-side: HAND-COMPUTED W and bounded |W-C| (independent-oracle-clear)', () => {
    const keepOut = 16.275; // = 3.5 * 4.65
    // P well outside the keep-out sphere (2.5·keepOut) so the first margin (1.2)
    // clears — the perpendicular fallback for a through-center segment picks +y
    // (deterministic axis selection), giving W = (0, 1.2·keepOut, 0).
    const P = new THREE.Vector3(0, 0, 2.5 * keepOut);
    const T = new THREE.Vector3(0, 0, -1000);
    expect(segmentCrossesSphere(P, T, C, keepOut)).toBe(true); // precondition: crosses

    const W = goAroundWaypoint(P, T, C, keepOut);
    // Hand-computed oracle: W ≈ (0, 1.2·keepOut, 0).
    expect(W.x).toBeCloseTo(0, 4);
    expect(W.y).toBeCloseTo(1.2 * keepOut, 4);
    expect(W.z).toBeCloseTo(0, 4);
    // Bounded: |W-C| < 2·keepOut (never asymptotes).
    expect(W.distanceTo(C)).toBeLessThan(2 * keepOut);
    // BOTH sub-segments clear per the INDEPENDENT sampled oracle.
    expect(oracleClears(P, W, C, keepOut)).toBe(true);
    expect(oracleClears(W, T, C, keepOut)).toBe(true);
  });

  it('(b) off-axis crossing: bounded W, both sub-segments clear (independent oracle)', () => {
    const radius = 37;
    const P = new THREE.Vector3(-20, 0, 90);
    const T = new THREE.Vector3(20, 0, -800);
    expect(segmentCrossesSphere(P, T, C, radius)).toBe(true);
    const W = goAroundWaypoint(P, T, C, radius);
    expect(W.distanceTo(C)).toBeGreaterThan(radius);
    expect(W.distanceTo(C)).toBeLessThan(2 * radius); // bounded near-tangent
    expect(oracleClears(P, W, C, radius)).toBe(true);
    expect(oracleClears(W, T, C, radius)).toBe(true);
  });

  it('(c) REAL departure: ship parked at PARK on the star far side → clears (would FAIL vs unified park==keepOut)', () => {
    // Decoupled radii for a real G-star: keepOut 16.275, park 37.2. The ship sits
    // at PARK on the far side of the planet — OUTSIDE the keep-out sphere (the
    // on-sphere degeneracy that flung the rejected unified design's waypoint to
    // ~40000·R is gone because park (2.29·keepOut) ≠ keepOut).
    const keepOut = starKeepOutRadius({ starRadius: 4.65 });          // 16.275
    const park = starParkRadius({ starRadius: 4.65, innerOrbitRadius: Infinity }); // 37.2
    const P = new THREE.Vector3(0, 0, park);       // parked at the star, far side
    const T = new THREE.Vector3(0, 0, -300);       // planet on the near side
    expect(P.distanceTo(C)).toBeGreaterThan(keepOut); // starts OUTSIDE keep-out
    expect(segmentCrossesSphere(P, T, C, keepOut)).toBe(true); // still a far-side leg

    const W = goAroundWaypoint(P, T, C, keepOut);
    expect(W.distanceTo(C)).toBeGreaterThan(keepOut);
    expect(W.distanceTo(C)).toBeLessThan(2 * keepOut); // BOUNDED (the blocker fix)
    expect(oracleClears(P, W, C, keepOut)).toBe(true);
    expect(oracleClears(W, T, C, keepOut)).toBe(true);
  });
});

describe('tourStandoff.planLeg (AC5) — pure decision seam', () => {
  const C = new THREE.Vector3(0, 0, 0);
  const keepOut = 16.275;
  const park = 37.2;

  it('CLEAR leg (path does not cross keep-out) → no waypoint, no standoff override', () => {
    const shipPos = new THREE.Vector3(0, 0, 50);
    const targetPos = new THREE.Vector3(200, 0, 50); // off to the side, clear
    const plan = planLeg({ shipPos, targetPos, targetIsStar: false, starPos: C, keepOut, park });
    expect(plan.waypoint).toBeNull();
    expect(plan.standoff).toBeNull();
  });

  it('CROSSING leg (far side of the star) → a go-around waypoint, no standoff', () => {
    const shipPos = new THREE.Vector3(0, 0, park); // parked at the star, far side
    const targetPos = new THREE.Vector3(0, 0, -300);
    const plan = planLeg({ shipPos, targetPos, targetIsStar: false, starPos: C, keepOut, park });
    expect(plan.waypoint).not.toBeNull();
    expect(plan.waypoint).toBeInstanceOf(THREE.Vector3);
    expect(plan.standoff).toBeNull();
    // The returned waypoint is the bounded go-around point.
    expect(plan.waypoint.distanceTo(C)).toBeGreaterThan(keepOut);
    expect(plan.waypoint.distanceTo(C)).toBeLessThan(2 * keepOut);
  });

  it('STAR target → standoff = PARK, no waypoint (park OUTSIDE the well)', () => {
    const shipPos = new THREE.Vector3(0, 0, 500);
    const plan = planLeg({ shipPos, targetPos: C, targetIsStar: true, starPos: C, keepOut, park });
    expect(plan.waypoint).toBeNull();
    expect(plan.standoff).toBe(park);
  });
});
