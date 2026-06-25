// tests/ws4-uniforms.test.js — WS4 T3 (D6): the grain fallback scaffolding lives in
// planet-lod-uniforms.js so it is the SINGLE SOURCE of the new uniform defaults.
//
// AC: grain-zero-identical (foundation). The whole grain-OFF byte-identical fallback rests on
// uTectonicGrainStrength defaulting to 0.0 and the grain cube defaulting to a NON-throwing value
// (null placeholder here; T3-EARLY init to a 1x1 finite cube belongs to the bake host, T7/T8).
// No combiner reads these yet (that wiring is T5/T13) — so at this step the shader is untouched and
// grain-zero-identical trivially holds. This test only pins the uniform contract the later tasks build on.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeUniforms } from '../planet-lod-uniforms.js';

// makeUniforms(WORLD_LIGHT) does `new THREE.Vector3().copy(WORLD_LIGHT)` internally,
// so we must hand it a real Vector3 (matches the lab's WORLD_LIGHT constant shape).
const WORLD_LIGHT = new THREE.Vector3(1, 0, 0);

describe('WS4 T3 — grain fallback uniforms in makeUniforms', () => {
  it('exposes uTectonicGrainStrength defaulting to 0.0 (the byte-identical fallback gate)', () => {
    const u = makeUniforms(WORLD_LIGHT);
    expect(u.uTectonicGrainStrength).toBeDefined();
    expect(u.uTectonicGrainStrength.value).toBe(0.0);
  });

  it('exposes the grain-cube sampler uniform with a null/placeholder default (no cube baked yet)', () => {
    const u = makeUniforms(WORLD_LIGHT);
    expect(u.uTectonicGrainCube).toBeDefined();
    // T3 scaffolding stage: cube is not baked until the bake host (T7/T8), so its default is null.
    // The combiner branch (T5/D6) guards strength==0 so a null cube is NEVER sampled at the fallback.
    expect(u.uTectonicGrainCube.value).toBeNull();
  });

  it('does not perturb any existing axis default (orogeny axis stays the pre-WS4 endpoint)', () => {
    const u = makeUniforms(WORLD_LIGHT);
    // uOrogenyAxis is the strength=0 endpoint for the grained orogeny combiner (D7);
    // T3 must not touch it. Guards against an accidental edit to the neighbouring axis block.
    expect(u.uOrogenyAxis.value.x).toBe(1);
    expect(u.uOrogenyAxis.value.y).toBe(0);
  });

  it('returns an independent uniform instance per call (THREE mutates .value)', () => {
    const a = makeUniforms(WORLD_LIGHT);
    const b = makeUniforms(WORLD_LIGHT);
    a.uTectonicGrainStrength.value = 1.0;
    expect(b.uTectonicGrainStrength.value).toBe(0.0);
  });
});
