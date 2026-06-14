// tests/feature-associations.test.js
import { describe, it, expect } from 'vitest';
import { FEATURES } from '../planet-archetypes.js';
import { ASSOCIATIONS, DOMAINS, PROVINCE_GROUPS } from '../planet-feature-associations.js';

const featureKeys = Object.keys(FEATURES);

describe('feature association manifest', () => {
  it('has an entry for every FEATURES key (no gaps)', () => {
    const missing = featureKeys.filter(k => !ASSOCIATIONS[k]);
    expect(missing, `features missing an association entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no orphan entries (every entry maps to a real feature)', () => {
    const orphans = Object.keys(ASSOCIATIONS).filter(k => !FEATURES[k]);
    expect(orphans, `association entries for unknown features: ${orphans.join(', ')}`).toEqual([]);
  });

  it('every entry uses a valid domain and provinceGroup', () => {
    for (const k of featureKeys) {
      const a = ASSOCIATIONS[k];
      expect(DOMAINS, `${k}.domain`).toContain(a.domain);
      expect(Object.keys(PROVINCE_GROUPS), `${k}.provinceGroup`).toContain(a.provinceGroup);
    }
  });

  it('dependsOn.features / modifies / isolationKit reference real feature keys', () => {
    for (const k of featureKeys) {
      const a = ASSOCIATIONS[k];
      for (const ref of [...a.dependsOn.features, ...a.modifies, ...a.isolationKit]) {
        expect(FEATURES[ref], `${k} references unknown feature '${ref}'`).toBeTruthy();
      }
    }
  });
});
