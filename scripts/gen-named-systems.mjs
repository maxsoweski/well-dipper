#!/usr/bin/env node
// scripts/gen-named-systems.mjs — BUILD-TIME named-systems catalog generator.
//
// RUN:  node scripts/gen-named-systems.mjs
//
// Writes:
//   src/generation/data/namedSystemsCatalog.js        (SHIPPED runtime module —
//                                                       key\tname rows, bundled)
//   src/generation/data/namedSystemsCatalog.meta.json  (BUILD SIDECAR — not
//                                                       imported by game code;
//                                                       placement per key + counts,
//                                                       read only by the census)
//
// WHAT IT DOES (ac5-decision.md Addendum 3, increment 3e):
//   1. SELECT REAL STAR POSITIONS by running the ACTUAL HashGridStarfield cell
//      generation offline (import the real module — do NOT reimplement), so every
//      catalog position is bit-identical to the in-game sky. A star harvested via
//      HashGridStarfield.findStarsInRadius has the exact worldX/Y/Z that
//      HashGridStarfield.generate() (the sky-click path) produces for that cell,
//      because both compute starX = (cell+0.5)*cellSize + offset(hash)*cellSize
//      with identical inputs. So when the player targets that star, its position
//      quantizes to the same locator key → catalog hit.
//   2. AUTHOR names over those positions: ~12k settled bare words ("Veshara")
//      + ~36k greek notables ("Alpha Vozara 4821"). PLACEMENT LEVER: a tunable
//      fraction of notables is placed near known objects / features (nebulae,
//      globular clusters) so players meet named systems more often than uniform
//      chance; settled systems + the rest spread with mild disk bias.
//   3. VERIFY AT BUILD TIME: zero duplicate names, zero real-proper-name hits,
//      zero key collisions, every entry's position round-trips to its lattice key.
//   4. EMIT the compact static artifact keyed by the SAME quantized-position
//      lattice key NameGenerator uses (Q = 4e-6 kpc, base-36 locator).
//
// DETERMINISM: GalacticMap + HashGridStarfield are pure functions of the fixed
// galaxy seed; sample centers + word draws go through SeededRandom with fixed
// seeds. Re-running produces a byte-identical catalog.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SeededRandom } from '../src/generation/SeededRandom.js';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { HashGridStarfield } from '../src/generation/HashGridStarfield.js';
import { locatorKey, positionForKey, _classifyRegion } from '../src/generation/NameGenerator.js';
import { REAL_PROPER_NAME_SET } from '../src/generation/data/realProperNames.js';
import { KNOWN_OBJECT_PROFILES } from '../src/data/KnownObjectProfiles.js';
import { makePrettyWord } from './lib/pretty-words.mjs';

// ─────────────────────────────────────────────────────────────────────────
// CONFIG — counts + the placement lever (all documented, tunable)
// ─────────────────────────────────────────────────────────────────────────
const SETTLED_TARGET = 12000;        // bare pretty words ("Veshara")
const GREEK_TARGET   = 36000;        // greek notables ("Alpha Vozara 4821")
const NEAR_FEATURE_FRACTION = 0.40;  // ← PLACEMENT LEVER: fraction of notables
                                     //   placed near known objects/features.
                                     //   0 = uniform; 1 = all near features.

// Word aesthetics
const WORD_MIN_LEN = 4, WORD_MAX_LEN = 12;
const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'];

// Shape regexes (must agree with the census + injectivity test).
const RE_SETTLED = /^[A-Z][a-z]+$/;                    // "Veshara"
const RE_GREEK   = /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/; // "Alpha Vozara 4821"
const RE_SURVEY    = /^[A-Z]{2,4} J[0-9A-Z]{7}[+-][0-9A-Z]{7}$/;
const RE_MULTIPART = /^[A-Z][a-z]+-[0-9A-Z]{10}$/;

const HERE = fileURLToPath(new URL('.', import.meta.url));
const CATALOG_PATH = fileURLToPath(new URL('../src/generation/data/namedSystemsCatalog.js', import.meta.url));
const META_PATH = fileURLToPath(new URL('../src/generation/data/namedSystemsCatalog.meta.json', import.meta.url));
const GLOB_PATH = fileURLToPath(new URL('../public/assets/data/globular-clusters.json', import.meta.url));

// Envelope guard: only harvest stars the player can actually encounter (the
// render sky uses R < GALAXY_RADIUS*1.2 and |y| < GALAXY_HEIGHT*2), AND stay well
// inside the ±24/±16/±24 kpc quantization envelope so no coordinate clamps
// (a clamp would fold distinct stars onto one key → collision).
function inEnvelope(x, y, z) {
  const R = Math.sqrt(x * x + z * z);
  return R < 17.9 && Math.abs(y) < 5.9;
}

// ─────────────────────────────────────────────────────────────────────────
// GALAXY + FEATURE FIELD (offline; mirror main.js wiring without fetch)
// ─────────────────────────────────────────────────────────────────────────
const gm = new GalacticMap('well-dipper-galaxy-1');

const globRaw = JSON.parse(readFileSync(GLOB_PATH, 'utf-8'));
const globFeatures = globRaw.map(gc => ({
  type: 'globular-cluster',
  position: { x: gc.x, y: gc.y, z: gc.z },
  radius: 0.03,                 // matches RealFeatureCatalog default
  seed: `harris-${gc.id}`,
  name: gc.name,
}));
// Same density boost the game uses so "near a globular" really is star-dense.
HashGridStarfield.realFeatureCatalog = {
  loaded: true,
  findNearby(position, maxDistance = 3.0) {
    const out = [];
    for (const f of globFeatures) {
      const dx = f.position.x - position.x, dy = f.position.y - position.y, dz = f.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < maxDistance + f.radius) out.push({ ...f, distance: dist, insideFeature: dist < f.radius });
    }
    return out;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// HARVEST — collect unique-keyed real star positions from HashGridStarfield
// ─────────────────────────────────────────────────────────────────────────
function radiusFor(x, y, z) {
  const R = Math.sqrt(x * x + z * z);
  if (Math.abs(y) > 2) return 0.02;   // halo (sparse; keep radius modest — giants are costly)
  if (R < 3) return 0.006;            // core (dense)
  if (R > 14) return 0.02;            // rim (sparse)
  return 0.008;                       // disk
}

function harvestAt(center, radius, maxResults, source, pool, seen) {
  const stars = HashGridStarfield.findStarsInRadius(gm, center, radius, maxResults);
  let added = 0;
  for (const s of stars) {
    if (!inEnvelope(s.worldX, s.worldY, s.worldZ)) continue;
    const key = locatorKey({ x: s.worldX, y: s.worldY, z: s.worldZ });
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ key, x: s.worldX, y: s.worldY, z: s.worldZ, source });
    added++;
  }
  return added;
}

const seen = new Set();
const featurePool = [];
const widePool = [];

// ── Near-feature harvest: 37 KnownObjectProfiles + 152 globular clusters ──
const t0 = Date.now();
const featureCenters = [];
for (const p of Object.values(KNOWN_OBJECT_PROFILES)) {
  const g = p.galacticPos;
  if (g && inEnvelope(g.x, g.y, g.z)) featureCenters.push({ x: g.x, y: g.y, z: g.z, r: 0.012 });
}
for (const gc of globFeatures) {
  const g = gc.position;
  if (inEnvelope(g.x, g.y, g.z)) featureCenters.push({ x: g.x, y: g.y, z: g.z, r: 0.015 });
}
for (const c of featureCenters) {
  harvestAt({ x: c.x, y: c.y, z: c.z }, c.r, 220, 'F', featurePool, seen);
}
const tFeat = Date.now();
console.log(`harvest[feature]: ${featurePool.length} stars from ${featureCenters.length} feature centers (${((tFeat - t0) / 1000).toFixed(1)}s)`);

// ── Wide harvest: mild-disk-biased scatter until we have enough ──
function sampleWideCenter(rng) {
  const roll = rng.float();
  let R, y;
  if (roll < 0.08) { R = rng.range(0, 3); y = rng.range(-1.5, 1.5); }          // core
  else if (roll < 0.80) { R = rng.range(3, 14); y = rng.range(-1.2, 1.2); }     // arm/disk (bulk)
  else if (roll < 0.93) { R = rng.range(14, 17.5); y = rng.range(-1, 1); }      // rim
  else { R = rng.range(0, 10); y = (rng.chance(0.5) ? 1 : -1) * rng.range(2.05, 5); } // halo
  const th = rng.range(0, Math.PI * 2);
  return { x: R * Math.cos(th), y, z: R * Math.sin(th) };
}

const greekNearWant = Math.round(GREEK_TARGET * NEAR_FEATURE_FRACTION);
const wideWant = SETTLED_TARGET + (GREEK_TARGET - Math.min(greekNearWant, featurePool.length)) + 1500; // +margin
const centerRng = new SeededRandom('named-systems-wide-centers-v1');
let wideCenters = 0;
const WIDE_CENTER_CAP = 20000;
while (widePool.length < wideWant && wideCenters < WIDE_CENTER_CAP) {
  const c = sampleWideCenter(centerRng);
  if (!inEnvelope(c.x, c.y, c.z)) continue;
  harvestAt(c, radiusFor(c.x, c.y, c.z), 150, 'W', widePool, seen);
  wideCenters++;
}
const tWide = Date.now();
console.log(`harvest[wide]: ${widePool.length} stars from ${wideCenters} scatter centers (${((tWide - tFeat) / 1000).toFixed(1)}s)`);

// Deterministic order for slicing.
const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
featurePool.sort(byKey);
widePool.sort(byKey);

// ── Allocate roles ──
const greekNearCount = Math.min(greekNearWant, featurePool.length);
const greekWideCount = GREEK_TARGET - greekNearCount;
const needWide = SETTLED_TARGET + greekWideCount;
if (widePool.length < needWide) {
  console.error(`\nBLOCKED: wide harvest short — need ${needWide}, have ${widePool.length}. ` +
    `Increase WIDE_CENTER_CAP or radii, or lower targets. NOT shipping a partial catalog.`);
  process.exit(1);
}

const settledStars = widePool.slice(0, SETTLED_TARGET);
const greekWideStars = widePool.slice(SETTLED_TARGET, SETTLED_TARGET + greekWideCount);
const greekNearStars = featurePool.slice(0, greekNearCount);

// ─────────────────────────────────────────────────────────────────────────
// AUTHOR NAMES — global uniqueness Set seeded with the real-proper-name blocklist
// ─────────────────────────────────────────────────────────────────────────
const usedWords = new Set(REAL_PROPER_NAME_SET); // already lowercased
const wordRng = new SeededRandom('named-systems-words-v1');
function nextWord() {
  for (let tries = 0; tries < 100000; tries++) {
    const w = makePrettyWord(wordRng);
    if (w.length < WORD_MIN_LEN || w.length > WORD_MAX_LEN) continue;
    const lw = w.toLowerCase();
    if (usedWords.has(lw)) continue;   // forbid duplicates within/across catalogs + blocklist
    usedWords.add(lw);
    return w;
  }
  throw new Error('pretty-word supply exhausted — widen the alphabet or lower targets');
}
const decorRng = new SeededRandom('named-systems-decor-v1');
function greekNameFor(word) {
  return `${decorRng.pick(GREEK)} ${word} ${decorRng.int(100, 9999)}`;
}

const entries = []; // { key, name, cls, region, placement, x, y, z }
function push(star, name, cls, placement) {
  entries.push({
    key: star.key, name, cls, placement,
    region: _classifyRegion({ x: star.x, y: star.y, z: star.z }).region,
    x: star.x, y: star.y, z: star.z,
  });
}
// Settled first (bare words), then greek near, then greek wide — fixed order.
for (const s of settledStars) push(s, nextWord(), 'settled', 'W');
for (const s of greekNearStars) push(s, greekNameFor(nextWord()), 'greek', 'F');
for (const s of greekWideStars) push(s, greekNameFor(nextWord()), 'greek', 'W');

// ─────────────────────────────────────────────────────────────────────────
// BUILD-TIME VERIFICATION — fail loudly rather than ship a broken catalog
// ─────────────────────────────────────────────────────────────────────────
const problems = [];
const keySet = new Set(), nameSet = new Set();
for (const e of entries) {
  // (a) key collisions
  if (keySet.has(e.key)) problems.push(`dup key ${e.key}`); else keySet.add(e.key);
  // (b) duplicate full names
  if (nameSet.has(e.name)) problems.push(`dup name ${e.name}`); else nameSet.add(e.name);
  // (c) real-proper-name blocklist (bare word, or the greek middle token)
  const token = e.cls === 'settled' ? e.name : e.name.split(' ')[1];
  if (REAL_PROPER_NAME_SET.has(token.toLowerCase())) problems.push(`blocklist hit ${e.name}`);
  // (d) shape: catalog shape matches, procgen shapes do NOT
  const shapeOk = e.cls === 'settled' ? RE_SETTLED.test(e.name) : RE_GREEK.test(e.name);
  if (!shapeOk) problems.push(`bad shape ${e.name}`);
  if (RE_SURVEY.test(e.name) || RE_MULTIPART.test(e.name)) problems.push(`procgen-shape leak ${e.name}`);
  // (e) round-trip: harvested position → key, and key → representative position → key
  if (locatorKey({ x: e.x, y: e.y, z: e.z }) !== e.key) problems.push(`pos!=key ${e.key}`);
  if (locatorKey(positionForKey(e.key)) !== e.key) problems.push(`key roundtrip ${e.key}`);
  if (problems.length > 20) break;
}
if (problems.length) {
  console.error('\nBLOCKED: build-time verification failed:\n  ' + problems.slice(0, 20).join('\n  '));
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────
// EMIT — sorted by key for stable, compact output
// ─────────────────────────────────────────────────────────────────────────
entries.sort(byKey);
const rawLines = entries.map(e => e.key + '\t' + e.name);
const raw = rawLines.join('\n');

const settledCount = entries.filter(e => e.cls === 'settled').length;
const greekCount = entries.filter(e => e.cls === 'greek').length;
const nearFeatureCount = entries.filter(e => e.placement === 'F').length;
const byRegion = {}; const byClassRegion = {};
for (const e of entries) {
  byRegion[e.region] = (byRegion[e.region] || 0) + 1;
}

const runtimeModule = `/**
 * namedSystemsCatalog — the shipped named-systems catalog (increment 3e,
 * ac5-decision.md Addendum 3). The FIFTH real-object mechanism (see
 * docs/NAMING_AND_REAL_OBJECTS.md §2), mirroring the KnownSystems pattern:
 * a finite, hand-shipped table that overrides procgen naming at matching
 * positions.
 *
 * ── GENERATED FILE — DO NOT HAND-EDIT ──
 * Rebuild with:  node scripts/gen-named-systems.mjs
 * The build script deterministically selects REAL star positions (by running
 * the actual HashGridStarfield cell generation offline, so positions match the
 * in-game sky exactly), authors settled bare words + greek notables, and writes
 * this file. Uniqueness / blocklist / key-collision / round-trip are all checked
 * AT BUILD TIME inside that script.
 *
 * ── LOAD PATH (why a bundled JS module, not fetched JSON) ──
 * The lookup MUST be synchronously available wherever generateSystemName runs:
 * main-thread call sites (sky-click, NavComputer, warp spawn) AND headless
 * census/tests that import NameGenerator directly with no boot/fetch sequence.
 * A static ESM import satisfies that on every path — the module graph resolves
 * before any naming code runs, in the browser bundle and under Node/vitest
 * alike — with no preload gate and no chance of a naming call racing an
 * unfinished fetch. The cost is bundle size: the raw table is a single string
 * literal (${(raw.length / 1024 / 1024).toFixed(2)} MB, ${entries.length} rows) that
 * ships in the JS bundle (gzips to roughly a third). The Map is built lazily on
 * first lookup so importing the module (e.g. in a test file that never names a
 * system) costs nothing until used.
 *
 * Key = the injective base-36 locator \`L.toString(36)\` (NameGenerator
 * locatorKey) of the system's canonical galactic position at Q = 4e-6 kpc.
 * Value = the full display name (bare word or "Alpha Vozara 4821").
 */

export const NAMED_SYSTEMS_VERSION = 1;

// "key\\tname\\n"-delimited rows. Keys are base-36; names are [A-Za-z0-9 ] only,
// so no escaping is needed.
export const NAMED_SYSTEMS_RAW = ${JSON.stringify(raw)};

let _map = null;

/** Lazily parse NAMED_SYSTEMS_RAW into a Map<key, name>. Synchronous. */
export function getNamedSystemsMap() {
  if (_map) return _map;
  _map = new Map();
  const raw = NAMED_SYSTEMS_RAW;
  if (raw.length) {
    for (const line of raw.split('\\n')) {
      if (!line) continue;
      const t = line.indexOf('\\t');
      if (t < 0) continue;
      _map.set(line.slice(0, t), line.slice(t + 1));
    }
  }
  return _map;
}

/** Synchronous catalog lookup by base-36 locator key. @returns {string|undefined} */
export function namedSystemLookup(key) {
  return getNamedSystemsMap().get(key);
}

/** Number of catalog entries. */
export function namedSystemsCount() {
  return getNamedSystemsMap().size;
}
`;

writeFileSync(CATALOG_PATH, runtimeModule, 'utf-8');

// Meta sidecar — placement per key (feature-placed keys listed; others = wide) +
// counts + a few samples. Read ONLY by the census (not bundled into the game).
const featureKeys = entries.filter(e => e.placement === 'F').map(e => e.key).sort();
const sampleSettled = entries.filter(e => e.cls === 'settled').slice(0, 40).map(e => e.name);
const sampleGreek = entries.filter(e => e.cls === 'greek').slice(0, 40).map(e => e.name);
const meta = {
  version: 1,
  generatedBy: 'scripts/gen-named-systems.mjs',
  note: 'BUILD SIDECAR — not imported by game code; read only by scripts/name-census.mjs. featureKeys = keys placed near known objects/features (placement lever); all other catalog keys are galaxy-wide.',
  Q_KPC: 4e-6,
  counts: {
    total: entries.length,
    settled: settledCount,
    greek: greekCount,
    greekNearFeature: nearFeatureCount,
    greekWide: greekCount - nearFeatureCount,
    nearFeatureFractionOfGreek: greekCount ? +(nearFeatureCount / greekCount).toFixed(4) : 0,
    byRegion,
  },
  placementLever: {
    configuredFraction: NEAR_FEATURE_FRACTION,
    featureCenters: featureCenters.length,
    achievedNearFeatureNotables: nearFeatureCount,
  },
  samples: { settled: sampleSettled, greek: sampleGreek },
  featureKeys,
};
writeFileSync(META_PATH, JSON.stringify(meta, null, 0) + '\n', 'utf-8');

// ─────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────
console.log(`\nnamed-systems catalog written:`);
console.log(`  ${CATALOG_PATH}`);
console.log(`  ${META_PATH}`);
console.log(`  entries: ${entries.length}  (settled ${settledCount}, greek ${greekCount})`);
console.log(`  near-feature notables: ${nearFeatureCount} (${greekCount ? (100 * nearFeatureCount / greekCount).toFixed(1) : 0}% of greek; lever=${NEAR_FEATURE_FRACTION})`);
console.log(`  per-region: ${JSON.stringify(byRegion)}`);
console.log(`  artifact size: ${(raw.length / 1024 / 1024).toFixed(2)} MB raw string (${rawLines.length} rows)`);
console.log(`  build-time verification: PASS (0 dup names, 0 blocklist hits, 0 key collisions, all round-trip)`);
console.log(`  sample settled: ${sampleSettled.slice(0, 8).join(', ')}`);
console.log(`  sample greek:   ${sampleGreek.slice(0, 6).join(', ')}`);
