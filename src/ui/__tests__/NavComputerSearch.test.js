import { describe, it, expect } from 'vitest';
import { NavComputer } from '../NavComputer.js';

/**
 * Increment 4 / AC2 — NavComputer search UI unit coverage.
 *
 * The vitest environment here is the default `node` environment (no jsdom /
 * happy-dom — see vite.config.js, which sets no `test.environment`), so we
 * cannot construct a NavComputer (its ctor needs a real <canvas>) or dispatch
 * synthetic DOM keydown events. The `_searchFocused` keyboard guard and the DOM
 * search overlay are therefore covered by the live chrome-devtools pass, not
 * here. What IS assertable headlessly is the static spectral-color table.
 */
describe('NavComputer._SPECTRAL_COLORS (design D7)', () => {
  it("includes the 'D' white-dwarf swatch", () => {
    expect(NavComputer._SPECTRAL_COLORS.D).toBe('#e8f0ff');
  });

  it('preserves the pre-existing spectral swatches (no regressions)', () => {
    const c = NavComputer._SPECTRAL_COLORS;
    for (const k of ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'Kg', 'Gg', 'Mg']) {
      expect(typeof c[k]).toBe('string');
      expect(c[k]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
