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
import { generateSystemName, quantizePosition, enumerateSettledSystems, _bareEligible } from '../NameGenerator.js';
import { REAL_PROPER_NAME_SET } from '../data/realProperNames.js';

// Structural shapes of the four name classes (increment 3c). Each is injective in
// the position locator L; the shapes are mutually exclusive.
const RE_SURVEY = /^[A-Z]{2,4} J[0-9A-Z]{7}[+-][0-9A-Z]{7}$/;   // "NBG J35EI75F-KN0H841"
const RE_MULTIPART = /^[A-Z][a-z]+-[0-9A-Z]{10}$/;              // "Tosnud-6PCUPG2IJU"
const RE_GREEK = /^[A-Z][a-z]+ [A-Z][a-z]+ \d{5}$/;            // "Theta Karnun… 07437"
const RE_BARE = /^[A-Z][a-z]+$/;                                // "Tukgotpigyodcop"
function classify(name) {
  if (RE_SURVEY.test(name)) return 'survey';
  if (RE_GREEK.test(name)) return 'greek';
  if (RE_MULTIPART.test(name)) return 'multipart';
  if (RE_BARE.test(name)) return 'bare';
  return 'UNKNOWN';
}

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
  let unknownShape = 0, tooLong = 0;
  const classCount = { survey: 0, greek: 0, multipart: 0, bare: 0, UNKNOWN: 0 };
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

      const cls = classify(name);
      classCount[cls]++;
      if (cls === 'UNKNOWN') unknownShape++;
      // Aesthetic length bound (bit floor: ~70-bit locator → greek is the longest
      // shape; all classes must stay ≤ 30 visible chars).
      if (name.length > 30) tooLong++;
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

  it('every emitted name matches exactly one of the four class shapes', () => {
    // No name may fall outside the survey/greek/multipart/bare grammars, and
    // none may exceed the 30-char aesthetic bound.
    expect(unknownShape).toBe(0);
    expect(classCount.UNKNOWN).toBe(0);
    expect(tooLong).toBe(0);
  });

  it('exercises the common name classes (survey / greek / multipart) over the sample', () => {
    // The three common classes are all well represented; bare is rare (may be 0
    // in a uniform galaxy-wide sample — it is showcased separately by the census).
    expect(classCount.survey).toBeGreaterThan(0);
    expect(classCount.greek).toBeGreaterThan(0);
    expect(classCount.multipart).toBeGreaterThan(0);
    expect(classCount.survey + classCount.greek + classCount.multipart + classCount.bare)
      .toBe(PER_REGION * REGIONS.length);
  });

  it('survey designations obey the structured grouped format (not an opaque serial)', () => {
    // Sample survey-class names and assert the prefix / J-epoch / two coordinate
    // fields / latitude-sign structure, plus the length bound.
    const fmtRng = new SeededRandom('survey-format-positions');
    let checked = 0;
    for (let i = 0; i < 40000 && checked < 500; i++) {
      const pos = samplePos(REGIONS[i % 4], fmtRng);
      const name = generateSystemName(null, pos);
      if (classify(name) !== 'survey') continue;
      checked++;
      expect(name).toMatch(RE_SURVEY);
      expect(name.length).toBeLessThanOrEqual(20);
      // structurally disjoint from real designation space
      expect(REAL_DESIGNATION_RE.test(name)).toBe(false);
    }
    expect(checked).toBeGreaterThan(0);
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

  it('enumerates settled systems that round-trip through generateSystemName (AC: enumerability)', () => {
    // Enumerate bare-eligible (settled) systems in several disk boxes and assert
    // each one is genuinely bare, bare-eligible, unique, and reproduces its own
    // name when re-generated from its position — the mechanical basis for a future
    // in-game settled-systems catalog (ac5 addendum ruling 2).
    const boxes = [
      { xMin: 6.9, xMax: 7.6, yMin: -0.3, yMax: 0.4, zMin: 0.9, zMax: 1.6 },
      { xMin: -9.4, xMax: -8.7, yMin: -0.1, yMax: 0.6, zMin: 3.1, zMax: 3.8 },
      { xMin: 15.1, xMax: 15.8, yMin: -0.4, yMax: 0.3, zMin: -2.4, zMax: -1.7 },
      { xMin: 1.7, xMax: 2.4, yMin: 3.0, yMax: 3.7, zMin: 0.5, zMax: 1.2 },
    ];
    let totalEnumerated = 0;
    const namesSeen = new Set();
    for (const box of boxes) {
      const list = enumerateSettledSystems(box, 5000);
      expect(list.length).toBeGreaterThan(0);
      for (const s of list) {
        totalEnumerated++;
        // genuinely bare
        expect(s.name).toMatch(RE_BARE);
        // bare-eligible cell
        const q = quantizePosition(s.position);
        expect(_bareEligible(q.qx, q.qy, q.qz)).toBe(true);
        // round-trips: re-generating from the position yields the same name
        expect(generateSystemName(null, s.position)).toBe(s.name);
        // not a real proper name
        expect(REAL_PROPER_NAME_SET.has(s.name.toLowerCase())).toBe(false);
        // globally unique across every box enumerated here
        expect(namesSeen.has(s.name)).toBe(false);
        namesSeen.add(s.name);
      }
    }
    expect(totalEnumerated).toBeGreaterThan(50);
  });

  it('throws (does not silently fall back) when position is missing (D5 eliminated)', () => {
    expect(() => generateSystemName(new SeededRandom('x'), null)).toThrow(/no-position fallback eliminated|canonical galacticPos/);
    expect(() => generateSystemName(new SeededRandom('x'), { x: NaN, y: 0, z: 0 })).toThrow();
  });
});
