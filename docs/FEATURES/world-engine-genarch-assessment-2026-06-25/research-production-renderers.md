# Production / real-time planet renderers: how they separate a COARSE STRUCTURAL DATA MODEL from SHADER-TIME DETAIL synthesis

**Task:** web research deliverable for the World-Engine generative-architecture assessment (2026-06-25).
**Angle:** Do shipping planet renderers bake a coarse structure *as data* once per body and then *amplify* detail at runtime conditioned on it — or do they synthesize relief from noise and merely orient/modulate it? How is the coarse structure stored and sampled per-fragment? Relate directly to the WS4 question: **"structure baked as data, sampled by the shader" vs "noise oriented by a thin grain."**

**Read-only assessment.** No code touched. All URLs below were actually retrieved during this research (one — the GDC NMS vault page — is gated; only its public abstract was readable, noted inline).

---

## 0. The verdict in one line

Every production / near-production planet renderer I could document **bakes a coarse structural field as real data (a stored height/region/biome array or texture), then amplifies it at runtime with detail that is CONDITIONED ON (a function of) that coarse data.** The detail is a *residual on top of* the structure, not the structure itself. The pattern the industry follows is **build-then-express**: a simulation/authoring pass writes the structure into arrays/textures; rendering reads and amplifies it. This is precisely the relief-slice's `height` Float32Array model — and precisely NOT the WS4 grain-cube model, which bakes only a *2-component orientation director* and re-synthesizes the relief itself from in-shader noise.

The single most important industry property, stated explicitly by Star Citizen: **"Players can scout locations from orbit knowing the appearance won't change when they reach the surface."** That is only achievable if the coarse *shape* is authoritative data, sampled at every LOD — not re-rolled from noise per view. A grain that only orients shader noise cannot make that guarantee, because the relief shape is recomputed from noise, not read from a stored structure.

---

## 1. Outerra — coarse elevation dataset + GPU fractal refinement *conditioned on the coarse data*

Outerra is the canonical "seamless space-to-surface" planet engine and the clearest public statement of the boundary.

- **Coarse structure IS data:** a real elevation dataset at ~150 m resolution for the whole Earth, remapped to cube faces, **wavelet-compressed, decompressed on the GPU**; the required LOD is extracted on the fly. *(Outerra blog: "We currently use ~150m dataset for whole Earth. All detail below 150m is generated procedurally." Cube-face remap + modified-wavelet compression, GPU decompression.)*
- **Detail is amplification ON TOP, conditioned on the coarse data:** "The amplitude of noise is **modulated by slope** — flat areas have less noise, while the steeper get more," and "the amplitude of noise rises with **positive values of curvature too, depending also on elevation**." The fractal refinement *reads slope/curvature/elevation derived from the coarse base* and uses them to decide how much and what detail to add.
- **The data-vs-procedural boundary is explicit and at a fixed wavelength** (150 m). Above it = stored data; below it = procedural, but *steered by the data*.

**Relation to WS4:** Outerra's slope/curvature steering is a *function of an actual stored height field*. The detail noise is amplitude-modulated by the structure. WS4's grain steers noise by a baked *direction* with no baked *height* underneath it to be slope/curvature-derived from — so there is no coarse structure for the detail to be a residual of. Outerra is the relief-slice pattern (data + conditioned amplification), not the grain-cube pattern (orient-only).

Sources:
- https://outerra.blogspot.com/2009/02/procedural-terrain-algorithm.html
- https://outerra.blogspot.com/2008/07/intro.html
- https://www.gamedeveloper.com/business/-i-outerra-i-a-seamless-planet-rendering-engine

---

## 2. Star Citizen Planet Tech (v4 → v5 / Genesis) — baked global heightmap + data "pools" that DRIVE everything

Star Citizen's planet tech is a multi-generation, shipping example of "structure as data pools."

- **A baked global heightmap per planet is the spine.** v4: "The team uses a planet's **height map** to reduce or increase specific effects depending on how high up the player is." Particles/weather/effects are "**locked to the terrain** and move around on the surface … flowing around terrain contours" — i.e. they sample the stored terrain, they don't re-derive it.
- **Structure is a stack of baked DATA maps that DRIVE expression, not decide live:** v5/Genesis exposes "**Temperature, Humidity, Geology, Soil Type, Soil Depth, Nutrients, … Sunlight exposure and Slope Aspect**." This data "**drives** the assignment and … tiled blending of terrain textures, the distribution of each individual type of Flora based on competition rules …, and the placement of rocks and debris **derived from erosion simulation**." v4 already had "Temperature and Humidity maps **infer biome selection** — a data-driven approach that went on to become the **Genesis shared data pool** initiative."
- **The authoritative-structure guarantee:** "Players can **scout locations from orbit knowing the appearance won't change** when they reach the surface." The coarse structure is fixed, baked, and sampled at all distances.

**Relation to WS4:** Star Citizen is almost a one-to-one mirror of Max's "story engine → fields that render reads" vision: a **shared data pool** (analogous to the relief `substrate` typed arrays: `height`, `regime`, `flowAccum`, `baseLevel`) that downstream expression *reads*. Note the direct parallel: Genesis "shared data pool" ≈ wf2-synthesis §2's "first-class mutable RELIEF SUBSTRATE." Star Citizen bakes the *height field and the geology/erosion-derived fields as data*. WS4 bakes only the orientation director and leaves the height field to in-shader noise. Star Citizen confirms the relief-slice direction.

Sources (wiki pages 403 on automated fetch; content via search-engine extracts of the same pages):
- https://starcitizen.tools/Planet_Tech_v5
- https://starcitizen.tools/Planet_Tech_v4
- https://www.mmopixel.com/news/star-citizen-planet-tech-v5-and-genesis-update
- https://robertsspaceindustries.com/en/comm-link/transmission/17080-Star-Citizen-Monthly-Report-April-2019

---

## 3. No Man's Sky — voxel world generation (not pure per-fragment heightfield), uber-noise with analytical derivatives

NMS is the closest thing to "fully procedural, nothing baked," and it is instructive that *even NMS does not synthesize relief purely per-fragment from a thin orienting field.*

- **It is VOXEL-based, then polygonized.** The GDC talk (abstract only — page is gated) describes "voxel-based world generation, through polygonization and texturing, to eventual population and simulation." That means the structural field is *evaluated into a 3D density volume* (an explicit intermediate structure), then meshed — not read off a 2D orientation map in a fragment shader.
- **"Uber-noise"** layers Perlin/Simplex/Billow/Ridge noise with **domain warping, erosion-shaped terms, and analytical derivatives** so that cliffs/rivers/overhangs are *coherent landforms*, all tied to the planet seed. The analytical derivatives are exactly so that downstream features (normals, slope-gated material, river-likeness) read a *consistent* surface — the closest NMS analogue to "many features share one cause."
- NMS does NOT bake a per-planet heightmap (it regenerates deterministically from seed on visit), but it DOES evaluate a full structural field (the density volume) before any expression — the structure exists as a (transient) data object, not as orientation-only steering of texture-stage noise.

**Relation to WS4:** Even the most "everything-is-a-function" production planet game commits the structure to an explicit field (a voxel volume) before expressing it, and uses analytical derivatives so features share one coherent surface. WS4's grain shares an *orientation* but each feature still hashes its own *shape* from independent in-shader noise — so it gets directional coherence without shared *structural* coherence. NMS shows that the coherence Max wants comes from a shared evaluated *field*, not a shared *direction*.

Sources:
- https://www.gdcvault.com/play/1024265/Continuous_World_Generation_in__No_Man_s_Sky_ (abstract only — page gated; full technical content is in the video, not retrievable as text)
- https://medium.com/@pratyaksh.notebook/perlin-noise-the-evolving-algorithm-behind-the-diverse-universes-of-no-mans-sky-f2cc8ddacd52
- https://www.rambus.com/blogs/the-algorithms-of-no-mans-sky-2/

---

## 4. "World Orogen" (raguilar011095/planet_heightmap_generation) — the textbook build-then-express, using the SAME algorithms as the relief slice

This open-source procedural planet generator is the single closest public analogue to Max's E6→E9-over-a-substrate vision, and it independently arrived at the relief slice's exact algorithms.

- **Simulation-first, render-second (their phrasing matches Max's "PROCGEN DECIDES, RENDER EXPRESSES"):** elevation is "computed once into stored data structures, then consumed by the renderer."
- **Structure built as data on a coarse reference grid (~20,000 regions):** "Elevation assignment combines **distance fields, stress-driven uplift, ocean floor profiles, rift valleys, back-arc basins, hotspot volcanism, island arcs**" — computed once and **stored** into elevation arrays. Plate-collision data drives subduction → basins/ridges in the grid.
- **Erosion EDITS the same stored heightmap (host-editor model):** "**Priority-flood pit resolution** carves canyons through mountain saddle points"; "**Iterative implicit stream-power hydraulic erosion** carves self-reinforcing river valleys." These *modify the stored grid* — the build-then-carve sequence.
- **Render reads the grid:** "Rendering builds a Voronoi cell mesh with per-vertex colors and **terrain displacement**" — the elevation grid is read to displace vertices; "the elevation grid remains stable across detail levels; only the mesh resolution changes."

**Relation to WS4:** This is the relief-slice architecture, externally validated, down to the literal algorithm names: **priority-flood + stream-power incision into a shared mutable height grid** (compare `relief-e9-hydrology.js`: `priorityFloodFill` + `dz = erodibility·A^m·S^n`, subtracting into `substrate.height`). World Orogen *renders by displacing a mesh from the stored grid*; WS4 *renders by re-synthesizing relief from shader noise and never stores/samples a height grid*. The relief slice already matches the production-aligned approach; WS4 stopped at the orientation field and skipped committing the relief to data.

Source:
- https://github.com/raguilar011095/planet_heightmap_generation

---

## 5. GPU geometry clipmaps (GPU Gems 2, ch. 2 — Hoppe/Asirvatham) — the canonical "coarse base + fractal RESIDUAL anchored to the coarse hierarchy"

This is the textbook formulation of the exact mechanism, and it makes the data-vs-detail anchoring explicit.

- **Coarse base IS stored data, sampled on the GPU:** "The z coordinate is stored as a **single-channel 2D texture — the elevation map** … vertices obtain their z elevations by **sampling the elevation map as a vertex texture**." Stored per clipmap level as textures.
- **Detail is a RESIDUAL on the upsampled coarse data, not independent noise:** "It allows the **prediction of the elevation data for each level by upsampling the data from the coarser level**" (four-point interpolatory subdivision), then "we synthesize fractal detail by letting the **residuals be uncorrelated Gaussian noise** … superposition of noise across the many resolution levels." Crucially, **residuals are per-level scaled and added on top of the upsampled coarse surface** — "anchoring synthetic detail to the coarse structure hierarchy."

**Relation to WS4:** The clipmap detail noise is mathematically a *residual of the coarse height* (`fine = upsample(coarse) + scaled_noise`). The coarse height is the load-bearing data; noise is the cosmetic high-frequency residual. WS4 inverts this: there is no baked coarse height to be a residual of — the noise *is* the relief, and the grain only rotates it. This is the formal statement of why WS4 "reads as an orientation overlay": the structure (low/mid frequency) is the part that must be data; WS4 left that part in the shader.

Sources:
- https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry
- https://hhoppe.com/proj/gpugcm/

---

## 6. Academic survey — "Procedural Planetary Multi-resolution Terrain Generation for Games" (arXiv 1803.04612)

A games-targeted survey of the same boundary.

- Confirms the standard: a **multi-resolution base heightfield** renders the large-scale structure ("rendering large scale models with high definition"), with "**low scale areas with finer details added with the aid of procedural content generation**."
- Notes a "**deterministic tiling strategy with fractal noise to achieve a specific level of detail**" — i.e., detail is procedural and added at fine LODs, *on top of* the resolved coarse model, not in place of it.

**Relation to WS4:** Independent academic confirmation that the field's shared assumption is: coarse model = the structural truth (often stored/baked, multi-resolution); procedural noise = the fine residual. WS4's grain is neither — it's a per-fragment orientation steering of mid-frequency noise.

Source:
- https://arxiv.org/pdf/1803.04612 (PDF; text extracted via local PDF tooling — pp. 1, 3, 4)

---

## 7. How the coarse structure is stored and sampled per-fragment, across the survey

| Engine / source | Coarse structure stored AS | Storage form | Sampled at runtime by | Detail conditioned on coarse? |
|---|---|---|---|---|
| Outerra | ~150 m elevation dataset | Cube-face textures, wavelet-compressed, GPU-decompressed | Vertex/geometry + fractal pass | Yes — noise amplitude modulated by slope/curvature/elevation derived from the data |
| Star Citizen v4/v5 | Global heightmap + Temp/Humidity/Geology/Soil/SlopeAspect "data pools" | Per-planet baked maps (Genesis shared data pool) | Texture splat, flora/rock placement, erosion-derived debris, effect strength | Yes — maps *drive* assignment/placement; erosion-simulated debris |
| No Man's Sky | Density field (uber-noise) | Transient 3D voxel volume → polygonized | Mesher + analytical-derivative material/normal stage | Yes — analytical derivatives keep all features on one coherent surface |
| World Orogen | Plate/stress/erosion elevation grid | ~20k-region grid arrays (height + climate) | Mesh vertex displacement + biome color | Yes — erosion edits the same grid; render reads it |
| Geometry clipmaps | Coarse elevation pyramid | Single-channel 2D elevation textures per level | Vertex texture fetch | Yes — fractal residual = noise added to upsampled coarse, per-level scaled |
| **WS4 grain cube (current)** | **Strike DIRECTION only (+ grainMag, regime)** | **RG of a `samplerCube` (.b mag, .a regime/province)** | **6 combiners read `sampleGrainStrike` to set an axis `ax`; relief SHAPE/amplitude still from in-shader `noised()` + `uXxxStrength` + `provinceWeight`** | **No coarse HEIGHT exists; noise is the relief, grain only rotates it** |
| **Relief slice (UAT-passed)** | **`height` Float32Array DEM + regime/flowAccum/baseLevel** | **Typed arrays in a `substrate` object; E6 writes, E9 subtracts** | **(lab) mesh/field viz reads the grid** | **Yes — E9 stream-power carves the SAME height array E6 built** |

The bottom two rows are the whole tension. The relief slice matches every production row (structure committed to a sampled data array; later stages edit/read it). The WS4 grain cube matches *none* of them — it is the only row whose stored "structure" is a direction with no underlying stored height.

---

## 8. The three Well Dipper surfaces — how they relate (verified against code, per the assessment brief)

1. **Relief slice (repo root: `relief-substrate.js`, `relief-base-step.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-slice.js`; lab `world-engine-relief-lab.html`). Max-UAT-PASSED 2026-06-23 (`90b66f7` / `ef63554`).**
   This is the **real "structure as data"** surface. `makeSubstrate` (`relief-substrate.js:5-19`) allocates a 2D regular-grid **DEM**: `height`, `grainAngle`, `grainMag`, `regime`, `faultDensity`, `flowAccum`, `baseLevel`, `standing`, `maturity` — all typed arrays. `runE6` (`relief-e6-tectonic.js:97-129`) **WRITES `substrate.height` in place** (`substrate.height[i] += baseAmp * h * blend`, line 122). `runE9` (`relief-e9-hydrology.js:104-152`) runs priority-flood + D8 + stream-power and **SUBTRACTS from the SAME `substrate.height`** (`substrate.height[i] -= dz`, line 139). This is the host-editor model literally implemented: E6 builds the DEM, E9 carves the DEM. Caveats (honest, per brief): flat 2D latitude-band DEM (not sphere/cubemap), E9 is a CPU bake-time reference.

2. **`src/worldengine/base/*` (`baseStep.js`, `tectonic.js`, `substrate.js`, `adaptL0.js`, `sphereField.js`, `verify.js`).**
   This is the **in-progress PRODUCTION PORT of surface (1)'s base step** — the WS1/WS2 "expose + derive" Tier-1 layer. `makeBaseStep` (`baseStep.js:10-100`) is the production analogue of the lab's `makeBaseStep`, returning the same `{ drivers, crust, substrate }` triple, and it *materializes a `crustalThickness` Float32Array* (`baseStep.js:89-92`) — i.e. it also commits structure to arrays. It is the bridge between (1) and a real production substrate. It is NOT yet the renderer.

3. **WS4 wiring into the PRODUCTION LAB shader (repo root `planet-lod-height.glsl.js` + `planet-lod-uniforms.js`; workstream `docs/WORKSTREAMS/world-engine-relief-wiring-2026-06-25/`). Mechanism VERIFIED, Max-UAT-FAILED, NOT shipped (`deca261`).**
   This surface **did NOT port the substrate**. It baked a `samplerCube uTectonicGrainCube` whose **RG channels store only a 2-component world-space strike DIRECTION** (`planet-lod-height.glsl.js:144-159`; `.b` = grainMag, `.a` = regime/province). The six grained combiners read it via `sampleGrainStrike(pos)` and use it ONLY to set an orientation axis: e.g. `scarpCombiner` (`:2026-2045`) does `vec3 ax = grainProvinceRotate(normalize(mix(uScarpAxis, sampleGrainStrike(pos), uTectonicGrainStrength)), pos)` and then **synthesizes the relief shape from in-shader noise**: `vec4 wn = noised(pos * uScarpWarpFreq + …); float field = dot(pos, ax) + uScarpWarp*wn.x; … h += amp * (sp.x - 0.5)` where `amp = uScarpStrength * styleSign * provinceWeight(...)`. **The relief height comes from `noised()` × a scalar uniform × the province amplitude mask — never from a baked height field.** The grain rotates the noise; it does not BE the structure.

**Why the apparent tension resolves (verified, not assumed):** Surfaces (1) and (3) are NOT two implementations of the same architecture. (1) commits the relief to a **height DEM** (data) and edits it across epochs — matching every production renderer in §§1-6. (3) committed only the **orientation director** to a cube and left the relief itself in shader noise — matching none of them. WS4's own intent doc named the bar ("valleys are genuinely lower, **cut into the surface**, not just darkened" — `intent.md` success criteria) but the wiring delivered orientation-sharing, not surface-as-data. That is exactly why mechanism-verify passed (the grain *is* shared and deterministic — `verdict.json` `one-shared-grain` PASS) while Max-UAT failed (`landscape-with-history` = `deferred-to-max`): the verified ACs tested *orientation coherence*, and the UAT tests *structure-as-data*, which was never baked.

---

## 9. Applicability to the production port — what the research says the next move is

The research points one direction, and it is the direction the LOCKED design (wf2-synthesis §2: "first-class mutable RELIEF SUBSTRATE that BUILD engines WRITE and SCULPT engines EDIT") and the UAT-passed relief slice already chose. No lock is challenged by this research; rather, the research strongly corroborates the lock and indicts the WS4 *shortcut* (orientation-only cube), not the WS4 *goal*.

Concretely, to match production renderers and pass Max's UAT, the production port must **bake the relief substrate's `height` field (and the carved post-E9 height) as sampled data** — a cube-mapped (sphere-native) height/displacement field, analogous to:
- Outerra's cube-face elevation dataset (§1),
- Star Citizen's baked global heightmap + Genesis data pool (§2),
- World Orogen's stored elevation grid that erosion edits and the mesh displaces (§4),
- the geometry-clipmap coarse elevation texture that fractal residuals are added on top of (§5).

Then the shader's role flips to what every production engine does and what Max's north star demands: **express the baked structure** (displace/shade from the sampled coarse height) and add **detail as a residual conditioned on that height** (slope/curvature-modulated, à la Outerra) — *not* synthesize the structure from noise and rotate it by a grain.

**The one genuinely hard production gap the research surfaces** (already flagged in the plan as F2/`relief-base-step` caveats, here corroborated): the relief slice's `height` DEM is a **flat 2D latitude-band grid**; production needs it **sphere-native (cube faces)**. Outerra (cube faces + wavelet), Star Citizen (per-planet baked maps), and clipmaps (per-level textures) all store the coarse structure in a sphere/quadtree-friendly texture form. The port's real work is "commit the substrate height to a sphere-native sampled texture," which is the `src/worldengine/base/sphereField.js` direction (surface 2) — not "bake a better orientation cube." The grain cube can REMAIN as the orientation input to detail, but it must sit *on top of* a baked coarse height, not *instead of* one.

**Flag (not a contradiction of a lock, an honest scoping note):** WS4 as scoped ("author the missing E6 grain field + make the existing carve subtractive" — production-L1-plan §WS4) was explicitly reframed away from "port the flat-DEM engines." The research says that reframing is what produced the UAT miss: by NOT porting the DEM (the height data), WS4 kept the structure in shader noise. The cheapest path to Max's bar is to port the **height substrate as a sampled field** (the thing WS4 deferred), which the relief slice already proves out in the lab and which `src/worldengine/base/` is already heading toward.

---

## Sources (all actually retrieved; one gated, noted)

- Outerra procedural terrain algorithm — https://outerra.blogspot.com/2009/02/procedural-terrain-algorithm.html
- Outerra intro — https://outerra.blogspot.com/2008/07/intro.html
- Outerra: a seamless planet rendering engine (Game Developer) — https://www.gamedeveloper.com/business/-i-outerra-i-a-seamless-planet-rendering-engine
- Star Citizen Planet Tech v5 — https://starcitizen.tools/Planet_Tech_v5
- Star Citizen Planet Tech v4 — https://starcitizen.tools/Planet_Tech_v4
- Star Citizen Planet Tech v5 / Genesis explainer — https://www.mmopixel.com/news/star-citizen-planet-tech-v5-and-genesis-update
- Star Citizen Monthly Report Apr 2019 — https://robertsspaceindustries.com/en/comm-link/transmission/17080-Star-Citizen-Monthly-Report-April-2019
- No Man's Sky GDC talk (abstract only; video gated) — https://www.gdcvault.com/play/1024265/Continuous_World_Generation_in__No_Man_s_Sky_
- NMS uber-noise / Perlin evolution — https://medium.com/@pratyaksh.notebook/perlin-noise-the-evolving-algorithm-behind-the-diverse-universes-of-no-mans-sky-f2cc8ddacd52
- The algorithms of No Man's Sky (Rambus) — https://www.rambus.com/blogs/the-algorithms-of-no-mans-sky-2/
- World Orogen procedural planet (tectonics/erosion → stored heightmap) — https://github.com/raguilar011095/planet_heightmap_generation
- Geometry clipmaps (GPU Gems 2, ch. 2) — https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry
- Hoppe geometry clipmaps project — https://hhoppe.com/proj/gpugcm/
- Procedural Planetary Multi-resolution Terrain Generation for Games (arXiv 1803.04612) — https://arxiv.org/pdf/1803.04612
