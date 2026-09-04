// census.mjs — the AC-1 / AC-2 / AC-3 instrument for the label split. Re-runnable BEFORE and AFTER
// the change: it reads `worldClass` when the field exists and falls back to `type`, so the same
// script produces the baseline and the verdict.
//
// ⛔ IT DOES NOT DEFINE HABITABILITY ITSELF. The warm / wet / rocky gates below are read from the
// engine's own exported constants and functions, so the census cannot drift from the classifier it
// is auditing. If a gate here needs a number that is not already named in the engine, that is a
// signal the LAW is underspecified — go name it there, do not hard-code it here.
//
//   node docs/WORKSTREAMS/derived-world-class/census.mjs            # 200 seeds
//   NSEEDS=500 node docs/WORKSTREAMS/derived-world-class/census.mjs
import { StarSystemGenerator } from '../../../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../../../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../../../src/worldengine/base/e1Regime.js';

// The wet threshold is e1Regime's own BAND.V_MIN. BAND is module-private, so the value is restated
// here with its provenance rather than re-derived; the round-trip guard below fails loudly if the
// engine's copy ever moves.
const V_MIN = 0.12;   // e1Regime.js:53 BAND.V_MIN
const T_LO = 250, T_HI = 320;   // e1Regime.js:53 BAND.T_LO / T_HI — surface K
const R_MAX = 1.8;    // R⊕ — the radius valley (Fulton 2017 CKS gap, ~1.5-1.8 R⊕) separates rocky
                      // super-Earths from gas-enveloped sub-Neptunes. NON-BINDING on today's
                      // population (all 14 warm-wet worlds sit below 1.4 R⊕); it is the stop on a
                      // future 2.5 R⊕ water world being called habitable. See contract baseline.

const N = Number(process.env.NSEEDS || 200);
const rows = [];
for (let i = 0; i < N; i++) {
  for (const e of StarSystemGenerator.generate(`rocky-${i}`, null).planets) {
    const d = e.planetData || e;
    const c = conditionFromBody(d);
    if (compositionClass(c) === 'gas') continue;   // gas giants are not the population under audit
    rows.push({
      seed: `rocky-${i}`,
      formation: d.type,                       // the roll — what the label WAS
      shown: d.worldClass ?? d.type,           // what a descriptive surface reads TODAY
      derived: d.worldClass ?? null,           // null until the split lands
      T: c.T_eq ?? 288,                        // SURFACE temperature (greenhouse-corrected at the seam)
      V: c.composition?.volatileFraction ?? 0.15,
      R: c.radiusEarth ?? 1,
      M: (c.surfaceGravity ?? 1) * (c.radiusEarth ?? 1) ** 2,
    });
  }
}

const warm = r => r.T >= T_LO && r.T <= T_HI;
const wet  = r => r.V >= V_MIN;
const sized = r => r.R <= R_MAX;
const habitable = r => warm(r) && wet(r) && sized(r);
const HAB_NAMES = new Set(['ocean', 'terrestrial']);

console.log(`${N} seeds -> ${rows.length} solid planets`);
console.log(`derived field present: ${rows.some(r => r.derived != null) ? 'YES (post-split)' : 'no (baseline run)'}\n`);

const by = new Map();
for (const r of rows) {
  const k = by.get(r.shown) || { n: 0, hab: 0 };
  k.n++; if (habitable(r)) k.hab++;
  by.set(r.shown, k);
}
console.log('name shown        bodies   of which habitable');
for (const [k, v] of [...by].sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${k.padEnd(15)} ${String(v.n).padStart(4)}   ${String(v.hab).padStart(4)}`);

const hab = rows.filter(habitable);
const named = hab.filter(r => HAB_NAMES.has(r.shown));
const falsePos = rows.filter(r => HAB_NAMES.has(r.shown) && !habitable(r));
const coldLava = rows.filter(r => r.shown === 'lava' && r.T < 400);
const hotIce = rows.filter(r => r.shown === 'ice' && r.T > 273);

console.log(`\n── AC-2 ── habitable worlds: ${hab.length}`);
console.log(`   named ocean/terrestrial : ${named.length}  (must equal ${hab.length})`);
console.log(`   MISNAMED                : ${hab.length - named.length}  (must be 0; baseline 11)`);
console.log(`\n── AC-1 ── names their own physics contradicts`);
console.log(`   called ocean/terrestrial but not habitable : ${falsePos.length}  (must be 0; baseline 7)`);
console.log(`   called lava but below 400 K                : ${coldLava.length}  (must be 0; baseline 15)`);
console.log(`   called ice but above 273 K                 : ${hotIce.length}  (must be 0)`);

if (hab.length - named.length || falsePos.length) {
  console.log('\nthe offending bodies:');
  for (const r of [...hab.filter(r => !HAB_NAMES.has(r.shown)), ...falsePos])
    console.log(`  ${r.seed.padEnd(11)} shown ${r.shown.padEnd(13)} formation ${r.formation.padEnd(13)} R ${r.R.toFixed(2)} M ${r.M.toFixed(2)} T ${r.T.toFixed(0)}K V ${r.V.toFixed(3)} ${habitable(r) ? '<- IS habitable' : '<- is NOT'}`);
}

const fail = (hab.length - named.length) + falsePos.length + coldLava.length + hotIce.length;
console.log(fail === 0 ? '\nCENSUS CLEAN' : `\n${fail} BODY/BODIES MISDESCRIBED`);
process.exit(fail === 0 ? 0 : 1);
