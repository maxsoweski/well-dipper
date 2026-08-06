/**
 * validateStellarCompanions far-row promotability — S2 of
 * multistar-components-2026-07-19 (AC1 validation extension).
 *
 * Every farCompanions entry must carry a class whose leading letter the
 * component promotion can normalize to a star type — an un-normalizable far
 * class would make StarSystemGenerator's emission fall back to 'M' silently,
 * so the TABLE validator rejects it at authoring time instead. The validator
 * keeps stellarCompanions.js dependency-free via a LOCAL _promotableLead
 * predicate; the agreement test below imports the REAL normalizer and pins the
 * two against each other across a class battery, closing the mirror-drift gap.
 */

import { describe, it, expect } from 'vitest';
import {
  STELLAR_COMPANIONS,
  validateStellarCompanions,
} from '../data/stellarCompanions.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';

// A minimal well-formed multiple whose single far row carries the class under test.
const withFarClass = (cls) => [{
  name: 'Battery Host',
  kind: 'multiple',
  components: [{ name: 'Battery Host', class: 'G2V' }],
  farCompanions: [{ name: 'Battery Far', class: cls, separationAU: 100 }],
}];

describe('far-row promotability (AC1 validation extension)', () => {
  it('passes on the real table — all three far-bearing rows are promotable', () => {
    const r = validateStellarCompanions();
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    // The census this guards: exactly these far rows, all with normalizable leads.
    const farClasses = STELLAR_COMPANIONS
      .filter((e) => Array.isArray(e.farCompanions))
      .flatMap((e) => e.farCompanions.map((f) => f.class));
    expect(farClasses).toEqual(['M5.5Ve', 'K5V', 'G1V']);
    for (const cls of farClasses) {
      expect(StarSystemGenerator.normalizeSpectralClass(cls)).not.toBeNull();
    }
  });

  it('a synthetic far row whose class has no normalizable leading letter is reported un-promotable', () => {
    const r = validateStellarCompanions(withFarClass('ZZZ9'));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/promotable/);
  });

  it('the promotability predicate agrees with normalizeSpectralClass across a class battery', () => {
    const BATTERY = [
      // real table classes
      'G2V', 'K1V', 'M5.5Ve', 'A1V', 'F5IV-V', 'DA2', 'DQZ', 'K5V', 'K7V', 'G1V', 'G2.5V',
      // unusual/evolved leads the normalizer maps into OBAFGKMD
      'W40', 'C5', 'S3', 'L5', 'T8', 'Y0', 'Kg', 'Gg', 'Mg',
      // case-insensitivity of the lead
      'm5.5ve', 'g2v', 'dA2',
      // un-normalizable
      'ZZZ', 'Q0', 'H9', '9G', '', '   ', 'Va',
    ];
    for (const cls of BATTERY) {
      const promotable = StarSystemGenerator.normalizeSpectralClass(cls) !== null;
      const r = validateStellarCompanions(withFarClass(cls));
      const promotErrors = r.errors.filter((e) => /promotable/.test(e));
      expect(promotErrors.length === 0, `class ${JSON.stringify(cls)}`).toBe(promotable);
    }
  });
});
