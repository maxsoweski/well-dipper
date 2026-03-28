# Procedural LOD2 Design

## Problem
Sol system bodies use NASA textures at LOD2 (close-up), but 99.9% of bodies in the game
are procedurally generated. When the camera gets close to a procedural body (< 20x radius),
it stays on the LOD1 shader — no additional detail appears. LOD2 for procedural bodies
needs to look visibly better than LOD1 without requiring textures.

## Key Insight
The existing heightmap → normal perturbation technique (`computeHeight` + `perturbNormalFromNoise`)
is already the foundation. What makes LOD2 better is:
1. **More noise octaves** in `computeHeight` (6-8 vs 4)
2. **Crater features** via cellular/Voronoi noise (distinct bowl + rim shapes, not just noise bumps)
3. **Stronger perturbation** at close range (camera can see fine relief)
4. **Type-specific enhancements** (ice cracks glow, lava flows, ocean specular, etc.)

## Architecture Decision: LOD Uniform (not separate shader)

**Approach:** Add a `lodLevel` uniform (int, default 1) to Moon.js and Planet.js shaders.
When `lodLevel >= 2`, the shader switches to enhanced detail computation.

**Why not a separate shader?** Duplicating 500+ lines of type-specific GLSL for 18 planet
types and 5 moon types is unmaintainable. A runtime `if (lodLevel >= 2)` branch on a
uniform is GPU-coherent (all fragments take the same branch) so there's no divergence cost.

**Why not compile-time #define?** Would require compiling two shader variants per body type
and managing two materials. The uniform approach is simpler and the performance difference
is negligible for a coherent branch.

## Crater Algorithm: Cellular Noise F1 Distance

Impact craters are the single most impactful LOD2 feature for rocky bodies. Real craters
have a distinct morphology: circular depression (bowl) with a raised rim and ejecta blanket.

**Algorithm:** Use 3D cellular (Worley) noise to place crater centers, then apply a
crater profile function based on distance-to-nearest-cell-center (F1):

```glsl
float craterProfile(float f1) {
    // f1 = distance to nearest Voronoi cell center (0 at center, grows outward)
    float craterRadius = 0.35;
    float r = f1 / craterRadius;

    // Bowl: parabolic depression inside crater
    float bowl = smoothstep(0.0, 1.0, r) - 1.0;  // -1 at center, 0 at rim

    // Rim: Gaussian bump at crater edge
    float rim = exp(-(r - 1.0) * (r - 1.0) * 8.0);

    // Ejecta: gradual falloff outside rim
    float ejecta = exp(-max(r - 1.0, 0.0) * 3.0) * 0.3;

    float h = bowl * 0.4 + rim * 0.2 + ejecta * step(1.0, r) * 0.1;
    return h;
}
```

**Multi-scale craters:** Apply at 2-3 frequency scales for variety:
- Large basins: `cellular(pos * noiseScale * 0.5)` — few, deep
- Medium craters: `cellular(pos * noiseScale * 2.0)` — many, shallow
- Small impacts: `cellular(pos * noiseScale * 6.0)` — tiny, subtle

**Why cellular noise?** The F1 distance naturally provides circular features centered
on Voronoi cell points. No explicit crater placement needed — the noise IS the placement.
Performance: ~27 distance calculations per fragment for 3x3x3 search (well-optimized
implementations exist from Gustavson/Ashima).

## Per-Type LOD2 Enhancements

### Moon Types
| Type | LOD2 Enhancement |
|------|-----------------|
| captured (0) | Multi-scale craters, irregular shape emphasis |
| rocky (1) | Craters with bright ray ejecta, maria/highland contrast |
| ice (2) | Deeper cracks with subtle blue glow, smoother plains between cracks |
| volcanic (3) | Lava flow channels (cellular F2-F1 ridges), caldera depth |
| terrestrial (4) | Shore detail, elevation-dependent biomes, river-like features |

### Planet Types (priority order for implementation)
| Type | LOD2 Enhancement |
|------|-----------------|
| rocky (0) | Same as rocky moon — craters, maria |
| ice (2) | Same as ice moon — cracks, smooth plains |
| lava (3) | Cooling crust patterns (cellular), bright lava veins |
| terrestrial (5) | Coastline detail, mountain ranges, river systems |
| ocean (4) | Specular highlights, island detail |
| gas-giant (1) | More turbulence octaves, storm vortex detail |
| Others | Enhanced noise octaves + type-specific features |

## Implementation Plan

### Phase 1: Rocky Moon Test Case (this session)
1. Add simplified 3D cellular noise function to Moon.js shader
2. Add `lodLevel` uniform (int)
3. Create `computeHeightLOD2()` with craters + extra octaves
4. Branch normal perturbation on `lodLevel`
5. Wire `BodyRenderer.setLOD()` to update `lodLevel` uniform
6. Test in gallery (Shift+G) and solar system (Shift+0)

### Phase 2: All Moon Types
- Apply LOD2 enhancements to ice, volcanic, terrestrial, captured
- Each type gets its own `computeHeightLOD2` branch

### Phase 3: Planet Types
- Same pattern: cellular noise + type-specific features
- Gas giants: more turbulence, storm vortex structures
- Rocky planets: same crater system as moons

### Phase 4: Polish
- Smooth LOD1↔LOD2 transition (perturbation strength ramp)
- Performance profiling (ensure 60fps with LOD2 active)
- Gallery comparison mode (LOD1 vs LOD2 side by side)

## Performance Budget
- LOD2 is only active for ONE body at a time (closest to camera)
- Cellular noise: ~3x cost of simplex noise per sample (27 cells vs 4 corners)
- Multi-scale craters (3 scales): 3 cellular evaluations
- Total additional cost: ~9 simplex-equivalent evaluations per fragment
- On RTX 5080 at 1080p: negligible (< 0.5ms per frame)
- On mobile/integrated: may need to reduce to 2 crater scales

## Standing Rules
1. LOD2 improvements must survive posterization — no point adding detail
   that gets quantized away. Focus on features that affect LIGHTING
   (normal perturbation), not just color patterns.
2. Crater placement must be deterministic from position — same spot always
   shows same craters regardless of approach angle or zoom level.
3. LOD1→LOD2 transition should be smooth — perturbation strength ramps
   rather than popping. Use the `nearThreshold` distance for blending.
