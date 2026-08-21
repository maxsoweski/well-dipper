// ═══════════════════════════════════════════════════════════════════════════════════════════════
// tests/lab-shader-shadows.test.js — B4-2, ledger P-03 (F52 moon-transit + planet shadows).
//
// ── WHAT THIS DEFENDS ────────────────────────────────────────────────────────────────────────────
// The lab material declared no shadow uniform of any spelling, so `src/main.js`'s caster writes —
// every one of which is guarded on the GAME's uniform names — were silent no-ops on it and the
// feature left without throwing. That is the exact shape of an accepted-loss row.
//
// ⛔ THE HALF THAT IS NOT A RESTORATION. The game's shadow test is world-space:
// sphereShadow(vWorldPos, starPos1, casterPos, casterRadius). The lab fragment shader has NO
// world-space varying and cannot be given one — a `vWorldPos` varying needs a FIFTH read of bare
// `position` in LAB_VERTEX_SHADER and tests/instrument-tap-fence.test.js makes deriveTapVertex
// THROW on exactly that. So the CASTERS are transformed into the fragment's object space instead.
// The arithmetic is forwarded verbatim; the transport is new. This file fences both halves, and
// keeps them apart, because they can fail independently and for unrelated reasons.
//
// ⭐ EVERY SOURCE-TEXT ASSERTION HERE READS COMMENT-STRIPPED CODE. B4-1's most transferable finding
// was a severing mutant that did NOT bite: the assertion was satisfied by a trailing `//` comment
// that quoted the expression it explained, so the file held the string twice and deleting the code
// left one behind. An assertion a comment can satisfy is not a fence. The strip is itself fenced
// below so it cannot go vacuous instead of red.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildLabPlanetMaterial, updateLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { makeUniforms } from '../src/worldengine/shaders/uniforms.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const stripComments = (src) => src.replace(/\/\/[^\n]*/g, '');
const squash = (s) => s.replace(/\s+/g, ' ').trim();

const HEIGHT_RAW = read('src/worldengine/shaders/height.glsl.js');
const FRAG_RAW = read('src/worldengine/shaders/planetShaders.glsl.js');
const PLANET_RAW = read('src/objects/Planet.js');
const MAIN_RAW = read('src/main.js');
const HEIGHT = stripComments(HEIGHT_RAW);
const FRAG = stripComments(FRAG_RAW);
const PLANET = stripComments(PLANET_RAW);

const CASTER_NAMES = ['uStarPos1', 'uStarPos2', 'uShadowMoonCount', 'uShadowMoonPos',
  'uShadowMoonRadius', 'uShadowPlanetCount', 'uShadowPlanetPos', 'uShadowPlanetRadius'];

/** Slice one GLSL function body out of a source, brace-balanced from its signature. */
function glslFunction(src, signatureStart) {
  const a = src.indexOf(signatureStart);
  if (a < 0) return null;
  let i = src.indexOf('{', a); let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('B4-2 · the declaration, and that its DEFAULT is the pre-B4-2 identity', () => {
  const u = makeUniforms(new THREE.Vector3(1, 0, 0));

  it('all eight caster uniforms exist in makeUniforms', () => {
    for (const n of CASTER_NAMES) expect(u[n], `makeUniforms should declare ${n}`).toBeDefined();
  });

  it('⭐ the two COUNTS default to 0 — which is the whole no-op safety story', () => {
    // totalShadow's two loops are `for (…) { if (i >= count) break; … }`. At count 0 each breaks on
    // its first iteration, `shadow` is returned still 1.0, and every shadow factor drops out of the
    // lit expression rather than being faked at a placeholder. No star position is ever read either.
    expect(u.uShadowMoonCount.value).toBe(0);
    expect(u.uShadowPlanetCount.value).toBe(0);
  });

  it('the caster arrays are the game\'s sizes — 6 moons, 2 planets — and start all-zero', () => {
    expect(u.uShadowMoonPos.value).toHaveLength(6);
    expect(u.uShadowMoonRadius.value).toHaveLength(6);
    expect(u.uShadowPlanetPos.value).toHaveLength(2);
    expect(u.uShadowPlanetRadius.value).toHaveLength(2);
    expect(u.uShadowMoonPos.value.every((v) => v.lengthSq() === 0)).toBe(true);
    expect(u.uShadowPlanetPos.value.every((v) => v.lengthSq() === 0)).toBe(true);
    expect([...u.uShadowMoonRadius.value].every((r) => r === 0)).toBe(true);
    expect([...u.uShadowPlanetRadius.value].every((r) => r === 0)).toBe(true);
  });

  it('every one is declared in the FRAGMENT block with the right GLSL type, and NONE in the vertex shader', () => {
    const types = { uStarPos1: 'vec3', uStarPos2: 'vec3', uShadowMoonCount: 'int',
      uShadowMoonPos: 'vec3', uShadowMoonRadius: 'float', uShadowPlanetCount: 'int',
      uShadowPlanetPos: 'vec3', uShadowPlanetRadius: 'float' };
    const arr = { uShadowMoonPos: '[6]', uShadowMoonRadius: '[6]', uShadowPlanetPos: '[2]', uShadowPlanetRadius: '[2]' };
    for (const n of CASTER_NAMES) {
      const re = new RegExp('uniform\\s+' + types[n] + '\\s+' + n + '\\s*' + (arr[n] ? '\\[\\d+\\]' : '') + '\\s*;');
      expect(re.test(HEIGHT), `${n} should be declared as ${types[n]}${arr[n] || ''} in height.glsl.js`).toBe(true);
    }
    // ⛔ THE VERTEX SHADER MUST NOT GROW A READ OF ANY OF THEM. LAB_VERTEX_SHADER reads bare
    // `position` exactly four times; a fifth makes deriveTapVertex throw and kills the AC-SAMPLER
    // instrument. Keeping the whole caster set fragment-only is what keeps that count at four.
    const vert = stripComments(FRAG_RAW.slice(FRAG_RAW.indexOf('LAB_VERTEX_SHADER'), FRAG_RAW.indexOf('LAB_FRAGMENT_SHADER')));
    for (const n of CASTER_NAMES) expect(vert.includes(n), `${n} must not reach the vertex shader`).toBe(false);
    expect((vert.match(/\bposition\b/g) || []).length).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('B4-2 · the ARITHMETIC is the game\'s, and this compares the two token streams', () => {
  it('⭐⭐ the lab\'s sphereShadow is the game\'s CHARACTER-FOR-CHARACTER once whitespace is normalised', () => {
    const labFn = glslFunction(HEIGHT, 'float sphereShadow(vec3 fragPos');
    const gameFn = glslFunction(PLANET, 'float sphereShadow(vec3 fragPos');
    expect(labFn, 'lab sphereShadow not found').toBeTruthy();
    expect(gameFn, 'game sphereShadow not found').toBeTruthy();
    // This is the assertion that makes "forwarded verbatim" a checked claim rather than a sentence
    // in a comment. Re-deriving the early-outs, the 1.3 slack on the radius-squared test or the
    // 0.85/1.15 penumbra — however plausibly — reddens it.
    expect(squash(labFn)).toBe(squash(gameFn));
  });

  it('⭐ the lab\'s totalShadow is the game\'s with SIX names re-spelled and nothing else changed', () => {
    const labFn = squash(glslFunction(HEIGHT, 'float totalShadow(vec3 fragPos'));
    const gameFn = squash(glslFunction(PLANET, 'float totalShadow(vec3 fragPos'));
    expect(labFn).toBeTruthy(); expect(gameFn).toBeTruthy();
    const respelled = gameFn
      .replace(/\bshadowMoonCount\b/g, 'uShadowMoonCount').replace(/\bshadowMoonPos\b/g, 'uShadowMoonPos')
      .replace(/\bshadowMoonRadius\b/g, 'uShadowMoonRadius').replace(/\bshadowPlanetCount\b/g, 'uShadowPlanetCount')
      .replace(/\bshadowPlanetPos\b/g, 'uShadowPlanetPos').replace(/\bshadowPlanetRadius\b/g, 'uShadowPlanetRadius');
    expect(labFn).toBe(respelled);
    // ⭐ THE MULTIPLY ORDER IS PART OF THE CLAIM, not incidental: moons then planets. Float
    // multiplication is not associative, so a re-ordered product is a different number. The
    // string equality above pins the order; this names why it may not be "tidied".
    expect(labFn.indexOf('uShadowMoonPos')).toBeLessThan(labFn.indexOf('uShadowPlanetPos'));
  });

  it('⭐ the two shadow factors reach the LIT EXPRESSION, in the game\'s own shape', () => {
    expect(FRAG).toContain('float shadow1 = totalShadow(vPos, uStarPos1);');
    expect(FRAG).toContain('float shadow2 = totalShadow(vPos, uStarPos2);');
    expect(FRAG).toContain('vec3 starLight = uStarColor1 * diff1 * uStarBrightness1 * shadow1 + uStarColor2 * diff2 * uStarBrightness2 * shadow2;');
    expect(FRAG).toContain('float diff = diff1 * uStarBrightness1 * shadow1 + diff2 * uStarBrightness2 * shadow2;');
  });

  it('⭐⭐ `diff` STAYS A FLOAT — widening it would re-colour another block\'s pixels', () => {
    // Inherited from B4-1 and re-asserted here because B4-2 rewrites this exact statement. `diff` is
    // read as a GATE a dozen times below (the nightMask for bio/city/ecumenopolis, step(0.0001, diff)
    // for carbon sheen / facets / sunglint, the lit dayside gate) and as a MAGNITUDE inside the F34
    // limb's (diff + 0.15) — which is B3's territory, not B4's.
    expect(FRAG).toMatch(/float diff = diff1 \* uStarBrightness1 \* shadow1/);
    expect(FRAG).not.toMatch(/vec3 diff = diff1/);
  });

  it('⛔ THE COMMENT-STRIP IS ITSELF FENCED — it may not go vacuous instead of red', () => {
    // B4-1's mutant 2 passed with the code deleted because the trailing comment quoted the
    // expression. Every assertion above reads FRAG/HEIGHT (stripped). If stripComments silently
    // stopped working these would start reading comments again and could never fail.
    const count = (hay, needle) => (hay.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    // (a) the code needle survives the strip exactly once — so the assertions above are reading code.
    expect(count(FRAG, 'float shadow1 = totalShadow(vPos, uStarPos1);')).toBe(1);
    // (b) ⭐ AND THE STRIP DEMONSTRABLY REMOVES COMMENT TEXT. Two prose strings that exist ONLY inside
    // `//` comments on the very lines B4-2 edited: present before the strip, gone after it. Without
    // this clause a stripComments that silently became the identity function would leave every
    // assertion above reading raw source — where a comment quoting an expression satisfies it — and
    // the whole file could never fail. That is exactly how B4-1's mutant 2 passed with the code gone.
    for (const prose of ['RIDES THIS LINE', 'THE SHADOW SENTENCE THAT USED TO BE HERE']) {
      expect(count(FRAG_RAW + HEIGHT_RAW, prose), `${prose} should exist in the raw source`).toBeGreaterThan(0);
      expect(count(FRAG + HEIGHT, prose), `${prose} should be gone after stripping`).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('B4-2 · the SIMILARITY INVARIANCE the object-space substitution rests on', () => {
  // A JS reference of the shipped GLSL. ⚠ IT IS A TRANSCRIPTION, NOT THE SHADER — so the test below
  // it pins the transcription's constants and control flow against the GLSL text, and the whole
  // thing only means anything alongside the token-for-token comparison above.
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function sphereShadow(fragPos, starPosition, casterPos, casterRadius) {
    const toStar = sub(starPosition, fragPos);
    const distToStar = Math.sqrt(dot(toStar, toStar));
    const rayDir = toStar.map((v) => v / distToStar);
    const oc = sub(casterPos, fragPos);
    const tca = dot(oc, rayDir);
    if (tca < 0.0) return 1.0;
    if (tca > distToStar) return 1.0;
    const d2 = dot(oc, oc) - tca * tca;
    if (d2 >= casterRadius * casterRadius * 1.3) return 1.0;
    const t = Math.min(1, Math.max(0, (Math.sqrt(d2) - casterRadius * 0.85) / (casterRadius * 1.15 - casterRadius * 0.85)));
    return t * t * (3 - 2 * t);
  }

  it('the transcription\'s constants and early-outs are the ones in the shipped GLSL', () => {
    const labFn = squash(glslFunction(HEIGHT, 'float sphereShadow(vec3 fragPos'));
    expect(labFn).toContain('if (tca < 0.0) return 1.0;');
    expect(labFn).toContain('if (tca > distToStar) return 1.0;');
    expect(labFn).toContain('if (d2 >= casterRadius * casterRadius * 1.3) return 1.0;');
    expect(labFn).toContain('smoothstep(casterRadius * 0.85, casterRadius * 1.15, sqrt(d2))');
  });

  it('⭐⭐ rotate + translate + uniformly scale all three points and scale the radius: the factor does not move', () => {
    // THIS IS THE WHOLE LICENCE FOR THE PORT. If sphereShadow were not similarity-invariant, moving
    // the casters into object space would be a different shadow, not the same one in another frame.
    let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let worst = 0; let penumbra = 0;
    for (let n = 0; n < 50000; n++) {
      const R = () => (rnd() - 0.5) * 20;
      const frag = [R(), R(), R()]; const star = [R() * 50, R() * 50, R() * 50]; const caster = [R(), R(), R()];
      const cr = rnd() * 5 + 0.01;
      const a = sphereShadow(frag, star, caster, cr);
      if (a > 1e-7 && a < 1 - 1e-7) penumbra++;
      const q = new THREE.Quaternion(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      const s = rnd() * 9.9 + 0.1; const T = new THREE.Vector3(R(), R(), R());
      const xf = (p) => new THREE.Vector3(...p).applyQuaternion(q).multiplyScalar(s).add(T).toArray();
      worst = Math.max(worst, Math.abs(a - sphereShadow(xf(frag), xf(star), xf(caster), cr * s)));
    }
    // ⚠ THE BOUND IS FLOAT ROUNDING, NOT ZERO, AND IT IS DELIBERATELY NOT WRITTEN AS AN EQUALITY.
    // MEASURED at 2.5e-12 worst absolute over 200,000 float64 samples in this session; 1e-9 is that
    // with three orders of headroom, which is the honest shape for a bound nobody derived. It says
    // "no structural error", not "bit-identical" — and in float32 GLSL the real rounding is larger.
    expect(worst).toBeLessThan(1e-9);
    // ⛔ Without this the test would pass on an input set where every sample took an early-out and
    // the smoothstep — the only branch that computes anything — was never exercised.
    expect(penumbra).toBeGreaterThan(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('B4-2 · the SEAM — world casters into this body\'s object space', () => {
  const mkRecord = () => ({
    starPos1: new THREE.Vector3(), starPos2: new THREE.Vector3(), moonCount: 0,
    moonPos: Array.from({ length: 6 }, () => new THREE.Vector3()), moonRadius: new Float32Array(6),
    planetCount: 0, planetPos: Array.from({ length: 2 }, () => new THREE.Vector3()), planetRadius: new Float32Array(2),
  });
  const mount = (bodyRadius) => {
    const built = buildLabPlanetMaterial({ bodyRadius });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 4), built.material);
    return { built, mesh, u: built.material.uniforms };
  };

  it('⭐ a caster at a known world point lands at the arithmetically right object-space point', () => {
    const { mesh, u } = mount(2.0);
    mesh.position.set(100, 0, 0); mesh.updateMatrixWorld(true);
    const sc = mkRecord();
    sc.starPos1.set(0, 0, 0); sc.moonCount = 1; sc.moonPos[0].set(104, 0, 0); sc.moonRadius[0] = 0.5;
    sc.planetCount = 1; sc.planetPos[0].set(140, 0, 0); sc.planetRadius[0] = 3;
    updateLabPlanetMaterial(mesh.material, { mesh, lightDirWorld: new THREE.Vector3(1, 0, 0), shadowCast: sc });
    expect(u.uStarPos1.value.toArray()).toEqual([-50, 0, 0]);          // (0 - 100) / 2
    expect(u.uShadowMoonPos.value[0].toArray()).toEqual([2, 0, 0]);    // (104 - 100) / 2
    expect(u.uShadowPlanetPos.value[0].toArray()).toEqual([20, 0, 0]); // (140 - 100) / 2
  });

  it('⭐⭐ the caster RADIUS is scaled too — a radius left in world units is the commonest way to get this wrong', () => {
    // worldToLocal divides the mesh's world scale out of a POSITION for free. A radius is a bare
    // length with no transform applied to it, so it has to be scaled by hand. Miss it and every
    // shadow is the right shape at the wrong size — which reads as "shadows look a bit off", not
    // as a bug, and would survive a screenshot review.
    const { mesh, u } = mount(4.0);
    mesh.position.set(0, 0, 0); mesh.scale.setScalar(3); mesh.updateMatrixWorld(true);
    const sc = mkRecord();
    sc.moonCount = 1; sc.moonPos[0].set(24, 0, 0); sc.moonRadius[0] = 6;
    const d = updateLabPlanetMaterial(mesh.material, { mesh, lightDirWorld: new THREE.Vector3(1, 0, 0), shadowCast: sc });
    expect(d.shadowCast.radiusScale).toBeCloseTo(1 / (3 * 4), 12);      // 1 / (worldScale * bodyRadius)
    expect(u.uShadowMoonRadius.value[0]).toBeCloseTo(6 / 12, 12);
    // …and the position uses the SAME factor, which is what keeps the pair consistent.
    expect(u.uShadowMoonPos.value[0].x).toBeCloseTo(24 / 12, 12);
  });

  it('⭐ the counts are CLAMPED to the array sizes — an over-long caster list must not write past the end', () => {
    const { mesh, u } = mount(1.0);
    mesh.updateMatrixWorld(true);
    const sc = mkRecord(); sc.moonCount = 99; sc.planetCount = 99;
    updateLabPlanetMaterial(mesh.material, { mesh, lightDirWorld: new THREE.Vector3(1, 0, 0), shadowCast: sc });
    expect(u.uShadowMoonCount.value).toBe(6);
    expect(u.uShadowPlanetCount.value).toBe(2);
  });

  it('⛔ a tick with NO caster record ZEROES the counts — stale casters must not persist', () => {
    // These uniforms live on the material across frames. A body whose moons unload, or that changes
    // system, would otherwise keep casting last frame's shadows forever. Zeroing the two counts is
    // sufficient: totalShadow reads nothing else.
    const { mesh, u } = mount(1.0);
    mesh.updateMatrixWorld(true);
    const sc = mkRecord(); sc.moonCount = 3; sc.planetCount = 2;
    updateLabPlanetMaterial(mesh.material, { mesh, lightDirWorld: new THREE.Vector3(1, 0, 0), shadowCast: sc });
    expect(u.uShadowMoonCount.value).toBe(3);
    updateLabPlanetMaterial(mesh.material, { mesh, lightDirWorld: new THREE.Vector3(1, 0, 0) });
    expect(u.uShadowMoonCount.value).toBe(0);
    expect(u.uShadowPlanetCount.value).toBe(0);
  });

  it('the seam reports the resolved counts as NUMBERS, and null when it did not run', () => {
    const { mesh } = mount(1.0);
    mesh.updateMatrixWorld(true);
    const sc = mkRecord(); sc.moonCount = 2; sc.planetCount = 1;
    const d = updateLabPlanetMaterial(mesh.material, { mesh, lightDirWorld: new THREE.Vector3(1, 0, 0), shadowCast: sc });
    expect(d.shadowCast).toMatchObject({ moonCount: 2, planetCount: 1 });
    const d2 = updateLabPlanetMaterial(mesh.material, { mesh, lightDirWorld: new THREE.Vector3(1, 0, 0) });
    expect(d2.shadowCast).toBeNull();   // a DIFFERENT fact from "ran and found no casters"
  });

  it('the seam allocates no caster storage per call — the record is read, never copied', () => {
    const { mesh, u } = mount(1.0);
    mesh.updateMatrixWorld(true);
    const sc = mkRecord(); sc.moonCount = 1; sc.moonPos[0].set(5, 0, 0); sc.moonRadius[0] = 1;
    const before = u.uShadowMoonPos.value[0];
    updateLabPlanetMaterial(mesh.material, { mesh, lightDirWorld: new THREE.Vector3(1, 0, 0), shadowCast: sc });
    expect(u.uShadowMoonPos.value[0]).toBe(before);          // copied INTO, not replaced
    expect(sc.moonPos[0].toArray()).toEqual([5, 0, 0]);      // and the caller's vector is unmutated
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('B4-2 · the DUPLICATED caster law in src/main.js, and the agreement that fences it', () => {
  // ⛔ WHY THERE ARE TWO COPIES AT ALL. The de-duplication — making the guarded block read from the
  // record — would rewrite lines that tools/port-uniform-delta.mjs pins BY SYMBOL as its UNWATCHED
  // evidence, two of them quoting a whole assignment expression including its right-hand side. That
  // reds the citation fence, and the failure reads as some other block's. Duplicating the law and
  // asserting the agreement is the cheaper risk — but only if the agreement is actually asserted,
  // which is what this block is for. Both fragments are sliced from the SHIPPED text of src/main.js.
  const sliceFrom = (start, end) => {
    const a = MAIN_RAW.indexOf(start);
    expect(a, `slice start not found in src/main.js: ${start}`).toBeGreaterThan(-1);
    const b = MAIN_RAW.indexOf(end, a);
    expect(b, `slice end not found in src/main.js: ${end}`).toBeGreaterThan(-1);
    return MAIN_RAW.slice(a, b + end.length);
  };
  const RECORD_FILL = sliceFrom('{ const sc = entry.planet._shadowCast; if (sc) {', 'sc.planetCount = sIdx; } }');
  const GAME_FILL = sliceFrom('if (pu.shadowMoonCount) {', 'pu.shadowPlanetCount.value = shadowPlanetIdx;\n      }');

  const mkPlanet = (x, r) => ({
    mesh: { position: new THREE.Vector3(x, 0, 0) }, data: { radius: r },
    _shadowCast: {
      starPos1: new THREE.Vector3(), starPos2: new THREE.Vector3(), moonCount: 0,
      moonPos: Array.from({ length: 6 }, () => new THREE.Vector3()), moonRadius: new Float32Array(6),
      planetCount: 0, planetPos: Array.from({ length: 2 }, () => new THREE.Vector3()), planetRadius: new Float32Array(2),
    },
  });
  const mkGameBag = () => ({
    shadowMoonCount: { value: 0 }, shadowMoonPos: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
    shadowMoonRadius: { value: new Array(6).fill(0) }, shadowPlanetCount: { value: 0 },
    shadowPlanetPos: { value: Array.from({ length: 2 }, () => new THREE.Vector3()) },
    shadowPlanetRadius: { value: new Array(2).fill(0) },
  });

  it('⭐ the slices are LIVE CODE, not comment text', () => {
    expect(RECORD_FILL).toContain('sc.moonPos[m].copy(entry.moons[m].mesh.position);');
    expect(GAME_FILL).toContain('pu.shadowMoonPos.value[m].copy(entry.moons[m].mesh.position);');
    expect(stripComments(RECORD_FILL)).toContain('sc.planetCount = sIdx;');
    expect(stripComments(GAME_FILL)).toContain('pu.shadowPlanetCount.value = shadowPlanetIdx;');
  });

  it('⭐⭐ the record and the game uniform bag SELECT THE SAME CASTERS, on every planet of a synthetic system', () => {
    const runRecord = new Function('entry', 'system', 'i', '_star1Pos', '_star2Pos', RECORD_FILL);
    const runGame = new Function('entry', 'system', 'i', 'pu', GAME_FILL);
    const planets = [0, 1, 2, 3].map((k) => ({ planet: mkPlanet(10 * (k + 1), k + 1), moons: [] }));
    // give the middle body a caster list that exercises the 6-cap
    planets[1].moons = Array.from({ length: 8 }, (_, m) => ({ mesh: { position: new THREE.Vector3(0, m, 0) }, data: { radius: 0.1 * (m + 1) } }));
    planets[2].moons = [{ mesh: { position: new THREE.Vector3(0, 0, 7) }, data: { radius: 0.4 } }];
    const system = { planets };
    const s1 = new THREE.Vector3(1, 2, 3); const s2 = new THREE.Vector3(-4, 5, -6);
    for (let i = 0; i < planets.length; i++) {
      const entry = planets[i];
      const pu = mkGameBag();
      runRecord(entry, system, i, s1, s2);
      runGame(entry, system, i, pu);
      const sc = entry.planet._shadowCast;
      expect(sc.moonCount, `planet ${i} moonCount`).toBe(pu.shadowMoonCount.value);
      for (let m = 0; m < sc.moonCount; m++) {
        expect(sc.moonPos[m].toArray(), `planet ${i} moonPos[${m}]`).toEqual(pu.shadowMoonPos.value[m].toArray());
        expect(sc.moonRadius[m]).toBeCloseTo(pu.shadowMoonRadius.value[m], 6);
      }
      expect(sc.planetCount, `planet ${i} planetCount`).toBe(pu.shadowPlanetCount.value);
      for (let q = 0; q < sc.planetCount; q++) {
        expect(sc.planetPos[q].toArray(), `planet ${i} planetPos[${q}]`).toEqual(pu.shadowPlanetPos.value[q].toArray());
        expect(sc.planetRadius[q]).toBeCloseTo(pu.shadowPlanetRadius.value[q], 6);
      }
      // and the star positions, which the game bag writes on two separate guarded lines above
      expect(sc.starPos1.toArray()).toEqual(s1.toArray());
      expect(sc.starPos2.toArray()).toEqual(s2.toArray());
    }
  });

  it('⭐ the fence BITES — a record fill that dropped the outer neighbour disagrees', () => {
    // The control for the test above. Without it, an agreement assertion over a system whose bodies
    // all happen to select the same casters would pass on two laws that differ.
    const broken = new Function('entry', 'system', 'i', '_star1Pos', '_star2Pos',
      RECORD_FILL.replace('if (i < system.planets.length - 1 && sIdx < 2)', 'if (false)'));
    const planets = [0, 1, 2].map((k) => ({ planet: mkPlanet(10 * (k + 1), k + 1), moons: [] }));
    const system = { planets };
    const entry = planets[0]; const pu = mkGameBag();
    broken(entry, system, 0, new THREE.Vector3(), new THREE.Vector3());
    new Function('entry', 'system', 'i', 'pu', GAME_FILL)(entry, system, 0, pu);
    expect(entry.planet._shadowCast.planetCount).not.toBe(pu.shadowPlanetCount.value);
  });

  it('⛔ the record fill is OUTSIDE the MOON-SHADOW-WRITE sentinel pair', () => {
    // tests/moon-shadow-write-guard.test.js slices the text between those markers and COMPILES it
    // standalone. A statement in there referring to `moon` would be evaluated against that harness's
    // scope instead of this one, so the fence would silently start testing a different program.
    const a = MAIN_RAW.indexOf('// MOON-SHADOW-WRITE-' + 'BEGIN');
    const b = MAIN_RAW.indexOf('// MOON-SHADOW-WRITE-' + 'END');
    const fenced = MAIN_RAW.slice(a, b);
    expect(fenced).not.toContain('_shadowCast');
    expect(MAIN_RAW.indexOf('const msc = moon.isPlanetMoon')).toBeLessThan(a);
  });

  it('⭐ the moon arm fills BOTH kinds of moon, and gives each exactly one caster — its parent', () => {
    const FILL = sliceFrom('{ const msc = moon.isPlanetMoon ? moon.planet?._shadowCast : moon._shadowCast; if (msc) {',
      'msc.planetCount = 1; } }');
    const run = new Function('moon', 'entry', '_star1Pos', '_star2Pos', FILL);
    const parent = mkPlanet(50, 2.5);
    const rec = () => ({
      starPos1: new THREE.Vector3(), starPos2: new THREE.Vector3(), moonCount: 7,
      moonPos: [], moonRadius: new Float32Array(0),
      planetCount: 0, planetPos: Array.from({ length: 2 }, () => new THREE.Vector3()), planetRadius: new Float32Array(2),
    });
    for (const moon of [{ isPlanetMoon: false, _shadowCast: rec() },
      { isPlanetMoon: true, planet: { _shadowCast: rec() } }]) {
      run(moon, { planet: parent }, new THREE.Vector3(9, 9, 9), new THREE.Vector3());
      const r = moon.isPlanetMoon ? moon.planet._shadowCast : moon._shadowCast;
      expect(r.planetCount).toBe(1);
      expect(r.planetPos[0].toArray()).toEqual([50, 0, 0]);
      expect(r.planetRadius[0]).toBeCloseTo(2.5, 6);
      expect(r.starPos1.toArray()).toEqual([9, 9, 9]);
      // ⭐ moonCount is RESET, not left alone — these records are reused frame after frame.
      expect(r.moonCount).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('B4-2 · the CARRY — the record has to reach the seam, or none of the above ships', () => {
  // ⛔ THIS IS THE DROP THAT WAS P-01, IN ITS P-03 FORM. B4-1's ledger records that the star set was
  // lost because Planet's constructor resolved it and the lab call site simply did not pass it on.
  // The identical failure is available here: a caster record that is filled every sim tick and never
  // handed to the seam is invisible, throws nothing, and reddens no other test in the repo.
  const MOON_RAW = read('src/objects/Moon.js');
  const PLANET_CODE = stripComments(PLANET_RAW);
  const MOON_CODE = stripComments(MOON_RAW);

  it('⭐ Planet allocates the record in its constructor and forwards it to the seam', () => {
    expect(PLANET_CODE).toContain('this._shadowCast = {');
    expect(PLANET_CODE).toContain('shadowCast: this._shadowCast,');
  });

  it('⭐ Moon does the same — 632 plain moons on the measured corpus reach the lab material this way', () => {
    expect(MOON_CODE).toContain('this._shadowCast = {');
    expect(MOON_CODE).toContain('shadowCast: this._shadowCast,');
  });

  it('the seam READS the option under that exact name', () => {
    expect(stripComments(read('src/rendering/LabPlanetMaterial.js'))).toContain('opts.shadowCast');
  });

  it('⛔ src/main.js FILLS both records — the guarded game-side writes are untouched and still guarded', () => {
    const M = stripComments(MAIN_RAW);
    expect(M).toContain('entry.planet._shadowCast');
    expect(M).toContain('moon.isPlanetMoon ? moon.planet?._shadowCast : moon._shadowCast');
    // ⭐ THE CONTROL. B4-2 must NOT have widened or removed any of the game-side guards — an
    // unguarded write there once stopped the render loop permanently. All four survive verbatim.
    for (const guard of ['if (pu.starPos1)', 'if (pu.shadowMoonCount) {', 'if (pu.shadowPlanetCount) {',
      'if (mu?.shadowPlanetPos)', 'if (mu?.starPos1)', 'if (pmu?.shadowPlanetCount) {']) {
      expect(M, `guard removed: ${guard}`).toContain(guard);
    }
  });

  it('⛔ the LAB material still declares NONE of the game\'s four moon-shadow names', () => {
    // ⭐ AN OUTCOME OF THE OBJECT-SPACE DESIGN WORTH NAMING, because the recon predicted the
    // opposite. It expected tests/moon-shadow-write-guard.test.js:141 — "survives the LAB material,
    // which declares none of the four uniforms" — to go VACUOUS the moment B4 declared them. Under
    // the world-space design it would have. Under this one the lab's names are uStarPos1/uShadow*,
    // in a different space, so the game's four are still absent, those guards are still live no-ops
    // on a lab material, and that fence keeps its meaning instead of quietly becoming a tautology.
    const labNames = Object.keys(makeUniforms(new THREE.Vector3(1, 0, 0)));
    for (const gameName of ['shadowPlanetPos', 'shadowPlanetRadius', 'starPos1', 'starPos2']) {
      expect(labNames).not.toContain(gameName);
    }
  });
});
