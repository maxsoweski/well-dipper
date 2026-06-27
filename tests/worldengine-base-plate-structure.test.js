// tests/worldengine-base-plate-structure.test.js
// AC2 gate — THE load-bearing anti-"place uplift-as-noise + erode = eroded noise" guard.
//
// Proves the placed U field has CONVERGENT-SPECIFIC TECTONIC STRUCTURE, not noise and not merely
// "high near any boundary": uplift AT classified CONVERGENT boundaries (ranges), rift/low at
// DIVERGENT boundaries, quiet cratonic INTERIORS — and U correlates with the plate-boundary geometry
// the generator produced. Hardened (per the AC1/AC2 adversarial review) so it can't be passed by a
// base-elevation step, a self-correlation, or a boundary-generic field:
//
//   1. INDEPENDENT predictor — the "signed distance-to-nearest-classified-boundary" field is rebuilt
//      HERE from the published boundaryClass labels via BFS over carrier.adj (falloff to nearest
//      CONVERGENT minus falloff to nearest DIVERGENT). It is NOT the generator's internal
//      signedProximity, so |corr(U, predictor)| >= 0.5 is a real cross-check, not graded homework.
//   2. BASE-CONFOUND-FREE — the convergent>uplift / divergent>rift / interior>quiet claim is asserted
//      on the TECTONIC SIGNAL (U minus the per-node plate base elevation), so it measures uplift, not
//      the continental-rides-higher-than-oceanic base step it would otherwise get for free.
//   3. CONVERGENT-SPECIFIC — a "boundary-generic" control (high at ALL boundaries, sign-agnostic)
//      gives convergent and divergent nodes the IDENTICAL value (gap 0), so it provably fails the
//      convergent-vs-divergent discrimination the real field passes. That, plus the contract's
//      pure-noise and latitude-only required-failures, is what makes this the real anti-noise bar.
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writePlateUpliftSphere, BOUNDARY } from '../src/worldengine/base/plates.js';
import { stressAtLat } from '../src/worldengine/base/tectonic.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { createNoise3D } from 'simplex-noise';
import alea from 'alea';

// Resolution note (per the tectonics adversarial review): the uplift belt is geodesic (BELT_RADIANS
// ≈ 0.058 rad). On a tiny 600-node carrier mean edge ≈ 0.15 rad, so the belt is NARROWER than one hop
// and collapses to a ~1-node rim — not representative of the ~40k lab mesh. At TARGET_N=4000 mean edge
// ≈ 0.062 rad (belt/edge ≈ 1), so the inward SPREAD is genuinely exercised. The structure was verified
// robust and STRENGTHENING with resolution (conv/int 2.1→2.7, tect-gap 0.47→0.84 from 600→40k); the
// live AC7 covers full production resolution. The same mesh is reused across seeds (deterministic).
const TARGET_N = 4000, LLOYD = 2;
const SHARED_MESH = buildIrregularSphere(TARGET_N, LLOYD);
const drivers = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };
// A representative set of Earth-like seeds (lab default 1 + others incl. the low-plate-count seed 7).
// The structure bar is asserted for EACH — the structure is the generator's behaviour, not one lucky seed.
const SEEDS = [1, 2, 3, 7, 42];
const PREDICTOR_BELT = 0.06;   // radians — falloff length for the independent boundary-proximity predictor

const meanOf = (a, idx) => { let s = 0; for (const i of idx) s += a[i]; return idx.length ? s / idx.length : 0; };
const moments = (a) => { const n = a.length; let m = 0; for (let i = 0; i < n; i++) m += a[i]; m /= n; let v = 0; for (let i = 0; i < n; i++) v += (a[i] - m) ** 2; return { m, sd: Math.sqrt(v / n) }; };
function pearson(a, b) {
  const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let cab = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cab += da * db; va += da * da; vb += db * db; }
  return cab / (Math.sqrt(va * vb) || 1);
}
// multi-source BFS hop distance to the nearest node in srcSet over carrier.adj
function bfsDist(adj, N, srcSet) {
  const d = new Int32Array(N).fill(-1); const q = new Int32Array(N); let h = 0, t = 0;
  for (const s of srcSet) { d[s] = 0; q[t++] = s; }
  while (h < t) { const c = q[h++]; for (const nb of adj[c]) if (d[nb] < 0) { d[nb] = d[c] + 1; q[t++] = nb; } }
  return d;
}

function analyze(macroSeed) {
  const carrier = makeSphereField(SHARED_MESH);
  const diag = writePlateUpliftSphere(carrier, drivers, { macroSeed });
  const { U, boundaryClass, baseElevField, meanEdgeAngle } = diag;
  const N = carrier.N, adj = carrier.adj;

  const conv = [], div = [], trans = [], interior = [], anyB = [];
  for (let i = 0; i < N; i++) {
    const c = boundaryClass[i];
    if (c === BOUNDARY.CONVERGENT) { conv.push(i); anyB.push(i); }
    else if (c === BOUNDARY.DIVERGENT) { div.push(i); anyB.push(i); }
    else if (c === BOUNDARY.TRANSFORM) { trans.push(i); anyB.push(i); }
    else interior.push(i);
  }

  // (1) INDEPENDENT predictor from the published labels only: falloff(distToConv) - falloff(distToDiv)
  const dC = bfsDist(adj, N, conv), dD = bfsDist(adj, N, div);
  const indep = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const fC = dC[i] >= 0 ? Math.exp(-(dC[i] * meanEdgeAngle) / PREDICTOR_BELT) : 0;
    const fD = dD[i] >= 0 ? Math.exp(-(dD[i] * meanEdgeAngle) / PREDICTOR_BELT) : 0;
    indep[i] = fC - fD;
  }

  // (2) base-confound-free TECTONIC SIGNAL = U minus the per-node plate base elevation
  const tect = new Float32Array(N); for (let i = 0; i < N; i++) tect[i] = U[i] - baseElevField[i];

  // (3) BOUNDARY-GENERIC control: matched-moment, high at ALL boundaries, sign-agnostic
  const dAny = bfsDist(adj, N, anyB);
  const genRaw = new Float32Array(N); for (let i = 0; i < N; i++) genRaw[i] = dAny[i] >= 0 ? Math.exp(-(dAny[i] * meanEdgeAngle) / PREDICTOR_BELT) : 0;
  const { m: uM, sd: uSD } = moments(U);
  const { m: gM, sd: gSD } = moments(genRaw);
  const gen = new Float32Array(N); for (let i = 0; i < N; i++) gen[i] = uM + uSD * ((genRaw[i] - gM) / (gSD || 1));

  // pure-noise + latitude-only controls (matched moments) — the contract's required failures
  const nNoise = createNoise3D(alea('ac2:noise-control:' + macroSeed));
  const lat = new Float32Array(N); for (let i = 0; i < N; i++) lat[i] = stressAtLat(carrier.latDegOf(i), drivers).sMer;
  const { m: lM, sd: lSD } = moments(lat);
  const noiseU = new Float32Array(N), latU = new Float32Array(N);
  for (let i = 0; i < N; i++) { const d = carrier.verts[i]; noiseU[i] = uM + uSD * nNoise(d[0] * 3.1, d[1] * 3.1, d[2] * 3.1); latU[i] = uM + uSD * ((lat[i] - lM) / (lSD || 1)); }

  return {
    nConv: conv.length, nDiv: div.length, nInterior: interior.length,
    // contract bars (on U)
    ratioConvInterior: meanOf(U, conv) / meanOf(U, interior),
    divLtInterior: meanOf(U, div) < meanOf(U, interior),
    corrIndep: Math.abs(pearson(Array.from(U), Array.from(indep))),
    noiseRatio: meanOf(noiseU, conv) / (meanOf(noiseU, interior) || 1e-9),
    latRatio: meanOf(latU, conv) / (meanOf(latU, interior) || 1e-9),
    // base-confound-free tectonic-signal bars
    tectConv: meanOf(tect, conv), tectDiv: meanOf(tect, div),
    tectInterior: meanOf(tect, interior), tectTransform: meanOf(tect, trans),
    // convergent-specific discrimination: real gap vs boundary-generic gap
    tectConvDivGap: meanOf(tect, conv) - meanOf(tect, div),
    genConvDivGap: meanOf(gen, conv) - meanOf(gen, div),
  };
}

describe('worldengine base — plate uplift is CONVERGENT-SPECIFIC tectonic structure, not noise (AC2)', () => {
  for (const seed of SEEDS) {
    describe(`Earth-like seed ${seed}`, () => {
      const r = analyze(seed);

      it('both convergent AND divergent boundaries are present (a real partition, not degenerate)', () => {
        expect(r.nConv).toBeGreaterThan(0);
        expect(r.nDiv).toBeGreaterThan(0);
        expect(r.nInterior).toBeGreaterThan(0);
      });

      // ── contract observables ───────────────────────────────────────────────────────────────────
      it('[contract] mean U at convergent boundaries >= 2x mean U at cratonic interiors', () => {
        expect(r.ratioConvInterior).toBeGreaterThanOrEqual(2);
      });
      it('[contract] mean U at divergent boundaries is below the interior mean (rift / low ground)', () => {
        expect(r.divLtInterior).toBe(true);
      });
      it('[contract] |corr(U, INDEPENDENT label-derived signed boundary distance)| >= 0.5', () => {
        expect(r.corrIndep).toBeGreaterThanOrEqual(0.5);
      });
      it('[contract] REQUIRED FAILURE — pure-noise control does NOT pass convergent>=2x-interior', () => {
        expect(r.noiseRatio).toBeLessThan(2);
      });
      it('[contract] REQUIRED FAILURE — latitude-only control does NOT pass convergent>=2x-interior', () => {
        expect(r.latRatio).toBeLessThan(2);
      });

      // ── base-confound-free: the tectonic signal (U minus plate base elevation) ───────────────────
      it('tectonic signal: convergent boundaries UPLIFT above base (mean > 0)', () => {
        expect(r.tectConv).toBeGreaterThan(0.15);
      });
      it('tectonic signal: divergent boundaries RIFT below base (mean < 0)', () => {
        expect(r.tectDiv).toBeLessThan(0);
      });
      it('tectonic signal: cratonic interiors are QUIET (≈ base level, |mean| small)', () => {
        expect(Math.abs(r.tectInterior)).toBeLessThan(0.15);
      });
      it('tectonic signal: transform (the largest class) sits between rift and uplift', () => {
        expect(r.tectDiv).toBeLessThan(r.tectTransform);
        expect(r.tectTransform).toBeLessThan(r.tectConv);
      });

      // ── convergent-SPECIFIC: real field discriminates conv vs div; boundary-generic field CANNOT ──
      it('uplift is CONVERGENT-SPECIFIC: a boundary-generic control gives conv==div (gap 0); real gap is large', () => {
        expect(Math.abs(r.genConvDivGap)).toBeLessThan(0.05);   // sign-agnostic field can't tell conv from div
        expect(r.tectConvDivGap).toBeGreaterThan(0.3);          // the real field separates them strongly
      });
    });
  }
});
