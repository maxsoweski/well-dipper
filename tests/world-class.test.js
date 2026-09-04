// tests/world-class.test.js — the derived-class split (docs/WORKSTREAMS/derived-world-class).
//
// What this file is for: `PlanetGenerator.type` is the FORMATION SEED (rolled first, then it chooses
// the body's radius, mass, atmosphere and moon count) and `worldClass` is the DERIVED class read back
// off the finished physics. The tests below hold the three properties that make that split real —
// the band is the engine's own, the derived name never contradicts the body's physics, and nothing
// upstream reads the label.
import { describe, it, expect } from 'vitest';
import {
  worldClassOf, displayClassOf, isHabitableClass,
  HAB_T_LO, HAB_T_HI, HAB_V_MIN, HAB_R_MAX, EXOTIC_TYPES,
} from '../src/generation/worldClass.js';
import { inSeededBand, compositionClass } from '../src/worldengine/base/e1Regime.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { T_ICE_HI, BIO_T_LIMIT } from '../src/worldengine/base/surfaceMaterial.js';

// An Earth-shaped condition vector with one knob turned. surfaceGravity 1 + radiusEarth 1 ⇒
// massEarthOf = 1, which sits inside e1Regime's mass band, so the probes below isolate T and V.
const cv = (over = {}) => ({
  radiusEarth: 1.0, surfaceGravity: 1.0, T_eq: 288, age: 4.5,
  atmosphere: { pressure: 1.0, composition: 'n2-o2' },
  composition: { ironFraction: 0.32, density: 5.5, volatileFraction: 0.3 },
  ...over,
});

describe('the habitable band is the ENGINE\'s, not a second opinion', () => {
  // ⭐ THE POINT OF THIS BLOCK. worldClass.js restates e1Regime's BAND values because `BAND` is
  // module-private. A restated constant is a copy, and a copy drifts silently — which is exactly the
  // one-name-two-meanings failure this whole workstream exists to fix. So instead of trusting the
  // comment, these probe the LIVE `inSeededBand()` for where it actually flips, and pin our copies to
  // what the engine does today. If someone edits BAND, this file goes red instead of the galaxy
  // quietly starting to lie again.
  const flip = (build, lo, hi) => {           // binary search for the edge, to 0.001
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (inSeededBand(build(mid))) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  };

  it('T_LO matches where inSeededBand actually opens', () => {
    expect(flip((T) => cv({ T_eq: T }), 100, 288)).toBeCloseTo(HAB_T_LO, 2);
  });

  it('T_HI matches where inSeededBand actually closes', () => {
    // Search downward: above the edge it is false, below it is true — invert the predicate's sense
    // by searching for the flip from the hot side.
    let lo = 288, hi = 600;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (inSeededBand(cv({ T_eq: m }))) lo = m; else hi = m; }
    expect((lo + hi) / 2).toBeCloseTo(HAB_T_HI, 2);
  });

  it('V_MIN matches where inSeededBand actually opens', () => {
    expect(flip((V) => cv({ composition: { ironFraction: 0.32, density: 5.5, volatileFraction: V } }), 0, 0.5))
      .toBeCloseTo(HAB_V_MIN, 3);
  });

  it('the size bound is deliberately NOT the engine\'s mass gate — Max ruled super-Earths count', () => {
    // A 1.35 R⊕ / ~3 M⊕ warm wet world: OUT of inSeededBand (mass 3.0 > its 1.6 ceiling), IN for us.
    // This is the one place the two deliberately disagree, so it is asserted rather than assumed.
    const superEarth = cv({ radiusEarth: 1.35, surfaceGravity: 1.65, T_eq: 298 });
    expect(inSeededBand(superEarth)).toBe(false);
    expect(worldClassOf(superEarth)).toMatch(/^(ocean|terrestrial)$/);
    expect(HAB_R_MAX).toBe(1.8);   // the radius valley, Fulton 2017 — see worldClass.js
  });
});

describe('the derived name never contradicts the body\'s own physics', () => {
  // The AC-1 / AC-2 invariants, over the same 200-seed population the workstream measured.
  // Baselines being held to zero here were 11 / 7 / 15 / 6 before the split.
  const rows = [];
  for (let i = 0; i < 200; i++) {
    for (const e of StarSystemGenerator.generate(`rocky-${i}`, null).planets) {
      const d = e.planetData || e, c = conditionFromBody(d);
      if (compositionClass(c) === 'gas') continue;
      rows.push({ seed: `rocky-${i}`, k: d.worldClass, T: c.T_eq ?? 288,
                  V: c.composition?.volatileFraction ?? 0.15, R: c.radiusEarth ?? 1 });
    }
  }
  const habitable = (r) => r.T >= HAB_T_LO && r.T <= HAB_T_HI && r.V >= HAB_V_MIN && r.R <= HAB_R_MAX;
  const named = (r) => r.k === 'ocean' || r.k === 'terrestrial';

  it('the population is the one the workstream measured (guards against a silent generator change)', () => {
    expect(rows.length).toBe(476);
    expect(rows.filter(habitable).length).toBe(14);
  });

  it('every warm wet world IS named a habitable one — was 11 of 14 misnamed', () => {
    expect(rows.filter((r) => habitable(r) && !named(r)).map((r) => r.seed)).toEqual([]);
  });

  it('nothing named ocean/terrestrial is dry or scorching — was 7 of 7 wrong', () => {
    expect(rows.filter((r) => named(r) && !habitable(r)).map((r) => r.seed)).toEqual([]);
  });

  it('no lava world is cold and no ice world is boiling — was 15 and 6', () => {
    expect(rows.filter((r) => r.k === 'lava' && r.T < BIO_T_LIMIT).map((r) => r.seed)).toEqual([]);
    expect(rows.filter((r) => r.k === 'ice' && r.T > T_ICE_HI).map((r) => r.seed)).toEqual([]);
  });

  it('every solid body got a class — no body falls through the dispatch', () => {
    expect(rows.filter((r) => r.k == null).length).toBe(0);
  });
});

describe('the split holds: the label is downstream and stays there', () => {
  it('worldClassOf is pure — same condition in, same class out, no hidden state', () => {
    const c = cv();
    const first = worldClassOf(c);
    for (let i = 0; i < 50; i++) expect(worldClassOf(cv())).toBe(first);
  });

  it('⛔ NOTHING UPSTREAM READS IT: deleting worldClass changes no derived physics', () => {
    // The loop this workstream cut was label → physics → label. This is the standing guard against
    // it being rebuilt: strip the field and every downstream physical derivation must be unmoved.
    // If a future edit feeds `worldClass` into a law, this goes red.
    const d = StarSystemGenerator.generate('rocky-126', null).planets[1].planetData;
    const withField = JSON.stringify(conditionFromBody(d));
    const { worldClass, ...without } = d;
    expect(worldClass).toBeTruthy();                       // liveness: the field really is there,
    expect(JSON.stringify(conditionFromBody(without))).toBe(withField);   // so the equality means something
  });

  it('gas bodies keep the formation roll — the giant carve-out is deliberate', () => {
    expect(worldClassOf(cv({ atmosphere: { pressure: 1e4, composition: 'h2-he' } }))).toBeNull();
  });

  it('an exotic overlay outranks the physics for DISPLAY but not for search', () => {
    for (const t of EXOTIC_TYPES) {
      expect(displayClassOf({ type: t, worldClass: 'terrestrial' })).toBe(t);
    }
    // ...while the seed search still finds it, because that reads the derived class.
    expect(isHabitableClass({ type: 'fungal', worldClass: 'terrestrial' })).toBe(true);
  });

  it('a hand-authored body with no derived class still displays (SolarSystemData path)', () => {
    expect(displayClassOf({ type: 'gas-giant' })).toBe('gas-giant');
  });
});
