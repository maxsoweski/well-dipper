// StarFlare.billboardSwitchDistance — the camera distance at which the
// flare disc yields to the distance billboard. Extracted 2026-06-10 from
// the inline math in update() so warp arrival placement can land the
// camera in guaranteed-billboard range (see
// docs/superpowers/specs/2026-06-10-warp-arrival-billboard-distance-design.md).
// These tests pin parity with the pre-extraction inline formula.

import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { StarFlare } from '../src/objects/StarFlare.js';

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
  test('parity with pre-extraction inline formula across star classes', () => {
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

  test('boundary semantics match the old visibleDiameterPx test', () => {
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
    const d1 = makeStar({ radius: 1 }).billboardSwitchDistance(FOV, SCREEN_H);
    const d2 = makeStar({ radius: 2 }).billboardSwitchDistance(FOV, SCREEN_H);
    expect(d2).toBeCloseTo(d1 * 2, 6);
  });

  test('luminosity clamps: floor at 16 px, ceiling at 22 px', () => {
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
    const star = makeStar({ radius: 1, luminosity: 1 });
    expect(star.billboardSwitchDistance(FOV, 2160))
      .toBeGreaterThan(star.billboardSwitchDistance(FOV, 1080));
  });

  test('update() toggles flare/billboard at exactly the method threshold', () => {
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
});
