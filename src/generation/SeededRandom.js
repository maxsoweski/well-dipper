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
   * Create a child SeededRandom with a derived seed.
   * Useful for generating sub-parts independently —
   * e.g., planet 3's details don't change if you add a planet 4.
   */
  child(suffix) {
    // Use current RNG to generate a numeric seed, combined with the suffix
    return new SeededRandom(this.rng() + '-' + suffix);
  }
}
