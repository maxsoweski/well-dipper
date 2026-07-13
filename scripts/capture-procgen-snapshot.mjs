#!/usr/bin/env node
// scripts/capture-procgen-snapshot.mjs
//
// RUN:  node scripts/capture-procgen-snapshot.mjs
// Writes docs/WORKSTREAMS/real-universe-overlay-2026-07-12/procgen-baseline-snapshot.json
//
// AC8 guardrail (real-universe-overlay-2026-07-12): pins the generated contents
// of a sample of PROCGEN-ONLY systems — hash-grid stars touched by no real
// data — through the real warp-arrival pipeline (deriveGalaxyContext +
// starTypeOverride + String(seed), mirroring src/main.js nav-warp arrival).
// Captured BEFORE Increment 1 (AC7 ingestion) lands; the companion test
// (src/generation/__tests__/ProcgenSnapshot.test.js) regenerates each sample
// and deep-equals against this file for the rest of the workstream.
//
// RE-FILTER RULE (contract AC8): after Increment 1, samples whose star sits
// within EXCLUSION_RADIUS_KPC of any newly INGESTED real position (dim-host
// supplement or exoplanet-host position) are legitimately real-covered — the
// test EXCLUDES them rather than reporting false regressions. The test reads
// the ingested-position sets itself; this file just records each sample's
// position to make that filter possible.
//
// Deterministic: pure function of the shipped code + catalogs; no
// time/randomness. Re-running at the same commit is byte-identical.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { GalacticMap } from '../src/generation/GalacticMap.js';
import { HashGridStarfield } from '../src/generation/HashGridStarfield.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { KnownSystems } from '../src/generation/KnownSystems.js';

const HYG_PATH = fileURLToPath(new URL('../public/assets/data/hyg-stars.json', import.meta.url));
const OUT_PATH = fileURLToPath(new URL(
  '../docs/WORKSTREAMS/real-universe-overlay-2026-07-12/procgen-baseline-snapshot.json',
  import.meta.url,
));

// A sampled star is "procgen-only" when NO real catalog star and NO known
// system sits within this radius. 3 pc (0.003 kpc) = KnownSystems'
// NAME_JOIN_RADIUS, the loosest identity belt in the game — nothing outside
// it can be renamed/claimed by real data on any arrival path.
const EXCLUSION_RADIUS_KPC = 0.003;

// Stars sampled per position (after the procgen-only filter).
const STARS_PER_POSITION = 4;

// Deterministic spread across galactic regimes (kpc, galactocentric —
// same frame as GalacticMap): near-Sol disk, mid disk, outer disk, bulge,
// halo, far-side arm.
const SAMPLE_POSITIONS = [
  { label: 'near-sol-disk', x: 8.05, y: 0.025, z: 0.02 },
  { label: 'mid-disk',      x: 6.0,  y: 0.05,  z: 1.2 },
  { label: 'outer-disk',    x: 11.5, y: -0.1,  z: 3.0 },
  { label: 'bulge',         x: 1.2,  y: 0.15,  z: 0.6 },
  { label: 'halo',          x: 7.0,  y: 1.8,   z: 2.0 },
  { label: 'far-arm',       x: -5.0, y: 0.02,  z: 7.0 },
];

const hyg = JSON.parse(readFileSync(HYG_PATH, 'utf-8'));
const map = new GalacticMap('well-dipper-galaxy-1'); // main.js:235 master seed

function distKpc(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isProcgenOnly(pos) {
  if (KnownSystems.findAt(pos)) return false;
  for (const s of hyg) {
    if (distKpc(pos, s) < EXCLUSION_RADIUS_KPC) return false;
  }
  return true;
}

const samples = [];
for (const sp of SAMPLE_POSITIONS) {
  const playerPos = { x: sp.x, y: sp.y, z: sp.z };
  const grid = HashGridStarfield.generate(map, playerPos);

  // Deterministic pick: nearest procgen-only grid stars first, seed as
  // tiebreaker — robust to incidental emission-order changes in the grid.
  const candidates = grid.realStars
    .map(r => r.starData)
    .filter(s => isProcgenOnly({ x: s.worldX, y: s.worldY, z: s.worldZ }))
    .sort((a, b) => {
      const da = distKpc({ x: a.worldX, y: a.worldY, z: a.worldZ }, playerPos);
      const db = distKpc({ x: b.worldX, y: b.worldY, z: b.worldZ }, playerPos);
      return (da - db) || (a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0);
    })
    .slice(0, STARS_PER_POSITION);

  for (const star of candidates) {
    const starPos = { x: star.worldX, y: star.worldY, z: star.worldZ };
    // The real nav-warp arrival pipeline (src/main.js ~3540-3550):
    // context from the star's position, hash-grid type override, grid seed.
    const ctx = map.deriveGalaxyContext(starPos);
    if (star.type) ctx.starTypeOverride = star.type;
    const systemData = StarSystemGenerator.generate(String(star.seed), ctx);

    samples.push({
      region: sp.label,
      star: {
        worldX: star.worldX,
        worldY: star.worldY,
        worldZ: star.worldZ,
        seed: star.seed,
        type: star.type,
      },
      // JSON round-trip normalizes undefined/NaN exactly as the test's
      // regeneration path does, so deep-equal compares like with like.
      systemData: JSON.parse(JSON.stringify(systemData)),
    });
  }
}

const out = {
  _purpose: 'AC8 procgen-only baseline (real-universe-overlay-2026-07-12), captured pre-Increment-1',
  masterSeed: 'well-dipper-galaxy-1',
  exclusionRadiusKpc: EXCLUSION_RADIUS_KPC,
  sampleCount: samples.length,
  samples,
};

writeFileSync(OUT_PATH, JSON.stringify(out));
console.log(`capture-procgen-snapshot: ${samples.length} samples across ${SAMPLE_POSITIONS.length} regions`);
for (const sp of SAMPLE_POSITIONS) {
  const n = samples.filter(s => s.region === sp.label).length;
  console.log(`  ${sp.label}: ${n} systems`);
}
console.log(`Written: ${OUT_PATH} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);
