# BUILD PLAN — world-engine-baked-relief-render-2026-06-25 (increment 1 of 2)

**Status:** ready to build. **Renderer:** LAB only (`planet-lod-lab.html`); game `Planet.js` OUT.
**Direction LOCKED** — this plan does not re-open A/B/C. It turns the 4 exploration maps + the
contract's 5 ACs into ordered, executable phases.

Sources this plan is derived from (read; not re-litigated):
- Contract: `docs/WORKSTREAMS/world-engine-baked-relief-render-2026-06-25/contract.json` (the 5 ACs ARE the spec)
- Intent: `docs/WORKSTREAMS/world-engine-baked-relief-render-2026-06-25/intent.md`
- Maps 01–04 (sphere carrier + E6 math / relief reference math / cube baker + renderer / river router)

---

## 0. The one failure this whole plan exists to prevent (read first)

WS4's UAT failed because the renderer kept relief **height** as in-shader `noised()` and only carried a
latitude grain — "an overlay on top." The structural trap this increment must NOT recreate is the
**WS4 data/noise split**: a half-move where ONE consumer reads the baked field and the OTHER keeps
synthesizing height from shader noise. That produces a *silent second UAT failure* — surface says one
thing, rivers say another.

**The single invariant that prevents it:** there is exactly ONE low-frequency height field per body,
materialized as data and baked into ONE direction-keyed cube, and BOTH consumers read THAT SAME cube:
1. the renderer displacement path (AC2), and
2. the river-router height source (AC3).

Every phase below is checked against this invariant. The places a naive build would re-split the data
are called out inline as **⚠ SPLIT-TRAP** with the guardrail.

### What "the SAME baked field" means concretely (resolving a map ambiguity)

Map 03 §1.6 suggested baking `createHeightSampler.read()` (the in-shader `noised()` field, GPU read) into
the cube "so the baked field == the in-shader field at strength 1." **This plan does NOT do that for the
low-frequency body.** Per the intent ("the relief the renderer draws must BE the generated structure,
read from a sphere-native baked field, NOT invented by the fragment shader"), the baked field's SOURCE
is the **net-new sphere-native E6 height writer** (Phase A) — `carrier.height`, generated as DATA from
the drivers — NOT a readback of the shader's own noise. Baking the shader noise back into a cube would
be the WS4 overlay wearing a cube costume (the height is still noise, just resampled). The cube carries
**generated structure**, and both consumers read structure. (The in-shader `noised()` chain remains, but
demoted to a *detail residual on top of* the baked low-frequency body at strength>0, and is the verbatim
whole field at strength 0 — see Phase C.)

---

## 1. Guardrails baked into every phase (from the handoff cautions)

| # | Guardrail | Where enforced |
|---|-----------|----------------|
| G1 | **No sphere-native height writer exists** — Phase A is net-new core. Adapt `runE6` math to sphere nodes via the `sphereField` carrier, mirroring `writeGrainSphere`'s write pattern. | Phase A |
| G2 | **READ `relief-e6-tectonic.js` for math, DO NOT import it** (two-copy drift guard). The math source-of-truth is the PROD copy `src/worldengine/base/tectonic.js`; the new writer lives IN that file and reuses its in-module helpers. | Phase A |
| G3 | **Re-point BOTH consumers** (renderer AC2 + router AC3) to the SAME cube. A half-move = silent UAT failure. | Phases C & D, §0 invariant |
| G4 | **Reuse existing cube-bake machinery** (`createGrainCube`/`buildGrainCubeGeometry`) to carry HEIGHT — the per-node→watertight-cube rasterization is proven seam-free. | Phase B |
| G5 | **WebGPU FastFlow path is OUT.** The existing CPU router routes on the sphere at bake time. No WebGPU exact-routing build. | Phase D (out of scope note) |
| G6 | **Determinism (AC1):** NO `Date.now`/`Math.random` in any derivation. Seed via `alea` + `simplex-noise`, keyed exactly like `runE6:102-104`. Same drivers+seed ⇒ byte-identical. | Phases A, B |
| G7 | **strength-0 byte-identical fallback** is the regression guard (WS4 pattern): BRANCH (`?:` / `if`), never `mix()`-to-0; never fetch the cube at strength 0; always bind a dummy cube. | Phases C & D |
| G8 | **`src/generation/*` byte-untouched.** `src/worldengine/base/*` gains ONLY the scoped sphere-height writer. **lab ≠ game**: NO change to game `Planet.js` / `src/objects/*`. | All phases |
| G9 | **Seam/pole continuity (AC4)** is the critics' FIRST gate — longitudinally-varying baked height on a sphere has never been exercised. Explicit headless seam/pole sample test + live orbit. | Phase E (and seam unit test in B) |
| G10 | **Commit hygiene:** stage EXPLICIT paths only (never `git add -A`; tree carries warp WIP + ~695 loose media). A file named `HEAD` exists in repo root — never `git show HEAD`. Push is ON HOLD (Max's call). | every commit |
| G11 | **Run tests SCOPED** (`npx vitest run tests/<file>`), never bare `npm test`. Dev server already up on :5173 — do NOT start one. Use chrome-devtools on GPU Chrome :9223 for live, not Playwright. | every verify step |

---

## 2. Phase dependency graph

```
A (sphere-native height writer + AC1 unit test)
│
└─► B (HEIGHT cube baker: geometry + cube + bake host wiring + seam unit test)
    │
    ├─► C (renderer samples baked height + displaces, strength-gated, strength-0 byte-identical)  ── reads cube
    │
    └─► D (river router height source re-pointed to the SAME baked field, strength-gated)         ── reads SAME cube
            │
            └─► E (seam/pole + drainage-on-baked continuity audit: headless sample + live orbit)
```

**C and D both depend on B and MUST read the same cube object** (`riverOverlay.reliefTexture`). They can
be built in either order but the §0 invariant requires both landed before AC5 (Max UAT). E depends on C+D.

---

## PHASE A — Sphere-native height writer (`writeHeightSphere`) + AC1 determinism/bounds unit test

**Goal (AC1):** generate the coarse, sphere-native relief HEIGHT field as DATA — one scalar per sphere
node into `carrier.height` — deterministically, finite & bounded. This is the net-new core (G1). No cube
yet; no renderer; no router. Pure data + a unit test that proves byte-identical re-run.

### A.1 Edit point — add `writeHeightSphere(...)` to the PROD tectonic module

**File:** `src/worldengine/base/tectonic.js` (the single source of truth; G2). Add the new export
immediately after `writeGrainSphere` (currently ends ~line 63), so it sits beside its peer and can call
the in-module helpers `reliefGravityFactor` (line 65, NOT exported — fine, same module),
`steeredNoise`, `jacobiSmooth`, and the consts `NU`/`REGIME_GAIN` directly.

**New signature (mirrors `runE6`'s extras, `carrier` first like `writeGrainSphere`):**
```js
// Sphere-native E6 build pass. Net-new peer of writeGrainSphere.
// Writes carrier.height[i] (the previously-zero channel, sphereField.js:13).
// Pure: entropy only via the alea/simplex seed strings — no Date.now/Math.random.
export function writeHeightSphere(carrier, crust, drivers,
                                 epoch = { name: 'tectonic-build' }, seed = 'e6') { ... }
```
- `carrier` = `makeSphereField(mesh)` (`src/worldengine/base/sphereField.js`). Has `.N`, `.verts[i]`
  (unit dir, +y north), `.latDegOf(i)`, `.tangentFrameAt(i)`, `.adj[i]`, and the zero-init
  `.height`/`.grainAngle`/`.grainMag`/`.regime`/`.faultDensity` typed arrays.
- `crust` = the same `{ thicknessBlob }`-bearing object `runE6` takes (from `makeBaseStep`). **But its
  `thicknessBlob(ix,iy,n)` is FLAT-grid plumbing** — see A.4; the sphere writer evaluates a sphere-native
  thickness instead.
- `drivers`, `epoch`, `seed` — identical roles to `runE6` (Map 01 §2.3, Map 02 §A0).

**Data shape produced:** `carrier.height` is mutated in place (`Float32Array(N)`). Use `+=` to match
`runE6`'s epoch-additive contract (Map 01 §1.4 / Map 02 §A6) — epoch 1 starts from the zero-init array,
so `+=` on the zeroed array == `=` for the single-epoch increment-1 case, but keep `+=` for future
overprint compatibility.

### A.2 The math to reproduce VERBATIM (Map 02 Part A / Part D checklist) — do NOT alter constants

Per node `i` (single `for (let i=0;i<N;i++)` loop, mirroring `writeGrainSphere:55`):
1. **Pre-loop, ONCE** — the seeded RNG block, copied byte-for-byte from `runE6:102-108`:
   ```js
   const disc  = (drivers.useDiscriminator && drivers.discriminator) ? ':' + drivers.discriminator : '';
   const rng          = alea(String(seed) + ':e6:' + (epoch.name || '') + disc);
   const noise        = createNoise2D(rng);
   const noisePlateau = createNoise2D(alea(String(seed) + ':e6plateau' + disc));
   const gCap     = reliefGravityFactor(drivers.surfaceGravity ?? 1);   // [0.4, 2.5]
   const silicate = drivers.rockyCrust ?? 1;                            // [0,1]
   const blend    = epoch.blend ?? 1;
   const baseAmp  = 0.6 * gCap * (0.3 + 0.7 * silicate);                // [0.072, 1.5]
   ```
   **This block IS the determinism contract (G6).** Same seed strings ⇒ same simplex fields ⇒
   byte-identical output. The seed strings must match `runE6` EXACTLY so the sphere field is the
   same family as the flat reference.
2. **Grain must be written first** — `writeHeightSphere` reads `carrier.grainAngle/regime/grainMag`.
   Document the precondition: the caller MUST call `writeGrainSphere(carrier, drivers)` before
   `writeHeightSphere` (exactly as `runE6:100` calls `writeGrain` first). The Phase-B bake host enforces
   ordering. (Alternatively, call `writeGrainSphere` at the top of `writeHeightSphere` — but keep it a
   single call so grain is not double-written; recommend the caller-enforced precondition + an assert
   that `carrier.grainMag` is not all-zero.)
3. Per node, port `runE6:111-119` with the SEAM-SAFE coordinate substitution (A.3):
   ```js
   // (a) steered tectonic grain relief — grainAngle/regime/grainMag are per-node (latitude-driven)
   let h = steeredNoise(noise, sx, sy, carrier.grainAngle[i], carrier.regime[i],
                        9.0, drivers.radialStrainSign ?? +1) * carrier.grainMag[i];
   // (b) crust-thickness plateau (sphere-native blob, A.4)
   const blob    = thicknessBlobSphere(carrier.verts[i], crustNoiseA, crustNoiseB);  // [0,1]
   const plateau = Math.max(0, blob - 0.55) * 1.6;
   h += plateau * (0.4 + 0.3 * (0.5 + 0.5 * noisePlateau(px, py)));   // (px,py) seam-safe, A.3
   // (c) accumulate
   carrier.height[i] += baseAmp * h * blend;
   // (d) fault density bookkeeping (parity with runE6:119)
   carrier.faultDensity[i] = Math.max(carrier.faultDensity[i], carrier.grainMag[i]);
   ```
   **LOCKED constants — do NOT change** (Map 02 §A3/§A6): `freq 9.0`; `steeredNoise` `{0.7|1.5}` /
   `{0.25|0.55}` / `{1.9|1.2}`; plateau `0.55` threshold, `1.6` gain, `(0.4+0.3*(0.5+0.5*noisePlateau))`
   modulation, `noisePlateau` sampled at 6× freq; `NU=0.25`, `REGIME_GAIN=0.4`; `baseAmp` formula.
4. **After the loop — adj-based Jacobi smooth** (sphere analogue of `runE6:122 jacobiSmooth(.,10)`).
   The in-module flat `jacobiSmooth` uses a fixed 4-neighbour `i±1,i±n` stencil (Map 01 §2.7) — it can't
   run on the carrier. Add a small `jacobiSmoothSphere(carrier, passes=10)` that iterates `carrier.adj[i]`
   (irregular degree 4–9), keeping the SAME `h[i]*0.5 + mean(self+neighbours)*0.5` weighting and 10
   passes (Map 02 §A7 / B5). Double-buffer (compute into a scratch `Float32Array`, then `.set`).

### A.3 ⚠ SPLIT-TRAP #1 (the seam in the noise domain) — the ONE substantive adaptation

`runE6` samples noise in `(x=ix/n, y=iy/n)` UV space (`runE6:112`). **Do NOT reuse a UV/lat-long domain
on the sphere** — a UV→(lat,long) map has an antimeridian seam + pole pinch (Map 01 §2.4, Map 02 §B3).
This is exactly where AC4 dies if done naively.

**Decision (locked for this plan): sample 3D simplex on the node's unit direction.** Import
`createNoise3D` from `simplex-noise` (same package; `tectonic.js:6` currently imports only
`createNoise2D` — add `createNoise3D` to that import). Then:
- The steered-grain term: feed `steeredNoise` two coordinates derived from a seam-free 3D sample. The
  cleanest faithful port that preserves the grain-rotation math: build per-node tangent coords from the
  carrier frame — `const {east, north} = carrier.tangentFrameAt(i);` and project the node direction's
  neighbourhood into that frame is over-engineering for a *coarse* body. **Simpler locked approach:**
  keep `steeredNoise`'s 2D rotation math intact but supply `(sx, sy)` as a seam-free 2D parameterization
  of the direction. Use `sx = noise3(d.x*F, d.y*F, d.z*F)`-style continuous fields is wrong (that loses
  the rotational steering). Instead: set `sx`, `sy` to a **stereographic-free** local pair that is
  continuous on the whole sphere by using the 3D direction components directly scaled into the noise
  domain: `sx = d.x * SCOORD`, `sy = d.z * SCOORD` is NOT seam-free at the y-poles. **Final locked rule:**
  replace the 2D `noise(u,v)` *inside* a sphere-native `steeredNoise3` with a 3D simplex sample of the
  rotated direction, so the rotation is applied in the tangent plane and the sample is `noise3(dir')`:
  - Compute the tangent frame `{east, north} = carrier.tangentFrameAt(i)` (pole-safe, sphereField.js:27-39).
  - Rotate within the tangent plane by `grainAngle` with the same `along/across/fScale` anisotropy
    constants as `steeredNoise`, producing a perturbed 3D direction `dir'`, then sample
    `createNoise3D` at `dir' * freq`. The ridged transform (`regime===NORMAL ? |n|-0.5 : 0.5-|n|`) is
    applied to the 3D sample identically.
  - **Why this is seam-free:** `createNoise3D(dir')` is a continuous function of the 3D unit direction;
    same-direction neighbours (incl. across the antimeridian and at the poles) sample the same value
    (Map 01 §1.8). The tangent frame is finite at the poles (documented pole fallback,
    sphereField.js:32). No UV, no lat/long, no wrap.
- The plateau detail `noisePlateau(px, py)`: replace with a 3D sample `noisePlateau3(d.x*6, d.y*6, d.z*6)`
  (add a `createNoise3D` plateau field keyed `seed+':e6plateau'+disc`). 6× freq preserved.

> **Implementation note for the builder:** the *exact* inner form of the 3D steered sample is the single
> place this plan grants latitude — but the constraints are hard: (1) it must be a pure continuous
> function of `carrier.verts[i]` (seam-free), (2) it must preserve the LOCKED anisotropy/ridge constants
> and the `freq=9.0`, (3) it must keep `grainAngle`-driven rotation so the grain still steers the ridges.
> Add a sphere variant `steeredNoise3(noise3, dir, east, north, angle, regime, freq, sign)` next to the
> flat `steeredNoise`; do NOT modify the flat one (it serves `runE6`). Cite the flat helper in a comment
> as the math reference.

### A.4 ⚠ SPLIT-TRAP #2 (flat `thicknessBlob`) — sphere-native plateau mask

`crust.thicknessBlob(ix,iy,n)` is flat UV plumbing (Map 02 §B4). Reproduce the SAME two-octave blend on a
seam-free 3D domain:
```js
// matches relief-base-step.js:79-84 weights/freqs/offsets exactly, on 3D dir
const crustSeed   = String(seed) + ':crust' + ((drivers.useDiscriminator && drivers.discriminator) ? ':'+drivers.discriminator : '');
const crustNoiseA = createNoise3D(alea(crustSeed + ':a'));
const crustNoiseB = createNoise3D(alea(crustSeed + ':b'));
function thicknessBlobSphere(d) {
  const a = 0.5 + 0.5 * crustNoiseA(d.x*2.5, d.y*2.5, d.z*2.5);
  const b = 0.5 + 0.5 * crustNoiseB(d.x*5.0 + 11.3, d.y*5.0 - 4.1, d.z*5.0);
  return Math.min(1, Math.max(0, 0.65*a + 0.35*b));
}
```
Keep weights `0.65/0.35`, freqs `2.5/5.0`, offsets `11.3/-4.1`, `clamp01`. **Seed-string format must
match `relief-base-step.js` (`seed+':crust'+disc`)** so the family matches; the `:a`/`:b` sub-keys split
the two octaves into independent seeded fields (the flat code uses one noise instance for both octaves —
acceptable difference; document it as a deliberate sphere adaptation in a comment, since reusing one 3D
field at two freqs is also fine and closer to the flat code — **locked choice: ONE `createNoise3D` field
sampled at both freqs**, matching the flat `thicknessBlob` which uses one `noise` for both octaves).

### A.5 Determinism approach (AC1, G6)

- ALL entropy is the `alea(seedString)` PRNG seeded purely by strings built from `seed` + `epoch.name` +
  `disc` (+ `:crust`/`:e6plateau` sub-keys). `alea` is deterministic by seed string.
- `simplex-noise` `createNoise2D/3D(rng)` is deterministic given its `alea` source.
- **NO `Date.now`, NO `Math.random`** anywhere in the writer or its helpers (G6, matches the
  `tectonic.js`/`planet-lod-tectonic.js:23-25` hard rule).
- The carrier itself is deterministic (mesh built from Fibonacci+Lloyd+ConvexHull, no RNG — Map 04 §5).

### A.6 VERIFICATION — Phase A (the AC1 gate)

**New test file:** `tests/worldengine-base-height-sphere.test.js`. Run scoped (G11):
```
npx vitest run tests/worldengine-base-height-sphere.test.js
```
Model it on `tests/worldengine-base-sphere.test.js` (builds a small carrier) and
`tests/worldengine-base-verify.test.js` (finite/byte-identical patterns). Assertions:

1. **AC1 byte-identical determinism (the headline gate):** build TWO carriers from the SAME small mesh
   (`buildIrregularSphere(600, 2)` per the sphere test, or import a fixed mesh), run
   `writeGrainSphere` then `writeHeightSphere` on each with identical `(crust, drivers, epoch, seed)`,
   and assert `carrier1.height` is **byte-identical** to `carrier2.height`:
   ```js
   expect(Array.from(a.height)).toEqual(Array.from(b.height)); // exact, no tolerance
   ```
   (Mirror `worldengine-base-verify.test.js:44-59` two-run determinism.)
2. **AC1 finite:** `for all i: Number.isFinite(carrier.height[i])` (no NaN/Inf). Mirror
   `worldengine-base-verify.test.js:76-78` (which flips height[5] to NaN to prove the signal fires).
3. **AC1 bounded:** every `|height[i]|` within the documented relief band. Per Map 02 §A8 the per-epoch
   E6 contribution is ≈ `[-0.75, +1.5]` normalized units and Jacobi cannot expand it; assert a sane
   guard band, e.g. `Math.abs(h) < 4` (generous margin; tighten if values cluster lower). Document the
   chosen band in the test + in a comment in the writer.
4. **Determinism of grain precondition:** assert `carrier.grainMag` is not all-zero before the height
   write (catches the "forgot to call writeGrainSphere" trap).
5. **Driver sensitivity (not a hard gate, sanity):** two DIFFERENT seeds produce a different field
   (`not byte-identical`) — proves the seed actually drives the field (guards a constant-output bug).
6. **No-RNG static guard:** grep-style assertion (read the writer source, assert no `Math.random`/
   `Date.now` substring) — mirror `ws4-router-zero-drift.test.js:106-110` and the WS4 oracle tests.

**Dependencies:** none (pure data). This phase can land + commit on its own (writer + test), and is the
foundation for B.

---

## PHASE B — HEIGHT cube baker (geometry + cube + bake-host wiring) + seam unit test

**Goal (AC1 carrier half + AC4 cube half):** materialize the Phase-A `carrier.height` field into a
direction-keyed, seam-free, watertight HEIGHT cube — reusing the proven grain-cube machinery (G4). This
is the ONE cube both consumers (C, D) will read (§0 invariant).

### B.1 Edit points — add a parallel HEIGHT cube path to `planet-lod-tectonic.js`

Map 03 §1.6 Option B (RECOMMENDED): a **separate** height cube mirroring grain exactly (the grain RGBA is
already full: `strike.x, strike.y, grainMag, regime/2`, so don't pack into it). Three additions, copying
the grain functions:

1. **`buildHeightCubeGeometry({ mesh, height, grad })`** — copy `buildGrainCubeGeometry`
   (`planet-lod-tectonic.js:145-174`). Same watertight full-sphere triangle mesh (one vertex per node at
   its unit direction, indexed by `mesh.faces`), same `Uint32Array` index buffer → **same seam-free
   guarantee** (Map 03 §1.3: every direction covered by exactly one triangle, last-write correct).
   Per-vertex attributes change to: `position` (node unit dir, unchanged), `aHeight` (float =
   `height[i]`), `aGrad` (vec3 = `grad[i*3..+2]`, optional — see B.3). Returns `THREE.BufferGeometry`.

2. **`createHeightCube({ renderer, size })`** — copy `createGrainCube`
   (`planet-lod-tectonic.js:187-235`) VERBATIM, changing ONLY the fragment pack:
   ```glsl
   gl_FragColor = vec4(vHeight, vGrad.xyz);   // R = height, GBA = tangent gradient
   ```
   Keep `WebGLCubeRenderTarget(size, { type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter,
   magFilter: LinearFilter, generateMipmaps: false })`, `glslVersion: null` (GLSL1), `side: DoubleSide`,
   `depthTest:false, depthWrite:false`, **NO blending** (watertight sphere ⇒ last-write, NOT MaxEquation —
   that's only for overlapping carve strips), `CubeCamera(0.01, 3, cubeRT)` at origin, clear color
   `(0x000000, 0)` = zero height. Returns `{ texture, update, dispose }`.
   - **Size:** use `RELIEF_CUBE_SIZE` = 256 (same class as `GRAIN_CUBE_SIZE`). Map 03 §5 flags that 256²
     is COARSE (~9 km/texel) vs the in-shader analytic field — that is ACCEPTABLE and CORRECT here: this
     increment is explicitly the **low-frequency body** (intent §"coarse"), and the in-shader `noised()`
     stays as the detail residual on top (Phase C blend). Document this as intentional, not a defect.

3. **`bakeHeightCube({ mesh, height, grad, heightCube })`** — copy the `bakeGrainCube` wrapper
   (`planet-lod-rivers.js:98-111` / the `bakeGrainCube` export) shape: build the geometry via
   `buildHeightCubeGeometry`, call `heightCube.update(geo)`. Pure; no RNG.

> **Where the height DATA comes from for the bake:** Phase A's `carrier.height`. The bake host (B.2)
> builds the carrier, runs `writeGrainSphere` + `writeHeightSphere`, then passes `carrier.height` (and a
> gradient, B.3) into `bakeHeightCube`. **This is the §0 invariant's source — generated structure, NOT a
> readback of `noised()`.**

### B.2 Edit point — wire the bake into the route() host (`planet-lod-rivers.js`)

The bake must ride the once-per-route cadence (bake-once AC), NOT per-frame (Map 03 §5).

- **`ensureMesh()`** (`planet-lod-rivers.js:980`): alongside `grainCube = makeGrainCube({...})`, add
  `heightCube = createHeightCube({ renderer, size: RELIEF_CUBE_SIZE })`.
- **`route()`** (`planet-lod-rivers.js:997-1028`): immediately after the grain bake block
  (`bakeGrainCube(...)` at line 1020, `grainBakeCount++` at 1021), add:
  ```js
  // Build the sphere-native baked relief field as DATA, then bake it to the height cube.
  const carrier = makeSphereField(mesh);
  writeGrainSphere(carrier, grainDrivers);
  writeHeightSphere(carrier, crust, grainDrivers, { name: 'tectonic-build' }, heightSeed);
  const reliefGrad = computeAdjGradient(carrier);          // B.3
  bakeHeightCube({ mesh, height: carrier.height, grad: reliefGrad, heightCube });
  heightBakeCount++;
  ```
  - `grainDrivers` already flows into `route()` (line 1020 uses it). `crust` and `heightSeed` need
    sourcing: `crust` from the same `makeBaseStep`-style derivation the drivers come from (wire the
    body's driver bundle in; if `route()` only has `grainDrivers` today, extend its options to carry the
    `crust`/`seed` OR derive `crust` from the existing driver bundle — match what feeds `grainDrivers`).
    `heightSeed` = the body's deterministic seed string (same family as `macroSeed`-derived offsets; no
    `Math.random`).
  - Imports at top of `planet-lod-rivers.js`: add `writeHeightSphere` to the existing
    `import { writeGrainSphere, stressAtLat } from './src/worldengine/base/tectonic.js'` (Map 03 §1.1
    shows `planet-lod-tectonic.js` already imports from there; `planet-lod-rivers.js` imports the cube
    machinery — add `createHeightCube, buildHeightCubeGeometry, bakeHeightCube` from
    `./planet-lod-tectonic.js`, and `makeSphereField` from the base module).
- **Exposed getters** (`planet-lod-rivers.js:1040-1041`, next to `grainTexture`/`grainBakeCount`):
  ```js
  get reliefTexture()   { return heightCube ? heightCube.texture : null; },
  get reliefBakeCount() { return heightBakeCount; },
  ```

### B.3 The gradient channel (GBA) — keep it cheap and finite

`perturbAnalytic` (renderer) and the base-viz want a gradient; the router does NOT use the `grad` array
for routing (Map 04 §10 — `routeAndOrder` derives its own `surf`-gradient from node drops). So the
gradient is for SHADING only.
- **Locked choice:** compute a per-node **adjacency finite-difference gradient** in JS after the height
  write — `computeAdjGradient(carrier)`: for each node, fit a tangent-plane slope from neighbour height
  deltas projected into `carrier.tangentFrameAt(i)`. Returns `Float32Array(N*3)` world-space gradient.
  This is deterministic (no RNG), finite (clamp/guard against degenerate neighbour sets), and seam-free
  (operates on `adj`, object-space). Pack into the cube's GBA.
- HalfFloat precision on GBA is adequate for shading (Map 03 §5).

### B.4 Determinism (AC1, G6)

Same as Phase A — the bake is a pure rasterization of the deterministic `carrier.height` + derived
gradient. No RNG in geometry build or cube render. `heightSeed` is a string, not `Math.random`.

### B.5 ⚠ SPLIT-TRAP #3 (do not bake the shader noise) — restated at the bake site

When wiring B.2, the temptation (from Map 03 §1.6's first suggestion) is to feed
`sampler.read().height` (the in-shader `noised()` field) into `bakeHeightCube` because it's "already
there" (`route()` reads it at line 1001 for routing today). **Do NOT.** The cube's source MUST be
`carrier.height` (generated structure). Feeding the shader readback in would make the "baked relief" just
resampled noise — the WS4 overlay, re-skinned. Guardrail: the `bakeHeightCube` call takes
`carrier.height`, and a code comment at the call site states "source = sphere-native E6 DATA, NOT
sampler.read()."

### B.6 VERIFICATION — Phase B

**(a) Headless cube-geometry seam unit test** — `tests/relief-height-cube.test.js` (model on
`tests/ws4-grain-cube.test.js` + `ws4-grain-bake-host.test.js`). Run:
```
npx vitest run tests/relief-height-cube.test.js
```
The cube RENDER needs a GPU (can't run in vitest — Map 04 §7.3), so this test guards the **pure
geometry + wiring**, not the GPU render:
1. `buildHeightCubeGeometry` produces a watertight sphere: vertex count == `mesh.verts.length`, index
   count == `mesh.faces.length*3`, `aHeight` attribute length == N, every index in `[0,N)`.
2. **Seam continuity of the DATA (the AC4 headless half, on the source field):** for the small carrier,
   assert the height field is a continuous function across the mesh — reuse the Lipschitz-style check
   from `tests/worldengine-base-sphere.test.js:63-79` (neighbouring nodes' height delta bounded), and
   the same-direction agreement check (two nodes at near-identical directions ⇒ near-identical height).
   Because the field is a pure function of `carrier.verts[i]` (A.3), this MUST pass — failure means a
   seam crept into the noise domain (the SPLIT-TRAP #1 regression).
3. **Pole sample:** nodes within a polar cap (`|verts[i].y| ≥ 0.92`, the `polesAndLakes` cap, Map 04 §6)
   have finite, bounded, continuous height (no pinch in the data).
4. Bake-host wiring source-scan (like `ws4-grain-bake-host.test.js`): `planet-lod-rivers.js` imports
   `writeHeightSphere`/`createHeightCube`/`bakeHeightCube`, calls `bakeHeightCube` inside `route()`,
   exposes `reliefTexture`/`reliefBakeCount` getters, and `route()` passes `carrier.height` (NOT
   `sampler.read()`/`r.height`) into `bakeHeightCube` (the SPLIT-TRAP #3 guard, grep the call args).
5. No-RNG static guard on the new tectonic functions.

**(b) Re-run Phase A test** (still green) + the existing WS4 cube/host tests to prove no regression:
```
npx vitest run tests/worldengine-base-height-sphere.test.js tests/ws4-grain-cube.test.js tests/ws4-grain-bake-host.test.js tests/worldengine-base-sphere.test.js
```

**Dependencies:** Phase A (`writeHeightSphere`).

---

## PHASE C — Renderer samples baked height + displaces, strength-gated, strength-0 byte-identical (AC2)

**Goal (AC2):** the lab renderer's surface relief IS the sampled baked field (blended with the in-shader
detail residual), behind a new `uReliefBakeStrength` uniform; at strength 0 the planet is byte-identical
to today (WS4 safe-fallback pattern, G7).

### C.1 Edit points — uniforms + sampler helper (`planet-lod-height.glsl.js`)

Mirror the grain uniforms (`planet-lod-height.glsl.js:143`). After line 144 add:
```glsl
uniform float       uReliefBakeStrength;   // 0 = baked relief OFF (byte-identical fallback gate)
uniform samplerCube uReliefBakeCube;       // baked low-freq height (R=height, GBA=tangent gradient)
```
And a sampler helper next to `sampleGrainStrike` (~line 160):
```glsl
vec4 sampleBakedRelief(vec3 dir){ return textureCube(uReliefBakeCube, normalize(dir)); } // .x=height, .yzw=grad
```

### C.2 Edit point — branch-guarded height source in the host fragment `main()` (`planet-lod-lab.html`)

**The exact swap site:** `planet-lod-lab.html:340-342`:
```glsl
vec4 hd = fbmd(vPos, uOctaves, fwBase);
float h = hd.x;
vec3 grad = hd.yzw;
```
Replace with the BRANCH-guarded blend (Map 03 §2.6) — ⚠ **never `mix()`-to-0**, BRANCH:
```glsl
vec4 hd;
if (uReliefBakeStrength > 0.0) {
  vec4 baked = sampleBakedRelief(vObjN);              // R=baked low-freq height, GBA=baked gradient
  vec4 synth = fbmd(vPos, uOctaves, fwBase);          // in-shader DETAIL residual
  // baked low-frequency body + (synth as residual on top), gated by strength
  hd = vec4(baked.x, baked.yzw) * uReliefBakeStrength + synth * (1.0 - uReliefBakeStrength * 0.0);
  // NOTE: the exact blend form is C.3 — the key contract is the ELSE branch is verbatim pre-AC2.
} else {
  hd = fbmd(vPos, uOctaves, fwBase);                  // VERBATIM pre-AC2 path, NO cube fetch
}
float h = hd.x;
vec3 grad = hd.yzw;
```
- ⚠ **SPLIT-TRAP #4 (the byte-identical guard, G7):** the `else` branch MUST be the literal pre-AC2 line
  `fbmd(vPos, uOctaves, fwBase)` with NO `textureCube` fetch. A `mix(synth, baked, 0.0)` would still
  execute the cube fetch and a null/NaN sample can corrupt the "identical" output (height.glsl.js:136-138
  is explicit about this). Use `if/else`, not `mix`.
- **Sample by `vObjN`** (object-space normalized node direction), the direction-keyed contract used
  everywhere (Map 03 §2.2), so it's seam-free.

### C.3 The blend semantics (low-freq body + detail residual) — locked intent, exact form deferred to live tuning

The intent says the baked field IS the low-frequency body and the in-shader noise becomes a *detail
residual on top* (not the body itself). At strength 1 the body's large-scale shape must be the baked
field; fine detail can still come from `synth`. Locked form:
```glsl
// strength s in (0,1]: body = baked, residual = a fraction of synth's high-freq part
hd = vec4(baked.x * s, baked.yzw * s) + synth * (1.0 - s) ;   // s=1 => pure baked body
```
At `s=1`: `hd = baked` (pure generated structure — the AC2 "surface visibly deforms to match the baked
field"). At `s` between 0 and 1: A/B crossfade for tuning. At `s=0`: handled by the ELSE branch (verbatim
synth). **The precise residual mix is a live-tuning knob (AC5 territory), not an AC2 hard requirement —
AC2 requires (i) strength 1 visibly tracks the baked field, (ii) strength 0 byte-identical.** Keep the
strength-1 case = pure baked so the AC2 "displacement tracks the sampled height" probe is unambiguous.

> **Displacement is a normal-bend, not vertex motion** (Map 03 §4 / §3.A): the vertex shader does not
> move `position`; `h`/`grad` feed `perturbAnalytic` (height.glsl.js:1470) which bends the normal. "The
> relief body IS the sampled field" is satisfied at the per-fragment `h` level — this is the established
> lab meaning of "displace" and is what the AC2 probe reads. (True vertex displacement is a larger,
> out-of-scope change.)

### C.4 Edit points — bind the cube + GUI slider + `window._lab` probes (`planet-lod-lab.html`)

1. **Init dummy + bind** (mirror grain, lab.html:1374-1386): add
   `uniforms.uReliefBakeCube = { value: makeDummyCubeTexture() };` and
   `uniforms.uReliefBakeStrength = { value: 0.0 };` (default 0 ⇒ byte-identical; G7 "always bind a
   dummy" so a null samplerCube is never sampled at fallback).
2. **Point at the baked texture after each route** (lab.html:3577-3582, where `uTectonicGrainCube` is
   pointed): add
   `uniforms.uReliefBakeCube.value = riverOverlay.reliefTexture || _dummyReliefCube;`.
3. **GUI slider** in the same `'Tectonic grain & carve (WS4)'` folder (lab.html:2438-2453): add
   `reliefBakeStrength: 1.0` (lab LIVE = 1 for A/B visibility; **production uniform default stays 0** —
   preserve the split, G7), driving `uniforms.uReliefBakeStrength` via a new
   `window._lab.reliefBakeStrength(v)` setter.
4. **`window._lab` probes** (lab.html ~5711-5717, mirror grain hooks):
   - `reliefBakeStrength(s)` — get/set `uReliefBakeStrength` (copy `grainStrength`).
   - `get reliefBakeCount()` / `get reliefTexture()` — bake-once + texture probes.
   - `_bakedReliefAt(dir)` — re-derive the baked relief field via the pure `writeHeightSphere` +
     nearest-node lookup (model on `_sharedStrikeAt`, lab.html:5880-5896) for the AC2 parity assertion
     (cube sample == data field).

### C.5 Determinism / strength-0 mechanism (G7)

- The cube is deterministic (Phases A+B). The shader adds no entropy.
- strength-0 byte-identical: ELSE branch is the verbatim pre-AC2 `fbmd` line, no cube fetch (C.2).
- Lab live=1 / production default=0 split preserved (don't edit any `uniforms.js` default).

### C.6 VERIFICATION — Phase C (AC2, live on :9223)

Per `well-dipper-testing-reference.md`: chrome-devtools on GPU Chrome :9223 (NOT Playwright). Lab served
on the running dev server (do NOT start one — G11). Enter via `window._lab`.
1. **strength-0 byte-identical (the regression gate):** `window._lab.reliefBakeStrength(0)`,
   `window._lab.setSeed(1234)` (deterministic; avoid the `Math.random` "New planet" button), capture
   screenshot + `window._lab.sampleRoutedHeight(dirs)` (lab.html:5775 numeric readback). Then compare to
   a pre-increment baseline capture at the same seed/camera. Diff must be exactly zero. (At strength 0 no
   `textureCube` fetch executes — the arithmetic is the unmodified `fbmd` chain.)
2. **strength-1 tracks the baked field:** `reliefBakeStrength(1)`; assert the surface deforms — compare
   `_bakedReliefAt(dir)` (data) against `sampleBakedRelief` via a probe / against
   `sampleRoutedHeight(dirs)` to confirm the displaced surface == the baked field within HalfFloat
   tolerance. Screenshot shows visible large-scale relief change off→on.
3. **Bake-once:** `reliefBakeCount` increments exactly once per `setSeed`/route, not per frame
   (camera/time changes do not re-bake — Map 03 §3.G).

**Dependencies:** Phase B (the cube + `reliefTexture` getter).

---

## PHASE D — River router height source re-pointed to the SAME baked field, strength-gated (AC3)

**Goal (AC3):** the existing sphere-native river router routes on the SAME baked height cube the surface
displaces from — re-pointed from the in-shader RTT readback. Single height source; no surface-vs-rivers
split. Drainage descends the baked relief; router-lab regression holds.

### D.1 ⚠ SPLIT-TRAP #5 (THE central trap) — both consumers MUST read the same cube

This is the phase where the WS4 split is most likely to silently reappear: if the renderer (C) reads the
baked cube but the router keeps calling `sampler.read()` (in-shader `noised()` RTT), then "surface says
one thing, rivers say another" — exactly the WS4 failure. **The router's height array MUST come from the
same baked field.** Guardrail: the re-point is gated on the SAME `uReliefBakeStrength` uniform as C, so
strength>0 ⇒ both read the cube; strength 0 ⇒ both fall back to the legacy path (and the planet is
byte-identical, including rivers).

### D.2 Edit point — the single re-point site (`planet-lod-rivers.js:1001`)

Today: `const r = sampler.read(); height = r.height; grad = r.grad;`

Re-point (Map 04 §2.2 Option A — GPU cube readback at mesh nodes, mesh-agnostic, robust):
```js
const bakedOn = uniforms.uReliefBakeStrength && uniforms.uReliefBakeStrength.value > 0.0;
const r = bakedOn
  ? bakedSampler.readFromCube(heightCube.texture)   // sample baked cube at each mesh node dir
  : sampler.read();                                  // legacy in-shader RTT (strength-0 fallback)
height = r.height; grad = r.grad;
```
- **`bakedSampler`** — a sibling of `createHeightSampler` (Map 04 §2.2): a tiny RTT shader whose fragment
  reads `textureCube(uBakedHeightCube, normalize(vObjN))` and writes `gl_FragColor = vec4(h, gradXYZ)`,
  packed one texel per mesh node (same `W×Hh` packing as `createHeightSampler`,
  planet-lod-rivers.js:274-327). Returns the SAME `{ height:Float32Array(N), grad:Float32Array(N*3) }`
  shape. Build it once in `ensureMesh()` next to `sampler`.
  - **Alternatively (Option B, cheaper):** if the router mesh IS the mesh the carrier was baked on (same
    `buildIrregularSphere(TARGET_N, LLOYD_ITERS)` — it is, in route()), sample directly from the
    `carrier.height` CPU array by node index (`height[i] = carrier.height[i]`). This avoids the GPU
    round-trip entirely. **Locked choice: Option B if the carrier built in B.2 is in scope at the
    re-point** (it is — B.2 builds `carrier` inside `route()` just above the bake). Reuse that
    `carrier.height` directly: `height = carrier.height; grad = reliefGrad;` when `bakedOn`. This is the
    cleanest single-source proof — the router and the cube read the IDENTICAL `carrier.height` array.
    Keep Option A documented as the fallback if mesh alignment ever breaks.
- **Do NOT delete `createHeightSampler` / `ROUTER_MAIN`** (Map 04 §10) — they are the strength-0
  byte-identical fallback (G7). The re-point is gated, not a replacement.

### D.3 What must NOT change downstream (Map 04 §2.4)

`height` stays `Float32Array(N)` indexed by mesh node index. `routeAndOrder`, `solveSeaLevel`,
`computeOcean`, `buildRibbonGeometry`, `buildValleyGeometry`, `perNodeIncision` all index `height[i]`
unchanged — nothing downstream cares HOW height was produced. The histogram sea solve
(`solveSeaLevel(height, 0.35)`) retargets ~35% ocean on the new field automatically (Map 04 §2.4 / §10).

### D.4 WebGPU out (G5)

The existing CPU router routes on the sphere at bake time (`routeAndOrder`, pure graph over `mesh.adj`).
Do NOT build a WebGPU FastFlow exact-routing path. Out of scope for increment 1.

### D.5 Determinism (G6)

Router adds no entropy (Map 04 §5 — grep-clean of `Math.random`/`Date.now`). Determinism holds iff the
baked field is deterministic — which AC1 (Phase A) guarantees. Mesh is deterministic.

### D.6 VERIFICATION — Phase D (AC3)

**(a) Headless drainage-on-baked-field test** — `tests/relief-router-baked-drainage.test.js` (model on
`tests/ws4-epoch.test.js:78` / `ws4-carve-subtractive.test.js:79`, which run the REAL pure
`routeAndOrder` on a synthetic field). Run:
```
npx vitest run tests/relief-router-baked-drainage.test.js
```
1. Build the mesh (`buildIrregularSphere`), build a carrier, run `writeGrainSphere`+`writeHeightSphere`,
   populate `height[i] = carrier.height[i]` (the SAME source the router will use), derive `isOcean` via
   `solveSeaLevel`/`computeOcean`, run `routeAndOrder({ mesh, height, grad:null, isOcean, params })`.
2. Assert **`routed.uphill === 0 && routed.orphan === 0`** (drainage descends the baked relief; trunks
   reach the sea — the AC3 gate).
3. Assert **accum concentrates** (`max(accum) > 5 * mean(accum)`) — drainage forms trunks, not scatter
   (Map 04 §8.3 / relief-slice verifier).
4. Assert ocean fraction lands in band `[0.25, 0.45]` after `solveSeaLevel(height, 0.35)`, and
   `maxStrahler` in band (~5) (Map 04 §7.1).

**(b) Re-point wiring source-scan** — extend `tests/ws4-router-zero-drift.test.js` (or a new
`tests/relief-router-repoint.test.js`): assert `route()` gates the height source on
`uReliefBakeStrength` and that the baked branch uses `carrier.height` (NOT `sampler.read()`); assert
`createHeightSampler`/`ROUTER_MAIN` still exist (fallback preserved); no `Math.random`/`Date.now`.
```
npx vitest run tests/ws4-router-zero-drift.test.js
```
(must stay green — 6/6 today.)

**(c) Live :9223** (chrome-devtools, GPU; the terrain lab `rivers-terrain-lab.html`, Map 04 §6/§7.2):
1. With baked-relief ON, `window._rivers.rereadAndRoute()`, then read `window._rivers.stats`: assert
   `oceanPct≈35`, `maxStrahler≈5`, `orphanPct===0`, `uphillPct===0` (the AC3 "router-lab regression
   holds" gate).
2. **Single-source proof:** compare `window._rivers.height[i]` against the baked cube sampled at
   `mesh.verts[i]` (or against `_bakedReliefAt`) — they must match within tolerance (router height ==
   baked field, NOT the legacy RTT).
3. strength-0 fallback: with baked-relief OFF, `window._rivers.stats` is byte-identical to today
   (legacy `sampler.read()` path).

**Dependencies:** Phase B (the cube + carrier in route()). Independent of C, but BOTH C and D must land
before AC5 (the §0 invariant).

---

## PHASE E — Seam/pole + drainage continuity audit (AC4) — headless sample + live orbit

**Goal (AC4):** the baked relief and the drainage are continuous across cube seams and at both poles — no
seam ridge, no pole pinch, drainage crosses seams unbroken. This is the critics' FIRST gate (G9):
longitudinally-varying baked height on a sphere has never been exercised here.

> Map 04 §4/§8.5 established the router traversal is object-space graph-only (seam/pole-clean, verified).
> **Any AC4 failure originates in the NEW baked HEIGHT cube**, not the router. So E focuses the audit on
> the cube/data field.

### E.1 Headless seam/pole sample test — `tests/relief-seam-pole-continuity.test.js`

Run:
```
npx vitest run tests/relief-seam-pole-continuity.test.js
```
(The cube GPU render can't run in vitest; this tests the underlying DATA field continuity, which is what
the cube interpolates. Builds on B.6(2-3) but is the dedicated AC4 gate.)
1. **Seam continuity (the AC4 headless half):** for a built carrier, sample `carrier.height` at many
   pairs of near-identical directions that straddle where a cube seam WOULD be in an equirect map
   (antimeridian `x≈0,z<0`; cube-face edges along the ±x/±y/±z diagonals). Because the field is a pure
   function of `verts[i]` (A.3 seam-free domain), same-direction pairs must agree within a tight delta.
   Assert max seam-pair delta below threshold (reuse the Lipschitz bound `< 1.05` style from
   `worldengine-base-sphere.test.js:63-79`, scaled to the height range).
2. **Pole continuity:** sample nodes in the north cap (`verts[i].y ≥ 0.92`) and south cap
   (`verts[i].y ≤ -0.92`); assert height is finite, bounded, and varies smoothly (no spike/pinch) —
   neighbour deltas within the cap below threshold.
3. **Cross-seam drainage (headless):** run `routeAndOrder` on the baked field (reuse D.6(a) setup) and
   assert receivers cross polar caps and the antimeridian region without producing `orphan`/`uphill`
   edges there specifically (filter `routed` to cap/seam nodes; assert clean). Mirrors
   `polesAndLakes()`'s cap logic (Map 04 §6) but headless on the baked field.

### E.2 Live orbit audit on :9223 (chrome-devtools, GPU)

1. **Planet lab (`planet-lod-lab.html`):** `reliefBakeStrength(1)`, `setSeed(1234)`. Orbit the body
   across each cube-face boundary and over BOTH poles (use `window._lab` camera helpers). Screenshot at
   each seam + pole. Assert: no visible seam line / ridge at cube edges, no pole pinch/artifact. (Per the
   chrome-devtools screenshot-scaling memory: use 127.0.0.1, verify innerWidth/dpr before capture.)
2. **Terrain lab (`rivers-terrain-lab.html`):** `window._rivers.polesAndLakes()` →
   `bothPolesClean === true`, `lakes.basins` nonzero/stable; confirms drainage crosses poles cleanly on
   the baked field.

### E.3 Determinism note

All E checks are over deterministic data (Phases A–D). Re-runs at the same seed produce identical
samples.

**Dependencies:** Phases C + D (needs the cube rendered + router on the baked field for the live half).

---

## 3. Consolidated SPLIT-TRAP register (every place a naive build recreates the WS4 split)

| Trap | Where it lurks | The naive (wrong) move | Guardrail |
|------|----------------|------------------------|-----------|
| #1 noise-domain seam | A.3, `writeHeightSphere` | reuse `runE6`'s `(ix/n,iy/n)` UV → lat/long sampling | sample 3D simplex on `carrier.verts[i]` (seam-free); keep LOCKED anisotropy constants. AC4 dies here if wrong. |
| #2 flat plateau mask | A.4 | call `crust.thicknessBlob(ix,iy,n)` (flat UV) | `thicknessBlobSphere(dir)` — same weights/freqs/offsets on 3D dir |
| #3 bake the shader noise | B.2/B.5 | feed `sampler.read().height` (in-shader `noised()`) into the cube because it's "already there" | cube source = `carrier.height` (generated DATA); comment at call site; test asserts call arg |
| #4 mix-to-0 in renderer | C.2 | `mix(synth, baked, 0.0)` (still fetches cube, can NaN) | `if/else` BRANCH; ELSE = verbatim `fbmd` line, no fetch; always bind dummy cube |
| #5 router keeps RTT | D.1/D.2 | renderer reads cube but `route()` keeps `sampler.read()` → surface≠rivers | gate router source on the SAME `uReliefBakeStrength`; baked branch uses the SAME `carrier.height`; both fall back together at strength 0 |

**The §0 invariant, restated:** ONE field (`carrier.height`) → ONE cube (`heightCube`) → BOTH consumers
read it, gated by ONE strength uniform (`uReliefBakeStrength`). If at any point the renderer and the
router are reading different height sources at strength>0, the split is back and AC5 will fail.

---

## 4. Files touched (explicit — for staging discipline, G10)

| File | Phase | Change |
|------|-------|--------|
| `src/worldengine/base/tectonic.js` | A | + `writeHeightSphere`, `steeredNoise3`, `jacobiSmoothSphere`, `thicknessBlobSphere`; add `createNoise3D` to import. The ONLY `src/worldengine/base/*` change (G8). |
| `tests/worldengine-base-height-sphere.test.js` | A | NEW — AC1 determinism/finite/bounded unit test |
| `planet-lod-tectonic.js` | B | + `buildHeightCubeGeometry`, `createHeightCube`, `bakeHeightCube` (copies of the grain trio) |
| `planet-lod-rivers.js` | B, D | B: wire bake into `ensureMesh`/`route()`, add `reliefTexture`/`reliefBakeCount` getters. D: re-point height source at line 1001 (gated). |
| `tests/relief-height-cube.test.js` | B | NEW — cube geometry + seam-data + wiring source-scan |
| `planet-lod-height.glsl.js` | C | + `uReliefBakeStrength`/`uReliefBakeCube` uniforms + `sampleBakedRelief` helper |
| `planet-lod-lab.html` | C | branch-guard height source (line 340), bind cube, GUI slider, `window._lab` probes |
| `tests/relief-router-baked-drainage.test.js` | D | NEW — drainage descends the baked field, 0 uphill/orphan |
| `tests/ws4-router-zero-drift.test.js` (or new `relief-router-repoint.test.js`) | D | re-point wiring source-scan |
| `tests/relief-seam-pole-continuity.test.js` | E | NEW — AC4 headless seam/pole continuity |
| `docs/NOW.md`, `docs/FEATURES/*` (on ship) | — | doc-update-on-ship per project Rules 3/14 (not part of build) |

**NEVER touched (G8):** `src/generation/*`, game `Planet.js`, `src/objects/*`, any `uniforms.js`
default (the production `uReliefBakeStrength` default stays 0).

**Commit cadence (G10):** commit at phase seams (A, then B, then C, then D, then E), staging EXPLICIT
paths only — e.g. `git add src/worldengine/base/tectonic.js tests/worldengine-base-height-sphere.test.js`.
Never `git add -A`. Never `git show HEAD` (a file named `HEAD` exists in repo root; use `git show
@`/`git log` instead). Push ON HOLD — Max's call.

---

## 5. Verification matrix (per AC)

| AC | Layer | Gate | How |
|----|-------|------|-----|
| AC1 | unit | byte-identical re-run; finite; bounded; data not shader-expr | `npx vitest run tests/worldengine-base-height-sphere.test.js` (Phase A.6) |
| AC2 | integration (live) | strength 1 surface tracks baked field; strength 0 byte-identical | :9223 `window._lab` strength 0/1 capture + `_bakedReliefAt` parity (Phase C.6) |
| AC3 | integration (live) | router height == baked field (not RTT); drainage descends; ocean~35%, maxStrahler in band, 0 orphan/uphill | `npx vitest run tests/relief-router-baked-drainage.test.js` + ws4-router-zero-drift + :9223 `window._rivers.stats` (Phase D.6) |
| AC4 | integration (headless+live) | seam/pole delta below threshold; no seam ridge/pole pinch; drainage crosses seams | `npx vitest run tests/relief-seam-pole-continuity.test.js` + :9223 orbit + `polesAndLakes().bothPolesClean` (Phase E) |
| AC5 | uat | holistic: relief reads as generated structure, drainage cut into it, coheres across sphere | Max walks the lab on :9223 — agent NEVER closes this; mark `deferred-to-max` |

**Increment-1 done = AC1 (unit green) + AC2/AC3/AC4 (integration green, headless + live) →
`VERIFIED_PENDING_MAX <sha>` → Max UAT (AC5) → Shipped.** The verify-workstream workflow runs the unit +
integration layers; the agent drives the live integration checks via chrome-devtools; UAT (AC5) is Max's
gate alone.

---

## 6. Open risks the builder should flag up front (G of the global collab rules)

1. **The 3D steered-noise inner form (A.3)** is the only place with design latitude, and it's
   AC4-critical. If the faithful 3D port of the anisotropic grain steering proves fiddly, the
   3-cycle-cap rule applies: if 3 rounds of research→implement→test on the steered sample fail, fall
   back to a simpler seam-free height (latitude-driven stress amplitude × a single 3D ridged field) that
   still reads as "generated structure + drainage" for the WS4-scoped bar, and note the grain-steered
   detail as a follow-on. Do NOT death-spiral on exact flat-parity of the steered term — the bar is the
   WS4-scoped coherent-system bar, not flat-DEM byte-parity.
2. **`crust`/`heightSeed` sourcing into `route()` (B.2):** `route()` today carries `grainDrivers` but may
   not carry `crust` or a height seed. Wiring the body's full driver bundle (or deriving `crust` from it)
   into `route()` is a small but real plumbing task — confirm the driver bundle is available at the
   route() call site before assuming Option B's CPU-array re-point is free.
3. **HalfFloat coarseness at 256² (Map 03 §5):** "strength 1" is a COARSER planet than the live
   `noised()` synth. This is intended (low-frequency body), but if Max's AC5 read wants near-camera fine
   detail, the residual-blend (C.3) or a camera-localized patch is the follow-on lever — not an AC2/AC3
   failure.
4. **Mesh alignment for Option B re-point (D.2):** Option B (direct `carrier.height` reuse) assumes the
   carrier built in route() is on the SAME mesh the router routes. It is, by construction — but if that
   ever changes, fall back to Option A (cube readback by direction, mesh-agnostic).
5. **strength-0 byte-identical is the regression contract** — verify it FIRST on every live check before
   trusting any strength-1 result. A non-zero strength-0 diff means the branch guard leaked (a stray
   cube fetch / a `mix`), and nothing downstream is trustworthy until it's zero.
