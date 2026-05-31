import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BodyRenderer } from '../BodyRenderer.js';
import { KNOWN_BODY_PROFILES } from '../../../data/KnownBodyProfiles.js';
import { PlanetGenerator } from '../../../generation/PlanetGenerator.js';
import { SeededRandom } from '../../../generation/SeededRandom.js';
import { createTexturedBodyMaterial } from '../../shaders/TexturedBodyShader.js';

// Regression coverage for the WU3 P1 fix: BodyRenderer.dispose() must free
// every GPU resource it OWNS — the textures it loaded (three.js never frees a
// material's textures on material.dispose()) and the saved material the
// delegate won't dispose — without double-freeing the delegate's live material.

const texturedId = Object.keys(KNOWN_BODY_PROFILES).find(
  (k) => KNOWN_BODY_PROFILES[k]?.textures?.diffuse,
);

function buildBody(swapToTextured) {
  const bodyData = PlanetGenerator.generate(new SeededRandom(42), 1.0, [1, 0, 0], null, 'rocky');
  const br = new BodyRenderer('planet', bodyData, null, null, null);

  // Build the textured material the way _loadTexturedMaterial does, minus the
  // async TextureLoader (which needs a DOM). dispose() reads these uniforms.
  br._texturedMaterial = createTexturedBodyMaterial({
    lightDir: new THREE.Vector3(1, 0, 0), lightDir2: null, starInfo: null,
    heightScale: 0.04, posterizeLevels: 8.0, ditherEdgeWidth: 0.5,
    clouds: null, atmosphere: null, planetRadius: 1.0, cloudStyle: 0,
  });

  const counts = {};
  const spy = (label) => () => { counts[label] = (counts[label] || 0) + 1; };

  br._texturedMaterial.addEventListener('dispose', spy('texturedMaterial'));

  const dMap = new THREE.Texture(); dMap.addEventListener('dispose', spy('diffuseMap'));
  const hMap = new THREE.Texture(); hMap.addEventListener('dispose', spy('heightMap'));
  br._texturedMaterial.uniforms.diffuseMap.value = dMap;
  br._texturedMaterial.uniforms.heightMap.value = hMap;
  br._texturedMaterial.uniforms.hasTextures.value = 1.0;

  if (swapToTextured) br._swapToTextured();
  if (br._proceduralMaterial) br._proceduralMaterial.addEventListener('dispose', spy('proceduralMaterial'));

  return { br, counts };
}

describe('BodyRenderer.dispose (WU3 P1 leak fix)', () => {
  it('requires a textured profile fixture', () => {
    expect(texturedId, 'no KNOWN_BODY_PROFILES entry has textures.diffuse').toBeTruthy();
  });

  it('frees both loaded textures and both materials exactly once when textured is live', () => {
    const { br, counts } = buildBody(true);
    // Sanity: after swap the surface shows the textured material.
    const surface = br._delegate.surface || br._delegate.mesh;
    expect(surface.material).toBe(br._texturedMaterial);

    br.dispose();

    expect(counts.diffuseMap).toBe(1);
    expect(counts.heightMap).toBe(1);
    expect(counts.texturedMaterial).toBe(1);   // disposed by delegate (it is live)
    expect(counts.proceduralMaterial).toBe(1); // disposed by us (non-live, delegate skips it)
  });

  it('frees both loaded textures and the inactive textured material when procedural is live', () => {
    const { br, counts } = buildBody(false);
    const surface = br._delegate.surface || br._delegate.mesh;
    expect(surface.material).not.toBe(br._texturedMaterial); // never swapped

    br.dispose();

    expect(counts.diffuseMap).toBe(1);
    expect(counts.heightMap).toBe(1);
    expect(counts.texturedMaterial).toBe(1); // disposed by us (non-live)
    // procedural material is live -> disposed once by the delegate; not double-freed
  });
});
