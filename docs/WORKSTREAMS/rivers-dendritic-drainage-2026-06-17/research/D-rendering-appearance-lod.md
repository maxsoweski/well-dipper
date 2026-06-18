# D — River Rendering & Appearance-LOD (orbit → close approach)

Focus: how thin river threads should *look* across the distance range, not how the network is generated. Constraint: at close approach 1 screen px ≈ 1 km, so a real 0.5–3 km river is 1–3 px — many sub-to-few-pixel threads. From far orbit rivers should be near-invisible (Earth-from-space).

## 1. Thin-feature rendering: ribbon vs SDF-carve vs decal
- **The aliasing problem is fundamental, not incidental.** A line whose *true* width is below the pixel footprint cannot be drawn at correct width without either (a) clamping it to a minimum visible width, or (b) reducing its opacity to conserve coverage. Naive ribbon geometry < 1 px wide will drop in/out of the rasterizer and **shimmer** as the camera moves — MSAA only partially helps (it samples geometry edges, not sub-pixel-thin spans, and a 1–3 px ribbon still crawls).
- **SDF (analytic) line rendering is the recommended core technique.** Store the river network as a distance field (in the existing carve cube map, or a dedicated field) and shade analytically. SDF gracefully covers sub-pixel → very-fat widths in one path, and is the standard fix for shimmer because coverage is computed per-pixel from the distance, not from triangle edges.
  - **Analytic AA formula** (Red Blob / pkh): convert a desired ~1–1.5 px edge blur into distance units. `aa = edge_blur_px / screenPxRange`, then `coverage = smoothstep(-aa, +aa, dist)` (or `clamp(0.5 - dist/fwidth(dist), 0, 1)` for the fwidth variant). `screenPxRange` = output pixels per SDF distance-unit; `fwidth(dist)=|dFdx|+|dFdy|` gives it for free per-pixel and auto-scales across LOD.
  - **Sub-pixel handling:** clamp the rendered half-width to a floor (~0.5–0.75 px) and *fade alpha* by the ratio (true_width / floor_width). This is the "conserve coverage" trick — a 0.3 px river renders as a 0.7 px line at ~40% opacity instead of flickering. Keeps the thread stable AND keeps brightness physically honest at distance.
- **Decals / screen-space** are an alternative for close range but add their own depth/projection cost; SDF-in-shader avoids extra geometry entirely and is the cleaner single-pipeline answer here. Recommendation: **migrate rivers from ribbon mesh → SDF field sampled in the planet surface shader**, with analytic AA + coverage-conserving width floor.

## 2. River WIDTH laws (so width reads right at every scale)
- **Downstream hydraulic geometry (Leopold & Maddock 1953):** width `W = a·Q^b` with **b ≈ 0.5** (depth f≈0.4, velocity m≈0.1; world data range 0.4<b<0.5). Width ∝ √discharge is robust headwaters→Mississippi.
- **Hack's law** ties basin area to stream length (`L ≈ 1.4·A^0.6`); discharge scales with drainage area, so `W ∝ A^~0.3` is a practical proxy when you have accumulated upstream area per node rather than measured Q.
- **Practical taper:** assign each network node an upstream-area accumulation, set width ∝ sqrt(area). This makes trunks fat and headwaters thin *automatically* and consistently — exactly the trunk→headwater taper you want, and it feeds the §1 width-floor cleanly.

## 3. Appearance LOD / altitude fade (no popping)
- **Two coupled fades, both driven by altitude/camera distance, NOT discrete LOD switches** (continuous = no pop):
  1. **Order-of-appearance fade:** only show a reach once its width exceeds a few px. Drive a per-reach visibility = `smoothstep(min_visible_px, full_px, projected_width_px)`. Trunks appear first from high orbit; tributaries fade in on approach. Because it's a smooth function of projected width it cross-fades instead of popping (the standard LOD-popping fix is exactly cross-fade over the transition band).
  2. **Atmospheric attenuation:** fold rivers into the existing aerial-perspective/scattering so distant features lose contrast and desaturate toward the air color (distance-fog model: far features fade, desaturate, low-contrast). This *is* why Earth's rivers vanish from orbit — it's contrast loss, not resolution loss, so model it as contrast attenuation vs. optical depth, not just alpha.
- Net: from far orbit, width-fade + atmosphere drive nearly all rivers to invisible; on approach they resolve smoothly. Tie both to one altitude parameter to guarantee monotonic, pop-free behavior.

## 4. Meander / natural wobble
- **Sine-generated curve (SGC)** is the classic, cheap meander planform: channel direction = `θ(s) = ω·sin(2π s/Λ)` along the down-valley axis (Λ = meander wavelength). Controls map directly to sinuosity, amplitude, radius of curvature. Apply as a lateral offset to otherwise-straight reaches so they read as natural, not grid-locked.
- For network-level dendritic wobble, **Dendry** (locally-computable procedural dendritic function: branching level, smoothing, branch-angle range, local disturbance) is the reference if you want noise-perturbed branch geometry without storing every vertex.

## 5. WebGL / three.js gotchas for many thin overlays on a sphere
- **Don't use a lifted ribbon Mesh for z-offset.** A geometric "lift above the sphere" causes parallax/silhouette errors at grazing angles near the limb. Prefer **rendering rivers IN the surface shader** (SDF sample → blend into terrain color) so there's no second surface to fight.
- If a separate overlay pass is kept: use **`material.polygonOffset` (polygonOffsetFactor/Units)** rather than a world-space lift — it's the GL decal mechanism and is angle-stable.
- **Depth precision at planetary scale** (orbit→surface is ~10⁷:1 range): standard near/far z-buffer z-fights badly. Use a **logarithmic depth buffer** (`logarithmicDepthBuffer:true`) and/or world-origin rebasing (already on WD's roadmap). This matters more than polygonOffset tuning.
- **Many threads:** keep rivers as a field/texture, not thousands of ribbon draw calls; if instancing reaches, batch into one InstancedMesh. The SDF-in-shader route sidesteps the draw-call and z-fighting problems together.

## Sources
- Leopold & Maddock 1953, *The hydraulic geometry of stream channels* — USGS PP252: https://pubs.usgs.gov/publication/pp252
- *Handbook of Hydraulic Geometry*, Ch.4 Leopold–Maddock Theory (Cambridge): https://www.cambridge.org/core/books/abs/handbook-of-hydraulic-geometry/leopoldmaddock-lm-theory/3BD58C2F3FA4A5FCEF9E375FEA84A183
- Singh 2003, *Downstream hydraulic geometry relations* (Water Resources Research): https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2003WR002484
- Derzapf, Ganster, Guthe, Klein 2011, *River Networks for Instant Procedural Planets* (CGF) PDF: https://cg.cs.uni-bonn.de/backend/v1/files/publications/derzapfPlanets.pdf
- Red Blob Games, *SDF antialiasing* (2024): https://www.redblobgames.com/blog/2024-09-22-sdf-antialiasing/
- pkh.me, *Perfecting anti-aliasing on signed distance functions*: https://blog.pkh.me/p/44-perfecting-anti-aliasing-on-signed-distance-functions.html
- LearnOpenGL, *Anti-Aliasing* (MSAA limits): https://learnopengl.com/Advanced-OpenGL/Anti-Aliasing
- Sine-generated curve meander method (Springer): https://link.springer.com/chapter/10.1007/978-981-10-0155-0_13
- Dendry — procedural dendritic patterns / *Procedural generation of meandering rivers* (ResearchGate): https://www.researchgate.net/publication/234128903_Procedural_generation_of_meandering_rivers_inspired_by_erosion
- Distance fog (atmospheric contrast fade + LOD cross-fade): https://grokipedia.com/page/Distance_fog
- three.js Material.polygonOffset docs: https://threejs.org/docs/#api/en/materials/Material.polygonOffset
- IGC, *Three.js geospatial* (log depth buffer at globe→street scale): https://www.intelligentgraphicandcode.com/development/threejs-interfaces/geospatial

*Unverified:* The Drew Cassidy SDF-AA post (drewcassidy.me/2020/06/26) returned corrupted content on fetch — its specific formulas are NOT cited here; the analytic-AA formulas above come from the verified Red Blob and pkh.me sources. Derzapf et al. abstract verified via Semantic Scholar/uni-bonn; full-text claims beyond "generates planetary river networks" not independently re-read.
