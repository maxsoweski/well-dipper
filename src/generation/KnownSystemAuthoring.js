/**
 * KnownSystemAuthoring — data-driven KnownSystems authoring adapter (AC5 of
 * real-universe-overlay-2026-07-12, design D1/D4).
 *
 * WHAT: turns a DECLARATIVE KnownSystems registry entry — pure data, no
 * hand-written generate() — into full system contents by routing THROUGH
 * StarSystemGenerator's overlay generation-context fields (AC10). One engine,
 * one code path: the same ctx support that Increment 3's bulk overlay merge will
 * use serves this authoring path now (design D1).
 *
 * INTENT: an entry says only "I am at THIS position, seeded THIS way, and my
 * stellar structure is companion-table entry X" (e.g. Alpha Centauri →
 * companionsRef 'Alpha Centauri'). This adapter resolves that reference into the
 * overlay ctx (primary type, forced close-binary companion spec, far companions
 * with their real archive planets), calls StarSystemGenerator, decorates the
 * known-system markers, and derives an index-aligned display-names object. NO
 * multiplicity or planet data is duplicated in the registry — it all comes from
 * the curated companion table (structure) + the generated far-companion contents
 * module (planets).
 *
 * DELIBERATE NON-GOALS: this does not touch Sol's hand-written path; does not
 * inject the primary's own archive planets (Alpha Cen A/B carry none in this
 * increment — Proxima's planets ride the far companion); does not render far
 * companions as scene bodies (they are data-level v1 — see representation-cap.md).
 */

import { StarSystemGenerator } from './StarSystemGenerator.js';
import { GalacticMap } from './GalacticMap.js';
import { STELLAR_COMPANIONS } from './data/stellarCompanions.js';
import { KNOWN_SYSTEM_CONTENTS } from './data/knownSystemContents.generated.js';

// Fallback galaxy master seed. Matches main.js's live `new GalacticMap(...)`
// (src/main.js) and ProcgenSnapshot's literal, so the ctx an adapter builds with
// the fallback map is identical to the one built with the injected instance.
// Used only when no GalacticMap instance is handed in (unit tests, or before
// main.js's associate() injection has run — design D7).
export const AUTHORING_MASTER_SEED = 'well-dipper-galaxy-1';

// Procgen planet-designation letters (IAU order b, c, d, ...). Mirrors
// NameGenerator.PLANET_LETTERS (not exported there) so authored planets get the
// SAME letter convention procgen uses (design D4) — planet 0 → 'b', etc.
const PLANET_LETTERS = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];

// Roman numerals for moon designations (procgen moons carry no real names; a
// deterministic Planet-name + numeral keeps every moon label populated so the
// spawnSystem label path never falls back to a bare "Moon N" — design D4).
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'];
function romanNumeral(n) {
  return n >= 1 && n <= ROMAN.length ? ROMAN[n - 1] : String(n);
}

/**
 * Resolve a companionsRef string to its STELLAR_COMPANIONS entry (the single
 * multiplicity source of truth). Throws on a missing ref — an authored entry
 * pointing at a non-existent companion table row is a build bug, not a
 * silently-empty system.
 * @param {string} ref
 * @returns {object} the STELLAR_COMPANIONS entry
 */
export function resolveCompanionEntry(ref) {
  const entry = STELLAR_COMPANIONS.find((e) => e.name === ref);
  if (!entry) {
    throw new Error(`[KnownSystemAuthoring] no STELLAR_COMPANIONS entry named "${ref}"`);
  }
  return entry;
}

/**
 * Far-companion display names for a companion table entry — used by KnownSystems
 * to derive aliases from the table (design D6) without re-resolving the entry.
 * @param {object} companion — a STELLAR_COMPANIONS entry
 * @returns {string[]}
 */
export function farCompanionNames(companion) {
  return (companion?.farCompanions ?? []).map((f) => f.name);
}

/**
 * Build the overlay galaxy-context for a declarative authored entry (design D2).
 * Mirrors the live arrival path: deriveGalaxyContext(position) for the real
 * galactic context, then the overlay fields bolt on (the starTypeOverride idiom).
 *
 * @param {object} entry — declarative registry entry { name, position, seed, data:{ companionsRef } }
 * @param {GalacticMap|null} map — injected instance (D7) or null → fallback
 * @returns {object} galaxyContext with overlay fields attached
 */
export function buildAuthoredContext(entry, map = null) {
  const companion = resolveCompanionEntry(entry.data.companionsRef);
  const galacticMap = map || new GalacticMap(AUTHORING_MASTER_SEED);
  const ctx = galacticMap.deriveGalaxyContext(entry.position);

  // Primary type from the primary component's real spectral class.
  const primary = companion.components?.[0];
  const primaryType = primary ? StarSystemGenerator.normalizeSpectralClass(primary.class) : null;
  if (primaryType) ctx.starTypeOverride = primaryType;

  // Close pair: hand the whole companion table entry as the companionSpec.
  // StarSystemGenerator reads only kind + components for the close pair; the
  // entry's own farCompanions field is ignored there (wide members are emitted
  // via ctx.farCompanions below, per Builder-1's API note), so passing the entry
  // verbatim keeps the single source of truth intact.
  ctx.companionSpec = companion;

  // Far companions → their real archive planets from the generated contents
  // module (design D5). Each is emitted into systemData.farCompanions by
  // StarSystemGenerator; planets are passed through verbatim.
  const fars = (companion.farCompanions ?? []).map((fc) => {
    const rec = KNOWN_SYSTEM_CONTENTS[fc.name];
    const out = { name: fc.name, class: fc.class, separationAU: fc.separationAU };
    if (rec && Array.isArray(rec.planets) && rec.planets.length > 0) out.planets = rec.planets;
    return out;
  });
  if (fars.length > 0) ctx.farCompanions = fars;

  return ctx;
}

/**
 * Derive the index-aligned display-names object for an authored system, matching
 * the { system, star, star2, planets:[{name, moons:[...]}] } shape spawnSystem
 * consumes (design D4). Names come from data, never hand-written:
 *   - system  ← entry.name
 *   - star    ← primary component name; star2 ← secondary component name (binary)
 *   - planets ← injected known planet's real name when present, else
 *               `<system> <letter>` using the SAME letter convention procgen uses
 *   - moons   ← `<planet> <roman>` so every procgen moon label is populated
 *
 * @param {object} entry — declarative registry entry
 * @param {object} companion — resolved STELLAR_COMPANIONS entry
 * @param {object} systemData — StarSystemGenerator output
 * @returns {{ system:string, star:string, star2:(string|null), planets:Array }}
 */
export function deriveAuthoredNames(entry, companion, systemData) {
  const systemName = entry.name;
  const primaryName = companion.components?.[0]?.name || systemName;
  const secondaryName = companion.components?.[1]?.name || null;

  const planets = systemData.planets.map((p, i) => {
    const letter = p.letter != null
      ? p.letter
      : (i < PLANET_LETTERS.length ? PLANET_LETTERS[i] : String.fromCharCode(98 + i));
    // Injected known planets carry a real name; procgen fill uses the letter.
    const planetName = p.name != null ? p.name : `${systemName} ${letter}`;
    const moons = p.moons.map((_m, mi) => `${planetName} ${romanNumeral(mi + 1)}`);
    return { name: planetName, moons };
  });

  return {
    system: systemName,
    star: primaryName,
    star2: systemData.isBinary && systemData.star2 ? secondaryName : null,
    planets,
  };
}

/**
 * Generate full system contents for a declarative authored entry. Routes through
 * StarSystemGenerator's overlay ctx, decorates the known-system markers the
 * arrival paths expect (matching Sol's generate()), and attaches the derived
 * names object as `_knownSystemNames` (so a direct spawn carries them; KnownSystems
 * also mirrors them onto the entry for the `entry.names` read main.js does).
 *
 * @param {object} entry — declarative registry entry
 * @param {GalacticMap|null} map — injected instance (D7) or null → fallback
 * @returns {object} decorated systemData
 */
export function generateAuthoredSystem(entry, map = null) {
  const companion = resolveCompanionEntry(entry.data.companionsRef);
  const ctx = buildAuthoredContext(entry, map);
  const data = StarSystemGenerator.generate(entry.seed, ctx);
  data._destType = 'star-system';
  data._isKnownSystem = true;
  data._knownSystemName = entry.name;
  data._knownSystemNames = deriveAuthoredNames(entry, companion, data);
  return data;
}
