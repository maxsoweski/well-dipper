# Plan: Nav Computer Galaxy Images

**Status:** Planning (not yet implemented)
**Date:** 2026-03-27

---

## Problem

The nav computer's 2D levels (Galaxy, Sector, District, Block) all use the same rendering approach: `GalaxyLuminosityRenderer.render()` generates a 512x512 luminosity image on the fly via CPU, sampling `GalacticMap.potentialDerivedDensity()` per pixel with per-component tone mapping, FBM noise clouds, and dust lanes. This is:

1. **Slow at runtime.** Each new view triggers a 512x512 CPU render with 5 noise octaves, 5 domain-warped noise layers, and dust lane calculations per pixel. That's ~1.3M density queries plus ~1.3M FBM evaluations per image. The console logs show render times, and this blocks the main thread.
2. **Visually repetitive.** Every zoom level sees the same density-field rendering at different scales. There's no increasing detail or new visual information as you drill down -- just the same smooth density gradients zoomed in.
3. **No star detail at intermediate levels.** Between "smooth galaxy glow" (levels 0-3) and "individual 3D stars" (level 4), there's no transition showing star clusters, nebulae, or stellar density texture.

The old `galaxy-bg.png` (1280x1280, 357KB) is no longer used -- the `GalaxyLuminosityRenderer` replaced it. But the renderer's approach doesn't scale well across 5 orders of magnitude of zoom.

---

## Current System Summary

### What exists

| Component | Role | Notes |
|-----------|------|-------|
| `GalaxyLuminosityRenderer` | CPU renderer, per-component tone mapping | 512px, called on-demand per view. Cache of 8 entries in `_mapCache`. |
| `GalacticMap` | Density model (potential-derived) | Core, bar, arms, disk, halo. 15 kpc radius. |
| `MilkyWayModel` | 600K particle cloud from density model | Used for skybox glow, not nav computer. |
| `GalacticSectors` | ~1000 density-adaptive named sectors | Sectors range from 0.5 kpc (core) to 4 kpc (outer rim). |
| `_getTileImage()` | 128px density background per tile | Uses `_tileImageCache` but this appears to be dead code (never initialized). |
| `_getOrRenderMap()` | Active image cache (8 entries, 512px) | Quantizes view to avoid re-renders on tiny pans. |

### How rendering works now

1. `_render2DLevel()` calls `_renderDensityBg()` for all 2D levels
2. `_renderDensityBg()` calls `_getOrRenderMap(cx, cz, ext)`
3. `_getOrRenderMap()` checks cache, or calls `GalaxyLuminosityRenderer.render()` at 512px
4. Result is drawn to screen with `ctx.drawImage()`, scaled to fit
5. Scale-dependent overrides adjust gain/stretch at different zoom levels (ext < 10, ext < 2)

### Zoom level spatial scales

| Level | Name | Typical extent (half-width in kpc) | Spatial coverage |
|-------|------|-------------------------------------|------------------|
| 0 | Galaxy | 22 kpc | Full 30 kpc diameter disk |
| 1 | Sector | 0.25 - 2 kpc | One named sector |
| 2 | District | ~0.1 - 0.5 kpc | 1/64th of a sector |
| 3 | Block | ~0.01 - 0.05 kpc | 1/64th of a district |
| 4 | Local | ~0.002 - 0.005 kpc | 3D star map (~100 stars) |

That's roughly 4 orders of magnitude from galaxy to block level.

---

## Scale Analysis: How Many Images?

### Option A: Pre-render every possible view

| Level | Count | Why |
|-------|-------|-----|
| Galaxy | 1 | Single full view |
| Sector | ~1,000 | One per named sector |
| District | ~64,000 | ~64 districts per sector x 1,000 sectors |
| Block | ~4,000,000 | ~64 blocks per district x 64,000 districts |

At 512x512 PNG (~50-100KB each compressed):
- Sectors: ~50-100 MB (feasible)
- Districts: ~3-6 GB (painful)
- Blocks: ~200-400 GB (impossible)

**Verdict: Pre-rendering everything is not feasible below the sector level.**

### Option B: Tiled map system (Leaflet/OpenStreetMap style)

The classic web-map approach: pre-render a pyramid of tiles at fixed zoom levels, serve as a tile grid. Each tile is 256x256px.

| Zoom level | Tiles | Total pixels | Storage (~50KB/tile) |
|------------|-------|-------------|---------------------|
| z0 | 1 | 256x256 | 50 KB |
| z1 | 4 | 512x512 | 200 KB |
| z2 | 16 | 1024x1024 | 800 KB |
| z3 | 64 | 2048x2048 | 3.2 MB |
| z4 | 256 | 4096x4096 | 12.8 MB |
| z5 | 1,024 | 8192x8192 | 51 MB |
| z6 | 4,096 | 16384x16384 | 200 MB |
| z7 | 16,384 | 32768x32768 | 800 MB |

To cover the full zoom range (galaxy down to block), we'd need z0 through roughly z10-z12, which means 1M+ tiles and tens of GB.

**Verdict: Pure tile pyramid doesn't work either -- the zoom range is too deep.**

### Option C: Hybrid -- pre-render top levels, on-demand render bottom levels

This is the right approach. The key insight: **the visual information changes character at different scales.**

- **Galaxy + Sector levels** show the same physical thing: the density field with arms, core, dust. These benefit from high-quality pre-rendered images because (a) there are few of them, and (b) they're seen repeatedly.
- **District + Block levels** are zoomed so far into the density field that it becomes a smooth gradient. At these scales, what the player actually wants to see is **stellar density texture** -- where are the star clusters, nebulae, voids? This is better served by procedural rendering that shows hash-grid star positions as a density heatmap.

---

## Recommended Approach: Three-Tier Rendering

### Tier 1: Pre-rendered Galaxy Image (Level 0)

**What:** One high-resolution galaxy image, pre-rendered offline.

**Resolution:** 2048x2048 or 4096x4096 PNG.

**Renderer:** `GalaxyLuminosityRenderer` run as a build script (like `generate-galaxy-map.mjs` already does), but with higher quality settings -- more noise octaves, higher resolution, maybe multi-pass for better cloud detail.

**Why pre-render:** This image is seen every time the player opens the galaxy view. It should be the best-looking image in the nav computer. Runtime rendering at 512px with frame-blocking CPU work is wasteful for a view that never changes.

**Storage:** 2048px = ~200-400KB PNG. 4096px = ~800KB-1.5MB. Trivial.

**Implementation:**
- Add a `--nav-galaxy` flag to `generate-galaxy-map.mjs` (or new script)
- Render at 2048+ resolution with full quality settings
- Save to `public/assets/maps/nav-galaxy.png`
- NavComputer loads this once, draws it directly for level 0

### Tier 2: On-Demand Luminosity Rendering (Levels 1-2, improved)

**What:** Keep the current `GalaxyLuminosityRenderer` approach for Sector and District levels, but make it faster and better-looking.

**Why on-demand:** There are ~1,000 sectors and ~64,000 districts. Pre-rendering all of them is borderline for sectors but impractical for districts. The player only visits a few, so on-demand makes sense. But we need to fix the performance.

**Performance improvements:**
1. **Web Worker rendering.** Move the GalaxyLuminosityRenderer to a Web Worker so it doesn't block the main thread. The renderer is pure CPU math with no DOM dependencies (it creates a canvas at the end, but that can be replaced with ImageData transfer). Show a loading placeholder while rendering, swap in the result when ready.
2. **Resolution scaling.** Render at 256px for the initial display (fast), then upgrade to 512px in the background. The player won't notice 256px scaled up while the view is still animating.
3. **Reduce noise cost.** The FBM noise is the expensive part (5 layers x 5 octaves = 25 noise evaluations per pixel). At sector scale, 3 layers x 4 octaves is probably sufficient. At district scale, even 2 layers x 3 octaves might be enough since the noise features are larger than the view.
4. **Cache persistence.** Consider caching rendered images to IndexedDB so revisiting a sector doesn't re-render. With ~50-100KB per image and <100 visited sectors per session, this is very manageable.

**Visual improvements at sector/district zoom:**
- Boost noise contrast at closer zoom so the cloud structure is more prominent
- Add scattered "bright knots" at sector level by querying a few hundred hash-grid star positions and drawing subtle point highlights on the luminosity image
- This bridges the gap between smooth density glow and individual stars

### Tier 3: Procedural Star-Density Rendering (Levels 2-3)

**What:** At District and Block levels, shift from density-field rendering to **star-density heatmapping** based on actual hash-grid star positions.

**Why:** At these scales, the smooth galactic density field contains no useful detail -- it's a nearly uniform gradient. What matters is where the individual stars are. The `HashGridStarfield` already knows exactly where every star is. We can sample it to create a density texture that shows real stellar structure.

**How it works:**
1. Query `HashGridStarfield.findStarsInRadius()` or a grid-sampling variant across the view area
2. Bin stars into a grid (e.g., 256x256)
3. Apply a Gaussian blur for smooth density
4. Tone-map and colorize (hotter colors for denser regions, spectral-type tinting)
5. Render to an offscreen canvas, cache it

**Star counts at these scales:**
- District (~0.2 kpc across): Might contain ~10,000-100,000 navigable stars depending on density. Querying all of them per frame is too slow, but a sparse sampling (query a few hundred grid cells) gives a good density estimate.
- Block (~0.02 kpc across): ~500-5,000 stars. Could actually query and render all of them as points.

**Key advantage:** This rendering naturally shows the structure that matters at these scales -- star clusters, density gradients within arms, sparse vs dense regions. It also provides visual continuity into the Local level where individual stars are visible.

**Visual treatment:**
- Faint luminosity glow in background (low-res version of Tier 2, or just a solid gradient based on local density)
- Star density heatmap overlaid with warm-to-cool color ramp
- At Block level (level 3), individual bright stars visible as points
- Smooth visual transition into Local 3D view

---

## Transition Between Tiers

The key to making this feel good is seamless visual transitions during drill-down animations:

| Drill-down | From | To | Transition |
|------------|------|----|------------|
| Galaxy -> Sector | Pre-rendered galaxy | On-demand luminosity | Zoom animation, cross-fade when luminosity image is ready |
| Sector -> District | Luminosity render | Luminosity + star-density overlay | Luminosity fades slightly, star density fades in |
| District -> Block | Luminosity + star-density | Star-density + individual points | Luminosity fades out, point stars appear |
| Block -> Local | Star-density + points | Full 3D star map | 2D dissolves into 3D perspective |

The drill-down animation system already exists (`_startDrillAnim`). The cross-fade just needs an alpha blend during the animation.

---

## Performance Budget

| Operation | Target | Notes |
|-----------|--------|-------|
| Galaxy image load | <100ms | Pre-rendered PNG, loaded once |
| Sector luminosity render | <200ms | Worker thread, 256px initial |
| District star-density render | <100ms | Sparse grid sampling, 256px |
| Block star-density render | <50ms | Direct star query, 256px |
| Cache hit (any level) | <5ms | Canvas blit from cache |
| Memory (cache) | <50MB | 8-16 cached images at 512px |

---

## Implementation Order

### Phase 1: Pre-rendered Galaxy Image
1. Create build script to render high-res galaxy image (2048px)
2. Modify NavComputer level 0 to load and display the pre-rendered image
3. Remove runtime rendering for level 0
4. **Immediate win:** Better-looking galaxy view, no frame drops on first open

### Phase 2: Web Worker for Luminosity Rendering
1. Extract GalaxyLuminosityRenderer into a Web Worker
2. Add placeholder/loading state while rendering
3. Implement progressive resolution (256px fast, 512px upgrade)
4. **Win:** No more main-thread blocking during navigation

### Phase 3: Star-Density Rendering for Deep Zoom
1. Add a `HashGridStarfield` sampling method for 2D density queries
2. Build star-density heatmap renderer (can be in same Worker)
3. Wire into District (level 2) and Block (level 3) rendering
4. Cross-fade with luminosity at transitions
5. **Win:** Visually meaningful detail at every zoom level

### Phase 4: Polish
1. IndexedDB caching for visited views
2. Smooth cross-fade transitions between tiers
3. Tune color palettes per tier for visual cohesion
4. Add subtle "bright knots" at sector level from hash-grid sampling
5. Loading indicators during Worker renders

---

## Alternatives Considered

### WebGL/GPU rendering
The luminosity renderer could be ported to a fragment shader for massive speedup. However:
- The nav computer is Canvas 2D, adding WebGL would mean a second rendering context or a shared one with Three.js
- The Worker approach is simpler and sufficient -- we only render a few images per navigation session
- If performance is still an issue after Worker offloading, GPU rendering becomes the next step

### Full tile pyramid (slippy map)
Pre-rendering a complete tile pyramid like OpenStreetMap. Rejected because:
- The zoom range (galaxy to block = ~4 orders of magnitude) requires z0-z12+ levels
- At z12, that's 16M tiles -- impractical for a game asset
- The visual information character changes across scales, so a uniform tile renderer wouldn't look good anyway

### MilkyWayModel particle rendering
Using the 600K particle model to render nav images by projecting particles top-down. This could work for the galaxy level but:
- 600K particles is too few for sector/district detail (you'd see individual particles)
- Increasing particle count to millions would be slow to generate
- The GalaxyLuminosityRenderer already produces better-looking output from the same density model

### Single large texture with mipmap sampling
One enormous texture (e.g., 32768x32768 = 1 billion pixels) that covers the full galaxy at block-level detail. Rejected:
- ~4GB uncompressed, ~500MB compressed
- WebGL texture size limits (typically 8192 or 16384 max)
- Doesn't solve the "different visual information at different scales" problem

---

## Open Questions

1. **How fast is the Worker render?** Need to benchmark GalaxyLuminosityRenderer in a Worker. If it's still >500ms at 512px, we may need to reduce quality settings further or use GPU.
2. **HashGridStarfield 2D sampling API.** Does `findStarsInRadius` work efficiently for 2D grid sampling, or do we need a new method that queries by XZ rectangle?
3. **Visual coherence.** The three tiers (pre-rendered, luminosity, star-density) need to feel like the same galaxy. Color palette alignment is important -- need to prototype and tune.
4. **Mobile/low-end performance.** Web Workers aren't free. On low-end devices, even Worker rendering might cause memory pressure. Consider a quality setting that reduces resolution or skips noise.
