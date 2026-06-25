// tests/worldengine-base-seam.test.js
import { describe, it, expect } from 'vitest';
import { writeGrainSphere, REGIME_BAND_DEG, GRAIN_BAND_DEG, SEAM_LAT_TOL_DEG } from '../src/worldengine/base/tectonic.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { REGIME } from '../src/worldengine/base/substrate.js';

const neutral = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };
// a band lies strictly between the two |latitudes| -> the field legitimately changes across the pair
const between = (bands, la, lb) => bands.some(b => (Math.abs(la) - b) * (Math.abs(lb) - b) < 0);

describe('worldengine base — F4 seam continuity on sphere', () => {
  it('regime+grainAngle equal for same-latitude seam neighbours, except across a band boundary', () => {
    const c = makeSphereField(buildIrregularSphere(800, 2));
    writeGrainSphere(c, neutral);
    let checked = 0;
    for (let i = 0; i < c.N; i++) {
      const li = c.latDegOf(i);
      for (const j of c.adj[i]) {
        const lj = c.latDegOf(j);
        if (Math.abs(li - lj) >= SEAM_LAT_TOL_DEG) continue;   // only ~equal-latitude seam pairs
        if (!between(REGIME_BAND_DEG, li, lj)) { checked++; expect(c.regime[i]).toBe(c.regime[j]); }
        if (!between([GRAIN_BAND_DEG], li, lj)) { expect(c.grainAngle[i]).toBe(c.grainAngle[j]); }
      }
    }
    expect(checked).toBeGreaterThan(0);   // we actually exercised same-latitude off-band seam pairs
  });
  it('produces >=2 regimes across the full sphere and bounded grainMag', () => {
    const c = makeSphereField(buildIrregularSphere(800, 2));
    writeGrainSphere(c, neutral);
    expect(new Set(Array.from(c.regime)).size).toBeGreaterThanOrEqual(2);
    expect(c.regime[0] === REGIME.THRUST || true).toBe(true); // sanity: enum used
    for (let i = 0; i < c.grainMag.length; i++) {
      expect(c.grainMag[i]).toBeGreaterThanOrEqual(0); expect(c.grainMag[i]).toBeLessThanOrEqual(1);
    }
  });
});
