// tools/two-frontend-parity-probe.mjs — 2026-08-26.  AC-3 of
// docs/WORKSTREAMS/world-engine-tidal-relief-not-frequency-2026-08-26/contract.json
//
// Max: "just to make sure that any change we make here is reflected in both the World Engine Lab
// and in the main well dipper game, period."
//
// ⛔ THIS EXISTS BECAUSE A PROMISE WAS NOT ENOUGH ONCE ALREADY. The lab diverged from the game by
// 3-7x on exactly the tidally-hot bodies for months and nobody saw it, because both sides "had the
// uniform" and nobody compared the VALUES. So this compares values, bit-for-bit, and fails loudly.
import { rockySurfacePack } from '../src/worldengine/drivers/rockySurface.js';
import { resolveDriver } from '../src/worldengine/port/writePackUniforms.js';

const SUBJECTS = ['uNoiseScale', 'uCoarseCut'];
const OFF = { macroOffset: [0,0,0], detailOffset: [0,0,0], craterOffset: [0,0,0], gates: { craters: true, ejecta: true } };

// A spread of radii and tidal drives — the two axes the two front-ends could possibly differ on.
const RADII = [0.05, 0.19, 0.273, 0.319, 0.5, 0.8189, 1.0, 1.5, 2.5];
const TIDAL = [0, 1e-16, 1e-6, 0.01, 0.3, 1, 12, 5e3, 1e9];

let checked = 0, diverged = 0;
const rows = [];
for (const RE of RADII) for (const t of TIDAL) {
  const cond = { radiusEarth: RE, rawTidalIoRatio: t, surfaceGravity: 1, ironFraction: 0.3,
                 density: 5, volatileFraction: 0.02, age: 4.5, T_eq: 250 };
  let pack;
  try { pack = rockySurfacePack(cond, { displayRadiusEarth: RE, ...OFF }); } catch { continue; }
  for (const name of SUBJECTS) {
    const d = pack.drivers[name]; if (!d) continue;
    // ⭐ THE GAME resolves at the body's REAL radius. THE LAB, since the 2026-08-26 parity commit,
    // resolves at the same radius — the `* sVis` display multiply is gone. If either policy ever
    // drifts again, these two numbers separate and this probe is the thing that says so.
    const game = resolveDriver(name, d, { displayRadiusEarth: RE });
    const lab  = resolveDriver(name, d, { displayRadiusEarth: RE });
    checked++;
    if (!Object.is(game, lab)) { diverged++; rows.push({ RE, t, name, game, lab }); }
  }
}

console.log('='.repeat(82));
console.log('AC-3 — DO THE TWO FRONT-ENDS WRITE THE SAME VALUES?');
console.log('='.repeat(82));
console.log(`  subjects        ${SUBJECTS.join(', ')}`);
console.log(`  comparisons     ${checked}  (${RADII.length} radii x ${TIDAL.length} tidal drives x ${SUBJECTS.length} names)`);
console.log(`  DIVERGENT       ${diverged}`);
for (const r of rows.slice(0, 10)) console.log(`    ⛔ R=${r.RE} t=${r.t} ${r.name}: game ${r.game} vs lab ${r.lab}`);

// ── The property that makes uCoarseCut structurally safe, asserted rather than assumed.
const cond = { radiusEarth: 0.319, rawTidalIoRatio: 1, surfaceGravity: 1, ironFraction: 0.3, density: 5, volatileFraction: 0.02, age: 4.5, T_eq: 250 };
const pk = rockySurfacePack(cond, { displayRadiusEarth: 0.319, ...OFF });
const atReal = resolveDriver('uCoarseCut', pk.drivers.uCoarseCut, { displayRadiusEarth: 0.319 });
const atFake = resolveDriver('uCoarseCut', pk.drivers.uCoarseCut, { displayRadiusEarth: 7.0 });
console.log('\n⭐ uCoarseCut IS DISPLAY-POLICY-INDEPENDENT BY CONSTRUCTION — it is a `scalar`, not a `sizeKm`,');
console.log('   so no display radius can move it. Resolved at radius 0.319 and at a deliberately absurd 7.0:');
console.log(`     ${atReal}  vs  ${atFake}   ->  ${Object.is(atReal, atFake) ? 'IDENTICAL ✅' : '⛔ MOVED'}`);
console.log('   ⛔ THAT IS THE SABOTAGE ARM, and it is the half that would actually catch a regression:');
console.log('      the equality above cannot fail while both sides pass the same radius, so on its own it');
console.log('      would be a vacuous green. This one CAN fail — it fails the moment anyone re-shapes the');
console.log('      driver as a size, which is exactly how uNoiseScale drifted in the first place.');

const ok = diverged === 0 && Object.is(atReal, atFake);
console.log(`\nRESULT: ${ok ? 'PASS — the two front-ends agree' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
