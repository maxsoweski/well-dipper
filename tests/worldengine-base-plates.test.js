// tests/worldengine-base-plates.test.js
// AC1 gate for the one-pass plate / uplift-field generator (writePlateUpliftSphere, plates.js).
// Proves: byte-identical determinism, finite, bounded, non-trivial, seed-sensitivity, a no-RNG
// static source guard, and RENDER-ONCE (the only iteration is a FIXED bounded relaxation — no
// convergence-threshold while-loop, no per-Myr time loop). Modeled on the sibling AC1 gate
// tests/worldengine-base-height-sphere.test.js (same small carrier + two-run determinism pattern).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writePlateUpliftSphere, RELAX_PASSES, U_BOUND } from '../src/worldengine/base/plates.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
// Neutral Earth-like drivers (matches the sibling AC1 height test). Placement is seed-only this
// increment, so `drivers` is inert — macroSeed is the entropy.
const drivers = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0, surfaceGravity: 1, rockyCrust: 1 };
const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/plates.js', import.meta.url)), 'utf8');

function build(macroSeed = 1) {
  const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  const diag = writePlateUpliftSphere(c, drivers, { macroSeed });
  return { c, diag };
}

describe('worldengine base — one-pass plate/uplift generator (writePlateUpliftSphere) — AC1', () => {
  it('byte-identical determinism: two runs with identical drivers+macroSeed produce the same U field', () => {
    const a = build(1), b = build(1);
    // exact, no tolerance — the headline AC1 gate. Both the written carrier.height AND the returned U.
    expect(Array.from(a.c.height)).toEqual(Array.from(b.c.height));
    expect(Array.from(a.diag.U)).toEqual(Array.from(b.diag.U));
    // the partition labels are deterministic too (consumed by AC2/AC6/the live probe)
    expect(Array.from(a.diag.plateId)).toEqual(Array.from(b.diag.plateId));
    expect(Array.from(a.diag.boundaryClass)).toEqual(Array.from(b.diag.boundaryClass));
  });

  it('writes carrier.height as the SOLE source (REPLACE): carrier.height === returned U', () => {
    const { c, diag } = build(1);
    expect(Array.from(c.height)).toEqual(Array.from(diag.U));
  });

  it('all U values are finite (no NaN / Inf)', () => {
    const { diag } = build(1);
    let allFinite = true;
    for (let i = 0; i < diag.U.length; i++) if (!Number.isFinite(diag.U[i])) { allFinite = false; break; }
    expect(allFinite).toBe(true);
  });

  it('all U values are bounded within the documented relief band (|U| < U_BOUND) and non-trivial', () => {
    const { diag } = build(1);
    let maxAbs = 0;
    for (let i = 0; i < diag.U.length; i++) maxAbs = Math.max(maxAbs, Math.abs(diag.U[i]));
    expect(maxAbs).toBeLessThan(U_BOUND);
    expect(maxAbs).toBeGreaterThan(0); // the writer actually produced relief, not all-zero
  });

  it('seed-sensitivity: a different macroSeed produces a measurably different field', () => {
    const a = build(1), b = build(2);
    expect(Array.from(a.diag.U)).not.toEqual(Array.from(b.diag.U));
    // plate partition differs too (the seed genuinely drives placement, not just a phase shift)
    expect(Array.from(a.diag.plateId)).not.toEqual(Array.from(b.diag.plateId));
  });

  it('no-RNG static source guard: plates.js contains no Math.random / Date.now call', () => {
    // Match the CALL form (followed by '(') so a prose mention in a comment doesn't false-fail.
    expect(SRC).not.toMatch(/Math\.random\s*\(/);
    expect(SRC).not.toMatch(/Date\.now\s*\(/);
  });

  it('render-once: the relaxation is a FIXED small bound (no convergence-threshold / per-Myr loop)', () => {
    const { diag } = build(1);
    // the generator reports the exact relaxation pass count, and it equals the exported fixed bound
    expect(diag.relaxPasses).toBe(RELAX_PASSES);
    expect(Number.isInteger(RELAX_PASSES)).toBe(true);
    expect(RELAX_PASSES).toBeGreaterThan(0);
    expect(RELAX_PASSES).toBeLessThanOrEqual(12); // a small fixed bound, NOT a billion-year sim
    // the relaxation loop is a fixed-bound for-loop, not a while-on-a-threshold
    expect(SRC).toMatch(/for\s*\(let pass = 0; pass < PASSES;/);
    // the ONLY while-loop in the module is the O(N) BFS queue drain (a graph distance transform);
    // there is no convergence-threshold loop and no time-stepping loop.
    const whileCount = (SRC.match(/while\s*\(/g) || []).length;
    expect(whileCount).toBe(1);
    expect(SRC).toMatch(/while\s*\(qh < qt\)/);          // the BFS drain
    expect(SRC).not.toMatch(/while\s*\([^)]*(tol|eps|converg|residual|delta)/i);
  });
});
