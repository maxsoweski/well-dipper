// tools/deck-spiral-calibrate.mjs — Phase-A (headless) measure-first calibration of the dSpiral static
// log-spiral roll-up (BUILD-PLAN world-engine-atmo-deck-spiral-rhines-2026-07-19 §5.4). Precedent:
// tools/atmo-expression-calibrate.mjs. Sweeps SWEEP_SEEDS × {Jovian, Saturnian, Neptunian}, imports the
// band-flow.js BAND_SPIRAL mirror + estimators, and prints CANDIDATE constants + the reads the live
// AC-SPIRAL gate is keyed to:
//   • wrap_visible = W·Δln(rr+EPS)/2π across the ANN_IN→ANN_OUT_HI annulus (F9 — the ON-SCREEN turn count
//     the radial read counts, NOT the vacuous ring cycle). WRAP is set against THIS, not W itself.
//   • displacement amplitude distribution (bounded by AMP·R·(1+SCAL)·ink — F-env).
//   • the combined |dWake + dSpiral| MERIDIONAL envelope vs the band half-period π/uBandM across the
//     population (F17): where the two constructively interfere age-dependently past π/uBandM, the wrap read
//     aliases into a band jump — flag any corner (esp. the m≈15 gas corner) that exceeds it.
// It writes NO source. NOT a test. `node tools/deck-spiral-calibrate.mjs`.
import {
  E5_REGIME, DRIVER_BUNDLES, resolveParams,
} from '../src/worldengine/base/climate-e5.js';
import {
  drawGiantConditions, deriveGiantDrivers, canonicalGiantCondition, SWEEP_SEEDS,
} from '../src/worldengine/base/giant-drivers.js';
import { resolveStormE } from '../src/worldengine/base/storm-e.js';
import {
  BAND_SPIRAL, SPIRAL_NB, spiralWrapProfile, spiralDisplacement, spiralMeridional, stormBandDrag,
} from '../src/worldengine/base/band-flow.js';

const REGIMES = [E5_REGIME.GAS_GIANT, E5_REGIME.SATURNIAN, E5_REGIME.NEPTUNIAN];
const stat = (xs) => {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
  return { min: Math.min(...xs), max: Math.max(...xs), mean };
};
const f3 = (x) => x.toFixed(3);
const f4 = (x) => x.toFixed(4);

// per-seed lab-path P (derived D-slots + bundle rotationRate/radius — the giant-drivers-calibrate idiom)
function seedP(regime, seed) {
  const bundle = DRIVER_BUNDLES[regime];
  const d = deriveGiantDrivers(drawGiantConditions(regime, canonicalGiantCondition(regime), seed));
  const drv = { ...d, rotationRate: bundle.rotationRate, radius: bundle.radius };
  return { P: resolveParams(regime, drv, seed), drv };
}

console.log('DECK-SPIRAL CALIBRATION (Phase-A headless)  seeds:', SWEEP_SEEDS.join(','));
console.log('CANDIDATE BAND_SPIRAL:', JSON.stringify(BAND_SPIRAL), ' SPIRAL_NB =', SPIRAL_NB, '\n');

// ── 1. wrap_visible = W·Δln(rr+EPS)/2π across the annulus (the radial-read turn count, F9) ─────────────
console.log('── 1. wrap_visible over rr ∈ [ANN_IN, ANN_OUT_HI] = [' + BAND_SPIRAL.ANN_IN + ', ' + BAND_SPIRAL.ANN_OUT_HI + ']  (age from the resolved primary) ──');
const allWrap = [];
for (const regime of REGIMES) {
  const wv = [], ages = [];
  for (const seed of SWEEP_SEEDS) {
    const { P, drv } = seedP(regime, seed);
    const rec = resolveStormE(regime, { ...drv, composition: 'h2-he' }, seed, 1234);
    if (!rec.primary) continue;
    const prof = spiralWrapProfile(rec.primary, P, { ink: 1 });
    wv.push(prof.wrapVisibleOver(BAND_SPIRAL.ANN_IN, BAND_SPIRAL.ANN_OUT_HI));
    ages.push(rec.primary.ageScalar);
    allWrap.push(wv[wv.length - 1]);
  }
  if (wv.length) {
    const s = stat(wv), sa = stat(ages);
    console.log(`  ${regime.padEnd(10)} wrap_visible [${f3(s.min)},${f3(s.max)}] turns mean=${f3(s.mean)}  (ageScalar [${f3(sa.min)},${f3(sa.max)}])`);
  }
}
const AW = stat(allWrap);
console.log(`  GLOBAL wrap_visible [${f3(AW.min)},${f3(AW.max)}] turns  (≈0.54 at WRAP ${BAND_SPIRAL.WRAP}, age 1: ${f3(BAND_SPIRAL.WRAP * (Math.log(BAND_SPIRAL.ANN_OUT_HI + BAND_SPIRAL.EPS) - Math.log(BAND_SPIRAL.ANN_IN + BAND_SPIRAL.EPS)) / (2 * Math.PI))})\n`);

// ── 2. displacement amplitude distribution (bound AMP·R·(1+SCAL)·ink — F-env) ─────────────────────────
console.log('── 2. |dSpiral| amplitude over the annulus (ink=1) ──');
for (const regime of REGIMES) {
  const amp = [], bnd = [];
  for (const seed of SWEEP_SEEDS) {
    const { P, drv } = seedP(regime, seed);
    const rec = resolveStormE(regime, { ...drv, composition: 'h2-he' }, seed, 1234);
    if (!rec.primary) continue;
    const prof = spiralWrapProfile(rec.primary, P, { ink: 1 });
    let mx = 0;
    for (let rr = BAND_SPIRAL.ANN_IN; rr <= BAND_SPIRAL.ANN_OUT_HI; rr += 0.05)
      for (let t = 0; t < 2 * Math.PI; t += Math.PI / 24) mx = Math.max(mx, prof.magAt(rr, t));
    amp.push(mx);
    bnd.push(BAND_SPIRAL.AMP * prof.R * (1 + BAND_SPIRAL.SCAL));
  }
  if (amp.length) {
    const s = stat(amp), sb = stat(bnd);
    console.log(`  ${regime.padEnd(10)} max|disp| [${f4(s.min)},${f4(s.max)}]  bound AMP·R·(1+SCAL) [${f4(sb.min)},${f4(sb.max)}]  (within ? ${s.max <= sb.max + 1e-9})`);
  }
}
console.log('');

// ── 3. combined dWake+dSpiral meridional envelope vs the band half-period π/uBandM (superposition, F17) ─
console.log('── 3. combined |dWake + dSpiral| meridional vs π/uBandM  (band-jump aliasing flag) ──');
let flagged = 0;
for (const regime of REGIMES) {
  const ratios = [];
  for (const seed of SWEEP_SEEDS) {
    const { P, drv } = seedP(regime, seed);
    const rec = resolveStormE(regime, { ...drv, composition: 'h2-he' }, seed, 1234);
    if (!rec.primary) continue;
    const prof = spiralWrapProfile(rec.primary, P, { ink: 1 });
    const half = Math.PI / Math.max(P.m, 1);
    let mx = 0;
    // sample the shared annulus overlap of dWake's bow + dSpiral's collar (rr 1.05..2.0, F17)
    for (let rr = 1.05; rr <= 2.0; rr += 0.05) for (let t = 0; t < 2 * Math.PI; t += Math.PI / 24) {
      const dir = prof.dirAt(rr, t);
      const comb = Math.abs(stormBandDrag(dir, [rec.primary], P, { ink: 1 }) + spiralMeridional(dir, [rec.primary], P, { ink: 1 }));
      mx = Math.max(mx, comb);
    }
    const ratio = mx / half;
    ratios.push(ratio);
    if (ratio > 1) { flagged++; console.log(`    FLAG ${regime}/${seed}: combined |dLat| ${f4(mx)} > π/uBandM ${f4(half)} (m=${P.m}) — band-jump aliasing risk`); }
  }
  if (ratios.length) { const s = stat(ratios); console.log(`  ${regime.padEnd(10)} combined/half-period [${f3(s.min)},${f3(s.max)}] mean=${f3(s.mean)}  (m-span reads honest S1 counts)`); }
}
console.log(`\n  ${flagged === 0 ? 'NO corners exceed π/uBandM — candidates SAFE at Phase-A' : flagged + ' corner(s) flagged — shrink WRAP/AMP at Phase-A before the live freeze'}`);
console.log('\n(constants above are CANDIDATES — the amplitude freeze belongs to the orchestrating session\'s live A/B read-gate, BUILD-PLAN §5.4 Phase B)');
