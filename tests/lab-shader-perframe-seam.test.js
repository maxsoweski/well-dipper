// tests/lab-shader-perframe-seam.test.js — LAYER 2 items 2 + 3 fence: the per-frame seam.
//
// WHAT THIS PROTECTS. Three uniforms were independently missing on any in-game lab-shader body,
// and each one alone reads as a completely different bug:
//
//   uLightDir  — fed the game's WORLD-space direction into a uniform whose own declaration says
//                "object-space substellar direction". The surface spins and the parent carries
//                axial tilt, so the terminator counter-rotated with the crust: one sweep per day.
//   uTime      — never advanced, because the game's only planet clock writer guards on
//                `mat.uniforms.time` (Planet.js:1913) and the lab's clock is `uTime`. The guard
//                silently did nothing, which is indistinguishable from a shader with no animation.
//   uOctaves   — pinned at its 4.0 default against a documented max of 9, so every body rendered
//                at the LOWEST detail rung at any distance.
//
// ⛔ THE TWO NO-OP GUARDS ARE THE REAL LESSON AND THEY ARE FENCED BELOW. Both bugs have the same
// shape: a per-frame writer guarded on a uniform NAME that the lab material does not use, so the
// branch fell through in silence. `time` vs `uTime` in Planet.updateRender, `uReliefOctaves` vs
// `uOctaves` in BodyRenderer.setReliefDetail. A guard that no-ops on the material you are trying
// to drive looks exactly like a feature that does not exist.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildLabPlanetMaterial,
  updateLabPlanetMaterial,
  isLabPlanetMaterial,
} from '../src/rendering/LabPlanetMaterial.js';
import { lodRampOf, autoOctaves } from '../src/worldengine/base/labCore.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const labSource = () => readFileSync(join(ROOT, 'planet-lod-lab.html'), 'utf8');

/** A body shaped like the game's: a tilted group with a spinning surface child. */
function makeBody({ tilt = 0.41, spin = 0 } = {}) {
  const group = new THREE.Object3D();
  group.rotation.z = tilt;
  const surface = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0426, 2));
  surface.rotation.y = spin;
  group.add(surface);
  group.updateMatrixWorld(true);
  return { group, surface };
}

describe('LAYER 2 items 2+3 — the per-frame seam', () => {
  describe('1. byte-identity: the seam computes the LAB\'s law, not a re-derivation', () => {
    it('the lab really does transform the light by the inverse body quaternion', () => {
      // Pin the premise against the lab's SOURCE. If the lab changes how it lights its body, this
      // fence must be re-read rather than silently re-run.
      const src = labSource();
      expect(src).toMatch(/invQuat\.copy\(planet\.quaternion\)\.invert\(\);/);
      expect(src).toMatch(/lightObj\.copy\(WORLD_LIGHT\)\.applyQuaternion\(invQuat\);/);
    });

    it('reproduces that transform with max delta exactly 0', () => {
      const { surface } = makeBody({ tilt: 0.41, spin: 1.234 });
      const mat = buildLabPlanetMaterial({ bodyRadius: 0.0426 }).material;
      const world = new THREE.Vector3(0.6, 0.35, 0.7).normalize();

      updateLabPlanetMaterial(mat, { mesh: surface, lightDirWorld: world });

      // The lab's own two lines, run here against the same body.
      const invQuat = surface.getWorldQuaternion(new THREE.Quaternion()).invert();
      const expected = world.clone().applyQuaternion(invQuat).normalize();

      const got = mat.uniforms.uLightDir.value;
      const maxDelta = Math.max(
        Math.abs(got.x - expected.x), Math.abs(got.y - expected.y), Math.abs(got.z - expected.z),
      );
      expect(maxDelta).toBe(0);
    });

    it('drives octaves through the shared law over a distance sweep, max delta exactly 0', () => {
      const mat = buildLabPlanetMaterial().material;
      let maxDelta = 0;
      for (const d of [0, 1, 3, 6, 8, 12, 20, 40, 1e5]) {
        updateLabPlanetMaterial(mat, { distanceRadii: d });
        maxDelta = Math.max(maxDelta, Math.abs(mat.uniforms.uOctaves.value - autoOctaves(lodRampOf(d))));
        maxDelta = Math.max(maxDelta, Math.abs(mat.uniforms.uLodRamp.value - lodRampOf(d)));
      }
      expect(maxDelta).toBe(0);
    });
  });

  describe('2. distinctness: a correctly-wired law that is constant is this program\'s failure mode', () => {
    it('uOctaves actually spans 4..9 across the approach, not one value', () => {
      const mat = buildLabPlanetMaterial().material;
      const seen = new Set();
      for (const d of [40, 20, 12, 8, 6, 3, 0]) {
        updateLabPlanetMaterial(mat, { distanceRadii: d });
        seen.add(mat.uniforms.uOctaves.value);
      }
      expect(seen.size).toBeGreaterThan(3);
      expect(Math.min(...seen)).toBe(4);
      expect(Math.max(...seen)).toBe(9);
    });

    it('uLightDir MOVES as the body spins — a frozen terminator was the bug', () => {
      const mat = buildLabPlanetMaterial().material;
      const world = new THREE.Vector3(0.6, 0.35, 0.7).normalize();
      const samples = [];
      for (const spin of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const { surface } = makeBody({ spin });
        updateLabPlanetMaterial(mat, { mesh: surface, lightDirWorld: world });
        samples.push(mat.uniforms.uLightDir.value.clone());
      }
      // Every quarter turn must give a materially different substellar direction.
      for (let i = 1; i < samples.length; i++) {
        expect(samples[0].distanceTo(samples[i])).toBeGreaterThan(0.5);
      }
    });

    it('uTime accumulates and wraps the way the game\'s own clock does', () => {
      const mat = buildLabPlanetMaterial().material;
      updateLabPlanetMaterial(mat, { renderDt: 0.5 });
      updateLabPlanetMaterial(mat, { renderDt: 0.25 });
      expect(mat.uniforms.uTime.value).toBeCloseTo(0.75, 12);

      mat.uniforms.uTime.value = 9999.9;
      updateLabPlanetMaterial(mat, { renderDt: 0.2 });
      expect(mat.uniforms.uTime.value).toBeLessThan(1.0);   // wrapped, not grown
      expect(mat.uniforms.uTime.value).toBeGreaterThan(0);
    });
  });

  describe('3. ⛔ CONTROL — the broken forms, kept live', () => {
    it('the pre-fix world-space light is materially WRONG on any rotated body', () => {
      // This is the defect, reproduced. If someone reverts to feeding the world vector straight in,
      // the byte-identity test above fails — but this states the SIZE of the error, so the failure
      // is legible as "the terminator is in the wrong place" rather than "a float moved".
      const { surface } = makeBody({ tilt: 0.41, spin: 1.234 });
      const world = new THREE.Vector3(0.6, 0.35, 0.7).normalize();
      const invQuat = surface.getWorldQuaternion(new THREE.Quaternion()).invert();
      const correct = world.clone().applyQuaternion(invQuat);
      expect(correct.distanceTo(world)).toBeGreaterThan(0.5);
    });

    it('a guard on the GAME\'s uniform names is a silent no-op on a lab material', () => {
      // Both original bugs in one assertion: the lab material has neither `time` nor
      // `uReliefOctaves`, so both of the game's guarded writers fall through without erroring.
      const mat = buildLabPlanetMaterial().material;
      expect(mat.uniforms.time).toBeUndefined();
      expect(mat.uniforms.uReliefOctaves).toBeUndefined();
      // ...and the ones it DOES have are the ones the seam drives.
      expect(mat.uniforms.uTime).toBeDefined();
      expect(mat.uniforms.uOctaves).toBeDefined();
    });

    it('the shipped call sites drive the lab uniforms, not only the game ones', () => {
      // Source-text assertion on purpose: a JS-side value check cannot see that the call was
      // placed AFTER an early-return that skips it. That is precisely how the octave bug survived.
      const planet = readFileSync(join(ROOT, 'src/objects/Planet.js'), 'utf8');
      const body = readFileSync(join(ROOT, 'src/rendering/objects/BodyRenderer.js'), 'utf8');
      expect(planet).toMatch(/updateLabPlanetMaterial\(/);
      expect(body).toMatch(/updateLabPlanetMaterial\(/);
      // In setReliefDetail the seam must precede the `if (!u) return;` guard, or it is dead code.
      const seamAt = body.indexOf('updateLabPlanetMaterial(surface?.material');
      const guardAt = body.indexOf('if (!u) return;');
      expect(seamAt).toBeGreaterThan(-1);
      expect(guardAt).toBeGreaterThan(-1);
      expect(seamAt).toBeLessThan(guardAt);
    });
  });

  describe('5. the view vector — object space, not world space', () => {
    it('GLSL reads uCameraPosObj, never three\'s world-space cameraPosition', () => {
      const frag = readFileSync(join(ROOT, 'src/worldengine/shaders/planetShaders.glsl.js'), 'utf8');
      expect(frag).toMatch(/uniform vec3 uCameraPosObj;/);
      expect(frag).toMatch(/vec3 V = normalize\(uCameraPosObj - vPos\);/);
      // The broken form must not survive as CODE. Comments mentioning it are fine and wanted.
      const codeLines = frag.split('\n').filter((l) => !l.trim().startsWith('//'));
      expect(codeLines.join('\n')).not.toMatch(/normalize\(cameraPosition - vPos\)/);
    });

    it('⛔ NO UNESCAPED BACKTICK anywhere in the shader module', () => {
      // The trap: these are template literals, so a prose backtick in a GLSL comment TERMINATES
      // the string and the module stops parsing. It is already documented for
      // src/objects/Planet.js; this module had no guard and it cost a red run on 2026-08-06.
      const src = readFileSync(join(ROOT, 'src/worldengine/shaders/planetShaders.glsl.js'), 'utf8');
      const bare = src.split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /(^|[^\\])`/.test(line))
        .map(({ n }) => n);
      // Exactly four: the open/close delimiter of each of the two exported template literals.
      expect(bare.length).toBe(4);
    });

    it('is the exact identity for the LAB — origin, identity quaternion, unit radius', () => {
      const mat = buildLabPlanetMaterial().material;   // bodyRadius defaults to 1.0
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1));
      mesh.updateMatrixWorld(true);
      const camWorld = new THREE.Vector3(0, 0, 3);
      updateLabPlanetMaterial(mat, { mesh, cameraWorldPos: camWorld });
      const got = mat.uniforms.uCameraPosObj.value;
      const maxDelta = Math.max(
        Math.abs(got.x - camWorld.x), Math.abs(got.y - camWorld.y), Math.abs(got.z - camWorld.z),
      );
      expect(maxDelta).toBe(0);
    });

    it('the lab writes it too, so the shader never falls back to cameraPosition', () => {
      const lab = labSource();
      expect(lab).toMatch(/uniforms\.uCameraPosObj\.value\.copy\(camera\.position\);/);
      expect(lab).toMatch(/planet\.worldToLocal\(uniforms\.uCameraPosObj\.value\);/);
    });

    it('DIVERGES from the world position on a real game body — the actual bug', () => {
      // Rotated, tilted and far from the origin at a game-sized radius: exactly the case where
      // reading cameraPosition made V collapse toward a constant and the rim glow slid.
      const group = new THREE.Object3D();
      group.position.set(-416, -0.05, -542);
      group.rotation.z = -0.21869;
      const surface = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0487, 2));
      surface.rotation.y = 1.1;
      group.add(surface);
      group.updateMatrixWorld(true);

      const mat = buildLabPlanetMaterial({ bodyRadius: 0.0487 }).material;
      const camWorld = new THREE.Vector3(-0.52, 0, -0.23);
      updateLabPlanetMaterial(mat, { mesh: surface, cameraWorldPos: camWorld });
      const got = mat.uniforms.uCameraPosObj.value;
      expect(got.distanceTo(camWorld)).toBeGreaterThan(100);
      // And it must be expressed in BODY RADII, so it is commensurate with vPos (|vPos| <= 1).
      expect(got.length()).toBeGreaterThan(1000);
    });
  });

  describe('4. it must no-op on everything that is not a lab material', () => {
    it('returns null and mutates nothing for the game\'s own material shape', () => {
      const gameish = { uniforms: { time: { value: 3 }, uReliefOctaves: { value: 4 }, lightDir: { value: new THREE.Vector3() } } };
      expect(isLabPlanetMaterial(gameish)).toBe(false);
      expect(updateLabPlanetMaterial(gameish, { renderDt: 1, distanceRadii: 0 })).toBeNull();
      expect(gameish.uniforms.time.value).toBe(3);
      expect(gameish.uniforms.uReliefOctaves.value).toBe(4);
    });

    it('survives null / undefined / attribute-less input', () => {
      expect(updateLabPlanetMaterial(null, { renderDt: 1 })).toBeNull();
      expect(updateLabPlanetMaterial(undefined)).toBeNull();
      expect(updateLabPlanetMaterial({}, { renderDt: 1 })).toBeNull();
    });

    it('ignores fields the call site did not supply', () => {
      // Each call site passes only what it has. A missing field must not zero the uniform.
      const mat = buildLabPlanetMaterial().material;
      updateLabPlanetMaterial(mat, { distanceRadii: 0 });
      const octaves = mat.uniforms.uOctaves.value;
      updateLabPlanetMaterial(mat, { renderDt: 0.016 });   // no distance this time
      expect(mat.uniforms.uOctaves.value).toBe(octaves);
    });
  });
});
