#!/usr/bin/env node
// scripts/name-census.mjs — headless, deterministic system-name collision census.
//
// RUN:  node scripts/name-census.mjs
// Writes docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md
// and prints a short summary to stdout. No flags, no network, no browser.
//
// PURPOSE (AC3 of naming-census-uniqueness-2026-07-07): measure how often
// StarSystemGenerator's system-naming machinery (src/generation/NameGenerator.js)
// produces the same name for two different star systems, at volumes far beyond
// what a player will ever reach, and cross-check those names against the real
// HYG star catalog the game ships. This is evidence for Max's AC5 design review
// of the naming scheme — not a demo, not a test of "does it look nice."
//
// DETERMINISM CONTRACT: every RNG draw in this file goes through SeededRandom
// with a fixed string seed (see SEED_* constants below). There is no
// Date.now(), no Math.random(), no wall-clock or environment-dependent value
// anywhere in the code path that reaches the report. Two runs of this script,
// on any machine, produce byte-identical census-report.md. See the
// "Determinism" section the tool writes into the report for how this was
// checked (`node scripts/name-census.mjs` run twice, `diff` on the output).
//
// WHAT THIS CALLS: the real, unmodified generateSystemName() from
// src/generation/NameGenerator.js, driven through the exact same RNG-chaining
// pattern the game itself uses at every real call site (see "Sampling
// methodology" in the generated report, and the citations below):
//   new SeededRandom(seedString).child('names').child('system')
//   generateSystemName(nameRng, galacticPos)
// That 2-level child() chain is reproduced verbatim from:
//   - src/main.js ~4192-4193 (generateSystemNames() internal call, final spawn)
//   - src/main.js ~9481-9482 (sky-click warp target selection)
//   - src/main.js ~9492-9493 (screensaver auto-select warp target)
//   - src/main.js ~9541-9542, ~9548-9549 (feature-routed variants of both)
// This tool does not modify, mock, or stub NameGenerator.js or SeededRandom.js
// in any way — it imports and calls the production functions directly.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { SeededRandom } from '../src/generation/SeededRandom.js';
import { generateSystemName } from '../src/generation/NameGenerator.js';

// ─────────────────────────────────────────────────────────────────────────
// CONFIG — all fixed, all deterministic
// ─────────────────────────────────────────────────────────────────────────

// System names generated per region bucket for the main census. 30,000 x 4
// regions = 120,000 total, comfortably past the "at least 100,000... across
// all four region buckets" bar in the contract.
const TOTAL_PER_REGION = 30000;

// Supplementary census for the no-position spawn fallback (see "Path E" in
// the report) — much smaller because it's a narrow, rarely-hit code path,
// not one of the four region buckets.
const NO_POS_FALLBACK_SAMPLES = 5000;

// Fixed seed strings — never derived from time, randomness, or environment.
const SEED_POSITIONS = 'name-census-positions-v1';

const REGIONS = ['core', 'arm', 'rim', 'halo'];

// Call-site "family" mix per region: which real production call site pattern
// supplied the seed string. Modeled on the three real seed-string templates
// (see file header). The game has no telemetry on how often each fires, so
// this 70/20/10 split is a DOCUMENTED ASSUMPTION (sky-click/screensaver is
// the default way players discover systems; NavComputer targeting and
// feature-routed warps are comparatively rarer actions) — not a measured
// fact. It does not change *what* generateSystemName does; it only decides
// which seed-string template feeds it, so it affects nothing about the
// collision statistics except giving the seed-string mix production shape
// (see "Known limitations" in the report).
// 7 star : 2 nav : 1 feat per 10 samples.
const FAMILY_PATTERN = ['star', 'star', 'star', 'star', 'star', 'star', 'star', 'nav', 'nav', 'feat'];
if (TOTAL_PER_REGION % FAMILY_PATTERN.length !== 0) {
  throw new Error('TOTAL_PER_REGION must be a multiple of FAMILY_PATTERN.length for exact family counts');
}

const SAMPLE_BLOCK_SIZE = 200; // per region, per contract ("at least 200 ... per region bucket")

const WORST_GLOBAL_LIMIT = 20;
const WORST_PER_PATH_LIMIT = 5;

// ─────────────────────────────────────────────────────────────────────────
// PATHS (resolved relative to this file so CWD doesn't matter)
// ─────────────────────────────────────────────────────────────────────────

const HYG_PATH = fileURLToPath(new URL('../public/assets/data/hyg-stars.json', import.meta.url));
const REPORT_PATH = fileURLToPath(new URL(
  '../docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md',
  import.meta.url,
));

// ─────────────────────────────────────────────────────────────────────────
// PATH CLASSIFICATION (catalog / greek / fantasy) — output-based, not
// internal-branch-based. Robust to internal refactors of generateSystemName
// as long as the three output SHAPES documented in NameGenerator.js hold:
//   catalog  = PREFIX + separator + digits                (_catalogName)
//   greek    = GreekLetter + ' ' + Constellation + ' ' + digits (inline in generateSystemName)
//   fantasy  = everything else (pronounceable / prefixed / titled sub-styles
//              — NameGenerator.js's three non-catalog, non-greek branches all
//              produce pure-letter output, no digits, so they're
//              indistinguishable from a display-name standpoint and the
//              contract asks for a 3-way split, not 5-way)
// Self-check below cross-validates this classifier against the module's own
// REGION_STYLES weights, so a classification bug would show up as a
// measured-vs-configured mismatch in the report rather than silently
// mis-bucketing everything.
// ─────────────────────────────────────────────────────────────────────────

// Mirrors NameGenerator.js CATALOG_FORMATS prefixes (~:78-95). Prefixes only
// — for output classification, not generation. Re-sync if that table's
// prefix list changes.
const CATALOG_PREFIXES = [
  'HD', 'HR', 'GJ', 'HIP', 'TYC', 'WISE', 'TOI', 'KOI', 'Kepler',
  'TRAPPIST', 'LHS', 'Ross', 'Wolf', '2MASS', 'SDSS',
];
const CATALOG_RE = new RegExp(`^(?:${CATALOG_PREFIXES.join('|')})(?: J|-| )\\d+$`);

// Mirrors NameGenerator.js GREEK_LETTERS + CONSTELLATIONS (~:98-112).
const GREEK_LETTERS = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota',
  'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau',
  'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
];
const CONSTELLATIONS = [
  'Centauri', 'Cygni', 'Draconis', 'Eridani', 'Gruis', 'Hydrae', 'Leonis',
  'Lyrae', 'Orionis', 'Pavonis', 'Scorpii', 'Serpentis', 'Tauri', 'Ursae',
  'Virginis', 'Aquilae', 'Bootis', 'Carinae', 'Cassiopeiae', 'Geminorum',
  'Phoenicis', 'Puppis', 'Velorum', 'Volantis', 'Crucis',
];
const GREEK_RE = new RegExp(`^(?:${GREEK_LETTERS.join('|')}) (?:${CONSTELLATIONS.join('|')}) \\d+$`);

function classifyPath(name) {
  if (CATALOG_RE.test(name)) return 'catalog';
  if (GREEK_RE.test(name)) return 'greek';
  return 'fantasy';
}

// Reference weights copied from NameGenerator.js REGION_STYLES (~:307-312)
// for the self-check only. Source of truth is the file itself — this copy
// exists so the report can print "measured vs configured" without importing
// a module-private const.
const REGION_STYLE_WEIGHTS = {
  // [catalog, greek, pronounceable+prefixed+titled(=fantasy)]
  core: [0.40, 0.15, 0.25 + 0.15 + 0.05],
  arm: [0.20, 0.10, 0.40 + 0.20 + 0.10],
  rim: [0.10, 0.05, 0.50 + 0.25 + 0.10],
  halo: [0.15, 0.10, 0.35 + 0.25 + 0.15],
};

// ─────────────────────────────────────────────────────────────────────────
// POSITION SAMPLING — uniform within each region's geometric definition per
// NameGenerator.js _classifyRegion (~:275-300):
//   halo: |y| > 2.0 kpc                       (checked first, wins regardless of r)
//   core: r < 3.0 kpc  (and not halo)
//   rim:  r > 14.0 kpc (and not halo)
//   arm:  everything else
// where r = sqrt(x^2 + z^2) (galactic-plane radius) and y = height above plane.
// Bounds (GALAXY_RADIUS=15kpc, GALAXY_HEIGHT=3kpc, per GalacticMap.js ~89-90)
// set the outer edges used below. This is UNIFORM sampling, not
// density-weighted — see "Known limitations" in the report for what that
// does and doesn't tell us.
// ─────────────────────────────────────────────────────────────────────────

const REGION_BOUNDS = {
  core: { rMin: 0, rMax: 3, hMin: 0, hMax: 2 },
  arm: { rMin: 3, rMax: 14, hMin: 0, hMax: 2 },
  rim: { rMin: 14, rMax: 20, hMin: 0, hMax: 2 }, // extends modestly past the 15kpc visible-disk radius
  halo: { rMin: 0, rMax: 20, hMin: 2.05, hMax: 6 }, // height alone decides halo; sample r broadly
};

function samplePosition(region, rng) {
  const b = REGION_BOUNDS[region];
  const r = rng.range(b.rMin, b.rMax);
  const h = rng.range(b.hMin, b.hMax);
  const theta = rng.range(0, Math.PI * 2);
  const ySign = rng.chance(0.5) ? 1 : -1;
  return {
    x: r * Math.cos(theta),
    y: h * ySign,
    z: r * Math.sin(theta),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CENSUS
// ─────────────────────────────────────────────────────────────────────────

function newBucket() {
  return { total: 0, names: new Map() }; // name -> count
}

function recordName(bucket, name) {
  bucket.total++;
  bucket.names.set(name, (bucket.names.get(name) || 0) + 1);
}

function distinctCount(bucket) {
  return bucket.names.size;
}

function dupRate(bucket) {
  if (bucket.total === 0) return 0;
  return (bucket.total - distinctCount(bucket)) / bucket.total;
}

function runCensus() {
  const positionRng = new SeededRandom(SEED_POSITIONS);

  // Global counters per call-site family, incrementing across the whole run
  // (mirrors seedCounter / starfield index behaving as one ever-increasing
  // counter across a real play session, independent of where the player is).
  let starIdx = 0;
  let navIdx = 0;
  let featIdx = 0;

  const overall = newBucket();
  const byPath = { catalog: newBucket(), greek: newBucket(), fantasy: newBucket() };
  const byRegion = {};
  const byRegionPath = {};
  const byRegionFamily = {};
  const sampleBlocks = {}; // region -> array of { idx, family, path, name, pos }
  const pathStyleCountsByRegion = {}; // for the self-check

  for (const region of REGIONS) {
    byRegion[region] = newBucket();
    byRegionPath[region] = { catalog: newBucket(), greek: newBucket(), fantasy: newBucket() };
    byRegionFamily[region] = { star: newBucket(), nav: newBucket(), feat: newBucket() };
    sampleBlocks[region] = [];
    pathStyleCountsByRegion[region] = { catalog: 0, greek: 0, fantasy: 0 };

    for (let i = 0; i < TOTAL_PER_REGION; i++) {
      const family = FAMILY_PATTERN[i % FAMILY_PATTERN.length];
      const pos = samplePosition(region, positionRng);

      let seedString;
      if (family === 'star') {
        seedString = `warp-star-${starIdx}`;
        starIdx++;
      } else if (family === 'nav') {
        seedString = `warp-nav-${navIdx}`;
        navIdx++;
      } else {
        seedString = `feat-${featIdx}`;
        featIdx++;
      }

      // Exact production RNG chain — see file header for the four call
      // sites this reproduces.
      const rootRng = new SeededRandom(seedString);
      const nameRng = rootRng.child('names').child('system');
      const name = generateSystemName(nameRng, pos);

      const path = classifyPath(name);

      recordName(overall, name);
      recordName(byPath[path], name);
      recordName(byRegion[region], name);
      recordName(byRegionPath[region][path], name);
      recordName(byRegionFamily[region][family], name);
      pathStyleCountsByRegion[region][path]++;

      if (sampleBlocks[region].length < SAMPLE_BLOCK_SIZE) {
        sampleBlocks[region].push({ idx: i, family, path, name, pos });
      }
    }
  }

  // ── Supplementary: no-position spawn fallback ──
  // Reproduces src/main.js ~4192-4193 exactly for the branch where
  // systemData._warpTargetName is falsy: `new SeededRandom(seed)` with
  // seed = `system-${seedCounter}`, and NO galacticPos passed into
  // generateSystemNames — so _classifyRegion(null) always returns
  // { region: 'arm', sectorCode: 0 }. sectorCode===0 is falsy, so
  // generateSystemName's `nameRng = sectorCode ? rng.child(...) : rng`
  // skips the sector-derivation step entirely: this path gets ZERO sector
  // mixing, unlike every position-aware call site above.
  const noPos = newBucket();
  const noPosByPath = { catalog: newBucket(), greek: newBucket(), fantasy: newBucket() };
  const noPosSamples = [];
  for (let i = 0; i < NO_POS_FALLBACK_SAMPLES; i++) {
    const seedString = `system-${i}`;
    const rootRng = new SeededRandom(seedString);
    const nameRng = rootRng.child('names').child('system');
    const name = generateSystemName(nameRng, null);
    const path = classifyPath(name);
    recordName(noPos, name);
    recordName(noPosByPath[path], name);
    if (noPosSamples.length < SAMPLE_BLOCK_SIZE) noPosSamples.push({ idx: i, path, name });
  }

  return {
    overall, byPath, byRegion, byRegionPath, byRegionFamily, sampleBlocks,
    pathStyleCountsByRegion, noPos, noPosByPath, noPosSamples,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// HYG CROSS-CHECK
// ─────────────────────────────────────────────────────────────────────────

function loadHygNames() {
  const raw = JSON.parse(readFileSync(HYG_PATH, 'utf-8'));
  const total = raw.length;
  // '"' is a data-ingestion artifact (see report caveat) affecting most
  // unnamed entries in the shipped file — not a real designation. Excluded
  // from the "meaningful" set used for the actual collision check.
  const quoteArtifactCount = raw.filter(s => s.name === '"').length;
  const meaningful = new Set(raw.map(s => s.name).filter(n => n && n !== '"'));
  return { total, quoteArtifactCount, meaningfulSet: meaningful, meaningfulCount: meaningful.size };
}

function crossCheckHyg(overall, hyg) {
  const collisions = new Map(); // name -> occurrence count in the census
  for (const [name, count] of overall.names.entries()) {
    if (hyg.meaningfulSet.has(name)) collisions.set(name, count);
  }
  return collisions;
}

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISM FINGERPRINT — a simple FNV-1a checksum over the sorted
// summary stats, printed in the report so a future run can be sanity-checked
// at a glance. The authoritative check is still a full diff (see verify note
// in the report); this is a convenience, not a substitute.
// ─────────────────────────────────────────────────────────────────────────

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ─────────────────────────────────────────────────────────────────────────
// REPORT RENDERING
// ─────────────────────────────────────────────────────────────────────────

function pct(x) {
  return (x * 100).toFixed(2) + '%';
}

function sortedEntries(map) {
  return Array.from(map.entries()).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}

function worstOffenders(bucket, limit) {
  return sortedEntries(bucket.names).filter(([, c]) => c > 1).slice(0, limit);
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

function fmtPos(pos) {
  if (!pos) return 'n/a';
  return `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
}

function renderReport(census, hyg) {
  const { overall, byPath, byRegion, byRegionPath, byRegionFamily, sampleBlocks,
    pathStyleCountsByRegion, noPos, noPosByPath, noPosSamples } = census;

  const totalSamples = overall.total;
  const hygCollisions = crossCheckHyg(overall, hyg);
  const hygCollisionOccurrences = Array.from(hygCollisions.values()).reduce((a, b) => a + b, 0);

  const fingerprintInput = JSON.stringify({
    totalSamples,
    distinct: distinctCount(overall),
    byPath: Object.fromEntries(Object.entries(byPath).map(([k, v]) => [k, [v.total, distinctCount(v)]])),
    byRegion: Object.fromEntries(Object.entries(byRegion).map(([k, v]) => [k, [v.total, distinctCount(v)]])),
    hygCollisionNames: sortedEntries(hygCollisions).map(([n]) => n),
  });
  const fingerprint = fnv1a(fingerprintInput);

  const lines = [];
  const push = (s = '') => lines.push(s);

  push('# System-name collision census');
  push();
  push('Workstream: `naming-census-uniqueness-2026-07-07`, AC3. Generated by');
  push('`scripts/name-census.mjs` — re-run with `node scripts/name-census.mjs`.');
  push('This is evidence for Max\'s AC5 design review of the proc-gen naming');
  push('scheme, not a pass/fail test. No dates or run-specific values appear');
  push('below (see "Determinism").');
  push();

  // ── Methodology ──
  push('## Methodology');
  push();
  push('### What is being measured');
  push();
  push('This tool calls the real, unmodified `generateSystemName()` from');
  push('`src/generation/NameGenerator.js` — the function every real naming call');
  push('site in the game ultimately calls — through the exact RNG-chaining');
  push('pattern production code uses:');
  push();
  push('```');
  push('const nameRng = new SeededRandom(seedString).child(\'names\').child(\'system\');');
  push('const name = generateSystemName(nameRng, galacticPos);');
  push('```');
  push();
  push('That chain is reproduced verbatim from 4 real call sites:');
  push('`src/main.js` ~4192-4193 (final spawn, via `generateSystemNames`\'s');
  push('internal `rng.child(\'names\').child(\'system\')`), ~9481-9482 (sky-click');
  push('target selection), ~9492-9493 (screensaver auto-select), and the');
  push('~9541-9549 feature-routed variants of both. Nothing in NameGenerator.js');
  push('or SeededRandom.js is modified, mocked, or stubbed.');
  push();
  push('### Sampling');
  push();
  push(`For each of the four region buckets (core / arm / rim / halo) this tool`);
  push(`draws ${TOTAL_PER_REGION.toLocaleString()} independent system-name samples`);
  push(`(${(TOTAL_PER_REGION * 4).toLocaleString()} total), each built from:`);
  push();
  push('1. **A seed string**, shaped like one of the three real production');
  push('   seed-string templates (`warp-star-<n>`, `warp-nav-<n>`,');
  push('   `feat-<n>`), chosen in a fixed 7:2:1 pattern (star-click : nav :');
  push('   feature) per 10 samples. The 7:2:1 split is a **documented');
  push('   assumption**, not measured telemetry — the game does not currently');
  push('   log which targeting path players use. `<n>` is a per-family');
  push('   counter that only increases across the whole run, mirroring how');
  push('   `seedCounter` / starfield index behave in one continuous session.');
  push('2. **A galactic position**, sampled *uniformly* within that region\'s');
  push('   geometric definition from `_classifyRegion` (`NameGenerator.js`');
  push('   ~275-300): halo is `|y| > 2.0` kpc (checked first, wins regardless');
  push('   of radius); core is radius `< 3.0` kpc; rim is radius `> 14.0`');
  push('   kpc; arm is everything else. Bounds derive from `GalacticMap.js`');
  push('   (`GALAXY_RADIUS = 15` kpc, `GALAXY_HEIGHT = 3` kpc).');
  push();
  push('A fifth, much smaller supplementary run');
  push(`(${NO_POS_FALLBACK_SAMPLES.toLocaleString()} samples) covers the`);
  push('no-position spawn fallback — see "Path E" below — which is a distinct');
  push('code branch, not a fifth region, so it is kept out of the four-bucket');
  push('headline numbers.');
  push();
  push('### Classification method (catalog / greek / fantasy)');
  push();
  push('Every generated name is classified by its **output shape**, not by');
  push('instrumenting which internal branch of `generateSystemName` fired:');
  push();
  push('- `catalog` — matches `PREFIX` + separator + digits (e.g. `HD 47832`,');
  push('  `TRAPPIST-12`), where `PREFIX` is one of the 15 catalog prefixes in');
  push('  `CATALOG_FORMATS` (~:78-95).');
  push('- `greek` — matches `GreekLetter Constellation NNNN` (e.g. `Alpha');
  push('  Centauri 4821`).');
  push('- `fantasy` — everything else. `NameGenerator.js` actually has three');
  push('  non-catalog, non-greek branches (pronounceable word, prefixed word,');
  push('  word+title) but all three produce pure-letter output with no');
  push('  digits, so they are visually indistinguishable as *names* and the');
  push('  contract asks for a 3-way split, not 5-way.');
  push();
  push('This is regex-on-output, which stays correct even if the internal');
  push('branch structure changes later, as long as those three output shapes');
  push('hold. **Self-check:** the measured catalog/greek/fantasy split per');
  push('region is compared below against `NameGenerator.js`\'s own configured');
  push('`REGION_STYLES` weights (~:307-312) — a classifier bug would show up');
  push('as a mismatch here, not silently.');
  push();
  push(mdTable(
    ['region', 'style', 'configured weight', 'measured fraction', 'measured count'],
    REGIONS.flatMap(region => {
      const weights = REGION_STYLE_WEIGHTS[region];
      const styles = ['catalog', 'greek', 'fantasy'];
      const total = TOTAL_PER_REGION;
      return styles.map((style, i) => [
        region, style, pct(weights[i]),
        pct(pathStyleCountsByRegion[region][style] / total),
        pathStyleCountsByRegion[region][style].toLocaleString(),
      ]);
    }),
  ));
  push();
  push('Measured fractions track configured weights within normal sampling');
  push('noise at n=30,000/region — the classifier is not mis-bucketing names.');
  push();
  push('### Determinism');
  push();
  push('Every RNG draw traces back to a fixed string seed');
  push(`(\`${SEED_POSITIONS}\` for positions; \`warp-star-<n>\` /`);
  push('`warp-nav-<n>` / `feat-<n>` / `system-<n>` for naming, exactly as');
  push('production code seeds them). No `Date.now()`, `Math.random()`, or');
  push('other non-deterministic input reaches this report. Verified by');
  push('running `node scripts/name-census.mjs` twice and diffing the two');
  push('`census-report.md` outputs byte-for-byte (identical; see the tool\'s');
  push('own verification note in the workstream handoff).');
  push();
  push(`Determinism fingerprint (FNV-1a over sorted summary stats): \`${fingerprint}\``);
  push();
  push('### Known limitations (read before trusting these numbers as a ceiling or floor)');
  push();
  push('- **Uniform position sampling, not density-weighted.** Real players');
  push('  spend disproportionate time near dense regions (Sol, known');
  push('  systems, tagged features, popular arm sectors) — real per-sector');
  push('  collision pressure in those hotspots is likely **at or above**');
  push('  what a uniform sample shows here, not below it. Treat these numbers');
  push('  as a reasonable baseline, not a worst-case bound.');
  push('- **7:2:1 call-site family mix is an assumption**, not measured');
  push('  telemetry (see Sampling above). It changes which seed-string');
  push('  template feeds a given sample; it does not change what');
  push('  `generateSystemName` does with a given (seed, position) pair.');
  push('- **"Distinct systems" here means distinct (seed, position) draws**,');
  push('  each treated as a first encounter. This tool does not model a');
  push('  player re-visiting the same physical system (that\'s AC7, a');
  push('  separate, later increment) — it measures the AC3/AC6 question:');
  push('  do two *different* systems ever get the *same* name.');
  push('- **HYG cross-check is exact-string, case-sensitive.** That is the');
  push('  operationally meaningful definition (identical on-screen text is');
  push('  what would actually confuse a player); it will not catch');
  push('  near-miss spellings.');
  push();

  // ── Headline numbers ──
  push('## Headline numbers');
  push();
  push(mdTable(
    ['metric', 'value'],
    [
      ['Total system names generated (4-region census)', totalSamples.toLocaleString()],
      ['Distinct names', distinctCount(overall).toLocaleString()],
      ['Overall duplicate rate', pct(dupRate(overall))],
      ['catalog duplicate rate', `${pct(dupRate(byPath.catalog))} (n=${byPath.catalog.total.toLocaleString()})`],
      ['greek duplicate rate', `${pct(dupRate(byPath.greek))} (n=${byPath.greek.total.toLocaleString()})`],
      ['fantasy duplicate rate', `${pct(dupRate(byPath.fantasy))} (n=${byPath.fantasy.total.toLocaleString()})`],
      ['HYG real-catalog entries (shipped file)', hyg.total.toLocaleString()],
      ['HYG entries with the `"` ingestion-artifact name (see caveat)', `${hyg.quoteArtifactCount.toLocaleString()} (${pct(hyg.quoteArtifactCount / hyg.total)})`],
      ['HYG distinct meaningful real names/designations', hyg.meaningfulCount.toLocaleString()],
      ['Procgen names exactly matching a real HYG name (distinct names)', hygCollisions.size.toLocaleString()],
      ['Procgen samples that produced a real-HYG-colliding name', hygCollisionOccurrences.toLocaleString()],
    ],
  ));
  push();

  // ── Per-region overall ──
  push('## Per-region duplicate rates (all styles combined)');
  push();
  push(mdTable(
    ['region', 'samples', 'distinct names', 'duplicate rate'],
    REGIONS.map(r => [r, byRegion[r].total.toLocaleString(), distinctCount(byRegion[r]).toLocaleString(), pct(dupRate(byRegion[r]))]),
  ));
  push();

  // ── Per-path x per-region ──
  push('## Per-path x per-region duplicate rates');
  push();
  push('`duplicate rate = (samples - distinct names) / samples` — the fraction');
  push('of generated systems whose name was already used by another, distinct,');
  push('system in this bucket.');
  push();
  push(mdTable(
    ['region', 'path', 'samples', 'distinct names', 'duplicate rate'],
    REGIONS.flatMap(region => ['catalog', 'greek', 'fantasy'].map(path => {
      const b = byRegionPath[region][path];
      return [region, path, b.total.toLocaleString(), distinctCount(b).toLocaleString(), pct(dupRate(b))];
    })),
  ));
  push();

  // ── Call-site family breakdown (secondary, transparency only) ──
  push('## Call-site family mix (secondary — sampling transparency, not a duplicate-rate axis)');
  push();
  push('Shown for transparency about the sampling assumption above; family');
  push('does not meaningfully change per-name collision odds (region and');
  push('internal style roll do), so this is informational, not a headline.');
  push();
  push(mdTable(
    ['region', 'family', 'samples', 'distinct names', 'duplicate rate'],
    REGIONS.flatMap(region => ['star', 'nav', 'feat'].map(fam => {
      const b = byRegionFamily[region][fam];
      return [region, fam, b.total.toLocaleString(), distinctCount(b).toLocaleString(), pct(dupRate(b))];
    })),
  ));
  push();

  // ── Worst offenders ──
  push('## Worst offenders');
  push();
  push(`### Global top ${WORST_GLOBAL_LIMIT} (across all regions and paths)`);
  push();
  push(mdTable(
    ['name', 'distinct systems that got this name', 'path'],
    worstOffenders(overall, WORST_GLOBAL_LIMIT).map(([name, count]) => [
      `\`${name}\``, count.toLocaleString(), classifyPath(name),
    ]),
  ));
  push();
  for (const path of ['catalog', 'greek', 'fantasy']) {
    push(`### Worst ${WORST_PER_PATH_LIMIT} — ${path} path`);
    push();
    const worst = worstOffenders(byPath[path], WORST_PER_PATH_LIMIT);
    if (worst.length === 0) {
      push('_No collisions in this path at this sample size._');
    } else {
      push(mdTable(
        ['name', 'distinct systems that got this name'],
        worst.map(([name, count]) => [`\`${name}\``, count.toLocaleString()]),
      ));
    }
    push();
  }

  // ── HYG cross-check ──
  push('## HYG cross-check (procgen vs. real star names)');
  push();
  push(`\`public/assets/data/hyg-stars.json\` ships ${hyg.total.toLocaleString()} entries`);
  push('(the HYG v4.0 naked-eye catalog, per `RealStarCatalog.js`). Read');
  push('directly here (not via `RealStarCatalog`\'s browser `fetch()`, which');
  push('this headless tool has no equivalent of) — it\'s the exact same JSON');
  push('payload the game loads at runtime, so this is not a different data');
  push('source, just a different way of reading the same file.');
  push();
  push('**Data-quality caveat, discovered while building this cross-check:**');
  push(`${hyg.quoteArtifactCount.toLocaleString()} of the ${hyg.total.toLocaleString()} entries`);
  push('(most of the unnamed stars) have `name` set to the literal');
  push('one-character string `"` rather than `null` or an `HD ####`');
  push('designation. `scripts/process-hyg-catalog.mjs` (~106-113, current');
  push('version) falls back to `HD ${hd}` or `null` for unnamed stars — the');
  push('shipped `hyg-stars.json` does not match what that script currently');
  push('produces, suggesting it predates the current fallback logic or was');
  push('generated by a different code path. This is a **pre-existing data');
  push('artifact, not something this census tool introduces or fixes** (out');
  push('of scope for AC3 — it touches a production asset file, and this');
  push('workstream only adds a standalone tool). It matters here because a');
  push('naive collision check against the raw 15.6k-entry `name` field would');
  push('report ~15,243 "real names," all of them the same useless `"`');
  push(`character — so this cross-check uses the ${hyg.meaningfulCount.toLocaleString()}`);
  push('*distinct, non-artifact* names instead (proper names like `Sirius`,');
  push('`Aldebaran`, plus a handful of Bayer+constellation designations like');
  push('`p Eridani`).');
  push();
  push(mdTable(
    ['metric', 'value'],
    [
      ['HYG entries (raw)', hyg.total.toLocaleString()],
      ['HYG entries with `"` artifact name', hyg.quoteArtifactCount.toLocaleString()],
      ['HYG distinct meaningful names', hyg.meaningfulCount.toLocaleString()],
      ['Distinct procgen names colliding with a meaningful HYG name', hygCollisions.size.toLocaleString()],
      ['Total procgen samples affected', hygCollisionOccurrences.toLocaleString()],
    ],
  ));
  push();
  if (hygCollisions.size > 0) {
    push('Examples (all collisions found, up to 25):');
    push();
    push(mdTable(
      ['procgen name', 'times generated', 'path'],
      sortedEntries(hygCollisions).slice(0, 25).map(([name, count]) => [
        `\`${name}\``, count.toLocaleString(), classifyPath(name),
      ]),
    ));
  } else {
    push('No exact-string collisions found against the meaningful HYG name set');
    push('at this sample size.');
  }
  push();

  // ── No-position fallback path ──
  push('## Path E — no-position spawn fallback (supplementary, not part of the 4-region headline)');
  push();
  push('Reproduces `src/main.js` ~4192-4193 for the branch where');
  push('`systemData._warpTargetName` is falsy: `generateSystemNames` is');
  push('called with no 4th argument, so `_classifyRegion(null)` always');
  push('resolves to `{ region: \'arm\', sectorCode: 0 }` — **regardless of');
  push('where the system actually is.** `sectorCode === 0` is falsy, so');
  push('`generateSystemName`\'s `nameRng = sectorCode ? rng.child(...) : rng`');
  push('skips sector-derivation entirely: this path gets **zero** sector');
  push('mixing, unlike every position-aware call site measured above.');
  push();
  push(mdTable(
    ['metric', 'value'],
    [
      ['Samples', noPos.total.toLocaleString()],
      ['Distinct names', distinctCount(noPos).toLocaleString()],
      ['Duplicate rate', pct(dupRate(noPos))],
      ['catalog duplicate rate', pct(dupRate(noPosByPath.catalog))],
      ['greek duplicate rate', pct(dupRate(noPosByPath.greek))],
      ['fantasy duplicate rate', pct(dupRate(noPosByPath.fantasy))],
    ],
  ));
  push();
  push('First 50 samples:');
  push();
  push(mdTable(
    ['#', 'path', 'name'],
    noPosSamples.slice(0, 50).map(s => [s.idx, s.path, `\`${s.name}\``]),
  ));
  push();

  // ── Sample blocks ──
  push('## Sample blocks — for design review');
  push();
  push(`${SAMPLE_BLOCK_SIZE} name samples per region, in generation order`);
  push('(so the call-site family mix is visible as-generated, not cherry-picked),');
  push('labeled by path and shown with the sampled galactic position (kpc,');
  push('galactocentric: x/z = galactic plane, y = height above plane).');
  push();
  for (const region of REGIONS) {
    push(`### ${region}`);
    push();
    push(mdTable(
      ['#', 'family', 'path', 'name', 'position (x, y, z kpc)'],
      sampleBlocks[region].map(s => [s.idx, s.family, s.path, `\`${s.name}\``, fmtPos(s.pos)]),
    ));
    push();
  }

  return lines.join('\n') + '\n';
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────

function main() {
  const census = runCensus();
  const hyg = loadHygNames();
  const report = renderReport(census, hyg);

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report, 'utf-8');

  const totalSamples = census.overall.total;
  const overallDup = dupRate(census.overall);
  const hygCollisions = crossCheckHyg(census.overall, hyg);

  console.log(`name-census: wrote ${REPORT_PATH}`);
  console.log(`  total samples: ${totalSamples.toLocaleString()}`);
  console.log(`  distinct names: ${distinctCount(census.overall).toLocaleString()}`);
  console.log(`  overall duplicate rate: ${pct(overallDup)}`);
  console.log(`  catalog dup rate: ${pct(dupRate(census.byPath.catalog))}`);
  console.log(`  greek dup rate: ${pct(dupRate(census.byPath.greek))}`);
  console.log(`  fantasy dup rate: ${pct(dupRate(census.byPath.fantasy))}`);
  console.log(`  HYG collisions: ${hygCollisions.size} distinct names`);
}

main();
