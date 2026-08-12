// docs/WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/calibration/assoc-null.mjs
// World Engine V2-4 slice-4 (history-tied province) — ASSOCIATION spatial-NULL calibration (BUILD-PLAN §6.3).
//
// THE LOAD-BEARING honesty calibration (folds lens B#2). A naive label-shuffle null is WRONG here: shuffling
// destroys contiguity, so its η² collapses to chance, and BOTH the real province AND a contiguous
// position-noise control tower over it — so the noise control would falsely PASS. The correct null is a
// CONTIGUITY-PRESERVING ENSEMBLE of position-noise partitions (spatialNullPartition) matched to the real
// province's region count + patch size. This probe PRINTS, per preset×seed:
//   • the REAL province η² (mean over populated history fields);
//   • the spatial-null distribution: mean + the 99th-percentile PASS LINE (NPERM=200 blob-scale partitions);
//   • a sample position-noise CONTROL η² (one more null draw) — which must sit INSIDE the null (REJECTED);
//   • the decision: real > p99 (PASS) and control ≤ p99 (REJECTED).
// The pass line is an OBSERVED number, not assumed. Presets whose real province does NOT clear its spatial
// null are SURFACED here (and by the test) as findings — the thresholds are re-tuned (§6.2), the null is
// never weakened.
//
// METERED-SAFE: pure `node`, no `claude -p`.  Run:  node docs/WORKSTREAMS/.../calibration/assoc-null.mjs
import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../../../../planet-lod-rivers.js';
import { assessProvinceAssociation, OROGEN_CUT, BASIN_CUT, PROVINCE_RELAX_PASSES } from '../../../../src/worldengine/base/province.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../../../../driver-presets.js';
import { buildNeutralBodyDrivers } from '../../../../body-drivers.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';
import { QUALITY_TIER } from '../../../../tests/fixtures/v2-0-carrier-golden.mjs';

const N = 3000;
const NPERM = 200;
const SEEDS = [1, 2, 3, 7, 42];
const PRESETS = ['Rocky (Earthlike)', 'Ocean (temperate)', 'Mars (arid rocky)', 'Venus (sulfuric shroud)', 'Europa (icy moon)'];
const MESH = buildIrregularSphere(N, 2);

function bundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null,
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + (seed | 0),
    T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
  };
}

const out = [];
const p = (s) => out.push(s);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('  V2-4 slice-4 PROVINCE ASSOCIATION spatial-NULL calibration  (assoc-null.mjs — BUILD-PLAN §6.3)');
p(`  mesh N=${N}   NPERM=${NPERM}   cuts OROGEN=${OROGEN_CUT} BASIN=${BASIN_CUT} RELAX=${PROVINCE_RELAX_PASSES}`);
p('  null = contiguity-preserving position-noise partitions (NOT a label shuffle); pass line = real > null p99');
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('   preset                     seed   realη²   nullMean  null p99   ctrlη²    PASS?  ctrlREJECTED?  comps');

const worstMargin = {};
for (const name of PRESETS) {
  let allPass = true, allRej = true, minMargin = Infinity;
  for (const s of SEEDS) {
    const carrier = makeSphereField(MESH);
    writeBodyRelief(carrier, bundle(name, s));
    const fields = [carrier.faultDensity, carrier.grainMag, carrier.accommodation];
    const r = assessProvinceAssociation(carrier.province, MESH, fields, { NPERM, seed: s });
    const pass = r.pass, rej = r.controlRejected;
    allPass = allPass && pass; allRej = allRej && rej;
    minMargin = Math.min(minMargin, r.realEta2 - r.nullP99);
    p(`   ${name.padEnd(26)} ${String(s).padStart(3)}   ${r.realEta2.toFixed(4)}   ${r.nullMean.toFixed(4)}   ${r.nullP99.toFixed(4)}   ${r.controlEta2.toFixed(4)}   ${pass ? ' Y ' : ' n '}      ${rej ? ' Y ' : ' n '}        ${r.components}`);
  }
  worstMargin[name] = { allPass, allRej, minMargin };
}
p('');
p('── VERDICT per preset (real must PASS the spatial null on every seed; control must be REJECTED) ──');
for (const name of PRESETS) {
  const w = worstMargin[name];
  p(`   ${name.padEnd(26)} realPass=${w.allPass ? 'ALL' : 'SOME-FAIL'}  ctrlRejected=${w.allRej ? 'ALL' : 'SOME-FAIL'}  worst(real−p99)=${w.minMargin.toFixed(4)}`);
}
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
process.stdout.write(out.join('\n') + '\n');
