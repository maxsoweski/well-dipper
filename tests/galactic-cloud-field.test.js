// Galactic Engine S1 — the shared density field (CPU twin), AC-1 subset for step 1:
// same seed identical, different seeds decorrelated, log-density single-peaked with real spread.
// Each check is a named function that also runs on a broken control (a constant field) and must fail it.
import { describe, it, expect } from 'vitest';
import { logStructure, density, valueNoise } from '../src/galactic/cloudFieldCPU.js';
import { featureHistory } from '../src/galactic/featureHistory.js';
import { renderPack } from '../src/galactic/renderPacks.js';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { FBM_STD } from '../src/galactic/cloudConstants.js';

const gm = new GalacticMap('well-dipper-galaxy-1');
const nebulae = gm.findNearbyFeatures(gm.getStartPosition(), 3.0).filter((f) => f.type === 'emission-nebula' && !f.isKnownObject);
const packA = renderPack(featureHistory(nebulae[0]), { overrides: {} });
const packB0 = renderPack(featureHistory(nebulae[1]), { overrides: {} });
// Same geometry and scale, different seed: only the seeded noise offset differs.
const packB = { ...packA, noise: { ...packA.noise, offset: packB0.noise.offset } };

function grid(fn, R, n = 24) {
  const out = new Float64Array(n * n * n);
  let i = 0;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    out[i++] = fn([((x + 0.5) / n - 0.5) * R, ((y + 0.5) / n - 0.5) * R, ((z + 0.5) / n - 0.5) * R]);
  }
  return out;
}

function checkIdentical(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error(`differs at ${i}`);
}

function checkDecorrelated(a, b, maxCorr = 0.5) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i] / n; mb += b[i] / n; }
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  const corr = sab / Math.sqrt(saa * sbb);
  if (!Number.isFinite(corr)) throw new Error('correlation undefined (a constant field)');
  if (Math.abs(corr) >= maxCorr) throw new Error(`correlation ${corr.toFixed(3)} >= ${maxCorr}`);
  return corr;
}

function checkSinglePeakedSpread(values, bins = 24) {
  let mean = 0;
  for (const v of values) mean += v / values.length;
  let sd = 0;
  for (const v of values) sd += (v - mean) ** 2 / values.length;
  sd = Math.sqrt(sd);
  if (!(sd > 0.3)) throw new Error(`log-density spread ${sd} too small (uniform fog)`);
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const h = new Array(bins).fill(0);
  for (const v of values) h[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  const s = h.map((_, i) => (h[i - 1] ?? 0) + h[i] + (h[i + 1] ?? 0)); // 3-bin smoothing
  const peakFloor = 0.05 * Math.max(...s);
  let peaks = 0;
  for (let i = 0; i < bins; i++) if (s[i] > peakFloor && s[i] >= (s[i - 1] ?? -1) && s[i] > (s[i + 1] ?? -1)) peaks++;
  if (peaks !== 1) throw new Error(`${peaks} peaks`);
  return sd;
}

const R = packA.radiusPc;
const logA = grid((p) => logStructure(p, packA), 2 * R);
const logA2 = grid((p) => logStructure(p, packA), 2 * R);
const logB = grid((p) => logStructure(p, packB), 2 * R);
const constField = new Float64Array(logA.length).fill(0.25); // broken control

describe('density field', () => {
  it('same seed → byte-identical samples', () => {
    expect(() => checkIdentical(logA, logA2)).not.toThrow();
    const d1 = grid((p) => density(p, packA), 1.6 * R, 12), d2 = grid((p) => density(p, packA), 1.6 * R, 12);
    expect(() => checkIdentical(d1, d2)).not.toThrow();
  });

  it('different seeds → correlation < 0.5', () => {
    expect(() => checkDecorrelated(logA, logB)).not.toThrow();
  });

  it('BROKEN CONTROL: a constant field fails the decorrelation check', () => {
    expect(() => checkDecorrelated(constField, constField)).toThrow();
  });

  it('log-density histogram is single-peaked with real spread (not uniform fog)', () => {
    expect(() => checkSinglePeakedSpread(Array.from(logA))).not.toThrow();
  });

  it('BROKEN CONTROL: a constant field fails the histogram check', () => {
    expect(() => checkSinglePeakedSpread(Array.from(constField))).toThrow(/spread/);
  });

  it('FBM_STD matches the measured spread of the fBm sum (keeps sigma in standard units)', () => {
    let n = 0, s1 = 0, s2 = 0;
    for (let i = 0; i < 40000; i++) {
      const x = 200 + (i % 97) * 3.17, y = 300 + ((i * 7) % 89) * 2.71, z = 400 + ((i * 13) % 83) * 1.93;
      let sum = 0, amp = 0.5, fr = 1;
      for (let o = 0; o < 5; o++) { sum += amp * (valueNoise(x * fr, y * fr, z * fr) - 0.5); amp *= 0.5; fr *= 2; }
      n++; s1 += sum; s2 += sum * sum;
    }
    const sd = Math.sqrt(s2 / n - (s1 / n) ** 2);
    expect(Math.abs(sd - FBM_STD) / FBM_STD).toBeLessThan(0.15);
  });
});
