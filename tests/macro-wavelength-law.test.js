// tests/macro-wavelength-law.test.js
// ─────────────────────────────────────────────────────────────────────────────
// B2 LEG 3 — the gate on the base field's wavelength law itself.
//
// ⭐ WHY THIS IS A SEPARATE FILE FROM THE PACK SUITE. `tests/driver-pack-rockysurface.test.js`
// gates the WIRE: that `uNoiseScale` is emitted, that it is km-SHAPED (FAMILY 17), that its
// constants were forwarded rather than transcribed (FAMILY 11), that it is ungated (FAMILY 6b).
// NONE of those can see the LAW. A pack that emitted `sizeKm(42, C_MACRO)` would pass every one of
// them. The properties below are the ones the module's own comments claim, and a comment claiming a
// property no test holds is exactly the shape this program keeps convicting.
import { describe, it, expect } from 'vitest';
import {
  K_MACRO_R, K_MACRO_R_IO, C_MACRO, MACRO_FREQ_CEIL, macroShortening, macroWavelengthKm,
} from '../src/worldengine/base/macroWavelength.js';
import { R_EARTH_KM, featureFrequencyFromKm } from '../src/worldengine/base/featureScale.js';

// The frequency a front-end whose display radius IS the physical radius resolves — i.e. the game's
// policy, `gameDisplayRadiusEarth` being the identity. Written through the SHIPPED resolver rather
// than restated, so this file cannot drift from the one the writer actually runs.
const freqOf = (radiusEarth, rawTidal) =>
  featureFrequencyFromKm(radiusEarth, macroWavelengthKm({ radiusEarth, rawTidalIoRatio: rawTidal }), C_MACRO);

describe('the base-field wavelength law', () => {
  it('is EXACT at both calibration anchors, which is what makes them anchors', () => {
    // Anchor 1 — no tidal drive: λ = K_MACRO_R body radii, so the frequency is the pure constant.
    expect(macroShortening(0)).toBe(1);
    expect(macroWavelengthKm({ radiusEarth: 1, rawTidalIoRatio: 0 })).toBe(K_MACRO_R * R_EARTH_KM);
    // Anchor 2 — Io-grade drive (rawTidalIoRatio === 1 IS the Io normalisation): λ = K_MACRO_R_IO.
    // ⛔ EXACT, not close: the shortening is written as a ratio of the two constants precisely so
    // that the hot anchor is reproduced rather than approached.
    expect(K_MACRO_R * macroShortening(1)).toBeCloseTo(K_MACRO_R_IO, 15);
    expect(macroWavelengthKm({ radiusEarth: 1, rawTidalIoRatio: 1 })).toBeCloseTo(K_MACRO_R_IO * R_EARTH_KM, 9);
  });

  it('⭐ the RADIUS CANCELS — the base law is a CONSTANT, and that is the honest headline', () => {
    // This is the property Max is told at the UAT: a real-body calibration of this uniform is a
    // RE-CALIBRATION, not a differentiator. Two bodies 300x apart in radius and both untidal get
    // the SAME frequency, because the reference bodies put λ at ~one body radius throughout.
    const base = C_MACRO / K_MACRO_R;
    for (const R of [0.0074819117461932365, 0.15, 1, 2.5113332568768767]) {
      expect(freqOf(R, 0), `R=${R}`).toBeCloseTo(base, 12);
    }
    // …and it moved off the shipped pin. 2.8736 against 4.0 — a 1.39x LONGER wavelength.
    expect(base).toBeCloseTo(2.873563, 6);
    expect(base).not.toBe(4.0);
    // The wavelength in KM does scale with the body, which is the other half of "λ = k·R".
    expect(macroWavelengthKm({ radiusEarth: 2, rawTidalIoRatio: 0 }))
      .toBe(2 * macroWavelengthKm({ radiusEarth: 1, rawTidalIoRatio: 0 }));
  });

  it('the process term is monotone and BOUNDED — no clamp needed and none used', () => {
    // Non-increasing across twenty-nine decades of raw Io-ratio — the span the corpus actually
    // carries is 1.85e-17 … 3.48e+3 on the 632 plain moons.
    const ts = [0, 1e-17, 1e-16, 1e-12, 1e-6, 1e-3, 0.01, 0.1, 1, 10, 1e3, 1e6, 1e12];
    for (let i = 1; i < ts.length; i++) {
      expect(macroShortening(ts[i]), `t=${ts[i]}`).toBeLessThanOrEqual(macroShortening(ts[i - 1]));
    }
    // ⚠ NON-INCREASING AND NOT STRICTLY DECREASING, AND THE DIFFERENCE IS ARITHMETIC RATHER THAN
    // DESIGN — asserted here rather than described, because the first draft of this test asserted
    // strict monotonicity and RED on the corpus's own coldest bodies. `log10(1 + t)` underflows to
    // exactly 0 in float64 below t = 1.1102e-16, so everything colder lands on the base wavelength
    // bit-for-bit. MEASURED: 179 of 1160 non-gas bodies, but only 1 of 632 plain moons — which is
    // one reason the planet half of the population differentiates less than the moon half.
    expect(macroShortening(1e-17)).toBe(macroShortening(0));
    expect(macroShortening(1.1102e-16)).toBe(1);
    expect(macroShortening(2e-16)).toBeLessThan(1);            // …and it IS live just above the floor
    // Above the floor it is strictly decreasing, which is the property the differentiation rests on.
    const live = [2e-16, 1e-12, 1e-6, 1e-3, 0.01, 0.1, 1, 10, 1e3, 1e6];
    for (let i = 1; i < live.length; i++) {
      expect(macroShortening(live[i]), `t=${live[i]}`).toBeLessThan(macroShortening(live[i - 1]));
    }
    // ⛔ THE BOUND IS THE REASON THIS FORM WAS CHOSEN, so it is asserted rather than described.
    // `calibrateTidal` never reaches 1, so the shortening never reaches its infimum either.
    expect(macroShortening(Infinity)).toBeGreaterThan(0);
    expect(macroShortening(Infinity)).toBeCloseTo(0.011447, 6);
    expect(MACRO_FREQ_CEIL).toBeCloseTo(251.031, 3);
    for (const t of [1e6, 1e30, Number.MAX_VALUE]) {
      expect(freqOf(1, t), `t=${t}`).toBeLessThanOrEqual(MACRO_FREQ_CEIL);
      expect(Number.isFinite(freqOf(1, t))).toBe(true);
    }
    // [CONTROL] the two forms rejected in the module's comment really do fail this bound, so the
    // choice is falsifiable rather than asserted. The linear form goes NEGATIVE inside the corpus's
    // own range; the exponential form runs to eight figures.
    const U_IO = 0.18595476126899368;              // calibrateTidal(1), pinned so the control is arithmetic
    const uAt = (t) => Math.tanh(Math.log10(1 + t) / 1.6) / U_IO;
    expect(uAt(3484.648761505334)).toBeGreaterThan(1.0623);          // corpus max u vs the linear form's zero
    expect(1 - (1 - K_MACRO_R_IO / K_MACRO_R) * uAt(3484.648761505334)).toBeLessThan(0);
    expect(C_MACRO / (K_MACRO_R * Math.exp(-2.8367 * (1 / U_IO)))).toBeGreaterThan(1e6);
  });

  it('⛔ a body with no radius FAILS LOUDLY rather than rendering an Earth-sized wavelength', () => {
    // The module takes no fallback on the radius on purpose: a `?? 1` would be finite, plausible
    // and invisible. A non-finite size is what `writePackUniforms` refuses BY DRIVER NAME.
    expect(Number.isFinite(macroWavelengthKm({ rawTidalIoRatio: 0 }))).toBe(false);
    expect(Number.isFinite(macroWavelengthKm({}))).toBe(false);
    // …while a missing TIDAL record is a real answer — "not tidally driven" — and resolves.
    expect(macroWavelengthKm({ radiusEarth: 1 })).toBe(K_MACRO_R * R_EARTH_KM);
    expect(macroShortening(undefined)).toBe(1);
    expect(macroShortening(-5)).toBe(1);           // negative heating is clamped at "none", not signed
  });

  it('reads the RAW Io-ratio under both spellings, in the precedence baseStep.js:29 carries', () => {
    // A CONDITION spells it `rawTidalIoRatio`; a base-step-shaped bundle spells the same RAW
    // quantity `tidalHeat`. ⭐ THIS IS THE CORRECTION THAT DECIDES WHETHER MOONS MOVE AT ALL: a
    // reader that took the BOUNDED `tidalHeat` baseStep computes internally would read 0 on 632 of
    // 632 plain moons and hand the whole population one value.
    expect(macroWavelengthKm({ radiusEarth: 1, tidalHeat: 1 }))
      .toBe(macroWavelengthKm({ radiusEarth: 1, rawTidalIoRatio: 1 }));
    // …and `rawTidalIoRatio` WINS when both are present, which is the shape that survives a bundle
    // carrying a stale or defaulted second key.
    expect(macroWavelengthKm({ radiusEarth: 1, rawTidalIoRatio: 0, tidalHeat: 1 }))
      .toBe(K_MACRO_R * R_EARTH_KM);
    // ⛔ [CONTROL] the two spellings are NOT interchangeable with the bounded driver. Io-grade raw
    // heating is 1.0; the bounded dial reads ~0.186 there, and feeding the dial's value in as if it
    // were the raw ratio lands somewhere else entirely — so a future reader that "simplifies" this
    // to the calibrated field silently re-calibrates the whole population.
    expect(macroShortening(0.18595476126899368)).not.toBeCloseTo(macroShortening(1), 3);
  });
});
