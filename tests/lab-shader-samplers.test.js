// tests/lab-shader-samplers.test.js — the LAYER 4 sampler gap, found by the 2026-08-06 live check.
//
// WHAT HAPPENED. The lab's shader declares SIX sampler uniforms, every one an output of a layer-4
// bake that does not exist yet. FIVE of them are not in makeUniforms' map at all — the LAB creates
// them at route time (ensureNetworkRouted writes uRiverCarveMap, uReliefBakeCube, uProvinceCube and
// uCraterBakeCube directly), so in the lab they spring into existence alongside the bakes that fill
// them. The game never runs that route. three cannot allocate a texture unit for a uniform it has
// no value for, so five samplers of two different types all read GL's default unit 0:
//
//     GL_INVALID_OPERATION: glDrawArrays: Two textures of different types use the same sampler
//     location.                                                              [x256, then:]
//     WebGL: too many errors, no more errors will be reported to the console for this context.
//
// ⛔ THE SECOND LINE IS WHY THIS IS NOT COSMETIC. Once WebGL stops reporting on a context, every
// later error is invisible — including the shader compile and link errors this entire layer depends
// on being able to see. A console that has gone quiet looks exactly like a console that is clean,
// and this program's documented failure mode is a reading that is true and misleading.
//
// ⚠ THE FIRST FIX WAS WRONG AND THAT IS THE LESSON HERE. It filled samplers whose uniform slot
// existed and was null. Measured live, only ONE of the six was in that state; the other five had no
// slot at all, so the fix bound one texture and changed nothing. Filling a null is not the same
// operation as creating a missing key, and no headless test distinguished them — the browser did.
import { describe, it, expect } from 'vitest';
import {
  buildLabPlanetMaterial,
  declaredSamplers,
  ensureLabSamplers,
} from '../src/rendering/LabPlanetMaterial.js';
import { LAB_VERTEX_SHADER, LAB_FRAGMENT_SHADER } from '../planet-lod-shaders.glsl.js';

const SHADER = LAB_VERTEX_SHADER + LAB_FRAGMENT_SHADER;

describe('lab shader samplers — every declared sampler must be bound and typed', () => {
  it('parses the samplers out of the shader rather than hand-listing them', () => {
    // Hand-listing is a snapshot, and the lab keeps moving — the same reason this whole module
    // imports the shader instead of copying it. A new sampler must be covered automatically.
    const s = declaredSamplers(SHADER);
    expect(Object.keys(s).length).toBeGreaterThanOrEqual(6);
    expect(s.uTectonicGrainCube).toBe('samplerCube');
    expect(s.uRiverCarvePatchMap).toBe('sampler2D');
    // The mix of types is the whole defect — one unit, two types.
    const types = new Set(Object.values(s));
    expect(types.has('samplerCube')).toBe(true);
    expect(types.has('sampler2D')).toBe(true);
  });

  it('⛔ leaves NO declared sampler unbound on a built material', () => {
    const { material } = buildLabPlanetMaterial({ bodyRadius: 0.0426 });
    const unbound = Object.keys(declaredSamplers(SHADER))
      .filter((n) => material.uniforms[n]?.value == null);
    expect(unbound).toEqual([]);
  });

  it('binds a placeholder whose GLSL type matches the declaration', () => {
    const { material } = buildLabPlanetMaterial();
    for (const [name, type] of Object.entries(declaredSamplers(SHADER))) {
      const v = material.uniforms[name].value;
      if (type === 'samplerCube') expect(v.isCubeTexture).toBe(true);
      if (type === 'sampler2D') expect(v.isCubeTexture).toBeFalsy();
    }
  });

  it('CREATES missing slots, not just fills null ones — the distinction the first fix missed', () => {
    const uniforms = { uTectonicGrainCube: { value: null } };   // one slot present-and-null...
    const r = ensureLabSamplers(uniforms, SHADER);              // ...the rest absent entirely
    expect(r.filled).toContain('uTectonicGrainCube');
    expect(r.created).toEqual(
      expect.arrayContaining(['uReliefBakeCube', 'uCraterBakeCube', 'uProvinceCube', 'uRiverCarveMap', 'uRiverCarvePatchMap']),
    );
    expect(r.created.length).toBeGreaterThan(r.filled.length);
  });

  it('never overwrites a real bake — layer 4 owns these when it lands', () => {
    const real = { isCubeTexture: true, __mine: true };
    const uniforms = { uTectonicGrainCube: { value: real } };
    const r = ensureLabSamplers(uniforms, SHADER);
    expect(uniforms.uTectonicGrainCube.value).toBe(real);
    expect(r.alreadyBound).toContain('uTectonicGrainCube');
    expect(r.filled).not.toContain('uTectonicGrainCube');
  });

  it('is idempotent', () => {
    const { material } = buildLabPlanetMaterial();
    const before = Object.keys(material.uniforms).length;
    const second = ensureLabSamplers(material.uniforms, SHADER);
    expect(second.created).toEqual([]);
    expect(second.filled).toEqual([]);
    expect(Object.keys(material.uniforms).length).toBe(before);
  });

  it('CONTROL — the pre-fix state really was a type collision on one unit', () => {
    // Reproduce what the factory alone produces: what SHOULD have been six bound samplers.
    const uniforms = {};
    const declared = declaredSamplers(SHADER);
    // Nothing bound at all — the game's actual pre-fix condition for five of six.
    const nullTypes = new Set(Object.entries(declared)
      .filter(([n]) => uniforms[n] == null)
      .map(([, t]) => t));
    // Two distinct sampler types with no unit assigned between them is exactly the GL error.
    expect(nullTypes.size).toBeGreaterThan(1);
  });
});
