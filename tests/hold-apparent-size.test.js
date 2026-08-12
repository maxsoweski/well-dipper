// Hold-apparent-size viewing aid — pure-helper oracle + lab-wiring pin.
// Workstream: world-engine-radius-live-feed-2026-07-25 (R1 close-out, 2026-07-28).
//
// WHY THIS CONTROL EXISTS: the Rhines band count goes as R^0.5 and the lab's display
// scale visScaleOf goes as R^0.5, so at a FIXED camera the disc grows at exactly the
// rate the bands multiply and on-screen band density is invariant (measured
// +0.031 ± 0.029 — evidence/G4-rendered-belt-count.md). The radius→banding response is
// therefore invisible by construction unless the disc's apparent size is held. The
// re-specified AC-BANDS is judged under that viewing condition, and Max's re-UAT needs
// it as an in-panel control, not a console paste (feedback_uat-keybind-design).
//
// The invariant this pins: distance / sVis (the LOGICAL distance in scaled-planet-radii,
// the same quantity the LOD keys on) is preserved across a radius change.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { holdApparentDistance, visScaleOf, minCameraDistance } from '../src/worldengine/base/labCore.js';

const LAB = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'planet-lod-lab.html'),
  'utf8',
);

describe('holdApparentDistance — the compensation law', () => {
  it('preserves the logical distance exactly across a radius change', () => {
    // R 4 → 16 is the close-out read-gate pair. Logical distance must come out unchanged.
    const s0 = visScaleOf(4), s1 = visScaleOf(16);
    const d0 = 3.0 * s0;
    const d1 = holdApparentDistance(d0, s0, s1);
    expect(d1 / s1).toBeCloseTo(d0 / s0, 12);
    expect(d1).toBeCloseTo(3.0 * s1, 12);
  });

  it('is the exact identity when the scale does not change (still frames are bit-unchanged)', () => {
    // Runs every frame with the toggle on, so a still frame must not drift the camera.
    const d = 7.3128;
    expect(holdApparentDistance(d, 2, 2)).toBe(d);
    let acc = d;
    for (let i = 0; i < 10_000; i++) acc = holdApparentDistance(acc, 2, 2);
    expect(acc).toBe(d);            // 10k frames of no-op: byte-identical, not merely close
  });

  it('round-trips: out and back over a radius round trip returns the same distance', () => {
    const s0 = visScaleOf(1), s1 = visScaleOf(11.2);
    const d0 = 5;
    expect(holdApparentDistance(holdApparentDistance(d0, s0, s1), s1, s0)).toBeCloseTo(d0, 12);
  });

  it('keeps the camera outside the scaled sphere whenever it started outside', () => {
    // The compensation scales distance and the clearance floor by the SAME factor, so it
    // can never push the camera through the surface. Swept across the full slider range.
    const R = [0.3, 0.5, 1, 2, 4, 8, 11.2, 16];
    for (const r0 of R) for (const r1 of R) {
      const s0 = visScaleOf(r0), s1 = visScaleOf(r1);
      const d0 = minCameraDistance(s0) * 1.0001;                 // just outside the floor
      const d1 = holdApparentDistance(d0, s0, s1);
      expect(d1).toBeGreaterThanOrEqual(minCameraDistance(s1));
    }
  });

  it('is monotone in the new scale (bigger disc ⇒ camera moves out, never in)', () => {
    const s0 = visScaleOf(2), d0 = 4;
    expect(holdApparentDistance(d0, s0, visScaleOf(8))).toBeGreaterThan(d0);
    expect(holdApparentDistance(d0, s0, visScaleOf(0.5))).toBeLessThan(d0);
  });

  it('returns the distance untouched on degenerate input rather than emitting NaN', () => {
    // A NaN here would put the camera at an undefined position and black the lab out.
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(holdApparentDistance(5, bad, 2)).toBe(5);
      expect(holdApparentDistance(5, 2, bad)).toBe(5);
      expect(holdApparentDistance(bad, 2, 4)).toBe(bad === bad ? bad : NaN);
    }
    expect(holdApparentDistance(5, 0, 2)).toBe(5);
    expect(holdApparentDistance(5, 2, 0)).toBe(5);
    expect(holdApparentDistance(5, -1, 2)).toBe(5);
  });

  // PLANTED-DEFECT CONTROL (feedback_measurement-channels-need-planted-defects): the
  // assertion above must be able to FAIL. A no-op implementation — the pre-close-out
  // behaviour, i.e. a fixed camera — leaves the logical distance moving, which is exactly
  // the condition that hid the band response. Assert this test would catch that.
  it('would catch a no-op implementation (the fixed-camera behaviour it replaces)', () => {
    const noop = (d) => d;
    const s0 = visScaleOf(4), s1 = visScaleOf(16);
    const d0 = 3.0 * s0;
    expect(noop(d0) / s1).not.toBeCloseTo(d0 / s0, 6);
  });
});

describe('lab wiring — the control exists and is off by default', () => {
  it('state carries holdApparentSize defaulting to false (pre-existing behaviour untouched)', () => {
    expect(LAB).toMatch(/holdApparentSize:\s*false/);
  });

  it('is exposed as a GUI control beside the radius slider, not a console-only flag', () => {
    // feedback_uat-keybind-design: Max UATs from the panel, never from DevTools.
    expect(LAB).toMatch(/fDrivers\.add\(state,\s*'holdApparentSize'\)/);
    const iSlider = LAB.indexOf("planet radius (log)");
    const iToggle = LAB.indexOf("'holdApparentSize'");
    expect(iSlider).toBeGreaterThan(-1);
    expect(iToggle).toBeGreaterThan(iSlider);                    // sits with the radius controls
    expect(iToggle - iSlider).toBeLessThan(2000);                // and stays there
  });

  it('applies the compensation in frame() gated on the flag', () => {
    expect(LAB).toMatch(/if\s*\(state\.holdApparentSize\)\s*state\.distance\s*=\s*holdApparentDistance\(/);
  });

  it('imports the helper from lab-core rather than re-deriving the math inline', () => {
    expect(LAB).toMatch(/holdApparentDistance[^\n]*from '\.\/src\/worldengine\/base\/labCore\.js'/);
  });
});
