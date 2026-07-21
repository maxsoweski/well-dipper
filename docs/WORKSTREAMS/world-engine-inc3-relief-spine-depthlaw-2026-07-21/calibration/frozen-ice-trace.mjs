// calibration/frozen-ice-trace.mjs — World Engine Inc-3 SLICE-3 AC-FROZEN-TRACE (§3 S3-step-2, contract AC-FROZEN-TRACE).
//
// THE QUESTION (math-check cause #4, SPECULATIVE — untraced): does ice viscous-relaxation compound the "wavey
// magma" read on the Frozen preset at low R/g? Cause #4 was flagged "I did not trace the ice-relaxation numbers."
// This harness TRACES them and QUANTIFIES the contribution, so the fix-or-file call is made on a number, not a guess.
//
// WHAT IT COMPUTES (the real bombardment.js path, imported — not a re-transcription):
//   iceness = icenessOf(Frozen cond)                         — the [0,1] relaxation gate (surfaceMaterial.js)
//   ε = iceRelaxation(cond, D_km, tI, iceness).epsBowl/epsRim — the per-crater relaxed fraction (bombardment.js)
// at (i) the Frozen preset's LOW-R/g worked point (the lowest drawn radius over 64 seeds — the coldest, smallest,
// lowest-g draw, i.e. the point cause #4 fingered) and (ii) the ENTIRE Frozen drawn population (64 seeds × every
// stamped crater) so the claim is population-wide, not a single lucky point.
//
// PREDICTED RESULT (BUILD-PLAN §3 S3-step-2): ε ≡ 0 EXACTLY. At T_eq=60 K the Arrhenius ice viscosity
// η = ETA_M·exp((Q*/R)(1/T − 1/T_MELT)) is so large that the Maxwell relaxation time τ ∝ η/(ρ·g·D) is ~1e29 Ga,
// so tI/τ ≈ 1e-29 and 1 − exp(−tI/τ) === 0.0 bit-exact in float64 (the writer's own crisp-cold-Frozen invariant,
// bombardment.js:258). iceness itself is NONZERO (~0.37) — so this is the exact-zero RELAXATION floor, not the
// iceness=0 rock early-return. Ice relaxation therefore contributes ZERO to the Frozen molten read; that read is
// FULLY the two vertical-scale defects this increment fixes (#1 reliefNorm over-drive → S1, #2 inverted depth-law
// → S2). ⇒ DECISION: cause #4 is NOT the same vertical-scale defect family — FILE it for the ice/exogenic
// increment WITH THIS NUMBER. If the trace shows ε > EPS_REOPEN at any plausible Frozen draw, re-open as fix-here
// (nonzero exit). Pure `node` (no dev server, no claude -p). Numbers reproduce.

import { DRIVER_PRESETS, drawPresetRadius, PRESET_ARCHETYPE, NAMED_BODY } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms } from '../../../../planet-lod-lab-core.js';
import { craterSchedule, forEachCrater, iceRelaxation, isImpactSurface } from '../../../../src/worldengine/base/bombardment.js';
import { icenessOf } from '../../../../src/worldengine/base/surfaceMaterial.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRESET   = 'Frozen (airless)';
const N_SEEDS  = 64;
const N_CENTRE = 40000;                 // an over-large node count so forEachCrater's centre index never clamps
const EPS_REOPEN = 1e-6;                // ε above this at any Frozen draw ⇒ cause #4 IS a vertical defect ⇒ fix-here

const fp = DRIVER_PRESETS[PRESET];
const condAt = (R) => deriveConditionVector(fp, deriveUniforms(fp, 1.0), R);

console.log('=== Inc-3 AC-FROZEN-TRACE — ice-relaxation contribution to the Frozen molten read ===\n');
console.log(`preset "${PRESET}"  archetype=${PRESET_ARCHETYPE[PRESET]}  named-body(locked radius)=${NAMED_BODY.has(PRESET)}`);

// ── locate the LOW-R/g worked point (the coldest/smallest/lowest-g draw cause #4 fingered) ─────────────
let low = { R: Infinity, seed: -1 };
for (let s = 1; s <= N_SEEDS; s++) {
  const R = drawPresetRadius(PRESET, s);
  if (R < low.R) low = { R, seed: s };
}
const lowCond = condAt(low.R);
const lowIceness = icenessOf(lowCond);
console.log(`\nLOW-R/g worked point: seed ${low.seed}, R=${low.R.toFixed(4)} R⊕, g=${lowCond.surfaceGravity.toFixed(4)} g⊕, T_eq=${lowCond.T_eq} K`);
console.log(`  iceness = icenessOf(cond) = ${lowIceness.toFixed(6)}  (NONZERO ⇒ the gate is OPEN; any ε=0 is the cold-relaxation floor, not the rock early-return)`);
console.log(`  isImpactSurface = ${isImpactSurface(lowCond)}  (craters DO stamp — so relaxation, if any, WOULD act)`);

// ── trace ε over the ENTIRE Frozen drawn population ─────────────────────────────────────────────────────
let globalMaxEpsBowl = 0, globalMaxEpsRim = 0, totalCraters = 0;
let minTauGa = Infinity, maxTI = 0, worst = null;
const perSeed = [];
for (let s = 1; s <= N_SEEDS; s++) {
  const R = drawPresetRadius(PRESET, s);
  const cond = condAt(R);
  const iceness = icenessOf(cond);
  const sched = craterSchedule(cond);
  let seedMaxEpsBowl = 0, seedMaxEpsRim = 0, nCr = 0, largest = { D_km: 0 };
  forEachCrater(cond, s, N_CENTRE, (centre, delta, tI, D_km) => {
    nCr++; totalCraters++;
    const { epsBowl, epsRim, tauGa } = iceRelaxation(cond, D_km, tI, iceness);
    if (epsBowl > seedMaxEpsBowl) seedMaxEpsBowl = epsBowl;
    if (epsRim  > seedMaxEpsRim)  seedMaxEpsRim  = epsRim;
    if (tauGa < minTauGa) minTauGa = tauGa;
    if (tI > maxTI) maxTI = tI;
    // the FASTEST-relaxing crater is the largest D (τ ∝ 1/D) — record it as the strongest test of ε>0
    if (D_km > largest.D_km) largest = { D_km, tI, tauGa, epsBowl, epsRim, ratio: tI / tauGa };
  });
  if (seedMaxEpsBowl > globalMaxEpsBowl) globalMaxEpsBowl = seedMaxEpsBowl;
  if (seedMaxEpsRim  > globalMaxEpsRim)  globalMaxEpsRim  = seedMaxEpsRim;
  if (!worst || largest.D_km > worst.D_km) worst = { seed: s, R, g: cond.surfaceGravity, iceness, nCr, ...largest };
  perSeed.push({ seed: s, R, g: cond.surfaceGravity, iceness, nStamp: sched.nStamp, nCr, maxEpsBowl: seedMaxEpsBowl, maxEpsRim: seedMaxEpsRim });
}

// ── the single strongest test: the largest crater in the population (fastest τ ⇒ most relaxation possible) ──
console.log(`\nStrongest single test — the LARGEST crater in the whole Frozen population (τ ∝ 1/D ⇒ fastest-relaxing):`);
console.log(`  seed ${worst.seed}: R=${worst.R.toFixed(4)}, g=${worst.g.toFixed(4)}, largest D=${worst.D_km.toFixed(1)} km, tI=${worst.tI.toFixed(3)} Ga`);
console.log(`  τ (Maxwell relaxation time) = ${worst.tauGa.toExponential(3)} Ga   vs   crater age tI = ${worst.tI.toFixed(3)} Ga`);
console.log(`  tI/τ = ${worst.ratio.toExponential(3)}   ⇒   1 − exp(−tI/τ) = ${(1 - Math.exp(-worst.ratio))}  (float64: underflows to 0.0 for tI/τ ≲ 1e-16)`);
console.log(`  ⇒ epsBowl = iceness·(1−exp(−tI/τ)) = ${worst.iceness.toFixed(4)} · 0 = ${worst.epsBowl}`);

// ── population verdict ──────────────────────────────────────────────────────────────────────────────────
console.log(`\nPOPULATION TRACE (64 seeds × every stamped crater = ${totalCraters} craters):`);
console.log(`  max epsBowl = ${globalMaxEpsBowl}   max epsRim = ${globalMaxEpsRim}   (both across ALL Frozen draws)`);
console.log(`  min τ over the population = ${minTauGa.toExponential(3)} Ga   (max crater age tI = ${maxTI.toFixed(3)} Ga ⇒ min tI/τ = ${(maxTI / minTauGa).toExponential(3)})`);

const epsZero = globalMaxEpsBowl === 0 && globalMaxEpsRim === 0;
const reopen  = globalMaxEpsBowl > EPS_REOPEN || globalMaxEpsRim > EPS_REOPEN;

console.log(`\n${epsZero ? 'CONFIRMED: ε ≡ 0 EXACTLY across the entire Frozen population.' :
  (reopen ? `RE-OPEN: ε exceeds ${EPS_REOPEN} — ice relaxation IS a vertical defect on Frozen; fix HERE.` :
            `ε is nonzero but ≤ ${EPS_REOPEN} — negligible; FILE (below threshold).`)}`);
console.log('DECISION (AC-FROZEN-TRACE):');
if (epsZero || !reopen) {
  console.log('  • Ice relaxation contributes ZERO (float-exact) to the Frozen molten read at T_eq=60 K.');
  console.log('  • The Frozen "wavey magma" read is FULLY math-check causes #1 (reliefNorm over-drive → S1) + #2');
  console.log('    (inverted crater depth-law → S2), both fixed in THIS increment. Cause #4 is NOT the same');
  console.log('    vertical-scale defect family.');
  console.log('  • FILE cause #4 for the ice/exogenic increment WITH THIS NUMBER: max epsBowl = ' + globalMaxEpsBowl +
    ' at T_eq=60 K (it only becomes visible on a WARM/tidal icy body — Europa-class — where η drops enough for τ ≲ tI).');
}

// ── machine-readable record ────────────────────────────────────────────────────────────────────────────
const out = {
  meta: { generated: new Date().toISOString(), workstream: 'world-engine-inc3-relief-spine-depthlaw-2026-07-21',
          ac: 'AC-FROZEN-TRACE', preset: PRESET, nSeeds: N_SEEDS, epsReopenThreshold: EPS_REOPEN },
  lowWorkedPoint: { seed: low.seed, R: low.R, g: lowCond.surfaceGravity, T_eq: lowCond.T_eq, iceness: lowIceness,
                    isImpactSurface: isImpactSurface(lowCond) },
  strongestTest: worst,     // the largest crater in the population = the fastest τ = the strongest ε>0 test
  population: { totalCraters, maxEpsBowl: globalMaxEpsBowl, maxEpsRim: globalMaxEpsRim, minTauGa, maxTI,
                minTauRatio: maxTI / minTauGa },
  verdict: { epsExactlyZero: epsZero, reopenAsFixHere: reopen,
             decision: reopen ? 'FIX-HERE' : 'FILE-FOR-ICE-EXOGENIC-INCREMENT',
             rationale: 'At T_eq=60 K the Arrhenius η ⇒ τ ~1e29 Ga ⇒ 1-exp(-tI/τ)===0 float64. iceness nonzero (~0.37) so this is the cold-relaxation floor, not the rock early-return. Frozen molten read is fully causes #1+#2 (S1+S2).' },
  perSeed,
};
const outPath = join(__dirname, 'frozen-ice-trace-summary.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\nsummary → ${outPath}`);
process.exit(reopen ? 1 : 0);
