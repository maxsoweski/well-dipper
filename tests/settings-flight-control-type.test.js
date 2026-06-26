// Settings persistence for the "Flight control type" key.
// §supercruise-flight-toggle-settings-design-2026-06-25 (§3): F is a 2-state
// flight on/off toggle; the *type* of flight control (Manual / Align-on-select
// / Assist) lives in Settings and is read by main.js on each F-on engage. The
// stored value is one of the FlightMode enum strings verbatim ('manual' /
// 'align' / 'assist') so main.js's map to FlightMode is an identity.
//
// What these tests pin (and the spec's AC2 + "absent key → Manual, no
// migration" requirement):
//   - default is 'manual' on a fresh (empty localStorage) Settings,
//   - a chosen value persists across a reload (new Settings instance reads it),
//   - an absent key falls back to 'manual' (no migration clobber),
//   - a corrupt/non-string stored value is rejected by the typeof guard and
//     falls back to the 'manual' default.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Settings } from '../src/ui/Settings.js';
import { FlightMode } from '../src/flight/flightModes.js';

const STORAGE_KEY = 'well-dipper-settings';

// Minimal in-memory localStorage stand-in (jsdom-free; matches how Settings
// touches localStorage: getItem / setItem only).
function makeLocalStorage(seed = {}) {
  const store = { ...seed };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _raw: store, // test introspection
  };
}

describe('Settings — flightControlType persistence (§supercruise-flight-toggle)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorage());
  });

  it('defaults to Manual on a fresh Settings (empty storage)', () => {
    const s = new Settings();
    expect(s.get('flightControlType')).toBe('manual');
    // The stored string is the FlightMode.MANUAL enum value verbatim.
    expect(s.get('flightControlType')).toBe(FlightMode.MANUAL);
  });

  it('persists a chosen value across a reload (new instance reads it)', () => {
    const s1 = new Settings();
    s1.set('flightControlType', FlightMode.ASSIST); // 'assist'
    // Simulate a page reload: a brand-new Settings over the SAME storage.
    const s2 = new Settings();
    expect(s2.get('flightControlType')).toBe('assist');
  });

  it('round-trips every valid enum value', () => {
    for (const value of [FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST]) {
      vi.stubGlobal('localStorage', makeLocalStorage());
      const s1 = new Settings();
      s1.set('flightControlType', value);
      const s2 = new Settings();
      expect(s2.get('flightControlType')).toBe(value);
    }
  });

  it('writes the value into the SAME settings object under the shared storage key', () => {
    const ls = makeLocalStorage();
    vi.stubGlobal('localStorage', ls);
    const s = new Settings();
    s.set('flightControlType', FlightMode.ALIGN);
    const saved = JSON.parse(ls._raw[STORAGE_KEY]);
    expect(saved.flightControlType).toBe('align');
    // It coexists with the other settings in the one blob (not a separate key).
    expect(Object.keys(ls._raw)).toEqual([STORAGE_KEY]);
  });

  it('absent key falls back to Manual — no migration clobber of other settings', () => {
    // Storage has settings but NOT flightControlType (the existing-user case).
    const ls = makeLocalStorage({
      [STORAGE_KEY]: JSON.stringify({ pixelScale: 2, colorPalette: 3 }),
    });
    vi.stubGlobal('localStorage', ls);
    const s = new Settings();
    expect(s.get('flightControlType')).toBe('manual'); // default applied
    expect(s.get('pixelScale')).toBe(2);               // other keys preserved
    expect(s.get('colorPalette')).toBe(3);
  });

  it('rejects a non-string stored value (typeof guard) and keeps Manual', () => {
    const ls = makeLocalStorage({
      [STORAGE_KEY]: JSON.stringify({ flightControlType: 7 }),
    });
    vi.stubGlobal('localStorage', ls);
    const s = new Settings();
    expect(s.get('flightControlType')).toBe('manual');
  });

  it('reset() returns flightControlType to Manual', () => {
    const s = new Settings();
    s.set('flightControlType', FlightMode.ASSIST);
    s.reset();
    expect(s.get('flightControlType')).toBe('manual');
  });
});
