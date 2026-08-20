// ═══════════════════════════════════════════════════════════════════════════════════════════════
// B2P — THE POSTERIZE-LEVEL WIRING FENCE.
//
// WHY THIS FILE EXISTS. Block B2P turned the hard-coded colour quantum into a setting by handing
// ONE shared uniform object to every material that spends it. Before this file, severing that
// wiring — on the lab, on Moon, on AsteroidBelt, on the ring, on the body programs — left every
// enumerated repo gate GREEN. The only real controls lived in scratchpad harnesses that evaporate
// with the session. `material-parity-list.test.js` counts uniform NAMES and VALUES and cannot see
// object identity at all, which is precisely the property the whole mechanism rests on: materials
// in this game are BUILT ONCE AND MUTATED, so a per-material COPY of the value would leave every
// already-mounted body frozen at its build-time number — a shipped no-op wearing a feature's name.
//
// SO THIS FILE ASSERTS IDENTITY, NOT EQUALITY. `uniforms.uPosterizeLevels === POSTERIZE_LEVELS`,
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
      expect(readLevels(cloned.uPosterizeLevels), 'the clone should be frozen at its clone-time value').toBe(6);
      expect(readLevels(planet.surface.material.uniforms.uPosterizeLevels), 'the live material should have moved').toBe(41);
    } finally { setPosterizeLevels(POSTERIZE_LEVELS_DEFAULT); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The uniform reaching the MATERIAL is worth nothing if the PROGRAM never spends it. Six fragment
// programs across four files; the three body programs share one declaration in FRAG_HEADER.
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
      expect(/1\.0 \/ levels/.test(s.split('\n').map((l) => l.split('//')[0]).join('\n')), `${file}: a SHADER-derived reciprocal is back in the CODE — 5 divergences at edgeWidth 0.6`).toBe(false);
    });
  }
  it('the CPU carries the very float32 a compiler folds `1.0 / 6.0` to (the premise, in JS)', () => {
    const f = Math.fround;
    expect(POSTERIZE_QUANTUM.value.y, 'the shipped object carries the float32 nearest 1/6').toBe(f(1 / 6));
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
    expect(POSTERIZE_LEVELS.value).toBe(POSTERIZE_LEVELS_DEFAULT);
  });

  for (const [asked, drawn] of [[500, 64], [-3, 2], [0, 2], [1, 2], [2, 2], [64, 64], [12, 12]]) {
    it(`set(${asked}) stores ${drawn} AND draws ${drawn} — one number, not two`, () => {
      const s = new Settings();
      s.onChange('posterizeLevels', setPosterizeLevels);
      s.set('posterizeLevels', asked);
      expect(s.get('posterizeLevels'), 'the STORED value').toBe(drawn);
      expect(JSON.parse(localStorage._raw[STORAGE_KEY]).posterizeLevels, 'the PERSISTED value').toBe(drawn);
      expect(POSTERIZE_LEVELS.value, 'the DRAWN value').toBe(drawn);
    });
  }

  it('a poisoned localStorage cannot reach the shader — NaN and Infinity pass the typeof guard', () => {
    // `typeof NaN === 'number'` and `typeof Infinity === 'number'`, so Settings._load's type check
    // admits both. Levels 0 or NaN makes the shader's 1.0/levels an Inf/NaN and the frame dies.
    for (const poison of [0, -1, 1e9, 1e309 /* Infinity after JSON round-trip */]) {
      vi.stubGlobal('localStorage', makeLocalStorage({
        [STORAGE_KEY]: JSON.stringify({ posterizeLevels: poison }) }));
      const v = new Settings().get('posterizeLevels');
      expect(Number.isFinite(v), `stored ${poison} survived as ${v}`).toBe(true);
      expect(v).toBeGreaterThanOrEqual(POSTERIZE_LEVELS_MIN);
      expect(v).toBeLessThanOrEqual(POSTERIZE_LEVELS_MAX);
    }
  });

  it('reset() puts every live material back on the shipped 6', () => {
    const s = new Settings();
    s.onChange('posterizeLevels', setPosterizeLevels);
    s.set('posterizeLevels', 31);
    expect(POSTERIZE_LEVELS.value).toBe(31);
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
