// tests/worldengine-e1-conformance-oracle.test.js — World Engine V2-1 AC3 (Slice C).
//
// The SHADOW-mode conformance oracle: over the 15 archetype-mapped presets (Mars + Hot Jupiter EXCLUDED — no
// PRESET_ARCHETYPE mapping), it adjudicates writerUnder(e1) === writerUnder(PRESET_ARCHETYPE), recording the
// two allow-listed divergences AS divergent (never silently matched). It proves E1 tracks today's routing
// closely enough to go live shadow, and names the V2-3 dispositions for the two places it does NOT.
//
//   • writerUnder(PRESET_ARCHETYPE) = classifyWriterPath — composes the FOUR EXPORTED dispatch predicates from
//     planet-lod-rivers.js (isEarthlikePlatePath → isShellReliefPath → isVolcanicPath → isStagnantLidPath →
//     'despun') in writeBodyRelief order. Reuse, NOT re-implement: the archetype-string logic stays in the
//     shipped predicates (which themselves delegate to shellRegimeOf / stagnantLidRegimeOf).
//   • writerUnder(e1) = writerE1 — maps the REAL computeE1 tuple → a writer path via the subtractive gate
//     (BUILD-PLAN §Slice C). In-band rocky bodies are collapsed to their MODAL (argmax-weight, SEED-FREE)
//     regime via the exported modalRegime — the seeded stochastic pick is AC5's domain, not AC3's, so the
//     "13 writer-equal" claim is deterministic. Diagnostic-only: this file wires nothing into dispatch.
//
// The full writer_today / writer_e1 table is EMPIRICALLY PINNED by oracle-preview.mjs (committed beside the
// BUILD-PLAN; run: node docs/WORKSTREAMS/world-engine-v2-1-e1-shadow-2026-07-03/oracle-preview.mjs). This
// oracle MUST reproduce it row-for-row: 13 writer-equal + 2 divergent {Frozen(airless), Eyeball(locked
// temperate)}; Neptunian/Sub-Neptune are writer-EQUAL both ways (a taxonomy NOTE, not a divergence).
import { describe, it, expect } from 'vitest';
import { computeE1, modalRegime } from '../src/worldengine/base/e1Regime.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';

// ── writerUnder(PRESET_ARCHETYPE): PRESET_ARCHETYPE-retirement (2026-07-13) — the classifyWriterPath /
//    writerToday chain (composed from the four now-DELETED dispatch predicates) is retired; writer_today is
//    read straight from the ORACLE_PREVIEW pin below (its `today` column was empirically the archetype-chain
//    writer at build time, from oracle-preview.mjs), asserted against the LIVE shadow writerE1. ──

// ── writerUnder(e1): map the REAL computeE1 tuple → writer path (subtractive gate, §Slice C). The band + icy
//    edge constants below MIRROR e1Regime's module-private values (BUILD-PLAN §4.5); they are re-derived here
//    only to (a) know when to collapse the seeded band to its MODAL pick and (b) read the icy shell edge. The
//    tally is pinned by oracle-preview.mjs — drift in either is caught by the row-for-row assert below. ──
const BAND = { MASS_LO: 0.6, MASS_HI: 1.6, T_LO: 250, T_HI: 320, V_MIN: 0.12 };
function inSeededBand(cv) {
  const g = cv.surfaceGravity ?? 1.0, d = cv.radiusEarth ?? 1.0, mass = g * d * d; // massEarth = g·R² (§4.2)
  const T = cv.T_eq ?? 288, V = cv.composition?.volatileFraction ?? 0.15;
  return mass >= BAND.MASS_LO && mass <= BAND.MASS_HI && T >= BAND.T_LO && T <= BAND.T_HI && V >= BAND.V_MIN;
}
function writerE1(cv) {
  const e1 = computeE1(cv, 1);   // the REAL production tuple (deterministic for every field except the in-band seeded pick)
  const cls = e1.compositionClass;
  if (cls === 'gas' || cls === 'carbon') return 'despun';               // Stage-A composition terminals → off-pilot
  if (cls === 'icy') return e1.geodynamicRegime === 'icy' ? 'shell' : 'despun'; // cryo-active shell vs cold-dead-lid
  // rocky:
  if (e1.m_hp > 0) return 'volcanic';                                   // heat-pipe margin +ve → Io-type (Lava/Magma)
  if (inSeededBand(cv)) {                                               // temperate-wet Earth-mass band → MODAL collapse
    const V = cv.composition?.volatileFraction ?? 0.15, T = cv.T_eq ?? 288;
    return modalRegime(V, T) === 'stagnant' ? 'stagnant-lid' : 'plate'; // mobile/episodic → plate (dominant anchor)
  }
  if (e1.geodynamicRegime === 'stagnant') return 'stagnant-lid';        // out-of-band strong lid (Venus / mixed)
  if (e1.geodynamicRegime === 'mobile') return 'plate';                 // out-of-band low-L broken lid
  return 'despun';                                                       // cold-dead rocky (Mars-type; Mars is oracle-excluded)
}

// computeE1 is fed the REAL condition vector (derived=null → baseStep helper fallbacks; identical to the AC4 harness).
const vec = (name) => { const fp = DRIVER_PRESETS[name]; return deriveConditionVector(fp, null, fp.radiusEarth); };

// The 15 archetype-mapped presets (Object-key order; Mars + Hot Jupiter drop out — not in PRESET_ARCHETYPE).
const NAMES15 = Object.keys(DRIVER_PRESETS).filter((n) => n in PRESET_ARCHETYPE);
// `rows` reads writer_today from the ORACLE_PREVIEW pin (defined below) → relocated after it (avoids the TDZ).

// ── The row-for-row table EMPIRICALLY PINNED by oracle-preview.mjs (the AC3 counterpart to phi-calib.mjs). ──
const ORACLE_PREVIEW = {
  'Rocky (Earthlike)':          { today: 'plate',        e1: 'plate' },
  'Lava (hot airless)':         { today: 'volcanic',     e1: 'volcanic' },
  'Ocean (temperate)':          { today: 'plate',        e1: 'plate' },
  'Titan (methane seas)':       { today: 'shell',        e1: 'shell' },
  'Frozen (airless)':           { today: 'shell',        e1: 'despun' },   // DIVERGENT #1
  'Europa (icy moon)':          { today: 'shell',        e1: 'shell' },
  'Gas giant (Jovian)':         { today: 'despun',       e1: 'despun' },
  'Gas giant (Saturnian)':      { today: 'despun',       e1: 'despun' },
  'Ice giant (Neptunian)':      { today: 'despun',       e1: 'despun' },   // Neptunian/Sub-Neptune collision: EQUAL
  'Venus (sulfuric shroud)':    { today: 'stagnant-lid', e1: 'stagnant-lid' },
  'Sub-Neptune (hazy)':         { today: 'despun',       e1: 'despun' },
  'Eyeball (locked temperate)': { today: 'shell',        e1: 'plate' },    // DIVERGENT #2
  'Magma (K2-141b)':            { today: 'volcanic',     e1: 'volcanic' },
  'Carbon (high C/O)':          { today: 'despun',       e1: 'despun' },
  'Crystal (faceted)':          { today: 'despun',       e1: 'despun' },
};

// ── The two allow-listed divergences, with their V2-3 dispositions NAMED (BUILD-PLAN §4.5 / §4.6). ──
const EXPECTED_DIVERGENCES = {
  'Frozen (airless)': {
    today: 'shell', e1: 'despun',
    disposition: 'V2-3 reroutes off shell to dead-lid — cold-dead icy (T60, no active tidal, below the methane window).',
  },
  'Eyeball (locked temperate)': {
    today: 'shell', e1: 'plate',
    // §4.5 disposition-direction note: today's routing WINS. Eyeball routes to the eyeball-despun SHELL writer
    // purely because it is LOCKED; shadow-E1 has no `locked` input so it cannot see the reason. V2-3 gives
    // dispatch locked-awareness and Eyeball STAYS eyeball-despun byte-identical — E1's plate is NOT adopted.
    disposition: 'Today wins — V2-3 gives dispatch locked-awareness; locked temperate rocky stays eyeball-despun byte-identical.',
  },
};

// writer_today is now PINNED from ORACLE_PREVIEW (the deleted predicate chain's build-time output); writerE1 is
// the LIVE shadow-E1 (unchanged). equal = pinned-today === live-e1 → the 13-equal/2-divergent tally stays real.
const rows = NAMES15.map((name) => {
  const cv = vec(name);
  const today = ORACLE_PREVIEW[name].today, e1path = writerE1(cv);
  return { name, today, e1path, equal: today === e1path, tuple: computeE1(cv, 1) };
});
const row = (name) => rows.find((r) => r.name === name);
const tup = (name) => JSON.stringify(row(name).tuple);   // full e1 tuple for failure messages (AC3: print on divergence)

describe('V2-1 AC3 — conformance oracle: scope', () => {
  it('adjudicates exactly the 15 archetype-mapped presets (Mars + Hot Jupiter excluded)', () => {
    expect(NAMES15.length).toBe(15);
    expect(NAMES15).not.toContain('Mars (arid rocky)');
    expect(NAMES15).not.toContain('Hot Jupiter (locked giant)');
    // the pinned table covers every adjudicated preset and nothing extra (no silent drop / stray row):
    expect([...NAMES15].sort()).toEqual(Object.keys(ORACLE_PREVIEW).sort());
  });
});

describe('V2-1 AC3 — reproduces oracle-preview.mjs row-for-row', () => {
  it('writer_today + writer_e1 match the pinned table for all 15 (failure prints the diverging e1 tuple)', () => {
    for (const r of rows) {
      const exp = ORACLE_PREVIEW[r.name];
      expect(exp, `${r.name}: not in the oracle-preview pin`).toBeDefined();
      expect(r.today, `${r.name} writer_today mismatch — e1 tuple ${tup(r.name)}`).toBe(exp.today);
      expect(r.e1path, `${r.name} writer_e1 mismatch — e1 tuple ${tup(r.name)}`).toBe(exp.e1);
    }
  });
});

describe('V2-1 AC3 — the 13-equal / 2-divergent tally', () => {
  it('exactly 13 writer-equal + 2 divergent; the divergent set is {Eyeball, Frozen}', () => {
    const equal = rows.filter((r) => r.equal);
    const divergent = rows.filter((r) => !r.equal);
    expect(equal.length).toBe(13);
    expect(divergent.length).toBe(2);
    expect(divergent.map((r) => r.name).sort())
      .toEqual(['Eyeball (locked temperate)', 'Frozen (airless)']);
  });

  it('each divergence is asserted AS divergent — pinned today→e1 paths + a NAMED V2-3 disposition', () => {
    for (const r of rows.filter((x) => !x.equal)) {
      const exp = EXPECTED_DIVERGENCES[r.name];
      expect(exp, `unexpected divergence ${r.name} [today ${r.today} → e1 ${r.e1path}] — tuple ${tup(r.name)}`).toBeDefined();
      expect(r.today, r.name).toBe(exp.today);
      expect(r.e1path, r.name).toBe(exp.e1);
      expect(exp.disposition.length, `${r.name} disposition must be named`).toBeGreaterThan(20);
    }
  });

  it('no writer-EQUAL preset is on the divergence allow-list (divergences never silently matched)', () => {
    for (const r of rows.filter((x) => x.equal))
      expect(EXPECTED_DIVERGENCES[r.name], `${r.name} is writer-equal but sits on the allow-list`).toBeUndefined();
  });
});

describe('V2-1 AC3 — the named cases', () => {
  it('Lava / Magma / Venus are writer-equal (the byte-identical trio: volcanic, volcanic, stagnant-lid)', () => {
    for (const name of ['Lava (hot airless)', 'Magma (K2-141b)', 'Venus (sulfuric shroud)']) {
      const r = row(name);
      expect(r.equal, `${name}: today ${r.today} vs e1 ${r.e1path} — tuple ${tup(name)}`).toBe(true);
    }
    expect(row('Lava (hot airless)').today).toBe('volcanic');
    expect(row('Magma (K2-141b)').today).toBe('volcanic');
    expect(row('Venus (sulfuric shroud)').today).toBe('stagnant-lid');
  });

  it('Neptunian / Sub-Neptune key-collision is writer-EQUAL both ways (a taxonomy NOTE, not a divergence)', () => {
    for (const name of ['Ice giant (Neptunian)', 'Sub-Neptune (hazy)']) {
      const r = row(name);
      expect(r.today, name).toBe('despun');
      expect(r.e1path, name).toBe('despun');
      expect(r.equal).toBe(true);
      expect(EXPECTED_DIVERGENCES[name], `${name} must NOT be on the divergence allow-list`).toBeUndefined();
    }
  });

  it('Frozen(airless) DIVERGENT — today shell (icy) → E1 despun (dead-lid); V2-3 reroutes off shell', () => {
    const r = row('Frozen (airless)');
    expect(r.today).toBe('shell');
    expect(r.e1path).toBe('despun');
    expect(r.tuple.compositionClass).toBe('icy');
    expect(r.tuple.geodynamicRegime).toBe('dead-lid');   // cold-dead icy — no active tidal, T60 below the methane window
    expect(EXPECTED_DIVERGENCES['Frozen (airless)'].disposition).toMatch(/dead-lid/);
  });

  it('Eyeball(locked temperate) DIVERGENT — today eyeball-despun shell → E1 plate; today WINS (V2-3 locked-awareness)', () => {
    const r = row('Eyeball (locked temperate)');
    expect(r.today).toBe('shell');
    expect(r.e1path).toBe('plate');
    expect(r.tuple.compositionClass).toBe('rocky');      // rocky LOCKED body — shadow-E1 has no `locked` input, hence no shell path
    // the divergence is SEED-ROBUST: across every seed the seeded pick is a middle regime → plate | stagnant-lid,
    // NEVER the shell writer, so today's shell↔E1 non-shell inequality holds deterministically (the equality claim stays clean).
    const cv = vec('Eyeball (locked temperate)');
    for (const seed of [1, 2, 3, 7, 42, 100, 777]) {
      const t = computeE1(cv, seed);
      expect(t.compositionClass, `seed ${seed}`).toBe('rocky');
      expect(['mobile', 'episodic', 'stagnant'], `seed ${seed} regime ${t.geodynamicRegime}`).toContain(t.geodynamicRegime);
    }
    expect(EXPECTED_DIVERGENCES['Eyeball (locked temperate)'].disposition).toMatch(/eyeball-despun/);
  });
});
