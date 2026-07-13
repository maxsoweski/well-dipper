// src/worldengine/base/magmatism.js
//
// Increment 4a of the world-engine history program: the VOLCANIC / ENDOGENIC-HEAT relief writer.
// A three-free, deterministic sibling of plates.js and shellRelief.js that organizes relief about a
// SEEDED mantle-plume field — NOT carrier latitude — for volcanic bodies (Lava / Magma-K2-141b /
// Io-type), replacing the sin^2(lat) zonal fallback for those bodies ONLY. It never touches the
// validated Earth-like plate path or the icy/despun shell path — writeBodyRelief's condition-derived
// dispatch routes the heat-pipe / unbroken-lid family here (via the lidResponse router) only after
// the plate and icy-shell regimes have already claimed their bodies.
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
//   SLICE B (BUILT — SLICE-B-mechanism-math.md §1–§6) = the three relief contributions assembled into
//     U: §2 the F7 shield/edifice analytic crest profile (transcribed VERBATIM) at plume tops (absolute
//     geodesic crest rule r<1, NOT a relative local-max) + a Walcott flexural moat; §3 a province swell
//     dome linear in plume proximity (the AC2 correlation workhorse); §4 effusive lava-plain flooding of
//     the lows to an analytic mean-minus-Z*std datum (O(N), NO sort); §5 the substellar magma-ocean BASIN
//     (a hemisphere-scale depression on the seed-only substellar axis, gated on EXTREME-T T_ss > LIQUIDUS
//     via the shipped F41 iso-angle law, NOT on `locked`) — plus the edifice/lavaPlain/magmaOcean masks
//     and the construction-proven mean(edifice) > mean(lava-plain) > mean(magma-ocean basin) ordering.

import alea from 'alea';
import { createNoise3D } from 'simplex-noise';
import { clamp, clamp01, mix } from './mathutil.js';

// ── Locked tunables (frozen — overridable ONLY by the headless structure test via `tune`, never by
//    route()/lab; identical discipline to plates DEFAULTS / shell SHELL_DEFAULTS) ────────────────────
export const RELAX_PASSES = 4;
export const MAGMA_BOUND = 4;   // generous bound guard, mirror of plates U_BOUND / shell SHELL_BOUND

// Every constant below is a PINNED value from docs/WORKSTREAMS/world-engine-magmatism-2026-06-30/
// SLICE-B-mechanism-math.md (§1–§5). The §6 construction-level ordering proof (mean(edifice) >
// mean(lava-plain) > mean(magma-ocean basin)) holds for these values for every seed / body / mesh.
export const MAGMA_DEFAULTS = Object.freeze({
  // ── §1 plume field (SLICE A) ──────────────────────────────────────────────────────────────────────
  PLUME_COUNT_MIN: 5,        // major mantle plumes floor (fewer than the 7–13 plates / 9–18 cells)
  PLUME_COUNT_SPAN: 6,       // => count ∈ [5, 11) (AC6 variety: different plume counts per seed)
  WARP_FREQ: 1.5,            // domain-warp frequency for irregular (non-great-circle) plume-province walls
  WARP_AMP: 0.20,            // domain-warp amplitude (fraction of a unit direction)
  BELT_RADIANS: 0.10,        // GEODESIC falloff half-width (radians) for hotspot proximity zeta —
                             //   RESOLUTION-INDEPENDENT: the inward falloff length is angular, so the
                             //   hotspot halo is the same physical width on the 600-node test carrier
                             //   and the ~40k lab mesh (NOT a fixed hop count).
  DETAIL_FREQ: 7.0,          // small isotropic sub-grid texture so provinces aren't perfectly flat
  DETAIL_AMP: 0.02,          // detail amplitude — deliberately small (sub-ordering-margin cosmetic)
  MAGMA_BASE: 0.05,          // flat volcanic-plain datum (the quiet-terrain reference elevation)
  // ── §1 per-plume strength / radius / shield-mix draws (alea('magma:strength:'+seed)) ────────────────
  EDIFICE_HEIGHT: 1.0,       // peak-amplitude scale; A_e = EDIFICE_HEIGHT*(STRENGTH_LO+(1-STRENGTH_LO)*s) ∈ [0.4,1.0]
  STRENGTH_LO: 0.4,          // amplitude floor (every shield rises > 0 → the ordering proof's A_bar ≥ 0.4)
  EDIFICE_RADIUS_MIN: 0.10,  // angular edifice radius floor (rad); Psi_e = MIN + jit*SPAN ∈ [0.10,0.26]
  EDIFICE_RADIUS_SPAN: 0.16, //   → broad, low-aspect basaltic shields (Olympus/Hawaiian/Io tholus scale)
  SHIELD_P_LO: 1.5,          // shield exponent lo (p=1.5 broadest, low-slope basaltic shield)
  SHIELD_P_HI: 4.0,          // shield exponent hi (p→4 steep strato); p = mix(LO,HI, clamp01(MIX_BASE+MIX_SPAN*m))
  SHIELD_MIX_BASE: 0.10,     //   → p ∈ [mix(1.5,4,0.10), mix(1.5,4,0.40)] = [1.75, 2.5] (broad shields)
  SHIELD_MIX_SPAN: 0.30,
  CALDERA_FRAC: 0.15,        // §2 summit-caldera radius fraction c (F7 VERBATIM: caldera(r)=0.5((r/c)^2-1), r<c)
  // ── §2 Walcott flexural moat (SURROUND-ONLY, r >= 1) ────────────────────────────────────────────────
  MOAT_DEPTH: 0.10,          // moat depth as a fraction of A_e (shallow negative Gaussian ring)
  MOAT_CTR: 1.20,            // moat centre as a fraction of Psi_e (just outside the edifice rim)
  MOAT_WIDTH: 0.35,          // moat Gaussian width as a fraction of Psi_e
  // ── §3 province swell (the AC2 correlation workhorse; broad hotspot dome, linear in zeta) ────────────
  SWELL_GAIN: 0.25,          // swell = SWELL_GAIN * zeta  (Hawaiian/Tharsis dynamic-topography dome)
  // ── #4-MULTIPLY edifice grain-alignment (driver-response) ───────────────────────────────────────────
  ELONGATION_GAIN: 0,        // edifice ellipse aspect - 1; DEFAULT 0 = isotropic (1-r)^p dome = #4a byte-identical.
                             //   Raised by magmaDriversToTune with thermal drive (more heat -> more rifting).
  // ── §4 lava-plain flooding (analytic mean-minus-Z*std datum; O(N), NO sort) ─────────────────────────
  FLOOD_Z: 0.25,             // datum = mean_E(H0) - FLOOD_Z*std_E(H0) (lower tail of the quiet terrain)
  WRINKLE_AMP: 0.02,         // faint wrinkle-ridge texture on the flat plain (≪ ordering margins; not zero-mean)
  WRINKLE_FREQ: 6.0,
  // ── §5 substellar magma-ocean basin (F41 iso-angle, T_ss-threaded) ──────────────────────────────────
  LIQUIDUS: 1300,            // F41 MG_LIQUIDUS (K); gate isMagmaOcean = T_ss > LIQUIDUS; theta_sea = acos((LIQUIDUS/T_ss)^4)
  BASIN_DEPTH: 2.0,          // basin floor depth: basinU = MAGMA_BASE - BASIN_DEPTH*g(theta) (deepest at substellar pt)
  RELAX_PASSES,
});

// ── Increment #4-MULTIPLY (volcanic driver-response): the neutral reference point + the driver→tune seam ──
// Mirrors plates.js's D_EARTH / driversToTune discipline EXACTLY. The per-body thermal history (tidal-heat +
// radiogenic/age) reshapes plume COUNT/STRENGTH + edifice ELONGATION via a `tune` override consumed by the
// EXISTING `tune ? { ...MAGMA_DEFAULTS, ...tune } : MAGMA_DEFAULTS` seam in writeMagmatismSphere — no new
// mechanism, only a calibrated re-tune of the placement. The calibration is ANCHORED to MAGMA_REF:
// magmaDriversToTune(MAGMA_REF) returns null, so a neutral volcanic body takes the untouched DEFAULTS branch →
// #4a BYTE-IDENTICAL (AC1). The LAB passes the RAW Io-normalized tidalHeating (huge dynamic range, NOT the
// calibrated [0,1) value), so magmaThermal normalizes internally via clamp01 (mirrors plates' clamp01(th)).
export const MAGMA_REF = Object.freeze({ tidalHeating: 0, age: 4.5, massGravity: 0.9 });

// Normalized endogenic thermal driver H ∈ [0,1]: young + tidally-heated → high, old + cold → low. A caller may
// pass a pre-normalized `thermalState` (the lab's graded-sweep lever); else H derives from the raw D-vector.
export function magmaThermal(drivers) {
  const d = drivers || {};
  if (d.thermalState != null) return clamp01(d.thermalState);
  const tidal = clamp01(d.tidalHeating ?? 0);                       // raw Io-normalized → saturates for hot worlds
  const radiogenic = 1 - clamp01((d.age ?? MAGMA_REF.age) / 10);    // young → high radiogenic drive
  return clamp01(0.5 * tidal + 0.5 * radiogenic);
}
const H_REF = magmaThermal(MAGMA_REF);   // reference thermal drive at which the tune vanishes (≈0.275)

// SLICE-B calibration constants (first-cut, tunable at UAT).
const K_COUNT = 6, K_HEIGHT = 0.6, K_LO = 0.4, K_ELONG = 1.2;

// Map the body's D-vector to a `tune` override, anchored so magmaDriversToTune(MAGMA_REF) === null → the
// writer's `tune ? {...} : DEFAULTS` ternary takes the untouched branch → #4a byte-identical (the #2 discipline).
// Monotone correct-sign: ↑thermal drive → more/taller plumes + more elongation; ↑gravity → flatter shields
// (gFactor, the house reliefGravityFactor convention; gFactor = 1 at the reference gravity → byte-safe).
export function magmaDriversToTune(drivers) {
  if (drivers == null) return null;
  const D = MAGMA_DEFAULTS;
  const H = magmaThermal(drivers);
  const Hd = H - H_REF;                                             // thermal deviation from MAGMA_REF (0 at the reference)
  const g = drivers.massGravity ?? MAGMA_REF.massGravity;
  const gFactor = clamp(0.4, 2.5, Math.pow(g / MAGMA_REF.massGravity, -0.5));   // low-g → taller shields; 1 at g0
  const PLUME_COUNT_MIN = clamp(3, 12, Math.round(D.PLUME_COUNT_MIN + K_COUNT * Hd));
  const EDIFICE_HEIGHT = D.EDIFICE_HEIGHT * (1 + K_HEIGHT * Hd) * gFactor;
  const STRENGTH_LO = clamp(0.2, 0.8, D.STRENGTH_LO + K_LO * Hd);
  const ELONGATION_GAIN = clamp(0, 2, D.ELONGATION_GAIN + K_ELONG * Hd);
  // AC1 identity guard: at MAGMA_REF every computed override equals its DEFAULT → return null so the writer's
  // ternary takes the untouched DEFAULTS branch → byte-identical #4a (exact-only, like plates' D_EARTH).
  if (PLUME_COUNT_MIN === D.PLUME_COUNT_MIN && EDIFICE_HEIGHT === D.EDIFICE_HEIGHT &&
      STRENGTH_LO === D.STRENGTH_LO && ELONGATION_GAIN === D.ELONGATION_GAIN) return null;
  return { PLUME_COUNT_MIN, EDIFICE_HEIGHT, STRENGTH_LO, ELONGATION_GAIN };
}

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
 * @param {{macroSeed?:number, locked?:boolean, T_ss?:number, tune?:object}} opts  macroSeed = the body's
 *                          deterministic integer seed; T_ss = substellar temperature (K) = T_eq*1.4 on
 *                          locked worlds, else 0 (per the shipped F41 convention) — the substellar
 *                          magma-ocean BASIN gates on T_ss > LIQUIDUS (extreme-T), NOT on `locked`
 *                          (both Lava & Magma are locked; only T_ss separates their sea width, AC9);
 *                          locked = accepted for signature parity but does NOT gate the basin; the
 *                          substellarAxis is seed-only this increment (NO star-direction driver-response);
 *                          tune = headless-test override of DEFAULTS.
 * @returns {{U:Float32Array, plumeId:Int32Array, plumeCount:number, hotspotNode:Int32Array,
 *            hotspotProximity:Float32Array, nearestPlume:Int32Array, substellarAxis:number[],
 *            centroids:number[][], meanEdgeAngle:number, relaxPasses:number, edificeMask:Uint8Array,
 *            lavaPlainMask:Uint8Array, magmaOceanMask:Uint8Array, A_e:Float32Array, Psi_e:Float32Array,
 *            thetaSea:number, D_flood:number}}
 */
export function writeMagmatismSphere(carrier, drivers = {}, { macroSeed = 0, locked = false, T_ss = 0, tune = null } = {}) {
  void drivers;   // seed-only this increment (driver-RESPONSE deferred, exactly as plates/shell shipped)
  void locked;    // accepted for parity; the basin gates on T_ss > LIQUIDUS (extreme-T), NOT on `locked`
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
  const wrinkleNoise = createNoise3D(alea('magma:wrinkle:' + seed));   // §4 flat-plain wrinkle-ridge texture
  const substellarAxis = randDir(alea('magma:substellar:' + seed));   // SEED-ONLY axis (no driver-response)

  const plumeCount = T.PLUME_COUNT_MIN + Math.floor(rngCount() * T.PLUME_COUNT_SPAN);
  const centroids = [];
  for (let p = 0; p < plumeCount; p++) centroids.push(randDir(rngCentroid));

  // ── §1 SLICE-B addition 1 — per-plume strength / radius / shield-mix (one new draw, fixed plume-index
  //    order ⇒ deterministic). A_e = peak amplitude (> 0 for every plume), Psi_e = angular edifice radius
  //    (rad), p_exp = shield exponent (broad ↔ steep). Produces Olympus-class-giant-vs-low-patera variety
  //    (AC6) while keeping every shield broad and low-aspect. ──────────────────────────────────────────
  const strengthRng = alea('magma:strength:' + seed);
  const A_e = new Float32Array(plumeCount);     // per-plume peak edifice amplitude ∈ [STRENGTH_LO, 1]·EDIFICE_HEIGHT
  const Psi_e = new Float32Array(plumeCount);   // per-plume angular edifice radius (rad) ∈ [0.10, 0.26]
  const p_exp = new Float32Array(plumeCount);   // per-plume shield exponent ∈ [1.75, 2.5]
  for (let p = 0; p < plumeCount; p++) {
    const s_p = strengthRng(), jit_p = strengthRng(), mix_p = strengthRng();   // 3 draws / plume, index order
    A_e[p] = T.EDIFICE_HEIGHT * (T.STRENGTH_LO + (1 - T.STRENGTH_LO) * s_p);
    Psi_e[p] = T.EDIFICE_RADIUS_MIN + jit_p * T.EDIFICE_RADIUS_SPAN;
    p_exp[p] = mix(T.SHIELD_P_LO, T.SHIELD_P_HI, clamp01(T.SHIELD_MIX_BASE + T.SHIELD_MIX_SPAN * mix_p));
  }

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

  // ── STEP 3b — #4-MULTIPLY per-plume seeded fissure AXIS (grain fabric). A FRESH DISJOINT alea('magma:grain:')
  //    stream ⇒ the existing 'magma:*' streams are byte-unperturbed (AC1). Each plume gets a random major axis
  //    in its own tangent plane; the STEP-6 edifice elongates along it when ELONGATION_GAIN > 0 (isotropic at
  //    the reference). DERIVED here — NOT read from carrier.grainAngle (zero/latitude-binary on the volcanic
  //    path, GROUNDING.md §4). phi is UNIFORM ⇒ the axis distribution is isotropic (no latitude bias → AC3-safe).
  //    grainPerp = top × axis completes the orthonormal tangent basis {axis, perp} (so along²+cross²=1). ──────
  const rngGrain = alea('magma:grain:' + seed);
  const grainAxis = [], grainPerp = [];
  for (let p = 0; p < plumeCount; p++) {
    const top = verts[hotspotNode[p]];
    const ref = Math.abs(top[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];   // avoid pole degeneracy; ref not ∥ top
    const e1 = norm(cross(ref, top));                             // a unit tangent at the plume top
    const e2 = cross(top, e1);                                    // orthonormal unit tangent (top × e1)
    const phi = 2 * Math.PI * rngGrain();
    const cphi = Math.cos(phi), sphi = Math.sin(phi);
    grainAxis.push(norm([cphi * e1[0] + sphi * e2[0], cphi * e1[1] + sphi * e2[1], cphi * e1[2] + sphi * e2[2]]));
    grainPerp.push(cross(top, grainAxis[p]));                     // unit tangent orthonormal to the axis
  }

  // ── STEP 4 — multi-source BFS geodesic distance transform FROM the plume tops → hotspotProximity ───
  // O(N) queue drain (NOT a convergence loop): every node is enqueued exactly once. hotspotProximity =
  // falloffAng(geodesic dist to nearest plume top) ∈ [0,1] (1 AT a hotspot, → 0 far into the province).
  // §1 SLICE-B addition 2 — nearest-plume propagation on the SAME BFS (no new pass): carry the source-
  // plume id exactly as plates.js carries nearStress[nb] = nearStress[c]. Seed in plume-index order so the
  // lowest-index plume wins if two tops share one node (byte-deterministic; the other plume's region
  // inherits a neighbour's nearestPlume — noted in the spec §1).
  const hotspotDist = new Int32Array(N).fill(-1);
  const nearestPlume = new Int32Array(N).fill(-1);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let p = 0; p < plumeCount; p++) {
    const n0 = hotspotNode[p];
    if (hotspotDist[n0] < 0) { hotspotDist[n0] = 0; nearestPlume[n0] = p; q[qt++] = n0; }
  }
  if (qt === 0) { hotspotDist.fill(0); }
  else {
    while (qh < qt) {
      const c = q[qh++];
      const nd = hotspotDist[c] + 1;
      for (const nb of adj[c]) {
        if (hotspotDist[nb] < 0) { hotspotDist[nb] = nd; nearestPlume[nb] = nearestPlume[c]; q[qt++] = nb; }
      }
    }
  }
  const hotspotProximity = new Float32Array(N);   // zeta ∈ [0,1]: 1 AT a plume top → 0 into the province
  for (let i = 0; i < N; i++) hotspotProximity[i] = clamp01(falloffAng(hotspotDist[i] * meanEdgeAngle, T.BELT_RADIANS));

  // ── STEP 5 — §5 substellar magma-ocean BASIN (F41 iso-angle, T_ss-threaded; computed FIRST because it
  //    has precedence over edifice/plain and its mask excludes those populations). Gated on EXTREME-T
  //    (T_ss > LIQUIDUS), NOT on `locked` — both Lava & Magma are locked; only T_ss separates the sea
  //    width (AC9). g(theta) is the normalized superheat built from the F41 dayside irradiation law
  //    T(theta) = T_ss·cos(theta)^(1/4), so basinU is exactly continuous with MAGMA_BASE at the shore. ──
  const isMagmaOcean = (T_ss > T.LIQUIDUS);
  const thetaSea = isMagmaOcean ? Math.acos(clamp01(Math.pow(T.LIQUIDUS / T_ss, 4))) : 0;   // F41 iso-angle
  const magmaOceanMask = new Uint8Array(N);
  const gSuperheat = new Float32Array(N);   // normalized superheat g(theta) ∈ [0,1] inside the sea (0 outside)
  const basinU = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const theta = Math.acos(clamp(-1, 1, dot(verts[i], substellarAxis)));   // angle from the substellar axis
    if (isMagmaOcean && theta < thetaSea) {
      const g = clamp01((T_ss * Math.pow(Math.max(0, Math.cos(theta)), 0.25) - T.LIQUIDUS) / (T_ss - T.LIQUIDUS));
      magmaOceanMask[i] = 1; gSuperheat[i] = g;
      basinU[i] = T.MAGMA_BASE - T.BASIN_DEPTH * g;   // deepest at the substellar point, → MAGMA_BASE at the shore
    }
  }

  // ── STEP 6 — §2 edifice (F7 shield + caldera, VERBATIM) + §2 Walcott moat + §3 province swell → the
  //    PRE-FLOOD field H0. edificeMask is the absolute geodesic crest rule r_i < 1 (order/resolution-
  //    independent), excluded inside the basin. On eligible (non-edifice) nodes edifice=0 (r≥1 ⇒ shield=
  //    caldera=0), so there H0 = MAGMA_BASE + swell + apron + detail. ──────────────────────────────────
  const edificeMask = new Uint8Array(N);
  const H0 = new Float32Array(N);
  const c = T.CALDERA_FRAC;
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    const pStar = nearestPlume[i];
    const psi = hotspotDist[i] * meanEdgeAngle;                 // geodesic distance to the nearest plume top (rad)
    const A = pStar >= 0 ? A_e[pStar] : 0;
    const radius = pStar >= 0 ? Psi_e[pStar] : 1;
    // #4-MULTIPLY grain-aligned edifice: stretch the normalized shield radius along the plume's seeded axis so
    // the (1-r)^p contours become ellipses (semi-major = radius·E, semi-minor = radius ⇒ aspect E), breaking
    // the isotropic circular dome. GUARDED on ELONGATION_GAIN>0 so the reference (default 0) takes the EXACT
    // #4a `psi/radius` branch → byte-identical (AC1 rides the guard, not hypot bit-luck). {axis,perp} are
    // orthonormal in the tangent plane ⇒ along²+cross²=1 ⇒ at E=1 the hypot reduces exactly to psi/radius.
    let r;
    if (T.ELONGATION_GAIN > 0 && pStar >= 0 && psi > 1e-9 && radius > 0) {
      const top = verts[hotspotNode[pStar]];
      const dp = dot(d, top);
      const b = norm([d[0] - dp * top[0], d[1] - dp * top[1], d[2] - dp * top[2]]);   // unit tangent bearing top→node
      const along = dot(b, grainAxis[pStar]);
      const crossComp = dot(b, grainPerp[pStar]);                // named crossComp — `cross` is the vec3 helper
      const E = 1 + T.ELONGATION_GAIN;
      r = Math.hypot((psi * along) / (radius * E), (psi * crossComp) / radius);
    } else {
      r = radius > 0 ? psi / radius : Infinity;                 // normalized shield radius (0 at top, 1 at rim) — #4a path
    }
    // §2 F7 edificeProfile transcribed VERBATIM (planet-lod-height.glsl.js:2218-2230):
    //   shield(r)  = (r<1) ? pow(1-r, p) : 0                    // convex dome, slope 0 at the rim
    //   caldera(r) = (r<c) ? 0.5*((r/c)^2 - 1) : 0             // summit bowl: -0.5 at r=0 → 0 at r=c
    let edifice = 0;
    if (r < 1) {
      const p = pStar >= 0 ? p_exp[pStar] : 2;
      let shape = Math.pow(1 - r, p);                           // shield body
      if (r < c) { const s = r / c; shape += 0.5 * (s * s - 1); }   // summit caldera bowl
      edifice = A * shape;
    }
    // §2 Walcott (1970) flexural moat — SURROUND-ONLY (r ≥ 1) so it never perturbs the edifice population
    // mean (keeps the ordering proof clean); a shallow negative Gaussian ring just outside the rim.
    let apron = 0;
    if (r >= 1 && pStar >= 0) {
      const z = (psi - radius * T.MOAT_CTR) / (radius * T.MOAT_WIDTH);
      apron = -T.MOAT_DEPTH * A * Math.exp(-z * z);
    }
    // §3 province swell — broad hotspot dome, linear in plume proximity (the AC2 correlation workhorse).
    const swell = T.SWELL_GAIN * hotspotProximity[i];
    const detail = T.DETAIL_AMP * detailNoise(d[0] * T.DETAIL_FREQ, d[1] * T.DETAIL_FREQ, d[2] * T.DETAIL_FREQ);
    // absolute geodesic crest rule (NOT a relative local-max), basin excluded (basin precedence):
    edificeMask[i] = (!magmaOceanMask[i] && r < 1) ? 1 : 0;
    H0[i] = T.MAGMA_BASE + swell + edifice + apron + detail;   // PRE-FLOOD field
  }

  // ── STEP 7 — §4 lava-plain flooding (effusive fill-to-datum; F8 flood-and-flatten analog). The flood
  //    datum is analytic mean-minus-Z*std over the ELIGIBLE (non-edifice, non-basin) set — an O(N)
  //    reduction, NO sort. The lows pond to one flat dark plain; swelled provinces + shields stand above. ─
  let sum = 0, cnt = 0;
  for (let i = 0; i < N; i++) { if (!edificeMask[i] && !magmaOceanMask[i]) { sum += H0[i]; cnt++; } }
  const mu0 = cnt ? sum / cnt : 0;
  let sq = 0;
  for (let i = 0; i < N; i++) { if (!edificeMask[i] && !magmaOceanMask[i]) { const dv = H0[i] - mu0; sq += dv * dv; } }
  const sigma0 = cnt ? Math.sqrt(sq / cnt) : 0;
  const D_flood = mu0 - T.FLOOD_Z * sigma0;                    // datum in the lower tail of the quiet terrain
  const lavaPlainMask = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!edificeMask[i] && !magmaOceanMask[i] && H0[i] < D_flood) lavaPlainMask[i] = 1;
  }

  // ── STEP 8 — assemble U (disjoint precedence basin > edifice > plain > quiet; REPLACE-write) with a
  //    pre-relax safety clamp (AC1 guard; never fires in production — production passes no `tune`). ──────
  const U = new Float32Array(N);
  const guard = MAGMA_BOUND - 1e-3;   // AC1 safety clamp bound (never fires in production)
  for (let i = 0; i < N; i++) {
    const d = verts[i];
    let uRaw;
    if (magmaOceanMask[i]) uRaw = basinU[i];                                    // drowned molten hemisphere
    else if (lavaPlainMask[i]) uRaw = D_flood + T.WRINKLE_AMP * wrinkleNoise(d[0] * T.WRINKLE_FREQ, d[1] * T.WRINKLE_FREQ, d[2] * T.WRINKLE_FREQ);
    else uRaw = H0[i];                                                          // edifice (swell+shield+caldera) OR quiet province
    U[i] = clamp(-guard, guard, uRaw);
  }
  carrier.height.set(U);   // REPLACE (sole low/mid source for a volcanic body — no additive re-banding)

  // ── bounded gen-time relaxation (render-once): fixed RELAX_PASSES Jacobi smooth over carrier.adj ────
  // Same h*0.5 + mean(self+neighbours)*0.5 weighting as tectonic.js / plates / shell. A convex
  // combination of in-bound values — it cannot invert the well-separated population means or expand the
  // bound. Double-buffered.
  const buf = new Float32Array(N);
  for (let pass = 0; pass < PASSES; pass++) {
    for (let i = 0; i < N; i++) {
      let s = U[i], k = 1;
      const nb = adj[i];
      for (let j = 0; j < nb.length; j++) { s += U[nb[j]]; k++; }
      buf[i] = U[i] * 0.5 + (s / k) * 0.5;
    }
    U.set(buf);
  }
  carrier.height.set(U);
  // parity bookkeeping with the plate/shell writers (activity proxy = plume proximity)
  for (let i = 0; i < N; i++) carrier.faultDensity[i] = clamp01(hotspotProximity[i]);

  return {
    U, plumeId, plumeCount, hotspotNode, hotspotProximity, nearestPlume, substellarAxis,
    centroids, meanEdgeAngle, relaxPasses: PASSES,
    edificeMask, lavaPlainMask, magmaOceanMask, A_e, Psi_e, thetaSea, D_flood,
    // #4-MULTIPLY grain fabric: per-plume seeded major axes + the applied edifice aspect ratio E (1 at the
    // reference). The probe/tests measure edifice-footprint aspect against grainAxis for AC3.
    grainAxis, elongation: 1 + T.ELONGATION_GAIN,
  };
}
