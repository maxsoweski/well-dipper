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
