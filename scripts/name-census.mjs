#!/usr/bin/env node
// scripts/name-census.mjs — headless, deterministic system-name census.
//
// RUN:  node scripts/name-census.mjs
// Writes docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md
// and prints a short summary to stdout. No flags, no network, no browser.
//
// PURPOSE. Since increment 3b system naming is UNIQUE BY CONSTRUCTION and since
// increment 3e (ac5-decision.md Addendum 3) naming resolves as
//   named-systems catalog (shipped, finite) → procgen (survey | multipart).
// This tool now serves three jobs:
//   1. VERIFY the guarantee empirically at volume — 0 duplicate PROCGEN names
//      across distinct position cells, 0 collisions with real (HYG) names, 0
//      procgen designations inside real designation space, and 0 procgen names
//      equal to any CATALOG name (shape-disjoint) — through the exact production
//      call-site RNG chains (which the namer ignores; that IS the point).
//   2. INVENTORY the shipped named-systems catalog: counts, per-region
//      distribution, placement-lever stats, and 30+ sample names per catalog
//      class (settled bare words + greek notables).
//   3. Emit refreshed per-region PROCGEN sample blocks for Max's UAT review.
//
// DETERMINISM CONTRACT: every RNG draw goes through SeededRandom with a fixed
// string seed, and the catalog it reads is itself deterministic. Two runs
// produce byte-identical census-report.md (verified: run twice, diff).
//
// WHAT THIS CALLS: the real, unmodified generateSystemName() and the shipped
// namedSystemsCatalog via NameGenerator, driven through the production call-site
// RNG chains (see nameVia* below). It does not modify/mock/stub any source.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { SeededRandom } from '../src/generation/SeededRandom.js';
import {
  generateSystemName, quantizePosition, locatorKey, positionForKey,
  getNamedSystemsMap, _classifyRegion,
} from '../src/generation/NameGenerator.js';

// ─────────────────────────────────────────────────────────────────────────
// CONFIG — all fixed, all deterministic
// ─────────────────────────────────────────────────────────────────────────

const TOTAL_PER_REGION = 30000;          // 120,000 total (> the 100k bar)
const SAMPLE_BLOCK_SIZE = 200;           // per region (contract: >= 200/region)

const SEED_POSITIONS = 'name-census-positions-v2';
const REGIONS = ['core', 'arm', 'rim', 'halo'];

// Call-site family mix (transparency only — the namer ignores the seed string).
const FAMILY_PATTERN = ['star', 'star', 'star', 'star', 'star', 'star', 'star', 'nav', 'nav', 'feat'];

const HYG_PATH = fileURLToPath(new URL('../public/assets/data/hyg-stars.json', import.meta.url));
const META_PATH = fileURLToPath(new URL('../src/generation/data/namedSystemsCatalog.meta.json', import.meta.url));
const REPORT_PATH = fileURLToPath(new URL(
  '../docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md',
  import.meta.url,
));

const REAL_DESIGNATION_PREFIXES = [
  'HD', 'HR', 'GJ', 'HIP', 'TYC', 'WISE', 'TOI', 'KOI', 'Kepler', 'TRAPPIST',
  'LHS', 'Ross', 'Wolf', '2MASS', 'SDSS', 'Gaia', 'TIC', 'KIC', 'GSC', 'UCAC',
  'Groombridge', 'Lacaille',
];
const REAL_DESIGNATION_RE = new RegExp(`^(?:${REAL_DESIGNATION_PREFIXES.join('|')})[\\s-]`);

// Name shapes.
const RE_SURVEY = /^[A-Z]{2,4} J[0-9A-Z]{7}[+-][0-9A-Z]{7}$/;   // procgen
const RE_MULTIPART = /^[A-Z][a-z]+-[0-9A-Z]{10}$/;             // procgen
const RE_SETTLED = /^[A-Z][a-z]+$/;                            // catalog
const RE_GREEK = /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/;         // catalog

// ─────────────────────────────────────────────────────────────────────────
// POSITION SAMPLING — uniform jittered positions within each region's geometry.
// ─────────────────────────────────────────────────────────────────────────

function samplePosition(region, rng) {
  let r, h;
  if (region === 'core') { r = rng.range(0, 3); h = rng.range(-2, 2); }
  else if (region === 'rim') { r = rng.range(14, 18); h = rng.range(-2, 2); }
  else if (region === 'halo') { r = rng.range(0, 12); h = (rng.chance(0.5) ? 1 : -1) * rng.range(2.05, 5); }
  else { r = rng.range(3, 14); h = rng.range(-2, 2); }
  const th = rng.range(0, Math.PI * 2);
  return { x: r * Math.cos(th), y: h, z: r * Math.sin(th) };
}

// ─────────────────────────────────────────────────────────────────────────
// PRODUCTION CALL-SITE RNG CHAINS (verbatim). The namer IGNORES the rng.
// ─────────────────────────────────────────────────────────────────────────

function nameSkyClick(pos, idx)   { return generateSystemName(new SeededRandom(`warp-star-${idx}`).child('names').child('system'), pos); }
function nameNav(pos, seed)       { return generateSystemName(new SeededRandom(`warp-nav-${seed}`), pos); }
function nameFeature(pos, seed)   { return generateSystemName(new SeededRandom(`feat-${seed}`).child('names').child('system'), pos); }

// ─────────────────────────────────────────────────────────────────────────
// NAME CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────

function classifyClass(name) {
  if (RE_SURVEY.test(name)) return 'survey';
  if (RE_MULTIPART.test(name)) return 'multipart';
  if (RE_GREEK.test(name)) return 'greek';       // catalog (rare uniform hit)
  if (RE_SETTLED.test(name)) return 'settled';   // catalog (rare uniform hit)
  return 'UNKNOWN';
}

// ─────────────────────────────────────────────────────────────────────────
// PROCGEN CENSUS
// ─────────────────────────────────────────────────────────────────────────

function runCensus(catalogNameSet) {
  const positionRng = new SeededRandom(SEED_POSITIONS);

  let starIdx = 0, navIdx = 0, featIdx = 0;

  const overall = { total: 0, cells: new Set(), names: new Set() };
  const classCounts = { survey: 0, multipart: 0, greek: 0, settled: 0, UNKNOWN: 0 };
  const byRegion = {};
  const sampleBlocks = {};
  let pathDisagreements = 0;
  let revisitMismatches = 0;
  let dupNamesAcrossCells = 0;
  let realDesignationEmissions = 0;
  let procgenInCatalog = 0;
  const cellToName = new Map();
  const nameToCell = new Map();

  for (const region of REGIONS) {
    byRegion[region] = { total: 0, cells: new Set(), names: new Set(), classCounts: { survey: 0, multipart: 0, greek: 0, settled: 0 } };
    sampleBlocks[region] = [];

    for (let i = 0; i < TOTAL_PER_REGION; i++) {
      const family = FAMILY_PATTERN[i % FAMILY_PATTERN.length];
      const pos = samplePosition(region, positionRng);
      const key = quantizePosition(pos).key;

      let name, seedString;
      if (family === 'star') { seedString = `warp-star-${starIdx}`; name = nameSkyClick(pos, starIdx); starIdx++; }
      else if (family === 'nav') { seedString = `warp-nav-${navIdx}`; name = nameNav(pos, navIdx); navIdx++; }
      else { seedString = `feat-${featIdx}`; name = nameFeature(pos, featIdx); featIdx++; }

      if (nameSkyClick(pos, 1) !== name || nameNav(pos, 2) !== name || nameFeature(pos, 3) !== name) pathDisagreements++;

      if (cellToName.has(key)) { if (cellToName.get(key) !== name) revisitMismatches++; }
      else cellToName.set(key, name);
      const prev = nameToCell.get(name);
      if (prev !== undefined && prev !== key) dupNamesAcrossCells++;
      else nameToCell.set(name, key);

      if (REAL_DESIGNATION_RE.test(name)) realDesignationEmissions++;
      // Shape-disjoint cross-check: a procgen name must never equal a catalog
      // name UNLESS the random position genuinely landed on a catalog cell.
      if (catalogNameSet.has(name) && !catalogNameSet.hasKey(locatorKey(pos))) procgenInCatalog++;

      const cls = classifyClass(name);
      classCounts[cls]++;
      if (cls === 'survey' || cls === 'multipart' || cls === 'greek' || cls === 'settled') byRegion[region].classCounts[cls]++;
      overall.total++; overall.cells.add(key); overall.names.add(name);
      byRegion[region].total++; byRegion[region].cells.add(key); byRegion[region].names.add(name);

      if (sampleBlocks[region].length < SAMPLE_BLOCK_SIZE) {
        sampleBlocks[region].push({ idx: i, family, cls, name, pos });
      }
    }
  }

  return {
    overall, classCounts, byRegion, sampleBlocks,
    pathDisagreements, revisitMismatches, dupNamesAcrossCells,
    realDesignationEmissions, procgenInCatalog, nameToCell,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// NAMED-SYSTEMS CATALOG INVENTORY (the fifth real-object mechanism)
// ─────────────────────────────────────────────────────────────────────────

function catalogClass(name) {
  if (RE_SETTLED.test(name)) return 'settled';
  if (RE_GREEK.test(name)) return 'greek';
  return 'UNKNOWN';
}

function runCatalogInventory() {
  const map = getNamedSystemsMap();
  const meta = JSON.parse(readFileSync(META_PATH, 'utf-8'));
  const featureKeys = new Set(meta.featureKeys || []);

  const names = new Set();
  const keys = new Set();
  let dupName = 0, dupKey = 0, badShape = 0, procgenShape = 0;

  const byRegion = {};
  for (const r of REGIONS) byRegion[r] = { total: 0, settled: 0, greek: 0, nearFeature: 0 };
  const classCounts = { settled: 0, greek: 0 };
  let nearFeatureTotal = 0;

  const settledSamples = [];
  const greekSamples = [];
  const entries = [...map.entries()];
  // Spread samples across the (key-sorted) catalog for variety.
  const settledStride = Math.max(1, Math.floor(entries.length / 400));

  let idx = 0;
  for (const [key, name] of entries) {
    if (names.has(name)) dupName++; else names.add(name);
    if (keys.has(key)) dupKey++; else keys.add(key);
    const cls = catalogClass(name);
    if (cls === 'UNKNOWN') { badShape++; idx++; continue; }
    if (RE_SURVEY.test(name) || RE_MULTIPART.test(name)) procgenShape++;
    classCounts[cls]++;

    const region = _classifyRegion(positionForKey(key)).region;
    const near = featureKeys.has(key);
    byRegion[region].total++;
    byRegion[region][cls]++;
    if (near) { byRegion[region].nearFeature++; nearFeatureTotal++; }

    if (cls === 'settled' && settledSamples.length < 36 && idx % settledStride === 0) settledSamples.push(name);
    if (cls === 'greek' && greekSamples.length < 36 && idx % 97 === 0) greekSamples.push(name);
    idx++;
  }

  return {
    total: entries.length, classCounts, byRegion, nearFeatureTotal,
    dupName, dupKey, badShape, procgenShape,
    settledSamples, greekSamples,
    meta,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// HYG CROSS-CHECK
// ─────────────────────────────────────────────────────────────────────────

function loadHyg() {
  const raw = JSON.parse(readFileSync(HYG_PATH, 'utf-8'));
  const total = raw.length;
  const quoteArtifactCount = raw.filter(s => s.name === '"').length;
  const meaningful = new Set(raw.map(s => s.name).filter(n => n && n !== '"'));
  return { total, quoteArtifactCount, meaningfulSet: meaningful, meaningfulCount: meaningful.size };
}

function crossCheckHyg(nameSet, hyg) {
  const collisions = [];
  for (const name of nameSet) if (hyg.meaningfulSet.has(name)) collisions.push(name);
  return collisions;
}

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISM FINGERPRINT (FNV-1a over sorted summary stats)
// ─────────────────────────────────────────────────────────────────────────

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { hash ^= str.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ─────────────────────────────────────────────────────────────────────────
// REPORT RENDERING
// ─────────────────────────────────────────────────────────────────────────

function pct(x) { return (x * 100).toFixed(2) + '%'; }
function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}
function fmtPos(pos) { return pos ? `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}` : 'n/a'; }

function renderReport(census, catalog, hyg) {
  const { overall, classCounts, byRegion, sampleBlocks,
    pathDisagreements, revisitMismatches, dupNamesAcrossCells,
    realDesignationEmissions, procgenInCatalog, nameToCell } = census;

  const hygProcgenCollisions = crossCheckHyg(nameToCell.keys ? new Set(nameToCell.keys()) : new Set(), hyg);
  const catalogNames = new Set(getNamedSystemsMap().values());
  const hygCatalogCollisions = crossCheckHyg(catalogNames, hyg);

  const fingerprintInput = JSON.stringify({
    total: overall.total,
    distinctCells: overall.cells.size,
    distinctNames: overall.names.size,
    classCounts,
    byRegion: Object.fromEntries(REGIONS.map(r => [r, [byRegion[r].total, byRegion[r].cells.size, byRegion[r].names.size]])),
    dupNamesAcrossCells, revisitMismatches, pathDisagreements, realDesignationEmissions, procgenInCatalog,
    hygProcgenCollisions: hygProcgenCollisions.slice().sort(),
    catalog: {
      total: catalog.total, classCounts: catalog.classCounts, nearFeatureTotal: catalog.nearFeatureTotal,
      byRegion: catalog.byRegion, dupName: catalog.dupName, dupKey: catalog.dupKey,
      badShape: catalog.badShape, procgenShape: catalog.procgenShape,
      hygCatalogCollisions: hygCatalogCollisions.slice().sort(),
      settledSamples: catalog.settledSamples, greekSamples: catalog.greekSamples,
    },
  });
  const fingerprint = fnv1a(fingerprintInput);

  const lines = [];
  const push = (s = '') => lines.push(s);

  push('# System-name uniqueness census');
  push();
  push('Workstream: `naming-census-uniqueness-2026-07-07`, AC3 → AC6/AC7 (increment 3e).');
  push('Generated by `scripts/name-census.mjs` — re-run with `node scripts/name-census.mjs`.');
  push('Evidence for Max\'s UAT review of the naming scheme. No dates or run-specific');
  push('values appear below (see "Determinism").');
  push();

  push('## The guarantee, and how it is verified here');
  push();
  push('Since increment 3e (ac5-decision.md Addendum 3), a system\'s name resolves as:');
  push();
  push('> **1. Named-systems catalog (shipped, finite).** A build-time-authored table');
  push('> (`src/generation/data/namedSystemsCatalog.js`) of settled bare words');
  push('> ("Veshara") + greek notables ("Alpha Vozara 4821"), keyed by the injective');
  push('> position locator. Uniqueness / blocklist / key-collision / round-trip are all');
  push('> checked AT BUILD TIME. This is the FIFTH real-object mechanism.');
  push('>');
  push('> **2. Procgen (two classes).** For every other position, a **pure, injective**');
  push('> function of canonical galactic position (no registry, no persistence): the');
  push('> position quantizes to a fixed lattice at `Q = 4e-6 kpc`; the three lattice');
  push('> coords pack into one mixed-radix locator `L` (~70 bits); and each of the two');
  push('> classes — survey designation (base-36 coordinate field) and multi-part fantasy');
  push('> (word + code) — embeds `L` injectively. Distinct positions → distinct `L` →');
  push('> distinct names.');
  push('>');
  push('> **Shape exclusivity.** The two procgen shapes (survey has " J" + latitude sign;');
  push('> multipart has "-") are structurally disjoint from the two catalog shapes (bare');
  push('> `^[A-Z][a-z]+$`, greek `^Word Word \\d+$`), so a procgen name can never equal a');
  push('> catalog name. Uniqueness holds end to end.');
  push();
  push('The named-via columns below drive the **exact production call-site RNG chains**');
  push('(`warp-star-<idx>` sky-click, `warp-nav-<seed>` NavComputer, `feat-<seed>`');
  push('feature route). The generator **ignores** those seeds — which is why every path');
  push('agrees and revisits are stable. This tool asserts that agreement on every sample.');
  push();

  push('## Headline — verification');
  push();
  push(mdTable(['check', 'result'], [
    ['Procgen names generated (4-region census)', overall.total.toLocaleString()],
    ['Distinct position cells sampled', overall.cells.size.toLocaleString()],
    ['Distinct names produced', overall.names.size.toLocaleString()],
    ['**Duplicate names across distinct cells** (AC6: must be 0)', `**${dupNamesAcrossCells}**`],
    ['Revisit mismatches (same cell → different name; must be 0)', `${revisitMismatches}`],
    ['Path disagreements (sky-click vs nav vs feature; must be 0)', `${pathDisagreements}`],
    ['Procgen designations in real designation space (must be 0)', `${realDesignationEmissions}`],
    ['Procgen names equal to a CATALOG name (shape-disjoint; must be 0)', `${procgenInCatalog}`],
    ['Procgen collisions with a real HYG name (must be 0)', `${hygProcgenCollisions.length}`],
  ]));
  push();
  push('`distinct names === distinct cells` and `duplicate names across cells === 0`');
  push('together are the empirical face of the by-construction injectivity.');
  push();
  push(`Determinism fingerprint (FNV-1a over sorted summary stats): \`${fingerprint}\``);
  push();

  push('## Procgen class mix (region flavor, two classes)');
  push();
  push('Region steers the class MIX (core catalog-heavy → rim fantasy-leaning); it never');
  push('affects uniqueness. `survey` = fictional-prefix grouped designation; `multipart`');
  push('= region-flavoured word + position code. (The removed 3c greek/bare runtime');
  push('classes are now the shipped catalog — see below. Uniform sampling essentially');
  push('never lands on a discrete catalog cell, so catalog hits here are ~0.)');
  push();
  push(mdTable(['region', 'samples', 'survey', 'multipart', 'catalog hits'],
    REGIONS.map(r => {
      const b = byRegion[r];
      return [r, b.total.toLocaleString(),
        `${pct(b.classCounts.survey / b.total)}`,
        `${pct(b.classCounts.multipart / b.total)}`,
        `${b.classCounts.settled + b.classCounts.greek}`];
    })));
  push();
  push(`Galaxy-wide procgen totals — survey: ${classCounts.survey.toLocaleString()}, ` +
    `multipart: ${classCounts.multipart.toLocaleString()}, ` +
    `catalog hits from uniform sampling: ${(classCounts.settled + classCounts.greek)}.`);
  push();

  push('## Named-systems catalog (the FIFTH real-object mechanism)');
  push();
  push('The shipped catalog (`src/generation/data/namedSystemsCatalog.js`) is a finite,');
  push('lore-consistent set of settled + notable systems, authored at build time by');
  push('`scripts/gen-named-systems.mjs` over REAL star positions selected by running the');
  push('actual HashGridStarfield cell generation offline (so each entry sits on a real');
  push('in-game star). It overrides procgen at matching positions, and is enumerable for');
  push('a future in-game settled/notable-systems catalog (ac5 addendum ruling 2).');
  push();
  push(mdTable(['check', 'result'], [
    ['Catalog entries', catalog.total.toLocaleString()],
    ['— settled bare words', catalog.classCounts.settled.toLocaleString()],
    ['— greek notables', catalog.classCounts.greek.toLocaleString()],
    ['Duplicate names (must be 0)', `${catalog.dupName}`],
    ['Duplicate keys (must be 0)', `${catalog.dupKey}`],
    ['Entries not a catalog shape (must be 0)', `${catalog.badShape}`],
    ['Entries wearing a procgen shape (must be 0)', `${catalog.procgenShape}`],
    ['Catalog collisions with a real HYG name (must be 0)', `${hygCatalogCollisions.length}`],
  ]));
  push();
  push('### Per-region distribution');
  push();
  push(mdTable(['region', 'total', 'settled', 'greek', 'near-feature'],
    REGIONS.map(r => {
      const b = catalog.byRegion[r];
      return [r, b.total.toLocaleString(), b.settled.toLocaleString(),
        b.greek.toLocaleString(), b.nearFeature.toLocaleString()];
    })));
  push();
  push('### Placement lever');
  push();
  const pl = catalog.meta.placementLever || {};
  push('A tunable fraction of greek notables is placed within a radius of known objects /');
  push('features (nebulae, globular clusters) so players meet named systems more often');
  push('than uniform chance; settled systems + the rest spread with mild disk bias.');
  push();
  push(mdTable(['metric', 'value'], [
    ['Configured near-feature fraction (of greek notables)', `${pl.configuredFraction ?? 'n/a'}`],
    ['Feature centers used (KnownObjectProfiles + globulars)', `${pl.featureCenters ?? 'n/a'}`],
    ['Near-feature notables (achieved)', catalog.nearFeatureTotal.toLocaleString()],
    ['Near-feature share of catalog', pct(catalog.nearFeatureTotal / catalog.total)],
  ]));
  push();
  push('### Sample settled bare words (30+ , spread across the catalog)');
  push();
  push(catalog.settledSamples.map(n => `\`${n}\``).join(', ') + '.');
  push();
  push('### Sample greek notables (30+ , spread across the catalog)');
  push();
  push(catalog.greekSamples.map(n => `\`${n}\``).join(', ') + '.');
  push();

  push('## HYG cross-check (procgen + catalog vs. real star names)');
  push();
  push(`\`public/assets/data/hyg-stars.json\` ships ${hyg.total.toLocaleString()} entries`);
  push('(HYG v4.0, regenerated in increment 3a / AC9). Every distinct procgen name in');
  push('this census AND every catalog name was checked against the full set of');
  push(`${hyg.meaningfulCount.toLocaleString()} distinct meaningful real names.`);
  push();
  push(mdTable(['metric', 'value'], [
    ['HYG entries (raw)', hyg.total.toLocaleString()],
    ['HYG entries with the `"` artifact name', hyg.quoteArtifactCount.toLocaleString()],
    ['HYG distinct meaningful names', hyg.meaningfulCount.toLocaleString()],
    ['Distinct procgen names colliding with a real name', hygProcgenCollisions.length.toLocaleString()],
    ['Catalog names colliding with a real name', hygCatalogCollisions.length.toLocaleString()],
  ]));
  push();
  if (hygProcgenCollisions.length === 0 && hygCatalogCollisions.length === 0) {
    push('**Zero collisions.** Procgen uses fictional survey prefixes (disjoint from real');
    push('designation space) and injective word+code shapes; the catalog\'s bare/greek');
    push('words are structurally blocklisted against the real proper-name set');
    push('(`src/generation/data/realProperNames.js`) at build time. No procgen or catalog');
    push('name can equal a real star name.');
  } else {
    push('Collisions found (should be none): ' +
      [...hygProcgenCollisions, ...hygCatalogCollisions].slice(0, 25).map(n => `\`${n}\``).join(', '));
  }
  push();

  push('## Procgen sample blocks — for design review');
  push();
  push(`${SAMPLE_BLOCK_SIZE} procgen name samples per region, in generation order, labeled`);
  push('by call-site family and class, with the sampled galactic position (kpc,');
  push('galactocentric: x/z = galactic plane, y = height above plane). The family column');
  push('is shown only to prove path-independence — it never changes a name.');
  push();
  for (const region of REGIONS) {
    push(`### ${region}`);
    push();
    push(mdTable(['#', 'family', 'class', 'name', 'position (x, y, z kpc)'],
      sampleBlocks[region].map(s => [s.idx, s.family, s.cls, `\`${s.name}\``, fmtPos(s.pos)])));
    push();
  }

  return lines.join('\n') + '\n';
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────

function main() {
  // Catalog name set with a key-membership probe, so the census can distinguish a
  // genuine catalog hit from a procgen collision.
  const catalogMap = getNamedSystemsMap();
  const catalogNameSet = new Set(catalogMap.values());
  catalogNameSet.hasKey = (k) => catalogMap.has(k);

  const census = runCensus(catalogNameSet);
  const catalog = runCatalogInventory();
  const hyg = loadHyg();
  const report = renderReport(census, catalog, hyg);

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report, 'utf-8');

  const hygProcgenCollisions = crossCheckHyg(new Set(census.nameToCell.keys()), hyg);
  console.log(`name-census: wrote ${REPORT_PATH}`);
  console.log(`  procgen names: ${census.overall.total.toLocaleString()}`);
  console.log(`  distinct cells: ${census.overall.cells.size.toLocaleString()}`);
  console.log(`  distinct names: ${census.overall.names.size.toLocaleString()}`);
  console.log(`  duplicate names across cells: ${census.dupNamesAcrossCells}`);
  console.log(`  revisit mismatches: ${census.revisitMismatches}`);
  console.log(`  path disagreements: ${census.pathDisagreements}`);
  console.log(`  real-designation-space emissions: ${census.realDesignationEmissions}`);
  console.log(`  procgen names equal to a catalog name: ${census.procgenInCatalog}`);
  console.log(`  HYG procgen collisions: ${hygProcgenCollisions.length}`);
  console.log(`  catalog entries: ${catalog.total.toLocaleString()} (settled ${catalog.classCounts.settled}, greek ${catalog.classCounts.greek})`);
  console.log(`  catalog dup names/keys/badshape/procgenshape: ${catalog.dupName}/${catalog.dupKey}/${catalog.badShape}/${catalog.procgenShape}`);
  console.log(`  near-feature notables: ${catalog.nearFeatureTotal.toLocaleString()}`);
}

main();
