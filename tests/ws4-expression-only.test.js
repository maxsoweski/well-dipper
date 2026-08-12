// tests/ws4-expression-only.test.js — WS4 T17 (D11): the `renderer-expression-only` audit.
//
// AC: renderer-expression-only (unit/code-audit). Per the plan (T17 / D11) this test IS the
// operational definition of the corrected AC: "No strike-axis derivation remains in the shader for
// grained features; the shader only EXPRESSES the shared grain/substrate fields." Synthesis already
// patched contract.json's observable + architecturalConnections.outputs to the real replace-set, so
// this audit and the live AC text agree.
//
// HOW THIS DIFFERS FROM ws4-combiners-wire (T13): T13 asserts the POSITIVE shape of the grain mix in
// each combiner (the branch-guarded `mix(uXxxAxis, sampleGrainStrike, strength)` + province rotation).
// T17 is the CONSTRAINT check: it asserts the NEGATIVE — that NO raw per-feature strike hash survives
// inside the six grained combiners (the strike axis can ONLY come through the branch-guarded cube path,
// with the seed-derived uXxxAxis as the strength=0 ENDPOINT) — AND that the PRESERVED machinery
// (initProvinces / gProvince / provinceWeight) is still present and only READ, never replaced. It also
// pins the JS side: the six deriveUniforms axis hashes (seededUnitVec3) remain as the strength=0
// endpoint only, and the four grained-axis GUI rerolls are gated.
//
// WHY a source-scan: "no strike derivation remains in the shader" is a STRUCTURAL property of the GLSL
// + the lab-core/lab.html source, not a runtime tolerance. It is exactly the kind of regression a
// careless future edit would reintroduce (a fresh per-fragment axis hash that re-decorrelates a
// feature, or a rename that drops gProvince). There is no GPU and no live capture here — the live
// correlation half (one cube feeds N consumers under perturbation) is one-shared-grain's :9223 job.
//
// HARD RULE: no Date.now / Math.random in DERIVATION. The lab GUI rerolls DO use Math.random for the
// grain-OFF legacy look — the audit asserts those writes are GUARDED by uTectonicGrainStrength, not
// that Math.random is absent from the page.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HEIGHT_GLSL } from '../src/worldengine/shaders/height.glsl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LAB_CORE = readFileSync(join(__dirname, '..', 'src/worldengine/base/labCore.js'), 'utf8');
const LAB_HTML = readFileSync(join(__dirname, '..', 'planet-lod-lab.html'), 'utf8');

// Pull one function body by name (brace-matched) so an assertion can't bleed across combiners.
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

// The six grained combiners and the axis uniform(s) each takes as the strength=0 ENDPOINT.
// (lavaPlainsCombiner in the contract is the actual `void lavaCombiner(` in source; cite drift noted.)
const GRAINED_VEC3 = [
  { decl: 'void canyonCombiner(',    axes: ['uChasmaAxis[i]'] },
  { decl: 'void scarpCombiner(',     axes: ['uScarpAxis'] },
  { decl: 'void tesseraCombiner(',   axes: ['uTesseraAxis[0]', 'uTesseraAxis[1]'] },
  { decl: 'void lavaCombiner(',      axes: ['uLavaAxis'] },
  { decl: 'void cryoRidgeCombiner(', axes: ['uCryoRidgeAxis0', 'uCryoRidgeAxis1'] },
];

describe('WS4 T17 — renderer-expression-only: every grained combiner derives strike ONLY through the shared cube', () => {
  it('each of the five vec3 grained combiners reads its axis via the branch-guarded mix(uXxxAxis, sampleGrainStrike, uTectonicGrainStrength)', () => {
    for (const { decl, axes } of GRAINED_VEC3) {
      const body = fnBody(HEIGHT_GLSL, decl);
      for (const ax of axes) {
        const uRe = ax.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // the >0 branch mixes the OLD axis toward the SHARED cube strike, weighted by strength
        const mixRe = new RegExp(
          'mix\\s*\\(\\s*' + uRe + '\\s*,\\s*sampleGrainStrike\\s*\\(\\s*\\w+\\s*\\)\\s*,\\s*uTectonicGrainStrength\\s*\\)'
        );
        expect(body, `${decl} ${ax}: strike must come through mix(${ax}, sampleGrainStrike, uTectonicGrainStrength)`).toMatch(mixRe);
        // the ==0 endpoint is the EXACT seed-derived axis: normalize(uXxxAxis)
        expect(body, `${decl} ${ax}: strength==0 endpoint must be verbatim normalize(${ax})`)
          .toMatch(new RegExp(':\\s*normalize\\s*\\(\\s*' + uRe + '\\s*\\)\\s*;'));
        // the strength>0 guard precedes any cube fetch (no unguarded grain access)
        expect(body, `${decl} ${ax}: a strength>0 guard must gate the cube fetch`)
          .toMatch(/uTectonicGrainStrength\s*>\s*0\.0\s*\?/);
      }
    }
  });

  it('orogeny (fbmdRidged) reads its vec2 axis via the cube strike PROJECTED to the xz-plane (D7 special case)', () => {
    const body = fnBody(HEIGHT_GLSL, 'vec4 fbmdRidged(');
    expect(body).toMatch(/uTectonicGrainStrength\s*>\s*0\.0\s*\?/);
    // vec3 cube strike → xz projection → mixed into the vec2 axis, weighted by strength
    expect(body).toMatch(
      /mix\s*\(\s*uOrogenyAxis\s*,\s*normalize\s*\(\s*sampleGrainStrike\s*\(\s*\w+\s*\)\s*\.\s*xz\s*\)\s*,\s*uTectonicGrainStrength\s*\)/
    );
    // strength==0 endpoint = the verbatim seed-derived vec2 axis
    expect(body).toMatch(/:\s*normalize\s*\(\s*uOrogenyAxis\s*\)\s*;/);
  });

  it('NO raw per-feature strike HASH survives inside any grained combiner (the axis is cube-or-endpoint only)', () => {
    // The whole point of WS4: the shader stops DERIVING strike. A grained combiner must not compute its
    // own axis from a per-fragment hash (fract(sin(...)), hash33/hash3, or a seededUnitVec3-style sin
    // hash). The ONLY in-body axis sources allowed are: sampleGrainStrike(...) (the shared cube) and the
    // uXxxAxis uniform endpoint. This catches a future edit that reintroduces an independent axis.
    const allDecls = ['vec4 fbmdRidged(', ...GRAINED_VEC3.map((c) => c.decl)];
    for (const decl of allDecls) {
      const body = fnBody(HEIGHT_GLSL, decl);
      // strip line comments so prose like "// hashed from seed" can't false-trip the scan
      const code = body.replace(/\/\/[^\n]*/g, '');
      expect(code, `${decl}: must not derive a strike via fract(sin(...)) per-feature hash`).not.toMatch(/fract\s*\(\s*sin\s*\(/);
      expect(code, `${decl}: must not call a hash33/hash3 axis hash`).not.toMatch(/\bhash3?3?\s*\(/);
    }
  });
});

describe('WS4 T17 — renderer-expression-only: initProvinces / gProvince / provinceWeight PRESERVED (augment, not replace)', () => {
  it('initProvinces, gProvince and provinceWeight are still defined in HEIGHT_GLSL', () => {
    expect(HEIGHT_GLSL).toMatch(/void\s+initProvinces\s*\(/);
    expect(HEIGHT_GLSL).toMatch(/\bgProvince\b/);
    expect(HEIGHT_GLSL).toMatch(/float\s+provinceWeight\s*\(/);
  });

  it('the in-shader grain↔province rotation READS gProvince, never re-derives or replaces it', () => {
    // grainProvinceRotate / grainProvinceRotate2 compose ORIENTATION against the REAL gProvince (D4
    // move-1). They must consume gProvince (the single GPU source of truth) — never write it.
    for (const decl of ['vec3 grainProvinceRotate(', 'vec2 grainProvinceRotate2(']) {
      const body = fnBody(HEIGHT_GLSL, decl);
      expect(body, `${decl} must read the real gProvince field`).toMatch(/\bgProvince\b/);
      // it must NOT assign gProvince (no `gProvince = ` / `gProvince.x = …` write inside the helper)
      expect(body, `${decl} must not overwrite gProvince`).not.toMatch(/gProvince(?:\.[xyzw]+)?\s*=[^=]/);
    }
  });

  it('every grained combiner still applies its provinceWeight amplitude term (where-mask untouched)', () => {
    expect(fnBody(HEIGHT_GLSL, 'void scarpCombiner(')).toMatch(/provinceWeight\(PROV_SCARPS\)/);
    expect(fnBody(HEIGHT_GLSL, 'void canyonCombiner(')).toMatch(/provinceWeight\(PROV_CANYONS\)/);
    expect(fnBody(HEIGHT_GLSL, 'void tesseraCombiner(')).toMatch(/provinceWeight\(PROV_TESSERA\)/);
    expect(fnBody(HEIGHT_GLSL, 'void lavaCombiner(')).toMatch(/provinceWeight\(PROV_LAVA\)/);
    expect(fnBody(HEIGHT_GLSL, 'void cryoRidgeCombiner(')).toMatch(/provinceWeight\(PROV_CRYORIDGE\)/);
  });
});

describe('WS4 T17 — the seed-derived axis hashes survive ONLY as the strength=0 endpoint (JS side)', () => {
  it('the six deriveUniforms axis hashes are still present in planet-lod-lab-core.js', () => {
    // These feed uXxxAxis — the `: normalize(uXxxAxis)` else-branch in the shader (the grain-OFF look).
    // They must REMAIN (the fallback endpoint), not be deleted — but they are no longer the live grained
    // path when grain is ON.
    expect(LAB_CORE).toMatch(/orogenyAxis\s*=\s*\[\s*Math\.cos\(orogenyAngle\)/); // vec2 from seed angle
    expect(LAB_CORE).toMatch(/chasmaAxes\s*=\s*\[\s*seededUnitVec3/);
    expect(LAB_CORE).toMatch(/scarpAxis\s*=\s*seededUnitVec3/);
    expect(LAB_CORE).toMatch(/tesseraAxes\s*=\s*\[\s*seededUnitVec3/);
    expect(LAB_CORE).toMatch(/lavaAxis\s*=\s*seededUnitVec3/);
    expect(LAB_CORE).toMatch(/cryoRidgeAxes\s*=\s*\[\s*seededUnitVec3/);
    // the seededUnitVec3 primitive itself remains defined.
    expect(LAB_CORE).toMatch(/function\s+seededUnitVec3\s*\(/);
  });

  it('the four grained-axis GUI rerolls are gated so a 🎲 cannot reinstall an independent axis when grain is ON', () => {
    // The reroll surface is per-feature (orogeny writes Math.random directly; chasma/scarp/tessera via
    // randUnitVec3). Each axis write must sit AFTER a uTectonicGrainStrength guard (T14). lava/cryo
    // reroll only offsets, so they are intentionally NOT gated (asserted by ws4-reroll-gate).
    const gatedWrites = [
      /state\.orogenyAngle\s*=\s*Math\.random/,
      /state\.chasmaAxes\s*=\s*\[\s*randUnitVec3/,
      /state\.scarpAxis\s*=\s*randUnitVec3/,
      /state\.tesseraAxes\s*=\s*\[\s*randUnitVec3/,
    ];
    for (const writeRe of gatedWrites) {
      const wIdx = LAB_HTML.search(writeRe);
      expect(wIdx, `the grained-axis reroll write ${writeRe} must exist (grain-OFF legacy look)`).toBeGreaterThanOrEqual(0);
      // a uTectonicGrainStrength guard must appear in the 600 chars preceding the write (its handler).
      const window = LAB_HTML.slice(Math.max(0, wIdx - 600), wIdx);
      expect(window, `the reroll write ${writeRe} must be gated by uTectonicGrainStrength`).toMatch(/uTectonicGrainStrength/);
    }
  });
});
