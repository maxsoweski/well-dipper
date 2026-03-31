import { SeededRandom } from './SeededRandom.js';

/**
 * StyleProfileAdapter — converts a KnownObjectProfile into renderer-compatible data.
 *
 * Each known object (M42, M1, etc.) has a style profile with colors, noise params,
 * and structural hints. This adapter translates that into the exact data format
 * that Nebula.js, Galaxy.js, and SkyFeatureLayer.js expect.
 *
 * Three output modes:
 *   1. toNebulaData()  — layers + embedded stars for Nebula.js constructor
 *   2. toClusterData() — positions/colors/sizes for Galaxy.js constructor
 *   3. toSkyFeature()  — billboard params for SkyFeatureLayer rendering
 *
 * The "sky feature" mode is the lightest: a single billboard with profile colors.
 * This is the initial test path — prove the pipeline works, then add full
 * multi-distance rendering later.
 */
export class StyleProfileAdapter {
  /**
   * Convert a style profile into Nebula.js-compatible data.
   * Works for emission-nebula, planetary-nebula, and supernova-remnant types.
   *
   * @param {object} profile — from KnownObjectProfiles
   * @param {number} [renderRadius=300] — scene-space radius for the nebula mesh
   * @returns {object} data suitable for `new Nebula(data)`
   */
  static toNebulaData(profile, renderRadius = 300) {
    const rng = new SeededRandom(profile.messier || profile.name);
    const layerCount = profile.layers || 5;
    const layers = [];

    for (let i = 0; i < layerCount; i++) {
      const t = i / Math.max(layerCount - 1, 1); // 0..1 across layers

      // Blend between primary and secondary colors based on layer position
      const color = this._lerpColor(
        profile.colorPrimary,
        profile.colorSecondary,
        t * profile.colorMix + rng.range(0, 0.15)
      );

      // Each layer gets a slightly different position offset for parallax
      const offset = renderRadius * 0.25;
      const position = [
        this._gaussian(rng) * offset,
        this._gaussian(rng) * offset * 0.6,
        this._gaussian(rng) * offset,
      ];

      // Ring-shaped nebulae: push layers outward from center
      if (profile.brightnessProfile === 'ring') {
        const angle = rng.range(0, 2 * Math.PI);
        const ringR = renderRadius * rng.range(0.3, 0.5);
        position[0] += Math.cos(angle) * ringR;
        position[2] += Math.sin(angle) * ringR;
      }

      // Map brightnessProfile string to shader int:
      //   0 = center-bright, 1 = ring, 2 = scattered
      const brightnessShapeMap = { 'center-bright': 0, 'ring': 1, 'scattered': 2 };
      const brightnessShape = brightnessShapeMap[profile.brightnessProfile] ?? 0;

      layers.push({
        position,
        size: renderRadius * rng.range(0.5, 1.3),
        rotation: [
          rng.range(-0.5, 0.5),
          rng.range(0, Math.PI * 2),
          rng.range(-0.3, 0.3),
        ],
        color,
        noiseSeed: [rng.float() * 100, rng.float() * 100],
        noiseScale: profile.noiseScale || 3.0,
        opacity: rng.range(0.25, 0.6),
        domainWarpStrength: profile.domainWarpStrength ?? 0.7,
        darkLaneStrength: profile.darkLaneStrength ?? 0.0,
        asymmetry: profile.asymmetry ?? 0.0,
        brightnessShape,
      });
    }

    // Embedded stars
    const starConfig = profile.embeddedStars || { count: 4, brightestColor: [0.7, 0.8, 1.0], concentration: 0.5 };
    const starCount = Math.max(starConfig.count * 100, 200); // scale up for visual density
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Concentration controls how tightly stars cluster at center
      const spread = renderRadius * (0.1 + (1 - starConfig.concentration) * 0.5);
      starPositions[i * 3]     = this._gaussian(rng) * spread;
      starPositions[i * 3 + 1] = this._gaussian(rng) * spread * 0.7;
      starPositions[i * 3 + 2] = this._gaussian(rng) * spread;

      // Star colors: brightest few get the profile color, rest are dimmer
      const isBright = i < starConfig.count;
      const brightness = isBright ? rng.range(0.7, 1.0) : rng.range(0.3, 0.7);
      starColors[i * 3]     = starConfig.brightestColor[0] * brightness;
      starColors[i * 3 + 1] = starConfig.brightestColor[1] * brightness;
      starColors[i * 3 + 2] = starConfig.brightestColor[2] * brightness;

      starSizes[i] = isBright ? rng.range(3, 6) : rng.range(1, 2.5);
    }

    // Tour stops
    const tourStops = [
      { name: 'Approach',  position: [0, renderRadius * 0.3, renderRadius * 0.8], orbitDistance: renderRadius * 1.2, bodyRadius: renderRadius, linger: 40 },
      { name: 'Interior',  position: [0, 0, 0],                                    orbitDistance: renderRadius * 0.3, bodyRadius: renderRadius * 0.2, linger: 35 },
      { name: 'Detail',    position: [renderRadius * 0.2, 0, renderRadius * 0.15], orbitDistance: renderRadius * 0.15, bodyRadius: renderRadius * 0.08, linger: 30 },
    ];

    const data = {
      type: profile.type,
      layers,
      starPositions,
      starColors,
      starSizes,
      starCount,
      radius: renderRadius,
      tourStops,
      // Preserve profile metadata for display
      _profileName: profile.name,
      _profileKey: profile.messier,
    };

    // Central star for planetary nebulae
    if (profile.centralStar) {
      data.centralStar = {
        color: profile.centralStar.color,
        radius: renderRadius * 0.02,
        luminosity: profile.centralStar.luminosity || 1.0,
      };
    }

    return data;
  }

  /**
   * Convert a style profile into Galaxy.js-compatible data.
   * Works for globular-cluster and open-cluster types.
   *
   * @param {object} profile — from KnownObjectProfiles
   * @param {number} [renderRadius=12000] — scene-space radius
   * @returns {object} data suitable for `new Galaxy(data)`
   */
  static toClusterData(profile, renderRadius = 12000) {
    const rng = new SeededRandom(profile.messier || profile.name);
    const starConfig = profile.embeddedStars || { count: 60, brightestColor: [1.0, 0.9, 0.6], concentration: 0.7 };

    const particleCount = Math.max(starConfig.count * 200, 5000);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const isGlobular = profile.type === 'globular-cluster';
    const coreRadius = renderRadius * (isGlobular ? 0.12 : 0.3);

    for (let i = 0; i < particleCount; i++) {
      let r;
      if (isGlobular) {
        // King profile: concentrate toward center
        const maxAngle = Math.atan(renderRadius / coreRadius);
        r = coreRadius * Math.tan(rng.float() * maxAngle);
      } else {
        // Open cluster: more uniform with mild central concentration
        r = renderRadius * Math.pow(rng.float(), 0.7);
      }

      const theta = rng.range(0, 2 * Math.PI);
      const phi = Math.acos(rng.range(-1, 1));

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Color from profile with variation
      const normalizedR = r / renderRadius;
      const warmth = rng.range(0.8, 1.0);
      const edgeFade = normalizedR < 0.5 ? 1.0 : Math.max(0.15, 1.0 - (normalizedR - 0.5) * 1.4);

      colors[i * 3]     = profile.colorPrimary[0] * warmth * edgeFade;
      colors[i * 3 + 1] = profile.colorPrimary[1] * warmth * edgeFade;
      colors[i * 3 + 2] = profile.colorPrimary[2] * warmth * edgeFade;

      sizes[i] = isGlobular
        ? (normalizedR < 0.15 ? rng.range(2, 4) : rng.range(1, 2.5))
        : rng.range(1.5, 4);
    }

    const tourStops = [
      { name: 'Approach', position: [0, renderRadius * 0.4, renderRadius * 0.8], orbitDistance: renderRadius * 1.5, bodyRadius: renderRadius, linger: 40 },
      { name: 'Core',     position: [0, 0, 0],                                    orbitDistance: renderRadius * 0.2, bodyRadius: coreRadius, linger: 35 },
    ];

    return {
      type: profile.type,
      positions,
      colors,
      sizes,
      particleCount,
      spikeStars: true, // clusters get diffraction spikes
      radius: renderRadius,
      tourStops,
      _profileName: profile.name,
      _profileKey: profile.messier,
    };
  }

  /**
   * Convert a style profile into a SkyFeatureLayer-compatible feature object.
   * This is the lightweight billboard representation used when the object
   * is visible in the sky from a distance.
   *
   * @param {object} profile — from KnownObjectProfiles
   * @param {{ x: number, y: number, z: number }} playerPos — current player position
   * @returns {object|null} feature object for SkyFeatureLayer.setFeatures(), or null if too far
   */
  static toSkyFeature(profile, playerPos) {
    const dx = profile.galacticPos.x - playerPos.x;
    const dy = profile.galacticPos.y - playerPos.y;
    const dz = profile.galacticPos.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Too far away to see (even bright objects fade past ~5 kpc for nebulae)
    if (distance > 5.0) return null;

    return {
      type: profile.type,
      position: { ...profile.galacticPos },
      radius: profile.radius,
      distance,
      color: profile.colorPrimary,
      seed: profile.messier || profile.name,
      insideFeature: distance < profile.radius,
      // Extra metadata for display
      name: profile.name,
      messier: profile.messier,
    };
  }

  // ── Utility ──────────────────────────────────────────────────────

  static _lerpColor(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }

  static _gaussian(rng) {
    const u1 = rng.float() || 0.0001;
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
