// tests/worldengine-inc3b-relief-budget.test.js — Inc-3b S1.1/S1.1a: the deriveReliefBudget LEAF unit.
//
// Covers (BUILD-PLAN §1.S1 test list, contract AC-0 / AC-BUDGET leaf half):
//   • IDENTITY OUTSIDE DOMAIN — every out-of-domain preset returns { inDomain:false, f_I:0, w_e:1, w_i:1 }
//     with w_e/w_i EXACTLY 1.0 (the bit-exact identity contract the composite seam relies on).
//   • f_I WORKED POINTS — the leaf reproduces the settled condition-pure derivation
//     (calibration/leaf-law.json) EXACTLY for the four in-domain worlds; dead-lid worlds are
//     crater-dominant (f_I>0.5); Mars lands in the real-hypsometry gate [0.3,0.8] (NOT relic f_I ~0.97).
//   • TOTALITY (S1.1a) — the leaf runs at planet-lod-rivers.js:569 on EVERY writeBodyRelief; it must be
//     finite on all 18 presets and NEVER throw (a throw cascades the whole suite RED).
//   • AC-0 SOURCE GREP — the leaf source reads no label/archetype/regime string, no feature-association
//     reference, and introduces no new config-flag key (the Rule-15 spine fence, leaf half).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { deriveReliefBudget } from '../src/worldengine/base/reliefBudget.js';
import { craterSchedule } from '../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// condition vector at the canonical radius — the exact pattern leaf-law.mjs (the settled derivation) uses.
function condOf(name) {
  const fp = DRIVER_PRESETS[name];
  return deriveConditionVector(fp, deriveUniforms(fp, 1.0), fp.radiusEarth);
}

// The four in-domain worlds and their FROZEN condition-pure f_I (calibration/leaf-law.json worked points).
// The leaf transcribes leaf-law.mjs exactly, so these must reproduce to float-epsilon.
const IN_DOMAIN_FI = {
  'Moon/Mercury (impact-airless)': 0.9577302728397398,
  'Mars (arid rocky)': 0.4261549353954948,
  'Frozen (airless)': 0.9521139578285976,
  'Crystal (faceted)': 0.7526336866562588,
};
const DEAD_LID = ['Moon/Mercury (impact-airless)', 'Frozen (airless)', 'Crystal (faceted)'];
const MARS_GATE = [0.3, 0.8];

// The out-of-domain set (everything that is NOT one of the four in-domain worlds) — see the domain
// enumeration in calibration/leaf-law.json: only {Moon/Mercury, Mars, Frozen, Crystal} are in-domain.
const OUT_OF_DOMAIN = Object.keys(DRIVER_PRESETS).filter((n) => !(n in IN_DOMAIN_FI));

describe('Inc-3b S1.1 — deriveReliefBudget: identity outside the domain', () => {
  it('every out-of-domain preset returns the exact identity object (w_e=w_i=1.0, f_I=0, inDomain=false)', () => {
    for (const name of OUT_OF_DOMAIN) {
      const cond = condOf(name);
      const b = deriveReliefBudget(cond, craterSchedule(cond));
      expect(b.inDomain, `${name} inDomain`).toBe(false);
      expect(b.f_I, `${name} f_I`).toBe(0);
      expect(b.w_e, `${name} w_e exactly 1.0`).toBe(1);
      expect(b.w_i, `${name} w_i exactly 1.0`).toBe(1);
    }
  });

  it('Rocky (Earthlike) and Ocean (temperate) — the margin worlds that flow THROUGH the composite — are out of domain (identity)', () => {
    for (const name of ['Rocky (Earthlike)', 'Ocean (temperate)']) {
      const b = deriveReliefBudget(condOf(name), craterSchedule(condOf(name)));
      expect(b.inDomain, `${name} out of budget domain by condition scalar`).toBe(false);
      expect(b.w_e).toBe(1);
      expect(b.w_i).toBe(1);
    }
  });

  it('the schedule-less call path (no second arg) still short-circuits by condition scalar and never throws', () => {
    // deriveReliefBudget(cond) with no schedule falls back to craterSchedule(cond) internally.
    for (const name of OUT_OF_DOMAIN) {
      const b = deriveReliefBudget(condOf(name));
      expect(b.inDomain).toBe(false);
      expect(b.w_e).toBe(1);
      expect(b.w_i).toBe(1);
    }
  });
});

describe('Inc-3b S1.1 — deriveReliefBudget: in-domain f_I reproduces the settled worked points', () => {
  it('the four in-domain worlds reproduce leaf-law.json condition-pure f_I to float-epsilon, w_e/w_i identity defaults', () => {
    for (const [name, fI] of Object.entries(IN_DOMAIN_FI)) {
      const cond = condOf(name);
      const b = deriveReliefBudget(cond, craterSchedule(cond));
      expect(b.inDomain, `${name} inDomain`).toBe(true);
      expect(Math.abs(b.f_I - fI), `${name} f_I=${b.f_I} vs leaf-law ${fI}`).toBeLessThan(1e-12);
      // the leaf carries only the RATIO target; the RMS-preserving scale is solved in compositeMargins.
      expect(b.w_e, `${name} leaf w_e is the identity default`).toBe(1);
      expect(b.w_i, `${name} leaf w_i is the identity default`).toBe(1);
    }
  });

  it('dead-lid worlds (Moon/Mercury, Frozen, Crystal) are crater-dominant (f_I > 0.5)', () => {
    for (const name of DEAD_LID) {
      const b = deriveReliefBudget(condOf(name), craterSchedule(condOf(name)));
      expect(b.f_I, `${name} crater-dominant`).toBeGreaterThan(0.5);
    }
  });

  it('Mars lands in the real-Mars-hypsometry gate [0.3, 0.8] — NOT the dead-lid relic f_I (~0.97)', () => {
    const b = deriveReliefBudget(condOf('Mars (arid rocky)'), craterSchedule(condOf('Mars (arid rocky)')));
    expect(b.f_I).toBeGreaterThanOrEqual(MARS_GATE[0]);
    expect(b.f_I).toBeLessThanOrEqual(MARS_GATE[1]);
  });
});

describe('Inc-3b S1.1a — deriveReliefBudget is TOTAL (runs at :569 on every writeBodyRelief)', () => {
  it('is finite and never throws on all 18 presets (with and without the schedule arg)', () => {
    let inDomainCount = 0;
    for (const name of Object.keys(DRIVER_PRESETS)) {
      const cond = condOf(name);
      let b;
      expect(() => { b = deriveReliefBudget(cond, craterSchedule(cond)); }, `${name} must not throw`).not.toThrow();
      expect(Number.isFinite(b.f_I), `${name} f_I finite`).toBe(true);
      expect(Number.isFinite(b.w_e), `${name} w_e finite`).toBe(true);
      expect(Number.isFinite(b.w_i), `${name} w_i finite`).toBe(true);
      // also the one-arg path
      expect(() => deriveReliefBudget(cond)).not.toThrow();
      if (b.inDomain) inDomainCount++;
    }
    // exactly the four affected worlds are in-domain (the S0 domain enumeration)
    expect(inDomainCount).toBe(4);
  });

  it('never throws on degenerate/empty inputs and always returns finite weights', () => {
    // The totality contract is never-throws + finite (a throw at :569 cascades the suite RED). A partial
    // object that happens to satisfy isImpactSurface (cold+solid by field defaults) may report inDomain —
    // that is correct predicate behaviour, not a violation; the leaf just must not throw or go non-finite.
    for (const bad of [null, undefined, {}, { surfaceGravity: 0 }, { atmosphere: { pressure: 0 }, T_eq: 100 }]) {
      let b;
      expect(() => { b = deriveReliefBudget(bad); }).not.toThrow();
      expect(Number.isFinite(b.f_I)).toBe(true);
      expect(Number.isFinite(b.w_e)).toBe(true);
      expect(Number.isFinite(b.w_i)).toBe(true);
    }
  });

  it('null / undefined cond return the exact identity object (the guaranteed short-circuit)', () => {
    for (const bad of [null, undefined]) {
      const b = deriveReliefBudget(bad);
      expect(b.inDomain).toBe(false);
      expect(b.f_I).toBe(0);
      expect(b.w_e).toBe(1);
      expect(b.w_i).toBe(1);
    }
  });
});

describe('Inc-3b S1 — AC-0 source grep: the leaf reads condition scalars only', () => {
  const src = readFileSync(join(__dirname, '..', 'src', 'worldengine', 'base', 'reliefBudget.js'), 'utf8');

  it('the leaf source contains NO label/archetype/regime-string routing tokens (dispatch-oracle denylist)', () => {
    const denylist = [
      /PRESET_ARCHETYPE/,
      /\.label\b/,
      /stagnantLidRegimeOf\(/,
      /isVolcanicPath\(/,
      /isEarthlikePlatePath\(/,
      /shellRegimeOf\(/,
      /\barchetype\b/,
    ];
    for (const re of denylist) {
      expect(re.test(src), `leaf source must not contain ${re}`).toBe(false);
    }
  });

  it('the leaf makes NO reference to the feature-association relevance gate (rendersOn)', () => {
    expect(/rendersOn/.test(src)).toBe(false);
  });

  it('the leaf introduces NO new *Enabled config key', () => {
    expect(/Enabled/.test(src)).toBe(false);
  });
});
