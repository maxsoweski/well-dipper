# Plan: Lens Flare Ghost System

> Adds semi-transparent "ghost" shapes along the flare line — the line from a light source through screen center to the opposite side. Ghosts sweep across the screen as the camera rotates, matching real lens flare behavior. Uses Bayer dithering to stay consistent with the retro aesthetic.

---

## 1. Architecture: Where Does It Live in the Render Pipeline?

### Current pipeline (RetroRenderer.render())

```
Pass 1: Starfield → bgTarget (full resolution)
Pass 2: Scene objects → sceneTarget (low resolution, pixelScale 3)
Pass 3: HUD → hudTarget (320x320)
Pass 4: Composite shader → screen (blends bg + scene + HUD + warp effects)
```

### Where ghosts go

Ghosts are a **screen-space post-process effect** — they depend on knowing where each light source lands in screen coordinates, then drawing shapes at computed positions along the flare line. Two viable approaches:

**Option A — New render pass (recommended):** Add a dedicated `ghostTarget` render target at low resolution (same as `sceneTarget`). Render ghost quads into it as a separate pass between Pass 2 and Pass 4. The composite shader samples `ghostTarget` and blends it additively.

- Pro: Clean separation. Ghost sprites are real Three.js meshes in their own scene, easy to debug.
- Pro: Bayer dithering happens per-ghost in their fragment shaders (same pattern as StarFlare).
- Pro: Low-res target gives automatic chunky-pixel look for free.
- Con: One extra render pass (cheap — just a handful of alpha-blended quads).

**Option B — Composite shader:** Add ghost rendering directly into the composite fragment shader as math (like the hyperspace tunnel). Would require passing ghost positions as uniforms.

- Con: Uniform limit — each ghost needs position, size, color, opacity (4+ floats). With 5-8 ghosts per source and potentially 2 sources, that's 40-64 floats. Messy.
- Con: Hard to do per-ghost chromatic fringing in a single fullscreen shader.

**Decision: Option A.** New scene (`ghostScene`) rendered into a low-res target, composited additively.

### Integration point in RetroRenderer

```
Pass 1: Starfield → bgTarget
Pass 2: Scene objects → sceneTarget
Pass 2.5: Ghosts → ghostTarget (NEW — same resolution as sceneTarget)
Pass 3: HUD → hudTarget
Pass 4: Composite (now also samples ghostTarget, additive blend)
```

### New class: `LensFlareGhosts`

Lives at `src/rendering/LensFlareGhosts.js`. Owns:
- The ghost Three.js scene and its sprite pool
- The screen-space projection math
- The per-frame update loop (positions, occlusion, fade)

This is a **rendering-level system**, not a game object. It observes StarFlare instances but doesn't modify them.

---

## 2. What Objects Emit Flares and How Are They Registered?

### Emitters

Only **stars** (StarFlare instances) emit lens flare ghosts. Specifically:
- The primary star (`system.star`)
- The secondary star in binary systems (`system.star2`)
- Deep-sky navigable stars (`allStars` array in `spawnNavigableDeepSky`)

Planets, moons, and nebulae do not emit ghosts.

### Registration

`LensFlareGhosts` maintains a **source list** — an array of `{ worldPos: Vector3, color: [r,g,b], luminosity: number, radius: number }` refs. Sources are registered/unregistered when systems spawn/despawn:

```js
lensFlareGhosts.addSource(starFlare);   // called in spawnStarSystem / spawnNavigableDeepSky
lensFlareGhosts.removeSource(starFlare); // called in despawn/cleanup
lensFlareGhosts.clearSources();          // called on warp (clear everything)
```

Each source reads its world position from `starFlare.mesh.position` (already maintained by the game loop). No duplication of position data.

### Brightness threshold

Only sources above a minimum screen brightness produce ghosts. Distant/dim stars that have swapped to the tiny billboard (StarFlare's LOD system, `pixelSize < 20`) should NOT produce ghosts — they're too faint. The ghost system checks `starFlare._flareDisc.visible` as a quick gate.

---

## 3. Ghost Sprite Management

### Ghost definition

Each ghost is defined by a **template**:

```js
{
  t: 0.6,           // position along flare line (0 = screen center, 1 = mirror of source)
  size: 0.08,       // radius as fraction of screen height
  shape: 'circle',  // 'circle', 'ring', 'hexagon', 'disc'
  opacity: 0.15,    // base opacity (before distance/angle falloff)
  colorTint: [1.0, 0.95, 0.8],  // per-ghost color tint (multiplied with source color)
  chromOffset: 0.003, // chromatic fringe offset in UV space
}
```

### Ghost set per source

Each source gets **6-8 ghosts** from a fixed template array (same templates for all sources — real lenses produce the same ghost pattern regardless of which light makes them). The templates are tuned once and shared.

Suggested default set (based on real anamorphic lens ghost patterns):

| # | t | size | shape | opacity | notes |
|---|---|------|-------|---------|-------|
| 1 | 0.25 | 0.03 | disc | 0.12 | small bright dot near center |
| 2 | 0.45 | 0.06 | circle | 0.08 | soft circle |
| 3 | 0.60 | 0.10 | ring | 0.10 | thin ring, most visible ghost |
| 4 | 0.75 | 0.04 | hexagon | 0.07 | hexagonal aperture ghost |
| 5 | 0.85 | 0.12 | circle | 0.06 | large faint wash |
| 6 | 1.00 | 0.05 | disc | 0.09 | "counter-image" at mirror point |
| 7 | 1.15 | 0.03 | ring | 0.05 | past mirror, faint |

### Object pool

Pre-allocate a pool of `MAX_SOURCES * GHOSTS_PER_SOURCE` quad meshes (e.g., 3 * 7 = 21 quads). Each quad:
- `PlaneGeometry(1, 1)` — scaled per-frame
- `ShaderMaterial` with Bayer dithering, chromatic offset, shape SDF
- Added to `ghostScene`, toggled visible/invisible

No dynamic allocation during gameplay. When a source is removed, its ghosts go `visible = false` and return to the pool.

### Textures vs. SDF

Use **SDF (signed distance field) in the fragment shader** — no texture files needed. The shader computes circle, ring, hexagon, or filled disc from the UV coordinates. This is:
- Simpler (no asset pipeline)
- Resolution-independent
- Consistent with how StarFlare already works (all procedural)

---

## 4. The Flare Line Math

### Screen-space projection

Each frame, for each registered source:

1. **Project source world position to NDC:**
   ```js
   const ndc = source.worldPos.clone().project(camera);
   // ndc.x, ndc.y in [-1, 1], ndc.z = depth
   ```

2. **Check if on-screen:** If `|ndc.x| > 1.2` or `|ndc.y| > 1.2`, skip (allow slight offscreen for ghosts that trail onto screen).

3. **Check if behind camera:** If `ndc.z > 1` or `ndc.z < -1`, skip.

4. **Compute flare line direction:**
   The flare line goes from the source's screen position through screen center `(0, 0)` in NDC to the opposite side.

   ```
   sourceNDC = (sx, sy)
   ghostNDC(t) = -sourceNDC * t
   ```

   At `t = 0`: ghost is at screen center.
   At `t = 1`: ghost is at `(-sx, -sy)` — the mirror point.
   At `t > 1`: ghost is past the mirror point (some real lenses do this).

5. **Convert ghost NDC to world position on a plane in front of the camera:**
   Each ghost quad needs a 3D position. Use an "unproject" approach:
   - Place ghosts on a plane at a fixed distance in front of the camera (e.g., `camera near + 1`).
   - Unproject the ghost's NDC position to that plane.
   - Scale the quad to match the desired screen-space size.

   Alternatively (simpler): render `ghostScene` with an **orthographic camera** in NDC space. Ghost quads are positioned directly in NDC coordinates. No unprojection needed. This is cleaner since ghosts are purely a screen-space effect.

### Recommended: Orthographic ghost camera

```js
this._ghostCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
```

Ghost quads positioned at `(ghostNDC.x, ghostNDC.y, 0)` with scale derived from `size * 2` (since NDC goes -1 to 1, a size of 0.1 = 10% of screen height). Adjust x-scale by aspect ratio so circles stay circular.

---

## 5. Occlusion Testing

### The problem

If the star is behind a planet, the ghosts should fade out. Need to know: "Is the light source visible or blocked?"

### Approach: Raycasting (simplest for this project)

Three.js `Raycaster` from camera toward the source world position. Check intersection against planet and moon meshes.

```js
raycaster.set(camera.position, dirToSource);
const hits = raycaster.intersectObjects(occluders);
const sourceDistance = camera.position.distanceTo(source.worldPos);
const isOccluded = hits.some(h => h.distance < sourceDistance);
```

**Occluder list:** Planet meshes and moon meshes in the current system. Maintained as a flat array, updated on system spawn/despawn. Typically 1-8 objects — raycasting against this is extremely cheap.

**Why not depth buffer:** Reading back the GPU depth buffer is expensive (GPU stall) and Three.js doesn't make it easy. The logarithmic depth buffer further complicates pixel-level depth reads. CPU raycasting against a handful of spheres is simpler and faster for this use case.

### Fade behavior

- `occlusionFade`: smoothly lerps from 1.0 (visible) to 0.0 (hidden) over ~0.3 seconds when occlusion state changes. Prevents popping.
- Partial occlusion (source near planet edge): could check multiple rays in a small pattern, but a single center ray is probably fine for v1. Revisit if the pop looks bad.

---

## 6. Integration with Existing StarFlare.js

### Approach: Separate system, not an extension

`StarFlare` is a per-object class (one instance per star). It manages its own billboard quad, shader, and update. Lens flare ghosts are a **cross-cutting screen-space effect** that depends on the camera and all sources simultaneously. Bolting it onto StarFlare would be awkward.

**Keep them separate.** `LensFlareGhosts` is a new rendering system that references StarFlare instances but doesn't subclass or modify them.

### What StarFlare already handles (no changes needed)

- Diffraction spikes (the 8-pointed star pattern)
- Core glow and halo ring
- Chromatic aberration on spikes
- Brightness pulse from camera motion
- Distance LOD (billboard swap)
- Bayer dithering

### What LensFlareGhosts adds (new)

- Ghost sprites along the flare line
- Per-ghost SDF shapes
- Per-ghost chromatic fringing
- Occlusion fade
- Screen-space positioning

### Data flow

```
StarFlare instance
  ├── .mesh.position  → LensFlareGhosts reads world position
  ├── .data.color     → LensFlareGhosts reads star color
  ├── .data.luminosity → LensFlareGhosts reads for brightness scaling
  └── ._flareDisc.visible → LensFlareGhosts checks LOD visibility
```

No new methods or properties on StarFlare. LensFlareGhosts reads existing public data.

---

## 7. Bayer Dithering Integration

### Same 4x4 Bayer matrix

Use the identical `bayerDither(vec2 coord)` function that StarFlare.js and Planet.js already use. Copy-paste the GLSL function into the ghost fragment shader (it's 12 lines — no need for a shared include system).

### How it applies

Each ghost fragment:
1. Compute shape SDF → `shapeMask` (0 to 1)
2. Multiply by `opacity * occlusionFade * distanceFalloff` → `finalAlpha`
3. Apply chromatic offset (shift R and B UVs slightly before SDF lookup)
4. Compute `brightness = max(r, g, b)` of the final ghost color
5. `if (bayerDither(gl_FragCoord.xy) > brightness) discard;`

This gives the same stippled/dithered transparency as starflare spikes, planet atmospheres, and everything else in the game. Ghosts will "fizz" into existence as they brighten — exactly the retro look we want.

### Color

Ghost base color = source star color * per-ghost tint. Chromatic fringing shifts R and B channels outward from ghost center (same concept as StarFlare spike chromatic aberration, but radial instead of along-spike).

---

## 8. Performance Budget

### Max sources

| Tier | Sources | Ghosts/source | Total ghosts | When |
|------|---------|---------------|--------------|------|
| Normal | 2 | 7 | 14 | Binary star system |
| Deep sky | 3 | 7 | 21 | Open cluster (cap at 3 brightest) |
| Hard limit | 3 | 7 | 21 | Never exceed this |

### Cost per ghost

- 1 quad = 2 triangles, 4 vertices
- 1 shader with SDF + dithering (very cheap fragment shader)
- Additive blending, no depth write

21 quads at low resolution (pixelScale 3, so ~640x360 on a 1920x1080 screen) is negligible. The ghost render pass will take well under 0.1ms on the RTX 5080.

### LOD tiers for ghosts

| Star screen size | Ghost behavior |
|-----------------|----------------|
| `pixelSize >= 20` (flare disc visible) | Full ghost set, normal opacity |
| `pixelSize < 20` (billboard mode) | No ghosts (star too far/dim) |
| Source off-screen by < 20% | Ghosts still rendered (they trail onto screen) |
| Source off-screen by > 20% | Skip entirely |

### Occlusion raycast budget

1 ray per source per frame. At 3 sources max = 3 raycasts against ~8 sphere occluders. Cost: effectively zero.

---

## 9. Files to Create / Modify

### New files

| File | Purpose |
|------|---------|
| `src/rendering/LensFlareGhosts.js` | Ghost system class — scene, pool, update, projection, occlusion |

### Modified files

| File | Changes |
|------|---------|
| `src/rendering/RetroRenderer.js` | Add `ghostTarget` render target. Add Pass 2.5 in `render()`. Add `ghostTexture` uniform to composite shader. Blend ghosts additively in composite fragment shader. Add `resize()` handling for ghostTarget. |
| `src/main.js` | Import `LensFlareGhosts`. Instantiate it alongside RetroRenderer. Call `addSource()` / `removeSource()` / `clearSources()` during system spawn/despawn/warp. Call `update()` in the animation loop. Pass occluder list (planet/moon meshes). |

### Files NOT modified

| File | Why |
|------|-----|
| `src/objects/StarFlare.js` | Ghost system reads StarFlare data but doesn't change it |
| `src/objects/Planet.js` | Planets are occluders but don't need modification — raycast reads their mesh |

---

## 10. Implementation Order

Build in this order for fastest visible result:

### Phase 1 — Minimal visible ghost (target: see something on screen)

1. Create `LensFlareGhosts.js` with:
   - Constructor that creates orthographic camera and ghost scene
   - A single hardcoded ghost template (one circle, `t = 0.6`)
   - `addSource(starFlare)` that creates one quad with a simple shader (flat white circle SDF + Bayer dither + additive blend)
   - `update(camera)` that projects source to NDC, positions the ghost along the flare line
2. Modify `RetroRenderer.js`:
   - Add `ghostTarget` (same size as sceneTarget)
   - Render ghost scene in Pass 2.5
   - Add `ghostTexture` to composite shader, blend additively: `result += ghostSample.rgb;`
3. Modify `main.js`:
   - Instantiate `LensFlareGhosts`, call `addSource(star)` after star creation
   - Call `lensFlareGhosts.update(camera)` in the animation loop

**Result:** One white dithered circle appears on the opposite side of the screen from the star and tracks correctly as camera moves.

### Phase 2 — Full ghost set + color

4. Add all 7 ghost templates with varied `t`, `size`, `shape`, `opacity`
5. Add shape SDF variants (ring, hexagon, disc) to the fragment shader
6. Color ghosts using source star color * per-ghost tint
7. Add chromatic fringing (R/G/B channel offset in SDF lookup)

**Result:** Full ghost pattern with colored, shaped, dithered ghosts along the flare line.

### Phase 3 — Occlusion + fade

8. Add occlusion raycasting (camera → source, test against planet/moon meshes)
9. Add smooth `occlusionFade` lerp (0.3s transition)
10. Wire up occluder list from main.js (pass planet/moon meshes)

**Result:** Ghosts fade out when star goes behind a planet.

### Phase 4 — Polish + multi-source

11. Support binary stars (2 independent ghost sets on different flare lines)
12. Add brightness scaling by luminosity (O-class = stronger ghosts, M-class = subtle)
13. Add brightness pulse sync (read StarFlare's `uBrightPulse` to modulate ghost opacity)
14. Deep-sky star support (cap at 3 brightest sources)
15. Source cleanup on warp/despawn (`removeSource`, `clearSources`)
16. Edge case: both stars near screen center = ghosts overlap nicely (additive blend handles this naturally)

### Phase 5 — Tuning

17. Adjust ghost template values (sizes, opacities, positions) by eye
18. Test with different star types (M through O class)
19. Test binary systems (two flare lines crossing)
20. Test occlusion transitions (orbit camera around a planet blocking the star)
21. Test performance on lower-end hardware (if relevant)
