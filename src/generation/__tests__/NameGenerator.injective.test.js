// NameGenerator injectivity — structural proof that procedural system naming is
// unique BY CONSTRUCTION (AC6) and revisit-stable on every path (AC7), per
// docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/ac5-decision.md.
//
// This is NOT a statistical/flaky test: the name is a pure, deterministic,
// injective function of canonical galactic position, so these assertions hold
// exactly (0 duplicates among distinct position cells, 0 real-name emissions).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SeededRandom } from '../SeededRandom.js';
import { generateSystemName, quantizePosition } from '../NameGenerator.js';
import { REAL_PROPER_NAME_SET } from '../data/realProperNames.js';

// Real astronomical-designation prefixes the procgen catalog class must never
// intrude on (real designation space). Includes the legacy CATALOG_FORMATS
// prefixes plus common real catalogues.
const REAL_DESIGNATION_PREFIXES = [
  'HD', 'HR', 'GJ', 'HIP', 'TYC', 'WISE', 'TOI', 'KOI', 'Kepler', 'TRAPPIST',
  'LHS', 'Ross', 'Wolf', '2MASS', 'SDSS', 'Gaia', 'TIC', 'KIC', 'GSC', 'UCAC',
  'Groombridge', 'Lacaille',
];
const REAL_DESIGNATION_RE = new RegExp(`^(?:${REAL_DESIGNATION_PREFIXES.join('|')})[\\s-]`);

// Region geometry mirrors NameGenerator._classifyRegion. Uniform jittered
// sampling within each bucket (like real star worldX/Y/Z, not round lattice pts).
const REGIONS = ['core', 'arm', 'rim', 'halo'];
function samplePos(region, rng) {
  let r, h;
  if (region === 'core') { r = rng.range(0, 3); h = rng.range(-2, 2); }
  else if (region === 'rim') { r = rng.range(14, 18); h = rng.range(-2, 2); }
  else if (region === 'halo') { r = rng.range(0, 12); h = (rng.chance(0.5) ? 1 : -1) * rng.range(2.05, 5); }
  else { r = rng.range(3, 14); h = rng.range(-2, 2); }
  const th = rng.range(0, Math.PI * 2);
  return { x: r * Math.cos(th), y: h, z: r * Math.sin(th) };
}

// Reproduce the four production call-site RNG chains verbatim. The rng is
// IGNORED by the position-derived namer, so all four MUST agree — that is the
// property being proven.
function nameViaSkyClick(pos, idx) {
  return generateSystemName(new SeededRandom(`warp-star-${idx}`).child('names').child('system'), pos);
}
function nameViaNav(pos, seed) {
  return generateSystemName(new SeededRandom(`warp-nav-${seed}`), pos);
}
function nameViaFeature(pos, seed) {
  return generateSystemName(new SeededRandom(`feat-${seed}`).child('names').child('system'), pos);
}
function nameViaSpawn(pos, seed) {
  // generateSystemNames-internal chain: new SeededRandom(seed).child('names').child('system')
  return generateSystemName(new SeededRandom(String(seed)).child('names').child('system'), pos);
}

describe('NameGenerator — injective position→name (AC6/AC7)', () => {
  const PER_REGION = 55000; // 220,000 total (> the 200k bar)

  // Build the whole sample once, keyed by quantization cell.
  const posRng = new SeededRandom('injectivity-test-positions-v1');
  const cellToName = new Map();   // cell key -> name (revisit-stability ledger)
  const nameToCell = new Map();   // name -> cell key (uniqueness ledger)
  let dupNameAcrossCells = 0;
  let revisitMismatch = 0;
  let realNameEmissions = 0;
  let realDesignationEmissions = 0;
  let bareCount = 0, surveyCount = 0, multipartCount = 0;
  const perRegionNames = { core: 0, arm: 0, rim: 0, halo: 0 };

  for (const region of REGIONS) {
    for (let i = 0; i < PER_REGION; i++) {
      const pos = samplePos(region, posRng);
      const key = quantizePosition(pos).key;
      const name = generateSystemName(null, pos);
      perRegionNames[region]++;

      // Revisit stability: same cell must always give the same name.
      if (cellToName.has(key)) {
        if (cellToName.get(key) !== name) revisitMismatch++;
      } else {
        cellToName.set(key, name);
      }

      // Uniqueness: a name may only ever belong to ONE cell.
      const prevCell = nameToCell.get(name);
      if (prevCell !== undefined && prevCell !== key) dupNameAcrossCells++;
      else nameToCell.set(name, key);

      if (REAL_PROPER_NAME_SET.has(name.toLowerCase())) realNameEmissions++;
      if (REAL_DESIGNATION_RE.test(name)) realDesignationEmissions++;

      if (!name.includes('-') && !/\d/.test(name)) bareCount++;
      else if (/^[A-Z]{2,4}-/.test(name)) surveyCount++;
      else multipartCount++;
    }
  }

  it('samples >= 200k positions across all four region buckets', () => {
    const total = Object.values(perRegionNames).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(200000);
    for (const region of REGIONS) expect(perRegionNames[region]).toBeGreaterThan(0);
  });

  it('produces ZERO duplicate names across distinct position cells (injective by construction)', () => {
    expect(dupNameAcrossCells).toBe(0);
    // distinct names must equal distinct cells exactly.
    expect(nameToCell.size).toBe(cellToName.size);
  });

  it('is revisit-stable: the same position always yields the same name', () => {
    expect(revisitMismatch).toBe(0);
  });

  it('never emits a real star proper name (blocklist enforced structurally)', () => {
    expect(realNameEmissions).toBe(0);
  });

  it('never emits a designation in real designation space (fictional survey prefixes)', () => {
    expect(realDesignationEmissions).toBe(0);
  });

  it('cross-checks the full HYG catalog: zero exact collisions with any real name', () => {
    const hygPath = fileURLToPath(new URL('../../../public/assets/data/hyg-stars.json', import.meta.url));
    const hyg = JSON.parse(readFileSync(hygPath, 'utf-8'));
    const meaningful = new Set(hyg.map(s => s.name).filter(n => n && n !== '"'));
    let collisions = 0;
    for (const name of nameToCell.keys()) if (meaningful.has(name)) collisions++;
    expect(collisions).toBe(0);
  });

  it('exercises all three name classes over the sample', () => {
    // Common classes both well represented; bare is rare (may be 0 in a uniform
    // galaxy-wide sample — it is showcased separately by the census tool).
    expect(surveyCount).toBeGreaterThan(0);
    expect(multipartCount).toBeGreaterThan(0);
    expect(surveyCount + multipartCount + bareCount).toBe(PER_REGION * REGIONS.length);
  });

  it('agrees across ALL targeting paths for the same position (AC7)', () => {
    // For a spread of positions, the sky-click / nav / feature / spawn call-site
    // chains — which pass different seed strings — must all produce one name.
    const pathRng = new SeededRandom('path-agreement-positions');
    for (let i = 0; i < 5000; i++) {
      const region = REGIONS[i % 4];
      const pos = samplePos(region, pathRng);
      const a = nameViaSkyClick(pos, i);
      const b = nameViaNav(pos, 90000 + i);
      const c = nameViaFeature(pos, 500 + i);
      const d = nameViaSpawn(pos, `sys-${i}`);
      expect(b).toBe(a);
      expect(c).toBe(a);
      expect(d).toBe(a);
    }
  });

  it('throws (does not silently fall back) when position is missing (D5 eliminated)', () => {
    expect(() => generateSystemName(new SeededRandom('x'), null)).toThrow(/no-position fallback eliminated|canonical galacticPos/);
    expect(() => generateSystemName(new SeededRandom('x'), { x: NaN, y: 0, z: 0 })).toThrow();
  });
});
