// Unit tests for Stage-C step 3 — RELIEF domain (integration-index §3 Stage-2,
// relief doc F1–F10). Pins the CPU side of the relief features: the deriveUniforms
// crater surfacings (F2) and the craterProfile() oracle the GLSL crater combiner is
// transcribed from. Seam-freeness + the lit look are verified VISUALLY on :9223;
// here we pin the LOGIC (gravity gates morphology, icy worlds relax, etc.) and the
// analytic gradient (the relief-doc §5.4 silent-bug class — wrong normals compile fine).
import { describe, it, expect } from 'vitest';
import { deriveUniforms, craterProfile, ridgedFold, grabenProfile, scarpProfile, terraceProfile, ridgeWave } from '../planet-lod-lab-core.js';

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

// ── F4 grabenProfile() oracle — the tectonic-rift radial profile (relief doc §F4.a) ─
// The GLSL graben combiner is transcribed from this. A linear rift on the sphere is a
// flat-floored, steep-walled trench: depth as a function of perpendicular distance d to
// the rift line (object-space, unit-sphere units). depth ≤ 0 (a trench, carved DOWN),
// = -1 on the flat floor, ramping smoothly UP to 0 at the wall top (d = halfWidth) and
// staying 0 outside. dddd = d(depth)/dd — the analytic wall slope the combiner chain-
// rules into the shading gradient; pinned vs finite-diff (relief-doc §5.4 silent-bug gate,
// same as craterProfile/ridgedFold — a sign-wrong wall lights the trench inside-out).
describe('grabenProfile — trench shape invariants (relief doc §F4.a)', () => {
  it('floor sits at -1 (fully carved) at the rift center', () => {
    expect(grabenProfile(0.0, 0.12, 0.4).depth).toBeCloseTo(-1.0, 6);
  });

  it('returns to datum (0) at the wall top and beyond', () => {
    expect(grabenProfile(0.12, 0.12, 0.4).depth).toBeCloseTo(0.0, 6);
    expect(grabenProfile(0.5, 0.12, 0.4).depth).toBeCloseTo(0.0, 6);
  });

  it('has a FLAT floor: depth is constant (-1) across the floor band', () => {
    const center = grabenProfile(0.0, 0.12, 0.4).depth;
    const innerFloor = grabenProfile(0.02, 0.12, 0.4).depth;   // floorHalf = 0.048
    expect(innerFloor).toBeCloseTo(center, 6);
    expect(grabenProfile(0.02, 0.12, 0.4).dddd).toBeCloseTo(0.0, 6);  // flat → zero slope
  });

  it('walls rise monotonically from floor to datum', () => {
    const a = grabenProfile(0.06, 0.12, 0.4).depth;   // on the wall
    const b = grabenProfile(0.09, 0.12, 0.4).depth;   // higher on the wall
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(-1.0);
    expect(b).toBeLessThan(0.0);
  });

  it('is a trench everywhere (depth ≤ 0)', () => {
    for (let d = 0; d <= 0.3; d += 0.01) {
      expect(grabenProfile(d, 0.12, 0.4).depth).toBeLessThanOrEqual(1e-9);
    }
  });
});

describe('grabenProfile — analytic gradient vs finite-diff (relief doc §5.4 silent-bug gate)', () => {
  const EPS = 1e-5;
  it('analytic dddd matches central finite-difference of depth (across the wall)', () => {
    for (let d = 0.001; d < 0.3; d += 0.003) {
      const { dddd } = grabenProfile(d, 0.12, 0.4);
      const fd = (grabenProfile(d + EPS, 0.12, 0.4).depth - grabenProfile(d - EPS, 0.12, 0.4).depth) / (2 * EPS);
      expect(dddd).toBeCloseTo(fd, 4);
    }
  });
});

// ── F4 chasma generation-side surfacings (relief doc §F4.b) ──────────────────
// chasmaDepth (the rift relief amplitude) grows with tectonic activity (resurfacing /
// plate-tectonics proxy / tidal stress) and shrinks with erosion. Dead, uneroded-but-
// inert worlds (Frozen) barely rift; tectonically-violent worlds (Lava: Io-grade tidal
// + full resurfacing) rift hard. chasmaCount (1..3) + chasmaAxes (seeded unit vec3 plane
// normals — the rift great circles) are seed-derived, deterministic.
describe('chasmaDepth (F4 — rift amplitude: tectonic activity × young-age, eroded-down)', () => {
  const LAVA = { eccentricity: 0.15, orbitRadiusEarth: 938, radiusEarth: 0.9, habitability: 0, surfaceHistory: { erosion: 0, resurfacingRate: 0.95 } };
  const FROZEN = { eccentricity: 0.005, orbitRadiusEarth: 117275, radiusEarth: 0.5, habitability: 0.05, surfaceHistory: { erosion: 0.1, resurfacingRate: 0.05 } };

  it('a tectonically-violent world rifts far deeper than a dead one', () => {
    expect(deriveUniforms(LAVA).chasmaDepth).toBeGreaterThan(deriveUniforms(FROZEN).chasmaDepth * 4);
  });

  it('a dead inert world barely rifts (near zero)', () => {
    expect(deriveUniforms(FROZEN).chasmaDepth).toBeLessThan(0.05);
  });

  it('erosion lowers the rift amplitude (rifts fill/round with age)', () => {
    const fresh  = deriveUniforms({ habitability: 0.8, surfaceHistory: { erosion: 0.0, resurfacingRate: 0.2 } }).chasmaDepth;
    const eroded = deriveUniforms({ habitability: 0.8, surfaceHistory: { erosion: 1.0, resurfacingRate: 0.2 } }).chasmaDepth;
    expect(eroded).toBeLessThan(fresh);
  });

  it('stays finite and ≥ 0 on a bundle with no history', () => {
    const d = deriveUniforms({}).chasmaDepth;
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThanOrEqual(0);
  });
});

describe('chasmaCount + chasmaAxes (F4 — seeded rift system geometry)', () => {
  it('chasmaCount is an integer in 1..3', () => {
    for (const seed of [0, 1, 42, 1234, 9999]) {
      const n = deriveUniforms({ seed }).chasmaCount;
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('chasmaAxes are 3 unit vec3 (rift-plane normals)', () => {
    const ax = deriveUniforms({ seed: 1234 }).chasmaAxes;
    expect(ax.length).toBe(3);
    for (const a of ax) expect(Math.hypot(a[0], a[1], a[2])).toBeCloseTo(1.0, 6);
  });

  it('is deterministic for a given seed', () => {
    const a = deriveUniforms({ seed: 42 }).chasmaAxes[0];
    const b = deriveUniforms({ seed: 42 }).chasmaAxes[0];
    expect(a[0]).toBeCloseTo(b[0], 12);
    expect(a[2]).toBeCloseTo(b[2], 12);
  });

  it('different seeds give different rift orientations', () => {
    const a = deriveUniforms({ seed: 1 }).chasmaAxes[0];
    const b = deriveUniforms({ seed: 9999 }).chasmaAxes[0];
    expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])).toBeGreaterThan(1e-3);
  });
});

// ── F5 scarpProfile() oracle — the fault-scarp soft-step profile (relief doc §F5.a) ─
// The GLSL scarp combiner is transcribed from this. A scarp is a ONE-SIDED cliff: a
// soft step in elevation across an iso-contour of a smooth field. height(field) =
// smoothstep(level−width, level+width, field) ∈ [0,1] — 0 on the low block, ramping up
// to 1 on the high block, FLAT outside the cliff band. dhdf = d(height)/dfield is the
// cliff-face slope the combiner chain-rules into the shading gradient; pinned vs finite-
// diff (relief-doc §5.4 silent-bug gate, like grabenProfile/craterProfile/ridgedFold).
describe('scarpProfile — cliff shape invariants (relief doc §F5.a)', () => {
  it('is 0 on the low block and 1 on the high block', () => {
    expect(scarpProfile(-0.5, 0.0, 0.15).height).toBeCloseTo(0.0, 6);
    expect(scarpProfile(0.5, 0.0, 0.15).height).toBeCloseTo(1.0, 6);
  });

  it('passes through 0.5 at the iso-level (the cliff midpoint)', () => {
    expect(scarpProfile(0.0, 0.0, 0.15).height).toBeCloseTo(0.5, 6);
    expect(scarpProfile(0.3, 0.3, 0.15).height).toBeCloseTo(0.5, 6);
  });

  it('rises monotonically across the cliff face', () => {
    const a = scarpProfile(-0.05, 0.0, 0.15).height;   // low on the face
    const b = scarpProfile(0.05, 0.0, 0.15).height;    // high on the face
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(0.0);
    expect(b).toBeLessThan(1.0);
  });

  it('has FLAT blocks: zero slope outside the cliff band', () => {
    expect(scarpProfile(-0.5, 0.0, 0.15).dhdf).toBeCloseTo(0.0, 6);
    expect(scarpProfile(0.5, 0.0, 0.15).dhdf).toBeCloseTo(0.0, 6);
  });

  it('stays in [0,1] everywhere (a bounded step)', () => {
    for (let f = -0.6; f <= 0.6; f += 0.02) {
      const h = scarpProfile(f, 0.0, 0.15).height;
      expect(h).toBeGreaterThanOrEqual(-1e-9);
      expect(h).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('scarpProfile — analytic gradient vs finite-diff (relief doc §5.4 silent-bug gate)', () => {
  const EPS = 1e-5;
  it('analytic dhdf matches central finite-difference of height (across the cliff)', () => {
    // Sweep strictly INSIDE the cliff band (|f| < width = 0.15), where the slope is
    // smooth and nonzero — sampling exactly on ±width would straddle the derivative's
    // discontinuity (the flat-block zero-slope is pinned by the shape-invariants test).
    for (let f = -0.145; f < 0.145; f += 0.0029) {
      const { dhdf } = scarpProfile(f, 0.0, 0.15);
      const fd = (scarpProfile(f + EPS, 0.0, 0.15).height - scarpProfile(f - EPS, 0.0, 0.15).height) / (2 * EPS);
      expect(dhdf).toBeCloseTo(fd, 4);
    }
  });
});

// ── F5 scarp generation-side surfacings (relief doc §F5.b) ───────────────────
// scarpStrength (the fault-scarp relief amplitude) grows as a body is SMALLER (cools/
// contracts more — Mercury/Moon lobate scarps) and shrinks with erosion. scarpStyle
// (0=thrust↔1=normal) tracks rock↔ice via volatileFraction. scarpAxis is a seeded unit
// vec3 (the scarp-front orientation), deterministic per planet.
describe('scarpStrength (F5 — cooling-contraction: smaller bodies scarp harder, eroded-down)', () => {
  it('a small body scarps harder than a large one', () => {
    const small = deriveUniforms({ radiusEarth: 0.4 }).scarpStrength;
    const large = deriveUniforms({ radiusEarth: 1.1 }).scarpStrength;
    expect(small).toBeGreaterThan(large);
  });

  it('erosion lowers the scarp amplitude (scarps wear down with age)', () => {
    const fresh  = deriveUniforms({ radiusEarth: 0.5, surfaceHistory: { erosion: 0.0 } }).scarpStrength;
    const eroded = deriveUniforms({ radiusEarth: 0.5, surfaceHistory: { erosion: 1.0 } }).scarpStrength;
    expect(eroded).toBeLessThan(fresh);
  });

  it('a big eroded world still keeps faint scarps (Earth has wrinkle ridges) but stays subtle', () => {
    const s = deriveUniforms({ radiusEarth: 1.0, surfaceHistory: { erosion: 0.4 } }).scarpStrength;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.06);
  });

  it('stays finite and ≥ 0 on an empty bundle', () => {
    const s = deriveUniforms({}).scarpStrength;
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe('scarpStyle (F5 — rock=thrust↔ice=normal from volatileFraction)', () => {
  it('a rocky world faults THRUST (style → 0)', () => {
    expect(deriveUniforms({ composition: { volatileFraction: 0.02 } }).scarpStyle).toBeLessThan(0.2);
  });

  it('an icy world faults NORMAL (style → 1)', () => {
    expect(deriveUniforms({ composition: { volatileFraction: 0.4 } }).scarpStyle).toBeGreaterThan(0.8);
  });
});

describe('scarpAxis (F5 — seeded scarp-front orientation)', () => {
  it('is a unit vec3', () => {
    const a = deriveUniforms({ seed: 1234 }).scarpAxis;
    expect(a.length).toBe(3);
    expect(Math.hypot(a[0], a[1], a[2])).toBeCloseTo(1.0, 6);
  });

  it('is deterministic for a given seed', () => {
    const a = deriveUniforms({ seed: 42 }).scarpAxis;
    const b = deriveUniforms({ seed: 42 }).scarpAxis;
    expect(a[0]).toBeCloseTo(b[0], 12);
    expect(a[2]).toBeCloseTo(b[2], 12);
  });

  it('differs from the rift axes (independent seed offset)', () => {
    const scarp = deriveUniforms({ seed: 42 }).scarpAxis;
    const rift  = deriveUniforms({ seed: 42 }).chasmaAxes[0];
    expect(Math.abs(scarp[0] - rift[0]) + Math.abs(scarp[2] - rift[2])).toBeGreaterThan(1e-3);
  });
});

// ── F6 terraceProfile() oracle — the mesa/plateau height-terrace (relief doc §F6.a) ─
// The GLSL terrace is transcribed from this. Quantizes a height into `levels` flat treads
// separated by SOFT risers (smoothstep) so the gradient exists (a hard floor(h·N)/N has
// none). value is continuous across band boundaries; only dv/dh is kinked (tread↔riser),
// pinned vs finite-diff INSIDE a riser (relief-doc §5.4 gate); flat-tread zero-slope tested.
describe('terraceProfile — mesa-step shape invariants (relief doc §F6.a)', () => {
  it('lands a tread value exactly on a band level at the tread', () => {
    // h=0.10, levels=4 → scaled 0.4, idx 0, frac 0.4 < (1−0.4)=0.6 → tread, value 0
    expect(terraceProfile(0.10, 4, 0.4).value).toBeCloseTo(0.0, 6);
    // h=0.35 → scaled 1.4, idx 1, frac 0.4 tread → value 1/4
    expect(terraceProfile(0.35, 4, 0.4).value).toBeCloseTo(0.25, 6);
  });

  it('flat treads have zero slope', () => {
    expect(terraceProfile(0.10, 4, 0.4).dvdh).toBeCloseTo(0.0, 6);
    expect(terraceProfile(0.35, 4, 0.4).dvdh).toBeCloseTo(0.0, 6);
  });

  it('the riser rises (nonzero slope between treads)', () => {
    expect(terraceProfile(0.22, 4, 0.4).dvdh).toBeGreaterThan(0.0);   // frac 0.88, in riser
  });

  it('is monotonic non-decreasing in h', () => {
    let prev = -Infinity;
    for (let h = 0; h <= 1; h += 0.013) {
      const v = terraceProfile(h, 4, 0.4).value;
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('is continuous across a band boundary (no value jump)', () => {
    const below = terraceProfile(0.2499, 4, 0.4).value;   // top of band 0
    const above = terraceProfile(0.2501, 4, 0.4).value;   // tread of band 1
    expect(Math.abs(above - below)).toBeLessThan(1e-2);
  });
});

describe('terraceProfile — analytic gradient vs finite-diff (relief doc §5.4 silent-bug gate)', () => {
  const EPS = 1e-5;
  it('analytic dvdh matches central finite-difference INSIDE a riser', () => {
    // Sweep within band 0's riser: frac ∈ (0.6,1.0) ⇒ h ∈ (0.15,0.25); stay clear of
    // the tread↔riser kink (h=0.15) and the band boundary (h=0.25) where dv/dh jumps.
    for (let h = 0.16; h < 0.245; h += 0.002) {
      const { dvdh } = terraceProfile(h, 4, 0.4);
      const fd = (terraceProfile(h + EPS, 4, 0.4).value - terraceProfile(h - EPS, 4, 0.4).value) / (2 * EPS);
      expect(dvdh).toBeCloseTo(fd, 4);
    }
  });
});

// ── F6 plateau / tessera generation-side surfacings (relief doc §F6.b) ───────
// plateauStrength (flat-topped highland amplitude) grows with tectonic activity (crustal
// thickening) and erodes down. tesseraStrength (Venus crosscutting lattice) fires ONLY on
// the most tectonically stressed worlds (a high gate), eroded-down. tesseraAxes = 2 seeded
// unit vec3 lattice orientations.
describe('plateauStrength (F6 — tectonic thickening, eroded-down)', () => {
  const ACTIVE = { habitability: 0.8, surfaceHistory: { erosion: 0.0, resurfacingRate: 0.5 } };
  const DEAD   = { habitability: 0.05, surfaceHistory: { erosion: 0.1, resurfacingRate: 0.05 } };

  it('an active world builds far more plateau than a dead one', () => {
    expect(deriveUniforms(ACTIVE).plateauStrength).toBeGreaterThan(deriveUniforms(DEAD).plateauStrength * 3);
  });

  it('erosion lowers the plateau amplitude', () => {
    const fresh  = deriveUniforms({ habitability: 0.8, surfaceHistory: { erosion: 0.0, resurfacingRate: 0.5 } }).plateauStrength;
    const eroded = deriveUniforms({ habitability: 0.8, surfaceHistory: { erosion: 1.0, resurfacingRate: 0.5 } }).plateauStrength;
    expect(eroded).toBeLessThan(fresh);
  });

  it('stays finite and ≥ 0 on an empty bundle', () => {
    const s = deriveUniforms({}).plateauStrength;
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe('tesseraStrength (F6 — only the most tectonically stressed worlds)', () => {
  it('a violently active world (Io/Venus-grade) shows tessera', () => {
    const lava = deriveUniforms({ eccentricity: 0.15, orbitRadiusEarth: 938, radiusEarth: 0.9, habitability: 0, surfaceHistory: { erosion: 0, resurfacingRate: 0.95 } });
    expect(lava.tesseraStrength).toBeGreaterThan(0.05);
  });

  it('a mild/dead world shows essentially none (high gate)', () => {
    const mild = deriveUniforms({ habitability: 0.3, surfaceHistory: { erosion: 0.2, resurfacingRate: 0.1 } });
    expect(mild.tesseraStrength).toBeLessThan(0.02);
  });

  it('stays finite and ≥ 0 on an empty bundle', () => {
    const s = deriveUniforms({}).tesseraStrength;
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe('tesseraAxes (F6 — two seeded lattice orientations)', () => {
  it('are 2 unit vec3', () => {
    const ax = deriveUniforms({ seed: 1234 }).tesseraAxes;
    expect(ax.length).toBe(2);
    for (const a of ax) expect(Math.hypot(a[0], a[1], a[2])).toBeCloseTo(1.0, 6);
  });

  it('the two lattice axes differ (a real crosscutting grid)', () => {
    const [a, b] = deriveUniforms({ seed: 1234 }).tesseraAxes;
    expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])).toBeGreaterThan(1e-3);
  });

  it('is deterministic for a given seed', () => {
    const a = deriveUniforms({ seed: 42 }).tesseraAxes[0];
    const b = deriveUniforms({ seed: 42 }).tesseraAxes[0];
    expect(a[0]).toBeCloseTo(b[0], 12);
  });
});

// ── F6 ridgeWave — the tessera crosscutting-ridge primitive (relief doc §F6.a) ─
// Tessera (Venus Ovda Regio) = two intersecting warped-iso-contour ridge fields,
// carved as `1 − |sin(phase)|` ridges and MULTIPLIED so grooves from BOTH lattice
// orientations show (the product → 0 wherever EITHER field is in a groove → the
// crosscutting lattice). The `1 − |sin|` fold has the SAME silent-bug class as
// F1's ridgedFold: its derivative `−sign(sin)·cos` carries a sign correction across
// the |.| fold that a build can drop and still compile, lighting the groove walls
// backward. So the ridge primitive is pinned vs finite-diff BEFORE the GLSL combiner.
describe('ridgeWave — ridge shape invariants (relief doc §F6.a)', () => {
  it('crests (value=1) at phase = nπ where sin=0', () => {
    expect(ridgeWave(0.0).value).toBeCloseTo(1.0, 6);
    expect(ridgeWave(Math.PI).value).toBeCloseTo(1.0, 6);
    expect(ridgeWave(2 * Math.PI).value).toBeCloseTo(1.0, 6);
  });

  it('grooves (value=0) at phase = π/2 + nπ where |sin|=1', () => {
    expect(ridgeWave(Math.PI / 2).value).toBeCloseTo(0.0, 6);
    expect(ridgeWave(3 * Math.PI / 2).value).toBeCloseTo(0.0, 6);
  });

  it('stays in [0,1] across a full period', () => {
    for (let p = 0; p < 2 * Math.PI; p += 0.05) {
      const v = ridgeWave(p).value;
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(1.0 + 1e-9);
    }
  });

  it('is symmetric about a crest (phase=0): +δ and −δ give the same height', () => {
    expect(ridgeWave(0.4).value).toBeCloseTo(ridgeWave(-0.4).value, 8);
  });
});

describe('ridgeWave — analytic derivative vs finite-diff (relief doc §5.4 silent-bug gate)', () => {
  const EPS = 1e-6;
  // Sample STRICTLY inside smooth half-periods — avoid phase = nπ (the |sin| kink,
  // where sin=0 and the derivative is discontinuous). Both the sin>0 and sin<0
  // branches are exercised so the −sign(sin) correction is pinned on both sides.
  const PTS = [0.3, 0.9, 1.4, 2.0, 2.6, 3.5, 4.2, 5.0, 5.8];

  it('dvdphase matches central finite-difference of the value', () => {
    for (const p of PTS) {
      const { dvdphase } = ridgeWave(p);
      const fd = (ridgeWave(p + EPS).value - ridgeWave(p - EPS).value) / (2 * EPS);
      expect(dvdphase).toBeCloseTo(fd, 4);
    }
  });

  it('would FAIL if the sign correction were dropped — detectable where sin>0', () => {
    // On the sin>0 branch −sign(sin) = −1, so the correct derivative is −cos(phase);
    // a build that forgets the −sign uses +cos(phase) — opposite sign, backward walls.
    const p = 0.9;                                   // sin(0.9) > 0
    expect(Math.sin(p)).toBeGreaterThan(0);
    const { dvdphase } = ridgeWave(p);
    expect(dvdphase).toBeCloseTo(-Math.cos(p), 6);   // correct
    expect(dvdphase).not.toBeCloseTo(Math.cos(p), 4); // the naive (no −sign) bug
  });
});
