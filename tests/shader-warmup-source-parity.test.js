// tests/shader-warmup-source-parity.test.js — the warm-up must warm the program the game DRAWS.
//
// WHAT THIS PROTECTS. Stage 0's title-screen warm-up (src/rendering/ShaderWarmup.js) removes the
// measured 4 076 ms of cold planet-shader link cost by compiling the three planet-surface programs
// before any planet exists. three caches GPU programs by shader SOURCE, so the entire mechanism
// rests on one invariant: the string the warm-up compiles is character-for-character the string
// Planet._createSurface builds its material from. Break that and the warm-up still runs, still
// resolves, still reports a healthy multi-second compile — and warms a program nothing ever draws,
// while the game pays the full cost again on first arrival. There is no failure signal at runtime.
//
// WHY IT IS NOT AN IN-GAME CHECK. The live measurement (cache-busted compile cost, before/after)
// is the real proof and was taken. But it is a wall-clock measurement on one machine's driver, and
// a future edit that retypes a shader in the warm-up — or applies the cache-bust to one path and
// not the other — would only show up as "the warm-up stopped helping", months later, on a number
// nobody re-measures. This pins the invariant in plain JS instead.

import { describe, it, expect, afterEach } from 'vitest';
import {
  PLANET_SHADER_VARIANTS,
  shaderVariantFor,
  planetShaderSource,
} from '../src/objects/Planet.js';
import { buildProbeMaterial } from '../src/rendering/ShaderWarmup.js';

// planetShaderSource reads window.__shaderCacheBust; the vitest environment is node, so there is
// no window unless a test makes one.
afterEach(() => { delete globalThis.window; });

describe('planet shader variants', () => {
  it('collapses every planet type the game generates to one of exactly three programs', () => {
    // The full type list, from the GAS_TYPES / ROCKY_TYPES sets in Planet.js plus the exotics that
    // fall through to the else branch. Three programs for 18 types is the reason warming three
    // programs warms the whole game.
    const types = [
      'gas-giant', 'hot-jupiter', 'eyeball', 'sub-neptune',
      'rocky', 'ice', 'lava', 'ocean', 'terrestrial', 'venus', 'carbon',
      'iron', 'chthonian', 'super-earth', 'dwarf', 'shattered', 'ringworld', undefined,
    ];
    const variants = new Set(types.map(shaderVariantFor));
    expect([...variants].sort()).toEqual(['exotic', 'gas', 'rocky']);
    for (const v of variants) expect(PLANET_SHADER_VARIANTS[v]).toBeDefined();
  });

  it('gives the three variants genuinely distinct fragment source', () => {
    // If two variants ever shared source they would share a program, and the per-variant compile
    // numbers this lane measured (GAS 576 / EXOTIC 1 677 / ROCKY 1 823 ms) would be measuring the
    // same link twice.
    const frags = ['gas', 'rocky', 'exotic'].map((k) => PLANET_SHADER_VARIANTS[k].fragmentShader);
    expect(new Set(frags).size).toBe(3);
    // All three share the header, so they must not be trivially distinct either.
    for (const f of frags) expect(f.length).toBeGreaterThan(1000);
  });

  it('shares ONE vertex program across all three', () => {
    const verts = ['gas', 'rocky', 'exotic'].map((k) => PLANET_SHADER_VARIANTS[k].vertexShader);
    expect(new Set(verts).size).toBe(1);
  });
});

describe('warm-up / body source parity', () => {
  it('hands the warm-up probe the exact source a body would render', () => {
    for (const key of ['gas', 'rocky', 'exotic']) {
      const body = planetShaderSource(key);
      const probe = buildProbeMaterial(key);
      expect(probe.vertexShader).toBe(body.vertexShader);
      expect(probe.fragmentShader).toBe(body.fragmentShader);
    }
  });

  it('passes source through unchanged when no cache-bust is set', () => {
    // The identity, not merely an equality: the shipped path must not allocate a second copy of a
    // ~100 KB shader string per body.
    expect(planetShaderSource('rocky')).toBe(PLANET_SHADER_VARIANTS.rocky);
  });

  it('applies the measurement cache-bust to the probe and the body IDENTICALLY', () => {
    // ⛔ The failure this exists for. A cache-bust that reaches only one of the two paths makes the
    // warm-up compile a program the game never asks for — which reads, in a measurement run, as
    // "the warm-up does nothing", and would send the next session hunting a phantom bug in
    // compileAsync or the render-target binding.
    globalThis.window = { __shaderCacheBust: 'parity-test-run' };
    for (const key of ['gas', 'rocky', 'exotic']) {
      const body = planetShaderSource(key);
      const probe = buildProbeMaterial(key);
      expect(body.fragmentShader).not.toBe(PLANET_SHADER_VARIANTS[key].fragmentShader);
      expect(body.fragmentShader).toContain('parity-test-run');
      expect(probe.fragmentShader).toBe(body.fragmentShader);
    }
  });

  it('leaves the vertex source alone under a cache-bust', () => {
    // The vertex program is shared and cheap; busting it too would triple-count a link that the
    // game only pays once, and inflate the "before" number this lane is measured against.
    globalThis.window = { __shaderCacheBust: 'parity-test-run' };
    expect(planetShaderSource('rocky').vertexShader).toBe(PLANET_SHADER_VARIANTS.rocky.vertexShader);
  });
});
