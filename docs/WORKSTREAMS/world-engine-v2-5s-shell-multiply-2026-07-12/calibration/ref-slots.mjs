// V2-5s calibration #1 — REF-SLOTS. Prints FULL-PRECISION values of every slot the
// shellDriversToTune builder will read for the LIVE Europa/Titan/Eyeball bundles, and
// verifies the derivation EXPRESSIONS (dd#2: massGravity as mass/R²; tidal via the ioRef
// formula the plates EARTH_TIDAL_HEATING pattern uses) are BYTE-EXACT vs deriveUniforms.
// Run FROM REPO ROOT:  node docs/WORKSTREAMS/world-engine-v2-5s-shell-multiply-2026-07-12/calibration/ref-slots.mjs
import { DRIVER_PRESETS } from '/home/ax/projects/well-dipper/driver-presets.js';
import { buildNeutralBodyDrivers } from '/home/ax/projects/well-dipper/body-drivers.js';
import { deriveConditionVector } from '/home/ax/projects/well-dipper/body-condition-vector.js';
import { deriveUniforms } from '/home/ax/projects/well-dipper/planet-lod-lab-core.js';

const PRESETS = {
  'icy-active': 'Europa (icy moon)',
  'volatile-cold': 'Titan (methane seas)',
  'eyeball-despun': 'Eyeball (locked temperate)',
};

// the ioRef normalizer — VERBATIM from planet-lod-lab-core.js:526 / plates.js:100
const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);

// candidate derivation expressions (what the frozen SHELL_REFS literals will encode)
function massGravityExpr(fp) { return fp.massEarth / (fp.radiusEarth * fp.radiusEarth); }
function tidalExpr(fp) {
  const { eccentricity: ecc, starMassEarth: star, radiusEarth: R, orbitRadiusEarth: orbit } = fp;
  return orbit > 0 ? (ecc * ecc * star * star * Math.pow(R, 5) / Math.pow(orbit, 5)) / ioRef : 0;
}

const REPR = (x) => (Object.is(x, -0) ? '0' : String(x));
let allExact = true;
for (const [regime, name] of Object.entries(PRESETS)) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  const live = { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) };

  // live slots the builder will READ
  const liveG = live.massGravity, liveVF = live.volatileFraction, liveTidal = live.tidalHeating, liveT = live.condition.T_eq;
  // candidate derivation-expression values
  const exprG = massGravityExpr(fp), exprTidal = tidalExpr(fp);

  const gExact = Object.is(liveG, exprG);
  const tidalExact = Object.is(liveTidal, exprTidal);
  const uGExact = Object.is(liveG, u.surfaceGravity);
  const uTidalExact = Object.is(liveTidal, u.tidalHeat);
  if (!gExact || !tidalExact || !uGExact || !uTidalExact) allExact = false;

  console.log(`\n=== ${regime}  (${name}) ===`);
  console.log(`  fp: massEarth=${fp.massEarth} radiusEarth=${fp.radiusEarth} ecc=${fp.eccentricity} orbitR=${fp.orbitRadiusEarth} star=${fp.starMassEarth} vf=${fp.composition.volatileFraction} T_eq=${fp.T_eq}`);
  console.log(`  massGravity   live=${REPR(liveG)}`);
  console.log(`                expr ${fp.massEarth}/(${fp.radiusEarth}*${fp.radiusEarth}) = ${REPR(exprG)}   exact=${gExact}  (==u.surfaceGravity: ${uGExact})`);
  console.log(`  volatileFrac  live=${REPR(liveVF)}   (literal ${fp.composition.volatileFraction})`);
  console.log(`  tidalHeating  live=${REPR(liveTidal)}`);
  console.log(`                expr (ecc²·star²·R⁵/orbit⁵)/ioRef = ${REPR(exprTidal)}   exact=${tidalExact}  (==u.tidalHeat: ${uTidalExact})`);
  console.log(`  condition.T_eq live=${REPR(liveT)}   (literal ${fp.T_eq})`);
  console.log(`  [seed-stability] condition.radiusEarth=${REPR(live.condition.radiusEarth)}  <-- MUST NOT be read by the builder`);
  console.log(`  thermalState (live)=${REPR(live.thermalState)}  (undefined => not read by shell builder)`);
}
console.log(`\nioRef = ${REPR(ioRef)}`);
console.log(`\nALL derivation-expressions byte-exact vs live/deriveUniforms: ${allExact}`);
