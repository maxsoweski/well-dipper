// tests/gen-feature-cards.test.js
import { describe, it, expect } from 'vitest';
import { parseFeatureRows, fNumsOf, buildCards } from '../scripts/gen-feature-cards.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const md = readFileSync(path.resolve(__dirname, '../docs/FEATURES/planet-visual-features.md'), 'utf8');

describe('gen-feature-cards parser', () => {
  it('parses a known F-row into the expected object', () => {
    const row = '| **F1** | Mountains / ranges | P2, P3, P4 | tectonic fold belt · volcanic shield/strato · ridged crestlines | Himalaya, Olympus Mons, Tharsis | rocky, terrestrial, venus, lava, ice, carbon | `[aspirational]` |';
    const { byFnum, warnings } = parseFeatureRows(row);
    expect(warnings).toEqual([]);
    expect(byFnum['1']).toEqual({
      name: 'Mountains / ranges',
      variants: 'tectonic fold belt · volcanic shield/strato · ridged crestlines',
      examples: 'Himalaya, Olympus Mons, Tharsis',
      status: 'aspirational',
    });
  });

  it('extracts all F#s from a multi-F# label, in order', () => {
    expect(fNumsOf('Mountains (F1)')).toEqual(['1']);
    expect(fNumsOf('Cryo / Frost (F23/F22)')).toEqual(['23', '22']);
  });

  it('joins the registry to the real .md: mountains -> F1 prose', () => {
    const { byFnum } = parseFeatureRows(md);
    const { cards, missing } = buildCards(byFnum);
    expect(cards.mountains.fNum).toBe('1');
    expect(cards.mountains.name).toBe('Mountains / ranges');
    expect(cards.mountains.examples).toContain('Olympus Mons');
    // frost uses the FIRST matching F# (F23 has a row)
    expect(cards.frost.fNum).toBe('23');
    // clouds (F31) is the one structured-only fallback: md has F31a-f, no bare F31
    expect(cards.clouds).toBeUndefined();
    expect(missing.map(m => m.key)).toContain('clouds');
  });
});
