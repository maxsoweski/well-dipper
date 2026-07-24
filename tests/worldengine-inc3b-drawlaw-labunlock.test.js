// tests/worldengine-inc3b-drawlaw-labunlock.test.js — Inc-3b S1.5 (R3): LAB-only Moon/Mercury radius unlock.
//
// Covers (BUILD-PLAN §1.S1 test list; contract AC-REROLL enablement, §6-T1 opt-in resolution):
//   • FLAGLESS CANONICAL — drawPresetRadius('Moon/Mercury', seed) with NO flag returns the canonical 0.38 R⊕,
//     seed-invariant. Moon/Mercury STAYS in NAMED_BODY, so every headless/test/probe caller (which omits the
//     flag) keeps canonical — the hard constraint "headless/test paths keep canonical radius."
//   • LAB-UNLOCK DRAW — with { labUnlock: true } the draw lands STRICTLY inside [0.27, 0.38) and VARIES across
//     seeds (the R3 lab re-roll variety).
//   • OTHER PRESETS UNCHANGED — the flag only touches presets in LAB_UNLOCKED_RANGES (Moon/Mercury); every
//     other preset's draw is BIT-IDENTICAL with or without the flag (R3 "must not disturb other presets").
import { describe, it, expect } from 'vitest';
import { DRIVER_PRESETS, PRESET_ARCHETYPE, NAMED_BODY, LAB_UNLOCKED_RANGES, drawPresetRadius } from '../driver-presets.js';
import { RADIUS_RANGES_EARTH } from '../src/core/ScaleConstants.js';

const MOON = 'Moon/Mercury (impact-airless)';
const [LO, HI] = LAB_UNLOCKED_RANGES[MOON];   // [0.27, 0.38]
const SEEDS = [0, 1, 2, 3, 7, 42, 999, 65535, 4294967295];

describe('Inc-3b S1.5 — LAB_UNLOCKED_RANGES has its OWN Moon/Mercury entry (not the archetype table)', () => {
  it('exports the [0.27, 0.38] band for Moon/Mercury and it is not sourced from PRESET_ARCHETYPE/RADIUS_RANGES_EARTH', () => {
    expect(LAB_UNLOCKED_RANGES[MOON]).toEqual([0.27, 0.38]);
    expect(PRESET_ARCHETYPE[MOON]).toBeUndefined();   // Moon/Mercury is archetype-null (the §0.4 code fact)
  });
  it('Moon/Mercury STAYS in NAMED_BODY (the headless/test/goldens canonical lock)', () => {
    expect(NAMED_BODY.has(MOON)).toBe(true);
  });
});

describe('Inc-3b R3 — flagless drawPresetRadius keeps Moon/Mercury canonical', () => {
  const canonical = DRIVER_PRESETS[MOON].radiusEarth ?? 1.0;
  it('returns the canonical radius, seed-invariant, when the flag is omitted (headless/test/probe path)', () => {
    for (const seed of SEEDS) {
      expect(drawPresetRadius(MOON, seed), `flagless @ ${seed}`).toBe(canonical);
      // an explicit labUnlock:false is identical to omitting it
      expect(drawPresetRadius(MOON, seed, { labUnlock: false }), `labUnlock:false @ ${seed}`).toBe(canonical);
    }
  });
});

describe('Inc-3b R3 — labUnlock:true draws Moon/Mercury inside [0.27, 0.38) and varies across seeds', () => {
  it('every draw lands strictly inside the band', () => {
    for (const seed of SEEDS) {
      const r = drawPresetRadius(MOON, seed, { labUnlock: true });
      expect(r, `draw @ ${seed} >= lo`).toBeGreaterThanOrEqual(LO);
      expect(r, `draw @ ${seed} < hi`).toBeLessThan(HI);   // alea() ∈ [0,1) ⇒ draw ∈ [lo, hi)
    }
  });
  it('is deterministic per seed but varies across seeds', () => {
    for (const seed of SEEDS) {
      expect(drawPresetRadius(MOON, seed, { labUnlock: true })).toBe(drawPresetRadius(MOON, seed, { labUnlock: true }));
    }
    const draws = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => drawPresetRadius(MOON, s, { labUnlock: true }));
    expect(new Set(draws.map((r) => r.toFixed(12))).size, 'draws vary across seeds').toBeGreaterThan(1);
  });
});

describe('Inc-3b R3 — the flag does NOT disturb any other preset (bit-identical with/without)', () => {
  it('every non-Moon/Mercury preset draws identically with or without labUnlock', () => {
    for (const name of Object.keys(DRIVER_PRESETS)) {
      if (name === MOON) continue;
      for (const seed of [0, 1, 7, 42, 4294967295]) {
        expect(
          drawPresetRadius(name, seed, { labUnlock: true }),
          `${name} @ ${seed} unaffected by labUnlock`,
        ).toBe(drawPresetRadius(name, seed));
      }
    }
  });

  it('archetype presets still draw inside their RADIUS_RANGES_EARTH band under the flag (unchanged law)', () => {
    const drawn = Object.keys(PRESET_ARCHETYPE).filter((n) => !NAMED_BODY.has(n) && RADIUS_RANGES_EARTH[PRESET_ARCHETYPE[n]]);
    for (const name of drawn) {
      const [lo, hi] = RADIUS_RANGES_EARTH[PRESET_ARCHETYPE[name]];
      for (const seed of [1, 17, 256]) {
        const r = drawPresetRadius(name, seed, { labUnlock: true });
        expect(r).toBeGreaterThanOrEqual(lo);
        expect(r).toBeLessThan(hi);
      }
    }
  });
});
