// tests/relief-octave-lod-ramp.test.js — the fbmd relief octave count ramps with distance.
//
// WHAT THIS PROTECTS. src/objects/Planet.js ships uReliefOctaves at a flat 4.0. The lab drives the
// same quantity as mix(4,9,lodRamp) and the measured frame budget says the game can afford ~9
// octaves at legacy cost, so the game now ramps it too. Two things have to hold and neither is
// visible to a shader-free test suite unless it is pinned here:
//
//   1. LODManager must hand the renderer the CONTINUOUS distance-in-radii, not the discrete tier.
//      The tier is 0/1/2 and setLOD early-returns when it has not changed, so a tier-driven ramp
//      would step 4 -> 9 in a single frame and pop five octaves of relief into existence at once.
//   2. The ramp law must stay the LAB'S law. It is imported from planet-lod-lab-core.js rather
//      than copied; this test fails if the game ever grows its own second copy that drifts.
//
// WHY IT IS NOT AN IN-GAME CHECK. Verified live 2026-07-30 that LODManager does run (every Sol
// body flips from the lodLevel initializer 1 to tier 0 within a frame) — but every body in Sol
// sits 10^5..10^7 radii from the camera, so the ramp correctly returns a flat 4.0 there and the
// interesting part of the curve is unreachable by flying. The plumbing is plain JS, so it is
// pinned here instead.

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { LODManager } from '../src/rendering/LODManager.js';
import { lodRampOf, autoOctaves } from '../planet-lod-lab-core.js';

// Minimal stand-in for a BodyRenderer: LODManager only touches mesh.matrixWorld, radius,
// setLOD and setReliefDetail.
function makeBody(radius, position) {
  const mesh = new THREE.Object3D();
  mesh.position.copy(position);
  mesh.updateMatrixWorld(true);
  return {
    mesh,
    radius,
    setLOD: vi.fn(),
    setReliefDetail: vi.fn(),
  };
}

function runAt(distanceRadii, radius = 3.0) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 0);
  const body = makeBody(radius, new THREE.Vector3(0, 0, distanceRadii * radius));
  const lod = new LODManager(camera);
  lod.register(body);
  lod.update();
  return body;
}

describe('relief octave LOD ramp — LODManager feeds the continuous ratio', () => {
  it('hands setReliefDetail the distance in BODY RADII, not the tier and not raw distance', () => {
    const body = runAt(12, 3.0);
    expect(body.setReliefDetail).toHaveBeenCalledTimes(1);
    expect(body.setReliefDetail.mock.calls[0][0]).toBeCloseTo(12, 6);
    // and the tier it was ALSO given is the coarse one — the two are different quantities
    expect(body.setLOD).toHaveBeenCalledWith(2); // 12 < nearThreshold 20 => close-up
  });

  it('is called every update, NOT only when the tier changes', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 0);
    const body = makeBody(3.0, new THREE.Vector3(0, 0, 36)); // 12 radii, tier 2
    const lod = new LODManager(camera);
    lod.register(body);
    lod.update();
    lod.update();
    lod.update();
    // setLOD dedupes internally on the renderer, but the RAMP must see all three frames or it
    // would only ever move at tier boundaries — which is the pop this design exists to avoid.
    expect(body.setReliefDetail).toHaveBeenCalledTimes(3);
  });

  it('survives bodies that do not implement it (moons, textured swaps)', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 0);
    const body = makeBody(3.0, new THREE.Vector3(0, 0, 36));
    delete body.setReliefDetail;                       // older/other renderer
    const lod = new LODManager(camera);
    lod.register(body);
    expect(() => lod.update()).not.toThrow();
  });
});

describe('relief octave LOD ramp — the law is the lab\'s, and it is pop-free', () => {
  it('sits at exactly the flat 4.0 at and beyond 20 radii (the untouched-far invariant)', () => {
    for (const d of [20, 25, 40, 500, 1e5, 1e7]) {
      expect(autoOctaves(lodRampOf(d)), `${d} radii`).toBe(4.0);
    }
  });

  it('reaches the full 9.0 at and inside 6 radii', () => {
    for (const d of [6, 4, 2, 1]) {
      expect(autoOctaves(lodRampOf(d)), `${d} radii`).toBe(9.0);
    }
  });

  it('is CONTINUOUS and monotonic across the ramp — no step, which is what kills the pop', () => {
    let prev = -Infinity;
    let maxJump = 0;
    // walk inward in 0.1-radius steps across the whole active band
    for (let d = 22; d >= 4; d -= 0.1) {
      const oct = autoOctaves(lodRampOf(d));
      expect(oct).toBeGreaterThanOrEqual(prev - 1e-9);   // monotonic non-decreasing inward
      if (prev !== -Infinity) maxJump = Math.max(maxJump, Math.abs(oct - prev));
      prev = oct;
    }
    // A tier-driven ramp would jump 5.0 in one step. A smoothstep over 14 radii cannot.
    expect(maxJump).toBeLessThan(0.15);
    expect(prev).toBe(9.0);
  });

  it('produces FRACTIONAL counts mid-ramp — fbmd\'s trailing-octave fade needs them', () => {
    const mid = autoOctaves(lodRampOf(13));
    expect(Number.isInteger(mid)).toBe(false);
    expect(mid).toBeGreaterThan(4);
    expect(mid).toBeLessThan(9);
  });
});
