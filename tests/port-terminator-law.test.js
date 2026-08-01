// tests/port-terminator-law.test.js — the terminator is a BAND at the day/night line, and its
// strength and width are the lab's laws rather than game-authored stand-ins.
//
// WHY THIS EXISTS. The first terminator port shipped three defects that every existing check
// missed, because every existing check measured the JS module and none of them read the GLSL.
// tests/port-limb-optics.test.js says so in its own header: "NOT tested here: that the shader
// consumes them correctly. That is a GLSL claim and was verified live in the browser instead."
// The live browser pass then confirmed "terminator on 36 of 36 bodies, 16 distinct hues" — all
// true, all measured on the JS side, and all compatible with the shader flooding the entire night
// hemisphere. So this file asserts the SHADER TEXT and the SHAPE OF THE LAW, not the module.
//
// The three defects, each of which gets an assertion below:
//   1. FLOOD. tt was computed from `diffuse`, which is built from max(dot(N,L), 0.0) and is
//      therefore 0 across the whole night side. exp(-0*0) == 1.0, so the "gaussian centred on the
//      terminator" was a half-gaussian pinned at PEAK over every dark pixel. Signed mu fixes it.
//   2. MAGNITUDE. uTermStrength shipped as columnFraction, which saturates to exactly 1.0 above
//      0.3 bar. The lab's tuned value is 0.15 — retuned there in 2026-06-15 precisely because 0.5
//      "swamped the surface into a heavy orange BELT on every atmospheric world (Max-reported)".
//      The port shipped 6.7x the value the lab had already reduced.
//   3. WIDTH. A provisional constant 0.18 stood in for the lab's log-pressure ramp on the grounds
//      that the real law was trapped in the un-extracted applyDrivers. It was not — the lab's law
//      reads only atmosphere.pressure.
//
// FENCE PATTERN: planet-lod-lab.html and the game source are read as source TEXT and compared, the
// same way the other lab fences work. This is deliberate — importing src/objects/Planet.js pulls a
// bare specifier that only resolves under Vite, and the claims here are claims about the text.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLANET = readFileSync(join(ROOT, 'src/objects/Planet.js'), 'utf8');
const LAB = readFileSync(join(ROOT, 'planet-lod-lab.html'), 'utf8');

describe('terminator: the shader computes a band, not a night-side flood', () => {
  it('uses SIGNED mu from the geometric normal at every one of the three surface branches', () => {
    const signed = PLANET.match(/float muTerm = dot\(vNormal, lightDir\);/g) || [];
    // rocky, gas and exotic each carry their own copy of the surface shader.
    expect(signed.length).toBe(3);
  });

  it('never derives the gaussian argument from the CLAMPED diffuse term', () => {
    // This is the actual bug, stated as text: `diffuse` is clamped at 0, so dividing it by the
    // width makes tt == 0 over the whole night hemisphere.
    expect(PLANET).not.toMatch(/diffuse\s*\/\s*max\(uTermWidth/);
  });

  it('uses vNormal, not the relief-perturbed shadingNormal (relief must not bend twilight)', () => {
    expect(PLANET).not.toMatch(/float muTerm = dot\(shadingNormal/);
  });

  it('produces a gaussian that PEAKS at the day/night line and vanishes at the antisolar point', () => {
    // The shape claim, evaluated numerically rather than asserted in prose. w = 0.12 is the law's
    // value at 1 bar.
    const w = 0.12;
    const profile = (mu) => Math.exp(-((mu / w) ** 2));

    // Peak sits exactly at the terminator.
    expect(profile(0)).toBeCloseTo(1.0, 12);
    // Deep night is dark. This is the assertion the shipped code failed: with clamped diffuse the
    // argument was 0 here too, giving 1.0 — full-strength tint on every dark pixel.
    expect(profile(-1.0)).toBeLessThan(1e-30);
    // Full day is dark.
    expect(profile(1.0)).toBeLessThan(1e-30);
    // Symmetric about the line, which is what "centred on the terminator" means.
    for (const mu of [0.05, 0.1, 0.2, 0.4]) {
      expect(profile(mu)).toBeCloseTo(profile(-mu), 12);
    }
  });

  it('REGRESSION SHAPE: the old clamped form was pinned at peak across the entire night side', () => {
    // Kept as an instrument, not as dead prose. If someone reintroduces the clamp, this documents
    // exactly what it does: every mu <= 0 collapses to the same maximum.
    const w = 0.12;
    const broken = (mu) => Math.exp(-((Math.max(mu, 0) / w) ** 2));
    for (const mu of [0, -0.1, -0.5, -1.0]) expect(broken(mu)).toBe(1.0);
  });
});

describe('terminator: strength and width are the LAB’s laws, not game-authored constants', () => {
  it('magnitude matches the value the lab retuned to, and is not columnFraction', () => {
    const game = PLANET.match(/const TERM_STRENGTH = ([0-9.]+);/);
    expect(game, 'TERM_STRENGTH must exist in src/objects/Planet.js').toBeTruthy();

    const lab = LAB.match(/state\.termStrength = [^;]*\?\s*([0-9.]+)\s*:/);
    expect(lab, 'the lab must still carry state.termStrength').toBeTruthy();

    expect(Number(game[1])).toBe(Number(lab[1]));

    // columnFraction saturates to exactly 1.0 above 0.3 bar and EVERY generated planet is above
    // that, so using it as the magnitude is both 6.7x too strong and identical on every body.
    // It is legitimate only as the airless gate, i.e. multiplied BY the magnitude.
    expect(PLANET).toMatch(/uTermStrength:\s*\{\s*value:\s*\(optics\.columnFraction \?\? 0\) \* TERM_STRENGTH\s*\}/);
  });

  it('width is the lab’s log-pressure ramp, agreeing to max delta exactly 0 over a sweep', () => {
    // Extract BOTH expressions from source and evaluate them against each other. "Max delta
    // exactly 0" is this program's definition of done for a ported law.
    const labExpr = LAB.match(/state\.termWidth = ([^;]+);/);
    expect(labExpr, 'the lab must still carry state.termWidth').toBeTruthy();

    const gameBody = PLANET.match(/function termWidthFor\(pressureBar\) \{([\s\S]*?)\n\}/);
    expect(gameBody, 'termWidthFor must exist in src/objects/Planet.js').toBeTruthy();

    // The lab names its already-floored pressure _tp; the game floors inside the function.
    const labFn = new Function('_tp', `return ${labExpr[1]};`);
    const gameFn = new Function('pressureBar', gameBody[1]);

    let maxDelta = 0;
    // Airless through Venus-class and beyond, log-spaced.
    for (const p of [0, 1e-6, 1e-3, 0.006, 0.01, 0.1, 0.31, 1.0, 1.5, 10, 92, 1000]) {
      const floored = Math.max(p, 1e-3);
      maxDelta = Math.max(maxDelta, Math.abs(labFn(floored) - gameFn(p)));
    }
    expect(maxDelta).toBe(0);
  });

  it('the provisional 0.18 constant is retired', () => {
    expect(PLANET).not.toMatch(/const TERM_WIDTH = /);
  });

  it('width actually VARIES with pressure, so it is not silently degenerate', () => {
    // The lesson from columnFraction: a law can be wired correctly and still be a constant across
    // the whole population. Pin the spread so that failure is loud.
    const gameBody = PLANET.match(/function termWidthFor\(pressureBar\) \{([\s\S]*?)\n\}/);
    const w = new Function('pressureBar', gameBody[1]);
    const vals = [0.006, 0.31, 1.0, 1.5, 92].map(w);
    expect(new Set(vals).size).toBeGreaterThanOrEqual(4);
    expect(w(0.006)).toBeLessThan(w(1.0));   // Mars-thin reads as a hairline
    expect(w(1.0)).toBeCloseTo(0.12, 12);    // 1 bar is the law's anchor point
    // Venus at 92 bar lands just UNDER the ceiling (0.2967) — the 0.30 clamp does not bind until
    // ~101 bar, so it is the kbar gas-giant column that actually saturates, not Venus.
    expect(w(92)).toBeCloseTo(0.2967, 4);
    expect(w(92)).toBeLessThan(0.30);
    expect(w(1000)).toBe(0.30);              // gas-giant column clamps at the ceiling
    expect(w(0)).toBe(0.06);                 // airless clamps to the floor, inert behind strength 0
  });
});
