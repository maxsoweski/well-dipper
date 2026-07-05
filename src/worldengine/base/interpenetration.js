// src/worldengine/base/interpenetration.js
//
// World Engine V2-2b-2a — the Π = C·F INTERPENETRATION INSTRUMENT (gate-3 Open-Q6). A pure, deterministic,
// three-free* statistic that separates a genuinely COMPOUND landform (pierce and tent expressions
// INTERPENETRATE — "a shield emerging FROM a corona at one center") from the two failure modes the pilot
// exists to avoid: TILING ("Io-patch beside Venus-patch" — one/few big segregated blobs → F→0) and the
// salt-and-pepper SCATTER mush (random per-node → C→0 at fine meshes, M→1 always).
//
// It is a STRAIGHT PORT of computeStats from the pre-code gate-3 arbiter
// (docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-3-interpenetration-validation.mjs:109-166),
// generalized to project a multi-valued primitiveId through familyOf into the binary pierce/tent class the
// statistic consumes. It adds legibleByFamily (a per-family count of ≥SIZE_FLOOR connected components) so a
// caller can gate on "≥2 legible pierce components" (MF4 — Π>0 on a mixed world holds only conditional on
// that, since F=0 for a single legible component).
//
// *IMPORTS ONLY familyOf from lidResponse.js — ONE-WAY, non-circular (MF2): the router imports the composer
// (mixedInterior.js), the composer imports NOTHING project-local, and THIS module imports the router's family
// map. There is no lidResponse → interpenetration edge (the composer takes the statistic by injection at the
// use site, never by import), so the graph stays acyclic. No alea, no Math.random/Date.now, no convergence
// loop — three O(N·deg) passes over a plain {verts, adj} mesh (edges/meanEdgeAngle/nodeArea derived if absent).
import { familyOf as defaultFamilyOf, FAMILY } from './lidResponse.js';

// ── tiny vec3 helpers (three-free; same convention as the gate-3 arbiter + the base/ writers) ──────────────
const clamp = (lo, hi, v) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angDist = (a, b) => Math.acos(clamp(-1, 1, dot(a, b)));   // geodesic radians

// The gate-3 companion-guard constants (gate-3-interpenetration-validation.mjs:286-287). Exported so the AC
// asserts against the single source, never re-declared literals.
export const PI_STAR = 0.15;     // pass floor on Π
export const M_MAX = 0.70;       // companion scatter gate (reject if the field is random-mixed)

// SIZE_FLOOR scales with N (a real feature's node count ∝ N; a random speck does not), so the legibility cut
// is resolution-invariant (gate-3:106-107). = 6 @ N=1500, 164 @ N=40962.
const FLOOR_FRAC = 0.004;                                        // ≥0.4% of the sphere = a legible feature
export const sizeFloor = (N) => Math.max(6, Math.round(FLOOR_FRAC * N));

// deriveMesh — the statistic needs {verts, adj, edges, meanEdgeAngle, nodeArea}. buildFibSphere (the gate-3
// synthetic mesh) already carries all five; makeSphereField (the pilot carrier) returns only {verts, adj, N}
// + field arrays (sphereField.js:11-20), so edges / meanEdgeAngle / nodeArea are DERIVED here exactly as the
// arbiter builds them (edges = i<j pairs of adj; meanEdgeAngle = mean geodesic edge length; nodeArea = 4π/N).
function deriveMesh(mesh) {
  const verts = mesh.verts, adj = mesh.adj;
  const N = verts.length;
  if (mesh.edges && mesh.meanEdgeAngle != null && mesh.nodeArea != null) {
    return { verts, adj, edges: mesh.edges, meanEdgeAngle: mesh.meanEdgeAngle, nodeArea: mesh.nodeArea, N };
  }
  const edges = [];
  let angSum = 0, eCount = 0;
  for (let i = 0; i < N; i++) for (const j of adj[i]) if (j > i) { edges.push([i, j]); angSum += angDist(verts[i], verts[j]); eCount++; }
  return { verts, adj, edges, meanEdgeAngle: eCount ? angSum / eCount : 0, nodeArea: (4 * Math.PI) / N, N };
}

// countLegibleComponents — union-find over the nodes whose class === target; return the number of connected
// components with ≥ FLOOR nodes. Used ONLY for legibleByFamily (a size cut, no boundary geometry needed).
function countLegibleComponents(N, adj, cls, target, FLOOR) {
  const parent = new Int32Array(N).fill(-1);
  const find = (x) => { let r = x; while (parent[r] !== r) r = parent[r]; while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; } return r; };
  for (let i = 0; i < N; i++) if (cls[i] === target) parent[i] = i;
  for (let i = 0; i < N; i++) if (cls[i] === target) for (const j of adj[i]) if (cls[j] === target && j > i) { const ri = find(i), rj = find(j); if (ri !== rj) parent[ri] = rj; }
  const size = new Map();
  for (let i = 0; i < N; i++) if (cls[i] === target) { const r = find(i); size.set(r, (size.get(r) || 0) + 1); }
  let legible = 0;
  for (const s of size.values()) if (s >= FLOOR) legible++;
  return legible;
}

/**
 * interpenetration — the Π = C·F interpenetration index of a primitiveId field, plus its companion M and the
 * per-family legible-component counts. A straight port of gate-3's computeStats, generalized to project the
 * multi-valued primitiveId through familyOf into the binary pierce/tent class the statistic contrasts.
 *
 *   C = COMPACTNESS  = (effective-compact pierce area) / (total pierce area) ∈ [0,1]. Per figure-component
 *       q_k = clamp01(B_disc / B_k): 1 for a round disc, →0 for a fractal/percolated/speckled blob. Sub-
 *       SIZE_FLOOR specks score 0. → rejects SCATTER (salt-and-pepper: nothing is a compact disc).
 *   F = FRAGMENTATION = 1 − Σ_k (e_k/E)²  (Herfindahl over effective-compact areas). 0 = one blob, →1 = many
 *       equal dispersed discs. → rejects TILING (few big segregated blobs). F = 0 for a SINGLE legible
 *       component (⇒ Π = 0), which is why "Π>0 on a mixed world" is conditional on ≥2 legible pierce comps.
 *   Π = C · F — high only when pierce is BOTH dispersed (F) AND compact (C): structured nesting.
 *   M = the join-count heterotypic-edge fraction vs the random-permutation null (necessary-but-insufficient
 *       diagnostic; the companion scatter gate — scatter sits at M≈1 at EVERY resolution).
 *
 * @param {{verts:number[][], adj:(Int32Array|number[])[], edges?:number[][], meanEdgeAngle?:number, nodeArea?:number}} mesh
 *        a plain sphere mesh (the pilot carrier OR the gate-3 fib-sphere). edges/meanEdgeAngle/nodeArea are
 *        derived from verts+adj when absent.
 * @param {ArrayLike<number>} primitiveId  the per-node landform id (or, on the synthetic leg, a binary cls
 *        already in {0,1} — familyOf is the identity there since familyOf(1)=PIERCE, familyOf(0)=TENT).
 * @param {(id:number)=>number} [familyOf=lidResponse.familyOf]  the primitiveId → FAMILY projection.
 * @returns {{Pi:number, M:number, C:number, F:number, nComp:number, nLegible:number,
 *            legibleByFamily:{pierce:number, tent:number}}}
 */
export function interpenetration(mesh, primitiveId, familyOf = defaultFamilyOf) {
  const { verts, adj, edges, meanEdgeAngle, nodeArea, N } = deriveMesh(mesh);
  const FLOOR = sizeFloor(N);

  // project primitiveId → binary pierce/tent class (1 = PIERCE, 0 = TENT).
  const cls = new Uint8Array(N);
  for (let i = 0; i < N; i++) cls[i] = familyOf(primitiveId[i]) === FAMILY.PIERCE ? 1 : 0;

  let nA = 0; for (let i = 0; i < N; i++) nA += cls[i];   // pierce count (class 1)
  const nB = N - nA;

  // M — heterotypic-edge fraction vs random-permutation expectation (reported diagnostic / scatter gate).
  let EAB = 0; for (const [i, j] of edges) if (cls[i] !== cls[j]) EAB++;
  const Etot = edges.length;
  const Eexp = Etot * (2 * nA * nB) / (N * (N - 1));
  const M = clamp01(Eexp > 0 ? EAB / Eexp : 0);

  // figure = minority class (ties → pierce = 1)
  const minC = nA <= nB ? 1 : 0;
  const nMin = nA <= nB ? nA : nB;
  // union-find over the figure-class nodes
  const parent = new Int32Array(N).fill(-1);
  const find = (x) => { let r = x; while (parent[r] !== r) r = parent[r]; while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; } return r; };
  for (let i = 0; i < N; i++) if (cls[i] === minC) parent[i] = i;
  for (let i = 0; i < N; i++) if (cls[i] === minC) for (const j of adj[i]) if (cls[j] === minC && j > i) { const ri = find(i), rj = find(j); if (ri !== rj) parent[ri] = rj; }
  // per-component: size + boundary-node count (figure node with ≥1 non-figure neighbour)
  const size = new Map(), bnd = new Map();
  for (let i = 0; i < N; i++) if (cls[i] === minC) {
    const r = find(i);
    size.set(r, (size.get(r) || 0) + 1);
    let isB = 0; for (const j of adj[i]) if (cls[j] !== minC) { isB = 1; break; }
    if (isB) bnd.set(r, (bnd.get(r) || 0) + 1);
  }
  // effective-compact area per component; C and F derive from it
  const eArr = [];
  let E = 0, compactArea = 0, nComp = 0, nLegible = 0;
  for (const [r, s] of size) {
    nComp++;
    const a_k = s * nodeArea;                              // steradians
    if (s < FLOOR) { continue; }                            // sub-legible speck → e = 0
    nLegible++;
    const Ak = a_k;
    const rho = Math.acos(clamp(-1, 1, 1 - Ak / (2 * Math.PI)));   // equal-area disc radius
    const Bdisc = (2 * Math.PI * Math.sin(rho)) / meanEdgeAngle;   // its 1-ring boundary-node count
    const Bk = bnd.get(r) || 1;
    const qk = clamp01(Bdisc / Bk);                        // 1 = round disc, →0 = fractal/ragged
    const e_k = a_k * qk;                                  // effective-compact area
    eArr.push(e_k); E += e_k; compactArea += a_k * qk;
  }
  const totalPierceArea = nMin * nodeArea;
  const C = totalPierceArea > 0 ? compactArea / totalPierceArea : 0;   // fraction of pierce area that is compact
  let herf = 0; if (E > 0) for (const e of eArr) { const w = e / E; herf += w * w; }
  const F = E > 0 ? 1 - herf : 0;                          // fragmentation / dispersion
  const Pi = C * F;

  // legibleByFamily — per-family count of ≥SIZE_FLOOR connected components (MF4 gate: pierce ≥ 2 ⇒ F can be
  // > 0 ⇒ Π can be > 0). Computed for BOTH families (the figure metrics above measure only the minority).
  const legibleByFamily = {
    pierce: countLegibleComponents(N, adj, cls, 1, FLOOR),
    tent: countLegibleComponents(N, adj, cls, 0, FLOOR),
  };

  return { Pi, M, C, F, nComp, nLegible, legibleByFamily };
}
