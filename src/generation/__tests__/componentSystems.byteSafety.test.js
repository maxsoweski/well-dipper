/**
 * componentSystems byte-safety guards — S3 of multistar-components-2026-07-19
 * (AC3). Guard slice: test file only, no production edits.
 *
 * Proves zero perturbation from the S2 emission: the componentSystems key is
 * ABSENT (never null) from purely-procgen output; the emission machinery is
 * structurally NEVER invoked on the procgen path (a real probe — output
 * identity alone is necessary but not sufficient, build-plan fable M1); the
 * authored far-bearing parent is unchanged except for the added key
 * (additivity vs the S1 pre-increment fixture); and a non-far authored row
 * (Sirius) is byte-unchanged. Fixtures and tests share ONE construction: the
 * builders are imported from _captureAuthoredParent.mjs (recipe identity).
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { componentSeed, buildComponentContext } from '../componentSystems.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import { GalacticMap } from '../GalacticMap.js';
import {
  buildAlphaCenBaseline, buildSiriusBaseline,
} from './_captureAuthoredParent.mjs';

// Wrap the emission-machinery exports in pass-through spies so the poison
// probe can assert INVOCATION COUNTS, not just output identity. Behavior is
// unchanged (vi.fn wraps the real implementations); StarSystemGenerator's
// static import resolves to this mocked namespace within this test file's
// module graph.
vi.mock('../componentSystems.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    componentSeed: vi.fn(actual.componentSeed),
    buildComponentContext: vi.fn(actual.buildComponentContext),
  };
});

const HERE = dirname(fileURLToPath(import.meta.url));
const WS_DIR = join(HERE, '../../../docs/WORKSTREAMS/multistar-components-2026-07-19');
const FIXTURE = (name) => JSON.parse(readFileSync(join(WS_DIR, name), 'utf8'));

const rt = (o) => JSON.parse(JSON.stringify(o));
const MASTER_SEED = 'well-dipper-galaxy-1';

// Procgen battery: null-ctx seeds plus plain deriveGalaxyContext ctxs at
// spread positions (disk edge, bulge-ward, off-plane) — no overlay fields,
// no companionSpec, no farCompanions, exactly the procgen path.
const NULL_CTX_SEEDS = ['pg-1', 'pg-2', 'b-5', 'kp-1', 'sys-42', '1816942132'];
const CTX_POSITIONS = [
  { x: 8.0, y: 0.025, z: -0.001 },
  { x: 2.1, y: -0.4, z: 0.9 },
  { x: 12.5, y: 1.75, z: -9.9 },
];

function* procgenBattery() {
  for (const seed of NULL_CTX_SEEDS) {
    yield StarSystemGenerator.generate(seed, null);
  }
  const gm = new GalacticMap(MASTER_SEED);
  for (const [i, pos] of CTX_POSITIONS.entries()) {
    yield StarSystemGenerator.generate(`pg-ctx-${i}`, gm.deriveGalaxyContext(pos));
  }
}

describe('AC3 — procgen byte-safety', () => {
  it('componentSystems key is ABSENT (not null) from a battery of purely-procgen systems', () => {
    let count = 0;
    for (const sys of procgenBattery()) {
      expect('componentSystems' in sys).toBe(false);
      // The guard's sibling emission stays procgen-absent too (the proven recipe).
      expect('farCompanions' in sys).toBe(false);
      count++;
    }
    expect(count).toBe(NULL_CTX_SEEDS.length + CTX_POSITIONS.length);
  });

  it('poison probe: the emission machinery is NEVER invoked on the procgen path (and IS on the authored path)', () => {
    vi.clearAllMocks();
    for (const sys of procgenBattery()) void sys;
    expect(componentSeed).not.toHaveBeenCalled();
    expect(buildComponentContext).not.toHaveBeenCalled();
    // Liveness: the same spies DO fire on a far-bearing generation — proves
    // the probe counts real invocations rather than a mis-wired mock passing
    // vacuously.
    const authored = buildAlphaCenBaseline();
    expect(componentSeed).toHaveBeenCalledWith('alpha-centauri', 0);
    expect(buildComponentContext).toHaveBeenCalledTimes(1);
    expect(authored.componentSystems).toHaveLength(1);
  });

  it('additivity: authored Alpha Cen minus componentSystems is deep-equal to the pre-increment baseline', () => {
    // Same recipe as the fixture (imported builder) — at THIS tree it carries
    // the componentSystems key; the fixture was captured pre-S2 without it.
    const { componentSystems, ...rest } = buildAlphaCenBaseline();
    expect(componentSystems).toHaveLength(1); // the key exists post-S2 …
    expect(rt(rest)).toEqual(FIXTURE('authored-parent-baseline.json')); // … and is the ONLY delta
  });

  it('non-far authored row byte-unchanged: Sirius deep-equals its pre-increment baseline', () => {
    const sirius = buildSiriusBaseline(); // shared recipe — already JSON-round-tripped
    expect('componentSystems' in sirius).toBe(false); // no key to omit — byte-unchanged
    expect(sirius).toEqual(FIXTURE('sirius-baseline.json'));
  });
});
