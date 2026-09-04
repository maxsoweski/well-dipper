// READ-ONLY audit: which lab relief/surface writers reach game pixels, and by which route.
import { StarSystemGenerator } from '/home/ax/projects/well-dipper/src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '/home/ax/projects/well-dipper/src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '/home/ax/projects/well-dipper/src/worldengine/base/e1Regime.js';
import { PACKS, gatesFor } from '/home/ax/projects/well-dipper/src/worldengine/drivers/index.js';
import { resolveDriver } from '/home/ax/projects/well-dipper/src/worldengine/port/writePackUniforms.js';
import { labPackCtx, labPipelineAdmits, setLabGasBodiesOverride } from '/home/ax/projects/well-dipper/src/objects/Planet.js';
import { fluvialClassOf } from '/home/ax/projects/well-dipper/src/worldengine/drivers/fluvialDeck.js';
import { bakeReliefCrossover, visScaleOf } from '/home/ax/projects/well-dipper/src/worldengine/base/labCore.js';
import { makeSphereField } from '/home/ax/projects/well-dipper/src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '/home/ax/projects/well-dipper/src/worldengine/mesh/sphereMesh.js';
import { writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '/home/ax/projects/well-dipper/src/worldengine/dispatch/bodyRelief.js';
import { bodyDriversFromCondition, provinceAppliesTo } from '/home/ax/projects/well-dipper/src/rendering/bake/provinceDispatch.js';
import { makeUniforms } from '/home/ax/projects/well-dipper/src/worldengine/shaders/uniforms.js';
import { writeFileSync } from 'node:fs';

setLabGasBodiesOverride(true);
const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
const MESH_N = 512;
const MESH = { positions: new Float32Array(MESH_N * 3), count: MESH_N, radius: 1.0 };
{ // fibonacci sphere for pack #1's bakes (ctx.mesh)
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < MESH_N; i++) {
    const y = 1 - (i / (MESH_N - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = ga * i;
    MESH.positions[i*3] = Math.cos(th)*r; MESH.positions[i*3+1] = y; MESH.positions[i*3+2] = Math.sin(th)*r;
  }
}

function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      const d = e.planetData || e;
      out.push({ seed, kind: 'planet', d, id: `${seed}/planet/${d._ordinal}` });
      for (const m of (e.moons || [])) {
        const md = m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m;
        out.push({ seed, kind: m.isPlanetMoon ? 'planet-moon' : 'moon', d: md, id: `${seed}/${m.isPlanetMoon ? 'planet-moon' : 'moon'}/${md._ordinal}` });
      }
    }
  }
  for (const b of out) { b.cond = conditionFromBody(b.d); b.cls = compositionClass(b.cond); }
  return out;
}

// Every name any pack in the frozen registry can write, over this corpus.
import * as THREE from '/home/ax/projects/well-dipper/node_modules/three/build/three.module.js';
const DEFAULTS = makeUniforms(new THREE.Vector3(1,0,0));
const defaultOf = (n) => (DEFAULTS[n] ? DEFAULTS[n].value : undefined);
const numOf = (v) => (typeof v === 'number' ? v : (Array.isArray(v) ? v.reduce((a,b)=>a+Math.abs(b),0) : (v && typeof v.x === 'number' ? Math.abs(v.x)+Math.abs(v.y)+Math.abs(v.z) : NaN)));

const CORPUS = corpus();
const solid = CORPUS.filter((b) => b.cls !== 'gas');
const gas = CORPUS.filter((b) => b.cls === 'gas');

// --- dispatch path (which lab relief WRITER runs inside the bake) ---
const smallMesh = buildIrregularSphere(600, 2);

const rows = [];
const namesEverWritten = new Set();
const nonZeroCount = {};   // name -> count over solid bodies
const writtenCount = {};   // name -> count of solid bodies where SOME pack wrote it
const pathCount = {};
const fluvCount = {};
let admittedSolid = 0;

for (const b of solid) {
  const ctx = labPackCtx(b.d, b.cond, MESH);
  const drivers = {};
  const byPack = {};
  for (const entry of PACKS) {
    if (entry.applies(b.cond, ctx) !== true) continue;
    const packCtx = { ...ctx, gates: gatesFor(entry) };   // PRODUCTION policy (RULED) — what the game writes
    const r = entry.pack(b.cond, packCtx);
    const d = {};
    for (const n of Object.keys(r.drivers)) { const v = resolveDriver(n, r.drivers[n], packCtx); d[n] = v; drivers[n] = v; namesEverWritten.add(n); }
    byPack[entry.name] = Object.keys(d);
  }
  for (const n of Object.keys(drivers)) {
    writtenCount[n] = (writtenCount[n] || 0) + 1;
    const x = numOf(drivers[n]);
    if (Number.isFinite(x) && Math.abs(x) > 1e-12) nonZeroCount[n] = (nonZeroCount[n] || 0) + 1;
  }
  // bake reachability
  const R = b.cond.radiusEarth ?? b.d.radiusEarth ?? 1;
  const strength = bakeReliefCrossover(visScaleOf(R));
  const fl = fluvialClassOf(b.cond);
  fluvCount[fl] = (fluvCount[fl] || 0) + 1;
  // dispatch path
  const carrier = makeSphereField(smallMesh);
  let path = 'ERR';
  try {
    const relief = writeBodyRelief(carrier, {
      bodyDrivers: bodyDriversFromCondition(b.cond), grainDrivers: DEFAULT_GRAIN_DRIVERS,
      macroSeed: ctx.macroSeed | 0, heightSeed: 'e6:' + (ctx.macroSeed | 0), T_eq: b.cond.T_eq ?? null,
    });
    path = relief.path;
  } catch (e) { path = 'ERR:' + String(e.message).slice(0, 60); }
  pathCount[path] = (pathCount[path] || 0) + 1;
  const adm = labPipelineAdmits(b.d, b.cond);
  if (adm.admitted) admittedSolid++;
  rows.push({ id: b.id, kind: b.kind, cls: b.cls, radiusEarth: R, admitted: adm.admitted, packs: adm.packs,
    dispatchPath: path, provinceApplies: provinceAppliesTo(b.cond), fluvialClass: fl,
    reliefBakeStrength: strength, craterBakeRestore: 1 - strength,
    drivers, byPack });
}

// gas bodies: just count + admitted
let admittedGas = 0;
for (const b of gas) { if (labPipelineAdmits(b.d, b.cond).admitted) admittedGas++; }

// ---- F-row gate table ----
const F_GATES = {
  'F1 mountains':        'uMountainAmp',
  'F2 craters':          'uCraterDensity',
  'F3 ejecta/rays':      'uRayBrightness',
  'F4 canyons/rifts':    'uChasmaDepth',
  'F5 scarps':           'uScarpStrength',
  'F6a plateaus':        'uPlateauStrength',
  'F6b tessera':         'uTesseraStrength',
  'F7 volcanic edifice': 'uVolcanismStrength',
  'F8 lava plains':      'uLavaCoverage',
  'F9 chaos':            'uCryoActivity',
  'F10 ridged icy':      'uCryoActivity',
  'F11 rivers':          'uFluvialActivity',
  'F12 deltas':          'uDeltaDensity',
  'F13 outflow':         'uOutflowDensity',
  'F14 seas':            'uLiquidMask',
  'F15 dunes':           'uDuneDensity',
  'F16 dust mantles':    'uDustDepth',
  'F17 glacial':         'uGlacialStrength',
  'F18 sublimation':     'uSubStrength',
  'F19 mass-wasting':    'uMassWastDensity',
  'F20 coastlines':      'uCoastStrength',
  'F21 karst':           'uKarstDensity',
  'F22 frost caps':      'uFrostMaxCoverage',
  'F37 aurora':          'uAuroraIntensity',
  'F43 facets':          'uFacetStrength',
  'F46 bio mats':        'uBioCoverage',
};
const fTable = {};
for (const [f, n] of Object.entries(F_GATES)) {
  fTable[f] = { uniform: n, writtenByAnyPack: !!writtenCount[n], writtenOn: writtenCount[n] || 0,
    nonZeroOn: nonZeroCount[n] || 0, ofSolid: solid.length, shaderDefault: defaultOf(n) };
}

const out = {
  generatedAt: new Date().toISOString(),
  corpus: { seeds: SEEDS.length, total: CORPUS.length, solid: solid.length, gas: gas.length,
            admittedSolid, admittedGas },
  gatePolicy: 'GATE_POLICY_RULED (production default)',
  dispatchPathCountsOverSolid: pathCount,
  fluvialClassCountsOverSolid: fluvCount,
  reliefBakeStrength: (() => {
    const v = rows.map(r => r.reliefBakeStrength);
    const nz = v.filter(x => x > 0).length;
    return { nonZeroOn: nz, ofSolid: solid.length, min: Math.min(...v), max: Math.max(...v),
             mean: v.reduce((a,b)=>a+b,0)/v.length, exactlyZero: v.filter(x=>x===0).length, exactlyOne: v.filter(x=>x===1).length };
  })(),
  allPackWrittenNames: [...namesEverWritten].sort(),
  perNameNonZero: Object.fromEntries([...namesEverWritten].sort().map(n => [n, { written: writtenCount[n]||0, nonZero: nonZeroCount[n]||0 }])),
  fTable,
  rows,
};
writeFileSync('/tmp/claude-1000/-home-ax/2512145e-c9d5-478a-9ae7-5fdcce59aadd/scratchpad/bake-audit.json', JSON.stringify(out, null, 1));

// console summary
console.log('corpus:', JSON.stringify(out.corpus));
console.log('dispatch paths:', JSON.stringify(pathCount));
console.log('fluvial classes:', JSON.stringify(fluvCount));
console.log('reliefBakeStrength:', JSON.stringify(out.reliefBakeStrength));
console.log('\nF-ROW GATE TABLE (solid bodies =', solid.length, ')');
for (const [f, v] of Object.entries(fTable)) {
  console.log(`  ${f.padEnd(22)} ${v.uniform.padEnd(22)} pack-written:${String(v.writtenByAnyPack).padEnd(6)} writtenOn:${String(v.writtenOn).padEnd(4)} nonZeroOn:${String(v.nonZeroOn).padEnd(4)} default:${JSON.stringify(v.shaderDefault)}`);
}
console.log('\nnames NEVER written by any pack but read by the shader: see fTable rows with pack-written:false');
