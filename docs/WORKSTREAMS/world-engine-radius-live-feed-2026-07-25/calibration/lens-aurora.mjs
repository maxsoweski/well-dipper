// Verify findings [2]/[6]: the Ice giant aurora at the lab's DRAWN radius.
import { DRIVER_PRESETS, drawPresetRadius } from '../../../../driver-presets.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';

const TIER = 1.0;
const GAS = Object.keys(DRIVER_PRESETS).filter((p) => DRIVER_PRESETS[p].atmosphere?.composition === 'h2-he');

// exact transcription of world-engine-lab.html:3283 / :3564-3568
function site(preset, R) {
  const _fp = DRIVER_PRESETS[preset];
  const u = deriveUniforms(_fp, TIER);
  const _gas = (_fp.atmosphere?.composition === 'h2-he');
  const _giantDynamo = _gas && (R ?? 1) >= 3.5;
  const _mag = _giantDynamo ? Math.max(u.magneticField, 0.6) : u.magneticField;
  const auroraIntensity = _mag > 0.05 ? (_giantDynamo ? _mag : u.auroraIntensity) : 0.0;
  return {
    giantDynamo: _giantDynamo, mag: _mag, auroraIntensity,
    ringLat: 0.7 + _mag * 0.2, ringWidth: Math.max(0.07, 0.15 - _mag * 0.08),
    uMag: u.magneticField, uAur: u.auroraIntensity,
  };
}

console.log('=== boot (radiusSeed = 1, the shipped default) ===');
for (const p of GAS) {
  const canon = DRIVER_PRESETS[p].radiusEarth ?? 1;
  const drawn = drawPresetRadius(p, 1, { labUnlock: true });
  const o = site(p, canon), n = site(p, drawn);
  console.log(`${p.padEnd(28)} canon=${canon} drawn=${drawn.toFixed(4)}`);
  console.log(`   OLD ${JSON.stringify(o)}`);
  console.log(`   NEW ${JSON.stringify(n)}`);
}

console.log('\n=== dynamo flip rate over 2001 radius seeds ===');
for (const p of GAS) {
  const canon = DRIVER_PRESETS[p].radiusEarth ?? 1;
  let flips = 0, dark = 0;
  for (let s = 0; s < 2001; s++) {
    const R = drawPresetRadius(p, s, { labUnlock: true });
    const o = site(p, canon), n = site(p, R);
    if (o.giantDynamo !== n.giantDynamo) flips++;
    if (o.auroraIntensity > 0 && n.auroraIntensity === 0) dark++;
  }
  console.log(`${p.padEnd(28)} dynamo flips ${String(flips).padStart(4)}/2001 (${(100*flips/2001).toFixed(1)}%)  aurora on->OFF ${String(dark).padStart(4)}/2001`);
}

console.log('\n=== the two sub-neptune-archetype presets draw the SAME radius? ===');
let same = 0, sameVerdictNew = 0;
for (let s = 0; s < 2001; s++) {
  const a = drawPresetRadius('Ice giant (Neptunian)', s, { labUnlock: true });
  const b = drawPresetRadius('Sub-Neptune (hazy)', s, { labUnlock: true });
  if (Object.is(a, b)) same++;
  if (site('Ice giant (Neptunian)', a).giantDynamo === site('Sub-Neptune (hazy)', b).giantDynamo) sameVerdictNew++;
}
console.log(`identical drawn radius: ${same}/2001 ; identical NEW dynamo verdict: ${sameVerdictNew}/2001`);
console.log(`OLD verdict at canonical: Neptunian=${site('Ice giant (Neptunian)', 3.9).giantDynamo} SubNeptune=${site('Sub-Neptune (hazy)', 2.7).giantDynamo}`);
