// tests/render-status.test.js
// Pure status-mapping seam for the live render-audit surface (Ask 4). statusOf maps
// (should, delta, degenerate) -> the offline report's EXACT glyph string, applying
// the ⬛-degenerate-wins precedence. Boundaries pinned to eps=1e-4 / STRONG=5e-4.
import { describe, it, expect } from 'vitest';
import { statusOf, EPS, STRONG } from '../lab-render-status.js';

describe('lab-render-status', () => {
  it('exports the report thresholds', () => {
    expect(EPS).toBe(1e-4);
    expect(STRONG).toBe(5e-4);
  });

  it('fires-as-declared: should && delta > eps -> ✅', () => {
    expect(statusOf(true, 0.01, null)).toBe('✅');
  });

  it('strong false-render: !should && delta > STRONG -> 🔴F (keeps the F suffix)', () => {
    expect(statusOf(false, 0.001, null)).toBe('🔴F');
  });

  it('faint false-render: !should && eps < delta <= STRONG -> ⚠️F', () => {
    expect(statusOf(false, 2e-4, null)).toBe('⚠️F');
  });

  it('dead-render: should && delta <= eps -> ⚠️D', () => {
    expect(statusOf(true, 0, null)).toBe('⚠️D');
  });

  it('correctly inert: !should && delta <= eps -> ·', () => {
    expect(statusOf(false, 0, null)).toBe('·');
  });

  it('degenerate WINS over the delta tier (⬛), even on a high delta', () => {
    expect(statusOf(true, 0.5, 'black')).toBe('⬛');
    expect(statusOf(false, 0.001, 'blown')).toBe('⬛');   // would be 🔴F without degen
  });

  // ── boundary edges: report uses `> eps` and `> STRONG` (strict >) ──
  it('delta exactly === eps is NOT a render (<= eps): inert when !should, dead when should', () => {
    expect(statusOf(false, EPS, null)).toBe('·');     // EPS is not > EPS
    expect(statusOf(true, EPS, null)).toBe('⚠️D');
  });

  it('delta exactly === STRONG is faint, not strong (STRONG is not > STRONG)', () => {
    expect(statusOf(false, STRONG, null)).toBe('⚠️F');
  });

  it('delta just above STRONG is strong false', () => {
    expect(statusOf(false, STRONG + 1e-9, null)).toBe('🔴F');
  });
});
