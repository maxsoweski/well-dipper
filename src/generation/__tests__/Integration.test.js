import { describe, it, expect } from 'vitest';
import { StarSystemGenerator } from '../StarSystemGenerator.js';

describe('Full System Generation — Physics Integration', () => {
  // Generate several systems with fixed seeds for reproducibility
  const seeds = ['test-alpha', 'test-beta', 'sol-system', 'metal-rich-42', 'binary-star-99'];

  for (const seed of seeds) {
    describe(`seed: "${seed}"`, () => {
      const system = StarSystemGenerator.generate(seed);

      it('has formation history (not random archetype)', () => {
        expect(system.formation).toBeDefined();
        expect(system.formation.diskMass).toBeGreaterThan(0);
        expect(system.formation.dissipationMyr).toBeGreaterThan(0);
        expect(system.formation.archetype).toMatch(/compact-rocky|mixed|spread-giant/);
        expect(system.archetype).toBe(system.formation.archetype);
      });

      it('has stellar evolution data', () => {
        expect(system.stellarEvolution).toBeDefined();
        expect(system.stellarEvolution.stage).toBeDefined();
        expect(system.stellarEvolution.msLifetime).toBeGreaterThan(0);
      });

      it('has migration history', () => {
        expect(system.migrationHistory).toBeDefined();
        expect(typeof system.migrationHistory.occurred).toBe('boolean');
      });

      it('has trojanClusters array', () => {
        expect(Array.isArray(system.trojanClusters)).toBe(true);
      });

      it('planets have physics properties', () => {
        for (const planet of system.planets) {
          const pd = planet.planetData;

          // Mass
          expect(pd.massEarth).toBeGreaterThan(0);

          // Composition
          expect(pd.composition).toBeDefined();
          expect(pd.composition.carbonToOxygen).toBeGreaterThan(0);
          expect(pd.composition.ironFraction).toBeGreaterThan(0);
          expect(pd.composition.surfaceType).toMatch(/silicate|carbon|iron-rich|ice-rock/);

          // Temperature
          expect(pd.T_eq).toBeGreaterThan(0);

          // Tidal state
          expect(pd.tidalState).toBeDefined();
          expect(typeof pd.tidalState.locked).toBe('boolean');

          // Habitability
          expect(pd.habitability).toBeDefined();
          expect(pd.habitability.score).toBeGreaterThanOrEqual(0);
          expect(pd.habitability.score).toBeLessThanOrEqual(1);
          expect(Array.isArray(pd.habitability.factors)).toBe(true);

          // Surface history
          expect(pd.surfaceHistory).toBeDefined();
          expect(pd.surfaceHistory.bombardmentIntensity).toBeGreaterThanOrEqual(0);

          // Rotation matches tidal state
          if (pd.tidalState.locked && pd.tidalState.lockType === 'synchronous') {
            expect(pd.rotationSpeed).toBe(0);
          }
        }
      });

      it('atmosphere is physics-driven', () => {
        for (const planet of system.planets) {
          const pd = planet.planetData;
          if (pd.atmosphere) {
            expect(pd.atmosphere.physics).toBeDefined();
            expect(pd.atmosphere.physics.retained).toBe(true);
            expect(pd.atmosphere.physics.composition).toBeDefined();
          }
        }
      });

      it('rings have physics data when present', () => {
        for (const planet of system.planets) {
          if (planet.planetData.rings) {
            const r = planet.planetData.rings;
            // Backward-compat fields
            expect(r.innerRadius).toBeGreaterThan(0);
            expect(r.outerRadius).toBeGreaterThan(r.innerRadius);
            expect(r.color1).toBeDefined();
            expect(r.opacity).toBeGreaterThan(0);
            // Physics data
            expect(r.physics).toBeDefined();
            expect(r.physics.origin).toMatch(/roche|accretion|collision|captured/);
            expect(r.physics.composition).toBeDefined();
          }
        }
      });

      it('belt physics data when present', () => {
        for (const belt of system.asteroidBelts) {
          if (belt.physics) {
            expect(belt.physics.type).toMatch(/main|kuiper/);
          }
        }
      });

      it('clouds require atmosphere', () => {
        for (const planet of system.planets) {
          const pd = planet.planetData;
          if (pd.clouds) {
            // If there are clouds, atmosphere should be retained
            // (exception: gas giants, venus, etc. which always have atmosphere)
            expect(pd.atmosphere !== null || ['gas-giant', 'hot-jupiter', 'sub-neptune'].includes(pd.type)).toBe(true);
          }
        }
      });
    });
  }

  it('deterministic: same seed = same system', () => {
    const a = StarSystemGenerator.generate('determinism-check');
    const b = StarSystemGenerator.generate('determinism-check');
    expect(a.planets.length).toBe(b.planets.length);
    expect(a.metallicity).toBe(b.metallicity);
    expect(a.formation.archetype).toBe(b.formation.archetype);
    for (let i = 0; i < a.planets.length; i++) {
      expect(a.planets[i].planetData.type).toBe(b.planets[i].planetData.type);
      expect(a.planets[i].orbitRadiusAU).toBe(b.planets[i].orbitRadiusAU);
    }
  });

  it('physics consistency: hot close planets lose atmosphere', () => {
    // Generate many systems and check that small close-in planets don't have thick atmospheres
    let checked = 0;
    for (let i = 0; i < 500; i++) {
      const sys = StarSystemGenerator.generate(`atmo-check-${i}`);
      for (const p of sys.planets) {
        const pd = p.planetData;
        if (pd.radiusEarth < 0.5 && p.orbitRadiusAU < 0.1 && pd.type === 'rocky') {
          checked++;
          // Small hot rocky planets should NOT have thick atmosphere
          if (pd.atmosphere && pd.atmosphere.physics) {
            expect(pd.atmosphere.physics.pressure).toBeLessThan(5);
          }
        }
      }
    }
    // Should have found at least a few
    expect(checked).toBeGreaterThan(0);
  });

  it('physics consistency: gas giants have highest mass', () => {
    for (let i = 0; i < 20; i++) {
      const sys = StarSystemGenerator.generate(`mass-check-${i}`);
      for (const p of sys.planets) {
        const pd = p.planetData;
        if (pd.type === 'gas-giant') {
          expect(pd.massEarth).toBeGreaterThan(10);
        }
        if (pd.type === 'rocky' && pd.radiusEarth < 0.6) {
          expect(pd.massEarth).toBeLessThan(1);
        }
      }
    }
  });

  it('statistical: migration creates hot jupiters with fewer inner planets', () => {
    let migratedCount = 0;
    let migratedPlanetCount = 0;
    let normalCount = 0;
    let normalPlanetCount = 0;

    for (let i = 0; i < 200; i++) {
      const sys = StarSystemGenerator.generate(`migration-stats-${i}`);
      if (sys.migrationHistory.occurred) {
        migratedCount++;
        migratedPlanetCount += sys.planets.length;
      } else if (sys.planets.length > 0) {
        normalCount++;
        normalPlanetCount += sys.planets.length;
      }
    }

    // Migrated systems should exist (migration is ~15% of eligible)
    // They may be rare, but over 200 systems we should see some
    if (migratedCount > 0 && normalCount > 0) {
      const avgMigrated = migratedPlanetCount / migratedCount;
      const avgNormal = normalPlanetCount / normalCount;
      // Migrated systems should have fewer planets (scattered during migration)
      expect(avgMigrated).toBeLessThan(avgNormal);
    }
  });
});
