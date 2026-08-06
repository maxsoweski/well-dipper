import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';

// AC8 guardrail (real-universe-overlay-2026-07-12): purely procedural systems
// — those touched by no real data — must generate IDENTICAL contents before vs
// after this workstream (content-RNG seed-stream isolation). The baseline was
// captured pre-Increment-1 by scripts/capture-procgen-snapshot.mjs through the
// real nav-warp arrival pipeline (deriveGalaxyContext + starTypeOverride +
// String(seed), src/main.js ~3540-3550).
//
// RE-FILTER RULE (contract AC8): a sample whose star now sits within
// exclusionRadiusKpc of an INGESTED real position (AC7 dim-host supplement or
// exoplanet-host position) is legitimately real-covered — it is EXCLUDED from
// the deep-equal, not reported as a regression. Before Increment 1 lands the
// ingested files don't exist and the filter is a no-op.

const SNAPSHOT_PATH = fileURLToPath(new URL(
  '../../../docs/WORKSTREAMS/real-universe-overlay-2026-07-12/procgen-baseline-snapshot.json',
  import.meta.url,
));

// Canonical AC7 output paths (Increment 1 must ship to these):
//   real-star-supplement.json  — dim famous hosts as real catalog star entries
//   real-system-contents.json  — exoplanet-archive ingest (hosts + planets)
const INGESTED_PATHS = [
  '../../../public/assets/data/real-star-supplement.json',
  '../../../public/assets/data/real-system-contents.json',
].map(p => fileURLToPath(new URL(p, import.meta.url)));

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));

// Collect every ingested real position from whichever AC7 outputs exist.
// Both files carry entries/hosts with galactocentric {x,y,z} in kpc.
function loadIngestedPositions() {
  const positions = [];
  for (const path of INGESTED_PATHS) {
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const entries = Array.isArray(data) ? data : (data.hosts ?? data.stars ?? []);
    for (const e of entries) {
      if (typeof e.x === 'number' && typeof e.y === 'number' && typeof e.z === 'number') {
        positions.push(e);
      }
    }
  }
  return positions;
}

function isRealCovered(star, ingested, radiusKpc) {
  for (const p of ingested) {
    const dx = star.worldX - p.x, dy = star.worldY - p.y, dz = star.worldZ - p.z;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) < radiusKpc) return true;
  }
  return false;
}

describe('AC8 — procgen-only snapshot (seed-stream isolation)', () => {
  const map = new GalacticMap(snapshot.masterSeed);
  const ingested = loadIngestedPositions();
  const active = snapshot.samples.filter(
    s => !isRealCovered(s.star, ingested, snapshot.exclusionRadiusKpc),
  );

  it('keeps a meaningful sample after the real-coverage re-filter', () => {
    // If ingestion ever covered most of the baseline, the guardrail would be
    // watching nothing — recapture with more remote sample positions instead.
    expect(active.length).toBeGreaterThanOrEqual(Math.ceil(snapshot.samples.length / 2));
  });

  it.each(active.map(s => [`${s.region} seed=${s.star.seed}`, s]))(
    'regenerates identical contents: %s',
    (_label, sample) => {
      const { star } = sample;
      const ctx = map.deriveGalaxyContext({ x: star.worldX, y: star.worldY, z: star.worldZ });
      if (star.type) ctx.starTypeOverride = star.type;
      const regenerated = StarSystemGenerator.generate(String(star.seed), ctx);
      // Same JSON round-trip normalization the capture used.
      expect(JSON.parse(JSON.stringify(regenerated))).toEqual(sample.systemData);
    },
  );
});
