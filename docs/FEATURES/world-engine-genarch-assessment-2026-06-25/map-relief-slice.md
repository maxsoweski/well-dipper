# Map of the UAT-PASSED Relief Slice (the "structure-as-data" reference)

**Assessment date:** 2026-06-25 · **Branch:** feature/world-engine-production-L1
**Scope:** READ-ONLY map of the Max-UAT-PASSED (2026-06-23) world-engine RELIEF SLICE.
**Files mapped:** `relief-substrate.js`, `relief-base-step.js`, `relief-e6-tectonic.js`,
`relief-e9-hydrology.js`, `relief-slice.js`, `relief-divergence.js`, `relief-presets.js`,
`world-engine-relief-lab.main.js`, `tests/world-engine-relief-slice.test.js`,
`docs/FEATURES/world-engine-relief-slice-plan.md`.

This is the surface Max approved as reading "as a planet with a tectonic history / structure
as DATA" — the altitude WS4 (the lab-shader wiring) failed to reach. This document records
EXACTLY what it generates as data, how the renderer expresses (not synthesizes) it, how body-type
divergence is produced as data, and the honest scope limits. Per the vision in
`world-engine-architecture-spine.md` §0/§1: **procgen DECIDES (writes history as data) upstream;
render EXPRESSES (reads) it.** The relief slice is the clean instance of that contract.

---

## 0. One-paragraph thesis

The relief slice builds a **first-class, persistent `ReliefSubstrate` data structure** — nine
co-registered typed arrays on a 2D regular-grid DEM — and runs a **2-epoch host-editor loop over
that ONE shared object**: E6 (tectonic) WRITES `height` (plus the structural grain, regime,
faultDensity) in epoch 1; E9 (hydrology) EDITS the SAME `height` in place — strictly subtractively
— in epoch 2, while writing `flowAccum`, `baseLevel`, `standing`, `maturity`. The renderer
(`world-engine-relief-lab.main.js`) is **preset-blind**: it displaces a plane mesh by
`substrate.height[i]` and colours it from height + `standing` + `flowAccum`. It reads the already-baked
data; it synthesizes no relief of its own. That is the structural difference from WS4, where the
fragment shader still *generated* relief from noise and the procgen layer supplied only a thin
orientation grain. **Here the relief IS the data.**

---

## (a) What is generated AS DATA — the ReliefSubstrate, and the host-editor writes

### A.1 The ReliefSubstrate (the "host") — `relief-substrate.js:5-19`

`makeSubstrate({ n, lat0Deg, lat1Deg, domainKm })` allocates a single object holding grid metadata
plus **nine co-registered `n*n` typed arrays** (row-major, indexed `idx(s,ix,iy) = iy*n + ix`,
`relief-substrate.js:20`). Every array is a full per-cell field — this is the body's *generated
history as data*, not parameters:

| Array | Type | Holds | Written by |
|---|---|---|---|
| `height` | Float32 | THE host DEM — surface elevation per cell | E6 writes (`+=`), E9 subtracts (`-=`) |
| `grainAngle` | Float32 | Structural-grain director (radians) = lineament strike | E6 (`writeGrain`) |
| `grainMag` | Float32 | Grain magnitude 0..1 (stress intensity) | E6 (`writeGrain`) |
| `regime` | Uint8 | Anderson regime per cell (`REGIME = {NORMAL:0, STRIKESLIP:1, THRUST:2}`) | E6 (`writeGrain`) |
| `faultDensity` | Float32 | Per-cell fault density (max grainMag seen) | E6 (`runE6`) |
| `flowAccum` | Float32 | Drainage area (upstream cell count + precip weight) | E9 (`runE9`) |
| `baseLevel` | Float32 | Standing-liquid surface elevation (sea/lake water level) | E9 (`runE9`) |
| `standing` | Uint8 | 1 where liquid stands (sea or lake), else 0 | E9 (`runE9`) |
| `maturity` | Float32 | Accumulated surface age across epochs | E9 (`runE9`) |

Helpers: `latDegOfRow(s,iy)` (`:21-24`) linearly maps row→latitude across the band; `cloneHeight(s)`
(`:25`) snapshots height for the legibility witness (see A.5). The struct is **pure** — no three.js,
no rng. (The production port `src/worldengine/base/substrate.js` is byte-for-byte the same struct.)

### A.2 Base step — derives REAL geophysical drivers from the body bundle — `relief-base-step.js`

`makeBaseStep(bundle, {n,lat0Deg,lat1Deg,domainKm,seed,discriminate})` → `{ drivers, crust,
substrate }`. This is the slice's scoped version of the LOCKED "Option-A expose+derive" Tier-1 base
step. It derives — never invents — physical drivers from the body bundle (so a "type" is a derived
*label*, not a load-bearing input, matching the 2026-06-22 lock):

- **`tidalHeat` (D12)** — un-zeroed via the EXACT `deriveUniforms` Io-normalised form
  `ecc²·Mstar²·R⁵ / a⁵` (`:18-25`). Mirrors `planet-lod-lab-core.js:516-529`; the production
  `PlanetGenerator.js:565` hard-zero is left untouched (deliberate non-goal).
- **`surfaceGravity`** = `massEarth / radiusEarth²` (`:16`).
- **`rockyCrust`** = `smoothstep(2.5, 3.9, density)` — silicate↔ice gate (`:28`, mirrors core:557).
- **`radialStrainSign` (±1)** — contraction vs expansion (`:35-37`). `contractionDrive`
  (cooling/age/size) vs `expansionDrive` (tidal heating) decide the sign. This is the lever that
  later flips the Anderson regime mix per body (L1).
- **`radialStrainMag` (0..1)** — un-damped strain magnitude (`:40`). Comment notes the prior
  `*0.001` damping (the "coat-swap" / regime-inert version) was removed.
- **`despinAmp`**, **`shellThickness`** — despin amplitude/shell proxies (`:44-45`).
- **`liquidStability` (0..1)** — canonical production gate copied VERBATIM (`:47-65`): a Jeans
  escape chain (PhysicsEngine.js:96-100,111,184-239) → retention gate × volatile gate × temperature
  window. `liquidSpecies` (water/methane) and `rainFactor` derived alongside.
- **`discriminator`** + **`useDiscriminator`** — an L3 composition/regime string folded into the
  noise seed when ON (`:69-76`). Toggleable; not a decisive gate.
- **`crust.thicknessBlob(ix,iy,n)`** — low-freq seeded-simplex crustal-thickness field → plateau/
  tessera masks (`:79-84`).

The returned `substrate` is **zero-initialised** (test `:58-62` asserts `height.every(v===0)`).

### A.3 E6 — WRITES the host (epoch 1) — `relief-e6-tectonic.js`

E6 is the tectonic **BUILD** engine. `runE6(substrate, crust, drivers, epoch, seed)` (`:97-129`)
writes the host in three documented steps:

1. **`writeGrain` (`:47-60`)** — for each latitude row, closed-form despun-shell stress
   (`stressAtLat`, `:24-45`; Melosh 1977 / Vening Meinesz 1947, ν=0.25). Two horizontal principal
   stresses `sMer ∝ (1+ν)-(3+ν)sin²φ`, `sZon ∝ (1+ν)-(1+3ν)sin²φ`, shifted by the radial-strain
   term `eps` (`:33-35`). Per cell it writes `grainAngle` (lineament strike — 0 or π/2 depending on
   dominant stress axis), `grainMag` (stress magnitude), and `regime` (Anderson class from the sign
   pair). Equator→THRUST, mid-lat (~38-57°)→STRIKESLIP, pole→NORMAL.
2. **Steered relief into `height` (`:110-125`)** — `steeredNoise` (`:85-95`) samples simplex in a
   frame rotated to the local `grainAngle`, with frequency/aspect **branched by regime sign** (the
   L2 geometry lever — see (c)). Result is multiplied by `grainMag`, scaled by `baseAmp`
   (`= 0.6 · gravityCap(1/√g) · (0.3+0.7·rockyCrust)`, `:108`), and **added** to `height[i]`. Plateau
   uplift from thick `thicknessBlob` cells is layered on (`:119-121`). `faultDensity` is recorded.
3. **`jacobiSmooth` (`:131-147`)** — 10 bounded cosmetic smoothing passes.

E6 is deterministic per seed (test `:128-133`) and gravity-correct (low-g → bigger relief, test
`:120-127`). An **optional rotated-pole overprint** (`relief-slice.js:45-49`, `blend<1`,
`rotatePoleDeg`) re-runs E6 to demonstrate the editor-on-host generality (a 2nd tectonic generation
faintly overprinting the first) — proof the host accepts multiple BUILD edits.

### A.4 E9 — EDITS the host in place (epoch 2) — `relief-e9-hydrology.js`

E9 is the hydrology **SCULPT/CARVE** engine, a **CPU bake-time reference** (header `:1-4`;
GPU FastFlow/Jain-2024 is the deferred optimization). `runE9(substrate, drivers, epoch, seed)`
(`:104-152`):

- **L4 gate (`:107-110`)**: if `liquidStability ≤ 1e-3` (airless/frozen), it returns immediately —
  carves NOTHING. Airless bodies bear their raw E6 relief.
- Computes `erodibility` from `surfaceHistory × liquidStability × rainFactor` (`:113-114`), a
  synthesized `synthPrecip` weight (latitude band + orographic upslope, `:80-96`), and a
  `seaLevel` from a liquid-stability-derived ocean fraction (`:119-120`).
- Runs **5 bounded stream-power passes** (`:123-141`): each pass priority-floods (`:9-39`,
  Barnes-2014 heap, grid analogue of `planet-lod-rivers.js:288-310`), computes D8 receivers
  (`:42-55`), exact flow accumulation by Kahn topo-sort (`:59-71`, written into `flowAccum`), then
  applies one stream-power increment `dz = K·A^m·S^n·maturity·0.02` (`:135`), **capped so a cell
  never cuts below its receiver** (`:137`). The increment is **subtracted from the shared
  `substrate.height` in place** (`:139`) and accumulated into a strictly-≤0 `incision` array.
- **Base-level fill (`:143-150`)**: a final priority-flood marks `standing` (sea + residual-
  depression lakes), writes `baseLevel` (sea level / lake spill / land elevation), and advances
  `maturity`.

The in-place `height -= dz` IS the host-editor mechanism. Test `:182-188` asserts incision is
strictly subtractive and lowers the shared height.

### A.5 Orchestration + the legibility witness — `relief-slice.js:34-51`

`runReliefSlice(driverBundle, opts)` (defaults `n:256, lat0..lat1Deg:0..80, domainKm:4000`):

1. `makeBaseStep` → `{drivers, crust, substrate}`.
2. **EPOCH 1**: `runE6(...)` writes the host. → `heightAfterBuild = cloneHeight(substrate)`
   (the witness snapshot).
3. **EPOCH 2** (if `epoch2`): `runE9(...)` edits the SAME substrate in place.
   → `heightAfterCarve` snapshot.
4. Optional `runE6(... despin-overprint, blend 0.4)`.

It returns the substrate plus both snapshots and `e9`. **`heightAfterBuild` is the temporal-
legibility witness**: it lets the verifier prove "drainage post-dates the relief" — i.e. that the
carve is a real *edit of pre-existing structure*, not relief generated together with the channels.
Test `:219-226` confirms build-only and build+carve are **bit-identical through epoch 1**.

---

## (b) How the renderer EXPRESSES it (structure-reading, NOT noise-generating)

`world-engine-relief-lab.main.js` is **"harness glue only"** (`:1`). The architectural claim — that
this is a structure-reading renderer — holds on inspection:

- **`buildMesh(r)` (`:44-69`)**: creates a `THREE.PlaneGeometry(2,2,n-1,n-1)` and sets each vertex's
  Z **directly from the data**: `pos.setZ(i, (h[i] - mid) * 0.6)` (`:55`). The displacement is the
  baked `substrate.height` — the renderer generates **no** relief, applies **no** noise.
- **Colour is read from data, not synthesized** (`:54-63`): `standing[i]` → sea colour; otherwise a
  height-ramp (low/mid/high) lerp; a channel tint where `log(flowAccum)` is high. Every input is a
  substrate array. The comment block at `:32-33`/`:113-114` states the renderer stays "preset-blind"
  — the preset selector chooses the GENERATION input bundle, NOT a render branch.
- **`drawMini(r)` (`:72-84`)**: a 2D drainage map straight from `flowAccum` + `standing` — drainage
  legibility from data.
- **`window._relief` (`:130-143`)**: exposes `result`, `verifySlice()`, `setPreset/setEpoch2/setRes`,
  and `divergence(against,n)`. Verification reads the same data the renderer draws.

The renderer being preset-blind is the load-bearing proof of "PROCGEN DECIDES, RENDER EXPRESSES":
all body-type difference enters through the *data the compute layer baked*, never through a render-
time branch. **This is exactly the property WS4 lacked** (its shader still synthesized the relief).

### The north-star verifier — `relief-slice.js:90-132`

`verifyReliefSlice(result)` checks five resolution-ROBUST mechanism signals (all gate `pass`):
1. **subtractive** — `height ≤ heightAfterBuild` everywhere.
2. **carveCorrelatesRelief** — high-relief cells incised more than flat low cells (E9 cut the
   mountains E6 built, not random noise).
3. **noUphill** — 0 uphill flow edges on the final filled surface.
4. **accumSpread** — max accum > 5× mean (a few trunk cells carry most drainage).
5. **depressionsFilled** — every interior land cell has a downhill neighbour after fill.
Plus a REPORTED-only **Hack's-law exponent** (`estimateHackExponent`, `:141-168`; ~0.5-0.6 for
mature dendritic networks at n≳160) — explicitly NOT gated (resolution-dependent garnish).
Tests `:232-248` confirm the gate green on Rocky at n=96 and Hack-plausible at n=192.

---

## (c) Body-type divergence produced AS DATA — `relief-divergence.js` + `divergenceReport`

This is the part that makes "they all read as distinct" true at the *data* level, not by recoloring.
The slice's `BUILD INTENT` block (`relief-slice.js:10-20`) names **five compounding layers** that
make presets diverge STRUCTURALLY (not by amplitude — the prior "coat-swap" failure):

- **L1 — regime** (`relief-base-step.js:35-40`, `relief-e6-tectonic.js:33-40`): the un-damped
  `radialStrainSign` flips the Anderson **regime mix** per body (rocky → THRUST-leaning;
  icy/molten → NORMAL-leaning). A *distribution-shape* change in the `regime` array. Reseed-invariant
  (regime is a deterministic function of sign + latitude). `REGIME_GAIN = 0.4` is LOCKED 2026-06-23
  with a banding ceiling (~0.44 for europa) so no preset collapses to a single regime
  (`relief-e6-tectonic.js:14-22`).
- **L2 — geometry** (`relief-e6-tectonic.js:85-95`): the regime SIGN branches `steeredNoise`'s
  frequency/aspect — contraction (+1) → low-freq, long elongated-along-strike sharp ridges/scarps;
  extension (−1) → higher-freq, blockier horst-and-graben. Produces **directional anisotropy** that
  hypsometry cannot see. LOCKED constants `fScale{0.7|1.5}, along{0.25|0.55}, across{1.9|1.2}`.
- **L3 — seed discriminator** (`relief-base-step.js:69-76`): a composition/regime string folds into
  the noise seed → composition-keyed *layout*. Toggleable; deliberately NOT a decisive gate term
  (it only reshuffles arrangement, which is reseed-sensitive).
- **L4 — carve** (`relief-e9-hydrology.js:107-119`): `liquidStability` gates ocean fraction AND
  fluvial carve. Airless/hot ≈ 0 carve, no forced ocean; temperate-wet = full drainage network. The
  hardcoded 0.4 ocean is gone.
- **L5 — terrestrial bundle** (`relief-presets.js:34-38`): a temperate liquid-water body completes
  the wet (terrestrial) / frozen (europa, methane-window) / airless (lava) trio.

### The measuring instrument — `relief-divergence.js`
All metrics z-score first so a pure **amplitude rescale scores ~0** (the coat-swap reads as no
divergence — test `:285-289`). Key metrics:
- **`hypsometricDistance`** (`:25-31`) — Wasserstein-1 on z-scored heights; reseed- AND amplitude-
  invariant; only distribution SHAPE moves it.
- **`regimeHistogramDistance`** (`:44-50`) — total-variation over the 3 regime classes; reseed-
  invariant; the LOAD-BEARING L1 gate axis.
- **`directionalAnisotropy`** (`:62-78`) — across-/along-strike relief-energy ratio about the grain;
  the ONLY metric that credits L2's geometry lever.
- **`carveFraction`** (`:80-83`) — fraction of incised cells; the L4 axis.
- **`perCellRMS`** (`:35-40`) — reseed-SENSITIVE, **DIAGNOSTIC ONLY**, must not certify the gate.

### The decisive gate — `divergenceReport(bundleA, bundleB)` — `relief-slice.js:63-88`
A pair PASSES iff it diverges on **≥1 robust, reseed-INVARIANT, physics-carried axis**: tectonic
regime (L1, `REGIME_DIVERGE 0.2`) OR hydrology/liquidStability (L4, `HYDRO_DIVERGE 0.3`) OR fluvial
carve (L4, `CARVE_DIVERGE 0.05`). Anisotropy (L2) and held-seed hypsometry are **REPORTED to
corroborate, never gated** — L2 flips with regime sign (redundant) and held-seed hypso is empirically
seed-fragile. Because every gate axis is reseed-invariant by construction, **a reshuffle of the same
world (a reseed) CANNOT pass** — the §9 anti-coat-swap guarantee. Tests `:592-616` confirm: cross-
regime (terrestrial vs europa) passes via regime; same-regime (europa vs lava) passes via hydrology;
**identical bundle never passes** (NULL test `:605-611` — all distances ≈0, `pass=false`).

The harness surfaces this on demand via a "divergence vs lava" button + `window._relief.divergence()`
(`:123-128`, `:137-140`) — run ~6× the slice, too heavy for the per-frame loop, so it is explicitly
on-demand (not auto-run). The per-frame HUD shows cheap current-preset drivers (dominant regime,
liquidStability, anisotropy) read straight off the current run (`divergenceDrivers`, `:34-42`).

---

## (d) Honest scope limits (deliberate NON-GOALS, by design — NOT bugs)

Recorded verbatim in the `BUILD INTENT` / `Deliberate NON-GOALS` blocks (`relief-slice.js:21-26`,
`relief-presets.js:14-28`, `relief-e9-hydrology.js:1-4`):

1. **Flat 2D latitude-band DEM, not sphere/cubemap.** Sphere mapping is deferred integration;
   cubemap-seam lake breakage is a known hazard. (The production port `src/worldengine/base/` is
   already adding a sphere-native grain path — `tectonic.js:53-63 writeGrainSphere` + `sphereField.js`.)
2. **E9 is a CPU bake-time reference, not per-frame.** GPU FastFlow (Jain 2024) bake deferred.
3. **D12 derived in the slice's own base step**; production `PlanetGenerator.js:565` hard-zero
   untouched.
4. **Hack's-law exponent is REPORTED, not a gate** (resolution-dependent).
5. **Palette is height-only + precip is latitude-only** — preset-aware palette and temperature-driven
   precip are future work, not gated. (So Europa is NOT icy-colored; `age` defaults to 0.5 for every
   preset — absent from the bundles.)

---

## (e) How this surface relates to the other two world-engine surfaces

The CONTEXT flagged an apparent tension between three surfaces. On inspection there is **no
contradiction** — they are a lineage, not rivals:

1. **The relief slice (repo-root `relief-*.js` + `world-engine-relief-lab.html/.main.js`)** — the
   Max-UAT-PASSED 2026-06-23 ISOLATED LAB. Builds the real `ReliefSubstrate` data structure; the
   host-editor / shared-substrate / structure-as-data reference mapped above. Flat 2D DEM.

2. **`src/worldengine/base/*`** — the **production PORT** of the slice. The file headers state this
   verbatim: `substrate.js:2` "Production port of relief-substrate.js"; `tectonic.js:2` "Production
   port of relief-e6-tectonic.js." Same `ReliefSubstrate` struct, same `stressAtLat`/`writeGrain`/
   `runE6`, same `REGIME_GAIN=0.4` and `NU=0.25` locks — **plus** a sphere-native grain path
   (`writeGrainSphere`, `sphereField.js`, `adaptL0.js`) that begins lifting non-goal #1. This is the
   work of the current branch `feature/world-engine-production-L1` — porting the UAT-passed slice
   mechanism toward production and onto the sphere. It is the slice's *forward* lineage.

3. **WS4 lab-shader wiring (`world-engine-relief-wiring-2026-06-25/`, planet-lod-lab.html shader)** —
   a SEPARATE, EARLIER-ALTITUDE effort that wired only a thin E6 orientation grain + E9 stream-power
   carve INTO the production lab's *fragment shader*. Its procgen layer generated only a latitude-
   banded orientation grain + scalars; the relief was still synthesized in-shader, merely oriented.
   **Max UAT FAILED it** because that is the very thing the relief slice does NOT do — it reads as an
   "orientation overlay," not "structure as data." WS4 is the *anti-pattern* the relief slice and its
   production port are the corrective for.

**Synthesis:** surfaces 1 and 2 are the right-altitude line (data-first host-editor model, slice →
sphere-bound production port). Surface 3 is the wrong-altitude attempt (render-time synthesis with a
thin data grain). The relief slice + its `src/worldengine/base/` port are the reference; WS4 is the
case study in what "structure as data" must replace.

**Lock check:** nothing in the relief slice contradicts the 2026-06-22 locks (share a first-class
mutable substrate that BUILD engines write + SCULPT engines edit, ordered by epoch; Option-A
expose+derive base step; type = derived label). The slice *is* a faithful, if 2D, instance of them.
No lock challenge to flag.
