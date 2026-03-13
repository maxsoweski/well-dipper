/**
 * NameGenerator — deterministic procedural name generation for star systems,
 * stars, planets, and moons.
 *
 * Produces a mix of:
 * - Catalog-style names ("HD 47832", "GJ 1214", "HR 8799") — ~30%
 * - Pronounceable fantasy names ("Velorath", "Syndara", "Keth Prime") — ~70%
 *
 * Uses syllable-based construction with consonant-vowel patterns for
 * pronounceable names. Inspired by real astronomical naming conventions
 * (IAU catalogs, Kepler designations) and procedural techniques from
 * games like Elite Dangerous (Markov-like sound pairs) and No Man's Sky
 * (seeded cascading generation).
 *
 * All output is deterministic — same seed always produces the same names.
 * Expects a SeededRandom instance (with .float(), .int(), .pick(), .chance(),
 * .child(label) methods).
 */

// ─────────────────────────────────────────────────────────────────────
// PHONEME TABLES
// ─────────────────────────────────────────────────────────────────────

// Onsets: consonant(s) that can start a syllable
// Simple single consonants are duplicated for weighting — they produce
// smoother, more pronounceable names than clusters like "str" or "scr"
const ONSETS = [
  'b', 'b', 'c', 'c', 'd', 'd', 'f', 'f', 'g', 'g',
  'h', 'h', 'j', 'k', 'k', 'l', 'l', 'm', 'm', 'n', 'n',
  'p', 'p', 'r', 'r', 's', 's', 't', 't', 'v', 'v', 'w', 'z',
  'br', 'ch', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr',
  'kh', 'ph', 'pr', 'sh', 'sk', 'sp', 'st', 'th', 'tr',
];

// Nuclei: vowel sounds (the core of each syllable)
const NUCLEI = [
  'a', 'a', 'a',   // heavily weighted simple vowels
  'e', 'e', 'e',
  'i', 'i',
  'o', 'o', 'o',
  'u', 'u',
  'ae', 'ai', 'au', 'ea', 'ei', 'ia', 'io', 'ou',
];

// Codas: consonant(s) that can end a syllable (or empty for open syllable)
// ~50% open syllables keeps names flowing and avoids consonant pile-ups.
// Only single-character codas — multi-char codas create ugly clusters at
// syllable boundaries when the next syllable starts with a consonant onset.
const CODAS = [
  '', '', '', '', '', '', '', '', '', '',  // open syllables
  'b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't',
  'x', 'z',
  'n', 'r', 's', 'l', 'n', 'r',          // extra weight on smooth endings
];

// Special endings that make names feel more "space-y"
const SPACE_SUFFIXES = [
  'ara', 'ath', 'eon', 'iel', 'ion', 'ius', 'ora', 'oth',
  'una', 'ura', 'yan', 'yx', 'enn', 'arr', 'oss', 'ull',
  'ax', 'ix', 'ox', 'ex', 'is', 'os', 'us', 'as',
  'al', 'el', 'il', 'ol', 'ul', 'an', 'en', 'in', 'on',
];

// Prefixes that evoke sci-fi/space flavor (used for some names)
const FLAVOR_PREFIXES = [
  'Ald', 'Alt', 'Aur', 'Bel', 'Cen', 'Cor', 'Cyr', 'Del',
  'Dra', 'Eri', 'Eth', 'Gal', 'Hel', 'Hyp', 'Ith', 'Kep',
  'Lyr', 'Mer', 'Mir', 'Neb', 'Nol', 'Ori', 'Pol', 'Pyx',
  'Rig', 'Sag', 'Sel', 'Sig', 'Sol', 'Syr', 'Tau', 'Tel',
  'Tyr', 'Val', 'Vel', 'Vos', 'Xen', 'Zar', 'Zan', 'Zet',
];

// ─────────────────────────────────────────────────────────────────────
// CATALOG-STYLE NAME TABLES
// ─────────────────────────────────────────────────────────────────────

// Real catalog prefixes and their typical number ranges
const CATALOG_FORMATS = [
  // { prefix, minNum, maxNum, separator }
  { prefix: 'HD',      minNum: 1000,   maxNum: 299999, separator: ' ' },   // Henry Draper
  { prefix: 'HR',      minNum: 100,    maxNum: 9999,   separator: ' ' },   // Harvard Revised (Bright Star)
  { prefix: 'GJ',      minNum: 1,      maxNum: 9999,   separator: ' ' },   // Gliese-Jahreis (nearby stars)
  { prefix: 'HIP',     minNum: 1000,   maxNum: 120000, separator: ' ' },   // Hipparcos
  { prefix: 'TYC',     minNum: 1000,   maxNum: 9999,   separator: ' ' },   // Tycho
  { prefix: 'WISE',    minNum: 100,    maxNum: 9999,   separator: ' ' },   // Wide-field IR Survey
  { prefix: 'TOI',     minNum: 100,    maxNum: 9999,   separator: '-' },   // TESS Object of Interest
  { prefix: 'KOI',     minNum: 100,    maxNum: 9999,   separator: '-' },   // Kepler Object of Interest
  { prefix: 'Kepler',  minNum: 1,      maxNum: 2000,   separator: '-' },   // Kepler confirmed
  { prefix: 'TRAPPIST',minNum: 1,      maxNum: 99,     separator: '-' },   // TRAPPIST survey
  { prefix: 'LHS',     minNum: 1,      maxNum: 5000,   separator: ' ' },   // Luyten Half-Second
  { prefix: 'Ross',    minNum: 1,      maxNum: 999,    separator: ' ' },   // Ross catalog
  { prefix: 'Wolf',    minNum: 1,      maxNum: 1500,   separator: ' ' },   // Wolf catalog
  { prefix: 'Proxima', minNum: null,   maxNum: null,    separator: '' },    // single-word (no number)
];

// Greek letter + constellation style (e.g., "Alpha Centauri")
const GREEK_LETTERS = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta',
  'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu',
  'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma',
  'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
];

// Fake constellation names (sound real but aren't)
const CONSTELLATIONS = [
  'Centauri', 'Cygni', 'Draconis', 'Eridani', 'Gruis',
  'Hydrae', 'Leonis', 'Lyrae', 'Orionis', 'Pavonis',
  'Scorpii', 'Serpentis', 'Tauri', 'Ursae', 'Virginis',
  'Aquilae', 'Bootis', 'Carinae', 'Cassiopeiae', 'Geminorum',
  'Phoenicis', 'Puppis', 'Velorum', 'Volantis', 'Crucis',
];

// System title suffixes (rare, added for variety)
const SYSTEM_TITLES = [
  'Major', 'Minor', 'Prime', 'Reach', 'Expanse', 'Deep',
  'Nexus', 'Drift', 'Gate', 'Haven',
];

// Planet letter suffixes (IAU convention: b, c, d, e, ...)
// 'a' is traditionally reserved for the star itself
const PLANET_LETTERS = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];

// Roman numerals for moons
const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI',
];

// Short moon names (mythological/fantasy flavor)
const MOON_NAMES = [
  'Io', 'Rhea', 'Dione', 'Ariel', 'Mira', 'Calyx',
  'Thane', 'Nyx', 'Phos', 'Ersa', 'Skye', 'Zira',
  'Talus', 'Veil', 'Onyx', 'Selke', 'Brin', 'Coil',
  'Dusk', 'Fenn', 'Glyph', 'Haze', 'Iris', 'Jura',
  'Kine', 'Lune', 'Mote', 'Neri', 'Opal', 'Pike',
  'Quill', 'Rune', 'Shard', 'Tarn', 'Uma', 'Vale',
  'Wren', 'Xyla', 'Yara', 'Zeal',
];


// ─────────────────────────────────────────────────────────────────────
// CORE NAME GENERATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a single pronounceable syllable.
 * Structure: onset + nucleus + coda (any part can be empty/simple).
 */
function generateSyllable(rng, isFirst = false) {
  // First syllable is more likely to start with a consonant (sounds better)
  const onset = rng.chance(isFirst ? 0.90 : 0.80) ? rng.pick(ONSETS) : '';
  const nucleus = rng.pick(NUCLEI);
  // Non-final syllables more likely to be open (no coda) for flow
  const coda = rng.pick(CODAS);
  return onset + nucleus + coda;
}

/**
 * Smooth out ugly consonant clusters at syllable boundaries.
 * Rules:
 * - Max 2 consonants in a row (insert a vowel to break longer runs)
 * - Avoid repeated characters (e.g., "ss", "tt")
 * - Cap total length to avoid runaway names
 */
function smoothWord(word) {
  const vowels = 'aeiou';
  const isVowel = ch => vowels.includes(ch.toLowerCase());
  // Break vowels to insert, cycling through them
  const breakVowels = ['a', 'i', 'e', 'o', 'u'];
  let breakIdx = 0;

  let result = '';
  let consonantRun = 0;

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];

    // Skip repeated identical characters
    if (result.length > 0 && ch === result[result.length - 1]) {
      continue;
    }

    if (isVowel(ch)) {
      consonantRun = 0;
      result += ch;
    } else {
      consonantRun++;
      if (consonantRun > 2) {
        // Insert a break vowel
        result += breakVowels[breakIdx % breakVowels.length];
        breakIdx++;
        consonantRun = 1;
      }
      result += ch;
    }
  }

  // Cap at 10 characters (very long names are unwieldy)
  if (result.length > 10) {
    result = result.slice(0, 10);
  }

  return result;
}

/**
 * Generate a pronounceable word of 2-4 syllables.
 * Capitalizes the first letter.
 */
function generateWord(rng, minSyllables = 2, maxSyllables = 3) {
  const count = rng.int(minSyllables, maxSyllables);
  let word = '';

  for (let i = 0; i < count; i++) {
    // Last syllable sometimes uses a space-y suffix instead
    if (i === count - 1 && rng.chance(0.35)) {
      word += rng.pick(SPACE_SUFFIXES);
    } else {
      word += generateSyllable(rng);
    }
  }

  // Smooth consonant clusters and capitalize
  word = smoothWord(word);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Generate a name using a flavor prefix + syllable ending.
 * Produces names like "Alderon", "Cyrath", "Veloran".
 */
function generatePrefixedName(rng) {
  const prefix = rng.pick(FLAVOR_PREFIXES);
  // Add 1-2 syllables after the prefix
  let suffix = '';
  const syllables = rng.int(1, 2);
  for (let i = 0; i < syllables; i++) {
    if (i === syllables - 1 && rng.chance(0.5)) {
      suffix += rng.pick(SPACE_SUFFIXES);
    } else {
      suffix += generateSyllable(rng);
    }
  }
  return prefix + suffix;
}


// ─────────────────────────────────────────────────────────────────────
// SYSTEM NAME GENERATION
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a star system name.
 *
 * Distribution (~30% catalog, ~70% pronounceable):
 * - 20% catalog designations (HD 47832, GJ 1214, Kepler-442)
 * - 10% Greek letter + constellation (Alpha Draconis)
 * - 40% pronounceable generated words (Velorath, Syndara)
 * - 20% prefix-based names (Alderon, Cyrath)
 * - 10% pronounceable + title (Keth Prime, Syndara Reach)
 *
 * @param {SeededRandom} rng
 * @returns {string}
 */
function generateSystemName(rng) {
  const roll = rng.float();

  if (roll < 0.20) {
    // ── Catalog designation ──
    return _catalogName(rng);
  }

  if (roll < 0.30) {
    // ── Greek letter + constellation ──
    return rng.pick(GREEK_LETTERS) + ' ' + rng.pick(CONSTELLATIONS);
  }

  if (roll < 0.70) {
    // ── Pure pronounceable word ──
    return generateWord(rng, 2, 3);
  }

  if (roll < 0.90) {
    // ── Prefix-based name ──
    return generatePrefixedName(rng);
  }

  // ── Pronounceable + title suffix ──
  return generateWord(rng, 2, 2) + ' ' + rng.pick(SYSTEM_TITLES);
}

/**
 * Generate a catalog-style designation.
 */
function _catalogName(rng) {
  const catalog = rng.pick(CATALOG_FORMATS);

  // Some catalogs are single-word (like "Proxima")
  if (catalog.minNum === null) {
    return catalog.prefix;
  }

  const number = rng.int(catalog.minNum, catalog.maxNum);
  return catalog.prefix + catalog.separator + number;
}


// ─────────────────────────────────────────────────────────────────────
// STAR NAME GENERATION
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a star name. Usually the same as the system name, but
 * binary systems get suffixed with "A" / "B", and catalog systems
 * sometimes use spectral class notation.
 *
 * @param {SeededRandom} rng
 * @param {string} systemName - the parent system name
 * @param {string} spectralClass - e.g., 'G', 'M', 'O'
 * @param {boolean} isBinary - whether this is a binary system
 * @param {boolean} isPrimary - true for primary star, false for secondary
 * @returns {string}
 */
function generateStarName(rng, systemName, spectralClass, isBinary, isPrimary) {
  if (isBinary) {
    return systemName + ' ' + (isPrimary ? 'A' : 'B');
  }
  return systemName;
}


// ─────────────────────────────────────────────────────────────────────
// PLANET NAME GENERATION
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a planet name based on the system name and orbital index.
 *
 * Distribution:
 * - 55% letter suffix (Velorath b, Velorath c) — IAU convention
 * - 25% unique pronounceable name (Meridia, Voss)
 * - 10% system name + numeral (Velorath-3)
 * - 10% system name + descriptive (Velorath Prime, Velorath Minor)
 *
 * @param {SeededRandom} rng
 * @param {string} systemName
 * @param {number} index - 0-based orbital index
 * @param {number} totalPlanets - total number of planets in system
 * @returns {string}
 */
function generatePlanetName(rng, systemName, index, totalPlanets) {
  const roll = rng.float();
  const letter = index < PLANET_LETTERS.length
    ? PLANET_LETTERS[index]
    : String.fromCharCode(98 + index);  // b=98, continues past 'k'

  if (roll < 0.55) {
    // ── Letter suffix (most common — matches real convention) ──
    return systemName + ' ' + letter;
  }

  if (roll < 0.80) {
    // ── Unique name ──
    // Use a child RNG so the name is stable regardless of planet count
    const nameRng = rng.child('planet-name');
    return generateWord(nameRng, 2, 3);
  }

  if (roll < 0.90) {
    // ── Numeral suffix ──
    return systemName + '-' + (index + 1);
  }

  // ── Descriptive suffix ──
  // Only "Prime" for the first planet; others get various titles
  if (index === 0) {
    return systemName + ' Prime';
  }
  const descriptors = ['Minor', 'Outer', 'Far', 'Nova', 'Ultima'];
  return systemName + ' ' + rng.pick(descriptors);
}


// ─────────────────────────────────────────────────────────────────────
// MOON NAME GENERATION
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a moon name based on the planet name and moon index.
 *
 * Distribution:
 * - 40% Roman numeral suffix (Velorath b I, Velorath b II)
 * - 35% unique short name from the moon name pool (Io, Rhea, Nyx)
 * - 25% generated short name (1-2 syllables)
 *
 * @param {SeededRandom} rng
 * @param {string} planetName
 * @param {number} index - 0-based moon index
 * @param {number} totalMoons - total moons around this planet
 * @returns {string}
 */
function generateMoonName(rng, planetName, index, totalMoons) {
  const roll = rng.float();

  if (roll < 0.40) {
    // ── Roman numeral suffix ──
    const numeral = index < ROMAN_NUMERALS.length
      ? ROMAN_NUMERALS[index]
      : (index + 1).toString();
    return planetName + ' ' + numeral;
  }

  if (roll < 0.75) {
    // ── Pick from moon name pool ──
    // Use index as part of selection to avoid duplicates within a planet
    const poolIndex = (rng.int(0, MOON_NAMES.length - 1) + index) % MOON_NAMES.length;
    return MOON_NAMES[poolIndex];
  }

  // ── Generated short name ──
  const nameRng = rng.child('moon-name');
  return generateWord(nameRng, 1, 2);
}


// ─────────────────────────────────────────────────────────────────────
// HIGH-LEVEL API
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate all names for an entire star system.
 *
 * Returns a structured object with system, star(s), planet, and moon names
 * that are all deterministic from the given seed.
 *
 * @param {SeededRandom} rng - seeded RNG for this system
 * @param {object} systemData - the generated system data from StarSystemGenerator
 *   Expected shape: { star, star2, isBinary, planets: [{ planetData, moons }] }
 * @returns {object} names
 *   {
 *     system: string,
 *     star: string,
 *     star2: string | null,
 *     planets: [{ name: string, moons: string[] }]
 *   }
 */
function generateSystemNames(rng, systemData, overrideSystemName = null) {
  // Use a dedicated child RNG so naming doesn't interfere with other generation
  const nameRng = rng.child('names');

  // System name — use override if provided (e.g., from warp target selection)
  const systemName = overrideSystemName || generateSystemName(nameRng.child('system'));

  // Star names
  const starName = generateStarName(
    nameRng.child('star'),
    systemName,
    systemData.star.type,
    systemData.isBinary,
    true
  );

  let star2Name = null;
  if (systemData.isBinary && systemData.star2) {
    star2Name = generateStarName(
      nameRng.child('star2'),
      systemName,
      systemData.star2.type,
      systemData.isBinary,
      false
    );
  }

  // Planet and moon names
  const totalPlanets = systemData.planets.length;
  const planets = systemData.planets.map((planet, pi) => {
    const planetRng = nameRng.child(`planet-${pi}`);
    const planetName = generatePlanetName(planetRng, systemName, pi, totalPlanets);

    const totalMoons = planet.moons.length;
    const moonNames = planet.moons.map((moon, mi) => {
      const moonRng = planetRng.child(`moon-${mi}`);
      return generateMoonName(moonRng, planetName, mi, totalMoons);
    });

    return { name: planetName, moons: moonNames };
  });

  return {
    system: systemName,
    star: starName,
    star2: star2Name,
    planets,
  };
}


// ─────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────

export {
  generateSystemNames,
  generateSystemName,
  generateStarName,
  generatePlanetName,
  generateMoonName,
  generateWord,
  generatePrefixedName,
  generateSyllable,
};
