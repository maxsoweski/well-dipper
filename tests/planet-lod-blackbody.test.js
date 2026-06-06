// Unit tests for emissiveBlackbody() — the shared blackbody-color helper
// (integration-index §1, "Blackbody emissive color" row). TWO domains read the
// same curve: Bands thermal (F32/F33, 500–3000 K) and Exotic magma (F41,
// 1500–4000 K). It returns CHROMATICITY only (peak channel ≈ 1); the caller
// scales intensity (uThermalStrength × starFacing). So the tests pin the LOGIC
// of an incandescence ramp — deep-red → orange → yellow → warm-white as temp
// rises — not exact constants (the deriveUniforms precedent: pin logic, tune
// constants in the lab). The GLSL mirror is a transcription of this same ramp.
import { describe, it, expect } from 'vitest';
import { emissiveBlackbody } from '../planet-lod-lab-core.js';

// Across the union of both domains' ranges.
const TEMPS = [600, 800, 1200, 1500, 2000, 2500, 3000, 4000];

describe('emissiveBlackbody — output domain', () => {
  it('returns 3 channels, all within [0,1]', () => {
    for (const T of TEMPS) {
      const c = emissiveBlackbody(T);
      expect(c).toHaveLength(3);
      for (const ch of c) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic — same temp, same color', () => {
    expect(emissiveBlackbody(2200)).toEqual(emissiveBlackbody(2200));
  });
});

describe('emissiveBlackbody — incandescence shape', () => {
  it('red is the dominant channel at low temperature (deep-red glow)', () => {
    const c = emissiveBlackbody(800);
    expect(c[0]).toBeGreaterThan(c[1]);   // r > g
    expect(c[1]).toBeGreaterThan(c[2]);   // g > b  (red-orange, blue lowest)
  });

  it('red stays saturated (≈1) across the whole range — it maxes out first', () => {
    for (const T of TEMPS) expect(emissiveBlackbody(T)[0]).toBeCloseTo(1.0, 2);
  });

  it('green rises monotonically with temperature (color warms toward white)', () => {
    for (let i = 1; i < TEMPS.length; i++) {
      const lo = emissiveBlackbody(TEMPS[i - 1])[1];
      const hi = emissiveBlackbody(TEMPS[i])[1];
      expect(hi).toBeGreaterThanOrEqual(lo);
    }
  });

  it('blue rises monotonically with temperature (whiteness climbs)', () => {
    for (let i = 1; i < TEMPS.length; i++) {
      const lo = emissiveBlackbody(TEMPS[i - 1])[2];
      const hi = emissiveBlackbody(TEMPS[i])[2];
      expect(hi).toBeGreaterThanOrEqual(lo);
    }
  });

  it('hotter is strictly whiter than cooler (min-channel climbs end to end)', () => {
    const cool = emissiveBlackbody(800);
    const hot = emissiveBlackbody(4000);
    expect(Math.min(...hot)).toBeGreaterThan(Math.min(...cool));
  });
});

describe('emissiveBlackbody — clamping outside the authored range', () => {
  it('clamps below the lowest stop (no runaway, stays the deep-red floor)', () => {
    expect(emissiveBlackbody(200)).toEqual(emissiveBlackbody(0));
  });

  it('clamps above the highest stop (saturates at the white ceiling)', () => {
    expect(emissiveBlackbody(9000)).toEqual(emissiveBlackbody(20000));
  });
});
