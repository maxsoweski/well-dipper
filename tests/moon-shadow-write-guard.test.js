// tests/moon-shadow-write-guard.test.js — the fence on the PLAIN-MOON frame-loop uniform writes.
//
// ── WHAT THIS DEFENDS, AND WHY IT IS NOT A STYLE RULE ────────────────────────────────────────────
// `src/main.js`'s moon-eclipse loop has two arms. The planet-class arm is guarded and carries a
// seven-line in-source record of WHY: a material swapped onto the body lacks these uniforms, the
// write threw a TypeError from inside the frame function, and the three-loop binding has no
// try/catch — so the throw escaped before `raf()` was rescheduled and THE RENDER LOOP STOPPED
// PERMANENTLY while the caller had already reported success. The plain-moon arm was left unguarded.
//
// That arm is inert today only because `tryLabShader`'s `body.planet.` filter (`src/main.js`) never
// admits a plain moon. PLAN.md Step 10 widens exactly that filter — "guard two unguarded uniform
// writes inside the frame loop — and land the guards FIRST in the working tree, before the filter
// widening above admits a moon to `tryLabShader`". Preview-first-guard-second gives a frozen frame
// AND an `ok: true`, which is the worst case arriving through that step's first line of code.
//
// ── THE CONTROL DISCIPLINE ───────────────────────────────────────────────────────────────────────
// A text assertion ("the source contains `?.`") proves nothing about behaviour and rots the first
// time someone reformats. So both laws are SLICED OUT OF THE SHIPPED FILES and EXECUTED, against a
// material carrying the LAB material's uniform shape. Each gets a MUTANT of that same shipped text
// with the guard deleted, shown to THROW on the same input — which is what proves the guard is
// load-bearing rather than decorative. And each gets a positive case on a `Moon.js`-shaped material,
// because a guard that silently disables the feature it protects is the other way to be green and
// wrong.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const MOON = readFileSync(join(ROOT, 'src/objects/Moon.js'), 'utf8');

// Split so the sentinels themselves cannot be matched by a scan of THIS file.
const BEGIN = '// MOON-SHADOW-WRITE-' + 'BEGIN';
const END = '// MOON-SHADOW-WRITE-' + 'END';

/** Slice the shipped plain-moon shadow-write out of src/main.js. */
function extractShadowWrite(source = MAIN) {
  const a = source.indexOf(BEGIN);
  const b = source.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error('moon-shadow-write sentinels missing or out of order in src/main.js');
  return source.slice(a + BEGIN.length, b);
}

/**
 * Slice `updateRender`'s body out of the shipped Moon.js. Located on COMMENT-STRIPPED text so a
 * quoted copy of the old statement in a comment cannot be compiled in its place (the failure mode
 * tests/helpers/source-scan.mjs exists to stop), then cut from RAW source — offsets are preserved.
 */
function extractUpdateRender(source = MOON) {
  const stripped = stripCommentsPreservingOffsets(source);
  const sig = stripped.indexOf('updateRender(renderDt) {');
  if (sig < 0) throw new Error('Moon.updateRender(renderDt) not found in live code');
  const open = stripped.indexOf('{', sig);
  let depth = 0;
  let i = open;
  for (; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    else if (stripped[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) throw new Error('Moon.updateRender body did not close');
  return source.slice(open + 1, i);
}

/** Compile a sliced statement list into a callable. The mutants go through this same door. */
const compileShadowWrite = (src) =>
  // eslint-disable-next-line no-new-func
  new Function('moon', 'entry', '_star1Pos', '_star2Pos', src);
const compileUpdateRender = (src) =>
  // eslint-disable-next-line no-new-func
  new Function('renderDt', src);

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z, copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; } });

/** A `Moon.js`-shaped material: declares all four shadow uniforms (Moon.js:57-60) plus `time`. */
const moonJsMaterial = () => ({
  uniforms: {
    shadowPlanetPos: { value: vec() },
    shadowPlanetRadius: { value: 0.0 },
    starPos1: { value: vec() },
    starPos2: { value: vec() },
    time: { value: 0 },
  },
});

/**
 * The LAB material's shape. `LabPlanetMaterial.buildLabPlanetMaterial` fills its uniforms from
 * `makeUniforms(light)` — the lab's own set — which declares NONE of the four shadow uniforms and
 * no `time`. This object is the whole hazard, expressed as data.
 */
const labMaterial = () => ({ uniforms: { uBodyRadius: { value: 1 }, uOctaves: { value: 4 } } });

/** A material with no `uniforms` bag at all — the other shape a swap can leave behind. */
const bareMaterial = () => ({});

const moonWith = (material) => ({ mesh: { material } });
const ENTRY = Object.freeze({ planet: { mesh: { position: vec(3, 4, 5) }, data: { radius: 2.5 } } });
const S1 = vec(10, 0, 0);
const S2 = vec(0, 10, 0);

const runShadowWrite = (src, material) => compileShadowWrite(src)(moonWith(material), ENTRY, S1, S2);

// ── The extraction ───────────────────────────────────────────────────────────────────────────────

describe('the extraction', () => {
  it('finds exactly one sentinel pair in src/main.js', () => {
    expect(MAIN.split(BEGIN).length - 1).toBe(1);
    expect(MAIN.split(END).length - 1).toBe(1);
  });

  it('the fenced text is the plain-moon arm — it writes all four shadow uniforms', () => {
    const src = extractShadowWrite();
    for (const name of ['shadowPlanetPos', 'shadowPlanetRadius', 'starPos1', 'starPos2']) {
      expect(src, `fenced text must write ${name}`).toContain(name);
    }
  });

  it('Moon.updateRender is sliced from LIVE code, not from a comment', () => {
    expect(extractUpdateRender()).toContain('uniforms');
  });
});

// ── The law: a foreign material must not kill the frame ──────────────────────────────────────────

describe('src/main.js — the plain-moon shadow write', () => {
  const src = extractShadowWrite();

  it('⭐ survives the LAB material, which declares none of the four uniforms', () => {
    expect(() => runShadowWrite(src, labMaterial())).not.toThrow();
  });

  it('survives a material with no uniforms bag at all', () => {
    expect(() => runShadowWrite(src, bareMaterial())).not.toThrow();
  });

  it('⭐ still WRITES on a Moon.js-shaped material — the guard must not disable the feature', () => {
    const mat = moonJsMaterial();
    runShadowWrite(src, mat);
    expect(mat.uniforms.shadowPlanetPos.value).toMatchObject({ x: 3, y: 4, z: 5 });
    expect(mat.uniforms.shadowPlanetRadius.value).toBe(2.5);
    expect(mat.uniforms.starPos1.value).toMatchObject({ x: 10, y: 0, z: 0 });
    expect(mat.uniforms.starPos2.value).toMatchObject({ x: 0, y: 10, z: 0 });
  });
});

describe('src/objects/Moon.js — the cloud clock write', () => {
  const src = extractUpdateRender();
  const run = (material, data) => compileUpdateRender(src).call({ data, mesh: { material } }, 0.5);

  it('⭐ survives the LAB material on a cloudy moon — `time` is not declared there', () => {
    expect(() => run(labMaterial(), { clouds: true })).not.toThrow();
  });

  it('survives a material with no uniforms bag at all', () => {
    expect(() => run(bareMaterial(), { clouds: true })).not.toThrow();
  });

  it('⭐ still ADVANCES the clock on a Moon.js-shaped material', () => {
    const mat = moonJsMaterial();
    run(mat, { clouds: true });
    expect(mat.uniforms.time.value).toBe(0.5);
  });

  it('leaves the clock alone on a cloudless moon', () => {
    const mat = moonJsMaterial();
    run(mat, { clouds: false });
    expect(mat.uniforms.time.value).toBe(0);
  });
});

// ── Committed failing controls — the guard deleted, on the same input ─────────────────────────────
//
// Each mutant is built by DELETING the guard from the shipped text this suite just executed. If a
// mutant stops throwing, the guard above has stopped being what makes the test green and this file
// has quietly become a tautology.

describe('committed failing controls — delete the guard and the frame dies', () => {
  it('⭐ main.js: unguarded writes THROW on the lab material', () => {
    const mutant = extractShadowWrite()
      .replace(/\?\./g, '.')
      .replace(/if \(mu\.\w+\) /g, '');
    expect(mutant, 'the mutant must differ from the shipped text').not.toBe(extractShadowWrite());
    expect(() => runShadowWrite(mutant, labMaterial())).toThrow(TypeError);
  });

  it('⭐ Moon.js: an unguarded clock write THROWS on the lab material', () => {
    const src = extractUpdateRender();
    const mutant = src.replace(/\?\./g, '.').replace(/if \(mu\.\w+\) /g, '');
    expect(mutant, 'the mutant must differ from the shipped text').not.toBe(src);
    const run = () => compileUpdateRender(mutant).call(
      { data: { clouds: true }, mesh: { material: labMaterial() } }, 0.5,
    );
    expect(run).toThrow(TypeError);
  });
});
