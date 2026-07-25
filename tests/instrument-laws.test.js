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
import { reliefEnvelope, Q_RELIEF } from '../planet-lod-lab-core.js';

describe('the audit is wired to the shipping functions', () => {
  // Closes the only gap dependency-injection leaves versus editing the source: if the registry ever
  // pointed at a local copy, every law below could pass while the real engine drifted freely.
  it('uses the real bombardment + lab-core exports, not a local re-implementation', () => {
    const deps = defaultDeps();
    expect(deps.craterSchedule).toBe(craterSchedule);
    expect(deps.reliefEnvelope).toBe(reliefEnvelope);
    expect(deps.isImpactSurface).toBe(isImpactSurface);
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
    expect(ids).toContain('relief-envelope-vs-gravity');
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
    expect(by['relief-envelope-vs-gravity'].measuredExponent).toBeCloseTo(-Q_RELIEF, 6);
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
    expect(audit.summary.pass).toContain('relief-envelope-vs-gravity');
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
    const deps = {
      ...defaultDeps(),
      reliefEnvelope: (R, g) => Math.pow(Math.max(g, 1e-3), -0.3),   // was -0.58
    };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toEqual(['relief-envelope-vs-gravity']);
    const r = audit.results.find((x) => x.id === 'relief-envelope-vs-gravity');
    expect(r.measuredExponent).toBeCloseTo(-0.3, 4);
  });

  it('a SUBTLE retune is still caught — detection is not limited to gross breakage', () => {
    // 0.58 -> 0.52 is a ~10% change that no screenshot would ever reveal.
    const deps = { ...defaultDeps(), reliefEnvelope: (R, g) => Math.pow(Math.max(g, 1e-3), -0.52) };
    const audit = auditLaws({ deps });
    expect(audit.summary.fail).toEqual(['relief-envelope-vs-gravity']);
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
