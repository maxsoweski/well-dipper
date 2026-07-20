// tests/worldengine-v2-6-ice.test.js — World Engine V2-6 SLICE-3 (ice relaxation + iceness material pair).
// Data ACs, all headless (BUILD-PLAN §1D / §1E / §3 AC map).
//
//   AC-RELAX — Arrhenius viscous relaxation of an ICY crater floor (footnote 4): ε(60 K, td≈0) === 0 exactly and
//              the relaxed profile is BIT-IDENTICAL to the un-relaxed one at ε=0 (the crisp-cold-Frozen invariant);
//              a warm/tidal (Enceladus-class) surface relaxes strongly (ε large); ∂ε/∂D > 0 (τ ∝ 1/D — a larger
//              crater relaxes faster); the domed-floor term and the P_RIM=2 rim-persistence term are present;
//              iceness=0 (rock) ⇒ ε ≡ 0 exactly.
//   AC-ICENESS (§1E) — the condition-derived iceness scalar reads HIGH on Frozen/Europa/Titan, nonzero-LOW on
//              Crystal (Lens L7 — its Frozen-pairing driver is crystallizationPotential, S4), and ≈0 on
//              Moon/Mercury/Mars/Rocky; relief.surfaceMaterial is populated on EVERY dispatch path with exactly
//              the SLICE-3 shape { iceness, regolithRoughness } (crystallizationPotential joins in S4 — Lens L8).
import { describe, it, expect } from 'vitest';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import {
  iceRelaxation, relaxedCraterProfile, craterProfile, craterAmplitude, DOME_FRAC, P_RIM,
} from '../src/worldengine/base/bombardment.js';
import { icenessOf } from '../src/worldengine/base/surfaceMaterial.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const condOf = (name) => {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return deriveConditionVector(fp, u, fp.radiusEarth);
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
describe('V2-6 AC-RELAX — Arrhenius ice relaxation (crisp-cold Frozen; relaxed warm/tidal)', () => {
  it('ε(60 K, td≈0) === 0 EXACTLY and the relaxed profile is BIT-IDENTICAL to the un-relaxed one', () => {
    // Deep-frozen icy surface: T ⇒ η so large that t/τ < 1e-16 ⇒ 1−exp(−t/τ) === 0.0 in float64.
    const cold = { T_eq: 60, rawTidalIoRatio: 0, surfaceGravity: 0.13 };
    const iceness = icenessOf({ composition: { density: 2.5, volatileFraction: 0.3 }, T_eq: 60 });
    expect(iceness, 'Frozen-class iceness is nonzero (relaxation is gated by T, not by iceness)').toBeGreaterThan(0);
    const { epsBowl, epsRim } = iceRelaxation(cold, 5, 4.5, iceness);
    expect(epsBowl, 'bowl ε === 0 exactly at 60 K').toBe(0);
    expect(epsRim, 'rim ε === 0 exactly at 60 K').toBe(0);
    // Bit-identity: relaxedCraterProfile(·, 0, 0) === craterProfile(·) across every zone (floor/wall/rim/ejecta).
    for (const D of [0.06, 0.5, 1.0]) {
      const stampR = 0.5 * D + 1.0 * D;   // craterStampRadius(D)
      for (let k = 0; k <= 40; k++) {
        const s = (k / 40) * stampR;
        expect(relaxedCraterProfile(s, D, 0, 0), `bit-identity D=${D} s=${s.toFixed(4)}`).toBe(craterProfile(s, D));
      }
    }
  });

  it('a warm, tidally-heated (Enceladus-class) icy surface relaxes strongly (ε large)', () => {
    const warm = { T_eq: 100, rawTidalIoRatio: 50, surfaceGravity: 0.13 };
    const { epsBowl } = iceRelaxation(warm, 50, 4.0, 1.0);
    expect(epsBowl, 'warm/tidal ⇒ heavily relaxed').toBeGreaterThan(0.5);
  });

  it('∂ε/∂D > 0 — a LARGER crater relaxes more (τ ∝ 1/D)', () => {
    const sens = { T_eq: 155, rawTidalIoRatio: 0, surfaceGravity: 0.13 };   // τ ~ age at D≈10 km ⇒ ε partial + sensitive
    const eps = [1, 3, 10, 30].map((D) => iceRelaxation(sens, D, 4.0, 1.0).epsBowl);
    for (let i = 1; i < eps.length; i++) {
      expect(eps[i], `ε rises with D: ${eps[i - 1].toFixed(3)} → ${eps[i].toFixed(3)}`).toBeGreaterThan(eps[i - 1]);
      expect(eps[i], 'ε stays in (0,1) — the sensitive regime, not saturated').toBeLessThan(1);
    }
    expect(eps[0]).toBeGreaterThan(0);
  });

  it('the domed-floor term and the P_RIM=2 rim-persistence term are present', () => {
    // Dome: a fully-relaxed floor (epsBowl=1) bulges UP to +A·DOME_FRAC at centre (vs the un-relaxed −A bowl).
    for (const D of [0.2, 0.5]) {
      const A = craterAmplitude(D);
      const domeCentre = relaxedCraterProfile(0, D, 1, 0);
      expect(domeCentre, `relaxed floor domes UP at D=${D}`).toBeGreaterThan(0);
      expect(domeCentre, `dome height = A·DOME_FRAC at D=${D}`).toBeCloseTo(A * DOME_FRAC, 12);
      expect(craterProfile(0, D), 'un-relaxed floor is a bowl (negative)').toBeLessThan(0);
    }
    // P_RIM=2: the rim relaxation time-scale is τ·(1/RIM_W)^P_RIM = 100·τ ⇒ rims persist while bowls dome.
    expect(P_RIM).toBe(2);
    const r = iceRelaxation({ T_eq: 155, rawTidalIoRatio: 0, surfaceGravity: 0.13 }, 10, 4.0, 1.0);
    expect(r.tauRimGa / r.tauGa, 'rim relaxes 100× slower (P_RIM=2)').toBeCloseTo(100, 6);
    expect(r.epsRim, 'rim ε < bowl ε at the same crater (rim persists)').toBeLessThan(r.epsBowl);
  });

  it('iceness=0 (rock) ⇒ ε ≡ 0 exactly — granite does not flow', () => {
    const warm = { T_eq: 300, rawTidalIoRatio: 50, surfaceGravity: 1.0 };
    const { epsBowl, epsRim } = iceRelaxation(warm, 20, 4.5, 0);
    expect(epsBowl).toBe(0);
    expect(epsRim).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-6 AC-ICENESS — condition-derived icy-material fraction + the S3 material channel', () => {
  it('iceness targets (Lens L7): Frozen/Europa/Titan HIGH, Crystal nonzero-LOW, Moon/Mercury/Mars/Rocky ≈0', () => {
    expect(icenessOf(condOf('Frozen (airless)')), 'Frozen HIGH').toBeGreaterThan(0.3);
    expect(icenessOf(condOf('Europa (icy moon)')), 'Europa HIGH').toBeGreaterThan(0.9);
    expect(icenessOf(condOf('Titan (methane seas)')), 'Titan HIGH').toBeGreaterThan(0.3);
    // Crystal reads nonzero-LOW BY DESIGN — its density (3.0) + tiny volatile budget cap it; the Frozen-pairing
    // driver is crystallizationPotential (S4), NOT iceness (Lens L7).
    const cry = icenessOf(condOf('Crystal (faceted)'));
    expect(cry, 'Crystal nonzero').toBeGreaterThan(0);
    expect(cry, 'Crystal LOW').toBeLessThan(0.15);
    for (const n of ['Moon/Mercury (impact-airless)', 'Mars (arid rocky)', 'Rocky (Earthlike)']) {
      expect(icenessOf(condOf(n)), `${n} ≈0`).toBeLessThan(0.05);
    }
  });

  it('relief.surfaceMaterial is populated on EVERY dispatch path with EXACTLY the S3 keys { iceness, regolithRoughness }', () => {
    // Presets spanning the dispatch chain: despun-icy (Frozen), shell-icy (Europa), plate (Rocky), stagnant-lid
    // (Venus), volcanic heat-pipe (Lava), despun-gas (Jovian), dead-lid rocky (Mars), nonzero-low icy (Crystal).
    const presets = [
      'Frozen (airless)', 'Europa (icy moon)', 'Rocky (Earthlike)', 'Venus (sulfuric shroud)',
      'Lava (hot airless)', 'Gas giant (Jovian)', 'Mars (arid rocky)', 'Crystal (faceted)',
    ];
    for (const name of presets) {
      const carrier = makeSphereField(buildIrregularSphere(700, 2));
      const relief = writeBodyRelief(carrier, reliefBundle(name, 1));
      expect(relief.surfaceMaterial, `${name} has a surfaceMaterial channel`).toBeTruthy();
      expect(Object.keys(relief.surfaceMaterial).sort(), `${name} S3 channel shape`).toEqual(['iceness', 'regolithRoughness']);
      expect(typeof relief.surfaceMaterial.iceness, `${name} iceness numeric`).toBe('number');
      expect(typeof relief.surfaceMaterial.regolithRoughness, `${name} regolithRoughness numeric`).toBe('number');
      expect(relief.surfaceMaterial.iceness, `${name} iceness matches icenessOf(cond)`).toBe(icenessOf(condOf(name)));
    }
  });
});
