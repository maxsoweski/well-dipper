// Phase 2: run the LAB's dispatch (writeBodyRelief) for every solid corpus body and measure
// what actually lands in the relief cube / crater cube.
import { StarSystemGenerator } from '/home/ax/projects/well-dipper/src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '/home/ax/projects/well-dipper/src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '/home/ax/projects/well-dipper/src/worldengine/base/e1Regime.js';
import { labPackCtx, setLabGasBodiesOverride } from '/home/ax/projects/well-dipper/src/objects/Planet.js';
import { fluvialClassOf } from '/home/ax/projects/well-dipper/src/worldengine/drivers/fluvialDeck.js';
import { bakeReliefCrossover, visScaleOf } from '/home/ax/projects/well-dipper/src/worldengine/base/labCore.js';
import { makeSphereField } from '/home/ax/projects/well-dipper/src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '/home/ax/projects/well-dipper/src/worldengine/mesh/sphereMesh.js';
import { writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '/home/ax/projects/well-dipper/src/worldengine/dispatch/bodyRelief.js';
import { bodyDriversFromCondition } from '/home/ax/projects/well-dipper/src/rendering/bake/provinceDispatch.js';
import { compositeMargins } from '/home/ax/projects/well-dipper/src/worldengine/rivers/router.js';
import { writeFileSync } from 'node:fs';

setLabGasBodiesOverride(true);
const N_MESH = Number(process.env.NMESH || 5000);
const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      const d = e.planetData || e;
      out.push({ seed, kind: 'planet', d, id: `${seed}/planet/${d._ordinal}` });
      for (const m of (e.moons || [])) {
        const md = m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m;
        out.push({ seed, kind: 'moon', d: md, id: `${seed}/moon/${md._ordinal}` });
      }
    }
  }
  for (const b of out) { b.cond = conditionFromBody(b.d); b.cls = compositionClass(b.cond); }
  return out;
}
const stats = (a) => { let mn=Infinity,mx=-Infinity,s=0,s2=0,nz=0; for(const v of a){if(v<mn)mn=v;if(v>mx)mx=v;s+=v;s2+=v*v;if(v!==0)nz++;} const m=s/a.length; return {min:mn,max:mx,mean:m,rms:Math.sqrt(s2/a.length),std:Math.sqrt(Math.max(0,s2/a.length-m*m)),nonZero:nz,n:a.length}; };

const mesh = buildIrregularSphere(N_MESH, 3);
const solid = corpus().filter(b => b.cls !== 'gas');
const rows = [];
const agg = { path:{}, shelfDepthPresent:0, shelfDepthNonZero:0, craterFieldNonZero:0, compositedNonNull:0,
              craterOverlayNonZero:0, heightHasSignal:0, bakeStrengthLive:0, craterRestoreLive:0,
              reliefReachesPixels:0, cratersViaBakeReachPixels:0 };
for (const b of solid) {
  const ctx = labPackCtx(b.d, b.cond, null);
  const carrier = makeSphereField(mesh);
  const relief = writeBodyRelief(carrier, { bodyDrivers: bodyDriversFromCondition(b.cond),
    grainDrivers: DEFAULT_GRAIN_DRIVERS, macroSeed: ctx.macroSeed|0, heightSeed: 'e6:'+(ctx.macroSeed|0), T_eq: b.cond.T_eq ?? null });
  const craterOverlay = new Float32Array(carrier.height.length);
  const composited = compositeMargins(carrier, relief.reliefBudget, craterOverlay);
  const hs = stats(carrier.height);
  const cs = carrier.craterField ? stats(carrier.craterField) : null;
  const os = stats(craterOverlay);
  const R = b.cond.radiusEarth ?? b.d.radiusEarth ?? 1;
  const strength = bakeReliefCrossover(visScaleOf(R));
  const restore = 1 - strength;
  const row = { id:b.id, R, path: relief.path, fluvial: fluvialClassOf(b.cond),
    shelfDepth: !!carrier.shelfDepth, shelfNonZero: carrier.shelfDepth ? stats(carrier.shelfDepth).nonZero : 0,
    craterFieldNonZero: cs ? cs.nonZero : 0, craterFieldRms: cs ? cs.rms : 0,
    composited: composited !== null, craterOverlayNonZero: os.nonZero, craterOverlayRms: os.rms,
    heightRms: hs.rms, heightStd: hs.std, strength, restore,
    reliefBudget: relief.reliefBudget ? { inDomain: relief.reliefBudget.inDomain, f_I: relief.reliefBudget.f_I } : null };
  rows.push(row);
  agg.path[row.path] = (agg.path[row.path]||0)+1;
  if (row.shelfDepth) agg.shelfDepthPresent++;
  if (row.shelfNonZero>0) agg.shelfDepthNonZero++;
  if (row.craterFieldNonZero>0) agg.craterFieldNonZero++;
  if (row.composited) agg.compositedNonNull++;
  if (row.craterOverlayNonZero>0) agg.craterOverlayNonZero++;
  if (row.heightStd>1e-6) agg.heightHasSignal++;
  if (strength>0) agg.bakeStrengthLive++;
  if (restore>0) agg.craterRestoreLive++;
  if (strength>0 && row.heightStd>1e-6) agg.reliefReachesPixels++;
  if (restore>0 && row.craterOverlayNonZero>0) agg.cratersViaBakeReachPixels++;
}
writeFileSync('/tmp/claude-1000/-home-ax/2512145e-c9d5-478a-9ae7-5fdcce59aadd/scratchpad/bake-phase2.json', JSON.stringify({meshN:N_MESH, solid:solid.length, agg, rows},null,1));
console.log('meshN', N_MESH, 'solid', solid.length);
console.log(JSON.stringify(agg,null,1));
