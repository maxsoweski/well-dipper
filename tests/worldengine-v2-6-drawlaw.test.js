// World Engine V2-6 slice-5 — the extracted preset-radius draw law (driver-presets.js).
//
// Guards the S5 extraction (Lens L21): NAMED_BODY + drawPresetRadius() now live in the shared
// data module so the lab GUI and calibration/population-sweep.mjs draw radii from ONE law. These
// are the headless AC-REROLL enablement checks — the live successive-roll drive is working-Claude's.
//
// Properties asserted:
//   (1) determinism        — same (preset, seed) ⇒ byte-identical radius (alea is a pure hash PRNG).
//   (2) named-body lock     — NAMED_BODY presets return their canonical radiusEarth, seed-invariant.
//   (3) in-band draw        — non-named archetype presets draw strictly inside RADIUS_RANGES_EARTH.
//   (4) seed sensitivity    — different seeds move the drawn radius (the draw is actually seeded).
//   (5) uint32 normalize    — seed>>>0 folding is stable (float / large / negative seeds are total).

import { describe, it, expect } from 'vitest';
import { DRIVER_PRESETS, PRESET_ARCHETYPE, NAMED_BODY, drawPresetRadius } from '../driver-presets.js';
import { RADIUS_RANGES_EARTH } from '../src/core/ScaleConstants.js';

// Archetype presets that actually seed a draw (mapped, not canonical-locked, real range).
const DRAWN_PRESETS = Object.keys(PRESET_ARCHETYPE).filter(
  (name) => !NAMED_BODY.has(name) && RADIUS_RANGES_EARTH[PRESET_ARCHETYPE[name]]
);

describe('V2-6 slice-5 — drawPresetRadius extracted draw law', () => {
  it('has drawn presets to exercise (sanity)', () => {
    expect(DRAWN_PRESETS.length).toBeGreaterThan(0);
  });

  it('(1) is deterministic per (preset, seed)', () => {
    for (const name of DRAWN_PRESETS) {
      for (const seed of [0, 1, 7, 42, 1000, 4294967295]) {
        expect(drawPresetRadius(name, seed)).toBe(drawPresetRadius(name, seed));
      }
    }
  });

  it('(2) NAMED_BODY presets return their canonical radius, seed-invariant', () => {
    for (const name of NAMED_BODY) {
      if (!DRIVER_PRESETS[name]) continue;   // NAMED_BODY may name a preset not in this build
      const canonical = DRIVER_PRESETS[name].radiusEarth ?? 1.0;
      for (const seed of [0, 1, 999, 4294967295]) {
        expect(drawPresetRadius(name, seed)).toBe(canonical);
      }
    }
  });

  it('(3) non-named archetype presets draw strictly inside their RADIUS_RANGES_EARTH band', () => {
    for (const name of DRAWN_PRESETS) {
      const [lo, hi] = RADIUS_RANGES_EARTH[PRESET_ARCHETYPE[name]];
      for (const seed of [0, 1, 3, 17, 256, 65535, 4294967295]) {
        const r = drawPresetRadius(name, seed);
        expect(r).toBeGreaterThanOrEqual(lo);
        expect(r).toBeLessThan(hi);   // alea() ∈ [0,1) ⇒ draw ∈ [lo, hi)
      }
    }
  });

  it('(4) different seeds move the drawn radius (the draw is seeded)', () => {
    for (const name of DRAWN_PRESETS) {
      const draws = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => drawPresetRadius(name, s));
      const distinct = new Set(draws.map((r) => r.toFixed(12)));
      expect(distinct.size).toBeGreaterThan(1);
    }
  });

  it('(5) seed>>>0 folding is total for float / negative / large seeds', () => {
    const name = DRAWN_PRESETS[0];
    // float folds to its truncated uint32; equal uint32 pre-images give equal draws
    expect(drawPresetRadius(name, 5.9)).toBe(drawPresetRadius(name, 5));
    expect(drawPresetRadius(name, -1)).toBe(drawPresetRadius(name, 4294967295));   // (-1)>>>0 === 2^32-1
    expect(Number.isFinite(drawPresetRadius(name, 2 ** 40))).toBe(true);
  });
});
