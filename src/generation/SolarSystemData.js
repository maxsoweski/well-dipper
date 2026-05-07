import { solarRadiiToScene, earthRadiiToScene, auToScene } from '../core/ScaleConstants.js';
import {
  realisticOrbitSpeed as orb,
  realisticRotationSpeed as rot,
} from '../core/CelestialTime.js';

/**
 * SolarSystemData — hardcoded data for our real Solar System.
 *
 * Secret mode (Shift+0) spawns this instead of a procedural system.
 * Uses the same data structures as StarSystemGenerator so spawnSystem()
 * can consume it directly.
 *
 * Includes all 8 planets, 5 dwarf planets (Ceres, Pluto, Haumea,
 * Makemake, Eris), all major moons, the asteroid belt, and the
 * Kuiper belt.
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
    venus:        [0.4, 0.7],
  };
  const range = ranges[type] || [0.3, 0.9];
  const earthRange = {
    rocky: [0.05, 0.8], terrestrial: [0.8, 1.5], 'gas-giant': [6, 14],
    'sub-neptune': [2.5, 4.0], ice: [0.05, 1.2], venus: [0.8, 1.2],
  };
  const er = earthRange[type] || [0.5, 1.5];
  const t = Math.max(0, Math.min(1, (radiusEarth - er[0]) / (er[1] - er[0])));
  return range[0] + t * (range[1] - range[0]);
}

// Orbital speed using Kepler's 3rd law, scaled to match the engine.
// Wrapped with `orb()` (= × ORBIT_REALISM_FACTOR) so the data on each
// body is born realistic. Per workstream `realistic-celestial-motion-2026-04-27`.
function keplerSpeed(orbitMapRadius) {
  return orb(0.00125 / Math.pow(orbitMapRadius / MAP_BASE, 1.5));
}

// Moon orbital speed — scaled to match MoonGenerator's values
// Inner moons fastest, outer moons slower. Wrapped with `orb()` for
// realistic baseline.
function moonSpeed(index, total) {
  const base = 0.025 + (0.052 - 0.025) * (1 - index / Math.max(1, total - 1));
  return orb(base / (1.0 + index * 0.4));
}

// Generate asteroid belt data
function generateBelt(centerAU, widthAU, count, colorFn) {
  const center = mapOrbit(centerAU);
  const width = widthAU * MAP_UNITS_PER_AU;
  const thickness = width * 0.05;

  const asteroids = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const r = center + (Math.random() - 0.5) * width;
    const y = (Math.random() - 0.5) * thickness;
    const size = Math.pow(Math.random(), 3) * 0.06 + 0.012;
    const color = colorFn();

    const ax = Math.random() - 0.5;
    const ay = Math.random() - 0.5;
    const az = Math.random() - 0.5;
    const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;

    // Asteroid baseSpeed wrapped with `orb()` for realistic baseline
    // (per workstream realistic-celestial-motion-2026-04-27).
    const baseSpeed = orb(0.00125 / Math.pow(r / center, 1.5));
    asteroids.push({
      angle, radius: r, height: y, size, color,
      tumbleAxis: [ax / len, ay / len, az / len],
      tumbleSpeed: 0.07 + Math.random() * 0.26,
      orbitSpeed: baseSpeed * (0.85 + Math.random() * 0.3),
      shapeIndex: Math.floor(Math.random() * 4),
    });
  }

  return {
    centerRadius: center,
    width: width / 2,
    thickness,
    centerRadiusAU: centerAU,
    widthAU: widthAU / 2,
    thicknessAU: widthAU * 0.05,
    centerRadiusScene: auToScene(centerAU),
    widthScene: auToScene(widthAU / 2),
    thicknessScene: auToScene(widthAU * 0.05),
    asteroids,
  };
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
    radius: 4.5,
    temp: 5778,
    luminosity: 1.0,
  };

  // ────────────────────────────────────────────────────────────────
  // PLANETS & DWARF PLANETS (ordered by orbital distance)
  // ────────────────────────────────────────────────────────────────
  const planetsRaw = [

    // ── Mercury ──────────────────────────────────────────────────
    {
      type: 'rocky',
      radiusEarth: 0.383,
      orbitAU: 0.387,
      baseColor: [0.55, 0.52, 0.48],
      accentColor: [0.42, 0.40, 0.38],
      moonCount: 0,
      noiseScale: 4.0,
      noiseDetail: 0.6,
      rotationSpeed: rot(0.04),     // very slow (59 Earth days)
      axialTilt: 0.03,         // ~2°
      rings: null, clouds: null, atmosphere: null,
      moons: [],
      profileId: 'sol-mercury',
    },

    // ── Venus ────────────────────────────────────────────────────
    {
      type: 'venus',
      radiusEarth: 0.95,
      orbitAU: 0.723,
      baseColor: [0.85, 0.75, 0.55],
      accentColor: [0.78, 0.68, 0.50],
      moonCount: 0,
      noiseScale: 2.0,
      noiseDetail: 0.3,
      rotationSpeed: rot(-0.01),    // retrograde, very slow
      axialTilt: 3.1,          // ~177° (nearly upside down)
      rings: null,
      clouds: null,
      atmosphere: { color: [0.9, 0.8, 0.5], strength: 0.6 },
      moons: [],
      profileId: 'sol-venus',
    },

    // ── Earth ────────────────────────────────────────────────────
    {
      type: 'terrestrial',
      radiusEarth: 1.0,
      orbitAU: 1.0,
      baseColor: [0.15, 0.35, 0.55],
      accentColor: [0.25, 0.55, 0.20],
      moonCount: 1,
      noiseScale: 3.0,
      noiseDetail: 0.5,
      rotationSpeed: rot(0.1),
      axialTilt: 0.41,         // 23.4°
      rings: null,
      clouds: { color: [0.95, 0.95, 0.97], density: 0.85, scale: 3.0 },
      atmosphere: { color: [0.4, 0.6, 1.0], strength: 0.4 },
      profileId: 'sol-earth',
      moons: [
        // The Moon
        {
          type: 'rocky',
          radiusEarth: 0.273,
          orbitMultiple: 60,     // 60 Earth radii
          baseColor: [0.6, 0.58, 0.55],
          accentColor: [0.45, 0.43, 0.40],
          noiseScale: 4.0,
          inclination: 0.09,     // ~5°
          profileId: 'sol-moon',
        },
      ],
    },

    // ── Mars ─────────────────────────────────────────────────────
    {
      type: 'rocky',
      radiusEarth: 0.532,
      orbitAU: 1.524,
      baseColor: [0.72, 0.38, 0.22],
      accentColor: [0.55, 0.30, 0.18],
      moonCount: 2,
      noiseScale: 3.5,
      noiseDetail: 0.55,
      rotationSpeed: rot(0.1),
      axialTilt: 0.44,         // 25.2°
      rings: null,
      clouds: null,
      atmosphere: { color: [0.8, 0.5, 0.3], strength: 0.15 },
      profileId: 'sol-mars',
      moons: [
        // Phobos
        {
          type: 'captured',
          radiusEarth: 0.0017,   // ~11 km
          orbitMultiple: 2.76,
          baseColor: [0.35, 0.30, 0.28],
          accentColor: [0.28, 0.25, 0.22],
          noiseScale: 5.0,
          inclination: 0.02,
        },
        // Deimos
        {
          type: 'captured',
          radiusEarth: 0.001,    // ~6 km
          orbitMultiple: 6.9,
          baseColor: [0.38, 0.33, 0.30],
          accentColor: [0.30, 0.27, 0.24],
          noiseScale: 5.0,
          inclination: 0.03,
        },
      ],
    },

    // ── Ceres (dwarf planet in asteroid belt) ────────────────────
    {
      type: 'rocky',
      radiusEarth: 0.074,        // 473 km radius
      orbitAU: 2.768,
      baseColor: [0.45, 0.42, 0.40],
      accentColor: [0.38, 0.36, 0.34],
      moonCount: 0,
      noiseScale: 5.0,
      noiseDetail: 0.5,
      rotationSpeed: rot(0.11),       // 9.07 hours
      axialTilt: 0.07,           // ~4°
      rings: null, clouds: null, atmosphere: null,
      moons: [],
    },

    // ── Jupiter ──────────────────────────────────────────────────
    {
      type: 'gas-giant',
      radiusEarth: 11.21,
      orbitAU: 5.203,
      baseColor: [0.75, 0.62, 0.48],
      accentColor: [0.60, 0.45, 0.32],
      moonCount: 5,
      noiseScale: 2.0,
      noiseDetail: 0.4,
      rotationSpeed: rot(0.167),     // fastest spinner (~10 hours)
      axialTilt: 0.05,          // 3.1°
      rings: null, clouds: null, atmosphere: null,
      profileId: 'sol-jupiter',
      moons: [
        // Amalthea (inner shepherd)
        {
          type: 'captured',
          radiusEarth: 0.013,    // ~84 km (irregular)
          orbitMultiple: 2.54,   // 2.54 Jupiter radii
          baseColor: [0.55, 0.30, 0.20],  // reddish — sulfur from Io
          accentColor: [0.45, 0.25, 0.15],
          noiseScale: 5.0,
          inclination: 0.007,
        },
        // Io
        {
          type: 'volcanic',
          radiusEarth: 0.286,
          orbitMultiple: 5.9,
          baseColor: [0.85, 0.72, 0.30],
          accentColor: [0.90, 0.55, 0.15],
          noiseScale: 4.5,
          inclination: 0.01,
          profileId: 'sol-io',
        },
        // Europa
        {
          type: 'ice',
          radiusEarth: 0.245,
          orbitMultiple: 9.4,
          baseColor: [0.82, 0.80, 0.75],
          accentColor: [0.60, 0.55, 0.50],
          noiseScale: 5.0,
          inclination: 0.008,
          profileId: 'sol-europa',
        },
        // Ganymede (largest moon in the solar system)
        {
          type: 'rocky',
          radiusEarth: 0.413,
          orbitMultiple: 15.0,
          baseColor: [0.55, 0.50, 0.45],
          accentColor: [0.42, 0.38, 0.35],
          noiseScale: 3.5,
          inclination: 0.005,
          profileId: 'sol-ganymede',
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
          profileId: 'sol-callisto',
        },
      ],
    },

    // ── Saturn ───────────────────────────────────────────────────
    {
      type: 'gas-giant',
      radiusEarth: 9.45,
      orbitAU: 9.537,
      baseColor: [0.82, 0.75, 0.58],
      accentColor: [0.72, 0.65, 0.50],
      moonCount: 9,
      noiseScale: 1.8,
      noiseDetail: 0.35,
      rotationSpeed: rot(0.155),
      axialTilt: 0.47,          // 26.7°
      rings: {
        innerRadius: 1.24,      // D ring inner edge
        outerRadius: 2.27,      // F ring outer edge
        color1: [0.85, 0.78, 0.65],
        color2: [0.65, 0.58, 0.45],
        opacity: 0.7,
        tiltX: 0, tiltZ: 0,
      },
      clouds: null, atmosphere: null,
      profileId: 'sol-saturn',
      moons: [
        // Mimas ("Death Star" — huge Herschel crater)
        {
          type: 'ice',
          radiusEarth: 0.031,    // 198 km
          orbitMultiple: 3.08,
          baseColor: [0.78, 0.76, 0.72],
          accentColor: [0.65, 0.62, 0.58],
          noiseScale: 5.0,
          inclination: 0.03,
        },
        // Enceladus (bright white, geysers)
        {
          type: 'ice',
          radiusEarth: 0.04,     // 252 km
          orbitMultiple: 3.95,
          baseColor: [0.95, 0.93, 0.90],
          accentColor: [0.85, 0.83, 0.80],
          noiseScale: 5.0,
          inclination: 0.01,
        },
        // Tethys
        {
          type: 'ice',
          radiusEarth: 0.083,    // 531 km
          orbitMultiple: 4.89,
          baseColor: [0.80, 0.78, 0.75],
          accentColor: [0.68, 0.65, 0.62],
          noiseScale: 4.5,
          inclination: 0.02,
        },
        // Dione
        {
          type: 'ice',
          radiusEarth: 0.088,    // 562 km
          orbitMultiple: 6.26,
          baseColor: [0.75, 0.73, 0.70],
          accentColor: [0.60, 0.58, 0.55],
          noiseScale: 4.0,
          inclination: 0.005,
        },
        // Rhea (second largest Saturn moon)
        {
          type: 'ice',
          radiusEarth: 0.12,     // 764 km
          orbitMultiple: 8.74,
          baseColor: [0.72, 0.70, 0.67],
          accentColor: [0.58, 0.56, 0.52],
          noiseScale: 3.8,
          inclination: 0.006,
        },
        // Titan (planet-class moon — thick atmosphere)
        {
          isPlanetMoon: true,
          type: 'venus',
          radiusFraction: 0.20,
          orbitMultiple: 20.3,
          baseColor: [0.70, 0.55, 0.30],
          accentColor: [0.60, 0.48, 0.25],
          noiseScale: 2.5,
          inclination: 0.005,
          clouds: null,
          atmosphere: { color: [0.7, 0.55, 0.3], strength: 0.5 },
          profileId: 'sol-titan',
        },
        // Hyperion (irregular, chaotic rotation)
        {
          type: 'captured',
          radiusEarth: 0.021,    // ~135 km (irregular)
          orbitMultiple: 24.6,
          baseColor: [0.50, 0.45, 0.38],
          accentColor: [0.40, 0.35, 0.28],
          noiseScale: 5.0,
          inclination: 0.01,
        },
        // Iapetus (two-tone — dark leading, bright trailing)
        {
          type: 'ice',
          radiusEarth: 0.115,    // 735 km
          orbitMultiple: 59.1,
          baseColor: [0.25, 0.22, 0.20],   // dark hemisphere dominant
          accentColor: [0.80, 0.78, 0.75], // bright hemisphere contrast
          noiseScale: 3.0,
          inclination: 0.27,     // ~15° — significant tilt
        },
        // Phoebe (retrograde captured moon, very dark)
        {
          type: 'captured',
          radiusEarth: 0.017,    // 107 km
          orbitMultiple: 215,    // very far out
          baseColor: [0.22, 0.20, 0.18],
          accentColor: [0.18, 0.16, 0.14],
          noiseScale: 5.0,
          inclination: 2.94,     // ~175° — retrograde
          retrograde: true,
        },
      ],
    },

    // ── Uranus ───────────────────────────────────────────────────
    {
      type: 'sub-neptune',
      radiusEarth: 4.01,
      orbitAU: 19.19,
      baseColor: [0.55, 0.75, 0.80],
      accentColor: [0.60, 0.78, 0.82],
      moonCount: 5,
      noiseScale: 1.5,
      noiseDetail: 0.25,
      rotationSpeed: rot(-0.12),    // retrograde
      axialTilt: 1.71,         // 97.8° — rolls on its side
      rings: {
        innerRadius: 1.6,
        outerRadius: 2.0,
        color1: [0.4, 0.45, 0.5],
        color2: [0.3, 0.35, 0.4],
        opacity: 0.25,          // very faint
        tiltX: 0, tiltZ: 0,
      },
      clouds: null,
      atmosphere: { color: [0.5, 0.75, 0.85], strength: 0.45 },
      profileId: 'sol-uranus',
      moons: [
        // Miranda (bizarre patchwork terrain)
        {
          type: 'ice',
          radiusEarth: 0.037,    // 236 km
          orbitMultiple: 5.08,
          baseColor: [0.65, 0.62, 0.58],
          accentColor: [0.50, 0.48, 0.44],
          noiseScale: 5.0,
          inclination: 0.07,
        },
        // Ariel (brightest Uranian moon)
        {
          type: 'ice',
          radiusEarth: 0.091,    // 579 km
          orbitMultiple: 7.47,
          baseColor: [0.70, 0.68, 0.65],
          accentColor: [0.58, 0.55, 0.52],
          noiseScale: 4.0,
          inclination: 0.005,
        },
        // Umbriel (darkest Uranian moon)
        {
          type: 'ice',
          radiusEarth: 0.092,    // 585 km
          orbitMultiple: 10.4,
          baseColor: [0.38, 0.36, 0.34],
          accentColor: [0.30, 0.28, 0.26],
          noiseScale: 4.0,
          inclination: 0.006,
        },
        // Titania (largest Uranian moon)
        {
          type: 'ice',
          radiusEarth: 0.124,    // 789 km
          orbitMultiple: 17.1,
          baseColor: [0.60, 0.58, 0.55],
          accentColor: [0.48, 0.46, 0.42],
          noiseScale: 4.0,
          inclination: 0.005,
        },
        // Oberon (outermost major Uranian moon)
        {
          type: 'ice',
          radiusEarth: 0.119,    // 761 km
          orbitMultiple: 22.8,
          baseColor: [0.48, 0.45, 0.42],
          accentColor: [0.38, 0.35, 0.32],
          noiseScale: 4.0,
          inclination: 0.005,
        },
      ],
    },

    // ── Neptune ──────────────────────────────────────────────────
    {
      type: 'sub-neptune',
      radiusEarth: 3.88,
      orbitAU: 30.07,
      baseColor: [0.25, 0.40, 0.70],
      accentColor: [0.30, 0.48, 0.75],
      moonCount: 2,
      noiseScale: 1.8,
      noiseDetail: 0.3,
      rotationSpeed: rot(0.13),
      axialTilt: 0.49,          // 28.3°
      rings: {
        innerRadius: 1.7,
        outerRadius: 2.5,
        color1: [0.3, 0.33, 0.4],
        color2: [0.2, 0.22, 0.28],
        opacity: 0.12,           // extremely faint
        tiltX: 0, tiltZ: 0,
      },
      clouds: null,
      atmosphere: { color: [0.3, 0.5, 0.9], strength: 0.5 },
      profileId: 'sol-neptune',
      moons: [
        // Proteus (irregularly shaped, dark)
        {
          type: 'captured',
          radiusEarth: 0.033,    // 210 km
          orbitMultiple: 4.75,
          baseColor: [0.30, 0.28, 0.26],
          accentColor: [0.25, 0.23, 0.20],
          noiseScale: 5.0,
          inclination: 0.01,
        },
        // Triton (retrograde captured, geologically active)
        {
          type: 'ice',
          radiusEarth: 0.212,    // 1353 km
          orbitMultiple: 14.3,
          baseColor: [0.72, 0.68, 0.62],
          accentColor: [0.55, 0.52, 0.48],
          noiseScale: 4.0,
          inclination: 2.72,     // ~156° retrograde
          retrograde: true,
          profileId: 'sol-triton',
        },
      ],
    },

    // ── Pluto (dwarf planet + Charon binary) ─────────────────────
    {
      type: 'ice',
      radiusEarth: 0.186,        // 1188 km
      orbitAU: 39.48,
      baseColor: [0.72, 0.62, 0.52],  // tan/pinkish
      accentColor: [0.60, 0.50, 0.42],
      moonCount: 1,
      noiseScale: 4.5,
      noiseDetail: 0.5,
      rotationSpeed: rot(-0.04),      // retrograde, 6.4 day period
      axialTilt: 2.14,           // 122.5° — significantly tilted
      rings: null, clouds: null,
      atmosphere: { color: [0.5, 0.5, 0.6], strength: 0.1 },  // tenuous N2
      profileId: 'sol-pluto',
      moons: [
        // Charon (binary companion — 1:8 mass ratio, tidally locked)
        {
          type: 'ice',
          radiusEarth: 0.095,    // 606 km (half of Pluto!)
          orbitMultiple: 17.0,   // ~17 Pluto radii
          baseColor: [0.50, 0.48, 0.46],
          accentColor: [0.40, 0.38, 0.35],
          noiseScale: 4.5,
          inclination: 0.0,      // coplanar with Pluto's equator
          profileId: 'sol-charon',
        },
      ],
    },

    // ── Haumea (dwarf planet — elongated, has ring) ──────────────
    {
      type: 'ice',
      radiusEarth: 0.13,         // ~816 km mean radius (elongated)
      orbitAU: 43.22,
      baseColor: [0.85, 0.83, 0.80],  // very bright icy surface
      accentColor: [0.72, 0.70, 0.68],
      moonCount: 0,
      noiseScale: 4.0,
      noiseDetail: 0.4,
      rotationSpeed: rot(0.25),       // incredibly fast — 3.9 hours!
      axialTilt: 2.2,            // heavily tilted
      rings: {
        innerRadius: 1.85,       // ring at ~2287 km from center
        outerRadius: 2.15,       // narrow ring, ~70 km wide
        color1: [0.6, 0.58, 0.55],
        color2: [0.5, 0.48, 0.45],
        opacity: 0.3,
        tiltX: 0, tiltZ: 0,
      },
      clouds: null, atmosphere: null,
      moons: [],
    },

    // ── Makemake (dwarf planet — bright, reddish) ────────────────
    {
      type: 'ice',
      radiusEarth: 0.112,        // ~715 km
      orbitAU: 45.79,
      baseColor: [0.78, 0.68, 0.58],  // reddish-brown tholins
      accentColor: [0.65, 0.55, 0.48],
      moonCount: 0,
      noiseScale: 4.5,
      noiseDetail: 0.45,
      rotationSpeed: rot(0.06),       // 22.8 hours
      axialTilt: 0.5,
      rings: null, clouds: null, atmosphere: null,
      moons: [],
    },

    // ── Eris (most massive dwarf planet) ─────────────────────────
    {
      type: 'ice',
      radiusEarth: 0.182,        // 1163 km (nearly Pluto-sized)
      orbitAU: 67.67,            // far out in the scattered disc
      baseColor: [0.88, 0.86, 0.84],  // extremely bright, white
      accentColor: [0.75, 0.73, 0.70],
      moonCount: 1,
      noiseScale: 4.0,
      noiseDetail: 0.4,
      rotationSpeed: rot(0.05),       // ~25.9 hours
      axialTilt: 1.34,           // ~78°
      rings: null, clouds: null, atmosphere: null,
      moons: [
        // Dysnomia
        {
          type: 'captured',
          radiusEarth: 0.05,     // ~350 km (estimated)
          orbitMultiple: 32,     // ~37,300 km from Eris
          baseColor: [0.35, 0.33, 0.30],
          accentColor: [0.28, 0.26, 0.23],
          noiseScale: 5.0,
          inclination: 0.61,     // ~35°
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
    const orbitAngle = (i / planetsRaw.length) * Math.PI * 2 * 0.7 + 0.3;
    const sunDir = [-Math.cos(orbitAngle), 0, -Math.sin(orbitAngle)];

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
      profileId: p.profileId || null,
      // Inspection-layer naming metadata. profileId carries canonical
      // names for bodies in KnownBodyProfiles; _canonicalName is the
      // fallback for bodies (Ceres, Haumea, Makemake, Eris) that have a
      // canonical proper name but no KnownBodyProfiles entry.
      _systemSeed: 'sol',
      _ordinal: i,
      _canonicalName: p.name ? p.name.toLowerCase().replace(/\s+/g, '-') : null,
    };

    // Build moons
    const moons = p.moons.map((m, mi) => {
      if (m.isPlanetMoon) {
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
            _systemSeed: 'sol',
            _ordinal: `${i}.pm.${mi}`,
            _canonicalName: m.name ? m.name.toLowerCase().replace(/\s+/g, '-') : null,
            noiseDetail: 0.4,
            rotationSpeed: rot(0.05),
            axialTilt: 0.1,
            sunDirection: sunDir,
            profileId: m.profileId || null,
        _systemSeed: 'sol',
        _ordinal: `${i}.${mi}`,
        _canonicalName: m.name ? m.name.toLowerCase().replace(/\s+/g, '-') : null,
            _systemSeed: 'sol',
            _ordinal: `${i}.${mi}`,
            _canonicalName: m.name ? m.name.toLowerCase().replace(/\s+/g, '-') : null,
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
        profileId: m.profileId || null,
        _systemSeed: 'sol',
        _ordinal: `${i}.${mi}`,
        _canonicalName: m.name ? m.name.toLowerCase().replace(/\s+/g, '-') : null,
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

  // ── Asteroid belts ──

  // Main belt (between Mars and Jupiter, 2.1-3.3 AU)
  const mainBelt = generateBelt(2.7, 1.2, 400, () => {
    const grey = 0.35 + Math.random() * 0.25;
    return [grey * 1.05, grey, grey * 0.95];
  });

  // Kuiper belt (beyond Neptune, 30-50 AU)
  // Wider, sparser, icier colors than the main belt
  const kuiperBelt = generateBelt(40, 20, 350, () => {
    const base = 0.4 + Math.random() * 0.3;
    // Slight blue-grey tint (icy bodies)
    return [base * 0.95, base, base * 1.05];
  });

  // Phase 2-followup of welldipper-scene-inspection-layer: tag id-deriving
  // metadata for naming. Sol's belts have canonical 'main' / 'kuiper' ids.
  mainBelt._systemSeed = 'sol';
  mainBelt._ordinal = 'main';
  mainBelt._canonicalName = 'main';
  kuiperBelt._systemSeed = 'sol';
  kuiperBelt._ordinal = 'kuiper';
  kuiperBelt._canonicalName = 'kuiper';
  kuiperBelt.isKuiper = true;
  const asteroidBelts = [mainBelt, kuiperBelt];

  // ── Star info ──
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
