// tests/instrument-laws.test.js
// Non-visual analysis channel — AC-LAWS + AC-POSCTRL.
//
// AC-POSCTRL is the one that makes the rest of the instrument mean anything: an instrument that has
// never caught a defect it was not told about is decoration. Four bugs during this build each
// returned a plausible NUMBER rather than crashing, so "it ran and produced output" proves nothing.
//
// HOW THE POSITIVE CONTROL IS RUN, AND WHY IT DIFFERS FROM THE CONTRACT'S WORDING.
// contract.json AC-POSCTRL describes temporarily editing the source to detach a coupling, then
// restoring it. This suite instead INJECTS a broken implementation through the registry's dependency
// seam. That is strictly stronger, for two reasons: a broken build never lands on disk (nothing to
// forget to restore, no chance of committing it), and the break is exercised on every CI run instead
// of once by hand. The one guarantee source-editing had and injection does not — that the audit is
// actually wired to the shipping functions rather than to a stale copy — is closed explicitly by the
// identity assertions in the first block below.

import { describe, it, expect } from 'vitest';
import {
  LAW_REGISTRY, auditLaw, auditLaws, defaultDeps, baselineCondition,
} from '../src/worldengine/instrument/laws.js';
import { craterSchedule, isImpactSurface, G_REF, K_GS } from '../src/worldengine/base/bombardment.js';
import { reliefEnvelope } from '../src/worldengine/base/labCore.js';
import {
  deriveConditionVector, GRAV_R_EXP_SUB, GRAV_R_EXP_SUPER,
} from '../src/worldengine/base/conditionVector.js';

describe('the audit is wired to the shipping functions', () => {
  // Closes the only gap dependency-injection leaves versus editing the source: if the registry ever
  // pointed at a local copy, every law below could pass while the real engine drifted freely.
  it('uses the real bombardment + lab-core exports, not a local re-implementation', () => {
    const deps = defaultDeps();
    expect(deps.craterSchedule).toBe(craterSchedule);
    expect(deps.reliefEnvelope).toBe(reliefEnvelope);
    expect(deps.isImpactSurface).toBe(isImpactSurface);
    expect(deps.deriveConditionVector).toBe(deriveConditionVector);
  });

  it('audits against a condition that actually fires the impact-surface gate', () => {
    // A silently non-firing schedule returns zeros everywhere, which would fit a flat exponent and
    // could read as "law holds". Assert the baseline really is an impact surface.
    expect(isImpactSurface(baselineCondition())).toBe(true);
    expect(craterSchedule(baselineCondition()).nAnalytic).toBeGreaterThan(0);
  });
});

describe('AC-LAWS — every registered law is checked against its stated exponent', () => {
  const audit = auditLaws();

  it('registers the laws the codebase actually states today', () => {
    const ids = LAW_REGISTRY.map((l) => l.id);
    expect(ids).toContain('crater-size-vs-gravity');
    expect(ids).toContain('crater-count-independent-of-gravity');
    expect(ids).toContain('crater-count-vs-radius');
    expect(ids).toContain('mesh-floor-vs-radius');
    expect(ids).toContain('relief-envelope-vs-gravity-calibrated');
    expect(ids).toContain('relief-envelope-vs-gravity-derived');
    expect(ids).toContain('relief-absolute-vs-radius');
  });

  it('every law carries a source citation to the line that states it', () => {
    for (const law of LAW_REGISTRY) {
      expect(law.source).toMatch(/\.js/);
      expect(law.claim.length).toBeGreaterThan(20);
    }
  });

  it('all laws PASS against the real implementation', () => {
    const failing = audit.results.filter((r) => r.verdict !== 'PASS');
    expect(failing.map((f) => `${f.id}: ${f.verdict} — ${f.reason}`)).toEqual([]);
    expect(audit.summary.allPass).toBe(true);
  });

  it('pins the measured exponents to the constants the source declares', () => {
    const by = Object.fromEntries(audit.results.map((r) => [r.id, r]));
    expect(by['crater-size-vs-gravity'].measuredExponent).toBeCloseTo(-K_GS, 6);
    expect(by['crater-count-vs-radius'].measuredExponent).toBeCloseTo(2, 6);
    expect(by['mesh-floor-vs-radius'].measuredExponent).toBeCloseTo(1, 6);
    // HAND-DUPLICATED literals, NOT the imported constants: a guard that reads its expectation from
    // the constant it guards degrades to UNRESOLVABLE (or silently PASSes) on a retune.
    expect(by['relief-envelope-vs-gravity-calibrated'].measuredExponent).toBeCloseTo(-0.58, 6);
    expect(by['relief-envelope-vs-gravity-derived'].measuredExponent).toBeCloseTo(-1.678235294117647, 6);
    expect(by['relief-absolute-vs-radius'].measuredExponent).toBeCloseTo(-1.853, 6);
    // AC-PLATECOMP. Hand-typed -2, deliberately NOT PLATE_COUNT_MDF_EXP — same discipline as above.
    expect(by['plate-count-vs-mantle-depth-fraction'].measuredExponent).toBeCloseTo(-2, 6);
    // The fit must be essentially exact: the law is an exact power law in the mantle-depth fraction, so
    // a materially non-zero SE means the entry has started measuring something quantized or noisy —
    // measuring the ROUNDED plate count instead of the continuous target gives -1.646 ± 0.125, which
    // FAILS. This assertion is what stops a future "simplification" from turning the guard into a
    // coin flip while still looking green.
    expect(by['plate-count-vs-mantle-depth-fraction'].measuredSE).toBeLessThan(1e-9);
    expect(by['plate-count-vs-mantle-depth-fraction'].r2).toBeCloseTo(1, 9);
  });

  it('AC-PLATECOMP: the composition law is separable from the composition-BLIND regression', () => {
    // nullValue 0 is legitimate here, unlike the gravity entries: exponent 0 IS the shipped
    // pre-AC-PLATECOMP behaviour (plate count set by seed alone), so it is a REACHABLE regression
    // rather than an unphysical straw man. Nobody may "fix" a future failure by widening the null.
    const law = LAW_REGISTRY.find((l) => l.id === 'plate-count-vs-mantle-depth-fraction');
    expect(law.claimedExponent).toBe(-2);
    expect(law.nullValue).toBe(0);
    expect(law.nullMeaning).toMatch(/composition-blind/);
    expect(law.driver).toBe('mantleDepthFraction');   // NOT the core fraction — N is not a power law in f
  });

  it('records that crater count is g-INDEPENDENT — the removed g^0.34 factor is not a live law', () => {
    // The contract, the prior handoff and the program memory all cite "crater count ~ g^0.34". The
    // source says that factor was removed as unphysical. The registry asserts what the code does.
    const law = LAW_REGISTRY.find((l) => l.id === 'crater-count-independent-of-gravity');
    expect(law.claimedExponent).toBe(0);
    expect(law.nullValue).toBe(0.34);          // the alternative it must be distinguishable FROM
    const r = auditLaw(law);
    expect(r.verdict).toBe('PASS');
    expect(Math.abs(r.measuredExponent)).toBeLessThan(1e-6);
  });
});

describe('AC-POSCTRL — the audit catches planted defects, and names the right one', () => {
  /** Wrap the real schedule, corrupting one output. Everything else stays genuine. */
  const brokenSchedule = (corrupt) => (c) => {
    const s = craterSchedule(c);
    return { ...s, ...corrupt(s, c) };
  };

  it('catches a re-introduced gravity-count coupling — the exact regression that was removed', () => {
    const deps = {
      ...defaultDeps(),
      craterSchedule: brokenSchedule((s, c) => ({
        nAnalytic: s.nAnalytic * Math.pow((c.surfaceGravity ?? G_REF) / G_REF, 0.34),
      })),
    };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toContain('crater-count-independent-of-gravity');
    const r = audit.results.find((x) => x.id === 'crater-count-independent-of-gravity');
    expect(r.verdict).toBe('FAIL');
    expect(r.measuredExponent).toBeCloseTo(0.34, 4);
  });

  it('names the SPECIFIC law — a broken count does not set every other law alight', () => {
    // A generic alarm is not a detection. If planting one defect fails several unrelated laws, the
    // audit cannot tell an operator where to look, which is most of its value.
    const deps = {
      ...defaultDeps(),
      craterSchedule: brokenSchedule((s, c) => ({
        nAnalytic: s.nAnalytic * Math.pow((c.surfaceGravity ?? G_REF) / G_REF, 0.34),
      })),
    };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toEqual(['crater-count-independent-of-gravity']);
    expect(audit.summary.pass).toContain('crater-size-vs-gravity');
    expect(audit.summary.pass).toContain('mesh-floor-vs-radius');
    expect(audit.summary.pass).toContain('relief-envelope-vs-gravity-calibrated');
  });

  it('catches the gravity SIZE law being flattened', () => {
    const deps = { ...defaultDeps(), craterSchedule: brokenSchedule(() => ({ sizeMul: 1 })) };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toEqual(['crater-size-vs-gravity']);
  });

  it('catches the areal count law being made linear in radius instead of quadratic', () => {
    const deps = {
      ...defaultDeps(),
      craterSchedule: brokenSchedule((s, c) => ({ nAnalytic: s.nAnalytic / Math.max(1e-6, c.radiusEarth) })),
    };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toContain('crater-count-vs-radius');
    const r = audit.results.find((x) => x.id === 'crater-count-vs-radius');
    expect(r.measuredExponent).toBeCloseTo(1, 4);
  });

  it('catches the mesh floor losing its radius dependence — the inc3b R-invariance regression', () => {
    const deps = { ...defaultDeps(), craterSchedule: brokenSchedule(() => ({ D_FLOOR_KM: 42 })) };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toContain('mesh-floor-vs-radius');
  });

  it('catches the relief envelope exponent being retuned', () => {
    // The stub is a single radius-blind power of g — i.e. the seam removed AND the derived branch
    // gone. All THREE relief entries must name it: the calibrated branch (wrong exponent), the
    // derived branch (wrong exponent), and the absolute-vs-radius entry (whose h = E*R then rises
    // with radius instead of falling). Listed in registry order.
    const deps = {
      ...defaultDeps(),
      reliefEnvelope: (R, g) => Math.pow(Math.max(g, 1e-3), -0.3),   // was -0.58
    };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toEqual([
      'relief-envelope-vs-gravity-calibrated',
      'relief-envelope-vs-gravity-derived',
      'relief-absolute-vs-radius',
    ]);
    const r = audit.results.find((x) => x.id === 'relief-envelope-vs-gravity-calibrated');
    expect(r.measuredExponent).toBeCloseTo(-0.3, 4);
  });

  it('a SUBTLE retune is still caught — detection is not limited to gross breakage', () => {
    // 0.58 -> 0.52 is a ~10% change that no screenshot would ever reveal.
    const deps = { ...defaultDeps(), reliefEnvelope: (R, g) => Math.pow(Math.max(g, 1e-3), -0.52) };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toEqual([
      'relief-envelope-vs-gravity-calibrated',
      'relief-envelope-vs-gravity-derived',
      'relief-absolute-vs-radius',
    ]);
  });

  it('restoring the real dependencies restores a clean audit', () => {
    expect(auditLaws({ deps: defaultDeps() }).summary.allPass).toBe(true);
  });

  it('reports UNRESOLVABLE rather than PASS when a measurement throws', () => {
    const deps = { ...defaultDeps(), craterSchedule: () => { throw new Error('planted failure'); } };
    const audit = auditLaws({ deps });
    const r = audit.results.find((x) => x.id === 'crater-size-vs-gravity');
    expect(r.verdict).toBe('UNRESOLVABLE');
    expect(r.reason).toMatch(/planted failure/);
  });
});

describe('the verdict tolerance handles a noiseless fit', () => {
  it('does not FAIL an exact law on floating-point residue', () => {
    // Auditing deterministic pure functions puts every point exactly on the law, so the fit returns
    // SE = 0 and z*SE collapses to zero. Before the numerical floor was added, three laws measured
    // their claimed exponent to four decimals and were reported FAIL.
    const r = auditLaw(LAW_REGISTRY.find((l) => l.id === 'mesh-floor-vs-radius'));
    expect(r.measuredSE).toBeCloseTo(0, 12);
    expect(r.verdict).toBe('PASS');
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-POSCTRL — the two gravity-vs-radius laws (gravity-selfcompression-2026-07-28)', () => {
  const SUPER = 'gravity-vs-radius-selfcompression-super';
  const SUB = 'gravity-vs-radius-selfcompression-sub';
  // v2 relief law 2026-07-28: absolute relief is the COMPOSITION of the envelope with the gravity
  // shape, so it is the one relief entry a gravity regression legitimately falsifies.
  const ABS = 'relief-absolute-vs-radius';

  /**
   * Inject the RETIRED constant-density law — g = g_c·(R/R_c)^1 — in place of the shipped
   * derivation. This is the exact regression the two entries exist to guard, and it is what the
   * registry measured before the fix landed (1.000 against claims of 1.700 and 1.333).
   */
  const retiredGravity = (fp, derived, radiusEarth) => {
    const cv = deriveConditionVector(fp, derived, radiusEarth);
    const R_c = fp.radiusEarth ?? 1.0;
    const g_c = (fp.massEarth ?? 1.0) / (R_c * R_c);
    return { ...cv, surfaceGravity: g_c * ((radiusEarth ?? R_c) / R_c) };
  };

  it('both laws PASS against the shipped derivation', () => {
    const audit = auditLaws();
    const s = audit.results.find((x) => x.id === SUPER);
    const b = audit.results.find((x) => x.id === SUB);
    expect(s.verdict).toBe('PASS');
    expect(b.verdict).toBe('PASS');
    expect(s.measuredExponent).toBeCloseTo(GRAV_R_EXP_SUPER, 8);
    expect(b.measuredExponent).toBeCloseTo(GRAV_R_EXP_SUB, 8);
  });

  it('reinstating the constant-density law fails BOTH gravity laws + the absolute-relief law', () => {
    // A generic alarm is not a detection, so the fail set is asserted EXACTLY. Three entries, and
    // the third is not noise: relief-absolute-vs-radius (v2 relief law, 2026-07-28) states
    // h = E*R ~ R^(1 - 1.70*Q_RELIEF_DERIVED), which CITES the 1.70 this stub replaces with 1. Its
    // claim is genuinely falsified by a broken gravity shape, so naming it is correct detection.
    // The two vs-gravity relief entries are NOT in the set — they sweep surfaceGravity directly and
    // remain untouched by how the condition vector derives g, which is the discrimination that
    // makes this a detection rather than an alarm.
    const audit = auditLaws({ deps: { ...defaultDeps(), deriveConditionVector: retiredGravity } });
    expect(audit.summary.fail.sort()).toEqual([SUB, SUPER, ABS].sort());
    expect(audit.results.find((x) => x.id === SUPER).measuredExponent).toBeCloseTo(1, 8);
    expect(audit.results.find((x) => x.id === SUB).measuredExponent).toBeCloseTo(1, 8);
    // 1 - 1*1.678235294117647, hand-computed: the retired g ~ R^1 leaves absolute relief far
    // shallower than the ruled -1.853.
    expect(audit.results.find((x) => x.id === ABS).measuredExponent).toBeCloseTo(-0.678235294117647, 8);
  });

  it('the null is the retired law (1.0), not "no response" (0) — so a null of 0 cannot false-PASS', () => {
    // g = M/R² is radius-driven under ANY mass law, so "gravity ignores radius" is unreachable and
    // a nullValue of 0 would guard nothing. Pinned here because it is the one design choice in
    // these entries that a future editor is most likely to "correct".
    for (const id of [SUPER, SUB]) {
      const law = LAW_REGISTRY.find((l) => l.id === id);
      expect(law.nullValue).toBe(1.0);
      expect(law.driver).toBe('radiusEarth');
    }
  });

  it('each entry sweeps strictly inside its own branch — never across the R = 1 join', () => {
    // A sweep spanning the join measures the BLEND and would FAIL a correct law. This is why there
    // are two entries rather than one; the constraint is asserted so a future edit cannot widen a
    // sweep and then read the resulting failure as a physics regression.
    const sup = LAW_REGISTRY.find((l) => l.id === SUPER);
    const sub = LAW_REGISTRY.find((l) => l.id === SUB);
    expect(Math.min(...sup.values)).toBeGreaterThan(1);
    expect(Math.max(...sup.values)).toBeLessThanOrEqual(1.7542);  // Zeng's 8 M⊕ ceiling in radius
    expect(Math.max(...sub.values)).toBeLessThan(1);
  });

  it('a SUBTLE exponent retune is caught — 1.70 -> 1.60 is invisible to any screenshot', () => {
    const retuned = (fp, derived, radiusEarth) => {
      const cv = deriveConditionVector(fp, derived, radiusEarth);
      const R_c = fp.radiusEarth ?? 1.0, R = radiusEarth ?? R_c;
      const g_c = (fp.massEarth ?? 1.0) / (R_c * R_c);
      const f = (r) => (r <= 1 ? Math.pow(r, GRAV_R_EXP_SUB) : Math.pow(r, 1.60));
      return { ...cv, surfaceGravity: g_c * (f(R) / f(R_c)) };
    };
    const audit = auditLaws({ deps: { ...defaultDeps(), deriveConditionVector: retuned } });
    // Registry order. ONLY the HIGH gravity branch — the low one is untouched by the 1.60 stub —
    // plus the absolute-relief law, which cites the high branch's 1.70 in its own claim.
    expect(audit.summary.fail).toEqual([ABS, SUPER]);
    // 1 - 1.60*1.678235294117647, hand-computed.
    expect(audit.results.find((x) => x.id === ABS).measuredExponent).toBeCloseTo(-1.685176470588235, 8);
  });
});
