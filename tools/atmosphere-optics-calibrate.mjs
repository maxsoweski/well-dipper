// tools/atmosphere-optics-calibrate.mjs — prints the V2-7 atmosphere-optics derive across all 18 presets
// beside the two hand-authored name-keyed tables it REPLACED (LIMB_COLOR_BY_PRESET /
// TERM_COLOR_BY_PRESET, formerly in world-engine-lab.html). The authored values are frozen here as the
// historical reference the derive was calibrated against — they are NOT a contract, and a future law
// change that moves a hue for a physical reason should move these numbers with a note, not chase them.
//
// Run: node tools/atmosphere-optics-calibrate.mjs
// Current worst single-channel delta: limb 0.10 (Ocean), terminator 0.11 (Saturnian); 4 presets exact.
//
// The airless rows have no authored row BY DESIGN — those presets were absent from both tables and fell
// back to a stale read. They are inert behind the hasAtmo master gate (limbStrength/termStrength 0), so
// their derived hue is what a future atmosphere-bearing draw of that body WOULD get, not what renders.
import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { drawPresetConditions } from '../driver-presets.js';
import { atmosphereOpticsOf, jeansH2Of } from '../src/worldengine/base/atmosphereOptics.js';

const LIMB = {'Rocky (Earthlike)':[0.45,0.65,1.00],'Ocean (temperate)':[0.40,0.62,1.00],'Eyeball (locked temperate)':[0.50,0.66,1.00],'Titan (methane seas)':[1.00,0.55,0.22],'Venus (sulfuric shroud)':[0.95,0.88,0.62],'Gas giant (Jovian)':[0.88,0.72,0.52],'Gas giant (Saturnian)':[0.92,0.84,0.62],'Ice giant (Neptunian)':[0.45,0.60,1.00],'Sub-Neptune (hazy)':[0.82,0.74,0.62],'Hot Jupiter (locked giant)':[0.80,0.50,0.32],'Mars (arid rocky)':[0.60,0.66,0.88]};
const TERM = {'Rocky (Earthlike)':[1.00,0.45,0.18],'Ocean (temperate)':[1.00,0.42,0.22],'Eyeball (locked temperate)':[1.00,0.48,0.20],'Titan (methane seas)':[0.72,0.52,0.78],'Venus (sulfuric shroud)':[1.00,0.62,0.28],'Gas giant (Jovian)':[1.00,0.58,0.30],'Gas giant (Saturnian)':[0.98,0.72,0.40],'Ice giant (Neptunian)':[0.50,0.55,0.95],'Sub-Neptune (hazy)':[0.88,0.62,0.45],'Hot Jupiter (locked giant)':[1.00,0.38,0.22],'Mars (arid rocky)':[0.45,0.60,1.00]};
const f=(c)=>'['+c.map(x=>x.toFixed(2)).join(',')+']';
const d=(a,b)=>b?Math.max(...a.map((x,i)=>Math.abs(x-b[i]))):null;
console.log('name'.padEnd(28),'lamH2'.padStart(7),'prim'.padStart(5),'haze'.padStart(5),'col'.padStart(5),' LIMB derived      authored        d','   TERM derived      authored        d');
let worstL=0,worstT=0; const seedDrift=[];
for (const [name,fp] of Object.entries(DRIVER_PRESETS)) {
  const c = deriveConditionVector(fp,null,fp.radiusEarth);
  const o = atmosphereOpticsOf(c);
  // The lab renders the DRAWN condition, not the canonical one. Sweep seeds and record the widest
  // excursion any seed produces — a law that is correct at the canonical body and wrong two seeds over
  // is not correct. (This check exists because the first haze gate passed canonically and turned a
  // temperate ocean world tan at seed 1.)
  let drift = 0, driftSeed = null;
  for (let seed = 0; seed < 24; seed++) {
    const od = atmosphereOpticsOf(deriveConditionVector(drawPresetConditions(name, seed), null, fp.radiusEarth));
    const dd = Math.max(...od.limbColor.map((x,i)=>Math.abs(x-o.limbColor[i])),
                        ...od.termColor.map((x,i)=>Math.abs(x-o.termColor[i])));
    if (dd > drift) { drift = dd; driftSeed = seed; }
  }
  seedDrift.push({name, drift, driftSeed});
  const dl=d(o.limbColor,LIMB[name]), dt=d(o.termColor,TERM[name]);
  if(dl!==null){worstL=Math.max(worstL,dl);worstT=Math.max(worstT,dt);}
  console.log(name.padEnd(28), jeansH2Of(c).toFixed(1).padStart(7), o.primordialFraction.toFixed(2).padStart(5),
    o.hazeFraction.toFixed(2).padStart(5), o.columnFraction.toFixed(2).padStart(5),
    ' ',f(o.limbColor), (LIMB[name]?f(LIMB[name]):'  (none/airless)'), (dl!==null?dl.toFixed(2):' - ').padStart(5),
    ' ',f(o.termColor), (TERM[name]?f(TERM[name]):'  (none/airless)'), (dt!==null?dt.toFixed(2):' - ').padStart(5));
}
console.log('\nworst channel delta vs authored:  limb',worstL.toFixed(3),' term',worstT.toFixed(3));
seedDrift.sort((a,b)=>b.drift-a.drift);
console.log('\nper-seed drift (widest hue excursion over 24 drawn seeds vs the canonical body):');
for (const r of seedDrift.slice(0,6)) console.log('  ', r.name.padEnd(28), r.drift.toFixed(3), r.driftSeed===null?'':'(seed '+r.driftSeed+')');
