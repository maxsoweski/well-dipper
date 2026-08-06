/**
 * componentSystems pure helpers — S1 of multistar-components-2026-07-19.
 *
 * Covers AC2 at the derivation level (child-stream seed: deterministic,
 * per-index/per-system distinct, genuinely routed through SeededRandom.child,
 * zero realStarSeed references) and AC9 helper purity (this file imports the
 * module bare — no StarSystemGenerator, no NavComputer). buildComponentContext
 * is the recursion/no-inherit guard: it must destructure-OMIT the parent's
 * farCompanions / companionSpec / knownPlanets (an executable strip — a
 * {...spread} would carry farCompanions into the recursive generate and
 * stack-overflow; see build-plan.md DECISION b).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SeededRandom } from '../SeededRandom.js';
import {
  componentSeed,
  buildComponentContext,
  validateComponentPayload,
} from '../componentSystems.js';

const HERE = dirname(fileURLToPath(import.meta.url));

afterEach(() => vi.restoreAllMocks());

// A far-companion row as the emission block sees it (STELLAR_COMPANIONS shape,
// planets already archive-shaped via buildAuthoredContext / RealSystemOverlay).
const PROXIMA = {
  name: 'Proxima Centauri',
  class: 'M5.5Ve',
  separationAU: 13000,
  planets: [
    { letter: 'b', smaAU: 0.04848, massEarth: 1.07 },
    { letter: 'd', smaAU: 0.02881, massEarth: 0.26 },
  ],
};
const ZET2 = { name: 'Zet-2 Ret', class: 'G1V', separationAU: 3750 }; // no planets key

// A parent ctx shaped like buildAuthoredContext's output for Alpha Centauri:
// real galaxy-context fields PLUS the three multi-star fields the component
// context must strip (companionSpec, farCompanions) or replace (knownPlanets).
const parentCtx = () => ({
  metallicity: 0.02,
  age: 5.3,
  binaryModifier: 1.0,
  starWeights: { G: 0.1, K: 0.2, M: 0.7 },
  position: { x: 8.000948, y: 0.024984, z: -0.000924 },
  // A field this test suite does NOT know about — pins the ...rest PASS-THROUGH
  // semantics (a whitelist copy of the individually-asserted fields would pass
  // every other test; real ctxs carry more fields than this factory).
  unknownExtraField: 'must-survive-pass-through',
  starTypeOverride: 'G',
  companionSpec: {
    name: 'Alpha Centauri',
    kind: 'multiple',
    components: [
      { name: 'Rigil Kentaurus', class: 'G2V' },
      { name: 'Toliman', class: 'K1V', separationAU: 23.5 },
    ],
    farCompanions: [{ name: 'Proxima Centauri', class: 'M5.5Ve', separationAU: 13000 }],
  },
  farCompanions: [PROXIMA],
  knownPlanets: [{ letter: 'q', smaAU: 9.9 }], // a PARENT pin — must never leak
});

describe('componentSeed — child-stream derivation (AC2)', () => {
  it('is deterministic for the same (seed, idx)', () => {
    expect(componentSeed('alpha-centauri', 0)).toBe(componentSeed('alpha-centauri', 0));
    expect(componentSeed(1816942132, 1)).toBe(componentSeed(1816942132, 1));
  });

  it('is distinct per component index and per system seed', () => {
    expect(componentSeed('alpha-centauri', 0)).not.toBe(componentSeed('alpha-centauri', 1));
    expect(componentSeed('alpha-centauri', 0)).not.toBe(componentSeed('guniibuu-seed', 0));
  });

  it('routes through SeededRandom.child keyed by component index', () => {
    const childSpy = vi.spyOn(SeededRandom.prototype, 'child');
    componentSeed('alpha-centauri', 2);
    expect(childSpy).toHaveBeenCalledWith('component-2');
  });

  it('golden derivation: the suffix IS the child-stream draw (S1-verify NIT — a call-and-discard fake passes the spy test)', () => {
    // Recomputed independently: an implementation that calls .child(), discards
    // it, and draws the suffix from the root (or bare-concats) passes the spy +
    // determinism + distinctness tests but fails THIS pin. Also the only guard
    // against derivation drift — S2's payload-seed test recomputes via
    // componentSeed itself, so it can never catch drift here.
    const expected =
      `x:component-0:${new SeededRandom('x').child('component-0').int(0, 0xffffffff).toString(36)}`;
    expect(componentSeed('x', 0)).toBe(expected);
  });

  it('never references realStarSeed (module source has zero occurrences)', () => {
    const src = readFileSync(join(HERE, '../componentSystems.js'), 'utf8');
    expect(src.includes('realStarSeed')).toBe(false);
  });
});

describe('buildComponentContext — recursion + no-inherit guard (DECISION b)', () => {
  it('sets starTypeOverride to the passed normalized type', () => {
    const ctx = buildComponentContext(parentCtx(), PROXIMA, 'M');
    expect(ctx.starTypeOverride).toBe('M');
  });

  it('forces companionSpec kind:single carrying components[0]={name,class} (spectFull honesty)', () => {
    const ctx = buildComponentContext(parentCtx(), PROXIMA, 'M');
    expect(ctx.companionSpec.kind).toBe('single');
    expect(ctx.companionSpec.source).toBe('component');
    expect(ctx.companionSpec.components).toEqual([
      { name: 'Proxima Centauri', class: 'M5.5Ve' },
    ]);
  });

  it('routes fc.planets → knownPlanets, [] when absent', () => {
    expect(buildComponentContext(parentCtx(), PROXIMA, 'M').knownPlanets)
      .toEqual(PROXIMA.planets);
    expect(buildComponentContext(parentCtx(), ZET2, 'G').knownPlanets).toEqual([]);
  });

  it('strips parent farCompanions AND companionSpec AND knownPlanets (executable strip)', () => {
    const parent = parentCtx();
    const ctx = buildComponentContext(parent, PROXIMA, 'M');
    // farCompanions: absent entirely — the recursion guard (a present-but-empty
    // array would also pass the emission guard's length check, but the plan pins
    // ABSENT, matching procgen ctx shape).
    expect('farCompanions' in ctx).toBe(false);
    // companionSpec: REPLACED, never the parent's multiple-spec.
    expect(ctx.companionSpec).not.toBe(parent.companionSpec);
    expect(ctx.companionSpec.kind).toBe('single');
    // knownPlanets: the component's own pins, never the parent's.
    expect(ctx.knownPlanets).toEqual(PROXIMA.planets);
    expect(ctx.knownPlanets).not.toContainEqual({ letter: 'q', smaAU: 9.9 });
    // The rest of the galaxy physics is carried through unchanged.
    expect(ctx.metallicity).toBe(parent.metallicity);
    expect(ctx.age).toBe(parent.age);
    expect(ctx.binaryModifier).toBe(parent.binaryModifier);
    expect(ctx.starWeights).toEqual(parent.starWeights);
    expect(ctx.position).toEqual(parent.position);
    // Pass-through, not whitelist: fields the helper has never heard of survive.
    expect(ctx.unknownExtraField).toBe('must-survive-pass-through');
  });
});

describe('validateComponentPayload — payload-shape check (AC1)', () => {
  const wellFormed = () => ({
    name: 'Proxima Centauri',
    class: 'M5.5Ve',
    type: 'M',
    separationAU: 13000,
    seed: 'alpha-centauri:component-0:abc123',
    systemData: { star: { type: 'M' }, planets: [] },
  });

  it('accepts a well-formed entry', () => {
    const r = validateComponentPayload(wellFormed());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('rejects each missing key', () => {
    for (const key of ['name', 'class', 'type', 'separationAU', 'seed', 'systemData']) {
      const entry = wellFormed();
      delete entry[key];
      const r = validateComponentPayload(entry);
      expect(r.ok, `missing '${key}' must fail`).toBe(false);
      expect(r.errors.join('\n')).toContain(key);
    }
  });

  it('rejects each mistyped key', () => {
    const bad = {
      name: 42,
      class: null,
      type: 'M5.5Ve',          // must be the single normalized letter, not the full class
      separationAU: '13000',
      seed: 1816942132,        // payload seed is the derived string, not a number
      systemData: null,
    };
    for (const [key, value] of Object.entries(bad)) {
      const entry = wellFormed();
      entry[key] = value;
      const r = validateComponentPayload(entry);
      expect(r.ok, `mistyped '${key}' must fail`).toBe(false);
      expect(r.errors.join('\n')).toContain(key);
    }
  });

  it('rejects non-positive separationAU and a non-object/array systemData', () => {
    for (const sep of [0, -5, NaN, Infinity]) {
      const entry = wellFormed();
      entry.separationAU = sep;
      expect(validateComponentPayload(entry).ok, `separationAU ${sep}`).toBe(false);
    }
    for (const sd of [[], 'systemData', 7]) {
      const entry = wellFormed();
      entry.systemData = sd;
      expect(validateComponentPayload(entry).ok, `systemData ${JSON.stringify(sd)}`).toBe(false);
    }
  });

  it('rejects a null entry, an array entry, and an empty-string name', () => {
    expect(validateComponentPayload(null).ok).toBe(false);
    expect(validateComponentPayload([]).ok).toBe(false);
    const entry = wellFormed();
    entry.name = '';
    expect(validateComponentPayload(entry).ok).toBe(false);
  });

  it('requires systemData to carry a star object and a planets array (drill-in consumables)', () => {
    const noStar = wellFormed();
    delete noStar.systemData.star;
    expect(validateComponentPayload(noStar).ok).toBe(false);
    const noPlanets = wellFormed();
    noPlanets.systemData.planets = null;
    expect(validateComponentPayload(noPlanets).ok).toBe(false);
  });
});
