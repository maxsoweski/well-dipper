// docs/WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/calibration/province-thresholds.mjs
// World Engine V2-4 slice-4 (history-tied province) — THRESHOLD calibration probe (BUILD-PLAN §6.2).
//
// PURPOSE: the craton/orogen/basin cuts are computed from each field's LIVE rank distribution (percentile-
// based, per path — because grainMag is DEGENERATE on the plate path, §4). This probe drives the REAL
// writers on the deterministic test mesh (buildIrregularSphere + makeSphereField, via writeBodyRelief so
// height→accommodation→faultDensity/grainMag are the real finished fields), then for a grid of candidate
// (OROGEN_CUT, BASIN_CUT, PROVINCE_RELAX_PASSES) prints, per preset×seed:
//   • the live field non-degeneracy (which of faultDensity/grainMag/accommodation carry signal per path);
//   • the resulting class proportions (craton/orogen/basin);
//   • the association η² (mean over populated fields) + the contiguity metric + connected-component count.
// The BAKED constants are chosen to give legible, associating, contiguous regions across seeds.
//
// METERED-SAFE: pure `node`, no `claude -p`.  Run:  node docs/WORKSTREAMS/.../calibration/province-thresholds.mjs
import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../../../../planet-lod-rivers.js';
import { deriveProvinceLabels, provinceAssociation, provinceStats, classProportions } from '../../../../src/worldengine/base/province.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../../../../driver-presets.js';
import { buildNeutralBodyDrivers } from '../../../../body-drivers.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';
import { QUALITY_TIER } from '../../../../tests/fixtures/v2-0-carrier-golden.mjs';

const N = 3000;
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
function build(name, seed) {
  const carrier = makeSphereField(MESH);
  const relief = writeBodyRelief(carrier, bundle(name, seed));
  return { carrier, path: relief.path };
}
const nondeg = (f) => { let mn = Infinity, mx = -Infinity; for (let i = 0; i < f.length; i++) { if (f[i] < mn) mn = f[i]; if (f[i] > mx) mx = f[i]; } return mx > mn; };

const out = [];
const p = (s) => out.push(s);
p('══════════════════════════════════════════════════════════════════════════════════════════');
p('  V2-4 slice-4 PROVINCE THRESHOLD calibration  (province-thresholds.mjs — BUILD-PLAN §6.2)');
p(`  mesh N=${N}   seeds ${SEEDS.join(',')}`);
p('══════════════════════════════════════════════════════════════════════════════════════════');

// ── per-path field non-degeneracy (which fields carry signal) ──
p('');
p('── live field non-degeneracy per path (faultDensity / grainMag / accommodation) ──');
for (const name of PRESETS) {
  const { carrier, path } = build(name, 1);
  const fd = nondeg(carrier.faultDensity), gm = nondeg(carrier.grainMag), ac = nondeg(carrier.accommodation);
  p(`  ${name.padEnd(26)} path=${path.padEnd(13)} faultDensity:${fd ? 'Y' : '·'} grainMag:${gm ? 'Y' : '·'} accommodation:${ac ? 'Y' : '·'}`);
}

// ── candidate grid: proportions + η² + contiguity + components ──
const OROGEN_CUTS = [0.82, 0.86, 0.90];
const BASIN_CUTS = [0.68, 0.72, 0.78];
const RELAX = [0, 2, 3, 4];
p('');
p('── candidate (orogenCut, basinCut, relaxPasses) — Rocky (Earthlike), mean over seeds ──');
p('   cuts        relax  craton/orogen/basin        η²      contig  comps');
for (const oc of OROGEN_CUTS) for (const bc of BASIN_CUTS) for (const rp of RELAX) {
  let pc = [0, 0, 0], eta = 0, contig = 0, comps = 0;
  for (const s of SEEDS) {
    const { carrier } = build('Rocky (Earthlike)', s);
    const fields = { faultDensity: carrier.faultDensity, grainMag: carrier.grainMag, accommodation: carrier.accommodation };
    const labels = deriveProvinceLabels(fields, MESH.adj, carrier.N, { orogenCut: oc, basinCut: bc, relaxPasses: rp });
    const cp = classProportions(labels, carrier.N);
    pc = pc.map((v, i) => v + cp[i] / SEEDS.length);
    eta += provinceAssociation(labels, [carrier.faultDensity, carrier.grainMag, carrier.accommodation]) / SEEDS.length;
    const st = provinceStats(labels, MESH.adj, carrier.N);
    contig += st.contiguity / SEEDS.length; comps += st.components / SEEDS.length;
  }
  p(`   ${oc.toFixed(2)},${bc.toFixed(2)}   ${String(rp).padStart(2)}    ${pc.map((v) => v.toFixed(2)).join(' / ')}          ${eta.toFixed(4)}  ${contig.toFixed(3)}  ${comps.toFixed(0)}`);
}

// ── chosen constants applied across ALL presets (proportions + η² + contiguity) ──
const OC = 0.86, BC = 0.72, RP = 3;
p('');
p(`── CHOSEN constants OROGEN_CUT=${OC} BASIN_CUT=${BC} PROVINCE_RELAX_PASSES=${RP} across presets (mean over seeds) ──`);
p('   preset                      path          craton/orogen/basin        η²      contig  comps');
for (const name of PRESETS) {
  let pc = [0, 0, 0], eta = 0, contig = 0, comps = 0, path = '';
  for (const s of SEEDS) {
    const { carrier, path: pth } = build(name, s); path = pth;
    const fields = { faultDensity: carrier.faultDensity, grainMag: carrier.grainMag, accommodation: carrier.accommodation };
    const labels = deriveProvinceLabels(fields, MESH.adj, carrier.N, { orogenCut: OC, basinCut: BC, relaxPasses: RP });
    const cp = classProportions(labels, carrier.N);
    pc = pc.map((v, i) => v + cp[i] / SEEDS.length);
    eta += provinceAssociation(labels, [carrier.faultDensity, carrier.grainMag, carrier.accommodation]) / SEEDS.length;
    const st = provinceStats(labels, MESH.adj, carrier.N);
    contig += st.contiguity / SEEDS.length; comps += st.components / SEEDS.length;
  }
  p(`   ${name.padEnd(27)} ${path.padEnd(13)} ${pc.map((v) => v.toFixed(2)).join(' / ')}          ${eta.toFixed(4)}  ${contig.toFixed(3)}  ${comps.toFixed(0)}`);
}
p('══════════════════════════════════════════════════════════════════════════════════════════');
process.stdout.write(out.join('\n') + '\n');
