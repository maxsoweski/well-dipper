// Unit tests for Stage-C step 3 — RELIEF domain (integration-index §3 Stage-2,
// relief doc F1–F10). Pins the CPU side of the relief features: the deriveUniforms
// crater surfacings (F2) and the craterProfile() oracle the GLSL crater combiner is
// transcribed from. Seam-freeness + the lit look are verified VISUALLY on :9223;
// here we pin the LOGIC (gravity gates morphology, icy worlds relax, etc.) and the
// analytic gradient (the relief-doc §5.4 silent-bug class — wrong normals compile fine).
import { describe, it, expect } from 'vitest';
import { deriveUniforms, craterProfile } from '../planet-lod-lab-core.js';

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
