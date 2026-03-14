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
