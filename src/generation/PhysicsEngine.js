/**
 * PhysicsEngine — pure physics calculations for procedural generation.
 *
 * All functions are stateless and deterministic. No Three.js, no RNG —
 * just math. The generators call these to derive properties from physical
 * relationships instead of random rolls.
 *
 * Organized by domain:
 *   §1 Atmospheric retention (Jeans escape, UV stripping, magnetic fields)
 *   §2 Tidal mechanics (locking, heating, circularization)
 *   §3 Composition (C/O ratio, iron fraction, volatiles)
 *   §4 Orbital resonance detection
 *   §5 Planetary migration
 *   §6 Formation history (disk model)
 *   §7 Habitability scoring
 *   §8 Stellar evolution
 *   §9 Binary star effects
 *   §10 Impact history
 *   §11 Ring physics (Roche limit, gaps, density)
 *   §12 Belt physics (Kirkwood gaps, composition zones)
 *
 * References in comments use short keys:
 *   [FV05] = Fischer & Valenti 2005 (metallicity-giant correlation)
 *   [SH15] = Steffen & Hwang 2015 (orbital spacing)
 *   [B20]  = Bryson 2020 (occurrence rates)
 *   [HB13] = Heller & Barnes 2013 (habitable moons)
 */

// ── Physical constants ──
const G = 6.674e-11;            // gravitational constant (m³/kg/s²)
const k_B = 1.381e-23;          // Boltzmann constant (J/K)
const M_SUN = 1.989e30;         // solar mass (kg)
const R_SUN = 6.957e8;          // solar radius (m)
const M_EARTH = 5.972e24;       // Earth mass (kg)
const R_EARTH = 6.371e6;        // Earth radius (m)
const AU_M = 1.496e11;          // 1 AU in meters
const SIGMA = 5.670e-8;         // Stefan-Boltzmann constant
const L_SUN = 3.828e26;         // solar luminosity (W)

// Molecular masses (kg)
const M_H2 = 3.35e-27;         // hydrogen molecule
const M_HE = 6.65e-27;         // helium atom
const M_N2 = 4.65e-26;         // nitrogen molecule
const M_CO2 = 7.31e-26;        // carbon dioxide
const M_H2O = 2.99e-26;        // water

// Main-sequence lifetime coefficients: t_ms ≈ t_sun × (M/M_sun)^(-2.5)
const T_SUN_MS = 10.0; // Gyr

// ═══════════════════════════════════════════════
// §1 ATMOSPHERIC RETENTION
// ═══════════════════════════════════════════════

/**
 * Estimate planet mass from radius using mass-radius relations.
 * Chen & Kipping 2017 broken power law.
 * @param {number} radiusEarth - radius in Earth radii
 * @param {string} type - planet type for density hints
 * @returns {number} mass in Earth masses
 */
export function estimateMassEarth(radiusEarth, type = 'rocky') {
  // Gas giants and sub-neptunes have lower bulk density
  if (type === 'gas-giant' || type === 'hot-jupiter') {
    // Jupiter: 11.2 RE, 317.8 ME → density drops with size
    return Math.pow(radiusEarth, 2.06) * 0.9;
  }
  if (type === 'sub-neptune') {
    // Neptune: 3.88 RE, 17.15 ME
    return Math.pow(radiusEarth, 1.7) * 2.7;
  }
  // Rocky/terrestrial: M ∝ R^3.7 (iron-silicate, Chen & Kipping)
  return Math.pow(radiusEarth, 3.7) * 0.9;
}

/**
 * Escape velocity at planet surface.
 * @param {number} massEarth - mass in Earth masses
 * @param {number} radiusEarth - radius in Earth radii
 * @returns {number} escape velocity in m/s
 */
export function escapeVelocity(massEarth, radiusEarth) {
  const M = massEarth * M_EARTH;
  const R = radiusEarth * R_EARTH;
  return Math.sqrt(2 * G * M / R);
}

/**
 * Jeans escape parameter λ for a given molecular species.
 * λ > 6 → species is retained; λ < 6 → species escapes over Gyr.
 * @param {number} massEarth
 * @param {number} radiusEarth
 * @param {number} T_exo - exospheric temperature (K)
 * @param {number} m_molecule - molecular mass (kg)
 * @returns {number} Jeans parameter (dimensionless)
 */
export function jeansParameter(massEarth, radiusEarth, T_exo, m_molecule) {
  const M = massEarth * M_EARTH;
  const R = radiusEarth * R_EARTH;
  return (G * M * m_molecule) / (k_B * T_exo * R);
}

/**
 * Estimate exospheric temperature from equilibrium temperature.
 * Real exospheres are 2-10× hotter than equilibrium due to UV heating.
 * @param {number} T_eq - equilibrium temperature (K)
 * @returns {number} exospheric temperature (K)
 */
export function exosphericTemperature(T_eq) {
  // Rough: exosphere ≈ 3× equilibrium for rocky planets
  // Earth: T_eq ≈ 255K, T_exo ≈ 1000K → factor ~4
  return T_eq * 3.5;
}

/**
 * Equilibrium temperature of a planet.
 * @param {number} luminosityRel - stellar luminosity relative to Sun
 * @param {number} orbitAU - orbital distance in AU
 * @param {number} albedo - bond albedo (0-1)
 * @returns {number} equilibrium temperature (K)
 */
export function equilibriumTemperature(luminosityRel, orbitAU, albedo = 0.3) {
  const L = luminosityRel * L_SUN;
  const d = orbitAU * AU_M;
  return Math.pow(L * (1 - albedo) / (16 * Math.PI * SIGMA * d * d), 0.25);
}

/**
 * Compute atmospheric retention for a planet.
 * @param {object} params
 * @param {number} params.radiusEarth
 * @param {number} params.massEarth
 * @param {number} params.orbitAU
 * @param {number} params.luminosityRel - star luminosity relative to Sun
 * @param {number} params.ageGyr - system age
 * @param {number} params.ironFraction - 0-0.5, drives magnetic field strength
 * @param {number} params.rotationSpeed - rotation rate (0 = tidally locked)
 * @param {string} params.type - planet type
 * @returns {object} atmosphere properties
 */
export function computeAtmosphere(params) {
  const { radiusEarth, massEarth, orbitAU, luminosityRel, ageGyr,
          ironFraction = 0.32, rotationSpeed = 0.1, type } = params;

  // Gas giants / sub-neptunes always retain massive atmospheres
  if (type === 'gas-giant' || type === 'hot-jupiter' || type === 'sub-neptune' || type === 'venus') {
    return {
      retained: true,
      type: 'primordial',
      composition: type === 'venus' ? 'co2' : 'h2-he',
      pressure: type === 'venus' ? 90 : (type === 'sub-neptune' ? 50 : 1000),
      jeansH2: 100, // effectively infinite retention
    };
  }

  const T_eq = equilibriumTemperature(luminosityRel, orbitAU);
  const T_exo = exosphericTemperature(T_eq);

  // Jeans parameter for each species
  const jeansH2  = jeansParameter(massEarth, radiusEarth, T_exo, M_H2);
  const jeansN2  = jeansParameter(massEarth, radiusEarth, T_exo, M_N2);
  const jeansCO2 = jeansParameter(massEarth, radiusEarth, T_exo, M_CO2);
  const jeansH2O = jeansParameter(massEarth, radiusEarth, T_exo, M_H2O);

  // Magnetic field factor: strong field reduces sputtering by ~10×
  // Field strength correlates with iron core fraction and rotation rate
  // Tidally locked planets have weaker fields (slower rotation)
  const isLocked = Math.abs(rotationSpeed) < 0.01;
  const fieldStrength = ironFraction * (isLocked ? 0.2 : 1.0);
  // UV flux relative to Earth (1/r² law)
  const uvFlux = luminosityRel / (orbitAU * orbitAU);
  // Stripping timescale: higher UV + weaker field = faster loss
  const stripRate = uvFlux / Math.max(fieldStrength, 0.01);
  // Over geological time: if stripRate × age > threshold, primordial H/He is gone
  // Earth-like: uvFlux=1, fieldStrength=0.32, stripRate≈3.1, ×4.5Gyr≈14 → stripped
  // Small hot: uvFlux=400, fieldStrength≈0, stripRate=40000, ×5Gyr=200000 → very stripped
  const primordialStripped = stripRate * ageGyr > 10;

  // UV sputtering: extreme UV strips even heavy molecules from small planets
  // without magnetic fields. Scales with UV flux and inverse of field strength.
  const uvStripFactor = uvFlux > 10 && fieldStrength < 0.1
    ? Math.min(uvFlux * 0.1, 20) : 0;

  // Determine what's retained
  const retainsH2 = jeansH2 > 6 && !primordialStripped;
  const retainsN2 = jeansN2 > (6 + uvStripFactor);
  const retainsCO2 = jeansCO2 > (6 + uvStripFactor);
  const retainsH2O = jeansH2O > (6 + uvStripFactor);

  if (!retainsCO2 && !retainsN2) {
    // Can't hold anything meaningful
    return {
      retained: false,
      type: 'none',
      composition: 'none',
      pressure: 0,
      jeansH2, jeansN2, jeansCO2,
    };
  }

  if (retainsH2 && !primordialStripped) {
    return {
      retained: true,
      type: 'primordial',
      composition: 'h2-he',
      pressure: 10 + massEarth * 5,
      jeansH2, jeansN2, jeansCO2,
    };
  }

  // Secondary atmosphere (outgassed)
  // Composition depends on temperature and whether water survives
  if (retainsH2O && T_eq < 373) {
    // Temperate: N₂-O₂ possible (if biology, which we handle in habitability)
    return {
      retained: true,
      type: 'secondary',
      composition: 'n2-o2',
      pressure: 0.3 + massEarth * 0.8,
      jeansH2, jeansN2, jeansCO2,
    };
  }

  if (retainsCO2) {
    // Hot or dry: CO₂ dominated
    return {
      retained: true,
      type: 'secondary',
      composition: T_eq > 500 ? 'co2' : 'co2-n2',
      pressure: retainsN2 ? (0.5 + massEarth * 1.5) : (0.1 + massEarth * 0.5),
      jeansH2, jeansN2, jeansCO2,
    };
  }

  // Thin remnant
  return {
    retained: true,
    type: 'remnant',
    composition: 'co2-n2',
    pressure: 0.01 + massEarth * 0.1,
    jeansH2, jeansN2, jeansCO2,
  };
}


// ═══════════════════════════════════════════════
// §2 TIDAL MECHANICS
// ═══════════════════════════════════════════════

/**
 * Tidal locking timescale (simplified Peale 1977).
 * If timescale < system age, the body is locked.
 * @param {number} massParent - parent mass in solar masses
 * @param {number} massBody - body mass in Earth masses
 * @param {number} radiusBody - body radius in Earth radii
 * @param {number} semiMajorAU - orbital distance in AU
 * @returns {number} locking timescale in Gyr
 */
export function tidalLockTimescale(massParent, massBody, radiusBody, semiMajorAU) {
  // Simplified: t_lock ∝ a^6 × m_body / (m_parent² × R_body³)
  // Normalized so Earth at 1 AU around Sun → ~100 Gyr (not locked)
  // Mercury at 0.39 AU → ~10 Gyr (3:2 resonance, partially locked)
  const a = semiMajorAU;
  const Q = 100; // tidal quality factor (rocky)
  const norm = 50.0; // normalization constant (tuned to real cases)
  return norm * Math.pow(a, 6) * massBody / (massParent * massParent * Math.pow(radiusBody, 3));
}

/**
 * Check if a body is tidally locked.
 * @param {number} lockTimescale - from tidalLockTimescale()
 * @param {number} ageGyr - system age
 * @returns {object} { locked, lockType }
 */
export function checkTidalLock(lockTimescale, ageGyr) {
  if (ageGyr > lockTimescale) {
    return { locked: true, lockType: 'synchronous' };
  }
  // Near the boundary: 3:2 spin-orbit resonance possible (like Mercury)
  if (ageGyr > lockTimescale * 0.6) {
    return { locked: true, lockType: '3:2-resonance' };
  }
  return { locked: false, lockType: 'none' };
}

/**
 * Tidal heating rate for a moon (simplified Peale, Cassen & Reynolds 1979).
 * Heating ∝ (e² × M_parent² × R_moon⁵) / a⁵
 * Normalized so Io-like parameters give ~1.0.
 * @param {number} eccentricity - orbital eccentricity
 * @param {number} massParentEarth - parent planet mass in Earth masses
 * @param {number} radiusMoonEarth - moon radius in Earth radii
 * @param {number} orbitRadiusEarth - moon orbit radius in Earth radii
 * @returns {number} tidal heating rate (0 = none, 1 = Io-level, >1 = extreme)
 */
export function tidalHeating(eccentricity, massParentEarth, radiusMoonEarth, orbitRadiusEarth) {
  // Io reference values: e≈0.0041, M_Jupiter≈317.8 ME, R_Io≈0.286 RE, a≈5.9*11.2≈66 RE
  const e2 = eccentricity * eccentricity;
  const mp2 = massParentEarth * massParentEarth;
  const rm5 = Math.pow(radiusMoonEarth, 5);
  const a5 = Math.pow(orbitRadiusEarth, 5);

  // Io normalization
  const ioE2 = 0.0041 * 0.0041;
  const ioMp2 = 317.8 * 317.8;
  const ioRm5 = Math.pow(0.286, 5);
  const ioA5 = Math.pow(66, 5);
  const ioRef = ioE2 * ioMp2 * ioRm5 / ioA5;

  return (e2 * mp2 * rm5 / a5) / ioRef;
}

/**
 * Orbit circularization over time.
 * Eccentric orbits lose eccentricity through tidal dissipation.
 * @param {number} initialEccentricity
 * @param {number} ageGyr
 * @param {number} orbitAU
 * @param {number} massParent - in solar masses
 * @returns {number} current eccentricity
 */
export function circularize(initialEccentricity, ageGyr, orbitAU, massParent) {
  // Timescale for circularization ∝ a^(13/2) / M_parent
  // Close-in planets circularize fast, distant ones keep eccentricity
  const tau = 5.0 * Math.pow(orbitAU, 6.5) / (massParent + 0.01);
  return initialEccentricity * Math.exp(-ageGyr / Math.max(tau, 0.01));
}


// ═══════════════════════════════════════════════
// §3 COMPOSITION
// ═══════════════════════════════════════════════

/**
 * Derive planetary composition from star's metallicity and orbital distance.
 * @param {number} metallicity - [Fe/H]
 * @param {number} orbitAU
 * @param {number} frostLineAU
 * @param {number} rngFloat - random float 0-1 for scatter
 * @returns {object} composition properties
 */
export function deriveComposition(metallicity, orbitAU, frostLineAU, rngFloat) {
  // Carbon-to-oxygen ratio: correlates with metallicity
  // Solar: C/O ≈ 0.55. Metal-rich stars tend toward higher C/O.
  const carbonToOxygen = Math.max(0.2, Math.min(1.3,
    0.55 + 0.3 * metallicity + (rngFloat - 0.5) * 0.2
  ));

  // Iron fraction: higher metallicity → denser cores
  // Earth: ~0.32, Mercury: ~0.68 (unusually iron-rich)
  const ironFraction = Math.max(0.1, Math.min(0.6,
    0.28 + 0.15 * metallicity + (rngFloat - 0.5) * 0.1
  ));

  // Volatile budget: distance from star during formation
  // Beyond frost line: volatile-rich (icy). Inside: dry.
  const frostRatio = orbitAU / Math.max(frostLineAU, 0.01);
  let volatileFraction;
  if (frostRatio < 0.5) {
    volatileFraction = 0.01 + rngFloat * 0.05; // bone dry
  } else if (frostRatio < 1.0) {
    volatileFraction = 0.05 + (frostRatio - 0.5) * 0.4 + rngFloat * 0.1; // transitioning
  } else {
    volatileFraction = 0.25 + Math.min(frostRatio - 1.0, 2.0) * 0.15 + rngFloat * 0.1; // volatile-rich
  }
  volatileFraction = Math.min(volatileFraction, 0.7);

  // Surface type
  let surfaceType;
  if (carbonToOxygen > 0.8) {
    surfaceType = 'carbon';
  } else if (ironFraction > 0.45) {
    surfaceType = 'iron-rich';
  } else if (volatileFraction > 0.4) {
    surfaceType = 'ice-rock';
  } else {
    surfaceType = 'silicate';
  }

  // Bulk density (kg/m³) — rough estimate
  const baseDensity = 3500 + ironFraction * 5000 - volatileFraction * 2000;
  const density = Math.max(1000, Math.min(8000, baseDensity));

  return { carbonToOxygen, ironFraction, volatileFraction, surfaceType, density };
}


// ═══════════════════════════════════════════════
// §4 ORBITAL RESONANCE
// ═══════════════════════════════════════════════

/**
 * Check for and snap to orbital resonance chains.
 * @param {Array<{orbitRadiusAU: number}>} planets - array of planet data
 * @returns {object} { isResonant, resonances: [{innerIdx, outerIdx, ratio}] }
 */
export function detectResonances(planets) {
  if (planets.length < 3) return { isResonant: false, resonances: [] };

  const resonances = [];
  const COMMON_RATIOS = [
    { num: 2, den: 1, tolerance: 0.08 },
    { num: 3, den: 2, tolerance: 0.06 },
    { num: 4, den: 3, tolerance: 0.05 },
    { num: 5, den: 4, tolerance: 0.05 },
    { num: 5, den: 3, tolerance: 0.06 },
  ];

  for (let i = 0; i < planets.length - 1; i++) {
    const a1 = planets[i].orbitRadiusAU;
    const a2 = planets[i + 1].orbitRadiusAU;
    // Period ratio from Kepler's 3rd law: P2/P1 = (a2/a1)^1.5
    const periodRatio = Math.pow(a2 / a1, 1.5);

    for (const { num, den, tolerance } of COMMON_RATIOS) {
      const target = num / den;
      if (Math.abs(periodRatio - target) < tolerance) {
        resonances.push({ innerIdx: i, outerIdx: i + 1, ratio: `${num}:${den}`, periodRatio });
        break;
      }
    }
  }

  // A chain requires at least 2 consecutive resonance pairs
  let chainLength = 0;
  let maxChain = 0;
  for (let i = 0; i < resonances.length; i++) {
    if (i === 0 || resonances[i].innerIdx === resonances[i - 1].outerIdx) {
      chainLength++;
    } else {
      chainLength = 1;
    }
    maxChain = Math.max(maxChain, chainLength);
  }

  return {
    isResonant: maxChain >= 2,
    resonances,
    chainLength: maxChain,
  };
}

/**
 * Snap planet orbits to exact resonance ratios.
 * Modifies orbitRadiusAU in place. Returns the resonance data.
 * @param {Array} planets - planet data array (modified in place)
 * @param {Array} resonances - from detectResonances
 */
export function snapToResonances(planets, resonances) {
  for (const res of resonances) {
    const inner = planets[res.innerIdx];
    const [num, den] = res.ratio.split(':').map(Number);
    const targetRatio = num / den;
    // Snap outer orbit so period ratio is exact
    // a2 = a1 × (P2/P1)^(2/3)
    const snappedAU = inner.orbitRadiusAU * Math.pow(targetRatio, 2 / 3);
    planets[res.outerIdx].orbitRadiusAU = snappedAU;
  }
}


// ═══════════════════════════════════════════════
// §5 PLANETARY MIGRATION
// ═══════════════════════════════════════════════

/**
 * Determine if migration should occur and compute results.
 * @param {Array} planets - planets with { orbitRadiusAU, planetData: { type } }
 * @param {number} diskMass - protoplanetary disk mass (relative)
 * @param {number} frostLineAU
 * @param {number} rngFloat - random 0-1
 * @returns {object|null} migration result or null if no migration
 */
export function computeMigration(planets, diskMass, frostLineAU, rngFloat) {
  // Find gas giants in the outer zone (candidates for migration)
  const candidates = [];
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    if ((p.planetData.type === 'gas-giant') && p.orbitRadiusAU > frostLineAU) {
      candidates.push(i);
    }
  }
  if (candidates.length === 0) return null;

  // Migration probability: higher disk mass → more likely
  // ~15% base chance for eligible systems, scaled by disk mass
  const migrationProb = 0.15 * Math.min(diskMass / 0.03, 2.0);
  if (rngFloat > migrationProb) return null;

  // Pick the innermost gas giant (most likely to migrate)
  const migrantIdx = candidates[0];
  const originalOrbitAU = planets[migrantIdx].orbitRadiusAU;

  // Target: somewhere in scorching or inner zone
  const targetAU = 0.03 + rngFloat * 0.08; // 0.03-0.11 AU (typical hot Jupiter range)

  // Count planets that would be scattered/consumed
  let scatteredCount = 0;
  const scatteredIndices = [];
  for (let i = 0; i < planets.length; i++) {
    if (i === migrantIdx) continue;
    if (planets[i].orbitRadiusAU > targetAU && planets[i].orbitRadiusAU < originalOrbitAU) {
      // 70% chance each inner planet is destroyed, 30% scattered to wider orbit
      scatteredCount++;
      scatteredIndices.push(i);
    }
  }

  return {
    occurred: true,
    migrantIndex: migrantIdx,
    originalOrbitAU,
    finalOrbitAU: targetAU,
    scatteredCount,
    scatteredIndices,
  };
}


// ═══════════════════════════════════════════════
// §6 FORMATION HISTORY
// ═══════════════════════════════════════════════

/**
 * Derive system formation history from star and disk properties.
 * Replaces the archetype coin-flip with physics-driven derivation.
 * @param {number} starMassSolar - star mass in solar masses (from radius/type)
 * @param {number} metallicity - [Fe/H]
 * @param {number} rngFloat1 - random 0-1 for disk mass scatter
 * @param {number} rngFloat2 - random 0-1 for dissipation time scatter
 * @returns {object} formation history
 */
export function deriveFormation(starMassSolar, metallicity, rngFloat1, rngFloat2) {
  // Disk mass: fraction of star mass, scaled by metallicity
  // Median ~1-5% of star mass for solids, boosted by metals
  const solidFraction = 0.01 + 0.04 * Math.pow(10, metallicity);
  const diskMass = starMassSolar * solidFraction * (0.5 + rngFloat1);

  // Disk dissipation timescale (Myr): log-normal, median ~3 Myr
  // Short (<2 Myr) → giants didn't form → compact rocky
  // Long (>5 Myr) → giants formed and migrated → spread giant
  const dissipationMyr = 1.0 + rngFloat2 * 8.0;

  // Derive archetype from physical parameters
  let archetype;
  if (dissipationMyr < 2.5 || diskMass < starMassSolar * 0.008) {
    archetype = 'compact-rocky';
  } else if (dissipationMyr > 5.0 && diskMass > starMassSolar * 0.025) {
    archetype = 'spread-giant';
  } else {
    archetype = 'mixed';
  }

  // Snow line at formation (may differ from current frost line)
  // Young stars are more luminous → snow line starts further out
  const snowLineMigration = dissipationMyr < 3.0 ? 1.2 : 1.0; // factor

  return {
    diskMass,
    dissipationMyr,
    archetype,
    snowLineMigration,
    solidFraction,
  };
}


// ═══════════════════════════════════════════════
// §7 HABITABILITY SCORING
// ═══════════════════════════════════════════════

/**
 * Compute habitability score (0-1) for a planet.
 * @param {object} params
 * @returns {number} score 0-1
 */
export function habitabilityScore(params) {
  const { atmosphereRetained, composition, T_eq, ageGyr,
          tidalState, ironFraction, massEarth, orbitStable = true } = params;

  let score = 0;
  const factors = [];

  // 1. Atmosphere retained? (essential)
  if (atmosphereRetained) {
    score += 0.25;
    factors.push('atmosphere');
  }

  // 2. Liquid water possible? (T_eq between 200-350K with atmosphere)
  if (atmosphereRetained && T_eq > 200 && T_eq < 350) {
    score += 0.25;
    factors.push('liquid-water');
  }

  // 3. Magnetic field? (iron core + rotation)
  const hasField = ironFraction > 0.2 &&
    (!tidalState || !tidalState.locked || tidalState.lockType === '3:2-resonance');
  if (hasField) {
    score += 0.15;
    factors.push('magnetic-field');
  }

  // 4. Stable orbit?
  if (orbitStable) {
    score += 0.10;
    factors.push('stable-orbit');
  }

  // 5. Age sufficient? (>0.5 Gyr for any life, >2 Gyr for complex)
  if (ageGyr > 0.5) {
    score += 0.10;
    factors.push('age-simple');
  }
  if (ageGyr > 2.0) {
    score += 0.10;
    factors.push('age-complex');
  }

  // 6. Right mass range? (0.5-5 Earth masses)
  if (massEarth > 0.5 && massEarth < 5.0) {
    score += 0.05;
    factors.push('mass-range');
  }

  return { score: Math.min(score, 1.0), factors };
}


// ═══════════════════════════════════════════════
// §8 STELLAR EVOLUTION
// ═══════════════════════════════════════════════

/**
 * Main-sequence lifetime for a star.
 * @param {string} starType - spectral class
 * @param {number} radiusSolar - radius in solar radii (proxy for mass)
 * @returns {number} main-sequence lifetime in Gyr
 */
export function mainSequenceLifetime(starType, radiusSolar) {
  // Mass-radius: M ≈ R^1.25 for main sequence (rough)
  const massSolar = Math.pow(radiusSolar, 1.25);
  // Lifetime: t ≈ 10 × M^(-2.5) Gyr
  return T_SUN_MS * Math.pow(massSolar, -2.5);
}

/**
 * Determine stellar evolution state.
 * @param {string} starType
 * @param {number} radiusSolar
 * @param {number} ageGyr
 * @returns {object} { evolved, remnantType, stage }
 */
export function stellarEvolution(starType, radiusSolar, ageGyr) {
  const msLifetime = mainSequenceLifetime(starType, radiusSolar);

  if (ageGyr < msLifetime) {
    return { evolved: false, remnantType: null, stage: 'main-sequence', msLifetime };
  }

  const massSolar = Math.pow(radiusSolar, 1.25);

  if (massSolar > 25) {
    return { evolved: true, remnantType: 'black-hole', stage: 'remnant', msLifetime };
  }
  if (massSolar > 8) {
    return { evolved: true, remnantType: 'neutron-star', stage: 'remnant', msLifetime };
  }

  // How far past MS lifetime?
  const postMS = ageGyr - msLifetime;
  const giantPhase = massSolar * 0.5; // rough giant branch duration in Gyr

  if (postMS < giantPhase) {
    return { evolved: true, remnantType: null, stage: 'red-giant', msLifetime };
  }

  return { evolved: true, remnantType: 'white-dwarf', stage: 'remnant', msLifetime };
}


// ═══════════════════════════════════════════════
// §9 BINARY STAR EFFECTS
// ═══════════════════════════════════════════════

/**
 * Calculate stability limit for circumbinary planets.
 * Planets inside this radius are unstable.
 * Holman & Wiegert 1999.
 * @param {number} binarySeparationAU
 * @param {number} massRatio - q = M2/M1
 * @param {number} eccentricity - binary eccentricity (usually ~0 for close binaries)
 * @returns {number} minimum stable orbit in AU
 */
export function binaryStabilityLimit(binarySeparationAU, massRatio, eccentricity = 0) {
  // Holman & Wiegert 1999 fit for P-type orbits:
  // a_crit ≈ a_bin × (1.60 + 5.10e - 2.22e² + 4.12μ - 4.27eμ - 5.09μ² + 4.61e²μ²)
  const mu = massRatio / (1 + massRatio); // reduced mass ratio
  const e = eccentricity;
  const factor = 1.60 + 5.10 * e - 2.22 * e * e
               + 4.12 * mu - 4.27 * e * mu
               - 5.09 * mu * mu + 4.61 * e * e * mu * mu;
  return binarySeparationAU * Math.max(factor, 2.0);
}

/**
 * Circumbinary habitable zone boundaries.
 * @param {number} luminosity1 - primary star luminosity (relative to Sun)
 * @param {number} luminosity2 - secondary star luminosity
 * @returns {object} { hzInnerAU, hzOuterAU }
 */
export function circumbinaryHZ(luminosity1, luminosity2) {
  const totalLum = luminosity1 + luminosity2;
  return {
    hzInnerAU: 0.95 * Math.sqrt(totalLum),
    hzOuterAU: 1.37 * Math.sqrt(totalLum),
  };
}


// ═══════════════════════════════════════════════
// §10 IMPACT HISTORY
// ═══════════════════════════════════════════════

/**
 * Compute surface history for a planet.
 * @param {number} ageGyr
 * @param {boolean} nearBelt - is there an asteroid belt nearby?
 * @param {boolean} nearGiant - is there a gas giant that stirs things up?
 * @param {boolean} hasAtmosphere
 * @param {number} tidalHeatingRate - from tidalHeating()
 * @returns {object} surface history
 */
export function computeSurfaceHistory(ageGyr, nearBelt, nearGiant, hasAtmosphere, tidalHeatingRate = 0) {
  // Late heavy bombardment: intense for first ~0.7 Gyr, then exponential decay
  let bombardment;
  if (ageGyr < 0.7) {
    bombardment = 0.8 + (0.7 - ageGyr) * 0.3; // intense early
  } else {
    bombardment = 0.3 * Math.exp(-(ageGyr - 0.7) * 0.5); // decaying
  }

  // Nearby belt increases impact rate
  if (nearBelt) bombardment *= 1.5;
  // Nearby giant stirs up asteroids → more impacts
  if (nearGiant) bombardment *= 1.3;

  bombardment = Math.min(bombardment, 1.0);

  // Erosion: atmosphere + water + time smooth surfaces
  const erosion = hasAtmosphere
    ? Math.min(1.0, ageGyr * 0.15)
    : Math.min(0.3, ageGyr * 0.03);

  // Resurfacing: volcanism/tectonics cover old craters
  const resurfacing = Math.min(1.0, tidalHeatingRate * 0.5 + (ageGyr < 3 ? 0.3 : 0.1));

  return {
    bombardmentIntensity: Math.max(0, bombardment - resurfacing * 0.5),
    erosionLevel: erosion,
    resurfacingRate: resurfacing,
  };
}


// ═══════════════════════════════════════════════
// §11 RING PHYSICS
// ═══════════════════════════════════════════════

/**
 * Roche limit — distance inside which tidal forces disrupt a body.
 * @param {number} planetRadiusEarth
 * @param {number} planetDensity - kg/m³ (or use default 5500 for rocky)
 * @param {number} moonDensity - kg/m³ of the disrupted body
 * @returns {number} Roche limit as multiple of planet radius
 */
export function rocheLimit(planetDensity = 5500, moonDensity = 2000) {
  // Roche limit for fluid body: R_roche = 2.44 × R_planet × (ρ_planet/ρ_moon)^(1/3)
  return 2.44 * Math.pow(planetDensity / moonDensity, 1 / 3);
}

/**
 * Generate physics-driven ring data.
 * @param {object} params
 * @param {string} params.origin - 'roche' | 'accretion' | 'collision' | 'captured'
 * @param {number} params.planetRadiusEarth
 * @param {number} params.planetDensity - kg/m³
 * @param {number} params.ageGyr - system age
 * @param {number} params.axialTilt - planet axial tilt
 * @param {Array} params.moons - moon data for gap calculation
 * @param {number} params.rngFloat1-5 - random values for variation
 * @returns {object} ring data
 */
export function generateRingPhysics(params) {
  const { origin, planetDensity = 5500, ageGyr,
          axialTilt = 0, moons = [],
          rngFloat1 = 0.5, rngFloat2 = 0.5, rngFloat3 = 0.5,
          rngFloat4 = 0.5, rngFloat5 = 0.5 } = params;

  // Composition based on origin
  let composition, moonDensity, color1, color2;
  switch (origin) {
    case 'roche':
      // Destroyed moon composition — 60% chance icy, 40% rocky
      if (rngFloat1 < 0.6) {
        composition = 'ice';
        moonDensity = 1200;
        color1 = [0.85, 0.88, 0.92]; // bright ice
        color2 = [0.70, 0.75, 0.82]; // blue-grey ice
      } else {
        composition = 'rock';
        moonDensity = 2800;
        color1 = [0.35, 0.33, 0.30]; // dark rock
        color2 = [0.25, 0.23, 0.22]; // darker rock
      }
      break;
    case 'accretion':
      composition = 'dust';
      moonDensity = 1800;
      color1 = [0.45, 0.40, 0.35]; // dusty brown
      color2 = [0.35, 0.30, 0.28]; // darker dust
      break;
    case 'collision':
      composition = 'mixed';
      moonDensity = 2200;
      color1 = [0.50, 0.48, 0.45]; // mixed debris
      color2 = [0.40, 0.35, 0.30]; // varied
      break;
    case 'captured':
      composition = 'dust';
      moonDensity = 1500;
      color1 = [0.40, 0.35, 0.25]; // sulfurous
      color2 = [0.50, 0.40, 0.20]; // yellowed
      break;
    default:
      composition = 'ice';
      moonDensity = 1500;
      color1 = [0.7, 0.7, 0.75];
      color2 = [0.5, 0.5, 0.55];
  }

  const roche = rocheLimit(planetDensity, moonDensity);

  // Inner edge: at or just outside Roche limit
  const innerRadius = roche * (0.95 + rngFloat2 * 0.15);

  // Outer edge: limited by innermost moon, or a reasonable max
  let outerRadius;
  const innerMoonOrbit = moons.length > 0
    ? Math.min(...moons.map(m => m.orbitRadiusEarth / (m.radiusEarth || 1))) // as multiple of planet radius
    : null;

  if (innerMoonOrbit && innerMoonOrbit > innerRadius + 0.5) {
    outerRadius = innerMoonOrbit * (0.85 + rngFloat3 * 0.1);
  } else {
    outerRadius = innerRadius + 0.5 + rngFloat3 * 1.5;
  }
  outerRadius = Math.max(outerRadius, innerRadius + 0.3);

  // Density vs age: young rings are dense, old rings are tenuous
  // Ring lifetime ~100-300 Myr for icy rings, longer for rocky
  const ringLifetimeMyr = composition === 'ice' ? 200 : 500;
  const ringAgeGyr = origin === 'accretion' ? ageGyr : rngFloat4 * ageGyr;
  const ageFactor = Math.exp(-ringAgeGyr * 1000 / ringLifetimeMyr);
  const density = 0.2 + 0.6 * ageFactor; // 0.2 = tenuous remnant, 0.8 = fresh dense

  // Gaps from moon resonances
  const gaps = [];
  const planetRE = params.planetRadiusEarth || 1;
  for (let i = 0; i < moons.length; i++) {
    const moonOrbitRE = moons[i]?.orbitRadiusEarth;
    if (!moonOrbitRE || !isFinite(moonOrbitRE) || moonOrbitRE <= 0) continue;
    const moonOrbitMult = moonOrbitRE / planetRE;

    // 2:1 resonance gap
    const gapRadius21 = moonOrbitMult * Math.pow(0.5, 2/3); // a where P_ring/P_moon = 1/2
    if (gapRadius21 > innerRadius && gapRadius21 < outerRadius) {
      gaps.push({ radius: gapRadius21, width: 0.02 + rngFloat5 * 0.03, moonIndex: i, resonance: '2:1' });
    }
    // 3:1 resonance gap
    const gapRadius31 = moonOrbitMult * Math.pow(1/3, 2/3);
    if (gapRadius31 > innerRadius && gapRadius31 < outerRadius) {
      gaps.push({ radius: gapRadius31, width: 0.01 + rngFloat5 * 0.02, moonIndex: i, resonance: '3:1' });
    }
  }

  // Ringlets: divide the ring into bands separated by gaps
  const ringlets = [];
  const sortedBoundaries = [innerRadius, ...gaps.map(g => g.radius).sort(), outerRadius];
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const inner = sortedBoundaries[i];
    const outer = sortedBoundaries[i + 1];
    if (outer - inner > 0.05) {
      ringlets.push({
        innerR: inner + 0.01,
        outerR: outer - 0.01,
        opacity: density * (0.7 + (rngFloat1 + i * 0.1) % 0.3),
        composition,
      });
    }
  }

  return {
    origin,
    composition,
    innerRadius,
    outerRadius,
    density,
    ringAgeGyr,
    gaps,
    ringlets,
    tiltX: axialTilt,
    tiltZ: 0,
    color1,
    color2,
  };
}


// ═══════════════════════════════════════════════
// §12 BELT PHYSICS
// ═══════════════════════════════════════════════

/**
 * Compute Kirkwood gap positions for a belt relative to a giant planet.
 * @param {number} giantOrbitAU - orbital distance of the perturbing giant
 * @returns {Array<{radiusAU, resonance}>} gap positions
 */
export function kirkwoodGaps(giantOrbitAU) {
  // Gap at orbital period ratio P_asteroid/P_giant = n/m
  // a_asteroid = a_giant × (n/m)^(2/3)
  const ratios = [
    { n: 1, m: 3, label: '3:1' },
    { n: 2, m: 5, label: '5:2' },
    { n: 3, m: 7, label: '7:3' },
    { n: 1, m: 2, label: '2:1' },
  ];

  return ratios.map(({ n, m, label }) => ({
    radiusAU: giantOrbitAU * Math.pow(n / m, 2 / 3),
    resonance: label,
    width: 0.02 + 0.01 * (m - n), // wider gaps for stronger resonances
  }));
}

/**
 * Compute composition zones for a belt.
 * @param {number} innerAU
 * @param {number} outerAU
 * @param {number} frostLineAU
 * @returns {Array<{innerAU, outerAU, type, albedo, color}>}
 */
export function beltCompositionZones(innerAU, outerAU, frostLineAU) {
  const zones = [];

  // S-type (silicate): inside frost line
  if (innerAU < frostLineAU) {
    zones.push({
      innerAU,
      outerAU: Math.min(outerAU, frostLineAU * 0.7),
      type: 's-type',
      albedo: 0.20,
      color: [0.50, 0.45, 0.40], // light grey-brown
    });
  }

  // Mixed zone: around frost line
  const mixInner = Math.max(innerAU, frostLineAU * 0.7);
  const mixOuter = Math.min(outerAU, frostLineAU * 1.3);
  if (mixInner < mixOuter) {
    zones.push({
      innerAU: mixInner,
      outerAU: mixOuter,
      type: 'mixed',
      albedo: 0.10,
      color: [0.35, 0.33, 0.32],
    });
  }

  // C-type (carbonaceous): beyond frost line
  if (outerAU > frostLineAU) {
    zones.push({
      innerAU: Math.max(innerAU, frostLineAU * 1.3),
      outerAU,
      type: 'c-type',
      albedo: 0.05,
      color: [0.15, 0.13, 0.12], // very dark
    });
  }

  return zones;
}

/**
 * Compute L4/L5 Lagrange point positions.
 * @param {number} giantOrbitAU
 * @param {number} giantAngle - current orbital angle
 * @returns {object} { L4: {AU, angle}, L5: {AU, angle} }
 */
export function lagrangePoints(giantOrbitAU, giantAngle = 0) {
  return {
    L4: { radiusAU: giantOrbitAU, angle: giantAngle + Math.PI / 3 },
    L5: { radiusAU: giantOrbitAU, angle: giantAngle - Math.PI / 3 },
  };
}

/**
 * Determine if a belt should exist based on system physics.
 * @param {Array} planets
 * @param {number} diskMass
 * @param {boolean} migrationOccurred
 * @param {number} frostLineAU
 * @returns {object|null} belt parameters or null
 */
export function shouldBeltExist(planets, diskMass, migrationOccurred, frostLineAU) {
  // Find gas giants
  const giants = [];
  for (let i = 0; i < planets.length; i++) {
    const t = planets[i].planetData.type;
    if (t === 'gas-giant' || t === 'sub-neptune') {
      giants.push({ index: i, orbitAU: planets[i].orbitRadiusAU, type: t });
    }
  }

  if (giants.length === 0) return null; // No giant → no belt

  // Migration scatters belt material
  if (migrationOccurred) return null;

  // Main belt: just inside the innermost giant
  const innerGiant = giants[0];
  // Belt sits where the giant's resonances prevent accretion
  const gaps = kirkwoodGaps(innerGiant.orbitAU);
  const beltOuterAU = gaps[gaps.length - 1]?.radiusAU || innerGiant.orbitAU * 0.7;
  // Inner edge: previous planet's orbit or a reasonable minimum
  const prevPlanetIdx = innerGiant.index - 1;
  const beltInnerAU = prevPlanetIdx >= 0
    ? planets[prevPlanetIdx].orbitRadiusAU * 1.1
    : innerGiant.orbitAU * 0.3;

  if (beltOuterAU <= beltInnerAU) return null;

  return {
    type: 'main',
    giantIndex: innerGiant.index,
    innerAU: beltInnerAU,
    outerAU: beltOuterAU,
    diskMass,
    gaps: gaps.filter(g => g.radiusAU > beltInnerAU && g.radiusAU < beltOuterAU),
    compositionZones: beltCompositionZones(beltInnerAU, beltOuterAU, frostLineAU),
  };
}

/**
 * Determine if an outer (Kuiper-like) belt should exist.
 * @param {Array} planets
 * @param {number} diskMass
 * @returns {object|null}
 */
export function shouldOuterBeltExist(planets, diskMass) {
  if (planets.length === 0) return null;

  // Find outermost gas giant
  let outermostGiant = null;
  for (const p of planets) {
    if (p.planetData.type === 'gas-giant') {
      if (!outermostGiant || p.orbitRadiusAU > outermostGiant.orbitRadiusAU) {
        outermostGiant = p;
      }
    }
  }

  if (!outermostGiant) return null;

  // Kuiper belt starts ~1.5× beyond outermost giant
  const innerAU = outermostGiant.orbitRadiusAU * 1.5;
  const outerAU = innerAU * 2.0;

  // Only if there's enough disk mass
  if (diskMass < 0.005) return null;

  return {
    type: 'kuiper',
    innerAU,
    outerAU,
    composition: 'ice',
    albedo: 0.04,
    color: [0.12, 0.11, 0.10], // very dark icy
  };
}
