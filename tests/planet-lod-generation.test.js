// Unit tests for the Stage-C step-2 GENERATION-SIDE SURFACINGS (integration-index §2).
// These are the small PlanetGenerator-side derivations that bring the renderer's
// semantic uniforms alive — computed in deriveUniforms() from the driver bundle
// (which mirrors PlanetGenerator's real output fields). Pin the LOGIC; the lab
// tunes constants. Each surfacing is consumed by a Stage-C domain (step 3+).
import { describe, it, expect } from 'vitest';
import { deriveUniforms } from '../planet-lod-lab-core.js';

describe('surfaceGravity (§2 #1 — gates Relief crater morphology + Aeolian dune scale)', () => {
  // g = M/R² in Earth-relative units; massEarth + radiusEarth are both already in
  // the generator's output object (PhysicsEngine estimateMassEarth → massEarth).
  it('Earth-mass, Earth-radius body is ~1 g', () => {
    expect(deriveUniforms({ radiusEarth: 1.0, massEarth: 1.0 }).surfaceGravity).toBeCloseTo(1.0, 5);
  });

  it('equals massEarth / radiusEarth² (super-earth: 5 ME, 1.5 RE → 2.22 g)', () => {
    expect(deriveUniforms({ radiusEarth: 1.5, massEarth: 5.0 }).surfaceGravity).toBeCloseTo(5 / 2.25, 5);
  });

  it('bigger radius at the same mass → lower surface gravity (inverse-square)', () => {
    const dense = deriveUniforms({ radiusEarth: 1.0, massEarth: 2.0 }).surfaceGravity;
    const puffy = deriveUniforms({ radiusEarth: 2.0, massEarth: 2.0 }).surfaceGravity;
    expect(puffy).toBeLessThan(dense);
  });

  it('defaults to ~1 g (finite, no NaN/throw) on a bundle missing mass/radius', () => {
    const g = deriveUniforms({}).surfaceGravity;
    expect(g).toBeCloseTo(1.0, 5);
    expect(Number.isFinite(g)).toBe(true);
  });
});

describe('tidalHeat (§2 #2 — planet-level, feeds Relief F8 lava/F7 edifices + Cryo P7)', () => {
  // The existing PhysicsEngine.tidalHeating() is moon-parameterized; this is the
  // planet-level analog — a planet self-heats on an eccentric close orbit around
  // its STAR (Relief risk #2: "eccentricity + close-orbit planets self-heat").
  // Same Io-normalized physics shape (∝ e²·M_star²·R_planet⁵ / a⁵); raw scalar,
  // the consuming domains map it to their own 0..1 (uLavaActivity / cryoActive).
  // Driver fields mirror what should reach planetData: eccentricity, starMassEarth,
  // orbitRadiusEarth, radiusEarth.
  const close = { eccentricity: 0.1, starMassEarth: 332946, orbitRadiusEarth: 1200, radiusEarth: 1.0 };

  it('a circular orbit produces zero tidal heat (e² term)', () => {
    expect(deriveUniforms({ ...close, eccentricity: 0 }).tidalHeat).toBe(0);
  });

  it('more eccentric → more tidal heat (e² scaling)', () => {
    const lo = deriveUniforms({ ...close, eccentricity: 0.05 }).tidalHeat;
    const hi = deriveUniforms({ ...close, eccentricity: 0.20 }).tidalHeat;
    expect(hi).toBeGreaterThan(lo);
  });

  it('closer orbit → more tidal heat (inverse fifth-power of semi-major axis)', () => {
    const far  = deriveUniforms({ ...close, orbitRadiusEarth: 4000 }).tidalHeat;
    const near = deriveUniforms({ ...close, orbitRadiusEarth: 1000 }).tidalHeat;
    expect(near).toBeGreaterThan(far);
  });

  it('larger planet → more tidal heat (R⁵ scaling)', () => {
    const small = deriveUniforms({ ...close, radiusEarth: 0.5 }).tidalHeat;
    const big   = deriveUniforms({ ...close, radiusEarth: 2.0 }).tidalHeat;
    expect(big).toBeGreaterThan(small);
  });

  it('is finite and non-negative; defaults to 0 (no NaN/throw) on a bundle without orbital data', () => {
    const t = deriveUniforms({}).tidalHeat;
    expect(t).toBe(0);
    expect(Number.isFinite(deriveUniforms(close).tidalHeat)).toBe(true);
    expect(deriveUniforms(close).tidalHeat).toBeGreaterThanOrEqual(0);
  });
});

describe('liquidStability + liquidSpecies (§2 #3 — the master liquid gate)', () => {
  // Feeds RESERVED uLiquidStability/uLiquidSpecies (registry). Per the Fluvial doc's
  // master gate, a thermodynamically stable RETAINED liquid requires three things
  // AND'd together — D6 atmospheric retention, D2 volatile budget, D1 T_eq inside a
  // liquid window for SOME species — any one zero ⇒ whole fluvial/coastal/karst stack
  // bypassed. liquidSpecies enum: 0=water, 1=methane/ethane (registry contract);
  // methane is stable only at the much colder Titan band (~90–112 K).
  const temperate = { T_eq: 290, composition: { volatileFraction: 0.2 }, atmosphere: { retained: true, pressure: 1.0 } };

  it('warm temperate world with atmosphere + volatiles → stable water (stability>0, species=0)', () => {
    const u = deriveUniforms(temperate);
    expect(u.liquidStability).toBeGreaterThan(0);
    expect(u.liquidSpecies).toBe(0);
  });

  it('airless world → no stable surface liquid (stability 0), whatever the temperature', () => {
    expect(deriveUniforms({ ...temperate, atmosphere: null }).liquidStability).toBe(0);
  });

  it('bone-dry world (volatileFraction < 0.05) → stability 0 (volatile gate)', () => {
    expect(deriveUniforms({ ...temperate, composition: { volatileFraction: 0.01 } }).liquidStability).toBe(0);
  });

  it('hot world (T_eq above the water window) → stability 0 (temperature gate)', () => {
    expect(deriveUniforms({ ...temperate, T_eq: 600 }).liquidStability).toBe(0);
  });

  it('cold world with a thick cold atmosphere → methane/ethane species (1), still stable', () => {
    const titan = { T_eq: 94, composition: { volatileFraction: 0.4 }, atmosphere: { retained: true, pressure: 1.5 } };
    const u = deriveUniforms(titan);
    expect(u.liquidStability).toBeGreaterThan(0);
    expect(u.liquidSpecies).toBe(1);
  });

  it('cold AND airless (frozen out → Cryo, not Fluvial) → stability 0', () => {
    expect(deriveUniforms({ T_eq: 60, composition: { volatileFraction: 0.3 }, atmosphere: null }).liquidStability).toBe(0);
  });

  it('more volatiles → higher (or equal) stability, all else equal', () => {
    const lo = deriveUniforms({ ...temperate, composition: { volatileFraction: 0.1 } }).liquidStability;
    const hi = deriveUniforms({ ...temperate, composition: { volatileFraction: 0.4 } }).liquidStability;
    expect(hi).toBeGreaterThanOrEqual(lo);
  });

  it('stability stays within [0,1], finite; empty bundle → 0 (no atmosphere)', () => {
    const u = deriveUniforms({});
    expect(u.liquidStability).toBe(0);
    expect(Number.isFinite(u.liquidStability)).toBe(true);
    const t = deriveUniforms(temperate).liquidStability;
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
  });
});

describe('volatileSpecies classifier (§2 #4 — feeds Cryo sublimation morphology + frost color)', () => {
  // CPU JS selector (the only allowed branch — in JS, not a shader planetType branch),
  // paralleling Clouds' cloudSpeciesFor(). Picks the characteristic SOLID volatile from
  // D2 volatileFraction + D1 T_eq condensation bands. enum: 0=none, 1=H₂O, 2=CO₂, 3=CH₄,
  // 4=N₂ — descending condensation temperature. Drives which sublimation landform (F18)
  // + frost albedo (F22) Cryo renders in step 3.
  const cold = (T) => ({ T_eq: T, composition: { volatileFraction: 0.3 } });

  it('warm world (T_eq > 273) → no characteristic surface frost (none/0)', () => {
    expect(deriveUniforms(cold(300)).volatileSpecies).toBe(0);
  });
  it('temperate-cold world (150–273 K) → water ice (H₂O/1)', () => {
    expect(deriveUniforms(cold(210)).volatileSpecies).toBe(1);
  });
  it('Mars-cold world (90–150 K) → CO₂ dry ice (2)', () => {
    expect(deriveUniforms(cold(140)).volatileSpecies).toBe(2);
  });
  it('Pluto-cold world (40–90 K) → methane ice (CH₄/3)', () => {
    expect(deriveUniforms(cold(70)).volatileSpecies).toBe(3);
  });
  it('Triton-cold world (≤40 K) → nitrogen ice (N₂/4)', () => {
    expect(deriveUniforms(cold(35)).volatileSpecies).toBe(4);
  });
  it('bone-dry world (volatileFraction < 0.05) → none (0), whatever the temperature', () => {
    expect(deriveUniforms({ T_eq: 35, composition: { volatileFraction: 0.01 } }).volatileSpecies).toBe(0);
  });
  it('colder worlds select equal-or-colder-condensing species (monotonic banding)', () => {
    const seq = [300, 210, 140, 70, 35].map(T => deriveUniforms(cold(T)).volatileSpecies);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1]);
  });
  it('is an integer enum; empty bundle → defined (warm default → none/0, no NaN/throw)', () => {
    const v = deriveUniforms({}).volatileSpecies;
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBe(0);
  });
});

describe('precipitation (§2 #5 — surfaces D4 rain as first-class; feeds Fluvial F11 channels)', () => {
  // Rain needs BOTH a currently-stable liquid (liquidStability — covers water AND methane
  // cycles) and a condensible-cycle atmosphere TYPE (n2-o2 full → co2-n2 partial → co2 trace
  // → h2-he/none none). Composition strings come from computeAtmosphere. Past rain on a
  // now-dry world is carried by riverRelict (a later surfacing), not this.
  const earthlike = { T_eq: 290, composition: { volatileFraction: 0.3 }, atmosphere: { retained: true, pressure: 1.0, composition: 'n2-o2' } };

  it('temperate world with an N₂-O₂ (water-cycle) atmosphere → precipitation > 0', () => {
    expect(deriveUniforms(earthlike).precipitation).toBeGreaterThan(0);
  });
  it('airless world → no rain (precipitation 0)', () => {
    expect(deriveUniforms({ ...earthlike, atmosphere: null }).precipitation).toBe(0);
  });
  it('hot world (no stable liquid) → no rain', () => {
    expect(deriveUniforms({ ...earthlike, T_eq: 700 }).precipitation).toBe(0);
  });
  it('an N₂-O₂ atmosphere rains more than a thin CO₂ one, all else equal', () => {
    const wet = deriveUniforms(earthlike).precipitation;
    const dry = deriveUniforms({ ...earthlike, atmosphere: { retained: true, pressure: 1.0, composition: 'co2' } }).precipitation;
    expect(wet).toBeGreaterThan(dry);
  });
  it('a gas (H₂-He) envelope has no surface rain', () => {
    expect(deriveUniforms({ ...earthlike, atmosphere: { retained: true, pressure: 50, composition: 'h2-he' } }).precipitation).toBe(0);
  });
  it('a cold methane world (Titan) still precipitates (methane rain)', () => {
    const titan = { T_eq: 94, composition: { volatileFraction: 0.4 }, atmosphere: { retained: true, pressure: 1.5, composition: 'n2-o2' } };
    expect(deriveUniforms(titan).precipitation).toBeGreaterThan(0);
  });
  it('stays within [0,1], finite; empty bundle → 0', () => {
    expect(deriveUniforms({}).precipitation).toBe(0);
    const p = deriveUniforms(earthlike).precipitation;
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
    expect(Number.isFinite(p)).toBe(true);
  });
});

describe('pressure plumbing (§2 #6 — atmosphere surface pressure → shader; Aeolian grain transport)', () => {
  // Pure passthrough of the bundle's atmosphere pressure (already produced by
  // computeAtmosphere) — no new physics. Aeolian maps it to grain-transport thresholds
  // (F15) when it lands; here we only surface the scalar.
  it('surfaces the atmosphere pressure scalar', () => {
    expect(deriveUniforms({ atmosphere: { retained: true, pressure: 1.5 } }).pressure).toBe(1.5);
  });
  it('airless world / empty bundle → zero pressure', () => {
    expect(deriveUniforms({ atmosphere: null }).pressure).toBe(0);
    expect(deriveUniforms({}).pressure).toBe(0);
  });
  it('a thicker atmosphere reports higher pressure (monotone passthrough)', () => {
    const thin  = deriveUniforms({ atmosphere: { retained: true, pressure: 0.1 } }).pressure;
    const thick = deriveUniforms({ atmosphere: { retained: true, pressure: 90 } }).pressure;
    expect(thick).toBeGreaterThan(thin);
  });
  it('is finite and non-negative', () => {
    const p = deriveUniforms({ atmosphere: { retained: true, pressure: 50 } }).pressure;
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeGreaterThanOrEqual(0);
  });
});

describe('magneticField (§2 #7 — D13; Q6: generation derives, Optical reads aurora F37 + atmo stripping)', () => {
  // Mirrors PhysicsEngine.js:168 fieldStrength = ironFraction × (locked ? 0.2 : 1.0): a
  // tidally-locked world spins slowly → weak dynamo. Generation derives it (here); Optical
  // consumes it (aurora). auroraIntensity stays defined as magneticField gated by atmosphere.
  it('more iron core → stronger field', () => {
    const lo = deriveUniforms({ composition: { ironFraction: 0.1 } }).magneticField;
    const hi = deriveUniforms({ composition: { ironFraction: 0.5 } }).magneticField;
    expect(hi).toBeGreaterThan(lo);
  });
  it('tidal lock weakens the field (slow rotation → weak dynamo)', () => {
    const free   = deriveUniforms({ composition: { ironFraction: 0.4 }, tidalState: { locked: false } }).magneticField;
    const locked = deriveUniforms({ composition: { ironFraction: 0.4 }, tidalState: { locked: true } }).magneticField;
    expect(locked).toBeLessThan(free);
  });
  it('equals ironFraction × lock-factor (mirrors PhysicsEngine fieldStrength exactly)', () => {
    expect(deriveUniforms({ composition: { ironFraction: 0.4 }, tidalState: { locked: false } }).magneticField).toBeCloseTo(0.4, 5);
    expect(deriveUniforms({ composition: { ironFraction: 0.4 }, tidalState: { locked: true } }).magneticField).toBeCloseTo(0.08, 5);
  });
  it('auroraIntensity = magneticField gated by atmosphere (the two stay consistent)', () => {
    const withAtmo = deriveUniforms({ composition: { ironFraction: 0.4 }, tidalState: { locked: false }, atmosphere: { retained: true, pressure: 1 } });
    expect(withAtmo.auroraIntensity).toBeCloseTo(withAtmo.magneticField, 5);  // hasAtmo → equal
    const airless = deriveUniforms({ composition: { ironFraction: 0.4 }, atmosphere: null });
    expect(airless.auroraIntensity).toBe(0);                                  // no atmo → no aurora even with a field
  });
  it('finite, non-negative; default bundle → defined (no NaN/throw)', () => {
    const m = deriveUniforms({}).magneticField;
    expect(Number.isFinite(m)).toBe(true);
    expect(m).toBeGreaterThanOrEqual(0);
  });
});
