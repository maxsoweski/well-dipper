// src/worldengine/base/lidDisruption.js
// ─────────────────────────────────────────────────────────────────────────────
// SP-LID-DISRUPTION — the shared lid-disruption FAMILY (World-Engine history program, increment V2-7d).
//
// Generalizes "basal upwelling -> quasi-circular lid deformation" from its two structurally DIFFERENT
// shipped seeds into one owned, three-free module. It is a BUILD, not a reuse: the shipped writers
// (shellRelief.js, stagnantLid.js, mixedInterior.js) are NOT rewired — consumers arrive later
// (V2-7 cantaloupe-silicate epochs; V2-9a diapir-grooved coronae). ZERO production wiring this
// increment (precedent: interpenetration.js — a base/ instrument no writer imports).
//
// A FAMILY, NOT A MODE FLAG (the metasystematicity discipline). Two constructors sharing a vocabulary,
// a pure profile library, and one determinism discipline — never one function pretending cells and foci
// are the same knob:
//   • makeCellDisruption  — space-filling warped-Voronoi partition + BFS-from-walls interiorness
//                           (generalizes shellRelief.js STEP-2). Count is a fixed band; the radial
//                           coordinate is wall-referenced, topological, INWARD.
//   • makeFociDisruption  — sparse pool-proportional-to-N field-biased rejection sampling, per-feature
//                           heavy-tailed radii, typed analytic profiles (generalizes stagnantLid.js
//                           coronae). Count is EMERGENT from the pool; the radial coordinate is
//                           center-referenced, analytic ρ, OUTWARD.
// Placement, count semantics, radial coordinate, and deformation semantics stay distinct BY DESIGN.
//
// PROFILE LIBRARY = the one legitimate 1:1 extraction. The dome/trench/rise + rim/depression formulas
// are already copy-duplicated VERBATIM between stagnantLid.js STEP-3 and mixedInterior.js STEP-7. Here
// they are pure ρ->Δh functions, provably formula-identical to BOTH inline copies (the tests assert exact
// FP equality). The shipped files are UNTOUCHED; deduping mixedInterior's copy is a post-V2-7 candidate.
//
// Namespace: this module draws EXCLUSIVELY under the disrupt: alea prefix (seedKey defaults
// 'disrupt:cells:' / 'disrupt:foci:'; the cell warp noise is a derived 'warp:' sub-stream). The
// constructors THROW if handed a seedKey outside that prefix, so a caller can never draw in a shipped
// writer's stream. ROADMAP 2.2's lid-namespace phrasing is stale — that prefix was consumed by the
// shipped V2-2 pilot; disrupt is verified absent from the base/ namespace inventory. The module never
// byte-matches a shipped world (different stream) — BY DESIGN; validation is structure reproduction on
// synthetic inputs with enumerated statistics, never byte-match.
//
// FROZEN DRAW ORDERS (a future consumer can rely on these; any drop/add is a byte break — pinned by the
// draw-count test):
//   Stream A  seedKey + seed           cells:  draw 1 = count; then per cell p: z, azimuth, RESERVED
//                                       vigor, RESERVED polarity  =>  1 + 4·cellCount  (the 2 reserved
//                                       draws mirror shellRelief's SLICE-B intent; kept so a future
//                                       consumer can consume them without shifting the order).
//   Stream B  seedKey + 'warp:' + seed  cells warp: consumed ONLY by createNoise3D construction (simplex-
//                                       internal count; deliberately un-pinned — isolated so Stream A's
//                                       total stays exact regardless of simplex internals).
//   Stream C  seedKey + seed           foci:   per candidate z, azimuth, accept; ON ACCEPT + radius, type
//                                       =>  3·pool + 2·accepted  (the conditional-draw pattern).
//   eval                                zero draws — evalFociDeformation takes no rng at all (the
//                                       placement/eval split: an editor mutates descriptors and re-evals
//                                       without touching any stream).
//
// THREE-FREE BY CONSTRUCTION: imports only alea + simplex-noise + the pure scalars in mathutil.js. No
// Math.random / Date.now. Bounded iteration only — the sole loop-to-a-condition is the O(N) BFS queue
// drain in makeCellDisruption (the plates/shell idiom). NO relax passes (those belong to writers /
// composers). NEVER writes any carrier channel (height / grainAngle / faultDensity / regime untouched);
// consumers compose. Stress / lid-strength coupling enters ONLY through the caller-supplied
// acceptWeightAt callback (placement bias) and caller amplitude scaling on the profile params — the
// module reads no D-vector and no field of its own.
//
// CONSUMER SEAMS (mechanically demonstrated in the tests; not wired):
//   • V2-7 editor  — makeFociDisruption returns editable descriptors (centers/radii/typeIds/alive);
//                    evalFociDeformation is SPLIT from placement so the editor can deactivate a focus
//                    (alive[c]=0) or retype it (typeIds[c]=k) and re-evaluate WITHOUT redrawing.
//   • V2-9a diapir — profiles are pluggable per type: registering profileGroovedDiapir renders concentric
//                    grooves through evalFociDeformation, keeping the diapir option alive WITHOUT deciding
//                    the geometry pick (no preset, no writer, no lab surface — a synthetic capability proof).
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01 } from './mathutil.js';

// ── tiny vec3 helpers on plain [x,y,z] arrays (the plates/shell idiom; three-free) ────────────────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
// Deterministic uniform point on the unit sphere from an alea rng (z = 2u-1, azimuth 2πv). 2 draws/call;
// draw order is load-bearing for byte-identity (the plates.js randDir idiom).
function randDir(rng) {
  const z = 2 * rng() - 1;
  const t = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
}
// STEP-0 resolution key: mean edge angle (geodesic radians per mesh hop) — the sibling-writer scan.
function meanEdgeAngleOf(verts, adj, N) {
  let angSum = 0, angCnt = 0;
  for (let i = 0; i < N; i++) {
    const a = verts[i], nb = adj[i];
    for (let k = 0; k < nb.length; k++) { angSum += Math.acos(clamp(-1, 1, dot(a, verts[nb[k]]))); angCnt++; }
  }
  return angCnt ? angSum / angCnt : 0.1;
}

// ═══ shared profile library (pure, alea-free; ρ -> Δh) ════════════════════════════════════════════════
// Amplitudes come from P; the SHAPE constants stay LITERAL — they are the profile's identity, and keeping
// them literal makes formula-identity with the shipped inline copies self-evident.
export const PROFILE_DEFAULTS = Object.freeze({
  // corona amplitudes — VALUE-IDENTICAL to stagnantLid DEFAULTS and mixedInterior MIXED_DEFAULTS
  A_DOME: 0.35, A_TRENCH: 0.30, A_RISE: 0.12,   // active profile
  A_DEP: 0.18, A_RIM: 0.22,                     // inactive profile
  // grooved-diapir capability profile (NEW — a synthetic capability proof, NOT the #4.5 geometry decision)
  A_GROOVE_DOME: 0.25,   // central diapir dome amplitude
  A_GROOVE: 0.15,        // per-ring trough depth
  GROOVE_R0: 0.35,       // first ring radius (in ρ)
  GROOVE_DR: 0.28,       // ring spacing (in ρ)
  GROOVE_SIGMA: 0.06,    // ring trough half-width
  GROOVE_RINGS: 3,       // ring count (bounded fixed loop)
  GROOVE_SUPPORT: 1.2,   // hard support cutoff for the grooved type (>= R0 + (RINGS-1)·DR + 3σ ≈ 1.09)
});

// ≡ stagnantLid.js STEP-3 active branch ≡ mixedInterior.js STEP-7 active branch (exact FP arithmetic).
export function profileActiveCorona(rho, P = PROFILE_DEFAULTS) {
  const dome = P.A_DOME * Math.max(0, 1 - (rho / 0.75) * (rho / 0.75));
  const trench = P.A_TRENCH * Math.exp(-((rho - 0.95) / 0.12) * ((rho - 0.95) / 0.12));
  const rise = P.A_RISE * Math.exp(-((rho - 1.25) / 0.18) * ((rho - 1.25) / 0.18));
  return dome - trench + rise;
}

// ≡ both shipped inactive branches (exact FP arithmetic).
export function profileInactiveCorona(rho, P = PROFILE_DEFAULTS) {
  const dep = P.A_DEP * Math.max(0, 1 - (rho / 0.85) * (rho / 0.85));
  const rim = P.A_RIM * Math.exp(-((rho - 0.95) / 0.10) * ((rho - 0.95) / 0.10));
  return -dep + rim;
}

// NEW: central dome + GROOVE_RINGS concentric Gaussian ring troughs at rk = R0 + k·DR (the diapir option).
export function profileGroovedDiapir(rho, P = PROFILE_DEFAULTS) {
  const dome = P.A_GROOVE_DOME * Math.max(0, 1 - (rho / 0.9) * (rho / 0.9));
  let grooves = 0;
  for (let k = 0; k < P.GROOVE_RINGS; k++) {
    const rk = P.GROOVE_R0 + k * P.GROOVE_DR;
    grooves += Math.exp(-((rho - rk) / P.GROOVE_SIGMA) * ((rho - rk) / P.GROOVE_SIGMA));
  }
  return dome - P.A_GROOVE * grooves;
}

// Default per-type registry — support is a property of the profile SHAPE, so it lives WITH the profile.
// Grooved is NOT registered by default: registering it is the consumer's act (the consumer-seam test
// registers { fn: profileGroovedDiapir, support: PROFILE_DEFAULTS.GROOVE_SUPPORT } as typeId 2).
export const DISRUPT_PROFILES = Object.freeze([
  Object.freeze({ fn: profileInactiveCorona, support: 1.3 }),  // typeId 0 (≡ stagnant inactive support)
  Object.freeze({ fn: profileActiveCorona, support: 1.6 }),    // typeId 1 (≡ stagnant active support)
]);

// ═══ constructor 1 — makeCellDisruption (generalizes shellRelief STEP-2) ══════════════════════════════
export const CELL_DEFAULTS = Object.freeze({
  CELL_MIN: 9, CELL_SPAN: 9,        // K in [9,18) — value-identical to the shell seed
  WARP_FREQ: 1.6, WARP_AMP: 0.18,   // domain-warp of the cell walls (the shared three-tap idiom)
  BELT_RADIANS: 0.06,               // interiorness geodesic falloff half-width
});

export function makeCellDisruption(carrier, { macroSeed = 0, seedKey = 'disrupt:cells:', tune = null } = {}) {
  if (!seedKey.startsWith('disrupt:')) throw new Error('lidDisruption.makeCellDisruption: seedKey must be in the disrupt namespace');
  const T = tune ? { ...CELL_DEFAULTS, ...tune } : CELL_DEFAULTS;
  const N = carrier.N, verts = carrier.verts, adj = carrier.adj;
  const seed = (macroSeed | 0);
  const meanEdgeAngle = meanEdgeAngleOf(verts, adj, N);

  // Stream A — count draw, then 4/cell (randDir 2 + 2 RESERVED vigor/polarity draws, read and discarded).
  const rngCells = alea(seedKey + seed);
  const cellCount = T.CELL_MIN + Math.floor(rngCells() * T.CELL_SPAN);
  const centers = [];
  for (let p = 0; p < cellCount; p++) { centers.push(randDir(rngCells)); rngCells(); rngCells(); }

  // Stream B — separate warp stream (simplex construction draws land here, off Stream A's pinned total).
  const warpNoise = createNoise3D(alea(seedKey + 'warp:' + seed));

  // space-filling warped nearest-centroid assignment: three-tap domain warp, strict '>' tie-break (lowest index wins).
  const cellId = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const wx = warpNoise(d[0] * T.WARP_FREQ, d[1] * T.WARP_FREQ, d[2] * T.WARP_FREQ);
    const wy = warpNoise(d[0] * T.WARP_FREQ + 19.1, d[1] * T.WARP_FREQ - 7.3, d[2] * T.WARP_FREQ + 3.7);
    const wz = warpNoise(d[0] * T.WARP_FREQ - 5.2, d[1] * T.WARP_FREQ + 11.9, d[2] * T.WARP_FREQ - 2.4);
    const wd = norm([d[0] + T.WARP_AMP * wx, d[1] + T.WARP_AMP * wy, d[2] + T.WARP_AMP * wz]);
    let best = 0, bestDot = -Infinity;
    for (let p = 0; p < cellCount; p++) {
      const c = centers[p];
      const dd = wd[0] * c[0] + wd[1] * c[1] + wd[2] * c[2];
      if (dd > bestDot) { bestDot = dd; best = p; }
    }
    cellId[i] = best;
  }

  // multi-source BFS from wall nodes (differing-cellId neighbor) — the O(N) queue drain, the ONLY loop-to-a-condition.
  const wallDist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) {
    const nb = adj[i];
    for (let k = 0; k < nb.length; k++) { if (cellId[nb[k]] !== cellId[i]) { wallDist[i] = 0; q[qt++] = i; break; } }
  }
  if (qt === 0) { wallDist.fill(0); }
  else {
    while (qh < qt) {
      const c = q[qh++];
      const nd = wallDist[c] + 1;
      const nb = adj[c];
      for (let k = 0; k < nb.length; k++) { const m = nb[k]; if (wallDist[m] < 0) { wallDist[m] = nd; q[qt++] = m; } }
    }
  }

  // interiorness: 0 exactly on walls, monotone-nondecreasing inward toward 1 (≡ the shell falloff).
  const interiorness = new Float32Array(N);
  for (let i = 0; i < N; i++) interiorness[i] = clamp01(1 - Math.exp(-(wallDist[i] * meanEdgeAngle) / T.BELT_RADIANS));

  return { mode: 'cells', cellId, cellCount, interiorness, wallDist, centers, meanEdgeAngle };
}

// ═══ constructor 2 — makeFociDisruption (generalizes stagnantLid coronae) ═════════════════════════════
export const FOCI_DEFAULTS = Object.freeze({
  POOL: 120, POOL_REF_N: 1500,       // pool ∝ N ⇒ resolution-invariant coverage (the stagnant law)
  BIAS: 2.0,                         // accept ∝ acceptWeightAt(site)^BIAS
  CTRL_ACCEPT: 0.13,                 // constant accept when acceptWeightAt=null (the decoupled control)
  TYPE_FRAC: 0.65,                   // typeId 1 : 0 split (≡ stagnant active fraction)
  RC_MIN_NODES: 0.5, RC_SPAN_NODES: 1.1, SIZE_SKEW: 2.5,   // R_c = (MIN + u^SKEW·SPAN)·meanEdgeAngle
});

export function makeFociDisruption(carrier, {
  macroSeed = 0, seedKey = 'disrupt:foci:', tune = null,
  acceptWeightAt = null,   // (dir)->[0,1]; null ⇒ CTRL_ACCEPT constant (the decoupled control)
} = {}) {
  if (!seedKey.startsWith('disrupt:')) throw new Error('lidDisruption.makeFociDisruption: seedKey must be in the disrupt namespace');
  const T = tune ? { ...FOCI_DEFAULTS, ...tune } : FOCI_DEFAULTS;
  const N = carrier.N, verts = carrier.verts, adj = carrier.adj;
  const seed = (macroSeed | 0);
  const meanEdgeAngle = meanEdgeAngleOf(verts, adj, N);
  const pool = Math.max(1, Math.round(T.POOL * N / T.POOL_REF_N));   // ∝ N ⇒ resolution-invariant coverage

  // Stream C — the conditional-draw pattern (FROZEN): per candidate randDir(2) + accept(1); on accept +radius(1) +type(1).
  const rngFoci = alea(seedKey + seed);
  const centersArr = [];
  const radiiArr = [];
  const typeArr = [];
  for (let k = 0; k < pool; k++) {
    const site = randDir(rngFoci);                 // 2 draws
    const acc = rngFoci();                          // 1 draw (accept)
    const pAccept = acceptWeightAt ? Math.pow(clamp01(acceptWeightAt(site)), T.BIAS) : T.CTRL_ACCEPT;
    if (acc < pAccept) {
      const u = rngFoci();                          // 1 draw (radius) — only on accept
      const R_c = (T.RC_MIN_NODES + Math.pow(u, T.SIZE_SKEW) * T.RC_SPAN_NODES) * meanEdgeAngle; // heavy-tailed, node-scaled
      const tv = rngFoci();                         // 1 draw (type) — only on accept
      centersArr.push(site);
      radiiArr.push(R_c);
      typeArr.push(tv < T.TYPE_FRAC ? 1 : 0);
    }
  }
  const count = centersArr.length;
  return {
    mode: 'foci',
    centers: centersArr,
    radii: Float32Array.from(radiiArr),
    typeIds: Uint8Array.from(typeArr),
    alive: new Uint8Array(count).fill(1),   // all 1; the editor's deactivation switch
    count,
    meanEdgeAngle,
  };
}

// ═══ evaluation, split from placement — the V2-7 editor seam ══════════════════════════════════════════
// ZERO draws, ZERO alea calls: an editor mutates descriptors (alive[c]=0, typeIds[c]=k, radii[c]=r) and
// re-evaluates without touching any stream. Additive: overlapping features sum (the stagnant semantics).
export function evalFociDeformation(carrier, foci, profiles = DISRUPT_PROFILES, P = PROFILE_DEFAULTS) {
  const N = carrier.N, verts = carrier.verts;
  const contrib = new Float32Array(N);
  const coverMask = new Uint8Array(N);
  const centers = foci.centers, radii = foci.radii, typeIds = foci.typeIds, alive = foci.alive;
  for (let c = 0; c < foci.count; c++) {
    if (alive && !alive[c]) continue;
    const prof = profiles[typeIds[c]];
    if (!prof) throw new Error('lidDisruption.evalFociDeformation: no profile registered for typeId ' + typeIds[c]);
    const ctr = centers[c], Rc = radii[c] || 1e-6, support = prof.support;
    for (let i = 0; i < N; i++) {
      const a = Math.acos(clamp(-1, 1, dot(verts[i], ctr)));
      const rho = a / Rc;
      if (rho > support) continue;
      coverMask[i] = 1;
      contrib[i] += prof.fn(rho, P);
    }
  }
  return { contrib, coverMask };
}
