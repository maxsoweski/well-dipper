# Map — Production LOD Lab Renderer + WS4 (E6 grain / E9 carve wiring)

**Assessment date:** 2026-06-25 · **Surface:** the PRODUCTION lab renderer
(`planet-lod-lab.html` + `planet-lod-lab-core.js` + `planet-lod-height.glsl.js` +
`planet-lod-tectonic.js` + `planet-lod-rivers.js`) and the WS4 workstream that wired
E6 tectonic grain + E9 subtractive carve into it.
**Scope:** READ-ONLY. No code edited. This is the surface whose Max-UAT FAILED.

This is the central finding the parent assessment needs: **the production lab does
NOT build a structural relief DATA substrate.** It generates per-body SCALARS + a
latitude-banded ORIENTATION field on the CPU, and synthesizes the relief itself from
procedural noise inside the fragment shader, merely *steered/oriented* by that
orientation field. The one genuine baked structural field that crosses CPU→GPU is the
drainage **carve cube** — but even that, on the LIVE render path, carries an
order-tent depth, not the stream-power Δ that the WS4 unit ACs verified. The UAT
finding ("orientation overlay, not structure as data") is **CONFIRMED** by the GLSL.

---

## (a) What the production lab generates as DATA vs synthesizes in the shader

### CPU-side "data" = per-body SCALARS + seeded axes (NOT a relief field)

`deriveUniforms(drivers, qualityTier)` (`planet-lod-lab-core.js:496-953`) is the whole
CPU generation layer. It is a **physics-driver → flat-uniform** mapper. For each relief
family it emits:

- **scalar amplitudes / gates** — `mountainAmp` (`:648`), `chasmaDepth` (`:678`),
  `scarpStrength` (`:697`), `plateauStrength` (`:715`), `tesseraStrength` (`:721`),
  `volcanismStrength` (`:733`), `lavaCoverage` (`:754`), `craterDensity` (`:607`),
  `cryoActivity` (`:784`), `subStrength` (`:845`), `glacialStrength` (`:856`), etc.
- **per-feature SEEDED ORIENTATION AXES**, each hashed independently from the planet
  seed via `seededUnitVec3(seed+N)` (`:483`): `orogenyAxis` (`:662`, a vec2 angle),
  `chasmaAxes` (`:685`, ×3 vec3), `scarpAxis` (`:707`), `tesseraAxes` (`:725`, ×2),
  `lavaAxis` (`:772`), `cryoRidgeAxes` (`:888`, ×2).
- a few classifier enums (`liquidSpecies`, `volatileSpecies`) and shape constants.

**There is NO per-fragment / per-node height field, no province-of-relief array, no
mutable substrate of any kind in this path.** Every value above is a single scalar or a
single unit vector PER BODY. The "where the mountains actually are" and "how tall here"
decisions are made *in the shader* by sampling noise. The CPU hands the GPU a recipe
(amplitudes + directions + gates), not a generated terrain.

This is structurally the OPPOSITE of "procgen decides, render expresses": the renderer
is still deciding the relief; procgen only supplies knob values and one shared compass
needle (post-WS4).

### Shader-side = relief SYNTHESIZED from noise, oriented by axes

In `planet-lod-height.glsl.js`, each relief feature is a **combiner** that builds its
landform from in-shader procedural noise. Canonical example — F1 mountains
(`fbmdRidged`, `:944-986`):

```
vec4 n = noised(q * freq + uMacroOffset + uMountainDomainOffset); // <- noise IS the relief
float signal = uRidgeOffset - abs(n.x);   // fold
float sq = signal * signal;               // sharpen
h += amp * weight * fade * sq;            // height accumulates from the noise sample
```

The height `h` comes entirely from `noised(...)`. The seeded axis (`ax`) only stretches
the SAMPLING DOMAIN across-strike (`xzS`, `:955-957`) so ridges elongate into "belts."
The axis chooses an *orientation*; the noise produces the *structure*. Same pattern for
`canyonCombiner` (`:1982`, graben distance to a great circle ⊥ a seeded plane normal),
`scarpCombiner` (`:2026`, iso-contours of `dot(pos,axis)+warp`), `tesseraCombiner`,
`lavaPlainsCombiner`, `cryoRidgeCombiner`. In every case: **axis = orientation input;
noise = the actual landform.**

The full combiner chain runs in `main()` (`planet-lod-lab.html:299-460`) and in the
router's `ROUTER_MAIN` (`planet-lod-rivers.js:169-209`) — ~25 combiners, each
`h += <noise-derived delta>`. The relief is a sum of noise fields, gated by CPU scalars,
oriented by CPU axes.

---

## (b) Exactly what WS4 ADDED

WS4 (`docs/WORKSTREAMS/world-engine-relief-wiring-2026-06-25/`) wired TWO of the ~15
engines into the lab: **E6 tectonic grain** and **E9 subtractive carve**. Verdict =
`VERIFIED_PENDING_MAX` at `deca261` (9/9 objective ACs PASS; the 10th, `landscape-with-
history`, is the UAT gate that FAILED). Local-only, not pushed.

### E6 "grain" — a latitude-banded orientation DIRECTOR + 2 scalars (CONFIRMED thin)

The grain is baked in `planet-lod-tectonic.js`:

- **`bakeTectonicGrain(...)`** (`:76-128`) builds a carrier over the SAME
  `buildIrregularSphere` mesh the router uses, runs the production WS2 writer
  `writeGrainSphere(carrier, drivers)` (imported from `src/worldengine/base/tectonic.js`),
  and emits per-node arrays:
  `{ grainAngleSmooth, grainMag, regime, strikeWorldX/Y/Z }` — N nodes.
- The strike **angle** at each node is `smoothStrikeAngle(sMer, sZon) =
  atan2(|sZon|, |sMer|)` (`:44-46`) — a continuous **director** re-derived from the
  stress components `stressAtLat(lat, drivers)` (`:107`). `stressAtLat` is a **pure
  function of latitude** (Melosh despin + radial strain). So the grain carries **ZERO
  within-body longitudinal structure** — it is latitude-banded by construction
  (the grounding dossier flags this explicitly, §"TL;DR" item 5, and §Slice 1).
- The director is converted to a world-space unit strike via the node's tangent frame
  (`strike = cos(angle)*east + sin(angle)*north`, `:115-124`).
- `grainMag` (0..1 confidence) and `regime` ({NORMAL,STRIKESLIP,THRUST}→{0,0.5,1}) are
  scalar classification channels.

This is packed into a **HalfFloat strike-only cube** (`buildGrainCubeGeometry` `:145`,
`createGrainCube` `:187`): RG = world strike.xy, B = grainMag, A = regime/2. Baked once
per body in `createRiverOverlay.route()` (`planet-lod-rivers.js:1020`, via `bakeGrainCube`
`:98`), same cadence as the carve cube.

**So the grain field is exactly what the UAT said it is: a thin latitude-banded
orientation director (one strike vector per direction) + two scalars (mag, regime).** It
is NOT relief, not height, not a structural province map. It is a compass field.

### E9 "subtractive carve" — TWO distinct paths, only one is LIVE

This is the part most worth untangling, because the verdict's PASS and the UAT's FAIL
are about *different code paths*:

1. **LIVE render carve (what you see on screen).** In `planet-lod-lab.html:405-427`:
   ```
   carveDepth = sampleCarve(N, carveGrad);   // textureCube(uRiverCarveMap, dir).r
   ...
   h -= carveDepth * uRiverCarveDepth;        // :425 — REAL height drop (floods via F14)
   grad += -carveGrad * cr * uRiverCarveStrength;  // bends V-walls
   ```
   `sampleCarve` (`:237-253`) reads the **carve cube R channel**. That R channel is the
   `aDepth` attribute from `buildValleyGeometry` (`planet-lod-rivers.js:651-766`), and
   `aDepth` is set from **`depthAt(strahler[idx])`** (`:663-665`, `:753`) — the
   **order-only Strahler tent** (depth lerps `VALLEY_DEPTH_LO..HI` by stream order).
   So the LIVE carve depth is **order-keyed**, baked from the REAL routed dendritic
   network (this is genuine — the network IS routed by priority-flood + D-inf +
   Horton-Strahler over the real readback height; see below), but its DEPTH is a tent
   on stream order, not stream-power.

2. **Unit/probe carve (what the verdict's ACs verified).** `perNodeIncision`
   (`planet-lod-rivers.js:790-860`) is the stream-power law
   `Δ = -K·A^m·S^n` (`:845`) over channel nodes, normalized into `[LO..HI]`, strictly
   `≤ 0`. `applyIncision` (`:871-876`) folds it onto an IMMUTABLE COPY. This is what
   `carve-subtractive` and `epoch-build-identical` (unit ACs) prove, and what the
   `epoch-carve-visible` live AC reads — but ONLY through the `sampleRoutedHeight`
   **probe** (`planet-lod-lab.html:5775-5812`), which operates on the JS-side routed
   substrate array (`ov.height`, the `ROUTER_MAIN` readback), **NOT the rendered
   shader chain.** The probe's own comment is explicit: "*NOT a rendered-chain sample
   (honest per plan D5c — the full rendered-chain readback is the deferred T12b)*"
   (`:5768-5771`, `:5786`).

**Net:** the stream-power Δ field is genuinely baked & strictly subtractive, and the
drainage network is genuinely routed from the real height — but the live render still
subtracts the **order-tent carve cube**, and the stream-power Δ is verified only via a
probe over the routed array. The carve IS a real subtractive host-edit (height drops,
floods via F14), and it IS keyed to the real routed network — that part is sound and
not the source of the UAT fail. (The carve being "real, not cosmetic" is also confirmed
in the grounding dossier §"TL;DR" item 1 and §Slice 3.)

---

## (c) Is the relief shader-noise merely ORIENTED by the grain? — CONFIRMED

**Confirmed from the GLSL.** The grain feeds the combiners exactly one way: it replaces
the per-feature seeded axis with the shared strike, via a branch-guarded mix:

```
// fbmdRidged (orogeny), planet-lod-height.glsl.js:949-951
vec2 ax = uTectonicGrainStrength > 0.0
  ? grainProvinceRotate2(normalize(mix(uOrogenyAxis, normalize(sampleGrainStrike(pos).xz), uTectonicGrainStrength)), pos)
  : normalize(uOrogenyAxis);
```

The same `mix(uXxxAxis, sampleGrainStrike(pos), strength)` → `grainProvinceRotate(...)`
pattern appears in all six grained combiners: orogeny (`:949`), chasma (`:1988`),
scarp (`:2031`), tessera (`:2180/2190`), lava (`:2272`), cryo (`:2707/2720`).

`grainProvinceRotate` (`:908-918`) is a Rodrigues rotation of the strike about the
surface normal by a small angle keyed to `gProvince.x/.z` — i.e. it warps the zonal
strike into 2D using the *amplitude* province field. Its own comment names the problem:
the cube strike "*is a pure function of |lat| (latitude bands … carries ZERO within-body
longitudinal structure). To turn those zonal bands into 2D LANDFORMS …*" — so the ONLY
within-body anti-banding source is this province-keyed rotation of an orientation vector
(`:893-906`). **No relief structure crosses; only a rotated compass needle.**

Crucially, **the grained axis is consumed by the SAME noise combiners from part (a).**
The grain changes which direction `fbmdRidged` stretches its noise domain, which
direction `scarpCombiner`'s `dot(pos,axis)` iso-contours run, etc. It does NOT change
that the height is `noised(...)`-derived. So with grain ON, you get **the same
noise-synthesized relief, re-aimed along one shared (latitude-banded, province-rotated)
direction.** That is precisely "an orientation overlay" — the UAT finding is correct and
is visible directly in the shader, not an inference.

The `one-shared-grain` AC PASS (verdict: "all 6 grained features equal the shared strike
cosToShared=1.000") confirms the *plumbing* works — one field feeds six consumers — but
"they all point the same way" is an orientation property, not "the planet has a tectonic
history as data." The AC verified the mechanism it was scoped to; it could not (and did
not) verify structure-as-data, which is the deferred `landscape-with-history` UAT gate.

---

## (d) What crosses CPU→GPU as a STRUCTURAL field vs procedural noise in-shader

| Channel | Path | Nature | Structural? |
|---|---|---|---|
| ~40 relief scalars/gates (`mountainAmp`, `chasmaDepth`, …) | `deriveUniforms` → uniforms | per-body scalars | No — knobs |
| 6 seeded orientation axes (`uOrogenyAxis`, `uChasmaAxis`, …) | `deriveUniforms` `seededUnitVec3` → uniforms | per-body unit vectors | No — directions |
| **E6 grain cube** (`uTectonicGrainCube`) | `bakeTectonicGrain` → HalfFloat cube → `sampleGrainStrike` | **per-direction ORIENTATION** (strike RG) + grainMag (B) + regime (A) | **Orientation field, NOT relief.** Latitude-banded; zero longitudinal structure |
| **Carve cube** (`uRiverCarveMap`) R/G/B | routed network → `buildValleyGeometry` → HalfFloat cube → `sampleCarve` | **per-direction valley DEPTH (order-tent)** + mouth + Strahler order | **Genuinely baked structural field** (real routed dendritic network), but DEPTH is order-keyed, and it only SUBTRACTS — it doesn't author the relief it cuts into |
| All relief HEIGHT (F1 ridges, F2 craters, F4 graben, F5 scarps, F6 plateaus/tessera, F7 edifices, F8 lava, F9/F10 cryo, etc.) | in-shader `noised()` combiners | **procedural noise** | The actual landforms are synthesized here, every frame |

**The asymmetry is the whole story.** The only fields that cross as genuine per-direction
data are (i) an orientation cube (E6) and (ii) a drainage-depth cube (E9). The relief
*body* — what the planet's surface actually is — is procedural noise generated in the
fragment shader, gated by scalars and aimed by the orientation cube. The drainage cube
then subtracts from that noise. Nothing crosses that says "this region IS a continent /
a mountain belt / an impact-smoothed plain as authored data." That is the gap between
WS4 and Max's bar.

---

## Relation to the other two surfaces (for the parent assessment to reconcile)

This task only maps the production lab + WS4, but the relationship to the apparent
"tension" surfaces is now legible from the imports and the dossier:

- **`src/worldengine/base/*`** (`tectonic.js`, `baseStep.js`, `substrate.js`,
  `sphereField.js`, `adaptL0.js`, `verify.js`) is the **production-ported WS2 PRODUCER**:
  the grain DATA MODEL + `writeGrainSphere`/`stressAtLat` writers + carriers. WS4's
  `bakeTectonicGrain` imports from here (`planet-lod-tectonic.js:28-29`). It is the
  *source of truth* for the grain (D10), but it produces only the latitude-banded grain
  fields described above — NOT a full relief substrate.

- **The relief SLICE** (`relief-slice.js`, `relief-e6-tectonic.js`,
  `relief-e9-hydrology.js`, `relief-substrate.js`, `relief-base-step.js`, etc.;
  Max-UAT-PASSED 2026-06-23) is a SEPARATE, ISOLATED lab that DOES build the
  "structure as data" architecture: `runReliefSlice` (`relief-slice.js:34-51`) runs E6
  to WRITE height into a shared mutable substrate (epoch 1), then E9 to SUBTRACT drainage
  from the SAME height array (epoch 2) — the host-editor model, with body-type structural
  divergence (`:10-20`). **This is the mechanism WS4 is missing.** Its own header
  documents the deliberate non-goals that explain why it isn't wired into the lab yet:
  *flat 2D latitude-band DEM (not sphere/cubemap)*, *E9 = CPU bake-time reference (GPU
  FastFlow deferred)* (`relief-slice.js:21-26`).

**The tension resolves cleanly:** the relief slice and the production lab are at
DIFFERENT layers of the spine. The slice realizes the L1 engine model (E6 builds a real
height substrate, E9 carves it) in isolation on a flat DEM. The production lab is the L2
renderer that has NOT yet been re-architected to consume an L1 height substrate — it
still synthesizes relief from noise. WS4 took the FIRST step of bridging them (it ported
the E6 grain PRODUCER and wired its ORIENTATION output + the E9 drainage SUBTRACTION into
the L2 renderer) but stopped short of porting the slice's substrate-as-height model. So
WS4 delivered the grain's *orientation* and the drainage's *subtraction*, but not the
relief's *structure-as-data* — which is exactly why the mechanism verified and the UAT
failed.

This does NOT contradict the LOCKED design (`world-engine-wf2-synthesis.md` §2: shared
first-class mutable RELIEF SUBSTRATE that BUILD engines write and SCULPT engines edit,
host-editor, epoch-ordered). If anything it CONFIRMS the lock points at the slice's
model: the slice IS that shared mutable substrate, realized; the production lab is where
that substrate has not yet been adopted. **No lock challenged.** The honest gap is: WS4
wired E6's *grain projection* (orientation) into the noise renderer rather than wiring
the slice's *height substrate* (structure) into it.

---

## Bottom line

- The production lab generates **per-body scalars + seeded axes** (CPU) and **synthesizes
  all relief from noise in the fragment shader**. No relief substrate is generated as data.
- WS4 added (1) an **E6 latitude-banded orientation cube** (strike director + grainMag +
  regime — a compass field, not relief) and (2) an **E9 drainage carve** that genuinely
  subtracts height along the real routed network (LIVE path uses an order-tent depth cube;
  the stream-power Δ is verified via a routed-array probe, not the rendered chain).
- The relief IS still shader noise, merely **oriented** by the grain via
  `mix(axis, grainStrike, strength)` → `grainProvinceRotate`. **UAT finding confirmed
  directly from the GLSL.**
- The one thing crossing as genuine structural data is the **drainage network** (carve
  cube) — it subtracts from the noise relief but does not author it.
- The "structure as data" architecture exists and is Max-UAT-passed — in the SEPARATE
  relief SLICE (`relief-slice.js`), at a different (L1) layer, on a flat DEM. WS4 ported
  that engine's *producer/orientation* into the L2 noise renderer, not its *height
  substrate*. That is the precise, non-contradictory shape of the gap.
