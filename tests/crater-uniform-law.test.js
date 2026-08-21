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
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';  import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js'; import { compositionClass } from '../src/worldengine/base/e1Regime.js';  // ⛔ RIDE THIS LINE: tests/driver-pack-rockysurface.test.js:1092 cites crater-uniform-law.test.js:74 by symbol, so a new import LINE reds the citation fence. Same idiom as src/objects/Moon.js:3.

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
  // ⛔⛔ THE FIVE SOL DENSITY PINS MOVED HERE 2026-08-20 (B2 leg 1) AND WERE **NOT** RE-RECORDED.
  // They were sol-mercury [0.39, 0.47] · sol-moon [0.31, 0.38] · sol-callisto [0.39, 0.47] ·
  // sol-europa [0.28, 0.35] · sol-triton [0.26, 0.32], measured by tools/port-crater-measure.mjs.
  // Re-deriving CRATER_VIS_FLOOR_RAD (0.02 → 9.6e-4) put all five out of range — measured on the
  // edited source: sol-callisto 0.7569, sol-europa 0.5636, sol-triton 0.5108 — and RE-BLESSING THEM
  // ON SOL IS FORBIDDEN. `SolarSystemData.js` carries zero `massEarth`, so every Sol moon's
  // `surfaceGravity` is fabricated as exactly 1/R² (docs/FEATURES/one-pipeline-two-frontends-PLAN.md:409),
  // and `craterSchedule` reads gravity through `sizeMul = (G_REF/g)^K_GS` — so a range refitted on
  // these bodies launders the exact defect that note exists to prevent. The PURPOSE is kept (catch
  // the LAW moving; never a golden) and the SUBJECTS are replaced with procedural bodies drawn from
  // `lab-procedural-0…24`, the same corpus family the ledger and the packs measure on.
  //
  // ⭐ AND THE REPLACEMENT IS STRONGER THAN THE FIVE NUMBERS IT RETIRES, because the law has a closed
  // form the point-pins could not see. In `coverageBand`, count ∝ (1/lo² − 1/H²) and E[D²] =
  // 2lo²ln(H/lo)/(1 − lo²/H²); the lo² and the (1 − lo²/H²) cancel exactly, leaving coverage ∝
  // ln(H/lo). So moving the floor multiplies EVERY floor-bound, unclamped body's density by exactly
  // ln(H/lo_new)/ln(H/lo_old) and changes nothing else. That is an identity, so it is tested as one.
  // VERIFIED before it was written: max |measured ratio − predicted| = 1.33e-15 over every floor-bound
  // body of `lab-procedural-0…24` × four floors {9.6e-4, 0.005, 0.02, 0.05}.
  const CORPUS_SEEDS = 25;
  const FIRED = [];
  for (let i = 0; i < CORPUS_SEEDS; i++) {
    const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
    for (const e of (sys.planets || [])) {
      const add = (d, kind) => {
        const cond = conditionFromBody(d);
        if (compositionClass(cond) === 'gas') return;
        const u = craterUniformsFrom(cond);
        if (!(u.density > 0)) return;
        const sch = craterSchedule(cond);
        const R_km = cond.radiusEarth * 6371;
        const L = sch.D_LO_KM * sch.sizeMul;
        FIRED.push({ kind, type: d.type, cond, u, sch, R_km, L, floorBinds: CRATER_VIS_FLOOR_RAD * R_km > L });
      };
      add(e.planetData, 'planet');
      for (const m of (e.moons || [])) add(m, m.isPlanetMoon === true ? 'planet-class' : 'plain-moon');
    }
  }
  /** The same closed form craterUniformsFrom runs, with the floor as a parameter. */
  const densityAtFloor = (b, floor) => Math.max(0, Math.min(1,
    coverageBand(b.sch, radPerKm(b.cond.radiusEarth), Math.max(b.L, floor * b.R_km), b.sch.D_HI_KM) / RENDERED_CELL_COVERAGE));

  it('POPULATION GUARD — the corpus slice produced enough of both outcomes to mean anything', () => {
    expect(FIRED.length, 'measured 98 on lab-procedural-0…24').toBeGreaterThanOrEqual(60);
    expect(FIRED.filter((b) => b.kind === 'planet').length, 'measured 27').toBeGreaterThan(0);
    expect(FIRED.filter((b) => b.kind === 'plain-moon').length, 'measured 71').toBeGreaterThan(0);
    expect(FIRED.filter((b) => b.floorBinds).length, 'measured 54').toBeGreaterThanOrEqual(30);
  });

  it('⭐ THE LAW TRIPWIRE — the floor scales a floor-bound density by ln(H/lo) and by nothing else', () => {
    const subjects = FIRED.filter((b) => b.floorBinds && b.u.density < 1);
    expect(subjects.length, 'no unclamped floor-bound body ⇒ this proves nothing').toBeGreaterThanOrEqual(20);
    // H == C_BASIN·R_km with C_BASIN 1.0 and lo == floor·R_km, so H/lo is 1/floor on every subject.
    const predicted = Math.log(1 / CRATER_VIS_FLOOR_RAD) / Math.log(1 / 0.02);
    expect(predicted).toBeCloseTo(1.7762107390117239, 12);
    for (const b of subjects) {
      expect(b.u.density / densityAtFloor(b, 0.02), `${b.kind}/${b.type} R=${b.cond.radiusEarth}`)
        .toBeCloseTo(predicted, 12);
    }
    // …and the arm CAN fail: a floor silently reverted to 0.02 makes the ratio 1 and reds every subject.
    expect(Math.abs(predicted - 1)).toBeGreaterThan(0.5);
  });

  it('…and the population PARTITIONS into three classes, of which one is bit-untouched by the move', () => {
    // ⚠ WRITTEN WRONG FIRST AND KEPT AS THE CORRECTION: `!floorBinds` is evaluated at the NEW floor,
    // and a body can be L-bound at 9.6e-4 while the OLD 0.02 still bound it — those bodies move, by a
    // body-dependent ln(H/L)/ln(H/0.02·R_km) rather than by the population-wide constant. The class
    // that cannot move is the one whose schedule low edge already exceeds the OLD floor's lo.
    const untouched = FIRED.filter((b) => b.L >= 0.02 * b.R_km);
    const bothFloors = FIRED.filter((b) => b.floorBinds);
    const crossed = FIRED.filter((b) => !b.floorBinds && b.L < 0.02 * b.R_km);
    expect(untouched.length + bothFloors.length + crossed.length).toBe(FIRED.length);
    // MEASURED 2026-08-20 on lab-procedural-0…24: untouched 2, floor-bound at both floors 54,
    // crossed 42. ⚠ `untouched` is a THIN class here, so its arm is a PRESENCE check and is not a
    // population claim; the partition-sums-to-FIRED arm above is what carries the weight.
    expect(untouched.length, 'measured 2').toBeGreaterThanOrEqual(1);
    expect(crossed.length, 'measured 42').toBeGreaterThanOrEqual(20);
    for (const b of untouched) expect(densityAtFloor(b, 0.02), `${b.kind}/${b.type}`).toBe(b.u.density);
    // …and every crossed body moved, so the class is not a relabelled copy of the untouched one —
    // EXCEPT where clamp01 already saturated it at 1 on both sides, which is a real third outcome and
    // is excluded by name rather than by loosening the arm. MEASURED: crossed-and-unclamped 26 of 42.
    const crossedLive = crossed.filter((b) => b.u.density < 1);
    expect(crossedLive.length, 'measured 26').toBeGreaterThanOrEqual(10);
    for (const b of crossedLive) expect(densityAtFloor(b, 0.02), `${b.kind}/${b.type}`).not.toBe(b.u.density);
  });

  it('the five procedural subjects that replace Sol\'s five — over a radius span Sol could not offer', () => {
    // Sol's five all sat in 0.21–0.38 R⊕; these span 0.22–0.92. Selected by DECLARED PREDICATE
    // (nearest radius among floor-bound unclamped subjects) so a moving moon population RE-SELECTS
    // instead of reddening — the same reason FAMILY 27 in the rocky pack suite pins no moon count.
    const cand = FIRED.filter((b) => b.floorBinds && b.u.density < 1);
    const nearest = (t) => cand.reduce((a, b) =>
      Math.abs(b.cond.radiusEarth - t) < Math.abs(a.cond.radiusEarth - t) ? b : a);
    // MEASURED 2026-08-20 at 9.6e-4: 0.9408 · 0.0011294 · 0.0010203 · 0.15637 · 0.00070110.
    const BANDS = [[0.20, 0.70, 1.00], [0.30, 8e-4, 1.6e-3], [0.45, 7e-4, 1.5e-3], [0.65, 0.11, 0.22], [0.90, 5e-4, 1.0e-3]];
    for (const [t, lo, hi] of BANDS) {
      const b = nearest(t);
      const id = `R≈${t}: ${b.kind}/${b.type} R=${b.cond.radiusEarth.toFixed(4)}`;
      expect(b.u.density, id).toBeGreaterThanOrEqual(lo);
      expect(b.u.density, id).toBeLessThanOrEqual(hi);
      // ⭐ THE ARM THAT STOPS THIS BEING A GOLDEN: the PRE-B2 floor's answer must fall OUTSIDE the band.
      const before = densityAtFloor(b, 0.02);
      expect(before < lo || before > hi, `${id} — band must exclude the 0.02 answer ${before}`).toBe(true);
    }
  });

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
