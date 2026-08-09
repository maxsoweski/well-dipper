// tests/helpers/source-scan.mjs — shared source-text scanning primitives for the source-execution
// fences (tests/radius-live-feed.test.js, tests/radius-live-feed-fence.test.js).
//
// ⛔ WHY THIS FILE EXISTS. Both of those suites read the LAB'S OWN SOURCE TEXT and either execute it
// (`new Function`) or DENY-scan it. Both took the FIRST regex match in the whole file with no notion of
// what is live code and what is a comment. Measured 2026-08-08 against a scratch mirror: moving a law
// out of `applyDrivers` while quoting the old statement verbatim in a `//` or `/* */` comment — which
// is the lab's OWN established habit, 7 instances, e.g. planet-lod-lab.html:6160-6161 — left the
// extraction suite at 44/44 GREEN, compiling and measuring DEAD COMMENT TEXT. Six sites, six mutants,
// all green. PLAN §4 Steps 4 and 5 both declare they will move lab code out. That is the hole.
//
// ⚠ THIS IS NOT THE SAME REQUIREMENT AS "the extraction matched a non-empty string". Every one of
// those six mutants matched a LONG non-empty string. The non-empty clause is worth having and it is
// not the fix; do not let it read as one.
//
// ── PROMOTED, NOT INVENTED ────────────────────────────────────────────────────────────────────────
// Three comment-strippers already existed in tests/. This promotes the only sound one — the character
// state machine at tests/port-route-agreement.test.js:83 `function stripCommentsAndStrings(src) {` —
// and changes it in exactly three ways, each for a measured reason:
//   1. STRINGS ARE PRESERVED, not blanked. That function blanks strings too, which is right for its
//      job (proving a file contains no `Math.random` call) and wrong for ours: we hand the surviving
//      text to `new Function` and must get back something that still compiles.
//   2. OFFSETS ARE PRESERVED. Output is BYTE-LENGTH-IDENTICAL to input — every comment character
//      becomes a space, every newline stays a newline. So `String.prototype.matchAll` indices, and
//      any existing `lineOf(src, index)` helper, resolve to the SAME line in stripped and raw source.
//      That is what lets the fence keep reporting true line numbers while scanning stripped text.
//   3. `${…}` IS LEXED BY RE-ENTRY, not by a brace counter. Added 2026-08-09, after round 2 of PLAN
//      §11.4 measured what the counter cost: see the LITERAL SPAN SCANNERS block below. The promoted
//      function does not track `${…}` AT ALL — it treats a backtick like a quote and ends the
//      template at the next one — which is a related mis-lex, not the same one. It is left alone
//      because nothing this program owns has measured its consumer, and quietly editing a fence that
//      already passes is the move this file exists to stop.
// The two regex-based strippers in the tree (tests/worldengine-v2-3-dispatch-oracle.test.js:242 and
// tests/relief-router-repoint.test.js:48 `function stripComments(src) {`) are NOT usable here and the
// reason is measured, not stylistic: planet-lod-lab.html has 104 lines carrying `//` INSIDE a string
// literal, 98 lines with backticks, 6 `/* glsl */` template literals and 3 regex literals. A regex
// stripper eats live code on every one of them.
//
// ── THE AMBIGUITY RULE, STATED ONCE ───────────────────────────────────────────────────────────────
// JavaScript cannot be lexed without parsing (`/` is regex-or-division; a template's `${}` re-enters
// code). Every ambiguity here resolves toward PRESERVING TEXT. That direction is chosen because of
// what each consumer does with a wrong answer:
//   · preserve too much ⇒ the extractor may match a comment it should have ignored ⇒ the shadow test
//     goes RED and names the site. Loud.
//   · blank too much ⇒ an extraction fails, or an allowlist entry reads as non-live ⇒ RED. Loud.
// Neither direction can produce a silent green, which is the only property this file is required to
// have. It is a scanner for a fence, NOT a JavaScript parser, and it must never be described as one.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Is `/` at index i a regex literal rather than a division? Decided from the last significant
// character, plus one hard guard: a regex literal cannot contain an unescaped newline, so if the
// candidate never closes on its own line it was division. That guard is what keeps `a / b / c` from
// swallowing the rest of the line.
const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+',
                                 '-', '*', '%', '~', '^', '<', '>', '\n']);
const REGEX_KEYWORDS = /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;

function looksLikeRegex(src, i) {
  let j = i - 1;
  while (j >= 0 && (src[j] === ' ' || src[j] === '\t')) j--;
  if (j < 0) return true;
  const prev = src[j];
  if (!REGEX_PRECEDERS.has(prev) && !REGEX_KEYWORDS.test(src.slice(Math.max(0, j - 12), j + 1))) return false;
  // The newline guard: scan forward for an unescaped closing `/` before the line ends.
  for (let k = i + 1; k < src.length; k++) {
    if (src[k] === '\\') { k++; continue; }
    if (src[k] === '\n') return false;          // never closed on this line ⇒ it was division
    if (src[k] === '[') { while (k < src.length && src[k] !== ']' && src[k] !== '\n') k++; continue; }
    if (src[k] === '/') return true;
  }
  return false;
}

// ── LITERAL SPAN SCANNERS ────────────────────────────────────────────────────────────────────────
// Each returns the index ONE PAST the literal that starts at `i`, or `src.length` if it never closes.
// They are separate functions rather than inline arms for one measured reason: a `${…}` interpolation
// is CODE, so the things that can appear inside it are the same things the main loop handles, and the
// only way to lex a nested template correctly is to re-enter. Round 2 of PLAN §11.4 measured what the
// previous single-integer `depth` cost: a nested template whose TEXT carries an unbalanced `}` — the
// fixture at tests/source-scan-helper.test.js `a nested template in an interpolation is lexed whole`
// — decremented the OUTER template's brace count, so the outer template was declared closed at the
// NESTED one's closing backtick. Backtick parity inverted for the rest of the file, a later real
// template's contents were scanned as live code, and a law parked there became the single match
// again: three suites at 171 passed (171) on a mutant with the band law moved out and parked there.
// Measured 2026-08-09 over 20,000 valid-JS snippets carrying nested templates: the old arm let a
// top-level `// SENTINEL` comment survive as template text in 6,147; these three let it survive in 0.
// Over all 44 corpus files the two lexers are BYTE-IDENTICAL on both passes.
//
// ⚠ EACH FUNCTION ADVANCES BY AT LEAST ONE CHARACTER PER CALL, which is what makes the mutual
// recursion terminate: `templateEnd(src, j)` is only ever called at a backtick and returns
// ≥ j+1, and `interpolationEnd(src, j + 2)` returns ≥ j+2. Recursion depth is the input's literal
// NESTING depth, not its length.

/** `src[i]` is `'` or `"`. Quoted strings end at their quote or at a newline — never at EOF alone. */
function stringEnd(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === q || src[j] === '\n') { j++; break; }
    j++;
  }
  return j;
}

/** `src[i]` is a backtick. Delegates every `${…}` to `interpolationEnd`, which may re-enter here. */
function templateEnd(src, i) {
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === '`') { j++; break; }
    if (src[j] === '$' && src[j + 1] === '{') { j = interpolationEnd(src, j + 2); continue; }
    j++;
  }
  return j;
}

/**
 * `i` is the index just past `${`. Returns the index just past the matching `}`.
 *
 * Braces are counted, and the two things that can HIDE a brace from the count — a nested template and
 * a quoted string — are skipped whole by the scanners above.
 *
 * ⚠ NAMED LIMIT, MEASURED, so it is accepted rather than forgotten: a comment or a REGEX LITERAL
 * inside an interpolation is NOT skipped, so an unbalanced `}` or backtick inside one still miscounts
 * — the same parity inversion, one container in. Corpus reach measured 2026-08-09 over all 44 corpus
 * files: 149 interpolation spans, of which 0 carry `//` or `/*`, 0 carry any `/` at all (so neither a
 * regex nor a division), and 0 carry a backtick. It is left because closing it means re-deciding the
 * regex-or-division ambiguity inside interpolations, and a bug in THAT is the same silent class this
 * file exists to close. What it is NOT is the old hole: those two containers are adversarial, whereas
 * a nested template in an interpolation is ordinary JavaScript.
 */
function interpolationEnd(src, i) {
  // ⚠ NO ESCAPE ARM HERE, deliberately, and it is the one asymmetry with the two scanners above. A
  // backslash is only meaningful INSIDE a literal, and both literal kinds are skipped whole below —
  // so an escape arm here would be a branch no case could kill, which is the thing PLAN §11.3.2 is
  // about. `\` in expression position is not valid JavaScript.
  let depth = 1, j = i;
  while (j < src.length) {
    if (src[j] === '`') { j = templateEnd(src, j); continue; }
    if (src[j] === "'" || src[j] === '"') { j = stringEnd(src, j); continue; }
    if (src[j] === '{') { depth++; j++; continue; }
    if (src[j] === '}') { depth--; j++; if (depth === 0) return j; continue; }
    j++;
  }
  return j;
}

/**
 * Blank every comment in `src`, preserving byte offsets and every newline.
 *
 * Handles: `//` line comments, `/* *\/` block comments, `<!-- -->` HTML comments, single/double
 * quoted strings (with backslash escapes), template literals (whose `${…}` interpolations are lexed
 * by `interpolationEnd`, which counts braces and skips nested templates and strings whole), and
 * regex literals.
 *
 * ⭐ `opts.blankLiteralText` — ADDED 2026‑08‑08 AFTER ROUND 1 PROVED THE SHADOW CLASS WAS STILL OPEN.
 * Stripping comments alone closes the shadow only for comments OUTSIDE a literal. Literals are
 * preserved (they must be — the surviving text is handed to `new Function` and has to compile), so a
 * retired law parked INSIDE a template survives stripping and becomes the single "live" match the
 * moment the real one is moved out. Not hypothetical: measured 2026-08-09, the lab carries **21
 * comment lines that survive stripping** (3,264 raw, 21 after the default pass, 0 after this one),
 * all inside its own `/* glsl *\/` templates, and text parked in a template needs
 * no comment markers at all — it is simply string content. MEASURED: moving the cloud-regime block
 * out of `applyDrivers` and parking it verbatim in a template left the extraction suite at
 * **50 passed (50)**, measuring the dead copy.
 *
 * With `blankLiteralText: true` the DELIMITERS are kept and the INTERIOR is blanked, so the result is
 * for MATCHING ONLY — never for compiling. Callers match on this pass, then slice the captured body
 * out of the default pass at the same offsets; both passes are byte-length-identical, so the splice
 * is exact.
 *
 * ⚠ NAMED LIMIT: `${…}` interpolations are blanked along with the surrounding text rather than being
 * treated as the live code they are. Deliberate, and it is the fail-CLOSED direction: a law that ever
 * moves into an interpolation becomes unmatchable, which surfaces as EXTRACTION FAILED naming the
 * site — loud — never as a silent green. ⚠ Their EXTENT is now lexed exactly (`interpolationEnd`);
 * what is deliberate is that their CONTENTS are blanked with the rest of the literal. Emitting them
 * as live code would mean deciding, for every `${…}`, whether the text inside is an expression this
 * file may hand onward — and the two directions of THAT judgement are not both loud.
 *
 * ⚠ `opts.blankLiteralText` IS READ AS A PLAIN TRUTHY, deliberately, and the direction is the point:
 * a caller who passes `1` or a non-empty string gets the MATCHING pass. It used to be `=== true`, so
 * a truthy non-`true` value silently fell back to the DEFAULT pass — matching on unblanked literals,
 * which is precisely the shadow this option exists to close, arriving through a truthiness bug
 * instead of a lexing one. Round 2 of PLAN §11.4 measured that strictness as an unkillable branch:
 * relaxing it to `!!` left the suite at 45 passed (45). It is now pinned by a case.
 *
 * @param {string} src
 * @param {{blankLiteralText?: boolean}} [opts]
 * @returns {string} same length as `src`; blanked characters replaced by spaces, newlines kept.
 */
export function stripCommentsPreservingOffsets(src, opts = {}) {
  const blankLiteralText = !!opts.blankLiteralText;
  const out = new Array(src.length);
  let i = 0;
  const blank = (n) => { for (let k = 0; k < n && i + k < src.length; k++) out[i + k] = src[i + k] === '\n' ? '\n' : ' '; };
  const keep = (n) => { for (let k = 0; k < n && i + k < src.length; k++) out[i + k] = src[i + k]; };
  // Keep a literal's opening and (if present) closing delimiter, blank everything between. Newlines
  // survive, so line numbers agree with the default pass character for character.
  const literal = (n, delim) => {
    if (!blankLiteralText) { keep(n); return; }
    blank(n);
    out[i] = src[i];
    const last = i + n - 1;
    if (n > 1 && src[last] === delim) out[last] = src[last];
  };

  while (i < src.length) {
    const c = src[i], c2 = src[i + 1];

    if (c === '/' && c2 === '/') {                       // line comment
      let j = i; while (j < src.length && src[j] !== '\n') j++;
      blank(j - i); i = j; continue;
    }
    if (c === '/' && c2 === '*') {                       // block comment
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? src.length : j + 2;
      blank(j - i); i = j; continue;
    }
    if (c === '<' && src.startsWith('<!--', i)) {        // HTML comment
      let j = src.indexOf('-->', i + 4);
      j = j === -1 ? src.length : j + 3;
      blank(j - i); i = j; continue;
    }
    if (c === "'" || c === '"') {                        // quoted string — preserved verbatim
      const j = stringEnd(src, i);
      literal(j - i, c); i = j; continue;
    }
    if (c === '`') {                                     // template literal — preserved verbatim
      const j = templateEnd(src, i);
      literal(j - i, '`'); i = j; continue;
    }
    if (c === '/' && looksLikeRegex(src, i)) {           // regex literal — preserved verbatim
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') { while (j < src.length && src[j] !== ']' && src[j] !== '\n') j++; continue; }
        if (src[j] === '/' || src[j] === '\n') { j++; break; }
        j++;
      }
      literal(j - i, '/'); i = j; continue;
    }

    out[i] = c; i++;
  }
  return out.join('');
}

/**
 * Every `.js` file under `rel`, recursively, repo-relative and sorted.
 *
 * ⛔ COPIED FROM THE HOUSE IDIOM, tests/vis-scale-fence.test.js:36 `function jsFilesUnder(rel) {`,
 * rather than reinvented — that fence already walks this exact tree for the same reason. Sorting is
 * added here so a corpus listing printed in a failure message is stable between runs.
 *
 * ⚠ NAMED LIMIT, so it is accepted rather than forgotten. vis-scale-fence pairs this walker with
 * `expect(files.length).toBeGreaterThan(20)`, which is a THRESHOLD, not a corpus check: measured
 * 2026-08-08 the tree holds 42 files, so that guard survives losing HALF the tree and still proves
 * only that the walker ran. Any fence that needs to know its subject is INTACT must additionally
 * assert per-carrier — a named file list, each required to hold ≥1 hit. See
 * tests/radius-live-feed-fence.test.js `REQUIRED_CARRIERS`.
 *
 * @param {string} root absolute repo root
 * @param {string} rel  repo-relative directory
 * @returns {string[]} repo-relative paths, sorted
 */
export function jsFilesUnder(root, rel) {
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(join(root, d), { withFileTypes: true })) {
      const child = `${d}/${ent.name}`;
      if (ent.isDirectory()) walk(child);
      else if (ent.name.endsWith('.js')) out.push(child);
    }
  };
  walk(rel);
  return out.sort();
}

/** index → 1-based line number. Offset-preserving stripping means this agrees on raw and stripped. */
export function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}
