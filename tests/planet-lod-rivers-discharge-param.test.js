// tests/planet-lod-rivers-discharge-param.test.js
// AC4 — the erosion DISCHARGE input + the ocean BASE LEVEL are parameterized so the later
// precip/climate increment drops in with ZERO rework, and OMITTING them is byte-identical to today.
//   routeAndOrder(...).accum  : omitted precipWeight => uniform-1 (identity); supplied => linear in it.
//   computeOcean(...,baseLevel): omitted => scalar-seaLevel ocean set byte-identical; supplied => per-node.
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, routeAndOrder, computeOcean, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { solveSeaLevel } from '../planet-lod-sealevel.js';
// PRESET_ARCHETYPE-retirement (2026-07-13): M4 — the discharge suite tests routeAndOrder, not the relief writer;
// it needs any populated carrier.height. 'terrestrial' → Rocky condition (plate), the same self-referential body.
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';

const TARGET_N = 700, LLOYD = 2;

function buildBody(seed = 1) {
  const carrier = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  const fp = DRIVER_PRESETS['Rocky (Earthlike)'];
  const u = deriveUniforms(fp, 1.0);
  writeBodyRelief(carrier, {
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + seed,
  });
  const N = carrier.N;
  const seaLevel = solveSeaLevel(carrier.height, 0.35);
  const { isOcean } = computeOcean(carrier.height, seaLevel, N);
  return { mesh: carrier, height: carrier.height, isOcean, N, seaLevel };
}

describe('AC4 — discharge (precipWeight) parameterization of routeAndOrder.accum', () => {
  const { mesh, height, isOcean, N } = buildBody(1);
  const base = routeAndOrder({ mesh, height, grad: null, isOcean });
  const uniform1 = routeAndOrder({ mesh, height, grad: null, isOcean, precipWeight: new Float32Array(N).fill(1) });

  it('omitted precipWeight === explicit uniform-1 (identity; determinism baseline holds)', () => {
    expect(Array.from(base.accum)).toEqual(Array.from(uniform1.accum));
    expect(Array.from(base.strahler)).toEqual(Array.from(uniform1.strahler));
    expect(Array.from(base.order)).toEqual(Array.from(uniform1.order));
  });

  it('accum is genuinely LINEAR in precipWeight (input-driven, not hardcoded): a+b superposition', () => {
    // build a deterministic non-uniform weight, then prove accum(1) + accum(w) == accum(1+w) per node.
    const w = new Float32Array(N), onePlusW = new Float32Array(N);
    for (let i = 0; i < N; i++) { w[i] = 0.25 + ((i * 2654435761) % 1000) / 500; onePlusW[i] = 1 + w[i]; }
    const aW = routeAndOrder({ mesh, height, grad: null, isOcean, precipWeight: w });
    const aSum = routeAndOrder({ mesh, height, grad: null, isOcean, precipWeight: onePlusW });
    let maxErr = 0;
    for (let i = 0; i < N; i++) maxErr = Math.max(maxErr, Math.abs((uniform1.accum[i] + aW.accum[i]) - aSum.accum[i]));
    expect(maxErr).toBeLessThan(1e-2);                 // superposition holds => accum tracks the supplied array
    // and a non-uniform weight genuinely changes the field (not ignored)
    expect(Array.from(aW.accum)).not.toEqual(Array.from(uniform1.accum));
  });
});

describe('AC4 — per-node base-level parameterization of computeOcean', () => {
  const { height, N, seaLevel } = buildBody(2);

  it('omitted baseLevel === scalar-seaLevel ocean set (byte-identical identity-safe default)', () => {
    const a = computeOcean(height, seaLevel, N);
    const b = computeOcean(height, seaLevel, N, null);
    expect(Array.from(a.isOcean)).toEqual(Array.from(b.isOcean));
    expect(a.oceanCount).toBe(b.oceanCount);
  });

  it('supplied spatially-varying base-level flips the predicted nodes ocean (input-driven)', () => {
    const scalar = computeOcean(height, seaLevel, N);
    // raise the local base level well above seaLevel for HALF the nodes -> every land node there drops below
    // its local base level and must flip to ocean; the other half keep the scalar threshold (unchanged).
    const baseLevel = new Float32Array(N);
    const RAISE = seaLevel + 1000;   // far above any height -> those nodes are unconditionally ocean
    for (let i = 0; i < N; i++) baseLevel[i] = (i % 2 === 0) ? RAISE : seaLevel;
    const perNode = computeOcean(height, seaLevel, N, baseLevel);
    expect(perNode.oceanCount).toBeGreaterThan(scalar.oceanCount);   // monotone increase in the predicted direction
    // every even node is now ocean; odd nodes match the scalar result exactly
    let evenAllOcean = true, oddMatchesScalar = true;
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) { if (!perNode.isOcean[i]) evenAllOcean = false; }
      else if (perNode.isOcean[i] !== scalar.isOcean[i]) oddMatchesScalar = false;
    }
    expect(evenAllOcean).toBe(true);
    expect(oddMatchesScalar).toBe(true);
  });
});
