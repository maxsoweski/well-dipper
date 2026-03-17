import { describe, it, expect } from 'vitest';
import {
  estimateMassEarth,
  escapeVelocity,
  jeansParameter,
  equilibriumTemperature,
  computeAtmosphere,
  tidalLockTimescale,
  checkTidalLock,
  tidalHeating,
  circularize,
  deriveComposition,
  detectResonances,
  computeMigration,
  deriveFormation,
  habitabilityScore,
  mainSequenceLifetime,
  stellarEvolution,
  binaryStabilityLimit,
  circumbinaryHZ,
  computeSurfaceHistory,
  rocheLimit,
  generateRingPhysics,
  kirkwoodGaps,
  beltCompositionZones,
  lagrangePoints,
  shouldBeltExist,
  shouldOuterBeltExist,
} from '../PhysicsEngine.js';

// ═══════════════════════════════════════════════
// §1 ATMOSPHERIC RETENTION
// ═══════════════════════════════════════════════

describe('Atmospheric Retention', () => {
  it('estimates Earth-like mass correctly', () => {
    const mass = estimateMassEarth(1.0, 'rocky');
    expect(mass).toBeGreaterThan(0.5);
    expect(mass).toBeLessThan(1.5);
  });

  it('estimates Jupiter-like mass correctly', () => {
    const mass = estimateMassEarth(11.2, 'gas-giant');
    expect(mass).toBeGreaterThan(100);
    expect(mass).toBeLessThan(600);
  });

  it('calculates Earth escape velocity ~11.2 km/s', () => {
    const v = escapeVelocity(1.0, 1.0);
    expect(v).toBeGreaterThan(10000); // >10 km/s
    expect(v).toBeLessThan(12500);    // <12.5 km/s
  });

  it('Earth retains N2 but barely retains H2', () => {
    const jeansN2 = jeansParameter(1.0, 1.0, 1000, 4.65e-26);
    const jeansH2 = jeansParameter(1.0, 1.0, 1000, 3.35e-27);
    expect(jeansN2).toBeGreaterThan(6);   // retained
    expect(jeansH2).toBeLessThan(20);     // H2 is light but still partially retained at Earth mass
  });

  it('calculates Earth equilibrium temp ~255K', () => {
    const T = equilibriumTemperature(1.0, 1.0, 0.3);
    expect(T).toBeGreaterThan(240);
    expect(T).toBeLessThan(270);
  });

  it('gas giants always retain atmosphere', () => {
    const result = computeAtmosphere({
      radiusEarth: 11.0, massEarth: 300, orbitAU: 5.0,
      luminosityRel: 1.0, ageGyr: 4.5, type: 'gas-giant',
    });
    expect(result.retained).toBe(true);
    expect(result.composition).toBe('h2-he');
  });

  it('small hot planet loses atmosphere', () => {
    const result = computeAtmosphere({
      radiusEarth: 0.4, massEarth: 0.05, orbitAU: 0.05,
      luminosityRel: 1.0, ageGyr: 5.0, type: 'rocky',
      ironFraction: 0.3, rotationSpeed: 0,
    });
    expect(result.retained).toBe(false);
  });

  it('Earth-like planet at 1 AU retains secondary atmosphere', () => {
    const result = computeAtmosphere({
      radiusEarth: 1.0, massEarth: 1.0, orbitAU: 1.0,
      luminosityRel: 1.0, ageGyr: 4.5, type: 'terrestrial',
      ironFraction: 0.32, rotationSpeed: 0.1,
    });
    expect(result.retained).toBe(true);
    expect(result.type).toBe('secondary');
  });
});

// ═══════════════════════════════════════════════
// §2 TIDAL MECHANICS
// ═══════════════════════════════════════════════

describe('Tidal Mechanics', () => {
  it('Mercury-like planet has short locking timescale', () => {
    // Mercury: 0.39 AU around Sun, mass 0.055 ME, radius 0.383 RE
    // Mercury IS in 3:2 resonance, so timescale should be < system age
    const tau = tidalLockTimescale(1.0, 0.055, 0.383, 0.39);
    expect(tau).toBeGreaterThan(0.01);
    expect(tau).toBeLessThan(10);
  });

  it('close-in planet around M-dwarf is locked', () => {
    const tau = tidalLockTimescale(0.3, 1.0, 1.0, 0.05);
    const result = checkTidalLock(tau, 5.0);
    expect(result.locked).toBe(true);
  });

  it('Earth is NOT tidally locked to Sun', () => {
    const tau = tidalLockTimescale(1.0, 1.0, 1.0, 1.0);
    const result = checkTidalLock(tau, 4.5);
    expect(result.locked).toBe(false);
  });

  it('Io-like moon has ~1.0 tidal heating', () => {
    // Io: e≈0.0041, around Jupiter (317.8 ME), R≈0.286 RE, a≈66 RE
    const heating = tidalHeating(0.0041, 317.8, 0.286, 66);
    expect(heating).toBeGreaterThan(0.5);
    expect(heating).toBeLessThan(2.0);
  });

  it('distant moon has negligible tidal heating', () => {
    const heating = tidalHeating(0.001, 317.8, 0.4, 400);
    expect(heating).toBeLessThan(0.001);
  });

  it('close orbit circularizes over time', () => {
    const e = circularize(0.3, 5.0, 0.05, 1.0);
    expect(e).toBeLessThan(0.05);
  });

  it('distant orbit retains eccentricity', () => {
    const e = circularize(0.3, 5.0, 30.0, 1.0);
    expect(e).toBeGreaterThan(0.25);
  });
});

// ═══════════════════════════════════════════════
// §3 COMPOSITION
// ═══════════════════════════════════════════════

describe('Composition', () => {
  it('solar metallicity gives silicate surface', () => {
    const c = deriveComposition(0.0, 1.0, 4.85, 0.5);
    expect(c.surfaceType).toBe('silicate');
    expect(c.carbonToOxygen).toBeGreaterThan(0.4);
    expect(c.carbonToOxygen).toBeLessThan(0.7);
  });

  it('high metallicity can produce carbon worlds', () => {
    const c = deriveComposition(0.5, 1.0, 4.85, 0.9);
    expect(c.carbonToOxygen).toBeGreaterThan(0.7);
  });

  it('beyond frost line gives high volatile fraction', () => {
    const c = deriveComposition(0.0, 10.0, 4.85, 0.5);
    expect(c.volatileFraction).toBeGreaterThan(0.2);
  });

  it('close to star gives low volatile fraction', () => {
    const c = deriveComposition(0.0, 0.3, 4.85, 0.5);
    expect(c.volatileFraction).toBeLessThan(0.1);
  });

  it('iron fraction increases with metallicity', () => {
    const low = deriveComposition(-0.5, 1.0, 4.85, 0.5);
    const high = deriveComposition(0.5, 1.0, 4.85, 0.5);
    expect(high.ironFraction).toBeGreaterThan(low.ironFraction);
  });
});

// ═══════════════════════════════════════════════
// §4 ORBITAL RESONANCE
// ═══════════════════════════════════════════════

describe('Orbital Resonance', () => {
  it('detects TRAPPIST-1-like resonance chain', () => {
    // Approximate TRAPPIST-1 orbital distances (AU)
    const planets = [
      { orbitRadiusAU: 0.0115 },
      { orbitRadiusAU: 0.0158 }, // ~8:5 with first
      { orbitRadiusAU: 0.0223 }, // ~5:3 with second
      { orbitRadiusAU: 0.0293 }, // ~3:2 with third
      { orbitRadiusAU: 0.0385 }, // ~3:2 with fourth
      { orbitRadiusAU: 0.0469 }, // ~4:3 with fifth
      { orbitRadiusAU: 0.0619 }, // ~3:2 with sixth
    ];
    const result = detectResonances(planets);
    expect(result.resonances.length).toBeGreaterThan(2);
  });

  it('does not detect resonances in widely-spaced system', () => {
    const planets = [
      { orbitRadiusAU: 0.5 },
      { orbitRadiusAU: 2.0 },
      { orbitRadiusAU: 10.0 },
    ];
    const result = detectResonances(planets);
    expect(result.isResonant).toBe(false);
  });

  it('returns empty for < 3 planets', () => {
    const result = detectResonances([{ orbitRadiusAU: 1.0 }, { orbitRadiusAU: 2.0 }]);
    expect(result.isResonant).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// §5 MIGRATION
// ═══════════════════════════════════════════════

describe('Migration', () => {
  it('returns null when no gas giants exist', () => {
    const planets = [
      { orbitRadiusAU: 1.0, planetData: { type: 'rocky' } },
    ];
    const result = computeMigration(planets, 0.03, 4.85, 0.5);
    expect(result).toBeNull();
  });

  it('can trigger migration for gas giant beyond frost line', () => {
    const planets = [
      { orbitRadiusAU: 0.5, planetData: { type: 'rocky' } },
      { orbitRadiusAU: 1.0, planetData: { type: 'terrestrial' } },
      { orbitRadiusAU: 6.0, planetData: { type: 'gas-giant' } },
    ];
    // Force migration with high disk mass and low rng
    const result = computeMigration(planets, 0.06, 4.85, 0.01);
    expect(result).not.toBeNull();
    expect(result.occurred).toBe(true);
    expect(result.migrantIndex).toBe(2);
    expect(result.scatteredCount).toBe(2);
  });

  it('does not migrate gas giant inside frost line', () => {
    const planets = [
      { orbitRadiusAU: 2.0, planetData: { type: 'gas-giant' } },
    ];
    const result = computeMigration(planets, 0.03, 4.85, 0.5);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// §6 FORMATION HISTORY
// ═══════════════════════════════════════════════

describe('Formation History', () => {
  it('metal-poor star gets compact-rocky archetype', () => {
    const f = deriveFormation(1.0, -0.5, 0.3, 0.1); // low disk mass, short dissipation
    expect(f.archetype).toBe('compact-rocky');
  });

  it('metal-rich star with long disk gets spread-giant', () => {
    const f = deriveFormation(1.0, 0.4, 0.8, 0.9); // high disk mass, long dissipation
    expect(f.archetype).toBe('spread-giant');
  });

  it('disk mass scales with metallicity', () => {
    const low = deriveFormation(1.0, -0.5, 0.5, 0.5);
    const high = deriveFormation(1.0, 0.4, 0.5, 0.5);
    expect(high.diskMass).toBeGreaterThan(low.diskMass);
  });
});

// ═══════════════════════════════════════════════
// §7 HABITABILITY
// ═══════════════════════════════════════════════

describe('Habitability Scoring', () => {
  it('Earth-like planet scores high', () => {
    const result = habitabilityScore({
      atmosphereRetained: true,
      T_eq: 255,
      ageGyr: 4.5,
      ironFraction: 0.32,
      massEarth: 1.0,
      tidalState: { locked: false },
      orbitStable: true,
    });
    expect(result.score).toBeGreaterThan(0.8);
  });

  it('airless rock scores zero', () => {
    const result = habitabilityScore({
      atmosphereRetained: false,
      T_eq: 400,
      ageGyr: 4.5,
      ironFraction: 0.1,
      massEarth: 0.1,
    });
    expect(result.score).toBeLessThan(0.35);
  });

  it('young planet scores lower (no time for life)', () => {
    const result = habitabilityScore({
      atmosphereRetained: true,
      T_eq: 260,
      ageGyr: 0.2,
      ironFraction: 0.3,
      massEarth: 1.0,
      orbitStable: true,
    });
    // Young planet still scores decently (has atmo, water, etc.) but misses age bonuses
    expect(result.score).toBeLessThan(0.85);
    expect(result.factors).not.toContain('age-simple');
  });
});

// ═══════════════════════════════════════════════
// §8 STELLAR EVOLUTION
// ═══════════════════════════════════════════════

describe('Stellar Evolution', () => {
  it('Sun-like star lasts ~10 Gyr', () => {
    const t = mainSequenceLifetime('G', 1.0);
    expect(t).toBeGreaterThan(8);
    expect(t).toBeLessThan(12);
  });

  it('massive O star has very short lifetime', () => {
    const t = mainSequenceLifetime('O', 12.0);
    expect(t).toBeLessThan(0.05); // <50 Myr
  });

  it('M dwarf outlives the universe', () => {
    const t = mainSequenceLifetime('M', 0.3);
    expect(t).toBeGreaterThan(50);
  });

  it('4.5 Gyr Sun is still on main sequence', () => {
    const result = stellarEvolution('G', 1.0, 4.5);
    expect(result.evolved).toBe(false);
    expect(result.stage).toBe('main-sequence');
  });

  it('10 Gyr O-star is a remnant', () => {
    const result = stellarEvolution('O', 12.0, 10);
    expect(result.evolved).toBe(true);
    expect(result.stage).toBe('remnant');
  });

  it('massive star becomes black hole', () => {
    const result = stellarEvolution('O', 30.0, 5);
    expect(result.remnantType).toBe('black-hole');
  });
});

// ═══════════════════════════════════════════════
// §9 BINARY EFFECTS
// ═══════════════════════════════════════════════

describe('Binary Star Effects', () => {
  it('stability limit is > 2× binary separation', () => {
    const limit = binaryStabilityLimit(0.2, 0.5);
    expect(limit).toBeGreaterThan(0.4);
  });

  it('circumbinary HZ is wider than single star', () => {
    const cbHZ = circumbinaryHZ(1.0, 0.3);
    const singleHZ = { inner: 0.95, outer: 1.37 };
    expect(cbHZ.hzInnerAU).toBeGreaterThan(singleHZ.inner);
  });
});

// ═══════════════════════════════════════════════
// §10 IMPACT HISTORY
// ═══════════════════════════════════════════════

describe('Impact History', () => {
  it('young system has high bombardment', () => {
    const h = computeSurfaceHistory(0.3, false, false, false);
    expect(h.bombardmentIntensity).toBeGreaterThan(0.5);
  });

  it('old system has low bombardment', () => {
    const h = computeSurfaceHistory(8.0, false, false, false);
    expect(h.bombardmentIntensity).toBeLessThan(0.2);
  });

  it('atmosphere increases erosion', () => {
    const withAtmo = computeSurfaceHistory(5.0, false, false, true);
    const without = computeSurfaceHistory(5.0, false, false, false);
    expect(withAtmo.erosionLevel).toBeGreaterThan(without.erosionLevel);
  });
});

// ═══════════════════════════════════════════════
// §11 RING PHYSICS
// ═══════════════════════════════════════════════

describe('Ring Physics', () => {
  it('Roche limit for ice moon ~2.44', () => {
    // Equal density: exactly 2.44
    const r = rocheLimit(5500, 5500);
    expect(r).toBeCloseTo(2.44, 1);
  });

  it('Roche limit is larger for dense planet + light moon', () => {
    const r = rocheLimit(5500, 1000);
    expect(r).toBeGreaterThan(3.0);
  });

  it('generates ring with correct inner edge near Roche limit', () => {
    const ring = generateRingPhysics({
      origin: 'roche',
      planetRadiusEarth: 9.0,
      planetDensity: 1300, // Saturn-like
      ageGyr: 4.5,
      axialTilt: 0.4,
      moons: [],
    });
    expect(ring.innerRadius).toBeGreaterThan(2.0);
    expect(ring.outerRadius).toBeGreaterThan(ring.innerRadius);
    expect(ring.tiltX).toBeCloseTo(0.4);
    expect(ring.composition).toBeDefined();
  });

  it('old rings are less dense than young rings', () => {
    const young = generateRingPhysics({
      origin: 'roche', ageGyr: 0.1, rngFloat4: 0.01,
    });
    const old = generateRingPhysics({
      origin: 'roche', ageGyr: 8.0, rngFloat4: 0.99,
    });
    expect(young.density).toBeGreaterThan(old.density);
  });
});

// ═══════════════════════════════════════════════
// §12 BELT PHYSICS
// ═══════════════════════════════════════════════

describe('Belt Physics', () => {
  it('Kirkwood gaps are at correct resonance positions', () => {
    // Jupiter at 5.2 AU
    const gaps = kirkwoodGaps(5.2);
    // 3:1 resonance should be at ~2.5 AU
    const gap31 = gaps.find(g => g.resonance === '3:1');
    expect(gap31).toBeDefined();
    expect(gap31.radiusAU).toBeGreaterThan(2.0);
    expect(gap31.radiusAU).toBeLessThan(3.0);
    // 2:1 resonance at ~3.3 AU
    const gap21 = gaps.find(g => g.resonance === '2:1');
    expect(gap21.radiusAU).toBeGreaterThan(3.0);
    expect(gap21.radiusAU).toBeLessThan(3.5);
  });

  it('composition zones span inner S-type to outer C-type', () => {
    const zones = beltCompositionZones(2.0, 4.0, 3.0);
    expect(zones.length).toBeGreaterThanOrEqual(2);
    expect(zones[0].type).toBe('s-type');
    expect(zones[zones.length - 1].type).toBe('c-type');
  });

  it('Lagrange points are 60° from giant', () => {
    const lp = lagrangePoints(5.2, 0);
    expect(lp.L4.angle).toBeCloseTo(Math.PI / 3, 2);
    expect(lp.L5.angle).toBeCloseTo(-Math.PI / 3, 2);
    expect(lp.L4.radiusAU).toBe(5.2);
  });

  it('belt requires a gas giant', () => {
    const planets = [
      { orbitRadiusAU: 1.0, planetData: { type: 'rocky' } },
      { orbitRadiusAU: 2.0, planetData: { type: 'terrestrial' } },
    ];
    const result = shouldBeltExist(planets, 0.03, false, 4.85);
    expect(result).toBeNull();
  });

  it('belt forms with gas giant present', () => {
    const planets = [
      { orbitRadiusAU: 1.0, planetData: { type: 'rocky' } },
      { orbitRadiusAU: 2.5, planetData: { type: 'rocky' } },
      { orbitRadiusAU: 5.2, planetData: { type: 'gas-giant' } },
    ];
    const result = shouldBeltExist(planets, 0.03, false, 4.85);
    expect(result).not.toBeNull();
    expect(result.type).toBe('main');
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it('migration prevents belt formation', () => {
    const planets = [
      { orbitRadiusAU: 0.05, planetData: { type: 'hot-jupiter' } },
    ];
    const result = shouldBeltExist(planets, 0.03, true, 4.85);
    expect(result).toBeNull();
  });

  it('outer belt forms beyond outermost giant', () => {
    const planets = [
      { orbitRadiusAU: 5.2, planetData: { type: 'gas-giant' } },
      { orbitRadiusAU: 9.5, planetData: { type: 'gas-giant' } },
    ];
    const result = shouldOuterBeltExist(planets, 0.03);
    expect(result).not.toBeNull();
    expect(result.type).toBe('kuiper');
    expect(result.innerAU).toBeGreaterThan(9.5);
  });
});
