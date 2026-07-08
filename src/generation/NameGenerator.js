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
 * The name is built from four region-weighted classes, each of which embeds the
 * full position "locator" L injectively (or, for the rare bare class, is drawn
 * from a finite partitioned supply indexed injectively by position):
 *
 *   (a) survey designation   "PVX J4K7Q2M+9XP3RWZ"   — the common case; a
 *       far-future catalogue ID: fictional survey prefix + J-epoch marker +
 *       two coordinate-style base-36 fields split by a latitude sign. Grouped
 *       and prefixed so it reads like a star-atlas entry, not an opaque serial.
 *   (b) multi-part fantasy   "Veskol-4K7Q2M9XP3"     — region word + position code
 *   (c) greek designation    "Theta Veskolnath 0421" — greek letter + region word
 *       + a short position-bit numeral (Bayer-style, sci-fi expanded)
 *   (d) bare fantasy word    "Veshakolnir"           — RARE settled-era name
 *
 * ── The bit floor (why designations are ~14-20 chars, not ~10) ──
 * L is a fully-injective function of position over a ~48 kpc × 32 kpc × 48 kpc
 * envelope quantized to Q = 4e-6 kpc: ~70 bits. Any injective rendering of 70
 * bits needs ~14 base-36 chars (or ~21 decimal digits). A short 2MASS-style
 * DECIMAL designation is therefore mathematically impossible while the hard
 * zero-duplicate guarantee holds — the win here is STRUCTURE (grouping / prefix /
 * sign / class variety), not brevity. See ac5-decision.md addendum ruling 1.
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

// Greek letters (Bayer-style, class c). 24 → 4.58 bits absorbed into the letter.
const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'];

// Region-weighted class mix: [survey, greek]; multipart = 1 − survey − greek.
// Re-expresses the ratified flavor (core catalog-heavy → rim fantasy-leaning) and
// restores the pre-3b greek class at ~10-15% (ac5 addendum ruling 3). Bare words
// are a rare overlay applied BEFORE this roll.
const REGION_CLASS_WEIGHTS = {
  core: [0.50, 0.15],   // survey .50, greek .15, multipart .35
  arm:  [0.28, 0.12],   // .28 / .12 / .60
  rim:  [0.13, 0.10],   // .13 / .10 / .77
  halo: [0.22, 0.13],   // .22 / .13 / .65
};

// Bare-fantasy sub-lattice: a position is bare-eligible iff each lattice coord
// hits a fixed residue mod BARE_M. Fraction eligible = 1/BARE_M³ = 1/16.78M → a
// real star is settled ~1 in 16.8M ≈ 12k galaxy-wide, uniformly spread.
const BARE_M = 256;
const BARE_RX = 91, BARE_RY = 37, BARE_RZ = 173;
const BARE_CX = 46876n, BARE_CY = 31251n, BARE_CZ = 46876n; // coarse radices: floor(Q*_MAX/BARE_M)+1
const BARE_TOTAL = BARE_CX * BARE_CY * BARE_CZ; // coarse cells ⇒ bi ∈ [0, BARE_TOTAL)
// Decorrelation unit: coprime to BARE_TOTAL (= 2⁴·3·11·947·11719²), so
// bi ↦ (bi·K) mod BARE_TOTAL is a BIJECTION on [0, BARE_TOTAL) — it scrambles
// which coarse-cell axis drives the high syllable, killing the "…co_" trailing
// cluster a thin region would otherwise show, WITHOUT changing the word length
// (range preserved) or breaking injectivity.
const BARE_MIX_K = 1000003n;

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

// Bijective base-2000 CVC word (injective, variable length) for a BigInt index.
// Fixed-width syllables ⇒ distinct index → distinct string. Realized indices
// (bare ≤2.75e14, greek ≤4.8e15) land at ~5 syllables (~15 chars).
function _sylWordBij(idxBig) {
  let n = idxBig + 1n; // bijective numeration: index 0 → single syllable
  let w = '';
  while (n > 0n) {
    const r = Number((n - 1n) % SYL_BASE_BIG);
    w += SYL[r];
    n = (n - 1n) / SYL_BASE_BIG;
  }
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function _bareEligible(qx, qy, qz) {
  return (qx % BARE_M === BARE_RX) && (qy % BARE_M === BARE_RY) && (qz % BARE_M === BARE_RZ);
}

// Coarse (bare-eligible) cell index for an eligible position — the injective key
// shared by _bareWord and enumerateSettledSystems.
function _bareCellIndex(region, qx, qy, qz) {
  const cx = Math.floor(qx / BARE_M);
  const cy = Math.floor(qy / BARE_M);
  const cz = Math.floor(qz / BARE_M);
  // Injective over the eligible sub-lattice: distinct eligible cells → distinct bi.
  const bi = BigInt(cx) + BARE_CX * (BigInt(cy) + BARE_CY * BigInt(cz));
  // Bijective decorrelation mix, then partition the word supply across the four
  // regions (disjoint residues mod 4). Both steps preserve injectivity.
  const mixed = (bi * BARE_MIX_K) % BARE_TOTAL;
  return mixed * 4n + BigInt(REGION_INDEX[region] ?? 1);
}

function _bareWord(region, qx, qy, qz) {
  return _sylWordBij(_bareCellIndex(region, qx, qy, qz));
}

// ── Injective per-class renderers of the locator L ──────────────────────────
// Each is injective in L; the class shapes are structurally disjoint (survey has
// " J" + sign; multipart has "-" and no space; greek has two spaces + a leading
// greek word; bare has no separator), so distinct L → distinct name across
// classes too. The class itself is a pure function of L (via _classRoll).

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

// (c) Greek designation: greek letter + region word + 5-digit numeral.
// numeral = low bits, letter = next bits, word = high bits — all injective.
// The 5-digit numeral keeps the word's index ≤ ~4.8e14 → ~5 syllables at ≤30%
// of the ~1.6e15 word supply (comfortably under the ≤50% margin).
function _greekName(L) {
  const numeral = Number(L % 100000n);
  const rest = L / 100000n;
  const letterIdx = Number(rest % 24n);
  const wordIdx = rest / 24n;
  return `${GREEK[letterIdx]} ${_sylWordBij(wordIdx)} ${String(numeral).padStart(5, '0')}`;
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
  const [wSurvey, wGreek] = weights;
  const roll = _classRoll(L);

  // (a) survey designation | (c) greek designation | (b) multi-part fantasy.
  // Each renderer embeds L injectively; the class is a pure function of L.
  if (roll < wSurvey) return _surveyName(L, galacticPos.y);
  if (roll < wSurvey + wGreek) return _greekName(L);
  return _multipartName(L);
}

/**
 * Enumerate every bare-word-eligible (settled) system within an axis-aligned
 * bounding volume — the deterministic, no-registry basis for a future in-game
 * "settled systems catalog / search" (that UI is OUT of scope, ac5 addendum
 * ruling 2). Each returned position quantizes back to its own eligible cell, so
 * its name ROUND-TRIPS through generateSystemName. Bare words are 1-in-16.8M, so
 * a modest box yields a handful; `maxResults` caps runaway galaxy-scale queries.
 *
 * @param {{xMin,xMax,yMin,yMax,zMin,zMax:number}} bounds - kpc, galactocentric
 * @param {number} [maxResults=20000]
 * @returns {Array<{ position:{x,y,z}, name:string, region:string }>}
 */
function enumerateSettledSystems(bounds, maxResults = 20000) {
  const axis = (min, max, bias, qmax, res) => {
    let qLo = _quant(min, bias, qmax);
    const qHi = _quant(max, bias, qmax);
    qLo += (((res - qLo) % BARE_M) + BARE_M) % BARE_M; // first value ≡ res (mod M)
    return { qLo, qHi };
  };
  const X = axis(bounds.xMin, bounds.xMax, X_BIAS, QX_MAX, BARE_RX);
  const Y = axis(bounds.yMin, bounds.yMax, Y_BIAS, QY_MAX, BARE_RY);
  const Z = axis(bounds.zMin, bounds.zMax, Z_BIAS, QZ_MAX, BARE_RZ);

  const out = [];
  for (let qz = Z.qLo; qz <= Z.qHi && out.length < maxResults; qz += BARE_M) {
    for (let qy = Y.qLo; qy <= Y.qHi && out.length < maxResults; qy += BARE_M) {
      for (let qx = X.qLo; qx <= X.qHi && out.length < maxResults; qx += BARE_M) {
        const position = {
          x: qx * Q_KPC - X_BIAS,
          y: qy * Q_KPC - Y_BIAS,
          z: qz * Q_KPC - Z_BIAS,
        };
        const name = generateSystemName(null, position);
        // Keep only genuine bare words. A real-name fall-through re-rolls into a
        // designation (has a space/dash/digit) — those are not settled names.
        if (!name.includes('-') && !name.includes(' ') && !/\d/.test(name)) {
          out.push({ position, name, region: _classifyRegion(position).region });
        }
      }
    }
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
  enumerateSettledSystems,
  _classifyRegion,
  _bareEligible,
};
