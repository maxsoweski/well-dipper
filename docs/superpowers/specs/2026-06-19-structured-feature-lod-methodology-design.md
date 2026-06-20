# Structured-Feature LOD — methodology design

**Date:** 2026-06-19 · **Status:** design spec, awaiting Max approval ·
**Surface:** `planet-lod-lab.html` (`window._lab`) · **Campaign:**
[planet-LOD lab](../../FEATURES/planet-lod-campaign-tracker.md), strategic frame
[`planet-lod-CHARTER.md`](../../FEATURES/planet-lod-CHARTER.md).

## Purpose

This is the **methodology** for how *any* structured planet feature gets
camera-localized level-of-detail: the feature regenerates its OWN primitives at
finer scale, in a camera-localized region, rendered through the SAME
representation the global feature already uses, where that regeneration READS the
other features' fields so the fine detail stays consistent with the global
coupling. **Rivers are validating instance #1** — the only feature actually built
in this pass. The scope is deliberately split: **write the methodology doc fully**
(the principle, the orchestrator-owned shared subsystems, and a *sketched*
per-feature interface) **but build rivers only**. We do NOT design a generic
plugin framework as code — rivers validate the doc; feature #2 hardens the
interface. The companion rivers-only build spec is
[`2026-06-19-river-lod-design.md`](2026-06-19-river-lod-design.md); this doc is
the layer above it (the general method), with the rivers build plan in §7 as a
pointer into that build.

---

## Section 1 — The methodology core (APPROVED)

**THE PRINCIPLE (approved, do not relitigate):** *"A structured feature's LOD =
camera-localized regeneration of that feature's OWN primitives at finer scale,
rendered through the SAME representation the global feature already uses, where the
regeneration READS the other features' fields so the fine detail stays consistent
with the global coupling."*

**NORTH STAR (standing):** FEATURES WORK TOGETHER (co-dependence). Rivers respect
MOUNTAIN topology; rivers FEED the ocean (terminate at the coast, never float on
top of water); downstream features stay keyed to the real drainage.

**Each feature provides 3 things:**

- **(a) PRIMITIVES** — the feature's own structural units (rivers → the routed
  graph: nodes, receiver chains, stream order).
- **(b) a LOCAL-REGENERATION fn** — given (cap region, the global primitives,
  field-readers) it emits **finer primitives that CONVERGE BY CONSTRUCTION onto
  the global primitives** (rivers: grow tributaries onto existing trunks; NEVER
  re-route the trunks).
- **(c) a RENDER REPRESENTATION** — the finer primitives render through the
  feature's **own global renderer** (rivers → ribbon + carve).

**The ORCHESTRATOR owns the shared design-once subsystems:** cap selection,
resolution/perf model, co-dependence field-reads, blend/seam + re-bake policy.

**SCOPE DECISION (approved):** write the methodology DOC fully (principle + shared
subsystems + a SKETCHED per-feature interface) but BUILD rivers only. Do NOT
design a generic plugin framework as code. Rivers validate the doc; feature #2
hardens the interface.

**Sketched per-feature interface (NOT to be built as code in this pass):**

```
StructuredFeatureLOD (sketch — implemented per-feature, not as a base class yet):
  primitives()                      -> the feature's global structural units (1a)
  regenerate(cap, globalPrimitives, readers) -> finer primitives, converging by
                                       construction onto globalPrimitives (1b)
  renderFine(finerPrimitives, parent) -> draws via the feature's OWN global
                                       renderer(s), patch-local (1c)

Orchestrator (the shared, design-once subsystems — Sections 3-5):
  selectCap(camera)        -> {center, angularRadius, gridRes, regionKey}   (§3)
  readers                  -> { height (mountains, coeff 1.0), seaLevel,
                               isOcean/coast }                              (§4)
  blendAndRebake(...)      -> union operator + apron + re-bake trigger       (§5)
```

Everything below (Sections 2-6) must remain consistent with this core. Where a
section recommends a concrete fix, that fix is a rivers-instance decision; the
general rule that precedes it is the methodology contract feature #2 inherits.

---

## Section 2 — Render Representation (rivers: ribbon + carve)

### Part 1 — General methodology rule (feature-agnostic)

> **A feature's fine-LOD detail renders through the *same* representation(s) the
> feature's global tier already uses — no new visual channel is invented for the
> fine tier.** The local-regeneration function (1b) emits the *same primitive
> species* the global feature emits; the render step rasterizes those primitives
> through the feature's *own* global renderer(s), only re-parameterized to
> patch/planar space.

Four obligations every feature instance must satisfy:

1. **Representation parity, not representation invention.** If the global feature
   has *N* render channels, the fine tier reuses those same *N* channels (or a
   justified subset). It MUST NOT introduce a channel the global tier lacks,
   because a channel the global tier lacks cannot be co-dependent with the global
   field (it has nothing to converge onto). Where a feature carries *two* render
   jobs that are genuinely distinct — one for **legibility** (a marker the eye can
   lock onto) and one for **co-dependence** (a field that physically interacts
   with the other features' relief) — the fine tier reuses **both**. Collapsing
   the two into one to "save a pass" is forbidden: legibility without
   co-dependence floats; co-dependence without legibility is invisible (the two
   are the exact UAT failure modes 1 and 3).
2. **Finer-must-read-as-finer.** The fine tier's render parameters (color, width,
   depth, density) MUST be derived from the *same laws* as the global tier but
   evaluated at the fine primitives' own magnitude — so fine detail reads as
   unambiguously smaller/subordinate to the global primitives it hangs off. The
   render must not let a fine primitive out-shout the global primitive it feeds.
3. **Magnitude-graded physical coupling.** The fine tier's *co-dependence* channel
   must scale its physical effect with the primitive's own magnitude (its
   order/rank/strength), so that small fine primitives produce a *weak* field
   effect and only the larger fine primitives near the global junction produce a
   *strong* one. This keeps the fine tier consistent with real coupling (Section 1
   co-dependence) instead of uniformly stamping the patch.
4. **Seam-free convergence at the junction.** Because the fine primitives are grown
   to converge *by construction* onto the global primitives (1b), the *render* of
   the fine tier must also converge onto the *render* of the global tier at the
   shared junction — same position, same width/depth, same color at the meeting
   vertex — so there is no T-junction gap, no doubled line, no depth
   discontinuity where fine meets global.

**Scene attachment (general):** the fine render lives in its own cap-local
mesh/target, attached to the **same parent transform** the global render uses (so
it co-moves identically under any world rotation/spin), with the **same
blend/depth policy** as the global render (e.g. `depthWrite:false`, a fixed
`renderOrder`), and is created **once** and **re-baked on cap move** by the
orchestrator (§5). The fine mesh draws *over* the same region the global mesh
already covers; it does not replace the global mesh, it overlays finer primitives
inside the cap.

### Part 2 — Rivers instance (concrete, with file:line refs)

Rivers carry **two** render jobs, and per obligation (1) the fine tributary tier
reuses **both**:

- **Ribbon** = the visible water-line (legibility). Global: `buildRibbonGeometry`
  — `planet-lod-rivers.js:473`. A 2-rail strip walked down `receiver` chains over
  `rendered` channel nodes (`:479`), Chaikin-smoothed (`:491`), lifted to radius
  `LIFT` (`:499`, default `0.999`), width
  `clamp(WIDTH_SCALE·WIDTH_PHI·accum^WIDTH_EXP, MIN, MAX)` (`:480–482`), vertex
  color from the stream-order ramp `cOrd` `0x1d3c5e→0x4486bb` (`:484–489`). One
  persistent `Mesh(MeshBasicMaterial{vertexColors, DoubleSide, depthWrite:false})`,
  `planet.add(...)` at `planet-lod-lab.html:1401`, `renderOrder=10`.
- **Carve** = the valley that co-depends with real relief and can flood
  (co-dependence). Global: `buildValleyGeometry` → `createCarveCubeMap` cube
  (`planet-lod-rivers.js:589, :710`), sampled by `sampleCarve`
  (`planet-lod-lab.html:236`) and applied as `h -= carveDepth·uRiverCarveDepth`
  (floor drop → F14 flood) + `grad += -carveGrad·…` (wall bend) at `:424–425`.

The current fine tier (`planet-lod-tributary-patch.js`) ships **carve only** —
`buildFineValleyGeometry` (`:49`) emits a planar depth strip into a 2D ortho RTT,
unioned into `sampleCarve` via `patchDepth()` (`planet-lod-lab.html:223`, union at
`:245–249`). **This is exactly UAT failure 1 (CONTRAST):** the fine carve is
shallow, the dry valley never dips below sea, so the tributaries don't flood/darken
and read as ~invisible. The fix honors obligation (1): **add a fine RIBBON
alongside the fine carve.**

#### Fork A — Add a fine ribbon (decision: YES, build it)

Build `buildFineRibbonGeometry` in `planet-lod-tributary-patch.js`, mirroring the
`buildRibbonGeometry` pattern (`planet-lod-rivers.js:519` `emitRibbon`, `:540`
`pathFrom`, `:491` `chaikin`) but operating in the **planar (su,sv) frame** that
`buildFineValleyGeometry` already uses (`:77–98`), then lift each planar vertex to
the sphere via the patch's `localFrame` (`planet-lod-tributaries.js:48`) — i.e.
`dir = normalize(n + su·u + sv·v)`, scaled to `LIFT`. (This is the exact inverse of
`buildFineGrid`'s forward placement and is byte-aligned with the shader's
`patchDepth()` inverse via `projectToPatch` — `planet-lod-tributary-patch.js:29`,
so the ribbon will sit on the same surface the carve patch samples.) It walks
`freceiver` chains for `isFineChannel` nodes (the same gate `buildFineValleyGeometry`
uses at `:78`), Chaikin-smooths in planar space, and emits the 2-rail strip. This
reuses the rivers' *own* legibility renderer (parity), guaranteeing the fine
network is visible regardless of whether its carve floods.

#### Fork B — Fine ribbon color & width vs trunks (decision: same laws, fine magnitude, with a cap)

Color the fine ribbon from the **same `cOrd` ramp** (`planet-lod-rivers.js:484–489`)
so headwaters read as the dark-navy `0x1d3c5e` end of the existing gradient — fine
tributaries are low Strahler order, so the shared ramp *automatically* places them
at the dark/thin end and the trunk at the lit-blue/thick end. Do **not** invent a
separate fine palette. For width, reuse `widthAt`'s law (`:480–482`) but evaluated
on the **fine `faccum`**, and **clamp the fine `WIDTH_MAX` to the trunk's width at
the outlet node** so a fine rail can never render wider than the trunk it joins.
This satisfies obligation (2): the trunk is always thicker and lighter than its
tributaries by construction of the shared laws, so "finer reads as finer" without a
magic constant.

#### Fork C — Scene attachment of the fine ribbon (decision: second Mesh in the cap, parented to planet)

Add a **second persistent `Mesh`** (the fine-ribbon mesh) next to the trunk
ribbon, `planet.add(fineRibbon)` adjacent to `planet-lod-lab.html:1401`, same
`MeshBasicMaterial{vertexColors, DoubleSide, depthWrite:false}`, **`renderOrder=11`**
(one above the trunk ribbon's `10`) so where fine and trunk overlap at the junction
the fine rail draws last and there is no z-fight flicker. Its geometry is swapped on
each tributary bake (the existing `tributaryPatch.bake`, driven by
`bakeTributaryPatch` at `planet-lod-lab.html:3530`), exactly as `route()` swaps the
trunk ribbon geometry (`planet-lod-rivers.js:828`). Visibility mirrors
`state.riversEnabled` (the shared `enableKey`) and
`riverOverlayState.patchStrength>0`, gated through GUI `onChange` like the other
patch toggles (`riverOverlayState` at `planet-lod-lab.html:1409`).
**(Open taste fork — see §8: renderOrder priority at the junction.)**

#### Fork D — Carve depth/flood scaling with Strahler order (decision: order-graded flood threshold)

Keep the fine carve's existing **order-graded depth** law — `depthAt(o)` already
lerps `VALLEY_DEPTH_LO→VALLEY_DEPTH_HI` by normalized fine Strahler
(`planet-lod-tributary-patch.js:59`, mirroring the global `depthAt` at
`planet-lod-rivers.js:601`) — but make the depth **range itself reach below sea
only for the larger fine orders.** Concretely: scale fine carve depth so that small
tributaries (`fstrahler` near `channelOrderMin`) produce a **thin ribbon + shallow
DRY valley** (carve floor stays above `uSeaLevel`, so no flood — just an
albedo-darkened groove via the existing dry-floor darkening at
`planet-lod-lab.html:582`, the Stage-6 `albedoCol` mix gated by `(1.0 -
liquidMask)`), while the **larger fine orders near the trunk outlet** carve deep
enough that `h - carveDepth·uRiverCarveDepth` (applied at `:424`, BEFORE the F14
cut) crosses `uSeaLevel` and floods through the *same* F14 level-set mechanism
(`:434–437`). This is real hydrology (only sizeable channels hold standing water)
and it fixes UAT failure 1 (CONTRAST) **without making everything flood** — which
was the failure of a flat strength bump. The flood, when it happens, is keyed to the
real drainage because the carve is unioned into `sampleCarve` (`:245`) and the
mouth/coast machinery (`.g` channel at `:394, :466`) already lights flooded carved
valleys at the coast for free (North Star: tributaries *feed the sea*).
**(Open taste fork — see §8: dry→flood Strahler cutoff is a live-GPU tuning call.)**

#### Fork E — Visual convergence at the trunk junction (decision: pin fine outlet vertex to the trunk rail)

The fine network's outlets are already pinned to the trunk *graph* node
(`growTributaries` sets `outletBaseNode` and pins outlet height to trunk `surf` —
`planet-lod-tributaries.js:386–404`). Extend that to the **render**: at the outlet
vertex, the fine ribbon must emit its **last cross-section at the exact trunk ribbon
centerline position and with the trunk's width and the trunk's `cOrd` color at that
node**, not the fine node's own width/color. Read the trunk's per-node width via
`widthAt` on the global `routed.accum` at `outletBaseNode`, and the trunk's color
via `cOrd(strahler[outletBaseNode])`. (This requires threading the global
`routed{accum,strahler}` into the fine-ribbon build alongside `outletBaseNode`,
since `buildFineValleyGeometry`/`buildFineRibbonGeometry` currently only receive the
fine `out` graph.) This makes the fine rail *taper into* the trunk rail (matched
position + width + color at the shared vertex), eliminating the T-junction gap and
the doubled-line / color-jump artifacts. The carve converges the same way
automatically because `buildFineValleyGeometry`'s depth already terminates at the
outlet (`:78` gate + outlet pinning) and `sampleCarve` MAX-unions fine and global
depth (`:245–249`) so the deeper trunk valley dominates at the join — no depth seam.

#### Net effect on the three UAT failures

- **CONTRAST (1):** fixed by Fork A (guaranteed-visible fine ribbon) + Fork D
  (larger fine orders flood, small ones stay dry grooves via the Stage-6 dry-floor
  darkening at `:582`).
- **RESOLUTION (2):** unaffected by this section (it's a grid-density / O(Nf²) snap
  problem owned by §3's resolution/perf model + the tributary generator), but the
  fine ribbon makes whatever resolution *is* achieved actually legible.
- **CO-DEPENDENCE (3):** preserved — the fine carve stays unioned into the shared
  `sampleCarve`/cube so tributaries sit in real valleys (relief-gated at `:421`),
  feed the sea via F14 + the mouth channel, and never float on ocean (the
  dry-vs-flood split in Fork D is exactly the sea-level co-dependence).

---

## Section 3 — Resolution / Perf Model (the design-once hard problem)

### 3.1 General methodology rule (feature-agnostic)

The orchestrator owns ONE shared resolution law that every structured feature's
local-regeneration fn obeys. A feature never decides its own cap size or lattice
density; it declares a **target real-world feature size** (the smallest primitive
it wants legible at full zoom), and the orchestrator converts that, plus the live
camera, into the three quantities the regeneration fn consumes: **cap angular
radius**, **lattice density (gridRes)**, and a **per-feature seed/region key**. This
keeps caps, perf budget, and seam policy uniform across features and prevents each
feature from inventing its own LOD heuristics. (This is a methodology *contract* the
orchestrator enforces — a shared law, not a generic plugin framework to be built as
code.)

The law has three layers:

**(a) Cap angular radius α as a function of camera distance — SCALES WITH ZOOM.**
The cap is the geodesic region that gets regenerated. It must cover roughly the
visible near-hemisphere patch and no more: too large wastes verts on cells smaller
than a pixel near the limb; too small pops at the cap boundary. The rule: cap the
angular radius to the on-screen horizon half-angle at the current camera altitude,
clamped to a max so a grazing camera doesn't request a whole hemisphere. As the
camera descends, α shrinks; the same vert budget then lands on a smaller patch, so
spacing gets finer automatically. **Recommendation:** `α = clamp(k · (vFOV/2) ·
screenCoverageFraction, α_min, α_max)`, driven off camera distance, where
`screenCoverageFraction ≈ 1.0` means "regenerate exactly what fills the viewport."
Do NOT also scale gridRes with zoom (see (c)); let α carry the zoom response and
keep density fixed per cap.

**(b) Target screen-space feature size sets the lattice density — FIXED across
zoom.** A feature's finest primitive must be resolvable, i.e. span at least a few
screen pixels at full zoom. Given a target world feature size `s_feat` and the
on-screen ground resolution at full zoom `g_px` (km per screen pixel), the lattice
must place ≥ ~2 cells across one feature (Nyquist). This fixes the **angular cell
size** `cell_angle ≈ s_feat / R_planet`, and therefore `gridRes = ceil(2·α /
cell_angle)`. Because α is what changes with zoom and `cell_angle` is held to the
feature's physical size, gridRes is **fixed per feature** (it only moves if the
feature's declared `s_feat` changes). This is the inversion of the current lab,
where gridRes is a hand-set constant and the implied feature size silently drifts
with α.

**(c) Cost: bake is one-shot per cap, NOT per-frame.** Regeneration runs only when
the cap key changes (camera crosses a re-bake threshold), so the budget is a latency
budget per bake, not a frame budget. The dominant scaling term is the lattice vertex
count `Nf ≈ π·gridRes²/4` (a disc of `gridRes`-diameter lattice; this disc-area form
UNDER-counts the hex lattice by ~15% because hex packing is denser by `2/√3` per
unit area, so treat all Nf figures below as right-order estimates, not exact). Every
O(Nf²) inner loop in the regeneration fn is a hard blocker on reaching real density
and MUST be reduced to O(Nf) or O(1)-per-query before raising gridRes. **The
orchestrator's perf contract: state the worst-case Nf at target gridRes, guarantee
every per-vertex helper is O(1), and require a closed-form spatial index when the
lattice is regular** (which it is, by construction — the regen fn builds a
deterministic lattice, so position→cell is analytically invertible and no search
structure is needed; the only wrinkle is radius-clipped cells, which the inverse
must handle — see 3.2).

What scales with zoom vs. fixed, restated as the contract every feature inherits:
- **Scales with zoom:** cap angular radius α; absolute on-sphere cell spacing (km);
  the geodesic extent of the patch RTT frustum.
- **Fixed (per feature, independent of zoom):** gridRes; angular cell size relative
  to the cap; target screen-space feature size; worst-case Nf.

### 3.2 RIVERS-instance application (concrete, with file:line refs)

**Numbers to hit.** Base mesh spacing ≈ 113 km. Current lab bakes at `gridRes: 56`
over an `8°` half-angle cap (`planet-lod-lab.html:3544` `params:{gridRes:56}`;
`:3537` `angularRadius = degToRad(riverOverlayState.patchAngularDeg)`, `:1412`
`patchAngularDeg:8`). At 8° an Earth-sized planet's cap diameter is ~1780 km, so 56
rows ≈ **~32–40 km/cell** — only ~3× finer than the 113 km base, which is why "fine"
tributaries don't read (UAT failure #2). Tributary valleys want `s_feat ≈ 5–10 km`.
With Nyquist (~2 cells per valley) the cell target is ~3–5 km.

**R_planet is SEED-DERIVED (realistic, not fixed Earth).** The physical radius
already exists in the lab as `state.planetRadiusEarth` (`planet-lod-lab.html:2129`),
drawn per-seed from the game's `RADIUS_RANGES_EARTH` (`src/core/ScaleConstants.js:67-86`,
~0.3–16 Earth radii — moons through giants) via `drawPresetRadius(preset, radiusSeed)`
(`:1868-1877`). So `R_planet_km = state.planetRadiusEarth · 6371`. The LOD math READS
this; it does NOT assume Earth-scale and does NOT touch the unit-sphere geometry
(`R = 1.0`, `:173`). No generation-side change — radius is already seeded.

**Required gridRes (rivers).** With `cap_diameter_km = 2 · sin(α) · R_planet_km` and a
per-feature cell target `s_feat`: `gridRes = ceil(cap_diameter_km / s_feat_km)`. For an
**Earth-scale** seed (`planetRadiusEarth = 1.0` → R_planet_km ≈ 6371) at the 8° cap,
cap_diameter ≈ 1780 km, so with `s_feat ≈ 4 km`: `gridRes ≈ 445`. That lands inside the
brief's **300–560** window. **Recommendation: target gridRes ≈ 448 at the 8° cap for an
Earth-scale seed** (round to keep the lattice symmetric), and let α shrink the cap on
descent rather than pushing gridRes past ~560. **Because `R_planet_km` is seed-derived,
gridRes scales automatically per planet** — a 0.5-RE moon yields a smaller cap_diameter
and thus a smaller gridRes for the same km/cell; a giant yields more. gridRes is therefore
fixed *per feature per planet size*, recomputed only when the seed (radius) or `s_feat`
changes — never per frame, never with zoom. At a tighter 4° approach cap, the SAME gridRes
gives ~2 km/cell for free — that is the zoom response (α carries it; gridRes stays fixed
per 3.1c).

**Worst-case vert count.** `Nf ≈ π·gridRes²/4` (disc-area estimate; the hex lattice
runs ~15% higher). At gridRes 448 → **Nf ≈ 158k fine verts** (vs. ~2,460 at gridRes
56 today — a ~64× jump). This is the number every per-vertex cost is multiplied by,
and the reason the current O(Nf²) paths are fatal at target density: 158k² ≈
2.5×10¹⁰ dot products per snap pass.

**The O(Nf²) killers and the O(1) fix.** Two linear scans dominate and both are
killable for nearly free because `buildFineGrid` is a **regular hex lattice** whose
forward map is `fvert(k) = normalize(n + su·u + sv·v)` with `planar[k] = [su, sv]`
(`planet-lod-tributaries.js:147`, `:145`; lattice `cell`/`rowH` at `:128–129`):

1. `snapNearest(dir)` — `planet-lod-tributaries.js:339–343`, a linear scan over all
   Nf, called once per in-patch trunk node AND once per densified geodesic slerp
   step (`:362`, `:381`) ⇒ effectively O(Nf²).
2. `sampleHeight(p)` in the GPU patch — `planet-lod-tributary-patch.js:181–189`,
   nearest-fine-vert linear scan, called once per fine vert during height assembly
   ⇒ O(Nf²).

**Fix (recommendation): replace both scans with the closed-form lattice inverse.**
Project `dir`/`p` into the local frame to recover planar coords `(su, sv) =
(dot(p,u)/dot(p,n), dot(p,v)/dot(p,n))` (the gnomonic inverse already implemented
for the shader at `planet-lod-tributary-patch.js:29` `projectToPatch`), then invert
the lattice indexing from `buildFineGrid`: `row = round(sv / rowH)`, apply the
odd-row half-cell offset (`:137`), `col = round((su − offset)/cell)`, and look up the
existing `(r,c)→index` map (`indexAt`, `:143`) — snapping to the nearest of the
recovered cell's center vs. its hex neighbors. **Critical detail:** the radius clip
(`:141`, `su²+sv²>R²`) means some `(r,c)` keys are ABSENT from `indexAt`, so a
recovered key can miss; on a miss, fall back to the nearest PRESENT hex-neighbor (a
tiny fixed-radius ring search, still O(1) per query). A unit test must assert
`inverse(forward(k)) == k` for every k before trusting it at high gridRes (boundary
cells are where the inverse will diverge from the linear-scan ground truth). This
makes each snap/sample **O(1)**, collapsing both passes from O(Nf²) to O(Nf) and
making gridRes 448 a one-shot bake of ~158k O(1) operations instead of ~2.5×10¹⁰. No
new data structure is needed; the `indexAt` map and `cell`/`rowH`/`offset` constants
already exist in `buildFineGrid`.

**Perf budget (rivers).** Bake is on-demand, static-camera, GUI/`window._lab.bakeTributaryPatch()`
triggered (host fn `planet-lod-lab.html:3530`, GUI button `:3865`, `window._lab`
wrapper `:5600`) — NOT per-frame. The cost is a single bake latency: lattice build
O(Nf) + GPU height read (one `createHeightSampler` RTT over Nf points,
`planet-lod-tributary-patch.js:173` — note the sampler internally packs the verts
into a `sqrt(Nf)`-side point cloud) + routing (priority-flood/steepest-receiver/Strahler,
all O(Nf·degree) over the 6-neighbor hex graph) + one ortho RTT render of the valley
strip. With the O(1) snap, every stage is linear in Nf, so ~158k verts is a
sub-second one-shot (estimate — see open risk on measuring memory/timing on the
actual 16GB 5080). The integration trigger (when the orchestrator re-bakes) is
§4/§5 policy; here the contract is only: **re-bake on cap-key change, never per
frame.**

**What scales vs. fixed (rivers).**
- Scales with zoom: `patchAngularDeg`/`angularRadius` (`:3537`), the ortho frustum
  `±tan(angularRadius)` (`planet-lod-tributary-patch.js:200`, with `R =
  Math.tan(angularRadius)` on `:199`), absolute km/cell.
- Fixed: gridRes ≈ 448, angular cell fraction of the cap, the 5–10 km tributary
  feature target, Nf ≈ 158k (estimate). (Today `gridRes:56` is hard-coded at
  `planet-lod-lab.html:3544`; the recommendation is to derive it once from `s_feat`
  + cap, then hold it.)

---

## Section 4 — Co-dependence field-reads (the north star, made mechanical)

### 4.1 General methodology rule (feature-agnostic)

**Rule.** A feature's local-regeneration function never invents its own private
world. It receives a fixed bundle of **field-readers** from the orchestrator and
reads them **at full strength** — the same fields, sampled the same way, that the
*global* generator already used. Local detail is only allowed to *converge onto and
respect* the global coupling; it is never allowed to *re-derive a parallel one at
half weight*.

Three reader categories form the minimum co-dependence contract. The orchestrator
owns and hands out exactly these; every feature instance consumes the subset it
needs:

1. **`height(p)` — real elevation WITH all upstream features baked in (mountains
   included).** The reader must return the *same* field the global pass routes on
   (here: the GPU height sampler at the same or higher octave count), not a coarse
   re-interpolation. The fine network must *route on this field directly*. A coarser
   macro term may appear ONLY as a degenerate tie-breaker on dead-flat ground (to
   keep deterministic flow direction where the real field has zero gradient), never
   as a fixed-fraction blend that dilutes the coupling.
2. **`seaLevel` + `isOcean(p)` / coast — the shared global boundary.** Features that
   *terminate* at a global boundary (rivers → coast) must read that boundary as a
   *sink/outlet condition in the regeneration itself*, not paint over it afterward.
   The boundary is the level-set `height == seaLevel`; ocean is `height < seaLevel`
   (`computeOcean`). Outlets = global feature primitives **∪** boundary cells, so
   fine primitives drain to whichever is reached first.
3. **`isOcean(p)` again, as a BAKE MASK.** The render-representation bake must *skip*
   any fine primitive whose base cell is on the far side of the global boundary
   (over water). Reading the boundary as a sink (rule 2) decides *where flow stops*;
   masking the bake (rule 3) guarantees we *never deposit the feature's
   representation over the masked region* (no carving over ocean → no floating
   rivers / sunglint blobs).

**The mechanical test for "full strength":** grep the regeneration for any literal
blend constant (`0.5 *`, `0.7 *`, etc.) sitting between a global field and a local
field. Each one is a co-dependence leak unless it is *provably* a flats-only
tie-breaker. The default coefficient on a co-dependence field-read is **1.0**.

**Why this is the north star made mechanical:** "features work together" stops being
an aspiration and becomes a typed interface. If a feature can only see the world
through orchestrator-supplied readers at coefficient 1.0, plus a boundary-as-sink
rule, plus a bake mask, then *consistency with global coupling is structural*, not
something a tuning pass can later break.

### 4.2 RIVERS instance — the three concrete fixes

All three bugs are the *same* root failure: the tributary regeneration sees the
world through diluted or missing readers. Files: `planet-lod-tributaries.js` (pure
CPU regeneration), `planet-lod-tributary-patch.js` (GPU bake), `planet-lod-rivers.js`
(shared field functions).

#### Fix 1 — MOUNTAIN: route on real GPU height at full weight

**The leak.** `growTributaries` builds its fine height field at
`planet-lod-tributaries.js:386-398`. The macro term is correct (GPU height arrives
as `sampleHeight`), but it is halved:

```js
// planet-lod-tributaries.js:392-395
if (typeof sampleHeight === 'function') {
  macro = 0.5 * macro + 0.5 * sampleHeight(p);   // ← 50/50 mountain-dilution
}
```

`macro` here is `baseH[k]` — the coarse base-graph surf interpolated by
`buildMacroInterp` (`:387`), i.e. `routed.surf` of the nearest in-patch base node
(the base mesh's 9-octave-derived routed surface). `sampleHeight` is the **real**
fine field: the patch bake reads it from `createHeightSampler` at `octaves=12`
(`planet-lod-tributary-patch.js:173-189`), which is *finer* than the 9-octave base
router (`planet-lod-rivers.js:218` default, wired `planet-lod-lab.html:1399`/`:1406`).
Blending them 50/50 throws away half of the real sub-base-mesh relief — exactly the
relief the fine network is supposed to follow. Mountains the base mesh is too coarse
to see get halved out, so tributaries ignore the topography that should steer them.

**RECOMMENDATION (single fork, no options).** Set the fine height field to the real
GPU height at coefficient 1.0, and demote the coarse `baseH` macro to a
**flats-only tie-breaker** with a tiny epsilon weight:

- Where `sampleHeight` is supplied: `macro = sampleHeight(p)` (coefficient 1.0).
  Keep `baseH[k]` only as `macro += FLATS_EPS * baseH[k]` with `FLATS_EPS` on the
  order of the routing flat-resolve increment (≈1e-3 relative), purely to give
  priority-flood a deterministic downhill direction on dead-flat GPU terrain.
  Document it inline as a tie-breaker, not a blend. **(Open taste fork — see §8:
  FLATS_EPS magnitude is an empirical call.)**
- Where `sampleHeight` is absent (pure-CPU callers with no GPU sampler): fall back
  to `macro = baseH[k]` unchanged — that path has no richer field to honor.

This makes the fine network route on the same elevation the global generator would,
so tributaries bend around mountains instead of around a half-smeared ghost of them.
The outlet-pinning at `:402-404` is untouched (outlets still pin to trunk surf —
that is correct co-dependence with the river-trunk primitive, not a height blend).

#### Fix 2 — SEA/COAST: fine outlets must include OCEAN cells (terminate at the coast)

**The gap.** Outlets are claimed ONLY from in-patch trunk channel nodes —
`growTributaries` loops `trunkChannel` nodes and densifies the trunk sink-line
(`planet-lod-tributaries.js:358-384`). Nothing ever marks a fine vert as an outlet
because it is *below sea level*. The routing then treats the boundary as invisible:
`priorityFloodFromOutlets` (`:177`, seed loop `:200`) only seeds the heap from
`isOutlet` verts, so fine flow that reaches the coast just keeps going / ponds
instead of draining into the sea. Tributaries don't feed the ocean — they stop at
the trunk or float.

**RECOMMENDATION (single fork).** Add a **sea-outlet pass** in `growTributaries`,
immediately after the trunk-outlet loop (i.e. after `:384`, before the height field
is built at `:386`). `seaLevel` is orchestrator-owned: the bake already closes over
`uniforms` (`planet-lod-tributary-patch.js:115` ctor, `:164` bake), so it reads
`uniforms.uSeaLevel.value` (default -1.0, `planet-lod-uniforms.js:282`) directly and
forwards it into `params` for `growTributaries`. The pass:

1. For each fine vert `k`, evaluate the real height: reuse the already-read GPU
   `height` array — `bake()` reads it at `planet-lod-tributary-patch.js:174` on the
   *same* lattice `growTributaries` rebuilds (`buildFineGrid` is a pure function of
   `region + gridRes`, `planet-lod-tributaries.js:123-170`, so index `k` corresponds
   directly; the doc-comment at `:178-180` already asserts this exact-index
   correspondence). Pass that `height` array (or a closure `seaAt(k)`) into
   `growTributaries` alongside `sampleHeight`. Guard for the pure-CPU path: no-op
   the sea pass when `height`/`seaLevel` are absent (same `typeof` guard style as
   the existing `sampleHeight` check at `:392`).
2. If `height[k] < seaLevel` (the `computeOcean` predicate,
   `planet-lod-rivers.js:274-277`), call `claimOutlet(k, -1, seaLevel)` — mark it an
   outlet pinned to `seaLevel`, with `outletBaseNode = -1` to distinguish "sea
   outlet" from "trunk outlet". **Edge case to handle in `claimOutlet`:** its
   collision branch reads `trunkStrahler[bn]` (`:350-352`); with `bn = -1` that
   index is `undefined`, so the strahler comparison degenerates (sea outlets can
   neither override nor be overridden by trunk outlets on collision). Add a small
   `bn === -1` special-case so the priority is explicit rather than driven by an
   `undefined` comparison — e.g. treat an existing trunk outlet as winning a
   collision (keep the trunk node), since both still act as sinks regardless.
   Pinning the outlet surf to `seaLevel` (not the cell's own sub-sea height) makes
   the shoreline the true terminal level-set `height == seaLevel`, matching the
   shader coast definition (`lab:435` liquidMask, `lab:452` coast SDF). **(Open
   taste fork — see §8: pin-to-seaLevel vs. estuary notch.)**

Because `priorityFloodFromOutlets` already floods from *all* `isOutlet` verts
indiscriminately (`:200`), sea cells now act as sinks exactly like trunk cells. Fine
flow drains to whichever outlet (trunk OR coast) it reaches first — tributaries that
reach the coast terminate at sea level and feed the ocean, satisfying the north
star's "rivers FEED the ocean."

#### Fix 3 — OCEAN-MASKING: skip baking fine primitives over water

**The leak.** The patch bake rasterizes every fine channel segment with no ocean
awareness. `buildFineValleyGeometry` emits a quad strip for each `isFineChannel`
vert with a downstream receiver (`planet-lod-tributary-patch.js:77-98`), and `bake()`
renders the whole geometry into the patch RTT (`:208`). A fine channel that runs
across a sub-sea cell still gets a valley quad → the carve patch deepens terrain
*under* the sea → the shader unions it in (`patchDepth` / `sampleCarve`,
lab:245-249) → rivers render on top of water (the sunglint blobs).

**RECOMMENDATION (single fork).** Mask at geometry build, not after. In
`buildFineValleyGeometry`, skip any segment whose endpoint cell is ocean.
Concretely:

- Thread the per-fine-vert ocean flag through `out`. The cleanest source is Fix 2's
  evaluation: when the sea-outlet pass runs, also store `isOceanFine[k] = height[k]
  < seaLevel` on the `growTributaries` return object (next to `isOutlet`,
  `:416-423`).
- In the segment loop (`planet-lod-tributary-patch.js:77`), add: `if
  (isOceanFine[k] || isOceanFine[r]) continue;` — alongside the existing
  `isFineChannel[k] !== 1` guard (`:78`) and the sink/self guard `r === k || r < 0`
  (`:80`). A segment that touches an ocean cell emits no valley quad, so the bake
  deposits nothing over water.

Net effect: a tributary approaches the coast, its last *land* segment is the one
terminating at the sea outlet (Fix 2), and no quad is ever rasterized seaward of the
shoreline. No carve over ocean → no floating rivers.

### 4.3 Where the orchestrator plugs in (the reader bundle for rivers)

The bake (`planet-lod-tributary-patch.js:164` `bake({routed, baseMesh, center,
angularRadius, seed, params})`) is the orchestrator seam for the river instance. It
already constructs two of the three readers (and closes over `uniforms` for the
third's source); it must construct and forward the third:

| Reader | Source today | Change |
|---|---|---|
| `height(p)` (mountains) | `createHeightSampler(octaves=12)` → `height` array, `patch.js:173-174` | Already correct at the source. Stop diluting it downstream (Fix 1). Forward the `height` array into `growTributaries` for the sea test (Fix 2) and the bake mask (Fix 3). |
| `seaLevel` | `uniforms.uSeaLevel.value` (`planet-lod-uniforms.js:282`), already in the bake closure | Read it in `bake()` and forward into `params` so `growTributaries` can apply the `computeOcean` predicate (`rivers.js:274`). |
| `isOcean` / coast | Derived per-fine-vert as `height[k] < seaLevel` | Compute once in `growTributaries`, expose as `isOceanFine` on the return object (`:416-423`); consumed as sink (Fix 2) and bake mask (Fix 3). |

This is the general pattern instantiated: one bundle — `{ height (with mountains,
coeff 1.0), seaLevel, isOcean/coast }` — supplied by the orchestrator, read at full
strength, with the boundary acting as both a routing sink and a bake mask. Feature
#2 inherits the exact same three-reader bundle; only its primitives, regeneration
body, and render representation change. **(Open taste fork — see §8: fine-vs-global
ocean-boundary disagreement at the coast is an orchestrator seam-policy decision.)**

---

## Section 5 — Blend / Seam + Re-Bake Policy

> Owner: **the ORCHESTRATOR** (shared design-once subsystem, per Section 1). A
> feature's local-regeneration fn produces finer primitives that *converge by
> construction* onto the global ones; this section governs how the resulting finer
> **render representation** is merged back into the global render, and when it is
> regenerated. The feature does not own blend or re-bake — it only guarantees that
> its primitives are continuous with the global graph so that a boundary blend is
> *possible*.

### Part 1 — General methodology rule (feature-agnostic)

A camera-localized LOD cap is a finite patch of finer detail laid over an infinite
(whole-planet) global field. Two discontinuities are inevitable and must be designed
away once, for all features:

**(A) The spatial seam — at the cap *boundary*.** The fine patch ends; the global
field continues. If the fine contribution drops to zero abruptly at the cap edge,
the boundary is a visible cliff (a ring of popping detail). The design-once
contract:

1. **Combine, don't replace.** The fine patch is *unioned* into the global field
   through the same combining operator the global feature already uses for
   self-consistency — never composited on top, never `mix()`-ed by a patch-presence
   flag. For a *carve/displacement* field the operator is `max()`
   (deepest-valley-wins, identical to the global cube's `MaxEquation` blend); for an
   *additive* field it would be `+`; for a *masked overlay* it would be the
   feature's own coverage rule. Using the global operator guarantees that **where
   the fine patch contributes nothing, the result is bit-identical to the
   global-only render** — so the patch can be present everywhere with no cost
   outside its footprint.
2. **Apron fade in patch space.** The fine contribution is multiplied by a radial
   falloff that reaches 0 *before* the patch sampling domain runs out, so the union
   operand is already neutral (the operator's identity element) at the geometric
   edge. This makes the seam C0-continuous regardless of what the global field
   happens to be at that ring. The fade lives in the *sampler*, not in the baked
   data, so the apron width is tunable without re-baking.
3. **Neutral baseline in the patch RTT.** The patch render target is cleared to the
   operator's identity (0 for `max()`/additive) so that an out-of-footprint sample,
   or an in-footprint texel the fine network didn't reach, is a no-op under the
   union. The apron and the neutral clear are belt-and-suspenders: either alone
   removes the hard edge; together they also remove any half-texel sampling fringe.

**(B) The temporal seam — when the camera *moves*.** A static cap detailed for
camera position P0 is wrong once the camera has translated/rotated enough that the
un-detailed region enters the near field. The design-once contract (the *policy*; v1
implements only the static slice of it):

1. **Re-bake trigger = angular threshold, not per-frame.** Re-baking is expensive
   (lattice build + GPU height read + grow + RTT render). The orchestrator re-bakes
   only when the camera's object-space view direction has moved past an angular
   threshold `θ_rebake` from the *last baked cap center* — never on a frame budget,
   never continuously. `θ_rebake` is a fraction of the cap's own angular radius
   (recommended **0.5 × angularRadius**: re-bake once the center has drifted halfway
   to the apron, so the freshly-needed detail is baked before the stale apron
   reaches the near field).
2. **Cross-fade, don't hard-swap.** When a new cap replaces the old one, swapping
   the patch uniform in a single frame pops. The policy is a brief cross-blend
   between the outgoing and incoming patch (two patch slots, `mix()`-ed by a short
   time ramp) so the boundary detail dissolves rather than jumps. This is the *only*
   place a presence-`mix()` is legitimate — it blends two **fine** representations
   of the same feature against each other, not fine-vs-global.
3. **Streaming window (future) to avoid re-bake stalls.** The end-state is a
   toroidal/streaming detail window: instead of one cap that wholesale re-bakes,
   maintain a ring of tiles and re-bake only the leading edge tiles as the camera
   advances, recycling trailing tiles (classic clipmap/geometry-clipmap toroidal
   addressing). This bounds per-move work to the swept area and removes the periodic
   full-cap stall entirely.

**Explicitness requirement.** v1 ships **static-cap with manual trigger**.
Re-bake-on-move, cross-fade, and the streaming window are **named deferred items**
(see §9), not silent gaps. The seam-blend (Part A) is *not* deferred — it ships in
v1, because a static cap still has a spatial boundary.

### Part 2 — RIVERS-instance application (file:line)

**Spatial seam (A) — SHIPPED in v1.**

- **Union operator = `max()` (deepest-valley-wins).** The fine patch depth is
  unioned into the global carve at every one of the 5 finite-difference taps inside
  `sampleCarve()`: `planet-lod-lab.html:245-249`, each tap
  `max(textureCube(uRiverCarveMap, d).r, patchDepth(d))`. This is the same
  `MaxEquation` operator the global carve cube uses internally
  (`planet-lod-rivers.js` `createCarveCubeMap`, fn at `:710`, `CustomBlending`
  `MaxEquation OneFactor/OneFactor` at `:736-737`) and the patch RTT uses
  (`planet-lod-tributary-patch.js:147-148`). Unioning on all 5 taps (not just the
  center) is deliberate: the finite-diff gradient at `planet-lod-lab.html:250` then
  bends the fine valley *walls*, not merely darkens the floor — the fine carve
  participates in the same `h -= carveDepth` / `grad += -carveGrad` displacement the
  global trunks use (`planet-lod-lab.html:424-425`), satisfying the Section 1 "reuse
  the feature's own renderer" rule.
- **Apron fade in patch space.** `patchDepth()` at `planet-lod-lab.html:223-234`:
  `lateral = length(vec2(su,sv))/R` (0 at center, 1 at edge) at `:231`, `falloff =
  1.0 - smoothstep(0.7, 1.0, lateral)` at `:232`, returned as
  `texture2D(uRiverCarvePatchMap, uv).r * falloff` at `:233`. The fine carve is
  fully faded by `lateral = 1.0` and begins fading at `0.7`, so the `max()` operand
  is 0 (the `max` identity) before the gnomonic UV domain runs out — no cliff at the
  cap ring.
- **Neutral baseline.** The patch RTT is cleared to depth-0
  (`renderer.setClearColor(0x000000, 0); renderer.clear(true,false,false)` at
  `planet-lod-tributary-patch.js:206-207`), and depth 0 is exactly the `max()`
  identity ("no valley"). Any texel the fine network didn't carve, and any sample
  outside the footprint, is therefore a no-op union — confirming the "present
  everywhere, costs nothing outside the footprint" property. Out-of-cap directions
  are killed *before* the texture is ever sampled by the explicit cap test at
  `planet-lod-lab.html:226` (`if (cosd <= cos(uRiverCarvePatchAngular)) return
  0.0;`); the gnomonic inverse (`projectToPatch`, `planet-lod-tributary-patch.js:29`,
  which exactly inverts `buildFineGrid`'s forward placement `normalize(n + su·u +
  sv·v)` at `planet-lod-tributaries.js:147`; GLSL counterpart
  `planet-lod-lab.html:223`) only runs for in-cap dirs. For in-cap-but-near-rim UVs
  the apron (`:232`) plus the RTT's default `ClampToEdgeWrapping` are
  belt-and-suspenders that drive the near-rim union operand to ~0.

> **Recommendation (open fork — spatial blend tuning, §8):** keep the apron band at
> `smoothstep(0.7, 1.0)` and do **not** widen it for v1. The neutral-clear baseline
> plus the `:226` cap test already remove the seam; a wider apron only throws away
> usable fine detail near the rim. Revisit only if visual testing shows a ring
> artifact the clear doesn't cover.

**Temporal seam (B) — DEFERRED, policy stated.**

- **v1 = static cap, manual trigger.** `bakeTributaryPatch()`
  (`planet-lod-lab.html:3530`) is on-demand only — invoked via
  `window._lab.bakeTributaryPatch(...)` / the GUI button, never per-frame. The cap
  center is the object-space camera direction captured *at bake time*: `invQ =
  planet.quaternion.copy().invert()`, `c =
  camera.position.clone().normalize().applyQuaternion(invQ)`
  (`planet-lod-lab.html:3535-3536`), passed as `center: [c.x,c.y,c.z]` with
  `angularRadius` from `patchAngularDeg` and `gridRes: 56` (`:3537-3544`). The
  deferral is documented in-code at `planet-lod-lab.html:3528`: *"Static, on-demand:
  re-bake-on-move / windowing are deferred."* The master `uRiverCarvePatchStrength`
  is driven by `riverOverlayState.patchStrength`, which **defaults to 0**
  (`planet-lod-lab.html:1412`) and is written into the uniform at the end of every
  bake (`:3546`), so an un-baked or stale patch is regression-safe (zero
  displacement) until the GUI strength slider is raised.
- **Deferred item D-R1 — re-bake-on-move (see §9).** Add an angular-threshold check
  in the render loop: re-call `bakeTributaryPatch()` when the live object-space
  camera dir (same `invQ`-rotated vector as `:3536`) has moved more than `θ_rebake =
  0.5 × angularRadius` from the stored last-baked `center`. The bake fn is already
  self-contained and deterministic (rebuilds the lattice from the region —
  `buildFineGrid` is keyed by `center`/`angularRadius`/`gridRes` and the grow is
  seeded by `state.macroSeed`), so the trigger is the only missing piece.
  **Blocker:** the O(Nf²) `snapNearest` linear scan
  (`planet-lod-tributaries.js:339`) and the O(Nf)-per-call `sampleHeight` linear
  scan (`planet-lod-tributary-patch.js:181-189`) make each bake too slow to fire on
  movement at gridRes ≥ ~300; re-bake-on-move is gated behind the §3 spatial-index
  fix, not independent of it.
- **Deferred item D-R2 — cross-fade on swap (see §9).** Add a second patch RTT +
  uniform set (`uRiverCarvePatchMap2`/N/U/V/Angular) and a time-ramp `mix()` in
  `sampleCarve` between the two patch operands *before* the `max()` union, so a
  re-bake dissolves rather than pops. Two-slot ping-pong; the outgoing slot is freed
  after the ramp.
- **Deferred item D-R3 — toroidal streaming window (see §9).** Replace the single
  cap with a tile ring addressed toroidally; re-bake only leading-edge tiles as the
  camera advances. End-state for continuous flight; out of scope until D-R1 is
  validated.

> **Recommendation (open fork — re-bake granularity for the eventual D-R1, §8):**
> when D-R1 is built, trigger at **θ_rebake = 0.5 × angularRadius** (single full-cap
> re-bake), *not* an incremental window — the simplest trigger that prevents stale
> apron from reaching the near field. Defer the toroidal window (D-R3) until the
> single-cap re-bake is proven to stall acceptably; do not build streaming
> speculatively.

---

## Section 6 — Verification: the Legibility Gate

> Consistent with Section 1: a feature's LOD is verified at its **render
> representation** (1c), not at the field that feeds it. The carve cube / patch RTT
> is the convergence machinery; the gate judges the *picture that machinery
> produces*.

### 6.1 General rule (feature-agnostic)

**A structured-feature-LOD change is verified only when the fine detail is LEGIBLE —
not when an A/B toggle merely DIFFERS.**

The failure this rule exists to kill: last cycle the tech gate asked "does turning
the patch on change the render vs. off?" The answer was yes (a field was written,
pixels moved), so it passed — then failed Max's UAT because the change was
sub-threshold (carve too shallow to flood, grid too coarse to read as "fine", carves
bleeding over water). **"Differs" is necessary but not sufficient. "Legible" is the
bar.** A diff proves the pipeline is *wired*; legibility proves the feature is
*delivered*.

Two consequences that hold for every feature instance, not just rivers:

1. **Headless tests cannot certify the visual structure.** Headless runs exercise
   only the JS graph math — primitive counts, receiver-chain integrity,
   ocean-pinning, seam continuity of the *data*. They run on the regeneration fn
   (1b) and the primitives (1a). They CANNOT see the rendered representation (1c):
   per-pixel depth, flooding, relief consistency, cap seams, sunglint. **The GPU
   gate is therefore mandatory for any change touching the shader or the render
   path**, and is non-delegable to CI.
2. **The gate is driven live by working-Claude through chrome-devtools on the GPU
   Chrome (`:9223`, `127.0.0.1`, NOT Playwright — Playwright is CPU and will not
   reproduce the fullscreen shader).** It is an *integration* check in dev-collab
   terms: objective, agent-ownable. It is NOT UAT — "does the planet feel like it
   has real rivers as a cohesive whole" remains Max's gate alone and is marked
   `deferred-to-max`.

**The six legibility criteria (general form).** At the lab's *fullest usable zoom*
over a cap aimed at the feature's intended substrate:

- **(a) VISIBLE** — the fine primitives are perceptible at that zoom, not
  theoretically present.
- **(b) FINER** — they read as clearly higher-frequency than the global primitives
  they grow onto (the LOD must *look like* LOD).
- **(c) CO-DEPENDENT TERMINATION** — fine detail honors the boundary fields it reads
  (1c field-reads): it terminates where the global feature terminates, with no detail
  rendered outside the feature's valid domain.
- **(d) IN REAL RELIEF** — fine detail sits in terrain consistent with the other
  features it reads (no floating, no contradiction of the global coupling — the
  North Star).
- **(e) NO CAP SEAM** — the regeneration cap (Section 1, orchestrator-owned) is
  invisible; the blend/re-bake policy holds at the boundary.
- **(f) REGRESSION-SAFE AT ZERO** — at master strength 0 the render is byte-identical
  to the no-LOD baseline (the feature is purely additive; nothing leaks when "off").

**Objective anchors (the part that is not eyeball-only).** Each visual criterion is
backed by a machine check so the gate is reproducible and a regression is catchable
without a human:
- a primitive-count assertion from the bake return (proves geometry was emitted),
- a screenshot taken at a *known, scripted cap orientation* (not "wherever the camera
  happened to be"),
- a clean console (no GLSL warnings, no NaN/Inf, no silent texture-bind failures).

A change is `VERIFIED_PENDING_MAX <sha>` only when all six pass; then Max does UAT.

### 6.2 Rivers instance (concrete checks with file:line refs)

**Cap setup (scripted, deterministic).** Aim the cap at land-with-trunk before
baking — the patch center is the camera direction (planet quaternion ~identity):
`center = invQ · normalize(camera.position)` at `planet-lod-lab.html:3535-3536`, so
set yaw/pitch to a known land-and-trunk direction, then bake via
`window._lab.bakeTributaryPatch({angularDeg, strength})` (`planet-lod-lab.html:3530`,
gridRes hardcoded 56 at `:3544`). Reading the cap "wherever it was" is how a
blank-ocean cap silently passed before.

The six criteria, mapped to rivers:

- **(a) VISIBLE — objective + screenshot.** Assert the bake actually emitted fine
  channels: `bakeTributaryPatch` returns `{ ..., segmentCount }`, sourced from
  `valleyGeo.userData.segmentCount` (set in `buildFineValleyGeometry`,
  `planet-lod-tributary-patch.js:103`; surfaced in the bake return at `:221`).
  **`segmentCount > 0` is a hard precondition** — zero means either `growTributaries`
  found no in-patch trunk outlets OR no fine vert reached `channelOrderMin` (Strahler
  ≥ 2), so nothing was rasterized and the screenshot is meaningless. Then screenshot
  at the scripted cap and confirm tributaries are perceptible.
- **(b) FINER — screenshot + parameter sanity.** Tributaries must read
  higher-frequency than the trunk ribbon (`buildRibbonGeometry`,
  `planet-lod-rivers.js:473`). UAT failure #2: gridRes 56 ≈ 40km spacing vs. the
  113km base mesh is only ~2-3× finer — not legibly fine. **Recommendation (single
  fork): raise effective resolution to ~5-10km AND first kill the O(Nf²)
  `snapNearest` linear scan (`planet-lod-tributaries.js:339`) + the O(Nf)/call
  `sampleHeight` linear scan (`planet-lod-tributary-patch.js:181-189`)** — replace
  them with the analytic triangular-lattice cell inverse from §3.2 (gnomonic-inverse
  `projectToPatch` → `round(sv/rowH)`, `round((su−offset)/cell)` → the `indexAt`
  map), which is O(1) and exact for snapped verts. The quadratic scans are the
  operative blocker on raising gridRes, so they must die before higher resolution
  can be demonstrated. The gate fails (b) until a screenshot at the higher res shows
  visibly fine dendrites. **(Open taste fork — see §8: snap-refactor scope/sequencing
  and a measurable "finer" proxy.)**
- **(c) FEED THE SEA — screenshot, the headline UAT fix.** No carve over water;
  tributaries terminate at the coast; no sunglint blobs. Root cause: the patch pins
  fine outlets only to the **trunk surf** (`outletSurf`, written at
  `planet-lod-tributaries.js:402-404`), not to sea level, and the carve unions over
  ocean. Screenshot must show fine channels reaching `h == uSeaLevel` (the level-set
  shoreline; there is no baked coast field — `uSeaLevel` at
  `planet-lod-uniforms.js:282`, liquidMask `planet-lod-lab.html:435`) and **no carve
  where `isOcean` is true** (`computeOcean`, `planet-lod-rivers.js:274`). A sunglint
  blob over water = automatic FAIL of the whole gate.
- **(d) REAL RELIEF — screenshot.** Tributaries must sit in mountain-consistent
  terrain. UAT failure #3 names the 50/50 height-dilution bug: the fine macro term
  is `macro = 0.5·macroInterp + 0.5·sampleHeight` (`planet-lod-tributaries.js:394`),
  then `h = macro + fineAmp·fbm` (`:397`), which halves mountain-awareness. After the
  fix (Section 4 Fix 1), the screenshot must show tributaries following real slope
  (carve applied through `sampleCarve` union of cube + patch,
  `planet-lod-lab.html:245-249`, gated by `reliefGate` `:421`), not draped across
  flats.
- **(e) NO CAP SEAM — screenshot at the cap edge.** The patch is an ortho RTT over
  `±tan(angularRadius)` (`planet-lod-tributary-patch.js:199-201`) unioned into the
  global cube via `patchDepth()` (GLSL `planet-lod-lab.html:223`), which already
  applies a `smoothstep(0.7,1.0,lateral)` edge falloff (`:232`). Screenshot the cap
  boundary specifically; a visible discontinuity where patch depth meets cube depth
  fails the orchestrator blend policy.
- **(f) REGRESSION-SAFE AT 0 — objective.** Master strength is GUI-owned and applied
  at `uniforms.uRiverCarvePatchStrength.value = riverOverlayState.patchStrength`
  (`planet-lod-lab.html:3546`); the bake itself never sets Strength (the
  patch-uniform block deliberately omits it, `planet-lod-tributary-patch.js:213-219`).
  At strength 0, `patchDepth()` early-returns 0 (`planet-lod-lab.html:224`) so it
  contributes nothing to the MAX union — the cube path is untouched. Set
  `uRiverCarvePatchStrength = 0` and confirm the render equals the pre-bake baseline
  (capture before/after, diff). Note the lab quirk: uniform writes take immediately,
  but state toggles need GUI onChange — so flip strength via the uniform, not a
  half-applied state. **(Open taste fork — see §8: diff tolerance + a pinned
  canonical camera for reproducibility.)**

**Console gate (all criteria).** Throughout, `list_console_messages` must be clean:
no GLSL1 compile warnings from the carve material (`planet-lod-rivers.js:732`
packing), no NaN from the FloatType height sampler (`planet-lod-rivers.js:218`), no
failed texture bind on `uRiverCarvePatchMap` (`planet-lod-tributary-patch.js:215`).

**What headless still owns (and only this).** Headless may assert: `segmentCount >
0`, fine receiver chains terminate on outlets, `isFineChannel` count > 0, outlet
base-node correspondence, lattice determinism (same region ⇒ same `fverts`). It must
NOT be allowed to mark (a)-(e) PASS — those are GPU-gate-only. Mechanically: the
verify-workstream contract marks the visual ACs `deferred-to-gpu-gate`, the GPU gate
promotes them to `VERIFIED_PENDING_MAX`, Max's UAT closes.

---

## Section 7 — Rivers build plan (instance #1)

> This is a **pointer to the build**, not the build. After Max approves this spec,
> implement the rivers instance in the order below. Each item cites the section that
> justifies it. Companion build spec:
> [`2026-06-19-river-lod-design.md`](2026-06-19-river-lod-design.md).

1. **Co-dependence field-reads first (Section 4) — the North Star, lowest-risk,
   highest-value.** They're CPU-side graph fixes verifiable partly headless.
   - **Fix 1 — full-weight height (mountains).** `planet-lod-tributaries.js:392-395`:
     `macro = sampleHeight(p)` at coeff 1.0; demote `baseH` to `macro += FLATS_EPS *
     baseH[k]` (≈1e-3) flats-only tie-breaker; keep the `typeof sampleHeight` guard
     for the pure-CPU path.
   - **Fix 2 — sea-level outlets.** Add the sea-outlet pass in `growTributaries`
     after `:384`: forward `height` array + `uniforms.uSeaLevel.value` into `params`;
     for `height[k] < seaLevel` call `claimOutlet(k, -1, seaLevel)`; add the `bn ===
     -1` collision special-case in `claimOutlet` (`:350-352`).
   - **Fix 3 — ocean-masking the bake.** Store `isOceanFine[k]` on the
     `growTributaries` return (`:416-423`); in `buildFineValleyGeometry`
     (`planet-lod-tributary-patch.js:77`) add `if (isOceanFine[k] || isOceanFine[r])
     continue;`.
   - Forward the third reader in `bake()` (`planet-lod-tributary-patch.js:164`) per
     the §4.3 table.

2. **gridRes raise + analytic O(1) snap (Section 3) — gated dependency.** The O(Nf²)
   scans MUST die before gridRes can rise.
   - Replace `snapNearest` (`planet-lod-tributaries.js:339-343`) and the
     `sampleHeight` nearest-vert scan (`planet-lod-tributary-patch.js:181-189`) with
     the closed-form lattice inverse (gnomonic `projectToPatch` → `round(sv/rowH)`,
     odd-row offset, `round((su−offset)/cell)` → `indexAt`; ring-fallback on a
     radius-clipped miss).
   - Add the `inverse(forward(k)) == k` unit test for every k (boundary cells are
     where it diverges).
   - Then derive gridRes from `s_feat ≈ 5–10 km` + the 8° cap + the **seed-derived**
     `R_planet_km = state.planetRadiusEarth · 6371` (`planet-lod-lab.html:2129`):
     `gridRes = ceil(2·sin(α)·R_planet_km / s_feat_km)` → **≈ 448 for an Earth-scale
     seed** (replace the hard-coded `56` at `planet-lod-lab.html:3544`). Recompute on
     seed/radius change (it scales per planet size); hold it fixed across zoom — α
     carries zoom. Do NOT touch the unit-sphere geometry `R = 1.0`.

3. **Fine ribbon + carve render representation (Section 2).**
   - **Fork A:** `buildFineRibbonGeometry` in `planet-lod-tributary-patch.js`
     mirroring `buildRibbonGeometry`, in the planar (su,sv) frame, lifted via
     `localFrame`.
   - **Fork B:** color from the shared `cOrd` ramp; width via `widthAt` on fine
     `faccum`, clamped to the trunk's outlet width.
   - **Fork C:** second persistent `Mesh`, `planet.add(...)` near
     `planet-lod-lab.html:1401`, `renderOrder=11`, geometry swapped each bake.
   - **Fork D:** order-graded dry→flood carve depth (small orders = dry groove via
     `:582` darkening; large orders cross `uSeaLevel` → F14 flood).
   - **Fork E:** pin the fine outlet vertex to the trunk rail (trunk position +
     `widthAt(routed.accum)` + `cOrd(strahler[outletBaseNode])`); thread global
     `routed{accum,strahler}` into the ribbon build.

4. **Legibility GPU gate (Section 6) — the verification, last.** Script the
   deterministic cap (land+trunk yaw/pitch), bake, then run the six criteria live on
   `:9223`/`127.0.0.1` chrome-devtools (NOT Playwright). `segmentCount > 0`
   precondition; clean console; before/after diff at strength 0 for (f). Green → mark
   visual ACs `VERIFIED_PENDING_MAX <sha>`; Max does UAT.

**Ordering rationale:** field-reads (1) are the North Star and partly headless-safe;
the O(1) snap (2) is a hard blocker gating any resolution demonstration, so it
precedes the render work that makes resolution legible; the render representation (3)
depends on both; the gate (4) can only certify once all three have landed.

---

## Section 8 — Open for Max (taste forks)

These are taste/aesthetic/tuning calls, not technical blockers. Each can be resolved
in a live `:9223` GPU pass with Max or by a one-line decision.

1. **§2 Fork C — junction renderOrder priority.** Fine ribbon `renderOrder=11`
   (fine wins at the overlap) vs. flip to `9` (trunk reads as the dominant
   water-line where a tributary joins). Pure legibility-priority call.
2. **§2 Fork D — dry→flood Strahler cutoff.** Which fine orders carve deep enough to
   cross `uSeaLevel`, and how far `VALLEY_DEPTH_HI` must reach given
   `uRiverCarveDepth`. Too aggressive re-introduces UAT failure 3 (tributaries flood
   like trunks); too shy leaves CONTRAST unfixed. Needs a live GPU pass.
3. **§2 Fork B — fine-end luminance floor.** Color convergence assumes `cOrd`'s dark
   end (`0x1d3c5e`) reads against the darkened valley floor for the thinnest rails.
   If fine tributaries go dark-on-dark, a small minimum-luminance floor on the fine
   end of the ramp may be wanted.
4. **§3 — zoom-detail ceiling.** Holding gridRes fixed and letting α carry zoom caps
   the finest achievable detail at the α_min cap. If Max wants unbounded zoom-in
   detail, a second finer cap tier is needed (a §4/§5 seam-policy extension).
   Taste/perf-ceiling tradeoff.
5. **§3 — physical planet radius. RESOLVED (Max, 2026-06-19): use realistic
   seed-derived radius.** The lab already carries a per-seed physical radius
   `state.planetRadiusEarth` (`planet-lod-lab.html:2129`), drawn from the game's
   `RADIUS_RANGES_EARTH` (`src/core/ScaleConstants.js:67-86`, ~0.3–16 RE) via
   `drawPresetRadius(preset, radiusSeed)` (`:1868-1877`). The LOD gridRes derivation
   reads `R_planet_km = state.planetRadiusEarth · 6371` (see §3.2), so density scales
   realistically per planet — no fixed Earth assumption, no generation change, no
   game-side work, unit-sphere geometry untouched. (Minor, non-blocking: radius uses
   `radiusSeed`, continents use `macroSeed`; kept independent — flip the radius draw to
   `macroSeed` later if one-seed-drives-all is wanted. One-line wiring, not now.)
6. **§4 Fix 1 — FLATS_EPS magnitude.** ≈1e-3 relative recommended; too large
   re-introduces dilution, too small gives non-deterministic flow on flat GPU
   terrain. Empirical/visual call.
7. **§4 Fix 2 — sea-outlet pinning vs. estuary notch.** Pin to `seaLevel` (matches
   the shader level-set coast, `lab:435/:452`) vs. cut slightly below for an estuary
   look. Aesthetic fork.
8. **§4 — fine-vs-global ocean-boundary disagreement.** `isOceanFine` uses the fine
   12-octave GPU height; the global trunk's ocean test uses base-mesh `isOcean`
   (9-octave, `rivers.js:274`). They can disagree by up to one fine cell at the
   shoreline. Recommendation: fine GPU test authoritative inside the patch; whether
   to reconcile this seam against the global carve cube is an orchestrator
   seam-policy decision.
9. **§5 — spatial apron band.** Keep `smoothstep(0.7, 1.0)` for v1 (recommended) vs.
   widen. Revisit only if a ring artifact appears.
10. **§6(b) — snap-refactor scope + a measurable "finer" proxy.** Is the snap-cost
    refactor in scope for THIS rivers pass or deferred? (b) is un-gateable until
    gridRes can rise, which the quadratic scans block — so this is the "does this
    pass ship (b) or mark it blocked" call. Also: consider a measurable proxy (e.g.
    rendered trunk:tributary channel-width ratio) so the gate is adversarial-proof
    rather than eyeball-only.
11. **§6(f) — regression-diff protocol.** Screenshot diffing can throw false deltas
    from FP jitter. Pin one canonical `(yaw, pitch, angularDeg, camera distance)`
    into the gate script and set a pixel tolerance (or a pixel-exact capture
    protocol) so the at-zero diff is reproducible across sessions.

---

## Section 9 — Deferred (named, not silent)

These are explicitly out of scope for v1 and tracked here so they are not silent
gaps. All three are temporal-seam (§5 Part B) items.

- **D-R1 — re-bake on camera move.** Angular-threshold trigger (`θ_rebake = 0.5 ×
  angularRadius`) in the render loop calling `bakeTributaryPatch()`. **Gated behind
  §3's O(1) snap** — each bake is too slow to fire on movement until the O(Nf²) scans
  die.
- **D-R3 — toroidal / streaming detail window.** Tile ring with toroidal addressing;
  re-bake only leading-edge tiles. End-state for continuous flight. Out of scope
  until D-R1 is validated; do not build speculatively.
- **D-R2 — boundary seam-on-move / cross-fade swap.** Second patch RTT + uniform
  set, time-ramp `mix()` in `sampleCarve` *before* the `max()` union, so a re-bake
  dissolves rather than pops. (The static spatial seam itself is NOT deferred — it
  ships in v1 per §5 Part 2.)
