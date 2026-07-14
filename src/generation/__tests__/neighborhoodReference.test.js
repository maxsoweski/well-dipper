// neighborhood-reference.json — unit coverage for the AC1 D1 generator
// (real-universe-overlay Increment 5). Two guarantees: (1) the committed table
// is byte-identical to a fresh run of scripts/gen-neighborhood-reference.mjs
// (deterministic, no timestamps — the ingest-exoplanets pattern); (2) the
// closed neighbor sets match design fact 2 (19 named from Sol, 15 from Sirius
// including Sol) with the shipped name-string traps encoded verbatim and the
// absent-famous documented gap (fact 6) listed.

import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = fileURLToPath(new URL('../../../scripts/gen-neighborhood-reference.mjs', import.meta.url));
const COMMITTED = fileURLToPath(new URL(
  '../../../docs/WORKSTREAMS/real-universe-overlay-2026-07-12/neighborhood-reference.json',
  import.meta.url,
));

const committedText = readFileSync(COMMITTED, 'utf-8');
const ref = JSON.parse(committedText);

describe('gen-neighborhood-reference.mjs — determinism', () => {
  it('re-run is byte-identical to the committed table', () => {
    const tmp = join(mkdtempSync(join(tmpdir(), 'nref-')), 'out.json');
    execFileSync('node', [SCRIPT, tmp]);
    const regen = readFileSync(tmp, 'utf-8');
    expect(regen).toBe(committedText);
  });
});

describe('neighborhood-reference.json — closed neighbor sets (design fact 2)', () => {
  const solNames = ref.origins.Sol.map((e) => e.name);
  const sirNames = ref.origins.Sirius.map((e) => e.name);

  it('Sol has 19 named neighbors within 5 pc (12 hyg + 7 supplement)', () => {
    expect(ref.origins.Sol).toHaveLength(19);
    expect(ref.origins.Sol.filter((e) => e.source === 'hyg')).toHaveLength(12);
    expect(ref.origins.Sol.filter((e) => e.source === 'supplement')).toHaveLength(7);
  });

  it('Sirius has 15 named neighbors within 5 pc, including Sol at ~2.64 pc', () => {
    expect(ref.origins.Sirius).toHaveLength(15);
    const sol = ref.origins.Sirius.find((e) => e.name === 'Sol');
    expect(sol).toBeDefined();
    expect(sol.refDistPc).toBeCloseTo(2.637, 3);
    expect(sol.source).toBe('hyg');
  });

  it('encodes the shipped name-string traps verbatim (Sol set)', () => {
    for (const n of ['Ran', 'Tau Cet', 'Eps Ind', 'HD 201091', 'HD 201092',
                     'Keid', 'Rigil Kentaurus', 'Toliman']) {
      expect(solNames, n).toContain(n);
    }
    // Near-namesake traps: the real neighbors, NOT their famous lookalikes.
    expect(solNames).toContain('Lacaille 8760'); // not Lacaille 9352
    expect(solNames).not.toContain('Lacaille 9352');
    expect(solNames).toContain('HD 88230'); // GJ 380, not Lalande 21185
    expect(solNames).not.toContain('Lalande 21185');
    expect(solNames).toContain('Wolf 1061'); // not Wolf 359
    expect(solNames).not.toContain('Wolf 359');
  });

  it('carries no null-named or quote-artifact entries in either set', () => {
    for (const e of [...ref.origins.Sol, ...ref.origins.Sirius]) {
      expect(typeof e.name).toBe('string');
      expect(e.name.trim()).not.toBe('');
      expect(e.name).not.toBe('"');
    }
  });

  it('sorts each set by ascending reference distance', () => {
    for (const set of [ref.origins.Sol, ref.origins.Sirius]) {
      const d = set.map((e) => e.refDistPc);
      expect(d).toEqual([...d].sort((a, b) => a - b));
    }
  });

  it('every entry carries name, numeric refDistPc, spect, and a valid source', () => {
    for (const e of [...ref.origins.Sol, ...ref.origins.Sirius]) {
      expect(typeof e.refDistPc).toBe('number');
      expect(e.refDistPc).toBeLessThanOrEqual(5.0);
      expect(typeof e.spect).toBe('string');
      expect(['hyg', 'supplement']).toContain(e.source);
    }
  });

  it('pins Rigil Kentaurus (Alpha Cen A) as a Sol G-star neighbor at 1.324 pc', () => {
    const rigil = ref.origins.Sol.find((e) => e.name === 'Rigil Kentaurus');
    expect(rigil).toMatchObject({ refDistPc: 1.324, spect: 'G', source: 'hyg' });
  });

  it('lists the absent-famous documented gap (design fact 6)', () => {
    expect(ref.absentFamous.names).toEqual([
      'Lacaille 9352', 'Lalande 21185', 'Luyten 726-8 / UV Ceti',
      'Ross 154', 'Ross 248', 'Wolf 359',
    ]);
  });

  it('records the derivation radius and shipped-catalog provenance', () => {
    expect(ref.derivation.radiusPc).toBe(5.0);
    expect(ref.derivation.sources).toHaveLength(2);
    expect(ref.derivation.sources.join(' ')).toMatch(/hyg-stars\.json/);
    expect(ref.derivation.sources.join(' ')).toMatch(/real-star-supplement\.json/);
    expect(typeof ref.derivation.toleranceRationale).toBe('string');
  });
});
