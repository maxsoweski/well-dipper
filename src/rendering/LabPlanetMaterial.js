import * as THREE from 'three';
import { LAB_VERTEX_SHADER, LAB_FRAGMENT_SHADER } from '../worldengine/shaders/planetShaders.glsl.js';
import { makeUniforms } from '../worldengine/shaders/uniforms.js'; import { POSTERIZE_LEVELS } from './posterizeLevels.js'; // ⛔ B2P RIDES THIS LINE: this file is line-cited, so a new import line moves every ref below it.
// The LOD ramp is the LAB'S law, imported rather than re-derived — lodRampOf is
// smoothstep(20, 6, distanceInRadii) and autoOctaves is mix(4, 9, ramp). Same import
// src/rendering/objects/BodyRenderer.js:11 already makes for the game's own shader, so the two
// renderers cannot drift apart on detail.
import { lodRampOf, autoOctaves } from '../worldengine/base/labCore.js';

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

/** The lab's own static light direction (world-engine-lab.html:203). The lab normalises it; so do we. */
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
 * The lab shader source, with the measurement cache-bust applied — the lab's `planetShaderSource`.
 *
 * ⛔ WHY THIS EXISTS, AND IT IS NOT SYMMETRY FOR ITS OWN SAKE. Step 6's gate reads "run once with
 * `window.__shaderCacheBust` so the cold number is real". Chrome keeps a shader DISK cache that
 * serves linked binaries across GL contexts and page loads, so an un-busted measurement of the lab
 * program times the cache and reports the 29.8 s cold link as free. `Planet.planetShaderSource`
 * already does this for the game's three variants; without the same accessor here, a Step-6 arrival
 * measurement busts the three cheap programs and NOT the 363,566-byte one the whole gate is about.
 *
 * ⚠ Fragment only, matching the game's convention (`planetShaderSource` leaves the vertex source
 * alone): the vertex program is shared and cheap, and busting it inflates the "before" number with
 * a link the game pays once.
 *
 * ⚠ Identity-preserving when off — returns the module's own frozen pair, so the shipped path never
 * allocates a second copy of a 363 KB string per body.
 *
 * @returns {{vertexShader: string, fragmentShader: string}}
 */
export const LAB_SHADER_VARIANT = Object.freeze({
  vertexShader: LAB_VERTEX_SHADER,
  fragmentShader: LAB_FRAGMENT_SHADER,
});
export function labShaderSource() {
  const bust = (typeof window !== 'undefined' && window.__shaderCacheBust) || null;
  if (!bust) return LAB_SHADER_VARIANT;
  return {
    vertexShader: LAB_VERTEX_SHADER,
    fragmentShader: '// cachebust ' + bust + '\n' + LAB_FRAGMENT_SHADER,
  };
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
 * @param {{lightDir?: THREE.Vector3|number[], lightDir2?: THREE.Vector3|number[], starInfo?: object|null, bodyRadius?: number}} [opts]   ⭐ B4-1 added `lightDir2` and `starInfo`; BOTH ARE IDENTITY WHEN ABSENT (no starInfo leaves the factory white/1.0 pair, no lightDir2 leaves the zero vector), so every existing call site keeps its exact material and only a caller holding real star data — the Planet and Moon constructors — changes anything.
 * @returns {{material: THREE.ShaderMaterial, uniformCount: number, lightDir: number[], bodyRadius: number}}
 */
export function buildLabPlanetMaterial(opts = {}) {
  const raw = opts.lightDir ?? LAB_WORLD_LIGHT;
  const light = (raw.isVector3 ? new THREE.Vector3().copy(raw) : new THREE.Vector3(...raw)).normalize();
  const uniforms = makeUniforms(light); uniforms.uLevels = POSTERIZE_LEVELS; // ⭐ B2P — SUBSTITUTE the shared object for makeUniforms' private one. Nothing here edits the lab shader or the uniforms.js default (still 6.0); this only makes the value REACHABLE. Once the lab flag flips, 846 planets and 632 moons render through THIS program, whose uLevels no pack writes — leave this out and the setting evaporates exactly when the world engine becomes visible.

  const bodyRadius = Number.isFinite(opts.bodyRadius) && opts.bodyRadius > 0 ? opts.bodyRadius : 1.0;  if (opts.starInfo) { uniforms.uStarColor1.value.fromArray(opts.starInfo.color1 || [1, 1, 1]); uniforms.uStarColor2.value.fromArray(opts.starInfo.color2 || [0, 0, 0]); uniforms.uStarBrightness1.value = opts.starInfo.brightness1 ?? 1.0; uniforms.uStarBrightness2.value = opts.starInfo.brightness2 ?? 0.0; }   // ⭐ B4-1 (ledger P-01) — STAR COLOUR, AT CONSTRUCTION, BECAUSE THE ENGINE HAS NOWHERE ELSE TO TAKE IT FROM. Star colour and brightness are written exactly once in the whole game: into a material's uniform bag when the body is built. There is no per-frame writer to widen. ⛔ THE FALLBACKS ARE COPIED FROM THE GAME CHARACTER FOR CHARACTER (`color1 || [1,1,1]`, `color2 || [0,0,0]`, `brightness1 ?? 1.0`, `brightness2 ?? 0.0` — the Planet constructor and the Moon uniform bag), because a PARTIAL starInfo must land on the same value in both programs or the two disagree. ⛔ A NULL starInfo LEAVES THE FACTORY DEFAULTS STANDING RATHER THAN ZEROING THEM: the lab and every headless probe build with none, and (white, 1.0) is precisely the implicit light the shader already had, so "no starInfo" means UNCHANGED, not dark. tests/material-parity-list.test.js already records the mirror trap on the ledger side — a pass with starInfo null reported starColor2 lost on every body, and only the system's real starInfo gave the honest split. ⛔ RIDES THIS LINE (handoff gate: every citation-bearing file N added / N deleted; this file carries symbol-anchored citations down to :572).
  uniforms.uBodyRadius.value = bodyRadius;  if (opts.lightDir2) uniforms.uLightDir2.value.copy(opts.lightDir2.isVector3 ? opts.lightDir2 : new THREE.Vector3(...opts.lightDir2));   // ⭐ B4-1 (ledger P-02) — the second star's direction, seeded at build so a body that never reaches the per-frame seam still lights correctly. ⛔ NOT NORMALIZED HERE, AND THAT IS DELIBERATE: the zero vector is the meaningful "single star" VALUE (every non-binary body carries `_lightDir2 = new THREE.Vector3(0,0,0)`), and three's normalize() divides by a zero length — the result is NaN, it reaches the shader, and `max(dot(shadeN, NaN), 0.0)` is implementation-defined. The seam normalizes only when the incoming vector has length. ⛔ RIDES THIS LINE (handoff gate: every citation-bearing file N added / N deleted; this file carries symbol-anchored citations down to :572).

  // The layer-4 bakes do not exist yet; give their samplers a valid typed placeholder so the
  // context does not drown in GL_INVALID_OPERATION and stop reporting errors entirely.
  const samplers = ensureLabSamplers(uniforms, LAB_VERTEX_SHADER + LAB_FRAGMENT_SHADER);

  // ⛔ Through `labShaderSource`, NOT through the two imported constants — otherwise a cache-busted
  // measurement run would bust the warm-up probe (which goes through this same function) and not
  // the body, or vice versa, and the Step-6 cold number would be a measurement of Chrome's disk
  // cache wearing a compile's clothes. One accessor, one call site. See `buildLabProbeMaterial`.
  const src = labShaderSource();
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: src.vertexShader,
    fragmentShader: src.fragmentShader,
  });

  return {
    material,
    uniformCount: Object.keys(uniforms).length,
    lightDir: light.toArray(), lightDir2: uniforms.uLightDir2.value.toArray(), starColor1: uniforms.uStarColor1.value.toArray(), starColor2: uniforms.uStarColor2.value.toArray(), starBrightness1: uniforms.uStarBrightness1.value, starBrightness2: uniforms.uStarBrightness2.value,   // B4-1 — reported as NUMBERS so a probe can read what a body was BUILT with instead of inferring a star colour off a screenshot (§12.5's rule that a visual gate needs its condition printed). ⛔ RIDES THIS LINE (handoff gate: every citation-bearing file N added / N deleted; this file carries symbol-anchored citations down to :572).
    bodyRadius,
    samplersFilled: samplers.filled,
    samplersCreated: samplers.created,
    cacheBusted: src !== LAB_SHADER_VARIANT,
  };
}

/**
 * The warm-up probe for the lab program (PLAN §4 Step 6c).
 *
 * ⭐ IT IS THE REAL MATERIAL, AND THAT IS THE WHOLE POINT. `tests/shader-warmup-source-parity.test.js`
 * exists because the game's warm-up builds its probe from a SECOND expression of the same source, so
 * "the probe compiles what the body draws" is a claim that needs a test to hold it. Here there is no
 * second expression: the probe IS `buildLabPlanetMaterial().material`, so a future edit cannot retype
 * the warm-up's copy of the lab shader — there is no copy to retype. §11.2's "close the class, not
 * the instance" applied to a class this file was about to acquire.
 *
 * three's program cache key is built from the shader SOURCE plus renderer/material parameters, never
 * from uniform VALUES, so the extra 351-uniform map and the six placeholder texels cost one material
 * and link the identical program. (The game's probe passes `uniforms: {}` for the same reason, from
 * the other direction.)
 *
 * ⚠ Not disposed by the caller — see ShaderWarmup's note 1: dropping the last material reference
 * hands the linked program straight back to the driver.
 *
 * @returns {THREE.ShaderMaterial}
 */
export function buildLabProbeMaterial() {
  return buildLabPlanetMaterial().material;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE SWAP LEDGER — PLAN §12.4 channel 1, cost-table row 9. PURE; no THREE object is required and
// nothing here touches the scene.
//
// ⛔ WHAT THIS CHANNEL CAN AND CANNOT SEE, said once, here, so a caller cannot mistake its silence
// for a clean bill. It diffs two UNIFORM MAPS. It is therefore blind to every feature drawn in
// hardcoded GLSL with no uniform of its own — §12.4 channel 2 names six of them in the game's gas
// branch (`stormMask`, `polarDark`, `hotspot`, `nightSide`, `ringNoise`, `haze`) — and those are
// exactly the losses a uniform diff of any construction must miss. A ledger reporting `lost: []` is
// a statement about uniforms and about nothing else.
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** The lab's GLSL corpus, as one string, resolved. `LAB_FRAGMENT_SHADER` already interpolates
 *  `HEIGHT_GLSL` at module-eval time (verified: appending the height module changes no match), so
 *  these two constants ARE `src/worldengine/shaders/planetShaders.glsl.js` + `src/worldengine/shaders/height.glsl.js` for the
 *  purpose of §12.4's grep. */
export const LAB_SHADER_CORPUS = LAB_VERTEX_SHADER + '\n' + LAB_FRAGMENT_SHADER;

const _escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * ⭐ THE TWO REGEXES ARE THE FILTER. They are exported, named, and pinned by
 * `tests/swap-ledger.test.js` because §12.4 states a measured split (58 gate-shaped of 87) WITHOUT
 * stating the expression that produced it, and a split is meaningless without one.
 *
 *  · `guarded`      — the name appears inside an `if (…) ` condition as `name > 0`. Written loosely
 *                     enough to accept `if (uX > 0.0 && uY > 0.0)`, because a compound condition is
 *                     still a guard on `uX`; written tightly enough to reject `if (fooBar > 0.0)`
 *                     via the word boundary.
 *  · `multiplicand` — the name appears immediately either side of a `*`. This is the "bare
 *                     multiplicand" shape: a uniform at 0 that multiplies a term switches the term
 *                     off entirely.
 *
 * ⚠ NAMED LIMIT, and it is §12.4's own: this is a regex over GLSL text. A gate consumed through a
 * helper function or a `#define` is invisible to it, a name that also occurs inside a comment counts,
 * and `mix(a, b, uX)` — a real gate shape — is neither guarded nor a multiplicand and lands in
 * `neither`. `neither` therefore means "this filter found no gate shape", never "this uniform is not
 * a gate".
 */
export function gateGuardPattern(name) {
  return new RegExp('if\\s*\\([^)]*\\b' + _escapeRe(name) + '\\s*>\\s*0');
}
export function bareMultiplicandPattern(name) {
  const n = _escapeRe(name);
  return new RegExp('(\\*\\s*' + n + '\\b)|(\\b' + n + '\\s*\\*)');
}

/**
 * The gate shape of one uniform name against a GLSL corpus.
 * @returns {{name: string, guarded: boolean, multiplicand: boolean, gateShaped: boolean}}
 */
export function gateShapeOf(name, shaderSource = LAB_SHADER_CORPUS) {
  const src = String(shaderSource);
  const guarded = gateGuardPattern(name).test(src);
  const multiplicand = bareMultiplicandPattern(name).test(src);
  return { name, guarded, multiplicand, gateShaped: guarded || multiplicand };
}

/**
 * Is this uniform value "off"? A zero scalar, an all-zero vector/colour/array, or absent.
 *
 * ⚠ `false` counts as off and `true` does not: several lab uniforms are int-flags (`uFwClamp`,
 * `uEmissiveBypass`). A texture is never off — a bound sampler is a value nothing can call neutral.
 */
export function isOffValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'number') return v === 0;
  if (typeof v === 'boolean') return v === false;
  if (Array.isArray(v)) return v.every(isOffValue);   // ⭐ B4-2 — RECURSES, and the change is a correctness fix with a measured blast radius rather than a tidy-up. The old body was v.every((c) => c === 0), which is right for a flat float array and WRONG for an array of Vector3: uShadowMoonPos defaults to six zero vectors — as off as a value gets — and every element compared === 0 as false, so the whole uniform reported NOT off. Recursing is backward-compatible on every numeric array (isOffValue(0) is true). ⛔⛔ AND MY FIRST STATEMENT OF ITS BLAST RADIUS WAS WRONG AND IS CORRECTED HERE RATHER THAN QUIETLY RE-FITTED: this comment originally said "there was no other array-of-objects uniform in the bag before them". THERE WAS ONE. MEASURED by running both predicates over makeUniforms in this session, exactly one PRE-EXISTING name changes class — uStormColor, eight all-zero colours, which the old body called NOT off and the new one correctly calls off. ⚠ CONSEQUENCE THE COUNT TABLE MUST CARRY: the off-value population moves 114 -> 123, which is +8 new names AND +1 correction to a name that was already all-zero and already mis-classified. Any previously published off-value figure for this bag counted uStormColor on the wrong side.
  if (v && typeof v.toArray === 'function') return v.toArray().every((c) => c === 0);
  return false;
}

/**
 * §12.4's "87 zero-defaulted of 351" quantity, reproduced: names whose default is a scalar zero.
 *
 * ⛔ TWO DEFINITIONS OF "AT ZERO" LIVE IN THIS FILE AND THE DIFFERENCE IS RECORDED RATHER THAN
 * TIDIED AWAY, because two names for one idea is the failure §2 of the PLAN records happening four
 * times. This one is SCALAR-ONLY. `isOffValue` — used by `diffMaterialUniforms` — is wider, and over
 * `makeUniforms` it selects **111**: the 87 here plus 24 all-zero domain-offset vectors
 * (`uMacroOffset`, `uBandOffset`, …), for which zero genuinely IS the identity. Both counts are
 * pinned by `tests/swap-ledger.test.js`. The bucket a LIVE ledger ranks is the diff's, so it can
 * legitimately carry rows this function would not return; the 87 is the population §12.4 measured.
 *
 * ⚠ Measured at `39986d3`: **351 declared, 87 scalar-zero** — both reproduce PLAN §12.4's figures
 * for `9b33264` exactly, and `git diff 9b33264 HEAD` over `src/worldengine/shaders/uniforms.js`,
 * `src/worldengine/shaders/planetShaders.glsl.js` and `src/worldengine/shaders/height.glsl.js` is empty, so the corpus is unmoved.
 */
export function zeroDefaultedUniformNames(uniforms) {
  return Object.keys(uniforms || {}).filter((n) => {
    const slot = uniforms[n];
    if (!slot || !('value' in slot)) return false;
    const v = slot.value;
    return typeof v === 'number' && v === 0;
  });
}

/**
 * ⭐ THE MECHANICAL RANK. §12.4: "an unranked 87 hands the discriminating step back to a human
 * reading a list, which is the method the ruling was issued against."
 *
 * ⛔ THE SPLIT BELOW DOES NOT REPRODUCE §12.4's, AND SAYING SO IS PART OF THE MEASUREMENT.
 * §12.4 records "58 gate-shaped — 38 both, 10 guard-only, 10 multiplicand-only, 29 neither" and does
 * NOT record the expression that produced them. This filter, over the same corpus (`git diff
 * 9b33264 HEAD` on the three shader/uniform files is empty), measures **55 gate-shaped — 17 both,
 * 7 guard-only, 31 multiplicand-only, 32 neither**, and it agrees with §12.4 on the multiplicand
 * TOTAL exactly (17+31 = 48 = 38+10). So the divergence is entirely in the guard arm: §12.4's
 * guarded total is 48, this one's is 24. Five guard expressions were tried and none reaches 48 —
 * `if (u > 0.0)` strict (20), `if (… u > 0 …)` (24), `u >` anything (25), `u <>0` either way (25),
 * and "appears anywhere inside any `if (…)`" which OVERSHOOTS to 63. The strict/loose pair also
 * measures identically against the raw FILE text (comments included) as against the resolved
 * strings, so the difference is not the corpus. **§12.4's 58 is therefore not reproducible from
 * §12.4**, and the number pinned by `tests/swap-ledger.test.js` is this file's, produced by the
 * exported regexes above. Do not re-quote the 58/38/10/10/29 as a property of this filter.
 *
 * @returns {{total, gateShaped, both, guardOnly, multiplicandOnly, neither, rows}}
 */
export function rankOffByDefault(names, shaderSource = LAB_SHADER_CORPUS) {
  const rows = names.map((n) => gateShapeOf(n, shaderSource));
  const both = rows.filter((r) => r.guarded && r.multiplicand).length;
  const guardOnly = rows.filter((r) => r.guarded && !r.multiplicand).length;
  const multiplicandOnly = rows.filter((r) => !r.guarded && r.multiplicand).length;
  const neither = rows.filter((r) => !r.gateShaped).length;
  return {
    total: rows.length,
    gateShaped: both + guardOnly + multiplicandOnly,
    both, guardOnly, multiplicandOnly, neither,
    // Gate-shaped first, `both` ahead of the singletons: the rank IS the reading order.
    rows: rows.slice().sort((a, b) =>
      (Number(b.guarded) + Number(b.multiplicand)) - (Number(a.guarded) + Number(a.multiplicand))
      || a.name.localeCompare(b.name)),
  };
}

/**
 * FIVE buckets, not three, and the two extra ones are the reason to trust the other three.
 *
 * §12.4 names three — LOST, OFF-BY-DEFAULT, CARRIED. Written as exactly three they do not partition
 * the name union: a uniform that was present AT ZERO before and is absent after falls in no bucket,
 * and so does one that arrives NON-ZERO. Both are silent drops, which is the shape of every defect
 * this instrument exists to catch. They get named buckets and the partition is asserted.
 *
 * @param {object} prevUniforms — the material carried BEFORE the swap (the game's).
 * @param {object} nextUniforms — the material carried AFTER (the lab's).
 */
export function diffMaterialUniforms(prevUniforms, nextUniforms) {
  const prev = prevUniforms || {};
  const next = nextUniforms || {};
  const val = (m, n) => (m[n] && 'value' in m[n] ? m[n].value : undefined);
  const out = { lost: [], lostAtZero: [], offByDefault: [], addedNonZero: [], carried: [] };
  for (const n of Object.keys(prev)) {
    if (n in next) continue;
    (isOffValue(val(prev, n)) ? out.lostAtZero : out.lost).push(n);
  }
  for (const n of Object.keys(next)) {
    if (n in prev) { out.carried.push(n); continue; }
    (isOffValue(val(next, n)) ? out.offByDefault : out.addedNonZero).push(n);
  }
  return out;
}

/**
 * The full ledger: the five-bucket diff plus the mechanical rank over the OFF-BY-DEFAULT bucket.
 *
 * ⛔ `prevUniforms` may legitimately be absent — on Step 6e's automatic path the legacy material for
 * a swapped body is NEVER CONSTRUCTED (ShaderWarmup's `MATERIAL_SWAPS` note). This returns
 * `pairable: false` and an EMPTY loss set with a reason rather than an empty loss set that reads as
 * "nothing was lost". Those are opposite findings.
 */
export function swapLedgerOf({ prevUniforms, nextUniforms, shaderSource = LAB_SHADER_CORPUS } = {}) {
  if (!nextUniforms) {
    return { ok: false, reason: 'no post-swap uniform map — nothing to diff.' };
  }
  if (!prevUniforms) {
    const zero = zeroDefaultedUniformNames(nextUniforms);
    return {
      ok: true,
      pairable: false,
      reason: 'no pre-swap uniform map. On the Step-6e automatic path the legacy material is never '
            + 'constructed, so LOST is UNMEASURABLE here — it is not empty. The off-by-default rank '
            + 'below is still meaningful because it reads the lab material alone.',
      counts: { prev: 0, next: Object.keys(nextUniforms).length },
      buckets: { lost: null, lostAtZero: null, offByDefault: zero, addedNonZero: null, carried: null },
      rank: rankOffByDefault(zero, shaderSource),
    };
  }
  const buckets = diffMaterialUniforms(prevUniforms, nextUniforms);
  return {
    ok: true,
    pairable: true,
    counts: {
      prev: Object.keys(prevUniforms).length,
      next: Object.keys(nextUniforms).length,
      lost: buckets.lost.length,
      lostAtZero: buckets.lostAtZero.length,
      offByDefault: buckets.offByDefault.length,
      addedNonZero: buckets.addedNonZero.length,
      carried: buckets.carried.length,
    },
    buckets,
    rank: rankOffByDefault(buckets.offByDefault, shaderSource),
  };
}

// ── The per-frame seam (LAYER 2 items 2 + 3) ────────────────────────────────────────────────────

/** Scratch, module-scope: this runs once per lab-shader body per frame and must not allocate. */
const _invQuat = new THREE.Quaternion();
const _lightObj = new THREE.Vector3(); const _light2Obj = new THREE.Vector3();   // B4-1 — the second star's object-space direction. Module-scope like its neighbours so the seam allocates nothing per body per frame.
const _camObj = new THREE.Vector3();   const _castObj = new THREE.Vector3(); const _sclObj = new THREE.Vector3();   // B4-2 — caster scratch + the mesh world-scale probe. Module scope for the same reason as its neighbours: the shadow branch runs on every body every frame and must allocate nothing.

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
 * wired into three of them. The lab does all of this in one place (world-engine-lab.html frame());
 * so does this.
 *
 * What was wrong, verified 2026-08-05:
 *
 *  1. LIGHT IN THE WRONG SPACE. main.js fed the game's WORLD-space lightDir straight into
 *     `uLightDir`, whose own declaration says "object-space substellar direction". The surface
 *     spins (Planet.js:1896) and the parent carries axial tilt (:1544), so the terminator
 *     counter-rotated with the crust — one full sweep per planet day. The lab does the transform
 *     the game omitted (world-engine-lab.html:4896-4897); this is that transform.
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
 * @param {number}         [opts.renderDt]        seconds since the last render tick — and B4-1's `opts.lightDirWorld2`, the world-space direction to the SECOND star. A zero-length vector there is the legitimate "one star" value and is passed through AS ZERO, never normalized; it is only read when `lightDirWorld` is supplied too.
 * @param {number}         [opts.distanceRadii]   camera distance to the body, in body radii — and B4-2's opts.shadowCast, the body's WORLD-space caster record ({starPos1, starPos2, moonCount, moonPos[], moonRadius[], planetCount, planetPos[], planetRadius[]}), written on the sim tick by src/main.js and transformed into this body's object space here. Absent ⇒ the counts are zeroed, which is the no-shadow identity, NOT last frame's casters left standing.
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
  let lightObj = null; let lightObj2 = null; let shadowCast = null;   // B4-1 — lightObj2 stays null when this tick did not write it, which is a DIFFERENT fact from [0,0,0] ("this tick wrote the single-star identity"); a probe that conflated them could not tell a seam that never ran from a body with one star.
  if (opts.lightDirWorld && opts.mesh) {
    // getWorldQuaternion updates the world matrix itself, so this is correct even if the body has
    // not been touched by the scene graph walk this frame.
    opts.mesh.getWorldQuaternion(_invQuat).invert();
    _lightObj.copy(opts.lightDirWorld).applyQuaternion(_invQuat).normalize();
    u.uLightDir.value.copy(_lightObj);
    lightObj = _lightObj.toArray();  if (opts.lightDirWorld2 && u.uLightDir2) { if (opts.lightDirWorld2.lengthSq() > 0) { _light2Obj.copy(opts.lightDirWorld2).applyQuaternion(_invQuat).normalize(); } else { _light2Obj.set(0, 0, 0); } u.uLightDir2.value.copy(_light2Obj); lightObj2 = _light2Obj.toArray(); }   // ⭐ B4-1 (ledger P-02) — THE SECOND LIGHT, WORLD -> OBJECT, on the same inverted quaternion the primary just computed. ⛔ INSIDE THE PRIMARY'S GUARD ON PURPOSE: `_invQuat` is only valid because the line above inverted it, and both live call sites (Planet.updateRender, Moon.updateRender) pass the pair together. ⛔⛔ THE ORIGINAL JUSTIFICATION FOR THIS GATE WAS WRONG AND IS WITHDRAWN HERE RATHER THAN QUIETLY RE-FITTED. It said normalize() would divide by zero and put NaN in uLightDir2. IT WOULD NOT: three's Vector3.normalize() is `divideScalar(this.length() || 1)` — read in three's own math source under node_modules, deliberately NOT cited as a file:line because the citation fence resolves basenames against THIS repo and a vendored path there resolves to nothing — and the `|| 1` makes a zero vector normalize to (0,0,0). VERIFIED BOTH WAYS in this session — read in three's source and run. So the gate is NOT preventing a crash and this branch is behaviourally equivalent to the ungated form. ⭐ WHAT IT IS ACTUALLY FOR, which is smaller and true: every single-star body in the game holds `_lightDir2 = new THREE.Vector3(0,0,0)` and main.js only copies a real direction into it inside its binary branch, so the zero vector arrives here on the MAJORITY of bodies every frame — the gate skips a quaternion multiply and a sqrt on each of them, and states the single-star case in the open instead of leaving it to a library guard three is free to change. That DEPENDENCY is fenced in tests/lab-shader-perframe-seam.test.js so a three upgrade that dropped `|| 1` is caught here rather than as an implementation-defined shader artefact. Below the gate the uniform is SET to zero rather than left at whatever the previous frame put there.
  }

  // ── 3. the detail ramp ──
  if (Number.isFinite(opts.distanceRadii)) {
    const ramp = lodRampOf(opts.distanceRadii);
    u.uLodRamp.value = ramp;
    u.uOctaves.value = autoOctaves(ramp);
  }

  // ── 5. the view vector's camera operand, in THIS body's object space ──
  // The shader used to read three's world-space `cameraPosition` against an object-space vPos,
  // which is only correct at the origin with identity quaternion and unit radius — the lab, and no
  // game body. Divided by uBodyRadius so it lands in the same normalised domain vPos now uses.
  if (opts.cameraWorldPos && opts.mesh && u.uCameraPosObj) {
    _camObj.copy(opts.cameraWorldPos);
    opts.mesh.worldToLocal(_camObj);
    _camObj.divideScalar(u.uBodyRadius.value || 1.0);
    u.uCameraPosObj.value.copy(_camObj);
  }    if (opts.shadowCast && opts.mesh && u.uShadowMoonCount) { const sc = opts.shadowCast; const bodyR = u.uBodyRadius.value || 1.0; const wScale = opts.mesh.getWorldScale(_sclObj).x || 1.0; const k = 1 / (wScale * bodyR); _castObj.copy(sc.starPos1); opts.mesh.worldToLocal(_castObj); u.uStarPos1.value.copy(_castObj.divideScalar(bodyR)); _castObj.copy(sc.starPos2); opts.mesh.worldToLocal(_castObj); u.uStarPos2.value.copy(_castObj.divideScalar(bodyR)); const mc = Math.min(sc.moonCount, 6); u.uShadowMoonCount.value = mc; for (let m = 0; m < mc; m++) { _castObj.copy(sc.moonPos[m]); opts.mesh.worldToLocal(_castObj); u.uShadowMoonPos.value[m].copy(_castObj.divideScalar(bodyR)); u.uShadowMoonRadius.value[m] = sc.moonRadius[m] * k; } const pc = Math.min(sc.planetCount, 2); u.uShadowPlanetCount.value = pc; for (let q = 0; q < pc; q++) { _castObj.copy(sc.planetPos[q]); opts.mesh.worldToLocal(_castObj); u.uShadowPlanetPos.value[q].copy(_castObj.divideScalar(bodyR)); u.uShadowPlanetRadius.value[q] = sc.planetRadius[q] * k; } shadowCast = { moonCount: mc, planetCount: pc, starPos1: u.uStarPos1.value.toArray(), radiusScale: k }; } else if (u.uShadowMoonCount) { u.uShadowMoonCount.value = 0; u.uShadowPlanetCount.value = 0; }   // ── 6. the shadow casters, world -> THIS body's object space (B4-2, ledger P-03) ── ⭐⭐ F52's TRANSPORT, AND IT IS THE HALF THAT IS GENUINELY NEW WORK RATHER THAN A RESTORATION. The game hands its shader four WORLD-space vectors per caster test. This fragment has no world-space position and provably cannot be given one (uniforms.js:137 records the tap-fence throw that blocks a vWorldPos varying), so the casters are brought into the fragment's frame instead — the SAME transform the camera operand above already uses, worldToLocal then / uBodyRadius, which is why this rides that block's brace rather than inventing a second convention. ⭐ THE RADIUS NEEDS THE SCALE AND THE POSITIONS DO NOT: worldToLocal already divides the mesh's own world scale out of a POSITION, but a caster RADIUS is a bare length with no transform applied to it, so it is multiplied by k = 1/(worldScale * bodyRadius) by hand. Get that wrong in either direction and every shadow is the right shape at the wrong size — which reads as "shadows look a bit off", not as a bug, and would survive a screenshot review. ⚠ ONE COMPONENT OF getWorldScale IS READ, so a NON-UNIFORMLY scaled body mesh would break the similarity invariance the whole substitution rests on. No body in this engine is non-uniformly scaled today; this is the line that would have to change if one ever is. ⚠ "|| 1.0" ON THE SCALE IS A DIVIDE-BY-ZERO GUARD, not a default — a degenerate zero-scaled mesh would otherwise put Infinity in every caster radius. ⛔ THE ELSE ARM IS NOT DEAD CODE AND MUST NOT BE DELETED: a body whose caster list goes away (its moons unload, the system changes) would otherwise keep casting last frame's shadows forever, because these uniforms persist on the material. Zeroing the two COUNTS is sufficient and is cheaper than clearing the arrays — totalShadow reads nothing else. ⛔ RIDES THIS LINE (handoff gate: every citation-bearing file N added / N deleted; this file carries symbol-anchored citations far down it. ⚠ THE LINE NUMBER THAT USED TO BE QUOTED HERE IS DELIBERATELY GONE: written as a bare colon-plus-line-number it was parsed by the citation fence as a reference to uniforms.js — the file this same comment names two sentences earlier — and reported PAST EOF, because that file has 472 lines. A bare colon-number in prose is a citation to whatever file was mentioned last).

  return {
    time: u.uTime.value,
    octaves: u.uOctaves.value,
    lodRamp: u.uLodRamp.value,
    lightObj, lightObj2, shadowCast, starColor1: u.uStarColor1 ? u.uStarColor1.value.toArray() : null, starColor2: u.uStarColor2 ? u.uStarColor2.value.toArray() : null, starBrightness1: u.uStarBrightness1 ? u.uStarBrightness1.value : null, starBrightness2: u.uStarBrightness2 ? u.uStarBrightness2.value : null,   // B4-1 — the star set is read back through `?` guards so this diagnostic keeps working against a lab material built before B4 (an older cached bundle, or a hand-built bag in a test).   // B4-2 — shadowCast reports the RESOLVED caster counts and the radius scale as NUMBERS, so a live probe can tell "this body has no casters this frame" apart from "the seam never ran" (null) without judging a screenshot. It is null on every material that lacks uShadowMoonCount, which is every pre-B4-2 build.
    cameraPosObj: u.uCameraPosObj ? u.uCameraPosObj.value.toArray() : null,
  };
}
