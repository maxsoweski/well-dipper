# Research — Tectonic Structure ON A SPHERE + GPU Erosion Bake

**Assessment date:** 2026-06-25 · **Branch:** feature/world-engine-production-L1
**Scope:** WEB RESEARCH (READ-ONLY). Two deferred production-port gaps named by the
UAT-PASSED relief slice (see `map-relief-slice.md` and `world-engine-wf2-synthesis.md` §8):
1. **flat-2D-DEM → sphere** — the slice's `ReliefSubstrate` is a flat latitude-band DEM with a
   known cubemap-seam-lake hazard; how is tectonic structure + drainage generated *on a sphere*?
2. **CPU-bake → GPU** — E9 hydrology is a CPU bake-time reference (`relief-e9-hydrology.js`); what
   are the real-time/bake-time GPU stream-power / flow-routing methods, and are they browser-feasible?

This document reports **concrete techniques + their cost/feasibility**, citing only sources actually
retrieved. It is research input for the production-port plan, NOT a build instruction. Where a finding
challenges the locked design (host-editor relief substrate, `world-engine-wf2-synthesis.md` §2), it is
**flagged explicitly**.

---

## 0. Headline findings (the four that change the plan)

1. **FastFlow (Jain et al. 2024) is feasibility-decisive and mesh-general.** It computes flow routing
   in O(log n) and depression routing in O(log² n) GPU iterations. On a 512² terrain it runs **10
   iterations / 0.1 s to capture 700,000 years** of stream-power erosion (vs 2.6 s CPU); 2048² in
   under 10 s for 200 iterations. Crucially the **same algorithm is defined for TINs and 4-/8-
   connectivity grids**, not just regular grids — so the sphere-port is a *mesh-topology* problem, not
   an algorithm-rewrite problem. (FastFlow §2, §4, §7.2; RTX A6000.) This directly retires the WF2 §8
   honesty caveat ("E9 is a bake-time pass, seconds per body") with hard numbers AND extends it: the
   algorithm is not grid-locked.

2. **A working *browser* WebGPU stream-power erosion exists** (GPU-Gang/WebGPU-Erosion-Simulation, a
   WebGPU port of Schott et al. 2023): ~40 fps at 4.5k textures, 80+ fps at 1201² real DEM, heights in
   a float32 storage buffer, ping-pong compute passes, steepest-flow cached once. This is an existence
   proof that the CPU→GPU port is feasible *in the lab's exact runtime* (browser, no native).

3. **Sphere drainage is a SOLVED problem in the science literature, and the solution is the same
   "topology graph" idea the relief slice's host-editor model already uses.** Liao et al. 2023 (JAMES,
   PyFlowline/HexWatershed) do *mesh-independent* flow direction on icosahedral (ISEA DGGS), hexagonal
   (MPAS), and TIN spherical meshes by routing along **topological relationships between cells**, not
   grid offsets. A closed sphere has no boundary edge, so **the ocean basins ARE the outflow sinks** —
   this replaces the flat DEM's "edge of the map drains to sea" assumption. (See §3.)

4. **The cubemap-seam-lake hazard is real but has two clean dodges.** Either (a) route flow on a
   *seamless mesh graph* (icosphere/Goldberg/geodesic) where adjacency crosses the seam natively — the
   seam only exists in the *texture*, not the *graph*; or (b) keep the cubemap but make the flow graph's
   adjacency table stitch the six faces' shared edges (a one-time precomputed neighbor list). FastFlow's
   depression-routing already treats basins as graph nodes connected by saddles — a lake that straddles
   a seam is just one basin whose border cells live on two faces, *if the adjacency graph knows they are
   neighbors*. (See §4.)

---

## 1. FastFlow (Jain, Kerbl, Gain, Finley, Cordonnier 2024) — the GPU bake engine, in detail

Source: **Jain et al., "FastFlow: GPU Acceleration of Flow and Depression Routing for Landscape
Simulation," Computer Graphics Forum 43(7), Pacific Graphics 2024.** Author version PDF retrieved from
INRIA: <https://www-sop.inria.fr/reves/Basilic/2024/JKGFC24/FastFlowPG2024_Author_Version.pdf>
(the HAL mirror <https://hal.science/hal-04684270v1> was Anubis-blocked; the Wiley DOI
<https://onlinelibrary.wiley.com/doi/10.1111/cgf.15243> is paywalled — numbers below are quoted from
the INRIA author PDF, read in full).
Code: **<https://gitlab.inria.fr/landscapes/fastflow>** (standalone PyTorch + TensorFlow port + CUDA
kernels; Houdini examples).

### 1.1 Flow routing (drainage area / discharge) — O(log n)

- **Model.** Each cell has a single downslope **recipient** (Single Flow Direction, SFD). The recipient
  graph is acyclic (monotone elevation decrease) and forms a **forest of "stream trees"** rooted at
  outflow cells. Discharge `q_c = p_c + Σ q_d` over donors `d` — i.e. drainage area = upstream integral
  of precipitation (FastFlow §4, Eq. 1).
- **Algorithm = rake-compress** (Sevilgen et al. 2005): each parallel iteration prunes leaf nodes
  (transfers their discharge to recipients) AND pointer-jumps cells whose donor has a single donor
  (skip the parent, link to grandparent). Leaves are half the nodes of a balanced binary tree, so this
  needs only **log₂ n iterations**; pointer-jumping restores the log₂ n bound even for degenerate
  single-donor chains (which would otherwise be O(n)) (FastFlow §4 / §5, Algorithm 1).
- **Donor storage:** an `n × 4` donor matrix + per-cell donor count, built in parallel with atomics
  (4-connectivity in their implementation; the method extends to 8-conn and TIN).
- **Implementation note worth stealing:** a per-cell **ping-pong scheme** (two full terrain buffers
  `T_A`/`T_B` + an 8-bit `source` buffer per cell encoding read/write direction + last-update iteration
  to dodge read-after-write hazards) gives a **14× speedup on 1024²** vs naïve full-buffer copy
  (FastFlow §5). They found running the full `log₂ n` iterations unconditionally beats checking for
  early convergence.

### 1.2 Depression routing — O(log² n) — THIS is the lake/seam answer

Real terrain has interior local minima (depressions) that trap water; on a *sphere* every closed basin
is a depression unless it reaches an ocean. FastFlow solves this as a **minimum spanning tree over a
"depression graph"** (FastFlow §3.2, §5, §6):
- **Basins:** all cells sharing a stream tree = one basin (catchment). If its root is an outflow → an
  *outflow basin*; else → a *depression*. Basin-ids are propagated by pointer-jumping (Algorithm 2).
- **Depression graph:** depressions = nodes; the **saddle** (lowest-max-altitude border cell pair
  between two basins) = a weighted edge. The minimum-cost escape path out of all depressions = the MST
  of this graph, computed with **parallel Borůvka's algorithm** (O(log² V)). Cycles (two basins
  pointing at each other) are broken by deleting the higher-saddle-basin-id edge; ties broken
  lexicographically (FastFlow §5, §6).
- **Two re-routing modes:** *depression jumping* (direct edge from local minimum to the outlet across
  the saddle) vs *depression carving* (reverse the flow path inside the depression so it climbs to the
  outlet). Carving keeps drainage continuity (looks like a real overflow channel); jumping is cheaper.
- After re-routing, **one final flow-routing pass** computes discharge over the corrected forest.

**Why this matters for the sphere/seam port:** the depression graph is a *topology* abstraction —
basins are nodes, saddles are edges. **A lake that straddles a cubemap seam is one depression node whose
border cells happen to live on two faces.** As long as the adjacency relation knows the seam cells are
neighbors, Borůvka's MST handles the straddling lake with zero special-casing. The relief slice's
"cubemap-seam lake breakage" hazard is therefore a *graph-adjacency* bug, not a hydrology-algorithm bug.

### 1.3 Stream-power erosion integration — implicit time-stepping (the speed unlock)

FastFlow couples flow routing to the **Stream Power Law** with an **implicit (actually semi-implicit)
time-stepping scheme** (FastFlow §6–7, Algorithm 7):
- Their implicit fluvial-erosion update is itself a `log₂|T|`-iteration parallel pass over the recipient
  tree (a second rake-compress-style accumulation of the erosion coefficients α, β).
- **Implicit steps are unconditionally stable**, allowing a **20× larger timestep** than explicit
  schemes (Δt = 20,000 yr vs 1,000 yr for visually-similar results), cutting iteration count 20×: a
  10-Myr landscape takes **0.5 s implicit vs 7.2 s explicit** (FastFlow §7.2, Fig. 13).
- **Hillslope/thermal erosion** folded in via Tzathas et al. 2024's extra Stream-Power terms
  (`kQ^m + k_t + k_h·A^{-h}`, h=0.6) — i.e. the same drainage area A feeds both fluvial incision and
  diffusive hillslope, in one framework.
- **Sediment deposition:** a semi-implicit extra term; sediment flux accumulated downstream by the same
  flow-routing. "Acts as a shield against erosion → steeper slopes" (FastFlow §6, §7, Fig. 10).

### 1.4 Hard performance numbers (RTX A6000, 48 GB; Intel Xeon Gold 20-core baseline)

| Scenario | Resolution | Iterations | Time | Note |
|---|---|---|---|---|
| Full landscape (erosion+deposition+rivers+lakes+veg) | digitized DEM | — | **< 1.5 s** | Fig. 1 |
| Interactive uplift authoring | 512² | 10 | **0.1 s** = 700 kyr | CPU [CBC*16] = 2.6 s |
| Aged mountain | 512² | 100 | **0.7 s** | far-right Fig. 7 |
| High-res mountain | 2048² | 200 | **< 10 s** = 300 kyr | Fig. 8 |
| 10-Myr landscape (implicit) | 512² | — | **0.5 s** | vs 7.2 s explicit |
| Flow-routing speedup vs prior GPU | 1024² | — | **5×** | Bar19/SPF*23 |
| Depression-routing speedup vs parallel CPU | 1024² | — | **34×–52×** | CBB19 |

Scaling tested 64² → 8192²; near-linear past ~8192² (thread saturation). Real DEMs up to **8.4M basins**
(Mont-Saint-Michel estuary) routed correctly.

### 1.5 Limitations to design around (FastFlow §7.3, "Limitations")

- **SFD only — no Multiple Flow Direction (MFD).** The tree structure requires one recipient/cell. SFD
  rivers read sharper (good for terrain/rivers); MFD is blurrier (used for ecosystem moisture). For the
  relief slice's "rivers cut mountains" north star, **SFD is the right choice anyway.**
- **Implicit erosion (Algorithm 7) assumes Stream-Power slope-exponent n=1** (linear). General n needs a
  global Newton-Raphson (flagged as future work). The relief slice should pick n=1 unless a body
  demands otherwise.
- **CUDA/PyTorch/TensorFlow reference impl** — not WebGPU. The browser port is the engineering gap
  (but see §2: it has already been done for the Schott variant).

---

## 2. Schott et al. 2023 + WebGPU port — the BROWSER existence proof for GPU stream-power

Source: **Schott, Paris et al., "Large-scale Terrain Authoring through Interactive Erosion Simulation,"
ACM TOG (SIGGRAPH 2023).** Project: <https://aparis69.github.io/public_html/projects/schott2023_Uplift.html>
· DOI <https://dl.acm.org/doi/10.1145/3592787> · code (GLSL compute) **<https://github.com/H-Schott/StreamPowerErosion>**.
(This is FastFlow's cited prior `[SPF*23]` — the *approximate* GPU flow-routing baseline FastFlow
beats 5×. Its HAL/aparis pages returned only abstracts; details below are from the FastFlow comparison
+ the search abstract + the WebGPU port README.)

- **Method (per FastFlow §2, §7.2):** explicit time-stepping + *approximate* flow routing — discharge is
  propagated **a few cells per timestep** (a relaxation), trivially parallel, but needs many timesteps
  and **assumes the river network is stable** (it "weakly varies over time"). FastFlow refuted this for
  noisy/time-dependent uplift (Fig. 12: approximate routing *underestimates drainage* when uplift noise
  breaks the stable-network assumption). **Design takeaway:** the Schott approximation is fine for a
  *static* relief bake but degrades when tectonics/noise are still changing the surface — FastFlow's
  exact routing is the robust choice if the relief slice keeps adding noise/tectonics across epochs.
- **Authoring concept (directly relevant to the story-engine north star):** the user/procgen works in
  the **uplift domain** — paint where uplift is high (mountain roots) — and the *relief emerges from
  simulating erosion of that uplift*. This is exactly the relief slice's "E6 writes uplift/tectonic
  structure → E9 carves it" pattern, validated as a published interactive technique. Editing tools:
  copy-paste, warping (folds/faults), point/curve elevation constraints.

### 2.1 The WebGPU port — runs in the lab's runtime TODAY

Source: **GPU-Gang/WebGPU-Erosion-Simulation** <https://github.com/GPU-Gang/WebGPU-Erosion-Simulation>
(WebGPU port of Schott 2023, TypeScript/Next.js).
- **Implements:** parallelized stream-power erosion with drainage-area approximation (the expensive part).
- **Pipeline:** compute-shader passes with **ping-pong storage buffers**; steepest-flow computed once and
  cached in a storage buffer for reuse; bounding-box optimization; raymarch/sphere-trace fragment shader
  for viz; 8×8 workgroups optimal.
- **Data layout:** heights in **2D texture (rgba8unorm) or float32 storage buffer** — same shape as the
  relief slice's typed-array DEM.
- **Performance:** **~40 fps at 4.5k textures**; **80+ fps at 1201² real DEM** (Himalayas, USGS).
- **Significance:** proves GPU stream-power erosion + flow routing runs **interactively in a browser via
  WebGPU**. The relief slice's CPU `relief-e9-hydrology.js` bake has a known, working migration target in
  its own runtime. (FastFlow itself is the *better* routing algorithm; this port is the *delivery
  vehicle* proof.)

---

## 3. Generating tectonic structure + drainage ON A SPHERE (the flat-DEM → sphere gap)

### 3.1 Mesh choices for a spherical structural field (the data substrate on a sphere)

| Mesh | What it is | Seam behavior | Tectonic/flow fit | Source |
|---|---|---|---|---|
| **Icosphere / geodesic grid** | recursively subdivided icosahedron, vertices projected to sphere | **seamless** (one connected graph; only 12 pentagon "defect" vertices) | tectonics.js builds plates as icosahedra and pushes vertices radially; geodesic grids are the GCM standard for boundary-free global fields | tectonics.js; Geodesic-grid (Wikipedia) |
| **Goldberg polyhedron (hex grid)** | dual of geodesic — hexagons + exactly 12 pentagons | **seamless**; near-uniform cell area | "hexagon-grid planet" with 12 pentagonal poles; natural plate cells; Babylon.js has built-in support | Goldberg-polyhedron (Wikipedia); Babylon.js docs |
| **Spherical Voronoi/Delaunay (jittered)** | random points → Delaunay → Voronoi on sphere | **seamless** (graph wraps) | Red Blob Games: "the sphere map is a graph and the river code didn't require any changes to work on spheres" | Red Blob Games |
| **Cubemap (6 faces)** | 6 square grids normalized to sphere | **HAS SEAMS** in texture; needs adjacency stitching or `GL_TEXTURE_CUBE_MAP_SEAMLESS` | best GPU texture-fetch / quadtree-LOD fit; Celentano + Seed-of-Andromeda use it; the relief lab's likely target | Celentano; OpenGL Wiki |
| **Equirectangular (lat-lon)** | single 2D texture, lon wrap + pole singularity | wraps in lon; **pole pinch + lon seam** | davidar GLSL sim uses lat/lon→cartesian; simplest but worst pole distortion | davidar.io |

**Key cross-cutting result (Red Blob Games, retrieved):** *"The sphere map is a graph and the river code
didn't require any changes to work on spheres."* Once relief + drainage are expressed over a **mesh
adjacency graph** (which is exactly FastFlow's recipient-forest and the relief slice's host-editor data
model), the sphere is not a special case — it is **a flat-DEM with no boundary and wrap-around
adjacency.** This is the single most important sphere finding: **the flat-DEM → sphere port is a change
to the neighbor/adjacency relation, not to the engines.**

### 3.2 Spherical plate tectonics — how structure is placed as data

Retrieved implementations, in order of fidelity:
- **tectonics.js** (Davidson; <https://github.com/davidson16807/tectonics.js>, <https://davidson16807.github.io/tectonics.js/>):
  every plate starts as an **icosahedron**; per-vertex data on the spherical grid; vertices pushed
  radially above/below sea level; three.js per-vertex manipulation; supercontinent-breakup demo. Real
  plate motion + collision on a sphere, stored as per-vertex buffers.
- **Patrick Celentano, "Simulating a Planet on the GPU"** (<https://www.patrickcelentano.com/blog/planet-sim-part-1>):
  tried Delaunay/Voronoi, **settled on cubemaps**; **GPU compute shaders simulate plates one "pixel" at a
  time** via **SPH (smoothed-particle hydrodynamics) on the sphere surface** — crust = particles that
  collide → mountains/valleys, subduct, seafloor-spread. Motto: *"computation is cheap and memory is
  expensive."* No erosion yet. Confirms cubemap + GPU-compute tectonics is viable.
- **davidar.io, "Simulating worlds on the GPU"** (<https://davidar.io/post/sim-glsl>): full plate history
  in **GLSL fragment shaders at 60 fps, a few minutes for a whole Earth history**. Plates seeded +
  diffusion-limited-aggregation growth; collisions raise elevation; erosion via **explicit stream-power**
  `elevation -= 0.05·water^0.8·slope^2` over 8-neighbor steepest descent. lat/lon → cartesian.
  **NB — this is the "time-step billions of years" approach the spine §0 explicitly rejects** ("do NOT
  time-step billions of years"). Cited as a *technique reference for GPU plate placement*, NOT as an
  architecture to copy.
- **Red Blob Games** (<https://www.redblobgames.com/x/1843-planet-generation/>): N plate seeds on a
  spherical Voronoi mesh, **random-fill (not BFS) flood** for irregular boundaries; compare plate
  direction vectors at boundaries (Δdist < −0.75 → mountains). Plate/elevation/moisture **stored as
  data per region**, then rendered. Honest that boundary rules "need more work."

**Flag vs the lock:** all four of these are *whole-disk physical simulations* (plates actually move). The
spine's locked model is **"place plausible structure once per body; do NOT time-step billions of years"**
(spine §0) and **E6 = closed-form Melosh stress field + steered noise** (WF2 §3, "hybrid"). So tectonics.js
/ davidar are **NOT** the architecture — they are evidence that *spherical structural fields are
representable as per-vertex/per-cell data on a seamless mesh*, which is the only thing the port needs from
them. The relief slice's E6 should keep its closed-form approach and just emit it over a sphere mesh.

### 3.3 Drainage networks on a sphere — the science answer (no boundary → oceans are sinks)

Source: **Liao et al. 2023, "Topological Relationship-Based Flow Direction Modeling: Mesh-Independent
River Networks Representation," JAMES 15(2), 10.1029/2022MS003089** (open-access preprint
<https://essopenarchive.org/doi/full/10.1002/essoar.10512600.1> — fetch 403'd; details below are from the
retrieved DOE-EESM research highlight <https://eesm.science.energy.gov/research-highlights/using-topological-relationships-mesh-independent-river-network-representations>,
the AGU abstract, and the HexWatershed/PyFlowline project line <https://www.hexwatershed.org/publications>).
Companion: **Liao et al. 2023, "...Stream Burning and Depression Filling," 10.1029/2022MS003487.**

- **Mesh-independent flow direction (PyFlowline/HexWatershed):** flow direction is a **topological
  relationship between a cell and its downslope neighbor on an arbitrary mesh** — works on **icosahedral
  (ISEA DGGS), hexagonal (MPAS), and TIN** spherical meshes. *"Existing methods cannot handle
  unstructured grids"; this represents river networks in any mesh system, preserving spatial patterns
  regardless of mesh type or scale.* This is the **generalization of D8** off the regular grid that the
  sphere requires.
- **No lateral boundary → outflow = ocean sinks.** GCM spherical grids (lat-lon, cubed-sphere,
  icosahedral, hexagonal) have **no edges**. On a flat DEM, water exits at the map border; on a closed
  sphere it cannot. The hydrology answer: **ocean/sea cells are the designated outflow basins** (the
  "common outflow identifier" of FastFlow §6 becomes "any cell below sea level"). Everything else routes
  to the nearest ocean via the depression-MST. For the relief slice this means the `baseLevel`/sea-level
  field becomes the **outflow mask**, and there is no special "edge of DEM" handling.
- **Per-cell area matters off the regular grid:** *"in unstructured meshes where cell area is not
  constant, the geodesic area of each cell is used when calculating flow accumulation"* — so drainage
  area on a sphere weights each cell by its true spherical-sector area (relevant for icosphere/Voronoi
  where cell sizes vary; near-uniform for Goldberg). Equivalent resolution = √(cell spherical-sector
  area). (Search-retrieved from the geodesic-grid hydrology results.)
- **Depression filling on the sphere** (companion paper) is the same problem FastFlow's depression
  routing solves — and FastFlow explicitly supports TINs, so **FastFlow's depression MST + Liao's
  mesh-independent adjacency = a sphere-native drainage bake.**

### 3.4 Cubemap seams — concrete fixes (if the lab keeps the cubemap)

Sources: Castaño, "Seamless Cube Map Filtering" <http://www.ludicon.com/castano/blog/articles/seamless-cube-map-filtering/>;
OpenGL Cubemap Texture wiki <https://www.khronos.org/opengl/wiki/Cubemap_Texture>.
- **Rendering seam (visual):** `glEnable(GL_TEXTURE_CUBE_MAP_SEAMLESS)` (WebGL2: cube sampling is seamless
  by default) makes hardware filter across face edges. Edge-fixup methods that *duplicate* border texels
  force a zero color-gradient slope across the edge and "the eye is very sensitive to this" (Castaño) —
  prefer hardware-seamless sampling or texcoord warping, not border duplication.
- **Simulation seam (the lake-breakage hazard):** this is NOT a filtering problem — it is an
  **adjacency-graph problem**. The flow graph must know that face-A's edge texels are neighbors of
  face-B's edge texels. Two options: (a) precompute a **stitched neighbor table** for the 6×N×N cubemap
  (one-time, then FastFlow/depression-MST run unchanged); or (b) **drop the cubemap for the flow bake**
  and route on an **icosphere/Goldberg graph** (seamless by construction), then sample the result back
  onto the cubemap for rendering. Option (b) is cleaner for hydrology and matches §3.1's "sphere = graph
  with no boundary" result; option (a) keeps one mesh but needs careful corner handling (cube corners are
  3-valent, a known special case).

---

## 4. Cost / feasibility synthesis for the production port

| Gap (from the slice) | Concrete technique | Cost class | Browser-feasible? | Evidence |
|---|---|---|---|---|
| CPU E9 bake → GPU | FastFlow rake-compress flow + Borůvka depression-MST + implicit stream-power | bake: 0.1–10 s/body @ 512²–2048² | **Yes** — FastFlow is CUDA, but the Schott-variant WebGPU port already runs in-browser at 40–80 fps | FastFlow §7; WebGPU-Erosion-Simulation |
| Flat 2D DEM → sphere | Express relief + drainage over a **seamless mesh adjacency graph** (icosphere/Goldberg/Voronoi); engines unchanged | port = neighbor-table change | **Yes** — Red Blob: "river code needed no changes on spheres" | Red Blob; Liao 2023; tectonics.js |
| No DEM boundary on a closed sphere | **Ocean cells = outflow sinks** (sea-level field becomes the outflow mask); route via depression-MST | free (re-uses existing baseLevel field) | Yes | Liao 2023; FastFlow §4 outflow mask |
| Cubemap-seam lake breakage | (a) stitched cross-face neighbor table, or (b) route on icosphere graph, sample back to cubemap | one-time precompute | Yes | Castaño; OpenGL wiki; FastFlow basin-graph |
| Varying cell area off-grid | weight drainage accumulation by **geodesic cell area** | trivial per-cell scalar | Yes | geodesic-grid hydrology results |
| SFD vs MFD | Use **SFD** (sharp rivers, FastFlow-native) — matches "rivers cut mountains" north star | n/a | Yes | FastFlow §7.3 |

**Net feasibility verdict:** Both deferred gaps have **published, in-runtime-feasible** answers. The
CPU→GPU port has a working browser WebGPU precedent; the flat→sphere port reduces to "change the adjacency
graph + use ocean as outflow," which the relief slice's graph-shaped host-editor data model is already
positioned for. The hardest *engineering* lift is the WebGPU compute port of FastFlow's rake-compress +
Borůvka (the reference is CUDA), but the algorithm is published, open-source, and a simpler GPU variant
already runs in the browser.

---

## 5. How this maps onto the LOCKED design (alignment + one flag)

- **ALIGNED — host-editor relief substrate (`world-engine-wf2-synthesis.md` §2):** FastFlow's
  recipient-forest + basin-graph IS a "first-class mutable relief field that build-engines write and
  sculpt-engines edit." The flow tree is recomputed from the *current* height each epoch; E9 carves
  `height` in place. This is exactly the locked shared-substrate / editor-on-host pattern, now on a
  sphere graph instead of a flat grid. No conflict.
- **ALIGNED — "do NOT time-step billions of years" (spine §0):** FastFlow's implicit erosion needs only
  10–200 iterations for a representative-epoch relief (0.1–10 s), NOT a billion-year march. Use a fixed
  small iteration budget per epoch (WF2 §8's "handful of bounded incision passes").
- **ALIGNED — E6 closed-form + steered noise (WF2 §3):** the spherical-tectonics demos (tectonics.js,
  davidar) are *physical simulations* and should NOT replace E6's closed-form Melosh approach; they only
  prove a structural field is representable as per-cell data on a seamless mesh. Keep E6 closed-form.
- **⚠ FLAG — Schott's approximate flow routing degrades under ongoing tectonics/noise (FastFlow Fig. 12).**
  WF2 §8 leaves open whether E9 uses an approximate single-cell-propagation routing or exact routing.
  Research says: if the relief substrate keeps changing across epochs (E6 adds grain, E7 magma, E8a
  craters edit `height` *between* E9 passes — which the host-editor model explicitly does), the cheap
  Schott approximation **underestimates drainage on the perturbed surface**. **Recommendation: use
  FastFlow exact routing (5× slower than approximate per pass, but still 0.1 s @ 512²) for the bake, not
  the single-cell approximation** — the host-editor model's whole point (later engines perturb the
  surface) is precisely the case Schott's approximation breaks on. This is a calibration choice, not a
  challenge to a lock, but it should be decided explicitly at slice-build time.

---

## 6. Sources actually retrieved

1. FastFlow author PDF (read in full, 13 pp): <https://www-sop.inria.fr/reves/Basilic/2024/JKGFC24/FastFlowPG2024_Author_Version.pdf> · project page <https://www-sop.inria.fr/reves/Basilic/2024/JKGFC24/> · code <https://gitlab.inria.fr/landscapes/fastflow>
2. Schott et al. 2023 project page <https://aparis69.github.io/public_html/projects/schott2023_Uplift.html> · code <https://github.com/H-Schott/StreamPowerErosion> · DOI <https://dl.acm.org/doi/10.1145/3592787>
3. WebGPU stream-power erosion port (browser, in-runtime proof): <https://github.com/GPU-Gang/WebGPU-Erosion-Simulation>
4. Liao et al. 2023, mesh-independent flow direction (sphere drainage): AGU DOI <https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2022MS003089> (paywalled) · open preprint <https://essopenarchive.org/doi/full/10.1002/essoar.10512600.1> (403 on fetch) · DOE highlight (retrieved) <https://eesm.science.energy.gov/research-highlights/using-topological-relationships-mesh-independent-river-network-representations> · HexWatershed pubs <https://www.hexwatershed.org/publications>
5. Red Blob Games, planet generation on a sphere (retrieved): <https://www.redblobgames.com/x/1843-planet-generation/>
6. tectonics.js (retrieved): <https://github.com/davidson16807/tectonics.js> · <https://davidson16807.github.io/tectonics.js/>
7. Patrick Celentano, Simulating a Planet on the GPU (retrieved): <https://www.patrickcelentano.com/blog/planet-sim-part-1>
8. davidar.io, Simulating worlds on the GPU (retrieved): <https://davidar.io/post/sim-glsl>
9. Castaño, Seamless Cube Map Filtering (retrieved): <http://www.ludicon.com/castano/blog/articles/seamless-cube-map-filtering/> · OpenGL Cubemap wiki <https://www.khronos.org/opengl/wiki/Cubemap_Texture>
10. Goldberg polyhedron / geodesic grid (retrieved, via search): <https://en.wikipedia.org/wiki/Goldberg_polyhedron> · <https://en.wikipedia.org/wiki/Geodesic_grid> · Babylon.js Goldberg docs <https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/polyhedra/goldberg_poly/>
11. arXiv 2510.24764, comparative analysis of procedural planet generators (cubemap/quadtree-LOD context): <https://arxiv.org/abs/2510.24764>

**Retrieval caveats (honesty):** the FastFlow numbers are from the INRIA *author version* (HAL mirror +
Wiley DOI were blocked/paywalled). The Liao 2023 internals are from the DOE-EESM highlight + AGU abstract
+ HexWatershed project (the full text and open preprint both blocked on fetch) — the mechanism is well
established but exact equations were not read first-hand. tectonics.js, Celentano, and davidar specifics
are from blog/README prose, not source-code reading. Schott 2023 method details are inferred from
FastFlow's explicit comparison `[SPF*23]` + the WebGPU port README, not the Schott paper body (blocked).
