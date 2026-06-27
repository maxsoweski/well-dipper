// tests/worldengine-plate-regime-gate.test.js
// AC5 — the plate path is GATED by body regime and does NOT globally swap E6. Verified at the gate
// selector + the despun writers directly (headless), NOT via full route(). Non-Earth-like archetypes
// keep writeGrainSphere+writeHeightSphere BYTE-IDENTICAL; terrestrial/ocean get the plate writer. The
// gate reads an archetype/locked discriminator threaded from the lab/preset layer — it is NOT inside
// the three-free src/worldengine/base layer.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { buildIrregularSphere, isEarthlikePlatePath, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));

// The byte-identical despun reference: EXACTLY what the despun path runs (same calls/args/seed).
function despunReference(macroSeed) {
  const c = carrierOf();
  const heightSeed = 'e6:' + (macroSeed | 0);
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, heightSeed);
  return c;
}

describe('AC5 — regime gate (Earth-like plate path vs despun zonal E6)', () => {
  it('isEarthlikePlatePath: terrestrial/ocean => plate; icy/locked/giant/null => despun', () => {
    expect(isEarthlikePlatePath('terrestrial', false)).toBe(true);
    expect(isEarthlikePlatePath('ocean', false)).toBe(true);
    expect(isEarthlikePlatePath('terrestrial', true)).toBe(false);   // tidally-locked terrestrial => despun shell
    expect(isEarthlikePlatePath('ice', false)).toBe(false);
    expect(isEarthlikePlatePath('lava', false)).toBe(false);
    expect(isEarthlikePlatePath('gas-giant', false)).toBe(false);
    expect(isEarthlikePlatePath(null, false)).toBe(false);
    expect(isEarthlikePlatePath(undefined, false)).toBe(false);
  });

  it('non-Earth-like archetype (ice) => carrier.height byte-identical to the despun writers', () => {
    const seed = 7;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = writeBodyRelief(c, { archetype: 'ice', locked: false, grainDrivers: DEFAULT_GRAIN_DRIVERS, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('despun');
    expect(out.plateDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));   // byte-identical, plate path NOT entered
  });

  it('tidally-locked terrestrial => despun byte-identical (locked beats archetype)', () => {
    const seed = 3;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = writeBodyRelief(c, { archetype: 'terrestrial', locked: true, grainDrivers: DEFAULT_GRAIN_DRIVERS, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('despun');
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });

  it('terrestrial archetype => the plate writer runs and carrier.height DIFFERS from the despun E6 field', () => {
    const seed = 1;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = writeBodyRelief(c, { archetype: 'terrestrial', locked: false, grainDrivers: DEFAULT_GRAIN_DRIVERS, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('plate');
    expect(out.plateDiag).toBeTruthy();
    expect(out.plateDiag.plateCount).toBeGreaterThanOrEqual(7);
    expect(Array.from(c.height)).not.toEqual(Array.from(ref.height));  // plate-placed, not latitude bands
  });

  it('the gate lives at the route()/lab boundary, NOT inside the three-free base layer', () => {
    // isEarthlikePlatePath is exported from planet-lod-rivers.js (the route()/lab boundary).
    expect(typeof isEarthlikePlatePath).toBe('function');
    // the regime-agnostic base modules carry no archetype/regime literal.
    const platesSrc = readFileSync(fileURLToPath(new URL('../src/worldengine/base/plates.js', import.meta.url)), 'utf8');
    const tectonicSrc = readFileSync(fileURLToPath(new URL('../src/worldengine/base/tectonic.js', import.meta.url)), 'utf8');
    for (const src of [platesSrc, tectonicSrc]) {
      expect(src).not.toMatch(/isEarthlikePlatePath/);
      expect(src).not.toMatch(/['"]terrestrial['"]/);
      expect(src).not.toMatch(/archetype/);
    }
  });
});
