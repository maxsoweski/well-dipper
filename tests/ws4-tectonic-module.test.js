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

describe('WS4 T4 — smoothStrikeAngle returns a director in [0, π/2]', () => {
  it('returns a finite number in [0, π/2] (the director range)', () => {
    // After T6 this is a CONTINUOUS function of (sMer, sZon); range stays [0, π/2].
    for (const [sMer, sZon] of [[2, 1], [1, 2], [1.5, 1.5], [-2, -0.5]]) {
      const a = smoothStrikeAngle(sMer, sZon);
      expect(Number.isFinite(a)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    }
  });
});

// ── T6 — smooth director (continuous through the 45° |sMer|=|sZon| crossover) + macroSeed band ──────
// Why (plan §D3): the raw E6 grainAngle is a 2-value director {0, π/2} with a HARD flip at |lat|=45°.
// Fed raw, a cube that interpolates across that flip smears through angles the math never intended.
// T6 re-derives a CONTINUOUS strike from the continuous stress components (sMer, sZon) — monotone
// through the crossover instead of stepping — and macroSeed shifts band placement for inter-body
// variety (plan §D9). Per Max #3 this does NOT thread rotatePoleDeg into writeGrainSphere (no
// src/worldengine edit); the latitude offset is applied inside the bake via stressAtLat re-derivation.
import { stressAtLat } from '../src/worldengine/base/tectonic.js';

describe('WS4 T6 — smoothStrikeAngle is CONTINUOUS (monotone through the 45° crossover)', () => {
  it('→ 0 where |sMer| ≫ |sZon|, → π/2 where |sZon| ≫ |sMer| (the two endpoints)', () => {
    expect(smoothStrikeAngle(10, 0.001)).toBeLessThan(0.05);          // meridional-dominant → ~0
    expect(smoothStrikeAngle(0.001, 10)).toBeGreaterThan(Math.PI / 2 - 0.05); // zonal-dominant → ~π/2
  });

  it('passes THROUGH (does not step at) the |sMer|=|sZon| crossover — equal-magnitude → π/4', () => {
    // The quantized writer flips 0↔π/2 here; the smooth director must sit at the midpoint, finite.
    expect(smoothStrikeAngle(1, 1)).toBeCloseTo(Math.PI / 4, 6);
    expect(smoothStrikeAngle(-2, 2)).toBeCloseTo(Math.PI / 4, 6); // sign-independent (director magnitude)
  });

  it('is monotone non-decreasing as the zonal share grows (no jump across the crossover)', () => {
    // Sweep |sZon|/|sMer| from << 1 to >> 1 at fixed |sMer|; strike must rise smoothly 0 → π/2 with
    // every step small (no π/2 discontinuity) — the property a banded {0,π/2} field FAILS.
    const sMer = 1;
    let prev = smoothStrikeAngle(sMer, 1e-4);
    let maxStep = 0;
    for (let r = 1e-4; r <= 100; r *= 1.05) {
      const a = smoothStrikeAngle(sMer, r);
      expect(a).toBeGreaterThanOrEqual(prev - 1e-9); // non-decreasing
      maxStep = Math.max(maxStep, a - prev);
      prev = a;
    }
    expect(maxStep).toBeLessThan(0.05); // no hard flip — every increment is small
  });

  it('the strike is continuous in LATITUDE across 45° (sample 44.9° vs 45.1° — small angle, not a π/2 step)', () => {
    const d = neutralDrivers;
    const a = smoothStrikeAngle(stressAtLat(44.9, d).sMer, stressAtLat(44.9, d).sZon);
    const b = smoothStrikeAngle(stressAtLat(45.1, d).sMer, stressAtLat(45.1, d).sZon);
    expect(Math.abs(a - b)).toBeLessThan(0.05); // continuous — the raw director would jump π/2 here
  });
});

describe('WS4 T6 — bakeTectonicGrain uses the smooth director + macroSeed band placement', () => {
  const mesh = tinyMesh();

  it('the baked world-strike is NOT the raw quantized director (smooth strike is used per node)', () => {
    // With the smooth director, equal-stress nodes near the crossover get a π/4 strike, so the world
    // strike no longer collapses onto exactly cos(0)/cos(π/2) of the frame. Assert at least one node
    // carries an intermediate strike (the smooth director is genuinely wired, not the stub).
    const out = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 7 });
    let intermediate = false;
    for (let i = 0; i < out.grainAngleSmooth.length; i++) {
      const a = out.grainAngleSmooth[i];
      if (a > 0.02 && a < Math.PI / 2 - 0.02) { intermediate = true; break; }
    }
    expect(intermediate).toBe(true);
  });

  it('macroSeed shifts band placement (different macroSeed → different strike field) — inter-body variety', () => {
    // Plan §D9: rotatePoleDeg = f(macroSeed) relocates the latitude bands so different worlds differ.
    // This is an INTER-BODY check (not a within-body longitudinal one — D4: move-2 is inter-body only).
    const a = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 7 });
    const b = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 4242 });
    let differs = false;
    for (let i = 0; i < a.grainAngleSmooth.length; i++) {
      if (Math.abs(a.grainAngleSmooth[i] - b.grainAngleSmooth[i]) > 1e-4) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });

  it('is deterministic per (drivers, macroSeed): same macroSeed → byte-identical smooth strike', () => {
    const a = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 99 });
    const b = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 99 });
    expect(Array.from(a.grainAngleSmooth)).toEqual(Array.from(b.grainAngleSmooth));
    expect(Array.from(a.strikeWorldX)).toEqual(Array.from(b.strikeWorldX));
    expect(Array.from(a.strikeWorldY)).toEqual(Array.from(b.strikeWorldY));
    expect(Array.from(a.strikeWorldZ)).toEqual(Array.from(b.strikeWorldZ));
  });

  it('does NOT call Math.random / Date.now in the smooth-director + macroSeed path', () => {
    const randSpy = vi.spyOn(Math, 'random');
    const nowSpy = vi.spyOn(Date, 'now');
    bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 4242 });
    expect(randSpy).not.toHaveBeenCalled();
    expect(nowSpy).not.toHaveBeenCalled();
    randSpy.mockRestore();
    nowSpy.mockRestore();
  });
});
