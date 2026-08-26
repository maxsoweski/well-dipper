# World-Engine Generative Architecture — Consolidated Assessment

**Date:** 2026-06-25 · **Branch:** `feature/world-engine-production-L1` (local-only) · **Mode:** READ-ONLY (no code edited)
**Audited against the north star** (`world-engine-architecture-spine.md` §0/§1, Max's words): *"What you see when you
look at a planet IS its billions-of-years history. The world engine is a STORY ENGINE: procgen WRITES the body's
tectonic/geological history as DATA upstream; rendering only READS/EXPRESSES that already-generated history. PROCGEN
DECIDES, RENDER EXPRESSES."*

**Inputs synthesized:** four code-maps (`map-game-L0.md`, `map-prod-lab-ws4.md`, `map-relief-slice.md`,
`map-worldengine-base.md`), four web-research files (`research-plate-tectonics.md`, `research-erosion-heightfield.md`,
`research-production-renderers.md`, `research-sphere-gpu-bake.md`), and two lens assessments (`assess-fidelity.md`,
`assess-direction.md`). Every load-bearing code claim was first-hand verified by the contributing agents (cites are
`file:line`; greps recorded in the source files' evidence indices).

---

## 1. HEADLINE ANSWER — is the generative architecture headed the right way?

**Yes — the DIRECTION is right; the WS4 UAT failure is an IMPLEMENTATION/SCOPE miss, not a design flaw.**

Separate the two cleanly:

- **The LOCKED DESIGN is the correct answer to the vision, and it is already proven.** The four 2026-06-22 structural
  locks — (1) a shared, first-class, mutable **relief substrate**; (2) the **host-editor / epoch** model (BUILD engines
  write the substrate, SCULPT engines edit it, in causal order); (3) **Option-A expose+derive** thin Tier-1 base step;
  (4) **type → derived label** — together *are* "procgen writes structure as DATA, render reads it." They are
  implemented and **Max-UAT-PASSED in the relief slice (2026-06-23)**, where E6 writes `height` and E9 carves the same
  `height` and the renderer displaces straight from `substrate.height`. They also match the field-standard
  "build-then-express" pattern of every shipping/near-shipping planet renderer surveyed (Outerra, Star Citizen Genesis,
  World Orogen, geometry clipmaps, NMS) and the academic SOTA (Cordonnier 2016, Cortial 2019, Jain 2024). No headline
  lock is contradicted by any finding.

- **WS4 failed UAT because it wired only the *orientation half* of that architecture into the production renderer.**
  WS4 carried E6's latitude-banded **grain orientation** (a strike director + grainMag + regime) and E9's
  **subtractive carve**, but left the relief **height** synthesized by ~25 in-shader `noised()` combiners that the grain
  merely re-aims. The substrate's `height` channel — the thing that makes the displaced surface *be* the generated
  history — never reaches a renderer. That is exactly Max's verdict: "an orientation overlay, not a planet with a
  tectonic history as data," and it is visible directly in the GLSL (`planet-lod-height.glsl.js:950` mixes the grain in
  as an axis; `:972` keeps height `noised()`-derived).

So: **right model, wrong channel on one surface.** The fix is to carry the substrate's baked **height** (or a coarse
amplitude derived from it) into the renderer as a sampled, sphere-native field — which the slice already proves and
`src/worldengine/base/*` is already heading toward — not to change the architecture.

There is **one mid-confidence caveat to the "direction is right" verdict**, surfaced from the plate-tectonics research
and flagged in §9: E6 today is a closed-form *despun-shell zonal-stress* model (Melosh 1977), which is the right physics
for one-plate / despun / tidal / icy bodies but produces *latitude bands*, not the plate-shaped macro-structure
(continents, ranges-at-boundaries, cratons) that every surveyed Earth-like-planet generator treats as the load-bearing
data. The slice's *discipline* (substrate + host-editor) is field-standard; its *tectonic model* may be under-scoped for
the Earth-like worlds Max's own bar names. This is a scope question for E6, not a flaw in the substrate architecture.

---

## 2. The consolidated DATA-vs-shader boundary map (all four surfaces)

The decisive column is **"who decides the relief STRUCTURE"** — where the mountains/basins/channels ARE and how
tall/deep. A surface HONORS the north star only if that structure crosses into the renderer as baked DATA and the
renderer merely expresses it. It VIOLATES it if the renderer re-decides structure from noise.

| Surface | Generated as DATA (upstream) | What the RENDERER consumes | Who decides relief STRUCTURE | Verdict |
|---|---|---|---|---|
| **(1) GAME L0** `src/generation/*` + `src/objects/Planet.js` (shipped, player-facing) | D1–D16 physics SCALARS + WS1 `systemContext` flat graph + D11 3-scalar surface-history budget. **Zero spatial field.** (PG:708–742; SSG:624–679) | baseColor/accentColor, noiseScale/noiseDetail, **one `planetType` int**, feature toggles. No driver, no graph, no field (PL:1038–1078; grep of Planet.js for any driver = ZERO) | **The fragment shader**, `snoise(pos*noiseScale)` in per-type `if(planetType==N)` branches; perturbStrength/seaLevel hardcoded per type (PL:438–441,:474,:550–553) | **VIOLATES** (most total) |
| **(2) PROD LOD LAB** `world-engine-lab.html` + `-core.js` + `-height.glsl.js` + WS4 (`-tectonic.js`/`-rivers.js`) (Max-UAT-FAILED) | ~40 per-body relief SCALARS/gates + 6 seeded ORIENTATION axes (`deriveUniforms`, core:496–953). WS4 adds an **E6 orientation cube** (strike+mag+regime) + an **E9 carve cube** (order-tent depth) | the ~40 scalars + 6 axes + grain cube (orientation) + carve cube (subtractive depth). **No height/province field crosses** | **The fragment shader**, ~25 `noised()` combiners; grain only re-aims them via `mix(axis,grainStrike,strength)` (`:950`) while height stays `noised()` (`:972`) | **VIOLATES** (noise, oriented) |
| **(3) RELIEF SLICE** repo-root `relief-*.js` + `world-engine-relief-lab.main.js` (Max-UAT-PASSED 2026-06-23) | a real `ReliefSubstrate`: 9 co-registered typed arrays (`height`, `grainAngle`, `grainMag`, `regime`, `faultDensity`, `flowAccum`, `baseLevel`, `standing`, `maturity`) — substrate.js:5–19. E6 WRITES `height +=`, E9 carves `height -=` into the SAME array | renderer displaces vertices DIRECTLY from `substrate.height[i]`; colors from `standing`/`flowAccum` (main.js:55–63) — **preset-blind** | **The data.** E6 builds it, E9 carves it; renderer synthesizes nothing | **HONORS** (the only one) |
| **(4) WS2 BASE STEP** `src/worldengine/base/*` (`makeBaseStep`, `runE6`, `sphereField`) | the production PORT of the slice's BUILD side: `makeSubstrate` (same 9 arrays), `runE6` writes `height`, `makeBaseStep` derives structured fields incl. a materialized `crustalThickness` Float32Array + a sphere carrier (`sphereField.js`) the slice lacks | **Nothing in any renderer.** `runE6`/`makeBaseStep` reached only by `worldengine-fieldviz.html` (read-only viz) + vitest (grep). `src/main.js`/`Planet.js` = zero refs | n/a — not on a render path | **HONORS as data, but UNWIRED** |

**In one sentence:** the data interface is *a type label* in (1); *scalars + axes + two thin cubes (orientation,
drainage-depth)* in (2); *the height field itself* in (3); *the height field plugged into nothing that draws* in (4).
The whole tension is the asymmetry between rows (2) and (3): the slice commits relief to a sampled height array; WS4
committed only an orientation director and left relief in shader noise.

---

## 3. Assessment vs vision + spine + wf2-synthesis — honors / violates

### Honors "procgen decides, render expresses"
- **Relief slice, end-to-end.** E6 writes `relief-e6-tectonic.js:122 height[i] += …`; E9 carves `relief-e9-hydrology.js:139 height[i] -= dz` into the SAME object; renderer reads it (`main.js:55`). Body-type divergence is produced AS reseed-invariant DATA (`relief-divergence.js`; regime/hydrology/carve gate). Faithful instance of all four locks, witnessed between epochs (`heightAfterBuild`, `relief-slice.js:39–44`).
- **WS2 base step (BUILD half).** `runE6` (tectonic.js:98–124) writes a real `height` DEM; `makeBaseStep` (baseStep.js:10–99) DERIVES structured fields from physics and makes **type a derived label** (`discriminator`, baseStep.js:64) — faithful Option-A expose+derive.
- **WS4 drainage NETWORK topology.** Genuinely routed (priority-flood + D-inf + Horton-Strahler) over the real readback height; the carve is a real subtractive host-edit that floods (`lab.html:425`), not cosmetic. The *network* is data; only the on-screen *depth law* is order-keyed (see below).
- **WS1 L0 plumbing.** D12/eccentricity/D13/D16/metallicity + a `systemContext` graph are surfaced as real derived data (PG:737–741; SSG:624–679) — honors intent (though inert in render).

### Violates "procgen decides" (render — or a label — decides the structure)
- **GAME relief = shader noise keyed on a label.** Per-type `snoise` branches with hardcoded perturb/seaLevel (PL:438–441,:550–553); `_pickType` runs FIRST (PG:323) before any driver; ~7 type-keyed lookup tables expand the label; `computeAtmosphere` bypasses physics for 4 types (PhysicsEngine.js:145–153); `ExoticOverlay` regenerates bodies from scratch with `forceType`/`zones=null`, **erasing driver history** (EO:286–323). The renderer reads ZERO of the physics it computes (grep = zero). The render expresses a *costume*, not a history.
- **PROD LAB relief = noise, oriented.** The grain enters six combiners only as an axis via `mix(uOrogenyAxis, sampleGrainStrike(pos).xz, uTectonicGrainStrength)` (`:950`); height stays `noised()` (`:972`). The grain itself is a **pure function of latitude** (`stressAtLat`, tectonic.js:56–57) → zero longitudinal structure → a compass field, not relief.
- **PROD LAB live carve depth = order-tent.** On-screen depth is `depthAt(strahler)` (rivers.js:753); the verified stream-power Δ=−K·A^m·S^n (`perNodeIncision`, rivers.js:790–860) is folded onto an immutable copy read only by the `sampleRoutedHeight` PROBE (lab.html:5791–5792, "NOT a rendered-chain sample … deferred T12b"), never the rendered chain. (A fidelity gap inside the carve — but NOT the UAT cause; the valleys still read plausible. The fail is the relief *body* being noise.)

---

## 4. WS4-vs-slice fidelity finding + the three E6/substrate code surfaces

### Hypothesis verdict: CONFIRMED
**WS4 carried ONLY the thin orientation grain. It did NOT carry the slice's structure-as-data height substrate.**
Three independent, code-verified facts, any one sufficient:
1. **WS4 imports only the orientation half.** `planet-lod-tectonic.js:28–29` imports exactly `writeGrainSphere, stressAtLat, makeSphereField` — never `runE6` (writes `height`), `makeBaseStep`, or `makeSubstrate`. It bakes a STRIKE-ONLY cube (RG = world strike.xy, B = grainMag, A = regime).
2. **The substrate's BUILD output reaches no renderer.** Grep for `runE6`/`makeBaseStep`/`makeSubstrate` outside the slice + the module returns only `worldengine-fieldviz.html` + tests. `src/main.js`/`Planet.js` = zero refs.
3. **In GLSL the grain is consumed as a direction, not a structure.** `mix(axis, grainStrike, strength)` at `:950`; relief height still `noised()` at `:972`. The `one-shared-grain` AC PASS ("cosToShared=1.000") proves PLUMBING (one field → six consumers all point the same way), not structure-as-data.

I (and the contributing fidelity agent) actively searched for any baked-height→displacement path in either player-facing
renderer and found none. The hypothesis stands. The mechanism verified (the orientation-sharing it was scoped to works);
the UAT failed (no structure-as-data was baked). Those are two different tests.

**Root cause is a LOCKED sub-decision, not the architecture.** WS4's orientation-only scope was *specified* by **Max
decision #6** (`world-engine-production-L1-plan.md:264`): "E6 grain vs existing `gProvince` — **augment** (province =
amplitude/where; grain = orientation/regime), not replace." Under #6, WS4 was built correctly — the
`renderer-expression-only` AC even PASSED by *confirming* `gProvince`/`initProvinces`/`provinceWeight` were preserved.
The UAT failure is the first place the consequence of #6 (relief stays shader noise) became visible.

### The three E6/substrate surfaces — a documented lineage, canonical = B
| Surface | Files | Role | Live? | Canonical for… |
|---|---|---|---|---|
| **A · Relief SLICE** | repo-root `relief-substrate.js`, `relief-base-step.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-divergence.js`, `relief-presets.js`, `relief-slice.js` | Max-UAT-PASSED full build+carve host-editor on a FLAT 2D DEM; frozen reference (do-not-import) | Lab page; reference | **E9/hydrology** (the ONLY live copy) + validated reference for the whole pipeline |
| **B · WS2 base step** | `src/worldengine/base/{substrate,baseStep,tectonic,sphereField,adaptL0,verify,fieldViz,mathutil}.js` | Production PORT of A's BUILD side; adds the sphere carrier A lacks; `adaptL0` consumes WS1's L0 scalars | Live; build half complete; Max VIZ-UAT 2026-06-25 | **E6 stress/grain MATH** + base step + L0 adapter + sphere carrier |
| **C · WS4 baker** | `planet-lod-tectonic.js` (single file) | Net-new glue: imports B's sphere path, bakes a grain ORIENTATION cube for the lab shader | Live; on the production-lab render path | the renderer-facing GRAIN-CUBE bake (holds no E6 math of its own) |

**Duplication, exactly:** E6 stress math = **2 near-byte-identical copies** (A's `relief-e6-tectonic.js` and B's
`tectonic.js`; same Melosh formulas, `NU=0.25`, `REGIME_GAIN=0.4` lock, `{0,π/2}` quantized grain). This is a
**deliberate, flagged** duplication — `planet-lod-tectonic.js:13–15` declares B the source of truth and says "do NOT
import the lab `relief-e6-tectonic.js` (two copies → drift)." Substrate/base-step = 2 copies (A, B; B adds materialized
`crustalThickness` + `loveK2`/`thermalState` proxies + the `calibrateTidal` knee). **E9/hydrology = exactly 1 copy
(A only)** — B never ported it; the lab carve reuses the existing production river router instead. **No dead code.**

**Canonical, restated:** for E6 math + base step + sphere path, `src/worldengine/base/*` (B) is canonical; the slice (A)
is the validated reference to READ but NOT import; `planet-lod-tectonic.js` (C) is the renderer-facing baker on top of B.
For E9/carve, A's `relief-e9-hydrology.js` is the only reference that exists.

**The machinery to close the gap already exists.** B's `runE6` writes `height`; B's `sphereField` + C's
`buildGrainCubeGeometry`/`createGrainCube` already rasterize a per-node field into a seam-free cube — WS4 used that exact
machinery to carry ORIENTATION; the same machinery could carry the substrate HEIGHT. The gap is a one-channel decision,
not missing architecture.

---

## 5. Prior-art synthesis — what the field says (with the research citations)

**Universal pattern, unanimous across every source:** a procedural planet pipeline **bakes a coarse structural field as
real data once, then amplifies detail at runtime conditioned on that data.** Detail is a *residual on top of* the
structure, never the structure itself. The relief slice matches this; the WS4 grain cube matches none of it.

- **Procedural plate tectonics as data** (`research-plate-tectonics.md`): Gainey/Experilous, Cortial 2019 (read pp.3–7),
  platec/pyplatec, McDonald clustered-convection, Red Blob Games, PyTectonics — all generate plates as first-class data
  objects, partition the sphere, assign Euler-pole motion, and DERIVE relief from boundary interactions; per-cell state
  (plate id, crust type, elevation, thickness, age, fold/ridge direction) is stored, and noise is *steered by* it.
  **Cortial 2019 is the canonical "procgen decides, render expresses":** coarse crust C stores type/thickness/elevation/
  age/orogeny-type/fold-direction; the renderer amplifies with Gabor noise oriented by the stored ridge direction and
  exemplar DEM primitives chosen by stored orogeny type. Cratons/orogenic belts/rifts are explicit data (terranes,
  orogeny-age fields, ridge-direction fields). **The slice has the height equivalent but no plate-id field** — its E6 is
  a despun-shell zonal-stress model, not a plate/boundary model.
- **Tectonic-uplift + fluvial-erosion SOTA** (`research-erosion-heightfield.md`): E9 IS the SOTA recipe at reference
  fidelity — Barnes 2014 priority-flood (+ε spill rule, `:34`) → Braun-Willett 2013 receiver/donor → topological flow
  accumulation → stream-power `dz=K·A^m·S^n` (m=0.45, n=1.0) — the Cordonnier 2016 chain. **Every** SOTA pipeline builds
  relief as a PERSISTENT height array uplift writes and erosion subtracts; **no** SOTA pipeline derives relief by
  steering fragment-shader noise with a coarse orientation field (that is an amplification trick that belongs ON TOP of
  a built heightfield, cf. Grenier 2024). WS4 inverted the dependency — used the amplification trick AS the structure —
  which is precisely why it reads as "an orientation overlay." E6 is the weakest link vs "coarse structure drives
  detail" (a director field, not an explicit fault-trace/ridge-line carrier); the slice's win comes mostly from E9
  carving real drainage into a real array.
- **Production / real-time renderers** (`research-production-renderers.md`): Outerra (~150 m cube-face elevation dataset,
  noise amplitude modulated by slope/curvature/elevation derived from the data); **Star Citizen Genesis "shared data
  pool"** (baked global heightmap + Temp/Humidity/Geology/Soil/SlopeAspect maps that DRIVE expression — a near-exact
  mirror of wf2-synthesis §2's substrate; product guarantee: "scout from orbit, appearance won't change on the surface"
  — only possible if the coarse shape is authoritative data); World Orogen (priority-flood + stream-power EDIT a stored
  grid; mesh displaces from it — the relief-slice architecture externally validated down to the algorithm names);
  geometry clipmaps (fractal detail = noise RESIDUAL on upsampled coarse); NMS (density field → voxel volume → polygonize
  — even "everything is a function" commits to an explicit field first).
- **Sphere + GPU feasibility** (`research-sphere-gpu-bake.md`): both deferred gaps have published, in-runtime-feasible
  answers. **FastFlow (Jain 2024)** routes flow in O(log n) / depressions in O(log² n) GPU iterations (512² = 0.1 s for
  700 kyr; 10-Myr landscape 0.5 s implicit), and is **mesh-general** (TINs + grids) — so the flat→sphere port is a
  *mesh-topology* problem, not an algorithm rewrite. A **working browser WebGPU stream-power erosion** exists (GPU-Gang
  port of Schott 2023, 40–80 fps). **Sphere drainage is solved** (Liao 2023 mesh-independent flow direction): express
  relief + drainage over a seamless mesh adjacency graph; on a closed sphere the **ocean basins ARE the outflow sinks**
  (Red Blob: "the river code didn't require any changes to work on spheres"). The **cubemap-seam-lake hazard is a
  graph-adjacency problem, not a hydrology bug** — and the production river router is **already sphere-native and
  seam-free by construction** (production-L1-plan finding #2), so the hazard is smaller than the slice's flat-DEM caveat
  implied.

---

## 6. Architectural options for the path forward

### Option A — Port the validated height substrate into the production renderer (bake + sample height)
**One line:** Reopen decision #6; bake the substrate's `height` (sphere-native) as a sampled field and displace/shade
from it, demoting the grain cube to orienting the *detail residual* on top.
- **Pros:** Directly closes the UAT (matches the slice, every production renderer, and the north star). Reuses machinery
  that already exists (B's `runE6` writes height; B's `sphereField` + C's cube baker already rasterize a per-node field
  into a seam-free cube; the river router is already sphere-native). Sphere/GPU gaps are de-risked by published,
  in-runtime answers (FastFlow, WebGPU port, Liao). Keeps the grain cube — as orientation for detail, where it belongs.
- **Cons:** Real work to bake `height` onto the sphere carrier AND sample it in the shader (the one un-validated
  generalization). Touches the lab shader's height accumulator (medium blast radius, gated by a strength uniform for a
  byte-identical fallback). E9 isn't yet ported to B (only A has hydrology) — the bake path needs the carve, via the
  existing router or a port.
- **Effort:** Medium. **Blast radius:** Medium (lab-only, gated). **Fidelity:** High. **Feasibility:** High (machinery +
  research both in hand).

### Option B — Keep iterating the shader-grain (richer orientation / province amplitude)
**One line:** Stay under decision #6; make the grain carry more (longitudinal structure, province amplitude) and tune
the in-shader combiners to read less like an overlay.
- **Pros:** Lowest blast radius; no new bake/sample path; preserves WS4 as-built.
- **Cons:** **Structurally cannot reach the bar.** The research is unanimous: orientation-steered noise is an
  amplification trick, not a structural carrier; a fragment shader cannot produce a dendritic drainage network or
  plate-shaped macro-structure without a baked field to read. This is re-deciding structure in render — the exact
  inversion the north star forbids. The grain is a pure function of latitude (zero longitudinal structure) by
  construction; enriching it fights its own model. High risk of a second UAT failure after more effort.
- **Effort:** Low–Medium. **Blast radius:** Low. **Fidelity:** Low (cannot satisfy the criterion). **Feasibility:** N/A —
  wrong altitude.

### Option C — Option A **plus** expand E6 from despun-zonal-stress to a one-pass plate-placement model
**One line:** Do Option A, and additionally give E6 (or a sibling engine) a one-shot plate partition + boundary-relief
pass so Earth-like bodies get plate-shaped continents/ranges-at-boundaries/cratons as data.
- **Pros:** Closes BOTH gaps the research names — the substrate-in-renderer gap (A) AND the under-modeled-tectonics gap
  (E6 produces latitude bands, not plates). Matches Cortial/Gainey/Red Blob: a one-pass plate placement (centroids →
  partition → motion → boundary stress → spread to interiors) is fully compatible with "place once, don't time-step."
  Highest fidelity to "you see the body's tectonic history" for the worlds Max's bar names (Earth's continents).
- **Cons:** Largest scope; a plate model is inherently whole-sphere (forces the sphere integration up front); risks
  conflating two decisions (wire-the-substrate vs upgrade-the-tectonic-model) that are better sequenced. The Melosh
  despun-shell model is still the *right* physics for one-plate/icy/despun bodies, so this is an *addition* (regime
  selection: plate vs despun), not a replacement.
- **Effort:** High. **Blast radius:** Medium–High. **Fidelity:** Highest. **Feasibility:** Medium (more research/scoping
  before build).

---

## 7. RECOMMENDATION

**Do Option A now; hold Option C as the sequenced next step after A lands. Do not pursue Option B.**

Reasoning, grounded in the evidence:
- **Option A is the minimum change that moves the UAT criterion.** The criterion is binary at the relief *body*: either
  the low/mid-frequency shape exists as a sampled field, or the shader invents it. Option A makes it a field; B leaves it
  invented. Every source (slice UAT pass, all four research files, the fidelity + direction lenses) converges on "bake
  and sample the height," and the machinery to do it already exists — this is a one-channel decision, not a re-architecture.
- **Option B is ruled out by the research, not by taste.** Orientation-steered noise cannot carry macro-structure or a
  drainage network; iterating it risks a second UAT failure after more effort. The criterion + evidence make this a
  technical call, not a judgment one.
- **Option C is the right *eventual* scope but should not block A.** E6's plate-vs-zonal gap is real and matters for
  Earth-like bodies, but it is a separable upgrade to the BUILD engine; A is valuable on its own (it makes despun/icy/
  lava bodies — which E6 already models well — read as structure-as-data) and de-risks the sphere/GPU path that C also
  needs. Sequencing A → C avoids conflating "wire the substrate the renderer expresses" with "upgrade the tectonic model
  that writes it."

Concretely: **reopen decision #6** as "which channel of the already-built substrate does the renderer express —
orientation-only (current, failed UAT) vs baked height / coarse-amplitude (matches the vision)," and re-scope the
renderer wiring to bake + sample a sphere-native `height` (built by E6, carved by the existing sphere router / a ported
E9), with the grain cube retained as the orientation input to the detail residual on top. Use **FastFlow exact routing**
(not Schott's depression-blind approximation) for the bake, since the host-editor model keeps perturbing the surface
between epochs — the case the approximation breaks on.

---

## 8. Campaign implications (WS1–WS4, WS3 timing, the production-port branch)

- **WS1 (L0 plumbing) — DONE / additive, keep.** Surfaced D12/eccentricity/D13/D16/metallicity + `systemContext` (PG:737–741; SSG:624–679). Honors intent; the remaining defect is **consumption** (surfaced-but-inert), addressed downstream. One correction to carry into any plumbing spec: the D12 hard-zero is `PlanetGenerator.js:613` (literal `0` to `computeSurfaceHistory`), **not** `:565` as spine §4 (`:54`/`:130`) and the brief claim — editing `:565` edits the wrong line.
- **WS2 (Tier-1 base step) — BUILD half complete, VIZ-UAT'd; the bridge to Option A.** It already builds the substrate as data and adds the sphere carrier the slice lacked. **Gap to close for Option A:** it ported only the orientation writer + carrier — there is no `runE6`-into-the-renderer height path and no E9/hydrology in B. Option A's work lands largely here + the renderer wiring.
- **WS4 (relief wiring) — NOT shipped; re-scope, don't discard.** The drainage network routing and the subtractive carve mechanism are sound and reusable; the orientation cube is a legitimate *detail* input. What changes is the **channel**: add a baked height/displacement path (Option A). Reopen decision #6 first.
- **WS3 (type → derived-label demotion) — start the LAB-side now; keep the GAME-shader port deferred.** WS3 F1 (E1 emits a derived label) is foundational and parallelizable (dep graph: `WS1 → WS2 → WS4`, with `WS3 F1` feeding the same renderer step). The lab-side type-as-label is ~80% done and is the real WS3 target. **WS3 F5 (game `Planet.js` type-branch shader demotion) stays OUT** — it is the highest-blast-radius surface (40+ `if(planetType==N)` branches, `_pickType`, `ExoticOverlay` history-erasure) and is correctly deferred to its own workstream (locked LAB-ONLY 2026-06-23). Do NOT block Option A on it; the game port does not gate the lab port.
- **The production-port dedicated branch (per INDEX §1 / production-L1-plan).** The plan's intent — preserve `master`/slice as a clean checkpoint and do the high-blast-radius production-L1 work on a dedicated branch — holds. The current `feature/world-engine-production-L1` branch is that branch; it carries WS1+WS2+WS4 local-only (nothing pushed; push remains Max's HOLD). Option A is the next coherent unit on it. Sequence on-branch: reopen #6 → `dev-collab-scope` the height-substrate-in-renderer wiring → `writing-plans` → build (Option A) → `verify-workstream` → Max UAT. Hold Option C (plate model) as a follow-on scope.

---

## 9. Locked decisions to revisit

- **REVISIT — Max decision #6 ("augment, not replace," production-L1-plan:264).** This is the one locked decision the
  evidence directly indicts. It is internally consistent (WS4 built exactly what #6 specified) but it under-serves the
  deeper §2 substrate lock: it keeps relief height in the shader and shares only orientation, so the UAT result was baked
  into the decision, not discovered in the build. **Recommended re-scope (sharpens, does not contradict, the §2 lock):**
  decide *which channel* of the already-built substrate the renderer expresses — orientation-only (current) vs baked
  height / coarse-amplitude (matches the vision). This is a scope question for Max.
- **FLAG (mid-confidence, surfaced not contradicted) — E6's tectonic model scope.** The locks mandate a despun-shell
  closed-form E6 (wf2 §3) and "place once, don't time-step" (spine §0). The plate-tectonics research shows this produces
  *latitude bands*, not the plate-shaped macro-structure (continents, ranges-at-boundaries, cratons) every Earth-like
  generator treats as load-bearing data — and WS4's intent.md itself names Earth's continental shapes as part of the
  bar. The resolution the references support is a **one-pass plate-placement** model (Gainey/Red Blob do it in one pass,
  no iteration) — fully compatible with "place once." This does NOT break the time-step lock; it asks whether E6's
  *scope* should expand from despun-zonal-stress to (optionally, by regime) one-pass plate placement. Worth confirming
  with Max; not blocking for Option A (Melosh is the right model for the despun/icy bodies A makes shine).
- **The four headline structural locks — HOLD.** Shared mutable relief substrate (§2), host-editor/epoch (spine §3.1),
  Option-A expose+derive (spine §4c), type→derived-label (spine §4b) are corroborated by the slice's UAT pass AND by
  every production renderer + SOTA paper surveyed. None should be revisited.

---

## 10. Open questions for Max (the direction-setting calls that are his, not ours)

1. **Reopen decision #6?** Should the renderer express the substrate's **baked height** (Option A — matches the vision,
   medium blast radius) instead of orientation-only? (Recommendation: yes.)
2. **E6 scope (the §9 mid-confidence flag).** Should E6 stay a despun-shell zonal-stress model (right for icy/despun/
   one-plate bodies, wrong for Earth-like plate worlds), or gain an optional **one-pass plate-placement** path (Option C)
   so continents/ranges-at-boundaries/cratons exist as data for Earth-like bodies? When — now (with A) or sequenced after?
3. **Push the local-only branch?** WS1+WS2+WS4 + the slice are all local (push on HOLD per your 2026-06-23 call). Push
   the checkpoint now, or hold until Option A lands?
4. **WS3 lab-side timing.** Start WS3 F1 (E1 derived-label) in parallel with Option A, or sequence it after the
   height-substrate wiring? (Game-shader demotion F5 stays deferred regardless.)
5. **Bake budget.** Confirm "seconds, not per-frame" per body, and the E9 incision-pass count (lab uses 5) — sets the
   FastFlow iteration budget for the production bake.

---

## 11. Adversarial critique — corrections to fold in BEFORE acting (added 2026-06-25, post-synthesis)

Three independent skeptic lenses (feasibility · direction/sunk-cost · vision-fidelity) all returned **refuted = false** —
the core call (do an **A-family** option, **hold C**, **kill B**) survives, and Option B is ruled out by code + research,
not taste. But all three converged on one finding: **§6–§7 OVER-SELL Option A.** Fold these before scoping. Full lens
detail: `lens-production-port-feasibility.md`, `lens-direction-sunkcost-refutation.md` (+ the vision-fidelity lens in the
run record).

1. **Re-rate Option A → High–Medium effort / Medium–High blast (NOT "Medium / one-channel / machinery exists").** There
   is NO sphere-native HEIGHT writer in the repo: B's `runE6` writes height on a FLAT grid only; the only sphere writer
   (`writeGrainSphere`, tectonic.js:53–63) writes grain/regime, NOT height. E9 is irreducibly flat-grid (seeds the
   priority-flood from the MAP EDGE — a concept that does not exist on a closed sphere — plus Cartesian neighbours +
   latitude-band precip) and has ZERO production copy. So Option A is **two engine re-implementations onto an irregular
   sphere mesh (height + incision)**, not a re-wire. "Machinery already exists" is true only of the orientation/grain
   path that already shipped and FAILED UAT.
2. **The slice's UAT pass does NOT transfer to Option A's UAT (the sunk-cost tell).** The slice passed on **categorical
   body-type divergence** ("they all read as distinct") on a **flat 2D DEM**; WS4 failed on **structure/layout reading as
   a history on a single sphere** — different propositions, different geometry. Worse, the slice's own docs disclaim
   macro-LAYOUT: `relief-presets.js:14–19` ("same seed + different preset = IDENTICAL landform layout, only rescaled")
   and `baseStep.js:68–73` (the macro `thicknessBlob` is **byte-identical across same-class worlds**). Porting that
   height to the sphere ports a **latitude-band + class-keyed-simplex-blob layout** — two rocky worlds could show the
   SAME coarse landmass arrangement. **Rate the aesthetic/UAT risk separately as Medium** — FastFlow/WebGPU de-risk the
   *algorithm*, not whether class-blobs + drainage wrapped on a sphere *reads as a history* to Max.
3. **The cheapest vision-satisfying path was never priced (false trichotomy) — add "A-lite".** Between A (full height
   substrate + E9-on-sphere) and B (iterate the grain) sits the field-standard middle path the research actually
   describes (Cordonnier / geometry-clipmaps / Outerra / SC-Genesis): **bake a COARSE low-frequency ELEVATION / amplitude
   province field — reusing WS4's EXISTING cube-bake machinery (`planet-lod-tectonic.js`) — as a low-frequency
   displacement bias, with detail noise on top.** This commits macro-SHAPE to DATA (passes the north-star channel test)
   WITHOUT re-implementing E9 incision on the sphere. It is structure-as-data, a *different channel* than the orientation
   grain, so it is **NOT Option B**. It may be the minimum change that actually moves the UAT criterion.

**The real crux (promote from §9 "mid-confidence"):** the substrate / host-editor / epoch *discipline* is right and
validated, but **the CONTENT the BUILD engine writes is the unsolved problem** — both the slice and the base step produce
latitude-banded, amplitude-keyed, same-class-identical layout *by their own admission*. Option A relocates that content
to the sphere; it does not by itself make structure *be somewhere meaningful*. The E6 plate-scope question (Option C) is
closer to the crux than A's plumbing.

**Two factual corrections (verified first-hand this session):**
- **D12 line is `PlanetGenerator.js:606–613`, not :565** (spine §4 cite + the brief are wrong; :565 edits the wrong
  line). And the framing is stale: **WS1 already SURFACES a real `tidalHeating` as data** (computed :402, exposed :741);
  the literal `0` at :608 is an intentional, documented WS1-additive choice (consumption deferred to WS2). Remaining
  defect = consumption, not surfacing.
- **Mis-attribution corrected — WS4's UAT bar does NOT include "Earth's continents."** `intent.md:15–16` ("Scope honesty")
  EXPLICITLY defers continental shapes / Sputnik-Planitia to engines NOT in this campaign (E7/E8/E11) and states "WS4's
  UAT judges the grain+drainage read as a coherent step, not the finished planet." Max's *aspirational* bar (intent.md:13)
  names continents; the WS4 *UAT* bar (intent.md:18–21) is "the relief reads as one coherent tectonic system + drainage
  cut into it." **Judge any A / A-lite build against the WS4-scoped bar, not "where are the continents"** — the continents
  question is Option-C / later-engine scope. (This sharpens, not contradicts, §9's E6-scope flag, which remains a
  legitimate *eventual*-vision observation, not WS4's bar.)

**Net:** direction confirmed; before scoping — (a) add the **A-lite** coarse-elevation-bake option; (b) re-rate Option A
honestly and name its AC spine: *sphere height writer · bake + sample + re-point BOTH renderer displacement AND the
river-router height source (a half-move recreates the WS4 data/noise split → silent second UAT failure) · port/graft the
subtractive carve · a seam test as the FIRST AC*; (c) scope the WebGPU FastFlow path OUT of the first build (the CPU
router already routes on a sphere at bake time, "seconds/body"); (d) judge against the WS4-scoped bar.
