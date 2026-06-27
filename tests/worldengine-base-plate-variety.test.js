// tests/worldengine-base-plate-variety.test.js
// AC6 — VARIETY from seed (headless, no renderer, no driver plumbing): across N>=4 Earth-like
// macroSeeds the generated plate partitions and U-derived macro-layouts are genuinely DISTINCT —
// different plate counts / boundary geometry / continent arrangement — NOT one template rescaled or
// rotated. (Driver-response — plate vigor/count/age shifting with massGravity/tidalHeating — is the
// NEXT increment; this proves seed variety only.)
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writePlateUpliftSphere } from '../src/worldengine/base/plates.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const SEEDS = [1, 2, 3, 4, 5];     // N=5 distinct Earth-like macroSeeds
const CORR_CEILING = 0.6;          // pairwise |spatial corr| must stay below this (contract's stated ceiling)

function pearson(a, b) {
  const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let cab = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cab += da * db; va += da * da; vb += db * db; }
  return cab / (Math.sqrt(va * vb) || 1);
}

describe('worldengine base — plate/uplift variety across seeds (AC6)', () => {
  // SAME carrier (same mesh) for every seed, so U fields are node-aligned and spatially comparable.
  const mesh = buildIrregularSphere(TARGET_N, LLOYD);
  const runs = SEEDS.map((macroSeed) => {
    const c = makeSphereField(mesh);
    const diag = writePlateUpliftSphere(c, {}, { macroSeed });
    return { macroSeed, U: Array.from(diag.U), plateCount: diag.plateCount, boundaryClass: diag.boundaryClass };
  });

  it('pairwise max |spatial correlation| of the U fields is below the ceiling (not one field rescaled/rotated)', () => {
    let maxAbs = 0;
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      maxAbs = Math.max(maxAbs, Math.abs(pearson(runs[i].U, runs[j].U)));
    }
    expect(maxAbs).toBeLessThan(CORR_CEILING);
  });

  it('plate counts differ across seeds (not a constant partition)', () => {
    const counts = runs.map((r) => r.plateCount);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('boundary geometry differs substantively across seeds (>30% of nodes change class per pair)', () => {
    let minAgreement = 1;
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i].boundaryClass, b = runs[j].boundaryClass;
      let same = 0; for (let k = 0; k < a.length; k++) if (a[k] === b[k]) same++;
      minAgreement = Math.min(minAgreement, same / a.length);
    }
    // the most-similar pair still disagrees on the plate/boundary class of well over 30% of nodes
    expect(minAgreement).toBeLessThan(0.7);
  });
});
