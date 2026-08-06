/**
 * orreryEntryGeometry — TDD RED phase (orrery-entry-orbits-2026-07-20, AC3).
 *
 * Encodes the ratified screen-space entry-geometry rule (Max, 2026-07-20):
 *   All planet orbits share ONE visibility factor, anchored on the OUTERMOST
 *   planet's projected screen offset clearing the star's rendered glow disc
 *   (generous reading), with a short fade band and no pop. The arrival spawn
 *   sits just beyond the factor-zero point (star billboard, no planets distinct).
 *
 * These tests are written to FAIL against HEAD because the module under test,
 * ../orreryEntryGeometry.js, does not exist yet — the very first import should
 * throw a module-resolution error (RED for the right reason). Working-Claude
 * builds the module GREEN afterwards.
 *
 * Fixture ground truth (Sol, ORRERY): outermost 67670 scene units, viewportH
 * 848, fov 70deg, glowRadius 9px -> d0 ~= 4.553e6; overview distance 121806 ->
 * factor exactly 1. Formula provenance: StarFlare.js:145,:350 (glow clamp),
 * main.js:6410-6418 (effective-outer walk).
 */

import { describe, it, expect } from 'vitest';
import {
  screenOffsetPx,
  starGlowRadiusPx,
  effectiveOuterOrbit,
  orbitVisibilityFactor,
  arrivalSpawnDistance,
  FADE_BAND_LO,
  FADE_BAND_HI,
  SPAWN_MARGIN,
} from '../orreryEntryGeometry.js';

// --- Sol fixture ------------------------------------------------------------
const SOL = {
  outermostOrbitRadius: 67670,
  viewportH: 848,
  fovDeg: 70,
  glow: 9, // generous rendered-glow-disc radius used as the fixture denominator
  overviewDist: 121806,
};

const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

describe('screenOffsetPx', () => {
  it('projects a ring to the expected px offset (grounds the Sol d0)', () => {
    // At the exact d0 (ratio == FADE_BAND_LO), the outermost ring projects to
    // glow * LO = 9 px. Cross-checks the projection against the fixture anchor.
    const fovRad = (SOL.fovDeg * Math.PI) / 180;
    const d0 =
      (SOL.outermostOrbitRadius * SOL.viewportH) /
      (2 * SOL.glow * FADE_BAND_LO * Math.tan(fovRad / 2));
    const px = screenOffsetPx({
      orbitRadius: SOL.outermostOrbitRadius,
      camDist: d0,
      fovDeg: SOL.fovDeg,
      viewportH: SOL.viewportH,
    });
    expect(px).toBeCloseTo(SOL.glow * FADE_BAND_LO, 6);
  });

  it('scales inversely with camera distance', () => {
    const base = { orbitRadius: 1000, fovDeg: 70, viewportH: 800 };
    const near = screenOffsetPx({ ...base, camDist: 1000 });
    const far = screenOffsetPx({ ...base, camDist: 2000 });
    expect(near).toBeCloseTo(2 * far, 9);
  });
});

describe('starGlowRadiusPx (StarFlare.js:145,:350)', () => {
  it('Sol (L=1) matches the formula: targetPx 16.9 -> radius 8.45', () => {
    expect(starGlowRadiusPx(1)).toBe(8.45);
  });

  it('clamps a very dim star to the 16px floor -> radius 8', () => {
    expect(starGlowRadiusPx(1e-6)).toBe(8);
  });

  it('clamps a very bright star to the 22px ceiling -> radius 11', () => {
    expect(starGlowRadiusPx(1e6)).toBe(11);
  });

  it('stays within the documented 8..11 radius band across the luminosity range', () => {
    for (const L of [0.001, 0.04, 0.5, 1, 20, 300000]) {
      const r = starGlowRadiusPx(L);
      expect(r).toBeGreaterThanOrEqual(8);
      expect(r).toBeLessThanOrEqual(11);
    }
  });
});

describe('effectiveOuterOrbit (main.js:6410-6418)', () => {
  it('[1,2,3,100] -> 3 (breaks at the >5x gap to 100)', () => {
    expect(effectiveOuterOrbit([1, 2, 3, 100])).toBe(3);
  });

  it('single-element array -> itself', () => {
    expect(effectiveOuterOrbit([42])).toBe(42);
  });

  it('empty array -> 0', () => {
    expect(effectiveOuterOrbit([])).toBe(0);
  });

  it('handles unsorted input (sorts ascending first)', () => {
    expect(effectiveOuterOrbit([100, 3, 1, 2])).toBe(3);
  });

  it('does not break on a contiguous run within 5x each step', () => {
    // 1,4,16,64: each <= prev*5 -> walk to the end.
    expect(effectiveOuterOrbit([1, 4, 16, 64])).toBe(64);
  });

  it('keeps a step of EXACTLY 5x (break is strictly-greater, main.js parity)', () => {
    // Lens-B advisory fold: pins the > vs >= boundary — a >= mutation flips this to 1.
    expect(effectiveOuterOrbit([1, 5, 25])).toBe(25);
  });

  it('breaks on a gap inside (5x, 10x] — pins the 5x constant itself', () => {
    // Lens-B advisory fold: a 5x -> 10x loosening would walk to 7 instead.
    expect(effectiveOuterOrbit([1, 7])).toBe(1);
  });
});

describe('orbitVisibilityFactor — Sol fixture anchors', () => {
  const glow = SOL.glow;

  it('is exactly 1 at the overview distance (121806)', () => {
    const f = orbitVisibilityFactor({
      outermostOrbitRadius: SOL.outermostOrbitRadius,
      camDist: SOL.overviewDist,
      fovDeg: SOL.fovDeg,
      viewportH: SOL.viewportH,
      starGlowRadiusPx: glow,
    });
    expect(f).toBe(1);
  });

  it('is exactly 0 at the arrival spawn distance', () => {
    const spawn = arrivalSpawnDistance({
      outermostOrbitRadius: SOL.outermostOrbitRadius,
      fovDeg: SOL.fovDeg,
      viewportH: SOL.viewportH,
      starGlowRadiusPx: glow,
    });
    const f = orbitVisibilityFactor({
      outermostOrbitRadius: SOL.outermostOrbitRadius,
      camDist: spawn,
      fovDeg: SOL.fovDeg,
      viewportH: SOL.viewportH,
      starGlowRadiusPx: glow,
    });
    expect(f).toBe(0);
  });

  it('is monotonically nondecreasing as the camera closes in (12-rung ladder)', () => {
    const ladder = [6e6, 5e6, 4.5e6, 4.2e6, 4e6, 3.5e6, 3e6, 2e6, 1e6, 5e5, 2e5, SOL.overviewDist];
    let prev = -1;
    for (const camDist of ladder) {
      const f = orbitVisibilityFactor({
        outermostOrbitRadius: SOL.outermostOrbitRadius,
        camDist,
        fovDeg: SOL.fovDeg,
        viewportH: SOL.viewportH,
        starGlowRadiusPx: glow,
      });
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      prev = f;
    }
    // ends fully visible
    expect(prev).toBe(1);
  });
});

describe('orbitVisibilityFactor — band edges (uses imported FADE_BAND constants)', () => {
  // Synthetic fixture; construct camDist for a target ratio via the algebraic
  // inverse of screenOffsetPx so we hit the band edges exactly.
  const bx = { orbitRadius: 5000, fovDeg: 60, viewportH: 900, glow: 10 };
  const distForRatio = (ratio) => {
    const fovRad = (bx.fovDeg * Math.PI) / 180;
    return (bx.orbitRadius * (bx.viewportH / 2)) / (ratio * bx.glow * Math.tan(fovRad / 2));
  };
  const factorAtRatio = (ratio) =>
    orbitVisibilityFactor({
      outermostOrbitRadius: bx.orbitRadius,
      camDist: distForRatio(ratio),
      fovDeg: bx.fovDeg,
      viewportH: bx.viewportH,
      starGlowRadiusPx: bx.glow,
    });

  it('is exactly 0 for ratio at or below FADE_BAND_LO', () => {
    expect(factorAtRatio(0.5)).toBe(0);
    expect(factorAtRatio(FADE_BAND_LO)).toBe(0);
  });

  it('is exactly 1 for ratio at or above FADE_BAND_HI', () => {
    expect(factorAtRatio(FADE_BAND_HI)).toBe(1);
    expect(factorAtRatio(2.0)).toBe(1);
  });

  it('is strictly between 0 and 1 inside the band (midpoint ~ 0.5)', () => {
    const mid = (FADE_BAND_LO + FADE_BAND_HI) / 2;
    const f = factorAtRatio(mid);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
    expect(f).toBeCloseTo(0.5, 6); // symmetric smoothstep at the band midpoint
  });

  it('follows the cubic Hermite shape at the quarter points (not a linear ramp)', () => {
    // Lens-B advisory fold: midpoint alone cannot distinguish smoothstep from
    // linear (both 0.5). smoothstep(0.25)=0.15625 / (0.75)=0.84375; linear
    // would read 0.25 / 0.75 — this pins the no-pop cubic Max ratified.
    const q1 = FADE_BAND_LO + 0.25 * (FADE_BAND_HI - FADE_BAND_LO);
    const q3 = FADE_BAND_LO + 0.75 * (FADE_BAND_HI - FADE_BAND_LO);
    expect(factorAtRatio(q1)).toBeCloseTo(0.15625, 6);
    expect(factorAtRatio(q3)).toBeCloseTo(0.84375, 6);
  });

  it('the fade band is non-trivial (LO strictly below HI)', () => {
    expect(FADE_BAND_LO).toBeLessThan(FADE_BAND_HI);
    expect(SPAWN_MARGIN).toBeGreaterThan(1);
  });
});

describe('orbitVisibilityFactor — gates fire first', () => {
  const near = {
    outermostOrbitRadius: SOL.outermostOrbitRadius,
    camDist: SOL.overviewDist, // would be factor 1 if ungated
    fovDeg: SOL.fovDeg,
    viewportH: SOL.viewportH,
    starGlowRadiusPx: SOL.glow,
  };
  const distances = [SOL.overviewDist, 2e5, 1e6, 4e6, 6e6];

  it('userOrbitsOff === true forces 0 at every distance', () => {
    for (const camDist of distances) {
      expect(
        orbitVisibilityFactor({ ...near, camDist, userOrbitsOff: true })
      ).toBe(0);
    }
  });

  it("regime 'helm' forces 0 at every distance", () => {
    for (const camDist of distances) {
      expect(
        orbitVisibilityFactor({ ...near, camDist, regime: 'helm' })
      ).toBe(0);
    }
  });

  it("default regime 'orrery' with toggle on is NOT gated", () => {
    expect(orbitVisibilityFactor(near)).toBe(1);
  });
});

describe('arrivalSpawnDistance', () => {
  const glow = SOL.glow;
  const fovRad = (SOL.fovDeg * Math.PI) / 180;
  const d0 =
    (SOL.outermostOrbitRadius * SOL.viewportH) /
    (2 * glow * FADE_BAND_LO * Math.tan(fovRad / 2));

  it('matches the Sol ground-truth d0 (~4.553e6) within 1%', () => {
    const spawn = arrivalSpawnDistance({
      outermostOrbitRadius: SOL.outermostOrbitRadius,
      fovDeg: SOL.fovDeg,
      viewportH: SOL.viewportH,
      starGlowRadiusPx: glow,
    });
    expect(rel(spawn / SPAWN_MARGIN, 4.553e6)).toBeLessThan(0.01);
    expect(rel(spawn, 4.553e6 * SPAWN_MARGIN)).toBeLessThan(0.01);
  });

  it('returns d0 scaled by SPAWN_MARGIN and is strictly beyond d0', () => {
    const spawn = arrivalSpawnDistance({
      outermostOrbitRadius: SOL.outermostOrbitRadius,
      fovDeg: SOL.fovDeg,
      viewportH: SOL.viewportH,
      starGlowRadiusPx: glow,
    });
    expect(spawn).toBeCloseTo(d0 * SPAWN_MARGIN, 3);
    expect(spawn).toBeGreaterThan(d0);
  });

  it('the factor at the spawn distance is exactly 0 (star billboard, no orbits)', () => {
    const spawn = arrivalSpawnDistance({
      outermostOrbitRadius: SOL.outermostOrbitRadius,
      fovDeg: SOL.fovDeg,
      viewportH: SOL.viewportH,
      starGlowRadiusPx: glow,
    });
    expect(
      orbitVisibilityFactor({
        outermostOrbitRadius: SOL.outermostOrbitRadius,
        camDist: spawn,
        fovDeg: SOL.fovDeg,
        viewportH: SOL.viewportH,
        starGlowRadiusPx: glow,
      })
    ).toBe(0);
  });
});

describe('wide-binary composition (effectiveOuterOrbit keeps the spawn sane)', () => {
  const radii = [1000, 2000, 5000, 5e7]; // far captured companion at 50M units

  it('effectiveOuterOrbit ignores the far companion', () => {
    expect(effectiveOuterOrbit(radii)).toBe(5000);
  });

  it('the spawn built on the effective outer stays close, not thrown out to the companion', () => {
    const eff = effectiveOuterOrbit(radii);
    const opts = { fovDeg: 70, viewportH: 848, starGlowRadiusPx: 9 };
    const spawnEff = arrivalSpawnDistance({ outermostOrbitRadius: eff, ...opts });
    const spawnCompanion = arrivalSpawnDistance({ outermostOrbitRadius: 5e7, ...opts });
    expect(Number.isFinite(spawnEff)).toBe(true);
    expect(spawnEff).toBeGreaterThan(0);
    // Using the companion instead would blow the spawn out by ~1e4x; the
    // effective-outer walk keeps it sane.
    expect(spawnEff).toBeLessThan(spawnCompanion / 1000);
  });
});
