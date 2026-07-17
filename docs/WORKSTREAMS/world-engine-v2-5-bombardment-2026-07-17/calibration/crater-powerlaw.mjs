// docs/WORKSTREAMS/world-engine-v2-5-bombardment-2026-07-17/calibration/crater-powerlaw.mjs
// World Engine V2-5 (bombardment) — crater POWER-LAW size-frequency calibration probe (BUILD-PLAN §7.2, §2b).
//
// PURPOSE: pin the cumulative size-frequency exponent B_SFD and the reference crater count N_CRATERS_REF,
// and CONFIRM — on every one of the 5 seeds, BEFORE the thresholds are hard-coded into the test — that:
//   • the bounded-Pareto draw's DIFFERENTIAL size-frequency dN/dlogD fits a log-log line of slope −B_SFD
//     within the documented band [−2.2, −1.8] with R² > 0.95 (M-MF1: we fit the DIFFERENTIAL dN/dlogD, not
//     the cumulative — a bounded-uniform diameter null gives a NEGATIVE cumulative log-log slope that is NOT
//     decisively separated, whereas its dN/dlogD is ∝ D^(+1), a clean sign-flipped rejection);
//   • a UNIFORM-diameter null's dN/dlogD fits a POSITIVE slope (≈ +1), robustly outside the band.
// The drawPowerLaw inverse-CDF + the differential-fit binning are TEXTUALLY the vitest suite's; this probe
// is the evidence that R² > 0.95 is genuinely met at the achieved sample size (the large-D bins are sparse).
//
// METERED-SAFE: pure `node`, no `claude -p`.  Run:  node docs/WORKSTREAMS/.../calibration/crater-powerlaw.mjs
import alea from 'alea';

// ── pinned band / size band (crater-scale.mjs) ────────────────────────────────────────────────────
const B_SFD = 2.0;              // cumulative exponent, band [1.8, 2.2] (lunar-highlands production range)
const SLOPE_LO = -2.2, SLOPE_HI = -1.8;   // differential dN/dlogD log-log slope band (= −B_SFD ± 0.2)
const R2_MIN = 0.95;
const D_MIN_RAD = 0.05, D_MAX_RAD = 0.50;

// ── candidate scheduling (cross-checked/pinned in crater-drivers.mjs; used HERE only to size the population
//    for reporting only — the SFD SHAPE is a sampler property, tested at a statistically-adequate N) ─────
const N_CRATERS_REF = 1800, G_REF = 0.5, AGE_REF = 4.0, K_AGE = 0.5, K_GD = 0.7;
const MOON_G = 0.04 / (0.38 * 0.38), MOON_AGE = 4.5;   // §5 Moon/Mercury native point (g = M/R²)
const nCratersOf = (g, age) => Math.round(N_CRATERS_REF * Math.pow(age / AGE_REF, K_AGE) * Math.pow(G_REF / g, K_GD));
const N_STAMP = nCratersOf(MOON_G, MOON_AGE);   // craters the writer actually STAMPS (a MULTIPLY concern)

// N_FIT: the per-seed sample used to FIT the SFD. The differential dN/dlogD LSQ slope is Poisson-noise-biased
// SHALLOW at the native ~2887 stamp count (the sparse large-D bins clip at count≥1, biasing the high end up),
// so per-seed slopes drift just outside [−1.8] there (BUILD-PLAN §2b's explicit "raise N_CRATERS_REF for the
// TEST POPULATION" caveat). The SFD is a distributional property of drawPowerLaw — its slope is what
// AC-POWERLAW asserts; the STAMP count (N_STAMP) is a separate MULTIPLY concern (AC-MULTIPLY). So fit the
// writer's SFD sampler at a statistically-adequate N_FIT; at N_FIT the slope converges to −B_SFD on every seed
// (BUILD-PLAN §10 deviation D3).
const N_FIT = 16000;
const SEEDS = [1, 2, 3, 7, 42];
const NB = 12;                 // log-spaced diameter bins

// bounded-Pareto inverse-CDF: N(>D) ∝ D^(−B_SFD) on [D_MIN, D_MAX] (BUILD-PLAN §2b).
const RATIO_POW = Math.pow(D_MIN_RAD / D_MAX_RAD, B_SFD);
function drawPowerLaw(rng) { const u = rng(); return D_MIN_RAD * Math.pow(1 - u * (1 - RATIO_POW), -1 / B_SFD); }

// least-squares linear fit → { slope, r2 }
function linfit(xs, ys) {
  const n = xs.length; let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const slope = sxy / sxx;
  const r2 = (sxy * sxy) / (sxx * syy);
  return { slope, r2 };
}

// differential dN/dlogD fit: bin diameters into NB equal-log-width bins; equal Δlog ⇒ dN/dlogD ∝ count, so
// fit log10(count) vs log10(D_center) (the constant Δlog offset cancels in the slope). Drop empty bins.
function fitDiff(diams) {
  const lo = Math.log(D_MIN_RAD), hi = Math.log(D_MAX_RAD), w = (hi - lo) / NB;
  const counts = new Array(NB).fill(0);
  for (const D of diams) { let b = Math.floor((Math.log(D) - lo) / w); if (b < 0) b = 0; if (b >= NB) b = NB - 1; counts[b]++; }
  const xs = [], ys = [];
  for (let b = 0; b < NB; b++) if (counts[b] > 0) {
    const Dc = Math.exp(lo + (b + 0.5) * w);
    xs.push(Math.log10(Dc)); ys.push(Math.log10(counts[b]));
  }
  return { ...linfit(xs, ys), nbins: xs.length, counts };
}

const out = [];
const p = (s) => out.push(s);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('  V2-5 BOMBARDMENT — POWER-LAW size-frequency calibration  (crater-powerlaw.mjs — BUILD-PLAN §7.2)');
p(`  B_SFD = ${B_SFD}  band[${SLOPE_LO}, ${SLOPE_HI}]  R²>${R2_MIN}   N_CRATERS_REF = ${N_CRATERS_REF}`);
p(`  fit basis = DIFFERENTIAL dN/dlogD (M-MF1)   bins = ${NB} log-spaced over [${D_MIN_RAD}, ${D_MAX_RAD}] rad`);
p(`  new-preset STAMP count (g=${MOON_G.toFixed(3)}, age=${MOON_AGE}) = ${N_STAMP} craters (MULTIPLY concern);  SFD fit sample N_FIT = ${N_FIT}/seed`);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('');
p('── POWER-LAW draw (dN/dlogD fit; expect slope∈band, R²>0.95 every seed) ────────────────────────────');
p('   seed   N_FIT   bins   slope     R²      in-band?  R²>0.95?');
let allPow = true;
for (const seed of SEEDS) {
  const rng = alea('bombard:' + seed);
  const diams = []; for (let k = 0; k < N_FIT; k++) diams.push(drawPowerLaw(rng));
  const f = fitDiff(diams);
  const inBand = f.slope >= SLOPE_LO && f.slope <= SLOPE_HI, r2ok = f.r2 > R2_MIN;
  allPow = allPow && inBand && r2ok;
  p(`   ${String(seed).padStart(4)}   ${String(N_FIT).padStart(6)}   ${String(f.nbins).padStart(3)}   ${f.slope.toFixed(4).padStart(8)}  ${f.r2.toFixed(4)}   ${inBand ? 'YES' : 'no '}      ${r2ok ? 'YES' : 'no'}`);
}
p('');
p('── UNIFORM-diameter NULL (dN/dlogD fit; expect slope ≥ 0 and OUTSIDE the band — clean rejection) ───');
p('   seed   bins   slope     R²      slope≥0?  outside-band?');
let allNull = true;
for (const seed of SEEDS) {
  const rng = alea('bombard-uniform:' + seed);
  const diams = []; for (let k = 0; k < N_FIT; k++) diams.push(D_MIN_RAD + rng() * (D_MAX_RAD - D_MIN_RAD));
  const f = fitDiff(diams);
  const pos = f.slope >= 0, outside = !(f.slope >= SLOPE_LO && f.slope <= SLOPE_HI);
  allNull = allNull && pos && outside;
  p(`   ${String(seed).padStart(4)}   ${String(f.nbins).padStart(3)}   ${f.slope.toFixed(4).padStart(8)}  ${f.r2.toFixed(4)}   ${pos ? 'YES' : 'no '}      ${outside ? 'YES' : 'no'}`);
}
p('');
p('── BAKED CONSTANTS (copy into src/worldengine/base/bombardment.js) ─────────────────────────────────');
p(`  B_SFD          = ${B_SFD}`);
p(`  D_MIN_RAD      = ${D_MIN_RAD}`);
p(`  D_MAX_RAD      = ${D_MAX_RAD}`);
p(`  N_CRATERS_REF  = ${N_CRATERS_REF}`);
p('  (AC-POWERLAW test band: slope ∈ [−2.2, −1.8], R² > 0.95 every seed; uniform null slope ≥ 0 & outside)');
p('');
p(`  OVERALL: ${allPow && allNull ? 'ALL PASS' : 'FAIL — retune N_CRATERS_REF / NB / B_SFD'}`);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
process.stdout.write(out.join('\n') + '\n');
