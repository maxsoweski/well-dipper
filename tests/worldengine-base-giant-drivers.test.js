// tests/worldengine-base-giant-drivers.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Slice D (DERIVER) — the derive-not-freeze D-slot deriver. Binds the AC-DERIVER (D1-D5) floors
// DIRECTLY to giant-drivers.js (the OUTPUT floors alone can't tell "derived D-slots" from "frozen
// D-slots + phaseJet" — BUILD-PLAN §6 [RESOLVED-BY-REVISE-2:1]), plus AC-LAT / AC-BANDS variety over the
// derived jet profile, determinism, the static-source guard (climate-e5 mold), and the AC-0 static
// driver-connectivity audit. Floors are MEASURED from the live sweep (tools/giant-drivers-calibrate.mjs
// + -lat.mjs) and pinned here — see the giant-drivers.js header CALIBRATION block.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  E5_REGIME, DRIVER_BUNDLES,
  resolveParams, amplitudeLaw, rhinesWavenumber, equatorialJetSign, jetProfile, PHYS,
} from '../src/worldengine/base/climate-e5.js';
import { resolveStormPlacement, resolveStormE } from '../src/worldengine/base/storm-e.js';
import {
  drawGiantConditions, deriveGiantDrivers, deriveGiantDriversForSeed, canonicalGiantCondition,
  SWEEP_SEEDS, GIANT_EXP, GIANT_DRAW, AGE0,
} from '../src/worldengine/base/giant-drivers.js';

const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/giant-drivers.js', import.meta.url)), 'utf8');
// source with comments stripped — the static guards must inspect CODE, not documentation prose
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const STORM_REGIMES = [E5_REGIME.GAS_GIANT, E5_REGIME.SATURNIAN, E5_REGIME.NEPTUNIAN, E5_REGIME.SUB_NEPTUNE];
const ALL_REGIMES = Object.values(E5_REGIME);
const N = SWEEP_SEEDS.length;

const stdev = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
const setSize = (xs) => new Set(xs.map((x) => +x.toFixed(9))).size;

// Derive the full closed-form params P for a (regime, seed): merge the derived triple over the bundle's
// rotationRate/radius (what the lab passes), so uPeak/m/sEq come from the DERIVED shear profile.
function derivedParams(regime, seed) {
  const bundle = DRIVER_BUNDLES[regime];
  const base = canonicalGiantCondition(regime);
  const d = deriveGiantDrivers(drawGiantConditions(regime, base, seed));
  return resolveParams(regime, { ...d, rotationRate: bundle.rotationRate, radius: bundle.radius }, seed);
}

// ── AC-DERIVER — the floors bound DIRECTLY to the deriver (BUILD-PLAN §6) ──────────────────────────────
describe('giant-drivers AC-DERIVER (D1-D5) — deriver actually engaged', () => {
  it('[D1] derived uPeak set-size ≥ ⌈0.75·N⌉ across the sweep (every regime)', () => {
    for (const regime of ALL_REGIMES) {
      const up = SWEEP_SEEDS.map((s) => derivedParams(regime, s).uPeak);
      expect(setSize(up)).toBeGreaterThanOrEqual(Math.ceil(0.75 * N));   // = 9
    }
  });

  it('[D2] derived uPeak stdev ≥ 3% of the frozen uPeak (a real spread, not epsilon) — every regime', () => {
    // measured uPeak-stdev/frozen-uPeak ratios: J 5.7% · S 6.7% · N 5.4% · SubN 6.5% · HJ 5.9% (all > 3%).
    for (const regime of ALL_REGIMES) {
      const bundle = DRIVER_BUNDLES[regime];
      const frozenUPeak = amplitudeLaw(bundle.internalHeat, bundle.dissipation, bundle.shellDepthFrac);
      const up = SWEEP_SEEDS.map((s) => derivedParams(regime, s).uPeak);
      expect(stdev(up)).toBeGreaterThanOrEqual(0.03 * frozenUPeak);
    }
  });

  it('[D3] canonical condition reproduces the DRIVER_BUNDLES triple EXACTLY (≤1e-9) — every regime', () => {
    for (const regime of ALL_REGIMES) {
      const b = DRIVER_BUNDLES[regime];
      const d = deriveGiantDrivers(canonicalGiantCondition(regime));
      expect(Math.abs(d.internalHeat - b.internalHeat)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(d.shellDepthFrac - b.shellDepthFrac)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(d.dissipation - b.dissipation)).toBeLessThanOrEqual(1e-9);
    }
  });

  describe('[D4] per-dependency monotonicity (signs are physics-fixed, DERIVE-FORMS FORMS TABLE)', () => {
    const regime = E5_REGIME.GAS_GIANT;              // interior of every band at canonical → no clamp
    const canon = canonicalGiantCondition(regime);
    const bump = (patch) => ({ ...canon, ...patch });

    it('internalHeat ↑ with mass (α>0)', () => {
      const lo = deriveGiantDrivers(bump({ surfaceGravity: canon.surfaceGravity * 0.98 })).internalHeat;
      const hi = deriveGiantDrivers(bump({ surfaceGravity: canon.surfaceGravity * 1.02 })).internalHeat;
      expect(hi).toBeGreaterThan(lo);
    });
    it('internalHeat ↓ with age (β>0)', () => {
      const young = deriveGiantDrivers(bump({ age: AGE0 * 0.9 })).internalHeat;
      const old = deriveGiantDrivers(bump({ age: AGE0 * 1.1 })).internalHeat;
      expect(old).toBeLessThan(young);
    });
    it('internalHeat ↓ with T_eq (γ>0)', () => {
      const cold = deriveGiantDrivers(bump({ T_eq: canon.T_eq * 0.98 })).internalHeat;
      const hot = deriveGiantDrivers(bump({ T_eq: canon.T_eq * 1.02 })).internalHeat;
      expect(hot).toBeLessThan(cold);
    });
    it('shellDepthFrac ↓ with enrichment-Z / density (δ>0)', () => {
      const lean = deriveGiantDrivers(bump({ density: canon.density * 0.98 })).shellDepthFrac;
      const rich = deriveGiantDrivers(bump({ density: canon.density * 1.02 })).shellDepthFrac;
      expect(rich).toBeLessThan(lean);
    });
    it('shellDepthFrac ↓ with metallicity (primary enrichment path)', () => {
      const Z0 = deriveGiantDrivers(canon).shellDepthFrac;                              // proxy path (metallicity undefined)
      const rich = deriveGiantDrivers(bump({ metallicity: 3.0 })).shellDepthFrac;       // high explicit metallicity
      expect(rich).toBeLessThan(Z0);
    });
    it('dissipation ↑ with shellDepthFrac (ε>0) — leaner Z ⇒ deeper shell ⇒ more Ohmic drag', () => {
      const shallow = deriveGiantDrivers(bump({ density: canon.density * 1.02 }));      // richer ⇒ shallower SDF
      const deep = deriveGiantDrivers(bump({ density: canon.density * 0.98 }));         // leaner ⇒ deeper SDF
      expect(deep.shellDepthFrac).toBeGreaterThan(shallow.shellDepthFrac);
      expect(deep.dissipation).toBeGreaterThan(shallow.dissipation);                    // dissipation tracks SDF
    });
    it('dissipation ↑ with T_eq (ζ>0)', () => {
      const cold = deriveGiantDrivers(bump({ T_eq: canon.T_eq * 0.98 })).dissipation;
      const hot = deriveGiantDrivers(bump({ T_eq: canon.T_eq * 1.02 })).dissipation;
      expect(hot).toBeGreaterThan(cold);
    });
  });

  it('[D5] derived params.uPeak ≠ frozen-bundle uPeak for ≥3/4 of the sweep (kills verbatim passthrough)', () => {
    for (const regime of ALL_REGIMES) {
      const bundle = DRIVER_BUNDLES[regime];
      const frozenUPeak = amplitudeLaw(bundle.internalHeat, bundle.dissipation, bundle.shellDepthFrac);
      const differ = SWEEP_SEEDS.filter((s) => Math.abs(derivedParams(regime, s).uPeak - frozenUPeak) > 1e-9).length;
      expect(differ).toBeGreaterThanOrEqual(Math.ceil(0.75 * N));   // = 9
    }
  });
});

// ── AC-DERIVER ranges — the derived triple stays regime-plausible (ratified ±12%/band/±15% clamps) ──
describe('giant-drivers — derived triple stays in the ratified per-regime ranges', () => {
  const SDF_BAND = {
    [E5_REGIME.GAS_GIANT]: [0.74, 0.86], [E5_REGIME.SATURNIAN]: [0.85, 0.95],
    [E5_REGIME.NEPTUNIAN]: [0.09, 0.21], [E5_REGIME.SUB_NEPTUNE]: [0.28, 0.44],
    [E5_REGIME.HOT_JUPITER]: [0.80, 0.90],
  };
  it('internalHeat ∈ IH0·[0.88,1.12], dissipation ∈ DIS0·[0.85,1.15], shellDepthFrac ∈ regime band', () => {
    for (const regime of ALL_REGIMES) {
      const b = DRIVER_BUNDLES[regime], band = SDF_BAND[regime];
      for (const s of SWEEP_SEEDS) {
        const d = deriveGiantDriversForSeed(regime, canonicalGiantCondition(regime), s);
        expect(d.internalHeat).toBeGreaterThanOrEqual(b.internalHeat * 0.88 - 1e-9);
        expect(d.internalHeat).toBeLessThanOrEqual(b.internalHeat * 1.12 + 1e-9);
        expect(d.dissipation).toBeGreaterThanOrEqual(b.dissipation * 0.85 - 1e-9);
        expect(d.dissipation).toBeLessThanOrEqual(b.dissipation * 1.15 + 1e-9);
        expect(d.shellDepthFrac).toBeGreaterThanOrEqual(band[0] - 1e-9);
        expect(d.shellDepthFrac).toBeLessThanOrEqual(band[1] + 1e-9);
      }
    }
  });
});

// ── AC-BANDS — band COUNT varies; eq-jet DIRECTION flips for Sub-Neptune ONLY ──────────────────────────
describe('giant-drivers AC-BANDS (band count + drift direction)', () => {
  it('[count varies] rhinesWavenumber set-size ≥ 2 across the sweep — every regime crosses a boundary', () => {
    // measured: J{12,13} S{10,11} N{2,3} SubN{3,4} HJ{4,5}. Jovian n=12.21 / Neptunian n=2.529 straddle.
    for (const regime of ALL_REGIMES) {
      const counts = SWEEP_SEEDS.map((s) => rhinesWavenumber(DRIVER_BUNDLES[regime].rotationRate, DRIVER_BUNDLES[regime].radius, derivedParams(regime, s).uPeak));
      expect(new Set(counts).size).toBeGreaterThanOrEqual(2);
    }
  });

  it('[eqSign] Sub-Neptune eq-jet direction STRADDLES D_THR=0.40 (both signs); other regimes are fixed', () => {
    const signOf = (regime) => new Set(SWEEP_SEEDS.map((s) => {
      const d = deriveGiantDriversForSeed(regime, canonicalGiantCondition(regime), s);
      return Math.sign(equatorialJetSign(d.shellDepthFrac)) || 1;
    }));
    expect(signOf(E5_REGIME.SUB_NEPTUNE)).toEqual(new Set([-1, 1]));   // the ratified SubN-only flip (§5.2)
    for (const regime of [E5_REGIME.GAS_GIANT, E5_REGIME.SATURNIAN, E5_REGIME.NEPTUNIAN, E5_REGIME.HOT_JUPITER]) {
      expect(signOf(regime).size).toBe(1);                            // fixed drift sign (shell far from 0.40)
    }
  });

  it('[straddle is real] only Sub-Neptune\'s SDF band crosses 0.40', () => {
    for (const regime of ALL_REGIMES) {
      const sdf = SWEEP_SEEDS.map((s) => deriveGiantDriversForSeed(regime, canonicalGiantCondition(regime), s).shellDepthFrac);
      const crosses = Math.min(...sdf) < PHYS.D_THR && Math.max(...sdf) >= PHYS.D_THR;
      expect(crosses).toBe(regime === E5_REGIME.SUB_NEPTUNE);
    }
  });

  // BUILD-PLAN §6 AC-BANDS floor (3) — the per-band sign-vector clause [RESOLVED-BY-REVISE-2:3]:
  // quantify per-band drift-sign disagreement over a DIFFERENT-m seed pair (where the band COUNT genuinely
  // differs), measure-first-then-pin (the 0.35 floor is MEASURED here, not guessed a priori). This is the
  // "layout is not one field rescaled/phase-shifted" bar and it is ALSO the anti-cheat bite: a frozen-triple
  // deriver rides phaseJet/ampJitter but uPeak is triple-ONLY (phaseJet-independent) ⇒ m is CONSTANT across
  // the sweep ⇒ NO different-m pair exists ⇒ this floor is unsatisfiable for it (the required different-m
  // pair below is exactly what the frozen-triple cheat cannot produce). Measured max different-m-pair
  // disagreement over the pinned sweep: J .578 · S .594 · N .625 · SubN .750 · HJ .531 (all ≥ 0.35).
  it('[sign-vector] a different-m seed pair reorganizes ≥35% of the per-band bandField signs (not one field rescaled)', () => {
    const GRID_N = 64;
    const GRID = Array.from({ length: GRID_N }, (_, i) => (-0.5 + (i + 0.5) / GRID_N) * Math.PI);  // poles excluded (no degenerate 0s)
    const signVec = (P) => GRID.map((lat) => Math.sign(jetProfile(lat, P)) || 1);
    const disagree = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d / a.length; };
    for (const regime of ALL_REGIMES) {
      const params = SWEEP_SEEDS.map((s) => derivedParams(regime, s));
      const svs = params.map(signVec);
      let maxDis = -1, sawDiffM = false;
      for (let i = 0; i < params.length; i++) for (let j = i + 1; j < params.length; j++) {
        if (params[i].m !== params[j].m) { sawDiffM = true; maxDis = Math.max(maxDis, disagree(svs[i], svs[j])); }
      }
      expect(sawDiffM).toBe(true);                    // a genuine band-COUNT change exists (frozen-triple has NONE)
      expect(maxDis).toBeGreaterThanOrEqual(0.35);    // and the differing-m pair reorganizes ≥35% of the belt signs
    }
  });
});

// ── AC-LAT — storm latitudes derive per seed (the derived profile moves the shear argmax) ──────────────
describe('giant-drivers AC-LAT (storm placement latitudes)', () => {
  it('[set-size] primary storm latitude set-size ≥ ⌈0.75·N⌉ across the sweep (storm regimes)', () => {
    for (const regime of STORM_REGIMES) {
      const lats = SWEEP_SEEDS.map((s) => resolveStormPlacement(derivedParams(regime, s)).ranked[0].lat);
      expect(setSize(lats)).toBeGreaterThanOrEqual(Math.ceil(0.75 * N));   // = 9
    }
  });

  it('[spread] primary |lat| stdev ≥ 0.035 rad (a real belt-jump, not jitter) — storm regimes', () => {
    // measured |lat| stdev: J 0.065 · S 0.114 · N 0.070 · SubN 0.188 rad (min 0.065 ≫ 0.035 floor).
    for (const regime of STORM_REGIMES) {
      const absLats = SWEEP_SEEDS.map((s) => Math.abs(resolveStormPlacement(derivedParams(regime, s)).ranked[0].lat));
      expect(stdev(absLats)).toBeGreaterThanOrEqual(0.035);
    }
  });

  it('[anti-jitter] the placed primary latitude EQUALS the arm\'s-length resolveStormPlacement argmax', () => {
    // resolveStormE places the primary at the argmax of its OWN returned params; a jittered latitude
    // could not match the pure argmax (AC-WRITER d mold, over the DERIVED profile).
    for (const regime of STORM_REGIMES) {
      for (const s of SWEEP_SEEDS) {
        const d = deriveGiantDriversForSeed(regime, canonicalGiantCondition(regime), s);
        const drivers = { ...d, rotationRate: DRIVER_BUNDLES[regime].rotationRate, radius: DRIVER_BUNDLES[regime].radius, composition: 'h2-he' };
        const rec = resolveStormE(regime, drivers, s, 0);
        if (!rec.primary) continue;                                    // (never for these regimes; HJ excluded)
        const argmaxLat = resolveStormPlacement(rec.params).ranked[0].lat;
        expect(rec.primary.lat).toBe(argmaxLat);
      }
    }
  });
});

// ── Determinism — same seed twice bit-identical; the seed is the only entropy ──────────────────────────
describe('giant-drivers determinism', () => {
  it('same (regime, macroSeed) ⇒ byte-identical triple, twice — every regime × seed', () => {
    for (const regime of ALL_REGIMES) {
      for (const s of SWEEP_SEEDS) {
        const a = JSON.stringify(deriveGiantDriversForSeed(regime, canonicalGiantCondition(regime), s));
        const b = JSON.stringify(deriveGiantDriversForSeed(regime, canonicalGiantCondition(regime), s));
        expect(a).toEqual(b);
      }
    }
  });

  it('the drawn condition itself is byte-stable across two runs of the same seed', () => {
    for (const regime of ALL_REGIMES) {
      for (const s of SWEEP_SEEDS) {
        expect(JSON.stringify(drawGiantConditions(regime, canonicalGiantCondition(regime), s)))
          .toEqual(JSON.stringify(drawGiantConditions(regime, canonicalGiantCondition(regime), s)));
      }
    }
  });

  it('the mass channel is radius-invariant (drawn-vs-fp radius neutralized — slice-R minor-2)', () => {
    // same seed, different base radius ⇒ identical derived triple (mass anchored to M0, radius cancels).
    for (const regime of STORM_REGIMES) {
      const s = SWEEP_SEEDS[3];
      const c1 = { ...canonicalGiantCondition(regime), radiusEarth: 3 };
      const c2 = { ...canonicalGiantCondition(regime), radiusEarth: 12 };
      expect(deriveGiantDrivers(drawGiantConditions(regime, c1, s)))
        .toEqual(deriveGiantDrivers(drawGiantConditions(regime, c2, s)));
    }
  });
});

// ── Static-source guard (climate-e5.test.js CODE mold) ─────────────────────────────────────────────────
describe('giant-drivers static-source guard', () => {
  it('[no wall-clock] no Math.random()/Date.now()/performance.now()/uTime anywhere in the module', () => {
    expect(CODE).not.toMatch(/Math\.random\s*\(/);
    expect(CODE).not.toMatch(/Date\.now\s*\(/);
    expect(CODE).not.toMatch(/performance\.now\s*\(/);
    expect(CODE).not.toMatch(/uTime/);
  });

  // Non-weakening guard EXTENSION (lens fold F6, S1 rotation draw): the whole-module loop widens to
  // accept the giantD: namespace's TWO disjoint streams (cond + rot), and two per-path slice assertions
  // re-pin each stream at FULL strength on its own function body — so a cond-stream call silently renamed
  // `rot:` (or vice-versa) still fails. Intent-preserving: the guard has always pinned "the giantD:
  // namespace". Balanced-brace body extractor (comment-stripped CODE).
  const fnBody = (code, name) => {
    const i = code.indexOf('function ' + name);
    if (i < 0) return '';
    const pOpen = code.indexOf('(', i);   // skip the param list first (paren-balanced) — a `= {}` default
    let pd = 0, j = pOpen;                //   or destructured param brace is NOT the body open
    for (; j < code.length; j++) {
      if (code[j] === '(') pd++;
      else if (code[j] === ')') { pd--; if (pd === 0) { j++; break; } }
    }
    const bOpen = code.indexOf('{', j);
    let bd = 0;
    for (let k = bOpen; k < code.length; k++) {
      if (code[k] === '{') bd++;
      else if (code[k] === '}') { bd--; if (bd === 0) return code.slice(bOpen, k + 1); }
    }
    return code.slice(bOpen);
  };

  it('[namespaced entropy] every alea() call is in the giantD: namespace (cond|rot disjoint streams)', () => {
    const aleas = [...CODE.matchAll(/alea\(([^;]*?)\)/g)];
    expect(aleas.length).toBeGreaterThan(0);
    for (const m of aleas) expect(m[1]).toMatch(/giantD:(cond|rot):/);   // (i) widened loop
  });

  it('[namespaced entropy] the condition-vector draw path keeps its giantD:cond: pin at full strength', () => {
    // (ii) re-pin: slice drawGiantConditions and assert its alea args are STILL exactly giantD:cond:
    const body = fnBody(CODE, 'drawGiantConditions');
    const aleas = [...body.matchAll(/alea\(([^;]*?)\)/g)];
    expect(aleas.length).toBeGreaterThan(0);
    for (const m of aleas) expect(m[1]).toContain('giantD:cond:');
  });

  it('[namespaced entropy] the rotation draw path uses the giantD:rot: stream (disjoint from cond)', () => {
    // (iii) new pin: slice drawRotationHours and assert its alea args are giantD:rot:
    const body = fnBody(CODE, 'drawRotationHours');
    const aleas = [...body.matchAll(/alea\(([^;]*?)\)/g)];
    expect(aleas.length).toBeGreaterThan(0);
    for (const m of aleas) expect(m[1]).toContain('giantD:rot:');
  });
});

// ── AC-0 static driver-connectivity audit (SPINE-CONFORMANCE / BUILD-PLAN §7b-i) ───────────────────────
describe('giant-drivers AC-0 driver connectivity', () => {
  // Every scalar the deriver reads traces to a body-condition-vector slot, a named DERIVE-FORMS anchor,
  // or a declared-frozen scalar with a named deriver. The condition-vector slots (body-condition-vector.js):
  const CONDITION_SLOTS = new Set([
    'density', 'composition', 'age', 'radiusEarth', 'eccentricity', 'T_eq', 'surfaceGravity',
    'atmosphere', 'tidalState', 'rawTidalIoRatio', 'shellThickness', 'magneticField', 'metallicity',
    'regime',   // the E5_REGIME routing tag drawGiantConditions attaches (composition-derived upstream)
  ]);
  const COMPOSITION_FIELDS = new Set(['ironFraction', 'volatileFraction', 'density']);

  it('every condition property read is a body-condition-vector slot (no un-traced scalar, no archetype string)', () => {
    // property reads on the condition object + its `b`/`baseCondition` aliases
    const reads = new Set();
    for (const re of [/\bcondition\.(\w+)/g, /\bbaseCondition\.(\w+)/g, /\bb\.(\w+)/g]) {
      for (const m of CODE.matchAll(re)) reads.add(m[1]);
    }
    for (const field of reads) expect(CONDITION_SLOTS.has(field), `condition.${field} is not a condition-vector slot`).toBe(true);
    expect(reads.size).toBeGreaterThan(0);
    // composition sub-fields the Z proxy reads (comp = condition.composition)
    for (const m of CODE.matchAll(/\bcomp\.(\w+)/g)) expect(COMPOSITION_FIELDS.has(m[1]), `comp.${m[1]} is not a composition field`).toBe(true);
  });

  it('no archetype-string routing (gates stay composition/regime-derived, not preset-name keyed)', () => {
    // the deriver routes on the E5_REGIME enum only — never on a DRIVER_PRESETS preset name
    for (const name of ['Jovian', 'Saturnian', 'Neptunian', 'Sub-Neptune', 'Hot Jupiter', 'Gas giant', 'Ice giant']) {
      expect(CODE).not.toContain(name);
    }
  });

  it('the anchored triple is SOURCED from DRIVER_BUNDLES (single source of truth for the anchor)', () => {
    expect(CODE).toMatch(/DRIVER_BUNDLES\[regime\]/);
    // and each derived channel names its DERIVE-FORMS anchor constant
    expect(CODE).toMatch(/M0/); expect(CODE).toMatch(/AGE0/); expect(CODE).toMatch(/T0/); expect(CODE).toMatch(/Z0/);
  });
});
