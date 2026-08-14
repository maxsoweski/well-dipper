// tests/crater-uniform-law.test.js — rung 4's crater port: the law, and the two fences that keep it
// from drifting away from the lab it was transcribed from.
//
// WHAT THIS PROTECTS.
//  1. THE CLOSED FORM. coverageBand is a rewrite of craterSchedule's own coverage integral over an
//     arbitrary sub-band. If it does not reproduce the schedule's `coverage` field exactly at the
//     full band, it is wrong, and every derived density is wrong with it — silently, because a
//     plausible-looking crater field comes out either way.
//  2. THE BODY-INDEPENDENCE CLAIM. uCraterAmp * uCraterScale == 1 is what lets the game skip the
//     population fit that RELIEF_NORMAL_GAIN needed. It is an identity, so it is testable as one.
//  3. THE POPULATION. The whole point of a condition-first crater law is that airless old worlds get
//     craters and weathered ones do not, WITHOUT a type label anywhere. Sol's Moon must; a temperate
//     Earthlike must not.
//  4. THE TRANSCRIPTION. craterProfile and ejectaProfile carry the analytic dh/dr the relief-normal
//     path depends on. They are pinned token-for-token against planet-lod-height.glsl.js.
//  5. THE WIRING. The unit-sphere domain and the separate accumulator are the two things a future
//     "simplification" would most plausibly undo, and both fail SILENTLY (craters rescaled by
//     noiseScale still look like craters).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  craterUniformsFrom, coverageBand, CRATERS_OFF,
  CELL_CRATER_AREA, RENDERED_CELL_COVERAGE, CRATER_VIS_FLOOR_RAD, EJECTA_RIM_FRACTION,
} from '../src/worldengine/port/craterUniforms.js';
import { craterSchedule, transitionDiameterKm } from '../src/worldengine/base/bombardment.js';
import { radPerKm } from '../src/worldengine/base/baseStep.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// A body the way SolarSystemData writes one: no T_eq, no age, no mass, atmosphere null.
const airless = (radiusEarth) => ({ radiusEarth, atmosphere: null });

function solBody(profileId) {
  for (const w of generateSolarSystem().planets) {
    if (w.planetData.profileId === profileId) return w.planetData;
    for (const m of (w.moons || [])) if (m.profileId === profileId) return m;
  }
  throw new Error(`no Sol body ${profileId}`);
}

describe('crater law — the closed form reproduces the schedule it is derived from', () => {
  it('coverageBand over the FULL band equals craterSchedule.coverage', () => {
    for (const RE of [0.074, 0.273, 0.383, 0.532, 1.0]) {
      const cond = conditionFromBody(airless(RE));
      const sch = craterSchedule(cond);
      expect(sch.fired).toBe(true);
      const L = sch.D_LO_KM * sch.sizeMul;
      expect(coverageBand(sch, radPerKm(RE), L, sch.D_HI_KM)).toBeCloseTo(sch.coverage, 12);
    }
  });

  it('a sub-band never claims more coverage than the full band', () => {
    const cond = conditionFromBody(airless(0.273));
    const sch = craterSchedule(cond);
    const rpk = radPerKm(0.273);
    const L = sch.D_LO_KM * sch.sizeMul;
    const sub = coverageBand(sch, rpk, Math.max(L, CRATER_VIS_FLOOR_RAD * 0.273 * 6371), sch.D_HI_KM);
    expect(sub).toBeGreaterThan(0);
    expect(sub).toBeLessThan(sch.coverage);
  });
});

describe('crater law — uCraterAmp * uCraterScale is EXACTLY 1 (why craters need no population fit)', () => {
  it('holds across a 40x radius span, to float64 exactness', () => {
    for (const RE of [0.031, 0.074, 0.212, 0.273, 0.383, 0.532, 1.21]) {
      const u = craterUniformsFrom(conditionFromBody(airless(RE)));
      expect(u.density, `R=${RE} renders craters`).toBeGreaterThan(0);
      expect(u.amp * u.scale).toBeCloseTo(1, 12);
    }
  });

  it('the ejecta apron is scaled to the crater rim it leaves, not to a free constant', () => {
    const u = craterUniformsFrom(conditionFromBody(airless(0.273)));
    expect(u.ejectaAmp).toBeCloseTo(EJECTA_RIM_FRACTION * u.amp, 15);
  });
});

describe('crater law — the population, with no type label anywhere', () => {
  // The numbers are the measured ones from tools/port-crater-measure.mjs. Ranges, not point pins:
  // this is a tripwire on the law moving, not a golden.
  const EXPECT = {
    'sol-mercury': [0.39, 0.47],
    'sol-moon': [0.31, 0.38],
    'sol-callisto': [0.39, 0.47],
    'sol-europa': [0.28, 0.35],
    'sol-triton': [0.26, 0.32],
  };
  for (const [id, [lo, hi]] of Object.entries(EXPECT)) {
    it(`${id} keeps a crater record (density in [${lo}, ${hi}])`, () => {
      const u = craterUniformsFrom(conditionFromBody(solBody(id)));
      expect(u.density).toBeGreaterThanOrEqual(lo);
      expect(u.density).toBeLessThanOrEqual(hi);
    });
  }

  it('a temperate 1-bar Earthlike renders NO craters — erosion, not a label, suppresses them', () => {
    const earthlike = {
      radiusEarth: 1.0, massEarth: 1.0, T_eq: 255, age: 4.5,
      atmosphere: { color: [0, 0, 0], strength: 0.5, physics: { retained: true, pressure: 1.0, composition: 'n2-o2' } },
      composition: { density: 5500, volatileFraction: 0.05, ironFraction: 0.32 },
    };
    expect(craterUniformsFrom(conditionFromBody(earthlike)).density).toBeLessThan(0.01);
  });

  it('a molten world is not an impact surface at all', () => {
    const molten = { radiusEarth: 1.0, T_eq: 1400, atmosphere: null };
    expect(craterUniformsFrom(conditionFromBody(molten))).toEqual(CRATERS_OFF);
  });

  it('CRATERS_OFF has density 0 — the shader gate and the negative control are the same number', () => {
    expect(CRATERS_OFF.density).toBe(0);
    expect(CRATERS_OFF.ejectaStrength).toBe(0);
  });

  // The density law divides by what the shader MEASURABLY paints, not by the analytic disc area.
  // If someone "simplifies" this back to CELL_CRATER_AREA every body loses 2.7x of its craters, and
  // the result still looks like a cratered world — which is exactly why it needs a test.
  it('density divides by the MEASURED per-cell coverage, not the analytic disc area', () => {
    expect(RENDERED_CELL_COVERAGE).toBeLessThan(CELL_CRATER_AREA);
    expect(CELL_CRATER_AREA / RENDERED_CELL_COVERAGE).toBeCloseTo(2.66, 1);
    const cond = conditionFromBody(solBody('sol-moon'));
    const sch = craterSchedule(cond);
    const RE = cond.radiusEarth;
    const lo = Math.max(sch.D_LO_KM * sch.sizeMul, CRATER_VIS_FLOOR_RAD * RE * 6371);
    const target = coverageBand(sch, radPerKm(RE), lo, sch.D_HI_KM);
    expect(craterUniformsFrom(cond).density).toBeCloseTo(target / RENDERED_CELL_COVERAGE, 10);
  });

  it('same condition in, identical uniforms out', () => {
    const c = conditionFromBody(solBody('sol-moon'));
    expect(craterUniformsFrom(c)).toEqual(craterUniformsFrom(c));
  });
});

describe('crater law — the game must NOT inherit the lab morphology pin', () => {
  it('uCraterComplexD makes the game\'s craters COMPLEX (peaks + terraces), not simple bowls', () => {
    const cond = conditionFromBody(solBody('sol-moon'));
    const u = craterUniformsFrom(cond);
    // The shader: morphology = smoothstep(uCraterComplexD*0.6, uCraterComplexD, diameter), and the
    // smallest hashed diameter is 2*0.18 cell units. morphology == 1 for all of them iff the upper
    // smoothstep edge sits below that.
    expect(u.complexD).toBeLessThan(2 * 0.18);
    // and it IS the gravity law, not a constant
    expect(u.complexD).toBeGreaterThan(0);
    const Dchar = (cond.radiusEarth * 6371) / u.scale;
    expect(u.complexD).toBeCloseTo(transitionDiameterKm(cond.surfaceGravity) / Dchar, 10);
  });
});

// ── FENCE 1: the two analytic profiles are the lab's, token for token ─────────────────────────────
describe('crater transcription fence — craterProfile / ejectaProfile match the lab source', () => {
  const norm = (s) => s.replace(/\/\/[^\n]*/g, ' ').replace(/\s+/g, ' ').trim();
  const grab = (src, sig) => {
    const at = src.indexOf(sig);
    if (at < 0) throw new Error(`signature not found: ${sig}`);
    let depth = 0, i = src.indexOf('{', at);
    const start = i;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
    throw new Error(`unbalanced body: ${sig}`);
  };
  const lab = readFileSync(join(root, 'src/worldengine/shaders/height.glsl.js'), 'utf8');
  const game = readFileSync(join(root, 'src/worldengine/shaders/craterRelief.glsl.js'), 'utf8');

  for (const sig of [
    'vec2 craterProfile(float r, float morphology, float relaxation, float terraceCount)',
    'vec2 ejectaProfile(float r, float rampart, float rOuter)',
    'vec3 hash33(vec3 p)',
    'vec2 voronoi3d(vec3 p, int cells, out vec3 cellId, out vec3 grad)',
  ]) {
    it(`${sig.split('(')[0]} is byte-identical to the lab modulo whitespace and comments`, () => {
      expect(norm(grab(game, sig))).toBe(norm(grab(lab, sig)));
    });
  }

  it('the fence can fail — a one-constant mutation is caught', () => {
    const mutated = grab(game, 'vec2 ejectaProfile(float r, float rampart, float rOuter)')
      .replace('(r - 2.0)/0.3', '(r - 2.5)/0.3');
    expect(norm(mutated)).not.toBe(norm(grab(lab, 'vec2 ejectaProfile(float r, float rampart, float rOuter)')));
  });
});

// ── FENCE 3: a hand-authored atmosphere must carry physics, or the engine reads it as vacuum ──────
// There is no honest default for an unknown pressure, so conditionFromBody cannot guess one. The
// guarantee has to live here instead: any hand-authored body that says it HAS an atmosphere must say
// what that atmosphere IS. Without this, the next Sol body added with a {color, strength} wrapper
// silently reacquires a Moon-grade crater record.
describe('Sol data fence — a visual atmosphere without physics reads as a vacuum', () => {
  it('every Sol body carrying an atmosphere object also carries atmosphere.physics.pressure', () => {
    const offenders = [];
    for (const w of generateSolarSystem().planets) {
      const check = (b) => {
        if (!b?.atmosphere) return;
        if (typeof b.atmosphere.physics?.pressure !== 'number') {
          offenders.push(b.profileId || b.name || b.type);
        }
      };
      check(w.planetData);
      for (const m of (w.moons || [])) check(m);
    }
    expect(offenders).toEqual([]);
  });

  it('and the derived consequence holds: Sol\'s Earth keeps no crater record, its Moon does', () => {
    const earth = craterUniformsFrom(conditionFromBody(solBody('sol-earth')));
    const moon = craterUniformsFrom(conditionFromBody(solBody('sol-moon')));
    expect(earth.density).toBe(0);
    expect(moon.density).toBeGreaterThan(0.1);
  });
});

// ── FENCE 2: the wiring facts that fail silently if undone ────────────────────────────────────────
describe('crater wiring fence — the domain and the accumulator', () => {
  const planet = readFileSync(join(root, 'src/objects/Planet.js'), 'utf8');

  it('the combiner is called on the UNIT direction, not on object-space vPosition', () => {
    expect(planet).toMatch(/craterEjectaCombiner\(\s*normalize\(pos\)\s*,\s*gCraterH\s*,\s*gCraterSlope\s*\)/);
  });

  it('the crater slope is a SEPARATE argument to perturbNormalAnalytic, not folded into gReliefD', () => {
    expect(planet).toMatch(/vec3 perturbNormalAnalytic\(vec3 N, vec3 grad, vec3 craterSlope, float strength\)/);
    expect(planet).toMatch(/perturbNormalAnalytic\(vNormal, gReliefD\.yzw, gCraterSlope, perturbStrength\)/);
    // and it is applied AFTER the base-frequency divide, never before
    const fn = planet.slice(planet.indexOf('vec3 perturbNormalAnalytic('));
    const divide = fn.indexOf('max(baseFreq, 1e-6)');
    const craterTerm = fn.indexOf('craterSlope * uCraterReliefGain');
    expect(divide).toBeGreaterThan(-1);
    expect(craterTerm).toBeGreaterThan(divide);
  });

  it('craters carry their OWN gain, never uReliefNormalGain', () => {
    expect(planet).toMatch(/const CRATER_RELIEF_GAIN = 1\.0;/);
    expect(planet).not.toMatch(/craterSlope \* uReliefNormalGain/);
  });

  it('the crater functions are spliced into ROCKY only — gas and exotic do not pay their compile', () => {
    const rocky = planet.indexOf('const ROCKY_BODY');
    const header = planet.indexOf('const FRAG_HEADER');
    const splice = planet.indexOf('${CRATER_RELIEF_GLSL}');
    expect(splice).toBeGreaterThan(rocky);
    expect(rocky).toBeGreaterThan(header);
  });
});
