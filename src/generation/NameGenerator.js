/**
 * NameGenerator — deterministic procedural name generation for star systems,
 * stars, planets, and moons.
 *
 * ── System names are UNIQUE BY CONSTRUCTION (increment 3b/3e, ac5-decision.md) ──
 *
 * `generateSystemName(rng, galacticPos)` is a PURE function of the system's
 * canonical galactic position. Two consequences fall straight out of that single
 * property:
 *
 *   • AC6 (never the same name twice): distinct positions map to distinct names.
 *     There is no registry and no persistence — uniqueness is structural.
 *   • AC7 (revisit stability): the same star, reached by ANY targeting path
 *     (sky-click / NavComputer / feature route / screensaver / spawn), quantizes
 *     to the same position and therefore yields the same name, forever.
 *
 * ── Increment 3e: named-systems catalog + two procgen classes ──
 * Naming now resolves in this order for a position that reaches this function:
 *
 *   0. NAMED-SYSTEMS CATALOG (the FIFTH real-object mechanism) — a finite,
 *      build-time-authored table (src/generation/data/namedSystemsCatalog.js) of
 *      ~12k settled bare words ("Veshara") + greek notables ("Alpha Vozara 4821"),
 *      keyed by the SAME injective lattice locator this file uses. A synchronous
 *      lookup; if it hits, that shipped name wins over procgen. Its entries are
 *      duplicate-checked, blocklisted against real proper names, and key-unique
 *      AT BUILD TIME (see the build script). This is Max's "in setting, settled
 *      systems would be cataloged" made literal (ac5-decision.md Addendum 3).
 *   1. PROCGEN — the common case, now just TWO region-weighted classes, each of
 *      which embeds the full position locator L injectively:
 *        (a) survey designation   "PVX J4K7Q2M+9XP3RWZ" — fictional survey prefix
 *            + J-epoch marker + two coordinate-style base-36 fields split by a
 *            latitude sign; reads like a star-atlas entry (catalog-heavy regions).
 *        (b) multi-part fantasy   "Veskol-4K7Q2M9XP3"   — region word + position
 *            code (fantasy-leaning regions).
 *
 * The 3c runtime greek + bare classes are REMOVED: those name SHAPES now belong
 * exclusively to the shipped catalog, and procgen's survey/multipart shapes are
 * structurally disjoint from them (survey has " J" + sign, multipart has "-";
 * neither can match a bare "^[A-Z][a-z]+$" or greek "^Word Word \d+$" shape), so
 * a procgen name can never collide with a catalog name. Uniqueness end to end:
 * catalog uniqueness by build-time check; procgen injective in L; shapes disjoint.
 *
 * ── The bit floor (why designations are ~14-20 chars, not ~10) ──
 * L is a fully-injective function of position over a ~48 kpc × 32 kpc × 48 kpc
 * envelope quantized to Q = 4e-6 kpc: ~70 bits. Any injective rendering of 70
 * bits needs ~14 base-36 chars — so procgen designations are structured, not
 * short (the win is grouping / prefix / sign, not brevity). The catalog escapes
 * the bit floor precisely because it is a FINITE shipped set, not an injective
 * function of every eligible position (that impossibility is why 3d blocked and
 * 3e ships the catalog instead — ac5-decision.md Addendum 3).
 *
 * Star/planet/moon names still cascade off the (now unique) system name via
 * `generateSystemNames`, on the naming RNG's own forked stream — system CONTENTS
 * (StarSystemGenerator output) are never touched.
 *
 * See docs/NAMING_AND_REAL_OBJECTS.md and the injectivity test
 * (src/generation/__tests__/NameGenerator.injective.test.js) for the full picture.
 */

import { REAL_PROPER_NAME_SET } from './data/realProperNames.js';
import { namedSystemLookup, getNamedSystemsMap } from './data/namedSystemsCatalog.js';

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

// ─────────────────────────────────────────────────────────────────────
// POSITION → INJECTIVE LOCATOR
// ─────────────────────────────────────────────────────────────────────
//
// Quantize the canonical position to a fixed integer lattice, then pack the
// three lattice coordinates into one BigInt "locator" L via mixed-radix. L is
// injective over the lattice: distinct cells → distinct L.
//
// Quantization resolution Q = 4e-6 kpc = 0.004 pc (~825 AU). This is set to the
// minimum star spacing the finest grid can produce: the hash-grid starfield's
// smallest per-tier cell is M-type at 0.0011 kpc (1.1 pc; TYPE_CONFIG), and a
// tier's world coordinates form the discrete set {(cell + k/255)·cellSize}, so
// two DISTINCT same-tier stars differ on some axis by at least cellSize/255 =
// 0.0011/255 = 4.314e-6 kpc. Q = 4e-6 < that spacing → the two always land in
// different Q-cells (Δ ≥ 1 in Q-units ⇒ distinct quantized coords ⇒ distinct L).
// Injectivity for distinct same-tier stars is exact.
//
// (3c) Q was coarsened from increment 3b's 1e-6 to 4e-6 — authorized by
// ac5-decision.md addendum ruling 1 ("coarser quantization consistent with the
// minimum star spacing"). This trims the locator from ~78 to ~70 bits (one fewer
// designation char). The only cost is the CROSS-tier residual: two stars of
// DIFFERENT tiers (independent grids) coinciding within 0.004 pc on all three
// axes. Expected galaxy-wide ≈ 640 (up from ~10 at 1e-6), i.e. ~3e-9 of the
// ~2e11 stars — negligible, and invisible to the census (which samples arbitrary
// continuous positions, always injective over the lattice). The naming function
// itself still introduces ZERO collisions. See docs/NAMING_AND_REAL_OBJECTS.md.

const Q_KPC = 4e-6;
const X_BIAS = 24, Y_BIAS = 16, Z_BIAS = 24;    // kpc, shift so lattice coords ≥ 0
const QX_MAX = 12_000_000, QY_MAX = 8_000_000, QZ_MAX = 12_000_000; // ±24 / ±16 / ±24 kpc
const NX = 12_000_001n, NY = 8_000_001n;         // radices = QX_MAX+1, QY_MAX+1

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

// ── Catalog key (base-36 locator) ────────────────────────────────────────────
// The named-systems catalog is keyed by L.toString(36): a compact, injective key
// over the same lattice the namer quantizes to. `locatorKey` is the ONE function
// both the runtime lookup and the build script (scripts/gen-named-systems.mjs)
// use — that shared derivation is what makes a catalog entry hit in-game at the
// exact position it was authored for. `positionForKey` inverts it to a
// representative in-cell position (the cell's lower corner), which re-quantizes
// to the same key — the basis for round-trip verification and enumeration.

const _B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const _B36_VAL = {};
for (let i = 0; i < _B36.length; i++) _B36_VAL[_B36[i]] = i;

/** Injective base-36 locator key for a canonical galactic position. @returns {string} */
function locatorKey(galacticPos) {
  return _locate(galacticPos).L.toString(36);
}

function _parse36(s) {
  let n = 0n;
  for (let i = 0; i < s.length; i++) n = n * 36n + BigInt(_B36_VAL[s[i]] ?? 0);
  return n;
}

/**
 * Representative galactic position for a base-36 locator key (the quantized
 * cell's lower corner). It re-quantizes to the same key, so
 * `locatorKey(positionForKey(k)) === k`.
 * @returns {{x:number,y:number,z:number}}
 */
function positionForKey(key) {
  const L = _parse36(key);
  const qx = L % NX;
  const rem = L / NX;
  const qy = rem % NY;
  const qz = rem / NY;
  return {
    x: Number(qx) * Q_KPC - X_BIAS,
    y: Number(qy) * Q_KPC - Y_BIAS,
    z: Number(qz) * Q_KPC - Z_BIAS,
  };
}


// ─────────────────────────────────────────────────────────────────────
// INJECTIVE NAME RENDERERS
// ─────────────────────────────────────────────────────────────────────

// ── Curated syllable alphabet (bare + greek words) ──────────────────────────
// Every syllable is EXACTLY 3 chars (consonant-vowel-consonant), so a word built
// by concatenating syllables chunks unambiguously every 3 chars → the index→word
// map is injective (distinct syllable sequences → distinct strings). Codas are a
// clean sonorant/stop set that transitions well into the next onset, which fixes
// both 3b's monotonous "…ba …ba" tails AND ugly clusters. 20×5×11 = 1100
// syllables → bijective supply 1100 + 1100² + … + 1100⁵ ≈ 1.6e15.
const SYL_ONSET = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
  'n', 'p', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z'];
const SYL_VOWEL = ['a', 'e', 'i', 'o', 'u'];
const SYL_CODA = ['b', 'd', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't'];
const SYL = [];
for (const o of SYL_ONSET) for (const v of SYL_VOWEL) for (const c of SYL_CODA) SYL.push(o + v + c);
const SYL_BASE = SYL.length; // 1100
const SYL_BASE_BIG = BigInt(SYL_BASE);

// Fictional survey prefixes — deliberately NOT any real catalog (HD/HIP/HR/GJ/
// TYC/2MASS/SDSS/WISE/Gaia/TIC/KIC/GSC/UCAC/…) and never overlapping HYG proper
// names, so procgen designations stay OUT of real designation space.
const SURVEY_PREFIXES = ['PVX', 'QRN', 'XND', 'ZTA', 'KRV', 'NBG', 'ODX', 'VLC', 'TRN', 'WGX'];

// Region-weighted procgen class mix: survey fraction; multipart = 1 − survey.
// Re-expresses the ratified flavor (core catalog-heavy → rim fantasy-leaning),
// now rebalanced across just TWO procgen classes (increment 3e) — the removed 3c
// greek and bare runtime classes freed their share, absorbed here (core leans
// survey/catalog-style, rim leans multipart/fantasy). Region never affects
// uniqueness, only the class mix. The greek & bare SHAPES now belong to the
// shipped named-systems catalog exclusively.
const REGION_SURVEY_WEIGHT = {
  core: 0.70,   // survey .70, multipart .30 — formal, catalog-heavy
  arm:  0.45,   // .45 / .55 — default mix
  rim:  0.20,   // .20 / .80 — exotic, mostly fantasy
  halo: 0.35,   // .35 / .65 — archaic
};

function _base36(bigval, width) {
  const s = bigval.toString(36).toUpperCase();
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

// Exactly-2-syllable CVC word (base-2000, injective) for wIdx in [0, SYL_BASE²).
function _syl2Word(wIdx) {
  const a = SYL[wIdx % SYL_BASE];
  const b = SYL[Math.floor(wIdx / SYL_BASE) % SYL_BASE];
  const w = a + b;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ── Injective per-class renderers of the locator L ──────────────────────────
// Each is injective in L; the two procgen class shapes are structurally disjoint
// (survey has " J" + sign; multipart has "-" and no space), so distinct L →
// distinct name across classes too. The class itself is a pure function of L
// (via _classRoll). Both shapes are also disjoint from the catalog's bare and
// greek shapes, so procgen can never collide with a shipped catalog name.

// (a) Survey designation: prefix + " J" + two coordinate-style base-36 fields
// separated by a latitude sign. The 14-char base-36 field IS the full locator,
// so the (decorative) prefix and sign never affect uniqueness.
function _surveyName(L, y) {
  const pfx = SURVEY_PREFIXES[Number(L % BigInt(SURVEY_PREFIXES.length))];
  const c = _base36(L, 14);
  const sign = y >= 0 ? '+' : '-';
  return `${pfx} J${c.slice(0, 7)}${sign}${c.slice(7)}`;
}

// (b) Multi-part fantasy: 2-syllable region word (low bits) + "-" + base-36 code
// (high bits). Together they carry all of L injectively.
function _multipartName(L) {
  const S2 = SYL_BASE_BIG * SYL_BASE_BIG;
  const wIdx = Number(L % S2);
  const code = L / S2;
  return `${_syl2Word(wIdx)}-${_base36(code, 10)}`;
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
  const { L } = _locate(galacticPos);

  // (0) NAMED-SYSTEMS CATALOG — the fifth real-object mechanism. A synchronous
  // lookup on the same injective locator key; a shipped settled/notable name
  // wins over procgen. (KnownSystems and real-star names win EARLIER still — they
  // override before generateSystemName is ever reached, so this ordering realises
  // the precedence KnownSystems > real-star names > named-catalog > procgen.)
  const hit = namedSystemLookup(L.toString(36));
  if (hit !== undefined) return hit;

  // (1) PROCGEN — two region-weighted classes, each injective in L.
  const wSurvey = REGION_SURVEY_WEIGHT[region] ?? REGION_SURVEY_WEIGHT.arm;
  const roll = _classRoll(L);

  // (a) survey designation | (b) multi-part fantasy. The class is a pure function
  // of L; both shapes are disjoint from the catalog's bare/greek shapes.
  if (roll < wSurvey) return _surveyName(L, galacticPos.y);
  return _multipartName(L);
}

/**
 * Enumerate named-systems-catalog entries whose representative position falls in
 * an axis-aligned bounding volume — the deterministic basis for a future in-game
 * "settled/notable systems catalog / search" (that UI is OUT of scope, ac5
 * addendum ruling 2). Replaces increment 3c's procgen bare-word enumeration:
 * settled + notable systems are now the SHIPPED catalog, so enumeration reads it
 * directly. Each returned position round-trips through `generateSystemName`
 * (catalog hit). `maxResults` caps galaxy-scale queries.
 *
 * @param {{xMin,xMax,yMin,yMax,zMin,zMax:number}} bounds - kpc, galactocentric
 * @param {number} [maxResults=20000]
 * @returns {Array<{ position:{x,y,z}, name:string, region:string, key:string }>}
 */
function enumerateNamedSystems(bounds, maxResults = 20000) {
  const out = [];
  const map = getNamedSystemsMap();
  for (const [key, name] of map) {
    if (out.length >= maxResults) break;
    const position = positionForKey(key);
    if (position.x < bounds.xMin || position.x > bounds.xMax) continue;
    if (position.y < bounds.yMin || position.y > bounds.yMax) continue;
    if (position.z < bounds.zMin || position.z > bounds.zMax) continue;
    out.push({ position, name, region: _classifyRegion(position).region, key });
  }
  return out;
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
  locatorKey,
  positionForKey,
  enumerateNamedSystems,
  getNamedSystemsMap,
  _classifyRegion,
};
