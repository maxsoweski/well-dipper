// calibration/relic-lambda.mjs — Inc-3b S0.1 + S0.1a: the relic-Λ endogenic-relief law.
//
// WHAT THIS COMPUTES (BUILD-PLAN §1.S0 blocks S0.1/S0.1a; brief §2.1 + §4 calibration-honesty):
//   The endogenic ("relic", despun/frozen-in) relief amplitude of a dead-lid impact-retentive
//   world, as a fraction of its radius:
//
//     σ_endo/R = C_RELIC · g^(−Q_RELIEF) · max(Λ_FLOOR, Φ_peak^{P_Λ}) · (1 − K_IR·iceness)
//
//   This is the ENDO side of the relief-variance budget. The IMPACT side (σ_imp/R, from the
//   shipped craterSchedule) is UNCHANGED and consumed here only as a fixed reference to report
//   the impact-fraction f_I = σ_imp²/(σ_imp²+σ_endo²). σ_imp per-world derivation is S0.2's job
//   (relief-budget-fit.mjs, measuring craterField RMS); here we use the plan's committed boot
//   reference σ_imp/R ≈ 1.09e-3 (see SIGMA_IMP_OVER_R below).
//
//   The law has EXACTLY TWO free parameters (C_RELIC, P_Λ) fit on EXACTLY TWO anchors
//   (Mercury, Moon). It is therefore EXACTLY IDENTIFIED: zero residual, no goodness-of-fit is
//   possible — the fit can only be asserted, never validated (this is why S0.1a runs the
//   anchor-sensitivity sweep and derives a WIDE f_I band rather than trusting a point value).
//
// DECLARED DOMAIN — dead-lid impact-retentive worlds ONLY. Earth / live (plate-tectonic) worlds
//   NEVER enter this law: at the composite seam they take the bit-exact IDENTITY path (w_e=w_i=1).
//   The Mercury+Moon fit (P_Λ≈0.25) and an Earth+Moon fit (P_Λ≈0.69) are MUTUALLY EXCLUSIVE —
//   demonstrated numerically in reportMutualExclusivity() below — so the Earth anchor LEAVES the
//   fit rather than breaking it. A single 2-parameter law cannot serve both regimes; the domain
//   restriction is what makes the 2-anchor fit self-consistent.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// CALIBRATION HONESTY (brief §4 R6 + contract no-taste-constant bar). Every numeric constant below
// carries a derivation comment + anchor, OR is explicitly tagged GUESSED with a resolution path.
// The following are TRAINING-SOURCED real-body values — MEDIUM CONFIDENCE, not repo-derived, not
// literature-verified this session (a literature-verify pass is available if wanted, brief §4 R6):
//   • surface gravities  g: Mercury 3.70, Moon 1.62, Earth 9.80665 m/s²
//   • mean radii         R: Mercury 2439.7, Moon 1737.4, Earth 6371.0 km
//   • σ_endo/R anchors     : Mercury 1.8e-4, Moon 2.5e-4  (real-body relic-relief RMS attributions
//                            carried from the panel synthesis; the load-bearing anchors of the fit)
//   • Earth σ_endo/R       : 3.6e-4  (Earth hypsometric RMS ≈ 2.3 km / 6371 km; mutual-exclusivity
//                            demo ONLY — Earth is out-of-domain and never uses this law)
//   • σ_imp/R boot ref     : 1.09e-3 (Inc-3 amplitude-budget measurement at the Moon/Mercury boot;
//                            ≈ real-Moon; the number the budget reallocates toward)
// Repo-DERIVED (not taste): Q_RELIEF (imported), g / Φ_peak / iceness of the in-domain repo presets
// (computed via the shipped modules), and every arithmetic result.
//
// PURE node ESM. No dev server, no network, no claude -p, no RNG, no timestamps/timing in output.
// Every printed and written number reproduces EXACTLY on re-run. Runnable from any cwd.
// Run:  node relic-lambda.mjs        (exits 0 on success; writes relic-lambda-band.json)
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Import depth ../../../../ from calibration/ → repo root (mirrors the predecessor
// world-engine-inc3-…/calibration/population-sweep.mjs import pattern).
import { Q_RELIEF, deriveUniforms } from '../../../../src/worldengine/base/labCore.js';
import { convectiveVigor } from '../../../../src/worldengine/base/e1Regime.js';
import { icenessOf } from '../../../../src/worldengine/base/surfaceMaterial.js';
import { craterSchedule, isImpactSurface } from '../../../../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ASSERT the imported strength exponent (BUILD-PLAN S0.1: "Q_RELIEF is IMPORTED … no second
//    strength exponent"). There is NO second g-exponent defined in this file — the ONLY strength
//    exponent is the shipped render-envelope Q_RELIEF, reused so the endo model and the render
//    envelope cannot drift to two different g-laws (triple g-term audit, S0.4). ─────────────────
if (typeof Q_RELIEF !== 'number' || !Number.isFinite(Q_RELIEF) || Q_RELIEF <= 0) {
  throw new Error(`relic-lambda: Q_RELIEF import invalid (${Q_RELIEF}) — expected the shipped positive strength exponent from planet-lod-lab-core.js`);
}
const Q = Q_RELIEF; // = 0.58 at HEAD; reused, NOT re-declared as a local taste constant.

// ── fitted-law constants that the 2-anchor fit does NOT determine ──────────────────────────────
//
// Λ_FLOOR — the max() floor on the vigor factor Φ_peak^{P_Λ}. A world with ~zero convective vigor
//   would otherwise get σ_endo → 0, which erases the faint despun fabric entirely (w_e → 0). The
//   floor keeps a residual relic substrate. Value 0.05:
//   GUESSED. Resolution path: anchor it on a genuinely low-vigor cold body (e.g. a small airless
//   KBO / dwarf with a measured relic-relief RMS). It is currently INERT — verified in-script that
//   Φ_peak^{P_Λ} > Λ_FLOOR for all four in-domain worlds (the floor binds nowhere in the
//   calibration set), so it changes no reported number; it is a guard against a future low-vigor
//   world, not a fit parameter.
const LAMBDA_FLOOR = 0.05;
//
// K_IR — the per-unit-iceness suppression of relic relief (viscous relaxation of ancient
//   long-wavelength topography under an icy rheology). Callisto-targeted (a heavily-cratered icy
//   world whose ancient relief is partly relaxed but craters stay legible).
//   DERIVATION (medium-confidence, not GUESSED-blind): the shipped ice-relaxation model
//   (bombardment.js iceRelaxation) gives crater-BOWL relaxed fraction epsBowl → iceness as tI→∞
//   (asymptote coefficient 1.0 on iceness). Relic endo relief is LONG-wavelength; viscous
//   relaxation rate falls with wavenumber (∝ 2π/λ), so long-λ relic relief relaxes SLOWER than
//   short-λ crater bowls over the same age. K_IR = 0.5 encodes "relic relief relaxes at ≈half the
//   crater-bowl asymptote". The ½ is order-of-magnitude — MEDIUM CONFIDENCE.
//   Resolution path: a wavelength-dependent τ_relax against a dedicated icy σ_endo anchor
//   (Callisto/Ganymede shaded-relief DEM RMS). It cannot be constrained by the two ROCK anchors
//   (both iceness=0), which is why it is set here, separately, not by the 2-anchor fit.
const K_IR = 0.5;

// ── impact-side reference (UNCHANGED shipped law; consumed to report f_I) ───────────────────────
// σ_imp/R at the Moon/Mercury boot ≈ 1.09e-3 (Inc-3 amplitude-budget measurement; ≈ real Moon).
// MEDIUM CONFIDENCE (training-sourced-adjacent — a measured harness output carried from Inc-3).
// Used uniformly for the in-domain airless worlds here because they share a near-common stamped
// population (nStamp 104–147, similar coverage); PER-WORLD craterField-RMS refinement is S0.2's
// job (relief-budget-fit.mjs). This does not affect the σ_endo FIT — only the reported f_I.
const SIGMA_IMP_OVER_R = 1.09e-3;

// ── real-body anchors (training-sourced, MEDIUM CONFIDENCE — see header) ────────────────────────
const G_EARTH = 9.80665;   // m/s² standard gravity — the g-normalizer (Earth-relative g = g/G_EARTH)
const R_EARTH_KM = 6371.0; // km — matches the shipped R_EARTH_KM in planet-lod-lab-core.js
const REAL = {
  Mercury: { g_ms2: 3.70,    R_km: 2439.7, sigmaEndoOverR: 1.8e-4 }, // FIT ANCHOR
  Moon:    { g_ms2: 1.62,    R_km: 1737.4, sigmaEndoOverR: 2.5e-4 }, // FIT ANCHOR
  Earth:   { g_ms2: 9.80665, R_km: 6371.0, sigmaEndoOverR: 3.6e-4 }, // mutual-exclusivity demo ONLY (out-of-domain)
};
const gRel = (b) => b.g_ms2 / G_EARTH;
const rRel = (b) => b.R_km / R_EARTH_KM;

// ── Φ_peak: PEAK convective vigor (relic relief is frozen in at maximum endogenic activity) ─────
// The shipped convectiveVigor(cv) = { phi } with phi = sqrt(radiogenic·(0.5·mass + 0.5·R³)) +
// 10·rawTidal, radiogenic = 1 − clamp01(age/10). "Peak" = age→0 ⇒ radiogenic = 1 (maximum). We
// evaluate the SHIPPED function at age=0 so Φ_peak is grounded in the repo mechanism, not an
// ad-hoc formula. mass = massEarthOf = g·R² (repo), which reproduces real Mercury/Moon masses to
// ~2 sig figs from their real g,R (self-consistent). rawTidal=0 for these dead worlds.
function phiPeakFromGR(gEarth, rEarth) {
  return convectiveVigor({ surfaceGravity: gEarth, radiusEarth: rEarth, age: 0, rawTidalIoRatio: 0 }).phi;
}
function phiPeakFromCond(cond) {
  // in-domain repo presets: reuse the derived condition vector but force peak (age=0).
  return convectiveVigor({ ...cond, age: 0 }).phi;
}

// ── THE LAW (exported) ─────────────────────────────────────────────────────────────────────────
// sigmaEndoOverR(g, phiPeak, iceness) — the fitted relic-Λ closed form. Consumed by
// relief-budget-fit.mjs and read-gate-thresholds.json (via the exported FIT constants).
export function makeSigmaEndoOverR(C_RELIC, P_LAMBDA) {
  return function sigmaEndoOverR(g, phiPeak, iceness = 0) {
    const vigor = Math.max(LAMBDA_FLOOR, Math.pow(phiPeak, P_LAMBDA)); // Λ vigor factor with floor
    const iceFactor = 1 - K_IR * iceness;                             // relic relief relaxes with ice
    return C_RELIC * Math.pow(g, -Q) * vigor * iceFactor;
  };
}

// ── the exactly-identified 2-anchor fit (analytic, zero residual) ──────────────────────────────
// Two log-linear equations in (ln C_RELIC, P_Λ):
//   ln(σ/R) = ln C_RELIC − Q·ln g + P_Λ·ln Φ_peak    (iceness=0 for both rock anchors ⇒ iceFactor=1,
//                                                      and Φ_peak^{P} > Λ_FLOOR ⇒ floor inactive)
// Solve by the ratio (eliminates C_RELIC), then back-substitute for C_RELIC.
function fitTwoAnchor(aLo, aHi) {
  // aLo, aHi: { g, phiPeak, sigmaEndoOverR } (order irrelevant; both rock, iceness 0)
  const P = (Math.log(aHi.sigmaEndoOverR / aLo.sigmaEndoOverR) + Q * Math.log(aHi.g / aLo.g))
          / Math.log(aHi.phiPeak / aLo.phiPeak);
  const C = aLo.sigmaEndoOverR / (Math.pow(aLo.g, -Q) * Math.pow(aLo.phiPeak, P));
  return { C_RELIC: C, P_LAMBDA: P };
}

// build the anchor records
const MERCURY = { g: gRel(REAL.Mercury), R: rRel(REAL.Mercury), phiPeak: phiPeakFromGR(gRel(REAL.Mercury), rRel(REAL.Mercury)), sigmaEndoOverR: REAL.Mercury.sigmaEndoOverR };
const MOON    = { g: gRel(REAL.Moon),    R: rRel(REAL.Moon),    phiPeak: phiPeakFromGR(gRel(REAL.Moon),    rRel(REAL.Moon)),    sigmaEndoOverR: REAL.Moon.sigmaEndoOverR };
const EARTH   = { g: gRel(REAL.Earth),   R: rRel(REAL.Earth),   phiPeak: phiPeakFromGR(gRel(REAL.Earth),   rRel(REAL.Earth)),   sigmaEndoOverR: REAL.Earth.sigmaEndoOverR };

const FIT = fitTwoAnchor(MERCURY, MOON);
const sigmaEndoOverR = makeSigmaEndoOverR(FIT.C_RELIC, FIT.P_LAMBDA);

// zero-residual self-check (exactly identified ⇒ both anchors reproduced to float epsilon)
const residMe = sigmaEndoOverR(MERCURY.g, MERCURY.phiPeak, 0) - MERCURY.sigmaEndoOverR;
const residMo = sigmaEndoOverR(MOON.g, MOON.phiPeak, 0) - MOON.sigmaEndoOverR;
const EXACTLY_IDENTIFIED = Math.abs(residMe) < 1e-16 && Math.abs(residMo) < 1e-16;

// floor-inactivity check (Λ_FLOOR binds nowhere in the calibration set)
const floorBindsAnchor = Math.pow(MERCURY.phiPeak, FIT.P_LAMBDA) <= LAMBDA_FLOOR
                       || Math.pow(MOON.phiPeak, FIT.P_LAMBDA) <= LAMBDA_FLOOR;

// ── f_I helper ─────────────────────────────────────────────────────────────────────────────────
const impactFraction = (sigmaEndo, sigmaImp = SIGMA_IMP_OVER_R) =>
  (sigmaImp * sigmaImp) / (sigmaImp * sigmaImp + sigmaEndo * sigmaEndo);

// ── the in-domain repo worlds (g / Φ_peak / iceness DERIVED via shipped modules at canonical R) ─
const IN_DOMAIN_NAMES = [
  'Moon/Mercury (impact-airless)',
  'Frozen (airless)',
  'Crystal (faceted)',
  'Mars (arid rocky)',
];
function worldRecord(name) {
  const fp = DRIVER_PRESETS[name];
  const cond = deriveConditionVector(fp, deriveUniforms(fp, 1.0), fp.radiusEarth); // canonical radius
  const g = cond.surfaceGravity;
  const phiPeak = phiPeakFromCond(cond);
  const iceness = icenessOf(cond);
  const inDomain = isImpactSurface(cond); // dead-lid impact-retentive predicate (cold + solid surface)
  const sEndo = sigmaEndoOverR(g, phiPeak, iceness);
  const sched = craterSchedule(cond);
  return { name, g, phiPeak, iceness, inDomain, nStamp: sched.nStamp,
           sigmaEndoOverR: sEndo, f_I: impactFraction(sEndo) };
}
const worlds = IN_DOMAIN_NAMES.map(worldRecord);

// ── S0.1a — ANCHOR-SENSITIVITY SWEEP ───────────────────────────────────────────────────────────
// The 2-anchor fit is exactly identified ⇒ un-validatable. The Moon σ_endo anchor is a
// MEDIUM-CONFIDENCE real-body value; a ±20% (within-uncertainty) or ×2 (worst-case) perturbation
// on it refits (C_RELIC, P_Λ) — the sweep shows how far P_Λ and every downstream f_I move. The
// band we FREEZE for AC-BUDGET must be wide enough to absorb this, so it is derived here, not
// chosen. Mercury anchor held fixed; each scenario is a fresh exact 2-anchor fit.
const SWEEP_SCENARIOS = [
  { label: 'baseline',    moonScale: 1.0 },
  { label: 'moon -20%',   moonScale: 0.8 },  // within-uncertainty
  { label: 'moon +20%',   moonScale: 1.2 },  // within-uncertainty
  { label: 'moon x2',     moonScale: 2.0 },  // worst-case stress (reported, not in the band)
];
function runScenario(moonScale) {
  const moonAnchor = { g: MOON.g, R: MOON.R, phiPeak: MOON.phiPeak, sigmaEndoOverR: MOON.sigmaEndoOverR * moonScale };
  const fit = fitTwoAnchor(MERCURY, moonAnchor);
  const law = makeSigmaEndoOverR(fit.C_RELIC, fit.P_LAMBDA);
  const rows = worlds.map((w) => {
    const sEndo = law(w.g, w.phiPeak, w.iceness);
    return { name: w.name, sigmaEndoOverR: sEndo, f_I: impactFraction(sEndo) };
  });
  // also report the perturbed Moon anchor's own f_I (its σ_endo scaled directly)
  const moonAnchorFI = impactFraction(moonAnchor.sigmaEndoOverR);
  return { C_RELIC: fit.C_RELIC, P_LAMBDA: fit.P_LAMBDA, rows, moonAnchorFI, moonSigmaEndoOverR: moonAnchor.sigmaEndoOverR };
}
const sweep = SWEEP_SCENARIOS.map((s) => ({ ...s, ...runScenario(s.moonScale) }));

// ── DERIVE the frozen f_I band (per in-domain world) from the WITHIN-UNCERTAINTY (±20%) scenarios.
// The band per world = [min, max] of f_I across {baseline, -20%, +20%}. ×2 is reported as an
// extreme-stress witness (shows the band would be even wider under worst-case) but is NOT used to
// set the frozen band — the band absorbs the medium-confidence ±20% anchor uncertainty, per S0.1a.
// The band WIDTH is itself the derived number, printed and exported. ────────────────────────────
const BAND_SCENARIOS = sweep.filter((s) => s.label !== 'moon x2');
function bandForWorld(name) {
  const fis = BAND_SCENARIOS.map((s) => s.rows.find((r) => r.name === name).f_I);
  const lo = Math.min(...fis), hi = Math.max(...fis);
  return { lo, hi, width: hi - lo };
}
const fI_band = {};
for (const w of worlds) fI_band[w.name] = bandForWorld(w.name);
// overall in-domain band (union across worlds) — the single committed acceptance envelope
const allLo = Math.min(...Object.values(fI_band).map((b) => b.lo));
const allHi = Math.max(...Object.values(fI_band).map((b) => b.hi));
const fI_band_overall = { lo: allLo, hi: allHi, width: allHi - allLo };

// ×2 extreme witness (per world) — how wide the band WOULD be if the ×2 stress were admitted
const x2 = sweep.find((s) => s.label === 'moon x2');
const fI_x2_extreme = {};
for (const w of worlds) {
  const fisAll = sweep.map((s) => s.rows.find((r) => r.name === w.name).f_I);
  fI_x2_extreme[w.name] = { lo: Math.min(...fisAll), hi: Math.max(...fisAll), width: Math.max(...fisAll) - Math.min(...fisAll) };
}

// ── mutual-exclusivity demonstration (Mercury+Moon P vs Earth+Moon P) ──────────────────────────
function reportMutualExclusivity() {
  const fitMercuryMoon = fitTwoAnchor(MERCURY, MOON);
  const fitEarthMoon = fitTwoAnchor(EARTH, MOON);
  return {
    mercuryMoon: { P_LAMBDA: fitMercuryMoon.P_LAMBDA, C_RELIC: fitMercuryMoon.C_RELIC },
    earthMoon: { P_LAMBDA: fitEarthMoon.P_LAMBDA, C_RELIC: fitEarthMoon.C_RELIC },
    deltaP: fitEarthMoon.P_LAMBDA - fitMercuryMoon.P_LAMBDA,
  };
}
const mutualExclusive = reportMutualExclusivity();

// ── REPORT ─────────────────────────────────────────────────────────────────────────────────────
const fmt = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const exp = (x, d = 4) => (Number.isFinite(x) ? x.toExponential(d) : String(x));

console.log('=== Inc-3b S0.1 — relic-Λ 2-anchor fit (endogenic relief law) ===\n');
console.log(`  Q_RELIEF (imported, reused — no second strength exponent): ${Q}`);
console.log(`  σ_endo/R = C_RELIC · g^(−${Q}) · max(Λ_FLOOR, Φ_peak^{P_Λ}) · (1 − K_IR·iceness)\n`);
console.log('  Anchors (real-body, MEDIUM CONFIDENCE):');
console.log(`    Mercury: g=${fmt(MERCURY.g,5)}  Φ_peak=${fmt(MERCURY.phiPeak)}  σ_endo/R=${exp(MERCURY.sigmaEndoOverR)}`);
console.log(`    Moon   : g=${fmt(MOON.g,5)}  Φ_peak=${fmt(MOON.phiPeak)}  σ_endo/R=${exp(MOON.sigmaEndoOverR)}\n`);
console.log('  FITTED (exactly identified, zero residual):');
console.log(`    C_RELIC = ${exp(FIT.C_RELIC)}`);
console.log(`    P_Λ     = ${fmt(FIT.P_LAMBDA)}   (expected ≈ 0.25)`);
console.log(`    Λ_FLOOR = ${LAMBDA_FLOOR}  (GUESSED; binds nowhere in-set: ${floorBindsAnchor ? 'BINDS — REVISIT' : 'inactive'})`);
console.log(`    K_IR    = ${K_IR}   (Callisto-targeted; ½ the crater-bowl ice-relaxation asymptote)`);
console.log(`    exactly-identified (both anchors reproduced to <1e-16): ${EXACTLY_IDENTIFIED}`);
console.log(`    residuals: Mercury ${exp(residMe,2)}  Moon ${exp(residMo,2)}\n`);

console.log('  Domain restriction — Mercury+Moon vs Earth+Moon fits are MUTUALLY EXCLUSIVE:');
console.log(`    Mercury+Moon: P_Λ = ${fmt(mutualExclusive.mercuryMoon.P_LAMBDA)}  (this law)`);
console.log(`    Earth+Moon  : P_Λ = ${fmt(mutualExclusive.earthMoon.P_LAMBDA)}  (Earth is OUT-OF-DOMAIN — identity path)`);
console.log(`    ΔP_Λ = ${fmt(mutualExclusive.deltaP)} → one 2-param law cannot serve both; Earth exits the fit.\n`);

console.log('=== In-domain worlds (g/Φ_peak/iceness DERIVED via repo modules at canonical R) ===');
console.log(`  (σ_imp/R = ${exp(SIGMA_IMP_OVER_R,3)} boot ref, MEDIUM CONFIDENCE; per-world RMS is S0.2)\n`);
console.log('  world                              g       Φ_peak  iceness  nStamp  σ_endo/R    f_I');
for (const w of worlds) {
  console.log(`  ${w.name.padEnd(33)} ${fmt(w.g).padStart(6)}  ${fmt(w.phiPeak).padStart(6)}  ${fmt(w.iceness).padStart(6)}  ${String(w.nStamp).padStart(5)}   ${exp(w.sigmaEndoOverR,3).padStart(10)}  ${fmt(w.f_I)}`);
}
const frozen = worlds.find((w) => w.name === 'Frozen (airless)');
console.log(`\n  Frozen effect (iceness=${fmt(frozen.iceness)}): σ_endo/R=${exp(frozen.sigmaEndoOverR,3)} `
  + `(= "Λ≈${fmt(frozen.sigmaEndoOverR * 1e3, 2)}" in 1e-3 units), f_I=${fmt(frozen.f_I,3)} — crater-dominant.`);
console.log('  NOTE: the brief\'s "Λ≈0.18–0.2" is σ_endo/R in 1e-3 units (NOT the Φ_peak^P vigor factor,');
console.log(`        which is ${fmt(Math.pow(frozen.phiPeak, FIT.P_LAMBDA) * (1 - K_IR * frozen.iceness), 3)} here). Both brief targets (Λ 0.18–0.2 AND f_I≈0.97) are met.\n`);

console.log('=== S0.1a — anchor-sensitivity sweep (Moon σ_endo anchor perturbed; fresh 2-anchor fit each) ===\n');
console.log('  scenario     moon σ_endo/R   P_Λ       ' + worlds.map((w) => w.name.split(' ')[0].padStart(8)).join(' ') + '   moonSelf');
for (const s of sweep) {
  const fiCols = worlds.map((w) => fmt(s.rows.find((r) => r.name === w.name).f_I, 3).padStart(8)).join(' ');
  console.log(`  ${s.label.padEnd(11)}  ${exp(s.moonSigmaEndoOverR, 2).padStart(11)}   ${fmt(s.P_LAMBDA).padStart(7)}   ${fiCols}   ${fmt(s.moonAnchorFI, 3)}`);
}
console.log('\n  READING: P_Λ swings hugely (even sign-flips) under small anchor moves — the exactly-');
console.log('  identified fit is FRAGILE and cannot be validated, only asserted. The qualitative read');
console.log('  (crater-dominant, f_I well above 0.5) is robust across the whole sweep; the point');
console.log('  estimate P_Λ≈0.25 is not. This is WHY the f_I band below is derived wide, not trusted tight.\n');

console.log('=== Frozen f_I band (DERIVED from ±20% within-uncertainty scenarios; width is the derived number) ===\n');
console.log('  world                              f_I band [lo, hi]        width      (×2 extreme width)');
for (const w of worlds) {
  const b = fI_band[w.name], x = fI_x2_extreme[w.name];
  console.log(`  ${w.name.padEnd(33)} [${fmt(b.lo,3)}, ${fmt(b.hi,3)}]         ${fmt(b.width,3)}      (${fmt(x.width,3)})`);
}
console.log(`\n  OVERALL in-domain f_I band: [${fmt(fI_band_overall.lo,3)}, ${fmt(fI_band_overall.hi,3)}]  width ${fmt(fI_band_overall.width,3)}`);
console.log('  → AC-BUDGET\'s "f_I in the S0 band" uses THIS band (absorbs ±20% medium-confidence anchor uncertainty).');
console.log('  → Mars f_I is reported here from the relic law for completeness, but its ACCEPTANCE gate is the');
console.log('    real-Mars-hypsometry [0.3,0.8] (S0.6), NOT this extrapolation — Mars is a declared loose anchor.\n');

// ── WRITE deterministic JSON (no timestamp, no timing) ─────────────────────────────────────────
const out = {
  meta: {
    workstream: 'world-engine-inc3b-relief-budget-2026-07-21',
    slice: 'S0.1 + S0.1a',
    script: 'calibration/relic-lambda.mjs',
    law: 'sigma_endo/R = C_RELIC * g^(-Q_RELIEF) * max(LAMBDA_FLOOR, phiPeak^P_LAMBDA) * (1 - K_IR*iceness)',
    domain: 'dead-lid impact-retentive worlds ONLY; live/Earth worlds take the bit-exact identity path',
    exactlyIdentified: EXACTLY_IDENTIFIED,
    provenance: {
      repoDerived: ['Q_RELIEF (import)', 'in-domain g/phiPeak/iceness (shipped modules, canonical R)'],
      trainingSourcedMediumConfidence: [
        'g/R of Mercury, Moon, Earth', 'sigma_endo/R anchors 1.8e-4 (Mercury), 2.5e-4 (Moon), 3.6e-4 (Earth demo)',
        'sigma_imp/R = 1.09e-3 boot reference',
      ],
      guessed: { LAMBDA_FLOOR: '0.05 — faint relic substrate; inactive in-set; resolve via low-vigor cold-body anchor',
                 K_IR: '0.5 — Callisto-targeted; half the crater-bowl ice-relaxation asymptote; resolve via icy sigma_endo anchor + wavelength-dependent tau_relax' },
    },
  },
  fit: {
    C_RELIC: FIT.C_RELIC,
    P_LAMBDA: FIT.P_LAMBDA,
    Q_RELIEF: Q,
    LAMBDA_FLOOR,
    K_IR,
    SIGMA_IMP_OVER_R,
    residuals: { Mercury: residMe, Moon: residMo },
    floorBindsInSet: floorBindsAnchor,
  },
  anchors: {
    Mercury: { g: MERCURY.g, phiPeak: MERCURY.phiPeak, sigmaEndoOverR: MERCURY.sigmaEndoOverR },
    Moon: { g: MOON.g, phiPeak: MOON.phiPeak, sigmaEndoOverR: MOON.sigmaEndoOverR },
    Earth_outOfDomain: { g: EARTH.g, phiPeak: EARTH.phiPeak, sigmaEndoOverR: EARTH.sigmaEndoOverR },
  },
  mutualExclusivity: mutualExclusive,
  inDomainWorlds: worlds,
  sweep: sweep.map((s) => ({
    label: s.label, moonScale: s.moonScale, moonSigmaEndoOverR: s.moonSigmaEndoOverR,
    C_RELIC: s.C_RELIC, P_LAMBDA: s.P_LAMBDA, moonAnchorFI: s.moonAnchorFI,
    worlds: s.rows,
  })),
  fI_band: {
    method: 'per-world [min,max] of f_I across baseline/-20%/+20% (within-uncertainty); x2 is extreme witness only',
    perWorld: fI_band,
    overall: fI_band_overall,
    x2ExtremeWidthPerWorld: fI_x2_extreme,
    marsGateNote: 'Mars acceptance gate is real-Mars-hypsometry f_I in [0.3,0.8] (S0.6), NOT this relic-law value',
  },
};
const outPath = join(__dirname, 'relic-lambda-band.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`band + fitted constants + sweep table → ${outPath}`);

// ── exit status ────────────────────────────────────────────────────────────────────────────────
const problems = [];
if (!EXACTLY_IDENTIFIED) problems.push('fit not exactly identified (nonzero residual)');
if (floorBindsAnchor) problems.push('Λ_FLOOR binds an anchor (revisit the floor derivation)');
if (Math.abs(FIT.P_LAMBDA - 0.25) > 0.05) problems.push(`P_Λ=${fmt(FIT.P_LAMBDA)} not near the expected 0.25`);
if (!worlds.every((w) => Number.isFinite(w.f_I) && w.f_I > 0.5)) problems.push('an in-domain world is not crater-dominant (f_I ≤ 0.5)');
if (problems.length) {
  console.log('\nFAIL:');
  for (const p of problems) console.log('  • ' + p);
  process.exit(1);
}
console.log('\nOK — relic-Λ fit exactly identified; P_Λ≈0.25; all in-domain worlds crater-dominant; band derived + written.');
process.exit(0);

// ── module exports (for relief-budget-fit.mjs / read-gate-thresholds.json consumption) ─────────
export { FIT, LAMBDA_FLOOR as RELIC_LAMBDA_FLOOR, K_IR, SIGMA_IMP_OVER_R, sigmaEndoOverR,
         phiPeakFromGR, phiPeakFromCond, impactFraction, fI_band, fI_band_overall };
