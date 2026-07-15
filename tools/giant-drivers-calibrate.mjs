// tools/giant-drivers-calibrate.mjs — measure-first calibration of the D-slot deriver.
// Runs the pinned 12-seed sweep per regime, reports internalHeat/shellDepthFrac/dissipation stats,
// uPeak spread, bandCount set, eqSign set, and checks vs the ratified DERIVE-FORMS ranges + Rhines
// boundaries. NOT a test; a calibration tool. `node tools/giant-drivers-calibrate.mjs`.
import { E5_REGIME, DRIVER_BUNDLES, amplitudeLaw, rhinesWavenumber, equatorialJetSign, resolveParams, PHYS } from '../src/worldengine/base/climate-e5.js';
import { resolveStormPlacement } from '../src/worldengine/base/storm-e.js';
import { drawGiantConditions, deriveGiantDrivers, canonicalGiantCondition, SWEEP_SEEDS, GIANT_EXP, GIANT_DRAW } from '../src/worldengine/base/giant-drivers.js';

const RANGES = {
  [E5_REGIME.GAS_GIANT]:   { IH: [1.47, 1.87], SDF: [0.74, 0.86], DIS: [0.85, 1.15] },
  [E5_REGIME.SATURNIAN]:   { IH: [1.57, 1.99], SDF: [0.85, 0.95], DIS: [0.72, 0.98] },
  [E5_REGIME.NEPTUNIAN]:   { IH: [2.29, 2.91], SDF: [0.09, 0.21], DIS: [0.13, 0.17] },
  [E5_REGIME.SUB_NEPTUNE]: { IH: [1.01, 1.29], SDF: [0.28, 0.44], DIS: [0.47, 0.63] },
  [E5_REGIME.HOT_JUPITER]: { IH: [1.76, 2.24], SDF: [0.80, 0.90], DIS: [1.02, 1.38] },
};

const stat = (xs) => {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { min: Math.min(...xs), max: Math.max(...xs), mean, sd };
};
const setSize = (xs) => new Set(xs.map((x) => (typeof x === 'number' ? +x.toFixed(9) : x))).size;

console.log('EXP', JSON.stringify(GIANT_EXP), 'DRAW', JSON.stringify(GIANT_DRAW), '\nSEEDS', SWEEP_SEEDS.join(','), '\n');

for (const regime of Object.values(E5_REGIME)) {
  const bundle = DRIVER_BUNDLES[regime];
  const base = canonicalGiantCondition(regime);         // lab base ≈ canonical (fresh deriveConditionVector)
  const rot = bundle.rotationRate, rad = bundle.radius;
  const frozenUPeak = amplitudeLaw(bundle.internalHeat, bundle.dissipation, bundle.shellDepthFrac);
  const frozenN = rhinesWavenumber(rot, rad, frozenUPeak);

  const IH = [], SDF = [], DIS = [], UP = [], BC = [], EQ = [], LAT = [];
  let derivedNeFrozen = 0;
  for (const s of SWEEP_SEEDS) {
    const cond = drawGiantConditions(regime, base, s);
    const d = deriveGiantDrivers(cond);
    IH.push(d.internalHeat); SDF.push(d.shellDepthFrac); DIS.push(d.dissipation);
    const up = amplitudeLaw(d.internalHeat, d.dissipation, d.shellDepthFrac);
    UP.push(up);
    BC.push(rhinesWavenumber(rot, rad, up));
    EQ.push(Math.sign(equatorialJetSign(d.shellDepthFrac)) || 1);
    if (Math.abs(up - frozenUPeak) > 1e-9) derivedNeFrozen++;
  }
  const R = RANGES[regime];
  // exact ±12%/±15% clamp bounds (the ratified table values are the ROUNDED display of these)
  const IHclamp = [bundle.internalHeat * 0.88, bundle.internalHeat * 1.12];
  const DISclamp = [bundle.dissipation * 0.85, bundle.dissipation * 1.15];
  const inRange = (xs, lohi) => xs.every((x) => x >= lohi[0] - 1e-9 && x <= lohi[1] + 1e-9);
  R.IH = IHclamp; R.DIS = DISclamp;
  const sIH = stat(IH), sSDF = stat(SDF), sDIS = stat(DIS), sUP = stat(UP);
  const upRange = R.SDF ? null : null;
  console.log(`── ${regime} ── canonical bundle IH=${bundle.internalHeat} SDF=${bundle.shellDepthFrac} DIS=${bundle.dissipation} | frozen uPeak=${frozenUPeak.toFixed(4)} n=${frozenN}`);
  console.log(`  IH  [${sIH.min.toFixed(3)},${sIH.max.toFixed(3)}] sd=${sIH.sd.toFixed(4)} inRange=${inRange(IH, R.IH)}  (ratified ${R.IH})`);
  console.log(`  SDF [${sSDF.min.toFixed(3)},${sSDF.max.toFixed(3)}] sd=${sSDF.sd.toFixed(4)} inRange=${inRange(SDF, R.SDF)}  (ratified ${R.SDF})`);
  console.log(`  DIS [${sDIS.min.toFixed(3)},${sDIS.max.toFixed(3)}] sd=${sDIS.sd.toFixed(4)} inRange=${inRange(DIS, R.DIS)}  (ratified ${R.DIS})`);
  console.log(`  uPeak [${sUP.min.toFixed(3)},${sUP.max.toFixed(3)}] sd=${sUP.sd.toFixed(4)} setSize=${setSize(UP)}/${SWEEP_SEEDS.length}`);
  console.log(`  bandCount set={${[...new Set(BC)].sort((a,b)=>a-b).join(',')}} (size ${setSize(BC)})   eqSign set={${[...new Set(EQ)].join(',')}}`);
  console.log(`  D1 uPeak setSize ${setSize(UP)} >= ceil(0.75*12)=9 ? ${setSize(UP) >= 9}   D5 derived!=frozen ${derivedNeFrozen}/12 >= 9 ? ${derivedNeFrozen >= 9}`);
  console.log('');
}

// D3 anchor exactness
console.log('── D3 anchor exactness (canonical ⇒ bundle) ──');
for (const regime of Object.values(E5_REGIME)) {
  const b = DRIVER_BUNDLES[regime];
  const d = deriveGiantDrivers(canonicalGiantCondition(regime));
  const ok = Math.abs(d.internalHeat - b.internalHeat) < 1e-9 && Math.abs(d.shellDepthFrac - b.shellDepthFrac) < 1e-9 && Math.abs(d.dissipation - b.dissipation) < 1e-9;
  console.log(`  ${regime}: derived ${d.internalHeat.toFixed(6)}/${d.shellDepthFrac.toFixed(6)}/${d.dissipation.toFixed(6)}  bundle ${b.internalHeat}/${b.shellDepthFrac}/${b.dissipation}  exact=${ok}`);
}

// ── AC-LAT primary-storm latitude spread (over the DERIVED profile) + eqSign split + determinism ─────
console.log('\n── primary storm latitude spread + eqSign split (resolveStormPlacement over derived params) ──');
for (const regime of Object.values(E5_REGIME)) {
  const bundle = DRIVER_BUNDLES[regime], base = canonicalGiantCondition(regime);
  const absLats = []; let progr = 0, retro = 0;
  for (const s of SWEEP_SEEDS) {
    const d = deriveGiantDrivers(drawGiantConditions(regime, base, s));
    if (equatorialJetSign(d.shellDepthFrac) >= 0) progr++; else retro++;
    const P = resolveParams(regime, { ...d, rotationRate: bundle.rotationRate, radius: bundle.radius }, s);
    absLats.push(Math.abs(resolveStormPlacement(P).ranked[0].lat));
  }
  const sd = Math.sqrt(absLats.reduce((a, b, _i, arr) => a + (b - arr.reduce((x, y) => x + y, 0) / arr.length) ** 2, 0) / absLats.length);
  const distinct = new Set(absLats.map((x) => +x.toFixed(6))).size;
  console.log(`  ${regime}: |lat| stdev=${sd.toFixed(4)} distinct=${distinct}/${SWEEP_SEEDS.length}  eqSign prograde/retro=${progr}/${retro}`);
}
let det = true;
for (const regime of Object.values(E5_REGIME)) for (const s of SWEEP_SEEDS) {
  const a = JSON.stringify(deriveGiantDrivers(drawGiantConditions(regime, canonicalGiantCondition(regime), s)));
  const b = JSON.stringify(deriveGiantDrivers(drawGiantConditions(regime, canonicalGiantCondition(regime), s)));
  if (a !== b) det = false;
}
console.log(`  determinism same-seed-twice bit-identical: ${det}`);
