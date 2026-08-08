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
// and changes it in exactly two ways, each for a measured reason:
//   1. STRINGS ARE PRESERVED, not blanked. That function blanks strings too, which is right for its
//      job (proving a file contains no `Math.random` call) and wrong for ours: we hand the surviving
//      text to `new Function` and must get back something that still compiles.
//   2. OFFSETS ARE PRESERVED. Output is BYTE-LENGTH-IDENTICAL to input — every comment character
//      becomes a space, every newline stays a newline. So `String.prototype.matchAll` indices, and
//      any existing `lineOf(src, index)` helper, resolve to the SAME line in stripped and raw source.
//      That is what lets the fence keep reporting true line numbers while scanning stripped text.
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

/**
 * Blank every comment in `src`, preserving byte offsets and every newline.
 *
 * Handles: `//` line comments, `/* *\/` block comments, `<!-- -->` HTML comments, single/double
 * quoted strings (with backslash escapes), template literals (with `${}` re-entry tracked by brace
 * depth so a nested backtick cannot close the template early), and regex literals.
 *
 * @param {string} src
 * @returns {string} same length as `src`; comment characters replaced by spaces, newlines kept.
 */
export function stripCommentsPreservingOffsets(src) {
  const out = new Array(src.length);
  let i = 0;
  const blank = (n) => { for (let k = 0; k < n && i + k < src.length; k++) out[i + k] = src[i + k] === '\n' ? '\n' : ' '; };
  const keep = (n) => { for (let k = 0; k < n && i + k < src.length; k++) out[i + k] = src[i + k]; };

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
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c || src[j] === '\n') { j++; break; }
        j++;
      }
      keep(j - i); i = j; continue;
    }
    if (c === '`') {                                     // template literal — preserved verbatim
      let j = i + 1, depth = 0;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (depth === 0 && src[j] === '`') { j++; break; }
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0 && src[j] === '{') depth++;
        if (depth > 0 && src[j] === '}') depth--;
        j++;
      }
      keep(j - i); i = j; continue;
    }
    if (c === '/' && looksLikeRegex(src, i)) {           // regex literal — preserved verbatim
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') { while (j < src.length && src[j] !== ']' && src[j] !== '\n') j++; continue; }
        if (src[j] === '/' || src[j] === '\n') { j++; break; }
        j++;
      }
      keep(j - i); i = j; continue;
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
