import { earthRadiiToScene, EARTH_RADIUS_AU, AU_TO_SCENE } from '../core/ScaleConstants.js';
import { PlanetGenerator } from './PlanetGenerator.js';

/**
 * MoonGenerator — produces data describing moons orbiting a planet.
 *
 * Moon orbit distances use realistic multiples of parent radius:
 * - Close moons: 6-12x parent radius (Io at 5.9 Jupiter radii)
 * - Mid moons: 12-30x parent radius (Europa at 9.4, Ganymede at 15)
 * - Far moons: 30-60x parent radius (Earth's Moon at 60 Earth radii)
 *
 * Moon types:
 * - captured:     Tiny, dark, irregular (Phobos/Deimos). Very low albedo.
 * - rocky:        Cratered gray spheres (Earth's Moon, Callisto).
 * - ice:          White/light blue, cracked surfaces (Europa, Enceladus).
 * - volcanic:     Yellow-orange sulfur surfaces (Io). Rare, only innermost of gas giants.
 * - terrestrial:  Rare, large moons with oceans/land (like a mini-Earth). Gas giant moons only.
 */
export class MoonGenerator {
  static TYPES = ['captured', 'rocky', 'ice', 'volcanic', 'terrestrial'];

  // Color palettes: base and accent must differ by ≥0.2 per channel so surface
  // detail survives 6-level posterization (each step = 1/6 ≈ 0.167).
  static PALETTES = {
    captured: [
      { base: [0.12, 0.10, 0.09], accent: [0.35, 0.30, 0.25] },    // Dark charcoal + warm gray
      { base: [0.08, 0.08, 0.10], accent: [0.30, 0.25, 0.22] },    // Near-black + brown-gray
      { base: [0.14, 0.12, 0.08], accent: [0.38, 0.28, 0.20] },    // Dark rusty + sandy
    ],
    rocky: [
      { base: [0.55, 0.53, 0.50], accent: [0.22, 0.20, 0.18] },    // Light highlands + dark maria
      { base: [0.50, 0.45, 0.42], accent: [0.18, 0.16, 0.15] },    // Moon-gray + deep shadow
      { base: [0.48, 0.40, 0.35], accent: [0.20, 0.18, 0.16] },    // Brown highland + dark basin
    ],
    ice: [
      { base: [0.85, 0.88, 0.92], accent: [0.30, 0.40, 0.55] },    // Bright ice + deep blue cracks
      { base: [0.90, 0.90, 0.95], accent: [0.40, 0.50, 0.65] },    // Brilliant white + teal cracks
      { base: [0.70, 0.75, 0.82], accent: [0.25, 0.35, 0.50] },    // Blue-gray ice + dark fissures
    ],
    volcanic: [
      { base: [0.75, 0.65, 0.20], accent: [0.12, 0.08, 0.05] },    // Sulfur yellow + dark lava
      { base: [0.80, 0.55, 0.12], accent: [0.15, 0.06, 0.04] },    // Orange-yellow + black lava
    ],
    terrestrial: [
      { base: [0.08, 0.15, 0.50], accent: [0.25, 0.50, 0.18] },    // Blue ocean + green land
      { base: [0.06, 0.12, 0.45], accent: [0.35, 0.55, 0.12] },    // Dark ocean + lush green
      { base: [0.10, 0.20, 0.48], accent: [0.40, 0.38, 0.15] },    // Ocean + savanna
    ],
  };

  /**
   * Generate moon data for a planet.
   * @param {SeededRandom} rng
   * @param {object} planetData - parent planet's data
   * @param {number} moonIndex - 0 = closest moon, higher = further out
   * @param {number} totalMoons - how many moons this planet has
   * @returns {object} moon data
   */
  // Planet types that can appear as moons of large planets.
  // NOT gas-giant (too massive), hot-jupiter (needs star proximity),
  // lava (inner-system only), eyeball (tidal lock to star), carbon (keep rare).
  static PLANET_MOON_TYPES = ['terrestrial', 'ocean', 'ice', 'rocky', 'venus', 'sub-neptune'];

  static generate(rng, planetData, moonIndex, totalMoons) {
    // ── Planet-moon check: large planets can have planet-class moons ──
    // Gas giants and sub-neptunes with 3+ moons, not the innermost slot
    // (innermost is reserved for volcanic Io-like moons).
    // ~15% chance per eligible slot.
    const isLargeParent = planetData.type === 'gas-giant' || planetData.type === 'sub-neptune';
    if (isLargeParent && moonIndex > 0 && totalMoons >= 3 && rng.chance(0.15)) {
      return this._generatePlanetMoon(rng, planetData, moonIndex);
    }

    const type = this._pickType(rng, planetData, moonIndex);

    // Size: depends on moon type and parent planet
    // Gas giant moons can be much larger (Ganymede is bigger than Mercury)
    // Rocky planet moons are small (Earth's Moon is unusually large)
    const moonRadiusData = this._pickRadius(rng, type, planetData);

    const palette = rng.pick(this.PALETTES[type]);

    // ── Realistic orbit distance (in multiples of parent radius) ──
    // Io: 5.9 Jupiter radii, Europa: 9.4, Ganymede: 15, Callisto: 26
    // Earth's Moon: 60 Earth radii
    // Captured moons orbit much further out (irregular orbits)
    const orbitMultipliers = {
      close: [6, 12],   // Io-like
      mid:   [12, 30],  // Europa/Ganymede-like
      far:   [30, 60],  // Moon/Callisto-like
    };
    let orbitZone;
    if (type === 'captured') {
      orbitZone = 'far';  // Captured moons are always distant
    } else if (moonIndex === 0) {
      orbitZone = 'close';
    } else if (moonIndex <= 2) {
      orbitZone = 'mid';
    } else {
      orbitZone = 'far';
    }
    const [minMult, maxMult] = orbitMultipliers[orbitZone];
    // Spread each moon further out based on index within its zone
    const zoneSpread = moonIndex * rng.range(3, 8);
    const orbitMultiple = rng.range(minMult, maxMult) + zoneSpread;

    // Physical orbit in Earth radii, then convert to scene units
    const orbitRadiusEarth = planetData.radiusEarth * orbitMultiple;
    const orbitRadiusScene = earthRadiiToScene(orbitRadiusEarth);

    // Map orbit: use old exaggerated formula for backward compat
    // (2-6x parent map radius, same spacing pattern as before)
    const mapBaseOrbit = planetData.radius * (2.0 + moonIndex * 1.8);
    const orbitRadius = mapBaseOrbit + rng.range(-0.3, 0.5) * planetData.radius;

    // Orbital speed: inner moons faster
    const orbitSpeed = rng.range(0.4, 0.83) / (1.0 + moonIndex * 0.6);

    // Orbital inclination: regular moons ~0, captured moons can be tilted
    const inclination = type === 'captured'
      ? rng.range(-0.5, 0.5)
      : rng.range(-0.1, 0.1);

    // Retrograde orbit: captured moons sometimes orbit backwards
    const retrograde = type === 'captured' && rng.chance(0.4);

    const startAngle = rng.range(0, Math.PI * 2);

    return {
      type,
      // Physical units
      radiusEarth: moonRadiusData.radiusEarth,
      radiusScene: moonRadiusData.radiusScene,
      orbitRadiusEarth,
      orbitRadiusScene,
      // Map/backward-compat units
      radius: moonRadiusData.radius,
      orbitRadius,
      baseColor: palette.base,
      accentColor: palette.accent,
      orbitSpeed: retrograde ? -orbitSpeed : orbitSpeed,
      inclination,
      startAngle,
      // noiseScale must produce visible features: noise needs input range ≥2.0 units.
      // Effective range = radius(map) × noiseScale, so scale inversely with radius.
      // Ensures even tiny moons get enough noise variation for craters/textures.
      noiseScale: Math.max(rng.range(3.0, 6.0), 2.5 / moonRadiusData.radius),
      // Terrestrial moons have atmosphere + clouds (they support life!)
      clouds: type === 'terrestrial' ? {
        color: [0.92, 0.92, 0.95],
        density: rng.range(0.3, 0.55),
        scale: rng.range(2.5, 4.5),
      } : null,
      // Terrestrial moons have thin atmosphere rim glow
      atmosphere: type === 'terrestrial' ? {
        color: [0.4, 0.6, 1.0],
        strength: rng.range(0.25, 0.5),
      } : null,
    };
  }

  /**
   * Returns { radiusEarth, radiusScene, radius (map) } for the moon.
   * Fraction of parent, applied to both physical and map radii.
   */
  static _pickRadius(rng, type, planetData) {
    const pType = planetData.type;
    const isGasGiant = pType === 'gas-giant' || pType === 'sub-neptune' || pType === 'hot-jupiter';

    let fraction;
    if (type === 'terrestrial') {
      fraction = rng.range(0.08, 0.15);
    } else if (type === 'captured') {
      fraction = rng.range(0.02, 0.04);
    } else if (isGasGiant) {
      if (rng.chance(0.2)) {
        fraction = rng.range(0.10, 0.20);
      } else {
        fraction = rng.range(0.04, 0.10);
      }
    } else if (rng.chance(0.12)) {
      fraction = rng.range(0.15, 0.25);
    } else {
      fraction = rng.range(0.03, 0.08);
    }

    const radiusEarth = fraction * planetData.radiusEarth;
    return {
      radiusEarth,
      radiusScene: earthRadiiToScene(radiusEarth),
      radius: fraction * planetData.radius,  // map units (backward compat)
    };
  }

  /**
   * Generate a planet-class moon — uses PlanetGenerator for visuals
   * but MoonGenerator for orbital parameters.
   * Think Titan, Ganymede, or a captured mini-Neptune.
   */
  static _generatePlanetMoon(rng, planetData, moonIndex) {
    // Pick a planet type appropriate for a moon
    const planetType = rng.pick(this.PLANET_MOON_TYPES);

    // Generate full planet data (orbit distance doesn't matter — we override it)
    const pData = PlanetGenerator.generate(rng, 1.0, planetData.sunDirection, null, planetType);

    // Moon radius: 10-25% of parent (these are big moons — Ganymede is 0.038× Jupiter)
    const fraction = rng.range(0.10, 0.25);
    const radiusEarth = fraction * planetData.radiusEarth;
    const radiusScene = earthRadiiToScene(radiusEarth);
    const radius = fraction * planetData.radius;

    // Orbit: mid or far zone (planet-moons don't orbit super close)
    const orbitZone = moonIndex <= 2 ? 'mid' : 'far';
    const orbitRanges = { mid: [12, 30], far: [30, 60] };
    const [minMult, maxMult] = orbitRanges[orbitZone];
    const zoneSpread = moonIndex * rng.range(3, 8);
    const orbitMultiple = rng.range(minMult, maxMult) + zoneSpread;

    const orbitRadiusEarth = planetData.radiusEarth * orbitMultiple;
    const orbitRadiusScene = earthRadiiToScene(orbitRadiusEarth);
    const mapBaseOrbit = planetData.radius * (2.0 + moonIndex * 1.8);
    const orbitRadius = mapBaseOrbit + rng.range(-0.3, 0.5) * planetData.radius;

    const orbitSpeed = rng.range(0.3, 0.6) / (1.0 + moonIndex * 0.6);
    const inclination = rng.range(-0.15, 0.15);
    const startAngle = rng.range(0, Math.PI * 2);

    // Override planet data with moon-appropriate radius
    const scaledPlanetData = {
      ...pData,
      radiusEarth,
      radiusScene,
      radius,
      // No moons of moons
      moonCount: 0,
    };

    return {
      type: planetType,
      isPlanetMoon: true,
      planetData: scaledPlanetData,
      radiusEarth,
      radiusScene,
      orbitRadiusEarth,
      orbitRadiusScene,
      radius,
      orbitRadius,
      // Dummy colors for billboard fallback (use planet palette)
      baseColor: pData.baseColor,
      accentColor: pData.accentColor,
      orbitSpeed,
      inclination,
      startAngle,
      noiseScale: pData.noiseScale,
      clouds: pData.clouds,
      atmosphere: pData.atmosphere,
    };
  }

  /**
   * Pick moon type based on parent planet and orbit position.
   */
  static _pickType(rng, planetData, moonIndex) {
    const pType = planetData.type;
    const roll = rng.float();

    if (pType === 'gas-giant' || pType === 'sub-neptune') {
      // Gas giants: innermost can be volcanic, rare terrestrial, then ice/rocky, outer = captured
      if (moonIndex === 0 && rng.chance(0.3)) return 'volcanic';
      if (rng.chance(0.06)) return 'terrestrial'; // Rare habitable moon
      if (roll < 0.35) return 'ice';
      if (roll < 0.65) return 'rocky';
      if (roll < 0.85) return 'captured';
      return 'ice';
    } else if (pType === 'ice') {
      if (roll < 0.5) return 'ice';
      if (roll < 0.8) return 'captured';
      return 'rocky';
    } else {
      // Rocky, terrestrial, etc: mostly rocky or captured
      if (roll < 0.5) return 'rocky';
      if (roll < 0.85) return 'captured';
      return 'ice';
    }
  }
}
