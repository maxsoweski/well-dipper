// scripts/lib/pretty-words.mjs — BUILD-TIME ONLY pretty-word generator.
//
// Emits short, pronounceable, sci-fi-flavoured proper words for the shipped
// named-systems catalog (increment 3e, ac5-decision.md Addendum 3):
//   • settled bare words   — "Veshara", "Vozara", "Kolnir" (2-3 syllables)
//   • greek-notable words   — the middle token of "Alpha Vozara 4821"
//
// DESIGN — mixed CV / CVC syllable alphabet, every syllable onset-initial:
//   Each syllable is  onset + vowel               (CV, open  → "ve", "ra", "zo")
//                 or  onset + vowel + coda         (CVC, closed → "kol", "nir")
//   Because every syllable begins with a consonant onset, concatenation reads
//   cleanly and the last-syllable open bias yields the "…ara / …ora" open-vowel
//   endings Max liked (Veshara / Vozara) alongside closed endings (Kolnir).
//
// UNIQUENESS is NOT claimed by construction here — it is the ratified property
// of a SHIPPED catalog: the build script feeds every candidate through a global
// used-word Set (seeded with the real-proper-name blocklist) and rejects any
// duplicate or blocklisted word (Addendum 3: "Duplicate-checked +
// real-proper-name-blocklisted AT BUILD TIME"). This generator only has to make
// the *supply* large and pretty; the caller enforces the hard guarantee.
//
// DETERMINISM — every draw goes through the caller's SeededRandom, so a fixed
// seed reproduces the exact catalog byte-for-byte.

// Onset consonants: singles + a few soft, readable clusters.
const ONSETS = [
  'b', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z',
  'th', 'sh', 'br', 'dr', 'kr', 'vr', 'sk', 'st', 'tr', 'ph', 'ny',
];

// Vowel nuclei — mostly single (open, pretty); a couple of soft glides.
const VOWELS = ['a', 'a', 'e', 'e', 'i', 'o', 'o', 'u', 'ae', 'ia', 'io'];

// Coda consonants for CVC syllables — sonorant-leaning so they transition well
// into the next onset (kills ugly stop clusters).
const CODAS = ['l', 'n', 'r', 's', 'th', 'k', 'm', 'd'];

const VOWELSET = new Set('aeiou');

// Light readability cleanup: collapse a tripled letter and break a run of 3+
// consonants — cheap, deterministic, string-only (mirrors NameGenerator smoothing).
function tidy(word) {
  let out = '';
  let run = 0;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (out.length && ch === out[out.length - 1] && ch === (out[out.length - 2] || '')) continue; // no triples
    if (VOWELSET.has(ch)) { run = 0; out += ch; }
    else { run++; if (run > 2) { out += 'a'; run = 1; } out += ch; }
  }
  return out;
}

/**
 * Make one pretty word (2-3 syllables). `rng` is a SeededRandom.
 * @param {{int:Function, pick:Function, chance:Function}} rng
 * @returns {string} Title-cased word, e.g. "Veshara"
 */
export function makePrettyWord(rng) {
  const n = rng.int(2, 3);
  let w = '';
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const onset = rng.pick(ONSETS);
    const vowel = rng.pick(VOWELS);
    // Open (CV) bias — stronger on the last syllable → open-vowel endings.
    const openChance = isLast ? 0.62 : 0.45;
    w += rng.chance(openChance) ? onset + vowel : onset + vowel + rng.pick(CODAS);
  }
  w = tidy(w);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export const _tables = { ONSETS, VOWELS, CODAS };
