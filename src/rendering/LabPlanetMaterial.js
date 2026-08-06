import * as THREE from 'three';
import { LAB_VERTEX_SHADER, LAB_FRAGMENT_SHADER } from '../../planet-lod-shaders.glsl.js';
import { makeUniforms } from '../../planet-lod-uniforms.js';

/**
 * LabPlanetMaterial — the lab's ACTUAL planet material, built for a game body.
 *
 * This is the join point of the whole port. The shader comes from planet-lod-shaders.glsl.js, the
 * same module the lab imports (Step 2), and the 349 uniform defaults come from
 * planet-lod-uniforms.js, the same factory the lab calls. Nothing here is transcribed — if this
 * renders, it renders because the lab's own code is running inside the game.
 *
 * ⛔ TWO TRAPS THAT BOTH END IN AN IDENTICAL BLACK FRAME, and this lane has been caught by the
 * shape of them more than once:
 *
 *  1. `makeUniforms` takes the LIGHT VECTOR, not THREE. Calling it bare succeeds, sets
 *     uLightDir = [null, null, null], and every lit term goes NaN — which rasterises as black, not
 *     as an error. The signature is the reason `lightDir` is a required-in-practice argument here
 *     and is normalised rather than trusted.
 *  2. The vertex shader reads four attributes the game's sphere does not have — aBand, aShear,
 *     aMush, aStorm. A missing attribute is not a link error; it reads as zero-ish garbage.
 *     ensureLabAttributes zero-fills them explicitly so "zero" is a decision rather than an
 *     accident. They are the gas-giant band/jet/storm bake outputs (climate-e5 / storm-e), which
 *     are Step 4 — zero is the correct value until that bake exists.
 *
 * ⚠ Before believing ANY percentage measured off this material, assert a lit-pixel floor. A black
 * frame and a clean negative control are indistinguishable, and separating "not rasterising" from
 * "computing black" needs a forced constant fragment output, not a squint.
 */

/** The four bake-side vertex attributes the lab's vertex shader declares. */
export const LAB_ATTRIBUTES = ['aBand', 'aShear', 'aMush', 'aStorm'];

/** The lab's own static light direction (planet-lod-lab.html:203). The lab normalises it; so do we. */
export const LAB_WORLD_LIGHT = Object.freeze([0.6, 0.35, 0.7]);

/**
 * Zero-fill the attributes the lab's vertex shader expects, if the geometry lacks them.
 * Idempotent, and it never overwrites an attribute that already exists — once the band/storm bakes
 * land they will own these, and this must not clobber them.
 * @param {THREE.BufferGeometry} geometry
 * @returns {{added: string[], vertexCount: number}}
 */
export function ensureLabAttributes(geometry) {
  const count = geometry.getAttribute('position')?.count ?? 0;
  const added = [];
  for (const name of LAB_ATTRIBUTES) {
    if (!geometry.getAttribute(name)) {
      geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count), 1));
      added.push(name);
    }
  }
  return { added, vertexCount: count };
}

/**
 * The object-space radius of a mesh's geometry — the divisor the lab's vertex shader needs to put
 * its noise domain back on a unit sphere (LAYER 2 item 1).
 *
 * Measured off the geometry rather than read from `parameters.radius`, so it is correct for any
 * mesh and not just an IcosahedronGeometry the game happens to build today. The bounding sphere of
 * a sphere centred on the origin IS its radius.
 *
 * ⚠ Returns 1.0 (the lab's identity) for degenerate geometry rather than 0 — a zero divisor gives
 * every fragment an infinite noise coordinate, which rasterises as a uniform colour. That is
 * indistinguishable from "the shader is undriven", the exact confusion this layer exists to end.
 *
 * @param {THREE.BufferGeometry} geometry
 * @returns {number} object-space radius, > 0
 */
export function bodyRadiusOf(geometry) {
  if (!geometry) return 1.0;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const r = geometry.boundingSphere?.radius;
  return Number.isFinite(r) && r > 0 ? r : 1.0;
}

/**
 * Build the lab's planet material with its 349 defaults.
 *
 * Defaults ONLY — no condition driving yet. The lab overwrites a large share of these at route
 * time in applyDrivers, so this is the floor, not the finished look. Whether the floor is black or
 * merely undriven is exactly the question this exists to answer.
 *
 * ⚠ `bodyRadius` is not cosmetic. Omit it and the material renders the game's mesh through a noise
 * domain 23× (Earth-sized) to 78× (smallest rocky) too small — a flat wash that reads exactly like
 * an undriven shader. It is one of THREE independent sufficient causes of the "flat orange" this
 * lane chased; the other two are uOctaves pinned at 4 of 9, and the undriven palette.
 *
 * @param {{lightDir?: THREE.Vector3|number[], bodyRadius?: number}} [opts]
 * @returns {{material: THREE.ShaderMaterial, uniformCount: number, lightDir: number[], bodyRadius: number}}
 */
export function buildLabPlanetMaterial(opts = {}) {
  const raw = opts.lightDir ?? LAB_WORLD_LIGHT;
  const light = (raw.isVector3 ? new THREE.Vector3().copy(raw) : new THREE.Vector3(...raw)).normalize();
  const uniforms = makeUniforms(light);

  const bodyRadius = Number.isFinite(opts.bodyRadius) && opts.bodyRadius > 0 ? opts.bodyRadius : 1.0;
  uniforms.uBodyRadius.value = bodyRadius;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: LAB_VERTEX_SHADER,
    fragmentShader: LAB_FRAGMENT_SHADER,
  });

  return { material, uniformCount: Object.keys(uniforms).length, lightDir: light.toArray(), bodyRadius };
}
