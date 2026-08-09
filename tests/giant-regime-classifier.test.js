// tests/giant-regime-classifier.test.js
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// STEP 4 (docs/FEATURES/one-pipeline-two-frontends-PLAN.md §4), items 1-3: the CONDITION-DERIVED
// giant regime. `giantRegimeOf` replaces a preset-NAME lookup with a nearest-anchor classifier over
// the five canonical rows, so the game can reach the two regimes (saturnian, neptunian) that no game
// `type` expresses without importing lab GUI data.
//
// ⭐ WHAT THIS FILE IS ACTUALLY FOR, because the obvious gate is not enough. The plan's declared gate
// is "anchor round-trip, exact". Measured below: FOUR different metrics pass that round-trip 5/5,
// including a raw-Euclidean one whose density input is DEAD — sweeping bulk density from 0.3 to 5.0
// g/cc at fixed temperature returns ONE regime under it. A gate that a density-blind classifier
// satisfies is not evidence that the classifier reads density. So the round-trip is here, and it is
// followed immediately by the control that shows what it cannot see, and then by the liveness
// assertions that do the work the round-trip is credited with.
//
// ⛔ AND THE ROUND-TRIP IS A **LABEL** ROUND-TRIP, NOT A DENSITY ONE. The plan's phrasing invites a
// density equality against the anchor table. That equality is false on 5/5 rows before any code
// exists — GIANT_ANCHOR's `density0` is the preset's authored composition density, not the
// `5.513·M/R³` bulk the classifier keys on. The MEASURED TABLE block below is the reason this file
// asserts regime identity and explicitly asserts the density equality FAILS.
//
// Sources under test:
//   src/worldengine/base/e1Regime.js:194 `export function giantRegimeOf(cv) {`
//   src/worldengine/base/e1Regime.js:161 `export function giantBulkDensity(cv) {`
//   src/worldengine/base/giant-drivers.js:108 `export const GIANT_ANCHOR = Object.freeze({`
// ═════════════════════════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  giantRegimeOf, giantBulkDensity, EARTH_BULK_DENSITY_GCC, compositionClass,
} from '../src/worldengine/base/e1Regime.js';
import { GIANT_ANCHOR, drawGiantConditions } from '../src/worldengine/base/giant-drivers.js';
import { E5_REGIME } from '../src/worldengine/base/climate-e5.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveConditionVector } from '../body-condition-vector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E1_SRC = readFileSync(path.resolve(__dirname, '../src/worldengine/base/e1Regime.js'), 'utf8');
// Grep CODE, not documentation: the header legitimately NAMES the things the code must not do.
const E1_CODE = E1_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const REGIMES = Object.values(E5_REGIME);

// The lab's preset-name table, transcribed HERE and nowhere in src/ — it is the ORACLE this step
// retires (planet-lod-lab.html:1710 `const E5_PRESET_REGIME = {`), so the classifier has to reproduce
// it from the condition alone. Keeping the last copy in a test is the point of the step.
const PRESET_OF_REGIME = {
  [E5_REGIME.GAS_GIANT]:   'Gas giant (Jovian)',
  [E5_REGIME.SATURNIAN]:   'Gas giant (Saturnian)',
  [E5_REGIME.NEPTUNIAN]:   'Ice giant (Neptunian)',
  [E5_REGIME.SUB_NEPTUNE]: 'Sub-Neptune (hazy)',
  [E5_REGIME.HOT_JUPITER]: 'Hot Jupiter (locked giant)',
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// ⭐ THE MEASURED TABLE — re-measured for this file from driver-presets.js, not copied from the plan.
//
//   regime        R⊕     M⊕      T_eq    bulk = 5.513·M/R³    anchor density0    bulk/density0
//   gas-giant     11.2   317.8   125     1.2471               1.33               0.9376
//   saturnian      9.4    95.2    95     0.6319               0.69               0.9158
//   neptunian      3.9    17.1    55     1.5892               1.64               0.9691
//   sub-neptune    2.7     8.2   550     2.2967               2.20               1.0440
//   hot-jupiter   13.0   400.0  1400     1.0037               1.30               0.7721  ← 22.8% low
//
// Reproduce: node -e on driver-presets.js, `5.513 * p.massEarth / p.radiusEarth ** 3`.
// NOTE the third column of the anchor table is ALSO each preset's `composition.density` verbatim —
// so `density0` is not an approximation of bulk that drifted, it is a DIFFERENT QUANTITY that shares
// a unit. That is why no amount of care in the classifier can make a density equality true.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const MEASURED_BULK = {
  [E5_REGIME.GAS_GIANT]:   1.2471,
  [E5_REGIME.SATURNIAN]:   0.6319,
  [E5_REGIME.NEPTUNIAN]:   1.5892,
  [E5_REGIME.SUB_NEPTUNE]: 2.2967,
  [E5_REGIME.HOT_JUPITER]: 1.0037,
};

/** A condition vector for a regime's own preset, at the preset's OWN radius (the measured table). */
function presetCondition(regime) {
  const p = DRIVER_PRESETS[PRESET_OF_REGIME[regime]];
  return {
    radiusEarth: p.radiusEarth,
    surfaceGravity: p.massEarth / (p.radiusEarth * p.radiusEarth),   // g = M/R² (baseStep's law)
    T_eq: p.T_eq,
    density: p.composition.density,          // present ON PURPOSE: the classifier must not read it
    composition: p.composition,
    age: 4.5,
  };
}

/** A condition whose BULK density is exactly `bulk` g/cc at unit radius. */
const atBulk = (bulk, T_eq) => ({ radiusEarth: 1, surfaceGravity: bulk / EARTH_BULK_DENSITY_GCC, T_eq });

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('Step 4 · GIANT_ANCHOR is exported and is the classifier\'s only regime source', () => {
  it('exports the five canonical rows, keyed by the E5_REGIME values', () => {
    expect(Object.keys(GIANT_ANCHOR)).toEqual(REGIMES);
    expect(Object.isFrozen(GIANT_ANCHOR)).toBe(true);
    for (const r of REGIMES) {
      expect(typeof GIANT_ANCHOR[r].density0, r).toBe('number');
      expect(typeof GIANT_ANCHOR[r].T0, r).toBe('number');
    }
  });

  it('e1Regime.js declares NO regime string literal — the five names come from the table', () => {
    // The coupling this step removes is a second copy of the regime table. If any of the five names
    // is spelled in e1Regime.js CODE, the copy is back and this file's oracle is circular.
    for (const r of REGIMES) expect(E1_CODE.includes(`'${r}'`), r).toBe(false);
    expect(E1_CODE).toMatch(/import\s*\{\s*GIANT_ANCHOR\s*\}\s*from\s*'\.\/giant-drivers\.js'/);
  });

  it('the classifier never reads condition.density (it computes bulk from gravity and radius)', () => {
    // Direct, not by inspection: changing ONLY `density` cannot change the answer.
    for (const r of REGIMES) {
      const c = presetCondition(r);
      const lied = { ...c, density: 99, composition: { ...c.composition, density: 99 } };
      expect(giantRegimeOf(lied), r).toBe(giantRegimeOf(c));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('Step 4 · the measured bulk table, and why the round-trip is a LABEL round-trip', () => {
  it('bulk density is 5.513·M/R³ and reproduces the measured table to 4 dp', () => {
    for (const r of REGIMES) {
      expect(giantBulkDensity(presetCondition(r)), r).toBeCloseTo(MEASURED_BULK[r], 4);
    }
  });

  it('⛔ bulk does NOT equal the anchor density0 on ANY of the five rows', () => {
    // Asserted as a FAILURE, deliberately. "Anchor round-trip, EXACT" cannot mean a density equality;
    // this is the evidence, standing in the test file so the next reader does not re-derive it.
    for (const r of REGIMES) {
      const bulk = giantBulkDensity(presetCondition(r));
      const d0 = GIANT_ANCHOR[r].density0;
      expect(Math.abs(bulk - d0), `${r} bulk ${bulk} vs density0 ${d0}`).toBeGreaterThan(1e-3);
    }
    // and the worst row is hot-jupiter, 22.8% low — pinned so a future anchor edit that "fixes" the
    // table has to come past this line rather than silently making the comment above wrong.
    const hj = giantBulkDensity(presetCondition(E5_REGIME.HOT_JUPITER));
    expect(hj / GIANT_ANCHOR[E5_REGIME.HOT_JUPITER].density0).toBeCloseTo(0.7721, 4);
  });

  it('LABEL round-trip: every preset classifies back to its own regime, at its own radius', () => {
    for (const r of REGIMES) expect(giantRegimeOf(presetCondition(r)), r).toBe(r);
  });

  it('the degenerate anchor point (bulk set EQUAL to density0) also round-trips — and is weak', () => {
    // A body placed exactly ON an anchor must return that anchor. True of any nearest-anchor metric,
    // which is precisely why it is labelled weak here instead of being counted as the gate.
    for (const r of REGIMES) {
      expect(giantRegimeOf(atBulk(GIANT_ANCHOR[r].density0, GIANT_ANCHOR[r].T0)), r).toBe(r);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('Step 4 · ⭐ THE CONTROL — a density-blind classifier passes the round-trip too', () => {
  // Raw-Euclidean nearest anchor on (density, T_eq): the metric the plan's wording most naturally
  // suggests. T0 spans 55-1400 while density0 spans 0.69-2.20, so the temperature term outweighs the
  // density term by ~900× and the density column is decoration.
  function rawEuclideanRegimeOf(cv) {
    const bulk = giantBulkDensity(cv), T = cv.T_eq ?? 288;
    let best = null, bestD2 = Infinity;
    for (const key of Object.keys(GIANT_ANCHOR)) {
      const a = GIANT_ANCHOR[key];
      const d2 = (bulk - a.density0) ** 2 + (T - a.T0) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = key; }
    }
    return best;
  }

  it('it passes the anchor round-trip 5/5 — the gate cannot tell it from the shipped one', () => {
    for (const r of REGIMES) expect(rawEuclideanRegimeOf(presetCondition(r)), r).toBe(r);
  });

  it('…and it is DEAD in density: one regime across a 0.3 → 5.0 g/cc sweep at 300 K', () => {
    const sweep = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.5, 3.5, 5.0];
    const labels = new Set(sweep.map((d) => rawEuclideanRegimeOf(atBulk(d, 300))));
    expect(labels.size, [...labels].join(',')).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('Step 4 · both inputs are LIVE (this is the assertion the round-trip is credited with)', () => {
  it('bulk density moves the regime: 3 distinct regimes over 0.3 → 5.0 g/cc at 300 K', () => {
    const sweep = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.5, 3.5, 5.0];
    const labels = sweep.map((d) => giantRegimeOf(atBulk(d, 300)));
    // measured: saturnian ×3 → gas-giant ×2 → sub-neptune ×5, monotone in density
    expect(new Set(labels).size, labels.join(',')).toBe(3);
    expect(labels[0]).toBe(E5_REGIME.SATURNIAN);
    expect(labels[labels.length - 1]).toBe(E5_REGIME.SUB_NEPTUNE);
  });

  it('T_eq moves the regime: 4 distinct regimes over 60 → 2000 K at 1.5 g/cc', () => {
    const sweep = [60, 100, 200, 400, 700, 1200, 2000];
    const labels = sweep.map((T) => giantRegimeOf(atBulk(1.5, T)));
    // measured: neptunian → gas-giant ×2 → sub-neptune → hot-jupiter ×3
    expect(new Set(labels).size, labels.join(',')).toBe(4);
    expect(labels[0]).toBe(E5_REGIME.NEPTUNIAN);
    expect(labels[labels.length - 1]).toBe(E5_REGIME.HOT_JUPITER);
  });

  it('every one of the five regimes is reachable from some (bulk, T_eq) — none is dead code', () => {
    const reached = new Set();
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 40; j++) {
        reached.add(giantRegimeOf(atBulk(0.3 + i * 0.12, 40 + j * 60)));
      }
    }
    expect([...reached].sort()).toEqual([...REGIMES].sort());
  });

  it('the round-trip margin is at least 3× on every row (nothing sits on a boundary)', () => {
    // second-nearest / nearest, in the same normalized log space the classifier uses.
    const ld = REGIMES.map((r) => Math.log(GIANT_ANCHOR[r].density0));
    const lt = REGIMES.map((r) => Math.log(GIANT_ANCHOR[r].T0));
    const d0 = Math.min(...ld), t0 = Math.min(...lt);
    const dS = Math.max(...ld) - d0, tS = Math.max(...lt) - t0;
    for (const r of REGIMES) {
      const c = presetCondition(r);
      const pd = (Math.log(giantBulkDensity(c)) - d0) / dS, pt = (Math.log(c.T_eq) - t0) / tS;
      const dists = REGIMES.map((k) => Math.hypot(
        pd - (Math.log(GIANT_ANCHOR[k].density0) - d0) / dS,
        pt - (Math.log(GIANT_ANCHOR[k].T0) - t0) / tS,
      )).sort((a, b) => a - b);
      expect(dists[1] / dists[0], `${r} margin`).toBeGreaterThan(3.0);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('Step 4 item 3 · ORDER — classify the UN-PERTURBED condition', () => {
  // src/worldengine/base/giant-drivers.js:240 `const density = baseDensity * densFactor;` is the third
  // of three overwrites in `drawGiantConditions`; `surfaceGravity` and `T_eq` are the other two, and
  // those two are exactly what giantRegimeOf reads. Asserted DIRECTLY, three ways: the fields move,
  // the LABEL moves on a named seed, and the pinned sweep would not have caught it.

  it('drawGiantConditions rewrites all three fields the classifier can see', () => {
    for (const r of REGIMES) {
      const base = presetCondition(r);
      const drawn = drawGiantConditions(r, base, 0);
      expect(drawn.surfaceGravity, r).not.toBe(base.surfaceGravity);
      expect(drawn.T_eq, r).not.toBe(base.T_eq);
      expect(drawn.density, r).not.toBe(base.density);
    }
  });

  it('⭐ NON-VACUOUS: gas-giant at macroSeed 0 classifies gas-giant BEFORE the draw, saturnian AFTER', () => {
    const base = presetCondition(E5_REGIME.GAS_GIANT);
    const drawn = drawGiantConditions(E5_REGIME.GAS_GIANT, base, 0);
    expect(giantRegimeOf(base)).toBe(E5_REGIME.GAS_GIANT);
    expect(giantRegimeOf(drawn)).toBe(E5_REGIME.SATURNIAN);
    // the mechanism, pinned: a −27% mass draw carries bulk 1.2471 → 0.9088, across the midpoint
    // between the gas-giant (1.33) and saturnian (0.69) anchors.
    expect(giantBulkDensity(base)).toBeCloseTo(1.2471, 4);
    expect(giantBulkDensity(drawn)).toBeCloseTo(0.9088, 4);
  });

  it('the flip rate is 3.1% (63/2000) over regimes × seeds 0-399 — small, and not zero', () => {
    let flips = 0, total = 0;
    for (const r of REGIMES) {
      const base = presetCondition(r), pre = giantRegimeOf(base);
      for (let s = 0; s < 400; s++) { total++; if (giantRegimeOf(drawGiantConditions(r, base, s)) !== pre) flips++; }
    }
    expect(total).toBe(2000);
    expect(flips).toBe(63);
  });

  it('⛔ and the 12 pinned SWEEP_SEEDS flip 0/12 — an ordering gate written over them is VACUOUS', () => {
    // Recorded so nobody "simplifies" the seed-0 assertion above into the module's existing sweep.
    const SWEEP = [1, 7, 13, 23, 42, 101, 256, 777, 1234, 2718, 3141, 9999];
    for (const r of REGIMES) {
      const base = presetCondition(r), pre = giantRegimeOf(base);
      const flips = SWEEP.filter((s) => giantRegimeOf(drawGiantConditions(r, base, s)) !== pre).length;
      expect(flips, r).toBe(0);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('Step 4 · bulk density is a body property, not a render property', () => {
  it('the drawn radius does not move bulk on a gas body — bit-identical at 5, 11.2 and 20 R⊕', () => {
    // body-condition-vector.js:87 `if (compClass !== 'rocky') return radiusEarth / canonicalRadiusEarth;`
    // — the NON-ROCKY branch, which keeps the RETIRED constant-density exponent of 1 as declared status
    // quo. ⛔ This is NOT the rocky law and must not be read as one; a rocky body self-compresses.
    // On the non-rocky branch g = g_c·(R/R_c) ⇒ M ∝ R³ ⇒ 5.513·M/R³ cancels the drawn radius exactly.
    // This is WHY giantBulkDensity reads the drawn radius rather than radiusEarthCanonical: the pair
    // has to be consistent, and mixing the drawn gravity with the canonical radius would not cancel.
    const fp = DRIVER_PRESETS['Gas giant (Jovian)'];
    const at = (R) => deriveConditionVector(fp, undefined, R);
    expect(compositionClass(at(11.2))).toBe('gas');
    const ref = giantBulkDensity(at(11.2));
    expect(giantBulkDensity(at(5))).toBe(ref);
    expect(giantBulkDensity(at(20))).toBe(ref);
    expect(ref).toBeCloseTo(1.2471, 4);
    for (const R of [5, 11.2, 20]) expect(giantRegimeOf(at(R)), `R=${R}`).toBe(E5_REGIME.GAS_GIANT);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('Step 4 · totality, determinism, purity', () => {
  it('always returns one of the five keys — including for degenerate and missing input', () => {
    const junk = [undefined, null, {}, { radiusEarth: 0 }, { surfaceGravity: -5, radiusEarth: 1, T_eq: -100 },
      { T_eq: NaN }, { radiusEarth: Infinity }, { surfaceGravity: NaN, radiusEarth: 2, T_eq: 300 }];
    for (const c of junk) expect(REGIMES, JSON.stringify(c)).toContain(giantRegimeOf(c));
  });

  it('degenerate input returns the FIRST anchor row, matching giant-drivers\' own missing-regime fallback', () => {
    // src/worldengine/base/giant-drivers.js:168 `const regime = condition.regime || E5_REGIME.GAS_GIANT;`
    for (const c of [{ radiusEarth: 0 }, { T_eq: NaN }, { surfaceGravity: -5, radiusEarth: 1, T_eq: 300 }]) {
      expect(giantRegimeOf(c), JSON.stringify(c)).toBe(Object.keys(GIANT_ANCHOR)[0]);
    }
  });

  it('same condition in, same regime out; no Math.random / Date.now in the module CODE', () => {
    for (const r of REGIMES) {
      const c = presetCondition(r);
      expect(giantRegimeOf(c)).toBe(giantRegimeOf({ ...c }));
    }
    expect(E1_CODE.includes('Math.random')).toBe(false);
    expect(E1_CODE.includes('Date.now')).toBe(false);
  });

  it('does not mutate the condition it is handed', () => {
    const c = presetCondition(E5_REGIME.NEPTUNIAN);
    const before = JSON.stringify(c);
    giantRegimeOf(c);
    expect(JSON.stringify(c)).toBe(before);
  });
});
