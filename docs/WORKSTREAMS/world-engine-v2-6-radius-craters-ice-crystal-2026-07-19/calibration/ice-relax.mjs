// calibration/ice-relax.mjs — World Engine V2-6 SLICE-3 (Arrhenius ice relaxation, AC-RELAX / §1D).
//
// PURPOSE (BUILD-PLAN §1D / footnote 4): print the per-crater relaxation fraction ε over a (T_eq, td, D) grid and
// confirm the four required properties BEFORE the AC-RELAX test constants are trusted:
//   (1) crisp-cold: ε(60 K, td≈0) === 0 exactly (η so large that t/τ < 1e-16 ⇒ 1−exp(−x) === 0.0 in float64);
//   (2) warm/tidal (Enceladus-class): ε large;
//   (3) ∂ε/∂D > 0 (τ ∝ 1/D — a larger crater relaxes faster);
//   (4) the dome-floor term (+A·DOME_FRAC at a fully-relaxed centre) + the P_RIM=2 rim-persistence term (rim τ =
//       100·bowl τ) are present. Pure `node`, exits nonzero on a property miss.
//
// FINDINGS (2026-07-19): the relaxation is a sharp switch in TEMPERATURE (η is exponential in 1/T) — a surface is
// either crisp (ε≈0) or heavily relaxed (ε→iceness); the ε∈(0,1) sensitive band sits near T_rel≈150–160 K where
// τ ~ the exposed age. The DOME_FRAC=0.3 prior gives a +A·0.3 domed floor; P_RIM=2 gives rim τ = 100·bowl τ.

import {
  iceRelaxation, relaxedCraterProfile, craterProfile, craterAmplitude, DOME_FRAC, P_RIM,
} from '../../../../src/worldengine/base/bombardment.js';
import { icenessOf } from '../../../../src/worldengine/base/surfaceMaterial.js';

const g = 0.13;                 // icy-moon-class surface gravity (Earth-relative)
const ICY = 1.0;                // fully-icy material (Europa-class)
const tI = 4.0;                 // exposed age (Ga)

console.log('=== V2-6 ice relaxation ε grid (iceness=1, g=0.13, tI=4.0 Ga) ===');
console.log('T_eq  td     D=1km   D=5km   D=20km  D=50km  (epsBowl)');
for (const [T_eq, td] of [[60, 0], [110, 0], [150, 0], [155, 0], [110, 50], [200, 5]]) {
  const cond = { T_eq, rawTidalIoRatio: td, surfaceGravity: g };
  const row = [1, 5, 20, 50].map((D) => iceRelaxation(cond, D, tI, ICY).epsBowl.toFixed(4).padStart(6));
  console.log(`${String(T_eq).padStart(4)}  ${String(td).padStart(3)}   ${row.join('  ')}`);
}

// ── property checks ──
let ok = true;
const assert = (label, cond) => { ok = ok && cond; console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); };
console.log('\nproperty checks:');

// (1) crisp-cold: ε === 0 exactly + relaxed profile bit-identical to un-relaxed.
const coldIce = icenessOf({ composition: { density: 2.5, volatileFraction: 0.3 }, T_eq: 60 });
const cold = iceRelaxation({ T_eq: 60, rawTidalIoRatio: 0, surfaceGravity: g }, 5, 4.5, coldIce);
let bitId = true;
for (const D of [0.06, 0.5, 1.0]) for (let k = 0; k <= 40; k++) {
  const s = (k / 40) * (1.5 * D);
  if (relaxedCraterProfile(s, D, 0, 0) !== craterProfile(s, D)) bitId = false;
}
assert(`crisp-cold ε(60 K)===0 exactly (bowl=${cold.epsBowl}, rim=${cold.epsRim}) AND profile bit-identical (${bitId})`,
  cold.epsBowl === 0 && cold.epsRim === 0 && bitId && coldIce > 0);

// (2) warm/tidal Enceladus-class: ε large.
const warm = iceRelaxation({ T_eq: 100, rawTidalIoRatio: 50, surfaceGravity: g }, 50, tI, ICY);
assert(`warm/tidal ε large (${warm.epsBowl.toFixed(3)} > 0.5)`, warm.epsBowl > 0.5);

// (3) ∂ε/∂D > 0.
const sens = { T_eq: 155, rawTidalIoRatio: 0, surfaceGravity: g };
const dsweep = [1, 3, 10, 30].map((D) => iceRelaxation(sens, D, tI, ICY).epsBowl);
let mono = true; for (let i = 1; i < dsweep.length; i++) if (!(dsweep[i] > dsweep[i - 1])) mono = false;
assert(`∂ε/∂D > 0 (${dsweep.map((e) => e.toFixed(3)).join(' → ')})`, mono);

// (4) dome + P_RIM=2.
const A = craterAmplitude(0.5);
const dome = relaxedCraterProfile(0, 0.5, 1, 0);
const r = iceRelaxation(sens, 10, tI, ICY);
assert(`dome term = +A·DOME_FRAC=${(A * DOME_FRAC).toFixed(4)} at fully-relaxed centre (got ${dome.toFixed(4)})`,
  Math.abs(dome - A * DOME_FRAC) < 1e-9 && dome > 0);
assert(`P_RIM=2 ⇒ rim τ = 100·bowl τ (${(r.tauRimGa / r.tauGa).toFixed(3)}), rim ε < bowl ε`,
  P_RIM === 2 && Math.abs(r.tauRimGa / r.tauGa - 100) < 1e-3 && r.epsRim < r.epsBowl);

console.log(ok ? '\nALL PASS — ice relaxation properties confirmed' : '\nFAIL — a property missed');
process.exit(ok ? 0 : 1);
