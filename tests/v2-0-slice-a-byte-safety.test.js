// World Engine V2-0 Slice A — byte-safety guards for the DRIVER_PRESETS / PRESET_ARCHETYPE /
// neutral-driver extraction (BUILD-PLAN §1 "Byte-safety of Slice A" (1)-(3)).
//
//  (1) The extracted DRIVER_PRESETS deep-equals a one-time snapshot of the pre-change literal
//      scraped from ad156cc's planet-lod-lab.html.
//  (2) The extracted PRESET_ARCHETYPE deep-equals a one-time snapshot of the ad156cc inline map.
//  (3) Forward-drift guard: buildNeutralBodyDrivers(deriveUniforms(fp,1.0), fp) over all 15
//      archetype-mapped presets equals a snapshot captured on the post-A tree (== pre-change
//      behavior), so any FUTURE edit to the shared neutral path trips this test.
//
// Together with the verbatim relocation (reviewable git diff of the 8-line neutral functions),
// these discharge Slice A's widened extraction surface WITHOUT carrier hashing — the AC1 carrier
// goldens are captured post-A and validly encode pre-change behavior given (1)-(3) hold.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DRIVER_PRESETS, PRESET_NAMES, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readFixture = (name) => JSON.parse(readFileSync(path.resolve(__dirname, 'fixtures', name), 'utf8'));

const DP_SNAPSHOT = readFixture('v2-0-driver-presets.ad156cc.json');
const PA_SNAPSHOT = readFixture('v2-0-preset-archetype.ad156cc.json');
const NEUTRAL_SNAPSHOT = readFixture('v2-0-neutral-drivers.post-a.json');

describe('V2-0 Slice A — DRIVER_PRESETS extraction is value-preserving', () => {
  it('exports all 18 preset descriptors (17 ad156cc + V2-5 Moon/Mercury)', () => {
    expect(Object.keys(DRIVER_PRESETS).length).toBe(18);   // V2-5 slice-2: the 18th non-golden preset joined
  });
  it('includes Mars + Hot Jupiter (data, no archetype mapping)', () => {
    expect(DRIVER_PRESETS).toHaveProperty('Mars (arid rocky)');
    expect(DRIVER_PRESETS).toHaveProperty('Hot Jupiter (locked giant)');
  });
  it('PRESET_NAMES === Object.keys(DRIVER_PRESETS) (dropdown order)', () => {
    expect(PRESET_NAMES).toEqual(Object.keys(DRIVER_PRESETS));
  });
  it('the original 17 ad156cc descriptors are UNMUTATED — per-key subset (byte-safety §1 A(1); fixture never re-captured)', () => {
    // V2-5 slice-2 (BS-MF2): the 18th preset (Moon/Mercury, added to DRIVER_PRESETS but NOT to the frozen
    // v2-0-driver-presets.ad156cc.json fixture) makes a whole-object toEqual(DP_SNAPSHOT) fail. The
    // extraction-pin semantics ("the ad156cc 17 are unmutated") are preserved WITHOUT re-capturing the
    // git-diff-empty fixture by asserting each of the 17 snapshot keys per-key — the Mars/Hot-Jupiter-join
    // precedent (a code-level assertion edit, not a golden re-capture).
    expect(Object.keys(DP_SNAPSHOT).length).toBe(17);
    for (const key of Object.keys(DP_SNAPSHOT)) {
      expect(DRIVER_PRESETS[key], key).toEqual(DP_SNAPSHOT[key]);
    }
  });
});

describe('V2-0 Slice A — PRESET_ARCHETYPE extraction is value-preserving', () => {
  it('exports exactly the 15 mapped preset keys', () => {
    expect(Object.keys(PRESET_ARCHETYPE).length).toBe(15);
  });
  it('does NOT map Mars or Hot Jupiter (unmapped by design)', () => {
    expect(PRESET_ARCHETYPE).not.toHaveProperty('Mars (arid rocky)');
    expect(PRESET_ARCHETYPE).not.toHaveProperty('Hot Jupiter (locked giant)');
  });
  it('every archetype key is a real DRIVER_PRESETS key', () => {
    for (const name of Object.keys(PRESET_ARCHETYPE)) {
      expect(DRIVER_PRESETS).toHaveProperty(name);
    }
  });
  it('deep-equals the ad156cc pre-change inline map (byte-safety §1 A(2))', () => {
    expect(PRESET_ARCHETYPE).toEqual(PA_SNAPSHOT);
  });
});

describe('V2-0 Slice A — buildNeutralBodyDrivers forward-drift guard (§1 A(3))', () => {
  it('covers all 15 archetype-mapped presets', () => {
    expect(Object.keys(NEUTRAL_SNAPSHOT).sort()).toEqual(Object.keys(PRESET_ARCHETYPE).sort());
  });
  for (const name of Object.keys(PRESET_ARCHETYPE)) {
    it(`neutral drivers unchanged for "${name}"`, () => {
      const fp = DRIVER_PRESETS[name];
      const out = buildNeutralBodyDrivers(deriveUniforms(fp, 1.0), fp);
      // thermalState is a hardcoded undefined in the neutral path (JSON can't hold it — re-asserted here).
      expect(out.thermalState).toBeUndefined();
      // toEqual ignores the undefined thermalState property, so it matches the 3-field snapshot;
      // a future non-undefined thermalState (or any drift in the numeric fields) trips this.
      expect(out).toEqual(NEUTRAL_SNAPSHOT[name]);
    });
  }
});
