import { earthRadiiToScene, EARTH_RADIUS_AU, AU_TO_SCENE } from '../core/ScaleConstants.js';
import { PlanetGenerator } from './PlanetGenerator.js';
import { realisticOrbitSpeed as orb } from '../core/CelestialTime.js';
import { tidalHeating as tidalHeatingFn, equilibriumTemperature, tidalLockTimescale, checkTidalLock, deriveComposition, computeSurfaceHistory } from './PhysicsEngine.js';
import { SeededRandom } from './SeededRandom.js';

/**
 * Parent types massive enough to count as "a giant" for a moon.
 *
 * THE CRITERION IS PARENT MASS, NOT SHADER FAMILY OR NAME. `nearGiant` exists in
 * `computeSurfaceHistory` (PhysicsEngine.js:808 `if (nearGiant) bombardment *= 1.3;`) because a massive neighbour
 * gravitationally focuses impactors and stirs planetesimals — both scale with mass.
 * Measured against this repo's own mass model (RADIUS_RANGES_EARTH × estimateMassEarth),
 * the 18 planet types split with a clean gap and nothing inside it:
 *   every EXCLUDED type tops out at  7.92 M⊕  (largest: ocean / ecumenopolis, 1.8 R⊕)
 *   every INCLUDED type starts at   12.82 M⊕  (smallest: sub-neptune, 2.5 R⊕)
 * sub-neptune is in because Neptune-class IS a giant planet and is the Solar System's
 * canonical planetesimal stirrer; hot-jupiter is in because it is the most massive type
 * in the table (65–272 M⊕).
 *
 * ⛔ NOT `GAS_TYPES` (src/objects/Planet.js:1422). That set includes `eyeball` and is
 * consumed at :1473 to pick a SHADER FAMILY — it is defined by what to draw, not by what
 * the body weighs. An eyeball is a tidally-locked terrestrial (0.8–1.3 R⊕, ≤2.38 M⊕),
 * ~100× too light to focus impactors.
 *
 * This is the same three-type set `_pickRadius` already tested for inline; it is hoisted
 * here so the two sites cannot drift apart.
 */
const GIANT_PARENT_TYPES = new Set(['gas-giant', 'hot-jupiter', 'sub-neptune']);

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
      { base: [0.06, 0.06, 0.06], accent: [0.28, 0.28, 0.30] },    // Carbonaceous (C-type asteroid)
      { base: [0.10, 0.08, 0.12], accent: [0.32, 0.28, 0.35] },    // Dark purple-gray (Phoebe-like)
      { base: [0.15, 0.10, 0.06], accent: [0.40, 0.32, 0.18] },    // Reddish iron-rich (D-type)
      { base: [0.09, 0.10, 0.08], accent: [0.30, 0.35, 0.28] },    // Greenish-gray (olivine-rich)
    ],
    rocky: [
      { base: [0.55, 0.53, 0.50], accent: [0.22, 0.20, 0.18] },    // Light highlands + dark maria
      { base: [0.50, 0.45, 0.42], accent: [0.18, 0.16, 0.15] },    // Moon-gray + deep shadow
      { base: [0.48, 0.40, 0.35], accent: [0.20, 0.18, 0.16] },    // Brown highland + dark basin
      { base: [0.60, 0.58, 0.55], accent: [0.25, 0.22, 0.20] },    // Bright highland (like lunar farside)
      { base: [0.42, 0.38, 0.35], accent: [0.65, 0.60, 0.55] },    // Dark maria + bright rays (inverted)
      { base: [0.52, 0.42, 0.32], accent: [0.22, 0.18, 0.14] },    // Warm brown (Callisto-like)
      { base: [0.45, 0.45, 0.50], accent: [0.18, 0.18, 0.22] },    // Blue-gray basalt (Mercury-like)
      { base: [0.55, 0.48, 0.40], accent: [0.28, 0.22, 0.15] },    // Sandy highland + dark floor
      { base: [0.38, 0.35, 0.38], accent: [0.58, 0.55, 0.58] },    // Slate + bright ejecta
    ],
    ice: [
      { base: [0.85, 0.88, 0.92], accent: [0.30, 0.40, 0.55] },    // Bright ice + deep blue cracks
      { base: [0.90, 0.90, 0.95], accent: [0.40, 0.50, 0.65] },    // Brilliant white + teal cracks
      { base: [0.70, 0.75, 0.82], accent: [0.25, 0.35, 0.50] },    // Blue-gray ice + dark fissures
      { base: [0.92, 0.90, 0.88], accent: [0.45, 0.38, 0.30] },    // Bright Enceladus (warm cracks)
      { base: [0.78, 0.80, 0.85], accent: [0.35, 0.42, 0.55] },    // Europa blue-white
      { base: [0.65, 0.62, 0.55], accent: [0.35, 0.30, 0.22] },    // Dirty ice (Ganymede-like)
      { base: [0.75, 0.78, 0.72], accent: [0.28, 0.32, 0.25] },    // Green-tinted ice (tholins)
      { base: [0.82, 0.85, 0.90], accent: [0.50, 0.55, 0.70] },    // Pale blue + lavender cracks
      { base: [0.72, 0.68, 0.60], accent: [0.40, 0.35, 0.28] },    // Titan-like (icy + organic haze)
    ],
    volcanic: [
      { base: [0.75, 0.65, 0.20], accent: [0.12, 0.08, 0.05] },    // Sulfur yellow + dark lava
      { base: [0.80, 0.55, 0.12], accent: [0.15, 0.06, 0.04] },    // Orange-yellow + black lava
      { base: [0.70, 0.70, 0.25], accent: [0.10, 0.10, 0.08] },    // Pale sulfur + charcoal lava
      { base: [0.85, 0.50, 0.08], accent: [0.18, 0.10, 0.06] },    // Bright orange Io + dark caldera
      { base: [0.65, 0.58, 0.15], accent: [0.08, 0.05, 0.05] },    // Green-yellow sulfur + near-black
    ],
    terrestrial: [
      { base: [0.08, 0.15, 0.50], accent: [0.25, 0.50, 0.18] },    // Blue ocean + green land
      { base: [0.06, 0.12, 0.45], accent: [0.35, 0.55, 0.12] },    // Dark ocean + lush green
      { base: [0.10, 0.20, 0.48], accent: [0.40, 0.38, 0.15] },    // Ocean + savanna
      { base: [0.05, 0.12, 0.35], accent: [0.18, 0.40, 0.22] },    // Deep ocean + dark forest
      { base: [0.08, 0.18, 0.42], accent: [0.45, 0.42, 0.20] },    // Ocean + autumn grassland
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
  // Planet types that can appear as planet-class moons, filtered by zone.
  // Zone determines what large moons are physically possible.
  static PLANET_MOON_TYPES_BY_ZONE = {
    scorching:  ['rocky'],                                // Too hot for anything else
    inner:      ['rocky', 'venus'],                       // Hot, greenhouse possible
    hz:         ['terrestrial', 'ocean', 'ice', 'rocky'], // Life possible on large moons
    transition: ['ice', 'rocky', 'ocean'],                // Cold, ice-dominant
    outer:      ['ice', 'rocky', 'sub-neptune'],          // Frozen, Titan-like possible
  };

  static generate(rng, planetData, moonIndex, totalMoons, parentZone = 'outer', zones = null, parentOrbitAU = null) {
    // ── Planet-moon check: large planets can have planet-class moons ──
    // Gas giants and sub-neptunes with 3+ moons, not the innermost slot
    // (innermost is reserved for volcanic Io-like moons).
    // ~10% chance per eligible slot (reduced from 15% — these are rare).
    const isLargeParent = planetData.type === 'gas-giant' || planetData.type === 'sub-neptune';
    if (isLargeParent && moonIndex > 0 && totalMoons >= 3 && rng.chance(0.10)) {
      return this._generatePlanetMoon(rng, planetData, moonIndex, parentZone, zones, parentOrbitAU);
    }

    const type = this._pickType(rng, planetData, moonIndex, parentZone);

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

    // Orbital speed: inner moons faster. Wrapped with `orb()` for
    // realistic baseline (per workstream realistic-celestial-motion-2026-04-27).
    const orbitSpeed = orb(rng.range(0.025, 0.052) / (1.0 + moonIndex * 0.6));

    // Orbital inclination: regular moons ~0, captured moons can be tilted
    const inclination = type === 'captured'
      ? rng.range(-0.5, 0.5)
      : rng.range(-0.1, 0.1);

    // Retrograde orbit: captured moons sometimes orbit backwards
    const retrograde = type === 'captured' && rng.chance(0.4);

    const startAngle = rng.range(0, Math.PI * 2);

    // Real tidal heating (D12) — moons are where this physically belongs.
    // Uses a dedicated sub-rng (no draw from `rng`), so additive gate stays green.
    const tidalHeating = this._computeTidalHeating(
      planetData, moonRadiusData.radiusEarth, orbitRadiusEarth,
    );

    const moon = {
      type,
      // Physical units
      radiusEarth: moonRadiusData.radiusEarth,
      radiusScene: moonRadiusData.radiusScene,
      orbitRadiusEarth,
      orbitRadiusScene,
      // Real tidal heating (Io-moon scale). DATA-ONLY surfacing (WS1 AC1).
      tidalHeating,
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
      // Terrestrial moons can have faint auroras (N2/O2 atmosphere)
      aurora: type === 'terrestrial' ? {
        color: [0.3, 0.9, 0.4],     // Green oxygen line
        intensity: rng.range(0.1, 0.4),
        ringLatitude: rng.range(0.7, 0.85),
        ringWidth: rng.range(0.08, 0.15),
      } : null,
    };

    // ══ Step 8a — the derived condition record ═══════════════════════════════
    // APPENDED by plain assignment onto the already-built literal, never spliced
    // into it: every `rng.` draw above keeps its position in the shared stream,
    // so no downstream value re-rolls. Plain assignment (NOT defineProperty) is
    // load-bearing — a non-enumerable append is invisible to every hash and to
    // RECORD SHAPE, i.e. it would look like a pass while changing nothing that
    // any gate can see.
    //
    // ZERO draws from the passed-in `rng`. The one float `deriveComposition`
    // needs comes from a dedicated `mooncomp:` namespace keyed on the moon's
    // stable identity, exactly like `moonecc:` at _computeTidalHeating below.
    //
    // ⚠ Null-input guards are not decoration. `generate` has four shipped call
    // sites and only StarSystemGenerator.js:595 passes all seven arguments; the
    // three test call sites pass 4 or 6, leaving `parentOrbitAU` (and, for the
    // 4-arg one, `zones`) null. equilibriumTemperature(L, null) is Infinity and
    // (L, undefined) is NaN — both of which JSON.stringify renders as `null`,
    // so a poisoned T_eq would stay legible to every hash while being garbage.
    // `??` not `||`: metallicity and ageGyr are legitimately 0.
    // ⚠ The zones key is `frostLine`, NOT `frostLineAU` (StarSystemGenerator.js:458).
    const ageGyr = zones?.ageGyr ?? planetData.age ?? 4.5;
    const luminosityRel = zones?.luminosity ?? 1.0;
    // PRE-migration, PRE-resonance-snap orbit, by deliberate choice: it is the
    // same local `parentZone` is derived from, so the two agree by construction.
    const parentAU = Math.max(parentOrbitAU ?? 1.0, 0.01);

    const compSeed = `mooncomp:${planetData.massEarth}:${planetData.radiusEarth}:${orbitRadiusEarth}:${moonRadiusData.radiusEarth}:${type}`;
    const compFloat = namespacedFloat(compSeed);
    const composition = deriveComposition(
      zones?.metallicity ?? 0, parentAU, zones?.frostLine ?? 4.85, compFloat,
    );

    moon.composition = composition;
    // Mass from the moon's OWN bulk density, not the parent's. `composition`
    // lands on this same record in this same commit; sourcing mass from the
    // parent's bulk density would put two disagreeing densities on one body.
    moon.massEarth = moonRadiusData.radiusEarth ** 3 * (composition.density / RHO_EARTH_KGM3);
    moon.T_eq = equilibriumTemperature(luminosityRel, parentAU);
    moon.age = ageGyr;
    // Parent is the PLANET, so the units convert twice: the planet's mass into
    // solar masses, and the moon's orbit out of Earth radii into AU.
    moon.tidalState = checkTidalLock(
      tidalLockTimescale(
        (planetData.massEarth ?? 0) / EARTH_MASSES_PER_SUN,
        moon.massEarth,
        moonRadiusData.radiusEarth,
        Math.max(orbitRadiusEarth * EARTH_RADIUS_AU, 1e-9),
      ),
      ageGyr,
    );
    // The real tidal heating goes in, not the literal 0 PlanetGenerator.js:610
    // passes — that 0 is a WS1 byte-identity constraint on PLANETS, and it does
    // not bind a field that has never existed on moons. With the literal 0 this
    // field could only ever emit two distinct resurfacingRate values.
    // `nearGiant` is passed TRUTHFULLY: a moon of a gas giant / hot Jupiter /
    // sub-neptune is not merely near a giant, its parent is the permanent dominant
    // perturber at 6–60 parent radii. See GIANT_PARENT_TYPES above for why the test is
    // parent MASS and not `GAS_TYPES`. Measured on the fence's 221-seed corpus: 474 of
    // 770 plain moons are giant-parented and 181 records move `bombardmentIntensity`;
    // `erosionLevel` and `resurfacingRate` move on 0, structurally — `nearGiant` reaches
    // neither (PhysicsEngine.js:813-818).
    //
    // ⛔ `nearBelt` STAYS false, considered and rejected rather than overlooked. It is not
    // that the threshold is uncalibrated — the information does not EXIST at this point in
    // the stream. Belts are generated at StarSystemGenerator.js:736, after the moon loop at
    // :595, so at moon-generation time no belt has been drawn yet; `zones` (:457-467)
    // carries no belt field and this file references belts nowhere. Computing it here would
    // require reordering generation, which moves the RNG draw stream for every body
    // downstream. Correct owner: the "refined by system generator later" pass that
    // PlanetGenerator.js:610 already names, which can see both populations at once.
    moon.surfaceHistory = computeSurfaceHistory(
      ageGyr, false, GIANT_PARENT_TYPES.has(planetData.type), moon.atmosphere != null, tidalHeating,
    );

    return moon;
  }

  /**
   * Returns { radiusEarth, radiusScene, radius (map) } for the moon.
   * Fraction of parent, applied to both physical and map radii.
   */
  static _pickRadius(rng, type, planetData) {
    const pType = planetData.type;
    const isGasGiant = GIANT_PARENT_TYPES.has(pType);

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
   * Real tidal heating for a moon (D12 — Peale, Cassen & Reynolds 1979),
   * Io-normalized via PhysicsEngine.tidalHeating().
   *
   * Moons carry NO eccentricity field, so we SEED one from a DEDICATED sub-rng
   * keyed on the moon's stable identity (parent identity + orbit + radius),
   * exactly like the planet-eccentricity pattern (PlanetGenerator AC2). This
   * draws ZERO numbers from the passed-in moon-generation `rng`, so moon
   * generation is byte-identical and the additive gate stays green. The moon
   * eccentricity range (0–0.012) brackets Io's real e≈0.0041; tidal flexing of
   * a close inner moon stays nonzero (a perfectly circular orbit gives 0 heat).
   *
   * @param {object} planetData - parent planet (provides massEarth)
   * @param {number} moonRadiusEarth - moon radius in Earth radii
   * @param {number} orbitRadiusEarth - moon orbit radius in Earth radii
   * @returns {number} Io-scaled tidal heating (≈1 = Io-level)
   */
  static _computeTidalHeating(planetData, moonRadiusEarth, orbitRadiusEarth) {
    const eccSeed = `moonecc:${planetData.massEarth}:${planetData.radiusEarth}:${orbitRadiusEarth}:${moonRadiusEarth}`;
    const eccRng = new SeededRandom(eccSeed);
    const moonEcc = eccRng.range(0.0, 0.012); // brackets Io's e≈0.0041
    const parentMassEarth = planetData.massEarth || 0;
    return tidalHeatingFn(moonEcc, parentMassEarth, moonRadiusEarth, Math.max(orbitRadiusEarth, 1e-6));
  }

  /**
   * Generate a planet-class moon — uses PlanetGenerator for visuals
   * but MoonGenerator for orbital parameters.
   * Think Titan, Ganymede, or a captured mini-Neptune.
   * Zone-aware: terrestrial/ocean only in HZ, ice dominant in outer.
   */
  static _generatePlanetMoon(rng, planetData, moonIndex, parentZone, zones = null, parentOrbitAU = null) {
    // Pick a planet type appropriate for this zone
    const allowed = this.PLANET_MOON_TYPES_BY_ZONE[parentZone] || ['rocky', 'ice'];
    const planetType = rng.pick(allowed);

    // Generate full planet data — pass zones so planet-moons inherit
    // the system's metallicity, age, luminosity for physics calculations
    const pData = PlanetGenerator.generate(rng, 1.0, planetData.sunDirection, zones, planetType);

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

    // Planet-moons orbit a bit slower than regular moons. Wrapped with
    // `orb()` for realistic baseline.
    const orbitSpeed = orb(rng.range(0.019, 0.038) / (1.0 + moonIndex * 0.6));
    const inclination = rng.range(-0.15, 0.15);
    const startAngle = rng.range(0, Math.PI * 2);

    // Override planet data with moon-appropriate radius
    // ⚠ MASS MUST BE RESCALED WITH THE RADIUS. pData is a FULL PLANET generated at 1 AU, and the
    // three lines below shrink it to moon scale by overriding radiusEarth. Overriding radius
    // without mass leaves a planet's mass inside a moon's volume: measured worst case 27.6 M⊕ at
    // 0.89 R⊕, i.e. denser than any real rocky body, reported as ~35 g by
    // conditionFromBody's surfaceGravity (M/R²) — which then drives reliefEnvelope and every
    // other gravity-dependent law on the 14-in-1120 bodies that render through Planet.js.
    //
    // Cubing the radius ratio preserves pData's DENSITY exactly, which is the physically correct
    // invariant here: it is the same material, less of it. That also keeps composition.density
    // valid, since it was derived for this body's material and not for its size.
    //
    // ⛔ Deliberately pure arithmetic on values already drawn — NO rng call. Adding a draw to this
    // shared stream would rewrite the generated universe.
    const massScale = pData.radiusEarth > 0 ? (radiusEarth / pData.radiusEarth) ** 3 : 1;
    const scaledPlanetData = {
      ...pData,
      radiusEarth,
      radiusScene,
      radius,
      massEarth: (pData.massEarth ?? 1) * massScale,
      // No moons of moons
      moonCount: 0,
    };

    // Real tidal heating (D12) for the planet-class moon — same dedicated
    // sub-rng pattern (no draw from `rng`), keeps the additive gate green.
    const tidalHeating = this._computeTidalHeating(planetData, radiusEarth, orbitRadiusEarth);

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
      // Real tidal heating (Io-moon scale). DATA-ONLY surfacing (WS1 AC1).
      tidalHeating,
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
   * Pick moon type based on parent planet, orbit position, and zone.
   *
   * Zone-aware logic (see docs/GAME_BIBLE.md):
   * - Volcanic moons: tidal heating from proximity to gas giant,
   *   works at any stellar distance (Io is 5 AU from Sun)
   * - Terrestrial moons: only around HZ gas giants, and only ~3%
   *   (Heller & Barnes 2013: need mass, magnetosphere, right distance)
   * - Ice moons: dominant in transition/outer zones
   * - Subsurface oceans: future moon type, not yet implemented
   */
  static _pickType(rng, planetData, moonIndex, parentZone) {
    const pType = planetData.type;
    const roll = rng.float();

    if (pType === 'gas-giant' || pType === 'sub-neptune') {
      // ── Gas giant moons — zone determines what's possible ──

      // Innermost moon: volcanic from tidal heating (works at any zone)
      // Io orbits at 5.9 Jupiter radii, gets extreme tidal flexing
      if (moonIndex === 0 && rng.chance(0.35)) return 'volcanic';

      if (parentZone === 'scorching') {
        // Hot Jupiters: most moons stripped during migration.
        // Survivors are scorched rocks or lava.
        if (roll < 0.50) return 'rocky';
        if (roll < 0.80) return 'captured';
        return 'volcanic';
      }

      if (parentZone === 'inner') {
        // Too hot for ice or water. Rocky and captured dominate.
        if (roll < 0.45) return 'rocky';
        if (roll < 0.75) return 'captured';
        if (roll < 0.90) return 'volcanic';
        return 'rocky';
      }

      if (parentZone === 'hz') {
        // The sweet spot: terrestrial moons are rare but possible.
        // Need >0.25 Earth masses + own magnetosphere.
        // ~3% chance (Heller & Barnes 2013).
        if (rng.chance(0.03)) return 'terrestrial';
        if (roll < 0.30) return 'ice';
        if (roll < 0.60) return 'rocky';
        if (roll < 0.80) return 'captured';
        return 'ice';
      }

      if (parentZone === 'transition') {
        // Cold. Ice dominates. Subsurface oceans possible (future type).
        if (roll < 0.40) return 'ice';
        if (roll < 0.65) return 'rocky';
        if (roll < 0.85) return 'captured';
        return 'ice';
      }

      // Outer zone (beyond frost line) — default
      // Ice worlds dominate. Europa/Enceladus-style subsurface oceans.
      if (roll < 0.45) return 'ice';
      if (roll < 0.70) return 'rocky';
      if (roll < 0.90) return 'captured';
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

// Earth's mean bulk density (kg/m³) — the unit `massEarth = R⊕³ × ρ/ρ⊕` is
// expressed in. Same constant the mass-radius consistency fence assumes.
const RHO_EARTH_KGM3 = 5514;
// M☉ / M⊕. tidalLockTimescale() documents massParent in SOLAR masses, but a
// moon's parent is a planet carried in EARTH masses, so it must be converted.
// Sanity anchor: Sol's Moon (60.3 R⊕ orbit, 0.0123 M⊕, 0.2727 R⊕, 1 M⊕ parent)
// → t_lock 9.66e-4 Gyr → locked/synchronous, which is correct.
const EARTH_MASSES_PER_SUN = 332946;

/**
 * Deterministic float in [0,1) from a namespaced identity key.
 *
 * ⛔ WHY THIS IS NOT `new SeededRandom(key).float()`, which is the idiom used
 * for `moonecc:` at _computeTidalHeating below.
 *
 * Instrument B's DRAW STREAM channel counts draws with an accessor installed on
 * `SeededRandom.prototype` (tests/body-identity-fence.test.js:225-241), so it
 * counts EVERY instance, not just the passed-in generation stream. `moonecc:`
 * reads green there only because its draws were already baked into
 * tests/baseline/body-identity.json at Step 0 (`b2ac455`). A NEW sub-rng is not,
 * and it reds the channel — measured, not argued: this exact block with
 * `new SeededRandom(compSeed).float()` moves the draw profile on 197 of 221
 * fence seeds ("wd-0: first divergence at yield 2 (68 → 69); total 8903 →
 * 8907"), +1 per plain moon, with zero drawn VALUES moved. The same block with
 * this function moves 0 of 221.
 *
 * That matters beyond one commit's colour: DRAW STREAM is the only channel that
 * detects a leak into the shared stream, and a genuine `rng.float()` leak
 * appended here produces a signature byte-identical to the sub-rng's. Spending
 * the channel's red on an expected, benign construction would leave the next
 * commit unable to tell a leak from the noise.
 *
 * The namespace discipline documented at _computeTidalHeating is unchanged and
 * is what this preserves: the key is a prefix plus the body's stable identity,
 * carrying no per-system seed and no per-body counter, so the value is a pure
 * function of the body and ZERO numbers come off the passed-in `rng`.
 *
 * Hash is xmur3's mixer (two Math.imul rounds + xorshift finalizer) for
 * avalanche — `deriveComposition` uses this float as scatter across three
 * correlated outputs, so a low-avalanche hash would band them.
 *
 * @param {string} key - namespaced identity key, e.g. `mooncomp:...`
 * @returns {number} float in [0,1)
 */
function namespacedFloat(key) {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
