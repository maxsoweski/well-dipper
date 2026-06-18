# A — Planetary Terrain LOD Architecture (for view-dependent rivers spike)

Research date: 2026-06-17. Scope: how planetary renderers refine terrain on approach, and
what that implies for keeping RIVERS stable across LOD. Citations verified; see Sources.

## 1. Dominant data structure & how LOD level is chosen
- **Cube → 6 quadtrees ("quadrilateralized/spherified cube").** The planet is a unit cube;
  each of the 6 faces is the root of a quadtree. Faces are subdivided recursively into chunks
  (split near camera, merge far). This is the convergent pattern across hobby engines, Space
  Engine, and Elite Dangerous. (Acko "Making Worlds", dexyfex, cuberact, 80.lv ED article.)
- **Elite Dangerous (Cobra):** "landable surfaces start as a cube with square sub-dividing
  faces which behave as quadtrees… uniform tri-meshes [that] further sub-divide into four
  sub-patches" by camera distance. Vertices kept **uniformly spaced** because the same patches
  feed **physics meshes**, not just render. (80.lv)
- **LOD metric = screen-space / angular size.** A chunk splits when its real-world size /
  camera distance exceeds a threshold (cuberact uses an angular threshold; Space Engine default
  ~10°). Equivalent to projected-size / altitude. **Hysteresis** on the threshold + a per-frame
  **split budget** prevent flicker and stutter (cuberact).
- Known wart: chunks near cube corners get stretched/smaller-than-siblings at equal depth
  (dexyfex) — a spherified-cube mapping reduces but doesn't remove this.
- Alternative family: **geometry clipmaps** (nested regular grids centered on camera, GPU
  Gems 2 ch.2) — simpler but less natural for a full sphere; quadtree-on-cube dominates here.

## 2. How per-chunk detail is GENERATED on demand
- **Procedural amplification keyed by chunk position, generated GPU-side.** Base elevation
  (or coarse sphere) is refined by **fractal/fractional-Brownian noise** — each octave doubles
  frequency, halves amplitude. Outerra: all detail below ~150 m is generated procedurally on
  the GPU down to cm scale, parametrized by elevation + land-class; **fine normal maps are
  generated from the finer fractal subdivision** rather than stored.
- **Space Engine:** multi-octave Perlin → elevation-map texture → mesh + normal map per
  quadtree node. Geometry res is 8× coarser than texture res, so it can "jump" 3 quadtree
  levels (2³=8).
- **dexyfex:** small nodes become **bicubic patches** from 16 surrounding samples (2 GPU
  passes) + a second fractal detail layer; height/normal caches live in VRAM atlases.
- Chunk meshes are **pooled/recycled**; cuberact reuses ~28% of parent vertices on split.
  Determinism = same chunk coords → same noise → same geometry (seedable).

## 3. Avoiding seams / cracks between LOD levels
- **Skirts (most common, cheapest):** drop a short angled vertical fringe around each chunk
  edge to hide T-junction gaps. Easier than stitching; works without neighbor knowledge.
- **Edge stitching:** explicitly re-index the high-res edge to match the coarse neighbor — no
  extra geometry but needs neighbor-LOD lookup; widely seen as more painful than skirts.
- **Geomorphing:** vertices on a refining chunk are **morphed smoothly** from parent to child
  positions over distance, eliminating geometry pop. Edge-geomorphing is costly (needs whole
  terrain in memory), so engines often combine **interior geomorph + edge skirts**.
- dexyfex ships only "rudimentary cross-fading between detail levels" and admits residual
  holes/pops — i.e. crack-free LOD is genuinely hard, not a solved checkbox.

## 4. Keeping a FEATURE stable across LOD (the river concern) ⭐
- **Represent the feature in a resolution-independent space, amplify it INTO chunks — don't
  re-derive it per chunk.** Two proven routes:
  - **Vector features + per-quad GPU rasterization (Bruneton & Neyret 2008 / Proland).**
    Rivers/roads are stored as **vectors** with shaders for *appearance*, *footprint* (how they
    deform terrain height), and *objects*. A **view-dependent quadtree** generates & caches an
    appearance texture + footprint texture **per quad on the GPU** from the *same* vector data.
    Because every LOD reads one canonical vector description, the river occupies the *same place*
    from flight view to car view — no shift/pop. This is the closest match to our spike.
  - **Hierarchical/coarse-base feature graph amplified downward (Derzapf et al. 2011, "River
    Networks for Instant Procedural Planets").** Generates a planet-scale **river network** on a
    coarse base geometry, then amplifies; the network topology is fixed at coarse level so finer
    LODs only add detail consistent with the parent.
- **Implication for us:** the river network must be defined once in a LOD-independent domain
  (vector polylines or a coarse drainage graph in cube-face UV / lat-long), then each chunk
  *samples/rasterizes that authority* (carve height via footprint, draw water via appearance).
  If instead each chunk independently re-runs flow-accumulation on its own noise, the river will
  **shift and pop** between levels — the classic drainage-density-vs-scale problem (HydroSHEDS
  constant-threshold issue; recent work preserves drainage density across scale).
- Pair with §3 anti-pop: **geomorph the carved riverbed geometry** and let the water *surface*
  read the canonical vector so its centerline never jumps.

## 5. What these engines say specifically about RIVERS / water
- **Bruneton & Neyret / Proland:** explicit, first-class — "populate very large terrains with
  detailed features such as roads, **rivers**, lakes and fields," editable in real time at any
  altitude. Footprint shaders carve the bed; appearance shaders render water. Strongest prior art.
- **Derzapf et al. 2011:** whole-planet **river networks** generated in seconds from coarse base
  geometry, no preprocessing — planetary-scale drainage as a procedural primitive.
- **Procedural Riverscapes (Peytavie et al. 2019)** & **Génevaux et al. "Terrain Generation Using
  Procedural Models Based on Hydrology":** derive river trajectories from heightfields, carve beds,
  build blend-flow trees for the water surface — useful for the *water-surface* representation.
- Elite Dangerous / Space Engine / Outerra: documented terrain LOD heavily; I found **no
  authoritative source detailing a dedicated cross-LOD river system** in any of the three (ED's
  landable bodies are largely airless; SE/Outerra water is mostly sea-level + fractal coastlines).
  State as unverified rather than claim a mechanism.

## Sources (verified)
- Acko.net — "Making Worlds 1: Of Spheres and Cubes": https://acko.net/blog/making-worlds-1-of-spheres-and-cubes/
- cuberact — Planet Chunked LOD: https://www.cuberact.org/projects/planet-chunked-lod/ ; repo https://github.com/cuberact/godot-cuberact-planet-chunked-lod
- dexyfex — "Planetary terrain rendering": https://dexyfex.com/2015/11/30/planetary-terrain-rendering/
- Outerra dev blog — "Procedural terrain algorithm": https://outerra.blogspot.com/2009/02/procedural-terrain-algorithm.html
- Space Engine — "First procedural terrain": https://spaceengine.org/news/blog100531/ ; "Terrain engine upgrade #3": https://spaceengine.org/news/blog171120/
- 80.lv — "Generating The Universe in Elite: Dangerous": https://80.lv/articles/generating-the-universe-in-elite-dangerous
- Bruneton & Neyret 2008, "Real-Time Rendering and Editing of Vector-based Terrains," Computer Graphics Forum 27(2):311-320. HAL: https://inria.hal.science/inria-00207679/en ; Proland author page: https://evasion.inrialpes.fr/Membres/Eric.Bruneton/
- Derzapf, Ganster, Guthe, Klein 2011, "River Networks for Instant Procedural Planets," CGF 30(7):2031-2040. PDF: https://cg.cs.uni-bonn.de/backend/v1/files/publications/derzapfPlanets.pdf
- Peytavie et al. 2019, "Procedural Riverscapes": https://hal.science/hal-02281637/file/main.pdf
- GDC 2017 — "Continuous World Generation in No Man's Sky" (Innes McKendrick): https://www.gdcvault.com/play/1024265/Continuous-World-Generation-in-No
- GameDev.net — "Chunked LOD + GeoMipMap without Skirts" (skirts vs morphing discussion): https://gamedev.net/forums/topic/512976-chunked-lod-geomipmap-without-skirts/
- vterrain.org — Terrain LOD on Spherical Grids: http://vterrain.org/LOD/spherical.html
