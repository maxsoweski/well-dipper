/**
 * POSTERIZE_LEVELS / POSTERIZE_QUANTUM — the colour quantum, as shared uniform objects.
 *
 * BLOCK B2P. Max, 2026-08-20: "as we add detail to the game we'll want to be able to add
 * additional levels/make this less posterized. Can we work that in?" This is the carrier.
 *
 * ⭐ WHY SHARED OBJECTS AND NOT NUMBERS. Every material in this game is BUILT ONCE AND MUTATED, never
 * rebuilt per frame. A build-time read of a setting therefore leaves every already-mounted body at
 * whatever the value was when it mounted — a shipped no-op wearing a feature's name. three reads
 * `.value` off the uniform object on every draw, so handing ONE SHARED OBJECT PER SPELLING —
 * POSTERIZE_QUANTUM to the game's vec2, POSTERIZE_LEVELS to the lab's scalar — makes ONE setter call
 * update every live material: no registry, no per-frame walk, no body missed. ⚠ TWO objects, not one.
 *
 * ⛔ THE ONE WAY THIS BREAKS is a material path that DEEP-CLONES its uniform map
 * (THREE.UniformsUtils.clone or equivalent), which would hand that material a private copy that
 * stops tracking. Checked before this was written: `UniformsUtils` appears NOWHERE in src/, and no
 * path that receives this object clones it. If one is ever introduced, this file's mechanism goes
 * with it — replace it with an explicit setter that walks live materials, do not leave both.
 *
 * ⛔ NOT PER-BODY. This is a global DISPLAY setting, not a condition-derived quantity. No driver
 * pack writes it, and making it body-derived would need a law nobody has authored.
 *
 * ⚠ FIVE DIFFERENT QUANTITIES LIVE IN THIS BLOCK AND THE PROSE USED TO SWAP THEM. Say which one you mean: SIX game fragment PROGRAMS (gas, rocky, exotic, ring, moon, belt) · SIX posterize() CALL SITES · FOUR posterize() SOURCE COPIES (Planet.js carries two, body and ring) · FOUR `uniform vec2 uPosterizeLevels` DECLARATION SITES (FRAG_HEADER, ring, moon, belt) · THREE FILES (Planet.js, Moon.js, AsteroidBelt.js). All six programs take POSTERIZE_QUANTUM; the counts differ because a header is shared and a file holds two programs. THE SIX CALL SITES:
 *   - Planet.js  GAS_BODY / ROCKY_BODY / EXOTIC_BODY   (3 sites in THREE DISTINCT PROGRAMS — `PLANET_SHADER_VARIANTS` at Planet.js:1461-1463 splices each body onto FRAG_HEADER — sharing ONE declaration and ONE posterize copy, both in that header)
 *   - Planet.js  _createRing                            (1 site, its own program + its own declaration + its own posterize copy — Planet.js is the ONE file holding two programs, which is why the SOURCE-COPY count is 4 and not 3)
 *   - Moon.js    the legacy plain-moon program          (1 site — note its edgeWidth is 0.6, not 0.4)
 *   - AsteroidBelt.js                                   (1 site)
 * plus the world-engine lab material's own `uLevels`, which takes the SCALAR POSTERIZE_LEVELS —
 * its declaration is `uniform float uLevels` and cannot carry a vec2 — without which the feature
 * evaporates the moment the lab flag flips and 846 planets and 632 moons render through the lab.
 */

import * as THREE from 'three';  /** The shipped value. 6.0 is what every call site had hard-coded before B2P. */
export const POSTERIZE_LEVELS_DEFAULT = 6;

/** Below 2 the quantiser stops being a quantiser; above 64 the dither costs more than it buys. */
export const POSTERIZE_LEVELS_MIN = 2;
export const POSTERIZE_LEVELS_MAX = 64;

/**
 * THE LAB'S uniform object. The world-engine program declares `uniform float uLevels` — a scalar,
 * which cannot carry the vec2 below — so the lab keeps this one. Hand the object itself, never a
 * copy. setPosterizeLevels writes this AND POSTERIZE_QUANTUM: one value in two shapes, one writer.
 */
export const POSTERIZE_LEVELS = { value: 6.0 };

/**
 * THE GAME PROGRAMS' QUANTUM, as a vec2: .x = levels, .y = its exact float32 reciprocal. The
 * reciprocal is CARRIED from the CPU rather than derived in GLSL — NOT because `1.0 / levels` is
 * inexact (it is bit-identical to the folded literal, measured 0x3e2aaaab) but because a DERIVED
 * reciprocal lets the compiler re-fold `edgeWidth * (1.0 / levels)` back into a divide, which
 * rounds differently at edgeWidth 0.6. An opaque uniform denies it that reassociation.
 * setPosterizeLevels is the ONLY writer of this and of POSTERIZE_LEVELS, so they cannot drift. ⚠ THAT IS A CONSTRUCTION ARGUMENT, AND IT IS NOW ALSO FENCED: tests/posterize-levels-wiring.test.js B2P 7 asserts .y === Math.fround(1/.x) at every integer level the clamp admits, not only at the shipped 6, so a .y that stopped tracking at some non-default level reddens instead of shipping.
 */
export const POSTERIZE_QUANTUM = { value: new THREE.Vector2(6.0, Math.fround(1 / 6)) };

/**
 * The one clamp. Spent on BOTH sides of the boundary — by setPosterizeLevels on its way to the
 * shader, and by Settings on its way to localStorage — so the stored number and the drawn number
 * are the same number. A non-finite input falls back to the shipped default rather than writing
 * NaN into six game programs; levels 0 in particular would make the CPU-side `Math.fround(1 / levels)` an Inf in POSTERIZE_QUANTUM.value.y, and the
 * whole frame NaN.
 * @param {number} levels
 * @returns {number} a finite number in [POSTERIZE_LEVELS_MIN, POSTERIZE_LEVELS_MAX]
 */
export function clampPosterizeLevels(levels) {
  const n = Number(levels);
  if (!Number.isFinite(n)) return POSTERIZE_LEVELS_DEFAULT;
  return Math.min(POSTERIZE_LEVELS_MAX, Math.max(POSTERIZE_LEVELS_MIN, n));
}

/**
 * Move the quantum. THE ONLY WRITER of either object: the scalar POSTERIZE_LEVELS and the vec2
 * POSTERIZE_QUANTUM are set together here, so a level and its carried reciprocal cannot disagree.
 * A non-finite argument is ignored rather than writing NaN into the six game programs (seven counting the lab, whose scalar `uLevels` takes POSTERIZE_LEVELS). ⛔ NO SHIPPED *GAME* SHADER DIVIDES ANY MORE — the reciprocal is computed HERE, on the CPU. ⚠ BUT THE LAB PROGRAM STILL DIVIDES, TWICE: src/worldengine/shaders/height.glsl.js:683-684 spends `/ levels` on the SCALAR `uLevels` this file also feeds, so "no shipped shader divides" is FALSE and was corrected 2026-08-20. clampPosterizeLevels floors both objects at 2, so neither divide can reach an Inf.
 */
export function setPosterizeLevels(levels) {
  const n = Number(levels);
  if (!Number.isFinite(n)) return POSTERIZE_LEVELS.value;   // a stray NaN leaves the picture alone rather than blanking it
  POSTERIZE_LEVELS.value = clampPosterizeLevels(n);
  POSTERIZE_QUANTUM.value.set(POSTERIZE_LEVELS.value, Math.fround(1 / POSTERIZE_LEVELS.value));  // ⭐ THE CARRIED RECIPROCAL. Math.fround pins it to the float32 the GPU will receive, which is the constant the pre-B2P compiler folded `/ 6.0` to. Derived in the shader instead, the compiler re-folds it into a divide and the top band shifts — see the vec2's own block above.
  return POSTERIZE_LEVELS.value;
}
