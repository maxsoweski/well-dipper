# Research — Procedural Plate Tectonics Stored AS DATA (genarch assessment)

**Date:** 2026-06-25. **Type:** READ-ONLY web research, one input to the world-engine
generative-architecture assessment. **Scope:** established practice for generating plate
tectonics / boundaries / cratons / orogenic belts / rift zones as an *explicit data model*
(not shader noise), and how that practice relates to the Well Dipper relief slice
(`relief-substrate.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`).

**North star this audits against** (`world-engine-architecture-spine.md` §0–1): "PROCGEN DECIDES,
RENDER EXPRESSES." The structure must exist as upstream DATA; the renderer only reads/expresses it.

---

## 0. TL;DR — the one finding that matters

Every credible procedural-tectonics system in the literature/community does the SAME thing, and it
is exactly the thing WS4 was missing and the relief slice is reaching toward:

> **They generate a discrete set of PLATES (or plate-like clusters) as first-class data objects,
> partition the body's surface into them, give each plate a rigid MOTION, then DERIVE relief from
> what happens at plate BOUNDARIES (convergence → mountains/trenches, divergence → ridges/rift,
> transform → shear). The per-cell tectonic state — plate id, crust type, elevation, thickness,
> age, fold/ridge direction — is STORED in arrays. The renderer then reads that stored field and
> AMPLIFIES it with noise; the noise is STEERED BY the data, it does not invent the structure.**

That last clause is the crux of the WS4 UAT failure. In established practice **noise is the dressing
on top of a tectonic data substrate; in WS4 noise IS the substrate and the tectonic layer is only a
thin orientation overlay.** That is the inversion the north star forbids ("render expresses; the data
already decided"). The relief slice is architecturally on the right side of this line (it builds a real
mutable `height` array that engines mutate), but its E6 grain is a **closed-form latitude-banded
despin-stress field, NOT a plate/boundary model** — so it does not yet produce the plate-shaped
macro-structure (continents, ranges *at boundaries*, cratons) that all four reference systems below
treat as the load-bearing data.

---

## 1. Andy Gainey — "Procedural Planet Generation" (Experilous, 2014) — the canonical community method

**Source retrieved:** the widely-mirrored writeup (original experilous.com post; mirror at
`enki2.tumblr.com/post/104104415794`). Community reimplementation: niltestudo.

**How structure is represented AS DATA:** the sphere is a subdivided icosahedron → dual polyhedron →
**tiles**. Each **tectonic plate** is a data object carrying:

- a **rotation axis** through the planet centre + a small **angle** = rate of drift (rigid plate motion),
- a second small **angle** = rate of **spin** about the plate's own centre,
- a **plate-type flag**: oceanic OR continental,
- a **desired elevation** (a positive range for continental plates, a negative range for oceanic).

Per-tile, the stored output is an **elevation** (plus the plate id the tile belongs to).

**How it is generated once per body:** pick N seed tiles, **flood-fill simultaneously** until every tile
belongs to a plate (a discrete partition — not noise). Then, for every **boundary** between two plates,
decompose the relative motion into a **pressure component** (perpendicular to the boundary) and a
**shear component** (parallel). Boundary elevation is assigned by rule:

- same-type collision (convergent): take max desired elevation of the two plates **+ extra uplift** → mountain range,
- ocean-under-land convergence (subduction): adjust toward trench/arc,
- shear / divergent: weaker raised effect,
- low-stress: simply **average** the two plates' desired elevations.

Plate-interior elevations are then **interpolated from the boundary values using distance fields**.

**How the renderer reads it:** the renderer consumes the **per-tile elevation** (with temperature +
precipitation) for biome coloring and meshing. The macro-shape of continents/ranges is fully decided
upstream by the plate partition + boundary stress; rendering only expresses it.

**Relation to Well Dipper:** this is the prototypical "procgen decides, render expresses" tectonics
pipeline. The relief slice's `regime` field (Anderson THRUST/STRIKESLIP/NORMAL) is conceptually a
*boundary-stress classification*, but Gainey's classification is **per-boundary between two moving
plates**, whereas the slice's is **per-latitude-row from a despin closed form** — there are no plates,
no boundaries, no plate-relative motion. The slice has the *data-substrate* discipline but not the
*plate model* that produces plate-shaped macro-structure.

Sources: <https://enki2.tumblr.com/post/104104415794/procedural-planet-generation-20140930-by-andy>,
<https://niltestudo.wordpress.com/2017/08/15/icosahedronal-world-generation/>

---

## 2. Cortial et al. 2019 — "Procedural Tectonic Planets" (Eurographics / Computer Graphics Forum) — the rigorous academic data model

**Source retrieved (open access PDF, read directly):**
`perso.liris.cnrs.fr/eric.galin/Articles/2019-planets.pdf` (Y. Cortial, A. Peytavie, E. Galin,
E. Guérin). This is the most directly relevant reference for the Well Dipper architecture — it is a
phenomenological (NOT physics-PDE) model explicitly designed to be cheap and authorable, and it is the
clearest published statement of "tectonics as a stored data substrate, amplified at render time."

**The crust as data — Table 1 (the paper's own parametrization), per sample point `p`:**

| Symbol | Meaning |
|---|---|
| `xC` | crust **type**: oceanic or continental |
| `e`  | crust **thickness** |
| `z`  | relief **elevation** |
| `ao` | **crust age** (oceanic only) — age since formation at the ridge |
| `r`  | local **ridge direction** (oceanic only) |
| `ac` | **orogeny age** (continental only) |
| `o`  | **orogeny type** (continental: Andean = subduction, or Himalayan = collision) |
| `f`  | local **fold direction** (continental only) |

> "A planet is defined as a set of tectonic plates, denoted as P." "Each plate P is a portion of crust
> parametrized over its domain with the following functions: type xC(p), thickness e(p) and surface
> elevation z(p)." (PDF p.3–4)

**Representation on the sphere:** plates are **spherical Voronoi cells** of a set of plate centroids
`{ci}` (irregularized by warping geodetic distances with noise); the crust is a set of attributed
**sample points** on a global **Spherical Delaunay Triangulation** (Fibonacci sphere sampling), with
field values interpolated barycentrically inside triangles. (p.4, p.7)

**Plate motion:** rigid **geodetic** rotation `G`: a normalized rotation axis `w` through the centre +
angular speed `ω`; surface velocity of point `p` is `s(p) = ω·(w × p)`. This is the geoscience **Euler
pole** formulation. (p.4)

**Generated once, then evolved over discrete steps:** "an iterative process based on a discrete
time-step `δt` set to **2 My**." Four interactions, each editing the stored crust fields:
- **Subduction** (convergent): denser/older oceanic plate plunges; uplift `eu_j(p)` of the overriding
  plate is a function of distance-to-front `d`, relative speed `v`, and the subducting plate's
  elevation; `z(p, t+δt) = z(p,t) + eu_j(p)·δt`; fold direction `f` updated by relative velocity. (p.5)
- **Continental collision:** a **terrane** (see below) detaches and sutures; a discrete elevation surge
  `Δz` is applied in a compactly-supported radius around the terrane. (p.5)
- **Oceanic crust generation** (divergent): new sample points spawn at the **ridge** `Γ`; elevation
  blends interpolated inter-plate elevation with a template ridge profile; ridge-parallel direction `r`
  recorded for later amplification. (p.6)
- **Plate rifting:** a plate fractures into 2–4 sub-plates (Voronoi cells of new random centroids, warped
  boundaries), triggered by a **Poisson law** weighted by continent size; prevents super-continents. (p.6)
- Per-step **continental erosion**, **oceanic dampening** (old crust sinks → abyssal plains), and
  **sediment/trench filling**. (p.6–7)

**Cratons / orogenic belts / rifts as explicit data:** YES.
- **Terranes** `R` = "a connected region of continental crust" — these are the explicit accreted
  continental blocks (the craton/microcontinent analogue); they "resist subduction and instead suture
  or accrete." (p.4)
- **Orogenic belts** are stored as the `o` (orogeny type) + `ac` (orogeny age) fields on continental
  samples — directly read at amplification time.
- **Rift zones / ridges** are stored as `r` (ridge direction) + `ao` (age) on oceanic samples.

**How the renderer reads it — AMPLIFICATION (this is the decisive part for Well Dipper):** the
simulation yields coarse **crust C** (~50 km sampling). Rendering produces high-res relief **T** by
**amplifying C** in one of two ways, *both steered by the stored fields*:
- **Procedural amplification:** add coherent noise to base `z`; for oceans use **Gabor noise oriented
  by the stored ridge direction `r`** and modulated by **age `ao`** (young crust → sharper transform
  faults). (p.7)
- **Exemplar-based:** pick a real-DEM heightfield primitive per sample **by the stored terrain type
  `xT`** (derived from `o`: Andean / Himalayan / old-mountains / plain), **rotated to align with the
  stored fold direction `f`.** (p.7)

> "Recall that the crust C is described as a set of samples, each holding data recorded from the
> procedural tectonics process. We identify the local terrain type xT, and then assign a primitive
> matching it to every sample point." (p.7)

**This is the canonical statement of the north star.** The tectonic DATA (type, orogeny, fold/ridge
direction, age) is generated once and stored; the renderer's noise/primitive layer is **steered by
that data**. The macro-structure (where mountains are, which way they fold, where ridges run) is
decided upstream. Noise only supplies sub-grid detail it could never have invented on its own.

Sources: <https://perso.liris.cnrs.fr/eric.galin/Articles/2019-planets.pdf> (read pp.3–7 directly),
abstract/metadata also at <https://onlinelibrary.wiley.com/doi/10.1111/cgf.13614>

---

## 3. pyplatec / plate-tectonics (Lauri Viitanen's "platec", Mindwerks fork) — full simulation, raster data model

**Sources retrieved:** the plate-tectonics repo + the `plate.hpp` header + the worldengine consumer.

**Data model (per `plate.hpp` member variables):** each `plate` object stores:
- `HeightMap map` — a per-pixel **crust thickness / structure** raster owned by the plate,
- `AgeMap age_map` — per-pixel **timestamp of when that crust crystallized** (the crust-age field),
- `Mass _mass` — total mass + centre of mass,
- `Movement _movement` — **velocity (vx, vy)** + momentum,
- `ISegments _segments` — distinct **continental crust regions** tracked for collision response
  (the craton/continent analogue),
- world bounds + an RNG.

**How it runs:** an explicit **time-stepped loop** — `platec.create(seed, w, h, sea_level,
erosion_period, folding_ratio, aggr_overlap_abs, aggr_overlap_rel, cycle_count, num_plates)`, then
`while platec.is_finished(p) == 0: platec.step(p)`. Plates drift over a global raster; overlaps at
convergent boundaries fold/stack crust, denser crust subducts, erosion runs each period.

**What the renderer/consumer reads (the stored output contract):** two arrays —
- `hm = platec.get_heightmap(p)` — the global **elevation** raster,
- `pm = platec.get_platesmap(p)` — the per-cell **plate-ownership id** raster
  (`world.plates = numpy.array(...).reshape(height, width)`).

So the downstream world generator (worldengine: rain shadow, erosion, biomes, rivers) reads BOTH the
heightfield AND **which plate each cell belongs to** — plate identity is a first-class stored field, not
just elevation.

**Relation to Well Dipper:** this is the "full simulation" end of the spectrum — it literally time-steps
crust over many iterations, which the spine explicitly rejects ("do NOT time-step billions of years",
§0). But note WHAT it stores: a heightmap + an **age map** + a **plate-ownership map**. The relief slice
already has the equivalents of the first (`height`) and is missing the other two as *plate*-scoped
fields — it has no plate id per cell and its `maturity` is an accumulated-age scalar, not a
crust-formation-age tied to a tectonic event.

Sources: <https://github.com/Mindwerks/plate-tectonics>,
<https://raw.githubusercontent.com/Mindwerks/plate-tectonics/master/src/plate.hpp>,
<https://github.com/Mindwerks/worldengine/blob/master/worldengine/plates.py>,
<https://github.com/Mindwerks/pyplatec>

---

## 4. Nick McDonald — "Clustered Convection for Procedural Plate Tectonics" (SimpleTectonics, 2020) — a modern point-cloud data model

**Source retrieved:** `nickmcd.me/2020/12/03/clustered-convection-for-simulating-plate-tectonics/`
+ repo `weigert/SimpleTectonics`.

**Data model:** a deformable point cloud of **segments** (Lithosphere `Litho` objects), each storing:
`pos`, `area` (Voronoi-cell pixel count), `mass`, `thickness`, `density = mass/(area·thickness)`,
`height = thickness·(1−density)` (Archimedean **buoyancy** — the key physical idea), `speed`, status
flags `alive`/`colliding`, and `parent` (its plate). A **plate** struct stores: centre of mass `pos`,
translation `speed`, `rotation` + `angveloc`, `mass`, `inertia`, and `vector<Litho*> seg` (its
member segments).

**How plates emerge:** segments are clustered into plates by **nearest-centroid Voronoi labeling** (GPU
shader); membership is dynamic. Mantle **convection** currents move the segments; rigid-body integration
moves the plates. Boundaries are detected by a **collision-radius scan** for nearby segments of a
*different* plate:
- **convergence/subduction:** denser segment is killed, its mass transferred to the lighter neighbor
  (`n->thickness += s->height; n->mass += mdiff; s->alive = false`),
- **divergence/rifting:** Poisson-disc sampling spawns new segments in the gap → ridge forms,
- **height cascading** propagates uplift to neighbors.

**Renderer:** the heightmap is the segment heights run through an additional **cascading/smoothing
shader** before meshing — i.e. again, the **data substrate (buoyant segment heights) is generated first,
then a render-side filter expresses it**.

**Relation to Well Dipper:** demonstrates a third, real-time-friendly way to get plates as data without a
full PDE solver, and reinforces the universal pattern: **buoyancy + per-segment crust state stored as
data → boundaries derived from inter-plate proximity → render filter on top.** It is time-stepped, so it
also conflicts with the spine's "place once, don't time-step" constraint — but its *data model* (per-cell
plate id, thickness, density, buoyant height) is the same target the slice is converging on.

Sources: <https://nickmcd.me/2020/12/03/clustered-convection-for-simulating-plate-tectonics/>,
<https://github.com/weigert/SimpleTectonics>

---

## 5. Other plate-as-data generators surveyed (corroborating the pattern)

- **Amit Patel / Red Blob Games — "map generation on a sphere"**
  (`redblobgames.com/x/1843-planet-generation/`): stores `r_plate = Int32Array(numRegions)` (region→plate
  id), assigns a **direction vector** per plate, classifies boundaries by **compression**
  (`Δdistance < −0.75` → mountain), and computes interior elevation by **interpolating three distance
  fields from the seeded plate centers**. A minimal, explicit, data-first plate model — same shape as
  Gainey. Source: <https://www.redblobgames.com/x/1843-planet-generation/>
- **PyTectonics (seanth)** — a 3D, "principled" but simple plate-tectonics simulator for worldbuilders
  (continental vs oceanic crust on a 3D sphere). Same data-first, simulate-then-store philosophy.
  Source: <https://github.com/seanth/PyTectonics>, <https://pytectonics.sourceforge.net/>

---

## 6. Synthesis — is the relief-slice approach (regime field + structural grain as arrays) consistent with established practice?

**Partly. The DISCIPLINE is consistent; the MODEL is not yet.**

**Where the relief slice is ALREADY aligned with established practice:**
1. **It stores tectonic state AS DATA in typed arrays** — `height`, `grainAngle`, `grainMag`, `regime`,
   `faultDensity`, `flowAccum`, `baseLevel`, `maturity` (`relief-substrate.js:9–17`). Every reference
   system above is built on exactly this: a per-cell attributed field that engines write and the renderer
   reads. The slice is on the correct side of the "data vs noise-substrate" line.
2. **It uses the host-editor / build-then-sculpt pattern** — E6 writes `height`, E9 subtracts from the
   SAME array over a later epoch (`relief-slice.js:38–44`). This is *exactly* Cortial's "evolve the crust
   fields over discrete steps, each interaction edits the same stored state," and platec's "step the
   raster." The mechanism (one mutable substrate, ordered editors) is textbook-correct.
3. **It steers noise BY the field rather than as the field** — `steeredNoise` orients relief by
   `grainAngle`/`regime` (`relief-e6-tectonic.js:85–95`). This is structurally the same operation as
   Cortial's Gabor noise oriented by stored `r`/`f`. The intent is right.
4. **E9 hydrology is a faithful, standard drainage model** — priority-flood depression fill (Barnes 2014)
   + D8 receivers + topological flow accumulation + stream-power incision (`relief-e9-hydrology.js`).
   This is exactly how carving-on-a-stored-DEM is done in the field; no concern here.

**Where the relief slice DIVERGES from established practice (and this is the WS4 UAT root cause):**
1. **There is no PLATE model.** Every reference system's load-bearing structure is *a discrete set of
   plates + their boundaries*. The slice has **none** — no plate partition, no plate ids per cell, no
   plate-relative motion, no boundary classification between two plates. Its E6 "grain" is a **closed-form
   latitude-banded despin/Vening-Meinesz stress field** (Melosh 1977; `relief-e6-tectonic.js:24–45`),
   which produces *zonal bands* (equator-thrust / mid-strike-slip / pole-normal), NOT plate-shaped
   continents, ranges-at-boundaries, cratons, or rift valleys. This is a legitimate model **for a
   one-plate despun shell (e.g. tidally-despun icy moons — Europa-like)**, but it is categorically not the
   plate-tectonics data model the four references use, and it cannot yield the plate-shaped macro-structure
   that makes a body "read as having a tectonic history."
2. **Because there are no plates, the relief amplitude/shape is still synthesized from noise per-cell and
   merely *oriented* by the band field.** That is precisely Max's UAT verdict: "an orientation overlay,
   not a planet with structure as data." In Cortial/Gainey/platec, the *elevation values themselves* come
   from the tectonic events (collision uplift, ridge profile, subduction trench) and noise only adds
   sub-grid texture; in the slice, the elevation **magnitude** is `baseAmp · steeredNoise(...) · grainMag`
   — i.e. noise scaled by a scalar, with the band field choosing only the *direction* of anisotropy.
   The data layer is too thin to carry the macro-structure.
3. **Known caveats compound this:** the slice DEM is a **flat 2D latitude band**, not a sphere/cubemap
   (`relief-slice.js` non-goals) — but a plate model is inherently a *whole-sphere partition* (Voronoi on
   the sphere in every reference). A latitude-band DEM cannot host plates that wrap the globe. So the
   "no plate model" gap and the "flat-DEM" gap are linked: adopting a plate model essentially forces the
   sphere-mapping integration the slice currently defers.

**Net:** the relief slice proves the *substrate/host-editor mechanism* the architecture needs, and its
data-first discipline matches the literature. But its tectonic engine (E6) is a **despun-shell zonal-stress
model, not a plate model**, so it does not produce the plate-shaped, boundary-derived macro-structure that
every surveyed plate-tectonics generator treats as the actual data. To satisfy the north star ("you see the
body's tectonic history"), E6 (or a new sibling engine) needs to generate **plates + boundaries as data**
(Voronoi-on-sphere partition à la Cortial/Gainey, plate motion via Euler pole, boundary-stress
classification → uplift/trench/ridge written into `height`), and let the existing steered-noise layer
amplify *that*, rather than generate relief from noise that the band field merely rotates.

---

## 7. Flag against a LOCKED design (per task instruction to surface, not silently contradict)

The locked design (`world-engine-wf2-synthesis.md` §2) is "share a first-class mutable RELIEF SUBSTRATE
that build engines write and sculpt engines edit, ordered by epoch (host-editor model)." **This research
does not challenge that lock — it strongly corroborates it** (it is exactly what Cortial and platec do).

However, one *tension worth surfacing* (NOT a contradiction, a scope/calibration note): the spine §0 lock
says "do NOT time-step billions of years; place plausible structure once per body." **All four reference
plate systems are time-stepped** (Cortial δt=2My iterated; platec stepped to completion; SimpleTectonics
real-time stepped; Gainey runs the flood-fill+boundary pass once but that single pass IS the placement).
The relevant distinction the references support: **you do not need a long *physical* time-integration, but
you DO need at least a *one-shot plate-placement pass*** — pick plate centroids, partition, assign motion,
classify boundaries, write boundary relief, spread to interiors (Gainey and Red Blob Games do exactly this
in essentially **one pass, no iteration**). That one-pass plate-placement model is fully compatible with
"place plausible structure once per body" and is the cheapest path to the plate-shaped data the slice
lacks. Worth confirming with Max whether E6's scope should expand from "despun zonal stress" to "one-pass
plate placement + boundary relief," since that is the gap between the slice's current output and the
surveyed practice.

---

## 8. Real URLs retrieved (no fabrication)

- <https://enki2.tumblr.com/post/104104415794/procedural-planet-generation-20140930-by-andy> (Gainey, mirror)
- <https://niltestudo.wordpress.com/2017/08/15/icosahedronal-world-generation/> (Gainey reimplementation)
- <https://perso.liris.cnrs.fr/eric.galin/Articles/2019-planets.pdf> (Cortial 2019, full PDF, read pp.3–7)
- <https://onlinelibrary.wiley.com/doi/10.1111/cgf.13614> (Cortial 2019, journal page; body paywalled)
- <https://github.com/Mindwerks/plate-tectonics> (platec fork)
- <https://raw.githubusercontent.com/Mindwerks/plate-tectonics/master/src/plate.hpp> (plate data members)
- <https://github.com/Mindwerks/worldengine/blob/master/worldengine/plates.py> (get_heightmap/get_platesmap consumer)
- <https://github.com/Mindwerks/pyplatec> (python wrapper)
- <https://nickmcd.me/2020/12/03/clustered-convection-for-simulating-plate-tectonics/> (clustered convection)
- <https://github.com/weigert/SimpleTectonics> (clustered convection repo)
- <https://www.redblobgames.com/x/1843-planet-generation/> (Red Blob Games sphere generation)
- <https://github.com/seanth/PyTectonics> / <https://pytectonics.sourceforge.net/> (PyTectonics)
