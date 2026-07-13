#!/usr/bin/env node
// scripts/gen-known-system-contents.mjs
//
// RUN:  node scripts/gen-known-system-contents.mjs
// Writes src/generation/data/knownSystemContents.generated.js
//
// Bakes the KNOWN, real planet lists that data-driven KnownSystems authoring
// (AC5 of real-universe-overlay-2026-07-12, design D5) needs at generation time
// for its FAR COMPANIONS — as a tiny, pre-resolved JS module instead of a
// runtime fetch or a hand-typed table. Today the only consumer is Alpha
// Centauri's registry entry, whose far companion "Proxima Centauri" carries the
// two archive planets b + d.
//
// WHY A GENERATED MODULE (design D5): keeps KnownSystemAuthoring.generate() sync
// and the bundle tiny (only the hosts authored entries actually reference),
// while the planet numbers stay DERIVED from the shipped archive JSONs rather
// than duplicated by hand — so they self-heal when Increment 1's ingest is
// re-run. A vitest drift guard (KnownSystemAuthoring.test.js) re-derives this
// extraction from the same JSONs and deep-equals the module.
//
// SOURCES (all committed, no network):
//   1. public/assets/data/real-system-contents.json — exoplanet-archive hosts +
//      planets (keyed by archive `hostname`, e.g. "Proxima Cen").
//   2. public/assets/data/real-star-supplement.json — dim-host catalog entries;
//      each carries the DISPLAY name ("Proxima Centauri") + its archive
//      `hostname` ("Proxima Cen"). This is the display→hostname bridge.
//   3. src/generation/data/stellarCompanions.js — the curated multiplicity
//      table. Its entries' `farCompanions[].name` values ARE the display names
//      that authored KnownSystems entries reference; that set is what we resolve
//      and emit (a clean superset of "hosts referenced by authored entries" —
//      only far companions carry archive planets in this scheme, and only Alpha
//      Centauri has a far companion today, so it resolves to exactly Proxima).
//
// DETERMINISM: pure function of the three input files — no time, no randomness,
// stable key/field ordering, 2-space JSON. Re-runs are byte-identical (run it
// twice and diff). Self-checks below exit NONZERO on any resolution failure.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const CONTENTS_PATH = fileURLToPath(new URL('../public/assets/data/real-system-contents.json', import.meta.url));
const SUPPLEMENT_PATH = fileURLToPath(new URL('../public/assets/data/real-star-supplement.json', import.meta.url));
const COMPANIONS_PATH = fileURLToPath(new URL('../src/generation/data/stellarCompanions.js', import.meta.url));
const OUT_PATH = fileURLToPath(new URL('../src/generation/data/knownSystemContents.generated.js', import.meta.url));

// The fixed planet-field projection. Only these fields (in this order) are
// carried into the module — they are exactly what StarSystemGenerator's
// far-companion / known-planet paths read (letter/name/period/sma/mass/radius/
// eccen). Keeping the projection explicit makes the drift guard reproducible.
const PLANET_FIELDS = ['letter', 'name', 'periodDays', 'smaAU', 'massEarth', 'radiusEarth', 'eccen'];

function fail(msg) {
  console.error(`[gen-known-system-contents] FAILED: ${msg}`);
  process.exit(1);
}

// --- load inputs ------------------------------------------------------------
const contents = JSON.parse(readFileSync(CONTENTS_PATH, 'utf-8'));
const supplement = JSON.parse(readFileSync(SUPPLEMENT_PATH, 'utf-8'));
const { STELLAR_COMPANIONS } = await import(COMPANIONS_PATH);

// display name -> archive hostname (from the supplement's hostname bridge)
const displayToHost = new Map();
for (const s of supplement.stars ?? []) {
  if (s.name && s.hostname) displayToHost.set(s.name, s.hostname);
}

// archive hostname -> host record (with planets)
const hostByName = new Map();
for (const h of contents.hosts ?? []) hostByName.set(h.name, h);

// --- collect the requested far-companion display names ----------------------
// Every farCompanion across the curated table. A Set keeps this order-agnostic;
// we sort the final keys for stable output.
const requested = new Set();
for (const e of STELLAR_COMPANIONS) {
  for (const f of e.farCompanions ?? []) if (f.name) requested.add(f.name);
}
if (requested.size === 0) fail('no far-companion names found in stellarCompanions.js');

// --- resolve each request to its archive planets ----------------------------
const out = {};
for (const displayName of [...requested].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
  const hostname = displayToHost.get(displayName);
  if (!hostname) {
    // A far companion with no supplement bridge simply has no archive planets
    // to emit (it is a real catalog star without a hostname mapping). Skip it
    // rather than fail — the overlay renders it as a far companion sans planets.
    continue;
  }
  const host = hostByName.get(hostname);
  if (!host) continue; // hostname not in the archive contents → nothing to emit
  const planets = (host.planets ?? []).map((p) => {
    const proj = {};
    for (const f of PLANET_FIELDS) proj[f] = p[f] ?? null;
    return proj;
  });
  if (planets.length === 0) continue;
  out[displayName] = { hostname, planets };
}

// --- self-checks (exit nonzero on failure) ----------------------------------
if (Object.keys(out).length === 0) fail('resolved zero far-companion contents');
// Canonical: Proxima Centauri MUST resolve to its two archive planets b + d
// (the only authored consumer this increment). A regression here means the
// supplement bridge or the archive contents drifted.
const prox = out['Proxima Centauri'];
if (!prox) fail('Proxima Centauri did not resolve (supplement hostname bridge missing?)');
if (prox.hostname !== 'Proxima Cen') fail(`Proxima Centauri resolved to unexpected host "${prox.hostname}"`);
const proxLetters = prox.planets.map((p) => p.letter);
if (proxLetters.join(',') !== 'b,d') fail(`Proxima Centauri planets expected b,d got ${proxLetters.join(',')}`);
for (const [name, rec] of Object.entries(out)) {
  for (const p of rec.planets) {
    if (typeof p.letter !== 'string' || !p.letter) fail(`${name} planet missing letter`);
  }
}

// --- emit (stable JSON, byte-identical re-runs) -----------------------------
const header =
`/**
 * Known-system far-companion contents — GENERATED, do NOT hand-edit.
 *
 * Pre-resolved real planet lists for the far companions that data-driven
 * KnownSystems authoring references (AC5 / real-universe-overlay-2026-07-12,
 * design D5). Keyed by the far companion's DISPLAY name (as it appears in
 * src/generation/data/stellarCompanions.js farCompanions[].name); each value
 * carries the resolved archive \`hostname\` and that host's planets (archive
 * fields: ${PLANET_FIELDS.join(', ')}).
 *
 * Derived from public/assets/data/{real-system-contents,real-star-supplement}.json
 * via the supplement's display→hostname bridge. Re-generate with
 *   node scripts/gen-known-system-contents.mjs
 * whenever those JSONs are re-ingested. A vitest drift guard re-derives this
 * extraction and deep-equals the module (KnownSystemAuthoring.test.js).
 */
`;
const body = `export const KNOWN_SYSTEM_CONTENTS = ${JSON.stringify(out, null, 2)};\n`;

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, header + body);

console.log('[gen-known-system-contents] resolved far-companion contents:');
for (const [name, rec] of Object.entries(out)) {
  console.log(`  ${name} → ${rec.hostname}: ${rec.planets.map((p) => p.letter).join(', ')}`);
}
console.log(`gen-known-system-contents: wrote ${OUT_PATH} (${Object.keys(out).length} host(s))`);
