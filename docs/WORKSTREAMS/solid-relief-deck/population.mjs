// READ-ONLY population read for the solidRelief deck: for each of the 13 unforwarded master
// gates, how many of the 124 solid corpus bodies would receive a NON-ZERO value if a pack
// forwarded the lab's own law, and how many DISTINCT values it takes.
// Corpus = the 24 standard seeds rocky-0..rocky-23 (same corpus as coverage-audit-2026-09-03).
import { StarSystemGenerator } from '/home/ax/projects/well-dipper/src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '/home/ax/projects/well-dipper/src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '/home/ax/projects/well-dipper/src/worldengine/base/e1Regime.js';
import { deriveUniforms } from '/home/ax/projects/well-dipper/src/worldengine/base/labCore.js';
import { setLabGasBodiesOverride } from '/home/ax/projects/well-dipper/src/objects/Planet.js';
import { writeFileSync } from 'node:fs';

setLabGasBodiesOverride(true);
const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ss = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

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

const solid = corpus().filter((b) => b.cls !== 'gas');

const rows = [];
for (const b of solid) {
  const c = b.cond;
  const u = deriveUniforms(c);
  // --- the four lab-HTML laws, transcribed from world-engine-lab.html for MEASUREMENT ONLY ---
  const erosion = c.surfaceHistory?.erosion ?? c.surfaceHistory?.erosionLevel ?? 0;   // both spellings (ROOT-0 fix 1)
  const stab = u.liquidStability;
  const wet = stab > 0.15;                                                    // world-engine-lab.html:2131
  const hadLiquid = !!(c.atmosphere && c.atmosphere.retained !== false);      // world-engine-lab.html:2135
  const press = hadLiquid ? (c.atmosphere.pressure ?? 1.0) : 0;               // world-engine-lab.html:2186
  const noSurface = c.atmosphere?.composition === 'h2-he';                    // world-engine-lab.html:2202
  const karstDensity = wet ? clamp01(stab * (0.4 + 0.6 * erosion)) : (hadLiquid ? 0.4 * clamp01(erosion) : 0.0);  // :2175
  const duneDensity = clamp01(ss(0.05, 0.3, press) * (1.0 - 0.65 * stab));    // world-engine-lab.html:2187
  const dustDepth = noSurface ? 0.0 : clamp01(ss(0.05, 0.3, press) * (1.0 - 0.65 * stab) * (0.3 + 0.7 * erosion)); // :2203
  const massWastDensity = 1.0;                                               // world-engine-lab.html:2218 (constant)
  const sh = c.surfaceHistory ?? {};                                          // world-engine-lab.html:2747
  const facetClass = !c.atmosphere && (sh.erosion ?? sh.erosionLevel ?? 0) < 0.05
    && (sh.resurfacingRate ?? 0) < 0.05 && (sh.bombardmentIntensity ?? 0) < 0.2;
  const facetStrength = facetClass ? 1.0 : 0.0;                               // world-engine-lab.html:2752
  const hab = c.habitability ?? 0;                                            // world-engine-lab.html:1972
  const habGate = (() => { const t = clamp01((hab - 0.1) / 0.3); return t * t * (3 - 2 * t); })();  // :1973
  const bioCoverage = 0.45 * habGate;                                         // :5077 (0.45 = the lab's slider default, :1078)

  rows.push({
    id: b.id, kind: b.kind, radiusEarth: c.radiusEarth ?? null,
    // ── the seven that ARE in labCore.deriveUniforms ──
    uMountainAmp: u.mountainAmp, uChasmaDepth: u.chasmaDepth, uScarpStrength: u.scarpStrength,
    uPlateauStrength: u.plateauStrength, uTesseraStrength: u.tesseraStrength,
    uLavaCoverage: u.lavaCoverage, uSubStrength: u.subStrength,
    // ── the six whose law lives ONLY in world-engine-lab.html ──
    uKarstDensity: karstDensity, uDuneDensity: duneDensity, uDustDepth: dustDepth,
    uMassWastDensity: massWastDensity, uFacetStrength: facetStrength, uBioCoverage: bioCoverage,
    _habGate: habGate, _wet: wet, _hadLiquid: hadLiquid, _erosion: erosion, _stab: stab,
  });
}

const GATES = ['uMountainAmp','uChasmaDepth','uScarpStrength','uPlateauStrength','uTesseraStrength',
  'uLavaCoverage','uSubStrength','uKarstDensity','uDuneDensity','uDustDepth','uMassWastDensity',
  'uFacetStrength','uBioCoverage'];
const summary = {};
for (const g of GATES) {
  const vals = rows.map((r) => r[g]);
  const nz = vals.filter((v) => v > 0);
  const distinct = new Set(vals.map((v) => v.toFixed(9))).size;
  const sorted = nz.slice().sort((a, b) => a - b);
  summary[g] = {
    nonZero: nz.length, of: rows.length, distinct,
    min: nz.length ? sorted[0] : 0, max: nz.length ? sorted[sorted.length-1] : 0,
    median: nz.length ? sorted[Math.floor(sorted.length/2)] : 0,
    nonZeroPlanets: rows.filter(r => r.kind === 'planet' && r[g] > 0).length,
    nonZeroMoons: rows.filter(r => r.kind !== 'planet' && r[g] > 0).length,
  };
}
const planets = rows.filter(r => r.kind === 'planet').length;
writeFileSync(new URL('./population.json', import.meta.url), JSON.stringify({ nSolid: rows.length, planets, moons: rows.length - planets, summary, rows }, null, 1));
console.log(`corpus: ${rows.length} solid (${planets} planets / ${rows.length - planets} moons)\n`);
console.log('gate'.padEnd(18), 'non-zero'.padStart(9), 'distinct'.padStart(9), 'median'.padStart(10), 'max'.padStart(10), '  pl/mn nonzero');
for (const g of GATES) {
  const s = summary[g];
  console.log(g.padEnd(18), `${s.nonZero}/${s.of}`.padStart(9), String(s.distinct).padStart(9),
    s.median.toFixed(5).padStart(10), s.max.toFixed(5).padStart(10), `  ${s.nonZeroPlanets}/${s.nonZeroMoons}`);
}
