import { describe, it, expect } from 'vitest';
import { KNOWN_OBJECT_PROFILES, searchKnownObjects } from '../../data/KnownObjectProfiles.js';
import { StyleProfileAdapter } from '../StyleProfileAdapter.js';

describe('KnownObjectProfiles', () => {

  it('has M42 (Orion Nebula) with correct type', () => {
    const m42 = KNOWN_OBJECT_PROFILES['M42'];
    expect(m42).toBeDefined();
    expect(m42.name).toBe('Orion Nebula');
    expect(m42.type).toBe('emission-nebula');
    expect(m42.galacticPos.x).toBeCloseTo(8.35, 1);
  });

  it('has all five test profiles', () => {
    expect(Object.keys(KNOWN_OBJECT_PROFILES)).toHaveLength(5);
    expect(KNOWN_OBJECT_PROFILES['M1']).toBeDefined();
    expect(KNOWN_OBJECT_PROFILES['M13']).toBeDefined();
    expect(KNOWN_OBJECT_PROFILES['M57']).toBeDefined();
    expect(KNOWN_OBJECT_PROFILES['M45']).toBeDefined();
  });

  it('each profile has required fields', () => {
    for (const [key, profile] of Object.entries(KNOWN_OBJECT_PROFILES)) {
      expect(profile.name, `${key} missing name`).toBeTruthy();
      expect(profile.type, `${key} missing type`).toBeTruthy();
      expect(profile.galacticPos, `${key} missing galacticPos`).toBeDefined();
      expect(typeof profile.galacticPos.x).toBe('number');
      expect(typeof profile.galacticPos.y).toBe('number');
      expect(typeof profile.galacticPos.z).toBe('number');
      expect(profile.radius, `${key} missing radius`).toBeGreaterThan(0);
      expect(profile.colorPrimary, `${key} missing colorPrimary`).toHaveLength(3);
    }
  });
});

describe('searchKnownObjects', () => {

  it('finds M42 by Messier number', () => {
    const results = searchKnownObjects('M42');
    expect(results.length).toBe(1);
    expect(results[0].key).toBe('M42');
  });

  it('finds Orion Nebula by name', () => {
    const results = searchKnownObjects('orion');
    expect(results.length).toBe(1);
    expect(results[0].profile.name).toBe('Orion Nebula');
  });

  it('finds Crab Nebula by NGC number', () => {
    const results = searchKnownObjects('NGC 1952');
    expect(results.length).toBe(1);
    expect(results[0].key).toBe('M1');
  });

  it('is case-insensitive', () => {
    const results = searchKnownObjects('pleiades');
    expect(results.length).toBe(1);
    expect(results[0].key).toBe('M45');
  });

  it('returns empty for unknown objects', () => {
    const results = searchKnownObjects('Andromeda');
    expect(results.length).toBe(0);
  });

  it('returns empty for empty query', () => {
    expect(searchKnownObjects('').length).toBe(0);
    expect(searchKnownObjects('  ').length).toBe(0);
  });

  it('partial match works', () => {
    // "ring" should match Ring Nebula
    const results = searchKnownObjects('ring');
    expect(results.length).toBe(1);
    expect(results[0].key).toBe('M57');
  });
});

describe('StyleProfileAdapter', () => {

  describe('toNebulaData', () => {
    it('converts M42 profile to Nebula.js-compatible data', () => {
      const profile = KNOWN_OBJECT_PROFILES['M42'];
      const data = StyleProfileAdapter.toNebulaData(profile);

      expect(data.type).toBe('emission-nebula');
      expect(data.layers).toHaveLength(6); // M42 specifies 6 layers
      expect(data.starPositions).toBeInstanceOf(Float32Array);
      expect(data.starColors).toBeInstanceOf(Float32Array);
      expect(data.starSizes).toBeInstanceOf(Float32Array);
      expect(data.starCount).toBeGreaterThan(0);
      expect(data.radius).toBe(300); // default render radius
      expect(data.tourStops.length).toBeGreaterThan(0);
    });

    it('layer data has correct structure', () => {
      const profile = KNOWN_OBJECT_PROFILES['M42'];
      const data = StyleProfileAdapter.toNebulaData(profile);
      const layer = data.layers[0];

      expect(layer.position).toHaveLength(3);
      expect(layer.size).toBeGreaterThan(0);
      expect(layer.rotation).toHaveLength(3);
      expect(layer.color).toHaveLength(3);
      expect(layer.noiseSeed).toHaveLength(2);
      expect(typeof layer.noiseScale).toBe('number');
      expect(typeof layer.opacity).toBe('number');
    });

    it('M57 planetary nebula includes central star', () => {
      const profile = KNOWN_OBJECT_PROFILES['M57'];
      const data = StyleProfileAdapter.toNebulaData(profile);

      expect(data.type).toBe('planetary-nebula');
      expect(data.centralStar).toBeDefined();
      expect(data.centralStar.color).toHaveLength(3);
    });

    it('is deterministic for the same profile', () => {
      const profile = KNOWN_OBJECT_PROFILES['M42'];
      const data1 = StyleProfileAdapter.toNebulaData(profile);
      const data2 = StyleProfileAdapter.toNebulaData(profile);

      // Layer colors should be identical (same seed)
      expect(data1.layers[0].color).toEqual(data2.layers[0].color);
    });
  });

  describe('toClusterData', () => {
    it('converts M13 profile to Galaxy.js-compatible data', () => {
      const profile = KNOWN_OBJECT_PROFILES['M13'];
      const data = StyleProfileAdapter.toClusterData(profile);

      expect(data.type).toBe('globular-cluster');
      expect(data.positions).toBeInstanceOf(Float32Array);
      expect(data.colors).toBeInstanceOf(Float32Array);
      expect(data.sizes).toBeInstanceOf(Float32Array);
      expect(data.particleCount).toBeGreaterThan(0);
      expect(data.spikeStars).toBe(true);
    });

    it('converts M45 open cluster', () => {
      const profile = KNOWN_OBJECT_PROFILES['M45'];
      const data = StyleProfileAdapter.toClusterData(profile);

      expect(data.type).toBe('open-cluster');
      expect(data.particleCount).toBeGreaterThan(0);
    });
  });

  describe('toSkyFeature', () => {
    it('generates sky feature for nearby player', () => {
      const profile = KNOWN_OBJECT_PROFILES['M42'];
      // Player near solar position — M42 is close by
      const feature = StyleProfileAdapter.toSkyFeature(profile, { x: 8.0, y: 0.025, z: 0.0 });

      expect(feature).not.toBeNull();
      expect(feature.type).toBe('emission-nebula');
      expect(feature.name).toBe('Orion Nebula');
      expect(feature.distance).toBeGreaterThan(0);
      expect(feature.distance).toBeLessThan(1); // M42 is ~0.41 kpc from Sun
    });

    it('returns null for very distant player', () => {
      const profile = KNOWN_OBJECT_PROFILES['M42'];
      const feature = StyleProfileAdapter.toSkyFeature(profile, { x: 0, y: 20, z: 0 });

      expect(feature).toBeNull();
    });

    it('marks player as inside when within radius', () => {
      const profile = KNOWN_OBJECT_PROFILES['M42'];
      // Place player right at M42's position
      const feature = StyleProfileAdapter.toSkyFeature(profile, profile.galacticPos);

      expect(feature).not.toBeNull();
      expect(feature.insideFeature).toBe(true);
    });
  });
});
