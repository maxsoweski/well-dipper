// tools/atmo-expression-calibrate.mjs — Phase-A (headless) measure-first calibration of the atmo-expression
// render terms (BUILD-PLAN world-engine-atmo-expression-2026-07-17 §6.0 Phase A). Precedent:
// tools/giant-drivers-calibrate.mjs. Sweeps SWEEP_SEEDS × {Jovian, Saturnian, Neptunian, Sub-Neptune},
// imports the band-flow.js CPU mirrors + resolveParams, and prints CANDIDATE constants + the AC assertion
// bands they pin:
//   • bandProxy↔aBand parity max-error (target < 1e-3 — the linchpin; if it fails, STOP / re-scope)
//   • AC-ADVECT anisotropy L_east/L_north distribution + isotropic null (~1.0) + peak |dLat|/|dBand| floor
//   • wake reach (R multiple past 2.6R) + near-storm bow peak (band-width fraction — perceptual floor)
//   • belt-CENTER vs zone-CENTER roughness split + uBandRough per-seed spread
//   • boldness: peak dLat in band-widths at uAtmoInk=1 (bold) and its ×0.5 tame-down
// It writes NO source. NOT a test. `node tools/atmo-expression-calibrate.mjs`.
import {
  E5_REGIME, DRIVER_BUNDLES, resolveParams, jetProfile, jetShearPeak, bakeClimateE5Attributes,
} from '../src/worldengine/base/climate-e5.js';
import {
  drawGiantConditions, deriveGiantDrivers, canonicalGiantCondition, SWEEP_SEEDS,
} from '../src/worldengine/base/giant-drivers.js';
import { resolveStormE } from '../src/worldengine/base/storm-e.js';
import {
  BAND_FLOW, BAND_FLOW_DEFAULTS, bandProxy, advectAnisotropyRatio, bandRoughness,
  bandRoughnessCenters, drawBandRoughness, wakeReachProfile,
} from '../src/worldengine/base/band-flow.js';

const REGIMES = [E5_REGIME.GAS_GIANT, E5_REGIME.SATURNIAN, E5_REGIME.NEPTUNIAN, E5_REGIME.SUB_NEPTUNE];
const stat = (xs) => {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { min: Math.min(...xs), max: Math.max(...xs), mean, sd };
};
const setSize = (xs) => new Set(xs.map((x) => +x.toFixed(9))).size;
const f3 = (x) => x.toFixed(3);
const f4 = (x) => x.toFixed(4);

// Resolve the per-seed lab-path P (derived D-slots + bundle rotationRate/radius — the giant-drivers-calibrate
// idiom), plus the gas-deck drivers for the storm resolve.
function seedP(regime, seed) {
  const bundle = DRIVER_BUNDLES[regime];
  const base = canonicalGiantCondition(regime);
  const d = deriveGiantDrivers(drawGiantConditions(regime, base, seed));
  const drv = { ...d, rotationRate: bundle.rotationRate, radius: bundle.radius };
  return { P: resolveParams(regime, drv, seed), drv };
}

console.log('ATMO-EXPRESSION CALIBRATION (Phase-A headless)  seeds:', SWEEP_SEEDS.join(','));
console.log('CANDIDATE constants:', JSON.stringify(BAND_FLOW), '\ndefaults:', JSON.stringify(BAND_FLOW_DEFAULTS), '\n');

// ── 1. bandProxy ↔ aBand parity (the linchpin) ───────────────────────────────────────────────────────
console.log('── 1. bandProxy ↔ aBand parity (target max < 1e-3) ──');
let parityMax = 0;
const LAT_SWEEP = 401;
for (const regime of REGIMES) {
  let regMax = 0;
  for (const seed of SWEEP_SEEDS) {
    const { P, drv } = seedP(regime, seed);
    // sample aBand via the real bake path at lon=0, radius=1 (positions[..y]/1 = sin lat)
    const pos = new Float32Array(LAT_SWEEP * 3);
    const latOf = (i) => (-0.5 + i / (LAT_SWEEP - 1)) * Math.PI * 0.999;
    for (let i = 0; i < LAT_SWEEP; i++) { const lat = latOf(i); pos[3 * i] = Math.cos(lat); pos[3 * i + 1] = Math.sin(lat); pos[3 * i + 2] = 0; }
    const { aBand } = bakeClimateE5Attributes(pos, LAT_SWEEP, 1, { regime, drivers: drv, macroSeed: seed });
    for (let i = 0; i < LAT_SWEEP; i++) {
      const e = Math.abs(bandProxy(latOf(i), P) - aBand[i]);
      if (e > regMax) regMax = e;
    }
  }
  if (regMax > parityMax) parityMax = regMax;
  console.log(`  ${regime.padEnd(11)} max|proxy−aBand| = ${regMax.toExponential(3)}`);
}
console.log(`  GLOBAL parity max = ${parityMax.toExponential(3)}   (< 1e-3 ? ${parityMax < 1e-3})\n`);

// ── 2. AC-ADVECT anisotropy L_east/L_north + isotropic null + perceptual floor ───────────────────────
console.log('── 2. AC-ADVECT anisotropy (stretch=' + BAND_FLOW_DEFAULTS.uInkStretch + ', ink=1) ──');
const ratios = [], nullRatios = [], peakDLatBW = [], peakDBand = [];
for (const regime of REGIMES) {
  const rr = [], nr = [], pl = [], pb = [];
  for (const seed of SWEEP_SEEDS) {
    const { P } = seedP(regime, seed);
    const a = advectAnisotropyRatio(P, { stretch: BAND_FLOW_DEFAULTS.uInkStretch, ink: 1 });
    const nul = advectAnisotropyRatio(P, { stretch: 1, ink: 1 });
    rr.push(a.ratio); nr.push(nul.ratio); pl.push(a.peakDLatBandWidths); pb.push(a.peakDBand);
    ratios.push(a.ratio); nullRatios.push(nul.ratio); peakDLatBW.push(a.peakDLatBandWidths); peakDBand.push(a.peakDBand);
  }
  const s = stat(rr), sn = stat(nr);
  console.log(`  ${regime.padEnd(11)} ratio [${f3(s.min)},${f3(s.max)}] mean=${f3(s.mean)}  null [${f3(sn.min)},${f3(sn.max)}]  peak|dLat|=${f3(stat(pl).min)}–${f3(stat(pl).max)} bw  peak|dBand|=${f3(stat(pb).min)}–${f3(stat(pb).max)}`);
}
const R = stat(ratios), N = stat(nullRatios), PL = stat(peakDLatBW), PB = stat(peakDBand);
console.log(`  GLOBAL ratio [${f3(R.min)},${f3(R.max)}] mean=${f3(R.mean)}  |  isotropic null [${f3(N.min)},${f3(N.max)}] mean=${f3(N.mean)}`);
console.log(`  GLOBAL peak|dLat| [${f3(PL.min)},${f3(PL.max)}] band-widths  |  peak|dBand| [${f3(PB.min)},${f3(PB.max)}]`);
console.log(`  → PIN AC-ADVECT ratio band ≈ [${f3(R.min * 0.9)}, ${f3(R.max * 1.1)}]  (null max ${f3(N.max)} clearly below ${f3(R.min * 0.9)} ? ${N.max < R.min * 0.9})`);
console.log(`  → PIN peak|dLat| floor ≈ ${f3(PL.min * 0.85)} band-widths ; peak|dBand| floor ≈ ${f3(PB.min * 0.85)}\n`);

// ── 3. Wake reach + near-storm bow amplitude ─────────────────────────────────────────────────────────
console.log('── 3. Wake reach + bow (stormBandDrag on the resolved primary; ink=1) ──');
const bowBW = [], reachR = [];
for (const regime of REGIMES) {
  if (regime === E5_REGIME.HOT_JUPITER) continue;
  const bb = [], rc = [];
  for (const seed of SWEEP_SEEDS) {
    const { P, drv } = seedP(regime, seed);
    const rec = resolveStormE(regime, { ...drv, composition: 'h2-he' }, seed, 1234);
    if (!rec.primary) continue;
    const w = wakeReachProfile(rec.primary, P, { ink: 1 });
    bb.push(w.bowPeakBandWidths); rc.push(w.reachDsR);
    bowBW.push(w.bowPeakBandWidths); reachR.push(w.reachDsR);
  }
  if (bb.length) console.log(`  ${regime.padEnd(11)} bow peak [${f3(stat(bb).min)},${f3(stat(bb).max)}] bw  wake reach [${f3(stat(rc).min)},${f3(stat(rc).max)}] ds/R`);
}
const JB = stat(bowBW.filter((_, i) => i < SWEEP_SEEDS.length));   // Jovian-only bow (AC-INTERACT regime)
const BB = stat(bowBW), RC = stat(reachR);
console.log(`  GLOBAL bow peak [${f3(BB.min)},${f3(BB.max)}] band-widths  |  wake reach [${f3(RC.min)},${f3(RC.max)}] ds/R (past 2.6R ? ${RC.min > 2.6})`);
console.log(`  JOVIAN bow peak [${f3(JB.min)},${f3(JB.max)}] band-widths (AC-INTERACT regime; floor ≥0.25 ? ${JB.min >= 0.25})`);
console.log(`  → PIN wake sanity: assert |dLat| at ds/R=3 > threshold (reach min ${f3(RC.min)} ds/R > 2.6 ? ${RC.min > 2.6}) ; Jovian bow floor ${f3(JB.min * 0.9)} band-widths (live px-confirm)\n`);

// ── 4. Jaggedness belt-CENTER vs zone-CENTER split + uBandRough spread ───────────────────────────────
console.log('── 4. AC-JAG belt-CENTER/zone-CENTER roughness split + uBandRough per-seed spread ──');
const jagRatios = [];
for (const regime of REGIMES) {
  const jr = [], ub = [];
  for (const seed of SWEEP_SEEDS) {
    const { P } = seedP(regime, seed);
    const uBandRough = drawBandRoughness(regime, seed);
    ub.push(uBandRough);
    const c = bandRoughnessCenters(P, { uBandRough });
    jr.push(c.ratio); jagRatios.push(c.ratio);
  }
  const s = stat(jr), su = stat(ub);
  console.log(`  ${regime.padEnd(11)} belt/zone ratio [${f3(s.min)},${f3(s.max)}] mean=${f3(s.mean)}  uBandRough [${f3(su.min)},${f3(su.max)}] setSize=${setSize(ub)}/${SWEEP_SEEDS.length} (≥⌈0.75N⌉=${Math.ceil(0.75 * SWEEP_SEEDS.length)} ? ${setSize(ub) >= Math.ceil(0.75 * SWEEP_SEEDS.length)})`);
}
const JR = stat(jagRatios);
console.log(`  GLOBAL belt/zone ratio [${f3(JR.min)},${f3(JR.max)}]`);
console.log(`  → PIN AC-JAG ratio floor ≈ ${f3(JR.min * 0.85)}  (assert belt/zone > this on every seed)\n`);

// ── 5. Boldness — peak dLat in band-widths at uAtmoInk ∈ {0.5, 1.0, 1.5} ──────────────────────────────
console.log('── 5. Boldness (peak dLat band-widths across ink dials) ──');
for (const ink of [0.5, 1.0, 1.5]) {
  const pk = [];
  for (const regime of REGIMES) for (const seed of SWEEP_SEEDS) {
    const { P } = seedP(regime, seed);
    pk.push(advectAnisotropyRatio(P, { stretch: BAND_FLOW_DEFAULTS.uInkStretch, ink }).peakDLatBandWidths);
  }
  const s = stat(pk);
  console.log(`  uAtmoInk=${ink}  peak dLat [${f3(s.min)},${f3(s.max)}] band-widths mean=${f3(s.mean)}`);
}
console.log('\n(constants above are CANDIDATES — frozen at working-Claude\'s live A/B read-gate, BUILD-PLAN §6.0 Phase B)');
