// tests/worldengine-base-verify.test.js
import { describe, it, expect } from 'vitest';
import { verify } from '../src/worldengine/base/verify.js';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { writeGrain, writeGrainSphere, runE6, REGIME_BAND_DEG, SEAM_LAT_TOL_DEG } from '../src/worldengine/base/tectonic.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { REGIME } from '../src/worldengine/base/substrate.js';

const grid = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'v-1' };
const neutral = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };
const between = (bands, la, lb) => bands.some(b => (Math.abs(la) - b) * (Math.abs(lb) - b) < 0);

async function standardBundles() {
  const { PRESETS } = await import('../relief-presets.js');
  return ['rocky','lava','magma','europa','terrestrial'].map(n => PRESETS[n]);
}
function flatOutput(bundle) {
  const o = makeBaseStep(bundle, grid);
  writeGrain(o.substrate, o.drivers);   // populate grain/regime so physicallyOrdered has data
  return o;
}
function sphereOutput() {
  const c = makeSphereField(buildIrregularSphere(800, 2));
  writeGrainSphere(c, neutral);
  return { carrier: c, substrate: c, drivers: neutral, crust: {} };
}

describe('worldengine base — F7 determinism gate', () => {
  it('production base step is byte-identical across two runs for every standard bundle', async () => {
    const run = (bundle) => {
      const o = makeBaseStep(bundle, grid);
      runE6(o.substrate, o.crust, o.drivers, { name: 'tectonic-build' }, grid.seed); // populate the seeded fields
      return o;
    };
    for (const b of await standardBundles()) {
      const a = run(b), c = run(b);
      for (const f of ['height', 'grainAngle', 'grainMag', 'regime', 'faultDensity']) {
        expect(Array.from(a.substrate[f])).toEqual(Array.from(c.substrate[f]));
      }
      expect(Array.from(a.crust.crustalThickness)).toEqual(Array.from(c.crust.crustalThickness));
      for (const k of Object.keys(a.drivers)) expect(a.drivers[k]).toBe(c.drivers[k]);
      expect(a.crust.loveK2).toBe(c.crust.loveK2); expect(a.crust.thermalState).toBe(c.crust.thermalState);
    }
  });
});

describe('worldengine base — F7 verifier gate', () => {
  it('PASSES every standard bundle (flat first-wave): seamConsistent is no-op-pass', async () => {
    for (const b of await standardBundles()) {
      const v = verify(flatOutput(b));
      expect(v.signals.finite).toBe(true); expect(v.signals.bounded).toBe(true);
      expect(v.signals.seamConsistent).toBe(true);   // no adj -> defined no-op pass
      expect(v.signals.physicallyOrdered).toBe(true);
      expect(v.pass).toBe(true);
    }
  });
  it('PASSES a sphere carrier and flags each corruption with the matching signal + detail', () => {
    const good = sphereOutput();
    expect(verify(good).pass).toBe(true);
    // finite: NaN
    const c1 = sphereOutput(); c1.carrier.height[5] = NaN;
    let v = verify(c1); expect(v.signals.finite).toBe(false); expect(v.pass).toBe(false);
    expect(v.detail.join(' ')).toMatch(/finite/);
    // bounded: grainMag out of range
    const c2 = sphereOutput(); c2.carrier.grainMag[7] = 5;
    v = verify(c2); expect(v.signals.bounded).toBe(false); expect(v.pass).toBe(false); expect(v.detail.join(' ')).toMatch(/grainMag/);
    // physicallyOrdered: force poles to THRUST
    const c3 = sphereOutput();
    for (let i = 0; i < c3.carrier.N; i++) if (Math.abs(c3.carrier.latDegOf(i)) > 70) c3.carrier.regime[i] = REGIME.THRUST;
    v = verify(c3); expect(v.signals.physicallyOrdered).toBe(false); expect(v.pass).toBe(false);
    // seamConsistent: inject a regime discontinuity at an OFF-BAND same-latitude seam pair (one the verifier scans)
    const c4 = sphereOutput();
    outer4: for (let i = 0; i < c4.carrier.N; i++) {
      const li = c4.carrier.latDegOf(i);
      for (const j of c4.carrier.adj[i]) {
        const lj = c4.carrier.latDegOf(j);
        if (Math.abs(li - lj) < SEAM_LAT_TOL_DEG && !between(REGIME_BAND_DEG, li, lj)) {
          c4.carrier.regime[j] = (c4.carrier.regime[i] + 1) % 3; break outer4;
        }
      }
    }
    v = verify(c4); expect(v.signals.seamConsistent).toBe(false); expect(v.pass).toBe(false);
    // control still passes after each corruption is its own object
    expect(verify(sphereOutput()).pass).toBe(true);
  });
});
