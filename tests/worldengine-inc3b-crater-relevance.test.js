// tests/worldengine-inc3b-crater-relevance.test.js — Inc-3b S3-fix: the craterRelevanceOf leaf.
//
// Covers (S3-FIX-SPEC.md "Tests" §, contract AC-0 / Rule-15 spine fence):
//   • AC-0 SOURCE GREP — craterRelevanceOf reads NO label/archetype/regime string and NO
//     `rendersOn` feature-association name-add (the barred manifest coupling); bombardment.js
//     imports NO e1Regime module (e1-blind by construction).
//   • DOMAIN — relevance 0 on every non-impact world; 1 on the impact set (Moon/Mercury, Mars,
//     Frozen, Crystal + the temperate impact surfaces). The relevance=1 set is EXACTLY the
//     isImpactSurface set — the physical near-0 render on temperate worlds is carried by the
//     downstream density law, not by this domain gate.
//   • TOTALITY — finite 0/1 on all 18 presets, and never throws on degenerate inputs
//     (null / undefined / {} / partial condition).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { craterRelevanceOf, isImpactSurface, craterSchedule } from '../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// condition vector at the canonical radius — the exact pattern the settled leaf-law derivation uses.
function condOf(name) {
  const fp = DRIVER_PRESETS[name];
  return deriveConditionVector(fp, deriveUniforms(fp, 1.0), fp.radiusEarth);
}

const ALL = Object.keys(DRIVER_PRESETS);
// The impact-airless / preserved worlds that MUST render craters (nStamp>0 population).
const MUST_RENDER = ['Moon/Mercury (impact-airless)', 'Mars (arid rocky)', 'Frozen (airless)', 'Crystal (faceted)'];

describe('Inc-3b S3-fix — craterRelevanceOf: AC-0 source grep (spine fence, e1-blind)', () => {
  const src = readFileSync(join(__dirname, '../src/worldengine/base/bombardment.js'), 'utf8');
  // Slice the craterRelevanceOf function body (start → the first column-0 close brace).
  const start = src.indexOf('export function craterRelevanceOf');
  const body = src.slice(start, src.indexOf('\n}', start) + 2);

  it('the function exists and returns a plain 0/1 (no import of any dispatch/regime module inside)', () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toMatch(/return\s*\(/);
  });

  it('reads no label / archetype / regime string and no rendersOn / feature-association name', () => {
    expect(body).not.toMatch(/\.label\b/);
    expect(body).not.toMatch(/archetype/i);
    expect(body).not.toMatch(/\bregime\b/i);          // no E1/regime read
    expect(body).not.toMatch(/rendersOn/);            // the barred manifest name-add
    expect(body).not.toMatch(/ASSOCIATIONS|PRESET_ARCHETYPE|featureRelevant/);
  });

  it('bombardment.js imports NO e1Regime module (the shadow-audit invariant holds by construction)', () => {
    expect(src).not.toMatch(/from\s+['"][^'"]*e1Regime/);
    expect(src).not.toMatch(/\bimport\b[^\n]*\be1Regime\b/);
  });
});

describe('Inc-3b S3-fix — craterRelevanceOf: domain (0/1 gate)', () => {
  it('returns 0 on every NON-impact-surface preset', () => {
    for (const name of ALL) {
      const cond = condOf(name);
      if (!isImpactSurface(cond)) {
        expect(craterRelevanceOf(cond), `${name} non-impact ⇒ 0`).toBe(0);
      }
    }
  });

  it('returns 1 on Moon/Mercury, Mars, Frozen, Crystal (the preserved impact-airless set)', () => {
    for (const name of MUST_RENDER) {
      expect(craterRelevanceOf(condOf(name)), `${name} ⇒ 1`).toBe(1);
    }
  });

  it('the relevance=1 set is EXACTLY the isImpactSurface set (domain gate == impact surfaces)', () => {
    const rel = ALL.filter((n) => craterRelevanceOf(condOf(n)) === 1).sort();
    const impact = ALL.filter((n) => isImpactSurface(condOf(n))).sort();
    expect(rel).toEqual(impact);
    // and that set contains the four preserved worlds
    for (const m of MUST_RENDER) expect(rel).toContain(m);
    // gas giants / molten / deep-envelope worlds are NOT in it
    for (const n of ['Lava (hot airless)', 'Gas giant (Jovian)', 'Venus (sulfuric shroud)', 'Magma (K2-141b)', 'Carbon (high C/O)']) {
      expect(rel, `${n} excluded`).not.toContain(n);
    }
  });

  it('every impact surface with relevance=1 fired its schedule and retained a population (nStamp>0 OR regolithRoughness>0)', () => {
    for (const name of ALL) {
      const cond = condOf(name);
      if (craterRelevanceOf(cond) === 1) {
        const s = craterSchedule(cond);
        expect(s.fired).toBe(true);
        expect(s.nStamp > 0 || s.regolithRoughness > 0, `${name} has a population`).toBe(true);
      }
    }
  });
});

describe('Inc-3b S3-fix — craterRelevanceOf: totality (never throws, finite 0/1 on all 18)', () => {
  it('is a finite 0/1 on all 18 presets', () => {
    for (const name of ALL) {
      const v = craterRelevanceOf(condOf(name));
      expect(v === 0 || v === 1, `${name} ⇒ 0|1`).toBe(true);
    }
  });

  it('never throws on degenerate inputs, and always returns a plain 0 or 1', () => {
    for (const bad of [null, undefined, {}, { T_eq: 288 }, { atmosphere: null }, { radiusEarth: 0 }, { T_eq: NaN }, { atmosphere: { pressure: NaN } }]) {
      expect(() => craterRelevanceOf(bad)).not.toThrow();
      const v = craterRelevanceOf(bad);
      expect(v === 0 || v === 1, `${JSON.stringify(bad)} ⇒ 0|1`).toBe(true);
    }
  });

  it('returns identity(0) on genuinely out-of-domain inputs (null/undefined, molten, deep-envelope)', () => {
    expect(craterRelevanceOf(null)).toBe(0);
    expect(craterRelevanceOf(undefined)).toBe(0);
    expect(craterRelevanceOf({ T_eq: 2000 })).toBe(0);                       // molten ⇒ not an impact surface
    expect(craterRelevanceOf({ atmosphere: { pressure: 500 } })).toBe(0);    // deep H2-He envelope ⇒ no solid surface
  });
});
