# River-LOD — view-dependent drainage detail (lab) — design spec

**Date:** 2026-06-19 · **Feature:** view-dependent river-LOD (instance #1 of a
future general progressive feature-LOD system) · **Surface:**
`planet-lod-lab.html` (`window._lab`) · **Status:** **Option B — STEP 2**
(patch-bake + blend). Option A (per-pixel Dendry SDF) was **rejected after the
topology de-risk** and the design pivoted to Option B; this revision rewrites the
spec to Option B and is the spec of record. The TOPOLOGY de-risk PASSED (commit
`31dacc8`, `planet-lod-tributaries.js` + 332-test cluster green).

**Campaign context:** part of the
[planet-LOD lab campaign](../../FEATURES/planet-lod-campaign-tracker.md); the
strategic frame is [`planet-lod-CHARTER.md`](../../FEATURES/planet-lod-CHARTER.md)
(lab ≠ game by design; the program is catalog → per-feature QUALITY pass →
integration → deferred game-port). HOW reference: the river-LOD design-options
brief (brainstorming session, 2026-06-19), the F11 fluvial spec
([`2026-06-07-f11-fluvial-river-networks-design.md`](2026-06-07-f11-fluvial-river-networks-design.md)),
and the Option B STEP-2 design brief (decisions locked 2026-06-19).

**Scope:** lab only, **rivers only** (YAGNI). The pattern is designed to be
reusable as a general "reveal a finer generation of the same structure" system,
but only the rivers instance is built here. No production `Planet.js` wiring.
"Done" = working + **visually verified on GPU Chrome `:9223`** (the live GPU gate
is make-or-break for visual structure — §11).

---

## 1. Summary / goal

Make finer drainage **bloom on camera approach**: as the camera nears a planet,
sub-tributaries of the existing river network appear, branching off the real
trunks, so the network gains genuine topology at close range instead of
self-erasing into a few coarse channels. This is **instance #1 of a future
general progressive feature-LOD system** — far away you see only big features,
on approach finer features of the *same kind* bloom in. That general system is
**explicitly NOT built here** (per YAGNI); the mechanism is designed so the
pattern can be lifted later (§10).

**Fidelity decision (locked): SYNTHESIZED-but-TOPOLOGICALLY-REAL.** The finer
tributaries are **grown off the real trunks** by *local refined re-routing* —
they are genuinely connected, dendritic, and converge into existing rivers
(convergence is a *topological proof*, priority-flood-from-outlets — see §6), but
they are **not computed from real global upstream drainage area**. Plausible and
structurally-real, not globally-physically-derived.

## 2. Background & problem

**Two LOD mechanisms exist in this renderer, and rivers exposed the gap.**

1. **Noise-octave bloom (works for FBM features).** Relief is computed per-pixel
   (analytic normals + a `samplerCube` carve tap); view-dependent detail is a
   single global scalar `octaves = mix(4, 9, lodRamp)`, `lodRamp ≈
   smoothstep(20, 6, distRadii)`. Mountains/dunes/glacial terrain are FBM fed by
   `uOctaves`, so they bloom genuine new high-frequency structure on approach.

2. **Structured / routed features (capped — rivers).** Rivers are NOT FBM. They
   are a drainage graph routed on a **fixed 40,000-vertex global mesh** baked
   into a **1024²/face carve cube** (≈ **9 km/texel** at this resolution). The
   pipeline (`planet-lod-rivers.js`): `buildIrregularSphere(40000)` (`:190`) →
   `createHeightSampler` (`:218`) → `routeAndOrder` (`:283`) →
   `buildRibbonGeometry` (`:473`) + `buildValleyGeometry` (`:589`) →
   `createCarveCubeMap` (`:710`). Cube channels: **R = valley depth, G =
   mouth/apron, B = Strahler order**.

**The resolution floor.** Because the network is baked at a fixed vertex count
and cube resolution, on close approach there is **nothing finer to fall back
on** — the network thins out instead of refining. Noise-octave LOD **cannot**
rescue this: noise has no flow direction (the F11 worm-trail failure — noise mask
≠ dendritic network). We need a generator that adds *structured, connected*
drainage at finer-than-global resolution, gated by approach, leaving the coarse
trunks fixed and flicker-free.

## 3. Approach — pivot to Option B (patch-bake)

**Option A (per-pixel Dendry SDF amplifier) — REJECTED.** "Distance to a
locally-built tree" gives local TEXTURE, not global CONNECTIVITY toward the
trunk. It failed the connectivity property the whole feature is *for*.

**Option C (re-run the global router on a local cap) — REJECTED.** The router is
a global priority-flood seeded from all ocean outlets; a local patch has no
correct outlet/boundary condition. Stitching a local network to the global
drainage at the seam is unsolved-research, and it forces ~100–170 ms CPU
regen per move.

**CHOSEN — Option B: grow REAL connected tributaries by local refined
re-routing, then BAKE them into a camera-localised patch texture and BLEND that
patch into `sampleCarve`.** This is built in two steps:

- **STEP 1 (DONE, commit `31dacc8`):** the pure-JS topology — `growTributaries`
  in `planet-lod-tributaries.js` grows connected dendritic tributaries by local
  refined re-routing onto trunk-channels-as-outlets. Convergence is a topological
  PROOF (priority-flood-from-outlets onto the trunk OUTLETS, exactly as the
  global router floods toward the ocean). Pure arrays + Math, no THREE/GPU/DOM,
  so the topology is proven headlessly (332-test cluster green). The spike used a
  CPU value-noise fbm as a **stand-in** for height.

- **STEP 2 (THIS SPEC):** the GPU bake/blend that renders those tributaries into
  the lab's per-pixel relief, **camera-localised** so they have FINER resolution
  than the ~9 km/texel global carve cube. Replaces the spike's CPU fbm with the
  **real GPU height** (`createHeightSampler`), reads the **retained router graph**
  for the in-patch trunk outlets, bakes the fine valleys into a **2D orthographic
  RenderTarget**, and unions that patch into `sampleCarve` under an angular
  falloff.

## 4. Mechanism — STEP 2 components

### 4.1 The patch is a 2D ORTHOGRAPHIC RenderTarget, NOT a second cube (the key decision)

A second *cube* at the same resolution gives **NO finer detail** — it is still
~9 km/texel globally. The whole point of "patch" is **angular concentration**: a
2D ortho RTT looking down the patch-centre normal, covering a small angular
region (default **~8° half-angle**), concentrates 1024 texels over ~1100 km ⇒
**~1 km/texel (~9× finer)** than the global cube. This is the mechanism that
makes "bloom on approach" *new structure* rather than upsampled blur.

- **Texture:** `FloatType` (fallback `HalfFloatType`) 2D `WebGLRenderTarget`,
  default 1024², `NearestFilter`→`LinearFilter` (linear so the blend is smooth).
- **Camera:** an `OrthographicCamera` placed above `center` looking down
  `-center` (the patch normal `N`), `up = u` (the local-frame tangent), frustum
  half-size matching the chosen UV convention (§7), near/far bracketing the unit
  sphere.

### 4.2 v1 bakes DEPTH ONLY (R channel)

Mouth (G) and order (B) stay the **global cube's** job — deltas/coast/outflow
(AC4/AC5/AC6 consumers at `planet-lod-lab.html:326/363/435`) keep keying off
`uRiverCarveMap`, **untouched**. The patch RTT carries fine **valley depth** in R
only. No AC4/5/6 rewiring.

### 4.3 Fine height = the REAL GPU height (replaces the spike's CPU fbm)

`createTributaryPatch` reads height at the fine lattice verts via
`createHeightSampler({ renderer, uniforms, verts: fineVerts, octavesDuringRead })`
(`rivers.js:218`) — the SAME RTT-readback the global router uses, so the
tributaries follow the *live* preset/dials. **Higher octave count** (e.g. **12**
vs the base router's 9) is used so sub-base-mesh relief is revealed for the fine
network to follow. Outlets are still pinned to the trunk nodes' `routed.surf`.

### 4.4 Trunk source = the retained router graph

The in-patch trunk channels are read from `createRiverOverlay`'s `get routed()`
(`rivers.js:846`): base nodes with `isChannel === 1` and `dot(verts[i],
center) >= cos(angularRadius)`. They are snapped + geodesic-slerp-densified into
the fine lattice as OUTLETS (reusing the spike's snap + densification, already in
`growTributaries`). The fine LATTICE stays a regular tangent-plane grid
(`buildFineGrid`); base-mesh irregularity only affects *which trunk nodes we
read*, not the fine network's dendricity.

### 4.5 Blend in `sampleCarve` = MAX union under an angular smoothstep falloff

For EACH of `sampleCarve`'s **5 taps** (center + 4 finite-diff offsets at
`planet-lod-lab.html:214-218`), after the global `textureCube(uRiverCarveMap,
dir).r`, also compute the patch depth for **that same `dir`** and take
`max(globalDepth, patchDepth * falloff)`. **Including the patch in ALL 5 taps is
REQUIRED** so the analytic-normal finite-diff bends the *valley walls* (the
gradient), not merely darkens the floor. `falloff` is a `smoothstep` over angular
distance from the patch centre so the patch fades to 0 at its edge (no hard
seam). `uRiverCarvePatchStrength == 0` ⇒ the patch term vanishes
(**REGRESSION-SAFE** — see §8).

## 5. Data flow (STEP 2)

```
On-demand bake (window._lab.bakeTributaryPatch / GUI):
  center = invQuat · normalize(camera.position)         // object-space cam dir (the lightObj pattern)
  createTributaryPatch.bake({ routed, baseMesh, center, angularRadius, seed, params }):
    localFrame(center) → {u, v, n=center}
    buildFineGrid(center, angularRadius)                  // regular tangent-plane lattice
    createHeightSampler(verts=fineVerts, octaves≈12).read() → fine GPU height   [§4.3]
    read in-patch trunk nodes (routed.isChannel, dot≥cos(angular)) → snap+densify outlets  [§4.4]
    priorityFloodFromOutlets → steepestReceiver → strahlerOrder                  [STEP 1 prims]
    buildFineValleyGeometry(fine receiver chains, depth rails only)              [§4.1 / adapt :589]
    render into the 2D ortho RTT (OrthoCam above center, looking -N, up=u)       [§4.1]
    set uniforms: uRiverCarvePatchMap/Center/U/V/N/Angular, leave Strength to GUI

PER FRAGMENT, inside sampleCarve (planet-lod-lab.html:209-221):
  for each of the 5 taps (dir):
     depth = textureCube(uRiverCarveMap, dir).r            // global (unchanged)
     if (uRiverCarvePatchStrength > 0 && dot(dir, N) > cos(angular)):
        project dir → patch uv (§7); falloff = 1 - smoothstep(0.7,1.0, lateral)
        depth = max(depth, texture2D(uRiverCarvePatchMap, uv).r * falloff)
  → finite-diff gradient now includes the patch → perturbAnalytic bends fine walls
```

**Static camera first.** v1 provides an **on-demand bake for a GIVEN centre dir**
(the current camera direction). Re-bake-on-camera-move, toroidal windowing, and
patch-boundary popping are **DEFERRED** (§10). A `window._lab` / GUI hook bakes
at the current camera + sets strength, for the live GPU gate.

## 6. Consistency / connectivity (why this is real, not cosmetic)

Convergence onto the trunk is a **topological proof**, not a tuned rule:
`priorityFloodFromOutlets` fills the fine grid with the trunk OUTLETS playing the
role the global ocean plays for the global router — every non-outlet fine cell is
raised until it has a downhill path to an outlet, then `steepestReceiver` routes
each cell to a strictly-downhill neighbour. The proven STEP-1 properties
(0 orphans / 0 cycles, dendritic confluence-alignment, anti-starburst,
determinism) hold by construction. The bake is **deterministic** for a given
`(center, angularRadius, seed)`, so re-baking the same region reproduces the same
network. Within a single static bake there is **no flicker** (the texture is
fixed). Re-bake-on-move popping is the deferred sub-problem (§10), *not* solved
here — the v1 gate is judged on a static bake.

## 7. Patch UV transform (EXACT — the main bug risk; the live gate will catch sign/scale errors)

**Convention chosen: GNOMONIC-TANGENT** — both the shader sample and the bake
OrthographicCamera project the sphere cap onto the tangent plane through the
gnomonic (central) projection (divide by `cos`), with frustum/UV half-extent
`R = tan(angularRadius)`. Rationale: `buildFineGrid` already lays its lattice at
planar radius `R = tan(angularRadius)` and places each fine vert at
`normalize(n + su·u + sv·v)` (`planet-lod-tributaries.js:126,147`). Gnomonic-tan
makes the shader's inverse projection **exactly** invert that forward placement
(`dir = normalize(n + su·u + sv·v)` ⇒ `su = dot(dir,u)/dot(dir,n)`), so a fine
vert at planar `(su,sv)` lands at the same UV in the bake and in the sample. Using
a plain orthographic (`dot(dir,u)` without the `/cos`) would mismatch the lattice
placement near the cap edge and bow the channels. **Both** sides use gnomonic-tan.

Shader, given object-space unit dir `D` and patch frame `(N,u,v,angular,strength)`:
```glsl
float cosd = dot(D, N);
if (cosd > cos(angular) && uRiverCarvePatchStrength > 0.0) {   // inside patch cap
   float su = dot(D, u) / cosd;            // gnomonic-tan lateral coords
   float sv = dot(D, v) / cosd;
   float R  = tan(angular);                // == bake ortho half-size
   vec2  uv = vec2(su, sv) / (2.0 * R) + 0.5;
   float lateral = length(vec2(su, sv)) / R;          // 0 centre .. 1 edge
   float falloff = 1.0 - smoothstep(0.7, 1.0, lateral);
   float dPatch  = texture2D(uRiverCarvePatchMap, uv).r * falloff;
   depth = max(depth, dPatch);
}
```

**Bake camera consistency.** The `OrthographicCamera` frustum half-size MUST equal
`tan(angularRadius)` in the SAME tangent-plane units, and the fine valley
geometry is rendered **in those planar `(su,sv)` coordinates** (the same `planar`
array `buildFineGrid` returns), not as 3D sphere positions — i.e. the bake draws
each fine vert at world `(su, sv, 0)` under an ortho cam with `left/right/top/
bottom = ±R`, so screen-NDC ↔ UV is the identity `uv = (su,sv)/(2R)+0.5`. This is
the gnomonic forward map made trivial: because the fine verts' planar coords ARE
the gnomonic projection of their sphere positions, baking in planar space and
sampling via gnomonic inverse are the same map by construction. (Equivalent
alternative: render the fine verts at their 3D sphere positions with a real
perspective/gnomonic cam — rejected as more error-prone; planar-ortho is chosen.)

A **pure-JS port** `projectToPatch(dir, frame)` is exported from
`planet-lod-tributary-patch.js` (no THREE) so the transform is unit-testable AND
kept byte-aligned with the GLSL.

## 8. Regression-safety (non-negotiable)

At `uRiverCarvePatchStrength == 0` the render MUST be **pixel-identical** to
pre-change:
- Defaults: `uRiverCarvePatchMap` = a 1×1 dummy texture, `uRiverCarvePatchStrength
  = 0`. The `if (uRiverCarvePatchStrength > 0.0 && cosd > cos(angular))` guard
  makes the patch term a no-op (the dummy is never sampled, the `max` never
  changes `depth`).
- The existing 332-test cluster + the carve regression behaviour stay untouched
  at strength 0 (the global cube path in `sampleCarve` is byte-for-byte
  unchanged — the patch lines only ADD a guarded `max`).
- The pure primitives in `planet-lod-tributaries.js` stay PURE (no THREE) so the
  headless STEP-1 tests still pass unchanged.

## 9. Deferred sub-problems (NOT built in v1 — flag if reached)

- **Re-bake on camera move** + **toroidal/clipmap windowing** (refresh the patch
  as the camera pans). v1 is a single static on-demand bake.
- **Patch-boundary popping** when the patch re-centres (a windowing/blend-history
  concern). The angular `falloff` already removes the *spatial* seam within one
  bake; cross-bake temporal continuity is deferred.
- **Mouth/order (G/B) in the patch** — v1 is depth-only; deltas/coast/outflow
  stay on the global cube.
- **Production `Planet.js` wiring** — lab only.

## 10. Out of scope / parked / future

- **Silhouette / faceted-limb fix — PARKED** (geometry-LOD, independent).
- **Generalization to a general progressive feature-LOD system — designed-for,
  not built.** Rivers are instance #1. Future build order (noted, NOT specced):
  rivers (this spec) → outflow (F13, rides the carve `.b` Strahler channel) →
  craters (a faded-in higher-frequency voronoi octave). Listed for sequencing
  only.

## 11. Acceptance checks

**Headless (portable parts only — the RTT + shader are GPU-gated, not here):**
- **B-on-irregular-base:** `growTributaries` on a REAL `buildIrregularSphere`
  base patch (`rivers.js:190`) + a hand-built routed trunk on it → still
  **0 orphans / 0 cycles** (connectivity holds on the irregular BASE — closes the
  reviewer caveat that the spike only used a regular lattice as its base). Headless
  has no renderer, so a deterministic JS height fn is injected for this test (the
  topology is height-source-agnostic, already proven).
- **Patch UV round-trip:** the pure-JS `projectToPatch` port — a dir built as
  `normalize(N + su·u + sv·v)` maps back to `(su,sv)` within the cap; the lateral
  gate is ~0 at centre and ~1 at edge.
- **Fine valley geometry:** the depth-rail builder emits the expected attributes /
  non-empty for a fixture with channels.
- **Regression:** baseline **332** stays green —
  `npx vitest run tests/planet-lod-*.test.js tests/planet-archetypes.test.js
  tests/planet-lod-sealevel.test.js`.

**Live GPU gate (chrome-devtools, GPU `:9223`, `window._lab`) — MAKE-OR-BREAK for
visual structure (this is the gate the whole design is judged on):**
- `window._lab.bakeTributaryPatch()` at the current camera + raise
  `uRiverCarvePatchStrength` ⇒ **finer dendritic tributaries appear inside the
  patch cap**, branching off and converging into the existing trunks (genuinely
  finer than the global carve at the same zoom).
- **No hard seam** at the patch edge (the angular falloff fades it out).
- **Strength 0 ⇒ pixel-identical** to pre-change (regression confirmed live).
- The fine network sits ON the real trunks (snapped outlets), not beside them.

## Citations

- **Option B topology de-risk** — `planet-lod-tributaries.js` + commit `31dacc8`
  (priority-flood-from-outlets convergence proof; 332-test cluster).
- **Dendry** — Gaillard et al., 2019 (the rejected Option-A primitive).
