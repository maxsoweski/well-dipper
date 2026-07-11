// NameGenerator injectivity — structural proof that system naming is unique BY
// CONSTRUCTION (AC6) and revisit-stable on every path (AC7), per
// docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/ac5-decision.md.
//
// Increment 3e (Addendum 3): naming resolves in the order
//   named-systems catalog (shipped, finite) → procgen (survey | multipart).
// Uniqueness end to end: catalog uniqueness by BUILD-TIME check; procgen
// injective in the position locator L; the two procgen shapes are structurally
// disjoint from the two catalog shapes, so procgen can never collide with a
// catalog name. These assertions are exact, not statistical.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SeededRandom } from '../SeededRandom.js';
import {
  generateSystemName, quantizePosition, locatorKey, positionForKey,
  getNamedSystemsMap, enumerateNamedSystems,
} from '../NameGenerator.js';
import { REAL_PROPER_NAME_SET } from '../data/realProperNames.js';

// ── Name shapes ──────────────────────────────────────────────────────────────
// Procgen (two classes, increment 3e): survey / multipart. Each injective in L.
const RE_SURVEY = /^[A-Z]{2,4} J[0-9A-Z]{7}[+-][0-9A-Z]{7}$/;   // "NBG J35EI75F-KN0H841"
const RE_MULTIPART = /^[A-Z][a-z]+-[0-9A-Z]{10}$/;              // "Tosnud-6PCUPG2IJU"
// Catalog (two classes, shipped): settled bare word / greek notable.
const RE_SETTLED = /^[A-Z][a-z]+$/;                             // "Veshara"
const RE_GREEK = /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/;          // "Alpha Vozara 4821"

function classify(name) {
  if (RE_SURVEY.test(name)) return 'survey';
  if (RE_MULTIPART.test(name)) return 'multipart';
  if (RE_GREEK.test(name)) return 'greek';
  if (RE_SETTLED.test(name)) return 'settled';
  return 'UNKNOWN';
}

const REAL_DESIGNATION_PREFIXES = [
  'HD', 'HR', 'GJ', 'HIP', 'TYC', 'WISE', 'TOI', 'KOI', 'Kepler', 'TRAPPIST',
  'LHS', 'Ross', 'Wolf', '2MASS', 'SDSS', 'Gaia', 'TIC', 'KIC', 'GSC', 'UCAC',
  'Groombridge', 'Lacaille',
];
const REAL_DESIGNATION_RE = new RegExp(`^(?:${REAL_DESIGNATION_PREFIXES.join('|')})[\\s-]`);

// Region geometry mirrors NameGenerator._classifyRegion.
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

// Four production call-site RNG chains. The namer IGNORES the rng, so all four
// MUST agree — for procgen positions AND catalog positions.
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
  return generateSystemName(new SeededRandom(String(seed)).child('names').child('system'), pos);
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — PROCGEN INJECTIVITY over >= 220k random positions
// ─────────────────────────────────────────────────────────────────────────────
describe('NameGenerator — injective position→name, procgen (AC6/AC7)', () => {
  const PER_REGION = 55000; // 220,000 total (> the 200k bar)

  const posRng = new SeededRandom('injectivity-test-positions-v1');
  const cellToName = new Map();
  const nameToCell = new Map();
  let dupNameAcrossCells = 0;
  let revisitMismatch = 0;
  let realNameEmissions = 0;
  let realDesignationEmissions = 0;
  let unknownShape = 0, tooLong = 0;
  const classCount = { survey: 0, multipart: 0, greek: 0, settled: 0, UNKNOWN: 0 };
  const perRegionNames = { core: 0, arm: 0, rim: 0, halo: 0 };

  for (const region of REGIONS) {
    for (let i = 0; i < PER_REGION; i++) {
      const pos = samplePos(region, posRng);
      const key = quantizePosition(pos).key;
      const name = generateSystemName(null, pos);
      perRegionNames[region]++;

      if (cellToName.has(key)) {
        if (cellToName.get(key) !== name) revisitMismatch++;
      } else {
        cellToName.set(key, name);
      }

      const prevCell = nameToCell.get(name);
      if (prevCell !== undefined && prevCell !== key) dupNameAcrossCells++;
      else nameToCell.set(name, key);

      if (REAL_PROPER_NAME_SET.has(name.toLowerCase())) realNameEmissions++;
      if (REAL_DESIGNATION_RE.test(name)) realDesignationEmissions++;

      const cls = classify(name);
      classCount[cls]++;
      if (cls === 'UNKNOWN') unknownShape++;
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
    expect(nameToCell.size).toBe(cellToName.size);
  });

  it('is revisit-stable: the same position always yields the same name', () => {
    expect(revisitMismatch).toBe(0);
  });

  it('never emits a real star proper name', () => {
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

  it('every emitted name matches exactly one known shape; none exceeds 30 chars', () => {
    expect(unknownShape).toBe(0);
    expect(classCount.UNKNOWN).toBe(0);
    expect(tooLong).toBe(0);
  });

  it('procgen output is exactly the two survey/multipart classes; random positions ~never hit the catalog', () => {
    // Random continuous positions almost never coincide with a discrete catalog
    // cell, so procgen dominates and catalog-shape hits are ~0.
    expect(classCount.survey).toBeGreaterThan(0);
    expect(classCount.multipart).toBeGreaterThan(0);
    // Catalog shapes should be vanishingly rare from uniform sampling.
    expect(classCount.settled + classCount.greek).toBeLessThan(50);
  });

  it('survey designations obey the structured grouped format (not an opaque serial)', () => {
    const fmtRng = new SeededRandom('survey-format-positions');
    let checked = 0;
    for (let i = 0; i < 40000 && checked < 500; i++) {
      const pos = samplePos(REGIONS[i % 4], fmtRng);
      const name = generateSystemName(null, pos);
      if (classify(name) !== 'survey') continue;
      checked++;
      expect(name).toMatch(RE_SURVEY);
      expect(name.length).toBeLessThanOrEqual(20);
      expect(REAL_DESIGNATION_RE.test(name)).toBe(false);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('agrees across ALL targeting paths for the same procgen position (AC7)', () => {
    const pathRng = new SeededRandom('path-agreement-positions');
    for (let i = 0; i < 5000; i++) {
      const region = REGIONS[i % 4];
      const pos = samplePos(region, pathRng);
      const a = nameViaSkyClick(pos, i);
      expect(nameViaNav(pos, 90000 + i)).toBe(a);
      expect(nameViaFeature(pos, 500 + i)).toBe(a);
      expect(nameViaSpawn(pos, `sys-${i}`)).toBe(a);
    }
  });

  it('throws (does not silently fall back) when position is missing (D5 eliminated)', () => {
    expect(() => generateSystemName(new SeededRandom('x'), null)).toThrow(/no-position fallback eliminated|canonical galacticPos/);
    expect(() => generateSystemName(new SeededRandom('x'), { x: NaN, y: 0, z: 0 })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — NAMED-SYSTEMS CATALOG (the fifth real-object mechanism)
// ─────────────────────────────────────────────────────────────────────────────
describe('NameGenerator — named-systems catalog (increment 3e)', () => {
  const catalog = getNamedSystemsMap();
  const entries = [...catalog.entries()]; // [key, name]

  it('ships a non-trivial catalog (~12k settled + greek notables)', () => {
    expect(entries.length).toBeGreaterThan(20000);
  });

  it('every catalog entry is unique in name AND key, and blocklist-clean', () => {
    const names = new Set();
    const keys = new Set();
    let dupName = 0, dupKey = 0, blocklistHit = 0, badShape = 0, procgenShape = 0;
    for (const [key, name] of entries) {
      if (names.has(name)) dupName++; else names.add(name);
      if (keys.has(key)) dupKey++; else keys.add(key);
      const cls = classify(name);
      if (cls !== 'settled' && cls !== 'greek') badShape++;
      if (RE_SURVEY.test(name) || RE_MULTIPART.test(name)) procgenShape++;
      const token = cls === 'settled' ? name : name.split(' ')[1];
      if (token && REAL_PROPER_NAME_SET.has(token.toLowerCase())) blocklistHit++;
    }
    expect(dupName).toBe(0);
    expect(dupKey).toBe(0);
    expect(blocklistHit).toBe(0);
    expect(badShape).toBe(0);      // every entry is a bare or greek shape
    expect(procgenShape).toBe(0);  // no entry wears a survey/multipart shape
    expect(names.size).toBe(entries.length);
    expect(keys.size).toBe(entries.length);
  });

  it('every entry round-trips: key → representative position → same catalog name (sampled)', () => {
    let checked = 0, miss = 0, keyMiss = 0, unstable = 0;
    for (let i = 0; i < entries.length; i += 47) { // ~1000 samples
      const [key, name] = entries[i];
      const pos = positionForKey(key);
      // lattice-key round-trip
      if (locatorKey(pos) !== key) keyMiss++;
      // catalog hit through the real generateSystemName
      const got = generateSystemName(null, pos);
      if (got !== name) miss++;
      // lookup stability: same position twice
      if (generateSystemName(null, pos) !== got) unstable++;
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
    expect(keyMiss).toBe(0);
    expect(miss).toBe(0);
    expect(unstable).toBe(0);
  });

  it('agrees across ALL targeting paths for a catalog position (AC7, catalog hits)', () => {
    for (let i = 0; i < entries.length; i += 613) { // ~80 samples
      const [key, name] = entries[i];
      const pos = positionForKey(key);
      expect(nameViaSkyClick(pos, i)).toBe(name);
      expect(nameViaNav(pos, 12000 + i)).toBe(name);
      expect(nameViaFeature(pos, 700 + i)).toBe(name);
      expect(nameViaSpawn(pos, `cat-${i}`)).toBe(name);
    }
  });

  it('shape exclusivity: no procgen name equals any catalog name (sampled cross-check)', () => {
    const catalogNames = new Set(catalog.values());
    const rng = new SeededRandom('cross-check-positions');
    let collisions = 0;
    for (let i = 0; i < 50000; i++) {
      const pos = samplePos(REGIONS[i % 4], rng);
      const key = quantizePosition(pos).key;
      const name = generateSystemName(null, pos);
      // Skip the (astronomically unlikely) case where the random position IS a
      // catalog cell — that is a legitimate catalog hit, not a procgen collision.
      if (catalog.has(locatorKey(pos)) === false && catalogNames.has(name)) collisions++;
      void key;
    }
    expect(collisions).toBe(0);
  });

  it('enumerateNamedSystems returns catalog entries that round-trip through generateSystemName', () => {
    // Enumerate over a broad disk box; assert each is a catalog shape, unique,
    // blocklist-clean, and reproduces its own name from its position — the
    // mechanical basis for a future in-game settled/notable-systems catalog.
    const box = { xMin: -16, xMax: 16, yMin: -3, yMax: 3, zMin: -16, zMax: 16 };
    const list = enumerateNamedSystems(box, 5000);
    expect(list.length).toBeGreaterThan(100);
    const seen = new Set();
    for (const s of list) {
      const cls = classify(s.name);
      expect(cls === 'settled' || cls === 'greek').toBe(true);
      expect(generateSystemName(null, s.position)).toBe(s.name);
      const token = cls === 'settled' ? s.name : s.name.split(' ')[1];
      expect(REAL_PROPER_NAME_SET.has(token.toLowerCase())).toBe(false);
      expect(seen.has(s.name)).toBe(false);
      seen.add(s.name);
    }
  });
});
