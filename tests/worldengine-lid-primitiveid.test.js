// tests/worldengine-lid-primitiveid.test.js — World Engine V2-2a Slice C.
//
// AC-PRIMITIVEID-SCHEMA: the primitiveId INSTRUMENT SCHEMA is authored + exported, byte-safe.
//   • PRIMITIVE_ID enum + FAMILY + familyOf are exported constants BESIDE writeLidResponseSphere
//     (src/worldengine/base/lidResponse.js), importable by the (V2-2b) mixed writer + the (V2-2b) gate-3 metric.
//   • LOAD-BEARING (gate-3 Open-Q2): lava-plain and stagnant-basaltic-plain are DISTINCT ids, with familyOf
//     routing lava-plain → PIERCE(1) and stagnant-basaltic-plain → TENT(0) — else the Io-vs-Venus contrast
//     blurs at the exact seam the interpenetration statistic guards.
//   • The OPTIONAL uniform per-node corner emit is a NEW router RETURN field (Int32Array), NOT one of the 5
//     hashed carrier fields (height/grainAngle/grainMag/regime/faultDensity) — so routing a body WITH the emit
//     leaves the 5 hashed carrier fields byte-identical to the direct (un-emitted) corner call (R-C4).
import { describe, it, expect } from 'vitest';
import { PRIMITIVE_ID, FAMILY, familyOf, writeLidResponseSphere } from '../src/worldengine/base/lidResponse.js';
import { writeMagmatismSphere, magmaDriversToTune } from '../src/worldengine/base/magmatism.js';
import { writeStagnantLidReliefSphere } from '../src/worldengine/base/stagnantLid.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { computeE1 } from '../src/worldengine/base/e1Regime.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { buildBundle, TARGET_N, LLOYD, SEEDS, HASHED_FIELDS } from './fixtures/v2-0-carrier-golden.mjs';

// Same deterministic mesh both sides (fibonacci + Lloyd, NO Math.random) — fixtures/v2-0-carrier-golden.mjs:98.
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
const arr = (a) => Array.from(a);
const PIERCE_KEYS = ['shield', 'caldera', 'patera', 'lava-plain'];
const TENT_KEYS = ['corona', 'tessera', 'rift', 'stagnant-basaltic-plain'];

// ── The exported schema ────────────────────────────────────────────────────────────────────────────────
describe('V2-2a AC-PRIMITIVEID-SCHEMA — enum + familyOf exported, correctly split into PIERCE / TENT', () => {
  it('PRIMITIVE_ID + FAMILY are FROZEN exported constants (PIERCE=1, TENT=0)', () => {
    expect(Object.isFrozen(PRIMITIVE_ID), 'PRIMITIVE_ID frozen').toBe(true);
    expect(Object.isFrozen(FAMILY), 'FAMILY frozen').toBe(true);
    expect(FAMILY).toEqual({ TENT: 0, PIERCE: 1 });
  });

  it('lava-plain and stagnant-basaltic-plain are DISTINCT ids (gate-3 Open-Q2 — do NOT lump)', () => {
    expect(PRIMITIVE_ID['lava-plain'], 'lava-plain defined').toBeTypeOf('number');
    expect(PRIMITIVE_ID['stagnant-basaltic-plain'], 'stagnant-basaltic-plain defined').toBeTypeOf('number');
    expect(PRIMITIVE_ID['lava-plain']).not.toBe(PRIMITIVE_ID['stagnant-basaltic-plain']);
  });

  it('familyOf routes lava-plain → PIERCE(1) and stagnant-basaltic-plain → TENT(0)', () => {
    expect(familyOf(PRIMITIVE_ID['lava-plain']), 'lava-plain → PIERCE').toBe(FAMILY.PIERCE);
    expect(familyOf(PRIMITIVE_ID['lava-plain'])).toBe(1);
    expect(familyOf(PRIMITIVE_ID['stagnant-basaltic-plain']), 'basaltic-plain → TENT').toBe(FAMILY.TENT);
    expect(familyOf(PRIMITIVE_ID['stagnant-basaltic-plain'])).toBe(0);
  });

  it('the whole enum splits exactly: shield/caldera/patera/lava-plain → PIERCE, corona/tessera/rift/basaltic-plain → TENT', () => {
    for (const k of PIERCE_KEYS) expect(familyOf(PRIMITIVE_ID[k]), `${k} → PIERCE`).toBe(FAMILY.PIERCE);
    for (const k of TENT_KEYS) expect(familyOf(PRIMITIVE_ID[k]), `${k} → TENT`).toBe(FAMILY.TENT);
  });
});

// ── The optional uniform corner emit: a NEW field, byte-safe vs the un-emitted direct corner call ────────
describe('V2-2a AC-PRIMITIVEID-SCHEMA — uniform corner emit is a NEW field; the 5 hashed carrier fields stay byte-identical', () => {
  for (const seed of SEEDS) {
    it(`pure-weak (Lava): primitiveId = uniform lava-plain (PIERCE); 5 hashed fields === writeMagmatismSphere direct (seed ${seed})`, () => {
      const b = buildBundle('Lava (hot airless)', seed);
      const T_ss = b.locked ? (b.T_eq ?? 0) * 1.4 : 0;                 // rivers:476 verbatim
      const e1 = computeE1(b.bodyDrivers.condition, seed);
      const rawTidal = b.bodyDrivers.condition.rawTidalIoRatio;
      // router (WITH the emit)
      const cA = carrierOf();
      const rA = writeLidResponseSphere(cA, b.bodyDrivers, { e1, rawTidal, macroSeed: seed, locked: b.locked, T_ss, grainDrivers: b.grainDrivers });
      expect(rA.fineClass).toBe('pure-weak');
      // direct corner (un-emitted reference — writeMagmatismSphere returns no primitiveId)
      const cB = carrierOf();
      writeMagmatismSphere(cB, b.bodyDrivers, { macroSeed: seed, locked: b.locked, T_ss, tune: magmaDriversToTune(b.bodyDrivers) });
      // the emit is a NEW return field, uniform lava-plain, sized to the node count
      expect(rA.primitiveId, 'primitiveId is an Int32Array').toBeInstanceOf(Int32Array);
      expect(rA.primitiveId.length, 'sized to node count').toBe(cA.count);
      expect([...new Set(arr(rA.primitiveId))], 'a single uniform id').toEqual([PRIMITIVE_ID['lava-plain']]);
      expect(arr(rA.primitiveId).every((id) => familyOf(id) === FAMILY.PIERCE), 'all PIERCE family').toBe(true);
      // primitiveId is a RETURN field, NOT a carrier field, and NOT one of the 5 hashed fields
      expect(HASHED_FIELDS).not.toContain('primitiveId');
      expect(cA.primitiveId, 'primitiveId never written onto the carrier').toBeUndefined();
      // the 5 hashed carrier fields are byte-identical to the un-emitted direct call
      for (const f of HASHED_FIELDS) expect(arr(cA[f]), `carrier.${f} byte-identical`).toEqual(arr(cB[f]));
    });
  }

  for (const seed of SEEDS) {
    it(`pure-strong (Venus): primitiveId = uniform basaltic-plain (TENT); 5 hashed fields === writeStagnantLidReliefSphere direct (seed ${seed})`, () => {
      const b = buildBundle('Venus (sulfuric shroud)', seed);
      const e1 = computeE1(b.bodyDrivers.condition, seed);
      const rawTidal = b.bodyDrivers.condition.rawTidalIoRatio;
      const cA = carrierOf();
      const rA = writeLidResponseSphere(cA, b.bodyDrivers, { e1, rawTidal, macroSeed: seed, locked: b.locked, T_ss: 0, grainDrivers: b.grainDrivers });
      expect(rA.fineClass).toBe('pure-strong');
      const cB = carrierOf();
      writeStagnantLidReliefSphere(cB, b.grainDrivers, { macroSeed: seed, regime: 'venus-stagnant-lid' });
      expect(rA.primitiveId, 'primitiveId is an Int32Array').toBeInstanceOf(Int32Array);
      expect(rA.primitiveId.length, 'sized to node count').toBe(cA.count);
      expect([...new Set(arr(rA.primitiveId))], 'a single uniform id').toEqual([PRIMITIVE_ID['stagnant-basaltic-plain']]);
      expect(arr(rA.primitiveId).every((id) => familyOf(id) === FAMILY.TENT), 'all TENT family').toBe(true);
      expect(cA.primitiveId, 'primitiveId never written onto the carrier').toBeUndefined();
      for (const f of HASHED_FIELDS) expect(arr(cA[f]), `carrier.${f} byte-identical`).toEqual(arr(cB[f]));
    });
  }
});
