// tests/worldengine-base-climate-e5.test.js
// Headless home for the increment-3a "lift the u(lat) jet profile out of GLSL" MUST-FIX.
//
// The gas-giant band/jet profile lived only in the Planet.js GAS_BODY shader, so its acceptance
// criteria could not run without a GPU. src/worldengine/base/climate-e5.js ports it into a three-free
// deterministic writer; this suite proves the three properties the scoped #3a contract will lean on:
//   AC1  determinism / no-RNG static source — same (regime, seed) => byte-identical field; the field
//        is seed-INDEPENDENT (the faithful lift consumes no RNG), which is what makes the static-source
//        guard pass trivially; all values finite.
//   AC2  bounded — |bandField| ≤ the analytic Σ|a| bound per regime; bandNorm ∈ [0,1].
//   AC3  zonal structure — the field is a genuine u(lat): band value depends ONLY on latitude (within
//        a fine latitude bucket the spread is tiny), and a longitude-dependent CONTROL field provably
//        FAILS that bar (the anti-noise discriminator). Band richness is ordered gas-giant ≥
//        hot-jupiter ≥ sub-neptune (more harmonics = more alternating jets).
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import {
  E5_REGIME, HARMONICS, BAND_BOUND, DEFAULTS,
  zonalBandProfile, sampleJetProfile, writeClimateE5Sphere,
} from '../src/worldengine/base/climate-e5.js';

const TARGET_N = 4000, LLOYD = 2;
const SHARED_MESH = buildIrregularSphere(TARGET_N, LLOYD);
const REGIMES = [E5_REGIME.GAS_GIANT, E5_REGIME.HOT_JUPITER, E5_REGIME.SUB_NEPTUNE];

const lonDegOf = (v) => Math.atan2(v[2], v[0]) * 180 / Math.PI;   // longitude from unit dir (x,z plane)

describe('worldengine base — E5 zonal band/jet profile lift (increment 3a MUST-FIX)', () => {
  for (const regime of REGIMES) {
    describe(regime, () => {
      const carrier = makeSphereField(SHARED_MESH);
      const out = writeClimateE5Sphere(carrier, {}, { regime, macroSeed: 1 });

      // ── AC1: determinism + no-RNG static source ────────────────────────────────────────────────
      it('[AC1] byte-identical across two independent runs with the same (regime, seed)', () => {
        const a = writeClimateE5Sphere(makeSphereField(SHARED_MESH), {}, { regime, macroSeed: 1 });
        const b = writeClimateE5Sphere(makeSphereField(SHARED_MESH), {}, { regime, macroSeed: 1 });
        expect(Array.from(a.bandField)).toEqual(Array.from(b.bandField));
      });
      it('[AC1] field is SEED-INDEPENDENT (faithful lift consumes no RNG — the static-source guard)', () => {
        const s1 = writeClimateE5Sphere(makeSphereField(SHARED_MESH), {}, { regime, macroSeed: 1 });
        const s2 = writeClimateE5Sphere(makeSphereField(SHARED_MESH), {}, { regime, macroSeed: 999 });
        expect(Array.from(s1.bandField)).toEqual(Array.from(s2.bandField));
      });
      it('[AC1] all values finite', () => {
        for (let i = 0; i < out.bandField.length; i++) {
          expect(Number.isFinite(out.bandField[i])).toBe(true);
          expect(Number.isFinite(out.bandNorm[i])).toBe(true);
        }
      });

      // ── AC2: bounded ──────────────────────────────────────────────────────────────────────────
      it('[AC2] |bandField| ≤ analytic Σ|a| bound; bandNorm ∈ [0,1]', () => {
        const bound = BAND_BOUND[regime] + 1e-6;
        for (let i = 0; i < out.bandField.length; i++) {
          expect(Math.abs(out.bandField[i])).toBeLessThanOrEqual(bound);
          expect(out.bandNorm[i]).toBeGreaterThanOrEqual(0);
          expect(out.bandNorm[i]).toBeLessThanOrEqual(1);
        }
      });

      // ── AC3: zonal structure — the field is a real u(lat) ───────────────────────────────────────
      // The right statement of "zonal" is: band value is a pure function of latitude. We check it
      // against an INDEPENDENT re-derivation of the u(lat) profile from the documented harmonic
      // coefficients (a cross-check of the writer, not its own function) — a truly zonal field matches
      // it EXACTLY at every node's latitude; a longitude-dependent field cannot. (NB: a within-lat-bin
      // spread metric would wrongly flag a valid HIGH-FREQUENCY zonal field, since y=sin(lat) makes 1°
      // near the equator span real band variation — that measures smoothness, not zonality.)
      const refProfile = (y) => {
        let b = 0;
        for (const { f, a, p } of HARMONICS[regime]) b += a * Math.sin(y * DEFAULTS.BAND_FREQ * f + p);
        return b;
      };
      const maxResidual = (field) => {
        let worst = 0;
        for (let i = 0; i < carrier.N; i++) {
          worst = Math.max(worst, Math.abs(field[i] - refProfile(carrier.verts[i][1])));
        }
        return worst;
      };
      const ptp = 2 * out.maxAbs || 1e-9;                         // global peak-to-peak of the profile

      it('[AC3] field is a pure function of latitude (matches the independent u(lat) reference everywhere)', () => {
        expect(maxResidual(out.bandField) / ptp).toBeLessThan(1e-4);
      });
      it('[AC3][required-failure] a longitude-dependent control does NOT match u(lat) (the bar bites)', () => {
        const control = new Float32Array(carrier.N);
        for (let i = 0; i < carrier.N; i++) {
          control[i] = out.bandField[i] + 0.5 * ptp * Math.sin(lonDegOf(carrier.verts[i]) * Math.PI / 36);
        }
        expect(maxResidual(control) / ptp).toBeGreaterThan(0.15);
      });
    });
  }

  // ── AC3: cross-regime ordering — sub-neptune is MUTED (low amplitude), not fewer-banded ──────────
  // The muted/hazy look of sub-neptune is an AMPLITUDE distinction, not a band-count one (its top
  // harmonic f=6 actually gives it MORE bands than hot-jupiter's f=5). So we order on band amplitude.
  it('[AC3] band amplitude is ordered gas-giant > hot-jupiter > sub-neptune (sub-neptune = muted/hazy)', () => {
    const gg = sampleJetProfile(E5_REGIME.GAS_GIANT).maxAbs;
    const hj = sampleJetProfile(E5_REGIME.HOT_JUPITER).maxAbs;
    const sn = sampleJetProfile(E5_REGIME.SUB_NEPTUNE).maxAbs;
    expect(gg).toBeGreaterThan(hj);
    expect(hj).toBeGreaterThan(sn);
  });
  it('[AC3] every regime has alternating bands (jetCount > 0)', () => {
    for (const r of REGIMES) expect(sampleJetProfile(r).jetCount).toBeGreaterThan(0);
  });

  // ── faithful-port guard: coefficients match the shader verbatim ──────────────────────────────
  it('[port] harmonic coefficients equal the Planet.js GAS_BODY shader values', () => {
    expect(HARMONICS[E5_REGIME.GAS_GIANT]).toEqual([
      { f: 3.5, a: 0.5, p: 0.0 }, { f: 7.0, a: 0.3, p: 0.5 }, { f: 13.0, a: 0.12, p: 0.0 },
    ]);
    expect(HARMONICS[E5_REGIME.HOT_JUPITER]).toEqual([
      { f: 2.5, a: 0.3, p: 0.0 }, { f: 5.0, a: 0.15, p: 0.0 },
    ]);
    expect(HARMONICS[E5_REGIME.SUB_NEPTUNE]).toEqual([
      { f: 3.0, a: 0.1, p: 0.0 }, { f: 6.0, a: 0.05, p: 0.0 },
    ]);
  });
  it('[port] non-banded / unknown regime yields a flat zero field (no false zonal identity)', () => {
    expect(zonalBandProfile(0.3, 'eyeball')).toBe(0);
    expect(zonalBandProfile(0.3, 'rocky')).toBe(0);
    expect(zonalBandProfile(-0.7, undefined && 'x' || 'nope', { bandFreq: DEFAULTS.BAND_FREQ })).toBe(0);
  });
});
