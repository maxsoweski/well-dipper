// tools/port-crater-measure.mjs — what the world engine's BOMBARDMENT schedule produces for REAL
// game bodies, and what crater band the game can actually SEE.
//
// Run: node tools/port-crater-measure.mjs
//
// WHY THIS EXISTS. The lab's in-shader crater synth (planet-lod-lab.html, the inc3b S3-fix block,
// pinned by tests/worldengine-inc3b-synth-law.test.js) deliberately renders ONLY the SUB-FLOOR band
// of the size-frequency distribution — every crater too small for the lab's display mesh to stamp
// as real geometry. The lab's big craters are not shader work at all; they are a per-planet BAKE.
//
// The game has no stamp pass and no bake. So transcribing the lab's law unchanged would hand the
// game the one band it cannot see: sub-floor craters are, by construction, at most
// MESH_FLOOR_RAD = 0.055 rad across, and the geometric-mean pick lands ~5e-3 rad — under two pixels
// on a planet filling a quarter of the screen. This script measures that claim instead of assuming
// it, and prices the alternative bands.
//
// READ THE OUTPUT FOR THREE THINGS:
//   1. SECTION 1 — does the schedule even fire on the game's bodies, and on how many? (The lab's
//      presets are hand-picked airless worlds; the game's population is not.)
//   2. SECTION 2 — the angular size each candidate band produces, in units of planet radius, next
//      to what a pixel is worth at a realistic viewing size. This is the band decision.
//   3. SECTION 3 — density. One voronoi cell hosts at most one crater, so the synth saturates at a
//      covered fraction of CELL_CRATER_AREA ~ 0.454 no matter how bombarded the world is.
import { PlanetGenerator } from '../src/generation/PlanetGenerator.js';
import { SeededRandom } from '../src/generation/SeededRandom.js';
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
import {
  craterSchedule, craterRelevanceOf, isImpactSurface,
  C_BASIN, MESH_FLOOR_RAD,
} from '../src/worldengine/base/bombardment.js';
import { radPerKm } from '../src/worldengine/base/baseStep.js';
import { coverageBand, CELL_CRATER_AREA } from '../src/worldengine/port/craterUniforms.js';

// The shader hashes a crater's radius as mix(0.18, 0.55) cell units (planet-lod-height.glsl.js,
// craterCombiner). Diameter = 2·that. Both constants are shader facts, not tunables.
const HASH_TAIL_MAX = 2.0 * 0.55;
// E[craterRadius] over the same hash — the median-ish crater, for reporting an honest on-screen size
// rather than the D_char the law is written in (D_char is the CELL size, not the crater size).
const E_CRATER_RADIUS = 0.18 + 0.37 / 2;

// A candidate band -> the uniform triple the shader wants. `lo`/`hi` in km.
// coverageBand and CELL_CRATER_AREA are IMPORTED from the shipped law rather than re-derived here —
// this script exists to price the law, so a second copy of it would price the wrong thing.
function bandLaw(sch, RE, lo, hi) {
  const rpk = radPerKm(RE);
  const Dchar = Math.sqrt(Math.max(lo, 1e-9) * Math.max(hi, 1e-9));
  const coverage = coverageBand(sch, rpk, lo, hi);
  return {
    Dchar,
    scale: (RE * 6371) / Dchar,                                   // featureFrequencyFromKm, C_CRATER = 1
    density: Math.max(0, Math.min(1, coverage / CELL_CRATER_AREA)),
    rawDensity: coverage / CELL_CRATER_AREA,                      // pre-clamp, to see saturation
    amp: rpk * Dchar,                                             // D_D_SIMPLE/CRATER_DEPTH == 1.0 today
    // On-screen: the mean crater's DIAMETER as a fraction of the planet's radius.
    angDiam: 2 * E_CRATER_RADIUS * Dchar * rpk,
  };
}

const rng = new SeededRandom(20260731);
const TYPES = ['rocky', 'ice', 'lava', 'ocean', 'terrestrial', 'venus', 'carbon'];
const ORBITS = [0.4, 0.8, 1.5, 3.0, 6.0, 12.0];
const N_PER = 12;

const rows = [];
for (const t of TYPES) {
  for (const au of ORBITS) {
    for (let i = 0; i < N_PER; i++) {
      let p;
      try { p = PlanetGenerator.generate(rng, au, null, null, t); } catch { continue; }
      const cond = conditionFromPlanet(p);
      const sch = craterSchedule(cond);
      rows.push({ t, au, p, cond, sch, rel: craterRelevanceOf(cond), impact: isImpactSurface(cond) });
    }
  }
}

const n = rows.length;
const fired = rows.filter(r => r.sch.fired);
const relevant = rows.filter(r => r.rel === 1);
console.log(`\n═══ SECTION 1 — does the schedule fire on the game's bodies? (${n} bodies, ${TYPES.length} types x ${ORBITS.length} orbits x ${N_PER}) ═══\n`);
console.log(`isImpactSurface : ${rows.filter(r => r.impact).length}/${n}`);
console.log(`schedule fired  : ${fired.length}/${n}`);
console.log(`craterRelevance : ${relevant.length}/${n}   <- the condition-derived 0/1 gate the lab uses\n`);
console.log('type'.padEnd(12), 'impact'.padStart(7), 'fired'.padStart(6), 'relevant'.padStart(9),
  'median tExp'.padStart(12), 'median cover'.padStart(13), 'median regolith'.padStart(16));
const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;
for (const t of TYPES) {
  const g = rows.filter(r => r.t === t);
  console.log(t.padEnd(12),
    `${g.filter(r => r.impact).length}/${g.length}`.padStart(7),
    `${g.filter(r => r.sch.fired).length}`.padStart(6),
    `${g.filter(r => r.rel === 1).length}`.padStart(9),
    med(g.map(r => r.sch.tExp)).toExponential(2).padStart(12),
    med(g.map(r => r.sch.coverage)).toExponential(2).padStart(13),
    med(g.map(r => r.sch.regolithRoughness)).toExponential(2).padStart(16));
}

// ── SECTION 2 — the band decision ────────────────────────────────────────────────────────────────
console.log(`\n═══ SECTION 2 — angular crater size per candidate band ═══`);
console.log(`A planet drawn as a disc 400 px across has a 200 px radius, so an angular diameter of`);
console.log(`x radii is 200x pixels. Anything under ~2 px is aliasing noise, not a crater.\n`);
console.log(`MESH_FLOOR_RAD = ${MESH_FLOOR_RAD} rad, C_BASIN = ${C_BASIN} (H = C_BASIN x R_km)\n`);

const BANDS = (sch, RE) => {
  const rpk = radPerKm(RE);
  const R_km = RE * 6371;
  const L = sch.D_LO_KM * sch.sizeMul;
  const H = sch.D_HI_KM;
  const floor = sch.D_FLOOR_KM;
  return {
    // What the lab ships: sub-floor only, plus the anti-double-render clamp.
    'sub-floor (LAB)': { lo: L, hi: Math.min(floor, H), clampTo: floor / HASH_TAIL_MAX },
    // The whole distribution, floor to basin.
    'full SFD': { lo: L, hi: H },
    // Only what the raster can resolve: craters at least VIS rad across.
    'vis 0.02 rad': { lo: Math.max(L, 0.02 * R_km), hi: H },
    'vis 0.05 rad': { lo: Math.max(L, 0.05 * R_km), hi: H },
    'vis 0.10 rad': { lo: Math.max(L, 0.10 * R_km), hi: H },
  };
};

// ⚠ The band question CANNOT be answered on the generated population, because SECTION 1 shows it
// derives no crater record at all. It is answered on the bodies that DO have one: Sol's airless
// worlds, whose hand-authored records carry `atmosphere: null` and therefore erosion 0.
const sol = [];
for (const w of generateSolarSystem().planets) {
  const push = (b, label) => {
    const cond = conditionFromPlanet(b);
    const sch = craterSchedule(cond);
    if (sch.fired) sol.push({ label, b, cond, sch, rel: craterRelevanceOf(cond) });
  };
  push(w.planetData, w.planetData.name || w.planetData.profileId || w.planetData.type);
  for (const m of (w.moons || [])) push(m, '  ' + (m.name || m.profileId || m.type));
}

const SHOW = ['sol-mercury', '  sol-moon', '  sol-callisto', '  sol-europa', 'rocky', '  sol-triton'];
for (const r of sol.filter(x => SHOW.includes(x.label))) {
  const RE = r.cond.radiusEarth;
  console.log(`── ${r.label.trim()} (${r.b.type}), R = ${RE.toFixed(3)} R⊕ (${(RE * 6371).toFixed(0)} km), tExp = ${r.sch.tExp.toFixed(2)} Ga`);
  console.log('   band'.padEnd(20), 'D_char km'.padStart(11), 'uCraterScale'.padStart(13),
    'ang.diam (R)'.padStart(13), 'px @200R'.padStart(9), 'density'.padStart(9), 'raw dens'.padStart(10));
  for (const [name, b] of Object.entries(BANDS(r.sch, RE))) {
    const law = applyLabClamp(bandLaw(r.sch, RE, b.lo, b.hi), b, r.sch, RE);
    console.log(`   ${name}`.padEnd(20), law.Dchar.toFixed(2).padStart(11), law.scale.toFixed(1).padStart(13),
      law.angDiam.toExponential(2).padStart(13), (law.angDiam * 200).toFixed(1).padStart(9),
      law.density.toFixed(4).padStart(9), law.rawDensity.toExponential(2).padStart(10));
  }
  console.log('');
}

// reproduce the lab's F3 anti-double-render clamp, then re-derive the reported numbers from it
function applyLabClamp(law, b, sch, RE) {
  if (!b.clampTo || law.Dchar <= b.clampTo) return law;
  const rpk = radPerKm(RE);
  return {
    ...law,
    Dchar: b.clampTo,
    scale: (RE * 6371) / b.clampTo,
    angDiam: 2 * E_CRATER_RADIUS * b.clampTo * rpk,
    density: Math.max(0, Math.min(1, sch.regolithRoughness / CELL_CRATER_AREA)),
    rawDensity: sch.regolithRoughness / CELL_CRATER_AREA,
  };
}

// ── SECTION 3 — population under each band ───────────────────────────────────────────────────────
console.log(`═══ SECTION 3 — the ${sol.length} Sol bodies whose schedule fires, per band ═══`);
console.log(`"renders" = density > 0.01 (below that a body shows under 1 crater per 100 cells).\n`);
console.log('band'.padEnd(20), 'renders'.padStart(9), 'med density'.padStart(12), 'med px@200R'.padStart(12), 'saturated'.padStart(10));
const BAND_NAMES = ['sub-floor (LAB)', 'full SFD', 'vis 0.02 rad', 'vis 0.05 rad', 'vis 0.10 rad'];
for (const name of BAND_NAMES) {
  const laws = [];
  for (const r of sol) {
    const RE = r.cond.radiusEarth;
    const b = BANDS(r.sch, RE)[name];
    if (!(b.hi > b.lo)) continue;
    laws.push(applyLabClamp(bandLaw(r.sch, RE, b.lo, b.hi), b, r.sch, RE));
  }
  const vis = laws.filter(l => l.density > 0.01);
  console.log(name.padEnd(20), `${vis.length}/${sol.length}`.padStart(9),
    med(laws.map(l => l.density)).toFixed(4).padStart(12),
    (med(laws.map(l => l.angDiam)) * 200).toFixed(1).padStart(12),
    `${laws.filter(l => l.rawDensity >= 1).length}`.padStart(10));
}
console.log('');
