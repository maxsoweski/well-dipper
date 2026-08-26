# FIX-PLAN — radius display-scale (post-UAT-fail rebuild)

**Workstream:** `world-engine-radius-display-scale-2026-07-24` · **HEAD:** `21d3e4f` (back to `building`)
**Planner, 2026-07-24.** Inputs read in full: `contract.json` statusNote, `intent.md`,
`DIAGNOSIS-uat-fail.md`, `FORM-SIZE-MAP.md`, `BUILD-NOTES.md`, plus live source
(`world-engine-lab.html`, `planet-lod-height.glsl.js`, `planet-lod-lab-core.js`,
`planet-lod-uniforms.js`, `tests/vis-scale-fence.test.js`, the inc3b pin suites).

## The bar (verbatim, the only thing that counts)

> "I want to be able to make the planet bigger with the radius slider. I want the forms on
> the surface of the planet to remain the same size while the planet itself gets bigger.
> That's it."

## The one equation the whole fix hangs on (FORM-SIZE-MAP §0)

At a fixed camera wheel position, a form's on-screen size is
`S(R) = θ(R) · sVis(R) / cameraDistance`, where `θ` = the form's ANGULAR size on the unit
sphere and `sVis = R^0.5` is the disc-growth factor (shipped, **KEEP**). `S`, disc, and `θ`
are algebraically bound: **the only way to grow the disc (`sVis↑`) while holding `S` constant
is `θ ∝ 1/sVis`, i.e. every form's render frequency must scale `freq_render ∝ sVis`.** Max's
spec is, mechanically, a statement about `freq_render`. Everything below is graded by whether
its `freq_render` can be made `∝ sVis`, and whether that can stay display-only.

At `sVis = 1` (radius 1 R⊕) every expression is identity → the golden harness (which runs
headless, real-R, `bake off`, and never imports `sVis`) stays **byte-identical by
construction**. That structural separation is what lets the fence survive a re-scope (below).

---

## 0. Three scope decisions that GATE the build (surface to Max before the risky slices)

The FORM-SIZE-MAP surfaced three forks that are not the builder's to settle. Recommended
defaults are given; **Slices A–C can proceed under Max's standing greenlight, but D1/D2/D3
must be acknowledged before Slice D touches the bake.**

### D1 — Re-scope AC-ZERO-CLOBBER (REQUIRED; technical, low human-context)
The current fence (`tests/vis-scale-fence.test.js`) bans `sVis` from *any* frequency
surface, including `featureFrequencyFromKm(...)` args and *every* planet uniform write. §0
proves the bar is satisfiable **only** by `freq_render ∝ sVis`, which puts `sVis` into
exactly those surfaces. **The current fence forbids the only mechanism that meets the bar.**
Re-scope from *"sVis touches no frequency anywhere"* to:

> *sVis MAY set a named display-frequency term — one `uDispDomainScale` uniform, the P5b
> fixed-uniform relief-combiner `*Scale/*Freq` writes (lens #3), and an allowlisted set of
> frequency-uniform writes (`uCraterScale`, the km-keyed `*Freq/*Scale` writes) — at the LIVE
> frame/applyDrivers write, PROVIDED these surfaces stay sVis-free: `src/worldengine/**`; the
> bombardment/relief-budget schedule derivations; **the lab route-time crater-derivation block
> `world-engine-lab.html:3689–3740`** (a lab derivation, NOT schedule code — named explicitly per
> lens #7); **`planet-lod-rivers.js`** (host of `route()`/`compositeMargins`/the cube bake — the
> display factor arrives there as a neutral parameter defaulting to `1.0`, token never enters,
> per lens #9); `run-golden.mjs`; and `canonical-scenario.js`. `sVis = 1` stays bit-identical,
> and goldens stay byte-identical with NO re-capture.*

The byte-golden guarantee **survives** (harness separation, §0). What changes is that the
rendered height *content* at non-1 radii now depends on `sVis` — which is the whole point.
**Recommendation: proceed.** It is technical/mechanical, not a taste call. Flagged only so
Max knows the "display-only fence" language is loosening in a bounded, tested way.

### D2 — km-keyed texture features: hold constant, or leave shrinking? (taste fork)
The 17 fixed-`sizeKm` texture features (dunes, facets, hex, chaos cells, sub-floor pits,
fluvial, etc. — FORM-SIZE-MAP §2) currently key `freq ∝ R` (real radius), so they **shrink**
on screen as R grows (`S ∝ R^-0.5`). They are NOT what Max saw "scaling up." Two readings:
- **(a) Hold constant** (`displayRadius = sVis` at the write → `freq ∝ sVis`): honors the
  literal bar ("forms remain the same size").
- **(b) Leave shrinking:** honors the inc3b realism Max previously accepted ("bigger world →
  relatively smaller km-features / finer texture").

**Recommendation: (a) hold constant** — the ratified bar is explicit and literal, and this is
the newer, ratified spec. It is **one idiom at each write, trivially reversible.** This is the
one place the ratified spec fights inc3b realism, so it is the #1 thing to watch at UAT; if
Max prefers the realism read, flip P5 back in one line and re-gate.

### D3 — the baked macro body + the stamped-crater hard ceiling (architecture + physics limit)
The live lab renders its macro relief from the **baked relief cube**
(`reliefBakeStrength = 1.0`, `world-engine-lab.html:2534` — "AC2 LAB live initial = ON"), NOT
the live analytic FBM (which is the headless/golden path, default `0`). So:
- The **continuous continent body** in the baked cube is what Max saw growing. It is
  re-bakeable at `sVis×` domain density across the whole 0.3–16 range (a 1/4-disc continent
  → 1/8-disc — nowhere near the mesh floor). **Tractable** (Slice D).
- The **discrete stamped basin/crater population** in the cube is angular-fixed PHYSICS
  geometry floored at `MESH_FLOOR_RAD = 0.055` (inc3b, `bombardment.js:86`). Holding it
  constant beyond ~radius 8 (`sVis ≈ 2.83`) needs sub-mesh-floor craters — **impossible on
  the frozen 256²/cube substrate Max froze.** This is the ONE form no display transform can
  correct. Fine stamped craters retain some growth at large radius: the honest **residue**,
  carried into the read-gate + UAT recipe verbatim so Max signs it knowingly.

**Recommendation:** re-bake the continuous body at display density (Slice D, gated off the
golden path); accept the stamped-crater residue with explicit disclosure. Fallback if the
route re-bake proves too costly/risky: a `bake→synth` crossover as `sVis` departs 1 (uses the
Slice-C analytic path, no re-bake, but loses stamped basins at large radius — a visible morph
in continent character). **D3 needs Max's nod on mechanism before Slice D.**

> **Process guard (why we are here):** this UAT failed partly because the "live" AC drove the
> *programmatic* path, never a real pointer-drag, and never tested the live `bake = 1`
> profile. **Do not present to Max until Slice D lands and the FINAL read-gate passes at the
> live default (`reliefBakeStrength = 1.0`).** Staging the UAT at `bake = 0` would repeat the
> exact "tested the wrong profile" miss.

---

## Slices in dependency order (smallest-first)

> **Gate 0 (no code, MUST precede any build landing):** freeze the READ-GATE model (§ below)
> and get Max's acknowledgement on D1/D2/D3. Per `feedback_perceptual-read-gate-before-uat`,
> the frozen read-model is the artifact whose absence sank the last increment.

### Slice A — Slider ergonomics (independent; fixes the "does not reliably go up" half)
No procgen, no fence interaction, no sVis. Lands and read-gates alone.
- **Edit sites:**
  - `world-engine-lab.html:3902` — replace the linear
    `fDrivers.add(state, 'planetRadiusEarth', 0.3, 16, 0.01)…` with a **log-position proxy**:
    a `radiusProxy` object with `get t()/set t()` that exp-maps `[0,1] ↔ [0.3,16]`
    (`state.planetRadiusEarth = 0.3 · (16/0.3)^t`), added as
    `fDrivers.add(radiusProxy,'t',0,1,0.001).name('planet radius (log)').listen()`. Keep the
    disabled km readout (`:3903`) and add a disabled numeric RE readout for legibility. This
    yields a constant ~+0.7%/px disc-growth ratio across the whole 53× range, killing the
    left-edge violence and the right-edge dead zone (DIAGNOSIS Finding 1).
  - **Debounce the re-derive:** route the radius `onChange` through a trailing debounce
    (reuse the `riverRerouteDebounced` idiom at `:3890-3896`, 220 ms) so a drag re-derives
    once on settle, not per tick — removes the ~500 ms terrain-pop lag that reads as
    "nothing happens / then it jumps." At `sVis=1` and on any non-drag setter, behavior is
    unchanged.
- **Test additions:** NEW pure log-map helper in `planet-lod-lab-core.js`
  (`radiusFromT(t)` / `tFromRadius(r)`) so it is CPU-testable; NEW
  `tests/radius-slider-map.test.js` — round-trip `t↔radius`, endpoints (`t=0→0.3`,
  `t=1→16`), strict monotonicity over a 200-pt sweep, and constant ratio-per-Δt
  (perceptual-uniformity assertion). The lab imports the same export.

### Slice B — Fence re-scope + combiner-feature display keying (P4 + P5)
The smallest content-touch that is visible at the live `bake=1` default (these combiners
render on top of the baked body regardless of bake strength). Carries the D1 fence re-scope.
- **Edit sites:**
  - **P4 synth craters** — `world-engine-lab.html:6059`:
    `uniforms.uCraterScale.value = featureFrequencyFromKm(state.planetRadiusEarth, state.craterSizeKm, C_CRATER) * sVis;`
    (multiply the DISPLAY uniform by `sVis` at the write; `lab-core`'s `featureFrequencyFromKm`
    and `state.craterSizeKm`/`D_char` stay real-R — the inc3b physics pin is invisible to
    this, see Test plan).
  - **P4 amp — site precision (folded from lens #7).** The `uCraterAmp` display factor, IF
    the crater depth/diameter aspect visibly breaks under P4's `·sVis` shrink, goes at the
    **WRITE site `:6060`** (`uniforms.uCraterAmp.value = state.craterAmp * (1/sVis);`) and
    **NOWHERE else.** It must NOT be appended to the physics DERIVATION
    `state.craterAmp = (D_D_SIMPLE/CRATER_DEPTH)·radPerKm(_RE)·_Dchar` at `:3726` — that
    derivation is inc3b PHYSICS and stays real-R. **The synth-law test cannot police a
    derivation-site injection:** its source-regex pin (`worldengine-inc3b-synth-law.test.js:143`
    = `/D_D_SIMPLE\s*\/\s*CRATER_DEPTH\)\s*\*\s*radPerKm\(/`) matches only the PREFIX up to
    `radPerKm(` and is BLIND to a `/sVis` appended at `:3726`; the unit comparison recomputes
    `uCraterAmp` independently (test `:55`) so it also cannot catch it. Barred region: the
    entire lab route-time crater-derivation block **`:3689–3740`**
    (`state.craterSizeKm`/`craterAmp`/`craterDensity`/`craterRelaxation`) is byte-untouched —
    this is a lab derivation, NOT `bombardment.js` schedule code, so a literal reading of "the
    schedule derivations" does NOT cover it; name it explicitly.
  - **No double-scale on craters (folded from lens #7).** Slice C's `uDispDomainScale` must
    NOT reach `uCraterScale` or the crater combiner's GLSL frequency. As scoped Slice C only
    threads `uDispDomainScale` into `computeHeight`/`fbmd`/`initProvinces`/the `uNoiseScale*0.3`
    sites (`:971/:2147/:2178`), and `craterCombiner` (GLSL `:1959–2036`) reads NO `uNoiseScale`
    (verified), so it is currently untouched — this is a preventive fence: the crater display
    scale is applied EXACTLY ONCE via P4's `·sVis` at `:6059`. If a builder later routes
    `uDispDomainScale` through the crater combiner, craters scale twice (P4·sVis ×
    uDispDomainScale) — wrong and off-spec.
  - **P5 km-keyed texture (D2 default = hold constant)** — the 17 `featureFrequencyFromKm`
    sites (`:5804, 5813, 5823, 5974, 5983, 5991, 6021, 6022, 6102, 6111, 6115, 6122, 6155,
    6156, 6197`): pass `sVis` as the pseudo-radius —
    `featureFrequencyFromKm(sVis, state.<x>SizeKm, C_<X>)` → `freq ∝ sVis` → constant on
    screen. Prefer a single local `const _dispR = sVis;` at the top of the frame block and a
    one-token swap at each site so the intent is greppable and D2-reversible in one edit.
  - **P5b — the fixed-uniform relief combiner class (HEADLINE GAP folded from lens #3).**
    16 relief combiners set their on-screen wavelength from DEDICATED fixed uniforms written
    straight from `state` constants, NOT `featureFrequencyFromKm` (so P4/P5 miss them) and NOT
    `uNoiseScale` (so Slice C misses them — Slice C's only combiner sites `:971/:2147/:2178`
    are all `uNoiseScale*0.3`; there are exactly 9 `uNoiseScale` refs total). Every one is
    angular-fixed (`pos*uX` / `field*uX` in the GLSL) and runs LIVE in `main()` at
    `world-engine-lab.html:399–419` on top of the baked `hd`, **UNCONDITIONALLY at `bake=1`** —
    the bake `if/else` ends at `:386`; the combiner calls are NOT inside any bake guard
    (verified). Concrete walk, mountains R0.5→R8: `uMountainScale=1.6` fixed
    (GLSL `:1477` `fbmdRidged(pos*uMountainScale,…)`) ⇒ θ const ⇒ `S = θ·sVis`; `sVis`
    0.707→2.83 ⇒ mountains render **4.0× larger** while Max wants them constant. `state.mountainAmp`
    is driven live and gated on for tectonic/Earthlike worlds, and the read-gate preset is
    `Rocky (Earthlike)` — so this is the exact form Max saw scaling up (UAT-fail verbatim).
    **Wire every one into Slice B's `·sVis` treatment** (multiply the DISPLAY uniform by `sVis`
    at the frame write; `state`/physics stays real-R; add each to the fence allowlist):
    `uMountainScale` (`:6075`), `uScarpFreq`/`uScarpWarpFreq` (`:6085`/`:6087`), `uPlateauScale`
    (`:6090`), `uTesseraFreq`/`uTesseraWarpFreq` (`:6095`/`:6097`), `uWrinkleFreq` (`:6113`),
    `uDoubleRidgeFreq` (`:6126`), `uGroovedBandFreq` (`:6129`), `uBladeFreq` (`:6159`),
    `uGlacialScale`/`uLineationFreq` (`:6165`/`:6169`), `uShatSubFreq` (`:5997`),
    `uMachDistrictScale`/`uMachBlockScale` (`:6003`/`:6004`), `uCityScale` (`:6014`). Do a
    COMPLETE relief-form census first (grep every `*Scale`/`*Freq` planet-uniform write and
    confirm each is either P4/P5, P5b, or a non-frequency term) — the FORM-SIZE-MAP §1 already
    flagged that "every combiner's hardcoded vPos multiplier" needs `freq∝sVis`, and the plan
    had wired only the P4/P5/uNoiseScale subset. **Without P5b, the plan does not deliver Max's
    sentence.** (Warp-frequency uniforms `*WarpFreq` scale together with their base so the warp
    domain tracks; `*Amp`/`*Strength`/`*Width` terms are NOT frequencies — leave them real.)
- **Fence re-scope (the conscious test moves):** rewrite `tests/vis-scale-fence.test.js`
  (details in Test plan) — the `featureFrequencyFromKm` ban and the planet-uniform-bundle
  ban become an allowlist; the worldengine/golden/GLSL-token bans STAY.
- **Test additions:** NEW unit assertions that `featureFrequencyFromKm(sVis,…)` reduces to the
  real-R value at `sVis=1` (identity) and scales `∝sVis` at `sVis>1`; the re-scoped fence
  (below).

### Slice C — Analytic macro body + provinces honor the display domain-scale (P1 + P3)
The core "continents stop scaling" mechanism, in the LIVE GLSL. Introduces the single global
lever. Visible at `bake=0` (proved by the isolated read-gate); Slice D wires it into the
`bake=1` default.
- **Edit sites:**
  - **New uniform** `uDispDomainScale` in `planet-lod-uniforms.js` (after `uNoiseScale:{value:4.0}`,
    `:10`), **default `1.0`** — so the headless/golden path (which never sets it) is identity.
  - **`world-engine-lab.html` frame loop** (~`:5698`, beside the other per-frame uniform
    writes): `uniforms.uDispDomainScale.value = sVis;` — the ONLY write, lab-side, display-only.
  - **`planet-lod-height.glsl.js`** — thread `uDispDomainScale` into the macro/province
    sample domain so all their frequencies scale together:
    - `computeHeight` (`:630-633`): multiply the sample `pos` by `uDispDomainScale`.
    - `fbmd` (`:753`): scale the base `freq` (or `pos`) by `uDispDomainScale` — **and apply
      the chain-rule factor to the analytic gradient** (`grad += amp*w*freq*n.yzw` at `:769`
      must pick up the same `uDispDomainScale` so the shaded normal stays correct; `noised()`
      returns the value in `.x`, gradient in `.yzw`).
    - `initProvinces` (`:840-845`): multiply each `pos * <const>` by `uDispDomainScale` (region
      partition gets finer → more, smaller provinces → correct; `provinceWeight` consumers
      follow for free).
    - The combiner-internal macro-tied frequencies that read `uNoiseScale*0.3` (`:971, :2147,
      :2178`, and any other `uNoiseScale`-derived macro site) get the same `uDispDomainScale`
      factor so they track the body.
    - Declare `uniform float uDispDomainScale;` in the shader header (near `uNoiseScale`,
      `:13`).
  - **Guard (headless-inert):** `uDispDomainScale` NAME lives in the GLSL, but the token
    `sVis` never enters any shader string — the shader reads the uniform, the JS writes it.
    Default `1.0` + the golden path never setting it ≠ 1 = byte-identical goldens. `sVis=1`
    (radius 1) → `uDispDomainScale = 1` → every expression is today's expression.
- **Isolated-harness discipline (`feedback_isolated-test-harnesses`):** build/verify this at
  `reliefBakeStrength = 0` (synth macro) first — that isolates the domain-scale mechanism from
  the bake. Run the read-gate (a) + (b) at `bake=0` here. If it works in synth and fails under
  bake, the bug is the bake wiring (Slice D), not the mechanism.
- **Test additions:** NEW unit assertion `uDispDomainScale` default `=== 1.0`; the fence's
  GLSL-region test still green (uniform-name indirection); a positive pin that the frame loop
  writes `uDispDomainScale.value = sVis` and nothing else feeds it.

### Slice D — Baked macro body honors the display scale (procgen-forced; D3) + residue
Makes the Slice-C fix reach the eyes at the live `bake=1` default. **Largest/riskiest slice;
gated on D3.**
- **CORRECT edit target (re-grounded — folded from lens #8): the PRODUCTION bake lives in
  `planet-lod-rivers.js` `route()`, NOT the lab-side AC2 probe.** The prior draft cited
  `world-engine-lab.html` `makeSphereField :6921` / `writeHeightSphere :6923` — those are inside
  `_bakedReliefAt(dir)`, the **AC2 parity PROBE** (a nearest-node height lookup for the
  strength-1 parity check), which never feeds the cube Max sees. The continuous body that
  reaches the eyes is built in `planet-lod-rivers.js` `route()` (`:1297`):
  `makeSphereField(mesh)` `:1315` → `writeGrainSphere`/`writeHeightSphere` (`:532` /
  `:1315`-region, `heightSeed`) → `compositeMargins(carrier, relief.reliefBudget)` `:1361` →
  the relief-cube bake. Slice D must be plumbed through `route()`, not the probe.
- **Edit sites (recommended mechanism — CONFINED continuous-body domain scale):**
  - Apply the display-domain factor **ONLY inside the continuous-body height terms** of the
    baked field. **Do NOT scale `carrier.verts[i]`** — those are SHARED unit direction vectors
    (`sphereField.js:4` "verts are unit dirs, y-up") consumed by the physics writers:
    `carrier.latDegOf(i) = asin(verts[i][1])`, `tangentFrameAt(i)`, `writeGrainSphere`,
    `writeBombardment`, and the province/fault fields all read the same verts. Scaling them
    corrupts latitude / grain-steering / bombardment / provinces — that is PHYSICS corruption,
    not a display transform, and it moves every worldengine carrier byte-golden (folded from
    lens #2).
  - `writeHeightSphere`'s continent-scale frequencies are **HARDCODED** with no domain hook
    (`steeredNoise3(…,9.0,…)` `tectonic.js:151`, plateau `noisePlateau(d*6)` `:156`,
    `thicknessBlobSphere` 2.5/5.0). So confining the factor to only the continuous body means
    ONE of: **(a)** thread a NEW neutral `domainScale` parameter into
    `writeHeightSphere`/`makeSphereField` — this **DOES edit `src/worldengine/**`** (contra the
    prior "worldengine untouched" framing; "sVis-free" only bars the TOKEN, not the edit). If
    taken, its **default MUST be `1.0`** and that default is pinned byte-identical against the
    goldens in the Test-additions below; **or (b)** do a separate lab-side continuous-body
    evaluation that does NOT reuse the physics carrier (no worldengine edit, but duplicates the
    height math — higher drift risk). Pick (a) with the pinned default unless (b) is cheaper to
    keep in sync.
  - **compositeMargins budget interaction — characterize before shipping (folded from lens
    #8).** `compositeMargins(carrier, relief.reliefBudget)` `:1361` solves the RMS-preserving
    `w_e/w_i` from the REALIZED raw-MS norms of `carrier.height` against the real-R `f_I` target
    from `deriveReliefBudget(cond, …)` `:608`. Because Slice D scales the height sample domain
    UPSTREAM of `:1361`, on the LIVE path the inc3b budget **re-solves on the display-scaled
    field** — its RMS-preserving renormalization can shift `w_e/w_i` off the frozen inc3b worked
    points and partially renormalize the very continent amplitude Slice D is trying to make
    relatively smaller (the field carries a large DC/low-freq component per BUILD-NOTES, so the
    split moves materially under domain scaling). This is UNQUANTIFIED. Fix the display-scale's
    position relative to `compositeMargins:1361` (scale after the budget solve, or re-target the
    budget on the scaled norms deliberately) and read-gate the live-path budget behavior at
    R=8. Headless stays byte-identical via the `factor=1.0` guard — the hazard is entirely the
    LIVE `compositeMargins` interaction.
  - **Golden/headless guard (load-bearing):** the display-domain factor is `1.0` on the
    golden/headless route (real-R bake), applied `≠1` ONLY in the live-lab bake. Keep the bake
    real-R for goldens; apply display density only at the live sample step, or hard-gate the
    non-1 factor behind the live frame path (FORM-SIZE-MAP §5). Re-baking fires on
    drag-**settle** (Slice A's debounce), not per tick.
  - **`planet-lod-rivers.js` = new fenced surface (folded from lens #9):** the factor arrives
    in `route()` as a **neutral parameter defaulting to `1.0`**; the `sVis`/`visScaleOf` TOKEN
    never enters the module (grep = 0 today; keep it 0). Byte-golden hash is NOT the guard here
    — the golden trajectory harness does not import `planet-lod-rivers.js`; the real tripwires
    are the inc3b composite/budget UNIT pins (`worldengine-v2-5-preset-composite`,
    `worldengine-inc3b-composite-budget`, `worldengine-inc3b-relief-budget`) which exercise
    `compositeMargins` directly on real-R carriers, plus the carrier byte-identity goldens which
    import `buildIrregularSphere` from this file.
  - **Physics untouched (inc3b fence):** the bombardment schedule
    (`D_FLOOR_KM ∝ R`, `MESH_FLOOR_RAD`, `D_char`, the relief-budget `f_I`, the synth crater
    law) keep real-R derivations. Scaling the confined continuous-body domain changes where the
    continuous body is sampled, NOT the schedule. Stamped craters still land at their real-R km
    sizes, angular-floored at `MESH_FLOOR_RAD` → **the residue.**
  - **Simplest byte-safe alternative — prefer the FALLBACK if the confined route-scale proves
    risky (folded from lenses #2/#8):** the `bake→synth` crossover below IS byte-safe — it
    reuses the Slice-C analytic path, needs NO re-bake, never touches `src/worldengine/**` or
    `compositeMargins`, and sidesteps the shared-verts and budget-re-solve hazards entirely.
    Only the RECOMMENDED route-rebake mechanism carries those defects.
- **Residue disclosure (D3, verbatim into the read-gate + UAT recipe):** *"Fine stamped
  craters/basins are angular-fixed physics geometry floored at the mesh resolution; beyond
  ~radius 8 they cannot be held constant without sub-mesh-floor craters, which the frozen
  256²/cube substrate cannot represent. They retain some growth at large radius — the one form
  no display transform corrects."*
- **Fallback (if route re-bake is rejected at D3):** `bake→synth` crossover — drive
  `reliefBakeStrength` from 1→0 as `sVis` departs 1, so the macro body comes from the
  Slice-C domain-scaled analytic path. No re-bake; loses stamped basins at large radius
  (visible morph). Cheaper, less faithful.
- **Test additions (RE-TARGETED — folded from lens #1): pin the bake against the goldens that
  actually run the bake, NOT `verify-golden`.** `verify-golden` (`run-golden.mjs` +
  `canonical-scenario.js`, hash `40c18aad`) is a **pure-math orbital-motion trajectory**
  (`createAccumulator` + `mulberry32`) with ZERO references to
  `makeSphereField`/`writeHeightSphere`/`compositeMargins`/bake (grep-confirmed — it never
  imports the height writers) — it will hash byte-identically no matter what Slice D does to
  the bake, so it provides NO bake guarantee. The code Slice D edits is hashed by DIFFERENT
  goldens that recompute the carrier via `makeSphereField(buildIrregularSphere(…))` +
  `writeHeightSphere`:
  - `tests/v2-0-byte-identity.test.js` (75 carrier hashes vs `fixtures/v2-0-carrier-goldens.json`),
  - `tests/worldengine-base-height-sphere.test.js`, `tests/relief-height-cube.test.js`.
  NEW dedicated inertness pin: assert the display-density factor is `1.0` on the golden/headless
  route and that this leaves **those three suites' hashes/outputs byte-identical** (default
  `domainScale === 1.0` → no carrier moves), plus the inc3b composite/budget pins
  (`worldengine-v2-5-preset-composite`, `worldengine-inc3b-composite-budget`,
  `worldengine-inc3b-relief-budget`) unaffected on real-R carriers. `verify-golden 40c18aad`
  stays green as an **incidental backstop**, not as the bake guarantee. Keep the
  `src/worldengine/**` sVis-token walk; extend it to `planet-lod-rivers.js` (lens #9). **NO
  `--record`.**

**sliceCount = 4 code slices (A, B, C, D)** behind **Gate 0** (read-gate freeze + D1/D2/D3
acknowledgement, no code).

---

## Form-size mechanism — per-pathway summary (FORM-SIZE-MAP §4, display-only preferred)

| Pathway | today `S(R)` | make `S` const | mechanism | slice | display-only? |
|---|---|---|---|---|---|
| **P6** disc growth + LOD + clamp (`sVis` layer) | provides `·sVis` | keep as-is | shipped `5cef327` | — | yes (done) |
| **P4** synth sub-floor craters `uCraterScale` | grows `∝sVis` | `·sVis` at write | uniform-value multiply | B | yes (fence re-scope) |
| **P5** km-keyed texture (17 sites) | shrinks `∝R^-0.5` | `displayRadius=sVis` | uniform-value at write | B | yes (fence + D2 fork) |
| **P1** macro analytic FBM / combiners | grows `∝sVis` | domain `·sVis` | `uDispDomainScale` (GLSL uniform) | C | yes (fence re-scope) |
| **P3** province partition | grows `∝sVis` | same `uDispDomainScale` | GLSL uniform | C | yes |
| **P2** baked relief cube (continuous body) | grows `∝sVis` | re-bake at `sVis×` density | route-domain scale, gated off golden | D | **procgen-forced** |
| **P2′** baked STAMPED craters/basins | grows `∝sVis` | (impossible below mesh floor) | — | D residue | **NO — hard ceiling** |

Guard for every display mechanism: NAME lives in a uniform / neutral param; the `sVis` token
never enters `src/worldengine/**`, any `/* glsl */` string, `run-golden.mjs`, or
`canonical-scenario.js`; default is identity so the headless/golden path is byte-identical.

---

## READ-GATE spec (frozen BEFORE any build lands — Gate 0)

Per `feedback_perceptual-read-gate-before-uat`. Blind agents order/measure from pixels alone;
this is the model whose absence sank the last increment.

### Staging (exact, reproducible — same for every capture unless noted)
- **Preset:** `Rocky (Earthlike)` (prominent continents/relief — matches the live default Max
  sees) via `window._lab.setPreset('Rocky (Earthlike)')`.
- **Seed:** `window._lab.setSeed(1234, 5678)` (macro 1234 / detail 5678) — deterministic pattern.
- **Light:** `WORLD_LIGHT = (0.6, 0.35, 0.7)` normalized — the lab constant (`:197`); **do not
  change.**
- **Animation frozen:** `state.spinSpeed = 0` AND freeze the frame clock (`_sweepFreeze`) so
  `t`/rotation do not advance — pixels reproducible.
- **Camera:** `state.yaw = 0.337`, `state.pitch = 0.205` (defaults), `state.distance = 6.0`.
  Clamp-safe at all three radii (`minCameraDistance = sVis·1.1` = 0.78 / 1.56 / 3.11 for
  r = 0.5 / 2 / 8; 6.0 > all — the disc never clips and the camera never enters the sphere).
- **LOD pinned:** `state.octAuto = false`, `state.octaves = 8` — so octave DEPTH is constant
  across the trio and only the frequency-keying moves form size (removes the LOD confound,
  since `logicalDist = distance/sVis` would otherwise vary detail across radii).
- **Canvas:** fixed 900×900, fixed DPR — px measurements comparable across captures.
- **Capture is the renderer CANVAS ELEMENT only — no GUI chrome in frame (folded from lens
  #5).** The blind gates (a)/(b)/(c) all assume the captured pixels carry NO radius cue, but
  the lil-gui panel renders a live `radius (km)` readout (`:3903`, e.g. "3186" at R=0.5), the
  `planet radius (RE)` slider label+value (`:3902`), and Slice A ADDS a disabled numeric RE
  readout — a full-viewport screenshot leaks the radius and trivially contaminates the ordering
  (the S2 GUI-in-frame class). Capture the canvas element specifically (element-scoped
  screenshot or `canvas.toDataURL` crop), assert no panel is in frame, AND
  hide/freeze the `radius (km)` + RE readouts (or hide the whole `.lil-gui` panel) during
  capture. This is a hard staging requirement, not optional.
- **Bake:** **isolated read-gate for Slices A–C at `reliefBakeStrength = 0`** (synth macro —
  proves the display mechanism in isolation). **FINAL read-gate + Max UAT at
  `reliefBakeStrength = 1.0`** (the live default — the profile Max actually uses).
- Set radius via `state.planetRadiusEarth = <R>; applyDrivers();` (drives the same path the
  GUI slider calls). For the reliability check, ALSO do one **real trusted pointer-drag** of
  the log slider end-to-end and confirm the disc grows smoothly (the drag profile the last AC
  never exercised).
- **Mid-drag form constancy at `bake=1` (folded from lens #4).** `planet.scale.setScalar(sVis)`
  updates EVERY frame (`:5656`) so the disc grows in real time as Max drags, but the baked cube
  re-bakes only on drag-**settle** (Slice A's 220 ms debounce). Between settles the stale cube's
  object-space continents are scaled by the live `planet.scale` and **grow 1:1 with the disc
  DURING the drag** — exactly "the terrain features appear to scale up with the radius" (Max's
  UAT-fail verbatim) — then snap smaller on release. **Decide the mid-drag contract explicitly:**
  live re-bake during drag / `bake→synth` crossover while dragging / accept + disclose the
  transient. Then add a read-gate step that measures the characteristic form px **THROUGH** a
  real trusted drag at `bake=1` (not only at the rest points) and asserts it does not visibly
  balloon mid-drag. Measuring only at rest (as the prior AC did) repeats the "verified the wrong
  execution profile" miss that sank the last UAT.

### (a) Blind size-ordering — **3/3 required**
Three renders, identical staging, radius `{0.5, 2, 8}`. Blind agents order them by planet size
from pixels alone. Disc `sVis` = 0.707 / 1.414 / 2.83 (×2 per step) → unambiguous. Fail = the
disc-growth (P6) regressed.

### (b) Form-size constancy — **max deviation ≤ 15%**
Measure the **characteristic macro-relief band width in px** from a fixed disc-crossing
scanline through the disc center at each of the three radii (pattern-agnostic: the procedural
pattern differs per radius since forms rescale, so a *specific* form is not trackable — the
*characteristic on-screen wavelength* is the reproducible, nameable measure; equivalently, the
median light↔dark relief-band width). If the fix works, band px is ≈ constant while disc px
grows ×2 per step. `max|dev| ≤ 15%` across the trio. (Optional secondary: if a prominent
stamped crater is visible at all three radii, note its rim px — expected to grow at large
radius = the disclosed residue, not a fail.)

### (c) Bigger-vs-closer discrimination pair — **correct ID required**
Two matched-disc renders at the SAME radius (8, `sVis = 2.83`, identical disc px): (i) the
CURRENT uniform-scale build `5cef327` (forms grow with the disc = "closer" cue); (ii) the
FIXED build (forms constant → relatively smaller / more numerous = "bigger" cue). Blind agents
identify which is "a bigger planet" vs "the camera moved closer." Only the form-keying differs,
so a correct call is direct evidence the cue flipped from "closer" to "bigger."

### (d) Live-profile pass — `octAuto` ON at default camera (folded from lens #6)
Gates (a)–(c) pin `octAuto=false, octaves=8` and freeze LOD to isolate frequency — which
**structurally removes the very confound** that decides whether the fix reads as "bigger" vs
"closer + blurry." Slice C raises the effective noise frequency by `uDispDomainScale=sVis`, and
`fbmd`'s anti-shimmer clamp (ON at the live default `uFwClamp=1`) fades trailing octaves via
`w *= 1 - smoothstep(0.4, 0.8, fwBase*freq)` (GLSL `:759–762`): with `freq·sVis` the finest
octaves cross the clamp SOONER at large `sVis`, so the intended "more, smaller continents" can
lose their finest detail and read as SMOOTHER, not more-numerous. Opposing it, `autoOctaves`
keys on `logicalDist = state.distance/sVis` (`:5688–5690`), adding octaves at large `sVis`. The
net balance is what determines success. Add a SEPARATE read-gate pass with `octAuto` ON at the
default camera confirming the "more numerous forms" cue survives the fwidth clamp at R=8, BEFORE
presenting to Max. (Keep the frozen-LOD (a)/(b) for the isolated frequency measurement; this is
an additional pass, not a replacement.)

---

## Test plan — what moves, what's new, what stays

### Existing pins that MOVE (conscious changes to the 5cef327 fence)
- `tests/vis-scale-fence.test.js:92-96` — **REWRITE** `never passes sVis to
  featureFrequencyFromKm`. P5 now intentionally passes `displayRadius = sVis` at the live
  write. Re-anchor the physics-frequency guarantee to the surfaces that MUST stay real-R:
  assert `run-golden.mjs` + `canonical-scenario.js` + `src/worldengine/**` contain no
  `featureFrequencyFromKm(...sVis...)` and no sVis token (they already can't).
- `tests/vis-scale-fence.test.js:98-104` — **REWRITE** `never feeds sVis into the planet
  height uniform bundle` into a **display-frequency ALLOWLIST**: `uDispDomainScale`,
  `uCraterScale`, and the km-keyed `*Freq`/`*Scale` writes MAY take `sVis`; **every other**
  planet uniform write + all height/physics *content* still banned (invert the regex to a
  named allow set).

### New tests
- `tests/radius-slider-map.test.js` (Slice A) — log-map round-trip / endpoints / monotonic /
  constant-ratio.
- `tests/vis-scale-fence.test.js` additions (Slices B/C) — `featureFrequencyFromKm(sVis,…)`
  identity at `sVis=1` + `∝sVis` at `sVis>1`; `uDispDomainScale` default `=== 1.0`; positive
  pin that the frame loop is the ONLY writer of `uDispDomainScale`; the GLSL-region sVis-token
  ban still green (uniform-name indirection).
- Golden-route inertness test (Slice D) — display-density bake factor `=== 1.0` on the
  headless/golden route → `verify-golden 40c18aad` byte-identical.

### Stays green unchanged
- `tests/planet-vis-scale.test.js` (all 9) — AC-VIS-MONO, AC-CLAMP unit, AC-LOD-KEY identity:
  the P6 disc-growth / clamp / LOD layer is untouched.
- `tests/vis-scale-fence.test.js` — the `src/worldengine/**` sVis-free walk; the
  `run-golden`/`canonical` procgen-surface bans; the height/river GLSL sVis-token bans (survive
  via uniform-name indirection); the AC-LOD-KEY source pins; the AC-0 single-input pin.
- **inc3b physics pins** — `worldengine-inc3b-synth-law.test.js` (computes `uCraterScale` via
  `lab-core`'s `featureFrequencyFromKm(RE,…)` at real R — line 51/79 — so the display `·sVis`
  at HTML `:6059` is invisible to it), `worldengine-inc3b-crater-relevance.test.js`,
  `worldengine-v2-6-craters.test.js`. **Constraint for the builder: the `·sVis`/`displayRadius`
  factor lives ONLY at the HTML uniform write (`uCraterScale` `:6059`, `uCraterAmp` `:6060`) —
  never in `lab-core`'s `featureFrequencyFromKm`, never in the `bombardment.js` schedule, AND
  never in the lab route-time crater-derivation block `world-engine-lab.html:3689–3740` (lens #7:
  this block is a lab derivation the "schedule derivations" phrase does NOT cover, and the
  synth-law source-regex `:143` is blind to a `/sVis` appended at `:3726`) — or these pins
  break / silently pass a physics corruption.**

### Goldens
- **NO re-capture.** `verify-golden` matches hash `40c18aad`, 1200/1200 samples, no `--record`
  — but note (lens #1) it is a pure orbital-motion trajectory with NO bake references, so it is
  an incidental backstop, NOT the bake guarantee. The BAKE byte-identity is carried by the
  carrier goldens (`v2-0-byte-identity`, `worldengine-base-height-sphere`, `relief-height-cube`)
  + the inc3b composite pins, kept byte-identical by the fence + default-1.0 params + real-R
  golden bake.
- **Full suite:** the exact 4-test-failure baseline (the 4 `GalacticFeatures`/`KnownObjects`
  pre-existing failures) — unchanged.

---

## Hard-fence compliance checklist (builder self-audit before commit)
- [ ] `grep -rnE 'visScaleOf|\bsVis\b|VIS_SCALE_EXP' src/worldengine/ planet-lod-height.glsl.js
  planet-lod-river-amplifier.glsl.js planet-lod-rivers.js tests/golden-trajectories/` →
  **0 hits** (uniform NAMES only in GLSL; token never in worldengine/rivers/golden — rivers.js
  added per lens #9).
- [ ] **Bake byte-identity is pinned against the goldens that RUN the bake** —
  `tests/v2-0-byte-identity.test.js`, `tests/worldengine-base-height-sphere.test.js`,
  `tests/relief-height-cube.test.js` (they recompute the carrier via
  `makeSphereField(buildIrregularSphere(…))`+`writeHeightSphere`) → **byte-identical**, plus the
  inc3b composite pins (`worldengine-v2-5-preset-composite`, `worldengine-inc3b-composite-budget`,
  `worldengine-inc3b-relief-budget`). `verify-golden 40c18aad` (pure orbital motion, no bake
  refs) is an incidental backstop, NOT the bake guarantee (lens #1).
- [ ] full suite → 4-failure baseline exact.
- [ ] `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js` — **untouched, unstaged**
  (pre-existing NOT-OURS working-tree mods).
- [ ] inc3b schedule/law derivations (bombardment schedule, relief-budget `f_I`, synth crater
  law, `D_FLOOR_KM`, `D_char`, `MESH_FLOOR_RAD`) — **unchanged**; only display km→angular
  conversion added.
- [ ] **Barred derivation sites (lens #7):** the lab route-time crater block
  `world-engine-lab.html:3689–3740` (`state.craterSizeKm`/`craterAmp`/`craterDensity`/
  `craterRelaxation`) and the amp derivation at `:3726` are **byte-untouched**; any `uCraterAmp`
  display factor lives ONLY at the write `:6060`, and `uCraterScale·sVis` only at `:6059`.
- [ ] **`carrier.verts[i]` (shared unit dirs) never scaled (lens #2)** — the Slice-D display
  factor is confined to the continuous-body height terms; if a `domainScale` param is threaded
  into `writeHeightSphere`/`makeSphereField` its default is `1.0` and the bake goldens above
  are byte-identical at default.
- [ ] `sVis = 1` (radius 1 R⊕) → every new expression is identity (`uDispDomainScale=1`,
  `uCraterScale·1`, P5b combiner `*Scale·1`, `featureFrequencyFromKm(1,…)=featureFrequencyFromKm(R=1,…)`,
  `domainScale=1`).
- [ ] **Read-gate captures are canvas-element-only with the radius readouts hidden (lens #5);
  a live-profile `octAuto`-ON pass ran (lens #6); form px measured THROUGH a real drag at
  `bake=1` (lens #4).**
- [ ] no commits, no servers, no browsers from build agents.

---

## LENS-LOG — reviser pass (2026-07-24, source-verified)

Nine must-fixes were submitted. **All 9 independently verified true against source and FOLDED;
0 rejected.** Each was checked at the cited line numbers in the live tree (not taken on the
lens's word). How each was folded:

1. **Slice-D inertness pinned against the wrong golden — VERIFIED, FOLDED.** Confirmed
   `run-golden.mjs`/`canonical-scenario.js` import only `createAccumulator`+`mulberry32` and
   contain ZERO `bake`/`makeSphereField`/`writeHeightSphere` refs (grep clean), so hash
   `40c18aad` is inert to Slice D. Confirmed the bake is hashed by `v2-0-byte-identity.test.js`
   (`makeSphereField(buildIrregularSphere(…))`+`writeHeightSphere`, 75 hashes vs
   `fixtures/v2-0-carrier-goldens.json`), `worldengine-base-height-sphere.test.js`,
   `relief-height-cube.test.js`. → Re-targeted Slice-D "Test additions"; corrected the Goldens
   section + hard-fence checklist to name the carrier goldens as THE bake guarantee and
   `verify-golden` as an incidental backstop.
2. **"Scale the mesh sample positions" corrupts the shared carrier — VERIFIED, FOLDED.**
   Confirmed `carrier.verts[i]` are shared unit dirs (`sphereField.js:4`) read by
   `writeHeightSphere:146` for `latDegOf`(asin verts.y)/`tangentFrameAt`/grain/plateau, and the
   continent freqs are hardcoded (`steeredNoise3 9.0` `tectonic.js:151`, `noisePlateau(d*6)`
   `:156`) with no domain hook — so confining requires a worldengine param edit (default 1.0,
   pinned) or a separate lab-side eval; scaling shared verts is PHYSICS corruption. → Rewrote
   Slice-D "Edit sites" to bar scaling `carrier.verts`, specify the confined mechanism + param
   default-1.0 pin, and flag the byte-safe fallback. Added checklist line.
3. **Fixed-uniform relief-combiner class missed — VERIFIED, FOLDED (headline).** Confirmed 16
   combiner uniforms (`uMountainScale`…`uCityScale`) written from `state` constants at the cited
   lines, angular-fixed in GLSL (`pos*uMountainScale` `:1477`, `field*uScarpFreq`, etc.), run
   UNCONDITIONALLY after the bake `if/else` (ends `:386`; combiner calls `:399–419`), and missed
   by Slice B (not `featureFrequencyFromKm`) AND Slice C (the 9 `uNoiseScale` refs are only
   `630-633/753/971/2147/2178`; none of these combiners read it). `mountainScale=1.6` → 4.0×
   growth R0.5→R8. → Added the P5b census to Slice B + fence allowlist entry.
4. **Mid-drag transient at `bake=1` — VERIFIED, FOLDED.** Confirmed `planet.scale.setScalar(sVis)`
   is a per-frame write (`:5656`) tracking live `state.planetRadiusEarth`, while Slice A
   debounces the re-derive (220 ms) and Slice D re-bakes on settle — so the stale baked cube
   scales 1:1 with the disc mid-drag (Max's verbatim). → Added a mid-drag-contract decision + a
   through-drag form-px read-gate step; checklist line.
5. **Read-gate GUI radius-leak — VERIFIED, FOLDED.** Confirmed `:3903` renders live
   `radius (km)` (=`planetRadiusEarth*6371`, "3186" at R=0.5), `:3902` the RE label/value, and
   Slice A adds another readout; the read-gate pinned 900×900 but never specified an
   element-only crop. → Added a hard canvas-element-only + hide-readouts staging requirement.
6. **`uDispDomainScale × fwidth/LOD` confound invisible to the frozen-LOD gate — VERIFIED,
   FOLDED.** Confirmed the `fbmd` anti-shimmer clamp `w *= 1 - smoothstep(0.4,0.8,fwBase*freq)`
   (`:759–762`), ON at the live default (`uFwClamp:{value:1}`), and `autoOctaves` keying on
   `logicalDist=distance/sVis` (`:5688–5690`); the read-gate pins `octAuto=false, octaves=8`,
   removing the confound. → Added read-gate pass (d): `octAuto` ON at default camera.
7. **Crater display-factor site precision — VERIFIED, FOLDED.** Confirmed `uCraterScale` write
   `:6059`, `uCraterAmp` write `:6060`, `craterAmp` derivation `:3726` inside the route-time
   block `:3689–3740`; and the synth-law source-regex `:143`
   (`/…CRATER_DEPTH)\s*\*\s*radPerKm\(/`) matches only the prefix, blind to a `/sVis` at `:3726`
   (unit test recomputes amp at `:55`, also blind). Confirmed `craterCombiner` (GLSL
   `1959–2036`) reads no `uNoiseScale`, so #7(3) is a valid preventive guard. → Named `:6060` as
   the ONLY amp site, barred `:3689–3740`, added the no-double-scale guard; tightened the inc3b
   pins constraint + checklist.
8. **Slice D grounded on the AC2 probe, budget interaction unanalyzed — VERIFIED, FOLDED.**
   Confirmed lab `:6921/:6923` are inside `_bakedReliefAt` (the "AC2 parity probe"), NOT the
   production bake; the real bake is `planet-lod-rivers.js` `route():1297` →
   `makeSphereField:1315` → `writeHeightSphere` → `compositeMargins(carrier, relief.reliefBudget)`
   `:1361` (RMS-preserving `w_e/w_i` vs `deriveReliefBudget:608` real-R `f_I`). → Re-grounded
   Slice D on `route()`; added the compositeMargins budget-re-solve characterization + live read-gate.
9. **`planet-lod-rivers.js` absent from the fence — VERIFIED, FOLDED.** Confirmed the file is
   sVis-token-free (grep=0), hosts `compositeMargins`+the bake, and was NOT in the D1 denylist;
   confirmed the golden trajectory harness does not import it while the inc3b composite pins
   (`worldengine-v2-5-preset-composite:99-136`, `-inc3b-composite-budget`, `-inc3b-relief-budget`)
   and the carrier byte goldens (import `buildIrregularSphere` from it) do. → Added `rivers.js`
   to the D1 re-scope sVis-free list + the grep fence + a positive default-1.0 assertion.

**Rejected: none.** Every claim's cited source matched the tree; no lens overreached.
