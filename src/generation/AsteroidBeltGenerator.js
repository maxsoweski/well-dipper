/**
 * AsteroidBeltGenerator — produces data for an asteroid belt.
 *
 * Pure data, no Three.js objects. AsteroidBelt.js renders this data
 * using InstancedMesh for performance (one draw call per shape variant).
 *
 * Real asteroid belts are absurdly sparse (you'd never see another rock),
 * but we compress distances dramatically for visual drama — same approach
 * as our planet orbital spacing.
 *
 * Size distribution follows a power law (many small, few large),
 * matching real asteroid populations.
 */
export class AsteroidBeltGenerator {
  static COLORS = [
    [0.35, 0.28, 0.20],  // Brown
    [0.30, 0.30, 0.32],  // Grey
    [0.40, 0.32, 0.22],  // Tan
    [0.25, 0.22, 0.20],  // Dark stone
    [0.45, 0.38, 0.28],  // Sandy
    [0.22, 0.20, 0.18],  // Charcoal
  ];

  /**
   * Generate asteroid belt data between two orbital radii.
   * @param {SeededRandom} rng
   * @param {number} innerOrbit - radius of inner bounding planet orbit
   * @param {number} outerOrbit - radius of outer bounding planet orbit
   * @returns {object} belt data
   */
  static generate(rng, innerOrbit, outerOrbit) {
    const gapCenter = (innerOrbit + outerOrbit) / 2;
    const gapWidth = outerOrbit - innerOrbit;
    const beltWidth = gapWidth * 0.3;     // half-width of the belt
    const thickness = beltWidth * 0.15;   // vertical scatter (thin disk)

    const count = rng.int(80, 180);
    const asteroids = [];

    for (let i = 0; i < count; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const r = gapCenter + rng.range(-beltWidth, beltWidth);
      const y = rng.range(-thickness, thickness);

      // Power law size: many tiny rocks, few big boulders
      // pow(t, 3) gives a nice long tail of mostly-small with rare large
      const t = rng.float();
      const size = 0.03 + Math.pow(t, 3) * 0.35;

      // Slight per-asteroid color variation around a base tone
      const baseColor = rng.pick(this.COLORS);
      const color = baseColor.map(c =>
        Math.max(0, Math.min(1, c + rng.range(-0.05, 0.05)))
      );

      // Tumble axis (normalized)
      const ax = rng.range(-1, 1);
      const ay = rng.range(-1, 1);
      const az = rng.range(-1, 1);
      const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;

      // Orbital speed: Kepler-ish with slight variation
      const baseSpeed = 0.06 / Math.pow(r / innerOrbit, 1.5);
      const orbitSpeed = baseSpeed * rng.range(0.85, 1.15);

      asteroids.push({
        angle,
        radius: r,
        height: y,
        size,
        color,
        tumbleAxis: [ax / len, ay / len, az / len],
        tumbleSpeed: rng.range(0.2, 1.0),
        orbitSpeed,
        shapeIndex: rng.int(0, 3),
      });
    }

    return {
      centerRadius: gapCenter,
      width: beltWidth,
      thickness,
      asteroids,
    };
  }
}
