// tests/height-noise-transcription.test.js — drift-guard for the transcribed height noise.
//
// WHAT THIS PROTECTS. src/worldengine/shaders/heightNoise.glsl.js carries a VERBATIM copy of
// three GLSL functions — hash3(), noised() and fbmd() — that live in planet-lod-height.glsl.js.
// The game's planet shader uses the copy. Two copies of a numeric law is exactly the seam this
// lane keeps getting burned by, so the copy is not merely warned about in a comment: this test
// re-extracts the three functions from the source file and asserts BYTE-IDENTITY.
//
// WHY A COPY EXISTS AT ALL (and when to delete it). planet-lod-height.glsl.js exports one
// 239 KB GLSL string and imports nothing, so importing it to reach 3 KB of noise would cost
// ~76 KB gzip in the game bundle. The clean fix is to hoist these primitives into a module both
// sides import — but that means EDITING planet-lod-height.glsl.js, which feature/world-engine-atmo-3b
// is actively rewriting (+320 lines). Manufacturing a merge conflict to save 3 KB is a bad trade.
// ⭐ WHEN atmo-3b LANDS: do the hoist, delete the copy, and delete this test.
//
// HOW IT FAILS. Edit fbmd() (or noised(), or hash3()) in planet-lod-height.glsl.js and this test
// goes red with a diff. That is the intended behaviour — re-run the transcription, re-measure the
// game's relief, and re-commit. It is NOT a spurious failure to silence.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HEIGHT_NOISE_GLSL,
  HEIGHT_NOISE_SIGNATURES,
} from '../src/worldengine/shaders/heightNoise.glsl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(__dirname, '..', 'planet-lod-height.glsl.js');

// Brace-matching extractor. Deliberately dumb: find the signature, walk from its opening brace
// to the matching close. GLSL has no string or comment syntax that can contain an unbalanced
// brace in these three functions, so a counter is sufficient and needs no tokenizer.
function extractGlslFn(src, signature) {
  const start = src.indexOf(signature);
  if (start === -1) throw new Error(`signature not found in source: ${signature}`);
  if (src.indexOf(signature, start + 1) !== -1) {
    throw new Error(`signature is not unique in source: ${signature}`);
  }
  let i = src.indexOf('{', start);
  if (i === -1) throw new Error(`no opening brace for: ${signature}`);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces for: ${signature}`);
}

describe('height-noise transcription (game copy vs lab source of truth)', () => {
  const src = readFileSync(SOURCE, 'utf8');

  it('extracts all three signatures from planet-lod-height.glsl.js', () => {
    expect(HEIGHT_NOISE_SIGNATURES).toHaveLength(3);
    for (const sig of HEIGHT_NOISE_SIGNATURES) {
      expect(() => extractGlslFn(src, sig)).not.toThrow();
    }
  });

  it.each(HEIGHT_NOISE_SIGNATURES)('game copy is byte-identical to source: %s', (sig) => {
    const fromSource = extractGlslFn(src, sig);
    // The game copy must contain the source text verbatim — same bytes, same whitespace,
    // same comments. Substring rather than equality because the copy concatenates all three.
    expect(HEIGHT_NOISE_GLSL).toContain(fromSource);
  });

  it('game copy contains nothing but those three functions plus separators', () => {
    const joined = HEIGHT_NOISE_SIGNATURES.map((s) => extractGlslFn(src, s)).join('\n\n');
    expect(HEIGHT_NOISE_GLSL.trim()).toBe(joined.trim());
  });

  // The lane's standing trap: a stray backtick anywhere inside a GLSL template literal
  // terminates the template and the module fails to parse with a bare Rollup error that
  // surfaces as an unrelated test failure. Cheap to assert, expensive to debug.
  it('carries no backticks inside the GLSL payload', () => {
    expect(HEIGHT_NOISE_GLSL).not.toContain('`');
  });
});
