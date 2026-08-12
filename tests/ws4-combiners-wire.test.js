// tests/ws4-combiners-wire.test.js — WS4 T13: wire the remaining FIVE combiners (chasma/canyon,
// tessera, lava, cryo) + the orogeny vec2 xz-projection special case with the BRANCH-GUARDED grain
// mix, and add the IN-SHADER gProvince rotation (D4 move-1 — the ONLY within-body 2D-not-bands source)
// to every grained combiner (scarp included, retrofitted).
//
// AC: one-shared-grain (integration/live — this test is the source-audit half), grain-zero-identical
// (must stay green — strength==0 is bytewise the pre-WS4 shader in EVERY grained combiner), and
// renderer-expression-only (the six grained combiners derive strike through the shared cube, not a
// raw per-feature hash).
//
// WHY a source-scan (same rationale as the T5 scarp-wire test): byte-identical fallback is a
// STRUCTURAL property of the GLSL, not a runtime tolerance. At uTectonicGrainStrength==0 the ORIGINAL
// normalize(uXxxAxis) instruction stream must run VERBATIM in each combiner — no textureCube fetch, no
// mix(), no province rotation, no precision drift. A ternary BRANCH (not a bare mix-to-0) is the only
// construct that guarantees this. The runtime EXACT-equal A/B capture + the grainProbe correlation
// (one cube feeds N consumers, all move together under perturbation) are the LIVE deferred checks on
// :9223 — they cannot run headless (no GPU).
//
// HARD RULE: no Date.now / Math.random in derivation (shader-only wiring here; not exercised).
import { describe, it, expect } from 'vitest';
import { HEIGHT_GLSL } from '../src/worldengine/shaders/height.glsl.js';

// Pull JUST one function body by name so assertions can't bleed across combiners.
function fnBody(src, decl) {
  const start = src.indexOf(decl);
  expect(start, `${decl} must exist in HEIGHT_GLSL`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// Every grained combiner that takes a vec3 axis follows the SAME branch-guarded shape:
//   vec3 <axVar> = uTectonicGrainStrength > 0.0
//     ? grainProvinceRotate(normalize(mix(<uniform>, sampleGrainStrike(<pos>), uTectonicGrainStrength)), <pos>)
//     : normalize(<uniform>);
// We assert (1) the strength>0 guard precedes any cube fetch, (2) the >0 branch mixes the OLD axis
// toward the sampled grain strike weighted by strength AND rotates it by the in-fragment province,
// (3) the ==0 (else) branch is the EXACT pre-WS4 normalize(<uniform>), (4) no UNGUARDED grain access.
function assertVec3Grained(body, axUniform) {
  // (1) a strength>0 guard
  expect(body, `${axUniform}: needs a strength>0 guard`).toMatch(/uTectonicGrainStrength\s*>\s*0\.0\s*\?/);
  // (2) the >0 branch: mix(<axUniform>, sampleGrainStrike(...), strength), wrapped in normalize, then
  //     province-rotated. Whitespace/newline tolerant; the uniform may be indexed (e.g. uChasmaAxis[i]).
  const uRe = axUniform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mixRe = new RegExp(
    'mix\\s*\\(\\s*' + uRe + '\\s*,\\s*sampleGrainStrike\\s*\\(\\s*\\w+\\s*\\)\\s*,\\s*uTectonicGrainStrength\\s*\\)'
  );
  expect(body, `${axUniform}: >0 branch must mix the old axis toward sampleGrainStrike`).toMatch(mixRe);
  // province rotation composed in-shader against the REAL gProvince (D4 move-1)
  const rotRe = new RegExp('grainProvinceRotate\\s*\\(\\s*normalize\\s*\\(\\s*' + mixRe.source + '\\s*\\)');
  expect(body, `${axUniform}: the grained strike must be grainProvinceRotate(normalize(mix(...)))`).toMatch(rotRe);
  // (3) the else branch = verbatim normalize(<axUniform>)
  const elseRe = new RegExp(':\\s*normalize\\s*\\(\\s*' + uRe + '\\s*\\)\\s*;');
  expect(body, `${axUniform}: ==0 branch must be verbatim normalize(${axUniform})`).toMatch(elseRe);
  // (4) no UNGUARDED grain access — every sampleGrainStrike/textureCube sits to the RIGHT of the guard
  const g = body.match(/uTectonicGrainStrength\s*>\s*0\.0\s*\?/);
  expect(g, `${axUniform}: guard must precede any grain sample`).not.toBeNull();
  // For multi-axis combiners (tessera/cryo) there are two guards; check NOTHING before the FIRST.
  const before = body.slice(0, g.index);
  expect(before, `${axUniform}: no sampleGrainStrike before the first guard`).not.toMatch(/sampleGrainStrike\s*\(/);
  expect(before, `${axUniform}: no raw grain-cube fetch before the first guard`).not.toMatch(/textureCube\s*\(\s*uTectonicGrainCube/);
}

describe('WS4 T13 — in-shader province rotation helper (the only within-body 2D-not-bands source)', () => {
  it('defines grainProvinceRotate(strike, pos) — rotates the cube strike by the in-fragment gProvince', () => {
    // The helper turns the latitude-banded base strike into 2D landforms keyed to where the macroSeed
    // provinces actually sit (D4 move-1). It reads the REAL gProvince the renderer uses (single source
    // of truth on the GPU) — it must NEVER re-derive or replace gProvince.
    expect(HEIGHT_GLSL).toMatch(/vec3\s+grainProvinceRotate\s*\(\s*vec3\s+\w+\s*,\s*vec3\s+\w+\s*\)/);
    const start = HEIGHT_GLSL.indexOf('vec3 grainProvinceRotate');
    expect(start).toBeGreaterThanOrEqual(0);
    const slice = HEIGHT_GLSL.slice(start, start + 900);
    // it reads gProvince (composes orientation against the real province field) ...
    expect(slice).toMatch(/gProvince\b/);
    // ... and produces a rotation (a strike-keyed angle) — sin/cos of a province-derived angle.
    expect(slice).toMatch(/\bcos\s*\(/);
    expect(slice).toMatch(/\bsin\s*\(/);
  });

  it('vec2 sibling grainProvinceRotate2 for the orogeny xz-plane axis (vec2 special case)', () => {
    // fbmdRidged reads uOrogenyAxis as a vec2 in the xz-plane; the cube strike must be PROJECTED to xz
    // (D7) and the province rotation applied in 2D, so mountains co-orient with the five vec3 features.
    expect(HEIGHT_GLSL).toMatch(/vec2\s+grainProvinceRotate2\s*\(\s*vec2\s+\w+\s*,\s*vec3\s+\w+\s*\)/);
  });
});

describe('WS4 T13 — five vec3 combiners read the shared grain through the branch-guarded mix', () => {
  it('scarpCombiner (retrofit): adds the province rotation on top of the T5 branch', () => {
    assertVec3Grained(fnBody(HEIGHT_GLSL, 'void scarpCombiner('), 'uScarpAxis');
  });

  it('canyonCombiner: each uChasmaAxis[i] read goes through the branch-guarded grain mix', () => {
    assertVec3Grained(fnBody(HEIGHT_GLSL, 'void canyonCombiner('), 'uChasmaAxis[i]');
  });

  it('tesseraCombiner: BOTH lattice axes (uTesseraAxis[0] and [1]) go through the branch', () => {
    const body = fnBody(HEIGHT_GLSL, 'void tesseraCombiner(');
    assertVec3Grained(body, 'uTesseraAxis[0]');
    // second axis present too (its own guarded mix + verbatim else)
    expect(body).toMatch(/mix\s*\(\s*uTesseraAxis\[1\]\s*,\s*sampleGrainStrike\s*\(\s*\w+\s*\)\s*,\s*uTectonicGrainStrength\s*\)/);
    expect(body).toMatch(/:\s*normalize\s*\(\s*uTesseraAxis\[1\]\s*\)\s*;/);
  });

  it('lavaCombiner: uLavaAxis read goes through the branch-guarded grain mix', () => {
    assertVec3Grained(fnBody(HEIGHT_GLSL, 'void lavaCombiner('), 'uLavaAxis');
  });

  it('cryoRidgeCombiner: BOTH ridge axes (uCryoRidgeAxis0 and uCryoRidgeAxis1) go through the branch', () => {
    const body = fnBody(HEIGHT_GLSL, 'void cryoRidgeCombiner(');
    assertVec3Grained(body, 'uCryoRidgeAxis0');
    expect(body).toMatch(/mix\s*\(\s*uCryoRidgeAxis1\s*,\s*sampleGrainStrike\s*\(\s*\w+\s*\)\s*,\s*uTectonicGrainStrength\s*\)/);
    expect(body).toMatch(/:\s*normalize\s*\(\s*uCryoRidgeAxis1\s*\)\s*;/);
  });
});

describe('WS4 T13 — orogeny vec2 xz-projection special case (fbmdRidged)', () => {
  it('fbmdRidged mixes uOrogenyAxis toward the cube strike PROJECTED to the xz-plane', () => {
    const body = fnBody(HEIGHT_GLSL, 'vec4 fbmdRidged(');
    // strength>0 guard precedes any grain access
    expect(body).toMatch(/uTectonicGrainStrength\s*>\s*0\.0\s*\?/);
    // the cube vec3 strike is projected to the xz-plane: normalize(sampleGrainStrike(pos).xz)
    expect(body).toMatch(/normalize\s*\(\s*sampleGrainStrike\s*\(\s*\w+\s*\)\s*\.\s*xz\s*\)/);
    // mixed into the vec2 axis, weighted by strength, then province-rotated in 2D
    expect(body).toMatch(/mix\s*\(\s*uOrogenyAxis\s*,\s*normalize\s*\(\s*sampleGrainStrike\s*\(\s*\w+\s*\)\s*\.\s*xz\s*\)\s*,\s*uTectonicGrainStrength\s*\)/);
    expect(body).toMatch(/grainProvinceRotate2\s*\(/);
    // the ==0 branch is the EXACT pre-WS4 vec2 axis: normalize(uOrogenyAxis)
    expect(body).toMatch(/:\s*normalize\s*\(\s*uOrogenyAxis\s*\)\s*;/);
    // no UNGUARDED grain access before the guard
    const g = body.match(/uTectonicGrainStrength\s*>\s*0\.0\s*\?/);
    const before = body.slice(0, g.index);
    expect(before).not.toMatch(/sampleGrainStrike\s*\(/);
  });
});

describe('WS4 T13 — gProvince / provinceWeight PRESERVED (augment, not replace; Max decision #6)', () => {
  it('initProvinces, gProvince and provinceWeight remain present in HEIGHT_GLSL', () => {
    expect(HEIGHT_GLSL).toMatch(/void\s+initProvinces\s*\(/);
    expect(HEIGHT_GLSL).toMatch(/\bgProvince\b/);
    expect(HEIGHT_GLSL).toMatch(/float\s+provinceWeight\s*\(/);
    // each grained combiner still applies its provinceWeight amplitude term (untouched).
    expect(fnBody(HEIGHT_GLSL, 'void scarpCombiner(')).toMatch(/provinceWeight\(PROV_SCARPS\)/);
    expect(fnBody(HEIGHT_GLSL, 'void canyonCombiner(')).toMatch(/provinceWeight\(PROV_CANYONS\)/);
    expect(fnBody(HEIGHT_GLSL, 'void tesseraCombiner(')).toMatch(/provinceWeight\(PROV_TESSERA\)/);
    expect(fnBody(HEIGHT_GLSL, 'void lavaCombiner(')).toMatch(/provinceWeight\(PROV_LAVA\)/);
    expect(fnBody(HEIGHT_GLSL, 'void cryoRidgeCombiner(')).toMatch(/provinceWeight\(PROV_CRYORIDGE\)/);
  });
});
