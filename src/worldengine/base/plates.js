// src/worldengine/base/plates.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE-PASS PLATE / UPLIFT-FIELD GENERATOR  (World-Engine production-L1, Option C, increment 1)
//
// THREE-FREE BY CONSTRUCTION: imports only alea + simplex-noise + the pure scalar helpers in
// mathutil.js (sphereField.js:1-4 discipline). It NEVER imports three. It consumes the F3 sphere
// carrier produced elsewhere ({verts:[[x,y,z]], adj, N, latDegOf, tangentFrameAt}); the regime gate
// that selects this writer vs the despun E6 path lives at the route()/lab boundary, NOT in here.
//
// THE MODEL IS GENERATIVE, NOT SIMULATIVE — it places the *determined end-state* of a tectonic
// history in ONE pass (Max: "what HAPPENED given formation variables", not "what happens"):
//
//   seed N plate centroids deterministically from macroSeed
//     -> spherical-Voronoi partition (boundaries domain-warped for irregular, natural margins)
//     -> per-plate rigid Euler-pole motion  v(p) = ω·(w × p)   (the geoscience Euler-pole form)
//     -> classify each plate boundary convergent / divergent / transform by relative-motion stress
//     -> write an uplift field U: HIGH at convergent boundaries (ranges), NEGATIVE/low at divergent
//        (rift), LOW/FLAT in cratonic interiors; continental plates ride higher than oceanic
//     -> spread the boundary stress inward via a graph distance field (interiors relax to base)
//
// U IS THE SOLE LOW/MID-FREQUENCY SOURCE for carrier.height on an Earth-like body. It is written
// with `=` (REPLACE), not `+=`: adding it on top of the latitude-band writeHeightSphere would
// re-introduce the very banding this increment removes (tectonic.js:180 is epoch-additive).
//
// RENDER-ONCE (spine §0 "place once, don't time-step billions of years"): the ONLY iteration is a
// BOUNDED gen-time relaxation — a fixed RELAX_PASSES Jacobi smooth, the precedent WD already ships
// (tectonic.js jacobiSmoothSphere 10 passes; relief-e9-hydrology runE9 PASSES=5). There is NO
// per-Myr time loop and NO while-loop on a convergence threshold. The multi-source BFS below is an
// O(N) graph distance transform (a queue drain bounded by N), not time-stepping.
//
// DETERMINISM HARD-RULE: every random draw is seeded via alea(seedString) keyed off the integer
// macroSeed. NO Math.random / NO Date.now anywhere (incl. helpers). Same (drivers, macroSeed) =>
// byte-identical U field. (Verified by the AC1 no-RNG static-source guard.)
//
// BUILT C-READY (AC3): the generator's only downstream contract is `carrier.height` (+ the routed
// graph's accum). A future Tier-C plate-MOTION stepping pass that writes the SAME carrier.height
// flows through the erosion/carve unchanged — nothing downstream reads the plate objects.
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, mix } from './mathutil.js';

// Boundary classification labels (also the values returned in the `boundaryClass` diagnostic array).
export const BOUNDARY = Object.freeze({ INTERIOR: 0, CONVERGENT: 1, DIVERGENT: 2, TRANSFORM: 3 });

// ── LOCKED tunables (documented; same family role as tectonic.js NU/REGIME_GAIN) ──────────────
// Production passes ONLY macroSeed; these defaults are the locked behavior. The DEFAULTS object is
// override-able through opts purely so the headless structure tests / exploration can sweep — the
// route()/lab path never overrides them.
export const DEFAULTS = Object.freeze({
  PLATE_COUNT_MIN: 7,        // Earth has ~7 major plates; floor of the seed-varied count
  PLATE_COUNT_SPAN: 7,       // => count ∈ [7, 13] (AC6 variety: different plate counts per seed)
  WARP_FREQ: 1.5,            // domain-warp frequency for irregular (non-great-circle) margins
  WARP_AMP: 0.22,            // domain-warp amplitude (fraction of a unit direction)
  CONTINENTAL_FRACTION: 0.5, // fraction of plates that are continental (ride higher)
  BASE_OCEAN: 0.10,          // oceanic-plate cratonic base elevation (low ground -> ocean basins)
  BASE_CONT: 0.36,           // continental-plate cratonic base elevation (the quiet high ground)
  OMEGA_MIN: 0.4,            // Euler-pole angular speed floor
  OMEGA_SPAN: 1.1,           // => ω ∈ [0.4, 1.5]
  STRESS_REF: 1.35,          // normalize the relative-motion normal component into ~[-1, 1]
  UPLIFT_GAIN: 1.8,          // convergent-boundary uplift gain (mountain ranges)
  RIFT_GAIN: 0.6,            // divergent-boundary depression gain (rift valleys), applied to <0 stress
  BELT_RADIANS: 0.058,       // GEODESIC belt half-width (radians) — RESOLUTION-INDEPENDENT: the inward
                             //   falloff length is angular, so belt width is the same on the 600-node
                             //   test carrier and the ~40k lab mesh (NOT a fixed hop count). Tuned so
                             //   the AC2 structure bar (conv ≥ 2× interior, |corr(U,signed-boundary-
                             //   proximity)| ≥ 0.5) holds across Earth-like seeds while leaving ranges
                             //   visually broad enough to read as belts (AC8).
  DETAIL_FREQ: 7.0,          // small isotropic sub-grid texture so interiors aren't perfectly flat
  DETAIL_AMP: 0.02,          // detail amplitude — deliberately << structure so AC2 structure dominates
  RELAX_PASSES: 4,           // FIXED bounded relaxation passes (render-once; not time-stepping)
});
export const RELAX_PASSES = DEFAULTS.RELAX_PASSES;

// The documented relief band for the U field. The terms sum to roughly [-0.2, +1.7]; the guard is
// generous (the AC1 bounded-ness gate asserts |U| < this).
export const U_BOUND = 4;

// ── Increment 2 (plate driver-response): the Earth reference point + the driver→tune seam ──────
// The MULTIPLY increment threads the body's formation drivers into the locked DEFAULTS so one
// body-type becomes a continuum (heavy worlds flatter, volatile-rich worlds drown more continent,
// tidally-heated worlds churn more plates, old worlds read their age). driversToTune(D) returns a
// `tune` override consumed by the EXISTING `tune ? { ...DEFAULTS, ...tune } : DEFAULTS` seam in
// writePlateUpliftSphere — no new mechanism, only a calibrated re-tune of the placement.
//
// The calibration is ANCHORED to D_EARTH: driversToTune(D_EARTH) returns null, so Earth takes the
// untouched DEFAULTS branch and stays byte-identical to the validated plate POC (AC2 — the
// load-bearing identity guard). ⚠ Earth's drivers are NOT a zero vector (gravity 1 g, volatile
// fraction ~0.15, ~4.5 Gyr, small-but-nonzero tidal heating) — so the SLICE-B transfer functions
// must return DEFAULTS at THESE values, not at zero (the increment-2 #1 must-fix).
export const D_EARTH = Object.freeze({
  massGravity: 1.0,        // D14 — Earth surface gravity in g (massEarth / radiusEarth^2)
  volatileFraction: 0.15,  // D2  — Earth-like silicate volatile budget (Rocky preset value)
  tidalHeating: 0.0,       // D12 — negligible for Earth (SLICE B pins the normalized Earth value ~0.19)
  age: 4.5,                // D16 — Gyr
});

// SLICE A stub: returns null for EVERY input, so the tune seam is wired end-to-end and proven
// byte-identical (driversToTune(D) → null → the DEFAULTS branch) before any calibration lands.
// SLICE B replaces this body with the calibrated transfer functions for massGravity → UPLIFT_GAIN,
// volatileFraction → CONTINENTAL_FRACTION, tidalHeating → PLATE_COUNT, age → (calibrated) — each
// anchored so D_EARTH still maps to null. Pure function — no Math.random, no Date-now calls — AC1.
export function driversToTune(drivers) {
  void drivers;            // SLICE A: not consumed yet — null tune ⇒ DEFAULTS ⇒ byte-identical
  return null;
}

// ── tiny vec3 helpers on plain [x,y,z] arrays (three-free) ─────────────────────────────────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// Deterministic uniform point on the unit sphere from an alea rng (z = 2u-1, azimuth 2πv).
function randDir(rng) {
  const z = 2 * rng() - 1;
  const t = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
}

// Angular falloff: 1 at a boundary, decaying to ~0 a few `belt` radians into the craton.
const falloffAng = (angDist, belt) => Math.exp(-angDist / belt);

/**
 * One-pass plate / uplift-field generator. WRITES carrier.height[i] = U[i] (REPLACE, the sole
 * low/mid source) and RETURNS the diagnostics the structure tests + the live plateProbe read.
 *
 * @param {object} carrier  F3 sphere carrier (makeSphereField output): verts, adj, N, latDegOf.
 * @param {object} drivers  the E6 driver bundle — accepted for signature parity with the writer
 *                          family + the named driver-response follow-on; NOT consumed this increment
 *                          (placement is seed-only by locked scope; route() doesn't thread the
 *                          driver vector yet — rivers.js:1112).
 * @param {object} opts      { macroSeed:int } — the body's deterministic integer seed.
 * @returns {{U:Float32Array, plateId:Int32Array, boundaryClass:Uint8Array, boundaryStress:Float32Array,
 *            boundaryDist:Int32Array, signedProximity:Float32Array, plateType:Uint8Array,
 *            centroids:number[][], plateCount:number, relaxPasses:number}}
 */
export function writePlateUpliftSphere(carrier, drivers = {}, { macroSeed = 0, tune = null } = {}) {
  void drivers; // seed-only this increment (see @param drivers)
  const T = tune ? { ...DEFAULTS, ...tune } : DEFAULTS;  // production passes no `tune` => locked defaults
  const {
    PLATE_COUNT_MIN, PLATE_COUNT_SPAN, WARP_FREQ, WARP_AMP, CONTINENTAL_FRACTION,
    BASE_OCEAN, BASE_CONT, OMEGA_MIN, OMEGA_SPAN, STRESS_REF, UPLIFT_GAIN, RIFT_GAIN,
    BELT_RADIANS, DETAIL_FREQ, DETAIL_AMP, RELAX_PASSES: PASSES,
  } = T;
  const N = carrier.N;
  const verts = carrier.verts;
  const adj = carrier.adj;
  const seed = (macroSeed | 0);

  // mean edge angle of THIS carrier — converts BFS hop distance to a resolution-independent
  // GEODESIC distance so the belt is the same physical width on the 600-node test carrier and the
  // ~40k lab mesh. (The mesh is Lloyd-relaxed ⇒ near-uniform spacing, so hop×meanEdgeAngle is a
  // faithful angular distance without needing a weighted Dijkstra.)
  let angSum = 0, angCnt = 0;
  for (let i = 0; i < N; i++) {
    const a = verts[i], nb = adj[i];
    for (let k = 0; k < nb.length; k++) { angSum += Math.acos(clamp(-1, 1, dot(a, verts[nb[k]]))); angCnt++; }
  }
  const meanEdgeAngle = angCnt ? angSum / angCnt : 0.1;

  // ── 1. seed N plate centroids deterministically from macroSeed ────────────────────────────────
  const rngCount = alea('plates:count:' + seed);
  const rngCentroid = alea('plates:centroid:' + seed);
  const rngMotion = alea('plates:motion:' + seed);
  const rngType = alea('plates:type:' + seed);
  const warpNoise = createNoise3D(alea('plates:warp:' + seed));
  const detailNoise = createNoise3D(alea('plates:detail:' + seed));

  const plateCount = PLATE_COUNT_MIN + Math.floor(rngCount() * PLATE_COUNT_SPAN);
  const centroids = [];
  const eulerAxis = [];
  const omega = new Float32Array(plateCount);
  const plateType = new Uint8Array(plateCount);   // 1 = continental, 0 = oceanic
  const baseElev = new Float32Array(plateCount);
  for (let p = 0; p < plateCount; p++) {
    centroids.push(randDir(rngCentroid));
    // ── 3. per-plate rigid Euler-pole motion: axis w + angular speed ω ──────────────────────────
    eulerAxis.push(randDir(rngMotion));
    omega[p] = OMEGA_MIN + rngMotion() * OMEGA_SPAN;
    plateType[p] = rngType() < CONTINENTAL_FRACTION ? 1 : 0;
    baseElev[p] = plateType[p] ? BASE_CONT : BASE_OCEAN;
  }

  // ── 2. spherical-Voronoi partition (domain-warped boundaries) ─────────────────────────────────
  // nearest centroid by MAX dot (geodesic distance = arccos(dot), so nearest = max dot). The node
  // direction is domain-warped by low-freq 3D simplex so margins are irregular, not great-circle arcs
  // (Cortial warps geodetic distances with noise; same effect here).
  const plateId = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const wx = warpNoise(d[0] * WARP_FREQ, d[1] * WARP_FREQ, d[2] * WARP_FREQ);
    const wy = warpNoise(d[0] * WARP_FREQ + 19.1, d[1] * WARP_FREQ - 7.3, d[2] * WARP_FREQ + 3.7);
    const wz = warpNoise(d[0] * WARP_FREQ - 5.2, d[1] * WARP_FREQ + 11.9, d[2] * WARP_FREQ - 2.4);
    const wd = norm([d[0] + WARP_AMP * wx, d[1] + WARP_AMP * wy, d[2] + WARP_AMP * wz]);
    let best = 0, bestDot = -Infinity;
    for (let p = 0; p < plateCount; p++) {
      const c = centroids[p];
      const dd = wd[0] * c[0] + wd[1] * c[1] + wd[2] * c[2];
      if (dd > bestDot) { bestDot = dd; best = p; }
    }
    plateId[i] = best;
  }

  // surface velocity of plate p at unit direction `pdir`: v(p) = ω·(w × pdir) (tangent to the sphere).
  const velAt = (p, pdir) => {
    const c = cross(eulerAxis[p], pdir);
    const w = omega[p];
    return [c[0] * w, c[1] * w, c[2] * w];
  };

  // ── 4. classify boundaries by relative-motion stress ──────────────────────────────────────────
  // For every node touching a different plate across an edge, compute the relative velocity of the
  // two sides at the boundary midpoint and decompose into a NORMAL (closing/opening) component and a
  // SHEAR (along-boundary) component. The node takes the contribution with the largest |normal|.
  const isBoundary = new Uint8Array(N);
  const boundaryClass = new Uint8Array(N);          // BOUNDARY.*
  const boundaryStress = new Float32Array(N);        // signed, ~[-1,1]: + convergent, - divergent, ~0 transform
  for (let i = 0; i < N; i++) {
    const a = plateId[i];
    const di = verts[i];
    let bestMag = -1, bestStress = 0, bestClass = BOUNDARY.INTERIOR, sawBoundary = false;  // -1 so a pure-shear edge (rank≈0) still registers as a boundary
    for (const j of adj[i]) {
      const b = plateId[j];
      if (b === a) continue;
      sawBoundary = true;
      const dj = verts[j];
      const pmid = norm([di[0] + dj[0], di[1] + dj[1], di[2] + dj[2]]);  // boundary midpoint
      // boundary normal n: the surface (tangent) direction from i toward j at the midpoint.
      const e = [dj[0] - di[0], dj[1] - di[1], dj[2] - di[2]];
      const ep = dot(e, pmid);
      const nt = [e[0] - ep * pmid[0], e[1] - ep * pmid[1], e[2] - ep * pmid[2]];
      const n = norm(nt);
      const t = cross(pmid, n);  // along-boundary tangent (orthonormal to n at the midpoint)
      const va = velAt(a, pmid), vb = velAt(b, pmid);
      const rel = [va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]];
      const normalComp = dot(rel, n);   // > 0 => the two sides CLOSE (convergent); < 0 => OPEN (divergent)
      const shearComp = dot(rel, t);
      const mag = Math.abs(normalComp);
      const absS = Math.abs(shearComp);
      // OBLIQUITY attenuation (adversarial-review fix): a head-on margin (absS≈0) builds FULL relief; a
      // pure-shear margin (mag≈0) builds none; oblique margins scale between. Crucially this means an
      // oblique-CONVERGENT margin (transpression — e.g. NZ's Southern Alps, the San Andreas big bend)
      // still builds an attenuated range instead of being zeroed as "pure transform". The LABEL is still
      // TRANSFORM when shear dominates (for the partition diagnostics), but the stress is continuous.
      const obliquity = mag / (mag + absS + 1e-9);
      let cls, stress;
      if (normalComp > 0) { cls = (absS > mag) ? BOUNDARY.TRANSFORM : BOUNDARY.CONVERGENT; stress = clamp(0, 1, normalComp / STRESS_REF) * obliquity; }
      else { cls = (absS > mag) ? BOUNDARY.TRANSFORM : BOUNDARY.DIVERGENT; stress = -clamp(0, 1, -normalComp / STRESS_REF) * obliquity; }
      // the node's class is set by its strongest cross-plate edge (by attenuated stress magnitude)
      const rank = Math.abs(stress);
      if (rank > bestMag) { bestMag = rank; bestStress = stress; bestClass = cls; }
    }
    if (sawBoundary) { isBoundary[i] = 1; boundaryClass[i] = bestClass; boundaryStress[i] = bestStress; }
  }

  // ── 5/6. spread boundary stress inward via a multi-source BFS distance transform ──────────────
  // Each interior node inherits the stress of its NEAREST boundary, scaled by falloff(hops). This is
  // an O(N) queue drain (NOT a convergence loop): every node is enqueued exactly once.
  const boundaryDist = new Int32Array(N).fill(-1);
  const nearStress = new Float32Array(N);   // signed stress of the nearest boundary
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) {
    if (isBoundary[i]) { boundaryDist[i] = 0; nearStress[i] = boundaryStress[i]; q[qt++] = i; }
  }
  if (qt === 0) {
    // single-plate / degenerate (no cross-plate edges): no boundaries -> all interior, flat base.
    boundaryDist.fill(0);
  } else {
    while (qh < qt) {
      const c = q[qh++];
      const nd = boundaryDist[c] + 1;
      for (const nb of adj[c]) {
        if (boundaryDist[nb] < 0) { boundaryDist[nb] = nd; nearStress[nb] = nearStress[c]; q[qt++] = nb; }
      }
    }
  }

  // ── write U = per-plate base + spread boundary relief + small sub-grid detail ─────────────────
  const U = new Float32Array(N);
  const baseElevField = new Float32Array(N);     // per-node plate base elevation (the continental/oceanic step)
  const signedProximity = new Float32Array(N);  // GEOMETRIC: sign(nearest boundary) × falloff(geodesic dist) — the live probe reads this
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const s = nearStress[i];
    const fo = falloffAng(boundaryDist[i] * meanEdgeAngle, BELT_RADIANS);
    const contrib = (s >= 0 ? s * UPLIFT_GAIN : s * RIFT_GAIN) * fo;  // uplift at convergent, rift at divergent
    const detail = DETAIL_AMP * detailNoise(d[0] * DETAIL_FREQ, d[1] * DETAIL_FREQ, d[2] * DETAIL_FREQ);
    baseElevField[i] = baseElev[plateId[i]];
    U[i] = baseElevField[i] + contrib + detail;
    signedProximity[i] = Math.sign(s) * fo;
  }

  // ── bounded gen-time relaxation (render-once): fixed RELAX_PASSES Jacobi smooth over carrier.adj ─
  // Same h*0.5 + mean(self+neighbours)*0.5 weighting as tectonic.js jacobiSmoothSphere. A convex
  // combination — it cannot expand the bound. Double-buffered.
  const buf = new Float32Array(N);
  for (let pass = 0; pass < PASSES; pass++) {
    for (let i = 0; i < N; i++) {
      let sum = U[i], cnt = 1;
      const nb = adj[i];
      for (let k = 0; k < nb.length; k++) { sum += U[nb[k]]; cnt++; }
      buf[i] = U[i] * 0.5 + (sum / cnt) * 0.5;
    }
    U.set(buf);
  }

  // ── write carrier.height = U (REPLACE — the SOLE low/mid source for the Earth-like body) ──────
  carrier.height.set(U);
  // parity bookkeeping with the despun writer (faultDensity tracks tectonic activity = boundary stress)
  for (let i = 0; i < N; i++) carrier.faultDensity[i] = Math.abs(boundaryStress[i]);

  return {
    U, plateId, boundaryClass, boundaryStress, boundaryDist, signedProximity, baseElevField,
    plateType, centroids, plateCount, relaxPasses: PASSES, meanEdgeAngle,
  };
}
