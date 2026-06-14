// tests/feature-associations.test.js
import { describe, it, expect } from 'vitest';
import { FEATURES, PROVINCES } from '../planet-archetypes.js';
import { ASSOCIATIONS, DOMAINS, PROVINCE_GROUPS, provinceGroupOf } from '../planet-feature-associations.js';

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

describe('provinceGroup ⇔ PROVINCES consistency', () => {
  it('each provinced feature\'s group matches its PROVINCES field+polarity', () => {
    for (const k of Object.keys(FEATURES)) {
      const p = PROVINCES[k];
      if (!p || p.floor >= 1.0) continue;            // global / unprovinced — skip
      const expected = provinceGroupOf(p.field, p.polarity);
      expect(ASSOCIATIONS[k].provinceGroup, `${k}`).toBe(expected);
    }
  });

  it('every floor-1.0 (unprovinced) feature is marked global', () => {
    for (const k of Object.keys(FEATURES)) {
      const p = PROVINCES[k];
      if (p && p.floor < 1.0) continue;
      expect(ASSOCIATIONS[k].provinceGroup, `${k}`).toBe('global');
    }
  });
});
