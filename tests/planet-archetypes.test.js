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

// ── Stage-D provinces (LIVE 2026-06-10) — affinity-data drift guards ──
// PROVINCES (planet-archetypes.js) is the source of truth; the GLSL provinceWeight()
// if-chain in planet-lod-lab.html mirrors it. These tests parse the GLSL rows and
// cross-check field/polarity/floor so the two cannot silently drift.
import { PROVINCES, PROVINCE_FIELDS } from '../planet-archetypes.js';
import { provinceWeightFromField } from '../planet-lod-lab-core.js';

// JS key → GLSL const name (ejecta shares PROV_CRATERS in the shader — no own row).
const GLSL_NAME = {
  mountains: 'PROV_MOUNTAINS', craters: 'PROV_CRATERS', canyons: 'PROV_CANYONS',
  scarps: 'PROV_SCARPS', plateaus: 'PROV_PLATEAUS', tessera: 'PROV_TESSERA',
  edifices: 'PROV_EDIFICES', lava: 'PROV_LAVA', chaos: 'PROV_CHAOS',
  cryoRidge: 'PROV_CRYORIDGE', rivers: 'PROV_RIVERS', sublimation: 'PROV_SUBLIMATION',
  glacial: 'PROV_GLACIAL', frost: 'PROV_FROST', lakes: 'PROV_LAKES', deltas: 'PROV_DELTAS',
  coastlines: 'PROV_COAST', outflow: 'PROV_OUTFLOW', karst: 'PROV_KARST', dunes: 'PROV_DUNES',
  dust: 'PROV_DUST', massWasting: 'PROV_MASSW',
};
const FIELD_OF_SWIZZLE = { x: 0, y: 1, z: 2 };
const glslRows = Object.fromEntries(
  [...labSrc.matchAll(
    /fid == (PROV_\w+)\)\s*\{ f = (1\.0 - )?gProvince\.([xyz]);\s*fl = ([0-9.]+);/g
  )].map(m => [m[1], {
    field: FIELD_OF_SWIZZLE[m[3]],
    polarity: m[2] ? -1 : +1,
    floor: parseFloat(m[4]),
  }])
);

describe('PROVINCES ↔ FEATURES coverage', () => {
  it('every FEATURES key has exactly one PROVINCES affinity row (and no orphans)', () => {
    expect(Object.keys(PROVINCES).sort()).toEqual(Object.keys(FEATURES).sort());
  });
  it('every affinity row is well-formed (field index real, polarity ±1, floor in [0,1])', () => {
    for (const [k, a] of Object.entries(PROVINCES)) {
      expect(PROVINCE_FIELDS[a.field], k).toBeDefined();
      expect([-1, 1], k).toContain(a.polarity);
      expect(a.floor, k).toBeGreaterThanOrEqual(0);
      expect(a.floor, k).toBeLessThanOrEqual(1);
    }
  });
  it('ejecta affinity equals craters (F3 wraps F2 — aprons must never ring suppressed craters)', () => {
    expect(PROVINCES.ejecta).toEqual(PROVINCES.craters);
  });
  it('at least one complementary pair shares a field with opposite polarity (feature-poor provinces)', () => {
    expect(PROVINCES.mountains.field).toBe(PROVINCES.craters.field);
    expect(PROVINCES.mountains.polarity).toBe(-PROVINCES.craters.polarity);
  });
});

describe('PROVINCES ↔ GLSL accessor mirror', () => {
  it('every non-ejecta feature has a parsed GLSL row with matching field/polarity/floor', () => {
    for (const [k, a] of Object.entries(PROVINCES)) {
      if (k === 'ejecta') continue;                       // shares PROV_CRATERS in GLSL
      const row = glslRows[GLSL_NAME[k]];
      expect(row, `GLSL row missing for ${k}`).toBeDefined();
      expect(row, k).toEqual({ field: a.field, polarity: a.polarity, floor: a.floor });
    }
  });
  it('the GLSL if-chain has no extra feature rows beyond the data', () => {
    const expected = new Set(Object.entries(GLSL_NAME)
      .filter(([k]) => k !== 'ejecta').map(([, v]) => v));
    for (const name of Object.keys(glslRows)) expect(expected.has(name), name).toBe(true);
  });
});

describe('provinceWeightFromField mapping (the §8 soft-weight contract)', () => {
  const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
  it('dial 0 reproduces the legacy uniform look exactly (w ≡ 1)', () => {
    for (const a of Object.values(PROVINCES))
      for (const f of samples) expect(provinceWeightFromField(f, a, 0)).toBe(1);
  });
  it('weights stay within [mix(1,floor,dial), 1] — a multiplier, never a gate below floor', () => {
    for (const a of Object.values(PROVINCES))
      for (const dial of [0.5, 1])
        for (const f of samples) {
          const w = provinceWeightFromField(f, a, dial);
          expect(w).toBeLessThanOrEqual(1 + 1e-12);
          expect(w).toBeGreaterThanOrEqual(1 + (a.floor - 1) * dial - 1e-12);
        }
  });
  it('monotone in the field per polarity (no fold-backs that would band)', () => {
    for (const a of Object.values(PROVINCES)) {
      for (let i = 1; i < samples.length; i++) {
        const d = provinceWeightFromField(samples[i], a, 1) - provinceWeightFromField(samples[i - 1], a, 1);
        if (a.polarity > 0) expect(d).toBeGreaterThanOrEqual(-1e-12);
        else expect(d).toBeLessThanOrEqual(1e-12);
      }
    }
  });
  it('Lipschitz: |Δw| ≤ (1−floor)·dial·|Δf| (soft fields stay soft through the map)', () => {
    for (const a of Object.values(PROVINCES))
      for (let i = 1; i < samples.length; i++) {
        const df = samples[i] - samples[i - 1];
        const dw = Math.abs(provinceWeightFromField(samples[i], a, 1) - provinceWeightFromField(samples[i - 1], a, 1));
        expect(dw).toBeLessThanOrEqual((1 - a.floor) * df + 1e-12);
      }
  });
  it('frost is neutral (floor 1.0 ⇒ w ≡ 1 at any dial) — climate stays unprovinced', () => {
    for (const dial of [0, 0.5, 1])
      for (const f of samples) expect(provinceWeightFromField(f, PROVINCES.frost, dial)).toBe(1);
  });
});
