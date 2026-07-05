// src/flight/tourStandoff.js
//
// Increment 1 (autopilot-standoff-routing-2026-07-01) — pure tour-layer routing
// geometry. ZERO physics contact: these helpers never touch SC_TUNING or the
// gravity well. They keep the unattended autopilot tour OUT of the star's
// restricted zone and route the ship AROUND the star when a target sits on its
// far side.
//
// DECOUPLED star radii (a unified single-radius design was tried and REJECTED in
// review — park == keep-out puts the parked ship exactly ON the keep-out sphere,
// and the next leg's go-around from an on-sphere point degenerates to an absurd
// ~40000x-radius waypoint whose path still crosses the star):
//   • PARK radius   = max(min(8R, 0.6·innerOrbit), keepOut·PARK_MIN_FACTOR) —
//                     the star's HOLD/viewing distance. Bumped up so a parked
//                     ship always sits strictly OUTSIDE the keep-out sphere.
//   • KEEP-OUT radius = KEEP_OUT_FACTOR·R (~3.5R) — the go-around crossing
//                     sphere. Strictly > 2.5R crawl-onset and 1.05R barrier, and
//                     strictly < PARK, so a star departure starts outside it.
//
// The perpendicular-distance approach mirrors main.js:436 `_isReticleOccluded`
// (project the sphere center onto the ray, compare perp distance to radius),
// but CLAMPED to the finite segment P->T instead of the infinite camera ray.
//
// No DOM, no scene graph — pure THREE.Vector3 math so it is headless-testable.
import * as THREE from 'three';

// Reusable scratch vectors (module-scoped; these helpers are called from the
// per-frame tour dispatch, so avoid per-call allocation).
const _d = new THREE.Vector3();
const _cp = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _n = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _segDir = new THREE.Vector3();
const _pc = new THREE.Vector3();
const _tanPerp = new THREE.Vector3();
const _escDir = new THREE.Vector3();

// KEEP-OUT sphere radius = KEEP_OUT_FACTOR·starRadius. 3.5 sits above the 2.5R
// crawl-onset and the 1.05R collision barrier (so a routed ship is never pinned)
// and comfortably below the PARK radius (so a parked ship is outside it).
export const KEEP_OUT_FACTOR = 3.5;

// PARK is kept ≥ keepOut·PARK_MIN_FACTOR so a ship parked at the star sits
// strictly OUTSIDE the keep-out sphere — no on-sphere degeneracy for the next
// leg's go-around. 1.3 → park is at least 30% beyond the keep-out radius.
export const PARK_MIN_FACTOR = 1.3;

// Near-tangent detour margins for goAroundWaypoint. W is anchored at
// keepOut·MARGIN from the star center; if a sub-segment still clips we raise the
// margin modestly, capped at 1.6 so |W - C| stays < 2·keepOut (never asymptotes
// to a huge value the way the rejected center-anchored+geometric-growth design
// did — see the module header).
const GO_AROUND_MARGINS = Object.freeze([1.2, 1.35, 1.5, 1.6]);

// AC3-B (tour-reliability-corrections-2026-07-01) — ESCAPE-FIRST regime.
//
// Measured reality voids inc-1's "impossible" premise: the ship CAN start a leg
// ON or INSIDE the keep-out sphere (the warp-arrival defect, RC3). The normal
// branch below anchors the waypoint at the segment's closest-approach point to
// C, which is only stable when P starts OUTSIDE the sphere; for P on/inside it,
// that anchor can land arbitrarily close to C itself, giving a directionless
// (unstable) outward normal — no escape guarantee. So: detect P on/inside
// FIRST and branch to a dedicated escape waypoint, radially outward from C
// through P, optionally blended toward the segment's off-axis ("tangent")
// direction when there is one to blend toward (zero for an antipodal target).
//
// PROOF the escape is monotonic (verified empirically too, by parametric
// sampling, in the test suite — this is the reasoning, not a substitute for
// that check): for a straight segment P->W with unit direction D,
//   d/dt |P + tD - C|^2 = 2[(P-C)·D + t],
// linear increasing in t (coefficient of t is |D|^2 = 1 > 0). So if the value
// at t=0 — (P-C)·D — is >= 0, the WHOLE segment [0, |W-P|] is non-decreasing in
// distance to C. Building D = normalize(n + BLEND·tanPerp) with n =
// normalize(P-C) and tanPerp ⟂ n (by construction, via rejection) makes
// (P-C)·D_unnormalized = |P-C|·(n·n) + BLEND·|P-C|·(n·tanPerp) = |P-C| + 0 =
// |P-C| >= 0 ALWAYS — independent of BLEND, independent of geometry, and even
// when P == C exactly (where |P-C| = 0 and ANY direction is safe, since moving
// away from the exact center in a straight line trivially increases distance).
const ESCAPE_TANGENT_BLEND = 0.35;

/**
 * AC3-B — the escape-first waypoint for P ON/INSIDE the keep-out sphere. See
 * the proof above the ESCAPE_TANGENT_BLEND constant for why this is
 * monotonic-safe regardless of geometry, including P exactly at C (degenerate
 * radial direction, floored below) or T == P (degenerate tangential blend).
 *
 * Placed at radius·GO_AROUND_MARGINS[0] (the module's existing first
 * near-tangent margin, reused rather than inventing a new constant) — strictly
 * beyond the sphere and, since the escape regime guarantees |P-C| <= radius,
 * strictly farther from C than P started.
 */
function _escapeWaypoint(P, T, C, radius) {
  // Outward radial direction n = normalize(P - C). Degenerate ONLY when P sits
  // (numerically) exactly at C: floor to a stable direction so this is NEVER
  // NaN — prefer heading toward T (directionally useful), then a fixed axis if
  // T is also colocated with P. Both are safe here because |P-C| ≈ 0 makes the
  // monotonic proof hold for ANY direction (see comment above).
  _pc.copy(P).sub(C);
  if (_pc.lengthSq() < radius * radius * 1e-12) {
    _pc.copy(T).sub(P);
    if (_pc.lengthSq() < 1e-12) _pc.set(0, 0, 1);
  }
  _pc.normalize(); // _pc now holds n, the outward radial unit direction

  // Tangential blend "toward the eventual tangent": the component of (T-P)
  // perpendicular to n, via rejection. Zero (or negligible) when T is ~
  // antipodal through C (or T == P) — nothing to blend toward, so the escape
  // stays PURE radial (this is the hand-computable oracle regime).
  _segDir.copy(T).sub(P);
  const alongN = _segDir.dot(_pc);
  _tanPerp.copy(_segDir).addScaledVector(_pc, -alongN);
  const tanLenSq = _tanPerp.lengthSq();

  _escDir.copy(_pc); // start pure radial
  if (tanLenSq > radius * radius * 1e-8) {
    _tanPerp.multiplyScalar(1 / Math.sqrt(tanLenSq));
    _escDir.addScaledVector(_tanPerp, ESCAPE_TANGENT_BLEND);
    _escDir.normalize();
  }

  return new THREE.Vector3().copy(C).addScaledVector(_escDir, radius * GO_AROUND_MARGINS[0]);
}

/**
 * AC1 (1b) — the star KEEP-OUT (go-around crossing) radius = KEEP_OUT_FACTOR·R.
 * @param {{starRadius:number}} p
 * @returns {number} keep-out sphere radius in scene units.
 */
export function starKeepOutRadius({ starRadius }) {
  return KEEP_OUT_FACTOR * starRadius;
}

/**
 * AC1 (1a) — the star PARK (hold/viewing) radius.
 *
 * Resolves to the already-computed-but-ignored `orbitDistance` from
 * populateQueueRefs (main.js:5664): `min(8·starR, 0.6·innerOrbit)`, then RAISED
 * so it stays strictly greater than the keep-out radius (a ship parked here is
 * always outside the keep-out sphere, even for a pathologically tight inner
 * orbit where the raw value would fall below keep-out).
 *
 * @param {{starRadius:number, innerOrbitRadius:number}} p
 *        innerOrbitRadius = the innermost planet's orbit radius, or Infinity if
 *        the system has no planets.
 * @returns {number} park distance in scene units, > starKeepOutRadius always.
 */
export function starParkRadius({ starRadius, innerOrbitRadius }) {
  const orbit = (innerOrbitRadius == null || !Number.isFinite(innerOrbitRadius))
    ? Infinity
    : innerOrbitRadius;
  const rawPark = Math.min(starRadius * 8, orbit * 0.6);
  const keepOut = starKeepOutRadius({ starRadius });
  return Math.max(rawPark, keepOut * PARK_MIN_FACTOR);
}

/**
 * AC2 — does the straight segment P->T pass within `radius` of center C?
 *
 * Clamped to the SEGMENT (not the infinite line): the closest approach is taken
 * over t ∈ [0,1] of P + t·(T-P). If P is already inside the sphere, that is
 * caught by the clamp at t=0 (closest = P) and reported as a crossing — the ship
 * must escape. Zero-length segments (P == T) fall back to the point-in-sphere
 * test. No NaN for any input.
 *
 * @returns {boolean} true if the segment comes within `radius` of C.
 */
export function segmentCrossesSphere(P, T, C, radius) {
  _d.copy(T).sub(P);                 // segment direction * length
  const lenSq = _d.lengthSq();
  if (lenSq <= 1e-12) {
    // Degenerate segment — just a point-in-sphere test at P.
    return P.distanceToSquared(C) < radius * radius;
  }
  // Parametric closest point of the sphere center onto the segment, clamped.
  _cp.copy(C).sub(P);
  let t = _cp.dot(_d) / lenSq;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  _closest.copy(_d).multiplyScalar(t).add(P); // P + t*(T-P)
  return _closest.distanceToSquared(C) < radius * radius;
}

/**
 * AC3 — a BOUNDED go-around waypoint W that clears the keep-out sphere.
 *
 * Anchor: the segment's CLOSEST-APPROACH point X (clamped to [P,T]) pushed
 * radially OUT from the star center C along n = normalize(X - C). This keeps the
 * detour at the crossing azimuth (a near-tangent bulge), NOT at the sphere
 * center — so |W - C| stays a small multiple of `radius` and never asymptotes.
 * When the segment runs through (or nearly through) the center, X ≈ C and that
 * normal is degenerate → a stable perpendicular of (T-P) is used instead.
 *
 * W is placed at radius·MARGIN (MARGIN from GO_AROUND_MARGINS, starting 1.2). If
 * a sub-segment still clips the sphere, the margin is raised modestly, CAPPED at
 * 1.6 (|W - C| < 2·radius). For well-posed crossing geometry with P outside the
 * sphere (the real park->planet regime) both sub-segments P->W and W->T clear;
 * for pathological near-boundary antipodal geometry the capped best-effort W is
 * returned (still outside the sphere) and the caller's cap + WS-1 backstop apply.
 *
 * AC3-B extension: when P starts ON or INSIDE the keep-out sphere (measured to
 * occur via the warp-arrival defect — RC3; inc-1's "impossible" premise for
 * this function is void), the closest-approach anchor below is unstable (it
 * can land at/near C), so that regime is detected FIRST and routed to a
 * dedicated escape-first waypoint (see _escapeWaypoint + the proof above
 * ESCAPE_TANGENT_BLEND). ALL outside-sphere regimes (this function's original
 * contract) are completely unchanged — the escape branch never runs for them.
 *
 * @returns {THREE.Vector3} a NEW Vector3 waypoint (safe to retain).
 */
export function goAroundWaypoint(P, T, C, radius) {
  // ESCAPE-FIRST branch (AC3-B) — checked before any T-dependent geometry so
  // it is well-defined even for a degenerate P==T segment. Epsilon is a
  // relative float-rounding guard only (radius·1e-9), NOT a behavioral margin:
  // it exists so "P exactly on the sphere" (constructed via P = C + n*radius)
  // reliably falls into the escape branch despite sqrt rounding, while any
  // genuinely outside-the-sphere start (even a hair outside) still takes the
  // ORIGINAL, unmodified branch below.
  if (P.distanceTo(C) <= radius * (1 + 1e-9)) {
    return _escapeWaypoint(P, T, C, radius);
  }

  _d.copy(T).sub(P);
  const lenSq = _d.lengthSq();

  // Clamped closest-approach point X of C onto the segment [P,T].
  let t = lenSq > 1e-12 ? _cp.copy(C).sub(P).dot(_d) / lenSq : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  _closest.copy(_d).multiplyScalar(t).add(P); // X

  // Outward radial normal n = normalize(X - C). If X ≈ C (segment through the
  // center) that normal is ~0 → fall back to a stable perpendicular of (T-P).
  _n.copy(_closest).sub(C);
  if (_n.lengthSq() < radius * radius * 1e-6) {
    _segDir.copy(_d);
    if (lenSq > 1e-12) _segDir.divideScalar(Math.sqrt(lenSq));
    else _segDir.set(0, 0, -1);
    const ax = Math.abs(_segDir.x), ay = Math.abs(_segDir.y), az = Math.abs(_segDir.z);
    if (ax <= ay && ax <= az) _perp.set(1, 0, 0);
    else if (ay <= az) _perp.set(0, 1, 0);
    else _perp.set(0, 0, 1);
    _n.copy(_perp).cross(_segDir);
    if (_n.lengthSq() < 1e-12) _n.set(1, 0, 0); // ultimate fallback
  }
  _n.normalize();

  // Anchor W radially OUT from C at a bounded near-tangent multiple of radius.
  // Raise the margin only if a sub-segment still clips; capped so |W-C| < 2R.
  const W = new THREE.Vector3();
  for (let i = 0; i < GO_AROUND_MARGINS.length; i++) {
    W.copy(C).addScaledVector(_n, radius * GO_AROUND_MARGINS[i]);
    if (!segmentCrossesSphere(P, W, C, radius) && !segmentCrossesSphere(W, T, C, radius)) {
      return W;
    }
  }
  // Bounded best-effort (margin cap 1.6 → |W-C| = 1.6·radius < 2·radius): still
  // strictly outside the sphere. Caller caps waypoint insertions + WS-1 backstop.
  return W;
}

/**
 * AC5 — the pure per-leg routing decision seam. Given the ship position, the
 * next target, and the star geometry (two decoupled radii), decide whether the
 * leg needs a standoff hold (star target) or a go-around waypoint (a straight
 * path that would cross the keep-out sphere).
 *
 *   • targetIsStar                         → { waypoint:null, standoff:park }
 *   • segment ship->target crosses keepOut → { waypoint:W,    standoff:null }
 *   • otherwise (clear leg)                → { waypoint:null,  standoff:null }
 *
 * @param {{shipPos:THREE.Vector3, targetPos:THREE.Vector3, targetIsStar:boolean,
 *          starPos:THREE.Vector3, keepOut:number, park:number}} p
 * @returns {{waypoint:THREE.Vector3|null, standoff:number|null}}
 */
export function planLeg({ shipPos, targetPos, targetIsStar, starPos, keepOut, park }) {
  if (targetIsStar) {
    return { waypoint: null, standoff: park };
  }
  if (segmentCrossesSphere(shipPos, targetPos, starPos, keepOut)) {
    return { waypoint: goAroundWaypoint(shipPos, targetPos, starPos, keepOut), standoff: null };
  }
  return { waypoint: null, standoff: null };
}

// ── Defect-1 (tour-body-reachability-2026-07-05): generalize the star go-around
// to any NON-STAR obstacle (parent planet, sibling moon, a second star). ADD-ONLY —
// planLeg / segmentCrossesSphere / goAroundWaypoint above stay byte-identical (their
// tourStandoff.test.js suite is the AC5 regression witness).

// Dedicated scratch — DISTINCT from _d/_cp/_closest above (which segmentCrossesSphere
// and goAroundWaypoint overwrite). firstBlockingObstacle must never share theirs.
const _obDir = new THREE.Vector3();
const _obToC = new THREE.Vector3();
const _obClosest = new THREE.Vector3();

// Non-star obstacle keep-out = OBSTACLE_KEEP_OUT_FACTOR·radius. 1.5 sits above the
// 1.05R collision barrier (a routed ship is never pinned) and, inflated by the
// go-around SAFETY (×1.2 = 1.8R), below the ~2.6R star-style park view distance, so
// a ship parked at a just-visited planet starts OUTSIDE the inflated sphere (clean
// tangent, no spurious escape); and well below the ~6R min moon orbit, so a target
// moon is never engulfed by its own parent's keep-out. One live-tunable knob.
export const OBSTACLE_KEEP_OUT_FACTOR = 1.5;

export function obstacleKeepOutRadius({ radius }) {
  return OBSTACLE_KEEP_OUT_FACTOR * radius;
}

/**
 * The obstacle on the straight segment P->T that the ship meets FIRST, or null if
 * the path clears every obstacle. "First" = smallest clamped closest-approach
 * parameter t (so a ship starting INSIDE an obstacle clamps to t≈0 and that
 * obstacle is escaped first). The crossing test mirrors segmentCrossesSphere but
 * on LOCAL scratch (_ob*), NEVER _d/_cp/_closest, so it is safe to interleave with
 * the star routing (red-team attack #8).
 *
 * @param {THREE.Vector3} P ship position
 * @param {THREE.Vector3} T target position
 * @param {Array<{pos:THREE.Vector3, keepOut:number}>} obstacles
 * @returns {{pos:THREE.Vector3, keepOut:number}|null} the nearest crossed obstacle
 */
export function firstBlockingObstacle(P, T, obstacles) {
  _obDir.copy(T).sub(P);
  const lenSq = _obDir.lengthSq();
  let best = null;
  let bestT = Infinity;
  for (const o of obstacles) {
    let t;
    if (lenSq <= 1e-12) {
      t = 0;
    } else {
      _obToC.copy(o.pos).sub(P);
      t = _obToC.dot(_obDir) / lenSq;
      if (t < 0) t = 0; else if (t > 1) t = 1;
    }
    _obClosest.copy(_obDir).multiplyScalar(t).add(P); // P + t*(T-P)
    if (_obClosest.distanceToSquared(o.pos) < o.keepOut * o.keepOut) {
      if (t < bestT) { bestT = t; best = o; }
    }
  }
  return best;
}

/**
 * Non-star analogue of planLeg: does the straight leg to `targetPos` cross a
 * non-star obstacle, and if so which, plus a go-around waypoint at the obstacle's
 * (as-passed) keep-out. Inflation is the CALLER's policy — main.js re-places W at
 * keepOut·SAFETY, matching the star block — so this waypoint is the un-inflated
 * convenience for tests. planLeg (the star seam) is untouched.
 *
 * @param {{shipPos:THREE.Vector3, targetPos:THREE.Vector3,
 *          obstacles:Array<{pos:THREE.Vector3, keepOut:number}>}} p
 * @returns {{obstacle:{pos:THREE.Vector3, keepOut:number}|null, waypoint:THREE.Vector3|null}}
 */
export function planLegObstacle({ shipPos, targetPos, obstacles }) {
  const obstacle = firstBlockingObstacle(shipPos, targetPos, obstacles) || null;
  return {
    obstacle,
    waypoint: obstacle ? goAroundWaypoint(shipPos, targetPos, obstacle.pos, obstacle.keepOut) : null,
  };
}
