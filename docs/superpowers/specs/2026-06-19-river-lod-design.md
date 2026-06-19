# River-LOD — view-dependent drainage detail (lab) — design spec

**Date:** 2026-06-19 · **Feature:** view-dependent river-LOD (instance #1 of a
future general progressive feature-LOD system) · **Surface:**
`planet-lod-lab.html` (`window._lab`) · **Status:** design APPROVED by Max
2026-06-19 (formalizes a locked brainstorming outcome — this spec writes it up,
it does NOT re-open any decision).

**Campaign context:** part of the
[planet-LOD lab campaign](../../FEATURES/planet-lod-campaign-tracker.md); the
strategic frame is [`planet-lod-CHARTER.md`](../../FEATURES/planet-lod-CHARTER.md)
(lab ≠ game by design; the program is catalog → per-feature QUALITY pass →
integration → deferred game-port). HOW reference: the river-LOD design-options
brief (brainstorming session, 2026-06-19) and the F11 fluvial spec
([`2026-06-07-f11-fluvial-river-networks-design.md`](2026-06-07-f11-fluvial-river-networks-design.md)),
which this builds directly on.

**Scope:** lab only, **rivers only** (YAGNI). The pattern is designed to be
reusable as a general "reveal a finer generation of the same structure" system,
but only the rivers instance is built here. No production `Planet.js` wiring.
"Done" = working + visually verified on GPU Chrome `:9223`.

---

## 1. Summary / goal

Make finer drainage **bloom on camera approach**: as the camera nears a planet,
sub-tributaries of the existing river network appear, branching off the real
trunks, so the network gains genuine topology at close range instead of
self-erasing into a few coarse channels. This is **instance #1 of a future
general progressive feature-LOD system** — the ISS-like idea that far away you
see only big features, and as you approach, finer features of the *same kind*
bloom in. That general system is **explicitly NOT built here**: this spec is
**rivers-only** (per YAGNI), with the mechanism designed so the pattern can be
lifted to other feature classes later (§10).

**Fidelity decision (locked): SYNTHESIZED, not hydrologically real.** The finer
tributaries are **procedurally generated off the real trunks** — they obey
downhill flow + the width law and converge into existing rivers — but they are
**NOT computed from real upstream drainage area**. They are plausible, not
physically derived. (This is the deliberate alternative to a real local re-route;
see Approach below.)

## 2. Background & problem

**Two different LOD mechanisms exist in this renderer, and rivers exposed the
gap between them.**

1. **Noise-octave bloom (works for FBM features).** Relief is computed per-pixel
   in the fragment shader (analytic normals + a `samplerCube` carve tap), and
   view-dependent detail today is a single global scalar:
   `octaves = mix(4, 9, lodRamp)` (lab `planet-lod-lab.html:16`, `:2355`,
   `:5474`), where `lodRamp ≈ smoothstep(20, 6, distRadii)` — full detail by
   ~6 radii (`:5485`). Mountains, dunes, glacial terrain etc. *are* FBM fed by
   `uOctaves`, so they bloom genuine new high-frequency structure on approach.
   Nothing is wrong with them.

2. **Structured / routed features (capped — rivers).** Rivers are NOT FBM. They
   are a drainage graph routed on a **fixed 40,000-vertex global mesh** (≈8,253
   channels, max Strahler order 6) and baked into a 1024²/face carve cube. The
   pipeline (`planet-lod-rivers.js`):
   `buildIrregularSphere(40000)` (`:190`) → `createHeightSampler` (`:218`) →
   `routeAndOrder` (`:283`, computes receiver/`accum`/Strahler) →
   `buildRibbonGeometry` (`:473`) + `buildValleyGeometry` (`:589`) →
   `createCarveCubeMap` (`:710`, 1024²/face). The carve cube channels are
   **R = valley depth, G = mouth/apron, B = Strahler order** (read in-shader at
   `planet-lod-lab.html:326` for outflow). Width law:
   `0.42 · accum^0.69` (Dunne–Leopold; `WIDTH_PHI=0.42`, `WIDTH_EXP=0.69` at
   `planet-lod-rivers.js:25`), recently **halved** as a pre-LOD baseline (head
   commit `79ff78b`, "river-width: halve WIDTH_SCALE/MIN/MAX") so the trunks are
   already less cartoonish before any LOD work begins.

**The resolution floor.** Because the network is baked at a fixed vertex count
and cube resolution, on close approach there is **nothing finer to fall back
on** — the network thins out instead of refining. The noise-octave LOD
**cannot** rescue this: noise has no flow direction, so cranking octaves adds
high-frequency wiggle, not drainage topology. This is the documented **F11
worm-trail failure** (noise mask ≠ dendritic network; see
`planet-lod-lab.html:370`). We need a generator that adds *structured* drainage,
gated by approach, while leaving the coarse trunks fixed and flicker-free.

## 3. Approach

**Chosen: Option A — a Dendry-style amplifier evaluated PER-PIXEL inside
`sampleCarve`.** Add a deterministic GLSL function that returns a
**sub-tributary signed-distance field (SDF)**, evaluated per fragment inside
`sampleCarve` (`planet-lod-lab.html:209-221`), **gated by `lodRamp` /
pixels-per-km** so it only blooms near the camera, and **conditioned on the
existing carve cube as its control function** (the baked network steers where
synthesized tributaries may appear, forcing them to inherit and converge into
real trunks rather than invent a parallel network). An SDF is exactly the
output the river rendering wants (sub-pixel-width analytic-AA channels). **No new
texture, no re-bake, no CPU readback** — the amplifier is pure shader math on
data already in-shader.

- **Option B (DOCUMENTED FALLBACK):** bake the *same* amplifier into a small,
  high-resolution, **camera-centered detail cube** (a texture clipmap window
  refreshed via toroidal updates), and blend that patch tap with the global cube
  tap. Same fidelity, same determinism; trades per-frame cost for VRAM +
  texture-lifecycle machinery. **Only reached for if per-pixel cost (Option A)
  proves too expensive** in the harness (§9). This is a strength-reduction of A,
  not a different design.

- **Option C (REJECTED):** rebuild a denser local mesh and re-run the real
  router over a near-camera cap to produce *genuinely real* finer tributaries.
  Rejected because the router is a **global** priority-flood seeded from all
  ocean outlets — a local patch has no correct outlet/boundary condition, so
  stitching the local network to the global drainage at the seam is an
  **unsolved research problem, not a wiring task**. It also forces CPU
  regeneration (~100–170 ms/regen, WebGL1 has no compute). Out of scope.

## 4. Components (each independently testable)

### 4.1 `amplifier()` — the GLSL drainage primitive (NEW; spike first)
Pure function, no side effects. Given an object-space surface direction, returns
the **SDF to the synthesized sub-tributary network plus a flow direction** (for
the channel gradient → chain-rule lighting). Properties:
- **Deterministic & position-seeded:** value depends only on position (hashing on
  position), so the *same* surface point returns the *same* value regardless of
  query order, camera path, or frame. This is the no-flicker guarantee (§6).
- **Dendritic / downhill:** synthesized child channels branch off a parent and
  sit at higher elevation than the parent they feed (downhill monotonicity), and
  scale spacing by Strahler order.
- Returns an SDF so the carve stays sub-pixel-AA-able.

This primitive is the **make-or-break risk** and is proven in an isolated
harness BEFORE any production edit (§7).

### 4.2 Control-function sampler (NEW)
Reads the existing carve cube to steer the amplifier: the **R channel (valley
depth)** locates the trunk axis / "how carved is it here," and the **B channel
(Strahler order)** sets how many finer generations are admissible and their
spacing. The amplifier is conditioned on this control function so synthesized
tributaries **snap onto real trunks and converge into them** rather than forming
an independent network.

### 4.3 `lodRamp` gate (NEW use of existing signal)
The bloom knob. Maps approach distance → (a) **strength** (how incised the
synthesized detail is) and (b) **drainage density** (how many generations / how
aggressively tributaries bloom). This is the single bloom-aggressiveness control
and the drainage-density **stopping rule**. It reuses the existing `lodRamp`
(`smoothstep(20, 6, distRadii)`); the amplifier contributes **zero** when
`lodRamp` is low (far away) — that is also the performance early-out.

### 4.4 Compositing into the carve (NEW)
Blend the amplifier's SDF into the existing carve result: deepen `carveDepth` and
bend `carveGrad` (the `depthGrad` out-param of `sampleCarve`) by the channel
gradient × incision, so the existing `perturbAnalytic` normal path lights the
synthesized walls automatically. Apply a **half-pixel width floor + analytic
anti-aliasing** so the finest synthesized channels never collapse below one pixel
(they fade in width/contrast instead of aliasing/shimmering).

## 5. Data flow

```
cameraPosition (in-shader builtin, planet-lod-lab.html:518)
  → inverse-quat into object space (the lightObj pattern, :4874/:4910)
  → distance (in radii) → lodRamp  (gate: strength + drainage density, §4.3)
  → PER FRAGMENT, inside sampleCarve (:209-221):
      sample global carve cube (R depth, B Strahler)              [§4.2]
      IF near a drainage axis AND close enough (lodRamp > 0):
        evaluate amplifier() → sub-tributary SDF + flow dir       [§4.1]
        add incision to carveDepth; bend carveGrad analytically   [§4.4]
        half-pixel width floor + analytic AA                      [§4.4]
  → perturbAnalytic lights the bent normal → relief
```

**No new textures, no bake, no CPU readback, no re-route.** Every input
(`cameraPosition`, the planet quaternion, the carve cube, `lodRamp`) already
exists in-shader.

## 6. Consistency / no-flicker

Flicker-free re-approach is guaranteed by **position-seeded hash determinism**
(§4.1) plus **three rules the river pipeline already computes**, which the
amplifier obeys:
1. **Downhill** — child elevation > parent elevation, so synthesized tributaries
   always flow *into* their trunk (never uphill, never a contradicting flow).
2. **Strahler-scaled tributary spacing** — finer generations are spaced by
   Strahler order (read from carve `.b`), so the same trunk subdivides into the
   same finer pattern every time.
3. **Width ∝ accum** — synthesized channels respect the established width law
   (`0.42 · accum^0.69`), so a sub-tributary is always thinner than its parent.

Because the amplifier is a pure function of position (not of camera path or query
order), the *same* surface point yields the *same* detail on every re-approach —
no popping, no shimmer. Self-similarity of drainage networks makes "subdivide a
trunk into the same finer detail" the physically-correct behavior, not a hack.

## 7. Build sequence

1. **Isolated harness first — `rivers-viewdependent-lab.html` (NEW).** Per the
   isolated-test-harness rule and the 3-cycle cap, the make-or-break risk lives
   here, *before* touching production. The harness must prove the primitive
   produces **(a)** dendritic, branching detail, **(b)** that obeys downhill
   flow, **(c)** that converges into a given trunk — AND it must **measure
   per-pixel cost** (frame time / fragment) so the per-pixel-vs-bake decision
   (Option A vs B) is made on **measured evidence, not assumption**. 3-cycle cap:
   if the amplifier fails three research→build→test rounds, fall back to Option B
   (bake) and flag it; do not death-spiral on per-pixel.
2. **Port the primitive into `sampleCarve` behind the `lodRamp` gate.** Add
   `amplifier()` + control-function sampler + compositing into
   `planet-lod-lab.html:209-221`, contributing zero unless `lodRamp > 0`.
3. **Live-walk the bloom aggressiveness / zoom band** on `:9223`: tune where
   sub-tributaries start appearing and how dense they get at closest approach
   (the §4.3 knobs), trading density against the per-pixel cost measured in
   step 1.

## 8. Testing

- **Headless unit tests (on the primitive):**
  - **Determinism** — same position → same SDF + flow dir across repeated /
    reordered calls.
  - **Downhill monotonicity** — every synthesized child sits above the parent it
    feeds (no uphill flow).
  - **Trunk-convergence** — given a control trunk, synthesized tributaries
    terminate on / converge into it (no parallel network).
- **Live integration (chrome-devtools, GPU `:9223`, `window._lab`):**
  - Sub-tributaries **bloom on approach** (visible new branching as distance
    drops through the zoom band).
  - **Trunks unchanged** — the coarse baked network is identical near and far.
  - **No flicker** — re-approaching the same region reproduces the same detail
    (no popping/shimmer).
- **Regression:** the existing cluster stays green —
  `npx vitest run tests/planet-lod-*.test.js tests/planet-archetypes.test.js
  tests/planet-lod-sealevel.test.js` (baseline **288**) — and the router lab is
  unchanged.

## 9. Risks

1. **Per-pixel cost — the make-or-break.** Evaluating the amplifier per fragment
   in an already combiner-heavy shader may be too expensive.
   **Mitigation:** measured directly in the isolated harness (§7 step 1) *before*
   any production edit; if it fails, fall back to Option B (bake). Not assumed —
   measured.
2. **Control-function tuning.** Getting synthesized tributaries to **snap cleanly
   onto trunks** (rather than near-miss or float beside them) depends on tuning
   the carve-cube control sampler. Verified by the trunk-convergence unit test +
   live inspection.
3. **2024 WebGL perf claim unverified.** The real-time WebGL Dendry successor
   (Grenier et al. 2024) demonstrates the primitive runs in a GLSL shader (our
   exact stack), but its exact fps / branch-depth numbers were **paywalled** —
   so feasibility is to be **confirmed EMPIRICALLY in the harness**, never
   assumed from the paper.

## 10. Out of scope / parked / future

- **Silhouette / faceted-limb fix — PARKED.** At closest approach the
  `SphereGeometry` limb can look faceted; that is a **geometry-LOD** concern,
  independent of all river work, and is handled (if at all) in a separate effort.
  Not in scope here.
- **Option B (bake-into-detail-cube) — fallback only.** Documented (§3) but not
  built unless Option A's per-pixel cost fails.
- **Generalization to a general progressive feature-LOD system — designed-for,
  not built.** Rivers are instance #1. The reusable pattern is "reveal a finer
  generation of the same structure, faded in by `lodRamp`," applicable to other
  capped/placed features. **Future build order (noted, NOT specced here):**
  **(1) rivers** (this spec) → **(2) outflow (F13)** — near-free, rides the same
  drainage data (the carve `.b` Strahler channel, `planet-lod-lab.html:326`) →
  **(3) craters** — a cheap second instance (a higher-frequency voronoi octave
  faded in by `lodRamp`, no router/bake). These follow-ons are listed for
  sequencing context only; this spec implements rivers and nothing else.

## Citations

- **Dendry** — Gaillard et al., 2019 (locally-computable distance-to-implicit
  dendritic-tree function; the amplifier primitive).
- **Real-time WebGL Dendry successor** — Grenier et al., 2024 (demonstrates the
  primitive in a GLSL shader on our stack; exact perf numbers paywalled →
  feasibility confirmed empirically in the harness, §7/§9).
