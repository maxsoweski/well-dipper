// tests/worldengine-inc3b-synth-law.test.js — Inc-3b S3-fix: the schedule-derived single crater law.
//
// The lab's route-time derivation (planet-lod-lab.html, near the state.iceness idiom) turns
// craterSchedule(condition) into the uCrater* uniform values for the in-shader analytic sub-floor
// crater-texture band. This test REPRODUCES that derivation from craterSchedule and pins:
//   • the exact worked numbers (D_char, uCraterScale, uCraterDensity, uCraterAmp, uCraterRelaxation)
//     for the four preserved worlds — a regression tripwire on the law;
//   • the ANTI-DOUBLE-RENDER clamp (F3): every synth crater's diameter (the mix(0.18,0.55) hash tail)
//     lands AT/below the schedule's D_FLOOR_KM, so the synth never re-renders the discrete stamped
//     population (D ≥ D_FLOOR_KM);
//   • the coverage-match density law (uCraterDensity·π·E[craterRadius²] == regolithRoughness), and the
//     near-0 render on temperate/eroded impact worlds;
//   • morphology≡0 (all synth craters simple), and determinism;
//   • that the SHIPPED lab source carries these formulas (not just this test's copy).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { craterSchedule, craterRelevanceOf, isImpactSurface, D_D_SIMPLE } from '../src/worldengine/base/bombardment.js';
import { radPerKm } from '../src/worldengine/base/baseStep.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms, featureFrequencyFromKm, CRATER_DEPTH } from '../src/worldengine/base/labCore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The shader hashes each synth crater's radius as mix(0.18,0.55) cell units (glsl :1962); diameter =
// 2·craterRadius. The 0.55 tail ⇒ the max synth diameter in cell units.
const HASH_TAIL_MAX = 2.0 * 0.55;
// Mean per-cell crater area fraction: craterRadius = 0.18 + 0.37u (u~U[0,1]); crater area = π·craterRadius²;
// E[craterRadius²] = ∫₀¹(0.18+0.37u)²du = 0.18² + 0.18·0.37 + 0.37²/3.
const CELL_CRATER_AREA = Math.PI * (0.18 * 0.18 + 0.18 * 0.37 + 0.37 * 0.37 / 3);
const C_CRATER = 1.0;

function condOf(name) {
  const fp = DRIVER_PRESETS[name];
  return deriveConditionVector(fp, deriveUniforms(fp, 1.0), fp.radiusEarth);
}

// The EXACT derivation the lab performs at route time (transcribed one-for-one).
function synthLaw(cond) {
  const sch = craterSchedule(cond);
  const RE = Math.max(1e-6, cond.radiusEarth ?? 1.0);
  const L = sch.D_LO_KM * sch.sizeMul;
  const Dgeo = Math.sqrt(Math.max(L, 1e-9) * Math.max(sch.D_FLOOR_KM, 1e-9));
  const Dchar = Math.min(Dgeo, sch.D_FLOOR_KM / HASH_TAIL_MAX);           // F2/F3
  const ageEff = Math.min(4.6, Math.max(0, cond.age ?? 4.0));
  return {
    sch, RE, L, Dgeo, Dchar,
    uCraterScale: featureFrequencyFromKm(RE, Dchar, C_CRATER),
    uCraterDensity: Math.max(0, Math.min(1, sch.regolithRoughness / CELL_CRATER_AREA)),
    // Composed on-screen depth = CRATER_DEPTH·amp (the profile's internal shape factor) — dividing it out
    // makes the composed depth honor Pike d/D = D_D_SIMPLE exactly once (no double-count; adjudication seam).
    uCraterAmp: (D_D_SIMPLE / CRATER_DEPTH) * radPerKm(RE) * Dchar,
    uCraterComplexD: HASH_TAIL_MAX / 0.6,
    uCraterRelaxation: (sch.tExp > 0 && ageEff > 0) ? Math.max(0, Math.min(1, 1 - sch.tExp / ageEff)) : 0,
  };
}

// FROZEN worked points (probe at HEAD; the derivation reproduces these to float precision).
const WORKED = {
  'Moon/Mercury (impact-airless)': { Dchar: 12.133260113494435, scale: 199.53252278070107, density: 0.5875012875823871, amp: 0.005011714311350955, relax: 0 },
  'Mars (arid rocky)':             { Dchar: 13.946486448995714, scale: 242.11331021249092, density: 0.5697661333010464, amp: 0.004130297500465172, relax: 0 },
  'Frozen (airless)':              { Dchar: 13.905101622477657, scale: 229.0885810464431,  density: 0.6191122157649042, amp: 0.004365123723898181, relax: 0 },
  'Crystal (faceted)':             { Dchar: 16.119643715254828, scale: 316.1856483947373,  density: 0.49231800415086413, amp: 0.003162698892492314, relax: 0 },
};

describe('Inc-3b S3-fix — synth law reproduces from craterSchedule (worked points)', () => {
  for (const [name, w] of Object.entries(WORKED)) {
    it(`${name}: D_char / uCraterScale / uCraterDensity / uCraterAmp / uCraterRelaxation`, () => {
      const r = synthLaw(condOf(name));
      expect(r.Dchar).toBeCloseTo(w.Dchar, 8);
      expect(r.uCraterScale).toBeCloseTo(w.scale, 6);
      expect(r.uCraterDensity).toBeCloseTo(w.density, 8);
      expect(r.uCraterAmp).toBeCloseTo(w.amp, 10);
      expect(r.uCraterRelaxation).toBe(w.relax);
      // uCraterScale must equal RE·6371/D_char exactly (featureFrequencyFromKm, C_CRATER=1).
      expect(r.uCraterScale).toBeCloseTo(r.RE * 6371 / r.Dchar, 6);
    });
  }
});

describe('Inc-3b S3-fix — anti-double-render clamp (F3): synth band strictly below D_FLOOR', () => {
  it('every impact world: the max hashed synth diameter (1.10·D_char) is AT/below D_FLOOR_KM', () => {
    for (const name of Object.keys(DRIVER_PRESETS)) {
      const cond = condOf(name);
      if (!isImpactSurface(cond)) continue;
      if (craterRelevanceOf(cond) !== 1) continue;
      const r = synthLaw(cond);
      const maxSynthD = HASH_TAIL_MAX * r.Dchar;             // = 2·0.55·D_char (cell diam 1.10 · D_char km)
      expect(maxSynthD, `${name} max synth D ≤ D_FLOOR`).toBeLessThanOrEqual(r.sch.D_FLOOR_KM + 1e-9);
      // and the clamp definition holds: D_char = min(geomean, D_FLOOR/1.10)
      expect(r.Dchar).toBeLessThanOrEqual(r.sch.D_FLOOR_KM / HASH_TAIL_MAX + 1e-9);
      expect(r.Dchar).toBeCloseTo(Math.min(r.Dgeo, r.sch.D_FLOOR_KM / HASH_TAIL_MAX), 10);
    }
  });

  it('morphology≡0: uCraterComplexD·0.6 ≥ the max synth diameter (all synth craters are simple bowls)', () => {
    const r = synthLaw(condOf('Moon/Mercury (impact-airless)'));
    expect(r.uCraterComplexD * 0.6).toBeGreaterThanOrEqual(HASH_TAIL_MAX);
  });
});

describe('Inc-3b S3-fix — density coverage-match + temperate near-0 render', () => {
  it('uCraterDensity·π·E[craterRadius²] reproduces the schedule regolithRoughness (coverage-preserving)', () => {
    for (const name of ['Moon/Mercury (impact-airless)', 'Mars (arid rocky)', 'Frozen (airless)', 'Crystal (faceted)']) {
      const r = synthLaw(condOf(name));
      // unclamped (density<1 for all four), so the covered fraction returns regolithRoughness exactly.
      expect(r.uCraterDensity).toBeLessThan(1);
      expect(r.uCraterDensity * CELL_CRATER_AREA).toBeCloseTo(r.sch.regolithRoughness, 12);
      expect(r.uCraterDensity).toBeGreaterThan(0.4);  // the preserved worlds render a dense sub-floor field
    }
  });

  it('temperate / eroded impact worlds (Rocky/Ocean/Titan/Europa/Eyeball) derive a near-0 density (< 1e-3)', () => {
    for (const name of ['Rocky (Earthlike)', 'Ocean (temperate)', 'Titan (methane seas)', 'Europa (icy moon)', 'Eyeball (locked temperate)']) {
      const r = synthLaw(condOf(name));
      expect(r.uCraterDensity, `${name} auto-renders no craters`).toBeLessThan(1e-3);
    }
  });
});

describe('Inc-3b S3-fix — determinism', () => {
  it('same condition ⇒ identical derived uniforms', () => {
    for (const name of Object.keys(WORKED)) {
      const a = synthLaw(condOf(name));
      const b = synthLaw(condOf(name));
      for (const k of ['Dchar', 'uCraterScale', 'uCraterDensity', 'uCraterAmp', 'uCraterComplexD', 'uCraterRelaxation']) {
        expect(a[k]).toBe(b[k]);
      }
    }
  });
});

describe('Inc-3b S3-fix — the SHIPPED lab source carries the derivation (not just this test)', () => {
  const lab = readFileSync(join(__dirname, '../planet-lod-lab.html'), 'utf8');
  it('imports craterSchedule + craterRelevanceOf + D_D_SIMPLE and radPerKm', () => {
    expect(lab).toMatch(/import\s*\{[^}]*\bcraterSchedule\b[^}]*\bcraterRelevanceOf\b[^}]*\bD_D_SIMPLE\b[^}]*\}\s*from\s*['"][^'"]*bombardment/);
    expect(lab).toMatch(/import\s*\{[^}]*\bradPerKm\b[^}]*\}\s*from\s*['"][^'"]*baseStep/);
  });
  it('contains the depth law, the closed-form density, the hash-tail clamp, and the relevance call', () => {
    expect(lab).toMatch(/D_D_SIMPLE\s*\/\s*CRATER_DEPTH\)\s*\*\s*radPerKm\(/); // uCraterAmp composed depth law (shape factor divided out)
    expect(lab).toMatch(/0\.18\s*\*\s*0\.18\s*\+\s*0\.18\s*\*\s*0\.37/); // CELL_CRATER_AREA closed form
    expect(lab).toMatch(/2\.0\s*\*\s*0\.55/);                            // _HASH_TAIL_MAX
    expect(lab).toMatch(/craterRelevanceOf\(_bodyDrivers\.condition\)/);  // F1 relevance leaf call
    // Boot-enable: applyWorldDefaults must derive the crater enable from the SAME condition leaf (the
    // rendersOn name-add is barred), else preset selection clears cratersEnabled and the synth never
    // renders on plain selection (S4 capture finding).
    expect(lab).toMatch(/craterRelevanceOf\(deriveConditionVector\(/);
  });
  it('the frame gate reads state.craterRelevance (NOT featureRelevant.craters) on the crater + ejecta paths', () => {
    expect(lab).toMatch(/uCraterDensity\.value\s*=\s*state\.cratersEnabled\s*\?\s*state\.craterDensity\s*\*\s*state\.craterRelevance/);
    expect(lab).toMatch(/uEjectaStrength\.value\s*=\s*state\.ejectaEnabled\s*\?\s*state\.ejectaStrength\s*\*\s*state\.craterRelevance/);
  });
});
