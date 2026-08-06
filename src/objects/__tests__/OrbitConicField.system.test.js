import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { OrbitConicField } from '../OrbitConicField.js';
import { OrbitLine } from '../OrbitLine.js';
import {
  worldOrigin,
  maybeRebase,
  resetWorldOrigin,
  placeInRebasedFrame,
} from '../../core/WorldOrigin.js';

// ─────────────────────────────────────────────────────────────────────────────
// OrbitConicField system-adapter suite (orbit-ring-conic Slice C). Pins the
// OrbitLine->descriptor adapter `field.updateFromSystem(system, camera, viewport)`
// that Slice C introduces: it reads the live system's planet/moon/star ring
// lists (each an OrbitLine whose .mesh STAYS a scene child — D-1), folds each
// ring's opacity*uVisFactor*proxFade into the descriptor alpha (angular-size
// fade stays IN-SHADER — see OrbitRingSDF.proxfade.test.js c4 pin), and feeds
// the generic field.update(). Headless: no GL context. c4 field-drop (stateless),
// c5 rebasing invariant (field-driven proxy), c6 hover parity.
// ─────────────────────────────────────────────────────────────────────────────

const W = 657, H = 282, FOV = 70, ASPECT = W / H, NEAR = 0.01, FAR = 1e6;
const VIEWPORT = { width: W, height: H };

// Same overview-pose idiom as OrbitConicField.test.js.
function poseCamera({ camCenter = [0, 0, 0], dist, pitch }) {
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
  const horiz = dist * Math.cos(pitch);
  cam.position.set(camCenter[0], camCenter[1] + dist * Math.sin(pitch), camCenter[2] + horiz);
  cam.up.set(0, 1, 0);
  cam.lookAt(camCenter[0], camCenter[1], camCenter[2]);
  cam.updateMatrixWorld(true);
  return cam;
}

function systemOf({ orbitLines = [], starOrbitLines = [], planets = [] } = {}) {
  return { orbitLines, starOrbitLines, planets };
}

// ── c4 — dispose -> field drops the ring (stateless per-frame re-read, no registry)
describe('c4 dispose -> field emits no entry (stateless, no per-ring registry)', () => {
  it('after dispose + removal from system.orbitLines, the next update has one fewer entry', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 121806, pitch: 0.7 });
    const ringA = new OrbitLine(1520, 0x00ff00);
    const ringB = new OrbitLine(723, 0x00ff00);
    ringA.addTo(scene); ringB.addTo(scene);
    ringA.mesh.visible = true; ringB.mesh.visible = true;

    const field = new OrbitConicField();
    const system = systemOf({ orbitLines: [ringA, ringB] });
    field.updateFromSystem(system, cam, VIEWPORT);
    expect(field.count).toBe(2);
    expect(field.activeCount).toBe(2);

    // System-teardown pattern (main.js spawnSystem): dispose + drop from the list.
    ringB.dispose();
    system.orbitLines = [ringA];
    field.updateFromSystem(system, cam, VIEWPORT);
    // Stateless: the field carries no registry, so ringB simply stops appearing.
    expect(field.count).toBe(1);
    expect(field.activeCount).toBe(1);
  });

  it('a hidden ring (mesh.visible=false) is not emitted; re-showing it re-emits', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 121806, pitch: 0.7 });
    const ring = new OrbitLine(1520, 0x00ff00);
    ring.addTo(scene);

    const field = new OrbitConicField();
    const system = systemOf({ orbitLines: [ring] });

    ring.mesh.visible = false;                 // _applyOrbitVisibility(HELM)
    field.updateFromSystem(system, cam, VIEWPORT);
    expect(field.count).toBe(0);

    ring.mesh.visible = true;                  // _applyOrbitVisibility(ORRERY)
    field.updateFromSystem(system, cam, VIEWPORT);
    expect(field.count).toBe(1);
    expect(field.activeCount).toBe(1);
  });

  it('reads star + planet + moon ring lists (all three classes) into descriptors', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 121806, pitch: 0.7 });
    const planetRing = new OrbitLine(5200, 0x00ff00);
    const moonRing = new OrbitLine(3, 0x00bb00);
    const starA = new OrbitLine(40, 0x00dd00);
    const starB = new OrbitLine(120, 0x00dd00);
    for (const r of [planetRing, moonRing, starA, starB]) { r.addTo(scene); r.mesh.visible = true; }

    const field = new OrbitConicField();
    const system = systemOf({
      orbitLines: [planetRing],
      starOrbitLines: [starA, starB],
      planets: [{ moonOrbitLines: [moonRing] }],
    });
    field.updateFromSystem(system, cam, VIEWPORT);
    expect(field.count).toBe(4);
  });
});

// ── c5 — rebasing invariant with the field-driven proxy (mirrors
// tests/orbit-ring-rebase.test.js). Fails if a refactor ever detaches the mesh
// from the scene (maybeRebase shifts only scene children — D-1/R11).
function barycenterRenderPos() { return new THREE.Vector3(0, 0, 0).sub(worldOrigin); }
function warp(scene, camera, x, z) { camera.position.set(x, 0, z); return maybeRebase(camera, scene); }

describe('c5 rebasing invariant — field consumes the proxy at the rebased barycenter', () => {
  beforeEach(() => { resetWorldOrigin(); });

  it('a proxy spawned after warp + a later rebase still sits at the barycenter, and the field builds an active conic from that rebased transform', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
    scene.add(camera);

    // Warp grows worldOrigin, then spawn a planet ring into the rebased frame.
    expect(warp(scene, camera, 250, 0)).toBe(true);
    const ring = new OrbitLine(40, 0x00ff00);
    placeInRebasedFrame(ring.mesh);
    ring.addTo(scene);
    ring.mesh.visible = true;

    // A later in-system rebase (fly across a wide binary: 130 > threshold 100).
    expect(warp(scene, camera, 130, 0)).toBe(true);

    // Invariant: the still-attached mesh coincides with the rebased barycenter.
    // (Detaching it would freeze it at spawn -> this assertion fails.)
    scene.updateMatrixWorld(true);
    const bary = barycenterRenderPos();
    const meshPos = new THREE.Vector3().setFromMatrixPosition(ring.mesh.matrixWorld);
    expect(meshPos.x).toBeCloseTo(bary.x, 5);
    expect(meshPos.z).toBeCloseTo(bary.z, 5);

    // And the field builds an active conic FROM the rebased proxy transform:
    // point an overview camera at the rebased barycenter so the ring projects.
    const field = new OrbitConicField();
    camera.position.set(bary.x, 3000, bary.z);
    camera.up.set(0, 0, -1);
    camera.lookAt(bary.x, bary.y, bary.z);
    camera.updateMatrixWorld(true);
    field.updateFromSystem(systemOf({ orbitLines: [ring] }), camera, VIEWPORT);
    expect(field.count).toBe(1);
    expect(field.activeCount).toBe(1);
    expect(field.readConic(0).active).toBe(1);
  });
});

// ── c6 — hover parity: mutating material.color/opacity (exactly what main.js
// hover does at :11210-11211) changes the ring's NEXT field descriptor, with no
// per-ring draw (R8).
describe('c6 hover parity — material.color/opacity mutation propagates into the field', () => {
  it('color.set(0x44ff44) + opacity=1.0 lift the descriptor red channel and alpha', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 60000, pitch: 0.7 });
    const ring = new OrbitLine(1520, 0x00ff00);
    ring.addTo(scene);
    ring.mesh.visible = true;

    const field = new OrbitConicField();
    const system = systemOf({ orbitLines: [ring] });

    field.updateFromSystem(system, cam, VIEWPORT);
    const before = field.readConic(0);
    expect(before.color.g).toBeGreaterThan(0.5);      // green ring
    const rBefore = before.color.r;
    const alphaBefore = before.alpha;

    // Hover highlight (main.js :11210-11211) mutates the LIVE material in place.
    ring.material.color.set(0x44ff44);                 // bright green (adds red)
    ring.material.opacity = 1.0;                        // hover opacity (was 0.8)

    field.updateFromSystem(system, cam, VIEWPORT);
    const after = field.readConic(0);
    expect(after.color.r).toBeGreaterThan(rBefore + 0.05);   // red channel rose
    expect(after.color.g).toBeGreaterThan(0.5);              // still green
    expect(after.alpha).toBeGreaterThan(alphaBefore);        // opacity 0.8 -> 1.0
  });
});
