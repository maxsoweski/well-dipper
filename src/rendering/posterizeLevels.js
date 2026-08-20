/**
 * POSTERIZE_LEVELS — the colour quantum, as ONE shared uniform object.
 *
 * BLOCK B2P. Max, 2026-08-20: "as we add detail to the game we'll want to be able to add
 * additional levels/make this less posterized. Can we work that in?" This is the carrier.
 *
 * ⭐ WHY ONE OBJECT AND NOT A NUMBER. Every material in this game is BUILT ONCE AND MUTATED, never
 * rebuilt per frame. A build-time read of a setting therefore leaves every already-mounted body at
 * whatever the value was when it mounted — a shipped no-op wearing a feature's name. three reads
 * `.value` off the uniform object on every draw, so handing THE SAME OBJECT to every material's
 * uniform map makes one assignment update every live material: no registry, no per-frame walk, and
 * no way for a body to be missed because nobody registered it.
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
 * THE SIX FRAGMENT CALL SITES IT FEEDS, across FOUR programs:
 *   - Planet.js  GAS_BODY / ROCKY_BODY / EXOTIC_BODY   (3 sites, ONE declaration in FRAG_HEADER)
 *   - Planet.js  _createRing                            (1 site, its own program + posterize copy)
 *   - Moon.js    the legacy plain-moon program          (1 site — note its edgeWidth is 0.6, not 0.4)
 *   - AsteroidBelt.js                                   (1 site)
 * plus the world-engine lab material's own `uLevels`, which LabPlanetMaterial hands this same
 * object — without which the feature evaporates the moment the lab flag flips and 846 planets and
 * 632 moons start rendering through the lab program.
 */

/** The shipped value. 6.0 is what every call site had hard-coded before B2P. */
export const POSTERIZE_LEVELS_DEFAULT = 6;

/** Below 2 the quantiser stops being a quantiser; above 64 the dither costs more than it buys. */
export const POSTERIZE_LEVELS_MIN = 2;
export const POSTERIZE_LEVELS_MAX = 64;

/**
 * THE shared uniform object. Hand this object itself — never a copy, never `{ value: ... }` built
 * from it — to every material that spends the colour quantum.
 * @type {{value: number}}
 */
export const POSTERIZE_LEVELS = { value: 6.0 };

/**
 * Move the quantum. Every live material follows on its next draw, because they all hold this
 * object. A non-finite argument is ignored rather than writing NaN into four shader programs.
 * @param {number} levels
 * @returns {number} the value actually in force after the call
 */
export function setPosterizeLevels(levels) {
  const n = Number(levels);
  if (!Number.isFinite(n)) return POSTERIZE_LEVELS.value;
  POSTERIZE_LEVELS.value = Math.min(POSTERIZE_LEVELS_MAX, Math.max(POSTERIZE_LEVELS_MIN, n));
  return POSTERIZE_LEVELS.value;
}
