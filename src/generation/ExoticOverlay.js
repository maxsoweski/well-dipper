import { PlanetGenerator } from './PlanetGenerator.js';
import { SeededRandom } from './SeededRandom.js';

/**
 * ExoticOverlay — post-processing pass that adds exotic, civilized,
 * and geological anomaly planets to a naturally generated star system.
 *
 * Runs AFTER StarSystemGenerator.generate() produces the base system.
 * Modifies the planets array in-place by swapping planet types.
 *
 * Three overlay categories:
 *   1. Civilized — city-lights / ecumenopolis on habitable planets
 *   2. Exotic — fungal, hex, machine (rare alien anomalies)
 *   3. Geological — crystal, shattered (rare natural anomalies)
 *
 * See docs/GAME_BIBLE.md §6 for full design rationale.
 */
export class ExoticOverlay {

  /**
   * Apply all overlay systems to a generated star system.
   * Modifies systemData.planets in-place.
   *
   * @param {object} systemData - output from StarSystemGenerator.generate()
   * @param {object|null} genContext - the inputs the planets were GENERATED from, which
   *   `systemData` alone cannot supply (break B7). Two fields, both needed by
   *   `_swapPlanetType`:
   *     · `zones` — the generation-time zones object (StarSystemGenerator.js:457), carrying
   *       `luminosity`, `metallicity`, `ageGyr`, `starMassSolar`, `starType`. ⛔ NOT the same
   *       object as `systemData.zones`, which is zoneData — four AU boundaries and their scene
   *       and map conversions, with no stellar physics on it at all.
   *     · `orbitAUByEntry` — Map(planet wrapper -> the AU it was generated at), captured BEFORE
   *       migration and resonance-snapping rewrite `orbitRadiusAU` on the wrapper.
   *   Passed as a context rather than stamped onto the records on purpose: generation
   *   provenance is not a property of a body, and keeping it off the records keeps it
   *   invisible to Instrument B's shape and hash channels.
   *   Omitted (the three standalone unit-test call sites) → each falls back to what this file
   *   did before B7. That fallback reproduces the defect by construction, so it is a
   *   test-only affordance, never a shipped path.
   */
  static apply(systemData, genContext = null) {
    const rng = new SeededRandom(systemData.seed + '-overlay');
    const { planets, star } = systemData;
    if (planets.length === 0) return;

    const starType = star.type;
    const hzInner = systemData.zones.hzInnerAU;
    const hzOuter = systemData.zones.hzOuterAU;
    const frostLine = systemData.zones.frostLineAU;

    // Track what we've applied (max 1 exotic/civilized per system)
    let hasExotic = false;

    // ── Layer 1: Civilized overlay ──
    // Only on habitable planets (terrestrial/ocean/eyeball).
    // Civilization needs a habitable base + stable long-lived star.
    if (!hasExotic) {
      hasExotic = this._applyCivilized(rng, planets, starType, hzInner, hzOuter, genContext);
    }

    // ── Layer 2: Exotic overlays ──
    // Fungal (biological), hex/machine (artificial)
    if (!hasExotic) {
      hasExotic = this._applyExotic(rng, planets, systemData, hzInner, hzOuter, frostLine, genContext);
    }

    // ── Layer 3: Geological anomalies ──
    // Crystal and shattered — these are independent of the exotic limit.
    // They're rare natural formations, not alien. A system can have both
    // a geological anomaly AND an exotic (but not two exotics).
    this._applyGeological(rng, planets, hzInner, frostLine, genContext);
  }

  // ════════════════════════════════════════════════════════════
  // LAYER 1: CIVILIZED
  // ════════════════════════════════════════════════════════════

  /**
   * Civilization overlay on habitable planets.
   * Decision chain: planet must be habitable → star must be suitable →
   * random roll for civilization → 70% city-lights, 30% ecumenopolis.
   *
   * @returns {boolean} true if a civilized planet was placed
   */
  static _applyCivilized(rng, planets, starType, hzInner, hzOuter, genContext = null) {
    // Civilization chance by star type — stable, long-lived stars favor it.
    // O/B stars live too briefly for complex life to develop.
    const civChance = {
      'O': 0, 'B': 0,
      'A': 0.02,
      'F': 0.05, 'G': 0.06,
      'K': 0.05,
      'M': 0.02,
    }[starType] || 0;

    if (civChance === 0) return false;

    // Find habitable planets (terrestrial, ocean, eyeball) in the HZ
    const habitable = [];
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      if (p.known) continue; // D3: injected real planets are never retyped/regenerated
      const type = p.planetData.type;
      if ((type === 'terrestrial' || type === 'ocean' || type === 'eyeball')
          && p.orbitRadiusAU >= hzInner && p.orbitRadiusAU < hzOuter) {
        habitable.push(i);
      }
    }

    if (habitable.length === 0) return false;

    // Roll for civilization on each habitable planet
    for (const idx of habitable) {
      if (rng.chance(civChance)) {
        const civType = rng.float() < 0.7 ? 'city-lights' : 'ecumenopolis';
        this._swapPlanetType(planets[idx], civType, rng, genContext);
        return true;
      }
    }

    return false;
  }

  // ════════════════════════════════════════════════════════════
  // LAYER 2: EXOTIC (fungal, hex, machine)
  // ════════════════════════════════════════════════════════════

  /**
   * Exotic overlay — rare alien anomalies.
   * Target: ~0.5% of systems (1 in 200).
   *
   * @returns {boolean} true if an exotic was placed
   */
  static _applyExotic(rng, planets, systemData, hzInner, hzOuter, frostLine, genContext = null) {
    // Base exotic chance: 0.5% per system
    // M/K stars get a slight boost (NMS-inspired: red stars = more weird)
    const starType = systemData.star.type;
    const exoticChance = {
      'O': 0.004, 'B': 0.004,
      'A': 0.004,
      'F': 0.005, 'G': 0.005,
      'K': 0.006,
      'M': 0.007,
    }[starType] || 0.005;

    if (!rng.chance(exoticChance)) return false;

    // Decide which exotic type — weighted by what's available in this system
    const exoticRoll = rng.float();

    if (exoticRoll < 0.40) {
      // Fungal (40% of exotic rolls)
      return this._applyFungal(rng, planets, systemData, hzInner, hzOuter, genContext);
    } else if (exoticRoll < 0.70) {
      // Hex (30% of exotic rolls)
      return this._applyHex(rng, planets, hzInner, genContext);
    } else {
      // Machine (30% of exotic rolls)
      return this._applyMachine(rng, planets, frostLine, genContext);
    }
  }

  /**
   * Fungal — alien biology. Bioluminescent organisms.
   * Overlays on HZ rocky/sub-neptune planets.
   * 10% chance of "bloom" — hyper-virulent strain colonizes 2-4 bodies.
   */
  static _applyFungal(rng, planets, systemData, hzInner, hzOuter, genContext = null) {
    // Find suitable hosts: planets with atmospheres, or rocky bodies in HZ/transition
    const candidates = [];
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      if (p.known) continue; // D3: injected real planets are never retyped/regenerated
      const type = p.planetData.type;
      const hasAtmo = p.planetData.atmosphere !== null;
      const isRocky = ['rocky', 'sub-neptune', 'terrestrial', 'ocean', 'venus', 'ice', 'eyeball'].includes(type);
      const inHZ = p.orbitRadiusAU >= hzInner && p.orbitRadiusAU < hzOuter;
      // Primary candidates: HZ planets
      // Secondary candidates: anything with atmosphere or rocky
      if (inHZ && isRocky) {
        candidates.push({ idx: i, priority: 2 });
      } else if (hasAtmo || isRocky) {
        candidates.push({ idx: i, priority: 1 });
      }
    }

    if (candidates.length === 0) return false;

    // Sort by priority (HZ first)
    candidates.sort((a, b) => b.priority - a.priority);

    // Is this a bloom? (10% chance)
    const isBloom = rng.chance(0.10);

    if (isBloom) {
      // Bloom: colonize 2-4 bodies — any with atmosphere or rocky.
      // With exactly 1 candidate, rng.int(2, 1) is an inverted range and
      // returns 2. The draw must still happen (RNG cadence is load-bearing
      // for procgen revisit-stability), so clamp the count rather than
      // skip the roll — for ≥2 candidates the clamp is a no-op.
      const bloomCount = Math.min(
        rng.int(2, Math.min(4, candidates.length)),
        candidates.length
      );
      for (let b = 0; b < bloomCount; b++) {
        this._swapPlanetType(planets[candidates[b].idx], 'fungal', rng, genContext);
      }
    } else {
      // Normal: single planet, prefer HZ
      this._swapPlanetType(planets[candidates[0].idx], 'fungal', rng, genContext);
    }

    return true;
  }

  /**
   * Hex — alien megastructure. Tessellated hexagonal plates.
   * Replaces a planet in inner/scorching zone (energy harvesting near star).
   */
  static _applyHex(rng, planets, hzInner, genContext = null) {
    // Find inner/scorching zone planets (D3: injected real planets are never
    // candidates — they must not be retyped/regenerated).
    const candidates = [];
    for (let i = 0; i < planets.length; i++) {
      if (planets[i].known) continue;
      if (planets[i].orbitRadiusAU < hzInner) {
        candidates.push(i);
      }
    }

    if (candidates.length === 0) {
      // Fallback: pick any planet (preserve the procgen RNG draw exactly).
      candidates.push(rng.int(0, planets.length - 1));
    }

    const idx = rng.pick(candidates);
    // D3 guard: if the fallback landed on a known planet (merged systems only),
    // skip the swap rather than regenerate its real data. Procgen planets carry
    // no `known` flag, so this never fires there (AC8).
    if (!planets[idx].known) this._swapPlanetType(planets[idx], 'hex', rng, genContext);
    return true;
  }

  /**
   * Machine — artificial world. Von Neumann probe grown to planet size.
   * Prefers outer system (resource harvesting beyond frost line).
   */
  static _applyMachine(rng, planets, frostLine, genContext = null) {
    // Prefer outer system planets (D3: injected real planets are never
    // candidates — they must not be retyped/regenerated).
    const outer = [];
    const inner = [];
    for (let i = 0; i < planets.length; i++) {
      if (planets[i].known) continue;
      if (planets[i].orbitRadiusAU > frostLine) {
        outer.push(i);
      } else {
        inner.push(i);
      }
    }

    const candidates = outer.length > 0 ? outer : inner;
    // Merged system with ONLY known planets → no procgen candidate to retype;
    // bail out. Procgen systems always keep ≥1 non-known planet here (AC8).
    if (candidates.length === 0) return false;
    const idx = rng.pick(candidates);
    this._swapPlanetType(planets[idx], 'machine', rng, genContext);
    return true;
  }

  // ════════════════════════════════════════════════════════════
  // LAYER 3: GEOLOGICAL ANOMALIES
  // ════════════════════════════════════════════════════════════

  /**
   * Geological anomalies — crystal and shattered planets.
   * These are rare natural formations, not alien constructs.
   * Independent of the exotic limit (a system can have both).
   * ~1% per planet in the right zone.
   */
  static _applyGeological(rng, planets, hzInner, frostLine, genContext = null) {
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      if (p.known) continue; // D3: injected real planets are never retyped/regenerated
      const r = p.orbitRadiusAU;
      const type = p.planetData.type;

      // Skip planets that are already exotic/civilized
      if (['fungal', 'hex', 'machine', 'city-lights', 'ecumenopolis', 'crystal', 'shattered'].includes(type)) {
        continue;
      }

      // Shattered: scorching and inner zones (tidal/thermal stress)
      // Only affects rocky/carbon/lava-sized bodies
      if (r < hzInner && ['rocky', 'carbon', 'lava'].includes(type)) {
        if (rng.chance(0.01)) {
          this._swapPlanetType(p, 'shattered', rng, genContext);
          continue;
        }
      }

      // Crystal: inner, transition, outer zones (pressure + time)
      // Only affects rocky/carbon/ice bodies
      if (r >= hzInner * 0.4 && ['rocky', 'carbon', 'ice'].includes(type)) {
        if (rng.chance(0.01)) {
          this._swapPlanetType(p, 'crystal', rng, genContext);
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════

  /**
   * Swap a planet's type by regenerating its data with forceType.
   * Keeps the same orbit, but gets new palette, radius, features
   * appropriate for the new type.
   */
  static _swapPlanetType(planetEntry, newType, rng, genContext = null) {
    const swapRng = rng.child('swap-' + newType);
    const oldData = planetEntry.planetData;

    // ⭐ A TYPE SWAP CHANGES THE TYPE. IT MUST NOT ALSO MOVE THE BODY TO A DIFFERENT
    // STAR OR A DIFFERENT ORBIT (break B7). Both of the inputs below used to be wrong:
    //
    // `zones` was `null`, under the comment "no zones needed — forceType bypasses
    // _pickType". That reason is TRUE and INCOMPLETE: `_pickType` is the only consumer
    // of `hzInner`/`hzOuter`/`sizeBias`, but PlanetGenerator.js:368
    // `const luminosityRel = zones?.luminosity || 1.0;` and the metallicity, ageGyr,
    // starMassSolar and starType reads around it are NOT behind `forceType`. Passing
    // null re-derived every swapped planet AS IF IT ORBITED THE SUN — a crystal planet
    // 527 AU from a 300000 L☉ star came back at 11.12 K instead of 260.18 K.
    //
    // `orbitRadiusAU` is the wrapper's CURRENT orbit, which migration
    // (StarSystemGenerator.js:655 `migrantInSurviving.orbitRadiusAU = migrationResult.finalOrbitAU;`)
    // and resonance-snapping rewrite AFTER `planetData` was built. Every other body in
    // the system carries physics derived from the orbit it was GENERATED at — planets
    // because `planetData` is never recomputed, moons because MoonGenerator.js:254
    // `const parentAU = Math.max(parentOrbitAU ?? 1.0, 0.01);` takes the pre-migration AU
    // by deliberate choice. Regenerating at the final AU made the swapped planet the one
    // body in the system on the other convention, which is the whole reason a moon could
    // disagree with its own parent's equilibrium temperature.
    //
    // ⛔ This is CONSISTENCY with that convention, not an endorsement of it. Planets that
    // migrate or snap still carry physics for an orbit they no longer occupy; that is a
    // system-wide question and it is not this function's to answer.
    const genZones = genContext?.zones ?? null;
    const genOrbitAU = genContext?.orbitAUByEntry?.get(planetEntry) ?? planetEntry.orbitRadiusAU;

    // Regenerate planet data with the new type, keeping sun direction
    const newData = PlanetGenerator.generate(
      swapRng,
      genOrbitAU,
      oldData.sunDirection,
      genZones,
      newType,    // force the exotic/civilized type
    );

    // Rescale retained moons to the new parent radius (WU7-1). The swapped
    // type has a different radius, so moons sized/positioned for the old
    // parent would clip inside it or fling off. Earth-based fields scale by
    // the radiusEarth ratio (earthRadiiToScene is linear — see
    // core/ScaleConstants.js — so *Scene fields scale by the same kEarth);
    // map-based fields scale by the radius ratio.
    const moons = planetEntry.moons;
    if (moons && moons.length > 0) {
      const kEarth = newData.radiusEarth / oldData.radiusEarth;
      const kMap = newData.radius / oldData.radius;
      for (const moon of moons) {
        moon.radiusEarth *= kEarth;
        moon.radiusScene *= kEarth;
        moon.orbitRadiusEarth *= kEarth;
        moon.orbitRadiusScene *= kEarth;
        moon.radius *= kMap;
        moon.orbitRadius *= kMap;
        // ⭐ MASS FOLLOWS RADIUS, OR THE BODY STOPS BEING ONE BODY (break B7).
        // MoonGenerator.js:266 `moon.massEarth = moonRadiusData.radiusEarth ** 3` builds mass
        // as radius³ × ρ_moon/ρ⊕, and `composition.density` is NOT rescaled here (bulk density
        // is a property of what the moon is made of, not of how big its parent is). So the cube
        // is exactly what keeps that identity true. Leaving mass alone implied 35.96 g/cc on
        // wd-45/0/0 and 27.57 on wd-79/2/0 — both denser than osmium, and both past the ceiling
        // moon-mass-radius-consistency.test.js:70 `expect(worst.gcc).toBeLessThan(15)` already
        // ships. ⚠ That ceiling reads `m.planetData`, so it covers the PLANET-CLASS moons only:
        // it is the standard this repo already holds, not a gate these three plain moons were
        // ever under. The gate that does bind them is
        // moon-condition-contract.test.js:304 `POST-OVERLAY: mass and radius still describe`.
        if (Object.prototype.hasOwnProperty.call(moon, 'massEarth')) moon.massEarth *= kEarth ** 3; else if (moon.planetData?.massEarth != null) moon.planetData.massEarth *= kEarth ** 3;  // ⛔ A PLANET-CLASS moon has no top-level `massEarth` (it lives on planetData), so the bare `*=` CREATED the key as NaN and took the record 20 keys → 21 — the `shapes: 2` census break. Dormant until B5.0 put the first planet-class moon on a swappable parent. B4 §8.7 trap 3.
        // ⚠ STILL STALE AFTER THIS LINE, and deliberately left so — nothing gates it yet:
        // `tidalHeating`, `tidalState` and `surfaceHistory` are all functions of the
        // PRE-rescale geometry AND of the OLD parent (its mass, and its type via
        // MoonGenerator's GIANT_PARENT_TYPES — which a swap can flip). `noiseScale` is
        // `2.5/radius` on 98.77% of plain moons (build-plan break B1), so the comment that
        // used to sit here calling it "texture detail, not geometry" was false.
      }
    }
    // Keep moonCount honest: it must match the moons that survive the swap.
    newData.moonCount = moons?.length ?? 0;

    planetEntry.planetData = newData;
  }
}
