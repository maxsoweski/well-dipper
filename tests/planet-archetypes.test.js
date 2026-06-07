// Data-integrity drift guards for planet-archetypes.js — the shared archetype
// taxonomy the lab panel (and a future Stage-D provinces system) reads. These
// tests cross-check the taxonomy against the LIVE panel source (planet-lod-lab.html)
// so a feature added/renamed in the lab can't silently drift from this map.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FEATURES, ARCHETYPES, featuresOf } from '../planet-archetypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const labSrc = readFileSync(path.resolve(__dirname, '../planet-lod-lab.html'), 'utf8');

// The enable-keys the panel actually binds, e.g. `.add(state, 'cratersEnabled')`.
const panelEnableKeys = new Set(
  [...labSrc.matchAll(/\.add\(state, '(\w+Enabled)'\)/g)].map(m => m[1])
);
// The DRIVER_PRESETS keys: each preset object opens with `radiusEarth:`.
const presetBlock = labSrc.slice(
  labSrc.indexOf('const DRIVER_PRESETS = {'),
  labSrc.indexOf('const driverUI =')
);
const panelPresetKeys = new Set(
  [...presetBlock.matchAll(/'([^']+)':\s*\{\s*radiusEarth/g)].map(m => m[1])
);

describe('FEATURES ↔ panel enable-keys', () => {
  it('every FEATURES enableKey is bound in the panel', () => {
    for (const k of Object.keys(FEATURES)) {
      expect(panelEnableKeys.has(FEATURES[k].enableKey)).toBe(true);
    }
  });
  it('every panel enable-key has exactly one FEATURES entry (no orphan folders)', () => {
    const featureEnableKeys = Object.values(FEATURES).map(f => f.enableKey);
    expect(new Set(featureEnableKeys).size).toBe(featureEnableKeys.length); // no dupes
    for (const ek of panelEnableKeys) {
      expect(featureEnableKeys).toContain(ek);
    }
  });
});

describe('ARCHETYPES integrity', () => {
  it('every FEATURES.archetypes entry is a real ARCHETYPES key', () => {
    for (const k of Object.keys(FEATURES)) {
      for (const a of FEATURES[k].archetypes) {
        expect(ARCHETYPES).toHaveProperty(a);
      }
    }
  });
  it('every ARCHETYPES.presets entry is a real panel DRIVER_PRESETS key', () => {
    for (const a of Object.keys(ARCHETYPES)) {
      for (const p of ARCHETYPES[a].presets) {
        expect(panelPresetKeys.has(p)).toBe(true);
      }
    }
  });
  it('every archetype has at least one feature (featuresOf non-empty)', () => {
    for (const a of Object.keys(ARCHETYPES)) {
      expect(featuresOf(a).length).toBeGreaterThan(0);
    }
  });
  it('every feature belongs to at least one archetype (no orphans)', () => {
    for (const k of Object.keys(FEATURES)) {
      expect(FEATURES[k].archetypes.length).toBeGreaterThan(0);
    }
  });
});

describe('featuresOf inversion round-trips', () => {
  it('a feature listing archetype A appears in featuresOf(A)', () => {
    for (const k of Object.keys(FEATURES)) {
      for (const a of FEATURES[k].archetypes) {
        expect(featuresOf(a)).toContain(k);
      }
    }
  });
  it('featuresOf returns only keys that list that archetype', () => {
    for (const a of Object.keys(ARCHETYPES)) {
      for (const k of featuresOf(a)) {
        expect(FEATURES[k].archetypes).toContain(a);
      }
    }
  });
});
