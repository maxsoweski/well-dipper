// src/worldengine/base/magmatism.js
//
// Increment 4a of the world-engine history program: the VOLCANIC / ENDOGENIC-HEAT relief writer.
// A three-free, deterministic sibling of plates.js and shellRelief.js that organizes relief about a
// SEEDED mantle-plume field — NOT carrier latitude — for volcanic bodies (Lava / Magma-K2-141b /
// Io-type), replacing the sin^2(lat) zonal fallback for those bodies ONLY. It never touches the
// validated Earth-like plate path or the icy/despun shell path (the dispatch checks
// isEarthlikePlatePath FIRST, then isShellReliefPath, then isVolcanicPath LAST).
//
// Determinism: every draw via alea(seedString) keyed off the integer macroSeed in the DISJOINT
// 'magma:' namespace (never collides with plates' 'plates:', shell's 'shell:' or 'e6:'); NO
// Math.random / NO Date.now anywhere (incl. helpers). Generative-not-simulative: the determined
// end-state in one pass + a bounded fixed RELAX_PASSES Jacobi smooth (mirrors plates.js). The ONLY
// iteration besides relaxation is an O(N) multi-source BFS queue drain (a geodesic distance transform
// from the plume tops) — copied from plates.js, NOT time-stepping / NOT a convergence while-loop.
//
// Build slices:
//   SLICE A (this scaffold) = the plume-centroid spherical-Voronoi partition (plumeId) + the BFS
//     geodesic proximity to the plume tops (hotspotProximity) + a MINIMAL deterministic U derived
//     from that proximity, enough that AC1 byte-identity + AC6 variety + |U| < MAGMA_BOUND hold. It
//     is the determinism + dispatch scaffold; it deliberately does NOT author the real landforms.
//   SLICE B (needs mustFix #1) = the three relief contributions assembled into U: the shield/edifice
//     analytic crest profile at plume tops (threshold crest rule gated by plume proximity), the
//     effusive lava-plain flooding of the lows between edifices, and the substellar magma-ocean BASIN
//     (a hemisphere-scale depression on the substellar axis, gated on locked & extreme-T) — plus the
//     lavaPlainMask / magmaOceanMask diagnostics and the mean(edifice)>mean(plain)>mean(basin) order.
//     Math pinned from the workstream contract mustFix #1 (Io hotspot/shield volcanism; flood-basalt).

import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01 } from './mathutil.js';

// ── Locked tunables (frozen — overridable ONLY by the headless structure test via `tune`, never by
//    route()/lab; identical discipline to plates DEFAULTS / shell SHELL_DEFAULTS) ────────────────────
export const RELAX_PASSES = 4;
export const MAGMA_BOUND = 4;   // generous bound guard, mirror of plates U_BOUND / shell SHELL_BOUND

export const MAGMA_DEFAULTS = Object.freeze({
  PLUME_COUNT_MIN: 5,        // major mantle plumes floor (fewer than the 7–13 plates / 9–18 cells)
  PLUME_COUNT_SPAN: 6,       // => count ∈ [5, 11) (AC6 variety: different plume counts per seed)
  WARP_FREQ: 1.5,            // domain-warp frequency for irregular (non-great-circle) plume-province walls
  WARP_AMP: 0.20,            // domain-warp amplitude (fraction of a unit direction)
  BELT_RADIANS: 0.10,        // GEODESIC falloff half-width (radians) for hotspot proximity —
                             //   RESOLUTION-INDEPENDENT: the inward falloff length is angular, so the
                             //   hotspot halo is the same physical width on the 600-node test carrier
                             //   and the ~40k lab mesh (NOT a fixed hop count).
  DETAIL_FREQ: 7.0,          // small isotropic sub-grid texture so provinces aren't perfectly flat
  DETAIL_AMP: 0.02,          // detail amplitude — deliberately small (SLICE-A placeholder field)
  // ── SLICE-A placeholder relief scale (NOT the real edifice/plain/basin profiles — those are SLICE B) ──
  MAGMA_BASE: 0.05,          // flat volcanic-plain datum (placeholder)
  PLUME_GAIN: 1.0,           // proximity→height gain of the placeholder plume bump
  RELAX_PASSES,
});

// ── tiny vec3 helpers on plain [x,y,z] arrays (COPIED VERBATIM from plates.js for resolution-
//    independence; plates.js/shellRelief.js/tectonic.js are out-of-scope to edit — no cross-imports) ──
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
// Angular falloff: 1 at a plume top, decaying to ~0 a few `belt` radians into the surrounding province.
const falloffAng = (angDist, belt) => Math.exp(-angDist / belt);

/**
 * One-pass volcanic / endogenic-heat relief writer. Mirrors writePlateUpliftSphere's signature +
 * discipline. WRITES carrier.height[i] = U[i] (REPLACE, the sole low/mid source for a volcanic body)
 * and RETURNS the diagnostics the structure tests + the live magmaProbe read.
 *
 * @param {object} carrier  F3 sphere carrier (makeSphereField output): verts, adj, N, latDegOf,
 *                          tangentFrameAt. carrier.height is REPLACED via .set(U).
 * @param {object} drivers  the E6 driver bundle — accepted for signature parity with the writer
 *                          family; VOID this increment (placement is seed-only by locked scope, exactly
 *                          as plates.js / shellRelief.js shipped).
 * @param {{macroSeed?:number, locked?:boolean, tune?:object}} opts  macroSeed = the body's
 *                          deterministic integer seed; locked = tidal-lock flag (threaded for the
 *                          SLICE-B substellar magma-ocean basin gate; seed-only substellarAxis this
 *                          increment — NO driver-response); tune = headless-test override of DEFAULTS.
 * @returns {{U:Float32Array, plumeId:Int32Array, plumeCount:number, hotspotNode:Int32Array,
 *            hotspotProximity:Float32Array, substellarAxis:number[], relaxPasses:number,
 *            centroids:number[][], meanEdgeAngle:number}}
 */
export function writeMagmatismSphere(carrier, drivers = {}, { macroSeed = 0, locked = false, tune = null } = {}) {
  void drivers;   // seed-only this increment (driver-RESPONSE deferred, exactly as plates/shell shipped)
  void locked;    // threaded for the SLICE-B substellar magma-ocean basin gate; unused in the scaffold
  const T = tune ? { ...MAGMA_DEFAULTS, ...tune } : MAGMA_DEFAULTS;  // production passes no `tune`
  const PASSES = T.RELAX_PASSES;

  const N = carrier.N, verts = carrier.verts, adj = carrier.adj;
  const seed = (macroSeed | 0);

  // ── STEP 0 — resolution key: mean edge angle (geodesic radians per BFS hop) ────────────────────────
  // Converts BFS hop distance to a resolution-independent GEODESIC distance so the hotspot halo is the
  // same physical width on the 600-node test carrier and the ~40k lab mesh (verbatim plates/shell).
  let angSum = 0, angCnt = 0;
  for (let i = 0; i < N; i++) {
    const a = verts[i], nb = adj[i];
    for (let k = 0; k < nb.length; k++) { angSum += Math.acos(clamp(-1, 1, dot(a, verts[nb[k]]))); angCnt++; }
  }
  const meanEdgeAngle = angCnt ? angSum / angCnt : 0.1;

  // ── STEP 1 — seed N mantle-plume centroids deterministically from macroSeed (disjoint 'magma:' ns) ──
  const rngCount = alea('magma:count:' + seed);
  const rngCentroid = alea('magma:centroid:' + seed);
  const warpNoise = createNoise3D(alea('magma:warp:' + seed));
  const detailNoise = createNoise3D(alea('magma:detail:' + seed));
  const substellarAxis = randDir(alea('magma:substellar:' + seed));   // SEED-ONLY axis (no driver-response)

  const plumeCount = T.PLUME_COUNT_MIN + Math.floor(rngCount() * T.PLUME_COUNT_SPAN);
  const centroids = [];
  for (let p = 0; p < plumeCount; p++) centroids.push(randDir(rngCentroid));

  // ── STEP 2 — spherical-Voronoi partition (domain-warped plume-province walls) ─────────────────────
  // nearest centroid by MAX dot (geodesic distance = arccos(dot), so nearest = max dot). Strict '>'
  // tie-break ⇒ lowest-index plume wins (identical to plates/shell). The node direction is domain-warped
  // by low-freq 3D simplex so province margins are irregular, not great-circle arcs.
  const plumeId = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const wx = warpNoise(d[0] * T.WARP_FREQ, d[1] * T.WARP_FREQ, d[2] * T.WARP_FREQ);
    const wy = warpNoise(d[0] * T.WARP_FREQ + 19.1, d[1] * T.WARP_FREQ - 7.3, d[2] * T.WARP_FREQ + 3.7);
    const wz = warpNoise(d[0] * T.WARP_FREQ - 5.2, d[1] * T.WARP_FREQ + 11.9, d[2] * T.WARP_FREQ - 2.4);
    const wd = norm([d[0] + T.WARP_AMP * wx, d[1] + T.WARP_AMP * wy, d[2] + T.WARP_AMP * wz]);
    let best = 0, bestDot = -Infinity;
    for (let p = 0; p < plumeCount; p++) {
      const c = centroids[p];
      const dd = wd[0] * c[0] + wd[1] * c[1] + wd[2] * c[2];
      if (dd > bestDot) { bestDot = dd; best = p; }   // strict '>' (lowest-index tie-break, == plates/shell)
    }
    plumeId[i] = best;
  }

  // ── STEP 3 — plume tops (hotspots): the node nearest each centroid = the surface expression ───────
  // The hotspot is AT the plume top (unlike plates, whose relief keys off cell WALLS): edifices will sit
  // ON these nodes in SLICE B. hotspotNode[p] = argmax_i (verts[i] · centroid[p]) over the UNWARPED
  // directions (the true geometric nearest node).
  const hotspotNode = new Int32Array(plumeCount);
  for (let p = 0; p < plumeCount; p++) {
    const c = centroids[p];
    let best = 0, bestDot = -Infinity;
    for (let i = 0; i < N; i++) { const dd = dot(verts[i], c); if (dd > bestDot) { bestDot = dd; best = i; } }
    hotspotNode[p] = best;
  }

  // ── STEP 4 — multi-source BFS geodesic distance transform FROM the plume tops → hotspotProximity ───
  // O(N) queue drain (NOT a convergence loop): every node is enqueued exactly once. hotspotProximity =
  // falloffAng(geodesic dist to nearest plume top) ∈ [0,1] (1 AT a hotspot, → 0 far into the province).
  const hotspotDist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let p = 0; p < plumeCount; p++) {
    const n0 = hotspotNode[p];
    if (hotspotDist[n0] < 0) { hotspotDist[n0] = 0; q[qt++] = n0; }
  }
  if (qt === 0) { hotspotDist.fill(0); }
  else {
    while (qh < qt) {
      const c = q[qh++];
      const nd = hotspotDist[c] + 1;
      for (const nb of adj[c]) { if (hotspotDist[nb] < 0) { hotspotDist[nb] = nd; q[qt++] = nb; } }
    }
  }
  const hotspotProximity = new Float32Array(N);
  for (let i = 0; i < N; i++) hotspotProximity[i] = clamp01(falloffAng(hotspotDist[i] * meanEdgeAngle, T.BELT_RADIANS));

  // ── STEP 5 — assemble U (SLICE-A PLACEHOLDER FIELD ONLY) ──────────────────────────────────────────
  // A MINIMAL deterministic field derived from hotspotProximity: a flat volcanic-plain datum + a plume
  // bump + small detail. This is NOT the real geology — the shield/edifice crest profile, the effusive
  // lava-plain flooding, and the substellar magma-ocean basin (with their lavaPlainMask/magmaOceanMask
  // and the mean(edifice)>mean(plain)>mean(basin) elevation ordering) are SLICE B (mustFix #1). It
  // exists so AC1 byte-identity + AC6 variety + |U| < MAGMA_BOUND hold on the scaffold.
  const U = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const detail = T.DETAIL_AMP * detailNoise(d[0] * T.DETAIL_FREQ, d[1] * T.DETAIL_FREQ, d[2] * T.DETAIL_FREQ);
    U[i] = T.MAGMA_BASE + T.PLUME_GAIN * hotspotProximity[i] + detail;
  }
  carrier.height.set(U);   // REPLACE (sole low/mid source for a volcanic body — no additive re-banding)

  // ── bounded gen-time relaxation (render-once): fixed RELAX_PASSES Jacobi smooth over carrier.adj ────
  // Same h*0.5 + mean(self+neighbours)*0.5 weighting as tectonic.js / plates / shell. A convex
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
  carrier.height.set(U);

  return {
    U, plumeId, plumeCount, hotspotNode, hotspotProximity, substellarAxis,
    centroids, relaxPasses: PASSES, meanEdgeAngle,
    // lavaPlainMask / magmaOceanMask are SLICE B (mustFix #1) — omitted here, added in B.
  };
}
