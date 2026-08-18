import { describe, it, expect } from 'vitest';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import { realStarSeed } from '../realStarSeed.js';
import { physicalStarMassSolar } from '../PhysicsEngine.js';
import { GravityField } from '../../physics/GravityField.js';

/**
 * Binary barycentre + pair period — the renderer's mass ratio must be the SAME
 * mass ratio gravity uses, and the pair must orbit on the same Kepler law as
 * every other body in the system.
 *
 * TWO DEFECTS THIS FILE PINS (both procgen-only; the authored/companionSpec
 * branch was already on the right law and must not move):
 *
 *  1. binaryMassRatio was DRAWN from a dice table (StarSystemGenerator.js:308-312)
 *     while GravityField.js:83,99 derives each star's mass as radiusSolar^1.25
 *     from the ACTUAL radii. The secondary then takes an INDEPENDENT ±15% radius
 *     jitter (:319), so the drawn q and the real masses had no relationship at
 *     all. The renderer splits the separation by the drawn q (main.js:7537-7538,
 *     :11180-11181), so the two stars were placed about a point that is not the
 *     barycentre gravity acts through — by up to 43% of the separation, i.e. up
 *     to 77.8 primary radii, while every planet orbits the scene origin.
 *
 *  2. binaryOrbitSpeed (:354) was `0.003 / (binarySeparation / 5)^1.5`, where
 *     `binarySeparation` is the MAP-UNIT quantity the code's own comment labels
 *     "map/HUD only" (:343). Feeding a map length into an angular-rate formula
 *     made procgen pairs revolve 41×–948× (median 283×) faster than Kepler —
 *     the same bug class the 2026-06-28 parked-ship planet-drift fix removed
 *     from planets (see the keplerOrbitSpeed docblock, :19-25).
 *
 * ⚠ WHICH ASSERTIONS FAIL ON THE UNFIXED TREE (verified against a52a2e2 with no
 *   source edits — 5 of 8 fail):
 *     · "q is the ratio GravityField itself computes"        → FAILS
 *       (q_new/q_old over 1046 procgen binaries in wd-0…wd-2999: min 0.113,
 *        median 1.152, max 9.383 — wd-10 alone is 5.66× off)
 *     · "the two stars straddle the true barycentre"         → FAILS
 *       (residual |Σ m·r| / (Σm · sep): median 0.080, max 0.435; fixed: 9.6e-17)
 *     · "the pair orbits on the planets' Kepler law"         → FAILS
 *       (period / a^1.5 is 1.05e-3 … 2.44e-2 unfixed; 0.999025073 exactly, fixed)
 *     · "binaryOrbitSpeed keys off binarySeparationAU alone" → FAILS
 *     · "a white-dwarf primary is not flung across"          → FAILS
 *   The remaining blocks PASS both before and after — they are the guards that
 *   the fix stayed inside its blast radius (RNG cadence, companion TYPE
 *   selection, the brightness ceiling, the authored branch).
 *
 * ⭐ NOT claimed here: that `keplerOrbitSpeed` is the exact two-body rate. It
 *   omits √(M₁+M₂), so the fixed pair still runs 0.139×–1.644× (median 0.777×) of
 *   the true relative-orbit rate, and the residual is SYSTEMATIC by spectral
 *   class (measured means: O+O 0.150, B+B 0.259, G+G 0.706, K+K 0.878,
 *   K+M 1.073, M+M 1.501). That term is missing from every planet and moon in
 *   the game too (:554), and circumbinary planets therefore share the pair's
 *   error EXACTLY — P_planet/P_pair = (a_p/a_b)^1.5 is currently RIGHT, and
 *   adding √M to the pair alone would break it by up to 7.2×. Filed as one
 *   coordinated change: docs/FEATURES/moon-formation-channel-model-PLAN-2026-08-15.md:73.
 */

const YEAR_S = 365.25 * 86400;

// keplerOrbitSpeed(a) = orb(0.00125 / (a/0.387)^1.5) = (0.00125·0.387^1.5/1510)/a^1.5,
// so speed·a^1.5 is this constant for EVERY body on the law. Inlined from
// StarSystemGenerator.js:31-33 + CelestialTime.js:60 so a change to either is loud.
const KEPLER_SPEED_TIMES_A15 = 1.9929642724514476e-7;

/** Every procgen binary in wd-0…wd-N (no galaxyContext → pure procgen branch). */
function procgenBinaries(n = 400) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const seed = `wd-${i}`;
    const sys = StarSystemGenerator.generate(seed);
    if (sys.isBinary && sys.star2) out.push({ seed, sys });
  }
  return out;
}

/** The masses GRAVITY actually uses — read out of GravityField, not re-derived. */
function gravityMasses(sys) {
  const gf = new GravityField(sys, {});
  return { m1: gf.bodies[0].mass, m2: gf.bodies[1].mass };
}

describe('binary mass ratio — the renderer and gravity must agree', () => {
  it('q is the ratio GravityField itself computes from the actual radii', () => {
    // Read gravity's masses out of GravityField rather than transcribing R^1.25
    // a third time — if GravityField's mass law ever moves, this reds instead of
    // silently staying green while the invariant it is named after breaks.
    const bins = procgenBinaries();
    expect(bins.length).toBeGreaterThan(50); // sanity: we really exercised binaries
    for (const { seed, sys } of bins) {
      const { m1, m2 } = gravityMasses(sys);
      expect(
        sys.binaryMassRatio,
        `${seed}: q=${sys.binaryMassRatio} but GravityField masses give ${m2 / m1} ` +
        `(r1=${sys.star.radiusSolar.toFixed(4)} r2=${sys.star2.radiusSolar.toFixed(4)})`,
      ).toBeCloseTo(m2 / m1, 12);
    }
  });

  it('the two stars straddle the true barycentre, so planets orbit the right point', () => {
    // The renderer's own split, main.js:7537-7538 / :11180-11181:
    //   primary  at +r1 = sep·q/(1+q),  secondary at -r2 = -sep/(1+q).
    // Weighted by gravity's masses that must sum to the scene origin — which is
    // where every planet's orbit is centred.
    // (r1 + r2 = sep identically for ANY q, so the inter-star distance — and the
    //  billboard/LOD switch at main.js:9444 that reads it — cannot move. That is
    //  algebra, not a testable behaviour, which is why there is no separate case.)
    for (const { seed, sys } of procgenBinaries()) {
      const { m1, m2 } = gravityMasses(sys);
      const sep = sys.binarySeparationScene;
      const q = sys.binaryMassRatio;
      const residual = Math.abs(m1 * (sep * q / (1 + q)) + m2 * (-sep / (1 + q)))
        / ((m1 + m2) * sep);
      expect(
        residual,
        `${seed}: barycentre off by ${(residual * 100).toFixed(2)}% of the separation ` +
        `(${(residual * sep / sys.star.radiusScene).toFixed(1)} primary radii)`,
      ).toBeLessThan(1e-9);
    }
  });
});

describe('binary pair period — the same Kepler law as the planets', () => {
  it('the pair orbits on the planets\' Kepler law, not the map-unit formula', () => {
    // ⚠ This band DELIBERATELY locks out the √(M₁+M₂) term. If the coordinated
    // mass-term change (moon-formation-channel-model-PLAN-2026-08-15.md:73) ever
    // lands, this reds on all 1046 binaries with ratios spanning 0.139–1.644.
    // That is the tripwire working: the pair must not gain the term alone.
    for (const { seed, sys } of procgenBinaries()) {
      const periodYr = (2 * Math.PI) / Math.abs(sys.binaryOrbitSpeed) / YEAR_S;
      const keplerYr = Math.pow(sys.binarySeparationAU, 1.5);
      const ratio = periodYr / keplerYr;
      expect(
        ratio,
        `${seed}: a=${sys.binarySeparationAU.toFixed(4)}AU sim=${periodYr.toExponential(3)}yr ` +
        `kepler=${keplerYr.toExponential(3)}yr → ${ratio > 1 ? '' : (1 / ratio).toFixed(0) + '× TOO FAST'}`,
      ).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThan(1.05);
    }
  });

  it('binaryOrbitSpeed keys off binarySeparationAU alone, never the map-unit value', () => {
    // `binarySeparation` (map/HUD units, :352) and `binarySeparationAU` are drawn
    // independently. speed·a^1.5 === const holds iff the speed is a function of
    // the AU value alone. Exact for every binary post-fix; 8.5e-5 at wd-1 before.
    // (Replaces an earlier draft that grouped systems by binarySeparationAU to 9dp
    //  looking for collisions — there are ZERO over 1200 seeds, so its only live
    //  assertion was `speed > 0`, which passes on the broken code too.)
    for (const { seed, sys } of procgenBinaries(1200)) {
      expect(
        sys.binaryOrbitSpeed * Math.pow(sys.binarySeparationAU, 1.5),
        `${seed}: speed·a^1.5 = ${(sys.binaryOrbitSpeed * Math.pow(sys.binarySeparationAU, 1.5)).toExponential(4)}`,
      ).toBeCloseTo(KEPLER_SPEED_TIMES_A15, 18);
    }
  });
});

describe('blast-radius guards — what the fix must NOT move', () => {
  // Captured from the UNFIXED tree at a52a2e2. Identical after the fix: the
  // recompute adds and removes no rng call, and sits BELOW _deriveCompanionType
  // (:314) so the drawn qRoll still selects the companion TYPE exactly as before.
  // A reviewer who "tidies" the recompute UP next to the qRoll dice reds this
  // block: doing so flips star2.type on ~30% of binaries.
  const PINS = [
    { seed: 'wd-1',  star: 'G', star2: 'G', planets: 5, moons: 2,  belts: 2 },
    { seed: 'wd-3',  star: 'G', star2: 'M', planets: 0, moons: 0,  belts: 0 },
    { seed: 'wd-5',  star: 'K', star2: 'M', planets: 5, moons: 7,  belts: 2 },
    { seed: 'wd-8',  star: 'F', star2: 'G', planets: 7, moons: 4,  belts: 2 },
    { seed: 'wd-10', star: 'M', star2: 'M', planets: 5, moons: 5,  belts: 1 },
    { seed: 'wd-13', star: 'A', star2: 'A', planets: 5, moons: 3,  belts: 0 },
    { seed: 'wd-14', star: 'K', star2: 'K', planets: 5, moons: 12, belts: 2 },
    { seed: 'wd-15', star: 'F', star2: 'K', planets: 7, moons: 7,  belts: 2 },
    { seed: 'wd-18', star: 'M', star2: 'M', planets: 4, moons: 2,  belts: 0 },
    { seed: 'wd-27', star: 'O', star2: 'O', planets: 4, moons: 5,  belts: 2 },
  ];

  it('the RNG stream and the companion TYPE selection are untouched', () => {
    for (const pin of PINS) {
      const sys = StarSystemGenerator.generate(pin.seed);
      const moons = (sys.planets || []).reduce((a, p) => a + (p.moons?.length || 0), 0);
      expect({
        seed: pin.seed,
        star: sys.star.type,
        star2: sys.star2?.type ?? null,
        planets: (sys.planets || []).length,
        moons,
        belts: (sys.asteroidBelts || []).length,
      }).toEqual(pin);
    }
  });

  it('the secondary is never rendered brighter than the primary', () => {
    // brightness2 = q^1.5 (:480-482) feeds the starBrightness2 shader uniform on
    // every planet and moon. Nothing downstream ceilings it — the shaders floor
    // starLight but never cap it (Planet.js:488-497) and there is no
    // renderer.toneMapping on the world pass (the only ACES curve,
    // RetroRenderer.js:788, is gated behind cockpitEnabled). Unclamped, the
    // corrected q pushes 288 of 1046 procgen binaries (27.5%) past 1.0, peaking
    // at 1.652 — and past 989 on a forced white-dwarf primary. brightness1 is
    // hardcoded 1.0 (:485), so 1.0 is the ceiling that keeps the shipped exposure
    // envelope [0.05, 1.0] exactly where it is today.
    // ⚠ NOT physics-neutral, and not claimed to be: all 288 pairs where it fires
    // are the SAME spectral type, so both stars share Teff and the true
    // L2/L1 = (R2/R1)². Unclamped q^1.5 is within a mean 1.2% of that; clipping
    // costs a mean 17.1% / worst 41.5% ratio error. Deliberate — the shipped
    // exposure envelope wins over a ratio nothing downstream reads.
    for (const { seed, sys } of procgenBinaries()) {
      const b2 = sys.starInfo.brightness2;
      expect(b2, `${seed}: brightness2=${b2}`).toBeGreaterThanOrEqual(0.05);
      expect(b2, `${seed}: brightness2=${b2} exceeds the primary's 1.0`).toBeLessThanOrEqual(1.0);
    }
  });

  it('a white-dwarf primary is not flung across the barycentre', () => {
    // ⭐ THE CASE THE SCOPING MISSED. Procgen cannot roll 'D', but a CATALOG star
    // whose spect normalizes to 'D' arrives with ctx.starTypeOverride='D' and NO
    // companionSpec (arrivalResolution.js:59, main.js:8183) — so forceBinary stays
    // null (:250-252) and the ordinary procgen roll runs. STAR_PROPERTIES.D has
    // radiusSolar 0.01, so R^1.25 gives 0.0032 M☉ against a real ~0.6; a BARE
    // R^1.25 ratio yields q = 74…81 at these two seeds and puts the WD at 98.8%
    // of the separation — the pair INVERTS. PhysicsEngine.js:1207-1229 already
    // owns this hazard and states the policy: such a move is "predicted and taken
    // in the window, not smuggled in". Hence physicalStarMassSolar in the
    // recompute — the identity for O–M, the guard for D.
    // ⚠ CONSEQUENCE, NAMED: for these systems q_render intentionally does NOT
    // equal GravityField's ratio, because GravityField.js:83,99 still uses the
    // known-wrong 0.0032 M☉. Closing that means changing GravityField's mass law,
    // which moves shipped authored systems and is a separate workstream.
    const map = new GalacticMap('well-dipper-galaxy-1');
    const CATALOG_D = [
      { name: '(unnamed HYG)', x: 8.00116,  y: 0.035707,  z: 0.006838 },
      { name: 'HD 15634',      x: 7.968284, y: -0.068134, z: -0.021006 },
    ];
    for (const s of CATALOG_D) {
      const ctx = map.deriveGalaxyContext({ x: s.x, y: s.y, z: s.z });
      ctx.starTypeOverride = StarSystemGenerator.normalizeSpectralClass('D');
      const sys = StarSystemGenerator.generate(String(realStarSeed(s.x, s.y, s.z)), ctx);
      expect(sys.isBinary, `${s.name} must still roll a companion`).toBe(true);
      expect(sys.star.type).toBe('D');
      const m1 = physicalStarMassSolar('D', Math.pow(sys.star.radiusSolar, 1.25));
      const m2 = physicalStarMassSolar(sys.star2.type, Math.pow(sys.star2.radiusSolar, 1.25));
      expect(sys.binaryMassRatio, `${s.name}`).toBeCloseTo(m2 / m1, 12);
      // The white dwarf is the heavier body, so it must sit INSIDE the midpoint.
      const r1frac = sys.binaryMassRatio / (1 + sys.binaryMassRatio);
      expect(r1frac, `${s.name}: WD at ${(r1frac * 100).toFixed(1)}% of the separation`)
        .toBeLessThan(0.5);
    }
  });

  it('the authored (companionSpec) branch is byte-identical', () => {
    // Fix (a) lives inside the procgen `else`; the authored branch derives its
    // own q at :337-339 and must not move. Sirius-shaped: A1V + DA2 @ 19.8 AU.
    const map = new GalacticMap('well-dipper-galaxy-1');
    const ctx = map.deriveGalaxyContext({ x: 8.0, y: 0.025, z: -0.001 });
    ctx.starTypeOverride = 'A';
    ctx.companionSpec = {
      kind: 'multiple',
      components: [{ class: 'A1V' }, { class: 'DA2', separationAU: 19.8 }],
    };
    const sys = StarSystemGenerator.generate('authored-sirius-test', ctx);
    expect(sys.isBinary).toBe(true);
    expect(sys.star2.type).toBe('D');
    expect(sys.binarySeparationAU).toBe(19.8);
    // Canonical STAR_PROPERTIES radii, clamped — the authored formula, unchanged.
    const m1 = Math.pow(StarSystemGenerator.STAR_PROPERTIES.A.radiusSolar, 1.25);
    const m2 = Math.pow(StarSystemGenerator.STAR_PROPERTIES.D.radiusSolar, 1.25);
    expect(sys.binaryMassRatio).toBeCloseTo(Math.min(m2 / m1, 1.0), 15);
    expect(sys.binaryOrbitSpeed).toBeCloseTo(2.26204753936182e-9, 20);
    // ⚠ KNOWN, OUT OF SCOPE: this branch is NOT gravity-consistent either — it
    // uses canonical table radii while GravityField reads the ±15%-varied ones
    // (Alpha Cen: q 0.640 vs gravity 0.752, centroid 3.9% off), and its D mass is
    // the same 190×-low estimate (authored Sirius q = 0.00152 where the real
    // value is ~0.288; its period comes out 88.0 yr against an observed 50.1).
    // Left alone deliberately: correcting it moves shipped real systems and reds
    // both overlay.test.js:121 and the two multistar-components-2026-07-19
    // byteSafety fixtures.
  });
});
