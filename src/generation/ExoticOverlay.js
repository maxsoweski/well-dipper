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
   */
  static apply(systemData) {
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
      hasExotic = this._applyCivilized(rng, planets, starType, hzInner, hzOuter);
    }

    // ── Layer 2: Exotic overlays ──
    // Fungal (biological), hex/machine (artificial)
    if (!hasExotic) {
      hasExotic = this._applyExotic(rng, planets, systemData, hzInner, hzOuter, frostLine);
    }

    // ── Layer 3: Geological anomalies ──
    // Crystal and shattered — these are independent of the exotic limit.
    // They're rare natural formations, not alien. A system can have both
    // a geological anomaly AND an exotic (but not two exotics).
    this._applyGeological(rng, planets, hzInner, frostLine);
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
  static _applyCivilized(rng, planets, starType, hzInner, hzOuter) {
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
        this._swapPlanetType(planets[idx], civType, rng);
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
  static _applyExotic(rng, planets, systemData, hzInner, hzOuter, frostLine) {
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
      return this._applyFungal(rng, planets, systemData, hzInner, hzOuter);
    } else if (exoticRoll < 0.70) {
      // Hex (30% of exotic rolls)
      return this._applyHex(rng, planets, hzInner);
    } else {
      // Machine (30% of exotic rolls)
      return this._applyMachine(rng, planets, frostLine);
    }
  }

  /**
   * Fungal — alien biology. Bioluminescent organisms.
   * Overlays on HZ rocky/sub-neptune planets.
   * 10% chance of "bloom" — hyper-virulent strain colonizes 2-4 bodies.
   */
  static _applyFungal(rng, planets, systemData, hzInner, hzOuter) {
    // Find suitable hosts: planets with atmospheres, or rocky bodies in HZ/transition
    const candidates = [];
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
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
      // Bloom: colonize 2-4 bodies — any with atmosphere or rocky
      const bloomCount = rng.int(2, Math.min(4, candidates.length));
      for (let b = 0; b < bloomCount; b++) {
        this._swapPlanetType(planets[candidates[b].idx], 'fungal', rng);
      }
    } else {
      // Normal: single planet, prefer HZ
      this._swapPlanetType(planets[candidates[0].idx], 'fungal', rng);
    }

    return true;
  }

  /**
   * Hex — alien megastructure. Tessellated hexagonal plates.
   * Replaces a planet in inner/scorching zone (energy harvesting near star).
   */
  static _applyHex(rng, planets, hzInner) {
    // Find inner/scorching zone planets
    const candidates = [];
    for (let i = 0; i < planets.length; i++) {
      if (planets[i].orbitRadiusAU < hzInner) {
        candidates.push(i);
      }
    }

    if (candidates.length === 0) {
      // Fallback: pick any planet
      candidates.push(rng.int(0, planets.length - 1));
    }

    const idx = rng.pick(candidates);
    this._swapPlanetType(planets[idx], 'hex', rng);
    return true;
  }

  /**
   * Machine — artificial world. Von Neumann probe grown to planet size.
   * Prefers outer system (resource harvesting beyond frost line).
   */
  static _applyMachine(rng, planets, frostLine) {
    // Prefer outer system planets
    const outer = [];
    const inner = [];
    for (let i = 0; i < planets.length; i++) {
      if (planets[i].orbitRadiusAU > frostLine) {
        outer.push(i);
      } else {
        inner.push(i);
      }
    }

    const candidates = outer.length > 0 ? outer : inner;
    const idx = rng.pick(candidates);
    this._swapPlanetType(planets[idx], 'machine', rng);
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
  static _applyGeological(rng, planets, hzInner, frostLine) {
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
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
          this._swapPlanetType(p, 'shattered', rng);
          continue;
        }
      }

      // Crystal: inner, transition, outer zones (pressure + time)
      // Only affects rocky/carbon/ice bodies
      if (r >= hzInner * 0.4 && ['rocky', 'carbon', 'ice'].includes(type)) {
        if (rng.chance(0.01)) {
          this._swapPlanetType(p, 'crystal', rng);
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
  static _swapPlanetType(planetEntry, newType, rng) {
    const swapRng = rng.child('swap-' + newType);
    const oldData = planetEntry.planetData;

    // Regenerate planet data with the new type, keeping sun direction
    const newData = PlanetGenerator.generate(
      swapRng,
      planetEntry.orbitRadiusAU,
      oldData.sunDirection,
      null,       // no zones needed — forceType bypasses _pickType
      newType,    // force the exotic/civilized type
    );

    planetEntry.planetData = newData;
  }
}
