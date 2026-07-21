// tests/worldengine-inc3-relief-envelope.test.js — World Engine Inc-3 SLICE-1 (relief-scale envelope).
// Unit gate for AC-ENVELOPE + AC-0 (the pure-math half; the lab-side uPerturb rewire is verified by
// the S3 population-sweep multiplier gate + the coordinator's live AC-LAB-READ — .html is not
// unit-testable here). The DERIVED replacement for the retired reliefNorm's uncapped (1/RE) term is
//   reliefEnvelope(radiusEarth, surfaceGravity) = clamp(g^-Q_RELIEF, RELIEF_FLOOR, RELIEF_CEIL)
// with the constants SOLVED in the workstream's calibration/relief-envelope.mjs (least squares
// through the real-body relief/radius anchors, forced Earth=1). This file pins the exported
// constants to that calibration output and reproduces its "new×" multiplier column, so a drift in
// either code or calibration is caught. reliefEnvelope reads ONLY surfaceGravity (a derived condition
// scalar) — no label/regime reads — satisfying the AC-0 driver-connectivity discipline structurally.
import { describe, it, expect } from 'vitest';
import {
  reliefEnvelope, reliefGravityFactor, Q_RELIEF, RELIEF_FLOOR, RELIEF_CEIL,
} from '../planet-lod-lab-core.js';

// The old (retired) lab law, reconstructed from its documented closed form for the collapse proof:
//   reliefNorm(RE, g) = (1/RE)·reliefGravityFactor(g)  (heightKm cancelled in here/ref).
const reliefNormOld = (RE, g) => (1 / Math.max(RE, 1e-6)) * reliefGravityFactor(g);

// Calibration output (calibration/relief-envelope.mjs "new×" column, full precision) — the
// cross-check reference. Phobos g=0.00058 sits below the 1e-3 g-floor, so it floors to
// (1e-3)^-0.58 ≈ 54.954. Compared with a RELATIVE tolerance (magnitude-independent).
const ANCHORS = [
  { name: 'Earth',   R: 1.0,     g: 1.0,      mult: 1.0     },
  { name: 'Mercury', R: 0.383,   g: 0.377,    mult: 1.76074 },
  { name: 'Mars',    R: 0.532,   g: 0.379,    mult: 1.75534 },
  { name: 'Moon',    R: 0.273,   g: 0.165,    mult: 2.84335 },
  { name: 'Mimas',   R: 0.0311,  g: 0.00648,  mult: 18.5903 },
  { name: 'Vesta',   R: 0.0412,  g: 0.0255,   mult: 8.39494 },
  { name: 'Phobos',  R: 0.00174, g: 0.00058,  mult: 54.9541 }, // g-floored ⇒ strength ceiling ~55
];
const WORKED = { R: 0.27, g: 0.28 }; // math-check convicted worked point (Moon/Mercury draw)
const PHOBOS_MULT = Math.pow(1e-3, -Q_RELIEF); // ≈54.95 — the g-floored cap = most-extreme real body

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('Inc-3 AC-ENVELOPE — exported constants match the calibration (relief-envelope.mjs)', () => {
  it('Q_RELIEF / RELIEF_FLOOR / RELIEF_CEIL are the calibration-solved constants', () => {
    expect(Q_RELIEF).toBe(0.58);       // 2-sig-fig least-squares fit through the distributed-relief anchors
    expect(RELIEF_FLOOR).toBe(0.40);   // inherited from the reliefGravityFactor floor
    expect(RELIEF_CEIL).toBe(133);     // apparent-0.40 ceiling as a multiplier (documentation constant)
  });

  it('reliefEnvelope reproduces the calibration "new×" multiplier column at every anchor', () => {
    for (const a of ANCHORS) {
      const got = reliefEnvelope(a.R, a.g);
      expect(Math.abs(got / a.mult - 1)).toBeLessThan(1e-3); // within 0.1% of the published column (5-sig-fig ref)
    }
  });
});

describe('Inc-3 AC-ENVELOPE — the worked-case collapse (the convicted defect)', () => {
  it('the old (1/RE)·gCap law reads 7.0× at the worked point', () => {
    expect(reliefNormOld(WORKED.R, WORKED.g)).toBeCloseTo(7.0, 1);
  });

  it('reliefEnvelope collapses the worked point 7.0× → 2.09× (≈3.35× reduction), sign preserved', () => {
    const now = reliefEnvelope(WORKED.R, WORKED.g);
    expect(now).toBeCloseTo(2.09, 2);
    const collapse = reliefNormOld(WORKED.R, WORKED.g) / now;
    expect(collapse).toBeCloseTo(3.35, 1);
    // sign kept: the new multiplier is still ABOVE the reference (lower g ⇒ more relief), just bounded.
    expect(now).toBeGreaterThan(reliefEnvelope(1, 1));
  });
});

describe('Inc-3 AC-ENVELOPE — anchors ordered + multiplier bounded ≤ the Phobos extreme', () => {
  it('multiplier is monotonically non-decreasing as g falls (sign discipline)', () => {
    const gs = [3, 1, 0.5, 0.377, 0.28, 0.165, 0.0255, 0.00648, 0.001, 1e-6];
    let prev = -Infinity;
    for (const g of gs) {
      const m = reliefEnvelope(1, g);
      expect(m).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = m;
    }
  });

  it('no draw exceeds the most-extreme real body (multiplier ≤ the g-floored Phobos cap ~55)', () => {
    for (const a of ANCHORS) {
      expect(reliefEnvelope(a.R, a.g)).toBeLessThanOrEqual(PHOBOS_MULT + 1e-9);
    }
    // even a degenerate g→0 draw is capped by the g-floor, NOT by RELIEF_CEIL:
    expect(reliefEnvelope(0.001, 0)).toBeCloseTo(PHOBOS_MULT, 6);
    expect(reliefEnvelope(0.001, 0)).toBeLessThan(RELIEF_CEIL);
  });
});

describe('Inc-3 AC-ENVELOPE — clamps behave; reference is a no-op (byte-safe at Earth)', () => {
  it('Earth (RE=1, g=1) returns exactly 1.0 — the envelope is a no-op at the reference draw', () => {
    expect(reliefEnvelope(1, 1)).toBe(1);
  });

  it('FLOOR binds only for high-g worlds (g ≳ 4.85); a 10-g world clamps to RELIEF_FLOOR', () => {
    expect(reliefEnvelope(1, 10)).toBe(RELIEF_FLOOR);
    // just above the crossover g ≈ 4.854 the floor is reached; just below it the law is still live:
    expect(reliefEnvelope(1, 3)).toBeGreaterThan(RELIEF_FLOOR);
  });

  it('CEIL never binds — the internal g-floor caps the multiplier well under RELIEF_CEIL', () => {
    // sweep degenerate/near-zero g: all land at the ~55 g-floor cap, never RELIEF_CEIL (133).
    for (const g of [1e-3, 1e-4, 1e-9, 0]) {
      expect(reliefEnvelope(1, g)).toBeLessThan(RELIEF_CEIL);
      expect(reliefEnvelope(1, g)).toBeCloseTo(PHOBOS_MULT, 6);
    }
  });
});

describe('Inc-3 AC-ENVELOPE + AC-0 — radius flows via g ONLY (the footnote-14 double-dip is gone)', () => {
  it('reliefEnvelope return is INDEPENDENT of radiusEarth at fixed g (no explicit 1/RE term)', () => {
    // The whole convicted defect was the uncapped explicit 1/RE. The replacement must not read R:
    // hold g fixed, vary R across five orders of magnitude — the multiplier must not move.
    for (const g of [1.0, 0.28, 0.00648]) {
      const base = reliefEnvelope(1, g);
      for (const R of [1e-3, 0.03, 0.27, 1.0, 16, 1e3]) {
        expect(reliefEnvelope(R, g)).toBe(base);
      }
    }
  });
});
