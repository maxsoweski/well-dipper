// StarFlare.billboardSwitchDistance — the camera distance at which the
// flare disc yields to the distance billboard. Extracted 2026-06-10 from
// the inline math in update() so warp arrival placement can land the
// camera in guaranteed-billboard range (see
// docs/superpowers/specs/2026-06-10-warp-arrival-billboard-distance-design.md).
// These tests pin parity with the pre-extraction inline formula.

import { describe, test, expect, afterAll } from 'vitest';
import * as THREE from 'three';
import { StarFlare } from '../src/objects/StarFlare.js';
import { setMagnitudeLaw, SKY_CEILING_PX } from '../src/rendering/apparentMagnitude.js';
import { SKY_PIXEL_SCALE } from '../src/rendering/skyPixelScale.js';

// ⭐ 2026-09-05: THE SIZE LAW MOVED AND THESE TESTS MOVED WITH IT, DELIBERATELY.
// The 16/22 clamps are now the LEGACY branch of apparentMagnitude.starTargetPx, reachable with
// MAGNITUDE_LAW = 0 and kept because the backslash A/B promises the old look byte-identical. So
// parity is still pinned — against that branch — and the new law gets its OWN assertions rather
// than the old ones being loosened until they pass. Max, 2026-09-04: in-system bodies must
// out-read the starfield, and measured at 240p the star was 1x2 buffer px against a background
// star's 2x3, so the old law's stated intent was never actually met.
// ⚠ EVERY TEST SETS THE LAW EXPLICITLY: it is module-level state a key flips at runtime, so a
// test inheriting it from whatever ran before is a flake waiting to happen.

const FOV = 50;        // representative FOV (game default is 70, settings-driven)
const SCREEN_H = 1440;

function makeStar({ radius = 1, luminosity = 1 } = {}) {
  return new StarFlare({ radius, luminosity, color: [1, 0.9, 0.8] });
}

// Reference: the inline math from StarFlare.update() as of 2026-06-10
// (pre-extraction). Switch fired when visibleDiameterPx < targetPx.
function referenceSwitchDistance(radius, luminosity, fovDeg, screenH) {
  const lumFactor = Math.max(0.55, Math.min(2.0, 0.7 + 0.2 * Math.log10(luminosity)));
  const pixelsPerRadian = (screenH / 2) / Math.tan((fovDeg * Math.PI / 180) / 2);
  const targetPx = Math.max(16, Math.min(22, 16 + 6 * (lumFactor - 0.55)));
  return (radius * 6 / targetPx) * pixelsPerRadian;
}

describe('StarFlare.billboardSwitchDistance', () => {
  test('LEGACY branch is byte-identical to the pre-extraction inline formula', () => {
    setMagnitudeLaw(0);
    const cases = [
      { radius: 0.3, luminosity: 0.04 },   // M-class
      { radius: 1.0, luminosity: 1.0 },    // G-class (Sol)
      { radius: 1.8, luminosity: 20 },     // A-class
      { radius: 6.0, luminosity: 300000 }, // O-class
    ];
    for (const c of cases) {
      const star = makeStar(c);
      expect(star.billboardSwitchDistance(FOV, SCREEN_H))
        .toBeCloseTo(referenceSwitchDistance(c.radius, c.luminosity, FOV, SCREEN_H), 6);
    }
  });

  test('boundary semantics match the old visibleDiameterPx test (legacy branch)', () => {
    setMagnitudeLaw(0);
    // Just beyond switchDist the old condition (visibleDiameterPx < targetPx)
    // was true (billboard); just inside it was false (flare).
    const star = makeStar({ radius: 1, luminosity: 1 });
    const d = star.billboardSwitchDistance(FOV, SCREEN_H);
    const ppr = (SCREEN_H / 2) / Math.tan((FOV * Math.PI / 180) / 2);
    const targetPx = 16 + 6 * (0.7 - 0.55); // G-class lumFactor = 0.7
    expect((1 * 6 / (d * 1.001)) * ppr).toBeLessThan(targetPx);    // billboard side
    expect((1 * 6 / (d * 0.999)) * ppr).toBeGreaterThan(targetPx); // flare side
  });

  test('monotonic: larger radius → larger switch distance (linear)', () => {
    setMagnitudeLaw(0);
    const d1 = makeStar({ radius: 1 }).billboardSwitchDistance(FOV, SCREEN_H);
    const d2 = makeStar({ radius: 2 }).billboardSwitchDistance(FOV, SCREEN_H);
    expect(d2).toBeCloseTo(d1 * 2, 6);
  });

  test('luminosity clamps: floor at 16 px, ceiling at 22 px (legacy branch)', () => {
    setMagnitudeLaw(0);
    // Below the lumFactor floor (0.55) all stars share targetPx = 16.
    const dimA = makeStar({ radius: 1, luminosity: 0.04 });
    const dimB = makeStar({ radius: 1, luminosity: 0.001 });
    expect(dimA.billboardSwitchDistance(FOV, SCREEN_H))
      .toBeCloseTo(dimB.billboardSwitchDistance(FOV, SCREEN_H), 6);
    // Above the ceiling all stars share targetPx = 22.
    const hotA = makeStar({ radius: 1, luminosity: 3e5 });
    const hotB = makeStar({ radius: 1, luminosity: 3e7 });
    expect(hotA.billboardSwitchDistance(FOV, SCREEN_H))
      .toBeCloseTo(hotB.billboardSwitchDistance(FOV, SCREEN_H), 6);
    // And brighter ⇒ bigger dot ⇒ switch fires closer in.
    expect(hotA.billboardSwitchDistance(FOV, SCREEN_H))
      .toBeLessThan(dimA.billboardSwitchDistance(FOV, SCREEN_H));
  });

  test('taller screen → larger switch distance (screen-space criterion)', () => {
    setMagnitudeLaw(0);
    const star = makeStar({ radius: 1, luminosity: 1 });
    expect(star.billboardSwitchDistance(FOV, 2160))
      .toBeGreaterThan(star.billboardSwitchDistance(FOV, 1080));
  });

  test('update() toggles flare/billboard at exactly the method threshold', () => {
    setMagnitudeLaw(0);
    const star = makeStar({ radius: 1, luminosity: 1 });
    const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 1e9);
    const d = star.billboardSwitchDistance(FOV, SCREEN_H);

    globalThis.window = { innerHeight: SCREEN_H };  // update() reads only window.innerHeight today — extend this stub if it grows more window reads
    try {
      cam.position.set(0, 0, d * 0.99);             // inside → flare
      cam.updateMatrixWorld();
      star.update(0.016, cam);
      expect(star._flareDisc.visible).toBe(true);
      expect(star._billboard.visible).toBe(false);

      cam.position.set(0, 0, d * 1.01);             // outside → billboard
      cam.updateMatrixWorld();
      star.update(0.016, cam);
      expect(star._flareDisc.visible).toBe(false);
      expect(star._billboard.visible).toBe(true);
    } finally {
      delete globalThis.window;
    }
  });

  // ── THE MAGNITUDE LAW ─────────────────────────────────────────────────────────────────────────
  describe('under the magnitude law', () => {
    const PPR = (SCREEN_H / 2) / Math.tan((FOV * Math.PI / 180) / 2);
    /** Drawn diameter in screen px, recovered from the switch distance it implies. */
    const drawnPx = (luminosity) =>
      (1 * 6 / makeStar({ radius: 1, luminosity }).billboardSwitchDistance(FOV, SCREEN_H)) * PPR;

    test('every star clears the starfield ceiling, which the legacy law did not', () => {
      // ⭐ THE DEFECT, PINNED. StarFlare's comment claimed the billboard was "always at least as big
      // as the brightest BG star" using aSize 8 -> 16px. The LIVE starfield's measured aSize
      // histogram tops out at 10 -> 20px, and the real-star catalog reaches 12 -> 24px, so 16-22
      // lost to it. Worst case is a star below the luminosity floor.
      setMagnitudeLaw(0);
      const legacy = drawnPx(0.001);
      setMagnitudeLaw(1);
      const lawful = drawnPx(0.001);
      expect(legacy).toBeLessThan(SKY_CEILING_PX);      // the bug
      expect(lawful).toBeGreaterThan(SKY_CEILING_PX);   // the fix
    });

    test('carries a magnitude: a supergiant draws bigger than an M-dwarf', () => {
      // The legacy law spanned 16->22px across 7.5 decades of luminosity, which at 240p is about
      // one buffer pixel of signal. This asserts the ordering exists and is strict.
      setMagnitudeLaw(1);
      expect(drawnPx(1)).toBeGreaterThan(drawnPx(0.04));
      expect(drawnPx(3e5)).toBeGreaterThan(drawnPx(1));
    });

    test('the margin is in BUFFER pixels, so it survives a resolution change', () => {
      // ⚠ THE PROPERTY THAT MAKES IT RESOLUTION-AWARE. A margin pinned to screen px shrinks to
      // nothing in buffer terms as the buffer coarsens; anchoring it to SKY_PIXEL_SCALE does not.
      setMagnitudeLaw(1);
      const prev = SKY_PIXEL_SCALE.value;
      try {
        SKY_PIXEL_SCALE.value = 4.7;  const coarse = drawnPx(1);
        SKY_PIXEL_SCALE.value = 1;    const fine = drawnPx(1);
        expect(coarse).toBeGreaterThan(fine);
        expect((coarse - SKY_CEILING_PX) / 4.7).toBeCloseTo(fine - SKY_CEILING_PX, 6);
      } finally { SKY_PIXEL_SCALE.value = prev; }
    });

    test('the toggle is live, not baked at construction', () => {
      // The backslash key flips a module-level object; a star built under one law must follow the
      // other WITHOUT being rebuilt — the same shared-state argument posterizeLevels.js makes.
      const star = makeStar({ radius: 1, luminosity: 1 });
      setMagnitudeLaw(0);
      const off = star.billboardSwitchDistance(FOV, SCREEN_H);
      setMagnitudeLaw(1);
      expect(star.billboardSwitchDistance(FOV, SCREEN_H)).not.toBeCloseTo(off, 6);
    });

    afterAll(() => setMagnitudeLaw(1));   // leave the shipped default in place
  });
});
