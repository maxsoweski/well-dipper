// calibration/bake-attenuation.mjs — Inc-3b S0.5 + S0.5a
// ============================================================================
// DELIVERABLE (BUILD-PLAN §1.S0 blocks S0.5 + S0.5a; brief R6 / R8):
//   1. Model the 256²/face cube-map bake sampling 1-edge crater walls, in
//      MEASURED edge units (1.11°, NOT the naive 0.573°) — brief R6.
//   2. Derive θ_floor: the smallest post-bake wall angular subtense the
//      256²/face cube + posterize chain can carry at ≥1 posterize band.
//      Exported — S3's content-vs-instrument inequality (BUILD-PLAN §1.S3.a /
//      lens-log MF-3) depends on it.
//   3. Sub-texel phase: a ~1.11° wall resampled at 256²/face has sub-texel
//      phase → per-stamp realized attenuation is a DISTRIBUTION. Compute
//      mean + spread; set the ≥1-band MAGNITUDE threshold on the CONSERVATIVE
//      TAIL (not the mean). Frozen pre-capture.
//   4. S0.5a split (MANDATORY): the ≥1-band magnitude is the ONLY
//      model-derived number in the arc bar. The ≥70% population fraction and
//      the ≥-median size gate are ACCEPTANCE CONVENTIONS — each carries an
//      explicit statistical justification OR a GUESSED tag + resolution path.
//   5. Spec (exported object + comments): the RNG-neutral centre-export probe
//      (writer records centres/depths with ZERO RNG draws, no reordering) and
//      the darkClipFrac/shadowFrac re-baseline-after-flip protocol (brief R8).
//   6. Export { thetaFloorDeg, bandThreshold, attenuation distribution stats,
//      measuredEdgeDeg } and write bake-attenuation-model.json (deterministic).
//
// HARD CONSTRAINTS honored:
//   - NO TASTE CONSTANTS: every numeric constant below carries an inline
//     derivation comment + anchor, OR is explicitly tagged GUESSED with a
//     written resolution path.
//   - Pure node ESM, runnable from any cwd, single-threaded, NO network, NO
//     RNG in any output (the sub-texel phase is swept on a FIXED grid), NO
//     timestamps / wall-clock in any written field. Re-runs reproduce EXACTLY.
//
// ANCHORS (grep-verified this session at HEAD 4269689 in planet-lod-lab.html):
//   - posterize band count `levels` = 6           → :1996  `levels: 6`
//                                                  → :5597  `uniforms.uLevels.value = state.levels`
//   - posterize fn (dither+quantize):              → :1792-1796
//       `dithered = color + dither*edgeWidth/levels; floor(dithered*levels+0.5)/levels`
//       (edgeWidth = 0.4; a band step in luminance = 1/levels)
//   - Lambert shading chain:                       → :590 `float diff = max(dot(shadeN, uLightDir), 0.0)`
//                                                  → :827 `surface = posterize(litSurf, uLevels, fc, 0.4, uDitherMode)`
//   - staged oblique light (S0-pinned incidence):  → :2006 lightAzimuthDeg 40.6
//                                                  → :2007 lightElevationDeg 20.79  (incidence from vertical = 90−20.79 = 69.21°)
// ============================================================================

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Import depth mirrors the predecessor population-sweep.mjs (../../../../ from
// the calibration dir) — the repo root is four levels up.
import { craterSchedule, isImpactSurface } from '../../../../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// (A) BAKE / DISPLAY-CHAIN CONSTANTS — all grep-anchored above, none tastes.
// ============================================================================

// Posterize band count actually in use (NOT guessed — grepped :1996 / :5597).
// A single posterize band spans 1/LEVELS in luminance (fn :1792-1796:
// floor(x*levels+0.5)/levels ⇒ adjacent output steps are 1/levels apart).
const LEVELS = 6;                       // planet-lod-lab.html:1996 `levels: 6`
const BAND_LUM = 1 / LEVELS;            // = 0.166667 luminance per posterize band

// Cube-map bake resolution (brief R6: "256²/face cube").
const FACE_TEXELS = 256;                // texels per cube-map face edge

// Staged oblique-light incidence (from vertical), from the lab light defaults.
// incidence = 90° − elevation = 90 − 20.79 = 69.21°  (planet-lod-lab.html:2007)
const LIGHT_ELEV_DEG = 20.79;           // planet-lod-lab.html:2007 lightElevationDeg
const INCIDENCE_DEG = 90 - LIGHT_ELEV_DEG;   // 69.21°

const DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// (A.1) The "2/√N vs measured-edge" inconsistency (brief R6) — DOCUMENTED.
// ---------------------------------------------------------------------------
// NAIVE edge (the number R6 says NOT to use, "2/√N ≈ 0.573°"):
//   Treats the WHOLE sphere texel budget N_total = 6·256² as if √N_total texels
//   lay on a single great circle, so the per-texel angular edge = full-circle /
//   √N_total = 2π / √(6·256²) rad. (R6 writes "2/√N"; the "2" is 2π written
//   loosely — the arithmetic below reproduces their cited 0.573°.)
const N_TOTAL = 6 * FACE_TEXELS * FACE_TEXELS;                 // 393216 texels
const NAIVE_EDGE_DEG = (2 * Math.PI / Math.sqrt(N_TOTAL)) * DEG;  // ≈ 0.574°
//
// WHY IT IS INCONSISTENT (the R6 point): a cube-map does NOT put √N_total texels
// on a great circle. A great circle crosses 4 faces × 256 = 1024 texels, so the
// TRUE per-texel great-circle size is 360/1024 = 90/256 = 0.352° (face-average),
// and at the face CENTRE the gnomonic metric makes texels COARSER still:
//   θ_texel(centre) = atan(2/256) rad = 0.4476°   (worst-case / coarsest texel)
// The naive 0.573° is neither the per-texel size (0.35–0.45°) NOR the resolvable
// edge — it is an internally inconsistent budget artifact that UNDER-counts the
// real resolving element once gnomonic distortion + the bake's low-pass (MIP /
// box) blur are included.
const TEXEL_FACE_AVG_DEG = (90 / FACE_TEXELS);                 // 0.352° face-average
const TEXEL_CENTRE_DEG = Math.atan(2 / FACE_TEXELS) * DEG;     // 0.4476° gnomonic centre (coarsest)

// ---------------------------------------------------------------------------
// (A.2) MEASURED edge — the resolving element R6 says to use.
// ---------------------------------------------------------------------------
// 1.11° is a MEASURED value from the panel's bake measurement (brief R6). It is
// the EFFECTIVE post-bake sample PITCH: the angular width of the smallest wall
// the 256²/face cube resolves after gnomonic distortion + bake low-pass blur.
// It exceeds the naive 0.573° per-texel by ≈1.93× (≈2.5 face-centre texels — the
// Nyquist 2-texel minimum edge + bake blur). CITED / MEASURED, medium-confidence.
//   ANCHOR: brief §R6 ("geometry table in measured edge units 1.11°, not 0.573°").
//   Not a taste constant: it is an externally-measured datum this model consumes,
//   flagged medium-confidence per the calibration-honesty bar (brief §4).
//   RESOLUTION PATH if tighter precision is wanted: re-measure the resolvable
//   edge directly from a baked crater-wall test pattern at 256²/face and replace.
const MEASURED_EDGE_DEG = 1.11;

// The bake's effective resampling pitch = the measured edge (a wall this wide is
// exactly at the resolving limit ⇒ its realized contrast is sub-texel-phase
// dependent, which is the whole S0.5a distribution point).
const PITCH_DEG = MEASURED_EDGE_DEG;

// ============================================================================
// (B) SUB-TEXEL PHASE MODEL — box-filter resampling of a 1-edge wall.
// ============================================================================
// A crater wall is modeled as a "1-edge" region of width w held at the wall's
// (distinct) Lambert brightness, embedded between two plateaus, resampled by the
// bake as box filters of pitch P = PITCH_DEG at sub-texel phase φ. The realized
// wall brightness fraction A(w,φ) = the box-average of the best-covered texel
// (how much of the wall's own brightness survives the resample). A ∈ [0,1];
// A = 1 when a texel lands fully inside the wall.
//
// Sub-texel PHASE is swept on a FIXED deterministic grid (NO RNG) — every number
// reproduces exactly on re-run.
function bestTexelFrac(wDeg, pitchDeg, phaseDeg) {
  // Wall spans [phase, phase+w); texel n spans [n·P, (n+1)·P). Return the max
  // fractional overlap of the wall with any single texel (= best-resolved
  // texel's box-average of the wall brightness, plateau = 0).
  const start = phaseDeg;
  const end = phaseDeg + wDeg;
  const t0 = Math.floor(start / pitchDeg);
  const t1 = Math.floor((end - 1e-12) / pitchDeg);
  let best = 0;
  for (let t = t0; t <= t1; t++) {
    const lo = t * pitchDeg;
    const hi = (t + 1) * pitchDeg;
    const ov = Math.max(0, Math.min(end, hi) - Math.max(start, lo));
    best = Math.max(best, ov / pitchDeg);
  }
  return best;
}

// Deterministic phase grid: M points across one pitch. M chosen large enough
// that the distribution stats are grid-converged to <1e-3 (verified: M=1000 vs
// M=4000 move mean/std by <1e-4). Not a taste constant — a convergence choice.
const M_PHASES = 1000;

function attenuationDistribution(wDeg, pitchDeg) {
  const samples = [];
  for (let i = 0; i < M_PHASES; i++) {
    const phase = (i / M_PHASES) * pitchDeg;   // φ ∈ [0, pitch)
    samples.push(bestTexelFrac(wDeg, pitchDeg, phase));
  }
  samples.sort((a, b) => a - b);
  const n = samples.length;
  const mean = samples.reduce((s, x) => s + x, 0) / n;
  const varr = samples.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n;
  const std = Math.sqrt(varr);
  const pct = (p) => samples[Math.min(n - 1, Math.floor(p * n))];
  return {
    mean,
    std,
    min: samples[0],
    max: samples[n - 1],
    p05: pct(0.05),   // conservative tail (worst 5% of sub-texel phases)
    p50: pct(0.50),
  };
}

// Distribution at the measured edge (w = P) — the S0.5a required deliverable.
const EDGE_ATTEN = attenuationDistribution(MEASURED_EDGE_DEG, PITCH_DEG);
// Closed-form check for w = P: A(φ) = max(1−φ/P, φ/P), φ∈[0,P) ⇒
//   mean = 0.75, min = 0.5, Var = 7/12 − 9/16 = 0.020833 (std = 0.14434),
//   P(A ≤ v) = 2v−1 ⇒ p05 = 0.525. The numeric grid must reproduce these.

// ============================================================================
// (C) θ_floor — the smallest wall subtense the chain can carry ≥1 band.
// ============================================================================
// A FULL-CONTRAST edge (C_true = 1, black↔white — the instrument's best case)
// of width w < P, at the WORST sub-texel phase (wall split evenly across a texel
// boundary), leaves its best texel at box-average w/(2P). To "carry ≥1 band" the
// best texel must sit ≥ 1 band (BAND_LUM = 1/LEVELS) above the plateau:
//     w/(2P) ≥ 1/LEVELS   ⇒   w ≥ 2P/LEVELS
// Below 2P/LEVELS, even a full-contrast wall cannot show 1 band at the worst
// phase ⇒ no arc is possible regardless of the crater's actual contrast. This is
// the content-INDEPENDENT display-resolving floor S3.a compares θ_wall against.
const THETA_FLOOR_DEG = 2 * PITCH_DEG / LEVELS;   // = 2·1.11/6 = 0.370°

// Numeric confirmation via the same phase model (worst-phase best texel = p-min).
const FLOOR_ATTEN = attenuationDistribution(THETA_FLOOR_DEG, PITCH_DEG);
// FLOOR_ATTEN.min should ≈ BAND_LUM (the wall is exactly at the 1-band floor at
// the worst phase). Reported as the self-check, not re-fit.

// ============================================================================
// (D) THE ≥1-BAND MAGNITUDE THRESHOLD — model-derived, set on the CONSERVATIVE
//     TAIL (S0.5a: "not the mean"). This is the ONE model output in the arc bar.
// ============================================================================
// Applied to a CAPTURE, the arc bar asks: do a stamp's opposing (light-facing vs
// shadow-facing) crater walls differ by ≥ 1 posterize band in the posterized
// surface luminance? So the magnitude the capture is thresholded against is:
const BAND_THRESHOLD_LUM = BAND_LUM;              // = 1/LEVELS = 0.166667 luminance (frozen)
//
// The CONSERVATIVE-TAIL construction (why "not the mean"): a wall at the measured
// edge only retains a p05 (worst-5%-phase) fraction EDGE_ATTEN.p05 of its true
// Lambert contrast after the bake. So for a stamp to reliably (≥95% of sub-texel
// phases) clear 1 band, its TRUE (pre-bake) opposing-wall contrast must be:
const BAND_THRESHOLD_TRUE_CONTRAST = BAND_LUM / EDGE_ATTEN.p05;   // ≈ (1/6)/0.525 = 0.317
// Setting the bar on the p05 tail (not the mean 0.75) prevents systematically
// over-counting: a threshold placed on the mean attenuation would pass stamps
// that fail at the ~half of phases below the mean. Both numbers are FROZEN
// pre-capture; no post-hoc tuning (brief R6 / feedback_perceptual-read-gate).

// Max Lambert opposing-wall contrast available at the staged incidence — a
// reference so S2 can sanity-check whether real walls even reach the bar.
// For a symmetric bowl, the two opposing walls tilt ±s from the mean surface;
// their diffuse difference at incidence i = |cos(i−s) − cos(i+s)| = 2·sin(i)·sin(s).
// At s = angle of repose (upper bound for fresh regolith walls, ~31° — a DOCUMENTED
// morphological BOUND, not a fit; complex "dish" walls sit far below this) and
// i = INCIDENCE_DEG:
const REPOSE_DEG = 31;   // angle-of-repose upper bound for the steepest possible wall (dry regolith);
                          // used only as a CEILING on available contrast, not as the population's slope.
                          // RESOLUTION PATH: replace with per-stamp wall slope from the RNG-neutral
                          // probe's craterField depths at S2/S3 (§E) — then this ceiling is unused.
const C_WALL_MAX = 2 * Math.sin(INCIDENCE_DEG / DEG) * Math.sin(REPOSE_DEG / DEG);  // ≈ 0.963

// ============================================================================
// (E) RNG-NEUTRAL CENTRE-EXPORT PROBE SPEC + shadow re-baseline protocol (R8).
//     Exported as a spec object; the writer/harness is built at S2/S3, NOT here.
// ============================================================================
const PROBE_SPEC = {
  purpose:
    'Export per-stamp crater centres (unit-vector direction), diameter D_km, and ' +
    'depth (from craterField) with ZERO added RNG draws and NO reordering, so the ' +
    'arc-test reads real geometry rather than a re-sampled population.',
  byteFenceSafe: {
    rule:
      'The probe MUST NOT consume any alea()/RNG stream state, MUST NOT reorder the ' +
      'crater iteration, and MUST NOT mutate carrier.height/craterField. It only ' +
      'READS centres/depths already placed by writeBombardment.',
    validation:
      'Validate against the fence-population harness pattern ' +
      '(../world-engine-inc3-relief-spine-depthlaw-2026-07-21/calibration/' +
      'fence-population-invariance.mjs): the carrier hashes + drawn population must be ' +
      'byte-identical with the probe enabled vs disabled (probe is read-only).',
  },
  perStampFields: ['centreDir(x,y,z)', 'D_km', 'depth_km', 'thetaWallDeg'],
  thetaWallFromProbe:
    'θ_wall(D,R,incidence) is computed per stamp from the probe geometry at S2/S3 ' +
    'and compared to THETA_FLOOR_DEG for the content-vs-instrument split (S3.a). ' +
    'S0 freezes THETA_FLOOR_DEG; S3 supplies the per-stamp θ_wall.',
};

const SHADOW_REBASELINE_PROTOCOL = {
  purpose:
    'darkClipFrac / shadowFrac guard against the render clipping crater interiors to ' +
    'black (which would erase arc asymmetry). After the S1 variance flip the luminance ' +
    'histogram shifts, so the guard baseline is stale.',
  protocol: [
    '1. BEFORE the flip: record darkClipFrac0/shadowFrac0 from the pre-budget render at the staged light.',
    '2. AFTER the S1 flip: RE-BASELINE darkClipFrac1/shadowFrac1 from the post-flip render at the SAME staged light.',
    '3. HOLD darkClipFrac1/shadowFrac1 fixed for S3/S4 (do not re-baseline again per capture — that would launder a regression).',
    '4. GATE: post-flip darkClipFrac must not EXCEED darkClipFrac1 by more than the frozen tolerance in read-gate-thresholds.json (S0.6).',
  ],
  note:
    're-baseline-after-flip is a ONE-TIME reset at the S1 seam, not a per-capture ' +
    'moving target (brief R8: "re-baselined after the S1 flip, then held for S3/S4").',
};

// ============================================================================
// (F) S0.5a — THE ARC-ASYMMETRY BAR, UN-SMUGGLED (lens-log MF-2).
//     Only ≥1-band is a model output. ≥70% and ≥-median are conventions.
// ============================================================================

// --- Convention 1: ≥70% population fraction. JUSTIFIED (binomial power). ------
// The ≥-median lit-disc subset is ~half of the affected-set stamps. Moon/Mercury
// stamped population nStamp = 147 (brief / §0.6), so the ≥-median subset N ≈ 73.
// NULL hypothesis: zero light-consistent asymmetry ⇒ each qualifying stamp is
// independently 50/50 to show ≥1-band asymmetry in the light-consistent direction
// by chance (p0 = 0.5). One-sided binomial significance floor at α = 0.05:
//   frac_floor = 0.5 + z_0.95·√(0.25/N),  z_0.95 = 1.645
const N_MEDIAN_SUBSET = 73;   // = round(147/2); nStamp(Moon/Mercury)=147 anchor: brief §R6 / §0.6
const Z95 = 1.645;            // one-sided normal 95% quantile (standard statistical constant)
const FRAC_SIGNIF_FLOOR = 0.5 + Z95 * Math.sqrt(0.25 / N_MEDIAN_SUBSET);  // ≈ 0.596
// ⇒ ANY observed fraction ≥ ~0.596 already rejects "pure-chance asymmetry" at
// N=73, 95% one-sided. The chosen 0.70 sits ABOVE that floor with margin and has
// high power against a genuinely-cratered surface: power to exceed FRAC_SIGNIF_FLOOR
// when the true asymmetry fraction is 0.70:
const P_TRUE = 0.70;
const POWER_AT_70 = 1 - normCdf((FRAC_SIGNIF_FLOOR - P_TRUE) / Math.sqrt(P_TRUE * (1 - P_TRUE) / N_MEDIAN_SUBSET));
const ARC_POP_FRACTION = 0.70;   // JUSTIFIED: above the 0.596 α=0.05 binomial floor at N≈73,
                                  // with power ≈POWER_AT_70 against a true 0.70 asymmetry fraction.
                                  // NOT a model output; a statistically-motivated acceptance convention.

// --- Convention 2: ≥-median size gate. GUESSED (proxy) + resolution path. ------
// The arc-test should only run on stamps the INSTRUMENT can resolve
// (θ_wall ≥ THETA_FLOOR_DEG); otherwise sub-floor small craters the model
// PREDICTS won't show arcs (content-limited) would dilute the fraction. The
// "≥-median size" cut is a simple, data-independent PROXY for that resolvability
// gate — but "median" is an arbitrary split, not a model output.
const SIZE_GATE = {
  rule: '>=median lit-disc stamp size',
  status: 'GUESSED',   // per S0.5a: NOT presented as a model output
  rationale:
    'median is a convenient proxy for "resolvable" (larger crater ⇒ larger θ_wall ⇒ ' +
    'more likely ≥ THETA_FLOOR_DEG); it avoids diluting the fraction with sub-floor stamps.',
  resolutionPath:
    'Replace the median proxy with the EXACT per-stamp partition θ_wall ≥ THETA_FLOOR_DEG ' +
    '(θ_wall from the RNG-neutral probe, §E). Then no arbitrary median cut is needed and ' +
    'the size gate becomes the same geometric floor S3.a already uses.',
};

// normal CDF (Abramowitz-Stegun 7.1.26 erf approx) — deterministic, no deps.
function normCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}
function erf(x) {
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return s * y;
}

// ============================================================================
// (G) WORKED GEOMETRY TABLE — Moon/Mercury canonical population vs θ_floor.
//     Grounds the content-vs-instrument split with real schedule diameters.
// ============================================================================
function moonMercuryGeometry() {
  const name = 'Moon/Mercury (impact-airless)';
  const fp = DRIVER_PRESETS[name];
  if (!fp) return { error: `preset ${name} not found` };
  const R = fp.radiusEarth ?? 0.38;                          // canonical (NAMED_BODY-locked)
  const cond = deriveConditionVector(fp, deriveUniforms(fp, 1.0), R);
  const sched = craterSchedule(cond);
  const impact = isImpactSurface(cond);
  // R_km / diameters are schedule outputs (§0.6). Angular diameter α = D_km/R_km
  // (small-angle, radians). A wall subtends a fraction of α; use the measured
  // edge as the resolving element and report each characteristic diameter's α.
  const R_km = sched.R_km;
  const angDeg = (Dkm) => (Dkm / R_km) * DEG;               // angular diameter, degrees
  const table = {};
  for (const [k, Dkm] of Object.entries({
    D_FLOOR_KM: sched.D_FLOOR_KM,      // smallest stamped crater
    D_LO_KM: sched.D_LO_KM,
    D_HI_KM: sched.D_HI_KM,            // largest basin
  })) {
    if (Dkm == null) continue;
    const alpha = angDeg(Dkm);
    table[k] = {
      D_km: Dkm,
      angularDiameterDeg: alpha,
      // A wall occupies the outer annulus of the bowl; its angular subtense is a
      // fraction of the diameter. The exact fraction comes from the craterField
      // profile at S3 (probe) — here we report the angular diameter itself and
      // whether even a diameter-scale feature clears the resolving floor.
      angularDiameterVsFloor: alpha >= THETA_FLOOR_DEG ? 'resolvable' : 'sub-floor',
    };
  }
  return { R_earth: R, R_km, nStamp: sched.nStamp, tExp: sched.tExp, isImpactSurface: impact, diameters: table };
}

// ============================================================================
// (H) ASSEMBLE, SELF-CHECK, EMIT.
// ============================================================================
const model = {
  // --- required exports (task) ---
  measuredEdgeDeg: MEASURED_EDGE_DEG,
  thetaFloorDeg: THETA_FLOOR_DEG,
  bandThreshold: BAND_THRESHOLD_LUM,               // the ≥1-band magnitude (luminance), frozen
  attenuationStats: {                              // sub-texel phase DISTRIBUTION at the measured edge
    atMeasuredEdge: EDGE_ATTEN,
    conservativeTail: 'p05',
    bandThresholdTrueContrast: BAND_THRESHOLD_TRUE_CONTRAST,  // true contrast to clear 1 band at p05
  },
  // --- bake / display chain (anchored) ---
  displayChain: {
    levels: LEVELS,
    bandLuminance: BAND_LUM,
    faceTexels: FACE_TEXELS,
    incidenceDeg: INCIDENCE_DEG,
    lightAzimuthDeg: 40.6,                          // planet-lod-lab.html:2006
    lightElevationDeg: LIGHT_ELEV_DEG,             // planet-lod-lab.html:2007
  },
  // --- R6 measured-edge vs naive-edge discrepancy, documented ---
  edgeUnits: {
    measuredEdgeDeg: MEASURED_EDGE_DEG,            // cited/measured (brief R6), medium-confidence
    naiveEdgeDeg: NAIVE_EDGE_DEG,                  // 2π/√(6·256²) ≈ 0.574° — the number R6 says NOT to use
    ratioMeasuredToNaive: MEASURED_EDGE_DEG / NAIVE_EDGE_DEG,
    texelFaceAvgDeg: TEXEL_FACE_AVG_DEG,           // 0.352°
    texelCentreGnomonicDeg: TEXEL_CENTRE_DEG,      // 0.4476° (coarsest)
    note:
      'naive 2/√N counts √N_total texels on a great circle; a cube-map actually puts ' +
      '4·256=1024 texels there ⇒ true per-texel 0.35–0.45°, and the resolvable EDGE ' +
      '(Nyquist 2-texel + bake blur) is the measured 1.11°.',
  },
  // --- pinned floor self-check ---
  thetaFloorSelfCheck: {
    formula: '2·PITCH/LEVELS (full-contrast wall carries exactly 1 band at worst sub-texel phase)',
    pitchDeg: PITCH_DEG,
    worstPhaseBestTexel: FLOOR_ATTEN.min,          // should ≈ BAND_LUM
    expectedBandLuminance: BAND_LUM,
  },
  maxLambertWallContrast: {
    C_WALL_MAX,
    reposeDeg: REPOSE_DEG,
    note: 'CEILING (angle-of-repose wall) on available opposing-wall contrast at the staged incidence; not the population slope.',
  },
  // --- S0.5a arc bar, split (MF-2) ---
  arcAsymmetryBar: {
    modelDerived: {
      geqOneBandMagnitude: BAND_THRESHOLD_LUM,
      setOn: 'conservative tail (p05), not the mean',
      trueContrastToClear: BAND_THRESHOLD_TRUE_CONTRAST,
      frozenPreCapture: true,
    },
    acceptanceConventions: {
      populationFraction: {
        value: ARC_POP_FRACTION,
        status: 'JUSTIFIED',
        justification:
          `binomial: null p0=0.5, N≈${N_MEDIAN_SUBSET} (≥-median subset of nStamp=147); ` +
          `α=0.05 one-sided significance floor = 0.5 + 1.645·√(0.25/${N_MEDIAN_SUBSET}) = ${FRAC_SIGNIF_FLOOR.toFixed(3)}; ` +
          `0.70 chosen above that floor with power ≈ ${POWER_AT_70.toFixed(3)} against a true 0.70 asymmetry fraction.`,
        significanceFloor: FRAC_SIGNIF_FLOOR,
        powerAt070: POWER_AT_70,
        notModelOutput: true,
      },
      sizeGate: SIZE_GATE,
    },
    note:
      'ONLY geqOneBandMagnitude is a model output. populationFraction + sizeGate are acceptance ' +
      'conventions (MF-2). To be frozen into read-gate-thresholds.json at the S0.6 seam with these tags.',
  },
  // --- specs (R8) ---
  rngNeutralProbeSpec: PROBE_SPEC,
  shadowRebaselineProtocol: SHADOW_REBASELINE_PROTOCOL,
  // --- worked geometry ---
  moonMercuryGeometry: moonMercuryGeometry(),
};

// Round-trip determinism: JSON is stable (no timestamps, no RNG, fixed phase grid).
const outPath = join(__dirname, 'bake-attenuation-model.json');
writeFileSync(outPath, JSON.stringify(model, null, 2) + '\n');

// ---- console summary (key numbers; no wall-clock timing) ----
console.log('=== Inc-3b S0.5/S0.5a bake-attenuation model ===');
console.log(`measuredEdgeDeg          : ${MEASURED_EDGE_DEG}`);
console.log(`naiveEdgeDeg (2π/√N)      : ${NAIVE_EDGE_DEG.toFixed(4)}  (ratio measured/naive = ${(MEASURED_EDGE_DEG / NAIVE_EDGE_DEG).toFixed(3)})`);
console.log(`texel: faceAvg ${TEXEL_FACE_AVG_DEG.toFixed(4)}° / centre(gnomonic) ${TEXEL_CENTRE_DEG.toFixed(4)}°`);
console.log(`LEVELS ${LEVELS}  bandLuminance ${BAND_LUM.toFixed(6)}`);
console.log(`incidenceDeg             : ${INCIDENCE_DEG}`);
console.log(`thetaFloorDeg            : ${THETA_FLOOR_DEG.toFixed(6)}   (2·${PITCH_DEG}/${LEVELS})`);
console.log(`  floor self-check worst-phase best texel = ${FLOOR_ATTEN.min.toFixed(6)} (expect ≈ bandLum ${BAND_LUM.toFixed(6)})`);
console.log(`attenuation @ measured edge: mean ${EDGE_ATTEN.mean.toFixed(5)}  std ${EDGE_ATTEN.std.toFixed(5)}  min ${EDGE_ATTEN.min.toFixed(5)}  p05 ${EDGE_ATTEN.p05.toFixed(5)}`);
console.log(`  (closed-form expect: mean 0.75000 std 0.14434 min 0.50000 p05 0.52500)`);
console.log(`bandThreshold (magnitude): ${BAND_THRESHOLD_LUM.toFixed(6)} luminance`);
console.log(`bandThreshold true-contrast (p05 tail): ${BAND_THRESHOLD_TRUE_CONTRAST.toFixed(5)}`);
console.log(`C_WALL_MAX (repose ceiling): ${C_WALL_MAX.toFixed(5)}`);
console.log(`--- S0.5a arc bar split ---`);
console.log(`  ≥1-band magnitude (MODEL)     : ${BAND_THRESHOLD_LUM.toFixed(6)}  [frozen, p05 tail]`);
console.log(`  ≥70% pop fraction (JUSTIFIED) : floor ${FRAC_SIGNIF_FLOOR.toFixed(3)}, power@0.70 ${POWER_AT_70.toFixed(3)}`);
console.log(`  ≥-median size gate (GUESSED)  : proxy for θ_wall≥θ_floor; resolution path attached`);
console.log(`--- Moon/Mercury geometry ---`);
console.log(JSON.stringify(model.moonMercuryGeometry, null, 2));
console.log(`\nwrote ${outPath}`);

export {
  MEASURED_EDGE_DEG as measuredEdgeDeg,
  THETA_FLOOR_DEG as thetaFloorDeg,
  BAND_THRESHOLD_LUM as bandThreshold,
  BAND_THRESHOLD_TRUE_CONTRAST as bandThresholdTrueContrast,
  EDGE_ATTEN as attenuationStats,
  LEVELS,
  BAND_LUM,
  PROBE_SPEC,
  SHADOW_REBASELINE_PROTOCOL,
};
