// tests/worldengine-base-viz.test.js
import { describe, it, expect } from 'vitest';
import { REGIME_LEGEND, regimeColor, grainStreak, thicknessHeat, paintField } from '../src/worldengine/base/fieldViz.js';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { writeGrain } from '../src/worldengine/base/tectonic.js';
import { REGIME, makeSubstrate, idx } from '../src/worldengine/base/substrate.js';

const grid = { n: 16, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'viz-1' };

describe('worldengine base — VIZ faithful paint', () => {
  it('regime color === the legend color for each regime', () => {
    for (const r of [REGIME.NORMAL, REGIME.STRIKESLIP, REGIME.THRUST]) {
      expect(regimeColor(r)).toEqual(REGIME_LEGEND[r]);
    }
  });
  it('grain streak orientation === grainAngle (validated on a SYNTHETIC continuous-grain substrate)', () => {
    // real E6 grain is quantized {0, pi/2}; test the paint mapping on continuous angles
    for (const ang of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2]) {
      const { dx, dy } = grainStreak(ang);
      expect(Math.atan2(dy, dx)).toBeCloseTo(ang, 6);
      expect(Math.hypot(dx, dy)).toBeCloseTo(1, 6);
    }
  });
  it('thickness heatmap is bounded and monotone in [0,1]', () => {
    const c0 = thicknessHeat(0), c1 = thicknessHeat(1);
    for (const c of [c0, c1, thicknessHeat(0.5)]) for (const ch of c) { expect(ch).toBeGreaterThanOrEqual(0); expect(ch).toBeLessThanOrEqual(255); }
    expect(c0).not.toEqual(c1);
    expect(thicknessHeat(1)[0]).toBeGreaterThan(thicknessHeat(0)[0]); // brighter red channel with thickness
  });
  it('paintField paints from source fields and is read-only (no perturbation)', () => {
    const out = makeBaseStep({ radiusEarth: 1, massEarth: 1, composition: { density: 5.5 } }, grid);
    writeGrain(out.substrate, out.drivers);
    const before = Array.from(out.substrate.regime);
    const painted = paintField(out);
    expect(painted.regimeColors.length).toBe(out.substrate.regime.length);
    // per-node fidelity: painted regime color === legend[regime[i]]
    for (let i = 0; i < out.substrate.regime.length; i++) {
      expect(painted.regimeColors[i]).toEqual(REGIME_LEGEND[out.substrate.regime[i]]);
    }
    // thickness colors === thicknessHeat(crustalThickness[i])
    for (let i = 0; i < out.crust.crustalThickness.length; i++) {
      expect(painted.thicknessColors[i]).toEqual(thicknessHeat(out.crust.crustalThickness[i]));
    }
    expect(Array.from(out.substrate.regime)).toEqual(before); // read-only
  });
});
