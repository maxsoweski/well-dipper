import { auToScene } from '../core/ScaleConstants.js';

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
 *
 * Now outputs both physical (AU/scene) and map units.
 */
export class AsteroidBeltGenerator {
  // Mostly grey tones — real asteroids are dull grey rock
  static COLORS = [
    [0.40, 0.40, 0.42],  // Grey
    [0.38, 0.38, 0.40],  // Cool grey
    [0.42, 0.42, 0.44],  // Light grey
    [0.35, 0.35, 0.37],  // Medium grey
    [0.44, 0.43, 0.40],  // Warm grey (rare brownish tint)
    [0.36, 0.36, 0.38],  // Steel grey
  ];

  // Composition-based colors (physics-driven, replaces uniform grey)
  static COMPOSITION_COLORS = {
    's-type':  [0.50, 0.45, 0.40],  // light grey-brown (silicate)
    'c-type':  [0.15, 0.13, 0.12],  // very dark (carbonaceous)
    'mixed':   [0.35, 0.33, 0.32],  // medium grey
    'metallic': [0.70, 0.65, 0.55], // bright metallic glint (rare)
  };

  /**
   * Generate asteroid belt data between two orbital radii.
   * @param {SeededRandom} rng
   * @param {number} innerOrbit - radius of inner bounding planet orbit (map units)
   * @param {number} outerOrbit - radius of outer bounding planet orbit (map units)
   * @param {number} [innerOrbitAU] - same in AU (optional, for physical data)
   * @param {number} [outerOrbitAU] - same in AU (optional, for physical data)
   * @param {object} [physicsData] - from PhysicsEngine.shouldBeltExist()
   *   { compositionZones: [{innerAU, outerAU, type, color}], gaps: [{radiusAU, resonance}] }
   * @returns {object} belt data
   */
  static generate(rng, innerOrbit, outerOrbit, innerOrbitAU = 0, outerOrbitAU = 0, physicsData = null) {
    // Map-scale belt (backward compat — used by current renderer)
    const gapCenter = (innerOrbit + outerOrbit) / 2;
    const gapWidth = outerOrbit - innerOrbit;
    const beltWidth = gapWidth * 0.3;     // half-width of the belt
    const thickness = beltWidth * 0.15;   // vertical scatter (thin disk)

    // Physical-scale belt (AU)
    const gapCenterAU = (innerOrbitAU + outerOrbitAU) / 2;
    const gapWidthAU = outerOrbitAU - innerOrbitAU;
    const beltWidthAU = gapWidthAU * 0.3;
    const thicknessAU = beltWidthAU * 0.15;

    const count = rng.int(250, 450);
    const asteroids = [];

    // Pre-compute gap radii in map units for Kirkwood gap culling
    const gapRadiiMap = [];
    if (physicsData?.gaps && innerOrbitAU > 0) {
      const auToMap = (outerOrbit - innerOrbit) / (outerOrbitAU - innerOrbitAU || 1);
      for (const gap of physicsData.gaps) {
        const mapRadius = innerOrbit + (gap.radiusAU - innerOrbitAU) * auToMap;
        // Gap width scales with resonance order — 2:1 wider than 7:3
        const widthFraction = 0.015; // ~1.5% of belt radius
        gapRadiiMap.push({ center: mapRadius, halfWidth: gapCenter * widthFraction });
      }
    }

    for (let i = 0; i < count; i++) {
      const angle = rng.range(0, Math.PI * 2);
      // Fractional offset within belt (-1 to 1)
      const beltFraction = rng.range(-1, 1);
      const r = gapCenter + beltFraction * beltWidth;
      const thickFraction = rng.range(-1, 1);
      const y = thickFraction * thickness;

      // Kirkwood gap culling: skip asteroids that land in resonance gaps
      if (gapRadiiMap.length > 0) {
        let inGap = false;
        for (const gap of gapRadiiMap) {
          if (Math.abs(r - gap.center) < gap.halfWidth) {
            // 70% chance of being culled (gaps aren't perfectly clean)
            if (rng.float() < 0.7) { inGap = true; break; }
          }
        }
        if (inGap) continue;
      }

      // Power law size: mostly pixel-sized dust, very rarely a visible boulder
      // t^6 means ~98% of asteroids are under 0.02 (single pixel at distance)
      const t = rng.float();
      const size = 0.012 + Math.pow(t, 6) * 0.06;

      // Color: composition-based if physics data available, otherwise uniform grey
      let baseColor;
      if (physicsData?.compositionZones && innerOrbitAU > 0) {
        // Convert map radius back to AU to find composition zone
        const auToMap = (outerOrbit - innerOrbit) / (outerOrbitAU - innerOrbitAU || 1);
        const asteroidAU = innerOrbitAU + (r - innerOrbit) / auToMap;
        baseColor = this._getCompositionColor(asteroidAU, physicsData.compositionZones, rng);
      } else {
        baseColor = rng.pick(this.COLORS);
      }
      const color = baseColor.map(c =>
        Math.max(0, Math.min(1, c + rng.range(-0.05, 0.05)))
      );

      // Tumble axis (normalized)
      const ax = rng.range(-1, 1);
      const ay = rng.range(-1, 1);
      const az = rng.range(-1, 1);
      const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;

      // Orbital speed: Kepler-ish with slight variation
      const baseSpeed = 0.00125 / Math.pow(r / innerOrbit, 1.5);
      const orbitSpeed = baseSpeed * rng.range(0.85, 1.15);

      asteroids.push({
        angle,
        radius: r,
        height: y,
        size,
        color,
        tumbleAxis: [ax / len, ay / len, az / len],
        tumbleSpeed: rng.range(0.07, 0.33),
        orbitSpeed,
        shapeIndex: rng.int(0, 3),
      });
    }

    return {
      // Physics metadata (for debug/display)
      physicsApplied: !!physicsData,
      gapsCulled: physicsData?.gaps?.length || 0,
      compositionZones: physicsData?.compositionZones || null,
      // Map/backward-compat units
      centerRadius: gapCenter,
      width: beltWidth,
      thickness,
      // Physical units
      centerRadiusAU: gapCenterAU,
      widthAU: beltWidthAU,
      thicknessAU,
      centerRadiusScene: auToScene(gapCenterAU),
      widthScene: auToScene(beltWidthAU),
      thicknessScene: auToScene(thicknessAU),
      asteroids,
    };
  }

  /**
   * Get composition-based color for an asteroid at a given AU position.
   * @param {number} asteroidAU - orbital radius in AU
   * @param {Array} zones - from PhysicsEngine.beltCompositionZones()
   * @param {SeededRandom} rng
   * @returns {number[]} [r, g, b]
   */
  static _getCompositionColor(asteroidAU, zones, rng) {
    // Find which composition zone this asteroid is in
    for (const zone of zones) {
      if (asteroidAU >= zone.innerAU && asteroidAU <= zone.outerAU) {
        // 2-3% chance of metallic glint (metal-rich fragment)
        if (rng.float() < 0.025) {
          return [...this.COMPOSITION_COLORS['metallic']];
        }
        return zone.color ? [...zone.color] : [...(this.COMPOSITION_COLORS[zone.type] || this.COLORS[0])];
      }
    }
    // Outside all zones — use mixed color
    return [...(this.COMPOSITION_COLORS['mixed'] || this.COLORS[0])];
  }
}
