// tests/ws4-grain-oracle.test.js
// WS4 T1 — pin the E6 grain oracle ON THE SPHERE CARRIER (net-new coverage, not "reuse").
//
// Why this exists (plan §T1 HONESTY): worldengine-base-tectonic.test.js exercises stressAtLat +
// the FLAT writeGrain (row-quantized substrate). writeGrainSphere over a buildIrregularSphere
// carrier (continuous Fibonacci latitudes, NOT row-quantized) had effectively ZERO direct
// regime/grain-band coverage outside the seam test's continuity check. This file is the FIRST
// test of the sphere writer's PER-NODE regime correctness, including band-boundary aliasing on the
// irregular mesh near 38.33° / 45° / 57.69°.
//
// Source of truth: src/worldengine/base/tectonic.js (the PROD WS2 copy — D10). No production MATH
// change is made by T1; it PROVES + pins the sphere source of truth.
import { describe, it, expect } from 'vitest';
import {
  stressAtLat,
  writeGrainSphere,
  REGIME_BAND_DEG,   // ≈ [38.33, 57.69]  (THRUST|STRIKESLIP, STRIKESLIP|NORMAL boundaries)
  GRAIN_BAND_DEG,    // 45  (grainAngle flip)
} from '../src/worldengine/base/tectonic.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { REGIME } from '../src/worldengine/base/substrate.js';

const neutral = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };
const HALF_PI_F32 = Math.fround(Math.PI / 2);

// Oracle regime for a given |lat| at neutral strain (despin-amp-invariant bands):
//   |φ| < 38.33° → THRUST ; 38.33° < |φ| < 57.69° → STRIKESLIP ; |φ| > 57.69° → NORMAL
function oracleRegime(latDeg) {
  const a = Math.abs(latDeg);
  if (a < REGIME_BAND_DEG[0]) return REGIME.THRUST;
  if (a < REGIME_BAND_DEG[1]) return REGIME.STRIKESLIP;
  return REGIME.NORMAL;
}
// Oracle grainAngle (read-back, Float32): below 45° → fround(π/2), above 45° → 0.
function oracleGrainF32(latDeg) {
  return Math.abs(latDeg) < GRAIN_BAND_DEG ? HALF_PI_F32 : 0;
}

describe('WS4 T1 — E6 grain oracle, scalar (stressAtLat)', () => {
  it('regime follows the latitude band oracle at neutral strain (equator/mid/pole)', () => {
    expect(stressAtLat(0, neutral).regime).toBe(REGIME.THRUST);      // equator
    expect(stressAtLat(48, neutral).regime).toBe(REGIME.STRIKESLIP); // mid-lat (38.33..57.69)
    expect(stressAtLat(85, neutral).regime).toBe(REGIME.NORMAL);     // pole
  });

  it('grainAngle quantizes 0 / π/2 with the flip at 45°', () => {
    // raw scalar return is an exact JS number (π/2), not yet Float32-quantized
    expect(stressAtLat(30, neutral).grainAngle).toBe(Math.PI / 2);   // below 45° → π/2
    expect(stressAtLat(60, neutral).grainAngle).toBe(0);             // above 45° → 0
  });

  it('contraction (+1) biases toward THRUST vs expansion (-1) at fixed latitude', () => {
    const c = stressAtLat(50, { despinAmp: 1, radialStrainSign: +1, radialStrainMag: 0.3 });
    const e = stressAtLat(50, { despinAmp: 1, radialStrainSign: -1, radialStrainMag: 0.3 });
    expect(c.regime).toBeGreaterThanOrEqual(e.regime); // higher enum value = toward THRUST(2)
  });
});

describe('WS4 T1 — E6 grain oracle ON THE SPHERE CARRIER (writeGrainSphere)', () => {
  // Build the carrier ONCE (irregular Fibonacci mesh + 2 Lloyd relax — same as the seam test).
  const carrier = makeSphereField(buildIrregularSphere(800, 2));
  writeGrainSphere(carrier, neutral);

  it('per-node regime matches the oracle band at each read-back latitude (off the band edges)', () => {
    // Guard band: skip nodes within 1.0° of a regime boundary so float-edge aliasing on the
    // irregular mesh isn't conflated with a real regime error (the seam test owns boundary continuity).
    const MARGIN = 1.0;
    const nearBoundary = (lat) =>
      REGIME_BAND_DEG.some((b) => Math.abs(Math.abs(lat) - b) < MARGIN);
    let checkedThrust = 0, checkedStrike = 0, checkedNormal = 0;
    for (let i = 0; i < carrier.N; i++) {
      const lat = carrier.latDegOf(i);
      if (nearBoundary(lat)) continue;
      const expected = oracleRegime(lat);
      expect(carrier.regime[i]).toBe(expected);
      if (expected === REGIME.THRUST) checkedThrust++;
      else if (expected === REGIME.STRIKESLIP) checkedStrike++;
      else checkedNormal++;
    }
    // We actually exercised all three regime bands on the sphere (net-new coverage, not vacuous).
    expect(checkedThrust).toBeGreaterThan(0);
    expect(checkedStrike).toBeGreaterThan(0);
    expect(checkedNormal).toBeGreaterThan(0);
  });

  it('per-node grainAngle matches the oracle flip (read back as Float32, off the 45° edge)', () => {
    const MARGIN = 1.0;
    let checkedLow = 0, checkedHigh = 0;
    for (let i = 0; i < carrier.N; i++) {
      const lat = carrier.latDegOf(i);
      if (Math.abs(Math.abs(lat) - GRAIN_BAND_DEG) < MARGIN) continue; // skip the 45° flip edge
      expect(carrier.grainAngle[i]).toBe(oracleGrainF32(lat));
      if (Math.abs(lat) < GRAIN_BAND_DEG) checkedLow++; else checkedHigh++;
    }
    expect(checkedLow).toBeGreaterThan(0);   // |lat|<45 → π/2 nodes exist
    expect(checkedHigh).toBeGreaterThan(0);  // |lat|>45 → 0 nodes exist
  });

  it('spot-checks specific representative latitudes are present and correctly classified', () => {
    // Find the node nearest a target latitude and assert it carries the oracle band value.
    const nearestTo = (targetLat) => {
      let best = -1, bestErr = Infinity;
      for (let i = 0; i < carrier.N; i++) {
        const err = Math.abs(carrier.latDegOf(i) - targetLat);
        if (err < bestErr) { bestErr = err; best = i; }
      }
      return best;
    };
    for (const targetLat of [0, 48, 85, -48, -85]) {
      const i = nearestTo(targetLat);
      const lat = carrier.latDegOf(i);
      // the nearest node sits within a fraction of a degree of the target on an 800-node mesh,
      // well inside the band; classify against its OWN read-back latitude.
      expect(carrier.regime[i]).toBe(oracleRegime(lat));
    }
  });

  it('grainMag is bounded [0,1] and >=2 regimes appear across the full sphere', () => {
    for (let i = 0; i < carrier.grainMag.length; i++) {
      expect(carrier.grainMag[i]).toBeGreaterThanOrEqual(0);
      expect(carrier.grainMag[i]).toBeLessThanOrEqual(1);
    }
    expect(new Set(Array.from(carrier.regime)).size).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic: writeGrainSphere twice over the SAME carrier → byte-identical arrays', () => {
    const beforeAngle = Float32Array.from(carrier.grainAngle);
    const beforeMag = Float32Array.from(carrier.grainMag);
    const beforeRegime = Uint8Array.from(carrier.regime);
    writeGrainSphere(carrier, neutral); // re-run over the same carrier (no rng → byte-identical)
    expect(Array.from(carrier.grainAngle)).toEqual(Array.from(beforeAngle));
    expect(Array.from(carrier.grainMag)).toEqual(Array.from(beforeMag));
    expect(Array.from(carrier.regime)).toEqual(Array.from(beforeRegime));
  });
});
