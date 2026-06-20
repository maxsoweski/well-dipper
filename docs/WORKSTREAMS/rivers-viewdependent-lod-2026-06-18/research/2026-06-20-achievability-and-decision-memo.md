# River scale/appearance — achievability + decision memo (2026-06-20)

> **Origin:** Max gave UAT feedback on the planet-LOD lab rivers — (1) edges too artificially
> smooth, (2) water sits on top of / doesn't interact with terrain (the crater example below), (3)
> forms read as zoomed-in / too large when the whole planet disc is visible. He chose
> "investigate-then-decide" before any build. This memo = the output of a 5-agent investigation
> workflow (prior-art synthesis · current-mesh achievability numbers · ribbon-vs-SDF throwaway risk ·
> fresh SOTA check · synthesis) **plus** a working-Claude addendum on the crater/endorheic-lake
> co-dependence gap (the strands didn't cover it). Read-only investigation; no code changed.
> **Decision still pending Max.**

## Recommendation (from the synthesis): SEQUENCED, lean toward spike

Of the three complaints, only **#1 (over-smooth edges)** is fully fixable by tuning. **#2 (water on
top) and #3 (forms too large) hit hard resolution walls that no tuning can move** — they need finer
vertices in the visible patch, i.e. the view-dependent-LOD spike. And the cheap polish you'd reach
for on #2/#3 lands on the ribbon-extrusion code the (high-likelihood) SDF pivot deletes.

## The hard numbers (current 40k global mesh, Earth radius 6371 km)

| Quantity | Value | Consequence |
|---|---|---|
| Mesh floor (vertex spacing) | ~113 km (square) / ~121 km (hex) | No channel closer than one vertex |
| Effective channel spacing | ~140 km | Rivers read as continental gashes 140 km apart |
| River FULL width | 4.6 km (head) → 92.6 km (trunk), after widthRadiusFactor 0.807 | Trunks ~5× a real ~10 km river; accum^0.69 saturates MAX fast |
| Self-erase threshold | ~0.4× network widths | Below this the network vanishes at orbit |
| At 0.4× | trunks ~46 km, heads ~2.3 km | The floor for pure width tuning |
| Realistic ~10 km river | ~0.09× of WIDTH_MAX | **4.4× below the self-erase floor — unreachable by tuning** |

A realistic-width, realistically-spaced network is **geometrically impossible** on one 40k global
mesh. "Thread-thin and numerous up close" cannot be tuned into existence.

## Interim-tuning CEILING vs WALL, per complaint

**#1 over-smooth edges** — *most fixable (pure representation).* Ceiling: CHAIKIN_ITERS 3→1/0, widen
MIN..MAX band, lower WIDTH_EXP so width varies along channel, add centerline jitter/meander. Wall:
real banks (meander cutoffs, braiding, oxbows) live finer than the 113 km vertex pitch; the
centerline is anchored to mesh vertices, so you can roughen but not add sub-vertex sinuosity.

**#2 water on top / crosses craters** — *partially fixable.* Ceiling: lower LIFT, raise
VALLEY_DEPTH_LO/HI, widen VALLEY_WIDTH_MUL, raise CARVE_CUBE_SIZE 1024→2048 (~10→~4.9 km/texel).
Wall: the carve cube's angular resolution is fixed and global; anything finer than the texel is
invisible to the carve, so the river crosses it. True per-feature draping needs the camera-localized
~1 km/texel patch = the spike.

**#3 forms too large at disc scale** — *least fixable.* Ceiling: width can drop ~2× toward the 0.4×
floor; per-seed/per-radius multipliers thin big worlds; raising MIN_ORDER thins the *count* but not
the *spacing*. Two walls: width self-erases below 0.4× (realistic 10 km is 4.4× below that), and
spacing is hard-bounded by the 113 km vertex pitch (can never place rivers 10–30 km apart).

## Working-Claude addendum — the crater / endorheic-lake co-dependence gap

Max's illustrative example: a river flowing *out* of a crater implies a pour-point lake filled the
basin and breached the rim. Verified against the code:

- **The routing side already computes this.** `routeAndOrder` runs a **priority-flood**
  (`planet-lod-rivers.js:288`): it raises each closed basin's pit to its pour-point level (`filled[]`)
  and routes the overflow over the lowest rim saddle. The endorheic hydrology *exists* — for any
  basin the 40k mesh resolves.
- **But `filled` is discarded before rendering.** It feeds routing only (`surf`, receiver). Standing
  water is a **separate, GLOBAL sea-level cut**: `liquidMask = smoothstep(uSeaLevel±0.02, h)`
  (`:435`). So an elevated crater lake the router pooled **never renders** — only terrain below the
  single global sea level floods. There is no per-basin lake.
- **Rim breach is uncoordinated.** The overflow *is* routed over the lowest saddle and the channel
  carve cuts a groove there, but the crater rim (`craterCombiner`) isn't explicitly lowered to match
  — it's a race between carve depth and rim height (visual outcome unverified; the spike would settle).
- **Sub-mesh craters (<~140 km) are invisible to the router** — none of the above even fires.

**Why this matters for the decision:** a `filled − h` per-basin **lake mask**, rasterized via the
**existing carve cube-map infrastructure**, would render crater/closed-basin lakes for any
mesh-resolved basin — a concrete co-dependence win that uses the router's already-computed data. It
is built on the **carry-over substrate (routing + carve cube), NOT the ribbon**, so it is **low
throwaway risk** and survives the SDF pivot. It shares the same sub-mesh wall (small craters still
need the spike's fine patch). *Status: candidate idea, not yet validated/built.*

## Throwaway risk of interim ribbon work: HIGH

The SDF pivot is HIGH likelihood (prior-art recommends it, intent.md formalizes it reversing the
earlier "ribbon NOT SDF" call, and the spike is already framed around SDF / `sampleCarve`). The only
open question is the spike's go/no-go, not the direction.

- **Deleted by the pivot:** `buildRibbonGeometry`/`emitRibbon` 2-rail extrusion + lifted Mesh;
  `buildFineRibbonGeometry`; **Fork-B width-cap + Fork-E trunk-pin junction fixes**; Chaikin *as
  applied to the ribbon rails*; ribbon width-as-geometry (rail half-extent); the ribbon
  Mesh/material/renderOrder/LIFT.
- **Carries over (spend freely):** routing (priority-flood, accum, Strahler, isChannel/isOcean — the
  global authority); the carve cube (already SDF-like; the pivot extends it); sea-level coupling
  (uSeaLevel, isMouth/mouthStrength); the width law W∝√accum (an SDF needs it for half-width + alpha
  floor). **The `filled` lake mask above lives entirely on this side.**
- **Why ribbon polish can't fully win anyway:** the sub-pixel ribbon error at close approach is
  *fundamental* — a 1–3 px ribbon can't be rasterized at correct width (shimmers/pops; MSAA samples
  geometry edges, not sub-pixel spans). SDF computes coverage analytically, clamps to a ~0.5–0.75 px
  floor, fades alpha by true/floor width → a sub-pixel river becomes a stable faint line.
- **Safe interim exception:** de-smoothing #1 (CHAIKIN, width-band, jitter) is low-cost and the
  instinct survives the pivot (an SDF river also wants width-along-channel + meandered centerline,
  both driven by the carry-over width law + routing). **Avoid Fork-B/Fork-E junction work and
  rail-extrusion width tuning — that is the throwaway zone.**

## Does current SOTA still back the spike? PARTIALLY YES

- **Confirmed (high conf):** **Dendry** (Gaillard et al., I3D 2019) remains, as of mid-2026, the only
  published locally-computable, random-access, resolution-independent **distance function to a
  branching dendritic** river network — the property giving non-popping view-dependent eval + free
  analytic-AA SDF rendering. SDF analytic-AA (smoothstep over ~fwidth) reconfirmed best practice
  (2024 refs). **Negative result:** no shipped AAA space game (NMS/Elite) does true procedural
  branching rivers — no shortcut to borrow; the academic Dendry path *is* the leading edge.
- **Refinement:** two bands — (1) topology/appearance-LOD = Dendry; (2) optional fine erosion texture
  = **Grenier et al. 2024** phasor-noise oriented along the Dendry distance gradient. Do NOT put
  Schott et al. 2024 / Terrain Diffusion (arXiv 2512.08309) on the live shader path (grid/bake →
  reintroduces seam/popping); offline authoring only.
- **The real, SOTA-flagged risk:** Dendry's own authors (2024) say it is compute-intensive and "does
  not lend itself to GPU implementation" as written (~10 s for 512² CPU bake in 2019). **Per-pixel
  GPU cost at closest approach is the genuine open risk.** Mitigation: prototype Dendry's distance
  eval as a GLSL/compute function and budget per-pixel cost *before* the full build; if too heavy,
  evaluate sparsely / precompute trunk levels and only eval fine tributaries live.

## Confidence / uncertainty

- **High:** the numbers; #2/#3 wall at resolution; ribbon junction/width work is throwaway; SDF
  analytic-AA is the right rendering path; the `filled`-discarded + global-only-lakes code facts.
- **Medium-high:** Dendry as the right *first* mechanism (named by two research docs; UNPROVEN here →
  3-cycle cap).
- **Genuinely uncertain (the spike's gates):** (1) Dendry per-pixel GPU cost at planet scale; (2) SDF
  beats ribbon empirically (held, not proven; fallback is decal/screen-space, NOT polished ribbon);
  (3) tile/patch seamlessness across cube-face quadtree boundaries + the cube-corner wart; (4)
  Derzapf 2011 (closest planet-scale precedent) is **unread** — full PDF access-blocked everywhere.

## Recommended sequence

1. **Now (~1 hr, non-throwaway):** fix #1 only — CHAIKIN 3→1, widen band / lower WIDTH_EXP, add
   centerline jitter. *(Optional bonus, also non-throwaway:* the `filled − h` crater-lake mask on the
   carve cube — directly serves Max's crater example, durable substrate.)*
2. **Do NOT** spend on Fork-B/Fork-E junction fixes, rail-extrusion width tuning, or per-chunk
   regeneration — throwaway.
3. **Then start the spike** in standalone `rivers-viewdependent-lab.html` (production stays
   byte-identical). **First gate = prototype Dendry's distance eval in GLSL + budget per-pixel cost
   at closest approach** (the SOTA-flagged risk) BEFORE the full Dendry+SDF build. Then the 3-cycle
   cap: Dendry+SDF → (fallback) Génevaux/Cordonnier on a densified mesh → Proland-style
   vector+footprint. SDF render has its own cap with a decal/log-depth fallback.
4. Spend any carry-over effort (width law, routing, sea coupling, carve cube, lake mask) freely — it
   survives the pivot and feeds the SDF directly.

**Net:** the walls are real and only the spike moves them, so the spike is the actual fix — but you
get one honest cheap win on #1 (and optionally the crater-lake mask) without burning hours on ribbon
code the pivot is about to delete.
