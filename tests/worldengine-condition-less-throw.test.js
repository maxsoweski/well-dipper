// tests/worldengine-condition-less-throw.test.js
// PRESET_ARCHETYPE retirement (world-engine-preset-archetype-retirement, 2026-07-13), Slice B.
// The migration bridge (the condition-LESS archetype chain in writeBodyRelief) was deleted. Post-retirement,
// writeBodyRelief has exactly ONE routing path: the condition-bearing derived dispatch. A caller that passes
// no bodyDrivers.condition now FAILS LOUDLY at the call site (contract designDecision #2) instead of silently
// falling back to a legacy despun default that could mask an unmigrated caller as a distant byte-diff.
// This is the ONE legitimate condition-less writeBodyRelief caller left in tests/ (carved out of the AC2 grep).
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));

describe('writeBodyRelief — condition-less input throws (PRESET_ARCHETYPE bridge retired)', () => {
  it('writeBodyRelief with no bodyDrivers throws the retirement error', () => {
    const c = carrierOf();
    expect(() => writeBodyRelief(c, { grainDrivers: DEFAULT_GRAIN_DRIVERS, macroSeed: 1 }))
      .toThrow(/bodyDrivers\.condition is required/);
  });

  it('writeBodyRelief with bodyDrivers lacking .condition throws', () => {
    // proves the guard is `bodyDrivers?.condition`, not mere `bodyDrivers` presence.
    const c = carrierOf();
    expect(() => writeBodyRelief(c, { bodyDrivers: { massGravity: 1 }, macroSeed: 1 }))
      .toThrow(/bodyDrivers\.condition is required/);
  });
});
