// tests/worldengine-inc3b-composite-budget.test.js — Inc-3b S1.3: compositeMargins(carrier, budget) budget path.
//
// Covers (BUILD-PLAN §1.S1 test list; contract AC-IDENTITY / AC-NULLPATH / AC-BUDGET / AC-FENCE):
//   • 2-ARG ARITHMETIC — an in-domain budget reallocates: out = w_e·h + sd + w_i·cf, with the RMS-preserving
//     w_e/w_i solved from the REALIZED raw-mean-square norms (adopted §6-T2 option (ii)+S0.2a).
//   • AC-IDENTITY — Rocky/Ocean margin worlds (out of the budget domain) composite BYTE-IDENTICALLY whether
//     called one-arg (→ IDENTITY_BUDGET) or two-arg with their real (identity) budget, and equal the literal
//     pre-Inc-3b h+sd+cf sum. Weights are the identity path (never applied) by condition scalar.
//   • AC-NULLPATH — the enumerated null-path worlds (gate=n or degenerate; Titan/Europa/Eyeball nStamp=0)
//     are byte-identical pre/post, excluded from the domain by condition scalar (not by null-topology accident).
//   • AC-BUDGET — at the boot worked point (Moon/Mercury, N=40k, seed 1) f_I lands in the S0 band, the
//     channel raw-mean-square SUM is preserved (w_e²V_h + w_i²V_cf == V_h + V_cf), and crater-vs-base variance
//     inverts to crater-dominant (the ~1.5% crater:base share → f_I). Frozen variance def = raw mean-square.
//   • EPSILON CLAMP — an in-domain budget on a carrier with V_cf below the ε floor falls back to the literal
//     identity loop rather than emitting an unbounded w_i (S0.2a #3 degeneracy guard).
import { describe, it, expect } from 'vitest';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  buildIrregularSphere, writeBodyRelief, compositeMargins, IDENTITY_BUDGET, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';

// the lab's route() bundle (condition-BEARING), canonical radius — mirrors the v2-5 composite suite.
function reliefBundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null, locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + seed, T_eq: fp.T_eq ?? 288,
  };
}
function boot(name, N, seed) {
  const carrier = makeSphereField(buildIrregularSphere(N, 2));
  const relief = writeBodyRelief(carrier, reliefBundle(name, seed));
  return { carrier, budget: relief.reliefBudget };
}
function sameComposite(a, b) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const ms = (xs) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i] * xs[i]; return s / xs.length; };

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('Inc-3b S1.3 — compositeMargins two-arg budget arithmetic', () => {
  const N = 64;
  const baseHeight = () => { const h = new Float32Array(N); for (let i = 0; i < N; i++) h[i] = Math.sin(i * 0.37) * 0.3 + 0.05; return h; };
  const ramp = (scale) => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = ((i % 7) - 3) * scale; return a; };
  const zeros = () => new Float32Array(N);

  it('an in-domain budget reallocates out = w_e·h + sd + w_i·cf with the realized-norm RMS-preserving solve', () => {
    const h = baseHeight(), sd = ramp(0.05), cf = ramp(0.02);
    const carrier = { count: N, height: h, shelfDepth: sd, craterField: cf };
    const f_I = 0.9;
    const out = compositeMargins(carrier, { inDomain: true, f_I, w_e: 1, w_i: 1 });
    // recompute the solve exactly as the seam does (raw mean-square norms).
    const V_h = ms(h), V_cf = ms(cf), r = f_I / (1 - f_I);
    const w_e = Math.sqrt((V_h + V_cf) / (V_h * (1 + r)));
    const w_i = Math.sqrt(r * w_e * w_e * V_h / V_cf);
    expect(w_e).toBeLessThan(1);   // endo suppressed
    expect(w_i).toBeGreaterThan(1);   // impact amplified
    for (let i = 0; i < N; i++) expect(out[i], `[${i}]`).toBe(Math.fround(w_e * h[i] + sd[i] + w_i * cf[i]));
    // channel raw-MS SUM preserved (the frozen-definition preservation identity)
    const sumPre = V_h + V_cf, sumPost = w_e * w_e * V_h + w_i * w_i * V_cf;
    expect(Math.abs(sumPost - sumPre) / sumPre).toBeLessThan(1e-9);
  });

  it('IDENTITY_BUDGET (and one-arg) reduce to the literal h+sd+cf loop, byte-identical', () => {
    const h = baseHeight(), sd = ramp(0.05), cf = ramp(0.02);
    const mk = () => ({ count: N, height: h, shelfDepth: sd, craterField: cf });
    const oneArg = compositeMargins(mk());
    const identity = compositeMargins(mk(), IDENTITY_BUDGET);
    expect(sameComposite(oneArg, identity)).toBe(true);
    for (let i = 0; i < N; i++) expect(oneArg[i], `[${i}]`).toBe(Math.fround(h[i] + sd[i] + cf[i]));
  });

  it('IDENTITY_BUDGET is frozen with w_e=w_i=1 and inDomain=false', () => {
    expect(IDENTITY_BUDGET.inDomain).toBe(false);
    expect(IDENTITY_BUDGET.w_e).toBe(1);
    expect(IDENTITY_BUDGET.w_i).toBe(1);
    expect(Object.isFrozen(IDENTITY_BUDGET)).toBe(true);
  });

  it('EPSILON clamp: an in-domain budget with V_cf below the ε floor falls back to the literal loop (no unbounded w_i)', () => {
    const h = baseHeight(), sd = ramp(0.05);
    // craterField ~1e-6 ⇒ V_cf ~1e-12, far below the ε_Vcf floor (1.18e-8) ⇒ clamp fires.
    const cfTiny = new Float32Array(N); for (let i = 0; i < N; i++) cfTiny[i] = 1e-6;
    const clamped = compositeMargins({ count: N, height: h, shelfDepth: sd, craterField: cfTiny }, { inDomain: true, f_I: 0.9, w_e: 1, w_i: 1 });
    for (let i = 0; i < N; i++) expect(clamped[i], `clamped[${i}] is the identity sum`).toBe(Math.fround(h[i] + sd[i] + cfTiny[i]));
    // positive control: a craterField well ABOVE the ε floor takes the weighted branch (differs from the sum).
    const cfBig = ramp(0.02);
    const weighted = compositeMargins({ count: N, height: h, shelfDepth: sd, craterField: cfBig }, { inDomain: true, f_I: 0.9, w_e: 1, w_i: 1 });
    let differs = false;
    for (let i = 0; i < N; i++) if (weighted[i] !== Math.fround(h[i] + sd[i] + cfBig[i])) { differs = true; break; }
    expect(differs, 'above-floor craterField takes the weighted (non-identity) branch').toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('Inc-3b AC-IDENTITY — margin worlds (Rocky, Ocean) composite byte-identically pre/post', () => {
  for (const name of ['Rocky (Earthlike)', 'Ocean (temperate)']) {
    it(`${name}: one-arg === two-arg(real budget) === literal h+sd+cf; budget is out of domain`, () => {
      const { carrier, budget } = boot(name, 2000, 1);
      expect(budget.inDomain, `${name} out of budget domain`).toBe(false);
      expect(budget.w_e).toBe(1);
      expect(budget.w_i).toBe(1);
      const oneArg = compositeMargins(carrier);
      const twoArg = compositeMargins(carrier, budget);
      expect(sameComposite(oneArg, twoArg), `${name} pre/post byte-identical`).toBe(true);
      // and equal the literal pre-Inc-3b sum where non-null
      if (oneArg !== null) {
        const h = carrier.height, sd = carrier.shelfDepth, cf = carrier.craterField;
        for (let i = 0; i < oneArg.length; i++) expect(twoArg[i]).toBe(Math.fround(h[i] + (sd ? sd[i] : 0) + (cf ? cf[i] : 0)));
      }
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('Inc-3b AC-NULLPATH — enumerated null-path worlds byte-identical pre/post (excluded by condition scalar)', () => {
  const NULL_PATH = [
    // gate=n or degenerate (no impact surface):
    'Gas giant (Jovian)', 'Gas giant (Saturnian)', 'Ice giant (Neptunian)', 'Sub-Neptune (hazy)',
    'Hot Jupiter (locked giant)', 'Venus (sulfuric shroud)', 'Magma (K2-141b)', 'Carbon (high C/O)',
    'Lava (hot airless)',
    // gate=Y but nStamp=0, no shelf ⇒ null:
    'Titan (methane seas)', 'Europa (icy moon)', 'Eyeball (locked temperate)',
  ];
  for (const name of NULL_PATH) {
    it(`${name}: budget out of domain; composite unchanged pre/post`, () => {
      const { carrier, budget } = boot(name, 2000, 1);
      expect(budget.inDomain, `${name} excluded by condition scalar`).toBe(false);
      const oneArg = compositeMargins(carrier);
      const twoArg = compositeMargins(carrier, budget);
      expect(sameComposite(oneArg, twoArg), `${name} byte-identical`).toBe(true);
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('Inc-3b AC-BUDGET — boot worked point (Moon/Mercury, N=40k, seed 1): f_I in band, RMS-sum preserved, crater-dominant', () => {
  it('the budgeted composite inverts crater:base variance at the preserved channel raw-MS sum', () => {
    const { carrier, budget } = boot('Moon/Mercury (impact-airless)', 40000, 1);
    expect(budget.inDomain).toBe(true);
    // f_I in the S0 band (leaf-law.json condition-pure worked point 0.95773; crater-dominant, per relic-lambda-band)
    expect(budget.f_I).toBeGreaterThan(0.90);
    expect(budget.f_I).toBeLessThan(0.99);
    expect(Math.abs(budget.f_I - 0.9577302728397398)).toBeLessThan(1e-9);

    const h = carrier.height, cf = carrier.craterField, sd = carrier.shelfDepth;
    // Moon/Mercury is dead-lid despun ⇒ shelfDepth all-zero ⇒ composite = w_e·h + w_i·cf.
    let sdNonzero = false; for (let i = 0; i < sd.length; i++) if (sd[i] !== 0) { sdNonzero = true; break; }
    expect(sdNonzero, 'Moon/Mercury shelfDepth all-zero (dead-lid, no plate path)').toBe(false);

    const V_h = ms(h), V_cf = ms(cf), f_I = budget.f_I, r = f_I / (1 - f_I);
    const w_e = Math.sqrt((V_h + V_cf) / (V_h * (1 + r)));
    const w_i = Math.sqrt(r * w_e * w_e * V_h / V_cf);

    // (1) channel raw-MS SUM preserved (the frozen-definition preservation identity, exact algebra)
    const sumPre = V_h + V_cf, sumPost = w_e * w_e * V_h + w_i * w_i * V_cf;
    expect(Math.abs(sumPost - sumPre) / sumPre, 'raw-MS channel sum preserved').toBeLessThan(1e-9);

    // (2) crater:base variance INVERTS — pre share tiny, post share crater-dominant (== f_I)
    const preCraterShare = V_cf / (V_h + V_cf);
    const postCraterShare = (w_i * w_i * V_cf) / sumPost;
    expect(preCraterShare, 'pre-budget crater share ~ the ~1.5% diagnosis, endo-dominated').toBeLessThan(0.01);
    expect(postCraterShare, 'post-budget crater-dominant').toBeGreaterThan(0.5);
    expect(Math.abs(postCraterShare - f_I), 'post crater share equals f_I').toBeLessThan(1e-9);

    // (3) the seam actually applied the solved weights (out === w_e·h + w_i·cf, since sd=0)
    const out = compositeMargins(carrier, budget);
    for (let i = 0; i < out.length; i++) expect(out[i], `[${i}]`).toBe(Math.fround(w_e * h[i] + sd[i] + w_i * cf[i]));
  });
});
