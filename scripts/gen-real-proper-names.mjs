#!/usr/bin/env node
// scripts/gen-real-proper-names.mjs
//
// RUN:  node scripts/gen-real-proper-names.mjs
// Writes src/generation/data/realProperNames.js
//
// Extracts every single-token alphabetic proper star name from ALL shipped
// real-star sources and bakes them into a JS module used as a STRUCTURAL
// BLOCKLIST by NameGenerator's bare-fantasy-word class (and, at build time, by
// scripts/gen-named-systems.mjs's word generator). This guarantees the
// procedural generator / named-systems catalog never emit a real star's proper
// name (design req (d) of the naming-census-uniqueness workstream,
// ac5-decision.md rule 2/§(d); enlarged in increment 1 / AC7 of
// real-universe-overlay-2026-07-12, design doc §4).
//
// SOURCES (union, increment 1 / AC7):
//   1. public/assets/data/hyg-stars.json            — `name` field (original set)
//   2. public/assets/data/real-star-supplement.json — `name` field (dim famous
//      hosts below the HYG naked-eye cut, e.g. "Barnard's Star" is filtered out
//      by the single-token-alphabetic shape test below, same as multi-word HYG
//      names always were)
//   3. public/assets/data/real-system-contents.json — `hosts[].name` (archive
//      hostnames, e.g. "Sirius" duplicates the HYG entry; harmless — it's a Set)
//   4. src/generation/data/stellarCompanions.js     — every `name` appearing as
//      an entry's top-level name, a `components[].name`, or a
//      `farCompanions[].name` (e.g. "Sirius", "Procyon", "Toliman", "Vega",
//      "Altair" are single-token; "Sirius B", "Rigil Kentaurus", "Alpha
//      Centauri", "Proxima Centauri" are multi-token and excluded by shape,
//      exactly like any other multi-word real name)
//
// Why single-token only: the bare-fantasy class emits single capitalized words
// (e.g. "Lyreon"); the only real names it could ever collide with are single
// alphabetic tokens ("Sirius", "Vega", "Rigel"). Multi-token names ("Rigil
// Kentaurus", "Alp Cen") and designations ("HD 1234") have a different shape
// and can never be produced by the bare class, so they don't need blocklisting
// here. (The census tool cross-checks ALL procgen output against the full
// meaningful-name set separately.)
//
// Deterministic: pure function of the input files; no time/randomness. The
// enlarged set is programmatically verified to be a SUPERSET of the
// hyg-stars.json-only set before writing (a regression here would silently
// shrink the blocklist and let the bare-fantasy class emit a name it used to
// avoid).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HYG_PATH = fileURLToPath(new URL('../public/assets/data/hyg-stars.json', import.meta.url));
const SUPPLEMENT_PATH = fileURLToPath(new URL('../public/assets/data/real-star-supplement.json', import.meta.url));
const CONTENTS_PATH = fileURLToPath(new URL('../public/assets/data/real-system-contents.json', import.meta.url));
const COMPANIONS_PATH = fileURLToPath(new URL('../src/generation/data/stellarCompanions.js', import.meta.url));
const OUT_PATH = fileURLToPath(new URL('../src/generation/data/realProperNames.js', import.meta.url));

// Single-token alphabetic shape test (structural collision class unchanged).
const SINGLE_TOKEN_RE = /^[A-Za-z]+$/;
function addIfSingleToken(set, n) {
  if (!n || n === '"') return;
  if (SINGLE_TOKEN_RE.test(n)) set.add(n);
}

// --- 1. hyg-stars.json ------------------------------------------------------
const hyg = JSON.parse(readFileSync(HYG_PATH, 'utf-8'));
const hygOnly = new Set();
for (const s of hyg) addIfSingleToken(hygOnly, s.name);

// --- 2. real-star-supplement.json (dim famous hosts, display names) --------
const supplement = JSON.parse(readFileSync(SUPPLEMENT_PATH, 'utf-8'));
const supplementNames = new Set();
for (const s of supplement.stars ?? []) addIfSingleToken(supplementNames, s.name);

// --- 3. real-system-contents.json (archive hostnames) -----------------------
const contents = JSON.parse(readFileSync(CONTENTS_PATH, 'utf-8'));
const hostNames = new Set();
for (const h of contents.hosts ?? []) addIfSingleToken(hostNames, h.name);

// --- 4. stellarCompanions.js (component / farCompanion / single names) -----
const { STELLAR_COMPANIONS } = await import(COMPANIONS_PATH);
const companionNames = new Set();
for (const entry of STELLAR_COMPANIONS) {
  addIfSingleToken(companionNames, entry.name);
  for (const c of entry.components ?? []) addIfSingleToken(companionNames, c.name);
  for (const f of entry.farCompanions ?? []) addIfSingleToken(companionNames, f.name);
}

// --- union -------------------------------------------------------------------
const union = new Set([...hygOnly, ...supplementNames, ...hostNames, ...companionNames]);

// Programmatic superset verification (report, don't just assume).
const missingFromUnion = [...hygOnly].filter((n) => !union.has(n));
if (missingFromUnion.length) {
  console.error(`[gen-real-proper-names] BLOCKED: enlarged set is NOT a superset of the hyg-only set. ` +
    `Missing: ${missingFromUnion.join(', ')}`);
  process.exit(1);
}

// Code-point sort — deterministic across environments (localeCompare is NOT
// guaranteed byte-stable across ICU builds; same rationale as the ingest script).
const arr = [...union].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const header =
`/**
 * Real single-token proper star names, extracted from the union of:
 *   - public/assets/data/hyg-stars.json (HYG v4.0, regenerated in increment 3a / AC9)
 *   - public/assets/data/real-star-supplement.json (dim famous hosts, increment 1 / AC7)
 *   - public/assets/data/real-system-contents.json hostnames (increment 1 / AC7)
 *   - src/generation/data/stellarCompanions.js component/farCompanion/single names (increment 1 / AC7)
 * Used as a structural blocklist so the procedural bare-fantasy-word class (and
 * the named-systems catalog's word generator) never emit a real star's proper
 * name (design req (d)).
 *
 * Generated by scripts/gen-real-proper-names.mjs — DO NOT hand-edit; re-run that
 * script if any of the source files above are regenerated. Count: ${arr.length} single-token names.
 */
`;
const body =
`export const REAL_PROPER_NAMES = [
${arr.map(n => `  ${JSON.stringify(n)},`).join('\n')}
];

// Lowercased set for O(1) case-insensitive membership checks.
export const REAL_PROPER_NAME_SET = new Set(REAL_PROPER_NAMES.map(n => n.toLowerCase()));
`;

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, header + body);

console.log('[gen-real-proper-names] per-source single-token counts:');
console.log(`  hyg-stars.json:               ${hygOnly.size}`);
console.log(`  real-star-supplement.json:    ${supplementNames.size}`);
console.log(`  real-system-contents.json:    ${hostNames.size}`);
console.log(`  stellarCompanions.js:         ${companionNames.size}`);
console.log(`  BEFORE (hyg-only, prior behavior): ${hygOnly.size}`);
console.log(`  AFTER  (union, this run):          ${union.size}`);
console.log(`  superset check: PASS (all ${hygOnly.size} hyg-only names present in the union)`);
console.log(`gen-real-proper-names: wrote ${OUT_PATH} with ${arr.length} single-token names`);
