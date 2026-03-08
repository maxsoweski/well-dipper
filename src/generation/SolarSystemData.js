import { solarRadiiToScene, earthRadiiToScene, auToScene } from '../core/ScaleConstants.js';

/**
 * SolarSystemData — hardcoded data for our real Solar System.
 *
 * Secret mode (Shift+0) spawns this instead of a procedural system.
 * Uses the same data structures as StarSystemGenerator so spawnSystem()
 * can consume it directly.
 *
 * Distances and sizes are real values; map units are scaled for the HUD.
 */

// ── Map scale: exaggerated units for the minimap HUD ──
// Inner orbit (Mercury 0.387 AU) maps to this base distance
const MAP_BASE = 12;
const MAP_UNITS_PER_AU = MAP_BASE / 0.387;

function mapOrbit(au) { return au * MAP_UNITS_PER_AU; }

// Map planet radius: exaggerated so planets are visible on HUD
function mapPlanetRadius(type, radiusEarth) {
  const ranges = {
    rocky:        [0.2, 0.5],
    terrestrial:  [0.4, 0.8],
    'gas-giant':  [1.8, 3.5],
    'sub-neptune': [0.7, 1.3],
    ice:          [0.3, 0.7],
  };
  const range = ranges[type] || [0.3, 0.9];
  // Simple proportional mapping
  const earthRange = {
    rocky: [0.3, 0.8], terrestrial: [0.8, 1.5], 'gas-giant': [6, 14],
    'sub-neptune': [2.5, 4.0], ice: [0.4, 1.2],
  };
  const er = earthRange[type] || [0.5, 1.5];
  const t = Math.max(0, Math.min(1, (radiusEarth - er[0]) / (er[1] - er[0])));
  return range[0] + t * (range[1] - range[0]);
}

// Orbital speed using Kepler's 3rd law, scaled to match the engine
// The base 0.00125 matches StarSystemGenerator's scaled-down value
function keplerSpeed(orbitMapRadius) {
  return 0.00125 / Math.pow(orbitMapRadius / MAP_BASE, 1.5);
}

// Moon orbital speed — scaled to match MoonGenerator's new values
// Inner moons ~0.04 rad/s, outer moons slower
function moonSpeed(index, total) {
  const base = 0.025 + (0.052 - 0.025) * (1 - index / Math.max(1, total - 1));
  return base / (1.0 + index * 0.4);
}

/**
 * Generate Solar System data matching StarSystemGenerator output format.
 */
export function generateSolarSystem() {
  // ── The Sun ──
  const star = {
    type: 'G',
    color: [1.0, 0.96, 0.92],
    radiusSolar: 1.0,
    radiusScene: solarRadiiToScene(1.0),
    radius: 4.5,          // map units
    temp: 5778,
    luminosity: 1.0,
  };

  // ── Planets ──
  const planetsRaw = [
    // Mercury
    {
      type: 'rocky',
      radiusEarth: 0.383,
      orbitAU: 0.387,
      baseColor: [0.55, 0.52, 0.48],
      accentColor: [0.42, 0.40, 0.38],
      moonCount: 0,
      noiseScale: 4.0,
      noiseDetail: 0.6,
      rotationSpeed: 0.04,   // very slow (59 Earth days)
      axialTilt: 0.03,       // ~2°
      rings: null,
      clouds: null,
      atmosphere: null,
      moons: [],
    },
    // Venus
    {
      type: 'venus',
      radiusEarth: 0.95,
      orbitAU: 0.723,
      baseColor: [0.85, 0.75, 0.55],
      accentColor: [0.78, 0.68, 0.50],
      moonCount: 0,
      noiseScale: 2.0,
      noiseDetail: 0.3,
      rotationSpeed: -0.01,  // retrograde, very slow
      axialTilt: 3.1,        // ~177° (nearly upside down → 3.1 rad)
      rings: null,
      clouds: { color: [0.9, 0.82, 0.65], density: 0.7, scale: 2.5 },
      atmosphere: { color: [0.9, 0.8, 0.5], strength: 0.6 },
      moons: [],
    },
    // Earth
    {
      type: 'terrestrial',
      radiusEarth: 1.0,
      orbitAU: 1.0,
      baseColor: [0.15, 0.35, 0.55],
      accentColor: [0.25, 0.55, 0.20],
      moonCount: 1,
      noiseScale: 3.0,
      noiseDetail: 0.5,
      rotationSpeed: 0.1,
      axialTilt: 0.41,       // 23.4°
      rings: null,
      clouds: { color: [0.95, 0.95, 0.97], density: 0.45, scale: 3.0 },
      atmosphere: { color: [0.4, 0.6, 1.0], strength: 0.4 },
      moons: [
        {
          type: 'rocky',
          radiusEarth: 0.273,
          orbitMultiple: 60,    // 60 Earth radii
          baseColor: [0.6, 0.58, 0.55],
          accentColor: [0.45, 0.43, 0.40],
          noiseScale: 4.0,
          inclination: 0.09,    // ~5°
        },
      ],
    },
    // Mars
    {
      type: 'rocky',
      radiusEarth: 0.532,
      orbitAU: 1.524,
      baseColor: [0.72, 0.38, 0.22],
      accentColor: [0.55, 0.30, 0.18],
      moonCount: 2,
      noiseScale: 3.5,
      noiseDetail: 0.55,
      rotationSpeed: 0.1,
      axialTilt: 0.44,       // 25.2°
      rings: null,
      clouds: null,
      atmosphere: { color: [0.8, 0.5, 0.3], strength: 0.15 },
      moons: [
        {
          type: 'captured',
          radiusEarth: 0.0017,   // Phobos ~11km
          orbitMultiple: 2.76,   // very close
          baseColor: [0.35, 0.30, 0.28],
          accentColor: [0.28, 0.25, 0.22],
          noiseScale: 5.0,
          inclination: 0.02,
        },
        {
          type: 'captured',
          radiusEarth: 0.001,    // Deimos ~6km
          orbitMultiple: 6.9,
          baseColor: [0.38, 0.33, 0.30],
          accentColor: [0.30, 0.27, 0.24],
          noiseScale: 5.0,
          inclination: 0.03,
        },
      ],
    },
    // Jupiter
    {
      type: 'gas-giant',
      radiusEarth: 11.21,
      orbitAU: 5.203,
      baseColor: [0.75, 0.62, 0.48],
      accentColor: [0.60, 0.45, 0.32],
      moonCount: 4,
      noiseScale: 2.0,
      noiseDetail: 0.4,
      rotationSpeed: 0.167,   // fastest spinner
      axialTilt: 0.05,        // 3.1°
      rings: null,            // Jupiter's ring is too faint to show
      clouds: null,           // gas giant bands are in the base shader
      atmosphere: null,
      moons: [
        // Io
        {
          type: 'volcanic',
          radiusEarth: 0.286,
          orbitMultiple: 5.9,
          baseColor: [0.85, 0.72, 0.30],
          accentColor: [0.90, 0.55, 0.15],
          noiseScale: 4.5,
          inclination: 0.01,
        },
        // Europa
        {
          type: 'ice',
          radiusEarth: 0.245,
          orbitMultiple: 9.4,
          baseColor: [0.82, 0.80, 0.75],
          accentColor: [0.60, 0.55, 0.50],
          noiseScale: 5.0,
          inclination: 0.01,
        },
        // Ganymede
        {
          type: 'rocky',
          radiusEarth: 0.413,
          orbitMultiple: 15.0,
          baseColor: [0.55, 0.50, 0.45],
          accentColor: [0.42, 0.38, 0.35],
          noiseScale: 3.5,
          inclination: 0.005,
        },
        // Callisto
        {
          type: 'rocky',
          radiusEarth: 0.378,
          orbitMultiple: 26.3,
          baseColor: [0.35, 0.32, 0.30],
          accentColor: [0.28, 0.25, 0.23],
          noiseScale: 4.0,
          inclination: 0.005,
        },
      ],
    },
    // Saturn
    {
      type: 'gas-giant',
      radiusEarth: 9.45,
      orbitAU: 9.537,
      baseColor: [0.82, 0.75, 0.58],
      accentColor: [0.72, 0.65, 0.50],
      moonCount: 3,
      noiseScale: 1.8,
      noiseDetail: 0.35,
      rotationSpeed: 0.155,
      axialTilt: 0.47,        // 26.7°
      rings: {
        innerRadius: 1.24,    // D ring starts at 1.24 Saturn radii
        outerRadius: 2.27,    // F ring extends to ~2.27 Saturn radii
        color1: [0.85, 0.78, 0.65],
        color2: [0.65, 0.58, 0.45],
        opacity: 0.7,
        tiltX: 0,
        tiltZ: 0,
      },
      clouds: null,
      atmosphere: null,
      moons: [
        // Titan
        {
          isPlanetMoon: true,
          type: 'venus',          // thick atmosphere like Venus
          radiusFraction: 0.20,   // roughly Titan vs Saturn
          orbitMultiple: 20.3,
          baseColor: [0.70, 0.55, 0.30],
          accentColor: [0.60, 0.48, 0.25],
          noiseScale: 2.5,
          inclination: 0.005,
          clouds: { color: [0.75, 0.60, 0.35], density: 0.6, scale: 3.0 },
          atmosphere: { color: [0.7, 0.55, 0.3], strength: 0.5 },
        },
        // Enceladus
        {
          type: 'ice',
          radiusEarth: 0.04,
          orbitMultiple: 3.95,
          baseColor: [0.92, 0.90, 0.88],
          accentColor: [0.80, 0.78, 0.75],
          noiseScale: 5.0,
          inclination: 0.01,
        },
        // Mimas
        {
          type: 'ice',
          radiusEarth: 0.031,
          orbitMultiple: 3.08,
          baseColor: [0.78, 0.76, 0.72],
          accentColor: [0.65, 0.62, 0.58],
          noiseScale: 5.0,
          inclination: 0.03,
        },
      ],
    },
    // Uranus
    {
      type: 'sub-neptune',
      radiusEarth: 4.01,
      orbitAU: 19.19,
      baseColor: [0.55, 0.75, 0.80],
      accentColor: [0.60, 0.78, 0.82],
      moonCount: 2,
      noiseScale: 1.5,
      noiseDetail: 0.25,
      rotationSpeed: -0.12,   // retrograde
      axialTilt: 1.71,        // 97.8° — rolls on its side
      rings: {
        innerRadius: 1.6,
        outerRadius: 2.0,
        color1: [0.4, 0.45, 0.5],
        color2: [0.3, 0.35, 0.4],
        opacity: 0.25,        // very faint
        tiltX: 0,
        tiltZ: 0,
      },
      clouds: null,
      atmosphere: { color: [0.5, 0.75, 0.85], strength: 0.45 },
      moons: [
        // Titania
        {
          type: 'ice',
          radiusEarth: 0.124,
          orbitMultiple: 17.1,
          baseColor: [0.60, 0.58, 0.55],
          accentColor: [0.48, 0.46, 0.42],
          noiseScale: 4.0,
          inclination: 0.005,
        },
        // Miranda
        {
          type: 'ice',
          radiusEarth: 0.037,
          orbitMultiple: 5.08,
          baseColor: [0.65, 0.62, 0.58],
          accentColor: [0.50, 0.48, 0.44],
          noiseScale: 5.0,
          inclination: 0.07,
        },
      ],
    },
    // Neptune
    {
      type: 'sub-neptune',
      radiusEarth: 3.88,
      orbitAU: 30.07,
      baseColor: [0.25, 0.40, 0.70],
      accentColor: [0.30, 0.48, 0.75],
      moonCount: 1,
      noiseScale: 1.8,
      noiseDetail: 0.3,
      rotationSpeed: 0.13,
      axialTilt: 0.49,        // 28.3°
      rings: null,
      clouds: { color: [0.6, 0.7, 0.9], density: 0.25, scale: 2.0 },
      atmosphere: { color: [0.3, 0.5, 0.9], strength: 0.5 },
      moons: [
        // Triton (retrograde captured moon)
        {
          type: 'ice',
          radiusEarth: 0.212,
          orbitMultiple: 14.3,
          baseColor: [0.72, 0.68, 0.62],
          accentColor: [0.55, 0.52, 0.48],
          noiseScale: 4.0,
          inclination: -2.7,    // heavily inclined retrograde
          retrograde: true,
        },
      ],
    },
  ];

  // ── Build planet entries ──
  const planets = planetsRaw.map((p, i) => {
    const radiusScene = earthRadiiToScene(p.radiusEarth);
    const mapRadius = mapPlanetRadius(p.type, p.radiusEarth);
    const orbitRadiusScene = auToScene(p.orbitAU);
    const orbitRadius = mapOrbit(p.orbitAU);
    const orbitAngle = (i / planetsRaw.length) * Math.PI * 2 * 0.7 + 0.3;  // spread them out
    const sunDir = [-Math.cos(orbitAngle), 0, -Math.sin(orbitAngle)];

    const mapToSceneRatio = mapRadius / radiusScene;

    const planetData = {
      type: p.type,
      radiusEarth: p.radiusEarth,
      radiusScene,
      radius: mapRadius,
      baseColor: p.baseColor,
      accentColor: p.accentColor,
      rings: p.rings,
      clouds: p.clouds,
      atmosphere: p.atmosphere,
      moonCount: p.moonCount,
      noiseScale: p.noiseScale,
      noiseDetail: p.noiseDetail,
      rotationSpeed: p.rotationSpeed,
      axialTilt: p.axialTilt,
      sunDirection: sunDir,
    };

    // Build moons
    const moons = p.moons.map((m, mi) => {
      if (m.isPlanetMoon) {
        // Planet-class moon (like Titan)
        const moonRadiusEarth = m.radiusFraction * p.radiusEarth;
        const moonRadiusScene = earthRadiiToScene(moonRadiusEarth);
        const moonMapRadius = m.radiusFraction * mapRadius;
        const orbitRadiusEarth = p.radiusEarth * m.orbitMultiple;
        const orbitRadiusScene_ = earthRadiiToScene(orbitRadiusEarth);
        const moonMapOrbit = mapRadius * (2.0 + mi * 1.8);

        return {
          type: m.type,
          isPlanetMoon: true,
          planetData: {
            type: m.type,
            radiusEarth: moonRadiusEarth,
            radiusScene: moonRadiusScene,
            radius: moonMapRadius,
            baseColor: m.baseColor,
            accentColor: m.accentColor,
            rings: null,
            clouds: m.clouds || null,
            atmosphere: m.atmosphere || null,
            moonCount: 0,
            noiseScale: m.noiseScale,
            noiseDetail: 0.4,
            rotationSpeed: 0.05,
            axialTilt: 0.1,
            sunDirection: sunDir,
          },
          radiusEarth: moonRadiusEarth,
          radiusScene: moonRadiusScene,
          radius: moonMapRadius,
          orbitRadiusEarth,
          orbitRadiusScene: orbitRadiusScene_,
          orbitRadius: moonMapOrbit,
          baseColor: m.baseColor,
          accentColor: m.accentColor,
          orbitSpeed: moonSpeed(mi, p.moons.length),
          inclination: m.inclination || 0,
          startAngle: mi * 1.5,
          noiseScale: m.noiseScale,
          clouds: m.clouds || null,
          atmosphere: m.atmosphere || null,
        };
      }

      // Regular moon
      const moonRadiusScene = earthRadiiToScene(m.radiusEarth);
      const moonMapRadius = (m.radiusEarth / p.radiusEarth) * mapRadius;
      const orbitRadiusEarth = p.radiusEarth * m.orbitMultiple;
      const orbitRadiusScene_ = earthRadiiToScene(orbitRadiusEarth);
      const moonMapOrbit = mapRadius * (2.0 + mi * 1.8);
      const speed = moonSpeed(mi, p.moons.length);

      return {
        type: m.type,
        radiusEarth: m.radiusEarth,
        radiusScene: moonRadiusScene,
        radius: moonMapRadius,
        orbitRadiusEarth,
        orbitRadiusScene: orbitRadiusScene_,
        orbitRadius: moonMapOrbit,
        baseColor: m.baseColor,
        accentColor: m.accentColor,
        orbitSpeed: m.retrograde ? -speed : speed,
        inclination: m.inclination || 0,
        startAngle: mi * 2.1,
        noiseScale: Math.max(m.noiseScale, 2.5 / moonMapRadius),
        clouds: null,
        atmosphere: null,
      };
    });

    return {
      planetData,
      moons,
      orbitRadiusAU: p.orbitAU,
      orbitRadiusScene,
      orbitRadius,
      orbitAngle,
      orbitSpeed: keplerSpeed(orbitRadius),
    };
  });

  // ── Asteroid belt (between Mars and Jupiter) ──
  const beltCenterAU = 2.7;
  const beltWidthAU = 0.8;
  const beltCenter = mapOrbit(beltCenterAU);
  const beltWidth = beltWidthAU * MAP_UNITS_PER_AU;
  const beltThickness = beltWidth * 0.05;

  const asteroids = [];
  const asteroidCount = 350;
  for (let i = 0; i < asteroidCount; i++) {
    const angle = (i / asteroidCount) * Math.PI * 2 + Math.random() * 0.3;
    const r = beltCenter + (Math.random() - 0.5) * beltWidth;
    const y = (Math.random() - 0.5) * beltThickness;
    const size = Math.pow(Math.random(), 3) * 0.06 + 0.012;
    const grey = 0.35 + Math.random() * 0.25;

    const ax = Math.random() - 0.5;
    const ay = Math.random() - 0.5;
    const az = Math.random() - 0.5;
    const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;

    const baseSpeed = 0.00125 / Math.pow(r / beltCenter, 1.5);
    asteroids.push({
      angle,
      radius: r,
      height: y,
      size,
      color: [grey * 1.05, grey, grey * 0.95],
      tumbleAxis: [ax / len, ay / len, az / len],
      tumbleSpeed: 0.07 + Math.random() * 0.26,
      orbitSpeed: baseSpeed * (0.85 + Math.random() * 0.3),
      shapeIndex: Math.floor(Math.random() * 4),
    });
  }

  const asteroidBelts = [{
    centerRadius: beltCenter,
    width: beltWidth / 2,
    thickness: beltThickness,
    centerRadiusAU: beltCenterAU,
    widthAU: beltWidthAU / 2,
    thicknessAU: beltWidthAU * 0.05,
    centerRadiusScene: auToScene(beltCenterAU),
    widthScene: auToScene(beltWidthAU / 2),
    thicknessScene: auToScene(beltWidthAU * 0.05),
    asteroids,
  }];

  // ── Star info (for dual-lighting — solo star) ──
  const starInfo = {
    color1: star.color,
    brightness1: 1.0,
    color2: [0, 0, 0],
    brightness2: 0,
  };

  return {
    star,
    star2: null,
    isBinary: false,
    binarySeparationAU: 0,
    binarySeparationScene: 0,
    binarySeparation: 0,
    binaryMassRatio: 0,
    binaryOrbitSpeed: 0,
    binaryOrbitAngle: 0,
    planets,
    asteroidBelts,
    starInfo,
    seed: 'sol',
    mapUnitsPerAU: MAP_UNITS_PER_AU,
  };
}
