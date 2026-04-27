import { SeededRandom } from './SeededRandom.js';
import { PlanetGenerator } from './PlanetGenerator.js';
import { MoonGenerator } from './MoonGenerator.js';
import { AsteroidBeltGenerator } from './AsteroidBeltGenerator.js';
import { ExoticOverlay } from './ExoticOverlay.js';
import { realisticOrbitSpeed as orb } from '../core/CelestialTime.js';
import {
  SOLAR_RADIUS_AU, EARTH_RADIUS_AU, AU_TO_SCENE,
  solarRadiiToScene, earthRadiiToScene, auToScene,
} from '../core/ScaleConstants.js';
import {
  deriveFormation, computeMigration, detectResonances, snapToResonances,
  stellarEvolution, mainSequenceLifetime, binaryStabilityLimit, circumbinaryHZ,
  shouldBeltExist, shouldOuterBeltExist, kirkwoodGaps,
  beltCompositionZones, lagrangePoints,
} from './PhysicsEngine.js';

/**
 * StarSystemGenerator — produces data for an entire star system:
 * a central star (or binary pair), orbital slots, planets with moons,
 * and asteroid belts.
 *
 * Star spectral classes (O/B/A/F/G/K/M) are weighted for visual
 * variety rather than astronomical accuracy.
 *
 * Planet type distribution uses physical zones:
 * - Scorching zone: lava, rocky, hot-jupiters
 * - Inner zone: rocky, venus, terrestrial
 * - Habitable zone: terrestrial, ocean, eyeball, sub-neptune
 * - Transition zone: sub-neptune, ice, gas-giant
 * - Outer zone (beyond frost line): gas-giant, ice, sub-neptune
 *
 * Orbital spacing follows a geometric progression inspired by
 * Titius-Bode law — each orbit is ~1.6-2.2x farther than the last.
 *
 * Binary systems (~35%) have two stars orbiting their barycenter,
 * with planets in P-type (circumbinary) orbits.
 */
export class StarSystemGenerator {
  // Cinematic weighting — heavily boosts rare but visually interesting star types.
  // In reality M-dwarfs are 75%+ of all stars, but that's visually boring for a
  // screensaver — most systems would look the same (dim red/orange + small planets).
  // This distribution gives roughly equal chances of "cool" vs "warm" vs "hot" stars.
  static STAR_WEIGHTS = [
    { type: 'M', weight: 0.18 },  // Red dwarfs: still most common, but toned down
    { type: 'K', weight: 0.20 },  // Orange: common, warm-toned systems
    { type: 'G', weight: 0.20 },  // Yellow (Sun-like): familiar, good variety
    { type: 'F', weight: 0.16 },  // White-yellow: bright, lots of planets
    { type: 'A', weight: 0.13 },  // Blue-white: dramatic, bright
    { type: 'B', weight: 0.08 },  // Blue: spectacular, massive
    { type: 'O', weight: 0.05 },  // Blue giants: rare and stunning
  ];

  // Visual properties per spectral class
  // luminosity is relative to Sol (G-type = 1.0)
  // radiusSolar: realistic radius in solar radii (for physical calculations)
  // mapRadius: exaggerated radius for the system map HUD (old visual values)
  //   All mapRadius values > 3.5 so stars are visually larger than gas giants on the map.
  static STAR_PROPERTIES = {
    O: { color: [0.61, 0.69, 1.0],  radiusSolar: 12.0, mapRadius: 8.0, temp: 40000, luminosity: 300000, planetRange: [2, 5] },
    B: { color: [0.67, 0.75, 1.0],  radiusSolar: 5.0,  mapRadius: 6.5, temp: 20000, luminosity: 800,    planetRange: [2, 6] },
    A: { color: [0.79, 0.84, 1.0],  radiusSolar: 1.8,  mapRadius: 5.5, temp: 8750,  luminosity: 20,     planetRange: [3, 6] },
    F: { color: [0.97, 0.97, 1.0],  radiusSolar: 1.3,  mapRadius: 5.0, temp: 6750,  luminosity: 2.5,    planetRange: [4, 8] },
    G: { color: [1.0, 0.96, 0.92],  radiusSolar: 1.0,  mapRadius: 4.5, temp: 5600,  luminosity: 1.0,    planetRange: [4, 8] },
    K: { color: [1.0, 0.82, 0.63],  radiusSolar: 0.7,  mapRadius: 4.2, temp: 4450,  luminosity: 0.3,    planetRange: [3, 7] },
    M: { color: [1.0, 0.80, 0.44],  radiusSolar: 0.3,  mapRadius: 4.0, temp: 3050,  luminosity: 0.04,   planetRange: [3, 6] },
  };

  // Spectral class sequence (hot → cool) for deriving companion types
  static SPECTRAL_SEQUENCE = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

  /**
   * Generate a complete star system from a seed string. Synchronous — runs the
   * internal generator to completion in one call. Caller-safe for sync paths
   * (tests, startup, any non-warp spawn). For the warp's FOLD-phase
   * pre-generation, use generateAsync() to avoid main-thread stalls.
   * @param {string} seed
   * @returns {object} system data
   */
  static generate(seed, galaxyContext = null) {
    const iter = this._generateIterator(seed, galaxyContext);
    let r = iter.next();
    while (!r.done) r = iter.next();
    return r.value;
  }

  /**
   * Async variant — yields to the browser between heavy chunks (each planet,
   * each moon, migration, asteroid belts, trojan clusters, exotic overlay).
   * Use this when generation happens during animated phases (warp FOLD) where
   * a single long synchronous call would stall the render thread.
   *
   * Returns the same systemData as generate(), just spread across several
   * event-loop turns. Test: `await StarSystemGenerator.generateAsync(seed, ctx)`.
   */
  static async generateAsync(seed, galaxyContext = null) {
    const iter = this._generateIterator(seed, galaxyContext);
    let r = iter.next();
    while (!r.done) {
      await new Promise(resolve => setTimeout(resolve, 0));
      r = iter.next();
    }
    return r.value;
  }

  /**
   * Internal generator. All the system-generation logic lives here so the
   * sync and async wrappers share one source of truth. `yield` points are
   * chosen at the boundaries of heavy work (per-planet, per-moon, per-belt).
   */
  static *_generateIterator(seed, galaxyContext = null) {
    const rng = new SeededRandom(seed);

    // ── Primary Star ──
    // If the hash grid already determined this star's type, use it directly.
    // Otherwise use galaxy-context weights or fall back to cinematic weights.
    let starType;
    if (galaxyContext?.starTypeOverride) {
      // Hash grid already determined this star's type — respect it
      starType = galaxyContext.starTypeOverride;
    } else if (galaxyContext) {
      starType = this._pickStarTypeFromWeights(rng, galaxyContext.starWeights);
    } else {
      starType = this._pickStarType(rng);
    }

    // Map evolved hash grid types to their base types for system generation.
    // The hash grid uses Kg/Gg/Mg for evolved giants (same spectral color,
    // much brighter). StarSystemGenerator only knows O/B/A/F/G/K/M.
    // Track whether this was an evolved type — it affects age derivation.
    // Map non-standard types to their closest STAR_PROPERTIES equivalent.
    // Evolved giants → base type. Unusual types (Wolf-Rayet, Carbon, S-type) → nearest match.
    const EVOLVED_TYPE_MAP = { 'Kg': 'K', 'Gg': 'G', 'Mg': 'M' };
    const UNUSUAL_TYPE_MAP = { 'W': 'O', 'C': 'M', 'S': 'K' }; // W→O (hot massive), C→M (cool giant), S→K (cool giant)
    const wasEvolvedType = EVOLVED_TYPE_MAP[starType] !== undefined;
    if (wasEvolvedType) {
      starType = EVOLVED_TYPE_MAP[starType];
    } else if (UNUSUAL_TYPE_MAP[starType]) {
      starType = UNUSUAL_TYPE_MAP[starType];
    }
    // Final safety: if type is still unknown, fall back to G (solar-like)
    if (!this.STAR_PROPERTIES[starType]) {
      console.warn(`[SSG] Unknown star type "${starType}", falling back to G`);
      starType = 'G';
    }
    const props = this.STAR_PROPERTIES[starType];
    const starVariation = rng.range(0.85, 1.15);
    const radiusSolarVaried = props.radiusSolar * starVariation;
    const star = {
      type: starType,
      color: [...props.color],
      // Physical unit — radius in solar radii
      radiusSolar: radiusSolarVaried,
      // Scene unit — for realistic 3D rendering (1 AU = 1000 scene units)
      radiusScene: solarRadiiToScene(radiusSolarVaried),
      // Map unit — exaggerated for system map HUD (old visual values)
      // Uses same variation factor so map and scene star sizes correlate.
      radius: props.mapRadius * starVariation,
      temp: props.temp,
      luminosity: props.luminosity,
    };

    // ── Binary? (~35% of systems) ──
    // Galaxy context adjusts binary rate by component (bulge: 0.65x, halo: 0.8x)
    const binaryBaseChance = 0.35 * (galaxyContext ? galaxyContext.binaryModifier : 1.0);
    const isBinary = rng.chance(binaryBaseChance);
    let star2 = null;
    let binarySeparation = 0;
    let binarySeparationAU = 0;
    let binarySeparationScene = 0;
    let binaryMassRatio = 0;
    let binaryOrbitSpeed = 0;
    let binaryOrbitAngle = 0;

    if (isBinary) {
      // Mass ratio distribution: q = M2/M1 (0 < q <= 1)
      // 25% twins, 40% similar, 25% unequal, 10% extreme
      const qRoll = rng.float();
      if (qRoll < 0.25)       binaryMassRatio = rng.range(0.85, 1.0);
      else if (qRoll < 0.65)  binaryMassRatio = rng.range(0.5, 0.85);
      else if (qRoll < 0.90)  binaryMassRatio = rng.range(0.2, 0.5);
      else                     binaryMassRatio = rng.range(0.1, 0.2);

      // Derive secondary star type from mass ratio
      const secondaryType = this._deriveCompanionType(starType, binaryMassRatio, rng);
      const secondaryProps = this.STAR_PROPERTIES[secondaryType];
      const s2Variation = rng.range(0.85, 1.15);
      const s2RadiusSolar = secondaryProps.radiusSolar * s2Variation;

      star2 = {
        type: secondaryType,
        color: [...secondaryProps.color],
        radiusSolar: s2RadiusSolar,
        radiusScene: solarRadiiToScene(s2RadiusSolar),
        radius: secondaryProps.mapRadius * s2Variation,
        temp: secondaryProps.temp,
        luminosity: secondaryProps.luminosity,
      };

      // Binary separation in AU: close binaries are 0.1-0.5 AU apart
      // (enough to not overlap visually, with some variety)
      const starSumAU = (star.radiusSolar + star2.radiusSolar) * SOLAR_RADIUS_AU;
      binarySeparationAU = rng.range(0.05, 0.3) + starSumAU * 3;
      binarySeparationScene = auToScene(binarySeparationAU);
      // Map separation: use old visual formula for backward compat
      binarySeparation = rng.range(3, 8) + star.radius + star2.radius;
      // Orbit speed: closer = faster (Kepler's 3rd law)
      binaryOrbitSpeed = 0.003 / Math.pow(binarySeparation / 5, 1.5);
      binaryOrbitAngle = rng.range(0, Math.PI * 2);
    }

    // ── System-level parameters ──
    // If galaxy context is provided, derive from galactic position.
    // Otherwise fall back to random (screensaver mode).
    const metallicity = galaxyContext
      ? galaxyContext.metallicity + rng.gaussian(0, 0.05)  // position-derived + small scatter
      : rng.gaussianClamped(0.0, 0.2, -1.0, 0.5);         // random fallback

    // Age derivation: the hash grid type implicitly constrains the age.
    // A living star (O/B/A/F/G/K/M) must be younger than its MS lifetime.
    // An evolved star (Kg/Gg/Mg) must be older than its base type's MS lifetime.
    // This ensures the stellar evolution function produces consistent results.
    const msLifetime = mainSequenceLifetime(starType, radiusSolarVaried);
    let ageGyr;
    if (!galaxyContext) {
      ageGyr = rng.gaussianClamped(4.5, 2.5, 0.1, 12.0); // random fallback (screensaver)
    } else if (wasEvolvedType) {
      // Evolved: age must exceed MS lifetime. Use region age but floor to MS lifetime.
      const regionAge = Math.max(0.01, galaxyContext.age + rng.gaussian(0, 0.3));
      ageGyr = Math.max(msLifetime * 1.1, regionAge);
    } else {
      // Living star: age must be within MS lifetime.
      // Use region age but cap to MS lifetime so stellar evolution says "main sequence."
      const regionAge = Math.max(0.01, galaxyContext.age + rng.gaussian(0, 0.3));
      ageGyr = Math.min(regionAge, msLifetime * 0.95);
    }

    // Star mass estimate (rough main-sequence M-R relation)
    const starMassSolar = Math.pow(radiusSolarVaried, 1.25);

    // System archetype — derived from formation physics (PhysicsEngine §6).
    // Protoplanetary disk mass (metallicity-driven) and dissipation timescale
    // determine whether the system is compact-rocky, mixed, or spread-giant.
    // This replaces the old random coin-flip.
    const formation = deriveFormation(starMassSolar, metallicity, rng.float(), rng.float());
    const archetypeLookup = {
      'compact-rocky': { name: 'compact-rocky', spacingMuOffset: -0.10, sizeBias: 'small', countModifier: 1 },
      'mixed':         { name: 'mixed', spacingMuOffset: 0.0, sizeBias: 'neutral', countModifier: 0 },
      'spread-giant':  { name: 'spread-giant', spacingMuOffset: 0.10, sizeBias: 'large', countModifier: -1 },
    };
    const archetype = archetypeLookup[formation.archetype];

    // ── Physical zones (frost line, habitable zone) ──
    // Scale with the square root of stellar luminosity
    const luminosity = props.luminosity;
    // Frost line: 4.85√L AU (Hayashi line — where water ice can condense)
    const frostLineAU = 4.85 * Math.sqrt(luminosity);
    const hzInnerAU = 0.95 * Math.sqrt(luminosity);
    const hzOuterAU = 1.37 * Math.sqrt(luminosity);

    // ── Orbital spacing (in AU) ──
    // Innermost orbit: scales with luminosity so hot stars have planets
    // further out (they'd be vaporized closer in).
    const innerOrbitAU = rng.range(0.3, 0.5) * Math.sqrt(Math.max(luminosity, 0.01));
    // Binary systems: innermost planet must be outside binary orbits
    const minInnerOrbitAU = isBinary ? binarySeparationAU * 2.5 : 0;
    const adjustedInnerAU = Math.max(innerOrbitAU, minInnerOrbitAU);

    // Log-normal spacing parameters (Steffen & Hwang 2015, Weiss et al. 2018).
    // Period ratios follow log-normal with mu≈0.55, sigma≈0.25, median≈1.73.
    // Archetype shifts the mu: compact systems are tighter, spread systems wider.
    const spacingMu = 0.55 + archetype.spacingMuOffset;
    const spacingSigma = 0.25;
    const minSpacingRatio = 1.2;  // Hard minimum from Kepler data
    // Max orbit: don't place planets absurdly far out
    const maxOrbitAU = 50 * Math.sqrt(Math.max(luminosity, 0.01));

    // Zones object — the shared context passed to PlanetGenerator and MoonGenerator.
    // This is the primary data contract between system and body generation.
    // All physics calculations in PlanetGenerator depend on these fields.
    //
    // Required by PlanetGenerator._pickType():  frostLine, hzInner, hzOuter, starType, metallicity, sizeBias
    // Required by PhysicsEngine (via PlanetGenerator): luminosity, ageGyr, starMassSolar
    // Passed through to MoonGenerator._generatePlanetMoon() for planet-class moons
    const zones = {
      frostLine: frostLineAU,
      hzInner: hzInnerAU,
      hzOuter: hzOuterAU,
      starType,
      metallicity,
      sizeBias: archetype.sizeBias,
      luminosity,
      ageGyr,
      starMassSolar,
    };

    // ── Map-scale orbital spacing (exaggerated, for backward compat) ──
    // These keep the old visual layout for the current map/rendering.
    const mapBaseDistance = rng.range(8, 15) + star.radius * 2;
    const minMapInnerOrbit = isBinary ? binarySeparation * 2.5 : 0;
    const adjustedMapBase = Math.max(mapBaseDistance, minMapInnerOrbit);
    // How many map-units per AU (maps the innermost AU orbit to the map base distance)
    const mapUnitsPerAU = adjustedMapBase / adjustedInnerAU;

    // ── Star info for dual-lighting ──
    // Brightness uses compressed mass-luminosity relation: L ~ M^1.5
    // (real is M^3.5 but that makes secondary too dim for visual effect)
    const brightness2 = star2
      ? Math.max(Math.pow(binaryMassRatio, 1.5), 0.05)
      : 0.0;

    const starInfo = {
      color1: star.color,
      brightness1: 1.0,
      color2: star2 ? star2.color : [0, 0, 0],
      brightness2,
    };

    // ── Planet count ──
    // ~8% chance of an empty system (no planets — just a lonely star or binary).
    // Otherwise, gaussian distribution centered on mid-range, shifted by archetype.
    // Compact-rocky systems get +1, spread-giant get -1.
    const [minPlanets, maxPlanets] = props.planetRange;
    const baseMean = (minPlanets + maxPlanets) / 2 + archetype.countModifier;
    const planetCount = rng.chance(0.08)
      ? 0
      : Math.round(rng.gaussianClamped(baseMean, 1.5, 1, maxPlanets));

    // ── Generate planets ──
    // Orbital spacing uses log-normal draws with peas-in-a-pod correlation.
    // Adjacent spacings are 60% correlated (Weiss et al. 2018).
    const planets = [];
    let currentOrbitAU = adjustedInnerAU;
    let prevSpacing = 0;
    for (let i = 0; i < planetCount; i++) {
      yield;  // yield before each planet — PlanetGenerator is the heaviest per-body work
      const planetRng = rng.child(`planet-${i}`);

      // Log-normal spacing with peas-in-a-pod correlation
      if (i > 0) {
        const freshSpacing = Math.max(rng.logNormal(spacingMu, spacingSigma), minSpacingRatio);
        const spacing = (i === 1)
          ? freshSpacing
          : 0.6 * prevSpacing + 0.4 * freshSpacing;
        prevSpacing = spacing;
        currentOrbitAU *= spacing;
      }

      // Stop if orbit exceeds reasonable limit for this star
      if (currentOrbitAU > maxOrbitAU) break;

      const orbitRadiusAU = currentOrbitAU;
      // Scene units (realistic) and map units (exaggerated)
      const orbitRadiusScene = auToScene(orbitRadiusAU);
      const orbitRadius = orbitRadiusAU * mapUnitsPerAU;  // map units (backward compat)

      const orbitAngle = planetRng.range(0, Math.PI * 2);
      // Kepler's 3rd law: period ∝ distance^1.5
      const orbitSpeed = orb((0.00125 / Math.pow(orbitRadius / adjustedMapBase, 1.5)) * planetRng.range(0.8, 1.2));

      // Planet position in world space (initial) — using map coords for now
      const px = Math.cos(orbitAngle) * orbitRadius;
      const pz = Math.sin(orbitAngle) * orbitRadius;
      const dist = Math.sqrt(px * px + pz * pz);
      const sunDirection = [-px / dist, 0, -pz / dist];

      // Generate planet using zone-based type selection (zones are in AU now)
      const planetData = PlanetGenerator.generate(planetRng, orbitRadiusAU, sunDirection, zones);

      // Determine parent planet's orbital zone for moon type logic
      const parentZone =
        orbitRadiusAU < hzInnerAU * 0.4 ? 'scorching' :
        orbitRadiusAU < hzInnerAU       ? 'inner' :
        orbitRadiusAU < hzOuterAU       ? 'hz' :
        orbitRadiusAU < frostLineAU     ? 'transition' :
                                          'outer';

      // Generate moons
      const moons = [];
      for (let m = 0; m < planetData.moonCount; m++) {
        if (m > 0) yield;  // yield between moons — first moon rides the planet's chunk
        const moonRng = planetRng.child(`moon-${m}`);
        const moonData = MoonGenerator.generate(moonRng, planetData, m, planetData.moonCount, parentZone, zones);
        moons.push(moonData);
      }

      planets.push({
        planetData,
        moons,
        // Physical units
        orbitRadiusAU,
        orbitRadiusScene,
        // Map/backward-compat units
        orbitRadius,
        orbitAngle,
        orbitSpeed,
      });
    }

    yield;  // post-planet-loop yield — migration + resonance walk the full planets array
    // ── Planetary Migration (PhysicsEngine §5) ──
    // Gas giants beyond the frost line may migrate inward, scattering inner planets.
    const migrationResult = computeMigration(planets, formation.diskMass, frostLineAU, rng.float());
    let migrationHistory = { occurred: false };
    if (migrationResult) {
      migrationHistory = migrationResult;
      const migrant = planets[migrationResult.migrantIndex];

      // Remove scattered planets (iterate backwards to preserve indices)
      const toRemove = new Set();
      for (const idx of migrationResult.scatteredIndices) {
        if (rng.chance(0.7)) {
          toRemove.add(idx); // 70% destroyed
        }
        // 30% survive but get kicked to wider orbits (not implemented yet — just survive)
      }
      // Filter out destroyed planets
      const surviving = planets.filter((_, i) => !toRemove.has(i));
      // Update migrant's orbit
      const migrantInSurviving = surviving.find(p => p === migrant);
      if (migrantInSurviving) {
        migrantInSurviving.orbitRadiusAU = migrationResult.finalOrbitAU;
        migrantInSurviving.orbitRadiusScene = auToScene(migrationResult.finalOrbitAU);
        migrantInSurviving.orbitRadius = migrationResult.finalOrbitAU * mapUnitsPerAU;
        // Change type to hot-jupiter
        migrantInSurviving.planetData.type = 'hot-jupiter';
        migrantInSurviving.planetData.rotationSpeed = 0; // tidally locked
      }
      // Sort by orbit after migration
      planets.length = 0;
      surviving.sort((a, b) => a.orbitRadiusAU - b.orbitRadiusAU).forEach(p => planets.push(p));
      migrationHistory.scatteredCount = toRemove.size;
    }

    // ── Orbital Resonance Detection (PhysicsEngine §4) ──
    // Compact systems may show resonance chains (like TRAPPIST-1)
    const resonanceData = detectResonances(planets);
    if (resonanceData.isResonant) {
      snapToResonances(planets, resonanceData.resonances);
      // Update scene/map units after snapping
      for (const p of planets) {
        p.orbitRadiusScene = auToScene(p.orbitRadiusAU);
        p.orbitRadius = p.orbitRadiusAU * mapUnitsPerAU;
      }
    }

    // ── Stellar Evolution (PhysicsEngine §8) ──
    const evolution = stellarEvolution(starType, radiusSolarVaried, ageGyr);

    // ── Binary Stability (PhysicsEngine §9) ──
    let binaryStability = null;
    if (isBinary) {
      const stabilityLimitAU = binaryStabilityLimit(binarySeparationAU, binaryMassRatio);
      // Remove planets inside stability limit
      const stablePlanets = planets.filter(p => p.orbitRadiusAU > stabilityLimitAU);
      planets.length = 0;
      stablePlanets.forEach(p => planets.push(p));
      // Compute circumbinary HZ
      const cbHZ = circumbinaryHZ(star.luminosity, star2 ? star2.luminosity : 0);
      binaryStability = { stabilityLimitAU, cbHZ };
    }

    yield;  // pre-belt yield — belts can contain hundreds of asteroid entries
    // ── Asteroid Belts — Physics-driven (PhysicsEngine §12) ──
    // Belts only form where gas giant resonances prevented planet accretion.
    // No giant = no belt. Migration destroys belts.
    const asteroidBelts = [];
    const trojanClusters = [];
    const beltPhysics = shouldBeltExist(planets, formation.diskMass, migrationHistory.occurred, frostLineAU);
    if (beltPhysics) {
      // Generate visual asteroids using existing AsteroidBeltGenerator
      const beltRng = rng.child('main-belt');
      // Find map-unit equivalents for the belt boundaries
      const beltInnerMap = beltPhysics.innerAU * mapUnitsPerAU;
      const beltOuterMap = beltPhysics.outerAU * mapUnitsPerAU;
      const beltData = AsteroidBeltGenerator.generate(
        beltRng, beltInnerMap, beltOuterMap,
        beltPhysics.innerAU, beltPhysics.outerAU
      );
      // Attach physics data to the belt
      beltData.physics = beltPhysics;
      asteroidBelts.push(beltData);
    }

    yield;  // pre-kuiper yield — same reason as main belt
    // ── Kuiper Belt (PhysicsEngine §12) ──
    const kuiperPhysics = shouldOuterBeltExist(planets, formation.diskMass);
    if (kuiperPhysics) {
      const kuiperRng = rng.child('kuiper-belt');
      const kuiperInnerMap = kuiperPhysics.innerAU * mapUnitsPerAU;
      const kuiperOuterMap = kuiperPhysics.outerAU * mapUnitsPerAU;
      const kuiperData = AsteroidBeltGenerator.generate(
        kuiperRng, kuiperInnerMap, kuiperOuterMap,
        kuiperPhysics.innerAU, kuiperPhysics.outerAU
      );
      kuiperData.physics = kuiperPhysics;
      kuiperData.isKuiper = true;
      asteroidBelts.push(kuiperData);
    }

    yield;  // pre-trojan yield — one iteration per gas giant, each spawns 50-200 trojans
    // ── Trojan Asteroids (PhysicsEngine §12) ──
    // L4/L5 clusters for each gas giant
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      if (p.planetData.type === 'gas-giant' && rng.chance(0.6)) {
        const lp = lagrangePoints(p.orbitRadiusAU, p.orbitAngle);
        const trojanRng = rng.child(`trojan-${i}`);
        const count = trojanRng.int(50, 200);
        // 60% chance each of L4 and L5
        if (trojanRng.chance(0.6)) {
          trojanClusters.push({
            giantIndex: i,
            point: 'L4',
            radiusAU: lp.L4.radiusAU,
            angle: lp.L4.angle,
            count,
            spreadAngle: trojanRng.range(0.3, 0.7), // radians
          });
        }
        if (trojanRng.chance(0.6)) {
          trojanClusters.push({
            giantIndex: i,
            point: 'L5',
            radiusAU: lp.L5.radiusAU,
            angle: lp.L5.angle,
            count: trojanRng.int(40, 180),
            spreadAngle: trojanRng.range(0.3, 0.7),
          });
        }
      }
    }

    // ── Zone data (first-class, for UI/overlays/future mechanics) ──
    // Boundaries in AU and scene units. See docs/GAME_BIBLE.md §4.
    const zoneData = {
      scorchingOuterAU: hzInnerAU * 0.4,
      hzInnerAU,
      hzOuterAU,
      frostLineAU,
      // Scene units for rendering zone rings, overlays, etc.
      scorchingOuterScene: auToScene(hzInnerAU * 0.4),
      hzInnerScene: auToScene(hzInnerAU),
      hzOuterScene: auToScene(hzOuterAU),
      frostLineScene: auToScene(frostLineAU),
      // Map units for HUD overlays
      scorchingOuterMap: hzInnerAU * 0.4 * mapUnitsPerAU,
      hzInnerMap: hzInnerAU * mapUnitsPerAU,
      hzOuterMap: hzOuterAU * mapUnitsPerAU,
      frostLineMap: frostLineAU * mapUnitsPerAU,
    };

    const systemData = {
      star,
      star2,
      isBinary,
      // Physical units
      binarySeparationAU,
      binarySeparationScene,
      // Map/backward-compat units
      binarySeparation,
      binaryMassRatio,
      binaryOrbitSpeed,
      binaryOrbitAngle,
      planets,
      asteroidBelts,
      trojanClusters,
      starInfo,
      seed,
      // Zone boundaries (AU, scene, map units)
      zones: zoneData,
      // System-level parameters (for overlays, UI, future galaxy integration)
      metallicity,
      ageGyr,
      archetype: archetype.name,
      // Galaxy context (null in screensaver mode)
      galaxyContext: galaxyContext || null,
      galacticPosition: galaxyContext ? galaxyContext.position : null,
      // Conversion factors (useful for consumers)
      mapUnitsPerAU,
      // Physics-driven generation data (PhysicsEngine)
      formation,
      migrationHistory,
      resonanceChain: resonanceData.isResonant ? resonanceData : null,
      stellarEvolution: evolution,
      binaryStability,
    };

    yield;  // pre-overlay yield — ExoticOverlay walks the planets array again
    // ── Exotic/civilized overlay ──
    // Post-processing pass: rare alien anomalies, civilized worlds,
    // geological formations. Modifies planets array in-place.
    // See docs/GAME_BIBLE.md §6 and ExoticOverlay.js.
    ExoticOverlay.apply(systemData);

    return systemData;
  }

  static _pickStarType(rng) {
    const roll = rng.float();
    let cumulative = 0;
    for (const { type, weight } of this.STAR_WEIGHTS) {
      cumulative += weight;
      if (roll < cumulative) return type;
    }
    return 'M'; // fallback
  }

  /**
   * Pick star type using galaxy-context-adjusted weights.
   * The weights array comes from GalacticMap.deriveGalaxyContext().
   * Format: [{ type: 'M', weight: 0.45 }, { type: 'K', weight: 0.30 }, ...]
   */
  static _pickStarTypeFromWeights(rng, weights) {
    const roll = rng.float();
    let cumulative = 0;
    for (const { type, weight } of weights) {
      cumulative += weight;
      if (roll < cumulative) return type;
    }
    return 'M'; // fallback
  }

  /**
   * Derive a companion star type from the primary based on mass ratio.
   * Lower mass ratio = cooler (later spectral type) companion.
   */
  static _deriveCompanionType(primaryType, massRatio, rng) {
    const seq = this.SPECTRAL_SEQUENCE;
    const primaryIndex = seq.indexOf(primaryType);

    // q=1.0 → 0 steps (same type), q=0.1 → up to 4 steps cooler
    const maxSteps = Math.round((1 - massRatio) * 5);
    const steps = rng.int(0, maxSteps);
    const companionIndex = Math.min(primaryIndex + steps, seq.length - 1);

    return seq[companionIndex];
  }

  /**
   * Find the best gap for an asteroid belt.
   * Prefers placing it just inside a gas giant's orbit (like our solar system).
   */
  static _pickBeltLocation(rng, planets) {
    const gasTypes = ['gas-giant', 'sub-neptune'];

    // First priority: gap just before a gas giant
    for (let i = 1; i < planets.length; i++) {
      if (gasTypes.includes(planets[i].planetData.type)) {
        return i - 1;
      }
    }

    // Fallback: random gap in the middle
    if (planets.length >= 3) {
      return rng.int(1, planets.length - 2);
    }

    return -1; // no suitable location
  }
}
