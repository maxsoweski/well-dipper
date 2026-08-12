// E5 visible consequence at the lab's DEFAULT boot (radiusSeed 1, macroSeed 1), OLD vs NEW.
import { DRIVER_PRESETS, drawPresetRadius } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';
import { E5_REGIME, resolveParams, bakeClimateE5Attributes } from '../../../../src/worldengine/base/climate-e5.js';
import { drawGiantConditions, deriveGiantDrivers } from '../../../../src/worldengine/base/giant-drivers.js';

const REGIME = {
  'Gas giant (Jovian)': E5_REGIME.GAS_GIANT,
  'Gas giant (Saturnian)': E5_REGIME.SATURNIAN,
  'Ice giant (Neptunian)': E5_REGIME.NEPTUNIAN,
  'Sub-Neptune (hazy)': E5_REGIME.SUB_NEPTUNE,
  'Hot Jupiter (locked giant)': E5_REGIME.HOT_JUPITER,
};
const MACRO = 1, TIER = 1.0, POS = new Float32Array([0, 0, 1]);

function at(p, Rfeed, Rcond) {
  const fp = DRIVER_PRESETS[p];
  const u = deriveUniforms(fp, TIER);
  const cond = deriveConditionVector(fp, u, Rcond);
  const gd = deriveGiantDrivers(drawGiantConditions(REGIME[p], cond, MACRO));
  const drivers = { ...gd, rotationRate: 9.9 / (fp.rotationHours ?? 24), radius: Rfeed / 11.2 };
  const bake = bakeClimateE5Attributes(POS, 1, 1, { regime: REGIME[p], drivers, macroSeed: MACRO });
  return { m: resolveParams(REGIME[p], drivers, MACRO).m, e5Band: bake.bandCount, jet: bake.jetCount };
}

console.log('preset'.padEnd(28), 'Rc'.padStart(6), 'Rdrawn'.padStart(8), '| Rhines m O->N | e5BandCount O->N | jetCount O->N');
for (const p of Object.keys(REGIME)) {
  const Rc = DRIVER_PRESETS[p].radiusEarth ?? 1;
  const Rd = drawPresetRadius(p, 1, { labUnlock: true });
  // OLD: frozen feed at canonical, condition vector already live (it was live pre-rewire too)
  const o = at(p, Rc, Rd);
  const n = at(p, Rd, Rd);
  console.log(p.padEnd(28), String(Rc).padStart(6), Rd.toFixed(4).padStart(8),
    `| ${o.m} -> ${n.m}`.padEnd(16), `| ${o.e5Band} -> ${n.e5Band}`.padEnd(19), `| ${o.jet} -> ${n.jet}`);
}
