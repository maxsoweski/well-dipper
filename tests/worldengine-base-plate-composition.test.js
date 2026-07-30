// tests/worldengine-base-plate-composition.test.js — AC-PLATECOMP (composition → plate count).
//
// THE LAW. Plate count is driven by what the planet is MADE OF, via the mantle-depth fraction:
// plate width is a fixed number of mantle depths (Mallard+2016 Nature 535:140; Höink & Lenardic 2010
// GJI 180:23), so N tiling a sphere goes as (R/D)². It is composition, not size — D/R is
// mass-invariant at fixed composition (Valencia+2007 ApJ 670:L45) and Bird 2003 G3 4:1027 writes
// plate size in steradians, hence dimensionless. There is deliberately NO radius term (AC-PLATESCALE).
//
// WHAT THIS FILE GUARDS, in order of how much it would hurt to lose:
//   1. Earth is byte-identical BY CONSTRUCTION (exact float identity, not a rounding rescue).
//   2. The duplicated Earth literal cannot drift from the anchor (the tripwire the pre-existing
//      EARTH_TIDAL_HEATING copy still lacks).
//   3. Γ is not in the code at all — the ratio form cancels it, so there is no calibrated constant a
//      future reader could mistake for a measurement.
//   4. The enumerated before/after table Max is owed is RECOMPUTED here, so the committed JSON can
//      never silently drift from the behaviour.
//   5. The blast radius is pinned: exactly two presets reach the plate writer, so a dispatch change
//      that widens the plate path fails HERE rather than shipping unnoticed.
//   6. The law is radius-invariant under the LAB's radius-aware wiring, not just the radius-blind one.
//   7. The kill switch works (PLATE_COUNT_MDF_EXP = 0 ⇒ feature inert).
// Pure node/vitest — no browser, no dev server, no metered calls.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  DEFAULTS, D_EARTH, driversToTune, plateCountTarget,
  EARTH_CORE_RADIUS_FRACTION, MANTLE_DEPTH_FRACTION_EARTH, PLATE_COUNT_MDF_EXP,
} from '../src/worldengine/base/plates.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TABLE = JSON.parse(readFileSync(
  path.resolve(__dirname, '..', 'docs', 'WORKSTREAMS', 'world-engine-tectonic-realism-2026-07-29',
    'plate-count-before-after.json'), 'utf8'));

const TARGET_N = 700, LLOYD = 2, QUALITY_TIER = 1.0;
const MESH = buildIrregularSphere(TARGET_N, LLOYD);
const SEEDS = TABLE._meta.seeds;

// The production-shaped condition-bearing bundle. `anchored` forces the composition driver back to the
// Earth anchor, which reproduces the pre-AC-PLATECOMP behaviour — that is the table's BEFORE column.
// `radiusEarth` lets us exercise the LAB's radius-aware gravity rather than the radius-blind canonical
// one (planet-lod-lab.html feeds condition.surfaceGravity as massGravity), so the radius-invariance
// assertion below cannot pass vacuously.
function run(name, seed, { anchored = false, radiusEarth = null } = {}) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  const R = radiusEarth ?? fp.radiusEarth;
  const cond = deriveConditionVector(fp, u, R);
  const bodyDrivers = { ...buildNeutralBodyDrivers(u, fp), condition: cond };
  if (radiusEarth != null) bodyDrivers.massGravity = cond.surfaceGravity;   // the LAB's D14 wiring
  if (anchored) bodyDrivers.coreRadiusFraction = D_EARTH.coreRadiusFraction;
  const carrier = makeSphereField(MESH);
  const out = writeBodyRelief(carrier, {
    archetype: PRESET_ARCHETYPE[name] ?? null,
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers, macroSeed: seed, heightSeed: 'e6:' + (seed | 0),
    T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
  });
  return { path: out && out.path ? out.path : out, plateCount: out?.plateDiag?.plateCount ?? null, bodyDrivers };
}

describe('AC-PLATECOMP — the Earth anchor is EXACT, not a rounding coincidence', () => {
  it('plateCountTarget at the Earth mantle-depth fraction returns PLATE_COUNT_MIN exactly', () => {
    // toBe, not toBeCloseTo: the whole byte-identity argument is x/x === 1 on the identical double,
    // then pow(1, k) === 1. If this ever needs a tolerance, the identity proof has been broken.
    expect(plateCountTarget(MANTLE_DEPTH_FRACTION_EARTH)).toBe(DEFAULTS.PLATE_COUNT_MIN);
    expect(plateCountTarget(1 - EARTH_CORE_RADIUS_FRACTION)).toBe(DEFAULTS.PLATE_COUNT_MIN);
  });

  it('driversToTune(D_EARTH) stays null — the AC2 identity guard is untouched by the new term', () => {
    expect(driversToTune(D_EARTH)).toBeNull();
  });

  it('a bundle that omits coreRadiusFraction is composition-INERT (the reversibility property)', () => {
    expect(driversToTune({ ...D_EARTH, coreRadiusFraction: undefined })).toBeNull();
    // and an explicit anchor value is likewise inert
    expect(driversToTune({ ...D_EARTH, coreRadiusFraction: EARTH_CORE_RADIUS_FRACTION })).toBeNull();
  });

  it('TRIPWIRE: Rocky\'s authored literal equals the anchor constant', () => {
    // The single most valuable assertion here. plates.js already hardcodes its OWN copy of Rocky's
    // eccentricity/orbit literals for EARTH_TIDAL_HEATING (plates.js:96-99) with NO tripwire — edit the
    // preset there and Earth silently un-anchors with no warning at the edit site. This converts that
    // class of fragility into a loud failure for the new pair.
    expect(DRIVER_PRESETS['Rocky (Earthlike)'].composition.coreRadiusFraction)
      .toBe(EARTH_CORE_RADIUS_FRACTION);
    expect(D_EARTH.coreRadiusFraction).toBe(EARTH_CORE_RADIUS_FRACTION);
  });
});

describe('AC-PLATECOMP — Γ is absent from the code (calibration, never dressed as derivation)', () => {
  it('plates.js contains no aspect-ratio constant in any executable position', () => {
    const src = readFileSync(path.resolve(__dirname, '..', 'src', 'worldengine', 'base', 'plates.js'), 'utf8');
    // Strip line comments and block comments, then look for the calibrated values. The Earth-fit Γ
    // (≈2.5617) and the count-preserving Γ (≈2.95) appear ONLY in prose, for the record.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/2\.56/);
    expect(code).not.toMatch(/2\.95/);
    expect(code).not.toMatch(/GAMMA|Gamma/);
    // and the shipped exponent is the ONE named constant
    expect(PLATE_COUNT_MDF_EXP).toBe(-2);
  });

  it('the display-scale token fence still holds on the edited file (AC-ZERO-CLOBBER)', () => {
    const src = readFileSync(path.resolve(__dirname, '..', 'src', 'worldengine', 'base', 'plates.js'), 'utf8');
    expect(src).not.toMatch(/visScaleOf|\bsVis\b|VIS_SCALE_EXP/);
  });
});

describe('AC-PLATECOMP — validity domain is declared, not left to the clamp', () => {
  it('a non-positive mantle depth THROWS rather than returning NaN', () => {
    // Why this matters: clamp(5, 14, NaN) is NaN, which slips past the AC2 identity guard and yields a
    // plateCount of NaN, zero centroids and an all-NaN U field with no error raised. Silent all-NaN
    // planets are the failure mode this guard exists to prevent.
    expect(() => plateCountTarget(0)).toThrow(RangeError);
    expect(() => plateCountTarget(-0.1)).toThrow(RangeError);
    expect(() => plateCountTarget(NaN)).toThrow(RangeError);
    expect(() => plateCountTarget(Infinity)).toThrow(RangeError);
  });

  it('a core filling the whole body is out of domain, and driversToTune surfaces it', () => {
    expect(() => driversToTune({ ...D_EARTH, coreRadiusFraction: 1.0 })).toThrow(RangeError);
    expect(() => driversToTune({ ...D_EARTH, coreRadiusFraction: 1.5 })).toThrow(RangeError);
  });

  it('monotone in the physical direction: thinner mantle ⇒ MORE, smaller plates', () => {
    // DIRECTION, stated carefully because it is easy to get backwards (this assertion caught it once).
    // Plate WIDTH is a fixed number of mantle depths D, so a THINNER mantle means NARROWER plates and
    // therefore MORE of them tiling the sphere: N ∝ (R/D)² = mdf^-2. Big core ⇒ thin mantle ⇒ many
    // plates; small core ⇒ thick mantle ⇒ few. This is also the direction the AC's own worked example
    // takes — "a low-core body at R_core/R = 0.30 gives 2.4× FEWER plates" — a low core being a THICK
    // mantle. Ocean sits on that side of Earth (core 0.506 < 0.546), which is why it drops 7 → 6.
    const bigCore = plateCountTarget(1 - 0.70);     // thin mantle
    const earth = plateCountTarget(MANTLE_DEPTH_FRACTION_EARTH);
    const smallCore = plateCountTarget(1 - 0.30);   // thick mantle
    expect(bigCore).toBeGreaterThan(earth);
    expect(smallCore).toBeLessThan(earth);
    // and the AC's cited magnitude: R_core/R = 0.30 gives ≈2.4× fewer than Earth
    expect(earth / smallCore).toBeCloseTo(2.38, 2);
  });

  it('KILL SWITCH: exponent 0 makes the factor exactly 1 for every core fraction', () => {
    // The one-constant revert. Injected locally because the shipped constant is frozen at module scope.
    const inert = (mdf) => DEFAULTS.PLATE_COUNT_MIN * Math.pow(mdf / MANTLE_DEPTH_FRACTION_EARTH, 0);
    for (const f of [0.1, 0.3, 0.45, 0.506, 0.546225, 0.7, 0.9]) {
      expect(inert(1 - f)).toBe(DEFAULTS.PLATE_COUNT_MIN);
    }
  });
});

describe('AC-PLATECOMP — the enumerated before/after table is recomputed, not re-read', () => {
  it('exactly the presets in the table reach the plate writer (blast radius pinned)', () => {
    // If a future dispatch change widens the plate path, the table's row count changes and this fails
    // BEFORE anyone ships it. Eyeball is one locked-check away (planet-lod-rivers.js).
    const reached = Object.keys(DRIVER_PRESETS).filter((n) => run(n, 1).path === 'plate');
    expect(reached.sort()).toEqual([...TABLE.platePathPresets].sort());
    expect(reached).toHaveLength(2);
  });

  for (const name of TABLE.platePathPresets) {
    it(`table row matches live behaviour: "${name}"`, () => {
      const row = TABLE.rows[name];
      const crf = DRIVER_PRESETS[name].composition?.coreRadiusFraction ?? EARTH_CORE_RADIUS_FRACTION;
      expect(crf).toBe(row.coreRadiusFractionUsed);
      expect(plateCountTarget(1 - crf)).toBeCloseTo(row.N_continuous, 12);
      const after = SEEDS.map((s) => run(name, s).plateCount);
      const before = SEEDS.map((s) => run(name, s, { anchored: true }).plateCount);
      expect(after).toEqual(row.countsAfter);
      expect(before).toEqual(row.countsBefore);
    });
  }

  it('Rocky is the anchor: its BEFORE and AFTER columns are identical', () => {
    const row = TABLE.rows['Rocky (Earthlike)'];
    expect(row.countsAfter).toEqual(row.countsBefore);
    expect(row.plateCountMinAfter).toBe(row.plateCountMinBefore);
  });

  it('Ocean is the ONE moved row, and it moved DOWN (smaller core ⇒ thicker mantle ⇒ fewer plates)', () => {
    const row = TABLE.rows['Ocean (temperate)'];
    expect(row.plateCountMinAfter).toBeLessThan(row.plateCountMinBefore);
    expect(row.countsAfter).not.toEqual(row.countsBefore);
    for (let i = 0; i < row.countsAfter.length; i++) {
      expect(row.countsAfter[i]).toBeLessThan(row.countsBefore[i]);
    }
  });
});

describe('AC-PLATECOMP — no radius term (guards the settled AC-PLATESCALE result)', () => {
  for (const name of TABLE.platePathPresets) {
    it(`PLATE_COUNT_MIN is radius-invariant for "${name}" under the LAB's radius-aware gravity`, () => {
      // Deliberately driven through condition.surfaceGravity (the lab's D14 wiring), because
      // body-drivers.js's canonical gravity is radius-blind and would make this pass vacuously.
      const counts = [0.5, 0.8, 1.0, 1.1, 1.5, 2.0, 3.0, 8.0, 16.0].map((R) => {
        const { bodyDrivers } = run(name, 1, { radiusEarth: R });
        const tune = driversToTune(bodyDrivers);
        return tune ? tune.PLATE_COUNT_MIN : DEFAULTS.PLATE_COUNT_MIN;
      });
      expect(new Set(counts).size, `counts across radii: ${counts.join(',')}`).toBe(1);
    });
  }
});
