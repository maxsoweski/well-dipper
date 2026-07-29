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
  reliefEnvelope, reliefGravityFactor, Q_RELIEF, Q_RELIEF_DERIVED, RELIEF_FLOOR, RELIEF_CEIL,
} from '../planet-lod-lab-core.js';
import { GRAV_R_EXP_SUPER } from '../body-condition-vector.js';

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
// ≈54.95408738576244 — the g-floored cap = most-extreme real body. The 0.58 is HAND-DUPLICATED, not
// -Q_RELIEF: a bound derived from the constant it bounds moves with it and stops being a bound. g =
// 1e-3 is far BELOW the v2 seam at g = 1, so this rides the calibrated branch and is unchanged by
// the v2 relief law.
const PHOBOS_MULT = Math.pow(1e-3, -0.58);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('Inc-3 AC-ENVELOPE — exported constants match the calibration (relief-envelope.mjs)', () => {
  it('Q_RELIEF / RELIEF_FLOOR / RELIEF_CEIL are the calibration-solved constants', () => {
    expect(Q_RELIEF).toBe(0.58);       // 2-sig-fig least-squares fit through the distributed-relief anchors
    // v2 relief law 2026-07-28: no longer a physics clamp. It is a degenerate-safety guard — on the
    // rocky curve it first binds at R = 5.0236 / g = 15.5499 / M = 392.4 M⊕, and it binds on no
    // seeded draw of any preset (worst is Jovian at R ≈ 13.99 → 0.14459, clearing it by 14.46x).
    expect(RELIEF_FLOOR).toBe(0.01);
    expect(RELIEF_CEIL).toBe(133);     // apparent-0.40 ceiling as a multiplier (documentation constant)
    expect(Q_RELIEF_DERIVED).toBe(1.678235294117647);   // hand-duplicated literal
    expect(GRAV_R_EXP_SUPER).toBe(1.70);                // hand-duplicated literal
    // the COUPLING, written from literals only so a joint retune of either constant fails here:
    expect(Q_RELIEF_DERIVED).toBe(1.09 + 1 / 1.70);     // Guimond slope / rocky super exponent
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

  it('FLOOR is a degenerate-safety guard, not a physics clamp: it first binds past g ≈ 15.55', () => {
    // hand-computed from the shipped law, NOT read back from it:
    //   0.01^(-1/1.678235294117647) = 15.549914506203871  →  R = 5.0236 / M = 392.4 M⊕ on the rocky curve
    expect(reliefEnvelope(1, 20)).toBe(0.01);
    expect(reliefEnvelope(1, 16)).toBe(0.01);
    expect(reliefEnvelope(1, 15)).toBe(0.010622876683111848);
    expect(reliefEnvelope(1, 10)).toBe(0.02097803018046096);
    expect(reliefEnvelope(1, 3)).toBe(0.15822615361106382);
  });

  it('CEIL never binds — the internal g-floor caps the multiplier well under RELIEF_CEIL', () => {
    // sweep degenerate/near-zero g: all land at the ~55 g-floor cap, never RELIEF_CEIL (133).
    for (const g of [1e-3, 1e-4, 1e-9, 0]) {
      expect(reliefEnvelope(1, g)).toBeLessThan(RELIEF_CEIL);
      expect(reliefEnvelope(1, g)).toBeCloseTo(PHOBOS_MULT, 6);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// v2 relief law (world-engine-v2-relief-law-2026-07-28) — the g = 1 SEAM.
// "Calibration below, derivation above": a DATA boundary, not a physical transition. Every expected
// value below is a HAND-WRITTEN LITERAL — read once off the shipped build and transcribed, never
// recomputed from the constants under test, so perturbing Q_RELIEF / Q_RELIEF_DERIVED / RELIEF_FLOOR
// makes these FAIL rather than move with the code (mutation-verified at build time).
describe('v2 seam — calibration below g = 1, derivation above', () => {
  it('(AC-SEAM) every measured body below the seam is BIT-IDENTICAL to the shipped build', () => {
    // (R, g) pairs read off the real presets via deriveConditionVector; the expected multipliers are
    // the shipped g^-0.58 values. All five sit below g = 1, so the v2 law must not move any of them.
    expect(reliefEnvelope(0.27, 0.1756303990741334)).toBe(2.7424087181502013);   // Moon/Mercury @ R=0.27
    expect(reliefEnvelope(0.38, 0.2770083102493075)).toBe(2.1054948190870233);   // Moon/Mercury canonical
    expect(reliefEnvelope(0.53, 0.38091847632609466)).toBe(1.7503198484819087);  // Mars canonical
    expect(reliefEnvelope(0.40, 0.15624999999999997)).toBe(2.9348396980002267);  // Titan canonical
    expect(reliefEnvelope(0.95, 0.9030470914127423)).toBe(1.0609330264979282);   // Venus canonical
    expect(reliefEnvelope(1.00, 0.9)).toBe(1.0630148818083676);                  // Rocky (Earthlike) canonical
    // (AC-NOWAVES) nowhere near the 24.666 the UNAMENDED (no-seam, Earth-anchored g^-1.09/R) law
    // would have produced at R = 0.27 — 3.5x the 7.0x that was rejected as "molten waves".
    expect(reliefEnvelope(0.27, 0.1756303990741334)).toBeLessThan(3);
  });

  it('(AC-CONTINUOUS) the seam is continuous at every reachable radius, for ANY radius', () => {
    // Math.pow(1, ±anything) === 1, so the two branches meet at exactly 1 independently of R. The
    // radii include the seam radii of the presets whose seeded draw bands straddle g = 1 (Jovian
    // 4.4208, Saturnian 8.7246) plus the rocky sub-branch corner at 0.92.
    for (const R of [0.27, 0.92, 1.0, 1.5, 4.4208, 8.7246, 14]) {
      expect(reliefEnvelope(R, 1)).toBe(1);
      expect(reliefEnvelope(R, 1 - 1e-9) / reliefEnvelope(R, 1 + 1e-9)).toBeCloseTo(1, 8);
    }
  });

  it('the DERIVED branch is pinned above the seam', () => {
    expect(reliefEnvelope(1, 2)).toBe(0.3124646105577125);
    expect(reliefEnvelope(1, 2)).toBe(Math.pow(2, -1.678235294117647));
  });

  it('(AC-LAW) absolute relief h = E*R follows g^-1.09 on the rocky super-Earth branch', () => {
    // On the synthetic Earth-anchored curve g = R^1.70 (R_c = 1, g_c = 1), log(E*R)/log(g) IS the
    // delivered absolute exponent — no log-log fit needed. The 1.70 is hand-duplicated from
    // GRAV_R_EXP_SUPER; the pin above asserts they agree.
    for (const R of [1.02, 1.05, 1.2, 1.5, 2, 3, 4]) {
      const g = Math.pow(R, 1.70);
      expect(Math.log(reliefEnvelope(R, g) * R) / Math.log(g)).toBeCloseTo(-1.09, 9);
    }
  });

  it('the DECLARED RESIDUAL is pinned so it cannot silently change', () => {
    // Non-rocky classes keep the linear radius-gravity ratio (their g goes as R^1, not R^1.70),
    // so they receive an absolute exponent of -0.678235294117647, not -1.09. That is
    // body-condition-vector.js's declared non-rocky debt surfacing here, NOT a defect in this
    // function: no two-argument (R, g) form can repair it and stay continuous at the seam.
    for (const R of [2, 3, 5]) {
      expect(Math.log(reliefEnvelope(R, R) * R) / Math.log(R)).toBeCloseTo(-0.678235294117647, 9);
    }
  });
});

describe('Inc-3 AC-ENVELOPE + AC-0 — radius flows via g ONLY (the footnote-14 double-dip is gone)', () => {
  it('reliefEnvelope return is INDEPENDENT of radiusEarth at fixed g (no explicit 1/RE term)', () => {
    // The whole convicted defect was the uncapped explicit 1/RE. The replacement must not read R:
    // hold g fixed, vary R across five orders of magnitude — the multiplier must not move.
    // v2: the g list spans BOTH branches (12 and 2.5 are above the seam, 1.0 is on it) so this is a
    // statement about the adopted form as a whole, not just its calibrated half.
    for (const g of [12, 2.5, 1.0, 0.28, 0.00648]) {
      const base = reliefEnvelope(1, g);
      for (const R of [1e-3, 0.03, 0.27, 1.0, 16, 1e3]) {
        expect(reliefEnvelope(R, g)).toBe(base);
      }
    }
  });
});
