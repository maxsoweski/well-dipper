# Research — Tectonic Uplift + Erosion Procedural Pipelines (SOTA), vs the relief slice's E6/E9

**Task:** Web research on tectonic-uplift + fluvial-erosion procedural heightfield pipelines, structural/orogenic relief synthesis, and how a *coarse tectonic structure drives detailed relief* — then relate to the Well Dipper relief slice's **E6** (Melosh despun-shell stress → steered noise) and **E9** (priority-flood + stream-power incision), and judge whether the slice matches the state of the art.
**Date:** 2026-06-25. **Discipline:** READ-ONLY assessment; no code touched.
**Code grounded against:** `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-substrate.js`, `src/worldengine/base/tectonic.js` (production port), and the WS4 notes (`docs/WORKSTREAMS/world-engine-relief-wiring-2026-06-25/notes.md`).

---

## 0. Bottom line up front

The relief slice's **E9 IS the SOTA recipe**, implemented faithfully but at *reference* (not production) fidelity:

- E9's pipeline — **priority-flood depression fill → D8 receivers → topological flow accumulation → stream-power incision `dz = K·A^m·S^n`** — is exactly the algorithm chain that the foundational computer-graphics paper in this space (**Cordonnier et al. 2016, "Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion"**) introduced, sitting on the geology-side stream-power incision model (Howard 1994; Whipple & Tucker 1999) and the **Barnes 2014 priority-flood** + **Braun & Willett 2013 implicit O(n)** primitives. E9's code comments cite Barnes 2014 and Jain 2024 directly, and the math (`m=0.45, n=1.0`, so `m/n≈0.45`) is within the standard geomorphic range. **This is the correct technique.**
- The slice's honest caveats are precisely where it diverges from production SOTA: (a) **CPU bake** vs the GPU-parallel interactive solvers (Schott/Cortial 2023; Jain 2024 FastFlow), and (b) **flat 2D latitude-band DEM** vs the **spherical planet** formulation that already exists in the literature (**Cortial et al. 2019, "Procedural Tectonic Planets"**).

The **architectural finding that matters for the WS4 dispute** is orthogonal to "is the math SOTA": **all of the SOTA pipelines build relief AS A PERSISTENT HEIGHTFIELD ARRAY that uplift writes and erosion subtracts** — i.e. they are *exactly* the "structure as data" model the relief slice implements and that WS4's shader-steered-noise approach does NOT. The literature is unanimous on this. See §6.

---

## 1. The foundational graphics pipeline — Cordonnier et al. 2016

**"Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion"**, Cordonnier, Braun, Cani, Benes, Galin, Guérin, Peytavie. *Computer Graphics Forum* 35(2) (Proc. EUROGRAPHICS 2016), pp. 165–175.

This is the paper E9 is a direct descendant of. Method (from the abstract + ACM/HAL records retrieved):

- **Input = a user-painted UPLIFT MAP** (not a heightfield). The user paints *where the crust is rising* — the tectonic forcing — not the final terrain. This is the key inversion: **you author in the uplift domain, the relief EMERGES from simulation.**
- It builds a **stream graph** over the whole domain embedding elevation + stream flow, and applies the **stream power equation** (borrowed from geology) for hydraulic/fluvial erosion.
- **Combining crust uplift + stream-power erosion** produces large realistic terrains *at low computational cost.*
- It gives **high-level control over the large-scale dendritic structure** of river networks, watersheds, and mountain ridges.
- Implemented on a **triangulated irregular network (TIN)** with an **implicit time-integration scheme** (the Braun & Willett 2013 method, §3) so it is **unconditionally stable** and runs toward a quasi-**steady state** between uplift and incision.

The governing PDE (landscape evolution / detachment-limited stream power incision):

```
∂h/∂t  =  U  −  K · A^m · S^n
            │        │
         uplift   fluvial incision (stream power)
```

where `h` = elevation, `U` = uplift rate, `K` = erodibility, `A` = upstream drainage area, `S` = local channel slope, `m,n` = exponents. **Steady state** is `U = K·A^m·S^n` (uplift exactly balanced by erosion), which yields the characteristic concave river long-profile and the realistic ridge/valley spacing. `m/n ≈ 0.5` is the canonical choice (ResearchGate / ESurf sources).

**Bake-time vs real-time:** Cordonnier 2016 is **interactive *authoring*** (incremental, painted), but the per-step solve is still a serial CPU graph solve — it is *fast* but not per-frame GPU. In the slice's terms it is a **bake-time** technique used in an authoring loop.

> **Relation to E9:** E9 is a faithful, simplified Cordonnier-2016. It uses a **regular grid** (not TIN), an **explicit** bounded-increment integration (5 passes, capped so a cell never cuts below its receiver — `relief-e9-hydrology.js:137`) rather than the implicit Braun-Willett solver, and it **synthesizes** the uplift (E6 writes height first; E9 subtracts) rather than taking a *painted* uplift map. But the spine — drainage area → stream power → incision into a shared DEM — is identical. The chief fidelity gaps vs Cordonnier are: explicit-not-implicit integration (capped to stay stable), grid-not-TIN, and "place once" rather than run to steady state.

Sources:
- https://www.cs.purdue.edu/cgvlab/www/resources/papers/Cordonnier-Computer_Graphics_Forum-2016-Large_Scale_Terrain_Generation_from_Tectonic_Uplift_and_Fluvial_.pdf
- https://inria.hal.science/LJK_GI_IMAGINE/hal-01262376v1
- https://onlinelibrary.wiley.com/doi/10.1111/cgf.12820
- https://dl.acm.org/doi/10.5555/3058909.3058931

---

## 2. The depression / drainage primitives E9 already uses

### 2a. Priority-Flood — Barnes, Lehman & Mulla 2014
**"Priority-Flood: An Optimal Depression-Filling and Watershed-Labeling Algorithm for DEMs"**, *Computers & Geosciences* 62, pp. 117–127.

- Floods the DEM **inward from the edges using a priority queue**, processing cells in elevation order; the result has **no depressions or digital dams — every cell is guaranteed to drain.**
- The **"+ε" variant** raises each filled cell to its **spill point plus a tiny epsilon** so the filled surface still has a gradient (no flat artificial depressions). This is **exactly** what `priorityFloodFill` does: `filled[nb] = filled[c] + 1e-6` (`relief-e9-hydrology.js:34`).
- Complexity **O(n)** integer / **O(n log n)** float — the float case is E9's (Float32 heap).
- The paper explicitly recommends pairing depression-filling with **flow-direction derivation + flow accumulation** — which is E9's next two steps (`d8Receivers`, `flowAccumulate`).

> **Relation to E9:** E9's `priorityFloodFill` is a textbook Barnes-2014 implementation, including the +ε spill rule and seeding the heap from edges *and* sub-sea cells. The code comment correctly cites Barnes 2014. **SOTA-correct.**

Sources:
- https://richard.science/sci/2014_depressions.pdf (Barnes et al. 2014, retrieved PDF)
- https://arxiv.org/abs/1511.04463
- https://experts.umn.edu/en/publications/priority-flood-an-optimal-depression-filling-and-watershed-labeli

### 2b. Implicit O(n) stream-power solver — Braun & Willett 2013 (FastScape)
**"A very efficient O(n), implicit and parallel method to solve the stream power equation governing fluvial incision and landscape evolution"**, *Geomorphology* 180–181.

- Assigns each node **a single RECEIVER and possibly several DONORS**, recursively building a **node stack (the drainage graph) from outlet → crest**.
- **Implicit** time integration → **unconditionally stable** regardless of timestep; compute time **linear** in node count; parallelizable. This is the engine inside Cordonnier 2016 and the reference all later GPU work accelerates.

> **Relation to E9:** E9's `d8Receivers` (single steepest receiver per cell) + `flowAccumulate` (Kahn topological sort over the receiver tree — pour a node into its receiver only after all donors are in) **is the Braun-Willett receiver/donor stack**, done as an explicit topo-sort. E9 deliberately does NOT use the implicit incision update (it uses a capped explicit increment instead, `:135-137`), which is why it needs the "never cut below receiver" clamp for stability. This is the single biggest divergence from the geology-grade solver — and it is a *deliberate, documented* simplification ("bounded handful of passes… not 1, not ~200", `:111`).

Sources:
- https://www.sciencedirect.com/science/article/abs/pii/S0169555X12004618
- https://www.semanticscholar.org/paper/A-very-efficient-O(n),-implicit-and-parallel-method-Braun-Willett/7620ee44d1e31a198790b2d86979c5be62d528ed

---

## 3. The real-time / GPU frontier — Schott 2023 and Jain 2024 (the slice's deferred optimization)

### 3a. Schott, Cortial, Guérin, Peytavie, Galin et al. 2023 — interactive erosion authoring
**"Large-scale Terrain Authoring through Interactive Erosion Simulation"**, *ACM TOG* (2023), doi 10.1145/3592787. Open WebGPU reimplementation: **TerrainX** (GPU-Gang).

- The expensive part of the stream-power solve is the **drainage area** (global flow accumulation). Schott replaces it with a **parallel approximation of drainage area** that converges fast, runs on **GPU compute shaders**, and stays geomorphologically accurate.
- **Interactive / real-time:** users paint/erase uplift with brushes and watch erosion respond — TerrainX reports **40+ FPS at 4.5K resolution, 80+ FPS on real Himalayan DEMs.**
- **Known limitation (important):** the local/parallel approximation **stabilizes only if erosion is slow and CANNOT handle depressions** (interior local minima that interrupt flow paths). This is precisely the problem Barnes-2014 priority-flood solves serially and Jain-2024 solves on GPU.

Sources:
- https://dl.acm.org/doi/10.1145/3592787
- https://www.researchgate.net/publication/370270373_Large-scale_terrain_authoring_through_interactive_erosion_simulation
- https://github.com/GPU-Gang/WebGPU-Erosion-Simulation

### 3b. Jain et al. 2024 — FastFlow (the exact reference E9's comment names)
**"FastFlow: GPU Acceleration of Flow and Depression Routing for Landscape Simulation"**, *Computer Graphics Forum* (2024), doi 10.1111/cgf.15243.

- A **GPU flow-routing algorithm** that computes water discharge in **O(log n) iterations** for an n-vertex terrain (assuming n processors).
- Adds a **depression-routing algorithm** that routes water out of local minima, converging in **O(log² n)** — i.e. it fixes exactly the depression limitation that Schott 2023 has, but on the GPU (vs serial Barnes priority-flood).
- It is the **GPU acceleration of the flow-accumulation + depression-handling stage of the stream-power pipeline** — the production replacement for E9's CPU `priorityFloodFill` + `flowAccumulate`.

> **Relation to E9:** `relief-e9-hydrology.js:1-4` literally states "The runtime target is a GPU FastFlow (Jain 2024) bake; this CPU priority-flood + exact accumulation reference exists to prove the host-editor mechanism (drainage cuts E6 relief), not bake speed." **The slice's deferral note is exactly correct and names the right paper.** FastFlow (depression-aware) is the right port target, not the depression-blind Schott approximation — the slice picked correctly.

Sources:
- https://onlinelibrary.wiley.com/doi/10.1111/cgf.15243?af=R

---

## 4. The planet-scale formulation — Cortial et al. 2019 (the slice's deferred sphere mapping)

**"Procedural Tectonic Planets"**, Cortial, Peytavie, Galin, Guérin. *Computer Graphics Forum* (Proc. EUROGRAPHICS 2019), doi 10.1111/cgf.13614. Open PDFs: Galin's site, hal.science.

This is the most directly relevant SOTA paper to Well Dipper's actual goal (a *planet*, not a flat tile), and to the relief slice's biggest honest caveat (flat DEM → sphere is deferred).

- **Whole-sphere, coarse-structure-drives-detail by design.** It does NOT physically time-step billions of years of mantle convection. It **"captures fundamental phenomena into a procedural method that faithfully reproduces large-scale planetary features generated by the movement and collision of tectonic plates"** — approximating subduction/collision to deform continental + oceanic crust. **This is the same "place plausible structure once, don't time-step" philosophy the world-engine spine §0 mandates.**
- **Two-stage amplification (the coarse→detail mechanism):** a coarse plate-driven planet model is **amplified with either procedural noise OR real-world elevation data to synthesize coherent detailed relief.** The coarse tectonic structure (plate boundaries, ridges, collision belts) is the LOW-frequency *carrier*; detail is added respecting that carrier. This is the canonical answer to the task's "how does coarse tectonic structure drive detailed relief."
- **Interactive:** the user controls plate motion and can trigger events (catastrophic rifting); the planet evolves under user control. Bake-then-render for the final body.
- Landforms produced: continents, oceanic ridges, large-scale mountain ranges, island arcs.

> **Relation to the slice:** Cortial 2019 is the proof that the full pipeline (tectonic structure → amplified relief → erosion) **works on a sphere**, and that the right shape is *coarse-structure carrier + detail amplification*. It validates the slice's two halves (E6 builds structure, E9 carves) but shows the slice is still at the **flat-tile** stage the literature passed in 2019. Note: Cortial 2019's *uplift* model is a **plate-tectonics** model (plates move and collide), which is RICHER than the slice's E6 (a despun-shell membrane-stress LATITUDE field). For *Earth-like plate planets* the slice's E6 is under-modeled; for *one-plate / stagnant-lid / icy bodies* (despinning, tidal, radial-strain dominated — Mercury lobate scarps, Europa, the Moon) the slice's Melosh despun-shell model is the more physically appropriate driver. They cover different tectonic regimes — see §5.

Sources:
- https://perso.liris.cnrs.fr/eric.galin/Articles/2019-planets.pdf
- https://hal.science/hal-02136820v1/file/2019-Procedural-Tectonic-Planets.pdf
- https://onlinelibrary.wiley.com/doi/10.1111/cgf.13614
- https://www.physicsbasedanimation.com/2019/05/08/procedural-tectonic-plates/

---

## 5. E6 vs the structural-uplift literature

E6 (`relief-e6-tectonic.js`) does NOT use the graphics-community plate model. It uses a **planetary-science membrane-stress** model:

- **Melosh 1977 "Global tectonics of a despun planet" + Vening Meinesz 1947** — a constant-thickness thin-shell idealization (ν=0.25) giving the two horizontal membrane principal stresses for a *despinning* planet: equator→thrust, mid-lat→strike-slip, pole→normal, with documented sign changes near ~38° and ~57° (`relief-e6-tectonic.js:1-8`, `src/worldengine/base/tectonic.js:13-16`).
- It derives an **Anderson fault regime** (thrust/strike-slip/normal) per latitude band and a **grain (lineament strike)** perpendicular to the dominant principal stress, then **steers anisotropic noise** by that grain (long parallel scarp ridges under contraction, blockier horst-graben under extension — `:85-95`), plus an **isostatic plateau** uplift on thick-crust blobs capped by `1/√g` (`:118-121`).

**Assessment of E6 vs SOTA:**
- As a *physical driver* of structural grain for **non-plate / one-plate bodies** (despun, tidally stressed, contraction-scarp worlds — the Moon, Mercury, Europa, icy moons), the Melosh despun-shell model is the **correct planetary-science choice** and is *more physically grounded* than graphics-paper plate heuristics for those bodies. Good fit to Well Dipper's "billions-of-years history as data" frame.
- As *relief synthesis*, E6 is the **weak link relative to the task's "coarse structure drives detailed relief"** standard. E6 produces a **latitude-banded orientation field (grain) + a magnitude scalar**, then **synthesizes the actual relief from simplex noise steered by that grain.** That is "oriented noise," not "structure as the carrier of amplified detail." The Cortial-2019 standard is: the coarse tectonic structure (ridge lines, collision belts, fault traces) is an *explicit geometric carrier*, and detail is amplified *on top of that geometry*. E6's grain is a *director field*, not a *geometry of fault traces/ridge lines*. **This is the same gap the WS4 UAT failure names** (see §6) — and it is present even in the Max-PASSED slice's E6, just less visible there because E9 then carves real drainage into the resulting height array, giving the eye structure-as-data downstream.

> Net: E6 is a defensible, physically-motivated *forcing field* for the regime/grain, but it is the part of the slice furthest from the "coarse structure → amplified detail" SOTA. The slice's win comes mostly from **E9 carving real drainage into a real height array** (data), not from E6's relief being structurally authored.

Sources for the planetary-science basis (Melosh despun-shell, Anderson regimes) are textbook/classical (Melosh 1977; Anderson 1951) — cited in-code; not independently re-fetched (pre-web, settled science).

---

## 6. The architectural finding that decides the WS4 dispute

The task frames a tension: WS4 wired E6 *grain orientation* into the **production shader's combiner axis reads** (`notes.md` lists six combiner axis reads + six deriveUniforms hashes), but Max's UAT FAILED it because **relief is still synthesized from noise in the fragment shader, merely ORIENTED by the grain** — it reads as "an orientation overlay," not "a planet with a tectonic history as data."

**The SOTA literature comes down unambiguously on the slice's side, and explains *why* WS4 reads wrong:**

1. **Every** SOTA tectonic-erosion pipeline (Cordonnier 2016, Schott 2023, Jain 2024, Cortial 2019) operates on a **persistent elevation array** where **uplift WRITES height and erosion SUBTRACTS height**. The relief IS data that has been built and carved. Reading the final terrain *is* reading its history because the history physically deposited and removed material from a shared buffer. This is identical to the relief slice's `ReliefSubstrate` (`relief-substrate.js`: `height` is "THE host DEM (E6 writes, E9 subtracts)") and to the world-engine spine's "PROCGEN DECIDES, RENDER EXPRESSES."

2. **No SOTA pipeline derives relief by steering fragment-shader noise with a coarse orientation field.** Orientation-steered noise (E6's `steeredNoise`, and what WS4 wired into the shader) is a *texture-detail / amplification* trick — useful as the LAST step on top of an already-built structural heightfield (cf. Grenier 2024 "Real-time Terrain Enhancement with Controlled Procedural Patterns," which *adds spatially-varying erosion patterns* to terrain that already exists). It is not a substitute for building the structure as data. **WS4 inverted the dependency: it used the amplification trick as the structure.** That is exactly why UAT reads it as "an orientation overlay."

3. **The drainage network is the load-bearing "history" signal.** What makes terrain read as *having a history* is the **dendritic drainage network carved by stream power into a real heightfield** — concave river profiles, branching valleys, watersheds, lakes filling residual depressions. This is data E9 produces in the slice's array (`incision`, `flowAccum`, `standing`, `baseLevel`) and that a fragment shader steering noise by a latitude grain **structurally cannot produce** (no global flow accumulation in a fragment shader without a baked field to read). **Hack's law** (river length ∝ basin area^h, h ≈ 0.57–0.6; Nature Comm 2018; Wikipedia) is the standard *realism check* that the carved network is statistically river-like — a check you can only run against a real drainage field, i.e. against data.

**Therefore the relief slice (root files) and `src/worldengine/base/*` are NOT a contradiction with WS4 — they are the correct architecture WS4 was missing.** The slice builds `ReliefSubstrate` as the persistent height array (E6 writes, E9 carves), matching the SOTA "structure as data" model and the spine's locked design (`world-engine-wf2-synthesis.md` §2: shared first-class mutable relief substrate; BUILD engines write, SCULPT engines edit). WS4 wired only E6's *orientation director* into the shader and kept relief as shader noise — i.e. it shipped the amplification layer without the substrate underneath it.

**This corroborates (does not challenge) the locked design.** The 2026-06-22 lock — "share a first-class mutable RELIEF SUBSTRATE that BUILD engines WRITE and SCULPT engines EDIT" — is precisely the SOTA architecture. No lock needs flagging. If anything, the SOTA strengthens the case that the *production renderer* should READ a baked substrate field (built by the slice's E6+E9 ported to the sphere via FastFlow), not steer shader noise by a thin grain.

---

## 7. Three surfaces — how they relate (clarification asked for in the task)

1. **Relief SLICE (repo-root `relief-*.js` + `world-engine-relief-lab.*`)** — Max-UAT-PASSED 2026-06-23. The **reference implementation** of the host-editor model on a **flat 2D latitude-band DEM**: `makeSubstrate` host array; `runE6` writes structural relief (Melosh grain + steered noise + isostatic plateau); `runE9` carves real drainage (priority-flood + D8 + flow-accum + stream-power incision). This is the **"structure as data" proof**, matching SOTA §1–§3.
2. **Production port (`src/worldengine/base/*`)** — `tectonic.js` is an explicit "Production port of relief-e6-tectonic.js" with the **same** stress math (NU=0.25, REGIME_GAIN=0.4 LOCKED) PLUS a **sphere-native path** (`writeGrainSphere`, F3 carrier, per-node latitude so antimeridian/pole seams agree by construction — `tectonic.js:50-63`). This is the **slice being lifted toward the sphere** — i.e. the start of resolving the §4 (Cortial-2019) deferred sphere-mapping caveat. `baseStep.js`, `substrate.js`, `sphereField.js`, `adaptL0.js`, `verify.js` are the production substrate + L0-derive + verification scaffolding.
3. **WS4 production-shader wiring (`planet-lod-lab.html` shader, per `notes.md`)** — wired E6 **grain ORIENTATION** into six shader combiner axis reads, keeping the province AMPLITUDE masks (`gProvince`/`initProvinces`/`provinceWeight`) and keeping relief as in-shader noise. **This is the amplification layer WITHOUT the substrate** — the §6 inversion. UAT-failed; not shipped.

**Relationship:** 1 → 2 is the right trajectory (reference → sphere-native production port, per the §4/§3b deferred work). 3 is a *different, shallower* integration that tried to express the grain without first building/baking the substrate as data; the SOTA says 3 cannot read as "history" without the substrate from 1/2 underneath it.

---

## 8. Bake-time vs real-time map (for the production-port decision)

| Pipeline stage | SOTA technique | Bake or real-time | Slice status |
|---|---|---|---|
| Tectonic structure (uplift/grain) | Cortial 2019 plate model (sphere); Melosh despun-shell (planetary sci) | Bake (place once) | E6 = Melosh despun-shell, **bake** ✓ |
| Depression fill | Barnes 2014 priority-flood (serial CPU) | Bake | E9 `priorityFloodFill`, **bake** ✓ |
| Flow routing / drainage area | Braun-Willett 2013 (CPU O(n)); **Jain 2024 FastFlow GPU O(log n)**; Schott 2023 GPU approx (no depressions) | Bake (CPU) → near-real-time (GPU) | E9 D8+topo-accum, **CPU bake** ✓ (FastFlow = named port target) |
| Stream-power incision | `K·A^m·S^n` implicit (Cordonnier/Braun) | Bake | E9 explicit capped, **bake** ✓ |
| Detail amplification on built structure | Grenier 2024 controlled procedural patterns; noise amplification (Cortial 2019 stage 2) | **Real-time (in shader)** | This is the ONLY part that belongs in the fragment shader — and is what WS4 mistook for the whole pipeline |

**Implication for the production port:** the structural + drainage stages are **bake-time** and should produce a **baked substrate field** (height + drainage + regime + grain) the renderer SAMPLES. Only **detail amplification** belongs in the real-time shader. WS4 put the carrier in the shader; SOTA says the carrier is baked data and only the icing is real-time.

---

## 9. Applicability to the production port (concise)

- **Keep E9's pipeline as-is for the bake** — it is the correct, SOTA-aligned recipe (Cordonnier-2016 lineage, Barnes-2014 + Braun-Willett-2013 primitives). The named port target (**Jain-2024 FastFlow**, depression-aware GPU) is the right production accelerator; do NOT downgrade to Schott-2023's depression-blind approximation.
- **The sphere is the real next step** (Cortial-2019 shows the whole pipeline on a sphere; `src/worldengine/base/tectonic.js` already begins the sphere-native grain). The slice's flat-DEM + cubemap-seam-lake caveat is the known gap; FastFlow-on-cube-sphere + seam-correct priority-flood is the work.
- **E6 is the weakest link vs "coarse structure drives detail"**: it's a director field + steered noise, not an explicit structural carrier. For Earth-like plate planets, consider a Cortial-2019-style coarse plate/ridge geometry as the carrier; for despun/tidal/icy bodies, E6's Melosh model is the right physics but should still write *into the height array as structure* (which the slice does via the plateau + grain-modulated amplitude) rather than only an orientation the shader reads.
- **The decisive architectural point for WS4:** the production renderer should **READ a baked relief substrate** (the slice's `height`/`flowAccum`/etc., ported to sphere), not **steer in-shader noise by a thin grain**. The entire SOTA corpus builds relief as a persistent, written-and-carved height array; that — not orientation-steered noise — is what makes a body "read as its history." WS4's UAT failure is consistent with the literature, and the locked "shared mutable relief substrate" design is the SOTA-correct fix. **No locked design is challenged by this research; it is corroborated.**

---

## Sources (all retrieved this session)

- Cordonnier et al. 2016, *Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion*, CGF: https://www.cs.purdue.edu/cgvlab/www/resources/papers/Cordonnier-Computer_Graphics_Forum-2016-Large_Scale_Terrain_Generation_from_Tectonic_Uplift_and_Fluvial_.pdf · https://inria.hal.science/LJK_GI_IMAGINE/hal-01262376v1 · https://onlinelibrary.wiley.com/doi/10.1111/cgf.12820 · https://dl.acm.org/doi/10.5555/3058909.3058931
- Barnes, Lehman & Mulla 2014, *Priority-Flood*, Computers & Geosciences: https://richard.science/sci/2014_depressions.pdf · https://arxiv.org/abs/1511.04463 · https://experts.umn.edu/en/publications/priority-flood-an-optimal-depression-filling-and-watershed-labeli
- Braun & Willett 2013, *Very efficient O(n) implicit stream-power method (FastScape)*, Geomorphology: https://www.sciencedirect.com/science/article/abs/pii/S0169555X12004618 · https://www.semanticscholar.org/paper/A-very-efficient-O(n),-implicit-and-parallel-method-Braun-Willett/7620ee44d1e31a198790b2d86979c5be62d528ed
- Schott, Cortial, Guérin, Peytavie, Galin et al. 2023, *Large-scale Terrain Authoring through Interactive Erosion Simulation*, ACM TOG: https://dl.acm.org/doi/10.1145/3592787 · https://www.researchgate.net/publication/370270373_Large-scale_terrain_authoring_through_interactive_erosion_simulation · https://github.com/GPU-Gang/WebGPU-Erosion-Simulation
- Jain et al. 2024, *FastFlow: GPU Acceleration of Flow and Depression Routing*, CGF: https://onlinelibrary.wiley.com/doi/10.1111/cgf.15243?af=R
- Cortial, Peytavie, Galin, Guérin 2019, *Procedural Tectonic Planets*, CGF: https://perso.liris.cnrs.fr/eric.galin/Articles/2019-planets.pdf · https://hal.science/hal-02136820v1/file/2019-Procedural-Tectonic-Planets.pdf · https://onlinelibrary.wiley.com/doi/10.1111/cgf.13614 · https://www.physicsbasedanimation.com/2019/05/08/procedural-tectonic-plates/
- Hack's law / drainage-network realism: https://en.wikipedia.org/wiki/Hack's_law · https://www.nature.com/articles/s41467-018-06210-4
- Tzathas et al. 2024, *Physically-based analytical erosion for fast terrain generation*, CGF: https://onlinelibrary.wiley.com/doi/abs/10.1111/cgf.15033 (corroborating: fast analytical stream-power for terrain)
