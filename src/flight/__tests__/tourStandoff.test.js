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

// ── Standalone CLOSED-FORM ray/sphere check (quadratic roots), INDEPENDENT of
//    the module's projection-clamp segmentCrossesSphere — deliberately a
//    different derivation (root-interval overlap, not vertex-clamp) so a bug
//    shared between the module and its own verification cannot hide. ──
function closedFormSegmentHitsSphere(P, Q, C, r) {
  const dx = Q.x - P.x, dy = Q.y - P.y, dz = Q.z - P.z;
  const a = dx * dx + dy * dy + dz * dz;
  const ex = P.x - C.x, ey = P.y - C.y, ez = P.z - C.z;
  if (a < 1e-18) return (ex * ex + ey * ey + ez * ez) < r * r; // degenerate: point test
  const b = 2 * (ex * dx + ey * dy + ez * dz);
  const c = (ex * ex + ey * ey + ez * ez) - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false; // infinite line never touches the sphere
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  // Segment [0,1] intersects the sphere-interior interval [t1,t2] iff they overlap.
  return t1 <= 1 && t2 >= 0;
}

// ── Parametric monotonic-escape check (AC3-B property (ii)): sample distance
//    to C along P->W and assert it never decreases. Independent of both the
//    module's internals and the closed-form check above. ──
function isMonotonicNonDecreasing(P, W, C, n = 1000) {
  let prev = -Infinity;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = P.x + (W.x - P.x) * s;
    const y = P.y + (W.y - P.y) * s;
    const z = P.z + (W.z - P.z) * s;
    const dx = x - C.x, dy = y - C.y, dz = z - C.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < prev - 1e-6) return false; // tiny float slop tolerated
    prev = d;
  }
  return true;
}

describe('tourStandoff.goAroundWaypoint (AC3-B) — escape-first from ON/INSIDE the keep-out sphere', () => {
  const C = new THREE.Vector3(0, 0, 0);
  const keepOut = 16.275; // = 3.5 * 4.65, same representative star as AC1/AC3

  it('(a) P INSIDE at 0.75*keepOut, T antipodal — hand-computed pure-radial oracle, monotonic escape', () => {
    // T is exactly antipodal through C (same axis as P): the tangential blend
    // component is zero by construction, so the escape is PURE radial and hand-
    // computable: W = C + normalize(P-C) * keepOut * 1.2 (the module's existing
    // first near-tangent margin, reused for the escape placement).
    const P = new THREE.Vector3(0, 0, 0.75 * keepOut);
    const T = new THREE.Vector3(0, 0, -1000); // antipodal side of C from P
    expect(P.distanceTo(C)).toBeLessThan(keepOut); // precondition: starts INSIDE

    const W = goAroundWaypoint(P, T, C, keepOut);

    expect(Number.isNaN(W.x) || Number.isNaN(W.y) || Number.isNaN(W.z)).toBe(false);
    // Hand-computed: W = (0, 0, 1.2*keepOut) exactly (pure radial, no blend).
    expect(W.x).toBeCloseTo(0, 6);
    expect(W.y).toBeCloseTo(0, 6);
    expect(W.z).toBeCloseTo(1.2 * keepOut, 6);

    // (i) W lies outside the (inflated) sphere.
    expect(W.distanceTo(C)).toBeGreaterThan(keepOut);
    expect(closedFormSegmentHitsSphere(W, W.clone(), C, keepOut)).toBe(false); // W itself is outside
    // Escape property: strictly farther from C than the start.
    expect(W.distanceTo(C)).toBeGreaterThan(P.distanceTo(C));
    // (ii) P->W is monotonically non-decreasing in distance to C (parametric check).
    expect(isMonotonicNonDecreasing(P, W, C)).toBe(true);
  });

  it('(b) P EXACTLY ON the sphere — no NaN, escape still fires, monotonic', () => {
    const P = new THREE.Vector3(0, 0, keepOut); // |P-C| == keepOut exactly
    const T = new THREE.Vector3(0, 0, -500);
    expect(P.distanceTo(C)).toBeCloseTo(keepOut, 9);

    const W = goAroundWaypoint(P, T, C, keepOut);

    expect(Number.isNaN(W.x) || Number.isNaN(W.y) || Number.isNaN(W.z)).toBe(false);
    expect(W.distanceTo(C)).toBeGreaterThan(keepOut);
    expect(W.distanceTo(C)).toBeGreaterThanOrEqual(P.distanceTo(C));
    expect(isMonotonicNonDecreasing(P, W, C)).toBe(true);
  });

  it('(c) near-boundary antipodal OUTSIDE the sphere — matches inc-1 bounded best-effort (unchanged)', () => {
    // P is just OUTSIDE the sphere (1.01*keepOut), T antipodal through C — must
    // NOT trigger the new escape branch (P starts outside). This is inc-1's
    // documented PATHOLOGICAL case (module header: "for pathological
    // near-boundary antipodal geometry the capped best-effort W is returned
    // (still outside the sphere)") — P is so close to the boundary that NO
    // margin up to the 1.6 cap clears the P->W sub-segment (hand-verified: the
    // required margin to clear is ~7x, far past the cap), so the loop exhausts
    // all 4 margins and falls through to the LAST one (1.6). This is EXISTING,
    // pre-AC3-B behavior — hand-computed here, not asserted as "clears".
    const P = new THREE.Vector3(0, 0, 1.01 * keepOut);
    const T = new THREE.Vector3(0, 0, -1000); // antipodal far side
    expect(P.distanceTo(C)).toBeGreaterThan(keepOut); // precondition: starts OUTSIDE
    expect(segmentCrossesSphere(P, T, C, keepOut)).toBe(true);

    const W = goAroundWaypoint(P, T, C, keepOut);

    expect(Number.isNaN(W.x) || Number.isNaN(W.y) || Number.isNaN(W.z)).toBe(false);
    // Hand-computed fallback: through-center perpendicular n=(0,1,0), capped
    // margin 1.6 (the loop cannot clear P->W for this near-boundary geometry).
    expect(W.x).toBeCloseTo(0, 6);
    expect(W.y).toBeCloseTo(1.6 * keepOut, 6);
    expect(W.z).toBeCloseTo(0, 6);
    // W itself is still strictly outside the sphere and bounded (< 2*keepOut) —
    // the invariant the module DOES guarantee even in the pathological case.
    expect(W.distanceTo(C)).toBeGreaterThan(keepOut);
    expect(W.distanceTo(C)).toBeLessThan(2 * keepOut);
    // Independent closed-form check confirms (does NOT contradict) the module's
    // own documented caveat: the capped best-effort sub-segment genuinely still
    // dips inside the sphere here — that gap is closed by the caller's
    // per-frame clearance switch + SC_GOAROUND_CAP + WS-1 backstop, not by this
    // pure function. AC3-B's job is only to leave this regime byte-for-byte
    // unchanged, which the exact hand-computed W above verifies.
    expect(closedFormSegmentHitsSphere(P, W, C, keepOut)).toBe(true);
  });

  it('(d) normal far-side regime from PARK — matches inc-1 clean tangent exactly (unchanged, existing case)', () => {
    // Same geometry as the existing AC3 "(a) on-axis far-side" case above —
    // re-asserted here under the AC3-B suite to nail down NO regression: P starts
    // WELL outside the sphere at a PARK-like distance, T antipodal.
    const P = new THREE.Vector3(0, 0, 2.5 * keepOut);
    const T = new THREE.Vector3(0, 0, -1000);
    expect(P.distanceTo(C)).toBeGreaterThan(keepOut);
    expect(segmentCrossesSphere(P, T, C, keepOut)).toBe(true);

    const W = goAroundWaypoint(P, T, C, keepOut);

    // Matches inc-1's hand-computed oracle exactly: W = (0, 1.2*keepOut, 0).
    expect(W.x).toBeCloseTo(0, 4);
    expect(W.y).toBeCloseTo(1.2 * keepOut, 4);
    expect(W.z).toBeCloseTo(0, 4);
    expect(closedFormSegmentHitsSphere(P, W, C, keepOut)).toBe(false);
    expect(closedFormSegmentHitsSphere(W, T, C, keepOut)).toBe(false);
  });

  it('P EXACTLY at the star center — floors to a stable direction, no NaN, escape still fires', () => {
    const P = new THREE.Vector3(0, 0, 0); // P == C
    const T = new THREE.Vector3(0, 0, -1000);

    const W = goAroundWaypoint(P, T, C, keepOut);

    expect(Number.isNaN(W.x) || Number.isNaN(W.y) || Number.isNaN(W.z)).toBe(false);
    expect(W.distanceTo(C)).toBeGreaterThan(keepOut);
    expect(W.distanceTo(C)).toBeGreaterThan(P.distanceTo(C));
    expect(isMonotonicNonDecreasing(P, W, C)).toBe(true);
  });

  it('P inside AND T == P (degenerate segment) — no NaN, pure-radial escape', () => {
    const P = new THREE.Vector3(0, 0.6 * keepOut, 0);
    const T = P.clone();

    const W = goAroundWaypoint(P, T, C, keepOut);

    expect(Number.isNaN(W.x) || Number.isNaN(W.y) || Number.isNaN(W.z)).toBe(false);
    expect(W.distanceTo(C)).toBeGreaterThan(keepOut);
    expect(isMonotonicNonDecreasing(P, W, C)).toBe(true);
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
