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
