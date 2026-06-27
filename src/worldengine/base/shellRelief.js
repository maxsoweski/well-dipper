// src/worldengine/base/shellRelief.js
//
// Increment 1 of the world-engine history program: the DESPUN / ICE-SHELL relief writer.
// A three-free, deterministic sibling of plates.js that organizes relief about a SEEDED paleo-spin
// axis (w0) and tidal axis (t_hat) — NOT carrier latitude — for icy / despun / tidally-locked shells,
// replacing the sin^2(lat) zonal fallback for those bodies ONLY. It never touches the validated
// Earth-like plate path (the dispatch checks isEarthlikePlatePath FIRST, then shellRegimeOf).
//
// Determinism: every draw via alea(seedString) keyed off the integer macroSeed; NO Math.random /
// NO Date.now anywhere. Generative-not-simulative: the determined end-state in one pass + a bounded
// fixed RELAX_PASSES Jacobi smooth (mirrors plates.js). The ONLY iteration besides relaxation is an
// O(N) multi-source BFS queue drain (cell-distance transform) — copied from plates.js, NOT time-stepping.
//
// Build slices:
//   SLICE A (this scaffold) = regime resolution + dispatch seam + determinism + the convection-cell
//     partition + the diagnostics shape. The stress fields (stressTensile / thetaTraj / lineamentNode /
//     chaosMask) and the real STEP 5 relief assembly are STUBBED to deterministic placeholders.
//   SLICE B = STEP 1 stress-tensor field (despin + diurnal, diagonalized) + STEP 3 steered lineaments +
//     double-ridge cross-section + STEP 4 chaos overlay. Math pinned from research workflow wccpy01ez
//     (Melosh 1977 / Beuthe 2010 despin; Hoppa 1999 / Beuthe 2016 diurnal). See the workstream contract.

import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01 } from './mathutil.js';

// ── Regime resolution (the dispatch blocker, resolved) ────────────────────────────────────────────
// One source-of-truth map accepting BOTH the short lab keys (PRESET_ARCHETYPE) and the canonical long
// keys, returning a normalized regime tag. 'volatile' is a COINED new short key (exists in no current
// vocabulary; produced by exactly one added PRESET_ARCHETYPE line for Titan).
export const SHELL_REGIMES = Object.freeze({
  ice: 'icy-active', eyeball: 'eyeball-despun', volatile: 'volatile-cold',   // short lab keys
  'icy-active': 'icy-active', 'volatile-cold': 'volatile-cold',              // canonical long keys
});

// Non-shell keys that must NEVER match the locked-fallback: a locked gas giant / lava world / exotic /
// earthlike body would otherwise be handed a rocky ice-shell lineament field (physically absurd, and an
// AC8 clobber of its despun/plate path). terrestrial/ocean are here too so a locked terrestrial falls
// through to despun, matching the pre-existing regime gate.
export const SHELL_EXCLUDE = new Set(['terrestrial', 'ocean', 'gas-giant', 'sub-neptune', 'lava', 'carbon', 'crystal']);

/**
 * Resolve an (archetype, locked) pair to a shell regime tag, or null if this body is not a shell body.
 * 1) explicit map hit (short or long key) wins;
 * 2) else a LOCKED body not in SHELL_EXCLUDE falls back to 'eyeball-despun' (catches archetype=null +
 *    locked Europa-class fall-through so it never silently drops to sin^2(lat));
 * 3) else null.
 */
export function shellRegimeOf(archetype, locked = false) {
  const mapped = SHELL_REGIMES[archetype];
  if (mapped) return mapped;
  if (locked && !SHELL_EXCLUDE.has(archetype)) return 'eyeball-despun';
  return null;
}

// ── Locked tunables (frozen — overridable ONLY by the headless structure test via `tune`, never by
//    route()/lab; identical discipline to plates DEFAULTS) ──────────────────────────────────────────
export const RELAX_PASSES = 4;
export const SHELL_BOUND = 4;   // generous bound guard, mirror of plates U_BOUND

// Per-regime chaos-vs-lineament weight split (selected by the normalized regime tag).
const REGIME_WEIGHTS = Object.freeze({
  'icy-active':     { DESPIN_W: 0.7, DIURNAL_W: 1.0,  CHAOS_W: 1.0 },   // cycloids + double-ridges + masked chaos
  'volatile-cold':  { DESPIN_W: 1.0, DIURNAL_W: 0.15, CHAOS_W: 0.8 },   // despin lineaments + cantaloupe cells dominate
  'eyeball-despun': { DESPIN_W: 1.0, DIURNAL_W: 0.0,  CHAOS_W: 0.0 },   // despin lineament field only; no convecting shell
});

const SHELL_DEFAULTS = Object.freeze({
  CELL_MIN: 9, CELL_SPAN: 9,        // K convection cells in [9, 18) — finer than the 7–13 plates
  WARP_FREQ: 1.6, WARP_AMP: 0.18,   // domain-warp of cell centroids (irregular, non-great-circle cell walls)
  DETAIL_FREQ: 8.0, DETAIL_AMP: 0.02,
  BELT_RADIANS: 0.06,               // geodesic falloff half-width (resolution-independent)
  SHELL_BASE: 0.0,                  // flat icy datum this increment
  RELAX_PASSES,
  // SLICE B thresholds (pinned with the stress math): TENSILE_THRESH, CHAOS_THRESH, CREST_THRESH, RIDGE_AMP, DESPIN_REF, DIUR_REF
});

// ── tiny vec3 helpers on plain [x,y,z] arrays (COPIED VERBATIM from plates.js for resolution-independence) ──
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
// Deterministic uniform point on the unit sphere from an alea rng (z = 2u-1, azimuth 2πv).
function randDir(rng) {
  const z = 2 * rng() - 1;
  const t = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
}
// Angular falloff: 1 at a cell wall, decaying to ~0 a few `belt` radians into the cell interior.
const falloffAng = (angDist, belt) => Math.exp(-angDist / belt);

/**
 * Despun / ice-shell relief writer. Mirrors writePlateUpliftSphere's signature + discipline.
 * @param {object} carrier  sphere field (verts/adj/N + height/grainAngle/faultDensity channels)
 * @param {object} drivers  accepted for signature parity; VOID this increment (seed-only, like plates)
 * @param {{macroSeed?:number, regime?:string, tune?:object}} opts
 * @returns diagnostics object (peer of plateDiag) — see the workstream contract.
 */
export function writeShellReliefSphere(carrier, drivers = {}, { macroSeed = 0, regime = 'icy-active', tune = null } = {}) {
  void drivers;   // seed-only this increment (driver-RESPONSE is the next increment, via the `tune`/drivers seam)
  const T = tune ? { ...SHELL_DEFAULTS, ...tune } : SHELL_DEFAULTS;
  const W = REGIME_WEIGHTS[regime] || REGIME_WEIGHTS['icy-active'];
  const PASSES = T.RELAX_PASSES;

  const N = carrier.N, verts = carrier.verts, adj = carrier.adj;
  const seed = (macroSeed | 0);

  // ── STEP 0 — resolution key: mean edge angle (geodesic radians per BFS hop) ──
  let angSum = 0, angCnt = 0;
  for (let i = 0; i < N; i++) {
    const a = verts[i], nb = adj[i];
    for (let k = 0; k < nb.length; k++) { angSum += Math.acos(clamp(-1, 1, dot(a, verts[nb[k]]))); angCnt++; }
  }
  const meanEdgeAngle = angCnt ? angSum / angCnt : 0.1;

  // ── seeded frames (disjoint 'shell:' alea namespace — never collides with plates' 'plates:' or 'e6:') ──
  const w0 = randDir(alea('shell:axis:' + seed));      // PALEO-SPIN axis: despin stress is organized about THIS
  const t_hat = randDir(alea('shell:tidal:' + seed));  // sub-parent (permanent-bulge) axis for diurnal stress
  const phi0 = 2 * Math.PI * alea('shell:nsr:' + seed)();   // frozen NSR / diurnal phase
  const detailNoise = createNoise3D(alea('shell:detail:' + seed));

  // ── STEP 2 — convection-cell partition (secondary; only when CHAOS_W > 0) ──
  const cellId = new Int32Array(N);
  const cellInteriorness = new Float32Array(N);
  let cellCount = 0;
  if (W.CHAOS_W > 0) {
    const rngCells = alea('shell:cells:' + seed);
    cellCount = T.CELL_MIN + Math.floor(rngCells() * T.CELL_SPAN);
    const centroids = [];
    for (let p = 0; p < cellCount; p++) { centroids.push(randDir(rngCells)); rngCells(); rngCells(); }  // + polarity/vigor draws (consumed in SLICE B)
    const warpNoise = createNoise3D(alea('shell:warp:' + seed));
    // spherical-Voronoi: nearest-by-max-dot over warped centroids; strict '>' tie-break (lowest index wins, == plates)
    for (let i = 0; i < N; i++) {
      const d = verts[i];
      const wx = warpNoise(d[0] * T.WARP_FREQ, d[1] * T.WARP_FREQ, d[2] * T.WARP_FREQ);
      const wy = warpNoise(d[0] * T.WARP_FREQ + 19.1, d[1] * T.WARP_FREQ - 7.3, d[2] * T.WARP_FREQ + 3.7);
      const wz = warpNoise(d[0] * T.WARP_FREQ - 5.2, d[1] * T.WARP_FREQ + 11.9, d[2] * T.WARP_FREQ - 2.4);
      const wd = norm([d[0] + T.WARP_AMP * wx, d[1] + T.WARP_AMP * wy, d[2] + T.WARP_AMP * wz]);
      let best = 0, bestDot = -Infinity;
      for (let p = 0; p < cellCount; p++) {
        const c = centroids[p];
        const dd = wd[0] * c[0] + wd[1] * c[1] + wd[2] * c[2];
        if (dd > bestDot) { bestDot = dd; best = p; }
      }
      cellId[i] = best;
    }
    // multi-source BFS distance transform from cell WALLS (downwelling sutures); interiors = upwelling/chaos candidates
    const cellDist = new Int32Array(N).fill(-1);
    const q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) {
      const nb = adj[i];
      for (let k = 0; k < nb.length; k++) { if (cellId[nb[k]] !== cellId[i]) { cellDist[i] = 0; q[qt++] = i; break; } }
    }
    if (qt === 0) { cellDist.fill(0); }
    else {
      while (qh < qt) {
        const c = q[qh++];
        const nd = cellDist[c] + 1;
        for (const nb of adj[c]) { if (cellDist[nb] < 0) { cellDist[nb] = nd; q[qt++] = nb; } }
      }
    }
    for (let i = 0; i < N; i++) cellInteriorness[i] = clamp01(1 - falloffAng(cellDist[i] * meanEdgeAngle, T.BELT_RADIANS));
  }

  // ── STEP 1 / 3 / 4 — STRESS TENSOR + LINEAMENTS + CHAOS: STUBBED in SLICE A (deterministic zeros) ──
  // SLICE B fills these from the pinned despin + diurnal closed forms (research wccpy01ez).
  const stressTensile = new Float32Array(N);   // signed sigma1
  const thetaTraj = new Float32Array(N);        // most-tensile principal-axis angle == grainAngle written
  const lineamentNode = new Uint8Array(N);      // 1 where a ridge-shoulder / crack is placed
  const chaosMask = new Float32Array(N);

  // ── STEP 5 — assemble (SLICE A placeholder: flat datum + sub-grid detail; non-trivial + seed-varying.
  //    SLICE B REPLACES this with SHELL_BASE + despinLineament + diurnalDoubleRidge + chaosOverlay + detail) ──
  const U = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    U[i] = T.SHELL_BASE + T.DETAIL_AMP * detailNoise(d[0] * T.DETAIL_FREQ, d[1] * T.DETAIL_FREQ, d[2] * T.DETAIL_FREQ);
  }
  carrier.height.set(U);   // REPLACE (sole low/mid source for shell regimes — no additive re-banding)

  // bounded fixed RELAX_PASSES Jacobi smooth (double-buffered convex combination, verbatim plates)
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

  carrier.grainAngle.set(thetaTraj);                                            // lineament strike (0 this slice)
  for (let i = 0; i < N; i++) carrier.faultDensity[i] = clamp01(Math.abs(stressTensile[i]));  // activity proxy (0 this slice)

  return {
    U, regime, cellId, cellCount, stressTensile, thetaTraj, lineamentNode, chaosMask,
    w0, t_hat, phi0, meanEdgeAngle, relaxPasses: PASSES,
  };
}
