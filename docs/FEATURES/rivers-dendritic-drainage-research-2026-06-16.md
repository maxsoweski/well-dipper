# Rivers (F11) — dendritic drainage research (2026-06-16)

> Source: `deep-research` workflow (104 agents, 22 sources, 105 claims → 25 verified, 24 confirmed /
> 1 refuted). Triggered because the Theme-B scale recalibration made rivers smaller but not
> river-shaped. Art-director spec (Max, verbatim): *"rivers run in straight sections and then they
> branch off almost like trees when they meet larger bodies of water; these just don't look like
> rivers."* Load-bearing findings rest on peer-reviewed primary sources (Génevaux ACM TOG 2013,
> Cordonnier CGF 2016, Schott ACM TOG 2023, Runions EG 2007) + HydroSHEDS.

## The root cause (confirmed by the literature)
Real dendritic drainage comes from **coupling channels to terrain elevation + upstream drainage
area** — NOT from noise isocontours. Water flows from each point to its **lowest neighbour**
("receiver"); because single-flow-direction links can't form loops, they yield a **forest of trees
rooted at lakes/ocean outlets** (Cordonnier 2016, Braun–Willett FastScape lineage). The current F11
`drainageField()` (near-zero band of warped FBM, tributaries unioned by `max()`) has **no flow
direction, no downhill coupling, no accumulation** → meandering worm-trails, not a drainage tree.
The governing physics is the **stream-power incision law** `dh/dt = u − k·A^m·s^n` (A = upstream
drainage area, s = ∇h = the analytic gradient; canonical n=1, m=0.5).

## ⚠ The architectural decision (THE fork)
**None of the realistic techniques run as a live per-fragment analytic primitive** the way the
current noise-band does. Drainage is an inherently **global** computation (flow routing + area
accumulation over the whole surface = an O(N) graph pass or iterative GPGPU sim). So realistic
rivers mean **committing the river feature to the texture-bake path**:

> grow/simulate the network **offline (or in a GPU-compute bake pass)** → bake a texture set
> (flow-direction + drainage-area + signed-distance-to-channel) → the fragment shader **samples +
> carves** it, taking analytic gradients of the *carve profile* (so normal-mapping stays consistent).

This diverges rivers from the lab's "everything live in-shader" model. The **game already has a
texture-bake pipeline**, so this is architecturally available — but it's a real commitment, not a
tweak to the existing primitive.

## Candidate approaches (ranked for this architecture)

### A — Hydrology-first graph generation (Génevaux et al. 2013) — RECOMMENDED
Build the river network FIRST as a geometric graph, then synthesize terrain around it.
- **Growth:** grammar-like rewriting with 3 Horton-Strahler production rules — continuation `Pc`,
  symmetric junction `Ps` (two order-(n−1) children), asymmetric junction `Pa` (order-n + order-m<n),
  with user probabilities `Pc+Pa+Ps=1` controlling branch density.
- **Downhill coupling:** each new node must be **higher than its ancestor** (water flows down),
  bounded by a Lipschitz slope cap `|pz−pzi| < κ·d(p,pi)` (prevents cliffs). ← the coupling the
  noise primitive lacks.
- **Confluence angle:** from relative Horton-Strahler flow — comparable flows meet at **acute**
  angles (the tree-branch look); a small tributary into a large river meets near-**perpendicular**.
- **Width:** from watershed area via `φ = 0.42·A^0.69` (Dunne–Leopold); A grows monotonically
  downstream ⇒ rivers widen toward outlets.
- **Representation:** continuous analytic height `h(p)` as a construction tree of compactly-supported
  primitives; rivers = signed-distance carve profiles perpendicular to the curve skeleton
  (`h(p)=uz(p)+δ(d(p))`). **This SDF form is what makes it bake-/shader-friendly + differentiable.**
- **Pros:** gives the *exact* art-director signature; bake-friendly; open-source ref impl
  (`terrainHydrology`, Python — "inspired-by", partial). **Cons:** paper targets a **2D domain, not a
  sphere**; ref impl is incomplete.
- Sources: Génevaux 2013 (Purdue PDF), terrainHydrology (GitHub).

### B — Erosion simulation (Cordonnier 2016 / Schott–Paris 2023) — heavier, more physical
Don't author the network; let it **emerge** from simulating stream-power erosion over an uplift
field. O(N) Braun–Willett stream-tree + O(N) drainage-area accumulation; lake routing
O(N + M·logM). Schott 2023 implements the drainage-area + stream-power passes as **GLSL compute
shaders** (interactive) — repo `H-Schott/StreamPowerErosion` (`spe_shader.glsl`, `#version 450`,
compute).
- **Pros:** most physically grounded; emergent dendritic networks; GPU-compute proven; a Well-Dipper
  GLSL bake step could host it. **Cons:** iterative GPGPU sim (definitely a bake, never per-fragment);
  more compute; coupling the emergent network to our existing base-terrain is non-trivial.
- Sources: Cordonnier 2016 (CGF), Schott 2023 (ACM TOG) + repo.

### C — Space colonization (Runions/Prusinkiewicz 2007) — the literal "branch like trees" algo
Grow a branching skeleton from a base node by seeding space with attraction points; each new node
steps distance D toward the normalized sum of directions to nearby attractors (`v' = v + D·n̂`);
branches split automatically when pulled in divergent directions; tips die at kill-distance. Width
via the **pipe model** (`r^n = r1^n + r2^n`, n≈2–3).
- **Pros:** dead-simple, directly the tree-venation algorithm Max intuited, very controllable.
  **Cons:** **not coupled to terrain slope by itself** (would need an elevation/downhill constraint
  bolted on); less hydrology-grounded — risks looking tree-like but not *drainage*-like.
- Source: Runions 2007 (algorithmicbotany PDF).

## Open problems specific to Well Dipper (unverified by the research)
1. **Sphere drainage** — every cited method is planar/heightfield-grid. Routing basins to ocean
   outlets on a unit sphere without pole/seam artifacts (geodesic/icosphere grid, or cube-map-per-face
   bake stitched across seams) is **the real unsolved engineering bit**. The lowest-neighbour
   stream-tree concept transfers conceptually but no source demonstrates it on a sphere.
2. **Bake-texture layout** for our shader: flow-dir + drainage-area + signed-distance-to-channel, and
   deriving analytic height/normal gradients from the carve profile to match the existing pipeline.
3. **Budget/resolution** at planet scale within the existing bake budget (tile size, O(N) growth +
   Voronoi decomposition cost).
4. **"Straight reaches that bend"** specifically: Génevaux's slope-constrained near-straight reaches
   vs. an explicit straightening pass vs. layering optional particle meandering on top.

## Refuted / weak
- Houdini "Slope Influence controls straightness" — **refuted** (1-2), don't rely on it.
- Meandering-via-momentum (nickmcd.me blog) — medium confidence, tangential to the dendritic spec.

## Recommendation
Prototype **A (Génevaux hydrology-first → bake → shader carve)** in an isolated `rivers-lab.html`
harness first (per the standing isolated-harness rule), on a **flat patch** to validate the look
before tackling the sphere. Keep **B** in reserve if we want emergent realism and are willing to
spend the GPU-compute bake. The sphere routing (open problem #1) is the highest-risk unknown and
should be de-risked early.
