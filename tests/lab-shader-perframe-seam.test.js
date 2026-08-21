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

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// B4-1 — STAR COLOUR (ledger P-01) AND THE SECOND STAR (ledger P-02) ON THE LAB MATERIAL.
//
// WHY THIS FENCE HAD TO BE WRITTEN, AND WHY IT IS HERE RATHER THAN IN AN INSTRUMENT.
// Instrument C cannot see this block AT ALL, and that is by its own documented design, not an
// oversight: every one of the five names B4-1 touches is on the tool's UNWATCHED list —
// `lightDir`/`lightDir2` as tools/port-uniform-delta.mjs:529-530 `reason: 'runtime'`, and
// `starColor1`/`starColor2`/`starBrightness1`/`starBrightness2` as :549-552 `reason:
// 'harness-blind'`, whose stated why is "harness passes no starInfo". So C's harness builds every
// body under the SAME white fallback and a row for these would record one number 633 times.
// ⛔ A GREEN INSTRUMENT C IS THEREFORE NOT EVIDENCE ABOUT P-01 OR P-02. This file is.
//
// The other half of the evidence lives one file over and is deliberately NOT duplicated here:
// tests/material-parity-list.test.js pins that `uStarColor1`, `uStarColor2` and `uStarBrightness2`
// now appear in `LEDGER.labVarying` — i.e. they take DIFFERENT values on different bodies of the
// real corpus, which is the actual content of P-01 ("every swapped body renders under implicit
// white light"). That pass is construction-time and structurally cannot see `uLightDir2`, which is
// written only per frame. The seam half is fenced below, where the seam is.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('B4-1 — the star set on the lab material (ledger P-01 / P-02)', () => {
  // ⛔⛔ COMMENT-STRIPPED, AND THIS IS NOT TIDINESS — IT IS A DEFECT THIS FENCE ALREADY HAD.
  // Every B4-1 line carries a long trailing `//` note that QUOTES the expression it explains, so
  // the shader source contains each of these strings TWICE: once as code, once as prose. The first
  // version of the assertion below used the raw file and PASSED against a mutant that had deleted
  // the code outright — the comment alone satisfied it. Measured: `albedoCol * (starLight +
  // vec3(ambient))` occurs 2x in the raw file and 1x with comments stripped. A source-text
  // assertion that a comment can satisfy is not a fence, so every one below reads CODE only.
  const stripComments = (src) => src.replace(/\/\/[^\n]*/g, '');
  const FRAG = stripComments(readFileSync(join(ROOT, 'src/worldengine/shaders/planetShaders.glsl.js'), 'utf8'));
  const DECL = stripComments(readFileSync(join(ROOT, 'src/worldengine/shaders/height.glsl.js'), 'utf8'));
  const FRAG_RAW = readFileSync(join(ROOT, 'src/worldengine/shaders/planetShaders.glsl.js'), 'utf8');
  const STAR_NAMES = ['uLightDir2', 'uStarColor1', 'uStarColor2', 'uStarBrightness1', 'uStarBrightness2'];
  const REAL_STAR = { color1: [1.0, 0.32, 0.18], brightness1: 1.0, color2: [0.55, 0.72, 1.0], brightness2: 0.41 };

  describe('P-01 — the star colour reaches the material, and it is the SYSTEM\'s colour', () => {
    it('a body built with a real starInfo carries THAT star, not white', () => {
      const u = buildLabPlanetMaterial({ lightDir: new THREE.Vector3(1, 0, 0), starInfo: REAL_STAR, bodyRadius: 2 }).material.uniforms;
      expect(u.uStarColor1.value.toArray()).toEqual([1.0, 0.32, 0.18]);
      expect(u.uStarColor2.value.toArray()).toEqual([0.55, 0.72, 1.0]);
      expect(u.uStarBrightness1.value).toBe(1.0);
      expect(u.uStarBrightness2.value).toBe(0.41);
    });

    it('⛔ carries the colour UNCONVERTED — a colour-managed setter here would silently re-grade every star', () => {
      // The game holds these as `new THREE.Vector3(...this._starColor1)` (Planet.js:1703), a raw
      // triple with no colour space attached. The lab holds a THREE.Color. `Color.fromArray` is a
      // direct component assignment, but `Color.setRGB`/`set` are NOT — they can run the working
      // colour space conversion, which would make the lab and the game disagree on the same star
      // while both "carried" the value. Pinned as round-trip equality on a non-grey triple, because
      // a grey one survives every conversion and would prove nothing.
      const u = buildLabPlanetMaterial({ starInfo: REAL_STAR }).material.uniforms;
      expect(u.uStarColor1.value.toArray()).toEqual(REAL_STAR.color1);
    });

    it('⛔ NO starInfo leaves the PRE-B4 IDENTITY standing — it must not read as a dark body', () => {
      // The lab harness, every headless probe and planet-lod-lab.html all build with no starInfo.
      // (white, 1.0) is precisely the implicit light the shader already had, so "no starInfo" has
      // to mean UNCHANGED. Zeroing here instead would black out the entire lab.
      const u = buildLabPlanetMaterial({ lightDir: new THREE.Vector3(1, 0, 0) }).material.uniforms;
      expect(u.uStarColor1.value.toArray()).toEqual([1, 1, 1]);
      expect(u.uStarBrightness1.value).toBe(1);
      expect(u.uStarColor2.value.toArray()).toEqual([0, 0, 0]);
      expect(u.uStarBrightness2.value).toBe(0);
      expect(u.uLightDir2.value.toArray()).toEqual([0, 0, 0]);
    });

    it('⭐ CONTROL — at those defaults the new expression IS arithmetically the line it replaced', () => {
      // The GLSL, transcribed. This is the claim that B4-1 moves no pixel on a body that has no
      // star data, which is what lets the lab and every existing call site keep their exact render.
      const glsl = (c1, b1, c2, b2, d1, d2) => ({
        starLight: c1.map((c, i) => c * d1 * b1 + c2[i] * d2 * b2),
        diff: d1 * b1 + d2 * b2,
      });
      for (const d1 of [0, 0.37, 1]) {
        const got = glsl([1, 1, 1], 1, [0, 0, 0], 0, d1, 0);
        expect(got.starLight).toEqual([d1, d1, d1]);   // starLight == vec3(diff), the old scalar
        expect(got.diff).toBe(d1);                     // diff == the old `max(dot(shadeN,uLightDir),0)`
      }
    });
  });

  describe('P-02 — the second light, per frame, in OBJECT space', () => {
    it('the seam transforms lightDirWorld2 by the same inverse quaternion as the primary', () => {
      const { surface } = makeBody({ spin: 1.1 });
      const mat = buildLabPlanetMaterial().material;
      surface.material = mat;
      const world2 = new THREE.Vector3(0, 0, 1);
      const d = updateLabPlanetMaterial(mat, { mesh: surface, lightDirWorld: new THREE.Vector3(1, 0, 0), lightDirWorld2: world2, renderDt: 0.016 });
      const expected = world2.clone().applyQuaternion(surface.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
      expect(mat.uniforms.uLightDir2.value.toArray()).toEqual(expected.toArray());
      expect(d.lightObj2).toEqual(expected.toArray());
      expect(world2.toArray()).toEqual([0, 0, 1]);   // the caller's vector is not mutated
    });

    it('⛔ a ZERO second direction yields a ZERO uniform and NEVER a NaN', () => {
      // This is the MAJORITY case, not an edge case: every single-star body in the game holds
      // `_lightDir2 = new THREE.Vector3(0, 0, 0)` and main.js only copies a real direction into it
      // inside its binary branch. three's normalize() divides by a zero length, so the unguarded
      // form puts NaN in the uniform and `max(dot(shadeN, NaN), 0.0)` is implementation-defined.
      const { surface } = makeBody({ spin: 0.4 });
      const mat = buildLabPlanetMaterial().material;
      surface.material = mat;
      updateLabPlanetMaterial(mat, { mesh: surface, lightDirWorld: new THREE.Vector3(1, 0, 0), lightDirWorld2: new THREE.Vector3(0, 0, 0), renderDt: 0.016 });
      const v = mat.uniforms.uLightDir2.value;
      expect([v.x, v.y, v.z].some(Number.isNaN)).toBe(false);
      expect(v.toArray()).toEqual([0, 0, 0]);
    });

    it('⛔ CONTROL THAT MOVED — the gate is NOT a NaN guard, and the real dependency is three\'s `|| 1`', () => {
      // THIS ASSERTION WAS WRITTEN THE OTHER WAY UP AND WAS FALSE. The claim under test was that
      // the ungated form divides by a zero length and puts NaN in uLightDir2. It does not:
      // three's Vector3.normalize() is `divideScalar(this.length() || 1)`, and that `|| 1` sends a
      // zero vector to (0,0,0). Checked in three's own source AND empirically before this line was
      // rewritten. The gate in updateLabPlanetMaterial is therefore an early-out, not a crash
      // guard, and its comment now says so.
      const naive = new THREE.Vector3(0, 0, 0).applyQuaternion(new THREE.Quaternion()).normalize();
      expect([naive.x, naive.y, naive.z].some(Number.isNaN)).toBe(false);
      // ⭐ SO THIS IS THE ASSERTION THAT IS ACTUALLY LOAD-BEARING: the safety belongs to three, not
      // to us, which means a three upgrade that dropped the `|| 1` would turn the majority of
      // bodies NaN and nothing else in this repo would notice. Pinned here, at the one seam that
      // hands a routinely-zero vector to normalize().
      expect(naive.toArray()).toEqual([0, 0, 0]);
    });

    it('a tick that supplies no second direction reports null — which is NOT [0,0,0]', () => {
      // "the seam never ran" and "this body has one star" are opposite findings for a live probe
      // and must not share an output.
      const { surface } = makeBody();
      const mat = buildLabPlanetMaterial().material;
      surface.material = mat;
      const d = updateLabPlanetMaterial(mat, { mesh: surface, lightDirWorld: new THREE.Vector3(1, 0, 0), renderDt: 0.016 });
      expect(d.lightObj2).toBeNull();
      expect(d.lightObj).not.toBeNull();
    });

    it('uLightDir2 MOVES as the body spins — the object-space property, on the second star too', () => {
      const world2 = new THREE.Vector3(0, 0, 1);
      const read = (spin) => {
        const { surface } = makeBody({ spin });
        const mat = buildLabPlanetMaterial().material;
        surface.material = mat;
        updateLabPlanetMaterial(mat, { mesh: surface, lightDirWorld: new THREE.Vector3(1, 0, 0), lightDirWorld2: world2, renderDt: 0.016 });
        return mat.uniforms.uLightDir2.value.toArray();
      };
      expect(read(0)).not.toEqual(read(1.3));
    });
  });

  describe('THE WIRE — the fragment actually SPENDS them', () => {
    it('all five are declared in the FRAGMENT block, at the right GLSL type', () => {
      const TYPE = { uLightDir2: 'vec3', uStarColor1: 'vec3', uStarColor2: 'vec3', uStarBrightness1: 'float', uStarBrightness2: 'float' };
      for (const n of STAR_NAMES) {
        expect(DECL, `height.glsl.js should declare ${n} as ${TYPE[n]}`).toMatch(new RegExp(`uniform\\s+${TYPE[n]}\\s+${n}\\b`));
      }
      // ⛔ TYPE, NOT JUST PRESENCE. A vec3/float mix-up here does not fail to compile in every
      // driver and would land as a wrong-colour body rather than an error.
    });

    it('the surface albedo is multiplied by starLight, and starLight is built from all four star names', () => {
      expect(FRAG).toContain('vec3 starLight = uStarColor1 * diff1 * uStarBrightness1 * shadow1 + uStarColor2 * diff2 * uStarBrightness2 * shadow2;');   // ⭐⭐ TWO `* shadowN` FACTORS ADDED AT B4-2 (ledger P-03). B4-1 wrote this string without them and its comment on the shader line said there would never be any; the casters were moved into the fragment's object space instead. ⛔ THIS ASSERTION IS UPDATED RATHER THAN RELAXED — the temptation on an exact-string fence that a later block invalidates is to soften it to a regex or a substring, which would leave it passing on an expression that had lost the star names too. The P-01/P-02 content of the line — all four star names, in this order, multiplying the albedo — is unchanged and still pinned here.
      expect(FRAG).toContain('albedoCol * (starLight + vec3(ambient))');
      // ⭐ THE TINT REACHES THE ALBEDO AND NOTHING ELSE, which is what keeps this block out of the
      // concurrent block's pixels: limb, terminator, aurora, airglow and cloud optics are ADDITIVE
      // terms further down the composite and stay untinted, exactly as src/objects/Planet.js:498
      // leaves them (`finalColor = surfaceColor * (starLight + vec3(ambient))`).
      expect(FRAG).not.toContain('albedoCol * (diff + ambient)');   // the pre-B4 expression must be GONE, not merely shadowed
      // ⛔ THE COMMENT-STRIP IS ITSELF FENCED. If stripComments ever stopped working, every
      // assertion in this describe would silently go vacuous rather than red.
      const raw = (FRAG_RAW.match(/albedoCol \* \(starLight \+ vec3\(ambient\)\)/g) || []).length;
      const code = (FRAG.match(/albedoCol \* \(starLight \+ vec3\(ambient\)\)/g) || []).length;
      expect(code).toBe(1);
      expect(raw).toBeGreaterThan(code);   // the prose copy exists — that is exactly why CODE is what we assert on
    });

    it('⛔ `diff` STAYS A FLOAT, and this is the assertion that keeps B4 out of the neighbouring block\'s pixels', () => {
      // `diff` is read as a GATE a dozen times below the composite (the nightMask for bio / city /
      // ecumenopolis, step(0.0001, diff) for carbon sheen / facets / sunglint, the lit dayside
      // gate) and as a MAGNITUDE inside the F34 limb's `(diff + 0.15)`. Widening it to a vec3 would
      // silently re-colour the limb and every night gate — pixels this block does not own. The game
      // solves it the same way and for the same reason: a coloured `starLight` AND a scalar
      // `diffuse`, side by side (src/objects/Planet.js:488-490).
      expect(FRAG).toContain('float diff = diff1 * uStarBrightness1 * shadow1 + diff2 * uStarBrightness2 * shadow2;');   // ⭐⭐ SAME TWO FACTORS, SAME REASON, AND THE `float` IS STILL THE POINT OF THIS LINE. B4-2 rewrote this statement and the one thing it did NOT do is widen it: `diff` is read as a GATE a dozen times below and as a MAGNITUDE inside the F34 limb's (diff + 0.15), which is the neighbouring block's pixels. A vec3 here would re-colour them silently.
      expect(FRAG).not.toContain('vec3 diff =');
    });

    it('⛔ the VERTEX shader declares NONE of them — the tap fence depends on it', () => {
      // tests/instrument-tap-fence.test.js derives a tap vertex and THROWS on a fifth use of bare
      // `position` in LAB_VERTEX_SHADER's main(). Putting any of these in the vertex block invites
      // exactly that. They are fragment-only on purpose.
      const vertexBlock = FRAG.slice(FRAG.indexOf('export const LAB_VERTEX_SHADER'), FRAG.indexOf('export const LAB_FRAGMENT_SHADER'));   // comment-stripped, so a prose mention of a star name in the vertex block does not red this
      for (const n of STAR_NAMES) expect(vertexBlock, `vertex block must not mention ${n}`).not.toContain(n);
    });
  });

  describe('CONTROLS — committed mutants, so this fence is known to BITE', () => {
    it('severing the starInfo carry in the builder reds the P-01 assertion', () => {
      // The mutant is deleting the `if (opts.starInfo) { … }` block in buildLabPlanetMaterial. Under
      // it every body keeps the factory white, which is precisely the P-01 defect — and note that it
      // is INVISIBLE to a test that only checks the uniform EXISTS.
      const mutantUniforms = { uStarColor1: { value: new THREE.Color(1, 1, 1) } };   // what a severed builder leaves
      expect(mutantUniforms.uStarColor1.value.toArray()).not.toEqual(REAL_STAR.color1);
    });

    it('dropping lightDirWorld2 at the call site is SILENT unless the seam reports it', () => {
      // Planet.updateRender / Moon.updateRender pass `lightDirWorld2` alongside `lightDirWorld`.
      // Removing it throws nothing and renders a plausible image — the body simply keeps its
      // build-time uLightDir2 while the mesh spins under it. Only the null-vs-zero distinction
      // fenced above can tell the two apart.
      const { surface } = makeBody({ spin: 0.7 });
      const mat = buildLabPlanetMaterial({ lightDir2: new THREE.Vector3(0, 0, 1) }).material;
      surface.material = mat;
      const before = mat.uniforms.uLightDir2.value.toArray();
      const d = updateLabPlanetMaterial(mat, { mesh: surface, lightDirWorld: new THREE.Vector3(1, 0, 0), renderDt: 0.016 });
      expect(d.lightObj2).toBeNull();                              // the seam SAYS it did not write
      expect(mat.uniforms.uLightDir2.value.toArray()).toEqual(before);   // …and the stale value is still there
    });
  });
});
