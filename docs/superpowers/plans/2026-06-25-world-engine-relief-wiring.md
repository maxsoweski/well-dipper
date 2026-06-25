# WS4 Build Plan — world-engine relief wiring (E6 grain → E9 subtractive carve)

**Workstream:** `world-engine-relief-wiring-2026-06-25` · **Renderer:** LAB ONLY (game `Planet.js` OUT).
**Contract:** `docs/WORKSTREAMS/world-engine-relief-wiring-2026-06-25/contract.json`
**Intent:** `docs/WORKSTREAMS/world-engine-relief-wiring-2026-06-25/intent.md`
**Ground truth:** `docs/WORKSTREAMS/world-engine-relief-wiring-2026-06-25/grounding-dossier.md` (its cites supersede the plan-doc's framing).
**Source section:** `docs/FEATURES/world-engine-production-L1-plan.md` §WS4.

All file:line cites below were re-verified against current code 2026-06-25.

---

## 0. Repo conventions that BITE (read before the first task)

- **Tests run SCOPED, never bare `npm test`.** Bare `vitest run` globs `src/generation/__tests__/KnownObjects.test.js` (`searchKnownObjects`) which is pre-broken → false red. Every gate uses a path-substring invocation:
  - Grain/oracle/carve unit cluster: `npx vitest run tests/planet-lod tests/worldengine tests/world-engine-relief-slice`
  - New WS4 tests live in `tests/` (auto-discovered).
- **No `Date.now` / `Math.random` in derivation code.** The grain path must use only `stressAtLat`/`writeGrainSphere`/`seededUnitVec3`/sin-hash. The GUI `randUnitVec3` (`planet-lod-lab.html:2390`, `Math.random`) must NEVER be the grain source.
- **`src/worldengine/base/` is the production source of E6 math. `src/generation/` stays byte-untouched.** Use the prod `tectonic.js` copy (`stressAtLat:19`, `writeGrainSphere:53`); the lab `relief-e6-tectonic.js` is reference only (two copies → drift risk; consume prod).
- **Live-probe surface is `window._lab`** (`planet-lod-lab.html:5631`), NOT `window.__wd`/`enterSol` (that's the game). Live tests use chrome-devtools against the **:9223 GPU Chrome** (NOT Playwright/CPU); confirm the Vite port via `list_pages` (sandbox curl returns false 000); append `?fresh=1` to lab URLs to stop sessionStorage scenario-restore corrupting A/B captures.
- **Router-lab regression** (`rivers-terrain-lab.html` → `window._rivers.stats`) is LIVE, not vitest. Re-run it ONLY if a task touches `planet-lod-rivers.js`; shader-only edits to `planet-lod-lab.html` are structurally safe from it. **Subtlety (T10):** `buildValleyGeometry` is DOWNSTREAM of `routeAndOrder` — it emits the carve geometry, it does NOT change the routing graph (`receiver`/`accum`/`strahler`/`order`/`isChannel`/`filled`/`surf`). So a `depthAt`→stream-power swap inside `buildValleyGeometry` CANNOT drift `oceanPct`/`maxStrahler`/`orphanPct`/`uphillPct` — those are properties of `routeAndOrder`, which T10 never touches. Re-run the regression after T10 as a SANITY CHECK, not as a gate that could legitimately change.
- **Two facts that bite the harness/sampler tasks (re-verified 2026-06-25):**
  - `createHeightSampler` (`planet-lod-rivers.js:218`) is HARDWIRED to `fragmentShader: HEIGHT_FRAG`, where `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN` (`rivers.js:154`). It has NO param to swap a different `main()`. There is therefore **no existing path that reads back the COMPLETE rendered relief chain** — every `createHeightSampler` readback is the ROUTER_MAIN field (F11/F14 stripped). This forces a decision in D5c (below).
  - `buildIrregularSphere` returns `{ verts, faces, adj }` — NO `pos`, NO `N`. `routeAndOrder` reads `mesh.verts`; `buildValleyGeometry` reads `mesh.pos`/`mesh.N`. In the live path `ensureMesh` (`rivers.js:808-815`) hydrates `mesh.pos` (flat copy of `verts`) + `mesh.N` BEFORE `buildValleyGeometry`. Any synthetic headless harness (T9/T11) MUST replicate that hydration or `buildValleyGeometry` reads `undefined.length` and throws.

---

## 1. Decisions (made now — each justified against Max's bar + the dossier)

These are the 11 forks the dossier flagged. Each is RESOLVED here and shows up as a concrete task.

### D1 — Orchestrator/baker: NEW module `planet-lod-tectonic.js`
Nothing today builds a grain carrier, calls `writeGrainSphere`, or feeds the renderer (only vitest does — dossier risk #1). **Decision:** write `planet-lod-tectonic.js` exporting `bakeTectonicGrain({ mesh, drivers, macroSeed, rotatePoleDeg })` → returns `{ grainAngleSmooth, grainMag, regime, perNodeStrikeWorld }` typed arrays over the SAME `buildIrregularSphere` mesh the router uses (so grain + hydrology share one parameterization by construction). It internally calls the prod `writeGrainSphere` (+ the smooth-director derivation, D3) and the province-composition (D4). This is the net-new glue. → Tasks **T4, T6**.

### D2 — GPU path: BAKE the grain to a sampleable cube (not analytic in-shader)
Grain orientation is pure-latitude, so analytic in-shader re-derivation (option b) would be cheap and seam-free — BUT it cannot carry the macroSeed province composition (D4) that turns zonal bands into 2D landforms, and it would make `bake-once` apply only to the carve. **Decision: option (a) — rasterize the per-node grain into a HalfFloat cube** (reuse the `createCarveCubeMap` pattern, `planet-lod-rivers.js:716`): R,G = smooth strike vector (world-space `cos·east+sin·north`, the two dominant components packed), B = grainMag, A = regime/composed-province term. The shader reads it with one `textureCube` lookup. This satisfies `bake-once` as a REAL artifact, makes the field spatially-composed (D4), and matches the existing carve-cube bake lifecycle so both bakes ride the same `route()` debounce. → Tasks **T7, T8**.

### D3 — Director continuity: re-derive a SMOOTH director, do not read raw quantized {0, π/2}
Raw `grainAngle` is a 2-value director with hard flips at 45°/38.33°/57.69° (dossier risk #3) → reads as banded stripes with seam-smear if the cube interpolates across the flip. **Decision:** derive a continuous strike angle from the CONTINUOUS stress components `sMer`/`sZon` (both exposed by `stressAtLat`): `strikeSmooth = atan2(sMer-sZon-coupled-term)` — concretely a continuous function that → 0 where `|sMer|≫|sZon|` and → π/2 where `|sZon|≫|sMer|`, monotone through the 45° crossover instead of stepping. `grainMag` and `regime` stay as the (continuous / banded) confidence + classification channels. The cube stores the smooth WORLD-space strike vector, so cube interpolation never smears through angles the math never intended. This is the bulk of the new derivation in `planet-lod-tectonic.js`. → Task **T6**.

### D4 — THE BANDING-VS-MAX'S-BAR decision (highest stakes)
Raw grain is latitude-only / longitudinally uniform (`writeGrainSphere` lacks `rotatePoleDeg`; flat `writeGrain` has it — `tectonic.js:53` vs `:35`). Fed raw, it reads as ZONAL STRIPES, not Max's *"distinct landforms playing out across the surface… the way we see on every planet we've observed."* The `one-shared-grain` AC (all features share a strike) and Max's bar (2D landforms, not bands) must BOTH be served.

**HONEST ATTRIBUTION OF THE 2D BURDEN (critics, max's-bar + scope):** Only ONE move below adds within-a-single-body longitudinal structure. State this plainly so the build does not bank on the other two:
- **D3 (smooth director)** is a pure function of `|lat|` (`stressAtLat` takes only `latDeg`). It removes the hard 45° flip but adds ZERO longitudinal variation — the base strike field is horizontal bands by construction.
- **D4 move-2 (`rotatePoleDeg`)** is a SCALAR latitude offset (`lat += rotatePoleDeg`, mirroring `writeGrain:38`). Within one body it slides every band by the same constant — bands stay horizontal, just relocated. It is **inter-body variety ONLY**; it contributes NOTHING to the single-disk UAT (`landscape-with-history`, which judges ONE built world). It is NOT a per-body band-tilt. (Real per-body band tilt would require rotating the sampling pole about a macroSeed-hashed axis before `stressAtLat` — a larger change than the advertised 1-liner, OUT of WS4 scope; do not silently expand move-2 into it.)
- **100% of the within-body 2D-not-bands burden is on D4 move-1 (province modulation).** If move-1 underdelivers there is no fallback, so move-1 must be built on a field that JS and the shader genuinely share.

**Decision — the composition, gated by `uTectonicGrainStrength`:**
1. **Compose grain ORIENTATION with `gProvince`'s 2D placement — IN-SHADER, not via a JS mirror.** *(Critics, feasibility + max's-bar, both HIGH.)* The original plan baked a JS-side mirror of `initProvinces` into the cube. That is UNBUILDABLE correctly: `initProvinces` (`planet-lod-height.glsl.js:797`) uses bespoke GLSL `noised()`/`hash3` (`fract(sin(·)*43758.5453)` float32, height.glsl.js:615-633), seeded by `uMacroOffset`. WS2/the carrier use a DIFFERENT noise (`simplex-noise` + `alea`, `tectonic.js:6`). There is no JS port of the GLSL recipe, and `simplex-noise` will NOT reproduce the float32 sin-hash partition (a 1e-4 input delta swings the hash by ~0.7 → full decorrelation). A JS-baked province field would key orientation to province boundaries that do NOT coincide with the `gProvince` masks the shader actually renders → orientation points one way while the landform it organizes sits elsewhere — the OPPOSITE of "features share a cause", and it passes every strength=0 byte-identical test silently.
   **So:** the cube stores ONLY the smooth WORLD-space strike vector + grainMag + regime (the genuinely shared, latitude-derived field). The province MODULATION of strike happens **in the combiner shader**, where the REAL `gProvince` already lives: each grained combiner samples the cube for its base strike at `vPos`, then rotates/biases that strike by the in-fragment `gProvince` (e.g. a province-keyed rotation `θ += k * (gProvince.x - 0.5)` or a province-selected blend between the cube strike and a province-aligned strike). Province placement (2D, macroSeed-driven) and grain orientation are thus composed against the SAME `gProvince` the renderer uses — single source of truth on the GPU, no duplicate-derivation hazard. → composition lands in **T6** (cube = strike-only) + **T13** (in-shader province rotation in each combiner).
2. **Add a small per-body grain rotation** — a minimal WS2 addition of `rotatePoleDeg` to `writeGrainSphere` (it already exists on flat `writeGrain`; re-verified `writeGrainSphere:53` reads `latDegOf(i)` exactly ONCE at line 56, so the change is a 1-line signature + `lat = latDegOf(i) + rotatePoleDeg`). The bake passes `rotatePoleDeg = f(macroSeed)` so different worlds get different band placement (inter-body only, per the attribution above). The new arg DEFAULTS to 0, so the 2-arg `writeGrainSphere(carrier, drivers)` callers (`tests/worldengine-base-seam.test.js`, `tests/worldengine-base-verify.test.js`) stay byte-identical. → Tasks **T2 (WS2 rotatePoleDeg), T6 (cube strike), T13 (in-shader province rotation)**.

### D5 — Carve subtractive reality (four sub-gaps reconciled)
The carve already lowers `h` (`planet-lod-lab.html:424` — dossier corrects the "cosmetic" framing). The real gaps:

**D5-pre — THE OPERAND PROBLEM (critics, ALL FIVE converge; feasibility+test-validity BLOCKER).** The original plan asserted `carved[i] <= authored[i] ∀i` over `buildValleyGeometry`'s output. **That output does not exist as a per-node height array.** `buildValleyGeometry` (`rivers.js:595`) returns a `THREE.BufferGeometry` of 3-rail valley STRIPS whose `aDepth` is a POSITIVE tent (`[0, depthAt, 0]` per L/C/R rail, `vDepth.push(0.0, spts[k].d, 0.0)`, line 667) on NEW strip vertices that don't map 1:1 to mesh nodes. The actual height drop is computed ONLY in the SHADER (`h -= carveDepth*uRiverCarveDepth`, lab.html:424). `routeAndOrder` returns `filled` (priority-flood — `filled[i] ≥ height[i]`, it RAISES) and the `surf` CLOSURE — neither is a `carved[i]`. So there is NO importable pure function that returns `carved[i]`, and `carved[i] <= authored[i]` has no operand.
  **Decision:** scope a NEW exported pure helper in `planet-lod-rivers.js`:
  > `perNodeIncision({ mesh, routed, authored, params }) → Float32Array Δ` (length N, every Δ[i] ≤ 0), the per-mesh-node incision the carve applies. It computes the stream-power law (D5b) per channel node and 0 elsewhere. This is the SINGLE SOURCE of carve depth: `buildValleyGeometry`'s per-rail `aDepth` and the cube's R channel both DERIVE from `-Δ[i]` (so the unit and the rendered cube agree by construction, not by coincidence). The `carve-subtractive` unit asserts `authored[i] + Δ[i] ≤ authored[i] + 1e-9 ∀i` (i.e. `Δ[i] ≤ 0`) over THIS helper — a real, falsifiable operand. → Tasks **T9, T10**.

- **(a) Two height fields.** Router routes on `ROUTER_MAIN` (`planet-lod-rivers.js:113`, F11/F14 stripped) ≠ rendered `h`. **Decision:** the `carve-subtractive` UNIT AC is proven over the ROUTER's OWN field (`authored` = the height the router actually routed on) via `routeAndOrder` → `perNodeIncision`. That is the substrate the carve is subtractive *over*. The render-side reconciliation (carve sits in the same relief that was built) is NOT claimed by the unit — it is the `epoch-carve-visible` LIVE AC's job (sub-gap c). So: subtractive-ness of the LAW is a unit property (over the routed substrate); the rendered carve-into-the-same-relief is a LIVE property. The plan does NOT claim the two GPU fields are equal. → Tasks **T9, T12**.
- **(b) Stream-power depth, not Strahler tent.** `depthAt(order)` (`buildValleyGeometry:607`, called at :697 — note: the plan formerly cited :614, the real `depthAt` def is :607) is a geometric tent keyed off Strahler order, unrelated to A or S magnitude. **Decision:** `perNodeIncision` implements `Δ = -K·A^m·S^n` (A = `accum[i]`, S = local downslope gradient from `routed.surf`/`routed.filled` against `mesh.adj` neighbours — `surf` is the CLOSURE `(i)=>filled[i]+gradOff[i]`, line 351, so slope = max over neighbours of `(surf(i)-surf(nb))/dist`). **Range guard (critic, feasibility medium):** the cube R channel is HalfFloat and `uRiverCarveDepth` expects depth ∈ the established `[VALLEY_DEPTH_LO 0.45 .. HI 1.0]` band. `perNodeIncision` MUST normalize/clamp `|Δ|` into that band (so deep trunks don't clip the HalfFloat cube or blow the carve budget); add a unit assert that `max |Δ|` stays within range. Keep the old tent reachable behind a `params.LEGACY_DEPTH` flag for A/B. **Default depth law in the shipped path = stream-power** (the LEGACY tent is the flag, not the default); note that this changes river APPEARANCE vs the 2026-06-19 shipped rivers — adjacent to (but not reopening) the "WS4 does not change river scale/water-fill" boundary; flagged for Max in openForMax. → Task **T10**.
- **(c) No epoch snapshot — and the rendered-chain readback DOES NOT EXIST.** *(Critic, feasibility BLOCKER.)* Build+carve interleave one-pass. The original plan said "add a SECOND `createHeightSampler` over the COMPLETE combiner chain (NOT ROUTER_MAIN)". **`createHeightSampler` is hardwired to `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN` (rivers.js:154/235) — it has no param to swap a non-ROUTER_MAIN `main()`, so there is no existing path that reads back the full rendered chain.** Building one means net-new shader surgery (extract a `BUILD_MAIN` frag = the rendered relief chain truncated BEFORE the Stage-3 carve and Stage-4 F14 cut, give `createHeightSampler` a `fragmentShader` param, and prove `BUILD_MAIN` byte-matches the rendered `h` up to that seam).
  **Decision (the smaller, honest path — confirm with Max, openForMax):** do NOT build a second rendered-chain sampler in WS4. Define `heightAfterBuild` for the unit/epoch reasoning AS the routed-substrate `authored` field (the ROUTER_MAIN readback the router already takes). The `epoch-build-identical` UNIT AC then proves a NARROW but real property: the JS carve pass operates on an IMMUTABLE COPY of `authored` (no in-place mutation of the build snapshot) and `Δ ≤ 0` everywhere. The render-side "epoch 1 is the uncut relief" claim is proven ONLY by the LIVE `epoch-carve-visible` AC via a height READBACK at valley directions (see T12). We accept that D5a's two-GPU-field reconciliation is unprovable on the GPU within WS4 and rest the epoch-build claim on the JS unit + the live readback. (If Max wants the full rendered-chain snapshot, that is a scoped add-on task: `BUILD_MAIN` extraction + `createHeightSampler(fragmentShader)` param + a byte-match proof — call it T12b, deferred unless greenlit.) → Tasks **T11 (unit, immutable copy), T12 (live readback)**.
- **(d) `reliefGate` non-monotone — and it lives ONLY in the shader.** `reliefGate` (`planet-lod-lab.html:421`) = `1 - smoothstep(...aboveSea...)` where `aboveSea = max(0, h - uSeaLevel)` and `h` is the SHADER's accumulated per-fragment height — a field the JS routed substrate CANNOT observe. *(Critics, determinism+test-validity: the original "the unit AC asserts this algebraically" conflates two height fields.)* **Decision:** the unit does NOT witness `reliefGate`. The unit proves only that the carve LAW is subtractive on the routed substrate (`Δ ≤ 0`). `reliefGate ∈ [0,1]` multiplies an already-≤0 Δ in the shader, so it can never ADD height — but that monotonicity-of-the-gated-carve is a RENDERED property, proven by the LIVE `epoch-carve-visible` AC (T12 samples valley pixels on high ground vs lowland: the carve fades but never raises h). Drop all "reconciled algebraically in the unit" language. → Tasks **T9 (law sign, unit), T12 (gated carve, live)**.

### D6 — `uTectonicGrainStrength` fallback (lands EARLY, de-risks regression)
Does not exist anywhere (grep confirmed zero hits). **Decision:** add `uTectonicGrainStrength {value:0.0}` to `planet-lod-uniforms.js` (beside the axes, ~:147-212).

**NaN-guard the strength-0 path — make it a TRUE byte-identity, not "mix to 0".** *(Critics, determinism+test-validity, both MEDIUM — this is the load-bearing fallback every later task inherits.)* The grain cube (`uTectonicGrainCube`) defaults `null` (T3) and the combiner mix lands (T5) BEFORE the cube is baked (T7/T8). Sampling a null/uninitialized `samplerCube` is undefined; if it returns NaN, then `grainStrike*0.0 = NaN` and `oldAxis + NaN = NaN` — the fallback is NOT byte-identical and every combiner inherits the bug. **Two-part fix:** (1) the combiner construction BRANCHES so strength==0 never touches the cube — `vec3 ax = uTectonicGrainStrength > 0.0 ? normalize(mix(oldAxis, sampleGrainStrike(vPos), uTectonicGrainStrength)) : normalize(oldAxis);` — so at strength 0 the ORIGINAL `normalize(oldAxis)` instruction stream runs verbatim (no cube fetch, no mix, no precision drift); (2) belt-and-braces, init `uTectonicGrainCube` to a 1×1 finite-valued cube (not `null`) so even an accidental sample is finite. T5's RED asserts byte-identity with the cube STILL null, catching the NaN path before T7. With the branch, `grain-zero-identical`'s live A/B is **exact-equal on the capture** (not "within tolerance"), because the strength-0 path is bytewise the pre-WS4 shader.

Route EVERY grained combiner through that branch-guarded mix. This is the FIRST built thing after the harness, so every later task is regression-guarded. → Tasks **T3, T5, T13**.

### D7 — The full replace-set (all 7 sites + reroll buttons)
Six combiners + six `deriveUniforms` hashes + one primitive + the GUI reroll. Missing one fails `one-shared-grain`. **Decision — the exact set (re-verified):**
| combiner (shader) | line | derivation (lab-core) | line |
|---|---|---|---|
| `fbmdRidged` `normalize(uOrogenyAxis)` (vec2) | `planet-lod-height.glsl.js:881` | `orogenyAxis` | `planet-lod-lab-core.js:662` |
| `canyonCombiner` `normalize(uChasmaAxis[i])` | `:1917` | `chasmaAxes` (×3) | `:685` |
| `scarpCombiner` `normalize(uScarpAxis)` | `:1955` | `scarpAxis` | `:707` |
| `tesseraCombiner` `normalize(uTesseraAxis[0/1])` | `:2102/:2110` | `tesseraAxes` (×2) | `:725` |
| `lavaPlainsCombiner` `normalize(uLavaAxis)` | `:2189` | `lavaAxis` | `:772` |
| `cryoRidgeCombiner` `normalize(uCryoRidgeAxis0/1)` | `:2621/:2631` | `cryoRidgeAxes` (×2) | `:888` |
| primitive | — | `seededUnitVec3` | `:483` |

**OROGENY IS A vec2 SPECIAL CASE — not "one of the other five".** *(Critics, feasibility concern + determinism low.)* `fbmdRidged` reads `uOrogenyAxis` as a **vec2 (xz-plane)** (`height.glsl.js:881`), while the grain cube stores a vec3 world strike and the other five combiners read vec3 axes. The uniform `mix()` pattern does NOT transfer directly: orogeny needs an explicit vec3→vec2 projection (project the cube's world strike onto the xz-plane: `vec2 g = normalize(grainStrike.xz)`, then `mix(uOrogenyAxis, g, strength)`). T13 MUST name this projection and confirm mountains stay co-oriented with the five vec3 features under the shared grain. At strength=0 byte-identity holds regardless (`mix(vec2,vec2,0)=vec2`).

**ALL FOUR grained-axis rerolls must be gated — NOT just `randUnitVec3` callers.** *(Critics, determinism HIGH + scope HIGH — re-verified in code.)* The reroll surface is per-feature, not one helper:
- **orogeny `:3715`** writes `state.orogenyAngle = Math.random()*2π - π` **directly** (NOT via `randUnitVec3`); `applyDrivers:5423` converts it to `uOrogenyAxis`. This is the leak the original T14 MISSED — and orogeny/mountains is the feature Max names FIRST.
- **chasma `:3728`**, **scarp `:3743`**, **tessera `:3769`** — these DO call `randUnitVec3` (`:2390`).
- **RECORD (in T14's favor):** **lava `:3801`** and **cryo `:3825`** reroll only OFFSETS (`lavaOffset`/`cryoRidgeOffsetV`), never their AXES — re-verified. `lavaAxis`/`cryoRidgeAxis0/1` come solely from the seed-derived `applyDrivers` path, so they need NO reroll gate.

Gate exactly these FOUR axis rerolls (orogeny, chasma, scarp, tessera) when `uTectonicGrainStrength>0`. → Tasks **T13 (vec2 projection + five vec3 combiners), T14 (four reroll gates)**.

### D8 — Headless carve harness: feed a SYNTHETIC height array into `routeAndOrder` (with mesh HYDRATION)
`createHeightSampler`/`createRiverOverlay` need WebGL RTT; `routeAndOrder`/`perNodeIncision`/`buildValleyGeometry` are PURE + importable (confirmed: `tests/planet-lod-rivers-carve-channels.test.js` already hand-builds a routed graph). **Decision:** the `carve-subtractive` + `epoch-build-identical` UNIT ACs feed a synthetic height array + a `buildIrregularSphere` mesh directly into `routeAndOrder` → `perNodeIncision` (bypass the GPU sampler entirely).

**MESH HYDRATION IS MANDATORY in the harness — `buildIrregularSphere` is NOT enough.** *(Critics, feasibility medium + test-validity high — re-verified.)* `buildIrregularSphere` returns `{ verts, faces, adj }` with NO `pos`, NO `N`. `routeAndOrder` reads `mesh.verts`; `buildValleyGeometry` reads `mesh.pos` (flat Float32) + `mesh.N`. The live path bridges this in `ensureMesh` (`rivers.js:808-815`). The harness MUST replicate it BEFORE calling `buildValleyGeometry`/`perNodeIncision`:
```js
const mesh = buildIrregularSphere(TARGET_N, LLOYD);
mesh.N = mesh.verts.length;
mesh.pos = new Float32Array(mesh.N * 3);
for (let i = 0; i < mesh.N; i++) { mesh.pos[i*3]=mesh.verts[i][0]; mesh.pos[i*3+1]=mesh.verts[i][1]; mesh.pos[i*3+2]=mesh.verts[i][2]; }
```
Without this the harness throws `Cannot read properties of undefined (pos.length)` — a HARNESS bug masquerading as RED (false-red a careless GREEN could "fix" without touching the feature). Factor the hydration into an exported helper if it recurs. Assert `Δ[i] ≤ 1e-9 ∀i` (i.e. `carved ≤ authored`) over `perNodeIncision`, `routed.uphill===0`, `routed.orphan===0` off the routed graph's own fields (`landCount`/`uphill`/`orphan` confirmed at `planet-lod-rivers.js:379/396/398`). → Tasks **T9, T11**.

### D9 — Seed coherence: grain consumes macroSeed
`gProvince` is seeded by `uMacroOffset` (from `macroSeed`, `initProvinces:797`); per-feature axes use a different `d.seed`. For grain to co-orient with the province partition (D4), the grain derivation MUST consume macroSeed. **Decision:** `bakeTectonicGrain` takes `macroSeed` (the same value feeding `uMacroOffset`) and the province composition reads it; `rotatePoleDeg = f(macroSeed)`. Confirmed wireable — `applyDrivers` already has macroSeed in scope at the axis-write block. → Task **T6**.

### D10 — E6 math source of truth: the PROD WS2 copy
Two copies (`relief-e6-tectonic.js` lab + `src/worldengine/base/tectonic.js` prod). **Decision:** `bakeTectonicGrain` imports `stressAtLat`/`writeGrainSphere`/band constants from `src/worldengine/base/tectonic.js` (the prod copy — has the sphere path + exported `REGIME_BAND_DEG`/`GRAIN_BAND_DEG`). The lab module is reference only. The `grain-oracle` AC reuses the prod `tests/worldengine-base-tectonic.test.js` oracle (already pins equator→thrust / mid→strike-slip / pole→normal). → Tasks **T1, T6**.

### D11 — Contract-wording correction (recorded here; Synthesis patches the contract)
`architecturalConnections.outputs` says "replaces per-feature axis hashing at `initProvinces:797` / `fbmdRidged:880`" and `renderer-expression-only` references the "initProvinces / fbmdRidged paths." This CONFLATES two mechanisms: `initProvinces` carries AMPLITUDE (`gProvince`), which Max decision #6 says AUGMENT/keep. **Precise restatement (for Synthesis to patch into the contract):**
> The shader stops deriving STRIKE/ORIENTATION for grained features. The replace-set is the SIX combiner axis reads (`fbmdRidged:881`, `canyonCombiner:1917`, `scarpCombiner:1955`, `tesseraCombiner:2102/2110`, `lavaPlainsCombiner:2189`, `cryoRidgeCombiner:2621/2631`) + their SIX `deriveUniforms` hashes + the `seededUnitVec3:483` primitive + the GUI reroll path. **`initProvinces:797`, `gProvince:796`, and `provinceWeight:811` are explicitly PRESERVED** (amplitude, augmented behind `uProvinceWeight`, not replaced).
This is a documentation task, not a code task. → Task **T16**.

---

## 2. Task order (rationale)

Byte-identical fallback FIRST (de-risks every later edit) → grain derivation + oracle → consumption `mix()` wiring → carve stream-power + epoch RTT → bake lifecycle → audit/doc. Each task = RED test → GREEN minimal impl → VERIFY, mapped to AC id(s).

---

## 3. Tasks

### T1 — Pin the E6 grain oracle ON THE SPHERE CARRIER (net-new coverage, not "reuse")
**AC:** `grain-oracle` (unit).
**HONESTY (critic, test-validity medium):** `tests/worldengine-base-tectonic.test.js` exercises `stressAtLat` + the FLAT `writeGrain` (row-quantized substrate). `writeGrainSphere` over a `buildIrregularSphere` carrier (continuous Fibonacci latitudes, NOT row-quantized) has effectively ZERO direct regime/grain-band coverage outside the seam test's continuity check. So T1 is the FIRST test of the sphere writer's per-node regime correctness — frame it as net-new, NOT "passes immediately, math exists". Band-boundary aliasing on the irregular mesh near 38.33/45/57.69 is genuinely unverified until this lands.
- **RED:** add `tests/ws4-grain-oracle.test.js` importing `stressAtLat`/`writeGrainSphere`/`REGIME_BAND_DEG`/`GRAIN_BAND_DEG` from `src/worldengine/base/tectonic.js` + `makeSphereField` + `buildIrregularSphere`. Assert (neutral drivers `{despinAmp:1,radialStrainSign:1,radialStrainMag:0}`): `stressAtLat(0).regime===THRUST`, `(48)===STRIKESLIP`, `(85)===NORMAL`; `grainAngle(30)===Math.fround(π/2)`, `(60)===0`; contraction bias `(50,+1,0.3).regime >= (50,-1,0.3).regime`. **Sphere-carrier per-node regime:** build the carrier, `writeGrainSphere(carrier, drivers)`, pick nodes whose `latDegOf(i)` lands near 0 / 48 / 85 AND just inside/outside each band boundary (38.33±, 57.69±, 45± for the grain flip), assert `carrier.regime[i]`/`grainAngle[i]` match the oracle band at those read-back latitudes. **Determinism:** run `writeGrainSphere` twice over the same carrier, assert byte-identical arrays. RED until the import path + carrier wiring exist.
- **GREEN:** no production change to the MATH — this task PROVES + pins the sphere source of truth. If the carrier import reveals a gap, fix the import only.
- **VERIFY:** `npx vitest run tests/ws4-grain-oracle`.

### T2 — Add `rotatePoleDeg` to `writeGrainSphere` (minimal WS2 addition — a deliberate PROD touch)
**AC:** `grain-oracle` (must stay green), enables inter-body variety (NOT per-body 2D — see D4).
**SCOPE FLAG (critic, test-validity concern):** WS4's header says "LAB ONLY", but T2 is a 1-line edit to `src/worldengine/base/tectonic.js` (PROD worldengine math, outside `src/generation/` so the byte-untouched constraint holds). This is a DELIBERATE WS2 addition, flagged for Max. It is safe because `rotatePoleDeg=0` ⇒ `lat` unchanged ⇒ byte-identical, and `writeGrainSphere:53` reads `latDegOf(i)` exactly ONCE (line 56, re-verified), so it threads in one site.
- **RED:** in `tests/ws4-grain-oracle.test.js` add: `writeGrainSphere(carrier, drivers)` (2-arg) byte-identical to `writeGrainSphere(carrier, drivers, 0)` (explicit 0); `writeGrainSphere(carrier, drivers, 30)` differs (pole obliquity relocates the bands). RED because the 3rd arg doesn't exist yet.
- **GREEN:** `src/worldengine/base/tectonic.js:53` — add `rotatePoleDeg = 0` param; `const lat = carrier.latDegOf(i) + rotatePoleDeg;`. Two-line change mirroring flat `writeGrain:38`.
- **VERIFY (the SEAM test is the real determinism guard — NOT the flat-writer tectonic test):** *(critic, determinism medium — re-verified: the 2-arg `writeGrainSphere` callers are `tests/worldengine-base-seam.test.js` + `tests/worldengine-base-verify.test.js`; `worldengine-base-tectonic.test.js` calls the FLAT `writeGrain`, so it does NOT guard the sphere signature.)* Run `npx vitest run tests/ws4-grain-oracle tests/worldengine-base-seam tests/worldengine-base-verify tests/worldengine-base-tectonic`. **Seam continuity (same-latitude off-band neighbours agree) is the property that catches a botched `rotatePoleDeg` thread** — it must stay green.

### T3 — Add `uTectonicGrainStrength` uniform + grain-cube sampler uniforms (fallback scaffolding, EARLY)
**AC:** `grain-zero-identical` (foundation).
- **RED:** add `tests/ws4-uniforms.test.js` importing `makeUniforms` from `planet-lod-uniforms.js`; assert `uTectonicGrainStrength.value === 0.0` and the grain-cube sampler uniform exists with a null/placeholder default. RED (absent).
- **GREEN:** `planet-lod-uniforms.js` ~:147 region — add `uTectonicGrainStrength: { value: 0.0 }` + `uTectonicGrainCube: { value: null }`. No combiner reads them yet → zero behavioral change.
- **VERIFY:** `npx vitest run tests/ws4-uniforms`. (No GPU; shader untouched ⇒ grain-zero-identical trivially holds at this step.)

### T4 — Scaffold `planet-lod-tectonic.js` orchestrator (empty contract + pure helpers)
**AC:** scaffolding for `grain-oracle`, `one-shared-grain`, `bake-once`.
- **RED:** add `tests/ws4-tectonic-module.test.js` importing `{ bakeTectonicGrain, smoothStrikeAngle }` from `planet-lod-tectonic.js`; assert exports are functions and `bakeTectonicGrain` over a tiny mesh returns the documented array shape (`grainAngleSmooth`, `grainMag`, `regime`, `strikeWorldX/Y/Z` length N). RED (module absent).
- **GREEN:** create `planet-lod-tectonic.js` with the function signatures + the `buildIrregularSphere`→`makeSphereField`→`writeGrainSphere` chain wired but the smooth-director + composition stubbed to identity (returns raw quantized angle). Module exists, shape correct, NO behavioral wiring to the renderer yet.
- **VERIFY:** `npx vitest run tests/ws4-tectonic-module`.

### T5 — Wire the BRANCH-GUARDED grain mix into ONE combiner (scarp) as the pattern (proves byte-identical fallback)
**AC:** `grain-zero-identical` (integration, live), `one-shared-grain` (partial).
- **RED (live):** baseline capture of the lab planet on :9223 (`?fresh=1`, grain absent, `uTectonicGrainCube` STILL null). Then add the branch-guarded grain read to `scarpCombiner:1955`. RED proof = with strength at 0 AND the cube null, the A/B capture must be EXACT-equal; if the branch leaks a cube fetch or a `mix` that perturbs the strength-0 instruction stream, it fails (the NaN-from-null-cube path, D6).
- **GREEN (branch, not bare mix — D6):** `scarpCombiner` —
  `vec3 ax = uTectonicGrainStrength > 0.0 ? normalize(mix(uScarpAxis, sampleGrainStrike(vPos), uTectonicGrainStrength)) : normalize(uScarpAxis);`
  At strength=0 the ORIGINAL `normalize(uScarpAxis)` runs verbatim — no cube fetch, no mix, no precision drift → true byte-identity even with the cube null. (`sampleGrainStrike(vPos)` = one `textureCube(uTectonicGrainCube, normalize(vPos))` unpack to a world strike vec3.)
- **VERIFY (live, :9223 chrome-devtools):** A/B capture strength=0 vs pre-WS4 baseline → **EXACT-equal** on the capture (tolerance = 0; the strength-0 path is bytewise the pre-WS4 shader, per D6 — this is the resolution of the "byte-identical vs within-tolerance" ambiguity the critic flagged); probe `_lab.uniforms.uTectonicGrainStrength.value===0`. This is the FALLBACK GATE landing early — every later combiner edit repeats this proven branch pattern.

### T6 — Smooth director + per-body obliquity → STRIKE-ONLY cube field in `planet-lod-tectonic.js`
**AC:** `grain-oracle` (determinism), `one-shared-grain`.
**KEY CHANGE FROM THE ORIGINAL PLAN (D4):** the cube carries ONLY the smooth world-space strike + grainMag + regime. The province modulation does NOT happen here (no JS mirror of `initProvinces` — the noise functions don't match, see D4); it happens in-shader against the real `gProvince` (T13). So T6's job is the smooth director + the strike-world conversion + per-body obliquity, all latitude-derived + macroSeed-rotated.
- **RED:** in `tests/ws4-tectonic-module.test.js`: (1) `smoothStrikeAngle(sMer, sZon)` is CONTINUOUS — assert no jump > ε across the 45° crossover (sample lat 44.9 vs 45.1, world-strike vectors within a small angle, NOT a π/2 step); (2) determinism — same `(drivers, macroSeed, rotatePoleDeg)` → byte-identical output; (3) `rotatePoleDeg = f(macroSeed)` shifts the band placement (different macroSeed → different strike at the same lat) — this is the INTER-BODY variety check, NOT a within-body longitudinal check (D4: move-2 is inter-body only); (4) `Math.random`/`Date.now` absent (source grep assertion + a stubbed-global guard). RED on (1) (currently identity stub).
- **GREEN:** implement `smoothStrikeAngle` from continuous `sMer`/`sZon` (monotone through 45°, → 0 / → π/2 at the extremes); convert to world-space strike via `carrier.tangentFrameAt(i)` (`cos(angle)*east + sin(angle)*north`); pass `rotatePoleDeg = f(macroSeed)` to `writeGrainSphere` (re-derive the offset from the INTEGER macroSeed via the same sin-hash `seedOffset` recipe, NOT by reading `uMacroOffset.value` post-hash — else the two are one transform apart, D9). Output `{ strikeWorldX/Y/Z, grainMag, regime }` per node. Pure (`seededUnitVec3`/sin-hash); no rng.
- **VERIFY:** `npx vitest run tests/ws4-tectonic-module tests/ws4-grain-oracle`.

### T7 — Bake the composed grain to a HalfFloat cube (GPU path, D2)
**AC:** `bake-once` (foundation), `one-shared-grain`.
- **RED:** add `tests/ws4-grain-cube.test.js` — a headless build of the cube-update geometry from the per-node strike arrays (mirror `tests/planet-lod-rivers-carve-channels.test.js`'s geometry-level assertions: the rasterized cube faces carry the strike vector at sampled directions, regime in A). RED (no cube builder).
- **GREEN:** in `planet-lod-tectonic.js`, add `buildGrainCubeGeometry({ mesh, strikeWorld, grainMag, regime })` + reuse the `createCarveCubeMap` HalfFloat-cube pattern (`planet-lod-rivers.js:716`) for `createGrainCube`. R,G = strike.xy (dominant world components), B = grainMag, A = regime/province term. MAX/last-write blend, no depth test (same as carve cube).
- **VERIFY:** `npx vitest run tests/ws4-grain-cube`.

### T8 — Bake host: derive + bake the grain cube in `applyDrivers`/`route` once per body
**AC:** `bake-once` (integration, live).
- **RED (live):** instrument a bake counter on the grain bake. RED proof = camera/time change must NOT increment it; seed/preset/sea change MUST.
- **GREEN:** call `bakeTectonicGrain` + `createGrainCube.update` from the once-per-body bake site — inside `createRiverOverlay.route()` (`planet-lod-rivers.js:821`) so it inherits the `ensureNetworkRouted`/`riverRerouteDebounced` 220ms once-per-(preset,seed,sea) cadence (`planet-lod-lab.html:~3528/~3649`). Push `uTectonicGrainCube`. macroSeed read from the same scope as `uMacroOffset` (D9).
- **VERIFY (live, :9223):** change camera/time → bake counter unchanged; change seed/preset/sea-level → counter increments by 1; within budget (~5 incision passes baseline, documented tunable per intent §Decisions).

### T9 — `perNodeIncision` — the real carve operand (synthetic-mesh UNIT harness, D5-pre + D8)
**AC:** `carve-subtractive` (unit), `epoch-build-identical` (partial).
**This task BUILDS the operand the carve-subtractive AC asserts over.** Per D5-pre, `buildValleyGeometry` returns STRIP geometry (positive `aDepth` tent), not a per-node carved array — so `carved[i] <= authored[i]` had no operand. T9 introduces the missing pure helper.
- **RED:** add `tests/ws4-carve-subtractive.test.js`. Build + **HYDRATE** a `buildIrregularSphere` mesh (replicate `ensureMesh`: set `mesh.N` + flat `mesh.pos` from `mesh.verts`, per D8 — else `buildValleyGeometry`/`perNodeIncision` throw). Synthesize an authored height array (a smooth bumpy field) + ocean mask. Feed into `routeAndOrder` → `perNodeIncision({ mesh, routed, authored, params })`. Assert: every `incision[i] <= 1e-9` (i.e. `authored[i] + incision[i] <= authored[i] + 1e-9 ∀i`); `routed.uphill===0`, `routed.orphan===0` (off the routed graph's own counters); `max |incision|` stays within the cube depth band (the HalfFloat/`uRiverCarveDepth` range guard, D5b). RED until `perNodeIncision` exists (import throws) and until the law's sign is enforced.
- **GREEN:** add `export function perNodeIncision({ mesh, routed, authored, params })` to `planet-lod-rivers.js` returning a `Float32Array(N)` of Δ ≤ 0 (stream-power on channel nodes per T10, 0 elsewhere, normalized/clamped into the cube depth band). `buildValleyGeometry`'s per-rail `aDepth` and the cube R channel both DERIVE from `-incision[i]` so unit + rendered share ONE source. Do NOT assert `reliefGate` here (it's a rendered-only field, D5d → live AC).
- **VERIFY:** `npx vitest run tests/ws4-carve-subtractive`.

### T10 — Stream-power law `Δ = -K·A^m·S^n` inside `perNodeIncision` (replace the Strahler tent, expose slope S)
**AC:** `carve-subtractive`, `router-zero-drift` (invariant by construction — see below), `epoch-carve-visible`.
**`perNodeIncision`/`buildValleyGeometry` are DOWNSTREAM of `routeAndOrder` — they cannot drift the router metrics.** *(Critic, feasibility medium.)* The routing graph (`receiver`/`accum`/`strahler`/`order`/`isChannel`/`filled`/`surf`) is produced by `routeAndOrder`, which T10 does NOT touch. The stream-power swap changes only the emitted DEPTH (geometry, downstream). So `oceanPct`/`maxStrahler`/`orphanPct`/`uphillPct` are structurally invariant — the router-lab re-run is a SANITY CHECK, not a gate that could legitimately move.
- **RED:** in `tests/ws4-carve-subtractive.test.js` add: incision at a high-`accum`/high-slope node is DEEPER (more negative) than at a low-`accum`/low-slope node (the tent only depended on Strahler order — this asserts dependence on A and S magnitude). RED (tent ignores A/S).
- **GREEN:** in `perNodeIncision`, compute `Δ[i] = -K * pow(accum[i], m) * pow(slope[i], n)` on channel nodes, where `slope[i]` = max over `mesh.adj[i]` of `(surf(i)-surf(nb))/dist(i,nb)` using `routed.surf` (the closure `(i)=>filled[i]+gradOff[i]`, line 351) — NOT a `surf` array. K/m/n named DEFAULT_PARAMS tunables. **Normalize/clamp `|Δ|` into `[VALLEY_DEPTH_LO..HI]`** so deep trunks don't clip the HalfFloat cube (D5b range guard). `params.LEGACY_DEPTH` flag keeps the old tent reachable for A/B. **DEFAULT = stream-power** (LEGACY is the flag); this shifts river APPEARANCE vs 2026-06-19 shipped rivers — flagged for Max (openForMax).
- **VERIFY:** `npx vitest run tests/ws4-carve-subtractive`; **router-lab regression** (`rivers-terrain-lab.html` → `window._rivers.stats`): oceanPct≈35, maxStrahler≈5, orphanPct===0, uphillPct===0 — re-run (SANITY) because this touched `planet-lod-rivers.js`; if any metric moves, the change leaked into routing (a bug), not a legitimate drift.

### T11 — Epoch-build-identical: the carve operates on an IMMUTABLE COPY of the build snapshot
**AC:** `epoch-build-identical` (unit).
**PRECISE CLAIM (critic, test-validity medium — avoid over-reading the green).** This unit proves a NARROW property: the JS carve pass (`authored_copy[i] += incision[i]`) does NOT mutate the `authored` (build-snapshot) array in place, and `incision[i] ≤ 0` everywhere. It does NOT prove the RENDERED epoch-1 is identical with carve toggled — that is the live AC's job (T12). Per D5c, `heightAfterBuild` for the unit IS the routed-substrate `authored` field (the ROUTER_MAIN readback), NOT a rendered-chain snapshot (which would need shader surgery WS4 doesn't scope).
- **RED:** add `tests/ws4-epoch.test.js` — snapshot `authored` (deep copy), run `perNodeIncision` + apply to a SEPARATE copy → assert (1) the original `authored` array is byte-identical before/after (no in-place mutation), (2) `(authored_copy[i] - authored[i]) ≤ 0 ∀i`. RED if the carve path mutates `authored` in place or any Δ > 0.
- **GREEN:** ensure the carve apply step reads `authored` and writes a fresh array (immutable snapshot through epoch 1). Pure-JS over the routed substrate (no GPU).
- **VERIFY:** `npx vitest run tests/ws4-epoch`.

### T12 — Epoch-carve-visible via a HEIGHT READBACK + epoch toggle (no rendered-chain sampler; D5c)
**AC:** `epoch-carve-visible` (integration, live).
**THE RENDERED-CHAIN SNAPSHOT IS NOT BUILT IN WS4 (D5c, critic feasibility BLOCKER).** `createHeightSampler` is hardwired to ROUTER_MAIN; a full-rendered-chain readback needs net-new shader surgery (a `BUILD_MAIN` frag + a `fragmentShader` param + a byte-match proof) — deferred as optional T12b unless Max greenlights. The binding observable here is therefore a HEIGHT READBACK over the field the overlay ALREADY samples, plus a supplementary screenshot. **A color screenshot ALONE is NOT the gate** — the existing cosmetic floor-darkening (lab.html Stage 6, `carveFloorCol`) can make valleys LOOK cut with no height drop; that is exactly the failure mode this AC exists to catch ("genuinely lower, not just darkened", intent success #2). The gate must be a numeric height decrease.
- **RED (live):** on :9223 over a built relief, with a NEW `_lab` epoch toggle (carve off vs on), read back height at known channel-node directions (via the new `_lab.sampleRoutedHeight()` probe, T12-probe below). RED proof = with the carve epoch ON, the readback height at channel directions must DECREASE vs OFF, while off-channel directions stay ~equal. Supplementary: a screenshot pair for Max's eye, NOT the pass condition.
- **GREEN:** wire a carve-epoch toggle into `_lab` (gate the `h -= carveDepth*uRiverCarveDepth` apply). Expose `_lab.sampleRoutedHeight(dirs)` reading the overlay's existing `sampler.read()` height (the ROUTER_MAIN field the carve is computed over) at the requested node directions. The carve subtracts `perNodeIncision` from that field; the readback witnesses the drop. (Note: this reads the routed substrate, NOT the rendered chain — honest per D5a/D5c; the rendered "cut into the same relief" read is Max's UAT eye, T18.)
- **VERIFY (live, :9223):** carve off→on lowers channel-direction readback heights; off-channel ~unchanged; the screenshot pair reads as "uncut relief" → "drainage cut in."

### T12-probe — Build the live read-out surfaces the live ACs bind to (`_lab` probes)
**AC:** enables `epoch-carve-visible` (T12), `one-shared-grain` (T13), `grain-zero-identical` (T5/T13).
**The live ACs have no probe surface today (critic, test-validity HIGH ×2).** `_lab` exposes state/uniforms/riverStats/sceneTarget but NO per-direction height readback and NO per-feature strike read-out. Without them the live ACs degrade to "does the screenshot look aligned/cut?" — which passes on a banded zonal field that merely LOOKS aligned, or on cosmetic darkening. Budget building them:
- **RED:** add `tests/ws4-lab-probes.test.js` (or a live-probe smoke) asserting `_lab.sampleRoutedHeight` and `_lab.grainProbe` exist and return the documented shapes. RED (absent).
- **GREEN:** add to `_lab` (lab.html:5631 block): (1) `sampleRoutedHeight(dirs)` → heights from the overlay's `sampler.read()` at the given directions; (2) `grainProbe()` / `probeStrike(featureKey, dir)` → each grained combiner's EFFECTIVE sampled strike vector (so `one-shared-grain` can assert all six derive from the SAME cube: set strength=1, perturb the cube, confirm ALL six strikes move together; at strength=0 none move — distinguishing "all read the cube" from "all happen to point similar directions").
- **VERIFY:** `npx vitest run tests/ws4-lab-probes`; live smoke on :9223 that both probes return finite data.

### T13 — Wire the remaining FIVE combiners + the in-shader province rotation (complete the replace-set)
**AC:** `one-shared-grain` (integration, live), `grain-zero-identical` (must stay green), `renderer-expression-only` (unit/audit), `landscape-with-history` (the 2D-not-bands move lands HERE, in-shader).
- **RED (live):** with grain ON, probe each grained feature's strike via `_lab.grainProbe` (T12-probe) — RED until ALL SIX read the shared cube AND move together when the cube is perturbed (orogeny `:881`, chasma `:1917`, scarp `:1955` done in T5, tessera `:2102/2110`, lava `:2189`, cryo `:2621/2631`). One missing site = an independent axis still present = fail.
- **GREEN:**
  - Apply the T5 **branch-guarded** grain read to the five vec3 combiners (chasma/scarp[done]/tessera/lava/cryo), each `sampleGrainStrike(vPos)` from the shared `uTectonicGrainCube`. Old `uXxxAxis` stays the strength=0 endpoint.
  - **OROGENY vec2 special case (D7):** `fbmdRidged` reads `uOrogenyAxis` as vec2 (xz). Project the cube's vec3 world strike onto the xz-plane: `vec2 g = normalize(grainStrike.xz);` then `mix(uOrogenyAxis, g, strength)`. Confirm mountains co-orient with the five vec3 features under the shared grain (via `grainProbe`).
  - **IN-SHADER PROVINCE ROTATION (D4 move-1 — this is the 2D-not-bands burden):** in each grained combiner, after sampling the cube strike, rotate/bias it by the in-fragment `gProvince` (the REAL shader province field, e.g. `θ += k*(gProvince.x-0.5)`), so the latitude-banded base strike acquires longitudinal 2D structure keyed to where the macroSeed provinces actually sit. This is the ONLY within-body anti-banding source (D3 + move-2 add none).
- **VERIFY (live, :9223):**
  - A/B strength 0 (EXACT-equal capture) vs 1 (all features visibly share a strike); `grainProbe` confirms ONE cube feeds N consumers, all six move together under a cube perturbation, none move at strength 0.
  - **ON-beats-OFF coherence guard (critic, max's-bar medium):** capture grain-ON@strength=1 vs grain-OFF@strength=0 on the WHOLE disk. Grain ON must read as MORE coherent/2D (ranges/scarps/canyons share a strike, sit in provinces) than OFF, NOT more banded/incoherent. If ON looks more zonally-banded than the current global-axis ranges, tune the smooth-director + province rotation until ON wins, BEFORE `VERIFIED_PENDING_MAX`. (Today `uOrogenyAxis` is a single GLOBAL vec2 giving coherent parallel belts; replacing it with a per-fragment latitude-banded strike risks reading MORE banded if move-1 underdelivers — this guard catches that.)
  - `npx vitest run tests/planet-lod` for any unit guards.

### T14 — Gate the FOUR grained-axis rerolls so a reroll can't reintroduce a random axis
**AC:** `one-shared-grain` (closes the leak).
**Gate ALL FOUR grained-axis rerolls — the reroll surface is per-feature, NOT one `randUnitVec3` helper (critics, determinism+scope HIGH; re-verified):**
- **orogeny `:3715`** — writes `state.orogenyAngle = Math.random()*2π-π` DIRECTLY (NOT `randUnitVec3`). THE missed leak, on the feature Max names first.
- **chasma `:3728`**, **scarp `:3743`**, **tessera `:3769`** — call `randUnitVec3` (`:2390`).
- **lava `:3801`** + **cryo `:3825`** reroll only OFFSETS (`lavaOffset`/`cryoRidgeOffsetV`), never axes → NO gate needed (their axes come solely from the seed-derived `applyDrivers` path).
- **RED:** add `tests/ws4-reroll-gate.test.js` (and/or a live `_lab.grainProbe` assertion). Because the reroll handlers live in the HTML page scope (not an importable module), assert via a live probe on :9223 OR factor the gate predicate into an importable helper and unit-test that: when `uTectonicGrainStrength>0`, each of the four grained-axis rerolls is a no-op/redirect (does NOT write an independent `Math.random` axis). RED (orogeny/chasma/scarp/tessera rerolls currently write axes unconditionally).
- **GREEN:** in the four reroll handlers, when grain is ON, redirect to a grain-cube re-bake (or no-op the per-feature axis write) so the shared field stays authoritative. `randUnitVec3`/`Math.random` are NEVER the grain derivation source — they stay for the grain-OFF legacy look only.
- **VERIFY:** `npx vitest run tests/ws4-reroll-gate`; live `_lab.grainProbe` on :9223 that an orogeny (AND chasma/scarp/tessera) reroll with grain ON leaves all six strikes correlated (none decorrelates).

### T15 — Router-lab zero-drift + both-poles + lakes regression (integration gate)
**AC:** `router-zero-drift` (integration, live).
- **RED:** none net-new — this is the standing regression that T10 (the only `planet-lod-rivers.js` touch) must not break.
- **GREEN:** n/a (gate).
- **VERIFY (live):** `rivers-terrain-lab.html` → `window._rivers.stats`: oceanPct≈35, maxStrahler≈5, orphanPct===0, uphillPct===0; inspect both poles clean + lakes intact on :9223.

### T16 — Record the contract-wording restatement (doc task, D11)
**AC:** `renderer-expression-only` (audit alignment).
- **RED:** none.
- **GREEN:** write the precise restatement (D11) into the workstream notes so the Synthesis phase patches `contract.json` `architecturalConnections.outputs` + the `renderer-expression-only` AC to the real replace-set, **explicitly preserving `initProvinces:797`/`gProvince:796`/`provinceWeight:811`** (Max decision #6). NOTE: do not edit `contract.json` here — Synthesis owns that; this task only records the exact wording.
- **VERIFY:** the restatement is present + cites match the T13 replace-set table.

### T17 — `renderer-expression-only` audit (final constraint check)
**AC:** `renderer-expression-only` (unit/code-audit).
**Dependency (critic, scope low):** T17's audit assertions ARE the operational definition of the corrected `renderer-expression-only` AC. Synthesis has already patched `contract.json`'s AC observable + `architecturalConnections.outputs` to the real replace-set (six combiner axis reads + six deriveUniforms hashes + `seededUnitVec3` + four reroll gates; `initProvinces`/`gProvince`/`provinceWeight` PRESERVED). So the audit and the live AC text now agree — no self-contradiction.
- **RED:** add `tests/ws4-expression-only.test.js` — a source scan over `planet-lod-height.glsl.js` asserting that for the six grained combiners, the strike axis comes through the branch-guarded `mix(..., uTectonicGrainStrength)` cube path (orogeny via the vec2 xz projection), not a raw per-feature hash, AND `initProvinces`/`gProvince`/`provinceWeight` remain present (augment, not replace).
- **GREEN:** n/a (audit; T13 satisfies it).
- **VERIFY:** `npx vitest run tests/ws4-expression-only`.

### T18 — UAT bundle for Max (live, Max's gate alone)
**AC:** `landscape-with-history` (UAT — `deferred-to-max`, no agent closes it).
- Provide the :9223 walkthrough: grain+carve ON, the strength dial, the epoch toggle, a couple of seeds. Max judges the whole-disk read: relief reads as a coherent tectonic system (ranges/scarps/canyons share a grain, sit in macroSeed provinces, not random scatter) AND drainage has cut into that relief. The verify-workstream workflow marks this `deferred-to-max`, never PASS.

---

## 4. AC → task coverage map

| AC id | layer | tasks |
|---|---|---|
| `grain-oracle` | unit | T1, T2, T6 |
| `one-shared-grain` | integration (live) | T5, T6, T7, T12-probe, T13, T14 |
| `grain-zero-identical` | integration (live) | T3, T5, T12-probe, T13 |
| `carve-subtractive` | unit | T9 (`perNodeIncision`), T10 |
| `epoch-build-identical` | unit | T9, T11 (immutable copy; render-side NOT claimed) |
| `epoch-carve-visible` | integration (live) | T12 (height readback), T12-probe |
| `router-zero-drift` | integration (live) | T10 (invariant by construction), T15 |
| `bake-once` | integration (live) | T7, T8 |
| `renderer-expression-only` | unit/audit | T13, T16, T17 |
| `landscape-with-history` | UAT (Max) | T13 (in-shader province), T18 |

> **Deferred/optional (not in the critical path):** **T12b** — a full rendered-chain `heightAfterBuild` snapshot (extract `BUILD_MAIN`, add a `fragmentShader` param to `createHeightSampler`, prove byte-match). Only if Max wants the rendered-frame epoch snapshot beyond the routed-substrate readback + UAT eye. See D5c / openForMax.

---

## 5. Risk register (carried from the dossier, with the mitigation task)

1. No orchestrator/baker → T4/T6/T8 build `planet-lod-tectonic.js`.
2. No GPU path → D2 decision = cube bake (T7). Cube stores STRIKE-only (not a JS province mirror — D4).
3. Quantized {0,π/2} director → T6 smooth director.
4. Latitude-only bands vs Max's bar → **T13 IN-SHADER province rotation** (the only within-body 2D source) + T2 per-body obliquity (inter-body only). NOT a JS province mirror (noise mismatch, D4).
5. Carve subtractive-ness → **T9 `perNodeIncision` (the real operand)**, T10 (stream-power + range clamp), T12 (live height readback — NO rendered-chain sampler, D5c), reliefGate proven LIVE not in the unit (D5d).
6. `uTectonicGrainStrength` absent → T3 (early) + the BRANCH guard (D6, NaN-safe true byte-identity).
7. Six sites + FOUR rerolls → T5+T13 (combiners; orogeny vec2 special case), T14 (orogeny/chasma/scarp/tessera reroll gates; lava/cryo offsets-only need none).
8. Two E6 copies → T1/T6 consume the prod copy only.
9. Bare `npm test` false-red → every VERIFY is scoped `npx vitest run tests/...`.
10. Carve unit needs headless harness → T9/T11 synthetic-mesh into `routeAndOrder` WITH mesh hydration (`mesh.pos`/`mesh.N`, D8).
11. Seed coherence → T6/T8 consume the INTEGER macroSeed (re-derive offset, don't read post-hash `uMacroOffset.value`).
12. `bake-once` cadence → T8 rides `route()` debounce.
13. **Live ACs had no probe surface** → T12-probe builds `_lab.sampleRoutedHeight` + `_lab.grainProbe`.
14. **`createHeightSampler` hardwired to ROUTER_MAIN** → no rendered-chain readback in WS4; T12b deferred (openForMax).
15. **T2 determinism guard is the SEAM test**, not the flat-writer tectonic test → T2 VERIFY scopes `worldengine-base-seam`.

---

*Plan written 2026-06-25; folded 5 adversarial-critic reviews (feasibility, determinism, max's-bar, test-validity, scope) 2026-06-25. All cites re-verified against current code. TDD discipline: every task RED→GREEN→VERIFY, mapped to its AC id(s). No placeholders, no deferred TODOs in the critical path (T12b is an explicitly-optional, Max-gated add-on). `src/generation/` byte-untouched; no `Date.now`/`Math.random` in any derivation task.*

**Critic-fold changelog (what changed and why):**
- **T12 / D5c — the rendered-chain snapshot is unbuildable as written.** `createHeightSampler` is hardwired to `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN`; there is no non-ROUTER_MAIN readback. Resolved: bind `epoch-carve-visible` to a routed-substrate height readback + epoch toggle; defer the true rendered-chain snapshot to optional T12b (openForMax).
- **T9 / D5-pre — `carved[i] <= authored[i]` had no operand.** `buildValleyGeometry` returns strip geometry (positive `aDepth` tent), not a per-node carved array. Resolved: new pure `perNodeIncision` helper IS the operand; cube + strip depth derive from it.
- **D8 — synthetic harness would throw.** `buildIrregularSphere` returns no `pos`/`N`; `buildValleyGeometry` needs them. Resolved: mandatory mesh hydration (replicate `ensureMesh`) in the harness.
- **D4 move-1 — JS province mirror can't match the shader.** GLSL `noised()` (sin-hash) ≠ WS2 `simplex-noise`. Resolved: province modulation moves IN-SHADER against the real `gProvince` (T13); the cube stores strike-only. Honestly attributed: D3 + move-2 add ZERO within-body 2D structure; move-1 carries it all; move-2 is inter-body only.
- **D7 / T14 — orogeny reroll leak.** `:3715` writes `Math.random` directly (not `randUnitVec3`); the original T14 missed it. Resolved: gate all four grained-axis rerolls (orogeny/chasma/scarp/tessera); lava/cryo reroll offsets-only (no gate).
- **D6 — strength-0 NaN path.** Null cube sampled at strength 0 could yield NaN. Resolved: BRANCH around the grain read at strength==0 (true byte-identity, exact-equal capture) + finite placeholder cube.
- **D7 — orogeny is vec2, not vec3.** The uniform mix doesn't transfer. Resolved: explicit vec3→vec2 xz projection named in T13.
- **D5d — reliefGate proven over the wrong field.** It gates the rendered `h`, unobservable in the JS unit. Resolved: unit proves only the routed-substrate law sign; reliefGate monotonicity is a LIVE claim (T12).
- **T2 — wrong determinism guard cited.** Seam test (not the flat-writer tectonic test) guards the `rotatePoleDeg` signature. Resolved: VERIFY scopes `worldengine-base-seam`.
- **T1 — "reuse" overstated.** `writeGrainSphere` over the sphere carrier is net-new coverage. Resolved: per-node regime asserts at band boundaries.
- **T12-probe (new) — live ACs had no probe surface.** `_lab` has no height readback / strike read-out. Resolved: build `_lab.sampleRoutedHeight` + `_lab.grainProbe`.
- **T13 — no ON-beats-OFF guard.** Resolved: A/B coherence sub-criterion (grain ON must read MORE coherent/2D than OFF) before `VERIFIED_PENDING_MAX`.
- **T10 — stream-power range + router-drift framing.** Resolved: clamp `|Δ|` into the cube depth band; router-lab re-run is a sanity check (buildValleyGeometry is downstream of routing, invariant by construction); default = stream-power, flagged for Max.

**Critic points NOT folded (with reason):**
- "rotatePoleDeg should become a true pole-axis ROTATION (per-body band tilt)" (max's-bar) — that is a LARGER feature than the advertised 1-liner and OUT of WS4 scope. We instead reclassified move-2 as inter-body-only and explicitly do NOT expand it; real per-body band-tilt is later work.
- "epoch-build-identical's 'bit-identical' reads as a rendered-frame claim" (test-validity, wording) — folded by restating T11's claim precisely (immutable-copy, no in-place mutation) rather than changing the contract AC text, since the AC's `verifyVia` already scopes a headless snapshot, not a rendered frame.
