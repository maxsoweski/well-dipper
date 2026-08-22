#!/usr/bin/env node
// tools/crater-relaxation-channel-probe.mjs — is the crater DEGRADATION channel dead, or unexercised?
//
// I flagged on 2026-08-22 that `relaxation` reads 0.0000 on all four saturated lab presets, and
// suggested it might be a cheap substitute for widening the crater range. ⛔ IT IS NOT, AND THIS
// PROBE IS WHY — the finding went the other way and the recommendation moves with it.
//
// THE LAW IS FINE. Over the GAME's generated population, ~38% of cratered bodies carry a non-zero
// relaxation spanning 0.037..0.970, median ~0.75, and `condition.age` is present on 100% of them.
// Nothing is broken.
//
// ⭐ IT IS THE LAB'S PRESETS THAT DO NOT EXERCISE IT. bombardment.js:186 caps exposure as
//   tExp = min(age, T_RESURF_TIDAL/tidalRatio, T_RESURF_ERODE/erosion)
// and relaxation is `1 - tExp/ageEff`. Every cratered lab preset lands on age 4.5 with NO tidal
// heating and effectively NO erosion (thin or absent atmosphere), so tExp == age, so relaxation is
// exactly 0. `Titan (methane seas)` is the one lab preset that DOES degrade — tExp 1.0, relaxation
// 0.78 — because methane weather gives it real erosion.
//
// ⭐⭐ SO THIS IS A LAB/GAME DIVERGENCE, not a renderer defect: the lab systematically understates
// how differently two cratered worlds read, compared with what the game already renders. That is
// exactly the class of gap the one-route workstream exists to remove.
//
// ⛔ AND IT DOES NOT REPLACE WIDENING THE RANGE. Degradation varies crater SHARPNESS; the ceiling
// caps HOW MANY. ~20% of game bodies are still pinned at a median ~7x over the ceiling regardless of
// how sharp their craters are. Two independent problems; this is the smaller one.
//
// RUN: node tools/crater-relaxation-channel-probe.mjs
const R='/home/ax/projects/well-dipper/';
const { DRIVER_PRESETS, drawPresetConditions } = await import(R+'driver-presets.js');
const { deriveUniforms } = await import(R+'src/worldengine/base/labCore.js');
const { deriveConditionVector } = await import(R+'src/worldengine/base/conditionVector.js');
const cu = await import(R+'src/worldengine/port/craterUniforms.js');
const bomb = await import(R+'src/worldengine/base/bombardment.js');
const { StarSystemGenerator } = await import(R+'src/generation/StarSystemGenerator.js');
const { conditionFromBody } = await import(R+'src/worldengine/port/conditionFromBody.js');
const { compositionClass } = await import(R+'src/worldengine/base/e1Regime.js');

console.log('=== LAB PRESETS ===');
console.log('preset'.padEnd(30),'age'.padStart(7),'ageEff'.padStart(7),'tExp'.padStart(7),'relax'.padStart(7),' resurf');
for (const p of Object.keys(DRIVER_PRESETS)) {
  const dp=drawPresetConditions(p,1), u=deriveUniforms(dp,1.0);
  const cond=deriveConditionVector(dp,u,DRIVER_PRESETS[p].radiusEarth??1);
  if (compositionClass(cond)==='gas') continue;
  const sch=bomb.craterSchedule(cond); if(!sch.fired) continue;
  const o=cu.craterUniformsFrom(cond);
  if (o.density===0) continue;
  const ageEff=Math.min(4.6,Math.max(0,cond?.age??4.0));
  console.log(p.padEnd(30), String(cond?.age ?? 'MISSING').slice(0,7).padStart(7),
    ageEff.toFixed(3).padStart(7), String(sch.tExp).slice(0,7).padStart(7),
    o.relaxation.toFixed(4).padStart(7), '  ', String(cond?.surfaceHistory?.resurfacing ?? cond?.resurfacing ?? '?').slice(0,6));
}
console.log('\n=== GENERATED BODIES (the game population) ===');
let n=0,zero=0; const vals=[]; let ageMissing=0;
for (let i=0;i<40;i++){
  const sys=StarSystemGenerator.generate(`lab-procedural-${i}`,null);
  const bodies=[];
  for (const e of sys.planets||[]){ bodies.push(e.planetData); for (const m of e.moons||[]) if(!m.planetData) bodies.push(m); }
  for (const b of bodies){
    let cond; try{cond=conditionFromBody(b);}catch{continue;}
    if(!cond||compositionClass(cond)==='gas') continue;
    const o=cu.craterUniformsFrom(cond); if(o.density===0) continue;
    n++; if(cond.age===undefined||cond.age===null) ageMissing++;
    if(o.relaxation===0) zero++; else vals.push(o.relaxation);
  }
}
vals.sort((a,b)=>a-b);
console.log(`cratered bodies: ${n}`);
console.log(`  relaxation EXACTLY 0: ${zero}  (${(100*zero/n).toFixed(1)}%)`);
console.log(`  relaxation > 0:       ${vals.length}  (${(100*vals.length/n).toFixed(1)}%)`);
console.log(`  condition.age missing: ${ageMissing}  (${(100*ageMissing/n).toFixed(1)}%)`);
if(vals.length) console.log(`  non-zero range: ${vals[0].toFixed(4)} .. ${vals[vals.length-1].toFixed(4)}  median ${vals[vals.length>>1].toFixed(4)}`);
