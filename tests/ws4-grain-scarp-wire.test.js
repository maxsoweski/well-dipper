// tests/ws4-grain-scarp-wire.test.js — WS4 T5 (D6): wire the BRANCH-GUARDED grain mix into the
// FIRST combiner (scarp) as the pattern every later combiner (T13) repeats.
//
// AC: grain-zero-identical (the byte-identical fallback) + one-shared-grain (partial).
//
// WHY a source-scan and not a pixel A/B here: the byte-identical fallback is a STRUCTURAL property
// of the GLSL, not a runtime tolerance. Per D6, at uTectonicGrainStrength==0 the ORIGINAL
// `normalize(uScarpAxis)` instruction stream must run VERBATIM — no textureCube fetch, no mix(), no
// precision drift — so the strength-0 path is bytewise the pre-WS4 shader. A ternary BRANCH (not a
// bare `mix`) is the only construct that guarantees this: `mix(a, sample, 0.0)` still EXECUTES the
// sampleGrainStrike() cube fetch, which on a null/uninitialised samplerCube can return NaN →
// `oldAxis + NaN*0 = NaN` → the fallback silently corrupts (the NaN-from-null-cube hazard, D6).
// The branch makes strength==0 skip the cube entirely. We assert that branch exists in the SHARED
// HEIGHT_GLSL source (consumed by BOTH the lab planet AND the router HEIGHT_FRAG), so the wiring is
// regression-proof at the source level. The runtime EXACT-equal A/B capture on :9223 is the LIVE
// deferred check (verify phase) — it cannot run headless (no GPU).
//
// HARD RULE: no Date.now / Math.random in derivation. (Not exercised here; the wiring is shader-only.)
import { describe, it, expect } from 'vitest';
import { HEIGHT_GLSL } from '../src/worldengine/shaders/height.glsl.js';

// Pull JUST the scarpCombiner body so assertions don't accidentally match another combiner.
function scarpCombinerBody(src) {
  const start = src.indexOf('void scarpCombiner(');
  expect(start, 'scarpCombiner must exist in HEIGHT_GLSL').toBeGreaterThanOrEqual(0);
  // walk to the matching close brace of the function
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

describe('WS4 T5 — branch-guarded grain mix wired into scarpCombiner (the pattern)', () => {
  it('declares the grain uniforms IN HEIGHT_GLSL (so the lab AND the router HEIGHT_FRAG both link)', () => {
    // scarpCombiner is called by ROUTER_MAIN too (planet-lod-rivers.js:129), so HEIGHT_FRAG =
    // HEIGHT_GLSL + ROUTER_MAIN must see these uniforms or the router material fails to compile.
    expect(HEIGHT_GLSL).toMatch(/uniform\s+float\s+uTectonicGrainStrength\s*;/);
    expect(HEIGHT_GLSL).toMatch(/uniform\s+samplerCube\s+uTectonicGrainCube\s*;/);
  });

  it('defines sampleGrainStrike() as ONE textureCube(uTectonicGrainCube, …) unpack to a world strike', () => {
    expect(HEIGHT_GLSL).toMatch(/vec3\s+sampleGrainStrike\s*\(\s*vec3\s+\w+\s*\)/);
    // the body must read the grain cube exactly via textureCube on the grain sampler
    const fnStart = HEIGHT_GLSL.indexOf('vec3 sampleGrainStrike');
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const fnSlice = HEIGHT_GLSL.slice(fnStart, fnStart + 600);
    expect(fnSlice).toMatch(/textureCube\s*\(\s*uTectonicGrainCube\b/);
  });

  it('scarpCombiner uses the BRANCH-GUARDED ternary (strength>0 ? mix : verbatim normalize(uScarpAxis))', () => {
    const body = scarpCombinerBody(HEIGHT_GLSL);
    // (1) a strength>0 guard precedes the cube fetch — strength==0 NEVER samples the cube.
    expect(body).toMatch(/uTectonicGrainStrength\s*>\s*0\.0\s*\?/);
    // (2) the strength>0 branch mixes the OLD axis toward the sampled grain strike, weighted by strength.
    expect(body).toMatch(/normalize\s*\(\s*mix\s*\(\s*uScarpAxis\s*,\s*sampleGrainStrike\s*\(\s*\w+\s*\)\s*,\s*uTectonicGrainStrength\s*\)\s*\)/);
    // (3) the strength==0 (else) branch is the EXACT pre-WS4 instruction: normalize(uScarpAxis), verbatim.
    expect(body).toMatch(/:\s*normalize\s*\(\s*uScarpAxis\s*\)\s*;/);
  });

  it('does NOT call mix()/textureCube UNGUARDED inside scarpCombiner (no bare mix-to-0 / unconditional fetch)', () => {
    const body = scarpCombinerBody(HEIGHT_GLSL);
    // every grain access in the combiner sits to the RIGHT of the `?` — i.e. there is no
    // textureCube / sampleGrainStrike call that is NOT inside the strength>0 branch. We approximate
    // by asserting the only textureCube/sampleGrainStrike usages appear after the ternary guard.
    // whitespace-tolerant: the `?` may sit on the next line from the `> 0.0` guard (formatting).
    const guardMatch = body.match(/uTectonicGrainStrength\s*>\s*0\.0\s*\?/);
    expect(guardMatch, 'the strength guard must come before any grain sample').not.toBeNull();
    const guardIdx = guardMatch.index;
    const before = body.slice(0, guardIdx);
    expect(before).not.toMatch(/sampleGrainStrike\s*\(/);
    expect(before).not.toMatch(/textureCube\s*\(\s*uTectonicGrainCube/);
  });

  it('preserves the rest of the scarp field math (warp/profile/provinceWeight untouched)', () => {
    const body = scarpCombinerBody(HEIGHT_GLSL);
    // the grain wiring touches ONLY the axis derivation; the directional field, warp, and
    // province amplitude must be byte-unchanged so strength==0 is the full pre-WS4 combiner.
    expect(body).toMatch(/float\s+field\s*=\s*dot\(pos,\s*ax\)\s*\+\s*uScarpWarp\s*\*\s*wn\.x;/);
    expect(body).toMatch(/provinceWeight\(PROV_SCARPS\)/);
  });
});
