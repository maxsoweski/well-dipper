import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { OrbitRingSDF, proximityFadeFactor } from '../OrbitRingSDF.js';
import { OrbitLine } from '../OrbitLine.js';
import { OrbitConicField, angularFadeFactor } from '../OrbitConicField.js';

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

// (2) — RETIRED in orbit-ring-conic Slice D. AC11 STRING-PIN MIGRATION DECISION.
// ---------------------------------------------------------------------------------
// The describe('shader carries the fade term') block here pinned the GLSL of the
// per-ring OrbitRingSDF RENDER shader (vertex prox-term strings; the fragment
// `alpha * uOpacity * uVisFactor * vProxFade` alpha composition; the `vProxFade <
// 0.004 discard`; and the `inverse(`/`transpose(` NEGATIVE pins that guaranteed no
// per-pixel matrix inversion / WebGL1-ES-1.00 validity). Slice D DELETED that render
// shader — OrbitRingSDF is now a transform proxy + param bag, the OrbitConicField is
// the unconditional renderer — so those string pins have no shader left to protect
// and are retired, NOT silently dropped. Two migrations (BUILD-PLAN §5):
//
//   • RE-HOMED — the `inverse(`/`transpose(` negative pin (the live invariant: NO
//     per-pixel matrix inversion; all matrices are CPU-built) now guards the FIELD
//     shader. See OrbitConicField.test.js →
//     describe('field fragment shader carries no GLSL matrix inversion') which
//     asserts CONIC_FRAGMENT_SHADER matches neither /inverse\s*\(/ nor
//     /transpose\s*\(/ (added in Slice B, verified to cover this re-home). The dead
//     WebGL1/GLSL-ES-1.00 rationale is gone with the shader it justified.
//
//   • REPLACED — the GLSL alpha-composition pin (`alpha*uOpacity*uVisFactor*
//     vProxFade`) is superseded by the CPU-side channel-composition pin below,
//     describe('c4 CPU descriptor alpha = opacity * uVisFactor * proxFade ...'):
//     the field folds opacity·uVisFactor·proxFade into each descriptor alpha CPU-
//     side (angularFade stays in-shader), so the composition is now pinned where it
//     actually lives after the strip.
// ---------------------------------------------------------------------------------

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

// (c4 — orbit-ring-conic Slice C) — CPU-side channel-composition pin for the
// OrbitConicField descriptor adapter (field.updateFromSystem).
//
// COORDINATION RULE (Slice B/C, binding): the angular-size fade lives IN-SHADER in
// OrbitConicField. The CPU descriptor `alpha` folds ONLY the three camera-only
// channels — opacity * uVisFactor * proxFade — and the shader multiplies
// angularFade ON TOP (a three-channel CPU composition + one in-shader channel, NOT
// four channels CPU-side). Folding angularFade into the descriptor alpha too would
// DOUBLE-APPLY it (once here, once in the fragment shader's angular mirror). These
// pins assert (a) all three CPU channels compose and none is silently dropped, and
// (b) angularFade is NOT in the descriptor alpha (it stays in-shader).
// HYPOTHESIS: FAILS at HEAD — field.updateFromSystem does not exist yet.
describe('c4 CPU descriptor alpha = opacity * uVisFactor * proxFade (three-channel; angularFade in-shader)', () => {
  const W = 657, H = 282, FOV = 70, ASPECT = W / H, NEAR = 0.01, FAR = 1e6;
  const VIEWPORT = { width: W, height: H };

  function poseCamera(dist, pitch) {
    const cam = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
    cam.position.set(0, dist * Math.sin(pitch), dist * Math.cos(pitch));
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
    return cam;
  }

  function systemOf(ring) { return { orbitLines: [ring], starOrbitLines: [], planets: [] }; }

  it('far from the ring (proxFade = 1) the descriptor alpha == opacity * uVisFactor', () => {
    const ring = new OrbitLine(1520, 0x00ff00);
    ring.mesh.visible = true;
    ring.material.opacity = 0.8;
    ring.setVisibilityFactor(0.5);
    const field = new OrbitConicField();
    field.updateFromSystem(systemOf(ring), poseCamera(60000, 0.7), VIEWPORT);
    expect(field.readConic(0).alpha).toBeCloseTo(Math.fround(0.8 * 0.5), 5);
  });

  it('proxFade is a real channel: standing ON the circle zeroes the descriptor alpha', () => {
    const ring = new OrbitLine(1520, 0x00ff00);
    ring.mesh.visible = true;
    ring.material.opacity = 1.0;
    ring.setVisibilityFactor(1.0);
    const field = new OrbitConicField();
    // Camera at radius 1520 in the ring's plane -> circleDist 0 -> proxFade 0.
    const cam = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
    cam.position.set(1520, 0, 0); cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    field.updateFromSystem(systemOf(ring), cam, VIEWPORT);
    expect(field.readConic(0).alpha).toBeCloseTo(0, 5);
  });

  it('uVisFactor is a real channel: setVisibilityFactor(0) zeroes the descriptor alpha', () => {
    const ring = new OrbitLine(1520, 0x00ff00);
    ring.mesh.visible = true;
    ring.material.opacity = 1.0;
    ring.setVisibilityFactor(0);
    const field = new OrbitConicField();
    field.updateFromSystem(systemOf(ring), poseCamera(60000, 0.7), VIEWPORT);
    expect(field.readConic(0).alpha).toBeCloseTo(0, 5);
  });

  it('angular-size fade is NOT folded into the descriptor alpha (stays in-shader)', () => {
    const ring = new OrbitLine(1520, 0x00ff00);
    ring.mesh.visible = true;
    ring.material.opacity = 0.8;
    ring.setVisibilityFactor(0.5);
    const field = new OrbitConicField();
    // Far enough that projected radius < the angular cutoff: the SHADER would dim
    // this ring, but the CPU descriptor alpha must stay the full three-channel value.
    const camDist = 500000;
    const angMirror = angularFadeFactor(1520, camDist, FOV, H, field.angularCutoffPx);
    expect(angMirror).toBeLessThan(1); // sanity: the in-shader angular fade IS partial here
    field.updateFromSystem(systemOf(ring), poseCamera(camDist, 0.7), VIEWPORT);
    // proxFade is 1 at this range -> alpha is opacity*uVisFactor, NOT reduced by angMirror.
    expect(field.readConic(0).alpha).toBeCloseTo(Math.fround(0.8 * 0.5), 5);
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
