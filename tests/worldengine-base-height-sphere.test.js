// tests/worldengine-base-height-sphere.test.js
// AC1 gate for the sphere-native E6 height writer (writeHeightSphere).
// Proves: byte-identical determinism, finite, bounded, grain precondition, seed-sensitivity,
// and a no-RNG static source guard. Modeled on worldengine-base-sphere.test.js (small carrier)
// + worldengine-base-verify.test.js (finite / two-run determinism patterns).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
// Neutral drivers, matching sphereOutput() in worldengine-base-verify.test.js.
const drivers = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0, surfaceGravity: 1, rockyCrust: 1 };
const SEED = 'e6';
const EPOCH = { name: 'tectonic-build' };

// The DOCUMENTED bound band (AC1). Per Map 02 §A8 the per-epoch E6 contribution is ≈ [-0.75,+1.5]
// normalized relief units and Jacobi (a convex combination) cannot expand it. Generous guard band.
const BOUND = 4;

function build(seed = SEED) {
  const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  writeGrainSphere(c, drivers);
  writeHeightSphere(c, {}, drivers, EPOCH, seed);
  return c;
}

describe('worldengine base — sphere-native E6 height writer (writeHeightSphere) — AC1', () => {
  it('byte-identical determinism: two runs with identical inputs produce the same height field', () => {
    const a = build();
    const b = build();
    // exact, no tolerance — the headline AC1 gate (mirrors worldengine-base-verify two-run determinism).
    expect(Array.from(a.height)).toEqual(Array.from(b.height));
  });

  it('all heights are finite (no NaN / Inf)', () => {
    const c = build();
    let allFinite = true;
    for (let i = 0; i < c.N; i++) if (!Number.isFinite(c.height[i])) { allFinite = false; break; }
    expect(allFinite).toBe(true);
  });

  it('all heights are bounded within the documented relief band (|h| < 4)', () => {
    const c = build();
    let maxAbs = 0;
    for (let i = 0; i < c.N; i++) maxAbs = Math.max(maxAbs, Math.abs(c.height[i]));
    expect(maxAbs).toBeLessThan(BOUND);
    // sanity: the field is non-trivial (the writer actually produced relief, not all-zero).
    expect(maxAbs).toBeGreaterThan(0);
  });

  it('grain precondition: writeHeightSphere throws if writeGrainSphere was not run first', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    // grainMag is zero-init; writeGrainSphere NOT called -> must throw.
    expect(() => writeHeightSphere(c, {}, drivers, EPOCH, SEED)).toThrow(/grainMag is all-zero/);
  });

  it('seed-sensitivity: a different seed produces a different field (seed actually drives output)', () => {
    const a = build('e6');
    const b = build('different-seed');
    expect(Array.from(a.height)).not.toEqual(Array.from(b.height));
  });

  it('no-RNG static source guard: the tectonic module contains no Math.random / Date.now', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/worldengine/base/tectonic.js', import.meta.url)), 'utf8');
    // Match the CALL form (followed by '(') so a prose mention in a comment doesn't false-fail;
    // an actual invocation Math.random() / Date.now() would.
    expect(src).not.toMatch(/Math\.random\s*\(/);
    expect(src).not.toMatch(/Date\.now\s*\(/);
  });
});
