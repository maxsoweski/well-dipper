// calibration/crystal-scalar.mjs — World Engine V2-6 SLICE-4 DECISION ARTIFACT (Crystal carve-out; §1F / Lens L9).
//
// PURPOSE: this is NOT a pass/fail calibrator — it is the ADJUDICATION ARTIFACT Max reads in the morning report.
// It prints the 18-preset table with the OLD BOOLEAN column (the lab `_facetClass` predicate: airless && erosion
// < 0.05 && resurfacingRate < 0.05 && bombardmentIntensity < 0.2, read off the STIPULATED surfaceHistory data)
// beside the DERIVED crystallizationPotential column (the honest condition-scalar + craterSchedule derivation),
// with the flips highlighted.
//
// THE CONTRADICTION (BUILD-PLAN §1F / Lens L9): the presets are condition-scalar DEGENERATE where the old boolean
// discriminated. The new count law N ∝ R²·chronN(age) makes Crystal (R 0.8) the MOST-impacted airless world, so
// the honest (1−bombardmentIntensity) term drives Crystal's derived potential BELOW Moon/Frozen — inverting the
// old-boolean ranking (Crystal was the SOLE boolean-TRUE). Carbon (not an impact surface at T_eq 600 ⇒ zero
// bombardment) derives ≈max while boolean-FALSE. No condition scalar repairs the split (T_eq / density /
// volatileFraction all fail the Moon/Mercury/Frozen/Carbon split). This makes the AC-CRYSTAL extreme-agreement
// clause mathematically unsatisfiable ⇒ `deferred-to-adjudication`; S4 pins NO CRYSTAL_HI/LO thresholds and does
// NOT flip the lab `_facetClass` wiring (which would kill Crystal's facets live). Options recorded in BUILD-PLAN
// §1F (a: restate as an ordering/threshold claim; b: a physically-motivated discriminating term — none found;
// c: amend Crystal's canonical data — ABORT-adjacent under FENCE 1/2).
//
// Exit 0 always (a decision artifact, not a gate). It DOES assert the documented contradiction still holds and
// prints a loud VERDICT line if it ever changes, so the artifact stays falsifiable.

import {
  crystallizationPotential, airlessnessOf, resurfacingRateOf, bombardmentIntensityOf, erosionOf, N_BOMB_REF,
} from '../../../../src/worldengine/base/surfaceMaterial.js';
import { craterSchedule } from '../../../../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';

const condOf = (fp) => deriveConditionVector(fp, deriveUniforms(fp, 1.0), fp.radiusEarth);

// The OLD lab `_facetClass` boolean — read off the STIPULATED surfaceHistory data (world-engine-lab.html).
function oldBoolean(fp) {
  const sh = fp.surfaceHistory ?? {};
  const airless = !fp.atmosphere;
  return airless
    && (sh.erosion ?? 0) < 0.05
    && (sh.resurfacingRate ?? 0) < 0.05
    && (sh.bombardmentIntensity ?? 0) < 0.2;
}

console.log('=== V2-6 Crystal decision artifact — old boolean vs derived crystallizationPotential (N_BOMB_REF=' + N_BOMB_REF.toExponential(1) + ') ===\n');
console.log('preset                              oldBool  airless  erosion  resurf  bombInt   nAnalytic   DERIVED');
const rows = [];
for (const [name, fp] of Object.entries(DRIVER_PRESETS)) {
  const c = condOf(fp);
  const sched = craterSchedule(c);
  const ob = oldBoolean(fp);
  const air = airlessnessOf(c), ero = erosionOf(c), res = resurfacingRateOf(c), bmb = bombardmentIntensityOf(sched);
  const der = crystallizationPotential(c, sched);
  rows.push({ name, ob, der, nA: sched.nAnalytic });
  console.log(
    `${name.padEnd(35)} ${(ob ? ' TRUE ' : 'false').padStart(6)}  ` +
    `${air.toFixed(3).padStart(6)}  ${ero.toFixed(3).padStart(6)}  ${res.toFixed(3).padStart(5)}  ` +
    `${bmb.toFixed(3).padStart(6)}  ${sched.nAnalytic.toExponential(2).padStart(9)}  ${der.toFixed(3).padStart(6)}`,
  );
}

// ── flips: an old-TRUE preset that derives LOW, or an old-FALSE preset that OUT-derives the sole old-TRUE one ──
const crystalRow = rows.find((r) => r.name.startsWith('Crystal'));
console.log('\n── FLIPS (old boolean vs honest derivation) ──');
console.log(`  Crystal (sole old-TRUE) derived = ${crystalRow.der.toFixed(3)}`);
const outRanking = rows.filter((r) => !r.ob && r.der > crystalRow.der).sort((a, b) => b.der - a.der);
for (const r of outRanking) {
  console.log(`  FLIP-UP   ${r.name.padEnd(35)} old=false  derived=${r.der.toFixed(3)}  (> Crystal's ${crystalRow.der.toFixed(3)})`);
}
console.log(`  FLIP-DOWN Crystal (faceted)                old=TRUE   derived=${crystalRow.der.toFixed(3)}  (below ${outRanking.length} boolean-false presets)`);

// ── falsifiable verdict: the contradiction is that Crystal (old-TRUE) derives below Moon & Frozen, and Carbon
//    (old-false) derives high. If this ever stops holding, the degeneracy was resolved — print it loudly. ────────
const der = (frag) => rows.find((r) => r.name.startsWith(frag)).der;
const inverts = crystalRow.der < der('Moon/Mercury') && crystalRow.der < der('Frozen');
const carbonHigh = der('Carbon') > crystalRow.der;
console.log('\n── VERDICT ──');
if (inverts && carbonHigh) {
  console.log('  DEGENERACY CONFIRMED — Crystal derives below Moon/Mercury AND Frozen; Carbon derives above Crystal.');
  console.log('  Extreme-agreement with the old boolean is mathematically unsatisfiable (clamp01 preserves the');
  console.log('  count-law ranking for EVERY N_BOMB_REF). AC-CRYSTAL extreme clause = deferred-to-adjudication.');
  console.log('  Lab _facetClass wiring UNCHANGED this build (a flip would turn Crystal\'s facets OFF live).');
} else {
  console.log('  ⚠ CONTRADICTION CHANGED — the degeneracy no longer holds as documented. Re-open the adjudication:');
  console.log(`     Crystal below Moon&Frozen: ${inverts} ; Carbon above Crystal: ${carbonHigh}`);
}
console.log('\n  Adjudication options (BUILD-PLAN §1F): (a) restate extreme agreement as an ordering/threshold claim');
console.log('  the derived scalars can satisfy [recommended]; (b) add a physically-motivated discriminating term');
console.log('  [none found]; (c) amend Crystal\'s canonical data [ABORT-adjacent under FENCE 1/2 — not recommended].');
process.exit(0);
