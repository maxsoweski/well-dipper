// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE GLSL TEMPLATE-LITERAL FENCE.
//
// WHY THIS FILE EXISTS. A backtick inside a `/* glsl */` template literal TERMINATES THE STRING.
// The shader body is then parsed as JavaScript, and the error names a token from the middle of a
// shader comment — "Unexpected identifier 'result'", "Expected } but found if" — which points
// nowhere near the mistake and reads like a bug in unrelated code.
//
// It has happened FIVE times across two sessions (2026-09-06 x3, 2026-09-07 x2), every time from
// the same reflex: writing prose about code inside a shader and reaching for markdown backticks to
// quote an identifier. Use double quotes in shader comments instead.
//
// ⚠ NO OTHER GATE CATCHES IT. The unit suite compiles no GLSL. `esbuild` catches it only when the
// resulting JavaScript happens to be invalid; a backtick PAIR closes cleanly and yields a SILENTLY
// TRUNCATED SHADER, which is worse than a build failure because nothing reports it at all.
//
// HOW IT DETECTS. A stray backtick cannot be seen inside the body — by the time the parser is done,
// that backtick IS the terminator. What is detectable is where the literal ends: a correctly closed
// shader literal is followed by `,` `)` `;` `}` `]` or `.`, because it sits in an argument list or
// an object property. Shader text leaking out does not start with punctuation. So the check is on
// the terminator's successor, not on the body.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** Every .js under src/, excluding co-located test dirs. */
function sourceFiles(dir = SRC, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * Every `/* glsl *\/`-tagged template literal, as the JS PARSER sees it: from the opening backtick
 * to the very next one. That is deliberately naive — the parser is naive in exactly the same way,
 * and reproducing its view is the whole point.
 */
function glslLiterals(text) {
  const out = [];
  const marker = /\/\*\s*glsl\s*\*\/\s*`/g;
  let m;
  while ((m = marker.exec(text)) !== null) {
    const bodyStart = m.index + m[0].length;
    const close = findTerminator(text, bodyStart);
    if (close === -1) { out.push({ bodyStart, close: -1 }); break; }
    out.push({ bodyStart, close });
    marker.lastIndex = close + 1;
  }
  return out;
}

/**
 * The first backtick that actually ENDS the literal: one not escaped by a backslash.
 *
 * ⭐ AN ESCAPED BACKTICK IS LEGAL AND THIS CODEBASE USES THEM ON PURPOSE — planetShaders.glsl.js
 * quotes "logarithmicDepthBuffer" and "<common>" that way inside shader prose. The first version of
 * this fence treated them as terminators and reported three offences, ALL THREE FALSE. That is the
 * standing trap about a metric that measures the wrong thing reading perfectly plausible: three
 * confident, specific, wrong findings. The rule being enforced is "no UNESCAPED backtick", not
 * "no backtick".
 */
function findTerminator(text, from) {
  for (let i = from; i < text.length; i++) {
    if (text[i] !== '`') continue;
    let slashes = 0;
    for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) slashes++;
    if (slashes % 2 === 0) return i;   // even number of backslashes => the backtick is live
  }
  return -1;
}

/** What follows the closing backtick, ignoring whitespace. */
const successorOf = (text, close) => text.slice(close + 1).match(/^\s*(.)/)?.[1] ?? '';

/** 1-indexed line of an offset, so a failure names the real site. */
const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;

/** A shader literal always sits in an argument list, an object value, a ternary, or a chain. */
// `:` is legal too — Galaxy.js picks a fragment shader with a ternary, so one literal is the
// consequent and the next token is the colon before the alternate.
const LEGAL_SUCCESSORS = new Set([',', ')', ';', '}', ']', '.', ':']);

/** @returns {string[]} human-readable offences in one file's text */
function offencesIn(text, label) {
  const out = [];
  for (const { bodyStart, close } of glslLiterals(text)) {
    if (close === -1) {
      out.push(`${label}:${lineOf(text, bodyStart)} — unterminated GLSL template literal`);
      continue;
    }
    const next = successorOf(text, close);
    if (!LEGAL_SUCCESSORS.has(next)) {
      out.push(`${label}:${lineOf(text, close)} — shader literal ends before "${next}"; a backtick inside the GLSL closed it early. Use double quotes in shader comments.`);
    }
  }
  return out;
}

describe('GLSL template literals', () => {
  const files = sourceFiles();

  // ⭐ TRAP 18: A LIVENESS PROBE CAN ITSELF BE VACUOUS. If the walk or the marker regex ever stops
  // matching, every assertion below passes over an empty set and this file becomes a green light
  // wired to nothing. Pin the corpus before asserting anything about it.
  it('actually finds shader sources, so the fence is not vacuously green', () => {
    const withShaders = files.filter((f) => glslLiterals(readFileSync(f, 'utf8')).length > 0);
    expect(files.length).toBeGreaterThan(100);
    expect(withShaders.length).toBeGreaterThan(10);
  });

  it('are all closed where the parser expects, so no shader is silently truncated', () => {
    const offences = files.flatMap((f) => offencesIn(readFileSync(f, 'utf8'), relative(SRC, f)));
    expect(offences).toEqual([]);
  });

  // ⭐ NEGATIVE CONTROL — proves the assertion above can fail. Without this the test is an
  // untested test: it would stay green if `LEGAL_SUCCESSORS` grew a typo or the regex went stale.
  it('detects the exact mistake that has been made five times', () => {
    const sabotaged = [
      'const m = new THREE.ShaderMaterial({',
      '  fragmentShader: /* glsl */`',
      '    void main() {',
      '      // the `result` here terminates the string',
      '      gl_FragColor = vec4(1.0);',
      '    }',
      '  `,',
      '});',
    ].join('\n');
    expect(offencesIn(sabotaged, 'sabotaged.js')).toHaveLength(1);
    expect(offencesIn(sabotaged, 'sabotaged.js')[0]).toMatch(/closed it early/);

    // And the same file with quotes instead of backticks is clean.
    expect(offencesIn(sabotaged.replace(/`result`/, '"result"'), 'fixed.js')).toEqual([]);
  });
});
