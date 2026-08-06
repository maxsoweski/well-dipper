import * as THREE from 'three';
import { LAB_VERTEX_SHADER, LAB_FRAGMENT_SHADER } from '../../planet-lod-shaders.glsl.js';
import { makeUniforms } from '../../planet-lod-uniforms.js';
// The LOD ramp is the LAB'S law, imported rather than re-derived — lodRampOf is
// smoothstep(20, 6, distanceInRadii) and autoOctaves is mix(4, 9, ramp). Same import
// src/rendering/objects/BodyRenderer.js:11 already makes for the game's own shader, so the two
// renderers cannot drift apart on detail.
import { lodRampOf, autoOctaves } from '../../planet-lod-lab-core.js';

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

// ── Placeholder textures for the LAYER 4 bakes that do not exist yet ────────────────────────────
//
// ⛔ FOUND BY THE 2026-08-06 LIVE CHECK, and it is not cosmetic. The lab's shader declares SIX
// sampler uniforms — uTectonicGrainCube, uReliefBakeCube, uCraterBakeCube, uProvinceCube,
// uRiverCarveMap (samplerCube) and uRiverCarvePatchMap (sampler2D) — every one of which is an
// output of a layer-4 bake that has not been built. makeUniforms leaves all six null, and a null
// sampler resolves to texture unit 0, so a sampler2D and five samplerCubes end up sharing one unit:
//
//     GL_INVALID_OPERATION: glDrawArrays: Two textures of different types use the same sampler
//     location.                                                              [x256, then:]
//     WebGL: too many errors, no more errors will be reported to the context.
//
// THE SECOND LINE IS THE REAL DAMAGE. Once WebGL stops reporting, every later error on that
// context is invisible — including the compile and link errors this whole layer depends on being
// able to see. A console that has gone quiet is indistinguishable from a console that is clean.
//
// Same principle as ensureLabAttributes below: bind something VALID and typed, so "no bake yet" is
// a decision with a known value rather than an accident with an undefined one. A 1x1 black texel
// reads as zero through every consumer, which is exactly what an absent bake should contribute.
let _placeholders = null;
function labSamplerPlaceholders() {
  if (_placeholders) return _placeholders;
  const texel = () => {
    const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    t.needsUpdate = true;
    return t;
  };
  const cube = new THREE.CubeTexture([texel(), texel(), texel(), texel(), texel(), texel()]);
  cube.needsUpdate = true;
  _placeholders = { samplerCube: cube, sampler2D: texel(), sampler3D: null };
  return _placeholders;
}

/** Every sampler the shader declares, as {name: glslType}. Parsed, never hand-listed — the lab
 *  keeps moving and a hand-list is a snapshot, which is the failure mode this module exists to avoid. */
export function declaredSamplers(shaderSource) {
  const out = {};
  for (const m of String(shaderSource).matchAll(/uniform\s+(sampler2D|samplerCube|sampler3D)\s+(\w+)/g)) {
    out[m[2]] = m[1];
  }
  return out;
}

/**
 * Bind a typed placeholder to every sampler uniform the shader declares but nothing has filled.
 * Idempotent, and it never overwrites a real texture — when the layer-4 bakes land they own these.
 *
 * @returns {{filled: string[], alreadyBound: string[]}}
 */
export function ensureLabSamplers(uniforms, shaderSource) {
  const ph = labSamplerPlaceholders();
  const filled = [];
  const created = [];
  const alreadyBound = [];
  for (const [name, type] of Object.entries(declaredSamplers(shaderSource))) {
    if (!ph[type]) continue;
    const slot = uniforms[name];
    if (!slot) {
      // ⭐ THE ACTUAL DEFECT, measured live 2026-08-06. FIVE of the shader's six samplers are not
      // in makeUniforms' 350-key map at all — only uTectonicGrainCube is. The lab CREATES the
      // other five at route time (ensureNetworkRouted writes uRiverCarveMap, uReliefBakeCube,
      // uProvinceCube and uCraterBakeCube directly), so in the lab they spring into existence
      // alongside the bakes that fill them. The game never runs that route, so they never exist,
      // and three cannot allocate a texture unit for a uniform it has no value for — leaving five
      // samplers of two different types all reading GL's default unit 0.
      // So filling nulls is not enough: the slot has to be CREATED.
      uniforms[name] = { value: ph[type] };
      created.push(name);
    } else if (slot.value == null) {
      slot.value = ph[type];
      filled.push(name);
    } else {
      alreadyBound.push(name);
    }
  }
  return { filled, created, alreadyBound };
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

  // The layer-4 bakes do not exist yet; give their samplers a valid typed placeholder so the
  // context does not drown in GL_INVALID_OPERATION and stop reporting errors entirely.
  const samplers = ensureLabSamplers(uniforms, LAB_VERTEX_SHADER + LAB_FRAGMENT_SHADER);

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: LAB_VERTEX_SHADER,
    fragmentShader: LAB_FRAGMENT_SHADER,
  });

  return {
    material,
    uniformCount: Object.keys(uniforms).length,
    lightDir: light.toArray(),
    bodyRadius,
    samplersFilled: samplers.filled,
    samplersCreated: samplers.created,
  };
}

// ── The per-frame seam (LAYER 2 items 2 + 3) ────────────────────────────────────────────────────

/** Scratch, module-scope: this runs once per lab-shader body per frame and must not allocate. */
const _invQuat = new THREE.Quaternion();
const _lightObj = new THREE.Vector3();

/**
 * Is this a material built by buildLabPlanetMaterial? Signature-based, not instanceof, because the
 * question that matters is "does it carry the lab's uniform set", which is a fact about the thing
 * rather than about its constructor. (The scene walk in main.js identifies the GAME's material the
 * same way, for the same reason.)
 */
export function isLabPlanetMaterial(material) {
  const u = material?.uniforms;
  return !!(u && u.uBodyRadius && u.uLightDir && u.uOctaves && u.uTime);
}

/**
 * Advance the per-frame half of the lab's driver for one body. THE SEAM, singular.
 *
 * ⛔ WHY ONE FUNCTION AND NOT FOUR PATCHES. Every uniform below was independently missing, and each
 * one alone reads as a different bug: a frozen terminator, un-drifting clouds, permanently coarse
 * relief. Fixed piecemeal they get four call sites, four chances for the next body type to be
 * wired into three of them. The lab does all of this in one place (planet-lod-lab.html frame());
 * so does this.
 *
 * What was wrong, verified 2026-08-05:
 *
 *  1. LIGHT IN THE WRONG SPACE. main.js fed the game's WORLD-space lightDir straight into
 *     `uLightDir`, whose own declaration says "object-space substellar direction". The surface
 *     spins (Planet.js:1896) and the parent carries axial tilt (:1544), so the terminator
 *     counter-rotated with the crust — one full sweep per planet day. The lab does the transform
 *     the game omitted (planet-lod-lab.html:4896-4897); this is that transform.
 *  2. THE CLOCK NEVER ADVANCED. The game's only planet clock writer guards on `mat.uniforms.time`
 *     (Planet.js:1913) and the lab's clock is `uTime`, so the guard silently failed on a lab
 *     material and cloud drift, superrotation, magma churn and aurora curtains all evaluated at
 *     t = 0 forever.
 *  3. uOctaves WAS PINNED AT ITS 4.0 DEFAULT against a documented max of 9, so every in-game
 *     lab-shader body rendered at the LOWEST detail rung at any distance. Not merely "unanimated" —
 *     this was one of three independent sufficient causes of the flat-orange read.
 *
 * ⭐ AND IT RETIRES A FOURTH DEFECT BY CONSTRUCTION. buildLabPlanetMaterial copies the incoming
 * light BY VALUE, which was recorded as a bug ("breaks the by-reference link the game material
 * relies on, so it is also stale"). With this seam the copy is REQUIRED: what belongs in uLightDir
 * is the OBJECT-space vector, and aliasing the game's world-space one would either be overwritten
 * every frame or corrupt the game's own lighting. Do not "fix" it back to a reference.
 *
 * Every field is optional — each call site passes what it actually has, and the two existing
 * per-frame paths (Planet.updateRender for the clock and light, LODManager -> BodyRenderer for the
 * distance) stay the paths they already are instead of a third being invented.
 *
 * @param {THREE.ShaderMaterial} material
 * @param {object} [opts]
 * @param {THREE.Object3D} [opts.mesh]            the mesh the material is bound to (for its world quaternion)
 * @param {THREE.Vector3}  [opts.lightDirWorld]   world-space direction to the star
 * @param {number}         [opts.renderDt]        seconds since the last render tick
 * @param {number}         [opts.distanceRadii]   camera distance to the body, in body radii
 * @returns {null|{time: number, octaves: number, lodRamp: number, lightObj: number[]|null}}
 *          diagnostics, or null if this is not a lab material — so a live probe can read the
 *          resolved values as NUMBERS rather than judging them off a screenshot.
 */
export function updateLabPlanetMaterial(material, opts = {}) {
  if (!isLabPlanetMaterial(material)) return null;
  const u = material.uniforms;

  // ── 2. the clock ──
  if (Number.isFinite(opts.renderDt)) {
    u.uTime.value += opts.renderDt;
    // Same 10000 s (~2.8 h) wrap the game already applies to its own planet clock
    // (Planet.js:1915-1917), for the same reason: float32 loses meaningful precision on a clock
    // that only grows. ⚠ INHERITED ASSUMPTION, worth naming — the game's comment justifies the
    // wrap with "noise patterns tile seamlessly at this scale", which is a claim about the GAME's
    // shader. The lab shader has consumers that scale uTime (uLavaGlowRate multiplies it by 1.5),
    // so a wrap is only invisible if every such consumer is periodic with a period dividing 10000.
    // Matching the game is the right default — one convention, not two — but if anyone ever
    // reports a once-every-three-hours hitch on a lava world, this line is the first suspect.
    if (u.uTime.value > 10000) u.uTime.value -= 10000;
  }

  // ── 1. the light, world -> object space ──
  let lightObj = null;
  if (opts.lightDirWorld && opts.mesh) {
    // getWorldQuaternion updates the world matrix itself, so this is correct even if the body has
    // not been touched by the scene graph walk this frame.
    opts.mesh.getWorldQuaternion(_invQuat).invert();
    _lightObj.copy(opts.lightDirWorld).applyQuaternion(_invQuat).normalize();
    u.uLightDir.value.copy(_lightObj);
    lightObj = _lightObj.toArray();
  }

  // ── 3. the detail ramp ──
  if (Number.isFinite(opts.distanceRadii)) {
    const ramp = lodRampOf(opts.distanceRadii);
    u.uLodRamp.value = ramp;
    u.uOctaves.value = autoOctaves(ramp);
  }

  return {
    time: u.uTime.value,
    octaves: u.uOctaves.value,
    lodRamp: u.uLodRamp.value,
    lightObj,
  };
}
