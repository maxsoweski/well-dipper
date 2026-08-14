// tools/port-palette-measure.mjs — what the world engine's palette derive produces for REAL game
// bodies, beside the legacy hand-picked PALETTES pick. This is the script that found port blockers
// A and C (see docs/FEATURES/surface-variation-beyond-mvp.md 'Notes for the game port').
//
// Run: node tools/port-palette-measure.mjs
// Read the output for TWO things, not one:
//   1. every DERIVED colour is a brown/tan bedrock tone — because that is what surfacePaletteOf
//      returns. It is NOT a whole-body colour and must not be swapped for one (blocker A).
//   2. T_eq is IDENTICAL down each orbit column regardless of type, and iron barely moves — the
//      game's bodies are far less differentiated in condition space than the lab's presets (blocker C).
import { PlanetGenerator } from '../src/generation/PlanetGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { surfacePaletteOf } from '../src/worldengine/base/surfaceMaterial.js';
import { applyAlbedoTransfer } from '../src/worldengine/display/albedoTransfer.js';

import { SeededRandom } from '../src/generation/SeededRandom.js';
const rng = new SeededRandom(12345);
const hex=c=>'#'+c.map(x=>Math.round(Math.min(1,Math.max(0,x))*255).toString(16).padStart(2,'0')).join('');
const types=['rocky','terrestrial','ocean','ice','lava','venus','carbon','gas-giant','hot-jupiter','eyeball','sub-neptune'];
console.log('type'.padEnd(13),'orbitAU'.padStart(7),'R⊕'.padStart(5),'T_eq'.padStart(6),'iron'.padStart(5),'  LEGACY base   -> DERIVED weathered  fresh    sediment');
for(const t of types){
  for(const au of [0.6, 3.0]){
    let p; try{ p = PlanetGenerator.generate(rng, au, null, null, t); }catch(e){ console.log(t.padEnd(13),'GEN ERR',e.message.slice(0,60)); continue; }
    const cond = conditionFromBody(p);
    const pal = applyAlbedoTransfer(surfacePaletteOf(cond));
    console.log(t.padEnd(13), au.toFixed(2).padStart(7), (p.radiusEarth??0).toFixed(2).padStart(5),
      (p.T_eq??0).toFixed(0).padStart(6), (p.composition?.ironFraction??0).toFixed(2).padStart(5),
      '  ', hex(p.baseColor), ' -> ', hex(pal.weathered), hex(pal.fresh), hex(pal.sediment));
  }
}
