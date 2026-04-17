# Warp Tunnel — Implementation Plan

**Status:** Research/planning only. No code changes have been made.
**Author:** Claude (research agent, 2026-04-11)
**Target file surface (recommendation):** new `src/effects/WarpTunnelLayer.js`, edits in `src/rendering/RetroRenderer.js`, `src/effects/WarpEffect.js`, minor edits in `src/main.js`.

---

## 0. TL;DR

The current warp already has four phases (FOLD → ENTER → HYPER → EXIT) and already runs a 3D ray-cone tunnel in the composite shader. What it *does not* do is wallpaper the walls of that tunnel with stars. The walls are just anaglyph ring bands plus a cream-to-grey depth gradient. What Max wants is for those walls to be **made of starfield** — so the experience reads as "I am flying through a corridor of stars" rather than "I am in a vintage tube of light rings."

The shortest path to that is to keep the existing ray-cone tunnel and add a procedural star function inside `hyperspace()` in `RetroRenderer.js`. This is Strategy B (ray-marched tunnel shader) and it is the recommended approach. Phase 1 POC is ~40 lines of GLSL inside an existing function.

---

## 1. Current warp implementation (Step 1)

### 1.1 Files

- `src/effects/WarpEffect.js` — timing + uniform state machine. No rendering.
- `src/rendering/RetroRenderer.js` — composite shader; owns the hyperspace tunnel fragment function (`hyperspace()` at line ~332) and the portal/fizz/CA logic in `main()` (lines ~543–606).
- `src/rendering/sky/StarfieldLayer.js` — sky-sphere points with a vertex-shader fold that pulls stars toward `uRiftCenter` in NDC space during FOLD/ENTER. This is the "2D-feeling" pinch Max is referencing.
- `src/main.js` — drives `warpEffect.update(dt)` inside the frame loop (around line 4775), copies uniforms into `starfield.setWarpUniforms()` and `retroRenderer.setWarpUniforms()`, moves the camera forward (`cameraForwardSpeed`), handles the pre-warp camera slerp (`beginWarpTurn()` at line ~5749), calls `_hideCurrentSystem()` at phase boundaries, and owns the `warpSwapSystem()` / `skyRenderer.activate()` regeneration at HYPER start.
- `src/audio/SoundEngine.js` — `warpLockOn`, `warpCharge`, `warpEnter`, `warpExit` sound slugs exist.
- `src/audio/MusicManager.js` — `'hyperspace'` music track crossfades in at HYPER start (see `main.js` line 1455).

### 1.2 Phases and timing

From `WarpEffect.js`:

| Phase   | Duration | What happens visually | Camera |
|---------|---------:|----------------------|--------|
| FOLD    | 4.0 s    | `StarfieldLayer` vertex shader pulls each point radially toward `uRiftCenter` in NDC. Brightness ramps from 1× to 5×. Scene objects fade in the last 30%. A "portal" circle grows from the rift center (`uFoldGlow` drives `portalRadius` in the composite shader) and inside it you can already see the hyperspace tunnel. | Accelerates forward `0 → 40 u/s` |
| ENTER   | 1.5 s    | Portal keeps growing until it swallows the screen. Stars fade out. | `40 → 80 u/s` |
| HYPER   | 3.0 s    | Full 3D tunnel visible. `warpSwapSystem()` + `skyRenderer.activate()` fires ~0.15 s in, hidden behind the opaque tunnel. Tunnel uses `uHyperTime` as a forward-scroll phase, *not* driven by real camera motion inside the shader — the "motion" is a synthetic `speed = time * 12.0` offset. | `80 u/s` (real world-space motion, but the tunnel shader has no knowledge of it) |
| EXIT    | 2.0 s    | A "hole" opens at the screen center (`uExitReveal`) with dithered fizzing edges, revealing the new system. | Decelerates `80 → 0` |

Total: 10.5 s. During the whole thing `main.js` physically pushes the camera forward in world space so that when EXIT ends the camera is already the correct distance from the new system's orbital approach point (see `warpSwapSystem()` in `main.js`, lines 3734–3774 — `travelDist ≈ 463` units).

### 1.3 What the "3D tunnel" currently looks like

In `RetroRenderer.js`, the fragment function `hyperspace(uv, time)` (lines 332–401):

- Builds a perspective ray `rd = normalize(vec3(centered * 1.4, 1.0))`.
- Intersects with a **cone** (not a cylinder — `taper = 0.15` narrows the tube), apex at ~27 units ahead.
- `tWall = tunnelR / (length(rd.xy) + taper * rd.z)` — one-line analytic intersection, no ray march.
- Computes `wallZ` (depth along tunnel), then renders the wall as:
  - A cream-to-grey-purple depth gradient (`nearColor` → `farColor`).
  - Two anaglyph ring bands (red and cyan shifted ± `offset` along z) that scroll forward via `speed = time * 12.0`.
  - A central white vignette glow at the vanishing point.
- Returns a single `vec3` color per fragment.

**There are no stars in the current tunnel.** The walls are smooth tinted surfaces with ring stripes. That is the thing Max wants to change.

The tunnel IS genuinely 3D — ray/cone math with correct perspective. What's "flat" is the star-fold effect that happens *before* the tunnel takes over, where the `StarfieldLayer` vertex shader pulls points toward a 2D NDC center.

### 1.4 Trigger paths

- **Player flow:** click-to-select a star → `warpTarget.direction` set → Spacebar → `beginWarpTurn()` (line 5749) → camera slerps to face target → `warpEffect.start(dir)` (line 4737) → state machine runs.
- **Autopilot / idle flow:** `AutopilotNavSequence._initiateWarp()` fires an `onWarpReady` callback consumed in `main.js` → same `beginWarpTurn()` path.
- **Manual no-target flow:** Spacebar with no selected star → `autoSelectWarpTarget()` picks one, then same path.

---

## 2. Current starfield renderer (Step 2)

### 2.1 Architecture

- **Generation:** `src/generation/HashGridStarfield.js` does the heavy lifting. For each of 10 spectral tiers (O, B, A, F, G, K, M + Kg/Gg/Mg giants) it hashes a 3D grid, applies a density field, and emits a deterministic list of stars within a visibility radius of the player's galactic position. Every star is fully determined by its grid cell — no storage. See `TYPE_CONFIG` at line 73. Real catalog stars (HD/HIP) are layered on top via `RealStarCatalog`.
- **Positioning:** `StarfieldGenerator.generate()` (referenced in `SkyRenderer.prepareForPosition()`) turns the hash-grid results into a flat `{ positions, colors, sizes }` buffer. Positions are *already projected onto a sky sphere* of `skyRadius = 500` — each real world star direction is mapped to a point at radius 500 from the camera. The sky sphere follows the camera (`StarfieldLayer.update()` copies `cameraPosition` into `mesh.position`). **Stars are effectively at infinity — moving the camera does not change which star sits in which direction.**
- **Rendering:** `src/rendering/sky/StarfieldLayer.js` uploads the arrays into `THREE.BufferGeometry` and renders with `THREE.Points` + a custom `ShaderMaterial`. Vertex shader does the optional NDC fold (lines 92–127). Fragment shader does circular-glow sprites with Bayer-dithered edge (lines 130–178).
- **Coordination:** `src/rendering/SkyRenderer.js` owns the starfield layer together with `ProceduralGlowLayer` (galactic glow) and `SkyFeatureLayer` (nebulae). All three render into a shared scene that becomes `Pass 1` of `RetroRenderer.render()`.

### 2.2 Can the existing starfield be "wrapped onto a tunnel wall"?

Short answer: **not directly, but its data can feed a tunnel renderer.**

- The existing mesh is a `THREE.Points` on a sphere. You cannot magically remap those point positions to a cylinder without either: (a) mutating their positions every frame (expensive, and destroys the "stars at infinity" invariant that the rest of the game depends on), or (b) rendering them normally and applying a *screen-space* coordinate warp (Strategy C below).
- What you *can* do cheaply is: during warp, read the star position array and treat each star's direction as an input to a **separate** tunnel renderer. Each star becomes a billboard positioned on the interior of a cylinder mesh, UV-mapped so it lands at the right angular offset. This is effectively Strategy A's "render stars to a texture once" trick.
- The simpler alternative that matches the codebase's existing idioms: **generate new stars procedurally in the tunnel shader** using the same hash-cell approach `HashGridStarfield` uses, but in (ring-angle, depth-along-axis) space instead of (x, y, z). This gives you infinite stars with no CPU work and no buffers, and naturally integrates with the ray-cone intersection already in `hyperspace()`.

---

## 3. Rendering strategy evaluation (Step 3)

### 3A. Cylinder mesh textured with starfield

**How it works.** `THREE.CylinderGeometry` (open-ended, `side: BackSide`) along the camera forward axis. Bake the existing starfield to an equirectangular `THREE.WebGLRenderTarget` at warp start and UV-map it onto the cylinder interior. Camera flies along the cylinder's axis; scroll UVs or translate the mesh.

**Fit.** New mesh in `retroRenderer.scene` (Pass 2). No equirectangular capture code exists in this project today — all new territory.

**Code surface.** New `src/effects/WarpTunnelLayer.js` (~250 lines), a bake helper in `StarfieldLayer.js`, lifecycle hooks in `main.js`.

**Perf.** One-time capture during FOLD is expensive (6 cubemap faces or lat/long projection). Cylinder rendering itself is cheap.

**Visual fidelity.** Strong on "these are literally the same stars I was just looking at." Weak on "infinite tunnel depth" — a fixed texture on a finite mesh doesn't give the parallax of new stars streaming in from the vanishing point. Aliasing at the far end.

**Retro aesthetic.** Fine. Can dither the sampled texture.

**Complexity.** Medium-high. Equirectangular bake from `THREE.Points` is non-trivial (point sprites are screen-space sized, so the bake camera needs a special size rule). UV seam handling. Multiple files.

**Risks.** Equirectangular bake failure modes; UV seam tearing; no true depth parallax without additional shader work.

### 3B. Ray-marched tunnel shader (RECOMMENDED)

**How it works.** Modify (or replace) the existing `hyperspace()` function in `RetroRenderer.js`. Keep the ray-cone intersection. For each ray that hits a wall at `hitPos`, compute cylindrical coordinates `(angle, z)` where `angle = atan(hitPos.y, hitPos.x)` and `z = hitPos.z + uHyperTime * speed`. Quantize `(angle, z)` into cells (the same idea `HashGridStarfield.js` uses). For each cell, hash it to decide whether a star lives there; if yes, hash again for color, size, and sub-cell position; splat the star onto the wall as a brightness + color contribution. Multi-tier: run a few passes with different cell sizes for dense small stars + sparse bright ones, mirroring the O/B/A/F/G/K/M hierarchy in miniature.

**Fit with existing architecture.** Excellent. The existing `hyperspace()` function is the right place for this surgery. The ray-marched pattern is already used by `ProceduralGlowLayer.js` (hash noise, FBM, ray-march loop) so the style is consistent. Adds zero new meshes, no render targets, no lifecycle hooks. The fragment function still returns a single `vec3` and is still masked by `hyperMask`, so all the existing portal/fizz/exit logic keeps working untouched.

**Code surface.**
- `src/rendering/RetroRenderer.js`: rewrite/extend `hyperspace()` (lines 332–401). Probably grows by ~60 lines. Possibly add 2–3 new uniforms: `uTunnelStarDensity`, `uTunnelStarBrightness`, maybe `uTunnelPalette` for theming. No changes needed outside this function if tuning is hard-coded.
- `src/effects/WarpEffect.js`: potentially add 1–2 new uniforms to pass through (e.g. `tunnelTimeScale`). Or do nothing — `uHyperTime` is already enough to drive the scroll.
- `src/main.js`: nothing changes, or one line to feed new uniforms.

**Perf characteristics.** Slightly more per-pixel work than current. Current `hyperspace()` is ~15 ALU ops per fragment; the new version adds ~30 ops for hash + star tests across 2–3 tiers. Runs only inside `hyperMask > 0.01` pixels (already gated in the composite shader at line 602), so during FOLD it only runs inside the growing portal circle. On a 16 GB RTX 5080 this is nothing; on mobile it is also fine because the pixel scale (`RetroRenderer.pixelScale`) is already reducing the sceneTarget resolution — and the composite pass runs at full framebuffer res, so the cost is actually bounded by screen pixels. Expect < 0.5 ms added.

**Visual fidelity.** High for what Max is asking. "The tunnel walls are made of stars" is literally what this does. The stars live on the cone wall, scroll forward with `uHyperTime`, appear at the distant apex, sweep past the camera as they grow, and vanish behind. Density is tuneable. Because the stars are computed in `(angle, z)` space on the wall, *all* the motion is pure depth parallax — exactly the feeling of flying through a stellar corridor. The stars don't have to be the *same stars* as the sky (and probably shouldn't be — the source galaxy stars are too sparse in any given direction to fill a tunnel wall densely).

**Retro aesthetic.** Very good. The function already outputs into the composite shader's fragment pipeline that passes through `applyPalette()` and the dither chain. Adding Bayer-dithered star edges is trivial — it's the same `bayerDither()` pattern used in `StarfieldLayer.js`. Nearest-neighbor sampling is already in effect for the `sceneTarget`. The `hyperMask` gating means stars only appear in the hyperspace region.

**Complexity.** Low-medium. Self-contained to one GLSL function. Can be iterated live in a focused test harness without touching game state. Tunable constants: cell angular size, cell depth size, density per tier, brightness falloff with depth.

**Risks.**
- Hash aliasing at the cone apex where cells become microscopic. Mitigation: cap cell density at a minimum angular size, or fade stars to black past `depthNorm > 0.95`.
- Cone apex singularity (infinite density toward the vanishing point). Mitigation: already handled — `depthFade = 1.0 - depthNorm²` can attenuate brightness at the apex.
- The synthetic `uHyperTime` scroll may not match the real camera world-space motion, but *that is already true of the current tunnel* and no one notices because the tunnel is opaque and the transition happens behind it. Keep the existing behavior.
- Getting a retro dither + pixel-art look requires care — a naive ray-marched starfield can look too "smooth" against the rest of the game. Use `floor(gl_FragCoord.xy / pixelSize)` for the hash coord so stars snap to pixel boundaries.

### 3C. Bent starfield sampling via coordinate transform

**How it works.** Keep the sky sphere. Extend the `StarfieldLayer` vertex shader with a second warp mode that bends NDC positions into a tunnel shape (stars near center pushed out into a forward rim, stars far from center pulled into a near rim). Scroll with `uHyperTime`.

**Fit.** Doesn't break anything but forces matching warps in `ProceduralGlowLayer` and `SkyFeatureLayer` so the sky layers stay consistent. Scope creeps fast.

**Code surface.** `StarfieldLayer.js` + `ProceduralGlowLayer.js` + `SkyFeatureLayer.js` + `SkyRenderer.js`. Easily 5 files.

**Perf.** Free.

**Visual fidelity.** Weird. You get the original ~18,000 stars re-geometered into a tunnel, which looks sparse vs. Strategy B. The existing fold warp (pulls stars inward) and the tunnel warp (pushes stars outward) fight each other during the ENTER → HYPER handoff.

**Retro aesthetic.** Same as current starfield (dithered point sprites). Good.

**Complexity.** Medium-high. Coupled shader edits across layers are painful to debug.

**Risks.** High. Structurally this is "a 2D effect bent into a 3D shape" — exactly the shape of the original complaint, just dressed up.

### 3D. Recommendation

**Strategy B — ray-marched tunnel shader.**

Reasoning (criteria: speed to ship, visual match to the stated goal, fit with existing architecture, reversibility):

1. **Speed to ship:** Strategy B is the smallest diff. It lives in one GLSL function. Strategy A builds a whole new pipeline; Strategy C edits 5 files.
2. **Visual match:** Strategy B is the only one that natively produces "infinite tunnel depth with stars streaming past." A is a cylinder texture that just scrolls. C is a re-shaped flat sky.
3. **Fit:** Strategy B *extends what is already there* — the `hyperspace()` function already does ray-cone intersection and already runs only where hyperspace is visible. The new code slots in.
4. **Reversibility:** If Strategy B doesn't look right after a day of tuning, it can be ripped out in one commit. A and C both leave architectural residue.

The one thing Strategy B doesn't get you is literal continuity with the sky stars — the tunnel stars are newly procedural, not the same ones that were on the sphere. Max's request was "wallpapered with the starfield" — whether this means "the literal stars I was just looking at" or "stars that look like the starfield" is a Step 7 open question. If it's the former, consider a hybrid: Strategy B for the bulk of the tunnel wall plus an equirectangular bake of the sky sphere sampled onto the cone wall at low weight for the first ~0.5 seconds of HYPER. That gives continuity without the full cylinder-mesh pipeline of Strategy A.

---

## 4. Tunnel geometry and motion (Step 4)

### 4.1 Length and duration

- Total warp is 10.5 s (fixed). HYPER itself is 3.0 s. Those numbers should not change in v1 — they're tuned to match audio beats (`warpEnter` fires at HYPER start, `hyperspace` music crossfades in) and to the `warpSwapSystem()` camera-teleport distance math in `main.js` (`travelDist ≈ 463`).
- Tunnel "length" in shader space is whatever the ray-cone math defines. With `tunnelR = 4.0` and `taper = 0.15`, the apex is at `maxZ = 27`. That's fine — it's not meant to correspond to world units. The synthetic `speed = uHyperTime * 12.0` provides the forward scroll.
- **No need to scale with warp distance in v1.** All warps currently look the same regardless of distance — keep that. Scaling could be a Phase 3 polish item.

### 4.2 Opening and closing

The current implementation *already* does opening/closing via the portal mechanic: a circular aperture grows from the rift center during FOLD, hyperspace becomes visible through it, then the portal swallows the screen by ENTER's end. This is good and should be kept. Max's request is not "change how it opens" — it's "change what's on the walls once open." Same goes for EXIT: the fizzing hole opens at the vanishing point and reveals the new system.

Two small improvements worth considering:
- At the moment `uFoldGlow > 0.25` reveals the tunnel, the tunnel's far depth (cone apex) is the *only* thing visible inside the tiny portal. With stars on the wall, the portal will suddenly reveal a dense star field that may read as over-bright. Consider fading star density by `smoothstep(0.25, 1.0, uFoldGlow)` so stars ramp in as the portal grows.
- The retro/pixel aesthetic wants hard edges, not soft reveals. The current Bayer-dithered portal mask already does this well — keep it.

### 4.3 In-tunnel motion

- Current: `speed = uHyperTime * 12.0` produces a steady forward scroll. Stars on the walls would pan past at constant apparent speed. Good.
- Should the speed be constant or accelerating? The existing `cameraForwardSpeed` is constant 80 u/s through HYPER — match that pattern and keep the tunnel scroll constant too. Accelerating/decelerating scroll during HYPER would confuse the eye.
- Motion cue: depth parallax alone is enough because the stars are on a cone and near stars sweep past fast while far stars move slowly. That's the canonical hyperspace sensation. No need for star streaking (in fact, streaking would fight the retro dither aesthetic).
- Consider a subtle low-frequency camera shake in `main.js` during HYPER for tactile feedback. Not in scope for v1.

### 4.4 Exit transition

Existing exit is already right: `uExitReveal` opens a fizzing dithered hole at the tunnel vanishing point, the hole grows to cover the screen, and the new system shows through. The new stars on the walls don't change this — the exit mask continues to clip the tunnel contents.

### 4.5 Target sighting

Currently no — the tunnel is opaque and you cannot see the destination through it. Adding a "target sighting" feature (e.g. the destination star visible as a bright dot at the vanishing point) is a possible Phase 3 polish. Not required for v1. It would mean reducing the `centerGlow` and instead sampling the target star's color into the vanishing point.

---

## 5. Integration with game state (Step 5)

### 5.1 State transitions

Warp state lives in `WarpEffect.state`: `'idle' | 'fold' | 'enter' | 'hyper' | 'exit'`. The state machine is advanced by `warpEffect.update(dt)` called from `main.js` at line 4777, inside the `if (warpEffect.isActive)` block. This block also:
- Projects the rift direction to NDC/UV for shader uniforms.
- Calls `starfield.setWarpUniforms()` and `retroRenderer.setWarpUniforms()`.
- Slerps the camera to face the rift during FOLD/ENTER.
- Physically translates the camera forward by `cameraForwardSpeed * dt`.
- Hides the current system via `_hideCurrentSystem()` at FOLD→ENTER and ENTER→HYPER boundaries.
- On HYPER start: `warpEffect.onSwapSystem` fires (line 1453), which plays `warpEnter` SFX, starts `hyperspace` music, calls `warpSwapSystem()` (creates new system GPU resources), and calls `skyRenderer.activate()` (regenerates sky layers for new galactic position).
- On EXIT complete: `warpEffect.onComplete` fires, plays `warpExit`, calls `warpRevealSystem()`.

### 5.2 Camera handoff

During warp, `cameraController.bypassed = true` is set at `beginWarpTurn()` (line 5773), releasing camera control to the warp code. The flight system's `FlightDynamics` is not active. Autopilot (`autoNav`) is suspended but kept as state. After warp, `warpRevealSystem()` re-establishes the flythrough camera or flight dynamics depending on mode.

### 5.3 Player control during warp

Locked cinematic — no input. `warpEffect.isActive` is checked in key handlers (e.g. `main.js` line 5182: `KeyN` disabled during warp) and in `mousemove` (line 5121: hover suppressed). This is fine and need not change.

### 5.4 Autopilot integration

`AutopilotNavSequence` fires `_initiateWarp()` → dispatches `onWarpReady` → main.js calls `beginWarpTurn()` → same path as manual warp. Autopilot does *not* skip warps — each stop is a full 10.5-second cinematic. The new tunnel will apply automatically to autopilot warps.

### 5.5 Audio hooks

- `beginWarpTurn()` → `soundEngine.play('warpLockOn')`.
- `warpEffect.onSwapSystem` (HYPER start) → `soundEngine.play('warpEnter')` + `musicManager.play('hyperspace', 0.3)`.
- `warpEffect.onComplete` (EXIT done) → `soundEngine.play('warpExit')`.

These timing hooks are in `main.js`, not in `WarpEffect.js`. The new tunnel must not change these timings or the `FOLD_DUR`/`ENTER_DUR`/`HYPER_DUR`/`EXIT_DUR` constants in `WarpEffect.js` without coordinating with the audio cues. **Do not touch `WarpEffect.js` phase durations in v1.**

---

## 6. Implementation plan (Step 6)

Recommended path: **Strategy B** extended iteratively.

### Phase 1 — Proof of concept (2–4 hours)

**Goal:** A standalone HTML test page where a fullscreen quad shows a ray-marched tunnel with procedural stars on the walls, and a slider controls `time`. Does not touch game state.

**Files created:**
- `/home/ax/projects/well-dipper/tunnel-lab.html` (~80 lines, following the pattern of `galaxy-overview.html`).
- Inline `<script type="module">` block with a `THREE.ShaderMaterial` wrapping the new `hyperspace()` function.

**Files referenced (read-only):**
- `/home/ax/projects/well-dipper/src/rendering/RetroRenderer.js` lines 329–401 for the existing `hyperspace()` function as a starting point.
- `/home/ax/projects/well-dipper/src/rendering/sky/StarfieldLayer.js` lines 139–152 for the `bayerDither` function.
- `/home/ax/projects/well-dipper/src/rendering/sky/ProceduralGlowLayer.js` lines 120–140 for the `hash33` / `noise3D` helpers.

**Pseudocode for the extended `hyperspace()`:**

```glsl
vec3 hyperspace(vec2 uv, float time) {
  // ... existing ray-cone math (unchanged up to hitPos/wallZ) ...

  // Cylindrical coords on the wall
  float theta = atan(hitPos.y, hitPos.x);       // [-pi, pi]
  float zWorld = wallZ + time * 12.0;           // forward-scroll

  // Star layer 1: dense small
  float starSmall = sampleStars(theta, zWorld, 0.08, 3.0, 0.4);
  // Star layer 2: sparse bright
  float starBig = sampleStars(theta, zWorld, 0.35, 12.0, 0.08);

  vec3 starCol = vec3(starSmall + starBig * 1.5);

  // Depth fade so stars don't blow out at cone apex
  float depthFade = 1.0 - depthNorm * depthNorm;
  starCol *= depthFade;

  // Keep wall base color faint behind the stars
  vec3 wallBase = mix(nearColor, farColor, depthNorm * depthNorm) * 0.3;

  return wallBase + starCol;
}

// sampleStars: hash(theta_cell, z_cell) → maybe a star
float sampleStars(float theta, float z, float cellTheta, float cellZ, float density) {
  vec2 cell = vec2(floor(theta / cellTheta), floor(z / cellZ));
  float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  if (h > density) return 0.0;

  // Sub-cell position
  vec2 localUv = vec2(
    fract(theta / cellTheta) - 0.5,
    fract(z / cellZ) - 0.5
  );
  float subH = fract(h * 7919.0);
  vec2 starCenter = vec2(subH - 0.5, fract(subH * 31.0) - 0.5) * 0.6;
  float dist = length(localUv - starCenter);

  // Star with bright core + glow
  float brightness = 1.0 - smoothstep(0.02, 0.20, dist);
  return brightness * (0.4 + 0.6 * fract(h * 1093.0));  // vary per-star
}
```

**Acceptance:** Open `/tunnel-lab.html` in a browser, see a star-walled tunnel that scrolls forward. Adjustable sliders for `density`, `cellTheta`, `cellZ`, `scrollSpeed`.

**What could go wrong:**
- Hash banding at certain angles. Fix with better hash or by pre-rotating `theta` by a per-cell offset.
- Cone apex infinite density. Fix with `depthFade` or a hard cutoff past `depthNorm > 0.95`.
- Stars too small to read after pixel-scale downsample. Fix by widening `cellTheta`/`cellZ` or adding an explicit `pixelSize` quantization.

**Testing:** Open the file in the browser Max already uses. No dev server needed — it's a pure static HTML using CDN Three.js or local bundle. No game state, no risk to main branch.

---

### Phase 2 — Game integration (2–3 hours)

**Goal:** Pressing Space in-game triggers the new star-walled tunnel instead of the anaglyph-rings tunnel.

**Files touched:**
- `/home/ax/projects/well-dipper/src/rendering/RetroRenderer.js`: replace the body of `hyperspace()` (lines 332–401) with the POC version. Add any new uniforms to the `uniforms:` block (line 214) and the `uniform` declarations in the fragment shader (line 249). Add matching parameter slots in `setWarpUniforms()` if any — but ideally no new uniforms, just tune constants in GLSL.
- Optional: new helper method `RetroRenderer.setTunnelTuning(density, scroll)` if exposing runtime tuning is useful.

**Lines:** ~60 GLSL lines replacing ~70 existing lines. Net change negligible.

**Acceptance:** Load the game, click a star, press Space. During HYPER you see a star-walled tunnel instead of the cream tube. Audio hooks still fire. EXIT still reveals new system correctly.

**What could go wrong:**
- The pixel-scale downsampling (`pixelScale`) makes the stars too chunky or disappear. Fix: compute star hash in un-pixel-scaled coords, i.e. use `gl_FragCoord.xy` rather than `vUv * resolution`.
- FPS drop on low-end. Unlikely but check on Max's 5080 and a mobile device.
- Stars show through the portal during FOLD at the wrong density (too many too early). Fix: fade star density in via `smoothstep(0.25, 1.0, uFoldGlow)` so the tiny portal shows only the wall base color and stars ramp in as the portal grows.
- The existing anaglyph ring bands are gone. If Max liked them as a retro accent, add them back as a very faint overlay.

**Testing:** In-game. Use `window._getState()` to verify warp state. Use `window._startWarpNow()` if that helper exists (check main.js) or just click-Space. Toggle back-and-forth with the old version via git stash if needed.

---

### Phase 3 — Polish (3–5 hours)

**Tasks:**
1. Density ramp from portal (FOLD) into full HYPER. `smoothstep(0.25, 1.0, uFoldGlow)` applied as a density multiplier.
2. Target-system reveal — the destination star appears as a bright sprite at the vanishing point during the last ~0.5 s of HYPER. Needs a new uniform `uTargetStarColor`.
3. Sound sync verification — confirm `warpEnter` at `elapsed > 0.15` into HYPER lines up with a visual beat. Consider a tunnel "pulse" on that frame (brightness spike).
4. Dither edges on the stars — use `bayerDither` to threshold star cores. Sharp pixel-art edges instead of smooth glow.
5. Tune `tunnelR`, `taper`, `cellTheta`, `cellZ`, `density`, and `scrollSpeed` to taste.
6. Optional: subtle radial chromatic aberration at the tunnel's outer edge to echo the portal CA.

**Files touched:** `RetroRenderer.js` only, plus possibly a new helper in `WarpEffect.js` to expose `fracHyperElapsed`.

**Lines:** ~30 lines total across all polish.

**Testing:** In-game side-by-side. Record before/after screenshots or video clips if useful.

**What could go wrong:**
- Over-tuning. Keep tunable constants in a small named block at the top of `hyperspace()` so Max can iterate.
- Target-star reveal conflicts with `uExitReveal` hole mechanic — make sure the target star is only shown *before* the exit hole opens, or hide it at `uExitReveal > 0.0`.

---

### Phase 4 — Screensaver / autopilot integration (0–1 hour)

**Goal:** The autopilot's automated warps use the new tunnel with no code changes.

**Verdict:** Should require zero work. Autopilot triggers warp via the same `beginWarpTurn()` → `warpEffect.start(dir)` path. The new `hyperspace()` function is downstream of that and runs identically for autopilot and manual warps.

**Verification:** Start the game, wait for autopilot to kick in (idle timer ~30 s), watch a full autopilot warp cycle, confirm the tunnel looks right.

**If it doesn't work:** Unlikely failure mode is something state-leaky in the old hyperspace function (e.g. a uniform that wasn't reset between warps). Audit `WarpEffect._resetUniforms()` at line 266 to make sure any new uniforms are reset there too.

---

## 7. Open questions for Max (Step 7)

Questions that would change the plan depending on answers:

1. **"Wallpapered with the starfield" — literal or evocative?** Does Max want the tunnel walls to show the *exact same stars* he was looking at before warp (requires equirectangular bake hybrid), or does "stars that look like the starfield" (procedural, dense, infinite-depth) satisfy the vision? Strategy B defaults to the latter. If the answer is "literal stars," hybrid in Strategy A's bake pass.

2. **Keep the anaglyph ring bands?** The current tunnel has a red/cyan 3D-glasses ring effect. That's a distinct retro touch. Should it stay (as a faint overlay on top of the new star walls) or be removed entirely?

3. **Target-system reveal during HYPER?** Should the destination star be visible at the vanishing point as you approach, or is the tunnel opaque until EXIT?

4. **Straight tunnel or curved?** Current is a straight cone. Adding a bend (the tunnel curves subtly to one side during HYPER) is cheap to add and adds motion, but changes the sensation from "warp" to "wormhole." Which does Max want?

5. **Match duration or retune?** `HYPER_DUR = 3.0 s` was tuned to feel right with anaglyph rings. With dense star walls it may feel too short or too long. Is Max okay with adjusting HYPER_DUR in Phase 3, knowing it will slightly shift the audio timing?

6. **Density: sparse-feeling starlanes or dense-star corridor?** Phase 1 lets us tune this live. Does Max want "wide empty tunnel with bright rare stars" (feels interstellar) or "tight tunnel walled with thick star density" (feels hyperspace)? Different emotional registers.

7. **Color palette on the stars — match spectral types or retro-monochrome?** The existing starfield uses real spectral colors (blue for O, red for M). The retro render palettes (`uColorPalette`) can override everything at the end. Should in-tunnel stars carry a spectral color pass, or just be monochrome white/cream that gets palette-mapped downstream?

8. **Is `tunnel-lab.html` acceptable as a throwaway test harness?** Or does Max want the Phase 1 POC inline in the game behind a debug flag? Harness is faster; inline is more integrated. Default plan is harness.

9. **Preservation of the portal opening mechanic?** The current FOLD → ENTER portal-growing-circle is separate from the tunnel. The plan keeps it as-is. Confirm Max doesn't want that replaced too. (It's actually one of the more polished parts of the current warp.)

10. **Phase 1 test harness in the main repo or tmp?** The existing galaxy-*.html files live in the repo root. Adding `tunnel-lab.html` there follows the pattern. OK with Max, or keep out of the repo?

---

## Appendix — Invariants to preserve

- `WarpEffect.FOLD_DUR / ENTER_DUR / HYPER_DUR / EXIT_DUR` (4.0 / 1.5 / 3.0 / 2.0) — audio and `warpSwapSystem()` travel math depend on them.
- `cameraForwardSpeed = 80` during HYPER — `travelDist ≈ 463` in `warpSwapSystem()` assumes this.
- The `hyperspace(vec2, float)` → `vec3` signature at `RetroRenderer.js` line 603. Keep it.
- The `hyperMask > 0.01` gate at `RetroRenderer.js` line 602 — performance safeguard that prevents tunnel compute during the small FOLD portal. Keep it.
- `_hideCurrentSystem()` at FOLD→ENTER and ENTER→HYPER — the tunnel must be opaque enough to hide the system swap GPU stall.
- Public API: `warpEffect.start(direction)` / `warpEffect.isActive`. Don't change in v1.
