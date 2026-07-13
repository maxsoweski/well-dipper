// tests/worldengine-lid-disruption-drawcount.test.js — World Engine V2-7d draw-order pins.
//
// Isolated in its own file so the main suite runs against the UNMOCKED alea package. A counting wrapper
// delegates to the real alea in order (outputs stay byte-identical — determinism is preserved), tallying
// draws per seedString. Pins the FROZEN draw orders (§1.5): any drop/add of a draw breaks these totals.
import { describe, it, expect, vi } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';

vi.mock('alea', async (importOriginal) => {
  const real = (await importOriginal()).default;
  const counts = (globalThis.__aleaDrawCounts = new Map());
  return {
    default: (seedStr) => {
      const rng = real(seedStr);
      counts.set(seedStr, counts.get(seedStr) ?? 0);
      return () => { counts.set(seedStr, counts.get(seedStr) + 1); return rng(); };
    },
  };
});

import { makeCellDisruption, makeFociDisruption, evalFociDeformation, FOCI_DEFAULTS } from '../src/worldengine/base/lidDisruption.js';

const COUNTS = () => globalThis.__aleaDrawCounts;
let _mesh = null;
const carrier = () => makeSphereField(_mesh || (_mesh = buildIrregularSphere(1500, 2)));

describe('lid-disruption — AC-DET draw-order pins (instrumented alea)', () => {
  it('cells stream total === 1 + 4·cellCount (pins the 2 reserved draws), seeds 1/7/42', () => {
    for (const s of [1, 7, 42]) {
      const c = carrier();
      COUNTS().clear();
      const out = makeCellDisruption(c, { macroSeed: s });
      const streamA = COUNTS().get('disrupt:cells:' + s);
      expect(streamA, `seed ${s}: Stream A = 1 + 4·cellCount(${out.cellCount})`).toBe(1 + 4 * out.cellCount);
      for (const key of COUNTS().keys()) expect(key.startsWith('disrupt:'), `key ${key} in disrupt namespace`).toBe(true);
    }
  });

  it('foci stream total === 3·pool + 2·count (conditional-draw pattern), seeds 1/7/42', () => {
    for (const s of [1, 7, 42]) {
      const c = carrier();
      const pool = Math.max(1, Math.round(FOCI_DEFAULTS.POOL * c.N / FOCI_DEFAULTS.POOL_REF_N));
      COUNTS().clear();
      const out = makeFociDisruption(c, { macroSeed: s, acceptWeightAt: null });
      const streamC = COUNTS().get('disrupt:foci:' + s);
      expect(streamC, `seed ${s}: Stream C = 3·pool(${pool}) + 2·count(${out.count})`).toBe(3 * pool + 2 * out.count);
      for (const key of COUNTS().keys()) expect(key.startsWith('disrupt:'), `key ${key} in disrupt namespace`).toBe(true);
    }
  });

  it("every alea key the module created starts with 'disrupt:' (dynamic namespace proof)", () => {
    const c = carrier();
    COUNTS().clear();
    makeCellDisruption(c, { macroSeed: 1 });
    makeFociDisruption(c, { macroSeed: 1, acceptWeightAt: null });
    const keys = [...COUNTS().keys()];
    expect(keys.length, 'module created alea streams').toBeGreaterThan(0);
    for (const key of keys) expect(key.startsWith('disrupt:'), `key ${key}`).toBe(true);
  });

  it('evalFociDeformation performs zero draws (placement/eval split)', () => {
    const c = carrier();
    const foci = makeFociDisruption(c, { macroSeed: 7, acceptWeightAt: null });
    COUNTS().clear();
    evalFociDeformation(c, foci);
    if (foci.count > 0) { foci.alive[0] = 0; foci.typeIds[0] = 1; }   // an editor mutation
    evalFociDeformation(c, foci);
    const total = [...COUNTS().values()].reduce((a, b) => a + b, 0);
    expect(total, 'zero draws during eval + re-eval').toBe(0);
  });
});
