// tests/worldengine-lid-classifier.test.js — World Engine V2-2a Slice A.
//
// AC-CONFORMANCE-FINE + AC-SUBTRACTIVE-GATE for the pure, LABEL-FREE lid-response classifier
// (src/worldengine/base/lidResponse.js). Mirrors the V2-1 conformance-oracle idiom: feed computeE1 the
// REAL preset condition vectors (deriveConditionVector → computeE1) and adjudicate the classifier over the
// 15 archetype-mapped presets × seeds {1,2,3,7,42}, plus hand-set boundary vectors that pin the cuts.
//
//   • AC-CONFORMANCE-FINE — classifyLidPath: {Lava,Magma}=pure-weak, Venus=pure-strong. V2-2b-2b threaded the
//     L-cuts to read `effectiveL ?? L` (R-wetstag), so an in-band Rocky/Ocean/Eyeball whose seeded regime pick
//     lands on 'stagnant' carries effectiveL ∈ [0.60,0.6275] and now routes 'mixed' on THOSE seeds (was
//     off-pilot) — a DELIBERATE seed-DEPENDENCE (§4 R2-R5). A body WITHOUT effectiveL still classifies
//     seed-INDEPENDENTLY on raw L. Hand-set boundary vectors (no effectiveL) pin the L_STRONG / SHOULDER_LO /
//     m_hp-first defaults; margin asserts print the full e1 tuple.
//   • AC-SUBTRACTIVE-GATE — isUnbrokenLidPath true ONLY for {heat-pipe, hot-surface-stagnant} rocky; false
//     for Mars (dead-lid) + every despun rocky (L-guard) + the authored exotics (label carve-out). The two
//     despun destinations (locked→shell eyeball-despun, unlocked→despun) are asserted via the SHIPPED
//     dispatch predicates as the reference, NOT re-implemented.
import { describe, it, expect } from 'vitest';
import { classifyLidPath, isUnbrokenLidPath } from '../src/worldengine/base/lidResponse.js';
import { computeE1, L_STRONG, SHOULDER_LO } from '../src/worldengine/base/e1Regime.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
// PRESET_ARCHETYPE-retirement (2026-07-13): the four label-keyed dispatch predicates are DELETED; the
// "two despun destinations distinct" assert re-anchors to the SURVIVING shellRegimeOf resolver (the
// writer-module export the bridge locked-fallback itself used).
import { shellRegimeOf } from '../src/worldengine/base/shellRelief.js';

const SEEDS = [1, 2, 3, 7, 42];

// The V2-1 oracle path: derive each preset's REAL condition vector (derived=null → baseStep helper
// fallbacks, identical to the AC3/AC4 harness), then computeE1 gives the production tuple.
const cvOf = (name) => { const fp = DRIVER_PRESETS[name]; return deriveConditionVector(fp, null, fp.radiusEarth); };
const e1Of = (name, seed) => computeE1(cvOf(name), seed);
const rawTidalOf = (name) => cvOf(name).rawTidalIoRatio;
const tup = (e1) => JSON.stringify(e1);   // full tuple for failure messages

// Minimal hand-set e1 tuple: only the fields the classifier reads, with off-pilot-safe defaults.
const e1t = (over) => ({ compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.0, ...over });

// ── The 15 archetype-mapped presets → expected FINE class (ground-truthed via computeE1 at 83a62a1). ──
const EXPECTED_FINE = {
  'Rocky (Earthlike)': 'off-pilot',
  'Lava (hot airless)': 'pure-weak',
  'Ocean (temperate)': 'off-pilot',
  'Titan (methane seas)': 'off-pilot',
  'Frozen (airless)': 'off-pilot',
  'Europa (icy moon)': 'off-pilot',           // icy + huge m_hp, but compositionClass fires first → off-pilot (a shell, not heat-pipe)
  'Gas giant (Jovian)': 'off-pilot',          // L 0.665 ≥ L_STRONG, but cls 'gas' fires first → off-pilot
  'Gas giant (Saturnian)': 'off-pilot',
  'Ice giant (Neptunian)': 'off-pilot',
  'Venus (sulfuric shroud)': 'pure-strong',
  'Sub-Neptune (hazy)': 'off-pilot',
  'Eyeball (locked temperate)': 'off-pilot',
  'Magma (K2-141b)': 'pure-weak',
  'Carbon (high C/O)': 'off-pilot',
  'Crystal (faceted)': 'off-pilot',
};

describe('V2-2a AC-CONFORMANCE-FINE — the classifier pins its defaults (single source of truth)', () => {
  it('imports L_STRONG=0.63 and SHOULDER_LO=0.15 from e1Regime.js (the current pinned defaults)', () => {
    expect(L_STRONG).toBe(0.63);
    expect(SHOULDER_LO).toBe(0.15);
  });

  it('the expected-FINE map covers exactly the 15 archetype-mapped presets (no drift vs PRESET_ARCHETYPE)', () => {
    expect(Object.keys(EXPECTED_FINE).sort()).toEqual(Object.keys(PRESET_ARCHETYPE).sort());
  });
});

describe('V2-2b-2b AC-CONFORMANCE-FINE (§4 R2-R5) — 15 presets classify {weak,strong,off-pilot}, WET in-band picks → mixed', () => {
  // §4 R2/R3: the L-cuts read `effectiveL ?? L`, so an in-band Rocky/Ocean/Eyeball whose seeded pick is
  // 'stagnant' emits effectiveL ∈ [0.60,0.6275] and routes 'mixed' on THOSE seeds. The expectation is now the
  // per-(name,seed) SPLIT: where computeE1 emits effectiveL → 'mixed', else the seed-independent baseline. The
  // blanket `not.toBe('mixed')` is dropped for the in-band presets (they legitimately route mixed by design).
  for (const [name, baseline] of Object.entries(EXPECTED_FINE)) {
    it(`${name} → ${baseline} (or 'mixed' on a WET seeded-'stagnant' seed), across ${SEEDS.length} seeds`, () => {
      const rawTidal = rawTidalOf(name);
      for (const seed of SEEDS) {
        const e1 = e1Of(name, seed);
        const got = classifyLidPath(e1, rawTidal);
        const want = e1.effectiveL !== undefined ? 'mixed' : baseline;   // §4 R3: seed-split expectation
        expect(got, `${name} seed ${seed}: got '${got}', want '${want}' — e1 ${tup(e1)}`).toBe(want);
      }
    });
  }

  it('the seed-1 tally: {Lava,Magma}=pure-weak, Venus=pure-strong, WET in-band picks=mixed, rest=off-pilot (§4 R4)', () => {
    const tally = { 'pure-weak': [], 'pure-strong': [], 'mixed': [], 'off-pilot': [] };
    for (const name of Object.keys(PRESET_ARCHETYPE)) tally[classifyLidPath(e1Of(name, 1), rawTidalOf(name))].push(name);
    // §4 R4: 'mixed' contains EXACTLY the in-band presets whose seed-1 pick is 'stagnant' (emits effectiveL).
    const inBandStagnantSeed1 = ['Rocky (Earthlike)', 'Ocean (temperate)', 'Eyeball (locked temperate)']
      .filter((name) => e1Of(name, 1).effectiveL !== undefined);
    expect(tally['pure-weak'].sort()).toEqual(['Lava (hot airless)', 'Magma (K2-141b)']);
    expect(tally['pure-strong']).toEqual(['Venus (sulfuric shroud)']);
    expect(tally['mixed'].sort()).toEqual(inBandStagnantSeed1.sort());   // seed 1 → all three in-band presets pick stagnant
    expect(tally['off-pilot'].length).toBe(12 - inBandStagnantSeed1.length);
  });
});

describe('V2-2b-2b AC-CONFORMANCE-FINE (§4 R5) — SEED-DEPENDENCE by design: WET in-band picks flip off-pilot→mixed', () => {
  // §4 R5: the R-A2 seed-INDEPENDENCE is DELIBERATELY flipped for WET in-band bodies (the increment's whole
  // point). Rocky/Ocean/Eyeball draw a seeded mobile/episodic/STAGNANT pick per seed; on a seed where the pick
  // is 'stagnant', computeE1 emits effectiveL ∈ [0.60,0.6275] → 'mixed'; on every other seed → 'off-pilot'.
  // (The subtractive gate isUnbrokenLidPath still reads RAW L — asserted separately below — so this flip never
  // reaches the Venus pilot.)
  for (const name of ['Rocky (Earthlike)', 'Ocean (temperate)', 'Eyeball (locked temperate)']) {
    it(`${name}: class is 'mixed' exactly on the effectiveL seeds, 'off-pilot' otherwise (the deliberate flip)`, () => {
      const regimes = new Set(SEEDS.map((s) => e1Of(name, s).geodynamicRegime));
      // sanity: the seeded pick genuinely varies (else this would not exercise the seed-split)
      expect(regimes.size, `${name} seeded regime did not vary across seeds`).toBeGreaterThan(1);
      for (const s of SEEDS) {
        const e1 = e1Of(name, s);
        const got = classifyLidPath(e1, rawTidalOf(name));
        const want = e1.effectiveL !== undefined ? 'mixed' : 'off-pilot';
        expect(got, `${name} seed ${s}: got '${got}', want '${want}' — e1 ${tup(e1)}`).toBe(want);
      }
    });
  }

  it('the deliberate flip is REAL: at least one in-band (preset, seed) routes \'mixed\' via effectiveL', () => {
    let anyMixed = false;
    for (const name of ['Rocky (Earthlike)', 'Ocean (temperate)', 'Eyeball (locked temperate)']) {
      for (const s of SEEDS) if (classifyLidPath(e1Of(name, s), rawTidalOf(name)) === 'mixed') anyMixed = true;
    }
    expect(anyMixed, 'no in-band preset flipped to mixed — the effectiveL thread is inert').toBe(true);
  });
});

describe('V2-2a AC-CONFORMANCE-FINE — hand-set boundary vectors pin the cuts (L_STRONG / SHOULDER_LO / m_hp-first)', () => {
  it('the L_STRONG cut: (L 0.64, rawTidal 0) → pure-strong; (L 0.62, rawTidal 0) → mixed', () => {
    expect(classifyLidPath(e1t({ L: 0.64 }), 0)).toBe('pure-strong');   // just ABOVE L_STRONG(0.63), tidally quiet
    expect(classifyLidPath(e1t({ L: 0.62 }), 0)).toBe('mixed');          // just BELOW L_STRONG → mixed interior
  });

  it('the tidal-shoulder rule (PG-5): (L 0.70, rawTidal 0.20 ≥ SHOULDER_LO) → mixed, NOT pure-strong', () => {
    expect(classifyLidPath(e1t({ L: 0.70 }), 0.20)).toBe('mixed');       // strong-L but tidally warming → mixed (no m_hp cliff)
    expect(classifyLidPath(e1t({ L: 0.70 }), 0.14)).toBe('pure-strong'); // same L, just below the shoulder → pure-strong
  });

  it('m_hp fires BEFORE L: a high-L high-m_hp vector → pure-weak (not pure-strong)', () => {
    expect(classifyLidPath(e1t({ m_hp: 1, L: 0.99 }), 0)).toBe('pure-weak');
  });

  it('the mixed interior floor (MIXED_LO 0.35): a Mars-like mid-axis vector (L 0.551) → mixed; L 0.30 → off-pilot', () => {
    // grounding Q4(b): a hand-set mid-axis vector MUST classify mixed — this locks the V2-2b seam.
    expect(classifyLidPath(e1t({ L: 0.551 }), 0)).toBe('mixed');
    expect(classifyLidPath(e1t({ L: 0.30 }), 0)).toBe('off-pilot');      // below MIXED_LO → mobile/broken-lid
  });
});

describe('V2-2a AC-CONFORMANCE-FINE — margin asserts (the pinned corners sit well inside their bands)', () => {
  it('Lava/Magma sit deep in pure-weak (m_hp huge); Venus is +~0.10 above L_STRONG; Mars is −~0.08 below', () => {
    const lava = e1Of('Lava (hot airless)', 1), magma = e1Of('Magma (K2-141b)', 1);
    expect(lava.m_hp, `Lava m_hp ${lava.m_hp} — ${tup(lava)}`).toBeGreaterThan(1e5);
    expect(magma.m_hp, `Magma m_hp ${magma.m_hp} — ${tup(magma)}`).toBeGreaterThan(1e7);

    const venus = e1Of('Venus (sulfuric shroud)', 1);
    expect(venus.L - L_STRONG, `Venus L margin — ${tup(venus)}`).toBeGreaterThan(0.09);   // ≈ +0.10

    // Mars is oracle-excluded (not in PRESET_ARCHETYPE) but present in DRIVER_PRESETS — its real tuple is
    // the canonical mixed / dead-lid reference (cls rocky, dead-lid, L ~0.551, Φ ~0.268).
    const mars = computeE1(cvOf('Mars (arid rocky)'), 1);
    const marsMargin = mars.L - L_STRONG;
    expect(marsMargin, `Mars L margin — ${tup(mars)}`).toBeLessThan(-0.07);
    expect(marsMargin, `Mars L margin — ${tup(mars)}`).toBeGreaterThan(-0.09);            // ≈ −0.08 (comfortably not pure-strong)
    expect(classifyLidPath(mars, cvOf('Mars (arid rocky)').rawTidalIoRatio), `Mars classifies mixed — ${tup(mars)}`).toBe('mixed');
  });
});

describe('V2-2a AC-SUBTRACTIVE-GATE — isUnbrokenLidPath true ONLY for heat-pipe / hot-surface-stagnant rocky', () => {
  it('Lava + Magma (heat-pipe) and Venus (hot-surface-stagnant) → true, on every seed', () => {
    for (const seed of SEEDS) {
      for (const name of ['Lava (hot airless)', 'Magma (K2-141b)', 'Venus (sulfuric shroud)']) {
        const e1 = e1Of(name, seed);
        expect(isUnbrokenLidPath(e1), `${name} seed ${seed} — ${tup(e1)}`).toBe(true);
      }
    }
  });

  it('Mars (dead-lid, L ~0.551) → false — neither heat-pipe nor hot-surface-stagnant', () => {
    const mars = computeE1(cvOf('Mars (arid rocky)'), 1);
    expect(mars.compositionClass).toBe('rocky');
    expect(mars.geodynamicRegime).toBe('dead-lid');
    expect(isUnbrokenLidPath(mars), `Mars — ${tup(mars)}`).toBe(false);
  });

  it('every despun rocky (Rocky/Earthlike, Eyeball) → false on EVERY seed (the L-guard holds)', () => {
    for (const name of ['Rocky (Earthlike)', 'Eyeball (locked temperate)']) {
      for (const seed of SEEDS) {
        const e1 = e1Of(name, seed);
        expect(isUnbrokenLidPath(e1), `${name} seed ${seed} — ${tup(e1)}`).toBe(false);
      }
    }
  });

  it('the L-guard keeps the two stagnant kinds apart: a seeded-band Earth that picks regime=stagnant stays false', () => {
    // Rocky (Earthlike) at seed 1 draws geodynamicRegime='stagnant' — but its L (~0.25) is far below
    // L_STRONG, so hotSurfaceStagnant is false and it stays OFF the pilot (never conflated with Venus).
    const e1 = e1Of('Rocky (Earthlike)', 1);
    expect(e1.geodynamicRegime, `expected the seed-1 pick to be stagnant — ${tup(e1)}`).toBe('stagnant');
    expect(e1.L).toBeLessThan(L_STRONG);
    expect(isUnbrokenLidPath(e1), `low-L seeded-stagnant Earth must stay off the pilot — ${tup(e1)}`).toBe(false);
  });

  it('authored exotics are carved out by class: crystal / technogenic / real Crystal preset → false', () => {
    expect(isUnbrokenLidPath(e1t({ compositionClass: 'crystal', m_hp: 1, L: 0.9 }))).toBe(false);       // even with heat-pipe-like scalars
    expect(isUnbrokenLidPath(e1t({ compositionClass: 'technogenic', geodynamicRegime: 'stagnant', L: 0.9 }))).toBe(false);
    const crystal = e1Of('Crystal (faceted)', 1);
    expect(crystal.compositionClass, `Crystal falls to its density class (icy) — ${tup(crystal)}`).not.toBe('rocky');
    expect(isUnbrokenLidPath(crystal), `Crystal — ${tup(crystal)}`).toBe(false);
  });
});

describe('V2-2a AC-SUBTRACTIVE-GATE — the two despun destinations resolve distinctly (surviving shellRegimeOf resolver)', () => {
  // (PRESET_ARCHETYPE-retirement) re-anchored to the SURVIVING shellRegimeOf resolver (writer-module export)
  // instead of the deleted predicate chain: it IS the resolver the bridge locked-fallback used, so the "distinct
  // destinations" claim is asserted at the real source, not a re-implemented archetype chain.

  it('a despun rocky that falls off the pilot lands distinctly by lock state: locked→shell eyeball-despun, unlocked→despun', () => {
    expect(shellRegimeOf(null, true)).toBe('eyeball-despun');   // locked → the shell locked-fallback destination
    expect(shellRegimeOf(null, false)).toBe(null);              // unlocked → no shell regime → final zonal despun
    // real Mars is UNLOCKED and archetype-unmapped → final despun (§5.1 note; Mars not in PRESET_ARCHETYPE)
    expect(PRESET_ARCHETYPE['Mars (arid rocky)']).toBeUndefined();
    // the two destinations are genuinely DISTINCT
    expect(shellRegimeOf(null, true)).not.toBe(shellRegimeOf(null, false));
  });
});
