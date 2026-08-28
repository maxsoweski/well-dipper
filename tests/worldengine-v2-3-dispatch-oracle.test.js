// tests/worldengine-v2-3-dispatch-oracle.test.js — World Engine V2-3 THE DISPATCH FLIP
// (AC-ORACLE-17 / AC-FLIP-LABEL-FREE / AC-0 check 1).
//
// The POST-flip 18-preset adjudication oracle — the retirement evidence for the follow-up PRESET_ARCHETYPE
// deletion. Over ALL 18 DRIVER_PRESETS (Mars + Hot Jupiter + V2-5 Moon/Mercury adjudicated — they have no
// PRESET_ARCHETYPE entry, so they join as archetype=null rows):
//
//   • writer_today   = classifyWriterPath(PRESET_ARCHETYPE[name] ?? null, locked) — the FOUR exported legacy
//                      dispatch predicates composed in bridge-chain order (reuse, not re-implement; identical
//                      to the V2-1 oracle's writerToday).
//   • writer_derived = the REAL flipped writeBodyRelief run on a fresh carrier with a condition-BEARING
//                      bundle (the production construction: buildNeutralBodyDrivers + deriveConditionVector)
//                      — the ACTUAL dispatch, not a re-derivation.
//
// Asserts the BUILD-PLAN §0 empirically-verified adjudication table row-for-row: 16 writer-IDENTICAL + exactly
// TWO adjudicated reroutes {Frozen (airless), Hot Jupiter (locked giant)}, both shell→despun, each with a NAMED
// disposition (never silently matched). Plus:
//   • SEED-INVARIANCE (AC-FLIP): across seeds {1,2,3,7,42,100,777} no preset's derived writer choice changes —
//     the in-band modal collapse (designDecision #1) sources V/T from the CONDITION VECTOR (RT2), never the
//     seeded e1.geodynamicRegime.
//   • Europa ≠ Titan shell sub-regimes (contract lens MF-2: 'icy-active' ≠ 'volatile-cold', distinct
//     REGIME_WEIGHTS → distinct bytes).
//   • RT1 pin: every rule-(3c) body (rocky, no heat-pipe, unlocked, isUnbrokenLidPath) classifies PURE-STRONG
//     via classifyLidPath — never mixed/off-pilot (the latent (3c)/classifyLidPath coupling: isUnbrokenLidPath's
//     hotSurfaceStagnant gate ignores rawTidal; classifyLidPath's pure-strong cut requires rawTidal<SHOULDER_LO;
//     they agree only because computeE1 data-places 'stagnant' at L>=L_STRONG solely via that same cut).
//   • GARBLE (AC-FLIP): garbling every PRESET_ARCHETYPE entry changes NO condition-bearing route (R-GARBLE:
//     the map legitimately stays load-bearing ONLY for radius selection — drawPresetRadius is exempt).
//   • AC-0 check 1 grep: the condition-bearing routing region of writeBodyRelief (function-body slice, NOT the
//     whole file — the else-bridge legitimately still reads the archetype chain) reads no PRESET_ARCHETYPE /
//     e1 label / stagnantLidRegimeOf( / isVolcanicPath(. After the shadow-audit repurposing removed rivers.js
//     from its blind list, THIS grep is the SOLE label-freeness guard on the new dispatch (RG3).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
import { computeE1 } from '../src/worldengine/base/e1Regime.js';
import { classifyLidPath, isUnbrokenLidPath } from '../src/worldengine/base/lidResponse.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { TARGET_N, LLOYD, QUALITY_TIER } from './fixtures/v2-0-carrier-golden.mjs';

const SEEDS = [1, 2, 3, 7, 42, 100, 777];   // the AC-FLIP seed-invariance set
const NAMES17 = Object.keys(DRIVER_PRESETS);

// ONE deterministic mesh, reused (routing never depends on carrier bytes; each run gets a FRESH field).
const MESH = buildIrregularSphere(TARGET_N, LLOYD);

// The production-shaped condition-BEARING bundle (mirrors tests/fixtures/v2-0-carrier-golden.mjs buildBundle,
// widened to archetype-less presets via `?? null` — exactly what the lab passes for Mars / Hot Jupiter).
function bundle17(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null,
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: {
      ...buildNeutralBodyDrivers(u, fp),
      condition: deriveConditionVector(fp, u, fp.radiusEarth),
    },
    macroSeed: seed,
    heightSeed: 'e6:' + (seed | 0),
    T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
  };
}

// writer_derived: run the REAL flipped dispatch; report path + (on shell) the sub-regime the writer received.
function derivedRoute(name, seed) {
  const carrier = makeSphereField(MESH);
  const r = writeBodyRelief(carrier, bundle17(name, seed));
  return { path: r.path, shellRegime: r.shellDiag ? r.shellDiag.regime : null };
}

// writer_today: PRESET_ARCHETYPE-retirement (2026-07-13) — the legacy archetype chain (classifyWriterPath /
// writerToday, composed from the four now-DELETED dispatch predicates) is retired; the retirement evidence is
// preserved by reading `today` straight from the pinned ADJUDICATION table below (its `today` column was
// empirically the archetype-chain writer at build time), asserted against the LIVE `derived` route.

// The condition vector + tuple the rule chain reads (derived=null → helper fallbacks, like the V2-1 oracle).
const vec = (name) => { const fp = DRIVER_PRESETS[name]; return deriveConditionVector(fp, null, fp.radiusEarth); };

// ── THE BUILD-PLAN §0 EMPIRICALLY-VERIFIED ADJUDICATION TABLE (single source for AC-ORACLE-17) ──
// today = the archetype-chain writer; derived = {path, shellRegime} of the flipped dispatch.
const ADJUDICATION = {
  'Rocky (Earthlike)':          { today: 'plate',        derived: { path: 'plate', shellRegime: null } },
  'Lava (hot airless)':         { today: 'volcanic',     derived: { path: 'volcanic', shellRegime: null } },
  'Ocean (temperate)':          { today: 'plate',        derived: { path: 'plate', shellRegime: null } },
  'Titan (methane seas)':       { today: 'shell',        derived: { path: 'shell', shellRegime: 'volatile-cold' } },
  'Frozen (airless)':           { today: 'shell',        derived: { path: 'despun', shellRegime: null } },   // REROUTE #1
  'Europa (icy moon)':          { today: 'shell',        derived: { path: 'shell', shellRegime: 'icy-active' } },
  'Gas giant (Jovian)':         { today: 'despun',       derived: { path: 'despun', shellRegime: null } },
  'Gas giant (Saturnian)':      { today: 'despun',       derived: { path: 'despun', shellRegime: null } },
  'Ice giant (Neptunian)':      { today: 'despun',       derived: { path: 'despun', shellRegime: null } },
  'Venus (sulfuric shroud)':    { today: 'stagnant-lid', derived: { path: 'stagnant-lid', shellRegime: null } },
  'Sub-Neptune (hazy)':         { today: 'despun',       derived: { path: 'despun', shellRegime: null } },
  'Eyeball (locked temperate)': { today: 'shell',        derived: { path: 'shell', shellRegime: 'eyeball-despun' } },
  'Hot Jupiter (locked giant)': { today: 'shell',        derived: { path: 'despun', shellRegime: null } },   // REROUTE #2
  'Mars (arid rocky)':          { today: 'despun',       derived: { path: 'despun', shellRegime: null } },
  'Magma (K2-141b)':            { today: 'volcanic',     derived: { path: 'volcanic', shellRegime: null } },
  'Carbon (high C/O)':          { today: 'despun',       derived: { path: 'despun', shellRegime: null } },
  'Crystal (faceted)':          { today: 'despun',       derived: { path: 'despun', shellRegime: null } },
  // V2-5: the 18th DRIVER_PRESETS key joins the oracle as an archetype-null row (like Mars + Hot Jupiter —
  // the Mars/Hot-Jupiter-join precedent, NOT a golden re-capture). It is writer-IDENTICAL (despun today AND
  // derived): dead-lid rocky routing (rule 3f) per §5's computeE1 arithmetic, verified live below.
  'Moon/Mercury (impact-airless)': { today: 'despun',    derived: { path: 'despun', shellRegime: null } },
};

// The EXACTLY-two adjudicated reroutes, each with its NAMED disposition (contract AC-ORACLE-17).
const EXPECTED_REROUTES = {
  'Frozen (airless)': {
    today: 'shell', derived: 'despun',
    disposition: 'The §7a dead-lid FIX (Max-adjudicated 2026-07-03): cold-dead icy (T60, no active tidal, below the methane window) reroutes off the icy shell to despun. The 75-golden carve-out asserts its 5 rows equal the despun writer fresh (designDecision #2).',
  },
  'Hot Jupiter (locked giant)': {
    today: 'shell', derived: 'despun',
    disposition: 'Lens M2 (contract-amended 2026-07-11): archetype-null + locked:true falls into shellRegimeOf\'s locked-fallback, putting a locked GAS GIANT on the icy-shell eyeball-despun writer — the §5.2 known-wrong routing to FIX, not match. Derived: gas → despun. Visually masked (gas relief gates ~0) but byte-real; NOT in the 75-golden.',
  },
};

const rows = NAMES17.map((name) => {
  const today = ADJUDICATION[name].today;   // pinned (was writerToday via the now-deleted predicate chain)
  const derived = derivedRoute(name, 1);
  return { name, today, derived, equal: today === derived.path };
});
const row = (name) => rows.find((r) => r.name === name);

describe('V2-3 AC-ORACLE-17 — scope: ALL 18 presets adjudicated (Mars + Hot Jupiter + V2-5 Moon/Mercury join)', () => {
  it('adjudicates exactly the 18 DRIVER_PRESETS; the pinned table covers each once', () => {
    expect(NAMES17.length).toBe(18);   // V2-5: 17 + Moon/Mercury (impact-airless), the 18th non-golden preset
    expect(NAMES17).toContain('Mars (arid rocky)');
    expect(NAMES17).toContain('Hot Jupiter (locked giant)');
    expect(NAMES17).toContain('Moon/Mercury (impact-airless)');
    expect([...NAMES17].sort()).toEqual(Object.keys(ADJUDICATION).sort());
  });
});

describe('V2-3 AC-ORACLE-17 — the §0 adjudication table, row-for-row (writer_today vs writer_derived)', () => {
  it('every row matches: 18× today-path + derived-path + derived shell sub-regime', () => {
    for (const r of rows) {
      const exp = ADJUDICATION[r.name];
      expect(exp, `${r.name}: not in the pinned table`).toBeDefined();
      // (r.today === exp.today is now tautological — rows[].today reads ADJUDICATION[name].today — so it is dropped;
      //  the teeth are the LIVE derived route vs the pinned table, the actual retirement evidence.)
      expect(r.derived.path, `${r.name} writer_derived path`).toBe(exp.derived.path);
      expect(r.derived.shellRegime, `${r.name} derived shell sub-regime`).toBe(exp.derived.shellRegime);
    }
  });

  it('exactly 16 writer-identical + 2 reroutes; the reroute set is EXACTLY {Frozen, Hot Jupiter}, both shell→despun, each with a NAMED disposition', () => {
    const equal = rows.filter((r) => r.equal);
    const rerouted = rows.filter((r) => !r.equal);
    expect(equal.length).toBe(16);   // V2-5: 15 + Moon/Mercury (writer-identical despun; NOT a reroute)
    expect(rerouted.length).toBe(2);
    expect(rerouted.map((r) => r.name).sort()).toEqual(['Frozen (airless)', 'Hot Jupiter (locked giant)']);
    for (const r of rerouted) {
      const exp = EXPECTED_REROUTES[r.name];
      expect(exp, `unexpected reroute ${r.name} [today ${r.today} → derived ${r.derived.path}]`).toBeDefined();
      expect(r.today, r.name).toBe(exp.today);
      expect(r.derived.path, r.name).toBe(exp.derived);
      expect(exp.disposition.length, `${r.name} disposition must be named`).toBeGreaterThan(20);
    }
    // and no writer-identical preset sits on the reroute allow-list (reroutes never silently matched):
    for (const r of equal) expect(EXPECTED_REROUTES[r.name], `${r.name} is writer-identical but allow-listed`).toBeUndefined();
  });
});

describe('V2-3 AC-FLIP — seed-invariance: no preset\'s derived writer choice changes across seeds', () => {
  for (const name of NAMES17) {
    it(`"${name}" routes identically over seeds {${SEEDS.join(',')}}`, () => {
      const ref = ADJUDICATION[name].derived;
      for (const seed of SEEDS) {
        const d = derivedRoute(name, seed);
        expect(d.path, `${name} @ seed ${seed}`).toBe(ref.path);
        expect(d.shellRegime, `${name} @ seed ${seed} sub-regime`).toBe(ref.shellRegime);
      }
    });
  }
});

describe('V2-3 AC-FLIP — Europa ≠ Titan shell sub-regimes (condition-derived, not collapsed — lens MF-2)', () => {
  it('Europa routes shell:icy-active, Titan routes shell:volatile-cold — distinct', () => {
    const europa = derivedRoute('Europa (icy moon)', 1);
    const titan = derivedRoute('Titan (methane seas)', 1);
    expect(europa.shellRegime).toBe('icy-active');
    expect(titan.shellRegime).toBe('volatile-cold');
    expect(europa.shellRegime).not.toBe(titan.shellRegime);
  });
});

describe('V2-3 RT1 pin — every rule-(3c) body classifies PURE-STRONG via classifyLidPath (never mixed/off-pilot)', () => {
  it('for each preset that takes (3c) [rocky, m_hp<=0, unlocked, isUnbrokenLidPath], classifyLidPath === pure-strong', () => {
    const threeC = [];
    for (const name of NAMES17) {
      const cv = vec(name);
      for (const seed of SEEDS) {
        const e1 = computeE1(cv, seed);
        const locked = cv.tidalState?.locked ?? false;
        // reproduce the (3c) guard: rules (1)/(2)/(3a)/(3b) did NOT claim the body
        if (e1.compositionClass !== 'rocky' || e1.m_hp > 0 || locked || !isUnbrokenLidPath(e1)) continue;
        threeC.push(name);
        const fine = classifyLidPath(e1, cv.rawTidalIoRatio ?? 0);
        expect(fine, `${name} @ seed ${seed}: (3c) body must classify pure-strong (RT1)`).toBe('pure-strong');
      }
    }
    // the assertion is NOT vacuous: Venus is the (3c) occupant on every seed
    expect(threeC).toContain('Venus (sulfuric shroud)');
  });
});

describe('V2-3 AC-FLIP — GARBLE: a garbled PRESET_ARCHETYPE changes NO condition-bearing route (R-GARBLE)', () => {
  it('with every PRESET_ARCHETYPE entry garbled, all 18 derived routes are unchanged', () => {
    const baseline = {};
    for (const name of NAMES17) baseline[name] = derivedRoute(name, 1);
    const snapshot = { ...PRESET_ARCHETYPE };
    try {
      for (const key of Object.keys(PRESET_ARCHETYPE)) PRESET_ARCHETYPE[key] = 'garbled-nonsense-' + key.length;
      for (const name of NAMES17) {
        const d = derivedRoute(name, 1);   // bundle17 re-reads the garbled map for the archetype arg too
        expect(d.path, `${name} route under garbled map`).toBe(baseline[name].path);
        expect(d.shellRegime, `${name} sub-regime under garbled map`).toBe(baseline[name].shellRegime);
      }
    } finally {
      for (const key of Object.keys(snapshot)) PRESET_ARCHETYPE[key] = snapshot[key];
    }
    // restored — and the restore itself is verified so later suites see the real map:
    expect(PRESET_ARCHETYPE['Rocky (Earthlike)']).toBe('terrestrial');
  });
});

describe('V2-3 AC-0 check 1 — the condition-bearing routing region is label-free (function-body slice grep)', () => {
  // After the shadow-audit repurposing removed planet-lod-rivers.js from its blind list, THIS grep is the
  // SOLE label-freeness guard on the new dispatch (RG3). Scope: the `if (bodyDrivers?.condition)` block of
  // writeBodyRelief ONLY — the else-bridge below it legitimately still runs the archetype chain, and the
  // file legitimately reads PRESET_ARCHETYPE elsewhere (radius plumbing).
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  // ⭐ RE-POINTED 2026-08-28: writeBodyRelief moved out of planet-lod-rivers.js to
  // src/worldengine/dispatch/bodyRelief.js (three-free, so the game can reach the dispatch and bake a
  // province cube). This grep follows its subject rather than staying on the old file — a pin whose
  // subject has moved is the failure this repo has recorded in blood (driver-pack-rockysurface.test.js:97).
  // ⚠ NOT a silent re-point: the `fnStart > -1` guard below ALREADY caught the move loudly
  // ("expected -1 to be greater than -1") rather than scanning an empty slice, which is why this
  // edit is a re-point and not a repair. The guard stays, and the two sanity anchors under it
  // (computeE1 / compositionClass) remain the liveness proof that the slice is the real dispatch.
  const RIVERS = stripComments(readFileSync(fileURLToPath(new URL('../src/worldengine/dispatch/bodyRelief.js', import.meta.url)), 'utf8'));

  function block(code, from) {
    const start = code.indexOf(from);
    expect(start, `"${from}" found`).toBeGreaterThan(-1);
    const open = code.indexOf('{', start + from.length - 1);
    let depth = 0, i = open;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) break; }
    }
    return code.slice(open, i + 1);
  }

  it('the if (bodyDrivers?.condition) region reads no PRESET_ARCHETYPE / e1 label / stagnantLidRegimeOf( / isVolcanicPath(', () => {
    // slice writeBodyRelief first so the condition-branch marker cannot match some other function:
    const fnStart = RIVERS.indexOf('function writeBodyRelief');
    expect(fnStart, 'writeBodyRelief found').toBeGreaterThan(-1);
    const region = block(RIVERS.slice(fnStart), 'if (bodyDrivers?.condition)');
    // the slice really is the derived dispatch (sanity anchors — the region computes E1 and rules on it):
    expect(region, 'region computes the E1 tuple').toMatch(/computeE1\(/);
    expect(region, 'region rules on compositionClass').toMatch(/compositionClass/);
    // the AC-0 denylist — no archetype-string or label read anywhere in the routing decision:
    expect(region, 'no PRESET_ARCHETYPE read').not.toMatch(/PRESET_ARCHETYPE/);
    expect(region, 'no label read (e1.label or any .label)').not.toMatch(/\.label\b/);
    expect(region, 'no stagnantLidRegimeOf( call (label-keyed resolver)').not.toMatch(/stagnantLidRegimeOf\s*\(/);
    expect(region, 'no isVolcanicPath( call (archetype-string predicate)').not.toMatch(/isVolcanicPath\s*\(/);
    // and none of the other legacy archetype predicates either (the bridge owns them exclusively):
    expect(region, 'no isEarthlikePlatePath( call').not.toMatch(/isEarthlikePlatePath\s*\(/);
    expect(region, 'no shellRegimeOf( call').not.toMatch(/\bshellRegimeOf\s*\(/);
    expect(region, 'no `archetype` identifier at all in the routing region').not.toMatch(/\barchetype\b/);
  });
});

// ── V2-3 verify follow-up (wf_d9529b1e AC-PLUMB coverage gap): appliedTune probe parity is PERMANENTLY
//    asserted on the derived path — previously only exercised ad-hoc by the verify run. The field must be
//    PRESENT (null or object, never undefined) on both router corners + the modal-stagnant direct call. ──
describe('V2-3 AC-PLUMB follow-up — diag.appliedTune present on every tune-bearing derived route', () => {
  it('volcanic (Lava/Magma) carries magmaDiag.appliedTune; stagnant-lid (Venus) carries stagnantDiag.appliedTune', () => {
    for (const name of ['Lava (hot airless)', 'Magma (K2-141b)']) {
      const carrier = makeSphereField(MESH);
      const r = writeBodyRelief(carrier, bundle17(name, 1));
      expect(r.path, name).toBe('volcanic');
      expect('appliedTune' in r.magmaDiag, `${name}: magmaDiag.appliedTune present`).toBe(true);
    }
    const carrier = makeSphereField(MESH);
    const r = writeBodyRelief(carrier, bundle17('Venus (sulfuric shroud)', 1));
    expect(r.path).toBe('stagnant-lid');
    expect('appliedTune' in r.stagnantDiag, 'Venus: stagnantDiag.appliedTune present').toBe(true);
  });
});
