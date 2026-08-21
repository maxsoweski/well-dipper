// ═══════════════════════════════════════════════════════════════════════════════════════════════
// B2P — THE POSTERIZE-LEVEL WIRING FENCE.
//
// WHY THIS FILE EXISTS. Block B2P turned the hard-coded colour quantum into a setting by handing
// TWO shared uniform objects to the materials that spend it — POSTERIZE_QUANTUM, the vec2 (levels, 1/levels) the SIX game fragment programs take under `uPosterizeLevels`, and POSTERIZE_LEVELS, the scalar the lab program takes under `uniform float uLevels` because a float slot cannot hold a vec2 — with `setPosterizeLevels` the SINGLE WRITER of both, so they cannot drift. (It was ONE object until the round-3 arithmetic fix split it; this header said ONE until 2026-08-20.) Before this file, severing that
// wiring — on the lab, on Moon, on AsteroidBelt, on the ring, on the body programs — left every
// enumerated repo gate GREEN. The only real controls lived in scratchpad harnesses that evaporate
// with the session. `material-parity-list.test.js` counts uniform NAMES and VALUES and cannot see
// object identity at all, which is precisely the property the whole mechanism rests on: materials
// in this game are BUILT ONCE AND MUTATED, so a per-material COPY of the value would leave every
// already-mounted body frozen at its build-time number — a shipped no-op wearing a feature's name.
//
// SO THIS FILE ASSERTS IDENTITY, NOT EQUALITY — each slot against the object it is supposed to hold: `uniforms.uPosterizeLevels === POSTERIZE_QUANTUM` on the FOUR game material slots (body, ring, moon, belt) and `uniforms.uLevels === POSTERIZE_LEVELS` on the lab material,
// per material path, plus the liveness that identity buys, plus a deep-clone negative control that
// proves the identity assertion can actually fail.
//
// EACH `it()` IS SCOPED TO ONE SEVERABLE SITE so a red test names the site that broke.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { Planet, PLANET_SHADER_VARIANTS } from '../src/objects/Planet.js';
import { Moon } from '../src/objects/Moon.js';
import { AsteroidBelt } from '../src/objects/AsteroidBelt.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { Settings } from '../src/ui/Settings.js';
import {
  POSTERIZE_LEVELS, POSTERIZE_QUANTUM, POSTERIZE_LEVELS_DEFAULT, POSTERIZE_LEVELS_MIN, POSTERIZE_LEVELS_MAX,
  setPosterizeLevels, clampPosterizeLevels,
} from '../src/rendering/posterizeLevels.js';

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8');

// The five material paths, built the way the game builds them, from a real generated system.
const sys = StarSystemGenerator.generate('lab-procedural-0', null);
const entry = sys.planets.find((e) => e.planetData.rings) ?? sys.planets[0];
const rec = entry.planetData;
if (!rec.rings) rec.rings = { color1: [0.8, 0.7, 0.6], color2: [0.6, 0.5, 0.4], opacity: 0.7 };
const planet = new Planet(rec, sys.starInfo);
const moonRec = sys.planets.flatMap((e) => e.moons || [])[0]
  ?? { name: 'm', radius: 0.02, orbitRadius: 0.4, orbitSpeed: 0.1, startAngle: 0, baseColor: [0.5, 0.5, 0.5],
       accentColor: [0.4, 0.4, 0.4], noiseScale: 4, moonType: 'rocky', rotationSpeed: 1 };
const moon = new Moon(moonRec, new THREE.Vector3(1, 0, 0), null, sys.starInfo);
const beltData = { name: 'b', innerRadius: 3, outerRadius: 5, asteroids: Array.from({ length: 8 }, (_, i) => ({
  shapeIndex: i % 4, orbitRadius: 3 + i * 0.2, orbitSpeed: 0.1, angle: i, startAngle: i, size: 0.01,
  scale: 0.01, color: [0.5, 0.5, 0.5], tilt: 0, y: 0, spinAxis: [0, 1, 0], spinSpeed: 0.1 })) };
const belt = new AsteroidBelt(beltData, sys.starInfo);
const labMaterial = buildLabPlanetMaterial({ bodyRadius: 0.0426 }).material;

const readLevels = (u) => (u.value && u.value.isVector2 ? u.value.x : u.value);  // game slots carry vec2(levels, 1/levels); the lab's uLevels is a scalar float. Built ABOVE, i.e. BEFORE any set() below.
const PATHS = {
  'planet body (GAS/ROCKY/EXOTIC share one material slot)': [planet.surface.material, 'uPosterizeLevels', POSTERIZE_QUANTUM],
  'planet ring (_createRing — its own program)':            [planet.ring.material,    'uPosterizeLevels', POSTERIZE_QUANTUM],
  'moon (the legacy plain-moon program)':                   [moon.mesh.material,      'uPosterizeLevels', POSTERIZE_QUANTUM],
  'asteroid belt':                                          [belt._material,          'uPosterizeLevels', POSTERIZE_QUANTUM],
  'lab material (world engine, uLevels)':                   [labMaterial,             'uLevels', POSTERIZE_LEVELS],
};

afterAll(() => { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); });

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('B2P 1 — every material slot IS the shared object, not a copy of its value', () => {
  for (const [name, [mat, key, want]] of Object.entries(PATHS)) {
    it(`${name}: uniforms.${key} IS the shared object it is supposed to hold`, () => {
      expect(mat.uniforms[key], `${name} declares no ${key} uniform at all — the wiring is severed`).toBeDefined();
      expect(mat.uniforms[key] === want,
        `${name}: uniforms.${key} is a DIFFERENT object from the one it must share. Equal values are not `
        + `enough — this material is built once and mutated, so a copy strands it at its build-time value.`).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('B2P 2 — assigning through the setter moves what every ALREADY-BUILT material reads', () => {
  it('all five paths, built above, read 23 after setPosterizeLevels(23) and 6 again after the restore', () => {
    try {
      setPosterizeLevels(23);
      for (const [name, [mat, key]] of Object.entries(PATHS)) {
        expect(readLevels(mat.uniforms[key]), `${name} did not follow setPosterizeLevels(23)`).toBe(23);
      }
    } finally { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); }
    for (const [name, [mat, key]] of Object.entries(PATHS)) {
      expect(readLevels(mat.uniforms[key]), `${name} did not follow the restore`).toBe(POSTERIZE_LEVELS_DEFAULT);
    }
  });

  it('NEGATIVE CONTROL — a deep-cloned uniform map does NOT follow, so §1 and §2 can fail', () => {
    const cloned = THREE.UniformsUtils.clone(planet.surface.material.uniforms);
    expect(cloned.uPosterizeLevels === POSTERIZE_QUANTUM).toBe(false);
    try {
      setPosterizeLevels(41);
      expect(readLevels(cloned.uPosterizeLevels), 'the clone should be frozen at its clone-time value').toBe(POSTERIZE_LEVELS_DEFAULT);   // ⭐ BOUND TO THE CONSTANT, NOT THE LITERAL, 2026-08-21: this control tests that a DEEP CLONE STOPS FOLLOWING the shared object, which is true at any level. It was written as `toBe(6)` and reddened the moment Max ruled the default to 31 — a control that breaks when an unrelated taste call moves is testing the wrong thing.
      expect(readLevels(planet.surface.material.uniforms.uPosterizeLevels), 'the live material should have moved').toBe(41);
    } finally { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The uniform reaching the MATERIAL is worth nothing if the PROGRAM never spends it. Six fragment
// programs across THREE files (Planet.js, Moon.js, AsteroidBelt.js); the three body programs share one declaration in FRAG_HEADER. ⚠ FOUR is a different quantity, twice over: the posterize() SOURCE-COPY count (Planet.js carries two — body and ring) and the `uniform vec2` DECLARATION-SITE count. SIX is the programs, and SIX is the call sites.
const PROGRAMS = {
  gas:    () => PLANET_SHADER_VARIANTS.gas.fragmentShader,
  rocky:  () => PLANET_SHADER_VARIANTS.rocky.fragmentShader,
  exotic: () => PLANET_SHADER_VARIANTS.exotic.fragmentShader,
  ring:   () => planet.ring.material.fragmentShader,
  moon:   () => moon.mesh.material.fragmentShader,
  belt:   () => belt._material.fragmentShader,
};

describe('B2P 3 — the shipped GLSL declares the uniform and spends it in posterize()', () => {
  for (const [name, get] of Object.entries(PROGRAMS)) {
    it(`${name}: declares \`uniform vec2 uPosterizeLevels\`, spends it, and keeps no 6.0 literal`, () => {
      const s = get();
      expect(/uniform\s+vec2\s+uPosterizeLevels\s*;/.test(s), `${name} never declares the uniform as a vec2`).toBe(true);
      expect(/posterize\([^;]*?,\s*uPosterizeLevels\s*,/.test(s), `${name} declares it but never spends it`).toBe(true);
      expect(/posterize\([^;]*?,\s*6\.0\s*,/.test(s), `${name} still has a hard-coded 6.0 in a posterize call`).toBe(false);
    });
  }
  it('the moon keeps its own edgeWidth 0.6 (planets use 0.4) — the port did not flatten it', () => {
    expect(/posterize\(finalColor,\s*uPosterizeLevels,\s*gl_FragCoord\.xy,\s*0\.6\)/
      .test(moon.mesh.material.fragmentShader)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE ARITHMETIC, AS MEASURED — not as assumed. Pre-B2P spent `dither * edgeWidth / 6.0` with BOTH operands
// literal, which the compiler folds into ONE constant multiply, so parity needs one multiply by that same
// constant. Two things are load-bearing, each established by a FAILING alternative on ANGLE/SwiftShader
// Vulkan over 12,582,912 knife-edge samples (6,291,456 per edgeWidth, at 0.4 and 0.6): (1) the INNER
// PARENTHESES — `dither * (edgeWidth * levels.y)` diverges 0 times, `(dither * edgeWidth) * levels.y`
// diverges 4 at 0.4 and 1 at 0.6, max byte delta 43; (2) the CARRIED reciprocal — a shader-derived
// `1.0 / levels` with the same parentheses is 0 at 0.4 but 5 at 0.6, because the compiler re-folds
// `edgeWidth * (1.0 / levels)` into a divide. Runtime 1.0/6.0 is itself bit-exact (0x3e2aaaab).
/** Every posterize() BODY in a source file, brace-matched — the scope the arithmetic fence rules. */
function posterizeBodies(text) {
  const out = []; const re = /vec3 posterize\(vec3 color, vec2 levels, vec2 fragCoord, float edgeWidth\)/g;
  let m;
  while ((m = re.exec(text))) {
    const open = text.indexOf('{', m.index); let depth = 0, j = open;
    for (; j < text.length; j++) { if (text[j] === '{') depth++; else if (text[j] === '}') { depth--; if (!depth) break; } }
    out.push(text.slice(open + 1, j));
  }
  return out;
}
describe('B2P 4 — posterize() multiplies by the CARRIED reciprocal, parenthesised with edgeWidth', () => {
  for (const file of ['objects/Planet.js', 'objects/Moon.js', 'objects/AsteroidBelt.js']) {
    it(`${file}: every posterize copy takes vec2 levels and spends levels.y, parenthesised`, () => {
      const s = src(file);
      const decls = s.match(/vec3 posterize\(vec3 color, vec2 levels, vec2 fragCoord, float edgeWidth\)/g) || [];
      expect(decls.length, `${file} has no posterize definition — did the shader move?`).toBeGreaterThan(0);
      const dith = s.match(/vec3 dithered = color \+ dither \* \(edgeWidth \* levels\.y\);/g) || [];
      expect(dith.length, `${file}: the DITHER term lost its parentheses — five whole bands move`).toBe(decls.length);
      const ret = s.match(/return floor\(dithered \* levels\.x \+ 0\.5\) \* levels\.y;/g) || [];
      expect(ret.length, `${file}: the QUANTISER no longer multiplies by the carried reciprocal`).toBe(decls.length);
      const stripped = s.split('\n').map((l) => l.split('//')[0]).join('\n');
      // ⭐ WIDENED 2026-08-20, and the old fence overstated itself. It was /1\.0 \/ levels/ — one
      // exact spelling with one exact space on each side — while its message claimed to catch 'a
      // SHADER-derived reciprocal'. `1.0/levels`, `1.0 /levels` and `1.0 / uPosterizeLevels.x` all
      // walked past it. This form takes any spacing and any carrier whose name ends in levels/Levels.
      expect(/1\.0\s*\/\s*\w*[Ll]evels/.test(stripped),
        `${file}: a SHADER-derived reciprocal is back in the CODE — 5 divergences at edgeWidth 0.6`).toBe(false);
      // ⛔ AND THE FORM NO SPELLING ESCAPES, because a renamed local (`float inv = 1.0 / lv;`) defeats
      // any name-based regex: posterize() DIVIDES NOWHERE AT ALL. MEASURED at this commit — all four
      // source copies hold ZERO `/` once comments are stripped — so this is a fence, not an aspiration.
      for (const body of posterizeBodies(s)) {
        expect(body.split('\n').map((l) => l.split('//')[0]).join('\n').includes('/'),
          `${file}: posterize() performs a DIVISION. levels.y is carried from the CPU precisely so the compiler `
          + `cannot re-fold edgeWidth * (1.0 / levels) into a divide — 5 divergences at edgeWidth 0.6 when it can.`).toBe(false);
      }
    });
  }
  it('the CPU carries the very float32 a compiler folds `1.0 / 6.0` to (the premise, in JS)', () => {
    const f = Math.fround;
    expect(POSTERIZE_QUANTUM.value.y, 'the shipped object carries the float32 nearest 1/DEFAULT').toBe(f(1 / POSTERIZE_LEVELS_DEFAULT));   // ⭐ GENERALISED 2026-08-21 (default 6 -> 31, Max's ruling). The premise this section proves is that the CPU carries the exact float32 a compiler would fold `1.0 / N` to — it is a property of the CARRY, not of the number 6, so pinning it to the shipped default is what the section actually claims. The original 1/6 case survives as the round-1 regression below.
    expect(Math.round(f(5 * f(1 / 6)) * 255), 'reciprocal multiply gives the literal code 213').toBe(213);
    expect(Math.round(f(5 / 6) * 255), 'a double-rounded divide gives 212 — one code darker').toBe(212);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('B2P 5 — main.js actually joins the setting to the shader (boot read AND change)', () => {
  const main = () => readFileSync(fileURLToPath(new URL('../src/main.js', import.meta.url)), 'utf8');
  it('imports the setter', () => {
    expect(/import \{ setPosterizeLevels \} from '\.\/rendering\/posterizeLevels\.js'/.test(main()),
      'main.js does not import setPosterizeLevels — nothing can join the setting to the shader').toBe(true);
  });
  it('reads the stored value ON BOOT (an absent boot read is the pixelScale defect, verbatim)', () => {
    expect(/setPosterizeLevels\(settings\.get\('posterizeLevels'\)\)/.test(main()),
      'main.js never reads the stored posterizeLevels on boot — the setting would silently revert to 6 on every reload').toBe(true);
  });
  it('subscribes to later changes, so settings.set() and settings.reset() both reach the shaders', () => {
    expect(/settings\.onChange\('posterizeLevels',\s*setPosterizeLevels\)/.test(main()),
      'main.js never subscribes to posterizeLevels — settings.set() and settings.reset() would not reach any shader').toBe(true);
  });
  it('handles the DOM settings path too (the colorPalette precedent)', () => {
    expect(/case 'posterizeLevels':\s*setPosterizeLevels\(value\);/.test(main()),
      'applySettingChange has no posterizeLevels case — the DOM settings path would be dead').toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE STORED NUMBER AND THE DRAWN NUMBER ARE ONE NUMBER. setPosterizeLevels clamps on its way to
// the shader; if Settings did not clamp on its way to localStorage, a stored 500 would persist
// forever against a picture drawn at 64.
//
// ⚠ AND "THE DRAWN NUMBER" IS TWO OBJECTS, NOT ONE — corrected 2026-08-20. Every assertion in this
// section used to read POSTERIZE_LEVELS.value, which is the LAB's scalar `uLevels` and is drawn only
// by the world-engine program behind a flag. The SIX SHIPPED GAME PROGRAMS draw POSTERIZE_QUANTUM,
// and nothing here inspected it: the section was labelled "the DRAWN value" while never once reading
// the value the game draws. Both are asserted below, on every case, and the vec2's carried .y with
// them — so a clamp that reached the scalar and stopped short of the vec2 now reddens.
function makeLocalStorage(seed = {}) {
  const store = { ...seed };
  return { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
           removeItem: (k) => { delete store[k]; }, _raw: store };
}
const STORAGE_KEY = 'well-dipper-settings';

describe('B2P 6 — the stored value and the drawn value cannot disagree', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', makeLocalStorage()); setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); });
  afterAll(() => { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); });

  it('the default ships at 6 — an absent key falls through to today’s picture, no migration', () => {
    expect(new Settings().get('posterizeLevels')).toBe(POSTERIZE_LEVELS_DEFAULT);
    expect(POSTERIZE_LEVELS.value, 'the LAB\u2019s drawn scalar').toBe(POSTERIZE_LEVELS_DEFAULT);
    expect(POSTERIZE_QUANTUM.value.x, 'the value the SIX GAME programs draw').toBe(POSTERIZE_LEVELS_DEFAULT);
    expect(POSTERIZE_QUANTUM.value.y, 'and its carried reciprocal').toBe(Math.fround(1 / POSTERIZE_LEVELS_DEFAULT));
  });

  for (const [asked, drawn] of [[500, 64], [-3, 2], [0, 2], [1, 2], [2, 2], [64, 64], [12, 12]]) {
    it(`set(${asked}) stores ${drawn} AND draws ${drawn} — one number, not two`, () => {
      const s = new Settings();
      s.onChange('posterizeLevels', setPosterizeLevels);
      s.set('posterizeLevels', asked);
      expect(s.get('posterizeLevels'), 'the STORED value').toBe(drawn);
      expect(JSON.parse(localStorage._raw[STORAGE_KEY]).posterizeLevels, 'the PERSISTED value').toBe(drawn);
      expect(POSTERIZE_LEVELS.value, 'the LAB\u2019s DRAWN value (the scalar uLevels)').toBe(drawn);
      expect(POSTERIZE_QUANTUM.value.x, 'the GAME\u2019s DRAWN value \u2014 the vec2 .x the six shipped fragment programs read').toBe(drawn);
      expect(POSTERIZE_QUANTUM.value.y, 'the GAME\u2019s carried reciprocal \u2014 .y must be the float32 nearest 1/.x, or the top band shifts').toBe(Math.fround(1 / drawn));
    });
  }

  it('a poisoned localStorage cannot reach the shader — NaN and Infinity pass the typeof guard', () => {
    // `typeof NaN === 'number'` and `typeof Infinity === 'number'`, so Settings._load's type check
    // admits both. Levels 0 or NaN makes setPosterizeLevels's CPU-side Math.fround(1 / levels) an
    // Inf/NaN in POSTERIZE_QUANTUM.value.y, and the frame dies. ⛔ THE GAME'S DIVIDE IS ON THE CPU since
    // round 3 — but the LAB shader still divides (height.glsl.js:683-684); B2P 4 fences only the three game files.
    for (const poison of [0, -1, 1e9, 1e309 /* Infinity after JSON round-trip */]) {
      vi.stubGlobal('localStorage', makeLocalStorage({
        [STORAGE_KEY]: JSON.stringify({ posterizeLevels: poison }) }));
      const v = new Settings().get('posterizeLevels');
      expect(Number.isFinite(v), `stored ${poison} survived as ${v}`).toBe(true);
      expect(v).toBeGreaterThanOrEqual(POSTERIZE_LEVELS_MIN);
      expect(v).toBeLessThanOrEqual(POSTERIZE_LEVELS_MAX);
      // …and the repaired value, pushed through the setter, leaves the GAME vec2 finite too.
      setPosterizeLevels(v);
      expect(Number.isFinite(POSTERIZE_QUANTUM.value.x) && Number.isFinite(POSTERIZE_QUANTUM.value.y),
        `stored ${poison} reached the vec2 as (${POSTERIZE_QUANTUM.value.x}, ${POSTERIZE_QUANTUM.value.y})`).toBe(true);
    }
  });

  it('reset() puts every live material back on the shipped 6', () => {
    const s = new Settings();
    s.onChange('posterizeLevels', setPosterizeLevels);
    s.set('posterizeLevels', 31);
    expect(POSTERIZE_LEVELS.value).toBe(31);
    expect(POSTERIZE_QUANTUM.value.x, 'the GAME vec2 followed set(31) too').toBe(31);
    s.reset();
    expect(s.get('posterizeLevels')).toBe(POSTERIZE_LEVELS_DEFAULT);
    for (const [name, [mat, key]] of Object.entries(PATHS)) {
      expect(readLevels(mat.uniforms[key]), `${name} after reset()`).toBe(POSTERIZE_LEVELS_DEFAULT);
    }
  });

  it('the shader arithmetic is finite everywhere the clamp allows, and NOT at levels 0', () => {
    for (const L of [POSTERIZE_LEVELS_MIN, 6, 23, POSTERIZE_LEVELS_MAX]) {
      const inv = 1.0 / clampPosterizeLevels(L);
      expect(Number.isFinite(inv), `1.0/${L} must be finite`).toBe(true);
      expect(Number.isFinite(Math.floor(0.5 * L + 0.5) * inv)).toBe(true);
    }
    expect(Number.isFinite(1.0 / 0), 'the failing control: levels 0 is exactly the frame-killing Inf').toBe(false);
    expect(clampPosterizeLevels(0), 'which the clamp makes unreachable').toBe(POSTERIZE_LEVELS_MIN);
    expect(clampPosterizeLevels(NaN), 'a non-finite input falls back to the shipped default').toBe(POSTERIZE_LEVELS_DEFAULT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// B2P 7 — "SO THEY CANNOT DRIFT" IS A CONSTRUCTION ARGUMENT, AND UNTIL THIS SECTION IT WAS FENCED
// AT EXACTLY ONE LEVEL. posterizeLevels.js states that `setPosterizeLevels` is the only writer of
// both objects, so a level and its carried reciprocal cannot disagree. That is true by reading —
// but the only assertion on `.y` anywhere in this file was pinned at the shipped 6, and B2P 2, which
// does exercise 23 and 41, reads only `.x` (through `readLevels`). The setter accepts 2 … 64, so a
// `.y` that stopped tracking at any other level would have shipped with every gate green. The whole
// admitted range is asserted here so the phrase "cannot drift" names a fenced property, not a hope.
describe('B2P 7 — the carried reciprocal tracks the level at EVERY level the clamp admits', () => {
  afterAll(() => { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); });

  it('every integer level in [MIN, MAX] carries its own exact float32 reciprocal', () => {
    try {
      for (let L = POSTERIZE_LEVELS_MIN; L <= POSTERIZE_LEVELS_MAX; L++) {
        setPosterizeLevels(L);
        expect(POSTERIZE_QUANTUM.value.x, `level ${L}: the vec2 .x the six game programs read`).toBe(L);
        expect(POSTERIZE_QUANTUM.value.y,
          `level ${L}: .y must be Math.fround(1/${L}) EXACTLY — it is the float32 the GPU receives, and a `
          + `double-rounded or stale one shifts whole bands (B2P 4 measures 213 against 212 at levels 6)`).toBe(Math.fround(1 / L));
        expect(POSTERIZE_LEVELS.value, `level ${L}: the lab's scalar followed the same single write`).toBe(L);
      }
    } finally { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); }
  });

  it('an out-of-range or fractional ask carries the reciprocal of the CLAMPED level, not of the ask', () => {
    try {
      for (const asked of [1, 0, -7, 2.5, 12.75, 500, 1e9]) {
        const want = clampPosterizeLevels(asked);
        setPosterizeLevels(asked);
        expect(POSTERIZE_QUANTUM.value.x, `set(${asked}) must clamp to ${want}`).toBe(want);
        expect(POSTERIZE_QUANTUM.value.y,
          `set(${asked}): .y must be the reciprocal of the CLAMPED ${want}, not of ${asked} — a pair that `
          + `clamps .x and derives .y from the raw ask is exactly the drift this section fences`).toBe(Math.fround(1 / want));
      }
    } finally { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); }
  });

  it('NEGATIVE CONTROL — a `.y` frozen at the default disagrees at 62 of the 63 admitted levels', () => {
    // The assertions above are worth nothing unless a stale `.y` is DETECTABLE, so the defect is
    // simulated here directly on the object: write the level, then stamp `.y` back to the shipped
    // 1/6 and count the levels at which the pair now disagrees. It must be every level but 6.
    try {
      let caught = 0;
      for (let L = POSTERIZE_LEVELS_MIN; L <= POSTERIZE_LEVELS_MAX; L++) {
        setPosterizeLevels(L);
        POSTERIZE_QUANTUM.value.y = Math.fround(1 / POSTERIZE_LEVELS_DEFAULT);
        if (POSTERIZE_QUANTUM.value.y !== Math.fround(1 / POSTERIZE_QUANTUM.value.x)) caught++;
      }
      expect(caught, 'a frozen reciprocal must be visible at every admitted level except the default')
        .toBe(POSTERIZE_LEVELS_MAX - POSTERIZE_LEVELS_MIN);
    } finally { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); }
  });
});
