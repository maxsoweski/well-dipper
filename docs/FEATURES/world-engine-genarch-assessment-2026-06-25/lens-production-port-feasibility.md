# Lens — Production-Port Feasibility (adversarial)

**Date:** 2026-06-25 · **Branch:** `feature/world-engine-production-L1` · **Mode:** READ-ONLY
**Charge:** Try to REFUTE the ASSESSMENT.md recommendation (do Option A now) on grounds of
feasibility / cost / blast-radius. Specifically: does the validated FLAT-2D-DEM relief substrate
actually survive the port (a) to a SPHERE and (b) to a GPU / real-time budget — and is the
recommendation under-estimating the production-port effort? Default skeptical.

**Verdict in one line:** **NOT refuted.** The recommendation's *direction* (Option A, not B) survives
scrutiny — Option B genuinely can't carry a baked field, and that's a real constraint, not taste. But
the recommendation **materially under-states the production-port cost and over-states how much
"machinery already exists,"** in five specific, code-verified ways. Option A is the right call; its
**effort is mis-rated "Medium"** and several de-risking citations validate the wrong thing. The
recommendation should be ADOPTED WITH the effort/risk corrections below folded into the scope.

---

## What I tried to break, and what held

I attacked the three load-bearing feasibility claims the recommendation uses to rate Option A
"Medium effort / High feasibility":

- **C-A** "Reuses machinery that already exists — B's `runE6` writes height; B's `sphereField` + C's
  cube baker rasterize a per-node field into a seam-free cube; the river router is already
  sphere-native." (ASSESSMENT §1 headline, §6 Option A pros, §4 "machinery to close the gap exists.")
- **C-B** "The flat→sphere port is a *mesh-topology* problem, not an algorithm rewrite" + "cubemap-seam
  lake breakage is a graph-adjacency problem, smaller than the slice's flat-DEM caveat implied."
- **C-C** "Sphere/GPU gaps are de-risked by published, in-runtime-feasible answers (FastFlow, the WebGPU
  port, Liao)." → bake is "seconds, not per-frame," budget is fine.

**What held (recommendation survives):**
- Option B really is a dead end. `runE6`'s height in the production port is added to a flat grid via
  `steeredNoise` × `grainMag` (`tectonic.js:113-118`), and the in-shader grain enters as a *direction
  only* (`planet-lod-height.glsl.js:949-950` mixes `sampleGrainStrike(pos).xz` into the orogeny axis;
  `:972` keeps height `noised()`-derived). There is no path by which orientation-steered fragment noise
  becomes a baked macro-field. The "B can't reach the bar" claim is correct and code-grounded.
- The river router's *graph* (Fibonacci → Lloyd → spherical-Delaunay → `adj`) IS genuinely sphere-native
  and seam-free: its priority-flood seeds from `isOcean[i]` cells, not grid edges
  (`planet-lod-rivers.js:354`), and all routing/accumulation/Strahler run over `adj`
  (`:358,:377,:417,:426`). The "oceans are the sinks, no boundary special-case" claim holds for the
  router. This part of the de-risking is accurate.

**What broke (cost/risk under-stated):** the five findings below.

---

## Finding 1 — There is NO sphere-native HEIGHT writer today. "B's runE6 writes height" is true only on the flat grid.

The recommendation repeatedly leans on "B's `runE6` writes height" as if a sphere-native height bake is
already in hand and Option A is mostly wiring. The code says otherwise:

- The ONLY sphere-native writer in `src/worldengine/base/*` is `writeGrainSphere`
  (`tectonic.js:53-63`). It writes **`grainAngle`, `grainMag`, `regime` only** — NOT `height`. (Verified:
  the function body sets exactly those three carrier arrays.)
- The only HEIGHT writer is `runE6` (`tectonic.js:98-124`), and it writes to a **flat `n*n`
  substrate**: `for (iy) for (ix) { const i = iy*n+ix; … substrate.height[i] += … }` (`:109-118`). It
  calls `crust.thicknessBlob(ix, iy, n)` (`:115`, a flat-grid uv lookup) and `jacobiSmooth`
  (`:122`), which is a **flat 4-neighbour stencil** (`:85-95`, uses `i-1/i+1/i-n/i+n`, NOT the carrier
  `adj`). None of this runs on `sphereField`.

So the height-on-sphere generalization is **entirely un-written**, not "a one-channel decision." Porting
`runE6` to the carrier means rewriting `steeredNoise` to use the carrier's `tangentFrameAt(i)` instead of
flat-grid `x,y` (`tectonic.js:69-79,113`), replacing `thicknessBlob`'s uv with a per-node sphere field,
and replacing `jacobiSmooth` with an `adj`-based diffusion. That is real net-new generative code on the
exact surface (height) whose generation is the entire point of the feature — not glue. **The ASSESSMENT's
own §6 con ("the one un-validated generalization") is the correct framing; its §1/§4 prose ("machinery
already exists," "one-channel decision") contradicts that con and under-rates the work.**

## Finding 2 — The WS2 "sphere-native, seam-consistent" VIZ-UAT proves seam-consistency for the WRONG field.

The recommendation cites WS2's 2026-06-25 VIZ-UAT pass and `sphereField` as evidence the seam hazard is
"smaller than the slice's flat-DEM caveat implied." But the seam-consistency it proved is a near-tautology
for *this* model and does NOT transfer to a height field with longitudinal structure:

- `verify.js`'s `seamConsistent` check (`:62-79`) asserts that same-latitude `adj` neighbours agree on
  `regime` and `grainAngle`. It passes **by construction** because, in the code's own words, "regime/grain
  are a pure function of latitude, same-latitude seam neighbours agree … by construction"
  (`tectonic.js:50-52`). `verify.js` checks NOTHING about `height` seam-continuity (height isn't even in a
  seam loop — only `regime`/`grainAngle` are, `:72-76`).
- A pure-function-of-latitude field is *exactly the property that caused the WS4 UAT failure* ("a compass
  field, not relief," ASSESSMENT §3). So the sphere validation that supposedly de-risks Option A validated
  the zonal orientation grain — the half that already failed UAT — and is **silent on the seam behaviour of
  a baked height/plate field**, which is the half Option A introduces.

The cubemap-seam-lake hazard the slice flagged is about a *height/drainage* field that varies in longitude
(so a lake can straddle a face boundary). Nothing shipped today has a longitudinally-varying baked height on
a sphere, so nothing today has been tested against that hazard. The research's "it's just an adjacency-graph
problem" answer (research §1.2, §3.4) is *plausible* but is from blocked/abstract-only sources (see Finding
5) and is unproven in this codebase. **The seam hazard is NOT de-risked; it is un-touched.**

## Finding 3 — The "validated E9" is the flat one; the sphere-native routing is a SEPARATE code path, and its carve is the deferred-T12b one.

This is the sharpest cost mis-estimate. The recommendation treats "the river router is already
sphere-native" as if it lets Option A reuse the UAT-passed E9 on a sphere. Two different code paths are
being conflated:

- **The UAT-PASSED hydrology** is `relief-e9-hydrology.js` — and it is **irreducibly flat-grid**:
  boundary-edge seeding (`:25` `ix===0||iy===0||ix===n-1||iy===n-1`), Cartesian `NEI` 8-offsets (`:6`),
  `n*n` everywhere, and `synthPrecip` as latitude bands (`:80-96`). It seeds the priority-flood from the
  **map edge** — a concept that DOES NOT EXIST on a closed sphere. It cannot run on `sphereField`. (Per
  `map-relief-slice.md` §e and the slice header, B "never ported" E9 — "E9/hydrology = exactly 1 copy, A
  only," ASSESSMENT §4.)
- **The sphere-native routing that exists** is the river router's own priority-flood
  (`planet-lod-rivers.js:340-430`) — a *different* implementation, separately built and validated for the
  rivers feature. So Option A does not "port the validated E9 to the sphere"; it **adopts the router's
  routing and grafts a stream-power carve onto it.** That carve already exists as `perNodeIncision`
  (`rivers.js:790-878`) — but the ASSESSMENT itself documents (§3, §8) that `perNodeIncision` is folded
  only onto an immutable probe copy (`sampleRoutedHeight`, `lab.html:5775-5787`, "NOT a rendered-chain
  sample … the deferred T12b"), and the on-screen carve depth is still the legacy order-tent
  (`depthAt`, `rivers.js` legacy branch). The subtractive carve into a *rendered* substrate height has
  **never been wired** — that wiring is T12b, explicitly deferred.

So the hydrology half of Option A is: (a) get a baked height the router routes on (Finding 4), then (b)
finish the deferred T12b carve-into-rendered-height. Calling this "reuse" undersells it — the reusable
piece is the routing *topology*, not the carve-into-displayed-relief, which is net-new + previously deferred.

## Finding 4 — The router routes over IN-SHADER NOISE, not a baked substrate. Option A's core path is the un-validated one.

The decisive structural fact: the "REAL height" the router routes and carves over is the **GPU evaluation
of the in-shader combiner chain** — the very noise the architecture says to replace.

- `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN` (`rivers.js:210`); `ROUTER_MAIN` runs `fbmd` +
  `mountainCombiner` + ~25 combiners (`:169-208`) — i.e. the lab shader's height soup. `createHeightSampler`
  renders that to a FloatType RTT and reads it back per mesh vertex (`:267-320`). `route()` calls
  `sampler.read()` to get `height`, then routes (`:1003-1009`).

That means the entire sphere-native pipeline that exists today (mesh, priority-flood, D-inf, Strahler,
grain cube, carve cube) is computed over **shader-synthesized height**. For Option A, the renderer's
*displacement* AND the router's *routing source* must both be re-pointed at a **baked substrate-height
field sampled on the sphere** (a height cube/texture, sampled in GLSL like the grain cube is at
`height.glsl.js:144-147`). That bake-and-sample-on-sphere path is the "one un-validated generalization" the
ASSESSMENT admits — but it is not peripheral; it is **the spine of Option A**, and it touches three
surfaces (the bake producer, the renderer displacement, and the router height source) rather than "the lab
height accumulator (medium blast)." Medium blast radius is optimistic: a baked-height displacement changes
what every downstream combiner sees (they currently add detail on top of the noise base), so the detail
combiners likely need re-tuning against the new base — a wide, if gated, touch.

## Finding 5 — The GPU budget is de-risked by research that is (a) not WebGPU and (b) partly the approach the recommendation rejects.

The recommendation says "use FastFlow exact routing (not Schott's approximation)" AND "Feasibility: High
(machinery + research both in hand)." These are in tension, per the research file's own honesty notes:

- **FastFlow is CUDA / PyTorch / TensorFlow — there is NO WebGPU implementation** (research §1.5: "CUDA/
  PyTorch/TensorFlow reference impl — not WebGPU. The browser port is the engineering gap"; §4 names the
  WebGPU compute port of rake-compress + Borůvka "the hardest *engineering* lift").
- **The only browser existence proof is the Schott WebGPU port — which the recommendation explicitly
  rejects** for this use case (ASSESSMENT §7: Schott's depression-blind approximation "breaks on" the
  host-editor's between-epoch perturbation; research §2.1, §5 ⚠FLAG). So the recommendation's chosen GPU
  routing has *no* in-runtime precedent, and the precedent that exists is the rejected one.
- Mitigating: for a **bake-time CPU reference** at "seconds per body," none of this is on the critical path
  — the existing CPU router already does the sphere routing in JS at build time. So the *bake budget* per se
  ("seconds, not per-frame," open question #5) is genuinely fine for a first Option A. The risk is narrower:
  if Option A later needs the GPU exact-routing path (for resolution or re-bake-on-edit interactivity), that
  is an un-precedented WebGPU compute build, not a port — and the "Feasibility: High … research in hand"
  rating should not be read as covering it. The research file is honest about this (§4, §6 caveats); the
  ASSESSMENT's summary rating papers over it.

---

## Does this REFUTE the recommendation?

**No — but it re-rates it.** I could not find a feasibility fact that makes Option A the *wrong* call:

- Option B remains structurally incapable (Finding "what held"), so "do A not B" stands.
- The sphere router graph genuinely exists and is seam-free, so the hardest *algorithmic* sphere question
  (drainage topology on a closed surface) is in fact answered in-codebase — the recommendation is right that
  this is not a from-scratch problem.
- A CPU bake at "seconds per body" is feasible today with the existing router routing.

What the lens *does* refute is the **"Medium effort / one-channel decision / machinery already exists"
characterization.** The honest scope of Option A is:

1. Write a **sphere-native height bake** (port `runE6` + `thicknessBlob` + smoothing to the carrier/cube —
   net-new generative code, Finding 1).
2. Bake that height to a **sampled sphere field** (cube/texture) and re-point BOTH the renderer displacement
   AND the router's height source at it (Finding 4) — the un-validated spine, wider blast than "the height
   accumulator."
3. Finish the **deferred T12b** carve-into-rendered-height so E9's subtraction is what the eye sees, using
   the router's `perNodeIncision` over the baked field (Finding 3).
4. Actually exercise the **cubemap-seam-lake hazard** against a longitudinally-varying baked height — it has
   never been tested; the WS2 seam pass only covered the zonal grain (Finding 2).

That is a **High-Medium effort, Medium-High blast-radius** unit, not "Medium / lab-only / gated." The
recommendation to proceed is sound; the *plan that follows from it* must budget for items 1–4 explicitly, or
it risks a second "verified-but-UAT-fails" outcome — this time because the bake/sample/seam path is harder
than billed, not because the channel was wrong.

---

## Concrete asks to fold into the Option-A scope (before `dev-collab-scope`)

- **Re-rate effort to High-Medium**; name the four sub-items above as the AC spine. Don't carry "machinery
  already exists / one-channel decision" into the plan — it's contradicted by `tectonic.js` (no sphere
  height writer) and `rivers.js` (router reads in-shader noise).
- **Add a first AC for the seam hazard:** a longitudinally-varying baked height on the sphere, with an
  explicit lake-across-seam test. The current `verify.js seamConsistent` does not cover it.
- **Decide the height-source swap surface up front:** does the router re-point to the baked field (so carve
  acts on baked height), or stay on the in-shader RTT? Option A only honors the north star if BOTH the
  renderer displacement AND the router source move to the baked field; a half-move re-creates the WS4 split
  (data + noise) on a new surface.
- **Scope GPU exact-routing OUT of the first Option A.** Use the existing CPU router bake ("seconds/body").
  Flag the WebGPU FastFlow port as a separate, un-precedented future workstream — do NOT let "research in
  hand" imply it's de-risked.
- **Carry the §8 correction:** the D12 hard-zero is `PlanetGenerator.js:613`, not `:565` (the slice
  non-goal note and spine cite `:565`); a plumbing edit at `:565` hits the wrong line.

## Evidence index (file:line, all first-hand this session)

- No sphere height writer: `src/worldengine/base/tectonic.js:53-63` (`writeGrainSphere` = grain/mag/regime
  only), `:98-124` (`runE6` flat `n*n`), `:85-95` (`jacobiSmooth` flat stencil), `:113-118` (flat
  `steeredNoise` + `thicknessBlob(ix,iy,n)`).
- Seam check is zonal-only: `src/worldengine/base/verify.js:62-79` (regime/grainAngle only, no height);
  `tectonic.js:50-52` ("pure function of latitude … by construction").
- E9 is flat-grid, single copy: `relief-e9-hydrology.js:6` (`NEI`), `:25` (edge seeding), `:80-96`
  (`synthPrecip` latitude bands), `:104-152` (`runE9` `n*n`).
- Sphere router exists but routes on in-shader noise: `planet-lod-rivers.js:210` (`HEIGHT_FRAG =
  HEIGHT_GLSL + ROUTER_MAIN`), `:169-208` (combiner soup), `:267-320` (`createHeightSampler` RTT readback),
  `:340-430` (priority-flood seeds `isOcean`, routes over `adj`), `:1003-1009` (`route()` reads sampler).
- Carve-into-rendered-height deferred: `planet-lod-rivers.js:790-878` (`perNodeIncision`); `lab.html:5768-
  5787` (`sampleRoutedHeight` "NOT a rendered-chain sample … deferred T12b").
- Renderer grain is direction-only: `planet-lod-height.glsl.js:949-950` (mix into orogeny axis), `:972`
  (height still `noised()`), `:143-147` (`sampleGrainStrike` cube fetch).
- GPU research honesty: `research-sphere-gpu-bake.md` §1.5 (FastFlow not WebGPU), §2.1 (Schott WebGPU port =
  the rejected approximation), §4/§6 (WebGPU FastFlow = "hardest engineering lift," retrieval caveats).
- Decision #6: `docs/FEATURES/world-engine-production-L1-plan.md:264`.
