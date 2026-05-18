# Research: Rendering Physics Data

> Compiled 2026-03-17 from 4 parallel research agents exploring the Well Dipper codebase.
> Covers: non-main-sequence stars, ring LOD, belt composition, sky feature overlays.

---

## 1. Non-Main-Sequence Star Rendering

### Current State
- Star.js: emissive IcosahedronGeometry + additive glow sprite (3.5x radius corona)
- StarFlare.js: lens diffraction spikes + chromatic aberration + Bayer dithering
- All stars assumed main-sequence; no branching on stellar evolution state

### Implementation Per Type

| Type | Surface | Signature Effect | New Mesh? | Post-Process? | Perf Cost |
|------|---------|-----------------|-----------|---------------|-----------|
| **White dwarf** | Tiny blue-white sphere | Tighter corona (1.5x), Rayleigh scattering halo (2.5x) | No | No | Minimal |
| **Neutron star** | Invisible core | Rotating lighthouse beam (animated billboard cone shader, 1-100 Hz spin) | Yes (billboard) | No | 1 quad |
| **Red giant** | Clamped-size orange-red sphere with limb darkening | Huge glow (actual physical radius, up to 100x solar). Surface clamped so camera doesn't break, glow scales with real size | No | No | Minimal |
| **Black hole** | Invisible (raycaster only) | Accretion disk (thin ring, hot inner blue-white → cool outer red-orange, Doppler shift animation). Gravitational lensing (UV displacement in composite shader) | Yes (disk) | Yes (lensing) | 1 mesh + shader |
| **Wolf-Rayet** | Blue-white, bright (5.5x glow) | Expanding wind shell (transparent bubble, cyan, fades over time) | Yes (shell) | No | 1 mesh |
| **Protostar** | Dim orange-red (0.6x brightness) | Circumstellar dust disk (brownish, rotating, very transparent) | Yes (disk) | No | 1 mesh |

### Key Design Decisions
- **Red giant size problem:** Render surface at clamped size, glow sprite at actual physical radius. Close-up: tiny star inside massive orange corona. Elegant, no camera rework needed.
- **Black hole lensing:** Simple UV displacement in RetroRenderer composite shader. Deflects starfield sampling toward BH screen position. Cheap, retro-compatible.
- **Pulsar beam:** Billboard quad aligned to spin axis, fragment shader computes cone intersection + rotation. Visible flicker at low render resolution adds to retro feel.
- **All types:** Use Bayer dithering + posterization to match retro aesthetic. Additive blending for glows.

### Integration
- Star instantiation in main.js checks `system.stellarEvolution.stage` and `remnantType`
- Picks Star/WhiteDwarf/PulsarBeam/RedGiant/BlackHole/WolfRayetStar/Protostar class
- Animated types (pulsar, accretion disk, wind shell) need `update(deltaTime)` calls

---

## 2. Ring LOD Rendering

### Current State
- Planet.js line 752-882: single RingGeometry(innerR, outerR, 64)
- Fragment shader: 2 hardcoded sine-wave bands + 1 fake Cassini gap + moon-cleared gaps
- Bayer dithering + posterization + planet shadow on rings
- Renders at low resolution (pixelScale 3)

### Physics Data Available (not yet consumed)
```
rings.ringlets: [{ innerR, outerR, opacity, composition }]  // up to 16
rings.gaps: [{ radius, width, moonIndex, resonance }]       // up to 8
rings.composition: 'ice' | 'rock' | 'dust' | 'mixed'
rings.density: 0-1 (age-dependent)
```

### Three-Tier LOD

| Level | Condition | Rendering | Draw Calls | Triangles |
|-------|-----------|-----------|------------|-----------|
| **Distant** | > 100x planet radius | Simple quad, single composition color | 1 | ~4 |
| **Medium** | 20-100x planet radius | Enhanced RingGeometry — physics-driven ringlet bands + gap iteration in shader | 1 | 4k-8k |
| **Close-up** | < 20x planet radius | New RingParticles class (InstancedMesh, 200-500 particles) | 4 | 4k-10k |

### Medium LOD Shader (key change)
Replace hardcoded sine-wave bands with uniform arrays:
- `ringletInnerRadius[16]`, `ringletOuterRadius[16]`, `ringletOpacity[16]`, `ringletColor[16]`
- `gapRadius[8]`, `gapWidth[8]`
- Shader iterates ringlets, accumulates density; iterates gaps, subtracts density
- Composition drives color per ringlet (ice=bright cyan-white, rock=dark grey, dust=brown)

### Close-up LOD
- New `RingParticles.js` class mirroring AsteroidBelt.js architecture
- 4 InstancedMesh groups (shape variants), per-instance composition color
- Particles distributed across ringlets, avoiding gaps
- Ice chunks, rock fragments, dust — low-poly icosahedrons with Bayer dithering

### LOD Switching
- Add to Planet.update(): check camera distance, swap ring meshes
- No visible pop: distance thresholds are wide (80x radius span for medium)
- All LODs render in scene pass (low-res), composited normally

---

## 3. Belt Compositional Rendering

### Current State
- AsteroidBeltGenerator.js: 250-450 asteroids, uniform grey colors (6 grey tones + jitter)
- AsteroidBelt.js: 4 InstancedMesh groups (shape variants), per-instance color via InstancedBufferAttribute
- Per-instance color already supported — just needs different colors!

### Implementation (Low Risk, ~260 lines total)

**AsteroidBeltGenerator changes (~30-40 lines):**
- Add `physics` parameter to `generate()`
- For each asteroid, determine which compositionZone its radius falls in
- Assign color from zone: S-type [0.50, 0.45, 0.40], C-type [0.15, 0.13, 0.12], mixed [0.35, 0.33, 0.32]
- 2-3% chance of metallic glint [0.70, 0.65, 0.55]
- Kirkwood gaps: skip asteroid with 60-80% probability if inside a gap radius
- Kuiper belts: always dark [0.12, 0.11, 0.10], slightly larger particles (1.2-1.5x)
- Handle null physics gracefully (backward compat with old grey palette)

**AsteroidBelt.js:** No changes needed — already supports per-instance colors.

**New TrojanCluster.js (~200 lines):**
- Same InstancedMesh approach as AsteroidBelt
- Distributes 50-200 asteroids in cone around L4/L5 point
- Angular spread from cluster.spreadAngle, radial 5-10% libration
- Single InstancedMesh per cluster (simpler than belt)
- Same shader (dual-star lighting, Bayer dither)

**StarSystemGenerator:** Pass `beltPhysics` to AsteroidBeltGenerator.generate() (2 lines)

**main.js:** Instantiate TrojanCluster objects from `system.trojanClusters` (~15 lines)

### Performance
- Composition colors: zero cost (instancing already handles per-instance color)
- Kirkwood gaps: small perf gain (fewer asteroids)
- Trojans: +2-6 draw calls per system (50-200 asteroids each). RTX 5080 won't notice.

---

## 4. Sky Feature Overlays

### Current State
- Starfield.js: point sprites on sky sphere (full resolution)
- GalaxyGlow.js: IcosahedronGeometry sky sphere with analytical density shader (full resolution)
- RetroRenderer: dual-resolution compositor (full-res starfield + low-res scene + composite)
- No galactic feature visibility from inside systems

### Architecture: New Full-Resolution Sky Layer

```
Pass 1:   Starfield (full-res)
Pass 1.5: ★ Sky Features (full-res, NEW)     ← nebula glows, cluster knots, dark patches
Pass 2:   GalaxyGlow (full-res, existing)
Pass 3:   Scene objects (low-res)
Pass 4:   Composite (blends all via alpha)
```

New `skyScene` + `skyTarget` in RetroRenderer (same pattern as starfield pass).

### Per-Feature Rendering

| Feature | Approach | Shader Basis |
|---------|----------|-------------|
| **Emission nebula** | 2-3 billboard cloud planes, FBM noise (reuse Nebula.js pattern), additive blending | Existing nebula shader |
| **Dark nebula** | Single mask billboard, writes transparent to block starfield behind | New absorption shader |
| **Open cluster** | Extra bright star points in sky scene | Point sprite (like Starfield) |
| **Globular cluster** | Billboard (far) → particle field (close, <0.5 kpc). LOD swap. | Radial gradient + points |
| **OB association** | Scattered bright blue-white points across wide sky area | Point sprite |
| **Supernova remnant** | Ring-shaped billboard with [OIII] green emission | Ring SDF + noise |

### Angular Size & Brightness
```
angularRadius = atan2(feature.radius, distance)
brightness = baseFeatureBrightness / (1 + (distance/featureScale)²)
```

### "Inside a Feature" Effect
When `insideFeature=true`: ambient color tint in composite shader (15% blend of nebula color across all pixels). Subtle permeation of the sky.

### Performance
- <1ms per feature, max 8-10 visible simultaneously
- Frustum culling: only render features whose bounding sphere intersects camera
- Feature regions cached in GalacticMap (no regeneration cost)

### RetroRenderer Changes
- Add `skyScene`, `skyTarget` (full-res render target)
- New render pass between starfield and scene
- Composite shader gains `skyTexture` uniform, blends: `scene > sky > starfield`

---

## Implementation Priority

Based on effort vs visual impact:

| Priority | Feature | Effort | Visual Impact | Blocks |
|----------|---------|--------|---------------|--------|
| 1 | **Belt composition + gaps** | Low (~30 lines in generator) | Medium — visible color gradient + gap structure | Nothing |
| 2 | **Trojan clusters** | Low (~200 line new file) | Medium — new visible objects in systems | Nothing |
| 3 | **Ring medium LOD** (ringlets + gaps) | Medium (~100 lines shader) | High — rings look dramatically better | Nothing |
| 4 | **Non-MS star basics** (white dwarf, red giant) | Medium (~200 lines) | High — new visual variety in systems | Stellar evolution data (done) |
| 5 | **Sky feature overlays** (emission nebula first) | Medium-High (~300 lines + RetroRenderer) | Very High — galaxy feels alive | Feature layer (done) |
| 6 | **Black hole + accretion disk** | Medium (~250 lines + post-process) | Very High — dramatic new destination | Stellar evolution + non-MS routing |
| 7 | **Ring close-up LOD** (particles) | Medium (~200 lines) | Medium — only visible very close | Ring medium LOD |
| 8 | **Pulsar beam** | Low (~100 lines) | Medium — cool animated effect | Non-MS star routing |
| 9 | **Ring distant LOD** | Low (~50 lines) | Low — minor optimization | Nothing |
| 10 | **Protostar + Wolf-Rayet** | Medium (~300 lines) | Low — rare types | Non-MS star routing |

## File Summary

| File | Action | Est. Lines |
|------|--------|-----------|
| `AsteroidBeltGenerator.js` | Modify: add physics param, zone colors, gap culling | 30-40 |
| `TrojanCluster.js` | Create: InstancedMesh asteroid cluster at L4/L5 | 200 |
| `RingParticles.js` | Create: close-up ring LOD (InstancedMesh) | 200 |
| `Planet.js` | Modify: ring shader uniforms, LOD switching | 150 |
| `WhiteDwarf.js` | Create: thin corona, blue-white | 80 |
| `RedGiant.js` | Create: clamped surface, huge glow | 120 |
| `BlackHole.js` + `AccretionDisk.js` | Create: invisible core, disk shader, lensing | 250 |
| `PulsarBeam.js` | Create: rotating lighthouse billboard | 100 |
| `WolfRayetStar.js` + `StellarWindShell.js` | Create: bright star + expanding shell | 200 |
| `Protostar.js` + `CircumstellarDisk.js` | Create: dim star + dust disk | 180 |
| `SkyFeature.js` (base) | Create: base class for sky features | 50 |
| `EmissionNebulaSky.js` | Create: H-alpha cloud billboards | 150 |
| `DarkNebulaSky.js` | Create: absorption mask | 80 |
| `OpenClusterSky.js` | Create: bright star knot points | 60 |
| `GlobularClusterSky.js` | Create: billboard + points LOD | 120 |
| `SupernovaRemnantSky.js` | Create: ring shell billboard | 80 |
| `RetroRenderer.js` | Modify: add sky pass, composite update | 40 |
| `StarSystemGenerator.js` | Modify: pass physics to belt gen | 2 |
| `main.js` | Modify: star type routing, trojans, sky features | 80 |
| **Total** | | **~2,200 lines** |
