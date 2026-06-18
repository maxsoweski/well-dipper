# C — Global Routing vs. Local View-Dependent Detail

**The crux:** drainage *routing* is global (water needs a downhill path across the whole planet), but render *detail* must be local/view-dependent (refine only the visible patch). Goal: take a coarse global flow solution and synthesize fine local detail that agrees with the global trunks and doesn't pop on zoom.

## Established resolution: "bake coarse global once, amplify deterministically per-patch"
The literature strongly favors a **two-tier split**, not full per-chunk regeneration:
- **Tier 1 (global, baked once):** a low-res drainage graph / flow field over the whole planet. Computed via flow-direction + flow-accumulation (D8 is the deterministic industry standard) on a coarse heightfield, or as an explicit river *graph* (Génevaux et al.) over the domain. This fixes the trunk topology and is small/cheap to store.
- **Tier 2 (local, on demand):** detail (extra tributaries, meanders, width-by-Horton-order) synthesized *conditioned on* Tier 1, only for the patch in view.
- Why not full per-chunk regen: routing is inherently non-local — you cannot decide flow direction from one patch in isolation without seeing the basin. So the global pass is unavoidable; the open problem is making Tier 2 *consistent + deterministic*.

## Candidate mechanisms (the actual reconciliation)

**1. Dendry — locally-computable dendritic noise conditioned on a coarse control function (BEST FIT).**
Gaillard, Benes, Guérin, Galin, Rohmer et al., I3D 2019. A *procedural function evaluable at a single point without global context*, producing a coherent branching (dendritic) network. Crucially it is **driven by a coarse "control function"** (low-res guide) and is deterministic + seeded, so the same point always returns the same value → no popping, and detail refines continuously with view distance. **Explicitly demonstrated for terrain heightfields with consistent river networks.** This is almost exactly the architecture the spike needs: bake the global control field, then evaluate Dendry pointwise per visible vertex/texel at whatever LOD the patch needs. (~10 s for 512² on CPU in 2019 — GPU/pointwise eval is the modern move.)

**2. Terrain amplification — detail synthesis conditioned on a coarse base.**
Guérin et al.: "Sparse representation of terrains" (CGF/EG 2016) and "Interactive Example-Based Terrain Authoring with cGANs" (ToG 2017, the "texture-by-numbers"/sketch-guided line). General pattern: a coarse base + an exemplar/learned prior → fine detail that *respects* the base. Maps to rivers as "amplify the coarse drainage map into fine tributaries." Caveat: neural/dictionary amplification is not inherently deterministic-per-point or seamless across tile boundaries — would need tiling care; higher risk than Dendry.

**3. Génevaux et al. hydrology graph (global authoring layer).**
"Terrain Generation Using Procedural Models Based on Hydrology," ToG 2013. Builds a **hierarchical drainage graph** (rivers as first-class modeling primitives), derives watersheds, then generates terrain by blending/carving river *patches*. Best as the **Tier-1 generator** (gives a clean, classifiable trunk network with Horton/Strahler order for width), feeding Tier-2 Dendry/amplification. Construction-tree representation supports re-evaluation.

**4. Derzapf et al. — direct precedent for the exact problem.**
"River Networks for Instant Procedural Planets," CGF 2011 (Uni Bonn). Generates whole planets *with* river networks from a coarse base, with **GPU view-dependent refinement/coarsening at per-vertex granularity during fly-throughs** — i.e. it already couples a global river network to adaptive LOD geometry. Closest published end-to-end system to the spike's scenario; worth reading for how they keep the network stable under refinement.

## Determinism / anti-popping (the seam discipline)
- Seed all Tier-2 synthesis from **position-hash PRNGs** (FNV/xorshift seeded by spatial coords): "same region requested again returns exactly the same value, independent of query order." This is the standard chunk-determinism guarantee (Minecraft-style) and is what makes view-dependent regen pop-free.
- Resolve neighbor tiles by **re-running the function from neighbor positions and keeping only intersecting features** — avoids seams without storing global state.
- Resolution caveat (hydrology): coarse flow accumulation captures *regional* drainage but not fine paths — so Tier-2 must *add* sub-network detail below the coarse threshold, not re-route trunks.

## Games / engines (consistent with the above, less documented)
- **Outerra:** sparse compressed base + GPU fractal refinement from km to cm, parametrized by elevation/land-class; renders water-flow normal maps. Detail is procedural-fractal *conditioned on* the coarse base — same coarse→fine philosophy.
- **Star Citizen:** stores heightmaps + planet data, builds chunks dynamically; rivers authored via erosion/flow nodes (Substance Designer) baked into the heightmap rather than runtime-routed. Implies the macro path is **fixed/baked**, detail built per-chunk — supports the "bake global, detail local" stance. (Exact runtime river pipeline not publicly documented — *unverified*.)

## Bottom line for the spike
Bake a coarse global drainage layer once (D8 flow-accum or a Génevaux-style graph → trunk topology + Strahler order), then synthesize visible-patch detail with a **deterministic, position-seeded, control-function-conditioned** evaluator — **Dendry is the proven, lowest-risk match.** Full per-chunk regeneration is the wrong move; the global routing pass is structurally required.

## Sources
- Gaillard, Benes, Guérin, Galin, Rohmer et al. — *Dendry: A Procedural Model for Dendritic Patterns*, I3D 2019. https://www.cs.purdue.edu/cgvlab/www/publications/Gaillard19I3D/ · PDF https://www.mgaillard.fr/content/publications/pdfs/Gaillard19I3D.pdf · HAL https://hal.science/hal-02150651 · code https://github.com/mgaillard/Noise
- Guérin, Digne, Galin, Peytavie — *Sparse representation of terrains for procedural modeling*, CGF / Eurographics 2016. https://github.com/eric-guerin/terrain-amplification
- Guérin, Digne, Galin, Peytavie, Wolf, Benes, Martinez — *Interactive Example-Based Terrain Authoring with cGANs*, ACM ToG 2017. https://www.researchgate.net/publication/320345887
- Génevaux, Galin, Guérin, Peytavie, Benes — *Terrain Generation Using Procedural Models Based on Hydrology*, ACM ToG 2013. https://www.cs.purdue.edu/cgvlab/www/resources/papers/Genevaux-ACM_Trans_Graph-2013-Terrain_Generation_Using_Procedural_Models_Based_on_Hydrology.pdf · HAL https://hal.science/hal-01339224
- Derzapf, Ganster, Guthe, Klein — *River Networks for Instant Procedural Planets*, CGF 2011. https://cg.cs.uni-bonn.de/backend/v1/files/publications/derzapfPlanets.pdf
- D8 flow accumulation (deterministic drainage standard): https://jblindsay.github.io/ghrg/Whitebox/Help/FlowAccumD8.html · threshold/resolution: https://www.mdpi.com/2072-4292/13/11/2024
- Position-hash determinism / chunk regen: Voxel Tools docs https://voxel-tools.readthedocs.io/en/latest/procedural_generation/
- Outerra planet engine (coarse base + procedural fractal refinement): https://en.wikipedia.org/wiki/Outerra · https://www.gamedeveloper.com/business/-i-outerra-i-a-seamless-planet-rendering-engine
- Star Citizen rivers (baked-into-heightmap; runtime pipeline *unverified*): https://starcitizen.tools/Rivers · https://starcitizen.fandom.com/wiki/Inside_Star_Citizen:_River's_Edge_-_Winter_2021
