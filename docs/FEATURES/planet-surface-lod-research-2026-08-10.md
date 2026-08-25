<!-- PROVENANCE — read before citing anything in here -->
> **Produced 2026-08-10** by a 7-agent research workflow (5 parallel lanes + an adversarial
> completeness critic + a synthesiser), against three.js **0.183.1** on a **WebGLRenderer**.
> Commissioned by Max: *"researching three.js current engine capabilities, how to implement 1-4
> given the shape of the game and lod lab as we plan them to be once this workstream completes"*.
>
> ⛔ **THIS IS NOT A CONTRACT AND MUST NOT BE TREATED AS ONE.** Nothing here is scoped, agreed or
> scheduled. Workstreams are scoped in-thread with Max through `dev-collab-scope`, with the success
> criteria in his words. §7 lists the decisions that are his; §6 lists the work that would be thrown
> away; §8 lists what this research did NOT establish. Read all three before building anything.
>
> ⚠ **CITATION FENCE: THIS FILE IS DELIBERATELY NOT IN `CITE_SOURCES`.** Much of its evidence is
> citations into **three.js's own source under `node_modules/three/src/**`** (`WebGLProgram.js`,
> `WebGLPrograms.js`, `WebGLRenderer.js`, `BufferAttribute.js`, `WebGLAttributes.js`,
> `WebGLTextures.js`, and three GLSL chunk files). The fence resolves basenames against the REPO
> index, so those 15 refs are structurally unresolvable to it — adding this file would make the fence
> permanently red for a reason that is not a defect. Spot-checked by hand instead: five of the
> three.js refs were read against the installed r183.1 and all five matched exactly, so the engine
> lane read the source rather than recalling it. In-repo refs in this file are unverified by the
> fence; treat them as a reading, not a gate.
>
> ⭐ **A CLAIM MADE ON 2026-08-10 AND CORRECTED THE SAME DAY, because it shaped this research.**
> An earlier `_lab.approachSweep` comparison reported that the game and the lab return the same live
> octave value at every rung. That measurement was taken with the 6e flag ON (`localStorage
> ['wd.labGasBodies'] === '1'`, left over from a previous session), so it compared the lab shader
> against ITSELF. **At the shipped default the same gas giant carries 71 uniforms, no `uOctaves`, and
> is not on the lab material at all.** See §5.2 / the M1 measurement. ⛔ **THE FINGERPRINT MOVED — 71 → 72 AT B2P, 2026-08-20.** `uPosterizeLevels` joined the game material (src/rendering/posterizeLevels.js:55 `export const POSTERIZE_QUANTUM = { value: new THREE.Vector2(6.0, Math.fround(1 / 6)) };` — ⚠ **the GAME slot, re-pointed 2026-08-20.** This sentence used to cite posterizeLevels.js:45 `export const POSTERIZE_LEVELS = { value: 6.0 };`, which is still live and still resolves, but is the LAB material's SCALAR bound to `uniform float uLevels`; the game material's `uPosterizeLevels` holds the vec2 at :55. The citation fence validates the quoted line TEXT, not the attribution, so it stayed green through the wrong one), so a body ON THE GAME MATERIAL now reports **72** uniforms and 71 identifies nothing. 71 was correct the day this line was measured; it is kept, annotated, rather than rewritten. Debug against `isLabPlanetMaterial` — a boolean cannot drift with the next uniform.

# Research Dossier — Displaced, Camera-Adaptive Planet Surfaces in Well Dipper

**Status: research input for a scoping conversation. This is NOT a contract.**
Max scopes workstreams through the `dev-collab-scope` interview, in his own words. Everything below is
material for that conversation. Where a real choice exists it is presented as a choice.

**Evidence labels used throughout:**
`[WEB-VERIFIED-ME]` I fetched the source this session · `[SOURCE-VERIFIED-ME]` I read it in
`node_modules/three@0.183.1` or the repo this session · `[ARITHMETIC-ME]` I re-derived the number this
session · `[MEASURED-LANE]` a research lane ran it live · `[READ-LANE]` a lane read it, I did not
re-check · `[JUDGEMENT]` reasoning, not a fact · `[UNVERIFIED]` stated so you don't cite it.

---

## 1. The one-line finding

**The blocker is not that the vertex shader refuses to displace — it is that there is nothing to
displace. No representation of a planet surface anywhere in this codebase gets finer as the camera
approaches; the one thing that could carry shape (the mesh) is built once and never asked about the
camera, and the number of quads spanning what you can actually see *falls* on approach — 46 at 20 body
radii, 34 at 2.2, 9 at 1.05.**

Read that last clause twice. It is the opposite of resolving. Every distance-driven knob in the system
(the octave ramp, the LOD tier) feeds the **fragment** shader; the mesh is a constant. So bolting
displacement onto today's `SphereGeometry(r, 96, 48)` does not begin the landing path — it trades a
fragment-side saturation for a geometry-side one that is *worse near the ground than far away*.

`[ARITHMETIC-ME]` cap half-angle `θ = acos(1/d)`; game latitude segment = 180°/48 = 3.75°.
Full table in §3, Blocker 2.

---

## 2. What is already solved — credit, precisely

This codebase has substantially more foundation for this program than a first read suggests. Naming it
matters, because at least three of the items below are things a naive plan would build from scratch.

### 2.1 ⭐ The shared shader is already topology-agnostic — the single biggest unclaimed asset

`planet-lod-shaders.glsl.js:72-78` — the entire vertex shader body:

```glsl
vPos  = position / uBodyRadius;   // noise domain
vObjN = normalize(position);
// ... four baked attribute passthroughs ...
gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
```

`[READ-LANE, spot-checked me]` It reads **no `uv`**, **no `normal` attribute**, and nothing
topology-specific. The noise domain is a *unit direction*, not a surface parameterisation.

**Consequence:** a cube-sphere chunk mesh drops into the existing shared shader with **zero shader
edits**. The quadtree base case is already compatible. Nobody has to re-key the field to a new topology.
This is why the level-0 cube-sphere in §5 is genuinely small.

Corroborating: `src/objects/Planet.js:1565-1568` already documents that both UV consumers derive from
`position` (triplanar `pos.yz/pos.xz/pos.xy`, and `equirectUV(dir)` on the textured path), so
"nothing reads the sphere's own uv, so the seam and the poles are inert." `[SOURCE-VERIFIED-ME]`
That audit is *already done and written down*.

### 2.2 Camera-relative world rendering, disciplined

- `src/core/WorldOrigin.js:30` `REBASE_THRESHOLD_SQ = 100 * 100`; `:136-154` `maybeRebase` subtracts
  the camera's world position from every scene child each frame past threshold. `[SOURCE-VERIFIED-ME]`
- `src/main.js:12620` `_onWorldRebase(...)` → `cameraInterp.shiftOnRebase` + interp-mesh snapshots;
  `src/main.js:1131-1170` `_trackControllerCaches` covers ~19 tracked `Vector3` fields across 7
  controllers; 5 `_placeInRebasedFrame` seed sites. `[READ-LANE]`
- three r183's whole CPU transform chain is float64 — `Vector3` stores plain JS numbers,
  `Matrix4.elements` is a plain `Array`. `[READ-LANE, consistent with source I checked]`

**So:** world bookkeeping is not a wall, and a chunked surface inherits a working rebase. See §3
Blocker 4 for the one caveat (`maybeRebase` does not call `updateMatrixWorld`).

### 2.3 Half the planet-scale depth problem already shipped

`src/rendering/RetroRenderer.js:49` `logarithmicDepthBuffer: true` `[SOURCE-VERIFIED-ME]`, and the
shared shader already carries `#include <logdepthbuf_pars_vertex>` / `<logdepthbuf_vertex>`
(`planet-lod-shaders.glsl.js:38-39`), with the lab-vs-game flag divergence **documented in-source at
`:33-35`**. Do not re-derive this. (The stale symbol name in that comment — `USE_LOGDEPTHBUF` vs
r183's actual `USE_LOGARITHMIC_DEPTH_BUFFER` — is a one-word correction, not a defect. `[READ-LANE]`)

### 2.4 The LOD law is genuinely shared, including to legacy bodies

- `src/rendering/LabPlanetMaterial.js:2` imports `LAB_VERTEX_SHADER`/`LAB_FRAGMENT_SHADER` from the
  lab module; `:8` imports `lodRampOf, autoOctaves` "rather than re-derived … so the two renderers
  cannot drift apart on detail." `[READ-LANE]`
- `src/rendering/objects/BodyRenderer.js:213-216` `[SOURCE-VERIFIED-ME]`:
  ```js
  const u = surface?.material?.uniforms?.uReliefOctaves;
  if (!u) return;
  const next = autoOctaves(lodRampOf(distanceRadii));
  ```
  So the shared law reaches **legacy** game bodies too, through `uReliefOctaves`. This matters for §8
  item 3: the *law* is shared even where the *instrument* is not.
- `src/rendering/LODManager.js:96-99` `[SOURCE-VERIFIED-ME]` calls `setLOD(tier)` then
  `setReliefDetail(ratio, camPos)` on the continuous ratio — with an in-source comment explaining
  why it must be a separate call. Touches no geometry, as the brief states.

### 2.5 Fences and instruments that will make a displacement program *safe*

- `tests/lab-shader-body-radius.test.js:101-106` pins raw `position` in `gl_Position` **and**
  `not.toMatch(/gl_Position[\s\S]{0,80}uBodyRadius/)`. `[SOURCE-VERIFIED-ME]`
- `src/worldengine/instrument/fieldSampler.js` resolves the **live** material by reference through the
  scene graph on every read and throws on substitution or in-place drift (`:263-283`, `:336`,
  `:390-401`); `deriveTapVertex` (`:238-241`) is a whitelist that throws if any bare `position` token
  survives its substitutions. `[READ-LANE]`
- `src/main.js:3477-3506` — `approachSweep` already refuses to report saturation as a fact about a
  body carrying no `uOctaves` uniform, with a loud `lodDrivenNote`. `[SOURCE-VERIFIED-ME]`

These are not obstacles. They are the mechanisms that turn "we changed the silhouette" from an
accident into a declared act. Budget for updating them; do not budget for fighting them.

### 2.6 Vertical scale honesty — the prerequisite is already identified and refused

`src/worldengine/instrument/fieldSampler.js:120-140` `[SOURCE-VERIFIED-ME]`: horizontal distance **is**
calibrated (angular separation × real radius, genuinely km). Vertical height is **not** — amplitudes
are dimensionless artistic values, and multiplying by `radius × 6371` produced "~488 km RMS relief and
±1700 km elevation for an Earth-like world, which is ~200× too large." The instrument reports height
units and takes an explicit `kmPerUnit` or nothing.

**That refusal is the scale prerequisite for displacement, already written down.** Someone has to
declare km-per-height-unit before geometry can be displaced by a physical amount.

### 2.7 Bakes, twins, and streaming — established patterns

- CPU→GPU height bake path exists end-to-end in the lab: `makeSphereField` /
  `buildIrregularSphere(TARGET_N=40000)` (`planet-lod-rivers.js:60,404`) →
  `buildHeightCubeGeometry` → `createHeightCube` at `RELIEF_CUBE_SIZE = 256`
  (`planet-lod-tectonic.js:258,302-345`) → `sampleBakedRelief(dir)` one `textureCube` fetch
  (`planet-lod-height.glsl.js:162`). `[READ-LANE]`
- JS/GLSL twin pattern established for **shape kernels**: 12 of labCore's 45 exports name-match GLSL
  functions (`craterProfile`, `ejectaProfile`, `terraceProfile`, `voronoi3d`, …). `[MEASURED-LANE]`
- The lab already streams CPU-computed per-vertex data into `BufferAttribute`s
  (`planet-lod-lab.html:285`, `:1763`, `:1767`) and pack writers already receive raw `mesh.positions`.
  `[READ-LANE]`

### 2.8 Correction to the brief

`planet-lod-lab-core.js` is **1264 lines**, not 1194 (`wc -l` `[SOURCE-VERIFIED-ME]`). 45 exports is
correct. The one-pipeline plan's Step 7 line count is stale.

---

## 3. The four blockers

### BLOCKER 1 — Displacement: there is no vertex-stage height source

**What it is.** The height field is computed **entirely in the fragment shader**. `HEIGHT_GLSL` (262 KB)
is interpolated as the first line of `LAB_FRAGMENT_SHADER` (`planet-lod-shaders.glsl.js:83`); `:262`
runs `hd = fbmd(vPos, uOctaves, fwBase)` and `:291-334` runs the combiner chain. The vertex shader is
4.4 KB and contains no height code at all. `[MEASURED-LANE]`

There is no `height` value in the vertex stage to displace by. Creating one is the work item; the
`gl_Position` line is the last line of it, not the first.

**Measured evidence.**
- `HEIGHT_GLSL` declares `varying vec3 vPos; varying vec3 vObjN; varying float vSubstellarAngle;` at
  `planet-lod-height.glsl.js:17-19` and reads them 9 / 1 / 9 times, **including inside combiners that
  write `h` and `grad`**. `#include`-ing it in a vertex shader collides with the vertex shader's own
  declarations and the reads are meaningless. `[MEASURED-LANE]`
- `ecuRelief` calls `fwidth()` **ungated** at `planet-lod-height.glsl.js:3031`. `fwidth` is
  fragment-only. `[READ-LANE]`
- ⛔ **`textureCube` is defined ONLY in the fragment prefix.** `[SOURCE-VERIFIED-ME]` —
  `node_modules/three/src/renderers/webgl/WebGLProgram.js:796-825`: the vertex prefix gets exactly
  `#define attribute in`, `#define varying out`, `#define texture2D texture`. `#define textureCube
  texture` appears only in the fragment block. A shared GLSL leaf used by both stages must call
  `texture(cube, dir)` and must never contain a bare `textureCube`.

**The amplitude problem, which is the real decision hiding here.**
- `perturbAnalytic`'s shipped coefficient is `uPerturb × mix(0.7, 1.0, uLodRamp) × 0.6` =
  **0.231 far → 0.330 close** (`planet-lod-uniforms.js:33` `uPerturb: 0.55`;
  `planet-lod-shaders.glsl.js:432,438`; `planet-lod-height.glsl.js:1487`). `[READ-LANE, constants
  confirmed me]`
- Earth's full Everest-to-Marianas range is **0.00311** of radius. `[ARITHMETIC-ME]`
- So the shading currently *claims* relief ~75× (far) to ~106× (close) larger than Earth's entire
  range.
- Through the ÷3 retro buffer at 2.2 body radii, the smallest displacement that visibly breaks the
  circle is **ε ≈ 0.01–0.02 of body radius** — 64–128 km on an Earth-sized world, 3–6× Earth's whole
  relief range. Below that the retro downsample eats it. `[MEASURED-LANE, scratchpad arithmetic]`

**What it would take.** A shared, varying-free, `fwidth`-free GLSL displacement leaf callable from all
three surface programs (see below), plus an explicit amplitude declaration. `perturbAnalytic` itself
needs **no rewrite** — one lane verified numerically that it already *is* the exact analytic normal of
a radially-displaced sphere provided its coefficient equals the displacement amplitude ratio
(`[MEASURED-LANE, plausible-unreplicated — the verifying script is in a subagent scratchpad]`). Only
the coefficient changes.

**What it depends on.**
- The mesh (Blocker 2) — displacement below the mesh's own angular resolution is invisible.
- `kmPerUnit` (Blocker 4d) — you cannot displace by a physical amount that nobody has defined.
- ⛔ **THREE surface programs, not two.** `src/objects/Planet.js:2158` `LAB_GAS_BODIES_DEFAULT = false`
  `[SOURCE-VERIFIED-ME]`; `labPipelineAdmits` (`:2189`) requires `flag.enabled &&
  provenance.isWorldEngine && packs.length > 0`. **I grepped the whole repo: there is no production
  enable site — every reference to `setLabGasBodiesOverride` / `__wdLabGasBodies` outside Planet.js
  itself is in `tests/`.** So most game bodies render the legacy `Planet.js` shader, moons render
  `Moon.js`'s own, and the lab shader reaches a narrow admitted set. Displacement written only into
  `LAB_VERTEX_SHADER` would appear on approximately no bodies in the shipped default. `[SOURCE-VERIFIED-ME]`

---

### BLOCKER 2 — ⭐ Adaptive mesh: the surface gets *coarser* as you approach

**What it is.** The mesh is built once, at spawn, and never consulted about the camera. This is
documented as a deliberate non-goal, in place, at `src/objects/Planet.js:1570-1574` `[SOURCE-VERIFIED-ME]`:

> ⛔ DELIBERATE NON-GOAL: this is NOT geometric LOD. Vertex count is still FIXED at every distance —
> no tier swaps the mesh, here or anywhere in `src/rendering/`. It cannot be, because neither vertex
> shader displaces `position`…

**Measured evidence — I re-derived all of this independently this session.** `[ARITHMETIC-ME]`

Visible-cap half-angle `θ = acos(1/d)`; game latitude segment 180°/48 = 3.75°; lab 180°/256 = 0.703°.

| distance (body radii) | visible cap (°) | game quads across (96×48) | lab quads across (256×256) |
|---|---|---|---|
| 20.00 | 174.3 | **46** | 248 |
| 9.57 | 168.0 | 45 | 239 |
| 6.62 | 162.6 | 43 | 231 |
| 4.58 | 154.8 | 41 | 220 |
| 3.17 | 143.2 | 38 | 204 |
| **2.19** | 125.7 | **34** | **179** |
| 1.52 | 97.7 | 26 | 139 |
| 1.05 | 35.5 | **9** | 50 |

One game quad is **417 km** on an Earth-sized world (40,030 km ÷ 96 longitude; 20,015 km ÷ 48
latitude). `[ARITHMETIC-ME]` That is about the width of the Himalaya. Displacement on that mesh can
carry continent-scale and major-range-scale silhouette, and **nothing finer, ever, at any distance.**

To reach a 2-render-px quad the game would need ~336 latitude segments at 2.2 radii and ~8076 at the
1.05 zoom floor `[MEASURED-LANE arithmetic]` — the requirement scales as 1/(d−1), so **no fixed mesh
can satisfy it**. And a 96-gon limb wobbling is the same class of artefact commit `77fff7f` was made
to remove.

**What it would take.** A cube-sphere quadtree with split/merge on a screen-space-error metric, a
CDLOD-style vertex morph, drawn through `BatchedMesh`. See §5.

**What it depends on.** Structurally, nothing else. This is the one blocker that is a pure build.
Its silhouette output is visible with **no displacement at all** (uniform angular sampling, no pole
convergence), which is why the level-0 base case is a real increment.

**⚠ Skirts are actively hostile in this codebase, and the reason is specific.** A skirt vertex sits
**off** the ideal sphere, so its `vPos = position / uBodyRadius` lands at the wrong place in the noise
domain and the skirt shades as a smeared, wrong-coloured band. In a shader driven entirely by `vPos`,
morphing is the right crack-handling family and skirts are the wrong one. `[JUDGEMENT, from
`[READ-LANE]` on skirt vs morph literature + the verified `vPos` line]`

---

### BLOCKER 3 — CPU height field: needed only if *landing* is in scope, and the obvious route is closed

**What it is.** Rendering does not need a CPU height field. Collision does. If the ship has to *touch*
the ground, something on the CPU must answer "how high is the surface at this direction?" and agree
with what is drawn.

**Measured evidence — the twin route is closed for the current hash.** A lane transcribed
`hash3`/`noised`/`fbmd` line-for-line **from the live shader string** and ran it against the GPU's own
evaluation of those same three functions (tap composite, `uOctaves` pinned 9, `uFwClamp` pinned 0):
mean |Δh| = **0.117** against a field range of **0.314** — same statistics, no correlation. A different
planet, not a drifted one. Emulating float32 with `Math.fround` on every operation made it **worse**
(0.122). `[MEASURED-LANE, live]`

Mechanism, isolated: `fract(sin(x) * 43758.5453123)` at |x| ≈ 1.6e5, where **one float32 ULP of the
argument (0.0156 rad) moves the hash 21% of its range**. Only the identical hardware `sin` reproduces
that. `[MEASURED-LANE]`

**⭐ CORRECTION I made and verified myself.** The lane then discounted the one escape route — replacing
`hash3` with an integer bit-hash on lattice indices — on the stated belief that "this shader compiles
as GLSL ES 1.00 … where integer support is weaker." **That is false.**
`node_modules/three/src/renderers/webgl/WebGLProgram.js:796-801` `[SOURCE-VERIFIED-ME]`:

```js
if ( parameters.isRawShaderMaterial !== true ) {
    // GLSL 3.0 conversion for built-in materials and ShaderMaterial
    versionString = '#version 300 es\n';
```

Every planet material in this repo is a plain `THREE.ShaderMaterial`. They all compile as **GLSL ES
3.00** with compatibility defines. Integer and bitwise ops are fully specified. **An integer bit-hash
IS technically available.** Its real cost is that it **re-rolls every existing seed's terrain** — a
product decision for Max, not a law of the machine.

**GPU readback: affordable, wrong shape.** A sync `readRenderTargetPixels` costs 1.5–2.6 ms of main
thread and is **flat in payload** (4 samples = 1.6 ms; 131,072 full-chain samples = 2.5 ms) — the stall
is the pipeline sync, not the bytes. `readRenderTargetPixelsAsync` exists on the live r183 renderer at
0.5 ms main thread, data at ~5.6 ms. `[MEASURED-LANE, live]` So cost is not the disqualifier. The
disqualifier is that on the **lab** material the rendered field is camera-dependent (`uFwClamp = 1`
fades octaves by a screen-space derivative; `fieldSampler.js:93-100` records two further camera terms
inside the field). Physics that changes when you turn the camera is not physics.

⚠ **But note the configuration caveat:** on the **default game** path that clamp is inert.
`src/objects/Planet.js:591` `[SOURCE-VERIFIED-ME]`:
```glsl
gReliefD = (uReliefMix > 0.001) ? fbmd(pos, uReliefOctaves, 0.0) : vec4(0.0);
```
`fwBase` is the literal `0.0`, so `smoothstep(0.4, 0.8, 0.0) = 0` and the clamp multiplies by 1.
`uFwClamp: { value: 1 }` at `Planet.js:1683` is true and does nothing.

**What it would take.** Choose an authority — see §7 Q2/Q5 for the trade-offs. The gate that guards it
is buildable *today* and mostly already exists: `uFieldTap` is declared in the **shared** fragment
source (`planet-lod-shaders.glsl.js:126`), so the game's compiled program already has the tap; only
the JS uniform slot is lab-only (`planet-lod-lab.html:278`), and
`tests/instrument-tap-fence.test.js:112` currently asserts `planet-lod-uniforms.js` contains no
`uFieldTap`. **The instrument is lab-only by exactly one line, behind one deliberate test.**
`[READ-LANE]`

**What it depends on.** Whether landing is in scope at all. If the goal is *approach*, this blocker
drops out entirely and the program roughly halves.

---

### BLOCKER 4 — Precision and scale: four separate things, only one of which is a wall

**(a) float32 is scale-invariant, so the scene unit is a red herring.** `[ARITHMETIC-ME]` Relative
resolution is 2⁻²⁴ = 5.96e-8 to 2⁻²³ = 1.19e-7 of the magnitude, whatever the unit. On an Earth-radius
body: **0.380 m to 0.759 m**. Measured per front-end: game vertex in scene units = **0.557 m**; lab
vertex at object-space R=1.0 = **0.760 m**. `[MEASURED-LANE]`

Metre scale is reachable in both frames with under 2× headroom. **Sub-metre is not.** Renaming the
scene unit buys exactly zero. And a gas giant is already ~8× worse than an Earth body.

**(b) Lowering `REBASE_THRESHOLD_SQ` cannot reach sub-metre and is the wrong lever.** For 10 cm in a
float32 world-space frame the max coordinate must be ≤ 0.0112 scene units — which is **inside** an
Earth-radius planet (0.0426 scene units). A camera orbiting the body could never satisfy it. Leave the
threshold at 100². `[ARITHMETIC-ME, from `[READ-LANE]` constants]`

**(c) ⭐ The depth buffer has a flat ~109 m resolution floor across the entire near field.**
`src/rendering/RetroRenderer.js:833-835` `[SOURCE-VERIFIED-ME]`:
```js
this.sceneTarget.depthTexture.format = THREE.DepthStencilFormat;
this.sceneTarget.depthTexture.type   = THREE.UnsignedInt248Type;   // → DEPTH24_STENCIL8
```
three's log-depth curve `log2(1+w)/log2(far+1)` is **linear** for `w ≪ 1` scene unit, so 24-bit fixed
point gives one slope for everything: ~108.8 m at 15 m from camera, ~108.8 m at 150 km, ~113.5 m at
6,373 km. `[MEASURED-LANE arithmetic]` A metre-scale surface cannot self-occlude in that pass; nor can
a 20 m ship. The fix is the **format**, not the mapping: `depthTexture.type = FloatType` →
`DEPTH32F_STENCIL8`, which keeps stencil, needs no shader edit (grep for `depthTexture` across `src/`
returns only those three lines), and takes the same curve to ~2⁻²⁴ relative (1.6 µm at 15 m, 13 mm at
150 km, 0.44 m at 6,373 km). `[READ-LANE + `[SOURCE-VERIFIED-ME]` on the format mapping]`

⚠ **Rank it honestly: there is no observed symptom.** The arithmetic is solid; the visual consequence
is a prediction. The game may simply have nothing within 109 m of anything else in the main pass
today. It is a prerequisite for the day a displaced surface or a landed ship exists — not a fix for
something Max can currently see.

**(d) The noise domain re-imposes the same floor, and this is the hard part.** `vPos = position /
uBodyRadius` puts the domain on the unit sphere, where float32 ULP is 1.19e-7 = **0.76 m on Earth**.
Per-chunk re-centring alone does not help: a float32 chunk-centre of magnitude ~1 already quantises at
0.76 m before any local offset is added. Sub-metre procedural detail requires **splitting the octave
stack** — low octaves at the coarse chunk centre, high octaves on the chunk-local delta with a
CPU-computed float64 per-chunk phase — so the large integer part of `p × frequency` never enters a
float32 register. `[MEASURED-LANE + JUDGEMENT]` This **must** land in the shared module or the two
front-ends diverge again; it is exactly the class of change that gets prototyped in the lab and never
ported.

**(e) One-frame `matrixWorld` staleness.** `WorldOrigin.js:136-154` mutates `child.position` and never
calls `updateMatrixWorld`; `scene.updateMatrixWorld()` is driven by `renderer.render()`, which runs
*after* `simStep`. So on a rebase frame every `getWorldPosition()` read inside `simStep` returns the
pre-rebase frame while `camera.position` is already zeroed. `[READ-LANE, inference]` **For a chunk
system: never derive a chunk's position by differencing world-space vectors read during the sim step.**
Parent chunks under the body group so the rebase's scene-graph subtract carries them structurally.

**(f) Two Earth radii coexist and disagree by 1.87 km (0.029%).** `ScaleConstants.js:23`
`EARTH_RADIUS_AU = 0.0000426` × 149,597.8707 = 6372.87 km, versus
`src/worldengine/base/featureScale.js:31` `R_EARTH_KM = 6371`. `[MEASURED-LANE]` Inert for shading; a
systematic error for any system converting scene units ↔ surface metres on every chunk. Reconcile
before chunking, not after.

**(g) `kmPerUnit` for vertical relief is genuinely unestablished** — see §2.6. This is a *world-design*
decision (how tall are the mountains), not a technical one.

---

## 4. Engine reality on three.js r183

Installed: **`three@0.183.1`**, `WebGLRenderer`, WebGL2 context. `[SOURCE-VERIFIED-ME]`

### 4.1 Release position — `[WEB-VERIFIED-ME]`

`gh api repos/mrdoob/three.js/releases` this session:

| tag | published |
|---|---|
| r185 | 2026-07-01 |
| r184 | 2026-04-16 |
| **r183** | **2026-02-20** |
| r182 | 2025-12-10 |

The repo is two releases behind. `[READ-LANE]` No r184→r185 breaking change touches a WebGLRenderer +
ShaderMaterial planet pipeline (the migration-guide entries are WebGPU/TSL/loader/postprocessing).
Upgrading is optional, not blocking — **except** for one strategic item, §4.4.

### 4.2 What the engine gives you

`[SOURCE-VERIFIED-ME]` in `node_modules/three@0.183.1`:

- **`BatchedMesh` is the right primitive, works with a plain `ShaderMaterial`, and works on WebGL.**
  `WebGLPrograms.js:116` `const IS_BATCHEDMESH = object.isBatchedMesh === true;` → `:197`
  `batching: IS_BATCHEDMESH` → `WebGLProgram.js:483` `parameters.batching ? '#define USE_BATCHING' : ''`,
  which sits in the **non-Raw** prefix branch. The define comes from the *object*, not the material
  type. JSDoc: "render a large number of objects with the same material but with **different
  geometries** or world transformations."
  ⚠ **Unstated precondition the engine lane glossed:** three does **not** auto-inject
  `<batching_pars_vertex>` / `<batching_vertex>` into a custom ShaderMaterial — those `#include`s live
  inside ShaderLib's own shaders (`ShaderLib/depth.glsl.js:20`, `distance.glsl.js:18`,
  `shadow.glsl.js:12`). Adding them plus the `batchingMatrix` multiply to `LAB_VERTEX_SHADER` is a
  **shared-law edit**, not a material-config change.
- **Graceful WebGL fallback, no hardware gamble.** `WebGLPrograms.js:363` gates `extensionMultiDraw` on
  `extensions.has('WEBGL_multi_draw')`; `WebGLRenderer.js:1289` has an explicit per-draw CPU loop when
  the extension is absent. One draw call where available, today's N draw calls where not, correct
  output either way.
- **`InstancedMesh` is the wrong tool** — its constructor takes exactly one geometry; JSDoc says "same
  geometry and material(s) but with different world transformations." It stays correct for
  `src/objects/AsteroidBelt.js`.
- **`#version 300 es` for every non-Raw ShaderMaterial** (`WebGLProgram.js:796-801`) ⇒ integer and
  bitwise ops fully specified. See §3 Blocker 3 — this overturns a lane's stated blocker.
- ⛔ **`textureCube` is fragment-prefix only** (`WebGLProgram.js:802-825`).

`[MEASURED-LANE, live on Max's RTX 5080 via chrome-devtools]`: `WEBGL_multi_draw` **true**;
`MAX_VERTEX_TEXTURE_IMAGE_UNITS` **16**; `OES_texture_float_linear`, `EXT_color_buffer_float`,
`EXT_float_blend`, `WEBGL_clip_cull_distance` all present; `MAX_TEXTURE_SIZE` 16384;
`MAX_VERTEX_UNIFORM_VECTORS` 4095 against 356 uniforms in use; vertex highp precision 23 bits;
`readRenderTargetPixelsAsync` present. **Vertex texture fetch displacement is unblocked on this
machine.** Note the fallback path above is what protects other hardware.

`[READ-LANE]`, not re-checked by me: `BufferAttribute.addUpdateRange`/`clearUpdateRanges` drives
partial `bufferSubData` with range merging (`BufferAttribute.js:178,187`; `WebGLAttributes.js:87-142`);
three ships `displacementmap_vertex.glsl.js` on the classic path as a reference implementation;
`reversedDepthBuffer` exists gated on `EXT_clip_control`; `UnsignedInt248Type → DEPTH24_STENCIL8`,
`FloatType → DEPTH32F_STENCIL8` (`WebGLTextures.js:231-246`).

### 4.3 What the engine does **not** give you

- ⛔ **No hardware tessellation.** `[WEB-VERIFIED-ME]` —
  https://github.com/KhronosGroup/WebGL/issues/2791: "This extension depends on ES 3.1, while WebGL 2
  seems to target 3.0"; "Loading an extension with string `GL_OES_tessellation_shader` fails in
  WebGL 2." Unresolved, no PRs. **Any design assuming GPU tessellation — which is the most common
  shape in the terrain literature and in Unity/UE writeups — is dead on arrival here.** Chunk meshes
  must be CPU-authored or vertex-shader-displaced.
- ⛔ **No compute on classic `WebGLRenderer`.** `[READ-LANE]` The only maintained GPGPU helper is
  `GPUComputationRenderer` (render-to-texture ping-pong) — the same mechanism `fieldSampler.js`
  already uses. `examples/jsm/gpgpu/` is TSL/WebGPU-only. Transform-feedback compute exists **only**
  inside `WebGPURenderer`'s WebGL fallback backend and is unreachable from `WebGLRenderer`.
- ⛔ **No terrain, quadtree, clipmap, or planet-LOD helper of any kind** anywhere in `examples/jsm/`.
  `[READ-LANE]` No shortcut, and no house style to conform to. Chunking policy is yours to define —
  which suits one-pipeline, since the law stays in shared modules rather than in an engine helper only
  one front-end would wire up.
- ⛔ **`THREE.LOD` is discrete `.visible` toggling** between prebuilt meshes with hysteresis
  (`LOD.js` `update(camera)`). `[READ-LANE]` It has no morphing and no continuous parameter. It is
  **strictly worse** than the `smoothstep(20, 6, distanceRadii)` ramp already shipped; adopting it is
  a regression. Its one transferable idea is **hysteresis**, which any chunk-swap scheme will need.

### 4.4 The WebGPU / TSL question, answered with its real cost

**`[WEB-VERIFIED-ME]`** — https://threejs.org/manual/en/webgpurenderer.html, fetched this session,
verbatim:

> "Custom materials based on `ShaderMaterial`, `RawShaderMaterial` and modifications of built-in
> materials via `onBeforeCompile()` are not supported in `WebGPURenderer`."
> "This part of your application must be ported to node materials and TSL."
> "The renderer itself is still in an experimental state although its maturity level has been greatly
> improved in the last years."

**The cost, plainly.** Adoption means reimplementing a ~366 KB fragment shader with 356 uniforms in
TSL. That is not a port — it is the World Engine, rewritten, with **no incremental path in r183 and no
fallback to the GLSL you trust.** And per `docs/FEATURES/orbit-ring-depth-artefact.md §3`, shipped
GLSL here has zero numeric test coverage — a refuter mutated a shipped shader four ways, including
multiplying every root's clip-w by 0.37, and all 102 tests stayed green. You would be retranslating
the part of the system with the weakest verification net. Separately, it discards `RetroRenderer`'s
post pass, which **is** the aesthetic.

**What it would buy:** compute shaders. **Nothing in the proposed architecture needs them** —
closed-form `h(dir)` is evaluated in the vertex and fragment stages, and chunk meshes are CPU-authored.

**The one thing that changes the shape of the question — and it inverts the usual framing.**
`[WEB-VERIFIED-ME]` `gh api repos/mrdoob/three.js/pulls/32851` → **"WebGLRenderer: Add NodeMaterial
compatibility layer," merged 2026-03-14**, shipped in r184. `gh api .../contents/examples/jsm/tsl?ref=r185`
lists **`WebGLNodesHandler.js`**; `ls node_modules/three/examples/jsm/tsl/` on the installed r183 does
**not**, and `grep setNodesHandler src/renderers/WebGLRenderer.js` returns 0. So:
`renderer.setNodesHandler(new WebGLNodesHandler())` lets NodeMaterials and ShaderMaterials coexist in
one scene **on WebGLRenderer**. It runs TSL on WebGL — it does not run GLSL on WebGPU. The 366 KB
rewrite is still required; it just becomes incremental and A/B-testable against the live GLSL.

**Recommendation: know it exists; do not do it now.** It is the only non-big-bang route to TSL and the
only strategic reason to take the r184 upgrade. It buys nothing this program needs today.

---

## 5. Target architecture, and the smallest first increment

### 5.1 The target (proposed — this is the shape, not a decision)

**Cube-sphere quadtree, chunk vertices on the ideal sphere, one tree from orbit to the ground.**

1. **Cube-sphere, not UV sphere.** Bounded, pole-free distortion; the known cost is corner stretch.
   `[WEB-VERIFIED-LANE: acko.net "Making Worlds", dexyfex planetary terrain]`
2. **The root of the quadtree IS the distant sphere.** "Distant sphere" and "chunked surface under me"
   are the same representation at different depths — **there is no transition event to pop.** This is
   the argument against ever building a two-representation KSP-style scaled-space design: that seam is
   manufactured by the choice, not inherent. `[WEB-VERIFIED-LANE]`
3. **Chunk vertices on the ideal sphere; the shader adds all relief.** Which is what the existing
   shader already does — it just has one chunk at level 0. Zero shader edits to the noise domain.
4. **CDLOD-style vertex morph, not skirts** (see Blocker 2 for why skirts are hostile here). CDLOD's
   stated main disadvantage — "non-trivial preprocessing, static dataset requirement" — **does not
   apply**, because `h(dir)` is closed-form and evaluable anywhere at any resolution. This codebase
   gets CDLOD's morph benefit without paying its main cost. `[WEB-VERIFIED-LANE: github.com/fstrugar/CDLOD]`
   And CDLOD's "one LOD function over the whole mesh, based on precise 3D observer distance" is exactly
   the shape of the existing `lodRampOf = smoothstep(20, 6, distanceRadii)` — the current law
   *generalises* into the selection metric rather than being replaced by it.
5. **Split/merge on screen-space error in pixels** — which couples it to render resolution. That is the
   same variable as §7 Q4.
6. **Chunk-local vertex frame (Cesium RTC pattern), chunks parented under the body group** so the world
   rebase carries them structurally and chunk math never sees the offset. Buys 3–4 orders of vertex
   precision off three's existing float64 CPU chain. `[WEB-VERIFIED-LANE: CESIUM_RTC extension, Cesium
   graphics-stack post]`
7. **Drawn through `BatchedMesh`** — one draw call where `WEBGL_multi_draw` exists (it does on Max's
   machine), engine's own CPU loop where it doesn't.
8. **All law under `src/worldengine/`, consumed by both front-ends**, and reaching all three surface
   programs (`LAB_VERTEX_SHADER`, `Planet.js` `SURFACE_VERTEX`, `Moon.js`) — which is precisely why the
   displacement law belongs in a shared GLSL leaf and not inline in the lab shader.

**Deliberate non-goal, worth stating out loud:** heightfield-on-a-sphere cannot express caves,
overhangs, or terrain deformation. No Man's Sky gets those from a **voxel/isosurface** pipeline
(Hello Games' own GDC 2017 session describes "voxel-based world generation, through polygonization"
`[WEB-VERIFIED-LANE]`) — a fundamentally different generator, not a refinement of this one. Choosing
heightfield is choosing against that capability set. That should be a stated non-goal, not an accident.

### 5.2 ⛔ Before anything: two measurements nobody in this research took

**This is the honest first move and it is not a build.** Five lanes produced four mutually-exclusive
explanations of Max's "same octave budget, more lab detail" and ran **zero** experiments. Working-Claude
should take these before the scoping interview, because they decide which lane is even relevant:

**M1 — Which shader was Max looking at?** Run `_lab.approachSweep` on a **default-config** game body.
If `liveOctaves` comes back `null` across the ladder, that body is legacy — and the comparison Max made
was between two *different shaders*, not between two tessellations of one. `[SOURCE-VERIFIED-ME]`:
`agentFraming.js:96` reads `u.uOctaves?.value`; **grep for `uOctaves` in `src/objects/Planet.js`
returns zero hits** — the legacy uniform is `uReliefOctaves` (`:1674`). The legacy relief chain is one
`fbmd` (`:591`) plus `craterEjectaCombiner` (`:600`) plus per-type branches, against the lab's `fbmd`
plus **26** h/grad-writing combiners. If Max was on a default body, "the lab has more detail" is
explained by ~25 missing relief combiners, and chord sag, sampling rate, FOV and float32 precision are
all red herrings.

**M2 — A matched, configuration-labelled A/B pair Max can look at.** Same seed, same distance in body
radii, **FOV normalised** (game 70° vs lab 50° = 2.25× disc area at matched radii `[MEASURED-LANE]`),
with `pixelScale`, `pixelRatio`, `antialias`, and *which material is admitted* stamped on the shot.
His own approach-LOD criterion needs something to look at; nothing in this package is that.

### 5.3 The smallest first increment that is genuinely ON the path

**Recommendation, in order. Relative sizing only.**

**Step 0 (smallest, architecture-independent, serves the constraint the program exists for):
extend the one-pipeline fence from "shared shader code" to "declared front-end render settings."**
The front-ends differ on `pixelScale` (3 vs 1), `pixelRatio` (1 vs min(dpr,2)), `antialias` (false vs
true), `logarithmicDepthBuffer` (on vs off), FOV (70 vs 50) — **and on which material is admitted at
all**. The logdepth divergence *is* documented in-source at `planet-lod-shaders.glsl.js:34`; none of
the others is recorded anywhere `[MEASURED-LANE: grep of the divergence docs]`. Until that ledger
exists, every lab-vs-game comparison is uncontrolled and the next several sessions will re-derive the
same four competing explanations. **What it will achieve:** M1 and M2 become meaningful and repeatable.
**What it will not:** it changes nothing Max can see on a planet.

**Step 1 (first real build, on-path, nothing thrown away): the level-0 cube-sphere.**
Replace `SphereGeometry(r, 96, 48)` with six cube-sphere chunks at comparable vertex count. No
quadtree, no split/merge, no displacement, **no new shader code** (§2.1 — the shader is
topology-agnostic). The root of the quadtree *is* the sphere, so this is the base case, not a stepping
stone; its generator survives into `BatchedMesh` where chunks become batch entries.
- **What it will achieve:** uniform angular sampling and no pole convergence, i.e. equal or slightly
  better silhouette at the same vertex budget — and a chunk generator that the whole rest of the
  program builds on.
- **What it will NOT achieve:** any new surface detail. Relief is fragment-side. If Max expects to
  *see* something, this is not it, and saying otherwise would be dishonest.
- **Scope it with these audits up front, or it is not small:** `bodyRadiusOf(mesh.geometry)` and
  `ensureLabAttributes` at the `src/main.js:2454-2459` swap site; `Moon.js:33`'s own geometry
  (`[96,48]` terrestrial / `[64,32]` otherwise) and its own material; `BatchedMesh._validateGeometry`
  requiring `aBand/aShear/aMush/aStorm` on **every** chunk with identical `itemSize` even where
  unused. The uv audit is already done and written down (`Planet.js:1565-1568`).

**Step 2: quadtree split/merge on screen-space error + CDLOD morph + `BatchedMesh`.** This is where the
"vertex shader does not displace" fence gets **deliberately re-opened** — and replaced with a test that
pins the NEW invariant (morph target == parent grid position), not deleted. Same for
`TAP_TARGET_SUBSTITUTIONS` in `fieldSampler.js`, which will throw by design, and for
`tests/swap-ledger.test.js`'s hard-pinned `351` uniform count.

**Step 3: displacement**, from a vertex-stage source that is the *same source the fragment shader
shades from*. Chunk-local frame and split-octave phase ride along here.

**Optional, cheap, genuinely orthogonal: parallax occlusion mapping.** Fragment-side only, consumes the
`h(dir)` that already exists in GLSL, no chunk system, no displacement, no fence removal. Its one
documented limitation is the silhouette `[WEB-VERIFIED-LANE: en.wikipedia.org/wiki/Parallax_occlusion_mapping;
Tatarchuk SIGGRAPH 2006 course]` — which is the one thing the indexed-`SphereGeometry` swap already
addressed. **It is not thrown away by chunking**: POM operates inside chunks too. If Max's "detail"
turns out to mean *surface texture and self-shadowing* rather than *silhouette*, this is the highest
value-per-unit-work item in the whole dossier.

---

## 6. ⛔ Dead ends — work that would be thrown away

Specific, and unhesitating.

1. **⛔ Raising the octave ceiling.** Closed by Max, and the measurement agrees. Note also that the
   prior-art lane's *explanation* of why it did nothing (the `fwidth` clamp) is **wrong for the
   shipping configuration** — `Planet.js:591` passes the literal `0.0` as `fwBase`, so
   `uFwClamp = 1` at `:1683` is true and multiplies by 1. `[SOURCE-VERIFIED-ME]` The clamp costs the
   **lab** detail, not the game's. Do not build on that mechanism without re-checking which material
   you are in.

2. **⛔ Subdividing or refining the existing UV `SphereGeometry`.** Adds zero fragment detail (relief is
   fragment-side). Every vertex is discarded when chunks arrive. And it is the wrong base — UV spheres
   converge at the poles; cube-spheres do not. Pure waste.

3. **⛔ Displacement from the baked relief cube as the first increment.** Dead twice over.
   (i) `uReliefBakeCube`, `uReliefBakeStrength` and `uCraterBakeRestore` are **absent from
   `makeUniforms`** (351 keys measured), and `LabPlanetMaterial.js:61-92` binds 1×1 black placeholders
   because the game never routes a bake `[MEASURED-LANE]`. It renders in the lab and is a **silent
   no-op in the game** — the exact drift this whole program exists against. (ii) A 36 km/texel cube
   driving a 417 km/quad mesh cannot express anything a chunk system would later want.
   **Keep exactly one thing from this line of enquiry:** `textureCube` is fragment-prefix-only in
   three's GLSL3 conversion; use `texture(cube, dir)` and never put a bare `textureCube` in a shared
   GLSL leaf. `[SOURCE-VERIFIED-ME]`

4. **⛔ "One baked field, three readers" as the landing architecture — the most expensive throwaway in
   this package.** It makes a 40,000-node carrier the authority for both displacement and collision.
   That is **112.9 km mean spacing** on an Earth-sized world `[MEASURED-LANE]`, against a game mesh
   already at 328 km between vertices. The program's own stated criterion — detail must **keep
   resolving** on approach — is defeated by a 113 km field before the first chunk exists. And when
   chunked LOD lands, closed-form `h(dir)` is evaluated per chunk at chunk resolution, so the carrier
   and the 256²×6 cube become precisely the "static dataset / texture cache" that makes geometry
   clipmaps wrong here. Worse: it requires standing the **entire lab bake pipeline up in the game for
   the first time** — the largest single piece of new construction proposed anywhere in this research —
   and then discarding it.

5. **⛔ A hand-written JS/GLSL twin of the height field, written to place chunk vertices.** Measured
   impossible for the current `sin`-based hash (§3 Blocker 3). This is the failure mode
   `orbit-ring-depth-artefact.md §3` already records: "Any future fix here that is validated only
   against the JS twin is validating something that does not ship." **My correction to the lane:** the
   escape route (integer bit-hash on lattice indices) is *not* blocked by the GLSL version — these are
   plain ShaderMaterials and compile as `#version 300 es` `[SOURCE-VERIFIED-ME]`. It is blocked by the
   fact that it **re-rolls every existing seed's terrain**, which is Max's decision, not a refactor.
   Either way it is not a prerequisite for *rendering*.

6. **⛔ Hardware tessellation.** `[WEB-VERIFIED-ME]` Absent from WebGL2 (needs ES 3.1; WebGL2 targets
   ES 3.0). Most terrain literature and every Unity/UE writeup assumes it. Any design that inherits
   that assumption is dead on arrival.

7. **⛔ Migrating to `WebGPURenderer`/TSL.** `[WEB-VERIFIED-ME]` ShaderMaterial unsupported; must port to
   node materials and TSL; renderer still described as experimental. ~366 KB and 356 uniforms rewritten
   with no incremental path in r183, no fallback, on the code with the weakest test net in the repo —
   and it discards the RetroRenderer post pass, which is the aesthetic. The compute shaders it buys are
   not needed by anything proposed here.

8. **⛔ `THREE.LOD`.** Discrete `.visible` toggling between prebuilt meshes. Strictly worse than the
   continuous ramp already shipped. Adopting it is a **regression**. Salvage exactly one idea:
   `hysteresis`, which any chunk-swap scheme will need as an anti-flicker guard.

9. **⛔ Geometry clipmaps / spherical clipmaps as the target architecture.** They exist to stream huge
   *stored* elevation datasets out of core; the whole apparatus is a toroidal texture cache. `h(dir)`
   is closed-form and cheap to evaluate anywhere at any resolution, so the cache is maintenance cost
   with no payoff. `[JUDGEMENT, on `[WEB-VERIFIED-LANE]` Losasso & Hoppe 2004, Clasen & Hege 2006,
   Dimitrijević & Rančić]` Named here so it can be rejected on evidence rather than ignorance.

10. **⛔ Two-representation "distant sphere vs local terrain" (KSP-style scaled space).** It manufactures
    the seam a cube-sphere quadtree avoids by construction — the distant sphere *is* quadtree depth 0.

11. **⛔ Flipping `reversedDepthBuffer` as a precision fix.** It would require stripping `logdepthbuf`
    chunks from 14+ shaders including the **shared** one whose fence tests count those includes, needs
    `EXT_clip_control` (unverified on Max's stack), and delivers the same result as the one-line float
    depth change. `[READ-LANE + maintainer on PR #29579: "You should not use those together."]`
    ⚠ On the **current** 24-bit fixed buffer it measures ~40,000× **worse** than log depth.

12. **⛔ Lowering `REBASE_THRESHOLD_SQ` to reach sub-metre.** Arithmetically impossible — the required
    trigger radius (0.0112 scene units for 10 cm) is **inside** an Earth-radius planet (0.0426).

13. **⛔ Changing the scene unit / `AU_TO_SCENE`.** float32 precision is relative. Renaming the unit
    buys exactly zero. Any proposal that reaches sub-metre this way is void.

**Two things that are NOT dead ends, correcting hedges in the research:**

- **The level-0 cube-sphere generator survives** into `BatchedMesh` — chunks become batch entries. What
  gets thrown away is only code assuming single-`Mesh`/`SphereGeometry` semantics, and that set is
  small and enumerable up front (§5.3 Step 1).
- **The chunk-local render frame is the one structural proposal that survives every other choice** —
  but it is not a *first* increment, because nothing today produces a chunk to put in a frame.
  Sequencing it first is building a frame for an absent object.

---

## 7. Open questions for Max — decisions with trade-offs

These are the forks where a real choice exists. Each is stated with what the options will and will not
achieve. Working-Claude should take measurements M1/M2 (§5.2) *before* this conversation, because they
change which of these matter.

**Q1 — What does "detail" mean?** Silhouette shape / surface texture density / shading contrast /
feature variety. The five research lanes split cleanly along exactly those four axes and they select
**different architectures**. If it's silhouette → chunked geometry. If it's surface texture and
self-shadowing → parallax occlusion mapping is far cheaper and lands sooner. If it's feature variety →
the answer may just be finishing the pipeline port, since the default game shader runs one relief
combiner against the lab's 26. One sentence from you closes it.

**Q2 — Is LANDING in scope, or APPROACH?** The stated criterion is "detail must keep resolving on
approach." Landing adds a collision authority and a second architecture (CPU height). **If approach is
the goal, Blocker 3 drops out entirely and the program roughly halves.** If landing is the goal, you
also have to pick what the ship touches: the *broad hill* (a baked field, ~113 km features — the only
thing reachable from any architecture in view) or the *crater rim* (not reachable — crater rims, dunes
and river valleys are fragment-only and the ship would pass through them).

**Q3 — How much relief do you want to SEE at the limb?** Through the ÷3 retro buffer at 2.2 body radii,
the smallest displacement that visibly breaks the circle is **~1–2% of body radius = 64–128 km on an
Earth-sized world = 3–6× Earth's entire Everest-to-Marianas range.** That's the number the decision
turns on. Options: **(a)** accept a stylised exaggerated silhouette — a potato — as the look;
**(b)** displace at a physically honest ε and accept the limb stays a circle until you are very close,
buying shape only from chunk-scale relief at low altitude; **(c)** declare shading amplitude and
geometry amplitude as two deliberately different numbers. The shading already claims 23–33% of body
radius, so **(c) is arguably where the codebase already is** — but right now it is an accident, and it
has to become a declared act, because the two stop describing the same surface.

**Q4 — Does the planet pass have to render at 1/3 resolution?** `pixelScale = 3` + NearestFilter **is**
the look. But screen-space error is measured in *pixels*, so it is the same variable as the chunk split
metric — the aesthetic knob and the LOD knob are one knob. There is a middle path nobody prototyped:
render the planet pass higher and downsample deliberately, keeping apparent pixel size while raising
sampling rate. **Cost unknown** — nobody profiled a planet frame, and raising sampling rate multiplies
the work of a large fragment shader by 9× to 36×. Your aesthetic call, and it caps how fine chunks are
ever allowed to get.

**Q5 — Are you willing to re-roll every existing seed's terrain?** That is the price of an integer
bit-hash, which is the only route to a true CPU height twin that agrees with the GPU. Only relevant if
Q2 = landing *and* you want collision independent of a bake. Saying no is completely reasonable; it
just means the bake is the authority and Q2's "broad hill" answer follows.

**Q6 — Moons: in or out?** `Moon.js` carries its **own** vertex and fragment shaders and its own
geometry, and moons are the bodies you approach closest in this game. There are three surface programs,
not two. Scoping moons in roughly doubles the surface area of any displacement law; scoping them out
means the bodies you get nearest to stay perfect spheres.

**Q7 — What is one height unit in kilometres?** Nothing in the pipeline says, and the instrument
deliberately refuses to guess (`fieldSampler.js:120-140`). Displacement by a physical amount cannot be
specified until this is declared. It is a **world-design** decision — how tall are the mountains on a
Well Dipper world — not a technical one, which is why it is yours.

---

## 8. What this research did NOT establish

Carried forward honestly. Several of these are load-bearing.

1. **⭐ Nobody ran a live A/B.** Five lanes, four mutually-exclusive explanations of the same
   observation, zero experiments. One lane wrote out its own falsification test
   (`retroRenderer.pixelScale = 1` at 2.2 radii, seed `lab-procedural-6`) and did not run it. The
   package has more theory than any of it can currently support.

2. **⭐ Nobody pinned the configuration.** The engine lane measured a 366,237-byte fragment shader on
   "game bodies"; the displacement lane established the lab pipeline is off by default. **I verified
   `LAB_GAS_BODIES_DEFAULT = false` at `src/objects/Planet.js:2158` and grepped the repo: there is no
   production enable site — every `setLabGasBodiesOverride` / `__wdLabGasBodies` reference outside
   Planet.js is in `tests/`.** `[SOURCE-VERIFIED-ME]` Both lanes are right about different
   configurations and neither said which it was in. The engine lane's session almost certainly had the
   flag set in localStorage.

3. **⭐ This propagates into the brief's own MEASURED block — flagging as instructed.** "Both
   front-ends report the SAME live octave value at every rung" can only be true of a game body carrying
   the **lab** material. `agentFraming.js:96` reads `u.uOctaves?.value`; **grep for `uOctaves` in
   `src/objects/Planet.js` returns zero hits** — the legacy uniform is `uReliefOctaves`
   (`:1674`, default `RELIEF_OCTAVES = 4.0`). `approachSweep` itself carries a loud
   `lodDrivenNote` for exactly this case (`src/main.js:3492-3506`). `[SOURCE-VERIFIED-ME]`
   ⚠ **Nuance in the codebase's favour, which I checked:** the shared LOD **law** *does* reach legacy
   bodies — `BodyRenderer.js:213-216` writes `autoOctaves(lodRampOf(distanceRadii))` into
   `uReliefOctaves`. It is the **instrument** that doesn't, not the law. So "the LOD law is genuinely
   shared" survives intact; "both front-ends report the same *live* octave value" needs its
   configuration stated. **Everything else in the MEASURED block held under checking**, including raw
   `position` in `gl_Position`, `SphereGeometry(r, 96, 48)`, and `LODManager` touching no meshes.

4. **⭐ It also unseats every lane's explanation of Max's observation.** If Max was looking at a default
   body, the game ran **one `fbmd` + `craterEjectaCombiner` + per-type branches** against the lab's
   **`fbmd` + 26 combiners** — and "the lab has more detail" is explained by ~25 missing relief
   combiners. Chord sag, fragment sampling rate, FOV asymmetry and float32 precision would all be red
   herrings. **No lane considered this.** It is why M1 (§5.2) must run first.

5. **No performance data of any kind.** Nobody measured what a planet costs per frame today. This is
   load-bearing for the most-recommended action in the package — raising the planet pass's sampling
   rate is 9× to 36× more fragment work on a shader with a recorded 29.8 s cold link
   (`LabPlanetMaterial.js:167`, itself read from a comment, not measured).

6. **No screenshots.** Nothing in this package is something Max can look at, which is exactly what his
   own approach-LOD criterion needs.

7. **Corrections to lane findings, carried forward:**
   - The engine lane's headline **chord-sag arithmetic is wrong by 3.33×**. It took base frequency =
     `uNoiseScale` = 4; the actual base is `uNoiseScale * 0.3 * uDispDomainScale`
     (`heightNoise.glsl.js:89`). Recomputed: game sag ≈ **16.4%** of the finest feature, lab ≈ **2.3%** —
     not 55% and 7.7%. The 7.1× *ratio* survives; "the game's domain wobbles by half a feature width"
     does not. Worse, the two halves came from different front-ends — the legacy game path sets
     `RELIEF_DOMAIN_SCALE = 1.0/0.3` (`Planet.js:1381` `[SOURCE-VERIFIED-ME]`), which cancels the 0.3.
   - The engine lane's **"LOD material swap (46 KB far / 366 KB near)" is an invented causal story.**
     `LODManager.js` is 122 lines and touches no material `[SOURCE-VERIFIED-ME]`;
     `BodyRenderer.setLOD` swaps procedural↔TEXTURED only for bodies with a `profileId`, and
     `labPipelineAdmits` refuses any body that has one. The real cause is the admission flag.
   - `perturbAnalytic`'s normal identity (1.71e-6 degrees) is **plausible-unreplicated** — the verifying
     script lives in a subagent scratchpad and nobody re-ran it. The downstream amplitude constants
     (0.231–0.330) I did confirm from source.
   - Fragment-shader byte size: 366,237 (live material) vs 366,262 (module string). Either way it is the
     **lab** material, not "the game's fragment shader in the default configuration."

8. **`BatchedMesh` + this ShaderMaterial was never tested together.** The `USE_BATCHING` inference is
   sound and I re-verified it, **but** three does not auto-inject `<batching_pars_vertex>` /
   `<batching_vertex>` into a custom ShaderMaterial `[SOURCE-VERIFIED-ME]` — hand-adding them is a
   shared-law edit. Nobody checked attribute-location pressure against `MAX_VERTEX_ATTRIBS` either.

9. **`WebGLNodesHandler`'s shipped limitations** (no VSM shadows, no MRT nodes, `WebGLRenderer.compile`
   unusable) are quoted from PR #32851's body, not from the shipped file — it is not in the installed
   r183 and I confirmed only its existence in the r185 tree. `[UNVERIFIED]`

10. **The 26,824-body-radii rebase figure was not reproduced.** The stale-`matrixWorld` explanation is
    an inference from reading `maybeRebase`. Relatedly, `WorldOrigin.js`'s own header attributes the
    original bug to float32 CPU accumulation, but `THREE.Vector3` is float64 — the mechanism as
    documented appears **misattributed**. That is not a claim the rebase is unnecessary; it is a warning
    against sizing any new threshold against a constraint that may not exist.

11. **The ~109 m depth floor has no observed symptom.** Arithmetic solid; visual consequence predicted.
    Also unconfirmed at runtime: that `DEPTH32F_STENCIL8` yields a framebuffer-complete FBO on Max's
    stack, and whether `EXT_clip_control` is even present.

12. **Never scoped by anyone:** moons (`Moon.js`'s own shaders and geometry); the **cockpit** pass and
    its interaction with a chunked/displaced planet, HELM/autopilot mode ownership on descent, and the
    live stencil buffer (`WarpPortal.js:84-87`, on a DEPTH_STENCIL attachment); **rings, atmosphere and
    orbit lines** against chunked geometry, in a repo with a recorded depth artefact in exactly that
    area (`docs/FEATURES/orbit-ring-depth-artefact.md`); **raycasting/picking** against a displaced
    visual surface vs an undisplaced pick surface; and the cost of the per-body bake **in the game**
    (`buildIrregularSphere(40000, LLOYD_ITERS)` runs a spherical Delaunay plus Lloyd relaxation and was
    never timed — the largest unmeasured number behind the bake recommendation).

13. **Cross-vendor GPU behaviour.** One machine, one RTX 5080. The CPU/GPU hash divergence direction is
    unaffected by this (a twin that only matches on Max's GPU is not a twin), but there is no
    cross-vendor data, and the WebGL2 guaranteed floor of 16 vertex texture image units comes from a
    search summary, not spec text — `registry.khronos.org` returned HTTP 403 to two lanes.

14. **Commercial precedent is thinner than it looks.** Elite Dangerous's actual terrain LOD topology is
    **not publicly documented** — one attributed Frontier statement exists (Braben on needing full
    64-bit precision) and nothing on chunking, quadtrees, or LOD transitions; everything else in
    circulation is journalist description or fan inference. No Man's Sky's specific isosurface/meshing
    algorithm is not documented by Hello Games. Star Citizen coverage is entirely secondary (wiki +
    press). Do not build a design argument on any specific claim about how those games chunk or
    tessellate.
