// tests/lab-shader-body-radius.test.js — LAYER 2 item 1 fence: the object-space radius divide.
//
// WHAT THIS PROTECTS. The lab renders a UNIT sphere (planet-lod-lab.html:202 `const R = 1.0`) and
// every noise domain in the fragment shader is written against that ±1.0 extent. The game builds
// IcosahedronGeometry at the body's SCENE radius (radiusEarth × 0.0426), so before this fix an
// Earth-sized body sampled 1/23rd of one voronoi cell and rendered as a flat wash — one of three
// independent sufficient causes of the "flat orange" this lane spent sessions on.
//
// WRITTEN IN THIS SHAPE ON PURPOSE, per the plan's fence-first cadence
// (docs/FEATURES/lab-pipeline-into-game-PLAN.md §Verification cadence):
//   1. BYTE-IDENTITY — the lab's value (1.0) must be the exact arithmetic identity, so the lab's
//      output is unchanged. Asserted numerically, max delta exactly 0.
//   2. DISTINCTNESS — "a correctly-wired law that is degenerate" is this program's characteristic
//      failure mode (uTermStrength measured [1,1] on 36 bodies and was reported as shipped). So it
//      is not enough that uBodyRadius exists; it must actually VARY across the generated
//      population. Asserted over the real radius ranges.
//   3. GLSL TEXT — a JS-side measurement cannot see a shader-shape bug. The divide, the uniform
//      declaration, and (load-bearing) the fact that gl_Position still uses the RAW position are
//      asserted against the shader source itself.
//
// ⛔ KEEP THE BROKEN FORM AS AN INSTRUMENT. `collapseFactor` below reproduces the pre-fix behaviour
// and is asserted to be badly wrong. A pass with no failing control is worthless — if someone
// silently reverts the divide, test 2 keeps passing on defaults and only the control catches it.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LAB_VERTEX_SHADER } from '../planet-lod-shaders.glsl.js';
import { makeUniforms } from '../planet-lod-uniforms.js';
import { buildLabPlanetMaterial, bodyRadiusOf } from '../src/rendering/LabPlanetMaterial.js';
import { earthRadiiToScene } from '../src/core/ScaleConstants.js';

/** The shader's own expression, in JS: what vPos becomes for a surface point at `radius`. */
const vPosExtentOf = (radius, uBodyRadius) => radius / uBodyRadius;

describe('LAYER 2 item 1 — object-space radius divide', () => {
  describe('1. byte-identity: the LAB is untouched', () => {
    it('defaults uBodyRadius to exactly 1.0', () => {
      const u = makeUniforms(new THREE.Vector3(0.6, 0.35, 0.7));
      expect(u.uBodyRadius).toBeDefined();
      expect(u.uBodyRadius.value).toBe(1.0);
    });

    it('is the arithmetic identity at the lab radius — max delta exactly 0', () => {
      // The lab's body spans ±1.0. Sweep the sphere; every component must come back unchanged.
      let maxDelta = 0;
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        for (const p of [Math.cos(t), Math.sin(t), Math.cos(t) * Math.sin(t)]) {
          maxDelta = Math.max(maxDelta, Math.abs(vPosExtentOf(p, 1.0) - p));
        }
      }
      expect(maxDelta).toBe(0);
    });

    it('builds with 1.0 when no bodyRadius is supplied, so the lab path cannot regress', () => {
      const built = buildLabPlanetMaterial();
      expect(built.bodyRadius).toBe(1.0);
      expect(built.material.uniforms.uBodyRadius.value).toBe(1.0);
    });
  });

  describe('2. distinctness: the value must actually vary across the population', () => {
    // The generated range, from src/core/ScaleConstants.js RADIUS_RANGES_EARTH: the smallest rocky
    // body is 0.3 R⊕ and the largest hot-jupiter is 16 R⊕.
    const SMALLEST_EARTH_RADII = 0.3;
    const LARGEST_EARTH_RADII = 16.0;

    it('spans more than an order of magnitude over the generated radius range', () => {
      const lo = earthRadiiToScene(SMALLEST_EARTH_RADII);
      const hi = earthRadiiToScene(LARGEST_EARTH_RADII);
      expect(hi / lo).toBeGreaterThan(10);
    });

    it('normalises every body in that range to the same ±1.0 extent the lab assumes', () => {
      for (const rEarth of [0.3, 0.5, 1.0, 2.0, 6.0, 16.0]) {
        const scene = earthRadiiToScene(rEarth);
        // A surface point sits at |position| == scene radius; after the divide it must be unit.
        expect(vPosExtentOf(scene, scene)).toBeCloseTo(1.0, 12);
      }
    });

    it('CONTROL — the pre-fix form is degenerate, and differently so per body', () => {
      // This is the bug, kept live. Without the divide, vPos extent IS the scene radius, so the
      // sampled domain collapses by a factor that also differs 53x across one generated system.
      const collapseFactor = (rEarth) => 1.0 / earthRadiiToScene(rEarth);
      expect(collapseFactor(1.0)).toBeGreaterThan(20);    // Earth-sized: ~23.5x too small
      expect(collapseFactor(0.3)).toBeGreaterThan(70);    // smallest rocky: ~78x
      expect(collapseFactor(16.0)).toBeLessThan(2);       // hot jupiter: barely collapses at all
      // ...and the INCONSISTENCY is the part no per-planet uniform tune could have fixed.
      expect(collapseFactor(0.3) / collapseFactor(16.0)).toBeGreaterThan(50);
    });
  });

  describe('3. GLSL text: shape bugs a JS measurement cannot see', () => {
    it('declares the uniform and divides vPos by it', () => {
      expect(LAB_VERTEX_SHADER).toMatch(/uniform\s+float\s+uBodyRadius\s*;/);
      expect(LAB_VERTEX_SHADER).toMatch(/vPos\s*=\s*position\s*\/\s*uBodyRadius\s*;/);
      // The un-normalised form must be gone, or the divide is dead text.
      expect(LAB_VERTEX_SHADER).not.toMatch(/vPos\s*=\s*position\s*;/);
    });

    it('⛔ still writes gl_Position from the RAW position — the silhouette is geometry, not domain', () => {
      // If anyone "helpfully" normalises here too, every planet in the game becomes a unit sphere.
      expect(LAB_VERTEX_SHADER).toMatch(
        /gl_Position\s*=\s*projectionMatrix\s*\*\s*modelViewMatrix\s*\*\s*vec4\(\s*position\s*,\s*1\.0\s*\)\s*;/,
      );
      expect(LAB_VERTEX_SHADER).not.toMatch(/gl_Position[\s\S]{0,80}uBodyRadius/);
    });

    it('leaves the scale-invariant reads alone (normalize() of a scaled vector is unchanged)', () => {
      // vObjN and vSubstellarAngle normalise `position` directly, so dividing them would be a no-op
      // at best and a divide-by-zero hazard at worst. They must keep reading position.
      expect(LAB_VERTEX_SHADER).toMatch(/vObjN\s*=\s*normalize\(\s*position\s*\)\s*;/);
      expect(LAB_VERTEX_SHADER).toMatch(/vSubstellarAngle\s*=\s*acos\(clamp\(dot\(normalize\(position\)/);
    });
  });

  describe('bodyRadiusOf — measured off the geometry, not assumed', () => {
    it('returns the sphere radius for a game-shaped mesh', () => {
      const r = earthRadiiToScene(1.0);
      const geo = new THREE.IcosahedronGeometry(r, 2);
      // Relative, not absolute: BufferAttribute positions are float32, so the bounding-sphere
      // radius of a 0.0426-unit body carries ~1e-8 relative error. An absolute tolerance here
      // silently becomes a precision test that tightens as bodies get smaller.
      expect(bodyRadiusOf(geo) / r).toBeCloseTo(1.0, 6);
    });

    it('returns the lab identity rather than 0 for degenerate input', () => {
      // A 0 divisor gives every fragment an infinite coordinate, which rasterises as a flat colour
      // — indistinguishable from "undriven", which is the confusion this whole layer exists to end.
      expect(bodyRadiusOf(null)).toBe(1.0);
      expect(bodyRadiusOf(new THREE.BufferGeometry())).toBe(1.0);
    });
  });
});
