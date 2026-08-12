// tests/worldengine-v2-3-taxonomy.test.js — World Engine V2-3 Slice C (AC-TAXONOMY-NEPTUNE, plan §8).
//
// NEPTUNIAN/SUB-NEPTUNE SHORT-KEY COLLISION RESOLVED WITH ZERO VISIBLE CHANGE — Option B
// (documented shared key, MF#2). Both presets keep the 'sub-neptune' PRESET_ARCHETYPE key as an
// EXPLICITLY-SHARED taxonomy identity:
//
//   • RADIUS RESOLUTION BYTE-EQUAL PRE/POST: both Neptunes resolve the SAME
//     RADIUS_RANGES_EARTH['sub-neptune'] entry, pinned to the pre-flip [2.5, 4.0] via the REAL
//     src/core/ScaleConstants.js import — the ROADMAP §3.1 hazard (Neptunian demoted to
//     'gas-giant' [6.0, 14.0] → a Jupiter-sized seeded Neptunian) cannot fire.
//   • WRITER ROUTES UNCHANGED: despun both ways for both presets — the legacy archetype chain
//     (the four exported predicates in bridge order) AND the real flipped writeBodyRelief on a
//     condition-bearing bundle agree.
//   • PRESET_ARCHETYPE SNAPSHOT UNCHANGED: the map still deep-equals the frozen ad156cc fixture
//     (Option B touches comments only); 15 keys; Mars stays OUT (RG2 resolution, plan §10#1 —
//     Mars adjudicates via the 17-oracle DRIVER_PRESETS iteration, never the map).
//   • SHARED KEY DOCUMENTED: the §8 doc comment marking the shared taxonomy identity exists in
//     driver-presets.js, inside the PRESET_ARCHETYPE literal (AC-TAXONOMY-NEPTUNE's "kept key…
//     explicitly documented as shared taxonomy" path).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { RADIUS_RANGES_EARTH } from '../src/core/ScaleConstants.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { TARGET_N, LLOYD, QUALITY_TIER } from './fixtures/v2-0-carrier-golden.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEPTUNES = ['Ice giant (Neptunian)', 'Sub-Neptune (hazy)'];
const SHARED_KEY = 'sub-neptune';
const PRE_FLIP_RANGE = [2.5, 4.0];        // the pre-flip pin (Neptune = 3.88 R⊕ inside it)
const HAZARD_RANGE = [6.0, 14.0];         // the ROADMAP 'gas-giant' hazard that must NOT fire

describe('V2-3 AC-TAXONOMY-NEPTUNE — radius resolution byte-equal pre/post (real ScaleConstants pin)', () => {
  it('both Neptunes map to the shared key and resolve RADIUS_RANGES_EARTH to the pre-flip [2.5, 4.0]', () => {
    for (const name of NEPTUNES) {
      expect(PRESET_ARCHETYPE[name], `${name} archetype key`).toBe(SHARED_KEY);
      const range = RADIUS_RANGES_EARTH[PRESET_ARCHETYPE[name]];
      expect(range, `${name} resolved radius range`).toEqual(PRE_FLIP_RANGE);
    }
  });

  it('the resolution is ONE shared entry (identical object), so the two draws can never diverge', () => {
    const a = RADIUS_RANGES_EARTH[PRESET_ARCHETYPE[NEPTUNES[0]]];
    const b = RADIUS_RANGES_EARTH[PRESET_ARCHETYPE[NEPTUNES[1]]];
    expect(a).toBe(b);   // same array reference — a single taxonomy identity, not two copies
  });

  it("the ROADMAP [6.0, 14.0] hazard cannot fire: neither Neptune resolves 'gas-giant'", () => {
    for (const name of NEPTUNES) {
      expect(PRESET_ARCHETYPE[name], name).not.toBe('gas-giant');
      expect(RADIUS_RANGES_EARTH[PRESET_ARCHETYPE[name]], name).not.toEqual(HAZARD_RANGE);
    }
    // and the hazard range itself is still what the hazard claims (the pin is not vacuous):
    expect(RADIUS_RANGES_EARTH['gas-giant']).toEqual(HAZARD_RANGE);
  });
});

describe('V2-3 AC-TAXONOMY-NEPTUNE — writer routes unchanged (despun both Neptunes)', () => {
  // (PRESET_ARCHETYPE-retirement, 2026-07-13) the legacy classifyWriterPath chain (four now-DELETED predicates)
  // is retired; the LIVE derived dispatch already proves both Neptunes route despun, pinned below.

  // condition-BEARING production-shaped bundle (mirrors the 17-oracle's bundle17)
  const MESH = buildIrregularSphere(TARGET_N, LLOYD);
  function derivedPath(name, seed) {
    const fp = DRIVER_PRESETS[name];
    const u = deriveUniforms(fp, QUALITY_TIER);
    const carrier = makeSphereField(MESH);
    return writeBodyRelief(carrier, {
      archetype: PRESET_ARCHETYPE[name] ?? null,
      locked: !!(fp && fp.tidalState && fp.tidalState.locked),
      grainDrivers: DEFAULT_GRAIN_DRIVERS,
      bodyDrivers: {
        ...buildNeutralBodyDrivers(u, fp),
        condition: deriveConditionVector(fp, u, fp.radiusEarth),
      },
      macroSeed: seed,
      heightSeed: 'e6:' + (seed | 0),
      T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
    }).path;
  }

  for (const name of NEPTUNES) {
    it(`"${name}": derived dispatch routes despun (pinned; radius is the taxonomy's real concern, other describes)`, () => {
      expect(derivedPath(name, 1), `${name} derived route`).toBe('despun');   // LIVE derived dispatch (pinned 'despun')
    });
  }
});

describe('V2-3 AC-TAXONOMY-NEPTUNE — PRESET_ARCHETYPE snapshot unchanged (Option B is comment-only)', () => {
  it('deep-equals the frozen ad156cc fixture (the v2-0-slice-a-byte-safety pin stays green)', () => {
    const PA_SNAPSHOT = JSON.parse(
      readFileSync(path.resolve(__dirname, 'fixtures', 'v2-0-preset-archetype.ad156cc.json'), 'utf8'));
    expect(PRESET_ARCHETYPE).toEqual(PA_SNAPSHOT);
  });

  it('still exactly 15 keys; Mars stays OUT of the map (RG2: oracle-row-only adjudication)', () => {
    expect(Object.keys(PRESET_ARCHETYPE).length).toBe(15);
    expect(PRESET_ARCHETYPE).not.toHaveProperty('Mars (arid rocky)');
    expect(PRESET_ARCHETYPE).not.toHaveProperty('Hot Jupiter (locked giant)');
  });
});

describe('V2-3 AC-TAXONOMY-NEPTUNE — the shared key is explicitly documented (the §8 doc comment)', () => {
  const SRC = readFileSync(fileURLToPath(new URL('../driver-presets.js', import.meta.url)), 'utf8');

  it('driver-presets.js carries the SHARED TAXONOMY IDENTITY doc comment inside the PRESET_ARCHETYPE literal', () => {
    const start = SRC.indexOf('export const PRESET_ARCHETYPE');
    expect(start, 'PRESET_ARCHETYPE literal found').toBeGreaterThan(-1);
    const end = SRC.indexOf('};', start);
    expect(end, 'PRESET_ARCHETYPE literal closes').toBeGreaterThan(start);
    const literal = SRC.slice(start, end);
    // the documented-shared-key markers (AC-TAXONOMY-NEPTUNE's "explicitly documented as shared taxonomy"):
    expect(literal).toMatch(/AC-TAXONOMY-NEPTUNE/);
    expect(literal).toMatch(/SHARED TAXONOMY IDENTITY/);
    expect(literal).toMatch(/INTENTIONALLY share/);
    // the comment names the pinned range and the hazard it forecloses:
    expect(literal).toMatch(/\[2\.5,\s*4\.0\]/);
    expect(literal).toMatch(/\[6\.0,\s*14\.0\]/);
    // and it sits with the two entries it documents:
    expect(literal).toMatch(/'Ice giant \(Neptunian\)':\s*'sub-neptune'/);
    expect(literal).toMatch(/'Sub-Neptune \(hazy\)':\s*'sub-neptune'/);
  });
});
