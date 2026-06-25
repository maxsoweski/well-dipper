// tests/ws4-tectonic-module.test.js
// WS4 T4 — scaffold planet-lod-tectonic.js orchestrator (empty contract + pure helpers).
//
// Why this exists (plan §D1, §T4): nothing in the codebase builds a grain carrier, calls
// writeGrainSphere, and hands the result to the renderer (only vitest does — dossier risk #1).
// planet-lod-tectonic.js is that net-new glue. T4 lands ONLY the scaffold: the
// buildIrregularSphere → makeSphereField → writeGrainSphere chain wired into bakeTectonicGrain,
// returning the documented per-node array shape, with the smooth-director (smoothStrikeAngle) and
// province composition STUBBED to identity (raw quantized angle). The real smooth director +
// world-strike conversion + macroSeed coherence is T6; the cube bake is T7/T8; consumption is
// T5/T13. So this file asserts CONTRACT SHAPE + purity only — NOT smooth-director continuity
// (that is a T6 RED that this stub deliberately does not yet satisfy).
//
// MAX DECISIONS (2026-06-25) honoured here:
//   #3 move-2/rotatePoleDeg is DROPPED — writeGrainSphere stays the EXISTING 2-arg
//      writeGrainSphere(carrier, drivers); bakeTectonicGrain accepts a rotatePoleDeg field in its
//      options bag for forward-compat but MUST NOT thread it into writeGrainSphere (no edit to
//      src/worldengine/base/tectonic.js). The default-0 case is therefore a no-op by construction.
//
// HARD RULE: no Date.now / Math.random in the derivation — asserted by a stubbed-global guard.
import { describe, it, expect, vi } from 'vitest';
import { bakeTectonicGrain, smoothStrikeAngle } from '../planet-lod-tectonic.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';

const neutralDrivers = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };

// A tiny mesh keeps the scaffold test fast; correctness of the regime bands lives in T1
// (ws4-grain-oracle), so here we only need a few nodes to exercise the array shape.
function tinyMesh() {
  return buildIrregularSphere(120, 1);
}

describe('WS4 T4 — planet-lod-tectonic.js scaffold: exports', () => {
  it('exports bakeTectonicGrain and smoothStrikeAngle as functions', () => {
    expect(typeof bakeTectonicGrain).toBe('function');
    expect(typeof smoothStrikeAngle).toBe('function');
  });
});

describe('WS4 T4 — bakeTectonicGrain returns the documented per-node array shape', () => {
  const mesh = tinyMesh();
  const N = mesh.verts.length;
  const out = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 12345 });

  it('returns Float32 grainAngleSmooth/grainMag and world-strike X/Y/Z + Uint8 regime, all length N', () => {
    for (const key of ['grainAngleSmooth', 'grainMag', 'strikeWorldX', 'strikeWorldY', 'strikeWorldZ']) {
      expect(out[key], key).toBeInstanceOf(Float32Array);
      expect(out[key].length, key + '.length').toBe(N);
    }
    expect(out.regime).toBeInstanceOf(Uint8Array);
    expect(out.regime.length).toBe(N);
  });

  it('grainMag stays bounded [0,1] and every output value is finite (no NaN from a null cube path)', () => {
    for (let i = 0; i < N; i++) {
      expect(out.grainMag[i]).toBeGreaterThanOrEqual(0);
      expect(out.grainMag[i]).toBeLessThanOrEqual(1);
      expect(Number.isFinite(out.grainAngleSmooth[i])).toBe(true);
      expect(Number.isFinite(out.strikeWorldX[i])).toBe(true);
      expect(Number.isFinite(out.strikeWorldY[i])).toBe(true);
      expect(Number.isFinite(out.strikeWorldZ[i])).toBe(true);
    }
  });

  it('the world-strike vector is unit-length per node (cos·east + sin·north of an orthonormal frame)', () => {
    for (let i = 0; i < N; i++) {
      const m = Math.hypot(out.strikeWorldX[i], out.strikeWorldY[i], out.strikeWorldZ[i]);
      expect(m).toBeGreaterThan(1 - 1e-3);
      expect(m).toBeLessThan(1 + 1e-3);
    }
  });
});

describe('WS4 T4 — determinism + purity (no rng in the derivation path)', () => {
  it('is deterministic: same (mesh, drivers, macroSeed) → byte-identical outputs', () => {
    const mesh = tinyMesh();
    const a = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 777 });
    const b = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 777 });
    expect(Array.from(a.grainAngleSmooth)).toEqual(Array.from(b.grainAngleSmooth));
    expect(Array.from(a.grainMag)).toEqual(Array.from(b.grainMag));
    expect(Array.from(a.regime)).toEqual(Array.from(b.regime));
    expect(Array.from(a.strikeWorldX)).toEqual(Array.from(b.strikeWorldX));
    expect(Array.from(a.strikeWorldY)).toEqual(Array.from(b.strikeWorldY));
    expect(Array.from(a.strikeWorldZ)).toEqual(Array.from(b.strikeWorldZ));
  });

  it('does NOT call Math.random or Date.now during the bake (pure derivation)', () => {
    const randSpy = vi.spyOn(Math, 'random');
    const nowSpy = vi.spyOn(Date, 'now');
    const mesh = tinyMesh();
    bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 42 });
    expect(randSpy).not.toHaveBeenCalled();
    expect(nowSpy).not.toHaveBeenCalled();
    randSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('default rotatePoleDeg is a no-op (Max #3 — move-2 dropped, 2-arg writeGrainSphere consumed)', () => {
    // bakeTectonicGrain accepts rotatePoleDeg for forward-compat but MUST NOT thread it into
    // writeGrainSphere (no edit to src/worldengine/base/tectonic.js). With the default and an
    // explicit 0 the latitude is untouched → identical regime/grain fields.
    const mesh = tinyMesh();
    const a = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 1 });
    const b = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 1, rotatePoleDeg: 0 });
    expect(Array.from(a.regime)).toEqual(Array.from(b.regime));
    expect(Array.from(a.grainMag)).toEqual(Array.from(b.grainMag));
  });
});

describe('WS4 T4 — smoothStrikeAngle stub returns the raw quantized director (T6 makes it smooth)', () => {
  it('returns a finite number in [0, π/2] (the {0, π/2} director range at this scaffold stage)', () => {
    // T4 stub = identity over the raw stressAtLat grainAngle, so it returns 0 or π/2.
    // T6 will REPLACE this with a continuous function and its own RED asserts continuity across 45°.
    for (const [sMer, sZon] of [[2, 1], [1, 2], [1.5, 1.5], [-2, -0.5]]) {
      const a = smoothStrikeAngle(sMer, sZon);
      expect(Number.isFinite(a)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    }
  });
});
