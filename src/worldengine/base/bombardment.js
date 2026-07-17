// src/worldengine/base/bombardment.js
// World Engine V2-5 — EXOGENIC bombardment (crater-population host channel; BUILD-PLAN §2/§3, calibration §7).
//
// THREE-FREE, PURE, RESURFACING-BLIND. Reads ONLY condition-vector SCALARS (surfaceGravity, age, atmosphere,
// T_eq, rawTidalIoRatio) + the finished carrier.verts/adj + its own alea('bombard:'+seed) stream. Writes ONLY
// the unhashed signed Float32Array `craterField` — never carrier.height nor any HASHED_FIELD (own-channel
// discipline; byte-inert against the 75-golden). It reads NO geodynamic tuple, NO regime, NO composition
// class, NO archetype/label, and imports NO derived-dispatch module — so the shadow-audit's blind-writer scan
// passes by construction (growth-by-enumeration, exactly as V2-4's province/margins/figure modules did). It
// gates target-vs-not the passiveMargins way — a condition-scalar DATA predicate (isImpactSurface), never a
// regime read (LANDMINE #4).
//
// WHAT IT MODELS (plain language): the pockmarked surface of an airless, geologically DEAD, cold world — the
// Moon / Mercury / Frozen look. On such bodies nothing (atmosphere, tides, volcanism) erases impacts, so an
// entire history of bombardment accumulates: a size-frequency power law (a few giant basins over a battered
// small-crater texture), each crater a depression (bowl) with a raised rim and a low ejecta apron. The channel
// is a signed per-node displacement in the SAME normalized-height units as carrier.height: negative in a bowl,
// positive on rim/ejecta, zero on un-cratered ground and on every non-target body. route() composites it at
// render (V2-5 slice-2) so the crater relief reshades; carrier.height is never touched. The channel is the
// PERSISTENT HOST the #6 epoch editor (floor-fractured craters; mare flooding) will later edit in place —
// the editor-on-host contract shelfDepth proved.
//
// DELIBERATE NON-GOALS (this increment): no per-basin craterId map (the thresholdable signed displacement is
// sufficient to de-risk the #6 editor); ejecta rides as displacement-shaded brightness (no dedicated albedo
// attribute — that would touch the atmo-shared geometry, out of fence); atmospheric shielding deferred (Max
// Q5 — targets are airless); crater-vs-volcano visual distinctness is NOT a criterion (Max Q4 — volcano
// legibility is V2-7/V2-8). Legacy F2/F3 in-shader crater synth is untouched (LANDMINE #5).
//
// BAKED CONSTANTS: crater-{scale,powerlaw,drivers,gate}.mjs output, 2026-07-17 (all "ALL PASS" — committed
// evidence under docs/WORKSTREAMS/world-engine-v2-5-bombardment-2026-07-17/calibration/). The vitest suite
// (tests/worldengine-v2-5-bombardment.test.js) re-measures this writer's own output back to those numbers, so
// calibration and writer cannot drift.

import { clamp } from './mathutil.js';
import alea from 'alea';

// ── HORIZONTAL size band (geodesic radians, resolution-independent) — crater-scale.mjs ──────────────
export const D_MIN_RAD = 0.05;       // ~2.9° — small end (~3 nodes @ lab N ⇒ peppered texture)
export const D_MAX_RAD = 0.50;       // ~28.6° — giant basins (~26 nodes @ lab N; D_MAX/meanEdgeAngle=25.8 ≥10)
// ── VERTICAL amplitude (normalized-height, same scale as carrier.height) — crater-scale.mjs ─────────
export const CRATER_DEPTH_N = 0.18;  // A(D_REF): bowl amplitude of a D_REF crater (≈0.81× the despun p95−p5 span 0.2215)
export const D_REF_RAD = 0.50;       // reference angular diameter (= D_MAX ⇒ A(D_MAX)=CRATER_DEPTH_N)
export const DEPTH_POW = 0.5;        // sub-linear depth↑ with size (real d/D flattening; ∈[0,1])
export const MIN_BASIN_DEPTH_N = 0.08; // legibility floor: A(D_MAX) ≥ this (giant basins are visible bowls — M-m3)
// ── dimensionless profile-SHAPE constants — crater-scale.mjs ────────────────────────────────────────
const FLOOR_FRAC = 0.5;              // flat floor out to FLOOR_FRAC·(D/2) from centre
const RIM_HEIGHT_FRAC = 0.20;        // rim crest at +RIM_HEIGHT_FRAC·A (physical rim/depth ≈ 0.2 — see NOTE-RIM)
const EJECTA_FRAC = 0.05;            // ejecta-apron lift at +EJECTA_FRAC·A, decaying to 0
const RIM_W = 0.1;                   // rim zone width = RIM_W·D beyond the crest
const RIM_FRAC = 1.0;                // ejecta-apron outer edge = RIM_FRAC·D beyond the crest ⇒ stampR = D/2 + RIM_FRAC·D
// NOTE-RIM (deviation from the plan's literal "RIM_HEIGHT_FRAC ≈ 0.04", recorded in BUILD-PLAN §10): a rim at
// 4% of the bowl depth is visually inert. Real fresh craters: rim height ≈ 0.04·D over depth ≈ 0.2·D ⇒
// rim/depth ≈ 0.2. A is the (normalized-height) BOWL depth, so the faithful + legible fraction is 0.20.
// ── bounded superposition (M-m4) — crater-drivers.mjs ───────────────────────────────────────────────
const CRATER_SAT_N = 0.5;            // soft tanh saturation: caps the deepest overlaps to ±this (empirical
                                     // crater-saturation roughness plateau; ≈2.3× the despun span), preserving
                                     // sign + node ordering (so the #6 editor can still threshold floors).
// ── power-law size-frequency — crater-powerlaw.mjs ──────────────────────────────────────────────────
export const B_SFD = 2.0;            // cumulative exponent (band [1.8,2.2]); differential dN/dlogD slope = −B_SFD
const RATIO_POW = Math.pow(D_MIN_RAD / D_MAX_RAD, B_SFD);   // bounded-Pareto inverse-CDF constant
// ── MULTIPLY scheduling (continuous, neutral mid-body reference) — crater-drivers.mjs ───────────────
export const N_CRATERS_REF = 1800;   // count at the neutral reference
export const G_REF = 0.5;            // neutral gravity (between Moon 0.165 g and Earth 1.0 g)
export const AGE_REF = 4.0;          // neutral surface age (Gyr)
export const K_AGE = 0.5;            // older → more craters (√ exposure accumulation)
export const K_GD = 0.7;             // lower gravity → more craters (weaker relaxation/retention)
export const K_GS = 0.17;            // lower gravity → larger craters (physical gravity-regime scaling D ∝ g^−0.17)
// ── self-gate thresholds (condition scalars ONLY) — crater-gate.mjs ─────────────────────────────────
export const CRATER_ATMO_MAX = 0.05; // bar — airless-or-thin
export const CRATER_TIDAL_MAX = 0.15; // rawTidalIoRatio — dead (no tidal resurfacing)
export const CRATER_T_MAX = 450;     // K — cold enough to be a solid cratered lithosphere (not molten)

// isImpactSurface(condition) — the label-free, regime-blind self-gate (§3). Fires on airless/thin + dead +
// cold worlds (Frozen, Crystal, Mars, Moon/Mercury). Reads ONLY condition-vector scalars.
export function isImpactSurface(condition) {
  if (!condition) return false;
  const atmo = condition.atmosphere;
  const airless = !atmo || (atmo.pressure ?? 0) < CRATER_ATMO_MAX;
  const dead = (condition.rawTidalIoRatio ?? 0) < CRATER_TIDAL_MAX;
  const cold = (condition.T_eq ?? 288) < CRATER_T_MAX;
  return airless && dead && cold;
}

// craterSchedule(condition) — the MULTIPLY-scheduled population: continuous functions of gravity + age, = 1
// (neutral) at (G_REF, AGE_REF). AC-MULTIPLY reads these directly (direct-writer-metric, route-independent).
export function craterSchedule(condition) {
  if (!isImpactSurface(condition)) return { fired: false, nCraters: 0, sizeMul: 1 };
  const g = Math.max(1e-6, condition.surfaceGravity ?? G_REF);
  const age = Math.max(0, condition.age ?? AGE_REF);
  const nCraters = Math.round(N_CRATERS_REF * Math.pow(age / AGE_REF, K_AGE) * Math.pow(G_REF / g, K_GD));
  const sizeMul = Math.pow(G_REF / g, K_GS);
  return { fired: true, nCraters, sizeMul };
}

// drawPowerLaw(rng) — bounded-Pareto inverse-CDF: N(>D) ∝ D^(−B_SFD) on [D_MIN_RAD, D_MAX_RAD] (§2b).
export function drawPowerLaw(rng) {
  return D_MIN_RAD * Math.pow(1 - rng() * (1 - RATIO_POW), -1 / B_SFD);
}

// craterAmplitude(D) — vertical bowl amplitude (normalized-height) of a crater of angular diameter D (radians).
export function craterAmplitude(D) { return CRATER_DEPTH_N * Math.pow(D / D_REF_RAD, DEPTH_POW); }

// craterProfile(s, D) — radial displacement (normalized-height) at geodesic angle s (radians) from the crater
// centre. Continuous + TWO-SIGNED per crater: flat floor (−A) → inner wall ramping −A through 0 up to the crest
// (+rimH) → outer rim decaying crest→ejecta → ejecta apron decaying →0. Horizontal (s/D) is radians; vertical
// (amplitude) is normalized-height — different units, never conflated (M-m3).
export function craterProfile(s, D) {
  const A = craterAmplitude(D);
  const r = 0.5 * D;                     // rim-crest radius (angular)
  const floorEdge = FLOOR_FRAC * r;      // end of the flat floor
  const rimH = RIM_HEIGHT_FRAC * A;      // rim crest height above datum
  const ejH = EJECTA_FRAC * A;           // ejecta-apron height above datum
  const rimEnd = r + RIM_W * D;          // outer edge of the rim zone
  const ejEnd = r + RIM_FRAC * D;        // outer edge of the ejecta apron (= stamp radius)
  if (s < floorEdge) return -A;                                              // flat floor
  if (s < r) { const t = (s - floorEdge) / (r - floorEdge); return -A + t * (A + rimH); }  // inner wall −A → +rimH
  if (s < rimEnd) { const t = (s - r) / (rimEnd - r); return rimH + t * (ejH - rimH); }     // outer rim crest → ejecta
  if (s < ejEnd) { const t = (s - rimEnd) / (ejEnd - rimEnd); return ejH * (1 - t); }        // ejecta apron → 0
  return 0;
}
export const craterStampRadius = (D) => 0.5 * D + RIM_FRAC * D;

// forEachCrater(condition, macroSeed, N, cb) — the single entropy source + fixed per-crater draw order (center
// pick → diameter draw), factored so the tests can reproduce the writer's EXACT population. Returns the
// schedule. cb(centreNode, D) is invoked once per crater. The center draw consumes one rng value regardless of
// N, so the DIAMETER stream is N-independent (AC-POWERLAW can call with any N and get the writer's diameters).
export function forEachCrater(condition, macroSeed, N, cb) {
  const sched = craterSchedule(condition);
  if (!sched.fired) return sched;
  const rng = alea('bombard:' + (macroSeed | 0));   // prefix-disjoint from every existing namespace
  const { nCraters, sizeMul } = sched;
  for (let c = 0; c < nCraters; c++) {
    const centre = Math.floor(rng() * N);            // uniform node pick — resolution-independent placement
    const D = drawPowerLaw(rng) * sizeMul;           // power-law diameter × the gravity size-multiplier
    cb(centre, D);
  }
  return sched;
}

// writeBombardment(carrier, condition, { macroSeed }) — the production writer. Writes carrier.craterField
// (unhashed). Idempotent (fills 0 first ⇒ all-zero on non-targets + on re-run). No-op on the flat-grid twin
// (guards on verts/adj — the passiveMargins precedent). carrier.height is NEVER touched.
export function writeBombardment(carrier, condition, { macroSeed = 0 } = {}) {
  const cf = carrier.craterField;
  cf.fill(0);
  if (!carrier.verts || !carrier.adj) return carrier;   // sphere-only (flat-grid twin: allocated, never written)
  if (!isImpactSurface(condition)) return carrier;       // self-gate: non-target ⇒ field stays all-zero

  const { verts, adj } = carrier;
  const N = verts.length;
  // bounded multi-source-free BFS stamp per crater (the plates.js:317-334 / passiveMargins queue-drain idiom;
  // O(craters × affected-nodes), NEVER while-to-convergence). `seen` is epoch-tagged so it is reused per crater
  // without an O(N) clear. Craters SUPERPOSE (+=): younger overprints older ⇒ a battered surface.
  const seen = new Int32Array(N);
  const queue = new Int32Array(N);
  let epoch = 0;
  forEachCrater(condition, macroSeed, N, (centre, D) => {
    const R = craterStampRadius(D);
    const cvx = verts[centre][0], cvy = verts[centre][1], cvz = verts[centre][2];
    epoch++;
    let qh = 0, qt = 0;
    queue[qt++] = centre; seen[centre] = epoch;
    while (qh < qt) {
      const j = queue[qh++];
      const vj = verts[j];
      const dot = clamp(-1, 1, cvx * vj[0] + cvy * vj[1] + cvz * vj[2]);
      const s = Math.acos(dot);                 // geodesic angle centre→j
      if (s > R) continue;                       // outside the ejecta-apron edge — stop the flood here
      cf[j] += craterProfile(s, D);
      const nb = adj[j];
      for (let k = 0; k < nb.length; k++) { const m = nb[k]; if (seen[m] !== epoch) { seen[m] = epoch; queue[qt++] = m; } }
    }
  });

  // bounded superposition (M-m4): soft-saturate the accumulated field so dense overlaps at the low-g/high-age
  // corner plateau at ±CRATER_SAT_N instead of churning to unreadable depths — legible at any slider position.
  for (let i = 0; i < N; i++) cf[i] = CRATER_SAT_N * Math.tanh(cf[i] / CRATER_SAT_N);
  return carrier;
}
