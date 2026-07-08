/**
 * NameGenerator — deterministic procedural name generation for star systems,
 * stars, planets, and moons.
 *
 * ── System names are UNIQUE BY CONSTRUCTION (increment 3b, ac5-decision.md) ──
 *
 * `generateSystemName(rng, galacticPos)` is a PURE, INJECTIVE function of the
 * system's canonical galactic position. Two consequences fall straight out of
 * that single property:
 *
 *   • AC6 (never the same name twice): distinct positions map to distinct names.
 *     There is no registry and no persistence — uniqueness is structural.
 *   • AC7 (revisit stability): the same star, reached by ANY targeting path
 *     (sky-click / NavComputer / feature route / screensaver / spawn), quantizes
 *     to the same position and therefore yields the same name, forever.
 *
 * The name is built from three region-weighted classes, each of which embeds the
 * full position "locator" injectively (or, for the rare bare class, is drawn from
 * a finite partitioned supply indexed injectively by position):
 *
 *   (a) catalog/survey designation  "PVX-4728391102847726"   — the common case
 *   (b) multi-part fantasy          "Bakiro-08F3K9Q2M7XA"    — word + code suffix
 *   (c) bare fantasy word           "Lyreonuki"              — RARE settled-era name
 *
 * A structural blocklist (src/generation/data/realProperNames.js) keeps the bare
 * class from ever emitting a real star's proper name (design req (d)).
 *
 * Star/planet/moon names still cascade off the (now unique) system name via
 * `generateSystemNames`, on the naming RNG's own forked stream — system CONTENTS
 * (StarSystemGenerator output) are never touched.
 *
 * See docs/NAMING_AND_REAL_OBJECTS.md and the injectivity test
 * (src/generation/__tests__/NameGenerator.injective.test.js) for the full picture.
 */

import { REAL_PROPER_NAME_SET } from './data/realProperNames.js';

// ─────────────────────────────────────────────────────────────────────
// PHONEME TABLES (used by the body-name generators: planet/moon words)
// ─────────────────────────────────────────────────────────────────────

// Onsets: consonant(s) that can start a syllable
const ONSETS = [
  'b', 'b', 'c', 'c', 'd', 'd', 'f', 'f', 'g', 'g',
  'h', 'h', 'j', 'k', 'k', 'l', 'l', 'm', 'm', 'n', 'n',
  'p', 'p', 'r', 'r', 's', 's', 't', 't', 'v', 'v', 'w', 'z',
  'br', 'ch', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr',
  'kh', 'ph', 'pr', 'sh', 'sk', 'sp', 'st', 'th', 'tr',
];

// Nuclei: vowel sounds (the core of each syllable)
const NUCLEI = [
  'a', 'a', 'a',
  'e', 'e', 'e',
  'i', 'i',
  'o', 'o', 'o',
  'u', 'u',
  'ae', 'ai', 'au', 'ea', 'ei', 'ia', 'io', 'ou',
];

// Codas: consonant(s) that can end a syllable (or empty for open syllable)
const CODAS = [
  '', '', '', '', '', '', '', '', '', '',
  'b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't',
  'x', 'z',
  'n', 'r', 's', 'l', 'n', 'r',
];

// Special endings that make names feel more "space-y"
const SPACE_SUFFIXES = [
  'ara', 'ath', 'eon', 'iel', 'ion', 'ius', 'ora', 'oth',
  'una', 'ura', 'yan', 'yx', 'enn', 'arr', 'oss', 'ull',
  'ax', 'ix', 'ox', 'ex', 'is', 'os', 'us', 'as',
  'al', 'el', 'il', 'ol', 'ul', 'an', 'en', 'in', 'on',
];

// Prefixes that evoke sci-fi/space flavor (used by generatePrefixedName, exported)
const FLAVOR_PREFIXES = [
  'Ald', 'Alt', 'Aur', 'Bel', 'Cen', 'Cor', 'Cyr', 'Del',
  'Dra', 'Eri', 'Eth', 'Gal', 'Hel', 'Hyp', 'Ith', 'Kep',
  'Lyr', 'Mer', 'Mir', 'Neb', 'Nol', 'Ori', 'Pol', 'Pyx',
  'Rig', 'Sag', 'Sel', 'Sig', 'Sol', 'Syr', 'Tau', 'Tel',
  'Tyr', 'Val', 'Vel', 'Vos', 'Xen', 'Zar', 'Zan', 'Zet',
];

// Planet letter suffixes (IAU convention: b, c, d, e, ...)
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
// CORE SYLLABLE / WORD HELPERS (body names + exported utilities)
// ─────────────────────────────────────────────────────────────────────

function generateSyllable(rng, isFirst = false) {
  const onset = rng.chance(isFirst ? 0.90 : 0.80) ? rng.pick(ONSETS) : '';
  const nucleus = rng.pick(NUCLEI);
  const coda = rng.pick(CODAS);
  return onset + nucleus + coda;
}

function smoothWord(word) {
  const vowels = 'aeiou';
  const isVowel = ch => vowels.includes(ch.toLowerCase());
  const breakVowels = ['a', 'i', 'e', 'o', 'u'];
  let breakIdx = 0;

  let result = '';
  let consonantRun = 0;

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (result.length > 0 && ch === result[result.length - 1]) continue;

    if (isVowel(ch)) {
      consonantRun = 0;
      result += ch;
    } else {
      consonantRun++;
      if (consonantRun > 2) {
        result += breakVowels[breakIdx % breakVowels.length];
        breakIdx++;
        consonantRun = 1;
      }
      result += ch;
    }
  }

  if (result.length > 10) result = result.slice(0, 10);
  return result;
}

function generateWord(rng, minSyllables = 2, maxSyllables = 3) {
  const count = rng.int(minSyllables, maxSyllables);
  let word = '';
  for (let i = 0; i < count; i++) {
    if (i === count - 1 && rng.chance(0.35)) {
      word += rng.pick(SPACE_SUFFIXES);
    } else {
      word += generateSyllable(rng);
    }
  }
  word = smoothWord(word);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function generatePrefixedName(rng) {
  const prefix = rng.pick(FLAVOR_PREFIXES);
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
// GALACTIC REGION CLASSIFICATION (region flavor for the class mix)
// ─────────────────────────────────────────────────────────────────────

/**
 * Classify a galactic position into a naming region. Region only steers the
 * class MIX (how catalog-heavy vs fantasy-leaning the names feel); it never
 * affects uniqueness. The `sectorCode` field is retained for backward
 * compatibility but is no longer consumed by naming.
 *
 * @param {{ x:number, y:number, z:number }} pos - galactocentric kpc
 * @returns {{ region:string, sectorCode:number }}
 */
function _classifyRegion(pos) {
  if (!pos) return { region: 'arm', sectorCode: 0 };
  const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
  const heightAbovePlane = Math.abs(pos.y);

  const sx = Math.floor(pos.x + 0.5);
  const sy = Math.floor(pos.y + 0.5);
  const sz = Math.floor(pos.z + 0.5);
  const sectorCode = ((sx * 73856093) ^ (sy * 19349663) ^ (sz * 83492791)) >>> 0;

  let region;
  if (heightAbovePlane > 2.0) region = 'halo';
  else if (distFromCenter < 3.0) region = 'core';
  else if (distFromCenter > 14.0) region = 'rim';
  else region = 'arm';

  return { region, sectorCode };
}

const REGION_INDEX = { core: 0, arm: 1, rim: 2, halo: 3 };


// ─────────────────────────────────────────────────────────────────────
// POSITION → INJECTIVE LOCATOR
// ─────────────────────────────────────────────────────────────────────
//
// Quantize the canonical position to a fixed integer lattice, then pack the
// three lattice coordinates into one BigInt "locator" L via mixed-radix. L is
// injective over the lattice: distinct cells → distinct L.
//
// Quantization resolution Q = 1e-6 kpc = 0.001 pc (~206 AU). This is FAR finer
// than the hash-grid starfield's smallest per-tier cell (M-type dwarfs, 0.0011
// kpc = 1.1 pc; HashGridStarfield.TYPE_CONFIG). Within any single spectral tier
// two distinct stars always live in different grid cells, so at least one of
// their (x,y,z) world coordinates differs — and because a tier's world
// coordinates are the discrete set {(cell + k/255)·cellSize}, that difference is
// at least cellSize/255 ≈ 4.3e-6 kpc for M-type, i.e. several Q-cells. The only
// way two DISTINCT stars can land in one Q-cell is a simultaneous sub-0.001-pc
// coincidence on ALL THREE axes (necessarily two different spectral tiers, whose
// grids are independent). Expected such coincidences galaxy-wide are ~10¹, and
// none is introduced by naming — see docs/NAMING_AND_REAL_OBJECTS.md §"collision
// physics". The naming function itself introduces ZERO collisions.

const Q_KPC = 1e-6;
const X_BIAS = 32, Y_BIAS = 16, Z_BIAS = 32;    // kpc, shift so lattice coords ≥ 0
const QX_MAX = 64_000_000, QY_MAX = 32_000_000, QZ_MAX = 64_000_000;
const NX = 64_000_001n, NY = 32_000_001n;        // radices = QX_MAX+1, QY_MAX+1

function _quant(v, bias, qmax) {
  let q = Math.round((v + bias) / Q_KPC);
  if (q < 0) q = 0; else if (q > qmax) q = qmax;
  return q;
}

/**
 * Quantize a galactic position to its stable lattice cell.
 * Exported so tests/census can dedupe samples by the SAME cell the namer uses.
 * @returns {{ qx:number, qy:number, qz:number, key:string }}
 */
function quantizePosition(galacticPos) {
  const qx = _quant(galacticPos.x, X_BIAS, QX_MAX);
  const qy = _quant(galacticPos.y, Y_BIAS, QY_MAX);
  const qz = _quant(galacticPos.z, Z_BIAS, QZ_MAX);
  return { qx, qy, qz, key: qx + ':' + qy + ':' + qz };
}

function _locate(galacticPos) {
  const { qx, qy, qz } = quantizePosition(galacticPos);
  const L = BigInt(qx) + NX * (BigInt(qy) + NY * BigInt(qz));
  return { qx, qy, qz, L };
}


// ─────────────────────────────────────────────────────────────────────
// INJECTIVE NAME RENDERERS
// ─────────────────────────────────────────────────────────────────────

// CV syllable alphabet (each entry EXACTLY two chars → unambiguous chunking →
// injective concatenation). 20 consonants × 5 vowels = 100 syllables.
const CV_CONS = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
  'n', 'p', 'r', 's', 't', 'v', 'w', 'x', 'z', 'y'];
const CV_VOW = ['a', 'e', 'i', 'o', 'u'];
const CV = [];
for (const c of CV_CONS) for (const v of CV_VOW) CV.push(c + v);
const CV_BASE = CV.length; // 100

// Fictional survey prefixes — deliberately NOT any real catalog (HD/HIP/HR/GJ/
// TYC/2MASS/SDSS/WISE/Gaia/TIC/KIC/GSC/UCAC/…) and never overlapping HYG proper
// names, so procgen catalog designations stay OUT of real designation space.
const SURVEY_PREFIXES = ['PVX', 'QRN', 'XND', 'ZTA', 'KRV', 'NBG', 'ODX', 'VLC', 'TRN', 'WGX'];

// Region-weighted class mix: [catalog/survey, multi-part fantasy]. Re-expresses
// the ratified flavor (core catalog-heavy → rim fantasy-leaning) over the new
// classes. Bare fantasy words are a rare overlay applied before this roll.
const REGION_CLASS_WEIGHTS = {
  core: [0.55, 0.45],
  arm:  [0.30, 0.70],
  rim:  [0.15, 0.85],
  halo: [0.25, 0.75],
};

// Bare-fantasy sub-lattice: a position is bare-eligible iff each lattice coord
// hits a fixed residue mod BARE_M. Fraction eligible = 1/BARE_M³ ≈ 6e-8 → bare
// words are genuinely rare AND uniformly spread across the galaxy (not clustered).
const BARE_M = 256;
const BARE_RX = 91, BARE_RY = 37, BARE_RZ = 173;
const BARE_CX = 250001n, BARE_CY = 125001n; // coarse radices: floor(Q*_MAX/BARE_M)+1

function _base36(bigval, width) {
  const s = bigval.toString(36).toUpperCase();
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

// Fixed 3-syllable CV word (base-100, injective) for wIdx in [0, 1_000_000).
function _cvWord3(wIdx) {
  let n = wIdx;
  const a = CV[n % CV_BASE]; n = Math.floor(n / CV_BASE);
  const b = CV[n % CV_BASE]; n = Math.floor(n / CV_BASE);
  const c = CV[n % CV_BASE];
  const w = a + b + c;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// Bijective base-100 CV word (injective, variable length) for a BigInt index.
function _cvWordBij(idxBig) {
  const base = BigInt(CV_BASE);
  let n = idxBig + 1n; // bijective numeration: index 0 → single syllable
  let w = '';
  while (n > 0n) {
    const r = Number((n - 1n) % base);
    w += CV[r];
    n = (n - 1n) / base;
  }
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function _bareEligible(qx, qy, qz) {
  return (qx % BARE_M === BARE_RX) && (qy % BARE_M === BARE_RY) && (qz % BARE_M === BARE_RZ);
}

function _bareWord(region, qx, qy, qz) {
  const cx = Math.floor(qx / BARE_M);
  const cy = Math.floor(qy / BARE_M);
  const cz = Math.floor(qz / BARE_M);
  // Injective over the eligible sub-lattice: distinct eligible cells → distinct bi.
  const bi = BigInt(cx) + BARE_CX * (BigInt(cy) + BARE_CY * BigInt(cz));
  // Partition the word supply across the four regions (disjoint residues mod 4).
  const fullIdx = bi * 4n + BigInt(REGION_INDEX[region] ?? 1);
  return _cvWordBij(fullIdx);
}

// Deterministic [0,1) class roll from the locator (independent of the rendering
// bits — it only selects which injective renderer runs).
function _classRoll(L) {
  let h = 2166136261 >>> 0;
  const s = L.toString();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967296;
}


// ─────────────────────────────────────────────────────────────────────
// SYSTEM NAME GENERATION — pure, injective function of position
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a star system name from its canonical galactic position.
 *
 * IMPORTANT: `rng` is intentionally IGNORED. Since increment 3b the name is a
 * pure, injective function of `galacticPos` alone — the seed-based rng that used
 * to drive naming (warp-star-<index>, warp-nav-<seed>, feat-<seed>, …) no longer
 * influences the result. That is exactly what makes every targeting path agree
 * on the same star's name and makes revisits stable. The parameter is retained
 * only for call-site/signature compatibility.
 *
 * @param {*} rng - IGNORED (kept for signature compatibility)
 * @param {{ x:number, y:number, z:number }} galacticPos - REQUIRED, in kpc
 * @returns {string}
 */
function generateSystemName(rng, galacticPos) {
  if (!galacticPos ||
      !Number.isFinite(galacticPos.x) ||
      !Number.isFinite(galacticPos.y) ||
      !Number.isFinite(galacticPos.z)) {
    // D5 eliminated: no silent no-position fallback. A missing position is a
    // caller bug — surface it loudly rather than minting a non-unique name.
    throw new Error('generateSystemName requires a finite canonical galacticPos {x,y,z} (no-position fallback eliminated per ac5-decision.md D5)');
  }

  const { region } = _classifyRegion(galacticPos);
  const { qx, qy, qz, L } = _locate(galacticPos);

  // (c) RARE bare fantasy word — injectively allocated from a finite,
  // region-partitioned supply. A per-position structural guard drops any
  // candidate equal to a real star's proper name (design (d)); because each name
  // is a pure function of its OWN position, this fall-through perturbs no other
  // draw (it is not rejection-sampling over a shared stream).
  if (_bareEligible(qx, qy, qz)) {
    const bare = _bareWord(region, qx, qy, qz);
    if (!REAL_PROPER_NAME_SET.has(bare.toLowerCase())) return bare;
    // else: fall through to a designation class (still globally unique).
  }

  const weights = REGION_CLASS_WEIGHTS[region] || REGION_CLASS_WEIGHTS.arm;
  const roll = _classRoll(L);

  if (roll < weights[0]) {
    // (a) positional/catalog survey designation — fictional prefix + a
    // position-derived, base-36 catalogue code (fixed width 15 → injective, and
    // spanning a range far past real designation space; real surveys top out
    // around ~360k HD numbers). Reads like a far-future deep-survey ID.
    const pfx = SURVEY_PREFIXES[Number(L % BigInt(SURVEY_PREFIXES.length))];
    return pfx + '-' + _base36(L, 15);
  }

  // (b) multi-part fantasy — short region-flavoured word + a designator that
  // carries the position-derived uniqueness bits (base-36 of the high locator).
  const wIdx = Number(L % 1000000n);
  const code = L / 1000000n;
  return _cvWord3(wIdx) + '-' + _base36(code, 12);
}


// ─────────────────────────────────────────────────────────────────────
// STAR / PLANET / MOON NAME GENERATION (cascade off the unique system name)
// ─────────────────────────────────────────────────────────────────────

function generateStarName(rng, systemName, spectralClass, isBinary, isPrimary) {
  if (isBinary) return systemName + ' ' + (isPrimary ? 'A' : 'B');
  return systemName;
}

function generatePlanetName(rng, systemName, index, totalPlanets) {
  const roll = rng.float();
  const letter = index < PLANET_LETTERS.length
    ? PLANET_LETTERS[index]
    : String.fromCharCode(98 + index);

  if (roll < 0.55) return systemName + ' ' + letter;

  if (roll < 0.80) {
    const nameRng = rng.child('planet-name');
    return generateWord(nameRng, 2, 3);
  }

  if (roll < 0.90) return systemName + '-' + (index + 1);

  if (index === 0) return systemName + ' Prime';
  const descriptors = ['Minor', 'Outer', 'Far', 'Nova', 'Ultima'];
  return systemName + ' ' + rng.pick(descriptors);
}

function generateMoonName(rng, planetName, index, totalMoons) {
  const roll = rng.float();

  if (roll < 0.40) {
    const numeral = index < ROMAN_NUMERALS.length
      ? ROMAN_NUMERALS[index]
      : (index + 1).toString();
    return planetName + ' ' + numeral;
  }

  if (roll < 0.75) {
    const poolIndex = (rng.int(0, MOON_NAMES.length - 1) + index) % MOON_NAMES.length;
    return MOON_NAMES[poolIndex];
  }

  const nameRng = rng.child('moon-name');
  return generateWord(nameRng, 1, 2);
}


// ─────────────────────────────────────────────────────────────────────
// HIGH-LEVEL API
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate all names for an entire star system.
 *
 * The system name is either the caller-supplied override (real name from a
 * KnownSystem / real-star catalog, which always wins) or the injective
 * position-derived procgen name. Star/planet/moon names cascade off it on the
 * naming RNG's own forked stream — system CONTENTS are never touched.
 *
 * @param {SeededRandom} rng - seeded RNG for body-name variety (system name is
 *   position-derived, not rng-derived)
 * @param {object} systemData - generated system data from StarSystemGenerator
 * @param {string|null} overrideSystemName - real name that wins over procgen
 * @param {{x,y,z}|null} galacticPos - REQUIRED when no override (canonical position)
 * @returns {{ system:string, star:string, star2:string|null, planets:Array }}
 */
function generateSystemNames(rng, systemData, overrideSystemName = null, galacticPos = null) {
  const nameRng = rng.child('names');

  // System name — override (real name) wins; otherwise derive injectively from
  // position. generateSystemName ignores the rng and requires a finite position.
  const systemName = overrideSystemName || generateSystemName(nameRng.child('system'), galacticPos);

  const starName = generateStarName(
    nameRng.child('star'),
    systemName,
    systemData.star.type,
    systemData.isBinary,
    true,
  );

  let star2Name = null;
  if (systemData.isBinary && systemData.star2) {
    star2Name = generateStarName(
      nameRng.child('star2'),
      systemName,
      systemData.star2.type,
      systemData.isBinary,
      false,
    );
  }

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

  return { system: systemName, star: starName, star2: star2Name, planets };
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
  quantizePosition,
  _classifyRegion,
};
