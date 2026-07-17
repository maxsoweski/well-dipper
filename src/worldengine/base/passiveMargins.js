// src/worldengine/base/passiveMargins.js
// World Engine V2-4 slice-3 — PASSIVE continental margins (BUILD-PLAN §3, calibration §6.1).
//
// THREE-FREE, RNG-FREE, PURE. Writes ONLY the unhashed `shelfDepth` host channel — never carrier.height
// (own-channel discipline, designDecision #MARGINS). It is byte-inert against the 75-golden HASHED_FIELDS
// (it touches none of height/grainAngle/grainMag/regime/faultDensity) and draws NO alea stream — the
// along-coast character is a bounded, smooth, deterministic DERIVATION from the vertex direction (the
// 'margin:'+seed namespace is RESERVED but not consumed; BUILD-PLAN §0 "prefer derivation").
//
// WHAT IT MODELS (plain language): a PASSIVE margin is a continent/ocean transition that is NOT an active
// plate-motion boundary (no meaningful convergent/divergent/transform stress). Seaward of such a shoreline
// it writes the classic four-zone bathymetric morphology — SHELF (shallow near-flat apron) → shelf-BREAK
// (the steepening inflection) → continental SLOPE (steep descent) → continental RISE (gentle abyssal apron)
// — as a positive lift added (in route()'s composite) to the flat oceanic base, so the coastline reads as
// a graded continental margin instead of a binary continent/ocean step. ACTIVE margins (subduction/rift)
// keep their existing plates.js convergent/divergent relief untouched — this writer fires ONLY at passive
// transitions and only on the oceanic (seaward) side.
//
// SELECTION (folds lens B-m1 — names the REAL inputs; NO plates.js edit): the plate diag exports
// plateType (per-plate continental/oceanic), plateId (per-node), boundaryStress (signed, nonzero ONLY at
// boundary nodes) and meanEdgeAngle. `nearStress` (the belt magnitude) is a plates.js module-LOCAL, NOT in
// the diag — so this writer RECONSTRUCTS belt stress itself via a bounded multi-source BFS from the
// boundary set (the plates.js:317-334 nearest-boundary idiom, O(N) queue drain, not convergence). A
// continent/ocean transition is PASSIVE when |boundaryStress| at the transition node is below
// PASSIVE_STRESS_MAX; an oceanic node is left to plates.js (no shelf) when an ACTIVE boundary's belt reaches
// it (reconstructed beltStress ≥ PASSIVE_STRESS_MAX).
//
// SCALE (calibration/margin-scale.mjs, BUILD-PLAN §6.1 — committed evidence, not hand-waves): the v1
// physical anchors (shelf ~0.5°, break ~140 m, slope ~3°, rise ~500 km) map to GEODESIC radians (angular,
// resolution-independent like plates.js BELT_RADIANS) and to NORMALIZED fractions of the continent/ocean
// step (BASE_CONT−BASE_OCEAN = 0.26 ≙ ~4500 m relief). The vertical amplitude MARGIN_LIFT_N is anchored to
// the LIVE plate-world sea level (mean 0.2127 at target-ocean-fraction 0.35) so the shelf top sits just
// below the coastal datum. NOTE (resolution reality, documented in SUBSTRATE-MAP): the shelf/break/slope
// zones are sub-node even on the ~40k lab mesh (meanEdgeAngle ~1° > shelf 0.5°); the four-zone morphology
// lives in the mesh-INDEPENDENT profile function `marginProfileFrac` and the SAMPLED channel reads as a
// monotone coast→abyss apron dominated by the (wide) rise. This is the intended resolution-independent
// design — the same "sample a smooth angular profile at whatever nodes exist" trick plates.js uses.

import { clamp } from './mathutil.js';
import { DEFAULTS } from './plates.js';   // read-only: BASE_OCEAN/BASE_CONT (the step) + BELT_RADIANS (stress-spread scale)

// ── BAKED SCALE CONSTANTS (margin-scale.mjs output, 2026-07-14) ──────────────────────────────────
export const STEP_N = DEFAULTS.BASE_CONT - DEFAULTS.BASE_OCEAN;   // 0.26 — normalized continent/ocean step
export const MARGIN_LIFT_N = 0.1127;      // shelf-top lift above the abyssal base (= liveSeaLevel−BASE_OCEAN)
export const SHELF_W_RAD = 0.008727;      // 0.5° shelf width (geodesic)
export const SLOPE_W_RAD = 0.010063;      // 0.577° slope width (descend 3360 m at 3°)
export const RISE_W_RAD  = 0.078481;      // 4.497° rise width (500 km)
export const BREAK_DROP  = 0.03111;       // profile fraction lost across the (near-flat) shelf (140 m / 4500 m)
export const RISE_TOP    = 0.22222;       // profile fraction remaining at the top of the rise (1000 m / 4500 m)
export const PASSIVE_STRESS_MAX = 0.15;   // |boundaryStress| below this ⇒ the transition/belt is passive
export const PASSIVE_BELT_RAD = DEFAULTS.BELT_RADIANS;   // 0.058 — geodesic falloff scale for beltStress spread

// shelfWidthFactor(volatileFraction) driver axis: wetter ⇒ wider/more-sedimented shelves (monotone),
// anchored to 1.0 at Earth's volatile fraction (D_EARTH.volatileFraction = 0.15). ISOLATED transfer
// function (lens B-m3): AC-MARGIN(c) reads monotonicity off THIS law directly, partition/seed held fixed,
// so the repartition confound (vf also drives CONTINENTAL_FRACTION in plates.js) is excluded.
export const MARGIN_VF0 = 0.15, MARGIN_WIDEN_K = 2.5, MARGIN_WF_LO = 0.3, MARGIN_WF_HI = 3.0;
export function shelfWidthFactor(volatileFraction) {
  const vf = (volatileFraction == null) ? MARGIN_VF0 : volatileFraction;
  return clamp(MARGIN_WF_LO, MARGIN_WF_HI, 1 + MARGIN_WIDEN_K * (vf - MARGIN_VF0));
}

// marginProfileFrac(s, shelfW) — the PURE, mesh-independent shelf→break→slope→rise profile as a function
// of geodesic distance `s` (radians) seaward of the shoreline. Returns a lift FRACTION in [0,1]: 1 at the
// coast (shallowest), 0 at/beyond the rise foot (abyssal). Monotone DECREASING throughout, with three
// distinct gradients — gentle SHELF, steep SLOPE, gentle RISE — the shelf-BREAK being the gradient
// discontinuity between the shelf and slope zones. `shelfW` is the (driver-scaled) shelf width.
export function marginProfileFrac(s, shelfW) {
  const slopeStart = shelfW;
  const slopeEnd = shelfW + SLOPE_W_RAD;
  const totalW = slopeEnd + RISE_W_RAD;
  if (s <= 0) return 1;
  if (s >= totalW) return 0;
  const pShelfEnd = 1 - BREAK_DROP;   // profile at the shelf break (~0.969)
  const pSlopeEnd = RISE_TOP;         // profile at the top of the rise (~0.222)
  if (s < slopeStart) {
    return 1 - BREAK_DROP * (s / shelfW);                              // SHELF — gentle 1 → 0.969
  } else if (s < slopeEnd) {
    return pShelfEnd + (pSlopeEnd - pShelfEnd) * ((s - slopeStart) / SLOPE_W_RAD);  // SLOPE — steep 0.969 → 0.222
  }
  return pSlopeEnd * (1 - (s - slopeEnd) / RISE_W_RAD);               // RISE — gentle 0.222 → 0
}

// marginTotalWidth(volatileFraction) — the driver-scaled total belt width (radians).
export function marginTotalWidth(volatileFraction) {
  return SHELF_W_RAD * shelfWidthFactor(volatileFraction) + SLOPE_W_RAD + RISE_W_RAD;
}

// Bounded, smooth, deterministic along-coast character (the AC-MARGIN(c) "noise floor"): a low-frequency
// function of the vertex direction, seed-phased. RNG-FREE (no alea) — spatially coherent (adjacent nodes
// get similar values, not per-node speckle). Bounded to 1 ± JITTER_AMP.
const JITTER_AMP = 0.06, JITTER_FREQ = 3.0;
function jitterMul(v, seed) {
  const phase = 0.6180339887 * ((seed | 0) % 997);
  return 1 + JITTER_AMP * Math.sin(JITTER_FREQ * (v[0] + 1.7 * v[1] - 1.3 * v[2]) + phase);
}

// writePassiveMargins(carrier, plateDiag, drivers, { macroSeed })
// Writes carrier.shelfDepth (unhashed) with the passive-margin four-zone profile; zero everywhere else.
// Idempotent (fills shelfDepth to 0 first). No-op (all-zero shelfDepth) when plateDiag is null (non-plate
// paths) or the world has no passive continent/ocean transitions. carrier.height is NEVER touched.
export function writePassiveMargins(carrier, plateDiag, drivers = null, { macroSeed = 0 } = {}) {
  const { N, adj, verts, shelfDepth } = carrier;
  shelfDepth.fill(0);
  if (!plateDiag) return carrier;
  const { plateId, plateType, boundaryStress, meanEdgeAngle } = plateDiag;
  if (!plateId || !plateType || !boundaryStress || !meanEdgeAngle) return carrier;

  // driver axis: volatiles → shelf width (isolated transfer function; lens B-m3)
  const vf = drivers?.condition?.composition?.volatileFraction;
  const shelfW = SHELF_W_RAD * shelfWidthFactor(vf);
  const totalW = shelfW + SLOPE_W_RAD + RISE_W_RAD;

  // continentality per node: plateType is per-PLATE (1 continental / 0 oceanic)
  const cont = new Uint8Array(N);
  for (let i = 0; i < N; i++) cont[i] = plateType[plateId[i]];

  // beltStress reconstruction — multi-source BFS from the boundary set (boundaryStress != 0), propagating
  // |boundaryStress| with a hop-count falloff (the plates.js:317-334 idiom, O(N) queue drain). Used to
  // reject oceanic nodes that sit inside an ACTIVE boundary's belt (they keep plates.js relief, no shelf).
  const nearMag = new Float32Array(N);
  const distB = new Int32Array(N).fill(-1);
  const qb = new Int32Array(N); let qbh = 0, qbt = 0;
  for (let i = 0; i < N; i++) {
    if (boundaryStress[i] !== 0) { distB[i] = 0; nearMag[i] = Math.abs(boundaryStress[i]); qb[qbt++] = i; }
  }
  while (qbh < qbt) {
    const c = qb[qbh++];
    for (const nb of adj[c]) if (distB[nb] < 0) { distB[nb] = distB[c] + 1; nearMag[nb] = nearMag[c]; qb[qbt++] = nb; }
  }
  const beltStressAt = (i) => (distB[i] < 0 ? 0 : nearMag[i] * Math.exp(-(distB[i] * meanEdgeAngle) / PASSIVE_BELT_RAD));

  // PASSIVE transition seed set: a continent/ocean edge whose boundary segment is low-stress (not active).
  const passiveSeed = [];
  for (let i = 0; i < N; i++) {
    let isTransition = false;
    const nb = adj[i];
    for (let k = 0; k < nb.length; k++) if (cont[nb[k]] !== cont[i]) { isTransition = true; break; }
    if (isTransition && Math.abs(boundaryStress[i]) < PASSIVE_STRESS_MAX) passiveSeed.push(i);
  }
  if (passiveSeed.length === 0) return carrier;

  // geodesic distance s to the nearest PASSIVE shoreline — multi-source BFS from the passive seed set.
  const distP = new Int32Array(N).fill(-1);
  const qp = new Int32Array(N); let qph = 0, qpt = 0;
  for (let k = 0; k < passiveSeed.length; k++) { distP[passiveSeed[k]] = 0; qp[qpt++] = passiveSeed[k]; }
  while (qph < qpt) {
    const c = qp[qph++];
    for (const nb of adj[c]) if (distP[nb] < 0) { distP[nb] = distP[c] + 1; qp[qpt++] = nb; }
  }

  // write the seaward (oceanic) shelf→break→slope→rise profile within the passive belt
  for (let i = 0; i < N; i++) {
    if (cont[i] !== 0) continue;                            // continental side: no seaward shelf
    if (distP[i] < 0) continue;                             // not reachable from a passive coastline
    const s = distP[i] * meanEdgeAngle;                     // geodesic distance from the passive shoreline
    if (s >= totalW) continue;                              // beyond the rise foot
    if (beltStressAt(i) >= PASSIVE_STRESS_MAX) continue;    // inside an ACTIVE belt — leave plates.js relief
    shelfDepth[i] = MARGIN_LIFT_N * marginProfileFrac(s, shelfW) * jitterMul(verts[i], macroSeed);
  }
  return carrier;
}
