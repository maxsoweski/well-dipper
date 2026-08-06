/**
 * gen-neighborhood-reference.mjs — AC1 (real-universe-overlay Increment 5).
 *
 * Emits the committed closed reference table
 * docs/WORKSTREAMS/real-universe-overlay-2026-07-12/neighborhood-reference.json:
 * for each origin (Sol, Sirius), every NAMED star within 5.0 pc (excluding the
 * origin itself), as { name, refDistPc, spect, source }, sorted by distance;
 * plus a top-level absentFamous documented-gap list (design fact 6) and a
 * derivation note (radius, shipped-catalog provenance, ±2% tolerance rationale
 * per design fact 5).
 *
 * Reads only the two shipped catalogs (hyg-stars.json ∪ real-star-supplement
 * .json). Distances are Euclidean in the shared galactocentric-kpc frame
 * (design fact 1: catalogs and nav share one frame, Sol at (8.0, 0.025, 0),
 * pc = kpc × 1000). Deterministic and byte-identical on re-run — no timestamps
 * (mirrors the scripts/ingest-exoplanets.mjs determinism pattern).
 *
 * Usage:  node scripts/gen-neighborhood-reference.mjs [outPath]
 *   outPath defaults to the committed table above.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const HYG_URL = new URL('../public/assets/data/hyg-stars.json', import.meta.url);
const SUPP_URL = new URL('../public/assets/data/real-star-supplement.json', import.meta.url);
const DEFAULT_OUT = fileURLToPath(new URL(
  '../docs/WORKSTREAMS/real-universe-overlay-2026-07-12/neighborhood-reference.json',
  import.meta.url,
));

// Code-point string comparator — deterministic across every locale/environment
// (localeCompare is NOT guaranteed byte-stable across ICU builds).
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const round3 = (v) => parseFloat(v.toFixed(3));

const RADIUS_PC = 5.0;

// Famous nearby stars in NEITHER shipped catalog (below the HYG mag<7.0 cut and
// not among the 14 supplement hosts). Documented gap — never asserted by AC1
// (design fact 6). Sorted by code point for determinism.
const ABSENT_FAMOUS = [
  'Lacaille 9352',
  'Lalande 21185',
  'Luyten 726-8 / UV Ceti',
  'Ross 154',
  'Ross 248',
  'Wolf 359',
].sort(cmp);

const ORIGIN_NAMES = ['Sol', 'Sirius'];

function isNamed(s) {
  // Excludes the 39 empty-name HYG rows and the pre-regen '"' quote artifact.
  return typeof s.name === 'string' && s.name.trim() !== '' && s.name !== '"';
}

function distPc(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000;
}

/**
 * Build the reference object from already-parsed catalog data.
 * @param {Array} hyg — hyg-stars.json (array of star records)
 * @param {object} supplement — real-star-supplement.json ({ stars })
 */
export function buildReference(hyg, supplement) {
  const supplementStars = supplement?.stars ?? [];
  // Tag provenance; identity (===) within this array drives origin exclusion.
  const candidates = [
    ...hyg.map((s) => ({ ...s, source: 'hyg' })),
    ...supplementStars.map((s) => ({ ...s, source: 'supplement' })),
  ];

  const origins = {};
  for (const originName of ORIGIN_NAMES) {
    const origin = candidates.find((s) => s.source === 'hyg' && s.name === originName);
    if (!origin) throw new Error(`origin '${originName}' not found in hyg catalog`);

    const neighbors = [];
    for (const s of candidates) {
      if (s === origin) continue;      // exclude the origin itself (by identity)
      if (!isNamed(s)) continue;
      const d = distPc(s, origin);
      if (d > RADIUS_PC) continue;
      neighbors.push({ _d: d, name: s.name, refDistPc: round3(d), spect: s.spect, source: s.source });
    }
    // Sort by ascending raw distance; code-point name tiebreak for a stable
    // order when two raw distances coincide (floats: essentially never).
    neighbors.sort((a, b) => (a._d - b._d) || cmp(a.name, b.name));
    origins[originName] = neighbors.map(({ name, refDistPc, spect, source }) => ({
      name, refDistPc, spect, source,
    }));
  }

  return {
    _generatedBy: 'scripts/gen-neighborhood-reference.mjs',
    derivation: {
      radiusPc: RADIUS_PC,
      sources: [
        'public/assets/data/hyg-stars.json (HYG catalog, naked-eye stars, mag<7.0 cut)',
        'public/assets/data/real-star-supplement.json (dim named hosts at true positions)',
      ],
      method:
        'For each origin, every named star (non-empty name, excluding the origin) whose ' +
        'Euclidean distance in the shared galactocentric-kpc frame is within 5.0 pc. ' +
        'refDistPc = that distance in pc, rounded to 3 decimals. Sorted by ascending raw distance.',
      toleranceRationale:
        'The ±2% live-assertion tolerance is against THESE shipped-catalog distances, not ' +
        'external astronomy: some K/M-dwarf Hipparcos (HYG) distances differ from modern Gaia ' +
        'by >2%, so an externally-sourced value can fail ±2% with no pipeline bug. Names and ' +
        'presence carry the astronomy truth; distances pin the pipeline (design fact 5).',
    },
    origins,
    absentFamous: {
      note:
        'Famous nearby stars in neither shipped catalog (below the HYG mag<7.0 cut and not ' +
        'among the 14 supplement hosts). Documented gap — never asserted by AC1 (design fact 6).',
      names: ABSENT_FAMOUS,
    },
  };
}

/** Serialize to the exact committed byte form (2-space indent, trailing newline). */
export function serialize(ref) {
  return JSON.stringify(ref, null, 2) + '\n';
}

function main() {
  const outPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT;
  const hyg = JSON.parse(readFileSync(HYG_URL, 'utf-8'));
  const supplement = JSON.parse(readFileSync(SUPP_URL, 'utf-8'));
  const ref = buildReference(hyg, supplement);
  const text = serialize(ref);
  writeFileSync(outPath, text);
  const sol = ref.origins.Sol.length, sir = ref.origins.Sirius.length;
  console.log(`neighborhood-reference.json → ${outPath}`);
  console.log(`  Sol: ${sol} named neighbors within ${RADIUS_PC} pc`);
  console.log(`  Sirius: ${sir} named neighbors within ${RADIUS_PC} pc`);
  console.log(`  absentFamous: ${ref.absentFamous.names.length}`);
}

// Only run when invoked directly (not when imported by tests).
if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  main();
}
