// calibration/surface-material.mjs — World Engine V2-6 SLICE-3 (iceness material scalar, AC-ICENESS / §1E).
//
// PURPOSE (BUILD-PLAN §1E / Lens L7): print the 18-preset icenessOf table so the priors (DENS_ICE_HI/DENS_ROCK_LO,
// VOL_LO/VOL_HI/ICE_VOL_FLOOR, T_ICE_LO/T_ICE_HI) are pinned against real preset data BEFORE the AC-ICENESS test
// targets are trusted. The material answer to "Frozen reads rock-brown": a low mean density + a volatile budget +
// a cold surface make an icy material. Pure `node`, exits nonzero on a target miss.
//
// FINDINGS (2026-07-19): Frozen 0.370, Europa 1.000, Titan 0.844 read HIGH; Crystal 0.065 reads nonzero-LOW —
// its density (3.0) sits mid-ramp and its tiny volatile budget (0.02) pins the volatile term at the ICE_VOL_FLOOR
// (0.25), so no prior movement makes Crystal "high" without breaking Moon/Mars≈0 (Lens L7). Crystal's real
// Frozen-pairing driver is crystallizationPotential (S4), not iceness. Moon/Mercury, Mars, Rocky, Lava, Venus,
// Carbon and all gas/ice giants read 0 (high-density rock or a warm/gaseous surface).

import { icenessOf } from '../../../../src/worldengine/base/surfaceMaterial.js';
import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms } from '../../../../planet-lod-lab-core.js';

const condOf = (fp) => deriveConditionVector(fp, deriveUniforms(fp, 1.0), fp.radiusEarth);

console.log('=== V2-6 iceness table (icenessOf, 18-preset) ===');
console.log('preset                              density  vf     T_eq   iceness');
const ice = {};
for (const [name, fp] of Object.entries(DRIVER_PRESETS)) {
  const c = condOf(fp);
  const v = icenessOf(c);
  ice[name] = v;
  const d = fp.composition?.density ?? '-', vf = fp.composition?.volatileFraction ?? '-', T = fp.T_eq ?? '-';
  console.log(`${name.padEnd(35)} ${String(d).padStart(5)}  ${String(vf).padStart(5)}  ${String(T).padStart(5)}   ${v.toFixed(4)}`);
}

// ── L7 targets (BUILD-PLAN §1E) ──
const checks = [
  ['Frozen (airless)',              (v) => v > 0.3,            'HIGH'],
  ['Europa (icy moon)',             (v) => v > 0.9,            'HIGH'],
  ['Titan (methane seas)',          (v) => v > 0.3,            'HIGH'],
  ['Crystal (faceted)',             (v) => v > 0 && v < 0.15,  'nonzero-LOW'],
  ['Moon/Mercury (impact-airless)', (v) => v < 0.05,           '≈0'],
  ['Mars (arid rocky)',             (v) => v < 0.05,           '≈0'],
  ['Rocky (Earthlike)',             (v) => v < 0.05,           '≈0'],
];
console.log('\ntarget checks:');
let ok = true;
for (const [name, pred, label] of checks) {
  const v = ice[name] ?? NaN;
  const pass = pred(v);
  ok = ok && pass;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(35)} ${label.padEnd(12)} (${v.toFixed(4)})`);
}
console.log(ok ? '\nALL PASS — iceness priors pinned' : '\nFAIL — a target missed');
process.exit(ok ? 0 : 1);
