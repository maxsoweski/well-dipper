// Regression: binary/warp-reached systems showed displaced orbit rings.
//
// Root cause: every *body* is rewritten every frame into the rebased render
// frame (`offset - worldOrigin`, main.js ~6031-6052), but orbit rings
// (`system.orbitLines`, `system.starOrbitLines`) are spawned once at the raw
// scene origin and only ever shifted by `maybeRebase`'s scene-graph subtract.
// With `worldOrigin != 0` at spawn (the warp camera motion grows it; it is
// never reset — `resetWorldOrigin` is dead code), a ring is displaced from the
// barycenter it should encircle by exactly `worldOrigin`-at-spawn. A fresh-
// loaded Sol (worldOrigin ~ 0) looks fine; warp-reached systems do not.
//
// These tests pin the geometric invariant — a spawned ring's center coincides
// with the rebased system barycenter — using the real WorldOrigin + OrbitLine
// modules. See /tmp/well-dipper-orbit-ring-displacement-handoff.md.

import { describe, test, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  worldOrigin,
  maybeRebase,
  resetWorldOrigin,
  placeInRebasedFrame,
  getWorldTrue,
} from '../src/core/WorldOrigin.js';
import { OrbitLine } from '../src/objects/OrbitLine.js';

// The per-frame body write rule (main.js ~6031-6052): a body whose orbital
// math puts it at true-frame offset `o` (true frame origin = barycenter) is
// rendered at `o - worldOrigin`. The barycenter (o = 0) renders at `-worldOrigin`.
function barycenterRenderPos() {
  return new THREE.Vector3(0, 0, 0).sub(worldOrigin);
}

// Grow worldOrigin the way a warp does: push the camera past REBASE_THRESHOLD
// (100 units) and let maybeRebase fold the offset into worldOrigin + shift the
// scene graph.
function warpAccumulate(scene, camera, x, z) {
  camera.position.set(x, 0, z);
  return maybeRebase(camera, scene);
}

// 3D variant — a real warp moves the camera in Y too, so worldOrigin gains a Y
// component. That Y is what renders a never-rebased single star "above the
// orbital plane".
function warpAccumulate3(scene, camera, x, y, z) {
  camera.position.set(x, y, z);
  return maybeRebase(camera, scene);
}

function freshScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  scene.add(camera);
  return { scene, camera };
}

describe('orbit ring placement under world-origin rebasing', () => {
  beforeEach(() => {
    resetWorldOrigin();
  });

  test('a ring spawned after warp-accumulated worldOrigin coincides with the system barycenter', () => {
    const { scene, camera } = freshScene();

    // Warp camera motion grows worldOrigin to (250,0,0).
    expect(warpAccumulate(scene, camera, 250, 0)).toBe(true);
    expect(worldOrigin.x).toBeCloseTo(250, 5);

    // Spawn a planet orbit ring into the current rebased frame (the fix).
    const ring = new OrbitLine(40, 0x00ff00);
    placeInRebasedFrame(ring.mesh);
    ring.addTo(scene);

    const bary = barycenterRenderPos();
    expect(ring.mesh.position.x).toBeCloseTo(bary.x, 5);
    expect(ring.mesh.position.y).toBeCloseTo(bary.y, 5);
    expect(ring.mesh.position.z).toBeCloseTo(bary.z, 5);
  });

  test('ring stays aligned with the barycenter across a later in-system rebase', () => {
    const { scene, camera } = freshScene();

    warpAccumulate(scene, camera, 250, 0);
    const ring = new OrbitLine(40, 0x00ff00);
    placeInRebasedFrame(ring.mesh);
    ring.addTo(scene);

    // A later rebase, e.g. flying across a wide binary (130 > threshold 100).
    expect(warpAccumulate(scene, camera, 130, 0)).toBe(true);

    const bary = barycenterRenderPos();
    expect(ring.mesh.position.x).toBeCloseTo(bary.x, 5);
    expect(ring.mesh.position.z).toBeCloseTo(bary.z, 5);
  });

  test('an asteroid-belt group spawned after warp-accumulated worldOrigin coincides with the barycenter', () => {
    const { scene, camera } = freshScene();

    warpAccumulate(scene, camera, 250, 0);

    // AsteroidBelt.mesh is a THREE.Group centered on the barycenter; update()
    // only writes per-instance matrices in the group's local frame, so the
    // group position must be seeded into the rebased frame like the rings.
    const beltGroup = new THREE.Group();
    beltGroup.add(new THREE.Object3D()); // stand-in for an instanced asteroid child
    placeInRebasedFrame(beltGroup);
    scene.add(beltGroup);

    const bary = barycenterRenderPos();
    expect(beltGroup.position.x).toBeCloseTo(bary.x, 5);
    expect(beltGroup.position.z).toBeCloseTo(bary.z, 5);

    // And it stays aligned across a later in-system rebase.
    warpAccumulate(scene, camera, 130, 0);
    const bary2 = barycenterRenderPos();
    expect(beltGroup.position.x).toBeCloseTo(bary2.x, 5);
    expect(beltGroup.position.z).toBeCloseTo(bary2.z, 5);
  });

  test('characterization: a ring left at raw origin is displaced by exactly worldOrigin-at-spawn', () => {
    const { scene, camera } = freshScene();

    warpAccumulate(scene, camera, 250, 0);

    // Pre-fix behavior: OrbitLine added with no placement → mesh stays at origin.
    const ring = new OrbitLine(40, 0x00ff00);
    ring.addTo(scene);

    const displacement = ring.mesh.position.clone().sub(barycenterRenderPos());
    expect(displacement.x).toBeCloseTo(worldOrigin.x, 5);
    expect(displacement.length()).toBeGreaterThan(1); // visibly off
  });
});

// The sole star of a single (non-binary) system is the one body never rewritten
// per-frame: planets and binary stars both get `offset - worldOrigin` every
// frame (main.js ~6048-6068), but a single star is created at the raw scene
// origin (main.js:3556-3557, `star.addTo(scene)` with no `.position`) and then
// only carried by `maybeRebase`'s scene-graph subtract. Its true-frame position
// therefore freezes at `worldOrigin`-at-spawn while the barycenter is true-
// origin, so it is displaced from the orbital center by exactly that vector —
// imperceptible in a fresh Sol (worldOrigin ~ 0) but "above the plane" /
// off-center in a warp-reached system that spawned at a large worldOrigin.
// Because worldOrigin is a *vector sum* of camera offsets it wanders, so the
// displacement is invariant to the *current* worldOrigin (which may read ~0).
//
// Invariant the fix must satisfy: a single system star's TRUE-frame position is
// the barycenter (0,0,0). Seeding it into the rebased frame at spawn (the same
// `placeInRebasedFrame` used for rings/belts) achieves this; `maybeRebase`
// keeps it there across subsequent rebases. See
// /tmp/well-dipper-star-displacement-handoff.md.
describe('single (non-binary) system star placement under world-origin rebasing', () => {
  beforeEach(() => {
    resetWorldOrigin();
  });

  test('the sole star sits at the barycenter (true-origin) after spawn and tracks later rebases', () => {
    const { scene, camera } = freshScene();

    // Warp camera motion grows worldOrigin to (250, 8, -120): the value the
    // engine carries when a warp-reached system spawns. A nonzero Y is what
    // renders the star "above the orbital plane".
    expect(warpAccumulate3(scene, camera, 250, 8, -120)).toBe(true);

    // Mimic main.js single-star spawn: a StarFlare root (Object3D) added to the
    // scene. The fix seeds it into the rebased frame at spawn.
    const starMesh = new THREE.Object3D();
    placeInRebasedFrame(starMesh); // THE FIX (main.js:3557)
    scene.add(starMesh);

    // The sole star's TRUE-frame position must be the barycenter (0,0,0).
    const truePos = getWorldTrue(starMesh.position);
    expect(truePos.x).toBeCloseTo(0, 5);
    expect(truePos.y).toBeCloseTo(0, 5);
    expect(truePos.z).toBeCloseTo(0, 5);

    // …and it renders coincident with the rebased barycenter.
    const bary = barycenterRenderPos();
    expect(starMesh.position.x).toBeCloseTo(bary.x, 5);
    expect(starMesh.position.y).toBeCloseTo(bary.y, 5);
    expect(starMesh.position.z).toBeCloseTo(bary.z, 5);

    // Stays at the barycenter across a later in-system rebase (flying around).
    expect(warpAccumulate3(scene, camera, 130, 0, 40)).toBe(true);
    expect(getWorldTrue(starMesh.position).length()).toBeCloseTo(0, 5);
  });

  test('characterization: a sole star left at the raw scene origin is displaced from the barycenter by exactly worldOrigin-at-spawn', () => {
    const { scene, camera } = freshScene();

    expect(warpAccumulate3(scene, camera, 250, 8, -120)).toBe(true);
    const spawnWorldOrigin = worldOrigin.clone();

    // Pre-fix behavior: star added with no placement → mesh stays at raw origin.
    const starMesh = new THREE.Object3D();
    scene.add(starMesh);

    // Its true-frame position freezes at worldOrigin-at-spawn, not the barycenter.
    const truePos = getWorldTrue(starMesh.position);
    expect(truePos.x).toBeCloseTo(spawnWorldOrigin.x, 5);
    expect(truePos.y).toBeCloseTo(spawnWorldOrigin.y, 5);
    expect(truePos.z).toBeCloseTo(spawnWorldOrigin.z, 5);

    // Displacement from the rebased barycenter = worldOrigin-at-spawn, visibly off.
    const displacement = starMesh.position.clone().sub(barycenterRenderPos());
    expect(displacement.length()).toBeCloseTo(spawnWorldOrigin.length(), 5);
    expect(displacement.length()).toBeGreaterThan(1);
  });
});

// The structural fix (world-origin-reset-on-system-swap-2026-06-04): every warp
// carries a nonzero worldOrigin into the new system, so EVERY spawn-once object
// was a latent displacement bug until someone remembered placeInRebasedFrame.
// Wiring the dead `resetWorldOrigin()` into spawnSystem's reset block zeroes
// worldOrigin at the moment spawn-once objects are placed, so spawn coords ==
// true coords structurally — manual seeding is no longer load-bearing, and the
// next spawn-once author can't re-introduce the bug.
//
// These tests pin that invariant. The production reset lives in main.js
// (spawnSystem), which is not unit-importable; here we model the swap as
// `warpAccumulate3(...) ; resetWorldOrigin()` and assert the consequence. The
// characterization half is the RED-on-revert encoded permanently: it documents
// exactly the displaced state the system returns to if the reset is removed.
describe('spawn-once placement under system-swap world-origin reset', () => {
  beforeEach(() => {
    resetWorldOrigin();
  });

  test('after a swap-reset, a spawn-once object left at the raw scene origin sits at the barycenter (reset makes manual seeding unnecessary)', () => {
    const { scene, camera } = freshScene();

    // A warp grows worldOrigin to a large value with a nonzero Y (the Y is what
    // renders never-seeded objects "above the plane").
    expect(warpAccumulate3(scene, camera, 250, 8, -120)).toBe(true);
    expect(worldOrigin.length()).toBeGreaterThan(1);

    // spawnSystem's reset block runs (the fix): worldOrigin → 0.
    resetWorldOrigin();
    expect(worldOrigin.lengthSq()).toBeCloseTo(0, 10);

    // A spawn-once object placed at the RAW scene origin with NO manual seeding.
    const obj = new THREE.Object3D();
    scene.add(obj);

    // Its true-frame position IS the barycenter — no placeInRebasedFrame needed.
    const truePos = getWorldTrue(obj.position);
    expect(truePos.length()).toBeCloseTo(0, 5);

    // …and it renders coincident with the rebased barycenter (which, post-reset,
    // is the scene origin since barycenterRenderPos == -worldOrigin == 0).
    const bary = barycenterRenderPos();
    expect(obj.position.distanceTo(bary)).toBeCloseTo(0, 5);
  });

  test('characterization (RED-on-revert): WITHOUT the swap-reset, the same raw-origin object is displaced by exactly worldOrigin-at-spawn', () => {
    const { scene, camera } = freshScene();

    expect(warpAccumulate3(scene, camera, 250, 8, -120)).toBe(true);
    const spawnWorldOrigin = worldOrigin.clone();

    // No reset (models the production state with resetWorldOrigin() reverted).
    const obj = new THREE.Object3D();
    scene.add(obj);

    // The bug: true-frame position freezes at worldOrigin-at-spawn, not the barycenter.
    const truePos = getWorldTrue(obj.position);
    expect(truePos.distanceTo(spawnWorldOrigin)).toBeCloseTo(0, 5);

    // Displacement from the rebased barycenter == worldOrigin-at-spawn, visibly off.
    const displacement = obj.position.clone().sub(barycenterRenderPos());
    expect(displacement.length()).toBeCloseTo(spawnWorldOrigin.length(), 5);
    expect(displacement.length()).toBeGreaterThan(1);
  });

  test('after a swap-reset, the production placeInRebasedFrame seed is a defensive no-op (keeping the five seed calls stays correct)', () => {
    const { scene, camera } = freshScene();

    warpAccumulate3(scene, camera, 250, 8, -120);
    resetWorldOrigin(); // the fix

    // The five spawn-once sites still call placeInRebasedFrame; post-reset it
    // negates a zero vector — a no-op that leaves the object at the barycenter.
    const obj = new THREE.Object3D();
    placeInRebasedFrame(obj);
    scene.add(obj);

    expect(obj.position.lengthSq()).toBeCloseTo(0, 10);
    expect(getWorldTrue(obj.position).length()).toBeCloseTo(0, 5);
  });

  test('post-swap-reset spawn-once objects stay at the barycenter across a later in-system rebase', () => {
    const { scene, camera } = freshScene();

    warpAccumulate3(scene, camera, 250, 8, -120);
    resetWorldOrigin();

    const obj = new THREE.Object3D();
    scene.add(obj); // at raw origin == barycenter post-reset

    // Fly around in-system: a later rebase folds a new offset into worldOrigin
    // and shifts the scene graph (including obj). The barycenter invariant holds.
    expect(warpAccumulate3(scene, camera, 130, 0, 40)).toBe(true);
    expect(getWorldTrue(obj.position).length()).toBeCloseTo(0, 5);
  });
});
