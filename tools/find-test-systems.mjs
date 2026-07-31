// tools/find-test-systems.mjs — pick PROCEDURALLY GENERATED systems to test surface work in.
//
// Run: node tools/find-test-systems.mjs [maxParsecs]
//
// WHY. Sol is a special case by design — its bodies are hand-authored and textured — so it is the
// wrong place to judge procedural surface work. This finds real named stars near Sol whose
// generated systems contain the land types the world-engine port has actually touched, and ranks
// them by how much of that work one visit would show.
//
// The seed is the same position hash RealStarCatalog uses at runtime (GalacticMap.hashCombine over
// the star's rounded world coordinates), so a system named here is the SAME system the game builds
// when you warp to that star.
//
// ⚠ READ THE PER-BODY COLUMNS, NOT JUST THE SCORE. `Planet.js` and `Moon.js` are two different
// renderers and only the first has the world-engine port, so a system full of interesting MOONS
// currently shows none of it.
import { readFileSync } from 'node:fs';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
import { craterUniformsFrom } from '../src/worldengine/port/craterUniforms.js';

// Mirrors Planet.js's routing. Only ROCKY carries the palette / ice-lava / relief / crater work.
const ROCKY_TYPES = new Set(['rocky', 'ice', 'lava', 'ocean', 'terrestrial', 'venus', 'carbon']);
const GAS_TYPES = new Set(['gas-giant', 'hot-jupiter', 'eyeball', 'sub-neptune']);

const MAX_PC = Number(process.argv[2] || 12);
const stars = JSON.parse(readFileSync(new URL('../public/assets/data/hyg-stars.json', import.meta.url), 'utf8'));

// ⚠ The catalogue is GALACTOCENTRIC — Sol sits at (8, 0.025, 0), not at the origin, so a naive
// hypot(x,y,z) measures distance from the GALACTIC CENTRE and finds nothing nearby. Each record
// carries its own `dist` from Sol, in kpc.
// ⚠ HYG uses a bare `"` as a ditto/placeholder in the name column, and 15 599 of 15 599 records
// have SOME name string, so a truthiness check keeps them all. A test target has to be something
// you can find on the galaxy map and warp to, so require a real proper name.
const namedStar = (n) => typeof n === 'string' && /[A-Za-z]{3}/.test(n) && n !== 'Sol';
const near = stars
  .map(s => ({ s, distPc: (s.dist ?? 0) * 1000 }))
  .filter(o => namedStar(o.s.name) && o.distPc > 0.01 && o.distPc <= MAX_PC)
  .sort((a, b) => a.distPc - b.distPc);

const seedOf = (s) => GalacticMap.hashCombine(
  Math.round(s.x * 10000),
  GalacticMap.hashCombine(Math.round(s.y * 10000), Math.round(s.z * 10000)),
);

const rows = [];
for (const { s, distPc } of near) {
  let sys;
  try { sys = StarSystemGenerator.generate(seedOf(s)); } catch { continue; }
  const types = new Set(), craterBodies = [], rocky = [];
  let planetCount = 0, moonCount = 0, moonCraters = 0;
  for (const w of (sys.planets || [])) {
    const p = w.planetData || w;
    planetCount++;
    if (ROCKY_TYPES.has(p.type)) { types.add(p.type); rocky.push(p); }
    try {
      const u = craterUniformsFrom(conditionFromPlanet(p));
      if (u.density > 0 && ROCKY_TYPES.has(p.type)) craterBodies.push(`${p.type}:${u.density.toFixed(2)}`);
    } catch { /* partial record */ }
    for (const m of (w.moons || [])) {
      moonCount++;
      try { if (craterUniformsFrom(conditionFromPlanet(m)).density > 0) moonCraters++; } catch { /* */ }
    }
  }
  rows.push({
    name: s.name, seed: seedOf(s), distPc, spect: s.spect,
    planetCount, rockyCount: rocky.length, types: [...types].sort(),
    craterBodies, moonCount, moonCraters,
    // What ONE visit shows of the port today: distinct ROCKY types is the honest score, because
    // that is the set of shader branches slices 1-3 actually changed.
    score: types.size * 10 + rocky.length + craterBodies.length * 5,
  });
}

rows.sort((a, b) => b.score - a.score || a.distPc - b.distPc);

console.log(`\nReal named stars within ${MAX_PC} pc: ${near.length} | systems generated: ${rows.length}\n`);
console.log('THE SHORTLIST — ranked by how many distinct ROCKY-shader land types one visit shows\n');
console.log('star'.padEnd(22), 'pc'.padStart(6), 'sp'.padStart(4), 'planets'.padStart(8), 'rocky'.padStart(6),
  'moons'.padStart(6), 'mn.crat'.padStart(8), '  land types (Planet.js ROCKY branch)');
for (const r of rows.slice(0, 15)) {
  console.log(r.name.padEnd(22), r.distPc.toFixed(2).padStart(6), (r.spect || '?').slice(0, 4).padStart(4),
    String(r.planetCount).padStart(8), String(r.rockyCount).padStart(6),
    String(r.moonCount).padStart(6), String(r.moonCraters).padStart(8),
    '  ' + (r.types.join(', ') || '(none)'));
}

const allTypes = ['rocky', 'ice', 'lava', 'ocean', 'terrestrial', 'venus', 'carbon'];
console.log('\nCOVERAGE — which land types the top systems reach, so a short list can cover them all\n');
const covered = new Set();
const picks = [];
for (const r of rows) {
  const adds = r.types.filter(t => !covered.has(t));
  if (!adds.length) continue;
  adds.forEach(t => covered.add(t));
  picks.push({ ...r, adds });
  if (covered.size === allTypes.length) break;
}
for (const p of picks) {
  console.log(`  ${p.name.padEnd(20)} ${p.distPc.toFixed(2).padStart(6)} pc  seed ${String(p.seed).padStart(12)}  adds: ${p.adds.join(', ')}`);
}
const missing = allTypes.filter(t => !covered.has(t));
console.log(`\n  ${picks.length} systems cover ${covered.size}/${allTypes.length} land types.` +
  (missing.length ? `  NOT REACHED within ${MAX_PC} pc: ${missing.join(', ')}` : '  All types reached.'));

const totMoons = rows.reduce((a, r) => a + r.moonCount, 0);
const totMoonCrat = rows.reduce((a, r) => a + r.moonCraters, 0);
const totCraterPlanets = rows.reduce((a, r) => a + r.craterBodies.length, 0);
console.log(`\n⚠ CRATER REACH across all ${rows.length} systems:`);
console.log(`   planets rendering craters (Planet.js, ported)      ${totCraterPlanets}`);
console.log(`   moons that DERIVE a crater record                  ${totMoonCrat} of ${totMoons}`);
console.log(`   moons that RENDER one (Moon.js has no port)         0`);
console.log('');
