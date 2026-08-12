// tests/worldengine-e1-regime.test.js — World Engine V2-1 AC2 (Slice B).
//
// Emission completeness + determinism + label-invariant + shadow-namespace discipline for computeE1.
//   • Full signed tuple on every one of the 17 presets × seeds {1,2,3,7,42}; effectiveL present ONLY on a
//     seeded-'stagnant' pick.
//   • identical (vector, macroSeed) → byte-identical output (pure function).
//   • label is a pure function of (compositionClass, geodynamicRegime) — OUTPUT-only; NO code path reads it.
//   • 'e1:' alea namespace disjoint from the four in-use writer namespaces; no Math.random / Date.now; no
//     archetype-string input (AC-0 check 1).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { computeE1, MOBILE_L, inSeededBand } from '../src/worldengine/base/e1Regime.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { DRIVER_PRESETS } from '../driver-presets.js';

const SEEDS = [1, 2, 3, 7, 42];
const TUPLE_KEYS = ['compositionClass', 'geodynamicRegime', 'label', 'L', 'Φ', 'V', 'n', 'm_hp', 'e1Seed', 'positionWithinRegime'];
const REGIMES = new Set(['mobile', 'episodic', 'stagnant', 'heat-pipe', 'dead-lid', 'icy']);
const CLASSES = new Set(['gas', 'carbon', 'icy', 'rocky']);

const vec = (name) => { const fp = DRIVER_PRESETS[name]; return deriveConditionVector(fp, null, fp.radiusEarth); };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.resolve(__dirname, '../src/worldengine/base/e1Regime.js'), 'utf8');
// Grep the CODE, not the documentation: strip block + line comments (the header legitimately NAMES the
// forbidden patterns — "NO Math.random", "e1.label is OUTPUT-only", "reads NO archetype" — as prohibitions).
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('V2-1 AC2 — computeE1 emission completeness (17 presets × 5 seeds)', () => {
  for (const name of Object.keys(DRIVER_PRESETS)) {
    for (const seed of SEEDS) {
      it(`"${name}" @ seed ${seed}: full signed tuple present + well-typed`, () => {
        const e = computeE1(vec(name), seed);
        for (const k of TUPLE_KEYS) expect(e, k).toHaveProperty(k);
        expect(CLASSES.has(e.compositionClass), e.compositionClass).toBe(true);
        expect(REGIMES.has(e.geodynamicRegime), e.geodynamicRegime).toBe(true);
        expect(typeof e.L).toBe('number');
        expect(typeof e.Φ).toBe('number');
        expect(typeof e.V).toBe('number');
        expect(typeof e.n).toBe('number');
        expect(Number.isInteger(e.n)).toBe(true);
        expect(typeof e.m_hp).toBe('number');
        expect(e.positionWithinRegime).toBeGreaterThanOrEqual(0);
        expect(e.positionWithinRegime).toBeLessThan(1);
        expect(e.e1Seed).toBe(seed >>> 0);
        // effectiveL is a CONDITIONAL member: present iff a seeded-'stagnant' pick fired (in-band body).
        // (Venus reads 'stagnant' via the deterministic hot-strong EDGE, not a seeded pick → NO effectiveL.)
        if (e.effectiveL !== undefined) {
          expect(e.geodynamicRegime).toBe('stagnant');
          expect(e.effectiveL).toBeGreaterThanOrEqual(0.60);
          expect(e.effectiveL).toBeLessThanOrEqual(0.66);
        }
      });
    }
  }
});

describe('V2-1 AC2 — determinism (pure function)', () => {
  it('identical (vector, macroSeed) → deeply-equal output for every preset × seed', () => {
    for (const name of Object.keys(DRIVER_PRESETS)) {
      const v = vec(name);
      for (const seed of SEEDS) {
        expect(computeE1(v, seed)).toEqual(computeE1(v, seed));
      }
    }
  });

  it('e1Seed is the integer macroSeed (>>>0), stable across the sweep', () => {
    const v = vec('Rocky (Earthlike)');
    for (const seed of [0, 1, 42, 4294967295]) expect(computeE1(v, seed).e1Seed).toBe(seed >>> 0);
  });
});

describe('V2-1 AC2 — label is OUTPUT-only (no branch reads it)', () => {
  it('label is a pure function of (compositionClass, geodynamicRegime) — carries no independent signal', () => {
    for (const name of Object.keys(DRIVER_PRESETS)) {
      for (const seed of SEEDS) {
        const e = computeE1(vec(name), seed);
        expect(e.label).toBe(`${e.compositionClass}/${e.geodynamicRegime}`);
      }
    }
  });

  it('the module CODE never READS a .label property (label is written + returned, never consumed)', () => {
    expect(CODE.includes('.label')).toBe(false);                 // no property read anywhere
    expect(/\blabel\s*[=!]==|[=!]==\s*label\b|\blabel\s*&&|\blabel\s*\?/.test(CODE)).toBe(false); // no branch on label
  });
});

describe('V2-1 AC2 — shadow discipline (namespace / rng / no-archetype grep)', () => {
  it("uses the NEW 'e1:regime:' alea namespace, disjoint from the four in-use writer namespaces", () => {
    expect(CODE.includes("alea('e1:regime:'")).toBe(true);
    for (const ns of ['magma:', 'plates:', 'shell:', 'stagnant:']) {
      expect(CODE.includes(`alea('${ns}`)).toBe(false);          // no collision with a writer namespace
      expect('e1:'.startsWith(ns) || ns.startsWith('e1:')).toBe(false); // prefix-disjoint
    }
  });

  it('no Math.random / no Date.now (seeded determinism only)', () => {
    expect(CODE.includes('Math.random')).toBe(false);
    expect(CODE.includes('Date.now')).toBe(false);
  });

  it('reads NO archetype input (AC-0 check 1): CODE references neither archetype nor PRESET_ARCHETYPE', () => {
    expect(/archetype/i.test(CODE)).toBe(false);
    // and computeE1 yields a full tuple from a vector that carries no archetype key
    const bare = { T_eq: 288, density: 5.5, composition: { volatileFraction: 0.15, density: 5.5 },
                   surfaceGravity: 0.9, radiusEarth: 1.0, age: 4.5, rawTidalIoRatio: 0, atmosphere: null };
    const e = computeE1(bare, 1);
    for (const k of TUPLE_KEYS) expect(e).toHaveProperty(k);
  });
});

// ── V2-3 Slice A (AC-FLIP partial + AC-PLUMB-RECONCILE b) — the dispatch-facing surface computeE1 grows:
//    shellSubRegime (conditional icy sub-tag, §7) + the MOBILE_L / inSeededBand exports. Same real-derivation
//    discipline as the blocks above: deriveConditionVector over DRIVER_PRESETS, never hand-set tuples. ──
describe('V2-3 Slice A — shellSubRegime is the condition-derived icy sub-tag (conditional tuple member)', () => {
  it("Europa (icy moon): shellSubRegime === 'icy-active' (tidally ACTIVE shell) at every seed", () => {
    for (const seed of SEEDS) {
      const e = computeE1(vec('Europa (icy moon)'), seed);
      expect(e.compositionClass).toBe('icy');
      expect(e.geodynamicRegime).toBe('icy');
      expect(e.shellSubRegime).toBe('icy-active');
    }
  });

  it("Titan (methane seas): shellSubRegime === 'volatile-cold' (methane window, NOT tidally active) at every seed", () => {
    for (const seed of SEEDS) {
      const e = computeE1(vec('Titan (methane seas)'), seed);
      expect(e.compositionClass).toBe('icy');
      expect(e.geodynamicRegime).toBe('icy');
      expect(e.shellSubRegime).toBe('volatile-cold');
    }
  });

  it('Europa ≠ Titan sub-regimes (the MF-2 coarse-tuple collapse is resolved by the sub-tag)', () => {
    expect(computeE1(vec('Europa (icy moon)'), 1).shellSubRegime)
      .not.toBe(computeE1(vec('Titan (methane seas)'), 1).shellSubRegime);
  });

  it('Frozen (airless): dead-lid icy carries NO shellSubRegime property (conditional member OMITTED)', () => {
    for (const seed of SEEDS) {
      const e = computeE1(vec('Frozen (airless)'), seed);
      expect(e.compositionClass).toBe('icy');
      expect(e.geodynamicRegime).toBe('dead-lid');
      expect(e).not.toHaveProperty('shellSubRegime');
    }
  });

  it('Rocky (Earthlike): a non-icy body carries NO shellSubRegime property', () => {
    for (const seed of SEEDS) {
      const e = computeE1(vec('Rocky (Earthlike)'), seed);
      expect(e.compositionClass).toBe('rocky');
      expect(e).not.toHaveProperty('shellSubRegime');
    }
  });
});

describe('V2-3 Slice A — MOBILE_L + inSeededBand exports (dispatch plumbing)', () => {
  it('MOBILE_L is exported === 0.35 (the R-A3 promotion — single source of truth, no value change)', () => {
    expect(MOBILE_L).toBe(0.35);
  });

  it('inSeededBand is an exported function: Rocky (Earthlike) IN-band, Mars (arid rocky) OUT-of-band', () => {
    expect(typeof inSeededBand).toBe('function');
    // Rocky: mass 0.9 ∈ [0.6,1.6], T_eq 288 ∈ [250,320], V 0.15 ≥ 0.12 → in the seeded band.
    expect(inSeededBand(vec('Rocky (Earthlike)'))).toBe(true);
    // Mars: massEarthOf(cv) = g·d² = 0.107 < MASS_LO 0.6 → out of the seeded band.
    expect(inSeededBand(vec('Mars (arid rocky)'))).toBe(false);
  });
});
