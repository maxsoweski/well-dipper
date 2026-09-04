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
export const G = 6.674e-11;            // gravitational constant (m³/kg/s²)
const k_B = 1.381e-23;          // Boltzmann constant (J/K)
export const M_SUN = 1.989e30;         // solar mass (kg)
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
  if (type === 'ocean') {
    // ⛔ NOT the iron-silicate law below, and this is a CORRECTION, not a new feature: until
    // 2026-08-25 ocean worlds were priced as rock, so a 1.8 R⊕ "large water world" came out near
    // 7.9 M⊕ / 2.4 g — denser than Earth, which is the opposite of what a volatile world is.
    // Constant density 0.64x Earth's (≈3.5 g/cm³, a water-rock mix) rather than a fitted exponent,
    // so the law stays honest at both ends of the range instead of only at the anchor.
    // ANCHORED on the observed water-world point: 2.5 R⊕ ⇒ 0.64 · 2.5³ = 10.0 M⊕, which is the
    // ~10 M⊕ the mass-radius literature puts at that radius. At the new 3.0 ceiling: 17.3 M⊕, 1.9 g.
    return Math.pow(radiusEarth, 3.0) * 0.64;
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
  // NOTE (WS1, 2026-06-24): this is computeAtmosphere's OWN internal stripping proxy,
  // intentionally SEPARATE from the canonical surfaced planetData.magneticField (the
  // dynamo value computed in PlanetGenerator). This proxy uses a cruder lock test
  // (rotationSpeed<0.01, which is 0 for ANY locked body incl. 3:2-resonance) whereas
  // the surfaced dynamo value uses lockType==='synchronous'. Unifying them would change
  // 3:2-resonance atmosphere retention (a behavior change) — deferred cleanup, not WS1.
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

// Unit conversions for the planet (star-driven) tidal-heating case.
// Sun = 332,946 Earth masses; 1 AU = 23,454.8 Earth radii. These map a
// planet-around-star configuration onto the SAME Io-normalized formula above,
// so a planet's stellar tidal heating reads on the Io-moon scale (≈1 = Io).
const SUN_MASS_EARTH = 332946;
const AU_IN_EARTH_RADII = 23454.8;

/**
 * Tidal heating rate for a PLANET heated by its STAR (D12).
 * Same simplified Peale–Cassen–Reynolds law as tidalHeating() (Io-normalized),
 * with the parent = the star and the orbit measured from the star. Because the
 * law goes as 1/a⁵, distant/temperate orbits read ~0 and only close + eccentric
 * planets register heating — which is physically honest. A planet at Earth's
 * real eccentricity (≈0.017) and 1 AU returns ≈0.
 *
 * NOTE: our eccentricity model circularizes close-in orbits hard (e → 0), so
 * MOST generated planets correctly get ~0; nonzero heating requires retained
 * eccentricity at a close-enough orbit.
 * @param {number} eccentricity - orbital eccentricity
 * @param {number} starMassSolar - star mass in solar masses
 * @param {number} planetRadiusEarth - planet radius in Earth radii
 * @param {number} orbitAU - orbital distance from the star in AU
 * @returns {number} tidal heating rate (0 = none, 1 = Io-level, >1 = extreme)
 */
export function tidalHeatingPlanet(eccentricity, starMassSolar, planetRadiusEarth, orbitAU) {
  return tidalHeating(
    eccentricity,
    starMassSolar * SUN_MASS_EARTH,
    planetRadiusEarth,
    Math.max(orbitAU, 1e-6) * AU_IN_EARTH_RADII,
  );
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

// ═══════════════════════════════════════════════
// §3b SURFACE VOLATILE INVENTORY — the delivery law
// ═══════════════════════════════════════════════
//
// ⭐⭐ WHY THIS EXISTS. `deriveComposition` used to do TWO jobs with ONE field. `volatileFraction` was a
// pure function of `frostRatio = orbitAU / frostLineAU`, and `T_eq` is a function of THE SAME VARIABLE
// INVERTED — the frost line is by definition where ice survives. So "temperate" meant "well inside the
// frost line" meant "bone dry", BY CONSTRUCTION, and no body could ever be both. Measured over 1,183
// solid bodies from 200 seeds: the temperate set and the wet set did not intersect ONCE, and they missed
// by a wide margin both ways (wettest temperate body V = 0.0595 against the plate band's 0.12; warmest
// wet body T = 186 K against the band's 250 K). Run through the engine's own gate (labCore.js:693), of
// 135 temperate bodies 78.5 % sat at or under the bone-dry floor and ZERO read wet, while 26.7 % of all
// solid bodies DID read wet — every one of them frozen. A bimodal galaxy: hot deserts and cold ice.
// Full finding: docs/WORKSTREAMS/f1-mountains-generation-2026-09-04/REPORT.md.
//
// The old law is not wrong; it is INCOMPLETE. It models ACCRETED BULK ICE, which really is frost-line
// driven — that half is kept verbatim as `iceFraction` below and still feeds bulk density. What it has
// no term for is SURFACE VOLATILE INVENTORY: inside the frost line a terrestrial planet accretes
// essentially dry and then RECEIVES its water, delivered late from outer-system material scattered
// inward. Earth's water is ~0.02 % of its mass and arrived that way. That process is largely DECOUPLED
// from the body's own frost ratio, which is exactly what breaks the implication.
//
//   surfaceVolatiles = trace floor + (in-situ exposed ice  OR  delivered inventory × retention)
//
// ⛔ WHICH WAY THE RECONCILIATION GOES, AND WHY. The world engine anchors this field at Earth = 0.15 in
// three places (passiveMargins.js:54 MARGIN_VF0, labCore.js:693's bone-dry floor, the Rocky (Earthlike)
// preset) and driver-presets.js carries SIX measured real bodies on that scale. surfaceMaterial.js:347-367
// records a whole re-derivation of the oxidiser window against four of them, INCLUDING an explicitly
// REFUSED corpus-fitted alternative, with the reason written down: "Fitting the law to our own generator
// is how a world-generation defect becomes a palette law." The engine's scale is anchored on real bodies;
// the generator's ramp was anchored on nothing. So THE GENERATOR MOVES TO THE ENGINE — this file changes
// and src/worldengine/ does not.
//
// ⚠ HONESTY ABOUT THE RETENTION TERM. `RETAIN_LAM_*` gates a dimensionless group (M/R)/T normalised to
// Earth — the shape of the Jeans escape parameter λ = GMm/(kTR), gravity against thermal energy. It is
// NOT a claim that Jeans escape is the operating mechanism at every anchor: the Moon's absolute λ for
// water is ~26, comfortably above the ~20 where thermal escape stops mattering, and its dryness is really
// about never cold-trapping a surface inventory against sublimation and impact erosion over Gyr. The
// group is the right SHAPE for "can this body hold surface water", and the two edges are placed by the
// real bodies rather than by the mechanism. Named rather than hidden, in the idiom of the density
// comment above.

/** Trace inventory every rocky body keeps — mineral-bound water, sulfur. driver-presets.js puts Venus,
 *  the Moon/Mercury body and the Lava world all at exactly 0.02, so the floor IS the anchor.
 *  ⚠ A FLOOR, NOT AN ADDEND: adding it would push every icy body 0.02 past the frost-line law's own
 *  0.7 clamp and pile them up ON it. */
export const VOL_TRACE_FLOOR = 0.02;
/** Delivery scale, SOLVED (not chosen) from Earth: softCap(K·(1/4.85)^EXP · 1) = 0.15. */
export const DELIV_K = 1.331;
/** Radial growth of delivered inventory inside the frost line. Mars is wetter per unit mass than Earth
 *  because it formed nearer the snow line's inner edge, so delivery INCREASES outward; the exponent is
 *  SOLVED from the Earth/Mars pair (0.15 and 0.10 at their own retention) rather than picked. */
export const DELIV_RADIAL_EXP = 1.23;
/** ⭐ SUPPLY CEILING on the delivered inventory, and it is anchored, not chosen: the wettest ROCKY world
 *  in driver-presets.js is 'Ocean (temperate)' at 0.35. Past that a body is not a rock with an ocean,
 *  it is an ice body — and ice bodies come from the in-situ term, not this one.
 *  ⛔ APPLIED AS A SOFT ASYMPTOTE, never a hard min(). A hard cap makes an instrument that SATURATES:
 *  the first cut of this law put 34 of 1,183 bodies exactly ON the 0.7 clamp where the parent had zero,
 *  which is the same defect already logged as QB-23 (F13's outflow ramp saturating on 62 of 66 relict
 *  worlds). A saturated field cannot tell 0.7 from 3.0 and every consumer downstream reads the same
 *  number for both. */
export const DELIV_MAX = 0.38;
/** Log-spread of the stochastic draw. Delivery is a FEW large impactors, so its variance is large — that
 *  variance is what turns a monotone dial into "a wide variety of physically-plausible worlds" (Max,
 *  2026-09-04). ±1σ spans ×0.39 … ×2.59. */
export const DELIV_SIGMA = 0.95;
/** solidInventoryOf(1, 0.01 + 0.04·10^0) at solar metallicity — the normaliser, so the Solar System's
 *  own anchors sit at proxy 1.0 and are untouched by the system terms. */
export const SOLAR_SOLID_INVENTORY = 0.05;
/** Runaway-greenhouse / hydrodynamic loss window. Venus (737 K) must land ON the trace floor; Earth
 *  (288 K) and Mars (210 K) must be untouched by it. */
export const RETAIN_T_LO = 320, RETAIN_T_HI = 500;
/** The gravity-against-temperature window, SOLVED from the Moon/Mars pair — the two anchors 25 K apart
 *  that a temperature gate alone cannot separate (Moon 0.02, Mars 0.10 at λ_norm 0.129 vs 0.277). */
export const RETAIN_LAM_LO = 0.07, RETAIN_LAM_HI = 0.55;
/** (M/R)/T at Earth — the normaliser for the retention group. */
export const LAMBDA_EARTH = 1 / 288;
/** Where in-situ accreted ice takes over from delivery as the surface inventory. The two ramps are
 *  complementary by construction, so the hand-off across the frost line conserves nothing twice. */
export const INSITU_LO = 0.6, INSITU_HI = 1.0;

const _clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const _smoothstep = (a, b, x) => { const t = _clamp(0, 1, (x - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * Surface volatile inventory — what a body actually has available as water, on the world engine's
 * real-body scale (Earth 0.15, Mars 0.10, Venus 0.02, Moon/Mercury 0.02, Titan 0.40, Europa 0.50).
 *
 * SEPARATE FROM `iceFraction`, which is the accreted BULK ice the body is made of and which still
 * drives density. ⛔ Do not merge them: MoonGenerator.js:266 derives `moon.massEarth` FROM
 * `composition.density`, and checkTidalLock reads that mass, so moving density re-rolls every moon's
 * `locked` flag — the very first thing writeBodyRelief's dispatch tests.
 *
 * @param {object} a
 * @param {number} a.iceFraction     accreted bulk ice fraction (the frost-line law's output)
 * @param {number} a.frostRatio      orbitAU / frostLineAU
 * @param {number} a.massEarth       body mass in Earth masses
 * @param {number} a.radiusEarth     body radius in Earth radii
 * @param {number} a.T_eq            equilibrium temperature, K
 * @param {number} a.metallicity     system [Fe/H] — the giant-planet scatterer proxy
 * @param {number} a.solidInventory  system solid reservoir (StarSystemGenerator zones.solidInventory)
 * @param {number} a.deliveryFloat   [0,1) stochastic draw, from a NAMESPACED sub-seed (never the shared stream)
 * @returns {number} surface volatile inventory, [0, 0.7]
 */
export function surfaceVolatileInventory({
  iceFraction, frostRatio, massEarth, radiusEarth, T_eq,
  metallicity = 0, solidInventory = SOLAR_SOLID_INVENTORY, deliveryFloat = 0.5,
}) {
  // ── (i) IN-SITU. Beyond the frost line the accreted ice IS the surface — Europa and Titan are made of
  //    the stuff. Inside it, whatever ice accreted is negligible and buried, so this ramps to zero.
  const exposed = _smoothstep(INSITU_LO, INSITU_HI, frostRatio);
  const inSitu = iceFraction * exposed;

  // ── (ii) DELIVERED. Late accretion of volatile-rich planetesimals scattered inward from beyond the
  //    frost line. A SYSTEM-level process, weakly dependent on the receiving body's own orbit, and it
  //    hands off to (i) across the frost line rather than adding to it (`1 - exposed`).
  //
  //    Two system inputs, and BOTH ALREADY EXIST on `zones` — `metallicity`, and `solidInventory`
  //    (StarSystemGenerator.js:467), which has been computed and marked "UNREAD BY DESIGN (plan B3)"
  //    since it was written. This is its first reader.
  //
  //    ⚠ THE METALLICITY EXPONENT IS DELIBERATELY SOFTENED TO 1. Fischer & Valenti (2005) put giant-planet
  //    OCCURRENCE at ∝ 10^(2·[Fe/H]), but `solidFraction` (PhysicsEngine.js:608, 0.01 + 0.04·10^Z) already
  //    carries a metallicity channel into `solidInventory`, so the published exponent here would
  //    double-count it. What this term needs is SCATTERING EFFICIENCY, which is sub-linear in occurrence
  //    anyway. 1.0 is the conservative half of that range, recorded as softened rather than presented as
  //    the published figure.
  //
  //    ⛔ THE TWO PROXIES ARE COMBINED AS A GEOMETRIC MEAN, NOT MULTIPLIED. They are two readings of ONE
  //    quantity — how much volatile-rich material this system had to throw inward — and they are strongly
  //    CORRELATED, because `solidFraction` is itself a function of metallicity. Multiplying them squares
  //    the metallicity dependence: the first cut of this law did exactly that and gave the system term a
  //    19× range, which is what drove bodies onto the clamp. The geometric mean is the honest way to
  //    average two correlated estimates of one number.
  const giantProxy     = _clamp(0.2, 3.0, Math.pow(10, metallicity));
  const inventoryProxy = _clamp(0.3, 2.5, solidInventory / SOLAR_SOLID_INVENTORY);
  const systemDelivery = _clamp(0.25, 2.5, Math.sqrt(giantProxy * inventoryProxy));
  //    Median 1.0 at deliveryFloat 0.5, so the six real-body anchors are solved at the median draw.
  const draw   = Math.exp(DELIV_SIGMA * (2 * deliveryFloat - 1));
  const radial = Math.pow(Math.min(frostRatio, 1.0), DELIV_RADIAL_EXP);
  const delivered = DELIV_K * radial * (1 - exposed) * systemDelivery * draw;

  // ── (iii) RETAINED — applied to the DELIVERED inventory only. In-situ ice is structural: a body made
  //    of ice does not lose itself. A delivered veneer can be lost, by two channels.
  const thermalKeep = 1 - _smoothstep(RETAIN_T_LO, RETAIN_T_HI, T_eq);        // runaway greenhouse (Venus)
  const lambdaNorm  = (massEarth / Math.max(radiusEarth, 1e-3)) / Math.max(T_eq, 1) / LAMBDA_EARTH;
  const gravityKeep = _smoothstep(RETAIN_LAM_LO, RETAIN_LAM_HI, lambdaNorm);   // the Moon/Mars separation
  const retained    = thermalKeep * gravityKeep;

  //    The supply ceiling applies to what the body actually KEPT, not to what was aimed at it, and it
  //    approaches DELIV_MAX asymptotically so no population piles up on an edge.
  const kept = DELIV_MAX * (1 - Math.exp(-(delivered * retained) / DELIV_MAX));

  return _clamp(0, 0.7, Math.max(VOL_TRACE_FLOOR, inSitu + kept));
}

/**
 * Derive planetary composition from star's metallicity and orbital distance.
 * @param {number} metallicity - [Fe/H]
 * @param {number} orbitAU
 * @param {number} frostLineAU
 * @param {number} rngFloat - random float 0-1 for scatter
 * @param {object|null} [body] - the body bundle the SURFACE volatile law (§3b) needs. Optional, and
 *   its absence is a DECLARED fallback rather than a default: without mass/radius/T_eq the retention
 *   term cannot be computed, so `volatileFraction` degrades to `iceFraction` — exactly the pre-split
 *   behaviour — instead of being fabricated from assumed Earth values. Both shipped call sites pass it.
 * @param {number} [body.massEarth] - body mass. OMIT on the moon path: `moon.massEarth` is derived FROM
 *   `composition.density`, so passing it there would be circular; the fallback below reproduces the
 *   same expression from radius and density.
 * @param {number} [body.radiusEarth]
 * @param {number} [body.T_eq]
 * @param {number} [body.solidInventory] - zones.solidInventory, the system's solid reservoir
 * @param {number} [body.deliveryFloat] - [0,1) from a NAMESPACED hash, never the shared rng stream
 * @returns {object} composition properties — { carbonToOxygen, ironFraction, iceFraction,
 *   volatileFraction, surfaceType, density }. ⭐ `iceFraction` is ACCRETED BULK ICE (feeds density);
 *   `volatileFraction` is the SURFACE inventory (feeds the world engine's ~80 read sites). They were
 *   one field until 2026-09-04; see §3b for the measurement that forced them apart.
 */
export function deriveComposition(metallicity, orbitAU, frostLineAU, rngFloat, body = null) {
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

  // ACCRETED BULK ICE: distance from star during formation.
  // Beyond frost line: volatile-rich (icy). Inside: dry.
  //
  // ⭐ THIS LAW IS UNCHANGED — same three buckets, same coefficients, same clamp. What changed is its
  // NAME and its job. It used to be called `volatileFraction` and carried two meanings at once; it is
  // now `iceFraction` and carries only the one it was always right about, the bulk ice a body accreted
  // where it formed. It still feeds bulk density and the ice-rock surface classification, and it is
  // still what makes Europa and Titan icy. The SURFACE inventory is a separate law (§3b above), because
  // inside the frost line water is DELIVERED rather than accreted. See §3b's header for the measurement
  // that forced the split.
  const frostRatio = orbitAU / Math.max(frostLineAU, 0.01);
  let iceFraction;
  if (frostRatio < 0.5) {
    iceFraction = 0.01 + rngFloat * 0.05; // bone dry
  } else if (frostRatio < 1.0) {
    iceFraction = 0.05 + (frostRatio - 0.5) * 0.4 + rngFloat * 0.1; // transitioning
  } else {
    iceFraction = 0.25 + Math.min(frostRatio - 1.0, 2.0) * 0.15 + rngFloat * 0.1; // volatile-rich
  }
  iceFraction = Math.min(iceFraction, 0.7);

  // Surface type
  let surfaceType;
  if (carbonToOxygen > 0.8) {
    surfaceType = 'carbon';
  } else if (ironFraction > 0.45) {
    surfaceType = 'iron-rich';
  } else if (iceFraction > 0.4) {   // a bulk-composition class, so it reads the bulk field
    surfaceType = 'ice-rock';
  } else {
    surfaceType = 'silicate';
  }

  // Bulk density (kg/m³) — a two-component ice/rock VOLUMETRIC mixture.
  //
  // ⚠ THIS WAS `3500 + iron*5000 - volatileFraction*2000` — the WRONG MIXING RULE, and it made the
  // whole ice/rock axis of the generator unreachable. Densities do not mix by mass-weighted average;
  // VOLUMES add, so the bulk density of a mixture is the harmonic mean of the component densities
  // weighted by mass fraction:  1/rho = f_ice/rho_ice + (1 - f_ice)/rho_rock.
  //
  // Ice is ~5x less dense than rock, so 6% ice BY MASS is already ~25% of the body BY VOLUME. The old
  // linear form could not express that: brute-forced over the entire input domain (metallicity -1..0.6,
  // orbit 0.05..40 AU, every rng draw) its minimum output was 2.86 g/cc, and over a realistic population
  // it never once fell below 3.5 g/cc. Real icy bodies sit at 1.6-2.0 (Enceladus 1.61, Pluto 1.85,
  // Titan 1.88, Ganymede 1.94). The generator therefore had NO icy bodies in it at all, whatever the
  // volatile budget said — a body 43% ice by mass still came out at 4.04 g/cc, denser than the Moon.
  //
  // Consequence that surfaced this: the world engine's `icenessOf(cond)` reads density against
  // DENS_ICE_HI 2.0 / DENS_ROCK_LO 3.5, so it measured 0.000 on all 330 bodies of a swept population —
  // the icy gate had never opened for any planet in the game. That gate drives the bombardment
  // ice-relaxation term and the surface ice albedo, so this is not a HUD cosmetic.
  //
  // Dry inner bodies barely move (vf 0.01, iron 0.28: 4880 -> 4717 kg/m^3, -3%), which is the point —
  // the rule only diverges where the old one was lying. Mass, gravity, escape velocity and atmosphere
  // retention do NOT read this field (estimateMassEarth is a pure mass-radius relation), so the change
  // is confined to the surfaced planetDensity and the world-engine condition vector.
  //
  // ⛔⛔ THIS READS `iceFraction`, THE BULK FIELD, AND IT MUST. MoonGenerator.js:266 derives
  // `moon.massEarth` FROM this density, and checkTidalLock reads that mass, so `tidalState.locked` is
  // downstream of this line — and `locked` is the FIRST thing writeBodyRelief's dispatch tests. Pointing
  // this at the surface inventory instead would re-roll every moon's mass and lock state in the galaxy,
  // and would drop an Earth analogue from ~4870 to ~3090 kg/m³, under surfaceMaterial.js's DENS_ROCK_LO
  // of 3.5 g/cc, so Earth analogues would start reading partly ICY. That is the whole reason the field
  // is split rather than rescaled.
  const ICE_DENSITY = 1000;   // kg/m^3 — water ice, standing in for the whole volatile inventory
  const rockDensity = 3500 + ironFraction * 5000;   // the silicate + iron trend, unchanged
  const specificVolume = iceFraction / ICE_DENSITY + (1 - iceFraction) / rockDensity;
  const density = Math.max(1000, Math.min(8000, 1 / specificVolume));

  // ── SURFACE VOLATILE INVENTORY (§3b) ────────────────────────────────────────────────────────────
  // ⚠ FALLBACK, STATED RATHER THAN INVENTED: retention needs the body's own mass, radius and T_eq. The
  // two shipped call sites always pass them (PlanetGenerator.js, MoonGenerator.js); the 4-argument test
  // call sites do not, and for those the surface inventory degrades to the accreted ice — i.e. exactly
  // the pre-split behaviour — rather than being fabricated from assumed Earth values.
  const radiusEarth = body?.radiusEarth;
  const T_eq = body?.T_eq;
  const massEarth = body?.massEarth ?? (radiusEarth != null ? radiusEarth ** 3 * (density / 5514) : null);
  const volatileFraction = (massEarth != null && radiusEarth != null && T_eq != null)
    ? surfaceVolatileInventory({
        iceFraction, frostRatio, massEarth, radiusEarth, T_eq,
        metallicity, solidInventory: body.solidInventory, deliveryFloat: body.deliveryFloat,
      })
    : iceFraction;

  return { carbonToOxygen, ironFraction, iceFraction, volatileFraction, surfaceType, density };
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
  // Disk mass: solid fraction of star mass, scaled by metallicity (median ~1-5%, metal-boosted).
  // ⚠ `solidFraction` is half of the B3 solid-supply seam — §13 `solidInventoryOf` says why that
  const solidFraction = 0.01 + 0.04 * Math.pow(10, metallicity);
  const diskMass = starMassSolar * solidFraction * (0.5 + rngFloat1);
  // seam is NOT a key on this return. ⛔ `diskMass` and `dissipationMyr` are REFUSED as
  // body-generation inputs: `starMassSolar` cancels out of BOTH archetype clauses below (:608
  // and :610 each compare a multiple of it against a multiple of it), so `archetype` is decided
  // by `dissipationMyr` alone — a bare uniform. Short → no giants → compact rocky; long → spread.
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
    ? Math.min(...moons.map(m => m.orbitRadiusEarth / (params.planetRadiusEarth || 1))) // as multiple of planet radius
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

  // Gaps from moon resonances, and the ringlets they partition the disk into.
  // ⭐ EXTRACTED to deriveRingStructure below, 2026-08-27, and called here with whatever moons the
  // caller had — which at PlanetGenerator.js's call site is [] , because moons do not exist yet at
  // that point in generation. That is why every generated ring has had ZERO gaps and exactly ONE
  // ringlet: measured 0 gaps on 33/33 ringed planets across 60 systems. The extraction exists so
  // StarSystemGenerator can RE-DERIVE the structure once the moon list is real, WITHOUT drawing a
  // single new random number — see that function's header.
  const { gaps, ringlets } = deriveRingStructure({
    innerRadius, outerRadius, density, composition, moons,
    planetRadiusEarth: params.planetRadiusEarth, rngFloat1, rngFloat5,
  });

  // ⛔⛔ THE TWO DRAWS ARE CARRIED ON THE RESULT NON-ENUMERABLY, AND BOTH HALVES OF THAT MATTER.
  // CARRIED, because re-deriving the ring structure once moons exist needs the SAME two random
  // values this call already consumed — StarSystemGenerator reads them back and passes them to
  // deriveRingStructure, which therefore draws NOTHING. Re-drawing there instead would reorder every
  // rng draw after this point and move every body in the corpus.
  // NON-ENUMERABLY, because `planetData` is hashed key-by-key by the body-identity fence
  // (tests/body-identity-fence.test.js `planetRecord` walks Object.keys), and two plumbing fields
  // appearing on all 33 ringed planets would move the corpus rollup for a reason that has nothing to
  // do with what the rings actually look like. Hidden from Object.keys, they are hidden from the
  // hash and from JSON serialisation, so the ONLY thing that moves the rollup is the gap/ringlet
  // structure itself — which is the change we actually made, on the 9 planets that actually have a
  // shepherding moon. An unattributable hash movement is a re-bless nobody can check.
  const out = {
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
  Object.defineProperty(out, '_rngFloat1', { value: rngFloat1, enumerable: false, writable: false });
  Object.defineProperty(out, '_rngFloat5', { value: rngFloat5, enumerable: false, writable: false });
  return out;
}


/**
 * The gap + ringlet structure of a ring, derived from its bounds and the moons that shepherd it.
 *
 * ⭐⭐ PURE, AND DRAWS NOTHING. Every random input it needs (`rngFloat1`, `rngFloat5`) is passed in,
 * already drawn. That is what lets StarSystemGenerator call it a SECOND time once a planet's moons
 * exist, without reordering the rng stream — and the rng stream is load-bearing: reordering it moves
 * every body in the corpus, which `npm run test:body-identity` pins.
 *
 * WHY IT HAS TO BE CALLED TWICE. Resonance gaps are a function of MOON ORBITS, and
 * `PlanetGenerator.js` generates rings BEFORE moons — its own call site says so
 * (`moons: []  // moons not generated yet at this point`). So the first call produces the honest
 * answer for "no moons": zero gaps, one ringlet spanning the disk. Measured across 60 systems, that
 * is what all 33 ringed planets got, and it is why the renderer has never had a gap to draw.
 *
 * @param {object}   p
 * @param {number}   p.innerRadius       inner edge, in planet radii
 * @param {number}   p.outerRadius       outer edge, in planet radii
 * @param {number}   p.density           age-derived opacity, 0.2 (tenuous remnant) .. 0.8 (fresh)
 * @param {string}   p.composition       'ice' | 'rock' | 'dust' | 'mixed'
 * @param {Array}    p.moons             moon records carrying `orbitRadiusEarth`; [] is legal
 * @param {number}   p.planetRadiusEarth the parent's radius, to put moon orbits in planet radii
 * @param {number}   p.rngFloat1         pre-drawn, varies ringlet opacity
 * @param {number}   p.rngFloat5         pre-drawn, varies gap width
 * @returns {{gaps: Array, ringlets: Array}}
 */
export function deriveRingStructure({
  innerRadius, outerRadius, density, composition,
  moons = [], planetRadiusEarth, rngFloat1 = 0, rngFloat5 = 0,
}) {
  const gaps = [];
  const planetRE = planetRadiusEarth || 1;
  for (let i = 0; i < moons.length; i++) {
    const moonOrbitRE = moons[i]?.orbitRadiusEarth;
    if (!moonOrbitRE || !isFinite(moonOrbitRE) || moonOrbitRE <= 0) continue;
    const moonOrbitMult = moonOrbitRE / planetRE;

    // 2:1 resonance gap
    const gapRadius21 = moonOrbitMult * Math.pow(0.5, 2 / 3); // a where P_ring/P_moon = 1/2
    if (gapRadius21 > innerRadius && gapRadius21 < outerRadius) {
      gaps.push({ radius: gapRadius21, width: 0.02 + rngFloat5 * 0.03, moonIndex: i, resonance: '2:1' });
    }
    // 3:1 resonance gap
    const gapRadius31 = moonOrbitMult * Math.pow(1 / 3, 2 / 3);
    if (gapRadius31 > innerRadius && gapRadius31 < outerRadius) {
      gaps.push({ radius: gapRadius31, width: 0.01 + rngFloat5 * 0.02, moonIndex: i, resonance: '3:1' });
    }
  }

  // Ringlets: the bands between the gaps.
  // ⚠ THE COMPARATOR IS NEW AND IT IS A LATENT-BUG FIX, NOT A BEHAVIOUR CHANGE. This was a bare
  // `.sort()`, which sorts NUMBERS AS STRINGS — '10.2' sorts before '2.3'. It has never bitten,
  // because every gap radius lies inside [innerRadius, outerRadius] and the widest ring measured in
  // the corpus reaches 5.60 planet radii, so every value is a single digit and string order happens
  // to equal numeric order. It bites the moment a ring passes 10 planet radii. Bounded today,
  // unbounded in principle, and free to fix while the code is being moved.
  const ringlets = [];
  const sortedBoundaries = [innerRadius, ...gaps.map((g) => g.radius).sort((a, b) => a - b), outerRadius];
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
  return { gaps, ringlets };
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


// ═══════════════════════════════════════════════
// §13 GENERATION-CONTEXT PROVENANCE
// ═══════════════════════════════════════════════
//
// Appended at EOF deliberately. Every other section of this file is cited by line
// number from docs/, tests/ and tools/ (118 refs at the time of writing, the
// deepest at :912), so a new section anywhere ABOVE this point moves refs that
// are not part of this step's budget. Nothing cites past :1152.

/**
 * The scatter-free solid supply of a protoplanetary disk, in solar masses.
 *
 * `deriveFormation` computes `starMassSolar × solidFraction × (0.5 + rngFloat1)` and calls it
 * `diskMass`. This is the same product with the scatter factor removed — a deterministic function
 * of the star's mass and its metallicity alone, which is what a channel law can be conditioned on
 * without laundering a dice roll. It is the B3 seam: NOTHING READS IT YET, by design.
 *
 * ⛔ IT IS NOT A KEY ON `deriveFormation`'s RETURN, and the plan that scheduled this step said it
 * could be. That was checked and is false: `src/generation/__tests__/componentSystems.byteSafety.test.js:98`
 * deep-equals the WHOLE authored system record — `systemData.formation` included — against
 * `docs/WORKSTREAMS/multistar-components-2026-07-19/authored-parent-baseline.json`, and it asserts
 * in so many words that `componentSystems` is the ONLY delta against the pre-increment capture.
 * Measured: adding the key turns that test red with a one-line diff, `+ "solidInventory": …`.
 * Re-capturing the fixture is a re-bless, so the seam is derived at the CONSUMER instead
 * (`StarSystemGenerator.js:464`, onto `zones`), which is where every channel law reads it anyway
 * and which changes no stored record at all.
 *
 * @param {number} starMassSolar
 * @param {number} solidFraction - `deriveFormation(...).solidFraction`
 * @returns {number} solid mass available to build bodies, in solar masses
 */
export function solidInventoryOf(starMassSolar, solidFraction) {
  return starMassSolar * solidFraction;
}

/**
 * Mass of a white dwarf, in solar masses.
 *
 * ⚠ AN ANCHOR, NOT A DERIVATION, and it is stated that way on purpose. The
 * observed field white-dwarf mass distribution peaks near 0.6 M☉ and is narrow;
 * this constant is that peak, rounded. It is NOT read off `radiusSolar`, because
 * for a degenerate star the mass–radius relation is INVERTED (more massive ⇒
 * smaller) and `StarSystemGenerator`'s ±15% `starVariation` on `radiusSolar` is a
 * main-sequence idiom with no degenerate meaning — feeding it through an inverted
 * relation would make a bigger white dwarf lighter, which is worse than a constant.
 *
 * ⚠ The shipped `STAR_PROPERTIES.D` row is modelled on Sirius B, which is ~1.0 M☉
 * — unusually heavy for a white dwarf. The row's radius therefore describes Sirius
 * B while this mass describes the population. Named rather than hidden; a future
 * step that wants per-star white-dwarf masses should take them from the catalog,
 * not from this file.
 */
export const WHITE_DWARF_MASS_SOLAR = 0.6;

/**
 * The star's PHYSICAL mass, guarding the one spectral class where the shipped
 * main-sequence estimate is not merely imprecise but qualitatively wrong.
 *
 * THE HAZARD. `StarSystemGenerator.js:386` derives `starMassSolar` as
 * `radiusSolar ** 1.25`. `STAR_PROPERTIES.D` carries `radiusSolar: 0.01`, so a
 * white dwarf comes out at 0.01 ** 1.25 ≈ 0.0032 M☉ — roughly 1/200 of its true
 * mass, and small enough that anything keyed on stellar mass (tidal locking,
 * circularisation, Hill radii, orbital periods) reads as effectively zero. It is
 * silent: nothing throws, nothing warns, the number is simply wrong.
 *
 * ⛔ THIS IS A GUARD, NOT A SWITCH-OVER. `zones.starMassSolar` still carries the
 * main-sequence estimate, byte-for-byte, and this value rides alongside it as
 * `zones.starMassSolarPhysical`. The reason is that `starMassSolar` is consumed by
 * `PlanetGenerator.js:391` INSIDE a seed string (`ecc:…:${starMassSolar}:…`) as well
 * as by `:396`, `:406` and `:408`, so correcting the number in place would move
 * every planet of every white-dwarf-primary system. Procgen can never roll 'D'
 * (it is absent from `STAR_WEIGHTS`), so those systems are exactly the ones NO
 * instrument corpus covers: the "fix" would read green on all four instruments
 * while silently moving real-universe bodies. That move gets predicted and taken
 * in the window, not smuggled in under a step whose whole claim is zero motion.
 *
 * @param {string} starType - a STAR_PROPERTIES key ('O'…'M', or 'D')
 * @param {number} mainSequenceEstimateSolar - `radiusSolar ** 1.25`
 * @returns {number} mass in solar masses
 */
export function physicalStarMassSolar(starType, mainSequenceEstimateSolar) {
  if (starType === 'D') return WHITE_DWARF_MASS_SOLAR;
  return mainSequenceEstimateSolar;
}

/**
 * Whether a body was generated against a real system context or against defaults.
 *
 * WHY THIS EXISTS. `MoonGenerator.generate` takes `zones` and `parentOrbitAU` as
 * optional 6th/7th arguments and falls back to Sol-ish constants when they are
 * absent — `zones?.luminosity ?? 1.0`, `zones?.frostLine ?? 4.85`,
 * `Math.max(parentOrbitAU ?? 1.0, 0.01)`. Three of its four call sites pass 4 or 6
 * arguments (`tests/moon-mass-radius-consistency.test.js:37` passes four), so those
 * bodies are generated at an implicit 1 AU around an implicit Sun and NOTHING ON
 * THE RECORD SAYS SO. That is the failure shape `world-engine-reconciliations`
 * §1 catalogues: a missing context value silently substituting Sol/Earth.
 *
 * THE MECHANISM. The PRODUCER stamps its own product: `StarSystemGenerator` writes
 * `contextSource: 'derived'` onto the `zones` literal it builds. Absence therefore
 * means "no real context reached this body", and no consumer has to re-derive the
 * question from the shape of its own arguments.
 *
 * ⚠ NOT YET ON ANY BODY RECORD, and that is a constraint rather than an oversight.
 * `tests/body-identity-fence.test.js:778` asserts the moon record has exactly one
 * shape per class (`keyCounts: [25]` / `[20]`); appending a 26th key is a record
 * change that must be predicted and re-blessed, which is B4/B5's budget, not B3's.
 * What lands here is the seam and its single source of truth.
 *
 * @param {object|null} zones - the system context, or null/undefined
 * @returns {'derived'|'default'}
 */
export function contextSourceOf(zones) {
  return zones?.contextSource === 'derived' ? 'derived' : 'default';
}
