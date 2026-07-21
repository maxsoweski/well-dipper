import { describe, it, expect } from 'vitest';
import { OrbitRingSDF, proximityFadeFactor } from '../OrbitRingSDF.js';
import { OrbitLine } from '../OrbitLine.js';

// RED stage — orrery-entry-orbits-2026-07-20, round-3 staticky fix (proximity fade).
// Max-confirmed reproduction (2026-07-21, contract statusNote at 8715e27): the "mess"
// is the focused planet's OWN orbit ring rendered from a camera standing ON its circle
// (double-click fly-to parks you there; measured 0.006 scene units off the R=5203 ring).
// Near the ring's on-screen horizon fwidth(g) legitimately explodes and the 1/3-res
// band test flips per quad — torn slashes that seethe under the perpetual ORRERY drift.
// Ratified fix (Max greenlight 2026-07-21, live mock validated): fade every ring by the
// camera's 3D distance to ITS CIRCLE (not to any body). The line you stand on carries
// no information; far-field chunky-retro rendering is untouched.
//
// Envelope (mock-validated defaults, Max's UAT taste knobs):
//   near = max(uProxNearAbs, uProxNearRel * R)   — absolute floor + relative for big R
//   far  = near * uProxFarMul
//   factor = smoothstep(near, far, circleDist)   — 0 on the circle, 1 beyond far

// (1) — new prox uniforms exist with the mock-validated defaults.
// HYPOTHESIS: FAILS at HEAD — uniforms don't exist yet.
describe('prox-fade uniforms + defaults', () => {
  it('uProxNearAbs 0.35 / uProxNearRel 0.02 / uProxFarMul 3.0', () => {
    const ring = new OrbitRingSDF(100, 0x00ff00);
    const u = ring.material.uniforms;
    expect(u.uProxNearAbs.value).toBeCloseTo(0.35);
    expect(u.uProxNearRel.value).toBeCloseTo(0.02);
    expect(u.uProxFarMul.value).toBeCloseTo(3.0);
  });

  it('OrbitLine (the prod subclass) inherits the uniforms', () => {
    const line = new OrbitLine(5200, 0x00ff00);
    expect(line.mesh.material.uniforms.uProxNearAbs).toBeTruthy();
  });
});

// (2) — the shaders carry the fade. Vertex computes the factor from cameraPosition
// via the rigid-inverse dot-product form (NO inverse()/transpose() — must stay valid
// GLSL ES 1.00 for the WebGL1 fallback, same constraint the file already documents);
// fragment multiplies it into the final alpha alongside (not replacing) the existing
// uOpacity * uVisFactor channels, and early-discards fully-faded fragments.
// String-level pins so the term can't be silently deleted suite-green (the lane-A
// GLSL-mirror-parity lesson).
// HYPOTHESIS: FAILS at HEAD — no prox term in either shader.
describe('shader carries the fade term', () => {
  const ring = new OrbitRingSDF(100, 0x00ff00);
  const vs = ring.material.vertexShader;
  const fs = ring.material.fragmentShader;

  it('vertex: computes circleDist against the uniforms, no ES-3.00-only builtins', () => {
    expect(vs).toMatch(/uProxNearAbs/);
    expect(vs).toMatch(/uProxNearRel/);
    expect(vs).toMatch(/uProxFarMul/);
    expect(vs).toMatch(/cameraPosition/);
    expect(vs).toMatch(/smoothstep/);
    expect(vs).not.toMatch(/\binverse\s*\(/);
    expect(vs).not.toMatch(/\btranspose\s*\(/);
  });

  it('fragment: multiplies vProxFade into final alpha and keeps existing channels', () => {
    expect(fs).toMatch(/vProxFade/);
    expect(fs).toMatch(/alpha\s*\*\s*uOpacity\s*\*\s*uVisFactor\s*\*\s*vProxFade/);
  });

  it('fragment: early-discards fully-faded fragments', () => {
    expect(fs).toMatch(/vProxFade\s*<\s*0\.004[\s\S]*?discard/);
  });
});

// (3) — JS mirror of the GLSL envelope, exported for tests + the orbit-lab instrument.
// HYPOTHESIS: FAILS at HEAD — export doesn't exist.
describe('proximityFadeFactor — JS mirror of the GLSL envelope', () => {
  it('is 0 standing on the circle (the Max repro: 0.006 off the R=5203 ring)', () => {
    expect(proximityFadeFactor(0.006, 5203)).toBe(0);
  });

  it('keeps the planet ring faded at round-2’s dist-8 site (relative floor governs big R)', () => {
    // near = max(0.35, 0.02*5203) = 104.06 → circleDist 8 is deep inside the hold-out.
    expect(proximityFadeFactor(8, 5203)).toBe(0);
  });

  it('is 1 for any far ring (god’s-eye view untouched)', () => {
    expect(proximityFadeFactor(5000, 5203)).toBe(1);
    expect(proximityFadeFactor(400, 5203)).toBe(1); // beyond far = 312.2
  });

  it('is strictly between 0 and 1 mid-envelope, monotonic', () => {
    const a = proximityFadeFactor(150, 5203);
    const b = proximityFadeFactor(250, 5203);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeLessThan(1);
    expect(b).toBeGreaterThan(a);
  });

  it('absolute floor governs small moon rings (R=1.213: near stays 0.35)', () => {
    // Camera inside the innermost Jupiter moon ring: circleDist ≈ 0.62 → dimmed, not gone.
    const f = proximityFadeFactor(0.62, 1.213);
    expect(f).toBeGreaterThan(0.1);
    expect(f).toBeLessThan(0.9);
  });

  it('honors config overrides (the UAT taste knobs)', () => {
    expect(proximityFadeFactor(8, 5203, { nearRel: 0.001 })).toBeGreaterThan(0);
    expect(proximityFadeFactor(0.5, 1.213, { nearAbs: 0.05, farMul: 2 })).toBe(1);
  });
});

// (4) — setter for live tuning: partial updates, others untouched.
// HYPOTHESIS: FAILS at HEAD — setter doesn't exist.
describe('setProximityFade — partial-update setter', () => {
  it('updates only the provided keys', () => {
    const ring = new OrbitRingSDF(100, 0x00ff00);
    ring.setProximityFade({ nearAbs: 0.5 });
    const u = ring.material.uniforms;
    expect(u.uProxNearAbs.value).toBeCloseTo(0.5);
    expect(u.uProxNearRel.value).toBeCloseTo(0.02);
    expect(u.uProxFarMul.value).toBeCloseTo(3.0);
  });

  it('ignores non-finite / non-positive garbage', () => {
    const ring = new OrbitRingSDF(100, 0x00ff00);
    ring.setProximityFade({ nearAbs: -1, nearRel: NaN, farMul: 0 });
    const u = ring.material.uniforms;
    expect(u.uProxNearAbs.value).toBeCloseTo(0.35);
    expect(u.uProxNearRel.value).toBeCloseTo(0.02);
    expect(u.uProxFarMul.value).toBeCloseTo(3.0);
  });
});

// (5) [PIN] — orthogonality: prox fade must not disturb the existing channels.
// HYPOTHESIS: passes at HEAD for the channels themselves; the describe exists to pin
// them THROUGH the prox change (regression guard, not a RED case).
describe('[PIN] existing channels unchanged', () => {
  it('setVisibilityFactor still clamps into uVisFactor; opacity shim intact', () => {
    const ring = new OrbitRingSDF(100, 0x00ff00);
    ring.setVisibilityFactor(0.5);
    expect(ring.material.uniforms.uVisFactor.value).toBeCloseTo(0.5);
    ring.setVisibilityFactor(7);
    expect(ring.material.uniforms.uVisFactor.value).toBe(1);
    ring.material.opacity = 1.0;
    expect(ring.material.uniforms.uOpacity.value).toBe(1.0);
  });
});
