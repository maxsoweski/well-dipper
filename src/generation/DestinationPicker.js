/**
 * DestinationPicker — chooses what type of destination the next warp
 * will lead to: a star system (most common) or a deep sky object
 * like a galaxy, nebula, or star cluster.
 *
 * Uses weighted probability so deep sky objects are rare treats (~15%).
 * The weights roughly reflect how impressive each type is — spirals
 * and emission nebulae are more common than planetaries.
 */
export class DestinationPicker {
  static WEIGHTS = [
    { type: 'star-system',       weight: 0.85  },
    { type: 'spiral-galaxy',     weight: 0.04  },
    { type: 'elliptical-galaxy', weight: 0.015 },
    { type: 'emission-nebula',   weight: 0.03  },
    { type: 'planetary-nebula',  weight: 0.015 },
    { type: 'globular-cluster',  weight: 0.025 },
    { type: 'open-cluster',      weight: 0.025 },
  ];

  /**
   * Pick a destination type using the given SeededRandom.
   * @param {SeededRandom} rng
   * @returns {string} destination type key
   */
  static pick(rng) {
    const roll = rng.float();
    let cumulative = 0;
    for (const entry of this.WEIGHTS) {
      cumulative += entry.weight;
      if (roll < cumulative) return entry.type;
    }
    return 'star-system'; // fallback (rounding safety)
  }

  /** Check if a destination type is a deep sky object (not a star system). */
  static isDeepSky(type) {
    return type !== 'star-system';
  }
}
