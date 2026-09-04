// Workstream `volatile-delivery` — the surface-volatile delivery law (PhysicsEngine §3b).
//
// WHY THIS SUITE EXISTS. `deriveComposition` used to make volatileFraction a pure function of
// `orbitAU / frostLineAU` while T_eq is that same variable inverted, so *temperate ⇒ dry* held BY
// CONSTRUCTION and no body in 1,183 was ever both. The charter's operational test (Max, 2026-09-04)
// is that **a generation law is wrong if it makes a whole class of physically-real world
// unreachable**, so the assertions below are about REACHABILITY and about the real bodies the engine
// is calibrated on — never about a rate, which would be fitting the law to our own generator
// (the move surfaceMaterial.js:364 refuses in writing).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  deriveComposition, surfaceVolatileInventory,
  VOL_TRACE_FLOOR, DELIV_MAX, SOLAR_SOLID_INVENTORY,
} from '../src/generation/PhysicsEngine.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass, inSeededBand } from '../src/worldengine/base/e1Regime.js';

const FROST = 4.85;   // AU, solar
const ratio = (au) => au / FROST;

// ── The six real bodies driver-presets.js is calibrated on. Each BOUND is derived from the gate that
//    body must sit on — never a round number picked for looks.
//    ⚠ Two presets carry a DECORATIVE orbit slot ('Europa (icy moon)' stores its orbit around JUPITER,
//    'Moon/Mercury (impact-airless)' a placeholder), so the real heliocentric distance is used here —
//    which is also what the generator sees at runtime, because MoonGenerator passes the PARENT's AU.
const ANCHORS = [
  { name: 'Earth',        M: 1.0,   R: 1.0,  T: 288, au: 1.00, ice: 0.035, lo: 0.12, hi: 0.20,
    why: 'must clear e1Regime BAND.V_MIN 0.12; passiveMargins MARGIN_VF0 anchors 1.0 at 0.15' },
  { name: 'Venus',        M: 0.815, R: 0.95, T: 737, au: 0.723, ice: 0.030, lo: 0.00, hi: 0.05,
    why: "at/under labCore.js:693's bone-dry floor; stagnantLid.js:94 makes Venus the dryness reference at 0.02" },
  { name: 'Mars',         M: 0.107, R: 0.53, T: 210, au: 1.524, ice: 0.040, lo: 0.05, hi: 0.14,
    why: 'must clear the bone-dry floor (Mars has ground ice) and reach surfaceMaterial OX_VOL_HI 0.10' },
  { name: 'Moon/Mercury', M: 0.04,  R: 0.38, T: 235, au: 1.00, ice: 0.035, lo: 0.00, hi: 0.03,
    why: 'OX_VOL_LO sits ON them at 0.02 and they must read EXACTLY zero oxidiser' },
  { name: 'Titan',        M: 0.025, R: 0.40, T: 94,  au: 9.54, ice: 0.44, lo: 0.30, hi: 0.70,
    why: 'beyond the frost line — the in-situ arm, which the delivery term must not have eaten' },
  { name: 'Europa',       M: 0.07,  R: 0.50, T: 110, au: 5.20, ice: 0.31, lo: 0.30, hi: 0.70,
    why: 'beyond the frost line — same arm' },
];
const V = (a, over = {}) => surfaceVolatileInventory({
  iceFraction: a.ice, frostRatio: ratio(a.au), massEarth: a.M, radiusEarth: a.R, T_eq: a.T,
  metallicity: 0, solidInventory: SOLAR_SOLID_INVENTORY, deliveryFloat: 0.5, ...over,
});

describe('volatile delivery — §3b reproduces the six real bodies the engine is calibrated on', () => {
  for (const a of ANCHORS) {
    it(`${a.name} lands in [${a.lo}, ${a.hi}] — ${a.why}`, () => {
      const v = V(a);
      expect(v, `${a.name} V=${v.toFixed(4)}`).toBeGreaterThanOrEqual(a.lo);
      expect(v, `${a.name} V=${v.toFixed(4)}`).toBeLessThanOrEqual(a.hi);
    });
  }

  it('[CONTROL] with delivery zeroed, the inner anchors collapse and the outer ones do NOT', () => {
    // deliveryFloat -Infinity ⇒ the log-normal draw is 0 ⇒ the delivered term vanishes, leaving only
    // the in-situ arm. This is what separates the two terms: if the law had ONE term, or if the
    // delivery term were wired to nothing, this control could not tell them apart.
    const off = { deliveryFloat: -Infinity };
    expect(V(ANCHORS[0], off), 'Earth must collapse to the trace floor').toBeCloseTo(VOL_TRACE_FLOOR, 10);
    expect(V(ANCHORS[2], off), 'Mars must collapse to the trace floor').toBeCloseTo(VOL_TRACE_FLOOR, 10);
    expect(V(ANCHORS[4], off), 'Titan is in-situ and must NOT move').toBeCloseTo(V(ANCHORS[4]), 10);
    expect(V(ANCHORS[5], off), 'Europa is in-situ and must NOT move').toBeCloseTo(V(ANCHORS[5]), 10);
  });

  it('the delivered inventory approaches its ceiling asymptotically — it never piles up ON it', () => {
    // A hard min() makes a SATURATING instrument: a first cut of this law put 34 of 1,183 bodies
    // exactly on the 0.7 clamp, which is the QB-23 defect (F13's outflow ramp saturating on 62 of 66
    // relict worlds). A saturated field cannot tell 0.7 from 3.0.
    // ⚠ SWEPT ON THE DRAW, NOT ON `solidInventory`. The system proxies are CLAMPED on purpose — a
    // system with 1000x the Sun's solid reservoir is not a physical input — and an input clamp is not
    // output saturation. The stochastic draw is the term with no upper bound, so it is the one that
    // can prove the ceiling is soft.
    const huge = ANCHORS[0];
    const vals = [0.5, 0.9, 0.99, 0.999, 0.9999].map((f) => V(huge, { deliveryFloat: f, metallicity: 0.6 }));
    for (let i = 1; i < vals.length; i++) expect(vals[i], 'monotone').toBeGreaterThan(vals[i - 1]);
    expect(vals[vals.length - 1], 'below the ceiling, always').toBeLessThan(VOL_TRACE_FLOOR + DELIV_MAX);
    // no two EQUAL — equality between adjacent samples is what saturation looks like
    expect(new Set(vals.map((v) => v.toFixed(12))).size, 'distinct values, not a clamp').toBe(vals.length);
  });
});

describe('volatile delivery — the field split', () => {
  it('deriveComposition returns BOTH fields, and density reads the BULK one', () => {
    const c = deriveComposition(0, 1.0, FROST, 0.5, { massEarth: 1, radiusEarth: 1, T_eq: 288, solidInventory: SOLAR_SOLID_INVENTORY, deliveryFloat: 0.5 });
    expect(c).toHaveProperty('iceFraction');
    expect(c).toHaveProperty('volatileFraction');
    expect(c.volatileFraction, 'the surface inventory is the one that moved').toBeGreaterThan(c.iceFraction);
    // ⭐ THE LOAD-BEARING ONE. MoonGenerator.js derives moon.massEarth FROM composition.density and
    // checkTidalLock reads that mass, so density must be a pure function of the BULK field.
    const bare = deriveComposition(0, 1.0, FROST, 0.5);
    expect(c.density, 'density must not see the surface inventory').toBe(bare.density);
    expect(c.iceFraction).toBe(bare.iceFraction);
  });

  it('without the body bundle the surface inventory degrades to the accreted ice — a declared fallback, not a default', () => {
    const bare = deriveComposition(0, 1.0, FROST, 0.5);
    expect(bare.volatileFraction).toBe(bare.iceFraction);
  });

  it('⛔ the world engine is NOT edited: this workstream changes src/generation only', () => {
    // The engine's scale is the anchored side (six real bodies, and surfaceMaterial.js:364 records a
    // REFUSED corpus-fitted alternative). If a later change starts moving the engine to meet the
    // generator instead, these anchors are the thing that should red — so they are asserted here
    // against the engine's own constants rather than against copies.
    const pm = readFileSync('src/worldengine/base/passiveMargins.js', 'utf8');
    expect(pm, "passiveMargins' Earth anchor").toMatch(/MARGIN_VF0\s*=\s*0\.15/);
    const lc = readFileSync('src/worldengine/base/labCore.js', 'utf8');
    expect(lc, "labCore's bone-dry floor").toMatch(/smoothstep\(0\.05,\s*0\.2,\s*volatileFraction\)/);
  });
});

describe('volatile delivery — the unreachable class is reachable (the charter\'s own test)', () => {
  // 60 seeds rather than 200: enough for the existence claims below, and this runs in the suite.
  const rows = [];
  for (let i = 0; i < 60; i++) {
    for (const e of StarSystemGenerator.generate(`rocky-${i}`, null).planets) {
      const d = e.planetData || e;
      const push = (dd) => {
        const c = conditionFromBody(dd);
        if (compositionClass(c) === 'gas') return;
        rows.push({ T: c.T_eq ?? 288, V: c.composition?.volatileFraction ?? 0.15, band: inSeededBand(c) });
      };
      push(d);
      for (const m of (e.moons || [])) push(m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: 'pm' } : m);
    }
  }
  const temperate = rows.filter((r) => r.T >= 250 && r.T <= 320);

  it('the corpus is non-trivial (this suite would otherwise assert nothing)', () => {
    expect(rows.length).toBeGreaterThan(300);
    expect(temperate.length).toBeGreaterThan(20);
  });

  it('⭐ a body can be temperate AND wet — it could not be, at all, before this law', () => {
    expect(temperate.filter((r) => r.V >= 0.12).length).toBeGreaterThan(0);
  });

  it('⭐ the plate band admits somebody — it admitted 0 of 1,183 before', () => {
    expect(rows.filter((r) => r.band).length).toBeGreaterThan(0);
  });

  it('temperate volatiles are a DISTRIBUTION, not a cliff', () => {
    // The parent's whole temperate population spanned 0.0107 … 0.0585 — a spread of 0.0478 with its
    // ceiling BELOW the engine's own bone-dry floor of 0.05. Anything wider than that, with mass above
    // the floor, is the qualitative change; the exact width is reported, never asserted.
    const v = temperate.map((r) => r.V).sort((a, b) => a - b);
    expect(v[v.length - 1] - v[0], 'spread must exceed the parent\'s 0.0478').toBeGreaterThan(0.0478);
    expect(v[v.length - 1], 'and reach past the bone-dry floor').toBeGreaterThan(0.05);
  });

  it('no body sits ON the 0.7 clamp — the population is measured, not truncated', () => {
    // The parent had 0 bodies at the clamp. A first cut of this law put 34 of 1,183 there; the soft
    // ceiling and the geometric-mean system term brought it back to 0. Any number above zero here
    // means some worlds are reporting the same value for different physics.
    expect(rows.filter((r) => r.V >= 0.699).length).toBe(0);
  });

  it('[CONTROL] the frozen worlds stay wet — reachability was not bought by flattening the population', () => {
    const frozen = rows.filter((r) => r.T < 200);
    expect(frozen.length).toBeGreaterThan(50);
    expect(frozen.filter((r) => r.V >= 0.25).length, 'cold bodies beyond the frost line are still icy').toBeGreaterThan(30);
  });
});
