// Smoke test: well-dipper's vitest can import the motion-test-kit
// submodule via the Vite alias, predicates run end-to-end on synthetic
// data. AC #21 of motion-test-kit-2026-05-02 workstream.

import { describe, test, expect } from 'vitest';
import {
  deltaMagnitudeBound,
  monotonicityScore,
  approachPhaseInvariant,
  signStability,
  velocityBound,
  zeroInputNullAction,
  stateTransitionWellFormed,
  transformHashEquivalence,
  frameTimeVariance,
  runAll,
} from 'motion-test-kit/core/predicates';
import { createAccumulator } from 'motion-test-kit/core/loop/accumulator';
import { createRNG } from 'motion-test-kit/core/rng/mulberry32';
import { hashTrajectory } from 'motion-test-kit/core/hash/transform-hash';
import { createRingBuffer } from 'motion-test-kit/core/recorder/ring-buffer';
import { captureFrame } from 'motion-test-kit/adapters/three/sample-capture';

function mkSamples(positions) {
  return positions.map((pos, frame) => ({
    frame,
    t: frame * 16.667,
    dt: 16.667,
    anchor: { pos, quat: [0, 0, 0, 1] },
    target: null,
    input: {},
    state: {},
  }));
}

describe('motion-test-kit smoke (Vite alias resolution)', () => {
  test('all 9 predicates import + are callable', () => {
    const samples = mkSamples([[0,0,0],[1,0,0],[2,0,0]]);
    expect(deltaMagnitudeBound(samples, { axis: 'x', bound: 5 }).passed).toBe(true);
    expect(typeof monotonicityScore).toBe('function');
    expect(typeof approachPhaseInvariant).toBe('function');
    expect(typeof signStability).toBe('function');
    expect(typeof velocityBound).toBe('function');
    expect(typeof zeroInputNullAction).toBe('function');
    expect(typeof stateTransitionWellFormed).toBe('function');
    expect(typeof transformHashEquivalence).toBe('function');
    expect(typeof frameTimeVariance).toBe('function');
    expect(typeof runAll).toBe('function');
  });

  test('accumulator instantiates + ticks', () => {
    const acc = createAccumulator({ stepMs: 16.667 });
    let calls = 0;
    acc.tick(50, () => calls++);
    expect(calls).toBe(2);  // 50 / 16.667 = 2.999 → 2 steps
  });

  test('seeded RNG is deterministic', () => {
    const a = createRNG(12345);
    const b = createRNG(12345);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });

  test('transform-hash is stable + tolerance-bandable', () => {
    const a = mkSamples([[0,0,0],[1,0,0],[2,0,0]]);
    const b = mkSamples([[0,0,0],[1,0,0],[2,0,0]]);
    const ha = hashTrajectory(a);
    const hb = hashTrajectory(b);
    expect(ha.hash).toBe(hb.hash);
  });

  test('ring buffer FIFO under capacity', () => {
    const rb = createRingBuffer({ capacity: 3 });
    rb.push('a'); rb.push('b'); rb.push('c'); rb.push('d');
    expect(rb.snapshot()).toEqual(['b', 'c', 'd']);
  });

  test('captureFrame produces pure-data SampleRecord from duck-typed Object3D', () => {
    const anchor = {
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    };
    const sample = captureFrame({ frame: 0, t: 0, dt: 0, anchor });
    expect(sample.anchor.pos).toEqual([1, 2, 3]);
    // Round-trip through JSON to verify pure-data invariant
    const round = JSON.parse(JSON.stringify(sample));
    expect(round).toEqual(sample);
  });
});
