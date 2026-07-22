import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { OrbitLine } from '../OrbitLine.js';
import { ORBIT_PROXY_LAYER } from '../OrbitRingSDF.js';

// RED stage — orrery-entry-orbits-2026-07-20 AC5, feature half (A) SWAP + (B) FACTOR WIRING.
// Pins today's call-site + mesh surface; drives the LineLoop→OrbitRingSDF-backed Mesh swap
// and the new setVisibilityFactor / uVisFactor uniform. Cases marked [PIN] already pass at
// HEAD (LineLoop) and must keep passing post-swap; the rest FAIL at HEAD by design.

// (5) [PIN] — constructor accepts the EXACT shapes main.js passes today. All four
// creation sites call `new OrbitLine(radius:number, colorHex:number)`:
//   binary star line1  ~main.js:4638  new OrbitLine(r1, 0x00dd00)
//   binary star line2  ~main.js:4642  new OrbitLine(r2, 0x00dd00)
//   moon line          ~main.js:4766  new OrbitLine(moonData.orbitRadius, 0x00bb00)
//   planet line        ~main.js:4781  new OrbitLine(entry.orbitRadiusScene, 0x00ff00)
// HYPOTHESIS: passes at HEAD — OrbitLine already takes (radius, color) and yields an Object3D.
describe('[PIN] constructor — main.js call-site shapes', () => {
  const sites = [
    { name: 'binary star line1 (0x00dd00)', radius: 40, color: 0x00dd00 },
    { name: 'binary star line2 (0x00dd00)', radius: 120, color: 0x00dd00 },
    { name: 'moon line (0x00bb00)', radius: 0.7, color: 0x00bb00 },
    { name: 'planet line (0x00ff00)', radius: 5200, color: 0x00ff00 },
  ];
  for (const s of sites) {
    it(`accepts (${s.radius}, hex) without throwing — ${s.name}`, () => {
      const line = new OrbitLine(s.radius, s.color);
      expect(line.mesh).toBeTruthy();
      expect(line.mesh).toBeInstanceOf(THREE.Object3D);
      // Mesh-surface ops main.js performs on the returned object (moon reposition
      // ~main.js:4767-4768 + visibility push ~4770) must not throw on either backing.
      expect(() => { line.mesh.position.set(1, 0, 2); }).not.toThrow();
      expect(() => { line.mesh.rotation.x = 0.3; }).not.toThrow();
      expect(() => { line.mesh.visible = true; }).not.toThrow();
    });
  }
});

// (6) [PIN] — mesh.visible default. main.js sets `.mesh.visible = orbitsVisible` right
// after construction, but the object's own default must match today's LineLoop (true).
// HYPOTHESIS: passes at HEAD — LineLoop.visible defaults true, as will the SDF Mesh.
describe('[PIN] mesh.visible default', () => {
  it('defaults visible === true', () => {
    const line = new OrbitLine(100, 0x00ff00);
    expect(line.mesh.visible).toBe(true);
  });
});

// (7) [PIN] — dispose() releases geometry + material without throwing (system-teardown
// path main.js uses: `for (const line of ...) line.dispose()` ~main.js:4539/4544).
// HYPOTHESIS: passes at HEAD — OrbitLine.dispose() already disposes geometry + material.
describe('[PIN] dispose releases geometry + material', () => {
  it('calls geometry.dispose + material.dispose without throwing', () => {
    const line = new OrbitLine(100, 0x00ff00);
    const geoSpy = vi.spyOn(line.mesh.geometry, 'dispose');
    const matSpy = vi.spyOn(line.mesh.material, 'dispose');
    expect(() => line.dispose()).not.toThrow();
    expect(geoSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
  });
});

// (1) — post-swap .mesh is a THREE.Mesh (NOT LineLoop) backed by the SDF ShaderMaterial.
// HYPOTHESIS: FAILS at HEAD — .mesh is a THREE.LineLoop with a LineBasicMaterial.
describe('mesh is an SDF-backed Mesh, not a LineLoop', () => {
  it('.mesh instanceof THREE.Mesh and material is ShaderMaterial', () => {
    const line = new OrbitLine(100, 0x00ff00);
    expect(line.mesh).toBeInstanceOf(THREE.Mesh);
    expect(line.mesh).not.toBeInstanceOf(THREE.LineLoop);
    expect(line.mesh.isLine).toBeFalsy();
    expect(line.mesh.material).toBeInstanceOf(THREE.ShaderMaterial);
  });
});

// (2) — material.opacity get/set roundtrip drives the uOpacity uniform (hover compat:
// hover reads material.opacity → _origOpacity, writes 1.0, restores; ~main.js:11127).
// HYPOTHESIS: FAILS at HEAD — LineBasicMaterial has no `.uniforms`; the uniform read throws.
describe('material.opacity is backed by the uOpacity uniform (hover shim)', () => {
  it('defaults to 0.8 and set 1.0 reflects in the uniform', () => {
    const line = new OrbitLine(100, 0x00ff00);
    const mat = line.mesh.material;
    expect(mat.opacity).toBe(0.8);          // captured as _origOpacity by hover
    mat.opacity = 1.0;                        // hover write
    expect(mat.opacity).toBe(1.0);            // read-back (roundtrip)
    expect(mat.uniforms.uOpacity.value).toBe(1.0); // uniform actually driven
    mat.opacity = 0.8;                        // hover restore
    expect(mat.uniforms.uOpacity.value).toBe(0.8);
  });
});

// (3) — NEW setVisibilityFactor(f): clamps to [0,1], drives uVisFactor, default 1.
// HYPOTHESIS: FAILS at HEAD — OrbitLine has no setVisibilityFactor; no uVisFactor uniform.
describe('setVisibilityFactor drives the uVisFactor uniform', () => {
  it('exists as a method', () => {
    const line = new OrbitLine(100, 0x00ff00);
    expect(typeof line.setVisibilityFactor).toBe('function');
  });
  it('defaults uVisFactor to 1', () => {
    const line = new OrbitLine(100, 0x00ff00);
    expect(line.mesh.material.uniforms.uVisFactor.value).toBe(1);
  });
  it('sets and clamps to [0,1]', () => {
    const line = new OrbitLine(100, 0x00ff00);
    line.setVisibilityFactor(0.5);
    expect(line.mesh.material.uniforms.uVisFactor.value).toBe(0.5);
    line.setVisibilityFactor(2);
    expect(line.mesh.material.uniforms.uVisFactor.value).toBe(1);
    line.setVisibilityFactor(-3);
    expect(line.mesh.material.uniforms.uVisFactor.value).toBe(0);
  });
});

// (c2/c3) — orbit-ring-conic Slice D: the OrbitConicField is the UNCONDITIONAL ring
// renderer, so every per-ring proxy is UNCONDITIONALLY on ORBIT_PROXY_LAYER — a layer
// the ORRERY/HELM camera (default mask = layer 0 only) does NOT include, so it
// contributes 0 camera draws — while STAYING a scene child with a live matrixWorld
// (world-origin rebasing depends on it, D-1). Draw suppression is by LAYER, never by
// detachment or visible=false (mesh.visible keeps carrying LOGICAL visibility for
// hitTestOrbits + the field's active flag).
//
// Slice C's USE_CONIC_FIELD flag (and its flag-OFF "renders on layer 0" case) were
// DELETED in Slice D on a green live battery: the flag-OFF legacy SDF render path no
// longer exists (rollback is now a git revert, not a flag flip), so the test for that
// deleted behavior is removed. The flag-ON assertions below are now unconditional.
describe('conic-field proxy layer (unconditional draw suppression, Slice D)', () => {
  it('proxy is on ORBIT_PROXY_LAYER, excluded from a default camera, still a scene child with a live matrixWorld', () => {
    const line = new OrbitLine(100, 0x00ff00);
    const scene = new THREE.Scene();
    line.addTo(scene);

    // On the dedicated proxy layer, off layer 0.
    expect(line.mesh.layers.isEnabled(ORBIT_PROXY_LAYER)).toBe(true);
    expect(line.mesh.layers.isEnabled(0)).toBe(false);

    // A default camera (layer 0 only) does NOT see it -> zero camera draw.
    const cam = new THREE.PerspectiveCamera();
    expect(cam.layers.test(line.mesh.layers)).toBe(false);

    // STAYS a scene child (rebasing) and its matrixWorld stays live despite the layer.
    expect(line.mesh.parent).toBe(scene);
    expect(line.mesh.visible).toBe(true); // .visible free to carry LOGICAL visibility
    line.mesh.position.set(7, 0, -3);
    scene.updateMatrixWorld(true);
    const p = new THREE.Vector3().setFromMatrixPosition(line.mesh.matrixWorld);
    expect(p.x).toBeCloseTo(7, 6);
    expect(p.z).toBeCloseTo(-3, 6);
  });
});

// (4) — factor and opacity COMPOSE: both uniforms present and independent (hover opacity
// stays orthogonal to the per-frame AC3 factor; the shader multiplies them into final alpha).
// HYPOTHESIS: FAILS at HEAD — neither uniform exists on a LineBasicMaterial.
describe('opacity and visibility factor are independent uniforms', () => {
  it('setting one does not disturb the other', () => {
    const line = new OrbitLine(100, 0x00ff00);
    const u = line.mesh.material.uniforms;
    line.mesh.material.opacity = 0.8;
    line.setVisibilityFactor(0.25);
    expect(u.uOpacity.value).toBe(0.8);
    expect(u.uVisFactor.value).toBe(0.25);
    line.mesh.material.opacity = 1.0;         // hover, factor untouched
    expect(u.uOpacity.value).toBe(1.0);
    expect(u.uVisFactor.value).toBe(0.25);
    line.setVisibilityFactor(0.6);            // factor, opacity untouched
    expect(u.uOpacity.value).toBe(1.0);
    expect(u.uVisFactor.value).toBe(0.6);
  });
});
