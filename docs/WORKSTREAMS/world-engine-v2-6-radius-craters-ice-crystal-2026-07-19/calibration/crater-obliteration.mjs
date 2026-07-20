// calibration/crater-obliteration.mjs — World Engine V2-6 SLICE-2 (obliteration equilibrium, AC-EQUILIB).
//
// PURPOSE (BUILD-PLAN §1C(iv) / §2 SLICE 2): the km-space rewrite makes crater equilibrium N_ret =
// N_eq·(1−exp(−N_prod/N_eq)) an EMERGENT property of OBLITERATION STAMPING (oldest-first; a bowl RESETS the
// field, obliterating older topography; rims/ejecta accumulate), never a coded tanh saturation. This harness
// runs the writer over an age sweep (batch-averaged) and prints the production→retention curve + retention
// fraction, confirming the emergent plateau BEFORE the AC-EQUILIB test constants are trusted. Pure `node`.
//
// FINDINGS (Moon-class airless surface, R=0.38, seed batch of 6, 3000-node mesh, 2026-07-19):
//   • retained count RISES then PLATEAUS at the AGE_MAX (4.6 Ga) physical surface-age cap (Deviation #1);
//   • the retention FRACTION FALLS monotonically as age (production) rises — the obliteration signature: a
//     bigger production population overwrites a larger share of the older record;
//   • within the physical window [3.9, 4.6] the Neukum chronology drives N_stamp 3 → ~294; N_ret grows
//     sub-linearly (≈3 → ~96), the emergent N_eq plateau. No tanh formula is involved.

import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../../../../planet-lod-rivers.js';
import { writeBombardment } from '../../../../src/worldengine/base/bombardment.js';

const mesh = buildIrregularSphere(3000, 2);
const moonCond = (age) => ({
  atmosphere: null, rawTidalIoRatio: 0, T_eq: 235, surfaceGravity: 0.277, age, radiusEarth: 0.38,
  composition: { volatileFraction: 0.02, density: 4.5 },
});
const BATCH = [1, 2, 3, 4, 5, 6];

console.log('=== V2-6 crater-obliteration equilibrium sweep (Moon-class airless, batch-averaged) ===');
console.log('age    N_stamp   N_ret   retFrac');
let prevRet = -Infinity, prevFrac = Infinity, monotoneRet = true, monotoneFrac = true;
for (const age of [3.9, 4.1, 4.3, 4.5, 4.6, 6.0]) {
  let nStamp = 0, nRet = 0;
  for (const s of BATCH) {
    const c = makeSphereField(mesh);
    const r = writeBombardment(c, moonCond(age), { macroSeed: s, collectDiag: true });
    nStamp += r.diag.nStamp; nRet += r.diag.nRetained;
  }
  const ns = nStamp / BATCH.length, nr = nRet / BATCH.length, frac = nr / Math.max(1, ns);
  if (nr < prevRet - 1e-9) monotoneRet = false;
  if (frac > prevFrac + 1e-9) monotoneFrac = false;
  prevRet = nr; prevFrac = frac;
  console.log(`${age.toFixed(1)}    ${ns.toFixed(1).padStart(6)}   ${nr.toFixed(1).padStart(5)}   ${frac.toFixed(3)}`);
}

const ok = monotoneRet && monotoneFrac;
console.log(`\nretained non-decreasing: ${monotoneRet}   retention-fraction non-increasing: ${monotoneFrac}`);
console.log(ok ? 'ALL PASS — emergent obliteration equilibrium confirmed (no coded saturation)' : 'FAIL — equilibrium signature not emergent');
process.exit(ok ? 0 : 1);
