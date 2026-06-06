// Unit tests for Stage-C step 3 — RELIEF domain (integration-index §3 Stage-2,
// relief doc F1–F10). Pins the CPU side of the relief features: the deriveUniforms
// crater surfacings (F2) and the craterProfile() oracle the GLSL crater combiner is
// transcribed from. Seam-freeness + the lit look are verified VISUALLY on :9223;
// here we pin the LOGIC (gravity gates morphology, icy worlds relax, etc.) and the
// analytic gradient (the relief-doc §5.4 silent-bug class — wrong normals compile fine).
import { describe, it, expect } from 'vitest';
import { deriveUniforms, craterProfile, ridgedFold } from '../planet-lod-lab-core.js';

// ── F2 crater generation-side surfacings (relief doc §F2.b) ──────────────────
describe('craterDensity (F2 — surface age via bombardment net of resurfacing)', () => {
  // craterDensity = bombardmentIntensity × (1 − resurfacingRate): old heavily-
  // bombarded surfaces are crater-saturated; Io-grade resurfacing wipes them.
  const base = { surfaceHistory: { bombardmentIntensity: 0.8, resurfacingRate: 0 } };

  it('equals bombardment when nothing resurfaces', () => {
    expect(deriveUniforms(base).craterDensity).toBeCloseTo(0.8, 5);
  });

  it('full resurfacing (Io-grade) wipes craters to ~0', () => {
    expect(deriveUniforms({ surfaceHistory: { bombardmentIntensity: 0.8, resurfacingRate: 1 } }).craterDensity).toBeCloseTo(0, 5);
  });

  it('more bombardment → denser cratering', () => {
    const lo = deriveUniforms({ surfaceHistory: { bombardmentIntensity: 0.3, resurfacingRate: 0 } }).craterDensity;
    const hi = deriveUniforms({ surfaceHistory: { bombardmentIntensity: 0.9, resurfacingRate: 0 } }).craterDensity;
    expect(hi).toBeGreaterThan(lo);
  });

  it('stays in 0..1 and is finite on a bundle with no surfaceHistory', () => {
    const c = deriveUniforms({}).craterDensity;
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
});

describe('craterComplexD (F2 — simple→complex transition diameter ∝ g⁻¹, Melosh ch.6)', () => {
  // Transition diameter scales as 1/g: high-gravity worlds (Earth ~3 km) push craters
  // complex at SMALLER sizes than low-gravity worlds (Moon ~20 km). So a denser-g world
  // has a SMALLER craterComplexD → more of its craters show central peaks.
  it('is inversely related to surface gravity (higher g → smaller transition)', () => {
    const lowG  = deriveUniforms({ radiusEarth: 1.0, massEarth: 0.3 }).craterComplexD;  // ~0.3 g
    const highG = deriveUniforms({ radiusEarth: 1.0, massEarth: 2.0 }).craterComplexD;  // 2 g
    expect(highG).toBeLessThan(lowG);
  });

  it('icy worlds transition at a smaller diameter than rocky at the same gravity (k switch)', () => {
    const g = { radiusEarth: 1.0, massEarth: 1.0 };
    const rocky = deriveUniforms({ ...g, composition: { volatileFraction: 0.05 } }).craterComplexD;
    const icy   = deriveUniforms({ ...g, composition: { volatileFraction: 0.5 } }).craterComplexD;
    expect(icy).toBeLessThan(rocky);
  });

  it('is positive and finite (never divides by zero g)', () => {
    const c = deriveUniforms({ radiusEarth: 1.0, massEarth: 0 }).craterComplexD;
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThan(0);
  });
});

describe('craterRelaxation (F2 — icy palimpsests; viscous relaxation on warm ice)', () => {
  // Icy + warm surfaces relax craters into faint ghosts (Ganymede). Needs BOTH a
  // volatile budget AND warmth toward the ice-melt range.
  it('cold airless rocky world barely relaxes (≈0)', () => {
    const r = deriveUniforms({ composition: { volatileFraction: 0.02 }, T_eq: 200 }).craterRelaxation;
    expect(r).toBeLessThan(0.1);
  });

  it('icy + warm relaxes more than icy + cold', () => {
    const cold = deriveUniforms({ composition: { volatileFraction: 0.5 }, T_eq: 80 }).craterRelaxation;
    const warm = deriveUniforms({ composition: { volatileFraction: 0.5 }, T_eq: 260 }).craterRelaxation;
    expect(warm).toBeGreaterThan(cold);
  });

  it('stays in 0..1', () => {
    const r = deriveUniforms({ composition: { volatileFraction: 1.0 }, T_eq: 273 }).craterRelaxation;
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});

// ── craterProfile() oracle — the GLSL crater radial profile, CPU mirror ──────
// h(r): parabolic cavity (r<1) + gaussian rim (~r=1) + morphology-gated central
// peak + terrace rings, all flattened by relaxation. The GLSL transcription must
// match these; the analytic dhdr is pinned vs finite-diff (relief doc §5.4).
describe('craterProfile — radial shape invariants', () => {
  it('simple bowl is a depression at the center (h < 0 at r=0)', () => {
    expect(craterProfile(0.0, { morphology: 0 }).h).toBeLessThan(0);
  });

  it('has a raised rim near r≈1 (h > center floor)', () => {
    const floor = craterProfile(0.0, { morphology: 0 }).h;
    const rim   = craterProfile(1.0, { morphology: 0 }).h;
    expect(rim).toBeGreaterThan(floor);
  });

  it('decays to ~0 well outside the crater (r ≥ 2)', () => {
    expect(Math.abs(craterProfile(2.5, { morphology: 0 }).h)).toBeLessThan(1e-3);
  });

  it('a complex crater raises a central peak above the simple bowl floor', () => {
    const simple  = craterProfile(0.0, { morphology: 0 }).h;
    const complex = craterProfile(0.0, { morphology: 1 }).h;
    expect(complex).toBeGreaterThan(simple);
  });

  it('full relaxation flattens the whole profile toward 0 (palimpsest)', () => {
    const sharp   = craterProfile(0.0, { morphology: 0, relaxation: 0 }).h;
    const relaxed = craterProfile(0.0, { morphology: 0, relaxation: 1 }).h;
    expect(Math.abs(relaxed)).toBeLessThan(Math.abs(sharp));
    expect(relaxed).toBeCloseTo(0, 6);
  });
});

describe('craterProfile — analytic gradient (relief doc §5.4 silent-bug gate)', () => {
  const EPS = 1e-4;
  // Smooth interior radii only — skip the rim seam [0.85,1.15] and the central-peak
  // smoothstep edge, exactly as the voronoi3d test skips near-border points.
  const RADII = [0.1, 0.3, 0.55, 0.7, 1.4, 1.7, 2.0];

  it('analytic dhdr matches central finite-difference of h (interior)', () => {
    for (const m of [0, 1]) {
      for (const r of RADII) {
        const { dhdr } = craterProfile(r, { morphology: m });
        const fd = (craterProfile(r + EPS, { morphology: m }).h - craterProfile(r - EPS, { morphology: m }).h) / (2 * EPS);
        expect(dhdr).toBeCloseTo(fd, 2);
      }
    }
  });
});

// ── F1 ridgedFold — the per-octave ridged-multifractal fold (relief doc §F1.a) ─
// The single highest-risk piece of the whole RELIEF domain (doc §5.4 risk #4):
// the Decarpentier sign correction on the abs() fold. Given a noise sample
// (value, grad), the ridged signal is s = (offset − |value|), sharpened s². A
// dropped/wrong sign lights inverted faces backward yet COMPILES FINE — exactly
// the silent bug a CPU oracle pinned against finite-difference catches before the
// shader. We test the fold against finite-diff of an arbitrary smooth analytic
// field f(p) (NOT the noise itself) — that isolates the fold-gradient logic, and
// the negative-value region is precisely where the sign correction earns its keep.
describe('ridgedFold — value shape (relief doc §F1.a)', () => {
  const grad = [0.3, -0.2, 0.5];   // arbitrary; value shape is grad-independent

  it('crest (value=0) reaches the squared offset (ridge top)', () => {
    // signal = offset − |0| = offset; sharpened = offset²
    expect(ridgedFold(0.0, grad, 1.0).value).toBeCloseTo(1.0, 6);
    expect(ridgedFold(0.0, grad, 0.8).value).toBeCloseTo(0.64, 6);
  });

  it('a large |value| folds the signal toward/below zero (valley between ridges)', () => {
    const crest = ridgedFold(0.0, grad, 1.0).value;
    const flank = ridgedFold(0.6, grad, 1.0).value;
    expect(flank).toBeLessThan(crest);
  });

  it('is symmetric in the sign of value (|v| fold) — +v and −v give the same height', () => {
    expect(ridgedFold(0.4, grad, 1.0).value).toBeCloseTo(ridgedFold(-0.4, grad, 1.0).value, 8);
  });
});

describe('ridgedFold — analytic gradient vs finite-diff (relief doc §5.4 / §F1 — the sign correction)', () => {
  const EPS = 1e-5;
  // A smooth analytic field with a known gradient, chosen so it crosses zero (so
  // both the +v and −v branches of the |.| fold are exercised). f(p)=Σ aᵢsin(kᵢ·p).
  const A = [0.7, 0.5, 0.4], K = [[1.3, 0, 0], [0, 0.9, 0], [0, 0, 1.1]];
  const field = (p) => A.reduce((s, a, i) => s + a * Math.sin(K[i][0] * p[0] + K[i][1] * p[1] + K[i][2] * p[2]), 0);
  const fieldGrad = (p) => [0, 1, 2].map((axis) =>
    A.reduce((s, a, i) => s + a * K[i][axis] * Math.cos(K[i][0] * p[0] + K[i][1] * p[1] + K[i][2] * p[2]), 0));

  // Sample points; the foldedHeight is what the shader's height uses (signal²).
  const PTS = [[0.1, 0.2, 0.3], [1.7, -0.4, 0.8], [-1.1, 2.3, -0.6], [0.5, 0.5, 0.5], [2.0, 1.0, -1.3]];
  const OFFSET = 1.0;
  const foldedHeight = (p) => ridgedFold(field(p), fieldGrad(p), OFFSET).value;

  it('grad matches central finite-difference of the folded height (both sign branches)', () => {
    for (const p of PTS) {
      const g = ridgedFold(field(p), fieldGrad(p), OFFSET).grad;
      for (let axis = 0; axis < 3; axis++) {
        const pp = [...p], pm = [...p];
        pp[axis] += EPS; pm[axis] -= EPS;
        const fd = (foldedHeight(pp) - foldedHeight(pm)) / (2 * EPS);
        expect(g[axis]).toBeCloseTo(fd, 4);
      }
    }
  });

  it('would FAIL if the sign correction were dropped — detectable where value>0', () => {
    // Guard the regression: on the POSITIVE branch −sign(v) = −1, so the correct
    // gradient is the NEGATION of the naive (no-sign) form — they have opposite
    // signs. A build that forgets −sign(v) lights this ridge face backward.
    const p = [1.7, -0.4, 0.8];
    expect(field(p)).toBeGreaterThan(0);                      // ensure we're on the +v branch
    const correct = ridgedFold(field(p), fieldGrad(p), OFFSET).grad;
    const v = field(p), gd = fieldGrad(p), signal = OFFSET - Math.abs(v);
    const naiveNoSign = gd.map((d) => 2 * signal * d);        // the bug: forgets −sign(v)
    expect(correct[0]).toBeCloseTo(-naiveNoSign[0], 6);       // correct = −naive on +v branch
    expect(correct[0]).not.toBeCloseTo(naiveNoSign[0], 4);
  });
});

// ── F1 mountain generation-side surfacings (relief doc §F1.b) ────────────────
describe('mountainAmp (F1 — eroded worlds = rounded low ranges)', () => {
  it('shrinks as erosion rises', () => {
    const young = deriveUniforms({ surfaceHistory: { erosion: 0.0 } }).mountainAmp;
    const old   = deriveUniforms({ surfaceHistory: { erosion: 0.9 } }).mountainAmp;
    expect(young).toBeGreaterThan(old);
  });

  it('stays in 0..1 and is finite with no surfaceHistory', () => {
    const a = deriveUniforms({}).mountainAmp;
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });
});

describe('orogenyStrength (F1 — anisotropic fold belts: subduction proxy × young-age window)', () => {
  it('rises with habitability (water lubricates subduction, D15)', () => {
    const dry = deriveUniforms({ habitability: 0.1, surfaceHistory: { erosion: 0 } }).orogenyStrength;
    const wet = deriveUniforms({ habitability: 0.9, surfaceHistory: { erosion: 0 } }).orogenyStrength;
    expect(wet).toBeGreaterThan(dry);
  });

  it('collapses toward 0 on a fully eroded world (ranges flattened, belts gone)', () => {
    const eroded = deriveUniforms({ habitability: 0.9, surfaceHistory: { erosion: 1.0 } }).orogenyStrength;
    expect(eroded).toBeLessThan(0.05);
  });

  it('stays in 0..1', () => {
    const s = deriveUniforms({ habitability: 1.0, surfaceHistory: { erosion: 0 } }).orogenyStrength;
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('orogenyAxis (F1 — per-planet strike direction from seed)', () => {
  it('is a unit vector', () => {
    const a = deriveUniforms({ seed: 1234 }).orogenyAxis;
    expect(Math.hypot(a[0], a[1])).toBeCloseTo(1.0, 6);
  });

  it('is deterministic for a given seed', () => {
    const a = deriveUniforms({ seed: 42 }).orogenyAxis;
    const b = deriveUniforms({ seed: 42 }).orogenyAxis;
    expect(a[0]).toBeCloseTo(b[0], 12);
    expect(a[1]).toBeCloseTo(b[1], 12);
  });

  it('different seeds give different strike directions', () => {
    const a = deriveUniforms({ seed: 1 }).orogenyAxis;
    const b = deriveUniforms({ seed: 9999 }).orogenyAxis;
    expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBeGreaterThan(1e-3);
  });
});
