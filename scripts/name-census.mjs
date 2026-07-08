#!/usr/bin/env node
// scripts/name-census.mjs — headless, deterministic system-name census.
//
// RUN:  node scripts/name-census.mjs
// Writes docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md
// and prints a short summary to stdout. No flags, no network, no browser.
//
// PURPOSE. Originally (AC3) this tool MEASURED how often the old seed-based
// naming produced the same name for two different systems. Since increment 3b
// (AC6/AC7, ac5-decision.md) system naming is UNIQUE BY CONSTRUCTION: the name
// is a pure, injective function of canonical galactic position. So this tool now
// serves two jobs:
//   1. VERIFY the guarantee empirically at volume — 0 duplicate names across
//      distinct position cells, 0 collisions with real (HYG) names, 0 procgen
//      designations inside real designation space — through the exact production
//      call-site RNG chains (which the namer now ignores; that IS the point).
//   2. Emit refreshed per-region sample blocks (4 classes) + a settled-systems
//      gazetteer (via the exported enumeration helper) for Max's AC6 UAT review.
//
// DETERMINISM CONTRACT: every RNG draw goes through SeededRandom with a fixed
// string seed. No Date.now(), Math.random(), or environment value reaches the
// report. Two runs produce byte-identical census-report.md (verified: run twice,
// diff the output).
//
// WHAT THIS CALLS: the real, unmodified generateSystemName() from
// src/generation/NameGenerator.js, driven through the four production call-site
// RNG chains (see nameVia* below). It does not modify/mock/stub any source.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { SeededRandom } from '../src/generation/SeededRandom.js';
import { generateSystemName, quantizePosition, enumerateSettledSystems } from '../src/generation/NameGenerator.js';

// ─────────────────────────────────────────────────────────────────────────
// CONFIG — all fixed, all deterministic
// ─────────────────────────────────────────────────────────────────────────

const TOTAL_PER_REGION = 30000;          // 120,000 total (> the 100k bar)
const SAMPLE_BLOCK_SIZE = 200;           // per region (contract: >= 200/region)

const SEED_POSITIONS = 'name-census-positions-v2';
const REGIONS = ['core', 'arm', 'rim', 'halo'];

// Call-site family mix (transparency only — the namer ignores the seed string,
// so family cannot change any name; a fixed 7:2:1 star:nav:feat pattern is kept
// so the report shows production-shaped seed strings feeding the same positions).
const FAMILY_PATTERN = ['star', 'star', 'star', 'star', 'star', 'star', 'star', 'nav', 'nav', 'feat'];

const HYG_PATH = fileURLToPath(new URL('../public/assets/data/hyg-stars.json', import.meta.url));
const REPORT_PATH = fileURLToPath(new URL(
  '../docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md',
  import.meta.url,
));

// Real astronomical-designation prefixes procgen must never intrude on.
const REAL_DESIGNATION_PREFIXES = [
  'HD', 'HR', 'GJ', 'HIP', 'TYC', 'WISE', 'TOI', 'KOI', 'Kepler', 'TRAPPIST',
  'LHS', 'Ross', 'Wolf', '2MASS', 'SDSS', 'Gaia', 'TIC', 'KIC', 'GSC', 'UCAC',
  'Groombridge', 'Lacaille',
];
const REAL_DESIGNATION_RE = new RegExp(`^(?:${REAL_DESIGNATION_PREFIXES.join('|')})[\\s-]`);

// ─────────────────────────────────────────────────────────────────────────
// POSITION SAMPLING — uniform jittered positions within each region's geometry
// (like real star worldX/Y/Z, NOT round lattice points). Mirrors
// NameGenerator._classifyRegion. r = sqrt(x^2+z^2), y = height above plane.
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
// PRODUCTION CALL-SITE RNG CHAINS (verbatim). The namer IGNORES the rng — every
// chain must return the same name for a given position. We assert that.
// ─────────────────────────────────────────────────────────────────────────

function nameSkyClick(pos, idx)   { return generateSystemName(new SeededRandom(`warp-star-${idx}`).child('names').child('system'), pos); }
function nameNav(pos, seed)       { return generateSystemName(new SeededRandom(`warp-nav-${seed}`), pos); }
function nameFeature(pos, seed)   { return generateSystemName(new SeededRandom(`feat-${seed}`).child('names').child('system'), pos); }

// ─────────────────────────────────────────────────────────────────────────
// NAME CLASSIFICATION (output shape → survey / multipart / bare)
// ─────────────────────────────────────────────────────────────────────────

function classifyClass(name) {
  if (/^[A-Z]{2,4} J[0-9A-Z]{7}[+-][0-9A-Z]{7}$/.test(name)) return 'survey';   // NBG J35EI75F-KN0H841
  if (/^[A-Z][a-z]+ [A-Z][a-z]+ \d{5}$/.test(name)) return 'greek';             // Theta Karnun… 07437
  if (/^[A-Z][a-z]+-[0-9A-Z]{10}$/.test(name)) return 'multipart';              // Tosnud-6PCUPG2IJU
  return 'bare';                                                                // Tukgotpigyodcop
}

// ─────────────────────────────────────────────────────────────────────────
// CENSUS
// ─────────────────────────────────────────────────────────────────────────

function runCensus() {
  const positionRng = new SeededRandom(SEED_POSITIONS);

  let starIdx = 0, navIdx = 0, featIdx = 0;

  const overall = { total: 0, cells: new Set(), names: new Set() };
  const classCounts = { survey: 0, greek: 0, multipart: 0, bare: 0 };
  const byRegion = {};
  const sampleBlocks = {};
  let pathDisagreements = 0;
  let revisitMismatches = 0;
  let dupNamesAcrossCells = 0;
  let realNameEmissions = 0;
  let realDesignationEmissions = 0;
  const cellToName = new Map();
  const nameToCell = new Map();

  for (const region of REGIONS) {
    byRegion[region] = { total: 0, cells: new Set(), names: new Set(), classCounts: { survey: 0, greek: 0, multipart: 0, bare: 0 } };
    sampleBlocks[region] = [];

    for (let i = 0; i < TOTAL_PER_REGION; i++) {
      const family = FAMILY_PATTERN[i % FAMILY_PATTERN.length];
      const pos = samplePosition(region, positionRng);
      const key = quantizePosition(pos).key;

      let name, seedString;
      if (family === 'star') { seedString = `warp-star-${starIdx}`; name = nameSkyClick(pos, starIdx); starIdx++; }
      else if (family === 'nav') { seedString = `warp-nav-${navIdx}`; name = nameNav(pos, navIdx); navIdx++; }
      else { seedString = `feat-${featIdx}`; name = nameFeature(pos, featIdx); featIdx++; }

      // Path-agreement: every call-site chain must produce this same name.
      if (nameSkyClick(pos, 1) !== name || nameNav(pos, 2) !== name || nameFeature(pos, 3) !== name) pathDisagreements++;

      // Revisit + uniqueness ledgers.
      if (cellToName.has(key)) { if (cellToName.get(key) !== name) revisitMismatches++; }
      else cellToName.set(key, name);
      const prev = nameToCell.get(name);
      if (prev !== undefined && prev !== key) dupNamesAcrossCells++;
      else nameToCell.set(name, key);

      if (REAL_DESIGNATION_RE.test(name)) realDesignationEmissions++;

      const cls = classifyClass(name);
      classCounts[cls]++;
      byRegion[region].classCounts[cls]++;
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
    realDesignationEmissions, nameToCell,
  };
}

// ── Settled-systems gazetteer (first-class section, ac5 addendum ruling 2) ──
// Bare "settled" names are 1-in-16.8M, so a uniform census surfaces ~none. This
// gazetteer instead drives the EXPORTED enumeration helper
// (NameGenerator.enumerateSettledSystems) — the deterministic, no-registry basis
// for a future in-game settled-systems catalog. For each region we scatter many
// tiny bounding boxes (deterministic seed) and take ONE settled system from each
// so the sample is spatially spread (maximum name variety), then confirm every
// listed name round-trips through generateSystemName.
function runGazetteer() {
  const out = {};
  const GAZ_PER_REGION = 24;
  const half = 0.0012; // ~1.2 pc box — spans ≥1 coarse eligible period per axis
  const rng = new SeededRandom('gazetteer-centers-v1');
  for (const region of REGIONS) {
    const seen = new Set();
    const list = [];
    let attempts = 0;
    while (list.length < GAZ_PER_REGION && attempts < 40000) {
      attempts++;
      const c = samplePosition(region, rng);
      const box = {
        xMin: c.x - half, xMax: c.x + half,
        yMin: c.y - half, yMax: c.y + half,
        zMin: c.z - half, zMax: c.z + half,
      };
      const found = enumerateSettledSystems(box, 20);
      for (const s of found) {
        if (s.region !== region || seen.has(s.name)) continue;
        // Confirm the enumeration round-trips (the helper's core guarantee).
        if (generateSystemName(null, s.position) !== s.name) continue;
        seen.add(s.name);
        list.push({ name: s.name, x: s.position.x, y: s.position.y, z: s.position.z });
        break; // one per box → maximum spatial spread
      }
    }
    out[region] = list;
  }
  return out;
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

function crossCheckHyg(nameToCell, hyg) {
  const collisions = [];
  for (const name of nameToCell.keys()) if (hyg.meaningfulSet.has(name)) collisions.push(name);
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

function renderReport(census, bare, hyg) {
  const { overall, classCounts, byRegion, sampleBlocks,
    pathDisagreements, revisitMismatches, dupNamesAcrossCells,
    realDesignationEmissions, nameToCell } = census;

  const hygCollisions = crossCheckHyg(nameToCell, hyg);

  const fingerprintInput = JSON.stringify({
    total: overall.total,
    distinctCells: overall.cells.size,
    distinctNames: overall.names.size,
    classCounts,
    byRegion: Object.fromEntries(REGIONS.map(r => [r, [byRegion[r].total, byRegion[r].cells.size, byRegion[r].names.size]])),
    dupNamesAcrossCells, revisitMismatches, pathDisagreements, realDesignationEmissions,
    hygCollisions: hygCollisions.slice().sort(),
    bare: Object.fromEntries(REGIONS.map(r => [r, bare[r].map(b => b.name)])),
  });
  const fingerprint = fnv1a(fingerprintInput);

  const lines = [];
  const push = (s = '') => lines.push(s);

  push('# System-name uniqueness census');
  push();
  push('Workstream: `naming-census-uniqueness-2026-07-07`, AC3 → AC6/AC7. Generated');
  push('by `scripts/name-census.mjs` — re-run with `node scripts/name-census.mjs`.');
  push('This is evidence for Max\'s AC6 UAT review of the position-derived naming');
  push('scheme. No dates or run-specific values appear below (see "Determinism").');
  push();

  push('## The guarantee, and how it is verified here');
  push();
  push('Since increment 3b (ac5-decision.md), a system\'s name is a **pure,');
  push('injective function of its canonical galactic position** — there is no');
  push('registry and no persistence. Uniqueness is structural:');
  push();
  push('> **By construction:** the position is quantized to a fixed lattice at');
  push('> `Q = 4e-6 kpc` (0.004 pc — the finest grid tier\'s minimum star spacing);');
  push('> the three lattice coordinates are packed into one mixed-radix locator `L`');
  push('> (~70 bits); and every name class embeds `L` injectively (survey base-36');
  push('> field, word + code, or greek letter + word + position numeral), except the');
  push('> rare bare-word class which is drawn from a finite region-partitioned supply');
  push('> indexed injectively by position. Distinct positions → distinct `L` →');
  push('> distinct names. The four class shapes are mutually exclusive strings, so');
  push('> names never collide across classes either.');
  push();
  push('> **The bit floor (honest aesthetics).** An injective encoding of a ~70-bit');
  push('> locator needs ~14 base-36 chars (or ~21 decimal digits). A short,');
  push('> pure-decimal 2MASS-style designation is therefore mathematically impossible');
  push('> while the zero-duplicate guarantee holds — so 3c\'s win is STRUCTURE');
  push('> (grouping / survey prefix / J-epoch marker / latitude sign / four-class');
  push('> variety) and shorter/varied words, NOT sub-15-char brevity. Designations run');
  push('> ~17-20 chars (survey/multipart), greek up to ~29, bare ~15 (down from 3b\'s');
  push('> up-to-18). See ac5-decision.md addendum ruling 1.');
  push();
  push('The named-via columns below drive the **exact production call-site RNG');
  push('chains** (`warp-star-<idx>` sky-click, `warp-nav-<seed>` NavComputer,');
  push('`feat-<seed>` feature route). The generator **ignores** those seeds — which');
  push('is precisely why every path agrees and revisits are stable. This tool asserts');
  push('that agreement on every sample.');
  push();

  push('## Headline — verification');
  push();
  push(mdTable(['check', 'result'], [
    ['Total names generated (4-region census)', overall.total.toLocaleString()],
    ['Distinct position cells sampled', overall.cells.size.toLocaleString()],
    ['Distinct names produced', overall.names.size.toLocaleString()],
    ['**Duplicate names across distinct cells** (AC6: must be 0)', `**${dupNamesAcrossCells}**`],
    ['Revisit mismatches (same cell → different name; must be 0)', `${revisitMismatches}`],
    ['Path disagreements (sky-click vs nav vs feature; must be 0)', `${pathDisagreements}`],
    ['Procgen designations in real designation space (must be 0)', `${realDesignationEmissions}`],
    ['Collisions with a real HYG name (must be 0)', `${hygCollisions.length}`],
  ]));
  push();
  push('`distinct names === distinct cells` and `duplicate names across cells === 0`');
  push('together are the empirical face of the by-construction injectivity: at this');
  push('volume every distinct position got its own name, and no two distinct cells');
  push('ever shared one.');
  push();
  push(`Determinism fingerprint (FNV-1a over sorted summary stats): \`${fingerprint}\``);
  push();

  push('## Class mix (region flavor, re-expressed over the four classes)');
  push();
  push('Region only steers the class MIX (core catalog-heavy → rim fantasy-leaning);');
  push('it never affects uniqueness. `survey` = fictional-prefix grouped designation;');
  push('`greek` = greek letter + region word + position numeral (restored 3c);');
  push('`multipart` = region-flavoured word + position code; `bare` = RARE settled-era');
  push('proper name (uniform sampling surfaces ~none — see the gazetteer below).');
  push();
  push(mdTable(['region', 'samples', 'survey', 'greek', 'multipart', 'bare'],
    REGIONS.map(r => {
      const b = byRegion[r];
      return [r, b.total.toLocaleString(),
        `${pct(b.classCounts.survey / b.total)}`,
        `${pct(b.classCounts.greek / b.total)}`,
        `${pct(b.classCounts.multipart / b.total)}`,
        `${b.classCounts.bare}`];
    })));
  push();
  push(`Galaxy-wide totals — survey: ${classCounts.survey.toLocaleString()}, ` +
    `greek: ${classCounts.greek.toLocaleString()}, ` +
    `multipart: ${classCounts.multipart.toLocaleString()}, bare: ${classCounts.bare}.`);
  push();

  push('## HYG cross-check (procgen vs. real star names)');
  push();
  push(`\`public/assets/data/hyg-stars.json\` ships ${hyg.total.toLocaleString()} entries`);
  push('(HYG v4.0, regenerated in increment 3a / AC9 — 0 remaining `"` artifacts).');
  push('Every distinct procgen name in this census was checked against the full set');
  push(`of ${hyg.meaningfulCount.toLocaleString()} distinct meaningful real names.`);
  push();
  push(mdTable(['metric', 'value'], [
    ['HYG entries (raw)', hyg.total.toLocaleString()],
    ['HYG entries with the `"` artifact name', hyg.quoteArtifactCount.toLocaleString()],
    ['HYG distinct meaningful names', hyg.meaningfulCount.toLocaleString()],
    ['Distinct procgen names colliding with a real name', hygCollisions.length.toLocaleString()],
  ]));
  push();
  if (hygCollisions.length === 0) {
    push('**Zero collisions.** The catalog class uses fictional survey prefixes');
    push('(disjoint from real designation space) and the bare-word class is');
    push('structurally blocklisted against the real proper-name set');
    push('(`src/generation/data/realProperNames.js`), so a procgen name can never');
    push('equal a real star name.');
  } else {
    push('Collisions found (should be none): ' + hygCollisions.slice(0, 25).map(n => `\`${n}\``).join(', '));
  }
  push();

  push('## Settled-systems gazetteer (the RARE settled-era proper names)');
  push();
  push('Bare "settled" names are deliberately rare — ~1 in 16.8M positions (`BARE_M³`,');
  push('`256³`), i.e. ≈12k settled systems galaxy-wide — so a uniform census surfaces');
  push('essentially none. This gazetteer is emitted by the EXPORTED enumeration helper');
  push('`NameGenerator.enumerateSettledSystems(bounds)`: the deterministic, no-registry');
  push('basis for a future in-game "settled systems catalog / search" feature (that UI');
  push('is out of scope — captured for the successor workstream). Each listed name is');
  push('globally unique, round-trips through `generateSystemName` for its position, and');
  push('is structurally blocklisted against the real proper-name set. Words are now');
  push('shorter/varied CVC syllables (1100-syllable alphabet, bijective supply');
  push('≈1.6e15; bare allocation ≈2.75e14 ⇒ ~17% of supply, well under the 50% margin).');
  push();
  for (const region of REGIONS) {
    push(`### ${region}`);
    push();
    if (bare[region].length === 0) { push('_(none found in the scan window)_'); push(); continue; }
    push(mdTable(['settled system', 'position (x, y, z kpc)'],
      bare[region].map(b => [`\`${b.name}\``, `${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}`])));
    push();
  }

  push('## Sample blocks — for design review');
  push();
  push(`${SAMPLE_BLOCK_SIZE} name samples per region, in generation order, labeled by`);
  push('call-site family and class, with the sampled galactic position (kpc,');
  push('galactocentric: x/z = galactic plane, y = height above plane). The family');
  push('column is shown only to prove path-independence — it never changes a name.');
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
  const census = runCensus();
  const bare = runGazetteer();
  const hyg = loadHyg();
  const report = renderReport(census, bare, hyg);

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report, 'utf-8');

  const hygCollisions = crossCheckHyg(census.nameToCell, hyg);
  console.log(`name-census: wrote ${REPORT_PATH}`);
  console.log(`  total names: ${census.overall.total.toLocaleString()}`);
  console.log(`  distinct cells: ${census.overall.cells.size.toLocaleString()}`);
  console.log(`  distinct names: ${census.overall.names.size.toLocaleString()}`);
  console.log(`  duplicate names across cells: ${census.dupNamesAcrossCells}`);
  console.log(`  revisit mismatches: ${census.revisitMismatches}`);
  console.log(`  path disagreements: ${census.pathDisagreements}`);
  console.log(`  real-designation-space emissions: ${census.realDesignationEmissions}`);
  console.log(`  HYG collisions: ${hygCollisions.length}`);
}

main();
