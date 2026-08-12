// tests/worldengine-v2-6-crystal.test.js — World Engine V2-6 SLICE-4 (Crystal carve-out; §1F / AC-CRYSTAL).
//
// AC-CRYSTAL closes 4 of its 5 clauses HERE (unit); the 5th — extreme-agreement with the old boolean — is
// `deferred-to-adjudication` (Lens L9, BLOCKER carve): the presets are condition-scalar DEGENERATE where the old
// boolean discriminated, so the honest count-law derivation INVERTS Crystal's ranking (Crystal, the sole
// boolean-TRUE, derives BELOW Moon/Frozen; Carbon derives ≈max while boolean-false). No condition scalar repairs
// the split. This slice ships the scalar + the decision artifact (calibration/crystal-scalar.mjs); it pins NO
// CRYSTAL_HI/CRYSTAL_LO thresholds and does NOT flip the lab `_facetClass` block — building any such workaround is
// a HARD STOP (§4 ADJUDICATION GATE). The clauses asserted below:
//
//   PURITY      — crystallizationPotential + its sub-scalars read ONLY condition scalars + the passed schedule;
//                 no label / archetype / regime / PRESET_ARCHETYPE read, no computeE1/e1Regime substring.
//   CONTINUITY  — the scalar is finite and ∈ [0,1] across a synthetic condition × schedule sweep.
//   WIRING      — bombardmentIntensity is derived from the PASSED craterSchedule (explicit-parameter construction),
//                 and a radiusEarth perturbation moves the potential THROUGH that schedule (nAnalytic ∝ R²). The
//                 gravity spy is DELETED: post-K_GD dN/dg = 0 by design (AC-GCOUNT), so a gravity spy could only
//                 pass against wrong physics (Lens L10).
//   CHANNEL     — relief.surfaceMaterial carries EXACTLY { iceness, crystallizationPotential, regolithRoughness }.
//   DEFAULT-BAKE— the default headless bake never applies a facet weight (Max ruling #2 — crystal out of the
//                 default bake): the return-object channel is byte-inert and carries no facet field.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  crystallizationPotential, airlessnessOf, resurfacingRateOf, bombardmentIntensityOf,
  deriveSurfaceMaterial, icenessOf, N_BOMB_REF,
} from '../src/worldengine/base/surfaceMaterial.js';
import { craterSchedule } from '../src/worldengine/base/bombardment.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A synthetic airless impact-surface condition, parameterized by (R, td, age, P) — the crystal-relevant scalars.
const cond = ({ R = 0.5, td = 0, age = 4.5, P = 0, T_eq = 200 } = {}) => ({
  atmosphere: P > 0 ? { pressure: P } : null,
  rawTidalIoRatio: td, T_eq, age, radiusEarth: R, surfaceGravity: 0.277,
  composition: { volatileFraction: 0.02, density: 4.5 },
});
const condOf = (name) => {
  const fp = DRIVER_PRESETS[name];
  return deriveConditionVector(fp, deriveUniforms(fp, 1.0), fp.radiusEarth);
};
function reliefBundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    archetype: null, locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + seed, T_eq: fp.T_eq ?? 288,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-CRYSTAL — purity: the scalar reads only condition scalars + the passed schedule', () => {
  it('surfaceMaterial.js has no label/archetype/regime read and no computeE1/e1Regime substring', () => {
    const src = readFileSync(path.resolve(__dirname, '../src/worldengine/base/surfaceMaterial.js'), 'utf8');
    // strip line-comments so the header's NEGATIVE mentions ("never reads a label / archetype …") don't false-trip
    const code = src.replace(/\/\/[^\n]*/g, '');
    for (const banned of ['.label', 'geodynamicRegime', 'PRESET_ARCHETYPE', 'archetype', 'computeE1', 'e1Regime']) {
      expect(code.includes(banned), `code (comments stripped) is free of "${banned}"`).toBe(false);
    }
  });

  it('the module imports NOTHING (no bombardment import — schedule is an explicit parameter, no ESM cycle)', () => {
    const src = readFileSync(path.resolve(__dirname, '../src/worldengine/base/surfaceMaterial.js'), 'utf8');
    // The real invariant is ZERO import statements (schedule arrives as an explicit parameter) — which subsumes
    // "no bombardment import". (The identifier `bombardmentIntensityOf` deliberately names the churn scalar, so a
    // raw substring grep for "bombardment" is not the right check; the absence of any `import`/`from` line is.)
    expect(/^\s*import\s/m.test(src), 'surfaceMaterial.js has zero import statements').toBe(false);
    expect(/\bfrom\s+['"][^'"]*bombardment/.test(src), 'no import from bombardment.js (no ESM cycle)').toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-CRYSTAL — continuity: crystallizationPotential ∈ [0,1], finite everywhere', () => {
  it('stays in [0,1] and finite across an (R, td, age, P) sweep', () => {
    for (const R of [0.1, 0.38, 0.8, 1.5, 3.0]) {
      for (const td of [0, 0.5, 5, 137]) {
        for (const age of [0, 1.5, 3, 4.5]) {
          for (const P of [0, 0.05, 1, 92]) {
            const c = cond({ R, td, age, P });
            const v = crystallizationPotential(c, craterSchedule(c));
            expect(Number.isFinite(v), `finite at R=${R} td=${td} age=${age} P=${P}`).toBe(true);
            expect(v, `≥0 at R=${R} td=${td} age=${age} P=${P}`).toBeGreaterThanOrEqual(0);
            expect(v, `≤1 at R=${R} td=${td} age=${age} P=${P}`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('sub-scalars are each in [0,1] (so the product is [0,1] by construction)', () => {
    for (const P of [0, 0.05, 0.1, 1, 92]) {
      const a = airlessnessOf(cond({ P }));
      expect(a, `airlessness ∈[0,1] at P=${P}`).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
    for (const td of [0, 1, 137]) for (const age of [0, 4.5, 9]) {
      const r = resurfacingRateOf(cond({ td, age }));
      expect(r, `resurfacingRate ∈[0,1] at td=${td} age=${age}`).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
    for (const n of [0, N_BOMB_REF / 2, N_BOMB_REF, 5 * N_BOMB_REF]) {
      const b = bombardmentIntensityOf({ nAnalytic: n });
      expect(b, `bombardmentIntensity ∈[0,1] at n=${n}`).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-CRYSTAL — wiring: bombardmentIntensity from the PASSED schedule; radiusEarth spy (no gravity spy)', () => {
  it('the potential CONSUMES the explicit schedule parameter (higher nAnalytic ⇒ lower potential)', () => {
    const c = cond({ R: 0.5, td: 0, age: 4.5, P: 0 });
    const low  = crystallizationPotential(c, { nAnalytic: 0 });
    const high = crystallizationPotential(c, { nAnalytic: 2 * N_BOMB_REF });   // saturates bombardmentIntensity→1
    expect(low, 'zero-bombardment schedule ⇒ potential ungated by impacts').toBeGreaterThan(high);
    expect(high, 'a fully-bombarded schedule zeroes the impact factor').toBeCloseTo(0, 12);
  });

  it('a radiusEarth perturbation moves the potential THROUGH craterSchedule (nAnalytic ∝ R²) — gravity spy deleted', () => {
    // R is the ONE crystal input that moves ONLY bombardmentIntensity (nAnalytic ∝ R²); all other crystal scalars
    // (airlessness, erosion, resurfacing) are R-blind. The gravity spy is DELETED because post-K_GD the count path
    // is g-independent BY DESIGN (dN/dg = 0, AC-GCOUNT) — a gravity spy could only pass against wrong physics (L10).
    const small = cond({ R: 0.4 }), large = cond({ R: 1.2 });
    const sN = craterSchedule(small).nAnalytic, lN = craterSchedule(large).nAnalytic;
    expect(lN, 'nAnalytic grows with R (∝R²)').toBeGreaterThan(sN);
    const pSmall = crystallizationPotential(small, craterSchedule(small));
    const pLarge = crystallizationPotential(large, craterSchedule(large));
    // more impacts on the larger body ⇒ lower crystallization potential — the schedule is genuinely wired through.
    expect(pSmall, 'the perturbation is observable in the potential (schedule is wired, not ignored)').not.toBe(pLarge);
    expect(pLarge, 'larger R ⇒ more impacts ⇒ lower potential').toBeLessThan(pSmall);

    // and gravity is NOT a hidden input: sweeping surfaceGravity at fixed R leaves the potential invariant.
    const gA = { ...cond({ R: 0.5 }), surfaceGravity: 0.1 };
    const gB = { ...cond({ R: 0.5 }), surfaceGravity: 2.5 };
    expect(crystallizationPotential(gB, craterSchedule(gB)),
      'dPotential/dg = 0 (AC-GCOUNT: primary flux is g-independent)')
      .toBeCloseTo(crystallizationPotential(gA, craterSchedule(gA)), 12);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-CRYSTAL — channel shape + default bake (Max ruling #2: crystal out of the default bake)', () => {
  it('deriveSurfaceMaterial returns EXACTLY { iceness, crystallizationPotential, regolithRoughness }', () => {
    const c = cond({ R: 0.8 });
    const sm = deriveSurfaceMaterial(c, craterSchedule(c));
    expect(Object.keys(sm).sort()).toEqual(['crystallizationPotential', 'iceness', 'regolithRoughness']);
    expect(typeof sm.crystallizationPotential).toBe('number');
    expect(sm.iceness).toBe(icenessOf(c));
  });

  it('relief.surfaceMaterial carries the crystal channel on every dispatch path, and no facet weight enters the bake', () => {
    for (const name of ['Crystal (faceted)', 'Frozen (airless)', 'Rocky (Earthlike)', 'Gas giant (Jovian)']) {
      const carrier = makeSphereField(buildIrregularSphere(700, 2));
      const relief = writeBodyRelief(carrier, reliefBundle(name, 1));
      expect(Object.keys(relief.surfaceMaterial).sort(), `${name} channel shape`)
        .toEqual(['crystallizationPotential', 'iceness', 'regolithRoughness']);
      expect(typeof relief.surfaceMaterial.crystallizationPotential, `${name} crystal numeric`).toBe('number');
      // Max ruling #2: the facet layer does NOT enter the default bake — the relief object has no facet weight;
      // crystallizationPotential rides as a return-object channel only (facets stay a lab-render-only concern).
      expect('facetStrength' in relief, `${name} no facetStrength baked`).toBe(false);
      expect('facetWeight' in relief, `${name} no facetWeight baked`).toBe(false);
    }
  });

  it('the crystal channel is byte-inert: it draws no RNG and matches the pure fn on the same schedule', () => {
    const name = 'Crystal (faceted)';
    const carrier = makeSphereField(buildIrregularSphere(700, 2));
    const relief = writeBodyRelief(carrier, reliefBundle(name, 1));
    const c = condOf(name);
    expect(relief.surfaceMaterial.crystallizationPotential).toBe(crystallizationPotential(c, craterSchedule(c)));
  });
});
