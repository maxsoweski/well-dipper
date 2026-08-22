#!/usr/bin/env node
// tools/crater-ceiling-population-probe.mjs — what the density ceiling actually costs, measured.
//
// Max, 2026-08-22: "what's the tradeoff between remapping the real range onto display range vs.
// changing the display range so it can display the real range?"
//
// ⭐⭐ THE ANSWER IS THAT ONE OF THOSE TWO OPTIONS DOES NOT EXIST, and this probe is why.
// `density` is NOT a free display parameter with a chosen bound. It is the fraction of voronoi
// cells hosting a crater, and 1.0 means EVERY cell hosts one. src/worldengine/port/craterUniforms.js
// says so directly: "0.1706 is also the CEILING. One crater per cell means the game cannot paint
// more than ~17% crater coverage however bombarded a world is, so a truly saturated surface renders
// under-cratered … the same single-octave limitation recorded in the register."
//
// So the ceiling is a PHYSICAL PROPERTY OF THE RENDERER, not a tuning number. Remapping the real
// range into it would scale DOWN every body that currently renders correctly, to make headroom for
// the ones that do not — see the population split below for who pays.
//
// A. THE FOUR SATURATED PRESETS. Their density is pinned at 1 and their `relaxation` — the
//    degradation channel that ought to tell a resurfaced world from a dead one — is 0.0000 on ALL
//    FOUR. So among saturated bodies NEITHER coverage NOR degradation carries information. Only
//    `complexD` varies (crater SHAPE: central peaks and terraces), which is morphology, not how
//    battered a world looks. ⚠ Mars reading relaxation 0 is worth its own look and is NOT claimed
//    here as a defect — it was not investigated.
//
// B. THE POPULATION, and it is far worse than the presets suggest. Over 60 generated systems:
//    ~31% of solid bodies have craters OFF, ~49% sit below the ceiling and carry real information,
//    and ~20% are PINNED — with a median real coverage of ~7x the ceiling and a max over 10x.
//    The presets' 1.6x-2.3x was the mild end of the distribution.
//
// RUN: node tools/crater-ceiling-population-probe.mjs
const R='/home/ax/projects/well-dipper/';
const { DRIVER_PRESETS, drawPresetConditions } = await import(R+'driver-presets.js');
const { deriveUniforms } = await import(R+'src/worldengine/base/labCore.js');
const { deriveConditionVector } = await import(R+'src/worldengine/base/conditionVector.js');
const cu = await import(R+'src/worldengine/port/craterUniforms.js');
const bomb = await import(R+'src/worldengine/base/bombardment.js');
const base = await import(R+'src/worldengine/base/baseStep.js');
const { StarSystemGenerator } = await import(R+'src/generation/StarSystemGenerator.js');
const { conditionFromBody } = await import(R+'src/worldengine/port/conditionFromBody.js');
const { compositionClass } = await import(R+'src/worldengine/base/e1Regime.js');

const raw = (cond) => {
  const sch = bomb.craterSchedule(cond); if(!sch.fired) return null;
  const RE=Math.max(1e-6,cond?.radiusEarth??1), R_km=RE*6371, rpk=base.radPerKm(RE);
  const L=sch.D_LO_KM*sch.sizeMul, H=sch.D_HI_KM, lo=Math.max(L, cu.CRATER_VIS_FLOOR_RAD*R_km);
  if(!(H>lo)) return null;
  return cu.coverageBand(sch,rpk,lo,H)/cu.RENDERED_CELL_COVERAGE;
};
console.log('=== A. are the four saturated presets distinguished by OTHER crater uniforms? ===');
console.log('preset'.padEnd(30),'raw'.padStart(6),'dens'.padStart(5),'relax'.padStart(7),'cplxD'.padStart(7),'ejRamp'.padStart(7));
for (const p of ['Moon/Mercury (impact-airless)','Frozen (airless)','Mars (arid rocky)','Crystal (faceted)']) {
  const dp=drawPresetConditions(p,1), u=deriveUniforms(dp,1.0);
  const cond=deriveConditionVector(dp,u,DRIVER_PRESETS[p].radiusEarth??1);
  const o=cu.craterUniformsFrom(cond), rv=raw(cond);
  console.log(p.padEnd(30), rv.toFixed(2).padStart(6), String(o.density).padStart(5),
    o.relaxation.toFixed(4).padStart(7), o.complexD.toFixed(3).padStart(7), o.ejectaRampart.toFixed(3).padStart(7));
}
console.log('\n=== B. how widespread on REAL generated bodies? ===');
let n=0, off=0, sat=0, mid=0; const rawsSat=[];
for (let i=0; i<60; i++) {
  const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
  const bodies = [];
  for (const e of sys.planets||[]) { bodies.push(e.planetData); for (const m of e.moons||[]) if (!m.planetData) bodies.push(m); }
  for (const b of bodies) {
    let cond; try { cond = conditionFromBody(b); } catch { continue; }
    if (!cond || compositionClass(cond)==='gas') continue;
    n++;
    const o = cu.craterUniformsFrom(cond);
    if (o.density === 0) { off++; continue; }
    const rv = raw(cond);
    if (rv !== null && rv > 1) { sat++; rawsSat.push(rv); } else mid++;
  }
}
rawsSat.sort((a,b)=>a-b);
const pct=(x)=>(100*x/n).toFixed(1)+'%';
console.log(`solid bodies: ${n}`);
console.log(`  craters OFF (below one visible crater): ${off}  ${pct(off)}`);
console.log(`  cratered, BELOW the ceiling:            ${mid}  ${pct(mid)}   <- the only ones whose density carries information`);
console.log(`  cratered, PINNED AT the ceiling:        ${sat}  ${pct(sat)}`);
if (rawsSat.length) console.log(`  saturated bodies' real coverage: median ${rawsSat[rawsSat.length>>1].toFixed(2)}x  max ${rawsSat[rawsSat.length-1].toFixed(2)}x`);
