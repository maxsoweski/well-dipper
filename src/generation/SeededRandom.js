import Alea from 'alea';

/**
 * SeededRandom — a random number generator that always produces the same
 * sequence of numbers for the same seed string.
 *
 * Why this matters: if you generate a star system with seed "alpha-7392",
 * it will look identical every time. This means systems are reproducible
 * and shareable — "check out seed X" always shows the same thing.
 *
 * Uses the Alea algorithm under the hood (fast, high-quality PRNG).
 */
export class SeededRandom {
  constructor(seed) {
    this.rng = new Alea(seed);
  }

  /** Random float between 0 (inclusive) and 1 (exclusive) */
  float() {
    return this.rng();
  }

  /** Random float between min and max */
  range(min, max) {
    return min + this.rng() * (max - min);
  }

  /** Random integer between min and max (inclusive) */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** Pick a random element from an array */
  pick(array) {
    return array[this.int(0, array.length - 1)];
  }

  /** Returns true with the given probability (0 to 1) */
  chance(probability) {
    return this.rng() < probability;
  }

  /**
   * Random value from a normal (Gaussian) distribution.
   * Uses the Box-Muller transform: takes two uniform random numbers
   * and converts them into a normally distributed value.
   *
   * @param {number} mean - center of the distribution (default 0)
   * @param {number} stddev - spread of the distribution (default 1)
   * @returns {number} a value that clusters around the mean
   */
  gaussian(mean = 0, stddev = 1) {
    const u1 = this.rng();
    const u2 = this.rng();
    // Box-Muller: two uniform samples → one normal sample
    const normal = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
    return mean + normal * stddev;
  }

  /**
   * Random value from a log-normal distribution.
   * Always positive, right-skewed — perfect for orbital period ratios,
   * where most values cluster near the median but some are much larger.
   *
   * @param {number} mu - mean of the underlying normal (default 0)
   * @param {number} sigma - stddev of the underlying normal (default 1)
   * @returns {number} a positive value
   */
  logNormal(mu = 0, sigma = 1) {
    return Math.exp(this.gaussian(mu, sigma));
  }

  /**
   * Gaussian with hard clamp to a range.
   * Useful when you want a bell curve but need to stay within bounds
   * (e.g., metallicity between -1.0 and +0.5).
   *
   * @param {number} mean - center of the distribution
   * @param {number} stddev - spread
   * @param {number} min - hard minimum
   * @param {number} max - hard maximum
   * @returns {number} clamped gaussian value
   */
  gaussianClamped(mean, stddev, min, max) {
    return Math.max(min, Math.min(max, this.gaussian(mean, stddev)));
  }

  /**
   * Create a child SeededRandom with a derived seed.
   * Useful for generating sub-parts independently —
   * e.g., planet 3's details don't change if you add a planet 4.
   */
  child(suffix) {
    // Use current RNG to generate a numeric seed, combined with the suffix
    return new SeededRandom(this.rng() + '-' + suffix);
  }
}

/**
 * Deterministic float in [0,1) from a namespaced identity key.
 *
 * ⛔ WHY THIS IS NOT `new SeededRandom(key).float()`, which is the idiom used
 * for `moonecc:` at _computeTidalHeating below.
 *
 * Instrument B's DRAW STREAM channel counts draws with an accessor installed on
 * `SeededRandom.prototype` (tests/body-identity-fence.test.js:225-241), so it
 * counts EVERY instance, not just the passed-in generation stream. `moonecc:`
 * reads green there only because its draws were already baked into
 * tests/baseline/body-identity.json at Step 0 (`b2ac455`). A NEW sub-rng is not,
 * and it reds the channel — measured, not argued: this exact block with
 * `new SeededRandom(compSeed).float()` moves the draw profile on 197 of 221
 * fence seeds ("wd-0: first divergence at yield 2 (68 → 69); total 8903 →
 * 8907"), +1 per plain moon, with zero drawn VALUES moved. The same block with
 * this function moves 0 of 221.
 *
 * That matters beyond one commit's colour: DRAW STREAM is the only channel that
 * detects a leak into the shared stream, and a genuine `rng.float()` leak
 * appended here produces a signature byte-identical to the sub-rng's. Spending
 * the channel's red on an expected, benign construction would leave the next
 * commit unable to tell a leak from the noise.
 *
 * The namespace discipline documented at _computeTidalHeating is unchanged and
 * is what this preserves: the key is a prefix plus the body's stable identity,
 * carrying no per-system seed and no per-body counter, so the value is a pure
 * function of the body and ZERO numbers come off the passed-in `rng`.
 *
 * Hash is xmur3's mixer (two Math.imul rounds + xorshift finalizer) for
 * avalanche — `deriveComposition` uses this float as scatter across three
 * correlated outputs, so a low-avalanche hash would band them.
 *
 * ⭐ LIFTED HERE 2026-09-04 (workstream volatile-delivery) so PlanetGenerator can use it too.
 * It was private to MoonGenerator, and the volatile-delivery draw needed the same discipline on
 * the PLANET path: a `new SeededRandom(...)` there moved the fence's draw profile on 212 of 221
 * seeds with zero values moved — the same benign-looking red this comment already warns about.
 * ONE copy, two callers; do not re-inline it.
 *
 * @param {string} key - namespaced identity key, e.g. `mooncomp:...` / `vdel:...`
 * @returns {number} float in [0,1)
 */
export function namespacedFloat(key) {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
