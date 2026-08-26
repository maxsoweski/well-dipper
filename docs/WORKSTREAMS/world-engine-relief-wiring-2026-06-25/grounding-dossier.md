# WS4 Grounding Dossier — world-engine-relief-wiring-2026-06-25

**Role:** cross-check critic over 6 code-explorer slices, spot-checking every cite myself.
**Scope:** LAB-ONLY (game `src/objects/Planet.js` OUT, per plan §"one decision", Max 2026-06-23).
**Verdict:** No blocking contradiction. Two *framing* corrections the plan must absorb (carve
is already real, not cosmetic; "replace initProvinces" conflates two mechanisms). Several real
WS2 gaps (no orchestrator/baker, no GPU path, latitude-only grain). **Ready to plan.**

All file:line cites below were re-verified against current code on 2026-06-25 (this dossier supersedes
any drifted cite in the plan). Cites are relative to repo root `~/projects/well-dipper`.

---

## TL;DR for the planner — the 5 things that change the build

1. **The carve already lowers height.** Plan §WS4 F2 says "promote the COSMETIC carve to a true
   host-edit" — that framing is half-stale. `world-engine-lab.html:424` already does
   `h -= carveDepth * uRiverCarveDepth` ("lower the floor → F14 floods it"). WS4's real F2 work is
   **epoch ordering + shared substrate + stream-power depth**, NOT "make h drop at all."
2. **The grain CONSUMPTION side is 100% greenfield.** `grep uTectonicGrain` across every renderer
   file → **zero hits**. No uniform, no sampler, no derivation. WS2 shipped the *producer*
   (`writeGrainSphere`); WS4 builds everything from the producer to the shader read.
3. **No orchestrator/baker exists.** WS2 ships the grain data-model + writer + drivers, but nothing
   in the codebase builds a carrier, calls `writeGrainSphere`, and hands it to the renderer (only
   vitest tests do). WS4 writes that glue — the planned new `planet-lod-tectonic.js`.
4. **"Replace initProvinces:797 / fbmdRidged:880" conflates two mechanisms.** `initProvinces` is
   the AMPLITUDE/where field (gProvince) — Max decision #6 says AUGMENT it, keep it. The
   orientation hashing WS4 replaces lives in **six combiners** + **six `deriveUniforms` hashes**,
   NOT in initProvinces. A builder reading only that cite-pair misses 5 of 6 axis sites.
5. **Grain is latitude-only by design.** `stressAtLat` is a pure function of |lat| → grain forms
   latitude-parallel belts, NO longitudinal structure. The `grain-oracle` AC validates the band
   pattern; it does NOT deliver the "swirling continental lineaments" feel. Plan for this expectation.

---

## Slice 1 — WS2 grain inputs (the producer WS4 consumes)

**Ground-truth mechanism.** WS2 (under `src/worldengine/base/`) produces the tectonic GRAIN field as
three per-node arrays declared on two interchangeable carrier shapes (flat n×n DEM + seam-free sphere):
- `grainAngle` Float32 — director in RADIANS, but emits only **{0, π/2}** (a 2-fold director, not a
  full heading). Hard-flips at |lat| = 45°.
- `grainMag` Float32 — 0..1, `min(1, hypot(sMer,sZon)/1.25)`.
- `regime` Uint8 — `{NORMAL:0, STRIKESLIP:1, THRUST:2}`.

The sphere-native writer WS4 calls is `writeGrainSphere(carrier, drivers)`, pure `(lat, drivers)→fields`,
zero rng → byte-identical on re-run. The carrier mesh is built by `buildIrregularSphere` — the SAME
mesh the river router uses, so grain + hydrology share one parameterization by construction.

**Confirmed cites (re-verified):**
| symbol | file | line | note |
|---|---|---|---|
| `writeGrainSphere(carrier, drivers)` | `src/worldengine/base/tectonic.js` | **53** | NO `rotatePoleDeg` arg (flat `writeGrain` has it at :35). |
| `stressAtLat(latDeg, drivers)` | `src/worldengine/base/tectonic.js` | **19** | Melosh despin + radial-strain; NU=0.25, REGIME_GAIN=0.4 LOCKED. |
| `REGIME_BAND_DEG / GRAIN_BAND_DEG / SEAM_LAT_TOL_DEG` | `src/worldengine/base/tectonic.js` | **14 / 16 / 17** | Emergent bands [38.33°, 57.69°]; grain flip 45°; seam tol 1.5°. |
| `makeSphereField(mesh)` | `src/worldengine/base/sphereField.js` | **7** | Declares grainAngle/grainMag/regime; three-free. |
| `latDegOf / tangentFrameAt` | `src/worldengine/base/sphereField.js` | **23 / 27** | Per-node lat = asin(y); {east,north} for director→world vector. |
| `REGIME` enum + `makeSubstrate` | `src/worldengine/base/substrate.js` | **4 / 6** | Enum ordering matters for the contraction-bias assert. |
| `makeBaseStep(bundle, {...})` | `src/worldengine/base/baseStep.js` | **10** | Returns `{drivers, crust, substrate}`; crust carries crustalThickness (FLAT n×n only). |
| `buildIrregularSphere(targetN, lloydIters)` | `planet-lod-rivers.js` | **190** | The three.js mesh feeding makeSphereField; same mesh as the router. |

**WS4 consumer API (the bake recipe):** `mesh = buildIrregularSphere(TARGET_N, LLOYD)` →
`carrier = makeSphereField(mesh)` → `{drivers} = makeBaseStep(adaptL0(planetData), {...})` →
`writeGrainSphere(carrier, drivers)` → read `carrier.grainAngle[i]/grainMag[i]/regime[i]`.
Director→world strike via `carrier.tangentFrameAt(i)`: `cos(angle)*east + sin(angle)*north`.

---

## Slice 2 — grain consumption (the gap WS4 fills in the renderer)

**Ground-truth mechanism.** Every orientation-bearing relief feature hashes its OWN independent
strike axis from the planet seed; the ONLY thing shared today is `gProvince` (amplitude, no
orientation). The chain is: `deriveUniforms` hashes each axis via `seededUnitVec3(seed+N)` →
`applyDrivers()` copies each into a GPU uniform → the combiner does `normalize(uXxxAxis)` and builds
a directional field. WS4 inserts ONE grain field feeding all six combiners, gated behind a new
`uTectonicGrainStrength` (0 = byte-identical fallback) **that does not exist anywhere yet**.

**The full replace-set (six combiners + six derivations + one primitive):**
| consumer (shader) | file | line | derivation (lab-core) | line |
|---|---|---|---|---|
| `fbmdRidged` reads `uOrogenyAxis` (vec2 xz) | `planet-lod-height.glsl.js` | **881** | `orogenyAxis` (sin-hash) | `planet-lod-lab-core.js:662` |
| `canyonCombiner` reads `uChasmaAxis[i]` | `planet-lod-height.glsl.js` | **1917** | `chasmaAxes` (×3 vec3) | `:685` |
| `scarpCombiner` reads `uScarpAxis` | `planet-lod-height.glsl.js` | **1955** | `scarpAxis` | `:707` |
| `tesseraCombiner` reads `uTesseraAxis[0/1]` | `planet-lod-height.glsl.js` | **2102 / 2110** | `tesseraAxes` (×2) | `:725` |
| `lavaPlainsCombiner` reads `uLavaAxis` | `planet-lod-height.glsl.js` | **2189** | `lavaAxis` | `:772` |
| `cryoRidgeCombiner` reads `uCryoRidgeAxis0/1` | `planet-lod-height.glsl.js` | **2621 / 2631** | `cryoRidgeAxes` (×2) | `:888` |
| shared hashing primitive | — | — | `seededUnitVec3(seed)` | `:483` |

**The amplitude field to AUGMENT (NOT replace), per Max decision #6:**
| symbol | file | line | note |
|---|---|---|---|
| `gProvince` (global vec3) | `planet-lod-height.glsl.js` | **796** | Default `vec3(0.5)`; 3 scalar amplitude masks, NO orientation. |
| `initProvinces(vec3 pos)` | `planet-lod-height.glsl.js` | **797** | Sets gProvince from 6 noised() samples + uMacroOffset. |
| `provinceWeight(int fid)` | `planet-lod-height.glsl.js` | **811** | Affinity LUT (48 PROV_* features) → `mix(1.0, fl+(1-fl)*f, uProvinceWeight)`. vitest-drift-guarded vs `planet-archetypes.js`. |
| `gProvince.y` direct read (F41 magma) | `planet-lod-height.glsl.js` | **~2233** | The augment-behind-a-dial idiom WS4 should mirror: `mix(constFallback, gProvince.y, uProvinceWeight)`. |

**Bridge / bake host (where axes are written):** `applyDrivers()` in `world-engine-lab.html`,
axis-write block — `uChasmaAxis.value[i].set` **:2778**, `uScarpAxis.value.set` **:2785**,
`uTesseraAxis.value[i].set` **:2794** (chasma/scarp/tessera copy straight to uniform);
orogeny/lava/cryo route via state→frame-loop. `deriveUniforms` call is in this same host. This is the
once-per-body bake site for the bake-once AC.

**Uniform defaults to sit beside:** `planet-lod-uniforms.js` — `uOrogenyAxis` (vec2 `(1,0)`) **:147**,
`uChasmaAxis` **:153**, `uScarpAxis` **:159**, `uTesseraAxis` **:173**, `uLavaAxis` **:189**,
`uCryoRidgeAxis0/1` **:211/212**, `uMacroOffset` **:120**, `uProvinceWeight` (dial, default 1.0) **:404**.

---

## Slice 3 — carve / router (E9)

**Ground-truth mechanism — the carve is REAL, not cosmetic.** In `world-engine-lab.html` main(),
after all relief combiners and BEFORE the F14 sea cut:
- `h -= carveDepth * uRiverCarveDepth` (**:424**, comment "lower the floor → F14 floods it") — a REAL
  height drop; the carved floor can cross below `uSeaLevel` and flood as water via the SAME mechanism
  as oceans (F14 cut at `liquidMask = smoothstep(...)`, **:435**, `h = mix(h, uSeaLevel, liquidMask)`).
- `grad += -carveGrad*cr*uRiverCarveStrength` (**:425**) bends the V-walls.
- `reliefGate = 1 - smoothstep(...)` (**:421-422**) fades the carve out on high rendered ground (a
  partial subtractive guard — the UAT "rivers cut into mountains" fix).
- Floor darkening at Stage 6 is the ONLY cosmetic part.
- The OLD in-shader F11 noise carve (`fluvialCombiner`, `h += carve`) is **permanently OFF**:
  `uFluvialDensity` forced 0 at `world-engine-lab.html:5540` (retired 2026-06-19). The overlay carve is
  the ONE active river height-lowering carve.

**The subtractive-ness gap (why F2 is non-trivial):** the carve is subtractive in FORM (h only
decreases) but NOT over a shared substrate:
1. **Two height fields, not one.** The router routes on `ROUTER_MAIN` (`planet-lod-rivers.js:113`) —
   the lab combiner chain VERBATIM but with **F11 omitted, fwBase=0, NO F14 sea cut** (verified: the
   ROUTER_MAIN body has no fluvialCombiner / liquidMask / sea cut). The rendered planet uses a
   DIFFERENT in-shader accumulation (full chain). So "carved ≤ authored" can't be proven against the
   SAME h the router routed on.
2. **Depth is a geometric tent, not stream-power.** `depthAt(order) = VALLEY_DEPTH_LO 0.45 → HI 1.0`
   lerped by normalized Strahler order — unrelated to the authored h at that vertex. The plan's F2
   wants `dz = -K·A^m·S^n`; that's a real algorithm change in `buildValleyGeometry`, plus exposing
   slope S (computable from `surf`/`filled`, not currently emitted per-vertex).
3. **No epoch snapshot exists.** Build and carve are interleaved in ONE main() pass. The
   "snapshot built relief, then carve that snapshot" model (F3) needs a NEW full-relief RTT readback
   (a 2nd sampler with the COMPLETE combiner chain) — the existing sampler deliberately strips F11/F14.

**Confirmed cites (re-verified):**
| symbol | file | line | note |
|---|---|---|---|
| `createRiverOverlay({renderer,uniforms,...})` | `planet-lod-rivers.js` | **797** | Orchestration host; epoch passes slot inside `route()`. |
| `routeAndOrder({mesh,height,grad,isOcean,params})` | `planet-lod-rivers.js` | **283** | Returns `{filled,surf,receiver,accum,order,strahler,isChannel,maxOrder,...}`. |
| `buildValleyGeometry({mesh,routed,...})` | `planet-lod-rivers.js` | **595** | 3-rail valley strip; `depthAt(order)` tent → replace with per-vertex incision Δ. |
| `createCarveCubeMap` | `planet-lod-rivers.js` | **716** | HalfFloat RGBA cube (R=depth,G=mouth,B=order), MAX-blended, no depth test. |
| `buildStats` | `planet-lod-rivers.js` | **766** | Source of the regression bands (oceanPct, maxStrahler, orphanPct, uphillPct). |
| `ensureMesh` (idempotent) / `route` | `planet-lod-rivers.js` | **808 / 821** | Mesh built once; route() re-reads/re-routes/re-bakes the cube each call. |
| `ROUTER_MAIN` | `planet-lod-rivers.js` | **113** | Routing height proxy — F11/F14 stripped. NOT the rendered h. |
| carve subtraction `h -= carveDepth*uRiverCarveDepth` | `world-engine-lab.html` | **424** | PROOF the carve lowers h. |
| `reliefGate` | `world-engine-lab.html` | **421** | Fades carve on peaks; tuned by uRiverCarveGateHi (default 0.18). |
| `uFluvialDensity = 0` (F11 retired) | `world-engine-lab.html` | **5540** | In-shader noise carve permanently off. |
| `ensureNetworkRouted` / `riverRerouteDebounced` | `world-engine-lab.html` | **~3528 / ~3649** | Always-on route path; 220ms debounce (bake-once cadence). |

---

## Slice 4 — province augment (is "augment" secretly a "replace"?)

**Ground-truth: augment is genuinely clean.** `gProvince` is a per-fragment vec3 of pure scalar
amplitude/where masks (.x tectonic, .y volcanic, .z ancient/hydrologic). Orientation lives in a
SEPARATE, fully independent set of per-feature seeded axis uniforms (slice 2 table). So a grain field
is a strictly NEW uniform set + a new per-fragment global, ORTHOGONAL to gProvince's channels and
`provinceWeight()`. The ONLY edit to existing consumers is wrapping each `normalize(uXxxAxis)` in
`mix(currentAxis, grainAxis, uTectonicGrainStrength)`, with t=0 = the exact current axis.

**What would secretly turn augment into a replace — AVOID:**
- Widening `gProvince` vec3→vec4+ to pack orientation INTO it (ripples through 48 `provinceWeight`
  rows + the vitest drift-guard). Keep grain a SEPARATE global.
- Re-deriving gProvince's masks FROM grain (couples where-mask to orientation; changes byte-baseline).
- Removing the per-feature `uXxxAxis` uniforms outright instead of `mix`-blending — breaks the
  0-strength fallback. The old axis MUST remain the t=0 endpoint.

**Insertion points (additive):** new uniforms in `makeUniforms` (`planet-lod-uniforms.js`, beside
:147-212 axes and :404 uProvinceWeight) — `uTectonicGrainStrength {value:0.0}` + the grain carrier
(baked sampler OR scalar/seed uniforms); a new `gGrain` global + `initGrain(pos)` adjacent to
`initProvinces` (keep gProvince:796 / provinceWeight:811 byte-untouched); grain derivation in
`deriveUniforms` (:496) emitted in the return object (~:893+); grain uniform push in the
`applyDrivers` axis block (:2778-2794 region).

---

## Slice 5 — E6 math oracle (the grain-oracle AC source)

**Ground-truth: the math is already implemented TWICE and already sphere-native.** The lab reference
`relief-e6-tectonic.js` (flat) AND the production port `src/worldengine/base/tectonic.js` (which ADDS
`writeGrainSphere`). The oracle is ALREADY pinned on the sphere-relevant code by
`tests/worldengine-base-tectonic.test.js`. **The grain-oracle AC can reuse the production
`stressAtLat`/`writeGrainSphere` — it need not re-implement the lab module.**

**Exact math (neutral drivers `{despinAmp:1, radialStrainSign:1, radialStrainMag:0}`):**
`s2 = sin(φ)²`; `sMer = amp·(1.25 - 3.25·s2)`; `sZon = amp·(1.25 - 1.75·s2)`; Anderson regime from
signs (both>0→THRUST, both<0→NORMAL, else STRIKESLIP); `grainAngle = |sMer|≥|sZon| ? 0 : π/2`.
Emergent bands (despin-amp-invariant at neutral strain): `|φ|<38.33°→THRUST`,
`38.33<|φ|<57.69→STRIKESLIP`, `|φ|>57.69→NORMAL`; grainAngle flip at 45°.

**Oracle ACs to pin (neutral drivers):** `stressAtLat(0).regime===THRUST`, `(48)===STRIKESLIP`,
`(85)===NORMAL`; grainAngle `(30)===π/2`, `(60)===0` (read-back compares against `Math.fround(π/2)`);
contraction `(50, sign:+1, mag:0.3).regime >= (50, sign:-1, mag:0.3).regime`; determinism = re-run
byte-identical. The lab + production assertion suites already encode these.

**Confirmed cites:** `stressAtLat` `src/worldengine/base/tectonic.js:19`; `writeGrainSphere` `:53`;
band constants `:14-17`; lab oracle `tests/world-engine-relief-slice.test.js:77`; production oracle
`tests/worldengine-base-tectonic.test.js:8`; `radialStrainSign/Mag/despinAmp` derivation
`src/worldengine/base/baseStep.js:39/40/43`.

---

## Slice 6 — test harness (the verification substrate)

**Ground-truth: three distinct mechanisms, and bare `npm test` is a false-red gate.**

1. **Headless UNIT = vitest, but MUST be scoped.** `npm test` = `vitest run` (`package.json:14`),
   NO `vitest.config.*` and NO `test:` block in `vite.config.js` → it globs ALL `**/*.test.js`,
   sweeping in the pre-existing, WS4-unrelated failures in
   `src/generation/__tests__/KnownObjects.test.js` (`describe('searchKnownObjects')` at **:37**), so
   bare `npm test` exits non-zero and is unusable as a WS4 gate. **Use a scoped path-substring
   invocation:** `npx vitest run tests/planet-lod` (planet cluster) or
   `npx vitest run tests/planet-lod tests/worldengine tests/world-engine-relief-slice` (full relief
   cluster). New WS4 unit tests go in `tests/` (auto-discovered), mirroring
   `tests/world-engine-relief-slice.test.js` + `tests/planet-lod-rivers-carve-channels.test.js`.
2. **Router-lab zero-drift regression is LIVE, not vitest.** Page `rivers-terrain-lab.html` driven by
   `rivers-terrain-lab.main.js`, which `import { createRiverOverlay } from './planet-lod-rivers.js'`
   (**:13**, the SAME shared module → zero-DRIFT) and exposes `window._rivers.stats` (**:147**) +
   `window.__riversTerrainReady` (**:166**). Assert oceanPct≈35, maxStrahler≈5, orphanPct===0,
   uphillPct===0 (off `buildStats`). **Rule: if WS4 touches `planet-lod-rivers.js` (F2), re-run this
   page; if it only touches shader-side `world-engine-lab.html`, the regression is structurally safe.**
3. **Live probe surface for the LAB = `window._lab`** (`world-engine-lab.html:5631`) — NOT the game
   `window.__wd`/`enterSol` (that's `src/main.js`, OUT of scope). The lab boots straight into the
   planet (no splash). `_lab` exposes `{state, uniforms, planet, applyDrivers, setPreset, rivers(on),
   riversReroute(), riverStats}`. Probe `_lab.uniforms.uTectonicGrainStrength.value` etc.

**Live-test discipline (from memory, verify live):** chrome-devtools against the :9223 GPU Chrome (NOT
Playwright/CPU); confirm the actual Vite port via `list_pages` (sandbox curl returns false 000);
append `?fresh=1` to lab URLs to stop sessionStorage scenario-restore corrupting A/B captures; single-
quote `node -e` bodies so bash history-expansion doesn't mangle `!==`. No `docs/TESTING_CONVENTIONS.md`
exists — the live model lives in `docs/ARCHIVE/TESTING_CONVENTIONS_LEGACY.md`.

---

## Contract reconciliation

### Assumptions CONFIRMED against real code
- All 6 `architecturalConnections` cites EXACT: `deriveUniforms` `planet-lod-lab-core.js:496`;
  `initProvinces` `planet-lod-height.glsl.js:797`; `fbmdRidged` `:880`; `createRiverOverlay`
  `planet-lod-rivers.js:797`; `routeAndOrder:283`; `buildValleyGeometry:595`. Plus `writeGrainSphere`
  `src/worldengine/base/tectonic.js:53` (input WS2 surface).
- `gProvince` augment-not-replace (mustStayWorking) is genuinely clean — orientation lives in a
  separate uniform set; zero edits to gProvince/provinceWeight required.
- The router-lab zero-drift regression exists and consumes the shared `planet-lod-rivers.js` module.
- No `Date.now`/`Math.random` in the grain derivation path is achievable — `seededUnitVec3`/sin-hash
  and `writeGrainSphere` are all pure. (Note the `randUnitVec3` `Math.random` reroll helper at
  `world-engine-lab.html:2390` must NOT be the grain derivation source — see risks.)
- The E6 oracle (equator→thrust / mid-lat→strike-slip / pole→normal) reproduces deterministically;
  already pinned in `tests/worldengine-base-tectonic.test.js`.

### Cites/claims that were STALE → corrected
- **Plan §WS4 F2 "promote the COSMETIC carve to a true host-edit"** → STALE FRAMING. The carve
  ALREADY lowers h (`world-engine-lab.html:424`) and floods via F14. Only the Stage-6 floor darkening
  is cosmetic. WS4's gap is epoch ordering + shared substrate + stream-power depth, not "make h drop."
- **Plan §WS4 F1 / contract outputs "replace per-feature axis hashing at initProvinces:797 /
  fbmdRidged:880"** → SEMANTIC CONFLATION (lines are correct, the mechanism is not). `initProvinces`
  carries AMPLITUDE (gProvince), which Max decision #6 says AUGMENT/keep. The orientation hashing to
  REPLACE lives in SIX combiners (fbmdRidged:881, canyon:1917, scarp:1955, tessera:2102/2110,
  lava:2189, cryo:2621/2631) + SIX `deriveUniforms` hashes (orogeny:662, chasma:685, scarp:707,
  tessera:725, lava:772, cryo:888) + the `seededUnitVec3:483` primitive — NOT initProvinces.
- **Test-harness slice's own briefing cites were stale** (not the contract's): `docs/TESTING_
  CONVENTIONS.md` does not exist (only the ARCHIVE legacy); the `window.__wd`/`enterSol` probe surface
  is the GAME (`src/main.js`), not the lab — the lab surface is `window._lab` (`world-engine-lab.html:5631`).
- No line-number drift found in any contract cite. The `:797` collision (initProvinces in
  height.glsl.js vs createRiverOverlay in rivers.js) is coincidental, both correct.

### CONTRADICTIONS between contract assumptions and code
None blocking. The contract is internally consistent with the code once the two framing corrections
above are absorbed. The closest thing to a contradiction is the AC wording in `renderer-expression-only`:
it says "No per-feature axis hashing (the initProvinces / fbmdRidged paths)" — but initProvinces does
NOT do axis hashing (it builds amplitude masks). The AC's INTENT (no orientation hashing for grained
features) is right; the cite-pair naming is imprecise and should be read as "the six combiner axis
reads + their deriveUniforms hashes," with initProvinces explicitly preserved.

---

## Risks the plan must address (open, for `writing-plans`)

1. **No orchestrator/baker exists** — WS2 ships data-model + writer + drivers, but nothing builds a
   carrier, calls `writeGrainSphere`, and feeds the renderer (only vitest does). WS4 writes the glue
   (`planet-lod-tectonic.js`). This is net-new code, not a wiring tweak.
2. **No GPU path for the field** — grain lives in ~600-node JS typed arrays; the height shader is
   per-fragment. WS4 must EITHER (a) rasterize/interpolate the per-node grain to a sampleable
   texture/cube (matches bake-once AC, adds a sampler read) OR (b) re-derive grain analytically
   in-shader from latitude (matches gProvince's per-fragment pattern, but then "bake-once" applies
   only to the carve). **This is a real architecture decision the plan must make.** Because grain is a
   pure function of latitude, (b) is unusually cheap and seam-free here — flag it as a live option.
3. **grainAngle is a 2-value director {0, π/2}** with hard flips at 45°/38.33°/57.69° latitude. If WS4
   feeds raw grainAngle, the strike field is banded with sharp discontinuities, not smooth. If the
   shader interpolates across the 45° seam it smears through angles the math never intended. Decide:
   read the quantized angle, or re-derive a smooth director. The continuous info is in grainMag+regime.
4. **Grain is latitude-only / longitudinally uniform** — same drivers ⇒ same banded pattern, no
   per-body rotation. `writeGrainSphere` LACKS the `rotatePoleDeg` param the flat `writeGrain` has
   (`tectonic.js:53` vs `:35`). If WS4 wants per-body grain variation or pole obliquity on the sphere,
   it must ADD `rotatePoleDeg` to `writeGrainSphere` (small WS2 change) or layer province/noise on top.
   The `one-shared-grain` AC's "share a strike" visual may under-deliver as zonal bands otherwise.
5. **Carve subtractive-ness is harder than "h already drops"** — three sub-gaps: (a) router reads
   `ROUTER_MAIN` (F11/F14 stripped), a DIFFERENT field than the rendered h; (b) depth is a Strahler
   tent, not stream-power `dz=-K·A^m·S^n` (real algorithm change in `buildValleyGeometry`, needs slope
   S exposed); (c) no epoch snapshot — build+carve interleave in one pass, so F3 needs a NEW full-relief
   RTT readback (2nd sampler with the COMPLETE chain). The `reliefGate` (lab.html:421) makes the carve
   NON-monotone vs pure subtraction — an epoch-correct pass may conflict with it; reconcile.
6. **`uTectonicGrainStrength` does not exist** — the entire `grain-zero-identical` fallback depends on
   adding it (default 0) AND routing every grained combiner through `mix(oldAxis, grainAxis, strength)`
   without perturbing the seed-hash path at strength=0. Confirmed absent in all renderer files.
7. **Six edit sites + reroll buttons** — missing one combiner leaves an independent random axis that
   fails `one-shared-grain`. The 🎲 reroll buttons (`world-engine-lab.html`, `randUnitVec3` at :2390,
   `Math.random`-based) write axes directly and must ALSO respect the grain gate, or they re-introduce
   independent random axes. Do NOT use `randUnitVec3` as the grain derivation source.
8. **Two copies of the E6 math** (`relief-e6-tectonic.js` lab + `src/worldengine/base/tectonic.js`
   prod) with duplicated LOCKED constants — currently byte-identical, can drift. WS4 must consume the
   PRODUCTION copy (has the sphere path + exported band constants); treat the lab module as reference.
9. **bare `npm test` is a false-red gate** — every WS4 unit AC and the verify-workstream workflow MUST
   use a scoped `npx vitest run tests/...` invocation, or the pre-existing `searchKnownObjects`
   failures mask WS4 status.
10. **carve-subtractive UNIT AC needs a headless harness** — `routeAndOrder`/`buildValleyGeometry` are
    pure + importable, but `createHeightSampler`/`createRiverOverlay` need a WebGL renderer (RTT
    readback). A fully-headless carve-subtractive test must feed a synthetic height array directly into
    `routeAndOrder` (bypassing the GPU sampler) OR run live. Decide before scoping the unit AC.
11. **Seed coherence** — gProvince is seeded by `uMacroOffset` (from `macroSeed`); the per-feature axes
    use a DIFFERENT `seed` field (`d.seed` in deriveUniforms). For grain orientation to co-orient with
    the province partition, the grain derivation should consume the SAME seed (macroSeed). Confirm.
12. **`bake-once` cadence** — must run inside `route()` to inherit the once-per-(preset,seed,sea)
    debounce. crustalThickness is FLAT-DEM only (no sphere-native crust on the carrier); if WS4 wants
    crust-driven amplitude on the sphere it must re-evaluate `thicknessBlob` per mesh node.

---

*Spot-checked against current code 2026-06-25. No dead extractors. No blocking contradiction →
readyToPlan. Two framing corrections + 12 open risks for `writing-plans` to resolve.*
