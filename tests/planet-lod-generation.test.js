// Unit tests for the Stage-C step-2 GENERATION-SIDE SURFACINGS (integration-index §2).
// These are the small PlanetGenerator-side derivations that bring the renderer's
// semantic uniforms alive — computed in deriveUniforms() from the driver bundle
// (which mirrors PlanetGenerator's real output fields). Pin the LOGIC; the lab
// tunes constants. Each surfacing is consumed by a Stage-C domain (step 3+).
import { describe, it, expect } from 'vitest';
import { deriveUniforms, pldBands } from '../planet-lod-lab-core.js';

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

describe('cryoActivity (Cryo step 1 — P7 cryovolcanism; OWNS the shared uCryoActivity gate F9/F10 read)', () => {
  // The icy-resurfacing activity gate (registry canonical name uCryoActivity). Cryo
  // DERIVES it (flips the registry RESERVED→LIVE) from THREE drivers AND'd: D12 tidal
  // ENERGY (tidalProxy = clamp01(tidalHeat)) drives the resurfacing; D2 VOLATILES make
  // that resurfacing cryo (ice) not rock (lava); D1 COLD (T_eq) keeps the volatiles a
  // solid ice SHELL, not a warm liquid ocean. This is what physically separates a
  // Europa (tidal + icy + cold → chaos/ridges) from an Io (tidal + volatile-poor → F8
  // lava) and from a warm ocean world (tidal + icy + WARM → ocean, no ice shell). F9
  // chaosCombiner + F10 cryoRidgeCombiner read it; a dead frozen world (no tidal) → 0,
  // which is why the Frozen preset showed nothing until the option-A lab knob forced it.
  const tidal = { eccentricity: 0.1, starMassEarth: 332946, orbitRadiusEarth: 1200, radiusEarth: 1.0 };
  const europa = { ...tidal, T_eq: 100, composition: { volatileFraction: 0.5 } };

  it('tidally-heated cold icy world (Europa-like) → cryoActivity > 0', () => {
    expect(deriveUniforms(europa).cryoActivity).toBeGreaterThan(0);
  });
  it('circular orbit (no tidal energy) → cryoActivity 0 — a dead frozen world is not cryo-active', () => {
    expect(deriveUniforms({ ...europa, eccentricity: 0 }).cryoActivity).toBe(0);
  });
  it('tidally-heated but volatile-POOR (rocky, Io-like) → cryoActivity ~0 (it is lava, not cryo)', () => {
    expect(deriveUniforms({ ...europa, composition: { volatileFraction: 0.02 } }).cryoActivity).toBe(0);
  });
  it('tidally-heated, volatile-rich, but WARM (above freezing) → cryoActivity 0 (liquid ocean, no ice shell)', () => {
    expect(deriveUniforms({ ...europa, T_eq: 300 }).cryoActivity).toBe(0);
  });
  it('more tidal heat → more (or equal) cryoActivity, all else equal (monotonic in the energy driver)', () => {
    const lo = deriveUniforms({ ...europa, eccentricity: 0.04 }).cryoActivity;
    const hi = deriveUniforms({ ...europa, eccentricity: 0.16 }).cryoActivity;
    expect(hi).toBeGreaterThanOrEqual(lo);
  });
  it('stays within [0,1], finite; empty bundle → 0 (no tidal, no volatiles)', () => {
    expect(deriveUniforms({}).cryoActivity).toBe(0);
    const c = deriveUniforms(europa).cryoActivity;
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
    expect(Number.isFinite(c)).toBe(true);
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

describe('frost-coverage mask (Cryo step 2 — F23/F22, the keystone every cryo feature layers on)', () => {
  // A per-fragment COVERAGE test ("is it cold enough here for this volatile to be solid?"),
  // NOT relief — so there is no finite-diff oracle; these tests pin the surfacing LOGIC and the
  // shader mask is verified visually. CPU derives the frost BUDGET (volatileFraction, D2), the
  // per-species condensation POINT (volatileSpecies, D2→D1), the snowline LATITUDE bias (axial
  // tilt, D3), the albedo TINT (species), and the tidally-locked flag (eyeball-cap variant). The
  // shader's localT < condensationT test is what rejects hot worlds — a volatile-bearing temperate
  // world still grows WATER caps at its cold poles, so species 0 (T>273, vf≥floor) condenses water.
  const cold = (T, vf = 0.3) => ({ T_eq: T, composition: { volatileFraction: vf } });

  it('bone-dry world (volatileFraction < 0.05) → no frost budget (frostMaxCoverage 0)', () => {
    expect(deriveUniforms(cold(60, 0.01)).frostMaxCoverage).toBe(0);
  });
  it('a volatile-rich world has a positive frost budget', () => {
    expect(deriveUniforms(cold(60, 0.4)).frostMaxCoverage).toBeGreaterThan(0);
  });
  it('more volatiles → larger (or equal) frost budget, all else equal (monotonic in D2)', () => {
    const lo = deriveUniforms(cold(60, 0.1)).frostMaxCoverage;
    const hi = deriveUniforms(cold(60, 0.4)).frostMaxCoverage;
    expect(hi).toBeGreaterThanOrEqual(lo);
  });

  it('bone-dry world → condensationT 0 (no characteristic frost, the shader early-out)', () => {
    expect(deriveUniforms(cold(60, 0.01)).frostCondensationT).toBe(0);
  });
  it('temperate/warm volatile world condenses WATER (273 K — cold-pole caps on a warm world)', () => {
    expect(deriveUniforms(cold(300)).frostCondensationT).toBe(273);  // species 0, but vf≥floor → water
    expect(deriveUniforms(cold(210)).frostCondensationT).toBe(273);  // species 1 H₂O
  });
  it('colder classifications carry their own colder condensation point (CO₂/CH₄/N₂)', () => {
    expect(deriveUniforms(cold(140)).frostCondensationT).toBe(150);  // CO₂
    expect(deriveUniforms(cold(70)).frostCondensationT).toBe(90);    // CH₄
    expect(deriveUniforms(cold(35)).frostCondensationT).toBe(45);    // N₂
  });
  it('colder worlds never condense at a HIGHER temperature (monotone non-increasing)', () => {
    const seq = [300, 210, 140, 70, 35].map(T => deriveUniforms(cold(T)).frostCondensationT);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeLessThanOrEqual(seq[i - 1]);
  });

  it('axial tilt biases frost toward low latitudes — zero tilt → no bias, high tilt → more', () => {
    expect(deriveUniforms(cold(60)).frostLatitudeBias).toBe(0);  // no axialTilt field → 0
    const lo = deriveUniforms({ ...cold(60), axialTilt: 10 }).frostLatitudeBias;
    const hi = deriveUniforms({ ...cold(60), axialTilt: 70 }).frostLatitudeBias;
    expect(hi).toBeGreaterThan(lo);
    expect(hi).toBeLessThanOrEqual(1);
  });

  it('frostAlbedo is a bright 3-channel tint (luminance load-bearing) and differs by species', () => {
    const co2 = deriveUniforms(cold(140)).frostAlbedo;   // grey-white
    const ch4 = deriveUniforms(cold(70)).frostAlbedo;    // tholin-pink
    const n2  = deriveUniforms(cold(35)).frostAlbedo;    // blue-white
    for (const a of [co2, ch4, n2]) {
      expect(a).toHaveLength(3);
      expect(Math.max(...a)).toBeGreaterThan(0.8);       // bright = survives posterize
    }
    expect(ch4).not.toEqual(n2);                          // CH₄ pink ≠ N₂ blue (the stylize call)
  });

  it('surfaces the tidally-locked flag for the eyeball-cap variant (1 locked, 0 free)', () => {
    expect(deriveUniforms({ ...cold(110), tidalState: { locked: true } }).frostLocked).toBe(1);
    expect(deriveUniforms({ ...cold(110), tidalState: { locked: false } }).frostLocked).toBe(0);
  });
  it('passes T_eq through for the shader localT field (tempEq)', () => {
    expect(deriveUniforms(cold(110)).tempEq).toBe(110);
    expect(deriveUniforms({}).tempEq).toBe(280);  // default
  });

  it('an explicitly bone-dry world → no frost at all (both budget AND condensationT 0, the early-out)', () => {
    const u = deriveUniforms(cold(60, 0.0));
    expect(u.frostMaxCoverage).toBe(0);
    expect(u.frostCondensationT).toBe(0);
  });
  it('all frost surfacings stay finite / in-range (empty bundle → default volatile world, no NaN/throw)', () => {
    const u = deriveUniforms({});               // default world (volatileFraction 0.15, T 280) → water caps
    expect(u.frostMaxCoverage).toBeGreaterThanOrEqual(0);
    expect(u.frostMaxCoverage).toBeLessThanOrEqual(1);
    expect(Number.isFinite(u.frostMaxCoverage)).toBe(true);
    expect(Number.isFinite(u.frostCondensationT)).toBe(true);
    expect(Number.isFinite(u.frostLatitudeBias)).toBe(true);
  });
});

describe('pldBands (Cryo step 3 — F22 polar-layered-deposit strata, the cap banding primitive)', () => {
  // The perennial polar cap reads as STACKED bright/dark annular bands — preserved depositional
  // layers exposed in the cap. This is an ALBEDO/luminance banding (NOT relief; verified visually,
  // logic unit-tested — like the step-2 frost mask), built on the SAME softened-floor quantizer as
  // terraceProfile (relief F6). The band coordinate is a pole-distance coordinate ∈ [0,1] (coldFactor:
  // 0 at the snowline edge → 1 at the pole) ramping smoothly across the cap, so iso-value contours ARE
  // the annular rings; adjacent layers alternate bright/dark by parity, crossfaded across the soft
  // riser. (Coverage itself saturates past the snowline, so it can't carry rings.) Returns a LUMINANCE FACTOR
  // ∈ [1−strength, 1] applied to the frost albedo. These tests pin the banding LOGIC.
  it('strength 0 → factor exactly 1 for any coverage (no-op / regression-safe)', () => {
    for (const c of [0, 0.13, 0.5, 0.87, 1.0]) {
      expect(pldBands(c, 6, 0.4, 0.0)).toBe(1.0);
    }
  });
  it('coverage 0 (bare ground / cap edge) → factor 1 (untouched)', () => {
    expect(pldBands(0, 6, 0.4, 0.3)).toBe(1.0);
  });
  it('degenerate levels (<1) → factor 1 (no banding)', () => {
    expect(pldBands(0.5, 0, 0.4, 0.3)).toBe(1.0);
  });
  it('flat tread of an EVEN band is bright (factor 1); flat tread of an ODD band is dimmed (1−strength)', () => {
    // levels 6, softness 0.4 → riser starts at frac 0.6; sampling mid-tread (frac 0.5) is flat.
    const bright = pldBands(0.5 / 6, 6, 0.4, 0.3);   // band 0 (even) mid-tread
    const dark = pldBands(1.5 / 6, 6, 0.4, 0.3);    // band 1 (odd)  mid-tread
    expect(bright).toBeCloseTo(1.0, 6);
    expect(dark).toBeCloseTo(0.7, 6);
  });
  it('across the cap the bands produce BOTH bright (~1) and dimmed (~1−strength) rings (the alternation)', () => {
    const strength = 0.3;
    const factors = [];
    for (let i = 0; i <= 60; i++) factors.push(pldBands(i / 60, 6, 0.4, strength));
    expect(Math.max(...factors)).toBeCloseTo(1.0, 2);
    expect(Math.min(...factors)).toBeCloseTo(1.0 - strength, 2);
  });
  it('factor is always bounded within [1−strength, 1] (never brightens, never over-darkens)', () => {
    const strength = 0.4;
    for (let i = 0; i <= 100; i++) {
      const f = pldBands(i / 100, 5, 0.35, strength);
      expect(f).toBeLessThanOrEqual(1.0 + 1e-9);
      expect(f).toBeGreaterThanOrEqual(1.0 - strength - 1e-9);
    }
  });
});

describe('pldStrength surfacing (Cryo step 3 — F22 PLD gate: D1 cold + D2 budget × surface-age preservation)', () => {
  // Polar layered deposits are the perennial-cap signature (Earth/Mars). Gated by a real cap
  // existing (frostMaxCoverage, D2) AND the surface being OLD enough to preserve strata
  // (1−resurfacing) — a young resurfaced ice shell (Europa) shows little layering. NOT gated on
  // axial tilt (that drives the deferred seasonal advance/retreat, cryo-doc §6 Q3).
  const cap = (vf, resurf) => ({
    T_eq: 60, composition: { volatileFraction: vf },
    surfaceHistory: { resurfacingRate: resurf },
  });
  it('bone-dry world (no cap) → pldStrength 0 (no layers without a cap)', () => {
    expect(deriveUniforms(cap(0.01, 0.05)).pldStrength).toBe(0);
  });
  it('a cold, well-preserved volatile cap → positive pldStrength', () => {
    expect(deriveUniforms(cap(0.4, 0.05)).pldStrength).toBeGreaterThan(0);
  });
  it('heavy resurfacing erases layering: young ice shows LESS PLD than an old surface (all else equal)', () => {
    const old = deriveUniforms(cap(0.4, 0.05)).pldStrength;   // ancient cap
    const young = deriveUniforms(cap(0.4, 0.7)).pldStrength;   // Europa-grade resurfacing
    expect(young).toBeLessThan(old);
  });
  it('more frost budget → stronger (or equal) layering, all else equal (monotone in D2 cap)', () => {
    const lo = deriveUniforms(cap(0.1, 0.05)).pldStrength;
    const hi = deriveUniforms(cap(0.4, 0.05)).pldStrength;
    expect(hi).toBeGreaterThanOrEqual(lo);
  });
  it('pldStrength stays finite and in [0,1] (empty bundle → default world, no NaN/throw)', () => {
    const s = deriveUniforms({}).pldStrength;
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
